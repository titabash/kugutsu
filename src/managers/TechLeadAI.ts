import { query, type SDKMessage } from "@anthropic-ai/claude-code";
import { Task, EngineerResult, AgentConfig, ReviewResult } from '../types/index.js';
import { MergeCoordinator } from '../utils/MergeCoordinator.js';
import { EngineerAI } from './EngineerAI.js';
import { BaseAI } from './BaseAI.js';
import { ComponentType } from '../types/logging.js';

/**
 * テックリードAIクラス
 * エンジニアAIの作業をレビューする
 */
export class TechLeadAI extends BaseAI {
  private readonly config: AgentConfig;
  private readonly techLeadId: string;
  private mergeCoordinator?: MergeCoordinator;

  constructor(techLeadId: string, config?: Partial<AgentConfig>) {
    super();
    this.techLeadId = techLeadId;
    this.config = {
      systemPrompt: this.getDefaultSystemPrompt(),
      maxTurns: 15,
      allowedTools: ["Read", "Bash", "Grep", "Glob", "LS"],
      ...config
    };
  }

  /**
   * デフォルトのシステムプロンプト
   */
  private getDefaultSystemPrompt(): string {
    return `あなたは経験豊富なテックリードです（ID: ${this.techLeadId}）。
エンジニアAIが実装したコードをレビューすることが役割です。

## 重要な責務の分離
- **レビューの責務**: コードの品質評価、設計の妥当性確認、要件充足性の判定、プロジェクトアーキテクチャの適合性チェック
- **エンジニアAIの責務**: テスト実行、ビルド確認、リントチェック、実装作業

## レビューの方針
1. コードの品質を厳しくチェックしてください
2. セキュリティ、パフォーマンス、保守性を重視してください
3. 既存のコード規約とパターンに従っているかを確認してください
4. 設計の妥当性と拡張性を評価してください
5. 後方互換性が保たれているかを確認してください
6. **プロジェクトの既存アーキテクチャパターンとの整合性を確認してください**

## プロジェクト固有のアーキテクチャパターン
このプロジェクトは以下の構造を採用しています：
- **src/managers/**: 主要なビジネスロジックとAIエージェント実装
- **src/utils/**: ユーティリティ機能と補助クラス
- **src/types/**: TypeScript型定義
- **electron/**: Electronアプリケーション関連
- **docs/**: プロジェクトドキュメント

## レビュー項目
### 必須確認項目
- [ ] 要求された機能が正しく実装されているか
- [ ] 新しい機能に対するテストが適切に作成されているか
- [ ] セキュリティベストプラクティスに従っているか
- [ ] エラーハンドリングが適切に実装されているか
- [ ] コード規約に従っているか

### プロジェクトアーキテクチャ適合性チェック
- [ ] **適切なディレクトリに配置されているか**
  - ビジネスロジック/AIエージェント: \`src/managers/\`
  - ユーティリティ/補助機能: \`src/utils/\`
  - 型定義: \`src/types/\`
  - UI関連（Electron）: \`electron/\`
- [ ] **既存のコードパターンに従っているか**
  - クラス設計パターンの一貫性
  - インポート/エクスポートの規則
  - ファイル命名規則の遵守
- [ ] **依存関係が適切か**
  - 循環依存の回避
  - 適切なレイヤー間の依存関係
  - 外部ライブラリの適切な使用

### 品質評価項目
- [ ] コードの可読性・保守性
- [ ] パフォーマンスへの配慮
- [ ] 適切なコメント・ドキュメント
- [ ] リファクタリングの必要性
- [ ] 設計の妥当性

## 判定基準
- **承認 (APPROVED)**: 全ての必須項目をクリアし、品質基準を満たし、プロジェクトアーキテクチャに適合している
- **要修正 (CHANGES_REQUESTED)**: 修正が必要な問題がある（特にアーキテクチャ不適合は重要）
- **コメント (COMMENTED)**: 問題はないが改善提案がある

## アーキテクチャ不適合の判定
以下の場合は**CHANGES_REQUESTED** を検討してください：
- 不適切なディレクトリにファイルが配置されている
- 既存のコードパターンから大きく逸脱している
- 循環依存を生じさせている
- プロジェクトの責務分割に反している
- 既存の命名規則に従っていない

## レビューコメントの書き方
- 具体的で建設的なフィードバックを提供してください
- 問題のある箇所は具体的なファイル名と行数を示してください
- 修正方法の提案も含めてください
- 良い点も評価してください
- プロジェクトのアーキテクチャパターンを考慮した指摘をしてください

効率的で厳格なレビューを心がけ、プロジェクトの整合性を重視してください。`;
  }

