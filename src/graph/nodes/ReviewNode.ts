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
import type { Task, Review } from '../types.js';
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import type { AIProviderConfig } from '../../providers/IAIProvider.js';
import { FileReader } from '../../utils/FileReader.js';
import { AIFileWriter } from '../../utils/AIFileWriter.js';
import { TaskStateMachine } from '../../utils/TaskStateMachine.js';
import type { TaskArtifact, Review as ReviewArtifact, ReviewComment } from '../../types/artifacts.js';
import { RetryManager } from '../../utils/RetryManager.js';
import { ErrorClassifier } from '../../utils/ErrorClassifier.js';

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
 */
export async function reviewNode(
  state: ParallelDevStateType,
  taskId: string
): Promise<ParallelDevStateUpdate> {
  const { config, tasks, tasksPath } = state;

  console.log(`🔍 Review: タスク ${taskId} をレビューしています...`);

  // Read tasks from file
  const fileReader = new FileReader(config.baseRepoPath);

  let taskArtifacts: TaskArtifact[];
  try {
    taskArtifacts = await fileReader.readJSON<TaskArtifact[]>(tasksPath || '.kugutsu/tasks.json');
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

    // Execute review with retry mechanism
    const reviewComments: string[] = [];
    let reviewStatus: 'approved' | 'changes_requested' = 'approved';

    const reviewResult = await RetryManager.executeWithRetry(
      async () => {
        const comments: string[] = [];
        let status: 'approved' | 'changes_requested' = 'approved';

        for await (const message of provider.execute(reviewPrompt, {
          maxTurns: 10,
          cwd: taskArtifact.worktreePath,
          allowedTools: ['Read', 'Grep', 'Glob', 'Bash'],
          permissionMode: 'acceptEdits',
        })) {
          if (message.type === 'assistant' && message.content) {
            const content = JSON.stringify(message.content);
            comments.push(content);

            // Check for review status
            if (content.includes('CHANGES_REQUESTED')) {
              status = 'changes_requested';
            }
          }
        }

        return { comments, status };
      },
      {
        maxRetries: 3,
        initialDelayMs: 2000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
        retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'rate_limit', 'Rate limit', 'timeout', 'network'],
      }
    );

    if (!reviewResult.success) {
      // レビュー実行失敗 - エラーを分類
      const classifiedError = ErrorClassifier.classify(reviewResult.error!);

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
    reviewComments.push(...reviewResult.data!.comments);
    reviewStatus = reviewResult.data!.status;

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

    // Write review.json using AI
    const reviewPath = `.kugutsu/tasks/${taskId}/review.json`;
    await AIFileWriter.writeFile(provider, reviewPath, reviewArtifact, config.baseRepoPath);
    console.log(`📝 レビュー結果を保存しました: ${reviewPath}`);

    // Update task status in tasks.json (only if approved) using AI
    if (finalStatus === 'approved') {
      const updates = {
        status: 'reviewed',
        updatedAt: new Date().toISOString(),
      };
      await AIFileWriter.updateTaskInTasksJson(
        provider,
        tasksPath || '.kugutsu/tasks.json',
        taskId,
        updates,
        config.baseRepoPath
      );
      console.log(`✅ タスクステータス(ファイル)を更新しました: reviewed`);
    }

    // Create State Review object
    const stateReview: Review = {
      taskId: taskArtifact.id,
      reviewer: 'TechLeadAI',
      status: finalStatus === 'approved' ? 'approved' : 'changes_requested',
      comments: reviewComments,
      timestamp: new Date(),
      issues: reviewComments
        .filter((c) => finalStatus === 'changes_requested')
        .map((c) => ({
          severity: 'medium' as const,
          description: c,
        })),
    };

    // Update State task: in_review → completed or in_progress
    const stateTask = state.tasks.find((t) => t.id === taskId);
    let updatedTask: Task | undefined;

    if (stateTask) {
      if (finalStatus === 'approved') {
        // in_review → completed
        updatedTask = TaskStateMachine.transition(stateTask, 'completed');
        console.log(`📝 タスクステータス(State)を更新しました: in_review → completed`);
      } else {
        // in_review → in_progress (changes requested)
        updatedTask = TaskStateMachine.transition(stateTask, 'in_progress');
        console.log(`📝 タスクステータス(State)を更新しました: in_review → in_progress (変更要求)`);
      }
    }

    return {
      tasks: updatedTask ? [updatedTask] : [],
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
