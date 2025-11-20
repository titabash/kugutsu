/**
 * Node Name Mapping Tests
 *
 * ノード名マッピングの整合性をテスト
 * LangGraphノード名（小文字_区切り）とUI用ノード名（PascalCase）の相互変換を検証
 */

import { nodeNameMapper } from '../../src/utils/NodeNameMapper.js';

/**
 * LangGraphで定義されているノード名の一覧
 * src/graph/ParallelDevGraph.ts から抽出
 */
const LANGGRAPH_NODES = [
  'analyze_complexity',
  'director_ai',
  'review_story_mapping',
  'tech_lead_design',
  'review_design',
  'task_breakdown',
  'product_owner',
  'check_mode',
  'sprint_planning',
  'instruction_generator_dispatch',
  'instruction_generator',
  'instruction_aggregator',
  'engineer_dispatch',
  'engineer',
  'engineer_aggregator',
  'review_dispatch',
  'review',
  'review_aggregator',
  'merge_coordinator',
  'conflict_resolver',
  'sprint_review',
] as const;

/**
 * UI側で期待されるノード名（現在の実装）
 * electron/renderer/hooks/useElectronSync.ts の IMPORTANT_NODES から抽出
 */
const EXPECTED_UI_NODES = {
  ProductOwnerNode: 'product_owner',
  EngineerNode: 'engineer',
  ReviewNode: 'review',
  DirectorNode: 'director_ai',
  SprintPlanningNode: 'sprint_planning',
  MergeCoordinatorNode: 'merge_coordinator',
  TechLeadDesignNode: 'tech_lead_design',
  AnalyzeComplexityNode: 'analyze_complexity',
  TaskBreakdownNode: 'task_breakdown',
  ConflictResolverNode: 'conflict_resolver',
  SprintReviewNode: 'sprint_review',
} as const;

describe('NodeNameMapper', () => {
  it('should convert LangGraph node names to UI node names', () => {
    // 期待される変換のテスト
    const testCases = [
      { langGraph: 'product_owner', expected: 'ProductOwnerNode' },
      { langGraph: 'engineer', expected: 'EngineerNode' },
      { langGraph: 'review', expected: 'ReviewNode' },
      { langGraph: 'director_ai', expected: 'DirectorNode' },
      { langGraph: 'sprint_planning', expected: 'SprintPlanningNode' },
      { langGraph: 'merge_coordinator', expected: 'MergeCoordinatorNode' },
      { langGraph: 'tech_lead_design', expected: 'TechLeadDesignNode' },
      { langGraph: 'analyze_complexity', expected: 'AnalyzeComplexityNode' },
      { langGraph: 'task_breakdown', expected: 'TaskBreakdownNode' },
      { langGraph: 'conflict_resolver', expected: 'ConflictResolverNode' },
      { langGraph: 'sprint_review', expected: 'SprintReviewNode' },
    ];

    testCases.forEach(({ langGraph, expected }) => {
      expect(nodeNameMapper.langGraphToUI(langGraph)).toBe(expected);
    });
  });

  it('should convert UI node names to LangGraph node names', () => {
    // 逆変換のテスト
    const testCases = [
      { ui: 'ProductOwnerNode', expected: 'product_owner' },
      { ui: 'EngineerNode', expected: 'engineer' },
      { ui: 'ReviewNode', expected: 'review' },
      { ui: 'DirectorNode', expected: 'director_ai' },
      { ui: 'SprintPlanningNode', expected: 'sprint_planning' },
      { ui: 'MergeCoordinatorNode', expected: 'merge_coordinator' },
      { ui: 'TechLeadDesignNode', expected: 'tech_lead_design' },
    ];

    testCases.forEach(({ ui, expected }) => {
      expect(nodeNameMapper.uiToLangGraph(ui)).toBe(expected);
    });
  });

  it('should validate LangGraph node names', () => {
    // 有効なノード名
    LANGGRAPH_NODES.forEach((node) => {
      expect(nodeNameMapper.isValidLangGraphNode(node)).toBe(true);
    });

    // 無効なノード名
    expect(nodeNameMapper.isValidLangGraphNode('invalid_node')).toBe(false);
    expect(nodeNameMapper.isValidLangGraphNode('EngineerNode')).toBe(false);
  });

  it('should validate UI node names', () => {
    // 有効なノード名
    Object.keys(EXPECTED_UI_NODES).forEach((node) => {
      expect(nodeNameMapper.isValidUINode(node)).toBe(true);
    });

    // 無効なノード名
    expect(nodeNameMapper.isValidUINode('InvalidNode')).toBe(false);
    expect(nodeNameMapper.isValidUINode('engineer')).toBe(false);
  });

  it('should handle bidirectional conversion correctly', () => {
    // 双方向変換のテスト（往復変換で元に戻る）
    LANGGRAPH_NODES.forEach((langGraphNode) => {
      const uiNode = nodeNameMapper.langGraphToUI(langGraphNode);
      const backToLangGraph = nodeNameMapper.uiToLangGraph(uiNode);
      expect(backToLangGraph).toBe(langGraphNode);
    });
  });

  it('should handle all LangGraph nodes', () => {
    // すべてのLangGraphノードがマッピングされていることを確認
    const unmappedNodes = LANGGRAPH_NODES.filter((node) => {
      const uiName = nodeNameMapper.langGraphToUI(node);
      return !nodeNameMapper.isValidUINode(uiName);
    });
    expect(unmappedNodes).toHaveLength(0);
  });
});
