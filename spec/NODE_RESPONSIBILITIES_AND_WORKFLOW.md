# Node Responsibilities and Workflow

## Overview

このドキュメントでは、Kugutsuシステムにおける各ノードの役割と、ワークフロー全体の流れを定義します。

## Node Classification

ノードは以下の4つのカテゴリに分類されます：

### 1. オーケストレーターノード（Orchestrator）

**作業場所**: `.kugutsu/`ディレクトリ
**役割**: ユーザーとの対話、ワークフロー全体の制御、他ノードの呼び出し
**成果物**: メタデータ、タスク定義

- **ProductOwnerNode** - ユーザーと直接対話し、ワークフロー全体を制御

### 2. 補助ノード（Helper Nodes）

**作業場所**: `.kugutsu/`ディレクトリ
**役割**: ProductOwnerNodeから呼び出され、特定の成果物を作成
**成果物**: ストーリーマップ、スプリント計画

- **DirectorNode** - ユーザーストーリーマップの作成・更新
- **SprintPlanningNode** - スプリント計画の作成

### 3. 実装・レビューノード（Implementation & Review）

**作業場所**: `worktrees/`ディレクトリ（実装）、`.kugutsu/`ディレクトリ（レビュー結果）
**役割**: コーディング、レビュー、コンフリクト解決
**成果物**: gitコミット（実装）、レビュー結果JSON

- **EngineerNode** - タスクの実装
- **ReviewNode** - コードレビュー
- **ConflictResolverNode** - マージコンフリクトの解決

### 4. 統合ノード（Coordination & Management）

**作業場所**: ベースリポジトリ
**役割**: タスクのディスパッチ、マージの調整、完了チェック
**成果物**: マージ結果、ステータス更新

- **EngineerDispatchNode** - タスクのディスパッチとworktree管理
- **MergeCoordinatorNode** - マージの調整と実行
- **CheckCompletionNode** - ワークフロー完了チェック

## Node Responsibilities

### ProductOwnerNode

**カテゴリ**: 上流工程（ワークフローのオーケストレーター）
**役割**: ユーザーとの対話、要求分析、タスク分割、他ノードの呼び出し

**作業場所**:
- `.kugutsu/`

**読み取るファイル**:
- ユーザーの要求（Stateから）
- プロジェクトの設定ファイル（package.json, tsconfig.json等）
- `.kugutsu/story-map.json`（DirectorNodeが作成した場合）
- `.kugutsu/sprint-plan.json`（SprintPlanningNodeが作成した場合）

**生成するファイル**:
- `.kugutsu/tech-stack.json` - 技術スタック分析結果
- `.kugutsu/requirements.json` - 要求分析結果
- `.kugutsu/tasks.json` - タスク定義（全タスクのメタデータ）
- `.kugutsu/tasks/{taskId}/instruction.md` - 各タスクの詳細指示

**更新するファイル**:
- `.kugutsu/tasks.json` - SprintPlanningNode実行後に調整する場合

**他ノードの呼び出し**:
- **DirectorNode**: 必要に応じてユーザーストーリーマップ作成を依頼
- **SprintPlanningNode**: 必要に応じてスプリント計画作成を依頼（タスクまたはストーリーマップ作成後）

**Stateへの出力**:
- タスクリスト（ステータス: `pending`）
- ファイルパス情報

**実行フェーズ**: ワークフロー開始時

**次のノード**: EngineerDispatchNode

**重要な注意事項**:
- ProductOwnerNodeはユーザーと直接対話する唯一のノード
- ユーザーの指示に基づいて、DirectorNodeやSprintPlanningNodeを呼び出す
- StandardワークフローとScrumワークフローの違いは、ProductOwnerNodeが他ノードを呼び出すかどうか

---

### InstructionGeneratorNode

**カテゴリ**: 統合
**役割**: スプリントスコープのタスクについて並列でinstruction.md生成

**作業場所**:
- `.kugutsu/sprints/sprint-{N}/tasks/{taskId}/`

**読み取るファイル**:
- `state.activeSprint.taskIds` - スプリント内タスクリスト
- `state.globalTasks` - 全タスク情報
- `.kugutsu/projects/{projectId}/story-mapping/` - ストーリーマッピング（高複雑度パス）
- `.kugutsu/projects/{projectId}/design/` - 設計書（高複雑度パス）

**生成するファイル**:
- `.kugutsu/sprints/sprint-{N}/tasks/{taskId}/instruction.md` - 各タスクの詳細指示

**更新するファイル**:
- なし

**Stateへの出力**:
- ログ情報

**実行フェーズ**: スプリント計画後、タスク実行前

