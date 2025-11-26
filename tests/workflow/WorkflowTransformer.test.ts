/**
 * WorkflowTransformer Tests
 *
 * TDD Red Phase: Tests for transforming Rete.js workflows to LangGraph StateGraph
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  WorkflowTransformer,
  type TransformedWorkflow,
} from '../../src/workflow/WorkflowTransformer.js';
import type { ReteWorkflowJSON, WorkflowNodeJSON, ConnectionJSON } from '../../src/workflow/types.js';

/**
 * Create a simple workflow for testing
 */
function createSimpleWorkflow(): ReteWorkflowJSON {
  return {
    version: '1.0.0',
    metadata: {
      name: 'Simple Workflow',
      description: 'A simple test workflow',
      createdAt: '2025-11-26T00:00:00Z',
      updatedAt: '2025-11-26T00:00:00Z',
    },
    nodes: [
      {
        id: 'start-1',
        type: 'io:start',
        label: 'Start',
        position: { x: 100, y: 100 },
        inputs: [],
        outputs: [{ id: 'default', name: 'Output', type: 'control', required: true }],
        config: {},
      },
      {
        id: 'engineer-1',
        type: 'preset:engineer',
        label: 'Engineer',
        position: { x: 300, y: 100 },
        inputs: [{ id: 'task', name: 'Task', type: 'data', dataType: 'string', required: true }],
        outputs: [{ id: 'code', name: 'Code', type: 'data', dataType: 'object', required: true }],
        config: {
          ai: {
            provider: 'claude',
            maxTurns: 30,
          },
        },
      },
      {
        id: 'end-1',
        type: 'io:end',
        label: 'End',
        position: { x: 500, y: 100 },
        inputs: [{ id: 'default', name: 'Input', type: 'any', required: true }],
        outputs: [],
        config: {},
      },
    ],
    connections: [
      {
        id: 'conn-1',
        source: 'start-1',
        sourceOutput: 'default',
        target: 'engineer-1',
        targetInput: 'task',
      },
      {
        id: 'conn-2',
        source: 'engineer-1',
        sourceOutput: 'code',
        target: 'end-1',
        targetInput: 'default',
      },
    ],
    entryNodeId: 'start-1',
    exitNodeId: 'end-1',
  };
}

/**
 * Create a workflow with conditional branching
 */
function createConditionalWorkflow(): ReteWorkflowJSON {
  return {
    version: '1.0.0',
    metadata: {
      name: 'Conditional Workflow',
      description: 'A workflow with decision node',
      createdAt: '2025-11-26T00:00:00Z',
      updatedAt: '2025-11-26T00:00:00Z',
    },
    nodes: [
      {
        id: 'start-1',
        type: 'io:start',
        label: 'Start',
        position: { x: 100, y: 100 },
        inputs: [],
        outputs: [{ id: 'default', name: 'Output', type: 'control', required: true }],
        config: {},
      },
      {
        id: 'decision-1',
        type: 'control:decision',
        label: 'Check Complexity',
        position: { x: 300, y: 100 },
        inputs: [{ id: 'input', name: 'Input', type: 'any', required: true }],
        outputs: [
          { id: 'true', name: 'True', type: 'control', required: false },
          { id: 'false', name: 'False', type: 'control', required: false },
        ],
        config: {
          condition: 'input.complexity > 5',
        },
      },
      {
        id: 'engineer-simple',
        type: 'preset:engineer',
        label: 'Simple Engineer',
        position: { x: 500, y: 50 },
        inputs: [{ id: 'task', name: 'Task', type: 'data', dataType: 'string', required: true }],
        outputs: [{ id: 'code', name: 'Code', type: 'data', dataType: 'object', required: true }],
        config: { ai: { provider: 'claude', maxTurns: 10 } },
      },
      {
        id: 'engineer-complex',
        type: 'preset:engineer',
        label: 'Complex Engineer',
        position: { x: 500, y: 150 },
        inputs: [{ id: 'task', name: 'Task', type: 'data', dataType: 'string', required: true }],
        outputs: [{ id: 'code', name: 'Code', type: 'data', dataType: 'object', required: true }],
        config: { ai: { provider: 'claude', maxTurns: 50 } },
      },
      {
        id: 'end-1',
        type: 'io:end',
        label: 'End',
        position: { x: 700, y: 100 },
        inputs: [{ id: 'default', name: 'Input', type: 'any', required: true }],
        outputs: [],
        config: {},
      },
    ],
    connections: [
      {
        id: 'conn-1',
        source: 'start-1',
        sourceOutput: 'default',
        target: 'decision-1',
        targetInput: 'input',
      },
      {
        id: 'conn-2',
        source: 'decision-1',
        sourceOutput: 'false',
        target: 'engineer-simple',
        targetInput: 'task',
      },
      {
        id: 'conn-3',
        source: 'decision-1',
        sourceOutput: 'true',
        target: 'engineer-complex',
        targetInput: 'task',
      },
      {
        id: 'conn-4',
        source: 'engineer-simple',
        sourceOutput: 'code',
        target: 'end-1',
        targetInput: 'default',
      },
      {
        id: 'conn-5',
        source: 'engineer-complex',
        sourceOutput: 'code',
        target: 'end-1',
        targetInput: 'default',
      },
    ],
    entryNodeId: 'start-1',
    exitNodeId: 'end-1',
  };
}

