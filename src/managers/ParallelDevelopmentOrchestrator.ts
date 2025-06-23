import { ProductOwnerAI } from './ProductOwnerAI';
import { GitWorktreeManager } from './GitWorktreeManager';
import { EngineerAI } from './EngineerAI';
import { ReviewWorkflow } from './ReviewWorkflow';
import { TaskInstructionManager } from '../utils/TaskInstructionManager';
import { ParallelLogViewer } from '../utils/ParallelLogViewer';
import { LogFormatter } from '../utils/LogFormatter';
import { Task, TaskAnalysisResult, EngineerResult, ReviewResult, SystemConfig } from '../types';

/**
 * 並列開発オーケストレーター
 * プロダクトオーナーAI、git worktree、エンジニアAIを統合管理
 */
export class ParallelDevelopmentOrchestrator {
  private readonly productOwnerAI: ProductOwnerAI;
  private readonly gitManager: GitWorktreeManager;
  private readonly reviewWorkflow: ReviewWorkflow;
  private readonly config: SystemConfig;
  private readonly engineerPool: Map<string, EngineerAI> = new Map();
  private activeTasks: Map<string, Task> = new Map();
  private instructionManager?: TaskInstructionManager;
  private logViewer?: ParallelLogViewer;
  private useVisualUI: boolean;

  constructor(config: SystemConfig, useVisualUI: boolean = false) {
    this.config = config;
    this.useVisualUI = useVisualUI;
    this.productOwnerAI = new ProductOwnerAI(config.baseRepoPath);
    this.gitManager = new GitWorktreeManager(config.baseRepoPath, config.worktreeBasePath);
    this.reviewWorkflow = new ReviewWorkflow(this.gitManager, config);
    
    if (this.useVisualUI) {
      this.logViewer = new ParallelLogViewer();
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
    this.log('system', 'info', '🚀 並列開発システム開始');
    this.log('system', 'info', `📝 ユーザー要求: ${userRequest}`);

    try {
      // TaskInstructionManagerを初期化
      this.instructionManager = new TaskInstructionManager();
      
      // ログビューアーを開始
      if (this.logViewer) {
        this.logViewer.start();
        this.updateMainInfo(`要求分析中... | ${new Date().toLocaleString()}`);
      }

      // 1. プロダクトオーナーAIによる要求分析
      this.log('ProductOwner', 'info', '📊 フェーズ1: 要求分析', 'Analysis');
      const analysis = await this.productOwnerAI.analyzeUserRequestWithInstructions(
        userRequest, 
        this.instructionManager
      );
      
      this.log('ProductOwner', 'info', `📋 分析結果:`, 'Analysis');
      this.log('ProductOwner', 'info', `- 概要: ${analysis.summary}`, 'Analysis');
      this.log('ProductOwner', 'info', `- 見積もり時間: ${analysis.estimatedTime}`, 'Analysis');
      this.log('ProductOwner', 'info', `- タスク数: ${analysis.tasks.length}`, 'Analysis');
      this.log('ProductOwner', 'info', `- リスク: ${analysis.riskAssessment}`, 'Analysis');

      // 2. タスクの依存関係を解決
      const orderedTasks = this.productOwnerAI.resolveDependencies(analysis.tasks);
      this.log('ProductOwner', 'info', `🔗 依存関係解決完了`, 'Dependencies');

      // 3. 並列実行グループの作成
      const executionGroups = this.createExecutionGroups(orderedTasks);
      this.log('system', 'info', `🏗️ 実行グループ作成: ${executionGroups.length}グループ`, 'Orchestrator');
      
      if (this.logViewer) {
        this.updateMainInfo(`並列実行準備中... | グループ数: ${executionGroups.length} | ${new Date().toLocaleString()}`);
      }

      // 4. 並列実行（レビュー含む）
      this.log('system', 'info', '⚡ フェーズ2: 並列実行・レビュー開始', 'Orchestrator');
      const { results, reviewResults, completedTasks, failedTasks } = await this.executeTasksInParallel(executionGroups);

      this.log('system', 'info', '✅ 並列開発・レビュー完了', 'Orchestrator');
      this.log('system', 'info', `📊 完了タスク: ${completedTasks.length}個`, 'Orchestrator');
      this.log('system', 'info', `📊 失敗タスク: ${failedTasks.length}個`, 'Orchestrator');
      
      if (this.logViewer) {
        this.updateMainInfo(`完了 | 成功: ${completedTasks.length} | 失敗: ${failedTasks.length} | ${new Date().toLocaleString()}`);
      }
      
      return { analysis, results, reviewResults, completedTasks, failedTasks };

    } catch (error) {
      this.log('system', 'error', `❌ 並列開発エラー: ${error instanceof Error ? error.message : String(error)}`, 'Orchestrator');
      throw error;
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
          currentGroup.concat([otherTask])
        );

        if (!hasDependencyConflict && currentGroup.length < this.config.maxConcurrentEngineers) {
          currentGroup.push(otherTask);
          processed.add(otherTask.id);
        }
      }

      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
    }

