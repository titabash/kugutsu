/**
 * Conflict Resolver Node
 *
 * Resolves merge conflicts using AI
 *
 * **File-based Artifact Management:**
 * - Reads tasks from `.kugutsu/tasks.json` (status === 'conflict_detected')
 * - Reads conflicts from `.kugutsu/tasks/{taskId}/conflicts.json` (resolution === 'pending')
 * - After AI resolution, updates conflicts.json resolution to 'resolved'
 * - Updates tasks.json status back to 'reviewed' to re-queue for merge
 */

import type { ParallelDevStateType, ParallelDevStateUpdate } from '../state.js';
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import type { AIProviderConfig } from '../../providers/IAIProvider.js';
import { FileReader } from '../../utils/FileReader.js';
import { AIFileWriter } from '../../utils/AIFileWriter.js';
import type { TaskArtifact, Conflicts } from '../../types/artifacts.js';

/**
 * Conflict Resolver Node
 *
 * Responsibilities:
 * 1. Identify tasks with merge conflicts
 * 2. Use AI to resolve conflicts
 * 3. Resume original engineer's session for context
 * 4. Retry merge after resolution
 */
export async function conflictResolverNode(
  state: ParallelDevStateType
): Promise<ParallelDevStateUpdate> {
  const { config, tasksPath } = state;

  console.log('🔧 Conflict Resolver: コンフリクトを解消しています...');

  // Read tasks from file
  const fileReader = new FileReader(config.baseRepoPath);

  let tasks: TaskArtifact[];
  try {
    tasks = await fileReader.readJSON<TaskArtifact[]>(tasksPath || '.kugutsu/tasks.json');
  } catch (error) {
    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'error',
          source: 'ConflictResolverNode',
          message: `tasks.json の読み込みに失敗: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }

  try {
    // Find tasks with status 'conflict_detected'
    const conflictTasks = tasks.filter((t) => t.status === 'conflict_detected');

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
      };
    }

    // Filter tasks with pending conflicts
    const tasksToResolve: TaskArtifact[] = [];
    const conflictsMap = new Map<string, Conflicts>();

    for (const task of conflictTasks) {
      try {
        const conflicts = await fileReader.readJSON<Conflicts>(`.kugutsu/tasks/${task.id}/conflicts.json`);
        if (conflicts.resolution === 'pending') {
          tasksToResolve.push(task);
          conflictsMap.set(task.id, conflicts);
        }
      } catch (error) {
        console.warn(`⚠️ conflicts.json の読み込みに失敗: ${task.id}`);
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
      };
    }

    console.log(`⚠️ ${tasksToResolve.length}個のコンフリクトを処理します`);

    // Create AI provider
    const providerConfig: AIProviderConfig = {
      provider: state.config.provider || 'claude',
      claude: {
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
      },
    };

    const provider = AIProviderFactory.create(providerConfig);

    const logs: any[] = [];

    for (const task of tasksToResolve) {
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

      const conflictInfo = conflictsMap.get(task.id)!;
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
        for await (const message of provider.execute(conflictResolutionPrompt, {
          maxTurns: 20,
          cwd: worktreePath,
          permissionMode: 'acceptEdits',
          allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
        })) {
          if (message.type === 'assistant' && message.content) {
            console.log(`  💬 ${JSON.stringify(message.content).substring(0, 80)}...`);
          }
        }

        // Update conflicts.json - mark as resolved using AI
        conflictInfo.resolution = 'resolved';
        conflictInfo.resolvedAt = new Date().toISOString();
        await AIFileWriter.writeFile(
          provider,
          `.kugutsu/tasks/${task.id}/conflicts.json`,
          conflictInfo,
          config.baseRepoPath
        );
        console.log(`📝 conflicts.json を更新しました (resolved): ${task.id}`);

        // Update tasks.json - change status back to 'reviewed' for re-merge using AI
        const taskToUpdate = tasks.find((t) => t.id === task.id);
        if (taskToUpdate) {
          await AIFileWriter.updateTaskInTasksJson(
            provider,
            tasksPath || '.kugutsu/tasks.json',
            task.id,
            {
              status: 'reviewed',
              updatedAt: new Date().toISOString(),
            },
            config.baseRepoPath
          );
          console.log(`📝 tasks.json を更新しました (reviewed): ${task.id}`);
        }

        logs.push({
          timestamp: new Date(),
          level: 'info',
          source: 'ConflictResolverNode',
          message: `タスク ${task.id} のコンフリクト解消成功`,
          data: { taskId: task.id },
          taskId: task.id,
        });

        console.log(`✅ コンフリクト解消成功: ${task.id}`);
      } catch (error) {
        console.error(`❌ コンフリクト解消エラー: ${task.id}`, error);

        logs.push({
          timestamp: new Date(),
          level: 'error',
          source: 'ConflictResolverNode',
          message: `タスク ${task.id} の処理エラー: ${error instanceof Error ? error.message : String(error)}`,
          data: {
            taskId: task.id,
            error,
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
    };
  } catch (error) {
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
