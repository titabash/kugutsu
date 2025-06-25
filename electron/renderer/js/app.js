// Electronのrequireを使用してモジュールを読み込む
const { Terminal } = require('@xterm/xterm');
const { FitAddon } = require('@xterm/addon-fit');
const { SearchAddon } = require('@xterm/addon-search');
const { WebLinksAddon } = require('@xterm/addon-web-links');

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
    },
    system: {
        background: '#0d0d0d',
        foreground: '#b0bec5',
        cursor: '#607d8b',
        selection: '#37474f',
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
    engineerTabs: {},     // engineerId -> { tabIndex, status, terminalId, techLeadTerminalId }
    activeTab: 'product-owner',
    activeEngineerTab: null,
    engineerCount: 0,
    lastToolExecutor: 'merge-coordinator',
    // TechLeadとEngineerのマッピング
    techLeadToEngineer: {},  // techLeadId -> engineerId
    engineerToTechLead: {},  // engineerId -> techLeadId[]
    // パイプライン状況
    pipelineStatus: {
        dev: { waiting: 0, processing: 0 },
        review: { waiting: 0, processing: 0 },
        merge: { waiting: 0, processing: 0 }
    },
    expectingPipelineStats: false
};

// ターミナルの初期化
function initializeTerminal(id, container, theme) {
    if (!container) {
        console.error(`[initializeTerminal] Container not found for terminal ${id}`);
        return null;
    }

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

    console.log(`[initializeTerminal] Terminal ${id} initialized successfully`);
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

// サブタブ切り替え（エンジニア）
function switchEngineerTab(engineerId) {
    const panelsContainer = document.getElementById('engineer-panels');
    const tabsContainer = document.getElementById('engineer-sub-tabs');
    
    // タブのアクティブ状態を更新
    tabsContainer.querySelectorAll('.sub-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-id') === engineerId);
    });
    
    // パネルの表示切り替え
    panelsContainer.querySelectorAll('.sub-tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `engineer-panel-${engineerId}`);
    });
    
    state.activeEngineerTab = engineerId;
    
    // ターミナルのリサイズ
    const tabInfo = state.engineerTabs[engineerId];
    if (tabInfo) {
        // エンジニアターミナルのリサイズ
        if (tabInfo.terminalId && state.fitAddons[tabInfo.terminalId]) {
            setTimeout(() => state.fitAddons[tabInfo.terminalId].fit(), 50);
        }
        // TechLeadターミナルのリサイズ
        if (tabInfo.techLeadTerminalId && state.fitAddons[tabInfo.techLeadTerminalId]) {
            setTimeout(() => state.fitAddons[tabInfo.techLeadTerminalId].fit(), 50);
        }
    }
}