    return groups;
  }

  /**
   * タスクグループ内に依存関係の競合があるかチェック
   */
  private hasDependencyConflict(tasks: Task[]): boolean {
    const taskTitles = new Set(tasks.map(t => t.title));
    
    for (const task of tasks) {
      for (const dependency of task.dependencies) {
        if (taskTitles.has(dependency)) {
          return true; // 同じグループ内のタスクに依存している
        }
      }
    }
    
    return false;
  }

  /**
   * タスクグループを並列実行（レビュー含む）
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
      console.log(`\n🔥 グループ ${groupIndex + 1}/${executionGroups.length} 実行開始 (${group.length}タスク)`);

      // 各タスクにworktreeを作成
      await this.setupWorktreesForGroup(group);

      // エンジニアAIを並列実行
      const groupResults = await this.executeGroupInParallel(group);
      allResults.push(...groupResults);

      // レビューワークフローを実行
      console.log(`\n🔍 グループ ${groupIndex + 1} レビューフェーズ開始`);
      const groupReviewResults = await this.executeReviewWorkflow(group, groupResults);
      allReviewResults.push(...groupReviewResults);

      // 結果の分類
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
      }

      console.log(`✅ グループ ${groupIndex + 1} 完了（開発・レビュー）`);
    }

    return {
      results: allResults,
      reviewResults: allReviewResults,
      completedTasks,
      failedTasks
    };
  }

  /**
   * グループのレビューワークフローを実行
   */
  private async executeReviewWorkflow(tasks: Task[], results: EngineerResult[]): Promise<ReviewResult[][]> {
    const reviewResults: ReviewResult[][] = [];

    // 成功したタスクのみレビュー対象とする
    const successfulTasks = tasks.filter(task => {
      const result = results.find(r => r.taskId === task.id);
      return result && result.success;
    });

    if (successfulTasks.length === 0) {
      console.log('⚠️ レビュー対象のタスクがありません');
      return reviewResults;
    }

    console.log(`📝 ${successfulTasks.length}個のタスクをレビュー中...`);

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

        console.log(`🔍 タスク ${task.id} レビュー完了: ${workflowResult.approved ? '承認' : '未承認'}`);
        
        return workflowResult.reviewHistory;

      } catch (error) {
        console.error(`❌ タスク ${task.id} レビューエラー:`, error);
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
   * グループ内のタスクにworktreeを設定
   */
  private async setupWorktreesForGroup(tasks: Task[]): Promise<void> {
    console.log(`🌿 Worktree設定中...`);
    
    const setupPromises = tasks.map(async (task) => {
      try {
        const worktreePath = await this.gitManager.createWorktree(task, this.config.baseBranch);
        task.worktreePath = worktreePath;
        task.status = 'in_progress';
        this.activeTasks.set(task.id, task);
        
        this.log('system', 'info', `✅ ${task.title}: ${worktreePath}`, 'GitWorktree');
      } catch (error) {
        this.log('system', 'error', `❌ ${task.title}: Worktree作成失敗 - ${error}`, 'GitWorktree');
        task.status = 'failed';
      }
    });

    await Promise.all(setupPromises);
  }

  /**
   * グループ内のタスクを並列実行
   */
  private async executeGroupInParallel(tasks: Task[]): Promise<EngineerResult[]> {
    // 有効なタスクのみを実行
    const validTasks = tasks.filter(task => task.status === 'in_progress' && task.worktreePath);
    
    if (validTasks.length === 0) {
      this.log('system', 'warn', '⚠️ 実行可能なタスクがありません', 'Orchestrator');
      return [];
    }

    this.log('system', 'info', `👥 ${validTasks.length}名のエンジニアAIを並列起動...`, 'Orchestrator');

    // 各タスクにエンジニアAIを割り当てて並列実行
    const executionPromises = validTasks.map(async (task, index) => {
      const engineerId = `engineer-${Date.now()}-${index}`;
      const engineer = new EngineerAI(engineerId, {
        maxTurns: this.config.maxTurnsPerTask
      });

      this.engineerPool.set(engineerId, engineer);
      this.registerEngineerInViewer(engineerId, task.title);

      try {
        // タスクの事前チェック
        const validation = await engineer.validateTask(task);
        if (!validation.valid) {
          throw new Error(`タスク検証失敗: ${validation.reason}`);
        }

        // タスク実行
        const result = await engineer.executeTask(task);
        
        if (result.success) {
          task.status = 'completed';
          this.log(engineerId, 'info', `✅ ${task.title} 完了`, 'EngineerAI');
        } else {
          task.status = 'failed';
          this.log(engineerId, 'error', `❌ ${task.title} 失敗: ${result.error}`, 'EngineerAI');
        }

        return result;

      } catch (error) {
        task.status = 'failed';
        this.log(engineerId, 'error', `❌ ${task.title} 実行エラー: ${error instanceof Error ? error.message : String(error)}`, 'EngineerAI');
        
        return {
          taskId: task.id,
          engineerId: engineerId,
          success: false,
          output: [],
          error: error instanceof Error ? error.message : String(error),
          duration: 0,
          filesChanged: []
        };
      } finally {
        // セッションIDを記録
        if (engineer.getSessionId()) {
          this.log(engineerId, 'info', `💾 セッションID保存: ${engineer.getSessionId()}`, 'EngineerAI');
        }
        
        // エンジニアをログビューアーから削除
        this.unregisterEngineerFromViewer(engineerId);
        
        // 作業完了後もエンジニアをプールに保持（修正作業のため）
        // this.engineerPool.delete(engineerId); // コメントアウト
      }
    });

    // 全タスクの完了を待機
    const results = await Promise.all(executionPromises);
    
    return results;
  }

  /**
   * システムクリーンアップ
   */
  async cleanup(cleanupWorktrees: boolean = false): Promise<void> {
    console.log('🧹 システムクリーンアップ開始');

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
  private log(engineerId: string, level: 'info' | 'error' | 'warn' | 'debug', message: string, component?: string): void {
    if (this.logViewer) {
      this.logViewer.log(engineerId, level, message, component);
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