describe('WorkflowTransformer', () => {
  describe('transform()', () => {
    it('should transform a simple workflow', () => {
      const workflow = createSimpleWorkflow();
      const result = WorkflowTransformer.transform(workflow);

      expect(result).toBeDefined();
      expect(result.nodeIds).toEqual(['start-1', 'engineer-1', 'end-1']);
      expect(result.entryNodeId).toBe('start-1');
      expect(result.exitNodeId).toBe('end-1');
    });

    it('should create node instances for each workflow node', () => {
      const workflow = createSimpleWorkflow();
      const result = WorkflowTransformer.transform(workflow);

      expect(result.nodes).toBeDefined();
      expect(Object.keys(result.nodes)).toHaveLength(3);
      expect(result.nodes['start-1']).toBeDefined();
      expect(result.nodes['engineer-1']).toBeDefined();
      expect(result.nodes['end-1']).toBeDefined();
    });

    it('should build edge map from connections', () => {
      const workflow = createSimpleWorkflow();
      const result = WorkflowTransformer.transform(workflow);

      expect(result.edges).toBeDefined();
      expect(result.edges['start-1']).toEqual(['engineer-1']);
      expect(result.edges['engineer-1']).toEqual(['end-1']);
      expect(result.edges['end-1']).toBeUndefined();
    });

    it('should detect entry and exit nodes', () => {
      const workflow = createSimpleWorkflow();
      const result = WorkflowTransformer.transform(workflow);

      expect(result.entryNodeId).toBe('start-1');
      expect(result.exitNodeId).toBe('end-1');
    });
  });

  describe('transform() with conditional workflow', () => {
    it('should handle decision nodes with multiple outputs', () => {
      const workflow = createConditionalWorkflow();
      const result = WorkflowTransformer.transform(workflow);

      expect(result.conditionalEdges).toBeDefined();
      expect(result.conditionalEdges['decision-1']).toBeDefined();
      expect(result.conditionalEdges['decision-1'].true).toBe('engineer-complex');
      expect(result.conditionalEdges['decision-1'].false).toBe('engineer-simple');
    });

    it('should handle multiple paths to end node', () => {
      const workflow = createConditionalWorkflow();
      const result = WorkflowTransformer.transform(workflow);

      // Both engineer nodes should connect to end
      expect(result.edges['engineer-simple']).toContain('end-1');
      expect(result.edges['engineer-complex']).toContain('end-1');
    });
  });

  describe('validateWorkflow()', () => {
    it('should validate a correct workflow', () => {
      const workflow = createSimpleWorkflow();
      const result = WorkflowTransformer.validateWorkflow(workflow);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing entry node', () => {
      const workflow = createSimpleWorkflow();
      workflow.entryNodeId = 'nonexistent';
      const result = WorkflowTransformer.validateWorkflow(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Entry node not found: nonexistent');
    });

    it('should detect missing exit node', () => {
      const workflow = createSimpleWorkflow();
      workflow.exitNodeId = 'nonexistent';
      const result = WorkflowTransformer.validateWorkflow(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Exit node not found: nonexistent');
    });

    it('should detect disconnected nodes', () => {
      const workflow = createSimpleWorkflow();
      workflow.nodes.push({
        id: 'disconnected',
        type: 'preset:engineer',
        label: 'Disconnected',
        position: { x: 0, y: 0 },
        inputs: [{ id: 'task', name: 'Task', type: 'data', required: true }],
        outputs: [{ id: 'code', name: 'Code', type: 'data', required: true }],
        config: {},
      });
      const result = WorkflowTransformer.validateWorkflow(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('disconnected'))).toBe(true);
    });

    it('should detect cycles in workflow', () => {
      const workflow = createSimpleWorkflow();
      // Add a connection that creates a cycle
      workflow.connections.push({
        id: 'cycle-conn',
        source: 'engineer-1',
        sourceOutput: 'code',
        target: 'start-1',
        targetInput: 'default',
      });
      const result = WorkflowTransformer.validateWorkflow(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('cycle'))).toBe(true);
    });

    it('should validate decision node has condition', () => {
      const workflow = createConditionalWorkflow();
      // Remove condition from decision node
      const decisionNode = workflow.nodes.find(n => n.id === 'decision-1');
      if (decisionNode) {
        delete decisionNode.config.condition;
      }
      const result = WorkflowTransformer.validateWorkflow(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('condition'))).toBe(true);
    });
  });

  describe('getExecutionOrder()', () => {
    it('should return topologically sorted node ids', () => {
      const workflow = createSimpleWorkflow();
      const transformed = WorkflowTransformer.transform(workflow);
      const order = WorkflowTransformer.getExecutionOrder(transformed);

      expect(order).toEqual(['start-1', 'engineer-1', 'end-1']);
    });

    it('should handle conditional branches', () => {
      const workflow = createConditionalWorkflow();
      const transformed = WorkflowTransformer.transform(workflow);
      const order = WorkflowTransformer.getExecutionOrder(transformed);

      // Start should be first
      expect(order[0]).toBe('start-1');
      // Decision should come before engineers
      expect(order.indexOf('decision-1')).toBeLessThan(order.indexOf('engineer-simple'));
      expect(order.indexOf('decision-1')).toBeLessThan(order.indexOf('engineer-complex'));
      // End should be last
      expect(order[order.length - 1]).toBe('end-1');
    });
  });

  describe('createNodeInstance()', () => {
    it('should create StartNode for io:start type', () => {
      const nodeJson: WorkflowNodeJSON = {
        id: 'start-1',
        type: 'io:start',
        label: 'Start',
        position: { x: 0, y: 0 },
        inputs: [],
        outputs: [{ id: 'default', name: 'Output', type: 'control', required: true }],
        config: {},
      };
      const node = WorkflowTransformer.createNodeInstance(nodeJson);

      expect(node).toBeDefined();
      expect(node.type).toBe('io:start');
    });

    it('should create EndNode for io:end type', () => {
      const nodeJson: WorkflowNodeJSON = {
        id: 'end-1',
        type: 'io:end',
        label: 'End',
        position: { x: 0, y: 0 },
        inputs: [{ id: 'default', name: 'Input', type: 'any', required: true }],
        outputs: [],
        config: {},
      };
      const node = WorkflowTransformer.createNodeInstance(nodeJson);

      expect(node).toBeDefined();
      expect(node.type).toBe('io:end');
    });

    it('should create DecisionNode for control:decision type', () => {
      const nodeJson: WorkflowNodeJSON = {
        id: 'decision-1',
        type: 'control:decision',
        label: 'Decision',
        position: { x: 0, y: 0 },
        inputs: [{ id: 'input', name: 'Input', type: 'any', required: true }],
        outputs: [
          { id: 'true', name: 'True', type: 'control', required: false },
          { id: 'false', name: 'False', type: 'control', required: false },
        ],
        config: { condition: 'input > 5' },
      };
      const node = WorkflowTransformer.createNodeInstance(nodeJson);

      expect(node).toBeDefined();
      expect(node.type).toBe('control:decision');
    });

    it('should create DataTransformNode for io:transform type', () => {
      const nodeJson: WorkflowNodeJSON = {
        id: 'transform-1',
        type: 'io:transform',
        label: 'Transform',
        position: { x: 0, y: 0 },
        inputs: [{ id: 'input', name: 'Input', type: 'data', required: true }],
        outputs: [{ id: 'output', name: 'Output', type: 'data', required: true }],
        config: { transformType: 'custom', transformFunction: 'return input * 2' },
      };
      const node = WorkflowTransformer.createNodeInstance(nodeJson);

      expect(node).toBeDefined();
      expect(node.type).toBe('io:transform');
    });

    it('should throw error for unknown node type', () => {
      const nodeJson: WorkflowNodeJSON = {
        id: 'unknown-1',
        type: 'unknown:type' as any,
        label: 'Unknown',
        position: { x: 0, y: 0 },
        inputs: [],
        outputs: [],
        config: {},
      };

      expect(() => WorkflowTransformer.createNodeInstance(nodeJson))
        .toThrow('Unknown node type: unknown:type');
    });
  });

  describe('serializeWorkflow()', () => {
    it('should serialize transformed workflow back to JSON', () => {
      const workflow = createSimpleWorkflow();
      const transformed = WorkflowTransformer.transform(workflow);
      const serialized = WorkflowTransformer.serializeWorkflow(transformed);

      expect(serialized).toBeDefined();
      expect(serialized.nodes).toHaveLength(3);
      expect(serialized.connections).toHaveLength(2);
    });
  });
});

