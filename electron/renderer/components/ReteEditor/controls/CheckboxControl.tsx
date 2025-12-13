/**
 * CheckboxControl - shadcn-based checkbox control for Rete.js nodes
 *
 * Uses shadcn/ui Checkbox component with dark theme styling
 * and proper event propagation handling for Rete.js integration.
 */

import React, { useState } from 'react';
import { ClassicPreset } from 'rete';
import { Checkbox } from '@/components/ui/checkbox';

// ============================================================================
// CheckboxControl Class
// ============================================================================

/**
 * Custom Checkbox Control for boolean values in Rete.js nodes
 */
export class CheckboxControl extends ClassicPreset.Control {
  constructor(
    public label: string,
    public value: boolean,
    public onChange?: (value: boolean) => void
  ) {
    super();
  }

  setValue(value: boolean) {
    this.value = value;
    this.onChange?.(value);
  }
}

// ============================================================================
// CheckboxControlComponent
// ============================================================================

interface CheckboxControlComponentProps {
  data: CheckboxControl;
}

/**
 * React component for CheckboxControl using shadcn/ui Checkbox
 */
export function CheckboxControlComponent({ data }: CheckboxControlComponentProps) {
  const [checked, setChecked] = useState(data.value);

  const handleCheckedChange = (newChecked: boolean) => {
    setChecked(newChecked);
    data.setValue(newChecked);
  };

  return (
    <label
      className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={handleCheckedChange}
        className="border-border/50 data-[state=checked]:bg-primary"
      />
      <span>{data.label}</span>
    </label>
  );
}

export default CheckboxControlComponent;
