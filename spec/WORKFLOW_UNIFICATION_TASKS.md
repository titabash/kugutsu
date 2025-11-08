# Workflow Unification Task List

**プロジェクト**: Kugutsu 2.0 - AI Parallel Development System
**バージョン**: 2.0.0
**最終更新**: 2025-01-09
**目的**: AI完全自律スクラムワークフローの実現
**ステータス**: In Progress

---

## タスク分類

- 🟢 **未着手** (Not Started)
- 🟡 **進行中** (In Progress)
- 🔵 **完了** (Completed)
- 🔴 **ブロック** (Blocked)

---

## 進捗サマリー

| Phase | タスク数 | 完了 | 進捗率 | 見積時間 | 備考 |
|-------|---------|------|--------|---------|------|
| Phase 0 | 4 | 4 | 100% | 3h | ドキュメント整備（完了） |
| Phase 1 | 4 | 0 | 0% | 2h | 設計・分析 |
| Phase 2 | 5 | 0 | 0% | 3.5h | 型定義の整理 |
| Phase 3 | 4 | 0 | 0% | 4h | 要求複雑度判定ノード |
| Phase 4 | 8 | 0 | 0% | 12h | 単一グラフの構築 |
| Phase 5 | 3 | 0 | 0% | 3h | Orchestrator修正 |
| Phase 6 | 2 | 0 | 0% | 2h | CLI/設定の修正 |
| Phase 7 | 2 | 0 | 0% | 1h | 旧コードの削除 |
| Phase 8 | 6 | 0 | 0% | 6h | テスト修正 |
| Phase 9 | 4 | 0 | 0% | 3h | ドキュメント更新 |
| Phase 10 | 2 | 0 | 0% | 8h | AI学習機能追加（バックログ改善、振り返り） |
| **合計** | **43** | **4** | **9.3%** | **47.5h** | - |

**推奨バッファ**: +25% → **合計59時間**

---

## Phase 0: ドキュメント整備 (3h) ✅ 完了

### 目的
実装とドキュメントの整合性確保、AI完全自律への最適化

### タスク

- 🔵 **Task 0.1**: UNIFIED_SCRUM_WORKFLOW_SPECIFICATION.md - AI完全自律の明記
  - 内容:
    - 設計原則にAI完全自律を第1原則として追加
    - スプリント駆動の説明を「グローバルキューで管理」に修正
  - 見積: 15分
  - 依存: なし
  - 成果物: 更新された設計原則
  - **ステータス**: ✅ 完了

- 🔵 **Task 0.2**: UNIFIED_SCRUM_WORKFLOW_SPECIFICATION.md - セクション5「タスクバックログ管理」追加
  - 内容:
    - Product Backlog（`globalTasks`）の詳細説明
    - Sprint Backlogの管理方法
    - タスクライフサイクル完全図
    - `globalTasks`と`tasks`の使い分けルール
  - 見積: 1.5h
  - 依存: Task 0.1
  - 成果物: 新規セクション5
  - **ステータス**: ✅ 完了

- 🔵 **Task 0.3**: UNIFIED_SCRUM_WORKFLOW_SPECIFICATION.md - セクション6「完成の定義」追加
  - 内容:
    - AI自動検証基準の明記
    - 品質保証の自動化
    - 人間レビュー不要の明示
  - 見積: 45分
  - 依存: Task 0.2
  - 成果物: 新規セクション6
  - **ステータス**: ✅ 完了

- 🔵 **Task 0.4**: UNIFIED_SCRUM_WORKFLOW_SPECIFICATION.md - セクション番号の修正
  - 内容:
    - 既存セクション5→7、6→8、7→9、8→10、9→11、10→12
    - 全ての参照を更新
  - 見積: 30分
  - 依存: Task 0.2, 0.3
  - 成果物: 一貫性のあるセクション番号
  - **ステータス**: ✅ 完了

---

## Phase 1: 設計・分析 (2h)

### 目的
既存コードの詳細分析と影響範囲の特定

### タスク

- 🟢 **Task 1.1**: 既存グラフの詳細分析
  - ファイル: `src/graph/ParallelDevGraph.ts`
  - 内容:
    - 3つのグラフ関数の完全な構造分析
    - 使用されているノードのリストアップ
    - エッジと条件分岐の洗い出し
  - 見積: 30分
  - 依存: なし
  - 成果物: 分析メモ（Markdown）

