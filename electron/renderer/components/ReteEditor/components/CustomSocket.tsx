/**
 * CustomSocket - Socket component with larger hit area for Rete.js
 *
 * Features:
 * - 12px visible socket
 * - 24px hit area for easy clicking
 * - Hover scale animation
 * - Connected/disconnected styling
 */

import React from 'react';
import { cn } from '@/lib/utils';

// ============================================================================
// CustomSocket Component
// ============================================================================

interface CustomSocketProps {
  type?: 'input' | 'output';
  connected?: boolean;
}

export function CustomSocket({ type = 'input', connected = false }: CustomSocketProps) {
  return (
    <div
      data-testid="socket-hit-area"
      className="w-6 h-6 flex items-center justify-center cursor-crosshair"
    >
      <div
        data-testid="socket"
        className={cn(
          'w-3 h-3 rounded-full border-2 border-border transition-transform hover:scale-125',
          connected ? 'bg-primary' : 'bg-muted'
        )}
      />
    </div>
  );
}

export default CustomSocket;
