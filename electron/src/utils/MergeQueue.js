import { execSync } from 'child_process';
import { TaskEventEmitter } from './TaskEventEmitter.js';
/**
 * Mutex実装（排他制御）
 */
class Mutex {
    locked = false;
    queue = [];
    async acquire() {
        return new Promise((resolve) => {
            if (!this.locked) {
                this.locked = true;
                resolve();
            }
            else {
                this.queue.push(resolve);
            }
        });
    }
    release() {
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            if (next)
                next();
        }
        else {
            this.locked = false;
        }
    }
}
/**
 * マージキュー
 * メインブランチへのマージを排他制御で順次実行
 */
export class MergeQueue {
    queue = [];
    isProcessing = false;
    isStopped = false;
    mutex = new Mutex();
    gitManager;
    config;
    eventEmitter;
    maxRetries = 3;
    completionReporter;
    dependencyManager;
    constructor(gitManager, config, completionReporter, dependencyManager) {
        this.gitManager = gitManager;
        this.config = config;
        this.eventEmitter = TaskEventEmitter.getInstance();
        this.completionReporter = completionReporter;
        this.dependencyManager = dependencyManager;
    }
    /**
     * CompletionReporterを設定
     */
    setCompletionReporter(completionReporter) {
        this.completionReporter = completionReporter;
    }
    /**
     * マージをキューに追加
     */
    async enqueueMerge(task, finalResult, reviewHistory, engineerId) {
        const item = {
            task,
            finalResult,
            reviewHistory,
            retryCount: 0,
            engineerId
        };
        this.queue.push(item);
        console.log(`📥 [Merge Coordinator] マージキューに追加: ${task.title} ("${task.branchName}" → "${this.config.baseBranch}") (待機数: ${this.queue.length})`);
        // 非同期で次の処理を開始
        this.processNext().catch(error => {
            console.error(`❌ マージキュー処理エラー:`, error);
        });
    }
    /**
     * 次のマージを処理
     */
    async processNext() {
        // 停止フラグをチェック
        if (this.isStopped) {
            return;
        }
        // 排他制御でマージ処理を保護
        await this.mutex.acquire();
        try {
            if (this.isStopped || this.isProcessing || this.queue.length === 0) {
                return;
            }
            this.isProcessing = true;
            const item = this.queue.shift();
            console.log(`\n🔀 [Merge Coordinator] マージ処理開始: ${item.task.title} ("${item.task.branchName}" → "${this.config.baseBranch}")`);
            console.log(`📊 [Merge Coordinator] 残りキュー: ${this.queue.length}件`);
            // マージ中としてマーク
            if (this.dependencyManager) {
                this.dependencyManager.markMerging(item.task.id);
            }
            // マージ処理の実行
            const success = await this.executeMergeWithRetry(item);
            if (success) {
                console.log(`✅ [Merge Coordinator] マージ成功: ${item.task.title} ("${item.task.branchName}" → "${this.config.baseBranch}")`);
                this.eventEmitter.emitMergeCompleted(item.task, true);
                // クリーンアップ
                await this.cleanupTask(item.task);
                // タスク完了を記録
                if (this.completionReporter) {
                    // コンフリクト解消タスクの場合、元のタスクタイトルを使用
                    let taskTitleForCompletion = item.task.title;
                    if (item.task.isConflictResolution && item.task.title.startsWith('[コンフリクト解消] ')) {
                        taskTitleForCompletion = item.task.title.replace('[コンフリクト解消] ', '');
                        console.log(`[MergeQueue] Conflict resolution task detected. Using original title: "${taskTitleForCompletion}"`);
                    }
                    console.log(`[MergeQueue] Recording task completion for: "${taskTitleForCompletion}"`);
                    const status = await this.completionReporter.markTaskCompletedByTitle(taskTitleForCompletion);
                    console.log(`📊 タスク完了: ${item.task.title} (${status.completedTasks}/${status.totalTasks} - ${status.percentage}%)`);
                    // 注意: 全タスク完了イベント(allTasksCompleted)はCompletionReporter内で自動的に発火される
                    // ここで重複して発火する必要はない
                }
                else {
                    console.log(`[MergeQueue] CompletionReporter not available`);
                }
            }
            else if (item.conflictDetected) {
                console.log(`⚠️ [Merge Coordinator] コンフリクト検出によりマージ中断: ${item.task.title} ("${item.task.branchName}")`);
                // コンフリクト検出時はcleanup処理を行わない（ワークツリーを保持）
                // イベントも発火しない（既に emitMergeConflictDetected で発火済み）
            }
            else {
                console.error(`❌ [Merge Coordinator] マージ失敗: ${item.task.title} ("${item.task.branchName}" → "${this.config.baseBranch}")`);
                this.eventEmitter.emitMergeCompleted(item.task, false, 'マージに失敗しました');
            }
            this.isProcessing = false;
            // 次のアイテムを処理（停止フラグを確認）
            if (!this.isStopped && this.queue.length > 0) {
                // 少し遅延を入れてGitの状態を安定させる
                setTimeout(() => {
                    if (!this.isStopped) {
                        this.processNext().catch(error => {
                            console.error(`❌ 次のマージ処理でエラー:`, error);
                        });
                    }
                }, 1000);
            }
        }
        finally {
            this.mutex.release();
        }
    }
    /**
     * リトライ付きマージ実行
     */
    async executeMergeWithRetry(item) {
        while (item.retryCount < this.maxRetries) {
            try {
                console.log(`\n🔄 [Merge Coordinator] マージ試行 ${item.retryCount + 1}/${this.maxRetries}: ${item.task.title} ("${item.task.branchName}" → "${this.config.baseBranch}")`);
                // Step 1: 最新のメインブランチを取り込む
                const pullSuccess = await this.pullLatestMain(item.task);
                if (!pullSuccess) {
                    console.error(`❌ ローカルメインブランチのマージ失敗`);
                    item.retryCount++;
                    continue;
                }
                // Step 2: コンフリクトチェック
                const hasConflict = await this.detectConflict(item.task.worktreePath);
                if (hasConflict) {
                    console.log(`⚠️ [Merge Coordinator] コンフリクト検出: "${item.task.branchName}" ⟷ "${this.config.baseBranch}" - コンフリクト解消タスクを作成`);
                    // コンフリクト検出イベントを発火
                    this.eventEmitter.emitMergeConflictDetected(item.task, item.finalResult, item.reviewHistory, item.engineerId);
                    // コンフリクト検出フラグを設定
                    item.conflictDetected = true;
                    // コンフリクト検出時はマージを中断し、cleanup処理は行わない
                    return false;
                }
                // Step 3: 最終マージ実行
                const mergeSuccess = await this.executeFinalMerge(item.task);
                if (mergeSuccess) {
                    return true;
                }
                item.retryCount++;
            }
            catch (error) {
                console.error(`❌ マージ処理エラー (試行 ${item.retryCount + 1}):`, error);
                item.retryCount++;
            }
        }
        return false;
    }
    /**
     * 最新のメインブランチを取り込む
     */
    async pullLatestMain(task) {
        if (!task.worktreePath || !task.branchName) {
            console.error(`❌ ワークツリー情報が不足`);
            return false;
        }
        try {
            console.log(`📥 [Merge Coordinator] "${this.config.baseBranch}" を "${task.branchName}" にマージ中...`);
            // ワークツリーでフィーチャーブランチを確認
            execSync(`git checkout ${task.branchName}`, {
                cwd: task.worktreePath,
                stdio: 'pipe'
            });
            // ローカルのメインブランチの最新状態を取得
            // （ローカル開発環境なので、リモートfetchは不要）
            // メインブランチをマージ
            try {
                execSync(`git merge ${this.config.baseBranch}`, {
                    cwd: task.worktreePath,
                    stdio: 'pipe'
                });
                console.log(`✅ [Merge Coordinator] "${this.config.baseBranch}" を "${task.branchName}" にマージ完了`);
                return true;
            }
            catch (mergeError) {
                // マージエラーの場合、コンフリクトの可能性
                console.log(`⚠️ マージ中にエラー発生（コンフリクトの可能性）`);
                return true; // コンフリクトは次のステップで処理
            }
        }
        catch (error) {
            console.error(`❌ ローカルメインブランチのマージエラー:`, error);
            return false;
        }
    }
    /**
     * コンフリクトの検出
     */
    async detectConflict(repoPath) {
        try {
            const status = execSync('git status --porcelain', {
                cwd: repoPath,
                encoding: 'utf-8',
                stdio: 'pipe'
            });
            // マージコンフリクトのマーカーを探す
            return status.includes('UU ') || status.includes('AA ') || status.includes('DD ');
        }
        catch (error) {
            return false;
        }
    }
    /**
     * 最終マージの実行
     */
    async executeFinalMerge(task) {
        if (!task.branchName)
            return false;
        try {
            console.log(`🔀 [Merge Coordinator] 最終マージ実行: "${task.branchName}" → "${this.config.baseBranch}"`);
            // メインリポジトリでメインブランチに切り替え
            execSync(`git checkout ${this.config.baseBranch}`, {
                cwd: this.config.baseRepoPath,
                stdio: 'pipe'
            });
            // 個別のコミット履歴を保持するため通常のマージを使用（--no-ffを削除）
            execSync(`git merge ${task.branchName}`, {
                cwd: this.config.baseRepoPath,
                stdio: 'pipe'
            });
            console.log(`✅ [Merge Coordinator] マージ完了: "${task.branchName}" → "${this.config.baseBranch}"`);
            return true;
        }
        catch (error) {
            console.error(`❌ 最終マージエラー:`, error);
            // マージを中止
            try {
                execSync(`git merge --abort`, {
                    cwd: this.config.baseRepoPath,
                    stdio: 'pipe'
                });
            }
            catch (e) {
                // 中止エラーは無視
            }
            return false;
        }
    }
    /**
     * マージ後のタスククリーンアップ
     */
    async cleanupTask(task) {
        if (!task.branchName)
            return;
        try {
            console.log(`🧹 タスククリーンアップ開始: ${task.title}`);
            // コンフリクト解消タスクの場合はブランチを削除しない
            const isConflictResolution = task.isConflictResolution || task.type === 'conflict-resolution';
            console.log(`🔍 ブランチ削除判定: タスクタイプ="${task.type}" isConflictResolution=${task.isConflictResolution} 削除スキップ=${isConflictResolution}`);
            // ワークツリーとブランチを同時に削除
            await this.gitManager.cleanupCompletedTask(task.id, {
                deleteBranch: !isConflictResolution
            });
            console.log(`✅ タスククリーンアップ完了`);
        }
        catch (error) {
            console.warn(`⚠️ タスククリーンアップ中にエラー:`, error);
        }
    }
    /**
     * キューの統計情報
     */
    getStats() {
        return {
            queueLength: this.queue.length,
            isProcessing: this.isProcessing
        };
    }
    /**
     * マージキューを停止
     */
    stop() {
        console.log('🛑 マージキューを停止中...');
        // 停止フラグを設定
        this.isStopped = true;
        // キューをクリア
        this.queue = [];
        // 処理中フラグをリセット
        this.isProcessing = false;
        // Mutexを解放
        this.mutex.release();
    }
    /**
     * キューをクリア
     */
    clear() {
        this.queue = [];
    }
    /**
     * メモリリークを防ぐためのクリーンアップ
     */
    cleanup() {
        console.log('🧹 MergeQueue クリーンアップ開始');
        // キューを停止
        this.stop();
        // 内部状態をクリア
        this.clear();
        // 依存関係マネージャーの参照をクリア
        this.dependencyManager = undefined;
        // CompletionReporterの参照をクリア
        this.completionReporter = undefined;
        console.log('✅ MergeQueue クリーンアップ完了');
    }
}
//# sourceMappingURL=MergeQueue.js.map