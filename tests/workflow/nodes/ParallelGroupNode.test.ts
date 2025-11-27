/**
 * ParallelGroupNode Tests
 *
 * TDD Red Phase: Tests for the ParallelGroupNode execution class.
 * This node manages parallel task execution with optional Git worktree isolation.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  ParallelGroupNode,
  type ParallelGroupConfig,
  type SubgraphDefinition,
  type Task,
} from '../../../src/workflow/nodes/ParallelGroupNode';
import {
  createMockExecutionContext,
  type ExecutionContext,
  type NodeResult,
} from '../../../src/workflow/nodes/BaseWorkflowNode';
import type { IGitWorktreeManager } from '../../../src/workflow/types';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a mock task
 */
function createMockTask(id: string, description: string): Task {
  return {
    id,
    description,
    priority: 'medium',
    metadata: {},
  };
}

/**
 * Create a mock subgraph definition
 */
function createMockSubgraph(): SubgraphDefinition {
  return {
    nodes: [
      {
        id: 'engineer-1',
        type: 'preset:engineer',
        label: 'Engineer',
        position: { x: 0, y: 0 },
        inputs: [{ id: 'task', name: 'Task', type: 'data', required: true }],
        outputs: [{ id: 'result', name: 'Result', type: 'data', required: true }],
        config: {},
      },
      {
        id: 'reviewer-1',
        type: 'preset:reviewer',
        label: 'Reviewer',
        position: { x: 200, y: 0 },
        inputs: [{ id: 'code', name: 'Code', type: 'data', required: true }],
        outputs: [{ id: 'review', name: 'Review', type: 'data', required: true }],
        config: {},
      },
    ],
    connections: [
      {
        id: 'conn-1',
        source: 'engineer-1',
        sourceOutput: 'result',
        target: 'reviewer-1',
        targetInput: 'code',
      },
    ],
    entryNodeId: 'engineer-1',
    exitNodeId: 'reviewer-1',
  };
}

/**
 * Create a ParallelGroupNode with default config
 */
function createParallelGroupNode(
  id: string = 'parallel-group-1',
  configOverrides: Partial<ParallelGroupConfig> = {}
): ParallelGroupNode {
  const config: ParallelGroupConfig = {
    maxConcurrency: 4,
    useWorktree: false,
    branchPrefix: 'parallel',
    cleanupAfter: true,
    failureStrategy: 'continue',
    aggregationStrategy: 'merge',
    inputMapping: 'task',
    conflictResolution: {
      strategy: 'ai',
      autoMergeAfterTask: true,
    },
    ...configOverrides,
  };

  return new ParallelGroupNode(id, { parallelGroup: config });
}

// ============================================================================
// ParallelGroupNode Construction Tests
// ============================================================================

