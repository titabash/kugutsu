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
 * Error details from MessageHandler
 */
export interface ErrorDetails {
  subtype?: string;
  message?: string;
  errors?: string[];
}

/**
 * Fallback configuration
 */
export interface FallbackConfig {
  /**
   * Enable fallback feature
   * @default true
   */
  enabled?: boolean;

  /**
   * Error types that trigger fallback
   * @default ['rate_limit', 'error_max_turns']
   */
  fallbackErrorTypes?: string[];

  /**
   * Maximum number of fallback retries
   * @default 1
   */
  maxRetries?: number;
}

/**
 * Provider Fallback Manager
 */
export class ProviderFallbackManager {
  /**
   * Default error types that trigger fallback
   */
  private static readonly DEFAULT_FALLBACK_ERROR_TYPES = [
    'rate_limit',
    'error_max_turns',
  ];

  /**
   * Default maximum retries
   */
  private static readonly DEFAULT_MAX_RETRIES = 1;

  /**
   * Determine if fallback should occur based on error details
   *
   * @param errorDetails - Error details from MessageHandler
   * @param alreadyFallbacked - Whether fallback has already occurred
   * @param config - Fallback configuration (optional)
   * @returns true if fallback should occur, false otherwise
   */
  static shouldFallback(
    errorDetails: ErrorDetails | null | undefined,
    alreadyFallbacked: boolean = false,
    config?: FallbackConfig
  ): boolean {
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
    const fallbackErrorTypes =
      config?.fallbackErrorTypes ?? this.DEFAULT_FALLBACK_ERROR_TYPES;

    // Check if error type is fallback-eligible
    const errorType = errorDetails.subtype || '';
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
  static getFallbackMessage(
    errorDetails: ErrorDetails | null | undefined,
    currentProvider: string,
    fallbackProvider: string
  ): string {
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
  static getErrorSummary(errorDetails: ErrorDetails | null | undefined): string {
    if (!errorDetails) {
      return 'unknown error';
    }

    const errorType = errorDetails.subtype || 'unknown';
    const errorMsg = errorDetails.message || '';
    const errors = errorDetails.errors || [];

    if (errorMsg) {
      return `${errorType}: ${errorMsg}`;
    } else if (errors.length > 0) {
      return `${errorType}: ${errors.join('; ')}`;
    } else {
      return errorType;
    }
  }
}
