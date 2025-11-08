# Phase 1: 設計・分析レポート

**プロジェクト**: Kugutsu 2.0 - AI Parallel Development System
**タスク**: 統一Scrumワークフローへのリファクタリング
**日付**: 2025-01-09
**ステータス**: 完了

---

## 1. 既存グラフの詳細分析（Task 1.1）

### 1.1 3つの独立したグラフ関数

現在、`src/graph/ParallelDevGraph.ts`に3つの独立したワークフローグラフが存在：

#### A. Parallel Development Graph
- **関数**: `createParallelDevGraph()` (36-278行)
- **コンパイル**: `compileParallelDevGraph()` (287-299行)
- **特徴**:
  - 標準並列開発フロー
  - product_owner → engineer → review → merge
  - Engineer Wrapper: `Promise.allSettled`で並列実行
  - Review Wrapper: `status === 'in_review'` を期待 ✅ **正しい**

#### B. Sprint-Driven Graph
- **関数**: `createSprintDrivenGraph()` (317-539行)
- **コンパイル**: `compileSprintDrivenGraph()` (548-560行)
- **特徴**:
  - スプリント駆動開発フロー
  - check_mode → product_owner → sprint_planning → engineer → review → merge → sprint_review
  - Engineer Wrapper: `Promise.allSettled`で並列実行
  - Review Wrapper: `status === 'completed'` を期待 ❌ **ステータス不整合**

#### C. Scrum Development Graph
- **関数**: `createScrumDevGraph()` (573-765行)
- **コンパイル**: `compileScrumDevGraph()` (774-786行)
- **特徴**:
  - 完全Scrumフロー
  - director_ai → review_story_mapping → tech_lead_design → review_design → task_breakdown → engineer → review → merge
  - Engineer Wrapper: `Promise.all`で並列実行（エラーハンドリングなし）
  - Review Wrapper: `status === 'completed'` を期待 ❌ **ステータス不整合**

### 1.2 重複コードの存在

#### Engineer Wrapper（3箇所に重複）
- ParallelDevGraph: 42-96行
- SprintDrivenGraph: 332-386行
- ScrumDevGraph: 584-623行

**差異**:
- ParallelDevGraph/SprintDrivenGraph: `Promise.allSettled`使用（推奨）
- ScrumDevGraph: `Promise.all`使用（エラー時に全体が失敗）

#### Review Wrapper（3箇所に重複）
- ParallelDevGraph: 98-154行
- SprintDrivenGraph: 389-445行
- ScrumDevGraph: 624-661行

**重大な問題**: ステータス不整合
- ParallelDevGraph: `t.status === 'in_review'` ✅ EngineerNodeの遷移と整合
- SprintDrivenGraph: `t.status === 'completed'` ❌ EngineerNodeは`in_review`に遷移するため、レビュー対象が見つからない
- ScrumDevGraph: `t.status === 'completed'` ❌ 同上

### 1.3 ノード構成の比較

| ノード名 | Parallel | Sprint | Scrum | 備考 |
|---------|----------|--------|-------|------|
| product_owner | ✅ | ✅ | ❌ | Scrumはtask_breakdownで代替 |
| check_mode | ❌ | ✅ | ❌ | Sprint専用 |
| sprint_planning | ❌ | ✅ | ❌ | Sprint専用 |
| sprint_review | ❌ | ✅ | ❌ | Sprint専用 |
| director_ai | ❌ | ❌ | ✅ | Scrum専用 |
| review_story_mapping | ❌ | ❌ | ✅ | Scrum専用 |
| tech_lead_design | ❌ | ❌ | ✅ | Scrum専用 |
| review_design | ❌ | ❌ | ✅ | Scrum専用 |
| task_breakdown | ❌ | ❌ | ✅ | Scrum専用 |
| engineer_dispatch | ✅ | ✅ | ✅ | 全グラフ共通 |
| engineer | ✅ | ✅ | ✅ | 全グラフ共通（実装は重複） |
| review | ✅ | ✅ | ✅ | 全グラフ共通（実装は重複） |
| merge_coordinator | ✅ | ✅ | ✅ | 全グラフ共通 |
| conflict_resolver | ✅ | ✅ | ✅ | 全グラフ共通 |
| check_completion | ✅ | ❌ | ❌ | Parallel専用 |

