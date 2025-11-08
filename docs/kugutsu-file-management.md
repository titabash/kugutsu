# .kugutsu ファイル管理ドキュメント

## 概要

このドキュメントは、Kugutsu 2.0 システムが `.kugutsu` ディレクトリ配下で作成・管理するファイルの一覧と、ノード間のファイル受け渡しの仕組みを説明します。

## 重要な設計方針

### AI-First原則

**すべてのファイルはAIが作成します**。システムが直接ファイルを書き込むことはありません。

- ✅ **AIFileWriter経由**: AIにWriteツールを使わせてファイルを作成
- ❌ **DataPersistence経由**: システムが直接fs.writeFileでファイルを作成（旧方式、廃止済み）

### Upsert方式

- **ProductOwnerNode**: 既存ファイルがあれば読み込んで更新、なければ新規作成
- **それ以降のノード**: 前のノードが作成したファイルが必ず存在する前提で動作

## ディレクトリ構造

```
.kugutsu/
├── config.json                          # システム設定
├── tasks/
│   ├── tasks.json                       # タスク定義（並列開発）
│   ├── global-queue.json                # グローバルタスクキュー（スプリント開発）
│   └── {taskId}/
│       ├── instruction.md               # タスク実装指示
│       ├── review.json                  # レビュー結果
│       ├── merge-result.json            # マージ結果
│       └── conflicts.json               # コンフリクト情報
├── tech-stack.json                      # 技術スタック分析
├── requirements.json                    # 要求分析結果
├── sprints/
│   ├── active-sprint.json               # アクティブスプリント
│   └── sprint-history.json              # スプリント履歴
└── projects/
    └── {projectId}/
        ├── project.json                 # プロジェクトメタデータ
        ├── story-mapping/
        │   ├── story-map.json           # ストーリーマッピング
        │   ├── story-map.md
        │   └── review-history.json      # レビュー履歴
        └── design/
            ├── design-docs.md           # 全体設計書
            ├── database/
            │   ├── schema.json
            │   └── er-diagram.md
            ├── interfaces/
            │   ├── api-spec.json
            │   └── api-spec.md
            └── uiux/
                ├── screens.json
                └── wireframes.md
```

## ファイル一覧と詳細

### 並列開発ワークフロー

| ファイルパス | 作成ノード | 参照ノード | 作成方針 | 必須項目 |
|------------|-----------|-----------|---------|---------|
| `.kugutsu/tech-stack.json` | ProductOwnerNode | ProductOwnerNode | **Upsert** | languages, frameworks, buildTools, testingFrameworks, projectType |
| `.kugutsu/requirements.json` | ProductOwnerNode | ProductOwnerNode | **Upsert** | functional, nonFunctional, constraints |
| `.kugutsu/tasks.json` | ProductOwnerNode | EngineerNode, ReviewNode, MergeCoordinatorNode, ConflictResolverNode | **Upsert**（既存タスクとマージ） | id, title, description, priority, dependencies, status, createdAt, updatedAt |
| `.kugutsu/tasks/{taskId}/instruction.md` | ProductOwnerNode | EngineerNode | **Upsert** | タスクの目的、実装詳細、テスト手順、動作確認方法 |
| `.kugutsu/tasks/{taskId}/review.json` | ReviewNode | MergeCoordinatorNode | **新規作成** | approved, comments, reviewer, timestamp |
| `.kugutsu/tasks/{taskId}/merge-result.json` | MergeCoordinatorNode | - | **新規作成** | success, mergedAt, commitHash（成功時） / conflicts（失敗時） |
| `.kugutsu/tasks/{taskId}/conflicts.json` | MergeCoordinatorNode | ConflictResolverNode | **新規作成** | files, resolution |

### Scrumワークフロー

