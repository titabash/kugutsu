import { EventEmitter } from 'events';
import { Task, EngineerResult, ReviewResult } from '../types/index.js';

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
 */
export class TaskEventEmitter extends EventEmitter {
  private static instance: TaskEventEmitter;

  private constructor() {
    super();
    this.setMaxListeners(100); // 多数の並列タスクに対応
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
  onDevelopmentCompleted(callback: (event: TaskEvent) => void): void {
    this.on('DEVELOPMENT_COMPLETED', callback);
  }

  /**
   * レビュー完了イベントのリスナー登録
   */
  onReviewCompleted(callback: (event: TaskEvent) => void): void {
    this.on('REVIEW_COMPLETED', callback);
  }

  /**
   * マージ準備完了イベントのリスナー登録
   */
  onMergeReady(callback: (event: TaskEvent) => void): void {
    this.on('MERGE_READY', callback);
  }

  /**
   * マージ完了イベントのリスナー登録
   */
  onMergeCompleted(callback: (event: TaskEvent) => void): void {
    this.on('MERGE_COMPLETED', callback);
  }

  /**
   * タスク失敗イベントのリスナー登録
   */
  onTaskFailed(callback: (event: TaskEvent) => void): void {
    this.on('TASK_FAILED', callback);
  }

  /**
   * マージコンフリクト検出イベントのリスナー登録
   */
  onMergeConflictDetected(callback: (event: TaskEvent) => void): void {
    this.on('MERGE_CONFLICT_DETECTED', callback);
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
  onTaskCompleted(callback: (event: TaskEvent) => void): void {
    this.on('TASK_COMPLETED', callback);
  }

  /**
   * 依存関係解決イベントのリスナー登録
   */
  onDependencyResolved(callback: (event: TaskEvent) => void): void {
    this.on('DEPENDENCY_RESOLVED', callback);
  }

  /**
   * 全イベントのリスナー登録
   */
  onAnyTaskEvent(callback: (event: TaskEvent) => void): void {
    this.on('task-event', callback);
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    this.removeAllListeners();
  }
}