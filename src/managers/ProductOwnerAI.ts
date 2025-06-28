import { query, type SDKMessage } from "@anthropic-ai/claude-code";
import { Task, TaskAnalysisResult, AgentConfig, PhaseDocument, ProjectPhase } from '../types/index.js';
import { TaskInstructionManager } from '../utils/TaskInstructionManager.js';
import { v4 as uuidv4 } from 'uuid';
import { BaseAI } from './BaseAI.js';
import { ComponentType } from '../types/logging.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';

/**
 * プロダクトオーナーAIクラス
 * ユーザからの要求を分析し、具体的なタスクに分割する
 */
export class ProductOwnerAI extends BaseAI {
  private readonly config: AgentConfig;
  private readonly baseRepoPath: string;

  constructor(baseRepoPath: string, config?: Partial<AgentConfig>) {
    super();
    this.baseRepoPath = baseRepoPath;
    this.config = {
      systemPrompt: this.getDefaultSystemPrompt(),
      maxTurns: 10,
      allowedTools: ["Read", "Glob", "Grep", "LS", "Write"],
      ...config
    };
  }

  /**
   * .kugutsuディレクトリのパスを取得
   */
  private getKugutsuDir(): string {
    return path.join(this.baseRepoPath, '.kugutsu');
  }

  /**
   * フェーズドキュメントのファイルパスを取得
   */
  private getPhaseDocumentPath(projectId: string): string {
    return path.join(this.getKugutsuDir(), `phase-${projectId}.json`);
  }

  /**
   * 分析結果のJSONファイルパスを取得
   */
  private getAnalysisJsonPath(projectId: string): string {
    return path.join(this.getKugutsuDir(), 'projects', projectId, 'analysis.json');
  }

  /**
   * プロジェクトIDを生成（ユーザーリクエストから一意のIDを生成）
   */
  private generateProjectId(userRequest: string): string {
    // ユーザーリクエストからMD5ハッシュを生成（同じリクエストは同じIDになる）
    return createHash('md5').update(userRequest).digest('hex').substring(0, 8);
  }

  /**
   * .kugutsuディレクトリを初期化
   */
  private async initializeKugutsuDir(): Promise<void> {
    const kugutsuDir = this.getKugutsuDir();
    try {
      await fs.access(kugutsuDir);
    } catch {
      await fs.mkdir(kugutsuDir, { recursive: true });
      this.info('📁 .kugutsuディレクトリを作成しました');
    }
  }

  /**
   * 既存のフェーズドキュメントを読み込む
   */
  private async loadPhaseDocument(projectId: string): Promise<PhaseDocument | null> {
    const docPath = this.getPhaseDocumentPath(projectId);
    try {
      const content = await fs.readFile(docPath, 'utf-8');
      const doc = JSON.parse(content) as PhaseDocument;
      this.success(`✅ 既存のフェーズドキュメントを読み込みました (フェーズ ${doc.currentPhaseIndex + 1}/${doc.phases.length})`);
      return doc;
    } catch {
      return null;
    }
  }

  /**
   * フェーズドキュメントを保存
   */
  private async savePhaseDocument(doc: PhaseDocument): Promise<void> {
    await this.initializeKugutsuDir();
    const docPath = this.getPhaseDocumentPath(doc.projectId);
    await fs.writeFile(docPath, JSON.stringify(doc, null, 2), 'utf-8');
    this.success(`✅ フェーズドキュメントを保存しました: ${path.relative(this.baseRepoPath, docPath)}`);
  }

  protected getComponentType(): ComponentType {
    return 'ProductOwner';
  }

  protected getId(): string {
    return 'ProductOwner';
  }

  /**
   * デフォルトのシステムプロンプト
   */
  private getDefaultSystemPrompt(): string {
    return `あなたは経験豊富なプロダクトオーナー兼エンジニアリングマネージャーです。
ユーザからの開発要求を分析し、**ユーザが求めるすべての機能を実用可能なレベルまで完成させる責任**を負います。

## 🎯 核心責務
- **要件定義**: ユーザー要求を明確な機能要件に変換
- **タスク分割**: 機能要件を実装可能なタスクに分割
- **完成責任**: すべてのタスク完了時にユーザー要求が満たされることを保証
- **品質基準**: 実用レベルの品質要件を定義

**重要**: 技術的実現可能性・実装難易度・技術選択はエンジニアAIが判断します。

## 🔒 ファイル書き込み制限
**重要**: Writeツールの使用は.kugutsuディレクトリ内のファイルのみに制限されています。
- 許可: .kugutsu/phase-*.json, .kugutsu/implementation-notes-*.md 等
- 禁止: プロジェクトのソースコード、設定ファイル、その他全てのファイル

## 🔧 分析アプローチ
### 1. 要求理解と要件定義
- ユーザー要求の本質的なニーズを理解し、機能要件に変換
- ビジネス価値と期待される成果を明確化
- 成功基準と受け入れ条件を定義

### 2. 機能分割戦略
- 要求機能を完結した機能単位に分割
- 各機能の価値提供と統合方法を設計
- ユーザーにとっての機能完成状態を定義

### 3. タスク設計
- 機能要件を実装可能なタスクに分割
- エンジニアが自律的に実装できる明確な要件定義
- システム統合を考慮したタスク間連携の設計

## 🚀 並列開発指針
### タスク粒度の基本原則
- **機能完結性**: 各タスクが独立して価値を提供
- **要件明確性**: エンジニアが迷わず実装できる明確な要件
- **統合保証**: 分割されたタスクが統合され完全なシステムとして動作

### 要件定義型タスクの具体例
**✅ 良い例（機能要件重視）**：
- 「ユーザー認証機能: 安全なログイン・ログアウト・アカウント管理を実現」
- 「商品管理機能: 管理者による商品の登録・編集・削除・検索を実現」

**❌ 避けるべき例（実装詳細含む）**：
- 「Prismaスキーマの作成とマイグレーション実行」
- 「React Hookを使ったログイン画面の作成」

## 📋 エンジニアへの要件定義品質
各タスクに必須の要素：
- **機能要件**: ユーザーが何をできるようになるかの具体的定義
- **品質要件**: 実用レベルのパフォーマンス・安全性・使いやすさ基準
- **受け入れ条件**: 機能完成の具体的判定基準
- **システム統合要件**: 他機能との連携・統合時の要件
- **制約条件**: ビジネス上の制約・法規制要件の明示

**重要**: 技術選択・実装方法・アーキテクチャ・実現可能性はエンジニアが決定します。`;
  }

