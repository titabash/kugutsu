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

  // Create AI provider
  const providerConfig: AIProviderConfig = {
    provider: config.provider || 'claude',
    claude: {
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
    },
  };

  const provider = AIProviderFactory.create(providerConfig);

  console.log('📊 Product Owner: ユーザー要求を分析しています...');

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
    // Phase 1: Technology Stack Analysis
    // Use relative path from baseRepoPath for AI prompts
    const techStackFilePath = '.kugutsu/tech-stack.json';
    const techStackAnalysisPrompt = `${feedbackContext}
# Technology Stack Analysis

プロジェクトの技術スタックを分析して、ファイルに保存してください。

## 対象リポジトリ
${config.baseRepoPath}

## タスク
以下を実行してください：
1. リポジトリ内の設定ファイルを確認（package.json, tsconfig.json, go.mod, requirements.txt等）
2. 使用されているプログラミング言語を特定
3. フレームワークとライブラリを特定
4. ビルドツールとテストフレームワークを特定
5. **ファイルの作成・更新（Upsert方式）**

## ファイル作成・更新方針（Upsert）
1. **Readツールで${techStackFilePath}の存在を確認**
2. **存在する場合**: 既存内容を読み込み、その内容を基に更新してWriteツールで保存
3. **存在しない場合**: 新規作成してWriteツールで保存

## 出力ファイル
**ファイルパス**: ${techStackFilePath}

**ファイル形式**: JSON

**構造**:
\`\`\`json
{
  "languages": ["言語1", "言語2"],
  "frameworks": ["フレームワーク1"],
  "buildTools": ["ツール1"],
  "testingFrameworks": ["テストフレームワーク1"],
  "projectType": "プロジェクトタイプ"
}
\`\`\`

**重要**: 必ず Write ツールを使用してファイルを作成してください。既存ファイルがあれば既存の内容を尊重して更新してください。
`;

    // Phase 1: Tech stack analysis with retry
    const techStackResult = await RetryManager.executeWithRetry(
      async () => {
        for await (const message of provider.execute(techStackAnalysisPrompt, {
          maxTurns: 5,
          cwd: config.baseRepoPath,
          allowedTools: ['Read', 'Glob', 'Grep', 'Write'],
          permissionMode: 'acceptEdits',
        })) {
          // AI が Write ツールでファイルを作成するのを待つ
        }
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

    if (!techStackResult.success) {
      const classifiedError = ErrorClassifier.classify(techStackResult.error!);
      console.error(`❌ 技術スタック分析に失敗 (${techStackResult.attempts}回試行): ${techStackResult.error?.message}`);

      return {
        logs: [
          {
            timestamp: new Date(),
            level: 'error',
            source: 'ProductOwnerNode',
            message: `技術スタック分析に失敗: ${classifiedError.message}`,
            data: {
              error: techStackResult.error?.message,
              severity: classifiedError.severity,
              attempts: techStackResult.attempts,
            },
          },
        ],
        metadata: {
          hasErrors: true,
          errors: [techStackResult.error?.message || 'Unknown error'],
        },
      };
    }

    console.log('✅ 技術スタック分析完了');

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
        for await (const message of provider.execute(requirementsAnalysisPrompt, {
          maxTurns: 5,
          cwd: config.baseRepoPath,
          allowedTools: ['Read', 'Glob', 'Grep', 'Write'],
          permissionMode: 'acceptEdits',
        })) {
          // AI が Write ツールでファイルを作成するのを待つ
        }
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

## タスク
以下を実行してください：
1. タスクを並列実行可能に分割
2. **ファイルの作成・更新（Upsert方式）**

## ファイル作成・更新方針（Upsert）
1. **Readツールで${tasksFilePath}の存在を確認**
2. **存在する場合**: 既存タスクを読み込み、新しいタスクを追加（重複はid で判定して更新）してWriteツールで保存
3. **存在しない場合**: 新規作成してWriteツールで保存

## 出力ファイル: タスクリスト
**ファイルパス**: ${tasksFilePath}

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

**重要**: 必ず Write ツールを使用してファイルを作成してください。既存ファイルがあれば既存のタスクとマージしてください。
`;

    // Phase 3: Task generation with retry
    const taskGenerationResult = await RetryManager.executeWithRetry(
      async () => {
        for await (const message of provider.execute(taskGenerationPrompt, {
          maxTurns: 10,
          cwd: config.baseRepoPath,
          allowedTools: ['Read', 'Glob', 'Grep', 'Write'],
          permissionMode: 'acceptEdits',
        })) {
          // AI が Write ツールでファイルを作成するのを待つ
        }
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

    // Read tasks from file
    let tasks: Task[] = [];
    try {
      console.log(`🔍 Reading tasks from .kugutsu/tasks.json...`);
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
      console.error('❌ tasks.json の読み込みに失敗:', error);
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

    // Phase 4: Create instruction.md for each task
    const instructionPrompt = `${feedbackContext}
# Task Instructions Generation

以下のタスクそれぞれに対して、詳細な実装指示書（instruction.md）を作成してください。

## タスクリスト
${JSON.stringify(tasks.map(t => ({ id: t.id, title: t.title, description: t.description })), null, 2)}

## プロジェクト情報
**Readツールで${techStackFilePath}を読み込んで参照してください**

## ユーザーリクエスト
${userRequest}

## タスク
各タスクについて、以下のファイルを作成してください：

**ファイルパス形式**: .kugutsu/tasks/{taskId}/instruction.md

## ファイル作成・更新方針（Upsert）
各タスクのinstruction.mdについて：
1. **Readツールで.kugutsu/tasks/{taskId}/instruction.mdの存在を確認**
2. **存在する場合**: 既存内容を読み込み、その内容を基に更新してWriteツールで保存
3. **存在しない場合**: 新規作成してWriteツールで保存

**内容**: Markdown形式で以下を含める
- タスクの目的
- **既存のどのファイルを編集/追加するか**（新規プロジェクト作成は不要）
- 実装すべき詳細
- 技術的制約
- テスト駆動開発の手順
- 動作確認方法

**重要**:
- 必ず Write ツールを使用してすべてのファイルを作成してください
- 既存ファイルがあれば既存の内容を尊重して更新してください
- 既存プロジェクトへの機能追加なので、プロジェクトセットアップタスクは作成しないでください
- 各タスクのinstruction.mdを必ず作成してください
`;

    const instructionResult = await RetryManager.executeWithRetry(
      async () => {
        for await (const message of provider.execute(instructionPrompt, {
          maxTurns: 15,
          cwd: config.baseRepoPath,
          allowedTools: ['Read', 'Glob', 'Write'],
          permissionMode: 'acceptEdits',
        })) {
          // AI が Write ツールでファイルを作成するのを待つ
        }
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

    if (!instructionResult.success) {
      console.warn('⚠️ instruction.md の作成に失敗しました:', instructionResult.error?.message);
    } else {
      console.log('✅ instruction.md 作成完了');
    }

    // Return state update with file paths
    const result = {
      tasks,
      techStackPath: '.kugutsu/tech-stack.json',
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
