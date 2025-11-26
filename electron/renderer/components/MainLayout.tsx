/**
 * MainLayout Component
 *
 * シンプルな2カラムレイアウト
 * 左: ChatPanel (40%)
 * 右: WorkflowEditorView (60%)
 */

import React from 'react';
import { ChatPanel, type ChatMessage } from './ChatPanel';
import { WorkflowEditorView } from './WorkflowEditorView';

/**
 * EditorInstance type for ref
 */
interface EditorInstance {
  addNode: (type: string, position: { x: number; y: number }) => Promise<string>;
  removeNode: (nodeId: string) => Promise<void>;
  getNodes: () => unknown[];
  getConnections: () => unknown[];
  clearEditor: () => Promise<void>;
  zoomToFit: () => void;
  setZoom: (zoom: number) => void;
  destroy: () => void;
  getEditorData: () => {
    nodes: Array<{
      id: string;
      type: string;
      label: string;
      position: { x: number; y: number };
      inputs: Array<{ key: string; label: string }>;
      outputs: Array<{ key: string; label: string }>;
      config: Record<string, unknown>;
    }>;
    connections: Array<{
      id: string;
      source: string;
      sourceOutput: string;
      target: string;
      targetInput: string;
    }>;
  };
  loadEditorData: (data: {
    nodes: unknown[];
    connections: unknown[];
  }) => Promise<void>;
}

/**
 * MainLayoutのProps
 */
export interface MainLayoutProps {
  /** エディタのref */
  editorRef: React.RefObject<EditorInstance | null>;
  /** プロンプト送信時のコールバック */
  onPromptSubmit: (prompt: string) => Promise<void>;
  /** チャットメッセージ一覧 */
  messages: ChatMessage[];
  /** 実行中かどうか */
  isExecuting: boolean;
}

/**
 * MainLayout - ワークフローエディタとチャットパネルの2カラムレイアウト
 */
export function MainLayout({
  editorRef,
  onPromptSubmit,
  messages,
  isExecuting,
}: MainLayoutProps) {
  // エディタの準備完了時のコールバック
  const handleEditorReady = React.useCallback(
    (editor: EditorInstance) => {
      if (editorRef && 'current' in editorRef) {
        (editorRef as React.MutableRefObject<EditorInstance | null>).current = editor;
      }
    },
    [editorRef]
  );

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left Panel: Chat (40%) */}
      <div className="flex w-[40%] flex-col border-r border-border bg-background">
        <ChatPanel
          onSubmit={onPromptSubmit}
          messages={messages}
          isExecuting={isExecuting}
        />
      </div>

      {/* Right Panel: Workflow Editor (60%) */}
      <div className="flex flex-1 flex-col bg-muted/20">
        <WorkflowEditorView onEditorReady={handleEditorReady} />
      </div>
    </div>
  );
}

export default MainLayout;
