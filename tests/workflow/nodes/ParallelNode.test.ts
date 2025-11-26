/**
 * ParallelNode Tests (TDD - Red Phase)
 *
 * Tests for the ParallelNode which enables parallel execution of tasks.
 * Uses LangGraph's Send API to dispatch tasks in parallel.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ParallelNode } from '../../../src/workflow/nodes/ParallelNode.js';
import type {
  ExecutionContext,
  NodeResult,
  Services,
  Utils,
  GlobalContext,
  WorktreeInfo,
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
      } as WorktreeInfo),
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

// ============================================================================
// Tests
// ============================================================================

describe('ParallelNode', () => {
  describe('constructor', () => {
    it('should create a ParallelNode with default configuration', () => {
      const node = new ParallelNode('parallel-1');

      expect(node.id).toBe('parallel-1');
      expect(node.type).toBe('control:parallel');
      expect(node.label).toBe('Parallel');
    });

    it('should create a ParallelNode with custom configuration', () => {
      const node = new ParallelNode('parallel-2', {
        maxConcurrency: 3,
        useWorktree: true,
        branchPrefix: 'parallel-task',
        cleanupAfter: true,
      });

      expect(node.id).toBe('parallel-2');
      expect(node.config.maxConcurrency).toBe(3);
      expect(node.config.useWorktree).toBe(true);
      expect(node.config.branchPrefix).toBe('parallel-task');
      expect(node.config.cleanupAfter).toBe(true);
    });

    it('should have proper input and output sockets', () => {
      const node = new ParallelNode('parallel-1');

      // Input: array of items to process
      const inputSocket = node.inputs.find((s) => s.id === 'items');
      expect(inputSocket).toBeDefined();
      expect(inputSocket?.type).toBe('data');
      expect(inputSocket?.dataType).toBe('array');
      expect(inputSocket?.required).toBe(true);

      // Output: array of results
      const outputSocket = node.outputs.find((s) => s.id === 'results');
      expect(outputSocket).toBeDefined();
      expect(outputSocket?.type).toBe('data');
      expect(outputSocket?.dataType).toBe('array');
    });
  });

  describe('validate', () => {
    it('should return valid for properly configured node', () => {
      const node = new ParallelNode('parallel-1', {
        maxConcurrency: 2,
      });

      const result = node.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid when maxConcurrency is less than 1', () => {
      const node = new ParallelNode('parallel-1', {
        maxConcurrency: 0,
      });

      const result = node.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('maxConcurrency must be at least 1');
    });

    it('should return invalid when maxConcurrency is not a number', () => {
      const node = new ParallelNode('parallel-1', {
        maxConcurrency: 'invalid' as unknown as number,
      });

      const result = node.validate();

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('maxConcurrency'))).toBe(true);
    });
  });

  describe('execute', () => {
    describe('basic parallel execution', () => {
      it('should execute multiple items in parallel', async () => {
        const node = new ParallelNode('parallel-1', {
          maxConcurrency: 3,
        });

        const context = createMockContext({
          items: [
            { id: 'task-1', data: 'Task 1' },
            { id: 'task-2', data: 'Task 2' },
            { id: 'task-3', data: 'Task 3' },
          ],
        });

        const result = await node.execute(context);

        expect(result.success).toBe(true);
        expect(result.outputs.results).toBeDefined();
        expect(Array.isArray(result.outputs.results)).toBe(true);
        expect((result.outputs.results as unknown[]).length).toBe(3);
      });

      it('should pass each item to the processing function', async () => {
        const processItem = vi.fn().mockResolvedValue({ processed: true });

        const node = new ParallelNode('parallel-1', {
          maxConcurrency: 2,
          processItem,
        });

        const context = createMockContext({
          items: [{ id: '1' }, { id: '2' }],
        });

        await node.execute(context);

        expect(processItem).toHaveBeenCalledTimes(2);
        expect(processItem).toHaveBeenCalledWith({ id: '1' }, expect.any(Object));
        expect(processItem).toHaveBeenCalledWith({ id: '2' }, expect.any(Object));
      });

      it('should limit concurrent executions to maxConcurrency', async () => {
        let concurrentCount = 0;
        let maxObservedConcurrency = 0;

        const processItem = vi.fn().mockImplementation(async () => {
          concurrentCount++;
          maxObservedConcurrency = Math.max(maxObservedConcurrency, concurrentCount);
          await new Promise((resolve) => setTimeout(resolve, 50));
          concurrentCount--;
          return { done: true };
        });

        const node = new ParallelNode('parallel-1', {
          maxConcurrency: 2,
          processItem,
        });

        const context = createMockContext({
          items: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }],
        });

        await node.execute(context);

        expect(maxObservedConcurrency).toBeLessThanOrEqual(2);
      });

      it('should return results in the same order as input items', async () => {
        const processItem = vi.fn().mockImplementation(async (item: { id: string }) => {
          // Add varying delays to test ordering
          const delay = parseInt(item.id) * 10;
          await new Promise((resolve) => setTimeout(resolve, delay));
          return { processedId: item.id };
        });

        const node = new ParallelNode('parallel-1', {
          maxConcurrency: 3,
          processItem,
        });

        const context = createMockContext({
          items: [{ id: '3' }, { id: '1' }, { id: '2' }],
        });

        const result = await node.execute(context);
        const results = result.outputs.results as Array<{ processedId: string }>;

        expect(results[0].processedId).toBe('3');
        expect(results[1].processedId).toBe('1');
        expect(results[2].processedId).toBe('2');
      });
    });

    describe('empty input handling', () => {
      it('should return empty results for empty input array', async () => {
        const node = new ParallelNode('parallel-1');
        const context = createMockContext({ items: [] });

        const result = await node.execute(context);

        expect(result.success).toBe(true);
        expect(result.outputs.results).toEqual([]);
      });

      it('should fail when items input is missing', async () => {
        const node = new ParallelNode('parallel-1');
        const context = createMockContext({});

        const result = await node.execute(context);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain('items');
      });

      it('should fail when items input is not an array', async () => {
        const node = new ParallelNode('parallel-1');
        const context = createMockContext({ items: 'not an array' });

        const result = await node.execute(context);

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('array');
      });
    });

    describe('error handling', () => {
      it('should handle partial failures gracefully', async () => {
        const processItem = vi.fn().mockImplementation(async (item: { id: string }) => {
          if (item.id === '2') {
            throw new Error('Task 2 failed');
          }
          return { processedId: item.id };
        });

        const node = new ParallelNode('parallel-1', {
          maxConcurrency: 3,
          processItem,
          continueOnError: true,
        });

        const context = createMockContext({
          items: [{ id: '1' }, { id: '2' }, { id: '3' }],
        });

        const result = await node.execute(context);
        const results = result.outputs.results as Array<{ processedId?: string; error?: string }>;

        expect(result.success).toBe(true);
        expect(results[0].processedId).toBe('1');
        expect(results[1].error).toBeDefined();
        expect(results[2].processedId).toBe('3');
      });

      it('should fail completely when continueOnError is false', async () => {
        const processItem = vi.fn().mockImplementation(async (item: { id: string }) => {
          if (item.id === '2') {
            throw new Error('Task 2 failed');
          }
          return { processedId: item.id };
        });

        const node = new ParallelNode('parallel-1', {
          maxConcurrency: 1, // Sequential execution for predictable failure
          processItem,
          continueOnError: false,
        });

        const context = createMockContext({
          items: [{ id: '1' }, { id: '2' }, { id: '3' }],
        });

        const result = await node.execute(context);

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('Task 2 failed');
      });

      it('should include metadata about failed items', async () => {
        const processItem = vi.fn().mockImplementation(async (item: { id: string }) => {
          if (item.id === '2') {
            throw new Error('Task 2 failed');
          }
          return { processedId: item.id };
        });

        const node = new ParallelNode('parallel-1', {
          maxConcurrency: 3,
          processItem,
          continueOnError: true,
        });

        const context = createMockContext({
          items: [{ id: '1' }, { id: '2' }, { id: '3' }],
        });

        const result = await node.execute(context);

        expect(result.metadata?.failedCount).toBe(1);
        expect(result.metadata?.successCount).toBe(2);
        expect(result.metadata?.totalCount).toBe(3);
      });
    });

    describe('worktree integration', () => {
      it('should create worktrees when useWorktree is enabled', async () => {
        const node = new ParallelNode('parallel-1', {
          maxConcurrency: 2,
          useWorktree: true,
          branchPrefix: 'parallel',
        });

        const mockGitManager = {
          createWorktree: vi.fn().mockResolvedValue({
            path: '/tmp/worktree',
            branchName: 'parallel-1',
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

      it('should clean up worktrees after execution when cleanupAfter is true', async () => {
        const node = new ParallelNode('parallel-1', {
          maxConcurrency: 2,
          useWorktree: true,
          cleanupAfter: true,
        });

        const mockGitManager = {
          createWorktree: vi.fn().mockResolvedValue({
            path: '/tmp/worktree-1',
            branchName: 'parallel-1',
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

      it('should not clean up worktrees when cleanupAfter is false', async () => {
        const node = new ParallelNode('parallel-1', {
          maxConcurrency: 2,
          useWorktree: true,
          cleanupAfter: false,
        });

        const mockGitManager = {
          createWorktree: vi.fn().mockResolvedValue({
            path: '/tmp/worktree-1',
            branchName: 'parallel-1',
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

        expect(mockGitManager.removeWorktree).not.toHaveBeenCalled();
      });

      it('should pass worktree info to processItem', async () => {
        const processItem = vi.fn().mockResolvedValue({ done: true });

        const node = new ParallelNode('parallel-1', {
          maxConcurrency: 2,
          useWorktree: true,
          branchPrefix: 'parallel',
          processItem,
        });

        const mockGitManager = {
          createWorktree: vi.fn().mockImplementation(async (options) => ({
            path: `/tmp/worktree-${options.branchName}`,
            branchName: options.branchName,
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

        expect(processItem).toHaveBeenCalledWith(
          { id: '1' },
          expect.objectContaining({
            worktree: expect.objectContaining({
              path: expect.any(String),
              branchName: expect.any(String),
            }),
          })
        );
      });
    });

    describe('event emission', () => {
      it('should emit events for each item start and completion', async () => {
        const node = new ParallelNode('parallel-1', {
          maxConcurrency: 2,
        });

        const mockEmit = vi.fn();
        const context = createMockContext(
          { items: [{ id: '1' }, { id: '2' }] },
          {
            utils: createMockUtils({ emit: mockEmit }),
          }
        );

        await node.execute(context);

        // Should emit item-started and item-completed for each item
        const startEvents = mockEmit.mock.calls.filter(
          (call) => call[0] === 'parallel:item-started'
        );
        const completeEvents = mockEmit.mock.calls.filter(
          (call) => call[0] === 'parallel:item-completed'
        );

        expect(startEvents.length).toBe(2);
        expect(completeEvents.length).toBe(2);
      });

      it('should emit progress events', async () => {
        const node = new ParallelNode('parallel-1', {
          maxConcurrency: 1, // Sequential for predictable progress
        });

        const mockEmit = vi.fn();
        const context = createMockContext(
          { items: [{ id: '1' }, { id: '2' }, { id: '3' }] },
          {
            utils: createMockUtils({ emit: mockEmit }),
          }
        );

        await node.execute(context);

        const progressEvents = mockEmit.mock.calls.filter(
          (call) => call[0] === 'parallel:progress'
        );

        expect(progressEvents.length).toBeGreaterThan(0);
        // Check progress percentages
        const progressValues = progressEvents.map(
          (call) => (call[1] as { percentage: number }).percentage
        );
        expect(progressValues[progressValues.length - 1]).toBe(100);
      });
    });

    describe('timeout handling', () => {
      it('should timeout individual items that exceed timeout', async () => {
        const processItem = vi.fn().mockImplementation(async (item: { id: string }) => {
          if (item.id === '2') {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
          return { processedId: item.id };
        });

        const node = new ParallelNode('parallel-1', {
          maxConcurrency: 3,
          processItem,
          itemTimeout: 100,
          continueOnError: true,
        });

        const context = createMockContext({
          items: [{ id: '1' }, { id: '2' }, { id: '3' }],
        });

        const result = await node.execute(context);
        const results = result.outputs.results as Array<{ processedId?: string; error?: string }>;

        expect(results[0].processedId).toBe('1');
        expect(results[1].error).toContain('timeout');
        expect(results[2].processedId).toBe('3');
      });
    });
  });

  describe('toJSON / fromJSON', () => {
    it('should serialize to JSON correctly', () => {
      const node = new ParallelNode('parallel-1', {
        maxConcurrency: 4,
        useWorktree: true,
        branchPrefix: 'task',
        cleanupAfter: true,
      });

      const json = node.toJSON();

      expect(json.id).toBe('parallel-1');
      expect(json.type).toBe('control:parallel');
      expect(json.config.maxConcurrency).toBe(4);
      expect(json.config.useWorktree).toBe(true);
    });

    it('should deserialize from JSON correctly', () => {
      const json = {
        id: 'parallel-1',
        type: 'control:parallel' as const,
        label: 'Parallel',
        position: { x: 100, y: 200 },
        inputs: [],
        outputs: [],
        config: {
          maxConcurrency: 5,
          useWorktree: false,
        },
      };

      const node = ParallelNode.createFromJSON(json);

      expect(node.id).toBe('parallel-1');
      expect(node.config.maxConcurrency).toBe(5);
      expect(node.config.useWorktree).toBe(false);
    });
  });

  describe('Send API integration', () => {
    it('should generate Send commands for LangGraph integration', async () => {
      const node = new ParallelNode('parallel-1', {
        maxConcurrency: 3,
        targetNode: 'engineer-node',
      });

      const context = createMockContext({
        items: [{ id: '1' }, { id: '2' }, { id: '3' }],
      });

      const result = await node.execute(context);

      // Check that Send commands are generated in outputs
      expect(result.outputs.sendCommands).toBeDefined();
      const sendCommands = result.outputs.sendCommands as Array<{
        targetNode: string;
        payload: unknown;
      }>;
      expect(sendCommands.length).toBe(3);
      expect(sendCommands[0].targetNode).toBe('engineer-node');
    });
  });
});
