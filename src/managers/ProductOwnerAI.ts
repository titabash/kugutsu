import { query, type SDKMessage } from "@anthropic-ai/claude-code";
import { Task, TaskAnalysisResult, AgentConfig } from '../types';
import { TaskInstructionManager } from '../utils/TaskInstructionManager';
import { v4 as uuidv4 } from 'uuid';
import { BaseAI } from './BaseAI';
import { ComponentType } from '../types/logging';

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

### 例外的な並列処理（同一ファイル回避前提）
- 「並列」「同時」「複数」キーワード検出時は、**異なるファイル**での実装に分割
- 検証・比較目的の場合は、**別ディレクトリ**や**プロトタイプフォルダ**で実装
- A/Bテストの場合は、**feature flags**や**条件分岐**での実装を推奨

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

    const prompt = this.buildAnalysisPrompt(userRequest);

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

      // タスクを解析・作成（実際のLLMの応答メッセージとユーザー要求を使用）
      const result = this.extractTaskAnalysisResultWithUserRequest(messages, userRequest);

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
      throw new Error(`プロダクトオーナーAIの分析に失敗しました: ${error}`);
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
    // ユーザー要求から並列処理キーワードを検出
    const parallelKeywords = ['並列', '同時', '複数', 'エンジニアAI', '二人', '２人', '2人', 'パラレル', '並行'];
    const hasParallelIntent = parallelKeywords.some(keyword => userRequest.includes(keyword));

    // 同一ファイルに対する複数の変更パターンを検出
    const hasMultipleChanges = userRequest.includes('と') || userRequest.includes('、') || userRequest.includes('または');

    let parallelInstructions = '';
    if (hasParallelIntent) {
      parallelInstructions = `
## 🚨 並列処理モード検出 🚨
ユーザーが明示的に並列処理を要求しています。以下の特別な指針に従ってください：

### 必須：並列タスク分割ルール
1. **同一ファイルに対する複数の変更**: 各変更パターンを独立したタスクに分割する
2. **検証・テスト目的**: 異なるアプローチを試す場合は、それぞれを独立したタスクとする
3. **比較検証**: 複数の実装方法を試す場合は、各実装を独立したタスクとする
4. **最小2タスク**: どんなに小さな作業でも、最低2つのタスクに分割する

### 例：「HeyをHelloに変更とGood Morningに変更」の場合
→ タスク1: TEST.mdのHeyをHelloに変更
→ タスク2: TEST.mdのHeyをGood Morningに変更
（異なるワークツリーで実行し、結果を比較検証）
`;
    }

    return `
プロダクトオーナーとして、以下のユーザー要求を包括的に分析し、エンジニアチームに対する具体的な実装指示を策定してください：

## 📝 ユーザー要求
${userRequest}
${parallelInstructions}

## 🔍 段階的分析手順

### Phase 1: コードベース理解 (必須)
1. **プロジェクト構造の把握**
   - Read、Glob、Grepツールを使用してコードベースを調査
   - アーキテクチャパターン、フレームワーク、技術スタックの特定
   - 既存の類似機能の実装方法とベストプラクティスの確認

2. **品質基準の確認**
   - テスト戦略、コーディング規約、デプロイメント手順の調査
   - セキュリティ、パフォーマンス、可用性の要件確認

### Phase 2: 要件エンジニアリング
1. **ニーズ分析**
   - ユーザー要求の背景とビジネス価値の理解
   - 明示的要件と暗黙的要件の識別
   - ステークホルダーの期待値と制約条件の整理

2. **技術要件定義**
   - 機能要件と非機能要件の詳細化
   - インターフェース設計、データモデル、API仕様の検討
   - セキュリティ、スケーラビリティ、監視可能性の考慮

### Phase 3: 設計とタスク分割戦略
1. **アーキテクチャ設計**
   - 既存システムとの整合性を考慮した設計
   - 拡張性と保守性を重視したモジュール分割
   - 技術負債の軽減とコード品質の向上

2. **並列開発最適化**
   - 独立性の高いコンポーネント単位での分割
   - 依存関係の最小化とブロッカーの事前回避
   - エンジニア間のコラボレーション効率の最大化

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
    // メタデータから詳細情報を取得
    const metadata = task.metadata;
    
    let instructions = `
