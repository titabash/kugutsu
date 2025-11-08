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

      // Manually setup mock responses (NOT using setupDefaultMockResponses)
      // Create task directories and instructions
      const fs = await import('fs/promises');
      await fs.mkdir(path.join(env.kugutsuDir, 'tasks/task-001'), { recursive: true });
      await fs.writeFile(
        path.join(env.kugutsuDir, 'tasks/task-001/instruction.md'),
        '# Task: High Quality Implementation\n\nThis task will be approved immediately.',
        'utf-8'
      );

      // ProductOwner responses
      mockProvider.setMockResponse(/tech.*stack/i, {
        messages: [
          createMockMessage.assistant('Analyzing tech stack...'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(env.kugutsuDir, 'tech-stack.json'),
                content: JSON.stringify({ languages: ['TypeScript'], frameworks: ['Node.js'] }, null, 2),
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      mockProvider.setMockResponse(/requirements/i, {
        messages: [
          createMockMessage.assistant('Analyzing requirements...'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(env.kugutsuDir, 'requirements.json'),
                content: JSON.stringify({ functional: ['High Quality Implementation'], nonFunctional: [] }, null, 2),
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      mockProvider.setMockResponse(/task.*generation/i, {
        messages: [
          createMockMessage.assistant('Generating tasks...'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(env.kugutsuDir, 'tasks.json'),
                content: JSON.stringify(tasks, null, 2),
              },
            },
          }),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(env.kugutsuDir, 'tasks/task-001/instruction.md'),
                content: '# Task: High Quality Implementation\n\nThis task will be approved immediately.',
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      // Engineer response
      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant('実装中...', 'session-test'),
          {
            type: 'result' as const,
            content: {
              duration: 100,
              tokenUsage: { input: 10, output: 20, total: 30 },
              cost: 0.001,
              permissionDenials: 0,
              success: true,
            },
            session_id: 'session-test',
            timestamp: new Date(),
          },
        ],
        delay: 100,
      });

      // Review response - APPROVED
      mockProvider.setMockResponse(/Review/i, createReviewMockResponse(env.kugutsuDir, 'task-001', 'approved'));

      // Create initial state (approved task should complete normally)
      const initialState = createInitialState('Implement high quality feature', {
        maxEngineers: 1,
        maxTurns: 15,
        baseBranch: 'main',
        baseRepoPath: env.tempDir,
        worktreeBasePath: `${env.tempDir}/worktrees`,
        provider: 'mock',
      });

      // Compile and execute graph
      const graph = compileParallelDevGraph();
      const states: any[] = [];

      try {
        const stream = await graph.stream(initialState);
        for await (const event of stream) {
          states.push(event);
        }
      } catch (error) {
        console.log('Graph completed or stopped');
      }

      // Extract final state
      const finalState = states[states.length - 1];
      const finalTasks = finalState.check_completion?.tasks || states.flatMap(s =>
        s.merge_coordinator?.tasks || s.review?.tasks || []
      );

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

      // Manually setup mock responses
      const fs = await import('fs/promises');
      await fs.mkdir(path.join(env.kugutsuDir, 'tasks/task-002'), { recursive: true });
      await fs.writeFile(
        path.join(env.kugutsuDir, 'tasks/task-002/instruction.md'),
        '# Task: Implementation with Issues\n\nThis task will be rejected by review.',
        'utf-8'
      );

      // ProductOwner responses
      mockProvider.setMockResponse(/tech.*stack/i, {
        messages: [
          createMockMessage.assistant('Analyzing tech stack...'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(env.kugutsuDir, 'tech-stack.json'),
                content: JSON.stringify({ languages: ['TypeScript'], frameworks: ['Node.js'] }, null, 2),
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      mockProvider.setMockResponse(/requirements/i, {
        messages: [
          createMockMessage.assistant('Analyzing requirements...'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(env.kugutsuDir, 'requirements.json'),
                content: JSON.stringify({ functional: ['Implementation with Issues'], nonFunctional: [] }, null, 2),
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      mockProvider.setMockResponse(/task.*generation/i, {
        messages: [
          createMockMessage.assistant('Generating tasks...'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(env.kugutsuDir, 'tasks.json'),
                content: JSON.stringify(tasks, null, 2),
              },
            },
          }),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(env.kugutsuDir, 'tasks/task-002/instruction.md'),
                content: '# Task: Implementation with Issues\n\nThis task will be rejected by review.',
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      // Engineer response
      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant('実装中...', 'session-test'),
          {
            type: 'result' as const,
            content: {
              duration: 100,
              tokenUsage: { input: 10, output: 20, total: 30 },
              cost: 0.001,
              permissionDenials: 0,
              success: true,
            },
            session_id: 'session-test',
            timestamp: new Date(),
          },
        ],
        delay: 100,
      });

      // Review response - CHANGES_REQUESTED
      const rejectionComments = [
        'セキュリティ上の問題: パスワードがハッシュ化されていません',
        'テストカバレッジが不足しています',
        'エラーハンドリングが不適切です',
      ];

      mockProvider.setMockResponse(
        /Review/i,
        createReviewMockResponse(env.kugutsuDir, 'task-002', 'changes_requested', rejectionComments)
      );

      // Create initial state (reduced maxTurns to avoid infinite loop)
      const initialState = createInitialState('Implement feature with issues', {
        maxEngineers: 1,
        maxTurns: 10,  // Reduced to stop before recursion limit
        baseBranch: 'main',
        baseRepoPath: env.tempDir,
        worktreeBasePath: `${env.tempDir}/worktrees`,
        provider: 'mock',
      });

      // Compile and execute graph
      const graph = compileParallelDevGraph();
      const states: any[] = [];

      try {
        const stream = await graph.stream(initialState);
        for await (const event of stream) {
          states.push(event);
          // Stop after review to avoid infinite loop
          if ('review' in event) {
            break;
          }
        }
      } catch (error) {
        // Expected to hit recursion limit or max turns
        console.log('Graph stopped (expected)');
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

      // Manually setup mock responses
      const fs = await import('fs/promises');
      await fs.mkdir(path.join(env.kugutsuDir, 'tasks/task-003'), { recursive: true });
      await fs.writeFile(
        path.join(env.kugutsuDir, 'tasks/task-003/instruction.md'),
        '# Task: State Transition Test\n\nThis task tests state machine transitions.',
        'utf-8'
      );

      // ProductOwner responses
      mockProvider.setMockResponse(/tech.*stack/i, {
        messages: [
          createMockMessage.assistant('Analyzing tech stack...'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(env.kugutsuDir, 'tech-stack.json'),
                content: JSON.stringify({ languages: ['TypeScript'], frameworks: ['Node.js'] }, null, 2),
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      mockProvider.setMockResponse(/requirements/i, {
        messages: [
          createMockMessage.assistant('Analyzing requirements...'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(env.kugutsuDir, 'requirements.json'),
                content: JSON.stringify({ functional: ['State Transition Test'], nonFunctional: [] }, null, 2),
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      mockProvider.setMockResponse(/task.*generation/i, {
        messages: [
          createMockMessage.assistant('Generating tasks...'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(env.kugutsuDir, 'tasks.json'),
                content: JSON.stringify(tasks, null, 2),
              },
            },
          }),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(env.kugutsuDir, 'tasks/task-003/instruction.md'),
                content: '# Task: State Transition Test\n\nThis task tests state machine transitions.',
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      // Engineer response
      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant('実装中...', 'session-test'),
          {
            type: 'result' as const,
            content: {
              duration: 100,
              tokenUsage: { input: 10, output: 20, total: 30 },
              cost: 0.001,
              permissionDenials: 0,
              success: true,
            },
            session_id: 'session-test',
            timestamp: new Date(),
          },
        ],
        delay: 100,
      });

      // Review response - CHANGES_REQUESTED
      mockProvider.setMockResponse(
        /Review/i,
        createReviewMockResponse(env.kugutsuDir, 'task-003', 'changes_requested', ['修正が必要です'])
      );

      // Create initial state (reduced maxTurns to avoid infinite loop)
      const initialState = createInitialState('Test state transitions', {
        maxEngineers: 1,
        maxTurns: 10,  // Reduced to stop before recursion limit
        baseBranch: 'main',
        baseRepoPath: env.tempDir,
        worktreeBasePath: `${env.tempDir}/worktrees`,
        provider: 'mock',
      });

      // Compile and execute graph
      const graph = compileParallelDevGraph();
      const states: any[] = [];

      try {
        const stream = await graph.stream(initialState);
        for await (const event of stream) {
          states.push(event);
          // Stop after review to avoid infinite loop
          if ('review' in event) {
            break;
          }
        }
      } catch (error) {
        // Expected to hit recursion limit or max turns
        console.log('Graph stopped (expected)');
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

      // Manually setup mock responses
      const fs = await import('fs/promises');
      await fs.mkdir(path.join(env.kugutsuDir, 'tasks/task-A'), { recursive: true });
      await fs.mkdir(path.join(env.kugutsuDir, 'tasks/task-B'), { recursive: true });
      await fs.mkdir(path.join(env.kugutsuDir, 'tasks/task-C'), { recursive: true });
      await fs.writeFile(path.join(env.kugutsuDir, 'tasks/task-A/instruction.md'), '# Good Implementation', 'utf-8');
      await fs.writeFile(path.join(env.kugutsuDir, 'tasks/task-B/instruction.md'), '# Implementation with Issues', 'utf-8');
      await fs.writeFile(path.join(env.kugutsuDir, 'tasks/task-C/instruction.md'), '# Another Good Implementation', 'utf-8');

      // ProductOwner responses
      mockProvider.setMockResponse(/tech.*stack/i, {
        messages: [
          createMockMessage.assistant('Analyzing tech stack...'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(env.kugutsuDir, 'tech-stack.json'),
                content: JSON.stringify({ languages: ['TypeScript'], frameworks: ['Node.js'] }, null, 2),
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      mockProvider.setMockResponse(/requirements/i, {
        messages: [
          createMockMessage.assistant('Analyzing requirements...'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(env.kugutsuDir, 'requirements.json'),
                content: JSON.stringify({ functional: ['Multiple tasks'], nonFunctional: [] }, null, 2),
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      mockProvider.setMockResponse(/task.*generation/i, {
        messages: [
          createMockMessage.assistant('Generating tasks...'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(env.kugutsuDir, 'tasks.json'),
                content: JSON.stringify(tasks, null, 2),
              },
            },
          }),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(env.kugutsuDir, 'tasks/task-A/instruction.md'),
                content: '# Good Implementation',
              },
            },
          }),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(env.kugutsuDir, 'tasks/task-B/instruction.md'),
                content: '# Implementation with Issues',
              },
            },
          }),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(env.kugutsuDir, 'tasks/task-C/instruction.md'),
                content: '# Another Good Implementation',
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      // Engineer response
      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant('実装中...', 'session-test'),
          {
            type: 'result' as const,
            content: {
              duration: 100,
              tokenUsage: { input: 10, output: 20, total: 30 },
              cost: 0.001,
              permissionDenials: 0,
              success: true,
            },
            session_id: 'session-test',
            timestamp: new Date(),
          },
        ],
        delay: 100,
      });

      // Review responses - specific to each task
      mockProvider.setMockResponse(/task-A/i, createReviewMockResponse(env.kugutsuDir, 'task-A', 'approved'));

      mockProvider.setMockResponse(
        /task-B/i,
        createReviewMockResponse(env.kugutsuDir, 'task-B', 'changes_requested', ['エラーハンドリングが不足しています'])
      );

      mockProvider.setMockResponse(/task-C/i, createReviewMockResponse(env.kugutsuDir, 'task-C', 'approved'));

      // Create initial state (reduced maxTurns to avoid infinite loop)
      const initialState = createInitialState('Mixed review results test', {
        maxEngineers: 3,
        maxTurns: 10,  // Reduced to stop before recursion limit
        baseBranch: 'main',
        baseRepoPath: env.tempDir,
        worktreeBasePath: `${env.tempDir}/worktrees`,
        provider: 'mock',
      });

      // Compile and execute graph
      const graph = compileParallelDevGraph();
      const states: any[] = [];

      try {
        const stream = await graph.stream(initialState);
        for await (const event of stream) {
          states.push(event);
          // Stop after review to avoid infinite loop
          if ('review' in event) {
            break;
          }
        }
      } catch (error) {
        // Expected to hit recursion limit or max turns
        console.log('Graph stopped (expected)');
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
