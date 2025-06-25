import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { StructuredLogMessage } from '../types/logging.js';

// ESM用の__dirname代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ElectronLogMessage {
    engineerId: string;
    level: 'info' | 'error' | 'warn' | 'debug' | 'success';
    message: string;
    component?: string;
    timestamp: Date;
}

export class ElectronLogAdapter {
    private electronProcess: ChildProcess | null = null;
    private isElectronMode: boolean = false;
    private messageQueue: ElectronLogMessage[] = [];
    private structuredMessageQueue: StructuredLogMessage[] = [];
    private isReady: boolean = false;
    private static instance: ElectronLogAdapter | null = null;

    private constructor() {
        // デフォルトでElectronモードを有効化（--no-electronフラグで無効化可能）
        this.isElectronMode = !process.argv.includes('--no-electron');
    }

    static getInstance(): ElectronLogAdapter {
        if (!ElectronLogAdapter.instance) {
            ElectronLogAdapter.instance = new ElectronLogAdapter();
        }
        return ElectronLogAdapter.instance;
    }

    async initialize() {
        if (!this.isElectronMode) {
            return;
        }

        // console.logのインターセプトを先に設定
        this.interceptConsoleLogs();

        console.log('⚡ Electron UI モードを初期化中...');
        
        try {
            // Electronプロセスを起動
            // ESMではrequire('electron')が使えないため、実際のElectron実行ファイルのパスを構築
            // macOSの場合のパス
            const electronExecutable = process.platform === 'darwin'
                ? path.join(__dirname, '../../node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')
                : path.join(__dirname, '../../node_modules/.bin/electron');
            const electronAppPath = path.join(__dirname, '../../electron');
            
            console.log('📱 Electronアプリを起動中...');
            console.log(`   実行ファイル: ${electronExecutable}`);
            console.log(`   アプリケーションパス: ${electronAppPath}`);
            
            // コマンドライン引数から--devtoolsフラグを探す
            const extraArgs: string[] = [];
            if (process.argv.includes('--devtools')) {
                extraArgs.push('--devtools');
                console.log('🔧 DevToolsモードが有効です');
            }
            
            this.electronProcess = spawn(electronExecutable as string, [electronAppPath, ...extraArgs], {
                stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
                env: { ...process.env },
                cwd: electronAppPath
            });

            this.electronProcess.on('message', (msg: any) => {
                if (msg.type === 'ready') {
                    console.log('✅ Electron UIが起動しました');
                    this.isReady = true;
                    this.flushMessageQueue();
                    this.flushStructuredMessageQueue();
                }
            });

            this.electronProcess.stdout?.on('data', (data) => {
                console.log(`[Electron]: ${data.toString().trim()}`);
            });

            this.electronProcess.stderr?.on('data', (data) => {
                const message = data.toString().trim();
                // macOSのIMKメッセージは無視
                if (message.includes('IMKClient') || message.includes('IMKInputSession')) {
                    return;
                }
                console.error(`[Electron Error]: ${message}`);
            });

            this.electronProcess.on('error', (error: Error) => {
                console.error('❌ Electronプロセスエラー:', error);
                console.log('📌 注意: Electron UIモードは利用できません。通常のログ出力にフォールバックします。');
                this.isElectronMode = false;
            });

            this.electronProcess.on('exit', (code: number) => {
                console.log(`Electronプロセスが終了しました (code: ${code})`);
                this.isElectronMode = false;
            });

            // Electronが起動するまで待機
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // 起動確認
            if (this.electronProcess && !this.electronProcess.killed) {
                console.log('🖥️  Electron UIが正常に起動しました');
                this.isReady = true;
                this.flushMessageQueue();
                this.flushStructuredMessageQueue();
            }

        } catch (error) {
            console.error('❌ Electronの起動に失敗しました:', error);
            console.log('📌 ヒント: "npm run build" でTypeScriptをコンパイルしてから実行してください');
            console.log('📌 注意: Electron UIモードは利用できません。通常のログ出力にフォールバックします。');
            this.isElectronMode = false;
        }
    }

