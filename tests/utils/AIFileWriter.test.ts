/**
 * AIFileWriter Unit Tests (Jest)
 *
 * 特に以下をテスト：
 * - MessageHandlerによるエラー検知
 * - ファイル書き込み失敗時の例外スロー
 * - 成功時の完了メッセージ
 */

import { jest } from '@jest/globals';

// Mock MessageHandler
const mockHandleMessage = jest.fn<any>();
const mockGetHasError = jest.fn<any>();
const mockGetErrorDetails = jest.fn<any>();
const mockComplete = jest.fn<any>();

const MockMessageHandler = jest.fn<any>().mockImplementation(() => ({
  handleMessage: mockHandleMessage,
  getHasError: mockGetHasError,
  getErrorDetails: mockGetErrorDetails,
  complete: mockComplete,
}));

jest.unstable_mockModule('../../src/utils/MessageHandler.js', () => ({
  MessageHandler: MockMessageHandler,
}));

// Import after mocking
const { AIFileWriter } = await import('../../src/utils/AIFileWriter.js');

describe('AIFileWriter', () => {
  const mockProvider: any = {
    execute: jest.fn<any>(),
    getName: jest.fn<any>().mockReturnValue('mock-provider'),
    resumeSession: jest.fn<any>(),
    getSupportedTools: jest.fn<any>().mockReturnValue(['Write']),
    getProviderName: jest.fn<any>().mockReturnValue('mock'),
    getModel: jest.fn<any>().mockReturnValue('mock-model'),
    isReady: jest.fn<any>().mockReturnValue(true),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetHasError.mockReturnValue(false);
    mockGetErrorDetails.mockReturnValue(null);
  });

  describe('成功ケース', () => {
    test('should write file successfully when no errors', async () => {
      const filePath = 'test/file.json';
      const content = { key: 'value' };
      const cwd = '/test/repo';

      // Mock successful AI response
      mockProvider.execute.mockReturnValue((async function* () {
        yield {
          type: 'tool_use',
          tool: 'Write',
          input: { file_path: filePath, content: JSON.stringify(content, null, 2) },
        };
        yield {
          type: 'tool_result',
          status: 'success',
        };
        yield {
          type: 'result',
          status: 'success',
          input_tokens: 100,
          output_tokens: 50,
        };
      })());

      // Execute
      await expect(
        AIFileWriter.writeFile(mockProvider, filePath, content, cwd, 3)
      ).resolves.not.toThrow();

      // Verify
      expect(mockProvider.execute).toHaveBeenCalledWith(
        expect.stringContaining(filePath),
        expect.objectContaining({
          maxTurns: 3,
          cwd,
          allowedTools: ['Write'],
          permissionMode: 'acceptEdits',
          includePartialMessages: true,
        })
      );

      expect(mockHandleMessage).toHaveBeenCalled();
      expect(mockGetHasError).toHaveBeenCalled();
      expect(mockComplete).toHaveBeenCalledWith(true, expect.stringContaining(filePath));
    });

    test('should handle string content', async () => {
      const filePath = 'test/file.txt';
      const content = 'Plain text content';
      const cwd = '/test/repo';

      mockProvider.execute.mockReturnValue((async function* () {
        yield {
          type: 'result',
          status: 'success',
          input_tokens: 100,
          output_tokens: 50,
        };
      })());

      await AIFileWriter.writeFile(mockProvider, filePath, content, cwd, 3);

      // Verify that prompt contains the string content
      expect(mockProvider.execute).toHaveBeenCalledWith(
        expect.stringContaining('Plain text content'),
        expect.any(Object)
      );
    });

    test('should handle object content by JSON stringifying', async () => {
      const filePath = 'test/data.json';
      const content = { nested: { key: 'value' }, array: [1, 2, 3] };
      const cwd = '/test/repo';

      mockProvider.execute.mockReturnValue((async function* () {
        yield {
          type: 'result',
          status: 'success',
          input_tokens: 100,
          output_tokens: 50,
        };
      })());

      await AIFileWriter.writeFile(mockProvider, filePath, content, cwd, 3);

      // Verify that prompt contains JSON stringified content
      expect(mockProvider.execute).toHaveBeenCalledWith(
        expect.stringContaining('"nested"'),
        expect.any(Object)
      );
      expect(mockProvider.execute).toHaveBeenCalledWith(
        expect.stringContaining('"array"'),
        expect.any(Object)
      );
    });
  });

  describe('エラーケース', () => {
    test('should throw error when MessageHandler detects error', async () => {
      const filePath = 'test/file.json';
      const content = { key: 'value' };
      const cwd = '/test/repo';

      // Mock AI response with error
      mockProvider.execute.mockReturnValue((async function* () {
        yield {
          type: 'tool_use',
          tool: 'Write',
          input: { file_path: filePath, content: JSON.stringify(content, null, 2) },
        };
        yield {
          type: 'tool_result',
          status: 'error',
          error: 'Permission denied',
        };
        yield {
          type: 'result',
          status: 'error',
          input_tokens: 100,
          output_tokens: 50,
        };
      })());

      // Mock MessageHandler detecting error
      mockGetHasError.mockReturnValue(true);
      mockGetErrorDetails.mockReturnValue({
        message: 'Permission denied',
        type: 'tool_error',
      });

      // Execute and expect error
      await expect(
        AIFileWriter.writeFile(mockProvider, filePath, content, cwd, 3)
      ).rejects.toThrow(`ファイル書き込みに失敗: ${filePath} - Permission denied`);

      // Verify error detection
      expect(mockGetHasError).toHaveBeenCalled();
      expect(mockGetErrorDetails).toHaveBeenCalled();
      expect(mockComplete).not.toHaveBeenCalled(); // Should not call complete on error
    });

    test('should throw error with generic message when error details unavailable', async () => {
      const filePath = 'test/file.json';
      const content = { key: 'value' };
      const cwd = '/test/repo';

      mockProvider.execute.mockReturnValue((async function* () {
        yield {
          type: 'result',
          status: 'error',
          input_tokens: 100,
          output_tokens: 50,
        };
      })());

      // Mock MessageHandler detecting error but no details
      mockGetHasError.mockReturnValue(true);
      mockGetErrorDetails.mockReturnValue(null);

      await expect(
        AIFileWriter.writeFile(mockProvider, filePath, content, cwd, 3)
      ).rejects.toThrow(`ファイル書き込みに失敗: ${filePath} - Unknown error`);
    });

    test('should handle multiple error messages', async () => {
      const filePath = 'test/file.json';
      const content = { key: 'value' };
      const cwd = '/test/repo';

      mockProvider.execute.mockReturnValue((async function* () {
        yield {
          type: 'error',
          error: 'First error',
        };
        yield {
          type: 'error',
          error: 'Second error',
        };
        yield {
          type: 'result',
          status: 'error',
          input_tokens: 100,
          output_tokens: 50,
        };
      })());

      mockGetHasError.mockReturnValue(true);
      mockGetErrorDetails.mockReturnValue({
        message: 'First error',
        type: 'execution_error',
      });

      await expect(
        AIFileWriter.writeFile(mockProvider, filePath, content, cwd, 3)
      ).rejects.toThrow('First error');
    });
  });

  describe('プロンプト生成', () => {
    test('should generate correct prompt with file path and content', async () => {
      const filePath = '.kugutsu/test.json';
      const content = { test: 'data' };
      const cwd = '/test/repo';

      let capturedPrompt = '';
      mockProvider.execute.mockImplementation((prompt: string) => {
        capturedPrompt = prompt;
        return (async function* () {
          yield {
            type: 'result',
            status: 'success',
            input_tokens: 100,
            output_tokens: 50,
          };
        })();
      });

      await AIFileWriter.writeFile(mockProvider, filePath, content, cwd, 3);

      // Verify prompt contains key information
      expect(capturedPrompt).toContain(filePath);
      expect(capturedPrompt).toContain('Writeツール');
      expect(capturedPrompt).toContain('"test"');
      expect(capturedPrompt).toContain('"data"');
      expect(capturedPrompt).toContain('正確に');
    });
  });

  describe('MessageHandler統合', () => {
    test('should create MessageHandler with correct config', async () => {
      const filePath = 'test/file.json';
      const content = { key: 'value' };
      const cwd = '/test/repo';
      const maxTurns = 5;

      mockProvider.execute.mockReturnValue((async function* () {
        yield {
          type: 'result',
          status: 'success',
          input_tokens: 100,
          output_tokens: 50,
        };
      })());

      await AIFileWriter.writeFile(mockProvider, filePath, content, cwd, maxTurns);

      // Verify MessageHandler was created with correct config
      expect(MockMessageHandler).toHaveBeenCalledWith({
        maxTurns,
        nodeName: `AIFileWriter - ${filePath}`,
      });
    });

    test('should call handleMessage for each AI response message', async () => {
      const filePath = 'test/file.json';
      const content = { key: 'value' };
      const cwd = '/test/repo';

      const messages = [
        { type: 'text', text: 'Starting write' },
        { type: 'tool_use', tool: 'Write', input: {} },
        { type: 'tool_result', status: 'success' },
        { type: 'result', status: 'success', input_tokens: 100, output_tokens: 50 },
      ];

      mockProvider.execute.mockReturnValue((async function* () {
        for (const msg of messages) {
          yield msg;
        }
      })());

      await AIFileWriter.writeFile(mockProvider, filePath, content, cwd, 3);

      // Verify handleMessage was called for each message
      expect(mockHandleMessage).toHaveBeenCalledTimes(messages.length);
      for (const msg of messages) {
        expect(mockHandleMessage).toHaveBeenCalledWith(msg);
      }
    });
  });

  describe('デフォルトパラメータ', () => {
    test('should use default maxTurns of 3 when not specified', async () => {
      const filePath = 'test/file.json';
      const content = { key: 'value' };
      const cwd = '/test/repo';

      mockProvider.execute.mockReturnValue((async function* () {
        yield {
          type: 'result',
          status: 'success',
          input_tokens: 100,
          output_tokens: 50,
        };
      })());

      await AIFileWriter.writeFile(mockProvider, filePath, content, cwd);

      // Verify default maxTurns was used
      expect(MockMessageHandler).toHaveBeenCalledWith({
        maxTurns: 3,
        nodeName: `AIFileWriter - ${filePath}`,
      });

      expect(mockProvider.execute).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          maxTurns: 3,
        })
      );
    });
  });
});
