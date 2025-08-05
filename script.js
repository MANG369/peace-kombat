/**
 * Peace Kombat - dApp Edition v2.1
 * Integración real con TON Connect 2.0
 */
class GameEngine {
    constructor(config) {
        this.config = config;
        this.state = this.getInitialState();
        this.tonConnectUI = null;
        this.dom = {
            root: document.getElementById('game-container'),
            loadingScreen: document.getElementById('loading-screen'),
        };
        this.init();
    }

    init() {
        this.initializeTonConnect();
        this.loadGame();
        this.bindEventListeners();
        setTimeout(() => {
            this.dom.loadingScreen.classList.add('hidden');
            this.render();
            setInterval(() => this.passiveIncomeTick(), 1000);
            setInterval(() => this.saveGame(), 15000);
        }, 1500);
    }

    initializeTonConnect() {
        const manifestUrl = 'https://mang369.github.io/peace-kombat/tonconnect-manifest.json';
        this.tonConnectUI = new TonConnectUI({ manifestUrl });
        this.tonConnectUI.onStatusChange(wallet => {
            this.state.wallet.connected = !!wallet;
            this.state.wallet.address = wallet ? TonConnectSDK.toUserFriendlyAddress(wallet.account.address) : null;
            this.renderHeader();
        });
    }

    getInitialState() {
        return {
            totalPeace: 0, peacePerHour: 0, peacePerTap: 1, totalTaps: 0,
            totalPeaceGenerated: 0, startDate: new Date().toISOString(),
            lastSaved: new Date().toISOString(), upgrades: {},
            wallet: { connected: false, address: null }, activeView: 'tapper'
        };
    }

    bindEventListeners() {
        this.dom.root.addEventListener('click', this.handleGlobalClick.bind(this));
        window.addEventListener('beforeunload', () => this.saveGame());
    }

    handleGlobalClick(event) {
        const actionTarget = event.target.closest('[data-action]');
        if (!actionTarget) return;
        const { action, payload } = actionTarget.dataset;
        const actions = {
            'handle-tap': () => { this.handleTap(); },
            'purchase-upgrade': () => { this.purchaseUpgrade(payload); this.renderMainContent(); },
            'switch-view': () => { this.switchView(payload); }
        };
        if (actions[action]) actions[action]();
    }

    handleTap() {
        this.state.totalPeace += this.state.peacePerTap;
        this.state.totalTaps++;
        this.state.totalPeaceGenerated += this.state.peacePerTap;
        this.showFloatingNumber(this.state.peacePerTap);
        const peaceDisplay = document.getElementById('total-peace-value');
        if (peaceDisplay) peaceDisplay.textContent = this.formatNumber(this.state.totalPeace);
    }

