/**
 * ReteWorkflowExecutor Tests
 *
 * TDD Red Phase: Tests for executing transformed workflows
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  ReteWorkflowExecutor,
  type ExecutorConfig,
  type ExecutionResult,
  type ExecutionEvent,
} from '../../src/workflow/ReteWorkflowExecutor.js';
import { WorkflowTransformer } from '../../src/workflow/WorkflowTransformer.js';
import type {
  ReteWorkflowJSON,
  ExecutionContext,
  Services,
  Utils,
  GlobalContext,
  IAIProviderForWorkflow,
  IGitWorktreeManager,
  IStateStreamManager,
  IDataPersistence,
  IMemoryMonitor,
  Logger,
} from '../../src/workflow/types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create mock services for testing
 */
function createMockServices(): Services {
  return {
    aiProvider: {
      query: async () => ({
        finalState: { result: 'mock result' },
        duration: 100,
        turns: 1,
        tokensUsed: 50,
      }),
    },
    gitManager: {
      createWorktree: async () => ({
        path: '/mock/worktree',
        branchName: 'mock-branch',
      }),
      removeWorktree: async () => {},
      merge: async () => ({
        success: true,
        hasConflict: false,
      }),
    },
    stateManager: {
      emit: () => {},
      subscribe: () => () => {},
    },
    dataPersistence: {
      saveWorkflowResult: async () => {},
      loadWorkflowResult: async () => ({}),
    },
  };
}

/**
 * Create mock utils for testing
 */
function createMockUtils(): Utils {
  return {
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
    emit: () => {},
    memoryMonitor: {
      getUsage: () => ({ heapUsed: 1000, heapTotal: 2000, rss: 3000 }),
      checkThreshold: () => false,
    },
  };
}

/**
 * Create mock global context for testing
 */
function createMockGlobalContext(): GlobalContext {
  return {
    workflowId: 'test-workflow',
    executionId: 'test-execution',
    projectPath: '/test/project',
    baseBranch: 'main',
    startedAt: new Date(),
    userSettings: {},
  };
}

/**
 * Create a simple linear workflow for testing
 */
function createSimpleWorkflow(): ReteWorkflowJSON {
  return {
    version: '1.0.0',
    metadata: {
      name: 'Simple Test Workflow',
      description: 'A simple test workflow',
      createdAt: '2025-11-26T00:00:00Z',
      updatedAt: '2025-11-26T00:00:00Z',
    },
    nodes: [
      {
        id: 'start-1',
        type: 'io:start',
        label: 'Start',
        position: { x: 100, y: 100 },
        inputs: [],
        outputs: [{ id: 'default', name: 'Output', type: 'control', required: true }],
        config: {},
      },
      {
        id: 'transform-1',
        type: 'io:transform',
        label: 'Transform',
        position: { x: 300, y: 100 },
        inputs: [{ id: 'input', name: 'Input', type: 'data', required: true }],
        outputs: [{ id: 'output', name: 'Output', type: 'data', required: true }],
        config: {
          transformType: 'custom',
          transformFunction: 'return { ...input, transformed: true }',
        },
      },
      {
        id: 'end-1',
        type: 'io:end',
        label: 'End',
        position: { x: 500, y: 100 },
        inputs: [{ id: 'default', name: 'Input', type: 'any', required: true }],
        outputs: [],
        config: {},
      },
    ],
    connections: [
      {
        id: 'conn-1',
        source: 'start-1',
        sourceOutput: 'default',
        target: 'transform-1',
        targetInput: 'input',
      },
      {
        id: 'conn-2',
        source: 'transform-1',
        sourceOutput: 'output',
        target: 'end-1',
        targetInput: 'default',
      },
    ],
    entryNodeId: 'start-1',
    exitNodeId: 'end-1',
  };
}

/**
 * Create a workflow with conditional branching
 */