    log(engineerId: string, level: 'info' | 'error' | 'warn' | 'debug' | 'success', message: string, component?: string) {
        const logMessage: ElectronLogMessage = {
            engineerId,
            level,
            message,
            component,
            timestamp: new Date()
        };

        if (this.isElectronMode) {
            if (this.isReady && this.electronProcess) {
                this.sendToElectron(logMessage);
            } else {
                this.messageQueue.push(logMessage);
            }
        } else {
            // Electronモードでない場合のみコンソールに出力
            this.consoleLog(level, message, engineerId, component);
        }
    }

    private sendToElectron(logMessage: ElectronLogMessage) {
        if (this.electronProcess && !this.electronProcess.killed) {
            try {
                // console.log('[ElectronLogAdapter] Sending log to Electron:', logMessage);
                this.electronProcess.send({
                    type: 'log',
                    data: logMessage
                });
            } catch (error) {
                console.error('[ElectronLogAdapter] Failed to send log to Electron:', error);
            }
        } else {
            // console.warn('[ElectronLogAdapter] Cannot send log - process not available');
        }
    }

    private flushMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (message) {
                this.sendToElectron(message);
            }
        }
    }

    private flushStructuredMessageQueue() {
        while (this.structuredMessageQueue.length > 0) {
            const message = this.structuredMessageQueue.shift();
            if (message) {
                this.sendStructuredToElectron(message);
            }
        }
    }

    private originalLog = console.log;
    private originalError = console.error;
    private originalWarn = console.warn;

    private consoleLog(level: string, message: string, engineerId: string, component?: string) {
        // オリジナルのconsole関数を使用して無限ループを防ぐ
        switch (level) {
            case 'error':
                this.originalError(message);
                break;
            case 'warn':
                this.originalWarn(message);
                break;
            default:
                this.originalLog(message);
        }
    }

    // グローバルなconsole.logをインターセプト
    interceptConsoleLogs() {
        if (!this.isElectronMode) {
            return;
        }

        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        console.log = (...args: any[]) => {
            originalLog.apply(console, args);
            const message = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            
            // エンジニアIDとコンポーネントを推測
            let engineerId = 'system';
            let component: string | undefined = undefined;
            
            // ログメッセージからコンポーネントを特定
            if (message.includes('🧠') || message.includes('💭') || message.includes('プロダクトオーナーAI')) {
                engineerId = 'ProductOwner';
                component = 'ProductOwner';
            } else if (message.includes('🔍') || message.includes('👀') || message.includes('テックリードAI') || message.includes('TechLeadAI')) {
                // TechLeadのログを検出
                const match = message.match(/テックリードAI\[([^\]]+)\]|TechLeadAI\[([^\]]+)\]/);
                if (match) {
                    engineerId = match[1] || match[2];
                    component = 'TechLead';
                } else {
                    engineerId = 'TechLead';
                    component = 'TechLead';
                }
            } else if (message.includes('👨‍💻') || message.includes('エンジニアAI[')) {
                const match = message.match(/エンジニアAI\[([^\]]+)\]/);
                if (match) {
                    engineerId = match[1];
                    component = 'Engineer';
                }
            } else if (message.includes('🛠️') && message.includes('ツール実行')) {
                // ツール実行のログ - 直前のコンポーネントを使用
                // "🛠️  プロダクトオーナーAI: ツール実行 - TodoWrite" のようなパターン
                if (message.includes('プロダクトオーナーAI')) {
                    engineerId = 'ProductOwner';
                    component = 'ProductOwner';
                } else if (message.includes('テックリードAI')) {
                    const match = message.match(/テックリードAI\[([^\]]+)\]/);
                    if (match) {
                        engineerId = match[1];
                        component = 'TechLead';
                    } else {
                        engineerId = 'TechLead';
                        component = 'TechLead';
                    }
                } else if (message.includes('エンジニアAI[')) {
                    const match = message.match(/エンジニアAI\[([^\]]+)\]/);
                    if (match) {
                        engineerId = match[1];
                        component = 'Engineer';
                    }
                }
            } else if (message.includes('⚙️  パラメータ:') || message.includes('📂 ディレクトリ一覧:') || message.includes('📄 ファイル内容:')) {
                // ツール実行結果の詳細 - これも前のコンポーネントと同じところに表示
                // コンポーネントは推測できないので、後でapp.jsで処理
            } else if (message.includes('🔧') || message.includes('マージコーディネーター')) {
                component = 'MergeCoordinator';
            } else if (message.includes('🌿') || message.includes('Worktree')) {
                component = 'GitWorktree';
            } else if (message.includes('[') && message.includes(']')) {
                const match = message.match(/\[([^\]]+)\]/);
                if (match) {
                    const possibleComponent = match[1];
                    if (['System', 'Orchestrator', 'Analysis', 'GitWorktree', 'MergeCoordinator'].includes(possibleComponent)) {
                        component = possibleComponent;
                    }
                }
            }
            
            // ElectronLogAdapter自身のログは送信しない（無限ループ防止）
            if (!message.includes('[ElectronLogAdapter]') && 
                !message.includes('[Electron Main]') && 
                !message.includes('[Electron]:') &&
                !message.includes('[Electron Error]:') &&
                !message.includes('Sending log to Electron:')) {
                this.log(engineerId, 'info', message, component);
            }
        };

        console.error = (...args: any[]) => {
            originalError.apply(console, args);
            const message = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            
            if (!message.includes('[ElectronLogAdapter]')) {
                this.log('system', 'error', message);
            }
        };

        console.warn = (...args: any[]) => {
            originalWarn.apply(console, args);
            const message = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            
            if (!message.includes('[ElectronLogAdapter]')) {
                this.log('system', 'warn', message);
            }
        };
    }

    updateEngineerCount(count: number) {
        if (this.isElectronMode && this.electronProcess && !this.electronProcess.killed) {
            try {
                this.electronProcess.send({
                    type: 'update-engineer-count',
                    data: count
                });
            } catch (error) {
                console.error('Failed to update engineer count:', error);
            }
        }
    }

    logStructured(structuredLog: StructuredLogMessage) {
        if (this.isElectronMode) {
            if (this.isReady && this.electronProcess) {
                this.sendStructuredToElectron(structuredLog);
            } else {
                this.structuredMessageQueue.push(structuredLog);
            }
        }
        
        // コンソールにも出力（後方互換性のため）
        this.consoleLog(structuredLog.level, structuredLog.message, structuredLog.executor.id, structuredLog.executor.type);
    }

    private sendStructuredToElectron(structuredLog: StructuredLogMessage) {
        if (this.electronProcess && !this.electronProcess.killed) {
            try {
                this.electronProcess.send({
                    type: 'structured-log',
                    data: structuredLog
                });
            } catch (error) {
                console.error('[ElectronLogAdapter] Failed to send structured log to Electron:', error);
            }
        }
    }

    /**
     * Electronプロセスを停止
     */
    stop() {
        if (this.electronProcess && !this.electronProcess.killed) {
            console.log('🛑 Electronプロセスを停止中...');
            this.electronProcess.kill('SIGTERM');
            this.electronProcess = null;
            this.isElectronMode = false;
            this.isReady = false;
        }
    }

    updateTaskStatus(completed: number, total: number) {
        if (this.isElectronMode && this.electronProcess && !this.electronProcess.killed) {
            try {
                this.electronProcess.send({
                    type: 'update-task-status',
                    data: { completed, total }
                });
            } catch (error) {
                console.error('Failed to update task status:', error);
            }
        }
    }

    associateTechLeadWithEngineer(techLeadId: string, engineerId: string) {
        console.log(`[ElectronLogAdapter] associateTechLeadWithEngineer called: ${techLeadId} -> ${engineerId}`);
        
        if (this.isElectronMode && this.electronProcess && !this.electronProcess.killed) {
            try {
                console.log('[ElectronLogAdapter] Sending association to Electron main process');
                this.electronProcess.send({
                    type: 'associate-techlead-engineer',
                    data: { techLeadId, engineerId }
                });
            } catch (error) {
                console.error('Failed to associate TechLead with Engineer:', error);
            }
        } else {
            console.warn('[ElectronLogAdapter] Cannot send association - Electron not available');
            console.log(`  isElectronMode: ${this.isElectronMode}`);
            console.log(`  electronProcess: ${this.electronProcess}`);
            console.log(`  killed: ${this.electronProcess?.killed}`);
        }
    }

    destroy() {
        if (this.electronProcess && !this.electronProcess.killed) {
            console.log('🔌 Electron UIを終了中...');
            this.electronProcess.kill();
        }
    }
}

// シングルトンインスタンス
export const electronLogAdapter = ElectronLogAdapter.getInstance();