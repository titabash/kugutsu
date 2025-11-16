/**
 * Parallel Execution Tests (Node Unit Tests + Router Tests)
 *
 * Tests that verify parallel execution logic:
 * - EngineerDispatchNode and ReviewDispatchNode (Unit Tests)
 * - Router functions for Send API fan-out (Unit Tests)
 * - maxEngineers limit enforcement
 * - Dependency-based execution order
 *
 * Design Philosophy:
 * - Test nodes directly without full graph execution
 * - Minimal mocking (no AI Provider needed for dispatch nodes)
 * - Fast, independent, and focused tests
 */

import { jest } from '@jest/globals';
import { Send } from '@langchain/langgraph';

// Mock GitWorktreeManager and DataPersistence
jest.unstable_mockModule('../../src/managers/GitWorktreeManager.js', () => ({
  GitWorktreeManager: jest.fn().mockImplementation(() => ({
    createWorktree: (jest.fn() as any).mockImplementation((taskId: string) =>
      Promise.resolve({
        path: `/mock/worktrees/${taskId}`,
        branchName: `feature/${taskId}`,
      })
    ),
    removeWorktree: (jest.fn() as any).mockResolvedValue(undefined),
    addAndCommit: (jest.fn() as any).mockResolvedValue(undefined),
    push: (jest.fn() as any).mockResolvedValue(undefined),
  })),
}));

jest.unstable_mockModule('../../src/utils/DataPersistence.js', () => ({
  DataPersistence: jest.fn().mockImplementation(() => ({
    initialize: (jest.fn() as any).mockResolvedValue(undefined),
    saveTasks: (jest.fn() as any).mockResolvedValue(undefined),
    loadTasks: (jest.fn() as any).mockResolvedValue([]),
    saveActiveSprint: (jest.fn() as any).mockResolvedValue(undefined),
    loadActiveSprint: (jest.fn() as any).mockResolvedValue(null),
    updateSprintBacklogTask: (jest.fn() as any).mockResolvedValue(undefined),
  })),
}));

// Import after mocking
const { engineerDispatchNode } = await import('../../src/graph/nodes/EngineerDispatchNode.js');
const { reviewDispatchNode } = await import('../../src/graph/nodes/ReviewDispatchNode.js');
const { engineerDispatchRouter, reviewDispatchRouter } = await import('../../src/graph/ParallelDevGraph.js');
const {
  createTestState,
  createTestTask,
  createTestSprint,
  createTestReview,
} = await import('../helpers/graph-test-helpers.js');

