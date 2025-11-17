/**
 * Tech Lead Design Node
 *
 * TechLeadAIが設計書を作成する
 *
 * 生成物:
 * - 全体設計書 (design-docs.md)
 * - UI/UX設計 (wireframes.md + screens.json)
 * - DB設計 (er-diagram.md + schema.json)
 * - API設計 (api-spec.md + api-spec.json)
 */
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import { GitWorktreeManager } from '../../managers/GitWorktreeManager.js';
import { MessageHandler } from '../../utils/MessageHandler.js';
import * as fs from 'fs/promises';
import * as path from 'path';
/**
 * Tech Lead Design Node
 *
 * Responsibilities:
 * 1. Load approved story mapping
 * 2. Analyze existing system architecture
 * 3. Generate comprehensive design documents using AI
 * 4. Save all design documents (Markdown + JSON)
 * 5. Update state with design status
 */
export async function techLeadDesignNode(state) {
    const { config, currentProjectId, storyMappingApproved } = state;
    // Sync failed providers from state
    AIProviderFactory.syncWithState(state.failedProviders || []);
    console.log('🎨 TechLeadDesign: 設計書作成開始');
    if (!currentProjectId) {
        console.log('⚠️ プロジェクトIDが指定されていません');
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'warn',
                    source: 'tech_lead_design',
                    message: 'プロジェクトIDなし',
                },
            ],
            failedProviders: AIProviderFactory.getFailedProviders(),
        };
    }
    if (!storyMappingApproved) {
        console.log('⚠️ ストーリーマッピングが承認されていません');
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'warn',
                    source: 'tech_lead_design',
                    message: 'ストーリーマッピング未承認',
                },
            ],
            failedProviders: AIProviderFactory.getFailedProviders(),
        };
    }
    // Define file paths
    const storyMapJsonPath = path.join(config.baseRepoPath, '.kugutsu', 'projects', currentProjectId, 'story-mapping', 'story-map.json');
    // ストーリーマッピングを読み込み
    let storyMapping;
    try {
        const storyMappingContent = await fs.readFile(storyMapJsonPath, 'utf-8');
        storyMapping = JSON.parse(storyMappingContent);
        console.log('📖 ストーリーマッピング読み込み完了');
    }
    catch (error) {
        console.log('⚠️ ストーリーマッピングが見つかりません:', storyMapJsonPath);
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'warn',
                    source: 'tech_lead_design',
                    message: `ストーリーマッピングなし: ${error.message}`,
                },
            ],
            failedProviders: AIProviderFactory.getFailedProviders(),
        };
    }
    // AIプロバイダーを作成
    const providerConfig = AIProviderFactory.buildProviderConfig({
        provider: config.provider || 'claude',
    });
    const provider = AIProviderFactory.create(providerConfig);
    // Define all design file paths
    const designDocsPath = path.join(config.baseRepoPath, '.kugutsu', 'projects', currentProjectId, 'design', 'design-docs.md');
    const screensJsonPath = path.join(config.baseRepoPath, '.kugutsu', 'projects', currentProjectId, 'design', 'uiux', 'screens.json');
    const wireframesMdPath = path.join(config.baseRepoPath, '.kugutsu', 'projects', currentProjectId, 'design', 'uiux', 'wireframes.md');
    const schemaJsonPath = path.join(config.baseRepoPath, '.kugutsu', 'projects', currentProjectId, 'design', 'database', 'schema.json');
    const erDiagramMdPath = path.join(config.baseRepoPath, '.kugutsu', 'projects', currentProjectId, 'design', 'database', 'er-diagram.md');
    const apiSpecJsonPath = path.join(config.baseRepoPath, '.kugutsu', 'projects', currentProjectId, 'design', 'interfaces', 'api-spec.json');
    const apiSpecMdPath = path.join(config.baseRepoPath, '.kugutsu', 'projects', currentProjectId, 'design', 'interfaces', 'api-spec.md');
    console.log('🤖 AI: 全体設計書を生成中...');
    // ステップ1: 全体設計書を生成
    const designDocsPrompt = buildDesignDocsPrompt(storyMapping, designDocsPath);
    const handler1 = new MessageHandler({
        maxTurns: config.maxTurns || 50,
        nodeName: 'TechLeadDesign - Design Docs',
    });
    for await (const message of provider.execute(designDocsPrompt, {
        maxTurns: config.maxTurns || 50,
        cwd: config.baseRepoPath,
        allowedTools: ['Write', 'Read', 'Glob'],
        permissionMode: 'acceptEdits',
        includePartialMessages: true,
    })) {
        await handler1.handleMessage(message);
    }
    handler1.completeWithErrorCheck('全体設計書生成が完了しました', 'TechLeadDesign');
    console.log('✅ 全体設計書を保存しました');
    console.log('🤖 AI: UI/UX設計とDB設計を並列生成中...');
    // ステップ2 & 3: UI/UX設計とDB設計を並列実行
    const uiuxPrompt = buildUIUXDesignPrompt(storyMapping, screensJsonPath, wireframesMdPath);
    const dbPrompt = buildDatabaseDesignPrompt(storyMapping, schemaJsonPath, erDiagramMdPath);
    await Promise.all([
        // UI/UX設計生成
        (async () => {
            const handler2 = new MessageHandler({
                maxTurns: config.maxTurns || 50,
                nodeName: 'TechLeadDesign - UI/UX Design',
            });
            for await (const message of provider.execute(uiuxPrompt, {
                maxTurns: config.maxTurns || 50,
                cwd: config.baseRepoPath,
                allowedTools: ['Write'],
                permissionMode: 'acceptEdits',
                includePartialMessages: true,
            })) {
                await handler2.handleMessage(message);
            }
            handler2.completeWithErrorCheck('UI/UX設計生成が完了しました', 'TechLeadDesign');
            console.log('✅ screens.json と wireframes.md を保存しました');
        })(),
        // DB設計生成
        (async () => {
            const handler3 = new MessageHandler({
                maxTurns: config.maxTurns || 50,
                nodeName: 'TechLeadDesign - Database Design',
            });
            for await (const message of provider.execute(dbPrompt, {
                maxTurns: config.maxTurns || 50,
                cwd: config.baseRepoPath,
                allowedTools: ['Write'],
                permissionMode: 'acceptEdits',
                includePartialMessages: true,
            })) {
                await handler3.handleMessage(message);
            }
            handler3.completeWithErrorCheck('DB設計生成が完了しました', 'TechLeadDesign');
            console.log('✅ schema.json と er-diagram.md を保存しました');
        })(),
    ]);
    console.log('✅ UI/UX設計とDB設計の並列生成が完了しました');
    console.log('🤖 AI: API設計を生成中...');
    // Read schema.json to pass to API design
    let dbSchema = null;
    try {
        const schemaContent = await fs.readFile(schemaJsonPath, 'utf-8');
        dbSchema = JSON.parse(schemaContent);
    }
    catch (error) {
        console.warn('⚠️ schema.jsonの読み込みに失敗しました:', error);
    }
    // ステップ4: API設計を生成
    const apiPrompt = buildAPIDesignPrompt(storyMapping, dbSchema, apiSpecJsonPath, apiSpecMdPath);
    const handler4 = new MessageHandler({
        maxTurns: config.maxTurns || 50,
        nodeName: 'TechLeadDesign - API Design',
    });
    for await (const message of provider.execute(apiPrompt, {
        maxTurns: config.maxTurns || 50,
        cwd: config.baseRepoPath,
        allowedTools: ['Write'],
        permissionMode: 'acceptEdits',
        includePartialMessages: true,
    })) {
        await handler4.handleMessage(message);
    }
    handler4.completeWithErrorCheck('API設計生成が完了しました', 'TechLeadDesign');
    console.log('✅ api-spec.json と api-spec.md を保存しました');
    console.log('✅ 設計書作成完了');
    // repository/の変更をコミット
    console.log('📝 repository/の変更をコミットしています...');
    const gitManager = new GitWorktreeManager(config.baseRepoPath, config.worktreeBasePath || './worktrees', config.baseBranch || 'main');
    try {
        await gitManager.addAndCommit('.kugutsu/repository/', 'chore: Update repository specifications\n\n🤖 Generated with Kugutsu 2.0\n\nCo-Authored-By: Claude <noreply@anthropic.com>');
    }
    catch (commitError) {
        console.warn('⚠️ repository/のコミットに失敗しました:', commitError);
        // コミット失敗しても処理は継続
    }
    return {
        logs: [
            {
                timestamp: new Date(),
                level: 'success',
                source: 'tech_lead_design',
                message: '設計書作成完了（全体設計、UI/UX、DB、API）',
            },
        ],
        failedProviders: AIProviderFactory.getFailedProviders(),
    };
}
/**
 * 全体設計書プロンプトを構築
 */
