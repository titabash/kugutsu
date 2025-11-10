# AIスクラム開発ワークフロー仕様書

**バージョン**: 1.0
**最終更新**: 2025-01-09
**ステータス**: 公式仕様

## 目次

1. [システム概要](#1-システム概要)
2. [ディレクトリ構造仕様](#2-ディレクトリ構造仕様)
3. [タスク管理方式](#3-タスク管理方式)
4. [ワークフローノード仕様](#4-ワークフローノード仕様)
5. [データフロー](#5-データフロー)
6. [ファイル操作ガイドライン](#6-ファイル操作ガイドライン)
7. [状態管理](#7-状態管理)
8. [並列実行アーキテクチャ](#8-並列実行アーキテクチャ)
9. [関連ドキュメント](#9-関連ドキュメント)

---

## 1. システム概要

### 1.1 統一Scrumワークフロー

本システムは**統一Scrumワークフロー**（Unified Scrum Workflow）を採用しています。以前は複雑度に応じて3つの独立したワークフローが存在していましたが、現在は単一の統合ワークフローに一本化されています。

- ~~`createParallelDevGraph`~~ (廃止)
- ~~`createSprintDrivenGraph`~~ (廃止)
- ~~`createScrumDevGraph`~~ (廃止)
- ✅ **`createUnifiedScrumWorkflowGraph`** (現行)

### 1.2 設計思想

#### AI-First原則

すべての動的な意思決定とファイル操作はAIによって実行されます。ハードコードされたロジックは最小限に抑え、AIの柔軟性を最大限に活用します。

**禁止事項**:
- ビジネスロジックのハードコード
- 固定的なif/else分岐による技術スタック判定
- 手動ファイル操作（fs.writeFileなど）

**推奨事項**:
- Claude Code SDK経由でのファイル操作
- AIによる動的な判断と実行
- DataPersistenceユーティリティの活用

#### Scrum準拠

Scrumフレームワークの標準プラクティスに準拠します：

- **Product Backlog**: プロジェクト全体の未実施タスク
- **Sprint Backlog**: 現在のスプリントで実施するタスク
- **スプリント単位の開発**: 8-16時間単位のイテレーション
- **レビューとレトロスペクティブ**: スプリント完了時の振り返り

#### 並列実行の標準化

タスクの並列実行はシステムの標準機能であり、「モード」ではありません。複数のAIエンジニアが同時に異なるタスクに取り組み、真の並列処理を実現します。

### 1.3 ワークフロー統合の経緯

統合前の3つのワークフローは以下の問題を抱えていました：

- コードの重複
- 保守性の低下
- ワークフロー選択の複雑さ
- 状態管理の不整合

統合後は、**複雑度判定による自動分岐**により、単一のワークフローで全ての開発要求に対応します。

---

## 2. ディレクトリ構造仕様

### 2.1 統一ディレクトリ構造

```
.kugutsu/
├── repository/
│   └── architecture/
│       ├── tech-stack.json          # 技術スタック情報（CheckModeNode生成）
│       ├── db-schema.json           # DB設計書（TechLeadDesignNode生成）
│       ├── api-spec.json            # API仕様書（TechLeadDesignNode生成）
│       └── uiux-screens.json        # UI/UX設計書（TechLeadDesignNode生成）
├── product-backlog/
│   └── backlog.json                 # 製品バックログ（未割り当てタスク）
├── sprints/
│   ├── sprint-1/
│   │   ├── sprint-plan.json         # スプリント計画
│   │   ├── sprint-backlog.json      # スプリントバックログ（Sprint 1のタスク）
│   │   └── tasks/
│   │       ├── task-001/
│   │       │   ├── instruction.md   # タスク実装指示（TaskBreakdownNode生成）
│   │       │   ├── implementation.md # 実装詳細（EngineerNode生成）
│   │       │   └── review.json      # レビュー結果（ReviewNode生成）
│   │       └── task-002/
│   │           └── ...
│   ├── sprint-2/
│   │   └── ...
│   └── current-sprint.txt           # 現在のスプリント番号
├── story-mapping.json               # ストーリーマッピング（DirectorNode生成）
└── requirements.json                # 要件定義（ProductOwnerNode生成、Low複雑度時）
```

### 2.2 ディレクトリ設計原則

#### 原則1: Sprint配下の統一管理

**全てのタスクは必ず`.kugutsu/sprints/sprint-{N}/`配下で管理されます。**

- ❌ `.kugutsu/tasks/` は使用しない
- ✅ `.kugutsu/sprints/sprint-1/tasks/` を使用

#### 原則2: 単一責任の原則

各ディレクトリは明確な責務を持ちます：

- `repository/`: 設計書の永続化（プロジェクト全体で参照）
- `product-backlog/`: 未割り当てタスクの保管
- `sprints/sprint-{N}/`: スプリント単位の作業データ

#### 原則3: 世代管理

スプリントごとにディレクトリを分離し、履歴を保持します：

```
sprints/
├── sprint-1/   # 完了済み
├── sprint-2/   # 完了済み
└── sprint-3/   # 実行中
```

---

## 3. タスク管理方式

### 3.1 Option A: タスク移動方式（採用）

**Scrum標準に最も準拠した方式**

#### 3.1.1 タスクのライフサイクル

```
[Product Backlog] → [Sprint Backlog] → [完了 or Product Backlogへ戻る]
```

#### 3.1.2 タスク移動フロー

1. **タスク生成** (TaskBreakdownNode)
   - 全タスクを`product-backlog/backlog.json`に追加
   - 状態: `pending`

2. **スプリント計画** (SprintPlanningNode)
   - Product Backlogから優先度順にタスクを選択
   - 選択したタスクを**Product Backlogから削除**
   - Sprint Backlog (`sprints/sprint-{N}/sprint-backlog.json`) に**移動**

3. **タスク実行** (EngineerNode)
   - Sprint Backlogからタスクを読み取り
   - 実装後、Sprint Backlog内のタスク状態を更新
   - 状態: `in_progress` → `in_review` → `completed`

4. **スプリント完了** (SprintReviewNode)
   - 未完了タスクを**Sprint BacklogからProduct Backlogへ移動**
   - 完了タスクはSprint Backlog内に保持（履歴）

#### 3.1.3 データ構造

**Product Backlog** (`.kugutsu/product-backlog/backlog.json`):
```json
{
  "tasks": [
    {
      "id": "task-001",
      "title": "ユーザー認証機能の実装",
      "description": "JWT認証の実装",
      "type": "feature",
      "priority": 95,
      "estimatedPoints": 8,
      "dependencies": [],
      "status": "pending",
      "createdAt": "2025-01-09T10:00:00Z"
    }
  ],
  "metadata": {
    "totalTasks": 10,
    "lastUpdated": "2025-01-09T10:00:00Z"
  }
}
```

**Sprint Backlog** (`.kugutsu/sprints/sprint-1/sprint-backlog.json`):
```json
{
  "sprintNumber": 1,
  "tasks": [
    {
      "id": "task-001",
      "title": "ユーザー認証機能の実装",
      "status": "in_progress",
      "assignedTo": "engineer-ai-1",
      "worktreePath": "/path/to/worktree",
      "branchName": "feature/task-001"
    }
  ],
  "metadata": {
    "totalPoints": 21,
    "completedPoints": 0,
    "startDate": "2025-01-09T10:00:00Z"
  }
}
```

### 3.2 タスク状態遷移

```
pending → ready → in_progress → in_review → completed
                                          ↘ failed
```

- **pending**: Product Backlogに存在、未割り当て
- **ready**: Sprint Backlogに移動済み、実行待機中
- **in_progress**: AI Engineerが実装中
- **in_review**: 実装完了、レビュー待ち
- **completed**: レビュー承認、マージ完了
- **failed**: 実装失敗またはレビュー却下

---

## 4. ワークフローノード仕様

### 4.1 ノード一覧と責務

| ノード | 責務 | 生成ファイル | DataPersistence使用 |
|--------|------|-------------|-------------------|
| **AnalyzeComplexityNode** | 複雑度判定 | - | - |
| **CheckModeNode** | 継続モード検出 | `repository/architecture/tech-stack.json` | ✅ |
| **DirectorNode** | ストーリーマッピング作成 | `story-mapping.json` | ✅ |
| **ReviewStoryMappingNode** | ストーリーマッピングレビュー | - | ✅ (修正予定) |
| **TechLeadDesignNode** | 設計書生成 | `repository/architecture/{db,api,uiux}.json` | ✅ |
| **ReviewDesignNode** | 設計書レビュー | - | ✅ |
| **TaskBreakdownNode** | タスク分解 | `product-backlog/backlog.json`, `sprints/sprint-{N}/tasks/{taskId}/instruction.md` | ✅ |
| **ProductOwnerNode** | 要件分析（Low複雑度） | `requirements.json` | 部分的 |
| **SprintPlanningNode** | スプリント計画 | `sprints/sprint-{N}/sprint-plan.json`, `sprint-backlog.json` | ⚠️ (修正予定) |
| **EngineerDispatchNode** | タスク割り当て | - | ✅ |
| **EngineerNode** | タスク実装 | `sprints/sprint-{N}/tasks/{taskId}/implementation.md` | ✅ |
| **ReviewNode** | コードレビュー | `sprints/sprint-{N}/tasks/{taskId}/review.json` | ✅ |
| **MergeCoordinatorNode** | マージ調整 | - | - |
| **ConflictResolverNode** | コンフリクト解決 | - | - |
| **SprintReviewNode** | スプリントレビュー | - | ✅ |

### 4.2 重要ノードの詳細仕様

#### 4.2.1 AnalyzeComplexityNode

**目的**: ユーザーリクエストの複雑度をAI判定し、適切なフローに分岐

**入力**:
- `state.userRequest`: ユーザーからの開発要求

**出力**:
- `state.metadata.requiresDetailedDesign`: `true` (High) / `false` (Low)

**分岐**:
- **High**: `director_ai` → ストーリーマッピング作成フロー
- **Low**: `product_owner` → 直接タスク分解フロー

#### 4.2.2 TaskBreakdownNode

**目的**: 設計書から実装可能なタスクに分解

**High複雑度時の入力**:
- `state.storyMapping`: ストーリーマッピング
- `state.designDocs.databasePath`: DB設計書パス
- `state.designDocs.apiPath`: API仕様書パス
- `state.designDocs.uiuxPath`: UI/UX設計書パス

**Low複雑度時の入力**:
- `state.requirementsPath`: 要件定義パス

**出力**:
- `product-backlog/backlog.json`: 全タスク
- `sprints/sprint-1/tasks/{taskId}/instruction.md`: 各タスクの実装指示

**重要**: instruction.mdの生成パスは必ず`sprints/sprint-{N}/tasks/{taskId}/instruction.md`とし、ProductOwnerNodeとの衝突を回避します。

#### 4.2.3 SprintPlanningNode

**目的**: Product BacklogからタスクをSprint Backlogへ移動

**タスク選択基準**:
- 優先度（priority）
- 依存関係（dependencies）
- ポイント見積もり（estimatedPoints）の合計が8-16時間相当

**ファイル操作** (DataPersistence使用に修正予定):
1. Product Backlogから選択タスクを削除
2. Sprint Backlogへ追加
3. Sprint Planを生成

#### 4.2.4 EngineerNode

**目的**: タスクを並列実装

**実装時の参照資料**:
- `state.storyMapping`: 全体文脈の理解
- `state.designDocs`: DB/API/UI設計書
- `state.sprintPlanPath`: スプリント計画
- `sprints/sprint-{N}/tasks/{taskId}/instruction.md`: タスク実装指示

**プロンプト構成**:
```markdown
# Task Implementation

## タスク情報
- ID: {taskId}
- タイトル: {title}

## 📖 参照：ストーリーマッピング
{storyMapping}

## 📐 参照：設計書
### データベース設計
ファイルパス: {databasePath}
**Readツールで読み込んで参照してください**

### API仕様
ファイルパス: {apiPath}
**Readツールで読み込んで参照してください**

## 📝 実装指示
{instruction.md の内容}
```

#### 4.2.5 ReviewNode

**目的**: 実装コードをレビュー

**レビュー観点**:
1. **設計書との整合性** ⭐ 最優先
   - ストーリーマッピングで定義されたユーザー価値を提供しているか
   - DB設計に準拠しているか
   - API仕様に準拠しているか
   - UI/UX設計に準拠しているか
   - instruction.mdに従っているか

2. コード品質
3. テストカバレッジ
4. セキュリティ
5. パフォーマンス
6. ドキュメント

**出力**:
- `sprints/sprint-{N}/tasks/{taskId}/review.json`: レビュー結果

---

## 5. データフロー

### 5.1 全体フロー図

```
┌─────────────────────┐
│  ユーザーリクエスト  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ AnalyzeComplexity   │ AI判定
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
 [High]       [Low]
     │           │
     ▼           ▼
DirectorAI   ProductOwner
     │           │
     ▼           │
ReviewStory      │
Mapping          │
     │           │
     ▼           │
TechLeadDesign   │
     │           │
     ▼           │
ReviewDesign     │
     │           │
     ▼           ▼
 TaskBreakdown ←─┘
     │
     ▼
Product Backlog
(backlog.json)
     │
     ▼
┌─────────────────────┐
│  CheckMode          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ SprintPlanning      │ タスク移動
└──────────┬──────────┘
           │
           ▼
   Sprint Backlog
(sprint-backlog.json)
     │
     ▼
┌─────────────────────┐
│ EngineerDispatch    │
└──────────┬──────────┘
           │
           ▼
    ┌─────────┐
    │ Engineer│ (並列実行)
    └────┬────┘
         │
         ▼
    ┌─────────┐
    │ Review  │ (並列実行)
    └────┬────┘
         │
         ▼
┌─────────────────────┐
│ MergeCoordinator    │
└──────────┬──────────┘
           │
      ┌────┴────┐
      │         │
      ▼         ▼
 [衝突なし] [衝突あり]
      │         │
      │         ▼
      │  ConflictResolver
      │         │
      └────┬────┘
           │
           ▼
┌─────────────────────┐
│  SprintReview       │
└──────────┬──────────┘
           │
      ┌────┴────┐
      │         │
      ▼         ▼
  [継続]    [完了]
      │         │
      ▼         ▼
SprintPlanning  END
```

### 5.2 High複雑度フロー詳細

```
AnalyzeComplexity (High判定)
    ↓
DirectorNode
    → 生成: story-mapping.json
    ↓
ReviewStoryMappingNode
    → AI審査: approved / revision_needed
    ↓ (approved)
TechLeadDesignNode
    → 生成: repository/architecture/db-schema.json
    → 生成: repository/architecture/api-spec.json
    → 生成: repository/architecture/uiux-screens.json
    ↓
ReviewDesignNode
    → AI審査: approved / revision_needed
    ↓ (approved)
TaskBreakdownNode
    → 生成: product-backlog/backlog.json
    → 生成: sprints/sprint-1/tasks/{taskId}/instruction.md (各タスク)
    ↓
CheckMode → SprintPlanning → ...
```

### 5.3 Low複雑度フロー詳細

```
AnalyzeComplexity (Low判定)
    ↓
ProductOwnerNode
    → 生成: requirements.json
    → 生成: tasks.json (一時的、後でSprint Backlogに統合)
    → 生成: tasks/{taskId}/instruction.md (後でsprints配下に移行予定)
    ↓
CheckMode → SprintPlanning → ...
```

**注意**: ProductOwnerNodeは現在、Low複雑度時の簡易フローで使用されますが、instruction.md生成パスがTaskBreakdownNodeと衝突する問題があります（修正予定）。

---

## 6. ファイル操作ガイドライン

### 6.1 AI-First原則の徹底

**すべてのファイル操作はAI経由で実行**

❌ **禁止**:
```typescript
// 直接fs操作
import fs from 'fs/promises';
await fs.writeFile(path, content);
```

✅ **推奨**:
```typescript
// DataPersistence経由
import { DataPersistence } from '../utils/DataPersistence.js';
const persistence = new DataPersistence(baseRepoPath);
await persistence.saveStoryMapping(projectId, storyMapping);
```

または

```typescript
// Claude Code SDK経由
const result = await provider.execute(prompt, {
  allowedTools: ['Write'],
  permissionMode: 'acceptEdits',
});
```

### 6.2 DataPersistence必須化

以下のノードは**必ずDataPersistenceを使用**:

- ✅ CheckModeNode
- ✅ DirectorNode
- ✅ TechLeadDesignNode
- ✅ TaskBreakdownNode
- ⚠️ SprintPlanningNode (修正予定)
- ⚠️ ReviewStoryMappingNode (修正予定)

### 6.3 instruction.md生成ルール

**衝突回避のための統一ルール**:

| ノード | 生成パス | 用途 |
|--------|---------|------|
| TaskBreakdownNode | `sprints/sprint-{N}/tasks/{taskId}/instruction.md` | High複雑度時のタスク指示 |
| ProductOwnerNode | ~~`tasks/{taskId}/instruction.md`~~ | ❌ 廃止予定 |

**修正方針**:
1. ProductOwnerNodeはinstruction.md生成を停止
2. TaskBreakdownNodeに統一
3. Low複雑度時もTaskBreakdownNodeを経由

### 6.4 ファイルパス命名規則

**相対パス基準**: すべてのパスは`.kugutsu/`からの相対パス

```typescript
// ✅ 正しい
techStackPath: '.kugutsu/repository/architecture/tech-stack.json'

// ❌ 誤り
techStackPath: 'repository/architecture/tech-stack.json'
```

---

## 7. 状態管理

### 7.1 LangGraph State構造

```typescript
interface ParallelDevState {
  // 基本情報
  userRequest: string;
  currentProjectId: string;
  config: Config;

  // タスク管理
  tasks: Task[];              // State内のタスク（実行時の状態管理用）
  globalTasks: GlobalTask[];  // グローバルタスクキュー
  completedTasks: Task[];
  failedTasks: Task[];

  // Product Backlog / Sprint Backlog
  productBacklogPath?: string;
  sprintBacklogPath?: string;
  currentSprint?: number;

  // 設計書パス
  techStackPath?: string;
  requirementsPath?: string;
  tasksPath?: string;         // 廃止予定
  storyMapping?: StoryMapping;
  designDocs?: {
    databasePath?: string;
    apiPath?: string;
    uiuxPath?: string;
  };
  sprintPlanPath?: string;

  // 依存関係
  dependencyGraph?: DependencyGraph;

  // レビュー・マージ
  reviews: Review[];
  mergeQueue: MergeRequest[];

  // メタデータ
  metadata: {
    requiresDetailedDesign?: boolean;  // 複雑度判定結果
    hasErrors?: boolean;
    errors?: string[];
  };

  // ログ
  logs: LogEntry[];

  // フィードバック
  feedbackRequest?: FeedbackRequest;
}
```

### 7.2 Stateの更新パターン

**Reducer方式**（LangGraphの標準）:

```typescript
// ノードから返却
return {
  tasks: [updatedTask],      // 既存タスクに追加
  logs: [newLog],            // 既存ログに追加
  techStackPath: 'path',     // 上書き
};

// LangGraphが自動マージ
// state.tasks = [...state.tasks, updatedTask]
// state.logs = [...state.logs, newLog]
// state.techStackPath = 'path'
```

---

## 8. 並列実行アーキテクチャ

### 8.1 真の並列処理

**EngineerWrapper**と**ReviewWrapper**により、複数タスクを同時実行:

```typescript
// EngineerWrapper (ParallelDevGraph.ts)
.addNode('engineer', async (state) => {
  const inProgressTasks = state.tasks.filter(t => t.status === 'in_progress');

  // 並列実行
  const taskResults = await Promise.allSettled(
    inProgressTasks.map(task => engineerNode(state, task.id))
  );

  // 結果を集約
  return aggregateResults(taskResults);
});
```

### 8.2 パイプライン構造

詳細は[parallel-development-workflow.md](./parallel-development-workflow.md)を参照。

```
開発パイプライン: EngineerDispatch → Engineer (並列) → ...
レビューパイプライン: ... → Review (並列) → ...
マージパイプライン: ... → MergeCoordinator (逐次・Mutex) → ...
```

### 8.3 イベント駆動フロー

主要イベント:
- `DEVELOPMENT_COMPLETED`: タスク実装完了
- `REVIEW_COMPLETED`: レビュー完了
- `MERGE_READY`: マージ準備完了
- `MERGE_CONFLICT_DETECTED`: コンフリクト検出
- `MERGE_COMPLETED`: マージ完了
- `TASK_FAILED`: タスク失敗

---

## 9. 関連ドキュメント

### 9.1 参照ドキュメント

| ドキュメント | 内容 | 関係 |
|-------------|------|------|
| **本仕様書** | AIスクラム開発ワークフロー公式仕様 | 最上位 |
| [parallel-development-workflow.md](./parallel-development-workflow.md) | パイプライン詳細、イベント駆動アーキテクチャ | 詳細参照 |
| [kugutsu-file-management.md](./kugutsu-file-management.md) | ファイル操作詳細、DataPersistence使用方法 | 詳細参照 |
| [AI_PARALLEL_DEVELOPMENT_DESIGN.md](./AI_PARALLEL_DEVELOPMENT_DESIGN.md) | システム設計書（一部古い情報あり） | 参考 |

### 9.2 ドキュメント階層

```
AI_SCRUM_WORKFLOW_SPECIFICATION.md (本書)
    ├── parallel-development-workflow.md (パイプライン詳細)
    ├── kugutsu-file-management.md (ファイル操作詳細)
    └── AI_PARALLEL_DEVELOPMENT_DESIGN.md (システム設計)
```

---

## 10. 変更履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|---------|
| 1.0 | 2025-01-09 | 初版作成 |

---

## 11. 今後の改善予定

### 11.1 修正予定事項

1. **SprintPlanningNode**: DataPersistence使用への移行
2. **ReviewStoryMappingNode**: DataPersistence使用への移行
3. **ProductOwnerNode**: instruction.md生成の廃止
4. **tasks.json**: sprint-backlog.jsonへの完全移行
5. **テスト更新**: 上記変更に伴うテスト修正

### 11.2 追加予定機能

- スプリントバーンダウンチャート自動生成
- タスク見積もり精度の学習機能
- レトロスペクティブ自動レポート生成

---

**本仕様書は公式仕様として、システムの実装と運用の基準となります。**
