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
import { ScopesPlugin, Presets as ScopesPresets } from 'rete-scopes-plugin';
import {
  ContextMenuPlugin,
  ContextMenuExtra,
  Presets as ContextMenuPresets,
} from 'rete-context-menu-plugin';
// Note: rete-auto-arrange-plugin removed due to elkjs/web-worker compatibility issues with Electron
// Auto-arrange can be implemented manually if needed
import { createRoot } from 'react-dom/client';
import { css } from 'styled-components';
import type { Schemes, WorkflowNodeType } from './types';
import type { ReactArea2D } from 'rete-react-plugin';
import { WorkflowNode, NODE_COLORS } from './types';
import type { EditorData, EditorNode, EditorConnection } from './WorkflowSerializer';

// Update AreaExtra type to include ContextMenuExtra
type AreaExtra = ReactArea2D<Schemes> | ContextMenuExtra;

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

/**
 * Custom Checkbox Control for boolean values
 */
class CheckboxControl extends ClassicPreset.Control {
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

/**
 * Custom Label Control for displaying labels/headers
 */
class LabelControl extends ClassicPreset.Control {
  constructor(public text: string) {
    super();
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

/**
 * React component for CheckboxControl
 */
function CheckboxControlComponent({ data }: { data: CheckboxControl }) {
  const [checked, setChecked] = useState(data.value);

  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        color: '#ccc',
        fontSize: '11px',
        cursor: 'pointer',
        padding: '2px 0',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          setChecked(e.target.checked);
          data.setValue(e.target.checked);
        }}
        style={{
          width: '14px',
          height: '14px',
          cursor: 'pointer',
        }}
      />
      {data.label}
    </label>
  );
}

/**
 * React component for LabelControl (section header)
 */
function LabelControlComponent({ data }: { data: LabelControl }) {
  return (
    <div
      style={{
        color: '#888',
        fontSize: '10px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        paddingBottom: '4px',
        marginTop: '4px',
      }}
    >
      {data.text}
    </div>
  );
}

/**
 * Custom Number Input Control with label
 */
class NumberControl extends ClassicPreset.Control {
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

/**
 * React component for NumberControl
 */
function NumberControlComponent({ data }: { data: NumberControl }) {
  const [value, setValue] = useState(data.value);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ color: '#aaa', fontSize: '11px', minWidth: '80px' }}>{data.label}</span>
      <input
        type="number"
        value={value}
        min={data.min}
        max={data.max}
        onChange={(e) => {
          const num = parseInt(e.target.value, 10);
          if (!isNaN(num)) {
            setValue(num);
            data.setValue(num);
          }
        }}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          width: '60px',
          padding: '4px 6px',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '3px',
          color: '#fff',
          fontSize: '11px',
        }}
      />
    </div>
  );
}

/**
 * Custom Text Input Control with label
 */
class TextControl extends ClassicPreset.Control {
  constructor(
    public label: string,
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

/**
 * React component for TextControl
 */
function TextControlComponent({ data }: { data: TextControl }) {
  const [value, setValue] = useState(data.value);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ color: '#aaa', fontSize: '11px', minWidth: '80px' }}>{data.label}</span>
      <input
        type="text"
        value={value}
        placeholder={data.placeholder}
        onChange={(e) => {
          setValue(e.target.value);
          data.setValue(e.target.value);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          flex: 1,
          padding: '4px 6px',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '3px',
          color: '#fff',
          fontSize: '11px',
        }}
      />
    </div>
  );
}

// ============================================================================
// Styled Components for Custom Node (extending classic preset)
// ============================================================================

// Custom styles for regular nodes - dark theme with blue accent
const customNodeStyles = css<{ selected?: boolean }>`
  background: #2d2d2d;
  border: 2px solid #4e58bf;
  border-radius: 8px;
  width: fit-content !important;
  min-width: 180px;

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
    font-weight: 600;
    padding: 10px 14px;
    background: #4e58bf;
    border-radius: 6px 6px 0 0;
  }

  .input-title,
  .output-title {
    color: #9ca3af;
    font-size: 12px;
  }

  .control {
    padding: 8px 12px;
  }
`;

// Custom styles for Parallel Group container nodes
const parallelGroupStyles = css<{ selected?: boolean }>`
  background: rgba(30, 30, 40, 0.95);
  border: 3px solid #fbbf24;
  border-radius: 12px;
  min-width: 400px;
  min-height: 300px;

  ${(props) =>
    props.selected &&
    css`
      border-color: #f59e0b;
      box-shadow: 0 0 20px rgba(251, 191, 36, 0.7);
    `}

  .title {
    color: white;
    font-family: sans-serif;
    font-size: 16px;
    font-weight: bold;
    padding: 12px 16px;
    background: linear-gradient(135deg, #7c3aed 0%, #4e58bf 100%);
    border-radius: 9px 9px 0 0;
  }

  /* Controls in header area */
  .control {
    padding: 8px 16px;
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
`;