function buildDesignDocsPrompt(storyMapping, designDocsPath) {
    return `
# 全体設計書の作成

あなたはTechLeadとして、以下のストーリーマッピングから全体設計書を作成してください。

## 【必須ファイルの読み込み】
以下のファイルは前のノード（DirectorまたはReviewStoryMapping）が作成済みです。必ず読み込んでください：
- ストーリーマッピングは既に読み込み済みです（下記参照）

## ストーリーマッピング

\`\`\`json
${JSON.stringify(storyMapping, null, 2)}
\`\`\`

## 【参照推奨ファイル】
以下のファイルが存在する場合は、Readツールで読み込んで参考にしてください：
- \`.kugutsu/repository/metadata.json\`: リポジトリの基本情報
- \`.kugutsu/repository/architecture/overview.md\`: 全体アーキテクチャ
- \`.kugutsu/repository/architecture/tech-stack.json\`: 技術スタック
- \`.kugutsu/repository/standards/coding-standards.md\`: コーディング規約
- \`.kugutsu/repository/database/schema.json\`: 既存のDB設計
- \`.kugutsu/repository/api/api-spec.json\`: 既存のAPI仕様

## タスク

以下のMarkdown形式で全体設計書を作成してください：

### 必須セクション

1. **全体設計**
   - アーキテクチャ図（Mermaid graph）
   - 技術スタック（既存のコードベースを分析して決定）
   - レイヤー構成（Presentation, Application, Domain, Infrastructure）

2. **UI/UX設計サマリー**
   - 画面一覧表

3. **DB設計サマリー**
   - テーブル一覧表

4. **I/O設計サマリー**
   - API一覧表

5. **セキュリティ設計**
   - 認証・認可方式
   - データ保護

6. **パフォーマンス設計**
   - 目標値
   - 最適化戦略

7. **エラーハンドリング**
   - エラーコード体系

8. **デプロイメント**
   - 環境
   - CI/CD

## 【必須作成ファイル】
以下のファイルをWriteツールで必ず作成してください：
- **${designDocsPath}**: 上記の全体設計書（Markdown形式）

**重要**: Writeツールを使用してこのファイルを作成してください。作成後、Readツールで内容を確認してください。

## 重要な指針

- **既存システムを尊重**: コードベースを分析し、既存の技術スタックと整合性を保つ
- **リポジトリ全体の仕様を参照**: \`.kugutsu/repository/\` 配下の仕様を参照し、整合性を保つ
- **必要最小限**: 過剰設計を避け、ストーリーを実現する最小限の設計
- **明確性**: エンジニア間で実装がブレない明確さ
`.trim();
}
/**
 * UI/UX設計プロンプトを構築
 */
