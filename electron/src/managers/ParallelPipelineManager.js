import { EngineerAI } from './EngineerAI.js';
import { ReviewWorkflow } from './ReviewWorkflow.js';
import { TaskQueue } from '../utils/TaskQueue.js';
import { ReviewQueue } from '../utils/ReviewQueue.js';
import { MergeQueue } from '../utils/MergeQueue.js';
import { TaskEventEmitter } from '../utils/TaskEventEmitter.js';
import { DependencyManager } from '../utils/DependencyManager.js';
/**
 * 並列パイプラインマネージャー
 * 開発、レビュー、マージを並列で処理
 */
export class ParallelPipelineManager {
    developmentQueue;
    reviewQueue;
    mergeQueue;
    gitManager;
    config;
    eventEmitter;
    engineers = new Map();
    isRunning = false;
    dependencyManager;
    allTasks = new Map(); // 全タスクを保持
    listenerRegistrations = []; // イベントリスナー登録を追跡
    constructor(gitManager, config, completionReporter) {
        this.gitManager = gitManager;
        this.config = config;
        this.eventEmitter = TaskEventEmitter.getInstance();
        this.dependencyManager = new DependencyManager();
        // キューの初期化
        this.developmentQueue = new TaskQueue(config.maxConcurrentEngineers);
        const reviewWorkflow = new ReviewWorkflow(gitManager, config);
        this.reviewQueue = new ReviewQueue(reviewWorkflow, config.maxConcurrentEngineers, config.maxReviewRetries ?? 5, this.dependencyManager);
        this.mergeQueue = new MergeQueue(gitManager, config, completionReporter ?? undefined, this.dependencyManager);
        // イベントリスナーの設定
        this.setupEventListeners();
    }
    /**
     * CompletionReporterを設定
     */
    setCompletionReporter(completionReporter) {
        this.mergeQueue.setCompletionReporter(completionReporter);
    }
    /**
     * イベントリスナーの設定
     */
    setupEventListeners() {
        console.log('🔧 ParallelPipelineManager イベントリスナー設定開始');
        // 開発完了 → レビューキューへ
        const developmentCompletedRegistration = this.eventEmitter.onDevelopmentCompleted(async (event) => {
            const payload = event.payload;
            console.log(`\n🎯 開発完了イベント受信: ${payload.task.title}`);
            const engineer = this.engineers.get(payload.engineerId);
            await this.reviewQueue.enqueueReview(payload.task, payload.result, payload.engineerId, engineer);
        });
        this.listenerRegistrations.push(developmentCompletedRegistration);
        // レビュー完了（修正要求） → 開発キューへ戻す
        const reviewCompletedRegistration = this.eventEmitter.onReviewCompleted(async (event) => {
            const payload = event.payload;
            if (payload.needsRevision) {
                console.log(`\n🔄 修正要求イベント受信: ${payload.task.title}`);
                // 修正タスクとして開発キューに戻す
                const revisionTask = {
                    ...payload.task,
                    title: `[修正] ${payload.task.title}`,
                    description: `${payload.task.description}\n\n## レビューフィードバック\n${payload.reviewResult.comments.join('\n')}`
                };
                const engineer = this.engineers.get(payload.engineerResult.engineerId);
                await this.enqueueDevelopment(revisionTask, engineer);
            }
        });
        this.listenerRegistrations.push(reviewCompletedRegistration);
        // マージ準備完了 → マージキューへ
        const mergeReadyRegistration = this.eventEmitter.onMergeReady(async (event) => {
            const payload = event.payload;
            console.log(`\n🚀 マージ準備完了イベント受信: ${payload.task.title}`);
            await this.mergeQueue.enqueueMerge(payload.task, payload.finalResult, payload.reviewHistory, payload.engineerId);
        });
        this.listenerRegistrations.push(mergeReadyRegistration);
        // マージコンフリクト検出 → 開発キューへ戻す
        const mergeConflictRegistration = this.eventEmitter.onMergeConflictDetected(async (event) => {
            const payload = event.payload;
            console.log(`\n⚠️ コンフリクト検出イベント受信: ${payload.task.title}`);
            // コンフリクト解消タスクとして修正
            const conflictTask = {
                ...payload.task,
                type: 'conflict-resolution',
                title: `[コンフリクト解消] ${payload.task.title}`,
                description: this.buildConflictResolutionDescription(payload.task),
                priority: 'high', // コンフリクト解消は高優先度
                isConflictResolution: true,
                originalTaskId: payload.task.id,
                conflictContext: {
                    originalEngineerResult: payload.finalResult,
                    reviewHistory: payload.reviewHistory,
                    originalEngineerId: payload.engineerId
                }
            };
            // 元のエンジニアAIを取得
            const engineer = this.engineers.get(payload.engineerId);
            // 開発キューに戻す（優先度高）
            await this.enqueueDevelopment(conflictTask, engineer);
        });
        this.listenerRegistrations.push(mergeConflictRegistration);
        // マージ完了イベント（依存関係解決）
        const mergeCompletedRegistration = this.eventEmitter.onMergeCompleted(async (event) => {
            const payload = event.payload; // MergeCompletedPayload
            if (payload.success) {
                console.log(`\n✅ マージ完了イベント受信: ${payload.task.title}`);
                // マージ済みとしてマーク
                const newReadyTasks = this.dependencyManager.markMerged(payload.task.id);
                if (newReadyTasks.length > 0) {
                    console.log(`\n🎯 新たに実行可能になったタスク: ${newReadyTasks.map(t => t.title).join(', ')}`);
                    // 依存関係解決イベントを発火
                    this.eventEmitter.emitDependencyResolved(payload.task.id, newReadyTasks);
                    // 新たに実行可能になったタスクをキューに追加
                    for (const task of newReadyTasks) {
                        // 依存関係解決後のタスクには最新のbaseBranchから新規worktreeを作成するフラグを設定
                        task.forceNewWorktree = true;
                        await this.enqueueDevelopment(task);
                    }
                }
                // タスク完了イベントも発火（互換性のため）
                this.eventEmitter.emitTaskCompleted(payload.task, payload.finalResult || {}, payload.engineerId || '');
            }
        });
        this.listenerRegistrations.push(mergeCompletedRegistration);
        // タスク完了イベント（互換性のため残す）
        const taskCompletedRegistration = this.eventEmitter.onTaskCompleted(async (event) => {
            const payload = event.payload;
            console.log(`\n📌 タスク完了イベント受信（互換性）: ${payload.task.title}`);
        });
        this.listenerRegistrations.push(taskCompletedRegistration);
        // 依存関係解決イベント
        const dependencyResolvedRegistration = this.eventEmitter.onDependencyResolved(async (event) => {
            const payload = event.payload;
            console.log(`\n🔓 依存関係解決: ${payload.resolvedTaskId}`);
        });
        this.listenerRegistrations.push(dependencyResolvedRegistration);
        console.log(`✅ ParallelPipelineManager イベントリスナー設定完了 (${this.listenerRegistrations.length}個)`);
    }
    /**
     * タスクを初期化（依存関係グラフを構築）
     */
    async initializeTasks(tasks) {
        console.log(`\n📊 タスク初期化: ${tasks.length}個のタスク`);
        // 全タスクを保存
        for (const task of tasks) {
            this.allTasks.set(task.id, task);
            console.log(`📌 タスク登録: ${task.title} (ID: ${task.id})`);
            console.log(`  - 依存関係: ${task.dependencies.length > 0 ? task.dependencies.join(', ') : 'なし'}`);
        }
        // 依存関係グラフを構築
        this.dependencyManager.buildDependencyGraph(tasks);
        // 循環依存をチェック
        const cycles = this.dependencyManager.detectCycles();
        if (cycles.length > 0) {
            const errorMessage = `循環依存が検出されました:\n${cycles.map(cycle => cycle.join(' → ')).join('\n')}`;
            console.error(`❌ ${errorMessage}`);
            throw new Error(errorMessage);
        }
        // 依存関係のステータスサマリーを表示
        const summary = this.dependencyManager.getStatusSummary();
        console.log(`\n📈 依存関係ステータス:`);
        console.log(`  - 合計: ${summary.total}`);
        console.log(`  - 実行可能: ${summary.ready}`);
        console.log(`  - 待機中: ${summary.waiting}`);
        // 実行可能なタスクのみをキューに追加
        const readyTasks = this.dependencyManager.getReadyTasks();
        console.log(`\n🚀 実行可能なタスク: ${readyTasks.map(t => t.title).join(', ')}`);
        for (const task of readyTasks) {
            await this.enqueueDevelopment(task);
        }
    }
    /**
     * パイプラインを開始
     */
    async start() {
        if (this.isRunning) {
            console.log(`⚠️ パイプラインは既に実行中です`);
            return;
        }
        this.isRunning = true;
        console.log(`\n🚀 並列パイプライン開始`);
        console.log(`📊 設定: 最大エンジニア数=${this.config.maxConcurrentEngineers}`);
        // 開発キューの処理を開始
        // ReviewQueueとMergeQueueは自動的に開始される
        this.developmentQueue.start(this.processDevelopment.bind(this));
    }
    /**
     * パイプラインを停止
     */
    stop() {
        console.log(`\n⏹️ 並列パイプライン停止`);
        this.isRunning = false;
        this.developmentQueue.stop();
        this.reviewQueue.stop();
        this.mergeQueue.stop();
    }
    /**
     * タスクを開発キューに追加
     */
    async enqueueDevelopment(task, engineer) {
        // タスクの依存関係ステータスを更新
        const depStatus = this.dependencyManager.getTaskDependencyStatus(task.id);
        if (depStatus) {
            task.dependencyStatus = depStatus;
        }
        // タスクを更新
        this.allTasks.set(task.id, task);
        const item = {
            task,
            retryCount: 0,
            engineer
        };
        // 優先度計算
        const priority = task.priority === 'high' ? 50 :
            task.priority === 'medium' ? 0 : -50;
        await this.developmentQueue.enqueue(task.id, item, priority);
        console.log(`📥 開発キューに追加: ${task.title} (優先度: ${priority})`);
        if (depStatus && (depStatus.blockedBy.length > 0 || depStatus.waitingFor.length > 0)) {
            console.log(`  ⏳ 依存関係待機中:`);
            if (depStatus.blockedBy.length > 0) {
                console.log(`    - ブロック: ${depStatus.blockedBy.join(', ')}`);
            }
            if (depStatus.waitingFor.length > 0) {
                console.log(`    - 実行待ち: ${depStatus.waitingFor.join(', ')}`);
            }
        }
    }
    /**
     * 開発タスクを処理
     */
    async processDevelopment(item) {
        console.log(`\n👷 開発処理開始: ${item.task.title}`);
        // 依存関係の状態を確認
        const depStatus = this.dependencyManager.getTaskDependencyStatus(item.task.id);
        // デバッグ情報を表示
        console.log(`🔍 依存関係チェック: ${item.task.title} (ID: ${item.task.id})`);
        console.log(`  - 依存タスクID: ${item.task.dependencies.join(', ') || 'なし'}`);
        if (depStatus) {
            console.log(`  - ブロック中: ${depStatus.blockedBy.length > 0 ? depStatus.blockedBy.join(', ') : 'なし'}`);
            console.log(`  - 実行待ち: ${depStatus.waitingFor.length > 0 ? depStatus.waitingFor.join(', ') : 'なし'}`);
            console.log(`  - 失敗依存: ${depStatus.failedDependencies.length > 0 ? depStatus.failedDependencies.join(', ') : 'なし'}`);
            if (depStatus.blockedBy.length > 0 || depStatus.waitingFor.length > 0) {
                console.log(`⏳ タスクは依存関係待機中: ${item.task.title}`);
                // すぐにキューに戻す（低優先度で）
                await this.developmentQueue.enqueue(item.task.id, item, -100);
                console.log(`🔁 タスクをキューに戻しました: ${item.task.title}`);
                return;
            }
        }
        else {
            console.log(`  ⚠️ 依存関係ステータスが取得できません`);
        }
        // タスクを実行中としてマーク
        this.dependencyManager.markRunning(item.task.id);
        try {
            // ワークツリーを作成（依存関係解決後は強制的に新規作成）
            if (!item.task.worktreePath || !item.task.branchName || item.task.forceNewWorktree) {
                if (item.task.forceNewWorktree) {
                    console.log(`🔄 依存関係解決後のため新規ワークツリーを作成: ${item.task.title}`);
                    // 既存のworktreeとブランチをクリア
                    item.task.worktreePath = undefined;
                    item.task.branchName = undefined;
                    // フラグをリセット
                    item.task.forceNewWorktree = false;
                }
                const worktreeInfo = await this.gitManager.createWorktreeForced(item.task.id);
                item.task.branchName = worktreeInfo.branchName;
                item.task.worktreePath = worktreeInfo.path;
            }
            else {
                console.log(`♻️ 既存のワークツリーを再利用: ${item.task.worktreePath}`);
            }
            // エンジニアAIのインスタンスを取得または作成
            const engineerId = item.engineer?.id || `engineer-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const engineer = item.engineer || new EngineerAI(engineerId, {
                maxTurns: this.config.maxTurnsPerTask
            });
            // エンジニアを保存（レビュー時に再利用）
            this.engineers.set(engineerId, engineer);
            // タスクを実行
            const result = await engineer.executeTask(item.task);
            if (result.success) {
                console.log(`✅ 開発完了: ${item.task.title}`);
                // 開発完了としてマーク
                this.dependencyManager.markDeveloped(item.task.id);
                // 開発完了イベントを発火
                this.eventEmitter.emitDevelopmentCompleted(item.task, result, engineerId);
            }
            else {
                console.error(`❌ 開発失敗: ${item.task.title} - ${result.error}`);
                if (item.retryCount < 3) {
                    // リトライ
                    item.retryCount++;
                    console.log(`🔄 開発リトライ ${item.retryCount}/3: ${item.task.title}`);
                    await this.developmentQueue.enqueue(item.task.id, item, 0);
                }
                else {
                    // 最終的に失敗
                    this.eventEmitter.emitTaskFailed(item.task, result.error || '開発に失敗しました', 'development');
                }
            }
        }
        catch (error) {
            console.error(`❌ 開発処理エラー: ${item.task.title}`, error);
            // エラー時のリソースクリーンアップ
            await this.handleTaskError(item.task, error instanceof Error ? error : new Error(String(error)), 'development');
        }
    }
    /**
     * 統計情報を取得
     */
    getStats() {
        return {
            development: this.developmentQueue.getStats(),
            review: this.reviewQueue.getStats(),
            merge: this.mergeQueue.getStats(),
            dependencies: this.dependencyManager.getStatusSummary()
        };
    }
    /**
     * 全ての処理が完了するまで待機
     */
    async waitForCompletion() {
        console.log(`\n⏳ 全パイプラインの完了を待機中...`);
        // 定期的に統計情報を表示
        const statsInterval = setInterval(() => {
            const stats = this.getStats();
            // 開発キューの待機数に、依存関係で待機中のタスク数を含める
            const totalWaitingDev = stats.development.waiting + stats.dependencies.waiting;
            console.log(`📊 パイプライン状況:`);
            console.log(`  開発: 待機=${totalWaitingDev}, 処理中=${stats.development.processing}`);
            console.log(`  レビュー: 待機=${stats.review.waiting}, 処理中=${stats.review.processing}`);
            console.log(`  マージ: 待機=${stats.merge.queueLength}, 処理中=${stats.merge.isProcessing}`);
            console.log(`  依存関係: 待機=${stats.dependencies.waiting}, 実行可能=${stats.dependencies.ready}, 実行中=${stats.dependencies.running}, 完了=${stats.dependencies.completed}`);
        }, 5000);
        try {
            // 全キューの完了を待つ
            await Promise.all([
                this.developmentQueue.waitForCompletion(),
                this.reviewQueue.waitForCompletion()
            ]);
            // マージキューも空になるまで待つ
            while (this.mergeQueue.getStats().queueLength > 0 || this.mergeQueue.getStats().isProcessing) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            // 全タスクが完了するまで待つ（依存関係も含む）
            const depStats = this.dependencyManager.getStatusSummary();
            if (depStats.waiting > 0 || depStats.ready > 0 || depStats.running > 0) {
                console.log(`⏳ 依存関係の完了を待機中...`);
                // 通常の処理フローではタイムアウトなしで待機（AI開発作業を妨げない）
                while (true) {
                    const currentStats = this.dependencyManager.getStatusSummary();
                    if (currentStats.waiting === 0 && currentStats.ready === 0 && currentStats.running === 0) {
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            console.log(`\n✅ 全パイプライン処理完了`);
        }
        finally {
            clearInterval(statsInterval);
        }
    }
    /**
     * エラー時のタスク処理
     */
    async handleTaskError(task, error, phase) {
        console.error(`❌ ${phase}処理エラー: ${task.title}`, error);
        // 依存関係マネージャーで失敗としてマーク
        const affectedTasks = this.dependencyManager.markFailed(task.id);
        if (affectedTasks.length > 0) {
            console.log(`⚠️ 影響を受けるタスク: ${affectedTasks.map(t => t.title).join(', ')}`);
            // 影響を受けるタスクも失敗させる
            for (const affectedTask of affectedTasks) {
                this.eventEmitter.emitTaskFailed(affectedTask, `依存タスク ${task.title} が失敗したため`, phase);
            }
        }
        // リソースクリーンアップ
        try {
            if (task.worktreePath && !(task.isConflictResolution || task.type === 'conflict-resolution')) {
                // コンフリクト解消タスクでない場合のみworktreeを削除
                // コンフリクト解消タスクはworktreeを保持する
                await this.gitManager.removeWorktree(task.id);
                console.log(`🧹 エラー時worktree削除: ${task.id}`);
            }
        }
        catch (cleanupError) {
            console.warn(`⚠️ エラー時クリーンアップ失敗: ${task.id}`, cleanupError);
        }
        // エンジニアインスタンスを削除（処理中でない場合のみ）
        const engineerId = `engineer-${task.id}`;
        if (this.engineers.has(engineerId)) {
            this.engineers.delete(engineerId);
            console.log(`🧹 エラー時エンジニア削除: ${engineerId}`);
        }
        // エラーイベントを発火
        this.eventEmitter.emitTaskFailed(task, error.message, phase);
    }
    /**
     * クリーンアップ
     */
    async cleanup() {
        console.log('🧹 ParallelPipelineManager クリーンアップ開始');
        this.stop();
        // 処理中のタスクを待つ（タイムアウト付き）
        try {
            await Promise.race([
                this.waitForCompletion(),
                new Promise(resolve => setTimeout(resolve, 60000)) // 1分でタイムアウト（クリーンアップのみ）
            ]);
        }
        catch (error) {
            console.warn('⚠️ cleanup中のwaitForCompletion処理でエラー:', error);
        }
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
        // エンジニアインスタンスを適切に破棄
        console.log(`🗑️ エンジニアインスタンス解放: ${this.engineers.size}個`);
        for (const [engineerId, engineer] of this.engineers) {
            try {
                // エンジニアの内部リソースをクリア（必要に応じて）
                if (typeof engineer.cleanup === 'function') {
                    await engineer.cleanup();
                }
            }
            catch (error) {
                console.warn(`⚠️ エンジニア解放エラー ${engineerId}:`, error);
            }
        }
        this.engineers.clear();
        // 全てのworktreeを削除
        console.log('🗑️ Worktree削除開始');
        for (const [engineerId] of this.engineers) {
            const taskId = engineerId.replace('engineer-', '');
            try {
                await this.gitManager.removeWorktree(taskId);
            }
            catch (error) {
                console.warn(`⚠️ Worktree削除エラー: ${taskId}`, error);
            }
        }
        // キューをクリーンアップ
        if (typeof this.developmentQueue.cleanup === 'function') {
            this.developmentQueue.cleanup();
        }
        else {
            this.developmentQueue.clear();
        }
        if (typeof this.reviewQueue.cleanup === 'function') {
            this.reviewQueue.cleanup();
        }
        else {
            this.reviewQueue.clear();
        }
        if (typeof this.mergeQueue.cleanup === 'function') {
            this.mergeQueue.cleanup();
        }
        else {
            this.mergeQueue.clear();
        }
        // 内部状態をクリア
        this.allTasks.clear();
        // 強制ガベージコレクション
        if (global.gc) {
            console.log('🗑️ 強制ガベージコレクション実行');
            global.gc();
        }
        console.log('✅ ParallelPipelineManager クリーンアップ完了');
    }
    /**
     * コンフリクト解消タスクの説明を構築
     */
    buildConflictResolutionDescription(task) {
        return `## マージコンフリクト解消

元のタスク: ${task.title}
作業ディレクトリ: ${task.worktreePath}

### 状況
フィーチャーブランチにメインブランチをマージしようとした際にコンフリクトが発生しました。

### 手順
1. git status でコンフリクト状況を確認
2. コンフリクトファイルを特定し、マーカーを確認
3. 両方の変更を理解し、適切に統合
4. すべてのコンフリクトマーカーを削除
5. git add で変更をステージング
6. git commit でマージを完了

### 注意事項
- 既存機能を壊さない
- 新機能を適切に統合
- テストが通ることを確認

元のタスクの内容：
${task.description}`;
    }
}
//# sourceMappingURL=ParallelPipelineManager.js.map