// Styled Node component factory - applies custom styles
function StyledNode(props: { data: Schemes['Node']; emit: (data: unknown) => void }) {
  const node = props.data as WorkflowNode;

  // Use special styles for Parallel Group
  if (node.nodeType === 'parallel-group') {
    return <ReactPresets.classic.Node styles={() => parallelGroupStyles} {...props} />;
  }

  // Use custom dark theme styles for regular nodes
  return <ReactPresets.classic.Node styles={() => customNodeStyles} {...props} />;
}

// ============================================================================
// Helper Functions for Parallel Group
// ============================================================================

/**
 * Node types that cannot be children of a Parallel Group
 */
const FORBIDDEN_CHILD_TYPES: WorkflowNodeType[] = ['start', 'end', 'parallel-group'];

/**
 * Check if a node type can be a child of Parallel Group
 */
function isAllowedChildType(type: WorkflowNodeType): boolean {
  return !FORBIDDEN_CHILD_TYPES.includes(type);
}

/**
 * Check if a position is inside a node's bounds
 */
function isPositionInsideNode(
  position: { x: number; y: number },
  nodePosition: { x: number; y: number },
  nodeWidth: number,
  nodeHeight: number
): boolean {
  return (
    position.x >= nodePosition.x &&
    position.x <= nodePosition.x + nodeWidth &&
    position.y >= nodePosition.y &&
    position.y <= nodePosition.y + nodeHeight
  );
}

/**
 * Default node dimensions for hit testing
 */
const DEFAULT_NODE_WIDTH = 200;
const DEFAULT_NODE_HEIGHT = 150;
const PARALLEL_GROUP_NODE_WIDTH = 400;
const PARALLEL_GROUP_NODE_HEIGHT = 350;

/**
 * Get node dimensions based on node type
 */
function getNodeDimensions(nodeType: WorkflowNodeType): { width: number; height: number } {
  if (nodeType === 'parallel-group') {
    return { width: PARALLEL_GROUP_NODE_WIDTH, height: PARALLEL_GROUP_NODE_HEIGHT };
  }
  return { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };
}

/**
 * Node types that can be added to a Parallel Group via context menu
 */
const CONTEXT_MENU_CHILD_TYPES: { type: WorkflowNodeType; label: string }[] = [
  { type: 'engineer', label: 'Engineer' },
  { type: 'reviewer', label: 'Reviewer' },
  { type: 'product-owner', label: 'Product Owner' },
  { type: 'custom-ai', label: 'Custom AI' },
  { type: 'decision', label: 'Decision' },
  { type: 'transform', label: 'Transform' },
  { type: 'merge', label: 'Merge' },
];

/**
 * Default system prompts for each AI role
 */
