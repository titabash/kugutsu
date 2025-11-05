/**
 * Graph Execution Integration Test
 *
 * Tests the complete LangGraph workflow execution
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

describe('Graph Execution Integration', () => {
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

  test('should execute complete workflow from start to end', async () => {
    // Setup mock responses
    const techStackResponse = {
      languages: ['TypeScript'],
      frameworks: ['Node.js'],
      buildTools: ['npm'],
    };

    const requirementResponse = {
      requirements: ['Add user authentication'],
      constraints: [],
    };

    const tasksResponse = [
      {
        title: 'Implement authentication',
        description: 'Create auth system',
        priority: 100,
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

    // Setup Engineer implementation response
    const SESSION_ID = 'session-graph-test';
    mockProvider.setDefaultResponse({
      messages: [
        createMockMessage.assistant('実装中...', SESSION_ID),
        {
          type: 'result' as const,
          content: {
            duration: 100,
            tokenUsage: { input: 10, output: 20, total: 30 },
            cost: 0.001,
            permissionDenials: 0,
            success: true,
          },
          session_id: SESSION_ID,
          timestamp: new Date(),
        },
      ],
    });

    // Setup Review response
    mockProvider.setMockResponse(/Review/, {
      messages: [
        createMockMessage.assistant('レビュー: 承認'),
        createMockMessage.result(true),
      ],
    });

    // Create initial state
    const initialState = createInitialState('Implement user authentication', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
      provider: 'claude',
    });

    // Compile graph
    const graph = compileParallelDevGraph();

    // Execute graph and collect all states
    const states: any[] = [];
    const stream = await graph.stream(initialState);

    for await (const event of stream) {
      states.push(event);
      console.log('Event:', Object.keys(event));
    }

    // Verify workflow execution
    expect(states.length).toBeGreaterThan(0);

    // Extract node names from events
    const nodeNames = states.flatMap((state) => Object.keys(state));

    // Should execute: product_owner → engineer_dispatch → engineer → review → merge_coordinator → check_completion
    expect(nodeNames).toContain('product_owner');
    expect(nodeNames).toContain('engineer_dispatch');
    expect(nodeNames).toContain('engineer');
    expect(nodeNames).toContain('review');
    expect(nodeNames).toContain('merge_coordinator');
    expect(nodeNames).toContain('check_completion');

    // Verify tasks were generated by product_owner
    const productOwnerEvent = states.find((s) => 'product_owner' in s);
    expect(productOwnerEvent).toBeDefined();
    expect(productOwnerEvent!.product_owner.tasks).toBeDefined();
    expect(productOwnerEvent!.product_owner.tasks.length).toBeGreaterThan(0);

    // Verify merge coordinator added tasks to merge queue
    const mergeCoordinatorEvent = states.find((s) => 'merge_coordinator' in s);
    expect(mergeCoordinatorEvent).toBeDefined();
    expect(mergeCoordinatorEvent!.merge_coordinator.mergeQueue).toBeDefined();

    // Verify completion check was executed
    const checkCompletionEvent = states.find((s) => 'check_completion' in s);
    expect(checkCompletionEvent).toBeDefined();
    expect(checkCompletionEvent!.check_completion.logs).toBeDefined();
  }, 30000); // 30 second timeout

  test('should handle multiple tasks in graph execution', async () => {
    // Setup mock responses for 2 tasks
    const techStackResponse = {
      languages: ['TypeScript'],
      frameworks: ['Node.js'],
      buildTools: ['npm'],
    };

    const requirementResponse = {
      requirements: ['Feature A', 'Feature B'],
      constraints: [],
    };

    const tasksResponse = [
      {
        title: 'Feature A',
        description: 'Implement Feature A',
        priority: 100,
        dependencies: [],
      },
      {
        title: 'Feature B',
        description: 'Implement Feature B',
        priority: 90,
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

    // Setup Engineer implementation response
    const SESSION_ID = 'session-multi-task';
    mockProvider.setDefaultResponse({
      messages: [
        createMockMessage.assistant('実装完了', SESSION_ID),
        createMockMessage.result(true),
      ],
    });

    // Setup Review response
    mockProvider.setMockResponse(/Review/, {
      messages: [
        createMockMessage.assistant('承認'),
        createMockMessage.result(true),
      ],
    });

    // Create initial state with maxEngineers = 2
    const initialState = createInitialState('Implement features A and B', {
      maxEngineers: 2,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
      provider: 'claude',
    });

    // Compile graph
    const graph = compileParallelDevGraph();

    // Execute graph
    const states: any[] = [];
    const stream = await graph.stream(initialState);

    for await (const event of stream) {
      states.push(event);
    }

    // Verify both tasks were processed
    expect(states.length).toBeGreaterThan(0);

    // Extract node names
    const nodeNames = states.flatMap((state) => Object.keys(state));

    // Should have executed engineer and review at least once
    expect(nodeNames.filter((n) => n === 'engineer').length).toBeGreaterThan(0);
    expect(nodeNames.filter((n) => n === 'review').length).toBeGreaterThan(0);
  }, 30000); // 30 second timeout

  test('should handle task failure in graph execution', async () => {
    // Setup mock responses
    const techStackResponse = {
      languages: ['TypeScript'],
      frameworks: ['Node.js'],
      buildTools: ['npm'],
    };

    const requirementResponse = {
      requirements: ['Failing task'],
      constraints: [],
    };

    const tasksResponse = [
      {
        title: 'Failing task',
        description: 'This task will fail',
        priority: 100,
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

    // Setup Engineer to fail
    mockProvider.setDefaultResponse({
      messages: [],
      shouldThrowError: true,
      errorMessage: 'Implementation failed',
    });

    // Create initial state
    const initialState = createInitialState('Implement failing task', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
      provider: 'claude',
    });

    // Compile graph
    const graph = compileParallelDevGraph();

    // Execute graph
    const states: any[] = [];
    const stream = await graph.stream(initialState);

    for await (const event of stream) {
      states.push(event);
    }

    // Verify workflow handled failure
    expect(states.length).toBeGreaterThan(0);

    const nodeNames = states.flatMap((state) => Object.keys(state));

    // Should have executed up to engineer and check_completion
    expect(nodeNames).toContain('product_owner');
    expect(nodeNames).toContain('engineer_dispatch');
    expect(nodeNames).toContain('engineer');
    expect(nodeNames).toContain('check_completion');
  }, 30000); // 30 second timeout
});
