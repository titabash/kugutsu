// Electronのrequireを使用してモジュールを読み込む
const { Terminal } = require('xterm');
const { FitAddon } = require('xterm-addon-fit');
const { SearchAddon } = require('xterm-addon-search');
const { WebLinksAddon } = require('xterm-addon-web-links');
const Split = require('split.js');

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

// ターミナルインスタンスを管理
const terminals = {};
const fitAddons = {};

// エンジニアとTechLeadのペア管理
const engineerPairMapping = {}; // engineerId -> pairIndexのマッピング
const techLeadToEngineerMapping = {}; // techLeadId -> engineerIdのマッピング
const engineerToTechLeadMapping = {}; // engineerId -> techLeadId[]のマッピング
let pairCounter = 0;

// エンジニアIDとTechLeadIDの関連付けを設定
window.associateTechLeadWithEngineer = function(techLeadId, engineerId) {
    console.log(`[Renderer] associateTechLeadWithEngineer called: TechLead=${techLeadId}, Engineer=${engineerId}`);
    
    techLeadToEngineerMapping[techLeadId] = engineerId;
    if (!engineerToTechLeadMapping[engineerId]) {
        engineerToTechLeadMapping[engineerId] = [];
    }
    engineerToTechLeadMapping[engineerId].push(techLeadId);
    
    // エンジニアのペアがまだ存在しない場合は作成
    const pairIndex = getOrCreateEngineerPair(engineerId);
    
    // TechLeadのマッピングを更新
    const terminalId = `tech-lead-${pairIndex}`;
    techLeadTerminalMapping[techLeadId] = terminalId;
    console.log(`[Renderer] Set TechLead ${techLeadId} terminal mapping to ${terminalId}`);
    
    // ターミナルが存在するか確認
    setTimeout(() => {
        if (terminals[terminalId]) {
            console.log(`[Renderer] Terminal ${terminalId} exists and ready`);
        } else {
            console.error(`[Renderer] Terminal ${terminalId} not found after association!`);
        }
    }, 200);
}

// エンジニアのペアを取得または作成
function getOrCreateEngineerPair(engineerId) {
    if (!engineerPairMapping[engineerId]) {
        pairCounter++;
        engineerPairMapping[engineerId] = pairCounter;
        createEngineerPair(pairCounter, engineerId);
        console.log(`[Renderer] Created new engineer pair ${pairCounter} for ${engineerId}`);
    }
    return engineerPairMapping[engineerId];
}

// エンジニアターミナルIDの取得または作成
function getOrCreateEngineerTerminalId(engineerId) {
    const pairIndex = getOrCreateEngineerPair(engineerId);
    return `engineer-${pairIndex}`;
}

// TechLeadターミナルIDの取得または作成
const techLeadTerminalMapping = {}; // techLeadId -> terminalIdのキャッシュ
let techLeadCounter = 0;

function getOrCreateTechLeadTerminalId(techLeadId) {
    // 既にターミナルIDが割り当てられている場合はそれを返す
    if (techLeadTerminalMapping[techLeadId]) {
        return techLeadTerminalMapping[techLeadId];
    }
    
    // 新しいTechLeadターミナルを作成
    techLeadCounter++;
    const terminalId = `tech-lead-${techLeadCounter}`;
    techLeadTerminalMapping[techLeadId] = terminalId;
    
    // TechLeadターミナルを作成
    createTechLeadTerminal(techLeadCounter);
    
    console.log(`[Renderer] Created new TechLead terminal ${terminalId} for ${techLeadId}`);
    return terminalId;
}

function createTechLeadTerminal(index) {
    const container = document.getElementById('tech-lead-panes');
    if (!container) {
        console.error('[Renderer] tech-lead-panes container not found');
        return;
    }
    
    const paneDiv = document.createElement('div');
    paneDiv.id = `tech-lead-${index}-pane`;
    paneDiv.className = 'terminal-pane tech-lead';
    paneDiv.innerHTML = `
        <div class="terminal-header">
            <span class="terminal-title">🔍 Tech Lead AI #${index}</span>
            <div class="terminal-actions">
                <span class="terminal-action" data-terminal="tech-lead-${index}">Clear</span>
            </div>
        </div>
        <div class="terminal-container" id="tech-lead-${index}-terminal"></div>
    `;
    container.appendChild(paneDiv);
    
    // ターミナルを初期化
    setTimeout(() => {
        initializeTerminal(
            `tech-lead-${index}`,
            document.getElementById(`tech-lead-${index}-terminal`),
            themes.techLead
        );
        console.log(`[Renderer] Initialized TechLead terminal tech-lead-${index}`);
    }, 50);
}

