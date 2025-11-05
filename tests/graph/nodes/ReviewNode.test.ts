/**
 * ReviewNode Unit Tests (Jest)
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
const { reviewNode } = await import('../../../src/graph/nodes/ReviewNode.js');
const { createInitialState } = await import('../../../src/graph/state.js');
const { MockAIProvider, createMockMessage } = await import(
  '../../../src/providers/MockAIProvider.js'
);
const { AIProviderFactory } = await import('../../../src/providers/AIProviderFactory.js');

describe('ReviewNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mock provider
    mockProvider = new MockAIProvider();
    (AIProviderFactory.create as any).mockReturnValue(mockProvider);
  });

  test('should approve code with no issues', async () => {
    // Setup mock provider - positive review
    mockProvider.setDefaultResponse({
      messages: [
        createMockMessage.assistant('コードを確認しています...'),
        createMockMessage.assistant('テストカバレッジは十分です'),
        createMockMessage.assistant('REVIEW_STATUS: APPROVED\n\n良好なコード品質です。'),
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

    // Add completed task
    const task: Task = {
      id: 'task-001',
      title: 'Implemented feature',
      description: 'Feature implementation',
      status: 'completed',
      priority: 100,
      dependencies: [],
      worktreePath: '/test/worktrees/task-001',
      branchName: 'task/task-001',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    initialState.tasks = [task];

    // Execute node
    const result = await reviewNode(initialState, 'task-001');

    // Verify results
    expect(result.reviews).toBeDefined();
    expect(result.reviews!.length).toBe(1);

    const review = result.reviews![0];
    expect(review.taskId).toBe('task-001');
    expect(review.status).toBe('approved');
    expect(review.reviewer).toBe('TechLeadAI');
    expect(review.comments).toBeDefined();
    expect(review.comments.length).toBeGreaterThan(0);

    expect(result.logs).toBeDefined();
    const infoLog = result.logs!.find((log) => log.level === 'info');
    expect(infoLog).toBeDefined();
  });

  test('should request changes when issues found', async () => {
    // Setup mock provider - negative review
    mockProvider.setDefaultResponse({
      messages: [
        createMockMessage.assistant('コードを確認しています...'),
        createMockMessage.assistant('Issue: テストカバレッジが不足しています'),
        createMockMessage.assistant('Problem: エラーハンドリングが不適切です'),
        createMockMessage.assistant('REVIEW_STATUS: CHANGES_REQUESTED\n\n改善が必要です。'),
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

    // Add completed task
    const task: Task = {
      id: 'task-002',
      title: 'Implemented feature with issues',
      description: 'Feature with problems',
      status: 'completed',
      priority: 100,
      dependencies: [],
      worktreePath: '/test/worktrees/task-002',
      branchName: 'task/task-002',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    initialState.tasks = [task];

    // Execute node
    const result = await reviewNode(initialState, 'task-002');

    // Verify results
    expect(result.reviews).toBeDefined();
    expect(result.reviews!.length).toBe(1);

    const review = result.reviews![0];
    expect(review.status).toBe('changes_requested');
    expect(review.comments.length).toBeGreaterThan(0);

    // Verify warning log
    expect(result.logs).toBeDefined();
    const warnLog = result.logs!.find((log) => log.level === 'warn');
    expect(warnLog).toBeDefined();
  });

  test('should detect issues from keywords in comments', async () => {
    // Setup mock provider - implicit issues
    mockProvider.setDefaultResponse({
      messages: [
        createMockMessage.assistant('コードを確認しています...'),
        createMockMessage.assistant('This code has a concern regarding security.'),
        createMockMessage.assistant('Please fix the error handling.'),
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

    // Add completed task
    const task: Task = {
      id: 'task-003',
      title: 'Task with implicit issues',
      description: 'Issues detected from keywords',
      status: 'completed',
      priority: 100,
      dependencies: [],
      worktreePath: '/test/worktrees/task-003',
      branchName: 'task/task-003',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    initialState.tasks = [task];

    // Execute node
    const result = await reviewNode(initialState, 'task-003');

    // Verify results - should be changes_requested due to keywords
    expect(result.reviews).toBeDefined();
    expect(result.reviews![0].status).toBe('changes_requested');
  });

  test('should handle review errors gracefully', async () => {
    // Setup mock provider with error
    mockProvider.setDefaultResponse({
      messages: [],
      shouldThrowError: true,
      errorMessage: 'Review error',
    });

    // Create initial state
    const initialState = createInitialState('Test request', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    // Add completed task
    const task: Task = {
      id: 'task-004',
      title: 'Failing review',
      description: 'Review will fail',
      status: 'completed',
      priority: 100,
      dependencies: [],
      worktreePath: '/test/worktrees/task-004',
      branchName: 'task/task-004',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    initialState.tasks = [task];

    // Execute node
    const result = await reviewNode(initialState, 'task-004');

    // Verify error handling
    expect(result.logs).toBeDefined();
    const errorLog = result.logs!.find((log) => log.level === 'error');
    expect(errorLog).toBeDefined();
    expect(errorLog!.message).toContain('レビューに失敗');

    expect(result.metadata).toBeDefined();
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
    const result = await reviewNode(initialState, 'nonexistent-task');

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
      id: 'task-005',
      title: 'Task without worktree',
      description: 'Missing worktree path',
      status: 'completed',
      priority: 100,
      dependencies: [],
      // worktreePath is missing
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    initialState.tasks = [task];

    // Execute node
    const result = await reviewNode(initialState, 'task-005');

    // Verify error log
    expect(result.logs).toBeDefined();
    expect(result.logs!.length).toBeGreaterThan(0);
    expect(result.logs![0].message).toContain('worktree');
  });
});