  /**
   * ユーザからの要求を分析してタスクに分割し、指示ファイルを作成
   */
  async analyzeUserRequestWithInstructions(
    userRequest: string,
    instructionManager?: TaskInstructionManager
  ): Promise<TaskAnalysisResult> {
    this.info('🧠 要求分析開始');

    // プロジェクトIDを生成し、既存のフェーズドキュメントを確認
    const projectId = this.generateProjectId(userRequest);
    const existingDoc = await this.loadPhaseDocument(projectId);

    // instructionManagerが渡されていない場合は作成
    let localInstructionManager = instructionManager;
    if (!localInstructionManager) {
      localInstructionManager = new TaskInstructionManager(this.baseRepoPath, projectId);
    }
    
    // セッションIDを取得
    const sessionId = localInstructionManager.sessionId;

    let prompt: string;
    if (existingDoc) {
      // 既存のフェーズドキュメントがある場合は続きから実行
      prompt = this.buildContinuationPrompt(userRequest, existingDoc, sessionId);
    } else {
      // projectsdirを作成
      const projectsDir = path.join(this.getKugutsuDir(), 'projects', projectId);
      await fs.mkdir(projectsDir, { recursive: true });
      prompt = this.buildAnalysisPrompt(userRequest, projectId, sessionId);
    }

    try {
      const messages: SDKMessage[] = [];
      let fullAnalysis = '';

      for await (const message of query({
        prompt,
        abortController: new AbortController(),
        options: {
          maxTurns: this.config.maxTurns,
          cwd: this.baseRepoPath,
          allowedTools: ["Read", "Glob", "Grep", "LS", "Write"],
        },
      })) {
        messages.push(message);

        // リアルタイムでプロダクトオーナーAIの思考過程を表示
        if (message && typeof message === 'object' && 'type' in message) {
          const analysisText = this.displayMessageActivity(message as any);
          if (analysisText) {
            fullAnalysis += analysisText + '\n';
          }
        }
      }

      // タスクを解析・作成
      const result = await this.extractTaskAnalysisResultFromFile(projectId, messages);
      result.projectId = projectId; // プロジェクトIDを結果に含める
      result.sessionId = sessionId; // セッションIDを結果に含める

      // フェーズ管理の処理
      const phaseInfo = await this.extractPhaseInfoFromFile(projectId);

      if (phaseInfo && !existingDoc) {
        // 新規プロジェクトの場合のみフェーズドキュメントを作成
        const doc = await this.createOrUpdatePhaseDocument(projectId, userRequest, phaseInfo, result, existingDoc);
        await this.savePhaseDocument(doc);

        // 現在のフェーズ情報をログ出力
        const currentPhase = doc.phases[doc.currentPhaseIndex];
        this.info(`📊 現在のフェーズ: ${currentPhase.phaseName} (${currentPhase.currentPhase}/${currentPhase.totalPhases})`);
        this.info(`📝 フェーズの説明: ${currentPhase.description}`);
      } else if (existingDoc) {
        // 既存プロジェクトの場合
        // ProductOwnerAIが実装状況を確認して現在のフェーズを判断
        const currentPhaseInfo = this.extractCurrentPhaseFromAnalysis(messages);
        if (currentPhaseInfo && currentPhaseInfo.phaseNumber) {
          // フェーズの進捗を更新
          const newPhaseIndex = currentPhaseInfo.phaseNumber - 1;
          if (newPhaseIndex !== existingDoc.currentPhaseIndex) {
            existingDoc.currentPhaseIndex = newPhaseIndex;
            existingDoc.updatedAt = new Date();
            await this.savePhaseDocument(existingDoc);
            this.success(`✅ フェーズを更新しました: フェーズ ${newPhaseIndex + 1}`);
          }
        }

        // フェーズ情報の更新があれば反映
        const updatedPhaseInfo = await this.extractPhaseInfoFromFile(projectId);
        if (updatedPhaseInfo && updatedPhaseInfo.phases) {
          // 既存のフェーズ情報を更新
          await this.updatePhaseDocument(existingDoc, updatedPhaseInfo, result);
          this.info('🔄 フェーズ情報を更新しました');
        }

        const currentPhase = existingDoc.phases[existingDoc.currentPhaseIndex];
        this.info(`📊 現在のフェーズ: ${currentPhase.phaseName} (${currentPhase.currentPhase}/${currentPhase.totalPhases})`);
      }

      // 概要ファイルを作成
      await localInstructionManager.createOverviewFile(userRequest, fullAnalysis);

      // 各タスクの詳細指示ファイルを作成
      for (const task of result.tasks) {
        const detailedInstructions = await this.generateDetailedInstructions(task, userRequest, fullAnalysis);
        await localInstructionManager.createTaskInstructionFile(task, detailedInstructions);
      }

      // 依存関係ファイルを作成
      await localInstructionManager.createDependencyFile(result.tasks);

      this.success('✅ 分析完了 & 指示ファイル作成完了');
      return result;

    } catch (error) {
      this.error('❌ 分析エラー', { error: error instanceof Error ? error.message : String(error) });
      throw error; // エラーをそのまま伝播
    }
  }