describe('ParallelGroupNode', () => {
  describe('Construction', () => {
    it('should create a ParallelGroupNode instance', () => {
      const node = createParallelGroupNode();
      expect(node).toBeInstanceOf(ParallelGroupNode);
    });

    it('should have correct node type', () => {
      const node = createParallelGroupNode();
      expect(node.type).toBe('control:parallel-group');
    });

    it('should have tasks input socket', () => {
      const node = createParallelGroupNode();
      expect(node.hasInput('tasks')).toBe(true);
    });

    it('should have results output socket', () => {
      const node = createParallelGroupNode();
      expect(node.hasOutput('results')).toBe(true);
    });

    it('should initialize with default config', () => {
      const node = createParallelGroupNode();
      const json = node.toJSON();
      expect(json.config.parallelGroup).toBeDefined();
      expect(json.config.parallelGroup?.maxConcurrency).toBe(4);
      expect(json.config.parallelGroup?.useWorktree).toBe(false);
    });

    it('should accept custom config', () => {
      const node = createParallelGroupNode('pg-1', {
        maxConcurrency: 8,
        useWorktree: true,
        branchPrefix: 'feature',
      });
      const json = node.toJSON();
      expect(json.config.parallelGroup?.maxConcurrency).toBe(8);
      expect(json.config.parallelGroup?.useWorktree).toBe(true);
      expect(json.config.parallelGroup?.branchPrefix).toBe('feature');
    });
  });

  describe('Validation', () => {
    it('should validate successfully when tasks input is connected', () => {
      const node = createParallelGroupNode();
      node.setConnectedInputs(['tasks']);
      const result = node.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation when tasks input is not connected', () => {
      const node = createParallelGroupNode();
      const result = node.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Required input 'Tasks' is not connected");
    });

    it('should validate maxConcurrency is positive', () => {
      const node = createParallelGroupNode('pg-1', { maxConcurrency: 0 });
      node.setConnectedInputs(['tasks']);
      const result = node.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('maxConcurrency must be at least 1');
    });

    it('should validate subgraph is defined', () => {
      const node = createParallelGroupNode();
      node.setConnectedInputs(['tasks']);
      // Subgraph should be set before execution
      const result = node.validateSubgraph();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Subgraph is not defined');
    });
  });

  describe('Subgraph Management', () => {
    it('should set subgraph definition', () => {
      const node = createParallelGroupNode();
      const subgraph = createMockSubgraph();
      node.setSubgraph(subgraph);
      expect(node.getSubgraph()).toBeDefined();
      expect(node.getSubgraph()?.nodes).toHaveLength(2);
    });

    it('should validate subgraph has entry node', () => {
      const node = createParallelGroupNode();
      const invalidSubgraph: SubgraphDefinition = {
        nodes: [],
        connections: [],
        entryNodeId: '',
        exitNodeId: '',
      };
      node.setSubgraph(invalidSubgraph);
      const result = node.validateSubgraph();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Subgraph must have an entry node');
    });

    it('should validate subgraph entry node exists', () => {
      const node = createParallelGroupNode();
      const invalidSubgraph: SubgraphDefinition = {
        nodes: [
          {
            id: 'node-1',
            type: 'preset:engineer',
            label: 'Engineer',
            position: { x: 0, y: 0 },
            inputs: [],
            outputs: [],
            config: {},
          },
        ],
        connections: [],
        entryNodeId: 'non-existent',
        exitNodeId: 'node-1',
      };
      node.setSubgraph(invalidSubgraph);
      const result = node.validateSubgraph();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Entry node not found in subgraph');
    });
  });

  describe('Execute - Basic Parallel Execution (No Worktree)', () => {
    let node: ParallelGroupNode;
    let context: ExecutionContext;

    beforeEach(() => {
      node = createParallelGroupNode('pg-1', { useWorktree: false });
      node.setSubgraph(createMockSubgraph());
      node.setConnectedInputs(['tasks']);
      context = createMockExecutionContext();
    });

    it('should execute with empty tasks array', async () => {
      context.inputs = { tasks: [] };
      const result = await node.execute(context);
      expect(result.success).toBe(true);
      expect(result.outputs.results).toEqual([]);
    });

    it('should execute with single task', async () => {
      const tasks = [createMockTask('task-1', 'Implement feature')];
      context.inputs = { tasks };

      const result = await node.execute(context);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.outputs.results)).toBe(true);
      expect((result.outputs.results as unknown[]).length).toBe(1);
    });

    it('should execute with multiple tasks in parallel', async () => {
      const tasks = [
        createMockTask('task-1', 'Implement feature 1'),
        createMockTask('task-2', 'Implement feature 2'),
        createMockTask('task-3', 'Implement feature 3'),
      ];
      context.inputs = { tasks };

      const result = await node.execute(context);

      expect(result.success).toBe(true);
      expect((result.outputs.results as unknown[]).length).toBe(3);
    });

    it('should respect maxConcurrency limit', async () => {
      node = createParallelGroupNode('pg-1', {
        maxConcurrency: 2,
        useWorktree: false,
      });
      node.setSubgraph(createMockSubgraph());
      node.setConnectedInputs(['tasks']);

      const tasks = [
        createMockTask('task-1', 'Task 1'),
        createMockTask('task-2', 'Task 2'),
        createMockTask('task-3', 'Task 3'),
        createMockTask('task-4', 'Task 4'),
      ];
      context.inputs = { tasks };

      const result = await node.execute(context);

      expect(result.success).toBe(true);
      // All tasks should complete even with limited concurrency
      expect((result.outputs.results as unknown[]).length).toBe(4);
    });

    it('should continue on failure with failureStrategy="continue"', async () => {
      node = createParallelGroupNode('pg-1', {
        useWorktree: false,
        failureStrategy: 'continue',
      });
      node.setSubgraph(createMockSubgraph());
      node.setConnectedInputs(['tasks']);

      const tasks = [
        createMockTask('task-1', 'Success task'),
        createMockTask('task-2', 'FAIL'), // Special marker to simulate failure
        createMockTask('task-3', 'Another success'),
      ];
      context.inputs = { tasks };

      // Mock subgraph executor to fail on specific task
      node.setSubgraphExecutor(async (task: Task) => {
        if (task.description === 'FAIL') {
          throw new Error('Task execution failed');
        }
        return { success: true, output: `Result for ${task.id}` };
      });

      const result = await node.execute(context);

      // Should still succeed overall
      expect(result.success).toBe(true);
      // Should have results for successful tasks
      const results = result.outputs.results as Array<{ taskId: string; success: boolean }>;
      expect(results.length).toBe(3);
      expect(results.some((r) => !r.success)).toBe(true);
    });

    it('should abort all on failure with failureStrategy="abort-all"', async () => {
      node = createParallelGroupNode('pg-1', {
        useWorktree: false,
        failureStrategy: 'abort-all',
      });
      node.setSubgraph(createMockSubgraph());
      node.setConnectedInputs(['tasks']);

      const tasks = [
        createMockTask('task-1', 'Success task'),
        createMockTask('task-2', 'FAIL'),
        createMockTask('task-3', 'Another task'),
      ];
      context.inputs = { tasks };

      node.setSubgraphExecutor(async (task: Task) => {
        if (task.description === 'FAIL') {
          throw new Error('Task execution failed');
        }
        return { success: true, output: `Result for ${task.id}` };
      });

      const result = await node.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Task execution failed');
    });
  });

  describe('Execute - With Git Worktree', () => {
    let node: ParallelGroupNode;
    let context: ExecutionContext;
    let mockGitManager: IGitWorktreeManager;

    beforeEach(() => {
      node = createParallelGroupNode('pg-1', {
        useWorktree: true,
        branchPrefix: 'parallel',
        cleanupAfter: true,
      });
      node.setSubgraph(createMockSubgraph());
      node.setConnectedInputs(['tasks']);

      mockGitManager = {
        createWorktree: jest.fn<IGitWorktreeManager['createWorktree']>().mockImplementation(async (options) => ({
          path: `/tmp/worktree-${options.branchName}`,
          branchName: options.branchName,
        })),
        removeWorktree: jest.fn<IGitWorktreeManager['removeWorktree']>().mockResolvedValue(undefined),
        merge: jest.fn<IGitWorktreeManager['merge']>().mockResolvedValue({
          success: true,
          hasConflict: false,
        }),
        deleteBranch: jest.fn<IGitWorktreeManager['deleteBranch']>().mockResolvedValue(undefined),
      };

      context = createMockExecutionContext({
        services: { gitManager: mockGitManager },
      });
    });

    it('should create worktree for each task', async () => {
      const tasks = [
        createMockTask('task-1', 'Feature 1'),
        createMockTask('task-2', 'Feature 2'),
      ];
      context.inputs = { tasks };

      await node.execute(context);

      expect(mockGitManager.createWorktree).toHaveBeenCalledTimes(2);
      expect(mockGitManager.createWorktree).toHaveBeenCalledWith(
        expect.objectContaining({
          branchName: expect.stringContaining('parallel'),
        })
      );
    });

    it('should merge worktree after task completion', async () => {
      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { tasks };

      await node.execute(context);

      expect(mockGitManager.merge).toHaveBeenCalled();
    });

    it('should cleanup worktree after merge when cleanupAfter=true', async () => {
      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { tasks };

      await node.execute(context);

      expect(mockGitManager.removeWorktree).toHaveBeenCalled();
    });

    it('should not cleanup worktree when cleanupAfter=false', async () => {
      node = createParallelGroupNode('pg-1', {
        useWorktree: true,
        cleanupAfter: false,
      });
      node.setSubgraph(createMockSubgraph());
      node.setConnectedInputs(['tasks']);

      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { tasks };

      await node.execute(context);

      expect(mockGitManager.removeWorktree).not.toHaveBeenCalled();
    });
  });

  describe('Execute - Conflict Resolution', () => {
    let node: ParallelGroupNode;
    let context: ExecutionContext;
    let mockGitManager: IGitWorktreeManager;

    beforeEach(() => {
      node = createParallelGroupNode('pg-1', {
        useWorktree: true,
        conflictResolution: {
          strategy: 'ai',
          autoMergeAfterTask: true,
        },
      });
      node.setSubgraph(createMockSubgraph());
      node.setConnectedInputs(['tasks']);

      mockGitManager = {
        createWorktree: jest.fn<IGitWorktreeManager['createWorktree']>().mockImplementation(async (options) => ({
          path: `/tmp/worktree-${options.branchName}`,
          branchName: options.branchName,
        })),
        removeWorktree: jest.fn<IGitWorktreeManager['removeWorktree']>().mockResolvedValue(undefined),
        merge: jest.fn<IGitWorktreeManager['merge']>().mockResolvedValue({
          success: false,
          hasConflict: true,
          conflictFiles: ['src/index.ts'],
          conflictDetails: [
            {
              file: 'src/index.ts',
              content: '<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch',
              ours: 'ours',
              theirs: 'theirs',
            },
          ],
        }),
        deleteBranch: jest.fn<IGitWorktreeManager['deleteBranch']>().mockResolvedValue(undefined),
      };

      context = createMockExecutionContext({
        services: { gitManager: mockGitManager },
      });
    });

    it('should detect merge conflicts', async () => {
      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { tasks };

      const result = await node.execute(context);

      // Should have attempted merge
      expect(mockGitManager.merge).toHaveBeenCalled();
      // Result should include conflict information
      expect(result.outputs.conflicts).toBeDefined();
    });

    it('should resolve conflicts with AI strategy', async () => {
      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { tasks };

      // Mock AI conflict resolution
      const mockAIResolver = jest.fn().mockResolvedValue({
        resolved: true,
        resolvedContent: 'merged content',
      });
      node.setConflictResolver(mockAIResolver);

      await node.execute(context);

      expect(mockAIResolver).toHaveBeenCalled();
    });

    it('should use "ours" strategy when configured', async () => {
      node = createParallelGroupNode('pg-1', {
        useWorktree: true,
        conflictResolution: {
          strategy: 'ours',
          autoMergeAfterTask: true,
        },
      });
      node.setSubgraph(createMockSubgraph());
      node.setConnectedInputs(['tasks']);

      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { tasks };

      const result = await node.execute(context);

      expect(result.outputs.conflictResolutionStrategy).toBe('ours');
    });

    it('should pause execution with "manual" strategy', async () => {
      node = createParallelGroupNode('pg-1', {
        useWorktree: true,
        conflictResolution: {
          strategy: 'manual',
          autoMergeAfterTask: true,
        },
      });
      node.setSubgraph(createMockSubgraph());
      node.setConnectedInputs(['tasks']);

      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { tasks };

      const result = await node.execute(context);

      expect(result.outputs.paused).toBe(true);
      expect(result.outputs.waitingForManualResolution).toBe(true);
    });
  });

  describe('Result Aggregation', () => {
    let node: ParallelGroupNode;
    let context: ExecutionContext;

    beforeEach(() => {
      node = createParallelGroupNode('pg-1', { useWorktree: false });
      node.setSubgraph(createMockSubgraph());
      node.setConnectedInputs(['tasks']);
      context = createMockExecutionContext();
    });

    it('should aggregate results with "merge" strategy', async () => {
      node = createParallelGroupNode('pg-1', {
        useWorktree: false,
        aggregationStrategy: 'merge',
      });
      node.setSubgraph(createMockSubgraph());
      node.setConnectedInputs(['tasks']);

      const tasks = [
        createMockTask('task-1', 'Feature 1'),
        createMockTask('task-2', 'Feature 2'),
      ];
      context.inputs = { tasks };

      node.setSubgraphExecutor(async (task: Task) => ({
        success: true,
        output: { [task.id]: `Result for ${task.id}` },
      }));

      const result = await node.execute(context);

      expect(result.outputs.results).toBeDefined();
      expect(result.outputs.aggregated).toBeDefined();
    });

    it('should aggregate results with "concat" strategy', async () => {
      node = createParallelGroupNode('pg-1', {
        useWorktree: false,
        aggregationStrategy: 'concat',
      });
      node.setSubgraph(createMockSubgraph());
      node.setConnectedInputs(['tasks']);

      const tasks = [
        createMockTask('task-1', 'Feature 1'),
        createMockTask('task-2', 'Feature 2'),
      ];
      context.inputs = { tasks };

      node.setSubgraphExecutor(async (task: Task) => ({
        success: true,
        output: [`Result for ${task.id}`],
      }));

      const result = await node.execute(context);

      const aggregated = result.outputs.aggregated as unknown[];
      expect(Array.isArray(aggregated)).toBe(true);
      expect(aggregated.length).toBe(2);
    });

    it('should return individual results without aggregation with "none" strategy', async () => {
      node = createParallelGroupNode('pg-1', {
        useWorktree: false,
        aggregationStrategy: 'none',
      });
      node.setSubgraph(createMockSubgraph());
      node.setConnectedInputs(['tasks']);

      const tasks = [
        createMockTask('task-1', 'Feature 1'),
        createMockTask('task-2', 'Feature 2'),
      ];
      context.inputs = { tasks };

      const result = await node.execute(context);

      expect(result.outputs.results).toBeDefined();
      expect(result.outputs.aggregated).toBeUndefined();
    });
  });

  describe('Metadata', () => {
    let node: ParallelGroupNode;
    let context: ExecutionContext;

    beforeEach(() => {
      node = createParallelGroupNode('pg-1', { useWorktree: false });
      node.setSubgraph(createMockSubgraph());
      node.setConnectedInputs(['tasks']);
      context = createMockExecutionContext();
    });

    it('should include execution duration in metadata', async () => {
      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { tasks };

      const result = await node.execute(context);

      expect(result.metadata?.duration).toBeDefined();
      expect(typeof result.metadata?.duration).toBe('number');
    });

    it('should include task count in metadata', async () => {
      const tasks = [
        createMockTask('task-1', 'Feature 1'),
        createMockTask('task-2', 'Feature 2'),
      ];
      context.inputs = { tasks };

      const result = await node.execute(context);

      expect(result.metadata?.taskCount).toBe(2);
    });

    it('should include success/failure counts in metadata', async () => {
      const tasks = [
        createMockTask('task-1', 'Feature 1'),
        createMockTask('task-2', 'FAIL'),
      ];
      context.inputs = { tasks };

      node.setSubgraphExecutor(async (task: Task) => {
        if (task.description === 'FAIL') {
          throw new Error('Failed');
        }
        return { success: true, output: `Result for ${task.id}` };
      });

      const result = await node.execute(context);

      expect(result.metadata?.successCount).toBe(1);
      expect(result.metadata?.failureCount).toBe(1);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON correctly', () => {
      const node = createParallelGroupNode('pg-1', {
        maxConcurrency: 6,
        useWorktree: true,
        branchPrefix: 'feat',
      });
      node.setSubgraph(createMockSubgraph());

      const json = node.toJSON();

      expect(json.id).toBe('pg-1');
      expect(json.type).toBe('control:parallel-group');
      expect(json.config.parallelGroup?.maxConcurrency).toBe(6);
      expect(json.config.parallelGroup?.useWorktree).toBe(true);
      expect(json.config.subgraph).toBeDefined();
    });

    it('should deserialize from JSON correctly', () => {
      const json = {
        id: 'pg-2',
        type: 'control:parallel-group' as const,
        label: 'Parallel Group',
        position: { x: 100, y: 200 },
        inputs: [{ id: 'tasks', name: 'Tasks', type: 'data' as const, required: true }],
        outputs: [{ id: 'results', name: 'Results', type: 'data' as const, required: false }],
        config: {
          parallelGroup: {
            maxConcurrency: 4,
            useWorktree: true,
          },
        },
      };

      const node = ParallelGroupNode.createFromJSON(json);

      expect(node.id).toBe('pg-2');
      expect(node.type).toBe('control:parallel-group');
    });
  });
});
