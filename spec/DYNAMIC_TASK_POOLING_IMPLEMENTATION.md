# Dynamic Task Pooling Implementation Tasks

**プロジェクト**: Kugutsu 2.0 - AI Parallel Development System
**バージョン**: 1.0.0
**最終更新**: 2025-11-10
**ステータス**: Not Started (0% 完了)
**関連仕様**: [DYNAMIC_TASK_POOLING_SPECIFICATION.md](./DYNAMIC_TASK_POOLING_SPECIFICATION.md)

---

## タスク分類

- 🟢 **未着手** (Not Started)
- 🟡 **進行中** (In Progress)
- 🔵 **完了** (Completed)
- 🔴 **ブロック** (Blocked)

---

## 進捗サマリー

- **Phase 1 (設計準備)**: 0/3 完了 (0%)
- **Phase 2 (EngineerDispatchNode改修)**: 0/4 完了 (0%)
- **Phase 3 (ParallelDevGraph改修)**: 0/3 完了 (0%)
- **Phase 4 (テスト実装)**: 0/5 完了 (0%)
- **Phase 5 (ドキュメント更新)**: 0/3 完了 (0%)
- **全体**: 0/18 完了 (0%, 0h/38h)

---

## ⚠️ 見積もりバッファについて

本見積もりには**25%のバッファ**が含まれています：

- **基本見積**: 実装に必要な最小時間
- **バッファ**: デバッグ、調整、予期しない問題への対応
- **合計見積**: 基本見積 × 1.25

例: 基本2時間のタスク → 見積2.5時間

---

## Phase 1: 設計準備

### 1.1 既存コード分析

**優先度**: 🔥 最高

- 🟢 **Task 1.1.1**: EngineerDispatchNode の現在の実装を詳細分析
  - **ファイル**: `src/graph/nodes/EngineerDispatchNode.ts`
  - **内容**:
    - 現在のタスク割り当てロジックの理解
    - in_progress カウントが行われていないことの確認
    - pendingタスクのフィルタリングロジックの理解
  - **成果物**: 分析レポート（コメントまたはドキュメント）
  - **見積**: 1.5時間
  - **担当**: -
  - **依存**: なし
  - **ステータス**: 🟢 未着手

- 🟢 **Task 1.1.2**: ParallelDevGraph のエッジ定義を分析
  - **ファイル**: `src/graph/ParallelDevGraph.ts`
  - **内容**:
    - review完了後のエッジを確認（現在の遷移先）
    - merge_coordinator完了後のエッジを確認（行299-316）
    - 条件分岐ロジックの理解
  - **成果物**: エッジ定義マップ（どのノードからどこに遷移するか）
  - **見積**: 1.5時間
  - **担当**: -
  - **依存**: なし
  - **ステータス**: 🟢 未着手

### 1.2 型定義の確認

**優先度**: 高

- 🟢 **Task 1.2.1**: 既存の型定義を確認し、新規追加が必要か判断
  - **ファイル**: `src/graph/types.ts`, `src/types/index.ts`
  - **内容**:
    - ParallelDevStateType の構造確認
    - Task型の status フィールド確認
    - 新規型定義の必要性を判断（結論: 不要の可能性高い）
  - **成果物**: 型定義確認レポート
  - **見積**: 1時間
  - **担当**: -
  - **依存**: Task 1.1.1, 1.1.2
  - **ステータス**: 🟢 未着手

---

## Phase 2: EngineerDispatchNode 改修

### 2.1 in_progress カウントロジック追加

**優先度**: 🔥 最高

