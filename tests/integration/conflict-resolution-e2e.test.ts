/**
 * Conflict Resolution E2E Test
 *
 * Tests merge conflict detection and resolution workflow
 *
 * NOTE: This test verifies the ConflictResolver node logic.
 * Actual git merge conflicts are mocked for simplicity.
 */

import { jest } from '@jest/globals';
import * as path from 'path';
import * as fs from 'fs/promises';

// Mock AIProviderFactory BEFORE importing
let mockProvider: any;
const actualAIProviderFactoryModule = (await import(
  '../../src/providers/AIProviderFactory.js'
)) as typeof import('../../src/providers/AIProviderFactory.js');
const actualAIProviderFactory = actualAIProviderFactoryModule.AIProviderFactory;
jest.unstable_mockModule('../../src/providers/AIProviderFactory.js', () => {
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

// Mock GitWorktreeManager BEFORE importing
const mockCreateWorktree = jest.fn<any>();
const mockRemoveWorktree = jest.fn<any>();
const mockCleanupAllWorktrees = jest.fn<any>();

jest.unstable_mockModule('../../src/managers/GitWorktreeManager.js', () => ({
  GitWorktreeManager: jest.fn().mockImplementation(() => ({
    createWorktree: mockCreateWorktree,
    removeWorktree: mockRemoveWorktree,
    cleanupAllWorktrees: mockCleanupAllWorktrees,
  })),
}));

// Mock child_process to prevent actual Git commands
const mockExecSync = jest.fn<any>();
jest.unstable_mockModule('child_process', () => ({
  execSync: mockExecSync,
}));

// Import AFTER mocking
const { conflictResolverNode } = await import('../../src/graph/nodes/ConflictResolverNode.js');
const { createInitialState } = await import('../../src/graph/state.js');
const { MockAIProvider, createMockMessage } = await import('../../src/providers/MockAIProvider.js');
const {
  setupTestEnvironment,
  createTaskWithDependencies,
} = await import('../helpers/integration-test-helpers.js');

describe('Conflict Resolution E2E', () => {
  // Store original process.chdir
  const originalChdir = process.chdir;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock provider
    mockProvider = new MockAIProvider();

    // Setup default git worktree mock
    mockCreateWorktree.mockImplementation(async (taskId: string) => ({
      path: `/test/worktrees/${taskId}`,
      branchName: `task/${taskId}`,
    }));

    mockRemoveWorktree.mockResolvedValue(undefined);
    mockCleanupAllWorktrees.mockResolvedValue(undefined);

    // Mock execSync to return empty string (successful Git command)
    mockExecSync.mockReturnValue('');

    // Mock process.chdir to prevent directory changes
    process.chdir = jest.fn() as any;
  });

  afterEach(() => {
    // Restore original process.chdir
    process.chdir = originalChdir;
  });

  test('should handle no conflicts scenario', async () => {
    const env = await setupTestEnvironment('no-conflict-test-');

    try {
      // Create tasks with no conflicts
      const task = createTaskWithDependencies('task-001', 'Normal Task', 'No conflicts here', [], 100);
      task.status = 'reviewed' as any;

      const tasksPath = '.kugutsu/tasks.json';
      await fs.writeFile(
        path.join(env.tempDir, tasksPath),
        JSON.stringify([task], null, 2),
        'utf-8'
      );

      // Create initial state
      const initialState = createInitialState('No conflicts test', {
        maxEngineers: 1,
        maxTurns: 20,
        baseBranch: 'main',
        baseRepoPath: env.tempDir,
        worktreeBasePath: `${env.tempDir}/worktrees`,
        provider: 'mock',
      });

      // Execute ConflictResolver node
      const result = await conflictResolverNode(initialState);

      // Should report no conflicts
      expect(result.logs?.length).toBeGreaterThan(0);
      const log = result.logs![0];
      expect(log.message).toContain('コンフリクトはありません');

      console.log('✅ No conflicts detected');
    } finally {
      await env.cleanup();
    }
  });

  test('should detect and prepare conflict resolution', async () => {
    const env = await setupTestEnvironment('conflict-detect-test-');

    try {
      // Create task with conflict_detected status
      const task = createTaskWithDependencies('task-002', 'Conflicted Task', 'Has merge conflict', [], 100);
      task.status = 'conflict_detected' as any;
      task.branchName = 'task/task-002';
      task.worktreePath = `/test/worktrees/task-002`;

      const tasksPath = '.kugutsu/tasks.json';
      await fs.mkdir(path.join(env.kugutsuDir, 'tasks/task-002'), { recursive: true });
      await fs.writeFile(
        path.join(env.tempDir, tasksPath),
        JSON.stringify([task], null, 2),
        'utf-8'
      );

      // Create conflicts.json
      const conflicts = {
        taskId: 'task-002',
        branchName: 'task/task-002',
        targetBranch: 'main',
        conflictFiles: [
          {
            path: 'src/config.ts',
            content: '<<<<<<< HEAD\n...\n=======\n...\n>>>>>>> task/task-002',
          },
        ],
        detectedAt: new Date().toISOString(),
        resolution: 'pending',
      };

      await fs.writeFile(
        path.join(env.kugutsuDir, 'tasks/task-002/conflicts.json'),
        JSON.stringify(conflicts, null, 2),
        'utf-8'
      );

      // Setup mock AI response for conflict resolution
      mockProvider.setMockResponse(/Merge Conflict Resolution/i, {
        messages: [
          createMockMessage.assistant('コンフリクトを解消しました'),
          createMockMessage.result(true),
        ],
      });

      // Create initial state
      const initialState = createInitialState('Conflict resolution test', {
        maxEngineers: 1,
        maxTurns: 20,
        baseBranch: 'main',
        baseRepoPath: env.tempDir,
        worktreeBasePath: `${env.tempDir}/worktrees`,
        provider: 'mock',
      });

      // Execute ConflictResolver node
      const result = await conflictResolverNode(initialState);

      // Should process conflicts
      expect(result.logs?.length).toBeGreaterThan(0);

      console.log('✅ Conflict detection and resolution initiated');

      // Verify conflicts.json was updated
      const conflictsFile = path.join(env.kugutsuDir, 'tasks/task-002/conflicts.json');
      const conflictsContent = await fs.readFile(conflictsFile, 'utf-8');
      const updatedConflicts = JSON.parse(conflictsContent);

      expect(updatedConflicts.resolution).toBe('resolved');
      console.log('✅ Conflicts.json updated to resolved');
    } finally {
      await env.cleanup();
    }
  });

  test('should skip tasks without branch information', async () => {
    const env = await setupTestEnvironment('no-branch-test-');

    try {
      // Create task with conflict but no branch info
      const task = createTaskWithDependencies('task-003', 'Task without branch', 'Missing branch', [], 100);
      task.status = 'conflict_detected' as any;
      // branchName is undefined

      const tasksPath = '.kugutsu/tasks.json';
      await fs.mkdir(path.join(env.kugutsuDir, 'tasks/task-003'), { recursive: true });
      await fs.writeFile(
        path.join(env.tempDir, tasksPath),
        JSON.stringify([task], null, 2),
        'utf-8'
      );

      // Create conflicts.json
      const conflicts = {
        taskId: 'task-003',
        branchName: undefined,
        targetBranch: 'main',
        conflictFiles: [],
        detectedAt: new Date().toISOString(),
        resolution: 'pending',
      };

      await fs.writeFile(
        path.join(env.kugutsuDir, 'tasks/task-003/conflicts.json'),
        JSON.stringify(conflicts, null, 2),
        'utf-8'
      );

      // Create initial state
      const initialState = createInitialState('Skip task test', {
        maxEngineers: 1,
        maxTurns: 20,
        baseBranch: 'main',
        baseRepoPath: env.tempDir,
        worktreeBasePath: `${env.tempDir}/worktrees`,
        provider: 'mock',
      });

      // Execute ConflictResolver node
      const result = await conflictResolverNode(initialState);

      // Should skip task
      expect(result.logs?.length).toBeGreaterThan(0);

      console.log('✅ Task without branch info skipped');
    } finally {
      await env.cleanup();
    }
  });
});
