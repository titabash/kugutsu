/**
 * ConflictResolverNode Tests
 *
 * Phase 3.2: Preset Conflict Resolver Node implementation
 * TDD Red Phase: These tests define expected behavior for the conflict resolver node
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ConflictResolverNode, type ConflictResolverNodeConfig } from '../../../../src/workflow/nodes/preset/ConflictResolverNode.js';
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
          result: 'Conflict resolved',
          resolvedContent: 'merged content',
          resolution: {
            strategy: 'merge',
            chosenVersion: 'combined',
          },
        },
        duration: 300,
        turns: 3,
        tokensUsed: 200,
        fileChanges: [
          { path: 'src/conflict-file.ts', action: 'modified' },
        ],
      }),
    },
    gitManager: {
      createWorktree: jest.fn().mockResolvedValue({
        path: '/mock/worktree',
        branchName: 'conflict-resolution',
      }),
      removeWorktree: jest.fn().mockResolvedValue(undefined),
      merge: jest.fn().mockResolvedValue({ success: true, hasConflict: false }),
      getConflictedFiles: jest.fn().mockResolvedValue(['src/index.ts']),
      markResolved: jest.fn().mockResolvedValue(undefined),
      abortMerge: jest.fn().mockResolvedValue(undefined),
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
// ConflictResolverNode Construction Tests
// ============================================================================

describe('ConflictResolverNode', () => {
  describe('Construction', () => {
    it('should create ConflictResolverNode with correct type', () => {
      const node = new ConflictResolverNode('cr-1', {});

      expect(node.id).toBe('cr-1');
      expect(node.type).toBe('preset:conflict-resolver');
    });

    it('should have default label "Conflict Resolver"', () => {
      const node = new ConflictResolverNode('cr-2', {});

      expect(node.label).toBe('Conflict Resolver');
    });

    it('should allow custom label', () => {
      const node = new ConflictResolverNode('cr-3', {
        label: 'AI Merge Assistant',
      });

      expect(node.label).toBe('AI Merge Assistant');
    });

    it('should have conflict input socket', () => {
      const node = new ConflictResolverNode('cr-4', {});
      const json = node.toJSON();

      const conflictInput = json.inputs.find(i => i.id === 'conflict');
      expect(conflictInput).toBeDefined();
      expect(conflictInput?.type).toBe('data');
      expect(conflictInput?.required).toBe(true);
    });

    it('should have context input socket for additional info', () => {
      const node = new ConflictResolverNode('cr-5', {});
      const json = node.toJSON();

      const contextInput = json.inputs.find(i => i.id === 'context');
      expect(contextInput).toBeDefined();
      expect(contextInput?.required).toBe(false);
    });

    it('should have preferences input socket', () => {
      const node = new ConflictResolverNode('cr-6', {});
      const json = node.toJSON();

      const prefsInput = json.inputs.find(i => i.id === 'preferences');
      expect(prefsInput).toBeDefined();
    });

    it('should have resolution output socket', () => {
      const node = new ConflictResolverNode('cr-7', {});
      const json = node.toJSON();

      const resOutput = json.outputs.find(o => o.id === 'resolution');
      expect(resOutput).toBeDefined();
      expect(resOutput?.type).toBe('data');
    });

    it('should have resolvedFiles output socket', () => {
      const node = new ConflictResolverNode('cr-8', {});
      const json = node.toJSON();

      const filesOutput = json.outputs.find(o => o.id === 'resolvedFiles');
      expect(filesOutput).toBeDefined();
      expect(filesOutput?.dataType).toBe('array');
    });

    it('should have success output socket', () => {
      const node = new ConflictResolverNode('cr-9', {});
      const json = node.toJSON();

      const successOutput = json.outputs.find(o => o.id === 'success');
      expect(successOutput).toBeDefined();
      expect(successOutput?.dataType).toBe('boolean');
    });
  });

  describe('Default Configuration', () => {
    it('should have conflict-resolution-focused system prompt', () => {
      const node = new ConflictResolverNode('cr-10', {});

      expect(node.config.ai?.systemPrompt).toBeDefined();
      expect(node.config.ai?.systemPrompt?.toLowerCase()).toContain('conflict');
    });

    it('should have default allowed tools for resolution', () => {
      const node = new ConflictResolverNode('cr-11', {});

      const allowedTools = node.config.ai?.allowedTools ?? [];
      expect(allowedTools).toContain('Read');
      expect(allowedTools).toContain('Write');
      expect(allowedTools).toContain('Edit');
    });

    it('should have reasonable default maxTurns', () => {
      const node = new ConflictResolverNode('cr-12', {});

      expect(node.config.ai?.maxTurns).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Resolution Strategy Configuration', () => {
    it('should support ai-driven resolution strategy', () => {
      const node = new ConflictResolverNode('cr-13', {
        resolutionStrategy: 'ai-driven',
      });

      expect(node.config.resolutionStrategy).toBe('ai-driven');
    });

    it('should support ours resolution strategy', () => {
      const node = new ConflictResolverNode('cr-14', {
        resolutionStrategy: 'ours',
      });

      expect(node.config.resolutionStrategy).toBe('ours');
    });

    it('should support theirs resolution strategy', () => {
      const node = new ConflictResolverNode('cr-15', {
        resolutionStrategy: 'theirs',
      });

      expect(node.config.resolutionStrategy).toBe('theirs');
    });

    it('should default to ai-driven resolution strategy', () => {
      const node = new ConflictResolverNode('cr-16', {});

      expect(node.config.resolutionStrategy).toBe('ai-driven');
    });
  });
});

// ============================================================================
// ConflictResolverNode Execution Tests
// ============================================================================

describe('ConflictResolverNode Execution', () => {
  let mockServices: Services;
  let mockUtils: Utils;

  beforeEach(() => {
    mockServices = createMockServices();
    mockUtils = createMockUtils();
  });

  describe('Basic Execution', () => {
    it('should execute with conflict input', async () => {
      const node = new ConflictResolverNode('cr-exec-1', {});
      const context = createMockContext({
        conflict: {
          branch: 'feature-1',
          targetBranch: 'main',
          conflictFiles: ['src/index.ts'],
        },
      });

      const result = await node.execute(context);

      expect(result.success).toBe(true);
    });

    it('should call AI provider for resolution', async () => {
      const node = new ConflictResolverNode('cr-exec-2', {
        resolutionStrategy: 'ai-driven',
      });
      const context = createMockContext({
        conflict: {
          branch: 'feature-1',
          targetBranch: 'main',
          conflictFiles: ['src/index.ts'],
        },
      });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalled();
    });

    it('should include conflict details in AI prompt', async () => {
      const node = new ConflictResolverNode('cr-exec-3', {});
      const context = createMockContext({
        conflict: {
          branch: 'feature-auth',
          targetBranch: 'main',
          conflictFiles: ['src/auth.ts', 'src/login.ts'],
          conflictDetails: {
            'src/auth.ts': {
              ours: 'const auth = "ours";',
              theirs: 'const auth = "theirs";',
            },
          },
        },
      });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('src/auth.ts'),
        })
      );
    });
  });

  describe('Resolution Strategies', () => {
    it('should use AI for ai-driven strategy', async () => {
      const node = new ConflictResolverNode('cr-strat-1', {
        resolutionStrategy: 'ai-driven',
      });
      const context = createMockContext({
        conflict: {
          branch: 'feature-1',
          targetBranch: 'main',
          conflictFiles: ['src/file.ts'],
        },
      });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalled();
    });

    it('should prefer ours for ours strategy', async () => {
      const node = new ConflictResolverNode('cr-strat-2', {
        resolutionStrategy: 'ours',
      });
      const context = createMockContext({
        conflict: {
          branch: 'feature-1',
          targetBranch: 'main',
          conflictFiles: ['src/file.ts'],
        },
      });

      const result = await node.execute(context);

      expect(result.outputs.resolution).toBeDefined();
      expect((result.outputs.resolution as { strategy: string }).strategy).toBe('ours');
    });

    it('should prefer theirs for theirs strategy', async () => {
      const node = new ConflictResolverNode('cr-strat-3', {
        resolutionStrategy: 'theirs',
      });
      const context = createMockContext({
        conflict: {
          branch: 'feature-1',
          targetBranch: 'main',
          conflictFiles: ['src/file.ts'],
        },
      });

      const result = await node.execute(context);

      expect(result.outputs.resolution).toBeDefined();
      expect((result.outputs.resolution as { strategy: string }).strategy).toBe('theirs');
    });
  });

  describe('Context and Preferences', () => {
    it('should include context in resolution prompt', async () => {
      const node = new ConflictResolverNode('cr-ctx-1', {});
      const context = createMockContext({
        conflict: {
          branch: 'feature-1',
          targetBranch: 'main',
          conflictFiles: ['src/api.ts'],
        },
        context: {
          taskDescription: 'Add authentication to API endpoints',
          originalAuthor: 'dev@example.com',
        },
      });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('authentication'),
        })
      );
    });

    it('should respect preferences in resolution', async () => {
      const node = new ConflictResolverNode('cr-pref-1', {});
      const context = createMockContext({
        conflict: {
          branch: 'feature-1',
          targetBranch: 'main',
          conflictFiles: ['src/config.ts'],
        },
        preferences: {
          preferNewCode: true,
          preserveComments: true,
        },
      });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('prefer'),
        })
      );
    });
  });

  describe('Result Handling', () => {
    it('should return resolved files list', async () => {
      const node = new ConflictResolverNode('cr-result-1', {});
      const context = createMockContext({
        conflict: {
          branch: 'feature-1',
          targetBranch: 'main',
          conflictFiles: ['src/a.ts', 'src/b.ts'],
        },
      });

      const result = await node.execute(context);

      expect(result.outputs.resolvedFiles).toBeDefined();
      expect(Array.isArray(result.outputs.resolvedFiles)).toBe(true);
    });

    it('should return resolution details', async () => {
      const node = new ConflictResolverNode('cr-result-2', {});
      const context = createMockContext({
        conflict: {
          branch: 'feature-1',
          targetBranch: 'main',
          conflictFiles: ['src/file.ts'],
        },
      });

      const result = await node.execute(context);

      expect(result.outputs.resolution).toBeDefined();
    });

    it('should include metadata with duration and tokens', async () => {
      const node = new ConflictResolverNode('cr-result-3', {});
      const context = createMockContext({
        conflict: {
          branch: 'feature-1',
          targetBranch: 'main',
          conflictFiles: ['src/file.ts'],
        },
      });

      const result = await node.execute(context);

      expect(result.metadata?.duration).toBeDefined();
    });

    it('should return success status', async () => {
      const node = new ConflictResolverNode('cr-result-4', {});
      const context = createMockContext({
        conflict: {
          branch: 'feature-1',
          targetBranch: 'main',
          conflictFiles: ['src/file.ts'],
        },
      });

      const result = await node.execute(context);

      expect(result.outputs.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing conflict input', async () => {
      const node = new ConflictResolverNode('cr-err-1', {});
      const context = createMockContext({});

      const result = await node.execute(context);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('conflict');
    });

    it('should handle AI resolution failure', async () => {
      const node = new ConflictResolverNode('cr-err-2', {});
      const context = createMockContext({
        conflict: {
          branch: 'feature-1',
          targetBranch: 'main',
          conflictFiles: ['src/file.ts'],
        },
      });
      (context.services.aiProvider.query as jest.Mock).mockRejectedValue(
        new Error('AI service unavailable')
      );

      const result = await node.execute(context);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('AI service');
    });

    it('should handle empty conflict files', async () => {
      const node = new ConflictResolverNode('cr-err-3', {});
      const context = createMockContext({
        conflict: {
          branch: 'feature-1',
          targetBranch: 'main',
          conflictFiles: [],
        },
      });

      const result = await node.execute(context);

      // Empty conflict files should succeed (nothing to resolve)
      expect(result.success).toBe(true);
      expect(result.outputs.resolvedFiles).toEqual([]);
    });
  });
});

// ============================================================================
// ConflictResolverNode Validation Tests
// ============================================================================

describe('ConflictResolverNode Validation', () => {
  it('should be valid with default configuration', () => {
    const node = new ConflictResolverNode('cr-val-1', {});
    node.setConnectedInputs(['conflict']);
    const result = node.validate();

    expect(result.valid).toBe(true);
  });

  it('should be valid with custom strategy', () => {
    const node = new ConflictResolverNode('cr-val-2', {
      resolutionStrategy: 'ours',
    });
    node.setConnectedInputs(['conflict']);
    const result = node.validate();

    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// ConflictResolverNode Serialization Tests
// ============================================================================

describe('ConflictResolverNode Serialization', () => {
  it('should serialize to JSON correctly', () => {
    const node = new ConflictResolverNode('cr-serial-1', {
      resolutionStrategy: 'ai-driven',
      ai: {
        provider: 'claude',
        maxTurns: 20,
      },
    });
    node.setPosition(250, 350);

    const json = node.toJSON();

    expect(json.id).toBe('cr-serial-1');
    expect(json.type).toBe('preset:conflict-resolver');
    expect(json.position).toEqual({ x: 250, y: 350 });
    expect(json.config.resolutionStrategy).toBe('ai-driven');
  });

  it('should preserve all configuration in serialization', () => {
    const node = new ConflictResolverNode('cr-serial-2', {
      label: 'Custom Resolver',
      resolutionStrategy: 'theirs',
      ai: {
        provider: 'openai',
        model: 'gpt-4',
        maxTurns: 15,
      },
    });

    const json = node.toJSON();

    expect(json.label).toBe('Custom Resolver');
    expect(json.config.resolutionStrategy).toBe('theirs');
    expect(json.config.ai?.provider).toBe('openai');
  });
});

// ============================================================================
// ConflictResolverNode Event Tests
// ============================================================================

describe('ConflictResolverNode Events', () => {
  it('should emit conflict-resolver-started event', async () => {
    const node = new ConflictResolverNode('cr-event-1', {});
    const context = createMockContext({
      conflict: {
        branch: 'feature-1',
        targetBranch: 'main',
        conflictFiles: ['src/file.ts'],
      },
    });

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'conflict-resolver-started',
      expect.objectContaining({
        nodeId: 'cr-event-1',
      })
    );
  });

  it('should emit conflict-resolver-completed event on success', async () => {
    const node = new ConflictResolverNode('cr-event-2', {});
    const context = createMockContext({
      conflict: {
        branch: 'feature-1',
        targetBranch: 'main',
        conflictFiles: ['src/file.ts'],
      },
    });

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'conflict-resolver-completed',
      expect.objectContaining({
        nodeId: 'cr-event-2',
        success: true,
      })
    );
  });

  it('should emit conflict-resolver-error event on failure', async () => {
    const node = new ConflictResolverNode('cr-event-3', {});
    const context = createMockContext({
      conflict: {
        branch: 'feature-1',
        targetBranch: 'main',
        conflictFiles: ['src/file.ts'],
      },
    });
    (context.services.aiProvider.query as jest.Mock).mockRejectedValue(
      new Error('Failed')
    );

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'conflict-resolver-error',
      expect.objectContaining({
        nodeId: 'cr-event-3',
      })
    );
  });

  it('should emit file-resolved event for each resolved file', async () => {
    const node = new ConflictResolverNode('cr-event-4', {});
    const context = createMockContext({
      conflict: {
        branch: 'feature-1',
        targetBranch: 'main',
        conflictFiles: ['src/a.ts', 'src/b.ts'],
      },
    });

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'file-resolved',
      expect.objectContaining({
        nodeId: 'cr-event-4',
      })
    );
  });
});
