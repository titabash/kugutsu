/**
 * ReviewerNode Tests
 *
 * Phase 3.2: Preset Reviewer Node implementation
 * TDD Red Phase: These tests define expected behavior for the reviewer node
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ReviewerNode, type ReviewerNodeConfig } from '../../../../src/workflow/nodes/preset/ReviewerNode.js';
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
          approved: true,
          summary: 'Code looks good',
          findings: [],
        },
        duration: 300,
        turns: 3,
        tokensUsed: 150,
      }),
    },
    gitManager: {
      createWorktree: jest.fn().mockResolvedValue({
        path: '/mock/worktree',
        branchName: 'review/test-branch',
      }),
      removeWorktree: jest.fn().mockResolvedValue(undefined),
      merge: jest.fn().mockResolvedValue({ success: true, hasConflict: false }),
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
// ReviewerNode Construction Tests
// ============================================================================

describe('ReviewerNode', () => {
  describe('Construction', () => {
    it('should create ReviewerNode with correct type', () => {
      const node = new ReviewerNode('reviewer-1', {});

      expect(node.id).toBe('reviewer-1');
      expect(node.type).toBe('preset:reviewer');
    });

    it('should have default label "Reviewer"', () => {
      const node = new ReviewerNode('reviewer-2', {});

      expect(node.label).toBe('Reviewer');
    });

    it('should allow custom label', () => {
      const node = new ReviewerNode('reviewer-3', {
        label: 'Senior Reviewer',
      });

      expect(node.label).toBe('Senior Reviewer');
    });

    it('should have code input socket', () => {
      const node = new ReviewerNode('reviewer-4', {});
      const json = node.toJSON();

      const codeInput = json.inputs.find(i => i.id === 'code');
      expect(codeInput).toBeDefined();
      expect(codeInput?.type).toBe('data');
      expect(codeInput?.required).toBe(true);
    });

    it('should have context input socket (optional)', () => {
      const node = new ReviewerNode('reviewer-5', {});
      const json = node.toJSON();

      const contextInput = json.inputs.find(i => i.id === 'context');
      expect(contextInput).toBeDefined();
      expect(contextInput?.required).toBe(false);
    });

    it('should have review output socket', () => {
      const node = new ReviewerNode('reviewer-6', {});
      const json = node.toJSON();

      const reviewOutput = json.outputs.find(o => o.id === 'review');
      expect(reviewOutput).toBeDefined();
      expect(reviewOutput?.type).toBe('data');
    });

    it('should have approved output socket', () => {
      const node = new ReviewerNode('reviewer-7', {});
      const json = node.toJSON();

      const approvedOutput = json.outputs.find(o => o.id === 'approved');
      expect(approvedOutput).toBeDefined();
    });
  });

  describe('Default Configuration', () => {
    it('should have review-focused system prompt', () => {
      const node = new ReviewerNode('reviewer-8', {});

      expect(node.config.ai?.systemPrompt).toBeDefined();
      expect(node.config.ai?.systemPrompt).toContain('review');
    });

    it('should have default allowed tools for reviewing', () => {
      const node = new ReviewerNode('reviewer-9', {});

      const allowedTools = node.config.ai?.allowedTools ?? [];
      expect(allowedTools).toContain('Read');
      expect(allowedTools).toContain('Grep');
    });

    it('should have reasonable default maxTurns', () => {
      const node = new ReviewerNode('reviewer-10', {});

      expect(node.config.ai?.maxTurns).toBeGreaterThanOrEqual(5);
    });

    it('should allow overriding system prompt', () => {
      const customPrompt = 'You are a security code reviewer.';
      const node = new ReviewerNode('reviewer-11', {
        ai: {
          provider: 'auto',
          systemPrompt: customPrompt,
        },
      });

      expect(node.config.ai?.systemPrompt).toBe(customPrompt);
    });
  });

  describe('Review Configuration', () => {
    it('should support strict mode', () => {
      const node = new ReviewerNode('reviewer-12', {
        strictMode: true,
      });

      expect(node.config.strictMode).toBe(true);
    });

    it('should have strict mode disabled by default', () => {
      const node = new ReviewerNode('reviewer-13', {});

      expect(node.config.strictMode).toBeFalsy();
    });

    it('should support custom review criteria', () => {
      const criteria = ['security', 'performance', 'maintainability'];
      const node = new ReviewerNode('reviewer-14', {
        reviewCriteria: criteria,
      });

      expect(node.config.reviewCriteria).toEqual(criteria);
    });
  });
});

// ============================================================================
// ReviewerNode Execution Tests
// ============================================================================

describe('ReviewerNode Execution', () => {
  let mockServices: Services;
  let mockUtils: Utils;

  beforeEach(() => {
    mockServices = createMockServices();
    mockUtils = createMockUtils();
  });

  describe('Basic Execution', () => {
    it('should execute with code input', async () => {
      const node = new ReviewerNode('reviewer-exec-1', {});
      const context = createMockContext({
        code: { files: ['src/app.ts'], changes: 'function hello() {}' },
      });

      const result = await node.execute(context);

      expect(result.success).toBe(true);
      expect(context.services.aiProvider.query).toHaveBeenCalled();
    });

    it('should include code in prompt', async () => {
      const node = new ReviewerNode('reviewer-exec-2', {});
      const context = createMockContext({
        code: { content: 'const x = 1;' },
      });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('const x = 1'),
        })
      );
    });

    it('should use review system prompt', async () => {
      const node = new ReviewerNode('reviewer-exec-3', {});
      const context = createMockContext({ code: { content: 'code' } });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            systemPrompt: expect.stringContaining('review'),
          }),
        })
      );
    });
  });

  describe('Review Results', () => {
    it('should return review in output', async () => {
      const reviewResult = {
        approved: true,
        summary: 'LGTM',
        findings: [],
      };
      const context = createMockContext({ code: { content: 'code' } });
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
        finalState: reviewResult,
        duration: 100,
        turns: 1,
      });

      const node = new ReviewerNode('reviewer-result-1', {});
      const result = await node.execute(context);

      expect(result.outputs.review).toEqual(reviewResult);
    });

    it('should return approved status separately', async () => {
      const context = createMockContext({ code: { content: 'code' } });
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
        finalState: { approved: false, summary: 'Issues found', findings: [] },
        duration: 100,
        turns: 1,
      });

      const node = new ReviewerNode('reviewer-result-2', {});
      const result = await node.execute(context);

      expect(result.outputs.approved).toBe(false);
    });

    it('should return findings in output', async () => {
      const findings = [
        { severity: 'warning', message: 'Unused variable', line: 10 },
        { severity: 'error', message: 'Potential null pointer', line: 25 },
      ];
      const context = createMockContext({ code: { content: 'code' } });
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
        finalState: { approved: false, summary: 'Issues found', findings },
        duration: 100,
        turns: 1,
      });

      const node = new ReviewerNode('reviewer-result-3', {});
      const result = await node.execute(context);

      expect(result.outputs.findings).toEqual(findings);
    });
  });

  describe('Strict Mode', () => {
    it('should reject code with warnings in strict mode', async () => {
      const context = createMockContext({ code: { content: 'code' } });
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
        finalState: {
          approved: true,
          summary: 'Minor issues',
          findings: [{ severity: 'warning', message: 'Style issue' }],
        },
        duration: 100,
        turns: 1,
      });

      const node = new ReviewerNode('reviewer-strict-1', {
        strictMode: true,
      });
      const result = await node.execute(context);

      // In strict mode, any findings should result in not approved
      expect(result.outputs.approved).toBe(false);
    });

    it('should allow warnings in non-strict mode', async () => {
      const context = createMockContext({ code: { content: 'code' } });
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
        finalState: {
          approved: true,
          summary: 'Minor issues',
          findings: [{ severity: 'warning', message: 'Style issue' }],
        },
        duration: 100,
        turns: 1,
      });

      const node = new ReviewerNode('reviewer-strict-2', {
        strictMode: false,
      });
      const result = await node.execute(context);

      expect(result.outputs.approved).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing code input', async () => {
      const node = new ReviewerNode('reviewer-err-1', {});
      const context = createMockContext({}); // No code

      const result = await node.execute(context);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('code');
    });

    it('should handle AI provider errors', async () => {
      const node = new ReviewerNode('reviewer-err-2', {});
      const context = createMockContext({ code: { content: 'code' } });
      (context.services.aiProvider.query as jest.Mock).mockRejectedValue(
        new Error('AI service unavailable')
      );

      const result = await node.execute(context);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('AI service unavailable');
    });
  });
});

// ============================================================================
// ReviewerNode Validation Tests
// ============================================================================

describe('ReviewerNode Validation', () => {
  it('should be valid with default configuration', () => {
    const node = new ReviewerNode('reviewer-val-1', {});
    node.setConnectedInputs(['code']);
    const result = node.validate();

    expect(result.valid).toBe(true);
  });

  it('should be valid with strict mode enabled', () => {
    const node = new ReviewerNode('reviewer-val-2', {
      strictMode: true,
      reviewCriteria: ['security'],
    });
    node.setConnectedInputs(['code']);
    const result = node.validate();

    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// ReviewerNode Serialization Tests
// ============================================================================

describe('ReviewerNode Serialization', () => {
  it('should serialize to JSON correctly', () => {
    const node = new ReviewerNode('reviewer-serial-1', {
      strictMode: true,
      reviewCriteria: ['security', 'performance'],
    });
    node.setPosition(100, 200);

    const json = node.toJSON();

    expect(json.id).toBe('reviewer-serial-1');
    expect(json.type).toBe('preset:reviewer');
    expect(json.position).toEqual({ x: 100, y: 200 });
    expect(json.config.strictMode).toBe(true);
  });
});

// ============================================================================
// ReviewerNode Event Tests
// ============================================================================

describe('ReviewerNode Events', () => {
  it('should emit review-started event', async () => {
    const node = new ReviewerNode('reviewer-event-1', {});
    const context = createMockContext({ code: { content: 'code' } });

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'review-started',
      expect.objectContaining({
        nodeId: 'reviewer-event-1',
      })
    );
  });

  it('should emit review-completed event on success', async () => {
    const node = new ReviewerNode('reviewer-event-2', {});
    const context = createMockContext({ code: { content: 'code' } });

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'review-completed',
      expect.objectContaining({
        nodeId: 'reviewer-event-2',
        success: true,
      })
    );
  });

  it('should emit review-error event on failure', async () => {
    const node = new ReviewerNode('reviewer-event-3', {});
    const context = createMockContext({ code: { content: 'code' } });
    (context.services.aiProvider.query as jest.Mock).mockRejectedValue(
      new Error('Failed')
    );

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'review-error',
      expect.objectContaining({
        nodeId: 'reviewer-event-3',
      })
    );
  });
});
