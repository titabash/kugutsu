/**
 * PriorityCalculator Unit Tests (Jest)
 */

import { PriorityCalculator } from '../../src/utils/PriorityCalculator.js';
import type { GlobalTask, ProjectMetadata } from '../../src/types/index.js';

describe('PriorityCalculator', () => {
  describe('calculateRecencyBonus', () => {
    test('should return 100 when timestamp is the most recent in project range', () => {
      const mostRecentTimestamp = new Date('2025-01-03T00:00:00Z');
      const projects = new Map<string, ProjectMetadata>([
        [
          'project-1',
          {
            projectId: 'project-1',
            userRequest: 'Request 1',
            requestTimestamp: new Date('2025-01-01T00:00:00Z'),
            totalTasks: 1,
            completedTasks: 0,
            needsStoryMapping: false,
          },
        ],
        [
          'project-2',
          {
            projectId: 'project-2',
            userRequest: 'Request 2',
            requestTimestamp: new Date('2025-01-02T00:00:00Z'),
            totalTasks: 1,
            completedTasks: 0,
            needsStoryMapping: false,
          },
        ],
        [
          'project-3',
          {
            projectId: 'project-3',
            userRequest: 'Request 3',
            requestTimestamp: mostRecentTimestamp,
            totalTasks: 1,
            completedTasks: 0,
            needsStoryMapping: false,
          },
        ],
      ]);

      const bonus = PriorityCalculator.calculateRecencyBonus(mostRecentTimestamp, projects);

      expect(bonus).toBe(100);
    });

    test('should return 0 when timestamp is the oldest in project range', () => {
      const oldestTimestamp = new Date('2025-01-01T00:00:00Z');
      const projects = new Map<string, ProjectMetadata>([
        [
          'project-1',
          {
            projectId: 'project-1',
            userRequest: 'Request 1',
            requestTimestamp: oldestTimestamp,
            totalTasks: 1,
            completedTasks: 0,
            needsStoryMapping: false,
          },
        ],
        [
          'project-2',
          {
            projectId: 'project-2',
            userRequest: 'Request 2',
            requestTimestamp: new Date('2025-01-02T00:00:00Z'),
            totalTasks: 1,
            completedTasks: 0,
            needsStoryMapping: false,
          },
        ],
        [
          'project-3',
          {
            projectId: 'project-3',
            userRequest: 'Request 3',
            requestTimestamp: new Date('2025-01-03T00:00:00Z'),
            totalTasks: 1,
            completedTasks: 0,
            needsStoryMapping: false,
          },
        ],
      ]);

      const bonus = PriorityCalculator.calculateRecencyBonus(oldestTimestamp, projects);

      expect(bonus).toBe(0);
    });

    test('should return 50 (middle) for mid-range timestamp', () => {
      const midTimestamp = new Date('2025-01-02T00:00:00Z');
      const projects = new Map<string, ProjectMetadata>([
        [
          'project-1',
          {
            projectId: 'project-1',
            userRequest: 'Request 1',
            requestTimestamp: new Date('2025-01-01T00:00:00Z'),
            totalTasks: 1,
            completedTasks: 0,
            needsStoryMapping: false,
          },
        ],
        [
          'project-2',
          {
            projectId: 'project-2',
            userRequest: 'Request 2',
            requestTimestamp: midTimestamp,
            totalTasks: 1,
            completedTasks: 0,
            needsStoryMapping: false,
          },
        ],
        [
          'project-3',
          {
            projectId: 'project-3',
            userRequest: 'Request 3',
            requestTimestamp: new Date('2025-01-03T00:00:00Z'),
            totalTasks: 1,
            completedTasks: 0,
            needsStoryMapping: false,
          },
        ],
      ]);

      const bonus = PriorityCalculator.calculateRecencyBonus(midTimestamp, projects);

      expect(bonus).toBe(50);
    });

    test('should return 100 when all timestamps are identical', () => {
      const sameTimestamp = new Date('2025-01-01T00:00:00Z');
      const projects = new Map<string, ProjectMetadata>([
        [
          'project-1',
          {
            projectId: 'project-1',
            userRequest: 'Request 1',
            requestTimestamp: sameTimestamp,
            totalTasks: 1,
            completedTasks: 0,
            needsStoryMapping: false,
          },
        ],
        [
          'project-2',
          {
            projectId: 'project-2',
            userRequest: 'Request 2',
            requestTimestamp: sameTimestamp,
            totalTasks: 1,
            completedTasks: 0,
            needsStoryMapping: false,
          },
        ],
      ]);

      const bonus = PriorityCalculator.calculateRecencyBonus(sameTimestamp, projects);

      expect(bonus).toBe(100);
    });

    test('should return 50 (default) when no projects exist', () => {
      const projects = new Map<string, ProjectMetadata>();
      const timestamp = new Date('2025-01-01T00:00:00Z');

      const bonus = PriorityCalculator.calculateRecencyBonus(timestamp, projects);

      expect(bonus).toBe(50);
    });
  });

  describe('calculateDependencyBonus', () => {
    test('should return 100 when task has no dependencies', () => {
      const task: GlobalTask = {
        id: 'task-1',
        type: 'feature',
        projectId: 'project-1',
        title: 'Task 1',
        description: 'Description',
        priority: 80,
        dynamicPriority: 80,
        dependencies: [],
        status: 'pending',
        requestTimestamp: new Date(),
      };

      const allTasks: GlobalTask[] = [task];
      const bonus = PriorityCalculator.calculateDependencyBonus(task, allTasks);

      expect(bonus).toBe(100);
    });

    test('should return 100 when all dependencies are completed', () => {
      const completedTask: GlobalTask = {
        id: 'task-dep',
        type: 'feature',
        projectId: 'project-1',
        title: 'Dependency Task',
        description: 'Description',
        priority: 80,
        dynamicPriority: 80,
        dependencies: [],
        status: 'completed',
        requestTimestamp: new Date(),
      };

      const task: GlobalTask = {
        id: 'task-1',
        type: 'feature',
        projectId: 'project-1',
        title: 'Task 1',
        description: 'Description',
        priority: 80,
        dynamicPriority: 80,
        dependencies: ['task-dep'],
        status: 'pending',
        requestTimestamp: new Date(),
      };

      const allTasks: GlobalTask[] = [completedTask, task];
      const bonus = PriorityCalculator.calculateDependencyBonus(task, allTasks);

      expect(bonus).toBe(100);
    });

    test('should return 0 when no dependencies are completed', () => {
      const pendingTask: GlobalTask = {
        id: 'task-dep',
        type: 'feature',
        projectId: 'project-1',
        title: 'Dependency Task',
        description: 'Description',
        priority: 80,
        dynamicPriority: 80,
        dependencies: [],
        status: 'pending',
        requestTimestamp: new Date(),
      };

      const task: GlobalTask = {
        id: 'task-1',
        type: 'feature',
        projectId: 'project-1',
        title: 'Task 1',
        description: 'Description',
        priority: 80,
        dynamicPriority: 80,
        dependencies: ['task-dep'],
        status: 'pending',
        requestTimestamp: new Date(),
      };

      const allTasks: GlobalTask[] = [pendingTask, task];
      const bonus = PriorityCalculator.calculateDependencyBonus(task, allTasks);

      expect(bonus).toBe(0);
    });

    test('should return 50 when half of dependencies are completed', () => {
      const completedTask: GlobalTask = {
        id: 'task-dep-1',
        type: 'feature',
        projectId: 'project-1',
        title: 'Dependency Task 1',
        description: 'Description',
        priority: 80,
        dynamicPriority: 80,
        dependencies: [],
        status: 'completed',
        requestTimestamp: new Date(),
      };

      const pendingTask: GlobalTask = {
        id: 'task-dep-2',
        type: 'feature',
        projectId: 'project-1',
        title: 'Dependency Task 2',
        description: 'Description',
        priority: 80,
        dynamicPriority: 80,
        dependencies: [],
        status: 'pending',
        requestTimestamp: new Date(),
      };

      const task: GlobalTask = {
        id: 'task-1',
        type: 'feature',
        projectId: 'project-1',
        title: 'Task 1',
        description: 'Description',
        priority: 80,
        dynamicPriority: 80,
        dependencies: ['task-dep-1', 'task-dep-2'],
        status: 'pending',
        requestTimestamp: new Date(),
      };

      const allTasks: GlobalTask[] = [completedTask, pendingTask, task];
      const bonus = PriorityCalculator.calculateDependencyBonus(task, allTasks);

      expect(bonus).toBe(50);
    });

    test('should handle missing dependency tasks gracefully', () => {
      const task: GlobalTask = {
        id: 'task-1',
        type: 'feature',
        projectId: 'project-1',
        title: 'Task 1',
        description: 'Description',
        priority: 80,
        dynamicPriority: 80,
        dependencies: ['non-existent-task'],
        status: 'pending',
        requestTimestamp: new Date(),
      };

      const allTasks: GlobalTask[] = [task];
      const bonus = PriorityCalculator.calculateDependencyBonus(task, allTasks);

      // Missing dependencies count as incomplete
      expect(bonus).toBe(0);
    });
  });

  describe('calculateDynamicPriority', () => {
    test('should calculate priority with correct weights', () => {
      const task: GlobalTask = {
        id: 'task-1',
        type: 'feature',
        projectId: 'project-1',
        title: 'Task 1',
        description: 'Description',
        priority: 80, // basePriority
        dynamicPriority: 0,
        dependencies: [],
        status: 'pending',
        requestTimestamp: new Date('2025-01-03T00:00:00Z'),
      };

      const projects = new Map<string, ProjectMetadata>([
        [
          'project-1',
          {
            projectId: 'project-1',
            userRequest: 'Request 1',
            requestTimestamp: new Date('2025-01-01T00:00:00Z'),
            totalTasks: 1,
            completedTasks: 0,
            needsStoryMapping: false,
          },
        ],
      ]);

      const allTasks = [task];

      const dynamicPriority = PriorityCalculator.calculateDynamicPriority(task, allTasks, projects);

      // Calculation:
      // basePriority * 0.5 = 80 * 0.5 = 40
      // recencyBonus * 0.3 = 100 * 0.3 = 30 (most recent)
      // dependencyBonus * 0.2 = 100 * 0.2 = 20 (no dependencies)
      // Total = 40 + 30 + 20 = 90

      expect(dynamicPriority).toBe(90);
    });

    test('should handle task with dependencies', () => {
      const completedTask: GlobalTask = {
        id: 'task-dep',
        type: 'feature',
        projectId: 'project-1',
        title: 'Dependency Task',
        description: 'Description',
        priority: 80,
        dynamicPriority: 80,
        dependencies: [],
        status: 'completed',
        requestTimestamp: new Date('2025-01-01T00:00:00Z'),
      };

      const task: GlobalTask = {
        id: 'task-1',
        type: 'feature',
        projectId: 'project-1',
        title: 'Task 1',
        description: 'Description',
        priority: 80,
        dynamicPriority: 0,
        dependencies: ['task-dep'],
        status: 'pending',
        requestTimestamp: new Date('2025-01-02T00:00:00Z'),
      };

      const projects = new Map<string, ProjectMetadata>([
        [
          'project-1',
          {
            projectId: 'project-1',
            userRequest: 'Request 1',
            requestTimestamp: new Date('2025-01-01T00:00:00Z'),
            totalTasks: 2,
            completedTasks: 1,
            needsStoryMapping: false,
          },
        ],
      ]);

      const allTasks = [completedTask, task];

      const dynamicPriority = PriorityCalculator.calculateDynamicPriority(task, allTasks, projects);

      // basePriority * 0.5 = 80 * 0.5 = 40
      // recencyBonus * 0.3 = 100 * 0.3 = 30 (most recent in single project)
      // dependencyBonus * 0.2 = 100 * 0.2 = 20 (dependency completed)
      // Total = 90

      expect(dynamicPriority).toBe(90);
    });

    test('should use default priority of 50 when priority is not a number', () => {
      const task: GlobalTask = {
        id: 'task-1',
        type: 'feature',
        projectId: 'project-1',
        title: 'Task 1',
        description: 'Description',
        priority: undefined as any, // Invalid priority
        dynamicPriority: 0,
        dependencies: [],
        status: 'pending',
        requestTimestamp: new Date('2025-01-01T00:00:00Z'),
      };

      const projects = new Map<string, ProjectMetadata>();
      const allTasks = [task];

      const dynamicPriority = PriorityCalculator.calculateDynamicPriority(task, allTasks, projects);

      // basePriority * 0.5 = 50 * 0.5 = 25 (default)
      // recencyBonus * 0.3 = 50 * 0.3 = 15 (default)
      // dependencyBonus * 0.2 = 100 * 0.2 = 20 (no dependencies)
      // Total = 60

      expect(dynamicPriority).toBe(60);
    });
  });

  describe('calculateAndSortTasks', () => {
    test('should sort tasks by dynamic priority in descending order', () => {
      const task1: GlobalTask = {
        id: 'task-1',
        type: 'feature',
        projectId: 'project-1',
        title: 'Low Priority Task',
        description: 'Description',
        priority: 30,
        dynamicPriority: 0,
        dependencies: [],
        status: 'pending',
        requestTimestamp: new Date('2025-01-01T00:00:00Z'),
      };

      const task2: GlobalTask = {
        id: 'task-2',
        type: 'feature',
        projectId: 'project-1',
        title: 'High Priority Task',
        description: 'Description',
        priority: 90,
        dynamicPriority: 0,
        dependencies: [],
        status: 'pending',
        requestTimestamp: new Date('2025-01-03T00:00:00Z'),
      };

      const task3: GlobalTask = {
        id: 'task-3',
        type: 'feature',
        projectId: 'project-1',
        title: 'Medium Priority Task',
        description: 'Description',
        priority: 60,
        dynamicPriority: 0,
        dependencies: [],
        status: 'pending',
        requestTimestamp: new Date('2025-01-02T00:00:00Z'),
      };

      const projects = new Map<string, ProjectMetadata>([
        [
          'project-1',
          {
            projectId: 'project-1',
            userRequest: 'Request 1',
            requestTimestamp: new Date('2025-01-01T00:00:00Z'),
            totalTasks: 3,
            completedTasks: 0,
            needsStoryMapping: false,
          },
        ],
      ]);

      const sortedTasks = PriorityCalculator.calculateAndSortTasks([task1, task2, task3], projects);

      // task2 should be first (highest priority)
      expect(sortedTasks[0].id).toBe('task-2');
      expect(sortedTasks[1].id).toBe('task-3');
      expect(sortedTasks[2].id).toBe('task-1');

      // Verify dynamic priorities are calculated
      expect(sortedTasks[0].dynamicPriority).toBeGreaterThan(sortedTasks[1].dynamicPriority);
      expect(sortedTasks[1].dynamicPriority).toBeGreaterThan(sortedTasks[2].dynamicPriority);
    });

    test('should handle empty task list', () => {
      const projects = new Map<string, ProjectMetadata>();
      const sortedTasks = PriorityCalculator.calculateAndSortTasks([], projects);

      expect(sortedTasks).toEqual([]);
    });
  });

  describe('recalculateAllPriorities', () => {
    test('should recalculate dynamic priorities for all tasks', () => {
      const task1: GlobalTask = {
        id: 'task-1',
        type: 'feature',
        projectId: 'project-1',
        title: 'Task 1',
        description: 'Description',
        priority: 80,
        dynamicPriority: 0, // Old value
        dependencies: [],
        status: 'pending',
        requestTimestamp: new Date('2025-01-01T00:00:00Z'),
      };

      const task2: GlobalTask = {
        id: 'task-2',
        type: 'feature',
        projectId: 'project-1',
        title: 'Task 2',
        description: 'Description',
        priority: 60,
        dynamicPriority: 0, // Old value
        dependencies: ['task-1'],
        status: 'pending',
        requestTimestamp: new Date('2025-01-02T00:00:00Z'),
      };

      const projects = new Map<string, ProjectMetadata>([
        [
          'project-1',
          {
            projectId: 'project-1',
            userRequest: 'Request 1',
            requestTimestamp: new Date('2025-01-01T00:00:00Z'),
            totalTasks: 2,
            completedTasks: 0,
            needsStoryMapping: false,
          },
        ],
      ]);

      const recalculatedTasks = PriorityCalculator.recalculateAllPriorities([task1, task2], projects);

      // All tasks should have updated dynamic priorities
      expect(recalculatedTasks[0].dynamicPriority).toBeGreaterThan(0);
      expect(recalculatedTasks[1].dynamicPriority).toBeGreaterThan(0);

      // Task IDs should remain the same
      expect(recalculatedTasks[0].id).toBe('task-1');
      expect(recalculatedTasks[1].id).toBe('task-2');
    });
  });

  describe('detectContinuationMode (deprecated)', () => {
    test('should throw error when called', () => {
      expect(() => {
        PriorityCalculator.detectContinuationMode('続き');
      }).toThrow('detectContinuationMode() is deprecated');
    });
  });
});
