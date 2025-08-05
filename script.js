/**
 * Peace Kombat - Arquitectura Definitiva v1.0
 * Patrones: State Management, Declarative UI, Component-based rendering, Event Delegation.
 */
class GameEngine {
    constructor(config) {
        this.config = config;
        this.state = this.getInitialState();
        this.dom = {
            root: document.getElementById('game-container'),
            loadingScreen: document.getElementById('loading-screen'),
        };
        this.init();
    }

    // 1. INICIALIZACIÓN Y CICLO DE VIDA
    init() {
        this.loadGame();
        this.bindEventListeners();
        setTimeout(() => {
            this.dom.loadingScreen.classList.add('hidden');
            this.render();
            setInterval(() => this.passiveIncomeTick(), 1000);
            setInterval(() => this.saveGame(), 10000);
        }, 1500);
    }

    getInitialState() {
        return {
            totalPeace: 0,
            peacePerHour: 0,
            peacePerTap: 1,
            totalTaps: 0,
            totalPeaceGenerated: 0,
            startDate: new Date().toISOString(),
            lastSaved: new Date().toISOString(),
            upgrades: {},
            wallet: { connected: false, address: null },
            activeView: 'tapper'
        };
    }

    bindEventListeners() {
        this.dom.root.addEventListener('click', this.handleGlobalClick.bind(this));
        window.addEventListener('beforeunload', () => this.saveGame());
    }

    // 2. MANEJO DE EVENTOS (El Controlador)
    handleGlobalClick(event) {
        const actionTarget = event.target.closest('[data-action]');
        if (!actionTarget) return;

        const action = actionTarget.dataset.action;
        const payload = actionTarget.dataset.payload;

        const actions = {
            'handle-tap': () => this.handleTap(),
            'purchase-upgrade': () => this.purchaseUpgrade(payload),
            'connect-wallet': () => this.connectWallet(),
            'switch-view': () => this.switchView(payload)
        };

        if (actions[action]) {
            actions[action]();
            this.render(); // Un solo render después de cualquier acción de estado
        }
    }

    // 3. LÓGICA DE NEGOCIO (Acciones que mutan el estado)
    handleTap() {
        const tapValue = this.state.peacePerTap;
        this.state.totalPeace += tapValue;
        this.state.totalTaps++;
        this.state.totalPeaceGenerated += tapValue;
        this.showFloatingNumber(tapValue);
        // El re-renderizado lo hace el controlador global
    }

    passiveIncomeTick() {
        const peaceFromPassive = this.state.peacePerHour / 3600;
        if (peaceFromPassive > 0) {
            this.state.totalPeace += peaceFromPassive;
            this.state.totalPeaceGenerated += peaceFromPassive;
            const peaceDisplay = document.getElementById('total-peace-value');
            if (peaceDisplay) peaceDisplay.textContent = this.formatNumber(this.state.totalPeace);
        }
    }

    purchaseUpgrade(id) {
        if (!id) return;
        const upgradeInfo = this.config.upgrades[id];
        const level = this.state.upgrades[id] || 0;
        const cost = this.calculateCost(upgradeInfo.baseCost, level);
        if (this.state.totalPeace >= cost) {
            this.state.totalPeace -= cost;
            this.state.upgrades[id] = level + 1;
            this.recalculatePeacePerHour();
        }
    }

    switchView(view) {
        if (view && this.state.activeView !== view) this.state.activeView = view;
    }

    connectWallet() {
        if (this.state.wallet.connected) return;
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe?.user) {
            this.state.wallet.address = `tg-id-${window.Telegram.WebApp.initDataUnsafe.user.id}`;
        } else {
            this.state.wallet.address = 'TON-WALLET-0x' + [...Array(12)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
        }
        this.state.wallet.connected = true;
    }

    // 4. CÁLCULOS Y UTILIDADES
    calculateCost(baseCost, level) {
        return Math.floor(baseCost * Math.pow(1.15, level));
    }

