# Rete.js ビジュアルワークフローエディタ - 実装Todoリスト

## 概要

本ドキュメントは、Rete.jsビジュアルワークフローエディタの実装における詳細なタスクリストです。各フェーズのタスクをチェックボックス形式で管理します。

**総工数見積もり**: 7-9週間
**開始日**: 2025-11-26
**TDD原則**: すべてのタスクはテストファースト (Red → Green → Refactor)

---

## フェーズ1: 基盤構築（2週間）

### 1.1 環境セットアップ

- [ ] **Rete.js関連パッケージのインストール**
  - [ ] `rete`, `rete-react-plugin`, `rete-area-plugin`等をpackage.jsonに追加
  - [ ] `styled-components`のインストール
  - [ ] npm installの実行とビルド確認
  - [ ] TypeScript型定義の確認

- [ ] **開発環境の設定**
  - [ ] VSCodeのRete.js関連の型補完設定
  - [ ] ESLint/Prettierのルール調整（Rete.js対応）
  - [ ] electron-viteのビルド設定更新（Rete.js含む）

### 1.2 ノードアーキテクチャ設計

#### 1.2.1 BaseWorkflowNodeの実装

- [ ] **テスト作成（Red）**
  - [ ] `tests/workflow/nodes/BaseWorkflowNode.test.ts`作成
  - [ ] BaseWorkflowNodeのインターフェーステスト
  - [ ] validate()メソッドのテスト
  - [ ] execute()メソッドのモックテスト
  - [ ] toJSON()/fromJSON()のシリアライゼーションテスト
  - [ ] テスト実行して失敗を確認

- [ ] **実装（Green）**
  - [ ] `src/workflow/nodes/BaseWorkflowNode.ts`作成
  - [ ] NodeSocket, NodeConfig, ExecutionContext型定義
  - [ ] 抽象クラスBaseWorkflowNodeの実装
  - [ ] バリデーションロジック実装
  - [ ] シリアライゼーション実装
  - [ ] テスト実行してパスを確認

- [ ] **コミット**
  - [ ] テストをコミット
  - [ ] 実装をコミット

#### 1.2.2 制御フローノードの実装

- [ ] **StartNode / EndNode**
  - [ ] テスト作成（Red）
  - [ ] 実装（Green）
  - [ ] コミット

- [ ] **DecisionNode（条件分岐）**
  - [ ] テスト作成（Red）: 条件評価ロジックのテスト
  - [ ] 実装（Green）: 条件式の評価実装
  - [ ] コミット

- [ ] **DataTransformNode（データ変換）**
  - [ ] テスト作成（Red）
  - [ ] 実装（Green）
  - [ ] コミット

### 1.3 WorkflowTransformerの実装

#### 1.3.1 基本変換ロジック

- [ ] **テスト作成（Red）**
  - [ ] `tests/workflow/WorkflowTransformer.test.ts`作成
  - [ ] シンプルな3ノードワークフローの変換テスト
  - [ ] Start → Engineer → End の変換
  - [ ] 接続情報の変換テスト
  - [ ] テスト実行して失敗を確認

- [ ] **実装（Green）**
  - [ ] `src/workflow/WorkflowTransformer.ts`作成
  - [ ] transformToLangGraph()メソッド実装
  - [ ] ノード → LangGraphノードのマッピング
  - [ ] エッジ → addEdge()のマッピング
  - [ ] テスト実行してパスを確認

- [ ] **コミット**
  - [ ] テストをコミット
  - [ ] 実装をコミット

#### 1.3.2 条件分岐の変換

- [ ] **テスト作成（Red）**
  - [ ] DecisionNodeを含むワークフローの変換テスト
  - [ ] addConditionalEdges()の生成テスト
  - [ ] テスト実行して失敗を確認

- [ ] **実装（Green）**
  - [ ] 条件分岐の変換ロジック実装
  - [ ] 条件評価関数の生成
  - [ ] テスト実行してパスを確認

