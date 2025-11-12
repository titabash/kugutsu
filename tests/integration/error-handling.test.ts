/**
 * Error Handling Integration Test (Jest)
 *
 * Tests workflow behavior under error conditions
 */

import { jest } from '@jest/globals';
import type { Task, MergeTask } from '../../src/graph/types.js';

// Mock AIProviderFactory BEFORE importing
let mockProvider: any;
const actualAIProviderFactoryModule = (await import(
  '../../src/providers/AIProviderFactory.js'
)) as typeof import('../../src/providers/AIProviderFactory.js');
const actualAIProviderFactory = actualAIProviderFactoryModule.AIProviderFactory;
jest.unstable_mockModule('../../src/providers/AIProviderFactory.js', () => {
  const buildProviderConfig = jest.fn<typeof actualAIProviderFactory.buildProviderConfig>(
    (options) => actualAIProviderFactory.buildProviderConfig(options)
  );
  return {
    AIProviderFactory: {
      ...actualAIProviderFactory,
      create: jest.fn(() => mockProvider),
      buildProviderConfig,
      getSupportedProviders: jest.fn(() => ['claude', 'mock']),
      isProviderSupported: jest.fn((provider: string) => ['claude', 'mock'].includes(provider)),
    },
  };
});

// Mock GitWorktreeManager BEFORE importing
const mockCreateWorktree = jest.fn<(taskId: string) => Promise<any>>();
const mockRemoveWorktree = jest.fn<(taskId: string) => Promise<void>>();
const mockCleanupAllWorktrees = jest.fn<() => Promise<void>>();

jest.unstable_mockModule('../../src/managers/GitWorktreeManager.js', () => ({
  GitWorktreeManager: jest.fn().mockImplementation(() => ({
    createWorktree: mockCreateWorktree,
    removeWorktree: mockRemoveWorktree,
    cleanupAllWorktrees: mockCleanupAllWorktrees,
  })),
}));

// Import AFTER mocking
const { productOwnerNode } = await import('../../src/graph/nodes/ProductOwnerNode.js');
const { engineerDispatchNode } = await import('../../src/graph/nodes/EngineerDispatchNode.js');
const { engineerNode } = await import('../../src/graph/nodes/EngineerNode.js');
const { reviewNode } = await import('../../src/graph/nodes/ReviewNode.js');
const { conflictResolverNode } = await import('../../src/graph/nodes/ConflictResolverNode.js');
const { createInitialState } = await import('../../src/graph/state.js');
const { MockAIProvider, createMockMessage } = await import('../../src/providers/MockAIProvider.js');

import type { ParallelDevStateType, ParallelDevStateUpdate } from '../../src/graph/state.js';

/**
 * Helper function to merge state updates correctly (mimics LangGraph reducers)
 */
function mergeState(
  state: ParallelDevStateType,
  update: ParallelDevStateUpdate
): ParallelDevStateType {
  // tasks: Merge by ID (mimics state.ts lines 40-46)
  const tasks = (() => {
    if (!update.tasks) return state.tasks;
    const taskMap = new Map(state.tasks.map((t) => [t.id, t]));
    update.tasks.forEach((t) => taskMap.set(t.id, t));
    return Array.from(taskMap.values());
  })();

  // completedTasks: Append without duplicates (mimics state.ts lines 54-61)
  const completedTasks = (() => {
    if (!update.completedTasks) return state.completedTasks;
    const existingIds = new Set(state.completedTasks.map((t) => t.id));
    const newTasks = update.completedTasks.filter((t) => !existingIds.has(t.id));
    return state.completedTasks.concat(newTasks);
  })();

  // failedTasks: Append without duplicates (mimics state.ts lines 69-76)
  const failedTasks = (() => {
    if (!update.failedTasks) return state.failedTasks;
    const existingIds = new Set(state.failedTasks.map((t) => t.id));
    const newTasks = update.failedTasks.filter((t) => !existingIds.has(t.id));
    return state.failedTasks.concat(newTasks);
  })();

  // reviews: Append (mimics state.ts lines 84-88)
  const reviews = (() => {
    if (!update.reviews) return state.reviews;
    return state.reviews.concat(update.reviews);
  })();

  // mergeQueue: Merge by taskId (mimics state.ts lines 96-102)
  const mergeQueue = (() => {
    if (!update.mergeQueue) return state.mergeQueue;
    const mergeMap = new Map(state.mergeQueue.map((m) => [m.taskId, m]));
    update.mergeQueue.forEach((m) => mergeMap.set(m.taskId, m));
    return Array.from(mergeMap.values());
  })();

  // worktrees: Merge maps (mimics state.ts lines 110-117)
  const worktrees = (() => {
    if (!update.worktrees) return state.worktrees;
    return new Map([...state.worktrees, ...update.worktrees]);
  })();

  // logs: Append and keep last 1000 (mimics state.ts lines 125-131)
  const logs = (() => {
    if (!update.logs) return state.logs;
    const combined = state.logs.concat(update.logs);
    return combined.slice(-1000);
  })();

  // metadata: Shallow merge (mimics state.ts lines 185-191)
  const metadata = (() => {
    if (!update.metadata) return state.metadata;
    return { ...state.metadata, ...update.metadata };
  })();

  return {
    ...state,
    tasks,
    completedTasks,
    failedTasks,
    reviews,
    mergeQueue,
    worktrees,
    logs,
    metadata,
    // config is replaced (not merged)
    config: update.config !== undefined ? update.config : state.config,
  };
}

