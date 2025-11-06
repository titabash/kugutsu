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
import { DataPersistence } from '../../utils/DataPersistence.js';
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
        };
    }
    // データ永続化マネージャーを初期化
    const persistence = new DataPersistence(config.baseRepoPath);
    await persistence.initialize();
    // ストーリーマッピングを読み込み
    const storyMapping = await persistence.loadStoryMapping(currentProjectId);
    if (!storyMapping) {
        console.log('⚠️ ストーリーマッピングが見つかりません');
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'warn',
                    source: 'tech_lead_design',
                    message: 'ストーリーマッピングなし',
                },
            ],
        };
    }
    console.log('📖 ストーリーマッピング読み込み完了');
    // AIプロバイダーを作成
    const providerConfig = {
        provider: config.provider || 'claude',
        claude: {
            model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
        },
    };
    const provider = AIProviderFactory.create(providerConfig);
    console.log('🤖 AI: 全体設計書を生成中...');
    // ステップ1: 全体設計書を生成
    const designDocsPrompt = buildDesignDocsPrompt(storyMapping);
    const designDocsMarkdown = await executeAIPrompt(provider, designDocsPrompt, config.baseRepoPath);
    if (!designDocsMarkdown) {
        console.log('❌ 全体設計書の生成に失敗しました');
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'error',
                    source: 'tech_lead_design',
                    message: '全体設計書生成失敗',
                },
            ],
        };
    }
    // 全体設計書を保存
    await persistence.saveDesignDocsMarkdown(currentProjectId, designDocsMarkdown);
    console.log('✅ 全体設計書を保存しました');
    console.log('🤖 AI: UI/UX設計を生成中...');
    // ステップ2: UI/UX設計を生成
    const uiuxPrompt = buildUIUXDesignPrompt(storyMapping);
    const uiuxResult = await executeAIPrompt(provider, uiuxPrompt, config.baseRepoPath);
    if (!uiuxResult) {
        console.log('❌ UI/UX設計の生成に失敗しました');
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'error',
                    source: 'tech_lead_design',
                    message: 'UI/UX設計生成失敗',
                },
            ],
        };
    }
    // wireframes.mdとscreens.jsonを抽出
    const wireframesMarkdown = extractMarkdownSection(uiuxResult, 'wireframes');
    const screensJSON = extractJSONSection(uiuxResult, 'screens');
    if (wireframesMarkdown) {
        await persistence.saveUIUXWireframes(currentProjectId, wireframesMarkdown);
        console.log('✅ wireframes.mdを保存しました');
    }
    if (screensJSON) {
        await persistence.saveUIUXScreens(currentProjectId, screensJSON);
        console.log('✅ screens.jsonを保存しました');
    }
    console.log('🤖 AI: DB設計を生成中...');
    // ステップ3: DB設計を生成
    const dbPrompt = buildDatabaseDesignPrompt(storyMapping);
    const dbResult = await executeAIPrompt(provider, dbPrompt, config.baseRepoPath);
    if (!dbResult) {
        console.log('❌ DB設計の生成に失敗しました');
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'error',
                    source: 'tech_lead_design',
                    message: 'DB設計生成失敗',
                },
            ],
        };
    }
    // er-diagram.mdとschema.jsonを抽出
    const erDiagramMarkdown = extractMarkdownSection(dbResult, 'er-diagram');
    const dbSchemaJSON = extractJSONSection(dbResult, 'schema');
    if (erDiagramMarkdown) {
        await persistence.saveDatabaseERDiagram(currentProjectId, erDiagramMarkdown);
        console.log('✅ er-diagram.mdを保存しました');
    }
    if (dbSchemaJSON) {
        await persistence.saveDatabaseSchema(currentProjectId, dbSchemaJSON);
        console.log('✅ schema.jsonを保存しました');
    }
    console.log('🤖 AI: API設計を生成中...');
    // ステップ4: API設計を生成
    const apiPrompt = buildAPIDesignPrompt(storyMapping, dbSchemaJSON);
    const apiResult = await executeAIPrompt(provider, apiPrompt, config.baseRepoPath);
    if (!apiResult) {
        console.log('❌ API設計の生成に失敗しました');
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'error',
                    source: 'tech_lead_design',
                    message: 'API設計生成失敗',
                },
            ],
        };
    }
    // api-spec.mdとapi-spec.jsonを抽出
    const apiSpecMarkdown = extractMarkdownSection(apiResult, 'api-spec');
    const apiSpecJSON = extractJSONSection(apiResult, 'api-spec');
    if (apiSpecMarkdown) {
        await persistence.saveAPISpecMarkdown(currentProjectId, apiSpecMarkdown);
        console.log('✅ api-spec.mdを保存しました');
    }
    if (apiSpecJSON) {
        await persistence.saveAPISpec(currentProjectId, apiSpecJSON);
        console.log('✅ api-spec.jsonを保存しました');
    }
    console.log('✅ 設計書作成完了');
    return {
        logs: [
            {
                timestamp: new Date(),
                level: 'success',
                source: 'tech_lead_design',
                message: '設計書作成完了（全体設計、UI/UX、DB、API）',
            },
        ],
    };
}
/**
 * AI実行ヘルパー
 */