describe('Parallel Execution (Node Unit Tests)', () => {
  describe('EngineerDispatchNode (Unit)', () => {
    test('should respect maxEngineers limit', async () => {
      // Arrange: 2 tasks already in_progress, 3 pending tasks, maxEngineers=3
      const tasks = [
        createTestTask({ id: 'task-1', status: 'in_progress' }),
        createTestTask({ id: 'task-2', status: 'in_progress' }),
        createTestTask({ id: 'task-3', status: 'pending', priority: 100 }),
        createTestTask({ id: 'task-4', status: 'pending', priority: 90 }),
        createTestTask({ id: 'task-5', status: 'pending', priority: 80 }),
      ];

      const state = createTestState('Test', { maxEngineers: 3 })
        .withTasks(tasks)
        .withActiveSprint(createTestSprint({ taskIds: tasks.map(t => t.id) }))
        .build();

      // Act: Call node directly
      const result = await engineerDispatchNode(state);

      // Assert: Only 1 new task should be dispatched (3 - 2 = 1 available slot)
      // Note: result.tasks contains only UPDATED tasks (partial update)
      const dispatchedTasks = result.tasks || [];

      expect(dispatchedTasks.length).toBe(1);
      // Should dispatch highest priority task
      expect(dispatchedTasks[0].id).toBe('task-3');
      expect(dispatchedTasks[0].status).toBe('in_progress');
    });

    test('should select tasks with resolved dependencies', async () => {
      // Arrange: task-2 depends on task-1
      const tasks = [
        createTestTask({ id: 'task-1', status: 'pending', dependencies: [], priority: 100 }),
        createTestTask({ id: 'task-2', status: 'pending', dependencies: ['task-1'], priority: 90 }),
        createTestTask({ id: 'task-3', status: 'pending', dependencies: [], priority: 80 }),
      ];

      const state = createTestState('Test', { maxEngineers: 3 })
        .withTasks(tasks)
        .withActiveSprint(createTestSprint({ taskIds: tasks.map(t => t.id) }))
        .build();

      // Act
      const result = await engineerDispatchNode(state);

      // Assert: Only task-1 and task-3 should be dispatched (task-2's dependency not met)
      const dispatchedTasks = result.tasks || [];

      expect(dispatchedTasks.length).toBe(2);
      expect(dispatchedTasks.map(t => t.id).sort()).toEqual(['task-1', 'task-3']);
      expect(dispatchedTasks.every(t => t.status === 'in_progress')).toBe(true);
      // task-2 should NOT be in the dispatched tasks (dependency not met)
      expect(dispatchedTasks.find(t => t.id === 'task-2')).toBeUndefined();
    });

    test('should sort by priority', async () => {
      // Arrange: Multiple pending tasks with different priorities
      const tasks = [
        createTestTask({ id: 'task-low', status: 'pending', priority: 50 }),
        createTestTask({ id: 'task-high', status: 'pending', priority: 100 }),
        createTestTask({ id: 'task-medium', status: 'pending', priority: 75 }),
      ];

      const state = createTestState('Test', { maxEngineers: 1 })
        .withTasks(tasks)
        .withActiveSprint(createTestSprint({ taskIds: tasks.map(t => t.id) }))
        .build();

      // Act
      const result = await engineerDispatchNode(state);

      // Assert: Highest priority task should be dispatched first
      const dispatchedTasks = result.tasks || [];

      expect(dispatchedTasks.length).toBe(1);
      expect(dispatchedTasks[0].id).toBe('task-high');
      expect(dispatchedTasks[0].status).toBe('in_progress');
    });

    test('should not exceed maxEngineers', async () => {
      // Arrange: 10 pending tasks, maxEngineers=3
      const tasks = Array.from({ length: 10 }, (_, i) =>
        createTestTask({ id: `task-${i + 1}`, status: 'pending', priority: 100 - i })
      );

      const state = createTestState('Test', { maxEngineers: 3 })
        .withTasks(tasks)
        .withActiveSprint(createTestSprint({ taskIds: tasks.map(t => t.id) }))
        .build();

      // Act
      const result = await engineerDispatchNode(state);

      // Assert: Exactly 3 tasks should be dispatched
      const dispatchedTasks = result.tasks || [];

      expect(dispatchedTasks.length).toBe(3);
      expect(dispatchedTasks.every(t => t.status === 'in_progress')).toBe(true);
    });
  });

  describe('ReviewDispatchNode (Unit)', () => {
    test('should select tasks in_review status', async () => {
      // Arrange: Mixed task statuses
      const tasks = [
        createTestTask({ id: 'task-1', status: 'in_review' }),
        createTestTask({ id: 'task-2', status: 'in_review' }),
        createTestTask({ id: 'task-3', status: 'in_progress' }),
        createTestTask({ id: 'task-4', status: 'completed' }),
      ];

      const state = createTestState('Test', { maxEngineers: 3 })
        .withTasks(tasks)
        .withActiveSprint(createTestSprint({ taskIds: tasks.map(t => t.id) }))
        .build();

      // Act
      const result = await reviewDispatchNode(state);

      // Assert: Should dispatch 2 tasks (task-1 and task-2 are in_review)
      expect(result.logs).toBeDefined();
      expect(result.logs!.length).toBeGreaterThan(0);
      // Verify that task-1 and task-2 are logged
      const taskLogs = result.logs!.filter(log => log.taskId);
      expect(taskLogs.length).toBe(2);
      expect(taskLogs.map(log => log.taskId).sort()).toEqual(['task-1', 'task-2']);
    });

    test('should allow re-review for changes_requested tasks', async () => {
      // Arrange: task-1 has changes_requested review
      const tasks = [
        createTestTask({ id: 'task-1', status: 'in_review' }),
        createTestTask({ id: 'task-2', status: 'in_review' }),
      ];

      const reviews = [
        createTestReview({ taskId: 'task-1', status: 'changes_requested', timestamp: new Date() }),
      ];

      const state = createTestState('Test', { maxEngineers: 3 })
        .withTasks(tasks)
        .withReviews(reviews)
        .withActiveSprint(createTestSprint({ taskIds: tasks.map(t => t.id) }))
        .build();

      // Act
      const result = await reviewDispatchNode(state);

      // Assert: Both tasks should be dispatched (task-1 for re-review, task-2 for first review)
      expect(result.logs).toBeDefined();
      const taskLogs = result.logs!.filter(log => log.taskId);
      expect(taskLogs.length).toBe(2);
      expect(taskLogs.map(log => log.taskId).sort()).toEqual(['task-1', 'task-2']);
    });

    test('should respect maxEngineers limit', async () => {
      // Arrange: 5 tasks in review, maxEngineers=2
      const tasks = Array.from({ length: 5 }, (_, i) =>
        createTestTask({ id: `task-${i + 1}`, status: 'in_review' })
      );

      const state = createTestState('Test', { maxEngineers: 2 })
        .withTasks(tasks)
        .withActiveSprint(createTestSprint({ taskIds: tasks.map(t => t.id) }))
        .build();

      // Act
      const result = await reviewDispatchNode(state);

      // Assert: Only 2 tasks should be dispatched (maxEngineers limit)
      expect(result.logs).toBeDefined();
      const taskLogs = result.logs!.filter(log => log.taskId);
      expect(taskLogs.length).toBe(2);
    });
  });
});