  /**
   * メッセージアクティビティを表示
   */
  private displayMessageActivity(message: any): string | null {
    const messageType = message.type;
    let analysisText = '';

    switch (messageType) {
      case 'user':
        // ユーザーメッセージ（入力）
        if (message.message && message.message.content) {
          for (const content of message.message.content) {
            if (content.type === 'text') {
              this.info(`📝 入力受信 - ${this.truncateText(content.text, 100)}`);
            }
          }
        }
        break;

      case 'assistant':
        // アシスタントメッセージ（出力・思考）
        if (message.message && message.message.content) {
          for (const content of message.message.content) {
            if (content.type === 'text') {
              const text = content.text;
              this.info(`💭 ${this.truncateText(text, 200)}`);
              analysisText += text;
            } else if (content.type === 'tool_use') {
              const toolName = content.name;
              const toolId = content.id;
              const toolInput = content.input || {};
              const toolExecutionId = this.logToolExecution(toolName, `ツール実行`);
              this.displayToolExecutionDetails(toolName, toolInput, toolId, toolExecutionId);
            }
          }
        }
        break;

      case 'tool_result':
        // ツール実行結果
        if (message.content) {
          for (const content of message.content) {
            if (content.type === 'tool_result') {
              const toolUseId = content.tool_use_id;
              const isError = content.is_error;
              const status = isError ? '❌ エラー' : '✅ 成功';
              const result = content.content;

              this.info(`📊 ツール結果 - ${status}`);

              if (isError) {
                this.error(`   ❌ エラー詳細: ${this.truncateText(String(result), 150)}`);
              } else {
                this.displayToolResult(result, toolUseId, '');
              }
            }
          }
        }
        break;

      case 'error':
        // エラーメッセージ
        this.error(`❌ エラーが発生しました`);
        if (message.error) {
          this.error(`   ❌ エラー: ${this.truncateText(String(message.error), 200)}`);
        }
        break;

      case 'system':
        // システムメッセージ
        this.info(`⚙️ システム通知`);
        if (message.content) {
          this.info(`   📋 内容: ${this.truncateText(String(message.content), 150)}`);
        }
        break;

      case 'thinking':
        // 思考過程（内部処理）
        this.info(`🤔 分析中...`);
        break;

      case 'event':
        // イベント通知
        if (message.event_type) {
          this.info(`📢 イベント - ${message.event_type}`);
        }
        break;

      case 'result':
        // 旧形式の結果メッセージ（後方互換性）
        analysisText += (message as any).result || '';
        break;

      default:
        // 未知のメッセージタイプ
        this.warn(`🔍 未知のメッセージタイプ - ${messageType}`);
        break;
    }

    return analysisText || null;
  }

  /**
   * ツール実行の詳細を表示
   */
  private displayToolExecutionDetails(toolName: string, toolInput: any, _toolId: string, toolExecutionId: string): void {
    switch (toolName) {
      case 'Read':
        this.logToolResult(`   📖 ファイル読み取り: ${toolInput.file_path || 'パス不明'}`, toolExecutionId, toolName);
        break;

      case 'Glob':
        this.logToolResult(`   🔍 ファイル検索: ${toolInput.pattern || 'パターン不明'}`, toolExecutionId, toolName);
        if (toolInput.path) {
          this.logToolResult(`   📁 検索パス: ${toolInput.path}`, toolExecutionId, toolName);
        }
        break;

      case 'Grep':
        this.logToolResult(`   🔎 内容検索: ${toolInput.pattern || 'パターン不明'}`, toolExecutionId, toolName);
        if (toolInput.include) {
          this.logToolResult(`   📂 対象ファイル: ${toolInput.include}`, toolExecutionId, toolName);
        }
        break;

      case 'LS':
        this.logToolResult(`   📂 ディレクトリ一覧: ${toolInput.path || 'パス不明'}`, toolExecutionId, toolName);
        break;

      default:
        this.logToolResult(`   ⚙️  パラメータ: ${JSON.stringify(toolInput).substring(0, 100)}...`, toolExecutionId, toolName);
        break;
    }
  }