describe('TransformedWorkflow', () => {
  it('should have required properties', () => {
    const workflow = createSimpleWorkflow();
    const result = WorkflowTransformer.transform(workflow);

    // Check all required properties exist
    expect(result.nodeIds).toBeDefined();
    expect(result.nodes).toBeDefined();
    expect(result.edges).toBeDefined();
    expect(result.conditionalEdges).toBeDefined();
    expect(result.entryNodeId).toBeDefined();
    expect(result.exitNodeId).toBeDefined();
    expect(result.metadata).toBeDefined();
  });
});

// ============================================================================
// Phase 2.4: Parallel Execution Extension Tests
// ============================================================================

/**
 * Create a workflow with ParallelNode
 */
function createParallelWorkflow(): ReteWorkflowJSON {
  return {
    version: '1.0.0',
    metadata: {
      name: 'Parallel Workflow',
      description: 'A workflow with parallel execution',
      createdAt: '2025-11-26T00:00:00Z',
      updatedAt: '2025-11-26T00:00:00Z',
    },
    nodes: [
      {
        id: 'start-1',
        type: 'io:start',
        label: 'Start',
        position: { x: 100, y: 100 },
        inputs: [],
        outputs: [{ id: 'default', name: 'Output', type: 'control', required: true }],
        config: {},
      },
      {
        id: 'parallel-1',
        type: 'control:parallel',
        label: 'Parallel Tasks',
        position: { x: 300, y: 100 },
        inputs: [{ id: 'items', name: 'Items', type: 'data', dataType: 'array', required: true }],
        outputs: [{ id: 'results', name: 'Results', type: 'data', dataType: 'array', required: true }],
        config: {
          maxConcurrency: 3,
          targetNode: 'engineer-1',
          useWorktree: true,
        },
      },
      {
        id: 'engineer-1',
        type: 'preset:engineer',
        label: 'Engineer',
        position: { x: 500, y: 100 },
        inputs: [{ id: 'task', name: 'Task', type: 'data', dataType: 'string', required: true }],
        outputs: [{ id: 'code', name: 'Code', type: 'data', dataType: 'object', required: true }],
        config: { ai: { provider: 'claude', maxTurns: 30 } },
      },
      {
        id: 'aggregator-1',
        type: 'control:aggregator',
        label: 'Aggregator',
        position: { x: 700, y: 100 },
        inputs: [{ id: 'results', name: 'Results', type: 'data', dataType: 'array', required: true }],
        outputs: [{ id: 'aggregated', name: 'Aggregated', type: 'data', dataType: 'object', required: true }],
        config: {
          aggregationMode: 'concat',
        },
      },
      {
        id: 'end-1',
        type: 'io:end',
        label: 'End',
        position: { x: 900, y: 100 },
        inputs: [{ id: 'default', name: 'Input', type: 'any', required: true }],
        outputs: [],
        config: {},
      },
    ],
    connections: [
      {
        id: 'conn-1',
        source: 'start-1',
        sourceOutput: 'default',
        target: 'parallel-1',
        targetInput: 'items',
      },
      {
        id: 'conn-2',
        source: 'parallel-1',
        sourceOutput: 'results',
        target: 'aggregator-1',
        targetInput: 'results',
      },
      {
        id: 'conn-3',
        source: 'aggregator-1',
        sourceOutput: 'aggregated',
        target: 'end-1',
        targetInput: 'default',
      },
    ],
    entryNodeId: 'start-1',
    exitNodeId: 'end-1',
  };
}