**次のノード**: EngineerDispatchNode

**重要な注意事項**:
- スプリントスコープのタスクのみ処理（`activeSprint.taskIds`でフィルタリング）
- 並列実行パターン（Promise.allSettled）を使用
- 高複雑度パス（設計書あり）と低複雑度パス（設計書なし）の両方に対応

---

### EngineerDispatchNode

**カテゴリ**: 統合
**役割**: タスクのディスパッチとworktree管理（動的タスクプーリング対応）

**作業場所**:
- ベースリポジトリ

**読み取るファイル**:
- `.kugutsu/tasks.json` - タスクリストとステータス

**生成するファイル**:
- なし（worktreeの作成のみ）

**更新するファイル**:
- `.kugutsu/tasks.json` - タスクステータスを`in_progress`に更新

**Stateへの出力**:
- 実行可能なタスクのリスト
- worktreeパス情報

**実行フェーズ**: instruction.md生成後、およびレビュー・マージ完了後（動的プーリング）

**次のノード**: EngineerNode（並列実行）

**🔄 動的タスクプーリング機能**:

EngineerDispatchNodeは動的タスクプーリングをサポートしています：

1. **空きスロット計算**:
   - 現在のin_progress数をカウント
   - 利用可能なスロット = maxEngineers - in_progress数

2. **動的ディスパッチ**:
   - 空きスロット分のみタスクをディスパッチ
   - 依存関係を厳密にチェック（すべての依存タスクがcompletedであることを確認）

3. **再実行タイミング**:
   - 初回: instruction.md生成後
   - 2回目以降: ReviewNode完了後、MergeCoordinatorNode完了後

4. **リソース効率化**:
   - タスクが完了した瞬間に次のタスクを開始
   - アイドル時間を最小化（実行時間20-30%短縮）

**依存関係チェック**:
- `TaskStateMachine.canMoveToReady()`を使用
- 依存タスクが`in_progress`や`in_review`では不十分
- 必ず`completed`（レビュー承認・マージ完了）であることを要求

---

### EngineerNode

**カテゴリ**: 下流工程
**役割**: タスクの実装

**作業場所**:
- `worktrees/task-{taskId}/` - タスク専用のworktree

**読み取るファイル**:
- `.kugutsu/tasks/{taskId}/instruction.md` - タスクの詳細指示

**生成するファイル**:
- `worktrees/task-{taskId}/src/**/*` - 実装コード
- `worktrees/task-{taskId}/tests/**/*` - テストコード
- gitコミット - 実装内容

**更新するファイル**:
- `.kugutsu/tasks.json` - タスクステータスを`implemented`に更新

**Stateへの出力**:
- 実装完了フラグ
- コミットハッシュ

**実行フェーズ**: タスク実装時（並列実行可能）

**次のノード**: ReviewNode

**重要な注意事項**:
- EngineerNodeは**worktree内**で作業する
- ベースリポジトリは変更しない
- 実装結果はgitコミットとして記録
- コミットメッセージに実装内容の要約を含める

---

### ReviewNode

**カテゴリ**: 下流工程
**役割**: コードレビュー

**作業場所**:
- ベースリポジトリ（worktreeを読み取り専用で参照）

**読み取るファイル**:
- `worktrees/task-{taskId}/` - 実装コード
- `worktrees/task-{taskId}/` のgitコミット履歴

**生成するファイル**:
- `.kugutsu/tasks/{taskId}/review.json` - レビュー結果

**更新するファイル**:
- `.kugutsu/tasks.json` - タスクステータスを`reviewed`に更新

**Stateへの出力**:
- レビュー結果（approved/changes_requested/rejected）
- コメントとサジェスション

**実行フェーズ**: 実装完了後（並列実行可能）

**次のノード**:
- approved → MergeCoordinatorNode
- changes_requested → EngineerNode（再実装）
- rejected → タスク失敗

---

### MergeCoordinatorNode

**カテゴリ**: 統合
**役割**: マージの調整と実行

**作業場所**:
- ベースリポジトリ

**読み取るファイル**:
- `.kugutsu/tasks/{taskId}/review.json` - レビュー結果
- `.kugutsu/tasks.json` - タスクステータス

**生成するファイル**:
- `.kugutsu/tasks/{taskId}/merge-result.json` - マージ結果

**更新するファイル**:
- `.kugutsu/tasks.json` - タスクステータスを`completed`に更新（成功時）

**Stateへの出力**:
- マージ成功/失敗フラグ
- コンフリクト情報（失敗時）

**実行フェーズ**: レビュー承認後

