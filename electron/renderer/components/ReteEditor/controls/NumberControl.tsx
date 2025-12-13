/**
 * NumberControl - shadcn-based number input control for Rete.js nodes
 *
 * Uses shadcn/ui Input component with dark theme styling
 * and proper event propagation handling for Rete.js integration.
 */

import React, { useState } from 'react';
import { ClassicPreset } from 'rete';
import { Input } from '@/components/ui/input';

// ============================================================================
// NumberControl Class
// ============================================================================

/**
 * Custom Number Input Control with label for Rete.js nodes
 */
export class NumberControl extends ClassicPreset.Control {
  constructor(
    public label: string,
    public value: number,
    public min?: number,
    public max?: number,
    public onChange?: (value: number) => void
  ) {
    super();
  }

  setValue(value: number) {
    this.value = value;
    this.onChange?.(value);
  }
}

// ============================================================================
// NumberControlComponent
// ============================================================================

interface NumberControlComponentProps {
  data: NumberControl;
}

/**
 * React component for NumberControl using shadcn/ui Input
 */
export function NumberControlComponent({ data }: NumberControlComponentProps) {
  const [value, setValue] = useState(data.value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseInt(e.target.value, 10);
    if (!isNaN(num)) {
      setValue(num);
      data.setValue(num);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground min-w-[60px]">{data.label}</span>
      <Input
        type="number"
        value={value}
        min={data.min}
        max={data.max}
        onChange={handleChange}
        onPointerDown={(e) => e.stopPropagation()}
        className="w-16 h-8 text-xs bg-background/50 border-border/50 focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

export default NumberControlComponent;
