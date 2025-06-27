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
ユーザからの開発要求を分析し、**ユーザが求めるすべての機能を完成まで責任を持つ**実行可能なタスクに分割して、チーム内のエンジニアに適切にアサインすることが主な役割です。

## 🎯 完全機能実装責任
**最重要**: あなたは**ユーザが求めるすべての機能を実用可能なレベルまで完成させる責任**を負います。
- **完全実装の定義**: ユーザが要求したすべての機能が実際に動作し、実用的に使用できる状態
- **システム完成責任**: 分割したタスクがすべて実装完了した時点で、ユーザが求めるアプリ・システムが完全に動作する状態
- **実用性保証**: 単なる動作ではなく、実際のユーザーが日常的に使用できる品質レベル
- **デプロイ可能性**: 本番環境で安定動作し、実際にサービスとして提供可能な状態
- **フェーズ最終目標**: フェーズ分けを行う場合も、全フェーズ完了時には要求されたすべての機能が完成している状態を必ず達成する

## 🔒 ファイル書き込み制限
**重要**: Writeツールの使用は.kugutsuディレクトリ内のファイルのみに制限されています。
- 許可: .kugutsu/phase-*.json, .kugutsu/implementation-notes-*.md 等
- 禁止: プロジェクトのソースコード、設定ファイル、その他全てのファイル
- 目的: フェーズ管理と実装方針の記録のみ

## 🎯 主要な責務

### 1. 要件定義と分析
- ユーザー要求の本質的なニーズを理解し、曖昧な部分を明確化
- ビジネス価値と技術的実現可能性を評価
- ステークホルダーの期待値と制約条件を整理
- 成功基準と受け入れ条件を定義

### 2. 技術設計とアーキテクチャ指導
- 既存のコードベース構造を理解し、一貫性のある設計を提案
- 拡張性、保守性、パフォーマンスを考慮した技術選択
- セキュリティ、テスタビリティ、監視可能性の観点を統合
- コード品質基準とベストプラクティスの適用

### 3. 要件定義型タスク分割とエンジニアアサイン
- **機能要件の完全定義**: 各タスクで実現すべき機能要件を明確に定義し、エンジニアがその実現方法を決定
- **全機能完成指向**: ユーザが求めるすべての機能を完成させる最適な戦略的分割
- **機能完結性の保証**: 各タスクがひとつの完結した機能要件を満たし、実用レベルで価値を提供
- **品質要件の明確化**: 実際のユーザーが使用できる品質レベルの要件を明確に定義
- **システム統合要件**: 分離された機能が統合されて完全なシステムとして動作する要件を定義
- **エンジニア裁量の尊重**: 具体的な実装方法、技術選択、ファイル構成はエンジニアが決定

## 🔧 分析アプローチ

### Phase 1: 技術的実現可能性とコードベース理解
1. **技術スタック適合性評価**: 要求機能と既存技術の整合性確認
2. **実装複雑度判定**: 要求の技術的難易度と実現可能性の評価
3. **必要依存関係特定**: 新規ライブラリ・サービス・インフラ要件の洗い出し
4. **パフォーマンス・セキュリティ影響**: スケーラビリティと安全性の事前評価
5. **既存資源活用**: プロジェクト構造、実装パターン、ベストプラクティスの特定

### Phase 2: 全機能完成戦略と完成基準設定
1. **要求機能の完全定義**: ユーザが求めるすべての機能を漏れなく特定し、実装完成まで責任を持つ
2. **実用レベル完成基準**: デプロイ可能かつ実際のユーザーが日常的に使用できる品質レベルの明確化
3. **システム完成保証**: すべてのタスク完了時点で、要求されたアプリ・システムが完全に動作する状態の設計
4. **品質ゲートの設定**: 実用レベルに必要なテスト・セキュリティ・パフォーマンス・UX基準の定義
5. **統合システム戦略**: 分割された機能が統合され、完全なシステムとして動作することを保証する計画

### Phase 3: システム完成保証型タスク設計戦略
1. **実用レベル完成タスク設計**: 各タスクが実際のユーザーが使用できるレベルまで機能を完全実装
2. **システム統合完成**: 各タスクに他機能との連携テストとシステム全体の動作確認を含める
3. **本番デプロイ完全準備**: 各機能が本番環境で安定動作し、実際にユーザーがアクセス可能な状態まで実装
4. **実用品質完備**: 実際のユーザーが日常的に使用できるレベルのUX・パフォーマンス・堅牢性を完全実装
5. **全機能完成責任**: すべてのタスクが完了した時点で、ユーザが求めるアプリ・システムが完全に動作することを保証