/**
 * Create a workflow with GroupNode (subgraph parallel execution)
 */
function createGroupWorkflow(): ReteWorkflowJSON {
  return {
    version: '1.0.0',
    metadata: {
      name: 'Group Workflow',
      description: 'A workflow with subgraph parallel execution',
      createdAt: '2025-11-26T00:00:00Z',
      updatedAt: '2025-11-26T00:00:00Z',
    },
    nodes: [
      {
        id: 'start-1',
        type: 'io:start',
        label: 'Start',
        position: { x: 100, y: 100 },
        inputs: [],
        outputs: [{ id: 'default', name: 'Output', type: 'control', required: true }],
        config: {},
      },
      {
        id: 'group-1',
        type: 'control:group',
        label: 'Feature Group',
        position: { x: 300, y: 100 },
        inputs: [{ id: 'input', name: 'Input', type: 'any', required: true }],
        outputs: [{ id: 'output', name: 'Output', type: 'any', required: true }],
        config: {
          subgraph: {
            nodes: [
              {
                id: 'sub-engineer',
                type: 'preset:engineer',
                label: 'Sub Engineer',
                position: { x: 0, y: 0 },
                inputs: [{ id: 'task', name: 'Task', type: 'data', required: true }],
                outputs: [{ id: 'code', name: 'Code', type: 'data', required: true }],
                config: {},
              },
              {
                id: 'sub-reviewer',
                type: 'preset:reviewer',
                label: 'Sub Reviewer',
                position: { x: 200, y: 0 },
                inputs: [{ id: 'code', name: 'Code', type: 'data', required: true }],
                outputs: [{ id: 'review', name: 'Review', type: 'data', required: true }],
                config: {},
              },
            ],
            connections: [
              {
                id: 'sub-conn-1',
                source: 'sub-engineer',
                sourceOutput: 'code',
                target: 'sub-reviewer',
                targetInput: 'code',
              },
            ],
          },
          parallelExecution: {
            enabled: true,
            maxConcurrency: 2,
            inputArray: 'features',
          },
        },
      },
      {
        id: 'aggregator-1',
        type: 'control:aggregator',
        label: 'Aggregator',
        position: { x: 500, y: 100 },
        inputs: [{ id: 'results', name: 'Results', type: 'data', dataType: 'array', required: true }],
        outputs: [{ id: 'aggregated', name: 'Aggregated', type: 'data', dataType: 'object', required: true }],
        config: { aggregationMode: 'merge' },
      },
      {
        id: 'end-1',
        type: 'io:end',
        label: 'End',
        position: { x: 700, y: 100 },
        inputs: [{ id: 'default', name: 'Input', type: 'any', required: true }],
        outputs: [],
        config: {},
      },
    ],
    connections: [
      {
        id: 'conn-1',
        source: 'start-1',
        sourceOutput: 'default',
        target: 'group-1',
        targetInput: 'input',
      },
      {
        id: 'conn-2',
        source: 'group-1',
        sourceOutput: 'output',
        target: 'aggregator-1',
        targetInput: 'results',
      },
      {
        id: 'conn-3',
        source: 'aggregator-1',
        sourceOutput: 'aggregated',
        target: 'end-1',
        targetInput: 'default',
      },
    ],
    entryNodeId: 'start-1',
    exitNodeId: 'end-1',
  };
}

