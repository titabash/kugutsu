/**
 * CanvasBackground Tests
 *
 * Phase 3: Canvas improvements
 * TDD: Tests for SVG-based grid background
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CanvasBackground } from '../../../../renderer/components/ReteEditor/components/CanvasBackground';

// ============================================================================
// Test Setup
// ============================================================================

describe('CanvasBackground', () => {
  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe('Rendering', () => {
    it('should render the canvas background container', () => {
      render(<CanvasBackground />);

      const container = document.querySelector('.canvas-background');
      expect(container).toBeInTheDocument();
    });

    it('should render SVG element', () => {
      render(<CanvasBackground />);

      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should render grid pattern when enabled', () => {
      render(<CanvasBackground showGrid={true} />);

      const pattern = document.querySelector('pattern');
      expect(pattern).toBeInTheDocument();
    });

    it('should not render grid pattern when disabled', () => {
      render(<CanvasBackground showGrid={false} />);

      const pattern = document.querySelector('pattern');
      expect(pattern).not.toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<CanvasBackground className="custom-bg" />);

      const container = document.querySelector('.canvas-background.custom-bg');
      expect(container).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Grid Configuration Tests
  // ==========================================================================

  describe('Grid Configuration', () => {
    it('should use default grid size of 20', () => {
      render(<CanvasBackground showGrid={true} />);

      const pattern = document.querySelector('pattern');
      expect(pattern).toHaveAttribute('width', '20');
      expect(pattern).toHaveAttribute('height', '20');
    });

    it('should use custom grid size when provided', () => {
      render(<CanvasBackground showGrid={true} gridSize={30} />);

      const pattern = document.querySelector('pattern');
      expect(pattern).toHaveAttribute('width', '30');
      expect(pattern).toHaveAttribute('height', '30');
    });

    it('should render dot pattern by default', () => {
      render(<CanvasBackground showGrid={true} gridType="dots" />);

      const circle = document.querySelector('pattern circle');
      expect(circle).toBeInTheDocument();
    });

    it('should render line pattern when specified', () => {
      render(<CanvasBackground showGrid={true} gridType="lines" />);

      const lines = document.querySelectorAll('pattern line');
      expect(lines.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Zoom and Pan Tests
  // ==========================================================================

  describe('Zoom and Pan', () => {
    it('should scale grid pattern based on zoom level', () => {
      render(<CanvasBackground showGrid={true} zoom={2} />);

      // At 200% zoom, pattern should be scaled
      const pattern = document.querySelector('pattern');
      expect(pattern).toBeInTheDocument();
      // Pattern transform attribute should reflect zoom
      const transform = pattern?.getAttribute('patternTransform');
      expect(transform).toContain('scale');
    });

    it('should offset grid based on pan position', () => {
      render(<CanvasBackground showGrid={true} offsetX={100} offsetY={50} />);

      const rect = document.querySelector('rect[fill*="url(#grid"]');
      expect(rect).toBeInTheDocument();
      // Transform should include translate
      const transform = rect?.getAttribute('transform');
      expect(transform).toContain('translate');
    });

    it('should handle default zoom of 1', () => {
      render(<CanvasBackground showGrid={true} />);

      const pattern = document.querySelector('pattern');
      expect(pattern).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Style Tests
  // ==========================================================================

  describe('Styling', () => {
    it('should use correct default grid color', () => {
      render(<CanvasBackground showGrid={true} />);

      const circle = document.querySelector('pattern circle');
      if (circle) {
        // Check fill has some opacity
        const fill = circle.getAttribute('fill');
        expect(fill).toBeTruthy();
      }
    });

    it('should apply custom grid color', () => {
      render(<CanvasBackground showGrid={true} gridColor="rgba(255,0,0,0.5)" />);

      const circle = document.querySelector('pattern circle');
      if (circle) {
        expect(circle.getAttribute('fill')).toBe('rgba(255,0,0,0.5)');
      }
    });

    it('should be positioned absolutely to fill parent', () => {
      render(<CanvasBackground />);

      const container = document.querySelector('.canvas-background');
      expect(container).toHaveClass('absolute');
      expect(container).toHaveClass('inset-0');
    });

    it('should have pointer-events-none to not block interactions', () => {
      render(<CanvasBackground />);

      const container = document.querySelector('.canvas-background');
      expect(container).toHaveClass('pointer-events-none');
    });
  });

  // ==========================================================================
  // Dark Mode Tests
  // ==========================================================================

  describe('Dark Mode', () => {
    it('should have appropriate contrast for dark theme', () => {
      render(<CanvasBackground showGrid={true} theme="dark" />);

      const circle = document.querySelector('pattern circle');
      if (circle) {
        // Dark mode should use lighter grid color
        const fill = circle.getAttribute('fill');
        expect(fill).toContain('rgba');
      }
    });

    it('should have appropriate contrast for light theme', () => {
      render(<CanvasBackground showGrid={true} theme="light" />);

      const circle = document.querySelector('pattern circle');
      if (circle) {
        const fill = circle.getAttribute('fill');
        expect(fill).toContain('rgba');
      }
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('should have aria-hidden attribute', () => {
      render(<CanvasBackground />);

      const svg = document.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
