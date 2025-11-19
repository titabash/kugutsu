/**
 * DataPersistence Unit Tests (Jest)
 */

import { jest } from '@jest/globals';
import path from 'path';

// Mock FileSystemManager BEFORE importing
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

// Import after mocking
const { DataPersistence } = await import('../../src/utils/DataPersistence.js');

describe('DataPersistence', () => {
  const baseRepoPath = '/test/repo';
  let persistence: any;

  beforeEach(() => {
    jest.clearAllMocks();
    persistence = new DataPersistence(baseRepoPath);
  });

  describe('Initialization', () => {
    test('should initialize directory structure', async () => {
      await persistence.initialize();

      const expectedDirs = [
        path.join(baseRepoPath, '.kugutsu'),
        path.join(baseRepoPath, '.kugutsu', 'repository'),
        path.join(baseRepoPath, '.kugutsu', 'repository', 'architecture'),
        path.join(baseRepoPath, '.kugutsu', 'repository', 'standards'),
        path.join(baseRepoPath, '.kugutsu', 'repository', 'database'),
        path.join(baseRepoPath, '.kugutsu', 'repository', 'api'),
        path.join(baseRepoPath, '.kugutsu', 'repository', 'deployment'),
        path.join(baseRepoPath, '.kugutsu', 'tasks'),
        path.join(baseRepoPath, '.kugutsu', 'sprints'),
        path.join(baseRepoPath, '.kugutsu', 'projects'),
      ];

      expect(mockEnsureDirectory).toHaveBeenCalledTimes(10);
      expectedDirs.forEach((dir) => {
        expect(mockEnsureDirectory).toHaveBeenCalledWith(dir);
      });
    });
  });

  describe('Global Queue Management', () => {
    test('should load global queue with tasks', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          type: 'feature',
          projectId: 'project-1',
          title: 'Task 1',
          description: 'Description',
          priority: 90,
          dynamicPriority: 90,
          dependencies: [],
          status: 'pending',
          requestTimestamp: '2025-01-01T00:00:00.000Z',
        },
      ];

      mockReadJSONSafe.mockResolvedValue({
        tasks: mockTasks,
        lastUpdated: '2025-01-01T00:00:00.000Z',
      });

      const result = await persistence.loadGlobalQueue();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('task-1');
      expect(result[0].requestTimestamp).toBeInstanceOf(Date);
      expect(mockReadJSONSafe).toHaveBeenCalledWith(
        path.join(baseRepoPath, '.kugutsu', 'tasks', 'global-queue.json'),
        expect.any(Object)
      );
    });

    test('should load empty global queue when file does not exist', async () => {
      mockReadJSONSafe.mockResolvedValue({
        tasks: [],
        lastUpdated: new Date().toISOString(),
      });

      const result = await persistence.loadGlobalQueue();

      expect(result).toEqual([]);
    });

    test('should save global queue', async () => {
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
        path.join(baseRepoPath, '.kugutsu', 'tasks', 'global-queue.json'),
        expect.objectContaining({
          tasks,
          lastUpdated: expect.any(String),
        })
      );
    });
  });

  describe('Active Sprint Management', () => {
    test('should load active sprint', async () => {
      const mockSprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        goal: 'Goal',
        taskIds: ['task-1'],
        status: 'active',
        deployable: true,
        startedAt: '2025-01-01T00:00:00.000Z',
        completedAt: null,
        metadata: {
          estimatedHours: 10,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };

      mockReadJSONSafe.mockResolvedValue(mockSprint);

      const result = await persistence.loadActiveSprint();

      expect(result).toBeDefined();
      expect(result!.id).toBe('sprint-1');
      expect(result!.startedAt).toBeInstanceOf(Date);
      expect(result!.completedAt).toBeUndefined();
    });

    test('should return null when no active sprint exists', async () => {
      mockReadJSONSafe.mockResolvedValue(null);

      const result = await persistence.loadActiveSprint();

      expect(result).toBeNull();
    });

    test('should save active sprint', async () => {
      const sprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        goal: 'Goal',
        taskIds: ['task-1'],
        status: 'active' as const,
        deployable: true,
        startedAt: new Date(),
        metadata: {
          estimatedHours: 10,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };

      await persistence.saveActiveSprint(sprint);

      expect(mockWriteJSON).toHaveBeenCalledWith(
        path.join(baseRepoPath, '.kugutsu', 'sprints', 'active-sprint.json'),
        sprint
      );
    });

    test('should clear active sprint by saving null', async () => {
      await persistence.saveActiveSprint(null);

      expect(mockWriteJSON).toHaveBeenCalledWith(
        path.join(baseRepoPath, '.kugutsu', 'sprints', 'active-sprint.json'),
        null
      );
    });
  });

  describe('Sprint History Management', () => {
    test('should load sprint history', async () => {
      const mockSprints = [
        {
          id: 'sprint-1',
          name: 'Sprint 1',
          goal: 'Goal',
          taskIds: ['task-1'],
          status: 'completed',
          deployable: true,
          startedAt: '2025-01-01T00:00:00.000Z',
          completedAt: '2025-01-02T00:00:00.000Z',
          metadata: {
            estimatedHours: 10,
            blockers: [],
            completedTasksCount: 1,
            failedTasksCount: 0,
          },
        },
      ];

      mockReadJSONSafe.mockResolvedValue({
        sprints: mockSprints,
        lastUpdated: '2025-01-02T00:00:00.000Z',
      });

      const result = await persistence.loadSprintHistory();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sprint-1');
      expect(result[0].startedAt).toBeInstanceOf(Date);
      expect(result[0].completedAt).toBeInstanceOf(Date);
    });

    test('should load empty sprint history', async () => {
      mockReadJSONSafe.mockResolvedValue({
        sprints: [],
        lastUpdated: new Date().toISOString(),
      });

      const result = await persistence.loadSprintHistory();

      expect(result).toEqual([]);
    });

    test('should save sprint history', async () => {
      const sprints = [
        {
          id: 'sprint-1',
          name: 'Sprint 1',
          goal: 'Goal',
          taskIds: ['task-1'],
          status: 'completed' as const,
          deployable: true,
          startedAt: new Date(),
          completedAt: new Date(),
          metadata: {
            estimatedHours: 10,
            blockers: [],
            completedTasksCount: 1,
            failedTasksCount: 0,
          },
        },
      ];

      await persistence.saveSprintHistory(sprints);

      expect(mockWriteJSON).toHaveBeenCalledWith(
        path.join(baseRepoPath, '.kugutsu', 'sprints', 'sprint-history.json'),
        expect.objectContaining({
          sprints,
          lastUpdated: expect.any(String),
        })
      );
    });

    test('should add sprint to history', async () => {
      const existingSprints = [
        {
          id: 'sprint-1',
          name: 'Sprint 1',
          goal: 'Goal 1',
          taskIds: ['task-1'],
          status: 'completed' as const,
          deployable: true,
          startedAt: new Date('2025-01-01'),
          completedAt: new Date('2025-01-02'),
          metadata: {
            estimatedHours: 10,
            blockers: [],
            completedTasksCount: 1,
            failedTasksCount: 0,
          },
        },
      ];

      mockReadJSONSafe.mockResolvedValue({
        sprints: existingSprints,
        lastUpdated: '2025-01-02T00:00:00.000Z',
      });

      const newSprint = {
        id: 'sprint-2',
        name: 'Sprint 2',
        goal: 'Goal 2',
        taskIds: ['task-2'],
        status: 'completed' as const,
        deployable: true,
        startedAt: new Date('2025-01-03'),
        completedAt: new Date('2025-01-04'),
        metadata: {
          estimatedHours: 12,
          blockers: [],
          completedTasksCount: 1,
          failedTasksCount: 0,
        },
      };

      await persistence.addToSprintHistory(newSprint);

      expect(mockWriteJSON).toHaveBeenCalledWith(
        path.join(baseRepoPath, '.kugutsu', 'sprints', 'sprint-history.json'),
        expect.objectContaining({
          sprints: expect.arrayContaining([
            expect.objectContaining({ id: 'sprint-1' }),
            expect.objectContaining({ id: 'sprint-2' }),
          ]),
        })
      );
    });
  });

  describe('Project Metadata Management', () => {
    test('should load project metadata', async () => {
      const mockMetadata = {
        projectId: 'project-1',
        userRequest: 'Request',
        requestTimestamp: '2025-01-01T00:00:00.000Z',
        totalTasks: 5,
        completedTasks: 2,
        needsStoryMapping: false,
      };

      mockReadJSONSafe.mockResolvedValue(mockMetadata);

      const result = await persistence.loadProjectMetadata('project-1');

      expect(result).toBeDefined();
      expect(result!.projectId).toBe('project-1');
      expect(result!.requestTimestamp).toBeInstanceOf(Date);
    });

    test('should return null when project metadata does not exist', async () => {
      mockReadJSONSafe.mockResolvedValue(null);

      const result = await persistence.loadProjectMetadata('nonexistent');

      expect(result).toBeNull();
    });

    test('should save project metadata', async () => {
      const metadata = {
        projectId: 'project-1',
        userRequest: 'Request',
        requestTimestamp: new Date(),
        totalTasks: 5,
        completedTasks: 0,
        needsStoryMapping: false,
      };

      await persistence.saveProjectMetadata('project-1', metadata);

      expect(mockEnsureDirectory).toHaveBeenCalledWith(
        path.join(baseRepoPath, '.kugutsu', 'projects', 'project-1')
      );
      expect(mockWriteJSON).toHaveBeenCalledWith(
        path.join(baseRepoPath, '.kugutsu', 'projects', 'project-1', 'project.json'),
        metadata
      );
    });

    test('should load all project metadata', async () => {
      mockListFiles.mockResolvedValue(['project-1', 'project-2']);

      const mockMetadata1 = {
        projectId: 'project-1',
        userRequest: 'Request 1',
        requestTimestamp: '2025-01-01T00:00:00.000Z',
        totalTasks: 5,
        completedTasks: 2,
        needsStoryMapping: false,
      };

      const mockMetadata2 = {
        projectId: 'project-2',
        userRequest: 'Request 2',
        requestTimestamp: '2025-01-02T00:00:00.000Z',
        totalTasks: 3,
        completedTasks: 1,
        needsStoryMapping: true,
      };

      mockReadJSONSafe
        .mockResolvedValueOnce(mockMetadata1)
        .mockResolvedValueOnce(mockMetadata2);

      const result = await persistence.loadAllProjectMetadata();

      expect(result.size).toBe(2);
      expect(result.get('project-1')?.projectId).toBe('project-1');
      expect(result.get('project-2')?.projectId).toBe('project-2');
    });
  });

  describe('Data Cleanup', () => {
    test('should clear all data', async () => {
      await persistence.clearAll();

      expect(mockRemove).toHaveBeenCalledWith(
        path.join(baseRepoPath, '.kugutsu', 'tasks')
      );
      expect(mockRemove).toHaveBeenCalledWith(
        path.join(baseRepoPath, '.kugutsu', 'sprints')
      );
      expect(mockEnsureDirectory).toHaveBeenCalled();
    });

    test('should clear project data', async () => {
      await persistence.clearProject('project-1');

      expect(mockRemove).toHaveBeenCalledWith(
        path.join(baseRepoPath, '.kugutsu', 'projects', 'project-1')
      );
    });
  });

  describe('Story Mapping Management (Phase 6)', () => {
    test('should save and load story mapping', async () => {
      const storyMapping = {
        persona: {
          name: 'Test User',
          role: 'End User',
          goal: 'Test goal',
        },
        epics: [
          {
            id: 'epic-1',
            title: 'Epic 1',
            description: 'Description',
            priority: 90,
            stories: [],
          },
        ],
      };

      await persistence.saveStoryMapping('project-1', storyMapping);

      expect(mockEnsureDirectory).toHaveBeenCalled();
      expect(mockWriteJSON).toHaveBeenCalledWith(
        path.join(baseRepoPath, '.kugutsu', 'projects', 'project-1', 'story-mapping', 'story-map.json'),
        storyMapping
      );

      // Load story mapping
      mockReadJSONSafe.mockResolvedValue(storyMapping);
      const result = await persistence.loadStoryMapping('project-1');

      expect(result).toEqual(storyMapping);
      expect(mockReadJSONSafe).toHaveBeenCalledWith(
        path.join(baseRepoPath, '.kugutsu', 'projects', 'project-1', 'story-mapping', 'story-map.json'),
        null
      );
    });

    test('should save story mapping markdown', async () => {
      const markdown = '# Story Mapping\nContent here';

      await persistence.saveStoryMappingMarkdown('project-1', markdown);

      expect(mockEnsureDirectory).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join(baseRepoPath, '.kugutsu', 'projects', 'project-1', 'story-mapping', 'story-map.md'),
        markdown
      );
    });

    test('should save and load story mapping review history', async () => {
      const reviewHistory = {
        reviews: [
          {
            iteration: 1,
            timestamp: '2025-01-01T00:00:00.000Z',
            reviewer: 'ProductOwnerAI',
            approved: true,
            issues: [],
            suggestions: [],
          },
        ],
      };

      await persistence.saveStoryMappingReviewHistory('project-1', reviewHistory);

      expect(mockWriteJSON).toHaveBeenCalledWith(
        path.join(
          baseRepoPath,
          '.kugutsu',
          'projects',
          'project-1',
          'story-mapping',
          'review-history.json'
        ),
        reviewHistory
      );

      // Load review history
      mockReadJSONSafe.mockResolvedValue(reviewHistory);
      const result = await persistence.loadStoryMappingReviewHistory('project-1');

      expect(result).toEqual(reviewHistory);
    });
  });

  describe('Design Documents Management (Phase 6)', () => {
    test('should save design docs markdown', async () => {
      const markdown = '# Design Docs\nContent';

      await persistence.saveDesignDocsMarkdown('project-1', markdown);

      expect(mockEnsureDirectory).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join(baseRepoPath, '.kugutsu', 'projects', 'project-1', 'design', 'design-docs.md'),
        markdown
      );
    });

    test('should save and load database schema', async () => {
      const schema = {
        tables: [
          {
            name: 'users',
            columns: [
              {
                name: 'id',
                type: 'uuid',
                primaryKey: true,
              },
            ],
          },
        ],
      };

      await persistence.saveDatabaseSchema('project-1', schema);

      expect(mockWriteJSON).toHaveBeenCalledWith(
        path.join(baseRepoPath, '.kugutsu', 'projects', 'project-1', 'design', 'database', 'schema.json'),
        schema
      );

      // Load schema
      mockReadJSONSafe.mockResolvedValue(schema);
      const result = await persistence.loadDatabaseSchema('project-1');

      expect(result).toEqual(schema);
    });

    test('should save database ER diagram', async () => {
      const markdown = '# ER Diagram\nContent';

      await persistence.saveDatabaseERDiagram('project-1', markdown);

      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join(baseRepoPath, '.kugutsu', 'projects', 'project-1', 'design', 'database', 'er-diagram.md'),
        markdown
      );
    });

    test('should save and load API spec', async () => {
      const apiSpec = {
        openapi: '3.0.0',
        paths: {
          '/api/users': {
            get: {
              summary: 'Get users',
            },
          },
        },
      };

      await persistence.saveAPISpec('project-1', apiSpec);

      expect(mockWriteJSON).toHaveBeenCalledWith(
        path.join(baseRepoPath, '.kugutsu', 'projects', 'project-1', 'design', 'interfaces', 'api-spec.json'),
        apiSpec
      );

      // Load API spec
      mockReadJSONSafe.mockResolvedValue(apiSpec);
      const result = await persistence.loadAPISpec('project-1');

      expect(result).toEqual(apiSpec);
    });

    test('should save and load UI/UX screens', async () => {
      const screens = {
        screens: [
          {
            id: 'screen-1',
            name: 'Login',
            description: 'Login screen',
          },
        ],
      };

      await persistence.saveUIUXScreens('project-1', screens);

      expect(mockWriteJSON).toHaveBeenCalledWith(
        path.join(baseRepoPath, '.kugutsu', 'projects', 'project-1', 'design', 'uiux', 'screens.json'),
        screens
      );

      // Load screens
      mockReadJSONSafe.mockResolvedValue(screens);
      const result = await persistence.loadUIUXScreens('project-1');

      expect(result).toEqual(screens);
    });

    test('should save design review history', async () => {
      const reviewHistory = {
        reviews: [
          {
            iteration: 1,
            timestamp: '2025-01-01T00:00:00.000Z',
            reviewers: ['DirectorAI', 'ProductOwnerAI', 'TechLeadAI'],
            approved: true,
            issues: [],
          },
        ],
      };

      await persistence.saveDesignReviewHistory('project-1', reviewHistory);

      expect(mockWriteJSON).toHaveBeenCalledWith(
        path.join(
          baseRepoPath,
          '.kugutsu',
          'projects',
          'project-1',
          'design',
          'review-history.json'
        ),
        reviewHistory
      );

      // Load review history
      mockReadJSONSafe.mockResolvedValue(reviewHistory);
      const result = await persistence.loadDesignReviewHistory('project-1');

      expect(result).toEqual(reviewHistory);
    });
  });

  describe('Task Management (Phase 6)', () => {
    test('should save and load task list', async () => {
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

      expect(mockWriteJSON).toHaveBeenCalledWith(
        path.join(baseRepoPath, '.kugutsu', 'projects', 'project-1', 'tasks', 'task-list.json'),
        taskList
      );

      // Load task list
      mockReadJSONSafe.mockResolvedValue(taskList);
      const result = await persistence.loadTaskList('project-1');

      expect(result).toEqual(taskList);
    });

    test('should save and load dependency graph', async () => {
      const dependencyGraph = {
        nodes: [
          {
            id: 'task-1',
            title: 'Task 1',
            status: 'pending',
          },
        ],
        edges: [
          {
            from: 'task-2',
            to: 'task-1',
            type: 'depends_on',
          },
        ],
        criticalPath: ['task-1', 'task-2'],
        parallelGroups: [['task-1'], ['task-2']],
      };

      await persistence.saveDependencyGraph('project-1', dependencyGraph);

      expect(mockWriteJSON).toHaveBeenCalledWith(
        path.join(
          baseRepoPath,
          '.kugutsu',
          'projects',
          'project-1',
          'tasks',
          'dependencies.json'
        ),
        dependencyGraph
      );

      // Load dependency graph
      mockReadJSONSafe.mockResolvedValue(dependencyGraph);
      const result = await persistence.loadDependencyGraph('project-1');

      expect(result).toEqual(dependencyGraph);
    });

    test('should save and load Kanban state', async () => {
      const kanbanState = {
        columns: [
          {
            id: 'pending',
            name: 'Pending',
            taskIds: ['task-1'],
          },
          {
            id: 'ready',
            name: 'Ready',
            taskIds: [],
          },
        ],
        tasks: [
          {
            id: 'task-1',
            title: 'Task 1',
            status: 'pending',
          },
        ],
        metadata: {
          totalTasks: 1,
          completedTasks: 0,
        },
      };

      await persistence.saveKanbanState('project-1', kanbanState);

      expect(mockWriteJSON).toHaveBeenCalledWith(
        path.join(baseRepoPath, '.kugutsu', 'projects', 'project-1', 'tasks', 'kanban-state.json'),
        kanbanState
      );

      // Load Kanban state
      mockReadJSONSafe.mockResolvedValue(kanbanState);
      const result = await persistence.loadKanbanState('project-1');

      expect(result).toEqual(kanbanState);
    });
  });
});