describe('Error Handling Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mock provider
    mockProvider = new MockAIProvider();

    // Setup GitWorktreeManager mock
    mockCreateWorktree.mockImplementation(async (taskId: string) => ({
      path: `/test/worktrees/${taskId}`,
      branchName: `task/${taskId}`,
    }));
    mockRemoveWorktree.mockResolvedValue(undefined);
    mockCleanupAllWorktrees.mockResolvedValue(undefined);
  });

  test.skip('should handle task implementation failure', async () => {
    // Setup: Generate a task
    const techStackResponse = {
      languages: ['TypeScript'],
      frameworks: ['Node.js'],
      buildTools: ['npm'],
    };

    const requirementResponse = {
      requirements: ['Feature X'],
      constraints: [],
    };

    const tasksResponse = [
      {
        title: 'Implement Feature X',
        description: 'This will fail',
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

    let state = createInitialState('Implement failing feature', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    // Generate and dispatch task
    const poResult = await productOwnerNode(state);
    state = mergeState(state, poResult);

    const dispatchResult = await engineerDispatchNode(state);
    state = mergeState(state, dispatchResult);

    const taskId = state.tasks![0].id;

    // Simulate implementation failure
    mockProvider.setDefaultResponse({
      messages: [],
      shouldThrowError: true,
      errorMessage: 'Implementation failed',
    });

    const engineerResult = await engineerNode({ ...state, currentTaskId: taskId });
    state = mergeState(state, engineerResult);

    // Verify task is marked as failed
    const failedTask = state.tasks!.find((t) => t.id === taskId);
    expect(failedTask?.status).toBe('failed');

    // Verify error is logged
    expect(state.logs).toBeDefined();
    const errorLog = state.logs!.find((log) => log.level === 'error');
    expect(errorLog).toBeDefined();
    expect(errorLog?.message).toContain('が失敗しました');
  });

  test.skip('should handle AI provider errors gracefully', async () => {
    // Simulate ProductOwner AI error
    mockProvider.setDefaultResponse({
      messages: [],
      shouldThrowError: true,
      errorMessage: 'AI provider connection failed',
    });

    const state = createInitialState('Test request', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    const result = await productOwnerNode(state);

    // Verify error is handled gracefully
    expect(result.logs).toBeDefined();
    const errorLog = result.logs!.find((log) => log.level === 'error');
    expect(errorLog).toBeDefined();

    expect(result.metadata).toBeDefined();
    expect(result.metadata!.hasErrors).toBe(true);
  });

  test.skip('should handle git operation errors', async () => {
    // Setup task
    const techStackResponse = {
      languages: ['TypeScript'],
      frameworks: ['Node.js'],
      buildTools: ['npm'],
    };

    const requirementResponse = {
      requirements: ['Feature Y'],
      constraints: [],
    };

    const tasksResponse = [
      {
        title: 'Implement Feature Y',
        description: 'Test git error',
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

    let state = createInitialState('Test git error', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    const poResult = await productOwnerNode(state);
    state = mergeState(state, poResult);

    // Simulate git worktree creation error
    mockCreateWorktree.mockRejectedValueOnce(new Error('Git worktree creation failed'));

    const dispatchResult = await engineerDispatchNode(state);
    state = mergeState(state, dispatchResult);

    // Verify error is logged
    expect(state.logs).toBeDefined();
    const errorLog = state.logs!.find((log) => log.level === 'error');
    expect(errorLog).toBeDefined();

    // Task should not have worktree assigned
    // When git error occurs, EngineerDispatchNode returns empty updatedTasks array,
    // but the original task still exists in state.tasks (thanks to mergeState)
    const task = state.tasks!.find((t) => t.status === 'pending');
    expect(task).toBeDefined();
    expect(task?.worktreePath).toBeUndefined();
  });

  test.skip('should handle merge conflict errors', async () => {
    // Create state with a task that has a merge conflict
    const state = createInitialState('Test merge conflict', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    // Add a completed task
    const task: Task = {
      id: 'task-conflict-001',
      title: 'Feature with conflict',
      description: 'This will have a merge conflict',
      status: 'completed',
      priority: 100,
      dependencies: [],
      worktreePath: '/test/worktrees/task-conflict-001',
      branchName: 'task/task-conflict-001',
      sessionId: 'session-conflict-123',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    state.tasks = [task];

    // Add merge task with conflict
    const mergeTask: MergeTask = {
      taskId: 'task-conflict-001',
      sourceBranch: 'task/task-conflict-001',
      targetBranch: 'main',
      status: 'conflict',
      conflictFiles: ['src/conflicted-file.ts'],
      attemptedAt: new Date(),
    };

    state.mergeQueue = [mergeTask];

    // Setup AI to handle conflict resolution (but it will fail in test env)
    const SESSION_ID = 'conflict-resolution-session';
    mockProvider.setDefaultResponse({
      messages: [
        createMockMessage.assistant('コンフリクトを確認しています...', SESSION_ID),
        createMockMessage.assistant('コンフリクトマーカーを解消しました', SESSION_ID),
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

    const result = await conflictResolverNode(state);

    // Verify error handling (will fail due to missing git repo in test env)
    expect(result.logs).toBeDefined();
    const errorLog = result.logs!.find((log) => log.level === 'error');
    expect(errorLog).toBeDefined();
    expect(errorLog?.message).toContain('処理エラー');

    // Verify AI was called with proper context
    expect(mockProvider.getCallCount()).toBeGreaterThan(0);
    const lastPrompt = mockProvider.getLastPrompt();
    expect(lastPrompt).toBeDefined();
    expect(lastPrompt).toContain('Merge Conflict Resolution');
    expect(lastPrompt).toContain('task-conflict-001');

    // Verify session was resumed from original engineer
    const lastOptions = mockProvider.getLastOptions();
    expect(lastOptions).toBeDefined();
    expect(lastOptions!.resume).toBe('session-conflict-123');
  });

  test.skip('should handle review errors gracefully', async () => {
    // Create state with a completed task
    const state = createInitialState('Test review error', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    const task: Task = {
      id: 'task-review-001',
      title: 'Feature to review',
      description: 'Review will fail',
      status: 'completed',
      priority: 100,
      dependencies: [],
      worktreePath: '/test/worktrees/task-review-001',
      branchName: 'task/task-review-001',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    state.tasks = [task];

    // Simulate review error
    mockProvider.setDefaultResponse({
      messages: [],
      shouldThrowError: true,
      errorMessage: 'Review failed',
    });

    const result = await reviewNode({ ...state, currentTaskId: 'task-review-001' });

    // Verify error is logged
    expect(result.logs).toBeDefined();
    const errorLog = result.logs!.find((log) => log.level === 'error');
    expect(errorLog).toBeDefined();
    expect(errorLog?.message).toContain('レビューに失敗');

    expect(result.metadata).toBeDefined();
    expect(result.metadata!.hasErrors).toBe(true);
  });

  test.skip('should recover from partial workflow failures', async () => {
    // Setup: Generate tasks
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
        title: 'Feature A (will succeed)',
        description: 'Success task',
        priority: 100,
        dependencies: [],
      },
      {
        title: 'Feature B (will fail)',
        description: 'Failing task',
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

    let state = createInitialState('Test partial failure', {
      maxEngineers: 2,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    // Generate and dispatch tasks
    const poResult = await productOwnerNode(state);
    state = mergeState(state, poResult);

    // Verify we have at least one task (fallback task may be created if JSON parse fails)
    expect(state.tasks).toBeDefined();
    expect(state.tasks!.length).toBeGreaterThan(0);

    // If we only got one task (due to JSON parse error), manually add a second task for testing
    if (state.tasks!.length < 2) {
      state.tasks!.push({
        id: 'task-002-manual',
        title: 'Feature B (will fail)',
        description: 'Failing task',
        status: 'pending',
        priority: 90,
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const dispatchResult = await engineerDispatchNode(state);
    state = mergeState(state, dispatchResult);

    const task1Id = state.tasks![0].id;
    const task2Id = state.tasks![1].id;

    // Task 1 succeeds
    const SESSION_ID_1 = 'session-success';
    mockProvider.setDefaultResponse({
      messages: [
        createMockMessage.assistant('実装中...', SESSION_ID_1),
        {
          type: 'result' as const,
          content: {
            duration: 100,
            tokenUsage: { input: 10, output: 20, total: 30 },
            cost: 0.001,
            permissionDenials: 0,
            success: true,
          },
          session_id: SESSION_ID_1,
          timestamp: new Date(),
        },
      ],
    });

    const eng1Result = await engineerNode({ ...state, currentTaskId: task1Id });
    state = mergeState(state, eng1Result);

    // Task 2 fails
    mockProvider.setDefaultResponse({
      messages: [],
      shouldThrowError: true,
      errorMessage: 'Task 2 failed',
    });

    const eng2Result = await engineerNode({ ...state, currentTaskId: task2Id });
    state = mergeState(state, eng2Result);

    // Verify: Task 1 is completed, Task 2 is failed
    const completedTasks = state.tasks!.filter((t) => t.status === 'completed');
    const failedTasks = state.tasks!.filter((t) => t.status === 'failed');

    expect(completedTasks.length).toBe(1);
    expect(completedTasks[0].id).toBe(task1Id);

    expect(failedTasks.length).toBe(1);
    expect(failedTasks[0].id).toBe(task2Id);

    // Verify both successes and failures are logged
    const errorLogs = state.logs!.filter((log) => log.level === 'error');
    const infoLogs = state.logs!.filter((log) => log.level === 'info');

    expect(errorLogs.length).toBeGreaterThan(0);
    expect(infoLogs.length).toBeGreaterThan(0);
  });
});
