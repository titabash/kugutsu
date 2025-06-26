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
      allowedTools: ["Read", "Glob", "Grep", "LS"],
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
   * プロジェクトIDを生成（ユーザーリクエストから一意のIDを生成）
   */
  private generateProjectId(userRequest: string): string {
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
ユーザからの開発要求を分析し、効率的で実行可能なタスクに分割して、チーム内のエンジニアに適切にアサインすることが主な役割です。

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

### 3. タスク分割とエンジニアアサイン
- 機能単位での適切な粒度でタスクを分割
- エンジニアのスキルレベルと専門性を考慮したアサイン
- 並列開発可能な独立性の高いタスクを優先
- 依存関係を最小化し、ブロッカーを回避
- 各エンジニアが明確に実装できる具体的な仕様を提供

## 🔧 分析アプローチ

### Phase 1: コードベース理解
1. プロジェクト構造とアーキテクチャパターンの把握
2. 既存の技術スタック、フレームワーク、ライブラリの調査
3. コーディング規約、テスト戦略、デプロイメント手順の確認
4. 類似機能の実装パターンとベストプラクティスの特定

### Phase 2: 要件分析と設計
1. ユーザー要求の背景とビジネス価値の理解
2. 機能要件と非機能要件の整理
3. ユーザーストーリーとアクセプタンスクライテリアの定義
4. 技術的制約とリスクの評価

### Phase 3: タスク設計とアサイン戦略
1. 機能を独立性の高いコンポーネントに分割
2. 各タスクの実装難易度とスキル要件を評価
3. 並列開発を最大化するための依存関係の最適化
4. エンジニア間のコラボレーション効率を考慮

## 🎪 並列開発の最適化指針

### 🚨 最重要ルール：ファイル競合の回避
- **同一ファイルへの変更は原則として1つのタスクに集約する**
- 複数エンジニアが同じファイルを編集するタスク分割は絶対に避ける
- ファイル単位での排他制御を前提とした分割戦略を採用

### 並列開発の基本方針
- **ファイル境界での分割**: 異なるファイル、モジュール、コンポーネントごとにタスクを分離
- **機能境界での分割**: 独立した機能要件ごとに、関連ファイルをまとめてアサイン
- **レイヤー境界での分割**: フロントエンド、バックエンド、データベースなど技術レイヤーごとに分離

### ファイル競合回避の具体的戦略
1. **新規ファイル作成の優先**: 既存ファイル変更より新規ファイル作成を優先
2. **インターフェース分離**: 共通インターフェースを先に定義し、実装は独立したファイルで
3. **設定ファイルの事前分割**: package.json、設定ファイルなどは1つのタスクで完結
4. **テストファイルの独立**: 各機能のテストファイルは対応する実装タスクに含める

### 並列処理の考慮
- 複数の独立した機能要件がある場合は、並列開発の可能性を検討
- ただし、ファイル競合の回避を最優先とする
- 適切な粒度でタスクを分割し、チームの生産性を最大化

## 📋 エンジニアへの指示品質

各タスクには以下を明確に含める：
- **実装目標**: 何を達成するかの明確な定義
- **技術仕様**: 使用する技術、パターン、インターフェース
- **実装手順**: 段階的なアプローチとチェックポイント
- **品質基準**: テスト要件、パフォーマンス基準、コード品質
- **依存関係**: 前提条件と他タスクとの連携方法
- **完了条件**: 具体的な受け入れ基準とレビュー観点

コードベースを理解するため、必要に応じてRead、Glob、Grepツールを積極的に使用してファイルを調査してください。
最終的に、JSON形式でタスクリストと詳細な分析結果を返してください。`;
  }

  /**
   * ユーザからの要求を分析してタスクに分割し、指示ファイルを作成
   */
  async analyzeUserRequestWithInstructions(
    userRequest: string,
    instructionManager: TaskInstructionManager
  ): Promise<TaskAnalysisResult> {
    this.info('🧠 要求分析開始');

    // プロジェクトIDを生成し、既存のフェーズドキュメントを確認
    const projectId = this.generateProjectId(userRequest);
    const existingDoc = await this.loadPhaseDocument(projectId);

    let prompt: string;
    if (existingDoc) {
      // 既存のフェーズドキュメントがある場合は続きから実行
      prompt = this.buildContinuationPrompt(userRequest, existingDoc);
    } else {
      prompt = this.buildAnalysisPrompt(userRequest);
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
      const result = this.extractTaskAnalysisResult(messages);
      result.projectId = projectId; // プロジェクトIDを結果に含める

      // フェーズ管理の処理
      const phaseInfo = this.extractPhaseInfo(messages);
      
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
        const updatedPhaseInfo = this.extractPhaseInfo(messages);
        if (updatedPhaseInfo && updatedPhaseInfo.phases) {
          // 既存のフェーズ情報を更新
          await this.updatePhaseDocument(existingDoc, updatedPhaseInfo, result);
          this.info('🔄 フェーズ情報を更新しました');
        }
        
        const currentPhase = existingDoc.phases[existingDoc.currentPhaseIndex];
        this.info(`📊 現在のフェーズ: ${currentPhase.phaseName} (${currentPhase.currentPhase}/${currentPhase.totalPhases})`);
      }

      // 概要ファイルを作成
      await instructionManager.createOverviewFile(userRequest, fullAnalysis);

      // 各タスクの詳細指示ファイルを作成
      for (const task of result.tasks) {
        const detailedInstructions = await this.generateDetailedInstructions(task, userRequest, fullAnalysis);
        await instructionManager.createTaskInstructionFile(task, detailedInstructions);
      }

      // 依存関係ファイルを作成
      await instructionManager.createDependencyFile(result.tasks);

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
  private buildAnalysisPrompt(userRequest: string): string {
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

### 🚨 最優先原則：ファイル競合の完全回避
- **ファイル排他制御**: 同一ファイルへの変更は絶対に1つのタスクのみに集約
- **ファイル境界分割**: 異なるファイル、モジュール、コンポーネント単位での完全分離
- **依存関係の最小化**: ファイル間インターフェースを明確にし、並列開発を可能にする
- **競合検出**: タスク分割時に潜在的なファイル競合を事前に特定・回避

### 基本原則
- **独立性優先**: ファイル競合を回避した上で、可能な限り多くの独立したタスクに分割
- **適切な粒度**: 1-3時間で完了可能なサイズに調整
- **明確な仕様**: エンジニアが迷わず実装できる具体的な指示
- **品質担保**: テスト、レビュー、デプロイメントまでを含む完全な定義

### エンジニアへの指示品質
各タスクには以下を必ず含める：
- **実装目標**: 具体的な成果物と受け入れ基準
- **技術仕様**: 使用技術、デザインパターン、インターフェース定義
- **実装手順**: ステップバイステップのアプローチとチェックポイント
- **品質基準**: テスト要件、パフォーマンス基準、セキュリティ考慮事項
- **依存関係**: 前提条件、他タスクとの連携方法、統合手順
- **完了条件**: 明確な受け入れ基準とレビュー観点

## 📊 最終成果物要求

以下のJSON形式で、詳細な分析結果とタスクリストを出力してください：

\`\`\`json
{
  "analysis": {
    "userRequestAnalysis": "ユーザー要求の詳細分析",
    "codebaseAssessment": "現在のコードベースの評価",
    "technicalRequirements": "技術要件の詳細",
    "architecturalDecisions": "設計判断と根拠"
  },
  "tasks": [
    {
      "title": "明確で具体的なタスクタイトル",
      "description": "実装すべき機能の詳細説明",
      "type": "feature|bugfix|documentation|test|refactoring",
      "priority": "high|medium|low",
      "estimatedHours": 2,
      "skillRequirements": ["必要なスキルレベル"],
      "fileScope": {
        "primaryFiles": ["このタスクで主に変更するファイル"],
        "newFiles": ["このタスクで新規作成するファイル"],
        "readOnlyFiles": ["参照のみで変更しないファイル"],
        "conflictRisk": "none|low|medium|high"
      },
      "technicalSpecs": {
        "technologies": ["使用技術"],
        "patterns": ["適用デザインパターン"],
        "interfaces": ["インターフェース定義"]
      },
      "implementation": {
        "steps": ["実装手順"],
        "checkpoints": ["チェックポイント"],
        "testRequirements": ["テスト要件"]
      },
      "dependencies": ["依存するタスクのタイトル"],
      "acceptanceCriteria": ["受け入れ基準"]
    }
  ],
  "summary": "プロジェクト全体の概要と実装戦略",
  "estimatedTime": "総見積もり時間",
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
        "estimatedTime": "8時間"
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

## 🚨 重要な指針

### ファイル競合回避の徹底
- **必須**: 各タスクのfileScopeを明確に定義し、ファイル競合を事前検出
- **原則**: 同一ファイルへの変更は絶対に複数タスクに分散させない
- **戦略**: ファイル境界、機能境界、レイヤー境界での明確な分割

### 並列開発の最適化
- ファイル競合を回避した上で、独立性の高いタスクを最大限に設計
- 新規ファイル作成を優先し、既存ファイル変更は最小限に抑制
- インターフェース設計を先行し、実装の並列化を促進

### 包括的な品質担保
- 詳細な技術分析を実施し、エンジニアが迷わない具体的な指示を提供
- 品質、セキュリティ、パフォーマンスを全て考慮した包括的な要件定義
- 実装だけでなく、テスト、レビュー、デプロイメントまでを含む完全なワークフロー`;
  }

  /**
   * タスクデータから詳細な説明を構築
   */
  private buildTaskDescription(taskData: any): string {
    let description = taskData.description || 'タスクの説明';

    // ファイルスコープ情報がある場合は追加
    if (taskData.fileScope) {
      description += '\n\n## 📁 ファイルスコープ';
      if (taskData.fileScope.primaryFiles && taskData.fileScope.primaryFiles.length > 0) {
        description += `\n- **主要変更ファイル**: ${taskData.fileScope.primaryFiles.join(', ')}`;
      }
      if (taskData.fileScope.newFiles && taskData.fileScope.newFiles.length > 0) {
        description += `\n- **新規作成ファイル**: ${taskData.fileScope.newFiles.join(', ')}`;
      }
      if (taskData.fileScope.readOnlyFiles && taskData.fileScope.readOnlyFiles.length > 0) {
        description += `\n- **参照のみファイル**: ${taskData.fileScope.readOnlyFiles.join(', ')}`;
      }
      if (taskData.fileScope.conflictRisk) {
        const riskEmoji = taskData.fileScope.conflictRisk === 'none' ? '✅' : 
                         taskData.fileScope.conflictRisk === 'low' ? '🟡' :
                         taskData.fileScope.conflictRisk === 'medium' ? '🟠' : '🔴';
        description += `\n- **競合リスク**: ${riskEmoji} ${taskData.fileScope.conflictRisk}`;
      }
    }

    // 技術仕様がある場合は追加
    if (taskData.technicalSpecs) {
      description += '\n\n## 🔧 技術仕様';
      if (taskData.technicalSpecs.technologies) {
        description += `\n- **使用技術**: ${taskData.technicalSpecs.technologies.join(', ')}`;
      }
      if (taskData.technicalSpecs.patterns) {
        description += `\n- **デザインパターン**: ${taskData.technicalSpecs.patterns.join(', ')}`;
      }
      if (taskData.technicalSpecs.interfaces) {
        description += `\n- **インターフェース**: ${taskData.technicalSpecs.interfaces.join(', ')}`;
      }
    }

    // 実装手順がある場合は追加
    if (taskData.implementation) {
      description += '\n\n## 📋 実装手順';
      if (taskData.implementation.steps) {
        description += '\n### ステップ';
        taskData.implementation.steps.forEach((step: string, index: number) => {
          description += `\n${index + 1}. ${step}`;
        });
      }
      if (taskData.implementation.checkpoints) {
        description += '\n### チェックポイント';
        taskData.implementation.checkpoints.forEach((checkpoint: string) => {
          description += `\n- ${checkpoint}`;
        });
      }
      if (taskData.implementation.testRequirements) {
        description += '\n### テスト要件';
        taskData.implementation.testRequirements.forEach((requirement: string) => {
          description += `\n- ${requirement}`;
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

    // 見積もり時間がある場合は追加
    if (taskData.estimatedHours) {
      description += `\n\n## ⏱️ 見積もり時間: ${taskData.estimatedHours}時間`;
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

## このタスクの内容
${task.description}

## プロダクトオーナーによる分析
${analysis}

## 実装における注意事項
- 既存のコードベースの規約とパターンに従ってください
- セキュリティとパフォーマンスを考慮してください
- 適切なエラーハンドリングとテストを実装してください
- 必要に応じてドキュメントを更新してください
`;
  }

  /**
   * Claude Code SDKの応答からタスク分析結果を抽出
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
            // 拡張情報をメタデータとして保存
            metadata: {
              estimatedHours: taskData.estimatedHours,
              skillRequirements: taskData.skillRequirements,
              technicalSpecs: taskData.technicalSpecs,
              implementation: taskData.implementation,
              acceptanceCriteria: taskData.acceptanceCriteria,
              fileScope: taskData.fileScope
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
            estimatedTime: jsonData.estimatedTime || '未定',
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
        this.warn('⚠️ 循環依存が検出されました。残りのタスクを強制的に追加します。');
        resolved.push(...remaining);
        break;
      }
    }

    return resolved;
  }

  /**
   * 継続実行用のプロンプトを構築
   */
  private buildContinuationPrompt(userRequest: string, existingDoc: PhaseDocument): string {
    const allPhaseDescriptions = existingDoc.phases.map((phase, idx) => 
      `${idx + 1}. ${phase.phaseName}: ${phase.description}`
    ).join('\n');
    
    return `
プロダクトオーナーとして、フェーズ管理されたプロジェクトの続きを実行します。

## 📝 元のユーザー要求
${userRequest}

## 📊 プロジェクトのフェーズ構成
${allPhaseDescriptions}

## 🔍 実装状況の確認
まず、コードベースを調査して、どのフェーズまで実装が完了しているかを確認してください。
各フェーズのタスクが実装されているかをチェックし、現在どのフェーズにいるかを判断してください。

## 🔄 フェーズ内容の更新
実装状況や新たな発見に基づいて、必要に応じて以下を更新してください：
- 今後のフェーズの内容やタスク構成
- 各フェーズの説明や目的
- 見積もり時間や優先度

これらの更新はプロジェクトの進化に合わせて柔軟に対応し、より適切な実装計画に調整してください。

## 📋 実行すべきタスク
実装状況の確認結果に基づいて、現在実行すべきフェーズのタスクを出力してください。
フェーズ内容を更新した場合は、"phaseManagement"セクションで更新内容も含めて出力してください。

${this.buildAnalysisPrompt(userRequest).split('## 📊 最終成果物要求')[1]}`;
  }

  /**
   * メッセージからフェーズ情報を抽出
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

    // フェーズ管理のJSONブロックを探す
    const phaseMatches = [...fullText.matchAll(/"phaseManagement"\s*:\s*{[\s\S]*?requiresPhases[\s\S]*?}/g)];
    
    if (phaseMatches.length > 0) {
      try {
        // 最後のマッチを使用
        const lastMatch = phaseMatches[phaseMatches.length - 1][0];
        // 完全なJSONオブジェクトに変換
        const jsonStr = `{${lastMatch}}`;
        const parsed = JSON.parse(jsonStr);
        
        if (parsed.phaseManagement && parsed.phaseManagement.requiresPhases) {
          this.info('📊 フェーズ管理が必要と判断されました');
          return parsed.phaseManagement;
        }
      } catch (error) {
        this.warn('⚠️ フェーズ情報の解析に失敗しました');
      }
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
        estimatedTime: p.estimatedTime,
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
          phase.estimatedTime = updatedPhase.estimatedTime || phase.estimatedTime;
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