- 🟢 **Task 1.2**: 影響範囲の特定
  - ファイル: 全プロジェクト
  - 内容:
    - グラフ関数を呼び出している箇所の特定
    - `WorkflowType` を使用している箇所の特定
    - テストファイルの影響範囲調査
  - 見積: 45分
  - 依存: Task 1.1
  - 成果物: 影響範囲リスト

- 🟢 **Task 1.3**: 移行戦略の確定
  - 内容:
    - 一括移行 vs 段階的移行の最終判断
    - ロールバック計画の策定
    - テスト戦略の確定
  - 見積: 30分
  - 依存: Task 1.2
  - 成果物: 移行計画書（Markdown）

- 🟢 **Task 1.4**: 設計書レビュー
  - ファイル: `spec/UNIFIED_SCRUM_WORKFLOW_SPECIFICATION.md`
  - 内容:
    - 設計書の内容確認
    - 不明点の洗い出し
    - 実装前の最終確認
  - 見積: 15分
  - 依存: Task 1.1, 1.2, 1.3
  - 成果物: レビューコメント

---

## Phase 2: 型定義の整理 (3.5h)

### 目的
型システムの変更を先に実施し、TypeScriptコンパイラの支援を受ける

### タスク

- 🟢 **Task 2.1**: WorkflowType型の削除準備
  - ファイル: `src/graph/types.ts`, `src/electron/ParallelDevOrchestrator.ts`
  - 内容:
    - `WorkflowType` 型を使用している箇所を洗い出し
    - コメントアウトして影響範囲を確認
  - 見積: 30分
  - 依存: Phase 1完了
  - 成果物: 使用箇所リスト

- 🟢 **Task 2.2**: Metadata型の拡張
  - ファイル: `src/graph/types.ts`
  - 内容:
    ```typescript
    export interface Metadata {
      // 既存フィールド
      startedAt?: Date;
      completedAt?: Date;
      phase?: 'analysis' | 'development' | 'review' | 'merge' | 'complete';
      tasksCompleted?: number;
      tasksFailed?: number;
      hasErrors?: boolean;
      errors?: string[];
      continuationMode?: boolean;
      activeSprint?: {
        id: string;
        status: 'active' | 'completed';
        tasks: string[];
        estimatedHours: number;
      };
      storyMappingApproved?: boolean;
      reviewFeedback?: {
        issues: Array<{
          severity: 'critical' | 'major' | 'minor';
          description: string;
        }>;
      };

      // ✅ 新規追加
      requiresDetailedDesign: boolean;  // 詳細設計フェーズ実行フラグ
      complexityReason?: string;        // 複雑度判定理由
    }
    ```
  - 見積: 15分
  - 依存: なし
  - テスト: TypeScriptコンパイル確認

- 🟢 **Task 2.3**: ParallelDevConfig修正
  - ファイル: `src/graph/types.ts`
  - 内容:
    - `workflowType?: WorkflowType;` を削除
  - 見積: 15分
  - 依存: Task 2.1
  - テスト: TypeScriptコンパイル確認

- 🟢 **Task 2.4**: createInitialState修正
  - ファイル: `src/graph/state.ts`
  - 内容:
    - `metadata.requiresDetailedDesign` のデフォルト値設定
    ```typescript
    export function createInitialState(
      userRequest: string,
      config: ParallelDevConfig
    ): ParallelDevStateType {
      return {
        userRequest,
        config,
        tasks: [],
        completedTasks: [],
        failedTasks: [],
        reviews: [],
        mergeQueue: [],
        logs: [],
        tasksPath: '.kugutsu/tasks.json',
        metadata: {
          startedAt: new Date(),
          phase: 'analysis',
          requiresDetailedDesign: false,  // ✅ デフォルトはfalse（AI判定で上書き）
        },
      };
    }
    ```
  - 見積: 30分
  - 依存: Task 2.2
  - テスト: 単体テスト実行

- 🟢 **Task 2.5**: 型定義の完全性確認
  - 内容:
    - 全ファイルでTypeScriptコンパイル
    - エラーの洗い出し
  - 見積: 1h
  - 依存: Task 2.1, 2.2, 2.3, 2.4
  - 成果物: コンパイルエラーリスト

