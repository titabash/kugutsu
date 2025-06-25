import { ProductOwnerAI } from './ProductOwnerAI.js';
import { GitWorktreeManager } from './GitWorktreeManager.js';
import { EngineerAI } from './EngineerAI.js';
import { ReviewWorkflow } from './ReviewWorkflow.js';
import { ParallelPipelineManager } from './ParallelPipelineManager.js';
import { TaskInstructionManager } from '../utils/TaskInstructionManager.js';
import { ImprovedParallelLogViewer } from '../utils/ImprovedParallelLogViewer.js';
import { LogFormatter } from '../utils/LogFormatter.js';
import { TaskEventEmitter, TaskEvent, TaskFailedPayload, MergeCompletedPayload, ReviewCompletedPayload } from '../utils/TaskEventEmitter.js';
import { Task, TaskAnalysisResult, EngineerResult, ReviewResult, SystemConfig } from '../types/index.js';

/**
 * 並列開発オーケストレーター
 * プロダクトオーナーAI、git worktree、エンジニアAIを統合管理
 */
export class ParallelDevelopmentOrchestrator {
  protected readonly productOwnerAI: ProductOwnerAI;
  protected readonly gitManager: GitWorktreeManager;
  protected readonly reviewWorkflow: ReviewWorkflow;
  protected readonly pipelineManager: ParallelPipelineManager;
  protected readonly config: SystemConfig;
  protected readonly engineerPool: Map<string, EngineerAI> = new Map();
  protected activeTasks: Map<string, Task> = new Map();
  protected instructionManager?: TaskInstructionManager;
  protected logViewer?: ImprovedParallelLogViewer;
  protected useVisualUI: boolean;
  protected eventEmitter: TaskEventEmitter;
  protected completedTasks: Set<string> = new Set();
  protected failedTasks: Map<string, string> = new Map();
  protected taskResults: Map<string, EngineerResult> = new Map();
  protected reviewResults: Map<string, ReviewResult[]> = new Map();

  constructor(config: SystemConfig, useVisualUI: boolean = false) {
    this.config = config;
    this.useVisualUI = useVisualUI;
    this.productOwnerAI = new ProductOwnerAI(config.baseRepoPath);
    this.gitManager = new GitWorktreeManager(config.baseRepoPath, config.worktreeBasePath);
    this.reviewWorkflow = new ReviewWorkflow(this.gitManager, config);
    this.pipelineManager = new ParallelPipelineManager(this.gitManager, config);
    this.eventEmitter = TaskEventEmitter.getInstance();
    
    if (this.useVisualUI) {
      this.logViewer = new ImprovedParallelLogViewer();
    }
    
    // イベントリスナーの設定
    this.setupEventListeners();
  }

  /**
   * イベントリスナーの設定
   */
  protected setupEventListeners(): void {
    // マージ完了イベント
    this.eventEmitter.onMergeCompleted((event: TaskEvent) => {
      const payload = event.payload as MergeCompletedPayload;
      if (payload.success) {
        this.completedTasks.add(payload.task.id);
        this.log('system', 'success', `✅ タスク完了: ${payload.task.title}`, 'Merge', 'Completion');
      } else {
        this.failedTasks.set(payload.task.id, payload.error || 'マージに失敗しました');
        this.log('system', 'error', `❌ タスク失敗: ${payload.task.title}`, 'Merge', 'Failure');
      }
    });

    // タスク失敗イベント
    this.eventEmitter.onTaskFailed((event: TaskEvent) => {
      const payload = event.payload as TaskFailedPayload;
      this.failedTasks.set(payload.task.id, payload.error);
      this.log('system', 'error', `❌ タスク失敗: ${payload.task.title} (${payload.phase})`, 'Task', 'Failure');
    });

    // タスクイベントの統計用
    this.eventEmitter.onAnyTaskEvent((event: TaskEvent) => {
      if (event.type === 'DEVELOPMENT_COMPLETED') {
        const result = event.payload.result as EngineerResult;
        this.taskResults.set(event.taskId, result);
      } else if (event.type === 'REVIEW_COMPLETED') {
        const payload = event.payload as ReviewCompletedPayload;
        // レビュー履歴を保存
        const history = this.reviewResults.get(event.taskId) || [];
        history.push(payload.reviewResult);
        this.reviewResults.set(event.taskId, history);
      }
    });
  }

