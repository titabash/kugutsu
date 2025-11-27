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
// Parallel Group Config Editor
// ============================================================================

interface ParallelGroupConfigEditorProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

const ParallelGroupConfigEditor: React.FC<ParallelGroupConfigEditorProps> = ({ config, onChange }) => {
  const pgConfig = (config.parallelGroup || {}) as Record<string, unknown>;
  const conflictConfig = (pgConfig.conflictResolution || {}) as Record<string, unknown>;

  const updatePGConfig = (key: string, value: unknown) => {
    onChange({
      ...config,
      parallelGroup: {
        ...pgConfig,
        [key]: value,
      },
    });
  };

  const updateConflictConfig = (key: string, value: unknown) => {
    onChange({
      ...config,
      parallelGroup: {
        ...pgConfig,
        conflictResolution: {
          ...conflictConfig,
          [key]: value,
        },
      },
    });
  };

  return (
    <div>
      {/* Execution Settings */}
      <div style={{ marginBottom: '16px' }}>
        <h5 style={{ color: '#888', fontSize: '11px', fontWeight: 600, marginBottom: '8px' }}>
          Execution
        </h5>
        <PropertyField
          label="Max Concurrency"
          type="number"
          value={pgConfig.maxConcurrency || 4}
          onChange={(v) => updatePGConfig('maxConcurrency', v)}
          placeholder="Maximum parallel tasks"
        />
        <PropertyField
          label="Failure Strategy"
          type="select"
          value={pgConfig.failureStrategy || 'continue'}
          onChange={(v) => updatePGConfig('failureStrategy', v)}
          options={[
            { value: 'continue', label: 'Continue (ignore failures)' },
            { value: 'abort-all', label: 'Abort All (stop on failure)' },
            { value: 'retry', label: 'Retry (retry failed tasks)' },
          ]}
        />
        <PropertyField
          label="Aggregation"
          type="select"
          value={pgConfig.aggregationStrategy || 'merge'}
          onChange={(v) => updatePGConfig('aggregationStrategy', v)}
          options={[
            { value: 'merge', label: 'Merge Results' },
            { value: 'concat', label: 'Concatenate Results' },
            { value: 'none', label: 'No Aggregation' },
          ]}
        />
      </div>

      {/* Git Worktree Settings */}
      <div style={{ marginBottom: '16px' }}>
        <h5 style={{ color: '#888', fontSize: '11px', fontWeight: 600, marginBottom: '8px' }}>
          Git Worktree
        </h5>
        <PropertyField
          label=""
          type="checkbox"
          value={pgConfig.useWorktree || false}
          onChange={(v) => updatePGConfig('useWorktree', v)}
          placeholder="Use Git Worktree for isolation"
        />
        {pgConfig.useWorktree && (
          <>
            <PropertyField
              label="Branch Prefix"
              type="text"
              value={pgConfig.branchPrefix || 'parallel'}
              onChange={(v) => updatePGConfig('branchPrefix', v)}
              placeholder="e.g., feature/"
            />
            <PropertyField
              label=""
              type="checkbox"
              value={pgConfig.cleanupAfter !== false}
              onChange={(v) => updatePGConfig('cleanupAfter', v)}
              placeholder="Cleanup worktree after completion"
            />
          </>
        )}
      </div>

      {/* Conflict Resolution */}
      {pgConfig.useWorktree && (
        <div>
          <h5 style={{ color: '#888', fontSize: '11px', fontWeight: 600, marginBottom: '8px' }}>
            Conflict Resolution
          </h5>
          <PropertyField
            label="Strategy"
            type="select"
            value={conflictConfig.strategy || 'ai'}
            onChange={(v) => updateConflictConfig('strategy', v)}
            options={[
              { value: 'ai', label: 'AI Auto-resolve' },
              { value: 'ours', label: 'Keep Ours' },
              { value: 'theirs', label: 'Keep Theirs' },
              { value: 'manual', label: 'Manual (pause)' },
            ]}
          />
          <PropertyField
            label=""
            type="checkbox"
            value={conflictConfig.autoMergeAfterTask !== false}
            onChange={(v) => updateConflictConfig('autoMergeAfterTask', v)}
            placeholder="Auto merge after each task"
          />
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Merge Config Editor
// ============================================================================

interface MergeConfigEditorProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

const MergeConfigEditor: React.FC<MergeConfigEditorProps> = ({ config, onChange }) => {
  const mergeConfig = (config.merge || {}) as Record<string, unknown>;

  const updateMergeConfig = (key: string, value: unknown) => {
    onChange({
      ...config,
      merge: {
        ...mergeConfig,
        [key]: value,
      },
    });
  };

  return (
    <div>
      <PropertyField
        label="Merge Strategy"
        type="select"
        value={mergeConfig.strategy || 'merge'}
        onChange={(v) => updateMergeConfig('strategy', v)}
        options={[
          { value: 'merge', label: 'Merge' },
          { value: 'rebase', label: 'Rebase' },
          { value: 'squash', label: 'Squash' },
        ]}
      />
      <PropertyField
        label="Conflict Resolution"
        type="select"
        value={mergeConfig.conflictResolution || 'ai'}
        onChange={(v) => updateMergeConfig('conflictResolution', v)}
        options={[
          { value: 'ai', label: 'AI Auto-resolve' },
          { value: 'ours', label: 'Keep Ours' },
          { value: 'theirs', label: 'Keep Theirs' },
          { value: 'manual', label: 'Manual (pause)' },
        ]}
      />
      <PropertyField
        label="Source Branch"
        type="text"
        value={mergeConfig.sourceBranch || ''}
        onChange={(v) => updateMergeConfig('sourceBranch', v)}
        placeholder="e.g., feature/auth"
      />
      <PropertyField
        label="Target Branch"
        type="text"
        value={mergeConfig.targetBranch || 'main'}
        onChange={(v) => updateMergeConfig('targetBranch', v)}
        placeholder="e.g., main, develop"
      />
      <PropertyField
        label=""
        type="checkbox"
        value={mergeConfig.autoCommit !== false}
        onChange={(v) => updateMergeConfig('autoCommit', v)}
        placeholder="Auto commit after merge"
      />
      <PropertyField
        label=""
        type="checkbox"
        value={mergeConfig.squash || false}
        onChange={(v) => updateMergeConfig('squash', v)}
        placeholder="Squash commits"
      />
    </div>
  );
};

// ============================================================================
// End Node Config Editor
// ============================================================================

interface EndConfigEditorProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

const EndConfigEditor: React.FC<EndConfigEditorProps> = ({ config, onChange }) => {
  const endConfig = (config.end || {}) as Record<string, unknown>;

  const updateEndConfig = (key: string, value: unknown) => {
    onChange({
      ...config,
      end: {
        ...endConfig,
        [key]: value,
      },
    });
  };

  return (
    <div>
      <PropertyField
        label="Output Format"
        type="select"
        value={endConfig.outputFormat || 'summary'}
        onChange={(v) => updateEndConfig('outputFormat', v)}
        options={[
          { value: 'summary', label: 'Summary' },
          { value: 'detailed', label: 'Detailed Report' },
          { value: 'json', label: 'JSON Output' },
          { value: 'minimal', label: 'Minimal' },
        ]}
      />
      <PropertyField
        label=""
        type="checkbox"
        value={endConfig.includeMetrics !== false}
        onChange={(v) => updateEndConfig('includeMetrics', v)}
        placeholder="Include execution metrics"
      />
      <PropertyField
        label=""
        type="checkbox"
        value={endConfig.notifyOnComplete || false}
        onChange={(v) => updateEndConfig('notifyOnComplete', v)}
        placeholder="Notify on completion"
      />
      <PropertyField
        label=""
        type="checkbox"
        value={endConfig.saveResults !== false}
        onChange={(v) => updateEndConfig('saveResults', v)}
        placeholder="Save results to file"
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

    if (node.type === 'parallel-group') {
      return (
        <ParallelGroupConfigEditor config={editedNode?.config || {}} onChange={handleConfigUpdate} />
      );
    }

    if (node.type === 'merge') {
      return (
        <MergeConfigEditor config={editedNode?.config || {}} onChange={handleConfigUpdate} />
      );
    }

    if (node.type === 'end') {
      return (
        <EndConfigEditor config={editedNode?.config || {}} onChange={handleConfigUpdate} />
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
