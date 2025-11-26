/**
 * AggregatorNode Tests (TDD - Red Phase)
 *
 * Tests for the AggregatorNode which collects and aggregates results
 * from parallel executions.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { AggregatorNode } from '../../../src/workflow/nodes/AggregatorNode.js';
import type {
  ExecutionContext,
  NodeResult,
  Services,
  Utils,
  GlobalContext,
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

// ============================================================================
// Tests
// ============================================================================

describe('AggregatorNode', () => {
  describe('constructor', () => {
    it('should create an AggregatorNode with default configuration', () => {
      const node = new AggregatorNode('aggregator-1');

      expect(node.id).toBe('aggregator-1');
      expect(node.type).toBe('control:aggregator');
      expect(node.label).toBe('Aggregator');
    });

    it('should create an AggregatorNode with custom configuration', () => {
      const node = new AggregatorNode('aggregator-2', {
        aggregationMode: 'merge',
        waitForAll: true,
        timeout: 60000,
      });

      expect(node.id).toBe('aggregator-2');
      expect(node.config.aggregationMode).toBe('merge');
      expect(node.config.waitForAll).toBe(true);
      expect(node.config.timeout).toBe(60000);
    });

    it('should have proper input and output sockets', () => {
      const node = new AggregatorNode('aggregator-1');

      // Input: array of results from parallel execution
      const inputSocket = node.inputs.find((s) => s.id === 'results');
      expect(inputSocket).toBeDefined();
      expect(inputSocket?.type).toBe('data');
      expect(inputSocket?.dataType).toBe('array');
      expect(inputSocket?.required).toBe(true);

      // Output: aggregated result
      const outputSocket = node.outputs.find((s) => s.id === 'aggregated');
      expect(outputSocket).toBeDefined();
      expect(outputSocket?.type).toBe('data');
    });
  });

  describe('validate', () => {
    it('should return valid for properly configured node', () => {
      const node = new AggregatorNode('aggregator-1', {
        aggregationMode: 'concat',
      });

      const result = node.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid for unknown aggregation mode', () => {
      const node = new AggregatorNode('aggregator-1', {
        aggregationMode: 'unknown' as 'concat',
      });

      const result = node.validate();

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('aggregationMode'))).toBe(true);
    });
  });

  describe('execute', () => {
    describe('concat mode', () => {
      it('should concatenate array results', async () => {
        const node = new AggregatorNode('aggregator-1', {
          aggregationMode: 'concat',
        });

        const context = createMockContext({
          results: [
            [1, 2],
            [3, 4],
            [5, 6],
          ],
        });

        const result = await node.execute(context);

        expect(result.success).toBe(true);
        expect(result.outputs.aggregated).toEqual([1, 2, 3, 4, 5, 6]);
      });

      it('should handle non-array items by wrapping them', async () => {
        const node = new AggregatorNode('aggregator-1', {
          aggregationMode: 'concat',
        });

        const context = createMockContext({
          results: [
            { data: 'a' },
            [1, 2],
            'string',
          ],
        });

        const result = await node.execute(context);

        expect(result.success).toBe(true);
        expect(result.outputs.aggregated).toEqual([{ data: 'a' }, 1, 2, 'string']);
      });
    });

    describe('merge mode', () => {
      it('should merge object results', async () => {
        const node = new AggregatorNode('aggregator-1', {
          aggregationMode: 'merge',
        });

        const context = createMockContext({
          results: [
            { a: 1 },
            { b: 2 },
            { c: 3 },
          ],
        });

        const result = await node.execute(context);

        expect(result.success).toBe(true);
        expect(result.outputs.aggregated).toEqual({ a: 1, b: 2, c: 3 });
      });

      it('should handle conflicting keys with last-wins strategy', async () => {
        const node = new AggregatorNode('aggregator-1', {
          aggregationMode: 'merge',
        });

        const context = createMockContext({
          results: [
            { key: 'first' },
            { key: 'second' },
          ],
        });

        const result = await node.execute(context);

        expect(result.success).toBe(true);
        expect(result.outputs.aggregated).toEqual({ key: 'second' });
      });

      it('should skip non-object items in merge mode', async () => {
        const node = new AggregatorNode('aggregator-1', {
          aggregationMode: 'merge',
        });

        const context = createMockContext({
          results: [
            { a: 1 },
            'skip me',
            { b: 2 },
          ],
        });

        const result = await node.execute(context);

        expect(result.success).toBe(true);
        expect(result.outputs.aggregated).toEqual({ a: 1, b: 2 });
      });
    });

    describe('first mode', () => {
      it('should return the first result', async () => {
        const node = new AggregatorNode('aggregator-1', {
          aggregationMode: 'first',
        });

        const context = createMockContext({
          results: ['first', 'second', 'third'],
        });

        const result = await node.execute(context);

        expect(result.success).toBe(true);
        expect(result.outputs.aggregated).toBe('first');
      });

      it('should return undefined for empty array', async () => {
        const node = new AggregatorNode('aggregator-1', {
          aggregationMode: 'first',
        });

        const context = createMockContext({
          results: [],
        });

        const result = await node.execute(context);

        expect(result.success).toBe(true);
        expect(result.outputs.aggregated).toBeUndefined();
      });
    });

    describe('last mode', () => {
      it('should return the last result', async () => {
        const node = new AggregatorNode('aggregator-1', {
          aggregationMode: 'last',
        });

        const context = createMockContext({
          results: ['first', 'second', 'third'],
        });

        const result = await node.execute(context);

        expect(result.success).toBe(true);
        expect(result.outputs.aggregated).toBe('third');
      });
    });

    describe('custom mode', () => {
      it('should use custom aggregation function', async () => {
        const customAggregator = vi.fn().mockReturnValue({ sum: 6 });

        const node = new AggregatorNode('aggregator-1', {
          aggregationMode: 'custom',
          customAggregator,
        });

        const context = createMockContext({
          results: [1, 2, 3],
        });

        const result = await node.execute(context);

        expect(result.success).toBe(true);
        expect(customAggregator).toHaveBeenCalledWith([1, 2, 3], expect.any(Object));
        expect(result.outputs.aggregated).toEqual({ sum: 6 });
      });

      it('should fail if custom mode without aggregator function', async () => {
        const node = new AggregatorNode('aggregator-1', {
          aggregationMode: 'custom',
        });

        const context = createMockContext({
          results: [1, 2, 3],
        });

        const result = await node.execute(context);

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('customAggregator');
      });
    });

    describe('error handling', () => {
      it('should fail when results input is missing', async () => {
        const node = new AggregatorNode('aggregator-1');
        const context = createMockContext({});

        const result = await node.execute(context);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain('results');
      });

      it('should fail when results is not an array', async () => {
        const node = new AggregatorNode('aggregator-1');
        const context = createMockContext({ results: 'not an array' });

        const result = await node.execute(context);

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('array');
      });

      it('should filter out error results when filterErrors is true', async () => {
        const node = new AggregatorNode('aggregator-1', {
          aggregationMode: 'concat',
          filterErrors: true,
        });

        const context = createMockContext({
          results: [
            { data: 'success1' },
            { error: 'failed task' },
            { data: 'success2' },
          ],
        });

        const result = await node.execute(context);

        expect(result.success).toBe(true);
        const aggregated = result.outputs.aggregated as Array<{ data?: string; error?: string }>;
        expect(aggregated).toHaveLength(2);
        expect(aggregated.some((r) => r.error)).toBe(false);
      });

      it('should include error results when filterErrors is false', async () => {
        const node = new AggregatorNode('aggregator-1', {
          aggregationMode: 'concat',
          filterErrors: false,
        });

        const context = createMockContext({
          results: [
            { data: 'success1' },
            { error: 'failed task' },
            { data: 'success2' },
          ],
        });

        const result = await node.execute(context);

        expect(result.success).toBe(true);
        const aggregated = result.outputs.aggregated as Array<{ data?: string; error?: string }>;
        expect(aggregated).toHaveLength(3);
      });
    });

    describe('metadata', () => {
      it('should include aggregation statistics in metadata', async () => {
        const node = new AggregatorNode('aggregator-1', {
          aggregationMode: 'concat',
        });

        const context = createMockContext({
          results: [
            { data: 'a' },
            { error: 'failed' },
            { data: 'b' },
          ],
        });

        const result = await node.execute(context);

        expect(result.metadata?.inputCount).toBe(3);
        expect(result.metadata?.successCount).toBe(2);
        expect(result.metadata?.errorCount).toBe(1);
      });
    });

    describe('empty input handling', () => {
      it('should return empty array for concat mode with empty input', async () => {
        const node = new AggregatorNode('aggregator-1', {
          aggregationMode: 'concat',
        });

        const context = createMockContext({ results: [] });

        const result = await node.execute(context);

        expect(result.success).toBe(true);
        expect(result.outputs.aggregated).toEqual([]);
      });

      it('should return empty object for merge mode with empty input', async () => {
        const node = new AggregatorNode('aggregator-1', {
          aggregationMode: 'merge',
        });

        const context = createMockContext({ results: [] });

        const result = await node.execute(context);

        expect(result.success).toBe(true);
        expect(result.outputs.aggregated).toEqual({});
      });
    });
  });

  describe('toJSON / fromJSON', () => {
    it('should serialize to JSON correctly', () => {
      const node = new AggregatorNode('aggregator-1', {
        aggregationMode: 'merge',
        waitForAll: true,
      });

      const json = node.toJSON();

      expect(json.id).toBe('aggregator-1');
      expect(json.type).toBe('control:aggregator');
      expect(json.config.aggregationMode).toBe('merge');
      expect(json.config.waitForAll).toBe(true);
    });

    it('should deserialize from JSON correctly', () => {
      const json = {
        id: 'aggregator-1',
        type: 'control:aggregator' as const,
        label: 'Aggregator',
        position: { x: 100, y: 200 },
        inputs: [],
        outputs: [],
        config: {
          aggregationMode: 'concat' as const,
          filterErrors: true,
        },
      };

      const node = AggregatorNode.createFromJSON(json);

      expect(node.id).toBe('aggregator-1');
      expect(node.config.aggregationMode).toBe('concat');
      expect(node.config.filterErrors).toBe(true);
    });
  });

  describe('reducer integration', () => {
    it('should work as a LangGraph reducer', async () => {
      const node = new AggregatorNode('aggregator-1', {
        aggregationMode: 'concat',
      });

      // Simulate multiple inputs arriving from parallel nodes
      const inputs = [
        { result: 'from-node-1' },
        { result: 'from-node-2' },
        { result: 'from-node-3' },
      ];

      const context = createMockContext({
        results: inputs,
      });

      const result = await node.execute(context);

      expect(result.success).toBe(true);
      expect((result.outputs.aggregated as unknown[]).length).toBe(3);
    });
  });
});
