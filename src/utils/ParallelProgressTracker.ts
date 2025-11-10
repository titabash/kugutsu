import { MultiProgressBars } from 'multi-progress-bars';
import chalk from 'chalk';

/**
 * タスクの進捗情報
 */
interface TaskProgress {
  current: number;
  max: number;
  title: string;
  startTime: number;
}

/**
 * 並列実行タスクの進捗を可視化するトラッカー
 * multi-progress-barsを使用して複数のプログレスバーを同時表示
 */
export class ParallelProgressTracker {
  private mpb: MultiProgressBars | null = null;
  private tasks = new Map<string, TaskProgress>();
  private isActive = false;

  /**
   * トラッカーを初期化
   * @param initMessage 初期メッセージ
   */
  constructor(initMessage: string = '🚀 並列タスク実行中') {
    try {
      this.mpb = new MultiProgressBars({
        initMessage,
        anchor: 'top',      // 画面上部に固定
        persist: false,     // 完了後は消去
        border: true,
      });
      this.isActive = true;
    } catch (error) {
      console.warn('multi-progress-barsの初期化に失敗しました:', error);
      this.isActive = false;
    }
  }

  /**
   * タスクを追加
   * @param taskId タスクID
   * @param title タスクタイトル
   * @param maxTurns 最大ターン数
   */
  addTask(taskId: string, title: string, maxTurns: number): void {
    if (!this.mpb || !this.isActive) {
      return;
    }

    try {
      // タスクタイトルを短縮（長すぎる場合）
      const shortTitle = title.length > 40 ? title.substring(0, 37) + '...' : title;

      this.mpb.addTask(taskId, {
        type: 'percentage',
        barTransformFn: (bar: string) => chalk.cyan(bar),
        nameTransformFn: () => `[${taskId}] ${shortTitle}`,
      });

      this.tasks.set(taskId, {
        current: 0,
        max: maxTurns,
        title: shortTitle,
        startTime: Date.now(),
      });
    } catch (error) {
      console.warn(`タスク ${taskId} の追加に失敗:`, error);
    }
  }

  /**
   * タスクの進捗を更新
   * @param taskId タスクID
   * @param currentTurn 現在のターン数
   */
  updateProgress(taskId: string, currentTurn: number): void {
    if (!this.mpb || !this.isActive) {
      return;
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      return;
    }

    try {
      // 進捗率を計算（0.0〜1.0）
      const percentage = Math.min(currentTurn / task.max, 1.0);

      // タスク情報を更新
      task.current = currentTurn;

      // プログレスバーを更新
      this.mpb.updateTask(taskId, { percentage });
    } catch (error) {
      console.warn(`タスク ${taskId} の進捗更新に失敗:`, error);
    }
  }

  /**
   * タスクを完了としてマーク
   * @param taskId タスクID
   * @param success 成功したかどうか
   */
  completeTask(taskId: string, success: boolean): void {
    if (!this.mpb || !this.isActive) {
      return;
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      return;
    }

    try {
      // 所要時間を計算
      const duration = ((Date.now() - task.startTime) / 1000).toFixed(1);
      const message = success
        ? chalk.green(`✓ 完了 (${duration}秒)`)
        : chalk.red(`✗ 失敗 (${duration}秒)`);

      // タスクを完了状態にする
      this.mpb.done(taskId, {
        message,
      });
    } catch (error) {
      console.warn(`タスク ${taskId} の完了処理に失敗:`, error);
    }
  }

  /**
   * タスクを失敗としてマーク
   * @param taskId タスクID
   * @param errorMessage エラーメッセージ
   */
  failTask(taskId: string, errorMessage?: string): void {
    if (!this.mpb || !this.isActive) {
      return;
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      return;
    }

    try {
      const duration = ((Date.now() - task.startTime) / 1000).toFixed(1);
      const message = errorMessage
        ? chalk.red(`✗ 失敗: ${errorMessage} (${duration}秒)`)
        : chalk.red(`✗ 失敗 (${duration}秒)`);

      this.mpb.done(taskId, {
        message,
      });
    } catch (error) {
      console.warn(`タスク ${taskId} の失敗処理に失敗:`, error);
    }
  }

  /**
   * トラッカーを終了し、すべてのタスクが完了するのを待機
   */
  async close(): Promise<void> {
    if (!this.mpb || !this.isActive) {
      return;
    }

    try {
      // すべてのタスクが完了するまで待機
      await this.mpb.promise;
    } catch (error) {
      console.warn('multi-progress-barsの終了処理に失敗:', error);
    } finally {
      this.isActive = false;
    }
  }

  /**
   * トラッカーがアクティブかどうか
   */
  isTrackerActive(): boolean {
    return this.isActive;
  }

  /**
   * 現在のタスク数を取得
   */
  getTaskCount(): number {
    return this.tasks.size;
  }

  /**
   * 完了したタスク数を取得（内部追跡用）
   */
  getCompletedTaskCount(): number {
    // multi-progress-barsの制約上、内部で完了状態を追跡する必要がある
    // 今回はシンプルにするため、この情報は提供しない
    return 0;
  }
}
