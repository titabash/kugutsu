/**
 * WorkflowTransformer
 *
 * Transforms Rete.js workflow definitions to executable workflow structures.
 * Handles validation, node creation, edge mapping, and topological sorting.
 */

import type {
  ReteWorkflowJSON,
  WorkflowNodeJSON,
  ConnectionJSON,
  ValidationResult,
  WorkflowMetadata,
} from './types.js';
import {
  BaseWorkflowNode,
  type NodeConfig,
} from './nodes/BaseWorkflowNode.js';
import {
  StartNode,
  EndNode,
  DecisionNode,
  DataTransformNode,
} from './nodes/ControlFlowNodes.js';
import { ParallelNode } from './nodes/ParallelNode.js';
import { AggregatorNode } from './nodes/AggregatorNode.js';
import { GroupNode } from './nodes/GroupNode.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Conditional edge mapping
 */
export interface ConditionalEdge {
  true?: string;
  false?: string;
}

/**
 * Transformed workflow structure
 */
export interface TransformedWorkflow {
  /** List of node IDs in the workflow */
  nodeIds: string[];
  /** Map of node ID to node instance */
  nodes: Record<string, BaseWorkflowNode>;
  /** Map of node ID to array of target node IDs (simple edges) */
  edges: Record<string, string[]>;
  /** Map of decision node ID to conditional edges */
  conditionalEdges: Record<string, ConditionalEdge>;
  /** Entry node ID */
  entryNodeId: string;
  /** Exit node ID */
  exitNodeId: string;
  /** Workflow metadata */
  metadata: WorkflowMetadata;
  /** Original connections for serialization */
  connections: ConnectionJSON[];
}

// ============================================================================
// WorkflowTransformer
// ============================================================================

/**
 * Static class for transforming Rete.js workflows
 */
export class WorkflowTransformer {
  /**
   * Transform a Rete.js workflow to an executable structure
   */
  static transform(workflow: ReteWorkflowJSON): TransformedWorkflow {
    const nodeIds: string[] = [];
    const nodes: Record<string, BaseWorkflowNode> = {};
    const edges: Record<string, string[]> = {};
    const conditionalEdges: Record<string, ConditionalEdge> = {};

    // Create node instances
    for (const nodeJson of workflow.nodes) {
      const node = this.createNodeInstance(nodeJson);
      nodes[node.id] = node;
      nodeIds.push(node.id);
    }

    // Build edge map from connections
    for (const connection of workflow.connections) {
      const sourceNode = nodes[connection.source];
      const targetNodeId = connection.target;

      // Check if this is a conditional edge (from decision node)
      if (sourceNode && sourceNode.type === 'control:decision') {
        if (!conditionalEdges[connection.source]) {
          conditionalEdges[connection.source] = {};
        }

        // Map output socket to condition
        if (connection.sourceOutput === 'true') {
          conditionalEdges[connection.source].true = targetNodeId;
        } else if (connection.sourceOutput === 'false') {
          conditionalEdges[connection.source].false = targetNodeId;
        }
      } else {
        // Simple edge
        if (!edges[connection.source]) {
          edges[connection.source] = [];
        }
        if (!edges[connection.source].includes(targetNodeId)) {
          edges[connection.source].push(targetNodeId);
        }
      }
    }

    return {
      nodeIds,
      nodes,
      edges,
      conditionalEdges,
      entryNodeId: workflow.entryNodeId,
      exitNodeId: workflow.exitNodeId,
      metadata: workflow.metadata,
      connections: workflow.connections,
    };
  }