- 🟢 **Task 2.1.1**: in_progress 数をカウントする処理を追加
  - **ファイル**: `src/graph/nodes/EngineerDispatchNode.ts`
  - **対象行**: 62-91付近（pendingタスクのフィルタリング処理の前）
  - **内容**:
    ```typescript
    const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
    const availableSlots = config.maxEngineers - inProgressCount;

    console.log(`[EngineerDispatch] In Progress: ${inProgressCount}/${config.maxEngineers}`);
    console.log(`[EngineerDispatch] Available Slots: ${availableSlots}`);
    ```
  - **成果物**: 修正されたコード
  - **見積**: 0.5時間
  - **担当**: -
  - **依存**: Task 1.1.1
  - **ステータス**: 🟢 未着手

### 2.2 空きスロットチェック処理

**優先度**: 🔥 最高

- 🟢 **Task 2.2.1**: 空きスロットがない場合は早期リターン
  - **ファイル**: `src/graph/nodes/EngineerDispatchNode.ts`
  - **対象行**: Task 2.1.1の直後
  - **内容**:
    ```typescript
    if (availableSlots <= 0) {
      console.log('[EngineerDispatch] No available slots, skipping dispatch');
      return { tasks: state.tasks };
    }
    ```
  - **成果物**: 修正されたコード
  - **見積**: 0.5時間
  - **担当**: -
  - **依存**: Task 2.1.1
  - **ステータス**: 🟢 未着手

### 2.3 動的ディスパッチロジック

**優先度**: 🔥 最高

- 🟢 **Task 2.3.1**: tasksToDispatch の計算を availableSlots に基づいて修正
  - **ファイル**: `src/graph/nodes/EngineerDispatchNode.ts`
  - **対象行**: 88付近（`tasksToDispatch = pendingTasks.slice(0, config.maxEngineers)` の行）
  - **内容**:
    ```typescript
    // 修正前
    const tasksToDispatch = pendingTasks.slice(0, config.maxEngineers);

    // 修正後
    const tasksToDispatch = pendingTasks.slice(0, availableSlots);
    console.log(`[EngineerDispatch] Dispatching ${tasksToDispatch.length} tasks: ${tasksToDispatch.map(t => t.id).join(', ')}`);
    ```
  - **成果物**: 修正されたコード
  - **見積**: 0.5時間
  - **担当**: -
  - **依存**: Task 2.2.1
  - **ステータス**: 🟢 未着手

### 2.4 単体テストでの検証

**優先度**: 🔥 最高

- 🟢 **Task 2.4.1**: EngineerDispatchNode の動的ディスパッチをテスト
  - **ファイル**: `tests/graph/nodes/EngineerDispatchNode.test.ts`
  - **内容**:
    - 既存テストを確認
    - 空きスロット計算のテストケースを追加
    - 空きスロットがない場合のテストケースを追加
    - ディスパッチ数の検証
  - **成果物**: 新規テストケース（2-3個）
  - **見積**: 2時間
  - **担当**: -
  - **依存**: Task 2.3.1
  - **ステータス**: 🟢 未着手

---

## Phase 3: ParallelDevGraph 改修

### 3.1 review完了後のエッジ追加

**優先度**: 🔥 最高

- 🟢 **Task 3.1.1**: review → engineer_dispatch の条件分岐を追加
  - **ファイル**: `src/graph/ParallelDevGraph.ts`
  - **対象行**: reviewWrapperの定義後（行192付近）
  - **内容**:
    ```typescript
    workflow.addConditionalEdges(
      'review',
      (state: ParallelDevStateType) => {
        const pendingTasks = state.tasks.filter(t => t.status === 'pending');
        const inProgressCount = state.tasks.filter(t => t.status === 'in_progress').length;
        const availableSlots = state.config.maxEngineers - inProgressCount;

        if (pendingTasks.length > 0 && availableSlots > 0) {
          console.log(`[Graph] Review complete, available slots: ${availableSlots}, dispatching next tasks`);
          return 'dispatch_next';
        }

        console.log('[Graph] Review complete, proceeding to merge');
        return 'continue';
      },
      {
        dispatch_next: 'engineer_dispatch',
        continue: 'merge_coordinator',
      }
    );
    ```
  - **注意**: 既存のreviewからのエッジと競合しないか確認
  - **成果物**: 修正されたコード
  - **見積**: 2時間
  - **担当**: -
  - **依存**: Task 1.1.2, Task 2.3.1
  - **ステータス**: 🟢 未着手

