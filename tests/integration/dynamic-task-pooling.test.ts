/**
 * Dynamic Task Pooling Integration Tests
 *
 * Verifies that tasks are dynamically pooled and dispatched
 * as soon as slots become available (review/merge complete).
 */

import { jest } from '@jest/globals';
import type { Task } from '../../src/graph/types.js';
import type { ParallelDevStateType } from '../../src/graph/state.js';

// Mock GitWorktreeManager BEFORE importing the module
const mockCreateWorktree = jest.fn<() => Promise<any>>();
const mockRemoveWorktree = jest.fn<() => Promise<void>>();
const mockCleanupAllWorktrees = jest.fn<() => Promise<void>>();

jest.unstable_mockModule('../../src/managers/GitWorktreeManager.js', () => ({
  GitWorktreeManager: jest.fn().mockImplementation(() => ({
    createWorktree: mockCreateWorktree,
    removeWorktree: mockRemoveWorktree,
    cleanupAllWorktrees: mockCleanupAllWorktrees,
  })),
}));

// Now import the modules
const { engineerDispatchNode } = await import('../../src/graph/nodes/EngineerDispatchNode.js');
const { createInitialState } = await import('../../src/graph/state.js');
const { TaskStateMachine } = await import('../../src/utils/TaskStateMachine.js');

// Helper to merge state updates (moved before describe block)
function mergeState(
  state: ParallelDevStateType,
  update: Partial<ParallelDevStateType>
): ParallelDevStateType {
  return {
    ...state,
    ...(update.tasks && {
      tasks: [
        ...state.tasks.filter((t) => !update.tasks!.some((ut) => ut.id === t.id)),
        ...update.tasks,
      ],
    }),
    ...(update.worktrees && {
      worktrees: new Map([...state.worktrees, ...update.worktrees]),
    }),
    ...(update.reviews && { reviews: [...state.reviews, ...update.reviews] }),
    ...(update.logs && { logs: [...state.logs, ...update.logs] }),
    ...(update.mergeQueue && { mergeQueue: [...state.mergeQueue, ...update.mergeQueue] }),
  };
}

