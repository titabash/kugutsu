/**
 * MessageHandler
 *
 * AI Provider からのストリーミングメッセージを処理し、
 * ユーザーフレンドリーな進捗表示を提供します。
 */

import type { AIMessage } from '../providers/IAIProvider.js';

/**
 * MessageHandler のオプション
 */
export interface MessageHandlerOptions {
  /**
   * 最大ターン数
   */
  maxTurns: number;

  /**
   * タスクID（オプション）
   */
  taskId?: string;

  /**
   * ノード名（表示用）
   */
  nodeName: string;

  /**
   * 詳細ログモード
   * true: ストリーミングテキストをリアルタイム表示
   * false: ドットで進行状況を表示（デフォルト）
   */
  verbose?: boolean;
}

/**
 * エラー詳細情報
 */
export interface ErrorDetails {
  /**
   * エラーサブタイプ（error_max_turns | error_during_execution）
   */
  subtype?: string;

  /**
   * エラーメッセージ
   */
  message?: string;
}

/**
 * MessageHandler
 *
 * AI実行中のメッセージを処理し、進捗状況を表示します。
 *
 * 使用例:
 * ```typescript
 * const handler = new MessageHandler({
 *   maxTurns: 30,
 *   nodeName: 'ProductOwner',
 *   taskId: 'task-001'
 * });
 *
 * for await (const message of provider.execute(prompt, {
 *   maxTurns,
 *   includePartialMessages: true,
 * })) {
 *   await handler.handleMessage(message);
 * }
 *
 * // エラーチェック（重要）
 * if (handler.getHasError()) {
 *   throw new Error('AI実行がエラーで終了しました');
 * }
 *
 * handler.complete(true, '完了しました');
 * ```
 */
export class MessageHandler {
  private turnCount = 0;
  private options: MessageHandlerOptions;
  private lastToolName: string | null = null;
  private dotCounter = 0;
  private hasError = false;
  private errorDetails?: ErrorDetails;

  constructor(options: MessageHandlerOptions) {
    this.options = options;
    this.logStart();
  }

