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
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import { DataPersistence } from '../../utils/DataPersistence.js';
import { randomUUID } from 'crypto';
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
export async function sprintPlanningNode(state) {
    const { globalTasks, projects, currentProjectId, config } = state;
    console.log('📅 SprintPlanning: スプリント計画を作成しています...');
    // データ永続化マネージャーを初期化
    const persistence = new DataPersistence(config.baseRepoPath);
    await persistence.initialize();
    // アクティブなスプリントを確認
    const existingActiveSprint = await persistence.loadActiveSprint();
    if (existingActiveSprint && existingActiveSprint.status === 'active') {
        console.log(`⚠️ 既にアクティブなスプリントが存在します: ${existingActiveSprint.name}`);
        return {
            activeSprint: existingActiveSprint,
            logs: [
                {
                    timestamp: new Date(),
                    level: 'info',
                    source: 'sprint_planning',
                    message: `既存のアクティブスプリント: ${existingActiveSprint.name}`,
                },
            ],
        };
    }
    // 未割り当てタスクを取得（スプリントが未設定、かつ未完了）
    const unassignedTasks = globalTasks.filter((task) => !task.sprint &&
        task.status !== 'completed' &&
        task.status !== 'failed');
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
    const providerConfig = {
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

## 未割り当てタスク
${JSON.stringify(unassignedTasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        dependencies: t.dependencies,
        dynamicPriority: t.dynamicPriority,
    })), null, 2)}

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
    let sprintPlanResult = '';
    for await (const message of provider.execute(sprintPlanningPrompt, {
        maxTurns: 10,
        cwd: config.baseRepoPath,
        allowedTools: ['Read', 'Glob'],
        permissionMode: 'acceptEdits',
    })) {
        if (message.type === 'assistant' && message.content) {
            // Handle both string and object content
            if (typeof message.content === 'string') {
                sprintPlanResult += message.content;
            }
            else {
                sprintPlanResult += JSON.stringify(message.content);
            }
        }
    }
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
    const newSprint = {
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
    // スプリントを開始状態に変更
    newSprint.status = 'active';
    newSprint.startedAt = new Date();
    // スプリント情報を保存
    await persistence.saveActiveSprint(newSprint);
    await persistence.saveGlobalQueue(updatedGlobalTasks);
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
 * アクティブなスプリントがある場合: engineer_dispatch
 * スプリントがない場合: END
 */
export function sprintPlanningRouter(state) {
    if (state.activeSprint && state.activeSprint.status === 'active') {
        console.log('➡️ ルーティング: engineer_dispatch (スプリント実行)');
        return 'engineer_dispatch';
    }
    else {
        console.log('➡️ ルーティング: END (スプリント計画なし)');
        return 'END';
    }
}
//# sourceMappingURL=SprintPlanningNode.js.map