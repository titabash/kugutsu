/**
 * AITaskNode Tests
 *
 * Phase 3.1: Base AI Task Node implementation
 * TDD Red Phase: These tests define expected behavior for AI task nodes
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AITaskNode, type AITaskNodeConfig } from '../../../src/workflow/nodes/AITaskNode.js';
import type {
  ExecutionContext,
  GlobalContext,
  Services,
  Utils,
  NodeResult,
} from '../../../src/workflow/types.js';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create mock services for testing
 */
function createMockServices(): Services {
  return {
    aiProvider: {
      query: jest.fn().mockResolvedValue({
        finalState: { result: 'Mock AI response' },
        duration: 100,
        turns: 1,
        tokensUsed: 50,
      }),
    },
    gitManager: {
      createWorktree: jest.fn().mockResolvedValue({ path: '/mock/worktree', branchName: 'test-branch' }),
      removeWorktree: jest.fn().mockResolvedValue(undefined),
      merge: jest.fn().mockResolvedValue({ success: true, hasConflict: false }),
    },
    stateManager: {
      emit: jest.fn(),
      subscribe: jest.fn().mockReturnValue(() => {}),
    },
    dataPersistence: {
      saveWorkflowResult: jest.fn().mockResolvedValue(undefined),
      loadWorkflowResult: jest.fn().mockResolvedValue(null),
    },
  };
}

/**
 * Create mock utils for testing
 */
function createMockUtils(): Utils {
  return {
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
    emit: jest.fn(),
    memoryMonitor: {
      getUsage: jest.fn().mockReturnValue({ heapUsed: 100, heapTotal: 500, rss: 200 }),
      checkThreshold: jest.fn().mockReturnValue(true),
    },
  };
}

/**
 * Create mock global context
 */
function createMockGlobalContext(executionId: string): GlobalContext {
  return {
    workflowId: 'test-workflow',
    executionId,
    projectPath: '/test/project',
    baseBranch: 'main',
    startedAt: new Date(),
    userSettings: {},
  };
}

/**
 * Create execution context for testing
 */
function createMockContext(
  inputs: Record<string, unknown> = {},
  executionId: string = 'test-exec-001'
): ExecutionContext {
  return {
    inputs,
    global: createMockGlobalContext(executionId),
    services: createMockServices(),
    utils: createMockUtils(),
  };
}

// ============================================================================
// AITaskNode Basic Tests
// ============================================================================

describe('AITaskNode', () => {
  describe('Construction', () => {
    it('should create AITaskNode with default configuration', () => {
      const node = new AITaskNode('ai-task-1', {});

      expect(node.id).toBe('ai-task-1');
      expect(node.type).toBe('ai:custom');
      expect(node.label).toBe('AI Task');
    });

    it('should create AITaskNode with custom label', () => {
      const node = new AITaskNode('ai-task-2', {
        label: 'Custom AI Task',
      });

      expect(node.label).toBe('Custom AI Task');
    });

    it('should have prompt input socket', () => {
      const node = new AITaskNode('ai-task-3', {});
      const json = node.toJSON();

      const promptInput = json.inputs.find(i => i.id === 'prompt');
      expect(promptInput).toBeDefined();
      expect(promptInput?.type).toBe('data');
      expect(promptInput?.required).toBe(true);
    });

    it('should have context input socket (optional)', () => {
      const node = new AITaskNode('ai-task-4', {});
      const json = node.toJSON();

      const contextInput = json.inputs.find(i => i.id === 'context');
      expect(contextInput).toBeDefined();
      expect(contextInput?.required).toBe(false);
    });

    it('should have result output socket', () => {
      const node = new AITaskNode('ai-task-5', {});
      const json = node.toJSON();

      const resultOutput = json.outputs.find(o => o.id === 'result');
      expect(resultOutput).toBeDefined();
      expect(resultOutput?.type).toBe('data');
    });
  });

  describe('AI Configuration', () => {
    it('should accept AI configuration', () => {
      const node = new AITaskNode('ai-task-6', {
        ai: {
          provider: 'claude',
          model: 'claude-sonnet-4-5-20250929',
          maxTurns: 10,
          temperature: 0.7,
        },
      });

      expect(node.config.ai?.provider).toBe('claude');
      expect(node.config.ai?.model).toBe('claude-sonnet-4-5-20250929');
      expect(node.config.ai?.maxTurns).toBe(10);
      expect(node.config.ai?.temperature).toBe(0.7);
    });

    it('should accept system prompt in configuration', () => {
      const systemPrompt = 'You are a helpful coding assistant.';
      const node = new AITaskNode('ai-task-7', {
        ai: {
          provider: 'auto',
          systemPrompt,
        },
      });

      expect(node.config.ai?.systemPrompt).toBe(systemPrompt);
    });

    it('should accept allowed tools configuration', () => {
      const node = new AITaskNode('ai-task-8', {
        ai: {
          provider: 'auto',
          allowedTools: ['Read', 'Write', 'Bash'],
        },
      });

      expect(node.config.ai?.allowedTools).toEqual(['Read', 'Write', 'Bash']);
    });
  });

  describe('Validation', () => {
    it('should be valid with default configuration', () => {
      const node = new AITaskNode('ai-task-9', {});
      // Set connected inputs to satisfy required input validation
      node.setConnectedInputs(['prompt']);
      const result = node.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should be valid with complete AI configuration', () => {
      const node = new AITaskNode('ai-task-10', {
        ai: {
          provider: 'claude',
          model: 'claude-sonnet-4-5-20250929',
          systemPrompt: 'Test prompt',
          maxTurns: 5,
        },
      });
      // Set connected inputs to satisfy required input validation
      node.setConnectedInputs(['prompt']);
      const result = node.validate();

      expect(result.valid).toBe(true);
    });

    it('should validate maxTurns is positive', () => {
      const node = new AITaskNode('ai-task-11', {
        ai: {
          provider: 'auto',
          maxTurns: -1,
        },
      });
      node.setConnectedInputs(['prompt']);
      const result = node.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('maxTurns must be a positive number');
    });

    it('should validate temperature is in valid range', () => {
      const node = new AITaskNode('ai-task-12', {
        ai: {
          provider: 'auto',
          temperature: 2.5, // Invalid: should be 0-2
        },
      });
      node.setConnectedInputs(['prompt']);
      const result = node.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('temperature must be between 0 and 2');
    });
  });
});

