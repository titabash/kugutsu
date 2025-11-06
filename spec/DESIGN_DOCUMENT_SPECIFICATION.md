# Design Document Specification

**プロジェクト**: Kugutsu 2.0 - AI Parallel Development System
**バージョン**: 1.0.0
**最終更新**: 2025-11-05
**対象**: 設計書フォーマットとテンプレート定義
**ステータス**: Draft

---

## 1. 概要

本仕様書は、TechLeadAIが生成する設計書のフォーマット、テンプレート、生成方法を定義します。設計書は**Markdown + Mermaid**と**JSON構造化データ**の2つの形式で出力され、人間可読性とマシンリーダビリティの両立を実現します。

### 1.1 設計原則

1. **二重フォーマット**: Markdown（人間用）+ JSON（プログラム用）を同時出力
2. **視覚的表現**: Mermaid図による直感的な理解
3. **必要十分**: 過剰設計を避け、ストーリーを実現する最小限の設計
4. **整合性保証**: 各エンジニアが異なる実装をしない明確さ
5. **既存システム尊重**: 既存のアーキテクチャと整合性を保つ

---

## 2. 設計書の種類

### 2.1 全体構成

```
design/
├── design-docs.md           # 全体設計書（統合ドキュメント）
├── uiux/
│   ├── wireframes.md        # Mermaid画面遷移図
│   └── screens.json         # 画面定義JSON
├── database/
│   ├── er-diagram.md        # MermaidER図
│   └── schema.json          # テーブル定義JSON
└── interfaces/
    ├── api-spec.md          # API仕様Markdown
    └── api-spec.json        # OpenAPI/JSONスキーマ
```

---

## 3. Design Docs（全体設計）

### 3.1 目的

- システム全体のアーキテクチャを定義
- 技術スタック、レイヤー構成、主要コンポーネントを明確化
- 各設計書（UI/UX、DB、I/O）への参照を提供

### 3.2 テンプレート

**ファイル**: `design/design-docs.md`

