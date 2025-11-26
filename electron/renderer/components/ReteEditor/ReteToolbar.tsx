/**
 * ReteToolbar
 *
 * Toolbar component for the Rete.js workflow editor.
 * Provides common actions like zoom, clear, save, and load.
 */

import React from 'react';

// ============================================================================
// Types
// ============================================================================

export interface ReteToolbarProps {
  className?: string;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomFit?: () => void;
  onClear?: () => void;
  onSave?: () => void;
  onLoad?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onToggleGrid?: () => void;
  onRun?: () => void;
  isRunning?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  gridEnabled?: boolean;
  zoom?: number;
}

// ============================================================================
// ToolbarButton Component
// ============================================================================

interface ToolbarButtonProps {
  icon: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  variant?: 'default' | 'primary' | 'danger';
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon,
  label,
  onClick,
  disabled = false,
  active = false,
  variant = 'default',
}) => {
  const getBackgroundColor = () => {
    if (disabled) return '#2a2a2a';
    if (active) return '#4a4a4a';
    switch (variant) {
      case 'primary':
        return '#3b82f6';
      case 'danger':
        return '#ef4444';
      default:
        return '#333';
    }
  };

  const getHoverColor = () => {
    if (disabled) return '#2a2a2a';
    switch (variant) {
      case 'primary':
        return '#2563eb';
      case 'danger':
        return '#dc2626';
      default:
        return '#444';
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        backgroundColor: getBackgroundColor(),
        border: 'none',
        borderRadius: '6px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background-color 0.2s ease',
        fontSize: '18px',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = getHoverColor();
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = getBackgroundColor();
        }
      }}
    >
      {icon}
    </button>
  );
};

// ============================================================================
// ToolbarDivider Component
// ============================================================================

const ToolbarDivider: React.FC = () => (
  <div
    style={{
      width: '1px',
      height: '24px',
      backgroundColor: '#444',
      margin: '0 8px',
    }}
  />
);

// ============================================================================
// ReteToolbar
// ============================================================================

/**
 * ReteToolbar - Toolbar for workflow editor actions
 */
export const ReteToolbar: React.FC<ReteToolbarProps> = ({
  className = '',
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onClear,
  onSave,
  onLoad,
  onUndo,
  onRedo,
  onToggleGrid,
  onRun,
  isRunning = false,
  canUndo = false,
  canRedo = false,
  gridEnabled = true,
  zoom = 100,
}) => {
  return (
    <div
      className={`rete-toolbar ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '8px 12px',
        backgroundColor: '#1f1f1f',
        borderBottom: '1px solid #333',
      }}
    >
      {/* File operations */}
      <ToolbarButton icon="📂" label="Load workflow" onClick={onLoad} />
      <ToolbarButton icon="💾" label="Save workflow" onClick={onSave} />

      <ToolbarDivider />

      {/* History */}
      <ToolbarButton icon="↩️" label="Undo" onClick={onUndo} disabled={!canUndo} />
      <ToolbarButton icon="↪️" label="Redo" onClick={onRedo} disabled={!canRedo} />

      <ToolbarDivider />

      {/* Zoom controls */}
      <ToolbarButton icon="➖" label="Zoom out" onClick={onZoomOut} />
      <div
        style={{
          minWidth: '50px',
          textAlign: 'center',
          color: '#888',
          fontSize: '12px',
        }}
      >
        {Math.round(zoom)}%
      </div>
      <ToolbarButton icon="➕" label="Zoom in" onClick={onZoomIn} />
      <ToolbarButton icon="🔍" label="Fit to view" onClick={onZoomFit} />

      <ToolbarDivider />

      {/* View options */}
      <ToolbarButton
        icon="⊞"
        label={gridEnabled ? 'Hide grid' : 'Show grid'}
        onClick={onToggleGrid}
        active={gridEnabled}
      />

      <ToolbarDivider />

      {/* Editor actions */}
      <ToolbarButton icon="🗑️" label="Clear editor" onClick={onClear} variant="danger" />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Run button */}
      <ToolbarButton
        icon={isRunning ? '⏹️' : '▶️'}
        label={isRunning ? 'Stop workflow' : 'Run workflow'}
        onClick={onRun}
        variant="primary"
        disabled={isRunning}
      />
    </div>
  );
};

export default ReteToolbar;
