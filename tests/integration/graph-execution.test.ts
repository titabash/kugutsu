/**
 * Graph Execution Integration Test
 *
 * Tests the complete LangGraph workflow execution
 */

import { jest } from '@jest/globals';

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

// Mock DataPersistence BEFORE importing
let mockPersistence: any;
jest.unstable_mockModule('../../src/utils/DataPersistence.js', () => ({
  DataPersistence: jest.fn().mockImplementation(() => mockPersistence),
}));

// Import AFTER mocking
const { compileUnifiedScrumWorkflowGraph } = await import('../../src/graph/ParallelDevGraph.js');
const { createInitialState } = await import('../../src/graph/state.js');
const { MockAIProvider, createMockMessage } = await import('../../src/providers/MockAIProvider.js');

describe('Graph Execution Integration', () => {
  // Store original process.chdir
  const originalChdir = process.chdir;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock provider
    mockProvider = new MockAIProvider();

    // Setup mock persistence
    mockPersistence = {
      initialize: jest.fn<any>().mockResolvedValue(undefined),
      loadGlobalQueue: jest.fn<any>().mockResolvedValue([]),
      loadAllProjectMetadata: jest.fn<any>().mockResolvedValue(new Map()),
      saveProjectMetadata: jest.fn<any>().mockResolvedValue(undefined),
      loadRepositoryMetadata: jest.fn<any>().mockResolvedValue(null),
    };

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

  test('should execute complete workflow from start to end', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { mkdtemp, rm } = await import('fs/promises');
    const { tmpdir } = await import('os');

    const originalCwd = process.cwd();
    const tempDir = await mkdtemp(path.join(tmpdir(), 'graph-exec-test-'));
    const kugutsuDir = path.join(tempDir, '.kugutsu');

    try {
      // Create .kugutsu directory structure
      await fs.mkdir(kugutsuDir, { recursive: true });
      await fs.mkdir(path.join(kugutsuDir, 'tasks/task-001'), { recursive: true });

      // Setup mock responses with Write tool simulation
      const techStackData = {
        languages: ['TypeScript'],
        frameworks: ['Node.js'],
        buildTools: ['npm'],
        testingFrameworks: ['Jest'],
        projectType: 'web-app',
      };

      const requirementsData = {
        functional: ['Add user authentication'],
        nonFunctional: [],
        constraints: [],
      };

      const tasksData = [
        {
          id: 'task-001',
          title: 'Implement authentication',
          description: 'Create auth system',
          priority: 100,
          dependencies: [],
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      // Setup ProductOwner phases with Write tool simulation
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
                content: '# Task: Implement authentication\n\nCreate auth system with tests.',
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

    // Setup Engineer implementation response
    const SESSION_ID = 'session-graph-test';
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

      // Setup Review response with Write tool simulation
      mockProvider.setMockResponse(/Review/i, {
        messages: [
          createMockMessage.assistant('REVIEW_STATUS: APPROVED\n\nコードは良好です。'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(kugutsuDir, 'tasks/task-001/review.json'),
                content: JSON.stringify({
                  taskId: 'task-001',
                  status: 'approved',
                  reviewedBy: 'TechLeadAI',
                  reviewedAt: new Date().toISOString(),
                  comments: [],
                  summary: 'レビュー結果: approved',
                  suggestions: [],
                }, null, 2),
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      // Create initial state
      const initialState = createInitialState('Implement user authentication', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: tempDir,
        worktreeBasePath: path.join(tempDir, 'worktrees'),
        provider: 'claude',
      });

      // Compile graph
      const graph = compileUnifiedScrumWorkflowGraph();

      // Execute graph and collect all states
      const states: any[] = [];
      const stream = await graph.stream(initialState);

    for await (const event of stream) {
      states.push(event);
      console.log('Event:', Object.keys(event));
    }

    // Verify workflow execution
    expect(states.length).toBeGreaterThan(0);

    // Extract node names from events
    const nodeNames = states.flatMap((state) => Object.keys(state));

    // Should execute: product_owner → engineer_dispatch → engineer → review → merge_coordinator → check_completion
    expect(nodeNames).toContain('product_owner');
    expect(nodeNames).toContain('engineer_dispatch');
    expect(nodeNames).toContain('engineer');
    expect(nodeNames).toContain('review');
    expect(nodeNames).toContain('merge_coordinator');
    expect(nodeNames).toContain('check_completion');

    // Verify tasks were generated by product_owner
    const productOwnerEvent = states.find((s) => 'product_owner' in s);
    expect(productOwnerEvent).toBeDefined();
    expect(productOwnerEvent!.product_owner.tasks).toBeDefined();
    expect(productOwnerEvent!.product_owner.tasks.length).toBeGreaterThan(0);

    // Verify merge coordinator added tasks to merge queue
    const mergeCoordinatorEvent = states.find((s) => 'merge_coordinator' in s);
    expect(mergeCoordinatorEvent).toBeDefined();
    expect(mergeCoordinatorEvent!.merge_coordinator.mergeQueue).toBeDefined();

    // Verify completion check was executed
      const checkCompletionEvent = states.find((s) => 'check_completion' in s);
      expect(checkCompletionEvent).toBeDefined();
      expect(checkCompletionEvent!.check_completion.logs).toBeDefined();
    } finally {
      // Cleanup: restore original directory before removing tempDir
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 30000); // 30 second timeout

  test('should handle multiple tasks in graph execution', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { mkdtemp, rm } = await import('fs/promises');
    const { tmpdir } = await import('os');

    const originalCwd = process.cwd();
    const tempDir = await mkdtemp(path.join(tmpdir(), 'graph-multi-test-'));
    const kugutsuDir = path.join(tempDir, '.kugutsu');

    try {
      // Create .kugutsu directory structure for 2 tasks
      await fs.mkdir(kugutsuDir, { recursive: true });
      await fs.mkdir(path.join(kugutsuDir, 'tasks/task-001'), { recursive: true });
      await fs.mkdir(path.join(kugutsuDir, 'tasks/task-002'), { recursive: true });

      // Setup mock responses for 2 tasks
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
          title: 'Feature A',
          description: 'Implement Feature A',
          priority: 100,
          dependencies: [],
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'task-002',
          title: 'Feature B',
          description: 'Implement Feature B',
          priority: 90,
          dependencies: [],
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      // Setup ProductOwner phases with Write tool simulation
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
                content: '# Task: Feature A\n\nImplement Feature A.',
              },
            },
          }),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(kugutsuDir, 'tasks/task-002/instruction.md'),
                content: '# Task: Feature B\n\nImplement Feature B.',
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      // Setup Engineer implementation response
      const SESSION_ID = 'session-multi-task';
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

      // Setup Review response with Write tool simulation
      mockProvider.setMockResponse(/Review/i, {
        messages: [
          createMockMessage.assistant('REVIEW_STATUS: APPROVED\n\nコードは良好です。'),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(kugutsuDir, 'tasks/task-001/review.json'),
                content: JSON.stringify({
                  taskId: 'task-001',
                  status: 'approved',
                  reviewedBy: 'TechLeadAI',
                  reviewedAt: new Date().toISOString(),
                  comments: [],
                  summary: 'レビュー結果: approved',
                  suggestions: [],
                }, null, 2),
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      // Create initial state with maxEngineers = 2
      const initialState = createInitialState('Implement features A and B', {
        maxEngineers: 2,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: tempDir,
        worktreeBasePath: path.join(tempDir, 'worktrees'),
        provider: 'claude',
      });

      // Compile graph
      const graph = compileUnifiedScrumWorkflowGraph();

      // Execute graph
      const states: any[] = [];
      const stream = await graph.stream(initialState);

      for await (const event of stream) {
        states.push(event);
      }

      // Verify both tasks were processed
      expect(states.length).toBeGreaterThan(0);

      // Extract node names
      const nodeNames = states.flatMap((state) => Object.keys(state));

      // Should have executed engineer and review at least once
      expect(nodeNames.filter((n) => n === 'engineer').length).toBeGreaterThan(0);
      expect(nodeNames.filter((n) => n === 'review').length).toBeGreaterThan(0);
    } finally {
      // Cleanup: restore original directory before removing tempDir
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 30000); // 30 second timeout

  test('should handle task failure in graph execution', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { mkdtemp, rm } = await import('fs/promises');
    const { tmpdir } = await import('os');

    const originalCwd = process.cwd();
    const tempDir = await mkdtemp(path.join(tmpdir(), 'graph-fail-test-'));
    const kugutsuDir = path.join(tempDir, '.kugutsu');

    try {
      // Create .kugutsu directory structure
      await fs.mkdir(kugutsuDir, { recursive: true });
      await fs.mkdir(path.join(kugutsuDir, 'tasks/task-001'), { recursive: true });

      // Setup mock responses
      const techStackData = {
        languages: ['TypeScript'],
        frameworks: ['Node.js'],
        buildTools: ['npm'],
        testingFrameworks: ['Jest'],
        projectType: 'web-app',
      };

      const requirementsData = {
        functional: ['Failing task'],
        nonFunctional: [],
        constraints: [],
      };

      const tasksData = [
        {
          id: 'task-001',
          title: 'Failing task',
          description: 'This task will fail',
          priority: 100,
          dependencies: [],
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      // Setup ProductOwner phases with Write tool simulation
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
                content: '# Task: Failing task\n\nThis will fail.',
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

      // Setup Engineer to fail
      mockProvider.setDefaultResponse({
        messages: [],
        shouldThrowError: true,
        errorMessage: 'Implementation failed',
      });

      // Create initial state
      const initialState = createInitialState('Implement failing task', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: tempDir,
        worktreeBasePath: path.join(tempDir, 'worktrees'),
        provider: 'claude',
      });

      // Compile graph
      const graph = compileUnifiedScrumWorkflowGraph();

      // Execute graph
      const states: any[] = [];
      const stream = await graph.stream(initialState);

      for await (const event of stream) {
        states.push(event);
      }

      // Verify workflow handled failure
      expect(states.length).toBeGreaterThan(0);

      const nodeNames = states.flatMap((state) => Object.keys(state));

      // Should have executed up to engineer and check_completion
      expect(nodeNames).toContain('product_owner');
      expect(nodeNames).toContain('engineer_dispatch');
      expect(nodeNames).toContain('engineer');
      expect(nodeNames).toContain('check_completion');
    } finally {
      // Cleanup
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 30000); // 30 second timeout
});
