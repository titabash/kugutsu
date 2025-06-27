// ES Moduleとして動作させるため、window.requireを使用
const electronRequire = window.require;

// Electronのrequireを使用してモジュールを読み込む
const { Terminal } = electronRequire('@xterm/xterm');
const { FitAddon } = electronRequire('@xterm/addon-fit');
const { SearchAddon } = electronRequire('@xterm/addon-search');
const { WebLinksAddon } = electronRequire('@xterm/addon-web-links');

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
    // 現在実行中のプロジェクトID
    currentProjectId: null,
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
    
    // タスクタブがクリックされた場合、データを読み込む
    if (tabId === 'tasks') {
        console.log('[switchTab] Loading task data for tasks tab...');
        loadTasksDirectly();
    }
    
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
    
    // エンジニア数のカウンターを更新
    const engineerCount = Object.keys(state.engineerTabs).length;
    const engineerCountElem = document.getElementById('engineer-count');
    if (engineerCountElem) {
        engineerCountElem.textContent = `Engineers: ${engineerCount}`;
    }
    
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

// タスク詳細モーダルを表示する関数
function showTaskDetailModal(taskTitle, content) {
    const modal = document.getElementById('task-detail-modal');
    if (!modal) return;
    
    // タイトルはすでに渡されているので、そのまま使用
    const title = taskTitle;
    
    // タイトルを設定
    document.getElementById('task-detail-title').textContent = title;
    
    // 内容を整形して表示
    const instructionContent = document.getElementById('task-instruction-content');
    if (instructionContent) {
        // Markdownを簡単にHTML化
        const html = content
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/- \[ \] (.+)$/gm, '<li><input type="checkbox" disabled> $1</li>')
            .replace(/- \[x\] (.+)$/gm, '<li><input type="checkbox" checked disabled> $1</li>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        
        instructionContent.innerHTML = `<div class="markdown-formatted"><p>${html}</p></div>`;
    }
    
    // モーダルを表示
    modal.classList.add('show');
    
    // 閉じるボタンのイベントハンドラ
    const closeBtn = document.getElementById('close-task-detail');
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.classList.remove('show');
        };
    }
    
    // モーダルの外側クリックで閉じる
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    };
}

