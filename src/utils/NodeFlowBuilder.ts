/**
 * Node Flow Builder
 *
 * LangGraphのワークフロー定義からノードフロー情報を生成
 */

import type { NodeFlowData, FlowNode, FlowEdge } from '../electron/StateStreamManager.js';

/**
 * Unified Scrum Workflow のノードフロー情報を生成
 */
export function buildUnifiedScrumWorkflowFlow(): NodeFlowData {
  const nodes: FlowNode[] = [
    // エントリーポイント
    { id: '__start__', type: 'start', label: '開始', status: 'pending' },

    // フェーズ1: 複雑度分析とモード判定
    {
      id: 'analyze_complexity',
      type: 'process',
      label: '複雑度分析',
      status: 'pending',
    },
    {
      id: 'check_mode',
      type: 'process',
      label: 'リポジトリ初期化',
      status: 'pending',
    },

    // フェーズ2a: 高複雑度パス（Scrum開発）
    {
      id: 'director_ai',
      type: 'process',
      label: 'ストーリーマップ作成',
      status: 'pending',
    },
    {
      id: 'review_story_mapping',
      type: 'decision',
      label: 'ストーリーマップレビュー',
      status: 'pending',
    },
    {
      id: 'tech_lead_design',
      type: 'process',
      label: '詳細設計作成',
      status: 'pending',
    },
    {
      id: 'review_design',
      type: 'decision',
      label: '設計レビュー',
      status: 'pending',
    },
    {
      id: 'task_breakdown',
      type: 'process',
      label: 'タスク分解',
      status: 'pending',
    },

    // フェーズ2b: 低複雑度パス（通常開発）
    {
      id: 'product_owner',
      type: 'process',
      label: 'Product Backlog生成',
      status: 'pending',
    },

    // フェーズ3: Sprint実行
    {
      id: 'sprint_planning',
      type: 'process',
      label: 'スプリント計画',
      status: 'pending',
    },
    {
      id: 'instruction_generator_dispatch',
      type: 'process',
      label: 'Instruction生成ディスパッチ',
      status: 'pending',
    },
    {
      id: 'instruction_generator',
      type: 'process',
      label: 'Instruction生成（並列）',
      status: 'pending',
    },
    {
      id: 'instruction_aggregator',
      type: 'process',
      label: 'Instruction集約',
      status: 'pending',
    },

    // フェーズ4: 実装・レビュー・マージ
    {
      id: 'engineer_dispatch',
      type: 'process',
      label: 'エンジニアディスパッチ',
      status: 'pending',
    },
    {
      id: 'engineer',
      type: 'process',
      label: 'コード実装（並列）',
      status: 'pending',
    },
    {
      id: 'engineer_aggregator',
      type: 'process',
      label: 'エンジニア集約',
      status: 'pending',
    },
    {
      id: 'review_dispatch',
      type: 'process',
      label: 'レビューディスパッチ',
      status: 'pending',
    },
    {
      id: 'review',
      type: 'process',
      label: 'コードレビュー（並列）',
      status: 'pending',
    },
    {
      id: 'review_aggregator',
      type: 'decision',
      label: 'レビュー集約',
      status: 'pending',
    },
    {
      id: 'merge_coordinator',
      type: 'process',
      label: 'マージ調整',
      status: 'pending',
    },
    {
      id: 'conflict_resolver',
      type: 'process',
      label: '紛争解決',
      status: 'pending',
    },

    // フェーズ5: スプリントレビュー
    {
      id: 'sprint_review',
      type: 'decision',
      label: 'スプリントレビュー',
      status: 'pending',
    },

    // 終了
    { id: '__end__', type: 'end', label: '完了', status: 'pending' },
  ];

  const edges: FlowEdge[] = [
    // エントリーポイント
    { id: 'e1', source: '__start__', target: 'analyze_complexity' },

    // 複雑度分析 → チェックモード
    { id: 'e2', source: 'analyze_complexity', target: 'check_mode' },

    // 高複雑度パス（requiresDetailedDesign=true）
    { id: 'e3', source: 'check_mode', target: 'director_ai', condition: '高複雑度' },
    { id: 'e4', source: 'director_ai', target: 'review_story_mapping' },
    {
      id: 'e5',
      source: 'review_story_mapping',
      target: 'tech_lead_design',
      label: '承認',
    },
    {
      id: 'e6',
      source: 'review_story_mapping',
      target: 'director_ai',
      label: '修正要求',
    },
    { id: 'e7', source: 'tech_lead_design', target: 'review_design' },
    {
      id: 'e8',
      source: 'review_design',
      target: 'task_breakdown',
      label: '承認',
    },
    {
      id: 'e9',
      source: 'review_design',
      target: 'tech_lead_design',
      label: '修正要求',
    },
    { id: 'e10', source: 'task_breakdown', target: 'sprint_planning' },

    // 低複雑度パス（requiresDetailedDesign=false）
    {
      id: 'e11',
      source: 'check_mode',
      target: 'product_owner',
      condition: '低複雑度',
    },
    { id: 'e12', source: 'product_owner', target: 'sprint_planning' },

    // Sprint実行フロー
    { id: 'e13', source: 'sprint_planning', target: 'instruction_generator_dispatch' },
    {
      id: 'e14',
      source: 'instruction_generator_dispatch',
      target: 'instruction_generator',
    },
    { id: 'e15', source: 'instruction_generator', target: 'instruction_aggregator' },
    {
      id: 'e16',
      source: 'instruction_aggregator',
      target: 'instruction_generator_dispatch',
      label: '未生成タスク有',
    },
    {
      id: 'e17',
      source: 'instruction_aggregator',
      target: 'engineer_dispatch',
      label: '全生成完了',
    },

    // 実装・レビュー・マージフロー
    { id: 'e18', source: 'engineer_dispatch', target: 'engineer' },
    { id: 'e19', source: 'engineer', target: 'engineer_aggregator' },
    { id: 'e20', source: 'engineer_aggregator', target: 'review_dispatch' },
    { id: 'e21', source: 'review_dispatch', target: 'review' },
    { id: 'e22', source: 'review', target: 'review_aggregator' },
    {
      id: 'e23',
      source: 'review_aggregator',
      target: 'engineer',
      label: '修正要求',
    },
    {
      id: 'e24',
      source: 'review_aggregator',
      target: 'engineer_dispatch',
      label: '次のタスク',
    },
    {
      id: 'e25',
      source: 'review_aggregator',
      target: 'merge_coordinator',
      label: 'マージ準備完了',
    },

    // マージ・紛争解決
    {
      id: 'e26',
      source: 'merge_coordinator',
      target: 'conflict_resolver',
      label: '紛争検出',
    },
    { id: 'e27', source: 'conflict_resolver', target: 'merge_coordinator' },
    {
      id: 'e28',
      source: 'merge_coordinator',
      target: 'engineer_dispatch',
      label: '次のタスク',
    },
    {
      id: 'e29',
      source: 'merge_coordinator',
      target: 'sprint_review',
      label: '全タスク完了',
    },

    // スプリントレビュー
    {
      id: 'e30',
      source: 'sprint_review',
      target: 'sprint_planning',
      label: '次スプリント',
    },
    { id: 'e31', source: 'sprint_review', target: '__end__', label: '全完了' },
  ];

  return { nodes, edges };
}

/**
 * ノードフロー情報の複製を作成
 */
export function cloneNodeFlowData(flowData: NodeFlowData): NodeFlowData {
  return {
    nodes: flowData.nodes.map((node) => ({ ...node })),
    edges: flowData.edges.map((edge) => ({ ...edge })),
  };
}

/**
 * ノード状態をリセット（全てpendingに戻す）
 */
export function resetNodeFlow(flowData: NodeFlowData): NodeFlowData {
  const reset = cloneNodeFlowData(flowData);
  reset.nodes.forEach((node) => {
    if (node.id !== '__start__') {
      node.status = 'pending';
      delete node.startedAt;
      delete node.completedAt;
      delete node.executionTime;
    }
  });
  return reset;
}
