/**
 * Review Rejection Loop Test
 *
 * Tests review rejection scenarios and state transitions
 */

import { jest } from '@jest/globals';
import * as path from 'path';

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
const {
  setupTestEnvironment,
  createTaskGraph,
  setupDefaultMockResponses,
  createReviewMockResponse,
  assertTaskStateMachine,
  findTasksByStatus,
} = await import('../helpers/integration-test-helpers.js');

describe('Review Rejection Loop', () => {
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

  test('should handle immediate review approval', async () => {
    const env = await setupTestEnvironment('review-approval-test-');

    try {
      const tasks = createTaskGraph([
        {
          id: 'task-001',
          title: 'High Quality Implementation',
          description: 'This task will be approved immediately',
          dependencies: [],
          priority: 100,
        },
      ]);

      // Setup default mock responses (all approved)
      await setupDefaultMockResponses(mockProvider, env, tasks);

      // Override review response to be approved
      mockProvider.setMockResponse(/Review/i, createReviewMockResponse(env.kugutsuDir, 'task-001', 'approved'));

      // Create initial state
      const initialState = createInitialState('Implement high quality feature', {
        maxEngineers: 1,
        maxTurns: 20,
        baseBranch: 'main',
        baseRepoPath: env.tempDir,
        worktreeBasePath: `${env.tempDir}/worktrees`,
        provider: 'mock',
      });

      // Compile and execute graph
      const graph = compileParallelDevGraph();
      const states: any[] = [];
      const stream = await graph.stream(initialState);

      for await (const event of stream) {
        states.push(event);
      }

      // Extract final state
      const finalState = states[states.length - 1];
      const finalTasks = finalState.check_completion?.tasks || [];

      // Assert task was approved and completed
      expect(finalTasks.length).toBe(1);
      const task = finalTasks[0];
      expect(task.status).toBe('completed');

      console.log('✅ Review immediately approved');
    } finally {
      await env.cleanup();
    }
  }, 60000);

  test('should record review rejection with comments', async () => {
    const env = await setupTestEnvironment('review-rejection-test-');

    try {
      const tasks = createTaskGraph([
        {
          id: 'task-002',
          title: 'Implementation with Issues',
          description: 'This task will be rejected by review',
          dependencies: [],
          priority: 100,
        },
      ]);

      // Setup default mock responses
      await setupDefaultMockResponses(mockProvider, env, tasks);

      // Override review response to reject with comments
      const rejectionComments = [
        'セキュリティ上の問題: パスワードがハッシュ化されていません',
        'テストカバレッジが不足しています',
        'エラーハンドリングが不適切です',
      ];

      mockProvider.setMockResponse(
        /Review/i,
        createReviewMockResponse(env.kugutsuDir, 'task-002', 'changes_requested', rejectionComments)
      );

      // Create initial state
      const initialState = createInitialState('Implement feature with issues', {
        maxEngineers: 1,
        maxTurns: 20,
        baseBranch: 'main',
        baseRepoPath: env.tempDir,
        worktreeBasePath: `${env.tempDir}/worktrees`,
        provider: 'mock',
      });

      // Compile and execute graph
      const graph = compileParallelDevGraph();
      const states: any[] = [];
      const stream = await graph.stream(initialState);

      for await (const event of stream) {
        states.push(event);
      }

      // Extract review event
      const reviewEvent = states.find((s) => 'review' in s);
      expect(reviewEvent).toBeDefined();

      const reviews = reviewEvent.review?.reviews || [];
      expect(reviews.length).toBeGreaterThan(0);

      const review = reviews[0];
      expect(review.status).toBe('changes_requested');
      expect(review.comments.length).toBeGreaterThan(0);

      console.log('✅ Review rejection recorded with comments:');
      review.comments.forEach((comment: string, i: number) => {
        console.log(`   ${i + 1}. ${comment}`);
      });

      // Verify review file was created
      const fs = await import('fs/promises');
      const reviewFilePath = path.join(env.kugutsuDir, 'tasks/task-002/review.json');
      const reviewFileContent = await fs.readFile(reviewFilePath, 'utf-8');
      const reviewData = JSON.parse(reviewFileContent);

      expect(reviewData.status).toBe('changes_requested');
      expect(reviewData.comments.length).toBe(rejectionComments.length);
    } finally {
      await env.cleanup();
    }
  }, 60000);

  test('should transition task status on review rejection', async () => {
    const env = await setupTestEnvironment('task-transition-test-');

    try {
      const tasks = createTaskGraph([
        {
          id: 'task-003',
          title: 'Task for State Transition Test',
          description: 'This task tests state machine transitions',
          dependencies: [],
          priority: 100,
        },
      ]);

      // Setup default mock responses
      await setupDefaultMockResponses(mockProvider, env, tasks);

      // Override review response to reject
      mockProvider.setMockResponse(
        /Review/i,
        createReviewMockResponse(env.kugutsuDir, 'task-003', 'changes_requested', ['修正が必要です'])
      );

      // Create initial state
      const initialState = createInitialState('Test state transitions', {
        maxEngineers: 1,
        maxTurns: 20,
        baseBranch: 'main',
        baseRepoPath: env.tempDir,
        worktreeBasePath: `${env.tempDir}/worktrees`,
        provider: 'mock',
      });

      // Compile and execute graph
      const graph = compileParallelDevGraph();
      const states: any[] = [];
      const stream = await graph.stream(initialState);

      for await (const event of stream) {
        states.push(event);
      }

      // Trace state transitions
      console.log('\n🔄 Task State Transitions:');
      for (const event of states) {
        if ('engineer_dispatch' in event && event.engineer_dispatch.tasks) {
          const tasks = event.engineer_dispatch.tasks;
          tasks.forEach((t: any) => {
            console.log(`   EngineerDispatch: ${t.id} → ${t.status}`);
          });
        }
        if ('engineer' in event && event.engineer.tasks) {
          const tasks = event.engineer.tasks;
          tasks.forEach((t: any) => {
            console.log(`   Engineer: ${t.id} → ${t.status}`);
          });
        }
        if ('review' in event && event.review.tasks) {
          const tasks = event.review.tasks;
          tasks.forEach((t: any) => {
            console.log(`   Review: ${t.id} → ${t.status}`);
          });
        }
      }

      // Extract review state
      const reviewEvent = states.find((s) => 'review' in s);
      expect(reviewEvent).toBeDefined();

      const reviewedTasks = reviewEvent.review?.tasks || [];
      expect(reviewedTasks.length).toBeGreaterThan(0);

      const task = reviewedTasks[0];

      // レビュー却下時は in_progress に戻される
      expect(task.status).toBe('in_progress');

      console.log('\n✅ Task transitioned to in_progress after review rejection');
    } finally {
      await env.cleanup();
    }
  }, 60000);

  test('should handle multiple tasks with mixed review results', async () => {
    const env = await setupTestEnvironment('mixed-review-test-');

    try {
      const tasks = createTaskGraph([
        {
          id: 'task-A',
          title: 'Good Implementation',
          description: 'This will be approved',
          dependencies: [],
          priority: 100,
        },
        {
          id: 'task-B',
          title: 'Implementation with Issues',
          description: 'This will be rejected',
          dependencies: [],
          priority: 90,
        },
        {
          id: 'task-C',
          title: 'Another Good Implementation',
          description: 'This will be approved',
          dependencies: [],
          priority: 80,
        },
      ]);

      // Setup default mock responses
      await setupDefaultMockResponses(mockProvider, env, tasks);

      // Override review responses: approve A and C, reject B
      mockProvider.setMockResponse(/task-A/i, createReviewMockResponse(env.kugutsuDir, 'task-A', 'approved'));

      mockProvider.setMockResponse(
        /task-B/i,
        createReviewMockResponse(env.kugutsuDir, 'task-B', 'changes_requested', ['エラーハンドリングが不足しています'])
      );

      mockProvider.setMockResponse(/task-C/i, createReviewMockResponse(env.kugutsuDir, 'task-C', 'approved'));

      // Create initial state
      const initialState = createInitialState('Mixed review results test', {
        maxEngineers: 3,
        maxTurns: 20,
        baseBranch: 'main',
        baseRepoPath: env.tempDir,
        worktreeBasePath: `${env.tempDir}/worktrees`,
        provider: 'mock',
      });

      // Compile and execute graph
      const graph = compileParallelDevGraph();
      const states: any[] = [];
      const stream = await graph.stream(initialState);

      for await (const event of stream) {
        states.push(event);
      }

      // Extract final review state
      const reviewEvent = states.find((s) => 'review' in s);
      expect(reviewEvent).toBeDefined();

      const reviews = reviewEvent.review?.reviews || [];
      expect(reviews.length).toBe(3);

      // Count approved and rejected
      const approved = reviews.filter((r: any) => r.status === 'approved');
      const rejected = reviews.filter((r: any) => r.status === 'changes_requested');

      expect(approved.length).toBe(2); // task-A and task-C
      expect(rejected.length).toBe(1); // task-B

      console.log('✅ Mixed review results:');
      console.log(`   Approved: ${approved.map((r: any) => r.taskId).join(', ')}`);
      console.log(`   Rejected: ${rejected.map((r: any) => r.taskId).join(', ')}`);

      // Verify task statuses
      const reviewedTasks = reviewEvent.review?.tasks || [];
      const taskA = reviewedTasks.find((t: any) => t.id === 'task-A');
      const taskB = reviewedTasks.find((t: any) => t.id === 'task-B');
      const taskC = reviewedTasks.find((t: any) => t.id === 'task-C');

      expect(taskA?.status).toBe('completed');
      expect(taskB?.status).toBe('in_progress');
      expect(taskC?.status).toBe('completed');
    } finally {
      await env.cleanup();
    }
  }, 60000);
});