  /**
   * Validate a Rete.js workflow
   */
  static validateWorkflow(workflow: ReteWorkflowJSON): ValidationResult {
    const errors: string[] = [];
    const nodeIdSet = new Set(workflow.nodes.map(n => n.id));

    // Check entry node exists
    if (!nodeIdSet.has(workflow.entryNodeId)) {
      errors.push(`Entry node not found: ${workflow.entryNodeId}`);
    }

    // Check exit node exists
    if (!nodeIdSet.has(workflow.exitNodeId)) {
      errors.push(`Exit node not found: ${workflow.exitNodeId}`);
    }

    // Build reachability from entry node
    const reachable = this.findReachableNodes(workflow);

    // Check for disconnected nodes
    for (const node of workflow.nodes) {
      if (!reachable.has(node.id) && node.id !== workflow.entryNodeId) {
        errors.push(`Node '${node.id}' is disconnected from the workflow`);
      }
    }

    // Check for cycles
    if (this.hasCycle(workflow)) {
      errors.push('Workflow contains a cycle, which is not allowed');
    }

    // Validate individual nodes
    for (const nodeJson of workflow.nodes) {
      // Check decision nodes have conditions
      if (nodeJson.type === 'control:decision' && !nodeJson.config.condition) {
        errors.push(`Decision node '${nodeJson.id}' requires a condition`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Find all nodes reachable from entry node
   * Also considers nodes referenced via config (e.g., targetNode in ParallelNode)
   */
  private static findReachableNodes(workflow: ReteWorkflowJSON): Set<string> {
    const reachable = new Set<string>();
    const visited = new Set<string>();
    const queue: string[] = [workflow.entryNodeId];

    // Build adjacency map from connections
    const adjacency = new Map<string, string[]>();
    for (const conn of workflow.connections) {
      if (!adjacency.has(conn.source)) {
        adjacency.set(conn.source, []);
      }
      adjacency.get(conn.source)!.push(conn.target);
    }

    // Build map of nodes that are referenced via config (e.g., targetNode, subgraph)
    const configReferences = this.findConfigReferencedNodes(workflow);

    // BFS to find all reachable nodes
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      reachable.add(nodeId);

      // Add nodes reachable via connections
      const neighbors = adjacency.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }

      // Add nodes reachable via config references (e.g., ParallelNode.targetNode)
      const configRefs = configReferences.get(nodeId) || [];
      for (const ref of configRefs) {
        if (!visited.has(ref)) {
          queue.push(ref);
        }
      }
    }

    return reachable;
  }

  /**
   * Find nodes referenced in node configs (e.g., targetNode in ParallelNode)
   */
  private static findConfigReferencedNodes(workflow: ReteWorkflowJSON): Map<string, string[]> {
    const references = new Map<string, string[]>();

    for (const node of workflow.nodes) {
      const refs: string[] = [];

      // ParallelNode: targetNode reference
      if (node.type === 'control:parallel' && node.config.targetNode) {
        refs.push(node.config.targetNode as string);
      }

      // GroupNode: subgraph node references
      if (node.type === 'control:group' && node.config.subgraph) {
        const subgraph = node.config.subgraph as { nodes?: Array<{ id: string }> };
        if (subgraph.nodes) {
          // Note: subgraph nodes are internal to the group, not in the main workflow
          // They don't need to be added to references as they're not in workflow.nodes
        }
      }

      if (refs.length > 0) {
        references.set(node.id, refs);
      }
    }

    return references;
  }

  /**
   * Check if workflow has a cycle using DFS
   */
  private static hasCycle(workflow: ReteWorkflowJSON): boolean {
    // Build adjacency map
    const adjacency = new Map<string, string[]>();
    for (const conn of workflow.connections) {
      if (!adjacency.has(conn.source)) {
        adjacency.set(conn.source, []);
      }
      adjacency.get(conn.source)!.push(conn.target);
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      if (visiting.has(nodeId)) return true; // Cycle detected
      if (visited.has(nodeId)) return false;

      visiting.add(nodeId);
      const neighbors = adjacency.get(nodeId) || [];

      for (const neighbor of neighbors) {
        if (dfs(neighbor)) return true;
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      return false;
    };

    // Start DFS from entry node
    return dfs(workflow.entryNodeId);
  }

  /**
   * Get execution order using topological sort
   */
  static getExecutionOrder(workflow: TransformedWorkflow): string[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    // Initialize in-degree and adjacency
    for (const nodeId of workflow.nodeIds) {
      inDegree.set(nodeId, 0);
      adjacency.set(nodeId, []);
    }

    // Build adjacency and calculate in-degrees from edges
    for (const [source, targets] of Object.entries(workflow.edges)) {
      for (const target of targets) {
        adjacency.get(source)!.push(target);
        inDegree.set(target, (inDegree.get(target) || 0) + 1);
      }
    }

    // Build adjacency and calculate in-degrees from conditional edges
    for (const [source, conditions] of Object.entries(workflow.conditionalEdges)) {
      if (conditions.true) {
        adjacency.get(source)!.push(conditions.true);
        inDegree.set(conditions.true, (inDegree.get(conditions.true) || 0) + 1);
      }
      if (conditions.false) {
        adjacency.get(source)!.push(conditions.false);
        inDegree.set(conditions.false, (inDegree.get(conditions.false) || 0) + 1);
      }
    }

    // Kahn's algorithm for topological sort
    const queue: string[] = [];
    const result: string[] = [];

    // Find all nodes with in-degree 0
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      result.push(nodeId);

      const neighbors = adjacency.get(nodeId) || [];
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    return result;
  }

  /**
   * Create a node instance from JSON definition
   */
  static createNodeInstance(nodeJson: WorkflowNodeJSON): BaseWorkflowNode {
    const { id, type, config, label, position } = nodeJson;

    let node: BaseWorkflowNode;

    switch (type) {
      case 'io:start':
        node = new StartNode(id, config);
        break;

      case 'io:end':
        node = new EndNode(id, config);
        break;

      case 'control:decision':
        node = new DecisionNode(id, config);
        break;

      case 'io:transform':
        node = new DataTransformNode(id, config);
        break;

      // AI Task nodes - create generic placeholders for now
      // These will be replaced with actual implementations in Phase 2
      case 'preset:engineer':
      case 'preset:reviewer':
      case 'preset:product-owner':
      case 'preset:merge-coordinator':
      case 'preset:conflict-resolver':
      case 'preset:test-runner':
      case 'preset:director':
      case 'preset:sprint-planning':
      case 'ai:custom':
        node = new GenericAITaskNode(id, type, config);
        break;

      // Control flow nodes - create actual instances for parallel execution
      case 'control:parallel':
        node = new ParallelNode(id, config);
        break;

      case 'control:aggregator':
        node = new AggregatorNode(id, config);
        break;

      case 'control:group':
        node = new GroupNode(id, config);
        break;

      case 'control:loop':
        node = new GenericControlFlowNode(id, type, config);
        break;

      // Git operation nodes - create generic placeholders
      case 'git:merge':
      case 'git:conflict-resolver':
      case 'git:branch-manager':
        node = new GenericGitOperationNode(id, type, config);
        break;

      default:
        throw new Error(`Unknown node type: ${type}`);
    }

    // Set label and position
    node.label = label;
    node.setPosition(position.x, position.y);

    return node;
  }

  // ==========================================================================
  // Graph Validation Methods
  // ==========================================================================

  /**
   * Detect cycles in a workflow graph
   * Uses DFS with color marking (white/gray/black)
   */
  detectCycles(workflow: ReteWorkflowJSON): boolean {
    const adjacencyList = this.buildAdjacencyList(workflow);
    const WHITE = 0; // Unvisited
    const GRAY = 1;  // In progress
    const BLACK = 2; // Completed

    const colors = new Map<string, number>();
    for (const node of workflow.nodes) {
      colors.set(node.id, WHITE);
    }

    const hasCycleDFS = (nodeId: string): boolean => {
      colors.set(nodeId, GRAY);

      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        const color = colors.get(neighbor);
        if (color === GRAY) {
          // Back edge found - cycle detected
          return true;
        }
        if (color === WHITE && hasCycleDFS(neighbor)) {
          return true;
        }
      }

      colors.set(nodeId, BLACK);
      return false;
    };

    // Check for cycles starting from each unvisited node
    for (const node of workflow.nodes) {
      if (colors.get(node.id) === WHITE) {
        if (hasCycleDFS(node.id)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Find nodes not reachable from start nodes
   */
  findDisconnectedNodes(workflow: ReteWorkflowJSON): string[] {
    const startNodes = workflow.nodes.filter((n) => n.type === 'start');
    const reachable = new Set<string>();
    const adjacencyList = this.buildAdjacencyList(workflow);

    // BFS from all start nodes
    const queue: string[] = startNodes.map((n) => n.id);
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (reachable.has(current)) continue;
      reachable.add(current);

      const neighbors = adjacencyList.get(current) || [];
      for (const neighbor of neighbors) {
        if (!reachable.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }

    // Find nodes not in reachable set
    return workflow.nodes
      .filter((n) => !reachable.has(n.id) && n.type !== 'start')
      .map((n) => n.id);
  }

  /**
   * Find nodes that don't lead to any end node (dead ends)
   */
  findDeadEndNodes(workflow: ReteWorkflowJSON): string[] {
    const endNodes = workflow.nodes.filter((n) => n.type === 'end');
    const canReachEnd = new Set<string>();
    const reverseAdjacencyList = this.buildReverseAdjacencyList(workflow);

    // BFS backwards from all end nodes
    const queue: string[] = endNodes.map((n) => n.id);
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (canReachEnd.has(current)) continue;
      canReachEnd.add(current);

      const predecessors = reverseAdjacencyList.get(current) || [];
      for (const predecessor of predecessors) {
        if (!canReachEnd.has(predecessor)) {
          queue.push(predecessor);
        }
      }
    }

    // Find nodes that can't reach end (excluding end nodes themselves)
    return workflow.nodes
      .filter((n) => !canReachEnd.has(n.id) && n.type !== 'end')
      .map((n) => n.id);
  }

  /**
   * Build adjacency list from workflow edges
   */
  private buildAdjacencyList(workflow: ReteWorkflowJSON): Map<string, string[]> {
    const adjacencyList = new Map<string, string[]>();

    for (const node of workflow.nodes) {
      adjacencyList.set(node.id, []);
    }

    for (const edge of workflow.edges || []) {
      const neighbors = adjacencyList.get(edge.source) || [];
      neighbors.push(edge.target);
      adjacencyList.set(edge.source, neighbors);
    }

    return adjacencyList;
  }

  /**
   * Build reverse adjacency list (target -> sources)
   */
  private buildReverseAdjacencyList(workflow: ReteWorkflowJSON): Map<string, string[]> {
    const reverseAdjacencyList = new Map<string, string[]>();

    for (const node of workflow.nodes) {
      reverseAdjacencyList.set(node.id, []);
    }

    for (const edge of workflow.edges || []) {
      const predecessors = reverseAdjacencyList.get(edge.target) || [];
      predecessors.push(edge.source);
      reverseAdjacencyList.set(edge.target, predecessors);
    }

    return reverseAdjacencyList;
  }

  /**
   * Serialize a transformed workflow back to JSON format
   */
  static serializeWorkflow(workflow: TransformedWorkflow): ReteWorkflowJSON {
    const nodes: WorkflowNodeJSON[] = workflow.nodeIds.map(nodeId => {
      const node = workflow.nodes[nodeId];
      return node.toJSON();
    });

    return {
      version: '1.0.0',
      metadata: workflow.metadata,
      nodes,
      connections: workflow.connections,
      entryNodeId: workflow.entryNodeId,
      exitNodeId: workflow.exitNodeId,
    };
  }
}

// ============================================================================
// Generic Node Classes (Placeholders)
// ============================================================================

/**
 * Generic AI Task Node (placeholder implementation)
 */
class GenericAITaskNode extends BaseWorkflowNode {
  constructor(id: string, type: string, config: NodeConfig) {
    super({
      id,
      type: type as any,
      label: `AI Task (${type})`,
      description: 'Generic AI task node placeholder',
      inputs: [
        {
          id: 'task',
          name: 'Task',
          type: 'data',
          dataType: 'string',
          required: true,
        },
      ],
      outputs: [
        {
          id: 'result',
          name: 'Result',
          type: 'data',
          dataType: 'object',
          required: true,
        },
      ],
      config,
    });
  }

  async execute(context: import('./types.js').ExecutionContext): Promise<import('./types.js').NodeResult> {
    // Placeholder implementation
    const task = context.inputs.task;
    return {
      success: true,
      outputs: {
        result: {
          message: `Executed AI task: ${task}`,
          nodeType: this.type,
        },
      },
    };
  }
}

/**
 * Generic Control Flow Node (placeholder implementation)
 */
class GenericControlFlowNode extends BaseWorkflowNode {
  constructor(id: string, type: string, config: NodeConfig) {
    super({
      id,
      type: type as any,
      label: `Control Flow (${type})`,
      description: 'Generic control flow node placeholder',
      inputs: [
        {
          id: 'input',
          name: 'Input',
          type: 'any',
          required: true,
        },
      ],
      outputs: [
        {
          id: 'output',
          name: 'Output',
          type: 'any',
          required: true,
        },
      ],
      config,
    });
  }

  async execute(context: import('./types.js').ExecutionContext): Promise<import('./types.js').NodeResult> {
    // Placeholder implementation
    return {
      success: true,
      outputs: {
        output: context.inputs.input,
      },
    };
  }
}

/**
 * Generic Git Operation Node (placeholder implementation)
 */
class GenericGitOperationNode extends BaseWorkflowNode {
  constructor(id: string, type: string, config: NodeConfig) {
    super({
      id,
      type: type as any,
      label: `Git Operation (${type})`,
      description: 'Generic Git operation node placeholder',
      inputs: [
        {
          id: 'input',
          name: 'Input',
          type: 'any',
          required: true,
        },
      ],
      outputs: [
        {
          id: 'output',
          name: 'Output',
          type: 'any',
          required: true,
        },
      ],
      config,
    });
  }

  async execute(context: import('./types.js').ExecutionContext): Promise<import('./types.js').NodeResult> {
    // Placeholder implementation
    return {
      success: true,
      outputs: {
        output: context.inputs.input,
      },
    };
  }
}
