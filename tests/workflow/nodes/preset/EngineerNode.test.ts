/**
 * EngineerNode Tests
 *
 * Phase 3.2: Preset Engineering Node implementation
 * TDD Red Phase: These tests define expected behavior for the engineer node
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EngineerNode, type EngineerNodeConfig } from '../../../../src/workflow/nodes/preset/EngineerNode.js';
import type {
  ExecutionContext,
  GlobalContext,
  Services,
  Utils,
} from '../../../../src/workflow/types.js';

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
        finalState: {
          result: 'Implementation complete',
          code: 'function hello() { console.log("Hello"); }',
        },
        duration: 500,
        turns: 5,
        tokensUsed: 200,
        fileChanges: [
          { path: 'src/hello.ts', action: 'created' },
        ],
      }),
    },
    gitManager: {
      createWorktree: jest.fn().mockResolvedValue({
        path: '/mock/worktree',
        branchName: 'feature/test-branch',
      }),
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
// EngineerNode Construction Tests
// ============================================================================

describe('EngineerNode', () => {
  describe('Construction', () => {
    it('should create EngineerNode with correct type', () => {
      const node = new EngineerNode('engineer-1', {});

      expect(node.id).toBe('engineer-1');
      expect(node.type).toBe('preset:engineer');
    });

    it('should have default label "Engineer"', () => {
      const node = new EngineerNode('engineer-2', {});

      expect(node.label).toBe('Engineer');
    });

    it('should allow custom label', () => {
      const node = new EngineerNode('engineer-3', {
        label: 'Senior Engineer',
      });

      expect(node.label).toBe('Senior Engineer');
    });

    it('should have task input socket', () => {
      const node = new EngineerNode('engineer-4', {});
      const json = node.toJSON();

      const taskInput = json.inputs.find(i => i.id === 'task');
      expect(taskInput).toBeDefined();
      expect(taskInput?.type).toBe('data');
      expect(taskInput?.required).toBe(true);
    });

    it('should have context input socket (optional)', () => {
      const node = new EngineerNode('engineer-5', {});
      const json = node.toJSON();

      const contextInput = json.inputs.find(i => i.id === 'context');
      expect(contextInput).toBeDefined();
      expect(contextInput?.required).toBe(false);
    });

    it('should have code output socket', () => {
      const node = new EngineerNode('engineer-6', {});
      const json = node.toJSON();

      const codeOutput = json.outputs.find(o => o.id === 'code');
      expect(codeOutput).toBeDefined();
      expect(codeOutput?.type).toBe('data');
    });

    it('should have fileChanges output socket', () => {
      const node = new EngineerNode('engineer-7', {});
      const json = node.toJSON();

      const fileChangesOutput = json.outputs.find(o => o.id === 'fileChanges');
      expect(fileChangesOutput).toBeDefined();
    });
  });

  describe('Default Configuration', () => {
    it('should have engineering-focused system prompt', () => {
      const node = new EngineerNode('engineer-8', {});

      expect(node.config.ai?.systemPrompt).toBeDefined();
      expect(node.config.ai?.systemPrompt).toContain('engineer');
    });

    it('should have default allowed tools for coding', () => {
      const node = new EngineerNode('engineer-9', {});

      const allowedTools = node.config.ai?.allowedTools ?? [];
      expect(allowedTools).toContain('Read');
      expect(allowedTools).toContain('Write');
      expect(allowedTools).toContain('Bash');
    });

    it('should have reasonable default maxTurns', () => {
      const node = new EngineerNode('engineer-10', {});

      expect(node.config.ai?.maxTurns).toBeGreaterThanOrEqual(10);
    });

    it('should allow overriding system prompt', () => {
      const customPrompt = 'You are a specialized frontend developer.';
      const node = new EngineerNode('engineer-11', {
        ai: {
          provider: 'auto',
          systemPrompt: customPrompt,
        },
      });

      expect(node.config.ai?.systemPrompt).toBe(customPrompt);
    });

    it('should allow adding extra allowed tools', () => {
      const node = new EngineerNode('engineer-12', {
        ai: {
          provider: 'auto',
          allowedTools: ['Read', 'Write', 'Bash', 'Grep', 'Glob'],
        },
      });

      expect(node.config.ai?.allowedTools).toContain('Grep');
      expect(node.config.ai?.allowedTools).toContain('Glob');
    });
  });

  describe('Worktree Configuration', () => {
    it('should support useWorktree option', () => {
      const node = new EngineerNode('engineer-13', {
        useWorktree: true,
      });

      expect(node.config.useWorktree).toBe(true);
    });

    it('should have worktree disabled by default', () => {
      const node = new EngineerNode('engineer-14', {});

      expect(node.config.useWorktree).toBe(false);
    });

    it('should accept custom branch prefix', () => {
      const node = new EngineerNode('engineer-15', {
        useWorktree: true,
        branchPrefix: 'feature',
      });

      expect(node.config.branchPrefix).toBe('feature');
    });
  });
});

// ============================================================================
// EngineerNode Execution Tests
// ============================================================================

describe('EngineerNode Execution', () => {
  let mockServices: Services;
  let mockUtils: Utils;

  beforeEach(() => {
    mockServices = createMockServices();
    mockUtils = createMockUtils();
  });

  describe('Basic Execution', () => {
    it('should execute with task input', async () => {
      const node = new EngineerNode('engineer-exec-1', {});
      const context = createMockContext({
        task: 'Implement a user authentication module',
      });

      const result = await node.execute(context);

      expect(result.success).toBe(true);
      expect(context.services.aiProvider.query).toHaveBeenCalled();
    });

    it('should include task in prompt', async () => {
      const node = new EngineerNode('engineer-exec-2', {});
      const context = createMockContext({
        task: 'Create a REST API endpoint',
      });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('REST API endpoint'),
        })
      );
    });

    it('should use engineering system prompt', async () => {
      const node = new EngineerNode('engineer-exec-3', {});
      const context = createMockContext({ task: 'Write code' });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            systemPrompt: expect.stringContaining('engineer'),
          }),
        })
      );
    });

    it('should pass allowed tools to AI provider', async () => {
      const node = new EngineerNode('engineer-exec-4', {});
      const context = createMockContext({ task: 'Implement feature' });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            allowedTools: expect.arrayContaining(['Read', 'Write', 'Bash']),
          }),
        })
      );
    });
  });

  describe('Context Handling', () => {
    it('should include context in prompt when provided', async () => {
      const node = new EngineerNode('engineer-ctx-1', {});
      const context = createMockContext({
        task: 'Fix the bug',
        context: {
          file: 'src/auth.ts',
          error: 'TypeError: Cannot read property of undefined',
        },
      });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('src/auth.ts'),
        })
      );
    });

    it('should handle code snippets in context', async () => {
      const node = new EngineerNode('engineer-ctx-2', {});
      const codeSnippet = `
        function authenticate(user) {
          // TODO: Implement
        }
      `;
      const context = createMockContext({
        task: 'Implement the authentication function',
        context: codeSnippet,
      });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('function authenticate'),
        })
      );
    });
  });

  describe('Result Handling', () => {
    it('should return code in output', async () => {
      const context = createMockContext({ task: 'Generate code' });
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
        finalState: { code: 'const x = 1;' },
        duration: 100,
        turns: 1,
      });

      const node = new EngineerNode('engineer-result-1', {});
      const result = await node.execute(context);

      expect(result.outputs.code).toBeDefined();
    });

    it('should return file changes when available', async () => {
      const fileChanges = [
        { path: 'src/new-file.ts', action: 'created' },
        { path: 'src/modified.ts', action: 'modified' },
      ];
      const context = createMockContext({ task: 'Create files' });
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
        finalState: { result: 'Done' },
        duration: 100,
        turns: 1,
        fileChanges,
      });

      const node = new EngineerNode('engineer-result-2', {});
      const result = await node.execute(context);

      expect(result.outputs.fileChanges).toEqual(fileChanges);
    });

    it('should include metadata with duration and tokens', async () => {
      const context = createMockContext({ task: 'Implement' });
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
        finalState: { result: 'Done' },
        duration: 5000,
        turns: 10,
        tokensUsed: 500,
      });

      const node = new EngineerNode('engineer-result-3', {});
      const result = await node.execute(context);

      expect(result.metadata?.duration).toBe(5000);
      expect(result.metadata?.tokensUsed).toBe(500);
    });
  });

  describe('Worktree Integration', () => {
    it('should create worktree when useWorktree is enabled', async () => {
      const node = new EngineerNode('engineer-wt-1', {
        useWorktree: true,
        branchPrefix: 'feature',
      });
      const context = createMockContext({ task: 'Implement in worktree' });

      await node.execute(context);

      expect(context.services.gitManager.createWorktree).toHaveBeenCalled();
    });

    it('should not create worktree when disabled', async () => {
      const node = new EngineerNode('engineer-wt-2', {
        useWorktree: false,
      });
      const context = createMockContext({ task: 'Implement without worktree' });

      await node.execute(context);

      expect(context.services.gitManager.createWorktree).not.toHaveBeenCalled();
    });

    it('should cleanup worktree after execution when configured', async () => {
      const node = new EngineerNode('engineer-wt-3', {
        useWorktree: true,
        cleanupWorktree: true,
      });
      const context = createMockContext({ task: 'Task' });

      await node.execute(context);

      expect(context.services.gitManager.removeWorktree).toHaveBeenCalled();
    });

    it('should pass worktree path to AI context', async () => {
      const node = new EngineerNode('engineer-wt-4', {
        useWorktree: true,
      });
      const context = createMockContext({ task: 'Work in worktree' });
      (context.services.gitManager.createWorktree as jest.Mock).mockResolvedValue({
        path: '/custom/worktree/path',
        branchName: 'feature-branch',
      });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('/custom/worktree/path'),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle missing task input', async () => {
      const node = new EngineerNode('engineer-err-1', {});
      const context = createMockContext({}); // No task

      const result = await node.execute(context);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('task');
    });

    it('should handle AI provider errors', async () => {
      const node = new EngineerNode('engineer-err-2', {});
      const context = createMockContext({ task: 'Task' });
      (context.services.aiProvider.query as jest.Mock).mockRejectedValue(
        new Error('AI service unavailable')
      );

      const result = await node.execute(context);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('AI service unavailable');
    });

    it('should cleanup worktree on error', async () => {
      const node = new EngineerNode('engineer-err-3', {
        useWorktree: true,
        cleanupWorktree: true,
      });
      const context = createMockContext({ task: 'Task' });
      (context.services.aiProvider.query as jest.Mock).mockRejectedValue(
        new Error('Execution failed')
      );

      await node.execute(context);

      expect(context.services.gitManager.removeWorktree).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// EngineerNode Validation Tests
// ============================================================================

describe('EngineerNode Validation', () => {
  it('should be valid with default configuration', () => {
    const node = new EngineerNode('engineer-val-1', {});
    node.setConnectedInputs(['task']);
    const result = node.validate();

    expect(result.valid).toBe(true);
  });

  it('should be valid with worktree configuration', () => {
    const node = new EngineerNode('engineer-val-2', {
      useWorktree: true,
      branchPrefix: 'feature',
    });
    node.setConnectedInputs(['task']);
    const result = node.validate();

    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// EngineerNode Serialization Tests
// ============================================================================

describe('EngineerNode Serialization', () => {
  it('should serialize to JSON correctly', () => {
    const node = new EngineerNode('engineer-serial-1', {
      useWorktree: true,
      branchPrefix: 'feature',
      ai: {
        provider: 'claude',
        maxTurns: 15,
      },
    });
    node.setPosition(100, 200);

    const json = node.toJSON();

    expect(json.id).toBe('engineer-serial-1');
    expect(json.type).toBe('preset:engineer');
    expect(json.position).toEqual({ x: 100, y: 200 });
    expect(json.config.useWorktree).toBe(true);
  });

  it('should preserve all configuration in serialization', () => {
    const node = new EngineerNode('engineer-serial-2', {
      label: 'Custom Engineer',
      useWorktree: true,
      branchPrefix: 'custom-feature',
      cleanupWorktree: false,
      ai: {
        provider: 'openai',
        model: 'gpt-4',
        maxTurns: 20,
      },
    });

    const json = node.toJSON();

    expect(json.label).toBe('Custom Engineer');
    expect(json.config.branchPrefix).toBe('custom-feature');
    expect(json.config.ai?.provider).toBe('openai');
    expect(json.config.ai?.maxTurns).toBe(20);
  });
});

// ============================================================================
// EngineerNode Event Tests
// ============================================================================

describe('EngineerNode Events', () => {
  it('should emit engineer-started event', async () => {
    const node = new EngineerNode('engineer-event-1', {});
    const context = createMockContext({ task: 'Task' });

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'engineer-started',
      expect.objectContaining({
        nodeId: 'engineer-event-1',
      })
    );
  });

  it('should emit engineer-completed event on success', async () => {
    const node = new EngineerNode('engineer-event-2', {});
    const context = createMockContext({ task: 'Task' });

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'engineer-completed',
      expect.objectContaining({
        nodeId: 'engineer-event-2',
        success: true,
      })
    );
  });

  it('should emit engineer-error event on failure', async () => {
    const node = new EngineerNode('engineer-event-3', {});
    const context = createMockContext({ task: 'Task' });
    (context.services.aiProvider.query as jest.Mock).mockRejectedValue(
      new Error('Failed')
    );

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'engineer-error',
      expect.objectContaining({
        nodeId: 'engineer-event-3',
      })
    );
  });
});
