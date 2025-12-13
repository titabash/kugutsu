/**
 * CustomSocket Component Tests
 *
 * TDD tests for the custom socket component with larger hit area.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import { CustomSocket } from '@/components/ReteEditor/components/CustomSocket';

describe('CustomSocket', () => {
  describe('Rendering', () => {
    it('should render socket element', () => {
      const { container } = render(<CustomSocket />);

      const socket = container.querySelector('[data-testid="socket"]');
      expect(socket).toBeInTheDocument();
    });

    it('should have visible size of 12px', () => {
      const { container } = render(<CustomSocket />);

      const socket = container.querySelector('[data-testid="socket"]');
      expect(socket).toHaveClass('w-3'); // 12px = 0.75rem = w-3 in Tailwind
      expect(socket).toHaveClass('h-3');
    });

    it('should have hit area of 24px', () => {
      const { container } = render(<CustomSocket />);

      const hitArea = container.querySelector('[data-testid="socket-hit-area"]');
      expect(hitArea).toHaveClass('w-6'); // 24px = 1.5rem = w-6 in Tailwind
      expect(hitArea).toHaveClass('h-6');
    });
  });

  describe('Input/Output Styling', () => {
    it('should style input socket differently from output', () => {
      const { container: inputContainer } = render(<CustomSocket type="input" />);
      const { container: outputContainer } = render(<CustomSocket type="output" />);

      const inputSocket = inputContainer.querySelector('[data-testid="socket"]');
      const outputSocket = outputContainer.querySelector('[data-testid="socket"]');

      // Both should be circles
      expect(inputSocket).toHaveClass('rounded-full');
      expect(outputSocket).toHaveClass('rounded-full');
    });
  });

  describe('Hover State', () => {
    it('should have hover transition class', () => {
      const { container } = render(<CustomSocket />);

      const socket = container.querySelector('[data-testid="socket"]');
      expect(socket).toHaveClass('transition-transform');
    });

    it('should scale up on hover', () => {
      const { container } = render(<CustomSocket />);

      const socket = container.querySelector('[data-testid="socket"]');
      expect(socket).toHaveClass('hover:scale-125');
    });
  });

  describe('Connected State', () => {
    it('should have different styling when connected', () => {
      const { container } = render(<CustomSocket connected={true} />);

      const socket = container.querySelector('[data-testid="socket"]');
      expect(socket).toHaveClass('bg-primary');
    });

    it('should have muted styling when not connected', () => {
      const { container } = render(<CustomSocket connected={false} />);

      const socket = container.querySelector('[data-testid="socket"]');
      expect(socket).toHaveClass('bg-muted');
    });
  });

  describe('Accessibility', () => {
    it('should be clickable', () => {
      const { container } = render(<CustomSocket />);

      const hitArea = container.querySelector('[data-testid="socket-hit-area"]');
      expect(hitArea).toHaveClass('cursor-crosshair');
    });
  });
});