| ファイルパス | 作成ノード | 参照ノード | 作成方針 | 必須項目 |
|------------|-----------|-----------|---------|---------|
| `.kugutsu/projects/{projectId}/story-mapping/story-map.json` | DirectorNode | ReviewStoryMappingNode, TechLeadDesignNode | **新規作成** | persona, epics (id, title, description, priority, stories) |
| `.kugutsu/projects/{projectId}/story-mapping/story-map.md` | DirectorNode | - | **新規作成** | story-map.jsonの人間可読版 |
| `.kugutsu/projects/{projectId}/story-mapping/review-history.json` | ReviewStoryMappingNode | ReviewStoryMappingNode | **Upsert**（レビュー履歴に追加） | reviews配列 (iteration, timestamp, reviewer, approved, issues, suggestions) |
| `.kugutsu/projects/{projectId}/design/design-docs.md` | TechLeadDesignNode | - | **新規作成** | 全体設計、UI/UXサマリー、DBサマリー、I/Oサマリー、セキュリティ、パフォーマンス |
| `.kugutsu/projects/{projectId}/design/database/schema.json` | TechLeadDesignNode | TechLeadDesignNode（API設計時） | **新規作成** | version, database, tables, relationships |
| `.kugutsu/projects/{projectId}/design/database/er-diagram.md` | TechLeadDesignNode | - | **新規作成** | ER図（Mermaid）、テーブル定義、インデックス戦略 |
| `.kugutsu/projects/{projectId}/design/interfaces/api-spec.json` | TechLeadDesignNode | - | **新規作成** | OpenAPI 3.0形式 |
| `.kugutsu/projects/{projectId}/design/interfaces/api-spec.md` | TechLeadDesignNode | - | **新規作成** | API一覧、エンドポイント詳細、データモデル |
| `.kugutsu/projects/{projectId}/design/uiux/screens.json` | TechLeadDesignNode | - | **新規作成** | screens配列 (id, name, path, components, state, events) |
| `.kugutsu/projects/{projectId}/design/uiux/wireframes.md` | TechLeadDesignNode | - | **新規作成** | 画面遷移図、ワイヤーフレーム、コンポーネント構成 |

### スプリント駆動ワークフロー

| ファイルパス | 作成ノード | 参照ノード | 作成方針 | 必須項目 |
|------------|-----------|-----------|---------|---------|
| `.kugutsu/sprints/active-sprint.json` | SprintPlanningNode | SprintPlanningNode | **Upsert** | id, name, goal, taskIds, status, deployable, metadata |
| `.kugutsu/tasks/global-queue.json` | SprintPlanningNode | SprintPlanningNode | **Upsert** | タスク配列（tasks.jsonと同じ構造） |

## ノード別のファイル操作

### ProductOwnerNode

**役割**: 要求分析、技術スタック分析、タスク分解

**作成するファイル（Upsert方式）**:
1. `.kugutsu/tech-stack.json` - AIにWriteツールで作成させる
2. `.kugutsu/requirements.json` - AIにWriteツールで作成させる
3. `.kugutsu/tasks.json` - AIにWriteツールで作成させる（既存タスクとマージ）
4. `.kugutsu/tasks/{taskId}/instruction.md` - 各タスクごとにAIにWriteツールで作成させる

**プロンプトの特徴**:
- 各フェーズで「Readツールでファイルの存在を確認→存在すれば更新、なければ作成」を明示
- `allowedTools: ['Read', 'Glob', 'Grep', 'Write']`

**エラーハンドリング**:
- 各フェーズでRetryManager使用（最大3回リトライ）
- ファイル読み込み失敗時は warning表示して空の内容で続行

### EngineerNode

**役割**: タスクの実装

**読み込むファイル（前提条件）**:
1. `.kugutsu/tasks.json` - 必須（tasksPath経由）
2. `.kugutsu/tasks/{taskId}/instruction.md` - 必須（FileReader経由）

**更新するファイル**:
- `.kugutsu/tasks.json` - AIFileWriter経由でステータス更新（implemented → failed）

**プロンプトの特徴**:
- 「前提条件：必須ファイル」セクションで依存ファイルを明示
- TDD（テスト駆動開発）の手順を強調
- `git add`と`git commit`を実行させる（`git push`は禁止）

### ReviewNode

**役割**: コードレビュー

**読み込むファイル（前提条件）**:
- `.kugutsu/tasks.json` - 必須

**作成するファイル**:
1. `.kugutsu/tasks/{taskId}/review.json` - AIFileWriter経由で作成
   - 必須項目: approved, comments, reviewer, timestamp

**更新するファイル**:
- `.kugutsu/tasks.json` - AIFileWriter経由でステータス更新（reviewed、承認時のみ）

### MergeCoordinatorNode

**役割**: マージ調整とコンフリクト検出

**読み込むファイル（前提条件）**:
1. `.kugutsu/tasks.json` - 必須
2. `.kugutsu/tasks/{taskId}/review.json` - 必須（承認確認用）