**次のノード**:
- 成功 → CheckCompletionNode
- コンフリクト → ConflictResolverNode
- 失敗 → タスク失敗

**重要な注意事項**:
- マージ成功 = タスク完了
- `.kugutsu/tasks.json`の更新が必須（カンバンボードUI反映のため）

---

### ConflictResolverNode

**カテゴリ**: 下流工程
**役割**: マージコンフリクトの解決

**作業場所**:
- `worktrees/task-{taskId}/` - コンフリクトが発生したworktree

**読み取るファイル**:
- `.kugutsu/tasks/{taskId}/merge-result.json` - コンフリクト情報
- worktree内のコンフリクトファイル

**生成するファイル**:
- worktree内のコンフリクト解決されたファイル
- `.kugutsu/tasks/{taskId}/conflicts.json` - 解決記録
- gitコミット - コンフリクト解決内容

**更新するファイル**:
- `.kugutsu/tasks.json` - タスクステータスを`conflict_resolved`に更新

**Stateへの出力**:
- コンフリクト解決完了フラグ

**実行フェーズ**: マージコンフリクト発生時

**次のノード**: MergeCoordinatorNode（再マージ）

---

### CheckCompletionNode

**カテゴリ**: 統合
**役割**: ワークフロー完了チェック

**作業場所**:
- ベースリポジトリ

**読み取るファイル**:
- `.kugutsu/tasks.json` - 全タスクのステータス

**生成するファイル**:
- なし

**更新するファイル**:
- なし

**Stateへの出力**:
- 完了/継続フラグ
- 次に実行するタスク（継続の場合）

**実行フェーズ**: 各タスク完了後

**次のノード**:
- 全タスク完了 → ワークフロー終了
- 未完了タスクあり → EngineerDispatchNode

---

### DirectorNode (Scrum)

**カテゴリ**: 上流工程（補助ノード）
**役割**: ユーザーストーリーマップの作成・更新

**作業場所**:
- `.kugutsu/`

**読み取るファイル**:
- ユーザーの要求（ProductOwnerNodeから渡される）
- `.kugutsu/story-map.json` - 既存のストーリーマップ（更新の場合）

**生成するファイル**:
- `.kugutsu/story-map.json` - ストーリーマップ

**更新するファイル**:
- `.kugutsu/story-map.json` - 既存のストーリーマップを更新する場合

**Stateへの出力**:
- ストーリーマップ情報

**実行フェーズ**: ProductOwnerNodeからの呼び出し（必要に応じて）

**次のノード**: ProductOwnerNode（呼び出し元に戻る）

**重要な注意事項**:
- ProductOwnerNodeから明示的に呼び出される補助ノード
- ユーザーの指示に基づいてストーリーマップを作成または更新する
- 作成後、ProductOwnerNodeがこれをもとにタスク生成やスプリント計画を行う

---

### SprintPlanningNode (Scrum)

**カテゴリ**: 上流工程（補助ノード）
**役割**: スプリント計画の作成

**作業場所**:
- `.kugutsu/`

**前提条件**:
- `.kugutsu/story-map.json`（DirectorNodeが作成）、または
- `.kugutsu/tasks.json`（ProductOwnerNodeが作成した初期タスク）

のいずれかが存在している必要がある

**読み取るファイル**:
- `.kugutsu/story-map.json` - ストーリーマップ（存在する場合）
- `.kugutsu/tasks.json` - 初期タスク（存在する場合）

**生成するファイル**:
- `.kugutsu/sprint-plan.json` - スプリント計画

**更新するファイル**:
- なし

**Stateへの出力**:
- スプリント情報

**実行フェーズ**: ProductOwnerNodeからの呼び出し（ストーリーマップまたはタスク作成後）

**次のノード**: ProductOwnerNode（呼び出し元に戻る）

**重要な注意事項**:
- ProductOwnerNodeから明示的に呼び出される補助ノード
- ストーリーマップまたはタスクが既に存在している必要がある
- スプリント計画作成後、ProductOwnerNodeがタスクを調整する場合がある

---

## Workflow Flow

### Unified Workflow (Standard & Scrum)

ProductOwnerNodeを中心とした統一ワークフロー：