### 3.2 merge_coordinator完了後のエッジ改善

**優先度**: 高

- 🟢 **Task 3.2.1**: merge_coordinator の条件分岐を改善
  - **ファイル**: `src/graph/ParallelDevGraph.ts`
  - **対象行**: 299-316
  - **内容**:
    - 既存の条件分岐に `availableSlots` チェックを追加
    - コンフリクト優先は維持
    - pendingタスクがあっても空きスロットがない場合の処理を追加
  - **成果物**: 修正されたコード（仕様書のコード例を参照）
  - **見積**: 1.5時間
  - **担当**: -
  - **依存**: Task 3.1.1
  - **ステータス**: 🟢 未着手

### 3.3 グラフ構造の整合性確認

**優先度**: 高

- 🟢 **Task 3.3.1**: グラフ全体のエッジが正しく接続されているか確認
  - **ファイル**: `src/graph/ParallelDevGraph.ts`
  - **内容**:
    - 全ノードからの遷移先が定義されているか確認
    - デッドロック（無限ループ）の可能性をチェック
    - 終了条件が正しく設定されているか確認
  - **成果物**: グラフ構造検証レポート
  - **見積**: 1.5時間
  - **担当**: -
  - **依存**: Task 3.2.1
  - **ステータス**: 🟢 未着手

---

## Phase 4: テスト実装

### 4.1 単体テスト（追加）

**優先度**: 🔥 最高

- 🟢 **Task 4.1.1**: EngineerDispatchNode の動的プーリングテスト
  - **ファイル**: `tests/graph/nodes/EngineerDispatchNode.test.ts`
  - **内容**: (Task 2.4.1で実施済み - 確認のみ)
  - **見積**: 0時間（Task 2.4.1に含まれる）
  - **担当**: -
  - **依存**: Task 2.4.1
  - **ステータス**: 🟢 未着手

### 4.2 グラフエッジのテスト

**優先度**: 🔥 最高

- 🟢 **Task 4.2.1**: review→engineer_dispatch エッジのテスト
  - **ファイル**: `tests/graph/ParallelDevGraph.test.ts`（新規作成の可能性）
  - **内容**:
    - レビュー完了時、空きスロットがある場合にengineer_dispatchに遷移することを確認
    - 空きスロットがない場合はmerge_coordinatorに遷移することを確認
  - **成果物**: 新規テストケース（2個）
  - **見積**: 2時間
  - **担当**: -
  - **依存**: Task 3.1.1
  - **ステータス**: 🟢 未着手

- 🟢 **Task 4.2.2**: merge_coordinator→engineer_dispatch エッジのテスト
  - **ファイル**: `tests/graph/ParallelDevGraph.test.ts`
  - **内容**:
    - マージ完了時の条件分岐をテスト
    - コンフリクト優先の動作確認
    - 空きスロットチェックの動作確認
  - **成果物**: 新規テストケース（3個）
  - **見積**: 2時間
  - **担当**: -
  - **依存**: Task 3.2.1
  - **ステータス**: 🟢 未着手

### 4.3 統合テスト（エンドツーエンド）

**優先度**: 🔥 最高

- 🟢 **Task 4.3.1**: 6タスク・maxEngineers=5 シナリオテスト
  - **ファイル**: `tests/integration/dynamic-task-pooling.test.ts`（新規作成）
  - **内容**:
    - 6つのタスク、maxEngineers=5 の状態を作成
    - Task1が完了した直後にTask6が開始されることを検証
    - タイムライン追跡（どの時点でどのタスクが開始/完了したか）
    - アイドル時間がゼロであることを検証
  - **成果物**: 統合テストケース（1個、詳細）
  - **見積**: 3時間
  - **担当**: -
  - **依存**: Task 3.3.1, Task 4.2.2
  - **ステータス**: 🟢 未着手

