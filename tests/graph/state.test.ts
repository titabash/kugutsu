/**
 * Tests for ParallelDevState - nodeExecutionResults field
 *
 * Tests the AI message storage functionality in state (Integration tests)
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createInitialState, type ParallelDevStateType } from '../../src/graph/state.js';
import type { ParallelDevConfig } from '../../src/graph/types.js';

describe('ParallelDevState - nodeExecutionResults', () => {
  let mockConfig: ParallelDevConfig;
  let initialState: ParallelDevStateType;

  beforeEach(() => {
    mockConfig = {
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
      baseBranch: 'main',
      maxEngineers: 3,
      maxTurns: 10,
      provider: 'claude',
    };

    initialState = createInitialState('test request', mockConfig);
  });

  describe('Initial State', () => {
    it('should initialize nodeExecutionResults as empty Map', () => {
      expect(initialState.nodeExecutionResults).toBeInstanceOf(Map);
      expect(initialState.nodeExecutionResults.size).toBe(0);
    });
  });

  describe('State Manipulation', () => {
    it('should store and retrieve node execution results', () => {
      const messages = [
        { type: 'assistant', content: [{ type: 'text', text: 'Hello' }] },
      ];

      // Simulate node update
      const updatedState: ParallelDevStateType = {
        ...initialState,
        nodeExecutionResults: new Map([['EngineerNode-TASK-001', messages]]),
      };

      expect(updatedState.nodeExecutionResults).toBeInstanceOf(Map);
      expect(updatedState.nodeExecutionResults.size).toBe(1);
      expect(updatedState.nodeExecutionResults.get('EngineerNode-TASK-001')).toEqual(messages);
    });

    it('should merge multiple node execution results', () => {
      const messages1 = [
        { type: 'assistant', content: [{ type: 'text', text: 'Task 1' }] },
      ];
      const messages2 = [
        { type: 'assistant', content: [{ type: 'text', text: 'Task 2' }] },
      ];

      const updatedState: ParallelDevStateType = {
        ...initialState,
        nodeExecutionResults: new Map([
          ['EngineerNode-TASK-001', messages1],
          ['EngineerNode-TASK-002', messages2],
        ]),
      };

      expect(updatedState.nodeExecutionResults.size).toBe(2);
      expect(updatedState.nodeExecutionResults.get('EngineerNode-TASK-001')).toEqual(messages1);
      expect(updatedState.nodeExecutionResults.get('EngineerNode-TASK-002')).toEqual(messages2);
    });

    it('should replace existing node execution result with same key', () => {
      const oldMessages = [
        { type: 'assistant', content: [{ type: 'text', text: 'Old' }] },
      ];
      const newMessages = [
        { type: 'assistant', content: [{ type: 'text', text: 'New' }] },
      ];

      // First update
      let state: ParallelDevStateType = {
        ...initialState,
        nodeExecutionResults: new Map([['EngineerNode-TASK-001', oldMessages]]),
      };

      // Second update (replacement)
      state = {
        ...state,
        nodeExecutionResults: new Map([['EngineerNode-TASK-001', newMessages]]),
      };

      expect(state.nodeExecutionResults.size).toBe(1);
      expect(state.nodeExecutionResults.get('EngineerNode-TASK-001')).toEqual(newMessages);
    });

    it('should handle empty message arrays', () => {
      const updatedState: ParallelDevStateType = {
        ...initialState,
        nodeExecutionResults: new Map([['EngineerNode-TASK-001', []]]),
      };

      expect(updatedState.nodeExecutionResults.get('EngineerNode-TASK-001')).toEqual([]);
    });
  });

  describe('Multiple Node Types', () => {
    it('should store results for different node types', () => {
      const engineerMessages = [
        { type: 'assistant', content: [{ type: 'text', text: 'Engineer work' }] },
      ];
      const reviewMessages = [
        { type: 'assistant', content: [{ type: 'text', text: 'Review work' }] },
      ];

      const updatedState: ParallelDevStateType = {
        ...initialState,
        nodeExecutionResults: new Map([
          ['EngineerNode-TASK-001', engineerMessages],
          ['ReviewNode-TASK-001', reviewMessages],
        ]),
      };

      expect(updatedState.nodeExecutionResults.size).toBe(2);
      expect(updatedState.nodeExecutionResults.get('EngineerNode-TASK-001')).toEqual(engineerMessages);
      expect(updatedState.nodeExecutionResults.get('ReviewNode-TASK-001')).toEqual(reviewMessages);
    });
  });

  describe('Message Content Variations', () => {
    it('should store assistant messages with text blocks', () => {
      const messages = [
        {
          type: 'assistant',
          content: [
            { type: 'text', text: 'First block' },
            { type: 'text', text: 'Second block' },
          ],
        },
      ];

      const updatedState: ParallelDevStateType = {
        ...initialState,
        nodeExecutionResults: new Map([['EngineerNode-TASK-001', messages]]),
      };

      expect(updatedState.nodeExecutionResults.get('EngineerNode-TASK-001')).toEqual(messages);
    });

    it('should store assistant messages with tool_use blocks', () => {
      const messages = [
        {
          type: 'assistant',
          content: [
            {
              type: 'tool_use',
              name: 'Read',
              input: { file_path: '/test/file.ts' },
            },
          ],
        },
      ];

      const updatedState: ParallelDevStateType = {
        ...initialState,
        nodeExecutionResults: new Map([['EngineerNode-TASK-001', messages]]),
      };

      expect(updatedState.nodeExecutionResults.get('EngineerNode-TASK-001')).toEqual(messages);
    });

    it('should store thinking messages', () => {
      const messages = [
        {
          type: 'thinking',
          thinking: 'Analyzing the problem...',
        },
      ];

      const updatedState: ParallelDevStateType = {
        ...initialState,
        nodeExecutionResults: new Map([['EngineerNode-TASK-001', messages]]),
      };

      expect(updatedState.nodeExecutionResults.get('EngineerNode-TASK-001')).toEqual(messages);
    });

    it('should store result messages', () => {
      const messages = [
        {
          type: 'result',
          result: { success: true },
          finalResponse: 'Task completed successfully',
        },
      ];

      const updatedState: ParallelDevStateType = {
        ...initialState,
        nodeExecutionResults: new Map([['EngineerNode-TASK-001', messages]]),
      };

      expect(updatedState.nodeExecutionResults.get('EngineerNode-TASK-001')).toEqual(messages);
    });

    it('should store multiple messages in sequence', () => {
      const messages = [
        { type: 'thinking', thinking: 'Planning...' },
        {
          type: 'assistant',
          content: [{ type: 'text', text: 'Let me implement this' }],
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
          finalResponse: 'Implementation complete',
        },
      ];

      const updatedState: ParallelDevStateType = {
        ...initialState,
        nodeExecutionResults: new Map([['EngineerNode-TASK-001', messages]]),
      };

      expect(updatedState.nodeExecutionResults.get('EngineerNode-TASK-001')).toEqual(messages);
      expect(updatedState.nodeExecutionResults.get('EngineerNode-TASK-001')).toHaveLength(4);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long task IDs', () => {
      const longTaskId = 'A'.repeat(1000);
      const messages = [
        { type: 'assistant', content: [{ type: 'text', text: 'Test' }] },
      ];

      const updatedState: ParallelDevStateType = {
        ...initialState,
        nodeExecutionResults: new Map([[`EngineerNode-${longTaskId}`, messages]]),
      };

      expect(updatedState.nodeExecutionResults.get(`EngineerNode-${longTaskId}`)).toEqual(messages);
    });

    it('should handle special characters in task IDs', () => {
      const specialTaskId = 'TASK-001-あいうえお-😀';
      const messages = [
        { type: 'assistant', content: [{ type: 'text', text: 'Test' }] },
      ];

      const updatedState: ParallelDevStateType = {
        ...initialState,
        nodeExecutionResults: new Map([[`EngineerNode-${specialTaskId}`, messages]]),
      };

      expect(updatedState.nodeExecutionResults.get(`EngineerNode-${specialTaskId}`)).toEqual(messages);
    });
  });
});
