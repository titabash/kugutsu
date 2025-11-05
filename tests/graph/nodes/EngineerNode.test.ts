/**
 * EngineerNode Unit Tests (Jest)
 */

import { jest } from '@jest/globals';
import type { Task } from '../../../src/graph/types.js';

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
const { engineerNode } = await import('../../../src/graph/nodes/EngineerNode.js');
const { createInitialState } = await import('../../../src/graph/state.js');
const { MockAIProvider, createMockMessage } = await import(
  '../../../src/providers/MockAIProvider.js'
);
const { AIProviderFactory } = await import('../../../src/providers/AIProviderFactory.js');

describe('EngineerNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mock provider
    mockProvider = new MockAIProvider();
    (AIProviderFactory.create as any).mockReturnValue(mockProvider);
  });

  test('should implement task successfully', async () => {
    // Setup mock provider
    const SESSION_ID = 'session-123';
    mockProvider.setDefaultResponse({
      messages: [
        createMockMessage.assistant('タスクを実装しています...', SESSION_ID),
        createMockMessage.assistant('テストを作成しました', SESSION_ID),
        createMockMessage.assistant('実装が完了しました', SESSION_ID),
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

    // Add task
    const task: Task = {
      id: 'task-001',
      title: 'Implement feature',
      description: 'Add new feature',
      status: 'in_progress',
      priority: 100,
      dependencies: [],
      worktreePath: '/test/worktrees/task-001',
      branchName: 'task/task-001',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    initialState.tasks = [task];

    // Execute node
    const result = await engineerNode(initialState, 'task-001');

    // Verify results
    expect(result.tasks).toBeDefined();
    expect(result.tasks!.length).toBe(1);

    const completedTask = result.tasks![0];
    expect(completedTask.status).toBe('completed');
    expect(completedTask.sessionId).toBeDefined();
    expect(completedTask.sessionId).toBe('session-123');

    expect(result.completedTasks).toBeDefined();
    expect(result.completedTasks!.length).toBe(1);

    expect(result.logs).toBeDefined();
    expect(result.logs!.length).toBeGreaterThan(0);

    // Verify metadata
    expect(result.metadata).toBeDefined();
    expect(result.metadata!.tasksCompleted).toBe(1);
  });

  test('should handle task with dependencies', async () => {
    // Setup mock provider
    mockProvider.setDefaultResponse({
      messages: [
        createMockMessage.assistant('依存タスクを確認しています...'),
        createMockMessage.assistant('実装が完了しました'),
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

    // Add task with dependencies
    const task: Task = {
      id: 'task-002',
      title: 'Implement dependent feature',
      description: 'Feature that depends on task-001',
      status: 'in_progress',
      priority: 80,
      dependencies: ['task-001'], // Has dependency
      worktreePath: '/test/worktrees/task-002',
      branchName: 'task/task-002',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    initialState.tasks = [task];

    // Execute node
    const result = await engineerNode(initialState, 'task-002');

    // Verify that the prompt included dependency information
    expect(mockProvider.getLastPrompt()).toBeDefined();
    expect(mockProvider.getLastPrompt()).toContain('task-001');
    expect(mockProvider.getLastPrompt()).toContain('依存');

    // Verify task completed
    expect(result.tasks).toBeDefined();
    expect(result.tasks![0].status).toBe('completed');
  });

  test('should handle errors gracefully', async () => {
    // Setup mock provider with error
    mockProvider.setDefaultResponse({
      messages: [],
      shouldThrowError: true,
      errorMessage: 'Implementation error',
    });

    // Create initial state
    const initialState = createInitialState('Test request', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    // Add task
    const task: Task = {
      id: 'task-003',
      title: 'Failing task',
      description: 'This will fail',
      status: 'in_progress',
      priority: 100,
      dependencies: [],
      worktreePath: '/test/worktrees/task-003',
      branchName: 'task/task-003',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    initialState.tasks = [task];

    // Execute node
    const result = await engineerNode(initialState, 'task-003');

    // Verify task marked as failed
    expect(result.tasks).toBeDefined();
    expect(result.tasks![0].status).toBe('failed');
    expect(result.tasks![0].error).toBeDefined();

    // Verify failed tasks list
    expect(result.failedTasks).toBeDefined();
    expect(result.failedTasks!.length).toBe(1);

    // Verify error logs
    expect(result.logs).toBeDefined();
    const errorLog = result.logs!.find((log) => log.level === 'error');
    expect(errorLog).toBeDefined();

    // Verify metadata
    expect(result.metadata).toBeDefined();
    expect(result.metadata!.tasksFailed).toBe(1);
    expect(result.metadata!.hasErrors).toBe(true);
  });

  test('should return error when task not found', async () => {
    // Create initial state
    const initialState = createInitialState('Test request', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    initialState.tasks = [];

    // Execute node with non-existent task ID
    const result = await engineerNode(initialState, 'nonexistent-task');

    // Verify error log
    expect(result.logs).toBeDefined();
    expect(result.logs!.length).toBeGreaterThan(0);
    expect(result.logs![0].message).toContain('見つかりません');
  });

  test('should return error when worktree not set', async () => {
    // Create initial state
    const initialState = createInitialState('Test request', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    // Add task without worktreePath
    const task: Task = {
      id: 'task-004',
      title: 'Task without worktree',
      description: 'Missing worktree path',
      status: 'in_progress',
      priority: 100,
      dependencies: [],
      // worktreePath is missing
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    initialState.tasks = [task];

    // Execute node
    const result = await engineerNode(initialState, 'task-004');

    // Verify error log
    expect(result.logs).toBeDefined();
    expect(result.logs!.length).toBeGreaterThan(0);
    expect(result.logs![0].message).toContain('worktree');
  });

  test('should preserve session ID for conflict resolution', async () => {
    // Setup mock provider
    const SESSION_ID = 'original-session-456';
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

    // Create initial state
    const initialState = createInitialState('Test request', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    // Add task
    const task: Task = {
      id: 'task-005',
      title: 'Task with session',
      description: 'Should preserve session ID',
      status: 'in_progress',
      priority: 100,
      dependencies: [],
      worktreePath: '/test/worktrees/task-005',
      branchName: 'task/task-005',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    initialState.tasks = [task];

    // Execute node
    const result = await engineerNode(initialState, 'task-005');

    // Verify session ID was preserved
    expect(result.tasks).toBeDefined();
    expect(result.tasks![0].sessionId).toBeDefined();
    expect(result.tasks![0].sessionId).toBe('original-session-456');
  });
});
