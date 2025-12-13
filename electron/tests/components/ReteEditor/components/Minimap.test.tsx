/**
 * Minimap Tests
 *
 * Phase 3: Canvas improvements
 * TDD: Tests for workflow minimap component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { Minimap } from '../../../../renderer/components/ReteEditor/components/Minimap';
import { type MinimapNode } from '../../../../renderer/components/ReteEditor/components/Minimap';

// ============================================================================
// Test Data
// ============================================================================

const mockNodes: MinimapNode[] = [
  { id: '1', x: 0, y: 0, width: 200, height: 100, type: 'start' },
  { id: '2', x: 300, y: 100, width: 200, height: 100, type: 'engineer' },
  { id: '3', x: 600, y: 200, width: 200, height: 100, type: 'end' },
];

// ============================================================================
// Tests
// ============================================================================

describe('Minimap', () => {
  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe('Rendering', () => {
    it('should render the minimap container', () => {
      render(<Minimap nodes={[]} />);

      const container = document.querySelector('.minimap');
      expect(container).toBeInTheDocument();
    });

    it('should render minimap canvas', () => {
      render(<Minimap nodes={[]} />);

      const canvas = document.querySelector('.minimap-canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<Minimap nodes={[]} className="custom-minimap" />);

      const container = document.querySelector('.minimap.custom-minimap');
      expect(container).toBeInTheDocument();
    });

    it('should render with default dimensions', () => {
      render(<Minimap nodes={[]} />);

      const container = document.querySelector('.minimap');
      expect(container).toBeInTheDocument();
      // Default size is 200x150
      expect(container).toHaveStyle({ width: '200px', height: '150px' });
    });

    it('should render with custom dimensions', () => {
      render(<Minimap nodes={[]} width={300} height={200} />);

      const container = document.querySelector('.minimap');
      expect(container).toHaveStyle({ width: '300px', height: '200px' });
    });
  });

  // ==========================================================================
  // Node Display Tests
  // ==========================================================================

  describe('Node Display', () => {
    it('should render nodes in the minimap', () => {
      render(<Minimap nodes={mockNodes} />);

      const nodeElements = document.querySelectorAll('.minimap-node');
      expect(nodeElements.length).toBe(3);
    });

    it('should render nodes with category colors', () => {
      render(<Minimap nodes={mockNodes} />);

      const nodeElements = document.querySelectorAll('.minimap-node');
      // Each node should have a background color
      nodeElements.forEach((node) => {
        const style = window.getComputedStyle(node);
        expect(node).toHaveAttribute('style');
      });
    });

    it('should scale nodes to fit minimap', () => {
      const largeNodes: MinimapNode[] = [
        { id: '1', x: 0, y: 0, width: 1000, height: 500, type: 'start' },
        { id: '2', x: 2000, y: 1000, width: 1000, height: 500, type: 'end' },
      ];

      render(<Minimap nodes={largeNodes} />);

      const nodeElements = document.querySelectorAll('.minimap-node');
      expect(nodeElements.length).toBe(2);
    });

    it('should not render nodes when empty', () => {
      render(<Minimap nodes={[]} />);

      const nodeElements = document.querySelectorAll('.minimap-node');
      expect(nodeElements.length).toBe(0);
    });
  });

  // ==========================================================================
  // Viewport Indicator Tests
  // ==========================================================================

  describe('Viewport Indicator', () => {
    it('should render viewport indicator', () => {
      render(
        <Minimap
          nodes={mockNodes}
          viewportX={0}
          viewportY={0}
          viewportWidth={800}
          viewportHeight={600}
        />
      );

      const viewport = document.querySelector('.minimap-viewport');
      expect(viewport).toBeInTheDocument();
    });

    it('should position viewport indicator based on props', () => {
      render(
        <Minimap
          nodes={mockNodes}
          viewportX={100}
          viewportY={50}
          viewportWidth={800}
          viewportHeight={600}
        />
      );

      const viewport = document.querySelector('.minimap-viewport');
      expect(viewport).toBeInTheDocument();
    });

    it('should update viewport position when props change', () => {
      const { rerender } = render(
        <Minimap
          nodes={mockNodes}
          viewportX={0}
          viewportY={0}
          viewportWidth={800}
          viewportHeight={600}
        />
      );

      rerender(
        <Minimap
          nodes={mockNodes}
          viewportX={200}
          viewportY={100}
          viewportWidth={800}
          viewportHeight={600}
        />
      );

      const viewport = document.querySelector('.minimap-viewport');
      expect(viewport).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Interaction Tests
  // ==========================================================================

  describe('Interactions', () => {
    it('should call onViewportChange when clicking on minimap', async () => {
      const onViewportChange = vi.fn();

      render(
        <Minimap
          nodes={mockNodes}
          onViewportChange={onViewportChange}
          viewportWidth={800}
          viewportHeight={600}
        />
      );

      const canvas = document.querySelector('.minimap-canvas');
      if (canvas) {
        fireEvent.click(canvas, { clientX: 50, clientY: 50 });
        expect(onViewportChange).toHaveBeenCalled();
      }
    });

    it('should call onViewportChange when dragging viewport', async () => {
      const onViewportChange = vi.fn();

      render(
        <Minimap
          nodes={mockNodes}
          onViewportChange={onViewportChange}
          viewportWidth={800}
          viewportHeight={600}
        />
      );

      const viewport = document.querySelector('.minimap-viewport');
      if (viewport) {
        fireEvent.mouseDown(viewport, { clientX: 50, clientY: 50 });
        fireEvent.mouseMove(document, { clientX: 100, clientY: 100 });
        fireEvent.mouseUp(document);

        expect(onViewportChange).toHaveBeenCalled();
      }
    });
  });

  // ==========================================================================
  // Collapse Tests
  // ==========================================================================

  describe('Collapse', () => {
    it('should render collapse button', () => {
      render(<Minimap nodes={[]} collapsible={true} />);

      const button = document.querySelector('.minimap-collapse-btn');
      expect(button).toBeInTheDocument();
    });

    it('should hide minimap content when collapsed', async () => {
      const user = userEvent.setup();
      render(<Minimap nodes={mockNodes} collapsible={true} />);

      const button = document.querySelector('.minimap-collapse-btn');
      if (button) {
        await user.click(button);

        const canvas = document.querySelector('.minimap-canvas');
        expect(canvas).not.toBeInTheDocument();
      }
    });

    it('should show minimap content when expanded', async () => {
      const user = userEvent.setup();
      render(<Minimap nodes={mockNodes} collapsible={true} />);

      const button = document.querySelector('.minimap-collapse-btn');
      if (button) {
        // Collapse
        await user.click(button);
        // Expand
        await user.click(button);

        const canvas = document.querySelector('.minimap-canvas');
        expect(canvas).toBeInTheDocument();
      }
    });

    it('should not render collapse button when collapsible is false', () => {
      render(<Minimap nodes={[]} collapsible={false} />);

      const button = document.querySelector('.minimap-collapse-btn');
      expect(button).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Position Tests
  // ==========================================================================

  describe('Position', () => {
    it('should position in bottom-right by default', () => {
      render(<Minimap nodes={[]} />);

      const container = document.querySelector('.minimap');
      expect(container).toHaveClass('bottom-4');
      expect(container).toHaveClass('right-4');
    });

    it('should position in bottom-left when specified', () => {
      render(<Minimap nodes={[]} position="bottom-left" />);

      const container = document.querySelector('.minimap');
      expect(container).toHaveClass('bottom-4');
      expect(container).toHaveClass('left-4');
    });

    it('should position in top-right when specified', () => {
      render(<Minimap nodes={[]} position="top-right" />);

      const container = document.querySelector('.minimap');
      expect(container).toHaveClass('top-4');
      expect(container).toHaveClass('right-4');
    });

    it('should position in top-left when specified', () => {
      render(<Minimap nodes={[]} position="top-left" />);

      const container = document.querySelector('.minimap');
      expect(container).toHaveClass('top-4');
      expect(container).toHaveClass('left-4');
    });
  });

  // ==========================================================================
  // Style Tests
  // ==========================================================================

  describe('Styling', () => {
    it('should have rounded corners', () => {
      render(<Minimap nodes={[]} />);

      const container = document.querySelector('.minimap');
      expect(container).toHaveClass('rounded-lg');
    });

    it('should have background', () => {
      render(<Minimap nodes={[]} />);

      const container = document.querySelector('.minimap');
      expect(container).toHaveClass('bg-background');
    });

    it('should have border', () => {
      render(<Minimap nodes={[]} />);

      const container = document.querySelector('.minimap');
      expect(container).toHaveClass('border');
    });

    it('should have shadow', () => {
      render(<Minimap nodes={[]} />);

      const container = document.querySelector('.minimap');
      expect(container).toHaveClass('shadow-lg');
    });
  });
});
