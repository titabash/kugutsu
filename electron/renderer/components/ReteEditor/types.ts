/**
 * Rete.js Editor Types
 *
 * Type definitions for the Rete.js visual workflow editor.
 */

import type { ClassicPreset } from 'rete';
import type { ReactArea2D } from 'rete-react-plugin';

/**
 * Node schemes for Rete.js
 */
export type Schemes = ClassicPreset.GetSchemes<
  ClassicPreset.Node,
  ClassicPreset.Connection<ClassicPreset.Node, ClassicPreset.Node>
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
      { type: 'parallel', label: 'Parallel', icon: '⫸', description: 'Parallel execution' },
      { type: 'aggregator', label: 'Aggregator', icon: '⫷', description: 'Collect parallel results' },
      { type: 'group', label: 'Parallel Group', icon: '⫸⫸', description: 'Parallel subgraph' },
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
