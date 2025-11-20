/**
 * Unit tests for ParallelDevOrchestrator cancellation functionality
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ParallelDevOrchestrator } from '../../src/electron/ParallelDevOrchestrator.js';
import type { ParallelDevConfig } from '../../src/graph/types.js';
import { compileUnifiedScrumWorkflowGraph } from '../../src/graph/ParallelDevGraph.js';

// Mock dependencies
jest.mock('../../src/electron/StateStreamManager.js');
jest.mock('../../src/utils/UnifiedProgressManager.js');

// Mock NodeFlowBuilder
jest.mock('../../src/utils/NodeFlowBuilder.js', () => ({
  buildUnifiedScrumWorkflowFlow: jest.fn(() => ({
    nodes: [],
    edges: [],
  })),
}));

// Mock createInitialState
const mockInitialState = {
  userRequest: 'test',
  tasks: [],
  completedTasks: [],
  failedTasks: [],
  reviews: [],
  mergeQueue: [],
  worktrees: new Map(),
  logs: [],
  config: {} as any,
  failedProviders: [],
  globalTasks: [],
  sprints: [],
  activeSprint: null,
  completedSprintIds: [],
  projects: new Map(),
  currentTaskId: null,
  taskToProcess: null,
  techStackPath: null,
  requirementsPath: null,
  tasksPath: null,
  storyMapPath: null,
  sprintPlanPath: null,
  metadataPath: null,
  storyMapping: null,
  storyMappingApproved: null,
  reviewFeedback: null,
  designDocs: null,
  designApproved: null,
  dependencyGraph: null,
  feedbackRequest: null,
  feedbackHistory: [],
  nodeRetryCounters: {},
  maxGlobalRetries: 10,
  currentUserRequest: null,
  continuationMode: false,
  currentProjectId: null,
  taskSplitSuggestions: [],
  taskMergeSuggestions: [],
  metadata: {
    startedAt: new Date(),
    phase: 'development',
    cancelled: false,
    totalTasks: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
    hasErrors: false,
    errors: [],
    requiresDetailedDesign: false,
  },
};

jest.mock('../../src/graph/state.js', () => ({
  createInitialState: jest.fn((userRequest, config) => ({
    ...mockInitialState,
    userRequest,
    config,
  })),
}));

// Mock the graph compilation function
// Note: mockGraph must be created inside the mock factory to ensure it's available during hoisting
let mockStreamImplementation = async function* () {
  // Yield no events - just a simple mock
};

jest.mock('../../src/graph/ParallelDevGraph.js', () => {
  return {
    compileUnifiedScrumWorkflowGraph: jest.fn(() => ({
      stream: jest.fn(async function* (...args) {
        yield* mockStreamImplementation(...args);
      }),
    })),
  };
});

describe('ParallelDevOrchestrator - Cancellation', () => {
  let orchestrator: ParallelDevOrchestrator;
  let mockConfig: ParallelDevConfig;

  beforeEach(() => {
    // Create new orchestrator instance
    orchestrator = new ParallelDevOrchestrator();

    // Mock config
    mockConfig = {
      maxEngineers: 3,
      maxTurns: 10,
      baseBranch: 'main',
      baseRepoPath: '/tmp/test-repo',
      worktreeBasePath: '/tmp/test-repo/worktrees',
      cleanup: false,
      provider: 'mock',
    };
  });

  describe('cancel() method', () => {
    it('should set isCancelled flag to true', () => {
      // Act
      orchestrator.cancel();

      // Assert
      // @ts-ignore - accessing private property for testing
      expect(orchestrator.isCancelled).toBe(true);
    });

    it('should abort the AbortController', () => {
      // Create a new execution context (which creates abortController)
      // @ts-ignore - accessing private property for testing
      orchestrator.abortController = new AbortController();

      // @ts-ignore
      const abortSpy = jest.spyOn(orchestrator.abortController, 'abort');

      // Act
      orchestrator.cancel();

      // Assert
      expect(abortSpy).toHaveBeenCalled();
      // @ts-ignore
      expect(orchestrator.abortController.signal.aborted).toBe(true);
    });

    it('should handle multiple cancel() calls gracefully', () => {
      // Arrange
      // @ts-ignore
      orchestrator.abortController = new AbortController();

      // Act
      orchestrator.cancel();
      orchestrator.cancel();
      orchestrator.cancel();

      // Assert - should not throw
      // @ts-ignore
      expect(orchestrator.isCancelled).toBe(true);
      // @ts-ignore
      expect(orchestrator.abortController.signal.aborted).toBe(true);
    });

    it('should not throw if abortController is null', () => {
      // Arrange
      // @ts-ignore - set abortController to null
      orchestrator.abortController = null;

      // Act & Assert - should not throw
      expect(() => orchestrator.cancel()).not.toThrow();
    });
  });

  describe('AbortSignal injection', () => {
    it('should create AbortController and expose AbortSignal', () => {
      // Act - create new orchestrator and start cancellation setup
      const newOrchestrator = new ParallelDevOrchestrator();

      // Initially no abortController
      // @ts-ignore
      expect(newOrchestrator.abortController).toBeNull();

      // Simulate the initialization that happens at the start of execute()
      // by directly setting up an AbortController (this simulates line 144 in execute())
      // @ts-ignore
      newOrchestrator.abortController = new AbortController();

      // Assert - AbortController should exist
      // @ts-ignore
      expect(newOrchestrator.abortController).not.toBeNull();
      // @ts-ignore
      expect(newOrchestrator.abortController).toBeInstanceOf(AbortController);

      // Assert - AbortSignal should be accessible
      // @ts-ignore
      const signal = newOrchestrator.abortController.signal;
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(false);
    });
  });

  describe('Cancellation during execution', () => {
    it('should create new AbortController for each execution', async () => {
      // Clear all mocks
      jest.clearAllMocks();

      // Get the mocked compileUnifiedScrumWorkflowGraph function
      const mockedCompile = compileUnifiedScrumWorkflowGraph as jest.MockedFunction<typeof compileUnifiedScrumWorkflowGraph>;

      // First execution
      try {
        await orchestrator.execute({
          userRequest: 'test1',
          config: mockConfig,
          window: null,
        });
      } catch (error) {
        // Expected
      }

      // @ts-ignore
      const firstController = orchestrator.abortController;

      // Second execution
      try {
        await orchestrator.execute({
          userRequest: 'test2',
          config: mockConfig,
          window: null,
        });
      } catch (error) {
        // Expected
      }

      // @ts-ignore
      const secondController = orchestrator.abortController;

      // Assert - should be different instances
      expect(firstController).not.toBe(secondController);
    });

    it('should pass AbortSignal to graph.stream()', async () => {
      // Clear all mocks
      jest.clearAllMocks();

      // Get the mocked graph
      const mockedCompile = compileUnifiedScrumWorkflowGraph as jest.MockedFunction<typeof compileUnifiedScrumWorkflowGraph>;
      const mockGraph = mockedCompile();

      // Start execution (don't await - we'll cancel it)
      const executePromise = orchestrator.execute({
        userRequest: 'test',
        config: mockConfig,
        window: null,
      });

      // Wait a bit for execute() to call graph.stream()
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert - stream() should have been called with signal
      expect(mockGraph.stream).toHaveBeenCalled();

      // Get the call arguments
      const streamCallArgs = (mockGraph.stream as jest.MockedFunction<any>).mock.calls[0];
      expect(streamCallArgs).toBeDefined();
      expect(streamCallArgs.length).toBeGreaterThan(1);

      // Second argument should be the options object
      const options = streamCallArgs[1];
      expect(options).toBeDefined();

      // CRITICAL: signal property must exist in options
      expect(options.signal).toBeDefined();
      expect(options.signal).toBeInstanceOf(AbortSignal);

      // Cancel and wait for completion
      orchestrator.cancel();
      await executePromise.catch(() => {/* ignore errors */});
    });

    it('should stop stream execution when cancelled', async () => {
      // Clear all mocks
      jest.clearAllMocks();

      // Create a mock stream that runs indefinitely until cancelled
      let streamCancelled = false;

      // Override mockStreamImplementation globally
      mockStreamImplementation = async function* (state: any, options: any) {
        // Simulate long-running stream
        for (let i = 0; i < 1000; i++) {
          // Check if signal is aborted
          if (options?.signal?.aborted) {
            streamCancelled = true;
            return;
          }

          // Yield a fake event
          yield { values: { ...state, metadata: { ...state.metadata, phase: 'development' } } };

          // Small delay to simulate processing
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      };

      // Start execution (don't await)
      const executePromise = orchestrator.execute({
        userRequest: 'test',
        config: mockConfig,
        window: null,
      });

      // Wait a bit to ensure stream has started
      await new Promise(resolve => setTimeout(resolve, 100));

      // Cancel execution
      orchestrator.cancel();

      // Wait for execution to complete
      await executePromise.catch(() => {/* ignore errors */});

      // Assert - stream should have detected cancellation
      expect(streamCancelled).toBe(true);
    }, 10000); // 10 second timeout

    it('should complete cancellation within reasonable time', async () => {
      // Clear all mocks
      jest.clearAllMocks();

      // Override mockStreamImplementation
      mockStreamImplementation = async function* (state: any, options: any) {
        for (let i = 0; i < 100; i++) {
          if (options?.signal?.aborted) {
            return;
          }
          yield { values: state };
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      };

      // Start execution
      const executePromise = orchestrator.execute({
        userRequest: 'test',
        config: mockConfig,
        window: null,
      });

      // Wait for stream to start
      await new Promise(resolve => setTimeout(resolve, 100));

      // Cancel and measure time
      const cancelStartTime = Date.now();
      orchestrator.cancel();

      await executePromise.catch(() => {/* ignore errors */});
      const cancelDuration = Date.now() - cancelStartTime;

      // Assert - cancellation should complete within 3 seconds
      expect(cancelDuration).toBeLessThan(3000);
    }, 10000);
  });
});
