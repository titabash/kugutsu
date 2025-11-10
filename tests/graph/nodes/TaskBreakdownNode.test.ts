/**
 * TaskBreakdownNode Unit Tests (Jest)
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

// Import after mocking
const { taskBreakdownNode } = await import('../../../src/graph/nodes/TaskBreakdownNode.js');
const { createInitialState } = await import('../../../src/graph/state.js');
const { MockAIProvider, createMockMessage } = await import(
  '../../../src/providers/MockAIProvider.js'
);
const { AIProviderFactory } = await import('../../../src/providers/AIProviderFactory.js');

describe('TaskBreakdownNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mock provider
    mockProvider = new MockAIProvider();
    (AIProviderFactory.create as any).mockReturnValue(mockProvider);

    // Create fresh mock persistence
    mockPersistence = {
      initialize: jest.fn<any>().mockResolvedValue(undefined),
      loadStoryMapping: jest.fn<any>().mockResolvedValue({
        persona: {
          name: 'Test User',
          role: 'End User',
          goal: 'Test goal',
        },
        epics: [
          {
            id: 'epic-1',
            title: 'Authentication',
            description: 'User auth',
            priority: 90,
            stories: [
              {
                id: 'story-1',
                title: 'Login',
                description: 'User login',
                priority: 90,
                acceptanceCriteria: ['Users can login'],
                tasks: [],
              },
            ],
          },
        ],
      }),
      loadDatabaseSchema: jest.fn<any>().mockResolvedValue({
        tables: [
          {
            name: 'users',
            columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
          },
        ],
      }),
      loadAPISpec: jest.fn<any>().mockResolvedValue({
        openapi: '3.0.0',
        paths: {
          '/api/auth/login': {
            post: {
              summary: 'User login',
            },
          },
        },
      }),
      loadUIUXScreens: jest.fn<any>().mockResolvedValue({
        screens: [
          {
            id: 'screen-1',
            name: 'Login Screen',
            description: 'Login page',
          },
        ],
      }),
      saveTaskList: jest.fn<any>().mockResolvedValue(undefined),
      saveDependencyGraph: jest.fn<any>().mockResolvedValue(undefined),
      saveKanbanState: jest.fn<any>().mockResolvedValue(undefined),
    };
  });

  describe('Task Breakdown', () => {
    test('should break design into implementation tasks', async () => {
      // Mock AI response with task list
      const taskListResponse = {
        tasks: [
          {
            id: 'task-1',
            title: 'Implement login backend',
            description: 'Backend authentication',
            estimatedHours: 6,
            priority: 90,
            dependencies: [],
            technicalNotes: 'Use JWT',
          },
          {
            id: 'task-2',
            title: 'Implement login frontend',
            description: 'Frontend UI',
            estimatedHours: 4,
            priority: 85,
            dependencies: ['task-1'],
            technicalNotes: 'Use React',
          },
        ],
      };

      const jsonResponse = '```json\n' + JSON.stringify(taskListResponse, null, 2) + '\n```';

      mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
        yield createMockMessage.assistant(jsonResponse);
        yield createMockMessage.result(true);
      });

      const initialState = createInitialState('Implement authentication', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      // Set required fields (currentProjectId and activeSprint)
      initialState.currentProjectId = 'test-project-001';
      initialState.activeSprint = {
        id: 'sprint-test-001',
        name: 'Test Sprint',
        goal: 'Test sprint goal',
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

      const stateWithDesignDocs = {
        ...initialState,
        currentProjectId: 'test-project',
        storyMapping: {
          persona: {
            name: 'Test User',
            role: 'End User',
            goal: 'Test goal',
          },
          epics: [],
        },
        designDocs: {
          approved: true,
          designDocsPath: '.kugutsu/projects/test-project/design/design-docs.md',
          uiuxPath: '.kugutsu/projects/test-project/design/wireframes.md',
          databasePath: '.kugutsu/projects/test-project/design/er-diagram.md',
          apiPath: '.kugutsu/projects/test-project/design/api-spec.md',
        },
      };

      // Execute node
      const result = await taskBreakdownNode(stateWithDesignDocs);

      // Verify tasks were created
      expect(result.globalTasks).toBeDefined();
      expect(result.globalTasks!.length).toBe(2);
      expect(result.globalTasks![0].title).toBe('Implement login backend');
      expect(result.globalTasks![1].title).toBe('Implement login frontend');

      // Verify dependency graph
      expect(result.dependencyGraph).toBeDefined();
      expect(result.dependencyGraph!.nodes.length).toBe(2);
      expect(result.dependencyGraph!.edges.length).toBe(1);
      expect(result.dependencyGraph!.edges[0]).toEqual({
        from: 'task-2',
        to: 'task-1',
        type: 'depends_on',
      });

      // Verify critical path
      expect(result.dependencyGraph!.criticalPath).toBeDefined();
      expect(result.dependencyGraph!.criticalPath.length).toBeGreaterThan(0);

      // Verify parallel groups
      expect(result.dependencyGraph!.parallelGroups).toBeDefined();

      // Verify persistence calls
      expect(mockPersistence.saveTaskList).toHaveBeenCalled();
      expect(mockPersistence.saveDependencyGraph).toHaveBeenCalled();
      expect(mockPersistence.saveKanbanState).toHaveBeenCalled();

      // Verify logs
      expect(result.logs).toBeDefined();
      expect(result.logs!.some((log) => log.message.includes('タスク分解完了'))).toBe(true);
    });

    test('should handle tasks with no dependencies', async () => {
      const taskListResponse = {
        tasks: [
          {
            id: 'task-1',
            title: 'Setup project',
            description: 'Initial setup',
            estimatedHours: 2,
            priority: 100,
            dependencies: [],
            technicalNotes: '',
          },
          {
            id: 'task-2',
            title: 'Configure linter',
            description: 'Setup linter',
            estimatedHours: 1,
            priority: 80,
            dependencies: [],
            technicalNotes: '',
          },
        ],
      };

      const jsonResponse = '```json\n' + JSON.stringify(taskListResponse, null, 2) + '\n```';

      mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
        yield createMockMessage.assistant(jsonResponse);
        yield createMockMessage.result(true);
      });

      const initialState = createInitialState('Setup project', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithDesignDocs = {
        ...initialState,
        currentProjectId: 'test-project',
        storyMapping: {
          persona: {
            name: 'Test User',
            role: 'End User',
            goal: 'Test goal',
          },
          epics: [],
        },
        designDocs: {
          approved: true,
          designDocsPath: '.kugutsu/projects/test-project/design/design-docs.md',
        },
      };

      const result = await taskBreakdownNode(stateWithDesignDocs);

      // Verify parallel execution is possible (no dependencies)
      expect(result.dependencyGraph).toBeDefined();
      expect(result.dependencyGraph!.edges.length).toBe(0);
      expect(result.dependencyGraph!.parallelGroups.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle AI response parsing failure', async () => {
      mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
        yield createMockMessage.assistant('Invalid JSON response');
        yield createMockMessage.result(true);
      });

      const initialState = createInitialState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithDesignDocs = {
        ...initialState,
        currentProjectId: 'test-project',
        storyMapping: {
          persona: {
            name: 'Test User',
            role: 'End User',
            goal: 'Test goal',
          },
          epics: [],
        },
        designDocs: {
          approved: true,
          designDocsPath: '.kugutsu/projects/test-project/design/design-docs.md',
        },
      };

      const result = await taskBreakdownNode(stateWithDesignDocs);

      // Should return error in logs
      expect(result.logs).toBeDefined();
      expect(result.logs!.some((log) => log.level === 'error')).toBe(true);
    });

    test('should handle missing design docs', async () => {
      // Override mock to return null for this test
      mockPersistence.loadStoryMapping.mockResolvedValue(null);

      const initialState = createInitialState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithoutDesignDocs = {
        ...initialState,
        currentProjectId: 'test-project',
      };

      const result = await taskBreakdownNode(stateWithoutDesignDocs);

      // Should return warn for missing story mapping
      expect(result.logs).toBeDefined();
      expect(result.logs!.some((log) => log.level === 'warn' && log.message.includes('ストーリーマッピングなし'))).toBe(
        true
      );
    });
  });

  describe('Dependency Graph', () => {
    test('should calculate critical path correctly', async () => {
      const taskListResponse = {
        tasks: [
          {
            id: 'task-1',
            title: 'Task 1',
            description: 'First task',
            estimatedHours: 2,
            priority: 100,
            dependencies: [],
            technicalNotes: '',
          },
          {
            id: 'task-2',
            title: 'Task 2',
            description: 'Second task',
            estimatedHours: 3,
            priority: 90,
            dependencies: ['task-1'],
            technicalNotes: '',
          },
          {
            id: 'task-3',
            title: 'Task 3',
            description: 'Third task',
            estimatedHours: 4,
            priority: 80,
            dependencies: ['task-2'],
            technicalNotes: '',
          },
        ],
      };

      const jsonResponse = '```json\n' + JSON.stringify(taskListResponse, null, 2) + '\n```';

      mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
        yield createMockMessage.assistant(jsonResponse);
        yield createMockMessage.result(true);
      });

      const initialState = createInitialState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithDesignDocs = {
        ...initialState,
        currentProjectId: 'test-project',
        storyMapping: {
          persona: {
            name: 'Test User',
            role: 'End User',
            goal: 'Test goal',
          },
          epics: [],
        },
        designDocs: {
          approved: true,
          designDocsPath: '.kugutsu/projects/test-project/design/design-docs.md',
        },
      };

      const result = await taskBreakdownNode(stateWithDesignDocs);

      // Verify critical path includes all sequential tasks
      expect(result.dependencyGraph).toBeDefined();
      expect(result.dependencyGraph!.criticalPath).toContain('task-1');
      expect(result.dependencyGraph!.criticalPath).toContain('task-2');
      expect(result.dependencyGraph!.criticalPath).toContain('task-3');
    });
  });

  describe('Kanban State', () => {
    test('should create initial Kanban state with correct columns', async () => {
      const taskListResponse = {
        tasks: [
          {
            id: 'task-1',
            title: 'Task 1',
            description: 'First task',
            estimatedHours: 2,
            priority: 100,
            dependencies: [],
            technicalNotes: '',
          },
        ],
      };

      const jsonResponse = '```json\n' + JSON.stringify(taskListResponse, null, 2) + '\n```';

      mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
        yield createMockMessage.assistant(jsonResponse);
        yield createMockMessage.result(true);
      });

      const initialState = createInitialState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithDesignDocs = {
        ...initialState,
        currentProjectId: 'test-project',
        storyMapping: {
          persona: {
            name: 'Test User',
            role: 'End User',
            goal: 'Test goal',
          },
          epics: [],
        },
        designDocs: {
          approved: true,
          designDocsPath: '.kugutsu/projects/test-project/design/design-docs.md',
        },
      };

      await taskBreakdownNode(stateWithDesignDocs);

      // Verify Kanban state was saved
      expect(mockPersistence.saveKanbanState).toHaveBeenCalledWith(
        'test-project',
        expect.objectContaining({
          columns: expect.arrayContaining([
            expect.objectContaining({ id: 'pending' }),
            expect.objectContaining({ id: 'ready' }),
            expect.objectContaining({ id: 'in_progress' }),
            expect.objectContaining({ id: 'in_review' }),
            expect.objectContaining({ id: 'completed' }),
            expect.objectContaining({ id: 'failed' }),
          ]),
        })
      );
    });
  });

  describe('Enhanced Error Handling with JSONExtractor', () => {
    test('should retry JSON extraction on temporary parse failures', async () => {
      let callCount = 0;
      mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
        callCount++;
        if (callCount === 1) {
          // First attempt: Invalid JSON
          yield createMockMessage.assistant('```json\n{invalid json}\n```');
        } else if (callCount === 2) {
          // Second attempt: Valid JSON
          const taskListResponse = {
            tasks: [
              {
                id: 'task-1',
                title: 'Retry success',
                description: 'Task after retry',
                estimatedHours: 4,
                priority: 80,
                dependencies: [],
                technicalNotes: '',
              },
            ],
          };
          yield createMockMessage.assistant(
            '```json\n' + JSON.stringify(taskListResponse, null, 2) + '\n```'
          );
        }
        yield createMockMessage.result(true);
      });

      const initialState = createInitialState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithDesignDocs = {
        ...initialState,
        currentProjectId: 'test-project',
        storyMapping: {
          persona: {
            name: 'Test User',
            role: 'End User',
            goal: 'Test goal',
          },
          epics: [],
        },
        designDocs: {
          approved: true,
          designDocsPath: '.kugutsu/projects/test-project/design/design-docs.md',
        },
      };

      const result = await taskBreakdownNode(stateWithDesignDocs);

      // Should succeed after retry
      expect(result.globalTasks).toBeDefined();
      expect(result.globalTasks!.length).toBe(1);
      expect(result.globalTasks![0].title).toBe('Retry success');
    });

    test('should log detailed error information on JSON parse failure', async () => {
      const invalidJSON = '```json\n{"tasks": [{"id": "task-1" "title": "missing comma"}]}\n```';
      mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
        yield createMockMessage.assistant(invalidJSON);
        yield createMockMessage.result(true);
      });

      const initialState = createInitialState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithDesignDocs = {
        ...initialState,
        currentProjectId: 'test-project',
        storyMapping: {
          persona: {
            name: 'Test User',
            role: 'End User',
            goal: 'Test goal',
          },
          epics: [],
        },
        designDocs: {
          approved: true,
          designDocsPath: '.kugutsu/projects/test-project/design/design-docs.md',
        },
      };

      const result = await taskBreakdownNode(stateWithDesignDocs);

      // Should return error with detailed information
      expect(result.logs).toBeDefined();
      expect(result.logs!.some((log) => log.level === 'error')).toBe(true);

      // Error should contain details about the parse failure
      const errorLog = result.logs!.find((log) => log.level === 'error');
      expect(errorLog).toBeDefined();
    });

    test('should handle missing JSON block with fallback strategy', async () => {
      mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
        yield createMockMessage.assistant('This response has no JSON block at all.');
        yield createMockMessage.result(true);
      });

      const initialState = createInitialState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithDesignDocs = {
        ...initialState,
        currentProjectId: 'test-project',
        storyMapping: {
          persona: {
            name: 'Test User',
            role: 'End User',
            goal: 'Test goal',
          },
          epics: [],
        },
        designDocs: {
          approved: true,
          designDocsPath: '.kugutsu/projects/test-project/design/design-docs.md',
        },
      };

      const result = await taskBreakdownNode(stateWithDesignDocs);

      // Should return error indicating no JSON block was found
      expect(result.logs).toBeDefined();
      expect(result.logs!.some((log) => log.level === 'error')).toBe(true);
    });

    test('should fail gracefully after maximum retries', async () => {
      let attemptCount = 0;
      mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
        attemptCount++;
        // Always return invalid JSON
        yield createMockMessage.assistant('```json\n{invalid}\n```');
        yield createMockMessage.result(true);
      });

      const initialState = createInitialState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithDesignDocs = {
        ...initialState,
        currentProjectId: 'test-project',
        storyMapping: {
          persona: {
            name: 'Test User',
            role: 'End User',
            goal: 'Test goal',
          },
          epics: [],
        },
        designDocs: {
          approved: true,
          designDocsPath: '.kugutsu/projects/test-project/design/design-docs.md',
        },
      };

      const result = await taskBreakdownNode(stateWithDesignDocs);

      // Should return error after max retries
      expect(result.logs).toBeDefined();
      expect(result.logs!.some((log) => log.level === 'error')).toBe(true);

      // Should indicate retry limit was reached
      const errorLog = result.logs!.find((log) => log.level === 'error');
      expect(errorLog).toBeDefined();
    });
  });
});
