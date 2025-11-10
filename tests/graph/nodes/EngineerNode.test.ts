/**
 * EngineerNode Unit Tests (Jest)
 */

import { jest } from '@jest/globals';
import type { Task } from '../../../src/graph/types.js';

// Mock AIProviderFactory BEFORE importing
let mockProvider: any;
jest.unstable_mockModule('../../../src/providers/AIProviderFactory.js', () => ({
  AIProviderFactory: {
    create: jest.fn(() => mockProvider),
    getSupportedProviders: jest.fn(() => ['claude', 'mock']),
    isProviderSupported: jest.fn((provider: string) => ['claude', 'mock'].includes(provider)),
  },
}));

// Import after mocking
const { engineerNode } = await import('../../../src/graph/nodes/EngineerNode.js');
const { createInitialState } = await import('../../../src/graph/state.js');
const { MockAIProvider, createMockMessage } = await import(
  '../../../src/providers/MockAIProvider.js'
);
const { AIProviderFactory } = await import('../../../src/providers/AIProviderFactory.js');

// Test helper to create state with activeSprint
function createTestState(userRequest: string, config: any) {
  const state = createInitialState(userRequest, config);
  state.activeSprint = {
    id: 'sprint-1',
    name: 'Sprint 1',
    goal: 'Test sprint',
    taskIds: [],
    status: 'active' as const,
    deployable: true,
    metadata: {
      estimatedHours: 0,
      blockers: [],
      completedTasksCount: 0,
      failedTasksCount: 0,
    },
  };
  state.nodeRetryCounters = {};
  return state;
}

