/**
 * NodeFactory
 *
 * Factory class for creating workflow nodes from JSON definitions.
 * Implements the Singleton pattern and supports:
 * - Built-in node types (start, end, decision, etc.)
 * - Preset node types (preset:engineer, preset:reviewer, etc.)
 * - Custom node type registration
 */

import {
  StartNode,
  EndNode,
  DecisionNode,
  DataTransformNode,
} from './nodes/ControlFlowNodes.js';
import { ParallelNode } from './nodes/ParallelNode.js';
import { AggregatorNode } from './nodes/AggregatorNode.js';
import { GroupNode } from './nodes/GroupNode.js';
import { EngineerNode } from './nodes/preset/EngineerNode.js';
import { ReviewerNode } from './nodes/preset/ReviewerNode.js';
import { ProductOwnerNode } from './nodes/preset/ProductOwnerNode.js';
import { MergeCoordinatorNode } from './nodes/preset/MergeCoordinatorNode.js';
import { ConflictResolverNode } from './nodes/preset/ConflictResolverNode.js';
import { TestRunnerNode } from './nodes/preset/TestRunnerNode.js';
import type { BaseWorkflowNode } from './nodes/BaseWorkflowNode.js';
import type { WorkflowNodeJSON } from './types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Node creator function type
 */
export type NodeCreator = (json: WorkflowNodeJSON) => BaseWorkflowNode;

/**
 * Node category type
 */
export type NodeCategory =
  | 'control-flow'
  | 'data'
  | 'parallel'
  | 'ai-task'
  | 'git-operation'
  | 'custom';

/**
 * Node type information
 */
export interface NodeTypeInfo {
  /** Node type name */
  name: string;
  /** Category */
  category: NodeCategory;
  /** Description */
  description: string;
  /** Whether this is a built-in type */
  builtIn: boolean;
}

/**
 * Registration options
 */
export interface RegistrationOptions {
  /** Force overwrite existing registration */
  force?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Built-in node types mapping
 */
const BUILT_IN_TYPES: ReadonlyArray<string> = [
  'start',
  'end',
  'decision',
  'data-transform',
  'parallel',
  'aggregator',
  'group',
] as const;

/**
 * Preset node types mapping
 */
const PRESET_TYPES: ReadonlyArray<string> = [
  'preset:engineer',
  'preset:reviewer',
  'preset:product-owner',
  'preset:merge-coordinator',
  'preset:conflict-resolver',
  'preset:test-runner',
] as const;

/**
 * Node type metadata
 */
const NODE_TYPE_INFO: Record<string, NodeTypeInfo> = {
  // Built-in types
  start: {
    name: 'Start',
    category: 'control-flow',
    description: 'Workflow entry point',
    builtIn: true,
  },
  end: {
    name: 'End',
    category: 'control-flow',
    description: 'Workflow exit point',
    builtIn: true,
  },
  decision: {
    name: 'Decision',
    category: 'control-flow',
    description: 'Conditional branching',
    builtIn: true,
  },
  'data-transform': {
    name: 'Data Transform',
    category: 'data',
    description: 'Transform input data',
    builtIn: true,
  },
  parallel: {
    name: 'Parallel',
    category: 'parallel',
    description: 'Parallel execution of tasks',
    builtIn: true,
  },
  aggregator: {
    name: 'Aggregator',
    category: 'parallel',
    description: 'Aggregate parallel results',
    builtIn: true,
  },
  group: {
    name: 'Group',
    category: 'parallel',
    description: 'Subgraph parallel execution',
    builtIn: true,
  },
  // Preset types
  'preset:engineer': {
    name: 'Engineer',
    category: 'ai-task',
    description: 'AI software engineer for implementation tasks',
    builtIn: true,
  },
  'preset:reviewer': {
    name: 'Reviewer',
    category: 'ai-task',
    description: 'AI code reviewer for quality assurance',
    builtIn: true,
  },
  'preset:product-owner': {
    name: 'Product Owner',
    category: 'ai-task',
    description: 'AI product owner for requirements analysis',
    builtIn: true,
  },
  'preset:merge-coordinator': {
    name: 'Merge Coordinator',
    category: 'git-operation',
    description: 'Coordinate branch merging operations',
    builtIn: true,
  },
  'preset:conflict-resolver': {
    name: 'Conflict Resolver',
    category: 'git-operation',
    description: 'AI-driven merge conflict resolution',
    builtIn: true,
  },
  'preset:test-runner': {
    name: 'Test Runner',
    category: 'ai-task',
    description: 'AI-assisted test execution and analysis',
    builtIn: true,
  },
};

// ============================================================================
// NodeFactory
// ============================================================================

/**
 * NodeFactory - Singleton factory for creating workflow nodes
 */
export class NodeFactory {
  private static instance: NodeFactory | null = null;
  private customCreators: Map<string, NodeCreator> = new Map();
  private customTypeInfo: Map<string, NodeTypeInfo> = new Map();

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    // Initialize with no custom nodes
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): NodeFactory {
    if (!NodeFactory.instance) {
      NodeFactory.instance = new NodeFactory();
    }
    return NodeFactory.instance;
  }

  /**
   * Create a single node from JSON
   */
  static createNode(json: WorkflowNodeJSON): BaseWorkflowNode {
    return NodeFactory.getInstance().createNodeInstance(json);
  }