---

## 2. 影響範囲の特定（Task 1.2）

### 2.1 実装ファイル

#### A. グラフ定義
- **`src/graph/ParallelDevGraph.ts`**
  - 削除対象:
    - `createParallelDevGraph()` (36-278行)
    - `compileParallelDevGraph()` (287-299行)
    - `createSprintDrivenGraph()` (317-539行)
    - `compileSprintDrivenGraph()` (548-560行)
    - `createScrumDevGraph()` (573-765行)
    - `compileScrumDevGraph()` (774-786行)
  - 追加対象:
    - `createUnifiedScrumWorkflowGraph()`
    - `compileUnifiedScrumWorkflowGraph()`

#### B. Orchestrator
- **`src/electron/ParallelDevOrchestrator.ts`**
  - 削除対象:
    - `WorkflowType` 型定義（17行）
    - `OrchestratorConfig.workflowType` フィールド（44行）
    - `OrchestratorConfig.useSprintDriven` フィールド（50行）
    - ワークフロー選択ロジック（96-122行）
  - 変更対象:
    - `execute()`メソッド: 常に統一グラフを使用

#### C. 型定義
- **`src/graph/state.ts`**
  - 追加対象:
    - `metadata`に`requiresDetailedDesign: boolean`追加
    - `metadata`に`complexityReason?: string`追加

- **`src/types/artifacts.ts`**
  - 削除対象:
    - `Metadata.workflowType` フィールド（356行）

#### D. CLI
- **`src/parallel-dev-cli.ts`**
  - 影響: なし（ワークフロー指定なし、Orchestratorのデフォルトを使用）

### 2.2 新規実装が必要なノード

#### A. AnalyzeComplexityNode
- **ファイル**: `src/graph/nodes/AnalyzeComplexityNode.ts`（新規作成）
- **責務**: ユーザー要求を分析し、複雑度を判定
- **出力**: `metadata.requiresDetailedDesign`, `metadata.complexityReason`

### 2.3 テストファイル

以下のテストファイルが影響を受ける：

1. `tests/integration/graph-execution.test.ts`
2. `tests/integration/scrum-workflow.test.ts`
3. `tests/integration/sprint-driven-development.test.ts`
4. `tests/integration/scrum-sprint-complete-workflow.test.ts`
5. `tests/integration/e2e-realistic-scenario.test.ts`
6. `tests/integration/review-rejection-loop.test.ts`
7. `tests/integration/dependency-graph-execution.test.ts`
8. `tests/integration/parallel-performance.test.ts`
9. `tests/manual/e2e-minimal-verification.ts`
10. `tests/manual/e2e-realistic-verification.ts`

**必要な修正**:
- グラフ作成関数の呼び出しを`createUnifiedScrumWorkflowGraph()`に変更
- `WorkflowType`の使用を削除
- 複雑度判定のテストケース追加

### 2.4 ドキュメント

以下のドキュメントが影響を受ける：

1. `spec/UNIFIED_SCRUM_WORKFLOW_SPECIFICATION.md` - 実装の基準
2. `spec/WORKFLOW_UNIFICATION_TASKS.md` - タスク管理
3. `spec/SCRUM_WORKFLOW_SPECIFICATION.md` - 既存Scrum仕様（更新が必要）
4. `spec/NODE_RESPONSIBILITIES_AND_WORKFLOW.md` - ノード責務（更新が必要）
5. `spec/ARCHITECTURE_DESIGN.md` - アーキテクチャ設計（更新が必要）
6. `docs/MIGRATION_GUIDE.md` - マイグレーションガイド（更新が必要）
7. `README.md` - プロジェクトREADME（更新が必要）
8. `CLAUDE.md` - Claude Code向けガイド（更新が必要）
9. `CHANGELOG.md` - 変更履歴（追記が必要）

