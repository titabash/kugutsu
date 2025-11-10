/**
 * ReviewDispatchNode Unit Tests (Jest)
 */

import { jest } from '@jest/globals';
import type { Task, Review } from '../../../src/graph/types.js';

// Now import the modules
const { reviewDispatchNode } = await import('../../../src/graph/nodes/ReviewDispatchNode.js');
const { createInitialState } = await import('../../../src/graph/state.js');

describe('ReviewDispatchNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return empty result when no reviewable tasks', async () => {
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
    const result = await reviewDispatchNode(initialState);

    // Verify empty result
    expect(result.logs).toBeDefined();
    expect(result.logs!.length).toBeGreaterThan(0);
    expect(result.logs![0].message).toContain('レビュー可能なタスクがありません');
  });

  test('should dispatch in_review tasks up to maxEngineers limit', async () => {
    // Create initial state with tasks
    const initialState = createInitialState('Test request', {
      maxEngineers: 3,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    // Add tasks in review status
    const task1: Task = {
      id: 'task-001',
      title: 'Task 1',
      description: 'First task',
      status: 'in_review',
      priority: 100,
      dependencies: [],
      worktreePath: '/test/worktrees/task-001',
      branchName: 'task/task-001',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const task2: Task = {
      id: 'task-002',
      title: 'Task 2',
      description: 'Second task',
      status: 'in_review',
      priority: 80,
      dependencies: [],
      worktreePath: '/test/worktrees/task-002',
      branchName: 'task/task-002',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    initialState.tasks = [task1, task2];
    initialState.reviews = [];

    // Execute node
    const result = await reviewDispatchNode(initialState);

    // Verify results
    expect(result.logs).toBeDefined();
    expect(result.logs!.length).toBeGreaterThan(0);

    // Both tasks should be ready for review
    const logMessage = result.logs!.find(log => log.message.includes('個のタスクをレビュー開始'));
    expect(logMessage).toBeDefined();
    expect(logMessage?.message).toContain('2個のタスクをレビュー開始');
  });

  test('should respect maxEngineers limit', async () => {
    // Create initial state with limited engineers
    const initialState = createInitialState('Test request', {
      maxEngineers: 1, // Only 1 reviewer
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    // Add multiple tasks in review
    const tasks: Task[] = [
      {
        id: 'task-001',
        title: 'Task 1',
        description: 'First task',
        status: 'in_review',
        priority: 100,
        dependencies: [],
        worktreePath: '/test/worktrees/task-001',
        branchName: 'task/task-001',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'task-002',
        title: 'Task 2',
        description: 'Second task',
        status: 'in_review',
        priority: 80,
        dependencies: [],
        worktreePath: '/test/worktrees/task-002',
        branchName: 'task/task-002',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'task-003',
        title: 'Task 3',
        description: 'Third task',
        status: 'in_review',
        priority: 60,
        dependencies: [],
        worktreePath: '/test/worktrees/task-003',
        branchName: 'task/task-003',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    initialState.tasks = tasks;
    initialState.reviews = [];

    // Execute node
    const result = await reviewDispatchNode(initialState);

    // Verify only 1 task is dispatched
    expect(result.logs).toBeDefined();
    const logMessage = result.logs!.find(log => log.message.includes('個のタスクをレビュー開始'));
    expect(logMessage).toBeDefined();
    expect(logMessage?.message).toContain('1個のタスクをレビュー開始');
  });

  test('should skip already reviewed tasks', async () => {
    // Create initial state
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
      status: 'in_review',
      priority: 100,
      dependencies: [],
      worktreePath: '/test/worktrees/task-001',
      branchName: 'task/task-001',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const task2: Task = {
      id: 'task-002',
      title: 'Task 2',
      description: 'Second task',
      status: 'in_review',
      priority: 80,
      dependencies: [],
      worktreePath: '/test/worktrees/task-002',
      branchName: 'task/task-002',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // task-001 already has a review
    const existingReview: Review = {
      taskId: 'task-001',
      reviewer: 'tech-lead-001',
      status: 'approved',
      comments: ['LGTM'],
      timestamp: new Date(),
    };

    initialState.tasks = [task1, task2];
    initialState.reviews = [existingReview];

    // Execute node
    const result = await reviewDispatchNode(initialState);

    // Verify only task-002 is dispatched (task-001 already reviewed)
    expect(result.logs).toBeDefined();
    const logMessage = result.logs!.find(log => log.message.includes('個のタスクをレビュー開始'));
    expect(logMessage).toBeDefined();
    expect(logMessage?.message).toContain('1個のタスクをレビュー開始');
  });

  test('should handle priority sorting correctly', async () => {
    // Create initial state
    const initialState = createInitialState('Test request', {
      maxEngineers: 2, // Only 2 reviewers
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    // Add tasks with different priorities
    const tasks: Task[] = [
      {
        id: 'task-001',
        title: 'Task 1',
        description: 'Low priority task',
        status: 'in_review',
        priority: 50,
        dependencies: [],
        worktreePath: '/test/worktrees/task-001',
        branchName: 'task/task-001',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'task-002',
        title: 'Task 2',
        description: 'High priority task',
        status: 'in_review',
        priority: 100,
        dependencies: [],
        worktreePath: '/test/worktrees/task-002',
        branchName: 'task/task-002',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'task-003',
        title: 'Task 3',
        description: 'Medium priority task',
        status: 'in_review',
        priority: 75,
        dependencies: [],
        worktreePath: '/test/worktrees/task-003',
        branchName: 'task/task-003',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    initialState.tasks = tasks;
    initialState.reviews = [];

    // Execute node
    const result = await reviewDispatchNode(initialState);

    // Verify 2 tasks are dispatched (maxEngineers=2)
    expect(result.logs).toBeDefined();
    const logMessage = result.logs!.find(log => log.message.includes('個のタスクをレビュー開始'));
    expect(logMessage).toBeDefined();
    expect(logMessage?.message).toContain('2個のタスクをレビュー開始');

    // Verify high priority tasks are logged
    const taskLogs = result.logs!.filter(log => log.taskId);
    expect(taskLogs.length).toBe(2);

    // The dispatched tasks should be task-002 (priority 100) and task-003 (priority 75)
    const taskIds = taskLogs.map(log => log.taskId).sort();
    expect(taskIds).toEqual(['task-002', 'task-003'].sort());
  });
});
