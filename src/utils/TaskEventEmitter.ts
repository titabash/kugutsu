import { EventEmitter } from 'events';
import { Task, EngineerResult, ReviewResult } from '../types/index.js';

/**
 * リスナー登録情報
 */
export interface ListenerRegistration {
  id: string;
  event: string;
  callback: (...args: any[]) => void;
  unregister: () => void;
}

/**
 * タスクイベントの型定義
 */
export interface TaskEvent {
  type: 'DEVELOPMENT_COMPLETED' | 'REVIEW_COMPLETED' | 'MERGE_READY' | 'MERGE_COMPLETED' | 'TASK_FAILED' | 'MERGE_CONFLICT_DETECTED' | 'TASK_COMPLETED' | 'DEPENDENCY_RESOLVED';
  taskId: string;
  timestamp: Date;
  payload: any;
}

/**
 * 開発完了イベントのペイロード
 */
export interface DevelopmentCompletedPayload {
  task: Task;
  result: EngineerResult;
  engineerId: string;
}

/**
 * レビュー完了イベントのペイロード
 */
export interface ReviewCompletedPayload {
  task: Task;
  reviewResult: ReviewResult;
  engineerResult: EngineerResult;
  needsRevision: boolean;
}

/**
 * マージ準備完了イベントのペイロード
 */
export interface MergeReadyPayload {
  task: Task;
  finalResult: EngineerResult;
  reviewHistory: ReviewResult[];
}

/**
 * マージ完了イベントのペイロード
 */
export interface MergeCompletedPayload {
  task: Task;
  success: boolean;
  error?: string;
}

/**
 * タスク失敗イベントのペイロード
 */
export interface TaskFailedPayload {
  task: Task;
  error: string;
  phase: 'development' | 'review' | 'merge';
}

/**
 * マージコンフリクト検出イベントのペイロード
 */
export interface MergeConflictDetectedPayload {
  task: Task;
  finalResult: EngineerResult;
  reviewHistory: ReviewResult[];
  engineerId: string;
}

/**
 * タスク完了イベントのペイロード
 */
export interface TaskCompletedPayload {
  task: Task;
  result: EngineerResult;
  engineerId: string;
}

/**
 * 依存関係解決イベントのペイロード
 */
export interface DependencyResolvedPayload {
  resolvedTaskId: string;
  newReadyTasks: Task[];
}

/**
 * タスクイベントエミッター
 * 開発、レビュー、マージの各フェーズ間でイベントを通知
 * メモリリーク防止機能付き
 */
export class TaskEventEmitter extends EventEmitter {
  private static instance: TaskEventEmitter;
  private listenerRegistry = new Map<string, Map<string, (...args: any[]) => void>>();
  private activeListeners = new Set<(...args: any[]) => void>();
  private maxListenersWarningShown = false;
  private memoryMonitoringInterval?: NodeJS.Timeout;

  private constructor() {
    super();
    this.setMaxListeners(200); // 多数の並列タスクに対応（増量）
    
    // メモリリーク検出
    this.on('maxListeners', this.handleMaxListenersExceeded.bind(this));
    
    // 定期的なメモリ使用量チェック
    this.startMemoryMonitoring();
  }

  /**
   * シングルトンインスタンスの取得
   */
  static getInstance(): TaskEventEmitter {
    if (!TaskEventEmitter.instance) {
      TaskEventEmitter.instance = new TaskEventEmitter();
    }
    return TaskEventEmitter.instance;
  }

  /**
   * 開発完了イベントの発火
   */
  emitDevelopmentCompleted(task: Task, result: EngineerResult, engineerId: string): void {
    const event: TaskEvent = {
      type: 'DEVELOPMENT_COMPLETED',
      taskId: task.id,
      timestamp: new Date(),
      payload: { task, result, engineerId } as DevelopmentCompletedPayload
    };
    
    console.log(`📢 開発完了イベント発火: ${task.title}`);
    this.emit('DEVELOPMENT_COMPLETED', event);
    this.emit('task-event', event);
  }

