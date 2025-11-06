# Glossary - 用語集

**プロジェクト**: Kugutsu 2.0 - AI Parallel Development System
**バージョン**: 2.0.0-alpha
**最終更新**: 2025-11-06
**ステータス**: Draft

---

## 1. 概要

本ドキュメントは、Kugutsu 2.0プロジェクト全体で使用する用語を定義します。全てのドキュメント、コード、コメントでこの用語集に従うことで、プロジェクト全体の一貫性を保ちます。

---

## 2. 状態管理関連

### ParallelDevState
**正式名称**: Parallel Development State
**使用箇所**: LangGraph層（src/graph/state.ts）
**定義**: LangGraphのStateGraphで使用する状態型。システム全体の実行状態を保持。
**型定義**:
```typescript
export const ParallelDevState = Annotation.Root({
  userRequest: Annotation<string>,
  globalTasks: Annotation<GlobalTask[]>,
  activeSprint: Annotation<Sprint | null>,
  sprints: Annotation<Sprint[]>,
  // ...
});

export type ParallelDevStateType = typeof ParallelDevState.State;
```

**使用例**: `export function productOwnerNode(state: ParallelDevStateType): Partial<ParallelDevStateType>`

---

### AppState
**正式名称**: Application State
**使用箇所**: UI層（electron/renderer/store/appStore.ts）
**定義**: Zustandで管理するRendererプロセスの状態。UI表示に必要な情報のみ保持。
**型定義**:
```typescript
interface AppState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  tasks: Task[];
  logs: LogEntry[];
  // ...
}
```

**使用例**: `export const useAppStore = create<AppState>()(...)`

**ParallelDevStateとの違い**:
- ParallelDevState: LangGraph実行全体の状態（Main Process）
- AppState: UI表示用の状態（Renderer Process）

---

## 3. タスク関連

### Task
**正式名称**: Task
**使用箇所**: UI層、一部のユーティリティ
**定義**: UI表示用の簡易タスク型。GlobalTaskのサブセット。
**型定義**:
```typescript
interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: number;
}
```

---

### GlobalTask
**正式名称**: Global Task
**使用箇所**: LangGraph層、グローバルタスクキュー
**定義**: プロジェクト横断的に管理される完全なタスク情報。
**型定義**:
```typescript
interface GlobalTask {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: number;
  dependencies: string[];
  estimatedHours: number;
  sprint?: string; // スプリントID
  createdAt: Date;
  updatedAt: Date;
}
```

**Taskとの違い**:
- Task: UI表示用の最小限の情報
- GlobalTask: システム全体で管理する完全な情報

---

### TaskStatus
**正式名称**: Task Status
**定義**: タスクの実行状態。6ステータスで管理。
**型定義**:
```typescript
type TaskStatus =
  | 'pending'      // 待機中（依存関係未解決）
  | 'ready'        // 実行可能（依存関係解決済み）
  | 'in_progress'  // 実行中
  | 'in_review'    // レビュー中
  | 'completed'    // 完了
  | 'failed';      // 失敗
```

**状態遷移**: TASK_STATE_MACHINE.mdを参照

---

## 4. スプリント関連

### Sprint
**正式名称**: Sprint
**定義**: AI駆動で自動生成される8-16時間の作業単位。E2Eでテスト・デプロイ可能な機能単位。
**型定義**:
```typescript
interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal: string;
  taskIds: string[];
  status: 'planning' | 'active' | 'review' | 'completed';
  estimatedHours: number;
  actualHours?: number;
  startedAt?: Date;
  completedAt?: Date;
  deployable: boolean;
}
```

**従来のスクラムとの違い**:
- 従来: 1-4週間、人間がスプリント計画会議で決定
- Kugutsu 2.0: 8-16時間、AIが自動計画・自動レビュー

---

### AI駆動スプリント
**正式名称**: AI-Driven Sprint
**別名**: Automated Sprint
**定義**: SprintPlanningNodeが自動生成し、SprintReviewNodeが自動判定するスプリント。人間の介入なし。

**特徴**:
1. **8-16時間単位**: 短期間で完結
2. **E2Eデプロイ可能**: 各スプリントは独立してデプロイ可能な機能単位
3. **自動ループ**: 未完了タスクがある限り次スプリントを自動生成

---

### スプリントループ
**正式名称**: Sprint Loop
**定義**: SprintReviewNode → SprintPlanningNodeへの自動的な繰り返し処理。

**フロー**:
```
SprintPlanningNode → EngineerDispatch → Engineer → Review → Merge → SprintReviewNode
       ↑                                                                    |
       |                                                                    |
       └────────────────────────────────────────────────────────────────────┘
                              (未完了タスクあり)
```

---

## 5. AI関連

### AIノード
**正式名称**: AI Node
**定義**: LangGraphのノードとして実装されたAIエージェント。

**主要なAIノード**:
- ProductOwnerNode: 要求整理
- CheckModeNode: 継続モード判定
- SprintPlanningNode: AI駆動スプリント計画
- EngineerNode: コード実装
- ReviewNode: コードレビュー
- SprintReviewNode: AI駆動スプリントレビュー

---

### IAIProvider
**正式名称**: AI Provider Interface
**定義**: Claude Agent SDK、OpenAI Codex SDKを抽象化するインターフェース。

