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
  /** Parent node ID for scoped nodes (e.g., nodes inside parallel groups) */
  parent?: string;
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
  'parallel-group': 'control:parallel-group' as NodeType,
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
const WORKFLOW_TO_EDITOR_TYPE: Record<string, string> = {
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
  'control:parallel-group': 'parallel-group',
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

    // Build groups from parent relationships
    const groups = this.buildGroups(editorData);

    // Convert editor nodes to workflow nodes (with subgraph embedding)
    const nodes: WorkflowNodeJSON[] = editorData.nodes.map((node) => {
      const workflowNode = this.convertEditorNodeToWorkflow(node);

      // If this is a parallel-group node, embed its subgraph in config
      if (node.type === 'parallel-group') {
        const subgraph = this.buildSubgraphForParallelGroup(
          node.id,
          editorData.nodes,
          editorData.connections
        );
        workflowNode.config.subgraph = subgraph;
      }

      return workflowNode;
    });

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
      groups,
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

  /**
   * Build groups from parent relationships
   */
  private buildGroups(editorData: EditorData): Array<{ id: string; nodeIds: string[]; label?: string }> {
    const groups: Array<{ id: string; nodeIds: string[]; label?: string }> = [];

    // Find all parallel-group nodes
    const parallelGroupNodes = editorData.nodes.filter((n) => n.type === 'parallel-group');

    for (const pgNode of parallelGroupNodes) {
      // Find all child nodes
      const childNodes = editorData.nodes.filter((n) => n.parent === pgNode.id);

      if (childNodes.length > 0) {
        groups.push({
          id: pgNode.id,
          nodeIds: childNodes.map((n) => n.id),
          label: pgNode.label,
        });
      }
    }

    return groups;
  }

  /**
   * Build subgraph definition for a parallel-group node
   */
  private buildSubgraphForParallelGroup(
    parentNodeId: string,
    allNodes: EditorNode[],
    allConnections: EditorConnection[]
  ): {
    nodes: WorkflowNodeJSON[];
    connections: ConnectionJSON[];
    entryNodeId: string;
    exitNodeId: string;
  } {
    // Find child nodes
    const childNodes = allNodes.filter((n) => n.parent === parentNodeId);

    // Convert child nodes to workflow format
    const subgraphNodes = childNodes.map((node) => this.convertEditorNodeToWorkflow(node));

    // Find internal connections (both source and target are child nodes)
    const childNodeIds = new Set(childNodes.map((n) => n.id));
    const internalConnections = allConnections
      .filter((conn) => childNodeIds.has(conn.source) && childNodeIds.has(conn.target))
      .map((conn, index) => ({
        id: conn.id || `internal-conn-${index}`,
        source: conn.source,
        sourceOutput: conn.sourceOutput,
        target: conn.target,
        targetInput: conn.targetInput,
      }));

    // Determine entry and exit nodes
    // Entry node: has no incoming internal connections
    // Exit node: has no outgoing internal connections
    const nodesWithIncoming = new Set(internalConnections.map((c) => c.target));
    const nodesWithOutgoing = new Set(internalConnections.map((c) => c.source));

    const entryNode = childNodes.find((n) => !nodesWithIncoming.has(n.id));
    const exitNode = childNodes.find((n) => !nodesWithOutgoing.has(n.id));

    return {
      nodes: subgraphNodes,
      connections: internalConnections,
      entryNodeId: entryNode?.id || (childNodes[0]?.id ?? ''),
      exitNodeId: exitNode?.id || (childNodes[childNodes.length - 1]?.id ?? ''),
    };
  }

  /**
   * Deserialize workflow and restore child nodes with parent relationships
   */
  deserializeWithChildNodes(workflow: ReteWorkflowJSON): EditorData {
    const baseData = this.deserialize(workflow);
    const nodes: EditorNode[] = [...baseData.nodes];
    const connections: EditorConnection[] = [...baseData.connections];

    // For each node with a subgraph, extract child nodes
    for (const workflowNode of workflow.nodes) {
      const subgraph = workflowNode.config.subgraph as
        | {
            nodes: WorkflowNodeJSON[];
            connections: ConnectionJSON[];
            entryNodeId: string;
            exitNodeId: string;
          }
        | undefined;

      if (subgraph && subgraph.nodes) {
        // Add child nodes with parent reference
        for (const childWorkflowNode of subgraph.nodes) {
          const editorNode = this.convertWorkflowNodeToEditor(childWorkflowNode);
          editorNode.parent = workflowNode.id;
          nodes.push(editorNode);
        }

        // Add internal connections
        for (const conn of subgraph.connections) {
          connections.push({
            id: conn.id,
            source: conn.source,
            sourceOutput: conn.sourceOutput,
            target: conn.target,
            targetInput: conn.targetInput,
          });
        }
      }
    }

    return {
      nodes,
      connections,
    };
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
