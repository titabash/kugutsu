/**
 * WorkflowEditorView
 *
 * Wrapper component that integrates the Rete.js workflow editor
 * into the Electron application.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReteWorkflowEditor,
  ReteToolbar,
  NodePalette,
  NodePropertyEditor,
  serializeWorkflow,
  deserializeWorkflow,
  type EditableNodeData,
  type WorkflowNodeType,
  type EditorData,
} from './ReteEditor';
import type { ReteWorkflowJSON } from '../../../src/workflow/types';

// Declare electron API type
declare global {
  interface Window {
    electronAPI?: {
      showSaveWorkflowDialog: () => Promise<{ canceled: boolean; filePath?: string }>;
      showLoadWorkflowDialog: () => Promise<{ canceled: boolean; filePaths?: string[] }>;
      saveWorkflow: (filePath: string, workflow: ReteWorkflowJSON) => Promise<{ success: boolean; error?: string }>;
      loadWorkflow: (filePath: string) => Promise<{ success: boolean; workflow?: ReteWorkflowJSON; error?: string }>;
      executeWorkflow: (workflow: ReteWorkflowJSON) => Promise<{ success: boolean; message?: string; error?: string }>;
      onWorkflowProgress: (callback: (data: { nodeId: string; status: string; progress?: number }) => void) => () => void;
      onWorkflowCompleted: (callback: (data: { success: boolean; result?: unknown; error?: string }) => void) => () => void;
    };
  }
}

// ============================================================================
// Types
// ============================================================================

interface EditorNode {
  id: string;
  type: WorkflowNodeType;
  label: string;
  position: { x: number; y: number };
  inputs: Array<{ key: string; label: string }>;
  outputs: Array<{ key: string; label: string }>;
  config: Record<string, unknown>;
}

interface EditorInstance {
  addNode: (type: WorkflowNodeType, position: { x: number; y: number }) => Promise<string>;
  removeNode: (nodeId: string) => Promise<void>;
  getNodes: () => unknown[];
  getConnections: () => unknown[];
  clearEditor: () => Promise<void>;
  zoomToFit: () => void;
  setZoom: (zoom: number) => void;
  destroy: () => void;
  getEditorData: () => EditorData;
  loadEditorData: (data: EditorData) => Promise<void>;
  getNode: (nodeId: string) => EditorNode | null;
  updateNode: (nodeId: string, updates: { label?: string; config?: Record<string, unknown> }) => Promise<boolean>;
}

// ============================================================================
// WorkflowEditorView Props
// ============================================================================

interface WorkflowEditorViewProps {
  /** エディタの準備完了時のコールバック */
  onEditorReady?: (editor: EditorInstance) => void;
}

// ============================================================================
// WorkflowEditorView
// ============================================================================