- 🟢 **Task 2.6**: ready状態の削除
  - ファイル: `src/graph/types.ts`
  - 内容:
    - TaskStatus型から`ready`を削除（未実装のため）
    ```typescript
    // 修正前
    export type TaskStatus = 'pending' | 'ready' | 'in_progress' | 'in_review' | 'completed' | 'failed';

    // 修正後
    export type TaskStatus = 'pending' | 'in_progress' | 'in_review' | 'completed' | 'failed';
    ```
  - 見積: 15分
  - 依存: Task 2.5
  - テスト: TypeScriptコンパイル確認

- 🟢 **Task 2.7**: GlobalTask型とTask型にコメント追加
  - ファイル: `src/types/index.ts`, `src/graph/types.ts`
  - 内容:
    - GlobalTask型に詳細コメントを追加（Product Backlog管理用）
    - Task型に詳細コメントを追加（実行キュー管理用）
    - 使い分けルールをドキュメント化
  - 見積: 30分
  - 依存: Task 2.6
  - 成果物: コメント付き型定義

---

## Phase 3: 要求複雑度判定ノードの実装 (4h)

### 目的
AI判定ロジックを実装し、条件分岐の基盤を作る

### タスク

- 🟢 **Task 3.1**: AnalyzeComplexityNode.ts作成
  - ファイル: `src/graph/nodes/AnalyzeComplexityNode.ts`
  - 内容:
    - AI分析による複雑度判定
    - プロンプト設計
    - 判定基準の実装
  - 見積: 2h
  - 依存: Phase 2完了
  - 成果物: ノード実装

- 🟢 **Task 3.2**: 判定ロジックのテスト
  - ファイル: `tests/graph/nodes/AnalyzeComplexityNode.test.ts`
  - 内容:
    - 簡単な要求のテスト（バグ修正など）
    - 複雑な要求のテスト（新機能など）
    - エッジケースのテスト
  - 見積: 1h
  - 依存: Task 3.1
  - テストケース:
    ```typescript
    describe('AnalyzeComplexityNode', () => {
      it('should detect simple request (bug fix)', async () => {
        const state = createInitialState('Fix login bug', config);
        const result = await analyzeComplexityNode(state);
        expect(result.metadata.requiresDetailedDesign).toBe(false);
      });

      it('should detect complex request (new feature)', async () => {
        const state = createInitialState('Add user authentication system', config);
        const result = await analyzeComplexityNode(state);
        expect(result.metadata.requiresDetailedDesign).toBe(true);
      });
    });
    ```

- 🟢 **Task 3.3**: 判定理由の記録機能
  - ファイル: `src/graph/nodes/AnalyzeComplexityNode.ts`
  - 内容:
    - `complexityReason` フィールドに判定理由を記録
    - ログ出力の追加
  - 見積: 30分
  - 依存: Task 3.1
  - 成果物: 拡張版ノード

- 🟢 **Task 3.4**: Mock Provider対応
  - ファイル: `src/providers/MockAIProvider.ts`
  - 内容:
    - Mock Provider での複雑度判定のシミュレーション
    - テスト用のダミー判定ロジック
  - 見積: 30分
  - 依存: Task 3.1
  - 成果物: Mock対応版

---

## Phase 4: 単一グラフの構築 (12h)

### 目的
3つのグラフを1つの統合グラフに統合

### タスク

- 🟢 **Task 4.1**: createUnifiedScrumWorkflowGraph()実装
  - ファイル: `src/graph/ParallelDevGraph.ts`
  - 内容:
    - 新しいグラフ構築関数の実装
    - 全ノードの追加
    - エントリーポイントの設定
  - 見積: 3h
  - 依存: Phase 3完了
  - 成果物: グラフ構築関数

- 🟢 **Task 4.2**: 条件分岐エッジの実装
  - ファイル: `src/graph/ParallelDevGraph.ts`
  - 内容:
    - 要求複雑度による分岐
    - ストーリーマッピングレビュー分岐
    - 設計レビュー分岐
    - マージコンフリクト分岐
    - スプリント完了分岐
  - 見積: 2h
  - 依存: Task 4.1
  - 成果物: 条件分岐ロジック

