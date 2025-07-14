import { Task, EngineerResult, ReviewResult } from '../types/index.js';
import { ReviewWorkflow } from '../managers/ReviewWorkflow.js';
import { EngineerAI } from '../managers/EngineerAI.js';
import { TaskQueue } from './TaskQueue.js';
import { TaskEventEmitter, ReviewCompletedPayload } from './TaskEventEmitter.js';
import { DependencyManager } from './DependencyManager.js';

/**
 * レビューキューアイテム
 */
export interface ReviewQueueItem {
  task: Task;
  engineerResult: EngineerResult;
  engineerId: string;
  engineer?: EngineerAI;
  retryCount: number;
}

/**
 * レビューキュー
 * 開発完了したタスクのレビューを並列で処理
 */
export class ReviewQueue {
  private queue: TaskQueue<ReviewQueueItem>;
  private reviewWorkflow: ReviewWorkflow;
  private eventEmitter: TaskEventEmitter;
  private maxConcurrentReviews: number;
  private reviewHistory = new Map<string, ReviewResult[]>();
  private maxRetries: number;
  private dependencyManager?: DependencyManager;

  constructor(
    reviewWorkflow: ReviewWorkflow, 
    maxConcurrentReviews: number = 2,
    maxRetries: number = 5,
    dependencyManager?: DependencyManager
  ) {
    this.reviewWorkflow = reviewWorkflow;
    this.maxConcurrentReviews = maxConcurrentReviews;
    this.maxRetries = maxRetries;
    this.dependencyManager = dependencyManager;
    this.queue = new TaskQueue<ReviewQueueItem>(maxConcurrentReviews);
    this.eventEmitter = TaskEventEmitter.getInstance();
    
    // レビュー処理関数を設定
    this.queue.start(this.processReview.bind(this));
  }

  /**
   * レビューをキューに追加
   */
  async enqueueReview(
    task: Task, 
    engineerResult: EngineerResult, 
    engineerId: string,
    engineer?: EngineerAI
  ): Promise<void> {
    const item: ReviewQueueItem = {
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
  private async processReview(item: ReviewQueueItem): Promise<void> {
    console.log(`\n🔍 レビュー処理開始: ${item.task.title}`);
    
    // レビュー中としてマーク
    if (this.dependencyManager) {
      this.dependencyManager.markReviewing(item.task.id);
    }
    
    try {
      // レビューワークフローを実行
      const result = await this.reviewWorkflow.executeReviewWorkflow(
        item.task,
        item.engineerResult,
        item.engineerId,
        item.engineer
      );

      // レビュー履歴を保存
      this.reviewHistory.set(item.task.id, result.reviewHistory);

      if (result.approved && result.merged) {
        // マージまで完了
        console.log(`✅ レビュー承認・マージ完了: ${item.task.title}`);
        this.eventEmitter.emitMergeCompleted(item.task, true);
      } else if (result.approved) {
        // レビューは承認されたがマージ待ち
        console.log(`✅ レビュー承認（マージ待ち）: ${item.task.title}`);
        console.log(`📤 マージ準備完了イベントを発火: ${item.task.title}`);
        this.eventEmitter.emitMergeReady(
          item.task, 
          result.finalResult || item.engineerResult,
          result.reviewHistory,
          item.engineerId
        );
      } else {
        // レビュー失敗または修正が必要
        const needsRevision = result.reviewHistory.some(
          r => r.status === 'CHANGES_REQUESTED'
        );
        
        if (needsRevision && item.retryCount < this.maxRetries) {
          // 修正が必要な場合は開発キューに戻す
          console.log(`🔄 修正要求 - 開発キューに戻す: ${item.task.title}`);
          
          const lastReview = result.reviewHistory[result.reviewHistory.length - 1];
          this.eventEmitter.emitReviewCompleted(
            item.task,
            lastReview,
            result.finalResult || item.engineerResult,
            true
          );
        } else {
          // 最終的に失敗
          console.error(`❌ レビュー最終失敗: ${item.task.title}`);
          this.eventEmitter.emitTaskFailed(
            item.task,
            'レビューで承認を得られませんでした',
            'review'
          );
        }
      }
    } catch (error) {
      console.error(`❌ レビュー処理エラー: ${item.task.title}`, error);
      this.eventEmitter.emitTaskFailed(
        item.task,
        error instanceof Error ? error.message : String(error),
        'review'
      );
    }
  }

  /**
   * キューの統計情報を取得
   */
  getStats(): {
    waiting: number;
    processing: number;
    maxConcurrent: number;
    totalReviewed: number;
  } {
    const queueStats = this.queue.getStats();
    return {
      ...queueStats,
      totalReviewed: this.reviewHistory.size
    };
  }

  /**
   * レビュー履歴を取得
   */
  getReviewHistory(taskId: string): ReviewResult[] | undefined {
    return this.reviewHistory.get(taskId);
  }

  /**
   * 全てのレビューが完了するまで待機
   */
  async waitForCompletion(): Promise<void> {
    await this.queue.waitForCompletion();
  }

  /**
   * キューを停止
   */
  stop(): void {
    this.queue.stop();
  }

  /**
   * キューをクリア
   */
  clear(): void {
    this.queue.clear();
    this.reviewHistory.clear();
  }

  /**
   * メモリリークを防ぐためのクリーンアップ
   */
  cleanup(): void {
    console.log('🧹 ReviewQueue クリーンアップ開始');
    
    // キューを停止
    this.stop();
    
    // 内部状態をクリア
    this.clear();
    
    // 依存関係マネージャーの参照をクリア
    this.dependencyManager = undefined;
    
    // TaskQueueのクリーンアップ
    if (typeof (this.queue as any).cleanup === 'function') {
      (this.queue as any).cleanup();
    }
    
    console.log('✅ ReviewQueue クリーンアップ完了');
  }
}