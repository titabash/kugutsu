import { ErrorSeverity } from '../types/errors.js';
/**
 * ErrorClassifier
 *
 * エラーを分類し、適切なハンドリング戦略を決定するユーティリティクラス。
 *
 * エラー分類の優先順位:
 * 1. RETRYABLE (リトライ可能) - ネットワークエラー、タイムアウトなど
 * 2. RECOVERABLE (復旧可能) - コンフリクト、権限エラーなど
 * 3. PERMANENT (永続的) - その他すべてのエラー
 */
export class ErrorClassifier {
    /**
     * リトライ可能なエラーを示すキーワード
     */
    static RETRYABLE_KEYWORDS = [
        'etimedout',
        'econnreset',
        'econnrefused',
        'rate_limit',
        'rate limit',
        'network',
        'timeout',
        'socket',
        'enotfound',
        '503',
        '502',
        '429', // Rate limiting HTTP status
    ];
    /**
     * 復旧可能なエラーを示すキーワード
     */
    static RECOVERABLE_KEYWORDS = [
        'conflict',
        'permission denied',
        'locked',
        'eacces',
        'eperm',
    ];
    /**
     * エラーを分類する
     *
     * @param error 分類するエラー
     * @param context 追加のコンテキスト情報（オプション）
     * @returns 分類されたエラー情報
     */
    static classify(error, context) {
        const errorMessage = error.message.toLowerCase();
        // 優先順位1: RETRYABLE
        if (this.matchesKeywords(errorMessage, this.RETRYABLE_KEYWORDS)) {
            return {
                severity: ErrorSeverity.RETRYABLE,
                message: 'ネットワークエラー（リトライ可能）',
                originalError: error,
                context,
            };
        }
        // 優先順位2: RECOVERABLE
        if (this.matchesKeywords(errorMessage, this.RECOVERABLE_KEYWORDS)) {
            return {
                severity: ErrorSeverity.RECOVERABLE,
                message: 'マージコンフリクトまたは権限エラー（手動復旧可能）',
                originalError: error,
                context,
            };
        }
        // 優先順位3: PERMANENT（デフォルト）
        return {
            severity: ErrorSeverity.PERMANENT,
            message: '復旧不可能なエラー',
            originalError: error,
            context,
        };
    }
    /**
     * エラーがリトライ可能かどうかを判定する
     *
     * @param classified 分類されたエラー
     * @returns リトライ可能な場合は true
     */
    static isRetryable(classified) {
        return classified.severity === ErrorSeverity.RETRYABLE;
    }
    /**
     * エラーが復旧可能かどうかを判定する
     *
     * @param classified 分類されたエラー
     * @returns 復旧可能な場合は true
     */
    static isRecoverable(classified) {
        return classified.severity === ErrorSeverity.RECOVERABLE;
    }
    /**
     * エラーが永続的かどうかを判定する
     *
     * @param classified 分類されたエラー
     * @returns 永続的なエラーの場合は true
     */
    static isPermanent(classified) {
        return classified.severity === ErrorSeverity.PERMANENT;
    }
    /**
     * エラーメッセージが指定されたキーワードのいずれかに一致するかを判定する
     *
     * @param message エラーメッセージ（小文字）
     * @param keywords 検索するキーワードのリスト
     * @returns いずれかのキーワードに一致する場合は true
     */
    static matchesKeywords(message, keywords) {
        return keywords.some(keyword => message.includes(keyword));
    }
}
//# sourceMappingURL=ErrorClassifier.js.map