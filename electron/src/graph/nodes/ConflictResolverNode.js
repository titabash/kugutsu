/**
 * Conflict Resolver Node
 *
 * Resolves merge conflicts using AI
 *
 * **File-based Artifact Management:**
 * - Reads tasks from Sprint Backlog (`.kugutsu/sprints/{sprintId}/sprint-backlog.json`)
 * - Reads conflicts from `.kugutsu/sprints/{sprintId}/tasks/{taskId}/conflicts.json` (resolution === 'pending')
 * - After AI resolution, updates conflicts.json resolution to 'resolved'
 * - Updates Sprint Backlog status to re-queue for merge
 */
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import { FileReader } from '../../utils/FileReader.js';
import { DataPersistence } from '../../utils/DataPersistence.js';
import { AIFileWriter } from '../../utils/AIFileWriter.js';
import { MessageHandler } from '../../utils/MessageHandler.js';
/**
 * Conflict Resolver Node
 *
 * Responsibilities:
 * 1. Identify tasks with merge conflicts
 * 2. Use AI to resolve conflicts
 * 3. Resume original engineer's session for context
 * 4. Retry merge after resolution
 */
export async function conflictResolverNode(state) {
    const { config, activeSprint } = state;
    const maxTurns = config.maxTurns || 50;
    // Sync failed providers from state
    AIProviderFactory.syncWithState(state.failedProviders || []);
    console.log('🔧 Conflict Resolver: コンフリクトを解消しています...');
    if (!activeSprint?.id) {
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'error',
                    source: 'ConflictResolverNode',
                    message: 'アクティブなスプリントが設定されていません',
                },
            ],
            failedProviders: AIProviderFactory.getFailedProviders(),
        };
    }
    const sprintId = activeSprint.id;
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
                    source: 'ConflictResolverNode',
                    message: `Sprint Backlog の読み込みに失敗: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
            failedProviders: AIProviderFactory.getFailedProviders(),
        };
    }
    try {
        // Find tasks with conflicts (check conflicts.json files)
        const tasks = backlog.tasks;
        const conflictTasks = [];
        if (conflictTasks.length === 0) {
            console.log('✅ コンフリクトはありません');
            return {
                logs: [
                    {
                        timestamp: new Date(),
                        level: 'info',
                        source: 'ConflictResolverNode',
                        message: 'コンフリクトはありません',
                    },
                ],
                failedProviders: AIProviderFactory.getFailedProviders(),
            };
        }
        // Filter tasks with pending conflicts
        const tasksToResolve = [];
        const conflictsMap = new Map();
        for (const task of tasks) {
            try {
                const conflicts = await fileReader.readJSON(`.kugutsu/sprints/${sprintId}/tasks/${task.id}/conflicts.json`);
                if (conflicts.resolution === 'pending') {
                    tasksToResolve.push(task);
                    conflictsMap.set(task.id, conflicts);
                }
            }
            catch (error) {
                // conflicts.jsonが存在しない場合はスキップ（コンフリクトなし）
            }
        }
        if (tasksToResolve.length === 0) {
            console.log('✅ 解決待ちのコンフリクトはありません');
            return {
                logs: [
                    {
                        timestamp: new Date(),
                        level: 'info',
                        source: 'ConflictResolverNode',
                        message: '解決待ちのコンフリクトはありません',
                    },
                ],
                failedProviders: AIProviderFactory.getFailedProviders(),
            };
        }
        console.log(`⚠️ ${tasksToResolve.length}個のコンフリクトを処理します`);
        // Create AI provider
        const providerConfig = AIProviderFactory.buildProviderConfig({
            provider: state.config.provider || 'claude',
        });
        const provider = AIProviderFactory.create(providerConfig);
        const logs = [];
        const MAX_CONFLICT_RESOLVER_ATTEMPTS = 3; // 最大再試行回数
        for (const task of tasksToResolve) {
            // 再試行回数のチェック（デフォルト: 0）
            const attemptCount = task.conflictResolverAttemptCount || 0;
            if (attemptCount >= MAX_CONFLICT_RESOLVER_ATTEMPTS) {
                console.log(`❌ タスク ${task.id} をスキップ（再試行上限 ${MAX_CONFLICT_RESOLVER_ATTEMPTS}回 に到達）`);
                // タスクを failed に変更
                await persistence.updateSprintBacklogTask(sprintId, task.id, {
                    status: 'failed',
                });
                logs.push({
                    timestamp: new Date(),
                    level: 'error',
                    source: 'ConflictResolverNode',
                    message: `タスク ${task.id} を失敗に変更（再試行上限 ${MAX_CONFLICT_RESOLVER_ATTEMPTS}回）`,
                    data: {
                        taskId: task.id,
                        reason: 'max_attempts_reached',
                        attemptCount,
                    },
                    taskId: task.id,
                });
                continue;
            }
            if (!task.branchName) {
                console.log(`⏭️ タスク ${task.id} をスキップ（ブランチ情報なし）`);
                logs.push({
                    timestamp: new Date(),
                    level: 'warn',
                    source: 'ConflictResolverNode',
                    message: `タスク ${task.id} をスキップ（ブランチ情報なし）`,
                    data: {
                        taskId: task.id,
                        reason: 'missing_branch_name',
                    },
                    taskId: task.id,
                });
                continue;
            }
            const conflictInfo = conflictsMap.get(task.id);
            const conflictFiles = conflictInfo.conflictFiles.map((cf) => cf.path);
            console.log(`🔧 コンフリクト解消中: ${task.id}`);
            try {
                // Build conflict resolution prompt
                const conflictResolutionPrompt = `
