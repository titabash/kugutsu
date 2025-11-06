import { BaseAI } from './BaseAI';
import { query } from '@anthropic-ai/claude-code';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
export class TaskGeneratorAI extends BaseAI {
    config;
    baseRepoPath;
    constructor(baseRepoPath, config) {
        super();
        this.baseRepoPath = baseRepoPath;
        this.config = {
            systemPrompt: this.getSystemPrompt(),
            maxTurns: 50,
            allowedTools: ["Read", "Glob", "Grep", "LS", "Write"],
            ...config
        };
    }
    getComponentType() {
        return 'ProductOwner';
    }
    getId() {
        return 'TaskGenerator';
    }
    getSystemPrompt() {
        return `あなたはタスク生成の専門家です。
要件を実装可能な具体的タスクに分割し、効率的な並列実行を可能にすることが専門です。

## 🎯 専門責務
- 要件の適切な粒度でのタスク分割
- タスク間依存関係の明確化
- 並列実行可能なタスクグループの設計
- 優先度とスケジューリングの最適化
- 適切な粒度でのタスク生成

## 🔧 タスク分割の原則
1. **マイクロ一気通関**: 1タスクでフロントエンド〜バックエンド〜DBまで完結
2. **1人1日完了**: 各タスクは1人の人間エンジニアが4-8時間で完了可能
3. **独立価値提供**: 各タスクが独立したユーザー価値を提供
4. **真の依存関係のみ**: 技術的に真に必要な依存関係のみ設定
5. **並列最大化**: 可能な限り並列実行できるよう設計

## 📏 タスク粒度ガイドライン（人間エンジニア基準）
- **理想完了時間**: 4-8時間（人間エンジニアが実装した場合）
- **最大許容時間**: 12時間（人間エンジニアが実装した場合）
- **最小時間**: 2時間（人間エンジニアが実装した場合）
- **柔軟なタスク数**: 要件に応じて適切な数を生成

## 🚀 並列化戦略
### 並列実行可能な例
- 「ユーザー登録機能」（独立）
- 「商品一覧表示機能」（独立）
- 「カテゴリ管理機能」（独立）
- 「お問い合わせ機能」（独立）

### シーケンシャル必須な例
1. 「認証基盤実装」
2. 「管理者ログイン機能」（認証基盤に依存）
3. 「管理者ダッシュボード」（管理者ログインに依存）

## 📊 成果物要求
分析完了後、以下の形式のJSONファイルを作成してください：

**保存先**: .kugutsu/task-generation.json

\`\`\`json
{
  "tasks": [
    {
      "id": "task-uuid-1",
      "type": "feature|bug|improvement|refactor",
      "title": "具体的なタスク名",
      "description": "詳細な説明",
      "priority": "high|medium|low",
      "estimatedHours": 6,
      "dependencies": ["task-uuid-2"],
      "category": "frontend|backend|database|integration",
      "acceptanceCriteria": ["基準1", "基準2"],
      "technicalRequirements": ["要件1", "要件2"],
      "valueDescription": "このタスクが提供するユーザー価値"
    }
  ],
  "taskCount": 7,
  "taskCategories": ["frontend", "backend", "database"],
  "dependencies": {
    "task-uuid-1": ["task-uuid-2", "task-uuid-3"],
    "task-uuid-2": []
  },
  "estimatedTotalTime": "42時間",
  "parallelGroups": [
    [{"id": "task-uuid-1"}, {"id": "task-uuid-2"}],
    [{"id": "task-uuid-3"}]
  ],
  "criticalPath": ["task-uuid-2", "task-uuid-3", "task-uuid-1"]
}
\`\`\`

## 🚨 重要注意点
- 要件に応じて自然な数のタスクを生成（1個でも10個でも適切であれば良い）
- 各タスクは独立して価値を提供できること
- 技術的実装の詳細は指定しない（エンジニアが決定）
- 依存関係は技術的に真に必要なもののみ設定
- 並列実行を最大化するタスク設計

## 🔍 タスク生成プロセス
1. **要件の機能分解**: 機能要件を独立した機能単位に分解
2. **技術レイヤー統合**: 各機能をフルスタックで実装可能なタスクに統合
3. **依存関係分析**: 真の技術的依存関係のみを特定
4. **並列グループ設計**: 同時実行可能なタスクをグループ化
5. **品質保証**: 各タスクの完了基準と価値を明確化
`;
    }
    async generateTasks(userRequest, projectId, techStackAnalysis, requirementsAnalysis) {
        this.info('🎯 タスク生成開始');
        const kugutsuDir = path.join(this.baseRepoPath, '.kugutsu');
        const analysisPath = path.join(kugutsuDir, 'task-generation.json');
        // 既存の分析結果をチェック
        try {
            await fs.access(analysisPath);
            const existingContent = await fs.readFile(analysisPath, 'utf-8');
            const existingResult = JSON.parse(existingContent);
            // 要件が同じかチェック
            if (existingResult.userRequestSummary === userRequest) {
                this.info('📋 既存のタスク生成結果を使用します');
                return existingResult;
            }
            this.info('🔄 新しい要件を検出。タスク生成を更新します');
        }
        catch {
            this.info('🆕 新規タスク生成を実行します');
        }
        const prompt = await this.buildGenerationPrompt(userRequest, projectId, techStackAnalysis, requirementsAnalysis);
        this.info('🔄 TaskGeneratorAI query開始');
        const messages = [];
        for await (const message of query({
            prompt,
            abortController: new AbortController(),
            options: {
                maxTurns: this.config.maxTurns,
                cwd: this.baseRepoPath,
                allowedTools: this.config.allowedTools,
            },
        })) {
            messages.push(message);
            // Claude Code SDKのメッセージを表示
            if (message) {
                this.info(`Type: ${message.type}, Content: ${JSON.stringify(message.message?.content || message)}`);
            }
        }
        this.info('🔄 TaskGeneratorAI query完了');
        // 生成結果を読み込み
        this.info('📄 生成結果を読み込み中...');
        const result = await this.loadGenerationResult(analysisPath);
        this.info(`✅ タスク生成完了: ${result.taskCount}個のタスク`);
        return result;
    }
    async buildGenerationPrompt(userRequest, projectId, techStackAnalysis, requirementsAnalysis) {
        return `ユーザー要求を実装可能なタスクに分割してください。

## 📝 ユーザー要求
${userRequest}

## 🔍 技術スタック情報
- プロジェクトタイプ: ${techStackAnalysis.projectType}
- 主要言語: ${techStackAnalysis.primaryLanguages.join(', ')}
- フレームワーク: ${techStackAnalysis.frameworks.join(', ')}
- 開発コマンド: ${JSON.stringify(techStackAnalysis.developmentCommands)}

## 📋 要件分析結果
- 機能要件: ${requirementsAnalysis.functionalRequirements?.features?.join(', ') || '未定義'}
- 受け入れ基準: ${requirementsAnalysis.acceptanceCriteria?.join(', ') || '未定義'}
- 複雑度: ${requirementsAnalysis.estimatedComplexity || '未定義'}
- 優先度: ${requirementsAnalysis.priority || '未定義'}

## 🎯 タスク生成方針
1. **マイクロ一気通関**: 各タスクでフロントエンド〜バックエンド〜DBまで完結
2. **適切な粒度**: 要件に応じて自然な数のタスクを生成
3. **並列最大化**: 可能な限り並列実行できるよう設計
4. **独立価値**: 各タスクが独立したユーザー価値を提供
5. **完了可能性**: 1タスク4-8時間で完了可能（人間エンジニア基準）

## 📊 成果物作成
分析完了後、必ず .kugutsu/task-generation.json ファイルを作成してください。

**重要**: 要件に応じて適切な数のタスクを生成してください。

プロジェクトID: ${projectId}
`;
    }
    async loadGenerationResult(analysisPath) {
        try {
            const content = await fs.readFile(analysisPath, 'utf-8');
            const rawResult = JSON.parse(content);
            // タスクにUUIDを付与（存在しない場合）
            const tasks = rawResult.tasks.map((task) => ({
                ...task,
                id: task.id || uuidv4(),
                dependencies: task.dependencies || [],
                createdAt: new Date(),
                updatedAt: new Date(),
                status: 'pending'
            }));
            return {
                ...rawResult,
                tasks,
                taskCount: tasks.length
            };
        }
        catch (error) {
            throw new Error(`タスク生成結果の読み込みに失敗: ${error}`);
        }
    }
}
//# sourceMappingURL=TaskGeneratorAI.js.map