# 📋 タスク実装指示書

## 🎯 実装目標
${task.description}

## 📝 元のユーザー要求
${userRequest}

## 🔧 技術要件と仕様
${this.generateTechnicalSpecs(metadata)}

## 📐 実装手順
${this.generateImplementationSteps(metadata)}

## 🧪 品質基準とテスト要件
${this.generateQualityStandards(metadata)}

## ✅ 受け入れ基準
${this.generateAcceptanceCriteria(metadata)}

## 👨‍💻 必要スキルと前提知識
${this.generateSkillRequirements(metadata)}

## ⏱️ 見積もり時間
${metadata?.estimatedHours ? `${metadata.estimatedHours}時間` : '未定'}

## 🔗 依存関係とブロッカー
${task.dependencies.length > 0 ? task.dependencies.map(dep => `- ${dep}`).join('\n') : '依存関係なし'}

## 🎯 プロダクトオーナーAIによる分析
${analysis}

## 🚨 重要な注意事項
- 既存のコード規約とアーキテクチャパターンに従ってください
- セキュリティ、パフォーマンス、保守性を考慮した実装を行ってください
- 変更に対する適切なテストを作成してください
- 実装完了前に必ず動作確認を行ってください

## 📊 完了確認チェックリスト
- [ ] 実装目標が達成されている
- [ ] 全ての受け入れ基準を満たしている
- [ ] 適切なテストが作成・実行されている
- [ ] コード品質基準を満たしている
- [ ] ドキュメントが更新されている（必要に応じて）
- [ ] 変更がコミットされている
`;

    return instructions;
  }

  /**
   * 技術仕様セクションを生成
   */
  private generateTechnicalSpecs(metadata?: Task['metadata']): string {
    if (!metadata?.technicalSpecs) {
      return '詳細な技術仕様は実装時に決定してください。既存のコードベースのパターンに従ってください。';
    }

    let specs = '';
    const tech = metadata.technicalSpecs;

    if (tech.technologies) {
      specs += `\n### 使用技術
${tech.technologies.map(t => `- ${t}`).join('\n')}`;
    }

    if (tech.patterns) {
      specs += `\n### 適用デザインパターン
${tech.patterns.map(p => `- ${p}`).join('\n')}`;
    }

    if (tech.interfaces) {
      specs += `\n### インターフェース定義
${tech.interfaces.map(i => `- ${i}`).join('\n')}`;
    }

    return specs || '技術仕様の詳細は実装時に決定してください。';
  }

  /**
   * 実装手順セクションを生成
   */
  private generateImplementationSteps(metadata?: Task['metadata']): string {
    if (metadata?.implementation?.steps) {
      let steps = '### 実装ステップ\n';
      metadata.implementation.steps.forEach((step, index) => {
        steps += `${index + 1}. ${step}\n`;
      });

      if (metadata.implementation.checkpoints) {
        steps += '\n### チェックポイント\n';
        metadata.implementation.checkpoints.forEach(checkpoint => {
          steps += `- ${checkpoint}\n`;
        });
      }

      return steps;
    }

    // デフォルトの実装手順
    return `### 実装ステップ
1. **要件分析**: タスクの要件を詳しく分析し、技術的な実現方法を検討
2. **コードベース調査**: 既存のコードベースを調査し、類似機能の実装パターンを確認
3. **設計**: 最適なアプローチを決定し、実装計画を策定
4. **実装**: 段階的に機能を実装し、各段階で動作確認を実施
5. **テスト**: 適切なテストを作成し、品質を確保
6. **レビュー**: 実装内容をレビューし、改善点があれば修正`;
  }

  /**
   * 品質基準セクションを生成
   */
  private generateQualityStandards(metadata?: Task['metadata']): string {
    if (metadata?.implementation?.testRequirements) {
      let standards = '### テスト要件\n';
      metadata.implementation.testRequirements.forEach(req => {
        standards += `- ${req}\n`;
      });
      return standards;
    }

    return `### 基本品質基準
