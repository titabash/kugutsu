/**
 * App - メインアプリケーションコンポーネント
 *
 * シンプルな構成:
 * - プロジェクト未選択時: WelcomeScreen
 * - プロジェクト選択時: MainLayout (ChatPanel + WorkflowEditorView)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { Toaster } from '@/components/ui/toaster';
import { useElectronSync } from './hooks/useElectronSync';
import { useAppStore } from './store/appStore';
import { serializeWorkflow } from './components/ReteEditor';
import { formatNodeMessage } from './utils/messageFilter';
import type { ChatMessage } from '@/components/ChatPanel';

// ElectronAPI型定義
declare global {
  interface Window {
    electronAPI?: {
      executeWorkflowWithPrompt: (
        workflow: unknown,
        prompt: string
      ) => Promise<{
        success: boolean;
        message?: string;
        error?: string;
      }>;
      onWorkflowProgress?: (
        callback: (data: {
          nodeId: string;
          status: string;
          progress?: number;
          outputs?: unknown;
        }) => void
      ) => () => void;
      onWorkflowCompleted?: (
        callback: (data: {
          success: boolean;
          result?: unknown;
          error?: string;
        }) => void
      ) => () => void;
      onWorkflowNodeMessage?: (
        callback: (data: {
          nodeId: string;
          nodeLabel: string;
          message: {
            type: string;
            content?: string | unknown;
          };
        }) => void
      ) => () => void;
    };
  }
}

// EditorInstance型定義
interface EditorInstance {
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
}

export default function App() {
  const { projectPath, chatMessages, addChatMessage } = useAppStore();
  const editorRef = useRef<EditorInstance | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Sync Electron IPC events with app store
  useElectronSync();

  // Log when app mounts
  useEffect(() => {
    console.log('[App] Kugutsu UI mounted');
  }, []);

  // ワークフロー進行状況と完了イベントのリスナー
  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubscribeProgress = window.electronAPI.onWorkflowProgress?.((data) => {
      console.log('[App] Workflow progress:', data);

      // ノード実行状況をチャットに追加
      if (data.status === 'executing') {
        addChatMessage({
          id: `progress-${data.nodeId}-${Date.now()}`,
          type: 'system',
          content: `ノード ${data.nodeId} を実行中...`,
          timestamp: new Date(),
        });
      }
    });

    const unsubscribeCompleted = window.electronAPI.onWorkflowCompleted?.((data) => {
      console.log('[App] Workflow completed:', data);
      setIsExecuting(false);

      if (data.success) {
        addChatMessage({
          id: `completed-${Date.now()}`,
          type: 'ai',
          content: `ワークフローが完了しました。\n\n結果: ${JSON.stringify(data.result, null, 2)}`,
          timestamp: new Date(),
        });
      } else {
        addChatMessage({
          id: `error-${Date.now()}`,
          type: 'system',
          content: `エラー: ${data.error || '不明なエラー'}`,
          timestamp: new Date(),
        });
      }
    });

    // AIノードからのメッセージをリアルタイムで受信
    const unsubscribeNodeMessage = window.electronAPI.onWorkflowNodeMessage?.((data) => {
      console.log('[App] Workflow node message:', data);

      // AIからのアシスタントメッセージをチャットに追加
      // 空メッセージや空白のみのメッセージはフィルタリング
      if (data.message?.type === 'assistant' && typeof data.message.content === 'string') {
        const formattedContent = formatNodeMessage(data.nodeLabel, data.message.content);
        if (formattedContent) {
          addChatMessage({
            id: `ai-${data.nodeId}-${Date.now()}`,
            type: 'ai',
            content: formattedContent,
            timestamp: new Date(),
            isStreaming: true,
          });
        }
      }
    });

    return () => {
      unsubscribeProgress?.();
      unsubscribeCompleted?.();
      unsubscribeNodeMessage?.();
    };
  }, [addChatMessage]);

  // プロンプト送信処理
  const handlePromptSubmit = useCallback(
    async (prompt: string) => {
      console.log('[App] Prompt submitted:', prompt);

      // ユーザーメッセージをチャットに追加
      addChatMessage({
        id: `user-${Date.now()}`,
        type: 'user',
        content: prompt,
        timestamp: new Date(),
      });

      // エディタが準備できていない場合
      if (!editorRef.current) {
        addChatMessage({
          id: `error-${Date.now()}`,
          type: 'system',
          content: 'エディタが準備できていません。しばらく待ってから再試行してください。',
          timestamp: new Date(),
        });
        return;
      }

      // ElectronAPIが利用可能か確認
      if (!window.electronAPI?.executeWorkflowWithPrompt) {
        addChatMessage({
          id: `error-${Date.now()}`,
          type: 'system',
          content: 'ワークフロー実行APIが利用できません。',
          timestamp: new Date(),
        });
        return;
      }

      setIsExecuting(true);

      try {
        // エディタからワークフローを取得
        const editorData = editorRef.current.getEditorData();
        const workflow = serializeWorkflow(editorData, {
          name: 'Chat Workflow',
          description: prompt,
        });

        // 実行開始メッセージ
        addChatMessage({
          id: `start-${Date.now()}`,
          type: 'system',
          content: 'ワークフローを実行しています...',
          timestamp: new Date(),
        });

        // ワークフローを実行
        const result = await window.electronAPI.executeWorkflowWithPrompt(workflow, prompt);

        if (!result.success) {
          addChatMessage({
            id: `error-${Date.now()}`,
            type: 'system',
            content: `実行エラー: ${result.error || result.message || '不明なエラー'}`,
            timestamp: new Date(),
          });
          setIsExecuting(false);
        }
        // 成功時はonWorkflowCompletedイベントで処理
      } catch (error) {
        console.error('[App] Workflow execution error:', error);
        addChatMessage({
          id: `error-${Date.now()}`,
          type: 'system',
          content: `エラー: ${error instanceof Error ? error.message : '不明なエラー'}`,
          timestamp: new Date(),
        });
        setIsExecuting(false);
      }
    },
    [addChatMessage]
  );

  // ChatMessage型をChatPanelの型に変換
  const formattedMessages: ChatMessage[] = chatMessages.map((msg) => ({
    id: msg.id,
    type: msg.type,
    content: msg.content,
    timestamp: msg.timestamp,
    isThinking: msg.isThinking,
    isStreaming: msg.isStreaming,
  }));

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Conditional Content */}
      {projectPath ? (
        <MainLayout
          editorRef={editorRef}
          onPromptSubmit={handlePromptSubmit}
          messages={formattedMessages}
          isExecuting={isExecuting}
        />
      ) : (
        <WelcomeScreen />
      )}

      {/* Toast Notifications */}
      <Toaster />
    </div>
  );
}
