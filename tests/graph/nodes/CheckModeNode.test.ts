/**
 * CheckModeNode Unit Tests (Jest)
 */

import { jest } from '@jest/globals';
import { randomUUID } from 'crypto';

// Mock AIProviderFactory BEFORE importing
let mockProvider: any;
jest.unstable_mockModule('../../../src/providers/AIProviderFactory.js', () => ({
  AIProviderFactory: {
    create: jest.fn(() => mockProvider),
    getSupportedProviders: jest.fn(() => ['claude', 'mock']),
    isProviderSupported: jest.fn((provider: string) => ['claude', 'mock'].includes(provider)),
  },
}));

// Mock DataPersistence
let mockPersistence: any;
jest.unstable_mockModule('../../../src/utils/DataPersistence.js', () => ({
  DataPersistence: jest.fn().mockImplementation(() => mockPersistence),
}));

// Import after mocking
const { checkModeNode, checkModeRouter } = await import('../../../src/graph/nodes/CheckModeNode.js');
const { createInitialState } = await import('../../../src/graph/state.js');
const { MockAIProvider, createMockMessage } = await import(
  '../../../src/providers/MockAIProvider.js'
);
const { AIProviderFactory } = await import('../../../src/providers/AIProviderFactory.js');

describe('CheckModeNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mock provider
    mockProvider = new MockAIProvider();
    (AIProviderFactory.create as any).mockReturnValue(mockProvider);

    // Create fresh mock persistence
    mockPersistence = {
      initialize: jest.fn<any>().mockResolvedValue(undefined),
      loadGlobalQueue: jest.fn<any>().mockResolvedValue([]),
      loadAllProjectMetadata: jest.fn<any>().mockResolvedValue(new Map()),
      saveProjectMetadata: jest.fn<any>().mockResolvedValue(undefined),
      loadRepositoryMetadata: jest.fn<any>().mockResolvedValue(null),
    };
  });

  describe('New Mode Detection', () => {
    test('should detect new mode for first request', async () => {
      // Setup mock: no existing projects
      mockPersistence.loadGlobalQueue.mockResolvedValue([]);
      mockPersistence.loadAllProjectMetadata.mockResolvedValue(new Map());

      // Mock AI response: new mode
      const aiResponse = {
        isContinuation: false,
        reasoning: 'This is a new feature request with no relation to existing work',
      };

      // Create proper JSON code block response
      const jsonResponse = '```json\n' + JSON.stringify(aiResponse, null, 2) + '\n```';

      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant(jsonResponse),
          createMockMessage.result(true),
        ],
      });

      // Create initial state
      const initialState = createInitialState('Implement new authentication system', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      // Execute node
      const result = await checkModeNode(initialState);

      // Verify new mode detection
      expect(result.continuationMode).toBe(false);
      expect(result.currentProjectId).toBeDefined();
      expect(result.currentUserRequest).toBe('Implement new authentication system');

      // Verify new project was created
      expect(mockPersistence.saveProjectMetadata).toHaveBeenCalled();
      expect(result.projects).toBeDefined();
    });

    test('should create new project metadata', async () => {
      mockPersistence.loadGlobalQueue.mockResolvedValue([]);
      mockPersistence.loadAllProjectMetadata.mockResolvedValue(new Map());

      const aiResponse = {
        isContinuation: false,
        reasoning: 'New project',
      };

      // Create proper JSON code block response
      const jsonResponse = '```json\n' + JSON.stringify(aiResponse, null, 2) + '\n```';

      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant(jsonResponse),
          createMockMessage.result(true),
        ],
      });

      const initialState = createInitialState('Add new feature', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const result = await checkModeNode(initialState);

      // Verify project metadata
      expect(result.projects).toBeDefined();
      expect(result.projects!.size).toBe(1);

      const projectId = result.currentProjectId!;
      const project = result.projects!.get(projectId);
      expect(project).toBeDefined();
      expect(project!.userRequest).toBe('Add new feature');
      expect(project!.requestTimestamp).toBeInstanceOf(Date);
    });
  });

  describe('Continuation Mode Detection', () => {
    test('should detect continuation mode for related request', async () => {
      // Setup mock: existing project with incomplete tasks
      const existingProjectId = randomUUID();
      const existingProject = {
        projectId: existingProjectId,
        userRequest: 'Implement authentication',
        requestTimestamp: new Date(Date.now() - 3600000), // 1 hour ago
        totalTasks: 5,
        completedTasks: 2,
        needsStoryMapping: false,
      };

      const existingTasks = [
        {
          id: 'task-1',
          projectId: existingProjectId,
          title: 'Backend auth',
          description: 'Implement backend',
          priority: 90,
          dynamicPriority: 90,
          dependencies: [],
          status: 'completed',
          sprint: null,
          requestTimestamp: new Date(),
        },
        {
          id: 'task-2',
          projectId: existingProjectId,
          title: 'Frontend auth',
          description: 'Implement frontend',
          priority: 85,
          dynamicPriority: 85,
          dependencies: [],
          status: 'pending',
          sprint: null,
          requestTimestamp: new Date(),
        },
      ];

      mockPersistence.loadGlobalQueue.mockResolvedValue(existingTasks);
      const projectsMap = new Map([[existingProjectId, existingProject]]);
      mockPersistence.loadAllProjectMetadata.mockResolvedValue(projectsMap);

      // Mock AI response: continuation mode
      const aiResponse = {
        isContinuation: true,
        reasoning: 'User is asking to continue work on existing authentication project',
      };

      // Create proper JSON code block response
      const jsonResponse = '```json\n' + JSON.stringify(aiResponse, null, 2) + '\n```';

      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant(jsonResponse),
          createMockMessage.result(true),
        ],
      });

      const initialState = createInitialState('Continue authentication work', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      // Execute node
      const result = await checkModeNode(initialState);

      // Verify continuation mode
      expect(result.continuationMode).toBe(true);
      expect(result.currentProjectId).toBe(existingProjectId);
      expect(result.currentUserRequest).toBe('Implement authentication');

      // Verify no new project was created
      expect(mockPersistence.saveProjectMetadata).not.toHaveBeenCalled();
    });

    test('should recalculate priorities for incomplete tasks', async () => {
      const existingProjectId = randomUUID();
      const existingProject = {
        projectId: existingProjectId,
        userRequest: 'Implement feature',
        requestTimestamp: new Date(Date.now() - 3600000),
        totalTasks: 3,
        completedTasks: 1,
        needsStoryMapping: false,
      };

      const existingTasks = [
        {
          id: 'task-1',
          projectId: existingProjectId,
          title: 'Task 1',
          description: 'First task',
          priority: 80,
          dynamicPriority: 80,
          dependencies: [],
          status: 'pending',
          sprint: null,
          requestTimestamp: new Date(Date.now() - 3600000),
        },
      ];

      mockPersistence.loadGlobalQueue.mockResolvedValue(existingTasks);
      mockPersistence.loadAllProjectMetadata.mockResolvedValue(
        new Map([[existingProjectId, existingProject]])
      );

      const aiResponse = {
        isContinuation: true,
        reasoning: 'Continuation',
      };

      // Create proper JSON code block response
      const jsonResponse = '```json\n' + JSON.stringify(aiResponse, null, 2) + '\n```';

      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant(jsonResponse),
          createMockMessage.result(true),
        ],
      });

      const initialState = createInitialState('Continue', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const result = await checkModeNode(initialState);

      // Verify priorities were recalculated
      expect(result.globalTasks).toBeDefined();
      expect(result.globalTasks!.length).toBe(1);
      expect(result.globalTasks![0].dynamicPriority).toBeGreaterThan(80);
    });
  });

  describe('checkModeRouter', () => {
    test('should route to product_owner for new mode', () => {
      const state = createInitialState('New request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const updatedState = {
        ...state,
        continuationMode: false,
      };

      const route = checkModeRouter(updatedState);
      expect(route).toBe('product_owner');
    });

    test('should route to sprint_planning for continuation mode', () => {
      const state = createInitialState('Continue', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const updatedState = {
        ...state,
        continuationMode: true,
      };

      const route = checkModeRouter(updatedState);
      expect(route).toBe('sprint_planning');
    });
  });

  describe('Error Handling', () => {
    test('should handle AI response parsing failure', async () => {
      mockPersistence.loadGlobalQueue.mockResolvedValue([]);
      mockPersistence.loadAllProjectMetadata.mockResolvedValue(new Map());

      // Mock AI response: malformed JSON
      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant('This is not valid JSON'),
          createMockMessage.result(true),
        ],
      });

      const initialState = createInitialState('Test request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const result = await checkModeNode(initialState);

      // Should default to new mode
      expect(result.continuationMode).toBe(false);
      expect(result.currentProjectId).toBeDefined();
    });
  });
});
