/**
 * Engineer Node
 *
 * Executes code implementation for a specific task
 *
 * **File-based Artifact Management:**
 * - Reads tasks from `.kugutsu/tasks.json`
 * - Reads instruction from `.kugutsu/tasks/{taskId}/instruction.md`
 * - Updates task status to `implemented` in tasks.json after completion
 */

import type { ParallelDevStateType, ParallelDevStateUpdate } from '../state.js';
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import type { AIProviderConfig } from '../../providers/IAIProvider.js';
import { FileReader } from '../../utils/FileReader.js';
import { FileWriter } from '../../utils/FileWriter.js';
import type { TaskArtifact } from '../../types/artifacts.js';

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
  const { config, tasksPath } = state;

  console.log(`👷 Engineer: タスク ${taskId} を実装しています...`);

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
          source: 'EngineerNode',
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
          source: 'EngineerNode',
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
          source: 'EngineerNode',
          message: `タスク ${taskId} のworktreeが設定されていません`,
          taskId,
        },
      ],
    };
  }

  // Read instruction.md
  const instructionPath = `.kugutsu/tasks/${taskId}/instruction.md`;
  let instruction: string;
  try {
    instruction = await fileReader.readMarkdown(instructionPath);
  } catch (error) {
    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'error',
          source: 'EngineerNode',
          message: `instruction.md の読み込みに失敗: ${error instanceof Error ? error.message : String(error)}`,
          taskId,
        },
      ],
    };
  }

  console.log(`📖 instruction.md を読み込みました`);

  try {
    // Create AI provider
    const providerConfig: AIProviderConfig = {
      provider: state.config.provider || 'claude',
      claude: {
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
      },
    };

    const provider = AIProviderFactory.create(providerConfig);

    // Build implementation prompt with instruction.md content
    const dependenciesSection = taskArtifact.dependencies.length > 0
      ? `このタスクは以下のタスクに依存しています：
${taskArtifact.dependencies.map((depId) => `- ${depId}`).join('\n')}

これらのタスクの変更内容を確認し、整合性を保ってください。`
      : 'このタスクに依存関係はありません。';

    const implementationPrompt = `
# Task Implementation

以下のタスクを実装してください。

## タスク情報
- **ID**: ${taskArtifact.id}
- **タイトル**: ${taskArtifact.title}

## 作業ディレクトリ
${taskArtifact.worktreePath}

## タスクの詳細指示

${instruction}

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
    let sessionId: string | undefined = taskArtifact.sessionId;

    for await (const message of provider.execute(implementationPrompt, {
      maxTurns: state.config.maxTurns,
      cwd: taskArtifact.worktreePath,
      permissionMode: 'acceptEdits',
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      resume: taskArtifact.sessionId,
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

    // Update task status to 'implemented' and save to file
    taskArtifact.status = 'implemented';
    taskArtifact.sessionId = sessionId;
    taskArtifact.updatedAt = new Date().toISOString();

    await fileWriter.writeJSON(tasksPath || '.kugutsu/tasks.json', tasks);
    console.log(`📝 タスクステータスを更新しました: implemented`);

    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'info',
          source: 'EngineerNode',
          message: `タスク ${taskId} の実装が完了しました`,
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

    // Try to update task status to 'failed' in tasks.json
    try {
      const fileReader = new FileReader(config.baseRepoPath);
      const fileWriter = new FileWriter(config.baseRepoPath);
      const tasks = await fileReader.readJSON<TaskArtifact[]>(tasksPath || '.kugutsu/tasks.json');
      const taskArtifact = tasks.find((t) => t.id === taskId);

      if (taskArtifact) {
        taskArtifact.status = 'failed';
        taskArtifact.updatedAt = new Date().toISOString();
        await fileWriter.writeJSON(tasksPath || '.kugutsu/tasks.json', tasks);
        console.log(`📝 タスクステータスを更新しました: failed`);
      }
    } catch (fileError) {
      console.error(`❌ tasks.json の更新に失敗:`, fileError);
    }

    return {
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