```markdown
# 設計書

**プロジェクト**: {project_name}
**作成日**: {date}
**作成者**: TechLeadAI
**対象ストーリー**: {story_ids}

---

## 1. 全体設計

### 1.1 アーキテクチャ

\```mermaid
graph TD
    UI[Frontend] --> API[API Gateway]
    API --> Backend[Backend Service]
    Backend --> DB[(Database)]
    Backend --> Cache[(Redis)]
\```

### 1.2 技術スタック

| レイヤー | 技術 | バージョン | 理由 |
|---------|------|----------|------|
| Frontend | React | 19.x | 最新のuse Hook活用 |
| Backend | Node.js + Express | 20.x / 4.x | 既存システムと統一 |
| Database | PostgreSQL | 16.x | リレーショナルデータに最適 |
| Cache | Redis | 7.x | セッション管理 |

### 1.3 レイヤー構成

\```mermaid
graph TB
    subgraph "Presentation Layer"
        UI[React Components]
    end
    subgraph "Application Layer"
        API[REST API]
        WS[WebSocket]
    end
    subgraph "Domain Layer"
        Service[Business Logic]
        Entity[Domain Entities]
    end
    subgraph "Infrastructure Layer"
        Repo[Repository]
        DB[(Database)]
    end

    UI --> API
    UI --> WS
    API --> Service
    WS --> Service
    Service --> Entity
    Service --> Repo
    Repo --> DB
\```

---

## 2. UI/UX設計

詳細は `uiux/wireframes.md` および `uiux/screens.json` を参照。

### 2.1 画面一覧

| 画面ID | 画面名 | 説明 |
|-------|--------|------|
| SCR-001 | タスク一覧 | タスクをKanban形式で表示 |
| SCR-002 | タスク詳細 | タスクの詳細情報を表示・編集 |

---

## 3. DB設計

詳細は `database/er-diagram.md` および `database/schema.json` を参照。

### 3.1 テーブル一覧

| テーブル名 | 説明 |
|-----------|------|
| tasks | タスク管理 |
| task_dependencies | タスク依存関係 |
| reviews | レビュー記録 |

---

## 4. I/O設計

詳細は `interfaces/api-spec.md` および `interfaces/api-spec.json` を参照。

### 4.1 API一覧

| メソッド | パス | 説明 |
|---------|------|------|
| GET | /api/tasks | タスク一覧取得 |
| POST | /api/tasks | タスク作成 |
| GET | /api/tasks/:id | タスク詳細取得 |
| PATCH | /api/tasks/:id | タスク更新 |

---

## 5. セキュリティ設計

### 5.1 認証・認可

- 認証方式: JWT
- トークン有効期限: 1時間
- リフレッシュトークン: 7日間

### 5.2 データ保護

- パスワード: bcrypt（salt rounds: 10）
- 通信: HTTPS必須
- CORS: ホワイトリスト方式

---

## 6. パフォーマンス設計

### 6.1 目標値

| 指標 | 目標値 |
|------|--------|
| API応答時間 | 95%ile < 200ms |
| ページロード | < 2秒 |
| 同時接続数 | 1000 |

### 6.2 最適化戦略

- DB: インデックス最適化、コネクションプール
- API: レスポンスキャッシュ（Redis）
- Frontend: Code Splitting、Lazy Loading

---

## 7. エラーハンドリング

### 7.1 エラーコード体系

| コード | 説明 |
|-------|------|
| E1000 | バリデーションエラー |
| E2000 | 認証エラー |
| E3000 | 権限エラー |
| E4000 | データ不整合エラー |
| E9000 | システムエラー |

---

## 8. デプロイメント

### 8.1 環境

| 環境 | 用途 |
|------|------|
| Development | 開発環境 |
| Staging | 本番前検証 |
| Production | 本番環境 |

### 8.2 CI/CD

\```mermaid
graph LR
    Dev[開発] --> Test[テスト実行]
    Test --> Build[ビルド]
    Build --> Deploy[デプロイ]
    Deploy --> Verify[動作確認]
\```

---

## 9. 参考資料

- ストーリーマッピング: `../story-mapping/story-map.md`
- 既存システム設計: `{existing_docs}`
```

### 3.3 生成プロンプト例

```
以下のユーザーストーリーマッピングから全体設計書を作成してください:
{story_mapping}

既存のシステム構成:
{current_architecture}

作成ガイドライン:
1. アーキテクチャ図をMermaid形式で描く
2. 技術スタックは既存システムと統一する
3. レイヤー構成を明確にする
4. セキュリティ、パフォーマンス、エラーハンドリングを考慮
5. 必要最小限の設計（過剰設計を避ける）

出力形式: Markdown
```

---

## 4. UI/UX設計

### 4.1 目的

- ユーザーインターフェースの画面遷移を定義
- ワイヤーフレームによる画面レイアウトの可視化
- 画面ごとのコンポーネント構成を明確化

### 4.2 wireframes.md テンプレート

**ファイル**: `design/uiux/wireframes.md`