    recalculatePeacePerHour() {
        this.state.peacePerHour = Object.keys(this.state.upgrades).reduce((total, id) => {
            return total + ((this.state.upgrades[id] || 0) * this.config.upgrades[id].basePeace);
        }, 0);
    }

    formatNumber(num = 0) {
        if (num < 1000) return num.toFixed(0);
        const suffixes = ['', 'K', 'M', 'B', 'T'];
        const i = Math.floor(Math.log10(num) / 3);
        const shortNum = (num / Math.pow(1000, i)).toFixed(2);
        return `${shortNum.replace(/\.0$/, '')}${suffixes[i]}`;
    }

    // 5. RENDERIZADO (La Vista: UI = f(state))
    render() {
        const wallet = this.state.wallet;
        const walletAddressText = wallet.connected ? `${wallet.address.substring(0, 12)}...` : 'Desconectado';
        const walletButtonClass = wallet.connected ? 'connected' : '';
        const walletButtonAction = wallet.connected ? '' : `data-action="connect-wallet"`;
        const walletButtonHTML = `<button id="connect-wallet-btn" class="${walletButtonClass}" ${walletButtonAction}>
            <i class="fa-solid ${wallet.connected ? 'fa-check' : 'fa-wallet'}"></i> ${wallet.connected ? 'Conectado' : 'Conectar'}
        </button>`;

        const navHTML = this.config.navItems.map(item => `
            <button class="nav-button ${this.state.activeView === item.id ? 'active' : ''}" data-action="switch-view" data-payload="${item.id}">
                <i class="${item.icon}"></i> <span>${item.name}</span>
            </button>
        `).join('');

        this.dom.root.innerHTML = `
            <header class="game-header">
                <div class="player-info">
                    <i class="fas fa-user-shield"></i>
                    <div class="player-details">
                        <span>Pacificador Global</span>
                        <span class="wallet-info ${walletButtonClass}">${walletAddressText}</span>
                    </div>
                </div>
                ${walletButtonHTML}
            </header>
            <div class="main-content">${this.renderCurrentView()}</div>
            <nav class="game-nav">${navHTML}</nav>`;
    }

    renderCurrentView() {
        const view = this.state.activeView;
        if (view === 'upgrades') return this.renderUpgradesView();
        if (view === 'stats') return this.renderStatsView();
        return this.renderTapperView();
    }
    
    renderTapperView() {
        return `
            <main class="tapper-section">
                <div class="passive-income-display">
                    <span class="label">Paz por Hora</span>
                    <div class="value"><i class="fas fa-hand-holding-heart"></i><span>${this.formatNumber(this.state.peacePerHour)}</span></div>
                </div>
                <div class="total-peace-display">
                    <i class="fas fa-dove"></i><span id="total-peace-value">${this.formatNumber(this.state.totalPeace)}</span>
                </div>
                <div id="tapper-zone" data-action="handle-tap">
                    <div id="globe-container"><i id="globe-icon" class="fas fa-globe-americas"></i></div>
                </div>
            </main>`;
    }

    renderUpgradesView() {
        const cardsHTML = Object.keys(this.config.upgrades).map(id => {
            const upgrade = this.config.upgrades[id];
            const level = this.state.upgrades[id] || 0;
            const cost = this.calculateCost(upgrade.baseCost, level);
            const canAfford = this.state.totalPeace >= cost ? 'can-afford' : '';
            return `
                <div class="upgrade-card ${canAfford}" data-action="purchase-upgrade" data-payload="${id}">
                    <i class="upgrade-icon ${upgrade.icon}"></i>
                    <div class="upgrade-info"><h4>${upgrade.name}</h4><p>+${upgrade.basePeace} Paz/Hora</p></div>
                    <div class="upgrade-details">
                        <span class="upgrade-level">Nivel ${level}</span>
                        <div class="upgrade-cost"><i class="fas fa-dove"></i><span>${this.formatNumber(cost)}</span></div>
                    </div>
                </div>`;
        }).join('');
        return `<section class="game-view"><h2><i class="fas fa-arrow-trend-up"></i> Iniciativas de Paz</h2><div id="upgrades-list">${cardsHTML}</div></section>`;
    }

