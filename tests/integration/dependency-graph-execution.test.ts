/**
 * Dependency Graph Execution Test
 *
 * Tests complex dependency graph with branching and merging patterns
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
const { compileUnifiedScrumWorkflowGraph } = await import('../../src/graph/ParallelDevGraph.js');
const { createInitialState } = await import('../../src/graph/state.js');
const { MockAIProvider } = await import('../../src/providers/MockAIProvider.js');
const {
  setupTestEnvironment,
  createTaskGraph,
  setupDefaultMockResponses,
  assertDependencyResolution,
  extractExecutionOrder,
  assertAllTasksCompleted,
} = await import('../helpers/integration-test-helpers.js');

describe('Dependency Graph Execution', () => {
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

  test('should execute complex dependency graph with branching and merging', async () => {
    const env = await setupTestEnvironment('dep-graph-test-');

    try {
      /**
       * Dependency Graph:
       * Task A [独立]
       * Task B [独立]
       *   ├→ Task C (depends on A, B) [合流]
       *        ├→ Task D
       *        └→ Task E
       *
       * Expected execution phases:
       * Phase 1: A and B in parallel
       * Phase 2: C (after A and B complete)
       * Phase 3: D and E in parallel (after C completes)
       */
      const tasks = createTaskGraph([
        {
          id: 'task-A',
          title: 'Independent Task A',
          description: 'This task has no dependencies',
          dependencies: [],
          priority: 100,
        },
        {
          id: 'task-B',
          title: 'Independent Task B',
          description: 'This task has no dependencies',
          dependencies: [],
          priority: 100,
        },
        {
          id: 'task-C',
          title: 'Merge Task C',
          description: 'This task depends on both A and B',
          dependencies: ['task-A', 'task-B'],
          priority: 90,
        },
        {
          id: 'task-D',
          title: 'Branch Task D',
          description: 'This task depends on C',
          dependencies: ['task-C'],
          priority: 80,
        },
        {
          id: 'task-E',
          title: 'Branch Task E',
          description: 'This task depends on C',
          dependencies: ['task-C'],
          priority: 80,
        },
      ]);

      // Setup mock responses
      await setupDefaultMockResponses(mockProvider, env, tasks);

      // Create initial state
      const initialState = createInitialState('Execute complex dependency graph', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: env.tempDir,
        worktreeBasePath: `${env.tempDir}/worktrees`,
        provider: 'mock',
      });

      // Compile and execute graph
      const graph = compileUnifiedScrumWorkflowGraph();
      const states: any[] = [];
      const stream = await graph.stream(initialState);

      for await (const event of stream) {
        states.push(event);
      }

      // Verify workflow execution
      expect(states.length).toBeGreaterThan(0);

      // Extract final state
      const finalState = states[states.length - 1];
      const finalTasks = finalState.check_completion?.tasks || [];

      // Assert all tasks completed
      assertAllTasksCompleted(finalTasks);

      // Extract execution order
      const executionOrder = extractExecutionOrder(states);

      console.log('Execution order:', executionOrder);

      // Assert dependency resolution
      const dependencies = {
        'task-A': [],
        'task-B': [],
        'task-C': ['task-A', 'task-B'],
        'task-D': ['task-C'],
        'task-E': ['task-C'],
      };

      assertDependencyResolution(executionOrder, dependencies);

      // Verify specific execution phases
      const indexA = executionOrder.indexOf('task-A');
      const indexB = executionOrder.indexOf('task-B');
      const indexC = executionOrder.indexOf('task-C');
      const indexD = executionOrder.indexOf('task-D');
      const indexE = executionOrder.indexOf('task-E');

      // Phase 1: A and B should execute early (parallel)
      expect(indexA).toBeGreaterThanOrEqual(0);
      expect(indexB).toBeGreaterThanOrEqual(0);

      // Phase 2: C should execute after A and B
      expect(indexC).toBeGreaterThan(indexA);
      expect(indexC).toBeGreaterThan(indexB);

      // Phase 3: D and E should execute after C (parallel)
      expect(indexD).toBeGreaterThan(indexC);
      expect(indexE).toBeGreaterThan(indexC);

      console.log('✅ Dependency graph executed successfully');
      console.log(`   Phase 1: A(${indexA}), B(${indexB})`);
      console.log(`   Phase 2: C(${indexC})`);
      console.log(`   Phase 3: D(${indexD}), E(${indexE})`);
    } finally {
      await env.cleanup();
    }
  }, 60000); // 60 second timeout

  test('should handle critical path calculation', async () => {
    const env = await setupTestEnvironment('critical-path-test-');

    try {
      /**
       * Linear Dependency Chain (Critical Path):
       * Task 1 → Task 2 → Task 3 → Task 4
       *
       * Plus independent task:
       * Task 5 [独立]
       *
       * Critical path: 1 → 2 → 3 → 4 (length: 4)
       * Task 5 can execute in parallel with critical path
       */
      const tasks = createTaskGraph([
        {
          id: 'task-1',
          title: 'Critical Path Start',
          description: 'First task in critical path',
          dependencies: [],
          priority: 100,
        },
        {
          id: 'task-2',
          title: 'Critical Path Step 2',
          description: 'Second task in critical path',
          dependencies: ['task-1'],
          priority: 90,
        },
        {
          id: 'task-3',
          title: 'Critical Path Step 3',
          description: 'Third task in critical path',
          dependencies: ['task-2'],
          priority: 80,
        },
        {
          id: 'task-4',
          title: 'Critical Path End',
          description: 'Last task in critical path',
          dependencies: ['task-3'],
          priority: 70,
        },
        {
          id: 'task-5',
          title: 'Independent Task',
          description: 'This task can execute in parallel',
          dependencies: [],
          priority: 100,
        },
      ]);

      // Setup mock responses
      await setupDefaultMockResponses(mockProvider, env, tasks);

      // Create initial state
      const initialState = createInitialState('Execute critical path', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: env.tempDir,
        worktreeBasePath: `${env.tempDir}/worktrees`,
        provider: 'mock',
      });

      // Compile and execute graph
      const graph = compileUnifiedScrumWorkflowGraph();
      const states: any[] = [];
      const stream = await graph.stream(initialState);

      for await (const event of stream) {
        states.push(event);
      }

      // Extract execution order
      const executionOrder = extractExecutionOrder(states);

      console.log('Execution order:', executionOrder);

      // Assert critical path order
      const dependencies = {
        'task-1': [],
        'task-2': ['task-1'],
        'task-3': ['task-2'],
        'task-4': ['task-3'],
        'task-5': [],
      };

      assertDependencyResolution(executionOrder, dependencies);

      // Verify critical path is maintained
      const index1 = executionOrder.indexOf('task-1');
      const index2 = executionOrder.indexOf('task-2');
      const index3 = executionOrder.indexOf('task-3');
      const index4 = executionOrder.indexOf('task-4');
      const index5 = executionOrder.indexOf('task-5');

      expect(index2).toBeGreaterThan(index1);
      expect(index3).toBeGreaterThan(index2);
      expect(index4).toBeGreaterThan(index3);

      // Task 5 should execute independently (potentially in parallel with critical path)
      expect(index5).toBeGreaterThanOrEqual(0);

      console.log('✅ Critical path executed correctly');
      console.log(`   Critical path: 1(${index1}) → 2(${index2}) → 3(${index3}) → 4(${index4})`);
      console.log(`   Independent: 5(${index5})`);

      // Extract final state
      const finalState = states[states.length - 1];
      const finalTasks = finalState.check_completion?.tasks || [];

      // Assert all tasks completed
      assertAllTasksCompleted(finalTasks);
    } finally {
      await env.cleanup();
    }
  }, 60000); // 60 second timeout

  test('should handle diamond dependency pattern', async () => {
    const env = await setupTestEnvironment('diamond-dep-test-');

    try {
      /**
       * Diamond Dependency Pattern:
       *      Task A
       *     /      \
       * Task B    Task C
       *     \      /
       *      Task D
       *
       * Expected execution:
       * Phase 1: A
       * Phase 2: B and C in parallel (both depend on A)
       * Phase 3: D (depends on both B and C)
       */
      const tasks = createTaskGraph([
        {
          id: 'task-A',
          title: 'Diamond Top',
          description: 'Start of diamond pattern',
          dependencies: [],
          priority: 100,
        },
        {
          id: 'task-B',
          title: 'Diamond Left',
          description: 'Left branch of diamond',
          dependencies: ['task-A'],
          priority: 90,
        },
        {
          id: 'task-C',
          title: 'Diamond Right',
          description: 'Right branch of diamond',
          dependencies: ['task-A'],
          priority: 90,
        },
        {
          id: 'task-D',
          title: 'Diamond Bottom',
          description: 'Merge point of diamond',
          dependencies: ['task-B', 'task-C'],
          priority: 80,
        },
      ]);

      // Setup mock responses
      await setupDefaultMockResponses(mockProvider, env, tasks);

      // Create initial state
      const initialState = createInitialState('Execute diamond dependency', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: env.tempDir,
        worktreeBasePath: `${env.tempDir}/worktrees`,
        provider: 'mock',
      });

      // Compile and execute graph
      const graph = compileUnifiedScrumWorkflowGraph();
      const states: any[] = [];
      const stream = await graph.stream(initialState);

      for await (const event of stream) {
        states.push(event);
      }

      // Extract execution order
      const executionOrder = extractExecutionOrder(states);

      console.log('Execution order:', executionOrder);

      // Assert dependency resolution
      const dependencies = {
        'task-A': [],
        'task-B': ['task-A'],
        'task-C': ['task-A'],
        'task-D': ['task-B', 'task-C'],
      };

      assertDependencyResolution(executionOrder, dependencies);

      // Verify diamond pattern
      const indexA = executionOrder.indexOf('task-A');
      const indexB = executionOrder.indexOf('task-B');
      const indexC = executionOrder.indexOf('task-C');
      const indexD = executionOrder.indexOf('task-D');

      // Phase 1: A executes first
      expect(indexA).toBe(0);

      // Phase 2: B and C execute after A (parallel)
      expect(indexB).toBeGreaterThan(indexA);
      expect(indexC).toBeGreaterThan(indexA);

      // Phase 3: D executes after both B and C
      expect(indexD).toBeGreaterThan(indexB);
      expect(indexD).toBeGreaterThan(indexC);

      console.log('✅ Diamond pattern executed successfully');
      console.log(`   Phase 1: A(${indexA})`);
      console.log(`   Phase 2: B(${indexB}), C(${indexC})`);
      console.log(`   Phase 3: D(${indexD})`);

      // Extract final state
      const finalState = states[states.length - 1];
      const finalTasks = finalState.check_completion?.tasks || [];

      // Assert all tasks completed
      assertAllTasksCompleted(finalTasks);
    } finally {
      await env.cleanup();
    }
  }, 60000); // 60 second timeout
});