describe('EngineerNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mock provider
    mockProvider = new MockAIProvider();
    (AIProviderFactory.create as any).mockReturnValue(mockProvider);
  });

  test('should implement task successfully', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { mkdtemp, rm } = await import('fs/promises');
    const { tmpdir } = await import('os');

    const tempDir = await mkdtemp(path.join(tmpdir(), 'engineer-test-'));
    const kugutsuDir = path.join(tempDir, '.kugutsu');
    const worktreePath = path.join(tempDir, 'worktrees/task-001');

    try {
      // Create tasks.json
      const tasksData = [
        {
          id: 'task-001',
          title: 'Implement feature',
          description: 'Add new feature',
          priority: 100,
          dependencies: [],
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          worktreePath,
          branchName: 'task/task-001',
        },
      ];

      await fs.mkdir(path.join(kugutsuDir, 'sprints/sprint-1/tasks/task-001'), { recursive: true });
      await fs.writeFile(
        path.join(kugutsuDir, 'tasks.json'),
        JSON.stringify(tasksData, null, 2),
        'utf-8'
      );

      // Create instruction.md
      const instructionContent = `# Task: task-001 - Implement feature

## Purpose
Add new feature to the system.

## Requirements
- Implement the feature
- Add tests
- Create documentation
`;

      await fs.writeFile(
        path.join(kugutsuDir, 'sprints/sprint-1/tasks/task-001/instruction.md'),
        instructionContent,
        'utf-8'
      );

      // Setup mock provider
      const SESSION_ID = 'session-123';
      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant('タスクを実装しています...', SESSION_ID),
          createMockMessage.assistant('テストを作成しました', SESSION_ID),
          createMockMessage.assistant('実装が完了しました', SESSION_ID),
          {
            type: 'result' as const,
            content: {
              duration: 100,
              tokenUsage: { input: 10, output: 20, total: 30 },
              cost: 0.001,
              permissionDenials: 0,
              success: true,
            },
            session_id: SESSION_ID,
            timestamp: new Date(),
          },
        ],
      });

      // Create initial state
      const initialState = createTestState('Test request', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: tempDir,
        worktreeBasePath: path.join(tempDir, 'worktrees'),
      });

      initialState.tasksPath = '.kugutsu/tasks.json';

      // Execute node
      const result = await engineerNode(initialState, 'task-001');

      // Verify logs
      expect(result.logs).toBeDefined();
      expect(result.logs!.length).toBeGreaterThan(0);

      // Verify metadata
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.tasksCompleted).toBe(1);

      // Verify tasks.json was updated
      const updatedTasksContent = await fs.readFile(
        path.join(kugutsuDir, 'tasks.json'),
        'utf-8'
      );
      const updatedTasks = JSON.parse(updatedTasksContent);
      expect(updatedTasks[0].status).toBe('implemented');
      expect(updatedTasks[0].sessionId).toBe(SESSION_ID);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('should handle task with dependencies', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { mkdtemp, rm } = await import('fs/promises');
    const { tmpdir } = await import('os');

    const tempDir = await mkdtemp(path.join(tmpdir(), 'engineer-test-'));
    const kugutsuDir = path.join(tempDir, '.kugutsu');
    const worktreePath = path.join(tempDir, 'worktrees/task-002');

    try {
      // Create tasks.json
      const tasksData = [
        {
          id: 'task-002',
          title: 'Implement dependent feature',
          description: 'Feature that depends on task-001',
          priority: 80,
          dependencies: ['task-001'], // Has dependency
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          worktreePath,
          branchName: 'task/task-002',
        },
      ];

      await fs.mkdir(path.join(kugutsuDir, 'sprints/sprint-1/tasks/task-002'), { recursive: true });
      await fs.writeFile(
        path.join(kugutsuDir, 'tasks.json'),
        JSON.stringify(tasksData, null, 2),
        'utf-8'
      );

      // Create instruction.md
      const instructionContent = `# Task: task-002 - Implement dependent feature

## Purpose
Feature that depends on task-001.

## Dependencies
This task depends on task-001 completion.
`;

      await fs.writeFile(
        path.join(kugutsuDir, 'sprints/sprint-1/tasks/task-002/instruction.md'),
        instructionContent,
        'utf-8'
      );

      // Setup mock provider
      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant('依存タスクを確認しています...'),
          createMockMessage.assistant('実装が完了しました'),
          createMockMessage.result(true),
        ],
      });

      // Create initial state
      const initialState = createTestState('Test request', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: tempDir,
        worktreeBasePath: path.join(tempDir, 'worktrees'),
      });

      initialState.tasksPath = '.kugutsu/tasks.json';

      // Execute node
      const result = await engineerNode(initialState, 'task-002');

      // Verify that the prompt included dependency information
      expect(mockProvider.getLastPrompt()).toBeDefined();
      expect(mockProvider.getLastPrompt()).toContain('task-001');
      expect(mockProvider.getLastPrompt()).toContain('依存');

      // Verify tasks.json was updated
      const updatedTasksContent = await fs.readFile(
        path.join(kugutsuDir, 'tasks.json'),
        'utf-8'
      );
      const updatedTasks = JSON.parse(updatedTasksContent);
      expect(updatedTasks[0].status).toBe('implemented');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('should handle errors gracefully', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { mkdtemp, rm } = await import('fs/promises');
    const { tmpdir } = await import('os');

    const tempDir = await mkdtemp(path.join(tmpdir(), 'engineer-test-'));
    const kugutsuDir = path.join(tempDir, '.kugutsu');
    const worktreePath = path.join(tempDir, 'worktrees/task-003');

    try {
      // Create tasks.json
      const tasksData = [
        {
          id: 'task-003',
          title: 'Failing task',
          description: 'This will fail',
          priority: 100,
          dependencies: [],
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          worktreePath,
          branchName: 'task/task-003',
        },
      ];

      await fs.mkdir(path.join(kugutsuDir, 'sprints/sprint-1/tasks/task-003'), { recursive: true });
      await fs.writeFile(
        path.join(kugutsuDir, 'tasks.json'),
        JSON.stringify(tasksData, null, 2),
        'utf-8'
      );

      // Create instruction.md
      const instructionContent = `# Task: task-003 - Failing task

## Purpose
This task will fail for testing purposes.
`;

      await fs.writeFile(
        path.join(kugutsuDir, 'sprints/sprint-1/tasks/task-003/instruction.md'),
        instructionContent,
        'utf-8'
      );

      // Setup mock provider with error
      mockProvider.setDefaultResponse({
        messages: [],
        shouldThrowError: true,
        errorMessage: 'Implementation error',
      });

      // Create initial state
      const initialState = createTestState('Test request', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: tempDir,
        worktreeBasePath: path.join(tempDir, 'worktrees'),
      });

      initialState.tasksPath = '.kugutsu/tasks.json';

      // Execute node
      const result = await engineerNode(initialState, 'task-003');

      // Verify error logs
      expect(result.logs).toBeDefined();
      const errorLog = result.logs!.find((log) => log.level === 'error');
      expect(errorLog).toBeDefined();

      // Verify metadata
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.tasksFailed).toBe(1);
      expect(result.metadata!.hasErrors).toBe(true);

      // Verify tasks.json was updated to 'failed'
      const updatedTasksContent = await fs.readFile(
        path.join(kugutsuDir, 'tasks.json'),
        'utf-8'
      );
      const updatedTasks = JSON.parse(updatedTasksContent);
      expect(updatedTasks[0].status).toBe('failed');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('should return error when task not found', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { mkdtemp, rm } = await import('fs/promises');
    const { tmpdir } = await import('os');

    const tempDir = await mkdtemp(path.join(tmpdir(), 'engineer-test-'));
    const kugutsuDir = path.join(tempDir, '.kugutsu');

    try {
      // Create empty tasks.json
      await fs.mkdir(kugutsuDir, { recursive: true });
      await fs.writeFile(
        path.join(kugutsuDir, 'tasks.json'),
        JSON.stringify([], null, 2),
        'utf-8'
      );

      // Create initial state
      const initialState = createTestState('Test request', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: tempDir,
        worktreeBasePath: path.join(tempDir, 'worktrees'),
      });

      initialState.tasksPath = '.kugutsu/tasks.json';

      // Execute node with non-existent task ID
      const result = await engineerNode(initialState, 'nonexistent-task');

      // Verify error log
      expect(result.logs).toBeDefined();
      expect(result.logs!.length).toBeGreaterThan(0);
      expect(result.logs![0].message).toContain('見つかりません');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('should return error when worktree not set', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { mkdtemp, rm } = await import('fs/promises');
    const { tmpdir } = await import('os');

    const tempDir = await mkdtemp(path.join(tmpdir(), 'engineer-test-'));
    const kugutsuDir = path.join(tempDir, '.kugutsu');

    try {
      // Create tasks.json with task without worktreePath
      const tasksData = [
        {
          id: 'task-004',
          title: 'Task without worktree',
          description: 'Missing worktree path',
          priority: 100,
          dependencies: [],
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          // worktreePath is missing
        },
      ];

      await fs.mkdir(kugutsuDir, { recursive: true });
      await fs.writeFile(
        path.join(kugutsuDir, 'tasks.json'),
        JSON.stringify(tasksData, null, 2),
        'utf-8'
      );

      // Create initial state
      const initialState = createTestState('Test request', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: tempDir,
        worktreeBasePath: path.join(tempDir, 'worktrees'),
      });

      initialState.tasksPath = '.kugutsu/tasks.json';

      // Execute node
      const result = await engineerNode(initialState, 'task-004');

      // Verify error log
      expect(result.logs).toBeDefined();
      expect(result.logs!.length).toBeGreaterThan(0);
      expect(result.logs![0].message).toContain('worktree');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('should preserve session ID for conflict resolution', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { mkdtemp, rm } = await import('fs/promises');
    const { tmpdir } = await import('os');

    const tempDir = await mkdtemp(path.join(tmpdir(), 'engineer-test-'));
    const kugutsuDir = path.join(tempDir, '.kugutsu');
    const worktreePath = path.join(tempDir, 'worktrees/task-005');

    try {
      // Create tasks.json
      const tasksData = [
        {
          id: 'task-005',
          title: 'Task with session',
          description: 'Should preserve session ID',
          priority: 100,
          dependencies: [],
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          worktreePath,
          branchName: 'task/task-005',
        },
      ];

      await fs.mkdir(path.join(kugutsuDir, 'sprints/sprint-1/tasks/task-005'), { recursive: true });
      await fs.writeFile(
        path.join(kugutsuDir, 'tasks.json'),
        JSON.stringify(tasksData, null, 2),
        'utf-8'
      );

      // Create instruction.md
      const instructionContent = `# Task: task-005 - Task with session

## Purpose
Should preserve session ID for conflict resolution.
`;

      await fs.writeFile(
        path.join(kugutsuDir, 'sprints/sprint-1/tasks/task-005/instruction.md'),
        instructionContent,
        'utf-8'
      );

      // Setup mock provider
      const SESSION_ID = 'original-session-456';
      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant('実装中...', SESSION_ID),
          {
            type: 'result' as const,
            content: {
              duration: 100,
              tokenUsage: { input: 10, output: 20, total: 30 },
              cost: 0.001,
              permissionDenials: 0,
              success: true,
            },
            session_id: SESSION_ID,
            timestamp: new Date(),
          },
        ],
      });

      // Create initial state
      const initialState = createTestState('Test request', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: tempDir,
        worktreeBasePath: path.join(tempDir, 'worktrees'),
      });

      initialState.tasksPath = '.kugutsu/tasks.json';

      // Execute node
      const result = await engineerNode(initialState, 'task-005');

      // Verify logs
      expect(result.logs).toBeDefined();

      // Verify tasks.json was updated with new session ID
      const updatedTasksContent = await fs.readFile(
        path.join(kugutsuDir, 'tasks.json'),
        'utf-8'
      );
      const updatedTasks = JSON.parse(updatedTasksContent);
      expect(updatedTasks[0].status).toBe('implemented');
      expect(updatedTasks[0].sessionId).toBeDefined();
      expect(updatedTasks[0].sessionId).toBe(SESSION_ID); // New session ID from this execution
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('File-based artifact management', () => {
    test('should read instruction.md and implement task', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { mkdtemp, rm } = await import('fs/promises');
      const { tmpdir } = await import('os');

      const tempDir = await mkdtemp(path.join(tmpdir(), 'engineer-test-'));
      const kugutsuDir = path.join(tempDir, '.kugutsu');
      const worktreesDir = path.join(tempDir, 'worktrees');
      const worktreePath = path.join(worktreesDir, 'task-001');

      try {
        // Create tasks.json
        const tasksData = [
          {
            id: 'task-001',
            title: 'Implement user authentication',
            description: 'JWT-based authentication',
            priority: 100,
            dependencies: [],
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            worktreePath,
            branchName: 'task/task-001',
          },
        ];

        await fs.mkdir(path.join(kugutsuDir, 'sprints/sprint-1/tasks/task-001'), { recursive: true });
        await fs.writeFile(
          path.join(kugutsuDir, 'tasks.json'),
          JSON.stringify(tasksData, null, 2),
          'utf-8'
        );

        // Create instruction.md
        const instructionContent = `# Task: task-001 - Implement user authentication

## Purpose
Implement JWT-based authentication feature.

## Requirements
- Login/logout functionality
- Token refresh functionality
- Secure token storage

## Technical Constraints
- TypeScript 5.0+
- JWT library: jsonwebtoken
- Existing API endpoints: /api/auth/*

## Implementation Steps
1. Install jsonwebtoken package
2. Create AuthService class
3. Implement login method
4. Implement logout method
5. Add tests
`;

        await fs.writeFile(
          path.join(kugutsuDir, 'sprints/sprint-1/tasks/task-001/instruction.md'),
          instructionContent,
          'utf-8'
        );

        // Setup mock provider
        const SESSION_ID = 'session-engineer-001';
        mockProvider.setDefaultResponse({
          messages: [
            createMockMessage.assistant('instruction.md を読み込みました', SESSION_ID),
            createMockMessage.assistant('実装を開始します', SESSION_ID),
            createMockMessage.assistant('テストを作成しました', SESSION_ID),
            createMockMessage.assistant('実装が完了しました', SESSION_ID),
            {
              type: 'result' as const,
              content: {
                duration: 100,
                tokenUsage: { input: 10, output: 20, total: 30 },
                cost: 0.001,
                permissionDenials: 0,
                success: true,
              },
              session_id: SESSION_ID,
              timestamp: new Date(),
            },
          ],
        });

        // Create initial state
        const initialState = createTestState('Implement authentication', {
          maxEngineers: 1,
          maxTurns: 30,
          baseBranch: 'main',
          baseRepoPath: tempDir,
          worktreeBasePath: worktreesDir,
        });

        // Set tasksPath in state
        initialState.tasksPath = '.kugutsu/tasks.json';

        // Execute node
        const result = await engineerNode(initialState, 'task-001');

        // Verify prompt includes instruction.md content
        const lastPrompt = mockProvider.getLastPrompt();
        expect(lastPrompt).toContain('JWT-based authentication');
        expect(lastPrompt).toContain('Login/logout functionality');

        // Verify tasks.json was updated
        const updatedTasksContent = await fs.readFile(
          path.join(kugutsuDir, 'tasks.json'),
          'utf-8'
        );
        const updatedTasks = JSON.parse(updatedTasksContent);
        expect(updatedTasks).toHaveLength(1);
        expect(updatedTasks[0].status).toBe('implemented');
        expect(updatedTasks[0].sessionId).toBe(SESSION_ID);

        // Verify result
        expect(result.logs).toBeDefined();
        const infoLog = result.logs!.find((log) => log.level === 'info');
        expect(infoLog).toBeDefined();
        expect(infoLog!.message).toContain('実装が完了');
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    test('should handle missing instruction.md gracefully', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { mkdtemp, rm } = await import('fs/promises');
      const { tmpdir } = await import('os');

      const tempDir = await mkdtemp(path.join(tmpdir(), 'engineer-test-'));
      const kugutsuDir = path.join(tempDir, '.kugutsu');
      const worktreesDir = path.join(tempDir, 'worktrees');
      const worktreePath = path.join(worktreesDir, 'task-002');

      try {
        // Create tasks.json without instruction.md
        const tasksData = [
          {
            id: 'task-002',
            title: 'Task without instruction',
            description: 'Missing instruction file',
            priority: 100,
            dependencies: [],
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            worktreePath,
            branchName: 'task/task-002',
          },
        ];

        await fs.mkdir(kugutsuDir, { recursive: true });
        await fs.writeFile(
          path.join(kugutsuDir, 'tasks.json'),
          JSON.stringify(tasksData, null, 2),
          'utf-8'
        );

        // Create initial state
        const initialState = createTestState('Test request', {
          maxEngineers: 1,
          maxTurns: 30,
          baseBranch: 'main',
          baseRepoPath: tempDir,
          worktreeBasePath: worktreesDir,
        });

        initialState.tasksPath = '.kugutsu/tasks.json';

        // Execute node
        const result = await engineerNode(initialState, 'task-002');

        // Should have error log about missing instruction.md
        expect(result.logs).toBeDefined();
        const errorLog = result.logs!.find((log) => log.level === 'error');
        expect(errorLog).toBeDefined();
        expect(errorLog!.message).toContain('instruction.md');
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
