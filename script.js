/**
 * Project Terra Nova - v2.0 dApp Edition
 * Arquitectura de Juego con economía PAZcoin y módulo TON Connect.
 */

// --- CONFIGURACIÓN CENTRAL DEL JUEGO ---
const gameConfig = {
    localStorageKey: 'projectTerraNova_v2_pazcoin',
    currencyName: 'PAZcoin',
    currencySymbol: '$XPAZ',
    upgrades: {
        'education': { name: 'Educación Universal', baseCost: 50, basePph: 0.5, icon: '🎓' },
        'cleanEnergy': { name: 'Energía Limpia', baseCost: 300, basePph: 2, icon: '💡' },
        'healthcare': { name: 'Investigación Médica', baseCost: 1500, basePph: 10, icon: '❤️‍🩹' },
        'culture': { name: 'Arte y Cultura', baseCost: 8000, basePph: 50, icon: '🎭' },
        'justice': { name: 'Justicia Global', baseCost: 45000, basePph: 250, icon: '⚖️' },
        'space': { name: 'Exploración Espacial', baseCost: 250000, basePph: 1500, icon: '🚀' }
    },
    navItems: [
        { id: 'tapper', name: 'Principal', icon: '🌍' },
        { id: 'upgrades', name: 'Proyectos', icon: '🏗️' }
    ]
};

// --- CLASE PRINCIPAL DEL JUEGO ---
class Game {
    constructor(config) {
        this.config = config;
        this.state = this.getInitialState();
        this.tonConnectUI = null; // Se inicializará después
        this.dom = {
            root: document.getElementById('game-container'),
            loadingScreen: document.getElementById('loading-screen'),
        };
        this.ui = {};
        this.init();
    }

    // --- 1. INICIALIZACIÓN ---
    init() {
        this.initializeTonConnect();
        this.loadState();
        this.bindEvents();
        setTimeout(() => {
            this.dom.loadingScreen.style.display = 'none';
            this.render();
            this.startTimers();
        }, 500);
    }

    initializeTonConnect() {
        this.tonConnectUI = new TonConnectUI({
            manifestUrl: 'https://mang369.github.io/peace-kombat/tonconnect-manifest.json',
        });
    }

    getInitialState() {
        return {
            pazcoin: 0,
            coinsPerTap: 1,
            coinsPerHour: 0,
            upgrades: {},
            activeView: 'tapper',
        };
    }

    startTimers() {
        setInterval(() => this.passiveTick(), 1000);
        setInterval(() => this.saveState(), 10000);
    }

    // --- 2. MANEJO DE ESTADO Y PERSISTENCIA ---
    saveState() {
        try {
            const stateToSave = { ...this.state, lastSaved: Date.now() };
            localStorage.setItem(this.config.localStorageKey, JSON.stringify(stateToSave));
        } catch (error) {
            console.error("Error al guardar el estado:", error);
        }
    }

    loadState() {
        try {
            const savedData = localStorage.getItem(this.config.localStorageKey);
            if (!savedData) return;
            const loadedState = JSON.parse(savedData);
            
            this.state = { ...this.getInitialState(), ...loadedState };

            const lastSaved = loadedState.lastSaved || Date.now();
            const offlineSeconds = (Date.now() - lastSaved) / 1000;
            const offlineEarnings = (this.state.coinsPerHour / 3600) * offlineSeconds;
            this.state.pazcoin += offlineEarnings;

        } catch (error) {
            console.error("Error al cargar el estado, empezando de nuevo.", error);
            localStorage.removeItem(this.config.localStorageKey);
        }
    }

    // --- 3. LÓGICA DEL JUEGO ---
    tap() {
        this.state.pazcoin += this.state.coinsPerTap;
        this.showFloatingNumber(`+${this.state.coinsPerTap}`);
        this.update();
    }

    passiveTick() {
        if (this.state.coinsPerHour > 0) {
            this.state.pazcoin += this.state.coinsPerHour / 3600;
            this.update();
        }
    }

    purchaseUpgrade(id) {
        const upgradeInfo = this.config.upgrades[id];
        const currentLevel = this.state.upgrades[id] || 0;
        const cost = this.calculateCost(upgradeInfo.baseCost, currentLevel);

        if (this.state.pazcoin >= cost) {
            this.state.pazcoin -= cost;
            this.state.upgrades[id] = currentLevel + 1;
            this.recalculateCoinsPerHour();
            this.render();
        }
    }

    // --- 4. CÁLCULOS ---
    calculateCost(baseCost, level) {
        return Math.floor(baseCost * Math.pow(1.20, level));
    }

    recalculateCoinsPerHour() {
        let pph = 0;
        for (const id in this.state.upgrades) {
            const level = this.state.upgrades[id];
            const upgradeInfo = this.config.upgrades[id];
            pph += level * upgradeInfo.basePph;
        }
        this.state.coinsPerHour = pph;
    }

