import { ProductOwnerAI } from './ProductOwnerAI';
import { GitWorktreeManager } from './GitWorktreeManager';
import { EngineerAI } from './EngineerAI';
import { ReviewWorkflow } from './ReviewWorkflow';
import { TaskInstructionManager } from '../utils/TaskInstructionManager';
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

  constructor(config: SystemConfig) {
    this.config = config;
    this.productOwnerAI = new ProductOwnerAI(config.baseRepoPath);
    this.gitManager = new GitWorktreeManager(config.baseRepoPath, config.worktreeBasePath);
    this.reviewWorkflow = new ReviewWorkflow(this.gitManager, config);
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
    console.log('🚀 並列開発システム開始');
    console.log(`📝 ユーザー要求: ${userRequest}`);

    try {
      // TaskInstructionManagerを初期化
      this.instructionManager = new TaskInstructionManager();
      
      // 1. プロダクトオーナーAIによる要求分析
      console.log('\n📊 フェーズ1: 要求分析');
      const analysis = await this.productOwnerAI.analyzeUserRequestWithInstructions(
        userRequest, 
        this.instructionManager
      );
      
      console.log(`\n📋 分析結果:`);
      console.log(`- 概要: ${analysis.summary}`);
      console.log(`- 見積もり時間: ${analysis.estimatedTime}`);
      console.log(`- タスク数: ${analysis.tasks.length}`);
      console.log(`- リスク: ${analysis.riskAssessment}`);

      // 2. タスクの依存関係を解決
      const orderedTasks = this.productOwnerAI.resolveDependencies(analysis.tasks);
      console.log(`\n🔗 依存関係解決完了`);

      // 3. 並列実行グループの作成
      const executionGroups = this.createExecutionGroups(orderedTasks);
      console.log(`\n🏗️ 実行グループ作成: ${executionGroups.length}グループ`);

      // 4. 並列実行（レビュー含む）
      console.log('\n⚡ フェーズ2: 並列実行・レビュー開始');
      const { results, reviewResults, completedTasks, failedTasks } = await this.executeTasksInParallel(executionGroups);

      console.log('\n✅ 並列開発・レビュー完了');
      console.log(`📊 完了タスク: ${completedTasks.length}個`);
      console.log(`📊 失敗タスク: ${failedTasks.length}個`);
      
      return { analysis, results, reviewResults, completedTasks, failedTasks };

    } catch (error) {
      console.error('❌ 並列開発エラー:', error);
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
        
        console.log(`  ✅ ${task.title}: ${worktreePath}`);
      } catch (error) {
        console.error(`  ❌ ${task.title}: Worktree作成失敗 - ${error}`);
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
      console.warn('⚠️ 実行可能なタスクがありません');
      return [];
    }

    console.log(`👥 ${validTasks.length}名のエンジニアAIを並列起動...`);

    // 各タスクにエンジニアAIを割り当てて並列実行
    const executionPromises = validTasks.map(async (task, index) => {
      const engineerId = `engineer-${Date.now()}-${index}`;
      const engineer = new EngineerAI(engineerId, {
        maxTurns: this.config.maxTurnsPerTask
      });

      this.engineerPool.set(engineerId, engineer);

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
          console.log(`✅ ${task.title} 完了 (${engineerId})`);
        } else {
          task.status = 'failed';
          console.error(`❌ ${task.title} 失敗 (${engineerId}): ${result.error}`);
        }

        return result;

      } catch (error) {
        task.status = 'failed';
        console.error(`❌ ${task.title} 実行エラー (${engineerId}):`, error);
        
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
          console.log(`💾 エンジニアAI[${engineerId}] セッションID保存: ${engineer.getSessionId()}`);
        }
        
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
}