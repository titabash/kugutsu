/**
 * Engineer Dispatch Node
 *
 * Assigns tasks to worktrees for parallel execution
 */

import type { ParallelDevStateType, ParallelDevStateUpdate } from '../state.js';
import type { Task, WorktreeInfo } from '../types.js';
import { GitWorktreeManager } from '../../managers/GitWorktreeManager.js';

/**
 * Engineer Dispatch Node
 *
 * Responsibilities:
 * 1. Identify executable tasks (dependencies satisfied)
 * 2. Limit concurrent tasks to maxEngineers
 * 3. Create worktrees for each task
 * 4. Mark tasks as in_progress
 */
export async function engineerDispatchNode(
  state: ParallelDevStateType
): Promise<ParallelDevStateUpdate> {
  const { tasks, completedTasks, config } = state;

  console.log('🚀 Engineer Dispatch: タスクを割り当てています...');

  try {
    // Initialize Git Worktree Manager
    const gitWorktreeManager = new GitWorktreeManager(
      config.baseRepoPath,
      config.worktreeBasePath,
      config.baseBranch
    );

    // Identify completed task IDs
    const completedIds = new Set(completedTasks.map((t) => t.id));

    // Find executable tasks (pending + dependencies satisfied)
    const executableTasks = tasks.filter((task) => {
      if (task.status !== 'pending') return false;

      // Check if all dependencies are completed
      return task.dependencies.every((depId) => completedIds.has(depId));
    });

    if (executableTasks.length === 0) {
      console.log('⏸️ 実行可能なタスクがありません');
      return {
        logs: [
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
    executableTasks.sort((a, b) => b.priority - a.priority);

    // Limit to maxEngineers
    const tasksToDispatch = executableTasks.slice(0, config.maxEngineers);

    console.log(`📋 ${tasksToDispatch.length}個のタスクをディスパッチします`);

    // Create worktrees and update tasks
    const updatedTasks: Task[] = [];
    const newWorktrees = new Map<string, WorktreeInfo>();
    const logs: any[] = [];

    for (const task of tasksToDispatch) {
      try {
        // Create worktree for this task
        const result = await gitWorktreeManager.createWorktree(task.id);

        // Update task
        const updatedTask: Task = {
          ...task,
          status: 'in_progress',
          worktreePath: result.path,
          branchName: result.branchName,
          updatedAt: new Date(),
        };

        updatedTasks.push(updatedTask);

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

        console.log(`✅ タスク ${task.id}: ${result.path}`);
      } catch (error) {
        // Failed to create worktree
        logs.push({
          timestamp: new Date(),
          level: 'error',
          source: 'EngineerDispatchNode',
          message: `タスク ${task.id} のworktree作成に失敗: ${error instanceof Error ? error.message : String(error)}`,
          data: {
            taskId: task.id,
            error,
          },
          taskId: task.id,
        });

        console.error(`❌ タスク ${task.id} の作成失敗:`, error);
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