    passiveIncomeTick() {
        if (this.state.peacePerHour > 0) {
            const peaceFromPassive = this.state.peacePerHour / 3600;
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
        if (view && this.state.activeView !== view) {
            this.state.activeView = view;
            this.renderMainContent();
            this.renderNav();
        }
    }

    render() {
        this.dom.root.innerHTML = `<div id="header-container"></div><div class="main-content" id="main-content-container"></div><nav class="game-nav" id="nav-container"></nav>`;
        this.renderHeader();
        this.renderMainContent();
        this.renderNav();
    }

    renderHeader() {
        const container = document.getElementById('header-container');
        if (!container) return;
        const { wallet } = this.state;
        const addr = wallet.address;
        const walletAddressText = wallet.connected ? `${addr.substring(0, 4)}...${addr.substring(addr.length - 4)}` : 'Desconectado';
        container.innerHTML = `
            <header class="game-header">
                <div class="player-info">
                    <span class="header-icon">🕊️</span>
                    <div class="player-details">
                        <span>Pacificador Global</span>
                        <span class="wallet-info ${wallet.connected ? 'connected' : ''}">${walletAddressText}</span>
                    </div>
                </div>
                <div id="ton-connect-wallet-btn"></div>
            </header>`;
        this.tonConnectUI.setTargetElement(document.getElementById('ton-connect-wallet-btn'));
    }

    renderMainContent() {
        const container = document.getElementById('main-content-container');
        if (!container) return;
        switch (this.state.activeView) {
            case 'upgrades': container.innerHTML = this.getUpgradesViewHTML(); break;
            case 'stats': container.innerHTML = this.getStatsViewHTML(); break;
            default: container.innerHTML = this.getTapperViewHTML(); break;
        }
    }

    renderNav() {
        const container = document.getElementById('nav-container');
        if (!container) return;
        container.innerHTML = this.config.navItems.map(item => `<button class="nav-button ${this.state.activeView === item.id ? 'active' : ''}" data-action="switch-view" data-payload="${item.id}"><span class="icon">${item.icon}</span> <span>${item.name}</span></button>`).join('');
    }

    getTapperViewHTML = () => `<main class="tapper-section"><div class="passive-income-display"><span class="label">Paz por Hora</span><div class="value"><span class="icon">💖</span><span>${this.formatNumber(this.state.peacePerHour)}</span></div></div><div class="total-peace-display"><span id="total-peace-value">${this.formatNumber(this.state.totalPeace)}</span></div><div id="tapper-zone" data-action="handle-tap"><div id="globe-container"><span id="globe-icon">🌍</span></div></div></main>`;
    getUpgradesViewHTML() { const cardsHTML = Object.keys(this.config.upgrades).map(id => { const up = this.config.upgrades[id], lvl = this.state.upgrades[id] || 0, cost = this.calculateCost(up.baseCost, lvl); return `<div class="upgrade-card ${this.state.totalPeace >= cost ? 'can-afford' : ''}" data-action="purchase-upgrade" data-payload="${id}"><span class="upgrade-icon">${up.icon}</span><div class="upgrade-info"><h4>${up.name}</h4><p>+${up.basePeace} Paz/Hora</p></div><div class="upgrade-details"><span class="upgrade-level">Nivel ${lvl}</span><div class="upgrade-cost"><span class="icon">🪙</span><span>${this.formatNumber(cost)}</span></div></div></div>`; }).join(''); return `<section class="game-view"><h2>✨ Iniciativas de Paz ✨</h2><div id="upgrades-list">${cardsHTML}</div></section>`; }
    getStatsViewHTML() { const days = Math.max(1, Math.floor((new Date() - new Date(this.state.startDate)) / 864e5)); const stats = [{ i: '👆', t: 'Taps Totales', v: this.formatNumber(this.state.totalTaps) }, { i: '💰', t: 'Paz Total Generada', v: this.formatNumber(this.state.totalPeaceGenerated) }, { i: '🗓️', t: 'Días en el Juego', v: days }]; return `<section class="game-view"><h2>📊 Estadísticas Globales 📊</h2><div class="stats-container">${stats.map(s => `<div class="stat-card"><h3><span class="icon">${s.i}</span> ${s.t}</h3><p>${s.v}</p></div>`).join('')}</div></section>`; }

    calculateCost = (baseCost, level) => Math.floor(baseCost * Math.pow(1.15, level));
    recalculatePeacePerHour() { this.state.peacePerHour = Object.keys(this.state.upgrades).reduce((t, id) => t + ((this.state.upgrades[id] || 0) * this.config.upgrades[id].basePeace), 0); }
    formatNumber(n = 0) { if (n < 1e3) return n.toFixed(0); const s = ["", "K", "M", "B", "T"], i = Math.floor(Math.log10(n) / 3); return `${(n / 1e3 ** i).toFixed(2).replace(/\.00$|\.0$/, "")}${s[i]}`; }
    showFloatingNumber(v) { const t = document.getElementById("tapper-zone"); if (!t) return; const e = document.createElement("div"); e.className = "floating-number"; e.textContent = `+${this.formatNumber(v)}`; t.appendChild(e); setTimeout(() => e.remove(), 1500); }
    saveGame() { this.state.lastSaved = new Date().toISOString(); try { localStorage.setItem('peaceKombatSave_v6', JSON.stringify(this.state)); } catch (e) { console.error("Error al guardar:", e); } }
    loadGame() { try { const d = localStorage.getItem('peaceKombatSave_v6'); if (!d) return; const l = JSON.parse(d); const o = ((l.peacePerHour || 0) / 3600) * (Math.max(0, (new Date().getTime() - new Date(l.lastSaved || l.startDate).getTime()) / 1000)); l.totalPeace = (l.totalPeace || 0) + o; l.totalPeaceGenerated = (l.totalPeaceGenerated || 0) + o; this.state = { ...this.getInitialState(), ...l }; } catch (e) { console.error("Error al cargar partida", e); localStorage.removeItem('peaceKombatSave_v6'); } this.recalculatePeacePerHour(); }
}

const gameConfig = {
    upgrades: {
        'diplomacy': { name: 'Cumbres Diplomáticas', baseCost: 50, basePeace: 1, icon: '🤝' },
        'education': { name: 'Programas Educativos', baseCost: 250, basePeace: 5, icon: '🎓' },
        'sustainability': { name: 'Energías Renovables', baseCost: 1000, basePeace: 20, icon: '🌿' },
        'healthcare': { name: 'Acceso a Salud Global', baseCost: 5000, basePeace: 80, icon: '❤️‍🩹' },
        'technology': { name: 'Investigación Tecnológica', baseCost: 20000, basePeace: 300, icon: '🔬' },
        'culture': { name: 'Festivales Culturales', baseCost: 100000, basePeace: 1200, icon: '🎭' }
    },
    navItems: [
        { id: 'tapper', name: 'Principal', icon: '🌎' },
        { id: 'upgrades', name: 'Iniciativas', icon: '🚀' },
        { id: 'stats', name: 'Stats', icon: '📈' }
    ]
};

document.addEventListener('DOMContentLoaded', () => new GameEngine(gameConfig));