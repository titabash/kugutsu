import { TaskQueue } from './TaskQueue.js';
import { TaskEventEmitter } from './TaskEventEmitter.js';
/**
 * レビューキュー
 * 開発完了したタスクのレビューを並列で処理
 */
export class ReviewQueue {
    queue;
    reviewWorkflow;
    eventEmitter;
    maxConcurrentReviews;
    reviewHistory = new Map();
    maxRetries;
    dependencyManager;
    constructor(reviewWorkflow, maxConcurrentReviews = 2, maxRetries = 5, dependencyManager) {
        this.reviewWorkflow = reviewWorkflow;
        this.maxConcurrentReviews = maxConcurrentReviews;
        this.maxRetries = maxRetries;
        this.dependencyManager = dependencyManager;
        this.queue = new TaskQueue(maxConcurrentReviews);
        this.eventEmitter = TaskEventEmitter.getInstance();
        // レビュー処理関数を設定
        this.queue.start(this.processReview.bind(this));
    }
    /**
     * レビューをキューに追加
     */
    async enqueueReview(task, engineerResult, engineerId, engineer) {
        const item = {
            task,
            engineerResult,
            engineerId,
            engineer,
            retryCount: 0
        };
        // 優先度は開発の優先度を引き継ぐ
        const priority = task.priority === 'high' ? 50 :
            task.priority === 'medium' ? 0 : -50;
        await this.queue.enqueue(task.id, item, priority);
        console.log(`📋 レビューキューに追加: ${task.title}`);
    }
    /**
     * レビューを処理
     */
    async processReview(item) {
        console.log(`\n🔍 レビュー処理開始: ${item.task.title}`);
        // レビュー中としてマーク
        if (this.dependencyManager) {
            this.dependencyManager.markReviewing(item.task.id);
        }
        try {
            // レビューワークフローを実行
            const result = await this.reviewWorkflow.executeReviewWorkflow(item.task, item.engineerResult, item.engineerId, item.engineer);
            // レビュー履歴を保存
            this.reviewHistory.set(item.task.id, result.reviewHistory);
            if (result.approved && result.merged) {
                // マージまで完了
                console.log(`✅ レビュー承認・マージ完了: ${item.task.title}`);
                this.eventEmitter.emitMergeCompleted(item.task, true);
            }
            else if (result.approved) {
                // レビューは承認されたがマージ待ち
                console.log(`✅ レビュー承認（マージ待ち）: ${item.task.title}`);
                console.log(`📤 マージ準備完了イベントを発火: ${item.task.title}`);
                this.eventEmitter.emitMergeReady(item.task, result.finalResult || item.engineerResult, result.reviewHistory, item.engineerId);
            }
            else {
                // レビュー失敗または修正が必要
                const needsRevision = result.reviewHistory.some(r => r.status === 'CHANGES_REQUESTED');
                if (needsRevision && item.retryCount < this.maxRetries) {
                    // 修正が必要な場合は開発キューに戻す
                    console.log(`🔄 修正要求 - 開発キューに戻す: ${item.task.title}`);
                    const lastReview = result.reviewHistory[result.reviewHistory.length - 1];
                    this.eventEmitter.emitReviewCompleted(item.task, lastReview, result.finalResult || item.engineerResult, true);
                }
                else {
                    // 最終的に失敗
                    console.error(`❌ レビュー最終失敗: ${item.task.title}`);
                    this.eventEmitter.emitTaskFailed(item.task, 'レビューで承認を得られませんでした', 'review');
                }
            }
        }
        catch (error) {
            console.error(`❌ レビュー処理エラー: ${item.task.title}`, error);
            this.eventEmitter.emitTaskFailed(item.task, error instanceof Error ? error.message : String(error), 'review');
        }
    }
    /**
     * キューの統計情報を取得
     */
    getStats() {
        const queueStats = this.queue.getStats();
        return {
            ...queueStats,
            totalReviewed: this.reviewHistory.size
        };
    }
    /**
     * レビュー履歴を取得
     */
    getReviewHistory(taskId) {
        return this.reviewHistory.get(taskId);
    }
    /**
     * 全てのレビューが完了するまで待機
     */
    async waitForCompletion() {
        await this.queue.waitForCompletion();
    }
    /**
     * キューを停止
     */
    stop() {
        this.queue.stop();
    }
    /**
     * キューをクリア
     */
    clear() {
        this.queue.clear();
        this.reviewHistory.clear();
    }
    /**
     * メモリリークを防ぐためのクリーンアップ
     */
    cleanup() {
        console.log('🧹 ReviewQueue クリーンアップ開始');
        // キューを停止
        this.stop();
        // 内部状態をクリア
        this.clear();
        // 依存関係マネージャーの参照をクリア
        this.dependencyManager = undefined;
        // TaskQueueのクリーンアップ
        if (typeof this.queue.cleanup === 'function') {
            this.queue.cleanup();
        }
        console.log('✅ ReviewQueue クリーンアップ完了');
    }
}
//# sourceMappingURL=ReviewQueue.js.map