/**
 * MergeCoordinatorNode Unit Tests (Jest)
 */

import { jest } from '@jest/globals';
import type { ParallelDevStateType } from '../../../src/graph/state.js';
import type { Task, Review } from '../../../src/graph/types.js';

// Mock mergeCoordinatorNode function for testing logic
async function mockMergeCoordinatorNode(state: ParallelDevStateType) {
  const { reviews, tasks, config, mergeQueue } = state;

  // Identify approved tasks
  const approvedReviews = reviews.filter((r) => r.status === 'approved');
  const approvedTaskIds = new Set(approvedReviews.map((r) => r.taskId));

  // Find tasks ready to merge
  const existingMergeTaskIds = new Set(mergeQueue.map((m) => m.taskId));
  const tasksToMerge = tasks.filter(
    (t) =>
      t.status === 'completed' &&
      approvedTaskIds.has(t.id) &&
      !existingMergeTaskIds.has(t.id) &&
      t.branchName
  );

  if (tasksToMerge.length === 0) {
    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'info' as const,
          source: 'MergeCoordinatorNode',
          message: 'マージ可能なタスクがありません',
        },
      ],
    };
  }

  // Add to merge queue
  const newMergeTasks = tasksToMerge.map((task) => ({
    taskId: task.id,
    sourceBranch: task.branchName!,
    targetBranch: config.baseBranch,
    status: 'pending' as const,
    attemptedAt: new Date(),
  }));

  return {
    mergeQueue: newMergeTasks,
    logs: [
      {
        timestamp: new Date(),
        level: 'info' as const,
        source: 'MergeCoordinatorNode',
        message: `${tasksToMerge.length}個のタスクをマージキューに追加しました`,
      },
    ],
  };
}

