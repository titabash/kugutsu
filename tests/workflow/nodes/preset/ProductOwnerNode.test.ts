/**
 * ProductOwnerNode Tests
 *
 * Phase 3.2: Preset Product Owner Node implementation
 * TDD Red Phase: These tests define expected behavior for the product owner node
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ProductOwnerNode, type ProductOwnerNodeConfig } from '../../../../src/workflow/nodes/preset/ProductOwnerNode.js';
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
          result: 'Task analysis complete',
          tasks: [
            { id: 'task-1', title: 'Implement user login', priority: 'high' },
            { id: 'task-2', title: 'Create API endpoints', priority: 'medium' },
          ],
        },
        duration: 300,
        turns: 3,
        tokensUsed: 150,
        fileChanges: [
          { path: '.kugutsu/workflow-artifacts/specs/requirements.md', action: 'created' },
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
// ProductOwnerNode Construction Tests
// ============================================================================

describe('ProductOwnerNode', () => {
  describe('Construction', () => {
    it('should create ProductOwnerNode with correct type', () => {
      const node = new ProductOwnerNode('po-1', {});

      expect(node.id).toBe('po-1');
      expect(node.type).toBe('preset:product-owner');
    });

    it('should have default label "Product Owner"', () => {
      const node = new ProductOwnerNode('po-2', {});

      expect(node.label).toBe('Product Owner');
    });

    it('should allow custom label', () => {
      const node = new ProductOwnerNode('po-3', {
        label: 'Senior Product Manager',
      });

      expect(node.label).toBe('Senior Product Manager');
    });

    it('should have request input socket', () => {
      const node = new ProductOwnerNode('po-4', {});
      const json = node.toJSON();

      const requestInput = json.inputs.find(i => i.id === 'request');
      expect(requestInput).toBeDefined();
      expect(requestInput?.type).toBe('data');
      expect(requestInput?.required).toBe(true);
    });

    it('should have constraints input socket (optional)', () => {
      const node = new ProductOwnerNode('po-5', {});
      const json = node.toJSON();

      const constraintsInput = json.inputs.find(i => i.id === 'constraints');
      expect(constraintsInput).toBeDefined();
      expect(constraintsInput?.required).toBe(false);
    });

    it('should have tasks output socket', () => {
      const node = new ProductOwnerNode('po-6', {});
      const json = node.toJSON();

      const tasksOutput = json.outputs.find(o => o.id === 'tasks');
      expect(tasksOutput).toBeDefined();
      expect(tasksOutput?.type).toBe('data');
      expect(tasksOutput?.dataType).toBe('array');
    });

    it('should have specifications output socket', () => {
      const node = new ProductOwnerNode('po-7', {});
      const json = node.toJSON();

      const specsOutput = json.outputs.find(o => o.id === 'specifications');
      expect(specsOutput).toBeDefined();
    });

    it('should have prompt output socket for next node', () => {
      const node = new ProductOwnerNode('po-8', {});
      const json = node.toJSON();

      const promptOutput = json.outputs.find(o => o.id === 'prompt');
      expect(promptOutput).toBeDefined();
      expect(promptOutput?.dataType).toBe('string');
    });
  });

  describe('Default Configuration', () => {
    it('should have product-owner-focused system prompt', () => {
      const node = new ProductOwnerNode('po-9', {});

      expect(node.config.ai?.systemPrompt).toBeDefined();
      expect(node.config.ai?.systemPrompt?.toLowerCase()).toContain('product');
    });

    it('should have default allowed tools for analysis', () => {
      const node = new ProductOwnerNode('po-10', {});

      const allowedTools = node.config.ai?.allowedTools ?? [];
      expect(allowedTools).toContain('Read');
      expect(allowedTools).toContain('Glob');
      expect(allowedTools).toContain('Grep');
    });

    it('should NOT include Write/Edit in default tools', () => {
      const node = new ProductOwnerNode('po-11', {});

      const allowedTools = node.config.ai?.allowedTools ?? [];
      // Product Owner should only analyze, not modify code
      expect(allowedTools).not.toContain('Write');
      expect(allowedTools).not.toContain('Edit');
    });

    it('should have reasonable default maxTurns', () => {
      const node = new ProductOwnerNode('po-12', {});

      expect(node.config.ai?.maxTurns).toBeGreaterThanOrEqual(5);
      expect(node.config.ai?.maxTurns).toBeLessThanOrEqual(20);
    });

    it('should allow overriding system prompt', () => {
      const customPrompt = 'You are a product strategist.';
      const node = new ProductOwnerNode('po-13', {
        ai: {
          provider: 'auto',
          systemPrompt: customPrompt,
        },
      });

      expect(node.config.ai?.systemPrompt).toBe(customPrompt);
    });
  });

  describe('Output Mode Configuration', () => {
    it('should support task decomposition output mode', () => {
      const node = new ProductOwnerNode('po-14', {
        outputMode: 'tasks',
      });

      expect(node.config.outputMode).toBe('tasks');
    });

    it('should support specifications output mode', () => {
      const node = new ProductOwnerNode('po-15', {
        outputMode: 'specifications',
      });

      expect(node.config.outputMode).toBe('specifications');
    });

    it('should support both output mode', () => {
      const node = new ProductOwnerNode('po-16', {
        outputMode: 'both',
      });

      expect(node.config.outputMode).toBe('both');
    });

    it('should default to both output mode', () => {
      const node = new ProductOwnerNode('po-17', {});

      expect(node.config.outputMode).toBe('both');
    });
  });
});

// ============================================================================
// ProductOwnerNode Execution Tests
// ============================================================================

describe('ProductOwnerNode Execution', () => {
  let mockServices: Services;
  let mockUtils: Utils;

  beforeEach(() => {
    mockServices = createMockServices();
    mockUtils = createMockUtils();
  });

  describe('Basic Execution', () => {
    it('should execute with request input', async () => {
      const node = new ProductOwnerNode('po-exec-1', {});
      const context = createMockContext({
        request: 'Build a user authentication system with OAuth support',
      });

      const result = await node.execute(context);

      expect(result.success).toBe(true);
      expect(context.services.aiProvider.query).toHaveBeenCalled();
    });

    it('should include request in prompt', async () => {
      const node = new ProductOwnerNode('po-exec-2', {});
      const context = createMockContext({
        request: 'Implement shopping cart functionality',
      });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('shopping cart'),
        })
      );
    });

    it('should use product owner system prompt', async () => {
      const node = new ProductOwnerNode('po-exec-3', {});
      const context = createMockContext({ request: 'Analyze requirements' });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            systemPrompt: expect.stringMatching(/product/i),
          }),
        })
      );
    });

    it('should pass read-only tools to AI provider', async () => {
      const node = new ProductOwnerNode('po-exec-4', {});
      const context = createMockContext({ request: 'Analyze codebase' });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            allowedTools: expect.arrayContaining(['Read', 'Glob']),
          }),
        })
      );
    });
  });

  describe('Constraints Handling', () => {
    it('should include constraints in prompt when provided', async () => {
      const node = new ProductOwnerNode('po-const-1', {});
      const context = createMockContext({
        request: 'Build a payment system',
        constraints: {
          budget: 'limited',
          timeline: '2 weeks',
          technology: ['Node.js', 'PostgreSQL'],
        },
      });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('2 weeks'),
        })
      );
    });

    it('should handle string constraints', async () => {
      const node = new ProductOwnerNode('po-const-2', {});
      const context = createMockContext({
        request: 'Add feature',
        constraints: 'Must be backward compatible with v1.0',
      });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('backward compatible'),
        })
      );
    });

    it('should handle array constraints', async () => {
      const node = new ProductOwnerNode('po-const-3', {});
      const context = createMockContext({
        request: 'Design API',
        constraints: [
          'RESTful design',
          'Rate limiting required',
          'Must support versioning',
        ],
      });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Rate limiting'),
        })
      );
    });
  });

  describe('Task Decomposition Output', () => {
    it('should return decomposed tasks', async () => {
      const node = new ProductOwnerNode('po-tasks-1', {
        outputMode: 'tasks',
      });
      const context = createMockContext({ request: 'Build auth system' });
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
        finalState: {
          tasks: [
            { id: '1', title: 'Setup database schema', priority: 'high', estimatedEffort: 'small' },
            { id: '2', title: 'Implement login API', priority: 'high', estimatedEffort: 'medium' },
            { id: '3', title: 'Add password hashing', priority: 'high', estimatedEffort: 'small' },
          ],
        },
        duration: 200,
        turns: 2,
      });

      const result = await node.execute(context);

      expect(result.outputs.tasks).toBeDefined();
      expect(Array.isArray(result.outputs.tasks)).toBe(true);
      expect((result.outputs.tasks as unknown[]).length).toBeGreaterThan(0);
    });

    it('should include priority in tasks', async () => {
      const node = new ProductOwnerNode('po-tasks-2', {
        outputMode: 'tasks',
      });
      const context = createMockContext({ request: 'Feature request' });
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
        finalState: {
          tasks: [
            { id: '1', title: 'Task 1', priority: 'high' },
          ],
        },
        duration: 100,
        turns: 1,
      });

      const result = await node.execute(context);
      const tasks = result.outputs.tasks as { priority: string }[];

      expect(tasks[0]).toHaveProperty('priority');
    });
  });

  describe('Specifications Output', () => {
    it('should return specifications when in specs mode', async () => {
      const node = new ProductOwnerNode('po-specs-1', {
        outputMode: 'specifications',
      });
      const context = createMockContext({ request: 'Build dashboard' });
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
        finalState: {
          specifications: {
            overview: 'Dashboard for monitoring metrics',
            requirements: [
              'Display real-time data',
              'Support multiple chart types',
            ],
            acceptanceCriteria: [
              'Page loads in under 2 seconds',
              'Charts update every 5 seconds',
            ],
          },
        },
        duration: 300,
        turns: 3,
      });

      const result = await node.execute(context);

      expect(result.outputs.specifications).toBeDefined();
    });

    it('should return both tasks and specifications in both mode', async () => {
      const node = new ProductOwnerNode('po-both-1', {
        outputMode: 'both',
      });
      const context = createMockContext({ request: 'Full feature' });
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
        finalState: {
          tasks: [{ id: '1', title: 'Task 1', priority: 'high' }],
          specifications: { overview: 'Feature spec' },
        },
        duration: 400,
        turns: 4,
      });

      const result = await node.execute(context);

      expect(result.outputs.tasks).toBeDefined();
      expect(result.outputs.specifications).toBeDefined();
    });
  });

  describe('Prompt Generation for Next Node', () => {
    it('should generate prompt for next node', async () => {
      const node = new ProductOwnerNode('po-prompt-1', {});
      const context = createMockContext({ request: 'Build feature' });
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
        finalState: {
          tasks: [{ id: '1', title: 'Implement feature', priority: 'high' }],
          nextNodePrompt: 'Please implement the feature based on the specifications',
        },
        duration: 200,
        turns: 2,
      });

      const result = await node.execute(context);

      expect(result.outputs.prompt).toBeDefined();
      expect(typeof result.outputs.prompt).toBe('string');
    });
  });

  describe('Result Handling', () => {
    it('should include metadata with duration and tokens', async () => {
      const node = new ProductOwnerNode('po-meta-1', {});
      const context = createMockContext({ request: 'Analyze' });
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
        finalState: { tasks: [] },
        duration: 3000,
        turns: 5,
        tokensUsed: 300,
      });

      const result = await node.execute(context);

      expect(result.metadata?.duration).toBe(3000);
      expect(result.metadata?.tokensUsed).toBe(300);
    });

    it('should return file changes when specifications are written', async () => {
      const node = new ProductOwnerNode('po-files-1', {
        writeSpecifications: true,
      });
      const context = createMockContext({ request: 'Generate specs' });
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
        finalState: { specifications: { overview: 'Spec' } },
        duration: 200,
        turns: 2,
        fileChanges: [
          { path: '.kugutsu/specs/requirements.md', action: 'created' },
        ],
      });

      const result = await node.execute(context);

      expect(result.outputs.fileChanges).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing request input', async () => {
      const node = new ProductOwnerNode('po-err-1', {});
      const context = createMockContext({}); // No request

      const result = await node.execute(context);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('request');
    });

    it('should handle AI provider errors', async () => {
      const node = new ProductOwnerNode('po-err-2', {});
      const context = createMockContext({ request: 'Request' });
      (context.services.aiProvider.query as jest.Mock).mockRejectedValue(
        new Error('AI service unavailable')
      );

      const result = await node.execute(context);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('AI service unavailable');
    });

    it('should handle empty task list gracefully', async () => {
      const node = new ProductOwnerNode('po-err-3', {
        outputMode: 'tasks',
      });
      const context = createMockContext({ request: 'Empty result' });
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
        finalState: { tasks: [] },
        duration: 100,
        turns: 1,
      });

      const result = await node.execute(context);

      expect(result.success).toBe(true);
      expect(result.outputs.tasks).toEqual([]);
    });
  });
});

// ============================================================================
// ProductOwnerNode Validation Tests
// ============================================================================

describe('ProductOwnerNode Validation', () => {
  it('should be valid with default configuration', () => {
    const node = new ProductOwnerNode('po-val-1', {});
    node.setConnectedInputs(['request']);
    const result = node.validate();

    expect(result.valid).toBe(true);
  });

  it('should be valid with custom output mode', () => {
    const node = new ProductOwnerNode('po-val-2', {
      outputMode: 'specifications',
    });
    node.setConnectedInputs(['request']);
    const result = node.validate();

    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// ProductOwnerNode Serialization Tests
// ============================================================================

describe('ProductOwnerNode Serialization', () => {
  it('should serialize to JSON correctly', () => {
    const node = new ProductOwnerNode('po-serial-1', {
      outputMode: 'both',
      writeSpecifications: true,
      ai: {
        provider: 'claude',
        maxTurns: 10,
      },
    });
    node.setPosition(150, 250);

    const json = node.toJSON();

    expect(json.id).toBe('po-serial-1');
    expect(json.type).toBe('preset:product-owner');
    expect(json.position).toEqual({ x: 150, y: 250 });
    expect(json.config.outputMode).toBe('both');
  });

  it('should preserve all configuration in serialization', () => {
    const node = new ProductOwnerNode('po-serial-2', {
      label: 'Custom PO',
      outputMode: 'tasks',
      writeSpecifications: false,
      ai: {
        provider: 'openai',
        model: 'gpt-4',
        maxTurns: 15,
      },
    });

    const json = node.toJSON();

    expect(json.label).toBe('Custom PO');
    expect(json.config.outputMode).toBe('tasks');
    expect(json.config.ai?.provider).toBe('openai');
  });
});

// ============================================================================
// ProductOwnerNode Event Tests
// ============================================================================

describe('ProductOwnerNode Events', () => {
  it('should emit product-owner-started event', async () => {
    const node = new ProductOwnerNode('po-event-1', {});
    const context = createMockContext({ request: 'Request' });

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'product-owner-started',
      expect.objectContaining({
        nodeId: 'po-event-1',
      })
    );
  });

  it('should emit product-owner-completed event on success', async () => {
    const node = new ProductOwnerNode('po-event-2', {});
    const context = createMockContext({ request: 'Request' });

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'product-owner-completed',
      expect.objectContaining({
        nodeId: 'po-event-2',
        success: true,
      })
    );
  });

  it('should emit product-owner-error event on failure', async () => {
    const node = new ProductOwnerNode('po-event-3', {});
    const context = createMockContext({ request: 'Request' });
    (context.services.aiProvider.query as jest.Mock).mockRejectedValue(
      new Error('Failed')
    );

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'product-owner-error',
      expect.objectContaining({
        nodeId: 'po-event-3',
      })
    );
  });

  it('should emit task-decomposed event when tasks are generated', async () => {
    const node = new ProductOwnerNode('po-event-4', {
      outputMode: 'tasks',
    });
    const context = createMockContext({ request: 'Request' });
    (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
      finalState: {
        tasks: [
          { id: '1', title: 'Task 1', priority: 'high' },
          { id: '2', title: 'Task 2', priority: 'medium' },
        ],
      },
      duration: 200,
      turns: 2,
    });

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'tasks-decomposed',
      expect.objectContaining({
        nodeId: 'po-event-4',
        taskCount: 2,
      })
    );
  });
});
