const App = {
    data: {
        words: [],
        goal: 100,
        stats: { today: 0, streak: 0, lastDate: null }
    },
    session: { queue: [], currentIdx: 0, sessionLearnedCount: 0 },
    tempStatusChange: { id: null, newStatus: null },
    wordToDeleteId: null,
    currentDestructiveAction: null,

    init() {
        const stored = localStorage.getItem('wordmaster_prod_v2');
        if (stored) {
            this.data = JSON.parse(stored);
        } else {
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

        this.renderDashboard();
        this.setupListeners();
    },

    setupListeners() {
        document.querySelectorAll('.count-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
    },

    save() {
        localStorage.setItem('wordmaster_prod_v2', JSON.stringify(this.data));
    },

    // --- Destructive Actions ---
    initResetStats() {
        this.currentDestructiveAction = 'resetStats';
        this.openDangerModal1("Reset Statistics?", "This will reset streaks, today's count, and learning progress.");
    },

    initDeleteAllWords() {
        this.currentDestructiveAction = 'deleteAll';
        this.openDangerModal1("Delete All Words?", "This will delete every single word from your dictionary.");
    },

    openDangerModal1(title, text) {
        document.getElementById('dz-title-1').innerText = title;
        document.getElementById('dz-text-1').innerText = text;
        document.getElementById('modal-danger-1').style.display = 'flex';
    },

    dangerStep2() {
        this.closeModal('modal-danger-1');
        document.getElementById('modal-danger-2').style.display = 'flex';
    },

    executeDestructiveAction() {
        if (this.currentDestructiveAction === 'resetStats') {
            this.data.stats = { today: 0, streak: 0, lastDate: null };
            this.save();
            this.renderDashboard();
            this.showMessage("Success", "Statistics have been reset.");
        }
        else if (this.currentDestructiveAction === 'deleteAll') {
            this.data.words = [];
            this.data.stats = { today: 0, streak: 0, lastDate: null };
            this.save();
            this.renderDashboard();
            this.renderDictionary();
            this.showMessage("Success", "All words deleted.");
        }

        this.closeModal('modal-danger-2');
        this.currentDestructiveAction = null;
    },

    // --- UI Helpers ---
    showMessage(title, text) {
        document.getElementById('msg-title').innerText = title;
        document.getElementById('msg-text').innerText = text;
        document.getElementById('modal-message').style.display = 'flex';
    },

    // --- GOAL Editing ---
    openGoalModal() {
        document.getElementById('inp-goal').value = this.data.goal;
        document.getElementById('modal-goal').style.display = 'flex';
        setTimeout(() => document.getElementById('inp-goal').focus(), 100);
    },

    editGoal() {
        this.openGoalModal();
    },

    saveGoal() {
        const val = parseInt(document.getElementById('inp-goal').value);
        if (val && val > 0) {
            this.data.goal = val;
            this.save();
            this.renderDashboard();
            this.closeModal('modal-goal');
        } else {
            this.showMessage("Invalid Goal", "Please enter a valid number greater than 0.");
        }
    },

    // --- Session Logic ---
    startSession() {
        const count = parseInt(document.querySelector('.count-btn.active').dataset.val);
        const filter = document.getElementById('train-filter').value;

        let pool = this.data.words.filter(w => {
            if (filter === 'new_learning') return w.status === 'new' || w.status === 'learning';
            if (filter === 'new') return w.status === 'new';
            if (filter === 'learned') return w.status === 'learned';
            if (filter === 'all') return true;
            return false;
        });

        if (pool.length === 0) {
            this.showMessage('No words found', 'Try adding new words or changing the filter settings.');
            return;
        }

        pool.sort(() => Math.random() - 0.5);
        this.session.queue = pool.slice(0, count);
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

        document.getElementById('modal-complete').style.display = 'flex';
    },

    closeSessionModal() {
        document.getElementById('modal-complete').style.display = 'none';
        this.navigate('dashboard');
    },

    // --- Navigation ---
    navigate(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-item, .m-nav-item').forEach(n => n.classList.remove('active'));
        document.getElementById('view-' + viewId).classList.add('active');

        if (viewId === 'dashboard') {
            document.querySelectorAll('.nav-item:nth-child(1), .m-nav-item:nth-child(1)').forEach(b => b.classList.add('active'));
            this.renderDashboard();
        } else if (viewId === 'dictionary') {
            document.querySelectorAll('.nav-item:nth-child(2), .m-nav-item:nth-child(3)').forEach(b => b.classList.add('active'));
            this.renderDictionary();
        }
    },

    // --- Dashboard ---
    renderDashboard() {
        const total = this.data.words.length;
        const learned = this.data.words.filter(w => w.status === 'learned').length;

        document.getElementById('stat-total').innerText = total;
        document.getElementById('stat-learned').innerText = learned;
        document.getElementById('stat-today').innerText = this.data.stats.today;
        document.getElementById('streak-val').innerText = this.data.stats.streak;

        document.getElementById('goal-target').innerText = this.data.goal;
        document.getElementById('goal-current').innerText = learned;
        document.getElementById('goal-max').innerText = this.data.goal;
        const pct = this.data.goal > 0 ? Math.min(100, (learned / this.data.goal) * 100) : 0;
        document.getElementById('progress-fill').style.width = pct + '%';

        const recent = [...this.data.words].sort((a,b) => b.date - a.date).slice(0, 3);
        const list = document.getElementById('recent-list');
        list.innerHTML = '';

        if (recent.length === 0) {
            list.innerHTML = `
                <div class="empty-state" onclick="App.openModal()">
                    Time for adding a new word! ✍️
                </div>
            `;
        } else {
            recent.forEach(w => list.appendChild(this.createWordItem(w)));
        }
    },

    // --- Dictionary ---
    renderDictionary() {
        const list = document.getElementById('dictionary-list');
        list.innerHTML = '';
        const filterStatus = document.getElementById('dict-filter').value;
        const search = document.getElementById('search-input').value.toLowerCase();

        const tags = [...new Set(this.data.words.map(w => w.tag).filter(t=>t))];
        document.getElementById('tags-list').innerHTML = tags.map(t => `<option value="${t}">`).join('');

        const filtered = this.data.words.filter(w => {
            const matchStatus = filterStatus === 'all' || w.status === filterStatus;
            const matchSearch = w.word.toLowerCase().includes(search) ||
                w.trans.toLowerCase().includes(search) ||
                w.tag.toLowerCase().includes(search) ||
                (w.source && w.source.toLowerCase().includes(search));
            return matchStatus && matchSearch;
        }).sort((a, b) => b.date - a.date);

        filtered.forEach(w => list.appendChild(this.createWordItem(w, true)));
    },

    createWordItem(w, isDictionary = false) {
        const div = document.createElement('div');
        div.className = 'word-item';
        const statusMap = { 'new': 'New', 'learning': 'Learning', 'learned': 'Learned' };
        const sourceHtml = w.source ? `<span class="source-badge"><i class="fas fa-link"></i> ${w.source}</span>` : '';

        div.innerHTML = `
            <div class="w-main" onclick="App.openModal(${w.id})">
                <strong>${w.word}</strong>
                <div class="w-trans">${w.trans}</div>
            </div>
            <div class="w-meta">
                ${sourceHtml}
                <span class="tag-badge">${w.tag}</span>
                <div class="status-badge st-${w.status}" onclick="event.stopPropagation(); App.openStatusChangeModal(${w.id})">
                    ${statusMap[w.status]}
                </div>
                ${isDictionary ? `<div class="action-icons"><i class="fas fa-pen" onclick="App.openModal(${w.id})"></i></div>` : ''}
            </div>
        `;
        return div;
    },

    // --- Status Change ---
    openStatusChangeModal(id) {
        this.tempStatusChange.id = id;
        document.getElementById('modal-status').style.display = 'flex';
    },
    requestStatusChange(newStatus) {
        this.tempStatusChange.newStatus = newStatus;
        this.closeModal('modal-status');
        document.getElementById('modal-confirm').style.display = 'flex';
    },
    confirmStatusChange() {
        const { id, newStatus } = this.tempStatusChange;
        if (id && newStatus) {
            const idx = this.data.words.findIndex(w => w.id === id);
            if (idx > -1) {
                this.data.words[idx].status = newStatus;
                this.save();
                this.renderDashboard();
                this.renderDictionary();
            }
        }
        this.closeModal('modal-confirm');
    },

    // --- Modals ---
    openModal(id = null) {
        document.getElementById('modal-overlay').style.display = 'flex';
        const form = document.getElementById('word-form');
        form.reset();
        if (id) {
            const w = this.data.words.find(i => i.id === id);
            document.getElementById('modal-title').innerText = 'Edit Word';
            document.getElementById('inp-id').value = w.id;
            document.getElementById('inp-word').value = w.word;
            document.getElementById('inp-trans').value = w.trans;
            document.getElementById('inp-example').value = w.example || '';
            document.getElementById('inp-tag').value = w.tag;
            document.getElementById('inp-source').value = w.source || '';
            document.getElementById('btn-delete').style.display = 'block';
        } else {
            document.getElementById('modal-title').innerText = 'Add Word';
            document.getElementById('inp-id').value = '';
            document.getElementById('btn-delete').style.display = 'none';
        }
    },

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    },

    // --- Data Actions ---
    saveWord() {
        const id = document.getElementById('inp-id').value;
        const wordVal = document.getElementById('inp-word').value;
        const transVal = document.getElementById('inp-trans').value;

        // Validation
        const hasNumber = /\d/;
        if (hasNumber.test(wordVal) || hasNumber.test(transVal)) {
            this.showMessage('Validation Error', 'Word and Translation cannot contain numbers.');
            return;
        }

        const newWord = {
            id: id ? parseInt(id) : Date.now(),
            word: wordVal,
            trans: transVal,
            example: document.getElementById('inp-example').value,
            tag: document.getElementById('inp-tag').value,
            source: document.getElementById('inp-source').value,
            status: id ? this.data.words.find(w => w.id == id).status : 'new',
            date: Date.now()
        };

        if (id) {
            const idx = this.data.words.findIndex(w => w.id == id);
            this.data.words[idx] = { ...this.data.words[idx], ...newWord };
        } else {
            this.data.words.push(newWord);
        }
        this.save();
        this.closeModal('modal-overlay');
        this.renderDashboard();
        this.renderDictionary();
    },

    promptDelete() {
        const id = document.getElementById('inp-id').value;
        if (!id) return;
        this.wordToDeleteId = parseInt(id);

        // Show confirm modal WITHOUT closing the edit form
        document.getElementById('modal-delete-confirm').style.display = 'flex';
    },

    confirmDeleteAction() {
        if (this.wordToDeleteId) {
            this.data.words = this.data.words.filter(w => w.id !== this.wordToDeleteId);
            this.save();
            this.wordToDeleteId = null;
            this.closeModal('modal-delete-confirm');
            this.closeModal('modal-overlay'); // NOW close the edit form too
            this.renderDashboard();
            this.renderDictionary();
        }
    }
};

App.init();