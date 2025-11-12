# .kugutsu ファイル管理ドキュメント

**バージョン**: 2.0
**最終更新**: 2025-01-09
**ステータス**: 公式リファレンス

> **関連ドキュメント**: 本書は[AI_SCRUM_WORKFLOW_SPECIFICATION.md](./AI_SCRUM_WORKFLOW_SPECIFICATION.md)のファイル操作詳細版です。

## 概要

このドキュメントは、Kugutsu 2.0システムが`.kugutsu`ディレクトリ配下で作成・管理するファイルの一覧と、ノード間のファイル受け渡しの仕組みを説明します。

## 重要な設計方針

### AI-First原則

**すべてのファイルはAIが作成します**。システムが直接ファイルを書き込むことは最小限に抑えます。

- ✅ **DataPersistence経由** (推奨): 構造化データの保存（JSON）
- ✅ **Claude Code SDK経由**: AIにWriteツールを使わせてファイルを作成（Markdown等）
- ⚠️ **直接fs.writeFile**: システム内部の一時ファイルのみ（非推奨）

### タスク管理方式: Option A（タスク移動方式）

Scrum標準に準拠した管理方式を採用：

1. **Product Backlog**: 未割り当てタスクを保管
2. **Sprint Backlog**: 現在のスプリントで実施するタスク
3. **タスク移動**: Product Backlog → Sprint Backlog → 完了 or Product Backlogへ戻る

