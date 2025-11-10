/**
 * Product Owner Node
 *
 * Analyzes user requirements and generates tasks for parallel execution
 * Uses AI-driven analysis instead of hardcoded logic
 *
 * **File-based Artifact Management:**
 * - Creates artifacts in `.kugutsu/` directory
 * - AI directly writes files using Write tool
 * - Returns file paths in state instead of data
 */

import * as path from 'path';
import type { ParallelDevStateType, ParallelDevStateUpdate, FeedbackRequest } from '../state.js';
import type { Task } from '../types.js';
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import type { AIProviderConfig } from '../../providers/IAIProvider.js';
import { FileReader } from '../../utils/FileReader.js';
import type { TaskArtifact } from '../../types/artifacts.js';
import { RetryManager } from '../../utils/RetryManager.js';
import { ErrorClassifier } from '../../utils/ErrorClassifier.js';
import { MessageHandler } from '../../utils/MessageHandler.js';

/**
 * Product Owner Node
 *
 * Responsibilities:
 * 1. Analyze user request
 * 2. Detect technology stack
 * 3. Generate independent, parallelizable tasks
 * 4. Identify task dependencies
 */
export async function productOwnerNode(
  state: ParallelDevStateType
): Promise<ParallelDevStateUpdate> {
  const { userRequest, config } = state;

  console.log('📊 Product Owner: ユーザー要求を分析しています...');

  // currentProjectId 必須チェック
  if (!state.currentProjectId) {
    console.error('❌ currentProjectId が設定されていません');
    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'error',
          source: 'ProductOwnerNode',
          message: 'currentProjectId が設定されていません（check_modeで設定されるべき）',
        },
      ],
    };
  }

  // Create AI provider
  const providerConfig: AIProviderConfig = {
    provider: config.provider || 'claude',
    claude: {
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
    },
  };

  const provider = AIProviderFactory.create(providerConfig);

  // フィードバック受信チェック
  const feedback = state.feedbackRequest;
  let feedbackContext = '';

  if (feedback && feedback.targetNode === 'product_owner') {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📢 [FEEDBACK LOOP] ProductOwnerノードがフィードバックを受信しました`);
    console.log(`${'='.repeat(80)}`);
    console.log(`リクエスト元: ${feedback.requestingNode}`);
    console.log(`リトライ回数: ${feedback.retryCount}/3`);
    console.log(`タイムスタンプ: ${feedback.timestamp.toISOString()}`);
    console.log(`理由: ${feedback.reason}`);
    console.log(`詳細: ${JSON.stringify(feedback.details, null, 2)}`);
    console.log(`フィードバック履歴: ${state.feedbackHistory.length}件`);
    console.log(`全ノードリトライ状況: ${JSON.stringify(state.nodeRetryCounters)}`);
    console.log(`${'='.repeat(80)}\n`);

    // リトライ上限チェック（3回まで）
    if (feedback.retryCount > 3) {
      console.error(`⚠️ ProductOwnerノードへのフィードバックが上限（3回）に達しました`);

      return {
        feedbackRequest: null, // フィードバッククリア
        logs: [
          {
            timestamp: new Date(),
            level: 'error',
            source: 'ProductOwnerNode',
            message: `リトライ上限超過: ${feedback.reason}`,
          },
        ],
        metadata: {
          hasErrors: true,
          errors: [
            ...(state.metadata.errors || []),
            `ProductOwner retry limit exceeded: ${feedback.reason}`,
          ],
        },
      };
    }

    // フィードバック内容をプロンプトに追加するためのコンテキスト
    feedbackContext = `
# 📢 フィードバック対応（リトライ ${feedback.retryCount}回目）

前回の実行で以下の不備が検出されました：

**エラー**: ${feedback.reason}

**詳細**:
${JSON.stringify(feedback.details, null, 2)}

**不足ファイル**: ${feedback.details.missingFiles?.join(', ') || 'なし'}
**不足フィールド**: ${feedback.details.missingFields?.join(', ') || 'なし'}

**重要**: この不備を修正してください。必要なファイルをすべて作成し、必須フィールドを埋めてください。

---

`;
  }

  const kugutsuDir = path.join(config.baseRepoPath, '.kugutsu');
  const fileReader = new FileReader(config.baseRepoPath);

  try {
    // Phase 1: Verify Technology Stack (読み込みのみ、生成はCheckModeNodeが担当)
    // Use repository/architecture/tech-stack.json (managed by CheckModeNode)
    const techStackFilePath = '.kugutsu/repository/architecture/tech-stack.json';

    // 技術スタックファイルの存在確認
    let techStackExists = false;
    try {
      await fileReader.readJSON(techStackFilePath);
      techStackExists = true;
      console.log('✅ 技術スタック情報を読み込みました');
    } catch (error) {
      console.log('⚠️ 技術スタック情報が見つかりません（CheckModeNodeで初期化されます）');
    }

    const maxTurns = config.maxTurns || 30;

    // Phase 2: Requirements Analysis
    // Use relative path from baseRepoPath for AI prompts
    const requirementsFilePath = '.kugutsu/requirements.json';
    const requirementsAnalysisPrompt = `${feedbackContext}
# Requirements Analysis

以下の開発要求を分析して、ファイルに保存してください。

## ユーザー要求
${userRequest}

## 技術スタック
**Readツールで${techStackFilePath}を読み込んで参照してください**

## タスク
MECE原則（漏れなく、重複なく）に基づいて要求を分析し、以下を実行してください：

1. **機能要件**: 実装すべき機能のリスト
2. **非機能要件**: パフォーマンス、セキュリティ等の要件
3. **制約条件**: 技術的制約や依存関係
4. **ファイルの作成・更新（Upsert方式）**

## ファイル作成・更新方針（Upsert）
1. **Readツールで${requirementsFilePath}の存在を確認**
2. **存在する場合**: 既存内容を読み込み、その内容を基に更新してWriteツールで保存
3. **存在しない場合**: 新規作成してWriteツールで保存

## 出力ファイル
**ファイルパス**: ${requirementsFilePath}

**ファイル形式**: JSON

**構造**:
\`\`\`json
{
  "functional": ["機能1", "機能2"],
  "nonFunctional": ["要件1"],
  "constraints": ["制約1"]
}
\`\`\`

**重要**: 必ず Write ツールを使用してファイルを作成してください。既存ファイルがあれば既存の内容を尊重して更新してください。
`;

    // Phase 2: Requirements analysis with retry
    const requirementsResult = await RetryManager.executeWithRetry(
      async () => {
        const handler = new MessageHandler({
          maxTurns,
          nodeName: 'ProductOwner - Requirements Analysis',
        });

        for await (const message of provider.execute(requirementsAnalysisPrompt, {
          maxTurns,
          cwd: config.baseRepoPath,
          allowedTools: ['Read', 'Glob', 'Grep', 'Write'],
          permissionMode: 'acceptEdits',
          includePartialMessages: true,
        })) {
          await handler.handleMessage(message);
        }

        // エラーチェック（Claude Agent SDK仕様準拠）
        if (handler.getHasError()) {
          const details = handler.getErrorDetails();
          const errorMsg = details?.subtype === 'error_max_turns'
            ? `AI実行がmaxTurns制限に到達しました: ${details?.message || '詳細不明'}`
            : `AI実行中にエラーが発生しました: ${details?.message || '詳細不明'}`;
          throw new Error(errorMsg);
        }

        handler.complete(true, '要求分析が完了しました');
        return true;
      },
      {
        maxRetries: 3,
        initialDelayMs: 2000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
        retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'rate_limit', 'Rate limit', 'timeout', 'network'],
      }
    );

    if (!requirementsResult.success) {
      const classifiedError = ErrorClassifier.classify(requirementsResult.error!);
      console.error(`❌ 要求分析に失敗 (${requirementsResult.attempts}回試行): ${requirementsResult.error?.message}`);

      return {
        logs: [
          {
            timestamp: new Date(),
            level: 'error',
            source: 'ProductOwnerNode',
            message: `要求分析に失敗: ${classifiedError.message}`,
            data: {
              error: requirementsResult.error?.message,
              severity: classifiedError.severity,
              attempts: requirementsResult.attempts,
            },
          },
        ],
        metadata: {
          hasErrors: true,
          errors: [requirementsResult.error?.message || 'Unknown error'],
        },
      };
    }

    console.log('✅ 要求分析完了');

    // Phase 3: Task Generation
    // Use relative path from baseRepoPath for AI prompts
    const tasksFilePath = '.kugutsu/tasks.json';
    const taskGenerationPrompt = `${feedbackContext}
# Task Generation

**🎯 必須タスク**: Writeツールで \`${tasksFilePath}\` を作成してください。

**重要**: これは既存プロジェクトへの機能追加です。新しいプロジェクトを作成する必要はありません。

## プロジェクト情報
**Readツールで${techStackFilePath}を読み込んで参照してください**

## ユーザーリクエスト
${userRequest}

## 要求分析結果
**Readツールで${requirementsFilePath}を読み込んで参照してください**

## タスク生成の原則

1. **既存プロジェクト**: プロジェクトセットアップは不要。既存のコードベースに機能を追加する
2. **独立性**: 各タスクは他のタスクと独立して実行可能
3. **明確性**: タスクの目的と成果物が明確
4. **テスト駆動**: 各タスクはテストを含む
5. **適切な粒度**: 大きすぎず、小さすぎないサイズ

## 手順

1. タスクを並列実行可能に分割
2. **Writeツールでタスクリストをファイルに保存（必須）**

## ファイル作成方針（Upsert）

- **Readツールで${tasksFilePath}の存在を確認**
- **存在する場合**: 既存タスクを読み込み、新しいタスクを追加（重複はid で判定して更新）してWriteツールで保存
- **存在しない場合**: 新規作成してWriteツールで保存

## 出力ファイル仕様

**ファイルパス**: \`${tasksFilePath}\`

**ファイル形式**: JSON配列

**構造**:
\`\`\`json
[
  {
    "id": "task-001",
    "title": "タスクタイトル",
    "description": "概要",
    "priority": 10,
    "dependencies": [],
    "status": "pending",
    "createdAt": "2025-01-07T10:00:00Z",
    "updatedAt": "2025-01-07T10:00:00Z"
  }
]
\`\`\`

**⚠️ 重要**: このタスクを完了するには、Writeツールでファイルを作成することが必須です。
`;

    // Phase 3: Task generation with retry
    const taskGenerationResult = await RetryManager.executeWithRetry(
      async () => {
        const handler = new MessageHandler({
          maxTurns,
          nodeName: 'ProductOwner - Task Generation',
        });

        for await (const message of provider.execute(taskGenerationPrompt, {
          maxTurns,
          cwd: config.baseRepoPath,
          allowedTools: ['Read', 'Glob', 'Grep', 'Write'],
          permissionMode: 'acceptEdits',
          includePartialMessages: true,
        })) {
          await handler.handleMessage(message);
        }

        // エラーチェック（Claude Agent SDK仕様準拠）
        if (handler.getHasError()) {
          const details = handler.getErrorDetails();
          const errorMsg = details?.subtype === 'error_max_turns'
            ? `AI実行がmaxTurns制限に到達しました: ${details?.message || '詳細不明'}`
            : `AI実行中にエラーが発生しました: ${details?.message || '詳細不明'}`;
          throw new Error(errorMsg);
        }

        handler.complete(true, 'タスク生成が完了しました');
        return true;
      },
      {
        maxRetries: 3,
        initialDelayMs: 2000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
        retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'rate_limit', 'Rate limit', 'timeout', 'network'],
      }
    );

    if (!taskGenerationResult.success) {
      const classifiedError = ErrorClassifier.classify(taskGenerationResult.error!);
      console.error(`❌ タスク生成に失敗 (${taskGenerationResult.attempts}回試行): ${taskGenerationResult.error?.message}`);

      return {
        logs: [
          {
            timestamp: new Date(),
            level: 'error',
            source: 'ProductOwnerNode',
            message: `タスク生成に失敗: ${classifiedError.message}`,
            data: {
              error: taskGenerationResult.error?.message,
              severity: classifiedError.severity,
              attempts: taskGenerationResult.attempts,
            },
          },
        ],
        metadata: {
          hasErrors: true,
          errors: [taskGenerationResult.error?.message || 'Unknown error'],
        },
      };
    }

    console.log('✅ タスク生成完了');

    // Wait for file to be created (AI operations may be async)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Read tasks from file created by AI
    let tasks: Task[] = [];
    try {
      console.log(`🔍 Reading tasks from ${tasksFilePath}...`);
      const tasksData = await fileReader.readJSON<TaskArtifact[]>('.kugutsu/tasks.json');
      console.log(`🔍 Found ${tasksData.length} tasks in file`);
      tasks = tasksData.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        dependencies: task.dependencies,
        status: task.status as 'pending',
        createdAt: new Date(task.createdAt),
        updatedAt: new Date(task.updatedAt),
      }));
    } catch (error) {
      console.error(`❌ ${tasksFilePath} の読み込みに失敗:`, error);
      console.error('⚠️ AIがファイルを作成しなかった可能性があります');
      // Fallback: Create a single task
      tasks = [
        {
          id: 'task-001',
          title: userRequest.substring(0, 100),
          description: userRequest,
          priority: 100,
          dependencies: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
    }

    console.log('✅ タスクリスト読み込み完了');

    // Convert tasks to GlobalTask format (for SprintPlanningNode)
    const globalTasks = tasks.map((task) => {
      return {
        id: task.id,
        type: 'feature' as const, // ProductOwner generates feature tasks
        title: task.title,
        description: task.description,
        priority: task.priority,
        dependencies: task.dependencies,
        status: task.status,
        projectId: state.currentProjectId, // 必須チェック済み
        requestTimestamp: new Date(),
        dynamicPriority: task.priority * 10, // Convert priority to dynamic priority
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      };
    });

    // Return state update with file paths
    const result = {
      tasks,
      globalTasks, // Add globalTasks for SprintPlanningNode
      techStackPath: '.kugutsu/repository/architecture/tech-stack.json',
      requirementsPath: '.kugutsu/requirements.json',
      tasksPath: '.kugutsu/tasks.json',
      feedbackRequest: null, // フィードバッククリア（成功）
      logs: [
        {
          timestamp: new Date(),
          level: 'info',
          source: 'ProductOwnerNode',
          message: `${tasks.length}個のタスクを生成しました`,
          data: {
            taskCount: tasks.length,
            taskIds: tasks.map((t) => t.id),
          },
        },
      ],
      metadata: {
        phase: 'development',
        totalTasks: tasks.length,
      },
    };
    console.log(`🔍 ProductOwner returning tasksPath: ${result.tasksPath}`);
    console.log(`🔍 ProductOwner returning ${result.tasks.length} tasks`);
    console.log(`🔍 ProductOwner returning ${result.globalTasks.length} globalTasks`);
    return result as any;
  } catch (error) {
    console.error('❌ Product Owner Node エラー:', error);

    // Return error state
    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'error',
          source: 'ProductOwnerNode',
          message: `タスク生成に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
          data: { error },
        },
      ],
      metadata: {
        hasErrors: true,
        errors: [error instanceof Error ? error.message : String(error)],
      },
    };
  }
}

