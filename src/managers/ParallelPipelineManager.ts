import { Task, SystemConfig } from '../types/index.js';
import { EngineerAI } from './EngineerAI.js';
import { GitWorktreeManager } from './GitWorktreeManager.js';
import { ReviewWorkflow } from './ReviewWorkflow.js';
import { TaskQueue } from '../utils/TaskQueue.js';
import { ReviewQueue } from '../utils/ReviewQueue.js';
import { MergeQueue } from '../utils/MergeQueue.js';
import { TaskEventEmitter, TaskEvent, DevelopmentCompletedPayload, ReviewCompletedPayload, MergeReadyPayload, MergeConflictDetectedPayload } from '../utils/TaskEventEmitter.js';
import { CompletionReporter } from '../utils/CompletionReporter.js';

/**
 * 開発キューアイテム
 */
interface DevelopmentQueueItem {
  task: Task;
  retryCount: number;
  engineer?: EngineerAI;
}

/**
 * 並列パイプラインマネージャー
 * 開発、レビュー、マージを並列で処理
 */
export class ParallelPipelineManager {
  private developmentQueue: TaskQueue<DevelopmentQueueItem>;
  private reviewQueue: ReviewQueue;
  private mergeQueue: MergeQueue;
  private gitManager: GitWorktreeManager;
  private config: SystemConfig;
  private eventEmitter: TaskEventEmitter;
  private engineers = new Map<string, EngineerAI>();
  private isRunning = false;

  constructor(gitManager: GitWorktreeManager, config: SystemConfig, completionReporter?: CompletionReporter | null) {
    this.gitManager = gitManager;
    this.config = config;
    this.eventEmitter = TaskEventEmitter.getInstance();

    // キューの初期化
    this.developmentQueue = new TaskQueue<DevelopmentQueueItem>(config.maxConcurrentEngineers);
    
    const reviewWorkflow = new ReviewWorkflow(gitManager, config);
    this.reviewQueue = new ReviewQueue(
      reviewWorkflow, 
      config.maxConcurrentEngineers,
      config.maxReviewRetries ?? 5
    );
    
    this.mergeQueue = new MergeQueue(gitManager, config, completionReporter ?? undefined);

    // イベントリスナーの設定
    this.setupEventListeners();
  }

  /**
   * CompletionReporterを設定
   */
  setCompletionReporter(completionReporter: CompletionReporter): void {
    this.mergeQueue.setCompletionReporter(completionReporter);
  }