- 🟢 **Task 4.3**: Engineer Wrapperの統合
  - ファイル: `src/graph/ParallelDevGraph.ts`
  - 内容:
    - 3つのグラフから重複コードを抽出
    - 共通のEngineer Wrapper関数を作成
    - allSettledによるエラーハンドリング
  - 見積: 1.5h
  - 依存: Task 4.1
  - 成果物: 統合版Engineer Wrapper

- 🟢 **Task 4.4**: Review Wrapperの統合とステータス修正
  - ファイル: `src/graph/ParallelDevGraph.ts`
  - 内容:
    - 3つのグラフから重複コードを抽出
    - ⚠️ **重要**: ステータスを `in_review` に統一
    ```typescript
    const completedTasks = state.tasks.filter(
      (t) =>
        t.status === 'in_review' &&  // ✅ 修正: completed → in_review
        !state.reviews.some((r) => r.taskId === t.id)
    );
    ```
  - 見積: 1.5h
  - 依存: Task 4.1
  - 成果物: 統合版Review Wrapper（ステータス修正済み）

- 🟢 **Task 4.5**: compileUnifiedScrumWorkflowGraph()実装
  - ファイル: `src/graph/ParallelDevGraph.ts`
  - 内容:
    - コンパイル関数の実装
    - checkpointer設定
    - デフォルトエクスポート設定
  - 見積: 30分
  - 依存: Task 4.1, 4.2, 4.3, 4.4
  - 成果物: コンパイル関数

- 🟢 **Task 4.6**: グラフ構造の検証
  - 内容:
    - 全ノードが正しく接続されているか確認
    - 条件分岐が正しく動作するか確認
    - デッドロックやループがないか確認
  - 見積: 1.5h
  - 依存: Task 4.5
  - ツール: LangGraphのビジュアライゼーション機能

- 🟢 **Task 4.7**: ステータス遷移の検証
  - 内容:
    - Engineer → Review のステータス遷移確認
    - `in_progress → in_review → completed` フロー確認
    - `in_review → in_progress` 再実装フロー確認
  - 見積: 1h
  - 依存: Task 4.4, 4.6
  - テスト: 手動テスト + 単体テスト

- 🟢 **Task 4.8**: エラーハンドリングの確認
  - 内容:
    - Promise.allSettled の動作確認
    - エラー時のログ出力確認
    - 失敗タスクの記録確認
  - 見積: 1h
  - 依存: Task 4.3, 4.4
  - テスト: エラー注入テスト

---

## Phase 5: Orchestrator修正 (3h)

### 目的
Orchestratorを統合グラフに対応させる

### タスク

- 🟢 **Task 5.1**: ParallelDevOrchestrator.ts修正
  - ファイル: `src/electron/ParallelDevOrchestrator.ts`
  - 内容:
    - ワークフロー選択ロジックの削除
    ```typescript
    // ❌ 削除
    const workflowType: WorkflowType = explicitWorkflowType
      || (useSprintDriven === false ? 'parallel' : 'sprint');

    const graph =
      workflowType === 'scrum' ? compileScrumDevGraph() :
      workflowType === 'sprint' ? compileSprintDrivenGraph() :
      compileParallelDevGraph();

    // ✅ 新規
    const graph = compileUnifiedScrumWorkflowGraph({
      enableCheckpointer: true,
    });
    ```
  - 見積: 1h
  - 依存: Phase 4完了
  - テスト: Orchestrator動作確認

- 🟢 **Task 5.2**: OrchestratorConfig型修正
  - ファイル: `src/electron/ParallelDevOrchestrator.ts`
  - 内容:
    - `workflowType` フィールド削除
    - `useSprintDriven` フィールド削除
  - 見積: 30分
  - 依存: Task 5.1
  - テスト: TypeScriptコンパイル

- 🟢 **Task 5.3**: Orchestrator統合テスト
  - 内容:
    - 簡単な要求でのフロー確認
    - 複雑な要求でのフロー確認
    - エラーハンドリング確認
  - 見積: 1.5h
  - 依存: Task 5.1, 5.2
  - テスト: E2Eテスト

---

## Phase 6: CLI/設定の修正 (2h)

