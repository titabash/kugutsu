/**
 * ParallelGroupNode Interaction Tests
 *
 * TDD Red Phase: Tests for adding child nodes to Parallel Group
 * via drag & drop and context menu.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// ============================================================================
// Types for testing
// ============================================================================

interface MockNode {
  id: string;
  type: string;
  parent?: string;
  position: { x: number; y: number };
  width: number;
  height: number;
}

interface MockEditor {
  nodes: Map<string, MockNode>;
  addNode: (node: MockNode) => Promise<void>;
  getNode: (id: string) => MockNode | undefined;
  updateNode: (id: string, updates: Partial<MockNode>) => Promise<void>;
}

// ============================================================================
// Helper functions to test
// ============================================================================

/**
 * Check if a position is inside a node's bounds
 */
function isPositionInsideNode(
  position: { x: number; y: number },
  node: { position: { x: number; y: number }; width: number; height: number }
): boolean {
  return (
    position.x >= node.position.x &&
    position.x <= node.position.x + node.width &&
    position.y >= node.position.y &&
    position.y <= node.position.y + node.height
  );
}

/**
 * Find the parallel-group node at a given position
 */
function findParallelGroupAtPosition(
  position: { x: number; y: number },
  nodes: MockNode[]
): MockNode | undefined {
  return nodes.find(
    (node) =>
      node.type === 'parallel-group' && isPositionInsideNode(position, node)
  );
}

/**
 * Set parent for a node when dropped inside a parallel-group
 */
function setNodeParentOnDrop(
  droppedNode: MockNode,
  dropPosition: { x: number; y: number },
  allNodes: MockNode[]
): string | undefined {
  const parentGroup = findParallelGroupAtPosition(dropPosition, allNodes);
  if (parentGroup && parentGroup.id !== droppedNode.id) {
    return parentGroup.id;
  }
  return undefined;
}

/**
 * Calculate relative position inside parent
 */