- [ ] **コミット**

### 1.4 Rete.jsエディタの基本セットアップ

#### 1.4.1 Reactコンポーネント作成

- [ ] **ディレクトリ構成**
  - [ ] `electron/renderer/components/ReteEditor/`作成
  - [ ] `ReteWorkflowEditor.tsx`作成
  - [ ] `CustomNodeComponent.tsx`作成
  - [ ] `NodePalette.tsx`作成
  - [ ] `PropertyPanel.tsx`作成

- [ ] **ReteWorkflowEditorコンポーネント**
  - [ ] テスト作成（Red）: エディタ初期化テスト
  - [ ] 実装（Green）: NodeEditor, AreaPluginのセットアップ
  - [ ] ReactPluginの統合
  - [ ] コミット

- [ ] **カスタムノードコンポーネント**
  - [ ] テスト作成（Red）: ノードレンダリングテスト
  - [ ] 実装（Green）: styled-componentsでノードUI実装
  - [ ] ノードタイプ別の色分け・アイコン実装
  - [ ] コミット

#### 1.4.2 既存ElectronUIへの統合

- [ ] **新規タブの追加**
  - [ ] `electron/renderer/App.tsx`にWorkflowEditorタブを追加
  - [ ] タブ切り替え機能の実装
  - [ ] Zustand storeにworkflowEditor状態追加

- [ ] **動作確認**
  - [ ] `npm run electron:dev`で起動
  - [ ] Workflow Editorタブの表示確認
  - [ ] ノードパレットの表示確認
  - [ ] キャンバスの操作確認（ズーム、パン）

### 1.5 基本的なワークフロー実行

#### 1.5.1 ReteWorkflowExecutor実装

- [ ] **テスト作成（Red）**
  - [ ] `tests/workflow/ReteWorkflowExecutor.test.ts`作成
  - [ ] シンプルなワークフロー実行テスト
  - [ ] ExecutionContextの生成テスト
  - [ ] テスト実行して失敗を確認

- [ ] **実装（Green）**
  - [ ] `src/workflow/ReteWorkflowExecutor.ts`作成
  - [ ] executeWorkflow()メソッド実装
  - [ ] WorkflowTransformer統合
  - [ ] LangGraph invokeの実装
  - [ ] テスト実行してパスを確認

- [ ] **コミット**

#### 1.5.2 E2Eテスト

- [ ] **シンプルワークフローのE2Eテスト**
  - [ ] Rete.jsでワークフロー作成 → JSON保存 → LangGraph実行
  - [ ] Start → Engineer → End の実行テスト
  - [ ] AIProvider（Mock）との統合テスト

- [ ] **動作確認とコミット**

---

## フェーズ2: 並列実行機能（2-3週間）

### 2.1 ParallelNode実装（単一ノード並列化）

#### 2.1.1 ParallelNodeの設計と実装

- [ ] **テスト作成（Red）**
  - [ ] `tests/workflow/nodes/ParallelNode.test.ts`作成
  - [ ] 単一ノードを3つ並列実行するテスト
  - [ ] 入力配列を分割して並列処理するテスト
  - [ ] テスト実行して失敗を確認

- [ ] **実装（Green）**
  - [ ] `src/workflow/nodes/ParallelNode.ts`作成
  - [ ] BaseWorkflowNodeを継承
  - [ ] execute()でSend APIを使った並列ディスパッチ実装
  - [ ] 入力配列の分割ロジック
  - [ ] テスト実行してパスを確認

- [ ] **コミット**

#### 2.1.2 GitWorktree統合

- [ ] **テスト作成（Red）**
  - [ ] 並列タスクごとにworktree作成のテスト
  - [ ] worktree内でのノード実行テスト
  - [ ] worktreeクリーンアップのテスト
  - [ ] テスト実行して失敗を確認

