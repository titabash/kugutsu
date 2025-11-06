/**
 * Merge Coordinator Node
 *
 * Coordinates merging of completed and approved tasks
 */
import { GitWorktreeManager } from '../../managers/GitWorktreeManager.js';
/**
 * Merge Coordinator Node
 *
 * Responsibilities:
 * 1. Identify approved tasks ready for merge
 * 2. Add them to merge queue
 * 3. Execute merges sequentially
 * 4. Detect merge conflicts
 */
export async function mergeCoordinatorNode(state) {
    const { reviews, tasks, config, mergeQueue } = state;
    console.log('🔄 Merge Coordinator: マージを調整しています...');
    try {
        // Initialize Git Worktree Manager
        const gitWorktreeManager = new GitWorktreeManager(config.baseRepoPath, config.worktreeBasePath, config.baseBranch);
        // Identify approved tasks
        const approvedReviews = reviews.filter((r) => r.status === 'approved');
        const approvedTaskIds = new Set(approvedReviews.map((r) => r.taskId));
        // Find tasks ready to merge (completed + approved + not in queue)
        const existingMergeTaskIds = new Set(mergeQueue.map((m) => m.taskId));
        const tasksToMerge = tasks.filter((t) => t.status === 'completed' &&
            approvedTaskIds.has(t.id) &&
            !existingMergeTaskIds.has(t.id) &&
            t.branchName);
        if (tasksToMerge.length === 0) {
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
        console.log(`📋 ${tasksToMerge.length}個のタスクをマージキューに追加します`);
        // Add to merge queue
        const newMergeTasks = tasksToMerge.map((task) => ({
            taskId: task.id,
            sourceBranch: task.branchName,
            targetBranch: config.baseBranch,
            status: 'pending',
            attemptedAt: new Date(),
        }));
        // Execute merges sequentially
        const updatedMergeTasks = [];
        const logs = [];
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
                    execSync(`git merge ${mergeTask.sourceBranch} --no-ff -m "Merge ${mergeTask.taskId}"`, {
                        stdio: 'pipe',
                    });
                    // Merge succeeded
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
                }
                catch (mergeError) {
                    // Merge conflict detected
                    const errorOutput = mergeError instanceof Error ? mergeError.message : String(mergeError);
                    if (errorOutput.includes('conflict') || errorOutput.includes('CONFLICT')) {
                        // Get conflict files
                        const conflictFilesOutput = execSync('git diff --name-only --diff-filter=U', {
                            encoding: 'utf-8',
                        });
                        const conflictFiles = conflictFilesOutput
                            .split('\n')
                            .filter((f) => f.trim().length > 0);
                        // Abort merge to clean up
                        execSync('git merge --abort', { stdio: 'pipe' });
                        updatedMergeTasks.push({
                            ...mergeTask,
                            status: 'conflict',
                            conflictFiles,
                        });
                        logs.push({
                            timestamp: new Date(),
                            level: 'warn',
                            source: 'MergeCoordinatorNode',
                            message: `タスク ${mergeTask.taskId} でコンフリクト検出`,
                            data: {
                                taskId: mergeTask.taskId,
                                conflictFiles,
                            },
                            taskId: mergeTask.taskId,
                        });
                        console.log(`⚠️ コンフリクト検出: ${mergeTask.taskId}`);
                    }
                    else {
                        // Other merge error
                        throw mergeError;
                    }
                }
            }
            catch (error) {
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
    }
    catch (error) {
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
//# sourceMappingURL=MergeCoordinatorNode.js.map