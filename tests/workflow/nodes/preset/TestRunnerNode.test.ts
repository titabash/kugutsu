/**
 * TestRunnerNode Tests
 *
 * Phase 3.2: Preset Test Runner Node implementation
 * TDD Red Phase: These tests define expected behavior for the test runner node
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TestRunnerNode, type TestRunnerNodeConfig } from '../../../../src/workflow/nodes/preset/TestRunnerNode.js';
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
          result: 'Tests executed',
          testResults: {
            total: 50,
            passed: 48,
            failed: 2,
            skipped: 0,
          },
        },
        duration: 500,
        turns: 5,
        tokensUsed: 150,
      }),
    },
    gitManager: {
      createWorktree: jest.fn().mockResolvedValue({
        path: '/mock/worktree',
        branchName: 'test-branch',
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
// TestRunnerNode Construction Tests
// ============================================================================

describe('TestRunnerNode', () => {
  describe('Construction', () => {
    it('should create TestRunnerNode with correct type', () => {
      const node = new TestRunnerNode('tr-1', {});

      expect(node.id).toBe('tr-1');
      expect(node.type).toBe('preset:test-runner');
    });

    it('should have default label "Test Runner"', () => {
      const node = new TestRunnerNode('tr-2', {});

      expect(node.label).toBe('Test Runner');
    });

    it('should allow custom label', () => {
      const node = new TestRunnerNode('tr-3', {
        label: 'Integration Test Runner',
      });

      expect(node.label).toBe('Integration Test Runner');
    });

    it('should have testCommand input socket (optional)', () => {
      const node = new TestRunnerNode('tr-4', {});
      const json = node.toJSON();

      const cmdInput = json.inputs.find(i => i.id === 'testCommand');
      expect(cmdInput).toBeDefined();
      expect(cmdInput?.required).toBe(false);
    });

    it('should have targetPaths input socket (optional)', () => {
      const node = new TestRunnerNode('tr-5', {});
      const json = node.toJSON();

      const pathsInput = json.inputs.find(i => i.id === 'targetPaths');
      expect(pathsInput).toBeDefined();
      expect(pathsInput?.dataType).toBe('array');
    });

    it('should have changedFiles input socket', () => {
      const node = new TestRunnerNode('tr-6', {});
      const json = node.toJSON();

      const filesInput = json.inputs.find(i => i.id === 'changedFiles');
      expect(filesInput).toBeDefined();
    });

    it('should have testResults output socket', () => {
      const node = new TestRunnerNode('tr-7', {});
      const json = node.toJSON();

      const resultsOutput = json.outputs.find(o => o.id === 'testResults');
      expect(resultsOutput).toBeDefined();
      expect(resultsOutput?.type).toBe('data');
    });

    it('should have coverage output socket', () => {
      const node = new TestRunnerNode('tr-8', {});
      const json = node.toJSON();

      const coverageOutput = json.outputs.find(o => o.id === 'coverage');
      expect(coverageOutput).toBeDefined();
    });

    it('should have passed output socket', () => {
      const node = new TestRunnerNode('tr-9', {});
      const json = node.toJSON();

      const passedOutput = json.outputs.find(o => o.id === 'passed');
      expect(passedOutput).toBeDefined();
      expect(passedOutput?.dataType).toBe('boolean');
    });
  });

  describe('Default Configuration', () => {
    it('should have test-runner-focused system prompt', () => {
      const node = new TestRunnerNode('tr-10', {});

      expect(node.config.ai?.systemPrompt).toBeDefined();
      expect(node.config.ai?.systemPrompt?.toLowerCase()).toContain('test');
    });

    it('should have default allowed tools for test execution', () => {
      const node = new TestRunnerNode('tr-11', {});

      const allowedTools = node.config.ai?.allowedTools ?? [];
      expect(allowedTools).toContain('Bash');
      expect(allowedTools).toContain('Read');
    });

    it('should have reasonable default maxTurns', () => {
      const node = new TestRunnerNode('tr-12', {});

      expect(node.config.ai?.maxTurns).toBeGreaterThanOrEqual(5);
    });

    it('should have default test command', () => {
      const node = new TestRunnerNode('tr-13', {});

      expect(node.config.defaultTestCommand).toBeDefined();
    });
  });

  describe('Test Framework Configuration', () => {
    it('should support jest framework', () => {
      const node = new TestRunnerNode('tr-14', {
        testFramework: 'jest',
      });

      expect(node.config.testFramework).toBe('jest');
    });

    it('should support vitest framework', () => {
      const node = new TestRunnerNode('tr-15', {
        testFramework: 'vitest',
      });

      expect(node.config.testFramework).toBe('vitest');
    });

    it('should support mocha framework', () => {
      const node = new TestRunnerNode('tr-16', {
        testFramework: 'mocha',
      });

      expect(node.config.testFramework).toBe('mocha');
    });

    it('should support custom framework', () => {
      const node = new TestRunnerNode('tr-17', {
        testFramework: 'custom',
        defaultTestCommand: 'npm run test:e2e',
      });

      expect(node.config.testFramework).toBe('custom');
    });

    it('should default to jest framework', () => {
      const node = new TestRunnerNode('tr-18', {});

      expect(node.config.testFramework).toBe('jest');
    });
  });

  describe('Coverage Configuration', () => {
    it('should support coverage collection', () => {
      const node = new TestRunnerNode('tr-19', {
        collectCoverage: true,
      });

      expect(node.config.collectCoverage).toBe(true);
    });

    it('should default to no coverage collection', () => {
      const node = new TestRunnerNode('tr-20', {});

      expect(node.config.collectCoverage).toBe(false);
    });

    it('should support coverage threshold', () => {
      const node = new TestRunnerNode('tr-21', {
        collectCoverage: true,
        coverageThreshold: 80,
      });

      expect(node.config.coverageThreshold).toBe(80);
    });
  });
});

// ============================================================================
// TestRunnerNode Execution Tests
// ============================================================================

describe('TestRunnerNode Execution', () => {
  let mockServices: Services;
  let mockUtils: Utils;

  beforeEach(() => {
    mockServices = createMockServices();
    mockUtils = createMockUtils();
  });

  describe('Basic Execution', () => {
    it('should execute without inputs (run all tests)', async () => {
      const node = new TestRunnerNode('tr-exec-1', {});
      const context = createMockContext({});

      const result = await node.execute(context);

      expect(result.success).toBe(true);
    });

    it('should call AI provider to run tests', async () => {
      const node = new TestRunnerNode('tr-exec-2', {});
      const context = createMockContext({});

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalled();
    });

    it('should use custom test command when provided', async () => {
      const node = new TestRunnerNode('tr-exec-3', {});
      const context = createMockContext({
        testCommand: 'npm run test:integration',
      });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('npm run test:integration'),
        })
      );
    });

    it('should use default test command when not provided', async () => {
      const node = new TestRunnerNode('tr-exec-4', {
        defaultTestCommand: 'npm test',
      });
      const context = createMockContext({});

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('npm test'),
        })
      );
    });
  });

  describe('Targeted Test Execution', () => {
    it('should run tests for specific paths', async () => {
      const node = new TestRunnerNode('tr-target-1', {});
      const context = createMockContext({
        targetPaths: ['src/auth/', 'src/api/'],
      });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('src/auth'),
        })
      );
    });

    it('should run tests for changed files', async () => {
      const node = new TestRunnerNode('tr-target-2', {});
      const context = createMockContext({
        changedFiles: ['src/user.ts', 'src/auth.ts'],
      });

      await node.execute(context);

      expect(context.services.aiProvider.query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('user.ts'),
        })
      );
    });
  });

  describe('Test Results Handling', () => {
    it('should return test results', async () => {
      const node = new TestRunnerNode('tr-result-1', {});
      const context = createMockContext({});
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
        finalState: {
          testResults: {
            total: 100,
            passed: 95,
            failed: 5,
            skipped: 0,
          },
        },
        duration: 1000,
        turns: 3,
      });

      const result = await node.execute(context);

      expect(result.outputs.testResults).toBeDefined();
    });

    it('should return passed status when all tests pass', async () => {
      const node = new TestRunnerNode('tr-result-2', {});
      const context = createMockContext({});
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
        finalState: {
          testResults: {
            total: 50,
            passed: 50,
            failed: 0,
            skipped: 0,
          },
        },
        duration: 500,
        turns: 2,
      });

      const result = await node.execute(context);

      expect(result.outputs.passed).toBe(true);
    });

    it('should return passed=false when tests fail', async () => {
      const node = new TestRunnerNode('tr-result-3', {});
      const context = createMockContext({});
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
        finalState: {
          testResults: {
            total: 50,
            passed: 45,
            failed: 5,
            skipped: 0,
          },
        },
        duration: 500,
        turns: 2,
      });

      const result = await node.execute(context);

      expect(result.outputs.passed).toBe(false);
    });

    it('should include failed test names', async () => {
      const node = new TestRunnerNode('tr-result-4', {});
      const context = createMockContext({});
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
        finalState: {
          testResults: {
            total: 10,
            passed: 8,
            failed: 2,
            skipped: 0,
            failedTests: [
              { name: 'should authenticate user', file: 'auth.test.ts' },
              { name: 'should validate input', file: 'validation.test.ts' },
            ],
          },
        },
        duration: 300,
        turns: 2,
      });

      const result = await node.execute(context);
      const testResults = result.outputs.testResults as { failedTests?: unknown[] };

      expect(testResults.failedTests).toBeDefined();
      expect(testResults.failedTests?.length).toBe(2);
    });
  });

  describe('Coverage Handling', () => {
    it('should return coverage when collectCoverage is enabled', async () => {
      const node = new TestRunnerNode('tr-cov-1', {
        collectCoverage: true,
      });
      const context = createMockContext({});
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
        finalState: {
          testResults: { total: 10, passed: 10, failed: 0, skipped: 0 },
          coverage: {
            lines: 85,
            statements: 82,
            functions: 90,
            branches: 75,
          },
        },
        duration: 600,
        turns: 3,
      });

      const result = await node.execute(context);

      expect(result.outputs.coverage).toBeDefined();
    });

    it('should check coverage threshold', async () => {
      const node = new TestRunnerNode('tr-cov-2', {
        collectCoverage: true,
        coverageThreshold: 80,
      });
      const context = createMockContext({});
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
        finalState: {
          testResults: { total: 10, passed: 10, failed: 0, skipped: 0 },
          coverage: {
            lines: 70, // Below threshold
            statements: 70,
            functions: 70,
            branches: 70,
          },
        },
        duration: 600,
        turns: 3,
      });

      const result = await node.execute(context);

      // Tests pass but coverage fails
      expect(result.outputs.passed).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle test execution errors', async () => {
      const node = new TestRunnerNode('tr-err-1', {});
      const context = createMockContext({});
      (context.services.aiProvider.query as jest.Mock).mockRejectedValue(
        new Error('Test process crashed')
      );

      const result = await node.execute(context);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Test process');
    });

    it('should handle timeout', async () => {
      const node = new TestRunnerNode('tr-err-2', {
        timeout: 1000,
      });
      const context = createMockContext({});
      (context.services.aiProvider.query as jest.Mock).mockRejectedValue(
        new Error('Timeout exceeded')
      );

      const result = await node.execute(context);

      expect(result.success).toBe(false);
    });
  });

  describe('Metadata', () => {
    it('should include duration in metadata', async () => {
      const node = new TestRunnerNode('tr-meta-1', {});
      const context = createMockContext({});

      const result = await node.execute(context);

      expect(result.metadata?.duration).toBeDefined();
    });

    it('should include test count in metadata', async () => {
      const node = new TestRunnerNode('tr-meta-2', {});
      const context = createMockContext({});
      (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
        finalState: {
          testResults: { total: 25, passed: 25, failed: 0, skipped: 0 },
        },
        duration: 400,
        turns: 2,
      });

      const result = await node.execute(context);

      expect(result.metadata?.testCount).toBe(25);
    });
  });
});

// ============================================================================
// TestRunnerNode Validation Tests
// ============================================================================

describe('TestRunnerNode Validation', () => {
  it('should be valid with default configuration', () => {
    const node = new TestRunnerNode('tr-val-1', {});
    const result = node.validate();

    expect(result.valid).toBe(true);
  });

  it('should be valid with custom framework', () => {
    const node = new TestRunnerNode('tr-val-2', {
      testFramework: 'vitest',
    });
    const result = node.validate();

    expect(result.valid).toBe(true);
  });

  it('should be valid with coverage threshold', () => {
    const node = new TestRunnerNode('tr-val-3', {
      collectCoverage: true,
      coverageThreshold: 80,
    });
    const result = node.validate();

    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// TestRunnerNode Serialization Tests
// ============================================================================

describe('TestRunnerNode Serialization', () => {
  it('should serialize to JSON correctly', () => {
    const node = new TestRunnerNode('tr-serial-1', {
      testFramework: 'vitest',
      collectCoverage: true,
      coverageThreshold: 90,
    });
    node.setPosition(300, 400);

    const json = node.toJSON();

    expect(json.id).toBe('tr-serial-1');
    expect(json.type).toBe('preset:test-runner');
    expect(json.position).toEqual({ x: 300, y: 400 });
    expect(json.config.testFramework).toBe('vitest');
  });

  it('should preserve all configuration in serialization', () => {
    const node = new TestRunnerNode('tr-serial-2', {
      label: 'E2E Tests',
      testFramework: 'mocha',
      defaultTestCommand: 'npm run test:e2e',
      collectCoverage: true,
      coverageThreshold: 85,
      timeout: 30000,
    });

    const json = node.toJSON();

    expect(json.label).toBe('E2E Tests');
    expect(json.config.testFramework).toBe('mocha');
    expect(json.config.defaultTestCommand).toBe('npm run test:e2e');
    expect(json.config.coverageThreshold).toBe(85);
  });
});

// ============================================================================
// TestRunnerNode Event Tests
// ============================================================================

describe('TestRunnerNode Events', () => {
  it('should emit test-runner-started event', async () => {
    const node = new TestRunnerNode('tr-event-1', {});
    const context = createMockContext({});

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'test-runner-started',
      expect.objectContaining({
        nodeId: 'tr-event-1',
      })
    );
  });

  it('should emit test-runner-completed event on success', async () => {
    const node = new TestRunnerNode('tr-event-2', {});
    const context = createMockContext({});

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'test-runner-completed',
      expect.objectContaining({
        nodeId: 'tr-event-2',
        success: true,
      })
    );
  });

  it('should emit test-runner-error event on failure', async () => {
    const node = new TestRunnerNode('tr-event-3', {});
    const context = createMockContext({});
    (context.services.aiProvider.query as jest.Mock).mockRejectedValue(
      new Error('Failed')
    );

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'test-runner-error',
      expect.objectContaining({
        nodeId: 'tr-event-3',
      })
    );
  });

  it('should emit tests-failed event when tests fail', async () => {
    const node = new TestRunnerNode('tr-event-4', {});
    const context = createMockContext({});
    (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
      finalState: {
        testResults: { total: 10, passed: 8, failed: 2, skipped: 0 },
      },
      duration: 300,
      turns: 2,
    });

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'tests-failed',
      expect.objectContaining({
        nodeId: 'tr-event-4',
        failedCount: 2,
      })
    );
  });

  it('should emit tests-passed event when all tests pass', async () => {
    const node = new TestRunnerNode('tr-event-5', {});
    const context = createMockContext({});
    (context.services.aiProvider.query as jest.Mock).mockResolvedValue({
      finalState: {
        testResults: { total: 10, passed: 10, failed: 0, skipped: 0 },
      },
      duration: 300,
      turns: 2,
    });

    await node.execute(context);

    expect(context.utils.emit).toHaveBeenCalledWith(
      'tests-passed',
      expect.objectContaining({
        nodeId: 'tr-event-5',
        passedCount: 10,
      })
    );
  });
});
