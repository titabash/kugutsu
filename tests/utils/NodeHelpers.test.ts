/**
 * Unit tests for NodeHelpers
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { executeWithAbort, checkAborted, ExecutionAbortedError } from '../../src/utils/NodeHelpers.js';
import type { IAIProvider, AIMessage, ExecuteOptions } from '../../src/providers/IAIProvider.js';
import type { ParallelDevConfig } from '../../src/graph/types.js';

describe('NodeHelpers', () => {
  describe('ExecutionAbortedError', () => {
    it('should have correct name property', () => {
      const error = new ExecutionAbortedError();
      expect(error.name).toBe('ExecutionAbortedError');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct message without nodeName', () => {
      const error = new ExecutionAbortedError();
      expect(error.message).toBe('Execution aborted by user');
    });

    it('should include nodeName in message when provided', () => {
      const error = new ExecutionAbortedError('TestNode');
      expect(error.message).toBe('Execution aborted in TestNode');
    });
  });

  describe('checkAborted', () => {
    let mockConfig: ParallelDevConfig;

    beforeEach(() => {
      mockConfig = {
        maxEngineers: 3,
        maxTurns: 10,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      };
    });

    it('should not throw when abortSignal is undefined', () => {
      expect(() => checkAborted(mockConfig)).not.toThrow();
    });

    it('should not throw when abortSignal is not aborted', () => {
      const abortController = new AbortController();
      mockConfig.abortSignal = abortController.signal;

      expect(() => checkAborted(mockConfig)).not.toThrow();
    });

    it('should throw ExecutionAbortedError when abortSignal is aborted', () => {
      const abortController = new AbortController();
      mockConfig.abortSignal = abortController.signal;
      abortController.abort();

      expect(() => checkAborted(mockConfig)).toThrow(ExecutionAbortedError);
      expect(() => checkAborted(mockConfig)).toThrow('Execution aborted by user');
    });

    it('should include nodeName in error when provided', () => {
      const abortController = new AbortController();
      mockConfig.abortSignal = abortController.signal;
      abortController.abort();

      expect(() => checkAborted(mockConfig, 'TestNode')).toThrow(ExecutionAbortedError);
      expect(() => checkAborted(mockConfig, 'TestNode')).toThrow('Execution aborted in TestNode');
    });
  });

  describe('executeWithAbort', () => {
    let mockProvider: IAIProvider;
    let mockConfig: ParallelDevConfig;
    let mockExecute: jest.MockedFunction<any>;

    beforeEach(() => {
      mockExecute = jest.fn();
      mockProvider = {
        execute: mockExecute,
        getProviderName: jest.fn(() => 'mock'),
        getModel: jest.fn(() => 'mock-model'),
        isReady: jest.fn(() => true),
        getSupportedTools: jest.fn(() => []),
        resumeSession: jest.fn(),
        getCurrentSession: jest.fn(() => null),
      } as unknown as IAIProvider;

      mockConfig = {
        maxEngineers: 3,
        maxTurns: 10,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      };
    });

    it('should automatically inject abortController into options', async () => {
      const abortController = new AbortController();
      mockConfig.abortController = abortController;

      mockExecute.mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'assistant',
            content: 'test',
          };
        },
      });

      const messages: AIMessage[] = [];
      for await (const message of executeWithAbort(
        mockProvider,
        'test prompt',
        {
          maxTurns: 5,
          cwd: '/test/path',
        },
        mockConfig
      )) {
        messages.push(message);
      }

      // Verify provider.execute was called with correct options
      expect(mockExecute).toHaveBeenCalledWith('test prompt', {
        maxTurns: 5,
        cwd: '/test/path',
        abortController,
      });

      // Verify messages were yielded
      expect(messages.length).toBe(1);
      expect(messages[0].type).toBe('assistant');
      expect(messages[0].content).toBe('test');
    });

    it('should work without abortController in config', async () => {
      // No abortController in config
      mockExecute.mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'assistant',
            content: 'test',
          };
        },
      });

      const messages: AIMessage[] = [];
      for await (const message of executeWithAbort(
        mockProvider,
        'test prompt',
        {
          maxTurns: 5,
        },
        mockConfig
      )) {
        messages.push(message);
      }

      // Verify provider.execute was called with abortController: undefined
      expect(mockExecute).toHaveBeenCalledWith('test prompt', {
        maxTurns: 5,
        abortController: undefined,
      });

      expect(messages.length).toBe(1);
    });

    it('should yield all messages from provider.execute', async () => {
      const abortController = new AbortController();
      mockConfig.abortController = abortController;

      const mockMessages: AIMessage[] = [
        { type: 'assistant', content: 'message 1' },
        { type: 'assistant', content: 'message 2' },
        { type: 'result', content: { success: true } },
      ];

      mockExecute.mockReturnValue({
        async *[Symbol.asyncIterator]() {
          for (const msg of mockMessages) {
            yield msg;
          }
        },
      });

      const messages: AIMessage[] = [];
      for await (const message of executeWithAbort(
        mockProvider,
        'test prompt',
        {},
        mockConfig
      )) {
        messages.push(message);
      }

      expect(messages).toEqual(mockMessages);
    });

    it('should preserve all original options except abortController', async () => {
      const abortController = new AbortController();
      mockConfig.abortController = abortController;

      mockExecute.mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield { type: 'assistant', content: 'test' };
        },
      });

      const originalOptions = {
        maxTurns: 20,
        cwd: '/custom/path',
        allowedTools: ['Read', 'Write'],
        permissionMode: 'acceptEdits' as const,
        includePartialMessages: true,
      };

      const messages: AIMessage[] = [];
      for await (const message of executeWithAbort(
        mockProvider,
        'test prompt',
        originalOptions,
        mockConfig
      )) {
        messages.push(message);
      }

      expect(mockExecute).toHaveBeenCalledWith('test prompt', {
        ...originalOptions,
        abortController,
      });
    });

    it('should stop iteration when aborted during execution', async () => {
      const abortController = new AbortController();
      mockConfig.abortController = abortController;

      let yieldCount = 0;
      mockExecute.mockReturnValue({
        async *[Symbol.asyncIterator]() {
          for (let i = 0; i < 10; i++) {
            if (abortController.signal.aborted) {
              return;
            }
            yieldCount++;
            yield { type: 'assistant', content: `message ${i}` };
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        },
      });

      // Start execution
      const executePromise = (async () => {
        const messages: AIMessage[] = [];
        for await (const message of executeWithAbort(
          mockProvider,
          'test prompt',
          {},
          mockConfig
        )) {
          messages.push(message);
        }
        return messages;
      })();

      // Abort after short delay
      await new Promise(resolve => setTimeout(resolve, 50));
      abortController.abort();

      const messages = await executePromise;

      // Should have stopped before yielding all 10 messages
      expect(messages.length).toBeLessThan(10);
      expect(yieldCount).toBeLessThan(10);
    });
  });
});
