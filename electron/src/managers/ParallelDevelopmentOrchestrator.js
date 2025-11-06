import { ProductOwnerAI } from './ProductOwnerAI.js';
import { GitWorktreeManager } from './GitWorktreeManager.js';
import { ReviewWorkflow } from './ReviewWorkflow.js';
import { ParallelPipelineManager } from './ParallelPipelineManager.js';
import { ImprovedParallelLogViewer } from '../utils/ImprovedParallelLogViewer.js';
import { LogFormatter } from '../utils/LogFormatter.js';
import { TaskEventEmitter } from '../utils/TaskEventEmitter.js';
import { CompletionReporter } from '../utils/CompletionReporter.js';
import { MemoryMonitor } from '../utils/MemoryMonitor.js';
import * as path from 'path';
/**
 * 並列開発オーケストレーター
 * プロダクトオーナーAI、git worktree、エンジニアAIを統合管理
 */
export class ParallelDevelopmentOrchestrator {
    productOwnerAI;
    gitManager;
    reviewWorkflow;
    pipelineManager;
    config;
    engineerPool = new Map();
    activeTasks = new Map();
    logViewer;
    useVisualUI;
    eventEmitter;
    completedTasks = new Set();
    failedTasks = new Map();
    taskResults = new Map();
    reviewResults = new Map();
    completionReporter;
    kugutsuDir;
    listenerRegistrations = []; // イベントリスナー管理
    memoryMonitor;
    constructor(config, useVisualUI = false) {
        this.config = config;
        this.useVisualUI = useVisualUI;
        this.productOwnerAI = new ProductOwnerAI(config.baseRepoPath);
        this.gitManager = new GitWorktreeManager(config.baseRepoPath, config.worktreeBasePath, config.baseBranch);
        this.reviewWorkflow = new ReviewWorkflow(this.gitManager, config);
        // CompletionReporterを作成（projectIdは後で設定）
        const kugutsuDir = path.join(config.baseRepoPath, '.kugutsu');
        this.kugutsuDir = kugutsuDir;
        this.completionReporter = null; // 後でプロジェクトIDが確定してから初期化
        // PipelineManagerを作成（CompletionReporterは後で設定）
        this.pipelineManager = new ParallelPipelineManager(this.gitManager, config, null);
        this.eventEmitter = TaskEventEmitter.getInstance();
        // メモリ監視を初期化
        this.memoryMonitor = MemoryMonitor.getInstance();
        this.memoryMonitor.setThresholds(300 * 1024 * 1024, // 300MB警告
        800 * 1024 * 1024 // 800MB危険
        );
        if (this.useVisualUI) {
            this.logViewer = new ImprovedParallelLogViewer();
        }
        // イベントリスナーの設定
        this.setupEventListeners();
    }
    /**
     * イベントリスナーの設定
     */
    setupEventListeners() {
        console.log('🔧 ParallelDevelopmentOrchestrator イベントリスナー設定開始');
        // マージ完了イベント
        const mergeCompletedRegistration = this.eventEmitter.onMergeCompleted((event) => {
            const payload = event.payload;
            if (payload.success) {
                this.completedTasks.add(payload.task.id);
                this.log('system', 'success', `✅ タスク完了: ${payload.task.title}`, 'Merge', 'Completion');
            }
            else {
                this.failedTasks.set(payload.task.id, payload.error || 'マージに失敗しました');
                this.log('system', 'error', `❌ タスク失敗: ${payload.task.title}`, 'Merge', 'Failure');
            }
        });
        this.listenerRegistrations.push(mergeCompletedRegistration);
        // 全タスク完了イベントはCompletionReporterから直接受信するため、ここでは登録しない
        // setupCompletionReporterListeners()で処理される
        // タスク失敗イベント
        const taskFailedRegistration = this.eventEmitter.onTaskFailed((event) => {
            const payload = event.payload;
            this.failedTasks.set(payload.task.id, payload.error);
            this.log('system', 'error', `❌ タスク失敗: ${payload.task.title} (${payload.phase})`, 'Task', 'Failure');
        });
        this.listenerRegistrations.push(taskFailedRegistration);
        // タスクイベントの統計用
        const anyTaskEventRegistration = this.eventEmitter.onAnyTaskEvent((event) => {
            if (event.type === 'DEVELOPMENT_COMPLETED') {
                const result = event.payload.result;
                this.taskResults.set(event.taskId, result);
            }
            else if (event.type === 'REVIEW_COMPLETED') {
                const payload = event.payload;
                // レビュー履歴を保存
                const history = this.reviewResults.get(event.taskId) || [];
                history.push(payload.reviewResult);
                this.reviewResults.set(event.taskId, history);
            }
        });
        this.listenerRegistrations.push(anyTaskEventRegistration);
        console.log(`✅ ParallelDevelopmentOrchestrator イベントリスナー設定完了 (${this.listenerRegistrations.length}個)`);
    }
    /**
     * ユーザー要求を受け取り、並列開発を実行（レビュー含む）
     */
    async executeUserRequest(userRequest) {
        this.log('system', 'info', '🚀 並列開発システム開始', 'System', 'System Startup');
        this.log('system', 'info', `📝 ユーザー要求: ${userRequest}`, 'System', 'System Startup');
        try {
            // メモリ監視を開始
            this.memoryMonitor.start(20000); // 20秒間隔で監視
            this.memoryMonitor.showCurrentStatus();
            // ログビューアーを開始
            if (this.logViewer) {
                this.logViewer.start();
                this.updateMainInfo(`要求分析中... | ${new Date().toLocaleString()}`);
            }
            // 1. プロダクトオーナーAIによる要求分析
            this.log('ProductOwner', 'info', '📊 フェーズ1: 要求分析', 'Analysis', 'Phase 1: Analysis');
            const analysis = await this.productOwnerAI.analyzeUserRequestWithInstructions(userRequest);
            this.log('ProductOwner', 'info', `📋 分析結果:`, 'Analysis', 'Phase 1: Analysis');
            this.log('ProductOwner', 'info', `- 概要: ${analysis.summary}`, 'Analysis', 'Phase 1: Analysis');
            this.log('ProductOwner', 'info', `- タスク数: ${analysis.tasks.length}`, 'Analysis', 'Phase 1: Analysis');
            this.log('ProductOwner', 'info', `- リスク: ${analysis.riskAssessment}`, 'Analysis', 'Phase 1: Analysis');
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
            if (this.logViewer) {
                this.updateMainInfo(`並列パイプライン実行中... | タスク数: ${analysis.tasks.length} | ${new Date().toLocaleString()}`);
            }
            // 5. 全タスクを内部状態に登録（依存関係によって自動的にキューに投入される）
            this.log('system', 'info', '⚡ フェーズ4: タスク登録', 'Orchestrator', 'Phase 4: Task Registration');
            for (const task of analysis.tasks) {
                this.activeTasks.set(task.id, task);
                this.log('system', 'info', `📥 タスク登録: ${task.title}`, 'Pipeline', 'Task Registration');
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
            // パイプライン統計
            const pipelineStats = this.pipelineManager.getStats();
            this.log('system', 'info', `📊 パイプライン統計:`, 'Pipeline', 'Statistics');
            this.log('system', 'info', `  - 開発: 待機=${pipelineStats.development.waiting}, 処理中=${pipelineStats.development.processing}`, 'Pipeline', 'Statistics');
            this.log('system', 'info', `  - レビュー: 待機=${pipelineStats.review.waiting}, 処理中=${pipelineStats.review.processing}, 完了=${pipelineStats.review.totalReviewed}`, 'Pipeline', 'Statistics');
            this.log('system', 'info', `  - マージ: 待機=${pipelineStats.merge.queueLength}, 処理中=${pipelineStats.merge.isProcessing}`, 'Pipeline', 'Statistics');
            if (this.logViewer) {
                this.updateMainInfo(`完了 | 成功: ${completedTasks.length}件, 失敗: ${failedTasks.length}件 | ${new Date().toLocaleString()}`);
                this.logViewer.destroy();
            }
            // メモリ監視を停止
            this.memoryMonitor.stop();
            this.memoryMonitor.showCurrentStatus();
            // 完了レポートを表示・生成
            this.completionReporter.displayCompletionSummary(analysis, completedTasks, failedTasks, this.taskResults, this.reviewResults, userRequest);
            return { analysis, results, reviewResults, completedTasks, failedTasks };
        }
        catch (error) {
            this.log('system', 'error', `❌ 並列開発エラー: ${error instanceof Error ? error.message : String(error)}`, 'Orchestrator', 'System Error');
            throw error;
        }
    }
    /**
     * システムクリーンアップ
     */
    async cleanup(cleanupWorktrees = false) {
        console.log('🧹 ParallelDevelopmentOrchestrator システムクリーンアップ開始');
        // イベントリスナーを全て解除
        console.log(`🗑️ イベントリスナー解除: ${this.listenerRegistrations.length}個`);
        for (const registration of this.listenerRegistrations) {
            try {
                registration.unregister();
            }
            catch (error) {
                console.warn(`⚠️ リスナー解除エラー [${registration.event}][${registration.id}]:`, error);
            }
        }
        this.listenerRegistrations = [];
        // パイプラインマネージャーをクリーンアップ
        await this.pipelineManager.cleanup();
        // ログビューアーを停止
        if (this.logViewer) {
            this.logViewer.destroy();
            this.logViewer = undefined;
        }
        // アクティブなタスクをクリア
        this.activeTasks.clear();
        // エンジニアプールをクリア
        this.engineerPool.clear();
        // 結果マップをクリア
        this.taskResults.clear();
        this.reviewResults.clear();
        this.completedTasks.clear();
        this.failedTasks.clear();
        // Worktreeのクリーンアップ（オプション）
        if (cleanupWorktrees) {
            await this.gitManager.cleanupAllTaskWorktrees({ deleteBranches: true });
        }
        // CompletionReporterのクリーンアップ
        if (this.completionReporter && typeof this.completionReporter.cleanup === 'function') {
            await this.completionReporter.cleanup();
        }
        // メモリ監視を停止
        this.memoryMonitor.stop();
        // 強制ガベージコレクション
        if (global.gc) {
            console.log('🗑️ 強制ガベージコレクション実行');
            global.gc();
        }
        console.log('✅ ParallelDevelopmentOrchestrator クリーンアップ完了');
    }
    /**
     * CompletionReporterのイベントリスナーを設定
     * サブクラスでオーバーライドして拡張可能
     */
    setupCompletionReporterListeners() {
        // デフォルトでは何もしない（サブクラスで実装）
    }
    /**
     * 現在のシステム状態を取得
     */
    getSystemStatus() {
        return {
            activeTasks: Array.from(this.activeTasks.values()),
            activeEngineers: Array.from(this.engineerPool.keys()),
            config: this.config
        };
    }
    /**
     * 特定のタスクを強制停止
     */
    async abortTask(taskId) {
        const task = this.activeTasks.get(taskId);
        if (!task) {
            console.warn(`⚠️ タスク ${taskId} が見つかりません`);
            return false;
        }
        try {
            task.status = 'failed';
            this.activeTasks.delete(taskId);
            if (task.worktreePath) {
                await this.gitManager.cleanupCompletedTask(taskId, { deleteBranch: true });
            }
            console.log(`🛑 タスク ${taskId} を強制停止しました`);
            return true;
        }
        catch (error) {
            console.error(`❌ タスク ${taskId} の停止に失敗:`, error);
            return false;
        }
    }
    /**
     * ログ出力ヘルパーメソッド
     */
    log(engineerId, level, message, component, group) {
        if (this.logViewer) {
            this.logViewer.log(engineerId, level, message, component, group);
        }
        else {
            // フォールバック: 従来のconsole出力
            const formatted = LogFormatter.formatMessage(engineerId, level, message, component);
            console.log(LogFormatter.formatForConsole(formatted));
        }
    }
    /**
     * 新しいエンジニアをログビューアーに登録
     */
    registerEngineerInViewer(engineerId, taskTitle) {
        if (this.logViewer && !this.logViewer.isEngineerActive(engineerId)) {
            this.logViewer.addEngineer(engineerId, `🔧 ${taskTitle}`);
        }
    }
    /**
     * エンジニアをログビューアーから削除
     */
    unregisterEngineerFromViewer(engineerId) {
        if (this.logViewer && this.logViewer.isEngineerActive(engineerId)) {
            this.logViewer.removeEngineer(engineerId);
        }
    }
    /**
     * ログビューアーを開始
     */
    startLogViewer() {
        if (this.logViewer) {
            this.logViewer.start();
        }
    }
    /**
     * ログビューアーを終了
     */
    stopLogViewer() {
        if (this.logViewer) {
            this.logViewer.destroy();
        }
    }
    /**
     * メイン情報を更新
     */
    updateMainInfo(content) {
        if (this.logViewer) {
            this.logViewer.updateMainInfo(content);
        }
    }
}
//# sourceMappingURL=ParallelDevelopmentOrchestrator.js.map