  /**
   * ユーザー要求を受け取り、並列開発を実行（レビュー含む）
   */
  async executeUserRequest(userRequest: string): Promise<{
    analysis: TaskAnalysisResult;
    results: EngineerResult[];
    reviewResults: ReviewResult[][];
    completedTasks: string[];
    failedTasks: string[];
  }> {
    this.log('system', 'info', '🚀 並列開発システム開始', 'System', 'System Startup');
    this.log('system', 'info', `📝 ユーザー要求: ${userRequest}`, 'System', 'System Startup');

    try {
      // TaskInstructionManagerを初期化
      this.instructionManager = new TaskInstructionManager();
      
      // ログビューアーを開始
      if (this.logViewer) {
        this.logViewer.start();
        this.updateMainInfo(`要求分析中... | ${new Date().toLocaleString()}`);
      }

      // 1. プロダクトオーナーAIによる要求分析
      this.log('ProductOwner', 'info', '📊 フェーズ1: 要求分析', 'Analysis', 'Phase 1: Analysis');
      const analysis = await this.productOwnerAI.analyzeUserRequestWithInstructions(
        userRequest, 
        this.instructionManager
      );
      
      this.log('ProductOwner', 'info', `📋 分析結果:`, 'Analysis', 'Phase 1: Analysis');
      this.log('ProductOwner', 'info', `- 概要: ${analysis.summary}`, 'Analysis', 'Phase 1: Analysis');
      this.log('ProductOwner', 'info', `- 見積もり時間: ${analysis.estimatedTime}`, 'Analysis', 'Phase 1: Analysis');
      this.log('ProductOwner', 'info', `- タスク数: ${analysis.tasks.length}`, 'Analysis', 'Phase 1: Analysis');
      this.log('ProductOwner', 'info', `- リスク: ${analysis.riskAssessment}`, 'Analysis', 'Phase 1: Analysis');

      // 2. タスクの依存関係を解決
      const orderedTasks = this.productOwnerAI.resolveDependencies(analysis.tasks);
      this.log('ProductOwner', 'info', `🔗 依存関係解決完了`, 'Dependencies', 'Phase 1: Analysis');

      // 3. パイプラインマネージャーを開始
      this.log('system', 'info', '🏗️ フェーズ2: 並列パイプライン開始', 'Orchestrator', 'Phase 2: Pipeline');
      await this.pipelineManager.start();
      
      if (this.logViewer) {
        this.updateMainInfo(`並列パイプライン実行中... | タスク数: ${orderedTasks.length} | ${new Date().toLocaleString()}`);
      }

      // 4. 全タスクをパイプラインに投入
      this.log('system', 'info', '⚡ フェーズ3: タスク投入', 'Orchestrator', 'Phase 3: Task Enqueue');
      for (const task of orderedTasks) {
        this.activeTasks.set(task.id, task);
        await this.pipelineManager.enqueueDevelopment(task);
        this.log('system', 'info', `📥 タスク投入: ${task.title}`, 'Pipeline', 'Task Enqueue');
      }

      // 5. 全パイプラインの完了を待機
      this.log('system', 'info', '⏳ フェーズ4: パイプライン完了待機', 'Orchestrator', 'Phase 4: Waiting');
      await this.pipelineManager.waitForCompletion();
      
      // 6. 結果の集計
      this.log('system', 'info', '📊 フェーズ5: 結果集計', 'Orchestrator', 'Phase 5: Results');
      
      // 結果のまとめ
      const results: EngineerResult[] = Array.from(this.taskResults.values());
      const reviewResults: ReviewResult[][] = Array.from(this.reviewResults.values());
      const completedTasks = Array.from(this.completedTasks);
      const failedTasks = Array.from(this.failedTasks.keys());
      
      // 7. 最終結果の集計
      this.log('system', 'info', '📊 最終結果集計', 'Orchestrator', 'Final Results');
      this.log('system', 'success', `✅ 完了タスク: ${completedTasks.length}件`, 'Orchestrator', 'Final Results');
      this.log('system', 'error', `❌ 失敗タスク: ${failedTasks.length}件`, 'Orchestrator', 'Final Results');
      
      // パイプライン統計
      const pipelineStats = this.pipelineManager.getStats();
      this.log('system', 'info', `📊 パイプライン統計:`, 'Pipeline', 'Statistics');
      this.log('system', 'info', `  - 開発: 待機=${pipelineStats.development.waiting}, 処理中=${pipelineStats.development.processing}`, 'Pipeline', 'Statistics');
      this.log('system', 'info', `  - レビュー: 待機=${pipelineStats.review.waiting}, 処理中=${pipelineStats.review.processing}, 完了=${pipelineStats.review.totalReviewed}`, 'Pipeline', 'Statistics');
      this.log('system', 'info', `  - マージ: 待機=${pipelineStats.merge.queueLength}, 処理中=${pipelineStats.merge.isProcessing}`, 'Pipeline', 'Statistics');
      
      if (this.logViewer) {
        this.updateMainInfo(`完了 | 成功: ${completedTasks.length}件, 失敗: ${failedTasks.length}件 | ${new Date().toLocaleString()}`);
        this.logViewer.destroy();
      }
      
      return { analysis, results, reviewResults, completedTasks, failedTasks };

    } catch (error) {
      this.log('system', 'error', `❌ 並列開発エラー: ${error instanceof Error ? error.message : String(error)}`, 'Orchestrator', 'System Error');
      throw error;
    }
  }







