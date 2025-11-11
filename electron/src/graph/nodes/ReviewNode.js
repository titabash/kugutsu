/**
 * Review Node
 *
 * Performs code review for completed tasks
 *
 * **File-based Artifact Management:**
 * - Reads tasks from `.kugutsu/tasks.json`
 * - Writes review result to `.kugutsu/sprints/{sprintId}/tasks/{taskId}/review.json`
 * - Updates task status to `reviewed` in tasks.json (only if approved)
 */
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import { FileReader } from '../../utils/FileReader.js';
import { AIFileWriter } from '../../utils/AIFileWriter.js';
import { TaskStateMachine } from '../../utils/TaskStateMachine.js';
import { RetryManager } from '../../utils/RetryManager.js';
import { ErrorClassifier } from '../../utils/ErrorClassifier.js';
import { MessageHandler } from '../../utils/MessageHandler.js';
/**
 * Review Node
 *
 * Responsibilities:
 * 1. Review code changes
 * 2. Check code quality
 * 3. Verify test coverage
 * 4. Check for security issues
 * 5. Approve or request changes
 * 6. Transition task: in_review → completed (approved) or in_progress (changes requested)
 *
 * **Send API Compatible:**
 * This node is designed to be called via Send API with `currentTaskId` in state.
 * The taskId is retrieved from `state.currentTaskId` for parallel execution.
 *
 * **Backward Compatibility:**
 * For backward compatibility with tests, taskId can also be passed as a second parameter.
 */
export async function reviewNode(state, taskIdParam) {
    const { config, tasks, tasksPath, activeSprint, globalTasks, currentTaskId } = state;
    const maxTurns = config.maxTurns || 50;
    const startTime = Date.now();
    // Retrieve task ID from parameter (backward compatibility) or state (Send API pattern)
    const taskId = taskIdParam || currentTaskId;
    if (!taskId) {
        console.error('❌ taskId is not provided (neither as parameter nor in state.currentTaskId)');
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'error',
                    source: 'ReviewNode',
                    message: 'taskId is not provided (neither as parameter nor in state.currentTaskId)',
                },
            ],
        };
    }
    // アクティブスプリントIDを取得
    if (!activeSprint?.id) {
        console.error('❌ アクティブなスプリントが設定されていません');
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'error',
                    source: 'ReviewNode',
                    message: 'アクティブなスプリントが設定されていません',
                    taskId,
                },
            ],
        };
    }
    const sprintId = activeSprint.id;
    // Read tasks from file
    const fileReader = new FileReader(config.baseRepoPath);
    let taskArtifacts;
    try {
        taskArtifacts = await fileReader.readJSON(tasksPath || '.kugutsu/tasks.json');
    }
    catch (error) {
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'error',
                    source: 'ReviewNode',
                    message: `tasks.json の読み込みに失敗: ${error instanceof Error ? error.message : String(error)}`,
                    taskId,
                },
            ],
        };
    }
    // Find the task
    const taskArtifact = taskArtifacts.find((t) => t.id === taskId);
    if (!taskArtifact) {
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'error',
                    source: 'ReviewNode',
                    message: `タスク ${taskId} が見つかりません`,
                    taskId,
                },
            ],
        };
    }
    // ✨ レビュー開始ログ（詳細版）
    const task = tasks.find((t) => t.id === taskId);
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔍 [${taskId}] ${task?.title || taskArtifact.title} - レビュー開始`);
    console.log(`   Reviewer: TechLead-${taskId}`);
    if (taskArtifact.worktreePath) {
        console.log(`   Worktree: ${taskArtifact.worktreePath}`);
    }
    if (taskArtifact.branchName) {
        console.log(`   Branch: ${taskArtifact.branchName}`);
    }
    console.log(`   最大ターン数: ${maxTurns}`);
    console.log(`${'='.repeat(70)}\n`);
    if (!taskArtifact.worktreePath) {
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'error',
                    source: 'ReviewNode',
                    message: `タスク ${taskId} のworktreeが設定されていません`,
                    taskId,
                },
            ],
        };
    }
    try {
        // Create AI provider
        const providerConfig = AIProviderFactory.buildProviderConfig({
            provider: state.config.provider || 'claude',
        });
        const provider = AIProviderFactory.create(providerConfig);
        // 設計書セクションの構築
        const storyMappingSection = state.storyMapping
            ? `