// ============================================================================
// AITaskNode Execution Tests
// ============================================================================

describe('AITaskNode Execution', () => {
  let mockServices: Services;
  let mockUtils: Utils;

  beforeEach(() => {
    mockServices = createMockServices();
    mockUtils = createMockUtils();
  });

  describe('Basic Execution', () => {
    it('should execute AI query with prompt input', async () => {
      const node = new AITaskNode('ai-exec-1', {
        ai: { provider: 'auto' },
      });

      const context = createMockContext({ prompt: 'Write a hello world function' });

      const result = await node.execute(context);

      expect(result.success).toBe(true);
      expect(result.outputs.result).toBeDefined();
      expect(context.services.aiProvider.query).toHaveBeenCalled();
    });

    it('should pass prompt to AI provider', async () => {
      const node = new AITaskNode('ai-exec-2', {
        ai: { provider: 'auto' },
      });

      const context = createMockContext({ prompt: 'Implement sorting algorithm' });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Implement sorting algorithm'),
        })
      );
    });

    it('should pass system prompt to AI provider', async () => {
      const systemPrompt = 'You are an expert TypeScript developer.';
      const node = new AITaskNode('ai-exec-3', {
        ai: {
          provider: 'auto',
          systemPrompt,
        },
      });

      const context = createMockContext({ prompt: 'Write a test' });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            systemPrompt,
          }),
        })
      );
    });

    it('should pass maxTurns to AI provider', async () => {
      const node = new AITaskNode('ai-exec-4', {
        ai: {
          provider: 'auto',
          maxTurns: 15,
        },
      });

      const context = createMockContext({ prompt: 'Complex task' });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            maxTurns: 15,
          }),
        })
      );
    });

    it('should pass allowed tools to AI provider', async () => {
      const allowedTools = ['Read', 'Write', 'Bash'];
      const node = new AITaskNode('ai-exec-5', {
        ai: {
          provider: 'auto',
          allowedTools,
        },
      });

      const context = createMockContext({ prompt: 'Task with tools' });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            allowedTools,
          }),
        })
      );
    });
  });

  describe('Context Handling', () => {
    it('should include context in prompt when provided', async () => {
      const node = new AITaskNode('ai-ctx-1', {
        ai: { provider: 'auto' },
      });

      const context = createMockContext({
        prompt: 'Fix the bug',
        context: { fileName: 'app.ts', errorMessage: 'Type error on line 42' },
      });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('app.ts'),
        })
      );
    });

    it('should handle string context', async () => {
      const node = new AITaskNode('ai-ctx-2', {
        ai: { provider: 'auto' },
      });

      const context = createMockContext({
        prompt: 'Review this code',
        context: 'function add(a, b) { return a + b; }',
      });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('function add'),
        })
      );
    });

    it('should handle array context', async () => {
      const node = new AITaskNode('ai-ctx-3', {
        ai: { provider: 'auto' },
      });

      const context = createMockContext({
        prompt: 'Analyze these files',
        context: ['file1.ts', 'file2.ts', 'file3.ts'],
      });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalled();
    });
  });

  describe('Result Handling', () => {
    it('should return AI response in result output', async () => {
      const mockResponse = {
        finalState: { code: 'function hello() {}', message: 'Done' },
        duration: 200,
        turns: 3,
        tokensUsed: 150,
      };

      const context = createMockContext({ prompt: 'Generate code' });
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue(mockResponse);

      const node = new AITaskNode('ai-result-1', {
        ai: { provider: 'auto' },
      });

      const result = await node.execute(context);

      expect(result.success).toBe(true);
      expect(result.outputs.result).toEqual(mockResponse.finalState);
    });

    it('should include metadata in result', async () => {
      const mockResponse = {
        finalState: { result: 'done' },
        duration: 500,
        turns: 5,
        tokensUsed: 300,
      };

      const context = createMockContext({ prompt: 'Task' });
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue(mockResponse);

      const node = new AITaskNode('ai-result-2', {
        ai: { provider: 'auto' },
      });

      const result = await node.execute(context);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.duration).toBe(500);
      expect(result.metadata?.aiCalls).toBe(1);
      expect(result.metadata?.tokensUsed).toBe(300);
    });

    it('should include file changes in output when available', async () => {
      const fileChanges = [
        { path: 'src/app.ts', action: 'modified' },
        { path: 'src/utils.ts', action: 'created' },
      ];
      const mockResponse = {
        finalState: { result: 'done' },
        duration: 100,
        turns: 2,
        fileChanges,
      };

      const context = createMockContext({ prompt: 'Implement feature' });
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue(mockResponse);

      const node = new AITaskNode('ai-result-3', {
        ai: { provider: 'auto' },
      });

      const result = await node.execute(context);

      expect(result.outputs.fileChanges).toEqual(fileChanges);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing prompt input', async () => {
      const node = new AITaskNode('ai-err-1', {
        ai: { provider: 'auto' },
      });

      const context = createMockContext({}); // No prompt

      const result = await node.execute(context);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('prompt');
    });

    it('should handle AI provider errors', async () => {
      const context = createMockContext({ prompt: 'Task' });
      (context.services.aiProvider.query as jest.Mock).mockRejectedValue(
        new Error('AI provider unavailable')
      );

      const node = new AITaskNode('ai-err-2', {
        ai: { provider: 'auto' },
      });

      const result = await node.execute(context);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('AI provider unavailable');
    });

    it('should log errors through utils logger', async () => {
      const context = createMockContext({ prompt: 'Task' });
      (context.services.aiProvider.query as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const node = new AITaskNode('ai-err-3', {
        ai: { provider: 'auto' },
      });

      await node.execute(context);

      expect(context.utils.logger.error).toHaveBeenCalled();
    });
  });

  describe('Retry Logic', () => {
    it('should retry on failure when retry policy is configured', async () => {
      const context = createMockContext({ prompt: 'Task' });
      let callCount = 0;
      (context.services.aiProvider.query as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Temporary error'));
        }
        return Promise.resolve({
          finalState: { result: 'success' },
          duration: 100,
          turns: 1,
        });
      });

      const node = new AITaskNode('ai-retry-1', {
        ai: { provider: 'auto' },
        retryPolicy: {
          maxRetries: 3,
          retryDelay: 10,
        },
      });

      const result = await node.execute(context);

      expect(result.success).toBe(true);
      expect(callCount).toBe(3);
    });

    it('should fail after max retries exceeded', async () => {
      const context = createMockContext({ prompt: 'Task' });
      (context.services.aiProvider.query as jest.Mock).mockRejectedValue(
        new Error('Persistent error')
      );

      const node = new AITaskNode('ai-retry-2', {
        ai: { provider: 'auto' },
        retryPolicy: {
          maxRetries: 2,
          retryDelay: 10,
        },
      });

      const result = await node.execute(context);

      expect(result.success).toBe(false);
      // Should have tried original + 2 retries = 3 total
      expect(context.services.aiProvider.query).toHaveBeenCalledTimes(3);
    });
  });
});

