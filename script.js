/**
 * Galactic Diplomacy - v3.1 Canónica
 * Código unificado, corregido y refactorizado.
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

    // --- 1. INICIALIZACIÓN Y CICLO DE VIDA ---
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
            totalInfluence: 0,
            influencePerHour: 0,
            influencePerTap: 1,
            totalTaps: 0,
            totalInfluenceGenerated: 0,
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

    // --- 2. MANEJO DE EVENTOS ---
    handleGlobalClick(event) {
        const actionTarget = event.target.closest('[data-action]');
        if (!actionTarget) return;
        const { action, payload } = actionTarget.dataset;

        switch (action) {
            case 'handle-tap':
                this.handleTap();
                break;
            case 'purchase-upgrade':
                this.purchaseUpgrade(payload);
                this.renderMainContent();
                break;
            case 'switch-view':
                this.switchView(payload);
                break;
        }
    }

    // --- 3. LÓGICA DEL JUEGO ---
    handleTap() {
        this.state.totalInfluence += this.state.influencePerTap;
        this.state.totalTaps++;
        this.state.totalInfluenceGenerated += this.state.influencePerTap;
        this.showFloatingNumber(this.state.influencePerTap);
        const influenceDisplay = document.getElementById('total-influence-value');
        if (influenceDisplay) influenceDisplay.textContent = this.formatNumber(this.state.totalInfluence);
    }

    passiveIncomeTick() {
        if (this.state.influencePerHour > 0) {
            const influenceFromPassive = this.state.influencePerHour / 3600;
            this.state.totalInfluence += influenceFromPassive;
            this.state.totalInfluenceGenerated += influenceFromPassive;
            const influenceDisplay = document.getElementById('total-influence-value');
            if (influenceDisplay) influenceDisplay.textContent = this.formatNumber(this.state.totalInfluence);
        }
    }

    purchaseUpgrade(id) {
        if (!id) return;
        const upgradeInfo = this.config.upgrades[id];
        const level = this.state.upgrades[id] || 0;
        
        // === ¡ERROR CORREGIDO AQUÍ! ===
        // Usamos `upgradeInfo.baseCost` en lugar de `baseInfluence` para el cálculo.
        const cost = this.calculateCost(upgradeInfo.baseCost, level);

        if (this.state.totalInfluence >= cost) {
            this.state.totalInfluence -= cost;
            this.state.upgrades[id] = level + 1;
            this.recalculateInfluencePerHour();
        }
    }

    switchView(view) {
        if (view && this.state.activeView !== view) {
            this.state.activeView = view;
            this.renderMainContent();
            this.renderNav();
        }
    }

    // --- 4. RENDERIZADO ---
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
                <div class="player-info"> <span class="header-icon">🧑‍🚀</span> <div class="player-details"> <span>Diplomático Galáctico</span> <span class="wallet-info ${wallet.connected ? 'connected' : ''}">${walletAddressText}</span> </div> </div>
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

    getTapperViewHTML = () => `<main class="tapper-section"><div class="passive-income-display"><span class="label">Influencia / Hora</span><div class="value"><span class="icon">✨</span><span>${this.formatNumber(this.state.influencePerHour)}</span></div></div><div class="total-influence-display"><span id="total-influence-value">${this.formatNumber(this.state.totalInfluence)}</span></div><div id="tapper-zone" data-action="handle-tap"><div id="galaxy-container"><span id="galaxy-icon">💫</span></div></div></main>`;
    getUpgradesViewHTML() { const cardsHTML = Object.keys(this.config.upgrades).map(id => { const up = this.config.upgrades[id], lvl = this.state.upgrades[id] || 0, cost = this.calculateCost(up.baseCost, lvl); return `<div class="upgrade-card ${this.state.totalInfluence >= cost ? 'can-afford' : ''}" data-action="purchase-upgrade" data-payload="${id}"><span class="upgrade-icon">${up.icon}</span><div class="upgrade-info"><h4>${up.name}</h4><p>+${up.baseInfluence} Influencia/Hora</p></div><div class="upgrade-details"><span class="upgrade-level">Nivel ${lvl}</span><div class="upgrade-cost"><span class="icon">💠</span><span>${this.formatNumber(cost)}</span></div></div></div>`; }).join(''); return `<section class="game-view"><h2>🛰️ Proyectos Galácticos 🛰️</h2><div id="upgrades-list">${cardsHTML}</div></section>`; }
    getStatsViewHTML() { const days = Math.max(1, Math.floor((new Date() - new Date(this.state.startDate)) / 864e5)); const stats = [{ i: '👆', t: 'Interacciones Totales', v: this.formatNumber(this.state.totalTaps) }, { i: '✨', t: 'Influencia Generada', v: this.formatNumber(this.state.totalInfluenceGenerated) }, { i: '🗓️', t: 'Ciclos Galácticos', v: days }]; return `<section class="game-view"><h2>📈 Registros de la Flota 📈</h2><div class="stats-container">${stats.map(s => `<div class="stat-card"><h3><span class="icon">${s.i}</span> ${s.t}</h3><p>${s.v}</p></div>`).join('')}</div></section>`; }

    // --- 5. UTILIDADES Y CÁLCULOS ---
    calculateCost = (baseCost, level) => Math.floor(baseCost * Math.pow(1.18, level));
    recalculateInfluencePerHour() { this.state.influencePerHour = Object.keys(this.state.upgrades).reduce((t, id) => t + ((this.state.upgrades[id] || 0) * this.config.upgrades[id].baseInfluence), 0); }
    formatNumber(n = 0) { if (n < 1e3) return n.toFixed(0); const s = ["", "K", "M", "B", "T"], i = Math.floor(Math.log10(n) / 3); return `${(n / 1e3 ** i).toFixed(2).replace(/\.00$|\.0$/, "")}${s[i]}`; }
    showFloatingNumber(v) { const t = document.getElementById("tapper-zone"); if (!t) return; const e = document.createElement("div"); e.className = "floating-number"; e.textContent = `+${this.formatNumber(v)}`; t.appendChild(e); setTimeout(() => e.remove(), 1500); }

    // --- 6. PERSISTENCIA DE DATOS ---
    saveGame() {
        this.state.lastSaved = new Date().toISOString();
        try { localStorage.setItem('galacticDiplomacySave_v1', JSON.stringify(this.state)); } catch (e) { console.error("Error al guardar la partida:", e); }
    }
    loadGame() {
        try {
            const savedData = localStorage.getItem('galacticDiplomacySave_v1');
            if (!savedData) return;
            const loadedState = JSON.parse(savedData);
            const lastSaved = loadedState.lastSaved || loadedState.startDate;
            const offlineSeconds = Math.max(0, (new Date().getTime() - new Date(lastSaved).getTime()) / 1000);
            const offlineInfluence = ((loadedState.influencePerHour || 0) / 3600) * offlineSeconds;
            
            loadedState.totalInfluence = (loadedState.totalInfluence || 0) + offlineInfluence;
            loadedState.totalInfluenceGenerated = (loadedState.totalInfluenceGenerated || 0) + offlineInfluence;
            
            this.state = { ...this.getInitialState(), ...loadedState };
        } catch (e) {
            console.error("Error al cargar partida guardada. Empezando de nuevo.", e);
            localStorage.removeItem('galacticDiplomacySave_v1');
        }
        this.recalculateInfluencePerHour();
    }
}

// --- CONFIGURACIÓN CENTRALIZADA DEL JUEGO ---
const gameConfig = {
    upgrades: {
        'treaties': { name: 'Tratados Interstelares', baseInfluence: 1, baseCost: 50, icon: '📜' },
        'xenolinguistics': { name: 'Academias de Idiomas', baseInfluence: 5, baseCost: 250, icon: '👽' },
        'networks': { name: 'Red de Hiper-relés', baseInfluence: 20, baseCost: 1000, icon: '🛰️' },
        'biotech': { name: 'Clínicas de Bio-Regeneración', baseInfluence: 80, baseCost: 5000, icon: '🧬' },
        'robotics': { name: 'Enviados Robóticos', baseInfluence: 300, baseCost: 20000, icon: '🤖' },
        'artifacts': { name: 'Estudio de Artefactos', baseInfluence: 1200, baseCost: 100000, icon: '🛸' }
    },
    navItems: [
        { id: 'tapper', name: 'Galaxia', icon: '🌌' },
        { id: 'upgrades', name: 'Proyectos', icon: '🚀' },
        { id: 'stats', name: 'Registros', icon: '📊' }
    ]
};

// --- PUNTO DE ENTRADA DE LA APLICACIÓN ---
document.addEventListener('DOMContentLoaded', () => new GameEngine(gameConfig));