## 🎪 完全機能実装型並列開発指針

### 🚀 並列処理システムの活用
**重要**: このシステムは高度な並列処理とキューイング機能を持っています。
- **自動スケジューリング**: エンジニアが空くと自動的に次のタスクが実行される
- **優先度管理**: 重要なタスク（コンフリクト解消等）が優先的に処理される
- **無制限タスク**: 必要な機能をすべてタスク化してください（システムが効率的に処理）

### 🎯 タスク粒度の基本原則
- **実用レベル完成タスク**: 細かい作業分割ではなく、機能を実用可能なレベルまで完全実装する責任範囲
- **エンドツーエンド完成実装**: データ層からUI層、テスト、デプロイ準備まで一つのタスクで完全に完結
- **最適機能分割**: ユーザが求めるすべての機能を効率的に完成させる戦略的分割
- **システム統合責任**: 分割された機能が最終的に統合され、完全なシステムとして動作することを保証

### 🚀 要件定義型タスクの具体例
**良い例（機能要件重視）**：
- 「ユーザー認証機能: ユーザーが安全にログイン・ログアウト・アカウント管理を行える機能を実現」
- 「データ永続化基盤: アプリケーションデータの安全な保存・取得・更新を実現」
- 「商品管理機能: 管理者が商品の登録・編集・削除・検索を直感的に行える機能を実現」
- 「決済処理機能: ユーザーが安全で信頼できる決済処理を通じて商品購入を完了できる機能を実現」

**避けるべき例（実装詳細を含む分割）**：
- 「Prismaスキーマの作成とマイグレーション実行」
- 「JWTトークンを使った認証APIの実装」
- 「React Hookを使ったログイン画面の作成」

### 🏗️ 全機能完成戦略
- **最適機能分割**: 機能の複雑さと依存関係を考慮して、最も効率的な粒度で要件を分割
- **機能要件の独立性**: 各機能要件が独立して価値を提供し、最終的に統合される設計
- **システム統合要件**: 分割された機能が統合され、ユーザが求める完全なシステムとして動作する要件定義
- **実装自由度の保証**: 各エンジニアが最適と判断する技術・アーキテクチャで要件を実現
- **並列処理効率**: システムが自動的にタスクをキューイングし、効率的な並列実行を管理
- **タスク数制限なし**: 必要な機能をすべて分割してタスク化（システムが自動的に並列実行を制御）

## 📋 エンジニアへの要件定義品質

各タスクには以下を明確に含め、エンジニアが自律的に実装できる要件を定義する：
- **機能要件の明確化**: 実際のユーザーが何をできるようになるかの具体的な要件定義
- **品質要件の定義**: 実用レベルで必要なパフォーマンス、安全性、使いやすさの要件基準
- **受け入れ条件の明示**: 機能が完成したと判断するための具体的な受け入れ条件
- **ユーザーストーリー**: 実際のユーザーがその機能をどのように使用するかのシナリオ
- **システム統合要件**: 他機能との連携や統合時に満たすべき要件の定義
- **制約条件の明示**: セキュリティ、法規制、技術的制約など考慮すべき制約条件
- **成功基準の設定**: 機能が期待通りに動作していることを確認するための基準

**重要**: 具体的な技術選択、実装方法、ファイル構成、アーキテクチャはエンジニアが決定します。

## 🔍 技術スタック分析の必須要件

### 📋 事前調査チェックリスト
**分析開始前に以下を必ず確認**：

1. **技術スタック適合性**：
   - package.json/requirements.txt等で既存依存関係を確認
   - フレームワーク・ライブラリと要求機能の整合性評価
   - 新規導入が必要な技術の実現可能性判定

2. **アーキテクチャ制約**：
   - 既存のディレクトリ構造・設計パターンとの整合性
   - API設計・データベース設計との親和性
   - デプロイメント・インフラ制約の確認

3. **実装複雑度評価**：
   - 要求機能の技術的難易度（簡単/普通/複雑/高度）を判定
   - 外部サービス統合・リアルタイム処理等の特殊要件を特定
   - 既存コードベースでの実装パターン確認

