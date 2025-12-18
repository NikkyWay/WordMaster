const App = {
    data: {
        words: [],
        goal: 100,
        stats: { today: 0, streak: 0, lastDate: null },
        goalReached: false
    },
    session: { queue: [], currentIdx: 0, sessionLearnedCount: 0 },
    tempStatusChange: { id: null, newStatus: null },
    wordToDeleteId: null,
    currentDestructiveAction: null,
    selectedSpecificIds: [],

    tempGoalMode: 'edit',

    init() {
        try {
            const stored = localStorage.getItem('wordmaster_prod_v2');
            if (stored) {
                this.data = JSON.parse(stored);
                this.data.words = this.data.words || [];
                this.data.stats = this.data.stats || { today: 0, streak: 0, lastDate: null };
                this.data.goalReached = (this.data.goalReached === undefined) ? false : this.data.goalReached;
                if (this.data.goalStartCount === undefined) this.data.goalStartCount = 0;
            }
        } catch(e) {
            console.error("Load error", e);
            this.data.words = [];
        }

        const todayStr = new Date().toDateString();
        if (this.data.stats.lastDate !== todayStr) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            if (this.data.stats.lastDate && this.data.stats.lastDate !== yesterday.toDateString()) {
                this.data.stats.streak = 0;
            }
            if (this.data.stats.lastDate !== todayStr) {
                this.data.stats.today = 0;
            }
        }

        this.selectedSpecificIds = [];
        this.renderDashboard();
        this.setupListeners();

        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            const wrapper = document.querySelector('.multi-select-wrapper');
            const dropdown = document.getElementById('specific-dropdown');
            if (wrapper && dropdown && !wrapper.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });

        // --- НОВОЕ: Закрытие модалок по ESC ---
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Находим все открытые модалки
                const openModals = document.querySelectorAll('.modal-overlay');
                openModals.forEach(modal => {
                    if (modal.style.display === 'flex') {
                        // Если открыто "Add Word" или "Edit Word", сбрасываем форму
                        if (modal.id === 'modal-overlay') {
                            const form = document.getElementById('word-form');
                            if (form) form.reset();
                        }
                        modal.style.display = 'none';
                    }
                });
            }
        });
    },

    setupListeners() {
        document.querySelectorAll('.count-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const inp = document.getElementById('custom-count');
                if(inp) inp.value = '';
            });
        });

        const customInput = document.getElementById('custom-count');
        if (customInput) {
            customInput.addEventListener('input', () => {
                if (customInput.value.length > 0) {
                    document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
                }
            });
        }
    },

    save() {
        localStorage.setItem('wordmaster_prod_v2', JSON.stringify(this.data));
    },

    editGoal() {
        this.openGoalModal('edit');
    },

    openGoalModalFromSuccess() {
        this.closeModal('modal-goal-reached');
        this.openGoalModal('new');
    },

    openGoalModal(mode) {
        this.tempGoalMode = mode;

        const inp = document.getElementById('inp-goal');
        if (mode === 'edit') {
            inp.value = this.data.goal;
        } else {
            inp.value = '';
            inp.placeholder = "Enter new target (e.g. 10)";
        }

        this.openModal('modal-goal');
        setTimeout(() => inp.focus(), 100);
    },

    saveGoal() {
        const val = parseInt(document.getElementById('inp-goal').value);
        if (val && val > 0) {
            this.data.goal = val;

            if (this.tempGoalMode === 'new') {
                const totalLearned = this.data.words.filter(w => w.status === 'learned').length;
                this.data.goalStartCount = totalLearned;
            }

            this.data.goalReached = false;

            this.save();
            this.renderDashboard();
            this.closeModal('modal-goal');
            this.navigate('dashboard');
        } else {
            this.showMessage("Invalid Goal", "Please enter a valid number greater than 0.");
        }
    },

    closeGoalSuccess() {
        this.data.goalReached = true;
        this.save();
        this.closeModal('modal-goal-reached');
        this.navigate('dashboard');
    },

    getGoalProgress() {
        const totalLearned = this.data.words.filter(w => w.status === 'learned').length;
        const start = this.data.goalStartCount || 0;
        let progress = totalLearned - start;
        if (progress < 0) progress = 0;
        return progress;
    },

    checkGoal() {
        const progress = this.getGoalProgress();
        const modal = document.getElementById('modal-goal-reached');

        if (this.data.goal > 0 && progress >= this.data.goal && !this.data.goalReached && modal) {
            this.data.goalReached = true;
            this.save();
            const valEl = document.getElementById('goal-reached-val');
            if(valEl) valEl.innerText = progress;
            this.openModal('modal-goal-reached');
        }
    },

    startSession() {
        let count = 20;
        const customCountVal = parseInt(document.getElementById('custom-count').value);
        const activeBtn = document.querySelector('.count-btn.active');
        let isMax = false;

        if (customCountVal && customCountVal > 0) {
            count = customCountVal;
        } else if (activeBtn) {
            const btnVal = activeBtn.dataset.val;
            if (btnVal === 'max') { isMax = true; count = 999999; }
            else { count = parseInt(btnVal); }
        }

        const statusFilter = document.getElementById('train-filter').value;
        const tagFilter = document.getElementById('train-tag').value;
        const sourceFilter = document.getElementById('train-source').value;

        let generalPool = this.data.words.filter(w => {
            let statusMatch = false;
            if (statusFilter === 'new_learning') statusMatch = (w.status === 'new' || w.status === 'learning');
            else if (statusFilter === 'new') statusMatch = (w.status === 'new');
            else if (statusFilter === 'learned') statusMatch = (w.status === 'learned');
            else if (statusFilter === 'all') statusMatch = true;

            const tagMatch = (tagFilter === 'all') || (w.tag === tagFilter);
            const sourceMatch = (sourceFilter === 'all') || (w.source === sourceFilter);

            return statusMatch && tagMatch && sourceMatch;
        });

        const specificPool = this.selectedSpecificIds
            .map(id => this.data.words.find(w => w.id === id))
            .filter(Boolean);

        const remainingGeneral = generalPool.filter(w => !this.selectedSpecificIds.includes(w.id));

        let sessionList = [...specificPool];

        if (isMax) {
            sessionList = sessionList.concat(remainingGeneral);
        } else {
            if (sessionList.length < count) {
                const needed = count - sessionList.length;
                remainingGeneral.sort(() => Math.random() - 0.5);
                sessionList = sessionList.concat(remainingGeneral.slice(0, needed));
            }
        }

        sessionList.sort(() => Math.random() - 0.5);

        if (sessionList.length === 0) {
            this.showMessage('No words found', 'Try changing your filter settings.');
            return;
        }

        this.session.queue = sessionList;
        this.session.currentIdx = 0;
        this.session.sessionLearnedCount = 0;

        this.navigate('learning');
        this.renderCard();
    },

    renderCard() {
        if (this.session.currentIdx >= this.session.queue.length) {
            this.finishSession();
            return;
        }

        const w = this.session.queue[this.session.currentIdx];
        const total = this.session.queue.length;

        document.getElementById('session-counter').innerText = `${this.session.currentIdx + 1} / ${total}`;
        document.getElementById('session-progress').style.width = ((this.session.currentIdx / total) * 100) + '%';

        document.getElementById('fc-tag').innerText = w.tag;
        document.getElementById('fc-word').innerText = w.word;

        document.getElementById('fc-answer-block').style.display = 'none';
        document.getElementById('btn-show').style.display = 'inline-block';
        document.getElementById('fc-buttons').style.display = 'none';

        document.getElementById('fc-translation').innerText = w.trans;
        document.getElementById('fc-example').innerText = w.example || '';
        document.getElementById('fc-example').style.display = w.example ? 'block' : 'none';
    },

    revealCard() {
        document.getElementById('fc-answer-block').style.display = 'block';
        document.getElementById('btn-show').style.display = 'none';
        document.getElementById('fc-buttons').style.display = 'flex';
    },

    handleResult(known) {
        const currentWord = this.session.queue[this.session.currentIdx];
        const realIdx = this.data.words.findIndex(w => w.id === currentWord.id);

        if (known) {
            this.data.words[realIdx].status = 'learned';
            this.data.stats.today++;
            this.session.sessionLearnedCount++;
        } else {
            this.data.words[realIdx].status = 'learning';
        }

        this.save();
        this.session.currentIdx++;
        this.renderCard();
    },

    finishSession() {
        const todayStr = new Date().toDateString();
        let streakIncreased = false;

        if (this.data.stats.lastDate !== todayStr) {
            this.data.stats.streak++;
            this.data.stats.lastDate = todayStr;
            streakIncreased = true;
        } else {
            this.data.stats.lastDate = todayStr;
        }

        this.save();

        document.getElementById('cs-count').innerText = this.session.sessionLearnedCount;

        const streakEl = document.getElementById('cs-streak');
        if (streakIncreased) {
            streakEl.innerText = "+1";
            streakEl.className = "stat-big streak-plus";
        } else {
            streakEl.innerHTML = `${this.data.stats.streak} <span style="font-size:16px">🔥</span>`;
            streakEl.className = "stat-big";
        }

        this.openModal('modal-complete');
    },

    closeSessionModal() {
        this.closeModal('modal-complete');
        this.selectedSpecificIds = [];
        this.renderSpecificChips();

        const progress = this.getGoalProgress();
        const modal = document.getElementById('modal-goal-reached');

        if (this.data.goal > 0 && progress >= this.data.goal && modal) {
            this.data.goalReached = true;
            this.save();
            const valEl = document.getElementById('goal-reached-val');
            if(valEl) valEl.innerText = progress;
            this.openModal('modal-goal-reached');
        } else {
            this.navigate('dashboard');
        }
    },

    openModal(modalId) {
        const el = document.getElementById(modalId);
        if(el) el.style.display = 'flex';
    },
    closeModal(modalId) {
        const el = document.getElementById(modalId);
        if(el) el.style.display = 'none';
    },

    navigate(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-item, .m-nav-item').forEach(n => n.classList.remove('active'));

        const target = document.getElementById('view-' + viewId);
        if(target) target.classList.add('active');

        if (viewId === 'dashboard') {
            document.querySelectorAll('.nav-item:nth-child(1), .m-nav-item:nth-child(1)').forEach(b => b.classList.add('active'));
            this.renderDashboard();
        } else if (viewId === 'dictionary') {
            document.querySelectorAll('.nav-item:nth-child(2), .m-nav-item:nth-child(3)').forEach(b => b.classList.add('active'));
            this.renderDictionary();
        }
    },

    renderDashboard() {
        const list = document.getElementById('recent-list');
        if (!list) return;

        const total = this.data.words.length;
        const learned = this.data.words.filter(w => w.status === 'learned').length;

        document.getElementById('stat-total').innerText = total;
        document.getElementById('stat-learned').innerText = learned;
        document.getElementById('stat-today').innerText = this.data.stats.today;
        document.getElementById('streak-val').innerText = this.data.stats.streak;

        const progress = this.getGoalProgress();
        document.getElementById('goal-target').innerText = this.data.goal;
        document.getElementById('goal-current').innerText = progress;
        document.getElementById('goal-max').innerText = this.data.goal;

        let pct = 0;
        if (this.data.goal > 0) {
            pct = Math.min(100, (progress / this.data.goal) * 100);
        }
        document.getElementById('progress-fill').style.width = pct + '%';

        const recent = [...this.data.words].sort((a,b) => b.date - a.date).slice(0, 3);
        list.innerHTML = '';

        if (recent.length === 0) {
            list.innerHTML = `<div class="empty-state" onclick="App.openAddWordModal()">Time for adding a new word! ✍️</div>`;
        } else {
            recent.forEach(w => list.appendChild(this.createWordItem(w)));
        }
        this.populateTrainingFilters();
    },

    renderDictionary() {
        const list = document.getElementById('dictionary-list');
        if (!list) return;
        list.innerHTML = '';

        const filterStatus = document.getElementById('dict-filter').value;
        const search = document.getElementById('search-input').value.toLowerCase();

        const filtered = this.data.words.filter(w => {
            const matchStatus = filterStatus === 'all' || w.status === filterStatus;
            const matchSearch = w.word.toLowerCase().includes(search) ||
                w.trans.toLowerCase().includes(search) ||
                (w.tag && w.tag.toLowerCase().includes(search)) ||
                (w.source && w.source.toLowerCase().includes(search));
            return matchStatus && matchSearch;
        }).sort((a, b) => b.date - a.date);

        filtered.forEach(w => list.appendChild(this.createWordItem(w, true)));
    },

    createWordItem(w, isDictionary = false) {
        const div = document.createElement('div');
        div.className = 'word-item';
        const statusMap = { 'new': 'New', 'learning': 'Learning', 'learned': 'Learned' };

        let sourceHtml = '';
        if (w.source) sourceHtml = `<span class="source-badge"><i class="fas fa-link"></i> ${w.source}</span>`;

        div.innerHTML = `
            <div class="w-main" onclick="App.openEditWordModal(${w.id})">
                <strong>${w.word}</strong>
                <div class="w-trans">${w.trans}</div>
            </div>
            <div class="w-meta">
                ${sourceHtml}
                <span class="tag-badge">${w.tag}</span>
                <div class="status-badge st-${w.status}" onclick="event.stopPropagation(); App.openStatusChangeModal(${w.id})">
                    ${statusMap[w.status] || w.status}
                </div>
                ${isDictionary ? `<div class="action-icons"><i class="fas fa-pen" onclick="App.openEditWordModal(${w.id})"></i></div>` : ''}
            </div>
        `;
        return div;
    },

    openAddWordModal() {
        document.getElementById('word-form').reset();
        document.getElementById('modal-title').innerText = 'Add Word';
        document.getElementById('inp-id').value = '';
        document.getElementById('btn-delete').style.display = 'none';
        this.openModal('modal-overlay');
    },

    openEditWordModal(id) {
        const w = this.data.words.find(i => i.id === id);
        if (!w) return;
        document.getElementById('modal-title').innerText = 'Edit Word';
        document.getElementById('inp-id').value = w.id;
        document.getElementById('inp-word').value = w.word;
        document.getElementById('inp-trans').value = w.trans;
        document.getElementById('inp-example').value = w.example || '';
        document.getElementById('inp-tag').value = w.tag || '';
        document.getElementById('inp-source').value = w.source || '';
        document.getElementById('btn-delete').style.display = 'block';
        this.openModal('modal-overlay');
    },

    openStatusChangeModal(id) {
        this.tempStatusChange.id = id;
        this.openModal('modal-status');
    },
    requestStatusChange(newStatus) {
        this.tempStatusChange.newStatus = newStatus;
        this.closeModal('modal-status');
        this.openModal('modal-confirm');
    },
    confirmStatusChange() {
        this.closeModal('modal-confirm');
        const { id, newStatus } = this.tempStatusChange;
        if (id && newStatus) {
            const idx = this.data.words.findIndex(w => w.id === id);
            if (idx > -1) {
                this.data.words[idx].status = newStatus;
                this.save();
                this.renderDashboard();
                this.renderDictionary();
                const progress = this.getGoalProgress();
                if (this.data.goal > 0 && progress >= this.data.goal && !this.data.goalReached) {
                    this.checkGoal();
                }
            }
        }
    },
    promptDelete() {
        const id = document.getElementById('inp-id').value;
        if (!id) return;
        this.wordToDeleteId = parseInt(id);
        this.openModal('modal-delete-confirm');
    },
    confirmDeleteAction() {
        this.closeModal('modal-delete-confirm');
        this.closeModal('modal-overlay');
        if (this.wordToDeleteId) {
            this.data.words = this.data.words.filter(w => w.id !== this.wordToDeleteId);
            this.save();
            this.wordToDeleteId = null;
            this.renderDashboard();
            this.renderDictionary();
        }
    },
    initResetStats() {
        this.currentDestructiveAction = 'resetStats';
        this.openDangerModal1("Reset Statistics?", "This will reset streaks & stats.");
    },
    initDeleteAllWords() {
        this.currentDestructiveAction = 'deleteAll';
        this.openDangerModal1("Delete All Words?", "Deletes everything.");
    },
    openDangerModal1(title, text) {
        document.getElementById('dz-title-1').innerText = title;
        document.getElementById('dz-text-1').innerText = text;
        this.openModal('modal-danger-1');
    },
    dangerStep2() {
        this.closeModal('modal-danger-1');
        this.openModal('modal-danger-2');
    },
    executeDestructiveAction() {
        this.closeModal('modal-danger-2');
        this.closeModal('modal-danger-1');
        if (this.currentDestructiveAction === 'resetStats') {
            this.data.stats = { today: 0, streak: 0, lastDate: null };
            this.data.goalStartCount = 0;
            this.data.goalReached = false;
            this.save();
            this.renderDashboard();
            this.showMessage("Success", "Statistics reset.");
        } else if (this.currentDestructiveAction === 'deleteAll') {
            this.data.words = [];
            this.data.stats = { today: 0, streak: 0, lastDate: null };
            this.data.goalStartCount = 0;
            this.data.goalReached = false;
            this.save();
            this.renderDashboard();
            this.renderDictionary();
            this.showMessage("Success", "All words deleted.");
        }
        this.currentDestructiveAction = null;
    },
    saveWord() {
        this.closeModal('modal-overlay');
        const id = document.getElementById('inp-id').value;
        const wordVal = document.getElementById('inp-word').value.trim();
        const transVal = document.getElementById('inp-trans').value.trim();
        if (/\d/.test(wordVal) || /\d/.test(transVal)) {
            this.openModal('modal-overlay');
            this.showMessage('Validation Error', 'No numbers allowed.');
            return;
        }
        let existingStatus = 'new';
        if (id) {
            const w = this.data.words.find(i => i.id == id);
            if (w) existingStatus = w.status;
        }
        const newWord = {
            id: id ? parseInt(id) : Date.now(),
            word: wordVal,
            trans: transVal,
            example: document.getElementById('inp-example').value.trim(),
            tag: document.getElementById('inp-tag').value.trim(),
            source: document.getElementById('inp-source').value.trim(),
            status: existingStatus,
            date: Date.now()
        };
        if (id) {
            const idx = this.data.words.findIndex(w => w.id == id);
            if (idx > -1) this.data.words[idx] = { ...this.data.words[idx], ...newWord };
        } else {
            this.data.words.push(newWord);
        }
        this.save();
        try {
            this.renderDashboard();
            this.renderDictionary();
        } catch(e) { console.error("Render error", e); }
    },
    exportData() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.data));
        const a = document.createElement('a');
        a.setAttribute("href", dataStr);
        a.setAttribute("download", "wordmaster_backup.json");
        document.body.appendChild(a);
        a.click();
        a.remove();
    },
    importData(input) {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                if (parsed.words && parsed.stats) {
                    this.data = parsed;
                    this.save();
                    this.renderDashboard();
                    this.showMessage("Success", "Data imported successfully.");
                    this.closeModal('modal-settings');
                } else throw new Error();
            } catch (err) {
                this.showMessage("Error", "Invalid JSON file.");
            }
            input.value = '';
        };
        reader.readAsText(file);
    },
    populateTrainingFilters() {
        const tagSelect = document.getElementById('train-tag');
        const sourceSelect = document.getElementById('train-source');
        if(!tagSelect || !sourceSelect) return;
        const currentTag = tagSelect.value;
        const currentSource = sourceSelect.value;
        const tags = [...new Set(this.data.words.map(w => w.tag).filter(t => t && t.trim() !== ""))].sort();
        const sources = [...new Set(this.data.words.map(w => w.source).filter(s => s && s.trim() !== ""))].sort();
        tagSelect.innerHTML = '<option value="all">Any Tag</option>' + tags.map(t => `<option value="${t}">${t}</option>`).join('');
        sourceSelect.innerHTML = '<option value="all">Any Source</option>' + sources.map(s => `<option value="${s}">${s}</option>`).join('');
        if (tags.includes(currentTag)) tagSelect.value = currentTag;
        if (sources.includes(currentSource)) sourceSelect.value = currentSource;
    },
    handleSpecificInput(input) {
        const val = input.value.toLowerCase();
        const dropdown = document.getElementById('specific-dropdown');
        if (val.length === 0) { dropdown.style.display = 'none'; return; }
        const matches = this.data.words.filter(w => !this.selectedSpecificIds.includes(w.id) && w.word.toLowerCase().includes(val));
        if (matches.length > 0) {
            dropdown.innerHTML = matches.slice(0, 5).map(w => `
                <div class="suggestion-item" onclick="App.addSpecificWord(${w.id})">
                    <strong>${w.word}</strong> <span class="suggestion-meta">${w.trans}</span>
                </div>`).join('');
            dropdown.style.display = 'block';
        } else { dropdown.style.display = 'none'; }
    },
    addSpecificWord(id) {
        if (!this.selectedSpecificIds.includes(id)) { this.selectedSpecificIds.push(id); this.renderSpecificChips(); }
        document.getElementById('specific-word-input').value = '';
        document.getElementById('specific-dropdown').style.display = 'none';
        document.getElementById('specific-word-input').focus();
    },
    removeSpecificWord(id) {
        this.selectedSpecificIds = this.selectedSpecificIds.filter(i => i !== id);
        this.renderSpecificChips();
    },
    renderSpecificChips() {
        const container = document.getElementById('selected-chips');
        if(!container) return;
        container.innerHTML = this.selectedSpecificIds.map(id => {
            const w = this.data.words.find(word => word.id === id);
            return w ? `<div class="chip">${w.word} <i class="fas fa-times" onclick="event.stopPropagation(); App.removeSpecificWord(${id})"></i></div>` : '';
        }).join('');
    },
    showMessage(title, text) {
        document.getElementById('msg-title').innerText = title;
        document.getElementById('msg-text').innerText = text;
        this.openModal('modal-message');
    }
};

App.init();