  /**
   * システムクリーンアップ
   */
  async cleanup(cleanupWorktrees: boolean = false): Promise<void> {
    console.log('🧹 システムクリーンアップ開始');

    // パイプラインマネージャーを停止
    await this.pipelineManager.stop();

    // アクティブなタスクをクリア
    this.activeTasks.clear();

    // エンジニアプールをクリア
    this.engineerPool.clear();

    // Worktreeのクリーンアップ（オプション）
    if (cleanupWorktrees) {
      await this.gitManager.cleanupAllTaskWorktrees();
    }

    // TaskInstructionManagerのクリーンアップ
    if (this.instructionManager) {
      await this.instructionManager.cleanup();
      this.instructionManager = undefined;
    }

    console.log('✅ クリーンアップ完了');
  }

  /**
   * 現在のシステム状態を取得
   */
  getSystemStatus(): {
    activeTasks: Task[];
    activeEngineers: string[];
    config: SystemConfig;
  } {
    return {
      activeTasks: Array.from(this.activeTasks.values()),
      activeEngineers: Array.from(this.engineerPool.keys()),
      config: this.config
    };
  }

  /**
   * 特定のタスクを強制停止
   */
  async abortTask(taskId: string): Promise<boolean> {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      console.warn(`⚠️ タスク ${taskId} が見つかりません`);
      return false;
    }

    try {
      task.status = 'failed';
      this.activeTasks.delete(taskId);
      
      if (task.worktreePath) {
        await this.gitManager.cleanupCompletedTask(taskId);
      }

      console.log(`🛑 タスク ${taskId} を強制停止しました`);
      return true;

    } catch (error) {
      console.error(`❌ タスク ${taskId} の停止に失敗:`, error);
      return false;
    }
  }

  /**
   * ログ出力ヘルパーメソッド
   */
  protected log(engineerId: string, level: 'info' | 'error' | 'warn' | 'debug' | 'success', message: string, component?: string, group?: string): void {
    if (this.logViewer) {
      this.logViewer.log(engineerId, level, message, component, group);
    } else {
      // フォールバック: 従来のconsole出力
      const formatted = LogFormatter.formatMessage(engineerId, level, message, component);
      console.log(LogFormatter.formatForConsole(formatted));
    }
  }

  /**
   * 新しいエンジニアをログビューアーに登録
   */
  private registerEngineerInViewer(engineerId: string, taskTitle: string): void {
    if (this.logViewer && !this.logViewer.isEngineerActive(engineerId)) {
      this.logViewer.addEngineer(engineerId, `🔧 ${taskTitle}`);
    }
  }

  /**
   * エンジニアをログビューアーから削除
   */
  private unregisterEngineerFromViewer(engineerId: string): void {
    if (this.logViewer && this.logViewer.isEngineerActive(engineerId)) {
      this.logViewer.removeEngineer(engineerId);
    }
  }

  /**
   * ログビューアーを開始
   */
  public startLogViewer(): void {
    if (this.logViewer) {
      this.logViewer.start();
    }
  }

  /**
   * ログビューアーを終了
   */
  public stopLogViewer(): void {
    if (this.logViewer) {
      this.logViewer.destroy();
    }
  }

  /**
   * メイン情報を更新
   */
  private updateMainInfo(content: string): void {
    if (this.logViewer) {
      this.logViewer.updateMainInfo(content);
    }
  }
}