- [ ] **実装（Green）**
  - [ ] ParallelNodeでGitWorktreeManager呼び出し
  - [ ] 各並列タスクを独立したworktreeで実行
  - [ ] 実行後のクリーンアップ実装
  - [ ] テスト実行してパスを確認

- [ ] **コミット**

### 2.2 AggregatorNode実装（結果集約）

#### 2.2.1 AggregatorNodeの実装

- [ ] **テスト作成（Red）**
  - [ ] `tests/workflow/nodes/AggregatorNode.test.ts`作成
  - [ ] 複数の入力を待ち合わせるテスト
  - [ ] 結果を配列として集約するテスト
  - [ ] テスト実行して失敗を確認

- [ ] **実装（Green）**
  - [ ] `src/workflow/nodes/AggregatorNode.ts`作成
  - [ ] LangGraphのreducerを活用した集約ロジック
  - [ ] すべての入力が揃うまで待機
  - [ ] テスト実行してパスを確認

- [ ] **コミット**

#### 2.2.2 Parallel → Aggregator フロー統合テスト

- [ ] **E2Eテスト**
  - [ ] Parallel → Engineer(x3) → Aggregatorのワークフロー
  - [ ] 3つの並列タスクが正しく実行され、結果が集約されることを確認
  - [ ] worktreeが正しく作成・削除されることを確認

### 2.3 GroupNode実装（サブグラフ並列化）

#### 2.3.1 GroupNodeの設計

- [ ] **仕様確定**
  - [ ] GroupNodeConfigの詳細設計
  - [ ] サブグラフのJSON定義フォーマット
  - [ ] 並列実行の制御方法

#### 2.3.2 サブグラフの変換と実行

- [ ] **テスト作成（Red）**
  - [ ] `tests/workflow/nodes/GroupNode.test.ts`作成
  - [ ] サブグラフの変換テスト
  - [ ] サブグラフの並列実行テスト
  - [ ] 各サブグラフが独立したworktreeで実行されるテスト
  - [ ] テスト実行して失敗を確認

- [ ] **実装（Green）**
  - [ ] `src/workflow/nodes/GroupNode.ts`作成
  - [ ] サブグラフのLangGraph変換
  - [ ] executeSubgraph()メソッド実装
  - [ ] 並列サブグラフ実行ロジック
  - [ ] テスト実行してパスを確認

- [ ] **コミット**

#### 2.3.3 Rete.jsでのグループ化UI

- [ ] **グループ化機能の実装**
  - [ ] 複数ノード選択機能
  - [ ] 右クリックメニュー「Group for Parallel Execution」
  - [ ] GroupNodeの自動生成
  - [ ] グループの視覚的表示（枠線で囲む等）

- [ ] **動作確認**
  - [ ] UIでノードをグループ化
  - [ ] グループをparallel実行
  - [ ] 結果の確認

### 2.4 WorkflowTransformerの拡張

#### 2.4.1 並列ノードの変換

- [ ] **テスト作成（Red）**
  - [ ] ParallelNodeを含むワークフローの変換テスト
  - [ ] Send APIの生成テスト
  - [ ] GroupNodeを含むワークフローの変換テスト
  - [ ] テスト実行して失敗を確認

- [ ] **実装（Green）**
  - [ ] 並列ノードの変換ロジック追加
  - [ ] Send API生成ロジック
  - [ ] サブグラフの再帰的変換
  - [ ] テスト実行してパスを確認

- [ ] **コミット**

### 2.5 並列実行のE2Eテスト

- [ ] **複雑なワークフローテスト**
  - [ ] Start → Parallel(Engineer x3) → Aggregator → Review → End
  - [ ] Start → Group(Feature1, Feature2) → Aggregator → Merge → End
  - [ ] 実行時間の確認（並列化によって高速化されているか）
  - [ ] worktree管理の確認（リソースリークがないか）

- [ ] **パフォーマンステスト**
  - [ ] 10個の並列タスクを実行
  - [ ] メモリ使用量の監視（MemoryMonitor）
  - [ ] 並列実行数の制限（maxConcurrency）が正しく機能するか