```
[Start]
  ↓
[ProductOwnerNode] ← ユーザーと対話
  ├─ 技術スタック分析
  ├─ 要求分析
  │
  ├─ 必要に応じて [DirectorNode] 呼び出し
  │   └─ .kugutsu/story-map.json 作成
  │
  ├─ タスク生成（初期版）
  │   └─ .kugutsu/tasks.json 作成
  │
  ├─ 必要に応じて [SprintPlanningNode] 呼び出し
  │   ├─ 入力: story-map.json or tasks.json
  │   └─ 出力: sprint-plan.json
  │
  └─ タスク確定
      └─ .kugutsu/tasks.json 最終化
  ↓
[InstructionGeneratorNode] × N (並列実行)
  - スプリントスコープのタスクについてinstruction.md生成
  - .kugutsu/sprints/sprint-{N}/tasks/{taskId}/instruction.md 作成
  ↓
[EngineerDispatchNode]
  - タスクのディスパッチ
  - worktree作成
  ↓
[EngineerNode] × N (並列実行)
  - worktree内で実装
  - gitコミット
  ↓ (gitコミット)
[ReviewNode] × N (並列実行)
  - コードレビュー
  - review.json作成
  ↓ (.kugutsu/tasks/{taskId}/review.json)
[MergeCoordinatorNode]
  - レビュー承認確認
  - gitマージ実行
  - tasks.json更新（status: completed）
  ↓
  ├─ 成功 → [CheckCompletionNode]
  │           ↓
  │         - 全タスク完了？
  │           ├─ Yes → [End]
  │           └─ No → [EngineerDispatchNode]
  │
  └─ コンフリクト → [ConflictResolverNode]
                      - worktree内でコンフリクト解決
                      - gitコミット
                      ↓
                    [MergeCoordinatorNode] (再マージ)
```

**重要なポイント:**
- StandardとScrumは基本的に同じワークフロー
- 違いはProductOwnerNodeが補助ノード（DirectorNode/SprintPlanningNode）を呼び出すかどうか
- ユーザーの指示に基づいてProductOwnerNodeが柔軟に対応

## Data Flow Summary

### Phase 1: 要求分析

```
User Request
  ↓
ProductOwnerNode (AI)
  ↓
.kugutsu/tech-stack.json
.kugutsu/requirements.json
.kugutsu/tasks.json
```

### Phase 1.5: Instruction生成

```
SprintPlanningNode (スプリント計画)
  ↓
InstructionGeneratorNode (AI, 並列実行)
  ↓
.kugutsu/sprints/sprint-{N}/tasks/{taskId}/instruction.md
```

### Phase 2: 実装

```
.kugutsu/tasks/{taskId}/instruction.md
  ↓
EngineerNode (AI in worktree)
  ↓
worktrees/task-{taskId}/src/**/*
worktrees/task-{taskId}/tests/**/*
git commit
  ↓
.kugutsu/tasks.json (status: implemented)
```

### Phase 3: レビュー

```
worktrees/task-{taskId}/
  ↓
ReviewNode (AI)
  ↓
.kugutsu/tasks/{taskId}/review.json
.kugutsu/tasks.json (status: reviewed)
```

### Phase 4: マージ

```
.kugutsu/tasks/{taskId}/review.json
  ↓
MergeCoordinatorNode (git merge)
  ↓
.kugutsu/tasks/{taskId}/merge-result.json
.kugutsu/tasks.json (status: completed)
main branch (merged)
```

### Phase 5: UI反映

```
.kugutsu/tasks.json
  ↓
Electron UI (file watcher)
  ↓
Kanban Board Update
```

## Node Execution Order

### 順序実行が必要なノード

1. **ProductOwnerNode** → **EngineerDispatchNode**
   - タスク生成完了後にディスパッチ

2. **EngineerNode** → **ReviewNode**
   - 実装完了後にレビュー

3. **ReviewNode** → **MergeCoordinatorNode**
   - レビュー承認後にマージ

4. **MergeCoordinatorNode** → **CheckCompletionNode**
   - マージ完了後に完了チェック

### 並列実行可能なノード

1. **EngineerNode** × N
   - 複数のタスクを同時に実装可能

2. **ReviewNode** × N
   - 複数のタスクを同時にレビュー可能

### コンフリクト時の再実行フロー

```
MergeCoordinatorNode (conflict detected)
  ↓
ConflictResolverNode
  ↓
MergeCoordinatorNode (retry)
  ↓
  ├─ 成功 → CheckCompletionNode
  └─ 失敗 → Task Failed
```

## File Lifecycle

### `.kugutsu/` Files