```markdown
# UI/UX設計書

**作成日**: {date}
**作成者**: TechLeadAI

---

## 1. 画面遷移図

\```mermaid
graph TD
    Home[ホーム画面] --> TaskList[タスク一覧]
    TaskList --> TaskDetail[タスク詳細]
    TaskDetail --> TaskEdit[タスク編集]
    TaskEdit --> TaskList
    TaskList --> TaskCreate[タスク作成]
    TaskCreate --> TaskList
\```

---

## 2. 画面定義

### 2.1 タスク一覧画面（SCR-001）

**目的**: タスクをKanban形式で一覧表示

**レイアウト**:

\```mermaid
graph TB
    subgraph "タスク一覧画面"
        Header[ヘッダー: タイトル、フィルタ、検索]
        Kanban[Kanbanボード]
        Footer[フッター: タスク作成ボタン]
    end

    subgraph "Kanbanボード"
        Pending[Pending列]
        InProgress[In Progress列]
        Completed[Completed列]
    end

    Header --> Kanban
    Kanban --> Pending
    Kanban --> InProgress
    Kanban --> Completed
    Kanban --> Footer
\```

**コンポーネント構成**:
- `TaskListHeader`: フィルタ、検索、ソート機能
- `TaskKanbanBoard`: Kanbanボード本体
- `KanbanColumn`: 各列（Pending, In Progress, Completed）
- `TaskCard`: タスクカード
- `TaskCreateButton`: タスク作成ボタン

**状態管理**:
- `tasks: Task[]`: タスク一覧
- `filter: FilterState`: フィルタ状態
- `searchQuery: string`: 検索クエリ

**イベント**:
- `onTaskClick(taskId)`: タスククリック → タスク詳細画面へ
- `onCreateTask()`: タスク作成ボタンクリック → タスク作成画面へ
- `onFilterChange(filter)`: フィルタ変更 → タスク一覧を再取得

---

### 2.2 タスク詳細画面（SCR-002）

**目的**: タスクの詳細情報を表示・編集

**レイアウト**:

\```
┌─────────────────────────────────────┐
│ ← 戻る          タスク詳細   編集   │
├─────────────────────────────────────┤
│ タイトル: タスク名                   │
│ ステータス: [In Progress ▼]         │
│ 優先度: [80 ▼]                      │
│ 説明:                               │
│ ┌─────────────────────────────────┐ │
│ │ タスクの詳細説明                  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 依存タスク:                          │
│ - Task-1: DB migration              │
│ - Task-2: Model implementation      │
│                                     │
│ [保存]  [キャンセル]                │
└─────────────────────────────────────┘
\```

**コンポーネント構成**:
- `TaskDetailHeader`: 戻るボタン、編集ボタン
- `TaskForm`: タスク入力フォーム
- `DependencyList`: 依存タスク一覧

---

## 3. デザインシステム

### 3.1 カラーパレット

| 用途 | カラー | HEX |
|------|--------|-----|
| Primary | Blue | #3B82F6 |
| Success | Green | #10B981 |
| Warning | Amber | #F59E0B |
| Error | Red | #EF4444 |
| Background | White | #FFFFFF |
| Text | Gray 900 | #111827 |

### 3.2 タイポグラフィ

| 要素 | フォント | サイズ |
|------|---------|-------|
| H1 | Inter Bold | 32px |
| H2 | Inter Bold | 24px |
| Body | Inter Regular | 16px |
| Caption | Inter Regular | 14px |

---

## 4. レスポンシブデザイン

| ブレークポイント | 幅 | レイアウト |
|----------------|-----|-----------|
| Mobile | < 640px | 1列表示 |
| Tablet | 640-1024px | 2列表示 |
| Desktop | > 1024px | 3列表示 |
```

### 4.3 screens.json テンプレート

**ファイル**: `design/uiux/screens.json`

```json
{
  "screens": [
    {
      "id": "SCR-001",
      "name": "タスク一覧画面",
      "path": "/tasks",
      "description": "タスクをKanban形式で一覧表示",
      "components": [
        {
          "name": "TaskListHeader",
          "props": ["filter", "searchQuery", "onFilterChange", "onSearchChange"]
        },
        {
          "name": "TaskKanbanBoard",
          "props": ["tasks", "onTaskClick"]
        },
        {
          "name": "TaskCreateButton",
          "props": ["onCreateTask"]
        }
      ],
      "state": {
        "tasks": "Task[]",
        "filter": "FilterState",
        "searchQuery": "string"
      },
      "events": [
        {
          "name": "onTaskClick",
          "params": ["taskId: string"],
          "action": "Navigate to /tasks/:taskId"
        },
        {
          "name": "onCreateTask",
          "params": [],
          "action": "Navigate to /tasks/new"
        }
      ]
    },
    {
      "id": "SCR-002",
      "name": "タスク詳細画面",
      "path": "/tasks/:id",
      "description": "タスクの詳細情報を表示・編集",
      "components": [
        {
          "name": "TaskDetailHeader",
          "props": ["onBack", "onEdit"]
        },
        {
          "name": "TaskForm",
          "props": ["task", "onChange", "onSubmit"]
        },
        {
          "name": "DependencyList",
          "props": ["dependencies"]
        }
      ],
      "state": {
        "task": "Task",
        "isEditing": "boolean"
      },
      "events": [
        {
          "name": "onSave",
          "params": ["task: Task"],
          "action": "Update task and navigate back"
        }
      ]
    }
  ]
}
```

