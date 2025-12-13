/**
 * Design Tokens and Node Category Tests
 *
 * TDD tests for the Rete.js editor design system.
 * Tests category mappings, colors, and type utilities.
 */

import { describe, it, expect } from 'vitest';

// These will be implemented after tests are written
import {
  NODE_CATEGORY_COLORS,
  NODE_TYPE_CATEGORY,
  NODE_SIZES,
  getNodeCategory,
  getNodeCategoryColor,
  type NodeCategory,
} from '../../../../../electron/renderer/components/ReteEditor/styles/design-tokens';

import type { WorkflowNodeType } from '../../../../../electron/renderer/components/ReteEditor/types';

describe('Design Tokens', () => {
  describe('NODE_CATEGORY_COLORS', () => {
    it('should define colors for all categories', () => {
      const expectedCategories: NodeCategory[] = ['io', 'ai', 'control', 'git', 'data'];

      expectedCategories.forEach((category) => {
        expect(NODE_CATEGORY_COLORS[category]).toBeDefined();
        expect(NODE_CATEGORY_COLORS[category].primary).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(NODE_CATEGORY_COLORS[category].border).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(NODE_CATEGORY_COLORS[category].bg).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });

    it('should have distinct primary colors for each category', () => {
      const primaryColors = Object.values(NODE_CATEGORY_COLORS).map((c) => c.primary);
      const uniqueColors = new Set(primaryColors);
      expect(uniqueColors.size).toBe(primaryColors.length);
    });

    it('should have n8n-style color scheme', () => {
      // io: green
      expect(NODE_CATEGORY_COLORS.io.primary).toBe('#10b981');
      // ai: blue
      expect(NODE_CATEGORY_COLORS.ai.primary).toBe('#3b82f6');
      // control: orange/yellow
      expect(NODE_CATEGORY_COLORS.control.primary).toBe('#f59e0b');
      // git: purple
      expect(NODE_CATEGORY_COLORS.git.primary).toBe('#8b5cf6');
      // data: gray
      expect(NODE_CATEGORY_COLORS.data.primary).toBe('#6b7280');
    });
  });

  describe('NODE_TYPE_CATEGORY', () => {
    it('should map all workflow node types to categories', () => {
      const allNodeTypes: WorkflowNodeType[] = [
        'start',
        'end',
        'decision',
        'transform',
        'engineer',
        'reviewer',
        'product-owner',
        'parallel',
        'aggregator',
        'group',
        'parallel-group',
        'merge',
        'custom-ai',
      ];

      allNodeTypes.forEach((nodeType) => {
        expect(NODE_TYPE_CATEGORY[nodeType]).toBeDefined();
        expect(['io', 'ai', 'control', 'git', 'data']).toContain(NODE_TYPE_CATEGORY[nodeType]);
      });
    });

    it('should categorize IO nodes correctly', () => {
      expect(NODE_TYPE_CATEGORY.start).toBe('io');
      expect(NODE_TYPE_CATEGORY.end).toBe('io');
    });

    it('should categorize AI nodes correctly', () => {
      expect(NODE_TYPE_CATEGORY.engineer).toBe('ai');
      expect(NODE_TYPE_CATEGORY.reviewer).toBe('ai');
      expect(NODE_TYPE_CATEGORY['product-owner']).toBe('ai');
      expect(NODE_TYPE_CATEGORY['custom-ai']).toBe('ai');
    });

    it('should categorize control flow nodes correctly', () => {
      expect(NODE_TYPE_CATEGORY.decision).toBe('control');
      expect(NODE_TYPE_CATEGORY['parallel-group']).toBe('control');
      expect(NODE_TYPE_CATEGORY.parallel).toBe('control');
    });

    it('should categorize git nodes correctly', () => {
      expect(NODE_TYPE_CATEGORY.merge).toBe('git');
    });

    it('should categorize data nodes correctly', () => {
      expect(NODE_TYPE_CATEGORY.transform).toBe('data');
      expect(NODE_TYPE_CATEGORY.aggregator).toBe('data');
    });
  });

  describe('NODE_SIZES', () => {
    it('should define all required size constants', () => {
      expect(NODE_SIZES.minWidth).toBeDefined();
      expect(NODE_SIZES.socketSize).toBeDefined();
      expect(NODE_SIZES.socketHitArea).toBeDefined();
      expect(NODE_SIZES.borderRadius).toBeDefined();
      expect(NODE_SIZES.headerHeight).toBeDefined();
    });

    it('should have appropriate minimum width', () => {
      expect(NODE_SIZES.minWidth).toBeGreaterThanOrEqual(200);
    });

    it('should have socket hit area larger than socket size', () => {
      expect(NODE_SIZES.socketHitArea).toBeGreaterThan(NODE_SIZES.socketSize);
    });

    it('should have socket size of 12px for visibility', () => {
      expect(NODE_SIZES.socketSize).toBe(12);
    });

    it('should have socket hit area of 24px for easy clicking', () => {
      expect(NODE_SIZES.socketHitArea).toBe(24);
    });

    it('should have modern border radius of 12px', () => {
      expect(NODE_SIZES.borderRadius).toBe(12);
    });
  });

  describe('getNodeCategory', () => {
    it('should return correct category for each node type', () => {
      expect(getNodeCategory('start')).toBe('io');
      expect(getNodeCategory('engineer')).toBe('ai');
      expect(getNodeCategory('decision')).toBe('control');
      expect(getNodeCategory('merge')).toBe('git');
      expect(getNodeCategory('transform')).toBe('data');
    });

    it('should handle all node types without throwing', () => {
      const allNodeTypes: WorkflowNodeType[] = [
        'start',
        'end',
        'decision',
        'transform',
        'engineer',
        'reviewer',
        'product-owner',
        'parallel',
        'aggregator',
        'group',
        'parallel-group',
        'merge',
        'custom-ai',
      ];

      allNodeTypes.forEach((nodeType) => {
        expect(() => getNodeCategory(nodeType)).not.toThrow();
      });
    });
  });

  describe('getNodeCategoryColor', () => {
    it('should return correct colors for a node type', () => {
      const engineerColors = getNodeCategoryColor('engineer');
      expect(engineerColors).toEqual(NODE_CATEGORY_COLORS.ai);
    });

    it('should return io colors for start node', () => {
      const startColors = getNodeCategoryColor('start');
      expect(startColors.primary).toBe('#10b981');
    });

    it('should return control colors for decision node', () => {
      const decisionColors = getNodeCategoryColor('decision');
      expect(decisionColors.primary).toBe('#f59e0b');
    });
  });
});
