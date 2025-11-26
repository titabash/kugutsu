/**
 * NodeFactory Tests
 *
 * Phase 3.3: Node Factory implementation
 * TDD Red Phase: These tests define expected behavior for the node factory
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NodeFactory } from '../../src/workflow/NodeFactory.js';
import {
  StartNode,
  EndNode,
  DecisionNode,
  DataTransformNode,
} from '../../src/workflow/nodes/ControlFlowNodes.js';
import { ParallelNode } from '../../src/workflow/nodes/ParallelNode.js';
import { AggregatorNode } from '../../src/workflow/nodes/AggregatorNode.js';
import { GroupNode } from '../../src/workflow/nodes/GroupNode.js';
import { EngineerNode } from '../../src/workflow/nodes/preset/EngineerNode.js';
import { ReviewerNode } from '../../src/workflow/nodes/preset/ReviewerNode.js';
import { ProductOwnerNode } from '../../src/workflow/nodes/preset/ProductOwnerNode.js';
import { MergeCoordinatorNode } from '../../src/workflow/nodes/preset/MergeCoordinatorNode.js';
import { ConflictResolverNode } from '../../src/workflow/nodes/preset/ConflictResolverNode.js';
import { TestRunnerNode } from '../../src/workflow/nodes/preset/TestRunnerNode.js';
import type { WorkflowNodeJSON } from '../../src/workflow/types.js';

// ============================================================================
// NodeFactory Construction Tests
// ============================================================================

describe('NodeFactory', () => {
  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = NodeFactory.getInstance();
      const instance2 = NodeFactory.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should be accessible via static methods', () => {
      const node = NodeFactory.createNode({
        id: 'test-1',
        type: 'start',
        label: 'Start',
        position: { x: 0, y: 0 },
        inputs: [],
        outputs: [],
        config: {},
      });

      expect(node).toBeDefined();
    });
  });

  describe('Built-in Node Types', () => {
    it('should create StartNode', () => {
      const node = NodeFactory.createNode({
        id: 'start-1',
        type: 'start',
        label: 'Start',
        position: { x: 0, y: 0 },
        inputs: [],
        outputs: [{ id: 'output', name: 'Output', type: 'control', required: true }],
        config: {},
      });

      expect(node).toBeInstanceOf(StartNode);
      expect(node.id).toBe('start-1');
    });

    it('should create EndNode', () => {
      const node = NodeFactory.createNode({
        id: 'end-1',
        type: 'end',
        label: 'End',
        position: { x: 100, y: 0 },
        inputs: [{ id: 'input', name: 'Input', type: 'control', required: true }],
        outputs: [],
        config: {},
      });

      expect(node).toBeInstanceOf(EndNode);
    });

    it('should create DecisionNode', () => {
      const node = NodeFactory.createNode({
        id: 'decision-1',
        type: 'decision',
        label: 'Decision',
        position: { x: 50, y: 50 },
        inputs: [],
        outputs: [],
        config: { condition: 'data.value > 0' },
      });

      expect(node).toBeInstanceOf(DecisionNode);
    });

    it('should create DataTransformNode', () => {
      const node = NodeFactory.createNode({
        id: 'transform-1',
        type: 'data-transform',
        label: 'Transform',
        position: { x: 50, y: 100 },
        inputs: [],
        outputs: [],
        config: {},
      });

      expect(node).toBeInstanceOf(DataTransformNode);
    });

    it('should create ParallelNode', () => {
      const node = NodeFactory.createNode({
        id: 'parallel-1',
        type: 'parallel',
        label: 'Parallel',
        position: { x: 50, y: 150 },
        inputs: [],
        outputs: [],
        config: { targetNode: 'engineer-1' },
      });

      expect(node).toBeInstanceOf(ParallelNode);
    });

    it('should create AggregatorNode', () => {
      const node = NodeFactory.createNode({
        id: 'aggregator-1',
        type: 'aggregator',
        label: 'Aggregator',
        position: { x: 50, y: 200 },
        inputs: [],
        outputs: [],
        config: {},
      });

      expect(node).toBeInstanceOf(AggregatorNode);
    });

    it('should create GroupNode', () => {
      const node = NodeFactory.createNode({
        id: 'group-1',
        type: 'group',
        label: 'Group',
        position: { x: 50, y: 250 },
        inputs: [],
        outputs: [],
        config: {
          subgraph: { nodes: [], connections: [] },
        },
      });

      expect(node).toBeInstanceOf(GroupNode);
    });
  });

  describe('Preset Node Types', () => {
    it('should create EngineerNode', () => {
      const node = NodeFactory.createNode({
        id: 'engineer-1',
        type: 'preset:engineer',
        label: 'Engineer',
        position: { x: 0, y: 0 },
        inputs: [],
        outputs: [],
        config: {},
      });

      expect(node).toBeInstanceOf(EngineerNode);
    });

    it('should create ReviewerNode', () => {
      const node = NodeFactory.createNode({
        id: 'reviewer-1',
        type: 'preset:reviewer',
        label: 'Reviewer',
        position: { x: 0, y: 0 },
        inputs: [],
        outputs: [],
        config: {},
      });

      expect(node).toBeInstanceOf(ReviewerNode);
    });

    it('should create ProductOwnerNode', () => {
      const node = NodeFactory.createNode({
        id: 'po-1',
        type: 'preset:product-owner',
        label: 'Product Owner',
        position: { x: 0, y: 0 },
        inputs: [],
        outputs: [],
        config: {},
      });

      expect(node).toBeInstanceOf(ProductOwnerNode);
    });

    it('should create MergeCoordinatorNode', () => {
      const node = NodeFactory.createNode({
        id: 'mc-1',
        type: 'preset:merge-coordinator',
        label: 'Merge Coordinator',
        position: { x: 0, y: 0 },
        inputs: [],
        outputs: [],
        config: {},
      });

      expect(node).toBeInstanceOf(MergeCoordinatorNode);
    });

    it('should create ConflictResolverNode', () => {
      const node = NodeFactory.createNode({
        id: 'cr-1',
        type: 'preset:conflict-resolver',
        label: 'Conflict Resolver',
        position: { x: 0, y: 0 },
        inputs: [],
        outputs: [],
        config: {},
      });

      expect(node).toBeInstanceOf(ConflictResolverNode);
    });

    it('should create TestRunnerNode', () => {
      const node = NodeFactory.createNode({
        id: 'tr-1',
        type: 'preset:test-runner',
        label: 'Test Runner',
        position: { x: 0, y: 0 },
        inputs: [],
        outputs: [],
        config: {},
      });

      expect(node).toBeInstanceOf(TestRunnerNode);
    });
  });

  describe('Node Position', () => {
    it('should set node position from JSON', () => {
      const node = NodeFactory.createNode({
        id: 'pos-1',
        type: 'start',
        label: 'Start',
        position: { x: 150, y: 250 },
        inputs: [],
        outputs: [],
        config: {},
      });

      const json = node.toJSON();
      expect(json.position).toEqual({ x: 150, y: 250 });
    });
  });

  describe('Node Configuration', () => {
    it('should pass configuration to node', () => {
      const node = NodeFactory.createNode({
        id: 'config-1',
        type: 'preset:engineer',
        label: 'Engineer',
        position: { x: 0, y: 0 },
        inputs: [],
        outputs: [],
        config: {
          useWorktree: true,
          branchPrefix: 'feature',
          ai: {
            provider: 'claude',
            maxTurns: 20,
          },
        },
      });

      expect(node.config.useWorktree).toBe(true);
      expect(node.config.branchPrefix).toBe('feature');
    });

    it('should preserve custom label', () => {
      const node = NodeFactory.createNode({
        id: 'label-1',
        type: 'preset:engineer',
        label: 'Senior Engineer',
        position: { x: 0, y: 0 },
        inputs: [],
        outputs: [],
        config: {},
      });

      expect(node.label).toBe('Senior Engineer');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unknown node type', () => {
      expect(() => {
        NodeFactory.createNode({
          id: 'unknown-1',
          type: 'unknown-type' as any,
          label: 'Unknown',
          position: { x: 0, y: 0 },
          inputs: [],
          outputs: [],
          config: {},
        });
      }).toThrow(/unknown.*type/i);
    });
  });
});

// ============================================================================
// Custom Node Registration Tests
// ============================================================================

describe('NodeFactory Custom Node Registration', () => {
  beforeEach(() => {
    // Reset factory state before each test
    NodeFactory.getInstance().clearCustomNodes();
  });

  describe('Registration', () => {
    it('should register custom node type', () => {
      const factory = NodeFactory.getInstance();

      factory.registerCustomNode('custom:my-node', (json) => {
        return new StartNode(json.id, {});
      });

      const types = factory.getRegisteredTypes();
      expect(types).toContain('custom:my-node');
    });

    it('should create registered custom node', () => {
      const factory = NodeFactory.getInstance();

      factory.registerCustomNode('custom:special', (json) => {
        const node = new StartNode(json.id, {});
        return node;
      });

      const node = NodeFactory.createNode({
        id: 'special-1',
        type: 'custom:special',
        label: 'Special Node',
        position: { x: 0, y: 0 },
        inputs: [],
        outputs: [],
        config: {},
      });

      expect(node).toBeDefined();
      expect(node.id).toBe('special-1');
    });

    it('should pass JSON to custom node creator', () => {
      const factory = NodeFactory.getInstance();
      const mockCreator = jest.fn().mockImplementation((json) => {
        return new StartNode(json.id, {});
      });

      factory.registerCustomNode('custom:test', mockCreator);

      const json: WorkflowNodeJSON = {
        id: 'test-1',
        type: 'custom:test',
        label: 'Test',
        position: { x: 100, y: 200 },
        inputs: [],
        outputs: [],
        config: { customOption: true },
      };

      NodeFactory.createNode(json);

      expect(mockCreator).toHaveBeenCalledWith(json);
    });

    it('should throw error when registering duplicate type', () => {
      const factory = NodeFactory.getInstance();

      factory.registerCustomNode('custom:duplicate', () => new StartNode('x', {}));

      expect(() => {
        factory.registerCustomNode('custom:duplicate', () => new StartNode('y', {}));
      }).toThrow(/already registered/i);
    });

    it('should allow overwriting with force option', () => {
      const factory = NodeFactory.getInstance();

      factory.registerCustomNode('custom:overwrite', () => new StartNode('x', {}));

      // Should not throw with force option
      expect(() => {
        factory.registerCustomNode(
          'custom:overwrite',
          () => new EndNode('y', {}),
          { force: true }
        );
      }).not.toThrow();
    });
  });

  describe('Unregistration', () => {
    it('should unregister custom node type', () => {
      const factory = NodeFactory.getInstance();

      factory.registerCustomNode('custom:removable', () => new StartNode('x', {}));
      factory.unregisterCustomNode('custom:removable');

      const types = factory.getRegisteredTypes();
      expect(types).not.toContain('custom:removable');
    });

    it('should throw error when creating unregistered type', () => {
      const factory = NodeFactory.getInstance();

      factory.registerCustomNode('custom:temp', () => new StartNode('x', {}));
      factory.unregisterCustomNode('custom:temp');

      expect(() => {
        NodeFactory.createNode({
          id: 'temp-1',
          type: 'custom:temp',
          label: 'Temp',
          position: { x: 0, y: 0 },
          inputs: [],
          outputs: [],
          config: {},
        });
      }).toThrow(/unknown.*type/i);
    });

    it('should not allow unregistering built-in types', () => {
      const factory = NodeFactory.getInstance();

      expect(() => {
        factory.unregisterCustomNode('start');
      }).toThrow(/built-in/i);
    });
  });

  describe('Listing Types', () => {
    it('should list all registered types', () => {
      const factory = NodeFactory.getInstance();
      const types = factory.getRegisteredTypes();

      // Built-in types
      expect(types).toContain('start');
      expect(types).toContain('end');
      expect(types).toContain('decision');
      expect(types).toContain('data-transform');
      expect(types).toContain('parallel');
      expect(types).toContain('aggregator');
      expect(types).toContain('group');

      // Preset types
      expect(types).toContain('preset:engineer');
      expect(types).toContain('preset:reviewer');
      expect(types).toContain('preset:product-owner');
      expect(types).toContain('preset:merge-coordinator');
      expect(types).toContain('preset:conflict-resolver');
      expect(types).toContain('preset:test-runner');
    });

    it('should list built-in types separately', () => {
      const factory = NodeFactory.getInstance();
      const builtInTypes = factory.getBuiltInTypes();

      expect(builtInTypes).toContain('start');
      expect(builtInTypes).toContain('end');
      expect(builtInTypes).not.toContain('custom:anything');
    });

    it('should list custom types separately', () => {
      const factory = NodeFactory.getInstance();

      factory.registerCustomNode('custom:a', () => new StartNode('a', {}));
      factory.registerCustomNode('custom:b', () => new StartNode('b', {}));

      const customTypes = factory.getCustomTypes();

      expect(customTypes).toContain('custom:a');
      expect(customTypes).toContain('custom:b');
      expect(customTypes).not.toContain('start');
    });
  });
});

// ============================================================================
// Batch Node Creation Tests
// ============================================================================

describe('NodeFactory Batch Operations', () => {
  it('should create multiple nodes from JSON array', () => {
    const nodesJson: WorkflowNodeJSON[] = [
      {
        id: 'batch-start',
        type: 'start',
        label: 'Start',
        position: { x: 0, y: 0 },
        inputs: [],
        outputs: [],
        config: {},
      },
      {
        id: 'batch-engineer',
        type: 'preset:engineer',
        label: 'Engineer',
        position: { x: 100, y: 0 },
        inputs: [],
        outputs: [],
        config: {},
      },
      {
        id: 'batch-end',
        type: 'end',
        label: 'End',
        position: { x: 200, y: 0 },
        inputs: [],
        outputs: [],
        config: {},
      },
    ];

    const nodes = NodeFactory.createNodes(nodesJson);

    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toBeInstanceOf(StartNode);
    expect(nodes[1]).toBeInstanceOf(EngineerNode);
    expect(nodes[2]).toBeInstanceOf(EndNode);
  });

  it('should return empty array for empty input', () => {
    const nodes = NodeFactory.createNodes([]);
    expect(nodes).toEqual([]);
  });

  it('should throw on first invalid node in batch', () => {
    const nodesJson: WorkflowNodeJSON[] = [
      {
        id: 'valid-1',
        type: 'start',
        label: 'Start',
        position: { x: 0, y: 0 },
        inputs: [],
        outputs: [],
        config: {},
      },
      {
        id: 'invalid-1',
        type: 'invalid-type' as any,
        label: 'Invalid',
        position: { x: 100, y: 0 },
        inputs: [],
        outputs: [],
        config: {},
      },
    ];

    expect(() => {
      NodeFactory.createNodes(nodesJson);
    }).toThrow(/unknown.*type/i);
  });
});

// ============================================================================
// Node Type Information Tests
// ============================================================================

describe('NodeFactory Node Type Info', () => {
  it('should provide node type metadata', () => {
    const factory = NodeFactory.getInstance();
    const info = factory.getNodeTypeInfo('preset:engineer');

    expect(info).toBeDefined();
    expect(info?.name).toBeDefined();
    expect(info?.category).toBeDefined();
    expect(info?.description).toBeDefined();
  });

  it('should return category for node types', () => {
    const factory = NodeFactory.getInstance();

    expect(factory.getNodeCategory('start')).toBe('control-flow');
    expect(factory.getNodeCategory('end')).toBe('control-flow');
    expect(factory.getNodeCategory('decision')).toBe('control-flow');
    expect(factory.getNodeCategory('parallel')).toBe('parallel');
    expect(factory.getNodeCategory('preset:engineer')).toBe('ai-task');
    expect(factory.getNodeCategory('preset:merge-coordinator')).toBe('git-operation');
  });

  it('should list types by category', () => {
    const factory = NodeFactory.getInstance();

    const controlFlowTypes = factory.getTypesByCategory('control-flow');
    expect(controlFlowTypes).toContain('start');
    expect(controlFlowTypes).toContain('end');
    expect(controlFlowTypes).toContain('decision');

    const aiTypes = factory.getTypesByCategory('ai-task');
    expect(aiTypes).toContain('preset:engineer');
    expect(aiTypes).toContain('preset:reviewer');
    expect(aiTypes).toContain('preset:product-owner');
  });
});