    renderStatsView() {
        const daysPlayed = Math.max(1, Math.floor((new Date() - new Date(this.state.startDate)) / (1000 * 60 * 60 * 24)));
        const stats = [
            { icon: 'fa-mouse-pointer', title: 'Taps Totales', value: this.formatNumber(this.state.totalTaps) },
            { icon: 'fa-coins', title: 'Paz Total Generada', value: this.formatNumber(this.state.totalPeaceGenerated) },
            { icon: 'fa-calendar-alt', title: 'Días en el Juego', value: daysPlayed }
        ];
        const statsHTML = stats.map(s => `<div class="stat-card"><h3><i class="fas ${s.icon}"></i> ${s.title}</h3><p>${s.value}</p></div>`).join('');
        return `<section class="game-view"><h2><i class="fas fa-chart-line"></i> Estadísticas Globales</h2><div class="stats-container">${statsHTML}</div></section>`;
    }
    
    showFloatingNumber(value) {
        const tapperZone = document.getElementById('tapper-zone');
        if (!tapperZone) return;
        const numberEl = document.createElement('div');
        numberEl.className = 'floating-number';
        numberEl.textContent = `+${this.formatNumber(value)}`;
        tapperZone.appendChild(numberEl);
        setTimeout(() => numberEl.remove(), 1500);
    }

    // 6. PERSISTENCIA DE DATOS
    saveGame() {
        this.state.lastSaved = new Date().toISOString();
        try { localStorage.setItem('peaceKombatSave_v4', JSON.stringify(this.state)); } catch (e) { console.error("Error al guardar:", e); }
    }

    loadGame() {
        try {
            const savedData = localStorage.getItem('peaceKombatSave_v4');
            if (!savedData) return;
            const loadedState = JSON.parse(savedData);
            const offlineEarnings = ((loadedState.peacePerHour || 0) / 3600) * (Math.max(0, (new Date().getTime() - new Date(loadedState.lastSaved).getTime()) / 1000));
            loadedState.totalPeace += offlineEarnings;
            loadedState.totalPeaceGenerated += offlineEarnings;
            this.state = { ...this.getInitialState(), ...loadedState };
        } catch (e) {
            console.error("Error al cargar partida, empezando de nuevo.", e);
            localStorage.removeItem('peaceKombatSave_v4');
        }
        this.recalculatePeacePerHour();
    }
}

// --- CONFIGURACIÓN CENTRALIZADA ---
const gameConfig = {
    upgrades: {
        'diplomacy': { name: 'Cumbres Diplomáticas', baseCost: 50, basePeace: 1, icon: 'fa-solid fa-scale-balanced' },
        'education': { name: 'Programas Educativos', baseCost: 250, basePeace: 5, icon: 'fa-solid fa-graduation-cap' },
        'sustainability': { name: 'Energías Renovables', baseCost: 1000, basePeace: 20, icon: 'fa-solid fa-wind-turbine' },
        'healthcare': { name: 'Acceso a Salud Global', baseCost: 5000, basePeace: 80, icon: 'fa-solid fa-hospital' },
        'technology': { name: 'Investigación Tecnológica', baseCost: 20000, basePeace: 300, icon: 'fa-solid fa-microchip' },
    },
    navItems: [
        { id: 'tapper', name: 'Principal', icon: 'fas fa-hand-pointer' },
        { id: 'upgrades', name: 'Iniciativas', icon: 'fas fa-arrow-trend-up' },
        { id: 'stats', name: 'Stats', icon: 'fas fa-chart-line' }
    ]
};

// --- PUNTO DE ENTRADA DE LA APLICACIÓN ---
document.addEventListener('DOMContentLoaded', () => new GameEngine(gameConfig));