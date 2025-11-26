/**
 * ReteWorkflowEditor
 *
 * Main component for the Rete.js visual workflow editor.
 * Provides a canvas for creating and editing workflows.
 */

import React, { useRef, useEffect, useState } from 'react';
import { NodeEditor, ClassicPreset, GetSchemes } from 'rete';
import { AreaPlugin, AreaExtensions } from 'rete-area-plugin';
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin';
import { ReactPlugin, Presets as ReactPresets } from 'rete-react-plugin';
import { createRoot } from 'react-dom/client';
import { css } from 'styled-components';
import type { Schemes, AreaExtra, WorkflowNodeType } from './types';
import { NODE_COLORS } from './types';
import type { EditorData, EditorNode, EditorConnection } from './WorkflowSerializer';

// ============================================================================
// Custom Controls for inline editing
// ============================================================================

/**
 * Custom Select Control for dropdown menus
 */
class SelectControl extends ClassicPreset.Control {
  constructor(
    public value: string,
    public options: { value: string; label: string }[],
    public onChange?: (value: string) => void
  ) {
    super();
  }

  setValue(value: string) {
    this.value = value;
    this.onChange?.(value);
  }
}

/**
 * Custom TextArea Control for multi-line text
 */
class TextAreaControl extends ClassicPreset.Control {
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
// Custom Control Components
// ============================================================================

/**
 * React component for SelectControl
 */
function SelectControlComponent({ data }: { data: SelectControl }) {
  const [value, setValue] = useState(data.value);

  return (
    <select
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        data.setValue(e.target.value);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        width: '100%',
        padding: '4px 6px',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '3px',
        color: '#fff',
        fontSize: '11px',
        cursor: 'pointer',
      }}
    >
      {data.options.map((opt) => (
        <option key={opt.value} value={opt.value} style={{ backgroundColor: '#333' }}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/**
 * React component for TextAreaControl
 */
function TextAreaControlComponent({ data }: { data: TextAreaControl }) {
  const [value, setValue] = useState(data.value);

  return (
    <textarea
      value={value}
      placeholder={data.placeholder}
      onChange={(e) => {
        setValue(e.target.value);
        data.setValue(e.target.value);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        width: '100%',
        padding: '4px 6px',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '3px',
        color: '#fff',
        fontSize: '11px',
        minHeight: '50px',
        resize: 'vertical',
      }}
    />
  );
}

// ============================================================================
// Styled Components for Custom Node (extending classic preset)
// ============================================================================

// Custom styles that will be passed to the classic Node component
const customNodeStyles = css<{ selected?: boolean }>`
  background: #2d2d2d;
  border: 2px solid #4e58bf;
  border-radius: 8px;
  min-width: 200px;

  ${(props) =>
    props.selected &&
    css`
      border-color: #fbbf24;
      box-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
    `}

  .title {
    color: white;
    font-family: sans-serif;
    font-size: 14px;
    padding: 8px 12px;
    background: #4e58bf;
    border-radius: 6px 6px 0 0;
  }

  .input,
  .output {
    padding: 4px 8px;
  }

  .input-title,
  .output-title {
    color: #aaa;
    font-size: 12px;
  }

  .control {
    padding: 4px 8px;
  }
`;

// Styled Node component factory
function StyledNode(props: { data: Schemes['Node']; emit: (data: unknown) => void }) {
  return <ReactPresets.classic.Node styles={() => customNodeStyles} {...props} />;
}

// ============================================================================
// Rete.js Editor Setup
// ============================================================================

/**
 * Create the Rete.js editor instance
 */
async function createEditor(container: HTMLElement) {
  // Create socket type
  const socket = new ClassicPreset.Socket('default');

  // Create editor instance
  const editor = new NodeEditor<Schemes>();

  // Create area plugin
  const area = new AreaPlugin<Schemes, AreaExtra>(container);

  // Create connection plugin
  const connection = new ConnectionPlugin<Schemes, AreaExtra>();

  // Create React render plugin
  const render = new ReactPlugin<Schemes, AreaExtra>({ createRoot });

  // Setup connection presets
  connection.addPreset(ConnectionPresets.classic.setup());

  // Setup React presets with styled node component and custom controls
  render.addPreset(
    ReactPresets.classic.setup({
      customize: {
        node() {
          return StyledNode;
        },
        control(context) {
          // Handle custom SelectControl
          if (context.payload instanceof SelectControl) {
            return SelectControlComponent;
          }
          // Handle custom TextAreaControl
          if (context.payload instanceof TextAreaControl) {
            return TextAreaControlComponent;
          }
          // Default to classic InputControl
          if (context.payload instanceof ClassicPreset.InputControl) {
            return ReactPresets.classic.Control;
          }
          return null;
        },
      },
    })
  );

  // Register plugins
  editor.use(area);
  area.use(connection);
  area.use(render);

  // Enable zoom and drag
  AreaExtensions.selectableNodes(area, AreaExtensions.selector(), {
    accumulating: AreaExtensions.accumulateOnCtrl(),
  });
  AreaExtensions.simpleNodesOrder(area);

  // Create initial nodes for demonstration
  const startNode = new ClassicPreset.Node('Start');
  (startNode as unknown as { nodeType: WorkflowNodeType }).nodeType = 'start';
  (startNode as unknown as { config: Record<string, unknown> }).config = {};
  startNode.addOutput('output', new ClassicPreset.Output(socket, 'Output'));
  await editor.addNode(startNode);

  const endNode = new ClassicPreset.Node('End');
  (endNode as unknown as { nodeType: WorkflowNodeType }).nodeType = 'end';
  (endNode as unknown as { config: Record<string, unknown> }).config = {};
  endNode.addInput('input', new ClassicPreset.Input(socket, 'Input'));
  await editor.addNode(endNode);

  // Position nodes
  await area.translate(startNode.id, { x: 100, y: 200 });
  await area.translate(endNode.id, { x: 500, y: 200 });

  // Zoom to fit
  AreaExtensions.zoomAt(area, editor.getNodes());

  return {
    editor,
    area,
    destroy: () => area.destroy(),
    // Expose methods for external control
    addNode: async (type: WorkflowNodeType, position: { x: number; y: number }) => {
      // Generate display label
      const label = type.charAt(0).toUpperCase() + type.slice(1).replace(/-/g, ' ');
      const node = new ClassicPreset.Node(label);
      (node as unknown as { nodeType: WorkflowNodeType }).nodeType = type;

      // Initialize config based on node type
      const isAINode = ['engineer', 'reviewer', 'product-owner', 'custom-ai'].includes(type);
      const isDecisionNode = type === 'decision';
      const isTransformNode = type === 'transform';

      const nodeConfig: Record<string, unknown> = {};

      // Add controls based on node type
      if (isAINode) {
        nodeConfig.ai = {
          provider: 'claude',
          maxTurns: 30,
          systemPrompt: '',
        };

        // Add provider select control
        node.addControl(
          'provider',
          new SelectControl('claude', [
            { value: 'claude', label: 'Claude' },
            { value: 'openai', label: 'OpenAI' },
            { value: 'gemini', label: 'Gemini' },
          ], (value) => {
            const config = (node as unknown as { config: Record<string, unknown> }).config;
            (config.ai as Record<string, unknown>).provider = value;
          })
        );

        // Add maxTurns number control
        node.addControl(
          'maxTurns',
          new ClassicPreset.InputControl('number', {
            initial: 30,
            change: (value) => {
              const config = (node as unknown as { config: Record<string, unknown> }).config;
              (config.ai as Record<string, unknown>).maxTurns = value;
            },
          })
        );

        // Add systemPrompt textarea control
        node.addControl(
          'systemPrompt',
          new TextAreaControl('', 'Enter system prompt...', (value) => {
            const config = (node as unknown as { config: Record<string, unknown> }).config;
            (config.ai as Record<string, unknown>).systemPrompt = value;
          })
        );
      }

      if (isDecisionNode) {
        nodeConfig.condition = '';
        node.addControl(
          'condition',
          new TextAreaControl('', 'e.g., input.value > 10', (value) => {
            const config = (node as unknown as { config: Record<string, unknown> }).config;
            config.condition = value;
          })
        );
      }

      if (isTransformNode) {
        nodeConfig.transformType = 'custom';
        nodeConfig.transformFunction = '';

        node.addControl(
          'transformType',
          new SelectControl('custom', [
            { value: 'custom', label: 'Custom' },
            { value: 'map', label: 'Map' },
            { value: 'filter', label: 'Filter' },
            { value: 'reduce', label: 'Reduce' },
          ], (value) => {
            const config = (node as unknown as { config: Record<string, unknown> }).config;
            config.transformType = value;
          })
        );

        node.addControl(
          'transformFunction',
          new TextAreaControl('', 'return input * 2', (value) => {
            const config = (node as unknown as { config: Record<string, unknown> }).config;
            config.transformFunction = value;
          })
        );
      }

      (node as unknown as { config: Record<string, unknown> }).config = nodeConfig;

      // Add default input/output based on type
      if (type !== 'start') {
        node.addInput('input', new ClassicPreset.Input(socket, 'Input'));
      }
      if (type !== 'end') {
        node.addOutput('output', new ClassicPreset.Output(socket, 'Output'));
      }

      await editor.addNode(node);
      await area.translate(node.id, position);

      return node.id;
    },
    removeNode: async (nodeId: string) => {
      await editor.removeNode(nodeId);
    },
    getNodes: () => editor.getNodes(),
    getConnections: () => editor.getConnections(),
    clearEditor: async () => {
      const nodes = editor.getNodes();
      for (const node of nodes) {
        await editor.removeNode(node.id);
      }
    },
    zoomToFit: () => {
      AreaExtensions.zoomAt(area, editor.getNodes());
    },
    setZoom: (zoom: number) => {
      area.area.zoom(zoom);
    },
    /**
     * Get editor data in serializable format
     */
    getEditorData: (): EditorData => {
      const nodes = editor.getNodes();
      const connections = editor.getConnections();

      const editorNodes: EditorNode[] = nodes.map((node) => {
        const nodeType = (node as unknown as { nodeType?: WorkflowNodeType }).nodeType || 'custom-ai';
        const nodeConfig = (node as unknown as { config?: Record<string, unknown> }).config || {};
        const nodeView = area.nodeViews.get(node.id);
        const position = nodeView ? { x: nodeView.position.x, y: nodeView.position.y } : { x: 0, y: 0 };

        return {
          id: node.id,
          type: nodeType,
          label: node.label,
          position,
          inputs: Object.entries(node.inputs).map(([key, input]) => ({
            key,
            label: input?.label || key,
          })),
          outputs: Object.entries(node.outputs).map(([key, output]) => ({
            key,
            label: output?.label || key,
          })),
          config: nodeConfig,
        };
      });

      const editorConnections: EditorConnection[] = connections.map((conn, index) => ({
        id: conn.id || `conn-${index}`,
        source: conn.source,
        sourceOutput: conn.sourceOutput,
        target: conn.target,
        targetInput: conn.targetInput,
      }));

      return {
        nodes: editorNodes,
        connections: editorConnections,
      };
    },
    /**
     * Get a single node's data including config
     */
    getNode: (nodeId: string): EditorNode | null => {
      const node = editor.getNode(nodeId);
      if (!node) return null;

      const nodeType = (node as unknown as { nodeType?: WorkflowNodeType }).nodeType || 'custom-ai';
      const nodeConfig = (node as unknown as { config?: Record<string, unknown> }).config || {};
      const nodeView = area.nodeViews.get(node.id);
      const position = nodeView ? { x: nodeView.position.x, y: nodeView.position.y } : { x: 0, y: 0 };

      return {
        id: node.id,
        type: nodeType,
        label: node.label,
        position,
        inputs: Object.entries(node.inputs).map(([key, input]) => ({
          key,
          label: input?.label || key,
        })),
        outputs: Object.entries(node.outputs).map(([key, output]) => ({
          key,
          label: output?.label || key,
        })),
        config: nodeConfig,
      };
    },
    /**
     * Update a node's label and/or config
     */
    updateNode: async (nodeId: string, updates: { label?: string; config?: Record<string, unknown> }) => {
      const node = editor.getNode(nodeId);
      if (!node) return false;

      if (updates.label !== undefined) {
        node.label = updates.label;
      }

      if (updates.config !== undefined) {
        (node as unknown as { config: Record<string, unknown> }).config = updates.config;
      }

      // Trigger re-render by updating the area
      await area.update('node', nodeId);

      return true;
    },
    /**
     * Load editor data from serialized format
     */
    loadEditorData: async (data: EditorData) => {
      // Clear existing nodes
      const existingNodes = editor.getNodes();
      for (const node of existingNodes) {
        await editor.removeNode(node.id);
      }

      // Create nodes
      const nodeIdMap = new Map<string, string>(); // Map old IDs to new IDs if needed
      for (const nodeData of data.nodes) {
        const node = new ClassicPreset.Node(nodeData.label);
        // Force the node ID to match the original
        (node as unknown as { id: string }).id = nodeData.id;
        (node as unknown as { nodeType: WorkflowNodeType }).nodeType = nodeData.type as WorkflowNodeType;
        (node as unknown as { config: Record<string, unknown> }).config = nodeData.config;

        // Add inputs
        for (const input of nodeData.inputs) {
          node.addInput(input.key, new ClassicPreset.Input(socket, input.label));
        }

        // Add outputs
        for (const output of nodeData.outputs) {
          node.addOutput(output.key, new ClassicPreset.Output(socket, output.label));
        }

        await editor.addNode(node);
        await area.translate(node.id, nodeData.position);
        nodeIdMap.set(nodeData.id, node.id);
      }

      // Create connections
      for (const connData of data.connections) {
        const sourceId = nodeIdMap.get(connData.source) || connData.source;
        const targetId = nodeIdMap.get(connData.target) || connData.target;

        const sourceNode = editor.getNode(sourceId);
        const targetNode = editor.getNode(targetId);

        if (sourceNode && targetNode) {
          const sourceOutput = sourceNode.outputs.get(connData.sourceOutput);
          const targetInput = targetNode.inputs.get(connData.targetInput);

          if (sourceOutput && targetInput) {
            const connection = new ClassicPreset.Connection(sourceNode, connData.sourceOutput, targetNode, connData.targetInput);
            await editor.addConnection(connection);
          }
        }
      }

      // Zoom to fit
      AreaExtensions.zoomAt(area, editor.getNodes());
    },
  };
}

// ============================================================================
// Main Editor Component
// ============================================================================

export interface ReteWorkflowEditorProps {
  className?: string;
  onNodeSelect?: (nodeId: string | null) => void;
  onEditorReady?: (editor: ReturnType<typeof createEditor> extends Promise<infer T> ? T : never) => void;
}

/**
 * ReteWorkflowEditor - Main workflow editor component
 */
export const ReteWorkflowEditor: React.FC<ReteWorkflowEditorProps> = ({
  className = '',
  onNodeSelect,
  onEditorReady,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const editorRef = useRef<Awaited<ReturnType<typeof createEditor>> | null>(null);

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;

    const initEditor = async () => {
      try {
        const editorInstance = await createEditor(containerRef.current!);

        if (mounted) {
          editorRef.current = editorInstance;
          setIsReady(true);
          onEditorReady?.(editorInstance);
        } else {
          editorInstance.destroy();
        }
      } catch (error) {
        console.error('[ReteWorkflowEditor] Failed to initialize:', error);
      }
    };

    initEditor();

    return () => {
      mounted = false;
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, [onEditorReady]);

  return (
    <div
      ref={containerRef}
      className={`rete-editor-container ${className}`}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#1a1a1a',
        overflow: 'hidden',
      }}
    >
      {!isReady && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#666',
          }}
        >
          Loading editor...
        </div>
      )}
    </div>
  );
};

export default ReteWorkflowEditor;