// エンジニアIDマッピングのクリア（必要に応じて）
function clearEngineerMapping() {
    Object.keys(engineerIdMapping).forEach(key => delete engineerIdMapping[key]);
    engineerCounter = 0;
    console.log('[Renderer] Engineer ID mapping cleared');
}

// 最後に使用したターミナルIDを記録（ツール結果を適切な場所に表示するため）
let lastUsedTerminalId = 'merge-coordinator';
// 最後にツール実行を行ったコンポーネントを記録
let lastToolExecutor = null;

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

    terminals[id] = term;
    fitAddons[id] = fitAddon;

    // ウィンドウリサイズ時の処理
    window.addEventListener('resize', () => fitAddon.fit());

    return term;
}

// エンジニアとTechLeadのペアを作成
function createEngineerPair(pairIndex, engineerId) {
    const container = document.getElementById('engineer-pairs-container');
    
    // 既に同じIDのペアが存在する場合はスキップ
    if (document.getElementById(`engineer-pair-${pairIndex}`)) {
        console.warn(`[Renderer] Engineer pair ${pairIndex} already exists, skipping creation`);
        return;
    }
    
    const pairDiv = document.createElement('div');
    pairDiv.id = `engineer-pair-${pairIndex}`;
    pairDiv.className = 'engineer-pair';
    
    // エンジニアペイン
    const engineerPane = document.createElement('div');
    engineerPane.id = `engineer-${pairIndex}-pane`;
    engineerPane.className = 'terminal-pane engineer engineer-pane';
    engineerPane.innerHTML = `
        <div class="terminal-header">
            <span class="terminal-title">👨‍💻 Engineer AI #${pairIndex}</span>
            <div class="terminal-actions">
                <span class="terminal-action" data-terminal="engineer-${pairIndex}">Clear</span>
            </div>
        </div>
        <div class="terminal-container" id="engineer-${pairIndex}-terminal"></div>
    `;
    
    // TechLeadペイン
    const techLeadPane = document.createElement('div');
    techLeadPane.id = `tech-lead-${pairIndex}-pane`;
    techLeadPane.className = 'terminal-pane tech-lead tech-lead-pane';
    techLeadPane.innerHTML = `
        <div class="terminal-header">
            <span class="terminal-title">🔍 Tech Lead AI #${pairIndex}</span>
            <div class="terminal-actions">
                <span class="terminal-action" data-terminal="tech-lead-${pairIndex}">Clear</span>
            </div>
        </div>
        <div class="terminal-container" id="tech-lead-${pairIndex}-terminal"></div>
    `;
    
    pairDiv.appendChild(engineerPane);
    pairDiv.appendChild(techLeadPane);
    container.appendChild(pairDiv);
    
    // ターミナルを初期化
    setTimeout(() => {
        const engineerTerm = initializeTerminal(
            `engineer-${pairIndex}`,
            document.getElementById(`engineer-${pairIndex}-terminal`),
            themes.engineer
        );
        const techLeadTerm = initializeTerminal(
            `tech-lead-${pairIndex}`,
            document.getElementById(`tech-lead-${pairIndex}-terminal`),
            themes.techLead
        );
        
        console.log(`[Renderer] Initialized terminals for pair ${pairIndex}`);
        console.log(`[Renderer] Engineer terminal: ${engineerTerm ? 'OK' : 'FAILED'}`);
        console.log(`[Renderer] TechLead terminal: ${techLeadTerm ? 'OK' : 'FAILED'}`);
    }, 50);
    
    // ペア間のSplit.jsを更新
    updatePairSplits();
}

// ペア間の水平分割を更新
function updatePairSplits() {
    const container = document.getElementById('engineer-pairs-container');
    const pairs = Array.from(container.querySelectorAll('.engineer-pair'));
    
    if (pairs.length > 1) {
        const pairSelectors = pairs.map(pair => `#${pair.id}`);
        Split(pairSelectors, {
            sizes: Array(pairs.length).fill(100 / pairs.length),
            minSize: 300,
            gutterSize: 5,
            cursor: 'col-resize'
        });
    }
}