function buildUIUXDesignPrompt(storyMapping, screensJsonPath, wireframesMdPath) {
    return `
# UI/UX設計書の作成

あなたはTechLeadとして、以下のストーリーマッピングからUI/UX設計を作成してください。

## ストーリーマッピング

\`\`\`json
${JSON.stringify(storyMapping, null, 2)}
\`\`\`

## 【必須作成ファイル】
以下の2つのファイルをWriteツールで必ず作成してください：

### 1. ${screensJsonPath}
JSON構造化データ（以下のフォーマット）:
\`\`\`json
{
  "screens": [
    {
      "id": "SCR-001",
      "name": "画面名",
      "path": "/path",
      "description": "説明",
      "components": [
        {
          "name": "ComponentName",
          "props": ["prop1", "prop2"]
        }
      ],
      "state": {
        "stateVar": "type"
      },
      "events": [
        {
          "name": "onEvent",
          "params": ["param: type"],
          "action": "Action description"
        }
      ]
    }
  ]
}
\`\`\`

### 2. ${wireframesMdPath}
Markdown + Mermaid形式（必須セクション）:
- 画面遷移図（Mermaid graph）
- 各画面のワイヤーフレーム（ASCII artまたはMermaid）
- コンポーネント構成
- 状態管理
- イベント定義

**重要**: Writeツールを使用してこれら2つのファイルを作成してください。作成後、Readツールで内容を確認してください。
`.trim();
}
/**
 * DB設計プロンプトを構築
 */
