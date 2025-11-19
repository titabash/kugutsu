import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { RetryManager } from '../../src/utils/RetryManager.js';

describe('RetryManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeWithRetry', () => {
    describe('成功ケース', () => {
      it('should return success result on first attempt', async () => {
        const mockFn = jest.fn<() => Promise<string>>().mockResolvedValue('success');

        const result = await RetryManager.executeWithRetry(mockFn);

        expect(result.success).toBe(true);
        expect(result.data).toBe('success');
        expect(result.attempts).toBe(1);
        expect(mockFn).toHaveBeenCalledTimes(1);
      });

      it('should retry and succeed on second attempt', async () => {
        const mockFn = jest.fn<() => Promise<string>>()
          .mockRejectedValueOnce(new Error('ETIMEDOUT'))
          .mockResolvedValueOnce('success');

        const result = await RetryManager.executeWithRetry(mockFn, {
          maxRetries: 3,
          initialDelayMs: 10,
          maxDelayMs: 100,
          backoffMultiplier: 2,
          retryableErrors: ['ETIMEDOUT'],
        });

        expect(result.success).toBe(true);
        expect(result.data).toBe('success');
        expect(result.attempts).toBe(2);
        expect(mockFn).toHaveBeenCalledTimes(2);
      });

      it('should retry multiple times and succeed', async () => {
        const mockFn = jest.fn<() => Promise<string>>()
          .mockRejectedValueOnce(new Error('ETIMEDOUT'))
          .mockRejectedValueOnce(new Error('rate_limit'))
          .mockResolvedValueOnce('success');

        const result = await RetryManager.executeWithRetry(mockFn, {
          maxRetries: 5,
          initialDelayMs: 10,
          maxDelayMs: 100,
          backoffMultiplier: 2,
          retryableErrors: ['ETIMEDOUT', 'rate_limit'],
        });

        expect(result.success).toBe(true);
        expect(result.data).toBe('success');
        expect(result.attempts).toBe(3);
        expect(mockFn).toHaveBeenCalledTimes(3);
      });
    });

    describe('リトライ可能エラー', () => {
      it('should retry on network timeout', async () => {
        const mockFn = jest.fn<() => Promise<string>>()
          .mockRejectedValueOnce(new Error('Connection timeout: ETIMEDOUT'))
          .mockResolvedValueOnce('success');

        const result = await RetryManager.executeWithRetry(mockFn, {
          maxRetries: 3,
          initialDelayMs: 10,
          maxDelayMs: 100,
          backoffMultiplier: 2,
          retryableErrors: ['ETIMEDOUT'],
        });

        expect(result.success).toBe(true);
        expect(result.attempts).toBe(2);
      });

      it('should retry on rate limit error', async () => {
        const mockFn = jest.fn<() => Promise<string>>()
          .mockRejectedValueOnce(new Error('Rate limit exceeded'))
          .mockResolvedValueOnce('success');

        const result = await RetryManager.executeWithRetry(mockFn, {
          maxRetries: 3,
          initialDelayMs: 10,
          maxDelayMs: 100,
          backoffMultiplier: 2,
          retryableErrors: ['rate_limit', 'Rate limit'],
        });

        expect(result.success).toBe(true);
        expect(result.attempts).toBe(2);
      });

      it('should retry on ECONNRESET', async () => {
        const mockFn = jest.fn<() => Promise<string>>()
          .mockRejectedValueOnce(new Error('ECONNRESET'))
          .mockResolvedValueOnce('success');

        const result = await RetryManager.executeWithRetry(mockFn);

        expect(result.success).toBe(true);
        expect(result.attempts).toBe(2);
      });
    });

    describe('リトライ不可エラー', () => {
      it('should not retry on non-retryable error', async () => {
        const mockFn = jest.fn<() => Promise<string>>()
          .mockRejectedValueOnce(new Error('Invalid API key'));

        const result = await RetryManager.executeWithRetry(mockFn, {
          maxRetries: 3,
          initialDelayMs: 10,
          maxDelayMs: 100,
          backoffMultiplier: 2,
          retryableErrors: ['ETIMEDOUT', 'rate_limit'],
        });

        expect(result.success).toBe(false);
        expect(result.error?.message).toBe('Invalid API key');
        expect(result.attempts).toBe(1);
        expect(mockFn).toHaveBeenCalledTimes(1);
      });

      it('should fail immediately on authentication error', async () => {
        const mockFn = jest.fn<() => Promise<string>>()
          .mockRejectedValueOnce(new Error('Authentication failed'));

        const result = await RetryManager.executeWithRetry(mockFn);

        expect(result.success).toBe(false);
        expect(result.attempts).toBe(1);
        expect(mockFn).toHaveBeenCalledTimes(1);
      });
    });

    describe('最大リトライ回数', () => {
      it('should fail after max retries', async () => {
        const mockFn = jest.fn<() => Promise<string>>()
          .mockRejectedValue(new Error('ETIMEDOUT'));

        const result = await RetryManager.executeWithRetry(mockFn, {
          maxRetries: 3,
          initialDelayMs: 10,
          maxDelayMs: 100,
          backoffMultiplier: 2,
          retryableErrors: ['ETIMEDOUT'],
        });

        expect(result.success).toBe(false);
        expect(result.error?.message).toBe('ETIMEDOUT');
        expect(result.attempts).toBe(4); // initial + 3 retries
        expect(mockFn).toHaveBeenCalledTimes(4);
      });

      it('should respect maxRetries setting', async () => {
        const mockFn = jest.fn<() => Promise<string>>()
          .mockRejectedValue(new Error('ETIMEDOUT'));

        const result = await RetryManager.executeWithRetry(mockFn, {
          maxRetries: 5,
          initialDelayMs: 10,
          maxDelayMs: 100,
          backoffMultiplier: 2,
          retryableErrors: ['ETIMEDOUT'],
        });

        expect(result.success).toBe(false);
        expect(result.attempts).toBe(6); // initial + 5 retries
        expect(mockFn).toHaveBeenCalledTimes(6);
      });
    });

    describe('エクスポネンシャルバックオフ', () => {
      it('should increase delay exponentially', async () => {
        const mockFn = jest.fn<() => Promise<string>>()
          .mockRejectedValue(new Error('ETIMEDOUT'));

        const startTime = Date.now();

        await RetryManager.executeWithRetry(mockFn, {
          maxRetries: 3,
          initialDelayMs: 50,
          maxDelayMs: 500,
          backoffMultiplier: 2,
          retryableErrors: ['ETIMEDOUT'],
        });

        const elapsed = Date.now() - startTime;

        // Total expected delay: 50 + 100 + 200 = 350ms (minimum)
        expect(elapsed).toBeGreaterThanOrEqual(300);
        expect(mockFn).toHaveBeenCalledTimes(4);
      });

      it('should not exceed maxDelayMs', async () => {
        const mockFn = jest.fn<() => Promise<string>>()
          .mockRejectedValue(new Error('ETIMEDOUT'));

        const startTime = Date.now();

        await RetryManager.executeWithRetry(mockFn, {
          maxRetries: 5,
          initialDelayMs: 100,
          maxDelayMs: 150, // Cap at 150ms
          backoffMultiplier: 2,
          retryableErrors: ['ETIMEDOUT'],
        });

        const elapsed = Date.now() - startTime;

        // Delays: 100, 150 (capped), 150 (capped), 150 (capped), 150 (capped)
        // Total: 700ms (minimum)
        expect(elapsed).toBeGreaterThanOrEqual(650);
        expect(elapsed).toBeLessThan(1000); // Should not grow indefinitely
      });
    });

    describe('デフォルト設定', () => {
      it('should use default options when not specified', async () => {
        const mockFn = jest.fn<() => Promise<string>>()
          .mockRejectedValueOnce(new Error('ECONNRESET'))
          .mockResolvedValueOnce('success');

        const result = await RetryManager.executeWithRetry(mockFn);

        expect(result.success).toBe(true);
        expect(result.attempts).toBe(2);
        expect(mockFn).toHaveBeenCalledTimes(2);
      });

      it('should retry on default retryable errors', async () => {
        const errors = [
          'ECONNRESET',
          'ETIMEDOUT',
          'ENOTFOUND',
          'ECONNREFUSED',
          'network timeout',
          'temporary failure',
          '503 Service Unavailable',
        ];

        for (const errorMsg of errors) {
          const mockFn = jest.fn<() => Promise<string>>()
            .mockRejectedValueOnce(new Error(errorMsg))
            .mockResolvedValueOnce('success');

          const result = await RetryManager.executeWithRetry(mockFn, {
            maxRetries: 2,
            initialDelayMs: 10,
            maxDelayMs: 100,
            backoffMultiplier: 2,
          });

          expect(result.success).toBe(true);
          expect(result.attempts).toBeGreaterThan(1);
        }
      });
    });

    describe('部分的なオプション上書き', () => {
      it('should merge partial options with defaults', async () => {
        const mockFn = jest.fn<() => Promise<string>>()
          .mockRejectedValueOnce(new Error('ETIMEDOUT'))
          .mockResolvedValueOnce('success');

        // maxRetriesのみ上書き
        const result = await RetryManager.executeWithRetry(mockFn, {
          maxRetries: 5,
        });

        expect(result.success).toBe(true);
        expect(result.attempts).toBe(2);
      });
    });

    describe('エラー情報の保持', () => {
      it('should preserve original error on failure', async () => {
        const originalError = new Error('Custom error message');
        const mockFn = jest.fn<() => Promise<string>>().mockRejectedValue(originalError);

        const result = await RetryManager.executeWithRetry(mockFn, {
          maxRetries: 2,
          initialDelayMs: 10,
          maxDelayMs: 100,
          backoffMultiplier: 2,
          retryableErrors: [],
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe(originalError);
        expect(result.error?.message).toBe('Custom error message');
      });
    });
  });

  describe('isRetryable', () => {
    it('should identify retryable errors', () => {
      const retryableErrors = [
        'ECONNRESET',
        'ETIMEDOUT',
        'rate_limit',
      ];

      const error = new Error('Connection failed: ETIMEDOUT');

      const isRetryable = RetryManager.isRetryable(error, retryableErrors);

      expect(isRetryable).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      const retryableErrors = [
        'ECONNRESET',
        'ETIMEDOUT',
      ];

      const error = new Error('Invalid authentication');

      const isRetryable = RetryManager.isRetryable(error, retryableErrors);

      expect(isRetryable).toBe(false);
    });

    it('should be case-insensitive', () => {
      const retryableErrors = ['etimedout'];

      const error = new Error('Connection ETIMEDOUT');

      const isRetryable = RetryManager.isRetryable(error, retryableErrors);

      expect(isRetryable).toBe(true);
    });
  });
});
