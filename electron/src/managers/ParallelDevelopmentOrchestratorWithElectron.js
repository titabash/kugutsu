import { ParallelDevelopmentOrchestrator } from './ParallelDevelopmentOrchestrator.js';
import { electronLogAdapter } from '../utils/ElectronLogAdapter.js';
import { CompletionReporter } from '../utils/CompletionReporter.js';
import * as path from 'path';
/**
 * Electron対応並列開発オーケストレーター
 * ParallelDevelopmentOrchestratorを継承し、Electronログ表示に対応
 */
export class ParallelDevelopmentOrchestratorWithElectron extends ParallelDevelopmentOrchestrator {
    useElectronUI;
    totalTaskCount = 0;
    constructor(config, useVisualUI = false, useElectronUI = false) {
        // ElectronUI使用時は既存のVisualUIを無効化
        super(config, useVisualUI && !useElectronUI);
        this.useElectronUI = useElectronUI;
        if (this.useElectronUI) {
            // Electronアダプターを初期化（ベースリポジトリパスを渡す）
            electronLogAdapter.initialize(config.baseRepoPath);
        }
    }
    /**
     * ログ出力メソッド（Electron対応版）
     * 親クラスのlogメソッドをオーバーライド
     */
    log(engineerId, level, message, component, group) {
        // タスク解析完了を検知してタスク数を更新
        if (this.useElectronUI && engineerId === 'ProductOwner' && message.includes('タスク数:')) {
            const match = message.match(/タスク数: (\d+)/);
            if (match) {
                this.totalTaskCount = parseInt(match[1], 10);
                electronLogAdapter.updateTaskStatus(0, this.totalTaskCount);
            }
        }
        if (this.useElectronUI) {
            // Electronにログを送信
            electronLogAdapter.log(engineerId, level, message, component);
        }
        else {
            // 親クラスのログメソッドを呼び出す
            super.log(engineerId, level, message, component, group);
        }
    }
    /**
     * イベントリスナーの設定（Electron対応版）
     * 親クラスのsetupEventListenersメソッドをオーバーライド
     */
    setupEventListeners() {
        super.setupEventListeners();
        if (this.useElectronUI) {
            this.setupTaskMessageHandlers();
            // タスク完了時にElectronに通知
            this.eventEmitter.onMergeCompleted((event) => {
                const completedCount = this.completedTasks.size;
                electronLogAdapter.updateTaskStatus(completedCount, this.totalTaskCount);
            });
            // タスク失敗時にElectronに通知
            this.eventEmitter.onTaskFailed((event) => {
                const completedCount = this.completedTasks.size + this.failedTasks.size;
                electronLogAdapter.updateTaskStatus(completedCount, this.totalTaskCount);
            });
            // 注意: 全タスク完了イベントは親クラスで処理され、setupCompletionReporterListenersで
            // CompletionReporterから直接受信するため、ここでは重複登録しない
            // 開発完了時にエンジニア数を更新
            this.eventEmitter.onDevelopmentCompleted((event) => {
                // パイプラインマネージャーの統計情報から取得
                if (this.pipelineManager) {
                    const stats = this.pipelineManager.getStats();
                    const activeEngineers = stats.development.processing;
                    electronLogAdapter.updateEngineerCount(activeEngineers);
                }
            });
            // 定期的にステータスを更新
            const updateInterval = setInterval(() => {
                if (this.pipelineManager) {
                    const stats = this.pipelineManager.getStats();
                    const activeEngineers = stats.development.processing;
                    electronLogAdapter.updateEngineerCount(activeEngineers);
                    // タスクステータスも更新
                    const completedCount = this.completedTasks.size + this.failedTasks.size;
                    electronLogAdapter.updateTaskStatus(completedCount, this.totalTaskCount);
                }
            }, 1000); // 1秒ごとに更新
            // クリーンアップ時にインターバルをクリア
            this.eventEmitter.once('cleanup', () => {
                clearInterval(updateInterval);
            });
        }
    }
    /**
     * 開発開始時にElectronに初期状態を通知
     */
    async executeUserRequest(userRequest) {
        this.log('system', 'info', '🚀 並列開発システム開始', 'System', 'System Startup');
        this.log('system', 'info', `📝 ユーザー要求: ${userRequest}`, 'System', 'System Startup');
        if (this.useElectronUI) {
            // 初期状態をElectronに通知
            electronLogAdapter.updateTaskStatus(0, 0);
            electronLogAdapter.updateEngineerCount(0);
        }
        try {
            // ログビューアーを開始
            if (this.logViewer) {
                this.logViewer.start();
            }
            // 1. プロダクトオーナーAIによる要求分析
            this.log('ProductOwner', 'info', '📊 フェーズ1: 要求分析', 'Analysis', 'Phase 1: Analysis');
            const analysis = await this.productOwnerAI.analyzeUserRequestWithInstructions(userRequest);
            this.log('ProductOwner', 'info', `📋 分析結果:`, 'Analysis', 'Phase 1: Analysis');
            this.log('ProductOwner', 'info', `- 概要: ${analysis.summary}`, 'Analysis', 'Phase 1: Analysis');
            this.log('ProductOwner', 'info', `- タスク数: ${analysis.tasks.length}`, 'Analysis', 'Phase 1: Analysis');
            this.log('ProductOwner', 'info', `- リスク: ${analysis.riskAssessment}`, 'Analysis', 'Phase 1: Analysis');
            // 現在のprojectIdをElectronに送信
            if (this.useElectronUI && analysis.projectId) {
                electronLogAdapter.sendMessage('set-current-project-id', analysis.projectId);
            }
            // 2. CompletionReporterを初期化（プロジェクトIDを使用）
            if (analysis.projectId) {
                this.completionReporter = new CompletionReporter(this.kugutsuDir, analysis.projectId);
                // PipelineManagerにCompletionReporterを設定
                this.pipelineManager.setCompletionReporter(this.completionReporter);
            }
            else {
                // フォールバック: 既存のプロジェクトIDを生成
                const projectId = `parallel-dev-${Date.now()}`;
                this.completionReporter = new CompletionReporter(this.kugutsuDir, projectId);
                this.pipelineManager.setCompletionReporter(this.completionReporter);
            }
            const taskTitles = analysis.tasks.map(t => t.title);
            await this.completionReporter.initialize(taskTitles);
            this.log('system', 'info', `📊 タスク完了レポーターを初期化 (${taskTitles.length}タスク)`, 'System', 'Initialization');
            // CompletionReporterのイベントリスナーを設定（サブクラスでオーバーライド可能）
            this.setupCompletionReporterListeners();
            // 3. タスクの依存関係を初期化
            this.log('system', 'info', '🔗 フェーズ2: 依存関係の初期化', 'Orchestrator', 'Phase 2: Dependencies');
            this.log('system', 'info', `📋 初期化するタスク数: ${analysis.tasks.length}`, 'Orchestrator', 'Phase 2: Dependencies');
            for (const task of analysis.tasks) {
                this.log('system', 'info', `  - ${task.title} (ID: ${task.id}, 依存: ${task.dependencies.join(', ') || 'なし'})`, 'Orchestrator', 'Phase 2: Dependencies');
            }
            await this.pipelineManager.initializeTasks(analysis.tasks);
            this.log('ProductOwner', 'info', `🔗 依存関係グラフ構築完了`, 'Dependencies', 'Phase 2: Dependencies');
            // 4. パイプラインマネージャーを開始
            this.log('system', 'info', '🏗️ フェーズ3: 並列パイプライン開始', 'Orchestrator', 'Phase 3: Pipeline');
            await this.pipelineManager.start();
            // 5. 全タスクを内部状態に登録（依存関係によって自動的にキューに投入される）
            this.log('system', 'info', '⚡ フェーズ4: タスク登録', 'Orchestrator', 'Phase 4: Task Registration');
            for (const task of analysis.tasks) {
                this.activeTasks.set(task.id, task);
                this.log('system', 'info', `📥 タスク登録: ${task.title}`, 'Pipeline', 'Task Registration');
            }
            // Electronにタスクデータを送信
            if (this.useElectronUI) {
                await this.onTaskAnalysisComplete(analysis);
            }
            // 6. 全パイプラインの完了を待機
            this.log('system', 'info', '⏳ フェーズ5: パイプライン完了待機', 'Orchestrator', 'Phase 5: Waiting');
            await this.pipelineManager.waitForCompletion();
            // 7. 結果の集計
            this.log('system', 'info', '📊 フェーズ6: 結果集計', 'Orchestrator', 'Phase 6: Results');
            // 結果のまとめ
            const results = Array.from(this.taskResults.values());
            const reviewResults = Array.from(this.reviewResults.values());
            const completedTasks = Array.from(this.completedTasks);
            const failedTasks = Array.from(this.failedTasks.keys());
            // 7. 最終結果の集計
            this.log('system', 'info', '📊 最終結果集計', 'Orchestrator', 'Final Results');
            this.log('system', 'success', `✅ 完了タスク: ${completedTasks.length}件`, 'Orchestrator', 'Final Results');
            this.log('system', 'error', `❌ 失敗タスク: ${failedTasks.length}件`, 'Orchestrator', 'Final Results');
            if (failedTasks.length > 0) {
                this.log('system', 'error', '失敗タスク詳細:', 'Orchestrator', 'Final Results');
                for (const taskId of failedTasks) {
                    const reason = this.failedTasks.get(taskId) || '不明';
                    const task = this.activeTasks.get(taskId);
                    const taskTitle = task ? task.title : 'タスク名不明';
                    this.log('system', 'error', `  - ${taskTitle}: ${reason}`, 'Orchestrator', 'Final Results');
                }
            }
            this.log('system', 'success', '🎉 並列開発システム完了', 'Orchestrator', 'Final Results');
            return {
                analysis,
                results,
                reviewResults,
                completedTasks,
                failedTasks
            };
        }
        catch (error) {
            this.log('system', 'error', `エラーが発生しました: ${error}`, 'Orchestrator', 'Error');
            throw error;
        }
        finally {
            await this.cleanup();
        }
    }
    /**
     * クリーンアップ処理
     */
    async cleanup(cleanupWorktrees = false) {
        await super.cleanup(cleanupWorktrees);
    }
    /**
     * CompletionReporterのイベントリスナーを設定
     * executeUserRequest内でinitialize後に呼び出される
     */
    setupCompletionReporterListeners() {
        console.log(`[Electron] setupCompletionReporterListeners called. useElectronUI=${this.useElectronUI}, completionReporter=${!!this.completionReporter}`);
        if (this.useElectronUI && this.completionReporter) {
            console.log('[Electron] Setting up CompletionReporter listeners...');
            // 既存のリスナーを削除（CompletionReporter上のリスナーのみ）
            this.completionReporter.removeAllListeners('taskCompleted');
            this.completionReporter.removeAllListeners('allTasksCompleted');
            // タスク完了イベントをリッスン
            this.completionReporter.on('taskCompleted', ({ taskId, status }) => {
                console.log(`[Electron] Task completed event received: ${taskId} (${status.completedTasks}/${status.totalTasks})`);
                // Electron UIに進捗を通知
                electronLogAdapter.updateTaskStatus(status.completedTasks, status.totalTasks);
                this.log('system', 'success', `✅ タスク完了: ${taskId} (${status.completedTasks}/${status.totalTasks} - ${status.percentage}%)`, 'System');
            });
            // 全タスク完了イベント: CompletionReporterから直接受信してElectronに通知
            this.completionReporter.on('allTasksCompleted', (status) => {
                console.log('[Electron] All tasks completed event from CompletionReporter:', status);
                console.log('[Electron] Sending completion notification to Electron UI...');
                // Electronログにも表示
                electronLogAdapter.log('system', 'success', `🎉 全タスクが完了しました！ (${status.completedTasks}/${status.totalTasks} - ${status.percentage}%)`, 'System');
                // Electron UIに完了通知を送信
                electronLogAdapter.sendCompletionNotification(status);
                console.log('[Electron] Completion notification sent successfully');
            });
            console.log('[Electron] CompletionReporter listeners setup complete');
        }
        else {
            console.log('[Electron] Skipping CompletionReporter listener setup');
            console.log(`  useElectronUI: ${this.useElectronUI}`);
            console.log(`  completionReporter: ${!!this.completionReporter}`);
        }
    }
    /**
     * ログビューアーの停止（Electron対応版）
     */
    stopLogViewer() {
        super.stopLogViewer();
        // Electronの場合は特に何もしない（ウィンドウは別プロセスで管理）
    }
    /**
     * タスク関連のメッセージハンドラーを設定
     */
    setupTaskMessageHandlers() {
        if (!this.useElectronUI)
            return;
        // Electronプロセスからのメッセージを処理
        electronLogAdapter.onMessage('get-tasks', async () => {
            const tasks = Array.from(this.activeTasks.values());
            electronLogAdapter.sendMessage('tasks-response', tasks);
        });
        electronLogAdapter.onMessage('get-task-overview', async () => {
            const overview = await this.getTaskOverview();
            electronLogAdapter.sendMessage('task-overview-response', overview);
        });
        electronLogAdapter.onMessage('get-task-instruction', async (taskId) => {
            const instruction = await this.getTaskInstruction(taskId);
            electronLogAdapter.sendMessage('task-instruction-response', instruction, taskId);
        });
    }
    /**
     * タスクオーバービューを取得
     */
    async getTaskOverview() {
        // .kugutsuディレクトリからタスクオーバービューを取得
        try {
            const kugutsuDir = path.join(this.config.baseRepoPath, '.kugutsu');
            const fs = await import('fs/promises');
            // 最新のプロジェクトのオーバービューを探す
            const projectsDir = path.join(kugutsuDir, 'projects');
            const projectDirs = await fs.readdir(projectsDir).catch(() => []);
            for (const projectId of projectDirs.reverse()) {
                const overviewPath = path.join(projectsDir, projectId, 'instructions', 'task-overview.md');
                try {
                    const content = await fs.readFile(overviewPath, 'utf-8');
                    return content;
                }
                catch {
                    // 次のプロジェクトを試す
                }
            }
            return '';
        }
        catch (error) {
            console.error('[Electron] Error reading task overview:', error);
            return '';
        }
    }
    /**
     * タスク指示ファイルを取得
     */
    async getTaskInstruction(taskId) {
        const task = this.activeTasks.get(taskId);
        if (!task)
            return '';
        try {
            const fs = await import('fs/promises');
            // TaskInstructionManagerで作成されたファイルのパスを取得
            const instructionPath = task.instructionFile;
            if (instructionPath) {
                const content = await fs.readFile(instructionPath, 'utf-8');
                return content;
            }
            // フォールバック: .kugutsuディレクトリから探す
            const kugutsuDir = path.join(this.config.baseRepoPath, '.kugutsu');
            const sanitizedTitle = task.title
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .slice(0, 30);
            const fileName = `task-${task.id.split('-')[0]}-${sanitizedTitle}.md`;
            // プロジェクトディレクトリを探す
            const projectsDir = path.join(kugutsuDir, 'projects');
            const projectDirs = await fs.readdir(projectsDir).catch(() => []);
            for (const projectId of projectDirs.reverse()) {
                const fallbackPath = path.join(projectsDir, projectId, 'instructions', fileName);
                try {
                    const content = await fs.readFile(fallbackPath, 'utf-8');
                    return content;
                }
                catch {
                    // 次のプロジェクトを試す
                }
            }
            return '';
        }
        catch (error) {
            console.error(`[Electron] Error reading task instruction for ${taskId}:`, error);
            return '';
        }
    }
    /**
     * タスク分析完了時にElectronに通知
     */
    async onTaskAnalysisComplete(analysis) {
        if (this.useElectronUI) {
            // タスク一覧を更新
            const tasks = analysis.tasks;
            tasks.forEach(task => this.activeTasks.set(task.id, task));
            // Electronに通知
            electronLogAdapter.sendMessage('tasks-updated', Array.from(this.activeTasks.values()));
            // オーバービューも更新通知
            const overview = await this.getTaskOverview();
            electronLogAdapter.sendMessage('task-overview-updated', overview);
        }
    }
}
//# sourceMappingURL=ParallelDevelopmentOrchestratorWithElectron.js.map