**実装**:
- ClaudeAgentProvider
- OpenAICodexProvider

---

## 6. モード関連

### 継続モード
**正式名称**: Continuation Mode
**別名**: AI継続モード
**定義**: CheckModeNodeがAI判定した結果、既存のアクティブスプリントにタスクを追加するモード。

**新規モードとの違い**:
- 新規モード: 新しいプロジェクト・スプリントを開始
- 継続モード: 既存のアクティブスプリントにタスクを追加

---

## 7. データ永続化関連

### グローバルタスクキュー
**正式名称**: Global Task Queue
**定義**: 複数プロジェクトのタスクを一元管理するキュー。

**保存場所**: `.kugutsu/tasks/global-queue.json`

**特徴**:
- プロジェクト横断的なタスク管理
- 動的優先度計算
- スプリント割り当て管理

---

### 動的優先度
**正式名称**: Dynamic Priority
**定義**: basePriority、recencyBonus、dependencyBonusを組み合わせて計算される優先度。

**計算式**:
```
dynamicPriority = basePriority * 0.5 + recencyBonus * 0.3 + dependencyBonus * 0.2
```

---

## 8. ワークフロー関連

### 2層構造
**定義**: Kugutsu 2.0のワークフロー構造。

**上位レイヤー（スクラム開発プロセス）**:
- ユーザー要求整理 → ストーリーマッピング → 設計書作成 → タスク分解
- DirectorAI、ProductOwnerAI、TechLeadAIによる合意形成

**下位レイヤー（スプリント駆動開発）**:
- タスクを8-16時間単位のスプリントに自動グルーピング
- 並列エンジニア実行 → レビュー → マージ
- AI駆動の自動スプリントループ

---

## 9. 技術スタック関連

### LangGraphJS
**正式名称**: LangGraph for JavaScript
**定義**: LangChain.jsのワークフローエンジン。StateGraphでノードベースのワークフローを構築。

**主要API**:
- `StateGraph`: ワークフロー定義
- `Annotation.Root`: State型定義
- `Send`: 動的並列実行

---

### Claude Agent SDK
**正式名称**: Claude Agent SDK (TypeScript)
**定義**: Claudeを使ったエージェント実装用SDK。

**主要機能**:
- `query()`: エージェント実行
- `allowedTools`: ツール許可リスト
- `maxTurns`: 最大ターン数

---

### OpenAI Codex SDK
**正式名称**: OpenAI Codex SDK
**定義**: OpenAI Codexを使ったコード生成用SDK。

---

## 10. UI関連

### React 19
**正式名称**: React 19.2.0
**主要新機能**:
- `forwardRef`の非推奨化（refをpropsとして直接受け取り）
- `use` Hook（Promise/Contextの簡潔な使用）
- `Suspense`の改善

---

### Vite 7
**正式名称**: Vite 7.1.12
**重要な制約**: **Node.js 20.19+ または 22.12+ が必須**

**理由**: Vite 7はNode.js 18のサポートを終了

---

## 11. プロジェクト管理関連

### Phase
**定義**: 実装タスクのフェーズ分け。

**フェーズ一覧**:
- Phase 1: 基礎実装
- Phase 2: AI Provider抽象化
- Phase 3: UI統合
- Phase 4: グラフビジュアライゼーション
- Phase 5: ログビューア
- Phase 6: (未定義)
- Phase 7: スプリント駆動開発機能実装

---

## 12. セキュリティ関連

### contextBridge
**定義**: ElectronのPreload Scriptで使用するセキュアなIPC橋渡し機構。

**使用例**:
```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  onGraphEventsBatch: (callback) => ipcRenderer.on('graph-events-batch', callback)
});
```

---

## 13. 略語・頭字語

| 略語 | 正式名称 | 意味 |
|------|---------|------|
| PO | Product Owner | プロダクトオーナー |
| TL | Tech Lead | テックリード |
| E2E | End-to-End | エンドツーエンド |
| IPC | Inter-Process Communication | プロセス間通信 |
| SDK | Software Development Kit | ソフトウェア開発キット |
| DAG | Directed Acyclic Graph | 有向非巡回グラフ |
| MECE | Mutually Exclusive, Collectively Exhaustive | 漏れなく重複なく |

---

## 14. 非推奨用語

以下の用語は使用しないでください。

| 非推奨 | 推奨 | 理由 |
|-------|-----|------|
| WorkflowState | ParallelDevState | 用語統一のため |
| SimpleTask | Task | 冗長なため |
| AutoSprint | AI駆動スプリント | 明確性のため |
| ContinueMode | 継続モード | 日本語プロジェクトのため |

---

## 15. 関連ドキュメント

- [ARCHITECTURE_DESIGN.md](./ARCHITECTURE_DESIGN.md) - 全体アーキテクチャ
- [TASK_STATE_MACHINE.md](./TASK_STATE_MACHINE.md) - TaskStatusの詳細
- [DATA_PERSISTENCE_SPECIFICATION.md](./DATA_PERSISTENCE_SPECIFICATION.md) - データ構造の詳細
- [SCRUM_WORKFLOW_SPECIFICATION.md](./SCRUM_WORKFLOW_SPECIFICATION.md) - ワークフローの詳細

---

**最終更新**: 2025-11-06
**バージョン**: 2.0.0-alpha
**承認**: Draft