| ファイル | 作成者 | タイミング | 更新者 | 削除タイミング |
|---------|--------|----------|--------|--------------|
| `tech-stack.json` | ProductOwnerNode | 要求分析時 | なし | ワークフロー完了後 |
| `requirements.json` | ProductOwnerNode | 要求分析時 | なし | ワークフロー完了後 |
| `tasks.json` | ProductOwnerNode | タスク生成時 | 各ノード | ワークフロー完了後 |
| `tasks/{taskId}/instruction.md` | ProductOwnerNode | タスク生成時 | なし | ワークフロー完了後 |
| `tasks/{taskId}/review.json` | ReviewNode | レビュー時 | なし | ワークフロー完了後 |
| `tasks/{taskId}/merge-result.json` | MergeCoordinatorNode | マージ時 | なし | ワークフロー完了後 |
| `tasks/{taskId}/conflicts.json` | ConflictResolverNode | コンフリクト解決時 | なし | ワークフロー完了後 |

### `worktrees/` Files

| ファイル | 作成者 | タイミング | 更新者 | 削除タイミング |
|---------|--------|----------|--------|--------------|
| `task-{taskId}/` | EngineerDispatchNode | タスクディスパッチ時 | なし | マージ完了後（optional） |
| `task-{taskId}/src/**/*` | EngineerNode | 実装時 | ConflictResolverNode | マージ完了後 |
| `task-{taskId}/tests/**/*` | EngineerNode | 実装時 | ConflictResolverNode | マージ完了後 |

## State Management

### State Contents

```typescript
interface ParallelDevState {
  // メタデータ
  userRequest: string;
  config: ParallelDevConfig;

  // ファイルパス（実際のデータはファイルに）
  techStackFile: string;        // '.kugutsu/tech-stack.json'
  requirementsFile: string;     // '.kugutsu/requirements.json'
  tasksFile: string;            // '.kugutsu/tasks.json'

  // タスクステータス（制御情報）
  tasks: Array<{
    id: string;
    status: TaskStatus;
    worktreePath: string;       // 'worktrees/task-001/'
    instructionFile: string;    // '.kugutsu/tasks/task-001/instruction.md'
    reviewFile?: string;        // '.kugutsu/tasks/task-001/review.json'
    mergeResultFile?: string;   // '.kugutsu/tasks/task-001/merge-result.json'
  }>;

  // ワークフロー制御
  currentPhase: WorkflowPhase;
  errors: string[];
  logs: LogEntry[];
}
```

### Task Status Transitions

```
pending
  ↓ (EngineerDispatchNode)
in_progress
  ↓ (EngineerNode)
implemented
  ↓ (ReviewNode)
reviewed
  ↓ (MergeCoordinatorNode - success)
completed

         ↓ (MergeCoordinatorNode - conflict)
  conflict_detected
         ↓ (ConflictResolverNode)
  conflict_resolved
         ↓ (MergeCoordinatorNode - retry)
       completed
```

## Error Handling

### Node-Level Error Handling

各ノードは以下のエラーを処理する必要があります：

1. **ProductOwnerNode**
   - AI実行エラー
   - ファイル作成エラー
   - JSONパースエラー

2. **EngineerNode**
   - worktree作成エラー
   - AI実行エラー
   - git操作エラー

3. **ReviewNode**
   - ファイル読み取りエラー
   - AI実行エラー

4. **MergeCoordinatorNode**
   - マージコンフリクト
   - git操作エラー

5. **ConflictResolverNode**
   - コンフリクト解決失敗
   - git操作エラー

### Error Recovery Strategy

| エラータイプ | 対応 |
|------------|------|
| AI実行エラー | リトライ（最大3回） |
| ファイルIOエラー | ログ記録、タスク失敗 |
| gitコンフリクト | ConflictResolverNodeへ |
| git操作エラー | ログ記録、タスク失敗 |
| JSONパースエラー | デフォルト値使用、またはタスク失敗 |

## Performance Considerations

### 並列実行の最適化

1. **EngineerNode**: `maxEngineers`設定（デフォルト: 3）
   - CPU/メモリリソースに応じて調整

2. **ReviewNode**: EngineerNodeと同数の並列実行
   - レビューは軽量なのでリソース制約少ない

3. **MergeCoordinatorNode**: 順次実行（mutex保護）
   - mainブランチの整合性を保つため

### ファイルIOの最適化

1. `.kugutsu/tasks.json`の更新頻度を最小化
2. worktreeの作成/削除を適切に管理
3. 大きなファイルの読み取りはストリーミング処理

## References

- [ARTIFACT_MANAGEMENT_SPECIFICATION.md](./ARTIFACT_MANAGEMENT_SPECIFICATION.md)
- [TASK_STATE_MACHINE.md](./TASK_STATE_MACHINE.md)
- [ARCHITECTURE_DESIGN.md](./ARCHITECTURE_DESIGN.md)
- [DATA_PERSISTENCE_SPECIFICATION.md](./DATA_PERSISTENCE_SPECIFICATION.md)
