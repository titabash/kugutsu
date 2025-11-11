/**
 * Merge Coordinator Node
 *
 * Coordinates merging of completed and approved tasks
 *
 * **File-based Artifact Management:**
 * - Reads tasks from `.kugutsu/tasks.json` (status === 'reviewed')
 * - Reads review from `.kugutsu/tasks/{taskId}/review.json` (status === 'approved')
 * - Writes merge result to `.kugutsu/tasks/{taskId}/merge-result.json`
 * - Updates tasks.json status to 'completed' on success
 * - Creates `.kugutsu/tasks/{taskId}/conflicts.json` on conflict
 * - Updates tasks.json status to 'conflict_detected' on conflict
 */

import type { ParallelDevStateType, ParallelDevStateUpdate } from '../state.js';
import type { MergeTask } from '../types.js';
import { GitWorktreeManager } from '../../managers/GitWorktreeManager.js';
import { FileReader } from '../../utils/FileReader.js';
import { AIFileWriter } from '../../utils/AIFileWriter.js';
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import type { TaskArtifact, Review, MergeResult, Conflicts, ConflictFile } from '../../types/artifacts.js';

/**
 * Merge Coordinator Node
 *
 * Responsibilities:
 * 1. Identify approved tasks ready for merge
 * 2. Add them to merge queue
 * 3. Execute merges sequentially
 * 4. Detect merge conflicts
 */
