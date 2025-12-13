/**
 * ReteToolbar
 *
 * Modern toolbar component for the Rete.js workflow editor.
 * Uses shadcn/ui Button and Tooltip with Lucide icons.
 */

import React from 'react';
import {
  FolderOpen,
  Save,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid3X3,
  Trash2,
  Play,
  Square,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

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
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  variant?: 'default' | 'destructive' | 'success';
}

function ToolbarButton({
  icon,
  label,
  shortcut,
  onClick,
  disabled = false,
  active = false,
  variant = 'default',
}: ToolbarButtonProps) {
  const tooltipContent = shortcut ? `${label} (${shortcut})` : label;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          disabled={disabled}
          title={label}
          className={cn(
            'h-8 w-8',
            active && 'bg-accent',
            variant === 'destructive' && 'text-destructive hover:text-destructive hover:bg-destructive/10',
            variant === 'success' && 'text-green-500 hover:text-green-500 hover:bg-green-500/10'
          )}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltipContent}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================================
// ReteToolbar
// ============================================================================

/**
 * ReteToolbar - Modern toolbar for workflow editor actions
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
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'rete-toolbar flex items-center gap-1 px-3 py-1.5 bg-background border-b',
          className
        )}
      >
        {/* File operations */}
        <ToolbarButton
          icon={<FolderOpen className="h-4 w-4" />}
          label="Load workflow"
          shortcut="Cmd+O"
          onClick={onLoad}
        />
        <ToolbarButton
          icon={<Save className="h-4 w-4" />}
          label="Save workflow"
          shortcut="Cmd+S"
          onClick={onSave}
        />

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* History */}
        <ToolbarButton
          icon={<Undo2 className="h-4 w-4" />}
          label="Undo"
          shortcut="Cmd+Z"
          onClick={onUndo}
          disabled={!canUndo}
        />
        <ToolbarButton
          icon={<Redo2 className="h-4 w-4" />}
          label="Redo"
          shortcut="Cmd+Shift+Z"
          onClick={onRedo}
          disabled={!canRedo}
        />

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Zoom controls */}
        <ToolbarButton
          icon={<ZoomOut className="h-4 w-4" />}
          label="Zoom out"
          shortcut="-"
          onClick={onZoomOut}
        />
        <span className="min-w-[50px] text-center text-xs text-muted-foreground">
          {Math.round(zoom)}%
        </span>
        <ToolbarButton
          icon={<ZoomIn className="h-4 w-4" />}
          label="Zoom in"
          shortcut="+"
          onClick={onZoomIn}
        />
        <ToolbarButton
          icon={<Maximize2 className="h-4 w-4" />}
          label="Fit to view"
          shortcut="F"
          onClick={onZoomFit}
        />

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* View options */}
        <ToolbarButton
          icon={<Grid3X3 className="h-4 w-4" />}
          label={gridEnabled ? 'Hide grid' : 'Show grid'}
          shortcut="G"
          onClick={onToggleGrid}
          active={gridEnabled}
        />

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Editor actions */}
        <ToolbarButton
          icon={<Trash2 className="h-4 w-4" />}
          label="Clear editor"
          onClick={onClear}
          variant="destructive"
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Run button */}
        <Button
          size="sm"
          onClick={onRun}
          disabled={isRunning}
          title={isRunning ? 'Stop workflow' : 'Run workflow'}
          className={cn(
            'gap-1',
            isRunning
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-green-600 hover:bg-green-700'
          )}
        >
          {isRunning ? (
            <>
              <Square className="h-3.5 w-3.5" />
              Stop
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              Run
            </>
          )}
        </Button>
      </div>
    </TooltipProvider>
  );
};

export default ReteToolbar;
