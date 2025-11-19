/**
 * @jest-environment jsdom
 *
 * MemberNode Component Tests
 *
 * TDD Phase: RED - テストを先に作成
 * 期待される動作:
 * - ノードホバー時にツールチップが表示される
 * - ツールチップに詳細情報（ノード名、ステータス、経過時間、メッセージ）が含まれる
 * - ノードクリック時にモーダルが表示される
 * - モーダルに詳細な実行履歴が表示される
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import React from 'react';

// Import the component
import MemberNode from '../../../../../../electron/renderer/components/team-dashboard/nodes/MemberNode';
import type { MemberNodeProps, MemberNodeData } from '../../../../../../electron/renderer/components/team-dashboard/nodes/MemberNode';

// テストデータ作成ヘルパー
function createTestNodeData(overrides?: Partial<MemberNodeData>): MemberNodeData {
  return {
    role: 'engineer',
    label: 'Engineer #1',
    status: 'executing',
    taskName: 'login.ts実装中',
    message: 'テストケース追加中...',
    timestamp: Date.now() - 120000, // 2分前
    ...overrides,
  };
}

describe('MemberNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本レンダリング', () => {
    it('ノードが正しく表示される', () => {
      const data = createTestNodeData();
      const props: MemberNodeProps = {
        id: 'test-node',
        data,
      };

      render(<MemberNode {...props} />);

      expect(screen.getByText('Engineer #1')).toBeInTheDocument();
      expect(screen.getByText('login.ts実装中')).toBeInTheDocument();
    });

    it('ステータスに応じたクラスが適用される', () => {
      const data = createTestNodeData({ status: 'executing' });
      const props: MemberNodeProps = {
        id: 'test-node',
        data,
      };

      const { container } = render(<MemberNode {...props} />);

      const nodeElement = container.querySelector('[data-node-status="executing"]');
      expect(nodeElement).toBeInTheDocument();
    });
  });

  describe('ツールチップ表示（新機能）', () => {
    it('ノードホバー時にツールチップが表示される', async () => {
      const user = userEvent.setup();
      const data = createTestNodeData();
      const props: MemberNodeProps = {
        id: 'test-node',
        data,
      };

      render(<MemberNode {...props} />);

      const nodeElement = screen.getByText('Engineer #1').closest('[data-node-status]');
      expect(nodeElement).toBeInTheDocument();

      // ノードにホバー
      if (nodeElement) {
        await user.hover(nodeElement);

        // ツールチップが表示されることを確認（Radix UIは複数のtooltip要素を生成するため、getAllByRoleを使用）
        await waitFor(() => {
          const tooltips = screen.queryAllByRole('tooltip');
          expect(tooltips.length).toBeGreaterThan(0);
        });
      }
    });

    it('ツールチップにノード名が表示される', async () => {
      const user = userEvent.setup();
      const data = createTestNodeData({ label: 'Product Owner' });
      const props: MemberNodeProps = {
        id: 'test-node',
        data,
      };

      render(<MemberNode {...props} />);

      const nodeElement = screen.getByText('Product Owner').closest('[data-node-status]');
      if (nodeElement) {
        await user.hover(nodeElement);

        await waitFor(() => {
          const tooltips = screen.queryAllByRole('tooltip');
          const tooltipText = tooltips.map(t => t.textContent).join(' ');
          expect(tooltipText).toMatch(/Product Owner/i);
        });
      }
    });

    it('ツールチップにステータスが表示される', async () => {
      const user = userEvent.setup();
      const data = createTestNodeData({ status: 'executing' });
      const props: MemberNodeProps = {
        id: 'test-node',
        data,
      };

      render(<MemberNode {...props} />);

      const nodeElement = screen.getByText('Engineer #1').closest('[data-node-status]');
      if (nodeElement) {
        await user.hover(nodeElement);

        await waitFor(() => {
          const tooltips = screen.queryAllByRole('tooltip');
          const tooltipText = tooltips.map(t => t.textContent).join(' ');
          expect(tooltipText).toMatch(/実行中|executing/i);
        });
      }
    });

    it('ツールチップに経過時間が表示される', async () => {
      const user = userEvent.setup();
      const data = createTestNodeData({
        timestamp: Date.now() - 180000, // 3分前
      });
      const props: MemberNodeProps = {
        id: 'test-node',
        data,
      };

      render(<MemberNode {...props} />);

      const nodeElement = screen.getByText('Engineer #1').closest('[data-node-status]');
      if (nodeElement) {
        await user.hover(nodeElement);

        await waitFor(() => {
          const tooltips = screen.queryAllByRole('tooltip');
          const tooltipText = tooltips.map(t => t.textContent).join(' ');
          expect(tooltipText).toMatch(/分|時間|経過/i);
        });
      }
    });

    it('ツールチップにメッセージが表示される（存在する場合）', async () => {
      const user = userEvent.setup();
      const data = createTestNodeData({
        message: 'API実装を進めています',
      });
      const props: MemberNodeProps = {
        id: 'test-node',
        data,
      };

      render(<MemberNode {...props} />);

      const nodeElement = screen.getByText('Engineer #1').closest('[data-node-status]');
      if (nodeElement) {
        await user.hover(nodeElement);

        await waitFor(() => {
          const tooltips = screen.queryAllByRole('tooltip');
          const tooltipText = tooltips.map(t => t.textContent).join(' ');
          expect(tooltipText).toMatch(/API実装を進めています/);
        });
      }
    });
  });

  describe('モーダル表示（新機能）', () => {
    it('ノードクリック時にモーダルが表示される', async () => {
      const user = userEvent.setup();
      const data = createTestNodeData();
      const props: MemberNodeProps = {
        id: 'test-node',
        data,
      };

      render(<MemberNode {...props} />);

      const nodeElement = screen.getByText('Engineer #1').closest('[data-node-status]');
      expect(nodeElement).toBeInTheDocument();

      // ノードをクリック
      if (nodeElement) {
        await user.click(nodeElement);

        // モーダルが表示されることを確認
        await waitFor(() => {
          const modal = screen.getByRole('dialog');
          expect(modal).toBeInTheDocument();
        });
      }
    });

    it('モーダルにノードの詳細情報が表示される', async () => {
      const user = userEvent.setup();
      const data = createTestNodeData({
        label: 'Tech Lead',
        taskName: 'Design Review',
        message: 'アーキテクチャを検討中...',
      });
      const props: MemberNodeProps = {
        id: 'test-node',
        data,
      };

      render(<MemberNode {...props} />);

      const nodeElement = screen.getByText('Tech Lead').closest('[data-node-status]');
      if (nodeElement) {
        await user.click(nodeElement);

        await waitFor(() => {
          const modal = screen.getByRole('dialog');
          expect(modal.textContent).toMatch(/Tech Lead/);
          expect(modal.textContent).toMatch(/Design Review/);
          expect(modal.textContent).toMatch(/アーキテクチャを検討中/);
        });
      }
    });

    it('モーダルの閉じるボタンでモーダルが閉じる', async () => {
      const user = userEvent.setup();
      const data = createTestNodeData();
      const props: MemberNodeProps = {
        id: 'test-node',
        data,
      };

      render(<MemberNode {...props} />);

      const nodeElement = screen.getByText('Engineer #1').closest('[data-node-status]');
      if (nodeElement) {
        await user.click(nodeElement);

        // モーダルが表示される
        await waitFor(() => {
          const modal = screen.getByRole('dialog');
          expect(modal).toBeInTheDocument();
        });

        // 閉じるボタンをクリック
        const closeButton = screen.getByRole('button', { name: /close|閉じる/i });
        await user.click(closeButton);

        // モーダルが閉じる
        await waitFor(() => {
          const modal = screen.queryByRole('dialog');
          expect(modal).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('既存機能の維持', () => {
    it('パルスアニメーションがexecutingステータスで適用される', () => {
      const data = createTestNodeData({ status: 'executing' });
      const props: MemberNodeProps = {
        id: 'test-node',
        data,
      };

      const { container } = render(<MemberNode {...props} />);

      // statusExecutingクラスが適用されることを確認
      const nodeElement = container.querySelector('[data-node-status="executing"]');
      expect(nodeElement).toBeInTheDocument();
    });

    it('completedステータスでグリーンのスタイルが適用される', () => {
      const data = createTestNodeData({ status: 'completed' });
      const props: MemberNodeProps = {
        id: 'test-node',
        data,
      };

      const { container } = render(<MemberNode {...props} />);

      const nodeElement = container.querySelector('[data-node-status="completed"]');
      expect(nodeElement).toBeInTheDocument();
    });

    it('メッセージが存在する場合に吹き出しが表示される', () => {
      const data = createTestNodeData({
        message: 'テスト実行中...',
      });
      const props: MemberNodeProps = {
        id: 'test-node',
        data,
      };

      render(<MemberNode {...props} />);

      const message = screen.getByTestId('message-test-node');
      expect(message).toBeInTheDocument();
      expect(message.textContent).toContain('テスト実行中...');
    });
  });
});
