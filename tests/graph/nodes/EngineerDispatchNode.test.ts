/**
 * EngineerDispatchNode Unit Tests (Jest)
 */

import { jest } from '@jest/globals';
import type { Task } from '../../../src/graph/types.js';

// Mock GitWorktreeManager BEFORE importing the module
const mockCreateWorktree = jest.fn<() => Promise<any>>();
const mockRemoveWorktree = jest.fn<() => Promise<void>>();
const mockCleanupAllWorktrees = jest.fn<() => Promise<void>>();

jest.unstable_mockModule('../../../src/managers/GitWorktreeManager.js', () => ({
  GitWorktreeManager: jest.fn().mockImplementation(() => ({
    createWorktree: mockCreateWorktree,
    removeWorktree: mockRemoveWorktree,
    cleanupAllWorktrees: mockCleanupAllWorktrees,
  })),
}));

// Now import the modules
const { engineerDispatchNode } = await import('../../../src/graph/nodes/EngineerDispatchNode.js');
const { createInitialState } = await import('../../../src/graph/state.js');

describe('EngineerDispatchNode', () => {
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

  test('should return empty result when no executable tasks', async () => {
    // Create initial state with no tasks
    const initialState = createInitialState('Test request', {
      maxEngineers: 3,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    initialState.tasks = [];

    // Execute node
    const result = await engineerDispatchNode(initialState);

    // Verify empty result
    expect(result.logs).toBeDefined();
    expect(result.logs!.length).toBeGreaterThan(0);
    expect(result.logs![0].message).toContain('実行可能なタスクがありません');
  });

  test('should dispatch pending tasks with satisfied dependencies', async () => {
    // Create initial state with tasks
    const initialState = createInitialState('Test request', {
      maxEngineers: 3,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    // Add tasks
    const task1: Task = {
      id: 'task-001',
      title: 'Task 1',
      description: 'First task',
      status: 'pending',
      priority: 100,
      dependencies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const task2: Task = {
      id: 'task-002',
      title: 'Task 2',
      description: 'Second task',
      status: 'pending',
      priority: 80,
      dependencies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    initialState.tasks = [task1, task2];

    // Execute node
    const result = await engineerDispatchNode(initialState);

    // Verify createWorktree was called
    expect(mockCreateWorktree).toHaveBeenCalled();

    // Verify results
    expect(result.tasks).toBeDefined();
    expect(result.tasks!.length).toBe(2);

    // Check that tasks were updated to in_progress
    const updatedTasks = result.tasks!;
    expect(updatedTasks[0].status).toBe('in_progress');
    expect(updatedTasks[1].status).toBe('in_progress');
    expect(updatedTasks[0].worktreePath).toBeDefined();
    expect(updatedTasks[0].branchName).toBeDefined();

    // Check worktrees were created
    expect(result.worktrees).toBeDefined();
    expect(result.worktrees!.size).toBe(2);

    // Check logs
    expect(result.logs).toBeDefined();
    expect(result.logs!.length).toBeGreaterThan(0);
  });

  test('should respect maxEngineers limit', async () => {
    // Create initial state with limited engineers
    const initialState = createInitialState('Test request', {
      maxEngineers: 1, // Only 1 engineer
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    // Add multiple tasks
    const tasks: Task[] = [
      {
        id: 'task-001',
        title: 'Task 1',
        description: 'First task',
        status: 'pending',
        priority: 100,
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'task-002',
        title: 'Task 2',
        description: 'Second task',
        status: 'pending',
        priority: 80,
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'task-003',
        title: 'Task 3',
        description: 'Third task',
        status: 'pending',
        priority: 60,
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    initialState.tasks = tasks;

    // Execute node
    const result = await engineerDispatchNode(initialState);

    // Verify all tasks that changed state are returned
    expect(result.tasks).toBeDefined();
    expect(result.tasks!.length).toBe(3); // All 3 tasks changed state (pending → ready or ready → in_progress)

    // Verify task-001 (highest priority) was dispatched to in_progress
    const task001 = result.tasks!.find((t) => t.id === 'task-001');
    expect(task001?.status).toBe('in_progress');
    expect(task001?.worktreePath).toBeDefined();

    // Verify task-002 and task-003 moved to ready but not dispatched
    const task002 = result.tasks!.find((t) => t.id === 'task-002');
    const task003 = result.tasks!.find((t) => t.id === 'task-003');
    expect(task002?.status).toBe('ready');
    expect(task003?.status).toBe('ready');
  });

  test('should skip tasks with unsatisfied dependencies', async () => {
    // Create initial state
    const initialState = createInitialState('Test request', {
      maxEngineers: 3,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    // Add tasks with dependencies
    const task1: Task = {
      id: 'task-001',
      title: 'Task 1',
      description: 'First task',
      status: 'pending',
      priority: 100,
      dependencies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const task2: Task = {
      id: 'task-002',
      title: 'Task 2',
      description: 'Second task (depends on task-001)',
      status: 'pending',
      priority: 80,
      dependencies: ['task-001'], // Depends on task-001
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    initialState.tasks = [task1, task2];
    initialState.completedTasks = []; // task-001 not completed yet

    // Execute node
    const result = await engineerDispatchNode(initialState);

    // Verify only task-001 was dispatched
    expect(result.tasks).toBeDefined();
    expect(result.tasks!.length).toBe(1);
    expect(result.tasks![0].id).toBe('task-001');
  });
});
