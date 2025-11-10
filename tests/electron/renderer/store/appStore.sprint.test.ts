/**
 * appStore Sprint機能のユニットテスト
 *
 * Electron rendererのZustand storeにスプリント管理機能を追加するテスト
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import type { Sprint, GlobalTask } from '../../../../src/types/index.js';

// モック実装（実際のStoreは後で実装）
interface SprintState {
  sprints: Sprint[];
  currentSprint: Sprint | null;
  globalTasks: GlobalTask[];

  // Actions
  setSprints: (sprints: Sprint[]) => void;
  setCurrentSprint: (sprint: Sprint | null) => void;
  addSprint: (sprint: Sprint) => void;
  updateSprint: (sprintId: string, updates: Partial<Sprint>) => void;
  setGlobalTasks: (tasks: GlobalTask[]) => void;

  // Selectors
  getSprintById: (sprintId: string) => Sprint | undefined;
  getTasksBySprint: (sprintId: string) => GlobalTask[];
  getActiveSprintCount: () => number;
  getCompletedSprintCount: () => number;
  getProductBacklogTasks: () => GlobalTask[];
  getCurrentSprintProgress: () => {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    failed: number;
    percentage: number;
  } | null;
}

// モックストアの作成
function createMockStore(): SprintState {
  let state: {
    sprints: Sprint[];
    currentSprint: Sprint | null;
    globalTasks: GlobalTask[];
  } = {
    sprints: [],
    currentSprint: null,
    globalTasks: [],
  };

  return {
    get sprints() {
      return state.sprints;
    },
    get currentSprint() {
      return state.currentSprint;
    },
    get globalTasks() {
      return state.globalTasks;
    },

    setSprints: (sprints: Sprint[]) => {
      state.sprints = sprints;
    },

    setCurrentSprint: (sprint: Sprint | null) => {
      state.currentSprint = sprint;
    },

    addSprint: (sprint: Sprint) => {
      state.sprints = [...state.sprints, sprint];
    },

    updateSprint: (sprintId: string, updates: Partial<Sprint>) => {
      state.sprints = state.sprints.map((sprint) =>
        sprint.id === sprintId ? { ...sprint, ...updates } : sprint
      );
      if (state.currentSprint?.id === sprintId) {
        state.currentSprint = { ...state.currentSprint, ...updates };
      }
    },

    setGlobalTasks: (tasks: GlobalTask[]) => {
      state.globalTasks = tasks;
    },

    getSprintById: (sprintId: string) => {
      return state.sprints.find((sprint) => sprint.id === sprintId);
    },

    getTasksBySprint: (sprintId: string) => {
      return state.globalTasks.filter((task) => task.sprint === sprintId);
    },

    getActiveSprintCount: () => {
      return state.sprints.filter(
        (sprint) => sprint.status === 'active' || sprint.status === 'planning'
      ).length;
    },

    getCompletedSprintCount: () => {
      return state.sprints.filter((sprint) => sprint.status === 'completed').length;
    },

    getProductBacklogTasks: () => {
      return state.globalTasks.filter((task) => task.sprint === undefined);
    },

    getCurrentSprintProgress: () => {
      if (!state.currentSprint) return null;

      const tasks = state.globalTasks.filter(
        (task) => task.sprint === state.currentSprint!.id
      );

      const total = tasks.length;
      if (total === 0) {
        return {
          total: 0,
          completed: 0,
          inProgress: 0,
          pending: 0,
          failed: 0,
          percentage: 0,
        };
      }

      const completed = tasks.filter((task) => task.status === 'completed').length;
      const inProgress = tasks.filter((task) => task.status === 'in_progress').length;
      const pending = tasks.filter((task) => task.status === 'pending').length;
      const failed = tasks.filter((task) => task.status === 'failed').length;

      return {
        total,
        completed,
        inProgress,
        pending,
        failed,
        percentage: Math.round((completed / total) * 100),
      };
    },
  };
}

describe('appStore - Sprint Management', () => {
  let store: SprintState;

  beforeEach(() => {
    store = createMockStore();
  });

  describe('Sprint CRUD', () => {
    test('should set sprints', () => {
      const sprints: Sprint[] = [
        {
          id: 'sprint-1',
          name: 'Sprint 1: Authentication',
          goal: 'Implement user authentication system',
          taskIds: ['task-1', 'task-2'],
          status: 'active',
          deployable: false,
          metadata: {
            estimatedHours: 40,
            actualHours: 0,
            blockers: [],
            completedTasksCount: 0,
            failedTasksCount: 0,
          },
        },
        {
          id: 'sprint-2',
          name: 'Sprint 2: Dashboard',
          goal: 'Build user dashboard',
          taskIds: ['task-3'],
          status: 'planning',
          deployable: false,
          metadata: {
            estimatedHours: 20,
            actualHours: 0,
            blockers: [],
            completedTasksCount: 0,
            failedTasksCount: 0,
          },
        },
      ];

      store.setSprints(sprints);

      expect(store.sprints).toEqual(sprints);
      expect(store.sprints).toHaveLength(2);
    });

    test('should add a sprint', () => {
      const sprint: Sprint = {
        id: 'sprint-new',
        name: 'New Sprint',
        goal: 'New goal',
        taskIds: [],
        status: 'planning',
        deployable: false,
        metadata: {
          estimatedHours: 0,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };

      store.addSprint(sprint);

      expect(store.sprints).toHaveLength(1);
      expect(store.sprints[0]).toEqual(sprint);
    });

    test('should update a sprint', () => {
      const sprint: Sprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        goal: 'Original goal',
        taskIds: [],
        status: 'planning',
        deployable: false,
        metadata: {
          estimatedHours: 0,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };

      store.setSprints([sprint]);

      store.updateSprint('sprint-1', {
        status: 'active',
        startedAt: new Date('2025-01-01'),
      });

      const updated = store.getSprintById('sprint-1');
      expect(updated?.status).toBe('active');
      expect(updated?.startedAt).toEqual(new Date('2025-01-01'));
    });

    test('should get sprint by ID', () => {
      const sprint: Sprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        goal: 'Goal',
        taskIds: [],
        status: 'active',
        deployable: false,
        metadata: {
          estimatedHours: 0,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };

      store.setSprints([sprint]);

      const found = store.getSprintById('sprint-1');
      expect(found).toEqual(sprint);

      const notFound = store.getSprintById('sprint-999');
      expect(notFound).toBeUndefined();
    });
  });

  describe('Current Sprint Management', () => {
    test('should set current sprint', () => {
      const sprint: Sprint = {
        id: 'sprint-current',
        name: 'Current Sprint',
        goal: 'Current goal',
        taskIds: [],
        status: 'active',
        deployable: false,
        metadata: {
          estimatedHours: 0,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };

      store.setCurrentSprint(sprint);

      expect(store.currentSprint).toEqual(sprint);
    });

    test('should update current sprint when updated', () => {
      const sprint: Sprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        goal: 'Goal',
        taskIds: [],
        status: 'active',
        deployable: false,
        metadata: {
          estimatedHours: 0,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };

      store.setSprints([sprint]);
      store.setCurrentSprint(sprint);

      store.updateSprint('sprint-1', {
        status: 'completed',
        completedAt: new Date('2025-01-15'),
      });

      expect(store.currentSprint?.status).toBe('completed');
      expect(store.currentSprint?.completedAt).toEqual(new Date('2025-01-15'));
    });
  });

  describe('Task-Sprint Association', () => {
    test('should get tasks by sprint ID', () => {
      const tasks: GlobalTask[] = [
        {
          id: 'task-1',
          type: 'feature',
          title: 'Task 1',
          description: 'Description 1',
          priority: 80,
          dependencies: [],
          status: 'pending',
          projectId: 'project-1',
          requestTimestamp: new Date('2025-01-01'),
          dynamicPriority: 80,
          sprint: 'sprint-1',
        },
        {
          id: 'task-2',
          type: 'feature',
          title: 'Task 2',
          description: 'Description 2',
          priority: 70,
          dependencies: [],
          status: 'completed',
          projectId: 'project-1',
          requestTimestamp: new Date('2025-01-01'),
          dynamicPriority: 70,
          sprint: 'sprint-1',
        },
        {
          id: 'task-3',
          type: 'feature',
          title: 'Task 3',
          description: 'Description 3',
          priority: 60,
          dependencies: [],
          status: 'pending',
          projectId: 'project-1',
          requestTimestamp: new Date('2025-01-01'),
          dynamicPriority: 60,
          sprint: 'sprint-2',
        },
      ];

      store.setGlobalTasks(tasks);

      const sprint1Tasks = store.getTasksBySprint('sprint-1');
      expect(sprint1Tasks).toHaveLength(2);
      expect(sprint1Tasks.map((t) => t.id)).toEqual(['task-1', 'task-2']);

      const sprint2Tasks = store.getTasksBySprint('sprint-2');
      expect(sprint2Tasks).toHaveLength(1);
      expect(sprint2Tasks[0].id).toBe('task-3');
    });

    test('should get product backlog tasks (unassigned to sprint)', () => {
      const tasks: GlobalTask[] = [
        {
          id: 'task-1',
          type: 'feature',
          title: 'Task 1',
          description: 'Description 1',
          priority: 80,
          dependencies: [],
          status: 'pending',
          projectId: 'project-1',
          requestTimestamp: new Date('2025-01-01'),
          dynamicPriority: 80,
          // sprint: undefined (Product Backlog)
        },
        {
          id: 'task-2',
          type: 'feature',
          title: 'Task 2',
          description: 'Description 2',
          priority: 70,
          dependencies: [],
          status: 'pending',
          projectId: 'project-1',
          requestTimestamp: new Date('2025-01-01'),
          dynamicPriority: 70,
          sprint: 'sprint-1',
        },
      ];

      store.setGlobalTasks(tasks);

      const backlogTasks = store.getProductBacklogTasks();
      expect(backlogTasks).toHaveLength(1);
      expect(backlogTasks[0].id).toBe('task-1');
    });
  });

  describe('Sprint Statistics', () => {
    test('should count active sprints', () => {
      const sprints: Sprint[] = [
        {
          id: 'sprint-1',
          name: 'Sprint 1',
          goal: 'Goal 1',
          taskIds: [],
          status: 'active',
          deployable: false,
          metadata: {
            estimatedHours: 0,
            blockers: [],
            completedTasksCount: 0,
            failedTasksCount: 0,
          },
        },
        {
          id: 'sprint-2',
          name: 'Sprint 2',
          goal: 'Goal 2',
          taskIds: [],
          status: 'planning',
          deployable: false,
          metadata: {
            estimatedHours: 0,
            blockers: [],
            completedTasksCount: 0,
            failedTasksCount: 0,
          },
        },
        {
          id: 'sprint-3',
          name: 'Sprint 3',
          goal: 'Goal 3',
          taskIds: [],
          status: 'completed',
          deployable: true,
          metadata: {
            estimatedHours: 0,
            blockers: [],
            completedTasksCount: 2,
            failedTasksCount: 0,
          },
        },
      ];

      store.setSprints(sprints);

      expect(store.getActiveSprintCount()).toBe(2); // active + planning
      expect(store.getCompletedSprintCount()).toBe(1);
    });

    test('should calculate current sprint progress', () => {
      const sprint: Sprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        goal: 'Goal',
        taskIds: ['task-1', 'task-2', 'task-3', 'task-4'],
        status: 'active',
        deployable: false,
        metadata: {
          estimatedHours: 40,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };

      const tasks: GlobalTask[] = [
        {
          id: 'task-1',
          type: 'feature',
          title: 'Task 1',
          description: 'Description',
          priority: 80,
          dependencies: [],
          status: 'completed',
          projectId: 'project-1',
          requestTimestamp: new Date(),
          dynamicPriority: 80,
          sprint: 'sprint-1',
        },
        {
          id: 'task-2',
          type: 'feature',
          title: 'Task 2',
          description: 'Description',
          priority: 70,
          dependencies: [],
          status: 'completed',
          projectId: 'project-1',
          requestTimestamp: new Date(),
          dynamicPriority: 70,
          sprint: 'sprint-1',
        },
        {
          id: 'task-3',
          type: 'feature',
          title: 'Task 3',
          description: 'Description',
          priority: 60,
          dependencies: [],
          status: 'in_progress',
          projectId: 'project-1',
          requestTimestamp: new Date(),
          dynamicPriority: 60,
          sprint: 'sprint-1',
        },
        {
          id: 'task-4',
          type: 'feature',
          title: 'Task 4',
          description: 'Description',
          priority: 50,
          dependencies: [],
          status: 'pending',
          projectId: 'project-1',
          requestTimestamp: new Date(),
          dynamicPriority: 50,
          sprint: 'sprint-1',
        },
      ];

      store.setCurrentSprint(sprint);
      store.setGlobalTasks(tasks);

      const progress = store.getCurrentSprintProgress();

      expect(progress).not.toBeNull();
      expect(progress?.total).toBe(4);
      expect(progress?.completed).toBe(2);
      expect(progress?.inProgress).toBe(1);
      expect(progress?.pending).toBe(1);
      expect(progress?.failed).toBe(0);
      expect(progress?.percentage).toBe(50); // 2/4 = 50%
    });

    test('should return null progress when no current sprint', () => {
      const progress = store.getCurrentSprintProgress();
      expect(progress).toBeNull();
    });

    test('should return 0% progress when sprint has no tasks', () => {
      const sprint: Sprint = {
        id: 'sprint-empty',
        name: 'Empty Sprint',
        goal: 'Goal',
        taskIds: [],
        status: 'active',
        deployable: false,
        metadata: {
          estimatedHours: 0,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };

      store.setCurrentSprint(sprint);
      store.setGlobalTasks([]);

      const progress = store.getCurrentSprintProgress();

      expect(progress).not.toBeNull();
      expect(progress?.total).toBe(0);
      expect(progress?.percentage).toBe(0);
    });
  });

  describe('Sprint Status Transitions', () => {
    test('should transition sprint from planning to active', () => {
      const sprint: Sprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        goal: 'Goal',
        taskIds: [],
        status: 'planning',
        deployable: false,
        metadata: {
          estimatedHours: 40,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };

      store.setSprints([sprint]);

      store.updateSprint('sprint-1', {
        status: 'active',
        startedAt: new Date(),
      });

      const updated = store.getSprintById('sprint-1');
      expect(updated?.status).toBe('active');
      expect(updated?.startedAt).toBeDefined();
    });

    test('should transition sprint from active to review', () => {
      const sprint: Sprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        goal: 'Goal',
        taskIds: [],
        status: 'active',
        deployable: false,
        metadata: {
          estimatedHours: 40,
          blockers: [],
          completedTasksCount: 5,
          failedTasksCount: 0,
        },
      };

      store.setSprints([sprint]);

      store.updateSprint('sprint-1', {
        status: 'review',
      });

      const updated = store.getSprintById('sprint-1');
      expect(updated?.status).toBe('review');
    });

    test('should transition sprint from review to completed', () => {
      const sprint: Sprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        goal: 'Goal',
        taskIds: [],
        status: 'review',
        deployable: false,
        metadata: {
          estimatedHours: 40,
          actualHours: 38,
          blockers: [],
          completedTasksCount: 5,
          failedTasksCount: 0,
        },
      };

      store.setSprints([sprint]);

      store.updateSprint('sprint-1', {
        status: 'completed',
        completedAt: new Date(),
        deployable: true,
      });

      const updated = store.getSprintById('sprint-1');
      expect(updated?.status).toBe('completed');
      expect(updated?.completedAt).toBeDefined();
      expect(updated?.deployable).toBe(true);
    });
  });
});