describe('Parallel Execution (Router Unit Tests)', () => {
  describe('Engineer Dispatch Router (Unit)', () => {
    test('should generate Send objects for all in_progress tasks', () => {
      // Arrange: 3 tasks in_progress
      const tasks = [
        createTestTask({ id: 'task-1', status: 'in_progress' }),
        createTestTask({ id: 'task-2', status: 'in_progress' }),
        createTestTask({ id: 'task-3', status: 'pending' }),
      ];

      const state = createTestState('Test', { maxEngineers: 3 })
        .withTasks(tasks)
        .build();

      // Act: Call router function directly
      const result = engineerDispatchRouter(state);

      // Assert: Should return array of 2 Send objects
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0]).toBeInstanceOf(Send);
      expect((result[0] as Send<any>).node).toBe('engineer');
      expect((result[0] as Send<any>).args.currentTaskId).toBe('task-1');
      expect((result[1] as Send<any>).args.currentTaskId).toBe('task-2');
    });

    test('should return __end__ when no tasks in_progress', () => {
      // Arrange: No in_progress tasks
      const tasks = [
        createTestTask({ id: 'task-1', status: 'pending' }),
        createTestTask({ id: 'task-2', status: 'completed' }),
      ];

      const state = createTestState('Test', { maxEngineers: 3 })
        .withTasks(tasks)
        .build();

      // Act
      const result = engineerDispatchRouter(state);

      // Assert: Should return __end__ marker
      expect(result).toBe('__end__');
    });

    test('should include currentTaskId in Send state', () => {
      // Arrange
      const tasks = [
        createTestTask({ id: 'task-123', status: 'in_progress' }),
      ];

      const state = createTestState('Test', { maxEngineers: 1 })
        .withTasks(tasks)
        .build();

      // Act
      const result = engineerDispatchRouter(state) as Send<any>[];

      // Assert: currentTaskId should be set
      expect(result[0].args.currentTaskId).toBe('task-123');
    });
  });

  describe('Review Dispatch Router (Unit)', () => {
    test('should generate Send objects for in_review tasks', () => {
      // Arrange: 3 tasks in_review
      const tasks = [
        createTestTask({ id: 'task-1', status: 'in_review', priority: 100 }),
        createTestTask({ id: 'task-2', status: 'in_review', priority: 90 }),
        createTestTask({ id: 'task-3', status: 'in_progress' }),
      ];

      const state = createTestState('Test', { maxEngineers: 3 })
        .withTasks(tasks)
        .build();

      // Act
      const result = reviewDispatchRouter(state);

      // Assert: Should return array of 2 Send objects
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0]).toBeInstanceOf(Send);
      expect((result[0] as Send<any>).node).toBe('review');
    });

    test('should respect maxEngineers limit in Send generation', () => {
      // Arrange: 5 tasks in_review, maxEngineers=2
      const tasks = Array.from({ length: 5 }, (_, i) =>
        createTestTask({ id: `task-${i + 1}`, status: 'in_review', priority: 100 - i })
      );

      const state = createTestState('Test', { maxEngineers: 2 })
        .withTasks(tasks)
        .build();

      // Act
      const result = reviewDispatchRouter(state) as Send<any>[];

      // Assert: Should return only 2 Send objects
      expect(result.length).toBe(2);
      // Should select highest priority tasks
      expect(result[0].args.currentTaskId).toBe('task-1');
      expect(result[1].args.currentTaskId).toBe('task-2');
    });

    test('should return __end__ when no tasks to review', () => {
      // Arrange: No in_review tasks
      const tasks = [
        createTestTask({ id: 'task-1', status: 'pending' }),
        createTestTask({ id: 'task-2', status: 'completed' }),
      ];

      const state = createTestState('Test', { maxEngineers: 3 })
        .withTasks(tasks)
        .build();

      // Act
      const result = reviewDispatchRouter(state);

      // Assert: Should return __end__ marker
      expect(result).toBe('__end__');
    });

    test('should allow re-review for changes_requested tasks', () => {
      // Arrange: task-1 already reviewed with changes_requested
      const tasks = [
        createTestTask({ id: 'task-1', status: 'in_review' }),
        createTestTask({ id: 'task-2', status: 'in_review' }),
      ];

      const reviews = [
        createTestReview({ taskId: 'task-1', status: 'changes_requested', timestamp: new Date() }),
      ];

      const state = createTestState('Test', { maxEngineers: 3 })
        .withTasks(tasks)
        .withReviews(reviews)
        .build();

      // Act
      const result = reviewDispatchRouter(state) as Send<any>[];

      // Assert: Both tasks should be reviewable (task-1 for re-review, task-2 for first review)
      expect(result.length).toBe(2);
    });

    test('should skip already approved tasks', () => {
      // Arrange: task-1 already approved
      const tasks = [
        createTestTask({ id: 'task-1', status: 'in_review' }),
        createTestTask({ id: 'task-2', status: 'in_review' }),
      ];

      const reviews = [
        createTestReview({ taskId: 'task-1', status: 'approved', timestamp: new Date() }),
      ];

      const state = createTestState('Test', { maxEngineers: 3 })
        .withTasks(tasks)
        .withReviews(reviews)
        .build();

      // Act
      const result = reviewDispatchRouter(state) as Send<any>[];

      // Assert: Only task-2 should be reviewable
      expect(result.length).toBe(1);
      expect(result[0].args.currentTaskId).toBe('task-2');
    });
  });
});
