/**
 * TextAreaControl Component Tests
 *
 * TDD tests for the shadcn-based TextAreaControl component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { TextAreaControlComponent, TextAreaControl } from '@/components/ReteEditor/controls/TextAreaControl';

describe('TextAreaControl', () => {
  describe('TextAreaControl Class', () => {
    it('should initialize with correct value', () => {
      const control = new TextAreaControl('Initial text');
      expect(control.value).toBe('Initial text');
    });

    it('should initialize with placeholder', () => {
      const control = new TextAreaControl('', 'Enter text...');
      expect(control.placeholder).toBe('Enter text...');
    });

    it('should call onChange when setValue is called', () => {
      const onChange = vi.fn();
      const control = new TextAreaControl('', undefined, onChange);

      control.setValue('New text');

      expect(control.value).toBe('New text');
      expect(onChange).toHaveBeenCalledWith('New text');
    });

    it('should work without onChange callback', () => {
      const control = new TextAreaControl('');
      expect(() => control.setValue('text')).not.toThrow();
      expect(control.value).toBe('text');
    });
  });

  describe('TextAreaControlComponent', () => {
    it('should render with initial value', () => {
      const control = new TextAreaControl('Initial text');
      render(<TextAreaControlComponent data={control} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('Initial text');
    });

    it('should display placeholder text', () => {
      const control = new TextAreaControl('', 'Enter prompt...');
      render(<TextAreaControlComponent data={control} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('placeholder', 'Enter prompt...');
    });

    it('should call setValue on text change', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const control = new TextAreaControl('', undefined, onChange);
      render(<TextAreaControlComponent data={control} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Hello');

      expect(onChange).toHaveBeenCalled();
    });

    it('should stop pointer event propagation', () => {
      const control = new TextAreaControl('');
      render(<TextAreaControlComponent data={control} />);

      const textarea = screen.getByRole('textbox');
      const stopPropagation = vi.fn();
      const pointerDownEvent = new PointerEvent('pointerdown', { bubbles: true });
      Object.defineProperty(pointerDownEvent, 'stopPropagation', { value: stopPropagation });

      textarea.dispatchEvent(pointerDownEvent);

      expect(stopPropagation).toHaveBeenCalled();
    });

    it('should have dark theme styling', () => {
      const control = new TextAreaControl('');
      render(<TextAreaControlComponent data={control} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('bg-background/50');
    });

    it('should have minimum height for visibility', () => {
      const control = new TextAreaControl('');
      render(<TextAreaControlComponent data={control} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('min-h-[60px]');
    });

    it('should allow vertical resize', () => {
      const control = new TextAreaControl('');
      render(<TextAreaControlComponent data={control} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('resize-y');
    });
  });
});
