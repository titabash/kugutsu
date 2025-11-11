/**
 * Sprint Planning Node
 *
 * タスクをスプリントに分割し、E2Eデプロイ可能な単位で計画を立てる
 *
 * スプリント範囲:
 * - 8-16時間の作業量
 * - E2Eでデプロイ可能な機能単位
 * - 依存関係を考慮した順序付け
 */

import type { ParallelDevStateType, ParallelDevStateUpdate } from '../state.js';
import type { GlobalTask, Sprint } from '../types.js';
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import type { AIProviderConfig } from '../../providers/IAIProvider.js';
import { AIFileWriter } from '../../utils/AIFileWriter.js';
import { DataPersistence } from '../../utils/DataPersistence.js';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { MessageHandler } from '../../utils/MessageHandler.js';

/**
 * Sprint Planning Node
 *
 * Responsibilities:
 * 1. Analyze unassigned tasks from global queue
 * 2. Use AI to generate sprint plan
 * 3. Group tasks into sprints (8-16 hours, E2E deployable)
 * 4. Present plan to user for adjustment
 * 5. Save sprint information
 */
export async function sprintPlanningNode(
  state: ParallelDevStateType
): Promise<ParallelDevStateUpdate> {
  const { globalTasks, projects, currentProjectId, config } = state;
  const maxTurns = config.maxTurns || 50;

  console.log('📅 SprintPlanning: スプリント計画を作成しています...');

  // Define file paths
  const activeSprintPath = path.join(
    config.baseRepoPath,
    '.kugutsu',
    'sprints',
    'active-sprint.json'
  );
  const globalQueuePath = path.join(
    config.baseRepoPath,
    '.kugutsu',
    'tasks',
    'global-queue.json'
  );

  // DataPersistenceインスタンスを作成（早期に定義）
  const persistence = new DataPersistence(config.baseRepoPath);

  // アクティブなスプリントを確認
  let existingActiveSprint: Sprint | null = null;
  try {
    const activeSprintContent = await fs.readFile(activeSprintPath, 'utf-8');
    existingActiveSprint = JSON.parse(activeSprintContent);
  } catch (error) {
    // ファイルが存在しない場合はnull
  }

  if (existingActiveSprint &&
      (existingActiveSprint.status === 'planning' ||
       existingActiveSprint.status === 'active')) {
    console.log(`⚠️ 既にアクティブなスプリントが存在します: ${existingActiveSprint.name} (${existingActiveSprint.status})`);

    // ✅ 自動修復: status='planning'でinstruction.md生成済みなら'active'に更新
    if (existingActiveSprint.status === 'planning') {
      const sprintTasksDir = path.join(
        config.baseRepoPath,
        '.kugutsu',
        'sprints',
        existingActiveSprint.id,
        'tasks'
      );

      // 全タスクのinstruction.md生成を確認
      let allInstructionsGenerated = true;
      for (const taskId of existingActiveSprint.taskIds) {
        const instructionPath = path.join(sprintTasksDir, taskId, 'instruction.md');
        try {
          await fs.access(instructionPath);
        } catch (error) {
          allInstructionsGenerated = false;
          break;
        }
      }

      // 全て生成済みなら'active'に更新して保存
      if (allInstructionsGenerated) {
        console.log(`🔧 自動修復: instruction.md生成済み → status='active'に更新`);
        existingActiveSprint.status = 'active';
        await persistence.saveActiveSprint(existingActiveSprint);
      }
    }

    return {
      activeSprint: existingActiveSprint,
      logs: [
        {
          timestamp: new Date(),
          level: 'info',
          source: 'sprint_planning',
          message: `既存のアクティブスプリント: ${existingActiveSprint.name} (${existingActiveSprint.status})`,
        },
      ],
    };
  }

  // 未割り当てタスクを取得（スプリントが未設定、かつ未完了）
  const unassignedTasks = globalTasks.filter(
    (task) =>
      !task.sprint &&
      task.status !== 'completed' &&
      task.status !== 'failed'
  );

  console.log(`📊 未割り当てタスク: ${unassignedTasks.length}件`);

  if (unassignedTasks.length === 0) {
    console.log('✅ すべてのタスクがスプリントに割り当て済みです');
    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'info',
          source: 'sprint_planning',
          message: 'すべてのタスクがスプリントに割り当て済み',
        },
      ],
    };
  }

  // AIプロバイダーを作成
  const providerConfig: AIProviderConfig = {
    provider: config.provider || 'claude',
    claude: {
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
    },
  };

  const provider = AIProviderFactory.create(providerConfig);

  // スプリント計画プロンプト
  const sprintPlanningPrompt = `
# Sprint Planning

タスクをスプリントに分割してください。

## 制約条件
- 各スプリントは8-16時間の作業量
- E2Eでテスト・デプロイ可能な機能単位でグルーピング
- 依存関係を考慮し、依存元のタスクを先に配置
- スプリントゴールを明確に定義

## ⚠️ 重要: 共通基盤の検出と先行タスク化

**各スプリント計画時に、そのスプリントで必要な共通基盤を検出し、先行タスクとして配置してください。**

### 検出すべき共通基盤

以下の要素は複数タスクで共有されるため、スプリント内で最初に実装する必要があります:

1. **データベース関連**:
   - DBクライアントのシングルトン（Supabase, Prisma, MongoDB等）
   - DBマイグレーション（テーブル作成、カラム追加）
   - データベーススキーマ設計

2. **外部サービスクライアント**:
   - 決済クライアント（Stripe, PayPal等）
   - メール送信クライアント（SendGrid, Resend等）
   - ストレージクライアント（S3, Cloudinary等）

3. **共通データモデル・型定義**:
   - 共通型定義・インターフェース（APIResponse, ErrorCode等）
   - 共通データモデル（User, Product, Order等のEntity/Model）
   - 共通Enum定義（UserRole, OrderStatus等）

4. **共通ユーティリティ・ヘルパー**:
   - 共通ユーティリティ関数（formatDate, validateEmail等）
   - 共通バリデーション関数
   - 共通エラーハンドリング

5. **認証・認可基盤**:
   - 認証システム（JWT, OAuth等）
   - 権限管理システム
   - セッション管理

### 検出方法

- **タスクの依存関係分析**: 複数タスクから参照される要素を検出
- **コードベース分析**: 既存の共通基盤を確認（Glob, Readツールで `/lib/*.ts`, `/types/*.ts`, `/utils/*.ts` 等）
- **新規共通基盤**: 未実装だが複数タスクで必要となる基盤を検出

### 配置ルール

1. **既存の共通基盤**: 依存関係に含めるが、新規タスク化は不要
2. **新規の共通基盤**: そのスプリント内で最初に実装するタスクとして配置（priority: 最高）
3. **個別機能タスク**: 共通基盤タスクの後に配置

### 例

❌ **悪い例（共通基盤を後回し）**:
```json
{
  "sprints": [
    {
      "name": "Sprint 5: 決済機能",
      "taskIds": ["task-101: 決済画面実装", "task-102: Stripeクライアント実装", "task-103: 決済型定義"]
    }
  ]
}
```

✅ **良い例（共通基盤を先行）**:
```json
{
  "sprints": [
    {
      "name": "Sprint 5: 決済機能",
      "taskIds": ["task-102: Stripeクライアント実装", "task-103: 決済型定義", "task-101: 決済画面実装"]
    }
  ]
}
```

## 未割り当てタスク
${JSON.stringify(
  unassignedTasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    dependencies: t.dependencies,
    dynamicPriority: t.dynamicPriority,
  })),
  null,
  2
)}

## 出力形式
JSON形式で以下の構造で出力してください：
\`\`\`json
{
  "sprints": [
    {
      "name": "Sprint 1: 機能名",
      "goal": "スプリントゴール",
      "taskIds": ["task-id-1", "task-id-2"],
      "estimatedHours": 12,
      "deployable": true
    }
  ]
}
\`\`\`

## 注意事項
- 最初のスプリントのみを計画してください（1スプリントのみ）
- 優先度が高いタスクを先に配置
- 依存関係を必ず考慮
- スプリントゴールは具体的に記述
`;

  const handler1 = new MessageHandler({
    maxTurns,
    nodeName: 'SprintPlanning - Sprint Plan Creation',
  });

  let sprintPlanResult = '';
  for await (const message of provider.execute(sprintPlanningPrompt, {
    maxTurns,
    cwd: config.baseRepoPath,
    allowedTools: ['Read', 'Glob'],
    permissionMode: 'acceptEdits',
    includePartialMessages: true,
  })) {
    await handler1.handleMessage(message);

    if (message.type === 'assistant' && message.content) {
      // Handle both string and object content
      if (typeof message.content === 'string') {
        sprintPlanResult += message.content;
      } else {
        sprintPlanResult += JSON.stringify(message.content);
      }
    }
  }

  // エラーチェック（Claude Agent SDK仕様準拠）
  if (handler1.getHasError()) {
    const details = handler1.getErrorDetails();

    // エラーメッセージの構築
    let errorMsg: string;
    if (details?.message) {
      errorMsg = details.subtype === 'error_max_turns'
        ? `AI実行がmaxTurns制限に到達しました: ${details.message}`
        : `AI実行中にエラーが発生しました: ${details.message}`;
    } else if (details?.errors && details.errors.length > 0) {
      errorMsg = `AI実行中にエラーが発生しました: ${details.errors.join('; ')}`;
    } else {
      errorMsg = `AI実行中にエラーが発生しました (subtype: ${details?.subtype || 'unknown'})`;
      console.warn(`⚠️  エラー詳細が取得できませんでした。ErrorDetails:`, JSON.stringify(details, null, 2));
    }

    throw new Error(errorMsg);
  }

  handler1.complete(true, 'スプリント計画作成が完了しました');

  console.log('✅ スプリント計画生成完了');

  // JSONを抽出してパース
  const jsonMatch = sprintPlanResult.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) {
    console.error('❌ スプリント計画のJSON抽出に失敗しました');
    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'error',
          source: 'sprint_planning',
          message: 'スプリント計画の生成に失敗',
        },
      ],
    };
  }

  const sprintPlan = JSON.parse(jsonMatch[1]);
  const firstSprint = sprintPlan.sprints[0];

  // スプリントオブジェクトを作成
  const sprintId = `sprint-${randomUUID()}`;
  const newSprint: Sprint = {
    id: sprintId,
    name: firstSprint.name,
    goal: firstSprint.goal,
    taskIds: firstSprint.taskIds,
    status: 'planning',
    deployable: firstSprint.deployable,
    metadata: {
      estimatedHours: firstSprint.estimatedHours,
      blockers: [],
      completedTasksCount: 0,
      failedTasksCount: 0,
    },
  };

  console.log(`📋 スプリント作成: ${newSprint.name}`);
  console.log(`🎯 ゴール: ${newSprint.goal}`);
  console.log(`⏱️  見積もり: ${newSprint.metadata.estimatedHours}時間`);
  console.log(`📦 タスク数: ${newSprint.taskIds.length}件`);

  // タスクにスプリントIDを割り当て
  const updatedGlobalTasks = globalTasks.map((task) => {
    if (newSprint.taskIds.includes(task.id)) {
      return {
        ...task,
        sprint: sprintId,
      };
    }
    return task;
  });

  // スプリント状態は 'planning' のまま（instruction.md未生成）
  // InstructionGenerator が完了後に 'active' に変更
  newSprint.startedAt = new Date();

  // active-sprint.jsonを保存（DataPersistence使用）
  await persistence.saveActiveSprint(newSprint);
  console.log('✅ アクティブスプリント保存完了');

  // global-queue.jsonを保存（DataPersistence使用）
  await persistence.saveGlobalQueue(updatedGlobalTasks);
  console.log('✅ グローバルキュー保存完了');

  // Sprint Backlogを保存（DataPersistence使用）
  const sprintBacklog = {
    sprintId: newSprint.id,
    sprintName: newSprint.name,
    tasks: updatedGlobalTasks.filter((task) => newSprint.taskIds.includes(task.id)),
  };
  await persistence.saveSprintBacklog(sprintId, sprintBacklog);
  console.log('✅ Sprint Backlog保存完了');

  return {
    activeSprint: newSprint,
    sprints: [newSprint],
    globalTasks: updatedGlobalTasks,
    logs: [
      {
        timestamp: new Date(),
        level: 'info',
        source: 'sprint_planning',
        message: `スプリント開始: ${newSprint.name}`,
        data: {
          sprintId,
          goal: newSprint.goal,
          taskCount: newSprint.taskIds.length,
          estimatedHours: newSprint.metadata.estimatedHours,
        },
      },
    ],
  };
}

/**
 * SprintPlanningNodeのルーティング関数
 *
 * 'planning' 状態: instruction_generator_dispatch（instruction.md未生成）
 * 'active' 状態: sprint_review（instruction.md生成済み、継続）
 * その他: END
 */
export function sprintPlanningRouter(state: ParallelDevStateType): string {
  if (!state.activeSprint) {
    console.log('➡️ ルーティング: END (スプリント計画なし)');
    return 'END';
  }

  // 'planning' 状態（instruction.md未生成） → instruction_generator_dispatch へ
  if (state.activeSprint.status === 'planning') {
    console.log('➡️ ルーティング: instruction_generator_dispatch (instruction.md生成)');
    return 'instruction_generator_dispatch';
  }

  // 'active' 状態（instruction.md生成済み） → sprint_review へ
  // 無限ループ防止: 既存スプリントがactiveの場合、instruction_generatorに戻さない
  if (state.activeSprint.status === 'active') {
    console.log('➡️ ルーティング: sprint_review (既存スプリント継続)');
    return 'sprint_review';
  }

  console.log('➡️ ルーティング: END (スプリント完了または不明な状態)');
  return 'END';
}
