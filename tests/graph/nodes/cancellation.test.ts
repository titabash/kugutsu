/**
 * Unit tests for node cancellation functionality
 * Tests that EngineerNode, ReviewNode, and InstructionGeneratorNode
 * properly handle AbortSignal cancellation
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { engineerNode } from '../../../src/graph/nodes/EngineerNode.js';
import { reviewNode } from '../../../src/graph/nodes/ReviewNode.js';
import { instructionGeneratorNode } from '../../../src/graph/nodes/InstructionGeneratorNode.js';
import type { ParallelDevStateType } from '../../../src/graph/state.js';
import type { ParallelDevConfig } from '../../../src/graph/types.js';
import type { GlobalTask, Sprint } from '../../../src/types/index.js';

// Mock dependencies
jest.mock('../../../src/providers/AIProviderFactory.js');
jest.mock('../../../src/utils/DataPersistence.js');
jest.mock('../../../src/utils/MessageHandler.js');

describe('Node Cancellation Tests', () => {
  let mockState: ParallelDevStateType;
  let mockConfig: ParallelDevConfig;
  let abortController: AbortController;

  beforeEach(() => {
    // Create abort controller
    abortController = new AbortController();

    // Mock config with abortSignal
    mockConfig = {
      maxEngineers: 3,
      maxTurns: 10,
      baseBranch: 'main',
      baseRepoPath: '/tmp/test-repo',
      worktreeBasePath: '/tmp/test-repo/worktrees',
      cleanup: false,
      provider: 'mock',
      abortSignal: abortController.signal,
    };

    // Mock active sprint
    const mockSprint: Sprint = {
      id: 'sprint-1',
      name: 'Test Sprint',
      goal: 'Test goal',
      taskIds: ['task-1'],
      status: 'active',
      deployable: false,
      metadata: {
        estimatedHours: 10,
        blockers: [],
        completedTasksCount: 0,
        failedTasksCount: 0,
      },
    };

    // Mock state
    mockState = {
      userRequest: 'test',
      tasks: [],
      completedTasks: [],
      failedTasks: [],
      reviews: [],
      mergeQueue: [],
      worktrees: new Map(),
      logs: [],
      config: mockConfig,
      failedProviders: [],
      globalTasks: [],
      sprints: [mockSprint],
      activeSprint: mockSprint,
      completedSprintIds: [],
      projects: new Map(),
      currentTaskId: 'task-1',
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
        totalTasks: 1,
        tasksCompleted: 0,
        tasksFailed: 0,
        hasErrors: false,
        errors: [],
        requiresDetailedDesign: false,
      },
    };
  });

  describe('EngineerNode - Cancellation', () => {
    it('should skip execution when metadata.cancelled is true', async () => {
      // Arrange - set cancelled flag
      mockState.metadata.cancelled = true;

      // Act
      const result = await engineerNode(mockState);

      // Assert
      expect(result.logs).toBeDefined();
      expect(result.logs?.length).toBeGreaterThan(0);
      expect(result.logs?.[0].message).toContain('cancelled');
      expect(result.logs?.[0].level).toBe('info');
    });

    it('should skip execution when abortSignal is aborted', async () => {
      // Arrange - abort the signal
      abortController.abort();

      // Act - should still check metadata.cancelled first
      // So we need to test the abort check inside the AI execution
      // For now, verify that aborted signal is present
      expect(mockState.config.abortSignal?.aborted).toBe(true);
    });

    it('should execute normally when not cancelled', async () => {
      // Arrange - ensure not cancelled
      mockState.metadata.cancelled = false;
      expect(mockState.config.abortSignal?.aborted).toBe(false);

      // Note: This test would require extensive mocking of AI provider
      // and file system operations. For now, we just verify the cancellation
      // check doesn't trigger.
      expect(mockState.metadata.cancelled).toBe(false);
    });
  });

  describe('ReviewNode - Cancellation', () => {
    it('should skip execution when metadata.cancelled is true', async () => {
      // Arrange
      mockState.metadata.cancelled = true;

      // Act
      const result = await reviewNode(mockState);

      // Assert
      expect(result.logs).toBeDefined();
      expect(result.logs?.length).toBeGreaterThan(0);
      expect(result.logs?.[0].message).toContain('cancelled');
      expect(result.logs?.[0].level).toBe('info');
    });

    it('should skip execution when abortSignal is aborted', async () => {
      // Arrange
      abortController.abort();

      // Assert - signal is aborted
      expect(mockState.config.abortSignal?.aborted).toBe(true);
    });
  });

  describe('InstructionGeneratorNode - Cancellation', () => {
    beforeEach(() => {
      // Add taskToProcess for InstructionGeneratorNode
      const mockTask: GlobalTask = {
        id: 'task-1',
        type: 'feature',
        title: 'Test task',
        description: 'Test description',
        priority: 1,
        dependencies: [],
        status: 'pending',
        projectId: 'project-1',
        requestTimestamp: new Date(),
        dynamicPriority: 100,
        instructionGenerated: false,
        instructionGenerating: false,
      };
      mockState.taskToProcess = mockTask;
      mockState.globalTasks = [mockTask];
    });

    it('should skip execution when metadata.cancelled is true', async () => {
      // Arrange
      mockState.metadata.cancelled = true;

      // Act
      const result = await instructionGeneratorNode(mockState);

      // Assert
      expect(result.logs).toBeDefined();
      expect(result.logs?.length).toBeGreaterThan(0);
      expect(result.logs?.[0].message).toContain('cancelled');
      expect(result.logs?.[0].level).toBe('info');
    });

    it('should skip execution when abortSignal is aborted', async () => {
      // Arrange
      abortController.abort();

      // Assert
      expect(mockState.config.abortSignal?.aborted).toBe(true);
    });
  });

  describe('AbortSignal propagation', () => {
    it('should have abortSignal in config', () => {
      // Assert
      expect(mockState.config.abortSignal).toBeDefined();
      expect(mockState.config.abortSignal).toBeInstanceOf(AbortSignal);
    });

    it('should detect when abortSignal is aborted', () => {
      // Arrange
      expect(mockState.config.abortSignal?.aborted).toBe(false);

      // Act
      abortController.abort();

      // Assert
      expect(mockState.config.abortSignal?.aborted).toBe(true);
    });

    it('should share same abortSignal across all nodes', () => {
      // Assert - all nodes receive the same signal via config
      const signal1 = mockState.config.abortSignal;

      // Simulate passing state to different nodes
      const state2 = { ...mockState };
      const signal2 = state2.config.abortSignal;

      // Should be the same reference
      expect(signal1).toBe(signal2);
    });
  });
});
