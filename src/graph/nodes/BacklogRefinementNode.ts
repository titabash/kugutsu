/**
 * Backlog Refinement Node
 *
 * 既存タスクを分析し、バックログを改善する
 *
 * 機能:
 * - 優先度の再評価（ビジネス価値、技術リスクに基づく）
 * - 見積もりの更新（過去の実績データに基づく）
 * - 依存関係の再分析（新規依存関係の検出、不要な依存関係の削除）
 * - タスクの分割・統合提案（適切な粒度への調整）
 *
 * AI-First原則:
 * - すべての分析と判断はAIが実行
 * - Claude Agent SDKを使用したAI駆動の意思決定
 * - ハードコードされたロジックなし
 */

import type { ParallelDevStateType, ParallelDevStateUpdate } from '../state.js';
import type { GlobalTask } from '../types.js';
import type { TaskSplitSuggestion, TaskMergeSuggestion } from '../../types/index.js';
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import type { AIProviderConfig } from '../../providers/IAIProvider.js';
import { DataPersistence } from '../../utils/DataPersistence.js';
import { MessageHandler } from '../../utils/MessageHandler.js';
import { JSONExtractor } from '../../utils/JSONExtractor.js';
import { FileSystemManager } from '../../utils/FileSystemManager.js';
import path from 'path';

/**
 * Backlog Refinement Node
 *
 * Responsibilities:
 * 1. Analyze existing tasks in Product Backlog
 * 2. Re-evaluate priorities based on business value and technical risk
 * 3. Update estimates based on historical sprint data
 * 4. Re-analyze dependencies (detect new ones, remove obsolete)
 * 5. Suggest task splits for large tasks
 * 6. Suggest task merges for similar small tasks
 * 7. Save refined backlog
 */