export async function mergeCoordinatorNode(
  state: ParallelDevStateType
): Promise<ParallelDevStateUpdate> {
  const { config, tasksPath } = state;

  console.log('🔄 Merge Coordinator: マージを調整しています...');

  // Create AI provider
  const providerConfig = AIProviderFactory.buildProviderConfig({
    provider: state.config.provider || 'claude',
  });
  const provider = AIProviderFactory.create(providerConfig);

  // Read tasks from file
  const fileReader = new FileReader(config.baseRepoPath);

  let tasks: TaskArtifact[];
  try {
    tasks = await fileReader.readJSON<TaskArtifact[]>(tasksPath || '.kugutsu/tasks.json');
  } catch (error) {
    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'error',
          source: 'MergeCoordinatorNode',
          message: `tasks.json の読み込みに失敗: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }

  try {
    // Initialize Git Worktree Manager
    const gitWorktreeManager = new GitWorktreeManager(
      config.baseRepoPath,
      config.worktreeBasePath,
      config.baseBranch
    );

    // Find tasks with status 'reviewed'
    const reviewedTasks = tasks.filter((t) => t.status === 'reviewed' && t.branchName);

    if (reviewedTasks.length === 0) {
      console.log('⏸️ マージ可能なタスクがありません');
      return {
        logs: [
          {
            timestamp: new Date(),
            level: 'info',
            source: 'MergeCoordinatorNode',
            message: 'マージ可能なタスクがありません',
          },
        ],
      };
    }

    // Filter tasks with approved reviews
    const tasksToMerge: TaskArtifact[] = [];
    for (const task of reviewedTasks) {
      try {
        const review = await fileReader.readJSON<Review>(`.kugutsu/tasks/${task.id}/review.json`);
        if (review.status === 'approved') {
          tasksToMerge.push(task);
        }
      } catch (error) {
        console.warn(`⚠️ review.json の読み込みに失敗: ${task.id}`);
      }
    }

    if (tasksToMerge.length === 0) {
      console.log('⏸️ 承認されたタスクがありません');
      return {
        logs: [
          {
            timestamp: new Date(),
            level: 'info',
            source: 'MergeCoordinatorNode',
            message: '承認されたタスクがありません',
          },
        ],
      };
    }

    console.log(`📋 ${tasksToMerge.length}個のタスクをマージキューに追加します`);

    // Add to merge queue
    const newMergeTasks: MergeTask[] = tasksToMerge.map((task) => ({
      taskId: task.id,
      sourceBranch: task.branchName!,
      targetBranch: config.baseBranch,
      status: 'pending',
      attemptedAt: new Date(),
    }));

    // Execute merges sequentially
    const updatedMergeTasks: MergeTask[] = [];
    const logs: any[] = [];

    for (const mergeTask of newMergeTasks) {
      try {
        console.log(`🔀 マージ実行: ${mergeTask.sourceBranch} → ${mergeTask.targetBranch}`);

        // Attempt merge (GitWorktreeManager should have merge functionality)
        // For now, we'll use a simplified approach via bash
        const { execSync } = await import('child_process');

        // Switch to base repo
        process.chdir(config.baseRepoPath);

        // Ensure we're on the target branch
        execSync(`git checkout ${mergeTask.targetBranch}`, { stdio: 'pipe' });

        // Try to merge
        try {
          const mergeOutput = execSync(`git merge ${mergeTask.sourceBranch} --no-ff -m "Merge ${mergeTask.taskId}"`, {
            encoding: 'utf-8',
          });

          // Get commit hash
          const commitHash = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();

          // Merge succeeded - Create merge-result.json
          const mergeResult: MergeResult = {
            taskId: mergeTask.taskId,
            branch: mergeTask.sourceBranch,
            targetBranch: mergeTask.targetBranch,
            status: 'success',
            mergedAt: new Date().toISOString(),
            commitHash,
            message: 'Merge successful',
          };

          await AIFileWriter.writeFile(
            provider,
            `.kugutsu/tasks/${mergeTask.taskId}/merge-result.json`,
            mergeResult,
            config.baseRepoPath
          );
          console.log(`📝 merge-result.json を作成しました: ${mergeTask.taskId}`);

          // Update tasks.json status to 'completed' using AI
          const taskToUpdate = tasks.find((t) => t.id === mergeTask.taskId);
          if (taskToUpdate) {
            await AIFileWriter.updateTaskInTasksJson(
              provider,
              tasksPath || '.kugutsu/tasks.json',
              mergeTask.taskId,
              {
                status: 'completed',
                updatedAt: new Date().toISOString(),
              },
              config.baseRepoPath
            );
            console.log(`✅ タスクステータスを更新しました: completed`);
          }

          updatedMergeTasks.push({
            ...mergeTask,
            status: 'completed',
            completedAt: new Date(),
          });

          logs.push({
            timestamp: new Date(),
            level: 'info',
            source: 'MergeCoordinatorNode',
            message: `タスク ${mergeTask.taskId} のマージ成功`,
            data: { taskId: mergeTask.taskId },
            taskId: mergeTask.taskId,
          });

          console.log(`✅ マージ成功: ${mergeTask.taskId}`);

          // マージ成功後のクリーンアップ（config.cleanupがfalseでない限り実行）
          if (config.cleanup !== false) {
            try {
              await gitWorktreeManager.cleanupCompletedTask(
                mergeTask.taskId,
                { deleteBranch: true }
              );
              console.log(`🧹 クリーンアップ完了: ${mergeTask.taskId}`);
            } catch (cleanupError) {
              console.warn(`⚠️ クリーンアップに失敗しましたが、処理を続行します: ${cleanupError}`);
            }
          } else {
            console.log(`📌 Worktreeとブランチを保持: ${mergeTask.taskId}`);
          }
        } catch (mergeError) {
          // Merge conflict detected
          const errorOutput = mergeError instanceof Error ? mergeError.message : String(mergeError);

          if (errorOutput.includes('conflict') || errorOutput.includes('CONFLICT')) {
            // Get conflict files
            const conflictFilesOutput = execSync('git diff --name-only --diff-filter=U', {
              encoding: 'utf-8',
            });
            const conflictFileNames = conflictFilesOutput
              .split('\n')
              .filter((f) => f.trim().length > 0);

            // Abort merge to clean up
            execSync('git merge --abort', { stdio: 'pipe' });

            // Create merge-result.json with conflict status
            const mergeResult: MergeResult = {
              taskId: mergeTask.taskId,
              branch: mergeTask.sourceBranch,
              targetBranch: mergeTask.targetBranch,
              status: 'conflict',
              mergedAt: new Date().toISOString(),
              conflictFiles: conflictFileNames,
              message: 'Merge conflict detected',
            };

            await AIFileWriter.writeFile(
              provider,
              `.kugutsu/tasks/${mergeTask.taskId}/merge-result.json`,
              mergeResult,
              config.baseRepoPath
            );
            console.log(`📝 merge-result.json を作成しました (conflict): ${mergeTask.taskId}`);

            // Create conflicts.json
            const conflictFilesData: ConflictFile[] = conflictFileNames.map((filePath) => ({
              path: filePath,
              conflicts: [
                {
                  line: 0,
                  ours: '',
                  theirs: '',
                  resolved: '',
                },
              ],
            }));

            const conflicts: Conflicts = {
              taskId: mergeTask.taskId,
              conflictFiles: conflictFilesData,
              resolution: 'pending',
            };

            await AIFileWriter.writeFile(
              provider,
              `.kugutsu/tasks/${mergeTask.taskId}/conflicts.json`,
              conflicts,
              config.baseRepoPath
            );
            console.log(`📝 conflicts.json を作成しました: ${mergeTask.taskId}`);

            // Update tasks.json status to 'conflict_detected' using AI
            const taskToUpdate = tasks.find((t) => t.id === mergeTask.taskId);
            if (taskToUpdate) {
              await AIFileWriter.updateTaskInTasksJson(
                provider,
                tasksPath || '.kugutsu/tasks.json',
                mergeTask.taskId,
                {
                  status: 'conflict_detected',
                  updatedAt: new Date().toISOString(),
                },
                config.baseRepoPath
              );
              console.log(`⚠️ タスクステータスを更新しました: conflict_detected`);
            }

            updatedMergeTasks.push({
              ...mergeTask,
              status: 'conflict',
              conflictFiles: conflictFileNames,
            });

            logs.push({
              timestamp: new Date(),
              level: 'warn',
              source: 'MergeCoordinatorNode',
              message: `タスク ${mergeTask.taskId} でコンフリクト検出`,
              data: {
                taskId: mergeTask.taskId,
                conflictFiles: conflictFileNames,
              },
              taskId: mergeTask.taskId,
            });

            console.log(`⚠️ コンフリクト検出: ${mergeTask.taskId}`);
          } else {
            // Other merge error
            throw mergeError;
          }
        }
      } catch (error) {
        console.error(`❌ マージエラー: ${mergeTask.taskId}`, error);

        updatedMergeTasks.push({
          ...mergeTask,
          status: 'pending',
          error: error instanceof Error ? error.message : String(error),
        });

        logs.push({
          timestamp: new Date(),
          level: 'error',
          source: 'MergeCoordinatorNode',
          message: `タスク ${mergeTask.taskId} のマージエラー: ${error instanceof Error ? error.message : String(error)}`,
          data: {
            taskId: mergeTask.taskId,
            error,
          },
          taskId: mergeTask.taskId,
        });
      }
    }

    return {
      mergeQueue: updatedMergeTasks,
      logs,
      metadata: {
        phase: 'merge',
      },
    };
  } catch (error) {
    console.error('❌ Merge Coordinator Node エラー:', error);

    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'error',
          source: 'MergeCoordinatorNode',
          message: `マージ調整に失敗: ${error instanceof Error ? error.message : String(error)}`,
          data: { error },
        },
      ],
      metadata: {
        hasErrors: true,
        errors: [
          ...(state.metadata.errors || []),
          error instanceof Error ? error.message : String(error),
        ],
      },
    };
  }
}
