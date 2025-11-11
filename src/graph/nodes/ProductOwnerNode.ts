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

    const maxTurns = config.maxTurns || 50;

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

1. **機能単位のフルスタック**: 1タスクでフロントエンド〜バックエンド〜DBまで完結（マイクロ一気通関）
2. **適切な粒度**: 1タスクは4-8時間で完了可能なサイズ
3. **独立価値提供**: 各タスクが独立したユーザー価値を提供（機能要件・非機能要件の単位）
4. **真の依存関係**: 技術的に真に必要な依存関係のみ設定
5. **テスト含む**: 各タスクはテストを含む
6. **並列最大化**: 可能な限り並列実行できるよう設計

## タスク分割戦略

### 機能単位で完結させる例

❌ **悪い例（技術レイヤーで分割）**:
- Task 1: Aboutページのコンポーネント作成
- Task 2: SEOメタデータ追加
- Task 3: レスポンシブレイアウト実装
- Task 4: アクセシビリティ対応
- Task 5: ナビゲーションリンク追加
- Task 6: テスト追加

✅ **良い例（機能単位のフルスタック）**:
- Task 1: Aboutページ追加（コンポーネント + SEO + レスポンシブ + アクセシビリティ + ナビゲーション + テスト）

### 機能分割の例

❌ **悪い例（技術レイヤーで分割）**:
- Task 1: ユーザーDB migration作成
- Task 2: ユーザーModel実装
- Task 3: ユーザーAPI実装
- Task 4: ユーザー登録画面実装

❌ **悪い例（DBマイグレーションを各タスクに含める - 並列実行で競合）**:
- Task 1: ユーザー登録機能（DB migration + Model + API + 登録画面 + テスト）
- Task 2: ユーザープロフィール機能（DB migration + Model + API + プロフィール画面 + テスト）
→ **危険**: 複数エンジニアが同時にDB migrationを実行して競合・衝突が発生

✅ **良い例（依存関係の広い基盤を先に独立タスク化）**:
- Task 1: **ユーザー関連DBスキーマ構築**（usersテーブル、profilesテーブルのmigration）← 先に単独実行
- Task 2: ユーザー登録機能（Task 1に依存。Model + API + 登録画面 + テスト）
- Task 3: ユーザープロフィール機能（Task 1に依存。Model + API + プロフィール画面 + テスト）

## ⚠️ 重要: 依存関係が広いタスクの分離（並列実行の安全性）

### 必ず独立タスクとして分離すべきもの

以下は**複数タスクで共有される基盤**のため、**必ず独立タスクとして先に実行**する必要があります:

1. **データベース関連**:
   - **DBクライアントのシングルトン** (例: \`lib/supabase.ts\`, \`lib/prisma.ts\`, \`lib/mongodb.ts\`)
   - DBマイグレーション（テーブル作成、カラム追加、インデックス作成）
   - データベーススキーマ設計
   - シードデータ投入

2. **外部サービスクライアント**:
   - **決済クライアント** (例: \`lib/stripe.ts\`, \`lib/paypal.ts\`)
   - **メール送信クライアント** (例: \`lib/sendgrid.ts\`, \`lib/resend.ts\`)
   - **ストレージクライアント** (例: \`lib/s3.ts\`, \`lib/cloudinary.ts\`)
   - **その他API クライアント** (例: \`lib/openai.ts\`, \`lib/maps.ts\`)

3. **共通データモデル・型定義**:
   - **共通型定義・インターフェース** (例: \`types/api.ts\`, \`types/error.ts\`, \`types/response.ts\`)
   - **共通データモデル** (例: \`models/User.ts\`, \`models/Product.ts\`, \`models/Order.ts\`)
   - **共通Enum定義** (例: \`types/enums.ts\` - UserRole, OrderStatus等)
   - **共通バリデーションスキーマ** (例: \`schemas/user.ts\`, \`schemas/product.ts\`)

4. **共通ユーティリティ・ヘルパー**:
   - **共通ユーティリティ関数** (例: \`utils/date.ts\`, \`utils/string.ts\`, \`utils/validation.ts\`)
   - **共通バリデーション関数** (例: \`utils/validators.ts\`)
   - **共通エラーハンドリング** (例: \`utils/error.ts\`, \`lib/api-error.ts\`)
   - **共通定数** (例: \`constants/index.ts\`, \`config/app.ts\`)

5. **認証・認可基盤**:
   - 認証システム構築（JWT、OAuth等）
   - 権限管理システム
   - セッション管理
   - 認証ミドルウェア

6. **共通UIコンポーネント**:
   - 共通UIコンポーネントライブラリ (例: \`components/ui/Button.tsx\`, \`components/ui/Input.tsx\`)
   - 共通レイアウトコンポーネント (例: \`components/Layout.tsx\`, \`components/Header.tsx\`)
   - 共通フック (例: \`hooks/useAuth.ts\`, \`hooks/useApi.ts\`)

7. **インフラ・環境設定**:
   - CI/CDパイプライン構築
   - 環境変数・設定ファイル
   - Docker/コンテナ設定

### 自動検出方法

**以下の方法で共通基盤を検出してください:**

1. **ファイルパターンでの検出** (Glob, Readツール使用):
   - \`/lib/*.ts\` → DBクライアント、外部サービスクライアント
   - \`/types/*.ts\`, \`/models/*.ts\` → 共通型定義、データモデル
   - \`/utils/*.ts\`, \`/helpers/*.ts\` → 共通ユーティリティ関数
   - \`/components/ui/*.tsx\` → 共通UIコンポーネント
   - \`/middleware/*.ts\` → 認証ミドルウェア

2. **依存関係分析** (Grepツール使用):
   - 複数ファイルから\`import\`されているモジュールを検出
   - 例: \`grep -r "from '@/lib/supabase'"\` で参照箇所を確認

3. **命名規則での検出**:
   - \`*Client.ts\`, \`*Service.ts\` → クライアント・サービス
   - \`*Model.ts\`, \`*Entity.ts\` → データモデル
   - \`use*.ts\` (hooks) → 共通フック
   - \`*Schema.ts\`, \`*Validator.ts\` → バリデーション

4. **未実装の共通基盤検出**:
   - ユーザーリクエストから新規機能に必要な共通基盤を推測
   - 例: 「決済機能を追加」→ Stripeクライアント、決済型定義が必要

### なぜ分離が必要か

**並列実行の危険性**:
- 複数エンジニアが同時にDBマイグレーションを実行 → マイグレーション番号の競合、テーブル作成の衝突
- 複数エンジニアが同じ共通コンポーネントを作成 → 実装の不整合、マージコンフリクト
- 複数エンジニアが認証システムを含む → 認証ロジックの重複、セキュリティリスク

**正しいアプローチ**:
1. 依存関係の広い基盤タスクを**独立タスクとして先に実行**（priority: 高）
2. 基盤タスク完了後、個別機能を**並列実行**（dependencies設定で制御）

### 依存関係の設定

**真の依存関係**（設定すべき）:
- 「DBスキーマ構築」→「各機能のModel/API実装」（DBが前提）
- 「認証基盤」→「認証が必要な各機能」（認証が前提）
- 「共通UIコンポーネント」→「各機能画面」（共通基盤が前提）

**偽の依存関係**（設定すべきでない）:
- 「SEOメタデータ追加」→「レスポンシブレイアウト実装」（同一タスク内で完結）
- 「コンポーネント作成」→「テスト追加」（同一タスク内で完結）
- 「API実装」→「画面実装」（同一機能として1タスクで完結）

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

