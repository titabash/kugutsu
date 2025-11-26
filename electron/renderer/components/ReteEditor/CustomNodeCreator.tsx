/**
 * CustomNodeCreator
 *
 * Component for creating custom AI node templates.
 * Allows users to define:
 * - Node name and description
 * - AI provider selection (Claude, OpenAI, Gemini, Auto)
 * - System prompt
 * - Input/output sockets
 * - Advanced settings (maxTurns, allowedTools)
 */

import React, { useState, useCallback, useMemo } from 'react';
import { NODE_COLORS } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * AI Provider options
 */
export type AIProvider = 'auto' | 'claude' | 'openai' | 'gemini';

/**
 * Socket definition for custom nodes
 */
export interface SocketDefinition {
  id: string;
  name: string;
  type: 'data' | 'control';
  dataType?: 'string' | 'object' | 'array' | 'number' | 'boolean' | 'any';
  required: boolean;
}

/**
 * Custom node template
 */
export interface CustomNodeTemplate {
  name: string;
  description: string;
  systemPrompt: string;
  provider: AIProvider;
  maxTurns: number;
  allowedTools: string[];
  inputs: SocketDefinition[];
  outputs: SocketDefinition[];
}

/**
 * Props for CustomNodeCreator
 */
export interface CustomNodeCreatorProps {
  onCreate: (template: CustomNodeTemplate) => void;
  onCancel: () => void;
  existingNames?: string[];
  initialTemplate?: CustomNodeTemplate;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TOOLS = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'];

const PROVIDER_OPTIONS: { value: AIProvider; label: string }[] = [
  { value: 'auto', label: 'Auto (自動選択)' },
  { value: 'claude', label: 'Claude' },
  { value: 'openai', label: 'OpenAI (Codex)' },
  { value: 'gemini', label: 'Gemini' },
];

// ============================================================================
// Sub-components
// ============================================================================

interface SocketEditorProps {
  socket: SocketDefinition;
  onUpdate: (socket: SocketDefinition) => void;
  onRemove: () => void;
  testIdPrefix: string;
}

const SocketEditor: React.FC<SocketEditorProps> = ({
  socket,
  onUpdate,
  onRemove,
  testIdPrefix,
}) => {
  return (
    <div
      data-testid={testIdPrefix}
      style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        padding: '8px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '4px',
        marginBottom: '4px',
      }}
    >
      <input
        type="text"
        placeholder="ソケット名 / Socket Name"
        value={socket.name}
        onChange={(e) => onUpdate({ ...socket, name: e.target.value })}
        style={{
          flex: 1,
          padding: '6px 8px',
          backgroundColor: '#333',
          border: '1px solid #444',
          borderRadius: '4px',
          color: '#fff',
          fontSize: '12px',
        }}
      />
      <select
        value={socket.dataType || 'any'}
        onChange={(e) =>
          onUpdate({ ...socket, dataType: e.target.value as SocketDefinition['dataType'] })
        }
        style={{
          padding: '6px 8px',
          backgroundColor: '#333',
          border: '1px solid #444',
          borderRadius: '4px',
          color: '#fff',
          fontSize: '12px',
        }}
      >
        <option value="any">Any</option>
        <option value="string">String</option>
        <option value="object">Object</option>
        <option value="array">Array</option>
        <option value="number">Number</option>
        <option value="boolean">Boolean</option>
      </select>
      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#888' }}>
        <input
          type="checkbox"
          checked={socket.required}
          onChange={(e) => onUpdate({ ...socket, required: e.target.checked })}
        />
        <span style={{ fontSize: '11px' }}>必須</span>
      </label>
      <button
        onClick={onRemove}
        aria-label="削除"
        style={{
          padding: '4px 8px',
          backgroundColor: '#ef4444',
          border: 'none',
          borderRadius: '4px',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '12px',
        }}
      >
        ×
      </button>
    </div>
  );
};

// ============================================================================
// CustomNodeCreator
// ============================================================================

