/**
 * CheckboxControl Component Tests
 *
 * TDD tests for the shadcn-based CheckboxControl component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { CheckboxControlComponent, CheckboxControl } from '@/components/ReteEditor/controls/CheckboxControl';

describe('CheckboxControl', () => {
  describe('CheckboxControl Class', () => {
    it('should initialize with label and value', () => {
      const control = new CheckboxControl('Enable feature', true);
      expect(control.label).toBe('Enable feature');
      expect(control.value).toBe(true);
    });

    it('should default value to false', () => {
      const control = new CheckboxControl('Enable feature', false);
      expect(control.value).toBe(false);
    });

    it('should call onChange when setValue is called', () => {
      const onChange = vi.fn();
      const control = new CheckboxControl('Enable', false, onChange);

      control.setValue(true);

      expect(control.value).toBe(true);
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('should toggle value correctly', () => {
      const control = new CheckboxControl('Enable', false);

      control.setValue(true);
      expect(control.value).toBe(true);

      control.setValue(false);
      expect(control.value).toBe(false);
    });
  });

  describe('CheckboxControlComponent', () => {
    it('should render with label', () => {
      const control = new CheckboxControl('Include Metrics', true);
      render(<CheckboxControlComponent data={control} />);

      expect(screen.getByText('Include Metrics')).toBeInTheDocument();
    });

    it('should render checked when value is true', () => {
      const control = new CheckboxControl('Enable', true);
      render(<CheckboxControlComponent data={control} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    it('should render unchecked when value is false', () => {
      const control = new CheckboxControl('Enable', false);
      render(<CheckboxControlComponent data={control} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
    });

    it('should call setValue when clicked', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const control = new CheckboxControl('Enable', false, onChange);
      render(<CheckboxControlComponent data={control} />);

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('should toggle value on click', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const control = new CheckboxControl('Enable', true, onChange);
      render(<CheckboxControlComponent data={control} />);

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      expect(onChange).toHaveBeenCalledWith(false);
    });

    it('should stop pointer event propagation', () => {
      const control = new CheckboxControl('Enable', false);
      render(<CheckboxControlComponent data={control} />);

      const label = screen.getByText('Enable').closest('label')!;
      const stopPropagation = vi.fn();
      const pointerDownEvent = new PointerEvent('pointerdown', { bubbles: true });
      Object.defineProperty(pointerDownEvent, 'stopPropagation', { value: stopPropagation });

      label.dispatchEvent(pointerDownEvent);

      expect(stopPropagation).toHaveBeenCalled();
    });

    it('should have proper flex layout', () => {
      const control = new CheckboxControl('Enable', false);
      render(<CheckboxControlComponent data={control} />);

      const label = screen.getByText('Enable').closest('label')!;
      expect(label).toHaveClass('flex');
      expect(label).toHaveClass('items-center');
      expect(label).toHaveClass('gap-2');
    });
  });
});
