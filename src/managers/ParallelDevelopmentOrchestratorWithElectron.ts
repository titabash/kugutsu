import { ParallelDevelopmentOrchestrator } from './ParallelDevelopmentOrchestrator';
import { electronLogAdapter } from '../utils/ElectronLogAdapter';
import { SystemConfig } from '../types';

/**
 * Electron対応並列開発オーケストレーター
 * ParallelDevelopmentOrchestratorを継承し、Electronログ表示に対応
 */
export class ParallelDevelopmentOrchestratorWithElectron extends ParallelDevelopmentOrchestrator {
  private useElectronUI: boolean;

  constructor(config: SystemConfig, useVisualUI: boolean = false, useElectronUI: boolean = false) {
    // ElectronUI使用時は既存のVisualUIを無効化
    super(config, useVisualUI && !useElectronUI);
    this.useElectronUI = useElectronUI;

    if (this.useElectronUI) {
      // Electronアダプターを初期化
      electronLogAdapter.initialize();
    }
  }

  /**
   * ログ出力メソッド（Electron対応版）
   * 親クラスのlogメソッドをオーバーライド
   */
  protected log(engineerId: string, level: 'info' | 'error' | 'warn' | 'debug' | 'success', message: string, component?: string, group?: string): void {
    if (this.useElectronUI) {
      // Electronにログを送信
      electronLogAdapter.log(engineerId, level, message, component);
    } else {
      // 親クラスのログメソッドを呼び出す
      super.log(engineerId, level, message, component, group);
    }
  }

  /**
   * イベントリスナーの設定（Electron対応版）
   * 親クラスのsetupEventListenersメソッドをオーバーライド
   */
  protected setupEventListeners(): void {
    super.setupEventListeners();

    if (this.useElectronUI) {
      // タスク完了時にElectronに通知
      this.eventEmitter.onMergeCompleted((event) => {
        const completedCount = this.completedTasks.size;
        const totalCount = this.activeTasks.size;
        electronLogAdapter.updateTaskStatus(completedCount, totalCount);
      });

      // タスク失敗時にElectronに通知
      this.eventEmitter.onTaskFailed((event) => {
        const completedCount = this.completedTasks.size;
        const totalCount = this.activeTasks.size;
        electronLogAdapter.updateTaskStatus(completedCount, totalCount);
      });

      // 開発完了時にエンジニア数を更新
      this.eventEmitter.onDevelopmentCompleted((event) => {
        // 現在のアクティブなエンジニア数を計算
        const activeEngineers = this.engineerPool.size;
        electronLogAdapter.updateEngineerCount(activeEngineers);
      });
    }
  }

  /**
   * 開発開始時にElectronに初期状態を通知
   */
  async executeUserRequest(userRequest: string): Promise<{
    analysis: import('../types').TaskAnalysisResult;
    results: import('../types').EngineerResult[];
    reviewResults: import('../types').ReviewResult[][];
    completedTasks: string[];
    failedTasks: string[];
  }> {
    if (this.useElectronUI) {
      // 初期状態をElectronに通知
      electronLogAdapter.updateTaskStatus(0, 0);
    }

    // 親クラスのメソッドを呼び出す
    const result = await super.executeUserRequest(userRequest);

    if (this.useElectronUI) {
      // 最終状態をElectronに通知
      electronLogAdapter.updateTaskStatus(result.completedTasks.length, result.analysis.tasks.length);
    }

    return result;
  }

  /**
   * ログビューアーの停止（Electron対応版）
   */
  public stopLogViewer(): void {
    super.stopLogViewer();
    // Electronの場合は特に何もしない（ウィンドウは別プロセスで管理）
  }
}