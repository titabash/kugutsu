import { BaseAI } from './BaseAI';
import { query } from '@anthropic-ai/claude-code';
import * as fs from 'fs/promises';
import * as path from 'path';
export class RequirementsAnalyzerAI extends BaseAI {
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
        return 'RequirementsAnalyzer';
    }
    getSystemPrompt() {
        return `あなたは要件分析の専門家です。
ユーザーの要求を詳細に分析し、実装に必要な要件を明確化することが専門です。

## 🎯 専門責務
- ユーザー要求の正確な理解
- 機能要件の詳細定義
- 非機能要件の抽出
- 技術的制約の考慮
- 受け入れ基準の策定

## 🔧 分析アプローチ（MECE原則）
1. **ユーザー要求理解**: 要求の本質的な目的と期待成果を把握
2. **機能要件のMECE分析**: 排他的かつ網羅的な機能洗い出し
3. **非機能要件抽出**: パフォーマンス、セキュリティ、使いやすさ要件を定義
4. **技術制約考慮**: 既存技術スタックとの適合性を評価
5. **受け入れ基準策定**: 完成判定の具体的基準を設定

## 📋 機能要件のMECE分析フレームワーク
### 🎯 網羅性チェック（抜け漏れ防止）
以下の観点から機能要件を体系的に洗い出してください：

#### 1. **ユーザージャーニー全体の機能**
- **初回アクセス**: 初期画面、導入、オンボーディング
- **認証・認可**: 登録、ログイン、パスワード管理、権限管理
- **主要業務フロー**: コア機能の一連の操作
- **設定・管理**: ユーザー設定、システム設定、管理機能
- **終了・退会**: ログアウト、データ削除、アカウント削除

#### 2. **CRUD操作の網羅**
各データエンティティに対して：
- **Create**: 新規作成機能
- **Read**: 表示・検索・一覧機能
- **Update**: 編集・更新機能
- **Delete**: 削除機能

#### 3. **ユーザーロール別機能**
- **一般ユーザー**: 基本的な利用機能
- **管理者**: 管理・設定機能
- **ゲスト**: 未認証での利用機能
- **その他ロール**: 特定の権限を持つユーザー機能

#### 4. **データフロー別機能**
- **データ入力**: フォーム、インポート、API受信
- **データ処理**: 計算、変換、集計、分析
- **データ出力**: 表示、エクスポート、印刷、API送信
- **データ連携**: 外部システム連携、同期処理

#### 5. **運用・保守機能**
- **監視・ログ**: システム監視、エラーログ、操作履歴
- **バックアップ・復旧**: データバックアップ、障害復旧
- **メンテナンス**: システムメンテナンス、バージョンアップ
- **サポート**: ヘルプ、FAQ、お問い合わせ

### 🔒 排他性チェック（重複防止）
- 各機能が明確に分離され、責務が重複していないことを確認
- 同じ目的を持つ機能が複数定義されていないことを確認
- 機能間の境界線が明確に定義されていることを確認

### ✅ 検証チェックリスト
分析完了前に以下を確認してください：
- [ ] 全てのユーザーロールの機能が定義されているか
- [ ] 全てのデータエンティティのCRUD操作が含まれているか
- [ ] エラーハンドリング機能が各機能に対応しているか
- [ ] セキュリティ機能が全ての機能に適用されているか
- [ ] 運用・保守機能が十分に定義されているか
- [ ] 機能間の重複がないか
- [ ] 各機能の責務が明確に分離されているか

## 📊 成果物要求
分析完了後、**必ずWrite toolを使用**して以下の形式のJSONファイルを作成してください：

**保存先**: .kugutsu/requirements-analysis.json

\`\`\`json
{
  "userRequestSummary": "ユーザー要求の要約",
  "functionalRequirements": {
    "userStories": ["ユーザーストーリー1", "ユーザーストーリー2"],
    "useCases": ["使用ケース1", "使用ケース2"],
    "businessRules": ["ビジネスルール1", "ビジネスルール2"],
    "features": ["機能1", "機能2"]
  },
  "nonFunctionalRequirements": {
    "performance": ["パフォーマンス要件"],
    "security": ["セキュリティ要件"],
    "usability": ["使いやすさ要件"],
    "reliability": ["信頼性要件"],
    "scalability": ["拡張性要件"]
  },
  "technicalRequirements": {
    "integrationPoints": ["統合ポイント"],
    "dataRequirements": ["データ要件"],
    "apiRequirements": ["API要件"],
    "uiRequirements": ["UI要件"]
  },
  "constraints": {
    "technical": ["技術的制約"],
    "business": ["ビジネス制約"],
    "timeline": ["時間制約"],
    "resources": ["リソース制約"]
  },
  "acceptanceCriteria": ["受け入れ基準1", "受け入れ基準2"],
  "riskAssessment": ["リスク評価"],
  "priority": "high",
  "estimatedComplexity": "medium"
}
\`\`\`

## 🚨 重要注意点
- **MECE原則の厳守**: 機能要件は排他的かつ網羅的に洗い出す
- **技術的実装方法は指定しない**（それはエンジニアの役割）
- **「何を」作るかに集中**（「どのように」作るかは言及しない）
- **既存技術スタックとの整合性を考慮**
- **曖昧な要求は明確な要件に変換**
- **実現可能性の評価を含める**

## 🔍 機能要件の品質基準
### 網羅性（Comprehensiveness）
- ユーザージャーニーの全段階をカバー
- 全データエンティティのCRUD操作を含む
- 全ユーザーロールの機能を網羅
- 運用・保守機能も含める

### 排他性（Exclusivity）
- 機能間の重複を排除
- 各機能の責務を明確に分離
- 境界線を明確に定義

### 具体性（Specificity）
- 測定可能な受け入れ基準
- 明確なユーザーストーリー
- 具体的な使用ケース

### 実現性（Feasibility）
- 技術的実現可能性を考慮
- 既存システムとの整合性
- リソース制約を考慮
`;
    }
    async analyzeRequirements(userRequest, projectId, techStackAnalysis) {
        this.info('📋 要件分析開始');
        const kugutsuDir = path.join(this.baseRepoPath, '.kugutsu');
        const analysisPath = path.join(kugutsuDir, 'requirements-analysis.json');
        // 既存の分析結果をチェック
        try {
            await fs.access(analysisPath);
            const existingContent = await fs.readFile(analysisPath, 'utf-8');
            const existingResult = JSON.parse(existingContent);
            // ユーザー要求が同じかチェック
            if (existingResult.userRequestSummary === userRequest) {
                this.info('📋 既存の要件分析を使用します');
                return existingResult;
            }
            this.info('🔄 新しいユーザー要求を検出。要件分析を更新します');
        }
        catch {
            this.info('🆕 新規要件分析を実行します');
        }
        const prompt = await this.buildAnalysisPrompt(userRequest, projectId, techStackAnalysis);
        this.info('🔄 RequirementsAnalyzerAI query開始');
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
        this.info('🔄 RequirementsAnalyzerAI query完了');
        // 分析結果を読み込み
        this.info('📄 分析結果を読み込み中...');
        const result = await this.loadAnalysisResult(analysisPath);
        this.info(`✅ 要件分析完了: ${result.functionalRequirements?.features?.length || 0}個の機能要件`);
        return result;
    }
    async buildAnalysisPrompt(userRequest, projectId, techStackAnalysis) {
        return `ユーザー要求を詳細に分析して要件を明確化してください。

## 📝 ユーザー要求
${userRequest}

## 🔍 技術スタック情報
- プロジェクトタイプ: ${techStackAnalysis.projectType}
- 主要言語: ${techStackAnalysis.primaryLanguages?.join(', ') || 'N/A'}
- フレームワーク: ${techStackAnalysis.frameworks?.join(', ') || 'N/A'}
- アーキテクチャ: ${techStackAnalysis.architecturePattern}

## 📋 分析タスク（MECE原則適用）
1. **ユーザー要求の本質的な目的と期待成果を理解**
2. **機能要件のMECE分析**：
   - 網羅性チェック：5つの観点から体系的に洗い出し
   - 排他性チェック：機能の重複を排除
   - 検証チェックリスト：7項目の確認
3. **非機能要件（パフォーマンス、セキュリティ等）を抽出**
4. **技術スタックとの適合性を考慮した技術要件を定義**
5. **制約条件と受け入れ基準を明確化**
6. **実現可能性とリスクを評価**

## 🔍 機能要件分析の実行手順
### Step 1: 初期機能洗い出し
ユーザー要求から明示的な機能を抽出

### Step 2: 網羅性チェック（5つの観点）
1. **ユーザージャーニー全体**から不足機能を特定
2. **CRUD操作**の完全性を確認
3. **ユーザーロール別機能**の網羅性確認
4. **データフロー別機能**の完全性確認
5. **運用・保守機能**の必要性確認

### Step 3: 排他性チェック
- 機能の重複を排除
- 責務の明確化
- 境界線の定義

### Step 4: 検証チェックリスト実行
7項目のチェックリストで最終確認

### Step 5: 機能要件の最終整理
MECEに整理された機能要件リストを作成

## 📊 成果物作成（重要）
分析完了後、以下の手順でJSONファイルを作成してください：

### ステップ1: ディレクトリ作成
1. LS toolで.kugutsuディレクトリの存在を確認
2. 存在しない場合はWrite toolで.kugutsu/dummy.txtを作成してディレクトリを確保

### ステップ2: JSONファイル作成
1. **必ずWrite toolを使用**して.kugutsu/requirements-analysis.jsonファイルを作成
2. 以下の正確なJSONスキーマに従って作成：

\`\`\`json
{
  "userRequestSummary": "ユーザー要求の要約文",
  "functionalRequirements": {
    "userStories": ["具体的なユーザーストーリー"],
    "useCases": ["詳細な使用ケース"],
    "businessRules": ["適用されるビジネスルール"],
    "features": ["実装すべき機能のリスト"]
  },
  "nonFunctionalRequirements": {
    "performance": ["パフォーマンス要件"],
    "security": ["セキュリティ要件"],
    "usability": ["使いやすさ要件"],
    "reliability": ["信頼性要件"],
    "scalability": ["拡張性要件"]
  },
  "technicalRequirements": {
    "integrationPoints": ["外部システム統合ポイント"],
    "dataRequirements": ["データ要件"],
    "apiRequirements": ["API要件"],
    "uiRequirements": ["UI/UX要件"]
  },
  "constraints": {
    "technical": ["技術的制約"],
    "business": ["ビジネス制約"],
    "timeline": ["時間制約"],
    "resources": ["リソース制約"]
  },
  "acceptanceCriteria": ["明確な受け入れ基準"],
  "riskAssessment": ["リスク評価項目"],
  "priority": "high",
  "estimatedComplexity": "medium"
}
\`\`\`

### ステップ3: 検証
Read toolでファイルが正しく作成されたことを確認

**重要**: featuresプロパティは必須です。空の配列でも構いませんが、必ず含めてください。

プロジェクトID: ${projectId}

## 🎯 分析のポイント
- 既存の技術スタック（${techStackAnalysis.frameworks?.join(', ') || 'N/A'}）との整合性を重視
- 実装の「何を」に集中し、「どのように」は言及しない
- 明確で測定可能な受け入れ基準を設定
- 技術的実現可能性を考慮した要件定義
`;
    }
    async loadAnalysisResult(analysisPath) {
        try {
            const content = await fs.readFile(analysisPath, 'utf-8');
            const result = JSON.parse(content);
            // 必須プロパティの存在確認と修復
            if (!result.functionalRequirements) {
                result.functionalRequirements = {
                    userStories: [],
                    useCases: [],
                    businessRules: [],
                    features: []
                };
            }
            if (!result.acceptanceCriteria) {
                result.acceptanceCriteria = [];
            }
            if (!result.estimatedComplexity) {
                result.estimatedComplexity = 'medium';
            }
            if (!result.priority) {
                result.priority = 'medium';
            }
            return result;
        }
        catch (error) {
            // ファイルが存在しない、または形式が不正な場合のフォールバック
            this.warn(`要件分析結果の読み込みに失敗、デフォルト値を使用: ${error}`);
            return this.getDefaultAnalysisResult();
        }
    }
    getDefaultAnalysisResult() {
        return {
            userRequestSummary: "分析中のユーザー要求",
            functionalRequirements: {
                userStories: [],
                useCases: [],
                businessRules: [],
                features: []
            },
            nonFunctionalRequirements: {
                performance: [],
                security: [],
                usability: [],
                reliability: [],
                scalability: []
            },
            technicalRequirements: {
                integrationPoints: [],
                dataRequirements: [],
                apiRequirements: [],
                uiRequirements: []
            },
            constraints: {
                technical: [],
                business: [],
                timeline: [],
                resources: []
            },
            acceptanceCriteria: [],
            riskAssessment: [],
            priority: 'medium',
            estimatedComplexity: 'medium'
        };
    }
}
//# sourceMappingURL=RequirementsAnalyzerAI.js.map