### 4.4 生成プロンプト例

```
以下のユーザーストーリーからUI/UX設計を作成してください:
{user_stories}

既存のUI構成:
{current_ui_components}

作成内容:
1. 画面遷移図（Mermaid）
2. 各画面のワイヤーフレーム（ASCII art or Mermaid）
3. コンポーネント構成
4. 状態管理
5. イベント定義

出力:
- wireframes.md（Markdown + Mermaid）
- screens.json（JSON構造化データ）
```

---

## 5. DB設計

### 5.1 目的

- データモデルの定義
- テーブル構造、リレーションシップの明確化
- インデックス戦略の定義

### 5.2 er-diagram.md テンプレート

**ファイル**: `design/database/er-diagram.md`

```markdown
# DB設計書

**作成日**: {date}
**作成者**: TechLeadAI

---

## 1. ER図

\```mermaid
erDiagram
    TASK ||--o{ TASK_DEPENDENCY : has
    TASK ||--o{ REVIEW : reviewed_by
    USER ||--o{ TASK : creates

    TASK {
        string id PK "UUID"
        string title "タスクタイトル"
        text description "タスク詳細"
        int priority "優先度（0-100）"
        enum status "pending, in_progress, completed, failed"
        string created_by FK "作成者"
        datetime created_at
        datetime updated_at
    }

    TASK_DEPENDENCY {
        string task_id FK
        string depends_on_task_id FK
        datetime created_at
    }

    REVIEW {
        string id PK "UUID"
        string task_id FK
        string reviewer_id FK
        enum status "approved, changes_requested"
        text comments "レビューコメント"
        datetime created_at
    }

    USER {
        string id PK "UUID"
        string name
        string email
        datetime created_at
    }
\```

---

## 2. テーブル定義

### 2.1 tasks テーブル

**目的**: タスク情報を管理

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|---|------|----------|------|------|
| id | VARCHAR(36) | NO | - | PK | タスクID（UUID） |
| title | VARCHAR(255) | NO | - | - | タスクタイトル |
| description | TEXT | YES | NULL | - | タスク詳細 |
| priority | INT | NO | 50 | CHECK (0-100) | 優先度 |
| status | ENUM | NO | 'pending' | - | ステータス |
| created_by | VARCHAR(36) | NO | - | FK → users.id | 作成者 |
| created_at | DATETIME | NO | CURRENT_TIMESTAMP | - | 作成日時 |
| updated_at | DATETIME | NO | CURRENT_TIMESTAMP | ON UPDATE | 更新日時 |

**インデックス**:
- PRIMARY KEY: `id`
- INDEX: `idx_status` ON `status`
- INDEX: `idx_created_by` ON `created_by`
- INDEX: `idx_priority_status` ON `priority, status`

**サンプルSQL**:
\```sql
CREATE TABLE tasks (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority INT NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
    status ENUM('pending', 'ready', 'in_progress', 'in_review', 'completed', 'failed') NOT NULL DEFAULT 'pending',
    created_by VARCHAR(36) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_status ON tasks(status);
CREATE INDEX idx_created_by ON tasks(created_by);
CREATE INDEX idx_priority_status ON tasks(priority, status);
\```

---

### 2.2 task_dependencies テーブル

**目的**: タスク間の依存関係を管理

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|---|------|----------|------|------|
| task_id | VARCHAR(36) | NO | - | FK → tasks.id | タスクID |
| depends_on_task_id | VARCHAR(36) | NO | - | FK → tasks.id | 依存先タスクID |
| created_at | DATETIME | NO | CURRENT_TIMESTAMP | - | 作成日時 |

**インデックス**:
- PRIMARY KEY: `(task_id, depends_on_task_id)`
- INDEX: `idx_depends_on` ON `depends_on_task_id`

**サンプルSQL**:
\```sql
CREATE TABLE task_dependencies (
    task_id VARCHAR(36) NOT NULL,
    depends_on_task_id VARCHAR(36) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (task_id, depends_on_task_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (depends_on_task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX idx_depends_on ON task_dependencies(depends_on_task_id);
\```

---

## 3. マイグレーション戦略

### 3.1 マイグレーション順序

1. `001_create_users.sql`: usersテーブル作成
2. `002_create_tasks.sql`: tasksテーブル作成
3. `003_create_task_dependencies.sql`: task_dependenciesテーブル作成
4. `004_create_reviews.sql`: reviewsテーブル作成

### 3.2 ロールバック戦略

各マイグレーションにはロールバックSQLを用意:
\```sql
-- rollback: 002_create_tasks.sql
DROP TABLE IF EXISTS tasks;
\```

---

## 4. パフォーマンス最適化

### 4.1 インデックス戦略

- **単一カラムインデックス**: 頻繁に検索されるカラム（status, created_by）
- **複合インデックス**: 複数条件での検索（priority + status）
- **カバリングインデックス**: SELECT句の全カラムを含むインデックス

### 4.2 クエリ最適化

- N+1問題回避: JOIN or バッチ取得
- ページネーション: OFFSET/LIMITではなくカーソルベース
```