---

## フェーズ3: ノードライブラリ（1-2週間）

### 3.1 AITaskNodeの実装

#### 3.1.1 基底AITaskNode

- [ ] **テスト作成（Red）**
  - [ ] `tests/workflow/nodes/AITaskNode.test.ts`作成
  - [ ] AIProvider呼び出しのテスト
  - [ ] プロンプト生成のテスト
  - [ ] テスト実行して失敗を確認

- [ ] **実装（Green）**
  - [ ] `src/workflow/nodes/AITaskNode.ts`作成
  - [ ] BaseWorkflowNodeを継承
  - [ ] AIProviderFactoryとの統合
  - [ ] query()メソッドの実装
  - [ ] テスト実行してパスを確認

- [ ] **コミット**

### 3.2 プリセットノードの実装

#### 3.2.1 EngineerNode

- [ ] **テスト作成（Red）**
  - [ ] `tests/workflow/nodes/preset/EngineerNode.test.ts`作成
  - [ ] コード実装タスクのテスト
  - [ ] worktree統合のテスト
  - [ ] テスト実行して失敗を確認

- [ ] **実装（Green）**
  - [ ] `src/workflow/nodes/preset/EngineerNode.ts`作成
  - [ ] AITaskNodeを継承
  - [ ] システムプロンプトの定義
  - [ ] allowedToolsの設定
  - [ ] テスト実行してパスを確認

- [ ] **コミット**

#### 3.2.2 ReviewerNode

- [ ] **テスト作成（Red）**
- [ ] **実装（Green）**
- [ ] **コミット**

#### 3.2.3 ProductOwnerNode

- [ ] **テスト作成（Red）**
- [ ] **実装（Green）**
- [ ] **コミット**

#### 3.2.4 その他のプリセットノード

- [ ] **MergeCoordinatorNode**
  - [ ] テスト、実装、コミット

- [ ] **ConflictResolverNode**
  - [ ] テスト、実装、コミット

- [ ] **TestRunnerNode**
  - [ ] テスト、実装、コミット

### 3.3 カスタムノード作成機能

#### 3.3.1 NodeFactory

- [ ] **テスト作成（Red）**
  - [ ] `tests/workflow/NodeFactory.test.ts`作成
  - [ ] ノードタイプからインスタンス生成のテスト
  - [ ] カスタムノード登録のテスト
  - [ ] テスト実行して失敗を確認

- [ ] **実装（Green）**
  - [ ] `src/workflow/NodeFactory.ts`作成
  - [ ] createNode()メソッド実装
  - [ ] ノードタイプのレジストリ
  - [ ] カスタムノード登録機能
  - [ ] テスト実行してパスを確認

- [ ] **コミット**

#### 3.3.2 カスタムノードUI

- [ ] **ノードテンプレート作成UI**
  - [ ] `CustomNodeCreator.tsx`コンポーネント作成
  - [ ] プロンプト入力フォーム
  - [ ] AIProvider選択
  - [ ] 入出力ソケット定義UI
  - [ ] プレビュー機能

- [ ] **ノードテンプレート保存**
  - [ ] `.kugutsu/node-templates/`への保存
  - [ ] JSON形式での保存
  - [ ] テンプレート一覧表示
  - [ ] テンプレート削除機能

### 3.4 プリセットワークフローの作成

#### 3.4.1 スクラムワークフローの移植

- [ ] **スクラムワークフローJSON作成**
  - [ ] 既存のスクラムワークフローをRete.js形式に変換
  - [ ] `.kugutsu/workflows/scrum-preset.json`に保存
  - [ ] UIからロード可能にする

#### 3.4.2 その他のプリセット

- [ ] **シンプル並列開発ワークフロー**
  - [ ] Start → Parallel(Engineer x3) → Aggregator → Review → Merge → End

- [ ] **スプリント開発ワークフロー**
  - [ ] Sprint Planning → Engineer → Review → Retrospective

