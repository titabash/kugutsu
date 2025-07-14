import { query, type SDKMessage } from "@anthropic-ai/claude-code";
import { Task, TaskAnalysisResult, AgentConfig, PhaseDocument, ProjectPhase } from '../types/index.js';
import { TaskInstructionManager } from '../utils/TaskInstructionManager.js';
import { v4 as uuidv4 } from 'uuid';
import { BaseAI } from './BaseAI.js';
import { ComponentType } from '../types/logging.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { designDocTemplate } from '../templates/design-doc-template.js';

/**
 * 単一技術スタックの情報
 */
interface SingleTechStack {
  language: string;
  framework?: string;
  buildTool?: string;
  configFiles: string[];
  path: string; // モノレポでのサブディレクトリパス（デフォルト: '.'）
}

/**
 * プロジェクト全体の技術スタック情報（複数言語対応）
 */
interface TechStackInfo {
  stacks: SingleTechStack[];
  isMonorepo: boolean;
}

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
      allowedTools: ["Read", "Glob", "Grep", "LS", "Write", "WebSearch", "WebFetch", "TodoWrite", "TodoRead"],
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
   * 技術スタック情報のファイルパスを取得
   */
  private getTechStackPath(): string {
    return path.join(this.getKugutsuDir(), 'tech-stack.md');
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
ユーザからの開発要求を分析し、**完全に動作するアプリケーションの実現に必要なすべての機能要件を網羅的に洗い出す責任**を負います。

## 🎯 核心責務
- **要件定義**: ユーザー要求を完全なアプリケーションに必要な機能要件に変換
- **網羅的分析**: アプリケーションとして動作するために必要なすべての要素を特定
- **Design Docs作成**: 新規アプリ・システム開発時に設計ドキュメントを作成
- **タスク分割**: 機能要件を実装可能なタスクに分割
- **完成責任**: すべてのタスク完了時にユーザーが実際に使用可能なアプリケーションが完成することを保証
- **品質基準**: 実用レベルの品質要件を定義

**重要**: 個別機能の技術選択はエンジニアAIが判断しますが、アプリケーション全体の動作保証とシステム統合要件の定義はプロダクトオーナーの責任です。

## 🔒 ファイル書き込み制限
**重要**: Writeツールの使用は.kugutsuディレクトリ内のファイルのみに制限されています。
- 許可: .kugutsu/phase-*.json, .kugutsu/implementation-notes-*.md, .kugutsu/design-doc-*.md 等
- 禁止: プロジェクトのソースコード、設定ファイル、その他全てのファイル

## 🔧 網羅的分析アプローチ
### 1. ユーザー要求の完全理解
- ユーザー要求の本質的なニーズを理解し、機能要件に変換
- ビジネス価値と期待される成果を明確化
- 成功基準と受け入れ条件を定義

### 2. アプリケーション完成要件の体系的分析
アプリケーションとして動作するために必要なすべての要素を以下の観点から分析：

#### 🏗️ アーキテクチャ層の網羅的確認
- **プレゼンテーション層**: UI/UX、ルーティング、状態管理、フォーム処理
- **ビジネスロジック層**: 業務ルール、データ処理、統合ロジック
- **データアクセス層**: データベース操作、外部API連携、ファイル操作
- **インフラ層**: 認証、セキュリティ、ログ、設定管理、デプロイ

#### 🔄 ユーザージャーニーの完全カバー
- **初回アクセス**: 初期画面、オンボーディング、初期設定
- **認証フロー**: ログイン、ログアウト、パスワード管理、権限制御
- **主要機能利用**: コア機能の操作、データ入力・編集・削除、検索・フィルタ
- **エラー処理**: 通信エラー、バリデーションエラー、権限エラー対応
- **システム運用**: データバックアップ、ログ管理、監視

#### 🌐 クロスカット関心事の確認
- **セキュリティ**: 認証、認可、入力検証、XSS/CSRF対策
- **パフォーマンス**: レスポンス最適化、キャッシュ、遅延読み込み
- **ユーザビリティ**: レスポンシブデザイン、アクセシビリティ、多言語対応
- **運用保守**: ログ記録、エラー監視、設定管理、更新機能

### 3. 機能要件の階層化と統合設計
- システム基盤機能（認証、ルーティング、状態管理等）の優先実装
- コア業務機能の段階的実装
- 統合機能（データフロー、UI統合、エラーハンドリング）の確実な実装
- 運用機能（設定、ログ、監視等）の完備

### 4. タスク設計の原則
- エンジニアが自律的に実装できる明確な要件定義
- システム統合を考慮したタスク間連携の設計
- アプリケーション完成に向けた段階的実装計画

## 🚀 網羅的タスク洗い出し指針
### タスク粒度の基本原則
- **システム完結性**: すべてのタスクが完了した時に動作するアプリケーションが完成
- **機能完結性**: 各タスクが独立して価値を提供
- **要件明確性**: エンジニアが迷わず実装できる明確な要件
- **統合保証**: 分割されたタスクが統合され完全なシステムとして動作

### 🎯 必須タスクカテゴリの網羅確認
分析時に以下のカテゴリから必要なタスクが抜け落ちていないか確認：

#### 📱 システム基盤タスク
- **アプリケーション初期化**: プロジェクト構造、設定ファイル、起動スクリプト
- **ルーティング設定**: 画面遷移、URL設計、404ページ、権限によるルート制御
- **状態管理基盤**: グローバル状態、ローカル状態、永続化、状態更新フロー
- **認証認可基盤**: ログイン・ログアウト機能、セッション管理、権限制御
- **共通UI基盤**: レイアウト、ナビゲーション、共通コンポーネント、テーマ設定

#### 🎨 ユーザーインターフェースタスク
- **画面設計実装**: 各画面のUI実装、レスポンシブデザイン、アニメーション
- **フォーム機能**: 入力フォーム、バリデーション、エラー表示、送信処理
- **データ表示**: 一覧表示、詳細表示、検索・フィルタ、ページネーション
- **ユーザビリティ**: ローディング表示、エラーハンドリング、空状態表示

#### 🔧 ビジネスロジックタスク
- **コア機能実装**: 要求された主要機能の業務ロジック
- **データ処理**: CRUD操作、計算処理、データ変換、集計処理
- **統合処理**: 複数機能間の連携、ワークフロー、データ同期

#### 💾 データ管理タスク
- **データモデル設計**: データベーススキーマ、エンティティ関係設計
- **データアクセス**: データベース接続、クエリ実装、トランザクション管理
- **外部連携**: API連携、ファイル操作、外部サービス統合

#### 🔒 セキュリティタスク
- **認証セキュリティ**: パスワード暗号化、JWT管理、セッション管理
- **入力検証**: サーバーサイドバリデーション、SQLインジェクション対策
- **セキュリティ設定**: CORS設定、XSS対策、CSRF対策

#### 🚀 システム運用タスク
- **エラーハンドリング**: 例外処理、エラーログ、ユーザーへのエラー通知
- **ログ管理**: アクセスログ、エラーログ、監査ログ
- **設定管理**: 環境変数、設定ファイル、開発・本番環境切り替え
- **デプロイ準備**: ビルド設定、起動スクリプト、環境セットアップ手順

### 要件定義型タスクの具体例
**✅ 良い例（完全性重視）**：
- 「ユーザー認証システム: 登録・ログイン・ログアウト・権限管理・セッション管理の完全実装」
- 「商品管理機能: 一覧・詳細・登録・編集・削除・検索・在庫管理の統合実装」
- 「アプリケーション基盤: ルーティング・状態管理・共通レイアウト・エラーハンドリングの設定」

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
      prompt = await this.buildContinuationPrompt(userRequest, existingDoc, sessionId);
    } else {
      // projectsdirを作成
      const projectsDir = path.join(this.getKugutsuDir(), 'projects', projectId);
      await fs.mkdir(projectsDir, { recursive: true });
      prompt = await this.buildAnalysisPrompt(userRequest, projectId, sessionId);
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
      const result = await this.extractTaskAnalysisResultFromFile(projectId);
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
   * 技術スタック情報を保存
   */
  private async saveTechStackInfo(techStackInfo: TechStackInfo): Promise<void> {
    await this.initializeKugutsuDir();
    const techStackPath = this.getTechStackPath();
    
    const techStackData = {
      ...techStackInfo,
      analyzedAt: new Date(),
      version: '1.0'
    };
    
    await fs.writeFile(techStackPath, JSON.stringify(techStackData, null, 2), 'utf-8');
    this.success(`✅ 技術スタック情報を保存しました: ${path.relative(this.baseRepoPath, techStackPath)}`);
  }

  /**
   * 既存の技術スタック情報を読み込み
   */
  private async loadTechStackInfo(): Promise<TechStackInfo | null> {
    const techStackPath = this.getTechStackPath();
    try {
      const content = await fs.readFile(techStackPath, 'utf-8');
      const techStackData = JSON.parse(content);
      this.info(`📖 既存の技術スタック情報を読み込みました`);
      return {
        stacks: techStackData.stacks || [],
        isMonorepo: techStackData.isMonorepo || false
      };
    } catch {
      return null;
    }
  }

  /**
   * AIによるプロジェクト変更検出
   */
  private async detectProjectChanges(): Promise<boolean> {
    try {
      // 既存の技術スタック情報の存在チェック
      const techStackPath = this.getTechStackPath();
      try {
        const existingContent = await fs.readFile(techStackPath, 'utf-8');
        // 基本的には既存ファイルがあれば変更なしと見なす
        // より精密な変更検出が必要な場合は、ファイルの更新日時等で判定
        this.info('📋 既存の技術スタック分析ファイルを確認');
        return false;
      } catch {
        // ファイルが存在しない場合は新規分析が必要
        this.info('📝 技術スタック分析ファイルが見つからないため新規分析を実行');
        return true;
      }
    } catch (error) {
      this.warn('変更検出中にエラーが発生しました', { error });
      return true; // エラー時は安全のため再分析
    }
  }

  /**
   * AIによる技術スタック分析
   */
  private async analyzeTechStack(): Promise<void> {
    const techStackPath = this.getTechStackPath();
    
    // 既存ファイルをチェック
    try {
      await fs.access(techStackPath);
      this.info('📋 既存の技術スタック分析ファイルが存在します');
      
      // プロジェクト構造の変更を検出
      const hasChanged = await this.detectProjectChanges();
      if (!hasChanged) {
        this.info('📋 プロジェクト構造に変更なし。既存の技術スタック分析を使用します');
        return;
      }
      this.info('🔄 プロジェクト構造の変更を検出しました。技術スタックを再分析します');
    } catch {
      this.info('📝 新規技術スタック分析を実行します');
    }

    this.info('🔍 AIによる技術スタック分析を開始します...');
    
    // AIに分析を依頼（直接ファイル保存）
    await this.analyzeProjectWithAI();
    
    this.info('✅ AI分析完了: 技術スタックファイルを保存しました');
  }

  /**
   * AIによる技術スタック分析用のディレクトリ情報を収集
   */
  private async gatherProjectStructure(): Promise<string> {
    try {
      const entries = await fs.readdir(this.baseRepoPath, { withFileTypes: true });
      const structure: string[] = [];
      
      // ルートレベルのファイルとディレクトリを分析
      const files = entries.filter(e => e.isFile()).map(e => e.name);
      const dirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules').map(e => e.name);
      
      structure.push('## プロジェクト構造分析');
      structure.push('### ルートディレクトリのファイル:');
      structure.push(files.join(', '));
      structure.push('### サブディレクトリ:');
      structure.push(dirs.join(', '));
      
      // 各サブディレクトリの内容も軽く調査
      for (const dir of dirs.slice(0, 10)) { // 最大10個まで
        try {
          const subPath = path.join(this.baseRepoPath, dir);
          const subEntries = await fs.readdir(subPath, { withFileTypes: true });
          const subFiles = subEntries.filter(e => e.isFile()).map(e => e.name);
          structure.push(`### ${dir}/: ${subFiles.slice(0, 5).join(', ')}${subFiles.length > 5 ? '...' : ''}`);
        } catch {
          // サブディレクトリにアクセスできない場合は無視
        }
      }
      
      return structure.join('\n');
    } catch (error) {
      this.warn('プロジェクト構造分析中にエラーが発生しました', { error });
      return '## プロジェクト構造分析\n分析に失敗しました';
    }
  }

  /**
   * AIに技術スタック分析を依頼
   */
  private async analyzeProjectWithAI(): Promise<void> {
    const projectStructure = await this.gatherProjectStructure();
    const techStackPath = this.getTechStackPath();
    
    const analysisPrompt = `プロジェクト構造を分析して技術スタック情報を特定し、Markdownファイルとして保存してください。

${projectStructure}

以下のタスクを実行してください：

1. プロジェクト構造を分析して技術スタックを特定
2. 以下の形式でMarkdownファイルを作成し、${techStackPath} に保存

## 技術スタック分析

### プロジェクトタイプ
- モノレポか否か
- 主要な技術スタック

### 検出された技術スタック
各技術スタックについて：
- 言語
- フレームワーク（あれば）
- ビルドツール
- 設定ファイル
- パス（モノレポの場合）
- 確信度

### 判断根拠
- 分析の根拠を簡潔に説明

重要：
- ファイル名からパターン推測（package.json→Node.js/TypeScript、pyproject.toml→Python等）
- 複数言語がある場合は全て特定
- 分析できない場合でも最低限の情報で回答
- 必ずWriteツールを使用してファイルを作成してください`;

    for await (const message of query({
      prompt: analysisPrompt,
      abortController: new AbortController(),
      options: {
        maxTurns: 5,
        cwd: this.baseRepoPath,
        allowedTools: ["Read", "Glob", "LS", "Write"],
      },
    })) {
      // メッセージ処理は不要（AIが直接ファイル保存）
    }
  }

  /**
   * 技術スタックMarkdownファイルを読み込み
   */
  private async loadTechStackMarkdown(): Promise<string> {
    const techStackPath = this.getTechStackPath();
    try {
      const content = await fs.readFile(techStackPath, 'utf-8');
      return content;
    } catch {
      return '### 技術スタック\n技術スタック分析ファイルが見つかりませんでした。';
    }
  }

  /**
   * 技術スタック情報をフォーマット（複数言語対応）
   */
  private formatTechStack(techStackInfo: TechStackInfo): string {
    if (techStackInfo.stacks.length === 0) {
      return '- プロジェクト: 技術スタックが検出されませんでした';
    }

    const parts: string[] = [];
    
    if (techStackInfo.isMonorepo) {
      parts.push('- プロジェクト構成: モノレポ（複数言語）');
      parts.push('');
      
      techStackInfo.stacks.forEach((stack, index) => {
        parts.push(`### 技術スタック ${index + 1}: ${stack.path}`);
        parts.push(`- 言語: ${stack.language}`);
        if (stack.framework) parts.push(`- フレームワーク: ${stack.framework}`);
        if (stack.buildTool) parts.push(`- ビルドツール: ${stack.buildTool}`);
        parts.push(`- 設定ファイル: ${stack.configFiles.join(', ')}`);
        parts.push('');
      });
    } else {
      // 単一技術スタック
      const stack = techStackInfo.stacks[0];
      parts.push(`- 言語: ${stack.language}`);
      if (stack.framework) parts.push(`- フレームワーク: ${stack.framework}`);
      if (stack.buildTool) parts.push(`- ビルドツール: ${stack.buildTool}`);
      parts.push(`- 設定ファイル: ${stack.configFiles.join(', ')}`);
    }
    
    return parts.join('\n');
  }

  /**
   * コンテキスト適応戦略を構築
   */
  private buildContextStrategy(techStackInfo: TechStackInfo): string {
    if (techStackInfo.isMonorepo) {
      const languages = techStackInfo.stacks.map(s => s.language).join('、');
      const configFiles = techStackInfo.stacks.flatMap(s => s.configFiles).join('、');
      return `- マルチ言語環境（${languages}）での統合性を重視した設計
- 各技術スタックの特性を活かした最適化
- モノレポ構成（${configFiles}）に適合した統一的なアーキテクチャ
- 言語間連携とデータフローの整合性確保`;
    } else {
      const stack = techStackInfo.stacks[0];
      return `- 既存の技術選択（${stack.language}${stack.framework ? ` + ${stack.framework}` : ''}）との整合性を最優先
- プロジェクトの構成ファイル（${stack.configFiles.join(', ')}）に適合した設計
- 既存の依存関係を活用した効率的な実装`;
    }
  }

  /**
   * 技術スタックの要約を取得
   */
  private getTechStackSummary(techStackInfo: TechStackInfo): string {
    if (techStackInfo.isMonorepo) {
      const languages = techStackInfo.stacks.map(s => s.language).join('・');
      return `マルチ言語環境（${languages}）`;
    } else {
      const stack = techStackInfo.stacks[0];
      return stack.language + (stack.framework ? `・${stack.framework}` : '');
    }
  }

  /**
   * コンテキスト認識プロンプトを構築
   */
  private async buildContextAwarePrompt(userRequest: string, projectId: string, sessionId?: string): Promise<string> {
    // 技術スタック分析
    await this.analyzeTechStack();
    
    // 技術スタック情報をファイルから読み取り
    const techStackContent = await this.loadTechStackMarkdown();
    
    return `
プロダクトオーナーとして、以下の情報を踏まえてユーザー要求を分析し、エンジニアチームに対する具体的な実装指示を策定してください：

## 📝 ユーザー要求
${userRequest}

## 🔍 プロジェクトコンテキスト
${techStackContent}

## 🔍 分析プロセス

### 1. ユーザー要求の理解
- 要求の本質的な目的と期待される成果を理解
- 潜在的なニーズや制約条件を考慮
- 既存の技術スタックとの適合性を評価

### 2. 機能要件の整理
- 要求を具体的な機能要件に変換
- 既存のアーキテクチャに適合する統合方法を検討
- ユーザーにとっての価値と完成状態を定義

### 3. タスク設計
- 現在の技術環境に最適化された実装アプローチを選択
- 各作業を適切な粒度のタスクに分割
- タスク間の依存関係を明確化

## 🎯 タスク分割戦略

### 基本方針
- **技術適合性**: プロジェクトの技術スタックに最適化されたタスク設計
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
- **技術要件**: プロジェクト環境での実装方針
- **品質要件**: パフォーマンス・セキュリティ・使いやすさ基準
- **統合要件**: 他機能・外部システムとの連携要件
- **受け入れ基準**: 完成判定の具体的基準

**重要**: 実装手順・詳細な技術選択・アーキテクチャはエンジニアが決定します。プロダクトオーナーは要件定義に専念してください。

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

3. **Design Docs（新規アプリ・システム開発時のみ）**: .kugutsu/design-doc-{プロジェクトID}.md
   - システム全体の設計ドキュメント
   - アーキテクチャ概要と設計判断の根拠
   - システムの技術仕様と統合方針
   - **重要**: 新規アプリ・システム開発と判断した場合は必ず作成してください

### 📝 新規アプリ・システム開発の判断基準
以下のいずれかに該当する場合は「新規アプリ・システム開発」と判断し、Design Docsを作成してください：
- 新しいアプリケーションをゼロから作成する要求
- 既存システムの大規模リニューアル・リアーキテクチャ
- 新しいサービス・プロダクトの開発
- 独立したマイクロサービスの新規構築
- 複数の機能を持つ統合システムの開発

**注意**: 単なる機能追加、バグ修正、小規模な改善の場合はDesign Docsは不要です。

### 📄 Design Docsテンプレート
新規アプリ・システム開発時は、以下のテンプレート構造に従ってDesign Docsを作成してください：

\`\`\`markdown
${designDocTemplate}
\`\`\`

**重要**: 各セクションにはAIエンジニアが実装に必要な具体的な情報を記載してください。特に、画面設計（サイトマップ）、API設計、命名規則、共通コンポーネントなどは、チーム全体の規律を保つために詳細に定義することが重要です。

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
  "techStack": "技術スタック情報は上記のMarkdownを参照",
  "analysis": {
    "userRequestAnalysis": "ユーザー要求の詳細分析",
    "codebaseAssessment": "現在のコードベースの評価",
    "technicalRequirements": "技術要件の詳細（既存技術スタックとの整合性を考慮）",
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
   * 分析用プロンプトを構築
   */
  private async buildAnalysisPrompt(userRequest: string, projectId: string, sessionId?: string): Promise<string> {
    // コンテキスト認識プロンプトを使用
    return this.buildContextAwarePrompt(userRequest, projectId, sessionId);
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
  private async extractTaskAnalysisResultFromFile(projectId: string): Promise<TaskAnalysisResult> {
    const analysisPath = this.getAnalysisJsonPath(projectId);

    try {
      // ファイルが存在するか確認
      await fs.access(analysisPath);

      const content = await fs.readFile(analysisPath, 'utf-8');
      const jsonData = JSON.parse(content);

      this.info(`📄 分析結果JSONを読み込み: ${jsonData.tasks?.length || 0}個のタスク`);

      // タスクを変換（タイトル→IDのマッピングを作成）
      const titleToIdMap = new Map<string, string>();
      const tasks: Task[] = (jsonData.tasks || []).map((taskData: any) => {
        const description = this.buildTaskDescription(taskData);
        const taskId = uuidv4();
        
        // タイトル→IDのマッピングを保存
        titleToIdMap.set(taskData.title || 'タスク', taskId);

        return {
          id: taskId,
          type: taskData.type || 'feature',
          title: taskData.title || 'タスク',
          description: description,
          priority: taskData.priority || 'medium',
          status: 'pending',
          dependencies: taskData.dependencies || [], // 一旦タイトルのまま保存
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
      
      // 依存関係をタイトルからIDに変換
      tasks.forEach(task => {
        this.info(`🔗 タスク依存関係処理: ${task.title}`);
        this.info(`  - 元の依存関係: ${task.dependencies.join(', ') || 'なし'}`);
        
        task.dependencies = task.dependencies.map(depTitle => {
          const depId = titleToIdMap.get(depTitle);
          if (!depId) {
            this.warn(`⚠️ 依存タスク "${depTitle}" が見つかりません`);
            return depTitle; // 見つからない場合はタイトルのまま（後でエラーになる）
          }
          this.info(`  - "${depTitle}" → ${depId}`);
          return depId;
        });
        
        this.info(`  - 変換後の依存関係: ${task.dependencies.join(', ') || 'なし'}`);
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
   * 継続実行用のプロンプトを構築
   */
  private async buildContinuationPrompt(userRequest: string, existingDoc: PhaseDocument, sessionId?: string): Promise<string> {
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

1. **コミット履歴から実装状況を確認**：
   - git logコマンドで最近のコミットを確認
   - 各コミットメッセージから実装済み機能を特定
   - 実装されたファイルと機能の関連性を把握

2. **コードベース実装状況**：
   - 各フェーズのタスクが実際に実装されているかの詳細確認
   - 実装済み機能の動作状況・品質レベルの評価
   - 未完成・部分実装の機能の特定

3. **既に完了したタスクの除外**：
   - コミット履歴から判明した実装済みタスクは再度実行しない
   - 部分的に実装されているタスクは未実装部分のみを抽出
   - 完全に新規のタスクのみをタスクリストに含める

4. **技術的負債・課題の洗い出し**：
   - 既存実装の技術的問題点の特定
   - パフォーマンス・セキュリティ課題の確認
   - リファクタリングが必要な箇所の特定

5. **システム完成度評価**：
   - 現在の実装でユーザーが実際に使用可能な機能範囲
   - デプロイ可能性・動作安定性の評価
   - 完成までに必要な残作業の正確な見積もり

6. **次フェーズの適応判断**：
   - 当初計画と現実の実装状況の差異分析
   - 技術的発見・制約による計画変更の必要性判断
   - 優先度・スコープの再評価

## 🔄 重要：重複タスクの防止
**重要**: 既に実装済みの機能を再度タスクとして出力しないでください。
- git logやコードベースの確認により、既に実装されている機能を正確に把握
- 同じプロジェクトIDで過去に実行されたタスクは、その実装状況を確認
- 未実装または部分実装の機能のみを新規タスクとして出力

## 🔄 フェーズ内容の更新
実装状況や新たな発見に基づいて、必要に応じて以下を更新してください：
- 今後のフェーズの内容やタスク構成
- 各フェーズの説明や目的
- 見積もり時間や優先度

これらの更新はプロジェクトの進化に合わせて柔軟に対応し、より適切な実装計画に調整してください。

## 📋 実行すべきタスク
実装状況の確認結果に基づいて、現在実行すべきフェーズのタスクを出力してください。
フェーズ内容を更新した場合は、"phaseManagement"セクションで更新内容も含めて出力してください。

${(await this.buildAnalysisPrompt(userRequest, existingDoc.projectId, sessionId)).split('## 📊 最終成果物要求')[1]}`;
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
