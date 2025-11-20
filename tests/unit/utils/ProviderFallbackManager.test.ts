/**
 * Provider Fallback Manager Tests
 *
 * フォールバック判定ロジックのテスト
 * エラータイプに基づいて適切にフォールバックが発動することを検証
 */

import { ProviderFallbackManager, ErrorDetails } from '../../../src/utils/ProviderFallbackManager.js';

describe('ProviderFallbackManager', () => {
  describe('shouldFallback', () => {
    it('should return true for rate_limit error', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'rate_limit',
        message: 'Rate limit exceeded',
      };
      expect(ProviderFallbackManager.shouldFallback(errorDetails, false)).toBe(true);
    });

    it('should return true for usage_limit error', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'usage_limit',
        message: 'Usage limit exceeded',
      };
      expect(ProviderFallbackManager.shouldFallback(errorDetails, false)).toBe(true);
    });

    it('should return true for error_max_turns error', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'error_max_turns',
        message: 'Maximum turns exceeded',
      };
      expect(ProviderFallbackManager.shouldFallback(errorDetails, false)).toBe(true);
    });

    // ✅ 新しいテスト: subtype: "error" でフォールバックが発動すること
    it('should return true for generic "error" subtype', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'error',
        message: 'An error occurred',
      };
      expect(ProviderFallbackManager.shouldFallback(errorDetails, false)).toBe(true);
    });

    // ✅ 新しいテスト: 接続エラー（"Re-connecting..."）でフォールバックが発動すること
    it('should return true for connection error with "Re-connecting" message', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'error',
        message: 'Re-connecting... 1/5',
      };
      expect(ProviderFallbackManager.shouldFallback(errorDetails, false)).toBe(true);
    });

    // ✅ 新しいテスト: 接続エラー（"connection refused"）でフォールバックが発動すること
    it('should return true for "connection refused" error', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'exception',
        message: 'Connection refused to API server',
      };
      expect(ProviderFallbackManager.shouldFallback(errorDetails, false)).toBe(true);
    });

    // ✅ 新しいテスト: 接続エラー（"connection reset"）でフォールバックが発動すること
    it('should return true for "connection reset" error', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'exception',
        message: 'Connection reset by peer',
      };
      expect(ProviderFallbackManager.shouldFallback(errorDetails, false)).toBe(true);
    });

    // ✅ 新しいテスト: 接続エラー（"ECONNREFUSED"）でフォールバックが発動すること
    it('should return true for ECONNREFUSED error', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'turn_failed',
        message: 'Error: ECONNREFUSED',
      };
      expect(ProviderFallbackManager.shouldFallback(errorDetails, false)).toBe(true);
    });

    it('should return false for unknown error types', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'unknown_error',
        message: 'Unknown error',
      };
      expect(ProviderFallbackManager.shouldFallback(errorDetails, false)).toBe(false);
    });

    it('should return false when already fallbacked', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'rate_limit',
        message: 'Rate limit exceeded',
      };
      expect(ProviderFallbackManager.shouldFallback(errorDetails, true)).toBe(false);
    });

    it('should return false when fallback is disabled', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'rate_limit',
        message: 'Rate limit exceeded',
      };
      const config = { enabled: false };
      expect(ProviderFallbackManager.shouldFallback(errorDetails, false, config)).toBe(false);
    });

    it('should return false when errorDetails is null', () => {
      expect(ProviderFallbackManager.shouldFallback(null, false)).toBe(false);
    });

    it('should return false when errorDetails is undefined', () => {
      expect(ProviderFallbackManager.shouldFallback(undefined, false)).toBe(false);
    });

    it('should respect custom fallbackErrorTypes config', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'custom_error',
        message: 'Custom error',
      };
      const config = {
        fallbackErrorTypes: ['custom_error'],
      };
      expect(ProviderFallbackManager.shouldFallback(errorDetails, false, config)).toBe(true);
    });

    it('should detect provider crash from error message', () => {
      const testCases = [
        'Process exited with code 1',
        'Process terminated unexpectedly',
        'connection refused',
        'connection reset',
        'ECONNREFUSED',
        'ECONNRESET',
      ];

      testCases.forEach((message) => {
        const errorDetails: ErrorDetails = {
          subtype: 'exception',
          message,
        };
        expect(ProviderFallbackManager.shouldFallback(errorDetails, false)).toBe(true);
      });
    });

    it('should detect usage limit from error message', () => {
      const testCases = [
        'Usage limit exceeded',
        'Weekly limit reached',
        'Monthly limit reached',
        'Quota exceeded',
        'Limit reached',
        'Subscription expired',
        'Billing issue',
      ];

      testCases.forEach((message) => {
        const errorDetails: ErrorDetails = {
          subtype: 'turn_failed',
          message,
        };
        expect(ProviderFallbackManager.shouldFallback(errorDetails, false)).toBe(true);
      });
    });
  });

  describe('getFallbackMessage', () => {
    it('should return formatted fallback message', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'rate_limit',
        message: 'Rate limit exceeded',
      };
      const message = ProviderFallbackManager.getFallbackMessage(
        errorDetails,
        'Claude',
        'Codex'
      );
      expect(message).toContain('[Claude]');
      expect(message).toContain('rate_limit');
      expect(message).toContain('[Codex]');
      expect(message).toContain('フォールバック');
    });

    it('should handle null errorDetails', () => {
      const message = ProviderFallbackManager.getFallbackMessage(
        null,
        'Claude',
        'Codex'
      );
      expect(message).toContain('[Claude]');
      expect(message).toContain('[Codex]');
      expect(message).toContain('unknown');
    });
  });

  describe('getErrorSummary', () => {
    it('should return error summary with message', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'rate_limit',
        message: 'Rate limit exceeded',
      };
      const summary = ProviderFallbackManager.getErrorSummary(errorDetails);
      expect(summary).toBe('rate_limit: Rate limit exceeded');
    });

    it('should return error summary with errors array', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'error',
        errors: ['Error 1', 'Error 2'],
      };
      const summary = ProviderFallbackManager.getErrorSummary(errorDetails);
      expect(summary).toBe('error: Error 1; Error 2');
    });

    it('should return subtype only when no message or errors', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'error',
      };
      const summary = ProviderFallbackManager.getErrorSummary(errorDetails);
      expect(summary).toBe('error');
    });

    it('should handle null errorDetails', () => {
      const summary = ProviderFallbackManager.getErrorSummary(null);
      expect(summary).toBe('unknown error');
    });
  });
});
