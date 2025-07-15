// Electronのrequireを使用してモジュールを読み込む
// Note: Electronのrendererプロセスでは、nodeIntegrationが有効な場合はwindow.requireを使用
const { Terminal } = window.require('@xterm/xterm');
const { FitAddon } = window.require('@xterm/addon-fit');
const { SearchAddon } = window.require('@xterm/addon-search');
const { WebLinksAddon } = window.require('@xterm/addon-web-links');

// カラーテーマ定義
const themes = {
    productOwner: {
        background: '#1a0820',
        foreground: '#e1bee7',
        cursor: '#9c27b0',
        selection: '#4a148c',
        black: '#000000',
        red: '#d32f2f',
        green: '#388e3c',
        yellow: '#f57c00',
        blue: '#1976d2',
        magenta: '#7b1fa2',
        cyan: '#0097a7',
        white: '#ffffff'
    },
    techLead: {
        background: '#0a1929',
        foreground: '#bbdefb',
        cursor: '#2196f3',
        selection: '#1565c0',
        black: '#000000',
        red: '#d32f2f',
        green: '#388e3c',
        yellow: '#f57c00',
        blue: '#1976d2',
        magenta: '#7b1fa2',
        cyan: '#0097a7',
        white: '#ffffff'
    },
    engineer: {
        background: '#0d1f0d',
        foreground: '#c8e6c9',
        cursor: '#4caf50',
        selection: '#1b5e20',
        black: '#000000',
        red: '#d32f2f',
        green: '#388e3c',
        yellow: '#f57c00',
        blue: '#1976d2',
        magenta: '#7b1fa2',
        cyan: '#0097a7',
        white: '#ffffff'
    },
    mergeCoordinator: {
        background: '#1a1a0d',
        foreground: '#ffe0b2',
        cursor: '#ff9800',
        selection: '#e65100',
        black: '#000000',
        red: '#d32f2f',
        green: '#388e3c',
        yellow: '#f57c00',
        blue: '#1976d2',
        magenta: '#7b1fa2',
        cyan: '#0097a7',
        white: '#ffffff'
    }
};

// グローバル状態管理
const state = {
    terminals: {},         // terminalId -> Terminal instance
    fitAddons: {},        // terminalId -> FitAddon instance
    engineerTabs: {},     // engineerId -> { tabIndex, status }
    techLeadTabs: {},     // techLeadId -> { tabIndex, status }
    activeTab: 'product-owner',
    activeEngineerTab: null,
    activeTechLeadTab: null,
    engineerCount: 0,
    techLeadCount: 0,
    lastToolExecutor: 'merge-coordinator'
};

// マッピング管理
const mappings = {
    engineerToTerminal: {},  // engineerId -> terminalId
    techLeadToTerminal: {},  // techLeadId -> terminalId
    techLeadToEngineer: {},  // techLeadId -> engineerId
};

// ターミナルの初期化
function initializeTerminal(id, container, theme) {
    const term = new Terminal({
        theme: theme,
        fontSize: 14,
        fontFamily: 'Consolas, "Courier New", monospace',
        cursorBlink: true,
        scrollback: 10000,
        convertEol: true
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(webLinksAddon);

    term.open(container);
    fitAddon.fit();

    state.terminals[id] = term;
    state.fitAddons[id] = fitAddon;

    return term;
}

// タブ切り替え
function switchTab(tabId) {
    // メインタブの切り替え
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === tabId);
    });
    
    state.activeTab = tabId;
    
    // リサイズ
    setTimeout(() => {
        Object.entries(state.fitAddons).forEach(([id, addon]) => {
            if (state.terminals[id]) {
                addon.fit();
            }
        });
    }, 50);
}

// サブタブ切り替え（エンジニア/TechLead）
function switchSubTab(type, tabId) {
    const isEngineer = type === 'engineer';
    const panelsContainer = document.getElementById(isEngineer ? 'engineer-panels' : 'tech-lead-panels');
    const tabsContainer = document.getElementById(isEngineer ? 'engineer-sub-tabs' : 'tech-lead-sub-tabs');
    
    // タブのアクティブ状態を更新
    tabsContainer.querySelectorAll('.sub-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-id') === tabId);
    });
    
    // パネルの表示切り替え
    panelsContainer.querySelectorAll('.sub-tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `${type}-panel-${tabId}`);
    });
    
    if (isEngineer) {
        state.activeEngineerTab = tabId;
    } else {
        state.activeTechLeadTab = tabId;
    }
    
    // ターミナルのリサイズ
    const terminalId = isEngineer ? mappings.engineerToTerminal[tabId] : mappings.techLeadToTerminal[tabId];
    if (terminalId && state.fitAddons[terminalId]) {
        setTimeout(() => state.fitAddons[terminalId].fit(), 50);
    }
}

