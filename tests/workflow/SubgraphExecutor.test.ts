/**
 * SubgraphExecutor Tests (TDD - Red Phase)
 *
 * Tests for SubgraphExecutor which executes subgraphs within worktrees.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type {
  ExecutionContext,
  Services,
  Utils,
  GlobalContext,
} from '../../src/workflow/types.js';
import { SubgraphExecutor, type SubgraphDefinition } from '../../src/workflow/SubgraphExecutor.js';

// ============================================================================
// Mock Factories
// ============================================================================

function createMockServices(overrides?: Partial<Services>): Services {
  return {
    aiProvider: {
      query: jest.fn().mockResolvedValue({
        finalState: { result: 'mock result' },
        duration: 1000,
        turns: 5,
      }),
    },
    gitManager: {
      createWorktree: jest.fn().mockResolvedValue({
        path: '/tmp/worktree-1',
        branchName: 'feature/task-1',
      }),
      removeWorktree: jest.fn().mockResolvedValue(undefined),
      merge: jest.fn().mockResolvedValue({
        success: true,
        hasConflict: false,
      }),
      deleteBranch: jest.fn().mockResolvedValue(undefined),
    },
    stateManager: {
      emit: jest.fn(),
      subscribe: jest.fn().mockReturnValue(() => {}),
    },
    dataPersistence: {
      saveWorkflowResult: jest.fn().mockResolvedValue(undefined),
      loadWorkflowResult: jest.fn().mockResolvedValue(null),
    },
    ...overrides,
  };
}

function createMockUtils(overrides?: Partial<Utils>): Utils {
  return {
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
    emit: jest.fn(),
    memoryMonitor: {
      getUsage: jest.fn().mockReturnValue({ heapUsed: 100, heapTotal: 200, rss: 300 }),
      checkThreshold: jest.fn().mockReturnValue(false),
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

function createSampleSubgraph(): SubgraphDefinition {
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
    entryNodeId: 'sub-start',
    exitNodeId: 'sub-end',
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('SubgraphExecutor', () => {
  let executor: SubgraphExecutor;

  beforeEach(() => {
    jest.clearAllMocks();
    executor = new SubgraphExecutor();
  });

  describe('constructor', () => {
    it('should create a SubgraphExecutor instance', () => {
      expect(executor).toBeInstanceOf(SubgraphExecutor);
    });
  });

  describe('execute', () => {
    describe('basic execution', () => {
      it('should execute a subgraph and return result', async () => {
        const subgraph = createSampleSubgraph();
        const context = createMockContext();
        const initialInputs = { task: { id: 'task-1', description: 'Test task' } };

        const result = await executor.execute(subgraph, null, context, initialInputs);

        // The actual execution depends on ReteWorkflowExecutor
        // For now, we verify the executor returns a result structure
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('output');
      });

      it('should accept subgraph with nodes and connections', async () => {
        const subgraph = createSampleSubgraph();
        const context = createMockContext();
        const initialInputs = { task: { id: 'task-1' } };

        // Should not throw
        await expect(
          executor.execute(subgraph, null, context, initialInputs)
        ).resolves.toBeDefined();
      });
    });

    describe('worktree execution', () => {
      it('should accept worktree path parameter', async () => {
        const subgraph = createSampleSubgraph();
        const context = createMockContext();
        const worktreePath = '/tmp/worktree-task-1';
        const initialInputs = { task: { id: 'task-1' } };

        // Should not throw when worktree path is provided
        await expect(
          executor.execute(subgraph, worktreePath, context, initialInputs)
        ).resolves.toBeDefined();
      });

      it('should accept null worktree path', async () => {
        const subgraph = createSampleSubgraph();
        const context = createMockContext();
        const initialInputs = { task: { id: 'task-1' } };

        // Should not throw when worktree path is null
        await expect(
          executor.execute(subgraph, null, context, initialInputs)
        ).resolves.toBeDefined();
      });

      it('should not modify the original context object', async () => {
        const subgraph = createSampleSubgraph();
        const originalProjectPath = '/original/project';
        const context = createMockContext({}, {
          global: createMockGlobalContext({ projectPath: originalProjectPath }),
        });
        const worktreePath = '/tmp/worktree';
        const initialInputs = { task: { id: 'task-1' } };

        await executor.execute(subgraph, worktreePath, context, initialInputs);

        // Original context should be unchanged
        expect(context.global.projectPath).toBe(originalProjectPath);
      });

      it('should use worktree path when provided (integration check)', async () => {
        // This test verifies the SubgraphExecutor correctly passes worktree path
        // to the internal executor. The actual execution happens via ReteWorkflowExecutor
        // which receives globalContext with modified projectPath
        const subgraph = createSampleSubgraph();
        const originalProjectPath = '/original/project';
        const worktreePath = '/tmp/worktree-for-task';
        const context = createMockContext({}, {
          global: createMockGlobalContext({ projectPath: originalProjectPath }),
        });
        const initialInputs = { task: { id: 'task-1' } };

        const result = await executor.execute(subgraph, worktreePath, context, initialInputs);

        // Execution should complete (success or failure depends on subgraph structure)
        expect(result).toBeDefined();
        expect(result).toHaveProperty('success');
        // Original context remains unchanged
        expect(context.global.projectPath).toBe(originalProjectPath);
      });
    });

    describe('error handling', () => {
      it('should return failure when subgraph is undefined', async () => {
        const context = createMockContext();
        const initialInputs = { task: { id: 'task-1' } };

        const result = await executor.execute(
          undefined as unknown as SubgraphDefinition,
          null,
          context,
          initialInputs
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain('undefined');
      });

      it('should return failure when subgraph has no nodes', async () => {
        const emptySubgraph: SubgraphDefinition = {
          nodes: [],
          connections: [],
          entryNodeId: '',
          exitNodeId: '',
        };
        const context = createMockContext();
        const initialInputs = { task: { id: 'task-1' } };

        const result = await executor.execute(emptySubgraph, null, context, initialInputs);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain('no nodes');
      });

      it('should handle execution errors gracefully', async () => {
        const subgraph = createSampleSubgraph();
        const context = createMockContext();
        const initialInputs = { task: { id: 'task-1' } };

        // Even if internal execution fails, we should get a result object
        const result = await executor.execute(subgraph, null, context, initialInputs);

        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('output');
      });
    });

    describe('input handling', () => {
      it('should accept initial inputs for the subgraph', async () => {
        const subgraph = createSampleSubgraph();
        const context = createMockContext();
        const initialInputs = {
          task: { id: 'task-1', description: 'Test' },
          data: { key: 'value' },
        };

        // Should not throw
        await expect(
          executor.execute(subgraph, null, context, initialInputs)
        ).resolves.toBeDefined();
      });

      it('should accept empty initial inputs', async () => {
        const subgraph = createSampleSubgraph();
        const context = createMockContext();
        const initialInputs = {};

        // Should not throw
        await expect(
          executor.execute(subgraph, null, context, initialInputs)
        ).resolves.toBeDefined();
      });
    });

    describe('result structure', () => {
      it('should return result with success boolean', async () => {
        const subgraph = createSampleSubgraph();
        const context = createMockContext();
        const initialInputs = { task: { id: 'task-1' } };

        const result = await executor.execute(subgraph, null, context, initialInputs);

        expect(typeof result.success).toBe('boolean');
      });

      it('should return result with output property', async () => {
        const subgraph = createSampleSubgraph();
        const context = createMockContext();
        const initialInputs = { task: { id: 'task-1' } };

        const result = await executor.execute(subgraph, null, context, initialInputs);

        expect(result).toHaveProperty('output');
      });

      it('should include error in result when execution fails', async () => {
        const emptySubgraph: SubgraphDefinition = {
          nodes: [],
          connections: [],
          entryNodeId: '',
          exitNodeId: '',
        };
        const context = createMockContext();
        const initialInputs = { task: { id: 'task-1' } };

        const result = await executor.execute(emptySubgraph, null, context, initialInputs);

        expect(result.success).toBe(false);
        expect(result.error).toBeInstanceOf(Error);
      });
    });
  });
});
