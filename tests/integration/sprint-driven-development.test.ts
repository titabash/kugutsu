/**
 * Sprint-Driven Development Integration Test
 *
 * Tests basic sprint-driven workflow integration:
 * - Graph compilation
 * - Node connectivity
 * - Data persistence integration
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

// Mock DataPersistence
const mockEnsureDirectory = jest.fn<any>().mockResolvedValue(undefined);
const mockReadJSONSafe = jest.fn<any>().mockResolvedValue({});
const mockWriteJSON = jest.fn<any>().mockResolvedValue(undefined);
const mockListFiles = jest.fn<any>().mockResolvedValue([]);
const mockRemove = jest.fn<any>().mockResolvedValue(undefined);

jest.unstable_mockModule('../../src/utils/FileSystemManager.js', () => ({
  FileSystemManager: {
    ensureDirectory: mockEnsureDirectory,
    readJSONSafe: mockReadJSONSafe,
    writeJSON: mockWriteJSON,
    listFiles: mockListFiles,
    remove: mockRemove,
  },
}));

// Mock child_process
const mockExecSync = jest.fn<any>();
jest.unstable_mockModule('child_process', () => ({
  execSync: mockExecSync,
}));

// Import AFTER mocking
const { compileUnifiedScrumWorkflowGraph } = await import('../../src/graph/ParallelDevGraph.js');
const { createInitialState } = await import('../../src/graph/state.js');
const { MockAIProvider } = await import('../../src/providers/MockAIProvider.js');

describe('Sprint-Driven Development Integration', () => {
  const originalChdir = process.chdir;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock provider
    mockProvider = new MockAIProvider();

    // Setup git worktree mock
    mockCreateWorktree.mockImplementation(async (taskId: string) => ({
      path: `/test/worktrees/${taskId}`,
      branchName: `task/${taskId}`,
    }));

    mockRemoveWorktree.mockResolvedValue(undefined);
    mockCleanupAllWorktrees.mockResolvedValue(undefined);

    // Mock execSync
    mockExecSync.mockReturnValue('');

    // Mock process.chdir
    process.chdir = jest.fn() as any;

    // Setup FileSystemManager mocks for DataPersistence
    mockReadJSONSafe.mockImplementation((path: string, defaultValue: any) => {
      // Return defaults for all persistence files
      if (path.includes('global-queue.json')) {
        return Promise.resolve({ tasks: [], lastUpdated: new Date().toISOString() });
      }
      if (path.includes('active-sprint.json')) {
        return Promise.resolve(null);
      }
      if (path.includes('sprint-history.json')) {
        return Promise.resolve({ sprints: [], lastUpdated: new Date().toISOString() });
      }
      return Promise.resolve(defaultValue);
    });
  });

  afterEach(() => {
    process.chdir = originalChdir;
  });

  test('should compile sprint-driven graph successfully', () => {
    const graph = compileUnifiedScrumWorkflowGraph();

    expect(graph).toBeDefined();
  });

  test('should have all required nodes in sprint-driven graph', () => {
    const graph = compileUnifiedScrumWorkflowGraph();

    // Verify graph structure
    expect(graph).toBeDefined();

    // The compiled graph should have the sprint-driven nodes
    const nodes = graph.nodes as any;
    expect(nodes).toBeDefined();

    // Check for key sprint-driven nodes
    expect(nodes.check_mode).toBeDefined();
    expect(nodes.sprint_planning).toBeDefined();
    expect(nodes.sprint_review).toBeDefined();
  });

  test('should create initial state with sprint-driven fields', () => {
    const initialState = createInitialState('Test request', {
      maxEngineers: 2,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    // Verify sprint-driven fields exist
    expect(initialState.globalTasks).toBeDefined();
    expect(initialState.globalTasks).toEqual([]);
    expect(initialState.projects).toBeDefined();
    expect(initialState.projects).toBeInstanceOf(Map);
    expect(initialState.sprints).toBeDefined();
    expect(initialState.activeSprint).toBeNull();
    expect(initialState.currentUserRequest).toBeNull();
    expect(initialState.continuationMode).toBe(false);
    expect(initialState.currentProjectId).toBeNull();
  });

  test('should integrate DataPersistence with sprint-driven workflow', async () => {
    // Import DataPersistence
    const { DataPersistence } = await import('../../src/utils/DataPersistence.js');

    const persistence = new DataPersistence('/test/repo');

    // Initialize
    await persistence.initialize();

    // Verify directory creation
    expect(mockEnsureDirectory).toHaveBeenCalledWith('/test/repo/.kugutsu');
    expect(mockEnsureDirectory).toHaveBeenCalledWith('/test/repo/.kugutsu/tasks');
    expect(mockEnsureDirectory).toHaveBeenCalledWith('/test/repo/.kugutsu/sprints');
    expect(mockEnsureDirectory).toHaveBeenCalledWith('/test/repo/.kugutsu/projects');

    // Test loading empty data
    const globalTasks = await persistence.loadGlobalQueue();
    expect(globalTasks).toEqual([]);

    const activeSprint = await persistence.loadActiveSprint();
    expect(activeSprint).toBeNull();

    const sprintHistory = await persistence.loadSprintHistory();
    expect(sprintHistory).toEqual([]);
  });

  test('should handle sprint lifecycle data operations', async () => {
    const { DataPersistence } = await import('../../src/utils/DataPersistence.js');

    const persistence = new DataPersistence('/test/repo');
    await persistence.initialize();

    // Create and save a sprint
    const sprint = {
      id: 'sprint-1',
      name: 'Sprint 1',
      goal: 'Test sprint',
      taskIds: ['task-1'],
      status: 'active' as const,
      deployable: true,
      startedAt: new Date(),
      metadata: {
        estimatedHours: 8,
        blockers: [],
        completedTasksCount: 0,
        failedTasksCount: 0,
      },
    };

    await persistence.saveActiveSprint(sprint);
    expect(mockWriteJSON).toHaveBeenCalledWith(
      '/test/repo/.kugutsu/sprints/active-sprint.json',
      sprint
    );

    // Add to history
    await persistence.addToSprintHistory(sprint);
    expect(mockWriteJSON).toHaveBeenCalled();

    // Clear active sprint
    await persistence.saveActiveSprint(null);
    expect(mockWriteJSON).toHaveBeenCalledWith(
      '/test/repo/.kugutsu/sprints/active-sprint.json',
      null
    );
  });

  test('should handle global task queue operations', async () => {
    const { DataPersistence } = await import('../../src/utils/DataPersistence.js');

    const persistence = new DataPersistence('/test/repo');
    await persistence.initialize();

    // Create and save tasks
    const tasks = [
      {
        id: 'task-1',
        type: 'feature' as const,
        projectId: 'project-1',
        title: 'Task 1',
        description: 'Description',
        priority: 90,
        dynamicPriority: 90,
        dependencies: [],
        status: 'pending' as const,
        requestTimestamp: new Date(),
      },
    ];

    await persistence.saveGlobalQueue(tasks);
    expect(mockWriteJSON).toHaveBeenCalledWith(
      '/test/repo/.kugutsu/tasks/global-queue.json',
      expect.objectContaining({
        tasks,
        lastUpdated: expect.any(String),
      })
    );
  });
});