// タスクを直接読み込む関数
function loadTasksDirectly() {
    console.log('[Tasks] Loading tasks directly...');
    
    const fs = electronRequire('fs');
    const path = electronRequire('path');
    
    // .kugutsuディレクトリを使用
    // window.location.hrefからプロジェクトルートを推測
    const currentPath = window.location.href;
    console.log('[Tasks] Current location:', currentPath);
    
    // file:///プロトコルからファイルパスを取得
    let baseDir;
    if (currentPath.startsWith('file://')) {
        // file:///Users/tknr/Development/multi-engineer/electron/renderer/index.html
        // から /Users/tknr/Development/multi-engineer を取得
        const filePath = currentPath.replace('file://', '');
        const rendererPath = path.dirname(filePath);
        // electron/renderer から2階層上がプロジェクトルート
        baseDir = path.resolve(rendererPath, '../..');
    } else {
        // フォールバック: ハードコードされたパスを使用
        baseDir = '/Users/tknr/Development/multi-engineer';
    }
    
    const kugutsuDir = path.join(baseDir, '.kugutsu');
    console.log('[Tasks] Base directory:', baseDir);
    console.log('[Tasks] Kugutsu directory:', kugutsuDir);
    
    const tasksContainer = document.getElementById('tasks-grid');
    const overviewContainer = document.getElementById('overview-content');
    
    if (!tasksContainer || !overviewContainer) {
        console.error('[Tasks] Required DOM elements not found');
        return;
    }
    
    try {
        // .kugutsu/projects ディレクトリを探す
        const projectsDir = path.join(kugutsuDir, 'projects');
        
        if (!fs.existsSync(projectsDir)) {
            tasksContainer.innerHTML = '<div class="no-tasks">No projects directory found. Run parallel-dev to generate tasks.</div>';
            return;
        }
        
        let projectDir;
        
        // 現在のprojectIdがある場合はそれを使用
        if (state.currentProjectId) {
            projectDir = path.join(projectsDir, state.currentProjectId);
            console.log('[Tasks] Using current project ID:', state.currentProjectId);
            
            if (!fs.existsSync(projectDir)) {
                console.warn('[Tasks] Current project directory not found:', projectDir);
                tasksContainer.innerHTML = '<div class="no-tasks">Current project not found. Waiting for tasks...</div>';
                return;
            }
        } else {
            // projectIdがない場合は最新のanalysis.jsonを持つプロジェクトを使用
            const projectDirs = fs.readdirSync(projectsDir)
                .map(f => path.join(projectsDir, f))
                .filter(f => {
                    try {
                        // ディレクトリかつanalysis.jsonが存在するもののみ
                        return fs.statSync(f).isDirectory() && 
                               fs.existsSync(path.join(f, 'analysis.json'));
                    } catch (e) {
                        return false;
                    }
                })
                .sort((a, b) => {
                    // analysis.jsonの更新時刻で並び替え
                    try {
                        const aTime = fs.statSync(path.join(a, 'analysis.json')).mtimeMs;
                        const bTime = fs.statSync(path.join(b, 'analysis.json')).mtimeMs;
                        return bTime - aTime;
                    } catch (e) {
                        return 0;
                    }
                });
            
            console.log('[Tasks] Found project directories with analysis.json:', projectDirs.length);
            
            if (projectDirs.length === 0) {
                tasksContainer.innerHTML = '<div class="no-tasks">No analyzed projects found. Waiting for task analysis...</div>';
                return;
            }
            
            // 最新のanalysis.jsonを持つプロジェクトディレクトリを使用
            projectDir = projectDirs[0];
            console.log('[Tasks] Using latest analyzed project directory');
        }
        const instructionsDir = path.join(projectDir, 'instructions');
        console.log('[Tasks] Using project directory:', projectDir);
        
        // task-overview.mdを読み込む
        const overviewPath = path.join(instructionsDir, 'task-overview.md');
        if (fs.existsSync(overviewPath)) {
            const overviewContent = fs.readFileSync(overviewPath, 'utf-8');
            const projectId = path.basename(projectDir);
            const isCurrentProject = state.currentProjectId && projectId === state.currentProjectId;
            overviewContainer.innerHTML = `<div class="project-info">プロジェクトID: ${projectId}${isCurrentProject ? ' <span style="color: #4caf50;">(現在実行中)</span>' : ''}</div><pre>${overviewContent}</pre>`;
            console.log('[Tasks] Loaded overview');
        } else {
            const projectId = path.basename(projectDir);
            const isCurrentProject = state.currentProjectId && projectId === state.currentProjectId;
            overviewContainer.innerHTML = `<div class="project-info">プロジェクトID: ${projectId}${isCurrentProject ? ' <span style="color: #4caf50;">(現在実行中)</span>' : ''}</div><p>No overview found</p>`;
        }
        
        // 現在のプロジェクトのタスクIDとセッションIDを取得するためanalysis.jsonを読み込む
        let currentTaskIds = [];
        let currentSessionId = null;
        const analysisPath = path.join(projectDir, 'analysis.json');
        if (fs.existsSync(analysisPath)) {
            try {
                const analysisContent = fs.readFileSync(analysisPath, 'utf-8');
                const analysis = JSON.parse(analysisContent);
                console.log('[Tasks] Analysis loaded:', analysis);
                
                // セッションIDを取得
                if (analysis.sessionId) {
                    currentSessionId = analysis.sessionId;
                    console.log('[Tasks] Current session ID:', currentSessionId);
                }
                
                if (analysis.tasks && Array.isArray(analysis.tasks)) {
                    currentTaskIds = analysis.tasks
                        .map(t => {
                            if (!t || typeof t !== 'object') {
                                console.warn('[Tasks] Invalid task object:', t);
                                return null;
                            }
                            return t.id;
                        })
                        .filter(id => id && typeof id === 'string'); // null/undefinedを除外
                    console.log('[Tasks] Current task IDs:', currentTaskIds);
                    console.log('[Tasks] Task count:', currentTaskIds.length);
                } else {
                    console.warn('[Tasks] No tasks found in analysis.json');
                }
            } catch (e) {
                console.error('[Tasks] Error reading analysis.json:', e);
            }
        } else {
            console.log('[Tasks] analysis.json not found for project:', path.basename(projectDir));
            // analysis.jsonがない場合は、全てのタスクファイルを表示する（後方互換性のため）
            // ただし、現在のプロジェクトIDと一致する場合のみ
            if (!state.currentProjectId || path.basename(projectDir) !== state.currentProjectId) {
                tasksContainer.innerHTML = '<div class="no-tasks">Waiting for task analysis...</div>';
                return;
            }
        }
        
        // task-*.mdファイルを探してタスク情報を構築
        if (!fs.existsSync(instructionsDir)) {
            console.log('[Tasks] Instructions directory not found');
            tasksContainer.innerHTML = '<div class="no-tasks">No instructions directory found.</div>';
            return;
        }
        
        const allTaskFiles = fs.readdirSync(instructionsDir)
            .filter(f => f.startsWith('task-') && f.endsWith('.md') && f !== 'task-overview.md');
        
        console.log('[Tasks] All task files in directory:', allTaskFiles);
        
        // 現在のプロジェクトのタスクのみをフィルタリング
        const taskFiles = allTaskFiles.filter(filename => {
            // セッションIDが指定されている場合は、ファイル内容を確認
            if (currentSessionId) {
                const taskPath = path.join(instructionsDir, filename);
                try {
                    const content = fs.readFileSync(taskPath, 'utf-8');
                    // セッションIDをファイル内容から検索（**付きの形式に対応）
                    const sessionMatch = content.match(/\*\*セッションID\*\*: ([^\n]+)/);
                    console.log(`[Tasks] Checking file ${filename}: Found session ID = ${sessionMatch ? sessionMatch[1] : 'none'}, Current session ID = ${currentSessionId}`);
                    if (sessionMatch && sessionMatch[1] === currentSessionId) {
                        console.log(`[Tasks] File ${filename} matches current session`);
                        return true;
                    }
                } catch (e) {
                    console.error('[Tasks] Error reading task file:', filename, e);
                }
                return false;
            }
            
            // セッションIDがない場合は、タスクIDでフィルタリング（後方互換性）
            if (currentTaskIds.length > 0) {
                const match = filename.match(/^task-([^-]+)-/);
                if (match) {
                    const fileTaskId = match[1];
                    // 現在のプロジェクトのタスクIDリストに含まれるかチェック
                    return currentTaskIds.some(id => {
                        // idがundefinedやnullでないことを確認
                        if (!id || typeof id !== 'string') {
                            console.warn('[Tasks] Invalid task ID found:', id);
                            return false;
                        }
                        // fileTaskIdも検証
                        if (!fileTaskId || typeof fileTaskId !== 'string') {
                            console.warn('[Tasks] Invalid file task ID:', fileTaskId);
                            return false;
                        }
                        try {
                            return id.startsWith(fileTaskId);
                        } catch (e) {
                            console.error('[Tasks] Error in startsWith:', e, 'id:', id, 'fileTaskId:', fileTaskId);
                            return false;
                        }
                    });
                }
                return false;
            }
            
            // セッションIDもタスクIDもない場合は全てのタスクを表示
            return true;
        });
        
        console.log('[Tasks] Filtered task files for current project:', taskFiles);
        
        if (taskFiles.length === 0) {
            tasksContainer.innerHTML = '<div class="no-tasks">No task files found for current project</div>';
            return;
        }
        
        // タスクカードを生成
        tasksContainer.innerHTML = '';
        taskFiles.forEach(filename => {
            const taskPath = path.join(instructionsDir, filename);
            const content = fs.readFileSync(taskPath, 'utf-8');
            
            // ファイル内容からタスク情報を抽出
            const titleMatch = content.match(/^# タスク詳細: (.+)$/m);
            const taskTitle = titleMatch ? titleMatch[1] : filename;
            
            // シンプルなカード作成
            const card = document.createElement('div');
            card.className = 'task-card';
            card.innerHTML = `
                <div class="task-title">${taskTitle}</div>
                <div class="task-description">Click to view details</div>
            `;
            
            // クリックで詳細モーダルを表示
            card.onclick = () => {
                showTaskDetailModal(taskTitle, content);
            };
            
            tasksContainer.appendChild(card);
        });
        
        console.log('[Tasks] Tasks loaded successfully');
        
    } catch (error) {
        console.error('[Tasks] Error:', error);
        tasksContainer.innerHTML = '<div class="error-message">Error: ' + error.message + '</div>';
    }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('[DOMContentLoaded] Starting initialization...');
    
    // currentProjectIdをクリア（新しい実行のため）
    state.currentProjectId = null;
    
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
    
    // タスクリフレッシュボタン
    const refreshTasksBtn = document.getElementById('refresh-tasks');
    if (refreshTasksBtn) {
        refreshTasksBtn.onclick = loadTasksDirectly;
    }
    
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
            
            // プログレスバーは非表示にしたため更新しない
            // updateProgressBar(completed, total);
        });
        
        // 全タスク完了通知
        window.electronAPI.onAllTasksCompleted((status) => {
            console.log('[Renderer] onAllTasksCompleted called with status:', status);
            const { completedTasks, totalTasks, percentage } = status;
            console.log('[Renderer] About to show completion dialog...');
            showCompletionDialog(completedTasks, totalTasks);
            
            // システムターミナルに完了メッセージを表示
            if (state.terminals['system']) {
                console.log('[Renderer] Writing completion message to system terminal...');
                state.terminals['system'].writeln(`\x1b[1;32m\n🎉 全タスクが完了しました！ (${completedTasks}/${totalTasks} - ${percentage}%)\x1b[0m\n`);
            }
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
        
        // 現在のプロジェクトIDを受信
        window.electronAPI.onMessage('set-current-project-id', (projectId) => {
            console.log('[Renderer] Current project ID:', projectId);
            state.currentProjectId = projectId;
            
            // Tasksタブが表示されている場合は自動的に更新
            if (state.activeTab === 'tasks') {
                console.log('[Renderer] Refreshing tasks for new project');
                loadTasksDirectly();
            }
        });
    } else {
        console.error('[DOMContentLoaded] window.electronAPI is not available!');
        console.log('[DOMContentLoaded] Attempting to use direct ipcRenderer as fallback...');
        
        // フォールバック: 直接ipcRendererを使用
        try {
            const { ipcRenderer } = electronRequire('electron');
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
            
            // 全タスク完了通知（フォールバック）
            ipcRenderer.on('all-tasks-completed', (event, status) => {
                console.log('[Renderer-fallback] all-tasks-completed event received:', status);
                const { completedTasks, totalTasks, percentage } = status;
                console.log('[Renderer-fallback] About to show completion dialog...');
                showCompletionDialog(completedTasks, totalTasks);
                
                // システムターミナルに完了メッセージを表示
                if (state.terminals['system']) {
                    console.log('[Renderer-fallback] Writing completion message to system terminal...');
                    state.terminals['system'].writeln(`\x1b[1;32m\n🎉 全タスクが完了しました！ (${completedTasks}/${totalTasks} - ${percentage}%)\x1b[0m\n`);
                }
            });
            
        } catch (e) {
            console.error('[DOMContentLoaded] Cannot use direct ipcRenderer:', e);
        }
    }
    
});