## 📖 参照：ストーリーマッピング

実装が全体の文脈に沿っているか確認してください。

\`\`\`json
${JSON.stringify(state.storyMapping, null, 2)}
\`\`\`
`
            : '';
        const designDocsSection = state.designDocs
            ? `
## 📐 参照：設計書

実装が設計書に準拠しているか確認してください。

${state.designDocs.databasePath ? `### データベース設計
ファイルパス: ${state.designDocs.databasePath}
**Readツールで読み込んで参照してください**
` : ''}
${state.designDocs.apiPath ? `### API仕様
ファイルパス: ${state.designDocs.apiPath}
**Readツールで読み込んで参照してください**
` : ''}
${state.designDocs.uiuxPath ? `### UI/UX設計
ファイルパス: ${state.designDocs.uiuxPath}
**Readツールで読み込んで参照してください**
` : ''}
`
            : '';
        const sprintPlanSection = state.sprintPlanPath
            ? `
## 📅 参照：スプリント計画

ファイルパス: ${state.sprintPlanPath}
**Readツールで読み込んで参照してください**
スプリント目標との整合性を確認してください。
`
            : '';
        // Read instruction.md for additional context
        const instructionPath = `.kugutsu/sprints/${sprintId}/tasks/${taskId}/instruction.md`;
        let instructionContent = '';
        try {
            instructionContent = await fileReader.readFile(instructionPath);
        }
        catch (error) {
            // instruction.md is optional for review
            console.log(`⚠️ instruction.md が見つかりません（レビューは続行）`);
        }
        const instructionSection = instructionContent
            ? `
## タスクの実装指示

\`\`\`markdown
${instructionContent}
\`\`\`
`
            : '';
        // Build review prompt
        const reviewPrompt = `
# Code Review

以下のタスクのコードレビューを実施してください。

## タスク情報
- **ID**: ${taskArtifact.id}
- **タイトル**: ${taskArtifact.title}
- **説明**: ${taskArtifact.description}
- **ブランチ**: ${taskArtifact.branchName}

## 作業ディレクトリ
${taskArtifact.worktreePath}
${instructionSection}${storyMappingSection}${designDocsSection}${sprintPlanSection}
## レビュー観点

### 1. 設計書との整合性 ⭐ 最優先
- ストーリーマッピングで定義されたユーザー価値を提供しているか
- データベース設計に準拠しているか
- API仕様に準拠しているか
- UI/UX設計に準拠しているか
- タスクの実装指示（instruction.md）に従っているか

### 2. コード品質
- コードは読みやすく、保守しやすいか
- 適切な命名規則が使われているか
- 適切なコメントが付いているか
- 重複コードがないか

### 3. テストカバレッジ
- 適切なテストが書かれているか
- テストは実行可能か
- エッジケースがカバーされているか

### 4. セキュリティ
- セキュリティ上の脆弱性がないか
- 入力のバリデーションが適切か
- 機密情報の漏洩リスクがないか

### 5. パフォーマンス
- パフォーマンス上の問題がないか
- 適切なデータ構造が使われているか

### 6. ドキュメント
- 必要なドキュメントが追加されているか
- API仕様が明確か

## レビュー結果の出力形式

以下の形式で結論を出力してください：

\`\`\`
REVIEW_STATUS: APPROVED または CHANGES_REQUESTED
\`\`\`

そして、コメントを箇条書きで記載してください。特に設計書との乖離がある場合は明確に指摘してください。
`;
        // Execute review with retry mechanism
        const reviewComments = [];
        let reviewStatus = 'approved';
        const reviewResult = await RetryManager.executeWithRetry(async () => {
            const comments = [];
            let status = 'approved';
            const handler = new MessageHandler({
                maxTurns,
                nodeName: `Review - Task ${taskId}`,
                taskId,
            });
            for await (const message of provider.execute(reviewPrompt, {
                maxTurns,
                cwd: taskArtifact.worktreePath,
                allowedTools: ['Read', 'Grep', 'Glob', 'Bash'],
                permissionMode: 'acceptEdits',
                includePartialMessages: true,
            })) {
                // Handle message for progress display
                await handler.handleMessage(message);
                if (message.type === 'assistant' && message.content) {
                    const content = JSON.stringify(message.content);
                    comments.push(content);
                    // Check for review status
                    if (content.includes('CHANGES_REQUESTED')) {
                        status = 'changes_requested';
                    }
                }
            }
            // エラーチェック（Claude Agent SDK仕様準拠）
            if (handler.getHasError()) {
                const details = handler.getErrorDetails();
                // エラーメッセージの構築
                let errorMsg;
                if (details?.message) {
                    errorMsg = details.subtype === 'error_max_turns'
                        ? `AI実行がmaxTurns制限に到達しました: ${details.message}`
                        : `AI実行中にエラーが発生しました: ${details.message}`;
                }
                else if (details?.errors && details.errors.length > 0) {
                    errorMsg = `AI実行中にエラーが発生しました: ${details.errors.join('; ')}`;
                }
                else {
                    errorMsg = `AI実行中にエラーが発生しました (subtype: ${details?.subtype || 'unknown'})`;
                    console.warn(`⚠️  エラー詳細が取得できませんでした。ErrorDetails:`, JSON.stringify(details, null, 2));
                }
                throw new Error(errorMsg);
            }
            handler.complete(true, `レビュー完了 - ${status === 'approved' ? '承認' : '修正要求'}`);
            return { comments, status };
        }, {
            maxRetries: 3,
            initialDelayMs: 2000,
            maxDelayMs: 30000,
            backoffMultiplier: 2,
            retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'rate_limit', 'Rate limit', 'timeout', 'network'],
        });
        if (!reviewResult.success) {
            // レビュー実行失敗 - エラーを分類
            const classifiedError = ErrorClassifier.classify(reviewResult.error);
            console.error(`❌ タスク ${taskId} のレビューに失敗 (${reviewResult.attempts}回試行): ${reviewResult.error?.message}`);
            return {
                logs: [
                    {
                        timestamp: new Date(),
                        level: 'error',
                        source: 'ReviewNode',
                        message: `タスク ${taskId} のレビューに失敗: ${classifiedError.message}`,
                        taskId,
                        data: {
                            error: reviewResult.error?.message,
                            severity: classifiedError.severity,
                            attempts: reviewResult.attempts,
                        },
                    },
                ],
                metadata: {
                    hasErrors: true,
                    errors: [
                        ...(state.metadata.errors || []),
                        `Review ${taskId}: ${reviewResult.error?.message || 'Unknown error'}`,
                    ],
                },
            };
        }
        // レビュー成功 - 結果を取得
        reviewComments.push(...reviewResult.data.comments);
        reviewStatus = reviewResult.data.status;
        // Check for issues in comments
        const hasIssues = reviewStatus === 'changes_requested' ||
            reviewComments.some((c) => {
                const lowerC = c.toLowerCase();
                return (lowerC.includes('issue') ||
                    lowerC.includes('problem') ||
                    lowerC.includes('concern') ||
                    lowerC.includes('fix'));
            });
        const finalStatus = hasIssues
            ? 'changes_requested'
            : 'approved';
        // ✨ レビュー完了ログ（詳細版）
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        const statusIcon = finalStatus === 'approved' ? '✅' : '⚠️';
        const statusText = finalStatus === 'approved' ? 'レビュー承認' : '修正要求';
        console.log(`\n${'='.repeat(70)}`);
        console.log(`${statusIcon} [${taskId}] ${task?.title || taskArtifact.title} - ${statusText}`);
        console.log(`   所要時間: ${duration}秒`);
        console.log(`   コメント数: ${reviewComments.length}件`);
        if (reviewComments.length > 0) {
            console.log(`   主なコメント: ${reviewComments[0].substring(0, 60)}...`);
        }
        console.log(`${'='.repeat(70)}\n`);
        // Create review artifact for file
        const reviewArtifact = {
            taskId: taskArtifact.id,
            status: finalStatus,
            reviewedBy: 'TechLeadAI',
            reviewedAt: new Date().toISOString(),
            comments: reviewComments.map((comment) => ({
                file: '',
                severity: finalStatus === 'approved' ? 'info' : 'warning',
                message: comment,
            })),
            summary: `レビュー結果: ${finalStatus}`,
            suggestions: [],
        };
        // Write review.json using AI
        const reviewPath = `.kugutsu/sprints/${sprintId}/tasks/${taskId}/review.json`;
        await AIFileWriter.writeFile(provider, reviewPath, reviewArtifact, config.baseRepoPath);
        console.log(`📝 レビュー結果を保存しました: ${reviewPath}`);
        // Update task status in tasks.json (only if approved) using AI
        if (finalStatus === 'approved') {
            const updates = {
                status: 'reviewed',
                updatedAt: new Date().toISOString(),
            };
            await AIFileWriter.updateTaskInTasksJson(provider, tasksPath || '.kugutsu/tasks.json', taskId, updates, config.baseRepoPath);
            console.log(`✅ タスクステータス(ファイル)を更新しました: reviewed`);
        }
        // Create State Review object
        const stateReview = {
            taskId: taskArtifact.id,
            reviewer: 'TechLeadAI',
            status: finalStatus === 'approved' ? 'approved' : 'changes_requested',
            comments: reviewComments,
            timestamp: new Date(),
            issues: reviewComments
                .filter((c) => finalStatus === 'changes_requested')
                .map((c) => ({
                severity: 'medium',
                description: c,
            })),
        };
        // Update State task: in_review → completed or in_progress
        const stateTask = state.tasks.find((t) => t.id === taskId);
        let updatedTask;
        if (stateTask) {
            if (finalStatus === 'approved') {
                // in_review → completed
                updatedTask = TaskStateMachine.transition(stateTask, 'completed');
                console.log(`📝 タスクステータス(State)を更新しました: in_review → completed`);
            }
            else {
                // in_review → in_progress (changes requested)
                updatedTask = TaskStateMachine.transition(stateTask, 'in_progress');
                console.log(`📝 タスクステータス(State)を更新しました: in_review → in_progress (変更要求)`);
            }
        }
        // Sync to globalTasks
        const globalTask = globalTasks.find((t) => t.id === taskId);
        const updatedGlobalTasks = globalTask && updatedTask
            ? [{
                    ...globalTask,
                    status: updatedTask.status,
                    updatedAt: new Date(),
                }]
            : [];
        return {
            tasks: updatedTask ? [updatedTask] : [],
            globalTasks: updatedGlobalTasks,
            completedTasks: finalStatus === 'approved' && updatedTask ? [updatedTask] : [],
            reviews: [stateReview],
            logs: [
                {
                    timestamp: new Date(),
                    level: finalStatus === 'approved' ? 'info' : 'warn',
                    source: 'ReviewNode',
                    message: `タスク ${taskId} のレビュー完了: ${finalStatus}`,
                    data: {
                        taskId,
                        reviewStatus: finalStatus,
                        commentCount: reviewComments.length,
                    },
                    taskId,
                },
            ],
        };
    }
    catch (error) {
        console.error(`❌ タスク ${taskId} のレビューに失敗:`, error);
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'error',
                    source: 'ReviewNode',
                    message: `タスク ${taskId} のレビューに失敗: ${error instanceof Error ? error.message : String(error)}`,
                    data: {
                        taskId,
                        error,
                    },
                    taskId,
                },
            ],
            metadata: {
                hasErrors: true,
                errors: [
                    ...(state.metadata.errors || []),
                    `Review ${taskId}: ${error instanceof Error ? error.message : String(error)}`,
                ],
            },
        };
    }
}
//# sourceMappingURL=ReviewNode.js.map