export async function backlogRefinementNode(
  state: ParallelDevStateType
): Promise<ParallelDevStateUpdate> {
  const { globalTasks, config } = state;
  const maxTurns = config.maxTurns || 50;

  console.log('🔄 BacklogRefinement: バックログのリファインメントを開始します...');

  // 既存タスクのチェック
  const pendingTasks = globalTasks.filter(
    (task) => task.status === 'pending' && !task.sprint
  );

  if (pendingTasks.length === 0) {
    console.log('⚠️ リファインメント対象のタスクがありません');
    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'info',
          source: 'backlog_refinement',
          message: 'リファインメント対象のタスクがありません',
        },
      ],
    };
  }

  console.log(`📊 リファインメント対象タスク: ${pendingTasks.length}件`);

  // DataPersistenceを初期化
  const persistence = new DataPersistence(config.baseRepoPath);
  await persistence.initialize();

  // 過去のスプリント履歴を読み込み（見積もり精度向上のため）
  let sprintHistory: any[] = [];
  try {
    sprintHistory = await persistence.loadSprintHistory();
    console.log(`📚 スプリント履歴: ${sprintHistory.length}件読み込み`);
  } catch (error) {
    console.log('⚠️ スプリント履歴が見つかりません（初回実行）');
  }

  // AIプロバイダーを作成
  const providerConfig: AIProviderConfig = {
    provider: config.provider || 'claude',
    claude: {
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
    },
  };

  const provider = AIProviderFactory.create(providerConfig);

  // バックログリファインメントプロンプトを構築
  const refinementPrompt = buildRefinementPrompt(pendingTasks, sprintHistory);

  const handler = new MessageHandler({
    maxTurns,
    nodeName: 'BacklogRefinement - Analysis',
  });

  let aiResponseText = '';
  for await (const message of provider.execute(refinementPrompt, {
    maxTurns,
    cwd: config.baseRepoPath,
    allowedTools: ['Read', 'Glob', 'Grep'],
    permissionMode: 'acceptEdits',
    includePartialMessages: true,
  })) {
    await handler.handleMessage(message);

    if (message.type === 'assistant' && message.content) {
      if (typeof message.content === 'string') {
        aiResponseText += message.content;
      } else {
        aiResponseText += JSON.stringify(message.content);
      }
    }
  }

  // エラーチェック（Claude Agent SDK仕様準拠）
  if (handler.getHasError()) {
    const details = handler.getErrorDetails();

    let errorMsg: string;
    if (details?.message) {
      errorMsg =
        details.subtype === 'error_max_turns'
          ? `AI実行がmaxTurns制限に到達しました: ${details.message}`
          : `AI実行中にエラーが発生しました: ${details.message}`;
    } else if (details?.errors && details.errors.length > 0) {
      errorMsg = `AI実行中にエラーが発生しました: ${details.errors.join('; ')}`;
    } else {
      errorMsg = `AI実行中にエラーが発生しました (subtype: ${details?.subtype || 'unknown'})`;
      console.warn(
        `⚠️  エラー詳細が取得できませんでした。ErrorDetails:`,
        JSON.stringify(details, null, 2)
      );
    }

    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'error',
          source: 'backlog_refinement',
          message: errorMsg,
        },
      ],
    };
  }

  handler.complete(true, 'バックログリファインメントが完了しました');

  // JSON抽出（JSONExtractorを使用）
  const extractionResult = JSONExtractor.extractFromCodeBlock(aiResponseText);

  if (!extractionResult.success) {
    console.error('❌ JSON抽出に失敗しました:', extractionResult.error);
    if (extractionResult.rawJSON) {
      console.error('📄 抽出されたJSON（切り詰め）:', extractionResult.rawJSON);
    }
    if (extractionResult.parseError) {
      console.error('🔍 パースエラー詳細:', extractionResult.parseError);
    }

    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'error',
          source: 'backlog_refinement',
          message: `JSON抽出失敗: ${extractionResult.error}`,
          data: {
            rawJSON: extractionResult.rawJSON,
            parseError: extractionResult.parseError?.message,
          },
        },
      ],
    };
  }

  const refinementData = extractionResult.data;

  // 更新されたタスクを適用
  const updatedGlobalTasks = applyRefinementUpdates(
    globalTasks,
    refinementData
  );

  // タスク分割提案を抽出
  const taskSplitSuggestions: TaskSplitSuggestion[] =
    refinementData.taskSplits || [];

  // タスク統合提案を抽出
  const taskMergeSuggestions: TaskMergeSuggestion[] =
    refinementData.taskMerges || [];

  // 更新されたタスクを保存
  const globalQueuePath = path.join(
    config.baseRepoPath,
    '.kugutsu',
    'tasks',
    'global-queue.json'
  );
  await FileSystemManager.writeJSON(globalQueuePath, updatedGlobalTasks);

  console.log('✅ バックログリファインメント完了');
  console.log(`  - 更新されたタスク: ${refinementData.updatedTasks?.length || 0}件`);
  console.log(`  - タスク分割提案: ${taskSplitSuggestions.length}件`);
  console.log(`  - タスク統合提案: ${taskMergeSuggestions.length}件`);

  // ログメッセージを構築
  const logs: Array<{
    timestamp: Date;
    level: 'info' | 'success' | 'error' | 'warn';
    source: string;
    message: string;
  }> = [
    {
      timestamp: new Date(),
      level: 'success',
      source: 'backlog_refinement',
      message: `バックログリファインメント完了（${refinementData.updatedTasks?.length || 0}タスク更新）`,
    },
  ];

  // 優先度変更のログを追加
  if (refinementData.updatedTasks) {
    refinementData.updatedTasks.forEach((updatedTask: any) => {
      const originalTask = pendingTasks.find((t) => t.id === updatedTask.id);
      if (originalTask && originalTask.priority !== updatedTask.priority) {
        logs.push({
          timestamp: new Date(),
          level: 'info',
          source: 'backlog_refinement',
          message: `優先度変更: ${updatedTask.id} (${originalTask.priority} → ${updatedTask.priority}) - ${updatedTask.reason || '理由なし'}`,
        });
      }
    });
  }

  return {
    globalTasks: updatedGlobalTasks,
    taskSplitSuggestions,
    taskMergeSuggestions,
    logs,
  };
}

/**
 * バックログリファインメントプロンプトを構築
 */
