/**
 * Basic Workflow Integration Test (Jest)
 *
 * Tests the complete workflow from task generation to merge
 */

import { jest } from '@jest/globals';
import type { Task } from '../../src/graph/types.js';

// Mock AIProviderFactory BEFORE importing
let mockProvider: any;
jest.unstable_mockModule('../../src/providers/AIProviderFactory.js', () => ({
  AIProviderFactory: {
    create: jest.fn(() => mockProvider),
    getSupportedProviders: jest.fn(() => ['claude', 'mock']),
    isProviderSupported: jest.fn((provider: string) => ['claude', 'mock'].includes(provider)),
  },
}));

// Mock GitWorktreeManager BEFORE importing
const mockCreateWorktree = jest.fn<(taskId: string) => Promise<any>>();
const mockRemoveWorktree = jest.fn<(taskId: string) => Promise<void>>();
const mockCleanupAllWorktrees = jest.fn<() => Promise<void>>();

jest.unstable_mockModule('../../src/managers/GitWorktreeManager.js', () => ({
  GitWorktreeManager: jest.fn().mockImplementation(() => ({
    createWorktree: mockCreateWorktree,
    removeWorktree: mockRemoveWorktree,
    cleanupAllWorktrees: mockCleanupAllWorktrees,
  })),
}));

// Import AFTER mocking
const { productOwnerNode } = await import('../../src/graph/nodes/ProductOwnerNode.js');
const { engineerDispatchNode } = await import('../../src/graph/nodes/EngineerDispatchNode.js');
const { engineerNode } = await import('../../src/graph/nodes/EngineerNode.js');
const { reviewNode } = await import('../../src/graph/nodes/ReviewNode.js');
const { mergeCoordinatorNode } = await import('../../src/graph/nodes/MergeCoordinatorNode.js');
const { createInitialState } = await import('../../src/graph/state.js');
const { MockAIProvider, createMockMessage } = await import('../../src/providers/MockAIProvider.js');

import type { ParallelDevStateType, ParallelDevStateUpdate } from '../../src/graph/state.js';

/**
 * Helper function to merge state updates correctly (mimics LangGraph reducers)
 */
function mergeState(
  state: ParallelDevStateType,
  update: ParallelDevStateUpdate
): ParallelDevStateType {
  // tasks: Merge by ID (mimics state.ts lines 40-46)
  const tasks = (() => {
    if (!update.tasks) return state.tasks;
    const taskMap = new Map(state.tasks.map((t) => [t.id, t]));
    update.tasks.forEach((t) => taskMap.set(t.id, t));
    return Array.from(taskMap.values());
  })();

  // completedTasks: Append without duplicates (mimics state.ts lines 54-61)
  const completedTasks = (() => {
    if (!update.completedTasks) return state.completedTasks;
    const existingIds = new Set(state.completedTasks.map((t) => t.id));
    const newTasks = update.completedTasks.filter((t) => !existingIds.has(t.id));
    return state.completedTasks.concat(newTasks);
  })();

  // failedTasks: Append without duplicates (mimics state.ts lines 69-76)
  const failedTasks = (() => {
    if (!update.failedTasks) return state.failedTasks;
    const existingIds = new Set(state.failedTasks.map((t) => t.id));
    const newTasks = update.failedTasks.filter((t) => !existingIds.has(t.id));
    return state.failedTasks.concat(newTasks);
  })();

  // reviews: Append (mimics state.ts lines 84-88)
  const reviews = (() => {
    if (!update.reviews) return state.reviews;
    return state.reviews.concat(update.reviews);
  })();

  // mergeQueue: Merge by taskId (mimics state.ts lines 96-102)
  const mergeQueue = (() => {
    if (!update.mergeQueue) return state.mergeQueue;
    const mergeMap = new Map(state.mergeQueue.map((m) => [m.taskId, m]));
    update.mergeQueue.forEach((m) => mergeMap.set(m.taskId, m));
    return Array.from(mergeMap.values());
  })();

  // worktrees: Merge maps (mimics state.ts lines 110-117)
  const worktrees = (() => {
    if (!update.worktrees) return state.worktrees;
    return new Map([...state.worktrees, ...update.worktrees]);
  })();

  // logs: Append and keep last 1000 (mimics state.ts lines 125-131)
  const logs = (() => {
    if (!update.logs) return state.logs;
    const combined = state.logs.concat(update.logs);
    return combined.slice(-1000);
  })();

  // metadata: Shallow merge (mimics state.ts lines 185-191)
  const metadata = (() => {
    if (!update.metadata) return state.metadata;
    return { ...state.metadata, ...update.metadata };
  })();

  return {
    ...state,
    tasks,
    completedTasks,
    failedTasks,
    reviews,
    mergeQueue,
    worktrees,
    logs,
    metadata,
    // config is replaced (not merged)
    config: update.config !== undefined ? update.config : state.config,
    // File paths (replace if provided)
    tasksPath: update.tasksPath !== undefined ? update.tasksPath : state.tasksPath,
    techStackPath: update.techStackPath !== undefined ? update.techStackPath : state.techStackPath,
    requirementsPath: update.requirementsPath !== undefined ? update.requirementsPath : state.requirementsPath,
  };
}