---

## 3. 発見された問題点

### 3.1 ステータス不整合（重大）

**問題**:
- EngineerNodeは`in_progress → in_review`に遷移
- Sprint/ScrumのReview Wrapperは`status === 'completed'`を期待
- → レビュー対象タスクが見つからず、レビューがスキップされる

**影響度**: **高**
**優先度**: **最高**（Phase 4で修正）

**修正方法**:
```typescript
// ❌ 修正前（Sprint/Scrumグラフ）
const completedTasks = state.tasks.filter(
  (t) => t.status === 'completed' && ...
);

// ✅ 修正後（統合グラフ）
const completedTasks = state.tasks.filter(
  (t) => t.status === 'in_review' && ...
);
```

### 3.2 エラーハンドリングの不整合

**問題**:
- Parallel/Sprint: `Promise.allSettled`使用（推奨）
- Scrum: `Promise.all`使用（エラー時に全体が失敗）

**影響度**: 中
**優先度**: 高（Phase 4で統一）

**修正方法**: 統合グラフでは`Promise.allSettled`を使用

### 3.3 型定義の分散

**問題**:
- `metadata`に必要なフィールド（`requiresDetailedDesign`等）が未定義
- `WorkflowType`が`ParallelDevOrchestrator.ts`と`artifacts.ts`で重複定義

**影響度**: 中
**優先度**: 高（Phase 2で整理）

---

## 4. 移行戦略の確定（Task 1.3）

### 4.1 移行方式: **一括移行**

**選択理由**:
1. **依存関係の複雑さ**: 3つのグラフは相互に独立しており、段階的移行は複雑
2. **ステータス不整合**: 既存のSprint/Scrumグラフは動作不良の可能性がある
3. **テストの整合性**: 段階的移行ではテストの整合性を保つのが困難
4. **実装規模**: 全体で43タスクだが、コア実装は約20タスク（実行可能）

### 4.2 移行フェーズ

#### Phase 1: 設計・分析（完了）
- 既存グラフの分析
- 影響範囲の特定
- 移行戦略の確定

#### Phase 2: 型定義の整理（次）
- `Metadata`型の拡張
- `WorkflowType`の削除準備
- `ParallelDevConfig`の修正

#### Phase 3: 要求複雑度判定ノードの実装
- `AnalyzeComplexityNode.ts`の作成
- 判定ロジックの実装
- Mock Provider対応

#### Phase 4: 単一グラフの構築
- `createUnifiedScrumWorkflowGraph()`実装
- Engineer/Review Wrapperの統合（ステータス修正）
- 条件分岐エッジの実装

#### Phase 5-9: 統合、テスト、ドキュメント
- Orchestratorの修正
- CLI/設定の修正
- 旧コード削除
- テスト修正
- ドキュメント更新

### 4.3 ロールバック計画

**バックアップ**:
- Phase 2開始前にgitブランチを作成
- 旧グラフ関数は一時的にコメントアウト（完全削除はPhase 7）

**ロールバック条件**:
- Phase 4完了時点で重大な設計欠陥が発見された場合
- テスト通過率が50%を下回った場合

**ロールバック手順**:
1. gitブランチを切り戻し
2. 問題点を分析
3. 設計を見直してから再開

### 4.4 テスト戦略

**Phase 4: グラフ構築後**
- グラフ構造の検証（ビジュアライゼーション）
- 条件分岐のユニットテスト
- ステータス遷移の検証テスト

**Phase 8: テスト修正後**
- 全統合テストの実行
- E2Eテストの実行
- カバレッジ確認（目標: 80%以上）

**Phase 9: 完了前**
- 手動E2Eテスト
- 複雑度判定のエッジケーステスト
- パフォーマンステスト

---

## 5. 設計書レビュー（Task 1.4）

### 5.1 仕様書の整合性確認

**`spec/UNIFIED_SCRUM_WORKFLOW_SPECIFICATION.md`のレビュー結果**:

