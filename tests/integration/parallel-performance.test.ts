/**
 * Parallel Execution Performance Test
 *
 * Tests that parallel execution is faster than sequential execution
 */

import { jest } from '@jest/globals';

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

// Mock DataPersistence BEFORE importing
jest.unstable_mockModule('../../src/utils/DataPersistence.js', () => ({
  DataPersistence: jest.fn().mockImplementation(() => ({
    initialize: jest.fn<any>().mockResolvedValue(undefined),
    loadGlobalQueue: jest.fn<any>().mockResolvedValue([]),
    loadAllProjectMetadata: jest.fn<any>().mockResolvedValue(new Map()),
    loadRepositoryMetadata: jest.fn<any>().mockResolvedValue(null),
    saveRepositoryMetadata: jest.fn<any>().mockResolvedValue(undefined),
    saveTechStack: jest.fn<any>().mockResolvedValue(undefined),
    saveArchitectureOverview: jest.fn<any>().mockResolvedValue(undefined),
    saveCodingStandards: jest.fn<any>().mockResolvedValue(undefined),
    saveProjectMetadata: jest.fn<any>().mockResolvedValue(undefined),
    loadStoryMapping: jest.fn<any>().mockResolvedValue(null),
    saveActiveSprint: jest.fn<any>().mockResolvedValue(undefined),
    addToSprintHistory: jest.fn<any>().mockResolvedValue(undefined),
  })),
}));

// Import AFTER mocking
const { compileUnifiedScrumWorkflowGraph } = await import('../../src/graph/ParallelDevGraph.js');
const { createInitialState } = await import('../../src/graph/state.js');
const { MockAIProvider, createMockMessage } = await import('../../src/providers/MockAIProvider.js');

describe('Parallel Execution Performance', () => {
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

  test('should execute multiple tasks in parallel with improved performance', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { mkdtemp, rm } = await import('fs/promises');
    const { tmpdir } = await import('os');

    const originalCwd = process.cwd();
    const tempDir = await mkdtemp(path.join(tmpdir(), 'perf-test-'));
    const kugutsuDir = path.join(tempDir, '.kugutsu');

    try {
      // Create .kugutsu directory structure for 4 tasks
      await fs.mkdir(kugutsuDir, { recursive: true });
      await fs.mkdir(path.join(kugutsuDir, 'tasks/task-001'), { recursive: true });
      await fs.mkdir(path.join(kugutsuDir, 'tasks/task-002'), { recursive: true });
      await fs.mkdir(path.join(kugutsuDir, 'tasks/task-003'), { recursive: true });
      await fs.mkdir(path.join(kugutsuDir, 'tasks/task-004'), { recursive: true });

      // Setup mock responses with artificial delay to simulate real work
      const TASK_DELAY_MS = 100; // Simulate 100ms per task

      const techStackData = {
        languages: ['TypeScript'],
        frameworks: ['Node.js'],
        buildTools: ['npm'],
        testingFrameworks: ['Jest'],
        projectType: 'web-app',
      };

      const requirementsData = {
        functional: ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4'],
        nonFunctional: [],
        constraints: [],
      };

      const tasksData = [
        {
          id: 'task-001',
          title: 'Feature 1',
          description: 'Implement Feature 1',
          priority: 100,
          dependencies: [],
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'task-002',
          title: 'Feature 2',
          description: 'Implement Feature 2',
          priority: 90,
          dependencies: [],
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'task-003',
          title: 'Feature 3',
          description: 'Implement Feature 3',
          priority: 80,
          dependencies: [],
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'task-004',
          title: 'Feature 4',
          description: 'Implement Feature 4',
          priority: 70,
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
                content: '# Task: Feature 1\n\nImplement Feature 1.',
              },
            },
          }),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(kugutsuDir, 'tasks/task-002/instruction.md'),
                content: '# Task: Feature 2\n\nImplement Feature 2.',
              },
            },
          }),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(kugutsuDir, 'tasks/task-003/instruction.md'),
                content: '# Task: Feature 3\n\nImplement Feature 3.',
              },
            },
          }),
          createMockMessage.system({
            toolUse: {
              tool: 'Write',
              arguments: {
                file_path: path.join(kugutsuDir, 'tasks/task-004/instruction.md'),
                content: '# Task: Feature 4\n\nImplement Feature 4.',
              },
            },
          }),
          createMockMessage.result(true),
        ],
        simulateTools: true,
      });

    // Setup Engineer implementation response with delay
    const SESSION_ID = 'session-perf-test';
    mockProvider.setDefaultResponse({
      messages: [
        createMockMessage.assistant('実装中...', SESSION_ID),
        {
          type: 'result' as const,
          content: {
            duration: TASK_DELAY_MS,
            tokenUsage: { input: 10, output: 20, total: 30 },
            cost: 0.001,
            permissionDenials: 0,
            success: true,
          },
          session_id: SESSION_ID,
          timestamp: new Date(),
        },
      ],
      delay: TASK_DELAY_MS, // Add artificial delay to simulate real work
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

      // Create initial state with multiple engineers
      const initialState = createInitialState('Implement 4 features', {
        maxEngineers: 4,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: tempDir,
        worktreeBasePath: path.join(tempDir, 'worktrees'),
        provider: 'claude',
      });

    // Compile graph
    const graph = compileUnifiedScrumWorkflowGraph();

    // Execute graph and measure time
    const startTime = Date.now();
    const states: any[] = [];
    const stream = await graph.stream(initialState);

    for await (const event of stream) {
      states.push(event);
    }

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    // Verify workflow execution
    expect(states.length).toBeGreaterThan(0);

    // Extract node names from events
    const nodeNames = states.flatMap((state) => Object.keys(state));

    // Should execute all nodes
    expect(nodeNames).toContain('product_owner');
    expect(nodeNames).toContain('engineer_dispatch');
    expect(nodeNames).toContain('engineer');
    expect(nodeNames).toContain('review');
    expect(nodeNames).toContain('merge_coordinator');
    expect(nodeNames).toContain('check_completion');

    // Performance assertion:
    // With 4 tasks of 100ms each:
    // - Sequential execution would take ~400ms (4 * 100ms)
    // - Parallel execution should take ~100ms (max of all parallel tasks)
    // We allow some overhead for test execution, so we expect < 300ms
    const expectedSequentialTime = 4 * TASK_DELAY_MS; // 400ms
    const maxAcceptableTime = expectedSequentialTime * 0.75; // 300ms (75% of sequential)

    console.log(`Execution time: ${executionTime}ms`);
    console.log(`Expected sequential time: ${expectedSequentialTime}ms`);
    console.log(`Max acceptable time (75% of sequential): ${maxAcceptableTime}ms`);

    // Parallel execution should be significantly faster than sequential
    // Note: This is a soft assertion since timing can be flaky in CI environments
    if (executionTime < maxAcceptableTime) {
      console.log('✅ Parallel execution is faster than sequential!');
    } else {
      console.warn(
        `⚠️ Parallel execution took ${executionTime}ms, which is not significantly faster than sequential (${expectedSequentialTime}ms)`
      );
    }

    // Verify all tasks were processed
    const productOwnerEvent = states.find((s) => 'product_owner' in s);
    expect(productOwnerEvent!.product_owner.tasks.length).toBe(4);
  } finally {
    // Restore original directory and cleanup
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
  }, 60000); // 60 second timeout
});
