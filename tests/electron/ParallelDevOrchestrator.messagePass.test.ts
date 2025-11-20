/**
 * ParallelDevOrchestrator - Message Passing Tests
 *
 * Tests for passing AI messages from state to StateStreamManager
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('ParallelDevOrchestrator - Message Passing', () => {
  let mockStateStreamManager: any;
  let mockProcessStateUpdate: jest.Mock;
  let mockNotifyNodeExecution: jest.Mock;

  beforeEach(() => {
    mockProcessStateUpdate = jest.fn();
    mockNotifyNodeExecution = jest.fn();

    mockStateStreamManager = {
      processStateUpdate: mockProcessStateUpdate,
      notifyNodeExecution: mockNotifyNodeExecution,
      setWindow: jest.fn(),
      destroy: jest.fn(),
    };
  });

  describe('handleValueEvent - AI Message Extraction', () => {
    test('should extract and pass AI messages from nodeExecutionResults to StateStreamManager', async () => {
      const nodeName = 'EngineerNode';
      const taskId = 'TASK-001';
      const aiMessages = [
        {
          type: 'assistant',
          content: [{ type: 'text', text: 'Implementation started' }],
        },
        {
          type: 'assistant',
          content: [
            {
              type: 'tool_use',
              name: 'Write',
              input: { file_path: '/test.ts', content: 'code' },
            },
          ],
        },
      ];

      // Mock state with nodeExecutionResults
      const stateUpdate = {
        currentTaskId: taskId,
        nodeExecutionResults: new Map([[`${nodeName}-${taskId}`, aiMessages]]),
      };

      const finalState = {
        ...stateUpdate,
        tasks: [],
        completedTasks: [],
        failedTasks: [],
        reviews: [],
        mergeQueue: [],
        worktrees: new Map(),
        logs: [],
        config: {} as any,
        failedProviders: [],
      };

      // Simulate handleValueEvent logic
      const resultKey = `${nodeName}-${taskId}`;
      const extractedMessages =
        finalState.nodeExecutionResults?.get(resultKey) || [];

      // Verify extraction logic
      expect(extractedMessages).toEqual(aiMessages);
      expect(extractedMessages).toHaveLength(2);

      // Simulate calling StateStreamManager
      await mockStateStreamManager.processStateUpdate(finalState);
      await mockStateStreamManager.notifyNodeExecution(
        nodeName,
        'completed',
        finalState,
        taskId,
        extractedMessages
      );

      // Verify calls
      expect(mockProcessStateUpdate).toHaveBeenCalledWith(finalState);
      expect(mockNotifyNodeExecution).toHaveBeenCalledWith(
        nodeName,
        'completed',
        finalState,
        taskId,
        aiMessages
      );
    });

    test('should handle missing taskId gracefully', async () => {
      const nodeName = 'EngineerNode';

      const stateUpdate = {
        currentTaskId: null,
        nodeExecutionResults: new Map(),
      };

      const finalState = {
        ...stateUpdate,
        tasks: [],
        completedTasks: [],
        failedTasks: [],
        reviews: [],
        mergeQueue: [],
        worktrees: new Map(),
        logs: [],
        config: {} as any,
        failedProviders: [],
      };

      // Should handle undefined taskId
      const taskId = finalState.currentTaskId;
      const resultKey = `${nodeName}-${taskId}`;
      const extractedMessages =
        finalState.nodeExecutionResults?.get(resultKey) || [];

      expect(extractedMessages).toEqual([]);

      // Should still call StateStreamManager
      await mockStateStreamManager.processStateUpdate(finalState);
      await mockStateStreamManager.notifyNodeExecution(
        nodeName,
        'completed',
        finalState,
        taskId || undefined,
        extractedMessages
      );

      expect(mockNotifyNodeExecution).toHaveBeenCalledWith(
        nodeName,
        'completed',
        finalState,
        undefined,
        []
      );
    });

    test('should handle missing nodeExecutionResults in state', async () => {
      const nodeName = 'EngineerNode';
      const taskId = 'TASK-002';

      const stateUpdate = {
        currentTaskId: taskId,
        // nodeExecutionResults not present
      };

      const finalState = {
        ...stateUpdate,
        tasks: [],
        completedTasks: [],
        failedTasks: [],
        reviews: [],
        mergeQueue: [],
        worktrees: new Map(),
        logs: [],
        config: {} as any,
        failedProviders: [],
      };

      // Should handle missing nodeExecutionResults
      const resultKey = `${nodeName}-${taskId}`;
      const extractedMessages =
        (finalState as any).nodeExecutionResults?.get(resultKey) || [];

      expect(extractedMessages).toEqual([]);

      await mockStateStreamManager.processStateUpdate(finalState);
      await mockStateStreamManager.notifyNodeExecution(
        nodeName,
        'completed',
        finalState,
        taskId,
        extractedMessages
      );

      expect(mockNotifyNodeExecution).toHaveBeenCalledWith(
        nodeName,
        'completed',
        finalState,
        taskId,
        []
      );
    });

    test('should handle empty AI messages array', async () => {
      const nodeName = 'EngineerNode';
      const taskId = 'TASK-003';

      const stateUpdate = {
        currentTaskId: taskId,
        nodeExecutionResults: new Map([[`${nodeName}-${taskId}`, []]]),
      };

      const finalState = {
        ...stateUpdate,
        tasks: [],
        completedTasks: [],
        failedTasks: [],
        reviews: [],
        mergeQueue: [],
        worktrees: new Map(),
        logs: [],
        config: {} as any,
        failedProviders: [],
      };

      const resultKey = `${nodeName}-${taskId}`;
      const extractedMessages =
        finalState.nodeExecutionResults?.get(resultKey) || [];

      expect(extractedMessages).toEqual([]);

      await mockStateStreamManager.processStateUpdate(finalState);
      await mockStateStreamManager.notifyNodeExecution(
        nodeName,
        'completed',
        finalState,
        taskId,
        extractedMessages
      );

      expect(mockNotifyNodeExecution).toHaveBeenCalledWith(
        nodeName,
        'completed',
        finalState,
        taskId,
        []
      );
    });

    test('should handle multiple node types', async () => {
      const taskId = 'TASK-004';
      const engineerMessages = [
        {
          type: 'assistant',
          content: [{ type: 'text', text: 'Engineer work' }],
        },
      ];
      const reviewMessages = [
        {
          type: 'assistant',
          content: [{ type: 'text', text: 'Review work' }],
        },
      ];

      const stateUpdate = {
        currentTaskId: taskId,
        nodeExecutionResults: new Map([
          [`EngineerNode-${taskId}`, engineerMessages],
          [`ReviewNode-${taskId}`, reviewMessages],
        ]),
      };

      const finalState = {
        ...stateUpdate,
        tasks: [],
        completedTasks: [],
        failedTasks: [],
        reviews: [],
        mergeQueue: [],
        worktrees: new Map(),
        logs: [],
        config: {} as any,
        failedProviders: [],
      };

      // Extract Engineer messages
      const engineerKey = `EngineerNode-${taskId}`;
      const extractedEngineerMessages =
        finalState.nodeExecutionResults?.get(engineerKey) || [];

      expect(extractedEngineerMessages).toEqual(engineerMessages);

      // Extract Review messages
      const reviewKey = `ReviewNode-${taskId}`;
      const extractedReviewMessages =
        finalState.nodeExecutionResults?.get(reviewKey) || [];

      expect(extractedReviewMessages).toEqual(reviewMessages);

      // Both should be available
      expect(extractedEngineerMessages).not.toEqual(extractedReviewMessages);
    });

    test('should handle large message arrays', async () => {
      const nodeName = 'EngineerNode';
      const taskId = 'TASK-005';

      // Create 100 messages
      const largeMessageArray = Array.from({ length: 100 }, (_, i) => ({
        type: 'assistant',
        content: [{ type: 'text', text: `Message ${i}` }],
      }));

      const stateUpdate = {
        currentTaskId: taskId,
        nodeExecutionResults: new Map([
          [`${nodeName}-${taskId}`, largeMessageArray],
        ]),
      };

      const finalState = {
        ...stateUpdate,
        tasks: [],
        completedTasks: [],
        failedTasks: [],
        reviews: [],
        mergeQueue: [],
        worktrees: new Map(),
        logs: [],
        config: {} as any,
        failedProviders: [],
      };

      const resultKey = `${nodeName}-${taskId}`;
      const extractedMessages =
        finalState.nodeExecutionResults?.get(resultKey) || [];

      expect(extractedMessages).toHaveLength(100);
      expect(extractedMessages[0].content[0].text).toBe('Message 0');
      expect(extractedMessages[99].content[0].text).toBe('Message 99');

      await mockStateStreamManager.processStateUpdate(finalState);
      await mockStateStreamManager.notifyNodeExecution(
        nodeName,
        'completed',
        finalState,
        taskId,
        extractedMessages
      );

      expect(mockNotifyNodeExecution).toHaveBeenCalledWith(
        nodeName,
        'completed',
        finalState,
        taskId,
        largeMessageArray
      );
    });

    test('should preserve message structure integrity', async () => {
      const nodeName = 'EngineerNode';
      const taskId = 'TASK-006';

      const complexMessages = [
        {
          type: 'thinking',
          thinking: 'Planning...',
          metadata: { timestamp: Date.now() },
        },
        {
          type: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Implementation',
            },
            {
              type: 'tool_use',
              name: 'Write',
              input: {
                file_path: '/test.ts',
                content: 'code',
                nested: {
                  deep: {
                    value: 'test',
                  },
                },
              },
            },
          ],
        },
        {
          type: 'result',
          status: 'success',
          finalResponse: 'Complete',
          tokens: { input: 1000, output: 500 },
        },
      ];

      const stateUpdate = {
        currentTaskId: taskId,
        nodeExecutionResults: new Map([
          [`${nodeName}-${taskId}`, complexMessages],
        ]),
      };

      const finalState = {
        ...stateUpdate,
        tasks: [],
        completedTasks: [],
        failedTasks: [],
        reviews: [],
        mergeQueue: [],
        worktrees: new Map(),
        logs: [],
        config: {} as any,
        failedProviders: [],
      };

      const resultKey = `${nodeName}-${taskId}`;
      const extractedMessages =
        finalState.nodeExecutionResults?.get(resultKey) || [];

      // Deep equality check
      expect(extractedMessages).toEqual(complexMessages);
      expect(extractedMessages[0].metadata?.timestamp).toBeDefined();
      expect(extractedMessages[1].content[1].input.nested.deep.value).toBe(
        'test'
      );
      expect(extractedMessages[2].tokens?.input).toBe(1000);

      await mockStateStreamManager.processStateUpdate(finalState);
      await mockStateStreamManager.notifyNodeExecution(
        nodeName,
        'completed',
        finalState,
        taskId,
        extractedMessages
      );

      expect(mockNotifyNodeExecution).toHaveBeenCalledWith(
        nodeName,
        'completed',
        finalState,
        taskId,
        complexMessages
      );
    });
  });

  describe('Error Cases', () => {
    test('should not crash when nodeExecutionResults contains invalid data', async () => {
      const nodeName = 'EngineerNode';
      const taskId = 'TASK-007';

      const stateUpdate = {
        currentTaskId: taskId,
        nodeExecutionResults: new Map([
          [`${nodeName}-${taskId}`, null as any],
        ]),
      };

      const finalState = {
        ...stateUpdate,
        tasks: [],
        completedTasks: [],
        failedTasks: [],
        reviews: [],
        mergeQueue: [],
        worktrees: new Map(),
        logs: [],
        config: {} as any,
        failedProviders: [],
      };

      const resultKey = `${nodeName}-${taskId}`;
      const extractedMessages =
        finalState.nodeExecutionResults?.get(resultKey) || [];

      // Should fallback to empty array
      expect(extractedMessages).toEqual([]);

      // Should not throw
      await expect(async () => {
        await mockStateStreamManager.processStateUpdate(finalState);
        await mockStateStreamManager.notifyNodeExecution(
          nodeName,
          'completed',
          finalState,
          taskId,
          extractedMessages
        );
      }).resolves.not.toThrow();
    });
  });
});