function buildDatabaseDesignPrompt(storyMapping, schemaJsonPath, erDiagramMdPath) {
    return `
# DB設計書の作成

あなたはTechLeadとして、以下のストーリーマッピングからDB設計を作成してください。

## ストーリーマッピング

\`\`\`json
${JSON.stringify(storyMapping, null, 2)}
\`\`\`

## 【必須作成ファイル】
以下の2つのファイルをWriteツールで必ず作成してください：

### 1. ${schemaJsonPath}
JSON構造化データ（以下のフォーマット）:
\`\`\`json
{
  "version": "1.0.0",
  "database": "database_name",
  "tables": [
    {
      "name": "table_name",
      "comment": "説明",
      "columns": [
        {
          "name": "column_name",
          "type": "TYPE",
          "nullable": false,
          "primaryKey": false,
          "comment": "説明"
        }
      ],
      "indexes": [
        {
          "name": "index_name",
          "columns": ["col1", "col2"],
          "unique": false
        }
      ]
    }
  ],
  "relationships": [
    {
      "from": "table1",
      "to": "table2",
      "fromColumn": "col1",
      "toColumn": "col2",
      "type": "many-to-one"
    }
  ]
}
\`\`\`

### 2. ${erDiagramMdPath}
Markdown + Mermaid形式（必須セクション）:
- ER図（Mermaid erDiagram）
- 各テーブルの詳細定義
- インデックス戦略
- マイグレーションSQL
- パフォーマンス最適化方針

## 重要な指針

- 既存のDB schemaを分析して統一性を保つ
- 正規化を適切に行う
- インデックスを適切に配置
- 外部キー制約を設定

**重要**: Writeツールを使用してこれら2つのファイルを作成してください。作成後、Readツールで内容を確認してください。
`.trim();
}
/**
 * API設計プロンプトを構築
 */
function buildAPIDesignPrompt(storyMapping, dbSchema, apiSpecJsonPath, apiSpecMdPath) {
    const dbSchemaStr = dbSchema ? JSON.stringify(dbSchema, null, 2) : 'N/A';
    return `
# API設計書の作成

あなたはTechLeadとして、以下のストーリーマッピングとDB設計からAPI仕様を作成してください。

## ストーリーマッピング

\`\`\`json
${JSON.stringify(storyMapping, null, 2)}
\`\`\`

## DB Schema

\`\`\`json
${dbSchemaStr}
\`\`\`

## 【必須作成ファイル】
以下の2つのファイルをWriteツールで必ず作成してください：

### 1. ${apiSpecJsonPath}
OpenAPI 3.0準拠のJSON schema:
\`\`\`json
{
  "openapi": "3.0.0",
  "info": {
    "title": "API Title",
    "version": "1.0.0"
  },
  "paths": {
    ...
  }
}
\`\`\`

### 2. ${apiSpecMdPath}
Markdown形式（必須セクション）:
- API一覧表
- 各エンドポイントの詳細（リクエスト、レスポンス、エラー）
- データモデル
- エラーコード

## 重要な指針

- RESTful設計原則に従う
- 認証・認可を考慮
- エラーハンドリングを明確に
- バリデーションルールを定義

**重要**: Writeツールを使用してこれら2つのファイルを作成してください。作成後、Readツールで内容を確認してください。
`.trim();
}
//# sourceMappingURL=TechLeadDesignNode.js.map