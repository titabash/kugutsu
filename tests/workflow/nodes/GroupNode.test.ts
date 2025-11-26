/**
 * GroupNode Tests (TDD - Red Phase)
 *
 * Tests for the GroupNode which enables subgraph parallel execution.
 * A GroupNode contains a subgraph (multiple nodes and connections) that can be
 * executed in parallel for different inputs.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GroupNode } from '../../../src/workflow/nodes/GroupNode.js';
import type {
  ExecutionContext,
  NodeResult,
  Services,
  Utils,
  GlobalContext,
  WorkflowNodeJSON,
  ConnectionJSON,
} from '../../../src/workflow/types.js';

// Use jest instead of vi
const vi = jest;

// ============================================================================
// Mock Factories
// ============================================================================

function createMockServices(overrides?: Partial<Services>): Services {
  return {
    aiProvider: {
      query: vi.fn().mockResolvedValue({
        finalState: { result: 'mock result' },
        duration: 1000,
        turns: 5,
      }),
    },
    gitManager: {
      createWorktree: vi.fn().mockResolvedValue({
        path: '/tmp/worktree-1',
        branchName: 'feature/task-1',
      }),
      removeWorktree: vi.fn().mockResolvedValue(undefined),
      merge: vi.fn().mockResolvedValue({
        success: true,
        hasConflict: false,
      }),
    },
    stateManager: {
      emit: vi.fn(),
      subscribe: vi.fn().mockReturnValue(() => {}),
    },
    dataPersistence: {
      saveWorkflowResult: vi.fn().mockResolvedValue(undefined),
      loadWorkflowResult: vi.fn().mockResolvedValue(null),
    },
    ...overrides,
  };
}

function createMockUtils(overrides?: Partial<Utils>): Utils {
  return {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    emit: vi.fn(),
    memoryMonitor: {
      getUsage: vi.fn().mockReturnValue({ heapUsed: 100, heapTotal: 200, rss: 300 }),
      checkThreshold: vi.fn().mockReturnValue(false),
    },
    ...overrides,
  };
}

function createMockGlobalContext(overrides?: Partial<GlobalContext>): GlobalContext {
  return {
    workflowId: 'test-workflow',
    executionId: 'test-execution',
    projectPath: '/test/project',
    baseBranch: 'main',
    startedAt: new Date(),
    userSettings: {},
    ...overrides,
  };
}

function createMockContext(
  inputs: Record<string, unknown> = {},
  overrides?: Partial<ExecutionContext>
): ExecutionContext {
  return {
    inputs,
    global: createMockGlobalContext(),
    services: createMockServices(),
    utils: createMockUtils(),
    ...overrides,
  };
}

// Sample subgraph for testing
function createSampleSubgraph(): {
  nodes: WorkflowNodeJSON[];
  connections: ConnectionJSON[];
} {
  return {
    nodes: [
      {
        id: 'sub-start',
        type: 'io:start',
        label: 'Start',
        position: { x: 0, y: 0 },
        inputs: [],
        outputs: [{ id: 'default', name: 'Output', type: 'control', required: true }],
        config: {},
      },
      {
        id: 'sub-process',
        type: 'io:transform',
        label: 'Process',
        position: { x: 100, y: 0 },
        inputs: [{ id: 'input', name: 'Input', type: 'data', required: true }],
        outputs: [{ id: 'output', name: 'Output', type: 'data', required: true }],
        config: {
          transformType: 'custom',
          transformFunction: 'return { processed: input }',
        },
      },
      {
        id: 'sub-end',
        type: 'io:end',
        label: 'End',
        position: { x: 200, y: 0 },
        inputs: [{ id: 'default', name: 'Input', type: 'any', required: true }],
        outputs: [],
        config: {},
      },
    ],
    connections: [
      {
        id: 'conn-1',
        source: 'sub-start',
        sourceOutput: 'default',
        target: 'sub-process',
        targetInput: 'input',
      },
      {
        id: 'conn-2',
        source: 'sub-process',
        sourceOutput: 'output',
        target: 'sub-end',
        targetInput: 'default',
      },
    ],
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('GroupNode', () => {
  describe('constructor', () => {
    it('should create a GroupNode with default configuration', () => {
      const node = new GroupNode('group-1');

      expect(node.id).toBe('group-1');
      expect(node.type).toBe('control:group');
      expect(node.label).toBe('Group');
    });

    it('should create a GroupNode with subgraph configuration', () => {
      const subgraph = createSampleSubgraph();
      const node = new GroupNode('group-2', {
        subgraph,
        parallelExecution: {
          enabled: true,
          inputArray: 'items',
          maxConcurrency: 3,
        },
        worktreeConfig: {
          useWorktree: true,
          branchPrefix: 'group',
          cleanupAfter: true,
        },
      });

      expect(node.id).toBe('group-2');
      expect(node.config.subgraph).toBe(subgraph);
      expect(node.config.parallelExecution?.enabled).toBe(true);
      expect(node.config.worktreeConfig?.useWorktree).toBe(true);
    });

    it('should have proper input and output sockets', () => {
      const node = new GroupNode('group-1');

      // Input: items array for parallel execution
      const inputSocket = node.inputs.find((s) => s.id === 'items');
      expect(inputSocket).toBeDefined();
      expect(inputSocket?.type).toBe('data');
      expect(inputSocket?.dataType).toBe('array');

      // Output: results from subgraph execution
      const outputSocket = node.outputs.find((s) => s.id === 'results');
      expect(outputSocket).toBeDefined();
      expect(outputSocket?.type).toBe('data');
      expect(outputSocket?.dataType).toBe('array');
    });
  });

  describe('validate', () => {
    it('should return valid for properly configured node with subgraph', () => {
      const node = new GroupNode('group-1', {
        subgraph: createSampleSubgraph(),
      });

      const result = node.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid when subgraph is missing', () => {
      const node = new GroupNode('group-1', {});

      const result = node.validate();

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('subgraph'))).toBe(true);
    });

    it('should return invalid when subgraph has no nodes', () => {
      const node = new GroupNode('group-1', {
        subgraph: {
          nodes: [],
          connections: [],
        },
      });

      const result = node.validate();

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('nodes'))).toBe(true);
    });
  });

  describe('execute', () => {
    describe('parallel execution', () => {
      it('should execute subgraph for each input item in parallel', async () => {
        const subgraph = createSampleSubgraph();
        const node = new GroupNode('group-1', {
          subgraph,
          parallelExecution: {
            enabled: true,
            inputArray: 'items',
            maxConcurrency: 3,
          },
        });

        const context = createMockContext({
          items: [{ id: '1' }, { id: '2' }, { id: '3' }],
        });

        const result = await node.execute(context);

        expect(result.success).toBe(true);
        expect(result.outputs.results).toBeDefined();
        expect(Array.isArray(result.outputs.results)).toBe(true);
        expect((result.outputs.results as unknown[]).length).toBe(3);
      });

      it('should limit concurrency according to maxConcurrency', async () => {
        let concurrentCount = 0;
        let maxObservedConcurrency = 0;

        const subgraph = createSampleSubgraph();
        const node = new GroupNode('group-1', {
          subgraph,
          parallelExecution: {
            enabled: true,
            inputArray: 'items',
            maxConcurrency: 2,
          },
          executeSubgraph: async () => {
            concurrentCount++;
            maxObservedConcurrency = Math.max(maxObservedConcurrency, concurrentCount);
            await new Promise((resolve) => setTimeout(resolve, 50));
            concurrentCount--;
            return { done: true };
          },
        });

        const context = createMockContext({
          items: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }],
        });

        await node.execute(context);

        expect(maxObservedConcurrency).toBeLessThanOrEqual(2);
      });

      it('should create worktrees when useWorktree is enabled', async () => {
        const subgraph = createSampleSubgraph();
        const node = new GroupNode('group-1', {
          subgraph,
          parallelExecution: {
            enabled: true,
            inputArray: 'items',
          },
          worktreeConfig: {
            useWorktree: true,
            branchPrefix: 'group',
            cleanupAfter: true,
          },
        });

        const mockGitManager = {
          createWorktree: vi.fn().mockResolvedValue({
            path: '/tmp/worktree',
            branchName: 'group-1',
          }),
          removeWorktree: vi.fn().mockResolvedValue(undefined),
          merge: vi.fn(),
        };

        const context = createMockContext(
          { items: [{ id: '1' }, { id: '2' }] },
          {
            services: createMockServices({
              gitManager: mockGitManager,
            }),
          }
        );

        await node.execute(context);

        expect(mockGitManager.createWorktree).toHaveBeenCalledTimes(2);
      });

      it('should cleanup worktrees after execution', async () => {
        const subgraph = createSampleSubgraph();
        const node = new GroupNode('group-1', {
          subgraph,
          parallelExecution: {
            enabled: true,
            inputArray: 'items',
          },
          worktreeConfig: {
            useWorktree: true,
            branchPrefix: 'group',
            cleanupAfter: true,
          },
        });

        const mockGitManager = {
          createWorktree: vi.fn().mockResolvedValue({
            path: '/tmp/worktree',
            branchName: 'group-1',
          }),
          removeWorktree: vi.fn().mockResolvedValue(undefined),
          merge: vi.fn(),
        };

        const context = createMockContext(
          { items: [{ id: '1' }, { id: '2' }] },
          {
            services: createMockServices({
              gitManager: mockGitManager,
            }),
          }
        );

        await node.execute(context);

        expect(mockGitManager.removeWorktree).toHaveBeenCalledTimes(2);
      });
    });

    describe('sequential execution', () => {
      it('should execute subgraph sequentially when parallel is disabled', async () => {
        const executionOrder: string[] = [];
        const subgraph = createSampleSubgraph();
        const node = new GroupNode('group-1', {
          subgraph,
          parallelExecution: {
            enabled: false,
            inputArray: 'items',
          },
          executeSubgraph: async (input: { id: string }) => {
            executionOrder.push(input.id);
            await new Promise((resolve) => setTimeout(resolve, 10));
            return { processed: input.id };
          },
        });

        const context = createMockContext({
          items: [{ id: '1' }, { id: '2' }, { id: '3' }],
        });

        await node.execute(context);

        // Should maintain order in sequential execution
        expect(executionOrder).toEqual(['1', '2', '3']);
      });
    });

    describe('error handling', () => {
      it('should fail when items input is missing', async () => {
        const node = new GroupNode('group-1', {
          subgraph: createSampleSubgraph(),
        });

        const context = createMockContext({});

        const result = await node.execute(context);

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('items');
      });

      it('should fail when items is not an array', async () => {
        const node = new GroupNode('group-1', {
          subgraph: createSampleSubgraph(),
        });

        const context = createMockContext({ items: 'not an array' });

        const result = await node.execute(context);

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('array');
      });

      it('should handle subgraph execution errors gracefully', async () => {
        const subgraph = createSampleSubgraph();
        const node = new GroupNode('group-1', {
          subgraph,
          parallelExecution: {
            enabled: true,
            inputArray: 'items',
          },
          continueOnError: true,
          executeSubgraph: async (input: { id: string }) => {
            if (input.id === '2') {
              throw new Error('Subgraph execution failed');
            }
            return { processed: input.id };
          },
        });

        const context = createMockContext({
          items: [{ id: '1' }, { id: '2' }, { id: '3' }],
        });

        const result = await node.execute(context);

        expect(result.success).toBe(true);
        const results = result.outputs.results as Array<{ processed?: string; error?: string }>;
        expect(results[0].processed).toBe('1');
        expect(results[1].error).toBeDefined();
        expect(results[2].processed).toBe('3');
      });
    });

    describe('empty input handling', () => {
      it('should return empty results for empty input array', async () => {
        const node = new GroupNode('group-1', {
          subgraph: createSampleSubgraph(),
        });

        const context = createMockContext({ items: [] });

        const result = await node.execute(context);

        expect(result.success).toBe(true);
        expect(result.outputs.results).toEqual([]);
      });
    });

    describe('subgraph context', () => {
      it('should pass subgraph input to each execution', async () => {
        const receivedInputs: unknown[] = [];
        const subgraph = createSampleSubgraph();
        const node = new GroupNode('group-1', {
          subgraph,
          parallelExecution: {
            enabled: true,
            inputArray: 'items',
          },
          executeSubgraph: async (input: unknown) => {
            receivedInputs.push(input);
            return { processed: true };
          },
        });

        const context = createMockContext({
          items: [{ data: 'a' }, { data: 'b' }],
        });

        await node.execute(context);

        expect(receivedInputs).toHaveLength(2);
        expect(receivedInputs[0]).toEqual({ data: 'a' });
        expect(receivedInputs[1]).toEqual({ data: 'b' });
      });

      it('should pass worktree info to subgraph execution', async () => {
        const receivedWorktrees: unknown[] = [];
        const subgraph = createSampleSubgraph();
        const node = new GroupNode('group-1', {
          subgraph,
          parallelExecution: {
            enabled: true,
            inputArray: 'items',
          },
          worktreeConfig: {
            useWorktree: true,
            branchPrefix: 'group',
            cleanupAfter: true,
          },
          executeSubgraph: async (_input: unknown, worktree: unknown) => {
            receivedWorktrees.push(worktree);
            return { processed: true };
          },
        });

        const mockGitManager = {
          createWorktree: vi.fn().mockImplementation(async (opts) => ({
            path: `/tmp/worktree-${opts.branchName}`,
            branchName: opts.branchName,
          })),
          removeWorktree: vi.fn().mockResolvedValue(undefined),
          merge: vi.fn(),
        };

        const context = createMockContext(
          { items: [{ id: '1' }] },
          {
            services: createMockServices({
              gitManager: mockGitManager,
            }),
          }
        );

        await node.execute(context);

        expect(receivedWorktrees).toHaveLength(1);
        expect(receivedWorktrees[0]).toHaveProperty('path');
        expect(receivedWorktrees[0]).toHaveProperty('branchName');
      });
    });
  });

  describe('toJSON / fromJSON', () => {
    it('should serialize to JSON correctly', () => {
      const subgraph = createSampleSubgraph();
      const node = new GroupNode('group-1', {
        subgraph,
        parallelExecution: {
          enabled: true,
          inputArray: 'items',
        },
      });

      const json = node.toJSON();

      expect(json.id).toBe('group-1');
      expect(json.type).toBe('control:group');
      expect(json.config.subgraph).toEqual(subgraph);
    });

    it('should deserialize from JSON correctly', () => {
      const subgraph = createSampleSubgraph();
      const json = {
        id: 'group-1',
        type: 'control:group' as const,
        label: 'Group',
        position: { x: 100, y: 200 },
        inputs: [],
        outputs: [],
        config: {
          subgraph,
          parallelExecution: {
            enabled: false,
            inputArray: 'items',
          },
        },
      };

      const node = GroupNode.createFromJSON(json);

      expect(node.id).toBe('group-1');
      expect(node.config.subgraph).toEqual(subgraph);
      expect(node.config.parallelExecution?.enabled).toBe(false);
    });
  });
});