  /**
   * レビュー完了イベントの発火
   */
  emitReviewCompleted(
    task: Task, 
    reviewResult: ReviewResult, 
    engineerResult: EngineerResult,
    needsRevision: boolean
  ): void {
    const event: TaskEvent = {
      type: 'REVIEW_COMPLETED',
      taskId: task.id,
      timestamp: new Date(),
      payload: { task, reviewResult, engineerResult, needsRevision } as ReviewCompletedPayload
    };
    
    console.log(`📢 レビュー完了イベント発火: ${task.title} (要修正: ${needsRevision})`);
    this.emit('REVIEW_COMPLETED', event);
    this.emit('task-event', event);
  }

  /**
   * マージ準備完了イベントの発火
   */
  emitMergeReady(task: Task, finalResult: EngineerResult, reviewHistory: ReviewResult[], engineerId: string): void {
    const event: TaskEvent = {
      type: 'MERGE_READY',
      taskId: task.id,
      timestamp: new Date(),
      payload: { task, finalResult, reviewHistory, engineerId } as MergeReadyPayload & { engineerId: string }
    };
    
    console.log(`📢 マージ準備完了イベント発火: ${task.title}`);
    this.emit('MERGE_READY', event);
    this.emit('task-event', event);
  }

  /**
   * マージ完了イベントの発火
   */
  emitMergeCompleted(task: Task, success: boolean, error?: string): void {
    const event: TaskEvent = {
      type: 'MERGE_COMPLETED',
      taskId: task.id,
      timestamp: new Date(),
      payload: { task, success, error } as MergeCompletedPayload
    };
    
    console.log(`📢 マージ完了イベント発火: ${task.title} (成功: ${success})`);
    this.emit('MERGE_COMPLETED', event);
    this.emit('task-event', event);
  }

  /**
   * タスク失敗イベントの発火
   */
  emitTaskFailed(task: Task, error: string, phase: 'development' | 'review' | 'merge'): void {
    const event: TaskEvent = {
      type: 'TASK_FAILED',
      taskId: task.id,
      timestamp: new Date(),
      payload: { task, error, phase } as TaskFailedPayload
    };
    
    console.log(`📢 タスク失敗イベント発火: ${task.title} (フェーズ: ${phase})`);
    this.emit('TASK_FAILED', event);
    this.emit('task-event', event);
  }

  /**
   * マージコンフリクト検出イベントの発火
   */
  emitMergeConflictDetected(
    task: Task, 
    finalResult: EngineerResult, 
    reviewHistory: ReviewResult[],
    engineerId: string
  ): void {
    const event: TaskEvent = {
      type: 'MERGE_CONFLICT_DETECTED',
      taskId: task.id,
      timestamp: new Date(),
      payload: { task, finalResult, reviewHistory, engineerId } as MergeConflictDetectedPayload
    };
    
    console.log(`📢 マージコンフリクト検出イベント発火: ${task.title}`);
    this.emit('MERGE_CONFLICT_DETECTED', event);
    this.emit('task-event', event);
  }

  /**
   * 開発完了イベントのリスナー登録
   */
  onDevelopmentCompleted(callback: (event: TaskEvent) => void): ListenerRegistration {
    return this.registerListener('DEVELOPMENT_COMPLETED', callback);
  }

  /**
   * レビュー完了イベントのリスナー登録
   */
  onReviewCompleted(callback: (event: TaskEvent) => void): ListenerRegistration {
    return this.registerListener('REVIEW_COMPLETED', callback);
  }

  /**
   * マージ準備完了イベントのリスナー登録
   */
  onMergeReady(callback: (event: TaskEvent) => void): ListenerRegistration {
    return this.registerListener('MERGE_READY', callback);
  }

