/**
 * Review Node
 *
 * Performs code review for completed tasks
 */
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
/**
 * Review Node
 *
 * Responsibilities:
 * 1. Review code changes
 * 2. Check code quality
 * 3. Verify test coverage
 * 4. Check for security issues
 * 5. Approve or request changes
 */
export async function reviewNode(state, taskId) {
    // Find the task
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) {
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
    if (!task.worktreePath) {
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
    console.log(`🔍 Review: タスク ${taskId} をレビューしています...`);
    try {
        // Create AI provider
        const providerConfig = {
            provider: state.config.provider || 'claude',
            claude: {
                model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
            },
        };
        const provider = AIProviderFactory.create(providerConfig);
        // Build review prompt
        const reviewPrompt = `
# Code Review

以下のタスクのコードレビューを実施してください。

## タスク情報
- **ID**: ${task.id}
- **タイトル**: ${task.title}
- **説明**: ${task.description}
- **ブランチ**: ${task.branchName}

## 作業ディレクトリ
${task.worktreePath}

## レビュー観点

### 1. コード品質
- コードは読みやすく、保守しやすいか
- 適切な命名規則が使われているか
- 適切なコメントが付いているか
- 重複コードがないか

### 2. テストカバレッジ
- 適切なテストが書かれているか
- テストは実行可能か
- エッジケースがカバーされているか

### 3. セキュリティ
- セキュリティ上の脆弱性がないか
- 入力のバリデーションが適切か
- 機密情報の漏洩リスクがないか

### 4. パフォーマンス
- パフォーマンス上の問題がないか
- 適切なデータ構造が使われているか

### 5. ドキュメント
- 必要なドキュメントが追加されているか
- API仕様が明確か

## レビュー結果の出力形式

以下の形式で結論を出力してください：

\`\`\`
REVIEW_STATUS: APPROVED または CHANGES_REQUESTED
\`\`\`

そして、コメントを箇条書きで記載してください。
`;
        // Execute review
        const reviewComments = [];
        let reviewStatus = 'approved';
        for await (const message of provider.execute(reviewPrompt, {
            maxTurns: 10,
            cwd: task.worktreePath,
            allowedTools: ['Read', 'Grep', 'Glob', 'Bash'],
            permissionMode: 'acceptEdits',
        })) {
            if (message.type === 'assistant' && message.content) {
                const content = JSON.stringify(message.content);
                reviewComments.push(content);
                // Check for review status
                if (content.includes('CHANGES_REQUESTED')) {
                    reviewStatus = 'changes_requested';
                }
            }
        }
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
        console.log(`${finalStatus === 'approved' ? '✅' : '⚠️'} タスク ${taskId} のレビュー: ${finalStatus}`);
        // Create review result
        const review = {
            taskId: task.id,
            reviewer: 'TechLeadAI',
            status: finalStatus,
            comments: reviewComments,
            timestamp: new Date(),
        };
        return {
            reviews: [review],
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