import { query, type SDKMessage } from "@anthropic-ai/claude-code";
import { Task, EngineerResult, AgentConfig } from '../types';
import { BaseAI } from './BaseAI';
import { ComponentType } from '../types/logging';

/**
 * エンジニアAIクラス
 * 具体的な開発タスクを実行する
 */
export class EngineerAI extends BaseAI {
  private readonly config: AgentConfig;
  private readonly engineerId: string;
  private sessionId?: string;

  // 新しいパイプラインシステムのためのidプロパティ
  get id(): string {
    return this.engineerId;
  }

  constructor(engineerId: string, config?: Partial<AgentConfig>) {
    super();
    this.engineerId = engineerId;
    this.config = {
      systemPrompt: this.getDefaultSystemPrompt(),
      maxTurns: 20,
      allowedTools: ["Read", "Write", "Edit", "MultiEdit", "Bash", "Glob", "Grep", "LS"],
      ...config
    };
  }

  /**
   * デフォルトのシステムプロンプト
   */
  private getDefaultSystemPrompt(): string {
    return `あなたは経験豊富なソフトウェアエンジニアです（ID: ${this.engineerId}）。
与えられたタスクを正確に実装することが役割です。

## 作業方針
1. まず、現在のコードベースを理解してください
2. タスクの要件を正確に把握してください
3. 段階的に実装を進めてください
4. 適切なテストを作成してください
5. 作業完了時は必ず明確で詳細なコミットメッセージでコミットしてください

## 重要な注意事項
- 既存のコード規約とパターンに従ってください
- 破壊的変更は避け、後方互換性を保ってください
- エラーハンドリングを適切に実装してください
- セキュリティベストプラクティスに従ってください
- 実装前に必要なファイルとディレクトリ構造を確認してください

## 作業完了の条件
- 要求された機能が正常に動作する
- 既存のテストが引き続き通る
- 新しい機能に対するテストが作成されている
- 変更内容が明確で詳細なコミットメッセージでコミットされている

## コミットメッセージの形式
必ず以下の形式でコミットしてください：
\`\`\`
<タイプ>: <変更内容の要約>

- 変更の詳細（具体的に）
- 変更前 → 変更後の状態
- ファイル名と変更箇所
\`\`\`

例:
\`\`\`
feat: ユーザー認証機能を追加

- /api/auth エンドポイントを新規作成
- JWTトークンによる認証を実装
- User.tsにauthenticate()メソッドを追加
\`\`\`

**重要**: レビュアーが変更内容を正確に理解できるよう、具体的で詳細な説明を含めてください

効率的で高品質なコードを心がけてください。`;
  }

