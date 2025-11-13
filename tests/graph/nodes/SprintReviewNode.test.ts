/**
 * SprintReviewNode Unit Tests (Jest)
 */

import { jest } from '@jest/globals';

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

// Mock DataPersistence
let mockPersistence: any;
jest.unstable_mockModule('../../../src/utils/DataPersistence.js', () => ({
  DataPersistence: jest.fn().mockImplementation(() => mockPersistence),
}));

// Import after mocking
const { sprintReviewNode, sprintReviewRouter } = await import(
  '../../../src/graph/nodes/SprintReviewNode.js'
);
const { createInitialState } = await import('../../../src/graph/state.js');
const { MockAIProvider, createMockMessage } = await import(
  '../../../src/providers/MockAIProvider.js'
);
const { AIProviderFactory } = await import('../../../src/providers/AIProviderFactory.js');

describe('SprintReviewNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mock provider
    mockProvider = new MockAIProvider();
    (AIProviderFactory.create as any).mockReturnValue(mockProvider);

    // Create fresh mock persistence
    mockPersistence = {
      initialize: jest.fn<any>().mockResolvedValue(undefined),
      addToSprintHistory: jest.fn<any>().mockResolvedValue(undefined),
      saveActiveSprint: jest.fn<any>().mockResolvedValue(undefined),
    };
  });

  describe('Sprint Completion', () => {
    test('should complete sprint when all tasks are done', async () => {
      const activeSprint = {
        id: 'sprint-1',
        name: 'Sprint 1: Authentication',
        goal: 'Implement authentication',
        taskIds: ['task-1', 'task-2'],
        status: 'active' as const,
        deployable: true,
        startedAt: new Date(),
        metadata: {
          estimatedHours: 12,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };

      const completedTask1 = {
        id: 'task-1',
        type: 'feature' as const,
        projectId: 'project-1',
        title: 'Backend auth',
        description: 'Backend',
        priority: 90,
        dynamicPriority: 90,
        dependencies: [],
        status: 'completed' as const,
        sprint: 'sprint-1',
        requestTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const completedTask2 = {
        id: 'task-2',
        type: 'feature' as const,
        projectId: 'project-1',
        title: 'Frontend auth',
        description: 'Frontend',
        priority: 85,
        dynamicPriority: 85,
        dependencies: ['task-1'],
        status: 'completed' as const,
        sprint: 'sprint-1',
        requestTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock AI response for deployability check
      const deployabilityResponse = {
        deployable: true,
        e2eTestable: true,
        reasoning: 'Complete authentication flow is ready',
        blockers: [],
      };

      const jsonResponse = '```json\n' + JSON.stringify(deployabilityResponse, null, 2) + '\n```';

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

      const stateWithSprint = {
        ...initialState,
        activeSprint,
        globalTasks: [completedTask1, completedTask2],
      };

      const result = await sprintReviewNode(stateWithSprint);

      // Verify sprint completion
      expect(result.activeSprint).toBeNull();
      expect(result.sprints).toBeDefined();
      expect(result.sprints!.length).toBe(1);

      const completedSprint = result.sprints![0];
      expect(completedSprint.status).toBe('completed');
      expect(completedSprint.deployable).toBe(true);
      expect(completedSprint.completedAt).toBeInstanceOf(Date);

      // Verify persistence calls
      expect(mockPersistence.addToSprintHistory).toHaveBeenCalled();
      expect(mockPersistence.saveActiveSprint).toHaveBeenCalledWith(null);

      // Verify state and file synchronization
      // activeSprint should be null in state update to prevent infinite loop
      expect(result.activeSprint).toBeNull();
    });

    test('should clear activeSprint file even if save fails', async () => {
      const activeSprint = {
        id: 'sprint-1',
        name: 'Sprint 1: Authentication',
        goal: 'Implement authentication',
        taskIds: ['task-1'],
        status: 'active' as const,
        deployable: true,
        startedAt: new Date(),
        metadata: {
          estimatedHours: 12,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };

      const completedTask = {
        id: 'task-1',
        type: 'feature' as const,
        projectId: 'project-1',
        title: 'Backend auth',
        description: 'Backend',
        priority: 90,
        dynamicPriority: 90,
        dependencies: [],
        status: 'completed' as const,
        sprint: 'sprint-1',
        requestTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock AI response for deployability check
      const deployabilityResponse = {
        deployable: true,
        e2eTestable: true,
        reasoning: 'Complete',
        blockers: [],
      };

      const jsonResponse = '```json\n' + JSON.stringify(deployabilityResponse, null, 2) + '\n```';

      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant(jsonResponse),
          createMockMessage.result(true),
        ],
      });

      // Simulate file save failure
      mockPersistence.saveActiveSprint = jest.fn<any>().mockRejectedValue(new Error('File save failed'));

      const initialState = createInitialState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithSprint = {
        ...initialState,
        activeSprint,
        globalTasks: [completedTask],
      };

      const result = await sprintReviewNode(stateWithSprint);

      // Should still return activeSprint: null even if file save fails
      // This prevents infinite loop (SprintPlanningNode will not read from file when state.activeSprint is null)
      expect(result.activeSprint).toBeNull();
      expect(mockPersistence.saveActiveSprint).toHaveBeenCalledWith(null);
    });

    test('should continue sprint when tasks are incomplete', async () => {
      const activeSprint = {
        id: 'sprint-1',
        name: 'Sprint 1: Feature',
        goal: 'Goal',
        taskIds: ['task-1', 'task-2'],
        status: 'active' as const,
        deployable: true,
        startedAt: new Date(),
        metadata: {
          estimatedHours: 12,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };

      const completedTask = {
        id: 'task-1',
        type: 'feature' as const,
        projectId: 'project-1',
        title: 'Task 1',
        description: 'Desc',
        priority: 90,
        dynamicPriority: 90,
        dependencies: [],
        status: 'completed' as const,
        sprint: 'sprint-1',
        requestTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const pendingTask = {
        id: 'task-2',
        type: 'feature' as const,
        projectId: 'project-1',
        title: 'Task 2',
        description: 'Desc',
        priority: 85,
        dynamicPriority: 85,
        dependencies: ['task-1'],
        status: 'pending' as const,
        sprint: 'sprint-1',
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

      const stateWithSprint = {
        ...initialState,
        activeSprint,
        globalTasks: [completedTask, pendingTask],
      };

      const result = await sprintReviewNode(stateWithSprint);

      // Sprint should continue
      expect(result.activeSprint).toBeDefined();
      expect(result.activeSprint!.id).toBe('sprint-1');
      expect(result.activeSprint!.metadata.completedTasksCount).toBe(1);
      expect(result.logs).toBeDefined();
      expect(result.logs![0].message).toContain('未完了タスクあり');
    });

    test('should handle no active sprint', async () => {
      const initialState = createInitialState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithoutSprint = {
        ...initialState,
        activeSprint: null,
      };

      const result = await sprintReviewNode(stateWithoutSprint);

      expect(result.logs).toBeDefined();
      expect(result.logs![0].level).toBe('warn');
      expect(result.logs![0].message).toContain('アクティブなスプリントなし');
    });
  });

  describe('Deployability Check', () => {
    test('should mark sprint as not deployable when blockers exist', async () => {
      const activeSprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        goal: 'Goal',
        taskIds: ['task-1'],
        status: 'active' as const,
        deployable: true,
        startedAt: new Date(),
        metadata: {
          estimatedHours: 8,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };

      const completedTask = {
        id: 'task-1',
        type: 'feature' as const,
        projectId: 'project-1',
        title: 'Task',
        description: 'Desc',
        priority: 90,
        dynamicPriority: 90,
        dependencies: [],
        status: 'completed' as const,
        sprint: 'sprint-1',
        requestTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock AI response: not deployable
      const deployabilityResponse = {
        deployable: false,
        e2eTestable: false,
        reasoning: 'Missing tests',
        blockers: ['No unit tests', 'No integration tests'],
      };

      const jsonResponse = '```json\n' + JSON.stringify(deployabilityResponse, null, 2) + '\n```';

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

      const stateWithSprint = {
        ...initialState,
        activeSprint,
        globalTasks: [completedTask],
      };

      const result = await sprintReviewNode(stateWithSprint);

      const completedSprint = result.sprints![0];
      expect(completedSprint.deployable).toBe(false);
      expect(completedSprint.metadata.blockers).toEqual(['No unit tests', 'No integration tests']);
    });
  });

  describe('Next Sprint Detection', () => {
    test('should route to sprint_planning when more tasks remain', async () => {
      const activeSprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        goal: 'Goal',
        taskIds: ['task-1'],
        status: 'active' as const,
        deployable: true,
        startedAt: new Date(),
        metadata: {
          estimatedHours: 8,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };

      const completedTask = {
        id: 'task-1',
        type: 'feature' as const,
        projectId: 'project-1',
        title: 'Task 1',
        description: 'Desc',
        priority: 90,
        dynamicPriority: 90,
        dependencies: [],
        status: 'completed' as const,
        sprint: 'sprint-1',
        requestTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const unassignedTask = {
        id: 'task-2',
        type: 'feature' as const,
        projectId: 'project-1',
        title: 'Task 2',
        description: 'Desc',
        priority: 85,
        dynamicPriority: 85,
        dependencies: [],
        status: 'pending' as const,
        sprint: undefined,
        requestTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const deployabilityResponse = {
        deployable: true,
        e2eTestable: true,
        reasoning: 'Ready',
        blockers: [],
      };

      const jsonResponse = '```json\n' + JSON.stringify(deployabilityResponse, null, 2) + '\n```';

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

      const stateWithSprint = {
        ...initialState,
        activeSprint,
        globalTasks: [completedTask, unassignedTask],
      };

      const result = await sprintReviewNode(stateWithSprint);

      expect(result.logs![0].message).toContain('次スプリント計画へ');
    });
  });

  describe('sprintReviewRouter', () => {
    test('should route to END when all tasks completed', () => {
      const initialState = createInitialState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const completedTask = {
        id: 'task-1',
        type: 'feature' as const,
        projectId: 'project-1',
        title: 'Task',
        description: 'Desc',
        priority: 90,
        dynamicPriority: 90,
        dependencies: [],
        status: 'completed' as const,
        sprint: 'sprint-1',
        requestTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const stateWithCompletedTasks = {
        ...initialState,
        globalTasks: [completedTask],
        activeSprint: null,
      };

      const route = sprintReviewRouter(stateWithCompletedTasks);
      expect(route).toBe('END');
    });

    test('should route to sprint_planning when sprint completed but tasks remain', () => {
      const initialState = createInitialState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const completedTask = {
        id: 'task-1',
        type: 'feature' as const,
        projectId: 'project-1',
        title: 'Task 1',
        description: 'Desc',
        priority: 90,
        dynamicPriority: 90,
        dependencies: [],
        status: 'completed' as const,
        sprint: 'sprint-1',
        requestTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const pendingTask = {
        id: 'task-2',
        type: 'feature' as const,
        projectId: 'project-1',
        title: 'Task 2',
        description: 'Desc',
        priority: 85,
        dynamicPriority: 85,
        dependencies: [],
        status: 'pending' as const,
        sprint: undefined,
        requestTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const stateWithPendingTasks = {
        ...initialState,
        globalTasks: [completedTask, pendingTask],
        activeSprint: null,
      };

      const route = sprintReviewRouter(stateWithPendingTasks);
      expect(route).toBe('sprint_planning');
    });

    test('should route to review_dispatch when sprint has in_review tasks', () => {
      const activeSprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        goal: 'Goal',
        taskIds: ['task-1'],
        status: 'active' as const,
        deployable: true,
        startedAt: new Date(),
        metadata: {
          estimatedHours: 8,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };

      const initialState = createInitialState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const inReviewTask = {
        id: 'task-1',
        type: 'feature' as const,
        projectId: 'project-1',
        title: 'Task',
        description: 'Desc',
        priority: 90,
        dynamicPriority: 90,
        dependencies: [],
        status: 'in_review' as const,
        sprint: 'sprint-1',
        requestTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const stateWithActiveSprint = {
        ...initialState,
        activeSprint,
        globalTasks: [inReviewTask],
      };

      const route = sprintReviewRouter(stateWithActiveSprint);
      expect(route).toBe('review_dispatch');
    });

    test('should route to engineer_dispatch when sprint has pending tasks', () => {
      const activeSprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        goal: 'Goal',
        taskIds: ['task-1'],
        status: 'active' as const,
        deployable: true,
        startedAt: new Date(),
        metadata: {
          estimatedHours: 8,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };

      const initialState = createInitialState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const pendingTask = {
        id: 'task-1',
        type: 'feature' as const,
        projectId: 'project-1',
        title: 'Task',
        description: 'Desc',
        priority: 90,
        dynamicPriority: 90,
        dependencies: [],
        status: 'pending' as const,
        sprint: 'sprint-1',
        requestTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const stateWithActiveSprint = {
        ...initialState,
        activeSprint,
        globalTasks: [pendingTask],
      };

      const route = sprintReviewRouter(stateWithActiveSprint);
      expect(route).toBe('engineer_dispatch');
    });

    test('should prioritize in_review tasks over pending tasks', () => {
      const activeSprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        goal: 'Goal',
        taskIds: ['task-1', 'task-2'],
        status: 'active' as const,
        deployable: true,
        startedAt: new Date(),
        metadata: {
          estimatedHours: 8,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };

      const initialState = createInitialState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const inReviewTask = {
        id: 'task-1',
        type: 'feature' as const,
        projectId: 'project-1',
        title: 'Task 1',
        description: 'Desc',
        priority: 90,
        dynamicPriority: 90,
        dependencies: [],
        status: 'in_review' as const,
        sprint: 'sprint-1',
        requestTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const pendingTask = {
        id: 'task-2',
        type: 'feature' as const,
        projectId: 'project-1',
        title: 'Task 2',
        description: 'Desc',
        priority: 85,
        dynamicPriority: 85,
        dependencies: [],
        status: 'pending' as const,
        sprint: 'sprint-1',
        requestTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const stateWithActiveSprint = {
        ...initialState,
        activeSprint,
        globalTasks: [inReviewTask, pendingTask],
      };

      const route = sprintReviewRouter(stateWithActiveSprint);
      // Should route to review_dispatch (in_review takes priority)
      expect(route).toBe('review_dispatch');
    });

    test('should route to engineer_dispatch when sprint has in_progress tasks', () => {
      const activeSprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        goal: 'Goal',
        taskIds: ['task-1'],
        status: 'active' as const,
        deployable: true,
        startedAt: new Date(),
        metadata: {
          estimatedHours: 8,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };

      const initialState = createInitialState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const inProgressTask = {
        id: 'task-1',
        type: 'feature' as const,
        projectId: 'project-1',
        title: 'Task',
        description: 'Desc',
        priority: 90,
        dynamicPriority: 90,
        dependencies: [],
        status: 'in_progress' as const,
        sprint: 'sprint-1',
        requestTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const stateWithActiveSprint = {
        ...initialState,
        activeSprint,
        globalTasks: [inProgressTask],
      };

      const route = sprintReviewRouter(stateWithActiveSprint);
      expect(route).toBe('engineer_dispatch');
    });
  });
});