// レガシー関数（互換性のため）
function createEngineerTerminals(count) {
    // 新しいペアシステムでは使用しない
    console.log(`[Renderer] createEngineerTerminals called with count=${count}, but using pair system instead`);
}

// ターミナルクリア
function clearTerminal(id) {
    const terminal = terminals[id];
    if (terminal) {
        terminal.clear();
    }
}

// 構造化ログからターミナルIDを決定
function getTerminalIdFromStructuredLog(executor, context) {
    console.log(`[Renderer] getTerminalIdFromStructuredLog: type=${executor.type}, id=${executor.id}`);
    
    // executorの型に基づいてターミナルIDを決定
    switch (executor.type) {
        case 'ProductOwner':
            return 'product-owner';
        case 'TechLead':
            // TechLeadのIDをマッピング
            const techLeadTerminalId = getOrCreateTechLeadTerminalId(executor.id);
            console.log(`[Renderer] TechLead terminal ID resolved to: ${techLeadTerminalId}`);
            return techLeadTerminalId;
        case 'MergeCoordinator':
            return 'merge-coordinator';
        case 'System':
            // ツール実行結果などの場合、最後のツール実行者のターミナルに表示
            if (context?.parentLogId && lastToolExecutor) {
                return lastToolExecutor;
            }
            return 'merge-coordinator';
        case 'Engineer':
            // エンジニアのIDをマッピング
            return getOrCreateEngineerTerminalId(executor.id);
        default:
            return 'merge-coordinator';
    }
}

// 構造化ログメッセージの表示
function displayStructuredLogMessage(terminalId, level, message, timestamp, context) {
    const terminal = terminals[terminalId];
    if (!terminal) {
        console.warn(`[Renderer] Terminal not found: ${terminalId}`);
        console.warn(`[Renderer] Available terminals: ${Object.keys(terminals).join(', ')}`);
        
        // ターミナルがまだ初期化されていない場合は、少し待って再試行
        if (terminalId.startsWith('tech-lead-')) {
            setTimeout(() => {
                const retryTerminal = terminals[terminalId];
                if (retryTerminal) {
                    displayStructuredLogMessage(terminalId, level, message, timestamp, context);
                }
            }, 100);
        }
        return;
    }

    const time = new Date(timestamp).toLocaleTimeString();
    let colorCode = '\x1b[37m'; // デフォルト白
    
    // ログレベルに基づく色設定
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

    // コンテキスト情報の表示を準備
    let contextInfo = '';
    if (context?.toolName) {
        contextInfo = `\x1b[35m[${context.toolName}]\x1b[0m `;
    }
    
    // ツール実行IDがある場合の表示
    if (context?.toolExecutionId) {
        contextInfo += `\x1b[90m(${context.toolExecutionId.slice(0, 8)})\x1b[0m `;
    }

    // ログメッセージを表示
    terminal.writeln(`\x1b[90m[${time}]\x1b[0m ${contextInfo}${colorCode}${message}\x1b[0m`);
}

