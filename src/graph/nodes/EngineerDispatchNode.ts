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
import type { AIProviderConfig } from '../../providers/IAIProvider.js';
import type { TaskArtifact } from '../../types/artifacts.js';

/**
 * Engineer Dispatch Node
 *
 * Responsibilities:
 * 1. Transition pending tasks to ready (when dependencies satisfied)
 * 2. Transition ready tasks to in_progress (create worktrees)
 * 3. Limit concurrent tasks to maxEngineers
 * 4. Use TaskStateMachine for all state transitions
 */
export async function engineerDispatchNode(
  state: ParallelDevStateType
): Promise<ParallelDevStateUpdate> {
  const { tasks, config, tasksPath } = state;

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
    const providerConfig: AIProviderConfig = {
      provider: state.config.provider || 'claude',
      claude: {
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
      },
    };
    const provider = AIProviderFactory.create(providerConfig);

    const updatedTasks: Task[] = [];
    const newWorktrees = new Map<string, WorktreeInfo>();
    const logs: any[] = [];

    // Phase 1: pending → ready (依存関係解決)
    const tasksToMarkReady = tasks.filter((task) =>
      TaskStateMachine.canMoveToReady(task, tasks)
    );

    for (const task of tasksToMarkReady) {
      const readyTask = TaskStateMachine.transition(task, 'ready');

      // Replace if exists, otherwise add
      const existingIndex = updatedTasks.findIndex((t) => t.id === readyTask.id);
      if (existingIndex >= 0) {
        updatedTasks[existingIndex] = readyTask;
      } else {
        updatedTasks.push(readyTask);
      }

      logs.push({
        timestamp: new Date(),
        level: 'info',
        source: 'EngineerDispatchNode',
        message: `タスク ${task.id} が準備完了 (ready) になりました`,
        data: { taskId: task.id },
        taskId: task.id,
      });

      console.log(`✅ タスク ${task.id} → ready`);
    }

    // Phase 2: ready → in_progress (worktree作成)
    const readyTasks = tasks
      .filter((t) => t.status === 'ready')
      .concat(updatedTasks.filter((t) => t.status === 'ready'));

    if (readyTasks.length === 0) {
      console.log('⏸️ 実行可能なタスクがありません');
      return {
        tasks: updatedTasks,
        logs: [
          ...logs,
          {
            timestamp: new Date(),
            level: 'info',
            source: 'EngineerDispatchNode',
            message: '実行可能なタスクがありません',
          },
        ],
      };
    }

    // Sort by priority (highest first)
    readyTasks.sort((a, b) => b.priority - a.priority);

    // Limit to maxEngineers
    const tasksToDispatch = readyTasks.slice(0, config.maxEngineers);

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

        // ready → in_progress (TaskStateMachine validates worktreePath/branchName)
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

    // Return state update
    return {
      tasks: updatedTasks,
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
