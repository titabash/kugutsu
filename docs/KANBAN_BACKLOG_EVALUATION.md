# Kanbanボード・バックログ流れの評価レポート

## 評価日時
2024年12月（最新修正後）

## 評価対象
スクラム開発におけるKanbanボードとバックログ（Product Backlog / Sprint Backlog）の状態遷移と同期の整合性

---

## 1. タスク状態遷移の流れ

### 1.1 正しい状態遷移パス

```
pending → in_progress → in_review → completed
                              ↓
                         in_progress (changes_requested)
```

### 1.2 各ノードでの状態遷移実装

| ノード | 遷移 | Sprint Backlog更新 | state.tasks更新 | 評価 |
|--------|------|-------------------|-----------------|------|
| **EngineerDispatchNode** | `pending → in_progress` | ✅ `updateSprintBacklogTask` | ✅ `TaskStateMachine.transition` | ✅ 正常 |
| **EngineerNode** | `in_progress → in_review` | ✅ `updateSprintBacklogTask` | ✅ `TaskStateMachine.transition` | ✅ 正常 |
| **ReviewNode** | `in_review → completed` (approved) | ✅ `updateSprintBacklogTask` | ✅ `TaskStateMachine.transition` | ✅ 正常 |
| **ReviewNode** | `in_review → in_progress` (changes_requested) | ✅ `updateSprintBacklogTask` | ✅ `TaskStateMachine.transition` | ✅ 正常 |
| **MergeCoordinatorNode** | `completed` 確認・更新 | ✅ 直接更新して保存 | ❌ **未実装** | ⚠️ **要修正** |

---

## 2. Sprint Backlog更新の実装状況

### 2.1 各ノードでの更新方法

#### ✅ EngineerDispatchNode
```typescript
// src/graph/nodes/EngineerDispatchNode.ts:148
await persistence.updateSprintBacklogTask(sprintId, task.id, {
  status: 'in_progress',
  worktreePath: result.path,
  branchName: result.branchName,
});
```
- **方法**: `updateSprintBacklogTask`を使用
- **タイミング**: worktree作成後、state更新前
- **評価**: ✅ 正常

#### ✅ EngineerNode
```typescript
// src/graph/nodes/EngineerNode.ts:743
await persistence.updateSprintBacklogTask(sprintId, taskId, {
  status: 'in_review',
  sessionId,
});
```
- **方法**: `updateSprintBacklogTask`を使用
- **タイミング**: 実装完了後
- **評価**: ✅ 正常

#### ✅ ReviewNode
```typescript
// src/graph/nodes/ReviewNode.ts:427-436
if (finalStatus === 'approved') {
  await persistence.updateSprintBacklogTask(sprintId, taskId, {
    status: 'completed',
  });
} else {
  await persistence.updateSprintBacklogTask(sprintId, taskId, {
    status: 'in_progress',
  });
}
```
- **方法**: `updateSprintBacklogTask`を使用
- **タイミング**: レビュー完了後
- **評価**: ✅ 正常

#### ✅ MergeCoordinatorNode（修正後）
```typescript
// src/graph/nodes/MergeCoordinatorNode.ts:212-224
const taskIndex = updatedBacklog.tasks.findIndex((t: any) => t.id === mergeTask.taskId);
if (taskIndex >= 0) {
  updatedBacklog.tasks[taskIndex] = {
    ...updatedBacklog.tasks[taskIndex],
    status: 'completed',
    updatedAt: new Date().toISOString(),
  };
  // ... メタデータ更新
}
// ループ後に保存
await persistence.saveSprintBacklog(sprintId, updatedBacklog);
```
- **方法**: 最初に読み込んだbacklogを直接更新して保存
- **タイミング**: マージ成功後、すべてのマージ処理完了後
- **評価**: ✅ 正常（ファイル再読み込み問題を回避）

---

## 3. 問題点と改善提案

### 3.1 ⚠️ 重大な問題: MergeCoordinatorNodeでのstate.tasks更新不足

**問題**:
- `MergeCoordinatorNode`では、Sprint Backlogは更新されるが、`state.tasks`が更新されていない
- Kanbanボードは`state.tasks`から読み込むため、マージ完了後もタスクが`in_review`のまま表示される可能性がある

**影響**:
- Kanbanボードの「完了」列にタスクが表示されない
- UIとSprint Backlogの状態が不一致になる

**修正案**:
```typescript
// MergeCoordinatorNode.ts の return 前に追加
const updatedStateTasks: Task[] = [];
for (const mergeTask of updatedMergeTasks) {
  if (mergeTask.status === 'completed') {
    const stateTask = state.tasks.find((t) => t.id === mergeTask.taskId);
    if (stateTask) {
      const completedTask = TaskStateMachine.transition(stateTask, 'completed');
      updatedStateTasks.push(completedTask);
    }
  }
}

return {
  tasks: updatedStateTasks, // state.tasksを更新
  mergeQueue: updatedMergeTasks,
  logs,
  // ...
};
```

### 3.2 ✅ 軽微な問題: エラーハンドリングの一貫性

**現状**:
- `EngineerDispatchNode`では、Sprint Backlog更新失敗時に警告を出して続行
- `MergeCoordinatorNode`では、保存失敗時にエラーを出して続行

**評価**:
- 一貫性はあるが、エラーレベルが異なる（警告 vs エラー）
- 現状の実装で問題なし

---

## 4. Kanbanボードとの連携

### 4.1 Kanbanボードのデータソース

