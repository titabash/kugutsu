/**
 * RetryManager
 *
 * エクスポネンシャルバックオフを用いたリトライマネージャー。
 * AI実行、ネットワークリクエストなどの一時的な失敗に対して
 * 自動的にリトライを行います。
 */

/**
 * リトライオプション
 */
export interface RetryOptions {
  /**
   * 最大リトライ回数
   */
  maxRetries?: number;

  /**
   * 初回のディレイ時間（ミリ秒）
   */
  initialDelayMs?: number;

  /**
   * 最大ディレイ時間（ミリ秒）
   */
  maxDelayMs?: number;

  /**
   * バックオフ係数（ディレイを何倍にするか）
   */
  backoffMultiplier?: number;

  /**
   * リトライ対象のエラーパターン（部分一致）
   */
  retryableErrors?: string[];
}

/**
 * リトライ結果
 */
export interface RetryResult<T> {
  /**
   * 実行が成功したかどうか
   */
  success: boolean;

  /**
   * 成功時のデータ
   */
  data?: T;

  /**
   * 失敗時のエラー
   */
  error?: Error;

  /**
   * 実行試行回数（初回 + リトライ回数）
   */
  attempts: number;
}

/**
 * デフォルトのリトライオプション
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000, // 1秒
  maxDelayMs: 30000, // 30秒
  backoffMultiplier: 2,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    'rate_limit',
    'Rate limit',
    'timeout',
    'network',
    'temporary',
    '503',
    '502',
    '429',
  ],
};

/**
 * RetryManager
 *
 * エクスポネンシャルバックオフによるリトライ機構を提供します。
 */
export class RetryManager {
  /**
   * 指定された関数をリトライ付きで実行する
   *
   * @param fn 実行する非同期関数
   * @param options リトライオプション（部分指定可能）
   * @returns リトライ結果
   */
  static async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>> {
    // デフォルトオプションとマージ
    const opts: Required<RetryOptions> = {
      ...DEFAULT_RETRY_OPTIONS,
      ...options,
    };

    let lastError: Error | undefined;
    let attempts = 0;

    for (let i = 0; i <= opts.maxRetries; i++) {
      attempts++;

      try {
        // 関数を実行
        const data = await fn();

        return {
          success: true,
          data,
          attempts,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 最後の試行か、リトライ不可能なエラーの場合は即座に失敗
        if (i === opts.maxRetries || !this.isRetryable(lastError, opts.retryableErrors)) {
          return {
            success: false,
            error: lastError,
            attempts,
          };
        }

        // エクスポネンシャルバックオフでディレイ
        const delay = this.calculateDelay(i, opts);
        await this.sleep(delay);
      }
    }

    // 理論的にはここには到達しないが、TypeScript の型チェックのため
    return {
      success: false,
      error: lastError,
      attempts,
    };
  }

  /**
   * エラーがリトライ可能かどうかを判定する
   *
   * @param error エラーオブジェクト
   * @param retryableErrors リトライ可能なエラーパターンのリスト
   * @returns リトライ可能な場合は true
   */
  static isRetryable(error: Error, retryableErrors: string[]): boolean {
    const errorMessage = error.message.toLowerCase();

    return retryableErrors.some(pattern =>
      errorMessage.includes(pattern.toLowerCase())
    );
  }

  /**
   * エクスポネンシャルバックオフによるディレイ時間を計算する
   *
   * @param attemptNumber リトライ回数（0から始まる）
   * @param options リトライオプション
   * @returns ディレイ時間（ミリ秒）
   */
  private static calculateDelay(
    attemptNumber: number,
    options: Required<RetryOptions>
  ): number {
    const exponentialDelay =
      options.initialDelayMs * Math.pow(options.backoffMultiplier, attemptNumber);

    // maxDelayMs で上限を設定
    return Math.min(exponentialDelay, options.maxDelayMs);
  }

  /**
   * 指定されたミリ秒だけスリープする
   *
   * @param ms スリープ時間（ミリ秒）
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
