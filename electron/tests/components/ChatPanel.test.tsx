/**
 * ChatPanel Component Tests (TDD - RED Phase)
 *
 * チャットパネルコンポーネントのテスト
 * PromptPanelをベースに簡素化したチャット入力コンポーネント
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ChatPanelをテスト用にインポート
// Note: コンポーネントがまだ存在しないため、テストは失敗する（RED phase）

describe('ChatPanel', () => {
  // モックのセットアップ
  const mockOnSubmit = vi.fn();
  const defaultMessages: Array<{
    id: string;
    type: 'user' | 'system' | 'ai';
    content: string;
    timestamp: Date;
  }> = [];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('初期表示', () => {
    it('チャット入力エリアが表示されること', async () => {
      // ChatPanelをインポート（まだ存在しないので失敗する）
      const { ChatPanel } = await import('../../renderer/components/ChatPanel');

      render(
        <ChatPanel
          onSubmit={mockOnSubmit}
          messages={defaultMessages}
          isExecuting={false}
        />
      );

      const textarea = screen.getByPlaceholderText(/プロンプトを入力/i);
      expect(textarea).toBeInTheDocument();
    });

    it('送信ボタンが表示されること', async () => {
      const { ChatPanel } = await import('../../renderer/components/ChatPanel');

      render(
        <ChatPanel
          onSubmit={mockOnSubmit}
          messages={defaultMessages}
          isExecuting={false}
        />
      );

      const submitButton = screen.getByRole('button', { name: /送信/i });
      expect(submitButton).toBeInTheDocument();
    });

    it('AIプロバイダー選択UIが存在しないこと', async () => {
      const { ChatPanel } = await import('../../renderer/components/ChatPanel');

      render(
        <ChatPanel
          onSubmit={mockOnSubmit}
          messages={defaultMessages}
          isExecuting={false}
        />
      );

      // プロバイダー選択は削除される
      const providerSelector = screen.queryByText(/AIプロバイダー/i);
      expect(providerSelector).not.toBeInTheDocument();
    });

    it('メッセージがない場合は空の状態を表示すること', async () => {
      const { ChatPanel } = await import('../../renderer/components/ChatPanel');

      render(
        <ChatPanel
          onSubmit={mockOnSubmit}
          messages={[]}
          isExecuting={false}
        />
      );

      const emptyMessage = screen.getByText(/ワークフローを実行するにはプロンプトを入力/i);
      expect(emptyMessage).toBeInTheDocument();
    });
  });

  describe('メッセージ表示', () => {
    it('ユーザーメッセージが正しく表示されること', async () => {
      const { ChatPanel } = await import('../../renderer/components/ChatPanel');

      const messages = [
        {
          id: '1',
          type: 'user' as const,
          content: 'テストメッセージです',
          timestamp: new Date(),
        },
      ];

      render(
        <ChatPanel
          onSubmit={mockOnSubmit}
          messages={messages}
          isExecuting={false}
        />
      );

      expect(screen.getByText('テストメッセージです')).toBeInTheDocument();
    });

    it('システムメッセージが正しく表示されること', async () => {
      const { ChatPanel } = await import('../../renderer/components/ChatPanel');

      const messages = [
        {
          id: '1',
          type: 'system' as const,
          content: 'ワークフローを開始しました',
          timestamp: new Date(),
        },
      ];

      render(
        <ChatPanel
          onSubmit={mockOnSubmit}
          messages={messages}
          isExecuting={false}
        />
      );

      expect(screen.getByText('ワークフローを開始しました')).toBeInTheDocument();
    });

    it('AIメッセージが正しく表示されること', async () => {
      const { ChatPanel } = await import('../../renderer/components/ChatPanel');

      const messages = [
        {
          id: '1',
          type: 'ai' as const,
          content: 'AIからの応答です',
          timestamp: new Date(),
        },
      ];

      render(
        <ChatPanel
          onSubmit={mockOnSubmit}
          messages={messages}
          isExecuting={false}
        />
      );

      expect(screen.getByText('AIからの応答です')).toBeInTheDocument();
    });
  });

  describe('メッセージ送信', () => {
    it('プロンプト入力後に送信ボタンをクリックするとonSubmitが呼ばれること', async () => {
      const { ChatPanel } = await import('../../renderer/components/ChatPanel');
      const user = userEvent.setup();

      render(
        <ChatPanel
          onSubmit={mockOnSubmit}
          messages={defaultMessages}
          isExecuting={false}
        />
      );

      const textarea = screen.getByPlaceholderText(/プロンプトを入力/i);
      const submitButton = screen.getByRole('button', { name: /送信/i });

      await user.type(textarea, 'テストプロンプト');
      await user.click(submitButton);

      expect(mockOnSubmit).toHaveBeenCalledWith('テストプロンプト');
    });

    it('Cmd+Enterで送信できること', async () => {
      const { ChatPanel } = await import('../../renderer/components/ChatPanel');
      const user = userEvent.setup();

      render(
        <ChatPanel
          onSubmit={mockOnSubmit}
          messages={defaultMessages}
          isExecuting={false}
        />
      );

      const textarea = screen.getByPlaceholderText(/プロンプトを入力/i);

      await user.type(textarea, 'テストプロンプト');
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      expect(mockOnSubmit).toHaveBeenCalledWith('テストプロンプト');
    });

    it('空のプロンプトでは送信できないこと', async () => {
      const { ChatPanel } = await import('../../renderer/components/ChatPanel');
      const user = userEvent.setup();

      render(
        <ChatPanel
          onSubmit={mockOnSubmit}
          messages={defaultMessages}
          isExecuting={false}
        />
      );

      const submitButton = screen.getByRole('button', { name: /送信/i });

      // 空の状態で送信を試みる
      await user.click(submitButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('送信後に入力がクリアされること', async () => {
      const { ChatPanel } = await import('../../renderer/components/ChatPanel');
      const user = userEvent.setup();

      render(
        <ChatPanel
          onSubmit={mockOnSubmit}
          messages={defaultMessages}
          isExecuting={false}
        />
      );

      const textarea = screen.getByPlaceholderText(/プロンプトを入力/i) as HTMLTextAreaElement;

      await user.type(textarea, 'テストプロンプト');
      await user.click(screen.getByRole('button', { name: /送信/i }));

      await waitFor(() => {
        expect(textarea.value).toBe('');
      });
    });
  });

  describe('実行中の状態', () => {
    it('isExecuting=trueの時は送信ボタンが無効化されること', async () => {
      const { ChatPanel } = await import('../../renderer/components/ChatPanel');

      render(
        <ChatPanel
          onSubmit={mockOnSubmit}
          messages={defaultMessages}
          isExecuting={true}
        />
      );

      const submitButton = screen.getByRole('button', { name: /送信|実行中/i });
      expect(submitButton).toBeDisabled();
    });

    it('isExecuting=trueの時は入力エリアが無効化されること', async () => {
      const { ChatPanel } = await import('../../renderer/components/ChatPanel');

      render(
        <ChatPanel
          onSubmit={mockOnSubmit}
          messages={defaultMessages}
          isExecuting={true}
        />
      );

      const textarea = screen.getByPlaceholderText(/プロンプトを入力/i);
      expect(textarea).toBeDisabled();
    });

    it('isExecuting=trueの時はローディング表示があること', async () => {
      const { ChatPanel } = await import('../../renderer/components/ChatPanel');

      render(
        <ChatPanel
          onSubmit={mockOnSubmit}
          messages={defaultMessages}
          isExecuting={true}
        />
      );

      // ローディングスピナーが存在することを確認（複数の「実行中」があるため具体的に確認）
      const loadingIndicators = screen.getAllByText(/実行中/i);
      expect(loadingIndicators.length).toBeGreaterThan(0);
    });
  });
});
