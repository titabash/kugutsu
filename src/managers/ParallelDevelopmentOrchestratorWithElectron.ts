import { ProductOwnerAI } from './ProductOwnerAI';
import { GitWorktreeManager } from './GitWorktreeManager';
import { EngineerAI } from './EngineerAI';
import { ReviewWorkflow } from './ReviewWorkflow';
import { TaskInstructionManager } from '../utils/TaskInstructionManager';
import { ImprovedParallelLogViewer } from '../utils/ImprovedParallelLogViewer';
import { LogFormatter } from '../utils/LogFormatter';
import { ElectronLogAdapter, electronLogAdapter } from '../utils/ElectronLogAdapter';
import { Task, TaskAnalysisResult, EngineerResult, ReviewResult, SystemConfig } from '../types';

/**
 * Electron対応並列開発オーケストレーター
 * 既存のオーケストレーターを拡張し、Electronログ表示に対応
 */
export class ParallelDevelopmentOrchestratorWithElectron {
  private readonly productOwnerAI: ProductOwnerAI;
  private readonly gitManager: GitWorktreeManager;
  private readonly reviewWorkflow: ReviewWorkflow;
  private readonly config: SystemConfig;
  private readonly engineerPool: Map<string, EngineerAI> = new Map();
  private activeTasks: Map<string, Task> = new Map();
  private instructionManager?: TaskInstructionManager;
  private logViewer?: ImprovedParallelLogViewer;
  private useVisualUI: boolean;
  private useElectronUI: boolean;

  constructor(config: SystemConfig, useVisualUI: boolean = false, useElectronUI: boolean = false) {
    this.config = config;
    this.useVisualUI = useVisualUI && !useElectronUI; // ElectronUI使用時は既存のVisualUIを無効化
    this.useElectronUI = useElectronUI;
    this.productOwnerAI = new ProductOwnerAI(config.baseRepoPath);
    this.gitManager = new GitWorktreeManager(config.baseRepoPath, config.worktreeBasePath);
    this.reviewWorkflow = new ReviewWorkflow(this.gitManager, config);
    
    if (this.useVisualUI) {
      this.logViewer = new ImprovedParallelLogViewer();
    }

    if (this.useElectronUI) {
      // Electronアダプターを初期化
      electronLogAdapter.initialize();
    }
  }

  /**
   * ログ出力メソッド（Electron対応版）
   */
  private log(engineerId: string, level: 'info' | 'error' | 'warn' | 'debug' | 'success', message: string, component?: string, group?: string): void {
    if (this.useElectronUI) {
      // Electronにログを送信
      electronLogAdapter.log(engineerId, level, message, component);
    } else if (this.logViewer) {
      // 既存のビジュアルUIを使用
      this.logViewer.log(engineerId, level, message, component, group);
    } else {
      // フォールバック: 従来のconsole出力
      const formatted = LogFormatter.formatMessage(engineerId, level, message, component);
      console.log(LogFormatter.formatForConsole(formatted));
    }
  }

  private updateMainInfo(message: string): void {
    if (this.logViewer) {
      this.logViewer.updateMainInfo(message);
    }
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

      // Electronの場合、タスクステータスを初期化
      if (this.useElectronUI) {
        electronLogAdapter.updateTaskStatus(0, 0);
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

      // Electronの場合、タスク総数を更新
      if (this.useElectronUI) {
        electronLogAdapter.updateTaskStatus(0, analysis.tasks.length);
      }

      // 2. タスクの依存関係を解決
      const orderedTasks = this.productOwnerAI.resolveDependencies(analysis.tasks);
      this.log('ProductOwner', 'info', `🔗 依存関係解決完了`, 'Dependencies', 'Phase 1: Analysis');

      // 3. 並列実行グループの作成
      const executionGroups = this.createExecutionGroups(orderedTasks);
      this.log('system', 'info', `🏗️ フェーズ2: 並列実行準備`, 'Orchestrator', 'Phase 2: Preparation');
      this.log('system', 'info', `実行グループ作成: ${executionGroups.length}グループ`, 'Orchestrator', 'Phase 2: Preparation');
      
      if (this.logViewer) {
        this.updateMainInfo(`並列実行準備中... | グループ数: ${executionGroups.length} | ${new Date().toLocaleString()}`);
      }

      // 4. 並列開発
      this.log('system', 'info', '⚡ フェーズ3: 並列開発', 'Orchestrator', 'Phase 3: Development');
      const { results, reviewResults, completedTasks, failedTasks } = await this.executeTasksInParallel(executionGroups);

      this.log('system', 'info', '🔍 フェーズ4: レビュー（コンフリクト解消含む）', 'Orchestrator', 'Phase 4: Review');
      
      // 5. 全ての保留中のコンフリクト解消処理の完了を待機
      this.log('system', 'info', '🔄 コンフリクト解消処理の確認中...', 'Orchestrator', 'Phase 4: Review');
      await this.reviewWorkflow.waitForAllConflictResolutions();
      
      // 6. コンフリクト解消後の再レビューとマージ
      this.log('system', 'info', '🔍 コンフリクト解消結果の処理中...', 'Orchestrator', 'Phase 4: Review');
      const reReviewResults = await this.reviewWorkflow.handleConflictResolutionResults();
      
      // 再レビュー結果のログ出力
      if (reReviewResults.size > 0) {
        this.log('system', 'info', `📊 コンフリクト解消後の再レビュー結果: ${reReviewResults.size}件`, 'Orchestrator', 'Phase 4: Review');
        for (const [taskId, success] of reReviewResults) {
          if (success) {
            this.log('system', 'success', `✅ 再レビュー承認・マージ完了: ${taskId}`, 'Orchestrator', 'Phase 4: Review');
          } else {
            this.log('system', 'error', `❌ 再レビュー失敗: ${taskId}`, 'Orchestrator', 'Phase 4: Review');
          }
        }
      } else {
        this.log('system', 'info', `ℹ️ コンフリクト解消が必要なタスクはありませんでした`, 'Orchestrator', 'Phase 4: Review');
      }
      
      this.log('system', 'success', '✅ フェーズ5: 完了', 'Orchestrator', 'Phase 5: Completion');
      this.log('system', 'info', `📊 完了タスク: ${completedTasks.length}個`, 'Orchestrator', 'Phase 5: Completion');
      this.log('system', 'info', `📊 失敗タスク: ${failedTasks.length}個`, 'Orchestrator', 'Phase 5: Completion');
      
      if (this.logViewer) {
        this.updateMainInfo(`完了 | 成功: ${completedTasks.length} | 失敗: ${failedTasks.length} | ${new Date().toLocaleString()}`);
      }
      
      return { analysis, results, reviewResults, completedTasks, failedTasks };

    } catch (error) {
      this.log('system', 'error', `❌ 並列開発エラー: ${error instanceof Error ? error.message : String(error)}`, 'Orchestrator', 'System Error');
      throw error;
    } finally {
      if (this.logViewer) {
        this.logViewer.destroy();
      }
      if (this.useElectronUI) {
        // Electronアダプターのクリーンアップは必要に応じて
      }
    }
  }