---

## フェーズ4: UI/UX（1週間）

### 4.1 ノードパレット

- [ ] **カテゴリ別ノード一覧**
  - [ ] AI Taskカテゴリ
  - [ ] Control Flowカテゴリ
  - [ ] Git Operationsカテゴリ
  - [ ] Custom Nodesカテゴリ

- [ ] **検索機能**
  - [ ] ノード名での検索
  - [ ] フィルタリング

- [ ] **ドラッグ&ドロップ**
  - [ ] パレットからキャンバスへのドラッグ
  - [ ] ドロップ位置にノード配置

### 4.2 プロパティパネル

- [ ] **ノード設定UI**
  - [ ] 選択ノードのプロパティ表示
  - [ ] テキスト入力（プロンプト等）
  - [ ] ドロップダウン（AIProvider選択等）
  - [ ] チェックボックス（並列実行有効化等）
  - [ ] 数値入力（maxTurns等）

- [ ] **バリデーション**
  - [ ] 必須項目のチェック
  - [ ] 入力値の妥当性確認
  - [ ] エラー表示

### 4.3 実行コントロール

- [ ] **ツールバーボタン**
  - [ ] Run Workflowボタン
  - [ ] Stopボタン
  - [ ] Pauseボタン（オプション）
  - [ ] Saveボタン
  - [ ] Loadボタン

- [ ] **実行状態の表示**
  - [ ] 実行中ノードのハイライト
  - [ ] 完了ノードの色変更
  - [ ] エラーノードの表示

### 4.4 ワークフロー保存/読み込み

- [ ] **保存機能**
  - [ ] ワークフローJSONのエクスポート
  - [ ] ファイル選択ダイアログ
  - [ ] デフォルトパス: `.kugutsu/workflows/custom/`

- [ ] **読み込み機能**
  - [ ] ワークフローJSONのインポート
  - [ ] ファイル選択ダイアログ
  - [ ] プリセット一覧の表示

### 4.5 リアルタイム可視化

- [ ] **StateStreamManagerとの統合**
  - [ ] ノード実行状態の購読
  - [ ] リアルタイムUIアップデート
  - [ ] 進捗表示

- [ ] **ログビューアとの連携**
  - [ ] 実行ログの表示
  - [ ] ノードごとのログフィルタリング
  - [ ] エラーログのハイライト

### 4.6 UX改善

- [ ] **キーボードショートカット**
  - [ ] Ctrl+S: 保存
  - [ ] Ctrl+Z: Undo
  - [ ] Ctrl+Y: Redo
  - [ ] Delete: ノード削除

- [ ] **コンテキストメニュー**
  - [ ] ノード右クリックメニュー
  - [ ] グループ化
  - [ ] 複製
  - [ ] 削除

- [ ] **ズーム・パン**
  - [ ] マウスホイールでズーム
  - [ ] ドラッグでパン
  - [ ] ミニマップ（オプション）

---

## フェーズ5: テスト&ドキュメント（1週間）

### 5.1 テストの充実

#### 5.1.1 ユニットテストの網羅

- [ ] **カバレッジ確認**
  - [ ] `npm run test:coverage`実行
  - [ ] カバレッジ80%以上を目標
  - [ ] 未カバー箇所のテスト追加

- [ ] **エッジケーステスト**
  - [ ] 空ワークフローの処理
  - [ ] 循環参照の検出
  - [ ] 無効なノード設定のエラーハンドリング

#### 5.1.2 統合テスト

- [ ] **AIProvider統合テスト**
  - [ ] Claude、OpenAI、Geminiの各Providerでのテスト
  - [ ] フォールバック機能のテスト

- [ ] **GitWorktree統合テスト**
  - [ ] 並列worktree作成・削除のテスト
  - [ ] マージコンフリクトの処理テスト

#### 5.1.3 E2Eテスト

