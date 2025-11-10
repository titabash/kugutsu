/**
 * BacklogRefinementNode Unit Tests (Jest)
 *
 * バックログリファインメント機能のテスト
 */

import { jest } from '@jest/globals';

// Mock AIProviderFactory BEFORE importing
let mockProvider: any;
jest.unstable_mockModule('../../../src/providers/AIProviderFactory.js', () => ({
  AIProviderFactory: {
    create: jest.fn(() => mockProvider),
    getSupportedProviders: jest.fn(() => ['claude', 'mock']),
    isProviderSupported: jest.fn((provider: string) => ['claude', 'mock'].includes(provider)),
  },
}));

// Mock DataPersistence
let mockPersistence: any;
jest.unstable_mockModule('../../../src/utils/DataPersistence.js', () => ({
  DataPersistence: jest.fn().mockImplementation(() => mockPersistence),
}));

// Mock FileSystemManager
jest.unstable_mockModule('../../../src/utils/FileSystemManager.js', () => ({
  FileSystemManager: {
    writeJSON: jest.fn<any>().mockResolvedValue(undefined),
    readJSON: jest.fn<any>().mockResolvedValue({}),
    ensureDirectory: jest.fn<any>().mockResolvedValue(undefined),
  },
}));

// Import after mocking
const { backlogRefinementNode } = await import(
  '../../../src/graph/nodes/BacklogRefinementNode.js'
);
const { createInitialState } = await import('../../../src/graph/state.js');
const { MockAIProvider, createMockMessage } = await import(
  '../../../src/providers/MockAIProvider.js'
);
const { AIProviderFactory } = await import('../../../src/providers/AIProviderFactory.js');

