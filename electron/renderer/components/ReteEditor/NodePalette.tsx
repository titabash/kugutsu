/**
 * NodePalette
 *
 * Modern categorized list of nodes that can be dragged onto the canvas.
 * Uses shadcn/ui components with Lucide icons.
 */

import React, { useState, useMemo } from 'react';
import {
  Play,
  StopCircle,
  Bot,
  GitMerge,
  Split,
  Users,
  ClipboardList,
  Workflow,
  Code,
  Box,
  ChevronRight,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { NODE_CATEGORY_COLORS, getNodeCategory } from './styles/design-tokens';
import { type WorkflowNodeType, type NodeCategory, type NodePaletteItem } from './types';

// ============================================================================
// Lucide Icon Mapping
// ============================================================================

const NODE_LUCIDE_ICONS: Record<WorkflowNodeType, LucideIcon> = {
  start: Play,
  end: StopCircle,
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
// Default Categories with Lucide Icons
// ============================================================================

export const DEFAULT_NODE_CATEGORIES: NodeCategory[] = [
  {
    id: 'io',
    name: 'Start/End',
    icon: 'Play',
    nodes: [
      { type: 'start', label: 'Start', icon: 'Play', description: 'Workflow entry point' },
      { type: 'end', label: 'End', icon: 'StopCircle', description: 'Workflow exit point' },
      { type: 'transform', label: 'Transform', icon: 'Workflow', description: 'Transform data' },
    ],
  },
  {
    id: 'ai',
    name: 'AI Tasks',
    icon: 'Bot',
    nodes: [
      { type: 'engineer', label: 'Engineer', icon: 'Code', description: 'AI code implementation' },
      { type: 'reviewer', label: 'Reviewer', icon: 'Users', description: 'AI code review' },
      { type: 'product-owner', label: 'Product Owner', icon: 'ClipboardList', description: 'Requirements analysis' },
      { type: 'custom-ai', label: 'Custom AI', icon: 'Bot', description: 'Custom AI task' },
    ],
  },
  {
    id: 'control',
    name: 'Control Flow',
    icon: 'Split',
    nodes: [
      { type: 'decision', label: 'Decision', icon: 'Split', description: 'Conditional branching' },
      { type: 'parallel-group', label: 'Parallel Group', icon: 'Box', description: 'Container for parallel execution' },
    ],
  },
  {
    id: 'git',
    name: 'Git Operations',
    icon: 'GitMerge',
    nodes: [
      { type: 'merge', label: 'Merge', icon: 'GitMerge', description: 'Merge branches' },
    ],
  },
];

// ============================================================================
// NodePaletteItemComponent
// ============================================================================

interface NodePaletteItemComponentProps {
  item: NodePaletteItem;
  onDragStart: (type: WorkflowNodeType) => void;
}

const NodePaletteItemComponent: React.FC<NodePaletteItemComponentProps> = ({
  item,
  onDragStart,
}) => {
  const category = getNodeCategory(item.type);
  const colors = NODE_CATEGORY_COLORS[category];
  const Icon = NODE_LUCIDE_ICONS[item.type];

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('nodeType', item.type);
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart(item.type);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="group flex items-center gap-2 px-3 py-2 rounded-md cursor-grab hover:bg-accent/50 transition-colors border border-transparent hover:border-border"
    >
      {/* Color indicator */}
      <div
        className="w-1.5 h-8 rounded-full flex-shrink-0"
        style={{ backgroundColor: colors.primary }}
      />

      {/* Icon */}
      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />

      {/* Label and description */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{item.label}</div>
        <div className="text-xs text-muted-foreground truncate">{item.description}</div>
      </div>
    </div>
  );
};

// ============================================================================
// NodeCategoryComponent
// ============================================================================

interface NodeCategoryComponentProps {
  category: NodeCategory;
  isExpanded: boolean;
  onToggle: () => void;
  onDragStart: (type: WorkflowNodeType) => void;
  searchQuery: string;
}

const NodeCategoryComponent: React.FC<NodeCategoryComponentProps> = ({
  category,
  isExpanded,
  onToggle,
  onDragStart,
  searchQuery,
}) => {
  const filteredNodes = useMemo(() => {
    if (!searchQuery) return category.nodes;
    const query = searchQuery.toLowerCase();
    return category.nodes.filter(
      (node) =>
        node.label.toLowerCase().includes(query) ||
        node.description.toLowerCase().includes(query) ||
        node.type.toLowerCase().includes(query)
    );
  }, [category.nodes, searchQuery]);

  if (filteredNodes.length === 0) return null;

  const categoryColors = NODE_CATEGORY_COLORS[category.id as keyof typeof NODE_CATEGORY_COLORS];

  return (
    <div className="mb-1">
      {/* Category header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/30 rounded-md transition-colors"
      >
        <ChevronRight
          className={cn(
            'w-4 h-4 text-muted-foreground transition-transform',
            isExpanded && 'rotate-90'
          )}
        />
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: categoryColors?.primary || '#6b7280' }}
        />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {category.name}
        </span>
        <span className="text-xs text-muted-foreground/60">({filteredNodes.length})</span>
      </button>

      {/* Category nodes */}
      {isExpanded && (
        <div className="ml-4 mt-1 space-y-0.5">
          {filteredNodes.map((node) => (
            <NodePaletteItemComponent
              key={node.type}
              item={node}
              onDragStart={onDragStart}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// NodePalette
// ============================================================================

export interface NodePaletteProps {
  className?: string;
  onNodeDragStart?: (type: WorkflowNodeType) => void;
  onNodeDragEnd?: () => void;
  collapsed?: boolean;
  position?: 'left' | 'bottom';
  categories?: NodeCategory[];
}

/**
 * NodePalette - Modern categorized list of draggable nodes
 */
export const NodePalette: React.FC<NodePaletteProps> = ({
  className = '',
  onNodeDragStart,
  onNodeDragEnd,
  collapsed = false,
  position = 'bottom',
  categories = DEFAULT_NODE_CATEGORIES,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(categories.map((c) => c.id))
  );

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleDragStart = (type: WorkflowNodeType) => {
    onNodeDragStart?.(type);
  };

  if (collapsed) {
    return null;
  }

  const isHorizontal = position === 'bottom';

  return (
    <div
      className={cn(
        'node-palette bg-background flex overflow-hidden',
        isHorizontal ? 'border-t flex-row' : 'border-r flex-col w-64',
        className
      )}
      onDragEnd={onNodeDragEnd}
    >
      {/* Search bar */}
      <div className={cn(
        'p-3',
        isHorizontal ? 'border-r min-w-[200px]' : 'border-b'
      )}>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Categories */}
      {isHorizontal ? (
        // Horizontal layout: compact inline nodes
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-1 p-2">
            {categories.map((category) => {
              const categoryColors = NODE_CATEGORY_COLORS[category.id as keyof typeof NODE_CATEGORY_COLORS];
              return (
                <div key={category.id} className="flex items-center gap-1">
                  <div
                    className="w-1 h-6 rounded-full mr-1"
                    style={{ backgroundColor: categoryColors?.primary || '#6b7280' }}
                  />
                  {category.nodes
                    .filter((node) => {
                      if (!searchQuery) return true;
                      const query = searchQuery.toLowerCase();
                      return (
                        node.label.toLowerCase().includes(query) ||
                        node.type.toLowerCase().includes(query)
                      );
                    })
                    .map((node) => {
                      const Icon = NODE_LUCIDE_ICONS[node.type];
                      return (
                        <div
                          key={node.type}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('nodeType', node.type);
                            handleDragStart(node.type);
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent/30 hover:bg-accent rounded-md cursor-grab text-xs transition-colors"
                          title={node.description}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{node.label}</span>
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // Vertical layout: categorized nodes with expand/collapse
        <ScrollArea className="flex-1">
          <div className="p-2">
            {categories.map((category) => (
              <NodeCategoryComponent
                key={category.id}
                category={category}
                isExpanded={expandedCategories.has(category.id)}
                onToggle={() => toggleCategory(category.id)}
                onDragStart={handleDragStart}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default NodePalette;