### 目的
CLIと設定ファイルから不要なオプションを削除

### タスク

- 🟢 **Task 6.1**: parallel-dev-cli.ts修正
  - ファイル: `src/parallel-dev-cli.ts`
  - 内容:
    - `--workflow-type` オプション削除
    - ワークフロー選択ロジック削除
    - ヘルプメッセージ更新
  - 見積: 1h
  - 依存: Phase 5完了
  - テスト: CLI動作確認

- 🟢 **Task 6.2**: 設定ファイルの更新
  - ファイル: `.kugutsu/config.json` (スキーマ)
  - 内容:
    - `workflowType` フィールドの削除
  - 見積: 30分
  - 依存: Task 6.1
  - 成果物: 更新された設定スキーマ

- 🟢 **Task 6.3**: CLIヘルプメッセージの更新
  - ファイル: `src/parallel-dev-cli.ts`
  - 内容:
    - ワークフロータイプに関する記述を削除
    - 要求複雑度の自動判定について追記
  - 見積: 30分
  - 依存: Task 6.1
  - 成果物: 更新されたヘルプメッセージ

---

## Phase 7: 旧コードの削除 (1h)

### 目的
不要になった旧グラフ関数を削除

### タスク

- 🟢 **Task 7.1**: 旧グラフ関数の削除
  - ファイル: `src/graph/ParallelDevGraph.ts`
  - 削除対象:
    ```typescript
    // ❌ 削除
    export function createParallelDevGraph() { ... }
    export function compileParallelDevGraph(options?) { ... }
    export function createSprintDrivenGraph() { ... }
    export function compileSprintDrivenGraph(options?) { ... }
    export function createScrumDevGraph() { ... }
    export function compileScrumDevGraph(options?) { ... }
    ```
  - 見積: 30分
  - 依存: Phase 5, 6完了
  - 確認: 呼び出し箇所がないことを確認

- 🟢 **Task 7.2**: WorkflowType型の削除
  - ファイル: `src/electron/ParallelDevOrchestrator.ts`, `src/graph/types.ts`
  - 削除対象:
    ```typescript
    // ❌ 削除
    export type WorkflowType = 'parallel' | 'sprint' | 'scrum';
    ```
  - 見積: 15分
  - 依存: Task 7.1
  - 確認: TypeScriptコンパイル

- 🟢 **Task 7.3**: デッドコードの除去
  - 内容:
    - 未使用のインポート削除
    - 未使用の変数削除
  - 見積: 15分
  - 依存: Task 7.1, 7.2
  - ツール: ESLint, TypeScript unused exports

---

## Phase 8: テスト修正 (6h)

### 目的
既存テストを統合グラフに対応させる

### タスク

- 🟢 **Task 8.1**: グラフ作成テストの修正
  - ファイル: `tests/graph/ParallelDevGraph.test.ts`
  - 内容:
    - 3つのグラフ作成テスト → 1つに統合
    - `createUnifiedScrumWorkflowGraph()` のテスト
  - 見積: 1h
  - 依存: Phase 7完了
  - テスト: 単体テスト実行

- 🟢 **Task 8.2**: ノードテストの修正
  - ファイル: `tests/graph/nodes/*.test.ts`
  - 内容:
    - Engineer/Review ノードのステータス期待値修正
    - AnalyzeComplexityNode のテスト追加
  - 見積: 1.5h
  - 依存: Task 8.1
  - テスト: 単体テスト実行

- 🟢 **Task 8.3**: E2Eテストの修正
  - ファイル: `tests/e2e/*.test.ts`
  - 内容:
    - ワークフロータイプ指定の削除
    - 複雑度判定のテスト追加
  - 見積: 2h
  - 依存: Task 8.2
  - テスト: E2Eテスト実行

- 🟢 **Task 8.4**: Orchestratorテストの修正
  - ファイル: `tests/electron/ParallelDevOrchestrator.test.ts`
  - 内容:
    - ワークフロー選択テストの削除
    - 統合グラフでの動作テスト
  - 見積: 1h
  - 依存: Task 8.3
  - テスト: 統合テスト実行

