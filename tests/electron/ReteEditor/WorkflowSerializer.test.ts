/**
 * WorkflowSerializer Tests
 *
 * TDD Red Phase: Tests for serializing/deserializing Rete.js editor data
 * to/from ReteWorkflowJSON format.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  WorkflowSerializer,
  serializeWorkflow,
  deserializeWorkflow,
  type EditorNode,
  type EditorConnection,
  type EditorData,
} from '../../../electron/renderer/components/ReteEditor/WorkflowSerializer';
import type { ReteWorkflowJSON, WorkflowNodeJSON, ConnectionJSON } from '../../../src/workflow/types';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a mock editor node
 */
function createMockEditorNode(
  id: string,
  type: string,
  label: string,
  position: { x: number; y: number },
  inputs: string[] = [],
  outputs: string[] = []
): EditorNode {
  return {
    id,
    type,
    label,
    position,
    inputs: inputs.map((key) => ({ key, label: key })),
    outputs: outputs.map((key) => ({ key, label: key })),
    config: {},
  };
}

/**
 * Create a mock connection
 */
function createMockConnection(
  id: string,
  source: string,
  sourceOutput: string,
  target: string,
  targetInput: string
): EditorConnection {
  return {
    id,
    source,
    sourceOutput,
    target,
    targetInput,
  };
}

// ============================================================================
// WorkflowSerializer Construction Tests
// ============================================================================