// エンジニアタブの作成
function createEngineerTab(engineerId) {
    if (state.engineerTabs[engineerId]) return;
    
    state.engineerCount++;
    const tabIndex = state.engineerCount;
    const terminalId = `engineer-${tabIndex}`;
    
    // タブの作成
    const tabsContainer = document.getElementById('engineer-sub-tabs');
    const tab = document.createElement('button');
    tab.className = 'sub-tab-btn';
    tab.setAttribute('data-id', engineerId);
    tab.innerHTML = `
        Engineer #${tabIndex}
        <span class="status-dot active"></span>
    `;
    tab.onclick = () => switchSubTab('engineer', engineerId);
    tabsContainer.appendChild(tab);
    
    // パネルの作成
    const panelsContainer = document.getElementById('engineer-panels');
    const panel = document.createElement('div');
    panel.id = `engineer-panel-${engineerId}`;
    panel.className = 'sub-tab-panel';
    panel.innerHTML = `
        <div class="terminal-pane engineer full-height">
            <div class="terminal-header">
                <span class="terminal-title">👨‍💻 Engineer AI #${tabIndex}</span>
                <div class="terminal-actions">
                    <span class="terminal-action" data-terminal="${terminalId}">Clear</span>
                </div>
            </div>
            <div class="terminal-container" id="${terminalId}-container"></div>
        </div>
    `;
    panelsContainer.appendChild(panel);
    
    // 最初のタブをアクティブに
    if (!state.activeEngineerTab) {
        state.activeEngineerTab = engineerId;
        tab.classList.add('active');
        panel.classList.add('active');
    }
    
    // ターミナルの初期化
    setTimeout(() => {
        const container = document.getElementById(`${terminalId}-container`);
        if (container) {
            initializeTerminal(terminalId, container, themes.engineer);
            updateScrollButtons('engineer');
        }
    }, 50);
    
    // 状態の更新
    state.engineerTabs[engineerId] = { tabIndex, status: 'active' };
    mappings.engineerToTerminal[engineerId] = terminalId;
}

// TechLeadタブの作成
function createTechLeadTab(techLeadId) {
    if (state.techLeadTabs[techLeadId]) return;
    
    state.techLeadCount++;
    const tabIndex = state.techLeadCount;
    const terminalId = `tech-lead-${tabIndex}`;
    
    // タブの作成
    const tabsContainer = document.getElementById('tech-lead-sub-tabs');
    const tab = document.createElement('button');
    tab.className = 'sub-tab-btn';
    tab.setAttribute('data-id', techLeadId);
    tab.innerHTML = `
        Tech Lead #${tabIndex}
        <span class="status-dot active"></span>
    `;
    tab.onclick = () => switchSubTab('tech-lead', techLeadId);
    tabsContainer.appendChild(tab);
    
    // パネルの作成
    const panelsContainer = document.getElementById('tech-lead-panels');
    const panel = document.createElement('div');
    panel.id = `tech-lead-panel-${techLeadId}`;
    panel.className = 'sub-tab-panel';
    panel.innerHTML = `
        <div class="terminal-pane tech-lead full-height">
            <div class="terminal-header">
                <span class="terminal-title">🔍 Tech Lead AI #${tabIndex}</span>
                <div class="terminal-actions">
                    <span class="terminal-action" data-terminal="${terminalId}">Clear</span>
                </div>
            </div>
            <div class="terminal-container" id="${terminalId}-container"></div>
        </div>
    `;
    panelsContainer.appendChild(panel);
    
    // 最初のタブをアクティブに
    if (!state.activeTechLeadTab) {
        state.activeTechLeadTab = techLeadId;
        tab.classList.add('active');
        panel.classList.add('active');
    }
    
    // ターミナルの初期化
    setTimeout(() => {
        const container = document.getElementById(`${terminalId}-container`);
        if (container) {
            initializeTerminal(terminalId, container, themes.techLead);
            updateScrollButtons('tech-lead');
        }
    }, 50);
    
    // 状態の更新
    state.techLeadTabs[techLeadId] = { tabIndex, status: 'active' };
    mappings.techLeadToTerminal[techLeadId] = terminalId;
}

