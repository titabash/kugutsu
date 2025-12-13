/**
 * CustomNode Component Tests
 *
 * TDD tests for the n8n-style custom node component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { CustomNode } from '@/components/ReteEditor/components/CustomNode';
import { NODE_CATEGORY_COLORS, getNodeCategory } from '@/components/ReteEditor/styles/design-tokens';
import { WorkflowNode, type WorkflowNodeType } from '@/components/ReteEditor/types';

// Mock Rete context
const mockEmit = vi.fn();

// Helper to create a mock WorkflowNode
function createMockNode(nodeType: WorkflowNodeType, label: string = 'Test Node'): WorkflowNode {
  const node = new WorkflowNode(label);
  node.nodeType = nodeType;
  return node;
}

describe('CustomNode', () => {
  beforeEach(() => {
    mockEmit.mockClear();
  });

  describe('Rendering', () => {
    it('should render node with label', () => {
      const node = createMockNode('engineer', 'AI Engineer');
      render(<CustomNode data={node} emit={mockEmit} />);

      expect(screen.getByText('AI Engineer')).toBeInTheDocument();
    });

    it('should render node with correct category color', () => {
      const node = createMockNode('engineer');
      const { container } = render(<CustomNode data={node} emit={mockEmit} />);

      const category = getNodeCategory('engineer');
      const colors = NODE_CATEGORY_COLORS[category];

      // Header should have the primary category color
      const header = container.querySelector('[data-testid="node-header"]');
      expect(header).toHaveStyle({ backgroundColor: colors.primary });
    });

    it('should render start node with io category color', () => {
      const node = createMockNode('start', 'Start');
      const { container } = render(<CustomNode data={node} emit={mockEmit} />);

      const header = container.querySelector('[data-testid="node-header"]');
      expect(header).toHaveStyle({ backgroundColor: NODE_CATEGORY_COLORS.io.primary });
    });

    it('should render decision node with control category color', () => {
      const node = createMockNode('decision', 'Decision');
      const { container } = render(<CustomNode data={node} emit={mockEmit} />);

      const header = container.querySelector('[data-testid="node-header"]');
      expect(header).toHaveStyle({ backgroundColor: NODE_CATEGORY_COLORS.control.primary });
    });
  });

  describe('Icons', () => {
    it('should render icon for AI nodes', () => {
      const node = createMockNode('engineer', 'Engineer');
      const { container } = render(<CustomNode data={node} emit={mockEmit} />);

      // Should have an svg icon (Lucide icons are SVGs)
      const icon = container.querySelector('[data-testid="node-icon"]');
      expect(icon).toBeInTheDocument();
    });

    it('should render icon for control nodes', () => {
      const node = createMockNode('decision', 'Decision');
      const { container } = render(<CustomNode data={node} emit={mockEmit} />);

      const icon = container.querySelector('[data-testid="node-icon"]');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Selection State', () => {
    it('should show selection ring when selected', () => {
      const node = createMockNode('engineer');
      const { container } = render(<CustomNode data={node} emit={mockEmit} selected={true} />);

      const wrapper = container.querySelector('[data-testid="node-wrapper"]');
      expect(wrapper).toHaveClass('ring-2');
    });

    it('should not show selection ring when not selected', () => {
      const node = createMockNode('engineer');
      const { container } = render(<CustomNode data={node} emit={mockEmit} selected={false} />);

      const wrapper = container.querySelector('[data-testid="node-wrapper"]');
      expect(wrapper).not.toHaveClass('ring-2');
    });
  });

  describe('Status Indicator', () => {
    it('should show running status indicator', () => {
      const node = createMockNode('engineer');
      node.config = { status: 'running' };
      const { container } = render(<CustomNode data={node} emit={mockEmit} />);

      const status = container.querySelector('[data-testid="status-indicator"]');
      expect(status).toBeInTheDocument();
      expect(status).toHaveClass('animate-pulse');
    });

    it('should show completed status indicator', () => {
      const node = createMockNode('engineer');
      node.config = { status: 'completed' };
      const { container } = render(<CustomNode data={node} emit={mockEmit} />);

      const status = container.querySelector('[data-testid="status-indicator"]');
      expect(status).toBeInTheDocument();
    });

    it('should show error status indicator', () => {
      const node = createMockNode('engineer');
      node.config = { status: 'error' };
      const { container } = render(<CustomNode data={node} emit={mockEmit} />);

      const status = container.querySelector('[data-testid="status-indicator"]');
      expect(status).toBeInTheDocument();
    });

    it('should not show status indicator when idle', () => {
      const node = createMockNode('engineer');
      node.config = { status: 'idle' };
      const { container } = render(<CustomNode data={node} emit={mockEmit} />);

      const status = container.querySelector('[data-testid="status-indicator"]');
      expect(status).not.toBeInTheDocument();
    });
  });

  describe('Node Styling', () => {
    it('should have card-like appearance with border radius', () => {
      const node = createMockNode('engineer');
      const { container } = render(<CustomNode data={node} emit={mockEmit} />);

      const wrapper = container.querySelector('[data-testid="node-wrapper"]');
      expect(wrapper).toHaveClass('rounded-xl');
    });

    it('should have border color matching category', () => {
      const node = createMockNode('engineer');
      const { container } = render(<CustomNode data={node} emit={mockEmit} />);

      const category = getNodeCategory('engineer');
      const colors = NODE_CATEGORY_COLORS[category];

      const wrapper = container.querySelector('[data-testid="node-wrapper"]');
      expect(wrapper).toHaveStyle({ borderColor: colors.border });
    });

    it('should have shadow for depth', () => {
      const node = createMockNode('engineer');
      const { container } = render(<CustomNode data={node} emit={mockEmit} />);

      const wrapper = container.querySelector('[data-testid="node-wrapper"]');
      expect(wrapper).toHaveClass('shadow-md');
    });
  });

  describe('All Node Types', () => {
    const nodeTypes: WorkflowNodeType[] = [
      'start', 'end', 'decision', 'transform', 'engineer',
      'reviewer', 'product-owner', 'parallel-group', 'merge', 'custom-ai'
    ];

    nodeTypes.forEach((nodeType) => {
      it(`should render ${nodeType} node correctly`, () => {
        const node = createMockNode(nodeType, `Test ${nodeType}`);
        render(<CustomNode data={node} emit={mockEmit} />);

        expect(screen.getByText(`Test ${nodeType}`)).toBeInTheDocument();
      });
    });
  });
});
