/**
 * Design Tokens for Rete.js Workflow Editor
 *
 * n8n/Zapier inspired design system with category-based colors.
 * All constants follow a consistent pattern for easy maintenance.
 */

import type { WorkflowNodeType } from '../types';

// ============================================================================
// Node Category Types
// ============================================================================

/**
 * Node categories for color grouping
 * - io: Input/Output nodes (start, end)
 * - ai: AI-powered nodes (engineer, reviewer, etc.)
 * - control: Control flow nodes (decision, parallel-group)
 * - git: Git operations (merge)
 * - data: Data transformation (transform, aggregator)
 */
export type NodeCategory = 'io' | 'ai' | 'control' | 'git' | 'data';

/**
 * Color scheme for each category
 */
export interface CategoryColors {
  /** Primary color for header background */
  primary: string;
  /** Border color */
  border: string;
  /** Light background color for badges/indicators */
  bg: string;
}

// ============================================================================
// Category Colors (n8n-inspired palette)
// ============================================================================

/**
 * Color palette for each node category
 *
 * Colors chosen to match n8n's visual style:
 * - io: Green (#10b981) - represents start/end points
 * - ai: Blue (#3b82f6) - represents AI/intelligent operations
 * - control: Orange (#f59e0b) - represents flow control
 * - git: Purple (#8b5cf6) - represents version control
 * - data: Gray (#6b7280) - represents data transformation
 */
export const NODE_CATEGORY_COLORS: Record<NodeCategory, CategoryColors> = {
  io: {
    primary: '#10b981',
    border: '#059669',
    bg: '#d1fae5',
  },
  ai: {
    primary: '#3b82f6',
    border: '#2563eb',
    bg: '#dbeafe',
  },
  control: {
    primary: '#f59e0b',
    border: '#d97706',
    bg: '#fef3c7',
  },
  git: {
    primary: '#8b5cf6',
    border: '#7c3aed',
    bg: '#ede9fe',
  },
  data: {
    primary: '#6b7280',
    border: '#4b5563',
    bg: '#f3f4f6',
  },
};

// ============================================================================
// Node Type to Category Mapping
// ============================================================================

/**
 * Maps each workflow node type to its category
 */
export const NODE_TYPE_CATEGORY: Record<WorkflowNodeType, NodeCategory> = {
  // IO nodes - entry and exit points
  start: 'io',
  end: 'io',
  'subgraph-start': 'io',  // ParallelGroup internal start
  'subgraph-end': 'io',    // ParallelGroup internal end

  // AI nodes - intelligent automation
  engineer: 'ai',
  reviewer: 'ai',
  'product-owner': 'ai',
  'custom-ai': 'ai',

  // Control flow nodes
  decision: 'control',
  'parallel-group': 'control',
  parallel: 'control',
  group: 'control',

  // Git operations
  merge: 'git',

  // Data transformation
  transform: 'data',
  aggregator: 'data',
};

// ============================================================================
// Node Size Constants
// ============================================================================

/**
 * Size constants for consistent node rendering
 *
 * Key improvements from the original:
 * - Larger socket size (12px vs ~8px) for better visibility
 * - Large hit area (24px) for easier connection creation
 * - Modern border radius (12px) for card-like appearance
 */
export const NODE_SIZES = {
  /** Minimum node width in pixels */
  minWidth: 220,

  /** Socket visible diameter in pixels */
  socketSize: 12,

  /** Socket clickable area diameter in pixels */
  socketHitArea: 24,

  /** Border radius for card-like appearance */
  borderRadius: 12,

  /** Header height in pixels */
  headerHeight: 44,

  /** Control vertical padding */
  controlPadding: 12,

  /** Socket label font size */
  socketLabelSize: 12,

  /** Node title font size */
  titleFontSize: 14,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the category for a node type
 *
 * @param nodeType - The workflow node type
 * @returns The category of the node
 */
export function getNodeCategory(nodeType: WorkflowNodeType): NodeCategory {
  return NODE_TYPE_CATEGORY[nodeType];
}

/**
 * Get the color scheme for a node type
 *
 * @param nodeType - The workflow node type
 * @returns The category colors for the node
 */
export function getNodeCategoryColor(nodeType: WorkflowNodeType): CategoryColors {
  const category = getNodeCategory(nodeType);
  return NODE_CATEGORY_COLORS[category];
}

// ============================================================================
// Typography Constants
// ============================================================================

/**
 * Typography settings for consistent text rendering
 */
export const TYPOGRAPHY = {
  nodeTitle: {
    fontSize: '14px',
    fontWeight: 600,
  },
  nodeSubtitle: {
    fontSize: '12px',
    fontWeight: 400,
    color: '#9ca3af',
  },
  socketLabel: {
    fontSize: '12px',
    fontWeight: 500,
  },
  controlLabel: {
    fontSize: '12px',
    fontWeight: 500,
  },
};

// ============================================================================
// Animation Constants
// ============================================================================

/**
 * Animation durations for consistent motion design
 */
export const ANIMATIONS = {
  /** Fast animations (hover, focus) */
  fast: '150ms',
  /** Medium animations (expand, collapse) */
  medium: '200ms',
  /** Slow animations (page transitions) */
  slow: '300ms',
};

// ============================================================================
// Spacing Constants
// ============================================================================

/**
 * Spacing scale for consistent layout
 */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};