// スクロールボタンの更新
function updateScrollButtons(type) {
    const scrollContainer = document.querySelector(`#${type}-sub-tabs`).parentElement;
    const tabsContainer = document.getElementById(`${type}-sub-tabs`);
    const leftBtn = document.getElementById(`${type}-scroll-left`);
    const rightBtn = document.getElementById(`${type}-scroll-right`);
    
    if (!scrollContainer || !tabsContainer) return;
    
    const canScroll = tabsContainer.scrollWidth > scrollContainer.clientWidth;
    leftBtn.classList.toggle('visible', canScroll);
    rightBtn.classList.toggle('visible', canScroll);
}

// スクロール処理
function scrollTabs(type, direction) {
    const tabsContainer = document.getElementById(`${type}-sub-tabs`);
    const scrollAmount = 200;
    const currentTransform = getComputedStyle(tabsContainer).transform;
    const currentX = currentTransform === 'none' ? 0 : parseInt(currentTransform.split(',')[4]);
    
    const newX = direction === 'left' ? 
        Math.min(currentX + scrollAmount, 0) : 
        currentX - scrollAmount;
    
    tabsContainer.style.transform = `translateX(${newX}px)`;
}

// ステータスインジケーターの更新
function updateStatusIndicator(type, id, status) {
    const tabsContainer = document.getElementById(`${type}-sub-tabs`);
    const tab = tabsContainer.querySelector(`[data-id="${id}"]`);
    if (!tab) return;
    
    const statusDot = tab.querySelector('.status-dot');
    if (!statusDot) return;
    
    statusDot.className = 'status-dot';
    statusDot.classList.add(status);
}

// ターミナルクリア
function clearTerminal(terminalId) {
    const terminal = state.terminals[terminalId];
    if (terminal) {
        terminal.clear();
    }
}

// ログ表示
function displayLog(terminalId, level, message, timestamp) {
    const terminal = state.terminals[terminalId];
    if (!terminal) return;
    
    const time = new Date(timestamp).toLocaleTimeString();
    let colorCode = '\x1b[37m'; // デフォルト白
    
    switch (level) {
        case 'error':
            colorCode = '\x1b[31m'; // 赤
            break;
        case 'warn':
            colorCode = '\x1b[33m'; // 黄
            break;
        case 'success':
            colorCode = '\x1b[32m'; // 緑
            break;
        case 'info':
            colorCode = '\x1b[36m'; // シアン
            break;
        case 'debug':
            colorCode = '\x1b[90m'; // グレー
            break;
    }
    
    terminal.writeln(`\x1b[90m[${time}]\x1b[0m ${colorCode}${message}\x1b[0m`);
}

// ターミナルIDの取得
function getTerminalIdForLog(executor, context) {
    switch (executor.type) {
        case 'ProductOwner':
            return 'product-owner';
        case 'MergeCoordinator':
        case 'System':
            return 'merge-coordinator';
        case 'Engineer':
            if (!mappings.engineerToTerminal[executor.id]) {
                createEngineerTab(executor.id);
            }
            return mappings.engineerToTerminal[executor.id];
        case 'TechLead':
            if (!mappings.techLeadToTerminal[executor.id]) {
                createTechLeadTab(executor.id);
            }
            return mappings.techLeadToTerminal[executor.id];
        default:
            return 'merge-coordinator';
    }
}

