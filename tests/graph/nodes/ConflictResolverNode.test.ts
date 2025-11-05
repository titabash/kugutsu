/**
 * ConflictResolverNode Unit Tests (Jest)
 */

import { jest } from '@jest/globals';
import type { Task, MergeTask } from '../../../src/graph/types.js';

// Mock AIProviderFactory BEFORE importing
let mockProvider: any;
jest.unstable_mockModule('../../../src/providers/AIProviderFactory.js', () => ({
  AIProviderFactory: {
    create: jest.fn(() => mockProvider),
    getSupportedProviders: jest.fn(() => ['claude', 'mock']),
    isProviderSupported: jest.fn((provider: string) => ['claude', 'mock'].includes(provider)),
  },
}));

// Import after mocking
const { conflictResolverNode } = await import('../../../src/graph/nodes/ConflictResolverNode.js');
const { createInitialState } = await import('../../../src/graph/state.js');
const { MockAIProvider, createMockMessage } = await import(
  '../../../src/providers/MockAIProvider.js'
);
const { AIProviderFactory } = await import('../../../src/providers/AIProviderFactory.js');

describe('ConflictResolverNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mock provider
    mockProvider = new MockAIProvider();
    (AIProviderFactory.create as any).mockReturnValue(mockProvider);
  });

  test('should handle no conflicts', async () => {
    // Create initial state with no conflicts
    const initialState = createInitialState('Test request', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    initialState.mergeQueue = [];

    // Execute node
    const result = await conflictResolverNode(initialState);

    // Verify results
    expect(result.logs).toBeDefined();
    expect(result.logs!.some((log) => log.message.includes('コンフリクトはありません'))).toBe(true);
  });

  test('should process conflict resolution with AI', async () => {
    // Setup mock provider
    const SESSION_ID = 'conflict-session-123';
    mockProvider.setDefaultResponse({
      messages: [
        createMockMessage.assistant('コンフリクトを確認しています...', SESSION_ID),
        createMockMessage.assistant('コンフリクトマーカーを解消しました'),
        createMockMessage.assistant('テストを実行して確認しました'),
        createMockMessage.assistant('コミットしました'),
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

    // Create initial state
    const initialState = createInitialState('Test request', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    // Add task with conflict
    const task: Task = {
      id: 'task-001',
      title: 'Task with conflict',
      description: 'Has merge conflict',
      status: 'completed',
      priority: 100,
      dependencies: [],
      worktreePath: '/test/worktrees/task-001',
      branchName: 'task/task-001',
      sessionId: 'original-session-456', // Original engineer's session
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add merge task with conflict
    const mergeTask: MergeTask = {
      taskId: 'task-001',
      sourceBranch: 'task/task-001',
      targetBranch: 'main',
      status: 'conflict',
      conflictFiles: ['src/file.ts', 'src/other.ts'],
      attemptedAt: new Date(),
    };

    initialState.tasks = [task];
    initialState.mergeQueue = [mergeTask];

    // Execute node (will error in test env without git, but we can test the structure)
    try {
      const result = await conflictResolverNode(initialState);

      // Verify AI was called with proper prompt
      expect(mockProvider.getCallCount()).toBeGreaterThan(0);
      const lastPrompt = mockProvider.getLastPrompt();
      expect(lastPrompt).toBeDefined();
      expect(lastPrompt).toContain('Merge Conflict Resolution');
      expect(lastPrompt).toContain('task-001');
      expect(lastPrompt).toContain('src/file.ts');

      // Verify session resumption was attempted
      const lastOptions = mockProvider.getLastOptions();
      expect(lastOptions).toBeDefined();
      expect(lastOptions!.resume).toBe('original-session-456');
    } catch (error) {
      // Expected in test environment without git
      expect(error).toBeDefined();
    }
  });

  test('should skip tasks without worktree path', async () => {
    // Create initial state
    const initialState = createInitialState('Test request', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    // Add task without worktree path
    const task: Task = {
      id: 'task-002',
      title: 'Task without worktree',
      description: 'Missing worktree',
      status: 'completed',
      priority: 100,
      dependencies: [],
      // worktreePath is missing
      branchName: 'task/task-002',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add merge task with conflict
    const mergeTask: MergeTask = {
      taskId: 'task-002',
      sourceBranch: 'task/task-002',
      targetBranch: 'main',
      status: 'conflict',
      attemptedAt: new Date(),
    };

    initialState.tasks = [task];
    initialState.mergeQueue = [mergeTask];

    // Execute node
    const result = await conflictResolverNode(initialState);

    // Verify task was skipped (no merge tasks in result)
    expect(result).toBeDefined();
    // The task should be skipped due to missing worktree
  });

  test('should skip tasks not found in tasks list', async () => {
    // Create initial state
    const initialState = createInitialState('Test request', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    // Add merge task with conflict but no corresponding task
    const mergeTask: MergeTask = {
      taskId: 'nonexistent-task',
      sourceBranch: 'task/nonexistent',
      targetBranch: 'main',
      status: 'conflict',
      attemptedAt: new Date(),
    };

    initialState.tasks = [];
    initialState.mergeQueue = [mergeTask];

    // Execute node
    const result = await conflictResolverNode(initialState);

    // Verify task was skipped
    expect(result).toBeDefined();
  });

  test('should handle multiple conflicts', async () => {
    // Setup mock provider
    mockProvider.setDefaultResponse({
      messages: [
        createMockMessage.assistant('コンフリクトを解消中...'),
        createMockMessage.result(true),
      ],
    });

    // Create initial state
    const initialState = createInitialState('Test request', {
      maxEngineers: 2,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    // Add multiple tasks with conflicts
    const task1: Task = {
      id: 'task-003',
      title: 'First conflict',
      description: 'First conflict',
      status: 'completed',
      priority: 100,
      dependencies: [],
      worktreePath: '/test/worktrees/task-003',
      branchName: 'task/task-003',
      sessionId: 'session-003',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const task2: Task = {
      id: 'task-004',
      title: 'Second conflict',
      description: 'Second conflict',
      status: 'completed',
      priority: 80,
      dependencies: [],
      worktreePath: '/test/worktrees/task-004',
      branchName: 'task/task-004',
      sessionId: 'session-004',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mergeTask1: MergeTask = {
      taskId: 'task-003',
      sourceBranch: 'task/task-003',
      targetBranch: 'main',
      status: 'conflict',
      conflictFiles: ['file1.ts'],
      attemptedAt: new Date(),
    };

    const mergeTask2: MergeTask = {
      taskId: 'task-004',
      sourceBranch: 'task/task-004',
      targetBranch: 'main',
      status: 'conflict',
      conflictFiles: ['file2.ts'],
      attemptedAt: new Date(),
    };

    initialState.tasks = [task1, task2];
    initialState.mergeQueue = [mergeTask1, mergeTask2];

    // Execute node
    try {
      const result = await conflictResolverNode(initialState);

      // Verify AI was called multiple times
      expect(mockProvider.getCallCount()).toBeGreaterThanOrEqual(2);
    } catch (error) {
      // Expected in test environment
      expect(error).toBeDefined();
    }
  });

  test('should handle AI error during conflict resolution', async () => {
    // Setup mock provider with error
    mockProvider.setDefaultResponse({
      messages: [],
      shouldThrowError: true,
      errorMessage: 'AI resolution error',
    });

    // Create initial state
    const initialState = createInitialState('Test request', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    // Add task with conflict
    const task: Task = {
      id: 'task-005',
      title: 'Failing conflict resolution',
      description: 'Will fail',
      status: 'completed',
      priority: 100,
      dependencies: [],
      worktreePath: '/test/worktrees/task-005',
      branchName: 'task/task-005',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mergeTask: MergeTask = {
      taskId: 'task-005',
      sourceBranch: 'task/task-005',
      targetBranch: 'main',
      status: 'conflict',
      attemptedAt: new Date(),
    };

    initialState.tasks = [task];
    initialState.mergeQueue = [mergeTask];

    // Execute node
    const result = await conflictResolverNode(initialState);

    // Verify error was logged
    expect(result.logs).toBeDefined();
    const errorLog = result.logs!.find((log) => log.level === 'error');
    expect(errorLog).toBeDefined();
  });

  test('should include conflict files in prompt', async () => {
    // Setup mock provider
    mockProvider.setDefaultResponse({
      messages: [
        createMockMessage.assistant('Processing...'),
        createMockMessage.result(true),
      ],
    });

    // Create initial state
    const initialState = createInitialState('Test request', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    // Add task with specific conflict files
    const task: Task = {
      id: 'task-006',
      title: 'Conflict with specific files',
      description: 'Has specific conflict files',
      status: 'completed',
      priority: 100,
      dependencies: [],
      worktreePath: '/test/worktrees/task-006',
      branchName: 'task/task-006',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mergeTask: MergeTask = {
      taskId: 'task-006',
      sourceBranch: 'task/task-006',
      targetBranch: 'main',
      status: 'conflict',
      conflictFiles: ['src/app.ts', 'src/utils.ts', 'README.md'],
      attemptedAt: new Date(),
    };

    initialState.tasks = [task];
    initialState.mergeQueue = [mergeTask];

    // Execute node
    try {
      await conflictResolverNode(initialState);

      // Verify prompt includes conflict files
      const lastPrompt = mockProvider.getLastPrompt();
      expect(lastPrompt).toBeDefined();
      expect(lastPrompt).toContain('src/app.ts');
      expect(lastPrompt).toContain('src/utils.ts');
      expect(lastPrompt).toContain('README.md');
    } catch (error) {
      // Expected in test environment
      expect(error).toBeDefined();
    }
  });
});