**作成するファイル**:
- **マージ成功時**:
  1. `.kugutsu/tasks/{taskId}/merge-result.json`
  2. `.kugutsu/tasks.json` 更新（status: "completed"）

- **コンフリクト発生時**:
  1. `.kugutsu/tasks/{taskId}/merge-result.json`
  2. `.kugutsu/tasks/{taskId}/conflicts.json`
  3. `.kugutsu/tasks.json` 更新（status: "conflict_detected"）

### ConflictResolverNode

**役割**: コンフリクト解決

**読み込むファイル（前提条件）**:
1. `.kugutsu/tasks.json` - 必須
2. `.kugutsu/tasks/{taskId}/conflicts.json` - 必須

**更新するファイル**:
1. `.kugutsu/tasks/{taskId}/conflicts.json` - resolution: "resolved" に更新
2. `.kugutsu/tasks.json` - status: "reviewed" に更新

### DirectorNode

**役割**: ストーリーマッピング作成

**作成するファイル**:
1. `.kugutsu/projects/{projectId}/story-mapping/story-map.json` - AIFileWriter経由
2. `.kugutsu/projects/{projectId}/story-mapping/story-map.md` - AIFileWriter経由（同時作成）

**プロンプトの特徴**:
- JSON形式の詳細な構造を提示
- ペルソナ、エピック、ユーザーストーリーの作成を指示
- 優先度と見積もりポイントの設定を指示

### TechLeadDesignNode

**役割**: 技術設計書作成

**読み込むファイル（前提条件）**:
- `.kugutsu/projects/{projectId}/story-mapping/story-map.json` - 必須

**作成するファイル（すべてAIFileWriter経由）**:
1. `.kugutsu/projects/{projectId}/design/design-docs.md`
2. `.kugutsu/projects/{projectId}/design/database/schema.json`
3. `.kugutsu/projects/{projectId}/design/database/er-diagram.md`
4. `.kugutsu/projects/{projectId}/design/interfaces/api-spec.json`
5. `.kugutsu/projects/{projectId}/design/interfaces/api-spec.md`
6. `.kugutsu/projects/{projectId}/design/uiux/screens.json`
7. `.kugutsu/projects/{projectId}/design/uiux/wireframes.md`

**プロンプトの特徴**:
- 既存の`.kugutsu/repository/`配下の仕様を参照するよう指示
- Mermaid図の活用を推奨

### ReviewStoryMappingNode

**役割**: ストーリーマッピングのレビュー

**読み込むファイル（前提条件）**:
- `.kugutsu/projects/{projectId}/story-mapping/story-map.json` - 必須

**作成するファイル（Upsert方式）**:
- `.kugutsu/projects/{projectId}/story-mapping/review-history.json`
  - 既存履歴に新しいレビューを追加

### SprintPlanningNode

**役割**: スプリント計画作成

**読み込むファイル（Upsert方式）**:
- `.kugutsu/sprints/active-sprint.json` - 存在チェック（既にアクティブなスプリントがあるか）

**作成するファイル（Upsert方式）**:
1. `.kugutsu/sprints/active-sprint.json` - AIFileWriter経由
2. `.kugutsu/tasks/global-queue.json` - AIFileWriter経由

## ファイル依存関係グラフ

### 並列開発ワークフロー

```
ProductOwnerNode
  ↓ 作成（Upsert）
  tech-stack.json → requirements.json → tasks.json → tasks/{taskId}/instruction.md
  ↓ 読込
EngineerNode
  ↓ 更新
  tasks.json (status更新)
  ↓ 読込
ReviewNode
  ↓ 作成
  tasks/{taskId}/review.json
  ↓ 読込
MergeCoordinatorNode
  ↓ 作成
  tasks/{taskId}/merge-result.json
  tasks/{taskId}/conflicts.json (コンフリクト時)
  ↓ 読込
ConflictResolverNode
  ↓ 更新
  tasks/{taskId}/conflicts.json (resolution: resolved)
  tasks.json (status: reviewed)
```

### Scrumワークフロー

```
DirectorNode
  ↓ 作成
  projects/{projectId}/story-mapping/story-map.json
  projects/{projectId}/story-mapping/story-map.md
  ↓ 読込
ReviewStoryMappingNode
  ↓ 作成（Upsert）
  projects/{projectId}/story-mapping/review-history.json
  ↓ 承認後、読込
TechLeadDesignNode
  ↓ 作成
  projects/{projectId}/design/design-docs.md
  projects/{projectId}/design/database/schema.json
  projects/{projectId}/design/database/er-diagram.md
  projects/{projectId}/design/interfaces/api-spec.json
  projects/{projectId}/design/interfaces/api-spec.md
  projects/{projectId}/design/uiux/screens.json
  projects/{projectId}/design/uiux/wireframes.md
```

