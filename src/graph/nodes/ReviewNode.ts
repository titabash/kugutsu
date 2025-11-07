/**
 * Review Node
 *
 * Performs code review for completed tasks
 *
 * **File-based Artifact Management:**
 * - Reads tasks from `.kugutsu/tasks.json`
 * - Writes review result to `.kugutsu/tasks/{taskId}/review.json`
 * - Updates task status to `reviewed` in tasks.json (only if approved)
 */

import type { ParallelDevStateType, ParallelDevStateUpdate } from '../state.js';
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import type { AIProviderConfig } from '../../providers/IAIProvider.js';
import { FileReader } from '../../utils/FileReader.js';
import { FileWriter } from '../../utils/FileWriter.js';
import type { TaskArtifact, Review as ReviewArtifact, ReviewComment } from '../../types/artifacts.js';

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
export async function reviewNode(
  state: ParallelDevStateType,
  taskId: string
): Promise<ParallelDevStateUpdate> {
  const { config, tasksPath } = state;

  console.log(`🔍 Review: タスク ${taskId} をレビューしています...`);

  // Read tasks from file
  const fileReader = new FileReader(config.baseRepoPath);
  const fileWriter = new FileWriter(config.baseRepoPath);

  let tasks: TaskArtifact[];
  try {
    tasks = await fileReader.readJSON<TaskArtifact[]>(tasksPath || '.kugutsu/tasks.json');
  } catch (error) {
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
  const taskArtifact = tasks.find((t) => t.id === taskId);

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
    const providerConfig: AIProviderConfig = {
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
- **ID**: ${taskArtifact.id}
- **タイトル**: ${taskArtifact.title}
- **説明**: ${taskArtifact.description}
- **ブランチ**: ${taskArtifact.branchName}

## 作業ディレクトリ
${taskArtifact.worktreePath}

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
    const reviewComments: string[] = [];
    let reviewStatus: 'approved' | 'changes_requested' = 'approved';

    for await (const message of provider.execute(reviewPrompt, {
      maxTurns: 10,
      cwd: taskArtifact.worktreePath,
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
    const hasIssues =
      reviewStatus === 'changes_requested' ||
      reviewComments.some((c) => {
        const lowerC = c.toLowerCase();
        return (
          lowerC.includes('issue') ||
          lowerC.includes('problem') ||
          lowerC.includes('concern') ||
          lowerC.includes('fix')
        );
      });

    const finalStatus: 'approved' | 'changes_requested' = hasIssues
      ? 'changes_requested'
      : 'approved';

    console.log(`${finalStatus === 'approved' ? '✅' : '⚠️'} タスク ${taskId} のレビュー: ${finalStatus}`);

    // Create review artifact for file
    const reviewArtifact: ReviewArtifact = {
      taskId: taskArtifact.id,
      status: finalStatus,
      reviewedBy: 'TechLeadAI',
      reviewedAt: new Date().toISOString(),
      comments: reviewComments.map((comment) => ({
        file: '',
        severity: finalStatus === 'approved' ? 'info' : 'warning',
        message: comment,
      } as ReviewComment)),
      summary: `レビュー結果: ${finalStatus}`,
      suggestions: [],
    };

    // Write review.json
    const reviewPath = `.kugutsu/tasks/${taskId}/review.json`;
    await fileWriter.writeJSON(reviewPath, reviewArtifact);

    console.log(`📝 レビュー結果を保存しました: ${reviewPath}`);

    // Update task status in tasks.json (only if approved)
    if (finalStatus === 'approved') {
      taskArtifact.status = 'reviewed';
      taskArtifact.updatedAt = new Date().toISOString();
      await fileWriter.writeJSON(tasksPath || '.kugutsu/tasks.json', tasks);
      console.log(`✅ タスクステータスを updated: reviewed`);
    }

    return {
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
  } catch (error) {
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
