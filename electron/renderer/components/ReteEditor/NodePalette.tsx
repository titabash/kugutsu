/**
 * NodePalette
 *
 * Displays a categorized list of nodes that can be dragged onto the canvas.
 */

import React, { useState, useMemo } from 'react';
import { DEFAULT_NODE_CATEGORIES, NODE_COLORS, NODE_ICONS, type WorkflowNodeType, type NodeCategory, type NodePaletteItem } from './types';

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
  const backgroundColor = NODE_COLORS[item.type];

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('nodeType', item.type);
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart(item.type);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="node-palette-item"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        marginBottom: '4px',
        borderRadius: '6px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        cursor: 'grab',
        transition: 'all 0.2s ease',
        border: '1px solid transparent',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        e.currentTarget.style.borderColor = backgroundColor;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        e.currentTarget.style.borderColor = 'transparent';
      }}
    >
      {/* Color indicator */}
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor,
        }}
      />

      {/* Icon */}
      <span style={{ fontSize: '16px' }}>{item.icon}</span>

      {/* Label and description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, color: '#fff', fontSize: '13px' }}>
          {item.label}
        </div>
        <div
          style={{
            color: '#888',
            fontSize: '11px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.description}
        </div>
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

  return (
    <div className="node-category" style={{ marginBottom: '8px' }}>
      {/* Category header */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#aaa',
          fontSize: '12px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        <span>{category.name}</span>
        <span style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
          ▶
        </span>
      </button>

      {/* Category nodes */}
      {isExpanded && (
        <div style={{ padding: '0 8px' }}>
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
 * NodePalette - Categorized list of draggable nodes
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
      className={`node-palette ${className}`}
      style={{
        backgroundColor: '#1f1f1f',
        borderTop: isHorizontal ? '1px solid #333' : undefined,
        borderRight: !isHorizontal ? '1px solid #333' : undefined,
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        overflow: 'hidden',
      }}
      onDragEnd={onNodeDragEnd}
    >
      {/* Search bar */}
      <div
        style={{
          padding: '12px',
          borderBottom: isHorizontal ? undefined : '1px solid #333',
          borderRight: isHorizontal ? '1px solid #333' : undefined,
          minWidth: isHorizontal ? '200px' : undefined,
        }}
      >
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            backgroundColor: '#333',
            border: '1px solid #444',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '13px',
            outline: 'none',
          }}
        />
      </div>

      {/* Categories */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: isHorizontal ? 'hidden' : undefined,
          display: isHorizontal ? 'flex' : 'block',
          gap: isHorizontal ? '8px' : undefined,
          padding: isHorizontal ? '8px' : undefined,
        }}
      >
        {isHorizontal ? (
          // Horizontal layout: show all nodes in a row
          categories.map((category) => (
            <div
              key={category.id}
              style={{
                display: 'flex',
                gap: '4px',
                alignItems: 'center',
              }}
            >
              <span style={{ color: '#888', fontSize: '12px', marginRight: '4px' }}>
                {category.icon}
              </span>
              {category.nodes
                .filter((node) => {
                  if (!searchQuery) return true;
                  const query = searchQuery.toLowerCase();
                  return (
                    node.label.toLowerCase().includes(query) ||
                    node.type.toLowerCase().includes(query)
                  );
                })
                .map((node) => (
                  <div
                    key={node.type}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('nodeType', node.type);
                      handleDragStart(node.type);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 10px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '6px',
                      cursor: 'grab',
                      border: `1px solid ${NODE_COLORS[node.type]}40`,
                    }}
                    title={node.description}
                  >
                    <span>{node.icon}</span>
                    <span style={{ color: '#fff', fontSize: '12px' }}>{node.label}</span>
                  </div>
                ))}
            </div>
          ))
        ) : (
          // Vertical layout: show categorized nodes
          categories.map((category) => (
            <NodeCategoryComponent
              key={category.id}
              category={category}
              isExpanded={expandedCategories.has(category.id)}
              onToggle={() => toggleCategory(category.id)}
              onDragStart={handleDragStart}
              searchQuery={searchQuery}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default NodePalette;
