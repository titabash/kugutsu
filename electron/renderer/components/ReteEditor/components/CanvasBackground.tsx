/**
 * CanvasBackground
 *
 * SVG-based grid background for the Rete.js canvas.
 * Supports dots and lines patterns with zoom/pan support.
 */

import React from 'react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface CanvasBackgroundProps {
  className?: string;
  showGrid?: boolean;
  gridSize?: number;
  gridType?: 'dots' | 'lines';
  gridColor?: string;
  zoom?: number;
  offsetX?: number;
  offsetY?: number;
  theme?: 'dark' | 'light';
}

// ============================================================================
// Default Colors
// ============================================================================

const DEFAULT_GRID_COLORS = {
  dark: 'rgba(255, 255, 255, 0.1)',
  light: 'rgba(0, 0, 0, 0.1)',
};

// ============================================================================
// CanvasBackground
// ============================================================================

/**
 * CanvasBackground - SVG-based grid background component
 *
 * Features:
 * - Dot or line patterns
 * - Zoom-aware scaling
 * - Pan offset support
 * - Theme support (dark/light)
 */
export const CanvasBackground: React.FC<CanvasBackgroundProps> = ({
  className = '',
  showGrid = true,
  gridSize = 20,
  gridType = 'dots',
  gridColor,
  zoom = 1,
  offsetX = 0,
  offsetY = 0,
  theme = 'dark',
}) => {
  // Determine grid color
  const effectiveGridColor = gridColor || DEFAULT_GRID_COLORS[theme];

  // Calculate scaled grid size
  const scaledGridSize = gridSize * zoom;

  // Pattern ID for unique reference
  const patternId = 'grid-pattern';

  return (
    <div
      className={cn(
        'canvas-background absolute inset-0 pointer-events-none overflow-hidden',
        className
      )}
    >
      <svg
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {showGrid && (
          <>
            <defs>
              <pattern
                id={patternId}
                width={gridSize}
                height={gridSize}
                patternUnits="userSpaceOnUse"
                patternTransform={`scale(${zoom})`}
              >
                {gridType === 'dots' ? (
                  <circle
                    cx={gridSize / 2}
                    cy={gridSize / 2}
                    r={1}
                    fill={effectiveGridColor}
                  />
                ) : (
                  <>
                    <line
                      x1="0"
                      y1="0"
                      x2={gridSize}
                      y2="0"
                      stroke={effectiveGridColor}
                      strokeWidth="0.5"
                    />
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2={gridSize}
                      stroke={effectiveGridColor}
                      strokeWidth="0.5"
                    />
                  </>
                )}
              </pattern>
            </defs>
            <rect
              fill={`url(#${patternId})`}
              width="100%"
              height="100%"
              transform={`translate(${offsetX % scaledGridSize}, ${offsetY % scaledGridSize})`}
            />
          </>
        )}
      </svg>
    </div>
  );
};

export default CanvasBackground;