- 🟢 **Task 8.5**: Mock Providerテストの修正
  - ファイル: `tests/providers/MockAIProvider.test.ts`
  - 内容:
    - 複雑度判定のMock実装テスト
  - 見積: 30分
  - 依存: Task 8.4
  - テスト: 単体テスト実行

- 🟢 **Task 8.6**: 全テストの実行と検証
  - 内容:
    - `npm test` の実行
    - 失敗テストの修正
    - カバレッジ確認
  - 見積: 1h
  - 依存: Task 8.1, 8.2, 8.3, 8.4, 8.5
  - 成果物: テスト結果レポート

---

## Phase 9: ドキュメント更新 (3h)

### 目的
ドキュメントを最新状態に更新

### タスク

- 🟢 **Task 9.1**: README.md更新
  - ファイル: `README.md`
  - 内容:
    - ワークフロータイプに関する記述削除
    - 統一Scrumワークフローの説明追加
    - 要求複雑度自動判定の説明追加
  - 見積: 1h
  - 依存: Phase 8完了
  - 成果物: 更新されたREADME

- 🟢 **Task 9.2**: CLAUDE.md更新
  - ファイル: `CLAUDE.md`
  - 内容:
    - 開発ガイドラインの更新
    - ワークフロー説明の修正
  - 見積: 30分
  - 依存: Task 9.1
  - 成果物: 更新されたCLAUDE.md

- 🟢 **Task 9.3**: spec/ 内のドキュメント更新
  - ファイル:
    - `spec/SCRUM_WORKFLOW_SPECIFICATION.md`
    - `spec/NODE_RESPONSIBILITIES_AND_WORKFLOW.md`
    - `spec/ARCHITECTURE_DESIGN.md`
  - 内容:
    - 旧ワークフロー説明の削除
    - 統一ワークフローへの参照追加
  - 見積: 1h
  - 依存: Task 9.2
  - 成果物: 更新されたspec/ドキュメント

- 🟢 **Task 9.4**: WORKFLOW_UNIFICATION_TASKS.md更新
  - ファイル: `spec/WORKFLOW_UNIFICATION_TASKS.md`
  - 内容:
    - このタスクリストの完了マーク
    - 進捗率の更新
  - 見積: 30分
  - 依存: Task 9.3
  - 成果物: 更新されたタスクリスト

---

## Phase 10: AI学習機能追加 (8h)

### 目的
AI完全自律性の向上：バックログ優先度の動的調整、失敗パターンの学習

### タスク

- 🟢 **Task 10.1**: BacklogRefinementNode実装
  - ファイル: `src/graph/nodes/BacklogRefinementNode.ts`
  - 内容:
    - スプリント間でバックログの優先度を再評価
    - AIがビジネス価値、技術的リスク、依存関係を分析
    - `dynamicPriority`を更新
    ```typescript
    export async function backlogRefinementNode(state: ParallelDevStateType) {
      const unassignedTasks = state.globalTasks.filter(t => !t.sprint);

      const prompt = `
      以下の未割り当てタスクの優先度を再評価してください：
      ${JSON.stringify(unassignedTasks, null, 2)}

      評価観点:
      - ビジネス価値の変化
      - 技術的リスクの変動
      - 依存関係の更新
      - 前回スプリントの結果を踏まえた調整
      `;

      const result = await provider.query(prompt, {
        allowedTools: ['Read', 'Glob'],
        maxTurns: 10
      });

      return {
        globalTasks: updatedTasks
      };
    }
    ```
  - 見積: 4h
  - 依存: Phase 2完了
  - 成果物: BacklogRefinementNode実装
  - テスト: 単体テスト、優先度変更の検証

- 🟢 **Task 10.2**: SprintRetrospectiveNode実装
  - ファイル: `src/graph/nodes/SprintRetrospectiveNode.ts`
  - 内容:
    - 完了したスプリントのメトリクス分析
    - 失敗タスクのパターン抽出
    - 次回スプリントへの改善提案
    ```typescript
    export async function sprintRetrospectiveNode(state: ParallelDevStateType) {
      const metrics = {
        taskCompletionRate: calculateCompletionRate(state),
        averageTaskDuration: calculateAverageTaskDuration(state),
        conflictResolutionTime: calculateConflictTime(state),
      };

      // パターン分析
      const improvements = [];
      if (metrics.conflictResolutionTime > threshold) {
        improvements.push({
          type: 'process',
          suggestion: 'タスク分解の粒度を細かくする',
          expectedImpact: 'コンフリクト頻度の削減'
        });
      }

      return {
        metadata: {
          retrospective: {
            metrics,
            improvements
          }
        }
      };
    }
    ```
  - 見積: 4h
  - 依存: Task 10.1
  - 成果物: SprintRetrospectiveNode実装
  - テスト: メトリクス計算の検証、改善提案の妥当性確認