## エラーハンドリング方針

### ファイル不在時の対応

| ケース | 対応 |
|--------|------|
| ProductOwnerNodeで既存ファイル不在 | 新規作成（Upsert方式） |
| EngineerNodeでtasks.json不在 | エラー返却（前のノードの失敗） |
| EngineerNodeでinstruction.md不在 | タスクをfailedに遷移 |
| ReviewNodeでtasks.json不在 | エラー返却 |
| MergeCoordinatorNodeでreview.json不在 | warning表示してタスクをスキップ |
| ConflictResolverNodeでconflicts.json不在 | warning表示してタスクをスキップ |

### リトライ戦略

ProductOwnerNodeの各フェーズ：
- 最大リトライ回数: 3回
- 初期遅延: 2秒
- 最大遅延: 30秒
- バックオフ係数: 2
- リトライ対象エラー: `ETIMEDOUT`, `ECONNRESET`, `rate_limit`, `Rate limit`, `timeout`, `network`

## トラブルシューティング

### 問題: ファイルが作成されない

**原因**: AIがWriteツールを使用しなかった

**解決方法**:
1. プロンプトで「**必ずWriteツールを使用してファイルを作成してください**」を明示
2. allowedToolsに`'Write'`を含める
3. AIFileWriter.writeFile()を使用する

### 問題: ファイルが空になる

**原因**: AIが内容を省略した

**解決方法**:
1. プロンプトで必須項目を明示
2. サンプル構造をプロンプトに含める
3. 「すべての項目を埋めてください」と指示

### 問題: 既存ファイルが上書きされる

**原因**: Upsert方式の指示が不足

**解決方法**:
1. プロンプトに「Readツールでファイルの存在を確認」を追加
2. 「既存内容を基に更新」を明示
3. ProductOwnerNodeでのみUpsert方式を使用

### 問題: 次のノードがファイル不在エラー

**原因**: 前のノードでファイル作成に失敗

**解決方法**:
1. ログで前のノードの実行結果を確認
2. AIFileWriterの実行ログを確認
3. RetryManagerのリトライ回数を確認

## ベストプラクティス

### 1. プロンプト設計

✅ **良い例**:
```
## 【必須作成ファイル】
以下のファイルをWriteツールで必ず作成してください：
- ファイルパス: .kugutsu/tasks.json

## ファイル作成・更新方針（Upsert）
1. Readツールで.kugutsu/tasks.jsonの存在を確認
2. 存在する場合: 既存内容を基に更新してWriteツールで保存
3. 存在しない場合: 新規作成してWriteツールで保存
```

❌ **悪い例**:
```
tasks.jsonを作成してください。
```

### 2. AIFileWriter使用

✅ **良い例**:
```typescript
const fileWriter = new AIFileWriter(provider);
await fileWriter.writeFile(
  filePath,
  '説明',
  prompt,
  { maxTurns: 5, cwd: baseRepoPath, permissionMode: 'acceptEdits' }
);
```

❌ **悪い例**:
```typescript
// システムが直接ファイルを作成（AI-First原則違反）
await fs.writeFile(filePath, content);
```

### 3. 前提条件の明示

✅ **良い例**:
```
## 【前提条件：必須ファイル】
以下のファイルは前のノード（ProductOwner）が作成済みです。必ず読み込んでください：
1. .kugutsu/tasks.json
2. .kugutsu/tasks/{taskId}/instruction.md

これらのファイルが存在しない場合はエラーです。
```

❌ **悪い例**:
```
タスクを実装してください。
```

## まとめ

1. **すべてのファイルはAIが作成する**（AI-First原則）
2. **ProductOwnerNodeはUpsert方式**（既存ファイルを尊重）
3. **それ以降のノードは前提条件を明示**（依存ファイルが必ず存在）
4. **プロンプトで作成するファイルを明確に指示**
5. **エラーハンドリングは適切に実装**（リトライ、デフォルト値、警告表示）

これらの原則に従うことで、ノード間のファイルのやり取りに不整合が起こらず、確実にファイルが作成・参照されます。