  /**
   * イベントリスナーの設定
   */
  private setupEventListeners(): void {
    // 開発完了 → レビューキューへ
    this.eventEmitter.onDevelopmentCompleted(async (event: TaskEvent) => {
      const payload = event.payload as DevelopmentCompletedPayload;
      console.log(`\n🎯 開発完了イベント受信: ${payload.task.title}`);
      
      const engineer = this.engineers.get(payload.engineerId);
      await this.reviewQueue.enqueueReview(
        payload.task,
        payload.result,
        payload.engineerId,
        engineer
      );
    });

    // レビュー完了（修正要求） → 開発キューへ戻す
    this.eventEmitter.onReviewCompleted(async (event: TaskEvent) => {
      const payload = event.payload as ReviewCompletedPayload;
      
      if (payload.needsRevision) {
        console.log(`\n🔄 修正要求イベント受信: ${payload.task.title}`);
        
        // 修正タスクとして開発キューに戻す
        const revisionTask: Task = {
          ...payload.task,
          title: `[修正] ${payload.task.title}`,
          description: `${payload.task.description}\n\n## レビューフィードバック\n${payload.reviewResult.comments.join('\n')}`
        };
        
        const engineer = this.engineers.get(payload.engineerResult.engineerId);
        await this.enqueueDevelopment(revisionTask, engineer);
      }
    });

    // マージ準備完了 → マージキューへ
    this.eventEmitter.onMergeReady(async (event: TaskEvent) => {
      const payload = event.payload as MergeReadyPayload & { engineerId: string };
      console.log(`\n🚀 マージ準備完了イベント受信: ${payload.task.title}`);
      
      await this.mergeQueue.enqueueMerge(
        payload.task,
        payload.finalResult,
        payload.reviewHistory,
        payload.engineerId
      );
    });

    // マージコンフリクト検出 → 開発キューへ戻す
    this.eventEmitter.onMergeConflictDetected(async (event: TaskEvent) => {
      const payload = event.payload as MergeConflictDetectedPayload;
      console.log(`\n⚠️ コンフリクト検出イベント受信: ${payload.task.title}`);
      
      // コンフリクト解消タスクとして修正
      const conflictTask: Task = {
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
  }

  /**
   * パイプラインを開始
   */
  async start(): Promise<void> {
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
  stop(): void {
    console.log(`\n⏹️ 並列パイプライン停止`);
    this.isRunning = false;
    this.developmentQueue.stop();
    this.reviewQueue.stop();
    this.mergeQueue.stop();
  }

  /**
   * タスクを開発キューに追加
   */
  async enqueueDevelopment(task: Task, engineer?: EngineerAI): Promise<void> {
    const item: DevelopmentQueueItem = {
      task,
      retryCount: 0,
      engineer
    };

    // 優先度計算
    const priority = task.priority === 'high' ? 50 :
                    task.priority === 'medium' ? 0 : -50;

    await this.developmentQueue.enqueue(task.id, item, priority);
    console.log(`📥 開発キューに追加: ${task.title} (優先度: ${priority})`);
  }

  /**
   * 開発タスクを処理
   */
  private async processDevelopment(item: DevelopmentQueueItem): Promise<void> {
    console.log(`\n👷 開発処理開始: ${item.task.title}`);
    
    try {
      // ワークツリーを作成（既存のものがある場合は再利用）
      if (!item.task.worktreePath || !item.task.branchName) {
        const worktreeInfo = await this.gitManager.createWorktree(item.task.id);
        item.task.branchName = worktreeInfo.branchName;
        item.task.worktreePath = worktreeInfo.path;
      } else {
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
        
        // 開発完了イベントを発火
        this.eventEmitter.emitDevelopmentCompleted(item.task, result, engineerId);
      } else {
        console.error(`❌ 開発失敗: ${item.task.title} - ${result.error}`);
        
        if (item.retryCount < 3) {
          // リトライ
          item.retryCount++;
          console.log(`🔄 開発リトライ ${item.retryCount}/3: ${item.task.title}`);
          await this.developmentQueue.enqueue(item.task.id, item, 0);
        } else {
          // 最終的に失敗
          this.eventEmitter.emitTaskFailed(item.task, result.error || '開発に失敗しました', 'development');
        }
      }
    } catch (error) {
      console.error(`❌ 開発処理エラー: ${item.task.title}`, error);
      
      // エラー時のリソースクリーンアップ
      await this.handleTaskError(item.task, error instanceof Error ? error : new Error(String(error)), 'development');
    }
  }

  /**
   * 統計情報を取得
   */
  getStats(): {
    development: { waiting: number; processing: number };
    review: { waiting: number; processing: number; totalReviewed: number };
    merge: { queueLength: number; isProcessing: boolean };
  } {
    return {
      development: this.developmentQueue.getStats(),
      review: this.reviewQueue.getStats(),
      merge: this.mergeQueue.getStats()
    };
  }

  /**
   * 全ての処理が完了するまで待機
   */
  async waitForCompletion(): Promise<void> {
    console.log(`\n⏳ 全パイプラインの完了を待機中...`);
    
    // 定期的に統計情報を表示
    const statsInterval = setInterval(() => {
      const stats = this.getStats();
      console.log(`📊 パイプライン状況:`);
      console.log(`  開発: 待機=${stats.development.waiting}, 処理中=${stats.development.processing}`);
      console.log(`  レビュー: 待機=${stats.review.waiting}, 処理中=${stats.review.processing}`);
      console.log(`  マージ: 待機=${stats.merge.queueLength}, 処理中=${stats.merge.isProcessing}`);
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

      console.log(`\n✅ 全パイプライン処理完了`);
    } finally {
      clearInterval(statsInterval);
    }
  }

  /**
   * エラー時のタスク処理
   */
  private async handleTaskError(task: Task, error: Error, phase: string): Promise<void> {
    console.error(`❌ ${phase}処理エラー: ${task.title}`, error);
    
    // リソースクリーンアップ
    try {
      if (task.worktreePath && !(task.isConflictResolution || task.type === 'conflict-resolution')) {
        // コンフリクト解消タスクでない場合のみworktreeを削除
        // コンフリクト解消タスクはworktreeを保持する
        await this.gitManager.removeWorktree(task.id);
        console.log(`🧹 エラー時worktree削除: ${task.id}`);
      }
    } catch (cleanupError) {
      console.warn(`⚠️ エラー時クリーンアップ失敗: ${task.id}`, cleanupError);
    }
    
    // エンジニアインスタンスを削除（処理中でない場合のみ）
    const engineerId = `engineer-${task.id}`;
    if (this.engineers.has(engineerId)) {
      this.engineers.delete(engineerId);
      console.log(`🧹 エラー時エンジニア削除: ${engineerId}`);
    }
    
    // エラーイベントを発火
    this.eventEmitter.emitTaskFailed(task, error.message, phase as any);
  }

  /**
   * クリーンアップ
   */
  async cleanup(): Promise<void> {
    this.stop();
    
    // 処理中のタスクを待つ
    await this.waitForCompletion();
    
    // 全てのworktreeを削除
    for (const [engineerId] of this.engineers) {
      const taskId = engineerId.replace('engineer-', '');
      try {
        await this.gitManager.removeWorktree(taskId);
      } catch (error) {
        console.warn(`⚠️ Worktree削除エラー: ${taskId}`, error);
      }
    }
    
    this.developmentQueue.clear();
    this.reviewQueue.clear();
    this.mergeQueue.clear();
    this.engineers.clear();
    this.eventEmitter.cleanup();
  }


  /**
   * コンフリクト解消タスクの説明を構築
   */
  private buildConflictResolutionDescription(task: Task): string {
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