### 5.3 schema.json テンプレート

**ファイル**: `design/database/schema.json`

```json
{
  "version": "1.0.0",
  "database": "kugutsu_dev",
  "tables": [
    {
      "name": "tasks",
      "comment": "タスク管理テーブル",
      "columns": [
        {
          "name": "id",
          "type": "VARCHAR(36)",
          "nullable": false,
          "primaryKey": true,
          "comment": "タスクID（UUID）"
        },
        {
          "name": "title",
          "type": "VARCHAR(255)",
          "nullable": false,
          "comment": "タスクタイトル"
        },
        {
          "name": "description",
          "type": "TEXT",
          "nullable": true,
          "default": null,
          "comment": "タスク詳細"
        },
        {
          "name": "priority",
          "type": "INT",
          "nullable": false,
          "default": 50,
          "check": "priority BETWEEN 0 AND 100",
          "comment": "優先度（0-100）"
        },
        {
          "name": "status",
          "type": "ENUM('pending', 'ready', 'in_progress', 'in_review', 'completed', 'failed')",
          "nullable": false,
          "default": "'pending'",
          "comment": "ステータス"
        },
        {
          "name": "created_by",
          "type": "VARCHAR(36)",
          "nullable": false,
          "foreignKey": {
            "table": "users",
            "column": "id",
            "onDelete": "CASCADE"
          },
          "comment": "作成者"
        },
        {
          "name": "created_at",
          "type": "DATETIME",
          "nullable": false,
          "default": "CURRENT_TIMESTAMP",
          "comment": "作成日時"
        },
        {
          "name": "updated_at",
          "type": "DATETIME",
          "nullable": false,
          "default": "CURRENT_TIMESTAMP",
          "onUpdate": "CURRENT_TIMESTAMP",
          "comment": "更新日時"
        }
      ],
      "indexes": [
        {
          "name": "PRIMARY",
          "columns": ["id"],
          "unique": true
        },
        {
          "name": "idx_status",
          "columns": ["status"],
          "unique": false
        },
        {
          "name": "idx_created_by",
          "columns": ["created_by"],
          "unique": false
        },
        {
          "name": "idx_priority_status",
          "columns": ["priority", "status"],
          "unique": false
        }
      ]
    },
    {
      "name": "task_dependencies",
      "comment": "タスク依存関係テーブル",
      "columns": [
        {
          "name": "task_id",
          "type": "VARCHAR(36)",
          "nullable": false,
          "foreignKey": {
            "table": "tasks",
            "column": "id",
            "onDelete": "CASCADE"
          }
        },
        {
          "name": "depends_on_task_id",
          "type": "VARCHAR(36)",
          "nullable": false,
          "foreignKey": {
            "table": "tasks",
            "column": "id",
            "onDelete": "CASCADE"
          }
        },
        {
          "name": "created_at",
          "type": "DATETIME",
          "nullable": false,
          "default": "CURRENT_TIMESTAMP"
        }
      ],
      "indexes": [
        {
          "name": "PRIMARY",
          "columns": ["task_id", "depends_on_task_id"],
          "unique": true
        },
        {
          "name": "idx_depends_on",
          "columns": ["depends_on_task_id"],
          "unique": false
        }
      ]
    }
  ],
  "relationships": [
    {
      "from": "tasks",
      "to": "users",
      "fromColumn": "created_by",
      "toColumn": "id",
      "type": "many-to-one"
    },
    {
      "from": "task_dependencies",
      "to": "tasks",
      "fromColumn": "task_id",
      "toColumn": "id",
      "type": "many-to-one"
    },
    {
      "from": "task_dependencies",
      "to": "tasks",
      "fromColumn": "depends_on_task_id",
      "toColumn": "id",
      "type": "many-to-one"
    }
  ]
}
```

