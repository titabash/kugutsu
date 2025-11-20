/**
 * Node Name Mapper
 *
 * LangGraphノード名（小文字_区切り）とUI用ノード名（PascalCase）の相互変換ユーティリティ
 * AIエージェント実行状況の整合性を保証するための統一マッピング定義
 */

/**
 * LangGraphノード名からUI用ノード名へのマッピング
 * LangGraph: 小文字_区切り（例: product_owner）
 * UI: PascalCase + "Node"接尾辞（例: ProductOwnerNode）
 */
const LANGGRAPH_TO_UI_MAP: Record<string, string> = {
  // 分析・計画フェーズ
  analyze_complexity: 'AnalyzeComplexityNode',
  check_mode: 'CheckModeNode',

  // Scrum開発フロー（高複雑度パス）
  director_ai: 'DirectorNode',
  review_story_mapping: 'ReviewStoryMappingNode',
  tech_lead_design: 'TechLeadDesignNode',
  review_design: 'ReviewDesignNode',
  task_breakdown: 'TaskBreakdownNode',

  // 通常開発フロー（低複雑度パス）
  product_owner: 'ProductOwnerNode',

  // Sprint実行フロー
  sprint_planning: 'SprintPlanningNode',
  sprint_review: 'SprintReviewNode',

  // Instruction生成フロー
  instruction_generator_dispatch: 'InstructionGeneratorDispatchNode',
  instruction_generator: 'InstructionGeneratorNode',
  instruction_aggregator: 'InstructionAggregatorNode',

  // 実装・レビュー・マージフロー
  engineer_dispatch: 'EngineerDispatchNode',
  engineer: 'EngineerNode',
  engineer_aggregator: 'EngineerAggregatorNode',
  review_dispatch: 'ReviewDispatchNode',
  review: 'ReviewNode',
  review_aggregator: 'ReviewAggregatorNode',
  merge_coordinator: 'MergeCoordinatorNode',
  conflict_resolver: 'ConflictResolverNode',

  // 特殊ノード
  __start__: '__start__',
  __end__: '__end__',
};

/**
 * UI用ノード名からLangGraphノード名へのマッピング（逆引き）
 */
const UI_TO_LANGGRAPH_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(LANGGRAPH_TO_UI_MAP).map(([langGraph, ui]) => [ui, langGraph])
);

/**
 * ノード名マッパークラス
 */
export class NodeNameMapper {
  /**
   * LangGraphノード名をUI用ノード名に変換
   *
   * @param langGraphName - LangGraphノード名（小文字_区切り）
   * @returns UI用ノード名（PascalCase + Node接尾辞）
   *
   * @example
   * nodeNameMapper.langGraphToUI('product_owner') // => 'ProductOwnerNode'
   * nodeNameMapper.langGraphToUI('engineer') // => 'EngineerNode'
   */
  langGraphToUI(langGraphName: string): string {
    const uiName = LANGGRAPH_TO_UI_MAP[langGraphName];

    if (!uiName) {
      console.warn(
        `[NodeNameMapper] Unknown LangGraph node name: "${langGraphName}". Returning as-is.`
      );
      return langGraphName;
    }

    return uiName;
  }

  /**
   * UI用ノード名をLangGraphノード名に変換
   *
   * @param uiName - UI用ノード名（PascalCase + Node接尾辞）
   * @returns LangGraphノード名（小文字_区切り）
   *
   * @example
   * nodeNameMapper.uiToLangGraph('ProductOwnerNode') // => 'product_owner'
   * nodeNameMapper.uiToLangGraph('EngineerNode') // => 'engineer'
   */
  uiToLangGraph(uiName: string): string {
    const langGraphName = UI_TO_LANGGRAPH_MAP[uiName];

    if (!langGraphName) {
      console.warn(
        `[NodeNameMapper] Unknown UI node name: "${uiName}". Returning as-is.`
      );
      return uiName;
    }

    return langGraphName;
  }

  /**
   * ノード名が有効なLangGraphノード名かを判定
   *
   * @param name - 判定するノード名
   * @returns 有効なLangGraphノード名の場合true
   */
  isValidLangGraphNode(name: string): boolean {
    return name in LANGGRAPH_TO_UI_MAP;
  }

  /**
   * ノード名が有効なUI用ノード名かを判定
   *
   * @param name - 判定するノード名
   * @returns 有効なUI用ノード名の場合true
   */
  isValidUINode(name: string): boolean {
    return name in UI_TO_LANGGRAPH_MAP;
  }

  /**
   * すべてのLangGraphノード名を取得
   */
  getAllLangGraphNodes(): string[] {
    return Object.keys(LANGGRAPH_TO_UI_MAP);
  }

  /**
   * すべてのUI用ノード名を取得
   */
  getAllUINodes(): string[] {
    return Object.keys(UI_TO_LANGGRAPH_MAP);
  }

  /**
   * マッピング情報をデバッグ出力
   */
  debugPrintMapping(): void {
    console.log('='.repeat(70));
    console.log('Node Name Mapping:');
    console.log('='.repeat(70));
    console.log('LangGraph -> UI:');
    Object.entries(LANGGRAPH_TO_UI_MAP).forEach(([langGraph, ui]) => {
      console.log(`  ${langGraph.padEnd(35)} => ${ui}`);
    });
    console.log('='.repeat(70));
  }
}

/**
 * シングルトンインスタンス
 */
export const nodeNameMapper = new NodeNameMapper();

/**
 * デフォルトエクスポート
 */
export default nodeNameMapper;
