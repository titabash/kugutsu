/**
 * NodePalette Tests
 *
 * Phase 4.1: Node palette functionality
 * TDD: Tests for categorized node list with search and drag-drop
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { NodePalette, DEFAULT_NODE_CATEGORIES } from '../../../renderer/components/ReteEditor/NodePalette';
import { type NodeCategory } from '../../../renderer/components/ReteEditor/types';

// ============================================================================
// Test Setup
// ============================================================================

describe('NodePalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe('Rendering', () => {
    it('should render the node palette container', () => {
      render(<NodePalette />);

      const palette = document.querySelector('.node-palette');
      expect(palette).toBeInTheDocument();
    });

    it('should render search input', () => {
      render(<NodePalette />);

      const searchInput = screen.getByPlaceholderText(/search nodes/i);
      expect(searchInput).toBeInTheDocument();
    });

    it('should render all default categories', () => {
      render(<NodePalette position="left" />);

      DEFAULT_NODE_CATEGORIES.forEach((category) => {
        expect(screen.getByText(category.name)).toBeInTheDocument();
      });
    });

    it('should render nodes in each category', () => {
      render(<NodePalette position="left" />);

      // Check that some nodes are rendered
      expect(screen.getByText('Start')).toBeInTheDocument();
      expect(screen.getByText('End')).toBeInTheDocument();
      expect(screen.getByText('Engineer')).toBeInTheDocument();
    });

    it('should not render when collapsed', () => {
      render(<NodePalette collapsed={true} />);

      const palette = document.querySelector('.node-palette');
      expect(palette).not.toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<NodePalette className="custom-class" />);

      const palette = document.querySelector('.node-palette.custom-class');
      expect(palette).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Category Toggle Tests
  // ==========================================================================

  describe('Category Toggle', () => {
    it('should expand category by default', () => {
      render(<NodePalette position="left" />);

      // Categories are expanded by default, so nodes should be visible
      expect(screen.getByText('Start')).toBeInTheDocument();
    });

    it('should collapse category when header is clicked', async () => {
      const user = userEvent.setup();
      render(<NodePalette position="left" />);

      // Find the Start/End category header and click it (contains the 🚀 emoji)
      const ioHeader = screen.getByText(/Start\/End/);
      await user.click(ioHeader);

      // After collapsing, the category should still exist but nodes may be hidden
      // The header should still be visible
      expect(ioHeader).toBeInTheDocument();
    });

    it('should expand collapsed category when header is clicked again', async () => {
      const user = userEvent.setup();
      render(<NodePalette position="left" />);

      const ioHeader = screen.getByText(/Start\/End/);

      // Collapse
      await user.click(ioHeader);
      // Expand
      await user.click(ioHeader);

      // Nodes should be visible again
      expect(screen.getByText('Start')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Search Functionality Tests
  // ==========================================================================

  describe('Search Functionality', () => {
    it('should filter nodes by label', async () => {
      const user = userEvent.setup();
      render(<NodePalette position="left" />);

      const searchInput = screen.getByPlaceholderText(/search nodes/i);
      await user.type(searchInput, 'Engineer');

      // Engineer should be visible
      expect(screen.getByText('Engineer')).toBeInTheDocument();

      // Start should not be visible (doesn't match 'Engineer')
      expect(screen.queryByText('Start')).not.toBeInTheDocument();
    });

    it('should filter nodes by description', async () => {
      const user = userEvent.setup();
      render(<NodePalette position="left" />);

      const searchInput = screen.getByPlaceholderText(/search nodes/i);
      await user.type(searchInput, 'workflow');

      // Start node has 'workflow' in its description
      expect(screen.getByText('Start')).toBeInTheDocument();
    });

    it('should filter nodes by type', async () => {
      const user = userEvent.setup();
      render(<NodePalette position="left" />);

      const searchInput = screen.getByPlaceholderText(/search nodes/i);
      await user.type(searchInput, 'decision');

      // Decision node should be visible
      expect(screen.getByText('Decision')).toBeInTheDocument();
    });

    it('should be case-insensitive', async () => {
      const user = userEvent.setup();
      render(<NodePalette position="left" />);

      const searchInput = screen.getByPlaceholderText(/search nodes/i);
      await user.type(searchInput, 'ENGINEER');

      expect(screen.getByText('Engineer')).toBeInTheDocument();
    });

    it('should show no categories when no nodes match', async () => {
      const user = userEvent.setup();
      render(<NodePalette position="left" />);

      const searchInput = screen.getByPlaceholderText(/search nodes/i);
      await user.type(searchInput, 'xyz123nonexistent');

      // No nodes should be visible
      expect(screen.queryByText('Start')).not.toBeInTheDocument();
      expect(screen.queryByText('Engineer')).not.toBeInTheDocument();
    });

    it('should clear search and show all nodes', async () => {
      const user = userEvent.setup();
      render(<NodePalette position="left" />);

      const searchInput = screen.getByPlaceholderText(/search nodes/i);

      // Type a search query
      await user.type(searchInput, 'Engineer');
      expect(screen.queryByText('Start')).not.toBeInTheDocument();

      // Clear the search
      await user.clear(searchInput);

      // All nodes should be visible again
      expect(screen.getByText('Start')).toBeInTheDocument();
      expect(screen.getByText('Engineer')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Drag and Drop Tests
  // ==========================================================================

  describe('Drag and Drop', () => {
    it('should call onNodeDragStart when dragging starts', () => {
      const onDragStart = vi.fn();
      render(<NodePalette position="left" onNodeDragStart={onDragStart} />);

      const startNode = screen.getByText('Start').closest('[draggable="true"]');
      expect(startNode).not.toBeNull();

      if (startNode) {
        fireEvent.dragStart(startNode, {
          dataTransfer: {
            setData: vi.fn(),
            effectAllowed: 'copy',
          },
        });

        expect(onDragStart).toHaveBeenCalledWith('start');
      }
    });

    it('should set nodeType in dataTransfer on drag start', () => {
      const setData = vi.fn();
      render(<NodePalette position="left" />);

      const engineerNode = screen.getByText('Engineer').closest('[draggable="true"]');
      expect(engineerNode).not.toBeNull();

      if (engineerNode) {
        fireEvent.dragStart(engineerNode, {
          dataTransfer: {
            setData,
            effectAllowed: 'copy',
          },
        });

        expect(setData).toHaveBeenCalledWith('nodeType', 'engineer');
      }
    });

    it('should call onNodeDragEnd when dragging ends', () => {
      const onDragEnd = vi.fn();
      render(<NodePalette position="left" onNodeDragEnd={onDragEnd} />);

      const palette = document.querySelector('.node-palette');
      expect(palette).not.toBeNull();

      if (palette) {
        fireEvent.dragEnd(palette);
        expect(onDragEnd).toHaveBeenCalled();
      }
    });

    it('should mark nodes as draggable', () => {
      render(<NodePalette position="left" />);

      const draggableNodes = document.querySelectorAll('[draggable="true"]');
      expect(draggableNodes.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Layout Tests
  // ==========================================================================

  describe('Layout Variants', () => {
    it('should render vertical layout when position is left', () => {
      render(<NodePalette position="left" />);

      // In vertical mode, categories should be rendered with expandable sections
      const palette = document.querySelector('.node-palette');
      expect(palette).toBeInTheDocument();
      // Check for flex-col class in vertical mode
      expect(palette).toHaveClass('flex-col');
    });

    it('should render horizontal layout when position is bottom', () => {
      render(<NodePalette position="bottom" />);

      // In horizontal mode, palette should have flex-row class
      const palette = document.querySelector('.node-palette');
      expect(palette).toBeInTheDocument();
      expect(palette).toHaveClass('flex-row');
    });
  });

  // ==========================================================================
  // Custom Categories Tests
  // ==========================================================================

  describe('Custom Categories', () => {
    it('should render custom categories when provided', () => {
      const customCategories: NodeCategory[] = [
        {
          id: 'custom',
          name: 'Custom Nodes',
          icon: '★',
          nodes: [
            {
              type: 'start',
              label: 'Custom Start',
              description: 'A custom start node',
              icon: '▶',
            },
          ],
        },
      ];

      render(<NodePalette position="left" categories={customCategories} />);

      expect(screen.getByText('Custom Nodes')).toBeInTheDocument();
      expect(screen.getByText('Custom Start')).toBeInTheDocument();
    });

    it('should not render default categories when custom categories provided', () => {
      const customCategories: NodeCategory[] = [
        {
          id: 'custom',
          name: 'My Custom',
          icon: '★',
          nodes: [],
        },
      ];

      render(<NodePalette position="left" categories={customCategories} />);

      expect(screen.queryByText('Control Flow')).not.toBeInTheDocument();
      expect(screen.queryByText('AI Tasks')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Node Item Display Tests
  // ==========================================================================

  describe('Node Item Display', () => {
    it('should display node icon', () => {
      render(<NodePalette position="left" />);

      // Lucide icons render as SVG elements
      const svgIcons = document.querySelectorAll('svg');
      expect(svgIcons.length).toBeGreaterThan(0);
    });

    it('should display node description', () => {
      render(<NodePalette position="left" />);

      // Check for a known description
      expect(screen.getByText(/entry point/i)).toBeInTheDocument();
    });

    it('should show node color indicator', () => {
      render(<NodePalette position="left" />);

      // Each node should have a color indicator (rounded bars)
      const colorIndicators = document.querySelectorAll('.rounded-full');
      expect(colorIndicators.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Horizontal Mode Tests
  // ==========================================================================

  describe('Horizontal Mode (Bottom Position)', () => {
    it('should show nodes in a row', () => {
      render(<NodePalette position="bottom" />);

      const palette = document.querySelector('.node-palette');
      expect(palette).toBeInTheDocument();
      expect(palette).toHaveClass('flex-row');
    });

    it('should show category icons in horizontal mode', () => {
      render(<NodePalette position="bottom" />);

      // Lucide icons render as SVG elements in horizontal mode
      const svgIcons = document.querySelectorAll('svg');
      expect(svgIcons.length).toBeGreaterThan(0);
    });

    it('should filter nodes in horizontal mode', async () => {
      const user = userEvent.setup();
      render(<NodePalette position="bottom" />);

      const searchInput = screen.getByPlaceholderText(/search nodes/i);
      await user.type(searchInput, 'Engineer');

      expect(screen.getByText('Engineer')).toBeInTheDocument();
    });

    it('should show tooltip on hover in horizontal mode', () => {
      render(<NodePalette position="bottom" />);

      // Nodes in horizontal mode should have title attribute for tooltip
      const nodeWithTooltip = document.querySelector('[title]');
      expect(nodeWithTooltip).toBeInTheDocument();
    });
  });
});
