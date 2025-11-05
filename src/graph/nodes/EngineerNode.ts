/**
 * Engineer Node
 *
 * Executes code implementation for a specific task
 */

import type { ParallelDevStateType, ParallelDevStateUpdate } from '../state.js';
import type { Task } from '../types.js';
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import type { AIProviderConfig } from '../../providers/IAIProvider.js';

/**
 * Engineer Node
 *
 * Responsibilities:
 * 1. Implement code for the task
 * 2. Follow TDD approach
 * 3. Create appropriate commits
 * 4. Handle errors
 * 5. Preserve session for conflict resolution
 */
export async function engineerNode(
  state: ParallelDevStateType,
  taskId: string
): Promise<ParallelDevStateUpdate> {
  // Find the task
  const task = state.tasks.find((t) => t.id === taskId);

  if (!task) {
    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'error',
          source: 'EngineerNode',
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
          source: 'EngineerNode',
          message: `タスク ${taskId} のworktreeが設定されていません`,
          taskId,
        },
      ],
    };
  }

  console.log(`👷 Engineer: タスク ${taskId} を実装しています...`);

  try {
    // Create AI provider
    const providerConfig: AIProviderConfig = {
      provider: state.config.provider || 'claude',
      claude: {
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
      },
    };

    const provider = AIProviderFactory.create(providerConfig);

    // Build implementation prompt
    const dependenciesSection = task.dependencies.length > 0
      ? `このタスクは以下のタスクに依存しています：
${task.dependencies.map((depId) => `- ${depId}`).join('\n')}

これらのタスクの変更内容を確認し、整合性を保ってください。`
      : 'このタスクに依存関係はありません。';

    const implementationPrompt = `
# Task Implementation

以下のタスクを実装してください。

## タスク情報
- **ID**: ${task.id}
- **タイトル**: ${task.title}
- **説明**: ${task.description}

## 作業ディレクトリ
${task.worktreePath}

## 実装要件

### 1. テスト駆動開発（TDD）
- まずテストを作成してください
- テストを実行して失敗を確認してください
- その後、テストをパスする実装を行ってください

### 2. コミット
- 適切な単位でgit commitを作成してください
- コミットメッセージは明確で説明的に

### 3. コード品質
- 既存のコードスタイルに従ってください
- エラーハンドリングを適切に実装してください
- 必要に応じてドキュメントを追加してください

### 4. 依存関係
${dependenciesSection}

## 完了条件
- すべてのテストが通過する
- コードレビュー可能な状態
- 適切なコミットが作成されている

## 重要な注意
- **git add と git commit は実行してください**
- ただし、**git push は実行しないでください**（レビュー後にマージします）
`;

    // Execute implementation
    const messages: any[] = [];
    let sessionId: string | undefined = task.sessionId;

    for await (const message of provider.execute(implementationPrompt, {
      maxTurns: state.config.maxTurns,
      cwd: task.worktreePath,
      permissionMode: 'acceptEdits',
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      resume: task.sessionId,
    })) {
      messages.push(message);

      // Capture session ID for potential conflict resolution
      if (message.session_id) {
        sessionId = message.session_id;
      }

      // Log progress
      if (message.type === 'assistant' && message.content) {
        console.log(`  💬 ${JSON.stringify(message.content).substring(0, 100)}...`);
      }
    }

    console.log(`✅ タスク ${taskId} の実装が完了しました`);

    // Update task as completed
    const completedTask: Task = {
      ...task,
      status: 'completed',
      sessionId,
      updatedAt: new Date(),
    };

    return {
      tasks: [completedTask],
      completedTasks: [completedTask],
      logs: [
        {
          timestamp: new Date(),
          level: 'info',
          source: 'EngineerNode',
          message: `タスク ${taskId} が完了しました`,
          data: {
            taskId,
            messageCount: messages.length,
            sessionId,
          },
          taskId,
          sessionId,
        },
      ],
      metadata: {
        tasksCompleted: (state.metadata.tasksCompleted || 0) + 1,
      },
    };
  } catch (error) {
    console.error(`❌ タスク ${taskId} の実装に失敗:`, error);

    // Mark task as failed
    const failedTask: Task = {
      ...task,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      updatedAt: new Date(),
    };

    return {
      tasks: [failedTask],
      failedTasks: [failedTask],
      logs: [
        {
          timestamp: new Date(),
          level: 'error',
          source: 'EngineerNode',
          message: `タスク ${taskId} が失敗しました: ${error instanceof Error ? error.message : String(error)}`,
          data: {
            taskId,
            error,
          },
          taskId,
        },
      ],
      metadata: {
        tasksFailed: (state.metadata.tasksFailed || 0) + 1,
        hasErrors: true,
        errors: [
          ...(state.metadata.errors || []),
          `Task ${taskId}: ${error instanceof Error ? error.message : String(error)}`,
        ],
      },
    };
  }
}