// プログレスバー更新関数
function updateProgressBar(completed, total) {
    const progressFill = document.getElementById('task-progress-fill');
    const progressBar = document.getElementById('task-progress-bar');
    
    console.log(`[updateProgressBar] Updating progress: ${completed}/${total}`);
    
    if (!progressFill || !progressBar) {
        console.error('[updateProgressBar] Progress bar elements not found');
        return;
    }
    
    if (total === 0) {
        progressFill.style.width = '0%';
        progressBar.style.display = 'none';
        return;
    }
    
    progressBar.style.display = 'inline-block';
    const percentage = (completed / total) * 100;
    progressFill.style.width = `${percentage}%`;
    console.log(`[updateProgressBar] Set progress bar width to ${percentage}%`);
    
    // 完了時の特別なスタイル
    if (completed === total) {
        progressFill.classList.add('completed');
        document.getElementById('header').classList.add('completed');
    }
}

// 完了ダイアログ表示関数
let startTime = Date.now();
function showCompletionDialog(completed, total) {
    console.log('[Renderer] showCompletionDialog called with:', { completed, total });
    
    const dialog = document.getElementById('completion-dialog');
    console.log('[Renderer] Found completion dialog element:', !!dialog);
    
    const endTime = Date.now();
    const duration = Math.floor((endTime - startTime) / 1000);
    
    // 統計情報を更新
    const totalTasksElem = document.getElementById('total-tasks-count');
    const completedTasksElem = document.getElementById('completed-tasks-count');
    const failedTasksElem = document.getElementById('failed-tasks-count');
    
    console.log('[Renderer] Found dialog elements:', {
        totalTasksElem: !!totalTasksElem,
        completedTasksElem: !!completedTasksElem,
        failedTasksElem: !!failedTasksElem
    });
    
    if (totalTasksElem) totalTasksElem.textContent = total;
    if (completedTasksElem) completedTasksElem.textContent = completed;
    if (failedTasksElem) failedTasksElem.textContent = total - completed;
    
    // 実行時間を表示
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    const timeText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    const totalTimeElem = document.getElementById('total-time');
    if (totalTimeElem) totalTimeElem.textContent = timeText;
    
    // ダイアログを表示
    if (dialog) {
        console.log('[Renderer] Showing completion dialog...');
        dialog.classList.add('show');
        console.log('[Renderer] Dialog should now be visible');
    } else {
        console.error('[Renderer] Completion dialog element not found!');
    }
    
    // デスクトップ通知
    if (window.Notification && Notification.permission === 'granted') {
        console.log('[Renderer] Showing desktop notification...');
        new Notification('🎉 All Tasks Completed!', {
            body: `${completed} tasks completed successfully in ${timeText}`,
            icon: '/icon.png'
        });
    } else {
        console.log('[Renderer] Desktop notification not available or permission not granted');
    }
}

// ダイアログボタンのイベントリスナー
document.addEventListener('DOMContentLoaded', () => {
    // 完了ダイアログのボタン処理
    document.getElementById('close-dialog-btn').addEventListener('click', () => {
        document.getElementById('completion-dialog').classList.remove('show');
    });
    
    document.getElementById('view-summary-btn').addEventListener('click', () => {
        // サマリービューに切り替え（将来実装）
        console.log('View summary clicked');
        document.getElementById('completion-dialog').classList.remove('show');
    });
    
    document.getElementById('create-pr-btn').addEventListener('click', () => {
        // PR作成処理（将来実装）
        console.log('Create PR clicked');
        document.getElementById('completion-dialog').classList.remove('show');
    });
    
    // 通知権限をリクエスト
    if (window.Notification && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});