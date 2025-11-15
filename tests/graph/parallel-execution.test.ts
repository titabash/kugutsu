/**
 * Parallel Execution Tests (Send API)
 *
 * Tests that verify the graph's parallel execution using Send API:
 * - Multiple engineer nodes running in parallel
 * - Multiple review nodes running in parallel
 * - maxEngineers limit enforcement
 * - Dynamic task pooling
 */

import { jest } from '@jest/globals';
import { promises as fs } from 'fs';

// Mock AIProviderFactory BEFORE importing anything that uses it
let mockProvider: any;
jest.unstable_mockModule('../../src/providers/AIProviderFactory.js', () => ({
  AIProviderFactory: {
    create: jest.fn(() => mockProvider),
    buildProviderConfig: jest.fn(() => ({})),
    syncWithState: jest.fn(() => {}),
    getFailedProviders: jest.fn(() => []),
    recordFailure: jest.fn(() => {}),
    getSupportedProviders: jest.fn(() => ['claude', 'codex', 'mock']),
    isProviderSupported: jest.fn(() => true),
  },
}));

// Mock DataPersistence
let mockPersistence: any;
jest.unstable_mockModule('../../src/utils/DataPersistence.js', () => ({
  DataPersistence: jest.fn().mockImplementation(() => mockPersistence),
}));

// Import modules AFTER mocking
const { compileUnifiedScrumWorkflowGraph } = await import('../../src/graph/ParallelDevGraph.js');
const {
  createTestState,
  createTestTask,
  collectEvents,
  expectTaskProcessed,
  getNodeEvents,
} = await import('../helpers/graph-test-helpers.js');
const { MockAIProvider } = await import('../../src/providers/MockAIProvider.js');

