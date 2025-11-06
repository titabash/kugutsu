/**
 * SprintPlanningNode Unit Tests (Jest)
 */

import { jest } from '@jest/globals';
import { randomUUID } from 'crypto';

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
const { sprintPlanningNode, sprintPlanningRouter } = await import(
  '../../../src/graph/nodes/SprintPlanningNode.js'
);
const { createInitialState } = await import('../../../src/graph/state.js');
const { MockAIProvider, createMockMessage } = await import(
  '../../../src/providers/MockAIProvider.js'
);
const { AIProviderFactory } = await import('../../../src/providers/AIProviderFactory.js');

describe('SprintPlanningNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mock provider
    mockProvider = new MockAIProvider();
    (AIProviderFactory.create as any).mockReturnValue(mockProvider);

    // Create fresh mock persistence
    mockPersistence = {
      initialize: jest.fn<any>().mockResolvedValue(undefined),
      loadActiveSprint: jest.fn<any>().mockResolvedValue(null),
      saveActiveSprint: jest.fn<any>().mockResolvedValue(undefined),
      saveGlobalQueue: jest.fn<any>().mockResolvedValue(undefined),
    };
  });

  describe('Sprint Creation', () => {
    test('should create a sprint from unassigned tasks', async () => {
      // Setup: unassigned tasks
      const task1 = {
        id: 'task-1',
        type: 'feature' as const,
        projectId: 'project-1',
        title: 'Implement auth backend',
        description: 'Backend authentication',
        priority: 90,
        dynamicPriority: 90,
        dependencies: [],
        status: 'pending' as const,
        sprint: undefined,
        requestTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const task2 = {
        id: 'task-2',
        type: 'feature' as const,
        projectId: 'project-1',
        title: 'Implement auth frontend',
        description: 'Frontend authentication',
        priority: 85,
        dynamicPriority: 85,
        dependencies: ['task-1'],
        status: 'pending' as const,
        sprint: undefined,
        requestTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock AI response for sprint planning
      const sprintPlanResponse = {
        sprints: [
          {
            name: 'Sprint 1: Authentication System',
            goal: 'Implement complete authentication flow',
            taskIds: ['task-1', 'task-2'],
            estimatedHours: 12,
            deployable: true,
          },
        ],
      };

      const jsonResponse = '```json\n' + JSON.stringify(sprintPlanResponse, null, 2) + '\n```';

      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant(jsonResponse),
          createMockMessage.result(true),
        ],
      });

      const initialState = createInitialState('Implement authentication', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithTasks = {
        ...initialState,
        globalTasks: [task1, task2],
      };

      // Execute node
      const result = await sprintPlanningNode(stateWithTasks);

      // Verify sprint creation
      expect(result.activeSprint).toBeDefined();
      expect(result.activeSprint!.name).toBe('Sprint 1: Authentication System');
      expect(result.activeSprint!.goal).toBe('Implement complete authentication flow');
      expect(result.activeSprint!.taskIds).toEqual(['task-1', 'task-2']);
      expect(result.activeSprint!.status).toBe('active');
      expect(result.activeSprint!.deployable).toBe(true);

      // Verify tasks were assigned to sprint
      expect(result.globalTasks).toBeDefined();
      const assignedTask1 = result.globalTasks!.find((t) => t.id === 'task-1');
      const assignedTask2 = result.globalTasks!.find((t) => t.id === 'task-2');
      expect(assignedTask1?.sprint).toBe(result.activeSprint!.id);
      expect(assignedTask2?.sprint).toBe(result.activeSprint!.id);

      // Verify persistence calls
      expect(mockPersistence.saveActiveSprint).toHaveBeenCalled();
      expect(mockPersistence.saveGlobalQueue).toHaveBeenCalled();
    });

    test('should not create sprint if active sprint exists', async () => {
      const existingSprint = {
        id: 'sprint-123',
        name: 'Sprint 1: Existing',
        goal: 'Existing sprint goal',
        taskIds: ['task-1'],
        status: 'active' as const,
        deployable: true,
        metadata: {
          estimatedHours: 10,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };

      mockPersistence.loadActiveSprint.mockResolvedValue(existingSprint);

      const initialState = createInitialState('New request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const result = await sprintPlanningNode(initialState);

      // Should return existing sprint
      expect(result.activeSprint).toEqual(existingSprint);
      expect(mockProvider.getCallCount()).toBe(0); // AI not called
    });

    test('should handle no unassigned tasks', async () => {
      const initialState = createInitialState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithNoTasks = {
        ...initialState,
        globalTasks: [],
      };

      const result = await sprintPlanningNode(stateWithNoTasks);

      // Should not create sprint
      expect(result.activeSprint).toBeUndefined();
      expect(result.logs).toBeDefined();
      expect(result.logs![0].message).toContain('すべてのタスクがスプリントに割り当て済み');
    });
  });

  describe('Sprint Metadata', () => {
    test('should set correct sprint metadata', async () => {
      const task1 = {
        id: 'task-1',
        type: 'feature' as const,
        projectId: 'project-1',
        title: 'Task 1',
        description: 'Description',
        priority: 80,
        dynamicPriority: 80,
        dependencies: [],
        status: 'pending' as const,
        sprint: undefined,
        requestTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const sprintPlanResponse = {
        sprints: [
          {
            name: 'Sprint 1: Feature',
            goal: 'Goal',
            taskIds: ['task-1'],
            estimatedHours: 8,
            deployable: true,
          },
        ],
      };

      const jsonResponse = '```json\n' + JSON.stringify(sprintPlanResponse, null, 2) + '\n```';

      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant(jsonResponse),
          createMockMessage.result(true),
        ],
      });

      const initialState = createInitialState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithTasks = {
        ...initialState,
        globalTasks: [task1],
      };

      const result = await sprintPlanningNode(stateWithTasks);

      expect(result.activeSprint!.metadata).toBeDefined();
      expect(result.activeSprint!.metadata.estimatedHours).toBe(8);
      expect(result.activeSprint!.metadata.completedTasksCount).toBe(0);
      expect(result.activeSprint!.metadata.failedTasksCount).toBe(0);
      expect(result.activeSprint!.metadata.blockers).toEqual([]);
      expect(result.activeSprint!.startedAt).toBeInstanceOf(Date);
    });
  });

  describe('sprintPlanningRouter', () => {
    test('should route to engineer_dispatch when active sprint exists', () => {
      const sprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        goal: 'Goal',
        taskIds: ['task-1'],
        status: 'active' as const,
        deployable: true,
        metadata: {
          estimatedHours: 10,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };

      const state = createInitialState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithSprint = {
        ...state,
        activeSprint: sprint,
      };

      const route = sprintPlanningRouter(stateWithSprint);
      expect(route).toBe('engineer_dispatch');
    });

    test('should route to END when no active sprint', () => {
      const state = createInitialState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithoutSprint = {
        ...state,
        activeSprint: null,
      };

      const route = sprintPlanningRouter(stateWithoutSprint);
      expect(route).toBe('END');
    });
  });

  describe('Error Handling', () => {
    test('should handle AI response parsing failure', async () => {
      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant('Invalid JSON response'),
          createMockMessage.result(true),
        ],
      });

      const task1 = {
        id: 'task-1',
        type: 'feature' as const,
        projectId: 'project-1',
        title: 'Task',
        description: 'Desc',
        priority: 80,
        dynamicPriority: 80,
        dependencies: [],
        status: 'pending' as const,
        sprint: undefined,
        requestTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const initialState = createInitialState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithTasks = {
        ...initialState,
        globalTasks: [task1],
      };

      const result = await sprintPlanningNode(stateWithTasks);

      // Should return error log
      expect(result.logs).toBeDefined();
      expect(result.logs![0].level).toBe('error');
      expect(result.logs![0].message).toContain('スプリント計画の生成に失敗');
    });
  });
});
