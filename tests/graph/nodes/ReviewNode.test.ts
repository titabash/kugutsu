/**
 * ReviewNode Unit Tests (Jest)
 */

import { jest } from '@jest/globals';
import type { Task } from '../../../src/graph/types.js';
import fs from 'fs/promises';

// Mock AIProviderFactory BEFORE importing
let mockProvider: any;
const actualAIProviderFactoryModule = (await import(
  '../../../src/providers/AIProviderFactory.js'
)) as typeof import('../../../src/providers/AIProviderFactory.js');
const actualAIProviderFactory = actualAIProviderFactoryModule.AIProviderFactory;
jest.unstable_mockModule('../../../src/providers/AIProviderFactory.js', () => {
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

// Mock AIFileWriter to properly handle file updates
jest.unstable_mockModule('../../../src/utils/AIFileWriter.js', () => ({
  AIFileWriter: {
    updateTaskInTasksJson: jest.fn(async (provider: any, tasksPath: string, taskId: string, updates: Record<string, any>, cwd: string) => {
      // Read tasks.json
      const fullPath = `${cwd}/${tasksPath}`;
      const content = await fs.readFile(fullPath, 'utf-8');
      const tasks = JSON.parse(content);

      // Update the task
      const taskIndex = tasks.findIndex((t: any) => t.id === taskId);
      if (taskIndex >= 0) {
        Object.assign(tasks[taskIndex], updates);
      }

      // Write back
      await fs.writeFile(fullPath, JSON.stringify(tasks, null, 2), 'utf-8');
    }),
  },
}));

// Import after mocking
const { reviewNode } = await import('../../../src/graph/nodes/ReviewNode.js');
const { createInitialState } = await import('../../../src/graph/state.js');
const { MockAIProvider, createMockMessage } = await import(
  '../../../src/providers/MockAIProvider.js'
);
const { AIProviderFactory } = await import('../../../src/providers/AIProviderFactory.js');

// Test helper to create state with activeSprint
function createTestState(userRequest: string, config: any) {
  const state = createInitialState(userRequest, config);
  state.activeSprint = {
    id: 'sprint-1',
    name: 'Sprint 1',
    goal: 'Test sprint',
    taskIds: [],
    status: 'active' as const,
    deployable: true,
    metadata: {
      estimatedHours: 0,
      blockers: [],
      completedTasksCount: 0,
      failedTasksCount: 0,
    },
  };
  state.nodeRetryCounters = {};
  return state;
}

describe('ReviewNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mock provider
    mockProvider = new MockAIProvider();
    (AIProviderFactory.create as any).mockReturnValue(mockProvider);
  });

  test('should approve code with no issues', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { mkdtemp, rm } = await import('fs/promises');
    const { tmpdir } = await import('os');

    const tempDir = await mkdtemp(path.join(tmpdir(), 'review-test-'));
    const kugutsuDir = path.join(tempDir, '.kugutsu');
    const worktreePath = path.join(tempDir, 'worktrees/task-001');

    try {
      // Create tasks.json
      const tasksData = [
        {
          id: 'task-001',
          title: 'Implemented feature',
          description: 'Feature implementation',
          priority: 100,
          dependencies: [],
          status: 'implemented',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          worktreePath,
          branchName: 'task/task-001',
        },
      ];

      await fs.mkdir(path.join(kugutsuDir, 'sprints/sprint-1/tasks/task-001'), { recursive: true });
      await fs.writeFile(
        path.join(kugutsuDir, 'tasks.json'),
        JSON.stringify(tasksData, null, 2),
        'utf-8'
      );

      // Setup mock provider - positive review with file write simulation
      const tasksJsonPath = path.join(kugutsuDir, 'tasks.json');
      mockProvider.setMockResponse(/review/i, {
        messages: [
          createMockMessage.assistant('コードを確認しています...'),
          createMockMessage.assistant('テストカバレッジは十分です'),
          createMockMessage.assistant('REVIEW_STATUS: APPROVED\n\n良好なコード品質です。'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(kugutsuDir, 'sprints/sprint-1/tasks/task-001/review.json'),
                content: JSON.stringify({
                  taskId: 'task-001',
                  status: 'approved',
                  reviewedBy: 'TechLeadAI',
                  reviewedAt: new Date().toISOString(),
                  comments: [],
                  summary: 'レビュー結果: approved',
                  suggestions: [],
                }, null, 2),
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      // Mock for tasks.json update
      mockProvider.setMockResponse(/tasks\.json/i, {
        messages: [
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: tasksJsonPath,
                content: JSON.stringify([{
                  id: 'task-001',
                  title: 'Implemented feature',
                  description: 'Feature implementation',
                  priority: 100,
                  dependencies: [],
                  status: 'reviewed',
                  createdAt: tasksData[0].createdAt,
                  updatedAt: new Date().toISOString(),
                  worktreePath,
                  branchName: 'task/task-001',
                }], null, 2),
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      // Create initial state
      const initialState = createTestState('Test request', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: tempDir,
        worktreeBasePath: path.join(tempDir, 'worktrees'),
      });

      initialState.tasksPath = '.kugutsu/tasks.json';

      // Execute node
      const result = await reviewNode(initialState, 'task-001');

      // Verify review.json was created
      const reviewPath = path.join(kugutsuDir, 'sprints/sprint-1/tasks/task-001/review.json');
      const reviewExists = await fs.access(reviewPath).then(() => true).catch(() => false);
      expect(reviewExists).toBe(true);

      // Verify review.json content
      const reviewContent = await fs.readFile(reviewPath, 'utf-8');
      const review = JSON.parse(reviewContent);
      expect(review.taskId).toBe('task-001');
      expect(review.status).toBe('approved');
      expect(review.reviewedBy).toBe('TechLeadAI');
      expect(review.comments).toBeDefined();

      // Verify tasks.json was updated
      const tasksContent = await fs.readFile(path.join(kugutsuDir, 'tasks.json'), 'utf-8');
      const updatedTasks = JSON.parse(tasksContent);
      expect(updatedTasks[0].status).toBe('reviewed');

      // Verify logs
      expect(result.logs).toBeDefined();
      const infoLog = result.logs!.find((log) => log.level === 'info');
      expect(infoLog).toBeDefined();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('should request changes when issues found', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { mkdtemp, rm } = await import('fs/promises');
    const { tmpdir } = await import('os');

    const tempDir = await mkdtemp(path.join(tmpdir(), 'review-test-'));
    const kugutsuDir = path.join(tempDir, '.kugutsu');
    const worktreePath = path.join(tempDir, 'worktrees/task-002');

    try {
      // Create tasks.json
      const tasksData = [
        {
          id: 'task-002',
          title: 'Implemented feature with issues',
          description: 'Feature with problems',
          priority: 100,
          dependencies: [],
          status: 'implemented',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          worktreePath,
          branchName: 'task/task-002',
        },
      ];

      await fs.mkdir(path.join(kugutsuDir, 'sprints/sprint-1/tasks/task-002'), { recursive: true });
      await fs.writeFile(
        path.join(kugutsuDir, 'tasks.json'),
        JSON.stringify(tasksData, null, 2),
        'utf-8'
      );

      // Setup mock provider - negative review with file write simulation
      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant('コードを確認しています...'),
          createMockMessage.assistant('Issue: テストカバレッジが不足しています'),
          createMockMessage.assistant('Problem: エラーハンドリングが不適切です'),
          createMockMessage.assistant('REVIEW_STATUS: CHANGES_REQUESTED\n\n改善が必要です。'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(kugutsuDir, 'sprints/sprint-1/tasks/task-002/review.json'),
                content: JSON.stringify({
                  taskId: 'task-002',
                  status: 'changes_requested',
                  reviewedBy: 'AI',
                  reviewedAt: new Date().toISOString(),
                  comments: [
                    { severity: 'major', message: 'テストカバレッジが不足しています' },
                    { severity: 'major', message: 'エラーハンドリングが不適切です' },
                  ],
                  summary: 'レビュー結果: changes_requested',
                  suggestions: [],
                }, null, 2),
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      // Create initial state
      const initialState = createTestState('Test request', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: tempDir,
        worktreeBasePath: path.join(tempDir, 'worktrees'),
      });

      initialState.tasksPath = '.kugutsu/tasks.json';

      // Execute node
      const result = await reviewNode(initialState, 'task-002');

      // Verify review.json was created
      const reviewPath = path.join(kugutsuDir, 'sprints/sprint-1/tasks/task-002/review.json');
      const reviewExists = await fs.access(reviewPath).then(() => true).catch(() => false);
      expect(reviewExists).toBe(true);

      // Verify review.json content
      const reviewContent = await fs.readFile(reviewPath, 'utf-8');
      const review = JSON.parse(reviewContent);
      expect(review.status).toBe('changes_requested');
      expect(review.comments).toBeDefined();
      expect(review.comments.length).toBeGreaterThan(0);

      // Verify tasks.json was NOT updated (status still 'implemented')
      const tasksContent = await fs.readFile(path.join(kugutsuDir, 'tasks.json'), 'utf-8');
      const updatedTasks = JSON.parse(tasksContent);
      expect(updatedTasks[0].status).toBe('implemented');

      // Verify warning log
      expect(result.logs).toBeDefined();
      const warnLog = result.logs!.find((log) => log.level === 'warn');
      expect(warnLog).toBeDefined();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('should detect issues from keywords in comments', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { mkdtemp, rm } = await import('fs/promises');
    const { tmpdir } = await import('os');

    const tempDir = await mkdtemp(path.join(tmpdir(), 'review-test-'));
    const kugutsuDir = path.join(tempDir, '.kugutsu');
    const worktreePath = path.join(tempDir, 'worktrees/task-003');

    try {
      // Create tasks.json
      const tasksData = [
        {
          id: 'task-003',
          title: 'Task with implicit issues',
          description: 'Issues detected from keywords',
          priority: 100,
          dependencies: [],
          status: 'implemented',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          worktreePath,
          branchName: 'task/task-003',
        },
      ];

      await fs.mkdir(path.join(kugutsuDir, 'sprints/sprint-1/tasks/task-003'), { recursive: true });
      await fs.writeFile(
        path.join(kugutsuDir, 'tasks.json'),
        JSON.stringify(tasksData, null, 2),
        'utf-8'
      );

      // Setup mock provider - implicit issues with file write simulation
      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant('コードを確認しています...'),
          createMockMessage.assistant('This code has a concern regarding security.'),
          createMockMessage.assistant('Please fix the error handling.'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(kugutsuDir, 'sprints/sprint-1/tasks/task-003/review.json'),
                content: JSON.stringify({
                  taskId: 'task-003',
                  status: 'changes_requested',
                  reviewedBy: 'TechLeadAI',
                  reviewedAt: new Date().toISOString(),
                  comments: [
                    { severity: 'major', message: 'Security concern detected' },
                    { severity: 'major', message: 'Error handling needs fixing' },
                  ],
                  summary: 'レビュー結果: changes_requested',
                  suggestions: [],
                }, null, 2),
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      // Create initial state
      const initialState = createTestState('Test request', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: tempDir,
        worktreeBasePath: path.join(tempDir, 'worktrees'),
      });

      initialState.tasksPath = '.kugutsu/tasks.json';

      // Execute node
      const result = await reviewNode(initialState, 'task-003');

      // Verify review.json was created
      const reviewPath = path.join(kugutsuDir, 'sprints/sprint-1/tasks/task-003/review.json');
      const reviewExists = await fs.access(reviewPath).then(() => true).catch(() => false);
      expect(reviewExists).toBe(true);

      // Verify review.json content - should be changes_requested due to keywords
      const reviewContent = await fs.readFile(reviewPath, 'utf-8');
      const review = JSON.parse(reviewContent);
      expect(review.status).toBe('changes_requested');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('should handle review errors gracefully', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { mkdtemp, rm } = await import('fs/promises');
    const { tmpdir } = await import('os');

    const tempDir = await mkdtemp(path.join(tmpdir(), 'review-test-'));
    const kugutsuDir = path.join(tempDir, '.kugutsu');
    const worktreePath = path.join(tempDir, 'worktrees/task-004');

    try {
      // Create tasks.json
      const tasksData = [
        {
          id: 'task-004',
          title: 'Failing review',
          description: 'Review will fail',
          priority: 100,
          dependencies: [],
          status: 'implemented',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          worktreePath,
          branchName: 'task/task-004',
        },
      ];

      await fs.mkdir(path.join(kugutsuDir, 'sprints/sprint-1/tasks/task-004'), { recursive: true });
      await fs.writeFile(
        path.join(kugutsuDir, 'tasks.json'),
        JSON.stringify(tasksData, null, 2),
        'utf-8'
      );

      // Setup mock provider with error
      mockProvider.setDefaultResponse({
        messages: [],
        shouldThrowError: true,
        errorMessage: 'Review error',
        simulateTools: true,  // Enable tool simulation
      });

      // Create initial state
      const initialState = createTestState('Test request', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: tempDir,
        worktreeBasePath: path.join(tempDir, 'worktrees'),
      });

      initialState.tasksPath = '.kugutsu/tasks.json';

      // Execute node
      const result = await reviewNode(initialState, 'task-004');

      // Verify error handling
      expect(result.logs).toBeDefined();
      const errorLog = result.logs!.find((log) => log.level === 'error');
      expect(errorLog).toBeDefined();
      expect(errorLog!.message).toContain('レビューに失敗');

      expect(result.metadata).toBeDefined();
      expect(result.metadata!.hasErrors).toBe(true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('should return error when task not found', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { mkdtemp, rm } = await import('fs/promises');
    const { tmpdir } = await import('os');

    const tempDir = await mkdtemp(path.join(tmpdir(), 'review-test-'));
    const kugutsuDir = path.join(tempDir, '.kugutsu');

    try {
      // Create empty tasks.json
      await fs.mkdir(kugutsuDir, { recursive: true });
      await fs.writeFile(
        path.join(kugutsuDir, 'tasks.json'),
        JSON.stringify([], null, 2),
        'utf-8'
      );

      // Create initial state
      const initialState = createTestState('Test request', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: tempDir,
        worktreeBasePath: path.join(tempDir, 'worktrees'),
      });

      initialState.tasksPath = '.kugutsu/tasks.json';

      // Execute node with non-existent task ID
      const result = await reviewNode(initialState, 'nonexistent-task');

      // Verify error log
      expect(result.logs).toBeDefined();
      expect(result.logs!.length).toBeGreaterThan(0);
      expect(result.logs![0].message).toContain('見つかりません');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('should return error when worktree not set', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { mkdtemp, rm } = await import('fs/promises');
    const { tmpdir } = await import('os');

    const tempDir = await mkdtemp(path.join(tmpdir(), 'review-test-'));
    const kugutsuDir = path.join(tempDir, '.kugutsu');

    try {
      // Create tasks.json with task without worktreePath
      const tasksData = [
        {
          id: 'task-005',
          title: 'Task without worktree',
          description: 'Missing worktree path',
          priority: 100,
          dependencies: [],
          status: 'implemented',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          // worktreePath is missing
        },
      ];

      await fs.mkdir(kugutsuDir, { recursive: true });
      await fs.writeFile(
        path.join(kugutsuDir, 'tasks.json'),
        JSON.stringify(tasksData, null, 2),
        'utf-8'
      );

      // Create initial state
      const initialState = createTestState('Test request', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: tempDir,
        worktreeBasePath: path.join(tempDir, 'worktrees'),
      });

      initialState.tasksPath = '.kugutsu/tasks.json';

      // Execute node
      const result = await reviewNode(initialState, 'task-005');

      // Verify error log
      expect(result.logs).toBeDefined();
      expect(result.logs!.length).toBeGreaterThan(0);
      expect(result.logs![0].message).toContain('worktree');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('File-based artifact management', () => {
    test('should create review.json and update tasks.json', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { mkdtemp, rm } = await import('fs/promises');
      const { tmpdir } = await import('os');

      const tempDir = await mkdtemp(path.join(tmpdir(), 'review-test-'));
      const kugutsuDir = path.join(tempDir, '.kugutsu');
      const worktreePath = path.join(tempDir, 'worktrees/task-001');

      try {
        // Create tasks.json with implemented task
        const tasksData = [
          {
            id: 'task-001',
            title: 'Implemented feature',
            description: 'Feature implementation',
            priority: 100,
            dependencies: [],
            status: 'implemented', // Ready for review
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            worktreePath,
            branchName: 'task/task-001',
            sessionId: 'session-123',
          },
        ];

        await fs.mkdir(path.join(kugutsuDir, 'sprints/sprint-1/tasks/task-001'), { recursive: true });
        await fs.writeFile(
          path.join(kugutsuDir, 'tasks.json'),
          JSON.stringify(tasksData, null, 2),
          'utf-8'
        );

        // Setup mock provider - positive review
        mockProvider.setDefaultResponse({
          messages: [
            createMockMessage.assistant('コードを確認しています...'),
            createMockMessage.assistant('テストカバレッジは十分です'),
            createMockMessage.assistant('REVIEW_STATUS: APPROVED\n\n良好なコード品質です。'),
            createMockMessage.result(true),
          ],
          simulateTools: true,  // Enable tool simulation for AIFileWriter
        });

        // Create initial state
        const initialState = createTestState('Test request', {
          maxEngineers: 1,
          maxTurns: 30,
          baseBranch: 'main',
          baseRepoPath: tempDir,
          worktreeBasePath: path.join(tempDir, 'worktrees'),
        });

        initialState.tasksPath = '.kugutsu/tasks.json';

        // Execute node
        const result = await reviewNode(initialState, 'task-001');

        // Verify review.json was created
        const reviewPath = path.join(kugutsuDir, 'sprints/sprint-1/tasks/task-001/review.json');
        const reviewExists = await fs.access(reviewPath).then(() => true).catch(() => false);
        expect(reviewExists).toBe(true);

        // Verify review.json content (artifacts.Review format)
        const reviewContent = await fs.readFile(reviewPath, 'utf-8');
        const review = JSON.parse(reviewContent);
        expect(review.taskId).toBe('task-001');
        expect(review.status).toBe('approved');
        expect(review.reviewedBy).toBe('TechLeadAI'); // artifacts.Review uses 'reviewedBy'
        expect(review.comments).toBeDefined();

        // Verify tasks.json was updated
        const updatedTasksContent = await fs.readFile(
          path.join(kugutsuDir, 'tasks.json'),
          'utf-8'
        );
        const updatedTasks = JSON.parse(updatedTasksContent);
        expect(updatedTasks[0].status).toBe('reviewed');

        // Verify result
        expect(result.logs).toBeDefined();
        const infoLog = result.logs!.find((log) => log.level === 'info');
        expect(infoLog).toBeDefined();
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    test('should handle changes_requested status', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { mkdtemp, rm } = await import('fs/promises');
      const { tmpdir } = await import('os');

      const tempDir = await mkdtemp(path.join(tmpdir(), 'review-test-'));
      const kugutsuDir = path.join(tempDir, '.kugutsu');
      const worktreePath = path.join(tempDir, 'worktrees/task-002');

      try {
        // Create tasks.json
        const tasksData = [
          {
            id: 'task-002',
            title: 'Feature with issues',
            description: 'Has problems',
            priority: 100,
            dependencies: [],
            status: 'implemented',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            worktreePath,
            branchName: 'task/task-002',
          },
        ];

        await fs.mkdir(path.join(kugutsuDir, 'sprints/sprint-1/tasks/task-002'), { recursive: true });
        await fs.writeFile(
          path.join(kugutsuDir, 'tasks.json'),
          JSON.stringify(tasksData, null, 2),
          'utf-8'
        );

        // Setup mock provider - negative review
        mockProvider.setDefaultResponse({
          messages: [
            createMockMessage.assistant('コードを確認しています...'),
            createMockMessage.assistant('Issue: テストカバレッジが不足しています'),
            createMockMessage.assistant('REVIEW_STATUS: CHANGES_REQUESTED'),
            createMockMessage.result(true),
          ],
          simulateTools: true,  // Enable tool simulation for AIFileWriter
        });

        // Create initial state
        const initialState = createTestState('Test request', {
          maxEngineers: 1,
          maxTurns: 30,
          baseBranch: 'main',
          baseRepoPath: tempDir,
          worktreeBasePath: path.join(tempDir, 'worktrees'),
        });

        initialState.tasksPath = '.kugutsu/tasks.json';

        // Execute node
        const result = await reviewNode(initialState, 'task-002');

        // Verify review.json was created
        const reviewPath = path.join(kugutsuDir, 'sprints/sprint-1/tasks/task-002/review.json');
        const reviewContent = await fs.readFile(reviewPath, 'utf-8');
        const review = JSON.parse(reviewContent);
        expect(review.status).toBe('changes_requested');

        // Verify tasks.json status is still 'implemented' (not moved to 'reviewed')
        const updatedTasksContent = await fs.readFile(
          path.join(kugutsuDir, 'tasks.json'),
          'utf-8'
        );
        const updatedTasks = JSON.parse(updatedTasksContent);
        expect(updatedTasks[0].status).toBe('implemented');

        // Verify warning log
        expect(result.logs).toBeDefined();
        const warnLog = result.logs!.find((log) => log.level === 'warn');
        expect(warnLog).toBeDefined();
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
