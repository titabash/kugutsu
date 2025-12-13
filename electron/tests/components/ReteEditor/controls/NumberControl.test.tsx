/**
 * NumberControl Component Tests
 *
 * TDD tests for the shadcn-based NumberControl component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { NumberControlComponent, NumberControl } from '@/components/ReteEditor/controls/NumberControl';

describe('NumberControl', () => {
  describe('NumberControl Class', () => {
    it('should initialize with label and value', () => {
      const control = new NumberControl('Max Turns', 30);
      expect(control.label).toBe('Max Turns');
      expect(control.value).toBe(30);
    });

    it('should initialize with min and max values', () => {
      const control = new NumberControl('Concurrency', 4, 1, 10);
      expect(control.min).toBe(1);
      expect(control.max).toBe(10);
    });

    it('should call onChange when setValue is called', () => {
      const onChange = vi.fn();
      const control = new NumberControl('Count', 5, undefined, undefined, onChange);

      control.setValue(10);

      expect(control.value).toBe(10);
      expect(onChange).toHaveBeenCalledWith(10);
    });

    it('should work without min/max constraints', () => {
      const control = new NumberControl('Value', 0);
      expect(control.min).toBeUndefined();
      expect(control.max).toBeUndefined();
    });
  });

  describe('NumberControlComponent', () => {
    it('should render with label', () => {
      const control = new NumberControl('Concurrency', 4);
      render(<NumberControlComponent data={control} />);

      expect(screen.getByText('Concurrency')).toBeInTheDocument();
    });

    it('should render with initial value', () => {
      const control = new NumberControl('Count', 42);
      render(<NumberControlComponent data={control} />);

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveValue(42);
    });

    it('should set min and max attributes', () => {
      const control = new NumberControl('Value', 5, 1, 10);
      render(<NumberControlComponent data={control} />);

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('min', '1');
      expect(input).toHaveAttribute('max', '10');
    });

    it('should call setValue on value change', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const control = new NumberControl('Count', 5, undefined, undefined, onChange);
      render(<NumberControlComponent data={control} />);

      const input = screen.getByRole('spinbutton');
      await user.clear(input);
      await user.type(input, '10');

      expect(onChange).toHaveBeenCalled();
    });

    it('should stop pointer event propagation', () => {
      const control = new NumberControl('Count', 5);
      render(<NumberControlComponent data={control} />);

      const input = screen.getByRole('spinbutton');
      const stopPropagation = vi.fn();
      const pointerDownEvent = new PointerEvent('pointerdown', { bubbles: true });
      Object.defineProperty(pointerDownEvent, 'stopPropagation', { value: stopPropagation });

      input.dispatchEvent(pointerDownEvent);

      expect(stopPropagation).toHaveBeenCalled();
    });

    it('should have proper flex layout with label', () => {
      const control = new NumberControl('Count', 5);
      render(<NumberControlComponent data={control} />);

      const container = screen.getByText('Count').closest('div');
      expect(container).toHaveClass('flex');
      expect(container).toHaveClass('items-center');
      expect(container).toHaveClass('gap-2');
    });

    it('should have narrow input width', () => {
      const control = new NumberControl('Count', 5);
      render(<NumberControlComponent data={control} />);

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveClass('w-16');
    });

    it('should have dark theme styling', () => {
      const control = new NumberControl('Count', 5);
      render(<NumberControlComponent data={control} />);

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveClass('bg-background/50');
    });
  });
});