// ============================================================================
// AITaskNode Prompt Generation Tests
// ============================================================================

describe('AITaskNode Prompt Generation', () => {
  describe('buildPrompt method', () => {
    it('should build prompt from input only', () => {
      const node = new AITaskNode('ai-prompt-1', {});

      const prompt = node.buildPrompt('Write a function', undefined);

      expect(prompt).toContain('Write a function');
    });

    it('should build prompt with object context', () => {
      const node = new AITaskNode('ai-prompt-2', {});

      const prompt = node.buildPrompt('Fix the bug', {
        file: 'app.ts',
        line: 42,
        error: 'Type mismatch',
      });

      expect(prompt).toContain('Fix the bug');
      expect(prompt).toContain('app.ts');
      expect(prompt).toContain('42');
    });

    it('should build prompt with string context', () => {
      const node = new AITaskNode('ai-prompt-3', {});

      const prompt = node.buildPrompt('Review code', 'const x = 1;');

      expect(prompt).toContain('Review code');
      expect(prompt).toContain('const x = 1');
    });

    it('should build prompt with array context', () => {
      const node = new AITaskNode('ai-prompt-4', {});

      const prompt = node.buildPrompt('Process items', ['item1', 'item2', 'item3']);

      expect(prompt).toContain('Process items');
      expect(prompt).toContain('item1');
      expect(prompt).toContain('item2');
    });

    it('should handle custom prompt template', () => {
      const node = new AITaskNode('ai-prompt-5', {
        promptTemplate: 'Task: {prompt}\n\nContext:\n{context}\n\nPlease complete the task.',
      });

      const prompt = node.buildPrompt('Implement feature', 'Feature spec here');

      expect(prompt).toContain('Task: Implement feature');
      expect(prompt).toContain('Context:');
      expect(prompt).toContain('Feature spec here');
      expect(prompt).toContain('Please complete the task');
    });
  });
});

