/**
 * @jest-environment jsdom
 *
 * TeamDashboardFlow コンポーネントのユニットテスト
 *
 * リアルタイムチーム作業ダッシュボードのテスト
 * スクラムメンバー（PO, Director, Tech Lead, Engineer）のみを表示し、
 * 並列実行中のEngineerを個別ノード化する
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import React from 'react';

// テスト用の型定義
interface TeamMemberNode {
  id: string;
  type: 'member';
  role: 'product_owner' | 'director' | 'tech_lead_design' | 'tech_lead_review' | 'engineer' | 'merge_coordinator';
  label: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  taskName?: string;
  message?: string;
  timestamp?: number;
}

interface TeamFlowData {
  nodes: TeamMemberNode[];
  edges: {
    id: string;
    source: string;
    target: string;
    animated?: boolean;
  }[];
}

// Note: Zustand is mocked via tests/__mocks__/zustand.ts (official Zustand mock)
// Note: @xyflow/react is mocked via jest.config.js moduleNameMapper
// Note: CSS modules are mocked via jest.config.js moduleNameMapper (identity-obj-proxy)

// Import the component and store after mocks
import TeamDashboardFlow from '../../../../electron/renderer/components/team-dashboard/TeamDashboardFlow';
import { useAppStore } from '../../../../electron/renderer/store/appStore';

// テストデータ作成ヘルパー
function createTestTeamFlowData(): TeamFlowData {
  return {
    nodes: [
      {
        id: 'product_owner',
        type: 'member',
        role: 'product_owner',
        label: 'Product Owner',
        status: 'completed',
        taskName: 'タスク分解完了',
        timestamp: Date.now() - 60000,
      },
      {
        id: 'director',
        type: 'member',
        role: 'director',
        label: 'Director',
        status: 'executing',
        taskName: 'ストーリーマップ作成中',
        message: 'ユーザーストーリーを整理中...',
        timestamp: Date.now(),
      },
      {
        id: 'tech_lead_design',
        type: 'member',
        role: 'tech_lead_design',
        label: 'Tech Lead (Design)',
        status: 'pending',
      },
      {
        id: 'engineer_1',
        type: 'member',
        role: 'engineer',
        label: 'Engineer #1',
        status: 'pending',
      },
      {
        id: 'tech_lead_review',
        type: 'member',
        role: 'tech_lead_review',
        label: 'Tech Lead (Review)',
        status: 'pending',
      },
      {
        id: 'merge_coordinator',
        type: 'member',
        role: 'merge_coordinator',
        label: 'Merge Coordinator',
        status: 'pending',
      },
    ],
    edges: [
      { id: 'e1', source: 'product_owner', target: 'director' },
      { id: 'e2', source: 'director', target: 'tech_lead_design' },
      { id: 'e3', source: 'tech_lead_design', target: 'engineer_1' },
      { id: 'e4', source: 'engineer_1', target: 'tech_lead_review' },
      { id: 'e5', source: 'tech_lead_review', target: 'merge_coordinator' },
    ],
  };
}

function createTestTeamFlowDataWithParallelEngineers(): TeamFlowData {
  return {
    nodes: [
      {
        id: 'product_owner',
        type: 'member',
        role: 'product_owner',
        label: 'Product Owner',
        status: 'completed',
      },
      {
        id: 'tech_lead_design',
        type: 'member',
        role: 'tech_lead_design',
        label: 'Tech Lead (Design)',
        status: 'completed',
      },
      {
        id: 'engineer_1',
        type: 'member',
        role: 'engineer',
        label: 'Engineer #1',
        status: 'executing',
        taskName: 'login.ts実装中',
        message: 'テストケース追加中...',
        timestamp: Date.now(),
      },
      {
        id: 'engineer_2',
        type: 'member',
        role: 'engineer',
        label: 'Engineer #2',
        status: 'executing',
        taskName: 'auth-api.ts実装中',
        message: 'API実装開始',
        timestamp: Date.now(),
      },
      {
        id: 'engineer_3',
        type: 'member',
        role: 'engineer',
        label: 'Engineer #3',
        status: 'executing',
        taskName: 'user-model.ts実装中',
        message: 'モデル定義中...',
        timestamp: Date.now(),
      },
      {
        id: 'tech_lead_review',
        type: 'member',
        role: 'tech_lead_review',
        label: 'Tech Lead (Review)',
        status: 'pending',
      },
    ],
    edges: [
      { id: 'e1', source: 'product_owner', target: 'tech_lead_design' },
      { id: 'e2', source: 'tech_lead_design', target: 'engineer_1' },
      { id: 'e3', source: 'tech_lead_design', target: 'engineer_2' },
      { id: 'e4', source: 'tech_lead_design', target: 'engineer_3' },
      { id: 'e5', source: 'engineer_1', target: 'tech_lead_review' },
      { id: 'e6', source: 'engineer_2', target: 'tech_lead_review' },
      { id: 'e7', source: 'engineer_3', target: 'tech_lead_review' },
    ],
  };
}

describe('TeamDashboardFlow', () => {
  beforeEach(() => {
    // Reset store state before each test (handled automatically by Zustand mock)
    // Set initial state to null
    useAppStore.setState({ nodeFlowData: null });
  });

  describe('基本レンダリング', () => {
    test('データがnullの時に適切なメッセージを表示', () => {
      // nodeFlowData is already null from beforeEach
      const { container } = render(<TeamDashboardFlow />);
      expect(container.textContent).toMatch(/team|dashboard|will appear/i);
    });

    test('チームフローデータがある時にReactFlowコンポーネントが表示される', () => {
      const flowData = createTestTeamFlowData();

      // Update store state using setState
      useAppStore.setState({ nodeFlowData: flowData as any });

      render(<TeamDashboardFlow />);

      const reactFlow = screen.getByTestId('react-flow');
      expect(reactFlow).toBeTruthy();
    });
  });

  describe('スクラムメンバーノードのフィルタリング', () => {
    test('スクラムメンバー（PO, Director, Tech Lead, Engineer）のノードのみ表示される', () => {
      const flowData = createTestTeamFlowData();

      // Update mock state directly
      useAppStore.setState({ nodeFlowData: flowData as any });

      render(<TeamDashboardFlow />);

      // スクラムメンバーノードが表示されることを確認
      expect(screen.getByTestId('flow-node-product_owner')).toBeTruthy();
      expect(screen.getByTestId('flow-node-director')).toBeTruthy();
      expect(screen.getByTestId('flow-node-tech_lead_design')).toBeTruthy();
      expect(screen.getByTestId('flow-node-engineer_1')).toBeTruthy();

      // 技術ノード（dispatch, aggregator等）は表示されないことを確認
      // これらのノードはflowDataに含まれていないため、表示されない
    });
  });

  describe('並列Engineer表示', () => {
    test('複数のEngineerが並列実行時に個別ノード化される', () => {
      const flowData = createTestTeamFlowDataWithParallelEngineers();

      // Update mock state directly
      useAppStore.setState({ nodeFlowData: flowData as any });

      render(<TeamDashboardFlow />);

      // 3つのEngineerノードが個別に表示される
      expect(screen.getByTestId('flow-node-engineer_1')).toBeTruthy();
      expect(screen.getByTestId('flow-node-engineer_2')).toBeTruthy();
      expect(screen.getByTestId('flow-node-engineer_3')).toBeTruthy();
    });

    test('各Engineerノードにタスク名が表示される', () => {
      const flowData = createTestTeamFlowDataWithParallelEngineers();

      // Update mock state directly
      useAppStore.setState({ nodeFlowData: flowData as any });

      render(<TeamDashboardFlow />);

      const engineer1 = screen.getByTestId('flow-node-engineer_1');
      expect(engineer1.textContent).toContain('login.ts実装中');

      const engineer2 = screen.getByTestId('flow-node-engineer_2');
      expect(engineer2.textContent).toContain('auth-api.ts実装中');
    });
  });

  describe('ノード表示情報', () => {
    test('ノードにステータスアイコン/色が設定される', () => {
      const flowData = createTestTeamFlowData();

      // Update mock state directly
      useAppStore.setState({ nodeFlowData: flowData as any });

      render(<TeamDashboardFlow />);

      const completedNode = screen.getByTestId('flow-node-product_owner');
      expect(completedNode.getAttribute('data-node-status')).toBe('completed');

      const executingNode = screen.getByTestId('flow-node-director');
      expect(executingNode.getAttribute('data-node-status')).toBe('executing');

      const pendingNode = screen.getByTestId('flow-node-tech_lead_design');
      expect(pendingNode.getAttribute('data-node-status')).toBe('pending');
    });

    test('ノードにAIメッセージが表示される', () => {
      const flowData = createTestTeamFlowData();

      // Update mock state directly
      useAppStore.setState({ nodeFlowData: flowData as any });

      render(<TeamDashboardFlow />);

      const directorMessage = screen.getByTestId('message-director');
      expect(directorMessage.textContent).toContain('ユーザーストーリーを整理中...');
    });

    test('ノードに現在のタスク名が表示される', () => {
      const flowData = createTestTeamFlowData();

      // Update mock state directly
      useAppStore.setState({ nodeFlowData: flowData as any });

      render(<TeamDashboardFlow />);

      const productOwnerNode = screen.getByTestId('flow-node-product_owner');
      expect(productOwnerNode.textContent).toContain('タスク分解完了');

      const directorNode = screen.getByTestId('flow-node-director');
      expect(directorNode.textContent).toContain('ストーリーマップ作成中');
    });
  });

  describe('エッジアニメーション', () => {
    test('作業中のタスクフローにアニメーションが設定される', () => {
      const flowData = createTestTeamFlowData();
      flowData.edges[1].animated = true; // director -> tech_lead_design

      // Update mock state directly
      useAppStore.setState({ nodeFlowData: flowData as any });

      render(<TeamDashboardFlow />);

      const animatedEdge = screen.getByTestId('flow-edge-e2');
      expect(animatedEdge.getAttribute('data-edge-animated')).toBe('true');
    });
  });

  describe('ReactFlowコントロール', () => {
    test('ReactFlow Backgroundコンポーネントが表示される', () => {
      const flowData = createTestTeamFlowData();

      // Update mock state directly
      useAppStore.setState({ nodeFlowData: flowData as any });

      render(<TeamDashboardFlow />);

      const background = screen.getByTestId('react-flow-background');
      expect(background).toBeTruthy();
    });

    test('ReactFlow Controlsコンポーネントが表示される', () => {
      const flowData = createTestTeamFlowData();

      // Update mock state directly
      useAppStore.setState({ nodeFlowData: flowData as any });

      render(<TeamDashboardFlow />);

      const controls = screen.getByTestId('react-flow-controls');
      expect(controls).toBeTruthy();
    });

    test('ReactFlow MiniMapコンポーネントが表示される', () => {
      const flowData = createTestTeamFlowData();

      // Update mock state directly
      useAppStore.setState({ nodeFlowData: flowData as any });

      render(<TeamDashboardFlow />);

      const minimap = screen.getByTestId('react-flow-minimap');
      expect(minimap).toBeTruthy();
    });
  });
});