  /**
   * 開始ログを表示
   */
  private logStart(): void {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 ${this.options.nodeName} 開始`);
    if (this.options.taskId) {
      console.log(`   Task ID: ${this.options.taskId}`);
    }
    console.log(`   最大ターン数: ${this.options.maxTurns}`);
    console.log(`${'='.repeat(60)}\n`);
  }

  /**
   * メッセージを処理
   */
  public async handleMessage(message: AIMessage): Promise<void> {
    switch (message.type) {
      case 'assistant':
        this.handleAssistant(message);
        break;
      case 'partial':
        this.handlePartial(message);
        break;
      case 'system':
        this.handleSystem(message);
        break;
      case 'result':
        this.handleResult(message);
        // resultメッセージでエラーを検出（Claude Agent SDK仕様準拠）
        if (message.content && !message.content.success) {
          this.hasError = true;
          this.errorDetails = {
            subtype: message.content.subtype,
            message: message.content.error,
          };
        }
        break;
      case 'user':
        // ユーザーメッセージは通常表示不要
        break;
      default:
        // 未知のメッセージタイプ
        if (this.options.verbose) {
          console.log(`⚠️  未知のメッセージタイプ: ${message.type}`);
        }
    }
  }

  /**
   * Assistantメッセージを処理
   */
  private handleAssistant(message: AIMessage): void {
    if (!message.content) return;

    // ドット表示中なら改行
    if (this.dotCounter > 0) {
      console.log(''); // 改行
      this.dotCounter = 0;
    }

    const text = typeof message.content === 'string'
      ? message.content
      : JSON.stringify(message.content);

    // 最初の150文字のみ表示
    const preview = text.length > 150
      ? text.substring(0, 150) + '...'
      : text;

    console.log(`💬 AI: ${preview}`);
  }

  /**
   * Partialメッセージ（ストリーミング中）を処理
   */
  private handlePartial(message: AIMessage): void {
    if (!this.options.verbose) {
      // 非詳細モード: ドットで進行表示
      process.stdout.write('.');
      this.dotCounter++;

      // 60ドットごとに改行
      if (this.dotCounter >= 60) {
        console.log('');
        this.dotCounter = 0;
      }
      return;
    }

    // 詳細モード: ストリーミングテキスト表示
    if (message.content?.type === 'content_block_delta') {
      const delta = message.content.delta;
      if (delta?.text) {
        process.stdout.write(delta.text);
      }
    }
  }

  /**
   * Systemメッセージを処理
   */
  private handleSystem(message: AIMessage): void {
    const content = message.content;

    // ドット表示中なら改行
    if (this.dotCounter > 0) {
      console.log(''); // 改行
      this.dotCounter = 0;
    }

    // ツール実行進捗（Claude Agent SDK）
    if (content?.toolProgress) {
      const { tool_name, elapsed_time_seconds } = content.toolProgress;

      // 同じツールの進捗更新は行単位で更新
      if (this.lastToolName === tool_name) {
        // 前の行を上書き（ANSI escape code）
        process.stdout.write(`\r🔧 ${tool_name} 実行中... (${elapsed_time_seconds}秒経過)`);
      } else {
        // 新しいツール
        if (this.lastToolName) {
          console.log(''); // 前のツールの改行
        }
        console.log(`🔧 ${tool_name} 実行中... (${elapsed_time_seconds}秒経過)`);
        this.lastToolName = tool_name;
      }
      return;
    }

    // ツール名が変わったらリセット
    this.lastToolName = null;

    // コマンド実行（OpenAI Codex）
    if (content?.commandExecution) {
      const { command, output } = content.commandExecution;
      console.log(`⚙️  コマンド実行: ${command}`);
      if (this.options.verbose && output) {
        const preview = output.length > 200
          ? output.substring(0, 200) + '...'
          : output;
        console.log(`   出力: ${preview}`);
      }
      return;
    }

    // ファイル変更（OpenAI Codex）
    if (content?.fileChange) {
      const changeCount = content.fileChange.changes?.length || 0;
      console.log(`📝 ファイル変更: ${changeCount}件`);
      return;
    }

    // MCP Tool Call（OpenAI Codex）
    if (content?.mcpToolCall) {
      console.log(`🔌 MCP Tool: ${content.mcpToolCall.tool_name}`);
      return;
    }

    // その他のSystemメッセージ
    if (this.options.verbose) {
      console.log(`ℹ️  System: ${JSON.stringify(content).substring(0, 100)}`);
    }
  }

  /**
   * Resultメッセージ（完了）を処理
   */
  private handleResult(message: AIMessage): void {
    // ドット表示中なら改行
    if (this.dotCounter > 0) {
      console.log(''); // 改行
      this.dotCounter = 0;
    }

    // ツール進捗表示中なら改行
    if (this.lastToolName) {
      console.log('');
      this.lastToolName = null;
    }

    console.log(`\n${'='.repeat(60)}`);

    if (message.content?.success) {
      console.log(`✅ ${this.options.nodeName} 完了`);

      const tokenUsage = message.content.tokenUsage;
      if (tokenUsage) {
        console.log(`   トークン使用: ${tokenUsage.total || 0}`);
      }

      const duration = message.content.duration;
      if (duration) {
        console.log(`   所要時間: ${(duration / 1000).toFixed(2)}秒`);
      }
    } else {
      console.log(`❌ ${this.options.nodeName} 失敗`);
      if (message.content?.error) {
        console.error(`   エラー: ${message.content.error}`);
      }
    }

    console.log(`${'='.repeat(60)}\n`);
  }

  /**
   * 進捗状況をログ出力
   */
  public logProgress(current: number, total: number, status: string): void {
    console.log(`📊 進捗: [${current}/${total}] ${status}`);
  }

  /**
   * 完了ログを表示
   *
   * 注意: handleResult()でエラーが検出されていた場合は、
   *       このメソッドは何も表示せずにスキップされます。
   *       これにより「❌ 失敗」と「✅ 正常完了」が両方表示される問題を防ぎます。
   */
  public complete(success: boolean, summary?: string): void {
    // エラーが検出されていたらスキップ
    // （handleResult()で既に「❌ ... 失敗」が表示されているため）
    if (this.hasError) {
      if (this.options.verbose) {
        console.log(`⚠️  [MessageHandler] complete()をスキップ: エラーが検出されています`);
      }
      return;
    }

    // ドット表示中なら改行
    if (this.dotCounter > 0) {
      console.log(''); // 改行
      this.dotCounter = 0;
    }

    // ツール進捗表示中なら改行
    if (this.lastToolName) {
      console.log('');
      this.lastToolName = null;
    }

    if (success) {
      console.log(`✅ ${this.options.nodeName} 正常完了`);
    } else {
      console.log(`❌ ${this.options.nodeName} エラー終了`);
    }

    if (summary) {
      console.log(`   ${summary}`);
    }
    console.log('');
  }

  /**
   * エラーが検出されているかどうかを取得
   *
   * @returns エラーが検出されている場合は true
   */
  public getHasError(): boolean {
    return this.hasError;
  }

  /**
   * エラー詳細情報を取得
   *
   * @returns エラー詳細情報（エラーがない場合は undefined）
   */
  public getErrorDetails(): ErrorDetails | undefined {
    return this.errorDetails;
  }

  /**
   * エラーログを表示
   */
  public error(errorMessage: string, error?: Error): void {
    // ドット表示中なら改行
    if (this.dotCounter > 0) {
      console.log(''); // 改行
      this.dotCounter = 0;
    }

    console.error(`\n❌ エラー: ${errorMessage}`);
    if (error && this.options.verbose) {
      console.error(`   詳細: ${error.message}`);
      if (error.stack) {
        console.error(`   Stack: ${error.stack}`);
      }
    }
    console.log('');
  }
}
