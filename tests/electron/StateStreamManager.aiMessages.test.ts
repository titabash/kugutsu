/**
 * StateStreamManager - AI Messages Tests
 *
 * Tests for aiMessages parameter in notifyNodeExecution
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { StateStreamManager } from '../../src/electron/StateStreamManager.js';
import type { ParallelDevStateType } from '../../src/graph/state.js';

describe('StateStreamManager - AI Messages', () => {
  let manager: StateStreamManager;
  let mockWindow: any;
  let sentEvents: any[];

  beforeEach(() => {
    sentEvents = [];

    // Mock BrowserWindow
    mockWindow = {
      webContents: {
        send: jest.fn((channel: string, data: any) => {
          sentEvents.push({ channel, data });
        }),
      },
      isDestroyed: jest.fn().mockReturnValue(false),
    };

    manager = new StateStreamManager({
      bufferInterval: 50,
      maxEventsPerSecond: 20,
      maxBufferSize: 100,
      maxLogBuffer: 1000,
    });

    manager.setWindow(mockWindow as any);
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('notifyNodeExecution with aiMessages', () => {
    test('should include aiMessages in node-completed event', async () => {
      const nodeName = 'EngineerNode';
      const taskId = 'TASK-001';
      const aiMessages = [
        {
          type: 'assistant',
          content: [
            {
              type: 'text',
              text: 'I will implement the feature',
            },
          ],
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

      // Notify node started
      await manager.notifyNodeExecution(nodeName, 'started', undefined, taskId);

      // Notify node completed with AI messages
      await manager.notifyNodeExecution(
        nodeName,
        'completed',
        undefined,
        taskId,
        aiMessages
      );

      // Wait for buffer to flush
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Find node-completed event
      const completedEvents = sentEvents.filter(
        (e) =>
          e.channel === 'graph-events-batch' &&
          e.data.some((event: any) => event.type === 'node-completed')
      );

      expect(completedEvents.length).toBeGreaterThan(0);

      // Extract node-completed event
      const batchData = completedEvents[0].data;
      const nodeCompletedEvent = batchData.find(
        (event: any) => event.type === 'node-completed'
      );

      expect(nodeCompletedEvent).toBeDefined();
      expect(nodeCompletedEvent.data.aiMessages).toBeDefined();
      expect(nodeCompletedEvent.data.aiMessages).toEqual(aiMessages);
    });

    test('should handle empty aiMessages array', async () => {
      const nodeName = 'EngineerNode';
      const taskId = 'TASK-002';
      const aiMessages: any[] = [];

      await manager.notifyNodeExecution(nodeName, 'started', undefined, taskId);
      await manager.notifyNodeExecution(
        nodeName,
        'completed',
        undefined,
        taskId,
        aiMessages
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      const completedEvents = sentEvents.filter(
        (e) =>
          e.channel === 'graph-events-batch' &&
          e.data.some((event: any) => event.type === 'node-completed')
      );

      const batchData = completedEvents[0].data;
      const nodeCompletedEvent = batchData.find(
        (event: any) => event.type === 'node-completed'
      );

      expect(nodeCompletedEvent.data.aiMessages).toEqual([]);
    });

    test('should handle undefined aiMessages', async () => {
      const nodeName = 'EngineerNode';
      const taskId = 'TASK-003';

      await manager.notifyNodeExecution(nodeName, 'started', undefined, taskId);
      await manager.notifyNodeExecution(
        nodeName,
        'completed',
        undefined,
        taskId,
        undefined
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      const completedEvents = sentEvents.filter(
        (e) =>
          e.channel === 'graph-events-batch' &&
          e.data.some((event: any) => event.type === 'node-completed')
      );

      const batchData = completedEvents[0].data;
      const nodeCompletedEvent = batchData.find(
        (event: any) => event.type === 'node-completed'
      );

      expect(nodeCompletedEvent.data.aiMessages).toBeUndefined();
    });

    test('should handle different message types', async () => {
      const nodeName = 'EngineerNode';
      const taskId = 'TASK-004';
      const aiMessages = [
        {
          type: 'thinking',
          thinking: 'Planning the implementation...',
        },
        {
          type: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Starting implementation',
            },
          ],
        },
        {
          type: 'assistant',
          content: [
            {
              type: 'tool_use',
              name: 'Read',
              input: { file_path: '/existing.ts' },
            },
          ],
        },
        {
          type: 'result',
          status: 'success',
          finalResponse: 'Implementation complete',
        },
      ];

      await manager.notifyNodeExecution(nodeName, 'started', undefined, taskId);
      await manager.notifyNodeExecution(
        nodeName,
        'completed',
        undefined,
        taskId,
        aiMessages
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      const completedEvents = sentEvents.filter(
        (e) =>
          e.channel === 'graph-events-batch' &&
          e.data.some((event: any) => event.type === 'node-completed')
      );

      const batchData = completedEvents[0].data;
      const nodeCompletedEvent = batchData.find(
        (event: any) => event.type === 'node-completed'
      );

      expect(nodeCompletedEvent.data.aiMessages).toHaveLength(4);
      expect(nodeCompletedEvent.data.aiMessages[0].type).toBe('thinking');
      expect(nodeCompletedEvent.data.aiMessages[1].type).toBe('assistant');
      expect(nodeCompletedEvent.data.aiMessages[2].content[0].type).toBe(
        'tool_use'
      );
      expect(nodeCompletedEvent.data.aiMessages[3].type).toBe('result');
    });

    test('should handle multiple nodes with different AI messages', async () => {
      const task1Id = 'TASK-001';
      const task2Id = 'TASK-002';

      const aiMessages1 = [
        {
          type: 'assistant',
          content: [{ type: 'text', text: 'Task 1 message' }],
        },
      ];

      const aiMessages2 = [
        {
          type: 'assistant',
          content: [{ type: 'text', text: 'Task 2 message' }],
        },
      ];

      // Task 1
      await manager.notifyNodeExecution(
        'EngineerNode',
        'started',
        undefined,
        task1Id
      );
      await manager.notifyNodeExecution(
        'EngineerNode',
        'completed',
        undefined,
        task1Id,
        aiMessages1
      );

      // Task 2
      await manager.notifyNodeExecution(
        'EngineerNode',
        'started',
        undefined,
        task2Id
      );
      await manager.notifyNodeExecution(
        'EngineerNode',
        'completed',
        undefined,
        task2Id,
        aiMessages2
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      const completedEvents = sentEvents.filter(
        (e) =>
          e.channel === 'graph-events-batch' &&
          e.data.some((event: any) => event.type === 'node-completed')
      );

      // Should have events for both tasks
      expect(completedEvents.length).toBeGreaterThan(0);

      // Flatten all events
      const allNodeCompletedEvents = completedEvents.flatMap((e) =>
        e.data.filter((event: any) => event.type === 'node-completed')
      );

      expect(allNodeCompletedEvents.length).toBe(2);

      // Verify each has correct messages
      const task1Event = allNodeCompletedEvents.find(
        (e: any) => e.data.taskId === task1Id
      );
      const task2Event = allNodeCompletedEvents.find(
        (e: any) => e.data.taskId === task2Id
      );

      expect(task1Event?.data.aiMessages).toEqual(aiMessages1);
      expect(task2Event?.data.aiMessages).toEqual(aiMessages2);
    });

    test('should preserve aiMessages through priority buffering', async () => {
      const nodeName = 'EngineerNode';
      const taskId = 'TASK-005';
      const aiMessages = [
        {
          type: 'assistant',
          content: [{ type: 'text', text: 'Priority test' }],
        },
      ];

      // Fill buffer with other events to test priority handling
      for (let i = 0; i < 50; i++) {
        await manager.notifyNodeExecution(
          'OtherNode',
          'started',
          undefined,
          `OTHER-${i}`
        );
      }

      // Add high-priority completed event with AI messages
      await manager.notifyNodeExecution(nodeName, 'started', undefined, taskId);
      await manager.notifyNodeExecution(
        nodeName,
        'completed',
        undefined,
        taskId,
        aiMessages
      );

      await new Promise((resolve) => setTimeout(resolve, 150));

      // Find the completed event
      const completedEvents = sentEvents.filter(
        (e) =>
          e.channel === 'graph-events-batch' &&
          e.data.some(
            (event: any) =>
              event.type === 'node-completed' && event.data.taskId === taskId
          )
      );

      expect(completedEvents.length).toBeGreaterThan(0);

      const batchData = completedEvents[0].data;
      const nodeCompletedEvent = batchData.find(
        (event: any) =>
          event.type === 'node-completed' && event.data.taskId === taskId
      );

      // AI messages should be preserved despite buffering
      expect(nodeCompletedEvent.data.aiMessages).toEqual(aiMessages);
    });

    test('should handle very large AI message arrays', async () => {
      const nodeName = 'EngineerNode';
      const taskId = 'TASK-006';

      // Create a large array of messages (100 messages)
      const aiMessages = Array.from({ length: 100 }, (_, i) => ({
        type: 'assistant',
        content: [
          {
            type: 'text',
            text: `Message ${i}`,
          },
        ],
      }));

      await manager.notifyNodeExecution(nodeName, 'started', undefined, taskId);
      await manager.notifyNodeExecution(
        nodeName,
        'completed',
        undefined,
        taskId,
        aiMessages
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      const completedEvents = sentEvents.filter(
        (e) =>
          e.channel === 'graph-events-batch' &&
          e.data.some((event: any) => event.type === 'node-completed')
      );

      const batchData = completedEvents[0].data;
      const nodeCompletedEvent = batchData.find(
        (event: any) => event.type === 'node-completed'
      );

      expect(nodeCompletedEvent.data.aiMessages).toHaveLength(100);
      expect(nodeCompletedEvent.data.aiMessages[0].content[0].text).toBe(
        'Message 0'
      );
      expect(nodeCompletedEvent.data.aiMessages[99].content[0].text).toBe(
        'Message 99'
      );
    });

    test('should handle messages with complex nested structures', async () => {
      const nodeName = 'EngineerNode';
      const taskId = 'TASK-007';

      const aiMessages = [
        {
          type: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Complex message',
            },
            {
              type: 'tool_use',
              name: 'Read',
              input: {
                file_path: '/test.ts',
                options: {
                  encoding: 'utf-8',
                  nested: {
                    deep: {
                      value: 'test',
                    },
                  },
                },
              },
            },
          ],
          metadata: {
            timestamp: Date.now(),
            tokens: {
              input: 1000,
              output: 500,
            },
          },
        },
      ];

      await manager.notifyNodeExecution(nodeName, 'started', undefined, taskId);
      await manager.notifyNodeExecution(
        nodeName,
        'completed',
        undefined,
        taskId,
        aiMessages
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      const completedEvents = sentEvents.filter(
        (e) =>
          e.channel === 'graph-events-batch' &&
          e.data.some((event: any) => event.type === 'node-completed')
      );

      const batchData = completedEvents[0].data;
      const nodeCompletedEvent = batchData.find(
        (event: any) => event.type === 'node-completed'
      );

      // Deep equality check
      expect(nodeCompletedEvent.data.aiMessages).toEqual(aiMessages);
      expect(nodeCompletedEvent.data.aiMessages[0].content[1].input.options.nested.deep.value).toBe('test');
    });
  });

  describe('Edge Cases', () => {
    test('should handle failed node with aiMessages', async () => {
      const nodeName = 'EngineerNode';
      const taskId = 'TASK-FAIL';
      const aiMessages = [
        {
          type: 'assistant',
          content: [{ type: 'text', text: 'Failed attempt' }],
        },
      ];

      await manager.notifyNodeExecution(nodeName, 'started', undefined, taskId);
      await manager.notifyNodeExecution(
        nodeName,
        'failed',
        undefined,
        taskId,
        aiMessages
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      const completedEvents = sentEvents.filter(
        (e) =>
          e.channel === 'graph-events-batch' &&
          e.data.some((event: any) => event.type === 'node-completed')
      );

      const batchData = completedEvents[0].data;
      const nodeCompletedEvent = batchData.find(
        (event: any) => event.type === 'node-completed'
      );

      expect(nodeCompletedEvent.data.status).toBe('failed');
      expect(nodeCompletedEvent.data.aiMessages).toEqual(aiMessages);
    });

    test('should not crash with malformed aiMessages', async () => {
      const nodeName = 'EngineerNode';
      const taskId = 'TASK-MALFORMED';

      // @ts-expect-error Testing malformed data
      const malformedMessages = [
        null,
        undefined,
        { type: 'invalid' },
        'string message',
        123,
        { circular: null as any },
      ];

      // Create circular reference
      malformedMessages[5].circular = malformedMessages[5];

      await manager.notifyNodeExecution(nodeName, 'started', undefined, taskId);

      // Should not throw
      await expect(async () => {
        await manager.notifyNodeExecution(
          nodeName,
          'completed',
          undefined,
          taskId,
          malformedMessages as any
        );
      }).not.toThrow();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Event should still be sent (even if messages are malformed)
      const completedEvents = sentEvents.filter(
        (e) =>
          e.channel === 'graph-events-batch' &&
          e.data.some((event: any) => event.type === 'node-completed')
      );

      expect(completedEvents.length).toBeGreaterThan(0);
    });
  });
});