async function executeAIPrompt(provider, prompt, cwd) {
    let result = '';
    try {
        for await (const message of provider.execute(prompt, {
            maxTurns: 30,
            cwd,
            allowedTools: ['Read', 'Glob', 'Grep'],
            permissionMode: 'acceptEdits',
        })) {
            if (message.type === 'assistant' && message.content) {
                if (typeof message.content === 'string') {
                    result += message.content;
                }
                else {
                    result += JSON.stringify(message.content);
                }
            }
        }
        return result || null;
    }
    catch (error) {
        console.error('❌ AI実行エラー:', error);
        return null;
    }
}
/**
 * 全体設計書プロンプトを構築
 */
function buildDesignDocsPrompt(storyMapping) {
    return `
# 全体設計書の作成

あなたはTechLeadとして、以下のストーリーマッピングから全体設計書を作成してください。

## ストーリーマッピング

\`\`\`json
${JSON.stringify(storyMapping, null, 2)}
\`\`\`

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

## 重要な指針

- **既存システムを尊重**: コードベースを分析し、既存の技術スタックと整合性を保つ
- **必要最小限**: 過剰設計を避け、ストーリーを実現する最小限の設計
- **明確性**: エンジニア間で実装がブレない明確さ

## 出力形式

Markdown形式で全文を出力してください。Mermaid図を活用してください。
`.trim();
}
/**
 * UI/UX設計プロンプトを構築
 */
function buildUIUXDesignPrompt(storyMapping) {
    return `
# UI/UX設計書の作成

あなたはTechLeadとして、以下のストーリーマッピングからUI/UX設計を作成してください。

## ストーリーマッピング

\`\`\`json
${JSON.stringify(storyMapping, null, 2)}
\`\`\`

## タスク

以下の2つのファイルを作成してください：

### 1. wireframes.md（Markdown + Mermaid）

必須セクション:
- 画面遷移図（Mermaid graph）
- 各画面のワイヤーフレーム（ASCII artまたはMermaid）
- コンポーネント構成
- 状態管理
- イベント定義

### 2. screens.json（JSON構造化データ）

フォーマット:
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

## 出力形式

以下の形式で2つのファイルを出力してください：

\`\`\`markdown:wireframes
# wireframes.mdの内容
...
\`\`\`

\`\`\`json:screens
{
  "screens": [...]
}
\`\`\`
`.trim();
}
/**
 * DB設計プロンプトを構築
 */
function buildDatabaseDesignPrompt(storyMapping) {
    return `
# DB設計書の作成

あなたはTechLeadとして、以下のストーリーマッピングからDB設計を作成してください。

## ストーリーマッピング

\`\`\`json
${JSON.stringify(storyMapping, null, 2)}
\`\`\`

## タスク

以下の2つのファイルを作成してください：

### 1. er-diagram.md（Markdown + Mermaid）

必須セクション:
- ER図（Mermaid erDiagram）
- 各テーブルの詳細定義
- インデックス戦略
- マイグレーションSQL
- パフォーマンス最適化方針

### 2. schema.json（JSON構造化データ）

フォーマット:
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

## 重要な指針

- 既存のDB schemaを分析して統一性を保つ
- 正規化を適切に行う
- インデックスを適切に配置
- 外部キー制約を設定

## 出力形式

以下の形式で2つのファイルを出力してください：

\`\`\`markdown:er-diagram
# er-diagram.mdの内容
...
\`\`\`

\`\`\`json:schema
{
  "version": "1.0.0",
  ...
}
\`\`\`
`.trim();
}
/**
 * API設計プロンプトを構築
 */
function buildAPIDesignPrompt(storyMapping, dbSchema) {
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

## タスク

以下の2つのファイルを作成してください：

### 1. api-spec.md（Markdown）

必須セクション:
- API一覧表
- 各エンドポイントの詳細（リクエスト、レスポンス、エラー）
- データモデル
- エラーコード

### 2. api-spec.json（OpenAPI 3.0）

OpenAPI 3.0準拠のJSON schemaを作成してください。

## 重要な指針

- RESTful設計原則に従う
- 認証・認可を考慮
- エラーハンドリングを明確に
- バリデーションルールを定義

## 出力形式

以下の形式で2つのファイルを出力してください：

\`\`\`markdown:api-spec
# api-spec.mdの内容
...
\`\`\`

\`\`\`json:api-spec
{
  "openapi": "3.0.0",
  ...
}
\`\`\`
`.trim();
}
/**
 * Markdownセクションを抽出
 */
function extractMarkdownSection(response, sectionName) {
    const regex = new RegExp(`\`\`\`markdown:${sectionName}\\s*([\\s\\S]*?)\\s*\`\`\``, 'm');
    const match = response.match(regex);
    return match ? match[1].trim() : null;
}
/**
 * JSONセクションを抽出
 */
function extractJSONSection(response, sectionName) {
    const regex = new RegExp(`\`\`\`json:${sectionName}\\s*([\\s\\S]*?)\\s*\`\`\``, 'm');
    const match = response.match(regex);
    if (!match) {
        return null;
    }
    try {
        return JSON.parse(match[1].trim());
    }
    catch (error) {
        console.error(`❌ ${sectionName} JSONパースエラー:`, error);
        return null;
    }
}
//# sourceMappingURL=TechLeadDesignNode.js.map