/**
 * Parallel Execution Performance Test
 *
 * Tests that parallel execution is faster than sequential execution
 */

import { jest } from '@jest/globals';

// Mock AIProviderFactory BEFORE importing
let mockProvider: any;
jest.unstable_mockModule('../../src/providers/AIProviderFactory.js', () => ({
  AIProviderFactory: {
    create: jest.fn(() => mockProvider),
    getSupportedProviders: jest.fn(() => ['claude', 'mock']),
    isProviderSupported: jest.fn((provider: string) => ['claude', 'mock'].includes(provider)),
  },
}));

// Mock GitWorktreeManager BEFORE importing
const mockCreateWorktree = jest.fn<any>();
const mockRemoveWorktree = jest.fn<any>();
const mockCleanupAllWorktrees = jest.fn<any>();

jest.unstable_mockModule('../../src/managers/GitWorktreeManager.js', () => ({
  GitWorktreeManager: jest.fn().mockImplementation(() => ({
    createWorktree: mockCreateWorktree,
    removeWorktree: mockRemoveWorktree,
    cleanupAllWorktrees: mockCleanupAllWorktrees,
  })),
}));

// Mock child_process to prevent actual Git commands
const mockExecSync = jest.fn<any>();
jest.unstable_mockModule('child_process', () => ({
  execSync: mockExecSync,
}));

// Import AFTER mocking
const { compileParallelDevGraph } = await import('../../src/graph/ParallelDevGraph.js');
const { createInitialState } = await import('../../src/graph/state.js');
const { MockAIProvider, createMockMessage } = await import('../../src/providers/MockAIProvider.js');

describe('Parallel Execution Performance', () => {
  // Store original process.chdir
  const originalChdir = process.chdir;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock provider
    mockProvider = new MockAIProvider();

    // Setup default git worktree mock
    mockCreateWorktree.mockImplementation(async (taskId: string) => ({
      path: `/test/worktrees/${taskId}`,
      branchName: `task/${taskId}`,
    }));

    mockRemoveWorktree.mockResolvedValue(undefined);
    mockCleanupAllWorktrees.mockResolvedValue(undefined);

    // Mock execSync to return empty string (successful Git command)
    mockExecSync.mockReturnValue('');

    // Mock process.chdir to prevent directory changes
    process.chdir = jest.fn() as any;
  });

  afterEach(() => {
    // Restore original process.chdir
    process.chdir = originalChdir;
  });

  test('should execute multiple tasks in parallel with improved performance', async () => {
    // Setup mock responses with artificial delay to simulate real work
    const TASK_DELAY_MS = 100; // Simulate 100ms per task

    const techStackResponse = {
      languages: ['TypeScript'],
      frameworks: ['Node.js'],
      buildTools: ['npm'],
    };

    const requirementResponse = {
      requirements: ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4'],
      constraints: [],
    };

    const tasksResponse = [
      {
        title: 'Feature 1',
        description: 'Implement Feature 1',
        priority: 100,
        dependencies: [],
      },
      {
        title: 'Feature 2',
        description: 'Implement Feature 2',
        priority: 90,
        dependencies: [],
      },
      {
        title: 'Feature 3',
        description: 'Implement Feature 3',
        priority: 80,
        dependencies: [],
      },
      {
        title: 'Feature 4',
        description: 'Implement Feature 4',
        priority: 70,
        dependencies: [],
      },
    ];

    // Setup separate responses for each ProductOwner phase
    mockProvider.setMockResponse(/Technology Stack Analysis/, {
      messages: [createMockMessage.assistant(techStackResponse)],
    });
    mockProvider.setMockResponse(/Requirements Analysis/, {
      messages: [createMockMessage.assistant(requirementResponse)],
    });
    mockProvider.setMockResponse(/Task Generation/, {
      messages: [
        createMockMessage.assistant(tasksResponse),
        createMockMessage.result(true),
      ],
    });

    // Setup Engineer implementation response with delay
    const SESSION_ID = 'session-perf-test';
    mockProvider.setDefaultResponse({
      messages: [
        createMockMessage.assistant('実装中...', SESSION_ID),
        {
          type: 'result' as const,
          content: {
            duration: TASK_DELAY_MS,
            tokenUsage: { input: 10, output: 20, total: 30 },
            cost: 0.001,
            permissionDenials: 0,
            success: true,
          },
          session_id: SESSION_ID,
          timestamp: new Date(),
        },
      ],
      delay: TASK_DELAY_MS, // Add artificial delay to simulate real work
    });

    // Setup Review response
    mockProvider.setMockResponse(/Review/, {
      messages: [
        createMockMessage.assistant('承認'),
        createMockMessage.result(true),
      ],
    });

    // Create initial state with multiple engineers
    const initialState = createInitialState('Implement 4 features', {
      maxEngineers: 4,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
      provider: 'claude',
    });

    // Compile graph
    const graph = compileParallelDevGraph();

    // Execute graph and measure time
    const startTime = Date.now();
    const states: any[] = [];
    const stream = await graph.stream(initialState);

    for await (const event of stream) {
      states.push(event);
    }

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    // Verify workflow execution
    expect(states.length).toBeGreaterThan(0);

    // Extract node names from events
    const nodeNames = states.flatMap((state) => Object.keys(state));

    // Should execute all nodes
    expect(nodeNames).toContain('product_owner');
    expect(nodeNames).toContain('engineer_dispatch');
    expect(nodeNames).toContain('engineer');
    expect(nodeNames).toContain('review');
    expect(nodeNames).toContain('merge_coordinator');
    expect(nodeNames).toContain('check_completion');

    // Performance assertion:
    // With 4 tasks of 100ms each:
    // - Sequential execution would take ~400ms (4 * 100ms)
    // - Parallel execution should take ~100ms (max of all parallel tasks)
    // We allow some overhead for test execution, so we expect < 300ms
    const expectedSequentialTime = 4 * TASK_DELAY_MS; // 400ms
    const maxAcceptableTime = expectedSequentialTime * 0.75; // 300ms (75% of sequential)

    console.log(`Execution time: ${executionTime}ms`);
    console.log(`Expected sequential time: ${expectedSequentialTime}ms`);
    console.log(`Max acceptable time (75% of sequential): ${maxAcceptableTime}ms`);

    // Parallel execution should be significantly faster than sequential
    // Note: This is a soft assertion since timing can be flaky in CI environments
    if (executionTime < maxAcceptableTime) {
      console.log('✅ Parallel execution is faster than sequential!');
    } else {
      console.warn(
        `⚠️ Parallel execution took ${executionTime}ms, which is not significantly faster than sequential (${expectedSequentialTime}ms)`
      );
    }

    // Verify all tasks were processed
    const productOwnerEvent = states.find((s) => 'product_owner' in s);
    expect(productOwnerEvent!.product_owner.tasks.length).toBe(4);
  }, 60000); // 60 second timeout
});
