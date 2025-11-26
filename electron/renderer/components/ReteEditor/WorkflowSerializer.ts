/**
 * WorkflowSerializer
 *
 * Handles serialization and deserialization between Rete.js editor data
 * and ReteWorkflowJSON format for persistence and execution.
 */

import type {
  ReteWorkflowJSON,
  WorkflowNodeJSON,
  ConnectionJSON,
  NodeSocket,
  NodeType,
  NodeConfig,
  WorkflowMetadata,
} from '../../../../src/workflow/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Socket representation in editor
 */
export interface EditorSocket {
  key: string;
  label: string;
}

/**
 * Node representation in editor
 */
export interface EditorNode {
  id: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  inputs: EditorSocket[];
  outputs: EditorSocket[];
  config: NodeConfig;
}

/**
 * Connection representation in editor
 */
export interface EditorConnection {
  id: string;
  source: string;
  sourceOutput: string;
  target: string;
  targetInput: string;
}

/**
 * Complete editor data
 */
export interface EditorData {
  nodes: EditorNode[];
  connections: EditorConnection[];
}

/**
 * Metadata options for serialization
 */
export interface SerializeOptions {
  name: string;
  description?: string;
  author?: string;
  tags?: string[];
}

// ============================================================================
// Type Mapping
// ============================================================================

/**
 * Map editor node type to workflow node type
 */
const EDITOR_TO_WORKFLOW_TYPE: Record<string, NodeType> = {
  // IO Nodes
  start: 'io:start',
  end: 'io:end',
  transform: 'io:transform',
  // Control Flow Nodes
  decision: 'control:decision',
  parallel: 'control:parallel',
  aggregator: 'control:aggregator',
  group: 'control:group',
  // AI Task Nodes
  engineer: 'preset:engineer',
  reviewer: 'preset:reviewer',
  'product-owner': 'preset:product-owner',
  'custom-ai': 'ai:custom',
  // Git Operations
  merge: 'git:merge',
};

/**
 * Map workflow node type to editor node type
 */
const WORKFLOW_TO_EDITOR_TYPE: Record<NodeType, string> = {
  // IO Nodes
  'io:start': 'start',
  'io:end': 'end',
  'io:transform': 'transform',
  // Control Flow Nodes
  'control:decision': 'decision',
  'control:parallel': 'parallel',
  'control:aggregator': 'aggregator',
  'control:group': 'group',
  'control:loop': 'loop',
  // AI Task Nodes
  'ai:custom': 'custom-ai',
  'preset:engineer': 'engineer',
  'preset:reviewer': 'reviewer',
  'preset:product-owner': 'product-owner',
  'preset:merge-coordinator': 'merge-coordinator',
  'preset:conflict-resolver': 'conflict-resolver',
  'preset:test-runner': 'test-runner',
  'preset:director': 'director',
  'preset:sprint-planning': 'sprint-planning',
  // Git Operations
  'git:merge': 'merge',
  'git:conflict-resolver': 'git-conflict-resolver',
  'git:branch-manager': 'branch-manager',
};

// ============================================================================
// WorkflowSerializer
// ============================================================================

/**
 * Serializes and deserializes workflow data between editor and JSON formats
 */
export class WorkflowSerializer {
  /**
   * Serialize editor data to ReteWorkflowJSON format
   */
  serialize(editorData: EditorData, options: SerializeOptions): ReteWorkflowJSON {
    const now = new Date().toISOString();

    // Convert editor nodes to workflow nodes
    const nodes: WorkflowNodeJSON[] = editorData.nodes.map((node) =>
      this.convertEditorNodeToWorkflow(node)
    );

    // Convert editor connections to workflow connections
    const connections: ConnectionJSON[] = editorData.connections.map((conn, index) => ({
      id: conn.id || `conn-${index}`,
      source: conn.source,
      sourceOutput: conn.sourceOutput,
      target: conn.target,
      targetInput: conn.targetInput,
    }));

    // Find entry and exit nodes
    const entryNodeId = this.findEntryNodeId(editorData.nodes);
    const exitNodeId = this.findExitNodeId(editorData.nodes);

    // Build metadata
    const metadata: WorkflowMetadata = {
      name: options.name,
      description: options.description,
      author: options.author,
      createdAt: now,
      updatedAt: now,
      tags: options.tags,
    };

    return {
      version: '1.0',
      metadata,
      nodes,
      connections,
      entryNodeId,
      exitNodeId,
    };
  }

  /**
   * Deserialize ReteWorkflowJSON to editor data
   */
  deserialize(workflow: ReteWorkflowJSON): EditorData {
    // Convert workflow nodes to editor nodes
    const nodes: EditorNode[] = workflow.nodes.map((node) =>
      this.convertWorkflowNodeToEditor(node)
    );

    // Convert workflow connections to editor connections
    const connections: EditorConnection[] = workflow.connections.map((conn) => ({
      id: conn.id,
      source: conn.source,
      sourceOutput: conn.sourceOutput,
      target: conn.target,
      targetInput: conn.targetInput,
    }));

    return {
      nodes,
      connections,
    };
  }

  /**
   * Convert an editor node to workflow node format
   */
  private convertEditorNodeToWorkflow(node: EditorNode): WorkflowNodeJSON {
    const workflowType = EDITOR_TO_WORKFLOW_TYPE[node.type] || ('ai:custom' as NodeType);

    const inputs: NodeSocket[] = node.inputs.map((input) => ({
      id: input.key,
      name: input.label || input.key,
      type: 'data',
      required: true,
    }));

    const outputs: NodeSocket[] = node.outputs.map((output) => ({
      id: output.key,
      name: output.label || output.key,
      type: 'data',
      required: true,
    }));

    return {
      id: node.id,
      type: workflowType,
      label: node.label,
      position: node.position,
      inputs,
      outputs,
      config: node.config || {},
    };
  }

  /**
   * Convert a workflow node to editor node format
   */
  private convertWorkflowNodeToEditor(node: WorkflowNodeJSON): EditorNode {
    const editorType = WORKFLOW_TO_EDITOR_TYPE[node.type] || 'custom-ai';

    const inputs: EditorSocket[] = node.inputs.map((input) => ({
      key: input.id,
      label: input.name,
    }));

    const outputs: EditorSocket[] = node.outputs.map((output) => ({
      key: output.id,
      label: output.name,
    }));

    return {
      id: node.id,
      type: editorType,
      label: node.label,
      position: node.position,
      inputs,
      outputs,
      config: node.config,
    };
  }

  /**
   * Find the entry node (start node) ID
   */
  private findEntryNodeId(nodes: EditorNode[]): string {
    const startNode = nodes.find((n) => n.type === 'start');
    return startNode?.id || '';
  }

  /**
   * Find the exit node (end node) ID
   */
  private findExitNodeId(nodes: EditorNode[]): string {
    const endNode = nodes.find((n) => n.type === 'end');
    return endNode?.id || '';
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Serialize workflow using default serializer
 */
export function serializeWorkflow(
  editorData: EditorData,
  options: SerializeOptions
): ReteWorkflowJSON {
  const serializer = new WorkflowSerializer();
  return serializer.serialize(editorData, options);
}

/**
 * Deserialize workflow using default serializer
 */
export function deserializeWorkflow(workflow: ReteWorkflowJSON): EditorData {
  const serializer = new WorkflowSerializer();
  return serializer.deserialize(workflow);
}

export default WorkflowSerializer;
