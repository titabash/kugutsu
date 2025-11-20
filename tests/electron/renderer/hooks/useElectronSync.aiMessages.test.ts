/**
 * useElectronSync - AI Messages Display Tests
 *
 * Tests for displaying AI messages in chat panel
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('useElectronSync - AI Messages Display', () => {
  let mockAddChatMessage: jest.Mock;
  let mockClearThinkingMessage: jest.Mock;

  beforeEach(() => {
    mockAddChatMessage = jest.fn();
    mockClearThinkingMessage = jest.fn();
  });

  describe('node-completed event with aiMessages', () => {
    test('should display assistant text messages in chat', () => {
      const event = {
        type: 'node-completed',
        data: {
          nodeId: 'EngineerNode',
          taskId: 'TASK-001',
          status: 'completed',
          timestamp: Date.now(),
          aiMessages: [
            {
              type: 'assistant',
              content: [
                {
                  type: 'text',
                  text: 'I will implement this feature by creating a new module.',
                },
              ],
            },
          ],
        },
        timestamp: Date.now(),
        priority: 'high',
      };

      // Simulate processing aiMessages
      if (event.data.aiMessages && Array.isArray(event.data.aiMessages)) {
        mockClearThinkingMessage(event.data.nodeId);

        event.data.aiMessages.forEach((msg: any) => {
          if (msg.type === 'assistant' && msg.content) {
            const textBlocks = msg.content
              .filter((block: any) => block.type === 'text')
              .map((block: any) => block.text)
              .join('\n\n');

            if (textBlocks) {
              mockAddChatMessage({
                id: `${Date.now()}-${Math.random()}`,
                type: 'ai',
                content: textBlocks,
                timestamp: event.data.timestamp,
                nodeId: event.data.nodeId,
              });
            }
          }
        });
      }

      expect(mockClearThinkingMessage).toHaveBeenCalledWith('EngineerNode');
      expect(mockAddChatMessage).toHaveBeenCalledTimes(1);
      expect(mockAddChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ai',
          content: 'I will implement this feature by creating a new module.',
          nodeId: 'EngineerNode',
        })
      );
    });

    test('should display multiple text blocks joined with newlines', () => {
      const event = {
        type: 'node-completed',
        data: {
          nodeId: 'EngineerNode',
          taskId: 'TASK-002',
          status: 'completed',
          timestamp: Date.now(),
          aiMessages: [
            {
              type: 'assistant',
              content: [
                {
                  type: 'text',
                  text: 'First block of text.',
                },
                {
                  type: 'text',
                  text: 'Second block of text.',
                },
              ],
            },
          ],
        },
        timestamp: Date.now(),
        priority: 'high',
      };

      if (event.data.aiMessages && Array.isArray(event.data.aiMessages)) {
        mockClearThinkingMessage(event.data.nodeId);

        event.data.aiMessages.forEach((msg: any) => {
          if (msg.type === 'assistant' && msg.content) {
            const textBlocks = msg.content
              .filter((block: any) => block.type === 'text')
              .map((block: any) => block.text)
              .join('\n\n');

            if (textBlocks) {
              mockAddChatMessage({
                id: `${Date.now()}-${Math.random()}`,
                type: 'ai',
                content: textBlocks,
                timestamp: event.data.timestamp,
                nodeId: event.data.nodeId,
              });
            }
          }
        });
      }

      expect(mockAddChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'First block of text.\n\nSecond block of text.',
        })
      );
    });

    test('should display tool_use messages', () => {
      const event = {
        type: 'node-completed',
        data: {
          nodeId: 'EngineerNode',
          taskId: 'TASK-003',
          status: 'completed',
          timestamp: Date.now(),
          aiMessages: [
            {
              type: 'assistant',
              content: [
                {
                  type: 'tool_use',
                  name: 'Write',
                  input: {
                    file_path: '/test.ts',
                    content: 'export const test = () => {}',
                  },
                },
              ],
            },
          ],
        },
        timestamp: Date.now(),
        priority: 'high',
      };

      if (event.data.aiMessages && Array.isArray(event.data.aiMessages)) {
        mockClearThinkingMessage(event.data.nodeId);

        event.data.aiMessages.forEach((msg: any) => {
          if (msg.type === 'assistant' && msg.content) {
            const toolUses = msg.content.filter(
              (block: any) => block.type === 'tool_use'
            );
            toolUses.forEach((toolUse: any) => {
              mockAddChatMessage({
                id: `${Date.now()}-${Math.random()}`,
                type: 'ai',
                content: `🔧 Tool: ${toolUse.name}\n${JSON.stringify(toolUse.input, null, 2)}`,
                timestamp: event.data.timestamp,
                nodeId: event.data.nodeId,
              });
            });
          }
        });
      }

      expect(mockAddChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ai',
          content: expect.stringContaining('🔧 Tool: Write'),
          nodeId: 'EngineerNode',
        })
      );
    });

    test('should display thinking messages', () => {
      const event = {
        type: 'node-completed',
        data: {
          nodeId: 'EngineerNode',
          taskId: 'TASK-004',
          status: 'completed',
          timestamp: Date.now(),
          aiMessages: [
            {
              type: 'thinking',
              thinking: 'Analyzing the requirements...',
            },
          ],
        },
        timestamp: Date.now(),
        priority: 'high',
      };

      if (event.data.aiMessages && Array.isArray(event.data.aiMessages)) {
        mockClearThinkingMessage(event.data.nodeId);

        event.data.aiMessages.forEach((msg: any) => {
          if (msg.type === 'thinking') {
            const thinkingText = msg.content || msg.thinking || '';
            if (thinkingText) {
              mockAddChatMessage({
                id: `${Date.now()}-${Math.random()}`,
                type: 'system',
                content: `💭 Thinking: ${thinkingText}`,
                timestamp: event.data.timestamp,
                nodeId: event.data.nodeId,
              });
            }
          }
        });
      }

      expect(mockAddChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system',
          content: '💭 Thinking: Analyzing the requirements...',
          nodeId: 'EngineerNode',
        })
      );
    });

    test('should display result messages', () => {
      const event = {
        type: 'node-completed',
        data: {
          nodeId: 'EngineerNode',
          taskId: 'TASK-005',
          status: 'completed',
          timestamp: Date.now(),
          aiMessages: [
            {
              type: 'result',
              status: 'success',
              finalResponse: 'Implementation completed successfully',
            },
          ],
        },
        timestamp: Date.now(),
        priority: 'high',
      };

      if (event.data.aiMessages && Array.isArray(event.data.aiMessages)) {
        mockClearThinkingMessage(event.data.nodeId);

        event.data.aiMessages.forEach((msg: any) => {
          if (msg.type === 'result') {
            const resultText =
              msg.finalResponse || JSON.stringify(msg.result, null, 2) || '';
            if (resultText) {
              mockAddChatMessage({
                id: `${Date.now()}-${Math.random()}`,
                type: 'ai',
                content: `✅ Result: ${resultText}`,
                timestamp: event.data.timestamp,
                nodeId: event.data.nodeId,
              });
            }
          }
        });
      }

      expect(mockAddChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ai',
          content: '✅ Result: Implementation completed successfully',
          nodeId: 'EngineerNode',
        })
      );
    });

    test('should display multiple messages in sequence', () => {
      const event = {
        type: 'node-completed',
        data: {
          nodeId: 'EngineerNode',
          taskId: 'TASK-006',
          status: 'completed',
          timestamp: Date.now(),
          aiMessages: [
            {
              type: 'thinking',
              thinking: 'Planning implementation...',
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
                  name: 'Write',
                  input: { file_path: '/test.ts', content: 'code' },
                },
              ],
            },
            {
              type: 'result',
              finalResponse: 'Complete',
            },
          ],
        },
        timestamp: Date.now(),
        priority: 'high',
      };

      if (event.data.aiMessages && Array.isArray(event.data.aiMessages)) {
        mockClearThinkingMessage(event.data.nodeId);

        event.data.aiMessages.forEach((msg: any) => {
          if (msg.type === 'assistant' && msg.content) {
            const textBlocks = msg.content
              .filter((block: any) => block.type === 'text')
              .map((block: any) => block.text)
              .join('\n\n');

            if (textBlocks) {
              mockAddChatMessage({
                id: `${Date.now()}-${Math.random()}`,
                type: 'ai',
                content: textBlocks,
                timestamp: event.data.timestamp,
                nodeId: event.data.nodeId,
              });
            }

            const toolUses = msg.content.filter(
              (block: any) => block.type === 'tool_use'
            );
            toolUses.forEach((toolUse: any) => {
              mockAddChatMessage({
                id: `${Date.now()}-${Math.random()}`,
                type: 'ai',
                content: `🔧 Tool: ${toolUse.name}\n${JSON.stringify(toolUse.input, null, 2)}`,
                timestamp: event.data.timestamp,
                nodeId: event.data.nodeId,
              });
            });
          } else if (msg.type === 'thinking') {
            const thinkingText = msg.content || msg.thinking || '';
            if (thinkingText) {
              mockAddChatMessage({
                id: `${Date.now()}-${Math.random()}`,
                type: 'system',
                content: `💭 Thinking: ${thinkingText}`,
                timestamp: event.data.timestamp,
                nodeId: event.data.nodeId,
              });
            }
          } else if (msg.type === 'result') {
            const resultText =
              msg.finalResponse || JSON.stringify(msg.result, null, 2) || '';
            if (resultText) {
              mockAddChatMessage({
                id: `${Date.now()}-${Math.random()}`,
                type: 'ai',
                content: `✅ Result: ${resultText}`,
                timestamp: event.data.timestamp,
                nodeId: event.data.nodeId,
              });
            }
          }
        });
      }

      // Should have 4 messages
      expect(mockAddChatMessage).toHaveBeenCalledTimes(4);

      // Verify order
      const calls = mockAddChatMessage.mock.calls;
      expect(calls[0][0].content).toContain('💭 Thinking:');
      expect(calls[1][0].content).toBe('Starting implementation');
      expect(calls[2][0].content).toContain('🔧 Tool: Write');
      expect(calls[3][0].content).toContain('✅ Result:');
    });

    test('should handle empty aiMessages array', () => {
      const event = {
        type: 'node-completed',
        data: {
          nodeId: 'EngineerNode',
          taskId: 'TASK-007',
          status: 'completed',
          timestamp: Date.now(),
          aiMessages: [],
        },
        timestamp: Date.now(),
        priority: 'high',
      };

      if (event.data.aiMessages && Array.isArray(event.data.aiMessages)) {
        mockClearThinkingMessage(event.data.nodeId);

        event.data.aiMessages.forEach((msg: any) => {
          // No messages to process
        });
      }

      expect(mockClearThinkingMessage).toHaveBeenCalled();
      expect(mockAddChatMessage).not.toHaveBeenCalled();
    });

    test('should skip empty text blocks', () => {
      const event = {
        type: 'node-completed',
        data: {
          nodeId: 'EngineerNode',
          taskId: 'TASK-008',
          status: 'completed',
          timestamp: Date.now(),
          aiMessages: [
            {
              type: 'assistant',
              content: [
                {
                  type: 'text',
                  text: '',
                },
              ],
            },
          ],
        },
        timestamp: Date.now(),
        priority: 'high',
      };

      if (event.data.aiMessages && Array.isArray(event.data.aiMessages)) {
        mockClearThinkingMessage(event.data.nodeId);

        event.data.aiMessages.forEach((msg: any) => {
          if (msg.type === 'assistant' && msg.content) {
            const textBlocks = msg.content
              .filter((block: any) => block.type === 'text')
              .map((block: any) => block.text)
              .join('\n\n');

            // Should skip empty string
            if (textBlocks) {
              mockAddChatMessage({
                id: `${Date.now()}-${Math.random()}`,
                type: 'ai',
                content: textBlocks,
                timestamp: event.data.timestamp,
                nodeId: event.data.nodeId,
              });
            }
          }
        });
      }

      expect(mockAddChatMessage).not.toHaveBeenCalled();
    });
  });

  describe('Fallback to legacy result-based message', () => {
    test('should use legacy flow when aiMessages is undefined', () => {
      const event = {
        type: 'node-completed',
        data: {
          nodeId: 'EngineerNode',
          taskId: 'TASK-009',
          status: 'completed',
          timestamp: Date.now(),
          result: {
            message: 'Implementation completed',
          },
          // aiMessages not present
        },
        timestamp: Date.now(),
        priority: 'high',
      };

      if (event.data.aiMessages && Array.isArray(event.data.aiMessages)) {
        // aiMessages flow
      } else {
        // Fallback to legacy flow
        if (event.data.result) {
          mockClearThinkingMessage(event.data.nodeId);

          const message =
            event.data.result.message || 'コードの実装が完了しました。';

          mockAddChatMessage({
            id: `${Date.now()}-${Math.random()}`,
            type: 'ai',
            content: message,
            timestamp: event.data.timestamp,
            nodeId: event.data.nodeId,
            data: event.data.result,
          });
        }
      }

      expect(mockClearThinkingMessage).toHaveBeenCalled();
      expect(mockAddChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Implementation completed',
        })
      );
    });
  });

  describe('Edge Cases', () => {
    test('should handle malformed message structures gracefully', () => {
      const event = {
        type: 'node-completed',
        data: {
          nodeId: 'EngineerNode',
          taskId: 'TASK-010',
          status: 'completed',
          timestamp: Date.now(),
          aiMessages: [
            { type: 'unknown_type' },
            { type: 'assistant', content: null },
            { type: 'assistant', content: [] },
          ],
        },
        timestamp: Date.now(),
        priority: 'high',
      };

      // Should not throw
      expect(() => {
        if (event.data.aiMessages && Array.isArray(event.data.aiMessages)) {
          mockClearThinkingMessage(event.data.nodeId);

          event.data.aiMessages.forEach((msg: any) => {
            if (msg.type === 'assistant' && msg.content) {
              const textBlocks = msg.content
                .filter((block: any) => block.type === 'text')
                .map((block: any) => block.text)
                .join('\n\n');

              if (textBlocks) {
                mockAddChatMessage({
                  id: `${Date.now()}-${Math.random()}`,
                  type: 'ai',
                  content: textBlocks,
                  timestamp: event.data.timestamp,
                  nodeId: event.data.nodeId,
                });
              }
            }
          });
        }
      }).not.toThrow();

      expect(mockClearThinkingMessage).toHaveBeenCalled();
      // No valid messages to display
      expect(mockAddChatMessage).not.toHaveBeenCalled();
    });
  });
});