  /**
   * コンポーネントタイプを取得（BaseAI実装）
   */
  protected getComponentType(): ComponentType {
    return 'TechLead';
  }

  /**
   * IDを取得（BaseAI実装）
   */
  protected getId(): string {
    return this.techLeadId;
  }

  /**
   * エンジニアAIの成果物をレビュー
   */
  async reviewEngineerWork(task: Task, engineerResult: EngineerResult): Promise<ReviewResult> {
    // ログを出す前に少し待機して、関連付けが確実に設定されるようにする
    await new Promise(resolve => setTimeout(resolve, 50));
    
    this.info(`👔 レビュー開始`);
    this.info(`📋 タスク: ${task.title}`);
    this.info(`🆔 タスクID: ${task.id}`);
    this.info(`👨‍💻 レビュー対象エンジニア: ${engineerResult.engineerId}`);

    const startTime = Date.now();
    const prompt = this.buildReviewPrompt(task, engineerResult);

    try {
      const messages: SDKMessage[] = [];
      const reviewComments: string[] = [];

      for await (const message of query({
        prompt,
        abortController: new AbortController(),
        options: {
          maxTurns: this.config.maxTurns,
          cwd: task.worktreePath,
          allowedTools: this.config.allowedTools
        },
      })) {
        messages.push(message);

        // リアルタイムでテックリードAIのレビュー状況を表示
        if (message && typeof message === 'object' && 'type' in message) {
          const reviewText = this.displayMessageActivity(message as any);
          if (reviewText) {
            reviewComments.push(reviewText);
          }
        }
      }

      const duration = Date.now() - startTime;
      
      // レビュー結果を解析してステータスを決定
      const reviewStatus = this.parseReviewStatus(reviewComments);
      
      this.success(`✅ レビュー完了 (${duration}ms)`);
      this.info(`📊 レビュー結果: ${reviewStatus}`);

      return {
        taskId: task.id,
        status: reviewStatus,
        comments: reviewComments,
        reviewer: this.techLeadId,
        reviewedAt: new Date(),
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      this.error(`❌ レビュー失敗: ${error}`);

      return {
        taskId: task.id,
        status: 'ERROR',
        comments: [`レビュー中にエラーが発生しました: ${error}`],
        reviewer: this.techLeadId,
        reviewedAt: new Date(),
        duration,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * メッセージアクティビティを表示
   */
  private displayMessageActivity(message: any): string | null {
    const messageType = message.type;
    let reviewText = '';
    
    switch (messageType) {
      case 'user':
        // ユーザーメッセージ（入力）
        if (message.message && message.message.content) {
          for (const content of message.message.content) {
            if (content.type === 'text') {
              this.debug(`📝 入力受信 - ${this.truncateText(content.text, 100)}`);
            }
          }
        }
        break;

      case 'assistant':
        // アシスタントメッセージ（レビューコメント）
        if (message.message && message.message.content) {
          for (const content of message.message.content) {
            if (content.type === 'text') {
              const text = content.text;
              this.info(`🔍 ${this.truncateText(text, 200)}`);
              reviewText += text;
            } else if (content.type === 'tool_use') {
              const toolName = content.name;
              const toolInput = content.input || {};
              const executionId = this.logToolExecution(toolName, this.getToolDescription(toolName, toolInput));
              this.displayToolExecutionDetails(toolName, toolInput, executionId);
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
                this.displayToolResult(result, toolUseId);
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
        this.debug(`⚙️  システム通知`);
        if (message.content) {
          this.debug(`   📋 内容: ${this.truncateText(String(message.content), 150)}`);
        }
        break;

      case 'thinking':
        // 思考過程（内部処理）
        this.debug(`🤔 レビュー中...`);
        break;

      case 'event':
        // イベント通知
        if (message.event_type) {
          this.debug(`📢 イベント - ${message.event_type}`);
        }
        break;

      default:
        // 未知のメッセージタイプ
        this.warn(`🔍 未知のメッセージタイプ - ${messageType}`);
        break;
    }

    return reviewText || null;
  }

  /**
   * ツールの説明を取得
   */
  private getToolDescription(toolName: string, toolInput: any): string {
    switch (toolName) {
      case 'Read':
        return `ファイル読み取り: ${toolInput.file_path || 'パス不明'}`;
      case 'Bash':
        return `コマンド実行: ${this.truncateText(toolInput.command || 'コマンド不明', 100)}`;
      case 'Grep':
        return `内容検索: ${toolInput.pattern || 'パターン不明'}`;
      case 'Glob':
        return `ファイル検索: ${toolInput.pattern || 'パターン不明'}`;
      case 'LS':
        return `ディレクトリ一覧: ${toolInput.path || 'パス不明'}`;
      default:
        return `${toolName}実行`;
    }
  }

  /**
   * ツール実行の詳細を表示
   */
  private displayToolExecutionDetails(toolName: string, toolInput: any, executionId: string): void {
    switch (toolName) {
      case 'Read':
        this.debug(`   📖 ファイル読み取り: ${toolInput.file_path || 'パス不明'}`, { parentLogId: executionId });
        break;

      case 'Bash':
        this.debug(`   💻 コマンド実行: ${this.truncateText(toolInput.command || 'コマンド不明', 100)}`, { parentLogId: executionId });
        break;

      case 'Grep':
        this.debug(`   🔎 内容検索: ${toolInput.pattern || 'パターン不明'}`, { parentLogId: executionId });
        if (toolInput.include) {
          this.debug(`   📂 対象ファイル: ${toolInput.include}`, { parentLogId: executionId });
        }
        break;

      case 'Glob':
        this.debug(`   🔍 ファイル検索: ${toolInput.pattern || 'パターン不明'}`, { parentLogId: executionId });
        if (toolInput.path) {
          this.debug(`   📁 検索パス: ${toolInput.path}`, { parentLogId: executionId });
        }
        break;

      case 'LS':
        this.debug(`   📂 ディレクトリ一覧: ${toolInput.path || 'パス不明'}`, { parentLogId: executionId });
        break;

      default:
        this.debug(`   ⚙️  パラメータ: ${JSON.stringify(toolInput).substring(0, 100)}...`, { parentLogId: executionId });
        break;
    }
  }

  /**
   * ツール実行結果を表示
   */
  private displayToolResult(result: any, toolId: string): void {
    if (typeof result === 'string') {
      const lines = result.split('\n');
      const lineCount = lines.length;
      
      if (lineCount === 1) {
        this.logToolResult(`   ✅ 結果: ${this.truncateText(result, 100)}`, toolId);
      } else if (lineCount <= 5) {
        this.logToolResult(`   ✅ 結果: ${lineCount}行の出力`, toolId);
        lines.forEach(line => {
          if (line.trim()) {
            this.debug(`   │ ${this.truncateText(line, 80)}`, { parentLogId: toolId });
          }
        });
      } else {
        this.logToolResult(`   ✅ 結果: ${lineCount}行の出力（抜粋）`, toolId);
        lines.slice(0, 3).forEach(line => {
          if (line.trim()) {
            this.debug(`   │ ${this.truncateText(line, 80)}`, { parentLogId: toolId });
          }
        });
        this.debug(`   │ ... (他${lineCount - 3}行)`, { parentLogId: toolId });
      }
    } else if (typeof result === 'object' && result !== null) {
      this.logToolResult(`   ✅ 結果: オブジェクト形式`, toolId);
      const preview = JSON.stringify(result, null, 2);
      this.debug(`   │ ${this.truncateText(preview, 150)}`, { parentLogId: toolId });
    } else {
      this.logToolResult(`   ✅ 結果: ${String(result)}`, toolId);
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
   * レビュー用プロンプトを構築
   */
  private buildReviewPrompt(task: Task, engineerResult: EngineerResult): string {
    return `
🔍 テックリードによるコードレビュー開始

あなたは経験豊富なテックリードです。
エンジニアAIが実装したタスクをレビューしてください。

## 📋 レビュー対象情報
- **タスクID**: ${task.id}
- **タイトル**: ${task.title}
- **作業ディレクトリ**: ${task.worktreePath}
- **実装時間**: ${engineerResult.duration}ms
- **変更ファイル数**: ${engineerResult.filesChanged.length}個
- **実装結果**: ${engineerResult.success ? '成功' : '失敗'}

## 📝 タスク要件
${task.description}

## 📁 変更されたファイル
${engineerResult.filesChanged.length > 0 
  ? engineerResult.filesChanged.map(file => `- ${file}`).join('\n')
  : '変更されたファイルなし'
}

## 🔍 レビュー手順

### 1. 実装状況の確認
まず、変更されたファイルを詳しく確認してください：

\`\`\`bash
# 1. 直近のコミット履歴を確認（重要）
git log --oneline -n 10
git log --oneline --graph -n 20

# 2. 最新のコミットの詳細を確認
git show HEAD
git show HEAD~1
git show HEAD~2

# 3. 変更状況を確認
git status
git diff --staged

# 4. 元ブランチとの差分を確認（これが重要）
# まず、現在のブランチがどこから分岐したか確認
git merge-base HEAD @{-1} 2>/dev/null || git merge-base HEAD main 2>/dev/null || git merge-base HEAD master

# 分岐元との差分を確認
git diff $(git merge-base HEAD @{-1} 2>/dev/null || git merge-base HEAD main 2>/dev/null || git merge-base HEAD master)...HEAD

# 5. 変更されたファイルの内容を確認
# 変更されたファイルごとに内容を読み込んで、実際の変更を理解してください
\`\`\`

**重要**: タスクの説明と実際のコミット内容が異なる場合があります。
例：タスクで「HeyをGood Morningに変更」とあっても、実際には「HelloをGood Morningに変更」かもしれません。
コミット履歴と実際のファイル内容を確認し、タスクの意図が達成されているかを判断してください。

特に以下のケースに注意：
- コンフリクト解消のコミットがある場合（"resolve:", "Merge branch" などのコミットメッセージ）
- 複数のコミットで段階的に変更されている場合
- 元のファイルの内容がタスク説明と異なっていた場合

これらの場合は、最終的な状態がタスクの意図を満たしているかで判断してください。

### 2. 必須チェック項目の確認
以下を順番に確認してください：

#### 🏗️ プロジェクトアーキテクチャ適合性の確認（重要）
**重大な不適合がある場合は CHANGES_REQUESTED を検討してください**

- [ ] **ファイル配置の適切性**: 追加・変更されたファイルが適切なディレクトリに配置されているか
  - AIエージェント/コア機能: \`src/managers/\` に配置されているか
  - ユーティリティ/補助機能: \`src/utils/\` に配置されているか
  - 型定義: \`src/types/\` に配置されているか
  - Electronアプリ関連: \`electron/\` に配置されているか
  - ドキュメント: \`docs/\` に配置されているか

- [ ] **既存パターンとの整合性**:
  - クラス設計パターン: BaseAIを継承するAIエージェントパターンに従っているか
  - ファイル命名規則: 既存ファイルと一貫した命名になっているか
  - インポート/エクスポート: プロジェクトの規則に従っているか
  - TypeScript使用規則: 型安全性が適切に確保されているか

- [ ] **責務分割の適切性**:
  - managers: ビジネスロジックとAIエージェントの実装に集中しているか
  - utils: 汎用的なユーティリティ機能に限定されているか
  - types: 型定義の適切な抽象化がされているか

- [ ] **依存関係の健全性**: 循環依存がなく、適切なレイヤー間の依存関係になっているか

#### ✅ 機能実装の確認
- [ ] 要求された機能が正しく実装されている
- [ ] エラーハンドリングが適切に実装されている
- [ ] 入出力の検証が適切に行われている

#### ✅ テストの確認
- [ ] 新機能に対するテストが作成されている
- [ ] テストケースが適切で十分である
- [ ] エッジケースへの対応が考慮されている

#### ✅ コード品質の確認
- [ ] コードが読みやすく保守しやすい
- [ ] 適切な命名規則に従っている
- [ ] コード重複がない
- [ ] 適切なコメントが付いている

#### ✅ セキュリティの確認
- [ ] セキュリティベストプラクティスに従っている
- [ ] 入力値検証が適切に行われている
- [ ] 機密情報の適切な取り扱い

#### ✅ パフォーマンスの確認
- [ ] 不要な処理やループがない
- [ ] リソースの適切な管理
- [ ] スケーラビリティへの配慮

### 3. 参考情報の収集（オプション）
必要に応じて、以下の情報を参考にできます：

- プロジェクトの構造（package.json、tsconfig.jsonなど）
- 関連ファイルの内容
- 既存のコードパターンや規約

**注意**: テストの実行、ビルドの確認、リントチェックはエンジニアAIの責務です。
レビューでは、コードの品質と要件の充足性に焦点を当ててください。

### 4. レビュー結果の決定

以下の基準で判定してください：

- **APPROVED**: 
  - タスクの意図が達成されている（文字通りの要求ではなく、意図を重視）
  - 全ての必須項目をクリアし、品質基準を満たしている  
  - **重要**: プロジェクトのアーキテクチャパターンに適合している
  - コンフリクト解消などで要求と実装が異なる場合でも、目的が達成されていればAPPROVED
  
- **CHANGES_REQUESTED**: 
  - タスクの意図が達成されていない
  - 修正が必要な問題がある
  - **重要**: プロジェクトアーキテクチャに大きく不適合な場合
    - 不適切なディレクトリにファイルが配置されている
    - 既存のコードパターンから大きく逸脱している
    - 循環依存を生じさせている
    - プロジェクトの責務分割に反している
    - 既存の命名規則に従っていない
  - ただし、単に文言が異なるだけで意図が達成されている場合は、CHANGES_REQUESTEDにしない
  
- **COMMENTED**: 
  - タスクは達成されているが改善提案がある
  - コードの品質向上のための提案がある場合
  - アーキテクチャは適合しているが、より良い設計パターンがある場合

## 📋 レビューレポートの作成

最後に、以下の形式でレビュー結果をまとめてください：

\`\`\`
## レビュー結果: [APPROVED/CHANGES_REQUESTED/COMMENTED]

### 🏗️ プロジェクトアーキテクチャ適合性の評価
- [ディレクトリ構造、既存パターン、責務分割への適合状況を評価]
- [具体的な不適合がある場合は詳細に記載]

### ✅ 良い点
- [具体的な良い点を記載]

### ⚠️ 指摘事項 (該当がある場合)
- [修正が必要な点を具体的に記載]
- [ファイル名:行数] を明記
- **アーキテクチャ不適合**: [具体的な不適合内容と修正方法]

### 💡 改善提案 (該当がある場合)
- [任意の改善提案を記載]

### 📊 総合評価
[実装の全体的な評価とコメント]
[特にプロジェクトアーキテクチャ適合性についての総合的な判断]
\`\`\`

厳格かつ建設的なレビューを実施してください。品質向上のため遠慮なく指摘してください。`;
  }

  /**
   * レビューコメントからステータスを解析
   */
  private parseReviewStatus(comments: string[]): 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'ERROR' {
    const fullText = comments.join(' ');
    const upperText = fullText.toUpperCase();
    
    // 明示的なステータス宣言を最優先
    if (upperText.includes('レビュー結果: APPROVED') || upperText.includes('## レビュー結果: APPROVED')) {
      return 'APPROVED';
    }
    if (upperText.includes('レビュー結果: CHANGES_REQUESTED') || upperText.includes('## レビュー結果: CHANGES_REQUESTED')) {
      return 'CHANGES_REQUESTED';
    }
    if (upperText.includes('レビュー結果: COMMENTED') || upperText.includes('## レビュー結果: COMMENTED')) {
      return 'COMMENTED';
    }
    
    // プロジェクトアーキテクチャ不適合の判定（重要）
    const architectureViolations = [
      'アーキテクチャ不適合',
      'ディレクトリ構造が不適切',
      '不適切なディレクトリ',
      '配置が間違っている',
      'ファイル配置が不適切',
      'プロジェクトパターンに違反',
      '既存パターンから逸脱',
      'コードパターンが一貫していない',
      '循環依存が発生',
      '責務分割に反している',
      '命名規則に従っていない'
    ];
    
    const hasArchitectureViolation = architectureViolations.some(violation => 
      fullText.includes(violation)
    );
    
    if (hasArchitectureViolation) {
      return 'CHANGES_REQUESTED';
    }
    
    // 次に、文脈を考慮した判定
    // 「修正が必要」「修正してください」など明確な指示がある場合
    if (fullText.includes('修正が必要') || fullText.includes('修正してください') || 
        fullText.includes('変更が必要') || fullText.includes('実装してください') ||
        fullText.includes('移動してください') || fullText.includes('再配置してください')) {
      return 'CHANGES_REQUESTED';
    }
    
    // 「承認」「問題ありません」など承認を示す表現
    if (upperText.includes('APPROVED') || fullText.includes('承認') || 
        fullText.includes('問題ありません') || fullText.includes('正しく実装されて') ||
        fullText.includes('プロジェクトアーキテクチャに適合') || fullText.includes('適切に配置されて') ||
        fullText.includes('既存パターンに従って')) {
      return 'APPROVED';
    }
    
    // 「改善提案」「将来的に」など、必須ではない提案
    if (fullText.includes('改善提案') || fullText.includes('将来的に') || 
        fullText.includes('検討してください') || upperText.includes('COMMENTED')) {
      return 'COMMENTED';  
    }
    
    // キーワードベースの判定（最後の手段）
    // ただし、「ビルドエラーが存在している」のような状況説明は除外
    const hasRequiredChanges = (fullText.includes('エラーを修正') || fullText.includes('問題を解決') || 
                                fullText.includes('バグ') || fullText.includes('失敗'));
    
    if (hasRequiredChanges && !fullText.includes('既存の') && !fullText.includes('確認しました')) {
      return 'CHANGES_REQUESTED';
    }
    
    // デフォルトはAPPROVED（タスクが達成されていると仮定）
    return 'APPROVED';
  }

  /**
   * テックリードIDを取得
   */
  getTechLeadId(): string {
    return this.techLeadId;
  }

  /**
   * 設定を取得
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * MergeCoordinatorを設定
   */
  setMergeCoordinator(mergeCoordinator: MergeCoordinator): void {
    this.mergeCoordinator = mergeCoordinator;
  }

  /**
   * レビュー承認後の協調マージを実行
   */
  async performCoordinatedMerge(
    task: Task,
    reviewResult: ReviewResult
  ): Promise<{
    success: boolean;
    conflictResolutionInProgress?: boolean;
    error?: string;
  }> {
    if (!this.mergeCoordinator) {
      throw new Error('MergeCoordinatorが設定されていません');
    }

    if (reviewResult.status !== 'APPROVED') {
      return {
        success: false,
        error: `レビューが承認されていません: ${reviewResult.status}`
      };
    }

    this.info(`🔀 協調マージ開始 - ${task.title}`);

    // コンフリクト解消用のコールバック関数
    const conflictResolutionHandler = async (
      conflictTask: Task,
      engineerId: string,
      existingEngineer?: EngineerAI
    ): Promise<EngineerResult> => {
      this.info(`🔧 コンフリクト解消依頼 - ${conflictTask.title}`);
      
      // 既存のエンジニアAIがあれば再利用、なければ新規作成
      const engineer = existingEngineer || new EngineerAI(engineerId, {
        systemPrompt: this.buildConflictResolutionPrompt(),
        maxTurns: 25,
        allowedTools: ["Read", "Write", "Edit", "MultiEdit", "Bash", "Glob", "Grep", "LS"]
      });

      // コンフリクト解消タスクを実行
      return await engineer.executeTask({
        ...conflictTask,
        title: `コンフリクト解消: ${conflictTask.title}`,
        description: `${conflictTask.description}\n\n## コンフリクト解消指示\nマージコンフリクトが発生しました。以下の手順で解消してください：\n1. git status でコンフリクトファイルを確認\n2. コンフリクトマーカーを手動で解消\n3. git add でステージング\n4. git commit でコミット完了`
      });
    };

    // 協調マージを実行
    const mergeResult = await this.mergeCoordinator.coordinatedMerge(
      task,
      conflictResolutionHandler
    );

    if (mergeResult.success) {
      this.success(`✅ マージ成功 - ${task.title}`);
    } else if (mergeResult.conflictResolutionInProgress) {
      this.warn(`⚠️ コンフリクト解消中（並列実行） - ${task.title}`);
    } else {
      this.error(`❌ マージ失敗 - ${task.title}: ${mergeResult.error}`);
    }

    return mergeResult;
  }

  /**
   * コンフリクト解消用のシステムプロンプト
   */
  private buildConflictResolutionPrompt(): string {
    return `あなたは経験豊富なソフトウェアエンジニアです。
マージコンフリクトの解消を専門に行います。

## コンフリクト解消の手順
1. **コンフリクト状況の確認**
   - \`git status\` でコンフリクトファイルを特定
   - \`git diff\` で競合内容を確認

2. **コンフリクトマーカーの解消**
   - \`<<<<<<<\`, \`=======\`, \`>>>>>>>\` マーカーを確認
   - 両方のブランチの変更を適切に統合
   - マーカーを完全に削除

3. **統合の確認**
   - 統合されたコードが正しく動作することを確認
   - 既存のテストが通ることを確認

4. **コミット完了**
   - \`git add\` で解消したファイルをステージング
   - \`git commit\` でマージコミット完了

## 重要事項
- コンフリクト解消は慎重に行ってください
- 両方のブランチの意図を理解して統合してください
- 機能の破綻や品質低下を避けてください
- 解消後は必ずテストを実行してください

効率的で品質の高いコンフリクト解消を心がけてください。`;
  }

  /**
   * 協調マージの状態を確認
   */
  getMergeStatus(): {
    isLocked: boolean;
    queueLength: number;
    pendingConflicts: number;
  } | null {
    if (!this.mergeCoordinator) {
      return null;
    }
    return this.mergeCoordinator.getMutexStatus();
  }
}