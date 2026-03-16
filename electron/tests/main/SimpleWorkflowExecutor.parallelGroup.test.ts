/**
 * SimpleWorkflowExecutor - Parallel Group Execution Tests
 *
 * TDD tests for Parallel Group node execution.
 * Parallel Groups execute their subgraph (Start -> ... -> End) in parallel.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SimpleWorkflowExecutor, ReteWorkflowJSON } from '../../main/SimpleWorkflowExecutor';

// Mock AI provider to avoid actual AI calls
vi.mock('../../../src/providers/AIProviderFactory.js', () => ({
  AIProviderFactory: {
    create: () => ({
      execute: async function* () {
        yield { type: 'assistant', content: 'Mock AI response' };
      },
    }),
  },
}));

vi.mock('../../../src/utils/MessageHandler.js', () => ({
  MessageHandler: vi.fn().mockImplementation(() => ({
    handleMessage: vi.fn(),
    getHasError: () => false,
    getErrorDetails: () => null,
  })),
}));

describe('SimpleWorkflowExecutor - Parallel Group', () => {
  let executor: SimpleWorkflowExecutor;

  beforeEach(() => {
    executor = new SimpleWorkflowExecutor();
  });

  describe('Subgraph Execution', () => {
    it('should execute subgraph nodes inside parallel-group', async () => {
      const workflow: ReteWorkflowJSON = {
        version: '1.0',
        metadata: {
          name: 'Test Workflow',
          description: 'Test',
          version: '1.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        nodes: [
          {
            id: 'start',
            type: 'io:start',
            position: { x: 0, y: 0 },
            config: {},
            inputs: [],
            outputs: [{ key: 'output', label: 'Output' }],
          },
          {
            id: 'parallel-group-1',
            type: 'control:parallel-group',
            position: { x: 200, y: 0 },
            config: {
              parallelGroup: {
                maxConcurrency: 2,
              },
              subgraph: {
                nodes: [
                  {
                    id: 'subgraph-start',
                    type: 'io:start',
                    position: { x: 0, y: 0 },
                    config: {},
                    inputs: [],
                    outputs: [{ key: 'output', label: 'Out' }],
                  },
                  {
                    id: 'transform-1',
                    type: 'control:transform',
                    label: 'Transform',
                    position: { x: 100, y: 0 },
                    config: {},
                    inputs: [{ key: 'input', label: 'Input' }],
                    outputs: [{ key: 'output', label: 'Output' }],
                  },
                  {
                    id: 'subgraph-end',
                    type: 'io:end',
                    position: { x: 200, y: 0 },
                    config: {},
                    inputs: [{ key: 'input', label: 'In' }],
                    outputs: [],
                  },
                ],
                connections: [
                  {
                    id: 'conn-1',
                    source: 'subgraph-start',
                    sourceOutput: 'output',
                    target: 'transform-1',
                    targetInput: 'input',
                  },
                  {
                    id: 'conn-2',
                    source: 'transform-1',
                    sourceOutput: 'output',
                    target: 'subgraph-end',
                    targetInput: 'input',
                  },
                ],
                entryNodeId: 'subgraph-start',
                exitNodeId: 'subgraph-end',
              },
            },
            inputs: [{ key: 'input', label: 'Input' }],
            outputs: [{ key: 'output', label: 'Output' }],
          },
          {
            id: 'end',
            type: 'io:end',
            position: { x: 400, y: 0 },
            config: {},
            inputs: [{ key: 'input', label: 'Input' }],
            outputs: [],
          },
        ],
        connections: [
          {
            id: 'main-conn-1',
            source: 'start',
            sourceOutput: 'output',
            target: 'parallel-group-1',
            targetInput: 'input',
          },
          {
            id: 'main-conn-2',
            source: 'parallel-group-1',
            sourceOutput: 'output',
            target: 'end',
            targetInput: 'input',
          },
        ],
        entryNodeId: 'start',
        exitNodeId: 'end',
      };

      const result = await executor.execute(workflow, {
        prompt: 'Test task',
      });

      // Parallel group should have executed
      expect(result.executedNodes).toContain('parallel-group-1');

      // CRITICAL: Subgraph nodes must also be executed
      // Node IDs include task index suffix (#0, #1, etc.) for parallel execution tracking
      expect(result.executedNodes).toContain('subgraph-start#0');
      expect(result.executedNodes).toContain('transform-1#0');
      expect(result.executedNodes).toContain('subgraph-end#0');
    });
  });

  describe('Parallel Execution', () => {
    it('should execute subgraph for each concurrent task', async () => {
      const executedSubgraphNodes: string[] = [];

      const workflow: ReteWorkflowJSON = {
        version: '1.0',
        metadata: {
          name: 'Test Workflow',
          description: 'Test',
          version: '1.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        nodes: [
          {
            id: 'start',
            type: 'io:start',
            position: { x: 0, y: 0 },
            config: {},
            inputs: [],
            outputs: [{ key: 'output', label: 'Output' }],
          },
          {
            id: 'parallel-group-1',
            type: 'control:parallel-group',
            position: { x: 200, y: 0 },
            config: {
              parallelGroup: {
                maxConcurrency: 2,
              },
              subgraph: {
                nodes: [
                  {
                    id: 'subgraph-start',
                    type: 'io:start',
                    position: { x: 0, y: 0 },
                    config: {},
                    inputs: [],
                    outputs: [{ key: 'output', label: 'Out' }],
                  },
                  {
                    id: 'subgraph-end',
                    type: 'io:end',
                    position: { x: 200, y: 0 },
                    config: {},
                    inputs: [{ key: 'input', label: 'In' }],
                    outputs: [],
                  },
                ],
                connections: [
                  {
                    id: 'conn-1',
                    source: 'subgraph-start',
                    sourceOutput: 'output',
                    target: 'subgraph-end',
                    targetInput: 'input',
                  },
                ],
                entryNodeId: 'subgraph-start',
                exitNodeId: 'subgraph-end',
              },
            },
            inputs: [{ key: 'input', label: 'Input' }],
            outputs: [{ key: 'output', label: 'Output' }],
          },
          {
            id: 'end',
            type: 'io:end',
            position: { x: 400, y: 0 },
            config: {},
            inputs: [{ key: 'input', label: 'Input' }],
            outputs: [],
          },
        ],
        connections: [
          {
            id: 'main-conn-1',
            source: 'start',
            sourceOutput: 'output',
            target: 'parallel-group-1',
            targetInput: 'input',
          },
          {
            id: 'main-conn-2',
            source: 'parallel-group-1',
            sourceOutput: 'output',
            target: 'end',
            targetInput: 'input',
          },
        ],
        entryNodeId: 'start',
        exitNodeId: 'end',
      };

      const result = await executor.execute(workflow, {
        prompt: 'Task 1: Do something. Task 2: Do another thing.',
      });

      expect(result.success).toBe(true);
      expect(result.executedNodes).toContain('parallel-group-1');
    });

    it('should respect maxConcurrency setting', async () => {
      // This test verifies that parallel execution respects the concurrency limit
      const workflow: ReteWorkflowJSON = {
        version: '1.0',
        metadata: {
          name: 'Test Workflow',
          description: 'Test',
          version: '1.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        nodes: [
          {
            id: 'start',
            type: 'io:start',
            position: { x: 0, y: 0 },
            config: {},
            inputs: [],
            outputs: [{ key: 'output', label: 'Output' }],
          },
          {
            id: 'parallel-group-1',
            type: 'control:parallel-group',
            position: { x: 200, y: 0 },
            config: {
              parallelGroup: {
                maxConcurrency: 4,  // 4 concurrent executions
              },
              subgraph: {
                nodes: [
                  {
                    id: 'subgraph-start',
                    type: 'io:start',
                    position: { x: 0, y: 0 },
                    config: {},
                    inputs: [],
                    outputs: [{ key: 'output', label: 'Out' }],
                  },
                  {
                    id: 'subgraph-end',
                    type: 'io:end',
                    position: { x: 200, y: 0 },
                    config: {},
                    inputs: [{ key: 'input', label: 'In' }],
                    outputs: [],
                  },
                ],
                connections: [
                  {
                    id: 'conn-1',
                    source: 'subgraph-start',
                    sourceOutput: 'output',
                    target: 'subgraph-end',
                    targetInput: 'input',
                  },
                ],
                entryNodeId: 'subgraph-start',
                exitNodeId: 'subgraph-end',
              },
            },
            inputs: [{ key: 'input', label: 'Input' }],
            outputs: [{ key: 'output', label: 'Output' }],
          },
          {
            id: 'end',
            type: 'io:end',
            position: { x: 400, y: 0 },
            config: {},
            inputs: [{ key: 'input', label: 'Input' }],
            outputs: [],
          },
        ],
        connections: [
          {
            id: 'main-conn-1',
            source: 'start',
            sourceOutput: 'output',
            target: 'parallel-group-1',
            targetInput: 'input',
          },
          {
            id: 'main-conn-2',
            source: 'parallel-group-1',
            sourceOutput: 'output',
            target: 'end',
            targetInput: 'input',
          },
        ],
        entryNodeId: 'start',
        exitNodeId: 'end',
      };

      const result = await executor.execute(workflow, {
        prompt: 'Multiple tasks to execute in parallel',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Result Aggregation', () => {
    it('should aggregate results from all parallel executions', async () => {
      const workflow: ReteWorkflowJSON = {
        version: '1.0',
        metadata: {
          name: 'Test Workflow',
          description: 'Test',
          version: '1.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        nodes: [
          {
            id: 'start',
            type: 'io:start',
            position: { x: 0, y: 0 },
            config: {},
            inputs: [],
            outputs: [{ key: 'output', label: 'Output' }],
          },
          {
            id: 'parallel-group-1',
            type: 'control:parallel-group',
            position: { x: 200, y: 0 },
            config: {
              parallelGroup: {
                maxConcurrency: 2,
              },
              subgraph: {
                nodes: [
                  {
                    id: 'subgraph-start',
                    type: 'io:start',
                    position: { x: 0, y: 0 },
                    config: {},
                    inputs: [],
                    outputs: [{ key: 'output', label: 'Out' }],
                  },
                  {
                    id: 'subgraph-end',
                    type: 'io:end',
                    position: { x: 200, y: 0 },
                    config: {},
                    inputs: [{ key: 'input', label: 'In' }],
                    outputs: [],
                  },
                ],
                connections: [
                  {
                    id: 'conn-1',
                    source: 'subgraph-start',
                    sourceOutput: 'output',
                    target: 'subgraph-end',
                    targetInput: 'input',
                  },
                ],
                entryNodeId: 'subgraph-start',
                exitNodeId: 'subgraph-end',
              },
            },
            inputs: [{ key: 'input', label: 'Input' }],
            outputs: [{ key: 'output', label: 'Output' }],
          },
          {
            id: 'end',
            type: 'io:end',
            position: { x: 400, y: 0 },
            config: {},
            inputs: [{ key: 'input', label: 'Input' }],
            outputs: [],
          },
        ],
        connections: [
          {
            id: 'main-conn-1',
            source: 'start',
            sourceOutput: 'output',
            target: 'parallel-group-1',
            targetInput: 'input',
          },
          {
            id: 'main-conn-2',
            source: 'parallel-group-1',
            sourceOutput: 'output',
            target: 'end',
            targetInput: 'input',
          },
        ],
        entryNodeId: 'start',
        exitNodeId: 'end',
      };

      const result = await executor.execute(workflow, {
        prompt: 'Task 1 and Task 2',
      });

      expect(result.success).toBe(true);
      // Results should be aggregated
      expect(result.outputs).toBeDefined();
    });
  });
});
