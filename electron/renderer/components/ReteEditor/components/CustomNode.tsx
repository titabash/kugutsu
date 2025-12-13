/**
 * CustomNode - n8n-style node component for Rete.js
 *
 * Features:
 * - Category-based header colors
 * - Lucide icons for each node type
 * - Selection ring highlight
 * - Status indicators (running, completed, error)
 * - Large socket targets
 */

import React from 'react';
import {
  Play,
  StopCircle,
  Bot,
  GitMerge,
  Split,
  Users,
  ClipboardList,
  Workflow,
  Settings,
  Box,
  Code,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NODE_CATEGORY_COLORS, getNodeCategory, getNodeCategoryColor } from '../styles/design-tokens';
import type { WorkflowNode, WorkflowNodeType } from '../types';

// ============================================================================
// Node Icons Mapping
// ============================================================================

const NODE_ICONS: Record<WorkflowNodeType, LucideIcon> = {
  start: Play,
  end: StopCircle,
  'subgraph-start': Play,
  'subgraph-end': StopCircle,
  decision: Split,
  transform: Workflow,
  engineer: Code,
  reviewer: Users,
  'product-owner': ClipboardList,
  parallel: Workflow,
  aggregator: GitMerge,
  group: Box,
  'parallel-group': Box,
  merge: GitMerge,
  'custom-ai': Bot,
};

// ============================================================================
// Status Colors
// ============================================================================

const STATUS_COLORS = {
  idle: 'transparent',
  running: '#fbbf24', // yellow
  completed: '#10b981', // green
  error: '#ef4444', // red
};

// ============================================================================
// CustomNode Component
// ============================================================================

interface CustomNodeProps {
  data: WorkflowNode;
  emit: (data: unknown) => void;
  selected?: boolean;
}

export function CustomNode({ data, emit, selected = false }: CustomNodeProps) {
  const nodeType = data.nodeType || 'transform';
  const category = getNodeCategory(nodeType);
  const colors = getNodeCategoryColor(nodeType);
  const Icon = NODE_ICONS[nodeType] || Settings;

  // Get status from config
  const status = (data.config?.status as string) || 'idle';
  const showStatus = status !== 'idle';

  // Check if this is a subgraph node (small pill-shaped)
  const isSubgraphNode = nodeType === 'subgraph-start' || nodeType === 'subgraph-end';

  // Render compact pill-shaped node for subgraph start/end
  if (isSubgraphNode) {
    return (
      <div
        data-testid="node-wrapper"
        className={cn(
          'relative flex items-center justify-center gap-2 px-4 py-2 shadow-md transition-all',
          selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
        )}
        style={{
          backgroundColor: colors.primary,
          borderRadius: '25px',
          minWidth: '100px',
          minHeight: '50px',
          border: `2px solid ${colors.border}`,
        }}
      >
        <Icon
          data-testid="node-icon"
          className="w-4 h-4 text-white"
        />
        <span
          data-testid="node-header"
          className="text-white font-semibold text-xs"
        >
          {data.label}
        </span>

        {/* Status Indicator */}
        {showStatus && (
          <div
            data-testid="status-indicator"
            className={cn(
              'absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white',
              status === 'running' && 'animate-pulse'
            )}
            style={{ backgroundColor: STATUS_COLORS[status as keyof typeof STATUS_COLORS] }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      data-testid="node-wrapper"
      className={cn(
        'bg-card border-2 rounded-xl shadow-md transition-all min-w-[180px]',
        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )}
      style={{ borderColor: colors.border }}
    >
      {/* Header */}
      <div
        data-testid="node-header"
        className="px-3 py-2 rounded-t-[10px] flex items-center gap-2"
        style={{ backgroundColor: colors.primary }}
      >
        <Icon
          data-testid="node-icon"
          className="w-4 h-4 text-white"
        />
        <span className="text-white font-semibold text-sm truncate">{data.label}</span>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        {/* Sockets and controls would be rendered here by Rete.js */}
        {/* This is a placeholder for the socket/control areas */}
      </div>

      {/* Status Indicator */}
      {showStatus && (
        <div
          data-testid="status-indicator"
          className={cn(
            'absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-card',
            status === 'running' && 'animate-pulse'
          )}
          style={{ backgroundColor: STATUS_COLORS[status as keyof typeof STATUS_COLORS] }}
        />
      )}
    </div>
  );
}

export default CustomNode;