function buildRefinementPrompt(
  tasks: GlobalTask[],
  sprintHistory: any[]
): string {
  const tasksJson = JSON.stringify(
    tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      dependencies: t.dependencies,
      estimatedHours: t.estimatedHours,
      businessValue: t.businessValue,
      technicalRisk: t.technicalRisk,
    })),
    null,
    2
  );

  const historyJson = JSON.stringify(sprintHistory, null, 2);

  return `
# Product Backlog Refinement

既存のProduct Backlogを分析し、以下の観点で改善してください。

## 現在のProduct Backlog

\`\`\`json
${tasksJson}
\`\`\`

## 過去のスプリント履歴

\`\`\`json
${historyJson}
\`\`\`

## リファインメントの観点

### 1. 優先度の再評価
- ビジネス価値の再評価（high/medium/low）
- 技術的リスクの評価（high/medium/low）
- 市場変化や新しい情報に基づく優先度調整
- 優先度変更の理由を明確に記載

### 2. 見積もりの更新
- 過去のスプリント実績に基づく見積もり精度向上
- 類似タスクの実績データを参照
- 見積もり変更の理由を明確に記載
- 信頼度（confidence: high/medium/low）を付与

### 3. 依存関係の再分析
- 新しい技術的依存関係の検出
- 完了したタスクとの依存関係削除
- 不要な依存関係の削除
- 依存関係変更の理由を明確に記載

### 4. タスクの分割提案
- 16時間を超える大きなタスクは分割を推奨
- 各サブタスクが独立した価値を提供できるように分割
- 依存関係を適切に設定
- フルスタックタスク（マイクロ一気通関）を維持

### 5. タスクの統合提案
- 3時間未満の小さなタスクで、関連性が高いものは統合を推奨
- 統合後も適切な粒度を維持
- 統合の理由を明確に記載

## 出力形式

JSON形式で以下の構造で出力してください：

\`\`\`json
{
  "updatedTasks": [
    {
      "id": "task-1",
      "priority": 95,
      "reason": "セキュリティ脆弱性が発見されたため優先度を上げた",
      "businessValue": "high",
      "technicalRisk": "medium",
      "estimatedHours": 8,
      "dependencies": ["task-2"],
      "confidence": "high"
    }
  ],
  "taskSplits": [
    {
      "originalTaskId": "task-large",
      "reason": "タスクが20時間と大きすぎるため、2つのサブタスクに分割",
      "suggestedTasks": [
        {
          "id": "task-large-1",
          "title": "サブタスク1のタイトル",
          "description": "詳細説明",
          "estimatedHours": 10,
          "priority": 90,
          "dependencies": []
        },
        {
          "id": "task-large-2",
          "title": "サブタスク2のタイトル",
          "description": "詳細説明",
          "estimatedHours": 10,
          "priority": 85,
          "dependencies": ["task-large-1"]
        }
      ]
    }
  ],
  "taskMerges": [
    {
      "taskIds": ["task-small-1", "task-small-2"],
      "reason": "2つのタスクは密接に関連しており、統合する方が効率的",
      "mergedTask": {
        "id": "task-merged",
        "title": "統合タスクのタイトル",
        "description": "詳細説明",
        "estimatedHours": 5,
        "priority": 80,
        "dependencies": []
      }
    }
  ]
}
\`\`\`

## 重要事項

- すべての変更に明確な理由（reason）を付与すること
- 優先度は0-100の整数（数値が大きいほど優先度が高い）
- estimatedHoursは時間単位の数値
- businessValueとtechnicalRiskは "high", "medium", "low" のいずれか
- 変更がない項目はupdatedTasksに含めなくて良い
- 分割・統合提案がない場合は空配列を返す

## AI-First原則

- プロジェクトのコードベースを分析して、技術的な依存関係を検出してください
- 過去のスプリント実績を分析して、見積もり精度を向上させてください
- ビジネス価値と技術的リスクのバランスを考慮してください
`.trim();
}

/**
 * タスク更新データの型定義
 */
interface TaskUpdate {
  id: string;
  priority?: number;
  estimatedHours?: number;
  dependencies?: string[];
  businessValue?: 'high' | 'medium' | 'low';
  technicalRisk?: 'high' | 'medium' | 'low';
  reason?: string;
  confidence?: string;
}

/**
 * リファインメントデータの型定義
 */
interface RefinementData {
  updatedTasks?: TaskUpdate[];
  taskSplits?: TaskSplitSuggestion[];
  taskMerges?: TaskMergeSuggestion[];
}

/**
 * リファインメント更新をglobalTasksに適用
 */
function applyRefinementUpdates(
  globalTasks: GlobalTask[],
  refinementData: RefinementData
): GlobalTask[] {
  const updatedTasksMap = new Map(
    (refinementData.updatedTasks || []).map((t) => [t.id, t])
  );

  return globalTasks.map((task) => {
    const update = updatedTasksMap.get(task.id);
    if (!update) {
      return task;
    }

    // 更新を適用
    return {
      ...task,
      priority: update.priority !== undefined ? update.priority : task.priority,
      estimatedHours:
        update.estimatedHours !== undefined
          ? update.estimatedHours
          : task.estimatedHours,
      dependencies:
        update.dependencies !== undefined
          ? update.dependencies
          : task.dependencies,
      businessValue:
        update.businessValue !== undefined
          ? update.businessValue
          : task.businessValue,
      technicalRisk:
        update.technicalRisk !== undefined
          ? update.technicalRisk
          : task.technicalRisk,
      updatedAt: new Date(),
    };
  });
}