describe('WorkflowTransformer - Parallel Execution Extension', () => {
  describe('transform() with ParallelNode', () => {
    it('should transform workflow containing ParallelNode', () => {
      const workflow = createParallelWorkflow();
      const result = WorkflowTransformer.transform(workflow);

      expect(result).toBeDefined();
      expect(result.nodeIds).toContain('parallel-1');
      expect(result.nodes['parallel-1']).toBeDefined();
    });

    it('should create actual ParallelNode instance for control:parallel type', () => {
      const workflow = createParallelWorkflow();
      const result = WorkflowTransformer.transform(workflow);

      const parallelNode = result.nodes['parallel-1'];
      expect(parallelNode.type).toBe('control:parallel');
      // Should have parallel-specific config
      expect(parallelNode.config).toHaveProperty('maxConcurrency');
    });

    it('should preserve ParallelNode config properties', () => {
      const workflow = createParallelWorkflow();
      const result = WorkflowTransformer.transform(workflow);

      const parallelNode = result.nodes['parallel-1'];
      expect(parallelNode.config.maxConcurrency).toBe(3);
      expect(parallelNode.config.targetNode).toBe('engineer-1');
      expect(parallelNode.config.useWorktree).toBe(true);
    });

    it('should build edges correctly for parallel workflow', () => {
      const workflow = createParallelWorkflow();
      const result = WorkflowTransformer.transform(workflow);

      expect(result.edges['start-1']).toContain('parallel-1');
      expect(result.edges['parallel-1']).toContain('aggregator-1');
      expect(result.edges['aggregator-1']).toContain('end-1');
    });
  });

  describe('transform() with AggregatorNode', () => {
    it('should create actual AggregatorNode instance for control:aggregator type', () => {
      const workflow = createParallelWorkflow();
      const result = WorkflowTransformer.transform(workflow);

      const aggregatorNode = result.nodes['aggregator-1'];
      expect(aggregatorNode.type).toBe('control:aggregator');
      expect(aggregatorNode.config).toHaveProperty('aggregationMode');
    });

    it('should preserve AggregatorNode config properties', () => {
      const workflow = createParallelWorkflow();
      const result = WorkflowTransformer.transform(workflow);

      const aggregatorNode = result.nodes['aggregator-1'];
      expect(aggregatorNode.config.aggregationMode).toBe('concat');
    });
  });

  describe('transform() with GroupNode', () => {
    it('should transform workflow containing GroupNode', () => {
      const workflow = createGroupWorkflow();
      const result = WorkflowTransformer.transform(workflow);

      expect(result).toBeDefined();
      expect(result.nodeIds).toContain('group-1');
      expect(result.nodes['group-1']).toBeDefined();
    });

    it('should create actual GroupNode instance for control:group type', () => {
      const workflow = createGroupWorkflow();
      const result = WorkflowTransformer.transform(workflow);

      const groupNode = result.nodes['group-1'];
      expect(groupNode.type).toBe('control:group');
      expect(groupNode.config).toHaveProperty('subgraph');
    });

    it('should preserve GroupNode subgraph config', () => {
      const workflow = createGroupWorkflow();
      const result = WorkflowTransformer.transform(workflow);

      const groupNode = result.nodes['group-1'];
      expect(groupNode.config.subgraph).toBeDefined();
      expect(groupNode.config.subgraph.nodes).toHaveLength(2);
      expect(groupNode.config.subgraph.connections).toHaveLength(1);
    });

    it('should preserve parallel execution config', () => {
      const workflow = createGroupWorkflow();
      const result = WorkflowTransformer.transform(workflow);

      const groupNode = result.nodes['group-1'];
      expect(groupNode.config.parallelExecution).toBeDefined();
      expect(groupNode.config.parallelExecution.enabled).toBe(true);
      expect(groupNode.config.parallelExecution.maxConcurrency).toBe(2);
    });
  });

  describe('validateWorkflow() with parallel nodes', () => {
    it('should validate parallel workflow correctly', () => {
      const workflow = createParallelWorkflow();
      const result = WorkflowTransformer.validateWorkflow(workflow);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate group workflow correctly', () => {
      const workflow = createGroupWorkflow();
      const result = WorkflowTransformer.validateWorkflow(workflow);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getExecutionOrder() with parallel nodes', () => {
    it('should include parallel nodes in execution order', () => {
      const workflow = createParallelWorkflow();
      const transformed = WorkflowTransformer.transform(workflow);
      const order = WorkflowTransformer.getExecutionOrder(transformed);

      expect(order).toContain('parallel-1');
      expect(order).toContain('aggregator-1');
      // Parallel should come before aggregator
      expect(order.indexOf('parallel-1')).toBeLessThan(order.indexOf('aggregator-1'));
    });

    it('should handle group nodes in execution order', () => {
      const workflow = createGroupWorkflow();
      const transformed = WorkflowTransformer.transform(workflow);
      const order = WorkflowTransformer.getExecutionOrder(transformed);

      expect(order).toContain('group-1');
      expect(order).toContain('aggregator-1');
      // Group should come before aggregator
      expect(order.indexOf('group-1')).toBeLessThan(order.indexOf('aggregator-1'));
    });
  });

  describe('createNodeInstance() for parallel nodes', () => {
    it('should create ParallelNode for control:parallel type', () => {
      const nodeJson: WorkflowNodeJSON = {
        id: 'parallel-1',
        type: 'control:parallel',
        label: 'Parallel',
        position: { x: 0, y: 0 },
        inputs: [{ id: 'items', name: 'Items', type: 'data', dataType: 'array', required: true }],
        outputs: [{ id: 'results', name: 'Results', type: 'data', dataType: 'array', required: true }],
        config: { maxConcurrency: 5 },
      };
      const node = WorkflowTransformer.createNodeInstance(nodeJson);

      expect(node).toBeDefined();
      expect(node.type).toBe('control:parallel');
      expect(node.config.maxConcurrency).toBe(5);
    });

    it('should create AggregatorNode for control:aggregator type', () => {
      const nodeJson: WorkflowNodeJSON = {
        id: 'aggregator-1',
        type: 'control:aggregator',
        label: 'Aggregator',
        position: { x: 0, y: 0 },
        inputs: [{ id: 'results', name: 'Results', type: 'data', required: true }],
        outputs: [{ id: 'aggregated', name: 'Aggregated', type: 'data', required: true }],
        config: { aggregationMode: 'merge' },
      };
      const node = WorkflowTransformer.createNodeInstance(nodeJson);

      expect(node).toBeDefined();
      expect(node.type).toBe('control:aggregator');
      expect(node.config.aggregationMode).toBe('merge');
    });

    it('should create GroupNode for control:group type', () => {
      const nodeJson: WorkflowNodeJSON = {
        id: 'group-1',
        type: 'control:group',
        label: 'Group',
        position: { x: 0, y: 0 },
        inputs: [{ id: 'input', name: 'Input', type: 'any', required: true }],
        outputs: [{ id: 'output', name: 'Output', type: 'any', required: true }],
        config: {
          subgraph: { nodes: [], connections: [] },
          parallelExecution: { enabled: false },
        },
      };
      const node = WorkflowTransformer.createNodeInstance(nodeJson);

      expect(node).toBeDefined();
      expect(node.type).toBe('control:group');
      expect(node.config.subgraph).toBeDefined();
    });
  });

  describe('serializeWorkflow() with parallel nodes', () => {
    it('should serialize parallel workflow correctly', () => {
      const workflow = createParallelWorkflow();
      const transformed = WorkflowTransformer.transform(workflow);
      const serialized = WorkflowTransformer.serializeWorkflow(transformed);

      expect(serialized.nodes.some(n => n.type === 'control:parallel')).toBe(true);
      expect(serialized.nodes.some(n => n.type === 'control:aggregator')).toBe(true);
    });

    it('should preserve parallel node config during serialization', () => {
      const workflow = createParallelWorkflow();
      const transformed = WorkflowTransformer.transform(workflow);
      const serialized = WorkflowTransformer.serializeWorkflow(transformed);

      const parallelNode = serialized.nodes.find(n => n.type === 'control:parallel');
      expect(parallelNode?.config.maxConcurrency).toBe(3);
    });
  });
});