  /**
   * ツール実行結果を表示
   */
  private displayToolResult(result: any, _toolId: string, toolExecutionId: string): void {
    if (typeof result === 'string') {
      const lines = result.split('\n');
      const lineCount = lines.length;

      if (lineCount === 1) {
        this.logToolResult(`   ✅ 結果: ${this.truncateText(result, 100)}`, toolExecutionId);
      } else if (lineCount <= 5) {
        this.logToolResult(`   ✅ 結果: ${lineCount}行の出力`, toolExecutionId);
        lines.forEach(line => {
          if (line.trim()) {
            this.logToolResult(`   │ ${this.truncateText(line, 80)}`, toolExecutionId);
          }
        });
      } else {
        this.logToolResult(`   ✅ 結果: ${lineCount}行の出力（抜粋）`, toolExecutionId);
        lines.slice(0, 3).forEach(line => {
          if (line.trim()) {
            this.logToolResult(`   │ ${this.truncateText(line, 80)}`, toolExecutionId);
          }
        });
        this.logToolResult(`   │ ... (他${lineCount - 3}行)`, toolExecutionId);
      }
    } else if (typeof result === 'object' && result !== null) {
      this.logToolResult(`   ✅ 結果: オブジェクト形式`, toolExecutionId);
      const preview = JSON.stringify(result, null, 2);
      this.logToolResult(`   │ ${this.truncateText(preview, 150)}`, toolExecutionId);
    } else {
      this.logToolResult(`   ✅ 結果: ${String(result)}`, toolExecutionId);
    }
  }

  /**
   * テキストを指定された長さで切り詰める
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }

  /**
   * 分析用プロンプトを構築
   */
  private buildAnalysisPrompt(userRequest: string, projectId: string, sessionId?: string): string {
    return `
プロダクトオーナーとして、以下のユーザー要求を包括的に分析し、エンジニアチームに対する具体的な実装指示を策定してください：

## 📝 ユーザー要求
${userRequest}

## 🔍 分析プロセス

### 1. ユーザー要求の理解
- 要求の本質的な目的と期待される成果を理解
- 潜在的なニーズや制約条件を考慮
- プロジェクトのコンテキストと優先順位を把握

### 2. 機能要件の整理
- 要求を具体的な機能要件に変換
- 機能間の関係性と統合方法を検討
- ユーザーにとっての価値と完成状態を定義

### 3. タスク設計
- 要求を実現するために必要な作業を洗い出し
- 各作業を適切な粒度のタスクに分割
- タスク間の依存関係を明確化

## 🎯 タスク分割戦略

### 基本方針
- **機能完結性**: 各タスクが明確な価値を提供し独立して完成可能
- **要件明確性**: エンジニアが迷わず実装できる明確な機能要件  
- **統合保証**: 分割されたタスクが統合され完全なシステムとして動作

### 開発規模別戦略
- **大規模（アプリ0→完成）**: 機能完結型タスク
- **中規模（機能追加）**: 機能単位タスク  
- **小規模（バグ修正・改善）**: 細かい粒度タスク

### タスクの必須要素
各タスクに以下を含める：
- **機能要件**: ユーザーができるようになることの明確な定義
- **品質要件**: パフォーマンス・セキュリティ・使いやすさ基準
- **統合要件**: 他機能・外部システムとの連携要件
- **受け入れ基準**: 完成判定の具体的基準

**重要**: 実装手順・技術選択・アーキテクチャはエンジニアが決定します。

## 📊 フェーズ管理とドキュメント作成

### 🗂️ 必須ドキュメント作成
分析完了後、以下のファイルを.kugutsuディレクトリに作成してください：

1. **フェーズドキュメント**: .kugutsu/phase-{プロジェクトID}.json
   - プロジェクトの全体構成とフェーズ情報
   - 現在のフェーズ状況と進捗管理
   - 次回実行時の継続に必要な情報

2. **要件仕様書**: .kugutsu/requirements-{プロジェクトID}.md
   - 各フェーズの機能要件と品質要件の詳細
   - ビジネスルールと制約条件
   - 次回実行時に要件を理解するための重要な情報

### 📋 継続実行対応
- 既存の.kugutsuディレクトリファイルを確認し、継続実行かを判断
- 継続実行の場合は実装状況を分析し、適切なフェーズから開始
- 新規の場合は最初のフェーズから開始

## 📊 最終成果物要求

分析が完了したら、以下のJSON形式で結果を Writeツールを使って保存してください。

保存先ファイル: ${this.getAnalysisJsonPath(projectId)}

重要: Writeツールを使用して、上記のファイルパスに以下の形式のJSONを保存してください：

\`\`\`json
{
  "sessionId": "${sessionId || ''}",
  "analysis": {
    "userRequestAnalysis": "ユーザー要求の詳細分析",
    "codebaseAssessment": "現在のコードベースの評価",
    "technicalRequirements": "技術要件の詳細",
    "architecturalDecisions": "設計判断と根拠"
  },
  "tasks": [
    {
      "id": "一意のタスクID（UUIDまたは短いハッシュ値）",
      "title": "明確で具体的なタスクタイトル",
      "description": "実装すべき機能の詳細説明",
      "type": "feature|bugfix|documentation|test|refactoring",
      "priority": "high|medium|low",
      "skillRequirements": ["必要なスキルレベル"],
      "functionalRequirements": {
        "userStories": ["ユーザーストーリー: ユーザーが何をできるようになるか"],
        "useCases": ["具体的な使用シナリオ"],
        "businessRules": ["ビジネスルールと制約条件"]
      },
      "qualityRequirements": {
        "usability": ["使いやすさ要件（UX、アクセシビリティ等）"],
        "security": ["セキュリティ要件（認証、認可、データ保護等）"]
      },
      "integrationRequirements": {
        "externalSystems": ["外部システムとの連携要件"],
        "internalModules": ["内部モジュールとの連携要件"],
        "dataFlow": ["データフローと整合性要件"]
      },
      "dependencies": ["依存するタスクのタイトル（循環依存を避ける）"],
      "acceptanceCriteria": ["具体的な受け入れ基準（What、Whyを明確に）"],
      "constraints": ["技術的制約、法規制、予算制約等"],
      "successMetrics": ["成功を測定するための具体的な指標"]
    }
  ],
  "summary": "プロジェクト全体の概要と実装戦略",
  "riskAssessment": {
    "risks": ["特定されたリスク"],
    "mitigations": ["リスク軽減策"]
  },
  "parallelizationStrategy": "並列開発の戦略と効果"
}
\`\`\`

## 📊 フェーズ管理

大規模な開発の場合、以下の情報を含めてフェーズに分割してください：

\`\`\`json
{
  "phaseManagement": {
    "requiresPhases": true,
    "totalPhases": 3,
    "phases": [
      {
        "phaseNumber": 1,
        "phaseName": "基盤構築フェーズ",
        "description": "認証システムの基盤となるモデルとAPIエンドポイントの実装",
        "tasks": ["タスク1のタイトル", "タスク2のタイトル"],
      }
    ]
  }
}
\`\`\`

### 🔄 フェーズ情報の動的更新
フェーズ情報は\`.kugutsu\`ディレクトリに保存されますが、以下の場合には積極的に更新してください：
- 実装状況の確認結果、当初の想定と異なる場合
- 新たな技術的課題や機会が発見された場合
- ユーザー要求の変化や明確化があった場合
- 依存関係や優先度の見直しが必要な場合

これにより、プロジェクトの進化に合わせた柔軟な計画変更が可能になります。

### タスクタイプ別指針
- **feature**: 開発規模に応じて粒度調整（大規模→機能完結型、小規模→細かい粒度）
- **bugfix**: 常に細かい粒度で迅速修正
- **test/documentation**: 細かい粒度で実装
- **refactoring**: 中程度の粒度

### 依存関係設計
- **循環依存の完全回避**: タスク間で循環参照を絶対に作らない
- **階層的依存**: 基盤機能 → 応用機能 → 統合の一方向フロー
- **依存最小化**: 可能な限り独立したタスク設計で並列開発を最大化`;
  }