// dragEventエラーを回避
if (typeof dragEvent === 'undefined') {
    window.dragEvent = null;
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Renderer] DOMContentLoaded');
    console.log('[Renderer] window.electronAPI:', window.electronAPI);
    console.log('[Renderer] All window properties:', Object.keys(window).filter(k => k.includes('electron')));
    
    // エラーがあればキャッチ
    try {
        // 初期ターミナルの作成
    const productOwnerTerm = initializeTerminal(
        'product-owner',
        document.getElementById('product-owner-terminal'),
        themes.productOwner
    );
    
    // テストメッセージを表示
    productOwnerTerm.writeln('\x1b[32mProduct Owner Terminal Ready!\x1b[0m');
    productOwnerTerm.writeln('Waiting for logs...');

    initializeTerminal(
        'merge-coordinator',
        document.getElementById('merge-coordinator-terminal'),
        themes.mergeCoordinator
    );

    // クリアボタンのイベントリスナー
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('terminal-action')) {
            const terminalId = e.target.getAttribute('data-terminal');
            if (terminalId) {
                clearTerminal(terminalId);
            }
        }
    });

    // Electron APIのイベントリスナー設定
    if (window.electronAPI) {
        console.log('[Renderer] Electron API available');
        
        // ログデータの受信（レガシー）
        window.electronAPI.onLogData((data) => {
            console.log('[Renderer] Received log data:', data);
            const { engineerId, level, message, component, timestamp } = data;
            
            // ターミナルIDのマッピング
            let terminalId;
            
            // コンポーネント名でマッピング
            if (component === 'ProductOwner' || component === 'Analysis') {
                terminalId = 'product-owner';
            } else if (component === 'TechLead') {
                // TechLeadの場合、engineerIdがtechlead-xxx形式のTechLeadIDである
                console.log(`[Renderer] TechLead log: engineerId=${engineerId}`);
                terminalId = getOrCreateTechLeadTerminalId(engineerId);
            } else if (component === 'MergeCoordinator') {
                terminalId = 'merge-coordinator';
            } else if (component === 'System' || component === 'Orchestrator') {
                // システムメッセージはmerge-coordinatorに表示
                terminalId = 'merge-coordinator';
            } else if (engineerId && engineerId.startsWith('engineer-')) {
                // エンジニアAIのログ
                terminalId = getOrCreateEngineerTerminalId(engineerId);
            } else {
                // デフォルトはmerge-coordinator
                terminalId = 'merge-coordinator';
            }

            // ツール実行のログの場合、実行者を記録
            if (message.includes('🛠️') && message.includes('ツール実行')) {
                lastToolExecutor = terminalId;
            }
            
            // ツール実行結果など、コンポーネントが不明な場合は最後のツール実行者のターミナルに表示
            if (!component && engineerId === 'system' && 
                (message.includes('⚙️  パラメータ:') || 
                 message.includes('📂 ディレクトリ一覧:') || 
                 message.includes('📄 ファイル内容:') ||
                 message.includes('✅ 実行結果:') ||
                 message.includes('📊 結果:')) &&
                lastToolExecutor) {
                terminalId = lastToolExecutor;
            }

            const terminal = terminals[terminalId];
            if (terminal) {
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
        });

        // 構造化ログデータの受信
        window.electronAPI.onStructuredLogData((data) => {
            console.log('[Renderer] Received structured log data:', data);
            const { executor, level, message, timestamp, context } = data;
            
            // ターミナルIDを決定
            const terminalId = getTerminalIdFromStructuredLog(executor, context);
            
            // ツール実行のログの場合、実行者を記録
            if (context?.toolName) {
                lastToolExecutor = terminalId;
            }
            
            // ログメッセージを表示
            displayStructuredLogMessage(terminalId, level, message, timestamp, context);
        });

        // レイアウト更新
        window.electronAPI.onLayoutUpdate((engineerCount) => {
            createEngineerTerminals(engineerCount);
            document.getElementById('engineer-count').textContent = `Engineers: ${engineerCount}`;
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

        // TechLeadとEngineerの関連付け
        window.electronAPI.onAssociateTechLeadEngineer((data) => {
            const { techLeadId, engineerId } = data;
            console.log(`[Renderer] ========== ASSOCIATION EVENT ==========`);
            console.log(`[Renderer] Associating TechLead ${techLeadId} with Engineer ${engineerId}`);
            console.log(`[Renderer] Current mappings:`);
            console.log(`[Renderer] - techLeadToEngineerMapping:`, techLeadToEngineerMapping);
            console.log(`[Renderer] - engineerPairMapping:`, engineerPairMapping);
            console.log(`[Renderer] - techLeadTerminalMapping:`, techLeadTerminalMapping);
            
            window.associateTechLeadWithEngineer(techLeadId, engineerId);
            
            console.log(`[Renderer] After association:`);
            console.log(`[Renderer] - techLeadToEngineerMapping:`, techLeadToEngineerMapping);
            console.log(`[Renderer] - techLeadTerminalMapping:`, techLeadTerminalMapping);
            console.log(`[Renderer] ========================================`);
        });
    } else {
        console.error('[Renderer] window.electronAPI is not available!');
        console.log('[Renderer] This means preload script did not load correctly');
        
        // フォールバック: 直接ipcRendererを使用してみる
        try {
            const { ipcRenderer } = require('electron');
            console.log('[Renderer] Using direct ipcRenderer as fallback');
            
            // レガシーログデータ
            ipcRenderer.on('log-data', (event, data) => {
                const { engineerId, level, message, component, timestamp } = data;
                
                // ターミナルIDのマッピング
                let terminalId;
                
                // コンポーネント名でマッピング
                if (component === 'ProductOwner' || component === 'Analysis') {
                    terminalId = 'product-owner';
                } else if (component === 'TechLead') {
                    terminalId = 'tech-lead';
                } else if (component === 'MergeCoordinator') {
                    terminalId = 'merge-coordinator';
                } else if (component === 'System' || component === 'Orchestrator') {
                    // システムメッセージはmerge-coordinatorに表示
                    terminalId = 'merge-coordinator';
                } else if (engineerId && engineerId.startsWith('engineer-')) {
                    // エンジニアAIのログ
                    terminalId = getOrCreateEngineerTerminalId(engineerId);
                } else {
                    // デフォルトはmerge-coordinator
                    terminalId = 'merge-coordinator';
                }

                // ツール実行のログの場合、実行者を記録
                if (message.includes('🛠️') && message.includes('ツール実行')) {
                    lastToolExecutor = terminalId;
                }
                
                // ツール実行結果など、コンポーネントが不明な場合は最後のツール実行者のターミナルに表示
                if (!component && engineerId === 'system' && 
                    (message.includes('⚙️  パラメータ:') || 
                     message.includes('📂 ディレクトリ一覧:') || 
                     message.includes('📄 ファイル内容:') ||
                     message.includes('✅ 実行結果:') ||
                     message.includes('📊 結果:')) &&
                    lastToolExecutor) {
                    terminalId = lastToolExecutor;
                }

                const terminal = terminals[terminalId];
                if (terminal) {
                    const time = new Date(timestamp).toLocaleTimeString();
                    let colorCode = '\x1b[37m';
                    
                    switch (level) {
                        case 'error':
                            colorCode = '\x1b[31m';
                            break;
                        case 'warn':
                            colorCode = '\x1b[33m';
                            break;
                        case 'success':
                            colorCode = '\x1b[32m';
                            break;
                        case 'info':
                            colorCode = '\x1b[36m';
                            break;
                        case 'debug':
                            colorCode = '\x1b[90m';
                            break;
                    }

                    const logLine = `\x1b[90m[${time}]\x1b[0m ${colorCode}${message}\x1b[0m`;
                    terminal.writeln(logLine);
                }
            });
            
            // 構造化ログデータ
            ipcRenderer.on('structured-log-data', (event, data) => {
                console.log('[Renderer] Received structured log data (fallback):', data);
                const { executor, level, message, timestamp, context } = data;
                
                // ターミナルIDを決定
                const terminalId = getTerminalIdFromStructuredLog(executor, context);
                
                // ツール実行のログの場合、実行者を記録
                if (context?.toolName) {
                    lastToolExecutor = terminalId;
                }
                
                // ログメッセージを表示
                displayStructuredLogMessage(terminalId, level, message, timestamp, context);
            });
            // レイアウト更新
            ipcRenderer.on('layout-update', (event, engineerCount) => {
                createEngineerTerminals(engineerCount);
                document.getElementById('engineer-count').textContent = `Engineers: ${engineerCount}`;
            });

            // タスクステータス更新
            ipcRenderer.on('task-status-update', (event, data) => {
                const { completed, total } = data;
                document.getElementById('task-status').textContent = `Tasks: ${completed}/${total}`;
            });
            
            // TechLeadとEngineerの関連付け (フォールバック)
            ipcRenderer.on('associate-techlead-engineer', (event, data) => {
                const { techLeadId, engineerId } = data;
                console.log(`[Renderer] ========== ASSOCIATION EVENT (Fallback) ==========`);
                console.log(`[Renderer] Associating TechLead ${techLeadId} with Engineer ${engineerId}`);
                console.log(`[Renderer] Current mappings:`);
                console.log(`[Renderer] - techLeadToEngineerMapping:`, techLeadToEngineerMapping);
                console.log(`[Renderer] - engineerPairMapping:`, engineerPairMapping);
                console.log(`[Renderer] - techLeadTerminalMapping:`, techLeadTerminalMapping);
                
                window.associateTechLeadWithEngineer(techLeadId, engineerId);
                
                console.log(`[Renderer] After association:`);
                console.log(`[Renderer] - techLeadToEngineerMapping:`, techLeadToEngineerMapping);
                console.log(`[Renderer] - techLeadTerminalMapping:`, techLeadTerminalMapping);
                console.log(`[Renderer] ========================================`);
            });
        } catch (e) {
            console.error('[Renderer] Cannot use direct ipcRenderer:', e);
        }
    }
    } catch (error) {
        console.error('[Renderer] Error during initialization:', error);
    }
});