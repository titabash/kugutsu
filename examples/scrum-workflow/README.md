# Scrum Workflow Example

このディレクトリには、Kugutsuのスクラム開発ワークフローを実行するためのサンプルデータが含まれています。

## サンプルプロジェクト: タスク管理アプリケーション

実際のプロジェクト例として、「タスク管理アプリケーション」の開発を想定しています。

### 📋 Story Mapping

`story-mapping-example.json` には、以下の内容が含まれています：

- **ペルソナ**: プロジェクトマネージャー
- **エピック**:
  1. ユーザー管理
  2. タスク管理
  3. プロジェクト管理
- **ユーザーストーリー**: 各エピックに対応するストーリー（優先度、見積ポイント付き）

### 🎨 Design Documents

`design-docs-example.json` には、以下の設計ドキュメントが含まれています：

- **全体設計**: システムアーキテクチャ、技術スタック、設計方針
- **UI/UX設計**: ワイヤーフレーム、画面構成
- **データベース設計**: ER図、スキーマ定義
- **API仕様**: RESTful API エンドポイント、OpenAPI仕様

### 🔗 Dependency Graph

`dependency-graph-example.json` には、タスクの依存関係グラフが含まれています：

- **ノード**: 各タスクとその詳細情報
- **エッジ**: タスク間の依存関係
- **クリティカルパス**: プロジェクト完了に必須のタスク経路
- **並列実行グループ**: 同時に実行可能なタスクのグループ

## 使用方法

### 1. Electron UIでサンプルデータを表示

```bash
# プロジェクトルートから
cd examples/scrum-workflow

# サンプルデータを使ってElectron UIを起動（※実装予定）
# kugutsu --demo scrum-workflow
```

### 2. サンプルデータの構造を確認

```bash
# Story Mapping
cat story-mapping-example.json | jq

# Design Documents
cat design-docs-example.json | jq

# Dependency Graph
cat dependency-graph-example.json | jq
```

### 3. カスタムプロジェクトでの活用

これらのサンプルデータを参考に、独自のプロジェクトで以下のファイルを作成できます：

```
your-project/
├── .kugutsu/
│   ├── story-mapping.json
│   ├── design-docs.json
│   └── dependency-graph.json
```

## サンプルデータの詳細

### Story Mapping Example

- **ペルソナ**: 田中太郎（プロジェクトマネージャー）
  - ゴール: チームの生産性を向上させ、プロジェクトの進捗を可視化する
  - ペインポイント: タスクの優先順位付けが困難、進捗状況の把握が難しい

- **エピック 1: ユーザー管理** (Priority: 1)
  - ストーリー数: 3
  - 合計ポイント: 13

- **エピック 2: タスク管理** (Priority: 2)
  - ストーリー数: 4
  - 合計ポイント: 21

- **エピック 3: プロジェクト管理** (Priority: 3)
  - ストーリー数: 3
  - 合計ポイント: 13

### Design Documents Example

- **技術スタック**:
  - Frontend: React + TypeScript + TailwindCSS
  - Backend: Node.js + Express + Prisma
  - Database: PostgreSQL
  - Deployment: Docker + AWS ECS

- **画面数**: 8画面（ログイン、ダッシュボード、タスク一覧など）

- **データベーステーブル**: 6テーブル（users, projects, tasks, など）

- **API エンドポイント**: 24エンドポイント（CRUD操作 + 検索・フィルタ）

### Dependency Graph Example

- **総タスク数**: 12
- **クリティカルパス**: 5タスク（ユーザー認証 → タスク作成 → タスク一覧 → テスト → デプロイ）
- **並列実行グループ**: 3グループ
  - グループ1: フロントエンド開発（3タスク）
  - グループ2: バックエンド開発（3タスク）
  - グループ3: テスト・デプロイ（2タスク）

## ビューアコンポーネント

これらのサンプルデータは、以下のElectron UIビューアで表示できます：

### StoryMappingViewer

- ペルソナカード
- エピック・ストーリーのアコーディオン表示
- 受入基準のチェックリスト
- 優先度とストーリーポイントのバッジ

### DesignDocsViewer

- タブ形式（全体設計、UI/UX、DB、API）
- マークダウンレンダリング
- JSON構造化データの表示
- スクロール対応

### DependencyGraphViewer

- ReactFlowによるグラフ可視化
- クリティカルパスの強調表示（赤いリング）
- 並列実行グループのバッジ（G1, G2, ...）
- ミニマップでナビゲーション

## 実際のプロジェクトでの活用

1. **プロジェクト開始時**:
   ```bash
   kugutsu "タスク管理アプリケーションを構築する"
   ```

2. **Story Mapping自動生成**:
   - AIがペルソナ、エピック、ユーザーストーリーを生成
   - `.kugutsu/story-mapping.json` に保存

3. **Design Phase**:
   - TechLeadが全体設計、UI/UX、DB、API仕様を作成
   - `.kugutsu/design-docs.json` に保存

4. **タスク分解とスプリント計画**:
   - ストーリーからタスクを分解
   - 依存関係グラフを生成
   - `.kugutsu/dependency-graph.json` に保存

5. **Electron UIで進捗確認**:
   - StoryMappingViewerでストーリー確認
   - DependencyGraphViewerで依存関係とクリティカルパス確認
   - DesignDocsViewerで設計ドキュメント参照

## Tips

### カスタマイズ

サンプルデータをカスタマイズして、独自のプロジェクトに適用できます：

```bash
# サンプルをコピー
cp examples/scrum-workflow/*.json .kugutsu/

# 編集
vim .kugutsu/story-mapping.json
vim .kugutsu/design-docs.json
vim .kugutsu/dependency-graph.json
```

### バリデーション

データ構造が正しいか確認：

```bash
# JSONのバリデーション（※実装予定）
# kugutsu validate --story-mapping .kugutsu/story-mapping.json
# kugutsu validate --design-docs .kugutsu/design-docs.json
# kugutsu validate --dependency-graph .kugutsu/dependency-graph.json
```

## 参照

- [Story Mapping Guide](../../docs/story-mapping-guide.md)
- [Design-First Approach](../../docs/design-first-approach.md)
- [Dependency Graph](../../docs/dependency-graph.md)