### 🚨 実現困難判定基準
以下の場合は明確に指摘し、代替案を提示：
- 既存技術スタックでは実現困難な要求
- 高度な専門技術（AI/ML、ブロックチェーン等）が必要
- 大規模な設計変更が必要な要求
- セキュリティ・パフォーマンス上のリスクが高い実装

コードベースを理解するため、Read、Glob、Grepツールを積極的に使用してファイルを調査してください。
技術的実現可能性を必ず評価し、上記で指定したファイルパスに分析結果をJSON形式で保存してください。`;
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

### 2. 技術的実現可能性の検討
- 既存のコードベースを調査し、最適な実装方法を検討
- 必要な技術やツールを特定
- リスクと制約事項を評価

### 3. タスク設計
- 要求を実現するために必要な作業を洗い出し
- 各作業を適切な粒度のタスクに分割
- タスク間の依存関係を明確化

## 🎯 タスク分割とアサイン戦略

### ⚖️ 実践的ファイル競合管理（ベストエフォート）
**重要**: コンフリクト解消機能があることを前提とした現実的なバランス重視

#### 🎯 競合最小化の優先順位
1. **高頻度競合の回避**: 設定ファイル（package.json, tsconfig.json等）の同時編集は極力避ける
2. **機能境界の尊重**: 可能な限り機能単位でファイルを分離
3. **効率性との両立**: 完全回避にこだわりすぎて非効率にならない

#### 🔧 許容可能な競合ケース
- **共通ファイルの軽微な変更**: 型定義の追加、import文の追加等
- **テストファイルの並列更新**: 異なる機能のテスト追加
- **スタイルファイルの部分的更新**: 独立したコンポーネントのスタイル
- **ドキュメントファイルの同時更新**: README、API仕様書等

#### 🚨 避けるべき高リスク競合
- **同一関数・クラスの同時編集**
- **データベースマイグレーションの並列実行**
- **ビルド設定の同時変更**
- **認証・セキュリティ関連の中核機能**

### 📏 動的タスク粒度調整原則

#### 🧠 開発コンテキスト判断
**要求分析時に以下を判断し、適切な戦略を選択**：

1. **開発規模の特定**：
   - 大規模開発（アプリ0→MVP）→ 機能完結型タスク
   - 中規模開発（機能追加）→ 機能単位タスク
   - 小規模開発（バグ修正・改善）→ 細かい粒度タスク

2. **タスクタイプの分析**：
   - feature: 開発規模に応じて粒度調整
   - bugfix: 常に細かい粒度（迅速修正優先）
   - test/documentation: 細かい粒度
   - refactoring: 中程度の粒度

#### 🎯 規模別戦略
- **大規模feature**: 機能完結性
- **中規模feature**: 機能単位
- **小規模・bugfix**: 細かい粒度
- **タスク最適化**: 機能の複雑さと開発規模に応じて最も効率的な戦略的分割

### 🎯 要件定義型エンジニア指示
各タスクには以下を必ず含める：

#### 📋 機能要件定義
- **機能要件**: ユーザーが何をできるようになるかの明確な定義
- **受け入れ基準**: 機能完成の判定基準（What、Why重視）
- **ユーザーストーリー**: 実際の使用シナリオとユーザー体験

#### ✅ 品質要件定義
- **動作要件**: 期待される動作と正常系・異常系の要件
- **使いやすさ要件**: ユーザビリティとアクセシビリティ要件
- **セキュリティ要件**: データ保護、認証認可、脆弱性対策要件

#### 🔗 統合要件定義
- **他機能との連携**: 内部モジュール間で満たすべき連携要件
- **外部システム連携**: 外部サービスやAPIとの連携要件
- **データ整合性**: システム全体でのデータの一貫性要件

**重要**: 具体的な実装手順、技術選択、アーキテクチャ設計、運用方法はすべてエンジニアが決定します。

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

### 🎯 開発規模別タスク分割戦略

#### 📊 タスクタイプ別粒度設定

**🚀 feature（新機能開発）**：
- **大規模開発（アプリ0→MVP）**: 機能完結型
  - 例：「ユーザー認証機能の完全実装」「商品管理システム一式」
- **中規模開発（機能追加）**: 機能単位
  - 例：「プロフィール編集機能」「通知機能」
- **小規模開発（改良）**: 細かい粒度
  - 例：「検索フィルター追加」「UI改善」

**🐛 bugfix（バグ修正）**：
- **常に細かい粒度**で実装
- 関連するバグが複数ある場合のみグループ化
- 例：「ログイン画面でのバリデーションエラー修正」「商品一覧の表示バグ修正」

**🧪 test（テスト追加）**：
- 対応する機能の規模に合わせて調整
- 例：「認証機能のテストスイート追加」「個別APIのテスト修正」

**📚 documentation（ドキュメント）**：
- 細かい粒度で実装
- 例：「API仕様書更新」「README改善」

**🔧 refactoring（リファクタリング）**：
- 中程度の粒度
- 例：「ユーザー関連モジュールのリファクタリング」「データベースクエリの最適化」

#### 🎯 実践指針

**アプリ0→MVP開発の場合**：
- 核心機能を適切な粒度で分割
- 各機能が独立して価値を提供できるよう設計
- 例：「認証機能」「商品管理機能」「決済機能」「ユーザー管理機能」「注文管理機能」など必要な機能を全て分割

**既存アプリの機能追加の場合**：
- 追加機能を完結した単位で分割
- 既存システムとの統合も含めて一つのタスクで完結

**バグ修正・改善の場合**：
- 細かい粒度で分割し、迅速な修正を優先
- 関連性の高いバグのみグループ化

## 🚨 重要な指針

### 🎪 実践的プロダクトマネジメント判断

#### 🧠 エンジニアリングマネージャーとしての意思決定
**ProductOwner兼エンジニアリングマネージャーとして以下を総合判断**：

1. **開発効率 vs 競合リスク**：
   - 完全回避で工数が2倍になる → 適度な競合を許容
   - 軽微な競合で開発速度が大幅改善 → 積極的に並列化
   - 高リスク競合（DB migration等） → 必ず回避

2. **システム生産性の最大化**：
   - 並列処理システムを活かした最適なタスク分割
   - 機能の独立性を重視したタスク設計
   - ブロッカー最小化とフロー効率の向上

3. **品質とスピードのバランス**：
   - MVP到達速度の優先度
   - リファクタリング余地の確保
   - 技術的負債の許容範囲

#### 🔄 動的リスク調整
- **設定ファイル**: 1つのタスクに集約（高リスク回避）
- **独立機能**: 積極的並列化（効率優先）
- **共通モジュール**: 軽微変更は許容、大幅変更は分離
- **テスト・ドキュメント**: 競合を恐れず並列実行

#### 📊 成果重視の判断基準
競合による開発停止 < コンフリクト解消コスト < 並列化による時間短縮効果

#### 🎯 実践的なfileScopeの設定指針
**conflictRisk評価の現実的な基準**：
- **none**: 完全に独立したファイル・機能
- **low**: 軽微な共通ファイル変更（import追加、型定義追加等）
- **medium**: 共通モジュールの部分的変更
- **high**: 設定ファイル、DB migration、認証系の同時変更

**判断例**：
- ✅ 「ユーザー管理API + 商品管理API」→ low risk（型定義の軽微な競合のみ）
- ✅ 「フロントエンド + バックエンド」→ low risk（異なる技術スタック）
- ⚠️ 「package.json設定 + 複数機能実装」→ high risk（設定競合を回避）

## 🔄 依存関係設計の重要指針

### ⚠️ 循環依存の完全回避
**重要**: タスク間の依存関係で循環参照を絶対に作らないでください。

#### 🚨 避けるべきパターン
- タスクA → タスクB → タスクA（直接的循環）
- タスクA → タスクB → タスクC → タスクA（間接的循環）
- 相互依存関係（タスクAとタスクBが互いに依存）

#### ✅ 推奨パターン
- **階層的依存**: 基盤 → 機能 → 統合 の一方向フロー
- **依存最小化**: 可能な限り独立したタスクとして設計
- **明確な順序**: 論理的な実装順序での依存関係設定`;
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
  private extractTaskAnalysisResult(messages: SDKMessage[]): TaskAnalysisResult {
    // 全ての分析メッセージから結果を抽出
    let fullAnalysisText = '';

    for (const message of messages) {
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

3. **MVP完成度評価**：
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
  private extractPhaseInfo(messages: SDKMessage[]): any | null {
    let fullText = '';

    for (const message of messages) {
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
  private extractCurrentPhaseFromAnalysis(messages: SDKMessage[]): { phaseNumber: number } | null {
    let fullText = '';

    for (const message of messages) {
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