  /**
   * タスクを実行
   */
  async executeTask(task: Task): Promise<EngineerResult> {
    this.info(`👨‍💻 タスク実行開始`, { taskId: task.id, taskTitle: task.title });
    this.info(`📋 タスク: ${task.title}`);

    const startTime = Date.now();
    const prompt = this.buildTaskPrompt(task);

    try {
      const messages: SDKMessage[] = [];
      const output: string[] = [];

      for await (const message of query({
        prompt,
        abortController: new AbortController(),
        options: {
          maxTurns: this.config.maxTurns,
          cwd: task.worktreePath,
          permissionMode: 'acceptEdits',
          allowedTools: this.config.allowedTools,
          resume: this.sessionId // 既存セッションがあれば再利用
        },
      })) {
        messages.push(message);

        // セッションIDを保存
        if (message && typeof message === 'object' && 'session_id' in message) {
          this.sessionId = message.session_id;
        }

        // リアルタイムでエンジニアAIの作業状況を表示
        if (message && typeof message === 'object' && 'type' in message) {
          this.displayMessageActivity(message as any, output);
        }
      }

      const duration = Date.now() - startTime;
      const filesChanged = await this.getChangedFiles(task.worktreePath || '');

      this.success(`✅ タスク完了 (${duration}ms)`, { taskId: task.id, duration });

      return {
        taskId: task.id,
        engineerId: this.engineerId,
        success: true,
        output,
        duration,
        filesChanged
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      this.error(`❌ タスク失敗: ${error instanceof Error ? error.message : String(error)}`, { taskId: task.id, error: error instanceof Error ? error.stack : String(error) });

      return {
        taskId: task.id,
        engineerId: this.engineerId,
        success: false,
        output: [],
        error: error instanceof Error ? error.message : String(error),
        duration,
        filesChanged: []
      };
    }
  }

  /**
   * メッセージアクティビティを表示
   */
  private displayMessageActivity(message: any, output: string[]): void {
    const messageType = message.type;
    
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
        // アシスタントメッセージ（出力）
        if (message.message && message.message.content) {
          for (const content of message.message.content) {
            if (content.type === 'text') {
              const text = content.text;
              this.info(`🔧 ${this.truncateText(text, 200)}`);
              output.push(text);
            } else if (content.type === 'tool_use') {
              const toolName = content.name;
              const toolId = content.id;
              const toolInput = content.input || {};
              const toolExecutionId = this.logToolExecution(toolName, this.getToolDescription(toolName, toolInput));
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
              
              if (isError) {
                this.error(`📊 ツール結果 - ${status}`);
                this.error(`   ❌ エラー詳細: ${this.truncateText(String(result), 150)}`);
              } else {
                this.debug(`📊 ツール結果 - ${status}`);
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
        this.debug(`🤔 思考中...`);
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
  }

  /**
   * ツール実行の詳細を表示
   */
  private displayToolExecutionDetails(toolName: string, toolInput: any, _toolId: string, toolExecutionId?: string): void {
    switch (toolName) {
      case 'Read':
        this.debug(`   📖 ファイル読み取り: ${toolInput.file_path || 'パス不明'}`, { parentLogId: toolExecutionId });
        if (toolInput.offset || toolInput.limit) {
          this.debug(`   📄 範囲: ${toolInput.offset || 0}行目から${toolInput.limit || '全て'}行`, { parentLogId: toolExecutionId });
        }
        break;

      case 'Write':
        this.debug(`   ✍️  ファイル書き込み: ${toolInput.file_path || 'パス不明'}`, { parentLogId: toolExecutionId });
        if (toolInput.content) {
          const contentLength = String(toolInput.content).length;
          this.debug(`   📝 内容サイズ: ${contentLength}文字`, { parentLogId: toolExecutionId });
        }
        break;

      case 'Edit':
        this.debug(`   ✏️  ファイル編集: ${toolInput.file_path || 'パス不明'}`, { parentLogId: toolExecutionId });
        if (toolInput.old_string) {
          this.debug(`   🔍 検索: "${this.truncateText(toolInput.old_string, 50)}"`, { parentLogId: toolExecutionId });
        }
        if (toolInput.new_string) {
          this.debug(`   🔄 置換: "${this.truncateText(toolInput.new_string, 50)}"`, { parentLogId: toolExecutionId });
        }
        break;

      case 'MultiEdit':
        this.debug(`   📝 複数編集: ${toolInput.file_path || 'パス不明'}`, { parentLogId: toolExecutionId });
        if (toolInput.edits && Array.isArray(toolInput.edits)) {
          this.debug(`   🔢 編集数: ${toolInput.edits.length}個`, { parentLogId: toolExecutionId });
        }
        break;

      case 'Bash':
        this.debug(`   💻 コマンド実行: ${this.truncateText(toolInput.command || 'コマンド不明', 100)}`, { parentLogId: toolExecutionId });
        if (toolInput.timeout) {
          this.debug(`   ⏱️  タイムアウト: ${toolInput.timeout}ms`, { parentLogId: toolExecutionId });
        }
        break;

      case 'Glob':
        this.debug(`   🔍 ファイル検索: ${toolInput.pattern || 'パターン不明'}`, { parentLogId: toolExecutionId });
        if (toolInput.path) {
          this.debug(`   📁 検索パス: ${toolInput.path}`, { parentLogId: toolExecutionId });
        }
        break;

      case 'Grep':
        this.debug(`   🔎 内容検索: ${toolInput.pattern || 'パターン不明'}`, { parentLogId: toolExecutionId });
        if (toolInput.include) {
          this.debug(`   📂 対象ファイル: ${toolInput.include}`, { parentLogId: toolExecutionId });
        }
        break;

      case 'LS':
        this.debug(`   📂 ディレクトリ一覧: ${toolInput.path || 'パス不明'}`, { parentLogId: toolExecutionId });
        break;

      default:
        this.debug(`   ⚙️  パラメータ: ${JSON.stringify(toolInput).substring(0, 100)}...`, { parentLogId: toolExecutionId });
        break;
    }
  }

  /**
   * ツール実行結果を表示
   */
  private displayToolResult(result: any, _toolId: string): void {
    if (typeof result === 'string') {
      const lines = result.split('\n');
      const lineCount = lines.length;
      
      if (lineCount === 1) {
        this.debug(`   ✅ 結果: ${this.truncateText(result, 100)}`);
      } else {
        this.debug(`   ✅ 結果: ${lineCount}行の出力`);
        // 最初の数行を表示
        const previewLines = lines.slice(0, 3);
        previewLines.forEach(line => {
          if (line.trim()) {
            this.debug(`   │ ${this.truncateText(line, 80)}`);
          }
        });
        if (lineCount > 3) {
          this.debug(`   │ ... (他${lineCount - 3}行)`);
        }
      }
    } else if (typeof result === 'object' && result !== null) {
      this.debug(`   ✅ 結果: オブジェクト形式`);
      const preview = JSON.stringify(result, null, 2);
      this.debug(`   │ ${this.truncateText(preview, 150)}`);
    } else {
      this.debug(`   ✅ 結果: ${String(result)}`);
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
   * タスク実行用プロンプトを構築
   */
  private buildTaskPrompt(task: Task): string {
    const instructionFile = (task as any).instructionFile;
    const hasInstructionFile = instructionFile && require('fs').existsSync(instructionFile);

    if (hasInstructionFile) {
      // 指示ファイルがある場合
      return `
🎯 エンジニアAIタスク実行開始

あなたは経験豊富なソフトウェアエンジニアです。
以下のタスクを担当してください：

## 📋 基本情報
- **タスクID**: ${task.id}
- **タイトル**: ${task.title}
- **作業ディレクトリ**: ${task.worktreePath}

## 📖 詳細指示の確認

**最初に必ず以下のファイルを読んで、詳細な実装指示を確認してください：**

\`\`\`bash
# 詳細なタスク指示を確認
cat "${instructionFile}"
\`\`\`

このファイルには以下の重要な情報が含まれています：
- 具体的な実装手順
- 成功条件・完了確認項目
- 注意事項
- 技術的なガイドライン

## 🚀 作業開始手順

1. **指示ファイルの確認** (最優先)
   - 上記のcatコマンドで詳細指示を必ず読んでください

2. **コードベースの理解**
   - プロジェクト構造の把握
   - 既存のコード規約の確認

3. **実装の実行**
   - 指示ファイルの手順に従って実装
   - 段階的な進行

4. **動作確認とコミット**
   - テストの実行
   - 明確で詳細なコミットメッセージでコミット
   
   ### 📝 コミットメッセージの書き方
   以下の形式で、**何を変更したのか具体的に**記載してください：
   
   \`\`\`
   <タイプ>: <変更内容の要約>
   
   - 変更の詳細1
   - 変更の詳細2
   - 元の状態 → 変更後の状態（具体的に）
   \`\`\`
   
   例：
   \`\`\`
   feat: TEST.mdのHelloをGood Morningに変更
   
   - TEST.md内の挨拶文を更新
   - "Hello World!" → "Good Morning World!"
   - タスク要件に従って朝の挨拶に変更
   \`\`\`
   
   **重要**: レビュアーが変更内容を理解しやすいよう、以下を含めてください：
   - 変更前と変更後の具体的な内容
   - ファイル名と変更箇所
   - タスクとの関連性

## ⚠️ 重要
プロダクトオーナーAIが作成した詳細な指示ファイルを必ず最初に確認してから作業を開始してください。
このファイルには具体的で実行可能な手順が記載されています。

作業を開始してください！`;
    } else {
      // 指示ファイルがない場合（フォールバック）
      return `
エンジニアとして、以下のタスクを実装してください：

## タスク情報
- **ID**: ${task.id}
- **タイプ**: ${task.type}
- **タイトル**: ${task.title}
- **優先度**: ${task.priority}

## 詳細要件
${task.description}

## 作業ディレクトリ
${task.worktreePath}

## 実行手順
1. 現在のコードベースを調査して理解してください
2. タスクの要件を満たすための実装計画を立ててください
3. 段階的に実装を進めてください：
   - 必要なファイルとディレクトリの作成
   - コードの実装
   - テストの作成
   - 動作確認
4. 実装完了後、変更内容を明確で詳細なコミットメッセージでコミットしてください

### 📝 コミットメッセージの書き方
以下の形式で、**何を変更したのか具体的に**記載してください：

\`\`\`
<タイプ>: <変更内容の要約>

- 変更の詳細1
- 変更の詳細2
- 元の状態 → 変更後の状態（具体的に）
\`\`\`

タイプの例：
- feat: 新機能追加
- fix: バグ修正
- refactor: リファクタリング
- test: テスト追加・修正
- docs: ドキュメント更新

**重要**: レビュアーが変更内容を理解しやすいよう、以下を含めてください：
- 変更前と変更後の具体的な内容
- ファイル名と変更箇所
- タスクとの関連性

## 成功基準
- 要求された機能が正常に動作する
- 既存の機能に影響を与えない
- 適切なテストが作成されている
- コードが規約に従っている

質問や不明点があれば、コードを調査して判断してください。
作業を開始してください。`;
    }
  }

  /**
   * 変更されたファイルのリストを取得
   */
  private async getChangedFiles(worktreePath: string): Promise<string[]> {
    try {
      if (!worktreePath) return [];

      const { execSync } = require('child_process');

      // ステージされた変更とワーキングディレクトリの変更を取得
      const output = execSync('git status --porcelain', {
        cwd: worktreePath,
        encoding: 'utf-8',
        stdio: 'pipe'
      });

      return output
        .trim()
        .split('\n')
        .filter((line: string) => line.trim())
        .map((line: string) => line.substring(3)); // ステータス文字を除去

    } catch (error) {
      this.warn(`⚠️ 変更ファイル取得エラー: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * タスクの事前チェック
   */
  async validateTask(task: Task): Promise<{ valid: boolean; reason?: string }> {
    // worktreeパスの存在確認
    if (!task.worktreePath) {
      return { valid: false, reason: 'Worktreeパスが設定されていません' };
    }

    const fs = require('fs');
    if (!fs.existsSync(task.worktreePath)) {
      return { valid: false, reason: `Worktreeが存在しません: ${task.worktreePath}` };
    }

    // ブランチの確認
    try {
      const { execSync } = require('child_process');
      const currentBranch = execSync('git branch --show-current', {
        cwd: task.worktreePath,
        encoding: 'utf-8',
        stdio: 'pipe'
      }).trim();

      if (currentBranch !== task.branchName) {
        return {
          valid: false,
          reason: `ブランチが一致しません。期待: ${task.branchName}, 実際: ${currentBranch}`
        };
      }

    } catch (error) {
      return { valid: false, reason: `ブランチ確認エラー: ${error}` };
    }

    return { valid: true };
  }

  /**
   * エンジニアIDを取得
   */
  getEngineerId(): string {
    return this.engineerId;
  }

  /**
   * 設定を取得
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * セッションIDを取得
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * セッションIDを設定
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /**
   * BaseAIの抽象メソッドの実装
   */
  protected getComponentType(): ComponentType {
    return 'Engineer';
  }

  protected getId(): string {
    return this.engineerId;
  }

  /**
   * ツールの説明を取得
   */
  private getToolDescription(toolName: string, toolInput: any): string {
    switch (toolName) {
      case 'Read':
        return `ファイル読み取り: ${toolInput.file_path || 'パス不明'}`;
      case 'Write':
        return `ファイル書き込み: ${toolInput.file_path || 'パス不明'}`;
      case 'Edit':
        return `ファイル編集: ${toolInput.file_path || 'パス不明'}`;
      case 'MultiEdit':
        return `複数編集: ${toolInput.file_path || 'パス不明'}`;
      case 'Bash':
        return `コマンド実行: ${this.truncateText(toolInput.command || 'コマンド不明', 50)}`;
      case 'Glob':
        return `ファイル検索: ${toolInput.pattern || 'パターン不明'}`;
      case 'Grep':
        return `内容検索: ${toolInput.pattern || 'パターン不明'}`;
      case 'LS':
        return `ディレクトリ一覧: ${toolInput.path || 'パス不明'}`;
      default:
        return `${toolName}実行`;
    }
  }
}
