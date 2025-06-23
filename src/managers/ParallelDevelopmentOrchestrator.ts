import { ProductOwnerAI } from './ProductOwnerAI';
import { GitWorktreeManager } from './GitWorktreeManager';
import { EngineerAI } from './EngineerAI';
import { TaskInstructionManager } from '../utils/TaskInstructionManager';
import { Task, TaskAnalysisResult, EngineerResult, SystemConfig } from '../types';

/**
 * 並列開発オーケストレーター
 * プロダクトオーナーAI、git worktree、エンジニアAIを統合管理
 */
export class ParallelDevelopmentOrchestrator {
  private readonly productOwnerAI: ProductOwnerAI;
  private readonly gitManager: GitWorktreeManager;
  private readonly config: SystemConfig;
  private readonly engineerPool: Map<string, EngineerAI> = new Map();
  private activeTasks: Map<string, Task> = new Map();
  private instructionManager?: TaskInstructionManager;

  constructor(config: SystemConfig) {
    this.config = config;
    this.productOwnerAI = new ProductOwnerAI(config.baseRepoPath);
    this.gitManager = new GitWorktreeManager(config.baseRepoPath, config.worktreeBasePath);
  }

  /**
   * ユーザー要求を受け取り、並列開発を実行
   */
  async executeUserRequest(userRequest: string): Promise<{
    analysis: TaskAnalysisResult;
    results: EngineerResult[];
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

      // 4. 並列実行
      console.log('\n⚡ フェーズ2: 並列実行開始');
      const results = await this.executeTasksInParallel(executionGroups);

      console.log('\n✅ 並列開発完了');
      return { analysis, results };

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
   * タスクグループを並列実行
   */
  private async executeTasksInParallel(executionGroups: Task[][]): Promise<EngineerResult[]> {
    const allResults: EngineerResult[] = [];

    for (let groupIndex = 0; groupIndex < executionGroups.length; groupIndex++) {
      const group = executionGroups[groupIndex];
      console.log(`\n🔥 グループ ${groupIndex + 1}/${executionGroups.length} 実行開始 (${group.length}タスク)`);

      // 各タスクにworktreeを作成
      await this.setupWorktreesForGroup(group);

      // エンジニアAIを並列実行
      const groupResults = await this.executeGroupInParallel(group);
      allResults.push(...groupResults);

      // 失敗したタスクのチェック
      const failedTasks = groupResults.filter(r => !r.success);
      if (failedTasks.length > 0) {
        console.warn(`⚠️ ${failedTasks.length}個のタスクが失敗しました`);
        for (const failed of failedTasks) {
          console.warn(`  - タスク ${failed.taskId}: ${failed.error}`);
        }
      }

      console.log(`✅ グループ ${groupIndex + 1} 完了`);
    }

    return allResults;
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
          success: false,
          output: [],
          error: error instanceof Error ? error.message : String(error),
          duration: 0,
          filesChanged: []
        };
      } finally {
        // エンジニアをプールから削除
        this.engineerPool.delete(engineerId);
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