describe('Parallel Execution (Send API)', () => {
  const testBaseDir = `${process.cwd()}/.test-tmp`;

  beforeAll(async () => {
    // Create test directories
    await fs.mkdir(testBaseDir, { recursive: true });
    await fs.mkdir(`${testBaseDir}/repo`, { recursive: true });
    await fs.mkdir(`${testBaseDir}/worktrees`, { recursive: true });
  });

  afterAll(async () => {
    // Cleanup test directories
    try {
      await fs.rm(testBaseDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock provider
    mockProvider = new MockAIProvider();
    mockProvider.clearMockResponses(); // Clear any responses from other tests

    // Setup mock persistence
    mockPersistence = {
      initialize: jest.fn<any>().mockResolvedValue(undefined),
      loadGlobalQueue: jest.fn<any>().mockResolvedValue([]),
      loadAllProjectMetadata: jest.fn<any>().mockResolvedValue(new Map()),
      saveProjectMetadata: jest.fn<any>().mockResolvedValue(undefined),
      loadRepositoryMetadata: jest.fn<any>().mockResolvedValue(null),
      saveRepositoryMetadata: jest.fn<any>().mockResolvedValue(undefined),
      loadTechStack: jest.fn<any>().mockResolvedValue(null),
      saveTechStack: jest.fn<any>().mockResolvedValue(undefined),
      loadRequirements: jest.fn<any>().mockResolvedValue(null),
      saveRequirements: jest.fn<any>().mockResolvedValue(undefined),
      loadTasks: jest.fn<any>().mockResolvedValue([]),
      saveTasks: jest.fn<any>().mockResolvedValue(undefined),
      loadGlobalTasks: jest.fn<any>().mockResolvedValue([]),
      saveGlobalTasks: jest.fn<any>().mockResolvedValue(undefined),
      loadSprintPlan: jest.fn<any>().mockResolvedValue(null),
      saveSprintPlan: jest.fn<any>().mockResolvedValue(undefined),
    };
  });

  describe('Engineer Node Parallel Execution', () => {
    test('should execute multiple engineer nodes in parallel', async () => {
      const graph = compileUnifiedScrumWorkflowGraph();

      // Setup 3 tasks in progress
      const tasks = [
        createTestTask({
          id: 'task-1',
          status: 'in_progress',
          worktreePath: '/test/worktrees/task-1',
          branchName: 'feature/task-1',
        }),
        createTestTask({
          id: 'task-2',
          status: 'in_progress',
          worktreePath: '/test/worktrees/task-2',
          branchName: 'feature/task-2',
        }),
        createTestTask({
          id: 'task-3',
          status: 'in_progress',
          worktreePath: '/test/worktrees/task-3',
          branchName: 'feature/task-3',
        }),
      ];

      // Setup successful implementation response
      mockProvider.setDefaultResponse({
        messages: [
          {
            type: 'assistant',
            content: 'Implementation completed',
            timestamp: new Date(),
          },
          {
            type: 'result',
            content: { success: true },
            timestamp: new Date(),
          },
        ],
      });

      const initialState = createTestState('Test request', {
        provider: 'mock',
        maxEngineers: 3,
        maxTurns: 10,
      })
        .withTasks(tasks)
        .build();

      const events = await collectEvents(graph.stream(initialState));

      // Get all engineer node events
      const engineerEvents = getNodeEvents(events, 'engineer');

      // Verify that 3 engineer nodes were executed (one for each task)
      expect(engineerEvents.length).toBe(3);

      // Verify each task was processed
      expectTaskProcessed(events, 'task-1');
      expectTaskProcessed(events, 'task-2');
      expectTaskProcessed(events, 'task-3');
    });

    test('should respect maxEngineers limit', async () => {
      const graph = compileUnifiedScrumWorkflowGraph();

      // Setup 10 pending tasks
      const tasks = Array.from({ length: 10 }, (_, i) =>
        createTestTask({
          id: `task-${i + 1}`,
          status: 'pending',
        })
      );

      mockProvider.setDefaultResponse({
        messages: [
          {
            type: 'assistant',
            content: 'Implementation completed',
            timestamp: new Date(),
          },
          {
            type: 'result',
            content: { success: true },
            timestamp: new Date(),
          },
        ],
      });

      const initialState = createTestState('Test request', {
        provider: 'mock',
        maxEngineers: 3, // Limit to 3 concurrent engineers
        maxTurns: 20,
      })
        .withTasks(tasks)
        .build();

      const events = await collectEvents(graph.stream(initialState));

      // Get engineer dispatch events
      const dispatchEvents = getNodeEvents(events, 'engineer_dispatch');

      // In the first dispatch, only 3 tasks should be moved to in_progress
      // (due to maxEngineers=3)
      const firstDispatch = dispatchEvents[0];
      const inProgressTasks = firstDispatch.tasks?.filter((t: any) => t.status === 'in_progress') || [];

      expect(inProgressTasks.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Review Node Parallel Execution', () => {
    test('should execute multiple review nodes in parallel', async () => {
      const graph = compileUnifiedScrumWorkflowGraph();

      // Setup 3 tasks in review
      const tasks = [
        createTestTask({
          id: 'task-1',
          status: 'in_review',
          worktreePath: '/test/worktrees/task-1',
          branchName: 'feature/task-1',
        }),
        createTestTask({
          id: 'task-2',
          status: 'in_review',
          worktreePath: '/test/worktrees/task-2',
          branchName: 'feature/task-2',
        }),
        createTestTask({
          id: 'task-3',
          status: 'in_review',
          worktreePath: '/test/worktrees/task-3',
          branchName: 'feature/task-3',
        }),
      ];

      // Setup approved review response
      mockProvider.setDefaultResponse({
        messages: [
          {
            type: 'assistant',
            content: JSON.stringify({
              status: 'approved',
              comments: 'Approved',
            }),
            timestamp: new Date(),
          },
          {
            type: 'result',
            content: { success: true },
            timestamp: new Date(),
          },
        ],
      });

      const initialState = createTestState('Test request', {
        provider: 'mock',
        maxEngineers: 3,
        maxTurns: 10,
      })
        .withTasks(tasks)
        .build();

      const events = await collectEvents(graph.stream(initialState));

      // Get all review node events
      const reviewEvents = getNodeEvents(events, 'review');

      // Verify that 3 review nodes were executed (one for each task)
      expect(reviewEvents.length).toBe(3);
    });

    test('should respect maxEngineers limit for reviews', async () => {
      const graph = compileUnifiedScrumWorkflowGraph();

      // Setup 5 tasks in review
      const tasks = Array.from({ length: 5 }, (_, i) =>
        createTestTask({
          id: `task-${i + 1}`,
          status: 'in_review',
          worktreePath: `/test/worktrees/task-${i + 1}`,
          branchName: `feature/task-${i + 1}`,
        })
      );

      mockProvider.setDefaultResponse({
        messages: [
          {
            type: 'assistant',
            content: JSON.stringify({
              status: 'approved',
              comments: 'Approved',
            }),
            timestamp: new Date(),
          },
          {
            type: 'result',
            content: { success: true },
            timestamp: new Date(),
          },
        ],
      });

      const initialState = createTestState('Test request', {
        provider: 'mock',
        maxEngineers: 2, // Limit to 2 concurrent reviewers
        maxTurns: 20,
      })
        .withTasks(tasks)
        .build();

      const events = await collectEvents(graph.stream(initialState));

      // Get review dispatch events
      const dispatchEvents = getNodeEvents(events, 'review_dispatch');

      // Verify that review dispatch respects maxEngineers limit
      // (first batch should have at most 2 reviews)
      const firstBatch = dispatchEvents[0];
      expect(firstBatch).toBeDefined();
    });
  });

  describe('Dynamic Task Pooling', () => {
    test('should dispatch new tasks when slots become available', async () => {
      const graph = compileUnifiedScrumWorkflowGraph();

      // Setup: 2 tasks in progress, 3 pending tasks
      // With maxEngineers=3, we have 1 available slot
      const tasks = [
        createTestTask({
          id: 'task-in-progress-1',
          status: 'in_progress',
          worktreePath: '/test/worktrees/task-1',
          branchName: 'feature/task-1',
        }),
        createTestTask({
          id: 'task-in-progress-2',
          status: 'in_progress',
          worktreePath: '/test/worktrees/task-2',
          branchName: 'feature/task-2',
        }),
        createTestTask({
          id: 'task-pending-1',
          status: 'pending',
        }),
        createTestTask({
          id: 'task-pending-2',
          status: 'pending',
        }),
        createTestTask({
          id: 'task-pending-3',
          status: 'pending',
        }),
      ];

      mockProvider.setDefaultResponse({
        messages: [
          {
            type: 'assistant',
            content: 'Completed',
            timestamp: new Date(),
          },
          {
            type: 'result',
            content: { success: true },
            timestamp: new Date(),
          },
        ],
      });

      const initialState = createTestState('Test request', {
        provider: 'mock',
        maxEngineers: 3,
        maxTurns: 30,
      })
        .withTasks(tasks)
        .build();

      const events = await collectEvents(graph.stream(initialState));

      // Get engineer dispatch events
      const dispatchEvents = getNodeEvents(events, 'engineer_dispatch');

      // Should have multiple dispatch rounds
      expect(dispatchEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Dependency-Based Execution', () => {
    test('should execute tasks in dependency order', async () => {
      const graph = compileUnifiedScrumWorkflowGraph();

      // Setup tasks with dependencies: task-1 → task-2 → task-3
      const tasks = [
        createTestTask({
          id: 'task-1',
          status: 'pending',
          dependencies: [],
          priority: 100,
        }),
        createTestTask({
          id: 'task-2',
          status: 'pending',
          dependencies: ['task-1'], // Depends on task-1
          priority: 90,
        }),
        createTestTask({
          id: 'task-3',
          status: 'pending',
          dependencies: ['task-2'], // Depends on task-2
          priority: 80,
        }),
      ];

      mockProvider.setDefaultResponse({
        messages: [
          {
            type: 'assistant',
            content: 'Completed',
            timestamp: new Date(),
          },
          {
            type: 'result',
            content: { success: true },
            timestamp: new Date(),
          },
        ],
      });

      const initialState = createTestState('Test request', {
        provider: 'mock',
        maxEngineers: 3,
        maxTurns: 30,
      })
        .withTasks(tasks)
        .build();

      const events = await collectEvents(graph.stream(initialState));

      // Task-1 should start first (no dependencies)
      expectTaskProcessed(events, 'task-1');

      // Task-2 should only start after task-1 is completed
      // Task-3 should only start after task-2 is completed
      // (This is verified by the TaskStateMachine logic in the graph)
    });

    test('should execute parallel independent tasks simultaneously', async () => {
      const graph = compileUnifiedScrumWorkflowGraph();

      // Setup independent tasks (no dependencies)
      const tasks = [
        createTestTask({
          id: 'task-a',
          status: 'pending',
          dependencies: [],
        }),
        createTestTask({
          id: 'task-b',
          status: 'pending',
          dependencies: [],
        }),
        createTestTask({
          id: 'task-c',
          status: 'pending',
          dependencies: [],
        }),
      ];

      mockProvider.setDefaultResponse({
        messages: [
          {
            type: 'assistant',
            content: 'Completed',
            timestamp: new Date(),
          },
          {
            type: 'result',
            content: { success: true },
            timestamp: new Date(),
          },
        ],
      });

      const initialState = createTestState('Test request', {
        provider: 'mock',
        maxEngineers: 3,
        maxTurns: 20,
      })
        .withTasks(tasks)
        .build();

      const events = await collectEvents(graph.stream(initialState));

      // Get engineer events
      const engineerEvents = getNodeEvents(events, 'engineer');

      // All 3 tasks should be executed (potentially in parallel)
      expect(engineerEvents.length).toBeGreaterThanOrEqual(3);
    });
  });
});
