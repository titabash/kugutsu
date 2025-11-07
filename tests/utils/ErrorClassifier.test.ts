import { describe, it, expect } from '@jest/globals';
import { ErrorClassifier } from '../../src/utils/ErrorClassifier.js';
import { ErrorSeverity } from '../../src/types/errors.js';

describe('ErrorClassifier', () => {
  describe('classify', () => {
    describe('RETRYABLE errors', () => {
      it('should classify ETIMEDOUT as retryable', () => {
        const error = new Error('Connection failed: ETIMEDOUT');
        const result = ErrorClassifier.classify(error);

        expect(result.severity).toBe(ErrorSeverity.RETRYABLE);
        expect(result.originalError).toBe(error);
        expect(result.message).toContain('ネットワークエラー');
      });

      it('should classify ECONNRESET as retryable', () => {
        const error = new Error('Socket hangup: ECONNRESET');
        const result = ErrorClassifier.classify(error);

        expect(result.severity).toBe(ErrorSeverity.RETRYABLE);
        expect(result.originalError).toBe(error);
      });

      it('should classify rate_limit as retryable', () => {
        const error = new Error('Rate limit exceeded, please try again later');
        const result = ErrorClassifier.classify(error);

        expect(result.severity).toBe(ErrorSeverity.RETRYABLE);
        expect(result.originalError).toBe(error);
      });

      it('should classify network errors as retryable', () => {
        const error = new Error('Network request failed');
        const result = ErrorClassifier.classify(error);

        expect(result.severity).toBe(ErrorSeverity.RETRYABLE);
        expect(result.originalError).toBe(error);
      });

      it('should classify ECONNREFUSED as retryable', () => {
        const error = new Error('Connection refused: ECONNREFUSED');
        const result = ErrorClassifier.classify(error);

        expect(result.severity).toBe(ErrorSeverity.RETRYABLE);
      });

      it('should classify timeout errors as retryable', () => {
        const error = new Error('Request timeout after 30s');
        const result = ErrorClassifier.classify(error);

        expect(result.severity).toBe(ErrorSeverity.RETRYABLE);
      });

      it('should be case-insensitive', () => {
        const error = new Error('CONNECTION TIMEOUT: ETIMEDOUT');
        const result = ErrorClassifier.classify(error);

        expect(result.severity).toBe(ErrorSeverity.RETRYABLE);
      });
    });

    describe('RECOVERABLE errors', () => {
      it('should classify merge conflict as recoverable', () => {
        const error = new Error('Merge conflict detected in file.ts');
        const result = ErrorClassifier.classify(error);

        expect(result.severity).toBe(ErrorSeverity.RECOVERABLE);
        expect(result.message).toContain('手動復旧可能');
      });

      it('should classify permission denied as recoverable', () => {
        const error = new Error('Permission denied: EACCES');
        const result = ErrorClassifier.classify(error);

        expect(result.severity).toBe(ErrorSeverity.RECOVERABLE);
      });

      it('should classify file locked errors as recoverable', () => {
        const error = new Error('File is locked by another process');
        const result = ErrorClassifier.classify(error);

        expect(result.severity).toBe(ErrorSeverity.RECOVERABLE);
      });

      it('should classify EACCES as recoverable', () => {
        const error = new Error('EACCES: permission denied');
        const result = ErrorClassifier.classify(error);

        expect(result.severity).toBe(ErrorSeverity.RECOVERABLE);
      });
    });

    describe('PERMANENT errors', () => {
      it('should classify invalid input as permanent', () => {
        const error = new Error('Invalid task ID provided');
        const result = ErrorClassifier.classify(error);

        expect(result.severity).toBe(ErrorSeverity.PERMANENT);
        expect(result.message).toContain('復旧不可能');
      });

      it('should classify authentication errors as permanent', () => {
        const error = new Error('Authentication failed: invalid API key');
        const result = ErrorClassifier.classify(error);

        expect(result.severity).toBe(ErrorSeverity.PERMANENT);
      });

      it('should classify syntax errors as permanent', () => {
        const error = new SyntaxError('Unexpected token in JSON at position 0');
        const result = ErrorClassifier.classify(error);

        expect(result.severity).toBe(ErrorSeverity.PERMANENT);
      });

      it('should classify type errors as permanent', () => {
        const error = new TypeError('Cannot read property of undefined');
        const result = ErrorClassifier.classify(error);

        expect(result.severity).toBe(ErrorSeverity.PERMANENT);
      });

      it('should classify unknown errors as permanent by default', () => {
        const error = new Error('Some unknown error occurred');
        const result = ErrorClassifier.classify(error);

        expect(result.severity).toBe(ErrorSeverity.PERMANENT);
      });
    });

    describe('context preservation', () => {
      it('should preserve original error', () => {
        const originalError = new Error('Test error');
        const result = ErrorClassifier.classify(originalError);

        expect(result.originalError).toBe(originalError);
        expect(result.originalError.message).toBe('Test error');
      });

      it('should allow adding context', () => {
        const error = new Error('ETIMEDOUT');
        const result = ErrorClassifier.classify(error, { taskId: 'task-123' });

        expect(result.context).toEqual({ taskId: 'task-123' });
      });
    });

    describe('edge cases', () => {
      it('should handle empty error messages', () => {
        const error = new Error('');
        const result = ErrorClassifier.classify(error);

        expect(result.severity).toBe(ErrorSeverity.PERMANENT);
        expect(result.originalError).toBe(error);
      });

      it('should handle errors with special characters', () => {
        const error = new Error('Error: [ETIMEDOUT] - Connection (timeout!)');
        const result = ErrorClassifier.classify(error);

        expect(result.severity).toBe(ErrorSeverity.RETRYABLE);
      });

      it('should handle errors with multiple keywords', () => {
        const error = new Error('Network conflict: ETIMEDOUT during merge');
        // Should prioritize RETRYABLE (network/timeout) over RECOVERABLE (conflict)
        const result = ErrorClassifier.classify(error);

        expect(result.severity).toBe(ErrorSeverity.RETRYABLE);
      });
    });
  });

  describe('isRetryable', () => {
    it('should return true for retryable errors', () => {
      const error = new Error('ETIMEDOUT');
      const classified = ErrorClassifier.classify(error);

      expect(ErrorClassifier.isRetryable(classified)).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const error = new Error('Invalid input');
      const classified = ErrorClassifier.classify(error);

      expect(ErrorClassifier.isRetryable(classified)).toBe(false);
    });
  });

  describe('isRecoverable', () => {
    it('should return true for recoverable errors', () => {
      const error = new Error('Merge conflict');
      const classified = ErrorClassifier.classify(error);

      expect(ErrorClassifier.isRecoverable(classified)).toBe(true);
    });

    it('should return false for non-recoverable errors', () => {
      const error = new Error('Invalid input');
      const classified = ErrorClassifier.classify(error);

      expect(ErrorClassifier.isRecoverable(classified)).toBe(false);
    });
  });

  describe('isPermanent', () => {
    it('should return true for permanent errors', () => {
      const error = new Error('Invalid input');
      const classified = ErrorClassifier.classify(error);

      expect(ErrorClassifier.isPermanent(classified)).toBe(true);
    });

    it('should return false for non-permanent errors', () => {
      const error = new Error('ETIMEDOUT');
      const classified = ErrorClassifier.classify(error);

      expect(ErrorClassifier.isPermanent(classified)).toBe(false);
    });
  });
});
