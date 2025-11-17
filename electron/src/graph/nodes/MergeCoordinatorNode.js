/**
 * Merge Coordinator Node
 *
 * Coordinates merging of completed and approved tasks
 *
 * **File-based Artifact Management:**
 * - Reads tasks from Sprint Backlog (`.kugutsu/sprints/{sprintId}/sprint-backlog.json`) (status === 'completed')
 * - Reads review from `.kugutsu/sprints/{sprintId}/tasks/{taskId}/review.json` (status === 'approved')
 * - Writes merge result to `.kugutsu/sprints/{sprintId}/tasks/{taskId}/merge-result.json`
 * - Updates Sprint Backlog status on success
 * - Creates `.kugutsu/sprints/{sprintId}/tasks/{taskId}/conflicts.json` on conflict
 * - Updates Sprint Backlog status on conflict
 */
import { GitWorktreeManager } from '../../managers/GitWorktreeManager.js';
import { FileReader } from '../../utils/FileReader.js';
import { DataPersistence } from '../../utils/DataPersistence.js';
import { AIFileWriter } from '../../utils/AIFileWriter.js';
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import { TaskStateMachine } from '../../utils/TaskStateMachine.js';
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
    const { config, activeSprint } = state;
    console.log('🔄 Merge Coordinator: マージを調整しています...');
    if (!activeSprint?.id) {
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'error',
                    source: 'MergeCoordinatorNode',
                    message: 'アクティブなスプリントが設定されていません',
                },
            ],
        };
    }
    const sprintId = activeSprint.id;
    // Create AI provider
    const providerConfig = AIProviderFactory.buildProviderConfig({
        provider: state.config.provider || 'claude',
    });
    const provider = AIProviderFactory.create(providerConfig);
    // Read tasks from Sprint Backlog
    const persistence = new DataPersistence(config.baseRepoPath);
    const fileReader = new FileReader(config.baseRepoPath);
    let backlog;
    try {
        backlog = await persistence.loadSprintBacklog(sprintId);
        if (!backlog || !backlog.tasks) {
            throw new Error(`Sprint Backlog not found: ${sprintId}`);
        }
    }
    catch (error) {
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'error',
                    source: 'MergeCoordinatorNode',
                    message: `Sprint Backlog の読み込みに失敗: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
        };
    }
    const tasks = backlog.tasks;
    // Keep reference to backlog for direct updates (avoid re-reading file)
    // Deep copy tasks array to avoid mutating original
    let updatedBacklog = {
        ...backlog,
        tasks: backlog.tasks.map((t) => ({ ...t })),
    };
    try {
        // Initialize Git Worktree Manager
        const gitWorktreeManager = new GitWorktreeManager(config.baseRepoPath, config.worktreeBasePath, config.baseBranch);
        // Find tasks with status 'completed' (reviewed and approved)
        const reviewedTasks = tasks.filter((t) => t.status === 'completed' && t.branchName);
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
        const tasksToMerge = [];
        for (const task of reviewedTasks) {
            try {
                const review = await fileReader.readJSON(`.kugutsu/sprints/${sprintId}/tasks/${task.id}/review.json`);
                if (review.status === 'approved') {
                    tasksToMerge.push(task);
                }
            }
            catch (error) {
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
                const execOptions = {
                    cwd: config.baseRepoPath,
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe'],
                };
                // Ensure we're on the target branch
                try {
                    execSync(`git checkout ${mergeTask.targetBranch}`, execOptions);
                }
                catch (checkoutError) {
                    const errorMsg = checkoutError instanceof Error ? checkoutError.message : String(checkoutError);
                    console.error(`❌ ブランチチェックアウトエラー: ${errorMsg}`);
                    throw new Error(`ブランチチェックアウトに失敗: ${errorMsg}`);
                }
                // Try to merge
                try {
                    const mergeOutput = execSync(`git merge ${mergeTask.sourceBranch} --no-ff --no-edit -m "Merge ${mergeTask.taskId}"`, execOptions);
                    console.log(`✅ マージ成功: ${mergeOutput}`);
                    // Get commit hash
                    const commitHash = execSync('git rev-parse HEAD', execOptions).trim();
                    // Merge succeeded - Create merge-result.json
                    const mergeResult = {
                        taskId: mergeTask.taskId,
                        branch: mergeTask.sourceBranch,
                        targetBranch: mergeTask.targetBranch,
                        status: 'success',
                        mergedAt: new Date().toISOString(),
                        commitHash,
                        message: 'Merge successful',
                    };
                    await AIFileWriter.writeFile(provider, `.kugutsu/sprints/${sprintId}/tasks/${mergeTask.taskId}/merge-result.json`, mergeResult, config.baseRepoPath);
                    console.log(`📝 merge-result.json を作成しました: ${mergeTask.taskId}`);
                    // Update Sprint Backlog status directly (using the backlog we already loaded)
                    const taskIndex = updatedBacklog.tasks.findIndex((t) => t.id === mergeTask.taskId);
                    if (taskIndex >= 0) {
                        updatedBacklog.tasks[taskIndex] = {
                            ...updatedBacklog.tasks[taskIndex],
                            status: 'completed',
                            updatedAt: new Date().toISOString(),
                        };
                        updatedBacklog.metadata = {
                            ...updatedBacklog.metadata,
                            lastUpdated: new Date().toISOString(),
                        };
                        console.log(`✅ Sprint Backlogのタスクステータスを更新しました: completed`);
                    }
                    else {
                        console.warn(`⚠️ タスク ${mergeTask.taskId} がSprint Backlogに見つかりません`);
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
                            await gitWorktreeManager.cleanupCompletedTask(mergeTask.taskId, { deleteBranch: true });
                            console.log(`🧹 クリーンアップ完了: ${mergeTask.taskId}`);
                        }
                        catch (cleanupError) {
                            console.warn(`⚠️ クリーンアップに失敗しましたが、処理を続行します: ${cleanupError}`);
                        }
                    }
                    else {
                        console.log(`📌 Worktreeとブランチを保持: ${mergeTask.taskId}`);
                    }
                }
                catch (mergeError) {
                    // Merge conflict detected
                    // execSync errors include stderr in the error message
                    const errorOutput = mergeError?.stderr || mergeError?.message || String(mergeError);
                    const fullError = mergeError instanceof Error ? mergeError.message : String(mergeError);
                    console.error(`⚠️ マージエラー詳細:`, {
                        message: fullError,
                        stderr: mergeError?.stderr,
                        stdout: mergeError?.stdout,
                        code: mergeError?.code,
                    });
                    if (errorOutput.includes('conflict') || errorOutput.includes('CONFLICT') || fullError.includes('conflict')) {
                        // Get conflict files
                        const conflictFilesOutput = execSync('git diff --name-only --diff-filter=U', execOptions);
                        const conflictFileNames = conflictFilesOutput
                            .split('\n')
                            .filter((f) => f.trim().length > 0);
                        // Abort merge to clean up
                        try {
                            execSync('git merge --abort', execOptions);
                        }
                        catch (abortError) {
                            console.warn(`⚠️ マージ中止に失敗: ${abortError instanceof Error ? abortError.message : String(abortError)}`);
                        }
                        // Create merge-result.json with conflict status
                        const mergeResult = {
                            taskId: mergeTask.taskId,
                            branch: mergeTask.sourceBranch,
                            targetBranch: mergeTask.targetBranch,
                            status: 'conflict',
                            mergedAt: new Date().toISOString(),
                            conflictFiles: conflictFileNames,
                            message: 'Merge conflict detected',
                        };
                        await AIFileWriter.writeFile(provider, `.kugutsu/sprints/${sprintId}/tasks/${mergeTask.taskId}/merge-result.json`, mergeResult, config.baseRepoPath);
                        console.log(`📝 merge-result.json を作成しました (conflict): ${mergeTask.taskId}`);
                        // Create conflicts.json
                        const conflictFilesData = conflictFileNames.map((filePath) => ({
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
                        const conflicts = {
                            taskId: mergeTask.taskId,
                            conflictFiles: conflictFilesData,
                            resolution: 'pending',
                        };
                        await AIFileWriter.writeFile(provider, `.kugutsu/sprints/${sprintId}/tasks/${mergeTask.taskId}/conflicts.json`, conflicts, config.baseRepoPath);
                        console.log(`📝 conflicts.json を作成しました: ${mergeTask.taskId}`);
                        // Update Sprint Backlog status to indicate conflict (using the backlog we already loaded)
                        const taskIndex = updatedBacklog.tasks.findIndex((t) => t.id === mergeTask.taskId);
                        if (taskIndex >= 0) {
                            updatedBacklog.tasks[taskIndex] = {
                                ...updatedBacklog.tasks[taskIndex],
                                status: 'in_progress', // conflict_detectedではなくin_progressに設定（ConflictResolverNodeで処理）
                                updatedAt: new Date().toISOString(),
                            };
                            updatedBacklog.metadata = {
                                ...updatedBacklog.metadata,
                                lastUpdated: new Date().toISOString(),
                            };
                            console.log(`⚠️ Sprint Backlogのタスクステータスを更新しました: in_progress (conflict)`);
                        }
                        else {
                            console.warn(`⚠️ タスク ${mergeTask.taskId} がSprint Backlogに見つかりません`);
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
        // Save updated Sprint Backlog
        try {
            await persistence.saveSprintBacklog(sprintId, updatedBacklog);
            console.log(`✅ Sprint Backlogを保存しました`);
        }
        catch (saveError) {
            console.error(`❌ Sprint Backlogの保存に失敗: ${saveError instanceof Error ? saveError.message : String(saveError)}`);
            // Continue even if save fails (logs already updated)
        }
        // Update state.tasks for completed merges (for Kanban board display)
        const updatedStateTasks = [];
        const updatedGlobalTasks = [];
        for (const mergeTask of updatedMergeTasks) {
            if (mergeTask.status === 'completed') {
                const stateTask = state.tasks.find((t) => t.id === mergeTask.taskId);
                if (stateTask && stateTask.status !== 'completed') {
                    try {
                        const completedTask = TaskStateMachine.transition(stateTask, 'completed');
                        updatedStateTasks.push(completedTask);
                        console.log(`📝 state.tasksを更新しました: ${mergeTask.taskId} → completed`);
                        // Sync to globalTasks
                        const globalTask = state.globalTasks.find((t) => t.id === mergeTask.taskId);
                        if (globalTask) {
                            updatedGlobalTasks.push({
                                ...globalTask,
                                status: 'completed',
                                updatedAt: new Date(),
                            });
                        }
                    }
                    catch (error) {
                        console.warn(`⚠️ state.tasksの更新に失敗: ${mergeTask.taskId}`, error);
                    }
                }
            }
        }
        // Build return object - only include fields that have updates
        const stateUpdate = {
            mergeQueue: updatedMergeTasks,
            logs,
            metadata: {
                phase: 'merge',
            },
        };
        // Only include tasks/globalTasks if there are updates
        if (updatedStateTasks.length > 0) {
            stateUpdate.tasks = updatedStateTasks;
        }
        if (updatedGlobalTasks.length > 0) {
            stateUpdate.globalTasks = updatedGlobalTasks;
        }
        return stateUpdate;
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