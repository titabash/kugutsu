/**
 * Design Tokens Tests
 *
 * TDD tests for Parallel Group padding constants.
 * These ensure child nodes have appropriate margins inside ParallelGroup.
 */

import { describe, it, expect } from 'vitest';
import {
  PARALLEL_GROUP_PADDING,
  PARALLEL_GROUP_MIN_SIZE,
} from '@/components/ReteEditor/styles/design-tokens';

describe('PARALLEL_GROUP_PADDING', () => {
  describe('Top Padding', () => {
    it('should have enough top padding for title bar and controls', () => {
      // Title bar (50px) + Concurrency control (50px) + margin (20px) = 120px
      expect(PARALLEL_GROUP_PADDING.top).toBeGreaterThanOrEqual(120);
    });
  });

  describe('Left Padding', () => {
    it('should have enough left padding for child nodes and Input socket', () => {
      // Child nodes should have at least 100px margin from left edge
      // Input socket + label is on the left, so we need more space
      expect(PARALLEL_GROUP_PADDING.left).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Right Padding', () => {
    it('should have enough right padding for child nodes and Output socket', () => {
      // Child nodes should have at least 100px margin from right edge
      // Output socket + label is on the right, so we need more space
      expect(PARALLEL_GROUP_PADDING.right).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Bottom Padding', () => {
    it('should have enough bottom padding for child nodes', () => {
      // Child nodes should have at least 80px margin from bottom edge
      expect(PARALLEL_GROUP_PADDING.bottom).toBeGreaterThanOrEqual(80);
    });
  });

  describe('Symmetry', () => {
    it('should have equal left and right padding for visual balance', () => {
      expect(PARALLEL_GROUP_PADDING.left).toBe(PARALLEL_GROUP_PADDING.right);
    });
  });
});

describe('PARALLEL_GROUP_MIN_SIZE', () => {
  it('should have minimum width of at least 500px', () => {
    expect(PARALLEL_GROUP_MIN_SIZE.width).toBeGreaterThanOrEqual(500);
  });

  it('should have minimum height of at least 400px', () => {
    expect(PARALLEL_GROUP_MIN_SIZE.height).toBeGreaterThanOrEqual(400);
  });
});