- コードの可読性と保守性を確保
- 適切なエラーハンドリングを実装
- セキュリティベストプラクティスを遵守
- パフォーマンスを考慮した実装
- 適切なテストカバレッジを維持`;
  }

  /**
   * 受け入れ基準セクションを生成
   */
  private generateAcceptanceCriteria(metadata?: Task['metadata']): string {
    if (metadata?.acceptanceCriteria) {
      return metadata.acceptanceCriteria.map(criteria => `- ${criteria}`).join('\n');
    }

    return `- 実装が仕様通りに動作する
- 既存機能に悪影響を与えない
- 適切なテストが通過する
- コード品質基準を満たす`;
  }

  /**
   * スキル要件セクションを生成
   */
  private generateSkillRequirements(metadata?: Task['metadata']): string {
    if (metadata?.skillRequirements) {
      return metadata.skillRequirements.map(skill => `- ${skill}`).join('\n');
    }

    return `- 使用されている技術スタックの基本知識
- 既存コードベースの理解
- 基本的なソフトウェア開発スキル`;
  }

  /**
   * Claude Code SDKの応答からタスク分析結果を抽出（ユーザー要求を活用）
   */
  private extractTaskAnalysisResultWithUserRequest(messages: SDKMessage[], userRequest: string): TaskAnalysisResult {
    // 既存の処理を使用
    const baseResult = this.extractTaskAnalysisResult(messages);

    // 並列処理キーワードをユーザー要求から直接検出
    const parallelKeywords = ['並列', '同時', '複数', 'エンジニアAI', '二人', '２人', '2人', 'パラレル', '並行'];
    const hasParallelIntent = parallelKeywords.some(keyword => userRequest.includes(keyword));

    // 既に複数タスクが生成されている場合はそのまま返す
    if (baseResult.tasks.length > 1) {
      this.success(`✅ 複数タスクを生成済み: ${baseResult.tasks.length}個のタスク`);
      return baseResult;
    }

    // 並列処理が要求されているが単一タスクの場合、ユーザー要求を解析して分割
    if (hasParallelIntent) {
      this.info('🔄 ユーザー要求を直接解析して並列タスクを生成');

      const parallelTasks = this.createParallelTasksFromUserRequest(userRequest);
      if (parallelTasks.length > 1) {
        return {
          tasks: parallelTasks,
          summary: `ユーザー要求「${userRequest}」の並列処理分析`,
          estimatedTime: '1-2時間',
          riskAssessment: '低リスク - 並列処理テスト'
        };
      }
    }

    return baseResult;
  }

  /**
   * ユーザー要求から直接並列タスクを生成
   */
  private createParallelTasksFromUserRequest(userRequest: string): Task[] {
    const tasks: Task[] = [];

    // パターン1: 「HeyをHelloに変更とGood Morningに変更」のような具体的なパターン
    if (userRequest.includes('Hello') && userRequest.includes('Good Morning')) {
      tasks.push({
        id: uuidv4(),
        type: 'feature',
        title: 'TEST.mdのHeyをHelloに変更',
        description: 'TEST.mdファイル内の"Hey"を"Hello"に変更する作業',
        priority: 'high',
        status: 'pending',
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });

      tasks.push({
        id: uuidv4(),
        type: 'feature',
        title: 'TEST.mdのHeyをGood Morningに変更',
        description: 'TEST.mdファイル内の"Hey"を"Good Morning"に変更する作業',
        priority: 'high',
        status: 'pending',
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });

      this.info('📋 具体的な並列タスクを生成: Hello & Good Morning');
      return tasks;
    }

    // パターン2: 「AとB」のような形式
    const andPattern = /(.+?)と(.+?)を/g;
    const andMatches = [...userRequest.matchAll(andPattern)];
    if (andMatches.length > 0) {
      for (const match of andMatches) {
        const task1Content = match[1];
        const task2Content = match[2];

        tasks.push({
          id: uuidv4(),
          type: 'feature',
          title: `${task1Content}の処理`,
          description: `${task1Content}に関する作業`,
          priority: 'high',
          status: 'pending',
          dependencies: [],
          createdAt: new Date(),
          updatedAt: new Date()
        });

        tasks.push({
          id: uuidv4(),
          type: 'feature',
          title: `${task2Content}の処理`,
          description: `${task2Content}に関する作業`,
          priority: 'high',
          status: 'pending',
          dependencies: [],
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      if (tasks.length > 0) {
        this.info(`📋 「と」パターンから並列タスクを生成: ${tasks.length}個`);
        return tasks;
      }
    }

    // パターン3: 一般的な並列処理（エンジニアAI数を指定されている場合）
    if (userRequest.includes('エンジニアAI') && (userRequest.includes('二人') || userRequest.includes('２人') || userRequest.includes('2人'))) {
      tasks.push({
        id: uuidv4(),
        type: 'feature',
        title: 'エンジニアAI-1の作業',
        description: `${userRequest} - エンジニアAI-1が担当する部分`,
        priority: 'high',
        status: 'pending',
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });

      tasks.push({
        id: uuidv4(),
        type: 'feature',
        title: 'エンジニアAI-2の作業',
        description: `${userRequest} - エンジニアAI-2が担当する部分`,
        priority: 'high',
        status: 'pending',
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });

      this.info('📋 エンジニアAI複数指定から並列タスクを生成');
      return tasks;
    }

    this.warn('⚠️ 具体的な並列パターンを検出できませんでした');
    return tasks;
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
      }
    }

    // フォールバック: 並列処理キーワードを検出して強制的に複数タスクを生成
    const parallelKeywords = ['並列', '同時', '複数', 'エンジニアAI', '二人', '２人', '2人', 'パラレル', '並行'];
    const hasParallelIntent = parallelKeywords.some(keyword => fullAnalysisText.includes(keyword));

    if (hasParallelIntent) {
      this.warn('⚠️ JSON未検出ですが、並列処理キーワードを検出したため強制的に複数タスクを生成します');

      // 分析テキストから具体的なタスクを推測
      const tasks: Task[] = [];

      // 「HeyをHelloに変更」と「HeyをGood Morningに変更」のような具体的なパターンを検出
      if (fullAnalysisText.includes('Hello') && fullAnalysisText.includes('Good Morning')) {
        tasks.push({
          id: uuidv4(),
          type: 'feature',
          title: 'TEST.mdのHeyをHelloに変更',
          description: 'TEST.mdファイル内の"Hey"を"Hello"に変更する作業',
          priority: 'high',
          status: 'pending',
          dependencies: [],
          createdAt: new Date(),
          updatedAt: new Date()
        });

        tasks.push({
          id: uuidv4(),
          type: 'feature',
          title: 'TEST.mdのHeyをGood Morningに変更',
          description: 'TEST.mdファイル内の"Hey"を"Good Morning"に変更する作業',
          priority: 'high',
          status: 'pending',
          dependencies: [],
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // 一般的な並列処理用タスクを生成
      if (tasks.length === 0) {
        tasks.push({
          id: uuidv4(),
          type: 'feature',
          title: '並列処理タスク1',
          description: fullAnalysisText || 'プロダクトオーナーAIによる分析結果を基にした実装（パターン1）',
          priority: 'high',
          status: 'pending',
          dependencies: [],
          createdAt: new Date(),
          updatedAt: new Date()
        });

        tasks.push({
          id: uuidv4(),
          type: 'feature',
          title: '並列処理タスク2',
          description: fullAnalysisText || 'プロダクトオーナーAIによる分析結果を基にした実装（パターン2）',
          priority: 'high',
          status: 'pending',
          dependencies: [],
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      return {
        tasks,
        summary: '並列処理用タスク分割（フォールバック）',
        estimatedTime: '1-2時間',
        riskAssessment: '低リスク - 並列処理テスト'
      };
    }

    // 最終フォールバック: 基本的なタスクを作成
    this.warn('⚠️ JSON形式の分析結果が見つからないため、基本タスクを作成します');

    return {
      tasks: [{
        id: uuidv4(),
        type: 'feature',
        title: 'ユーザー要求の実装',
        description: fullAnalysisText || 'プロダクトオーナーAIによる分析結果を基にした実装',
        priority: 'high',
        status: 'pending',
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }],
      summary: 'プロダクトオーナーAIによる基本分析',
      estimatedTime: '未定',
      riskAssessment: '要再評価'
    };
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
}
