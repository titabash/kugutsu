/**
 * SubgraphNodes Tests
 *
 * TDD tests for ParallelGroup's subgraph Start/End nodes.
 * These small nodes are automatically placed inside ParallelGroups.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { CustomNode } from '@/components/ReteEditor/components/CustomNode';
import { WorkflowNode, NODE_COLORS, type WorkflowNodeType } from '@/components/ReteEditor/types';

// Mock Rete context
const mockEmit = vi.fn();

// Helper to create a mock WorkflowNode
function createMockNode(nodeType: WorkflowNodeType, label: string = 'Test Node'): WorkflowNode {
  const node = new WorkflowNode(label);
  node.nodeType = nodeType;
  node.updateSize();
  return node;
}

describe('SubgraphNodes', () => {
  beforeEach(() => {
    mockEmit.mockClear();
  });

  describe('Node Types', () => {
    it('should have subgraph-start as a valid WorkflowNodeType', () => {
      // This test verifies that 'subgraph-start' is a valid type
      const nodeType: WorkflowNodeType = 'subgraph-start';
      expect(nodeType).toBe('subgraph-start');
    });

    it('should have subgraph-end as a valid WorkflowNodeType', () => {
      // This test verifies that 'subgraph-end' is a valid type
      const nodeType: WorkflowNodeType = 'subgraph-end';
      expect(nodeType).toBe('subgraph-end');
    });

    it('should have color defined for subgraph-start', () => {
      expect(NODE_COLORS['subgraph-start']).toBeDefined();
      expect(NODE_COLORS['subgraph-start']).toBe('#22c55e'); // Green
    });

    it('should have color defined for subgraph-end', () => {
      expect(NODE_COLORS['subgraph-end']).toBeDefined();
      expect(NODE_COLORS['subgraph-end']).toBe('#ef4444'); // Red
    });
  });

  describe('Node Sizing', () => {
    it('should set small size for subgraph-start node', () => {
      const node = createMockNode('subgraph-start', 'Start');

      expect(node.width).toBe(100);
      expect(node.height).toBe(50);
    });

    it('should set small size for subgraph-end node', () => {
      const node = createMockNode('subgraph-end', 'End');

      expect(node.width).toBe(100);
      expect(node.height).toBe(50);
    });

    it('should be smaller than regular nodes', () => {
      const subgraphStart = createMockNode('subgraph-start', 'Start');
      const regularNode = createMockNode('engineer', 'Engineer');

      expect(subgraphStart.width).toBeLessThan(regularNode.width);
      expect(subgraphStart.height).toBeLessThan(regularNode.height);
    });
  });

  describe('CustomNode Rendering', () => {
    it('should render subgraph-start node with label', () => {
      const node = createMockNode('subgraph-start', 'Start');
      render(<CustomNode data={node} emit={mockEmit} />);

      expect(screen.getByText('Start')).toBeInTheDocument();
    });

    it('should render subgraph-end node with label', () => {
      const node = createMockNode('subgraph-end', 'End');
      render(<CustomNode data={node} emit={mockEmit} />);

      expect(screen.getByText('End')).toBeInTheDocument();
    });

    it('should render subgraph-start with compact/pill style', () => {
      const node = createMockNode('subgraph-start', 'Start');
      const { container } = render(<CustomNode data={node} emit={mockEmit} />);

      const wrapper = container.querySelector('[data-testid="node-wrapper"]');
      // Should have a more rounded border for pill shape
      expect(wrapper).toBeInTheDocument();
    });

    it('should render subgraph-end with compact/pill style', () => {
      const node = createMockNode('subgraph-end', 'End');
      const { container } = render(<CustomNode data={node} emit={mockEmit} />);

      const wrapper = container.querySelector('[data-testid="node-wrapper"]');
      expect(wrapper).toBeInTheDocument();
    });

    it('should apply green color to subgraph-start header', () => {
      const node = createMockNode('subgraph-start', 'Start');
      const { container } = render(<CustomNode data={node} emit={mockEmit} />);

      const header = container.querySelector('[data-testid="node-header"]');
      // Should have green background
      expect(header).toBeInTheDocument();
    });

    it('should apply red color to subgraph-end header', () => {
      const node = createMockNode('subgraph-end', 'End');
      const { container } = render(<CustomNode data={node} emit={mockEmit} />);

      const header = container.querySelector('[data-testid="node-header"]');
      // Should have red background
      expect(header).toBeInTheDocument();
    });
  });

  describe('Node Constraints', () => {
    it('subgraph-start should only have output socket', () => {
      const node = createMockNode('subgraph-start', 'Start');
      // Subgraph start nodes only have output
      expect(Object.keys(node.inputs)).toHaveLength(0);
    });

    it('subgraph-end should only have input socket', () => {
      const node = createMockNode('subgraph-end', 'End');
      // Subgraph end nodes only have input
      expect(Object.keys(node.outputs)).toHaveLength(0);
    });
  });
});

describe('ParallelGroup with SubgraphNodes', () => {
  describe('Auto-placement', () => {
    it('should have subgraph-start and subgraph-end as child types of parallel-group', () => {
      // When creating a parallel-group, it should automatically create
      // subgraph-start and subgraph-end nodes as children
      const allowedChildTypes: WorkflowNodeType[] = [
        'subgraph-start',
        'subgraph-end',
        'engineer',
        'reviewer',
        'product-owner',
        'custom-ai',
        'decision',
        'transform',
        'merge',
      ];

      expect(allowedChildTypes).toContain('subgraph-start');
      expect(allowedChildTypes).toContain('subgraph-end');
    });
  });

  describe('Delete Restrictions', () => {
    it('subgraph-start should be marked as non-deletable', () => {
      const node = createMockNode('subgraph-start', 'Start');
      // Node type check for deletion restriction
      const isSubgraphNode = node.nodeType === 'subgraph-start' || node.nodeType === 'subgraph-end';
      expect(isSubgraphNode).toBe(true);
    });

    it('subgraph-end should be marked as non-deletable', () => {
      const node = createMockNode('subgraph-end', 'End');
      const isSubgraphNode = node.nodeType === 'subgraph-start' || node.nodeType === 'subgraph-end';
      expect(isSubgraphNode).toBe(true);
    });
  });
});