// ============================================================================
// AITaskNode Serialization Tests
// ============================================================================

describe('AITaskNode Serialization', () => {
  it('should serialize to JSON correctly', () => {
    const node = new AITaskNode('ai-serial-1', {
      ai: {
        provider: 'claude',
        systemPrompt: 'You are helpful',
        maxTurns: 10,
      },
    });
    node.setPosition(100, 200);

    const json = node.toJSON();

    expect(json.id).toBe('ai-serial-1');
    expect(json.type).toBe('ai:custom');
    expect(json.position).toEqual({ x: 100, y: 200 });
    expect(json.config.ai?.provider).toBe('claude');
    expect(json.config.ai?.systemPrompt).toBe('You are helpful');
  });

  it('should include all configuration in serialization', () => {
    const node = new AITaskNode('ai-serial-2', {
      ai: {
        provider: 'openai',
        model: 'gpt-4',
        allowedTools: ['Read', 'Write'],
        temperature: 0.5,
      },
      retryPolicy: {
        maxRetries: 3,
        retryDelay: 1000,
      },
    });

    const json = node.toJSON();

    expect(json.config.ai?.model).toBe('gpt-4');
    expect(json.config.ai?.allowedTools).toEqual(['Read', 'Write']);
    expect(json.config.retryPolicy?.maxRetries).toBe(3);
  });
});

// ============================================================================
// AITaskNode Event Emission Tests
// ============================================================================

describe('AITaskNode Events', () => {
  it('should emit execution start event', async () => {
    const context = createMockContext({ prompt: 'Task' });

    const node = new AITaskNode('ai-event-1', {
      ai: { provider: 'auto' },
    });

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'ai-task-started',
      expect.objectContaining({
        nodeId: 'ai-event-1',
      })
    );
  });

  it('should emit execution complete event', async () => {
    const context = createMockContext({ prompt: 'Task' });

    const node = new AITaskNode('ai-event-2', {
      ai: { provider: 'auto' },
    });

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'ai-task-completed',
      expect.objectContaining({
        nodeId: 'ai-event-2',
        success: true,
      })
    );
  });

  it('should emit error event on failure', async () => {
    const context = createMockContext({ prompt: 'Task' });
    (context.services.aiProvider.query as jest.Mock).mockRejectedValue(
      new Error('AI error')
    );

    const node = new AITaskNode('ai-event-3', {
      ai: { provider: 'auto' },
    });

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'ai-task-error',
      expect.objectContaining({
        nodeId: 'ai-event-3',
        error: expect.any(String),
      })
    );
  });
});