export function WorkflowEditorView({ onEditorReady }: WorkflowEditorViewProps = {}) {
  const [editorInstance, setEditorInstance] = useState<EditorInstance | null>(null);
  const [selectedNode, setSelectedNode] = useState<EditableNodeData | null>(null);
  const [zoom, setZoom] = useState(100);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [propertyEditorCollapsed, setPropertyEditorCollapsed] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [executionProgress, setExecutionProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Listen for workflow execution events
  useEffect(() => {
    if (!window.electronAPI) return;

    // Subscribe to workflow progress events
    const unsubscribeProgress = window.electronAPI.onWorkflowProgress?.((data) => {
      console.log('[WorkflowEditorView] Workflow progress:', data);
      if (data.progress !== undefined) {
        setExecutionProgress(data.progress);
      }
      // TODO: Update node status in editor visualization
    });

    // Subscribe to workflow completion events
    const unsubscribeCompleted = window.electronAPI.onWorkflowCompleted?.((data) => {
      console.log('[WorkflowEditorView] Workflow completed:', data);
      setIsRunning(false);
      setExecutionProgress(0);
      if (!data.success && data.error) {
        console.error('[WorkflowEditorView] Workflow failed:', data.error);
      }
    });

    return () => {
      unsubscribeProgress?.();
      unsubscribeCompleted?.();
    };
  }, []);

  // Handle editor ready
  const handleEditorReady = useCallback((editor: EditorInstance) => {
    setEditorInstance(editor);
    console.log('[WorkflowEditorView] Editor ready');
    // 親コンポーネントに通知
    onEditorReady?.(editor);
  }, [onEditorReady]);

  // Handle node selection
  const handleNodeSelect = useCallback((nodeId: string | null) => {
    if (!nodeId) {
      setSelectedNode(null);
      setPropertyEditorCollapsed(true);
      return;
    }

    // Get node data from editor using getNode method
    if (editorInstance) {
      const nodeData = editorInstance.getNode(nodeId);
      if (nodeData) {
        setSelectedNode({
          id: nodeData.id,
          type: nodeData.type,
          label: nodeData.label,
          config: nodeData.config,
        });
        setPropertyEditorCollapsed(false);
      }
    }
  }, [editorInstance]);

  // Handle node drag from palette
  const handleNodeDragStart = useCallback((type: WorkflowNodeType) => {
    console.log('[WorkflowEditorView] Dragging node:', type);
  }, []);

  // Handle node drag end - add node to editor
  const handleNodeDragEnd = useCallback(() => {
    // The node will be added when dropped on the canvas
    // This is handled by the ReteWorkflowEditor's drop event
  }, []);

  // Handle drop on canvas
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const nodeType = e.dataTransfer.getData('nodeType') as WorkflowNodeType;
      if (!nodeType || !editorInstance || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const position = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      try {
        await editorInstance.addNode(nodeType, position);
        console.log('[WorkflowEditorView] Added node:', nodeType, 'at', position);
      } catch (error) {
        console.error('[WorkflowEditorView] Failed to add node:', error);
      }
    },
    [editorInstance]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // Toolbar actions
  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(zoom + 10, 200);
    setZoom(newZoom);
    editorInstance?.setZoom(newZoom / 100);
  }, [zoom, editorInstance]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(zoom - 10, 25);
    setZoom(newZoom);
    editorInstance?.setZoom(newZoom / 100);
  }, [zoom, editorInstance]);

  const handleZoomFit = useCallback(() => {
    editorInstance?.zoomToFit();
    setZoom(100);
  }, [editorInstance]);

  const handleClear = useCallback(async () => {
    if (editorInstance) {
      await editorInstance.clearEditor();
      setSelectedNode(null);
    }
  }, [editorInstance]);

  const handleToggleGrid = useCallback(() => {
    setGridEnabled((prev) => !prev);
  }, []);

  const handleSave = useCallback(async () => {
    if (!editorInstance || !window.electronAPI) {
      console.warn('[WorkflowEditorView] Editor or Electron API not available');
      return;
    }

    try {
      // Show save dialog
      const dialogResult = await window.electronAPI.showSaveWorkflowDialog();
      if (dialogResult.canceled || !dialogResult.filePath) {
        console.log('[WorkflowEditorView] Save cancelled');
        return;
      }

      // Get editor data and serialize
      const editorData = editorInstance.getEditorData();
      const workflow = serializeWorkflow(editorData, {
        name: 'Workflow',
        description: 'Created with Rete.js Visual Editor',
      });

      // Save to file
      const saveResult = await window.electronAPI.saveWorkflow(dialogResult.filePath, workflow);
      if (saveResult.success) {
        console.log('[WorkflowEditorView] Workflow saved successfully');
      } else {
        console.error('[WorkflowEditorView] Failed to save workflow:', saveResult.error);
      }
    } catch (error) {
      console.error('[WorkflowEditorView] Error saving workflow:', error);
    }
  }, [editorInstance]);

  const handleLoad = useCallback(async () => {
    if (!editorInstance || !window.electronAPI) {
      console.warn('[WorkflowEditorView] Editor or Electron API not available');
      return;
    }

    try {
      // Show load dialog
      const dialogResult = await window.electronAPI.showLoadWorkflowDialog();
      if (dialogResult.canceled || !dialogResult.filePaths || dialogResult.filePaths.length === 0) {
        console.log('[WorkflowEditorView] Load cancelled');
        return;
      }

      // Load from file
      const loadResult = await window.electronAPI.loadWorkflow(dialogResult.filePaths[0]);
      if (!loadResult.success || !loadResult.workflow) {
        console.error('[WorkflowEditorView] Failed to load workflow:', loadResult.error);
        return;
      }

      // Deserialize and load into editor
      const editorData = deserializeWorkflow(loadResult.workflow);
      await editorInstance.loadEditorData(editorData);

      console.log('[WorkflowEditorView] Workflow loaded successfully');
    } catch (error) {
      console.error('[WorkflowEditorView] Error loading workflow:', error);
    }
  }, [editorInstance]);

  const handleRun = useCallback(async () => {
    if (!editorInstance || !window.electronAPI) {
      console.warn('[WorkflowEditorView] Editor or Electron API not available');
      return;
    }

    setIsRunning(true);

    try {
      // Get editor data and serialize
      const editorData = editorInstance.getEditorData();
      const workflow = serializeWorkflow(editorData, {
        name: 'Workflow Execution',
        description: 'Executing workflow',
      });

      // Execute workflow
      const result = await window.electronAPI.executeWorkflow(workflow);
      console.log('[WorkflowEditorView] Workflow execution result:', result);
    } catch (error) {
      console.error('[WorkflowEditorView] Error executing workflow:', error);
    }
    // Note: isRunning will be set to false when workflow-completed event is received
  }, [editorInstance]);

  // Property editor actions
  const handleNodeUpdate = useCallback(
    async (nodeId: string, updates: Partial<EditableNodeData>) => {
      console.log('[WorkflowEditorView] Update node:', nodeId, updates);

      if (!editorInstance) return;

      // Build the update object for the editor
      const editorUpdates: { label?: string; config?: Record<string, unknown> } = {};

      if (updates.label !== undefined) {
        editorUpdates.label = updates.label;
      }

      if (updates.config !== undefined) {
        editorUpdates.config = updates.config;
      }

      // Update the node in the editor
      const success = await editorInstance.updateNode(nodeId, editorUpdates);

      if (success) {
        // Update local state to reflect changes
        setSelectedNode((prev) => {
          if (!prev || prev.id !== nodeId) return prev;
          return { ...prev, ...updates };
        });
        console.log('[WorkflowEditorView] Node updated successfully');
      } else {
        console.error('[WorkflowEditorView] Failed to update node');
      }
    },
    [editorInstance]
  );

  const handleClosePropertyEditor = useCallback(() => {
    setPropertyEditorCollapsed(true);
    setSelectedNode(null);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#1a1a1a',
      }}
    >
      {/* Toolbar */}
      <ReteToolbar
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomFit={handleZoomFit}
        onClear={handleClear}
        onSave={handleSave}
        onLoad={handleLoad}
        onToggleGrid={handleToggleGrid}
        onRun={handleRun}
        isRunning={isRunning}
        gridEnabled={gridEnabled}
        zoom={zoom}
      />

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Editor canvas */}
        <div
          ref={containerRef}
          style={{ flex: 1, position: 'relative' }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <ReteWorkflowEditor
            onNodeSelect={handleNodeSelect}
            onEditorReady={handleEditorReady}
          />
        </div>

        {/* Property editor */}
        <NodePropertyEditor
          node={selectedNode}
          onNodeUpdate={handleNodeUpdate}
          onClose={handleClosePropertyEditor}
          collapsed={propertyEditorCollapsed}
        />
      </div>

      {/* Node palette (bottom) */}
      <NodePalette
        position="bottom"
        collapsed={paletteCollapsed}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragEnd={handleNodeDragEnd}
      />
    </div>
  );
}

export default WorkflowEditorView;