  /**
   * マージ完了イベントのリスナー登録
   */
  onMergeCompleted(callback: (event: TaskEvent) => void): ListenerRegistration {
    return this.registerListener('MERGE_COMPLETED', callback);
  }

  /**
   * タスク失敗イベントのリスナー登録
   */
  onTaskFailed(callback: (event: TaskEvent) => void): ListenerRegistration {
    return this.registerListener('TASK_FAILED', callback);
  }

  /**
   * マージコンフリクト検出イベントのリスナー登録
   */
  onMergeConflictDetected(callback: (event: TaskEvent) => void): ListenerRegistration {
    return this.registerListener('MERGE_CONFLICT_DETECTED', callback);
  }

  /**
   * タスク完了イベントの発火（依存関係管理用）
   */
  emitTaskCompleted(task: Task, result: EngineerResult, engineerId: string): void {
    const event: TaskEvent = {
      type: 'TASK_COMPLETED',
      taskId: task.id,
      timestamp: new Date(),
      payload: { task, result, engineerId } as TaskCompletedPayload
    };
    
    console.log(`📢 タスク完了イベント発火: ${task.title}`);
    this.emit('TASK_COMPLETED', event);
    this.emit('task-event', event);
  }

  /**
   * 依存関係解決イベントの発火
   */
  emitDependencyResolved(resolvedTaskId: string, newReadyTasks: Task[]): void {
    const event: TaskEvent = {
      type: 'DEPENDENCY_RESOLVED',
      taskId: resolvedTaskId,
      timestamp: new Date(),
      payload: { resolvedTaskId, newReadyTasks } as DependencyResolvedPayload
    };
    
    console.log(`📢 依存関係解決イベント発火: ${resolvedTaskId} → 新たに実行可能: ${newReadyTasks.map(t => t.title).join(', ')}`);
    this.emit('DEPENDENCY_RESOLVED', event);
    this.emit('task-event', event);
  }

  /**
   * タスク完了イベントのリスナー登録
   */
  onTaskCompleted(callback: (event: TaskEvent) => void): ListenerRegistration {
    return this.registerListener('TASK_COMPLETED', callback);
  }

  /**
   * 依存関係解決イベントのリスナー登録
   */
  onDependencyResolved(callback: (event: TaskEvent) => void): ListenerRegistration {
    return this.registerListener('DEPENDENCY_RESOLVED', callback);
  }

  /**
   * 全イベントのリスナー登録
   */
  onAnyTaskEvent(callback: (event: TaskEvent) => void): ListenerRegistration {
    return this.registerListener('task-event', callback);
  }