✅ **明確な点**:
- 単一ワークフローの設計原則
- ノード一覧と責務定義
- 条件分岐ロジック
- タスクライフサイクル
- 完成の定義（Definition of Done）

⚠️ **不明確な点**:

1. **`metadata`の構造**
   - 仕様書: `metadata.requiresDetailedDesign`, `metadata.continuationMode`, `metadata.activeSprint`
   - 実装: `continuationMode`, `activeSprint`は別フィールドとして存在
   - **決定**: 既存の実装を維持し、`metadata`には`requiresDetailedDesign`と`complexityReason`のみ追加

2. **AI判定の保守性**
   - 複雑度判定ロジックが「保守的」（迷ったら詳細設計実行）と記載されているが、実装方法が不明確
   - **決定**: Phase 3で具体的なプロンプトを設計

3. **スプリント完了基準**
   - E2Eテスト実行とデプロイ可能性のチェックが必要だが、実装方法が不明確
   - **決定**: Phase 1では設計のみ、実装はバックログ（Phase 10）

### 5.2 実装前の確認事項

#### A. 技術的制約
- ✅ LangGraphJSのバージョン: 対応可能
- ✅ TypeScriptの型システム: 問題なし
- ✅ 既存ノードの再利用: 可能

#### B. 依存関係
- ✅ 既存ノード（ProductOwner, Engineer, Review等）: そのまま使用
- ✅ CheckModeNode, SprintPlanningNode: そのまま使用
- ✅ DirectorNode, TechLeadDesignNode等: そのまま使用
- ⚠️ AnalyzeComplexityNode: **新規作成が必要**

#### C. 破壊的変更
- ❌ `WorkflowType`型の削除: **破壊的変更**
- ❌ `compileParallelDevGraph()`等の削除: **破壊的変更**
- ⚠️ `OrchestratorConfig`の変更: **破壊的変更**

**対策**: Phase 6-9で移行ガイドとCHANGELOGを更新

---

## 6. 次のステップ（Phase 2）

### 6.1 優先タスク

1. **Task 2.2: Metadata型の拡張** (15分)
   - `metadata.requiresDetailedDesign: boolean`追加
   - `metadata.complexityReason?: string`追加

2. **Task 2.3: ParallelDevConfig修正** (15分)
   - `workflowType`フィールド削除（存在しない）
   - `WorkflowType`型削除の準備

3. **Task 2.4: createInitialState修正** (30分)
   - `metadata.requiresDetailedDesign`のデフォルト値設定

4. **Task 2.5: 型定義の完全性確認** (1h)
   - TypeScriptコンパイル
   - エラーの洗い出し

### 6.2 推定所要時間

- Phase 2全体: 3.5時間（バッファ込みで4.375時間）

---

## 7. リスクと対策

### 7.1 高リスク項目

| リスク | 確率 | 影響度 | 対策 |
|-------|------|-------|------|
| Review Wrapperステータス修正漏れ | 中 | 高 | コードレビュー、テスト追加 |
| 条件分岐ロジックのバグ | 中 | 高 | 単体テスト、E2Eテスト |
| AI判定精度の低さ | 高 | 中 | 保守的な判定（迷ったら詳細設計） |
| 既存テストの破損 | 高 | 中 | 段階的テスト修正、CI/CD確認 |

### 7.2 中リスク項目

| リスク | 確率 | 影響度 | 対策 |
|-------|------|-------|------|
| パフォーマンス劣化 | 低 | 中 | ベンチマーク測定 |
| ドキュメント更新漏れ | 中 | 低 | チェックリスト使用 |
| デッドコード残存 | 中 | 低 | Linterで自動検出 |

---

## 8. 結論

Phase 1の分析により、以下が明確になりました：

✅ **実行可能性**: 一括移行は技術的に実行可能
✅ **影響範囲**: 19ファイル（実装3、テスト10、ドキュメント6）
⚠️ **重大問題**: ステータス不整合（Phase 4で修正）
✅ **設計の妥当性**: 仕様書は概ね明確、一部の詳細はPhase 3で決定

**推奨**: Phase 2に進む

---

**ドキュメント終了**