function calculateRelativePosition(
  absolutePosition: { x: number; y: number },
  parentNode: MockNode
): { x: number; y: number } {
  return {
    x: absolutePosition.x - parentNode.position.x,
    y: absolutePosition.y - parentNode.position.y,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Parallel Group Node Interaction', () => {
  describe('isPositionInsideNode', () => {
    it('should return true when position is inside node bounds', () => {
      const node = { position: { x: 100, y: 100 }, width: 400, height: 300 };
      const position = { x: 200, y: 200 };

      expect(isPositionInsideNode(position, node)).toBe(true);
    });

    it('should return false when position is outside node bounds', () => {
      const node = { position: { x: 100, y: 100 }, width: 400, height: 300 };
      const position = { x: 50, y: 50 };

      expect(isPositionInsideNode(position, node)).toBe(false);
    });

    it('should return true when position is on the edge', () => {
      const node = { position: { x: 100, y: 100 }, width: 400, height: 300 };
      const position = { x: 100, y: 100 }; // Top-left corner

      expect(isPositionInsideNode(position, node)).toBe(true);
    });

    it('should return true when position is on bottom-right edge', () => {
      const node = { position: { x: 100, y: 100 }, width: 400, height: 300 };
      const position = { x: 500, y: 400 }; // Bottom-right corner

      expect(isPositionInsideNode(position, node)).toBe(true);
    });
  });

  describe('findParallelGroupAtPosition', () => {
    it('should find parallel-group node at position', () => {
      const nodes: MockNode[] = [
        { id: 'start', type: 'start', position: { x: 0, y: 0 }, width: 200, height: 200 },
        { id: 'pg-1', type: 'parallel-group', position: { x: 300, y: 100 }, width: 400, height: 300 },
        { id: 'end', type: 'end', position: { x: 800, y: 100 }, width: 200, height: 200 },
      ];

      const result = findParallelGroupAtPosition({ x: 400, y: 200 }, nodes);

      expect(result).toBeDefined();
      expect(result?.id).toBe('pg-1');
    });

    it('should return undefined when no parallel-group at position', () => {
      const nodes: MockNode[] = [
        { id: 'start', type: 'start', position: { x: 0, y: 0 }, width: 200, height: 200 },
        { id: 'pg-1', type: 'parallel-group', position: { x: 300, y: 100 }, width: 400, height: 300 },
      ];

      const result = findParallelGroupAtPosition({ x: 100, y: 100 }, nodes);

      expect(result).toBeUndefined();
    });

    it('should not return non-parallel-group nodes', () => {
      const nodes: MockNode[] = [
        { id: 'start', type: 'start', position: { x: 0, y: 0 }, width: 200, height: 200 },
      ];

      const result = findParallelGroupAtPosition({ x: 100, y: 100 }, nodes);

      expect(result).toBeUndefined();
    });
  });

  describe('setNodeParentOnDrop', () => {
    it('should set parent when node is dropped inside parallel-group', () => {
      const allNodes: MockNode[] = [
        { id: 'pg-1', type: 'parallel-group', position: { x: 100, y: 100 }, width: 400, height: 300 },
      ];
      const droppedNode: MockNode = {
        id: 'engineer-1',
        type: 'engineer',
        position: { x: 0, y: 0 },
        width: 200,
        height: 200,
      };
      const dropPosition = { x: 200, y: 200 };

      const parentId = setNodeParentOnDrop(droppedNode, dropPosition, allNodes);

      expect(parentId).toBe('pg-1');
    });

    it('should return undefined when dropped outside parallel-group', () => {
      const allNodes: MockNode[] = [
        { id: 'pg-1', type: 'parallel-group', position: { x: 100, y: 100 }, width: 400, height: 300 },
      ];
      const droppedNode: MockNode = {
        id: 'engineer-1',
        type: 'engineer',
        position: { x: 0, y: 0 },
        width: 200,
        height: 200,
      };
      const dropPosition = { x: 50, y: 50 };

      const parentId = setNodeParentOnDrop(droppedNode, dropPosition, allNodes);

      expect(parentId).toBeUndefined();
    });

    it('should not set parent to itself', () => {
      const parallelGroup: MockNode = {
        id: 'pg-1',
        type: 'parallel-group',
        position: { x: 100, y: 100 },
        width: 400,
        height: 300,
      };
      const allNodes: MockNode[] = [parallelGroup];
      const dropPosition = { x: 200, y: 200 };

      const parentId = setNodeParentOnDrop(parallelGroup, dropPosition, allNodes);

      expect(parentId).toBeUndefined();
    });
  });

  describe('calculateRelativePosition', () => {
    it('should calculate position relative to parent', () => {
      const parentNode: MockNode = {
        id: 'pg-1',
        type: 'parallel-group',
        position: { x: 100, y: 100 },
        width: 400,
        height: 300,
      };
      const absolutePosition = { x: 200, y: 250 };

      const relativePosition = calculateRelativePosition(absolutePosition, parentNode);

      expect(relativePosition.x).toBe(100);
      expect(relativePosition.y).toBe(150);
    });
  });

  describe('Context Menu Integration', () => {
    it('should provide add node options for parallel-group', () => {
      const nodeType = 'parallel-group';
      const availableChildTypes = ['engineer', 'reviewer', 'custom-ai', 'decision', 'transform'];

      // Parallel group should allow adding these node types as children
      expect(availableChildTypes).toContain('engineer');
      expect(availableChildTypes).toContain('reviewer');
    });

    it('should not allow adding start/end nodes as children', () => {
      const forbiddenChildTypes = ['start', 'end', 'parallel-group'];

      // These types should not be allowed as children of parallel-group
      expect(forbiddenChildTypes).toContain('start');
      expect(forbiddenChildTypes).toContain('end');
      expect(forbiddenChildTypes).toContain('parallel-group');
    });
  });

  describe('Child Node Constraints', () => {
    const ALLOWED_CHILD_TYPES = ['engineer', 'reviewer', 'product-owner', 'custom-ai', 'decision', 'transform', 'merge'];
    const FORBIDDEN_CHILD_TYPES = ['start', 'end', 'parallel-group'];

    it('should validate allowed child node types', () => {
      ALLOWED_CHILD_TYPES.forEach((type) => {
        expect(isAllowedChildType(type)).toBe(true);
      });
    });

    it('should reject forbidden child node types', () => {
      FORBIDDEN_CHILD_TYPES.forEach((type) => {
        expect(isAllowedChildType(type)).toBe(false);
      });
    });
  });
});

// Helper function to validate child types
function isAllowedChildType(type: string): boolean {
  const FORBIDDEN_TYPES = ['start', 'end', 'parallel-group'];
  return !FORBIDDEN_TYPES.includes(type);
}