describe('Dynamic Task Pooling Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set default mock behavior
    mockCreateWorktree.mockResolvedValue({
      path: '/test/worktrees/mock-task',
      branchName: 'task/mock-task',
    });
    mockRemoveWorktree.mockResolvedValue(undefined);
    mockCleanupAllWorktrees.mockResolvedValue(undefined);
  });

  test('should dispatch next task immediately when a slot becomes available', async () => {
    /**
     * Scenario: 6 tasks, maxEngineers=5
     * - T1-T5 start immediately
     * - When T1 completes (review + merge), T6 should start immediately
     * - NOT wait for all T2-T5 to complete
     */

    // Create initial state with 6 tasks
    const initialState = createInitialState('Test request', {
      maxEngineers: 5,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    const tasks: Task[] = [
      {
        id: 'task-001',
        title: 'Task 1 (quick)',
        description: 'Will complete first',
        status: 'pending',
        priority: 100,
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'task-002',
        title: 'Task 2',
        description: 'Long running',
        status: 'pending',
        priority: 90,
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'task-003',
        title: 'Task 3',
        description: 'Long running',
        status: 'pending',
        priority: 80,
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'task-004',
        title: 'Task 4',
        description: 'Long running',
        status: 'pending',
        priority: 70,
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'task-005',
        title: 'Task 5',
        description: 'Long running',
        status: 'pending',
        priority: 60,
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'task-006',
        title: 'Task 6',
        description: 'Should start when T1 completes',
        status: 'pending',
        priority: 50,
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    initialState.tasks = tasks;
    initialState.activeSprint = {
      id: 'sprint-pooling-001',
      name: 'Pooling Sprint',
      goal: 'Test pooling',
      taskIds: tasks.map(t => t.id),
      startedAt: new Date(),
      status: 'active',
      deployable: false,
      metadata: {
        estimatedHours: 8,
        blockers: [],
        completedTasksCount: 0,
        failedTasksCount: 0,
      },
    };

    // Step 1: Initial dispatch (should dispatch T1-T5, 5 available slots)
    let state = initialState;
    const dispatch1 = await engineerDispatchNode(state);

    expect(dispatch1.tasks).toBeDefined();
    expect(dispatch1.tasks!.length).toBe(5); // T1-T5 dispatched

    state = mergeState(state, dispatch1);

    // Verify T1-T5 are in_progress, T6 is still pending
    expect(state.tasks.filter((t) => t.status === 'in_progress').length).toBe(5);
    const task6 = state.tasks.find((t) => t.id === 'task-006');
    expect(task6?.status).toBe('pending');

    // Step 2: Simulate T1 completion (in_progress → in_review → completed)
    const task1 = state.tasks.find((t) => t.id === 'task-001')!;
    const task1Reviewed = TaskStateMachine.transition(
      { ...task1, sessionId: 'test-session' },
      'in_review'
    );
    const task1Completed = TaskStateMachine.transition(task1Reviewed, 'completed');

    // Update state: T1 completed, T2-T5 still in_progress
    state = {
      ...state,
      tasks: state.tasks.map((t) =>
        t.id === 'task-001' ? task1Completed : t
      ),
    };

    // Step 3: Second dispatch (should dispatch T6, 1 available slot)
    const dispatch2 = await engineerDispatchNode(state);

    expect(dispatch2.tasks).toBeDefined();
    expect(dispatch2.tasks!.length).toBe(1); // Only T6 dispatched

    const dispatchedTask6 = dispatch2.tasks!.find((t) => t.id === 'task-006');
    expect(dispatchedTask6).toBeDefined();
    expect(dispatchedTask6?.status).toBe('in_progress');

    // Verify state after second dispatch
    state = mergeState(state, dispatch2);
    const inProgress = state.tasks.filter((t) => t.status === 'in_progress');
    expect(inProgress.length).toBe(5); // T2-T6 in_progress (T1 completed)

    // Verify T6 is now in_progress
    const finalTask6 = state.tasks.find((t) => t.id === 'task-006');
    expect(finalTask6?.status).toBe('in_progress');
  });

  test('should respect dependency constraints when pooling tasks', async () => {
    /**
     * Scenario: 6 tasks, T6 depends on T2
     * - T1-T5 start immediately
     * - T1 completes → T6 should NOT start (T2 still in_progress)
     * - T2 completes → T6 should start
     */

    const initialState = createInitialState('Test request', {
      maxEngineers: 5,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    const tasks: Task[] = [
      {
        id: 'task-001',
        title: 'Task 1',
        description: 'Independent',
        status: 'pending',
        priority: 100,
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'task-002',
        title: 'Task 2',
        description: 'T6 depends on this',
        status: 'pending',
        priority: 90,
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'task-003',
        title: 'Task 3',
        description: 'Independent',
        status: 'pending',
        priority: 80,
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'task-004',
        title: 'Task 4',
        description: 'Independent',
        status: 'pending',
        priority: 70,
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'task-005',
        title: 'Task 5',
        description: 'Independent',
        status: 'pending',
        priority: 60,
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'task-006',
        title: 'Task 6',
        description: 'Depends on T2',
        status: 'pending',
        priority: 50,
        dependencies: ['task-002'], // ✅ T6 depends on T2
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    initialState.tasks = tasks;
    initialState.activeSprint = {
      id: 'sprint-pooling-002',
      name: 'Pooling Sprint 2',
      goal: 'Test pooling dependencies',
      taskIds: tasks.map(t => t.id),
      startedAt: new Date(),
      status: 'active',
      deployable: false,
      metadata: {
        estimatedHours: 8,
        blockers: [],
        completedTasksCount: 0,
        failedTasksCount: 0,
      },
    };

    // Step 1: Initial dispatch (T1-T5)
    let state = initialState;
    const dispatch1 = await engineerDispatchNode(state);
    state = mergeState(state, dispatch1);

    expect(state.tasks.filter((t) => t.status === 'in_progress').length).toBe(5);

    // Step 2: T1 completes, but T6 cannot start (T2 still in_progress)
    const task1 = state.tasks.find((t) => t.id === 'task-001')!;
    const task1Completed = TaskStateMachine.transition(
      TaskStateMachine.transition({ ...task1, sessionId: 'test' }, 'in_review'),
      'completed'
    );

    state = {
      ...state,
      tasks: state.tasks.map((t) => (t.id === 'task-001' ? task1Completed : t)),
    };

    // Step 3: Try to dispatch T6 (should fail - dependency not satisfied)
    const dispatch2 = await engineerDispatchNode(state);

    // T6 should NOT be dispatched
    expect(dispatch2.tasks).toBeDefined();
    expect(dispatch2.tasks!.find((t) => t.id === 'task-006')).toBeUndefined();

    // Step 4: T2 completes
    const task2 = state.tasks.find((t) => t.id === 'task-002')!;
    const task2Completed = TaskStateMachine.transition(
      TaskStateMachine.transition({ ...task2, sessionId: 'test' }, 'in_review'),
      'completed'
    );

    state = {
      ...state,
      tasks: state.tasks.map((t) => (t.id === 'task-002' ? task2Completed : t)),
    };

    // Step 5: Now T6 can be dispatched (dependency satisfied)
    const dispatch3 = await engineerDispatchNode(state);

    expect(dispatch3.tasks).toBeDefined();
    expect(dispatch3.tasks!.length).toBe(1);

    const dispatchedTask6 = dispatch3.tasks!.find((t) => t.id === 'task-006');
    expect(dispatchedTask6).toBeDefined();
    expect(dispatchedTask6?.status).toBe('in_progress');
  });

  test('should not dispatch when no available slots', async () => {
    /**
     * Scenario: 3 tasks, maxEngineers=2
     * - T1-T2 start
     * - Try to dispatch again → should not dispatch T3 (no slots)
     */

    const initialState = createInitialState('Test request', {
      maxEngineers: 2,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    const tasks: Task[] = [
      { id: 'task-001', title: 'Task 1', description: 'T1', status: 'pending', priority: 100, dependencies: [], createdAt: new Date(), updatedAt: new Date() },
      { id: 'task-002', title: 'Task 2', description: 'T2', status: 'pending', priority: 90, dependencies: [], createdAt: new Date(), updatedAt: new Date() },
      { id: 'task-003', title: 'Task 3', description: 'T3', status: 'pending', priority: 80, dependencies: [], createdAt: new Date(), updatedAt: new Date() },
    ];

    initialState.tasks = tasks;
    initialState.activeSprint = {
      id: 'sprint-pooling-003',
      name: 'Pooling Sprint 3',
      goal: 'Test no slots',
      taskIds: tasks.map(t => t.id),
      startedAt: new Date(),
      status: 'active',
      deployable: false,
      metadata: {
        estimatedHours: 8,
        blockers: [],
        completedTasksCount: 0,
        failedTasksCount: 0,
      },
    };

    // Step 1: Initial dispatch (T1-T2)
    let state = initialState;
    const dispatch1 = await engineerDispatchNode(state);
    state = mergeState(state, dispatch1);

    expect(state.tasks.filter((t) => t.status === 'in_progress').length).toBe(2);

    // Step 2: Try to dispatch again (no slots available)
    const dispatch2 = await engineerDispatchNode(state);

    // No tasks should be dispatched
    expect(dispatch2.tasks).toBeDefined();
    expect(dispatch2.tasks!.length).toBe(0);

    // Verify T3 is still pending
    const task3 = state.tasks.find((t) => t.id === 'task-003');
    expect(task3?.status).toBe('pending');
  });
});
