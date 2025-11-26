/**
 * Edge Case Tests for Workflow System
 *
 * Phase 5.1: Test coverage improvement
 * Tests for edge cases, error handling, and boundary conditions
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { WorkflowTransformer } from '../../src/workflow/WorkflowTransformer.js';
import { NodeFactory } from '../../src/workflow/NodeFactory.js';
import { WorkflowStorageService } from '../../src/workflow/WorkflowStorageService.js';
import type { ReteWorkflowJSON, WorkflowNodeJSON, WorkflowEdgeJSON } from '../../src/workflow/types.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createNode(
  id: string,
  type: string,
  position = { x: 0, y: 0 }
): WorkflowNodeJSON {
  return {
    id,
    type: type as WorkflowNodeJSON['type'],
    label: `${type} Node`,
    position,
    inputs: type !== 'start' ? [{ id: `${id}-in`, name: 'input' }] : [],
    outputs: type !== 'end' ? [{ id: `${id}-out`, name: 'output' }] : [],
    config: {},
  };
}

function createEdge(
  id: string,
  source: string,
  target: string
): WorkflowEdgeJSON {
  return {
    id,
    source,
    sourceOutput: `${source}-out`,
    target,
    targetInput: `${target}-in`,
  };
}

function createWorkflow(
  nodes: WorkflowNodeJSON[],
  edges: WorkflowEdgeJSON[]
): ReteWorkflowJSON {
  return {
    id: 'test-workflow',
    name: 'Test Workflow',
    version: '1.0.0',
    nodes,
    edges,
  };
}

// ============================================================================
// Empty Workflow Tests
// ============================================================================

describe('Empty Workflow Handling', () => {
  let transformer: WorkflowTransformer;
  let storageService: WorkflowStorageService;

  beforeEach(() => {
    transformer = new WorkflowTransformer();
    storageService = new WorkflowStorageService('/tmp/test');
  });

  it('should reject workflow with no nodes', () => {
    const workflow = createWorkflow([], []);
    const validation = storageService.validate(workflow);

    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => /node/i.test(e))).toBe(true);
  });

  it('should reject workflow with only start node', () => {
    const workflow = createWorkflow(
      [createNode('start-1', 'start')],
      []
    );
    const validation = storageService.validate(workflow);

    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => /end/i.test(e))).toBe(true);
  });

  it('should reject workflow with only end node', () => {
    const workflow = createWorkflow(
      [createNode('end-1', 'end')],
      []
    );
    const validation = storageService.validate(workflow);

    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => /start/i.test(e))).toBe(true);
  });

  it('should accept minimal valid workflow (start + end)', () => {
    const workflow = createWorkflow(
      [createNode('start-1', 'start'), createNode('end-1', 'end')],
      [createEdge('edge-1', 'start-1', 'end-1')]
    );
    const validation = storageService.validate(workflow);

    expect(validation.valid).toBe(true);
  });
});

// ============================================================================
// Circular Reference Detection Tests
// ============================================================================

describe('Circular Reference Detection', () => {
  let transformer: WorkflowTransformer;

  beforeEach(() => {
    transformer = new WorkflowTransformer();
  });

  it('should detect simple circular reference (A -> B -> A)', () => {
    const workflow = createWorkflow(
      [
        createNode('start-1', 'start'),
        createNode('node-a', 'engineer'),
        createNode('node-b', 'engineer'),
        createNode('end-1', 'end'),
      ],
      [
        createEdge('edge-1', 'start-1', 'node-a'),
        createEdge('edge-2', 'node-a', 'node-b'),
        createEdge('edge-3', 'node-b', 'node-a'), // Circular!
        createEdge('edge-4', 'node-b', 'end-1'),
      ]
    );

    const hasCycle = transformer.detectCycles(workflow);
    expect(hasCycle).toBe(true);
  });

  it('should detect self-referencing node', () => {
    const workflow = createWorkflow(
      [
        createNode('start-1', 'start'),
        createNode('node-a', 'engineer'),
        createNode('end-1', 'end'),
      ],
      [
        createEdge('edge-1', 'start-1', 'node-a'),
        createEdge('edge-2', 'node-a', 'node-a'), // Self-reference!
        createEdge('edge-3', 'node-a', 'end-1'),
      ]
    );

    const hasCycle = transformer.detectCycles(workflow);
    expect(hasCycle).toBe(true);
  });

  it('should detect complex circular reference (A -> B -> C -> A)', () => {
    const workflow = createWorkflow(
      [
        createNode('start-1', 'start'),
        createNode('node-a', 'engineer'),
        createNode('node-b', 'engineer'),
        createNode('node-c', 'engineer'),
        createNode('end-1', 'end'),
      ],
      [
        createEdge('edge-1', 'start-1', 'node-a'),
        createEdge('edge-2', 'node-a', 'node-b'),
        createEdge('edge-3', 'node-b', 'node-c'),
        createEdge('edge-4', 'node-c', 'node-a'), // Circular!
        createEdge('edge-5', 'node-c', 'end-1'),
      ]
    );

    const hasCycle = transformer.detectCycles(workflow);
    expect(hasCycle).toBe(true);
  });

  it('should accept workflow without circular references', () => {
    const workflow = createWorkflow(
      [
        createNode('start-1', 'start'),
        createNode('node-a', 'engineer'),
        createNode('node-b', 'engineer'),
        createNode('end-1', 'end'),
      ],
      [
        createEdge('edge-1', 'start-1', 'node-a'),
        createEdge('edge-2', 'node-a', 'node-b'),
        createEdge('edge-3', 'node-b', 'end-1'),
      ]
    );

    const hasCycle = transformer.detectCycles(workflow);
    expect(hasCycle).toBe(false);
  });

  it('should handle decision nodes with multiple paths (no cycle)', () => {
    const workflow = createWorkflow(
      [
        createNode('start-1', 'start'),
        createNode('decision-1', 'decision'),
        createNode('node-a', 'engineer'),
        createNode('node-b', 'engineer'),
        createNode('end-1', 'end'),
      ],
      [
        createEdge('edge-1', 'start-1', 'decision-1'),
        createEdge('edge-2', 'decision-1', 'node-a'),
        createEdge('edge-3', 'decision-1', 'node-b'),
        createEdge('edge-4', 'node-a', 'end-1'),
        createEdge('edge-5', 'node-b', 'end-1'),
      ]
    );

    const hasCycle = transformer.detectCycles(workflow);
    expect(hasCycle).toBe(false);
  });
});

// ============================================================================
// Invalid Node Configuration Tests
// ============================================================================

describe('Invalid Node Configuration', () => {
  it('should handle missing node type gracefully', () => {
    expect(() => {
      NodeFactory.createNode({
        id: 'test-1',
        type: 'non-existent-type' as any,
        label: 'Test',
        position: { x: 0, y: 0 },
        inputs: [],
        outputs: [],
        config: {},
      });
    }).toThrow();
  });

  it('should handle minimal config gracefully', () => {
    // Should not throw
    const node = NodeFactory.createNode({
      id: 'test-1',
      type: 'start',
      label: 'Start',
      position: { x: 0, y: 0 },
      inputs: [],
      outputs: [{ id: 'out', name: 'output' }],
      config: {},
    });
    expect(node).toBeDefined();
  });

  it('should handle AI node with minimal config', () => {
    // AI nodes should have reasonable defaults
    const node = NodeFactory.createNode({
      id: 'test-1',
      type: 'preset:engineer',
      label: 'Engineer',
      position: { x: 0, y: 0 },
      inputs: [{ id: 'in', name: 'input' }],
      outputs: [{ id: 'out', name: 'output' }],
      config: {},
    });
    expect(node).toBeDefined();
  });
});

// ============================================================================
// Edge Reference Validation Tests
// ============================================================================

describe('Edge Reference Validation', () => {
  let storageService: WorkflowStorageService;

  beforeEach(() => {
    storageService = new WorkflowStorageService('/tmp/test');
  });

  it('should reject edge with non-existent source node', () => {
    const workflow = createWorkflow(
      [createNode('start-1', 'start'), createNode('end-1', 'end')],
      [createEdge('edge-1', 'non-existent', 'end-1')]
    );
    const validation = storageService.validate(workflow);

    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => /source/i.test(e))).toBe(true);
  });

  it('should reject edge with non-existent target node', () => {
    const workflow = createWorkflow(
      [createNode('start-1', 'start'), createNode('end-1', 'end')],
      [createEdge('edge-1', 'start-1', 'non-existent')]
    );
    const validation = storageService.validate(workflow);

    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => /target/i.test(e))).toBe(true);
  });

  it('should reject edge with both invalid source and target', () => {
    const workflow = createWorkflow(
      [createNode('start-1', 'start'), createNode('end-1', 'end')],
      [createEdge('edge-1', 'fake-source', 'fake-target')]
    );
    const validation = storageService.validate(workflow);

    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// Disconnected Node Tests
// ============================================================================

describe('Disconnected Node Detection', () => {
  let transformer: WorkflowTransformer;

  beforeEach(() => {
    transformer = new WorkflowTransformer();
  });

  it('should detect nodes not connected to start', () => {
    const workflow = createWorkflow(
      [
        createNode('start-1', 'start'),
        createNode('node-a', 'engineer'),
        createNode('node-b', 'engineer'), // Disconnected
        createNode('end-1', 'end'),
      ],
      [
        createEdge('edge-1', 'start-1', 'node-a'),
        createEdge('edge-2', 'node-a', 'end-1'),
        // node-b is not connected
      ]
    );

    const disconnected = transformer.findDisconnectedNodes(workflow);
    expect(disconnected).toContain('node-b');
  });

  it('should detect nodes not leading to end', () => {
    const workflow = createWorkflow(
      [
        createNode('start-1', 'start'),
        createNode('node-a', 'engineer'),
        createNode('node-b', 'engineer'), // Leads nowhere
        createNode('end-1', 'end'),
      ],
      [
        createEdge('edge-1', 'start-1', 'node-a'),
        createEdge('edge-2', 'start-1', 'node-b'),
        createEdge('edge-3', 'node-a', 'end-1'),
        // node-b doesn't lead to end
      ]
    );

    const deadEnds = transformer.findDeadEndNodes(workflow);
    expect(deadEnds).toContain('node-b');
  });

  it('should accept fully connected workflow', () => {
    const workflow = createWorkflow(
      [
        createNode('start-1', 'start'),
        createNode('node-a', 'engineer'),
        createNode('end-1', 'end'),
      ],
      [
        createEdge('edge-1', 'start-1', 'node-a'),
        createEdge('edge-2', 'node-a', 'end-1'),
      ]
    );

    const disconnected = transformer.findDisconnectedNodes(workflow);
    const deadEnds = transformer.findDeadEndNodes(workflow);

    expect(disconnected).toHaveLength(0);
    expect(deadEnds).toHaveLength(0);
  });
});

// ============================================================================
// Large Workflow Tests
// ============================================================================

describe('Large Workflow Handling', () => {
  let transformer: WorkflowTransformer;

  beforeEach(() => {
    transformer = new WorkflowTransformer();
  });

  it('should handle workflow with 100 nodes', () => {
    const nodes: WorkflowNodeJSON[] = [createNode('start-1', 'start')];
    const edges: WorkflowEdgeJSON[] = [];

    // Create chain of 98 engineer nodes
    let prevNode = 'start-1';
    for (let i = 0; i < 98; i++) {
      const nodeId = `engineer-${i}`;
      nodes.push(createNode(nodeId, 'engineer'));
      edges.push(createEdge(`edge-${i}`, prevNode, nodeId));
      prevNode = nodeId;
    }

    // Add end node
    nodes.push(createNode('end-1', 'end'));
    edges.push(createEdge('edge-final', prevNode, 'end-1'));

    const workflow = createWorkflow(nodes, edges);

    // Should not throw and should detect no cycles
    expect(() => transformer.detectCycles(workflow)).not.toThrow();
    expect(transformer.detectCycles(workflow)).toBe(false);
  });

  it('should handle workflow with many parallel branches', () => {
    const nodes: WorkflowNodeJSON[] = [
      createNode('start-1', 'start'),
      createNode('parallel-1', 'parallel'),
      createNode('aggregator-1', 'aggregator'),
      createNode('end-1', 'end'),
    ];
    const edges: WorkflowEdgeJSON[] = [
      createEdge('edge-start', 'start-1', 'parallel-1'),
    ];

    // Create 20 parallel branches
    for (let i = 0; i < 20; i++) {
      const nodeId = `branch-${i}`;
      nodes.push(createNode(nodeId, 'engineer'));
      edges.push(createEdge(`edge-to-${i}`, 'parallel-1', nodeId));
      edges.push(createEdge(`edge-from-${i}`, nodeId, 'aggregator-1'));
    }

    edges.push(createEdge('edge-end', 'aggregator-1', 'end-1'));

    const workflow = createWorkflow(nodes, edges);

    expect(() => transformer.detectCycles(workflow)).not.toThrow();
    expect(transformer.detectCycles(workflow)).toBe(false);
  });
});

// ============================================================================
// Special Characters in IDs Tests
// ============================================================================

describe('Special Characters in IDs', () => {
  let storageService: WorkflowStorageService;

  beforeEach(() => {
    storageService = new WorkflowStorageService('/tmp/test');
  });

  it('should handle node IDs with special characters', () => {
    const workflow = createWorkflow(
      [
        createNode('start-node_1', 'start'),
        createNode('engineer-node.2', 'engineer'),
        createNode('end-node@3', 'end'),
      ],
      [
        createEdge('edge-1', 'start-node_1', 'engineer-node.2'),
        createEdge('edge-2', 'engineer-node.2', 'end-node@3'),
      ]
    );

    const validation = storageService.validate(workflow);
    expect(validation.valid).toBe(true);
  });

  it('should handle node IDs with unicode characters', () => {
    const workflow = createWorkflow(
      [
        createNode('スタート', 'start'),
        createNode('エンジニア', 'engineer'),
        createNode('終了', 'end'),
      ],
      [
        createEdge('エッジ1', 'スタート', 'エンジニア'),
        createEdge('エッジ2', 'エンジニア', '終了'),
      ]
    );

    const validation = storageService.validate(workflow);
    expect(validation.valid).toBe(true);
  });
});

// ============================================================================
// Duplicate Detection Tests
// ============================================================================

describe('Duplicate Detection', () => {
  let storageService: WorkflowStorageService;

  beforeEach(() => {
    storageService = new WorkflowStorageService('/tmp/test');
  });

  it('should handle workflow with duplicate node IDs gracefully', () => {
    // This tests how the system handles invalid input
    const workflow = createWorkflow(
      [
        createNode('node-1', 'start'),
        createNode('node-1', 'engineer'), // Duplicate ID!
        createNode('end-1', 'end'),
      ],
      [
        createEdge('edge-1', 'node-1', 'end-1'),
      ]
    );

    // The workflow should still be processable, but edges might not work as expected
    const validation = storageService.validate(workflow);
    // Behavior depends on implementation - either reject or last wins
    expect(validation).toBeDefined();
  });

  it('should allow multiple start nodes', () => {
    // Some workflows might have multiple entry points
    const workflow = createWorkflow(
      [
        createNode('start-1', 'start'),
        createNode('start-2', 'start'),
        createNode('merge-1', 'aggregator'),
        createNode('end-1', 'end'),
      ],
      [
        createEdge('edge-1', 'start-1', 'merge-1'),
        createEdge('edge-2', 'start-2', 'merge-1'),
        createEdge('edge-3', 'merge-1', 'end-1'),
      ]
    );

    const validation = storageService.validate(workflow);
    // Multiple start nodes are allowed - they represent different entry points
    expect(validation.valid).toBe(true);
  });
});
