/**
 * TextAreaControl - shadcn-based textarea control for Rete.js nodes
 *
 * Uses shadcn/ui Textarea component with dark theme styling
 * and proper event propagation handling for Rete.js integration.
 */

import React, { useState } from 'react';
import { ClassicPreset } from 'rete';
import { Textarea } from '@/components/ui/textarea';

// ============================================================================
// TextAreaControl Class
// ============================================================================

/**
 * Custom TextArea Control for multi-line text input in Rete.js nodes
 */
export class TextAreaControl extends ClassicPreset.Control {
  constructor(
    public value: string,
    public placeholder?: string,
    public onChange?: (value: string) => void
  ) {
    super();
  }

  setValue(value: string) {
    this.value = value;
    this.onChange?.(value);
  }
}

// ============================================================================
// TextAreaControlComponent
// ============================================================================

interface TextAreaControlComponentProps {
  data: TextAreaControl;
}

/**
 * React component for TextAreaControl using shadcn/ui Textarea
 */
export function TextAreaControlComponent({ data }: TextAreaControlComponentProps) {
  const [value, setValue] = useState(data.value);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    data.setValue(newValue);
  };

  return (
    <Textarea
      value={value}
      placeholder={data.placeholder}
      onChange={handleChange}
      onPointerDown={(e) => e.stopPropagation()}
      className="min-h-[60px] text-xs bg-background/50 border-border/50 resize-y focus:ring-1 focus:ring-primary"
    />
  );
}

export default TextAreaControlComponent;
