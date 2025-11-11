/**
 * Engineer Dispatch Node
 *
 * Assigns tasks to worktrees for parallel execution
 */

import type { ParallelDevStateType, ParallelDevStateUpdate } from '../state.js';
import type { Task, WorktreeInfo } from '../types.js';
import { GitWorktreeManager } from '../../managers/GitWorktreeManager.js';
import { TaskStateMachine } from '../../utils/TaskStateMachine.js';
import { FileReader } from '../../utils/FileReader.js';
import { AIFileWriter } from '../../utils/AIFileWriter.js';
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import type { TaskArtifact } from '../../types/artifacts.js';

/**
 * Engineer Dispatch Node
 *
 * Responsibilities:
 * 1. Check dependencies for pending tasks
 * 2. Transition pending tasks to in_progress (create worktrees)
 * 3. Limit concurrent tasks to maxEngineers
 * 4. Use TaskStateMachine for all state transitions
 */
export async function engineerDispatchNode(
  state: ParallelDevStateType
): Promise<ParallelDevStateUpdate> {
  const { tasks, config, tasksPath, globalTasks } = state;

  console.log('🚀 Engineer Dispatch: タスクを割り当てています...');
  console.log(`📝 tasksPath: ${tasksPath}`);
  console.log(`📝 Received ${tasks.length} tasks from state`);

  // Fallback to default path if tasksPath is undefined
  const actualTasksPath = tasksPath || '.kugutsu/tasks.json';

  try {
    // Initialize Git Worktree Manager
    const gitWorktreeManager = new GitWorktreeManager(
      config.baseRepoPath,
      config.worktreeBasePath,
      config.baseBranch
    );

    // Initialize File Reader for tasks.json
    const fileReader = new FileReader(config.baseRepoPath);

    // Create AI provider
    const providerConfig = AIProviderFactory.buildProviderConfig({
      provider: state.config.provider || 'claude',
    });
    const provider = AIProviderFactory.create(providerConfig);

    const updatedTasks: Task[] = [];
    const newWorktrees = new Map<string, WorktreeInfo>();
    const logs: any[] = [];

    // 🔄 Dynamic Task Pooling: Calculate available slots
    const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
    const availableSlots = config.maxEngineers - inProgressCount;

    console.log(`[EngineerDispatch] In Progress: ${inProgressCount}/${config.maxEngineers}`);
    console.log(`[EngineerDispatch] Available Slots: ${availableSlots}`);

    if (availableSlots <= 0) {
      console.log('[EngineerDispatch] No available slots, skipping dispatch');
      return {
        tasks: updatedTasks,
        logs: [
          {
            timestamp: new Date(),
            level: 'info',
            source: 'EngineerDispatchNode',
            message: `実行可能なスロットがありません (${inProgressCount}/${config.maxEngineers} 実行中)`,
          },
        ],
      };
    }

    // pending → in_progress (依存関係チェック + worktree作成)
    // Get pending tasks with resolved dependencies
    const pendingTasks = tasks.filter((task) =>
      task.status === 'pending' &&
      TaskStateMachine.canMoveToReady(task, tasks) // Check if dependencies are satisfied
    );

    if (pendingTasks.length === 0) {
      console.log('⏸️ 実行可能なタスクがありません');
      return {
        tasks: updatedTasks,
        logs: [
          {
            timestamp: new Date(),
            level: 'info',
            source: 'EngineerDispatchNode',
            message: '実行可能なタスクがありません（依存関係未解決、または全タスク完了）',
          },
        ],
      };
    }

    // Sort by priority (highest first)
    pendingTasks.sort((a, b) => b.priority - a.priority);

    // 🔄 Dynamic Task Pooling: Dispatch only available slots
    const tasksToDispatch = pendingTasks.slice(0, availableSlots);

    console.log(`📋 ${tasksToDispatch.length}個のタスクをディスパッチします`);

    for (const task of tasksToDispatch) {
      try {
        // Create worktree for this task
        const result = await gitWorktreeManager.createWorktree(task.id);

        // Set worktree info before transition
        const taskWithWorktree: Task = {
          ...task,
          worktreePath: result.path,
          branchName: result.branchName,
        };

        // pending → in_progress (TaskStateMachine validates worktreePath/branchName)
        const inProgressTask = TaskStateMachine.transition(
          taskWithWorktree,
          'in_progress'
        );

        // Replace if exists, otherwise add
        const existingIndex = updatedTasks.findIndex((t) => t.id === inProgressTask.id);
        if (existingIndex >= 0) {
          updatedTasks[existingIndex] = inProgressTask;
        } else {
          updatedTasks.push(inProgressTask);
        }

        // Add worktree info
        newWorktrees.set(task.id, {
          path: result.path,
          branch: result.branchName,
          taskId: task.id,
          createdAt: new Date(),
          active: true,
        });

        logs.push({
          timestamp: new Date(),
          level: 'info',
          source: 'EngineerDispatchNode',
          message: `タスク ${task.id} をディスパッチしました`,
          data: {
            taskId: task.id,
            worktreePath: result.path,
            branchName: result.branchName,
          },
          taskId: task.id,
        });

        console.log(`✅ タスク ${task.id} → in_progress: ${result.path}`);
      } catch (error) {
        // Failed to create worktree - transition task to failed state
        const errorMessage = error instanceof Error ? error.message : String(error);

        const failedTask = TaskStateMachine.transition(task, 'failed', {
          error: errorMessage
        });

        // Replace if exists, otherwise add
        const existingIndex = updatedTasks.findIndex((t) => t.id === failedTask.id);
        if (existingIndex >= 0) {
          updatedTasks[existingIndex] = failedTask;
        } else {
          updatedTasks.push(failedTask);
        }

        logs.push({
          timestamp: new Date(),
          level: 'error',
          source: 'EngineerDispatchNode',
          message: `タスク ${task.id} のworktree作成に失敗: ${errorMessage}`,
          data: {
            taskId: task.id,
            error,
          },
          taskId: task.id,
        });

        console.error(`❌ タスク ${task.id} の作成失敗:`, error);
      }
    }

    // Update tasks.json with worktree information using AI
    if (updatedTasks.length > 0) {
      try {
        // Build update map for tasks with worktree info
        const taskUpdates = new Map<string, Record<string, any>>();

        for (const task of updatedTasks) {
          if (task.worktreePath && task.branchName) {
            taskUpdates.set(task.id, {
              worktreePath: task.worktreePath,
              branchName: task.branchName,
              status: task.status,
              updatedAt: new Date().toISOString(),
            });
          }
        }

        if (taskUpdates.size > 0) {
          await AIFileWriter.updateMultipleTasksInTasksJson(
            provider,
            actualTasksPath,
            taskUpdates,
            config.baseRepoPath
          );
          console.log(`📝 tasks.json を更新しました (${taskUpdates.size}個のworktree)`);
        }
      } catch (error) {
        console.warn('⚠️ tasks.json の更新に失敗:', error);
        // Non-fatal error - continue with state update
      }
    }

    // Sync updatedTasks to globalTasks
    const updatedGlobalTasks: any[] = [];
    for (const task of updatedTasks) {
      const globalTask = globalTasks.find((t) => t.id === task.id);
      if (globalTask) {
        updatedGlobalTasks.push({
          ...globalTask,
          status: task.status,
          worktreePath: task.worktreePath,
          branchName: task.branchName,
          updatedAt: new Date(),
        });
      }
    }

    // Return state update
    return {
      tasks: updatedTasks,
      globalTasks: updatedGlobalTasks,
      worktrees: newWorktrees,
      logs,
    };
  } catch (error) {
    console.error('❌ Engineer Dispatch Node エラー:', error);

    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'error',
          source: 'EngineerDispatchNode',
          message: `タスクディスパッチに失敗: ${error instanceof Error ? error.message : String(error)}`,
          data: { error },
        },
      ],
      metadata: {
        hasErrors: true,
        errors: [error instanceof Error ? error.message : String(error)],
      },
    };
  }
}
