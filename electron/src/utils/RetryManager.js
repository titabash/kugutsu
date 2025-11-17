/**
 * RetryManager
 *
 * エクスポネンシャルバックオフを用いたリトライマネージャー。
 * AI実行、ネットワークリクエストなどの一時的な失敗に対して
 * 自動的にリトライを行います。
 */
/**
 * デフォルトのリトライオプション
 */
const DEFAULT_RETRY_OPTIONS = {
    maxRetries: 3,
    initialDelayMs: 1000, // 1秒
    maxDelayMs: 30000, // 30秒
    backoffMultiplier: 2,
    retryableErrors: [
        // 一時的なネットワークエラーのみリトライ対象
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ECONNREFUSED',
        'timeout',
        'network',
        'temporary',
        '503', // Service Unavailable
        '502', // Bad Gateway
        // 注意: rate_limit, usage_limit, 429などの永続的エラーはリトライしない
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
    static async executeWithRetry(fn, options = {}) {
        // デフォルトオプションとマージ
        const opts = {
            ...DEFAULT_RETRY_OPTIONS,
            ...options,
        };
        let lastError;
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
            }
            catch (error) {
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
    static isRetryable(error, retryableErrors) {
        const errorMessage = error.message.toLowerCase();
        return retryableErrors.some(pattern => errorMessage.includes(pattern.toLowerCase()));
    }
    /**
     * エクスポネンシャルバックオフによるディレイ時間を計算する
     *
     * @param attemptNumber リトライ回数（0から始まる）
     * @param options リトライオプション
     * @returns ディレイ時間（ミリ秒）
     */
    static calculateDelay(attemptNumber, options) {
        const exponentialDelay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attemptNumber);
        // maxDelayMs で上限を設定
        return Math.min(exponentialDelay, options.maxDelayMs);
    }
    /**
     * 指定されたミリ秒だけスリープする
     *
     * @param ms スリープ時間（ミリ秒）
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=RetryManager.js.map