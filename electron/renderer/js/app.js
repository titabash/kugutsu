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

// エンジニアIDのマッピング（タスクID → 連番）
const engineerIdMapping = {};
let engineerCounter = 0;

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

// エンジニアターミナルの動的作成
function createEngineerTerminals(count) {
    const container = document.getElementById('engineer-panes');
    container.innerHTML = '';

    const engineerTerminals = [];

    for (let i = 1; i <= count; i++) {
        const paneDiv = document.createElement('div');
        paneDiv.id = `engineer-${i}-pane`;
        paneDiv.className = 'terminal-pane engineer';
        paneDiv.innerHTML = `
            <div class="terminal-header">
                <span class="terminal-title">👨‍💻 Engineer AI #${i}</span>
                <div class="terminal-actions">
                    <span class="terminal-action" data-terminal="engineer-${i}">Clear</span>
                </div>
            </div>
            <div class="terminal-container" id="engineer-${i}-terminal"></div>
        `;
        container.appendChild(paneDiv);
        engineerTerminals.push(`#engineer-${i}-pane`);

        // ターミナルを初期化
        setTimeout(() => {
            initializeTerminal(
                `engineer-${i}`,
                document.getElementById(`engineer-${i}-terminal`),
                themes.engineer
            );
        }, 100);
    }

    // Split.jsで動的に分割
    if (engineerTerminals.length > 1) {
        Split(engineerTerminals, {
            sizes: Array(count).fill(100 / count),
            minSize: 200,
            gutterSize: 5,
            cursor: 'col-resize'
        });
    }
}

// ターミナルクリア
function clearTerminal(id) {
    const terminal = terminals[id];
    if (terminal) {
        terminal.clear();
    }
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
        'tech-lead',
        document.getElementById('tech-lead-terminal'),
        themes.techLead
    );

    initializeTerminal(
        'merge-coordinator',
        document.getElementById('merge-coordinator-terminal'),
        themes.mergeCoordinator
    );

    // Split.jsでペイン分割を設定
    Split(['#product-owner-pane', '#tech-lead-pane'], {
        sizes: [50, 50],
        minSize: 200,
        gutterSize: 5,
        cursor: 'col-resize'
    });

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
        
        // ログデータの受信
        window.electronAPI.onLogData((data) => {
            console.log('[Renderer] Received log data:', data);
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
                // タスクIDベースのIDを連番にマッピング
                if (!engineerIdMapping[engineerId]) {
                    // 新しいエンジニアの場合、次の連番を割り当て
                    engineerCounter++;
                    engineerIdMapping[engineerId] = `engineer-${engineerCounter}`;
                }
                terminalId = engineerIdMapping[engineerId];
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
    } else {
        console.error('[Renderer] window.electronAPI is not available!');
        console.log('[Renderer] This means preload script did not load correctly');
        
        // フォールバック: 直接ipcRendererを使用してみる
        try {
            const { ipcRenderer } = require('electron');
            console.log('[Renderer] Using direct ipcRenderer as fallback');
            
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
                    // タスクIDベースのIDを連番にマッピング
                    if (!engineerIdMapping[engineerId]) {
                        // 新しいエンジニアの場合、次の連番を割り当て
                        engineerCounter++;
                        engineerIdMapping[engineerId] = `engineer-${engineerCounter}`;
                    }
                    terminalId = engineerIdMapping[engineerId];
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
        } catch (e) {
            console.error('[Renderer] Cannot use direct ipcRenderer:', e);
        }
    }
    } catch (error) {
        console.error('[Renderer] Error during initialization:', error);
    }
});