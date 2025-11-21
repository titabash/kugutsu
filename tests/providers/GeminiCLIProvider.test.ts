/**
 * GeminiCLIProvider Test
 *
 * Tests the Gemini CLI provider implementation using AI SDK v5
 */

import { jest } from '@jest/globals';

// Mock the ai and ai-sdk-provider-gemini-cli packages
const mockStreamText = jest.fn<any>();
const mockCreateGeminiProvider = jest.fn<any>();

jest.unstable_mockModule('ai', () => ({
  streamText: mockStreamText,
}));

jest.unstable_mockModule('ai-sdk-provider-gemini-cli', () => ({
  createGeminiProvider: mockCreateGeminiProvider,
}));

// Import after mocking
const { GeminiCLIProvider } = await import('../../src/providers/GeminiCLIProvider.js');

describe('GeminiCLIProvider', () => {
  let provider: InstanceType<typeof GeminiCLIProvider>;
  let mockGeminiInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Gemini provider instance
    mockGeminiInstance = jest.fn((model: string) => ({
      provider: 'gemini',
      model,
    }));

    // Mock createGeminiProvider to return a function
    mockCreateGeminiProvider.mockReturnValue(mockGeminiInstance);

    // Create provider instance with OAuth authentication
    provider = new GeminiCLIProvider({
      authType: 'oauth-personal',
      model: 'gemini-2.5-pro',
    });
  });

  describe('Initialization', () => {
    test('should initialize with OAuth authentication', () => {
      expect(provider.getProviderName()).toBe('gemini');
      expect(provider.getModel()).toBe('gemini-2.5-pro');
      expect(provider.isReady()).toBe(true);

      // Verify createGeminiProvider was called with OAuth config
      expect(mockCreateGeminiProvider).toHaveBeenCalledWith({
        authType: 'oauth-personal',
        apiKey: undefined,
      });
    });

    test('should initialize with API key authentication', () => {
      const apiKeyProvider = new GeminiCLIProvider({
        authType: 'api-key',
        apiKey: 'test-api-key',
        model: 'gemini-2.5-flash',
      });

      expect(apiKeyProvider.getProviderName()).toBe('gemini');
      expect(apiKeyProvider.getModel()).toBe('gemini-2.5-flash');
      expect(apiKeyProvider.isReady()).toBe(true);

      // Verify createGeminiProvider was called with API key config
      expect(mockCreateGeminiProvider).toHaveBeenCalledWith({
        authType: 'api-key',
        apiKey: 'test-api-key',
      });
    });

    test('should use default model if not specified', () => {
      const defaultProvider = new GeminiCLIProvider({
        authType: 'oauth-personal',
      });

      expect(defaultProvider.getModel()).toBe('gemini-2.5-pro');
    });

    test('should use OAuth authentication by default', () => {
      const defaultAuthProvider = new GeminiCLIProvider({});

      expect(defaultAuthProvider.isReady()).toBe(true);

      // Verify OAuth is the default
      expect(mockCreateGeminiProvider).toHaveBeenCalledWith({
        authType: 'oauth-personal',
        apiKey: undefined,
      });
    });
  });

  describe('Supported Tools', () => {
    test('should return supported tools', () => {
      const tools = provider.getSupportedTools();

      expect(tools).toContain('Read');
      expect(tools).toContain('Write');
      expect(tools).toContain('Edit');
      expect(tools).toContain('Bash');
      expect(tools).toContain('Glob');
      expect(tools).toContain('Grep');
      expect(tools).toContain('WebSearch');
      expect(tools).toContain('WebFetch');
    });
  });

  describe('Execute Method', () => {
    test('should execute prompt and stream messages with fullStream', async () => {
      // Mock streamText response with fullStream
      const mockFullStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'text-delta', text: 'Hello ', id: 'test-1' };
          yield { type: 'text-delta', text: 'from Gemini', id: 'test-2' };
          yield { type: 'finish', finishReason: 'stop' };
        },
      };

      const mockResult = {
        fullStream: mockFullStream,
        usage: Promise.resolve({
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 30,
        }),
        finishReason: Promise.resolve('stop'),
      };

      mockStreamText.mockResolvedValue(mockResult);

      // Execute query
      const messages: any[] = [];
      for await (const message of provider.execute('Test prompt')) {
        messages.push(message);
      }

      // Verify messages
      expect(messages.length).toBeGreaterThanOrEqual(3);

      // System initialization message
      expect(messages[0].type).toBe('system');
      expect(messages[0].content.initialized).toBe(true);

      // Assistant messages (text deltas)
      const assistantMessages = messages.filter(m => m.type === 'assistant');
      expect(assistantMessages.length).toBeGreaterThan(0);

      // Result message
      const resultMessage = messages.find(m => m.type === 'result');
      expect(resultMessage).toBeDefined();
      expect(resultMessage.content.success).toBe(true);
      expect(resultMessage.content.tokenUsage).toEqual({
        input: 10,
        output: 20,
        total: 30,
      });
    });

    test('should pass options to streamText', async () => {
      const mockFullStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'text-delta', text: 'Test', id: 'test-3' };
          yield { type: 'finish', finishReason: 'stop' };
        },
      };

      mockStreamText.mockResolvedValue({
        fullStream: mockFullStream,
        usage: Promise.resolve({
          inputTokens: 5,
          outputTokens: 5,
          totalTokens: 10,
        }),
        finishReason: Promise.resolve('stop'),
      });

      const options = {
        maxTurns: 10,
        model: 'gemini-2.5-pro',
      };

      // Execute with options
      const messages: any[] = [];
      for await (const message of provider.execute('Test', options)) {
        messages.push(message);
      }

      // Verify streamText was called with correct parameters
      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.any(Object),
          prompt: 'Test',
          tools: expect.any(Object), // Tools should be included
        })
      );
    });

    test('should include partial messages when option is enabled', async () => {
      const mockFullStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'text-delta', text: 'Chunk 1', id: 'test-4' };
          yield { type: 'text-delta', text: ' Chunk 2', id: 'test-5' };
          yield { type: 'finish', finishReason: 'stop' };
        },
      };

      mockStreamText.mockResolvedValue({
        fullStream: mockFullStream,
        usage: Promise.resolve({
          inputTokens: 5,
          outputTokens: 10,
          totalTokens: 15,
        }),
        finishReason: Promise.resolve('stop'),
      });

      // Execute with includePartialMessages option
      const messages: any[] = [];
      for await (const message of provider.execute('Test', { includePartialMessages: true })) {
        messages.push(message);
      }

      // Should have partial messages
      const partialMessages = messages.filter(m => m.type === 'partial');
      expect(partialMessages.length).toBeGreaterThan(0);
    });

    test('should handle tool call events', async () => {
      // Mock fullStream with tool-call and tool-result events
      const mockFullStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'text-delta', text: 'Using tool...', id: 'test-6' };
          yield {
            type: 'tool-call',
            toolName: 'Read',
            toolCallId: 'call_123',
            args: { file_path: '/test/file.txt' },
          };
          yield {
            type: 'tool-result',
            toolName: 'Read',
            toolCallId: 'call_123',
            result: { success: true, content: 'file content' },
          };
          yield { type: 'text-delta', text: 'Done!', id: 'test-7' };
          yield { type: 'finish', finishReason: 'stop' };
        },
      };

      mockStreamText.mockResolvedValue({
        fullStream: mockFullStream,
        usage: Promise.resolve({
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 30,
        }),
        finishReason: Promise.resolve('stop'),
      });

      const messages: any[] = [];
      for await (const message of provider.execute('Read a file')) {
        messages.push(message);
      }

      // Should have tool-related system messages
      const systemMessages = messages.filter(m => m.type === 'system');
      expect(systemMessages.length).toBeGreaterThan(1); // init + tool messages

      // Should have toolProgress message (tool-call)
      const toolProgressMsg = systemMessages.find(
        m => m.content?.toolProgress?.tool_name === 'Read'
      );
      expect(toolProgressMsg).toBeDefined();

      // Should have commandExecution message (tool-result)
      const commandExecMsg = systemMessages.find(
        m => m.content?.commandExecution?.command === 'Read'
      );
      expect(commandExecMsg).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle rate limit errors', async () => {
      // Mock streamText to reject with rate limit error
      const rateLimitError = new Error('429: Rate limit exceeded');
      mockStreamText.mockRejectedValue(rateLimitError);

      const messages: any[] = [];
      for await (const message of provider.execute('Test')) {
        messages.push(message);
      }

      // Should have system init and result message
      expect(messages.length).toBeGreaterThanOrEqual(2);

      const resultMessage = messages.find(m => m.type === 'result');
      expect(resultMessage).toBeDefined();
      expect(resultMessage.content.success).toBe(false);
      expect(resultMessage.content.subtype).toBe('rate_limit');
      expect(resultMessage.content.error).toContain('429');
    });

    test('should classify various rate limit patterns', async () => {
      const rateLimitMessages = [
        '429: Too many requests',
        'quota exceeded',
        'Rate limit reached',
        'usage limit exceeded',
      ];

      for (const errorMsg of rateLimitMessages) {
        jest.clearAllMocks();

        mockStreamText.mockRejectedValue(new Error(errorMsg));

        const messages: any[] = [];
        for await (const message of provider.execute('Test')) {
          messages.push(message);
        }

        const resultMessage = messages.find(m => m.type === 'result');
        expect(resultMessage?.content.subtype).toBe('rate_limit');
        expect(resultMessage?.content.error).toContain(errorMsg);
      }
    });

    test('should handle non-rate-limit errors', async () => {
      const genericError = new Error('Network connection failed');
      mockStreamText.mockRejectedValue(genericError);

      const messages: any[] = [];
      for await (const message of provider.execute('Test')) {
        messages.push(message);
      }

      const resultMessage = messages.find(m => m.type === 'result');
      expect(resultMessage).toBeDefined();
      expect(resultMessage.content.success).toBe(false);
      expect(resultMessage.content.subtype).toBeUndefined();
      expect(resultMessage.content.error).toBe('Network connection failed');
    });

    test('should handle errors during streaming', async () => {
      // Mock fullStream with error event
      const mockFullStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'text-delta', text: 'Processing...', id: 'test-8' };
          yield { type: 'error', error: new Error('Stream error occurred') };
        },
      };

      mockStreamText.mockResolvedValue({
        fullStream: mockFullStream,
        usage: Promise.resolve({
          inputTokens: 5,
          outputTokens: 5,
          totalTokens: 10,
        }),
        finishReason: Promise.resolve('error'),
      });

      const messages: any[] = [];
      for await (const message of provider.execute('Test')) {
        messages.push(message);
      }

      // Should have error result message
      const errorMessages = messages.filter(
        m => m.type === 'result' && m.content.success === false
      );
      expect(errorMessages.length).toBeGreaterThan(0);
    });
  });

  describe('Session Management', () => {
    test('should support resumeSession method', () => {
      // resumeSession should not throw
      expect(() => {
        provider.resumeSession('test-session-id');
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty stream', async () => {
      const mockFullStream = {
        async *[Symbol.asyncIterator]() {
          // Empty stream - only finish event
          yield { type: 'finish', finishReason: 'stop' };
        },
      };

      mockStreamText.mockResolvedValue({
        fullStream: mockFullStream,
        usage: Promise.resolve({
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        }),
        finishReason: Promise.resolve('stop'),
      });

      const messages: any[] = [];
      for await (const message of provider.execute('Test')) {
        messages.push(message);
      }

      // Should at least have system init and result message
      expect(messages.length).toBeGreaterThanOrEqual(2);
      expect(messages[0].type).toBe('system');

      const resultMessage = messages.find(m => m.type === 'result');
      expect(resultMessage).toBeDefined();
    });

    test('should handle missing usage information', async () => {
      const mockFullStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'text-delta', text: 'Test', id: 'test-9' };
          yield { type: 'finish', finishReason: 'stop' };
        },
      };

      mockStreamText.mockResolvedValue({
        fullStream: mockFullStream,
        usage: Promise.resolve(undefined), // No usage info
        finishReason: Promise.resolve('stop'),
      });

      const messages: any[] = [];
      for await (const message of provider.execute('Test')) {
        messages.push(message);
      }

      // Should still complete successfully
      const resultMessage = messages.find(m => m.type === 'result');
      expect(resultMessage).toBeDefined();
      expect(resultMessage.content.success).toBe(true);
    });
  });
});