  /**
   * タスクデータから詳細な説明を構築
   */
  private buildTaskDescription(taskData: any): string {
    let description = taskData.description || 'タスクの説明';

    // 機能要件がある場合は追加
    if (taskData.functionalRequirements) {
      description += '\n\n## 📋 機能要件';
      if (taskData.functionalRequirements.userStories) {
        description += '\n### ユーザーストーリー';
        taskData.functionalRequirements.userStories.forEach((story: string) => {
          description += `\n- ${story}`;
        });
      }
      if (taskData.functionalRequirements.useCases) {
        description += '\n### 使用シナリオ';
        taskData.functionalRequirements.useCases.forEach((useCase: string) => {
          description += `\n- ${useCase}`;
        });
      }
      if (taskData.functionalRequirements.businessRules) {
        description += '\n### ビジネスルール';
        taskData.functionalRequirements.businessRules.forEach((rule: string) => {
          description += `\n- ${rule}`;
        });
      }
    }

    // 品質要件がある場合は追加
    if (taskData.qualityRequirements) {
      description += '\n\n## 🎯 品質要件';
      if (taskData.qualityRequirements.usability) {
        description += '\n### 使いやすさ要件';
        taskData.qualityRequirements.usability.forEach((req: string) => {
          description += `\n- ${req}`;
        });
      }
      if (taskData.qualityRequirements.security) {
        description += '\n### セキュリティ要件';
        taskData.qualityRequirements.security.forEach((req: string) => {
          description += `\n- ${req}`;
        });
      }
    }

    // 統合要件がある場合は追加
    if (taskData.integrationRequirements) {
      description += '\n\n## 🔗 統合要件';
      if (taskData.integrationRequirements.externalSystems) {
        description += '\n### 外部システム連携';
        taskData.integrationRequirements.externalSystems.forEach((req: string) => {
          description += `\n- ${req}`;
        });
      }
      if (taskData.integrationRequirements.internalModules) {
        description += '\n### 内部モジュール連携';
        taskData.integrationRequirements.internalModules.forEach((req: string) => {
          description += `\n- ${req}`;
        });
      }
      if (taskData.integrationRequirements.dataFlow) {
        description += '\n### データフロー';
        taskData.integrationRequirements.dataFlow.forEach((req: string) => {
          description += `\n- ${req}`;
        });
      }
    }

    // 受け入れ基準がある場合は追加
    if (taskData.acceptanceCriteria) {
      description += '\n\n## ✅ 受け入れ基準';
      taskData.acceptanceCriteria.forEach((criteria: string) => {
        description += `\n- ${criteria}`;
      });
    }

    // スキル要件がある場合は追加
    if (taskData.skillRequirements) {
      description += '\n\n## 👨‍💻 必要スキル';
      description += `\n- ${taskData.skillRequirements.join(', ')}`;
    }


    return description;
  }

  /**
   * タスクの詳細指示を生成
   */
  private async generateDetailedInstructions(task: Task, userRequest: string, analysis: string): Promise<string> {
    // シンプルで明確な指示書を生成
    return `
# タスク: ${task.title}

## ユーザー要求
${userRequest}

## このタスクの要件
${task.description}

## プロダクトオーナーによる分析
${analysis}

## 実装における方針
- 上記の要件を満たすための最適な実装方法を選択してください
- 既存のコードベースとの整合性を保ってください  
- 技術選択、アーキテクチャ設計、ファイル構成はあなたが決定してください
- セキュリティ、パフォーマンス、保守性を考慮した実装を行ってください
`;
  }

