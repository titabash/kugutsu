/**
 * Conflict Resolver Node
 *
 * Resolves merge conflicts using AI
 */
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
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
    const { mergeQueue, tasks } = state;
    console.log('🔧 Conflict Resolver: コンフリクトを解消しています...');
    try {
        // Find tasks with conflicts
        const conflictMergeTasks = mergeQueue.filter((m) => m.status === 'conflict');
        if (conflictMergeTasks.length === 0) {
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
            };
        }
        console.log(`⚠️ ${conflictMergeTasks.length}個のコンフリクトを処理します`);
        // Create AI provider
        const providerConfig = {
            provider: state.config.provider || 'claude',
            claude: {
                model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
            },
        };
        const provider = AIProviderFactory.create(providerConfig);
        const updatedMergeTasks = [];
        const logs = [];
        for (const mergeTask of conflictMergeTasks) {
            const originalTask = tasks.find((t) => t.id === mergeTask.taskId);
            if (!originalTask || !originalTask.worktreePath) {
                console.log(`⏭️ タスク ${mergeTask.taskId} をスキップ（情報不足）`);
                continue;
            }
            console.log(`🔧 コンフリクト解消中: ${mergeTask.taskId}`);
            try {
                // Build conflict resolution prompt
                const conflictResolutionPrompt = `
# Merge Conflict Resolution

以下のマージコンフリクトを解消してください。

## タスク情報
- **ID**: ${originalTask.id}
- **タイトル**: ${originalTask.title}
- **説明**: ${originalTask.description}
- **ブランチ**: ${mergeTask.sourceBranch}

## コンフリクト情報
- **ターゲットブランチ**: ${mergeTask.targetBranch}
- **コンフリクトファイル**: ${mergeTask.conflictFiles?.join(', ') || '不明'}

## 作業ディレクトリ
${originalTask.worktreePath}

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
                for await (const message of provider.execute(conflictResolutionPrompt, {
                    maxTurns: 20,
                    cwd: originalTask.worktreePath,
                    permissionMode: 'acceptEdits',
                    allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
                    resume: originalTask.sessionId, // Resume original engineer's session
                })) {
                    if (message.type === 'assistant' && message.content) {
                        console.log(`  💬 ${JSON.stringify(message.content).substring(0, 80)}...`);
                    }
                }
                // Retry merge
                const { execSync } = await import('child_process');
                process.chdir(state.config.baseRepoPath);
                try {
                    // Ensure we're on target branch
                    execSync(`git checkout ${mergeTask.targetBranch}`, { stdio: 'pipe' });
                    // Retry merge
                    execSync(`git merge ${mergeTask.sourceBranch} --no-ff -m "Merge ${mergeTask.taskId} (conflict resolved)"`, {
                        stdio: 'pipe',
                    });
                    // Success!
                    updatedMergeTasks.push({
                        ...mergeTask,
                        status: 'completed',
                        completedAt: new Date(),
                    });
                    logs.push({
                        timestamp: new Date(),
                        level: 'info',
                        source: 'ConflictResolverNode',
                        message: `タスク ${mergeTask.taskId} のコンフリクト解消成功`,
                        data: { taskId: mergeTask.taskId },
                        taskId: mergeTask.taskId,
                    });
                    console.log(`✅ コンフリクト解消成功: ${mergeTask.taskId}`);
                }
                catch (retryError) {
                    // Still has conflicts or other error
                    console.error(`❌ コンフリクト解消失敗: ${mergeTask.taskId}`, retryError);
                    // Abort merge if needed
                    try {
                        execSync('git merge --abort', { stdio: 'pipe' });
                    }
                    catch { }
                    logs.push({
                        timestamp: new Date(),
                        level: 'error',
                        source: 'ConflictResolverNode',
                        message: `タスク ${mergeTask.taskId} のコンフリクト解消失敗: ${retryError instanceof Error ? retryError.message : String(retryError)}`,
                        data: {
                            taskId: mergeTask.taskId,
                            error: retryError,
                        },
                        taskId: mergeTask.taskId,
                    });
                }
            }
            catch (error) {
                console.error(`❌ コンフリクト解消エラー: ${mergeTask.taskId}`, error);
                logs.push({
                    timestamp: new Date(),
                    level: 'error',
                    source: 'ConflictResolverNode',
                    message: `タスク ${mergeTask.taskId} の処理エラー: ${error instanceof Error ? error.message : String(error)}`,
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
        };
    }
}
//# sourceMappingURL=ConflictResolverNode.js.map