describe('WorkflowSerializer', () => {
  describe('Construction', () => {
    it('should create WorkflowSerializer instance', () => {
      const serializer = new WorkflowSerializer();
      expect(serializer).toBeInstanceOf(WorkflowSerializer);
    });
  });

  describe('serialize', () => {
    it('should serialize empty editor data', () => {
      const serializer = new WorkflowSerializer();
      const editorData: EditorData = {
        nodes: [],
        connections: [],
      };

      const result = serializer.serialize(editorData, {
        name: 'Empty Workflow',
      });

      expect(result).toBeDefined();
      expect(result.version).toBe('1.0');
      expect(result.metadata.name).toBe('Empty Workflow');
      expect(result.nodes).toEqual([]);
      expect(result.connections).toEqual([]);
    });

    it('should serialize nodes with correct type mapping', () => {
      const serializer = new WorkflowSerializer();
      const editorData: EditorData = {
        nodes: [
          createMockEditorNode('start-1', 'start', 'Start', { x: 100, y: 100 }, [], ['output']),
          createMockEditorNode('engineer-1', 'engineer', 'Engineer', { x: 300, y: 100 }, ['input'], ['output']),
          createMockEditorNode('end-1', 'end', 'End', { x: 500, y: 100 }, ['input'], []),
        ],
        connections: [],
      };

      const result = serializer.serialize(editorData, { name: 'Test Workflow' });

      expect(result.nodes).toHaveLength(3);
      expect(result.nodes[0].type).toBe('io:start');
      expect(result.nodes[1].type).toBe('preset:engineer');
      expect(result.nodes[2].type).toBe('io:end');
    });

    it('should serialize node positions correctly', () => {
      const serializer = new WorkflowSerializer();
      const editorData: EditorData = {
        nodes: [
          createMockEditorNode('node-1', 'start', 'Start', { x: 150, y: 250 }, [], ['output']),
        ],
        connections: [],
      };

      const result = serializer.serialize(editorData, { name: 'Test' });

      expect(result.nodes[0].position).toEqual({ x: 150, y: 250 });
    });

    it('should serialize connections', () => {
      const serializer = new WorkflowSerializer();
      const editorData: EditorData = {
        nodes: [
          createMockEditorNode('start-1', 'start', 'Start', { x: 100, y: 100 }, [], ['output']),
          createMockEditorNode('end-1', 'end', 'End', { x: 500, y: 100 }, ['input'], []),
        ],
        connections: [
          createMockConnection('conn-1', 'start-1', 'output', 'end-1', 'input'),
        ],
      };

      const result = serializer.serialize(editorData, { name: 'Test' });

      expect(result.connections).toHaveLength(1);
      expect(result.connections[0].source).toBe('start-1');
      expect(result.connections[0].sourceOutput).toBe('output');
      expect(result.connections[0].target).toBe('end-1');
      expect(result.connections[0].targetInput).toBe('input');
    });

    it('should detect and set entryNodeId', () => {
      const serializer = new WorkflowSerializer();
      const editorData: EditorData = {
        nodes: [
          createMockEditorNode('my-start', 'start', 'Start', { x: 100, y: 100 }, [], ['output']),
          createMockEditorNode('end-1', 'end', 'End', { x: 500, y: 100 }, ['input'], []),
        ],
        connections: [],
      };

      const result = serializer.serialize(editorData, { name: 'Test' });

      expect(result.entryNodeId).toBe('my-start');
    });

    it('should detect and set exitNodeId', () => {
      const serializer = new WorkflowSerializer();
      const editorData: EditorData = {
        nodes: [
          createMockEditorNode('start-1', 'start', 'Start', { x: 100, y: 100 }, [], ['output']),
          createMockEditorNode('my-end', 'end', 'End', { x: 500, y: 100 }, ['input'], []),
        ],
        connections: [],
      };

      const result = serializer.serialize(editorData, { name: 'Test' });

      expect(result.exitNodeId).toBe('my-end');
    });

    it('should include AI config for AI nodes', () => {
      const serializer = new WorkflowSerializer();
      const engineerNode = createMockEditorNode(
        'engineer-1',
        'engineer',
        'Engineer',
        { x: 100, y: 100 },
        ['task'],
        ['code']
      );
      engineerNode.config = {
        ai: {
          provider: 'claude',
          model: 'sonnet',
          maxTurns: 20,
        },
      };

      const editorData: EditorData = {
        nodes: [engineerNode],
        connections: [],
      };

      const result = serializer.serialize(editorData, { name: 'Test' });

      expect(result.nodes[0].config.ai).toBeDefined();
      expect(result.nodes[0].config.ai?.provider).toBe('claude');
    });

    it('should include metadata timestamps', () => {
      const serializer = new WorkflowSerializer();
      const editorData: EditorData = { nodes: [], connections: [] };

      const result = serializer.serialize(editorData, {
        name: 'Test',
        description: 'Test description',
        author: 'Test Author',
      });

      expect(result.metadata.name).toBe('Test');
      expect(result.metadata.description).toBe('Test description');
      expect(result.metadata.author).toBe('Test Author');
      expect(result.metadata.createdAt).toBeDefined();
      expect(result.metadata.updatedAt).toBeDefined();
    });
  });

  describe('deserialize', () => {
    it('should deserialize empty workflow', () => {
      const serializer = new WorkflowSerializer();
      const workflow: ReteWorkflowJSON = {
        version: '1.0',
        metadata: {
          name: 'Empty',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        nodes: [],
        connections: [],
        entryNodeId: '',
        exitNodeId: '',
      };

      const result = serializer.deserialize(workflow);

      expect(result.nodes).toEqual([]);
      expect(result.connections).toEqual([]);
    });

    it('should deserialize nodes with correct type mapping', () => {
      const serializer = new WorkflowSerializer();
      const workflow: ReteWorkflowJSON = {
        version: '1.0',
        metadata: {
          name: 'Test',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        nodes: [
          {
            id: 'start-1',
            type: 'io:start',
            label: 'Start',
            position: { x: 100, y: 100 },
            inputs: [],
            outputs: [{ id: 'output', name: 'Output', type: 'data', required: true }],
            config: {},
          },
          {
            id: 'engineer-1',
            type: 'preset:engineer',
            label: 'Engineer',
            position: { x: 300, y: 100 },
            inputs: [{ id: 'task', name: 'Task', type: 'data', required: true }],
            outputs: [{ id: 'code', name: 'Code', type: 'data', required: true }],
            config: {},
          },
        ],
        connections: [],
        entryNodeId: 'start-1',
        exitNodeId: '',
      };

      const result = serializer.deserialize(workflow);

      expect(result.nodes).toHaveLength(2);
      expect(result.nodes[0].type).toBe('start');
      expect(result.nodes[1].type).toBe('engineer');
    });

    it('should deserialize connections', () => {
      const serializer = new WorkflowSerializer();
      const workflow: ReteWorkflowJSON = {
        version: '1.0',
        metadata: {
          name: 'Test',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        nodes: [
          {
            id: 'start-1',
            type: 'io:start',
            label: 'Start',
            position: { x: 100, y: 100 },
            inputs: [],
            outputs: [{ id: 'output', name: 'Output', type: 'data', required: true }],
            config: {},
          },
          {
            id: 'end-1',
            type: 'io:end',
            label: 'End',
            position: { x: 500, y: 100 },
            inputs: [{ id: 'input', name: 'Input', type: 'data', required: true }],
            outputs: [],
            config: {},
          },
        ],
        connections: [
          {
            id: 'conn-1',
            source: 'start-1',
            sourceOutput: 'output',
            target: 'end-1',
            targetInput: 'input',
          },
        ],
        entryNodeId: 'start-1',
        exitNodeId: 'end-1',
      };

      const result = serializer.deserialize(workflow);

      expect(result.connections).toHaveLength(1);
      expect(result.connections[0].source).toBe('start-1');
      expect(result.connections[0].target).toBe('end-1');
    });

    it('should preserve node configuration', () => {
      const serializer = new WorkflowSerializer();
      const workflow: ReteWorkflowJSON = {
        version: '1.0',
        metadata: {
          name: 'Test',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        nodes: [
          {
            id: 'engineer-1',
            type: 'preset:engineer',
            label: 'My Engineer',
            position: { x: 300, y: 100 },
            inputs: [{ id: 'task', name: 'Task', type: 'data', required: true }],
            outputs: [{ id: 'code', name: 'Code', type: 'data', required: true }],
            config: {
              ai: {
                provider: 'claude',
                model: 'opus',
                maxTurns: 50,
              },
            },
          },
        ],
        connections: [],
        entryNodeId: '',
        exitNodeId: '',
      };

      const result = serializer.deserialize(workflow);

      expect(result.nodes[0].config.ai?.provider).toBe('claude');
      expect(result.nodes[0].config.ai?.model).toBe('opus');
      expect(result.nodes[0].config.ai?.maxTurns).toBe(50);
    });
  });

  describe('roundtrip', () => {
    it('should preserve data through serialize/deserialize cycle', () => {
      const serializer = new WorkflowSerializer();
      const originalData: EditorData = {
        nodes: [
          createMockEditorNode('start-1', 'start', 'Start', { x: 100, y: 100 }, [], ['output']),
          createMockEditorNode('engineer-1', 'engineer', 'Engineer', { x: 300, y: 100 }, ['task'], ['code']),
          createMockEditorNode('reviewer-1', 'reviewer', 'Reviewer', { x: 500, y: 100 }, ['code'], ['review']),
          createMockEditorNode('end-1', 'end', 'End', { x: 700, y: 100 }, ['input'], []),
        ],
        connections: [
          createMockConnection('conn-1', 'start-1', 'output', 'engineer-1', 'task'),
          createMockConnection('conn-2', 'engineer-1', 'code', 'reviewer-1', 'code'),
          createMockConnection('conn-3', 'reviewer-1', 'review', 'end-1', 'input'),
        ],
      };

      const serialized = serializer.serialize(originalData, { name: 'Roundtrip Test' });
      const deserialized = serializer.deserialize(serialized);

      expect(deserialized.nodes).toHaveLength(originalData.nodes.length);
      expect(deserialized.connections).toHaveLength(originalData.connections.length);

      // Verify node IDs are preserved
      const nodeIds = deserialized.nodes.map((n) => n.id);
      expect(nodeIds).toContain('start-1');
      expect(nodeIds).toContain('engineer-1');
      expect(nodeIds).toContain('reviewer-1');
      expect(nodeIds).toContain('end-1');

      // Verify connection structure
      const conn1 = deserialized.connections.find((c) => c.id === 'conn-1');
      expect(conn1?.source).toBe('start-1');
      expect(conn1?.target).toBe('engineer-1');
    });
  });
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('serializeWorkflow helper', () => {
  it('should serialize workflow using default serializer', () => {
    const editorData: EditorData = {
      nodes: [createMockEditorNode('start-1', 'start', 'Start', { x: 0, y: 0 }, [], ['output'])],
      connections: [],
    };

    const result = serializeWorkflow(editorData, { name: 'Helper Test' });

    expect(result.metadata.name).toBe('Helper Test');
    expect(result.nodes).toHaveLength(1);
  });
});

describe('deserializeWorkflow helper', () => {
  it('should deserialize workflow using default serializer', () => {
    const workflow: ReteWorkflowJSON = {
      version: '1.0',
      metadata: {
        name: 'Test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      nodes: [
        {
          id: 'start-1',
          type: 'io:start',
          label: 'Start',
          position: { x: 100, y: 100 },
          inputs: [],
          outputs: [{ id: 'output', name: 'Output', type: 'data', required: true }],
          config: {},
        },
      ],
      connections: [],
      entryNodeId: 'start-1',
      exitNodeId: '',
    };

    const result = deserializeWorkflow(workflow);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].type).toBe('start');
  });
});

// ============================================================================
// Type Mapping Tests
// ============================================================================

describe('Node Type Mapping', () => {
  const serializer = new WorkflowSerializer();

  const typeTestCases: Array<{ editorType: string; workflowType: string }> = [
    { editorType: 'start', workflowType: 'io:start' },
    { editorType: 'end', workflowType: 'io:end' },
    { editorType: 'transform', workflowType: 'io:transform' },
    { editorType: 'decision', workflowType: 'control:decision' },
    { editorType: 'parallel', workflowType: 'control:parallel' },
    { editorType: 'aggregator', workflowType: 'control:aggregator' },
    { editorType: 'group', workflowType: 'control:group' },
    { editorType: 'engineer', workflowType: 'preset:engineer' },
    { editorType: 'reviewer', workflowType: 'preset:reviewer' },
    { editorType: 'product-owner', workflowType: 'preset:product-owner' },
    { editorType: 'custom-ai', workflowType: 'ai:custom' },
    { editorType: 'merge', workflowType: 'git:merge' },
  ];

  typeTestCases.forEach(({ editorType, workflowType }) => {
    it(`should map ${editorType} to ${workflowType}`, () => {
      const editorData: EditorData = {
        nodes: [createMockEditorNode(`${editorType}-1`, editorType, editorType, { x: 0, y: 0 }, [], [])],
        connections: [],
      };

      const result = serializer.serialize(editorData, { name: 'Type Test' });

      expect(result.nodes[0].type).toBe(workflowType);
    });
  });
});