### 4.4 性能テスト

**優先度**: 中

- 🟢 **Task 4.4.1**: 実行時間短縮の検証テスト
  - **ファイル**: `tests/integration/dynamic-task-pooling.test.ts`
  - **内容**:
    - バッチ処理のシミュレーション関数を作成
    - 動的プーリングのシミュレーション関数を作成
    - 実行時間を比較し、20%以上の短縮を検証
  - **成果物**: 性能比較テストケース（1個）
  - **見積**: 3時間
  - **担当**: -
  - **依存**: Task 4.3.1
  - **ステータス**: 🟢 未着手

---

## Phase 5: ドキュメント更新

### 5.1 既存仕様書の更新

**優先度**: 中

- 🟢 **Task 5.1.1**: NODE_RESPONSIBILITIES_AND_WORKFLOW.md を更新
  - **ファイル**: `spec/NODE_RESPONSIBILITIES_AND_WORKFLOW.md`
  - **内容**:
    - セクション5「Workflow Flow」に動的タスクプーリングのフローを追加
    - EngineerDispatchNode の責務に「動的スロット計算」を追加
    - Mermaid図を更新（review→engineer_dispatchのエッジを追加）
  - **成果物**: 更新されたドキュメント
  - **見積**: 2時間
  - **担当**: -
  - **依存**: Task 4.3.1（実装完了後）
  - **ステータス**: 🟢 未着手

- 🟢 **Task 5.1.2**: parallel-development-workflow.md を更新
  - **ファイル**: `docs/parallel-development-workflow.md`
  - **内容**:
    - セクション4「開発パイプライン」に動的プーリング機構の説明を追加
    - バッチ処理との違いを明記
    - 性能改善のメリットを記載
  - **成果物**: 更新されたドキュメント
  - **見積**: 2時間
  - **担当**: -
  - **依存**: Task 5.1.1
  - **ステータス**: 🟢 未着手

### 5.2 統合ワークフロー仕様の更新

**優先度**: 中

- 🟢 **Task 5.2.1**: UNIFIED_SCRUM_WORKFLOW_SPECIFICATION.md を更新
  - **ファイル**: `spec/UNIFIED_SCRUM_WORKFLOW_SPECIFICATION.md`
  - **内容**:
    - セクション2.1「ワークフロー全体図」のMermaid図を更新
    - 動的プーリングのエッジを追加
    - 説明テキストを更新
  - **成果物**: 更新されたドキュメント
  - **見積**: 1.5時間
  - **担当**: -
  - **依存**: Task 5.1.2
  - **ステータス**: 🟢 未着手

---

## タスク統計

### Phase別見積

| Phase | タスク数 | 完了 | 進行中 | 未着手 | 見積時間 | 消化時間 | 優先度分布 |
|-------|---------|------|-------|-------|---------|---------|----------|
| Phase 1 | 3 | 0 | 0 | 3 | 4h | 0h | 🔥x1, 高x1 |
| Phase 2 | 4 | 0 | 0 | 4 | 3.5h | 0h | 🔥x4 |
| Phase 3 | 3 | 0 | 0 | 3 | 5h | 0h | 🔥x1, 高x2 |
| Phase 4 | 5 | 0 | 0 | 5 | 10h | 0h | 🔥x3, 中x1 |
| Phase 5 | 3 | 0 | 0 | 3 | 5.5h | 0h | 中x3 |
| **合計** | **18** | **0** | **0** | **18** | **28h** | **0h** | - |

**バッファ込み見積**: 28h × 1.25 = **35h** (約4.4日 @ 8h/日)

### 優先度別

- 🔥 **最高優先度**: 9タスク (50%, 16h)
- **高優先度**: 3タスク (17%, 5h)
- **中優先度**: 5タスク (28%, 7h)
- **低優先度**: 1タスク (5%, 0h - Task 4.1.1は2.4.1に含まれる)