describe('Basic Workflow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mock provider
    mockProvider = new MockAIProvider();

    // Setup GitWorktreeManager mock
    mockCreateWorktree.mockImplementation(async (taskId: string) => ({
      path: `/test/worktrees/${taskId}`,
      branchName: `task/${taskId}`,
    }));
    mockRemoveWorktree.mockResolvedValue(undefined);
    mockCleanupAllWorktrees.mockResolvedValue(undefined);
  });

  test('should complete simple workflow: generate → implement → review → merge', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { mkdtemp, rm } = await import('fs/promises');
    const { tmpdir } = await import('os');

    const originalCwd = process.cwd();
    const tempDir = await mkdtemp(path.join(tmpdir(), 'workflow-test-'));
    const kugutsuDir = path.join(tempDir, '.kugutsu');

    try {
      // Step 1: ProductOwner generates tasks
      const techStackData = {
        languages: ['TypeScript'],
        frameworks: ['Node.js'],
        buildTools: ['npm'],
        testingFrameworks: ['Jest'],
        projectType: 'web-app',
      };

      const requirementsData = {
        functional: ['User authentication', 'Login page'],
        nonFunctional: ['Security: JWT tokens'],
        constraints: ['Use TypeScript'],
      };

      const tasksData = [
        {
          id: 'task-001',
          title: 'Implement JWT authentication',
          description: 'Create JWT token generation and validation',
          priority: 100,
          dependencies: [],
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      // Setup separate responses for each ProductOwner phase with Write tool simulation
      mockProvider.setMockResponse(/tech.*stack/i, {
        messages: [
          createMockMessage.assistant('Analyzing tech stack...'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(kugutsuDir, 'tech-stack.json'),
                content: JSON.stringify(techStackData, null, 2),
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      mockProvider.setMockResponse(/requirements/i, {
        messages: [
          createMockMessage.assistant('Analyzing requirements...'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(kugutsuDir, 'requirements.json'),
                content: JSON.stringify(requirementsData, null, 2),
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      mockProvider.setMockResponse(/task.*generation/i, {
        messages: [
          createMockMessage.assistant('Generating tasks...'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(kugutsuDir, 'tasks.json'),
                content: JSON.stringify(tasksData, null, 2),
              },
            },
          }),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(kugutsuDir, 'tasks/task-001/instruction.md'),
                content: '# Task: Implement JWT authentication\n\n## Requirements\n- Create JWT token generation\n- Implement token validation\n',
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      let state = createInitialState('Implement user authentication', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: tempDir,
        worktreeBasePath: path.join(tempDir, 'worktrees'),
      });

    const poResult = await productOwnerNode(state);
    state = mergeState(state, poResult);

    // Verify tasks were generated
    expect(state.tasks).toBeDefined();
    expect(state.tasks!.length).toBeGreaterThanOrEqual(1);
    const task = state.tasks![0];
    expect(task.status).toBe('pending');

    // Step 2: EngineerDispatch assigns worktrees
    const dispatchResult = await engineerDispatchNode(state);
    state = mergeState(state, dispatchResult);

    // Verify worktree was assigned
    expect(state.tasks![0].worktreePath).toBeDefined();
    expect(state.tasks![0].branchName).toBeDefined();
    expect(mockCreateWorktree).toHaveBeenCalledTimes(1);

    // Step 3: Engineer implements the task
    const SESSION_ID = 'session-workflow-123';
    mockProvider.setDefaultResponse({
      messages: [
        createMockMessage.assistant('タスクを実装しています...', SESSION_ID),
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

      const engineerResult = await engineerNode(state, task.id);
      state = mergeState(state, engineerResult);

      // Verify task was implemented and moved to in_review
      const inReviewTask = state.tasks!.find((t) => t.id === task.id);
      expect(inReviewTask?.status).toBe('in_review');

    // Step 4: Review the completed task
    mockProvider.setDefaultResponse({
      messages: [
        createMockMessage.assistant('コードを確認しています...'),
        createMockMessage.assistant('REVIEW_STATUS: APPROVED\n\n良好なコード品質です。'),
        createMockMessage.result(true),
      ],
    });

    const reviewResult = await reviewNode(state, task.id);
    state = mergeState(state, reviewResult);

    // Verify review was created
    expect(state.reviews).toBeDefined();
    expect(state.reviews!.length).toBe(1);
    expect(state.reviews![0].status).toBe('approved');
    expect(state.reviews![0].taskId).toBe(task.id);

    // Step 5: MergeCoordinator adds to merge queue
    const mergeCoordResult = await mergeCoordinatorNode(state);
    state = mergeState(state, mergeCoordResult);

      // Verify task was added to merge queue
      expect(state.mergeQueue).toBeDefined();
      expect(state.mergeQueue!.length).toBe(1);
      expect(state.mergeQueue![0].taskId).toBe(task.id);
      expect(state.mergeQueue![0].status).toBe('pending');
    } finally {
      // Cleanup: restore original directory before removing tempDir
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('should handle multiple tasks in parallel', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { mkdtemp, rm } = await import('fs/promises');
    const { tmpdir } = await import('os');

    const originalCwd = process.cwd();
    const tempDir = await mkdtemp(path.join(tmpdir(), 'workflow-parallel-test-'));
    const kugutsuDir = path.join(tempDir, '.kugutsu');

    try {
      // Generate multiple tasks
      const techStackData = {
        languages: ['TypeScript'],
        frameworks: ['Node.js'],
        buildTools: ['npm'],
        testingFrameworks: ['Jest'],
        projectType: 'web-app',
      };

      const requirementsData = {
        functional: ['Feature A', 'Feature B'],
        nonFunctional: [],
        constraints: [],
      };

      const tasksData = [
        {
          id: 'task-001',
          title: 'Implement Feature A',
          description: 'Feature A implementation',
          priority: 100,
          dependencies: [],
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'task-002',
          title: 'Implement Feature B',
          description: 'Feature B implementation',
          priority: 90,
          dependencies: [],
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      // Setup separate responses for each ProductOwner phase with Write tool simulation
      mockProvider.setMockResponse(/tech.*stack/i, {
        messages: [
          createMockMessage.assistant('Analyzing tech stack...'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(kugutsuDir, 'tech-stack.json'),
                content: JSON.stringify(techStackData, null, 2),
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      mockProvider.setMockResponse(/requirements/i, {
        messages: [
          createMockMessage.assistant('Analyzing requirements...'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(kugutsuDir, 'requirements.json'),
                content: JSON.stringify(requirementsData, null, 2),
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      mockProvider.setMockResponse(/task.*generation/i, {
        messages: [
          createMockMessage.assistant('Generating tasks...'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(kugutsuDir, 'tasks.json'),
                content: JSON.stringify(tasksData, null, 2),
              },
            },
          }),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(kugutsuDir, 'tasks/task-001/instruction.md'),
                content: '# Task: Implement Feature A\n\n## Requirements\n- Implement Feature A\n',
              },
            },
          }),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(kugutsuDir, 'tasks/task-002/instruction.md'),
                content: '# Task: Implement Feature B\n\n## Requirements\n- Implement Feature B\n',
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      let state = createInitialState('Implement features A and B', {
        maxEngineers: 2,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: tempDir,
        worktreeBasePath: path.join(tempDir, 'worktrees'),
      });

    // Generate tasks
    const poResult = await productOwnerNode(state);
    state = mergeState(state, poResult);

    expect(state.tasks!.length).toBe(2);

    // Dispatch both tasks
    const dispatchResult = await engineerDispatchNode(state);
    state = mergeState(state, dispatchResult);

    // Verify both tasks got worktrees
    expect(mockCreateWorktree).toHaveBeenCalledTimes(2);
    expect(state.tasks![0].worktreePath).toBeDefined();
    expect(state.tasks![1].worktreePath).toBeDefined();

    // Implement both tasks
    const SESSION_ID_1 = 'session-task-1';
    const SESSION_ID_2 = 'session-task-2';

    mockProvider.setDefaultResponse({
      messages: [
        createMockMessage.assistant('実装中...', SESSION_ID_1),
        {
          type: 'result' as const,
          content: {
            duration: 100,
            tokenUsage: { input: 10, output: 20, total: 30 },
            cost: 0.001,
            permissionDenials: 0,
            success: true,
          },
          session_id: SESSION_ID_1,
          timestamp: new Date(),
        },
      ],
    });

    const eng1Result = await engineerNode(state, state.tasks![0].id);
    state = mergeState(state, eng1Result);

    mockProvider.setDefaultResponse({
      messages: [
        createMockMessage.assistant('実装中...', SESSION_ID_2),
        {
          type: 'result' as const,
          content: {
            duration: 100,
            tokenUsage: { input: 10, output: 20, total: 30 },
            cost: 0.001,
            permissionDenials: 0,
            success: true,
          },
          session_id: SESSION_ID_2,
          timestamp: new Date(),
        },
      ],
    });

      const eng2Result = await engineerNode(state, state.tasks![1].id);
      state = mergeState(state, eng2Result);

      // Verify both tasks are in review
      const inReview = state.tasks!.filter((t) => t.status === 'in_review');
      expect(inReview.length).toBe(2);
    } finally {
      // Cleanup: restore original directory before removing tempDir
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('should handle task dependencies correctly', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { mkdtemp, rm } = await import('fs/promises');
    const { tmpdir } = await import('os');

    const originalCwd = process.cwd();
    const tempDir = await mkdtemp(path.join(tmpdir(), 'workflow-dep-test-'));
    const kugutsuDir = path.join(tempDir, '.kugutsu');

    try {
      // Generate tasks with dependencies
      const techStackData = {
        languages: ['TypeScript'],
        frameworks: ['Node.js'],
        buildTools: ['npm'],
        testingFrameworks: ['Jest'],
        projectType: 'web-app',
      };

      const requirementsData = {
        functional: ['Database setup', 'User model'],
        nonFunctional: [],
        constraints: [],
      };

      const tasksData = [
        {
          id: 'task-001',
          title: 'Setup database',
          description: 'Initialize database',
          priority: 100,
          dependencies: [],
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'task-002',
          title: 'Create user model',
          description: 'User model depends on database',
          priority: 90,
          dependencies: ['task-001'],
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      // Setup separate responses for each ProductOwner phase with Write tool simulation
      mockProvider.setMockResponse(/tech.*stack/i, {
        messages: [
          createMockMessage.assistant('Analyzing tech stack...'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(kugutsuDir, 'tech-stack.json'),
                content: JSON.stringify(techStackData, null, 2),
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      mockProvider.setMockResponse(/requirements/i, {
        messages: [
          createMockMessage.assistant('Analyzing requirements...'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(kugutsuDir, 'requirements.json'),
                content: JSON.stringify(requirementsData, null, 2),
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      mockProvider.setMockResponse(/task.*generation/i, {
        messages: [
          createMockMessage.assistant('Generating tasks...'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(kugutsuDir, 'tasks.json'),
                content: JSON.stringify(tasksData, null, 2),
              },
            },
          }),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(kugutsuDir, 'tasks/task-001/instruction.md'),
                content: '# Task: Setup database\n\n## Requirements\n- Initialize database\n',
              },
            },
          }),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(kugutsuDir, 'tasks/task-002/instruction.md'),
                content: '# Task: Create user model\n\n## Requirements\n- User model depends on database\n',
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      let state = createInitialState('Setup database and user model', {
        maxEngineers: 2,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: tempDir,
        worktreeBasePath: path.join(tempDir, 'worktrees'),
      });

    // Generate tasks
    const poResult = await productOwnerNode(state);
    state = mergeState(state, poResult);

    expect(state.tasks!.length).toBe(2);

    // First task should have no dependencies
    expect(state.tasks![0].dependencies).toEqual([]);
    // Second task should depend on first
    expect(state.tasks![1].dependencies.length).toBeGreaterThan(0);

    // Dispatch should only assign the first task (no dependencies)
    const dispatchResult = await engineerDispatchNode(state);
    state = mergeState(state, dispatchResult);

    // Only first task should get worktree (second has unmet dependencies)
    const tasksWithWorktree = state.tasks!.filter((t) => t.worktreePath !== undefined);
    expect(tasksWithWorktree.length).toBe(1);
    expect(tasksWithWorktree[0].id).toBe(state.tasks![0].id);

    // Complete the first task
    const SESSION_ID = 'session-dep-test';
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

      const eng1Result = await engineerNode(state, state.tasks![0].id);
      state = mergeState(state, eng1Result);

      // Review and complete the first task
      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant('コードを確認しています...'),
          createMockMessage.assistant('REVIEW_STATUS: APPROVED\n\n良好なコード品質です。'),
          createMockMessage.result(true),
        ],
      });

      const review1Result = await reviewNode(state, state.tasks![0].id);
      state = mergeState(state, review1Result);

      // Now dispatch again - second task should be available (dependency met)
      const dispatch2Result = await engineerDispatchNode(state);
      state = mergeState(state, dispatch2Result);

      // Second task should now have worktree
      expect(state.tasks![1].worktreePath).toBeDefined();
    } finally {
      // Cleanup: restore original directory before removing tempDir
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
