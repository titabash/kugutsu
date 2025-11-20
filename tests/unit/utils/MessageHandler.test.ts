/**
 * MessageHandler Tests
 *
 * エラーメッセージ処理のテスト
 * 二重ネスト防止とSDK内部メッセージの変換を検証
 */

import { MessageHandler } from '../../../src/utils/MessageHandler.js';

describe('MessageHandler', () => {
  describe('completeWithErrorCheck', () => {
    it('should throw error with proper message for normal error', () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        silent: true, // ログ出力を抑制
      });

      // エラーを設定（hasErrorをtrueにする）
      // @ts-expect-error - private property access for testing
      handler.hasError = true;
      // @ts-expect-error - private property access for testing
      handler.errorDetails = {
        subtype: 'error',
        message: 'Something went wrong',
      };

      expect(() => {
        handler.completeWithErrorCheck('Success message');
      }).toThrow('AI実行中にエラーが発生しました: Something went wrong');
    });

    it('should throw error with maxTurns message when subtype is error_max_turns', () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        silent: true,
      });

      // @ts-expect-error - private property access for testing
      handler.hasError = true;
      // @ts-expect-error - private property access for testing
      handler.errorDetails = {
        subtype: 'error_max_turns',
        message: 'Turn limit reached',
      };

      expect(() => {
        handler.completeWithErrorCheck('Success message');
      }).toThrow('AI実行がmaxTurns制限に到達しました: Turn limit reached');
    });

    // ✅ 新しいテスト: 既にラップされているメッセージは再ラップしないこと
    it('should not double-wrap already wrapped error messages', () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        silent: true,
      });

      // @ts-expect-error - private property access for testing
      handler.hasError = true;
      // @ts-expect-error - private property access for testing
      handler.errorDetails = {
        subtype: 'error',
        message: 'AI実行中にエラーが発生しました: Connection failed',
      };

      expect(() => {
        handler.completeWithErrorCheck('Success message');
      }).toThrow('AI実行中にエラーが発生しました: Connection failed');

      expect(() => {
        handler.completeWithErrorCheck('Success message');
      }).not.toThrow('AI実行中にエラーが発生しました: AI実行中にエラーが発生しました:');
    });

    // ✅ 新しいテスト: "Re-connecting..." メッセージが適切に変換されること
    it('should convert "Re-connecting..." message to user-friendly message', () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        silent: true,
      });

      // @ts-expect-error - private property access for testing
      handler.hasError = true;
      // @ts-expect-error - private property access for testing
      handler.errorDetails = {
        subtype: 'error',
        message: 'Re-connecting... 1/5',
      };

      expect(() => {
        handler.completeWithErrorCheck('Success message');
      }).toThrow(/接続に失敗しました|再接続に失敗しました|接続エラー/);

      expect(() => {
        handler.completeWithErrorCheck('Success message');
      }).not.toThrow('Re-connecting...');
    });

    // ✅ 新しいテスト: "reconnecting" (小文字) メッセージも変換されること
    it('should convert "reconnecting" message to user-friendly message', () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        silent: true,
      });

      // @ts-expect-error - private property access for testing
      handler.hasError = true;
      // @ts-expect-error - private property access for testing
      handler.errorDetails = {
        subtype: 'error',
        message: 'Failed while reconnecting to server',
      };

      expect(() => {
        handler.completeWithErrorCheck('Success message');
      }).toThrow(/接続に失敗しました|再接続に失敗しました|接続エラー/);
    });

    // ✅ 新しいテスト: "connection failed" メッセージが変換されること
    it('should convert "connection failed" message to user-friendly message', () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        silent: true,
      });

      // @ts-expect-error - private property access for testing
      handler.hasError = true;
      // @ts-expect-error - private property access for testing
      handler.errorDetails = {
        subtype: 'exception',
        message: 'Connection failed to API server',
      };

      expect(() => {
        handler.completeWithErrorCheck('Success message');
      }).toThrow(/接続に失敗しました|再接続に失敗しました|接続エラー/);
    });

    it('should handle errors array properly', () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        silent: true,
      });

      // @ts-expect-error - private property access for testing
      handler.hasError = true;
      // @ts-expect-error - private property access for testing
      handler.errorDetails = {
        subtype: 'error',
        errors: ['Error 1', 'Error 2', 'Error 3'],
      };

      expect(() => {
        handler.completeWithErrorCheck('Success message');
      }).toThrow('AI実行中にエラーが発生しました: Error 1; Error 2; Error 3');
    });

    it('should include node name prefix when provided', () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        silent: true,
      });

      // @ts-expect-error - private property access for testing
      handler.hasError = true;
      // @ts-expect-error - private property access for testing
      handler.errorDetails = {
        subtype: 'error',
        message: 'Something went wrong',
      };

      expect(() => {
        handler.completeWithErrorCheck('Success message', 'CustomNode');
      }).toThrow('CustomNodeエラー: AI実行中にエラーが発生しました: Something went wrong');
    });

    it('should not throw when no error is detected', () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        silent: true,
      });

      // エラーなし（hasError = false）
      expect(() => {
        handler.completeWithErrorCheck('Success message');
      }).not.toThrow();
    });

    it('should handle missing error details gracefully', () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        silent: true,
      });

      // @ts-expect-error - private property access for testing
      handler.hasError = true;
      // @ts-expect-error - private property access for testing
      handler.errorDetails = {
        subtype: 'unknown',
        // message も errors もない
      };

      expect(() => {
        handler.completeWithErrorCheck('Success message');
      }).toThrow('AI実行中にエラーが発生しました (subtype: unknown)');
    });
  });

  describe('getHasError', () => {
    it('should return false initially', () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        silent: true,
      });

      expect(handler.getHasError()).toBe(false);
    });

    it('should return true when error is set', () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        silent: true,
      });

      // @ts-expect-error - private property access for testing
      handler.hasError = true;

      expect(handler.getHasError()).toBe(true);
    });
  });

  describe('getErrorDetails', () => {
    it('should return undefined initially', () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        silent: true,
      });

      expect(handler.getErrorDetails()).toBeUndefined();
    });

    it('should return error details when set', () => {
      const handler = new MessageHandler({
        maxTurns: 10,
        nodeName: 'TestNode',
        silent: true,
      });

      const errorDetails = {
        subtype: 'error',
        message: 'Test error',
      };

      // @ts-expect-error - private property access for testing
      handler.errorDetails = errorDetails;

      expect(handler.getErrorDetails()).toEqual(errorDetails);
    });
  });
});