### 5.4 生成プロンプト例

```
以下のユーザーストーリーからDB設計を作成してください:
{user_stories}

既存のDB schema:
{current_db_schema}

作成内容:
1. ER図（Mermaid erDiagram形式）
2. 各テーブルの詳細定義
3. インデックス戦略
4. マイグレーションSQL
5. パフォーマンス最適化方針

出力:
- er-diagram.md（Markdown + Mermaid）
- schema.json（JSON構造化データ）
```

---

## 6. I/O設計（API仕様）

### 6.1 目的

- RESTful APIの仕様を定義
- リクエスト/レスポンスの構造を明確化
- OpenAPI 3.0準拠のスキーマを生成

### 6.2 api-spec.md テンプレート

**ファイル**: `design/interfaces/api-spec.md`

```markdown
# API仕様書

**作成日**: {date}
**作成者**: TechLeadAI
**ベースURL**: `https://api.example.com/v1`

---

## 1. API一覧

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| GET | /tasks | タスク一覧取得 | Required |
| POST | /tasks | タスク作成 | Required |
| GET | /tasks/:id | タスク詳細取得 | Required |
| PATCH | /tasks/:id | タスク更新 | Required |
| DELETE | /tasks/:id | タスク削除 | Required |

---

## 2. エンドポイント詳細

### 2.1 GET /tasks

**概要**: タスク一覧を取得

**認証**: Required（JWT Bearer Token）

**クエリパラメータ**:
| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|---|------|----------|------|
| status | string | No | - | ステータスでフィルタ |
| priority_min | integer | No | 0 | 最小優先度 |
| priority_max | integer | No | 100 | 最大優先度 |
| page | integer | No | 1 | ページ番号 |
| limit | integer | No | 20 | 1ページあたりの件数 |