---

## リスク管理

### 高リスク項目

| リスク | 確率 | 影響度 | 対策 |
|-------|------|-------|------|
| Review Wrapperステータス修正漏れ | 中 | 高 | コードレビューの徹底、テスト追加 |
| 条件分岐ロジックのバグ | 中 | 高 | 単体テスト、E2Eテストの充実 |
| AI判定精度の低さ | 高 | 中 | 保守的な判定（迷ったら詳細設計実行） |
| 既存テストの破損 | 高 | 中 | 段階的テスト修正、CI/CD確認 |

### 中リスク項目

| リスク | 確率 | 影響度 | 対策 |
|-------|------|-------|------|
| パフォーマンス劣化 | 低 | 中 | ベンチマーク測定、プロファイリング |
| ドキュメント更新漏れ | 中 | 低 | チェックリスト使用 |
| デッドコード残存 | 中 | 低 | Linterによる自動検出 |

---

## マイルストーン

### Milestone 1: 基盤完成 (Phase 1-3完了)
- **期限**: 5日後
- **内容**: 型定義、AnalyzeComplexityNode実装完了
- **判定基準**: TypeScriptコンパイル成功、単体テスト通過

### Milestone 2: グラフ統合完成 (Phase 4-5完了)
- **期限**: 10日後
- **内容**: 統合グラフ実装、Orchestrator修正完了
- **判定基準**: グラフ構造検証完了、統合テスト通過

### Milestone 3: 完全移行完了 (Phase 6-9完了)
- **期限**: 15日後
- **内容**: 旧コード削除、テスト修正、ドキュメント更新完了
- **判定基準**: 全テスト通過、ドキュメント更新完了

---

## 作業見積もり詳細

### Phase別見積もり（25%バッファ込み）

| Phase | 元見積 | バッファ込み | 累計 |
|-------|-------|-----------|------|
| Phase 1 | 2h | 2.5h | 2.5h |
| Phase 2 | 3.5h | 4.375h | 6.875h |
| Phase 3 | 4h | 5h | 11.875h |
| Phase 4 | 12h | 15h | 26.875h |
| Phase 5 | 3h | 3.75h | 30.625h |
| Phase 6 | 2h | 2.5h | 33.125h |
| Phase 7 | 1h | 1.25h | 34.375h |
| Phase 8 | 6h | 7.5h | 41.875h |
| Phase 9 | 3h | 3.75h | 45.625h |
| Phase 10 | 8h | 10h | 55.625h |

**合計**: 44.5h → **55.625h (バッファ込み)** ≈ **56h**

---

## チェックリスト

### 実装前チェック
- [ ] 設計書レビュー完了
- [ ] 影響範囲特定完了
- [ ] テスト戦略確定
- [ ] バックアップ作成

### 実装中チェック
- [ ] TypeScriptコンパイル成功
- [ ] Linterエラーなし
- [ ] 単体テスト通過
- [ ] 統合テスト通過

### 実装後チェック
- [ ] 全テスト通過
- [ ] E2Eテスト通過
- [ ] ドキュメント更新完了
- [ ] コードレビュー完了
- [ ] デッドコード除去完了

---

## 参考資料

- `spec/UNIFIED_SCRUM_WORKFLOW_SPECIFICATION.md` - 統一ワークフロー仕様書
- `spec/SCRUM_WORKFLOW_SPECIFICATION.md` - 既存Scrumワークフロー仕様
- `spec/NODE_RESPONSIBILITIES_AND_WORKFLOW.md` - ノード責務定義
- `spec/TASK_STATE_MACHINE.md` - タスクステートマシン
- `src/graph/ParallelDevGraph.ts` - 既存グラフ実装

---

**ドキュメント終了**
