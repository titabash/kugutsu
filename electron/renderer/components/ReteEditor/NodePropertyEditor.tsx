/**
 * NodePropertyEditor
 *
 * Component for editing properties of a selected workflow node.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { WorkflowNodeType, NodeStatus } from './types';
import { NODE_COLORS, NODE_ICONS } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Node data for editing
 */
export interface EditableNodeData {
  id: string;
  type: WorkflowNodeType;
  label: string;
  description?: string;
  config: Record<string, unknown>;
  status?: NodeStatus;
}

export interface NodePropertyEditorProps {
  className?: string;
  node: EditableNodeData | null;
  onNodeUpdate?: (nodeId: string, updates: Partial<EditableNodeData>) => void;
  onClose?: () => void;
  collapsed?: boolean;
}

// ============================================================================
// PropertyField Component
// ============================================================================

interface PropertyFieldProps {
  label: string;
  type: 'text' | 'number' | 'textarea' | 'select' | 'checkbox';
  value: unknown;
  onChange: (value: unknown) => void;
  options?: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

const PropertyField: React.FC<PropertyFieldProps> = ({
  label,
  type,
  value,
  onChange,
  options = [],
  placeholder,
  disabled = false,
  id,
}) => {
  // Generate a stable ID from label if not provided
  const inputId = id || `field-${label.toLowerCase().replace(/\s+/g, '-')}`;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    backgroundColor: '#333',
    border: '1px solid #444',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '13px',
    outline: 'none',
  };