export const CustomNodeCreator: React.FC<CustomNodeCreatorProps> = ({
  onCreate,
  onCancel,
  existingNames = [],
  initialTemplate,
}) => {
  // Form state
  const [name, setName] = useState(initialTemplate?.name ?? '');
  const [description, setDescription] = useState(initialTemplate?.description ?? '');
  const [systemPrompt, setSystemPrompt] = useState(initialTemplate?.systemPrompt ?? '');
  const [provider, setProvider] = useState<AIProvider>(initialTemplate?.provider ?? 'auto');
  const [maxTurns, setMaxTurns] = useState(initialTemplate?.maxTurns ?? 30);
  const [allowedTools, setAllowedTools] = useState<string[]>(
    initialTemplate?.allowedTools ?? [...DEFAULT_TOOLS]
  );
  const [inputs, setInputs] = useState<SocketDefinition[]>(initialTemplate?.inputs ?? []);
  const [outputs, setOutputs] = useState<SocketDefinition[]>(initialTemplate?.outputs ?? []);

  // Validation
  const isEditMode = !!initialTemplate;
  const nameError = useMemo(() => {
    if (!name.trim()) return null;
    if (existingNames.includes(name) && name !== initialTemplate?.name) {
      return '同じ名前のノードが既に存在します / Node name already exists';
    }
    return null;
  }, [name, existingNames, initialTemplate?.name]);

  const isValid = name.trim() !== '' && !nameError;

  // Handlers
  const handleAddInput = useCallback(() => {
    const newSocket: SocketDefinition = {
      id: `input-${Date.now()}`,
      name: '',
      type: 'data',
      dataType: 'any',
      required: false,
    };
    setInputs((prev) => [...prev, newSocket]);
  }, []);

  const handleAddOutput = useCallback(() => {
    const newSocket: SocketDefinition = {
      id: `output-${Date.now()}`,
      name: '',
      type: 'data',
      dataType: 'any',
      required: false,
    };
    setOutputs((prev) => [...prev, newSocket]);
  }, []);

  const handleUpdateInput = useCallback((index: number, socket: SocketDefinition) => {
    setInputs((prev) => {
      const updated = [...prev];
      updated[index] = socket;
      return updated;
    });
  }, []);

  const handleUpdateOutput = useCallback((index: number, socket: SocketDefinition) => {
    setOutputs((prev) => {
      const updated = [...prev];
      updated[index] = socket;
      return updated;
    });
  }, []);

  const handleRemoveInput = useCallback((index: number) => {
    setInputs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleRemoveOutput = useCallback((index: number) => {
    setOutputs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleToggleTool = useCallback((tool: string) => {
    setAllowedTools((prev) => {
      if (prev.includes(tool)) {
        return prev.filter((t) => t !== tool);
      }
      return [...prev, tool];
    });
  }, []);

  const handleCreate = useCallback(() => {
    if (!isValid) return;

    const template: CustomNodeTemplate = {
      name: name.trim(),
      description: description.trim(),
      systemPrompt,
      provider,
      maxTurns,
      allowedTools,
      inputs,
      outputs,
    };

    onCreate(template);
  }, [name, description, systemPrompt, provider, maxTurns, allowedTools, inputs, outputs, isValid, onCreate]);

  // Styles
  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '4px',
    color: '#888',
    fontSize: '12px',
    fontWeight: 500,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    backgroundColor: '#333',
    border: '1px solid #444',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '13px',
    outline: 'none',
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '16px',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#1f1f1f',
        color: '#fff',
        padding: '16px',
        overflow: 'auto',
      }}
    >
      {/* Header */}
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>
        {isEditMode ? 'ノードを編集 / Edit Node' : 'カスタムノードを作成 / Create Custom Node'}
      </h3>

      {/* Node Name */}
      <div style={sectionStyle}>
        <label htmlFor="node-name" style={labelStyle}>
          ノード名 / Node Name *
        </label>
        <input
          id="node-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Custom Node"
          style={{
            ...inputStyle,
            borderColor: nameError ? '#ef4444' : '#444',
          }}
        />
        {nameError && (
          <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', display: 'block' }}>
            {nameError}
          </span>
        )}
      </div>

      {/* Description */}
      <div style={sectionStyle}>
        <label htmlFor="node-description" style={labelStyle}>
          説明 / Description
        </label>
        <input
          id="node-description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this node do?"
          style={inputStyle}
        />
      </div>

      {/* AI Provider */}
      <div style={sectionStyle}>
        <label htmlFor="ai-provider" style={labelStyle}>
          AIプロバイダー / AI Provider
        </label>
        <select
          id="ai-provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value as AIProvider)}
          style={inputStyle}
        >
          {PROVIDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* System Prompt */}
      <div style={sectionStyle}>
        <label htmlFor="system-prompt" style={labelStyle}>
          システムプロンプト / System Prompt
        </label>
        <textarea
          id="system-prompt"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are a helpful assistant..."
          rows={6}
          style={{
            ...inputStyle,
            resize: 'vertical',
            fontFamily: 'monospace',
          }}
        />
      </div>

      {/* Input Sockets */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={labelStyle}>入力ソケット / Input Sockets</span>
          <button
            onClick={handleAddInput}
            aria-label="入力を追加"
            style={{
              padding: '4px 8px',
              backgroundColor: '#3b82f6',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            + 入力を追加 / Add Input
          </button>
        </div>
        {inputs.map((socket, index) => (
          <SocketEditor
            key={socket.id}
            socket={socket}
            onUpdate={(s) => handleUpdateInput(index, s)}
            onRemove={() => handleRemoveInput(index)}
            testIdPrefix={`input-socket-${index}`}
          />
        ))}
        {inputs.length === 0 && (
          <div style={{ color: '#666', fontSize: '12px', textAlign: 'center', padding: '8px' }}>
            入力ソケットがありません
          </div>
        )}
      </div>

      {/* Output Sockets */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={labelStyle}>出力ソケット / Output Sockets</span>
          <button
            onClick={handleAddOutput}
            aria-label="出力を追加"
            style={{
              padding: '4px 8px',
              backgroundColor: '#10b981',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            + 出力を追加 / Add Output
          </button>
        </div>
        {outputs.map((socket, index) => (
          <SocketEditor
            key={socket.id}
            socket={socket}
            onUpdate={(s) => handleUpdateOutput(index, s)}
            onRemove={() => handleRemoveOutput(index)}
            testIdPrefix={`output-socket-${index}`}
          />
        ))}
        {outputs.length === 0 && (
          <div style={{ color: '#666', fontSize: '12px', textAlign: 'center', padding: '8px' }}>
            出力ソケットがありません
          </div>
        )}
      </div>

      {/* Advanced Settings */}
      <div style={sectionStyle}>
        <div style={{ ...labelStyle, marginBottom: '8px' }}>詳細設定 / Advanced Settings</div>

        {/* Max Turns */}
        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="max-turns" style={{ ...labelStyle, fontSize: '11px' }}>
            maxTurns / 最大ターン数
          </label>
          <input
            id="max-turns"
            type="number"
            value={maxTurns}
            onChange={(e) => setMaxTurns(parseInt(e.target.value, 10) || 30)}
            min={1}
            max={100}
            style={{ ...inputStyle, width: '100px' }}
          />
        </div>

        {/* Allowed Tools */}
        <div>
          <span style={{ ...labelStyle, fontSize: '11px', marginBottom: '8px', display: 'block' }}>
            許可ツール / Allowed Tools
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {DEFAULT_TOOLS.map((tool) => (
              <label
                key={tool}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: '#888',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={allowedTools.includes(tool)}
                  onChange={() => handleToggleTool(tool)}
                  aria-label={tool}
                />
                {tool}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Preview */}
      <div style={sectionStyle}>
        <div style={{ ...labelStyle, marginBottom: '8px' }}>プレビュー / Preview</div>
        <div
          data-testid="node-preview"
          style={{
            padding: '12px',
            backgroundColor: '#2d2d2d',
            borderRadius: '8px',
            border: `2px solid ${NODE_COLORS['custom-ai']}`,
            borderColor: NODE_COLORS['custom-ai'],
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '18px' }}>🤖</span>
            <span style={{ fontWeight: 600, color: '#fff' }}>
              {name || 'Custom Node'}
            </span>
          </div>
          <div style={{ color: '#888', fontSize: '11px' }}>
            {description || 'No description'}
          </div>
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
            Provider: {provider} | Max Turns: {maxTurns}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '16px' }}>
        <button
          onClick={onCancel}
          aria-label="キャンセル"
          style={{
            flex: 1,
            padding: '10px 16px',
            backgroundColor: '#333',
            border: '1px solid #444',
            borderRadius: '6px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          キャンセル / Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={!isValid}
          aria-label={isEditMode ? '更新' : '作成'}
          style={{
            flex: 1,
            padding: '10px 16px',
            backgroundColor: isValid ? '#3b82f6' : '#333',
            border: 'none',
            borderRadius: '6px',
            color: isValid ? '#fff' : '#666',
            cursor: isValid ? 'pointer' : 'not-allowed',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          {isEditMode ? '更新 / Update' : '作成 / Create'}
        </button>
      </div>
    </div>
  );
};

export default CustomNodeCreator;
