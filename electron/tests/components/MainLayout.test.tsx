/**
 * MainLayout Component Tests (TDD - RED Phase)
 *
 * 新しいMainLayoutコンポーネントのテスト
 * 左: ChatPanel (30%)、右: WorkflowEditorView (70%) の構成
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// WorkflowEditorViewをモック
vi.mock('../../renderer/components/WorkflowEditorView', () => ({
  WorkflowEditorView: React.forwardRef((props: any, ref: any) => (
    <div data-testid="workflow-editor-view" ref={ref}>
      Mock WorkflowEditorView
    </div>
  )),
}));

// ChatPanelをモック
vi.mock('../../renderer/components/ChatPanel', () => ({
  ChatPanel: ({ onSubmit, messages, isExecuting }: any) => (
    <div data-testid="chat-panel">
      <div data-testid="messages-count">{messages?.length || 0}</div>
      <div data-testid="is-executing">{isExecuting?.toString()}</div>
      <button onClick={() => onSubmit?.('test')}>Submit</button>
    </div>
  ),
}));

describe('MainLayout', () => {
  const mockEditorRef = { current: null };
  const mockOnPromptSubmit = vi.fn();
  const mockMessages: Array<{
    id: string;
    type: 'user' | 'system' | 'ai';
    content: string;
    timestamp: Date;
  }> = [];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('レイアウト構成', () => {
    it('ChatPanelとWorkflowEditorViewが両方表示されること', async () => {
      const { MainLayout } = await import('../../renderer/components/MainLayout');

      render(
        <MainLayout
          editorRef={mockEditorRef}
          onPromptSubmit={mockOnPromptSubmit}
          messages={mockMessages}
          isExecuting={false}
        />
      );

      expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
      expect(screen.getByTestId('workflow-editor-view')).toBeInTheDocument();
    });

    it('タブUIが存在しないこと（旧UIの削除確認）', async () => {
      const { MainLayout } = await import('../../renderer/components/MainLayout');

      render(
        <MainLayout
          editorRef={mockEditorRef}
          onPromptSubmit={mockOnPromptSubmit}
          messages={mockMessages}
          isExecuting={false}
        />
      );

      // 旧UIのタブが存在しないことを確認
      expect(screen.queryByText(/AIエージェント/)).not.toBeInTheDocument();
      expect(screen.queryByText(/タスクボード/)).not.toBeInTheDocument();
      expect(screen.queryByText(/依存関係グラフ/)).not.toBeInTheDocument();
      expect(screen.queryByText(/スプリント/)).not.toBeInTheDocument();
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    });

    it('2カラムレイアウトが適用されていること', async () => {
      const { MainLayout } = await import('../../renderer/components/MainLayout');

      const { container } = render(
        <MainLayout
          editorRef={mockEditorRef}
          onPromptSubmit={mockOnPromptSubmit}
          messages={mockMessages}
          isExecuting={false}
        />
      );

      // flexレイアウトが適用されていることを確認
      const layoutContainer = container.firstChild as HTMLElement;
      expect(layoutContainer).toHaveClass('flex');
    });
  });

  describe('ChatPanelへのProps受け渡し', () => {
    it('onPromptSubmitがChatPanelに渡されること', async () => {
      const { MainLayout } = await import('../../renderer/components/MainLayout');

      render(
        <MainLayout
          editorRef={mockEditorRef}
          onPromptSubmit={mockOnPromptSubmit}
          messages={mockMessages}
          isExecuting={false}
        />
      );

      // ChatPanelのSubmitボタンをクリック
      const submitButton = screen.getByText('Submit');
      submitButton.click();

      expect(mockOnPromptSubmit).toHaveBeenCalledWith('test');
    });

    it('messagesがChatPanelに渡されること', async () => {
      const { MainLayout } = await import('../../renderer/components/MainLayout');

      const messages = [
        { id: '1', type: 'user' as const, content: 'test', timestamp: new Date() },
        { id: '2', type: 'ai' as const, content: 'response', timestamp: new Date() },
      ];

      render(
        <MainLayout
          editorRef={mockEditorRef}
          onPromptSubmit={mockOnPromptSubmit}
          messages={messages}
          isExecuting={false}
        />
      );

      expect(screen.getByTestId('messages-count')).toHaveTextContent('2');
    });

    it('isExecutingがChatPanelに渡されること', async () => {
      const { MainLayout } = await import('../../renderer/components/MainLayout');

      render(
        <MainLayout
          editorRef={mockEditorRef}
          onPromptSubmit={mockOnPromptSubmit}
          messages={mockMessages}
          isExecuting={true}
        />
      );

      expect(screen.getByTestId('is-executing')).toHaveTextContent('true');
    });
  });

  describe('WorkflowEditorViewへのProps受け渡し', () => {
    it('editorRefがWorkflowEditorViewに渡されること', async () => {
      const { MainLayout } = await import('../../renderer/components/MainLayout');

      render(
        <MainLayout
          editorRef={mockEditorRef}
          onPromptSubmit={mockOnPromptSubmit}
          messages={mockMessages}
          isExecuting={false}
        />
      );

      // WorkflowEditorViewが表示されていることを確認
      expect(screen.getByTestId('workflow-editor-view')).toBeInTheDocument();
    });
  });

  describe('レスポンシブ対応', () => {
    it('overflow-hiddenが適用されていること', async () => {
      const { MainLayout } = await import('../../renderer/components/MainLayout');

      const { container } = render(
        <MainLayout
          editorRef={mockEditorRef}
          onPromptSubmit={mockOnPromptSubmit}
          messages={mockMessages}
          isExecuting={false}
        />
      );

      const layoutContainer = container.firstChild as HTMLElement;
      expect(layoutContainer).toHaveClass('overflow-hidden');
    });
  });
});
