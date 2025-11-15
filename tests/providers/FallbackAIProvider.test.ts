/**
 * FallbackAIProvider Unit Tests
 *
 * Tests the automatic fallback behavior when primary provider fails
 */

import { FallbackAIProvider } from '../../src/providers/FallbackAIProvider.js';
import { MockAIProvider } from '../../src/providers/MockAIProvider.js';
import type { AIMessage } from '../../src/providers/IAIProvider.js';

describe('FallbackAIProvider', () => {
  describe('Primary provider success', () => {
    it('should use primary provider when no errors occur', async () => {
      const primaryProvider = new MockAIProvider();
      primaryProvider.setMockResponse(/test/, {
        messages: [
          {
            type: 'assistant',
            content: 'Primary provider response',
          },
          {
            type: 'result',
            content: {
              success: true,
            },
          },
        ],
      });

      const fallbackProvider = new MockAIProvider();
      fallbackProvider.setMockResponse(/test/, {
        messages: [
          {
            type: 'assistant',
            content: 'Fallback provider response',
          },
        ],
      });

      const provider = new FallbackAIProvider(
        primaryProvider,
        fallbackProvider
      );

      const messages: AIMessage[] = [];
      for await (const message of provider.execute('test prompt')) {
        messages.push(message);
      }

      expect(messages).toHaveLength(2);
      expect(messages[0].type).toBe('assistant');
      expect(messages[0].content).toBe('Primary provider response');
      expect(messages[1].type).toBe('result');
      expect(messages[1].content).toEqual({ success: true });
    });
  });

  describe('Fallback on rate_limit error', () => {
    it('should fallback to secondary provider on rate_limit error', async () => {
      const primaryProvider = new MockAIProvider();
      primaryProvider.setMockResponse(/test/, {
        messages: [
          {
            type: 'result',
            content: {
              success: false,
              subtype: 'rate_limit',
              error: 'Rate limit exceeded',
              errors: ['Rate limit exceeded'],
            },
          },
        ],
      });

      const fallbackProvider = new MockAIProvider();
      fallbackProvider.setMockResponse(/test/, {
        messages: [
          {
            type: 'assistant',
            content: 'Fallback provider response',
          },
          {
            type: 'result',
            content: {
              success: true,
            },
          },
        ],
      });

      const provider = new FallbackAIProvider(
        primaryProvider,
        fallbackProvider
      );

      const messages: AIMessage[] = [];
      for await (const message of provider.execute('test prompt')) {
        messages.push(message);
      }

      // Primary error + Fallback messages
      expect(messages.length).toBeGreaterThan(0);

      // Should have fallback provider response
      const assistantMessages = messages.filter((m) => m.type === 'assistant');
      expect(assistantMessages).toHaveLength(1);
      expect(assistantMessages[0].content).toBe('Fallback provider response');
    });
  });

  describe('Fallback on error_max_turns error', () => {
    it('should fallback to secondary provider on error_max_turns error', async () => {
      const primaryProvider = new MockAIProvider();
      primaryProvider.setMockResponse(/test/, {
        messages: [
          {
            type: 'result',
            content: {
              success: false,
              subtype: 'error_max_turns',
              error: 'Maximum turns reached',
              errors: ['Maximum turns reached'],
            },
          },
        ],
      });

      const fallbackProvider = new MockAIProvider();
      fallbackProvider.setMockResponse(/test/, {
        messages: [
          {
            type: 'assistant',
            content: 'Fallback response after max turns',
          },
          {
            type: 'result',
            content: {
              success: true,
            },
          },
        ],
      });

      const provider = new FallbackAIProvider(
        primaryProvider,
        fallbackProvider
      );

      const messages: AIMessage[] = [];
      for await (const message of provider.execute('test prompt')) {
        messages.push(message);
      }

      const assistantMessages = messages.filter((m) => m.type === 'assistant');
      expect(assistantMessages).toHaveLength(1);
      expect(assistantMessages[0].content).toBe('Fallback response after max turns');
    });
  });

  describe('Both providers fail', () => {
    it('should return error when both primary and fallback providers fail', async () => {
      const primaryProvider = new MockAIProvider();
      primaryProvider.setMockResponse(/test/, {
        messages: [
          {
            type: 'result',
            content: {
              success: false,
              subtype: 'rate_limit',
              error: 'Primary rate limit',
              errors: ['Primary rate limit'],
            },
          },
        ],
      });

      const fallbackProvider = new MockAIProvider();
      fallbackProvider.setMockResponse(/test/, {
        messages: [
          {
            type: 'result',
            content: {
              success: false,
              subtype: 'rate_limit',
              error: 'Fallback also failed',
              errors: ['Fallback also failed'],
            },
          },
        ],
      });

      const provider = new FallbackAIProvider(
        primaryProvider,
        fallbackProvider
      );

      const messages: AIMessage[] = [];
      for await (const message of provider.execute('test prompt')) {
        messages.push(message);
      }

      const resultMessages = messages.filter((m) => m.type === 'result');
      expect(resultMessages.length).toBeGreaterThan(0);

      const lastResult = resultMessages[resultMessages.length - 1];
      expect(lastResult.content.success).toBe(false);

      // Check that error message includes both provider failures
      const errorMsg = lastResult.content.error || '';
      expect(errorMsg).toContain('両方のAIプロバイダーが失敗しました');
      expect(errorMsg).toContain('Primary rate limit');
      expect(errorMsg).toContain('Fallback also failed');
    });
  });

  describe('No fallback provider', () => {
    it('should return error when no fallback provider is available', async () => {
      const primaryProvider = new MockAIProvider();
      primaryProvider.setMockResponse(/test/, {
        messages: [
          {
            type: 'result',
            content: {
              success: false,
              subtype: 'rate_limit',
              error: 'Rate limit exceeded',
              errors: ['Rate limit exceeded'],
            },
          },
        ],
      });

      const provider = new FallbackAIProvider(primaryProvider, undefined);

      const messages: AIMessage[] = [];
      for await (const message of provider.execute('test prompt')) {
        messages.push(message);
      }

      const resultMessages = messages.filter((m) => m.type === 'result');
      expect(resultMessages.length).toBeGreaterThan(0);

      const lastResult = resultMessages[resultMessages.length - 1];
      expect(lastResult.content.success).toBe(false);
    });
  });

  describe('Fallback disabled', () => {
    it('should not fallback when fallback is disabled', async () => {
      const primaryProvider = new MockAIProvider();
      primaryProvider.setMockResponse(/test/, {
        messages: [
          {
            type: 'result',
            content: {
              success: false,
              subtype: 'rate_limit',
              error: 'Rate limit exceeded',
              errors: ['Rate limit exceeded'],
            },
          },
        ],
      });

      const fallbackProvider = new MockAIProvider();
      fallbackProvider.setMockResponse(/test/, {
        messages: [
          {
            type: 'assistant',
            content: 'This should not be called',
          },
        ],
      });

      const provider = new FallbackAIProvider(
        primaryProvider,
        fallbackProvider,
        false // Fallback disabled
      );

      const messages: AIMessage[] = [];
      for await (const message of provider.execute('test prompt')) {
        messages.push(message);
      }

      const assistantMessages = messages.filter((m) => m.type === 'assistant');
      expect(assistantMessages).toHaveLength(0);
    });
  });

  describe('Non-fallback error types', () => {
    it('should not fallback for non-fallback error types', async () => {
      const primaryProvider = new MockAIProvider();
      primaryProvider.setMockResponse(/test/, {
        messages: [
          {
            type: 'result',
            content: {
              success: false,
              subtype: 'network_error',
              error: 'Network connection failed',
              errors: ['Network connection failed'],
            },
          },
        ],
      });

      const fallbackProvider = new MockAIProvider();
      fallbackProvider.setMockResponse(/test/, {
        messages: [
          {
            type: 'assistant',
            content: 'This should not be called',
          },
        ],
      });

      const provider = new FallbackAIProvider(
        primaryProvider,
        fallbackProvider
      );

      const messages: AIMessage[] = [];
      for await (const message of provider.execute('test prompt')) {
        messages.push(message);
      }

      const assistantMessages = messages.filter((m) => m.type === 'assistant');
      expect(assistantMessages).toHaveLength(0);
    });
  });

  describe('IAIProvider interface', () => {
    it('should implement resumeSession', () => {
      const primaryProvider = new MockAIProvider();
      const fallbackProvider = new MockAIProvider();
      const provider = new FallbackAIProvider(
        primaryProvider,
        fallbackProvider
      );

      expect(() => provider.resumeSession('test-session-id')).not.toThrow();
    });

    it('should implement getSupportedTools', () => {
      const primaryProvider = new MockAIProvider();
      const fallbackProvider = new MockAIProvider();
      const provider = new FallbackAIProvider(
        primaryProvider,
        fallbackProvider
      );

      const tools = provider.getSupportedTools();
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should implement getProviderName', () => {
      const primaryProvider = new MockAIProvider();
      const fallbackProvider = new MockAIProvider();
      const provider = new FallbackAIProvider(
        primaryProvider,
        fallbackProvider
      );

      const name = provider.getProviderName();
      expect(name).toContain('with-fallback');
    });

    it('should implement getProviderName without fallback', () => {
      const primaryProvider = new MockAIProvider();
      const provider = new FallbackAIProvider(primaryProvider, undefined);

      const name = provider.getProviderName();
      expect(name).toBe('mock');
    });

    it('should implement getModel', () => {
      const primaryProvider = new MockAIProvider();
      const fallbackProvider = new MockAIProvider();
      const provider = new FallbackAIProvider(
        primaryProvider,
        fallbackProvider
      );

      const model = provider.getModel();
      expect(typeof model).toBe('string');
    });

    it('should implement isReady', () => {
      const primaryProvider = new MockAIProvider();
      const fallbackProvider = new MockAIProvider();
      const provider = new FallbackAIProvider(
        primaryProvider,
        fallbackProvider
      );

      expect(provider.isReady()).toBe(true);
    });
  });

  describe('Automatic failure recording', () => {
    beforeEach(async () => {
      // Import AIProviderFactory dynamically to reset state
      const { AIProviderFactory } = await import('../../src/providers/AIProviderFactory.js');
      AIProviderFactory.syncWithState([]);
    });

    it('should record primary provider failure when fallback succeeds', async () => {
      const { AIProviderFactory } = await import('../../src/providers/AIProviderFactory.js');

      const primaryProvider = new MockAIProvider();
      primaryProvider.setMockResponse(/test/, {
        messages: [
          {
            type: 'result',
            content: {
              success: false,
              subtype: 'rate_limit',
              error: 'Rate limit exceeded',
              errors: ['Rate limit exceeded'],
            },
          },
        ],
      });

      const fallbackProvider = new MockAIProvider();
      fallbackProvider.setMockResponse(/test/, {
        messages: [
          {
            type: 'assistant',
            content: 'Fallback response',
          },
          {
            type: 'result',
            content: {
              success: true,
            },
          },
        ],
      });

      const provider = new FallbackAIProvider(
        primaryProvider,
        fallbackProvider
      );

      const messages: AIMessage[] = [];
      for await (const message of provider.execute('test prompt')) {
        messages.push(message);
      }

      // Check that primary provider was recorded as failed
      const failedProviders = AIProviderFactory.getFailedProviders();
      expect(failedProviders).toContain('mock');
    });

    it('should record both providers when both fail', async () => {
      const { AIProviderFactory } = await import('../../src/providers/AIProviderFactory.js');

      const primaryProvider = new MockAIProvider();
      primaryProvider.setMockResponse(/test/, {
        messages: [
          {
            type: 'result',
            content: {
              success: false,
              subtype: 'rate_limit',
              error: 'Primary rate limit',
              errors: ['Primary rate limit'],
            },
          },
        ],
      });

      const fallbackProvider = new MockAIProvider();
      fallbackProvider.setMockResponse(/test/, {
        messages: [
          {
            type: 'result',
            content: {
              success: false,
              subtype: 'rate_limit',
              error: 'Fallback rate limit',
              errors: ['Fallback rate limit'],
            },
          },
        ],
      });

      const provider = new FallbackAIProvider(
        primaryProvider,
        fallbackProvider
      );

      const messages: AIMessage[] = [];
      for await (const message of provider.execute('test prompt')) {
        messages.push(message);
      }

      // Check that both providers were recorded as failed
      const failedProviders = AIProviderFactory.getFailedProviders();
      expect(failedProviders).toContain('mock');
      expect(failedProviders.length).toBeGreaterThan(0);
    });

    it('should record primary provider when fallback is disabled', async () => {
      const { AIProviderFactory } = await import('../../src/providers/AIProviderFactory.js');

      const primaryProvider = new MockAIProvider();
      primaryProvider.setMockResponse(/test/, {
        messages: [
          {
            type: 'result',
            content: {
              success: false,
              subtype: 'rate_limit',
              error: 'Rate limit exceeded',
              errors: ['Rate limit exceeded'],
            },
          },
        ],
      });

      const fallbackProvider = new MockAIProvider();
      const provider = new FallbackAIProvider(
        primaryProvider,
        fallbackProvider,
        false // Fallback disabled
      );

      const messages: AIMessage[] = [];
      for await (const message of provider.execute('test prompt')) {
        messages.push(message);
      }

      // Check that primary provider was recorded as failed
      const failedProviders = AIProviderFactory.getFailedProviders();
      expect(failedProviders).toContain('mock');
    });

    it('should not record failure when primary succeeds', async () => {
      const { AIProviderFactory } = await import('../../src/providers/AIProviderFactory.js');

      const primaryProvider = new MockAIProvider();
      primaryProvider.setMockResponse(/test/, {
        messages: [
          {
            type: 'assistant',
            content: 'Success response',
          },
          {
            type: 'result',
            content: {
              success: true,
            },
          },
        ],
      });

      const fallbackProvider = new MockAIProvider();
      const provider = new FallbackAIProvider(
        primaryProvider,
        fallbackProvider
      );

      const messages: AIMessage[] = [];
      for await (const message of provider.execute('test prompt')) {
        messages.push(message);
      }

      // Check that no providers were recorded as failed
      const failedProviders = AIProviderFactory.getFailedProviders();
      expect(failedProviders).toEqual([]);
    });
  });
});
