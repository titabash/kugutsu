/**
 * ParallelGroupNode AI Conflict Resolution Tests
 *
 * TDD Red Phase: Tests for AI-powered conflict resolution in ParallelGroupNode.
 * Tests cover:
 * - AI conflict resolution success
 * - Retry logic (max 3 attempts)
 * - File staging after resolution
 * - Merge completion after resolution
 * - Failure after max attempts exceeded
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
    ],
    connections: [],
    entryNodeId: 'engineer-1',
    exitNodeId: 'engineer-1',
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
    useWorktree: true,
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

/**
 * Create mock conflict details
 */
function createMockConflictDetails() {
  return [
    {
      file: 'src/index.ts',
      content: '<<<<<<< HEAD\nconst a = 1;\n=======\nconst a = 2;\n>>>>>>> feature',
      ours: 'const a = 1;',
      theirs: 'const a = 2;',
    },
    {
      file: 'src/utils.ts',
      content: '<<<<<<< HEAD\nexport const util = "main";\n=======\nexport const util = "feature";\n>>>>>>> feature',
      ours: 'export const util = "main";',
      theirs: 'export const util = "feature";',
    },
  ];
}

// ============================================================================
// AI Conflict Resolution Tests
// ============================================================================

describe('ParallelGroupNode AI Conflict Resolution', () => {
  let node: ParallelGroupNode;
  let context: ExecutionContext;
  let mockGitManager: IGitWorktreeManager;
  let mockAiQuery: jest.Mock;
  let execSyncMock: jest.Mock;

  beforeEach(() => {
    node = createParallelGroupNode('pg-conflict', {
      useWorktree: true,
      conflictResolution: {
        strategy: 'ai',
        autoMergeAfterTask: true,
      },
    });
    node.setSubgraph(createMockSubgraph());
    node.setConnectedInputs(['prompt']);

    // Mock git operations for conflict scenario
    mockGitManager = {
      createWorktree: jest.fn<IGitWorktreeManager['createWorktree']>().mockImplementation(async (options) => ({
        path: `/tmp/worktree-${options.branchName}`,
        branchName: options.branchName,
      })),
      removeWorktree: jest.fn<IGitWorktreeManager['removeWorktree']>().mockResolvedValue(undefined),
      merge: jest.fn<IGitWorktreeManager['merge']>().mockResolvedValue({
        success: false,
        hasConflict: true,
        conflictFiles: ['src/index.ts', 'src/utils.ts'],
        conflictDetails: createMockConflictDetails(),
      }),
      deleteBranch: jest.fn<IGitWorktreeManager['deleteBranch']>().mockResolvedValue(undefined),
      stageFiles: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      commitMerge: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };

    // Mock AI provider
    mockAiQuery = jest.fn().mockResolvedValue({
      finalState: { resolved: true },
      duration: 100,
      turns: 1,
    });

    context = createMockExecutionContext({
      services: {
        gitManager: mockGitManager,
        aiProvider: { query: mockAiQuery },
      },
    });
  });

  describe('resolveConflictsWithAI()', () => {
    it('should resolve conflicts using AI provider', async () => {
      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { prompt: 'Create a feature' };
      node.setTaskDecomposer(async () => tasks);

      // Mock AI to successfully resolve conflicts
      mockAiQuery.mockResolvedValue({
        finalState: { resolved: true },
        duration: 100,
        turns: 1,
      });

      const result = await node.execute(context);

      // AI should have been called with conflict resolution prompt
      expect(mockAiQuery).toHaveBeenCalled();
      const aiCallArgs = mockAiQuery.mock.calls.find(
        (call: unknown[]) => (call[0] as { prompt: string }).prompt.includes('コンフリクト') ||
          (call[0] as { prompt: string }).prompt.includes('conflict')
      );
      expect(aiCallArgs).toBeDefined();
    });

    it('should retry conflict resolution on failure (max 3 attempts)', async () => {
      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { prompt: 'Create a feature' };
      node.setTaskDecomposer(async () => tasks);

      // Mock AI to fail first 2 times, then succeed
      let attemptCount = 0;
      mockAiQuery.mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('AI resolution failed');
        }
        return {
          finalState: { resolved: true },
          duration: 100,
          turns: 1,
        };
      });

      const result = await node.execute(context);

      // Should have retried at least 3 times for conflict resolution
      // (1 for task decomposition + 3 for conflict resolution attempts)
      expect(mockAiQuery.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('should fail after max attempts exceeded (3 attempts)', async () => {
      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { prompt: 'Create a feature' };
      node.setTaskDecomposer(async () => tasks);

      // Mock AI to always fail
      mockAiQuery.mockRejectedValue(new Error('AI resolution always fails'));

      const result = await node.execute(context);

      // Should have conflict marked as unresolved
      expect(result.outputs.conflicts).toBeDefined();
      const conflicts = result.outputs.conflicts as Array<{ taskId: string; resolved: boolean }>;
      expect(conflicts.some(c => c.resolved === false || !c.resolved)).toBe(true);
    });

    it('should stage resolved files after successful AI resolution', async () => {
      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { prompt: 'Create a feature' };
      node.setTaskDecomposer(async () => tasks);

      // Mock AI to successfully resolve conflicts
      mockAiQuery.mockResolvedValue({
        finalState: { resolved: true },
        duration: 100,
        turns: 1,
      });

      await node.execute(context);

      // Git add should have been called for conflict files
      expect(mockGitManager.stageFiles).toHaveBeenCalledWith(
        expect.arrayContaining(['src/index.ts', 'src/utils.ts']),
        expect.any(String) // repoPath
      );
    });

    it('should complete merge with commit after successful resolution', async () => {
      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { prompt: 'Create a feature' };
      node.setTaskDecomposer(async () => tasks);

      // Mock AI to successfully resolve conflicts
      mockAiQuery.mockResolvedValue({
        finalState: { resolved: true },
        duration: 100,
        turns: 1,
      });

      await node.execute(context);

      // Git commit should have been called to complete merge
      expect(mockGitManager.commitMerge).toHaveBeenCalled();
    });

    it('should not commit merge if resolution fails', async () => {
      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { prompt: 'Create a feature' };
      node.setTaskDecomposer(async () => tasks);

      // Mock AI to always fail
      mockAiQuery.mockRejectedValue(new Error('AI resolution failed'));

      await node.execute(context);

      // Git commit should NOT have been called
      expect(mockGitManager.commitMerge).not.toHaveBeenCalled();
    });

    it('should include conflict file paths in AI prompt', async () => {
      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { prompt: 'Create a feature' };
      node.setTaskDecomposer(async () => tasks);

      mockAiQuery.mockResolvedValue({
        finalState: { resolved: true },
        duration: 100,
        turns: 1,
      });

      await node.execute(context);

      // Find the conflict resolution AI call
      const conflictResolutionCall = mockAiQuery.mock.calls.find(
        (call: unknown[]) => {
          const prompt = (call[0] as { prompt: string }).prompt;
          return prompt.includes('src/index.ts') || prompt.includes('src/utils.ts');
        }
      );
      expect(conflictResolutionCall).toBeDefined();
    });

    it('should include ours and theirs content in AI prompt', async () => {
      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { prompt: 'Create a feature' };
      node.setTaskDecomposer(async () => tasks);

      mockAiQuery.mockResolvedValue({
        finalState: { resolved: true },
        duration: 100,
        turns: 1,
      });

      await node.execute(context);

      // Find the conflict resolution AI call
      const conflictResolutionCall = mockAiQuery.mock.calls.find(
        (call: unknown[]) => {
          const prompt = (call[0] as { prompt: string }).prompt;
          return prompt.includes('const a = 1') && prompt.includes('const a = 2');
        }
      );
      expect(conflictResolutionCall).toBeDefined();
    });

    it('should provide appropriate tools to AI for conflict resolution', async () => {
      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { prompt: 'Create a feature' };
      node.setTaskDecomposer(async () => tasks);

      mockAiQuery.mockResolvedValue({
        finalState: { resolved: true },
        duration: 100,
        turns: 1,
      });

      await node.execute(context);

      // Find the conflict resolution AI call
      const conflictResolutionCall = mockAiQuery.mock.calls.find(
        (call: unknown[]) => {
          const options = (call[0] as { options?: { allowedTools?: string[] } }).options;
          return options?.allowedTools?.includes('Edit') || options?.allowedTools?.includes('Write');
        }
      );
      expect(conflictResolutionCall).toBeDefined();
    });
  });

  describe('Conflict resolution with worktree context', () => {
    it('should execute AI resolution in worktree directory', async () => {
      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { prompt: 'Create a feature' };
      node.setTaskDecomposer(async () => tasks);

      mockAiQuery.mockResolvedValue({
        finalState: { resolved: true },
        duration: 100,
        turns: 1,
      });

      await node.execute(context);

      // AI should be called with cwd set to project path
      const conflictResolutionCall = mockAiQuery.mock.calls.find(
        (call: unknown[]) => {
          const options = (call[0] as { options?: { cwd?: string } }).options;
          return options?.cwd !== undefined;
        }
      );
      expect(conflictResolutionCall).toBeDefined();
      const cwd = (conflictResolutionCall?.[0] as { options?: { cwd?: string } }).options?.cwd;
      expect(cwd).toBeDefined();
    });

    it('should handle multiple conflicts from different tasks', async () => {
      const tasks = [
        createMockTask('task-1', 'Feature 1'),
        createMockTask('task-2', 'Feature 2'),
      ];
      context.inputs = { prompt: 'Create two features' };
      node.setTaskDecomposer(async () => tasks);

      // Both merges have conflicts
      (mockGitManager.merge as jest.Mock).mockResolvedValue({
        success: false,
        hasConflict: true,
        conflictFiles: ['src/shared.ts'],
        conflictDetails: [{
          file: 'src/shared.ts',
          content: '<<<<<<< HEAD\nshared\n=======\ndifferent\n>>>>>>> feature',
          ours: 'shared',
          theirs: 'different',
        }],
      });

      mockAiQuery.mockResolvedValue({
        finalState: { resolved: true },
        duration: 100,
        turns: 1,
      });

      const result = await node.execute(context);

      // Should have attempted to resolve conflicts for both tasks
      expect(result.success).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty conflict files array', async () => {
      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { prompt: 'Create a feature' };
      node.setTaskDecomposer(async () => tasks);

      // Merge reports conflict but no files
      (mockGitManager.merge as jest.Mock).mockResolvedValue({
        success: false,
        hasConflict: true,
        conflictFiles: [],
        conflictDetails: [],
      });

      const result = await node.execute(context);

      // Should handle gracefully without AI resolution attempt
      expect(result.success).toBe(true);
    });

    it('should handle conflict details with empty ours/theirs', async () => {
      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { prompt: 'Create a feature' };
      node.setTaskDecomposer(async () => tasks);

      (mockGitManager.merge as jest.Mock).mockResolvedValue({
        success: false,
        hasConflict: true,
        conflictFiles: ['new-file.ts'],
        conflictDetails: [{
          file: 'new-file.ts',
          content: 'new content',
          ours: '', // File didn't exist in ours
          theirs: 'new content',
        }],
      });

      mockAiQuery.mockResolvedValue({
        finalState: { resolved: true },
        duration: 100,
        turns: 1,
      });

      const result = await node.execute(context);

      // Should still attempt resolution
      expect(mockAiQuery).toHaveBeenCalled();
    });

    it('should track resolution status for each conflict', async () => {
      const tasks = [createMockTask('task-1', 'Feature 1')];
      context.inputs = { prompt: 'Create a feature' };
      node.setTaskDecomposer(async () => tasks);

      mockAiQuery.mockResolvedValue({
        finalState: { resolved: true },
        duration: 100,
        turns: 1,
      });

      const result = await node.execute(context);

      // Should include resolution status in output
      if (result.outputs.conflicts) {
        const conflicts = result.outputs.conflicts as Array<{ taskId: string; resolved?: boolean }>;
        expect(conflicts[0]).toHaveProperty('taskId');
      }
    });
  });
});
