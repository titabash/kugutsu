/**
 * Sprint Review Node
 *
 * スプリント完了を確認し、次のスプリントが必要かを判定
 *
 * レビュー観点:
 * - スプリント内全タスクの完了状況
 * - E2Eテスト可能性
 * - デプロイ可能性
 * - 未完了タスクの判定
 */

import type { ParallelDevStateType, ParallelDevStateUpdate } from '../state.js';
import type { Sprint } from '../types.js';
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import type { AIProviderConfig } from '../../providers/IAIProvider.js';
import { DataPersistence } from '../../utils/DataPersistence.js';

/**
 * Sprint Review Node
 *
 * Responsibilities:
 * 1. Check if all tasks in active sprint are completed
 * 2. Use AI to verify E2E testability and deployability
 * 3. Save sprint to history with completion status
 * 4. Determine if more sprints are needed
 * 5. Update active sprint status
 */
export async function sprintReviewNode(
  state: ParallelDevStateType
): Promise<ParallelDevStateUpdate> {
  const { activeSprint, globalTasks, config } = state;

  console.log('🔍 SprintReview: スプリント完了確認中...');

  if (!activeSprint) {
    console.log('⚠️ アクティブなスプリントが存在しません');
    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'warn',
          source: 'sprint_review',
          message: 'アクティブなスプリントなし',
        },
      ],
    };
  }

  console.log(`📋 スプリント: ${activeSprint.name}`);
  console.log(`🎯 ゴール: ${activeSprint.goal}`);

  // データ永続化マネージャーを初期化
  const persistence = new DataPersistence(config.baseRepoPath);
  await persistence.initialize();

  // スプリントに含まれるタスクの完了状況を確認
  const sprintTasks = globalTasks.filter((task) =>
    activeSprint.taskIds.includes(task.id)
  );

  const completedTasks = sprintTasks.filter(
    (task) => task.status === 'completed'
  );
  const failedTasks = sprintTasks.filter((task) => task.status === 'failed');
  const incompleteTasks = sprintTasks.filter(
    (task) =>
      task.status !== 'completed' &&
      task.status !== 'failed'
  );

  console.log(`✅ 完了タスク: ${completedTasks.length}/${sprintTasks.length}`);
  console.log(`❌ 失敗タスク: ${failedTasks.length}/${sprintTasks.length}`);
  console.log(`⏳ 未完了タスク: ${incompleteTasks.length}/${sprintTasks.length}`);

  // スプリントメタデータを更新
  const updatedSprint: Sprint = {
    ...activeSprint,
    metadata: {
      ...activeSprint.metadata,
      completedTasksCount: completedTasks.length,
      failedTasksCount: failedTasks.length,
    },
  };

  // 全タスクが完了または失敗している場合、スプリント完了
  if (incompleteTasks.length === 0) {
    console.log('✨ スプリント内の全タスクが完了しました');

    // AIプロバイダーを作成してデプロイ可能性を判定
    const providerConfig: AIProviderConfig = {
      provider: config.provider || 'claude',
      claude: {
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
      },
    };

    const provider = AIProviderFactory.create(providerConfig);

    const deployabilityCheckPrompt = `
# スプリントレビュー: デプロイ可能性判定

以下のスプリントがデプロイ可能かを判定してください。

## スプリント情報
- 名前: ${updatedSprint.name}
- ゴール: ${updatedSprint.goal}
- 完了タスク数: ${completedTasks.length}
- 失敗タスク数: ${failedTasks.length}

## 完了タスク一覧
${JSON.stringify(
  completedTasks.map((t) => ({
    title: t.title,
    description: t.description,
  })),
  null,
  2
)}

## 判定基準
- E2Eでテスト可能な機能単位か？
- デプロイ可能な状態か？
- ユーザーに価値を提供できるか？
- 残された技術的負債や未完了作業はないか？

## 出力形式
JSON形式で以下を出力してください：
\`\`\`json
{
  "deployable": true または false,
  "e2eTestable": true または false,
  "reasoning": "判定理由",
  "blockers": ["ブロッカー1", "ブロッカー2"] (デプロイ不可の場合)
}
\`\`\`
`;

    console.log('🤖 AI: デプロイ可能性判定中...');

    let aiResponseText = '';
    for await (const message of provider.execute(deployabilityCheckPrompt, {
      maxTurns: 5,
      cwd: config.baseRepoPath,
      allowedTools: ['Read', 'Glob'],
      permissionMode: 'acceptEdits',
    })) {
      if (message.type === 'assistant' && message.content) {
        // Handle both string and object content
        if (typeof message.content === 'string') {
          aiResponseText += message.content;
        } else {
          aiResponseText += JSON.stringify(message.content);
        }
      }
    }

    // JSONを抽出してパース
    const jsonMatch = aiResponseText.match(/```json\n([\s\S]*?)\n```/);
    let deployable = true;
    let e2eTestable = true;
    let reasoning = '';
    let blockers: string[] = [];

    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[1]);
        deployable = result.deployable;
        e2eTestable = result.e2eTestable;
        reasoning = result.reasoning;
        blockers = result.blockers || [];
        console.log(`✅ AI判定: デプロイ ${deployable ? '可能' : '不可'}`);
        console.log(`💭 理由: ${reasoning}`);
        if (blockers.length > 0) {
          console.log(`🚫 ブロッカー: ${blockers.join(', ')}`);
        }
      } catch (error) {
        console.error('❌ AI応答のJSON解析に失敗しました:', error);
        // デフォルトはデプロイ可能
        deployable = true;
        e2eTestable = true;
        reasoning = 'AI判定エラーのため、デフォルトでデプロイ可能とします';
      }
    } else {
      console.warn(
        '⚠️ AI応答からJSONを抽出できませんでした。デフォルトでデプロイ可能とします。'
      );
      deployable = true;
      e2eTestable = true;
      reasoning = 'AI判定エラーのため、デフォルトでデプロイ可能とします';
    }

    // スプリントを完了状態に変更
    const completedSprint: Sprint = {
      ...updatedSprint,
      status: 'completed',
      deployable: deployable && e2eTestable,
      completedAt: new Date(),
      metadata: {
        ...updatedSprint.metadata,
        blockers,
      },
    };

    // スプリント履歴に保存
    await persistence.addToSprintHistory(completedSprint);
    console.log(`📚 スプリント履歴に記録: ${completedSprint.id}`);

    // アクティブスプリントをクリア
    await persistence.saveActiveSprint(null);
    console.log('🗑️ アクティブスプリントをクリアしました');

    // 未割り当てタスクが残っているか確認
    const remainingUnassignedTasks = globalTasks.filter(
      (task) =>
        !task.sprint &&
        task.status !== 'completed' &&
        task.status !== 'failed'
    );

    console.log(
      `📊 残りの未割り当てタスク: ${remainingUnassignedTasks.length}件`
    );

    if (remainingUnassignedTasks.length > 0) {
      console.log('🔄 次のスプリント計画が必要です');
      return {
        activeSprint: null,
        sprints: [...(state.sprints || []), completedSprint],
        logs: [
          {
            timestamp: new Date(),
            level: 'info',
            source: 'sprint_review',
            message: `スプリント完了: ${completedSprint.name}。次スプリント計画へ`,
            data: {
              sprintId: completedSprint.id,
              completedTasks: completedTasks.length,
              failedTasks: failedTasks.length,
              deployable: completedSprint.deployable,
              remainingTasks: remainingUnassignedTasks.length,
            },
          },
        ],
      };
    } else {
      console.log('🎉 すべてのタスクが完了しました！');
      return {
        activeSprint: null,
        sprints: [...(state.sprints || []), completedSprint],
        metadata: {
          ...state.metadata,
          phase: 'complete',
        },
        logs: [
          {
            timestamp: new Date(),
            level: 'info',
            source: 'sprint_review',
            message: `全タスク完了: プロジェクト終了`,
            data: {
              sprintId: completedSprint.id,
              completedTasks: completedTasks.length,
              deployable: completedSprint.deployable,
            },
          },
        ],
      };
    }
  } else {
    // 未完了タスクがある場合
    console.log('⚠️ スプリント内に未完了タスクがあります');
    console.log(`⏳ 未完了タスク: ${incompleteTasks.map((t) => t.title).join(', ')}`);

    // アクティブスプリントを継続
    return {
      activeSprint: updatedSprint,
      logs: [
        {
          timestamp: new Date(),
          level: 'warn',
          source: 'sprint_review',
          message: `スプリント ${updatedSprint.name} は未完了タスクあり`,
          data: {
            sprintId: updatedSprint.id,
            completedTasks: completedTasks.length,
            failedTasks: failedTasks.length,
            incompleteTasks: incompleteTasks.length,
          },
        },
      ],
    };
  }
}

/**
 * SprintReviewNodeのルーティング関数
 *
 * 未割り当てタスクがある場合: sprint_planning (次スプリント計画)
 * 全タスク完了の場合: END
 * 未完了タスクがある場合: engineer_dispatch (スプリント継続)
 */
export function sprintReviewRouter(state: ParallelDevStateType): string {
  // 全タスク完了チェック
  const allTasksCompleted = state.globalTasks.every(
    (task) => task.status === 'completed' || task.status === 'failed'
  );

  if (allTasksCompleted) {
    console.log('➡️ ルーティング: END (全タスク完了)');
    return 'END';
  }

  // アクティブスプリントがない場合、次スプリント計画
  if (!state.activeSprint || state.activeSprint.status === 'completed') {
    console.log('➡️ ルーティング: sprint_planning (次スプリント計画)');
    return 'sprint_planning';
  }

  // 未完了タスクがある場合、スプリント継続
  console.log('➡️ ルーティング: engineer_dispatch (スプリント継続)');
  return 'engineer_dispatch';
}
