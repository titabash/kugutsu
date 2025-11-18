/**
 * Provider Fallback Manager
 *
 * Manages AI provider fallback logic when errors occur.
 *
 * Features:
 * - Determines if fallback should occur based on error type
 * - Limits fallback retries to prevent infinite loops
 * - Supports Claude ↔ Codex fallback (excludes Mock)
 */
/**
 * Provider Fallback Manager
 */
export class ProviderFallbackManager {
    /**
     * Default error types that trigger fallback
     */
    static DEFAULT_FALLBACK_ERROR_TYPES = [
        'rate_limit',
        'usage_limit',
        'error_max_turns',
    ];
    /**
     * Default maximum retries
     */
    static DEFAULT_MAX_RETRIES = 1;
    /**
     * Determine if fallback should occur based on error details
     *
     * @param errorDetails - Error details from MessageHandler
     * @param alreadyFallbacked - Whether fallback has already occurred
     * @param config - Fallback configuration (optional)
     * @returns true if fallback should occur, false otherwise
     */
    static shouldFallback(errorDetails, alreadyFallbacked = false, config) {
        // Check if fallback is enabled
        const enabled = config?.enabled ?? true;
        if (!enabled) {
            return false;
        }
        // Check retry limit
        const maxRetries = config?.maxRetries ?? this.DEFAULT_MAX_RETRIES;
        if (alreadyFallbacked && maxRetries <= 1) {
            // Already fallbacked once, no more retries allowed
            return false;
        }
        // No error details available
        if (!errorDetails) {
            return false;
        }
        // Get fallback error types
        const fallbackErrorTypes = config?.fallbackErrorTypes ?? this.DEFAULT_FALLBACK_ERROR_TYPES;
        // Check if error type is fallback-eligible
        const errorType = errorDetails.subtype || '';
        // Special case: exception/turn_failed errors that might be provider crashes or usage limits
        // These should trigger fallback even though they might not be in the default list
        if (errorType === 'exception' || errorType === 'turn_failed') {
            const errorMsg = (errorDetails.message || errorDetails.errors?.join(' ') || '').toLowerCase();
            // Check for provider crash indicators
            const isProviderCrash = (errorMsg.includes('exited with code') ||
                errorMsg.includes('process terminated') ||
                errorMsg.includes('connection refused') ||
                errorMsg.includes('connection reset') ||
                errorMsg.includes('econnrefused') ||
                errorMsg.includes('econnreset'));
            // Check for usage limit indicators (in case subtype wasn't set correctly)
            const isUsageLimit = (errorMsg.includes('usage limit') ||
                errorMsg.includes('weekly limit') ||
                errorMsg.includes('monthly limit') ||
                errorMsg.includes('quota') ||
                errorMsg.includes('limit reached') ||
                errorMsg.includes('subscription') ||
                errorMsg.includes('billing'));
            if (isProviderCrash || isUsageLimit) {
                return true;
            }
        }
        return fallbackErrorTypes.includes(errorType);
    }
    /**
     * Get fallback error message with context
     *
     * @param errorDetails - Error details from MessageHandler
     * @param currentProvider - Current provider name
     * @param fallbackProvider - Fallback provider name
     * @returns Formatted error message
     */
    static getFallbackMessage(errorDetails, currentProvider, fallbackProvider) {
        const errorType = errorDetails?.subtype || 'unknown';
        const errorMsg = errorDetails?.message || 'エラーが発生しました';
        return `[${currentProvider}] ${errorType} エラー発生: ${errorMsg}\n→ [${fallbackProvider}] にフォールバックして再実行します`;
    }
    /**
     * Get error summary for logging
     *
     * @param errorDetails - Error details from MessageHandler
     * @returns Error summary string
     */
    static getErrorSummary(errorDetails) {
        if (!errorDetails) {
            return 'unknown error';
        }
        const errorType = errorDetails.subtype || 'unknown';
        const errorMsg = errorDetails.message || '';
        const errors = errorDetails.errors || [];
        if (errorMsg) {
            return `${errorType}: ${errorMsg}`;
        }
        else if (errors.length > 0) {
            return `${errorType}: ${errors.join('; ')}`;
        }
        else {
            return errorType;
        }
    }
}
//# sourceMappingURL=ProviderFallbackManager.js.map