// エンジニアタブの作成（TechLeadターミナルも含む）
function createEngineerTab(engineerId) {
    if (state.engineerTabs[engineerId]) {
        console.log(`[createEngineerTab] Engineer tab already exists for ${engineerId}`);
        return state.engineerTabs[engineerId].terminalId;
    }
    
    state.engineerCount++;
    const tabIndex = state.engineerCount;
    const engineerTerminalId = `engineer-${tabIndex}`;
    const techLeadTerminalId = `tech-lead-${tabIndex}`;
    
    // タブの作成
    const tabsContainer = document.getElementById('engineer-sub-tabs');
    const tab = document.createElement('button');
    tab.className = 'sub-tab-btn';
    tab.setAttribute('data-id', engineerId);
    tab.innerHTML = `
        Engineer #${tabIndex}
        <span class="status-dot active"></span>
    `;
    tab.onclick = () => switchEngineerTab(engineerId);
    tabsContainer.appendChild(tab);
    
    // パネルの作成（エンジニアとTechLeadの両方を含む）
    const panelsContainer = document.getElementById('engineer-panels');
    const panel = document.createElement('div');
    panel.id = `engineer-panel-${engineerId}`;
    panel.className = 'sub-tab-panel';
    panel.innerHTML = `
        <div class="engineer-tech-lead-split">
            <div class="terminal-pane engineer split-pane">
                <div class="terminal-header">
                    <span class="terminal-title">👨‍💻 Engineer AI #${tabIndex}</span>
                    <div class="terminal-actions">
                        <span class="terminal-action" data-terminal="${engineerTerminalId}">Clear</span>
                    </div>
                </div>
                <div class="terminal-container" id="${engineerTerminalId}-container"></div>
            </div>
            <div class="terminal-pane tech-lead split-pane">
                <div class="terminal-header">
                    <span class="terminal-title">🔍 Tech Lead AI #${tabIndex}</span>
                    <div class="terminal-actions">
                        <span class="terminal-action" data-terminal="${techLeadTerminalId}">Clear</span>
                    </div>
                </div>
                <div class="terminal-container" id="${techLeadTerminalId}-container"></div>
            </div>
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
        const engineerContainer = document.getElementById(`${engineerTerminalId}-container`);
        const techLeadContainer = document.getElementById(`${techLeadTerminalId}-container`);
        
        if (engineerContainer) {
            initializeTerminal(engineerTerminalId, engineerContainer, themes.engineer);
        }
        if (techLeadContainer) {
            initializeTerminal(techLeadTerminalId, techLeadContainer, themes.techLead);
        }
        
        updateScrollButtons('engineer');
    }, 50);
    
    // 状態の更新
    state.engineerTabs[engineerId] = { 
        tabIndex, 
        status: 'active',
        terminalId: engineerTerminalId,
        techLeadTerminalId: techLeadTerminalId
    };
    
    console.log(`[createEngineerTab] Created engineer tab for ${engineerId} with terminals: engineer=${engineerTerminalId}, techLead=${techLeadTerminalId}`);
    return engineerTerminalId;
}

// TechLeadとEngineerの関連付けを設定
function associateTechLeadWithEngineer(techLeadId, engineerId) {
    console.log(`[associateTechLeadWithEngineer] Associating ${techLeadId} with ${engineerId}`);
    
    state.techLeadToEngineer[techLeadId] = engineerId;
    
    if (!state.engineerToTechLead[engineerId]) {
        state.engineerToTechLead[engineerId] = [];
    }
    state.engineerToTechLead[engineerId].push(techLeadId);
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
function updateStatusIndicator(engineerId, status) {
    const tabsContainer = document.getElementById('engineer-sub-tabs');
    const tab = tabsContainer.querySelector(`[data-id="${engineerId}"]`);
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
    // パイプライン状況メッセージの場合は、ヘッダーに表示して終了
    if (updatePipelineStatus(message)) {
        return; // ターミナルには表示しない
    }
    
    const terminal = state.terminals[terminalId];
    if (!terminal) {
        console.warn(`[displayLog] Terminal not found: ${terminalId}`);
        return;
    }
    
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

// マージ関連のメッセージかどうかを判定
function isMergeRelatedMessage(message) {
    // まず、明確にマージ関連ではないものを除外
    if (message.includes('📊 パイプライン状況') || 
        message.includes('⏳ 全パイプラインの完了を待機中') ||
        message.includes('✅ タスク完了') ||
        message.includes('🎯 タスク開始') ||
        message.includes('🚀 開発開始') ||
        message.includes('レビュー開始') ||
        message.includes('開発完了') ||
        message.includes('レビュー完了') ||
        message.includes('エンジニアAI[') ||
        message.includes('テックリードAI[') ||
        message.includes('プロダクトオーナーAI')) {
        return false;
    }
    
    // マージ関連のキーワード
    const mergeKeywords = [
        'マージ', 'merge', 'Merge',
        'コンフリクト', 'conflict', 'Conflict',
        'ブランチ', 'branch', 'Branch',
        'リベース', 'rebase', 'Rebase',
        'プル', 'pull', 'Pull',
        'チェリーピック', 'cherry-pick',
        'fast-forward',
        '🔧', // Merge Coordinatorのアイコン
        '🔒', // マージ待機
        '🔀', // マージ実行
        'MergeCoordinator',
        'マージコーディネーター',
        'マージキュー',
        'マージ実行',
        'マージ待機',
        'マージ成功',
        'マージ失敗',
        'クリーンアップ',
        'マージプロセス',
        'Worktree',
        'worktree'
    ];
    
    return mergeKeywords.some(keyword => message.includes(keyword));
}

// パイプライン状況の更新
function updatePipelineStatus(message) {
    // パイプライン状況のパターンにマッチするかチェック
    const pipelinePattern = /📊 パイプライン状況:/;
    
    if (pipelinePattern.test(message)) {
        // このメッセージの後に続く行で各パイプラインの状態が来るので、
        // 一時的にマークしておく
        state.expectingPipelineStats = true;
        return true;
    }
    
    // パイプライン統計情報の各行をチェック
    if (state.expectingPipelineStats) {
        const devPattern = /開発: 待機=(\d+), 処理中=(\d+)/;
        const reviewPattern = /レビュー: 待機=(\d+), 処理中=(\d+)/;
        const mergePattern = /マージ: 待機=(\d+), 処理中=(true|false)/;
        
        // 開発パイプラインの状態
        const devMatch = message.match(devPattern);
        if (devMatch) {
            state.pipelineStatus.dev.waiting = parseInt(devMatch[1]);
            state.pipelineStatus.dev.processing = parseInt(devMatch[2]);
            updatePipelineDisplay('dev');
            return true;
        }
        
        // レビューパイプラインの状態
        const reviewMatch = message.match(reviewPattern);
        if (reviewMatch) {
            state.pipelineStatus.review.waiting = parseInt(reviewMatch[1]);
            state.pipelineStatus.review.processing = parseInt(reviewMatch[2]);
            updatePipelineDisplay('review');
            return true;
        }
        
        // マージパイプラインの状態
        const mergeMatch = message.match(mergePattern);
        if (mergeMatch) {
            state.pipelineStatus.merge.waiting = parseInt(mergeMatch[1]);
            state.pipelineStatus.merge.processing = mergeMatch[2] === 'true' ? 1 : 0;
            updatePipelineDisplay('merge');
            // マージが最後の行なので、フラグをリセット
            state.expectingPipelineStats = false;
            return true;
        }
        
        // パイプライン情報以外のメッセージが来たらフラグをリセット
        if (!message.includes('待機=') && !message.includes('処理中=')) {
            state.expectingPipelineStats = false;
        }
    }
    
    return false;
}

// パイプライン表示の更新
function updatePipelineDisplay(pipeline) {
    const element = document.getElementById(`pipeline-${pipeline}`);
    if (!element) return;
    
    const status = state.pipelineStatus[pipeline];
    const text = `待機=${status.waiting}, 処理中=${status.processing}`;
    
    if (element.textContent !== text) {
        element.textContent = text;
        element.classList.add('updating');
        setTimeout(() => element.classList.remove('updating'), 300);
    }
}

// ターミナルIDの取得（構造化ログ用）
function getTerminalIdForStructuredLog(executor, context) {
    console.log(`[getTerminalIdForStructuredLog] type=${executor.type}, id=${executor.id}`);
    
    switch (executor.type) {
        case 'ProductOwner':
            return 'product-owner';
        case 'MergeCoordinator':
            return 'merge-coordinator';
        case 'System':
            // ツール実行結果の場合は最後の実行者のターミナルに表示
            if (context?.parentLogId && state.lastToolExecutor) {
                return state.lastToolExecutor;
            }
            // システムログはsystemターミナルへ
            return 'system';
        case 'Engineer':
            const engineerTerminalId = createEngineerTab(executor.id);
            return engineerTerminalId;
        case 'TechLead':
            // TechLeadのログは、関連するエンジニアのTechLeadターミナルに表示
            const relatedEngineerId = state.techLeadToEngineer[executor.id];
            if (relatedEngineerId && state.engineerTabs[relatedEngineerId]) {
                return state.engineerTabs[relatedEngineerId].techLeadTerminalId;
            }
            // 関連付けがない場合は、systemに表示
            console.warn(`[getTerminalIdForStructuredLog] No engineer association found for TechLead ${executor.id}`);
            return 'system';
        default:
            return 'system';
    }
}

// ターミナルIDの取得（レガシーログ用）
function getTerminalIdForLegacyLog(engineerId, component, message) {
    console.log(`[getTerminalIdForLegacyLog] engineerId=${engineerId}, component=${component}`);
    
    // コンポーネント名で判定
    if (component === 'ProductOwner' || component === 'Analysis') {
        return 'product-owner';
    } else if (component === 'TechLead') {
        // TechLeadの場合、関連するエンジニアのTechLeadターミナルに表示
        const relatedEngineerId = state.techLeadToEngineer[engineerId];
        if (relatedEngineerId && state.engineerTabs[relatedEngineerId]) {
            return state.engineerTabs[relatedEngineerId].techLeadTerminalId;
        }
        // 関連付けがない場合は、systemに表示
        console.warn(`[getTerminalIdForLegacyLog] No engineer association found for TechLead ${engineerId}`);
        return 'system';
    } else if (component === 'MergeCoordinator' || component === 'GitWorktree') {
        return 'merge-coordinator';
    } else if (component === 'System' || component === 'Orchestrator') {
        // メッセージ内容でマージ関連かどうか判定
        if (message && isMergeRelatedMessage(message)) {
            return 'merge-coordinator';
        }
        return 'system';
    } else if (engineerId?.startsWith('engineer-')) {
        // エンジニアAIのログ
        const terminalId = createEngineerTab(engineerId);
        return terminalId;
    } else if (engineerId === 'ProductOwner') {
        return 'product-owner';
    } else if (engineerId === 'MergeCoordinator') {
        return 'merge-coordinator';
    } else {
        // デフォルトはsystem
        return 'system';
    }
}

// dragEventエラーを回避
if (typeof dragEvent === 'undefined') {
    window.dragEvent = null;
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('[DOMContentLoaded] Starting initialization...');
    
    // 初期ターミナルの作成
    const productOwnerContainer = document.getElementById('product-owner-terminal');
    const mergeCoordinatorContainer = document.getElementById('merge-coordinator-terminal');
    const systemContainer = document.getElementById('system-terminal');
    
    if (productOwnerContainer) {
        initializeTerminal('product-owner', productOwnerContainer, themes.productOwner);
    }
    
    if (mergeCoordinatorContainer) {
        initializeTerminal('merge-coordinator', mergeCoordinatorContainer, themes.mergeCoordinator);
    }
    
    if (systemContainer) {
        initializeTerminal('system', systemContainer, themes.system);
    }
    
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
    
    // ウィンドウリサイズ処理
    window.addEventListener('resize', () => {
        Object.values(state.fitAddons).forEach(addon => addon.fit());
        updateScrollButtons('engineer');
    });
    
    // Electron APIイベントリスナー
    if (window.electronAPI) {
        console.log('[DOMContentLoaded] Setting up Electron API listeners...');
        
        // デバッグ用：初期ターミナルにテストメッセージを表示
        if (state.terminals['product-owner']) {
            state.terminals['product-owner'].writeln('\x1b[32m✅ Product Owner terminal ready and listening for logs...\x1b[0m');
        }
        if (state.terminals['merge-coordinator']) {
            state.terminals['merge-coordinator'].writeln('\x1b[32m✅ Merge Coordinator terminal ready and listening for logs...\x1b[0m');
        }
        
        // 構造化ログデータの受信
        window.electronAPI.onStructuredLogData((data) => {
            console.log('[onStructuredLogData] Received:', data);
            const { executor, level, message, timestamp, context } = data;
            const terminalId = getTerminalIdForStructuredLog(executor, context);
            
            // ツール実行の場合は実行者を記録
            if (context?.toolName) {
                state.lastToolExecutor = terminalId;
            }
            
            displayLog(terminalId, level, message, timestamp);
        });
        
        // レガシーログデータの受信（互換性のため）
        window.electronAPI.onLogData((data) => {
            console.log('[onLogData] Received:', data);
            const { engineerId, level, message, component, timestamp } = data;
            
            const terminalId = getTerminalIdForLegacyLog(engineerId, component, message);
            
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
                displayLog(state.lastToolExecutor, level, message, timestamp);
            } else {
                displayLog(terminalId, level, message, timestamp);
            }
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
            console.log(`[onAssociateTechLeadEngineer] ${techLeadId} -> ${engineerId}`);
            associateTechLeadWithEngineer(techLeadId, engineerId);
        });
    } else {
        console.error('[DOMContentLoaded] window.electronAPI is not available!');
        console.log('[DOMContentLoaded] Attempting to use direct ipcRenderer as fallback...');
        
        // フォールバック: 直接ipcRendererを使用
        try {
            const { ipcRenderer } = require('electron');
            console.log('[DOMContentLoaded] Using direct ipcRenderer');
            
            // デバッグ用：初期ターミナルにテストメッセージを表示
            if (state.terminals['product-owner']) {
                state.terminals['product-owner'].writeln('\x1b[33m⚠️ Using fallback ipcRenderer mode\x1b[0m');
            }
            
            // 構造化ログデータ
            ipcRenderer.on('structured-log-data', (event, data) => {
                console.log('[onStructuredLogData-fallback] Received:', data);
                const { executor, level, message, timestamp, context } = data;
                const terminalId = getTerminalIdForStructuredLog(executor, context);
                
                if (context?.toolName) {
                    state.lastToolExecutor = terminalId;
                }
                
                displayLog(terminalId, level, message, timestamp);
            });
            
            // レガシーログデータ
            ipcRenderer.on('log-data', (event, data) => {
                console.log('[onLogData-fallback] Received:', data);
                const { engineerId, level, message, component, timestamp } = data;
                
                const terminalId = getTerminalIdForLegacyLog(engineerId, component, message);
                
                if (message.includes('🛠️') && message.includes('ツール実行')) {
                    state.lastToolExecutor = terminalId;
                }
                
                if (!component && engineerId === 'system' && 
                    (message.includes('⚙️  パラメータ:') || 
                     message.includes('📂 ディレクトリ一覧:') || 
                     message.includes('📄 ファイル内容:') ||
                     message.includes('✅ 実行結果:') ||
                     message.includes('📊 結果:')) &&
                    state.lastToolExecutor) {
                    displayLog(state.lastToolExecutor, level, message, timestamp);
                } else {
                    displayLog(terminalId, level, message, timestamp);
                }
            });
            
            // その他のイベント
            ipcRenderer.on('task-status-update', (event, data) => {
                const { completed, total } = data;
                document.getElementById('task-status').textContent = `Tasks: ${completed}/${total}`;
            });
            
            ipcRenderer.on('connection-status', (event, connected) => {
                const indicator = document.getElementById('connection-status');
                indicator.style.backgroundColor = connected ? '#4CAF50' : '#f44336';
            });
            
            ipcRenderer.on('layout-update', (event, engineerCount) => {
                document.getElementById('engineer-count').textContent = `Engineers: ${engineerCount}`;
            });
            
            ipcRenderer.on('associate-techlead-engineer', (event, data) => {
                const { techLeadId, engineerId } = data;
                console.log(`[onAssociateTechLeadEngineer-fallback] ${techLeadId} -> ${engineerId}`);
                associateTechLeadWithEngineer(techLeadId, engineerId);
            });
            
        } catch (e) {
            console.error('[DOMContentLoaded] Cannot use direct ipcRenderer:', e);
        }
    }
});