// dragEventエラーを回避
if (typeof dragEvent === 'undefined') {
    window.dragEvent = null;
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    // 初期ターミナルの作成
    initializeTerminal('product-owner', document.getElementById('product-owner-terminal'), themes.productOwner);
    initializeTerminal('merge-coordinator', document.getElementById('merge-coordinator-terminal'), themes.mergeCoordinator);
    
    // タブ切り替えイベント
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => switchTab(btn.getAttribute('data-tab'));
    });
    
    // ターミナルクリアイベント
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('terminal-action')) {
            const terminalId = e.target.getAttribute('data-terminal');
            if (terminalId) {
                clearTerminal(terminalId);
            }
        }
    });
    
    // スクロールボタンイベント
    document.getElementById('engineer-scroll-left').onclick = () => scrollTabs('engineer', 'left');
    document.getElementById('engineer-scroll-right').onclick = () => scrollTabs('engineer', 'right');
    document.getElementById('tech-lead-scroll-left').onclick = () => scrollTabs('tech-lead', 'left');
    document.getElementById('tech-lead-scroll-right').onclick = () => scrollTabs('tech-lead', 'right');
    
    // ウィンドウリサイズ処理
    window.addEventListener('resize', () => {
        Object.values(state.fitAddons).forEach(addon => addon.fit());
        updateScrollButtons('engineer');
        updateScrollButtons('tech-lead');
    });
    
    // Electron APIイベントリスナー
    if (window.electronAPI) {
        // 構造化ログデータの受信
        window.electronAPI.onStructuredLogData((data) => {
            const { executor, level, message, timestamp, context } = data;
            const terminalId = getTerminalIdForLog(executor, context);
            
            // ツール実行の場合は実行者を記録
            if (context?.toolName) {
                state.lastToolExecutor = terminalId;
            }
            
            // ツール結果の場合は最後の実行者のターミナルに表示
            if (executor.type === 'System' && context?.parentLogId && state.lastToolExecutor) {
                displayLog(state.lastToolExecutor, level, message, timestamp);
            } else {
                displayLog(terminalId, level, message, timestamp);
            }
        });
        
        // レガシーログデータの受信（互換性のため）
        window.electronAPI.onLogData((data) => {
            const { engineerId, level, message, component, timestamp } = data;
            let terminalId;
            
            // コンポーネント名で判定
            if (component === 'ProductOwner' || component === 'Analysis') {
                terminalId = 'product-owner';
            } else if (component === 'TechLead') {
                // TechLeadの場合、engineerIdがtechlead-xxx形式のTechLeadIDである
                if (!mappings.techLeadToTerminal[engineerId]) {
                    createTechLeadTab(engineerId);
                }
                terminalId = mappings.techLeadToTerminal[engineerId];
            } else if (component === 'MergeCoordinator' || component === 'System' || component === 'Orchestrator') {
                terminalId = 'merge-coordinator';
            } else if (engineerId?.startsWith('engineer-')) {
                // エンジニアAIのログ
                if (!mappings.engineerToTerminal[engineerId]) {
                    createEngineerTab(engineerId);
                }
                terminalId = mappings.engineerToTerminal[engineerId];
            } else if (engineerId === 'ProductOwner') {
                // engineerIdがProductOwnerの場合
                terminalId = 'product-owner';
            } else if (engineerId === 'TechLead' || engineerId?.startsWith('techlead-')) {
                // engineerIdがTechLead系の場合
                if (!mappings.techLeadToTerminal[engineerId]) {
                    createTechLeadTab(engineerId);
                }
                terminalId = mappings.techLeadToTerminal[engineerId];
            } else {
                // デフォルトはmerge-coordinator
                terminalId = 'merge-coordinator';
            }
            
            // ツール実行のログの場合、実行者を記録
            if (message.includes('🛠️') && message.includes('ツール実行')) {
                state.lastToolExecutor = terminalId;
            }
            
            // ツール実行結果など、コンポーネントが不明な場合は最後のツール実行者のターミナルに表示
            if (!component && engineerId === 'system' && 
                (message.includes('⚙️  パラメータ:') || 
                 message.includes('📂 ディレクトリ一覧:') || 
                 message.includes('📄 ファイル内容:') ||
                 message.includes('✅ 実行結果:') ||
                 message.includes('📊 結果:')) &&
                state.lastToolExecutor) {
                terminalId = state.lastToolExecutor;
            }
            
            displayLog(terminalId, level, message, timestamp);
        });
        
        // タスクステータス更新
        window.electronAPI.onTaskStatusUpdate((data) => {
            const { completed, total } = data;
            document.getElementById('task-status').textContent = `Tasks: ${completed}/${total}`;
        });
        
        // 接続ステータス更新
        window.electronAPI.onConnectionStatus((connected) => {
            const indicator = document.getElementById('connection-status');
            indicator.style.backgroundColor = connected ? '#4CAF50' : '#f44336';
        });
        
        // エンジニア数の更新
        window.electronAPI.onLayoutUpdate((engineerCount) => {
            document.getElementById('engineer-count').textContent = `Engineers: ${engineerCount}`;
        });
        
        // TechLeadとEngineerの関連付け
        window.electronAPI.onAssociateTechLeadEngineer((data) => {
            const { techLeadId, engineerId } = data;
            mappings.techLeadToEngineer[techLeadId] = engineerId;
        });
    } else {
        // フォールバック処理
        console.error('[Renderer] window.electronAPI is not available!');
    }
});