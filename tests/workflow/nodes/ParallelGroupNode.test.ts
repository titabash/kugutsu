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

    it('should have prompt input socket', () => {
      const node = createParallelGroupNode();
      expect(node.hasInput('prompt')).toBe(true);
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
    it('should validate successfully when prompt input is connected', () => {
      const node = createParallelGroupNode();
      node.setConnectedInputs(['prompt']);
      const result = node.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation when prompt input is not connected', () => {
      const node = createParallelGroupNode();
      const result = node.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Required input 'Prompt' is not connected");
    });

    it('should validate maxConcurrency is positive', () => {
      const node = createParallelGroupNode('pg-1', { maxConcurrency: 0 });
      node.setConnectedInputs(['prompt']);
      const result = node.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('maxConcurrency must be at least 1');
    });

    it('should validate subgraph is defined', () => {
      const node = createParallelGroupNode();
      node.setConnectedInputs(['prompt']);
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
      node.setConnectedInputs(['prompt']);
      context = createMockExecutionContext();
    });

    it('should execute with empty tasks array', async () => {
      context.inputs = { prompt: 'Empty request' };
      // Return empty task list
      node.setTaskDecomposer(async () => []);

      const result = await node.execute(context);
      expect(result.success).toBe(true);
      expect(result.outputs.results).toEqual([]);
    });

    it('should execute with single task', async () => {
      const tasks = [createMockTask('task-1', 'Implement feature')];
      context.inputs = { prompt: 'Implement a feature' };
      node.setTaskDecomposer(async () => tasks);

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
      context.inputs = { prompt: 'Implement multiple features' };
      node.setTaskDecomposer(async () => tasks);

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
      node.setConnectedInputs(['prompt']);

      const tasks = [
        createMockTask('task-1', 'Task 1'),
        createMockTask('task-2', 'Task 2'),
        createMockTask('task-3', 'Task 3'),
        createMockTask('task-4', 'Task 4'),
      ];
      context.inputs = { prompt: 'Execute multiple tasks' };
      node.setTaskDecomposer(async () => tasks);

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
      node.setConnectedInputs(['prompt']);

      const tasks = [
        createMockTask('task-1', 'Success task'),
        createMockTask('task-2', 'FAIL'), // Special marker to simulate failure
        createMockTask('task-3', 'Another success'),
      ];
      context.inputs = { prompt: 'Execute with failures' };
      node.setTaskDecomposer(async () => tasks);

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
      node.setConnectedInputs(['prompt']);

      const tasks = [
        createMockTask('task-1', 'Success task'),
        createMockTask('task-2', 'FAIL'),
        createMockTask('task-3', 'Another task'),
      ];
      context.inputs = { prompt: 'Execute with abort' };
      node.setTaskDecomposer(async () => tasks);

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
      node.setConnectedInputs(['prompt']);

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
      context.inputs = { prompt: 'Create two features' };
      node.setTaskDecomposer(async () => tasks);

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
      context.inputs = { prompt: 'Create a feature' };
      node.setTaskDecomposer(async () => tasks);

      await node.execute(context);

      expect(mockGitManager.merge).toHaveBeenCalled();
    });

    it('should cleanup worktree after merge when cleanupAfter=true', async () => {
      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { prompt: 'Create a feature' };
      node.setTaskDecomposer(async () => tasks);

      await node.execute(context);

      expect(mockGitManager.removeWorktree).toHaveBeenCalled();
    });

    it('should not cleanup worktree when cleanupAfter=false', async () => {
      node = createParallelGroupNode('pg-1', {
        useWorktree: true,
        cleanupAfter: false,
      });
      node.setSubgraph(createMockSubgraph());
      node.setConnectedInputs(['prompt']);

      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { prompt: 'Create a feature' };
      node.setTaskDecomposer(async () => tasks);

      await node.execute(context);

      expect(mockGitManager.removeWorktree).not.toHaveBeenCalled();
    });

    it('should execute subgraph with worktree path when useWorktree is enabled', async () => {
      // Track the worktree paths passed to subgraph executor
      const receivedWorktreePaths: (string | undefined)[] = [];

      node = createParallelGroupNode('pg-1', {
        useWorktree: true,
        branchPrefix: 'parallel',
        cleanupAfter: true,
      });
      node.setSubgraph(createMockSubgraph());
      node.setConnectedInputs(['prompt']);

      const tasks = [
        createMockTask('task-1', 'Feature 1'),
        createMockTask('task-2', 'Feature 2'),
      ];
      node.setTaskDecomposer(async () => tasks);

      // Custom executor that captures the context
      node.setSubgraphExecutor(async (task: Task, ctx: ExecutionContext) => {
        // The context should have the worktree path as projectPath
        // when SubgraphExecutor is used internally
        receivedWorktreePaths.push(ctx.global.projectPath);
        return { success: true, output: { taskId: task.id } };
      });

      context.inputs = { prompt: 'Create two features' };

      await node.execute(context);

      // Worktrees should have been created
      expect(mockGitManager.createWorktree).toHaveBeenCalledTimes(2);
      // Custom executor was called (note: custom executor receives original context,
      // but internal SubgraphExecutor would receive worktree path)
      expect(receivedWorktreePaths.length).toBe(2);
    });

    it('should execute default subgraph executor with worktree info', async () => {
      // Test without custom executor - uses internal SubgraphExecutor
      node = createParallelGroupNode('pg-1', {
        useWorktree: true,
        branchPrefix: 'parallel',
        cleanupAfter: true,
      });
      node.setSubgraph(createMockSubgraph());
      node.setConnectedInputs(['prompt']);
      // Set task decomposer but NOT custom subgraph executor - use default implementation
      const tasks = [createMockTask('task-1', 'Feature 1')];
      node.setTaskDecomposer(async () => tasks);

      context.inputs = { prompt: 'Create a feature' };

      const result = await node.execute(context);

      // Worktree should have been created
      expect(mockGitManager.createWorktree).toHaveBeenCalledTimes(1);
      expect(mockGitManager.createWorktree).toHaveBeenCalledWith(
        expect.objectContaining({
          branchName: expect.stringContaining('parallel'),
          baseBranch: 'main',
        })
      );

      // Execution should complete (SubgraphExecutor calls ReteWorkflowExecutor internally)
      expect(result.success).toBe(true);
      expect(result.outputs.results).toBeDefined();
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
      node.setConnectedInputs(['prompt']);

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
      context.inputs = { prompt: 'Create a feature' };
      node.setTaskDecomposer(async () => tasks);

      const result = await node.execute(context);

      // Should have attempted merge
      expect(mockGitManager.merge).toHaveBeenCalled();
      // Result should include conflict information
      expect(result.outputs.conflicts).toBeDefined();
    });

    it('should resolve conflicts with AI strategy', async () => {
      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { prompt: 'Create a feature' };
      node.setTaskDecomposer(async () => tasks);

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
      node.setConnectedInputs(['prompt']);

      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { prompt: 'Create a feature' };
      node.setTaskDecomposer(async () => tasks);

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
      node.setConnectedInputs(['prompt']);

      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { prompt: 'Create a feature' };
      node.setTaskDecomposer(async () => tasks);

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
      node.setConnectedInputs(['prompt']);
      context = createMockExecutionContext();
    });

    it('should aggregate results with "merge" strategy', async () => {
      node = createParallelGroupNode('pg-1', {
        useWorktree: false,
        aggregationStrategy: 'merge',
      });
      node.setSubgraph(createMockSubgraph());
      node.setConnectedInputs(['prompt']);

      const tasks = [
        createMockTask('task-1', 'Feature 1'),
        createMockTask('task-2', 'Feature 2'),
      ];
      context.inputs = { prompt: 'Create two features' };
      node.setTaskDecomposer(async () => tasks);

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
      node.setConnectedInputs(['prompt']);

      const tasks = [
        createMockTask('task-1', 'Feature 1'),
        createMockTask('task-2', 'Feature 2'),
      ];
      context.inputs = { prompt: 'Create two features' };
      node.setTaskDecomposer(async () => tasks);

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
      node.setConnectedInputs(['prompt']);

      const tasks = [
        createMockTask('task-1', 'Feature 1'),
        createMockTask('task-2', 'Feature 2'),
      ];
      context.inputs = { prompt: 'Create two features' };
      node.setTaskDecomposer(async () => tasks);

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
      node.setConnectedInputs(['prompt']);
      context = createMockExecutionContext();
    });

    it('should include execution duration in metadata', async () => {
      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { prompt: 'Create a feature' };
      node.setTaskDecomposer(async () => tasks);

      const result = await node.execute(context);

      expect(result.metadata?.duration).toBeDefined();
      expect(typeof result.metadata?.duration).toBe('number');
    });

    it('should include task count in metadata', async () => {
      const tasks = [
        createMockTask('task-1', 'Feature 1'),
        createMockTask('task-2', 'Feature 2'),
      ];
      context.inputs = { prompt: 'Create two features' };
      node.setTaskDecomposer(async () => tasks);

      const result = await node.execute(context);

      expect(result.metadata?.taskCount).toBe(2);
    });

    it('should include success/failure counts in metadata', async () => {
      const tasks = [
        createMockTask('task-1', 'Feature 1'),
        createMockTask('task-2', 'FAIL'),
      ];
      context.inputs = { prompt: 'Create features with one failing' };
      node.setTaskDecomposer(async () => tasks);

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
        inputs: [{ id: 'prompt', name: 'Prompt', type: 'data' as const, required: true }],
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

  // ============================================================================
  // Task Decomposition Tests (Self-contained ParallelGroup)
  // ============================================================================

  describe('Task Decomposition (Self-contained)', () => {
    let node: ParallelGroupNode;
    let context: ExecutionContext;
    let mockAiQuery: jest.Mock;

    beforeEach(() => {
      node = createParallelGroupNode('pg-decompose', { useWorktree: false });
      node.setSubgraph(createMockSubgraph());
      node.setConnectedInputs(['prompt']);

      // Create mock AI provider with jest.fn()
      mockAiQuery = jest.fn().mockResolvedValue({
        finalState: { tasks: [] },
        duration: 100,
        turns: 1,
      });

      context = createMockExecutionContext({
        services: {
          aiProvider: { query: mockAiQuery },
        },
      });
    });

    describe('Input Handling', () => {
      it('should have prompt input socket instead of tasks', () => {
        const freshNode = createParallelGroupNode();
        expect(freshNode.hasInput('prompt')).toBe(true);
        expect(freshNode.hasInput('tasks')).toBe(false);
      });

      it('should accept string prompt as input', async () => {
        context.inputs = { prompt: 'Implement user authentication system' };

        // Mock AI provider to return decomposed tasks
        mockAiQuery.mockResolvedValue({
          finalState: {
            tasks: [
              { id: 'task-1', description: 'Implement login endpoint' },
              { id: 'task-2', description: 'Implement logout endpoint' },
            ],
          },
          duration: 1000,
          turns: 1,
        });

        const result = await node.execute(context);

        expect(result.success).toBe(true);
      });

      it('should fail when prompt input is missing', async () => {
        context.inputs = {};

        const result = await node.execute(context);

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('prompt');
      });

      it('should fail when prompt is empty string', async () => {
        context.inputs = { prompt: '' };

        const result = await node.execute(context);

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('empty');
      });

      it('should fail when prompt is not a string', async () => {
        context.inputs = { prompt: { invalid: 'object' } };

        const result = await node.execute(context);

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('string');
      });
    });

    describe('AI Task Decomposition', () => {
      it('should call AI provider to decompose prompt into tasks', async () => {
        context.inputs = { prompt: 'Build a REST API for user management' };

        mockAiQuery.mockResolvedValue({
          finalState: {
            tasks: [
              { id: 'task-1', description: 'Create user model' },
              { id: 'task-2', description: 'Implement CRUD endpoints' },
              { id: 'task-3', description: 'Add authentication middleware' },
            ],
          },
          duration: 1000,
          turns: 1,
        });

        await node.execute(context);

        expect(mockAiQuery).toHaveBeenCalled();
        const callArgs = mockAiQuery.mock.calls[0][0];
        expect(callArgs.prompt).toContain('Build a REST API for user management');
      });

      it('should decompose prompt into multiple tasks', async () => {
        context.inputs = { prompt: 'Implement user authentication system' };

        mockAiQuery.mockResolvedValue({
          finalState: {
            tasks: [
              { id: 'task-1', description: 'Implement login' },
              { id: 'task-2', description: 'Implement logout' },
              { id: 'task-3', description: 'Implement session management' },
            ],
          },
          duration: 1000,
          turns: 1,
        });

        // Use custom subgraph executor to track executed tasks
        const executedTasks: Task[] = [];
        node.setSubgraphExecutor(async (task: Task) => {
          executedTasks.push(task);
          return { success: true, output: { taskId: task.id } };
        });

        const result = await node.execute(context);

        expect(result.success).toBe(true);
        expect(executedTasks.length).toBe(3);
        expect(executedTasks[0].description).toBe('Implement login');
        expect(executedTasks[1].description).toBe('Implement logout');
        expect(executedTasks[2].description).toBe('Implement session management');
      });

      it('should handle AI decomposition failure gracefully', async () => {
        context.inputs = { prompt: 'Some development request' };

        mockAiQuery.mockRejectedValue(new Error('AI service unavailable'));

        const result = await node.execute(context);

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('AI');
      });

      it('should handle empty task list from AI', async () => {
        context.inputs = { prompt: 'Vague request' };

        mockAiQuery.mockResolvedValue({
          finalState: { tasks: [] },
          duration: 1000,
          turns: 1,
        });

        const result = await node.execute(context);

        expect(result.success).toBe(true);
        expect(result.outputs.results).toEqual([]);
      });

      it('should generate unique task IDs if not provided by AI', async () => {
        context.inputs = { prompt: 'Build feature X' };

        mockAiQuery.mockResolvedValue({
          finalState: {
            tasks: [
              { description: 'Task without ID 1' },
              { description: 'Task without ID 2' },
            ],
          },
          duration: 1000,
          turns: 1,
        });

        const executedTasks: Task[] = [];
        node.setSubgraphExecutor(async (task: Task) => {
          executedTasks.push(task);
          return { success: true, output: {} };
        });

        await node.execute(context);

        // Each task should have a unique ID
        expect(executedTasks[0].id).toBeDefined();
        expect(executedTasks[1].id).toBeDefined();
        expect(executedTasks[0].id).not.toBe(executedTasks[1].id);
      });
    });

    describe('Integration with Worktree', () => {
      let mockGitManager: IGitWorktreeManager;
      let worktreeMockAiQuery: jest.Mock;

      beforeEach(() => {
        node = createParallelGroupNode('pg-decompose-wt', {
          useWorktree: true,
          branchPrefix: 'feature',
          cleanupAfter: true,
        });
        node.setSubgraph(createMockSubgraph());
        node.setConnectedInputs(['prompt']);

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

        worktreeMockAiQuery = jest.fn().mockResolvedValue({
          finalState: { tasks: [] },
          duration: 100,
          turns: 1,
        });

        context = createMockExecutionContext({
          services: {
            gitManager: mockGitManager,
            aiProvider: { query: worktreeMockAiQuery },
          },
        });
      });

      it('should create worktrees for each decomposed task', async () => {
        context.inputs = { prompt: 'Build authentication system' };

        worktreeMockAiQuery.mockResolvedValue({
          finalState: {
            tasks: [
              { id: 'auth-1', description: 'Login feature' },
              { id: 'auth-2', description: 'Logout feature' },
            ],
          },
          duration: 1000,
          turns: 1,
        });

        await node.execute(context);

        expect(mockGitManager.createWorktree).toHaveBeenCalledTimes(2);
      });

      it('should merge and cleanup worktrees after task completion', async () => {
        context.inputs = { prompt: 'Build feature' };

        worktreeMockAiQuery.mockResolvedValue({
          finalState: {
            tasks: [{ id: 'task-1', description: 'Single task' }],
          },
          duration: 1000,
          turns: 1,
        });

        await node.execute(context);

        expect(mockGitManager.merge).toHaveBeenCalled();
        expect(mockGitManager.removeWorktree).toHaveBeenCalled();
      });
    });

    describe('Custom Task Decomposer', () => {
      it('should allow setting custom task decomposer for testing', async () => {
        context.inputs = { prompt: 'Custom decomposition test' };

        const customTasks: Task[] = [
          { id: 'custom-1', description: 'Custom task 1' },
          { id: 'custom-2', description: 'Custom task 2' },
        ];

        node.setTaskDecomposer(async (_prompt: string) => customTasks);

        const executedTasks: Task[] = [];
        node.setSubgraphExecutor(async (task: Task) => {
          executedTasks.push(task);
          return { success: true, output: {} };
        });

        await node.execute(context);

        expect(executedTasks).toEqual(customTasks);
      });
    });
  });
});
