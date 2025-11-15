import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MessageHandler, type ErrorDetails } from '../../src/utils/MessageHandler.js';
import type { AIMessage } from '../../src/providers/IAIProvider.js';

describe('MessageHandler', () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;
  let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;

  beforeEach(() => {
    // Console spies
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('Error handling', () => {
    it('should extract error messages from errors array', async () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        taskId: 'test-001',
      });

      // Claude Agent SDK の実際のエラーレスポンス形式
      const errorMessage: AIMessage = {
        type: 'result',
        content: {
          success: false,
          subtype: 'error_during_execution',
          errors: ['File not found: test.txt', 'Permission denied'],
          duration: 1000,
        },
      };

      await handler.handleMessage(errorMessage);

      expect(handler.getHasError()).toBe(true);

      const details = handler.getErrorDetails();
      expect(details).toBeDefined();
      expect(details?.subtype).toBe('error_during_execution');
      expect(details?.message).toBe('File not found: test.txt; Permission denied');
      expect(details?.errors).toEqual(['File not found: test.txt', 'Permission denied']);
    });

    it('should handle error_max_turns subtype', async () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        taskId: 'test-002',
      });

      const errorMessage: AIMessage = {
        type: 'result',
        content: {
          success: false,
          subtype: 'error_max_turns',
          errors: ['Maximum turns reached'],
          duration: 2000,
        },
      };

      await handler.handleMessage(errorMessage);

      expect(handler.getHasError()).toBe(true);

      const details = handler.getErrorDetails();
      expect(details?.subtype).toBe('error_max_turns');
      expect(details?.message).toBe('Maximum turns reached');
    });

    it('should handle error_max_budget_usd subtype', async () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        taskId: 'test-003',
      });

      const errorMessage: AIMessage = {
        type: 'result',
        content: {
          success: false,
          subtype: 'error_max_budget_usd',
          errors: ['Budget limit exceeded'],
          duration: 1500,
        },
      };

      await handler.handleMessage(errorMessage);

      expect(handler.getHasError()).toBe(true);

      const details = handler.getErrorDetails();
      expect(details?.subtype).toBe('error_max_budget_usd');
      expect(details?.message).toBe('Budget limit exceeded');
    });

    it('should handle empty errors array gracefully', async () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        taskId: 'test-004',
      });

      const errorMessage: AIMessage = {
        type: 'result',
        content: {
          success: false,
          subtype: 'error_during_execution',
          errors: [],
          duration: 1000,
        },
      };

      await handler.handleMessage(errorMessage);

      expect(handler.getHasError()).toBe(true);

      const details = handler.getErrorDetails();
      expect(details?.subtype).toBe('error_during_execution');
      expect(details?.message).toBe('エラーが発生しました (subtype: error_during_execution)');
      expect(details?.errors).toEqual([]);
    });

    it('should handle missing errors field', async () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        taskId: 'test-005',
      });

      const errorMessage: AIMessage = {
        type: 'result',
        content: {
          success: false,
          subtype: 'error_during_execution',
          // errors フィールドなし
          duration: 1000,
        },
      };

      await handler.handleMessage(errorMessage);

      expect(handler.getHasError()).toBe(true);

      const details = handler.getErrorDetails();
      expect(details?.message).toBe('エラーが発生しました (subtype: error_during_execution)');
    });

    it('should display error messages in handleResult', async () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        taskId: 'test-006',
      });

      const errorMessage: AIMessage = {
        type: 'result',
        content: {
          success: false,
          subtype: 'error_during_execution',
          errors: ['Network timeout', 'Connection failed'],
          duration: 1000,
        },
      };

      await handler.handleMessage(errorMessage);

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('エラー: Network timeout; Connection failed')
      );
    });

    it('should not set error for success messages', async () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        taskId: 'test-007',
      });

      const successMessage: AIMessage = {
        type: 'result',
        content: {
          success: true,
          result: 'Task completed successfully',
          duration: 1000,
          tokenUsage: { total: 100 },
        },
      };

      await handler.handleMessage(successMessage);

      expect(handler.getHasError()).toBe(false);
      expect(handler.getErrorDetails()).toBeUndefined();
    });

    it('should classify usage limit error as rate_limit even with turn_failed subtype', async () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        taskId: 'test-usage-limit-001',
      });

      const errorMessage: AIMessage = {
        type: 'result',
        content: {
          success: false,
          subtype: 'turn_failed',
          errors: ["You've hit your usage limit. Upgrade to Pro (https://openai.com/chatgpt/pricing), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at Nov 18th, 2025 1:54 PM."],
        },
      };

      await handler.handleMessage(errorMessage);

      expect(handler.getHasError()).toBe(true);

      const details = handler.getErrorDetails();
      expect(details).toBeDefined();
      expect(details?.subtype).toBe('rate_limit');
      expect(details?.message).toContain('usage limit');
    });

    it('should classify usage limit error as rate_limit even with exception subtype', async () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        taskId: 'test-usage-limit-002',
      });

      const errorMessage: AIMessage = {
        type: 'result',
        content: {
          success: false,
          subtype: 'exception',
          error: "You've hit your usage limit. Upgrade to Pro",
        },
      };

      await handler.handleMessage(errorMessage);

      expect(handler.getHasError()).toBe(true);

      const details = handler.getErrorDetails();
      expect(details).toBeDefined();
      expect(details?.subtype).toBe('rate_limit');
      expect(details?.message).toContain('usage limit');
    });

    it('should classify various usage limit patterns as rate_limit', async () => {
      const usageLimitMessages = [
        "You've hit your usage limit",
        'Upgrade to Pro',
        'purchase more credits',
        'weekly limit reached',
        'monthly limit exceeded',
        'quota exceeded',
        'subscription required',
      ];

      for (const errorMsg of usageLimitMessages) {
        const handler = new MessageHandler({
          maxTurns: 10,
          nodeName: 'TestNode',
          taskId: `test-usage-limit-${errorMsg.substring(0, 10)}`,
        });

        const errorMessage: AIMessage = {
          type: 'result',
          content: {
            success: false,
            subtype: 'turn_failed',
            errors: [errorMsg],
          },
        };

        await handler.handleMessage(errorMessage);

        expect(handler.getHasError()).toBe(true);

        const details = handler.getErrorDetails();
        expect(details?.subtype).toBe('rate_limit');
      }
    });

    it('should detect usage limit error in assistant message', async () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        taskId: 'test-usage-limit-assistant',
      });

      const assistantMessage: AIMessage = {
        type: 'assistant',
        content: "You've hit your usage limit. Upgrade to Pro to continue.",
        timestamp: new Date(),
      };

      await handler.handleMessage(assistantMessage);

      expect(handler.getHasError()).toBe(true);

      const details = handler.getErrorDetails();
      expect(details).toBeDefined();
      expect(details?.subtype).toBe('rate_limit');
      expect(details?.message).toContain('usage limit');
    });

    it('should not classify non-usage-limit errors as rate_limit', async () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        taskId: 'test-non-usage-limit',
      });

      const errorMessage: AIMessage = {
        type: 'result',
        content: {
          success: false,
          subtype: 'turn_failed',
          errors: ['File not found: test.txt'],
        },
      };

      await handler.handleMessage(errorMessage);

      expect(handler.getHasError()).toBe(true);

      const details = handler.getErrorDetails();
      expect(details).toBeDefined();
      expect(details?.subtype).toBe('turn_failed'); // Should remain turn_failed, not rate_limit
    });
  });

  describe('Complete method', () => {
    it('should skip complete() when error is detected', () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        taskId: 'test-008',
      });

      // Simulate error detection (internal state)
      const errorMessage: AIMessage = {
        type: 'result',
        content: {
          success: false,
          subtype: 'error_during_execution',
          errors: ['Test error'],
          duration: 1000,
        },
      };

      handler.handleMessage(errorMessage);

      // Clear previous console logs
      consoleLogSpy.mockClear();

      // Call complete - should be skipped
      handler.complete(true, 'This should not be displayed');

      // Verify complete message was not logged
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('正常完了')
      );
    });
  });

  describe('completeWithErrorCheck method', () => {
    it('should call complete() when no error is detected', () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        taskId: 'test-complete-no-error',
      });

      // No error - should complete successfully
      handler.completeWithErrorCheck('タスク完了');

      // Verify complete message was logged
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('正常完了')
      );
    });

    it('should throw error with error_max_turns message', async () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        taskId: 'test-complete-max-turns',
      });

      // Simulate error_max_turns
      const errorMessage: AIMessage = {
        type: 'result',
        content: {
          success: false,
          subtype: 'error_max_turns',
          errors: ['Maximum turns reached'],
          duration: 1000,
        },
      };

      await handler.handleMessage(errorMessage);

      // Should throw with appropriate message
      expect(() => {
        handler.completeWithErrorCheck('タスク完了', 'TestNode');
      }).toThrow('TestNodeエラー: AI実行がmaxTurns制限に到達しました: Maximum turns reached');
    });

    it('should throw error with error_during_execution message', async () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        taskId: 'test-complete-execution-error',
      });

      // Simulate error_during_execution
      const errorMessage: AIMessage = {
        type: 'result',
        content: {
          success: false,
          subtype: 'error_during_execution',
          errors: ['File not found', 'Permission denied'],
          duration: 1000,
        },
      };

      await handler.handleMessage(errorMessage);

      // Should throw with appropriate message
      expect(() => {
        handler.completeWithErrorCheck('タスク完了');
      }).toThrow('AI実行中にエラーが発生しました: File not found; Permission denied');
    });

    it('should include nodeName in error message when provided', async () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        taskId: 'test-complete-with-nodename',
      });

      // Simulate error
      const errorMessage: AIMessage = {
        type: 'result',
        content: {
          success: false,
          subtype: 'error_during_execution',
          errors: ['Test error'],
          duration: 1000,
        },
      };

      await handler.handleMessage(errorMessage);

      // Should throw with nodeName prefix
      expect(() => {
        handler.completeWithErrorCheck('タスク完了', 'ProductOwner');
      }).toThrow('ProductOwnerエラー:');
    });

    it('should handle error with errors array', async () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        taskId: 'test-complete-errors-array',
      });

      // Simulate error with multiple errors
      const errorMessage: AIMessage = {
        type: 'result',
        content: {
          success: false,
          subtype: 'error_during_execution',
          errors: ['Error 1', 'Error 2', 'Error 3'],
          duration: 1000,
        },
      };

      await handler.handleMessage(errorMessage);

      // Should throw with joined errors
      expect(() => {
        handler.completeWithErrorCheck('タスク完了');
      }).toThrow('AI実行中にエラーが発生しました: Error 1; Error 2; Error 3');
    });

    it('should handle error with unknown subtype', async () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        taskId: 'test-complete-unknown-subtype',
      });

      // Simulate error with unknown subtype (empty errors array triggers fallback message)
      const errorMessage: AIMessage = {
        type: 'result',
        content: {
          success: false,
          subtype: 'unknown_error',
          errors: [],
          duration: 1000,
        },
      };

      await handler.handleMessage(errorMessage);

      // Should throw with error message that includes the subtype
      expect(() => {
        handler.completeWithErrorCheck('タスク完了');
      }).toThrow('エラーが発生しました (subtype: unknown_error)');
    });

    it('should handle error with missing message and errors', async () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        taskId: 'test-complete-missing-details',
      });

      // Simulate error with no errors field (message will be auto-generated)
      const errorMessage: AIMessage = {
        type: 'result',
        content: {
          success: false,
          subtype: 'error_during_execution',
          duration: 1000,
        },
      };

      await handler.handleMessage(errorMessage);

      // Should throw with auto-generated message
      expect(() => {
        handler.completeWithErrorCheck('タスク完了');
      }).toThrow('エラーが発生しました (subtype: error_during_execution)');
    });
  });
});