describe('BacklogRefinementNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mock provider
    mockProvider = new MockAIProvider();
    (AIProviderFactory.create as any).mockReturnValue(mockProvider);

    // Create fresh mock persistence
    mockPersistence = {
      initialize: jest.fn<any>().mockResolvedValue(undefined),
      loadGlobalTasks: jest.fn<any>().mockResolvedValue([]),
      saveGlobalTasks: jest.fn<any>().mockResolvedValue(undefined),
      loadSprintHistory: jest.fn<any>().mockResolvedValue([]),
    };
  });

  describe('Priority Re-evaluation', () => {
    test('should re-evaluate task priorities based on business value', async () => {
      // Mock AI response with updated priorities
      const refinementResponse = {
        updatedTasks: [
          {
            id: 'task-1',
            title: 'User Authentication',
            priority: 95, // Updated from 80
            reason: 'Critical for user security',
            businessValue: 'high',
          },
          {
            id: 'task-2',
            title: 'Dashboard UI',
            priority: 70, // Updated from 90
            reason: 'Can be implemented after core features',
            businessValue: 'medium',
          },
        ],
      };

      const jsonResponse = '```json\n' + JSON.stringify(refinementResponse, null, 2) + '\n```';

      mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
        yield createMockMessage.assistant(jsonResponse);
        yield createMockMessage.result(true);
      });

      const initialState = createInitialState('Refine backlog', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      // Add existing tasks
      initialState.globalTasks = [
        {
          id: 'task-1',
          type: 'feature',
          title: 'User Authentication',
          description: 'Implement authentication',
          priority: 80,
          dependencies: [],
          status: 'pending',
          projectId: 'test-project',
          requestTimestamp: new Date(),
          dynamicPriority: 800,
          createdAt: new Date(),
        },
        {
          id: 'task-2',
          type: 'feature',
          title: 'Dashboard UI',
          description: 'Create dashboard',
          priority: 90,
          dependencies: [],
          status: 'pending',
          projectId: 'test-project',
          requestTimestamp: new Date(),
          dynamicPriority: 900,
          createdAt: new Date(),
        },
      ];

      const result = await backlogRefinementNode(initialState);

      // Verify priorities were updated
      expect(result.globalTasks).toBeDefined();
      expect(result.globalTasks!.length).toBe(2);

      const task1 = result.globalTasks!.find((t) => t.id === 'task-1');
      const task2 = result.globalTasks!.find((t) => t.id === 'task-2');

      expect(task1!.priority).toBe(95);
      expect(task2!.priority).toBe(70);
    });

    test('should provide detailed reasoning for priority changes', async () => {
      const refinementResponse = {
        updatedTasks: [
          {
            id: 'task-1',
            priority: 100,
            reason:
              'Security vulnerability identified - must be addressed immediately',
            technicalRisk: 'high',
            businessImpact: 'critical',
          },
        ],
      };

      mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
        yield createMockMessage.assistant(
          '```json\n' + JSON.stringify(refinementResponse, null, 2) + '\n```'
        );
        yield createMockMessage.result(true);
      });

      const initialState = createInitialState('Refine', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      initialState.globalTasks = [
        {
          id: 'task-1',
          type: 'bugfix',
          title: 'Fix login bug',
          description: 'Users cannot log in',
          priority: 50,
          dependencies: [],
          status: 'pending',
          projectId: 'test-project',
          requestTimestamp: new Date(),
          dynamicPriority: 500,
          createdAt: new Date(),
        },
      ];

      const result = await backlogRefinementNode(initialState);

      // Verify logs contain reasoning
      expect(result.logs).toBeDefined();
      const reasoningLog = result.logs!.find((log) =>
        log.message.includes('優先度変更')
      );
      expect(reasoningLog).toBeDefined();
    });
  });

  describe('Estimate Updates', () => {
    test('should update task estimates based on historical data', async () => {
      mockPersistence.loadSprintHistory.mockResolvedValue([
        {
          id: 'sprint-1',
          tasks: [
            { id: 'task-completed-1', estimatedHours: 8, actualHours: 12 },
            { id: 'task-completed-2', estimatedHours: 5, actualHours: 6 },
          ],
        },
      ]);

      const refinementResponse = {
        updatedTasks: [
          {
            id: 'task-3',
            estimatedHours: 10, // Updated from 8 based on similar tasks
            reason: '類似タスクの実績データから見積もりを上方修正',
            confidence: 'medium',
          },
        ],
      };

      mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
        yield createMockMessage.assistant(
          '```json\n' + JSON.stringify(refinementResponse, null, 2) + '\n```'
        );
        yield createMockMessage.result(true);
      });

      const initialState = createInitialState('Refine', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      initialState.globalTasks = [
        {
          id: 'task-3',
          type: 'feature',
          title: 'Similar feature',
          description: 'New feature',
          priority: 80,
          dependencies: [],
          status: 'pending',
          projectId: 'test-project',
          requestTimestamp: new Date(),
          dynamicPriority: 800,
          createdAt: new Date(),
          estimatedHours: 8,
        },
      ];

      const result = await backlogRefinementNode(initialState);

      // Verify estimates were updated
      const task3 = result.globalTasks!.find((t) => t.id === 'task-3');
      expect(task3!.estimatedHours).toBe(10);
    });
  });

  describe('Dependency Re-analysis', () => {
    test('should detect new dependencies based on code changes', async () => {
      const refinementResponse = {
        updatedTasks: [
          {
            id: 'task-2',
            dependencies: ['task-1'], // New dependency detected
            reason: 'task-2はtask-1で実装される認証モジュールに依存します',
          },
        ],
      };

      mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
        yield createMockMessage.assistant(
          '```json\n' + JSON.stringify(refinementResponse, null, 2) + '\n```'
        );
        yield createMockMessage.result(true);
      });

      const initialState = createInitialState('Refine', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      initialState.globalTasks = [
        {
          id: 'task-1',
          type: 'feature',
          title: 'Auth module',
          description: 'Authentication',
          priority: 90,
          dependencies: [],
          status: 'pending',
          projectId: 'test-project',
          requestTimestamp: new Date(),
          dynamicPriority: 900,
          createdAt: new Date(),
        },
        {
          id: 'task-2',
          type: 'feature',
          title: 'User profile',
          description: 'User profile page',
          priority: 80,
          dependencies: [], // Will be updated
          status: 'pending',
          projectId: 'test-project',
          requestTimestamp: new Date(),
          dynamicPriority: 800,
          createdAt: new Date(),
        },
      ];

      const result = await backlogRefinementNode(initialState);

      // Verify dependencies were updated
      const task2 = result.globalTasks!.find((t) => t.id === 'task-2');
      expect(task2!.dependencies).toContain('task-1');
    });

    test('should remove obsolete dependencies', async () => {
      const refinementResponse = {
        updatedTasks: [
          {
            id: 'task-2',
            dependencies: [], // Dependency removed
            reason: 'task-1が完了したため依存関係を削除',
          },
        ],
      };

      mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
        yield createMockMessage.assistant(
          '```json\n' + JSON.stringify(refinementResponse, null, 2) + '\n```'
        );
        yield createMockMessage.result(true);
      });

      const initialState = createInitialState('Refine', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      initialState.globalTasks = [
        {
          id: 'task-1',
          type: 'feature',
          title: 'Completed task',
          description: 'Done',
          priority: 90,
          dependencies: [],
          status: 'completed',
          projectId: 'test-project',
          requestTimestamp: new Date(),
          dynamicPriority: 900,
          createdAt: new Date(),
        },
        {
          id: 'task-2',
          type: 'feature',
          title: 'Dependent task',
          description: 'Depends on task-1',
          priority: 80,
          dependencies: ['task-1'], // Will be removed
          status: 'pending',
          projectId: 'test-project',
          requestTimestamp: new Date(),
          dynamicPriority: 800,
          createdAt: new Date(),
        },
      ];

      const result = await backlogRefinementNode(initialState);

      // Verify dependency was removed
      const task2 = result.globalTasks!.find((t) => t.id === 'task-2');
      expect(task2!.dependencies).toHaveLength(0);
    });
  });

  describe('Task Split and Merge', () => {
    test('should suggest splitting large tasks', async () => {
      const refinementResponse = {
        taskSplits: [
          {
            originalTaskId: 'task-large',
            reason: 'タスクが大きすぎるため、複数のサブタスクに分割することを推奨',
            suggestedTasks: [
              {
                id: 'task-large-1',
                title: 'User Auth - Backend API',
                description: 'Backend authentication API',
                estimatedHours: 6,
                priority: 90,
              },
              {
                id: 'task-large-2',
                title: 'User Auth - Frontend UI',
                description: 'Frontend login UI',
                estimatedHours: 5,
                priority: 85,
                dependencies: ['task-large-1'],
              },
            ],
          },
        ],
      };

      mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
        yield createMockMessage.assistant(
          '```json\n' + JSON.stringify(refinementResponse, null, 2) + '\n```'
        );
        yield createMockMessage.result(true);
      });

      const initialState = createInitialState('Refine', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      initialState.globalTasks = [
        {
          id: 'task-large',
          type: 'feature',
          title: 'Complete User Authentication System',
          description: 'Implement full auth system',
          priority: 90,
          dependencies: [],
          status: 'pending',
          projectId: 'test-project',
          requestTimestamp: new Date(),
          dynamicPriority: 900,
          createdAt: new Date(),
          estimatedHours: 20, // Very large task
        },
      ];

      const result = await backlogRefinementNode(initialState);

      // Verify task split suggestion
      expect(result.taskSplitSuggestions).toBeDefined();
      expect(result.taskSplitSuggestions!.length).toBeGreaterThan(0);
      expect(result.taskSplitSuggestions![0].suggestedTasks.length).toBe(2);
    });

    test('should suggest merging similar small tasks', async () => {
      const refinementResponse = {
        taskMerges: [
          {
            taskIds: ['task-small-1', 'task-small-2'],
            reason: '2つのタスクは密接に関連しており、1つのタスクとして実装する方が効率的',
            mergedTask: {
              id: 'task-merged',
              title: 'Update User Profile Features',
              description: 'Update avatar and bio features',
              estimatedHours: 3,
              priority: 70,
            },
          },
        ],
      };

      mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
        yield createMockMessage.assistant(
          '```json\n' + JSON.stringify(refinementResponse, null, 2) + '\n```'
        );
        yield createMockMessage.result(true);
      });

      const initialState = createInitialState('Refine', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      initialState.globalTasks = [
        {
          id: 'task-small-1',
          type: 'feature',
          title: 'Update user avatar',
          description: 'Allow users to update avatar',
          priority: 70,
          dependencies: [],
          status: 'pending',
          projectId: 'test-project',
          requestTimestamp: new Date(),
          dynamicPriority: 700,
          createdAt: new Date(),
          estimatedHours: 1.5,
        },
        {
          id: 'task-small-2',
          type: 'feature',
          title: 'Update user bio',
          description: 'Allow users to update bio',
          priority: 70,
          dependencies: [],
          status: 'pending',
          projectId: 'test-project',
          requestTimestamp: new Date(),
          dynamicPriority: 700,
          createdAt: new Date(),
          estimatedHours: 1.5,
        },
      ];

      const result = await backlogRefinementNode(initialState);

      // Verify task merge suggestion
      expect(result.taskMergeSuggestions).toBeDefined();
      expect(result.taskMergeSuggestions!.length).toBeGreaterThan(0);
      expect(result.taskMergeSuggestions![0].taskIds).toContain('task-small-1');
      expect(result.taskMergeSuggestions![0].taskIds).toContain('task-small-2');
    });
  });

  describe('Error Handling', () => {
    test('should handle AI response parsing failure gracefully', async () => {
      mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
        yield createMockMessage.assistant('Invalid JSON response');
        yield createMockMessage.result(true);
      });

      const initialState = createInitialState('Refine', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      initialState.globalTasks = [
        {
          id: 'task-1',
          type: 'feature',
          title: 'Test',
          description: 'Test',
          priority: 80,
          dependencies: [],
          status: 'pending',
          projectId: 'test-project',
          requestTimestamp: new Date(),
          dynamicPriority: 800,
          createdAt: new Date(),
        },
      ];

      const result = await backlogRefinementNode(initialState);

      // Should return error in logs
      expect(result.logs).toBeDefined();
      expect(result.logs!.some((log) => log.level === 'error')).toBe(true);
    });

    test('should handle empty task list', async () => {
      const initialState = createInitialState('Refine', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      initialState.globalTasks = []; // No tasks

      const result = await backlogRefinementNode(initialState);

      // Should return early with info message
      expect(result.logs).toBeDefined();
      expect(
        result.logs!.some(
          (log) => log.level === 'info' && log.message.includes('タスクがありません')
        )
      ).toBe(true);
    });
  });
});
