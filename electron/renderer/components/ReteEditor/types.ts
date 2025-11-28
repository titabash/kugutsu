/**
 * Rete.js Editor Types
 *
 * Type definitions for the Rete.js visual workflow editor.
 */

import { ClassicPreset } from 'rete';
import type { ReactArea2D } from 'rete-react-plugin';

/**
 * Base WorkflowNode class with parent support for scopes
 *
 * Note: rete-scopes-plugin requires explicit width and height for drag-drop nesting.
 * All nodes must have dimensions set for the plugin to work correctly.
 * Height is calculated dynamically based on the number of controls.
 */
export class WorkflowNode extends ClassicPreset.Node {
  /** Parent node ID for scopes */
  parent?: string;
  /** Node type */
  nodeType?: WorkflowNodeType;
  /** Node configuration */
  config?: Record<string, unknown>;

  // Default dimensions required by rete-scopes-plugin
  override width = 200;
  override height = 150;

  /**
   * Update size based on node type and content
   * Height is calculated dynamically based on controls, inputs, and outputs
   */
  updateSize(): void {
    // Base height includes title bar
    const titleHeight = 50;
    const controlHeight = 40;
    const textAreaHeight = 80;
    const socketHeight = 30;
    const padding = 20;

    // Count controls
    const controlCount = Object.keys(this.controls).length;
    // Check if any control is a TextArea (needs more height)
    const hasTextArea = this.nodeType && ['engineer', 'reviewer', 'product-owner', 'custom-ai'].includes(this.nodeType);

    // Count sockets
    const inputCount = Object.keys(this.inputs).length;
    const outputCount = Object.keys(this.outputs).length;
    const socketRows = Math.max(inputCount, outputCount);

    if (this.nodeType === 'parallel-group') {
      // Parallel group is a container - needs larger dimensions
      this.width = 400;
      this.height = 300;
    } else if (this.nodeType === 'start') {
      // Start node is minimal
      this.width = 180;
      this.height = titleHeight + socketHeight + padding;
    } else {
      // Dynamic size for regular nodes
      this.width = 220;

      // Calculate height based on content
      let calculatedHeight = titleHeight;

      // Add height for controls
      if (hasTextArea) {
        // AI nodes have a dropdown + textarea
        calculatedHeight += controlHeight + textAreaHeight;
      } else {
        calculatedHeight += controlCount * controlHeight;
      }

      // Add height for sockets
      calculatedHeight += socketRows * socketHeight;

      // Add padding
      calculatedHeight += padding;

      // Ensure minimum height
      this.height = Math.max(calculatedHeight, 120);
    }
  }
}

/**
 * Node schemes for Rete.js with parent support
 */
export type Schemes = ClassicPreset.GetSchemes<
  WorkflowNode,
  ClassicPreset.Connection<WorkflowNode, WorkflowNode>
>;

/**
 * Area extra types for React plugin
 */
export type AreaExtra = ReactArea2D<Schemes>;

/**
 * Node types supported by the editor
 */
export type WorkflowNodeType =
  | 'start'
  | 'end'
  | 'decision'
  | 'transform'
  | 'engineer'
  | 'reviewer'
  | 'product-owner'
  | 'parallel'
  | 'aggregator'
  | 'group'
  | 'parallel-group'
  | 'merge'
  | 'custom-ai';

/**
 * Node category for palette organization
 */
export interface NodeCategory {
  id: string;
  name: string;
  icon: string;
  nodes: NodePaletteItem[];
}

/**
 * Node item for palette
 */
export interface NodePaletteItem {
  type: WorkflowNodeType;
  label: string;
  icon: string;
  description: string;
}

/**
 * Node status for execution visualization
 */
export type NodeStatus = 'idle' | 'executing' | 'completed' | 'failed';

/**
 * Editor state
 */
export interface EditorState {
  isReady: boolean;
  zoom: number;
  gridEnabled: boolean;
  selectedNodeId: string | null;
  isExecuting: boolean;
  executionProgress: number;
  nodeStatuses: Record<string, NodeStatus>;
}

/**
 * Editor actions
 */
export interface EditorActions {
  addNode: (type: WorkflowNodeType, position: { x: number; y: number }) => void;
  removeNode: (nodeId: string) => void;
  selectNode: (nodeId: string | null) => void;
  setZoom: (zoom: number) => void;
  toggleGrid: () => void;
  clearEditor: () => void;
  exportWorkflow: () => unknown;
  importWorkflow: (workflow: unknown) => void;
}

/**
 * Node color scheme based on type
 */
export const NODE_COLORS: Record<WorkflowNodeType, string> = {
  start: '#10b981',      // Green
  end: '#ef4444',        // Red
  decision: '#eab308',   // Yellow
  transform: '#6b7280',  // Gray
  engineer: '#3b82f6',   // Blue
  reviewer: '#10b981',   // Green
  'product-owner': '#a855f7', // Purple
  parallel: '#8b5cf6',   // Purple
  aggregator: '#f59e0b', // Orange
  group: '#8b5cf6',      // Purple
  'parallel-group': '#7c3aed', // Violet - container for parallel execution
  merge: '#6b7280',      // Gray
  'custom-ai': '#06b6d4', // Cyan
};

/**
 * Node icons based on type
 */
export const NODE_ICONS: Record<WorkflowNodeType, string> = {
  start: '▶️',
  end: '⏹️',
  decision: '◆',
  transform: '🔄',
  engineer: '👨‍💻',
  reviewer: '✅',
  'product-owner': '📋',
  parallel: '⫸',
  aggregator: '⫷',
  group: '⫸⫸',
  'parallel-group': '📦',
  merge: '🔀',
  'custom-ai': '🤖',
};

/**
 * Default node categories for palette
 */
export const DEFAULT_NODE_CATEGORIES: NodeCategory[] = [
  {
    id: 'io',
    name: '🚀 Start/End',
    icon: '🚀',
    nodes: [
      { type: 'start', label: 'Start', icon: '▶️', description: 'Workflow entry point' },
      { type: 'end', label: 'End', icon: '⏹️', description: 'Workflow exit point' },
      { type: 'transform', label: 'Transform', icon: '🔄', description: 'Transform data' },
    ],
  },
  {
    id: 'ai',
    name: '🤖 AI Tasks',
    icon: '🤖',
    nodes: [
      { type: 'engineer', label: 'Engineer', icon: '👨‍💻', description: 'AI code implementation' },
      { type: 'reviewer', label: 'Reviewer', icon: '✅', description: 'AI code review' },
      { type: 'product-owner', label: 'Product Owner', icon: '📋', description: 'Requirements analysis' },
      { type: 'custom-ai', label: 'Custom AI', icon: '🤖', description: 'Custom AI task' },
    ],
  },
  {
    id: 'control',
    name: '⚡ Control Flow',
    icon: '⚡',
    nodes: [
      { type: 'decision', label: 'Decision', icon: '◆', description: 'Conditional branching' },
      { type: 'parallel-group', label: 'Parallel Group', icon: '📦', description: 'Container for parallel execution' },
    ],
  },
  {
    id: 'git',
    name: '📦 Git Operations',
    icon: '📦',
    nodes: [
      { type: 'merge', label: 'Merge', icon: '🔀', description: 'Merge branches' },
    ],
  },
];