function createConditionalWorkflow(): ReteWorkflowJSON {
  return {
    version: '1.0.0',
    metadata: {
      name: 'Conditional Test Workflow',
      description: 'A workflow with decision node',
      createdAt: '2025-11-26T00:00:00Z',
      updatedAt: '2025-11-26T00:00:00Z',
    },
    nodes: [
      {
        id: 'start-1',
        type: 'io:start',
        label: 'Start',
        position: { x: 100, y: 100 },
        inputs: [],
        outputs: [{ id: 'default', name: 'Output', type: 'control', required: true }],
        config: {},
      },
      {
        id: 'decision-1',
        type: 'control:decision',
        label: 'Check Value',
        position: { x: 300, y: 100 },
        inputs: [{ id: 'input', name: 'Input', type: 'any', required: true }],
        outputs: [
          { id: 'true', name: 'True', type: 'control', required: false },
          { id: 'false', name: 'False', type: 'control', required: false },
        ],
        config: {
          condition: 'input.value > 10',
        },
      },
      {
        id: 'transform-high',
        type: 'io:transform',
        label: 'High Value Transform',
        position: { x: 500, y: 50 },
        inputs: [{ id: 'input', name: 'Input', type: 'data', required: true }],
        outputs: [{ id: 'output', name: 'Output', type: 'data', required: true }],
        config: {
          transformType: 'custom',
          transformFunction: 'return { ...input, branch: "high" }',
        },
      },
      {
        id: 'transform-low',
        type: 'io:transform',
        label: 'Low Value Transform',
        position: { x: 500, y: 150 },
        inputs: [{ id: 'input', name: 'Input', type: 'data', required: true }],
        outputs: [{ id: 'output', name: 'Output', type: 'data', required: true }],
        config: {
          transformType: 'custom',
          transformFunction: 'return { ...input, branch: "low" }',
        },
      },
      {
        id: 'end-1',
        type: 'io:end',
        label: 'End',
        position: { x: 700, y: 100 },
        inputs: [{ id: 'default', name: 'Input', type: 'any', required: true }],
        outputs: [],
        config: {},
      },
    ],
    connections: [
      {
        id: 'conn-1',
        source: 'start-1',
        sourceOutput: 'default',
        target: 'decision-1',
        targetInput: 'input',
      },
      {
        id: 'conn-2',
        source: 'decision-1',
        sourceOutput: 'true',
        target: 'transform-high',
        targetInput: 'input',
      },
      {
        id: 'conn-3',
        source: 'decision-1',
        sourceOutput: 'false',
        target: 'transform-low',
        targetInput: 'input',
      },
      {
        id: 'conn-4',
        source: 'transform-high',
        sourceOutput: 'output',
        target: 'end-1',
        targetInput: 'default',
      },
      {
        id: 'conn-5',
        source: 'transform-low',
        sourceOutput: 'output',
        target: 'end-1',
        targetInput: 'default',
      },
    ],
    entryNodeId: 'start-1',
    exitNodeId: 'end-1',
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('ReteWorkflowExecutor', () => {
  let services: Services;
  let utils: Utils;
  let globalContext: GlobalContext;

  beforeEach(() => {
    services = createMockServices();
    utils = createMockUtils();
    globalContext = createMockGlobalContext();
  });

  describe('constructor', () => {
    it('should create executor instance with default config', () => {
      const executor = new ReteWorkflowExecutor();
      expect(executor).toBeDefined();
    });

    it('should create executor instance with custom config', () => {
      const config: ExecutorConfig = {
        maxConcurrency: 5,
        timeout: 60000,
        retryPolicy: {
          maxRetries: 3,
          retryDelay: 1000,
        },
      };
      const executor = new ReteWorkflowExecutor(config);
      expect(executor).toBeDefined();
    });
  });

  describe('execute()', () => {
    it('should execute a simple workflow', async () => {
      const executor = new ReteWorkflowExecutor();
      const workflow = createSimpleWorkflow();
      const transformed = WorkflowTransformer.transform(workflow);

      const result = await executor.execute(transformed, {
        services,
        utils,
        globalContext,
        initialInputs: { message: 'Hello' },
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.executionId).toBeDefined();
    });

    it('should pass inputs through connected nodes', async () => {
      const executor = new ReteWorkflowExecutor();
      const workflow = createSimpleWorkflow();
      const transformed = WorkflowTransformer.transform(workflow);

      const result = await executor.execute(transformed, {
        services,
        utils,
        globalContext,
        initialInputs: { data: { value: 42 } },
      });

      expect(result.success).toBe(true);
      expect(result.outputs).toBeDefined();
    });

    it('should handle conditional branching (true path)', async () => {
      const executor = new ReteWorkflowExecutor();
      const workflow = createConditionalWorkflow();
      const transformed = WorkflowTransformer.transform(workflow);

      const result = await executor.execute(transformed, {
        services,
        utils,
        globalContext,
        initialInputs: { value: 20 }, // > 10, should go to true branch
      });

      expect(result.success).toBe(true);
      // The high value branch should have been executed
      expect(result.executedNodes).toContain('transform-high');
      expect(result.executedNodes).not.toContain('transform-low');
    });

    it('should handle conditional branching (false path)', async () => {
      const executor = new ReteWorkflowExecutor();
      const workflow = createConditionalWorkflow();
      const transformed = WorkflowTransformer.transform(workflow);

      const result = await executor.execute(transformed, {
        services,
        utils,
        globalContext,
        initialInputs: { value: 5 }, // < 10, should go to false branch
      });

      expect(result.success).toBe(true);
      // The low value branch should have been executed
      expect(result.executedNodes).toContain('transform-low');
      expect(result.executedNodes).not.toContain('transform-high');
    });

    it('should track execution duration', async () => {
      const executor = new ReteWorkflowExecutor();
      const workflow = createSimpleWorkflow();
      const transformed = WorkflowTransformer.transform(workflow);

      const result = await executor.execute(transformed, {
        services,
        utils,
        globalContext,
        initialInputs: {},
      });

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should track executed nodes', async () => {
      const executor = new ReteWorkflowExecutor();
      const workflow = createSimpleWorkflow();
      const transformed = WorkflowTransformer.transform(workflow);

      const result = await executor.execute(transformed, {
        services,
        utils,
        globalContext,
        initialInputs: {},
      });

      expect(result.executedNodes).toBeDefined();
      expect(result.executedNodes).toContain('start-1');
      expect(result.executedNodes).toContain('transform-1');
      expect(result.executedNodes).toContain('end-1');
    });
  });

  describe('execute() with events', () => {
    it('should emit node-started event before node execution', async () => {
      const executor = new ReteWorkflowExecutor();
      const workflow = createSimpleWorkflow();
      const transformed = WorkflowTransformer.transform(workflow);

      const events: ExecutionEvent[] = [];
      executor.on('node-started', (event: ExecutionEvent) => {
        events.push(event);
      });

      await executor.execute(transformed, {
        services,
        utils,
        globalContext,
        initialInputs: {},
      });

      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e) => e.nodeId === 'start-1')).toBe(true);
    });

    it('should emit node-completed event after node execution', async () => {
      const executor = new ReteWorkflowExecutor();
      const workflow = createSimpleWorkflow();
      const transformed = WorkflowTransformer.transform(workflow);

      const events: ExecutionEvent[] = [];
      executor.on('node-completed', (event: ExecutionEvent) => {
        events.push(event);
      });

      await executor.execute(transformed, {
        services,
        utils,
        globalContext,
        initialInputs: {},
      });

      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e) => e.nodeId === 'end-1')).toBe(true);
    });

    it('should emit workflow-completed event when finished', async () => {
      const executor = new ReteWorkflowExecutor();
      const workflow = createSimpleWorkflow();
      const transformed = WorkflowTransformer.transform(workflow);

      let completedEvent: ExecutionEvent | null = null;
      executor.on('workflow-completed', (event: ExecutionEvent) => {
        completedEvent = event;
      });

      await executor.execute(transformed, {
        services,
        utils,
        globalContext,
        initialInputs: {},
      });

      expect(completedEvent).toBeDefined();
      expect(completedEvent!.type).toBe('workflow-completed');
    });
  });

  describe('execute() error handling', () => {
    it('should handle node execution failure', async () => {
      const executor = new ReteWorkflowExecutor();
      const workflow = createSimpleWorkflow();
      const transformed = WorkflowTransformer.transform(workflow);

      // Make the transform node fail
      const transformNode = transformed.nodes['transform-1'];
      if (transformNode) {
        (transformNode as any).execute = async () => {
          throw new Error('Node execution failed');
        };
      }

      const result = await executor.execute(transformed, {
        services,
        utils,
        globalContext,
        initialInputs: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should emit node-failed event on node failure', async () => {
      const executor = new ReteWorkflowExecutor();
      const workflow = createSimpleWorkflow();
      const transformed = WorkflowTransformer.transform(workflow);

      // Make the transform node fail
      const transformNode = transformed.nodes['transform-1'];
      if (transformNode) {
        (transformNode as any).execute = async () => {
          throw new Error('Node execution failed');
        };
      }

      let failedEvent: ExecutionEvent | null = null;
      executor.on('node-failed', (event: ExecutionEvent) => {
        failedEvent = event;
      });

      await executor.execute(transformed, {
        services,
        utils,
        globalContext,
        initialInputs: {},
      });

      expect(failedEvent).toBeDefined();
      expect(failedEvent!.nodeId).toBe('transform-1');
    });

    it('should respect timeout configuration', async () => {
      const executor = new ReteWorkflowExecutor({
        timeout: 100, // 100ms timeout
      });
      const workflow = createSimpleWorkflow();
      const transformed = WorkflowTransformer.transform(workflow);

      // Make the transform node take too long
      const transformNode = transformed.nodes['transform-1'];
      if (transformNode) {
        (transformNode as any).execute = async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return { success: true, outputs: {} };
        };
      }

      const result = await executor.execute(transformed, {
        services,
        utils,
        globalContext,
        initialInputs: {},
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timeout');
    });
  });

  describe('execute() with retry', () => {
    it('should retry failed nodes based on retry policy', async () => {
      const executor = new ReteWorkflowExecutor({
        retryPolicy: {
          maxRetries: 2,
          retryDelay: 10,
        },
      });
      const workflow = createSimpleWorkflow();
      const transformed = WorkflowTransformer.transform(workflow);

      let executionCount = 0;
      const transformNode = transformed.nodes['transform-1'];
      if (transformNode) {
        (transformNode as any).execute = async () => {
          executionCount++;
          if (executionCount < 2) {
            throw new Error('Temporary failure');
          }
          return { success: true, outputs: { output: 'success' } };
        };
      }

      const result = await executor.execute(transformed, {
        services,
        utils,
        globalContext,
        initialInputs: {},
      });

      expect(result.success).toBe(true);
      expect(executionCount).toBe(2); // Initial + 1 retry
    });
  });

  describe('cancel()', () => {
    it('should cancel ongoing execution', async () => {
      const executor = new ReteWorkflowExecutor();
      const workflow = createSimpleWorkflow();
      const transformed = WorkflowTransformer.transform(workflow);

      // Make the transform node slow
      const transformNode = transformed.nodes['transform-1'];
      if (transformNode) {
        (transformNode as any).execute = async () => {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return { success: true, outputs: {} };
        };
      }

      const executePromise = executor.execute(transformed, {
        services,
        utils,
        globalContext,
        initialInputs: {},
      });

      // Cancel after a short delay
      setTimeout(() => executor.cancel(), 50);

      const result = await executePromise;

      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
    });
  });

  describe('getStatus()', () => {
    it('should return current execution status', async () => {
      const executor = new ReteWorkflowExecutor();
      const workflow = createSimpleWorkflow();
      const transformed = WorkflowTransformer.transform(workflow);

      // Before execution
      expect(executor.getStatus()).toBe('idle');

      // Start execution with a slow node
      const transformNode = transformed.nodes['transform-1'];
      if (transformNode) {
        (transformNode as any).execute = async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return { success: true, outputs: {} };
        };
      }

      const executePromise = executor.execute(transformed, {
        services,
        utils,
        globalContext,
        initialInputs: {},
      });

      // During execution
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(executor.getStatus()).toBe('running');

      await executePromise;

      // After execution
      expect(executor.getStatus()).toBe('completed');
    });
  });

  describe('getProgress()', () => {
    it('should return execution progress', async () => {
      const executor = new ReteWorkflowExecutor();
      const workflow = createSimpleWorkflow();
      const transformed = WorkflowTransformer.transform(workflow);

      await executor.execute(transformed, {
        services,
        utils,
        globalContext,
        initialInputs: {},
      });

      const progress = executor.getProgress();
      expect(progress.totalNodes).toBe(3);
      expect(progress.completedNodes).toBe(3);
      expect(progress.percentage).toBe(100);
    });
  });

  describe('getNodeResults()', () => {
    it('should return results for all executed nodes', async () => {
      const executor = new ReteWorkflowExecutor();
      const workflow = createSimpleWorkflow();
      const transformed = WorkflowTransformer.transform(workflow);

      await executor.execute(transformed, {
        services,
        utils,
        globalContext,
        initialInputs: { data: 'test' },
      });

      const nodeResults = executor.getNodeResults();
      expect(nodeResults).toBeDefined();
      expect(nodeResults['start-1']).toBeDefined();
      expect(nodeResults['transform-1']).toBeDefined();
      expect(nodeResults['end-1']).toBeDefined();
    });
  });
});

describe('ExecutionResult', () => {
  it('should have all required properties', async () => {
    const executor = new ReteWorkflowExecutor();
    const workflow = createSimpleWorkflow();
    const transformed = WorkflowTransformer.transform(workflow);

    const result = await executor.execute(transformed, {
      services: createMockServices(),
      utils: createMockUtils(),
      globalContext: createMockGlobalContext(),
      initialInputs: {},
    });

    // Check required properties
    expect(result.success).toBeDefined();
    expect(result.executionId).toBeDefined();
    expect(result.executedNodes).toBeDefined();
    expect(result.duration).toBeDefined();
    expect(result.outputs).toBeDefined();
  });
});
