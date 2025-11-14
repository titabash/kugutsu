/**
 * OpenAICodexProvider Test
 *
 * Tests the OpenAI Codex SDK provider implementation
 */

import { jest } from '@jest/globals';

// Mock the @openai/codex-sdk package
const mockStartThread = jest.fn<any>();
const mockResumeThread = jest.fn<any>();
const mockCodexConstructor = jest.fn().mockImplementation(() => ({
  startThread: mockStartThread,
  resumeThread: mockResumeThread,
}));

jest.unstable_mockModule('@openai/codex-sdk', () => ({
  Codex: mockCodexConstructor,
}));

// Import after mocking
const { OpenAICodexProvider } = await import('../../src/providers/OpenAICodexProvider.js');

describe('OpenAICodexProvider', () => {
  let provider: InstanceType<typeof OpenAICodexProvider>;

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.OPENAI_API_KEY = 'test-api-key';

    provider = new OpenAICodexProvider({
      apiKey: 'test-api-key',
      model: 'gpt-5-codex',
    });
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_CODEX_BASE_URL;
  });

  test('should initialize with correct configuration', () => {
    expect(provider.getProviderName()).toBe('codex');
    expect(provider.getModel()).toBe('gpt-5-codex');
    expect(provider.isReady()).toBe(true);
    expect(mockCodexConstructor).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
    });
  });

  test('should initialize without API key', () => {
    delete process.env.OPENAI_API_KEY;
    mockCodexConstructor.mockClear();

    expect(() => new OpenAICodexProvider({})).not.toThrow();
    expect(mockCodexConstructor).toHaveBeenCalledWith({});
  });

  test('should respect custom base URL from environment', () => {
    delete process.env.OPENAI_API_KEY;
    process.env.OPENAI_CODEX_BASE_URL = 'https://codex.internal/v1';
    mockCodexConstructor.mockClear();

    new OpenAICodexProvider({});

    expect(mockCodexConstructor).toHaveBeenCalledWith({
      baseUrl: 'https://codex.internal/v1',
    });
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
    // Mock thread and runStreamed response
    const mockEvents = {
      async *[Symbol.asyncIterator]() {
        yield {
          type: 'thread.started',
          thread_id: 'thread-123',
        };
        yield {
          type: 'item.completed',
          item: {
            id: 'msg-1',
            type: 'agent_message',
            text: 'Hello from Codex',
          },
        };
        yield {
          type: 'turn.completed',
          usage: {
            input_tokens: 15,
            cached_input_tokens: 0,
            output_tokens: 25,
          },
        };
      },
    };

    mockStartThread.mockReturnValue({
      runStreamed: jest.fn<any>().mockResolvedValue({ events: mockEvents }),
      id: 'thread-123',
    });

    // Execute query
    const messages: any[] = [];
    for await (const message of provider.execute('Test prompt')) {
      messages.push(message);
    }

    // Verify messages (thread.started, agent_message, turn.completed)
    expect(messages.length).toBe(3);

    expect(messages[0].type).toBe('system');
    expect(messages[0].content.threadStarted).toBe(true);
    expect(messages[0].session_id).toBe('thread-123');

    expect(messages[1].type).toBe('assistant');
    expect(messages[1].content).toBe('Hello from Codex');

    expect(messages[2].type).toBe('result');
    expect(messages[2].content.success).toBe(true);
    expect(messages[2].content.tokenUsage.input).toBe(15);
    expect(messages[2].content.tokenUsage.output).toBe(25);
  });

  test('should pass options to run function', async () => {
    const mockEvents = {
      async *[Symbol.asyncIterator]() {
        yield {
          type: 'thread.started',
          thread_id: 'thread-456',
        };
      },
    };

    const mockThread = {
      runStreamed: jest.fn<any>().mockResolvedValue({ events: mockEvents }),
      id: 'thread-456',
    };

    mockStartThread.mockReturnValue(mockThread);

    const options = {
      maxTurns: 15,
      cwd: '/test/codex/path',
      allowedTools: ['Read', 'Write'],
      model: 'gpt-5-codex-pro',
    };

    // Execute with options
    const messages: any[] = [];
    for await (const message of provider.execute('Test', options)) {
      messages.push(message);
    }

    // Verify startThread was called with correct thread options
    expect(mockStartThread).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gpt-5-codex-pro',
      workingDirectory: '/test/codex/path',
    }));

    // Verify runStreamed was called with prompt
    expect(mockThread.runStreamed).toHaveBeenCalledWith('Test', {});
  });

  test('should handle thread started message', async () => {
    const mockEvents = {
      async *[Symbol.asyncIterator]() {
        yield {
          type: 'thread.started',
          thread_id: 'thread-789',
        };
      },
    };

    mockStartThread.mockReturnValue({
      runStreamed: jest.fn<any>().mockResolvedValue({ events: mockEvents }),
      id: 'thread-789',
    });

    const messages: any[] = [];
    for await (const message of provider.execute('Test')) {
      messages.push(message);
    }

    expect(messages[0].type).toBe('system');
    expect(messages[0].content.threadStarted).toBe(true);
    expect(messages[0].content.threadId).toBe('thread-789');
    expect(messages[0].session_id).toBe('thread-789');
  });

  test('should handle error result message', async () => {
    const mockEvents = {
      async *[Symbol.asyncIterator]() {
        yield {
          type: 'turn.failed',
          error: {
            message: 'Codex execution failed',
          },
        };
      },
    };

    mockStartThread.mockReturnValue({
      runStreamed: jest.fn<any>().mockResolvedValue({ events: mockEvents }),
      id: 'thread-error',
    });

    const messages: any[] = [];
    for await (const message of provider.execute('Test')) {
      messages.push(message);
    }

    expect(messages[0].type).toBe('result');
    expect(messages[0].content.success).toBe(false);
    expect(messages[0].content.errors).toEqual(['Codex execution failed']);
  });

  test('should classify usage limit error as rate_limit in turn.failed event', async () => {
    const mockEvents = {
      async *[Symbol.asyncIterator]() {
        yield {
          type: 'turn.failed',
          error: {
            message: "You've hit your usage limit. Upgrade to Pro (https://openai.com/chatgpt/pricing), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at Nov 18th, 2025 1:54 PM.",
          },
        };
      },
    };

    mockStartThread.mockReturnValue({
      runStreamed: jest.fn<any>().mockResolvedValue({ events: mockEvents }),
      id: 'thread-usage-limit',
    });

    const messages: any[] = [];
    for await (const message of provider.execute('Test')) {
      messages.push(message);
    }

    expect(messages[0].type).toBe('result');
    expect(messages[0].content.success).toBe(false);
    expect(messages[0].content.subtype).toBe('rate_limit');
    expect(messages[0].content.errors[0]).toContain('usage limit');
  });

  test('should classify various usage limit patterns as rate_limit in turn.failed', async () => {
    const usageLimitMessages = [
      "You've hit your usage limit",
      'Upgrade to Pro',
      'purchase more credits',
      'weekly limit reached',
      'monthly limit exceeded',
    ];

    for (const errorMsg of usageLimitMessages) {
      const mockEvents = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'turn.failed',
            error: {
              message: errorMsg,
            },
          };
        },
      };

      mockStartThread.mockReturnValue({
        runStreamed: jest.fn<any>().mockResolvedValue({ events: mockEvents }),
        id: `thread-${errorMsg.substring(0, 10)}`,
      });

      const messages: any[] = [];
      for await (const message of provider.execute('Test')) {
        messages.push(message);
      }

      expect(messages[0].content.subtype).toBe('rate_limit');
    }
  });

  test('should classify usage limit error as rate_limit in catch block', async () => {
    // Mock startThread to throw usage limit error
    mockStartThread.mockImplementation(() => {
      throw new Error("You've hit your usage limit. Upgrade to Pro");
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
  });

  test('should not classify non-usage-limit errors as rate_limit in turn.failed', async () => {
    const mockEvents = {
      async *[Symbol.asyncIterator]() {
        yield {
          type: 'turn.failed',
          error: {
            message: 'File not found: test.txt',
          },
        };
      },
    };

    mockStartThread.mockReturnValue({
      runStreamed: jest.fn<any>().mockResolvedValue({ events: mockEvents }),
      id: 'thread-normal-error',
    });

    const messages: any[] = [];
    for await (const message of provider.execute('Test')) {
      messages.push(message);
    }

    expect(messages[0].type).toBe('result');
    expect(messages[0].content.success).toBe(false);
    expect(messages[0].content.subtype).toBe('turn_failed'); // Should remain turn_failed, not rate_limit
  });

  test('should classify usage limit error as rate_limit in error event', async () => {
    const mockEvents = {
      async *[Symbol.asyncIterator]() {
        yield {
          type: 'error',
          message: "You've hit your usage limit. Upgrade to Pro (https://openai.com/chatgpt/pricing), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at Nov 15th, 2025 1:23 AM.",
        };
      },
    };

    mockStartThread.mockReturnValue({
      runStreamed: jest.fn<any>().mockResolvedValue({ events: mockEvents }),
      id: 'thread-error-usage-limit',
    });

    const messages: any[] = [];
    for await (const message of provider.execute('Test')) {
      messages.push(message);
    }

    expect(messages[0].type).toBe('result');
    expect(messages[0].content.success).toBe(false);
    expect(messages[0].content.subtype).toBe('rate_limit');
    expect(messages[0].content.error).toContain('usage limit');
  });

  test('should classify various usage limit patterns as rate_limit in error event', async () => {
    const usageLimitMessages = [
      "You've hit your usage limit",
      'Upgrade to Pro',
      'purchase more credits',
      'weekly limit reached',
      'monthly limit exceeded',
      'rate limit exceeded',
      'quota exceeded',
    ];

    for (const errorMsg of usageLimitMessages) {
      const mockEvents = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'error',
            message: errorMsg,
          };
        },
      };

      mockStartThread.mockReturnValue({
        runStreamed: jest.fn<any>().mockResolvedValue({ events: mockEvents }),
        id: `thread-error-${errorMsg.substring(0, 10)}`,
      });

      const messages: any[] = [];
      for await (const message of provider.execute('Test')) {
        messages.push(message);
      }

      expect(messages[0].content.subtype).toBe('rate_limit');
    }
  });

  test('should not classify non-usage-limit errors as rate_limit in error event', async () => {
    const mockEvents = {
      async *[Symbol.asyncIterator]() {
        yield {
          type: 'error',
          message: 'Network connection timeout',
        };
      },
    };

    mockStartThread.mockReturnValue({
      runStreamed: jest.fn<any>().mockResolvedValue({ events: mockEvents }),
      id: 'thread-error-normal',
    });

    const messages: any[] = [];
    for await (const message of provider.execute('Test')) {
      messages.push(message);
    }

    expect(messages[0].type).toBe('result');
    expect(messages[0].content.success).toBe(false);
    expect(messages[0].content.subtype).toBe('error'); // Should remain error, not rate_limit
  });

  test('should handle stream events as partial messages', async () => {
    const mockEvents = {
      async *[Symbol.asyncIterator]() {
        yield {
          type: 'turn.started',
        };
        yield {
          type: 'item.started',
          item: {
            id: 'item-1',
            type: 'agent_message',
            text: 'Starting...',
          },
        };
      },
    };

    mockStartThread.mockReturnValue({
      runStreamed: jest.fn<any>().mockResolvedValue({ events: mockEvents }),
      id: 'thread-stream',
    });

    const messages: any[] = [];
    for await (const message of provider.execute('Test', { includePartialMessages: true })) {
      messages.push(message);
    }

    // Should include both turn.started (partial) and item.started (partial)
    expect(messages.length).toBe(2);
    expect(messages[0].type).toBe('partial');
    expect(messages[0].content.turnStarted).toBe(true);
    expect(messages[1].type).toBe('assistant');
  });

  test('should resume thread', async () => {
    const mockEvents = {
      async *[Symbol.asyncIterator]() {
        yield {
          type: 'item.completed',
          item: {
            id: 'msg-1',
            type: 'agent_message',
            text: 'Resumed conversation',
          },
        };
      },
    };

    const mockResumedThread = {
      runStreamed: jest.fn<any>().mockResolvedValue({ events: mockEvents }),
      id: 'thread-resume',
    };

    mockResumeThread.mockReturnValue(mockResumedThread);

    // Resume session
    provider.resumeSession('thread-resume');

    const messages: any[] = [];
    for await (const message of provider.execute('Continue', { resume: 'thread-resume' })) {
      messages.push(message);
    }

    expect(mockResumeThread).toHaveBeenCalledWith('thread-resume', expect.objectContaining({
      model: 'gpt-5-codex',
      workingDirectory: expect.any(String),
    }));
    expect(provider.getCurrentSession()).toBe('thread-resume');
  });

  test('should handle execution errors gracefully', async () => {
    // Mock startThread to throw error
    mockStartThread.mockImplementation(() => {
      throw new Error('Codex API connection failed');
    });

    const messages: any[] = [];
    for await (const message of provider.execute('Test')) {
      messages.push(message);
    }

    expect(messages.length).toBe(1);
    expect(messages[0].type).toBe('result');
    expect(messages[0].content.success).toBe(false);
    expect(messages[0].content.error).toBe('Codex API connection failed');
  });
});
