import { query, type SDKMessage } from "@anthropic-ai/claude-code";
import { Task, EngineerResult, AgentConfig } from '../types';

/**
 * エンジニアAIクラス
 * 具体的な開発タスクを実行する
 */
export class EngineerAI {
  private readonly config: AgentConfig;
  private readonly engineerId: string;
  private sessionId?: string;

  constructor(engineerId: string, config?: Partial<AgentConfig>) {
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
5. 作業完了時は必ずコミットしてください

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
- 変更内容が適切にコミットされている

効率的で高品質なコードを心がけてください。`;
  }

  /**
   * タスクを実行
   */
  async executeTask(task: Task): Promise<EngineerResult> {
    console.log(`👨‍💻 エンジニアAI[${this.engineerId}]: タスク実行開始`);
    console.log(`📋 タスク: ${task.title}`);

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

      console.log(`✅ エンジニアAI[${this.engineerId}]: タスク完了 (${duration}ms)`);

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

      console.error(`❌ エンジニアAI[${this.engineerId}]: タスク失敗:`, error);

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
              console.log(`📝 エンジニアAI[${this.engineerId}]: 入力受信 - ${this.truncateText(content.text, 100)}`);
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
              console.log(`🔧 エンジニアAI[${this.engineerId}]: ${this.truncateText(text, 200)}`);
              output.push(text);
            } else if (content.type === 'tool_use') {
              const toolName = content.name;
              const toolId = content.id;
              const toolInput = content.input || {};
              console.log(`🛠️  エンジニアAI[${this.engineerId}]: ツール実行 - ${toolName}`);
              this.displayToolExecutionDetails(toolName, toolInput, toolId);
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
              
              console.log(`📊 エンジニアAI[${this.engineerId}]: ツール結果 - ${status}`);
              
              if (isError) {
                console.log(`   ❌ エラー詳細: ${this.truncateText(String(result), 150)}`);
              } else {
                this.displayToolResult(result, toolUseId);
              }
            }
          }
        }
        break;

      case 'error':
        // エラーメッセージ
        console.log(`❌ エンジニアAI[${this.engineerId}]: エラーが発生しました`);
        if (message.error) {
          console.log(`   ❌ エラー: ${this.truncateText(String(message.error), 200)}`);
        }
        break;

      case 'system':
        // システムメッセージ
        console.log(`⚙️  エンジニアAI[${this.engineerId}]: システム通知`);
        if (message.content) {
          console.log(`   📋 内容: ${this.truncateText(String(message.content), 150)}`);
        }
        break;

      case 'thinking':
        // 思考過程（内部処理）
        console.log(`🤔 エンジニアAI[${this.engineerId}]: 思考中...`);
        break;

      case 'event':
        // イベント通知
        if (message.event_type) {
          console.log(`📢 エンジニアAI[${this.engineerId}]: イベント - ${message.event_type}`);
        }
        break;

      default:
        // 未知のメッセージタイプ
        console.log(`🔍 エンジニアAI[${this.engineerId}]: 未知のメッセージタイプ - ${messageType}`);
        break;
    }
  }

  /**
   * ツール実行の詳細を表示
   */
  private displayToolExecutionDetails(toolName: string, toolInput: any, _toolId: string): void {
    switch (toolName) {
      case 'Read':
        console.log(`   📖 ファイル読み取り: ${toolInput.file_path || 'パス不明'}`);
        if (toolInput.offset || toolInput.limit) {
          console.log(`   📄 範囲: ${toolInput.offset || 0}行目から${toolInput.limit || '全て'}行`);
        }
        break;

      case 'Write':
        console.log(`   ✍️  ファイル書き込み: ${toolInput.file_path || 'パス不明'}`);
        if (toolInput.content) {
          const contentLength = String(toolInput.content).length;
          console.log(`   📝 内容サイズ: ${contentLength}文字`);
        }
        break;

      case 'Edit':
        console.log(`   ✏️  ファイル編集: ${toolInput.file_path || 'パス不明'}`);
        if (toolInput.old_string) {
          console.log(`   🔍 検索: "${this.truncateText(toolInput.old_string, 50)}"`);
        }
        if (toolInput.new_string) {
          console.log(`   🔄 置換: "${this.truncateText(toolInput.new_string, 50)}"`);
        }
        break;

      case 'MultiEdit':
        console.log(`   📝 複数編集: ${toolInput.file_path || 'パス不明'}`);
        if (toolInput.edits && Array.isArray(toolInput.edits)) {
          console.log(`   🔢 編集数: ${toolInput.edits.length}個`);
        }
        break;

      case 'Bash':
        console.log(`   💻 コマンド実行: ${this.truncateText(toolInput.command || 'コマンド不明', 100)}`);
        if (toolInput.timeout) {
          console.log(`   ⏱️  タイムアウト: ${toolInput.timeout}ms`);
        }
        break;

      case 'Glob':
        console.log(`   🔍 ファイル検索: ${toolInput.pattern || 'パターン不明'}`);
        if (toolInput.path) {
          console.log(`   📁 検索パス: ${toolInput.path}`);
        }
        break;

      case 'Grep':
        console.log(`   🔎 内容検索: ${toolInput.pattern || 'パターン不明'}`);
        if (toolInput.include) {
          console.log(`   📂 対象ファイル: ${toolInput.include}`);
        }
        break;

      case 'LS':
        console.log(`   📂 ディレクトリ一覧: ${toolInput.path || 'パス不明'}`);
        break;

      default:
        console.log(`   ⚙️  パラメータ: ${JSON.stringify(toolInput).substring(0, 100)}...`);
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
        console.log(`   ✅ 結果: ${this.truncateText(result, 100)}`);
      } else {
        console.log(`   ✅ 結果: ${lineCount}行の出力`);
        // 最初の数行を表示
        const previewLines = lines.slice(0, 3);
        previewLines.forEach(line => {
          if (line.trim()) {
            console.log(`   │ ${this.truncateText(line, 80)}`);
          }
        });
        if (lineCount > 3) {
          console.log(`   │ ... (他${lineCount - 3}行)`);
        }
      }
    } else if (typeof result === 'object' && result !== null) {
      console.log(`   ✅ 結果: オブジェクト形式`);
      const preview = JSON.stringify(result, null, 2);
      console.log(`   │ ${this.truncateText(preview, 150)}`);
    } else {
      console.log(`   ✅ 結果: ${String(result)}`);
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
   - 適切なコミットメッセージでコミット

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
4. 実装完了後、変更内容を適切なコミットメッセージでコミットしてください

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
      console.warn(`⚠️ 変更ファイル取得エラー:`, error);
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
}