  /**
   * リスナーを安全に登録
   */
  private registerListener(eventName: string, callback: (...args: any[]) => void): ListenerRegistration {
    const id = `${eventName}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // 弱参照でコールバックを保存
    const wrappedCallback = (...args: any[]) => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`🚨 イベントリスナーエラー [${eventName}]:`, error);
        this.handleListenerError(id, eventName, error);
      }
    };

    // リスナー登録
    this.on(eventName, wrappedCallback);
    this.activeListeners.add(wrappedCallback);

    // レジストリに記録
    if (!this.listenerRegistry.has(eventName)) {
      this.listenerRegistry.set(eventName, new Map());
    }
    this.listenerRegistry.get(eventName)!.set(id, wrappedCallback);

    console.log(`📝 イベントリスナー登録: ${eventName} (ID: ${id}, 総リスナー数: ${this.listenerCount()})`);

    const registration: ListenerRegistration = {
      id,
      event: eventName,
      callback: wrappedCallback,
      unregister: () => this.unregisterListener(id, eventName)
    };

    return registration;
  }

  /**
   * リスナーを安全に解除
   */
  private unregisterListener(id: string, eventName: string): void {
    const eventListeners = this.listenerRegistry.get(eventName);
    if (eventListeners && eventListeners.has(id)) {
      const callback = eventListeners.get(id)!;
      
      // EventEmitterから削除
      this.removeListener(eventName, callback);
      
      // アクティブリスナーから削除
      this.activeListeners.delete(callback);
      
      // レジストリから削除
      eventListeners.delete(id);
      if (eventListeners.size === 0) {
        this.listenerRegistry.delete(eventName);
      }

      console.log(`🗑️ イベントリスナー解除: ${eventName} (ID: ${id}, 残り総リスナー数: ${this.listenerCount()})`);
    }
  }

  /**
   * 特定イベントの全リスナーを解除
   */
  removeAllListenersForEvent(eventName: string): void {
    const eventListeners = this.listenerRegistry.get(eventName);
    if (eventListeners) {
      for (const [id, callback] of eventListeners) {
        this.removeListener(eventName, callback);
        this.activeListeners.delete(callback);
      }
      this.listenerRegistry.delete(eventName);
      console.log(`🧹 イベント全リスナー解除: ${eventName}`);
    }
  }

  /**
   * メモリ使用量監視開始
   */
  private startMemoryMonitoring(): void {
    this.memoryMonitoringInterval = setInterval(() => {
      const listenerCount = this.listenerCount();
      const memUsage = process.memoryUsage();
      
      if (listenerCount > 150) {
        console.warn(`⚠️ リスナー数が多すぎます: ${listenerCount}個`);
        this.logListenerBreakdown();
      }
      
      if (memUsage.heapUsed > 200 * 1024 * 1024) { // 200MB
        console.warn(`⚠️ メモリ使用量が高めです: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
      }
    }, 30000); // 30秒間隔
  }

  /**
   * リスナー数の詳細を表示
   */
  private logListenerBreakdown(): void {
    console.log('📊 イベントリスナー詳細:');
    for (const [eventName, listeners] of this.listenerRegistry) {
      console.log(`  - ${eventName}: ${listeners.size}個`);
    }
  }

  /**
   * 総リスナー数を取得
   */
  listenerCount(): number {
    return this.activeListeners.size;
  }

  /**
   * 最大リスナー数超過時の処理
   */
  private handleMaxListenersExceeded(): void {
    if (!this.maxListenersWarningShown) {
      console.warn('🚨 最大リスナー数に達しました。メモリリークの可能性があります。');
      this.logListenerBreakdown();
      this.maxListenersWarningShown = true;
    }
  }

  /**
   * リスナーエラー処理
   */
  private handleListenerError(id: string, eventName: string, error: any): void {
    console.error(`🚨 リスナーでエラー発生 [${eventName}][${id}]:`, error);
    
    // エラーが発生したリスナーを自動的に削除
    this.unregisterListener(id, eventName);
  }

  /**
   * 強制ガベージコレクション実行
   */
  forceGarbageCollection(): void {
    if (global.gc) {
      console.log('🗑️ 強制ガベージコレクション実行');
      global.gc();
    }
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    console.log('🧹 TaskEventEmitter クリーンアップ開始');
    
    // メモリ監視インターバルをクリア
    if (this.memoryMonitoringInterval) {
      clearInterval(this.memoryMonitoringInterval);
      this.memoryMonitoringInterval = undefined;
    }
    
    // 全リスナーを安全に解除
    for (const [eventName] of this.listenerRegistry) {
      this.removeAllListenersForEvent(eventName);
    }
    
    // 残っているリスナーを強制削除
    this.removeAllListeners();
    
    // 内部状態をクリア
    this.listenerRegistry.clear();
    this.activeListeners.clear();
    
    // 強制ガベージコレクション
    this.forceGarbageCollection();
    
    console.log('✅ TaskEventEmitter クリーンアップ完了');
  }

  /**
   * メモリ情報を取得
   */
  getMemoryInfo(): {
    listenerCount: number;
    eventCount: number;
    memoryUsage: NodeJS.MemoryUsage;
  } {
    return {
      listenerCount: this.listenerCount(),
      eventCount: this.listenerRegistry.size,
      memoryUsage: process.memoryUsage()
    };
  }
}