### 完了率

- **全体**: 0% (0/18 タスク)
- **見積時間ベース**: 0% (0h/28h)

---

## 依存関係グラフ

```
Phase 1 (設計準備)
  ├─ 1.1.1 EngineerDispatchNode分析 (独立)
  ├─ 1.1.2 ParallelDevGraph分析 (独立)
  └─ 1.2.1 型定義確認 → 1.1.1, 1.1.2

Phase 2 (EngineerDispatchNode改修)
  ├─ 2.1.1 in_progressカウント → 1.1.1
  ├─ 2.2.1 空きスロットチェック → 2.1.1
  ├─ 2.3.1 動的ディスパッチ → 2.2.1
  └─ 2.4.1 単体テスト → 2.3.1

Phase 3 (ParallelDevGraph改修)
  ├─ 3.1.1 reviewエッジ追加 → 1.1.2, 2.3.1
  ├─ 3.2.1 mergeエッジ改善 → 3.1.1
  └─ 3.3.1 グラフ整合性確認 → 3.2.1

Phase 4 (テスト実装)
  ├─ 4.1.1 単体テスト確認 → 2.4.1
  ├─ 4.2.1 reviewエッジテスト → 3.1.1
  ├─ 4.2.2 mergeエッジテスト → 3.2.1
  ├─ 4.3.1 統合テスト → 3.3.1, 4.2.2
  └─ 4.4.1 性能テスト → 4.3.1

Phase 5 (ドキュメント更新)
  ├─ 5.1.1 NODE_RESPONSIBILITIES更新 → 4.3.1
  ├─ 5.1.2 parallel-development更新 → 5.1.1
  └─ 5.2.1 UNIFIED_SCRUM更新 → 5.1.2
```

---

## クリティカルパス

最長経路（完了までに最も時間がかかる経路）:

```
1.1.1 (1.5h) → 2.1.1 (0.5h) → 2.2.1 (0.5h) → 2.3.1 (0.5h) → 2.4.1 (2h)
→ 3.1.1 (2h) → 3.2.1 (1.5h) → 3.3.1 (1.5h) → 4.3.1 (3h) → 4.4.1 (3h)
→ 5.1.1 (2h) → 5.1.2 (2h) → 5.2.1 (1.5h)

合計: 22h (バッファ込み: 27.5h)
```

**並列実行の可能性**:
- Phase 1: 1.1.1 と 1.1.2 を並列実行可能 → **1.5h短縮**
- Phase 4: 4.2.1 と 4.2.2 を並列実行可能 → **2h短縮**

**最短完了時間**: 22h - 3.5h = **18.5h** (バッファ込み: **23h**)

---

## ブロッカー・リスク

### 現在のブロッカー

なし

### 潜在的リスク

1. **リスク1: グラフエッジの競合** (優先度: 🔥 高)
   - **内容**: review完了後のエッジが既存のエッジと競合する可能性
   - **影響**: グラフが正しく動作しない
   - **対策**: Task 3.1.1で既存エッジを慎重に確認、必要に応じて既存エッジを削除/修正
   - **緩和策**: Task 3.3.1でグラフ全体の整合性を確認

2. **リスク2: 状態の不整合** (優先度: 中)
   - **内容**: in_progress数のカウントと実際の状態がずれる可能性
   - **影響**: 空きスロット計算が誤る
   - **対策**: Task 2.4.1で厳密なテストを実施
   - **緩和策**: ログ出力を充実させて、実行時に状態を追跡可能にする

3. **リスク3: 性能改善が期待値に達しない** (優先度: 低)
   - **内容**: 実際の実行時間短縮が20%未満
   - **影響**: 投資対効果が低下
   - **対策**: Task 4.4.1で性能テストを実施、必要に応じて最適化
   - **緩和策**: タスク完了時間が均等な場合は改善が小さいことを認識（正常）

