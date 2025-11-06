/**
 * Scrum Development Workflow Integration Test
 *
 * Tests scrum development workflow integration:
 * - Story mapping creation and review
 * - Design document generation and review
 * - Task breakdown with dependency analysis
 * - Full workflow from user request to task list
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

// Mock DataPersistence
const mockEnsureDirectory = jest.fn<any>().mockResolvedValue(undefined);
const mockReadJSONSafe = jest.fn<any>().mockResolvedValue({});
const mockWriteJSON = jest.fn<any>().mockResolvedValue(undefined);
const mockWriteFile = jest.fn<any>().mockResolvedValue(undefined);
const mockListFiles = jest.fn<any>().mockResolvedValue([]);
const mockRemove = jest.fn<any>().mockResolvedValue(undefined);

jest.unstable_mockModule('../../src/utils/FileSystemManager.js', () => ({
  FileSystemManager: {
    ensureDirectory: mockEnsureDirectory,
    readJSONSafe: mockReadJSONSafe,
    writeJSON: mockWriteJSON,
    writeFile: mockWriteFile,
    listFiles: mockListFiles,
    remove: mockRemove,
  },
}));

// Mock child_process
const mockExecSync = jest.fn<any>();
jest.unstable_mockModule('child_process', () => ({
  execSync: mockExecSync,
}));

// Mock DirectorAI
jest.unstable_mockModule('../../src/managers/DirectorAI.js', () => ({
  DirectorAI: jest.fn().mockImplementation(() => ({
    createStoryMapping: jest.fn<any>().mockResolvedValue({
      storyMapping: {
        persona: {
          name: 'Test User',
          role: 'End User',
          goal: 'Test the system',
        },
        epics: [
          {
            id: 'epic-1',
            title: 'User Authentication',
            description: 'Auth system',
            priority: 90,
            stories: [
              {
                id: 'story-1',
                title: 'User Login',
                description: 'Login feature',
                priority: 90,
                acceptanceCriteria: ['Users can login'],
                tasks: [],
              },
            ],
          },
        ],
      },
      markdown: '# Story Mapping\n...',
    }),
  })),
}));

// Import AFTER mocking
const { compileScrumDevGraph } = await import('../../src/graph/ParallelDevGraph.js');
const { createInitialState } = await import('../../src/graph/state.js');
const { MockAIProvider, createMockMessage } = await import('../../src/providers/MockAIProvider.js');

describe('Scrum Development Workflow Integration', () => {
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
      // Story mapping review history
      if (path.includes('story-mapping/review-history.json')) {
        return Promise.resolve({ reviews: [] });
      }
      // Design review history
      if (path.includes('design/review-history.json')) {
        return Promise.resolve({ reviews: [] });
      }
      // Story mapping
      if (path.includes('story-mapping/story-map.json')) {
        return Promise.resolve({
          persona: {
            name: 'Test User',
            role: 'End User',
            goal: 'Test goal',
          },
          epics: [],
        });
      }
      // Database schema
      if (path.includes('design/database/schema.json')) {
        return Promise.resolve({
          tables: [
            {
              name: 'users',
              columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
            },
          ],
        });
      }
      // API spec
      if (path.includes('design/interfaces/api-spec.json')) {
        return Promise.resolve({
          openapi: '3.0.0',
          paths: {},
        });
      }
      // UI/UX screens
      if (path.includes('design/uiux/screens.json')) {
        return Promise.resolve({
          screens: [],
        });
      }
      return Promise.resolve(defaultValue);
    });
  });

  afterEach(() => {
    process.chdir = originalChdir;
  });

  test('should compile scrum development graph successfully', () => {
    const graph = compileScrumDevGraph();

    expect(graph).toBeDefined();
    expect(typeof graph.invoke).toBe('function');
    expect(typeof graph.stream).toBe('function');
  });

  test('should have all required nodes in scrum workflow graph', () => {
    const graph = compileScrumDevGraph();

    // Verify graph structure
    expect(graph).toBeDefined();

    // The compiled graph should have the scrum workflow nodes
    const nodes = graph.nodes as any;
    expect(nodes).toBeDefined();

    // Check for key scrum workflow nodes
    expect(nodes.director_ai).toBeDefined();
    expect(nodes.review_story_mapping).toBeDefined();
    expect(nodes.tech_lead_design).toBeDefined();
    expect(nodes.review_design).toBeDefined();
    expect(nodes.task_breakdown).toBeDefined();
  });

  test('should create initial state with scrum workflow fields', () => {
    const initialState = createInitialState('Implement authentication', {
      maxEngineers: 2,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    // Verify scrum workflow fields exist
    expect(initialState.storyMapping).toBeNull();
    expect(initialState.storyMappingApproved).toBeNull();
    expect(initialState.reviewFeedback).toBeNull();
    expect(initialState.designDocs).toBeNull();
    expect(initialState.dependencyGraph).toBeNull();

    // Verify standard fields
    expect(initialState.tasks).toBeDefined();
    expect(initialState.tasks).toEqual([]);
    expect(initialState.logs).toBeDefined();
    expect(initialState.metadata).toBeDefined();
  });

  test('should integrate DataPersistence with scrum workflow', async () => {
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

    // Test story mapping operations
    const storyMapping = {
      persona: {
        name: 'Test User',
        role: 'End User',
        goal: 'Test goal',
      },
      epics: [],
    };

    await persistence.saveStoryMapping('project-1', storyMapping);
    expect(mockWriteJSON).toHaveBeenCalled();

    const loadedStoryMapping = await persistence.loadStoryMapping('project-1');
    expect(loadedStoryMapping).toBeDefined();
  });

  test('should handle design document data operations', async () => {
    const { DataPersistence } = await import('../../src/utils/DataPersistence.js');

    const persistence = new DataPersistence('/test/repo');
    await persistence.initialize();

    // Test design docs operations
    await persistence.saveDesignDocsMarkdown('project-1', '# Design');
    expect(mockWriteFile).toHaveBeenCalled();

    // Test database schema
    const schema = {
      tables: [
        {
          name: 'users',
          columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
        },
      ],
    };
    await persistence.saveDatabaseSchema('project-1', schema);
    expect(mockWriteJSON).toHaveBeenCalled();

    // Test API spec
    const apiSpec = {
      openapi: '3.0.0',
      paths: {},
    };
    await persistence.saveAPISpec('project-1', apiSpec);
    expect(mockWriteJSON).toHaveBeenCalled();
  });

  test('should handle task breakdown data operations', async () => {
    const { DataPersistence } = await import('../../src/utils/DataPersistence.js');

    const persistence = new DataPersistence('/test/repo');
    await persistence.initialize();

    // Test task list
    const taskList = [
      {
        id: 'task-1',
        title: 'Task 1',
        description: 'Description',
        estimatedHours: 4,
        priority: 90,
        dependencies: [],
      },
    ];
    await persistence.saveTaskList('project-1', taskList);
    expect(mockWriteJSON).toHaveBeenCalled();

    // Test dependency graph
    const dependencyGraph = {
      nodes: [{ id: 'task-1', title: 'Task 1', status: 'pending' }],
      edges: [],
      criticalPath: ['task-1'],
      parallelGroups: [['task-1']],
    };
    await persistence.saveDependencyGraph('project-1', dependencyGraph);
    expect(mockWriteJSON).toHaveBeenCalled();

    // Test Kanban state
    const kanbanState = {
      columns: [
        { id: 'pending', name: 'Pending', taskIds: ['task-1'] },
        { id: 'ready', name: 'Ready', taskIds: [] },
      ],
      tasks: taskList,
      metadata: {
        totalTasks: 1,
        completedTasks: 0,
      },
    };
    await persistence.saveKanbanState('project-1', kanbanState);
    expect(mockWriteJSON).toHaveBeenCalled();
  });
});