  const renderInput = () => {
    switch (type) {
      case 'textarea':
        return (
          <textarea
            id={inputId}
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            style={{
              ...inputStyle,
              minHeight: '80px',
              resize: 'vertical',
            }}
          />
        );

      case 'select':
        return (
          <select
            id={inputId}
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            style={inputStyle}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'checkbox':
        return (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              id={inputId}
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              disabled={disabled}
              style={{ width: '16px', height: '16px' }}
            />
            <span style={{ color: '#aaa', fontSize: '13px' }}>{placeholder}</span>
          </label>
        );

      case 'number':
        return (
          <input
            id={inputId}
            type="number"
            value={value as number}
            onChange={(e) => onChange(Number(e.target.value))}
            placeholder={placeholder}
            disabled={disabled}
            style={inputStyle}
          />
        );

      default:
        return (
          <input
            id={inputId}
            type="text"
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            style={inputStyle}
          />
        );
    }
  };

  return (
    <div style={{ marginBottom: '12px' }}>
      {type !== 'checkbox' && (
        <label
          htmlFor={inputId}
          style={{
            display: 'block',
            marginBottom: '4px',
            color: '#888',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          {label}
        </label>
      )}
      {renderInput()}
    </div>
  );
};

// ============================================================================
// AI Config Editor
// ============================================================================

interface AIConfigEditorProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

const AIConfigEditor: React.FC<AIConfigEditorProps> = ({ config, onChange }) => {
  const aiConfig = (config.ai || {}) as Record<string, unknown>;

  const updateAIConfig = (key: string, value: unknown) => {
    onChange({
      ...config,
      ai: {
        ...aiConfig,
        [key]: value,
      },
    });
  };

  return (
    <div>
      <PropertyField
        label="AI Provider"
        type="select"
        value={aiConfig.provider || 'claude'}
        onChange={(v) => updateAIConfig('provider', v)}
        options={[
          { value: 'claude', label: 'Claude' },
          { value: 'openai', label: 'OpenAI' },
          { value: 'gemini', label: 'Gemini' },
        ]}
      />
      <PropertyField
        label="Max Turns"
        type="number"
        value={aiConfig.maxTurns || 30}
        onChange={(v) => updateAIConfig('maxTurns', v)}
        placeholder="Maximum conversation turns"
      />
      <PropertyField
        label="System Prompt"
        type="textarea"
        value={aiConfig.systemPrompt || ''}
        onChange={(v) => updateAIConfig('systemPrompt', v)}
        placeholder="Custom system prompt for this node"
      />
    </div>
  );
};

// ============================================================================
// Decision Config Editor
// ============================================================================

interface DecisionConfigEditorProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

const DecisionConfigEditor: React.FC<DecisionConfigEditorProps> = ({ config, onChange }) => {
  return (
    <div>
      <PropertyField
        label="Condition Expression"
        type="textarea"
        value={config.condition || ''}
        onChange={(v) => onChange({ ...config, condition: v })}
        placeholder="e.g., input.value > 10"
      />
      <div style={{ color: '#666', fontSize: '11px', marginTop: '4px' }}>
        Expression that evaluates to true or false. Available variables: input, context
      </div>
    </div>
  );
};

// ============================================================================
// Transform Config Editor
// ============================================================================

interface TransformConfigEditorProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

const TransformConfigEditor: React.FC<TransformConfigEditorProps> = ({ config, onChange }) => {
  return (
    <div>
      <PropertyField
        label="Transform Type"
        type="select"
        value={config.transformType || 'custom'}
        onChange={(v) => onChange({ ...config, transformType: v })}
        options={[
          { value: 'custom', label: 'Custom Function' },
          { value: 'map', label: 'Map' },
          { value: 'filter', label: 'Filter' },
          { value: 'reduce', label: 'Reduce' },
        ]}
      />
      <PropertyField
        label="Transform Function"
        type="textarea"
        value={config.transformFunction || ''}
        onChange={(v) => onChange({ ...config, transformFunction: v })}
        placeholder="return input.value * 2"
      />
    </div>
  );
};

// ============================================================================
// NodePropertyEditor
// ============================================================================

/**
 * NodePropertyEditor - Edit properties of selected workflow nodes
 */
export const NodePropertyEditor: React.FC<NodePropertyEditorProps> = ({
  className = '',
  node,
  onNodeUpdate,
  onClose,
  collapsed = false,
}) => {
  const [editedNode, setEditedNode] = useState<EditableNodeData | null>(null);

  // Sync with prop changes
  useEffect(() => {
    setEditedNode(node);
  }, [node]);

  const handleUpdate = useCallback(
    (updates: Partial<EditableNodeData>) => {
      if (!editedNode) return;

      const updated = { ...editedNode, ...updates };
      setEditedNode(updated);
      onNodeUpdate?.(editedNode.id, updates);
    },
    [editedNode, onNodeUpdate]
  );

  const handleConfigUpdate = useCallback(
    (config: Record<string, unknown>) => {
      handleUpdate({ config });
    },
    [handleUpdate]
  );

  if (collapsed || !node) {
    return null;
  }

  const backgroundColor = NODE_COLORS[node.type] || '#6b7280';
  const icon = NODE_ICONS[node.type] || '📄';

  const renderConfigEditor = () => {
    const isAINode =
      node.type === 'engineer' ||
      node.type === 'reviewer' ||
      node.type === 'product-owner' ||
      node.type === 'custom-ai';

    if (isAINode) {
      return (
        <AIConfigEditor config={editedNode?.config || {}} onChange={handleConfigUpdate} />
      );
    }

    if (node.type === 'decision') {
      return (
        <DecisionConfigEditor config={editedNode?.config || {}} onChange={handleConfigUpdate} />
      );
    }

    if (node.type === 'transform') {
      return (
        <TransformConfigEditor config={editedNode?.config || {}} onChange={handleConfigUpdate} />
      );
    }

    return null;
  };

  return (
    <div
      className={`node-property-editor ${className}`}
      style={{
        backgroundColor: '#1f1f1f',
        borderLeft: '1px solid #333',
        width: '280px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px',
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            backgroundColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>
            {node.label || node.type}
          </div>
          <div style={{ color: '#888', fontSize: '11px' }}>{node.type}</div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          ✕
        </button>
      </div>

      {/* Properties */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
        }}
      >
        {/* Basic properties */}
        <div style={{ marginBottom: '16px' }}>
          <h4
            style={{
              color: '#aaa',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px',
            }}
          >
            Basic Properties
          </h4>
          <PropertyField
            label="Label"
            type="text"
            value={editedNode?.label || ''}
            onChange={(v) => handleUpdate({ label: String(v) })}
            placeholder="Node label"
          />
          <PropertyField
            label="Description"
            type="textarea"
            value={editedNode?.description || ''}
            onChange={(v) => handleUpdate({ description: String(v) })}
            placeholder="Node description"
          />
        </div>

        {/* Type-specific config */}
        {renderConfigEditor() && (
          <div>
            <h4
              style={{
                color: '#aaa',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '8px',
              }}
            >
              Configuration
            </h4>
            {renderConfigEditor()}
          </div>
        )}

        {/* Node ID (read-only) */}
        <div style={{ marginTop: '16px' }}>
          <div
            style={{
              color: '#666',
              fontSize: '11px',
              marginBottom: '4px',
            }}
          >
            Node ID
          </div>
          <div
            style={{
              padding: '8px 10px',
              backgroundColor: '#2a2a2a',
              borderRadius: '4px',
              color: '#666',
              fontSize: '12px',
              fontFamily: 'monospace',
            }}
          >
            {node.id}
          </div>
        </div>

        {/* Status indicator */}
        {node.status && node.status !== 'idle' && (
          <div
            style={{
              marginTop: '16px',
              padding: '8px 12px',
              borderRadius: '4px',
              backgroundColor:
                node.status === 'executing'
                  ? 'rgba(59, 130, 246, 0.2)'
                  : node.status === 'completed'
                  ? 'rgba(16, 185, 129, 0.2)'
                  : 'rgba(239, 68, 68, 0.2)',
              color:
                node.status === 'executing'
                  ? '#3b82f6'
                  : node.status === 'completed'
                  ? '#10b981'
                  : '#ef4444',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            Status: {node.status}
          </div>
        )}
      </div>
    </div>
  );
};

export default NodePropertyEditor;