- [ ] **ワークフロー実行E2E**
  - [ ] シンプルワークフロー（Start → Engineer → End）
  - [ ] 並列ワークフロー（Parallel + Aggregator）
  - [ ] サブグラフ並列化（GroupNode）
  - [ ] スクラムワークフロー全体

- [ ] **UIテスト（Playwright等）**
  - [ ] ノード配置・接続のテスト
  - [ ] ワークフロー保存・読み込みのテスト
  - [ ] 実行ボタンのテスト

### 5.2 ドキュメント作成

#### 5.2.1 ユーザーガイド

- [ ] **docs/RETE_USER_GUIDE.md**
  - [ ] 基本的な使い方
  - [ ] ノードの配置と接続
  - [ ] プリセットワークフローの使用方法
  - [ ] カスタムノードの作成方法
  - [ ] ワークフローの保存・読み込み

#### 5.2.2 開発者ガイド

- [ ] **docs/RETE_DEVELOPER_GUIDE.md**
  - [ ] アーキテクチャ概要
  - [ ] カスタムノードの実装方法
  - [ ] WorkflowTransformerの拡張
  - [ ] 新しいAIProviderの追加

#### 5.2.3 API仕様書

- [ ] **docs/RETE_API_REFERENCE.md**
  - [ ] BaseWorkflowNode API
  - [ ] WorkflowTransformer API
  - [ ] NodeFactory API
  - [ ] ReteWorkflowExecutor API

### 5.3 パフォーマンス最適化

- [ ] **プロファイリング**
  - [ ] Node.js --inspect でプロファイリング
  - [ ] ボトルネックの特定

- [ ] **最適化実装**
  - [ ] 大規模グラフのレンダリング最適化
  - [ ] メモリリークの修正
  - [ ] worktreeクリーンアップの改善

### 5.4 セキュリティ監査

- [ ] **脆弱性チェック**
  - [ ] npm auditの実行
  - [ ] 依存関係の更新

- [ ] **セキュリティ対策の確認**
  - [ ] プロンプトインジェクション対策
  - [ ] ファイルアクセス制限の確認
  - [ ] API鍵の安全な管理

---

## その他のタスク

### マイグレーション

- [ ] **既存ワークフローの移植**
  - [ ] ParallelDevGraphの段階的廃止
  - [ ] 既存ノードの新アーキテクチャへの移行
  - [ ] データ移行スクリプトの作成

### CI/CD

- [ ] **テスト自動化**
  - [ ] GitHub Actionsでの自動テスト
  - [ ] PRごとのテスト実行

- [ ] **ビルド自動化**
  - [ ] Electronアプリのビルド自動化
  - [ ] 配布パッケージの作成

---

## 進捗管理

### 完了率

- [ ] フェーズ1: 0% (0/25タスク)
- [ ] フェーズ2: 0% (0/20タスク)
- [ ] フェーズ3: 0% (0/18タスク)
- [ ] フェーズ4: 0% (0/15タスク)
- [ ] フェーズ5: 0% (0/12タスク)

**総合進捗**: 0% (0/90タスク)

---

## 注意事項

### TDD原則の厳守

すべてのタスクは以下の順序で実施:

1. ✅ **テスト作成（Red）**: 失敗するテストを書く
2. ✅ **テスト実行**: テストが失敗することを確認
3. ✅ **実装（Green）**: テストをパスする最小限の実装
4. ✅ **テスト実行**: テストがパスすることを確認
5. ✅ **リファクタリング**: コードを改善（オプション）
6. ✅ **コミット**: テストと実装を個別にコミット

### コミットポリシー

- テストは実装とは別にコミット
- コミットメッセージは明確に（例: `test: Add BaseWorkflowNode tests`, `feat: Implement BaseWorkflowNode`）
- 自動git操作は行わない（ユーザーの明示的な指示のみ）

---

**このTodoリストは、Rete.jsビジュアルワークフローエディタの実装を段階的に追跡するための管理ドキュメントです。**