  /**
   * 保存されたJSONファイルからタスク分析結果を抽出
   */
  private async extractTaskAnalysisResultFromFile(projectId: string, messages: SDKMessage[]): Promise<TaskAnalysisResult> {
    const analysisPath = this.getAnalysisJsonPath(projectId);

    try {
      // ファイルが存在するか確認
      await fs.access(analysisPath);

      const content = await fs.readFile(analysisPath, 'utf-8');
      const jsonData = JSON.parse(content);

      this.info(`📄 分析結果JSONを読み込み: ${jsonData.tasks?.length || 0}個のタスク`);

      // タスクを変換
      const tasks: Task[] = (jsonData.tasks || []).map((taskData: any) => {
        const description = this.buildTaskDescription(taskData);

        return {
          id: uuidv4(),
          type: taskData.type || 'feature',
          title: taskData.title || 'タスク',
          description: description,
          priority: taskData.priority || 'medium',
          status: 'pending',
          dependencies: taskData.dependencies || [],
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {
            skillRequirements: taskData.skillRequirements,
            functionalRequirements: taskData.functionalRequirements,
            qualityRequirements: taskData.qualityRequirements,
            integrationRequirements: taskData.integrationRequirements,
            acceptanceCriteria: taskData.acceptanceCriteria,
            constraints: taskData.constraints,
            successMetrics: taskData.successMetrics
          }
        };
      });

      if (tasks.length > 0) {
        const analysis = jsonData.analysis || {};
        const riskAssessment = typeof jsonData.riskAssessment === 'object'
          ? `リスク: ${(jsonData.riskAssessment.risks || []).join(', ')}\n軽減策: ${(jsonData.riskAssessment.mitigations || []).join(', ')}`
          : jsonData.riskAssessment || 'リスク評価なし';

        return {
          tasks,
          summary: jsonData.summary || analysis.userRequestAnalysis || 'プロダクトオーナーAIによる分析結果',
          riskAssessment: riskAssessment,
          analysisDetails: {
            codebaseAssessment: analysis.codebaseAssessment,
            technicalRequirements: analysis.technicalRequirements,
            architecturalDecisions: analysis.architecturalDecisions,
            parallelizationStrategy: jsonData.parallelizationStrategy
          }
        };
      }

      throw new Error('タスクが見つかりませんでした');

    } catch (error) {
      this.error('❌ 分析結果JSONファイルが見つかりません', {
        error: error instanceof Error ? error.message : String(error),
        path: analysisPath
      });

      // デバッグ情報を追加
      const projectDir = path.dirname(analysisPath);
      try {
        const files = await fs.readdir(projectDir);
        this.info('📁 プロジェクトディレクトリの内容:', { files });
      } catch (e) {
        this.error('❌ プロジェクトディレクトリが存在しません', { projectDir });
      }

      throw new Error(`タスク分析結果ファイルが作成されませんでした: ${analysisPath}`);
    }
  }