詳細は[AI_SCRUM_WORKFLOW_SPECIFICATION.md セクション3](./AI_SCRUM_WORKFLOW_SPECIFICATION.md#3-タスク管理方式)を参照。

## ディレクトリ構造

```
.kugutsu/
├── repository/
│   └── architecture/
│       ├── tech-stack.json          # 技術スタック（CheckModeNode生成）
│       ├── db-schema.json           # DB設計書（TechLeadDesignNode生成）
│       ├── api-spec.json            # API仕様書（TechLeadDesignNode生成）
│       └── uiux-screens.json        # UI/UX設計書（TechLeadDesignNode生成）
├── product-backlog/
│   └── backlog.json                 # 製品バックログ（未割り当てタスク）
├── sprints/
│   ├── sprint-1/
│   │   ├── sprint-plan.json         # スプリント計画
│   │   ├── sprint-backlog.json      # スプリントバックログ
│   │   └── tasks/
│   │       ├── task-001/
│   │       │   ├── instruction.md   # タスク実装指示
│   │       │   ├── implementation.md # 実装詳細
│   │       │   └── review.json      # レビュー結果
│   │       └── task-002/
│   │           └── ...
│   ├── sprint-2/
│   │   └── ...
│   └── current-sprint.txt           # 現在のスプリント番号
├── story-mapping.json               # ストーリーマッピング（DirectorNode生成）
└── requirements.json                # 要件定義（ProductOwnerNode生成、Low複雑度時）
```

### 廃止されたパス

以下のパスは旧仕様で使用されていましたが、現在は廃止されています：

- ❌ `.kugutsu/tasks.json` → ✅ `.kugutsu/sprints/sprint-{N}/sprint-backlog.json` (Sprint Backlog)
- ❌ `.kugutsu/tasks/tasks.json` → ✅ `.kugutsu/sprints/sprint-{N}/sprint-backlog.json`
- ❌ `.kugutsu/tasks/global-queue.json` → ✅ `.kugutsu/product-backlog/backlog.json`
- ❌ `.kugutsu/tasks/{taskId}/` → ✅ `.kugutsu/sprints/sprint-{N}/tasks/{taskId}/`
- ❌ `.kugutsu/sprints/active-sprint.json` → ✅ `.kugutsu/sprints/sprint-{N}/sprint-plan.json`
- ❌ `.kugutsu/projects/{projectId}/` → ✅ `.kugutsu/repository/`
- ❌ `.kugutsu/tech-stack.json` (ProductOwnerNode生成) → ✅ `.kugutsu/repository/architecture/tech-stack.json` (CheckModeNode生成)

**重要**: `.kugutsu/tasks.json`は完全に廃止されました。すべてのノードはSprint Backlog (`sprints/{sprintId}/sprint-backlog.json`) またはProduct Backlog (`product-backlog/backlog.json`) を使用します。

## ファイル一覧と詳細

### 共通ファイル

| ファイルパス | 作成ノード | 参照ノード | 作成方針 | 必須項目 |
|------------|-----------|-----------|---------|---------|
| `.kugutsu/repository/architecture/tech-stack.json` | CheckModeNode | 全ノード | **新規作成** (初回のみ) | languages, frameworks, buildTools, testingFrameworks, projectType |
| `.kugutsu/story-mapping.json` | DirectorNode | TaskBreakdownNode, EngineerNode, ReviewNode | **新規作成** | persona, epics (id, title, stories) |
| `.kugutsu/requirements.json` | ProductOwnerNode | ProductOwnerNode | **Upsert** | functional, nonFunctional, constraints |

### 設計書ファイル（High複雑度時）

| ファイルパス | 作成ノード | 参照ノード | 作成方針 | 必須項目 |
|------------|-----------|-----------|---------|---------|
| `.kugutsu/repository/architecture/db-schema.json` | TechLeadDesignNode | TaskBreakdownNode, EngineerNode | **新規作成** | version, database, tables, relationships |
| `.kugutsu/repository/architecture/api-spec.json` | TechLeadDesignNode | TaskBreakdownNode, EngineerNode | **新規作成** | OpenAPI 3.0形式 |
| `.kugutsu/repository/architecture/uiux-screens.json` | TechLeadDesignNode | TaskBreakdownNode, EngineerNode | **新規作成** | screens配列 (id, name, components) |

### Product Backlog

| ファイルパス | 作成ノード | 参照ノード | 作成方針 | 必須項目 |
|------------|-----------|-----------|---------|---------|
| `.kugutsu/product-backlog/backlog.json` | TaskBreakdownNode | SprintPlanningNode | **新規作成** / **更新** | tasks配列, metadata |

**構造**:
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

### Sprint Backlog

| ファイルパス | 作成ノード | 参照ノード | 作成方針 | 必須項目 |
|------------|-----------|-----------|---------|---------|
| `.kugutsu/sprints/sprint-{N}/sprint-plan.json` | SprintPlanningNode | SprintPlanningNode | **新規作成** | sprintNumber, goal, duration, taskIds |
| `.kugutsu/sprints/sprint-{N}/sprint-backlog.json` | SprintPlanningNode | EngineerDispatchNode, EngineerNode, ReviewNode | **新規作成** / **更新** | sprintNumber, tasks配列, metadata |

**sprint-backlog.json の構造**:
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

### タスク詳細ファイル

| ファイルパス | 作成ノード | 参照ノード | 作成方針 | 必須項目 |
|------------|-----------|-----------|---------|---------|
| `.kugutsu/sprints/sprint-{N}/tasks/{taskId}/instruction.md` | TaskBreakdownNode | EngineerNode | **新規作成** | 目的、実装対象ファイル、実装詳細、受入基準 |
| `.kugutsu/sprints/sprint-{N}/tasks/{taskId}/implementation.md` | EngineerNode | ReviewNode | **新規作成** | 実装内容、変更ファイル、テスト結果 |
| `.kugutsu/sprints/sprint-{N}/tasks/{taskId}/review.json` | ReviewNode | MergeCoordinatorNode | **新規作成** | taskId, status, comments, reviewedBy, reviewedAt |

**instruction.md の構造**:
```markdown
# {Task Title}

## 目的
{対応するユーザーストーリーと、このタスクが提供する価値}

## 実装対象ファイル
- 新規作成: `path/to/new/file.ts`
- 編集: `path/to/existing/file.ts`

## 実装詳細

### データベース
{DB Schemaからの該当部分}

### API
{API Specificationからの該当部分}

### UI/UX
{UI/UX Screensからの該当部分}

## 技術的制約
{technicalNotesの内容}

## 受入基準
{acceptanceCriteriaの詳細説明}

## テスト駆動開発手順
1. テストケース作成
2. 実装
3. リファクタリング

## 動作確認方法
{具体的な確認手順}
```

**review.json の構造**:
```json
{
  "taskId": "task-001",
  "status": "approved",
  "reviewedBy": "TechLeadAI",
  "reviewedAt": "2025-01-09T12:00:00Z",
  "comments": [
    {
      "file": "src/auth.ts",
      "severity": "info",
      "message": "実装が設計書に準拠しています"
    }
  ],
  "summary": "レビュー結果: approved",
  "suggestions": []
}
```

## ノード別のファイル操作

### CheckModeNode

**役割**: 継続モード検出、リポジトリ初期化

**作成するファイル (DataPersistence使用)**:
- `.kugutsu/repository/architecture/tech-stack.json` (初回のみ)

**動作**:
1. `.kugutsu/repository/architecture/tech-stack.json`の存在確認
2. 存在しない場合: 新規プロジェクトと判定、tech-stack.jsonを生成
3. 存在する場合: 継続モードと判定

### AnalyzeComplexityNode

**役割**: 複雑度判定

**ファイル操作**: なし

**出力**:
- `state.metadata.requiresDetailedDesign`: `true` (High) / `false` (Low)

### DirectorNode (High複雑度時)

**役割**: ストーリーマッピング作成

**作成するファイル (DataPersistence使用)**:
1. `.kugutsu/story-mapping.json`

**プロンプトの特徴**:
- ペルソナ、エピック、ユーザーストーリーの作成を指示
- 優先度と見積もりポイントの設定を指示

### TechLeadDesignNode (High複雑度時)

**役割**: 技術設計書作成

**読み込むファイル (前提条件)**:
- `.kugutsu/story-mapping.json` - 必須

**作成するファイル (DataPersistence使用)**:
1. `.kugutsu/repository/architecture/db-schema.json`
2. `.kugutsu/repository/architecture/api-spec.json`
3. `.kugutsu/repository/architecture/uiux-screens.json`

### TaskBreakdownNode

**役割**: タスク分解、instruction.md生成

**読み込むファイル (前提条件)**:
- High複雑度時:
  - `.kugutsu/story-mapping.json`
  - `.kugutsu/repository/architecture/db-schema.json`
  - `.kugutsu/repository/architecture/api-spec.json`
  - `.kugutsu/repository/architecture/uiux-screens.json`
- Low複雑度時:
  - `.kugutsu/requirements.json`

**作成するファイル**:
1. `.kugutsu/product-backlog/backlog.json` (DataPersistence使用)
2. `.kugutsu/sprints/sprint-1/tasks/{taskId}/instruction.md` (Claude Code SDK使用)

**重要**: instruction.mdは必ず`sprints/sprint-{N}/tasks/{taskId}/`配下に生成します。

### ProductOwnerNode (Low複雑度時)

**役割**: 要件分析

**作成するファイル**:
1. `.kugutsu/requirements.json` (Claude Code SDK使用)

**注意**: 旧仕様ではinstruction.md生成も担当していましたが、現在はTaskBreakdownNodeに統一されています。

### SprintPlanningNode

**役割**: スプリント計画、タスク移動

**読み込むファイル (前提条件)**:
- `.kugutsu/product-backlog/backlog.json`

**作成するファイル**:
1. `.kugutsu/sprints/sprint-{N}/sprint-plan.json`
2. `.kugutsu/sprints/sprint-{N}/sprint-backlog.json`

**タスク移動フロー**:
1. Product Backlogから優先度順にタスク選択
2. 選択したタスクをProduct Backlogから削除
3. Sprint Backlogに追加

**修正予定**: 現在はAI prompts経由でファイル保存していますが、DataPersistence使用に変更予定。

### EngineerDispatchNode

**役割**: タスク割り当て

**読み込むファイル (前提条件)**:
- `.kugutsu/sprints/sprint-{N}/sprint-backlog.json`

**更新するファイル**:
- `.kugutsu/sprints/sprint-{N}/sprint-backlog.json` (ステータス更新)

### EngineerNode

**役割**: タスクの実装

**読み込むファイル (前提条件)**:
1. `.kugutsu/sprints/sprint-{N}/sprint-backlog.json` - 必須
2. `.kugutsu/sprints/sprint-{N}/tasks/{taskId}/instruction.md` - 必須
3. `.kugutsu/story-mapping.json` - 参照
4. `.kugutsu/repository/architecture/*.json` - 参照

**作成するファイル**:
1. `.kugutsu/sprints/sprint-{N}/tasks/{taskId}/implementation.md` (Claude Code SDK使用)

**更新するファイル**:
- `.kugutsu/sprints/sprint-{N}/sprint-backlog.json` (AIFileWriter経由でステータス更新)

**プロンプトの特徴**:
- 設計書への参照を明示
- TDD（テスト駆動開発）の手順を強調
- `git add`と`git commit`を実行させる（`git push`は禁止）

### ReviewNode

**役割**: コードレビュー

**読み込むファイル (前提条件)**:
1. `.kugutsu/sprints/sprint-{N}/sprint-backlog.json` - 必須
2. `.kugutsu/sprints/sprint-{N}/tasks/{taskId}/instruction.md` - 必須
3. `.kugutsu/story-mapping.json` - 参照
4. `.kugutsu/repository/architecture/*.json` - 参照

**作成するファイル**:
1. `.kugutsu/sprints/sprint-{N}/tasks/{taskId}/review.json` (AIFileWriter経由)

**更新するファイル**:
- `.kugutsu/sprints/sprint-{N}/sprint-backlog.json` (AIFileWriter経由でステータス更新、承認時のみ)

**レビュー観点**:
1. **設計書との整合性** ⭐ 最優先
2. コード品質
3. テストカバレッジ
4. セキュリティ
5. パフォーマンス

### MergeCoordinatorNode

**役割**: マージ調整とコンフリクト検出

**読み込むファイル (前提条件)**:
1. `.kugutsu/sprints/sprint-{N}/sprint-backlog.json` - 必須
2. `.kugutsu/sprints/sprint-{N}/tasks/{taskId}/review.json` - 必須

**更新するファイル**:
- `.kugutsu/sprints/sprint-{N}/sprint-backlog.json` (ステータス更新)

### ConflictResolverNode

**役割**: コンフリクト解決

**読み込むファイル (前提条件)**:
- `.kugutsu/sprints/sprint-{N}/sprint-backlog.json` - 必須

**更新するファイル**:
- `.kugutsu/sprints/sprint-{N}/sprint-backlog.json` (ステータス更新)

### SprintReviewNode

**役割**: スプリント完了チェック

**読み込むファイル (前提条件)**:
- `.kugutsu/sprints/sprint-{N}/sprint-backlog.json` - 必須

**タスク移動フロー**:
1. 未完了タスクをSprint Backlogから削除
2. 未完了タスクをProduct Backlogへ移動
3. 完了タスクはSprint Backlogに保持（履歴）

## エラーハンドリング

### ファイル読み込みエラー

```typescript
try {
  const data = await fileReader.readJSON<TaskArtifact[]>(tasksPath);
} catch (error) {
  return {
    logs: [{
      timestamp: new Date(),
      level: 'error',
      source: 'NodeName',
      message: `ファイル読み込み失敗: ${error.message}`,
    }],
  };
}
```

### リトライ機構

重要な操作（AI実行、ファイル保存等）には`RetryManager`を使用：

```typescript
const result = await RetryManager.executeWithRetry(
  async () => {
    // 実行処理
  },
  {
    maxRetries: 3,
    initialDelayMs: 2000,
    retryableErrors: ['ETIMEDOUT', 'rate_limit'],
  }
);
```

## トラブルシューティング

### ファイルが見つからない

**症状**: `ENOENT: no such file or directory`

**原因**:
1. 前のノードがファイル生成に失敗
2. パスの指定ミス（相対パス/絶対パス）

**対処法**:
1. 前のノードのログを確認
2. パスが`.kugutsu/`からの相対パスか確認

### タスクがSprint Backlogに存在しない

**症状**: `Task not found in sprint backlog`

**原因**:
1. SprintPlanningNodeが実行されていない
2. タスクがProduct Backlogに残っている

**対処法**:
1. SprintPlanningNodeのログを確認
2. Product Backlogとsprint Backlogの内容を確認

### instruction.mdが重複生成される

**症状**: 同じタスクのinstruction.mdが複数箇所に存在

**原因**:
1. ProductOwnerNodeとTaskBreakdownNodeが両方生成（旧仕様）

**対処法**:
1. TaskBreakdownNodeのみがinstruction.md生成を担当するよう修正
2. 重複ファイルを削除

## 変更履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|---------|
| 2.0 | 2025-01-09 | 新仕様に完全移行、Option A採用、ディレクトリ構造変更 |
| 1.0 | 2024-XX-XX | 初版 |

---

**本ドキュメントは[AI_SCRUM_WORKFLOW_SPECIFICATION.md](./AI_SCRUM_WORKFLOW_SPECIFICATION.md)と併せて参照してください。**