**リクエスト例**:
\```bash
GET /tasks?status=in_progress&priority_min=50&page=1&limit=20
Authorization: Bearer {token}
\```

**レスポンス 200 OK**:
\```json
{
  "data": [
    {
      "id": "task-1",
      "title": "DB migration",
      "description": "Create tasks table migration",
      "priority": 90,
      "status": "in_progress",
      "createdBy": "user-1",
      "createdAt": "2025-11-05T10:00:00Z",
      "updatedAt": "2025-11-05T11:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
\```

**レスポンス 401 Unauthorized**:
\```json
{
  "error": {
    "code": "E2001",
    "message": "Authentication required"
  }
}
\```

---

### 2.2 POST /tasks

**概要**: 新規タスクを作成

**認証**: Required

**リクエストボディ**:
\```json
{
  "title": "Task title",
  "description": "Task description",
  "priority": 80,
  "dependencies": ["task-1", "task-2"]
}
\```

**レスポンス 201 Created**:
\```json
{
  "data": {
    "id": "task-3",
    "title": "Task title",
    "description": "Task description",
    "priority": 80,
    "status": "pending",
    "createdBy": "user-1",
    "createdAt": "2025-11-05T12:00:00Z",
    "updatedAt": "2025-11-05T12:00:00Z"
  }
}
\```

**レスポンス 400 Bad Request**:
\```json
{
  "error": {
    "code": "E1001",
    "message": "Validation error",
    "details": [
      {
        "field": "title",
        "message": "Title is required"
      }
    ]
  }
}
\```

---

## 3. データモデル

### 3.1 Task

\```json
{
  "id": "string (UUID)",
  "title": "string (max 255)",
  "description": "string | null",
  "priority": "integer (0-100)",
  "status": "enum (pending, ready, in_progress, in_review, completed, failed)",
  "createdBy": "string (UUID)",
  "createdAt": "string (ISO 8601)",
  "updatedAt": "string (ISO 8601)"
}
\```

---

## 4. エラーコード

| コード | 説明 |
|-------|------|
| E1001 | バリデーションエラー |
| E2001 | 認証エラー |
| E3001 | 権限エラー |
| E4001 | リソースが見つからない |
| E9001 | サーバーエラー |
```

### 6.3 api-spec.json テンプレート

**ファイル**: `design/interfaces/api-spec.json`

**フォーマット**: OpenAPI 3.0

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "Task Management API",
    "version": "1.0.0",
    "description": "タスク管理システムのAPI仕様"
  },
  "servers": [
    {
      "url": "https://api.example.com/v1",
      "description": "Production"
    }
  ],
  "paths": {
    "/tasks": {
      "get": {
        "summary": "タスク一覧取得",
        "operationId": "getTasks",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          {
            "name": "status",
            "in": "query",
            "schema": { "type": "string" },
            "description": "ステータスでフィルタ"
          },
          {
            "name": "priority_min",
            "in": "query",
            "schema": { "type": "integer", "minimum": 0, "maximum": 100 }
          },
          {
            "name": "priority_max",
            "in": "query",
            "schema": { "type": "integer", "minimum": 0, "maximum": 100 }
          },
          {
            "name": "page",
            "in": "query",
            "schema": { "type": "integer", "minimum": 1, "default": 1 }
          },
          {
            "name": "limit",
            "in": "query",
            "schema": { "type": "integer", "minimum": 1, "maximum": 100, "default": 20 }
          }
        ],
        "responses": {
          "200": {
            "description": "成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "data": {
                      "type": "array",
                      "items": { "$ref": "#/components/schemas/Task" }
                    },
                    "pagination": { "$ref": "#/components/schemas/Pagination" }
                  }
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          }
        }
      },
      "post": {
        "summary": "タスク作成",
        "operationId": "createTask",
        "security": [{ "bearerAuth": [] }],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": { "$ref": "#/components/schemas/TaskCreate" }
            }
          }
        },
        "responses": {
          "201": {
            "description": "作成成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "data": { "$ref": "#/components/schemas/Task" }
                  }
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          }
        }
      }
    },
    "/tasks/{id}": {
      "get": {
        "summary": "タスク詳細取得",
        "operationId": "getTaskById",
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": { "type": "string" }
          }
        ],
        "responses": {
          "200": {
            "description": "成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "data": { "$ref": "#/components/schemas/Task" }
                  }
                }
              }
            }
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT"
      }
    },
    "schemas": {
      "Task": {
        "type": "object",
        "properties": {
          "id": { "type": "string", "format": "uuid" },
          "title": { "type": "string", "maxLength": 255 },
          "description": { "type": "string", "nullable": true },
          "priority": { "type": "integer", "minimum": 0, "maximum": 100 },
          "status": {
            "type": "string",
            "enum": ["pending", "ready", "in_progress", "in_review", "completed", "failed"]
          },
          "createdBy": { "type": "string", "format": "uuid" },
          "createdAt": { "type": "string", "format": "date-time" },
          "updatedAt": { "type": "string", "format": "date-time" }
        }
      },
      "TaskCreate": {
        "type": "object",
        "required": ["title", "priority"],
        "properties": {
          "title": { "type": "string", "maxLength": 255 },
          "description": { "type": "string" },
          "priority": { "type": "integer", "minimum": 0, "maximum": 100 },
          "dependencies": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      },
      "Pagination": {
        "type": "object",
        "properties": {
          "page": { "type": "integer" },
          "limit": { "type": "integer" },
          "total": { "type": "integer" },
          "totalPages": { "type": "integer" }
        }
      },
      "Error": {
        "type": "object",
        "properties": {
          "error": {
            "type": "object",
            "properties": {
              "code": { "type": "string" },
              "message": { "type": "string" },
              "details": { "type": "array", "items": { "type": "object" } }
            }
          }
        }
      }
    },
    "responses": {
      "BadRequest": {
        "description": "バリデーションエラー",
        "content": {
          "application/json": {
            "schema": { "$ref": "#/components/schemas/Error" }
          }
        }
      },
      "Unauthorized": {
        "description": "認証エラー",
        "content": {
          "application/json": {
            "schema": { "$ref": "#/components/schemas/Error" }
          }
        }
      },
      "NotFound": {
        "description": "リソースが見つからない",
        "content": {
          "application/json": {
            "schema": { "$ref": "#/components/schemas/Error" }
          }
        }
      }
    }
  }
}
```

### 6.4 生成プロンプト例

```
以下のユーザーストーリーとDB設計からAPI仕様を作成してください:
{user_stories}
{db_schema}

