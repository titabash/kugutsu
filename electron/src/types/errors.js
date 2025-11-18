/**
 * エラーの深刻度分類
 */
export var ErrorSeverity;
(function (ErrorSeverity) {
    /**
     * リトライ可能なエラー
     * 例: ネットワークタイムアウト、一時的な接続エラー、レート制限
     */
    ErrorSeverity["RETRYABLE"] = "retryable";
    /**
     * 手動介入で復旧可能なエラー
     * 例: マージコンフリクト、権限エラー
     */
    ErrorSeverity["RECOVERABLE"] = "recoverable";
    /**
     * 永続的なエラー（復旧不可）
     * 例: 認証エラー、無効な入力、論理エラー
     */
    ErrorSeverity["PERMANENT"] = "permanent";
})(ErrorSeverity || (ErrorSeverity = {}));
/**
 * 状態遷移エラー
 */
export class InvalidStateTransitionError extends Error {
    from;
    to;
    constructor(from, to, message) {
        super(message || `Invalid state transition: ${from} -> ${to}`);
        this.from = from;
        this.to = to;
        this.name = 'InvalidStateTransitionError';
    }
}
/**
 * リトライ可能なエラー
 */
export class RetryableError extends Error {
    originalError;
    context;
    constructor(message, originalError, context) {
        super(message);
        this.originalError = originalError;
        this.context = context;
        this.name = 'RetryableError';
    }
}
/**
 * 復旧可能なエラー
 */
export class RecoverableError extends Error {
    originalError;
    context;
    constructor(message, originalError, context) {
        super(message);
        this.originalError = originalError;
        this.context = context;
        this.name = 'RecoverableError';
    }
}
/**
 * 永続的なエラー
 */
export class PermanentError extends Error {
    originalError;
    context;
    constructor(message, originalError, context) {
        super(message);
        this.originalError = originalError;
        this.context = context;
        this.name = 'PermanentError';
    }
}
//# sourceMappingURL=errors.js.map