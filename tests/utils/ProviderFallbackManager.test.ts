/**
 * ProviderFallbackManager Unit Tests
 *
 * Tests the provider fallback decision logic and utilities
 */

import { ProviderFallbackManager } from '../../src/utils/ProviderFallbackManager.js';
import type { ErrorDetails } from '../../src/utils/ProviderFallbackManager.js';

describe('ProviderFallbackManager', () => {
  describe('shouldFallback', () => {
    it('should return true for rate_limit error', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'rate_limit',
        message: 'API rate limit exceeded',
      };

      const result = ProviderFallbackManager.shouldFallback(errorDetails, false);
      expect(result).toBe(true);
    });

    it('should return true for error_max_turns error', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'error_max_turns',
        message: 'Maximum turns reached',
      };

      const result = ProviderFallbackManager.shouldFallback(errorDetails, false);
      expect(result).toBe(true);
    });

    it('should return false for other error types', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'network_error',
        message: 'Network connection failed',
      };

      const result = ProviderFallbackManager.shouldFallback(errorDetails, false);
      expect(result).toBe(false);
    });

    it('should return false if already fallbacked', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'rate_limit',
        message: 'API rate limit exceeded',
      };

      const result = ProviderFallbackManager.shouldFallback(errorDetails, true);
      expect(result).toBe(false);
    });

    it('should return false for null error details', () => {
      const result = ProviderFallbackManager.shouldFallback(null, false);
      expect(result).toBe(false);
    });

    it('should return false for undefined error details', () => {
      const result = ProviderFallbackManager.shouldFallback(undefined, false);
      expect(result).toBe(false);
    });

    it('should respect custom fallback config - enabled', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'rate_limit',
        message: 'API rate limit exceeded',
      };

      const config = {
        enabled: true,
        fallbackErrorTypes: ['rate_limit'],
        maxRetries: 1,
      };

      const result = ProviderFallbackManager.shouldFallback(
        errorDetails,
        false,
        config
      );
      expect(result).toBe(true);
    });

    it('should respect custom fallback config - disabled', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'rate_limit',
        message: 'API rate limit exceeded',
      };

      const config = {
        enabled: false,
      };

      const result = ProviderFallbackManager.shouldFallback(
        errorDetails,
        false,
        config
      );
      expect(result).toBe(false);
    });

    it('should respect custom fallback error types', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'custom_error',
        message: 'Custom error occurred',
      };

      const config = {
        fallbackErrorTypes: ['custom_error'],
      };

      const result = ProviderFallbackManager.shouldFallback(
        errorDetails,
        false,
        config
      );
      expect(result).toBe(true);
    });
  });

  describe('getFallbackMessage', () => {
    it('should format fallback message correctly', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'rate_limit',
        message: 'API rate limit exceeded',
      };

      const message = ProviderFallbackManager.getFallbackMessage(
        errorDetails,
        'codex',
        'claude'
      );

      expect(message).toContain('[codex]');
      expect(message).toContain('[claude]');
      expect(message).toContain('rate_limit');
      expect(message).toContain('API rate limit exceeded');
      expect(message).toContain('フォールバック');
    });

    it('should handle null error details', () => {
      const message = ProviderFallbackManager.getFallbackMessage(
        null,
        'codex',
        'claude'
      );

      expect(message).toContain('[codex]');
      expect(message).toContain('[claude]');
      expect(message).toContain('unknown');
    });

    it('should handle undefined error details', () => {
      const message = ProviderFallbackManager.getFallbackMessage(
        undefined,
        'codex',
        'claude'
      );

      expect(message).toContain('[codex]');
      expect(message).toContain('[claude]');
      expect(message).toContain('unknown');
    });
  });

  describe('getErrorSummary', () => {
    it('should return error summary with message', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'rate_limit',
        message: 'API rate limit exceeded',
      };

      const summary = ProviderFallbackManager.getErrorSummary(errorDetails);
      expect(summary).toBe('rate_limit: API rate limit exceeded');
    });

    it('should return error summary with errors array', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'error_max_turns',
        errors: ['Error 1', 'Error 2'],
      };

      const summary = ProviderFallbackManager.getErrorSummary(errorDetails);
      expect(summary).toBe('error_max_turns: Error 1; Error 2');
    });

    it('should return error subtype only when no message or errors', () => {
      const errorDetails: ErrorDetails = {
        subtype: 'unknown_error',
      };

      const summary = ProviderFallbackManager.getErrorSummary(errorDetails);
      expect(summary).toBe('unknown_error');
    });

    it('should return "unknown error" for null details', () => {
      const summary = ProviderFallbackManager.getErrorSummary(null);
      expect(summary).toBe('unknown error');
    });

    it('should return "unknown error" for undefined details', () => {
      const summary = ProviderFallbackManager.getErrorSummary(undefined);
      expect(summary).toBe('unknown error');
    });
  });
});