```typescript
// electron/renderer/components/TaskKanbanBoard.tsx:61-74
const { tasks, setSelectedTaskId } = useAppStore()

const tasksByStatus = useMemo(() => {
  return COLUMNS.reduce(
    (acc, column) => {
      acc[column.status] = tasks
        .filter((task) => task.status === column.status)
        .sort((a, b) => b.priority - a.priority)
      return acc
    },
    {} as Record<TaskStatus, typeof tasks>
  )
}, [tasks])
```

**データソース**: `state.tasks`（`appStore`経由）

**問題**:
- Kanbanボードは`state.tasks`のみを参照
- Sprint Backlogの更新が`state.tasks`に反映されない場合、UIが更新されない

### 4.2 データフロー

```
Sprint Backlog (ファイル)
    ↓ (更新)
各ノードでの更新
    ↓
state.tasks (メモリ)
    ↓ (IPC経由)
appStore (Electron UI)
    ↓
TaskKanbanBoard (表示)
```

**評価**:
- データフローは正しいが、`MergeCoordinatorNode`で`state.tasks`が更新されないため、Kanbanボードに反映されない

---

## 5. バックログ管理の整合性

### 5.1 Product Backlog → Sprint Backlog の流れ

```
SprintPlanningNode
  ↓
Product Backlog (globalTasks, sprint: undefined)
  ↓
Sprint Backlog (globalTasks, sprint: 'xxx')
  ↓
Sprint Backlog (ファイル: .kugutsu/sprints/{sprintId}/sprint-backlog.json)
```

**評価**: ✅ 正常

### 5.2 Sprint Backlog → 完了 の流れ

```
Sprint Backlog (status: pending)
  ↓ EngineerDispatchNode
Sprint Backlog (status: in_progress)
  ↓ EngineerNode
Sprint Backlog (status: in_review)
  ↓ ReviewNode
Sprint Backlog (status: completed)
  ↓ MergeCoordinatorNode
Sprint Backlog (status: completed, 確認・保存)
```

**評価**: ✅ 正常（ただし、state.tasks更新が必要）

---

## 6. 総合評価

### 6.1 正常に動作している部分

1. ✅ **タスク状態遷移**: TaskStateMachineによる厳密なバリデーション
2. ✅ **Sprint Backlog更新**: 各ノードで適切に更新されている
3. ✅ **エラーハンドリング**: ファイルが見つからない場合のフォールバック
4. ✅ **データ永続化**: Sprint Backlogファイルへの保存が確実に実行される

### 6.2 改善が必要な部分

1. ⚠️ **MergeCoordinatorNodeでのstate.tasks更新**: 未実装
   - **影響度**: 高（Kanbanボードに反映されない）
   - **優先度**: 高

2. ✅ **エラーハンドリングの一貫性**: 軽微な問題
   - **影響度**: 低
   - **優先度**: 低

---

## 7. 推奨される修正

### 7.1 必須修正: MergeCoordinatorNodeでのstate.tasks更新

`src/graph/nodes/MergeCoordinatorNode.ts`の`return`前に以下を追加:

```typescript
// Update state.tasks for completed merges
const updatedStateTasks: Task[] = [];
for (const mergeTask of updatedMergeTasks) {
  if (mergeTask.status === 'completed') {
    const stateTask = state.tasks.find((t) => t.id === mergeTask.taskId);
    if (stateTask && stateTask.status !== 'completed') {
      try {
        const completedTask = TaskStateMachine.transition(stateTask, 'completed');
        updatedStateTasks.push(completedTask);
        console.log(`📝 state.tasksを更新しました: ${mergeTask.taskId} → completed`);
      } catch (error) {
        console.warn(`⚠️ state.tasksの更新に失敗: ${mergeTask.taskId}`, error);
      }
    }
  }
}

// Sync to globalTasks
const updatedGlobalTasks: GlobalTask[] = [];
for (const completedTask of updatedStateTasks) {
  const globalTask = state.globalTasks.find((t) => t.id === completedTask.id);
  if (globalTask) {
    updatedGlobalTasks.push({
      ...globalTask,
      status: 'completed',
      updatedAt: new Date(),
    });
  }
}

return {
  tasks: updatedStateTasks, // ← 追加
  globalTasks: updatedGlobalTasks, // ← 追加
  mergeQueue: updatedMergeTasks,
  logs,
  metadata: {
    phase: 'merge',
  },
};
```

---

## 8. 結論

### 8.1 現状の評価

- **Sprint Backlog更新**: ✅ 正常に動作
- **タスク状態遷移**: ✅ TaskStateMachineによる厳密な管理
- **Kanbanボード連携**: ⚠️ MergeCoordinatorNodeでのstate.tasks更新が必要

### 8.2 修正後の期待される動作

1. ✅ Sprint Backlogが確実に更新される（修正済み）
2. ✅ state.tasksが更新され、Kanbanボードに反映される（修正必要）
3. ✅ マージ完了後、タスクが「完了」列に表示される（修正必要）

### 8.3 次のステップ

1. **必須**: `MergeCoordinatorNode`での`state.tasks`更新を実装
2. **推奨**: テストケースの追加（Kanbanボード表示の検証）
3. **任意**: エラーハンドリングの一貫性向上

---

## 9. 参考資料

- `src/utils/TaskStateMachine.ts`: 状態遷移ルール定義
- `src/graph/nodes/MergeCoordinatorNode.ts`: マージ処理とSprint Backlog更新
- `electron/renderer/components/TaskKanbanBoard.tsx`: KanbanボードUI実装
- `spec/TASK_STATE_MACHINE.md`: 状態遷移仕様書