  /**
   * タスクを依存関係に基づいて実行グループに分割
   */
  private createExecutionGroups(tasks: Task[]): Task[][] {
    const groups: Task[][] = [];
    const processed = new Set<string>();

    for (const task of tasks) {
      if (processed.has(task.id)) continue;

      // 同時実行可能なタスクを見つける
      const currentGroup: Task[] = [task];
      processed.add(task.id);

      // 残りのタスクで依存関係がないものを同じグループに追加
      for (const otherTask of tasks) {
        if (processed.has(otherTask.id)) continue;

        // 依存関係チェック
        const hasDependencyConflict = this.hasDependencyConflict(
          currentGroup, 
          otherTask, 
          processed
        );

        if (!hasDependencyConflict && currentGroup.length < this.config.maxConcurrentEngineers) {
          currentGroup.push(otherTask);
          processed.add(otherTask.id);
        }
      }

      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * 依存関係の競合をチェック
   */
  private hasDependencyConflict(group: Task[], candidate: Task, processed: Set<string>): boolean {
    // 候補タスクが処理済みタスクに依存している場合
    if (candidate.dependencies.some(dep => processed.has(dep))) {
      return true;
    }

    // グループ内のタスクが候補タスクに依存している場合
    if (group.some(task => task.dependencies.includes(candidate.id))) {
      return true;
    }

    // 候補タスクがグループ内のタスクに依存している場合
    if (candidate.dependencies.some(dep => group.some(task => task.id === dep))) {
      return true;
    }

    return false;
  }

  /**
   * 並列実行とレビューを実行
   */
  private async executeTasksInParallel(executionGroups: Task[][]): Promise<{
    results: EngineerResult[];
    reviewResults: ReviewResult[][];
    completedTasks: string[];
    failedTasks: string[];
  }> {
    const allResults: EngineerResult[] = [];
    const allReviewResults: ReviewResult[][] = [];
    const completedTasks: string[] = [];
    const failedTasks: string[] = [];

    for (let groupIndex = 0; groupIndex < executionGroups.length; groupIndex++) {
      const group = executionGroups[groupIndex];
      this.log('system', 'info', `🔥 グループ ${groupIndex + 1}/${executionGroups.length} 開発開始 (${group.length}タスク)`, 'Orchestrator', 'Phase 3: Development');

      // Electronの場合、エンジニア数を更新
      if (this.useElectronUI) {
        electronLogAdapter.updateEngineerCount(group.length);
      }

      // 各タスクにworktreeを作成
      await this.setupWorktreesForGroup(group);

      // エンジニアAIを並列実行
      const groupResults = await this.executeGroupInParallel(group);
      allResults.push(...groupResults);

      // レビューワークフローを実行
      this.log('system', 'info', `🔍 グループ ${groupIndex + 1} レビュー開始`, 'Orchestrator', 'Phase 4: Review');
      const groupReviewResults = await this.executeReviewWorkflow(group, groupResults);
      allReviewResults.push(...groupReviewResults);

      // 結果の分類とElectronステータス更新
      for (const result of groupResults) {
        if (result.success) {
          const reviewResult = groupReviewResults.find(r => r.some(review => review.taskId === result.taskId));
          if (reviewResult && reviewResult.length > 0) {
            const lastReview = reviewResult[reviewResult.length - 1];
            if (lastReview.status === 'APPROVED' || lastReview.status === 'COMMENTED') {
              completedTasks.push(result.taskId);
            } else {
              failedTasks.push(result.taskId);
            }
          } else {
            failedTasks.push(result.taskId);
          }
        } else {
          failedTasks.push(result.taskId);
        }

        // Electronの場合、タスクステータスを更新
        if (this.useElectronUI) {
          electronLogAdapter.updateTaskStatus(completedTasks.length, allResults.length);
        }
      }

      this.log('system', 'success', `✅ グループ ${groupIndex + 1} 完了`, 'Orchestrator', groupIndex === executionGroups.length - 1 ? 'Phase 4: Review' : 'Phase 3: Development');
    }

    return {
      results: allResults,
      reviewResults: allReviewResults,
      completedTasks,
      failedTasks
    };
  }

  /**
   * グループのworktreeをセットアップ
   */
  private async setupWorktreesForGroup(tasks: Task[]): Promise<void> {
    for (const task of tasks) {
      const worktreePath = await this.gitManager.createWorktree(task);
      task.worktreePath = worktreePath;
      this.activeTasks.set(task.id, task);
    }
  }

  /**
   * グループを並列実行
   */
  private async executeGroupInParallel(tasks: Task[]): Promise<EngineerResult[]> {
    const engineerPromises = tasks.map(task => this.executeEngineerTask(task));
    return await Promise.all(engineerPromises);
  }

  /**
   * エンジニアタスクを実行
   */
  private async executeEngineerTask(task: Task): Promise<EngineerResult> {
    const engineerId = `engineer-${task.id}`;
    const engineer = new EngineerAI(engineerId, {
      maxTurns: this.config.maxTurnsPerTask
    });
    this.engineerPool.set(engineerId, engineer);

    try {
      // タスク実行
      const result = await engineer.executeTask(task);
      
      return {
        taskId: task.id,
        engineerId: engineerId,
        success: result.success,
        output: result.output,
        error: result.error,
        duration: result.duration,
        filesChanged: result.filesChanged || [],
        needsReReview: result.needsReReview
      };
    } catch (error) {
      return {
        taskId: task.id,
        engineerId: engineerId,
        success: false,
        output: [],
        error: error instanceof Error ? error.message : String(error),
        duration: 0,
        filesChanged: []
      };
    }
  }

  /**
   * レビューワークフローを実行
   */
  private async executeReviewWorkflow(tasks: Task[], results: EngineerResult[]): Promise<ReviewResult[][]> {
    const reviewResults: ReviewResult[][] = [];
    
    // 成功したタスクのみレビュー対象とする
    const successfulTasks = tasks.filter(task => {
      const result = results.find(r => r.taskId === task.id);
      return result && result.success;
    });

    if (successfulTasks.length === 0) {
      this.log('system', 'warn', '⚠️ レビュー対象のタスクがありません', 'Orchestrator');
      return reviewResults;
    }

    this.log('system', 'info', `📝 ${successfulTasks.length}個のタスクをレビュー中...`, 'Orchestrator');

    // 各タスクのレビューを並列実行
    const reviewPromises = successfulTasks.map(async (task) => {
      const engineerResult = results.find(r => r.taskId === task.id);
      if (!engineerResult) {
        return [];
      }

      try {
        // エンジニアIDを結果から取得
        const engineerId = engineerResult.engineerId;
        
        // レビューワークフローを実行
        const workflowResult = await this.reviewWorkflow.executeReviewWorkflow(
          task,
          engineerResult,
          engineerId,
          this.engineerPool.get(engineerId) // エンジニアインスタンスを渡す
        );

        this.log('system', 'info', `🔍 タスク ${task.id} レビュー完了: ${workflowResult.approved ? '承認' : '未承認'}`, 'TechLead');
        
        return workflowResult.reviewHistory;

      } catch (error) {
        this.log('system', 'error', `❌ タスク ${task.id} レビューエラー: ${error}`, 'TechLead');
        return [{
          taskId: task.id,
          status: 'ERROR' as const,
          comments: [`レビューワークフローエラー: ${error}`],
          reviewer: 'system',
          reviewedAt: new Date(),
          duration: 0,
          error: error instanceof Error ? error.message : String(error)
        }];
      }
    });

    const allReviewResults = await Promise.all(reviewPromises);
    reviewResults.push(...allReviewResults);

    return reviewResults;
  }

  /**
   * クリーンアップ
   */
  private async cleanup(): Promise<void> {
    // Worktreeのクリーンアップ
    for (const task of this.activeTasks.values()) {
      if (task.worktreePath) {
        await this.gitManager.removeWorktree(task.id);
      }
    }
    
    this.activeTasks.clear();
    this.engineerPool.clear();
  }
}