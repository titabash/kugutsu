import { ParallelDevelopmentOrchestrator } from './ParallelDevelopmentOrchestrator.js';
import { electronLogAdapter } from '../utils/ElectronLogAdapter.js';
import { SystemConfig } from '../types/index.js';

/**
 * Electron対応並列開発オーケストレーター
 * ParallelDevelopmentOrchestratorを継承し、Electronログ表示に対応
 */
export class ParallelDevelopmentOrchestratorWithElectron extends ParallelDevelopmentOrchestrator {
  private useElectronUI: boolean;
  private totalTaskCount: number = 0;

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
        electronLogAdapter.updateTaskStatus(completedCount, this.totalTaskCount);
      });

      // タスク失敗時にElectronに通知
      this.eventEmitter.onTaskFailed((event) => {
        const completedCount = this.completedTasks.size + this.failedTasks.size;
        electronLogAdapter.updateTaskStatus(completedCount, this.totalTaskCount);
      });

      // 開発完了時にエンジニア数を更新
      this.eventEmitter.onDevelopmentCompleted((event) => {
        // パイプラインマネージャーの統計情報から取得
        if (this.pipelineManager) {
          const stats = this.pipelineManager.getStats();
          const activeEngineers = stats.development.processing;
          electronLogAdapter.updateEngineerCount(activeEngineers);
        }
      });

      // 定期的にステータスを更新
      const updateInterval = setInterval(() => {
        if (this.pipelineManager) {
          const stats = this.pipelineManager.getStats();
          const activeEngineers = stats.development.processing;
          electronLogAdapter.updateEngineerCount(activeEngineers);
          
          // タスクステータスも更新
          const completedCount = this.completedTasks.size + this.failedTasks.size;
          electronLogAdapter.updateTaskStatus(completedCount, this.totalTaskCount);
        }
      }, 1000); // 1秒ごとに更新

      // クリーンアップ時にインターバルをクリア
      this.eventEmitter.once('cleanup', () => {
        clearInterval(updateInterval);
      });
    }
  }

  /**
   * 開発開始時にElectronに初期状態を通知
   */
  async executeUserRequest(userRequest: string): Promise<{
    analysis: import('../types/index.js').TaskAnalysisResult;
    results: import('../types/index.js').EngineerResult[];
    reviewResults: import('../types/index.js').ReviewResult[][];
    completedTasks: string[];
    failedTasks: string[];
  }> {
    if (this.useElectronUI) {
      // 初期状態をElectronに通知
      electronLogAdapter.updateTaskStatus(0, 0);
      electronLogAdapter.updateEngineerCount(0);
    }

    // 親クラスのメソッドを呼び出す
    const result = await super.executeUserRequest(userRequest);

    if (this.useElectronUI) {
      // タスク総数を保存
      this.totalTaskCount = result.analysis.tasks.length;
      
      // タスク数を更新
      electronLogAdapter.updateTaskStatus(0, this.totalTaskCount);
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