4. **リスク4: 既存テストの破壊** (優先度: 中)
   - **内容**: グラフ構造の変更により、既存の統合テストが失敗
   - **影響**: 実装完了が遅延
   - **対策**: Phase 4で全テストを実行し、失敗したテストを修正
   - **緩和策**: Task 1.1.2で既存テストを事前確認

---

## 次のアクション（優先順位順）

### 即座に開始可能なタスク

1. **Task 1.1.1**: EngineerDispatchNode の現在の実装を詳細分析 (🔥 最高優先度)
2. **Task 1.1.2**: ParallelDevGraph のエッジ定義を分析 (🔥 最高優先度)

**推奨**: 上記2タスクを**並列実行**して時間短縮

### Phase 1 完了後

3. **Task 1.2.1**: 型定義の確認（Task 1.1.1, 1.1.2 完了後）
4. **Task 2.1.1**: in_progressカウントロジック追加（Phase 2開始）

### Phase 2-3-4 の順次実行

5. Phase 2の全タスクを順次実行（クリティカルパス）
6. Phase 3の全タスクを順次実行（クリティカルパス）
7. Phase 4のテストを実行（4.2.1 と 4.2.2 は並列実行可能）

### Phase 5 でドキュメント更新

8. 全実装完了後、Phase 5のドキュメント更新を順次実行

---

## 実装開始前のチェックリスト

実装を開始する前に、以下を確認してください：

- [ ] `DYNAMIC_TASK_POOLING_SPECIFICATION.md` を読んで理解した
- [ ] 既存のワークフローを理解している（`parallel-development-workflow.md`）
- [ ] タスクステートマシンのルールを理解している（`TASK_STATE_MACHINE.md`）
- [ ] LangGraphの基本概念を理解している
- [ ] テスト環境が整っている（`npm test` が実行可能）
- [ ] Git branchを作成した（例: `feature/dynamic-task-pooling`）

---

## 完了条件

以下の条件を**すべて満たした場合**、動的タスクプーリングの実装が完了したとみなします：

### 必須条件

- ✅ Phase 1-4 の全タスクが完了している
- ✅ 全テストが成功している（`npm test` で全テストパス）
- ✅ 統合テスト（Task 4.3.1）で6タスクシナリオが正常動作する
- ✅ 実行時間短縮が確認できている（Task 4.4.1）
- ✅ 既存の全テストが破壊されていない

### 推奨条件

- ✅ Phase 5 のドキュメント更新が完了している
- ✅ Code reviewが完了している
- ✅ 実環境での動作確認が完了している

---

## 参考資料

### 仕様書

- [DYNAMIC_TASK_POOLING_SPECIFICATION.md](./DYNAMIC_TASK_POOLING_SPECIFICATION.md) - 動的タスクプーリングの設計仕様
- [NODE_RESPONSIBILITIES_AND_WORKFLOW.md](./NODE_RESPONSIBILITIES_AND_WORKFLOW.md) - ノードの責務とワークフロー
- [TASK_STATE_MACHINE.md](./TASK_STATE_MACHINE.md) - タスクステートマシン
- [UNIFIED_SCRUM_WORKFLOW_SPECIFICATION.md](./UNIFIED_SCRUM_WORKFLOW_SPECIFICATION.md) - 統合Scrumワークフロー

### ドキュメント

- [parallel-development-workflow.md](../docs/parallel-development-workflow.md) - 並列開発ワークフロー詳細

### コード

- `src/graph/nodes/EngineerDispatchNode.ts` - タスク割り当てノード
- `src/graph/ParallelDevGraph.ts` - LangGraphワークフロー定義
- `tests/graph/nodes/EngineerDispatchNode.test.ts` - 単体テスト
- `tests/integration/basic-workflow.test.ts` - 統合テスト例

---

**最終更新**: 2025-11-10
**次回更新予定**: 実装開始時（進捗に応じて更新）
