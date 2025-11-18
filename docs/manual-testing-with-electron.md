# Electronアプリでの手動テスト

このドキュメントでは、Electronアプリを使った手動テストの方法を説明します。

## テストリポジトリを使った起動

ダミーのNext.jsプロジェクトを自動作成し、そのプロジェクトを開いた状態でElectronアプリを起動します。

### 使用方法

```bash
npm run electron:test-repo
```

### 実行内容

1. **テストリポジトリの作成**
   - `test-electron-manual/` ディレクトリにNext.jsプロジェクトを作成
   - TypeScript, App Router, Tailwind CSS, ESLint を使用
   - create-next-appで自動生成

2. **Gitリポジトリの初期化**
   - `git init` でリポジトリを初期化
   - テストユーザー設定（test@example.com）
   - 初期コミットを作成（worktree操作に必要）

3. **Electronアプリの起動**
   - 作成したプロジェクトを自動的に開く
   - 以降は手動でElectron UIを操作

### テストシナリオ例

起動後、以下の機能を手動でテストできます：

#### 基本機能
- ✅ プロジェクトが正しく開かれているか
- ✅ Toolbarにプロジェクトパスが表示されているか
- ✅ .kugutsuディレクトリが作成されているか

#### タスク作成と実行
- ✅ タスクリクエストの入力
- ✅ Product Owner による要求分析
- ✅ タスク分解と依存関係の設定
- ✅ Kanbanボードでのタスク表示

#### 並列開発
- ✅ 複数エンジニアの同時実行
- ✅ Worktreeの作成と管理
- ✅ タスクステータスのリアルタイム更新

#### スプリント駆動開発
- ✅ ストーリーマッピングの作成
- ✅ スプリント計画
- ✅ スプリントバックログの管理
- ✅ スプリントレビュー

#### ログとモニタリング
- ✅ リアルタイムログ表示
- ✅ ノード実行状態の可視化
- ✅ 依存関係グラフの表示

### クリーンアップ

テスト終了後、手動でクリーンアップします：

```bash
# テストリポジトリを削除
rm -rf test-electron-manual
```

**注意**: リポジトリは自動削除されません。必要に応じて手動で削除してください。

---

## 既存プロジェクトでの起動

既存のGitリポジトリを開いてElectronアプリを起動する場合：

### コマンドライン引数で起動

```bash
# --project-pathオプションを使用（推奨）
npm run electron -- --project-path /path/to/your/project

# または、最後の引数として指定
npm run electron -- /path/to/your/project
```

### UIから選択

```bash
# アプリを起動
npm run electron

# Welcome Screenで "Open Project" をクリック
# または Toolbar の "Open Project" ボタンをクリック
```

---

## トラブルシューティング

### プロジェクトが開けない

**エラー**: "This directory is not a git repository"

**原因**: 選択したディレクトリに `.git` フォルダが存在しない

**解決方法**:
```bash
cd /path/to/your/project
git init
git add .
git commit -m "Initial commit"
```

### Worktree作成エラー

**エラー**: "Cannot create worktree in a worktree or submodule"

**原因**: Worktree内またはSubmodule内のディレクトリを開こうとしている

**解決方法**: 親リポジトリのルートディレクトリを開いてください

### Electronアプリが起動しない

**原因**: ビルドが必要な場合がある

**解決方法**:
```bash
# ビルドしてから起動
npm run electron:build
npm run electron
```

---

## 開発モードでの起動

開発中は、ホットリロード対応のdevモードを使用できます：

```bash
# 開発モード（ホットリロード有効）
npm run electron:dev

# 開発モードでプロジェクトパスを指定
npm run electron:dev -- --project-path /path/to/project
```

**注意**: `electron:dev` はelectron-viteのdevサーバーを使用します。

---

## よくある質問

### Q: テストリポジトリを保持したい

A: デフォルトで保持されます。手動で削除するまで `test-electron-manual/` に残ります。

### Q: 異なるフレームワークでテストしたい

A: `tests/manual/launch-electron-with-test-repo.ts` を編集して、create-next-appの代わりに別のコマンドを使用してください。

### Q: 複数のテストリポジトリを作成したい

A: `test-electron-manual-1/`, `test-electron-manual-2/` のように異なる名前で作成し、それぞれ個別に開いてください。

---

## 参考資料

- [Electron Main Process Documentation](../electron/main/index.ts)
- [E2E Realistic Verification](../tests/manual/e2e-realistic-verification.ts)
- [Parallel Development Workflow](./parallel-development-workflow.md)
