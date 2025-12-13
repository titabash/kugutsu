/**
 * SelectControl - shadcn-based dropdown control for Rete.js nodes
 *
 * Uses shadcn/ui Select component with dark theme styling
 * and proper event propagation handling for Rete.js integration.
 */

import React, { useState } from 'react';
import { ClassicPreset } from 'rete';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ============================================================================
// SelectControl Class
// ============================================================================

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Custom Select Control for dropdown menus in Rete.js nodes
 */
export class SelectControl extends ClassicPreset.Control {
  constructor(
    public value: string,
    public options: SelectOption[],
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
// SelectControlComponent
// ============================================================================

interface SelectControlComponentProps {
  data: SelectControl;
}

/**
 * React component for SelectControl using shadcn/ui Select
 */
export function SelectControlComponent({ data }: SelectControlComponentProps) {
  const [value, setValue] = useState(data.value);

  const handleValueChange = (newValue: string) => {
    setValue(newValue);
    data.setValue(newValue);
  };

  return (
    <Select value={value} onValueChange={handleValueChange}>
      <SelectTrigger
        className="h-8 text-xs bg-background/50 border-border/50 focus:ring-1 focus:ring-primary"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {data.options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default SelectControlComponent;