describe('MergeCoordinatorNode', () => {
  test('should handle no tasks ready for merge', async () => {
    // Create state with no approved tasks
    const state: ParallelDevStateType = {
      userRequest: 'Test',
      tasks: [
        {
          id: 'task-002',
          title: 'Not reviewed task',
          description: 'No review yet',
          status: 'completed',
          priority: 100,
          dependencies: [],
          worktreePath: '/test/worktrees/task-002',
          branchName: 'task/task-002',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      completedTasks: [],
      failedTasks: [],
      reviews: [],
      mergeQueue: [],
      worktrees: new Map(),
      config: {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      },
      logs: [],
      metadata: {},
    };

    // Execute mocked node
    const result = await mockMergeCoordinatorNode(state);

    // Verify results
    expect(result.logs).toBeDefined();
    expect(result.logs.some((log) => log.message.includes('マージ可能なタスクがありません'))).toBe(true);
  });

  test('should skip tasks with changes_requested review', async () => {
    const state: ParallelDevStateType = {
      userRequest: 'Test',
      tasks: [
        {
          id: 'task-003',
          title: 'Task with requested changes',
          description: 'Needs changes',
          status: 'completed',
          priority: 100,
          dependencies: [],
          worktreePath: '/test/worktrees/task-003',
          branchName: 'task/task-003',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      completedTasks: [],
      failedTasks: [],
      reviews: [
        {
          taskId: 'task-003',
          reviewer: 'TechLeadAI',
          status: 'changes_requested',
          comments: ['Please fix issues'],
          timestamp: new Date(),
        },
      ],
      mergeQueue: [],
      worktrees: new Map(),
      config: {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      },
      logs: [],
      metadata: {},
    };

    // Execute mocked node
    const result = await mockMergeCoordinatorNode(state);

    // Verify no merge was attempted
    expect(result.logs).toBeDefined();
    expect(result.logs.some((log) => log.message.includes('マージ可能なタスクがありません'))).toBe(true);
  });

  test('should skip tasks already in merge queue', async () => {
    const state: ParallelDevStateType = {
      userRequest: 'Test',
      tasks: [
        {
          id: 'task-004',
          title: 'Already in queue',
          description: 'Already queued for merge',
          status: 'completed',
          priority: 100,
          dependencies: [],
          worktreePath: '/test/worktrees/task-004',
          branchName: 'task/task-004',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      completedTasks: [],
      failedTasks: [],
      reviews: [
        {
          taskId: 'task-004',
          reviewer: 'TechLeadAI',
          status: 'approved',
          comments: ['Approved'],
          timestamp: new Date(),
        },
      ],
      mergeQueue: [
        {
          taskId: 'task-004',
          sourceBranch: 'task/task-004',
          targetBranch: 'main',
          status: 'pending',
          attemptedAt: new Date(),
        },
      ],
      worktrees: new Map(),
      config: {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      },
      logs: [],
      metadata: {},
    };

    // Execute mocked node
    const result = await mockMergeCoordinatorNode(state);

    // Verify no duplicate was added
    expect(result.logs).toBeDefined();
    expect(result.logs.some((log) => log.message.includes('マージ可能なタスクがありません'))).toBe(true);
  });

  test('should skip tasks without branch name', async () => {
    const state: ParallelDevStateType = {
      userRequest: 'Test',
      tasks: [
        {
          id: 'task-005',
          title: 'No branch name',
          description: 'Missing branch',
          status: 'completed',
          priority: 100,
          dependencies: [],
          worktreePath: '/test/worktrees/task-005',
          // branchName is missing
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      completedTasks: [],
      failedTasks: [],
      reviews: [
        {
          taskId: 'task-005',
          reviewer: 'TechLeadAI',
          status: 'approved',
          comments: ['Approved'],
          timestamp: new Date(),
        },
      ],
      mergeQueue: [],
      worktrees: new Map(),
      config: {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      },
      logs: [],
      metadata: {},
    };

    // Execute mocked node
    const result = await mockMergeCoordinatorNode(state);

    // Verify task was skipped
    expect(result.logs).toBeDefined();
    expect(result.logs.some((log) => log.message.includes('マージ可能なタスクがありません'))).toBe(true);
  });

  test('should add approved tasks to merge queue', async () => {
    const state: ParallelDevStateType = {
      userRequest: 'Test',
      tasks: [
        {
          id: 'task-001',
          title: 'Completed task',
          description: 'Ready to merge',
          status: 'completed',
          priority: 100,
          dependencies: [],
          worktreePath: '/test/worktrees/task-001',
          branchName: 'task/task-001',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      completedTasks: [],
      failedTasks: [],
      reviews: [
        {
          taskId: 'task-001',
          reviewer: 'TechLeadAI',
          status: 'approved',
          comments: ['Good work'],
          timestamp: new Date(),
        },
      ],
      mergeQueue: [],
      worktrees: new Map(),
      config: {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      },
      logs: [],
      metadata: {},
    };

    // Execute mocked node
    const result = await mockMergeCoordinatorNode(state);

    // Verify task was added to merge queue
    expect(result.mergeQueue).toBeDefined();
    expect(result.mergeQueue!.length).toBe(1);
    expect(result.mergeQueue![0].taskId).toBe('task-001');
    expect(result.mergeQueue![0].sourceBranch).toBe('task/task-001');
    expect(result.mergeQueue![0].status).toBe('pending');
  });

  test('should process multiple approved tasks', async () => {
    const state: ParallelDevStateType = {
      userRequest: 'Test',
      tasks: [
        {
          id: 'task-006',
          title: 'First task',
          description: 'First merge',
          status: 'completed',
          priority: 100,
          dependencies: [],
          worktreePath: '/test/worktrees/task-006',
          branchName: 'task/task-006',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'task-007',
          title: 'Second task',
          description: 'Second merge',
          status: 'completed',
          priority: 80,
          dependencies: [],
          worktreePath: '/test/worktrees/task-007',
          branchName: 'task/task-007',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      completedTasks: [],
      failedTasks: [],
      reviews: [
        {
          taskId: 'task-006',
          reviewer: 'TechLeadAI',
          status: 'approved',
          comments: ['Good'],
          timestamp: new Date(),
        },
        {
          taskId: 'task-007',
          reviewer: 'TechLeadAI',
          status: 'approved',
          comments: ['Good'],
          timestamp: new Date(),
        },
      ],
      mergeQueue: [],
      worktrees: new Map(),
      config: {
        maxEngineers: 2,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      },
      logs: [],
      metadata: {},
    };

    // Execute mocked node
    const result = await mockMergeCoordinatorNode(state);

    // Verify both tasks were added
    expect(result.mergeQueue).toBeDefined();
    expect(result.mergeQueue!.length).toBe(2);
  });
});