  /**
   * Claude Code SDKの応答からタスク分析結果を抽出（フォールバック）
   */
  private extractTaskAnalysisResult(_messages: SDKMessage[]): TaskAnalysisResult {
    // 全ての分析メッセージから結果を抽出
    let fullAnalysisText = '';

    for (const message of _messages) {
      if (message && typeof message === 'object' && 'type' in message) {
        if (message.type === 'assistant' && 'message' in message) {
          const assistantMessage = message.message as any;
          if (assistantMessage.content) {
            for (const content of assistantMessage.content) {
              if (content.type === 'text') {
                fullAnalysisText += content.text + '\n';
              }
            }
          }
        } else if (message.type === 'result') {
          fullAnalysisText += (message as any).result || '';
        }
      }
    }

    // JSONブロックを抽出（最後のものを優先）
    const jsonMatches = [...fullAnalysisText.matchAll(/```json\s*([\s\S]*?)\s*```/g)];

    if (jsonMatches.length > 0) {
      // 最後のJSONブロックを使用
      const lastJsonMatch = jsonMatches[jsonMatches.length - 1];
      try {
        const jsonData = JSON.parse(lastJsonMatch[1]);

        this.info(`📋 JSONタスクリストを検出: ${jsonData.tasks?.length || 0}個のタスク`);

        // 新しいフォーマットと旧フォーマットの両方をサポート
        const tasks: Task[] = (jsonData.tasks || []).map((taskData: any) => {
          // 詳細な指示情報を含む拡張タスクを作成
          const description = this.buildTaskDescription(taskData);

          return {
            id: uuidv4(),
            type: taskData.type || 'feature',
            title: taskData.title || 'タスク',
            description: description,
            priority: taskData.priority || 'medium',
            status: 'pending',
            dependencies: taskData.dependencies || [],
            createdAt: new Date(),
            updatedAt: new Date(),
            // 要件情報をメタデータとして保存
            metadata: {
              skillRequirements: taskData.skillRequirements,
              functionalRequirements: taskData.functionalRequirements,
              qualityRequirements: taskData.qualityRequirements,
              integrationRequirements: taskData.integrationRequirements,
              acceptanceCriteria: taskData.acceptanceCriteria,
              constraints: taskData.constraints,
              successMetrics: taskData.successMetrics
            }
          };
        });


        if (tasks.length > 0) {
          // 新しいフォーマットの分析情報を統合
          const analysis = jsonData.analysis || {};
          const riskAssessment = typeof jsonData.riskAssessment === 'object'
            ? `リスク: ${(jsonData.riskAssessment.risks || []).join(', ')}\n軽減策: ${(jsonData.riskAssessment.mitigations || []).join(', ')}`
            : jsonData.riskAssessment || 'リスク評価なし';

          return {
            tasks,
            summary: jsonData.summary || analysis.userRequestAnalysis || 'プロダクトオーナーAIによる分析結果',
            riskAssessment: riskAssessment,
            // 拡張分析情報
            analysisDetails: {
              codebaseAssessment: analysis.codebaseAssessment,
              technicalRequirements: analysis.technicalRequirements,
              architecturalDecisions: analysis.architecturalDecisions,
              parallelizationStrategy: jsonData.parallelizationStrategy
            }
          };
        }

      } catch (error) {
        this.error('❌ JSON解析エラー', { error: error instanceof Error ? error.message : String(error) });
        this.error('❌ 問題のあるJSON', { json: lastJsonMatch[1] });
        throw new Error(`タスク分析結果のJSON解析に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // JSON形式の分析結果が見つからない場合はエラー
    this.error('❌ JSON形式の分析結果が見つかりませんでした');
    throw new Error('プロダクトオーナーAIがJSON形式でタスクリストを出力できませんでした。分析結果の形式を確認してください。');
  }

  /**
   * タスクの依存関係を解決して実行順序を決定
   */
  resolveDependencies(tasks: Task[]): Task[] {
    const resolved: Task[] = [];
    const remaining = [...tasks];

    while (remaining.length > 0) {
      const before = remaining.length;

      for (let i = remaining.length - 1; i >= 0; i--) {
        const task = remaining[i];

        // 依存関係がすべて解決されているかチェック
        const dependenciesResolved = task.dependencies.every(depTitle =>
          resolved.some(resolvedTask => resolvedTask.title === depTitle)
        );

        if (dependenciesResolved) {
          resolved.push(task);
          remaining.splice(i, 1);
        }
      }

      // 循環依存のチェック
      if (remaining.length === before && remaining.length > 0) {
        // 詳細な循環依存情報をログ出力
        const cyclicTasks = remaining.map(task => ({
          title: task.title,
          dependencies: task.dependencies
        }));

        this.warn('⚠️ 循環依存が検出されました。詳細:');
        cyclicTasks.forEach(task => {
          this.warn(`   - "${task.title}" → 依存: [${task.dependencies.join(', ')}]`);
        });

        // 依存関係を無視して残タスクを追加
        const tasksWithoutDeps = remaining.map(task => ({
          ...task,
          dependencies: [] // 循環依存を解消
        }));

        resolved.push(...tasksWithoutDeps);
        this.info('📝 循環依存を解消して続行します');
        break;
      }
    }

    return resolved;
  }

  /**
   * 継続実行用のプロンプトを構築
   */
  private buildContinuationPrompt(userRequest: string, existingDoc: PhaseDocument, sessionId?: string): string {
    const allPhaseDescriptions = existingDoc.phases.map((phase, idx) =>
      `${idx + 1}. ${phase.phaseName}: ${phase.description}`
    ).join('\n');

    return `
プロダクトオーナーとして、フェーズ管理されたプロジェクトの続きを実行します。

## 📝 元のユーザー要求
${userRequest}

## 📊 プロジェクトのフェーズ構成
${allPhaseDescriptions}

## 🔍 徹底的な実装状況分析

### 📋 必須調査項目
以下を必ず確認し、現在の状況を正確に把握してください：

1. **コードベース実装状況**：
   - 各フェーズのタスクが実際に実装されているかの詳細確認
   - 実装済み機能の動作状況・品質レベルの評価
   - 未完成・部分実装の機能の特定

2. **技術的負債・課題の洗い出し**：
   - 既存実装の技術的問題点の特定
   - パフォーマンス・セキュリティ課題の確認
   - リファクタリングが必要な箇所の特定

3. **システム完成度評価**：
   - 現在の実装でユーザーが実際に使用可能な機能範囲
   - デプロイ可能性・動作安定性の評価
   - 完成までに必要な残作業の正確な見積もり

4. **次フェーズの適応判断**：
   - 当初計画と現実の実装状況の差異分析
   - 技術的発見・制約による計画変更の必要性判断
   - 優先度・スコープの再評価

## 🔄 フェーズ内容の更新
実装状況や新たな発見に基づいて、必要に応じて以下を更新してください：
- 今後のフェーズの内容やタスク構成
- 各フェーズの説明や目的
- 見積もり時間や優先度

これらの更新はプロジェクトの進化に合わせて柔軟に対応し、より適切な実装計画に調整してください。

## 📋 実行すべきタスク
実装状況の確認結果に基づいて、現在実行すべきフェーズのタスクを出力してください。
フェーズ内容を更新した場合は、"phaseManagement"セクションで更新内容も含めて出力してください。

${this.buildAnalysisPrompt(userRequest, existingDoc.projectId, sessionId).split('## 📊 最終成果物要求')[1]}`;
  }

  /**
   * JSONファイルからフェーズ情報を抽出
   */
  private async extractPhaseInfoFromFile(projectId: string): Promise<any | null> {
    const analysisPath = this.getAnalysisJsonPath(projectId);

    try {
      const content = await fs.readFile(analysisPath, 'utf-8');
      const jsonData = JSON.parse(content);

      if (jsonData.phaseManagement && jsonData.phaseManagement.requiresPhases) {
        this.info('📊 フェーズ管理が必要と判断されました');
        return jsonData.phaseManagement;
      }
    } catch (error) {
      // ファイルがまだ存在しないか、フェーズ情報がない
    }

    return null;
  }

  /**
   * メッセージからフェーズ情報を抽出（フォールバック）
   */
  private extractPhaseInfo(_messages: SDKMessage[]): any | null {
    let fullText = '';

    for (const message of _messages) {
      if (message && typeof message === 'object' && 'type' in message) {
        if (message.type === 'assistant' && 'message' in message) {
          const assistantMessage = message.message as any;
          if (assistantMessage.content) {
            for (const content of assistantMessage.content) {
              if (content.type === 'text') {
                fullText += content.text + '\n';
              }
            }
          }
        }
      }
    }

    // フェーズ管理のJSONブロックを探す - より堅牢な方法
    const jsonBlocks = [...fullText.matchAll(/```json\s*([\s\S]*?)\s*```/g)];

    for (const jsonBlock of jsonBlocks.reverse()) { // 最後から検索
      try {
        const jsonData = JSON.parse(jsonBlock[1]);
        if (jsonData.phaseManagement && jsonData.phaseManagement.requiresPhases) {
          this.info('📊 フェーズ管理が必要と判断されました');
          return jsonData.phaseManagement;
        }
      } catch (error) {
        // このJSONブロックは無効、次を試す
        continue;
      }
    }

    // 代替手段: "phaseManagement"キーワードで検索
    if (fullText.includes('"phaseManagement"') && fullText.includes('"requiresPhases"')) {
      this.warn('⚠️ フェーズ情報は存在しますが、JSON解析に失敗しました');
    }

    return null;
  }

  /**
   * 分析結果から現在のフェーズを抽出
   */
  private extractCurrentPhaseFromAnalysis(_messages: SDKMessage[]): { phaseNumber: number } | null {
    let fullText = '';

    for (const message of _messages) {
      if (message && typeof message === 'object' && 'type' in message) {
        if (message.type === 'assistant' && 'message' in message) {
          const assistantMessage = message.message as any;
          if (assistantMessage.content) {
            for (const content of assistantMessage.content) {
              if (content.type === 'text') {
                fullText += content.text + '\n';
              }
            }
          }
        }
      }
    }

    // 「現在のフェーズ」「実装状況」「フェーズX」などのパターンを探す
    const phasePatterns = [
      /現在のフェーズ[\s：:]*フェーズ(\d+)/,
      /フェーズ(\d+)[\sの]*実装が完了/,
      /フェーズ(\d+)[\sの]*タスクを実装/,
      /実装状況[\s：:]*フェーズ(\d+)/
    ];

    for (const pattern of phasePatterns) {
      const match = fullText.match(pattern);
      if (match && match[1]) {
        const phaseNumber = parseInt(match[1]);
        this.info(`🔍 ProductOwnerAIがフェーズ ${phaseNumber} を検出しました`);
        return { phaseNumber };
      }
    }

    return null;
  }

  /**
   * フェーズドキュメントを作成または更新
   */
  private async createOrUpdatePhaseDocument(
    projectId: string,
    userRequest: string,
    phaseInfo: any,
    result: TaskAnalysisResult,
    existingDoc: PhaseDocument | null
  ): Promise<PhaseDocument> {
    if (existingDoc) {
      // 既存ドキュメントの場合はそのまま返す（更新は markTasksCompleted で行う）
      return existingDoc;
    } else {
      // 新規ドキュメントの作成
      const phases: ProjectPhase[] = phaseInfo.phases.map((p: any, index: number) => ({
        currentPhase: p.phaseNumber || index + 1,
        totalPhases: phaseInfo.totalPhases,
        phaseName: p.phaseName,
        description: p.description,
        completedTasks: [],
        remainingTasks: p.phaseNumber === 1 ? result.tasks : [],
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      return {
        projectId,
        userRequest,
        phases,
        currentPhaseIndex: 0,
        analysis: {
          summary: result.summary,
          technicalStrategy: result.analysisDetails?.architecturalDecisions || '',
          riskAssessment: result.riskAssessment
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
  }

  /**
   * 既存のフェーズドキュメントを更新
   */
  private async updatePhaseDocument(
    existingDoc: PhaseDocument,
    updatedPhaseInfo: any,
    result: TaskAnalysisResult
  ): Promise<void> {
    // フェーズ情報の更新
    if (updatedPhaseInfo.phases) {
      for (const updatedPhase of updatedPhaseInfo.phases) {
        const phaseIndex = (updatedPhase.phaseNumber || 1) - 1;
        if (phaseIndex < existingDoc.phases.length) {
          const phase = existingDoc.phases[phaseIndex];
          // フェーズ情報を更新
          phase.phaseName = updatedPhase.phaseName || phase.phaseName;
          phase.description = updatedPhase.description || phase.description;
          phase.updatedAt = new Date();

          // 現在のフェーズの場合はタスクも更新
          if (phaseIndex === existingDoc.currentPhaseIndex) {
            phase.remainingTasks = result.tasks;
          }
        }
      }
    }

    // 分析情報の更新
    if (result.analysisDetails) {
      existingDoc.analysis.technicalStrategy = result.analysisDetails.architecturalDecisions || existingDoc.analysis.technicalStrategy;
      existingDoc.analysis.riskAssessment = result.riskAssessment || existingDoc.analysis.riskAssessment;
    }

    existingDoc.updatedAt = new Date();
    await this.savePhaseDocument(existingDoc);
  }
}
