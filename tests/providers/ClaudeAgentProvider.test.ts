/**
 * ClaudeAgentProvider Test
 *
 * Tests the Claude Agent SDK provider implementation
 */

import { jest } from '@jest/globals';

// Mock the @anthropic-ai/claude-agent-sdk package
const mockQuery = jest.fn<any>();
jest.unstable_mockModule('@anthropic-ai/claude-agent-sdk', () => ({
  query: mockQuery,
}));

// Import after mocking
const { ClaudeAgentProvider } = await import('../../src/providers/ClaudeAgentProvider.js');

describe('ClaudeAgentProvider', () => {
  let provider: InstanceType<typeof ClaudeAgentProvider>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set API key environment variable
    process.env.ANTHROPIC_API_KEY = 'test-api-key';

    // Create provider instance
    provider = new ClaudeAgentProvider({
      apiKey: 'test-api-key',
      model: 'claude-sonnet-4-5-20250929',
    });
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  test('should initialize with correct configuration', () => {
    expect(provider.getProviderName()).toBe('claude');
    expect(provider.getModel()).toBe('claude-sonnet-4-5-20250929');
    expect(provider.isReady()).toBe(true);
  });

  test('should allow initialization without API key (for Claude Code environment)', () => {
    delete process.env.ANTHROPIC_API_KEY;

    // API key is optional when running in Claude Code environment
    // The SDK will use the logged-in session if no API key is provided
    expect(() => {
      new ClaudeAgentProvider({});
    }).not.toThrow();
  });

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

  test('should execute prompt and stream messages', async () => {
    // Mock query response
    const mockMessages = [
      {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'text',
              text: 'Hello, I am Claude',
            },
          ],
        },
        session_id: 'test-session-1',
        uuid: 'msg-1',
      },
      {
        type: 'result',
        subtype: 'success',
        duration_ms: 1000,
        usage: {
          input_tokens: 10,
          output_tokens: 20,
        },
        total_cost_usd: 0.001,
        permission_denials: [],
        result: 'Task completed',
        session_id: 'test-session-1',
        uuid: 'msg-2',
      },
    ];

    mockQuery.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        for (const msg of mockMessages) {
          yield msg;
        }
      },
    });

    // Execute query
    const messages: any[] = [];
    for await (const message of provider.execute('Test prompt')) {
      messages.push(message);
    }

    // Verify messages
    expect(messages.length).toBe(2);

    expect(messages[0].type).toBe('assistant');
    expect(messages[0].content).toBe('Hello, I am Claude');
    expect(messages[0].session_id).toBe('test-session-1');

    expect(messages[1].type).toBe('result');
    expect(messages[1].content.success).toBe(true);
    expect(messages[1].content.duration).toBe(1000);
    expect(messages[1].content.tokenUsage.input).toBe(10);
    expect(messages[1].content.tokenUsage.output).toBe(20);
    expect(messages[1].content.cost).toBe(0.001);
  });

  test('should pass options to query function', async () => {
    mockQuery.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'text',
                text: 'Test',
              },
            ],
          },
          session_id: 'test',
        };
      },
    });

    const options = {
      maxTurns: 10,
      cwd: '/test/path',
      allowedTools: ['Read', 'Write'],
      permissionMode: 'acceptEdits' as const,
      model: 'claude-opus-4',
    };

    // Execute with options
    const messages: any[] = [];
    for await (const message of provider.execute('Test', options)) {
      messages.push(message);
    }

    // Verify query was called with correct options
    expect(mockQuery).toHaveBeenCalledWith({
      prompt: 'Test',
      options: expect.objectContaining({
        maxTurns: 10,
        cwd: '/test/path',
        allowedTools: ['Read', 'Write'],
        permissionMode: 'acceptEdits',
        model: 'claude-opus-4',
      }),
    });
  });

  test('should handle system init message', async () => {
    const mockMessage = {
      type: 'system',
      subtype: 'init',
      cwd: '/test/cwd',
      tools: ['Read', 'Write'],
      model: 'claude-sonnet-4-5-20250929',
      permissionMode: 'default',
      mcp_servers: {},
      session_id: 'test-session',
      uuid: 'sys-1',
    };

    mockQuery.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield mockMessage;
      },
    });

    const messages: any[] = [];
    for await (const message of provider.execute('Test')) {
      messages.push(message);
    }

    expect(messages[0].type).toBe('system');
    expect(messages[0].content.cwd).toBe('/test/cwd');
    expect(messages[0].content.tools).toEqual(['Read', 'Write']);
    expect(messages[0].content.model).toBe('claude-sonnet-4-5-20250929');
  });

  test('should handle error result message', async () => {
    const mockMessage = {
      type: 'result',
      subtype: 'error',
      duration_ms: 500,
      usage: {
        input_tokens: 5,
        output_tokens: 0,
      },
      total_cost_usd: 0.0001,
      permission_denials: [],
      errors: ['Something went wrong'],
      session_id: 'test-session',
      uuid: 'err-1',
    };

    mockQuery.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield mockMessage;
      },
    });

    const messages: any[] = [];
    for await (const message of provider.execute('Test')) {
      messages.push(message);
    }

    expect(messages[0].type).toBe('result');
    expect(messages[0].content.success).toBe(false);
    expect(messages[0].content.errors).toEqual(['Something went wrong']);
  });

  test('should handle stream events as partial messages', async () => {
    const mockMessage = {
      type: 'stream_event',
      event: { type: 'text_delta', delta: 'Hello' },
      session_id: 'test-session',
      uuid: 'stream-1',
    };

    mockQuery.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield mockMessage;
      },
    });

    const messages: any[] = [];
    for await (const message of provider.execute('Test', { includePartialMessages: true })) {
      messages.push(message);
    }

    expect(messages[0].type).toBe('partial');
    expect(messages[0].content.type).toBe('text_delta');
  });

  test('should resume session', async () => {
    mockQuery.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'text',
                text: 'Resumed',
              },
            ],
          },
          session_id: 'resumed-session',
        };
      },
    });

    // Resume session
    provider.resumeSession('previous-session');

    const messages: any[] = [];
    for await (const message of provider.execute('Continue', { resume: 'previous-session' })) {
      messages.push(message);
    }

    expect(mockQuery).toHaveBeenCalledWith({
      prompt: 'Continue',
      options: expect.objectContaining({
        resume: 'previous-session',
      }),
    });

    expect(provider.getCurrentSession()).toBe('resumed-session');
  });

  test('should handle query errors gracefully', async () => {
    // Mock query to throw error
    mockQuery.mockImplementation(() => {
      throw new Error('API connection failed');
    });

    const messages: any[] = [];
    for await (const message of provider.execute('Test')) {
      messages.push(message);
    }

    expect(messages.length).toBe(1);
    expect(messages[0].type).toBe('result');
    expect(messages[0].content.success).toBe(false);
    expect(messages[0].content.error).toBe('API connection failed');
  });

  test('should classify usage limit error as rate_limit in catch block', async () => {
    // Mock query to throw usage limit error
    mockQuery.mockImplementation(() => {
      throw new Error("You've hit your usage limit. Upgrade to Pro (https://openai.com/chatgpt/pricing), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at Nov 18th, 2025 1:54 PM.");
    });

    const messages: any[] = [];
    for await (const message of provider.execute('Test')) {
      messages.push(message);
    }

    expect(messages.length).toBe(1);
    expect(messages[0].type).toBe('result');
    expect(messages[0].content.success).toBe(false);
    expect(messages[0].content.subtype).toBe('rate_limit');
    expect(messages[0].content.error).toContain('usage limit');
    expect(messages[0].content.errors).toEqual([expect.stringContaining('usage limit')]);
  });

  test('should classify various usage limit patterns as rate_limit in catch block', async () => {
    const usageLimitMessages = [
      "You've hit your usage limit",
      'Upgrade to Pro',
      'purchase more credits',
      'weekly limit reached',
      'monthly limit exceeded',
      'quota exceeded',
      'subscription required',
    ];

    for (const errorMsg of usageLimitMessages) {
      mockQuery.mockImplementation(() => {
        throw new Error(errorMsg);
      });

      const messages: any[] = [];
      for await (const message of provider.execute('Test')) {
        messages.push(message);
      }

      expect(messages[0].content.subtype).toBe('rate_limit');
      expect(messages[0].content.error).toBe(errorMsg);
    }
  });

  test('should not classify non-usage-limit errors as rate_limit in catch block', async () => {
    // Mock query to throw non-usage-limit error
    mockQuery.mockImplementation(() => {
      throw new Error('API connection failed');
    });

    const messages: any[] = [];
    for await (const message of provider.execute('Test')) {
      messages.push(message);
    }

    expect(messages.length).toBe(1);
    expect(messages[0].type).toBe('result');
    expect(messages[0].content.success).toBe(false);
    expect(messages[0].content.subtype).toBeUndefined(); // Should not be rate_limit
    expect(messages[0].content.error).toBe('API connection failed');
  });

  describe('AbortController support', () => {
    test('should pass AbortController to query() when provided', async () => {
      mockQuery.mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'text',
                  text: 'Test response',
                },
              ],
            },
            session_id: 'test-session',
          };
        },
      });

      const abortController = new AbortController();

      // Execute with abortController
      const messages: any[] = [];
      for await (const message of provider.execute('Test', { abortController })) {
        messages.push(message);
      }

      // Verify query was called with abortController
      expect(mockQuery).toHaveBeenCalledWith({
        prompt: 'Test',
        options: expect.objectContaining({
          abortController,
        }),
      });
    });

    test('should stop execution when AbortController is aborted', async () => {
      const abortController = new AbortController();
      let yieldCount = 0;

      // Mock query to yield multiple messages and respect abort signal
      mockQuery.mockReturnValue({
        async *[Symbol.asyncIterator]() {
          for (let i = 0; i < 100; i++) {
            // Check if aborted (simulate what Claude SDK does)
            if (abortController.signal.aborted) {
              return;
            }

            yieldCount++;
            yield {
              type: 'assistant',
              message: {
                content: [
                  {
                    type: 'text',
                    text: `Message ${i}`,
                  },
                ],
              },
              session_id: 'test-session',
            };

            // Small delay to simulate async processing
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        },
      });

      // Start execution but abort after a short delay
      const executePromise = (async () => {
        const messages: any[] = [];
        for await (const message of provider.execute('Test', { abortController })) {
          messages.push(message);
        }
        return messages;
      })();

      // Abort after a short delay
      await new Promise(resolve => setTimeout(resolve, 50));
      abortController.abort();

      const messages = await executePromise;

      // Should have stopped before yielding all 100 messages
      expect(messages.length).toBeLessThan(100);
      expect(yieldCount).toBeLessThan(100);
    });

    test('should work without AbortController (backward compatibility)', async () => {
      mockQuery.mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'text',
                  text: 'Test',
                },
              ],
            },
            session_id: 'test',
          };
        },
      });

      // Execute without abortController
      const messages: any[] = [];
      for await (const message of provider.execute('Test')) {
        messages.push(message);
      }

      expect(messages.length).toBe(1);

      // Verify query was called without abortController
      expect(mockQuery).toHaveBeenCalledWith({
        prompt: 'Test',
        options: expect.not.objectContaining({
          abortController: expect.anything(),
        }),
      });
    });
  });
});
