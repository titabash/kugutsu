/**
 * ReteToolbar Tests
 *
 * Phase 4.3: Execution controls
 * TDD: Tests for workflow editor toolbar
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { ReteToolbar } from '../../../renderer/components/ReteEditor/ReteToolbar';

// ============================================================================
// ReteToolbar Tests
// ============================================================================

describe('ReteToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe('Rendering', () => {
    it('should render the toolbar container', () => {
      render(<ReteToolbar />);

      const toolbar = document.querySelector('.rete-toolbar');
      expect(toolbar).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<ReteToolbar className="custom-class" />);

      const toolbar = document.querySelector('.rete-toolbar.custom-class');
      expect(toolbar).toBeInTheDocument();
    });

    it('should display all toolbar buttons', () => {
      render(<ReteToolbar />);

      // File operations
      expect(screen.getByTitle(/load workflow/i)).toBeInTheDocument();
      expect(screen.getByTitle(/save workflow/i)).toBeInTheDocument();

      // History
      expect(screen.getByTitle(/undo/i)).toBeInTheDocument();
      expect(screen.getByTitle(/redo/i)).toBeInTheDocument();

      // Zoom
      expect(screen.getByTitle(/zoom out/i)).toBeInTheDocument();
      expect(screen.getByTitle(/zoom in/i)).toBeInTheDocument();
      expect(screen.getByTitle(/fit to view/i)).toBeInTheDocument();

      // Other
      expect(screen.getByTitle(/grid/i)).toBeInTheDocument();
      expect(screen.getByTitle(/clear editor/i)).toBeInTheDocument();
      expect(screen.getByTitle(/run workflow/i)).toBeInTheDocument();
    });

    it('should display zoom percentage', () => {
      render(<ReteToolbar zoom={150} />);

      expect(screen.getByText('150%')).toBeInTheDocument();
    });

    it('should display default zoom of 100%', () => {
      render(<ReteToolbar />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // File Operations Tests
  // ==========================================================================

  describe('File Operations', () => {
    it('should call onLoad when load button clicked', async () => {
      const user = userEvent.setup();
      const onLoad = vi.fn();

      render(<ReteToolbar onLoad={onLoad} />);

      const loadButton = screen.getByTitle(/load workflow/i);
      await user.click(loadButton);

      expect(onLoad).toHaveBeenCalledTimes(1);
    });

    it('should call onSave when save button clicked', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();

      render(<ReteToolbar onSave={onSave} />);

      const saveButton = screen.getByTitle(/save workflow/i);
      await user.click(saveButton);

      expect(onSave).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // History Controls Tests
  // ==========================================================================

  describe('History Controls', () => {
    it('should disable undo button when canUndo is false', () => {
      render(<ReteToolbar canUndo={false} />);

      const undoButton = screen.getByTitle(/undo/i);
      expect(undoButton).toBeDisabled();
    });

    it('should enable undo button when canUndo is true', () => {
      render(<ReteToolbar canUndo={true} />);

      const undoButton = screen.getByTitle(/undo/i);
      expect(undoButton).not.toBeDisabled();
    });

    it('should disable redo button when canRedo is false', () => {
      render(<ReteToolbar canRedo={false} />);

      const redoButton = screen.getByTitle(/redo/i);
      expect(redoButton).toBeDisabled();
    });

    it('should enable redo button when canRedo is true', () => {
      render(<ReteToolbar canRedo={true} />);

      const redoButton = screen.getByTitle(/redo/i);
      expect(redoButton).not.toBeDisabled();
    });

    it('should call onUndo when undo button clicked', async () => {
      const user = userEvent.setup();
      const onUndo = vi.fn();

      render(<ReteToolbar onUndo={onUndo} canUndo={true} />);

      const undoButton = screen.getByTitle(/undo/i);
      await user.click(undoButton);

      expect(onUndo).toHaveBeenCalledTimes(1);
    });

    it('should call onRedo when redo button clicked', async () => {
      const user = userEvent.setup();
      const onRedo = vi.fn();

      render(<ReteToolbar onRedo={onRedo} canRedo={true} />);

      const redoButton = screen.getByTitle(/redo/i);
      await user.click(redoButton);

      expect(onRedo).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Zoom Controls Tests
  // ==========================================================================

  describe('Zoom Controls', () => {
    it('should call onZoomIn when zoom in button clicked', async () => {
      const user = userEvent.setup();
      const onZoomIn = vi.fn();

      render(<ReteToolbar onZoomIn={onZoomIn} />);

      const zoomInButton = screen.getByTitle(/zoom in/i);
      await user.click(zoomInButton);

      expect(onZoomIn).toHaveBeenCalledTimes(1);
    });

    it('should call onZoomOut when zoom out button clicked', async () => {
      const user = userEvent.setup();
      const onZoomOut = vi.fn();

      render(<ReteToolbar onZoomOut={onZoomOut} />);

      const zoomOutButton = screen.getByTitle(/zoom out/i);
      await user.click(zoomOutButton);

      expect(onZoomOut).toHaveBeenCalledTimes(1);
    });

    it('should call onZoomFit when fit button clicked', async () => {
      const user = userEvent.setup();
      const onZoomFit = vi.fn();

      render(<ReteToolbar onZoomFit={onZoomFit} />);

      const fitButton = screen.getByTitle(/fit to view/i);
      await user.click(fitButton);

      expect(onZoomFit).toHaveBeenCalledTimes(1);
    });

    it('should round zoom percentage', () => {
      render(<ReteToolbar zoom={123.456} />);

      expect(screen.getByText('123%')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Grid Toggle Tests
  // ==========================================================================

  describe('Grid Toggle', () => {
    it('should show "Hide grid" tooltip when grid is enabled', () => {
      render(<ReteToolbar gridEnabled={true} />);

      expect(screen.getByTitle(/hide grid/i)).toBeInTheDocument();
    });

    it('should show "Show grid" tooltip when grid is disabled', () => {
      render(<ReteToolbar gridEnabled={false} />);

      expect(screen.getByTitle(/show grid/i)).toBeInTheDocument();
    });

    it('should call onToggleGrid when grid button clicked', async () => {
      const user = userEvent.setup();
      const onToggleGrid = vi.fn();

      render(<ReteToolbar onToggleGrid={onToggleGrid} />);

      const gridButton = screen.getByTitle(/grid/i);
      await user.click(gridButton);

      expect(onToggleGrid).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Clear Editor Tests
  // ==========================================================================

  describe('Clear Editor', () => {
    it('should call onClear when clear button clicked', async () => {
      const user = userEvent.setup();
      const onClear = vi.fn();

      render(<ReteToolbar onClear={onClear} />);

      const clearButton = screen.getByTitle(/clear editor/i);
      await user.click(clearButton);

      expect(onClear).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Run Button Tests
  // ==========================================================================

  describe('Run Button', () => {
    it('should show "Run workflow" when not running', () => {
      render(<ReteToolbar isRunning={false} />);

      expect(screen.getByTitle(/run workflow/i)).toBeInTheDocument();
    });

    it('should show "Stop workflow" when running', () => {
      render(<ReteToolbar isRunning={true} />);

      expect(screen.getByTitle(/stop workflow/i)).toBeInTheDocument();
    });

    it('should call onRun when run button clicked', async () => {
      const user = userEvent.setup();
      const onRun = vi.fn();

      render(<ReteToolbar onRun={onRun} isRunning={false} />);

      const runButton = screen.getByTitle(/run workflow/i);
      await user.click(runButton);

      expect(onRun).toHaveBeenCalledTimes(1);
    });

    it('should disable run button when running', () => {
      render(<ReteToolbar isRunning={true} />);

      const stopButton = screen.getByTitle(/stop workflow/i);
      expect(stopButton).toBeDisabled();
    });

    it('should show Run text when not running', () => {
      render(<ReteToolbar isRunning={false} />);

      const runButton = screen.getByTitle(/run workflow/i);
      expect(runButton).toHaveTextContent('Run');
    });

    it('should show Stop text when running', () => {
      render(<ReteToolbar isRunning={true} />);

      const stopButton = screen.getByTitle(/stop workflow/i);
      expect(stopButton).toHaveTextContent('Stop');
    });
  });

  // ==========================================================================
  // Button States Tests
  // ==========================================================================

  describe('Button States', () => {
    it('should not call callbacks when buttons are disabled', async () => {
      const user = userEvent.setup();
      const onUndo = vi.fn();
      const onRedo = vi.fn();

      render(<ReteToolbar onUndo={onUndo} onRedo={onRedo} canUndo={false} canRedo={false} />);

      const undoButton = screen.getByTitle(/undo/i);
      const redoButton = screen.getByTitle(/redo/i);

      await user.click(undoButton);
      await user.click(redoButton);

      expect(onUndo).not.toHaveBeenCalled();
      expect(onRedo).not.toHaveBeenCalled();
    });

    it('should apply active style to grid button when grid enabled', () => {
      render(<ReteToolbar gridEnabled={true} />);

      const gridButton = screen.getByTitle(/hide grid/i);
      // Active buttons have the bg-accent class
      expect(gridButton).toHaveClass('bg-accent');
    });
  });

  // ==========================================================================
  // Layout Tests
  // ==========================================================================

  describe('Layout', () => {
    it('should have toolbar buttons in flex layout', () => {
      render(<ReteToolbar />);

      const toolbar = document.querySelector('.rete-toolbar');
      expect(toolbar).toHaveClass('flex');
    });

    it('should have separators between button groups', () => {
      render(<ReteToolbar />);

      // Check that separators exist (Separator components from shadcn/ui)
      const separators = document.querySelectorAll('[data-orientation="vertical"]');
      expect(separators.length).toBeGreaterThan(0);
    });
  });
});
