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
    // タスク解析完了を検知してタスク数を更新
    if (this.useElectronUI && engineerId === 'ProductOwner' && message.includes('タスク数:')) {
      const match = message.match(/タスク数: (\d+)/);
      if (match) {
        this.totalTaskCount = parseInt(match[1], 10);
        electronLogAdapter.updateTaskStatus(0, this.totalTaskCount);
      }
    }
    
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
      
      // 注意: 全タスク完了イベントは親クラスで処理され、setupCompletionReporterListenersで
      // CompletionReporterから直接受信するため、ここでは重複登録しない

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
    // これにより、baseBranchの確認、CompletionReporterの初期化、setupCompletionReporterListenersが呼ばれる
    const result = await super.executeUserRequest(userRequest);

    return result;
  }
  
  /**
   * CompletionReporterのイベントリスナーを設定
   * executeUserRequest内でinitialize後に呼び出される
   */
  protected setupCompletionReporterListeners(): void {
    console.log(`[Electron] setupCompletionReporterListeners called. useElectronUI=${this.useElectronUI}, completionReporter=${!!this.completionReporter}`);
    
    if (this.useElectronUI && this.completionReporter) {
      console.log('[Electron] Setting up CompletionReporter listeners...');
      
      // 既存のリスナーを削除（CompletionReporter上のリスナーのみ）
      this.completionReporter.removeAllListeners('taskCompleted');
      this.completionReporter.removeAllListeners('allTasksCompleted');
      
      // タスク完了イベントをリッスン
      this.completionReporter.on('taskCompleted', ({ taskId, status }) => {
        console.log(`[Electron] Task completed event received: ${taskId} (${status.completedTasks}/${status.totalTasks})`);
        // Electron UIに進捗を通知
        electronLogAdapter.updateTaskStatus(status.completedTasks, status.totalTasks);
        this.log('system', 'success', `✅ タスク完了: ${taskId} (${status.completedTasks}/${status.totalTasks} - ${status.percentage}%)`, 'System');
      });
      
      // 全タスク完了イベント: CompletionReporterから直接受信してElectronに通知
      this.completionReporter.on('allTasksCompleted', (status) => {
        console.log('[Electron] All tasks completed event from CompletionReporter:', status);
        console.log('[Electron] Sending completion notification to Electron UI...');
        
        // Electronログにも表示
        electronLogAdapter.log('system', 'success', `🎉 全タスクが完了しました！ (${status.completedTasks}/${status.totalTasks} - ${status.percentage}%)`, 'System');
        
        // Electron UIに完了通知を送信
        electronLogAdapter.sendCompletionNotification(status);
        
        console.log('[Electron] Completion notification sent successfully');
      });
      
      console.log('[Electron] CompletionReporter listeners setup complete');
    } else {
      console.log('[Electron] Skipping CompletionReporter listener setup');
      console.log(`  useElectronUI: ${this.useElectronUI}`);
      console.log(`  completionReporter: ${!!this.completionReporter}`);
    }
  }

  /**
   * ログビューアーの停止（Electron対応版）
   */
  public stopLogViewer(): void {
    super.stopLogViewer();
    // Electronの場合は特に何もしない（ウィンドウは別プロセスで管理）
  }
}