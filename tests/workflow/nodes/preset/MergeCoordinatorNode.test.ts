/**
 * MergeCoordinatorNode Tests
 *
 * Phase 3.2: Preset Merge Coordinator Node implementation
 * TDD Red Phase: These tests define expected behavior for the merge coordinator node
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MergeCoordinatorNode, type MergeCoordinatorNodeConfig } from '../../../../src/workflow/nodes/preset/MergeCoordinatorNode.js';
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
          result: 'Merge analysis complete',
          mergeStrategy: 'sequential',
          mergeOrder: ['branch-1', 'branch-2', 'branch-3'],
        },
        duration: 200,
        turns: 2,
        tokensUsed: 100,
      }),
    },
    gitManager: {
      createWorktree: jest.fn().mockResolvedValue({
        path: '/mock/worktree',
        branchName: 'feature/test-branch',
      }),
      removeWorktree: jest.fn().mockResolvedValue(undefined),
      merge: jest.fn().mockResolvedValue({ success: true, hasConflict: false }),
      getBranches: jest.fn().mockResolvedValue(['main', 'feature-1', 'feature-2']),
      checkoutBranch: jest.fn().mockResolvedValue(undefined),
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
// MergeCoordinatorNode Construction Tests
// ============================================================================

describe('MergeCoordinatorNode', () => {
  describe('Construction', () => {
    it('should create MergeCoordinatorNode with correct type', () => {
      const node = new MergeCoordinatorNode('mc-1', {});

      expect(node.id).toBe('mc-1');
      expect(node.type).toBe('preset:merge-coordinator');
    });

    it('should have default label "Merge Coordinator"', () => {
      const node = new MergeCoordinatorNode('mc-2', {});

      expect(node.label).toBe('Merge Coordinator');
    });

    it('should allow custom label', () => {
      const node = new MergeCoordinatorNode('mc-3', {
        label: 'Release Coordinator',
      });

      expect(node.label).toBe('Release Coordinator');
    });

    it('should have branches input socket', () => {
      const node = new MergeCoordinatorNode('mc-4', {});
      const json = node.toJSON();

      const branchesInput = json.inputs.find(i => i.id === 'branches');
      expect(branchesInput).toBeDefined();
      expect(branchesInput?.type).toBe('data');
      expect(branchesInput?.dataType).toBe('array');
      expect(branchesInput?.required).toBe(true);
    });

    it('should have targetBranch input socket', () => {
      const node = new MergeCoordinatorNode('mc-5', {});
      const json = node.toJSON();

      const targetInput = json.inputs.find(i => i.id === 'targetBranch');
      expect(targetInput).toBeDefined();
      expect(targetInput?.dataType).toBe('string');
    });

    it('should have results input socket for merge results', () => {
      const node = new MergeCoordinatorNode('mc-6', {});
      const json = node.toJSON();

      const resultsInput = json.inputs.find(i => i.id === 'results');
      expect(resultsInput).toBeDefined();
      expect(resultsInput?.required).toBe(false);
    });

    it('should have mergeStatus output socket', () => {
      const node = new MergeCoordinatorNode('mc-7', {});
      const json = node.toJSON();

      const statusOutput = json.outputs.find(o => o.id === 'mergeStatus');
      expect(statusOutput).toBeDefined();
      expect(statusOutput?.type).toBe('data');
    });

    it('should have conflicts output socket', () => {
      const node = new MergeCoordinatorNode('mc-8', {});
      const json = node.toJSON();

      const conflictsOutput = json.outputs.find(o => o.id === 'conflicts');
      expect(conflictsOutput).toBeDefined();
      expect(conflictsOutput?.dataType).toBe('array');
    });

    it('should have mergedBranches output socket', () => {
      const node = new MergeCoordinatorNode('mc-9', {});
      const json = node.toJSON();

      const mergedOutput = json.outputs.find(o => o.id === 'mergedBranches');
      expect(mergedOutput).toBeDefined();
    });
  });

  describe('Default Configuration', () => {
    it('should have merge-coordinator-focused system prompt', () => {
      const node = new MergeCoordinatorNode('mc-10', {});

      expect(node.config.ai?.systemPrompt).toBeDefined();
      expect(node.config.ai?.systemPrompt?.toLowerCase()).toContain('merge');
    });

    it('should have default merge strategy', () => {
      const node = new MergeCoordinatorNode('mc-11', {});

      expect(node.config.mergeStrategy).toBeDefined();
    });

    it('should support sequential merge strategy', () => {
      const node = new MergeCoordinatorNode('mc-12', {
        mergeStrategy: 'sequential',
      });

      expect(node.config.mergeStrategy).toBe('sequential');
    });

    it('should support parallel merge strategy', () => {
      const node = new MergeCoordinatorNode('mc-13', {
        mergeStrategy: 'parallel',
      });

      expect(node.config.mergeStrategy).toBe('parallel');
    });

    it('should support ai-driven merge strategy', () => {
      const node = new MergeCoordinatorNode('mc-14', {
        mergeStrategy: 'ai-driven',
      });

      expect(node.config.mergeStrategy).toBe('ai-driven');
    });

    it('should default to sequential merge strategy', () => {
      const node = new MergeCoordinatorNode('mc-15', {});

      expect(node.config.mergeStrategy).toBe('sequential');
    });
  });

  describe('Conflict Resolution Configuration', () => {
    it('should support auto conflict resolution mode', () => {
      const node = new MergeCoordinatorNode('mc-16', {
        conflictResolution: 'auto',
      });

      expect(node.config.conflictResolution).toBe('auto');
    });

    it('should support manual conflict resolution mode', () => {
      const node = new MergeCoordinatorNode('mc-17', {
        conflictResolution: 'manual',
      });

      expect(node.config.conflictResolution).toBe('manual');
    });

    it('should support ai-assisted conflict resolution mode', () => {
      const node = new MergeCoordinatorNode('mc-18', {
        conflictResolution: 'ai-assisted',
      });

      expect(node.config.conflictResolution).toBe('ai-assisted');
    });

    it('should default to ai-assisted conflict resolution', () => {
      const node = new MergeCoordinatorNode('mc-19', {});

      expect(node.config.conflictResolution).toBe('ai-assisted');
    });
  });
});

// ============================================================================
// MergeCoordinatorNode Execution Tests
// ============================================================================

describe('MergeCoordinatorNode Execution', () => {
  let mockServices: Services;
  let mockUtils: Utils;

  beforeEach(() => {
    mockServices = createMockServices();
    mockUtils = createMockUtils();
  });

  describe('Basic Execution', () => {
    it('should execute with branches input', async () => {
      const node = new MergeCoordinatorNode('mc-exec-1', {});
      const context = createMockContext({
        branches: ['feature-1', 'feature-2', 'feature-3'],
        targetBranch: 'main',
      });

      const result = await node.execute(context);

      expect(result.success).toBe(true);
    });

    it('should call gitManager merge for each branch', async () => {
      const node = new MergeCoordinatorNode('mc-exec-2', {
        mergeStrategy: 'sequential',
      });
      const context = createMockContext({
        branches: ['feature-1', 'feature-2'],
        targetBranch: 'main',
      });

      await node.execute(context);

      expect(context.services.gitManager.merge).toHaveBeenCalled();
    });

    it('should use target branch from input', async () => {
      const node = new MergeCoordinatorNode('mc-exec-3', {});
      const context = createMockContext({
        branches: ['feature-1'],
        targetBranch: 'develop',
      });

      await node.execute(context);

      expect(context.services.gitManager.merge).toHaveBeenCalledWith(
        expect.objectContaining({
          targetBranch: 'develop',
        })
      );
    });

    it('should use baseBranch from global context when targetBranch not provided', async () => {
      const node = new MergeCoordinatorNode('mc-exec-4', {});
      const context = createMockContext({
        branches: ['feature-1'],
      });
      context.global.baseBranch = 'main';

      await node.execute(context);

      expect(context.services.gitManager.merge).toHaveBeenCalledWith(
        expect.objectContaining({
          targetBranch: 'main',
        })
      );
    });
  });

  describe('Sequential Merge Strategy', () => {
    it('should merge branches sequentially', async () => {
      const node = new MergeCoordinatorNode('mc-seq-1', {
        mergeStrategy: 'sequential',
      });
      const context = createMockContext({
        branches: ['feature-1', 'feature-2', 'feature-3'],
        targetBranch: 'main',
      });

      await node.execute(context);

      // Should be called 3 times sequentially
      expect(context.services.gitManager.merge).toHaveBeenCalledTimes(3);
    });

    it('should stop on first conflict in sequential mode', async () => {
      const node = new MergeCoordinatorNode('mc-seq-2', {
        mergeStrategy: 'sequential',
        stopOnConflict: true,
      });
      const context = createMockContext({
        branches: ['feature-1', 'feature-2', 'feature-3'],
        targetBranch: 'main',
      });

      // First merge succeeds, second has conflict
      (context.services.gitManager.merge as jest.Mock)
        .mockResolvedValueOnce({ success: true, hasConflict: false })
        .mockResolvedValueOnce({ success: false, hasConflict: true, conflictFiles: ['src/app.ts'] });

      const result = await node.execute(context);

      expect(result.outputs.conflicts).toBeDefined();
      expect((result.outputs.conflicts as unknown[]).length).toBeGreaterThan(0);
    });
  });

  describe('AI-Driven Merge Strategy', () => {
    it('should use AI to determine merge order', async () => {
      const node = new MergeCoordinatorNode('mc-ai-1', {
        mergeStrategy: 'ai-driven',
      });
      const context = createMockContext({
        branches: ['feature-1', 'feature-2', 'feature-3'],
        targetBranch: 'main',
      });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalled();
    });

    it('should include branch information in AI prompt', async () => {
      const node = new MergeCoordinatorNode('mc-ai-2', {
        mergeStrategy: 'ai-driven',
      });
      const context = createMockContext({
        branches: ['auth-feature', 'payment-feature'],
        targetBranch: 'main',
      });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('auth-feature'),
        })
      );
    });
  });

  describe('Conflict Handling', () => {
    it('should return conflicts in output', async () => {
      const node = new MergeCoordinatorNode('mc-conflict-1', {});
      const context = createMockContext({
        branches: ['feature-1'],
        targetBranch: 'main',
      });
      (context.services.gitManager.merge as jest.Mock).mockResolvedValue({
        success: false,
        hasConflict: true,
        conflictFiles: ['src/index.ts', 'src/app.ts'],
      });

      const result = await node.execute(context);

      expect(result.outputs.conflicts).toBeDefined();
      expect(Array.isArray(result.outputs.conflicts)).toBe(true);
    });

    it('should include conflict details', async () => {
      const node = new MergeCoordinatorNode('mc-conflict-2', {});
      const context = createMockContext({
        branches: ['feature-1'],
        targetBranch: 'main',
      });
      (context.services.gitManager.merge as jest.Mock).mockResolvedValue({
        success: false,
        hasConflict: true,
        conflictFiles: ['src/index.ts'],
        conflictDetails: {
          'src/index.ts': { ours: 'content', theirs: 'content' },
        },
      });

      const result = await node.execute(context);

      const conflicts = result.outputs.conflicts as { branch: string }[];
      expect(conflicts[0]).toHaveProperty('branch');
    });

    it('should emit merge-conflict event on conflict', async () => {
      const node = new MergeCoordinatorNode('mc-conflict-3', {});
      const context = createMockContext({
        branches: ['feature-1'],
        targetBranch: 'main',
      });
      (context.services.gitManager.merge as jest.Mock).mockResolvedValue({
        success: false,
        hasConflict: true,
        conflictFiles: ['src/index.ts'],
      });

      await node.execute(context);

      expect(context.utils.emit).toHaveBeenCalledWith(
        'merge-conflict',
        expect.objectContaining({
          nodeId: 'mc-conflict-3',
        })
      );
    });
  });

  describe('Result Handling', () => {
    it('should return merged branches list', async () => {
      const node = new MergeCoordinatorNode('mc-result-1', {});
      const context = createMockContext({
        branches: ['feature-1', 'feature-2'],
        targetBranch: 'main',
      });

      const result = await node.execute(context);

      expect(result.outputs.mergedBranches).toBeDefined();
      expect(Array.isArray(result.outputs.mergedBranches)).toBe(true);
    });

    it('should return merge status summary', async () => {
      const node = new MergeCoordinatorNode('mc-result-2', {});
      const context = createMockContext({
        branches: ['feature-1', 'feature-2'],
        targetBranch: 'main',
      });

      const result = await node.execute(context);

      expect(result.outputs.mergeStatus).toBeDefined();
    });

    it('should include metadata with duration', async () => {
      const node = new MergeCoordinatorNode('mc-result-3', {});
      const context = createMockContext({
        branches: ['feature-1'],
        targetBranch: 'main',
      });

      const result = await node.execute(context);

      expect(result.metadata?.duration).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing branches input', async () => {
      const node = new MergeCoordinatorNode('mc-err-1', {});
      const context = createMockContext({});

      const result = await node.execute(context);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('branches');
    });

    it('should handle empty branches array', async () => {
      const node = new MergeCoordinatorNode('mc-err-2', {});
      const context = createMockContext({
        branches: [],
        targetBranch: 'main',
      });

      const result = await node.execute(context);

      expect(result.success).toBe(true);
      expect(result.outputs.mergedBranches).toEqual([]);
    });

    it('should handle git merge errors', async () => {
      const node = new MergeCoordinatorNode('mc-err-3', {});
      const context = createMockContext({
        branches: ['feature-1'],
        targetBranch: 'main',
      });
      (context.services.gitManager.merge as jest.Mock).mockRejectedValue(
        new Error('Git merge failed: permission denied')
      );

      const result = await node.execute(context);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Git merge failed');
    });
  });

  describe('Branch Cleanup', () => {
    it('should cleanup branches after merge when configured', async () => {
      const node = new MergeCoordinatorNode('mc-cleanup-1', {
        cleanupBranches: true,
      });
      const context = createMockContext({
        branches: ['feature-1', 'feature-2'],
        targetBranch: 'main',
      });

      await node.execute(context);

      expect(context.services.gitManager.deleteBranch).toHaveBeenCalled();
    });

    it('should not cleanup branches when not configured', async () => {
      const node = new MergeCoordinatorNode('mc-cleanup-2', {
        cleanupBranches: false,
      });
      const context = createMockContext({
        branches: ['feature-1'],
        targetBranch: 'main',
      });

      await node.execute(context);

      expect(context.services.gitManager.deleteBranch).not.toHaveBeenCalled();
    });
  });
});

// ============================================================================
// MergeCoordinatorNode Validation Tests
// ============================================================================

describe('MergeCoordinatorNode Validation', () => {
  it('should be valid with default configuration', () => {
    const node = new MergeCoordinatorNode('mc-val-1', {});
    node.setConnectedInputs(['branches']);
    const result = node.validate();

    expect(result.valid).toBe(true);
  });

  it('should be valid with sequential strategy', () => {
    const node = new MergeCoordinatorNode('mc-val-2', {
      mergeStrategy: 'sequential',
    });
    node.setConnectedInputs(['branches']);
    const result = node.validate();

    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// MergeCoordinatorNode Serialization Tests
// ============================================================================

describe('MergeCoordinatorNode Serialization', () => {
  it('should serialize to JSON correctly', () => {
    const node = new MergeCoordinatorNode('mc-serial-1', {
      mergeStrategy: 'sequential',
      conflictResolution: 'ai-assisted',
      cleanupBranches: true,
    });
    node.setPosition(200, 300);

    const json = node.toJSON();

    expect(json.id).toBe('mc-serial-1');
    expect(json.type).toBe('preset:merge-coordinator');
    expect(json.position).toEqual({ x: 200, y: 300 });
    expect(json.config.mergeStrategy).toBe('sequential');
  });

  it('should preserve all configuration in serialization', () => {
    const node = new MergeCoordinatorNode('mc-serial-2', {
      label: 'Custom Coordinator',
      mergeStrategy: 'ai-driven',
      conflictResolution: 'manual',
      cleanupBranches: false,
      stopOnConflict: true,
    });

    const json = node.toJSON();

    expect(json.label).toBe('Custom Coordinator');
    expect(json.config.mergeStrategy).toBe('ai-driven');
    expect(json.config.conflictResolution).toBe('manual');
  });
});

// ============================================================================
// MergeCoordinatorNode Event Tests
// ============================================================================

describe('MergeCoordinatorNode Events', () => {
  it('should emit merge-coordinator-started event', async () => {
    const node = new MergeCoordinatorNode('mc-event-1', {});
    const context = createMockContext({
      branches: ['feature-1'],
      targetBranch: 'main',
    });

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'merge-coordinator-started',
      expect.objectContaining({
        nodeId: 'mc-event-1',
      })
    );
  });

  it('should emit merge-coordinator-completed event on success', async () => {
    const node = new MergeCoordinatorNode('mc-event-2', {});
    const context = createMockContext({
      branches: ['feature-1'],
      targetBranch: 'main',
    });

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'merge-coordinator-completed',
      expect.objectContaining({
        nodeId: 'mc-event-2',
        success: true,
      })
    );
  });

  it('should emit merge-coordinator-error event on failure', async () => {
    const node = new MergeCoordinatorNode('mc-event-3', {});
    const context = createMockContext({
      branches: ['feature-1'],
      targetBranch: 'main',
    });
    (context.services.gitManager.merge as jest.Mock).mockRejectedValue(
      new Error('Failed')
    );

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'merge-coordinator-error',
      expect.objectContaining({
        nodeId: 'mc-event-3',
      })
    );
  });

  it('should emit branch-merged event for each successful merge', async () => {
    const node = new MergeCoordinatorNode('mc-event-4', {});
    const context = createMockContext({
      branches: ['feature-1', 'feature-2'],
      targetBranch: 'main',
    });

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'branch-merged',
      expect.objectContaining({
        nodeId: 'mc-event-4',
      })
    );
  });
});