  /**
   * Create multiple nodes from JSON array
   */
  static createNodes(jsonArray: WorkflowNodeJSON[]): BaseWorkflowNode[] {
    return jsonArray.map((json) => NodeFactory.createNode(json));
  }

  /**
   * Internal method to create a node instance
   */
  private createNodeInstance(json: WorkflowNodeJSON): BaseWorkflowNode {
    const type = json.type as string;

    // Check for custom node type first
    if (this.customCreators.has(type)) {
      const creator = this.customCreators.get(type)!;
      const node = creator(json);
      node.setPosition(json.position.x, json.position.y);
      return node;
    }

    // Create built-in or preset node
    let node: BaseWorkflowNode;

    switch (type) {
      // Built-in types
      case 'start':
        node = new StartNode(json.id, json.config);
        break;
      case 'end':
        node = new EndNode(json.id, json.config);
        break;
      case 'decision':
        node = new DecisionNode(json.id, json.config);
        break;
      case 'data-transform':
        node = new DataTransformNode(json.id, json.config);
        break;
      case 'parallel':
        node = new ParallelNode(json.id, json.config);
        break;
      case 'aggregator':
        node = new AggregatorNode(json.id, json.config);
        break;
      case 'group':
        node = new GroupNode(json.id, json.config);
        break;
      // Preset types
      case 'preset:engineer':
        node = new EngineerNode(json.id, { ...json.config, label: json.label });
        break;
      case 'preset:reviewer':
        node = new ReviewerNode(json.id, { ...json.config, label: json.label });
        break;
      case 'preset:product-owner':
        node = new ProductOwnerNode(json.id, { ...json.config, label: json.label });
        break;
      case 'preset:merge-coordinator':
        node = new MergeCoordinatorNode(json.id, { ...json.config, label: json.label });
        break;
      case 'preset:conflict-resolver':
        node = new ConflictResolverNode(json.id, { ...json.config, label: json.label });
        break;
      case 'preset:test-runner':
        node = new TestRunnerNode(json.id, { ...json.config, label: json.label });
        break;
      default:
        throw new Error(`Unknown node type: ${type}`);
    }

    // Set position
    node.setPosition(json.position.x, json.position.y);

    return node;
  }

  /**
   * Register a custom node type
   */
  registerCustomNode(
    type: string,
    creator: NodeCreator,
    options: RegistrationOptions = {}
  ): void {
    // Check if type is already registered
    if (this.isRegisteredType(type) && !options.force) {
      throw new Error(`Node type "${type}" is already registered`);
    }

    this.customCreators.set(type, creator);

    // Add custom type info
    this.customTypeInfo.set(type, {
      name: type,
      category: 'custom',
      description: 'Custom node type',
      builtIn: false,
    });
  }

  /**
   * Unregister a custom node type
   */
  unregisterCustomNode(type: string): void {
    // Check if it's a built-in type
    if (this.isBuiltInType(type)) {
      throw new Error(`Cannot unregister built-in node type: ${type}`);
    }

    this.customCreators.delete(type);
    this.customTypeInfo.delete(type);
  }

  /**
   * Clear all custom nodes
   */
  clearCustomNodes(): void {
    this.customCreators.clear();
    this.customTypeInfo.clear();
  }

  /**
   * Get all registered types
   */
  getRegisteredTypes(): string[] {
    return [
      ...BUILT_IN_TYPES,
      ...PRESET_TYPES,
      ...this.customCreators.keys(),
    ];
  }

  /**
   * Get built-in types only
   */
  getBuiltInTypes(): string[] {
    return [...BUILT_IN_TYPES, ...PRESET_TYPES];
  }

  /**
   * Get custom types only
   */
  getCustomTypes(): string[] {
    return Array.from(this.customCreators.keys());
  }

  /**
   * Check if a type is registered
   */
  isRegisteredType(type: string): boolean {
    return (
      BUILT_IN_TYPES.includes(type) ||
      PRESET_TYPES.includes(type) ||
      this.customCreators.has(type)
    );
  }

  /**
   * Check if a type is built-in
   */
  isBuiltInType(type: string): boolean {
    return BUILT_IN_TYPES.includes(type) || PRESET_TYPES.includes(type);
  }

  /**
   * Get node type information
   */
  getNodeTypeInfo(type: string): NodeTypeInfo | undefined {
    // Check built-in first
    if (NODE_TYPE_INFO[type]) {
      return NODE_TYPE_INFO[type];
    }

    // Check custom types
    return this.customTypeInfo.get(type);
  }

  /**
   * Get node category
   */
  getNodeCategory(type: string): NodeCategory | undefined {
    const info = this.getNodeTypeInfo(type);
    return info?.category;
  }

  /**
   * Get types by category
   */
  getTypesByCategory(category: NodeCategory): string[] {
    const types: string[] = [];

    // Check built-in types
    for (const [type, info] of Object.entries(NODE_TYPE_INFO)) {
      if (info.category === category) {
        types.push(type);
      }
    }

    // Check custom types
    for (const [type, info] of this.customTypeInfo.entries()) {
      if (info.category === category) {
        types.push(type);
      }
    }

    return types;
  }
}

export default NodeFactory;
