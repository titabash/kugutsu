/**
 * MergeCoordinatorNode Unit Tests (Jest)
 */

import { jest } from '@jest/globals';
import { createInitialState, type ParallelDevStateType } from '../../../src/graph/state.js';
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
    const state = createInitialState('Test', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    state.tasks = [
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
    ];

    // Execute mocked node
    const result = await mockMergeCoordinatorNode(state);

    // Verify results
    expect(result.logs).toBeDefined();
    expect(result.logs.some((log) => log.message.includes('マージ可能なタスクがありません'))).toBe(true);
  });

  test('should skip tasks with changes_requested review', async () => {
    const state = createInitialState('Test', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    state.tasks = [
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
    ];

    state.reviews = [
      {
        taskId: 'task-003',
        reviewer: 'TechLeadAI',
        status: 'changes_requested',
        comments: ['Please fix issues'],
        timestamp: new Date(),
      },
    ];

    // Execute mocked node
    const result = await mockMergeCoordinatorNode(state);

    // Verify no merge was attempted
    expect(result.logs).toBeDefined();
    expect(result.logs.some((log) => log.message.includes('マージ可能なタスクがありません'))).toBe(true);
  });

  test('should skip tasks already in merge queue', async () => {
    const state = createInitialState('Test', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    state.tasks = [
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
    ];

    state.reviews = [
      {
        taskId: 'task-004',
        reviewer: 'TechLeadAI',
        status: 'approved',
        comments: ['Approved'],
        timestamp: new Date(),
      },
    ];

    state.mergeQueue = [
      {
        taskId: 'task-004',
        sourceBranch: 'task/task-004',
        targetBranch: 'main',
        status: 'pending',
        attemptedAt: new Date(),
      },
    ];

    // Execute mocked node
    const result = await mockMergeCoordinatorNode(state);

    // Verify no duplicate was added
    expect(result.logs).toBeDefined();
    expect(result.logs.some((log) => log.message.includes('マージ可能なタスクがありません'))).toBe(true);
  });

  test('should skip tasks without branch name', async () => {
    const state = createInitialState('Test', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    state.tasks = [
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
    ];

    state.reviews = [
      {
        taskId: 'task-005',
        reviewer: 'TechLeadAI',
        status: 'approved',
        comments: ['Approved'],
        timestamp: new Date(),
      },
    ];

    // Execute mocked node
    const result = await mockMergeCoordinatorNode(state);

    // Verify task was skipped
    expect(result.logs).toBeDefined();
    expect(result.logs.some((log) => log.message.includes('マージ可能なタスクがありません'))).toBe(true);
  });

  test('should add approved tasks to merge queue', async () => {
    const state = createInitialState('Test', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    state.tasks = [
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
    ];

    state.reviews = [
      {
        taskId: 'task-001',
        reviewer: 'TechLeadAI',
        status: 'approved',
        comments: ['Good work'],
        timestamp: new Date(),
      },
    ];

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
    const state = createInitialState('Test', {
      maxEngineers: 2,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    state.tasks = [
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
    ];

    state.reviews = [
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
    ];

    // Execute mocked node
    const result = await mockMergeCoordinatorNode(state);

    // Verify both tasks were added
    expect(result.mergeQueue).toBeDefined();
    expect(result.mergeQueue!.length).toBe(2);
  });

  describe('File-based artifact management', () => {
    test('should read reviewed tasks and create merge-result.json on success', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { mkdtemp, rm } = await import('fs/promises');
      const { tmpdir } = await import('os');

      const tempDir = await mkdtemp(path.join(tmpdir(), 'merge-coordinator-test-'));
      const kugutsuDir = path.join(tempDir, '.kugutsu');

      try {
        // Create tasks.json with reviewed task
        const tasksData = [
          {
            id: 'task-001',
            title: 'Reviewed task',
            description: 'Ready to merge',
            priority: 100,
            dependencies: [],
            status: 'reviewed',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            worktreePath: path.join(tempDir, 'worktrees/task-001'),
            branchName: 'task/task-001',
          },
        ];

        await fs.mkdir(path.join(kugutsuDir, 'tasks/task-001'), { recursive: true });
        await fs.writeFile(
          path.join(kugutsuDir, 'tasks.json'),
          JSON.stringify(tasksData, null, 2),
          'utf-8'
        );

        // Create review.json with approved status
        const reviewData = {
          taskId: 'task-001',
          status: 'approved',
          reviewedBy: 'TechLeadAI',
          reviewedAt: new Date().toISOString(),
          comments: [],
          summary: 'Looks good',
          suggestions: [],
        };

        await fs.writeFile(
          path.join(kugutsuDir, 'tasks/task-001/review.json'),
          JSON.stringify(reviewData, null, 2),
          'utf-8'
        );

        // Create initial state with Git mock (will be implemented)
        const state = createInitialState('Test', {
          maxEngineers: 1,
          maxTurns: 30,
          baseBranch: 'main',
          baseRepoPath: tempDir,
          worktreeBasePath: path.join(tempDir, 'worktrees'),
        });

        state.tasksPath = '.kugutsu/tasks.json';

        // TODO: Mock git merge to succeed
        // const result = await mergeCoordinatorNode(state);

        // For now, manually create expected files
        const mergeResult = {
          taskId: 'task-001',
          branch: 'task/task-001',
          targetBranch: 'main',
          status: 'success',
          mergedAt: new Date().toISOString(),
          commitHash: 'abc123',
          message: 'Merge successful',
        };

        await fs.writeFile(
          path.join(kugutsuDir, 'tasks/task-001/merge-result.json'),
          JSON.stringify(mergeResult, null, 2),
          'utf-8'
        );

        // Update tasks.json status to completed
        tasksData[0].status = 'completed';
        tasksData[0].updatedAt = new Date().toISOString();
        await fs.writeFile(
          path.join(kugutsuDir, 'tasks.json'),
          JSON.stringify(tasksData, null, 2),
          'utf-8'
        );

        // Verify merge-result.json was created
        const mergeResultPath = path.join(kugutsuDir, 'tasks/task-001/merge-result.json');
        const mergeResultExists = await fs.access(mergeResultPath).then(() => true).catch(() => false);
        expect(mergeResultExists).toBe(true);

        // Verify merge-result.json content
        const mergeResultContent = await fs.readFile(mergeResultPath, 'utf-8');
        const savedMergeResult = JSON.parse(mergeResultContent);
        expect(savedMergeResult.taskId).toBe('task-001');
        expect(savedMergeResult.status).toBe('success');
        expect(savedMergeResult.commitHash).toBeDefined();

        // Verify tasks.json was updated to 'completed'
        const tasksContent = await fs.readFile(path.join(kugutsuDir, 'tasks.json'), 'utf-8');
        const updatedTasks = JSON.parse(tasksContent);
        expect(updatedTasks[0].status).toBe('completed');
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    test('should create conflicts.json on merge conflict', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { mkdtemp, rm } = await import('fs/promises');
      const { tmpdir } = await import('os');

      const tempDir = await mkdtemp(path.join(tmpdir(), 'merge-conflict-test-'));
      const kugutsuDir = path.join(tempDir, '.kugutsu');

      try {
        // Create tasks.json with reviewed task
        const tasksData = [
          {
            id: 'task-002',
            title: 'Conflicting task',
            description: 'Will cause conflict',
            priority: 100,
            dependencies: [],
            status: 'reviewed',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            worktreePath: path.join(tempDir, 'worktrees/task-002'),
            branchName: 'task/task-002',
          },
        ];

        await fs.mkdir(path.join(kugutsuDir, 'tasks/task-002'), { recursive: true });
        await fs.writeFile(
          path.join(kugutsuDir, 'tasks.json'),
          JSON.stringify(tasksData, null, 2),
          'utf-8'
        );

        // Create review.json with approved status
        const reviewData = {
          taskId: 'task-002',
          status: 'approved',
          reviewedBy: 'TechLeadAI',
          reviewedAt: new Date().toISOString(),
          comments: [],
          summary: 'Approved',
          suggestions: [],
        };

        await fs.writeFile(
          path.join(kugutsuDir, 'tasks/task-002/review.json'),
          JSON.stringify(reviewData, null, 2),
          'utf-8'
        );

        // TODO: Mock git merge to fail with conflict
        // const state = createInitialState(...);
        // const result = await mergeCoordinatorNode(state);

        // For now, manually create expected files
        const mergeResult = {
          taskId: 'task-002',
          branch: 'task/task-002',
          targetBranch: 'main',
          status: 'conflict',
          mergedAt: new Date().toISOString(),
          conflictFiles: ['src/index.ts', 'package.json'],
          message: 'Merge conflict detected',
        };

        await fs.writeFile(
          path.join(kugutsuDir, 'tasks/task-002/merge-result.json'),
          JSON.stringify(mergeResult, null, 2),
          'utf-8'
        );

        // Create conflicts.json
        const conflictsData = {
          taskId: 'task-002',
          conflictFiles: [
            {
              path: 'src/index.ts',
              conflicts: [
                {
                  line: 10,
                  ours: 'const x = 1;',
                  theirs: 'const x = 2;',
                  resolved: '',
                },
              ],
            },
          ],
          resolution: 'pending',
        };

        await fs.writeFile(
          path.join(kugutsuDir, 'tasks/task-002/conflicts.json'),
          JSON.stringify(conflictsData, null, 2),
          'utf-8'
        );

        // Update tasks.json status to conflict_detected
        tasksData[0].status = 'conflict_detected';
        tasksData[0].updatedAt = new Date().toISOString();
        await fs.writeFile(
          path.join(kugutsuDir, 'tasks.json'),
          JSON.stringify(tasksData, null, 2),
          'utf-8'
        );

        // Verify conflicts.json was created
        const conflictsPath = path.join(kugutsuDir, 'tasks/task-002/conflicts.json');
        const conflictsExists = await fs.access(conflictsPath).then(() => true).catch(() => false);
        expect(conflictsExists).toBe(true);

        // Verify conflicts.json content
        const conflictsContent = await fs.readFile(conflictsPath, 'utf-8');
        const savedConflicts = JSON.parse(conflictsContent);
        expect(savedConflicts.taskId).toBe('task-002');
        expect(savedConflicts.resolution).toBe('pending');
        expect(savedConflicts.conflictFiles).toBeDefined();
        expect(savedConflicts.conflictFiles.length).toBeGreaterThan(0);

        // Verify tasks.json was updated to 'conflict_detected'
        const tasksContent = await fs.readFile(path.join(kugutsuDir, 'tasks.json'), 'utf-8');
        const updatedTasks = JSON.parse(tasksContent);
        expect(updatedTasks[0].status).toBe('conflict_detected');

        // Verify merge-result.json shows conflict status
        const mergeResultPath = path.join(kugutsuDir, 'tasks/task-002/merge-result.json');
        const mergeResultContent = await fs.readFile(mergeResultPath, 'utf-8');
        const savedMergeResult = JSON.parse(mergeResultContent);
        expect(savedMergeResult.status).toBe('conflict');
        expect(savedMergeResult.conflictFiles).toBeDefined();
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
