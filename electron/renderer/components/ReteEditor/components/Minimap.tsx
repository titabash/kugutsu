/**
 * Minimap
 *
 * Minimap component for the Rete.js workflow editor.
 * Shows a bird's eye view of the canvas with viewport indicator.
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNodeCategoryColor, getNodeCategory } from '../styles/design-tokens';
import { type WorkflowNodeType } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface MinimapNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: WorkflowNodeType | string;
}

export type MinimapPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface MinimapProps {
  nodes: MinimapNode[];
  className?: string;
  width?: number;
  height?: number;
  viewportX?: number;
  viewportY?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  onViewportChange?: (x: number, y: number) => void;
  collapsible?: boolean;
  position?: MinimapPosition;
}

// ============================================================================
// Position Classes
// ============================================================================

const POSITION_CLASSES: Record<MinimapPosition, string> = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
};

// ============================================================================
// Minimap
// ============================================================================

/**
 * Minimap - Bird's eye view of the workflow canvas
 *
 * Features:
 * - Scaled node representation with category colors
 * - Viewport indicator showing current view
 * - Click/drag to navigate
 * - Collapsible UI
 */
export const Minimap: React.FC<MinimapProps> = ({
  nodes,
  className = '',
  width = 200,
  height = 150,
  viewportX = 0,
  viewportY = 0,
  viewportWidth = 800,
  viewportHeight = 600,
  onViewportChange,
  collapsible = true,
  position = 'bottom-right',
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Calculate bounds and scale
  const { bounds, scale, offsetX, offsetY } = useMemo(() => {
    if (nodes.length === 0) {
      return {
        bounds: { minX: 0, minY: 0, maxX: viewportWidth, maxY: viewportHeight },
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      };
    }

    // Find bounds of all nodes
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach((node) => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    });

    // Add padding
    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    // Include viewport in bounds
    minX = Math.min(minX, viewportX);
    minY = Math.min(minY, viewportY);
    maxX = Math.max(maxX, viewportX + viewportWidth);
    maxY = Math.max(maxY, viewportY + viewportHeight);

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Calculate scale to fit in minimap
    const scaleX = width / contentWidth;
    const scaleY = height / contentHeight;
    const calculatedScale = Math.min(scaleX, scaleY);

    return {
      bounds: { minX, minY, maxX, maxY },
      scale: calculatedScale,
      offsetX: -minX * calculatedScale,
      offsetY: -minY * calculatedScale,
    };
  }, [nodes, width, height, viewportX, viewportY, viewportWidth, viewportHeight]);

  // Handle click on canvas
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!canvasRef.current || !onViewportChange) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const clickX = (e.clientX - rect.left - offsetX) / scale;
      const clickY = (e.clientY - rect.top - offsetY) / scale;

      // Center viewport on click position
      const newX = clickX - viewportWidth / 2;
      const newY = clickY - viewportHeight / 2;

      onViewportChange(newX, newY);
    },
    [scale, offsetX, offsetY, viewportWidth, viewportHeight, onViewportChange]
  );

  // Handle viewport drag
  const handleViewportMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      setIsDragging(true);

      const startX = e.clientX;
      const startY = e.clientY;
      const startViewportX = viewportX;
      const startViewportY = viewportY;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!onViewportChange) return;

        const deltaX = (moveEvent.clientX - startX) / scale;
        const deltaY = (moveEvent.clientY - startY) / scale;

        onViewportChange(startViewportX + deltaX, startViewportY + deltaY);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [scale, viewportX, viewportY, onViewportChange]
  );

  // Viewport indicator position and size
  const viewportStyle = useMemo(() => {
    return {
      left: `${viewportX * scale + offsetX}px`,
      top: `${viewportY * scale + offsetY}px`,
      width: `${viewportWidth * scale}px`,
      height: `${viewportHeight * scale}px`,
    };
  }, [viewportX, viewportY, viewportWidth, viewportHeight, scale, offsetX, offsetY]);

  return (
    <div
      className={cn(
        'minimap absolute z-50 rounded-lg bg-background border shadow-lg overflow-hidden',
        POSITION_CLASSES[position],
        className
      )}
      style={{ width: `${width}px`, height: isCollapsed ? 'auto' : `${height}px` }}
    >
      {/* Header with collapse button */}
      {collapsible && (
        <button
          className="minimap-collapse-btn w-full flex items-center justify-between px-2 py-1 hover:bg-accent/50 transition-colors"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <span className="text-xs text-muted-foreground">Minimap</span>
          {isCollapsed ? (
            <ChevronUp className="w-3 h-3 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          )}
        </button>
      )}

      {/* Minimap canvas */}
      {!isCollapsed && (
        <div
          ref={canvasRef}
          className="minimap-canvas relative bg-muted/30"
          style={{ width: `${width}px`, height: collapsible ? `${height - 24}px` : `${height}px` }}
          onClick={handleCanvasClick}
        >
          {/* Render nodes */}
          {nodes.map((node) => {
            const colors = getNodeCategoryColor(node.type as WorkflowNodeType);
            return (
              <div
                key={node.id}
                className="minimap-node absolute rounded-sm"
                style={{
                  left: `${node.x * scale + offsetX}px`,
                  top: `${node.y * scale + offsetY}px`,
                  width: `${Math.max(node.width * scale, 4)}px`,
                  height: `${Math.max(node.height * scale, 2)}px`,
                  backgroundColor: colors.primary,
                }}
              />
            );
          })}

          {/* Viewport indicator */}
          <div
            className={cn(
              'minimap-viewport absolute border-2 border-primary bg-primary/10 rounded-sm',
              isDragging && 'cursor-grabbing',
              !isDragging && 'cursor-grab'
            )}
            style={viewportStyle}
            onMouseDown={handleViewportMouseDown}
          />
        </div>
      )}
    </div>
  );
};

export default Minimap;