const DEFAULT_SYSTEM_PROMPTS: Record<string, string> = {
  engineer: `You are a senior software engineer. Your responsibilities include:
- Writing clean, maintainable, and well-tested code
- Following best practices and design patterns
- Implementing features according to specifications
- Debugging and fixing issues
- Writing unit tests for your code

Always explain your implementation decisions and provide clear documentation.`,

  reviewer: `You are a senior code reviewer. Your responsibilities include:
- Reviewing code for correctness, security, and performance
- Identifying potential bugs and vulnerabilities
- Suggesting improvements and optimizations
- Ensuring code follows project conventions and best practices
- Checking test coverage and edge cases

Provide constructive feedback with specific suggestions for improvement.`,

  'product-owner': `You are a product owner. Your responsibilities include:
- Breaking down user stories into technical tasks
- Defining acceptance criteria
- Prioritizing features and tasks
- Ensuring requirements are clear and complete
- Coordinating between stakeholders and development team

Focus on delivering value to users while considering technical constraints.`,

  'custom-ai': '',  // Custom AI has no default prompt
};

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

  // Create scopes plugin for nested nodes (Parallel Groups)
  // Configure padding so child nodes stay inside parent bounds
  const scopes = new ScopesPlugin<Schemes>({
    // Padding inside parent node for child nodes
    padding: (nodeId) => {
      const node = editor.getNode(nodeId);
      if (node?.nodeType === 'parallel-group') {
        return {
          top: 100,   // Space for title + Concurrency control
          left: 30,
          right: 30,
          bottom: 30,
        };
      }
      return {
        top: 60,
        left: 20,
        right: 20,
        bottom: 20,
      };
    },
    // Minimum size for parent nodes
    size: (id, size) => {
      const node = editor.getNode(id);
      if (node?.nodeType === 'parallel-group') {
        // Ensure minimum size for parallel groups
        return {
          width: Math.max(size.width, PARALLEL_GROUP_NODE_WIDTH),
          height: Math.max(size.height, PARALLEL_GROUP_NODE_HEIGHT),
        };
      }
      return size;
    },
  });

  // Setup connection presets
  connection.addPreset(ConnectionPresets.classic.setup());

  // Setup scopes presets
  scopes.addPreset(ScopesPresets.classic.setup());

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
          // Handle custom CheckboxControl
          if (context.payload instanceof CheckboxControl) {
            return CheckboxControlComponent;
          }
          // Handle custom LabelControl
          if (context.payload instanceof LabelControl) {
            return LabelControlComponent;
          }
          // Handle custom NumberControl
          if (context.payload instanceof NumberControl) {
            return NumberControlComponent;
          }
          // Handle custom TextControl
          if (context.payload instanceof TextControl) {
            return TextControlComponent;
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
  // Also add context menu preset for rendering
  render.addPreset(ReactPresets.contextMenu.setup());

  // Create context menu plugin for right-click node creation
  const contextMenu = new ContextMenuPlugin<Schemes>({
    items: ContextMenuPresets.classic.setup([
      ['AI Nodes', [
        ['Engineer', () => {
          const node = new WorkflowNode('Engineer');
          node.nodeType = 'engineer';
          const defaultPrompt = DEFAULT_SYSTEM_PROMPTS['engineer'];
          const config = { ai: { provider: 'claude', maxTurns: 30, systemPrompt: defaultPrompt } };
          node.config = config;
          node.addInput('input', new ClassicPreset.Input(socket, 'Input'));
          node.addOutput('output', new ClassicPreset.Output(socket, 'Output'));
          node.addControl('provider', new SelectControl('claude', [
            { value: 'claude', label: 'Claude' },
            { value: 'openai', label: 'OpenAI' },
            { value: 'gemini', label: 'Gemini' },
          ], (value) => { config.ai.provider = value; }));
          node.addControl('systemPrompt', new TextAreaControl(defaultPrompt, 'Enter system prompt...', (value) => {
            config.ai.systemPrompt = value;
          }));
          node.updateSize();
          return node;
        }],
        ['Reviewer', () => {
          const node = new WorkflowNode('Reviewer');
          node.nodeType = 'reviewer';
          const defaultPrompt = DEFAULT_SYSTEM_PROMPTS['reviewer'];
          const config = { ai: { provider: 'claude', maxTurns: 30, systemPrompt: defaultPrompt } };
          node.config = config;
          node.addInput('input', new ClassicPreset.Input(socket, 'Input'));
          node.addOutput('output', new ClassicPreset.Output(socket, 'Output'));
          node.addControl('provider', new SelectControl('claude', [
            { value: 'claude', label: 'Claude' },
            { value: 'openai', label: 'OpenAI' },
            { value: 'gemini', label: 'Gemini' },
          ], (value) => { config.ai.provider = value; }));
          node.addControl('systemPrompt', new TextAreaControl(defaultPrompt, 'Enter review criteria...', (value) => {
            config.ai.systemPrompt = value;
          }));
          node.updateSize();
          return node;
        }],
        ['Product Owner', () => {
          const node = new WorkflowNode('Product Owner');
          node.nodeType = 'product-owner';
          const defaultPrompt = DEFAULT_SYSTEM_PROMPTS['product-owner'];
          const config = { ai: { provider: 'claude', maxTurns: 30, systemPrompt: defaultPrompt } };
          node.config = config;
          node.addInput('input', new ClassicPreset.Input(socket, 'Input'));
          node.addOutput('output', new ClassicPreset.Output(socket, 'Output'));
          node.addControl('provider', new SelectControl('claude', [
            { value: 'claude', label: 'Claude' },
            { value: 'openai', label: 'OpenAI' },
            { value: 'gemini', label: 'Gemini' },
          ], (value) => { config.ai.provider = value; }));
          node.addControl('systemPrompt', new TextAreaControl(defaultPrompt, 'Enter requirements...', (value) => {
            config.ai.systemPrompt = value;
          }));
          node.updateSize();
          return node;
        }],
        ['Custom AI', () => {
          const node = new WorkflowNode('Custom AI');
          node.nodeType = 'custom-ai';
          const defaultPrompt = DEFAULT_SYSTEM_PROMPTS['custom-ai'];
          const config = { ai: { provider: 'claude', maxTurns: 30, systemPrompt: defaultPrompt } };
          node.config = config;
          node.addInput('input', new ClassicPreset.Input(socket, 'Input'));
          node.addOutput('output', new ClassicPreset.Output(socket, 'Output'));
          node.addControl('provider', new SelectControl('claude', [
            { value: 'claude', label: 'Claude' },
            { value: 'openai', label: 'OpenAI' },
            { value: 'gemini', label: 'Gemini' },
          ], (value) => { config.ai.provider = value; }));
          node.addControl('systemPrompt', new TextAreaControl(defaultPrompt, 'Enter custom prompt...', (value) => {
            config.ai.systemPrompt = value;
          }));
          node.updateSize();
          return node;
        }],
      ]],
      ['Control Flow', [
        ['Decision', () => {
          const node = new WorkflowNode('Decision');
          node.nodeType = 'decision';
          node.config = { condition: '' };
          node.addInput('input', new ClassicPreset.Input(socket, 'Input'));
          node.addOutput('true', new ClassicPreset.Output(socket, 'True'));
          node.addOutput('false', new ClassicPreset.Output(socket, 'False'));
          node.updateSize();
          return node;
        }],
        ['Parallel Group', () => {
          const node = new WorkflowNode('Parallel Group');
          node.nodeType = 'parallel-group';
          node.config = {
            parallelGroup: {
              maxConcurrency: 4,
              useWorktree: false,
              branchPrefix: 'parallel',
              cleanupAfter: true,
              failureStrategy: 'continue',
              aggregationStrategy: 'merge',
              conflictResolution: { strategy: 'ai', autoMergeAfterTask: true },
            },
          };
          // No sockets - Parallel Group is a container for child nodes
          // Add concurrency control
          node.addControl(
            'maxConcurrency',
            new NumberControl('Concurrency', 4, 1, 10, (value) => {
              if (node.config?.parallelGroup) {
                (node.config.parallelGroup as Record<string, unknown>).maxConcurrency = value;
              }
            })
          );
          node.updateSize();
          return node;
        }],
      ]],
      ['Data', [
        ['Transform', () => {
          const node = new WorkflowNode('Transform');
          node.nodeType = 'transform';
          node.config = { transformType: 'custom', transformFunction: '' };
          node.addInput('input', new ClassicPreset.Input(socket, 'Input'));
          node.addOutput('output', new ClassicPreset.Output(socket, 'Output'));
          node.updateSize();
          return node;
        }],
        ['Merge', () => {
          const node = new WorkflowNode('Merge');
          node.nodeType = 'merge';
          node.config = { merge: { strategy: 'merge', conflictResolution: 'ai', targetBranch: 'main' } };
          node.addInput('input', new ClassicPreset.Input(socket, 'Input'));
          node.addOutput('output', new ClassicPreset.Output(socket, 'Output'));
          node.updateSize();
          return node;
        }],
      ]],
    ]),
  });

  // Register plugins
  editor.use(area);
  area.use(connection);
  area.use(scopes);
  area.use(render);
  area.use(contextMenu);

  // Enable zoom and drag
  AreaExtensions.selectableNodes(area, AreaExtensions.selector(), {
    accumulating: AreaExtensions.accumulateOnCtrl(),
  });
  // Note: Do NOT use AreaExtensions.simpleNodesOrder(area) with scopes plugin
  // The scopes plugin manages its own node ordering for proper parent/child layering

  // Create initial Start node (no controls - input comes from chat panel)
  const startNode = new WorkflowNode('Start');
  startNode.nodeType = 'start';
  startNode.config = {};
  startNode.addOutput('output', new ClassicPreset.Output(socket, 'Output'));
  startNode.updateSize();
  await editor.addNode(startNode);

  // Create initial End node with controls
  const endNode = new WorkflowNode('End');
  endNode.nodeType = 'end';
  const endConfig = {
    end: {
      outputFormat: 'summary',
      includeMetrics: true,
      notifyOnComplete: false,
      saveResults: true,
    }
  };
  endNode.config = endConfig;

  // Add End node controls
  endNode.addControl('endLabel', new LabelControl('Workflow End'));
  endNode.addControl(
    'outputFormat',
    new SelectControl('summary', [
      { value: 'summary', label: 'Summary' },
      { value: 'detailed', label: 'Detailed Report' },
      { value: 'json', label: 'JSON Output' },
      { value: 'minimal', label: 'Minimal' },
    ], (value) => {
      (endConfig.end as Record<string, unknown>).outputFormat = value;
    })
  );
  endNode.addControl(
    'includeMetrics',
    new CheckboxControl('Include Metrics', true, (value) => {
      (endConfig.end as Record<string, unknown>).includeMetrics = value;
    })
  );
  endNode.addControl(
    'notifyOnComplete',
    new CheckboxControl('Notify on Complete', false, (value) => {
      (endConfig.end as Record<string, unknown>).notifyOnComplete = value;
    })
  );
  endNode.addControl(
    'saveResults',
    new CheckboxControl('Save Results', true, (value) => {
      (endConfig.end as Record<string, unknown>).saveResults = value;
    })
  );
  endNode.addInput('input', new ClassicPreset.Input(socket, 'Input'));
  endNode.updateSize();
  await editor.addNode(endNode);

  // Position nodes
  await area.translate(startNode.id, { x: 100, y: 200 });
  await area.translate(endNode.id, { x: 500, y: 200 });

  // Zoom to fit
  AreaExtensions.zoomAt(area, editor.getNodes());

  // ============================================================================
  // Helper: Find Parallel Group at position for drag & drop
  // ============================================================================
  const findParallelGroupAtPosition = (
    position: { x: number; y: number }
  ): WorkflowNode | undefined => {
    const nodes = editor.getNodes();
    for (const node of nodes) {
      if (node.nodeType !== 'parallel-group') continue;

      const nodeView = area.nodeViews.get(node.id);
      if (!nodeView) continue;

      const nodePosition = { x: nodeView.position.x, y: nodeView.position.y };
      const dimensions = getNodeDimensions(node.nodeType);

      if (isPositionInsideNode(position, nodePosition, dimensions.width, dimensions.height)) {
        return node;
      }
    }
    return undefined;
  };

  // ============================================================================
  // Helper: Calculate relative position inside parent
  // ============================================================================
  const calculateRelativePosition = (
    absolutePosition: { x: number; y: number },
    parentId: string
  ): { x: number; y: number } => {
    const parentView = area.nodeViews.get(parentId);
    if (!parentView) return absolutePosition;

    return {
      x: absolutePosition.x - parentView.position.x,
      y: absolutePosition.y - parentView.position.y,
    };
  };

  return {
    editor,
    area,
    scopes,
    destroy: () => area.destroy(),
    /**
     * Auto-arrange all nodes (simple horizontal layout)
     * Note: elkjs-based auto-arrange removed due to Electron compatibility issues
     */
    autoArrange: async () => {
      const nodes = editor.getNodes();
      const spacing = 250;
      let x = 100;
      let y = 200;

      // Simple left-to-right layout for top-level nodes
      const topLevelNodes = nodes.filter((n) => !n.parent);
      for (const node of topLevelNodes) {
        await area.translate(node.id, { x, y });
        x += spacing;
      }

      // Position child nodes inside their parents
      for (const node of nodes) {
        if (node.parent) {
          const parentView = area.nodeViews.get(node.parent);
          if (parentView) {
            // Position relative to parent with offset
            const childNodes = nodes.filter((n) => n.parent === node.parent);
            const index = childNodes.indexOf(node);
            await area.translate(node.id, {
              x: parentView.position.x + 50 + (index * 180),
              y: parentView.position.y + 120,
            });
          }
        }
      }

      AreaExtensions.zoomAt(area, editor.getNodes());
    },
    // Expose methods for external control
    addNode: async (type: WorkflowNodeType, position: { x: number; y: number }, parentId?: string) => {
      // Generate display label
      const label = type.charAt(0).toUpperCase() + type.slice(1).replace(/-/g, ' ');
      const node = new WorkflowNode(label);
      node.nodeType = type;

      // Auto-detect parent if not provided and node type is allowed as child
      let detectedParentId = parentId;
      if (!detectedParentId && isAllowedChildType(type)) {
        const parentGroup = findParallelGroupAtPosition(position);
        if (parentGroup) {
          detectedParentId = parentGroup.id;
        }
      }

      // Set parent if detected or provided
      if (detectedParentId) {
        node.parent = detectedParentId;
      }

      // Initialize config based on node type
      const isAINode = ['engineer', 'reviewer', 'product-owner', 'custom-ai'].includes(type);
      const isDecisionNode = type === 'decision';
      const isTransformNode = type === 'transform';
      const isParallelGroupNode = type === 'parallel-group';

      const nodeConfig: Record<string, unknown> = {};

      // ============================================================================
      // Parallel Group Node - Container for parallel execution
      // ============================================================================
      if (isParallelGroupNode) {
        // Size will be calculated by updateSize() based on content
        // Minimum size is enforced in updateSize() for parallel-group

        nodeConfig.parallelGroup = {
          maxConcurrency: 4,
          useWorktree: false,
          branchPrefix: 'parallel',
          cleanupAfter: true,
          failureStrategy: 'continue',
          aggregationStrategy: 'merge',
          inputMapping: 'task',
          conflictResolution: {
            strategy: 'ai',
            autoMergeAfterTask: true,
          },
        };

        // Parallel Group is a container - no sockets needed
        // Child nodes inside handle their own connections
        // External connections go to/from the first/last child nodes

        // Minimal controls - just concurrency (other settings via property panel)
        node.addControl(
          'maxConcurrency',
          new NumberControl('Concurrency', 4, 1, 10, (value) => {
            if (node.config?.parallelGroup) {
              (node.config.parallelGroup as Record<string, unknown>).maxConcurrency = value;
            }
          })
        );
      }

      // Add controls based on node type
      if (isAINode) {
        // Get default system prompt for this AI role
        const defaultPrompt = DEFAULT_SYSTEM_PROMPTS[type] || '';

        nodeConfig.ai = {
          provider: 'claude',
          maxTurns: 30,
          systemPrompt: defaultPrompt,
        };

        // Minimal controls - just provider (other settings via property panel)
        node.addControl(
          'provider',
          new SelectControl('claude', [
            { value: 'claude', label: 'Claude' },
            { value: 'openai', label: 'OpenAI' },
            { value: 'gemini', label: 'Gemini' },
          ], (value) => {
            if (node.config?.ai) {
              (node.config.ai as Record<string, unknown>).provider = value;
            }
          })
        );
        // Add system prompt textarea with default value
        node.addControl(
          'systemPrompt',
          new TextAreaControl(defaultPrompt, 'Enter system prompt...', (value) => {
            if (node.config?.ai) {
              (node.config.ai as Record<string, unknown>).systemPrompt = value;
            }
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

      // ============================================================================
      // Merge Node Controls
      // ============================================================================
      if (type === 'merge') {
        nodeConfig.merge = {
          strategy: 'merge',
          conflictResolution: 'ai',
          sourceBranch: '',
          targetBranch: 'main',
          autoCommit: true,
          squash: false,
        };

        // Section header
        node.addControl('mergeLabel', new LabelControl('Git Merge Settings'));

        // Merge strategy
        node.addControl(
          'mergeStrategy',
          new SelectControl('merge', [
            { value: 'merge', label: 'Merge' },
            { value: 'rebase', label: 'Rebase' },
            { value: 'squash', label: 'Squash' },
          ], (value) => {
            const config = (node as unknown as { config: Record<string, unknown> }).config;
            (config.merge as Record<string, unknown>).strategy = value;
          })
        );

        // Conflict resolution
        node.addControl(
          'conflictResolution',
          new SelectControl('ai', [
            { value: 'ai', label: 'AI Auto-resolve' },
            { value: 'ours', label: 'Keep Ours' },
            { value: 'theirs', label: 'Keep Theirs' },
            { value: 'manual', label: 'Manual (pause)' },
          ], (value) => {
            const config = (node as unknown as { config: Record<string, unknown> }).config;
            (config.merge as Record<string, unknown>).conflictResolution = value;
          })
        );

        // Source branch
        node.addControl(
          'sourceBranch',
          new TextControl('Source Branch', '', 'e.g., feature/auth', (value) => {
            const config = (node as unknown as { config: Record<string, unknown> }).config;
            (config.merge as Record<string, unknown>).sourceBranch = value;
          })
        );

        // Target branch
        node.addControl(
          'targetBranch',
          new TextControl('Target Branch', 'main', 'e.g., main, develop', (value) => {
            const config = (node as unknown as { config: Record<string, unknown> }).config;
            (config.merge as Record<string, unknown>).targetBranch = value;
          })
        );

        // Auto commit
        node.addControl(
          'autoCommit',
          new CheckboxControl('Auto Commit', true, (value) => {
            const config = (node as unknown as { config: Record<string, unknown> }).config;
            (config.merge as Record<string, unknown>).autoCommit = value;
          })
        );

        // Squash commits
        node.addControl(
          'squash',
          new CheckboxControl('Squash Commits', false, (value) => {
            const config = (node as unknown as { config: Record<string, unknown> }).config;
            (config.merge as Record<string, unknown>).squash = value;
          })
        );
      }

      // Start node has no controls - input comes from chat panel

      // ============================================================================
      // End Node Controls
      // ============================================================================
      if (type === 'end') {
        nodeConfig.end = {
          outputFormat: 'summary',
          includeMetrics: true,
          notifyOnComplete: false,
          saveResults: true,
        };

        // Section header
        node.addControl('endLabel', new LabelControl('Workflow End'));

        // Output format
        node.addControl(
          'outputFormat',
          new SelectControl('summary', [
            { value: 'summary', label: 'Summary' },
            { value: 'detailed', label: 'Detailed Report' },
            { value: 'json', label: 'JSON Output' },
            { value: 'minimal', label: 'Minimal' },
          ], (value) => {
            const config = (node as unknown as { config: Record<string, unknown> }).config;
            (config.end as Record<string, unknown>).outputFormat = value;
          })
        );

        // Include metrics
        node.addControl(
          'includeMetrics',
          new CheckboxControl('Include Metrics', true, (value) => {
            const config = (node as unknown as { config: Record<string, unknown> }).config;
            (config.end as Record<string, unknown>).includeMetrics = value;
          })
        );

        // Notify on complete
        node.addControl(
          'notifyOnComplete',
          new CheckboxControl('Notify on Complete', false, (value) => {
            const config = (node as unknown as { config: Record<string, unknown> }).config;
            (config.end as Record<string, unknown>).notifyOnComplete = value;
          })
        );

        // Save results
        node.addControl(
          'saveResults',
          new CheckboxControl('Save Results', true, (value) => {
            const config = (node as unknown as { config: Record<string, unknown> }).config;
            (config.end as Record<string, unknown>).saveResults = value;
          })
        );
      }

      node.config = nodeConfig;

      // Add default input/output based on type
      // Parallel Group nodes don't have input/output sockets - they contain child nodes
      if (type !== 'start' && type !== 'parallel-group') {
        node.addInput('input', new ClassicPreset.Input(socket, 'Input'));
      }
      if (type !== 'end' && type !== 'parallel-group') {
        node.addOutput('output', new ClassicPreset.Output(socket, 'Output'));
      }

      // Decision node: add true/false outputs
      if (type === 'decision') {
        node.addOutput('true', new ClassicPreset.Output(socket, 'True'));
        node.addOutput('false', new ClassicPreset.Output(socket, 'False'));
        // Remove default output since we have true/false
        if (node.outputs.get('output')) {
          node.removeOutput('output');
        }
      }

      // Calculate dynamic size based on content
      node.updateSize();

      await editor.addNode(node);
      await area.translate(node.id, position);

      // Update scopes if node was added to a parent
      if (detectedParentId) {
        await scopes.update(detectedParentId);
      }

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
        const nodeView = area.nodeViews.get(node.id);
        const position = nodeView ? { x: nodeView.position.x, y: nodeView.position.y } : { x: 0, y: 0 };

        return {
          id: node.id,
          type: node.nodeType || 'custom-ai',
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
          config: node.config || {},
          parent: node.parent,
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

      const nodeView = area.nodeViews.get(node.id);
      const position = nodeView ? { x: nodeView.position.x, y: nodeView.position.y } : { x: 0, y: 0 };

      return {
        id: node.id,
        type: node.nodeType || 'custom-ai',
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
        config: node.config || {},
        parent: node.parent,
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
        node.config = updates.config;
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
        const node = new WorkflowNode(nodeData.label);
        // Force the node ID to match the original
        (node as { id: string }).id = nodeData.id;
        node.nodeType = nodeData.type as WorkflowNodeType;
        node.config = nodeData.config;
        node.parent = (nodeData as { parent?: string }).parent;

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
    /**
     * Get available child node types for a Parallel Group
     */
    getAvailableChildTypes: (): { type: WorkflowNodeType; label: string }[] => {
      return CONTEXT_MENU_CHILD_TYPES;
    },
    /**
     * Check if a node is a Parallel Group
     */
    isParallelGroup: (nodeId: string): boolean => {
      const node = editor.getNode(nodeId);
      return node?.nodeType === 'parallel-group';
    },
    /**
     * Add a child node to a Parallel Group
     */
    addChildToParallelGroup: async (
      parentId: string,
      childType: WorkflowNodeType,
      relativePosition?: { x: number; y: number }
    ): Promise<string | null> => {
      const parentNode = editor.getNode(parentId);
      if (!parentNode || parentNode.nodeType !== 'parallel-group') {
        console.error('[ReteWorkflowEditor] Parent is not a Parallel Group:', parentId);
        return null;
      }

      if (!isAllowedChildType(childType)) {
        console.error('[ReteWorkflowEditor] Child type not allowed:', childType);
        return null;
      }

      // Get parent position
      const parentView = area.nodeViews.get(parentId);
      if (!parentView) {
        console.error('[ReteWorkflowEditor] Parent view not found:', parentId);
        return null;
      }

      // Calculate absolute position for the child node
      // Default to center of the parent if no relative position provided
      const defaultRelativePos = relativePosition || { x: 100, y: 100 };
      const absolutePosition = {
        x: parentView.position.x + defaultRelativePos.x,
        y: parentView.position.y + defaultRelativePos.y,
      };

      // Create the child node with parent set
      const label = childType.charAt(0).toUpperCase() + childType.slice(1).replace(/-/g, ' ');
      const childNode = new WorkflowNode(label);
      childNode.nodeType = childType;
      childNode.parent = parentId;

      // Initialize config based on node type (simplified version)
      const nodeConfig: Record<string, unknown> = {};
      const isAINode = ['engineer', 'reviewer', 'product-owner', 'custom-ai'].includes(childType);

      if (isAINode) {
        // Get default system prompt for this AI role
        const defaultPrompt = DEFAULT_SYSTEM_PROMPTS[childType] || '';

        nodeConfig.ai = {
          provider: 'claude',
          maxTurns: 30,
          systemPrompt: defaultPrompt,
        };

        childNode.addControl(
          'provider',
          new SelectControl('claude', [
            { value: 'claude', label: 'Claude' },
            { value: 'openai', label: 'OpenAI' },
            { value: 'gemini', label: 'Gemini' },
          ], (value) => {
            if (childNode.config?.ai) {
              (childNode.config.ai as Record<string, unknown>).provider = value;
            }
          })
        );

        childNode.addControl(
          'maxTurns',
          new ClassicPreset.InputControl('number', {
            initial: 30,
            change: (value) => {
              if (childNode.config?.ai) {
                (childNode.config.ai as Record<string, unknown>).maxTurns = value;
              }
            },
          })
        );

        childNode.addControl(
          'systemPrompt',
          new TextAreaControl(defaultPrompt, 'Enter system prompt...', (value) => {
            if (childNode.config?.ai) {
              (childNode.config.ai as Record<string, unknown>).systemPrompt = value;
            }
          })
        );
      }

      childNode.config = nodeConfig;

      // Add default input/output sockets
      childNode.addInput('input', new ClassicPreset.Input(socket, 'Input'));
      childNode.addOutput('output', new ClassicPreset.Output(socket, 'Output'));

      // Add decision node special outputs
      if (childType === 'decision') {
        childNode.addOutput('true', new ClassicPreset.Output(socket, 'True'));
        childNode.addOutput('false', new ClassicPreset.Output(socket, 'False'));
        childNode.removeOutput('output');
      }

      // Calculate dynamic size
      childNode.updateSize();

      await editor.addNode(childNode);
      await area.translate(childNode.id, absolutePosition);

      // Update scopes plugin to recalculate parent bounds
      await scopes.update(parentId);

      return childNode.id;
    },
    /**
     * Get all child nodes of a Parallel Group
     */
    getChildNodes: (parentId: string): EditorNode[] => {
      const nodes = editor.getNodes();
      const children: EditorNode[] = [];

      for (const node of nodes) {
        if (node.parent === parentId) {
          const nodeView = area.nodeViews.get(node.id);
          const position = nodeView ? { x: nodeView.position.x, y: nodeView.position.y } : { x: 0, y: 0 };

          children.push({
            id: node.id,
            type: node.nodeType || 'custom-ai',
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
            config: node.config || {},
            parent: node.parent,
          });
        }
      }

      return children;
    },
    /**
     * Remove a child node from its parent (set parent to undefined)
     */
    removeChildFromParent: async (nodeId: string): Promise<boolean> => {
      const node = editor.getNode(nodeId);
      if (!node) return false;

      const oldParentId = node.parent;
      node.parent = undefined;
      await area.update('node', nodeId);

      // Update scopes if there was a parent
      if (oldParentId) {
        await scopes.update(oldParentId);
      }
      return true;
    },
    /**
     * Move a node to a Parallel Group
     */
    moveNodeToParallelGroup: async (nodeId: string, newParentId: string): Promise<boolean> => {
      const node = editor.getNode(nodeId);
      const parentNode = editor.getNode(newParentId);

      if (!node || !parentNode) return false;
      if (parentNode.nodeType !== 'parallel-group') return false;
      if (!isAllowedChildType(node.nodeType as WorkflowNodeType)) return false;

      const oldParentId = node.parent;
      node.parent = newParentId;
      await area.update('node', nodeId);

      // Update scopes for both old and new parent
      if (oldParentId) {
        await scopes.update(oldParentId);
      }
      await scopes.update(newParentId);
      return true;
    },
    /**
     * Find Parallel Group at a given position (expose helper for external use)
     */
    findParallelGroupAtPosition,
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