作成内容:
1. RESTful APIエンドポイント定義
2. リクエスト/レスポンスの構造
3. 認証・認可方式
4. エラーハンドリング
5. OpenAPI 3.0準拠のスキーマ

出力:
- api-spec.md（Markdown）
- api-spec.json（OpenAPI 3.0 JSON）
```

---

## 6.5 Sprint Planning Document

### 概要

AI駆動で生成されたスプリント計画の文書化

### ファイル名

`sprint-plan-{sprint-id}.md`

### 保存場所

`.kugutsu/projects/{projectId}/sprints/`

### 構成要素

```markdown
# Sprint {番号}: {名前}

**スプリントID**: sprint-{uuid}
**ゴール**: {1-2文の簡潔な説明}
**見積もり時間**: {合計時間}h（8-16h範囲内）
**開始日時**: {ISO 8601}
**ステータス**: planning | active | review | completed

## タスクリスト

### Task 1: {タイトル}
- **タスクID**: task-{uuid}
- **優先度**: {0-100}
- **見積もり**: {時間}h
- **依存関係**: {依存タスクID[], 空の場合 "なし"}
- **受入基準**:
  - [ ] 基準1
  - [ ] 基準2

## 依存関係グラフ

\```mermaid
graph TD
    task-1[Task 1] --> task-2[Task 2]
    task-1 --> task-3[Task 3]
\```

## デプロイ可能性チェックリスト

- [ ] すべてのテストが通過
- [ ] コードレビュー完了
- [ ] E2Eテスト可能
```

### 生成タイミング

SprintPlanningNode完了時に自動生成

---

## 7. まとめ

本仕様書では、TechLeadAIが生成する4種類の設計書のフォーマットとテンプレートを定義しました。

**主要な特徴**:
1. **二重フォーマット**: Markdown（人間用） + JSON（プログラム用）
2. **Mermaid図**: 視覚的に理解しやすいダイアグラム
3. **標準準拠**: OpenAPI 3.0など業界標準に準拠
4. **詳細かつ明確**: エンジニア間で実装がブレない明確さ
5. **既存システム尊重**: 既存構成との整合性を保つ

次のステップ:
- `ARCHITECTURE_DESIGN.md` を更新してDirectorNode、新ワークフローを追加
- `COMPONENT_SPECIFICATION.md` を更新してKanbanボード、新UIコンポーネントを追加
- `IMPLEMENTATION_TASKS.md` にPhase 6（スクラム機能実装）を追加

---

**最終更新**: 2025-11-05
**バージョン**: 1.0.0
**承認**: 待機中