    formatNumber(num) {
        if (num < 1000) return num.toFixed(0);
        const suffixes = ['', 'K', 'M', 'B', 'T'];
        const i = Math.floor(Math.log10(num) / 3);
        const shortNum = (num / Math.pow(1000, i)).toFixed(2);
        return shortNum.replace(/\.00$/, '').replace(/\.0$/, '') + suffixes[i];
    }
    
    // --- 5. RENDERIZADO Y MANEJO DEL DOM ---
    render() {
        this.dom.root.innerHTML = `
            <header class="game-header">
                <div class="player-info">
                    <h1>Project Terra Nova</h1>
                    <p>Construyendo un futuro unificado.</p>
                </div>
                <div id="ton-connect-button"></div>
            </header>
            <main class="main-content" id="main-content"></main>
            <nav class="game-nav" id="game-nav"></nav>
        `;
        this.tonConnectUI.setTargetElement(document.getElementById('ton-connect-button'));
        this.renderNav();
        this.renderCurrentView();
    }
    
    update() {
        if (this.ui.pazcoinDisplay) this.ui.pazcoinDisplay.textContent = this.formatNumber(this.state.pazcoin);
        if (this.ui.coinsPerHourDisplay) this.ui.coinsPerHourDisplay.textContent = `${this.formatNumber(this.state.coinsPerHour)} / hora`;
    }

    renderNav() {
        const navContainer = document.getElementById('game-nav');
        navContainer.innerHTML = this.config.navItems.map(item => `
            <button class="nav-button ${this.state.activeView === item.id ? 'active' : ''}" data-view="${item.id}">
                <div class="icon">${item.icon}</div>
                <span>${item.name}</span>
            </button>
        `).join('');
    }

    renderCurrentView() {
        const contentContainer = document.getElementById('main-content');
        if (this.state.activeView === 'upgrades') {
            contentContainer.innerHTML = this.getUpgradesViewHTML();
        } else {
            contentContainer.innerHTML = this.getTapperViewHTML();
        }
        this.cacheUIElements();
        this.update();
    }

    getTapperViewHTML() {
        return `
            <div class="tapper-view">
                <div class="resource-display">
                    <h2 id="pazcoin-display">${this.formatNumber(this.state.pazcoin)}</h2>
                    <p>${this.config.currencyName} (${this.config.currencySymbol})</p>
                    <p id="coins-per-hour-display">${this.formatNumber(this.state.coinsPerHour)} / hora</p>
                </div>
                <div class="tapper-zone" data-action="tap">
                    <div class="tapper-visual"><span class="tapper-icon">🌍</span></div>
                </div>
            </div>`;
    }

    getUpgradesViewHTML() {
        const upgradesHTML = Object.entries(this.config.upgrades).map(([id, upgrade]) => {
            const level = this.state.upgrades[id] || 0;
            const cost = this.calculateCost(upgrade.baseCost, level);
            const canAfford = this.state.pazcoin >= cost;
            return `
                <div class="upgrade-card ${canAfford ? 'can-afford' : ''}" data-action="purchase-upgrade" data-id="${id}">
                    <div class="upgrade-icon">${upgrade.icon}</div>
                    <div class="upgrade-info">
                        <h4>${upgrade.name}</h4>
                        <p>+${upgrade.basePph} ${this.config.currencySymbol}/Hora</p>
                    </div>
                    <div class="upgrade-cost">
                        <div class="price">${this.formatNumber(cost)} ${this.config.currencySymbol}</div>
                        <div class="level">Nivel ${level}</div>
                    </div>
                </div>`;
        }).join('');
        return `<div class="game-view"><h3>Proyectos Globales</h3><div class="upgrades-list">${upgradesHTML}</div></div>`;
    }

    showFloatingNumber(text) {
        const tapperZone = this.dom.root.querySelector('.tapper-zone');
        if (!tapperZone) return;
        const numberEl = document.createElement('div');
        numberEl.className = 'floating-number';
        numberEl.textContent = text;
        tapperZone.appendChild(numberEl);
        numberEl.addEventListener('animationend', () => numberEl.remove());
    }

    // --- 6. EVENTOS ---
    bindEvents() {
        this.dom.root.addEventListener('click', (event) => {
            const target = event.target.closest('[data-action], [data-view]');
            if (!target) return;
            
            if (target.dataset.action === 'tap') this.tap();
            if (target.dataset.action === 'purchase-upgrade') this.purchaseUpgrade(target.dataset.id);
            if (target.dataset.view) {
                this.state.activeView = target.dataset.view;
                this.render();
            }
        });
    }

    cacheUIElements() {
        this.ui.pazcoinDisplay = document.getElementById('pazcoin-display');
        this.ui.coinsPerHourDisplay = document.getElementById('coins-per-hour-display');
    }
}

// --- PUNTO DE ENTRADA DE LA APLICACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    new Game(gameConfig);
});