# Merge Conflict Resolution

以下のマージコンフリクトを解消してください。

## タスク情報
- **ID**: ${task.id}
- **タイトル**: ${task.title}
- **説明**: ${task.description}
- **ブランチ**: ${task.branchName}

## コンフリクト情報
- **ターゲットブランチ**: ${config.baseBranch}
- **コンフリクトファイル**: ${conflictFiles.join(', ')}

## 作業ディレクトリ
${config.worktreeBasePath}/${task.id}

## 解決手順

### 1. コンフリクトファイルの確認
- コンフリクトが発生しているファイルを確認してください
- 両方の変更内容を理解してください

### 2. コンフリクトマーカーの解消
- \`<<<<<<<\`, \`=======\`, \`>>>>>>>\` マーカーを見つけてください
- 両方の変更を適切に統合してください
- コンフリクトマーカーをすべて削除してください

### 3. コードの整合性確認
- 統合後のコードが正しく動作するか確認してください
- テストを実行して問題がないか確認してください

### 4. コミット
- 解決後、適切なコミットメッセージでコミットしてください

## 重要な注意
- **両方の変更内容を尊重してください**
- **機能を失わないように統合してください**
- **テストが通ることを確認してください**
- **git add と git commit を実行してください**
- **git push は実行しないでください**
`;
                // Execute conflict resolution
                const worktreePath = `${config.worktreeBasePath}/${task.id}`;
                const handler = new MessageHandler({
                    maxTurns,
                    nodeName: `ConflictResolver - Task ${task.id}`,
                    taskId: task.id,
                });
                for await (const message of provider.execute(conflictResolutionPrompt, {
                    maxTurns,
                    cwd: worktreePath,
                    permissionMode: 'acceptEdits',
                    allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
                    includePartialMessages: true,
                })) {
                    await handler.handleMessage(message);
                }
                handler.completeWithErrorCheck('コンフリクト解決が完了しました', 'ConflictResolver');
                // Update conflicts.json - mark as resolved using AI
                conflictInfo.resolution = 'resolved';
                conflictInfo.resolvedAt = new Date().toISOString();
                await AIFileWriter.writeFile(provider, `.kugutsu/sprints/${sprintId}/tasks/${task.id}/conflicts.json`, conflictInfo, config.baseRepoPath);
                console.log(`📝 conflicts.json を更新しました (resolved): ${task.id}`);
                // Update Sprint Backlog - change status back to 'in_review' for re-merge
                // 再試行回数をインクリメント
                const newAttemptCount = (task.conflictResolverAttemptCount || 0) + 1;
                console.log(`🔄 再試行回数を更新: ${task.id} (${newAttemptCount}/${MAX_CONFLICT_RESOLVER_ATTEMPTS}回)`);
                await persistence.updateSprintBacklogTask(sprintId, task.id, {
                    status: 'in_review', // 再マージのためにin_reviewに戻す
                });
                console.log(`📝 Sprint Backlogのタスクステータスを更新しました: in_review`);
                logs.push({
                    timestamp: new Date(),
                    level: 'info',
                    source: 'ConflictResolverNode',
                    message: `タスク ${task.id} のコンフリクト解消成功`,
                    data: { taskId: task.id },
                    taskId: task.id,
                });
                console.log(`✅ コンフリクト解消成功: ${task.id}`);
            }
            catch (error) {
                console.error(`❌ コンフリクト解消エラー: ${task.id}`, error);
                // エラー時も再試行回数をインクリメント
                const newAttemptCount = (task.conflictResolverAttemptCount || 0) + 1;
                console.log(`🔄 再試行回数を更新（エラー）: ${task.id} (${newAttemptCount}/${MAX_CONFLICT_RESOLVER_ATTEMPTS}回)`);
                // 上限に達した場合は failed に設定
                const newStatus = newAttemptCount >= MAX_CONFLICT_RESOLVER_ATTEMPTS ? 'failed' : 'in_progress';
                try {
                    await persistence.updateSprintBacklogTask(sprintId, task.id, {
                        status: newStatus,
                    });
                    if (newStatus === 'failed') {
                        console.log(`❌ タスク ${task.id} を失敗に変更（再試行上限到達）`);
                    }
                    else {
                        console.log(`⚠️ Sprint Backlogのタスクステータスを更新しました: in_progress (再試行)`);
                    }
                }
                catch (updateError) {
                    console.error(`❌ Sprint Backlog の更新に失敗: ${task.id}`, updateError);
                }
                logs.push({
                    timestamp: new Date(),
                    level: 'error',
                    source: 'ConflictResolverNode',
                    message: `タスク ${task.id} の処理エラー: ${error instanceof Error ? error.message : String(error)}`,
                    data: {
                        taskId: task.id,
                        error,
                        attemptCount: newAttemptCount,
                        newStatus,
                    },
                    taskId: task.id,
                });
            }
        }
        return {
            logs,
            metadata: {
                phase: 'merge',
            },
            failedProviders: AIProviderFactory.getFailedProviders(),
        };
    }
    catch (error) {
        console.error('❌ Conflict Resolver Node エラー:', error);
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'error',
                    source: 'ConflictResolverNode',
                    message: `コンフリクト解消に失敗: ${error instanceof Error ? error.message : String(error)}`,
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
            failedProviders: AIProviderFactory.getFailedProviders(),
        };
    }
}
//# sourceMappingURL=ConflictResolverNode.js.map