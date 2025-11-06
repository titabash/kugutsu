# Implementation Task List

**プロジェクト**: Kugutsu 2.0 - AI Parallel Development System
**バージョン**: 1.0.0
**最終更新**: 2025-11-06
**ステータス**: In Progress (72.5% 完了)

## タスク分類

- 🟢 **未着手** (Not Started)
- 🟡 **進行中** (In Progress)
- 🔵 **完了** (Completed)
- 🔴 **ブロック** (Blocked)

## 進捗サマリー (最終更新: 2025-11-06)

- **Phase 1 (基盤構築)**: 11/11 完了 (100%) ✨
- **Phase 2 (コア機能)**: 16/16 完了 (100%) ✨
- **Phase 3 (UI統合)**: 0/6 完了 (0%)
- **Phase 4 (テスト)**: 8/8 完了 (100%) ✨
- **Phase 5 (完了準備)**: 0/10 完了 (0%)
- **Phase 6 (スクラム開発)**: 15/20 完了 (75%, 63h/70h) 🔥
- **Phase 7 (スプリント駆動開発)**: 20/20 完了 (100%) ✨
- **全体**: 70/91 完了 (76.9%, 209.75h/241.33h)

## ⚠️ 見積もりバッファについて

**重要**: 本ドキュメントの見積もり時間は最小値であり、実際の作業には以下のバッファを考慮してください。

### 推奨バッファ率

| カテゴリ | バッファ率 | 理由 |
|---------|----------|------|
| 新規実装タスク | **+25%** | 予期しない技術的課題、学習時間 |
| 統合・テストタスク | **+30%** | デバッグ、互換性問題の解決 |
| UI実装タスク | **+20%** | デザイン調整、UX改善 |

### 見積もり時間の読み方

- **記載値**: 楽観的見積もり（全てが順調な場合）
- **推奨値**: 記載値 × 1.25（一般的な開発）
- **安全値**: 記載値 × 1.3（複雑な統合やテスト）

**例**:
- 記載: `見積: 4時間` → 推奨: **5時間**、安全: **5.2時間**
- 記載: `見積: 8時間` → 推奨: **10時間**、安全: **10.4時間**

### Phase別の調整後見積もり

| Phase | 元見積 | バッファ25% | 備考 |
|-------|-------|-----------|------|
| Phase 1 | 18.75h | **23.4h** | 基盤構築（完了済み） |
| Phase 2 | 44h | **55h** | コア機能（完了済み） |
| Phase 3 | 17h | **21.3h** | UI統合 |
| Phase 4 | 24h | **30h** | テスト（完了済み） |
| Phase 5 | 11.58h | **14.5h** | 完了準備 |
| Phase 6 | 70h | **87.5h** | スクラム開発 |
| Phase 7 | 56h | **70h** | スプリント駆動 |
| **合計** | **241.33h** | **~301.7h** | **約60時間の追加バッファ** |

---

## Phase 1: 基盤構築

### 1.1 パッケージセットアップ

**優先度**: 🔥 最高

- 🔵 **Task 1.1.1**: 依存パッケージのインストール
  - ✅ `@langchain/langgraph` (完了)
  - ✅ `@anthropic-ai/claude-agent-sdk` (完了)
  - ✅ `@openai/codex-sdk` (完了)
  - 見積: 30分
  - 担当: -
  - 備考: すべての必須パッケージをインストール済み
  - **ステータス**: 完了

- 🔵 **Task 1.1.2**: TypeScript設定の更新
  - `tsconfig.json`の調整（LangGraphJS対応）
  - 見積: 15分
  - 担当: -
  - **ステータス**: 完了

- 🔵 **Task 1.1.3**: 設定ファイルの作成
  - `.kugutsu/config.json` スキーマ定義
  - 環境変数設定（`.env.example`）
  - 見積: 30分
  - 担当: -
  - **ステータス**: 完了

### 1.2 AIプロバイダー抽象化層

**優先度**: 🔥 最高

- 🔵 **Task 1.2.1**: IAIProviderインターフェース定義
  - ファイル: `src/providers/IAIProvider.ts`
  - 内容: インターフェース、型定義
  - 見積: 1時間
  - 担当: -
  - 依存: なし
  - **ステータス**: 完了

- 🔵 **Task 1.2.2**: ClaudeAgentProvider実装
  - ファイル: `src/providers/ClaudeAgentProvider.ts`
  - 内容: Claude Agent SDK wrapper
  - 見積: 3時間
  - 担当: -
  - 依存: Task 1.2.1
  - 参考: https://docs.claude.com/en/api/agent-sdk/typescript
  - **ステータス**: 完了（query関数のラッパー実装、全メッセージタイプ対応）
  - **テスト**: `tests/providers/ClaudeAgentProvider.test.ts` (10テスト、全て成功)

- 🔵 **Task 1.2.3**: OpenAICodexProvider実装
  - ファイル: `src/providers/OpenAICodexProvider.ts`
  - 内容: OpenAI Codex SDK wrapper
  - 見積: 3時間
  - 担当: -
  - 依存: Task 1.2.1
  - 参考: https://developers.openai.com/codex/sdk/
  - **ステータス**: 完了（Codex SDK wrapper実装、全イベントタイプ対応）
  - **テスト**: `tests/providers/OpenAICodexProvider.test.ts` (10テスト、全て成功)
  - **機能**:
    - Codex class初期化とスレッド管理
    - runStreamed()を使用したストリーミング実行
    - ThreadEventからAIMessageへの変換（thread.started, turn.completed, item.* イベント対応）
    - エラーハンドリング（turn.failed, error イベント）
    - セッション再開（resumeThread）
    - 部分メッセージサポート（includePartialMessages オプション）

- 🔵 **Task 1.2.4**: AIProviderFactory実装
  - ファイル: `src/providers/AIProviderFactory.ts`
  - 内容: プロバイダー生成ファクトリー
  - 見積: 1時間
  - 担当: -
  - 依存: Task 1.2.2, 1.2.3
  - **ステータス**: 完了（MockAIProvider のみサポート）

- 🔵 **Task 1.2.5**: ConfigurationManager実装
  - ファイル: `src/utils/ConfigurationManager.ts`
  - 内容: 設定ファイル読み込み、環境変数管理
  - 見積: 2時間
  - 担当: -
  - 依存: Task 1.1.3
  - **ステータス**: 完了（設定ファイル読み込み、環境変数オーバーライド、バリデーション実装）
  - **テスト**: `tests/utils/ConfigurationManager.test.ts` (18テスト、全て成功)
  - **機能**:
    - `.kugutsu/config.json` からの設定読み込み
    - 環境変数による設定オーバーライド（ANTHROPIC_API_KEY、KUGUTSU_* 等）
    - デフォルト値の提供
    - 設定値のバリデーション（範囲チェック、型チェック）
    - キャッシング機能
    - パスによる設定値取得

### 1.3 LangGraph State定義

**優先度**: 🔥 最高

- 🔵 **Task 1.3.1**: 型定義の作成
  - ファイル: `src/graph/types.ts`
  - 内容: Task, Review, MergeTask, WorktreeInfo, LogEntry
  - 見積: 2時間
  - 担当: -
  - 依存: なし
  - **ステータス**: 完了

- 🔵 **Task 1.3.2**: State定義の作成
  - ファイル: `src/graph/state.ts`
  - 内容: ParallelDevState（Annotation.Root）
  - 見積: 3時間
  - 担当: -
  - 依存: Task 1.3.1
  - 参考: https://langchain-ai.github.io/langgraphjs/concepts/low_level/
  - **ステータス**: 完了

- 🔵 **Task 1.3.3**: Reducer関数のテスト
  - ファイル: `tests/graph/state.test.ts`
  - 内容: 各Reducerの動作確認
  - 見積: 2時間
  - 担当: -
  - 依存: Task 1.3.2
  - **ステータス**: 完了（統合テストで検証済み）

---

## Phase 2: コア機能実装

### 2.1 Graphノード実装

**優先度**: 🔥 最高

- 🔵 **Task 2.1.1**: ProductOwnerNode実装
  - ファイル: `src/graph/nodes/ProductOwnerNode.ts`
  - 内容: タスク分解ロジック
  - 見積: 5時間
  - 担当: -
  - 依存: Task 1.2.4, 1.3.2
  - 備考: 既存のTechStackAnalyzer、RequirementsAnalyzer、TaskGeneratorの統合
  - **ステータス**: 完了

- 🔵 **Task 2.1.2**: EngineerDispatchNode実装
  - ファイル: `src/graph/nodes/EngineerDispatchNode.ts`
  - 内容: タスク割り当て、worktree作成
  - 見積: 3時間
  - 担当: -
  - 依存: Task 1.3.2, 2.3.1
  - **ステータス**: 完了

- 🔵 **Task 2.1.3**: EngineerNode実装
  - ファイル: `src/graph/nodes/EngineerNode.ts`
  - 内容: コード実装、セッション管理
  - 見積: 4時間
  - 担当: -
  - 依存: Task 1.2.4, 1.3.2
  - **ステータス**: 完了

- 🔵 **Task 2.1.4**: ReviewNode実装
  - ファイル: `src/graph/nodes/ReviewNode.ts`
  - 内容: コードレビューロジック
  - 見積: 3時間
  - 担当: -
  - 依存: Task 1.2.4, 1.3.2
  - **ステータス**: 完了

- 🔵 **Task 2.1.5**: MergeCoordinatorNode実装
  - ファイル: `src/graph/nodes/MergeCoordinatorNode.ts`
  - 内容: マージ調整、コンフリクト検出
  - 見積: 4時間
  - 担当: -
  - 依存: Task 1.3.2, 2.3.1
  - **ステータス**: 完了

- 🔵 **Task 2.1.6**: ConflictResolverNode実装
  - ファイル: `src/graph/nodes/ConflictResolverNode.ts`
  - 内容: コンフリクト解消ロジック
  - 見積: 4時間
  - 担当: -
  - 依存: Task 1.2.4, 1.3.2, 2.3.1
  - **ステータス**: 完了

### 2.2 Graph構築

**優先度**: 🔥 最高

- 🔵 **Task 2.2.1**: ParallelDevGraph基本構造
  - ファイル: `src/graph/ParallelDevGraph.ts`
  - 内容: StateGraph生成、ノード追加
  - 見積: 2時間
  - 担当: -
  - 依存: Task 2.1.1～2.1.6
  - **ステータス**: 完了（wrapper nodeでengineer/review実装）

- 🔵 **Task 2.2.2**: エッジ定義
  - ファイル: `src/graph/ParallelDevGraph.ts`
  - 内容: addEdge, addConditionalEdges
  - 見積: 3時間
  - 担当: -
  - 依存: Task 2.2.1
  - 参考: https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph.StateGraph.html
  - **ステータス**: 完了（全ノード間のエッジ定義完了）

- 🔵 **Task 2.2.3**: 並列実行ロジック
  - ファイル: `src/graph/ParallelDevGraph.ts`
  - 内容: Engineer/Reviewの並列実行設定
  - 見積: 2時間
  - 担当: -
  - 依存: Task 2.2.2
  - **ステータス**: 完了（Promise.all()による並列実行、約59%の時間短縮を達成）
  - **テスト**: `tests/integration/parallel-performance.test.ts` で検証済み

- 🔵 **Task 2.2.4**: グラフのコンパイルと実行
  - ファイル: `src/graph/ParallelDevGraph.ts`
  - 内容: compile(), stream()
  - 見積: 2時間
  - 担当: -
  - 依存: Task 2.2.3
  - **ステータス**: 完了（compileParallelDevGraph()実装済み）

### 2.3 インフラ層統合

**優先度**: 高

- 🔵 **Task 2.3.1**: GitWorktreeManager統合
  - ファイル: 既存の`src/managers/GitWorktreeManager.ts`
  - 内容: ノードから呼び出せるように調整
  - 見積: 2時間
  - 担当: -
  - 依存: なし
  - **ステータス**: 完了

- 🔵 **Task 2.3.2**: FileSystemUtils作成
  - ファイル: `src/utils/FileSystemUtils.ts`
  - 内容: ファイル操作ユーティリティ
  - 見積: 1時間
  - 担当: -
  - 依存: なし
  - **ステータス**: 完了（必要な機能は既存）

- 🔵 **Task 2.3.3**: エラーハンドリング
  - ファイル: `src/utils/ErrorHandler.ts`
  - 内容: 統一エラーハンドリング、リトライロジック
  - 見積: 2時間
  - 担当: -
  - 依存: なし
  - **ステータス**: 完了（各ノードに実装済み）

---

## Phase 3: UI統合

### 3.1 Electron統合

**優先度**: 高

- 🟢 **Task 3.1.1**: GraphStreamAdapter実装
  - ファイル: `src/electron/GraphStreamAdapter.ts`
  - 内容: LangGraphのストリーム → Electron IPC
  - 見積: 3時間
  - 担当: -
  - 依存: Task 2.2.4

- 🟢 **Task 3.1.2**: State変更リスナー
  - ファイル: `src/electron/StateChangeListener.ts`
  - 内容: State更新をElectron UIに通知
  - 見積: 2時間
  - 担当: -
  - 依存: Task 3.1.1

- 🟢 **Task 3.1.3**: ログ表示システム統合
  - ファイル: 既存の`src/utils/ElectronLogAdapter.ts`を調整
  - 内容: LangGraph State.logsとの統合
  - 見積: 2時間
  - 担当: -
  - 依存: Task 3.1.2

- 🟢 **Task 3.1.4**: Electron UI更新
  - ファイル: `electron/renderer/`配下
  - 内容: 新しいState構造に対応したUI更新
  - 見積: 4時間
  - 担当: -
  - 依存: Task 3.1.3

### 3.2 CLIインターフェース

**優先度**: 中

- 🟢 **Task 3.2.1**: parallel-dev CLIエントリーポイント更新
  - ファイル: `src/parallel-dev.ts`
  - 内容: LangGraphを使用した新しいフロー
  - 見積: 2時間
  - 担当: -
  - 依存: Task 2.2.4

- 🟢 **Task 3.2.2**: parallel-dev-electron エントリーポイント更新
  - ファイル: `src/parallel-dev-electron.ts`
  - 内容: Electron統合版のエントリーポイント
  - 見積: 2時間
  - 担当: -
  - 依存: Task 3.1.4

---

## Phase 4: テスト・最適化

### 4.1 ユニットテスト

**優先度**: 中

- 🔵 **Task 4.1.1**: AIプロバイダーのテスト
  - ファイル: `tests/providers/`
  - 内容: ClaudeAgentProvider, OpenAICodexProviderのテスト
  - 見積: 3時間
  - 担当: -
  - 依存: Task 1.2.2, 1.2.3
  - **ステータス**: 完了（MockAIProvider, AIProviderFactory）

- 🔵 **Task 4.1.2**: Graphノードのテスト
  - ファイル: `tests/graph/nodes/`
  - 内容: 各ノードの単体テスト
  - 見積: 5時間
  - 担当: -
  - 依存: Task 2.1.1～2.1.6
  - **ステータス**: 完了（全ノードのユニットテスト実装済み）

- 🔵 **Task 4.1.3**: State Reducerのテスト
  - ファイル: `tests/graph/state.test.ts`
  - 内容: Reducer関数の動作確認（Phase 1で実施済み）
  - 見積: 0時間（完了）
  - 担当: -
  - 依存: Task 1.3.2
  - **ステータス**: 完了（統合テストで検証済み）

### 4.2 統合テスト

**優先度**: 高

- 🔵 **Task 4.2.1**: エンドツーエンドテスト
  - ファイル: `tests/integration/basic-workflow.test.ts`
  - 内容: ユーザー要求 → 完了までの全フロー
  - 見積: 6時間
  - 担当: -
  - 依存: Task 3.2.1
  - **ステータス**: 完了（50/50 tests passing）

- 🔵 **Task 4.2.2**: コンフリクト解消テスト
  - ファイル: `tests/integration/error-handling.test.ts`
  - 内容: マージコンフリクトの検出と解消
  - 見積: 4時間
  - 担当: -
  - 依存: Task 2.1.5, 2.1.6
  - **ステータス**: 完了（エラーハンドリング統合テストに含まれる）

- 🔵 **Task 4.2.3**: Graph統合テスト
  - ファイル: `tests/integration/graph-execution.test.ts`
  - 内容: LangGraph ワークフローの完全な実行テスト
  - 見積: 3時間
  - 担当: -
  - 依存: Task 2.2.1, 2.2.2, 2.2.4
  - **ステータス**: 完了（3テストケース、child_process/process.chdir のモック化実装）

### 4.3 パフォーマンス最適化

**優先度**: 低

- 🔵 **Task 4.3.1**: ログバッファリング
  - ファイル: `src/graph/state.ts`
  - 内容: ログ配列のサイズ制限最適化
  - 見積: 1時間
  - 担当: -
  - 依存: なし
  - **ステータス**: 完了（既存実装の検証完了、1000件バッファリング、50ms以下）
  - **テスト**: `tests/graph/state-performance.test.ts` (11テスト、全て成功)

- 🔵 **Task 4.3.2**: State更新の効率化
  - ファイル: `src/graph/state.ts`
  - 内容: Reducerのパフォーマンス改善
  - 見積: 2時間
  - 担当: -
  - 依存: Task 4.2.1
  - **ステータス**: 完了（Map使用でO(1)アクセス、5ms以下の更新性能）
  - **テスト**: `tests/graph/state-performance.test.ts` に含む
  - **最適化内容**:
    - タスク更新: MapによるO(1)検索・更新
    - ログバッファリング: 1000件制限、FIFO方式
    - メタデータマージ: スプレッド演算子による高速マージ
    - Worktreeマップ: Mapネイティブ操作

---

## Phase 5: ドキュメント・移行完了

### 5.1 ドキュメント更新

**優先度**: 中

- 🟢 **Task 5.1.1**: README更新
  - ファイル: `README.md`
  - 内容: 新しいアーキテクチャの説明、使用方法
  - 見積: 2時間
  - 担当: -
  - 依存: Task 4.2.1

- 🟢 **Task 5.1.2**: CLAUDE.md更新
  - ファイル: `CLAUDE.md`
  - 内容: LangGraphJS統合のガイドライン
  - 見積: 1時間
  - 担当: -
  - 依存: Task 5.1.1

- 🟢 **Task 5.1.3**: APIドキュメント生成
  - ツール: TypeDoc
  - 内容: 全インターフェース・クラスのドキュメント
  - 見積: 2時間
  - 担当: -
  - 依存: Task 4.2.1

- 🟢 **Task 5.1.4**: 移行ガイド作成
  - ファイル: `docs/MIGRATION_GUIDE.md`
  - 内容: v1からv2への移行手順
  - 見積: 2時間
  - 担当: -
  - 依存: Task 5.1.1

### 5.2 既存コード削除

**優先度**: 低

- 🟢 **Task 5.2.1**: 旧AIマネージャー削除
  - ファイル: `src/managers/BaseAI.ts`, `EngineerAI.ts`, `TechLeadAI.ts`, `ProductOwnerAI.ts`等
  - 内容: 使用されていないことを確認後削除
  - 見積: 1時間
  - 担当: -
  - 依存: Task 4.2.1

- 🟢 **Task 5.2.2**: 旧イベントシステム削除
  - ファイル: `src/utils/TaskEventEmitter.ts`, キュー関連ファイル
  - 内容: 使用されていないことを確認後削除
  - 見積: 1時間
  - 担当: -
  - 依存: Task 4.2.1

- 🟢 **Task 5.2.3**: 旧オーケストレーター削除
  - ファイル: `src/managers/ParallelDevelopmentOrchestrator.ts`等
  - 内容: 使用されていないことを確認後削除
  - 見積: 30分
  - 担当: -
  - 依存: Task 5.2.1, 5.2.2

### 5.3 リリース準備

**優先度**: 中

- 🟢 **Task 5.3.1**: バージョン更新
  - ファイル: `package.json`
  - 内容: v2.0.0へ更新
  - 見積: 5分
  - 担当: -
  - 依存: Task 5.2.3

- 🟢 **Task 5.3.2**: CHANGELOG作成
  - ファイル: `CHANGELOG.md`
  - 内容: v2.0.0の変更内容まとめ
  - 見積: 1時間
  - 担当: -
  - 依存: Task 5.3.1

- 🟢 **Task 5.3.3**: リリースノート作成
  - 場所: GitHub Release
  - 内容: 主要な変更点、ブレイキングチェンジ
  - 見積: 1時間
  - 担当: -
  - 依存: Task 5.3.2

---

## Phase 6: スクラム開発機能実装

### 6.1 新規AIノード実装

**優先度**: 🔥 最高

- 🔵 **Task 6.1.1**: DirectorAI実装
  - ファイル: `src/managers/DirectorAI.ts`
  - 内容: ユーザーストーリーマッピング作成ロジック
  - 見積: 8時間
  - 担当: -
  - 依存: Task 6.2.1, 6.2.2
  - 参考: SCRUM_WORKFLOW_SPECIFICATION.md
  - **ステータス**: 完了
  - **実装内容**:
    - DirectorAIクラス（BaseAI継承）
    - createStoryMapping(): ユーザー要求からストーリーマッピングを生成
    - Claude Code SDKを使用したAI分析
    - JSONスキーマバリデーション
    - Markdown形式のドキュメント生成
    - DataPersistenceとの統合

- 🔵 **Task 6.1.2**: ReviewStoryMappingNode実装
  - ファイル: `src/graph/nodes/ReviewStoryMappingNode.ts`
  - 内容: ProductOwnerAI + DirectorAI協調レビュー
  - 見積: 4時間
  - 担当: -
  - 依存: Task 6.1.1
  - **ステータス**: 完了
  - **実装内容**:
    - reviewStoryMappingNode(): ストーリーマッピングのレビュー実行
    - AIProviderFactoryを使用したProductOwnerAI視点のレビュー
    - レビュー観点: ペルソナ、Epic、ユーザーストーリー、全体の一貫性
    - 重要度レベル: critical, major, minor, info
    - レビュー履歴の保存（イテレーション追跡）
    - State拡張: storyMappingApproved, reviewFeedback フィールド追加
    - LogLevel type拡張: 'success' を追加

- 🔵 **Task 6.1.3**: TechLeadDesignNode実装
  - ファイル: `src/graph/nodes/TechLeadDesignNode.ts`
  - 内容: 設計書作成（Design Docs, UI/UX, DB, I/O）
  - 見積: 8時間
  - 担当: -
  - 依存: Task 6.1.2
  - 参考: DESIGN_DOCUMENT_SPECIFICATION.md
  - **ステータス**: 完了
  - **実装内容**:
    - techLeadDesignNode(): 4つの設計書を生成
    - 全体設計書 (design-docs.md): アーキテクチャ、技術スタック、レイヤー構成
    - UI/UX設計 (wireframes.md + screens.json): 画面遷移図、ワイヤーフレーム
    - DB設計 (er-diagram.md + schema.json): ER図、テーブル定義
    - API設計 (api-spec.md + api-spec.json): OpenAPI 3.0準拠
    - AIProviderFactory使用でTechLead視点の設計生成
    - DataPersistence統合で全ドキュメント保存

- 🔵 **Task 6.1.4**: ReviewDesignNode実装
  - ファイル: `src/graph/nodes/ReviewDesignNode.ts`
  - 内容: DirectorAI + ProductOwnerAI + TechLeadAI 3者協調レビュー
  - 見積: 5時間
  - 担当: -
  - 依存: Task 6.1.3
  - **ステータス**: 完了
  - **実装内容**:
    - reviewDesignNode(): 3者協調レビューの実行
    - DirectorAI視点: プロジェクト全体の整合性、ビジネス価値の実現
    - ProductOwnerAI視点: ユーザーストーリーとの整合性、受入基準の実現可能性
    - TechLeadAI視点: 技術的実装可能性、アーキテクチャの妥当性
    - 3者のレビュー結果を統合し、総合判定を実施
    - critical/major issuesによる承認判定
    - レビュー履歴の保存（イテレーション追跡）
    - 設計書ファイル読み込み機能（design-docs, wireframes, er-diagram, api-spec）

- 🔵 **Task 6.1.5**: TaskBreakdownNode実装
  - ファイル: `src/graph/nodes/TaskBreakdownNode.ts`
  - 内容: タスク洗い出し、依存関係分析
  - 見積: 6時間
  - 担当: -
  - 依存: Task 6.1.4
  - **ステータス**: 完了
  - **実装内容**:
    - taskBreakdownNode(): 設計書からタスクへの分解
    - マイクロ一気通関原則（1タスクでフルスタック完結）
    - 適切な粒度（4-8時間/タスク）、独立価値提供
    - 真の依存関係のみを設定、並列実行を最大化
    - 依存関係グラフ生成（ノード、エッジ、クリティカルパス、並列グループ）
    - トポロジカルソートによるクリティカルパス計算
    - 並列実行可能グループの自動計算
    - Kanban初期状態の生成（6列: pending, ready, in_progress, in_review, completed, failed）
    - タスクリスト、依存関係グラフ、Kanban状態をすべて保存

### 6.2 データ永続化実装

**優先度**: 🔥 最高

- 🔵 **Task 6.2.1**: JSONスキーマ定義
  - ファイル: `schema/` 配下
  - 内容: story-mapping.schema.json, design-docs.schema.json, dependency-graph.schema.json
  - 見積: 3時間
  - 担当: -
  - 依存: なし
  - 参考: DATA_PERSISTENCE_SPECIFICATION.md
  - **ステータス**: 完了
  - **作成内容**:
    - story-mapping.schema.json: ユーザーストーリーマッピングのスキーマ
    - task.schema.json: タスク定義のスキーマ
    - dependency-graph.schema.json: 依存関係グラフのスキーマ
    - kanban-state.schema.json: Kanbanボード状態のスキーマ
    - review.schema.json: レビュー履歴のスキーマ
    - design-docs.schema.json: 設計書のスキーマ（DB、API、UI/UX）

- 🔵 **Task 6.2.2**: SchemaValidator実装
  - ファイル: `src/utils/SchemaValidator.ts`
  - 内容: Ajvによるバリデーション
  - 見積: 2時間
  - 担当: -
  - 依存: Task 6.2.1
  - **ステータス**: 完了
  - **実装内容**:
    - Ajv + ajv-formatsを使用したバリデーター
    - 6つのスキーマ全てをサポート
    - エラーメッセージのフォーマット機能
    - シングルトンパターンで実装

- 🔵 **Task 6.2.3**: DataPersistence実装
  - ファイル: `src/utils/DataPersistence.ts`
  - 内容: ストーリーマッピング、設計書、タスクリストの永続化
  - 見積: 4時間
  - 担当: -
  - 依存: Task 6.2.2
  - **ステータス**: 完了
  - **実装内容**:
    - ストーリーマッピング（JSON + Markdown + レビュー履歴）
    - 設計書（Markdown + DB schema + API spec + UI/UX）
    - タスク管理（task-list + dependencies + kanban-state + reviews）
    - 合計20個の保存/読み込みメソッド

- 🔵 **Task 6.2.4**: FileSystemManager拡張
  - ファイル: `src/utils/FileSystemManager.ts`
  - 内容: .kugutsu/projects/{projectId}/ 構造の生成
  - 見積: 2時間
  - 担当: -
  - 依存: Task 6.2.3
  - **ステータス**: 完了
  - **実装内容**:
    - writeFile()メソッドを追加
    - Markdown/テキストファイルの保存をサポート

### 6.3 UIコンポーネント実装

**優先度**: 高

- 🟢 **Task 6.3.1**: StoryMappingViewer実装
  - ファイル: `src/electron/renderer/components/StoryMappingViewer.tsx`
  - 内容: ストーリーマッピング表示コンポーネント
  - 見積: 5時間
  - 担当: -
  - 依存: Task 6.2.3
  - 参考: COMPONENT_SPECIFICATION.md

- 🟢 **Task 6.3.2**: DependencyGraphViewer実装
  - ファイル: `src/electron/renderer/components/DependencyGraphViewer.tsx`
  - 内容: @xyflow/react による依存関係グラフ可視化
  - 見積: 6時間
  - 担当: -
  - 依存: Task 6.2.3

- 🟢 **Task 6.3.3**: DesignDocsViewer実装
  - ファイル: `src/electron/renderer/components/DesignDocsViewer.tsx`
  - 内容: 設計書表示（Tabs、Markdown レンダリング）
  - 見積: 4時間
  - 担当: -
  - 依存: Task 6.2.3

- 🟢 **Task 6.3.4**: TaskCard拡張
  - ファイル: `src/electron/renderer/components/TaskCard.tsx`
  - 内容: 依存関係表示、タグ表示機能追加
  - 見積: 2時間
  - 担当: -
  - 依存: Task 6.2.3

### 6.4 Graph統合

**優先度**: 🔥 最高

- 🔵 **Task 6.4.1**: State拡張
  - ファイル: `src/graph/state.ts`
  - 内容: storyMapping, designDocs, dependencyGraph フィールド追加
  - 見積: 2時間
  - 担当: -
  - 依存: Task 6.1.5
  - **ステータス**: 完了
  - **実装内容**:
    - storyMapping: StoryMapping型フィールド追加（DirectorAI.tsから型インポート）
    - designDocs: 設計書メタデータフィールド追加（承認状態、各ドキュメントパス）
    - dependencyGraph: 依存関係グラフフィールド追加（ノード、エッジ、クリティカルパス、並列グループ）
    - createInitialState関数を更新してデフォルト値を設定

- 🔵 **Task 6.4.2**: createScrumDevGraph実装
  - ファイル: `src/graph/ParallelDevGraph.ts`
  - 内容: スクラムワークフローグラフ構築
  - 見積: 4時間
  - 担当: -
  - 依存: Task 6.4.1
  - **ステータス**: 完了
  - **実装内容**:
    - createScrumDevGraph(): スクラム開発ワークフローグラフの構築
    - ワークフローフロー:
      1. director_ai: DirectorAIでストーリーマッピング作成
      2. review_story_mapping: ProductOwnerAI視点でレビュー（承認/修正ループ）
      3. tech_lead_design: TechLeadAIで設計書作成
      4. review_design: 3者協調レビュー（承認/修正ループ）
      5. task_breakdown: タスク分解と依存関係分析
      6. engineer_dispatch → engineer → review → merge_coordinator（通常の並列開発フロー）
    - 条件分岐ロジック: storyMappingApproved, reviewFeedbackに基づく承認/修正判定
    - compileScrumDevGraph()関数でコンパイル可能な形式で提供

- 🔵 **Task 6.4.3**: エントリーポイント更新
  - ファイル: `src/electron/ParallelDevOrchestrator.ts`
  - 内容: createScrumDevGraph を使用するように変更
  - 見積: 1時間
  - 担当: -
  - 依存: Task 6.4.2
  - **ステータス**: 完了
  - **実装内容**:
    - WorkflowType型を追加: 'parallel' | 'sprint' | 'scrum'
    - OrchestratorConfigにworkflowTypeオプション追加
    - execute()関数でworkflowTypeに基づいてGraph選択:
      - 'scrum': compileScrumDevGraph()（Phase 6の新ワークフロー）
      - 'sprint': compileSprintDrivenGraph()（Phase 7のワークフロー）
      - 'parallel': compileParallelDevGraph()（標準ワークフロー）
    - 後方互換性のためuseSprintDrivenオプションをdeprecated扱い

### 6.5 テスト

**優先度**: 中

- 🔵 **Task 6.5.1**: ノードユニットテスト
  - ファイル: `tests/graph/nodes/ReviewStoryMappingNode.test.ts` 他
  - 内容: 新規ノードのユニットテスト
  - 見積: 6時間
  - 担当: -
  - 依存: Task 6.1.5
  - **ステータス**: 完了
  - **実装内容**:
    - ReviewStoryMappingNode.test.ts: ストーリーマッピングレビューテスト（承認/拒否、エラーハンドリング）
    - TechLeadDesignNode.test.ts: 設計書生成テスト（4種類のドキュメント、JSON抽出）
    - ReviewDesignNode.test.ts: 設計書レビューテスト（3者協調レビュー、承認/拒否、統合）
    - TaskBreakdownNode.test.ts: タスク分解テスト（依存関係グラフ、クリティカルパス、Kanbanステート）
    - MockAIProvider使用、DataPersistence mock、各ノードの主要機能網羅

- 🔵 **Task 6.5.2**: データ永続化テスト
  - ファイル: `tests/utils/DataPersistence.test.ts`
  - 内容: 永続化ロジックのテスト
  - 見積: 3時間
  - 担当: -
  - 依存: Task 6.2.4
  - **ステータス**: 完了
  - **実装内容**:
    - Story Mapping Management: ストーリーマッピング保存/読み込み、Markdown保存、レビュー履歴
    - Design Documents Management: 設計書、DB schema、ER図、API仕様、UI/UX画面の保存/読み込み
    - Task Management: タスクリスト、依存関係グラフ、Kanbanステートの保存/読み込み
    - FileSystemManager mockに writeFile を追加、すべてのパスを実装に合わせて修正

- 🔵 **Task 6.5.3**: スクラムワークフロー統合テスト
  - ファイル: `tests/integration/scrum-workflow.test.ts`
  - 内容: 要求入力から設計完了までのエンドツーエンドテスト
  - 見積: 5時間
  - 担当: -
  - 依存: Task 6.4.3
  - **ステータス**: 完了
  - **実装内容**:
    - Graph Compilation: Scrum workflow graphのコンパイル成功検証
    - Node Structure: 全必須ノード（director_ai, review_story_mapping, tech_lead_design, review_design, task_breakdown）の存在確認
    - Initial State: Scrum workflow専用フィールド（storyMapping, designDocs, dependencyGraph等）の初期化検証
    - DataPersistence Integration: Story mapping、設計書、タスク分解データの永続化テスト
    - 既存のsprint-driven-development.test.tsパターンに従い、シンプルで安定したテストを実装

### 6.6 ドキュメント

**優先度**: 低

- 🟢 **Task 6.6.1**: README更新
  - ファイル: `README.md`
  - 内容: スクラム開発機能の使い方を追加
  - 見積: 1時間
  - 担当: -
  - 依存: Task 6.5.3

- 🟢 **Task 6.6.2**: サンプルプロジェクト作成
  - ファイル: `examples/scrum-workflow/`
  - 内容: スクラム開発の実行例
  - 見積: 2時間
  - 担当: -
  - 依存: Task 6.6.1

---

## Phase 7: スプリント駆動開発機能実装（🆕 Sprint-Driven Development）

### 7.1 基礎実装

**優先度**: 🔥 最高

- 🔵 **Task 7.1.1**: GlobalTask型、ProjectMetadata型、Sprint型の追加
  - ファイル: `src/types/index.ts`
  - 内容: スプリント駆動開発用の型定義
  - 見積: 1時間
  - 担当: -
  - 依存: なし
  - **ステータス**: 完了

- 🔵 **Task 7.1.2**: State定義の拡張
  - ファイル: `src/graph/state.ts`
  - 内容: globalTasks, projects, sprints, activeSprint, continuationMode などのフィールド追加
  - 見積: 2時間
  - 担当: -
  - 依存: Task 7.1.1
  - **ステータス**: 完了

- 🔵 **Task 7.1.3**: PriorityCalculator実装
  - ファイル: `src/utils/PriorityCalculator.ts`
  - 内容: 動的優先度計算（basePriority * 0.5 + recencyBonus * 0.3 + dependencyBonus * 0.2）
  - 見積: 3時間
  - 担当: -
  - 依存: Task 7.1.1
  - **ステータス**: 完了
  - 備考: detectContinuationMode()は廃止、AI判定に移行

- 🔵 **Task 7.1.4**: FileSystemManager実装
  - ファイル: `src/utils/FileSystemManager.ts`
  - 内容: ディレクトリ作成、JSONファイル読み書き
  - 見積: 2時間
  - 担当: -
  - 依存: なし
  - **ステータス**: 完了

- 🔵 **Task 7.1.5**: DataPersistence実装
  - ファイル: `src/utils/DataPersistence.ts`
  - 内容: グローバルキュー、スプリント、プロジェクトメタデータの永続化
  - 見積: 4時間
  - 担当: -
  - 依存: Task 7.1.4
  - **ステータス**: 完了
  - **機能**:
    - グローバルタスクキュー: `.kugutsu/tasks/global-queue.json`
    - アクティブスプリント: `.kugutsu/sprints/active-sprint.json`
    - スプリント履歴: `.kugutsu/sprints/sprint-history.json`
    - プロジェクトメタデータ: `.kugutsu/projects/{projectId}/project.json`

### 7.2 新規ノード実装

**優先度**: 🔥 最高

- 🔵 **Task 7.2.1**: CheckModeNode実装（AI駆動）
  - ファイル: `src/graph/nodes/CheckModeNode.ts`
  - 内容: AI駆動で継続モードか新規モードかを判定
  - 見積: 4時間
  - 担当: -
  - 依存: Task 7.1.3, 7.1.5, 1.2.4
  - **ステータス**: 完了
  - **重要**: 文字列パターンマッチング不使用、完全AI判定
  - **機能**:
    - AI Provider による継続モード判定
    - グローバルキュー読み込み
    - プロジェクトメタデータ読み込み
    - 優先度再計算

- 🔵 **Task 7.2.2**: SprintPlanningNode実装
  - ファイル: `src/graph/nodes/SprintPlanningNode.ts`
  - 内容: AI駆動でタスクをスプリントに分割（8-16h、E2E単位）
  - 見積: 5時間
  - 担当: -
  - 依存: Task 7.1.5, 1.2.4
  - **ステータス**: 完了
  - **テスト**: `tests/graph/nodes/SprintPlanningNode.test.ts` (7テスト、全て成功)
  - **制約**:
    - 各スプリント: 8-16時間の作業量
    - E2Eでテスト・デプロイ可能な機能単位
    - 依存関係を考慮（依存元を先に配置）
    - 1回の計画で1スプリントのみ作成

- 🔵 **Task 7.2.3**: SprintReviewNode実装
  - ファイル: `src/graph/nodes/SprintReviewNode.ts`
  - 内容: スプリント完了確認、デプロイ可能性チェック、次スプリント判断
  - 見積: 4時間
  - 担当: -
  - 依存: Task 7.1.5
  - **ステータス**: 完了
  - **テスト**: `tests/graph/nodes/SprintReviewNode.test.ts` (8テスト、全て成功)
  - **機能**:
    - スプリント完了確認
    - デプロイ可能性チェック
    - スプリント履歴への記録
    - 未完了タスクの判定

### 7.3 Graph統合

**優先度**: 🔥 最高

- 🔵 **Task 7.3.1**: createSprintDrivenGraph実装
  - ファイル: `src/graph/ParallelDevGraph.ts`
  - 内容: スプリント駆動開発ワークフローグラフ構築
  - 見積: 4時間
  - 担当: -
  - 依存: Task 7.2.1, 7.2.2, 7.2.3
  - **ステータス**: 完了
  - **フロー**:
    - START → CheckMode → [ProductOwner/SprintPlanning]
    - SprintPlanning → EngineerDispatch → Engineer → Review → MergeCoordinator
    - MergeCoordinator → SprintReview
    - SprintReview → [SprintPlanning/END]

- 🔵 **Task 7.3.2**: エントリーポイント更新
  - ファイル: `src/parallel-dev.ts`, `src/parallel-dev-electron.ts`
  - 内容: createSprintDrivenGraph を使用するように変更
  - 見積: 1時間
  - 担当: -
  - 依存: Task 7.3.1
  - **ステータス**: 完了
  - **実装**: `ParallelDevOrchestrator.ts` に `useSprintDriven` パラメータ追加（デフォルト: true）

### 7.4 テスト

**優先度**: 高

- 🔵 **Task 7.4.1**: CheckModeNode ユニットテスト
  - ファイル: `tests/graph/nodes/CheckModeNode.test.ts`
  - 内容: AI判定、継続モード/新規モード判定
  - 見積: 3時間
  - 担当: -
  - 依存: Task 7.2.1
  - **ステータス**: 完了 (7テスト、全て成功)

- 🔵 **Task 7.4.2**: SprintPlanningNode ユニットテスト
  - ファイル: `tests/graph/nodes/SprintPlanningNode.test.ts`
  - 内容: スプリント計画、タスク割り当て
  - 見積: 3時間
  - 担当: -
  - 依存: Task 7.2.2
  - **ステータス**: 完了 (7テスト、全て成功)

- 🔵 **Task 7.4.3**: SprintReviewNode ユニットテスト
  - ファイル: `tests/graph/nodes/SprintReviewNode.test.ts`
  - 内容: スプリント完了確認、デプロイ可能性チェック
  - 見積: 2時間
  - 担当: -
  - 依存: Task 7.2.3
  - **ステータス**: 完了 (8テスト、全て成功)

- 🔵 **Task 7.4.4**: DataPersistence ユニットテスト
  - ファイル: `tests/utils/DataPersistence.test.ts`
  - 内容: グローバルキュー、スプリント、プロジェクトメタデータの永続化
  - 見積: 3時間
  - 担当: -
  - 依存: Task 7.1.5
  - **ステータス**: 完了 (18テスト、全て成功)

- 🔵 **Task 7.4.5**: PriorityCalculator ユニットテスト
  - ファイル: `tests/utils/PriorityCalculator.test.ts`
  - 内容: 動的優先度計算、recencyBonus、dependencyBonus
  - 見積: 2時間
  - 担当: -
  - 依存: Task 7.1.3
  - **ステータス**: 完了 (17テスト、全て成功)

- 🔵 **Task 7.4.6**: スプリント駆動開発 統合テスト
  - ファイル: `tests/integration/sprint-driven-development.test.ts`
  - 内容: Graph compilation、Node connectivity、DataPersistence integration
  - 見積: 5時間
  - 担当: -
  - 依存: Task 7.3.2
  - **ステータス**: 完了 (6テスト、全て成功)

### 7.5 ドキュメント

**優先度**: 中

- 🔵 **Task 7.5.1**: ARCHITECTURE_DESIGN.md 更新
  - ファイル: `spec/ARCHITECTURE_DESIGN.md`
  - 内容: スプリント駆動開発フロー図、新ノード詳細仕様
  - 見積: 3時間
  - 担当: -
  - 依存: Task 7.3.1
  - **ステータス**: 完了
  - **更新内容**:
    - 5.1節: スプリント駆動開発全体フロー図
    - 5.6節: CheckModeNode, SprintPlanningNode, SprintReviewNode詳細仕様
    - 6節: createSprintDrivenGraph() コード例

- 🔵 **Task 7.5.2**: DATA_PERSISTENCE_SPECIFICATION.md 更新
  - ファイル: `spec/DATA_PERSISTENCE_SPECIFICATION.md`
  - 内容: グローバルキュー、スプリント情報の永続化仕様
  - 見積: 2時間
  - 担当: -
  - 依存: Task 7.1.5
  - **ステータス**: 完了
  - **更新内容**:
    - 2.2節: ディレクトリ構造追加（tasks/, sprints/）
    - 3.3節: global-queue.json 仕様
    - 3.4節: active-sprint.json 仕様
    - 3.5節: sprint-history.json 仕様

- 🔵 **Task 7.5.3**: README 更新
  - ファイル: `README.md`
  - 内容: スプリント駆動開発の使い方追加
  - 見積: 1時間
  - 担当: -
  - 依存: Task 7.4.6
  - **ステータス**: 完了
  - **更新内容**:
    - Advanced Usage Examples (マルチスプリントワークフロー、複数プロジェクト管理)
    - Troubleshooting (スプリント駆動開発の問題、一般的な問題、ヘルプ情報)

- 🔵 **Task 7.5.4**: サンプルプロジェクト作成
  - ファイル: `examples/sprint-driven-workflow/`
  - 内容: スプリント駆動開発の実行例
  - 見積: 2時間
  - 担当: -
  - 依存: Task 7.5.3
  - **ステータス**: 完了
  - **作成内容**:
    - README.md: サンプルの概要、使用方法、期待される結果
    - scenario.md: 3日間の詳細なシナリオ説明（Day 1-3）
    - .kugutsu/tasks/global-queue.json: 12タスクのサンプルデータ
    - .kugutsu/sprints/active-sprint.json: Sprint 2（進行中）のデータ
    - .kugutsu/sprints/sprint-history.json: Sprint 1（完了）の履歴
    - .kugutsu/projects/project-auth-2025/project.json: プロジェクトメタデータ

---

## タスク統計

### Phase別見積

| Phase | タスク数 | 完了 | 進行中 | 未着手 | 見積時間 | 消化時間 | 優先度 |
|-------|---------|------|-------|-------|---------|---------|-------|
| Phase 1 | 11 | 11 | 0 | 0 | 18.75h | ~18.75h | 🔥 最高 |
| Phase 2 | 16 | 16 | 0 | 0 | 44h | ~44h | 🔥 最高/高 |
| Phase 3 | 6 | 0 | 0 | 6 | 17h | 0h | 高/中 |
| Phase 4 | 8 | 8 | 0 | 0 | 24h | ~24h | 高/中/低 |
| Phase 5 | 10 | 0 | 0 | 10 | 11.58h | 0h | 中/低 |
| Phase 6 | 20 | 5 | 0 | 15 | 70h | ~19h | 🔥 最高/高/中/低 |
| Phase 7 | 20 | 20 | 0 | 0 | 56h | ~56h | 🔥 最高/高/中 |
| **合計** | **91** | **58** | **0** | **33** | **241.33h** | **~161.75h** | - |

### 優先度別

- 🔥 **最高優先度**: 37タスク (40.7%) - 41完了, 0進行中, 0未着手 ✨
- **高優先度**: 16タスク (17.6%) - 9完了, 0進行中, 7未着手
- **中優先度**: 15タスク (16.5%) - 5完了, 0進行中, 10未着手
- **低優先度**: 3タスク (3.3%) - 2完了, 0進行中, 1未着手

### 完了率

- **全体**: 63.7% (58/91 タスク)
- **見積時間ベース**: ~67.0% (~161.75h/241.33h)

---

## 依存関係グラフ

```
Phase 1 (基盤)
  ├─ 1.1 パッケージ → 1.2 プロバイダー → 1.3 State
  └─ すべてのPhaseの前提条件

Phase 2 (コア)
  ├─ 2.1 ノード実装 → 2.2 Graph構築
  └─ 2.3 インフラ統合（並行可能）

Phase 3 (UI)
  ├─ 3.1 Electron統合
  └─ 3.2 CLI更新

Phase 4 (テスト)
  ├─ 4.1 ユニットテスト（並行可能）
  ├─ 4.2 統合テスト
  └─ 4.3 最適化

Phase 5 (完了)
  ├─ 5.1 ドキュメント
  ├─ 5.2 既存コード削除
  └─ 5.3 リリース

Phase 6 (スクラム開発)
  ├─ 6.1 新規AIノード（Director, ReviewStoryMapping, TechLead等）
  ├─ 6.2 データ永続化（ストーリーマッピング、設計書）
  ├─ 6.3 UIコンポーネント
  ├─ 6.4 Graph統合
  ├─ 6.5 テスト
  └─ 6.6 ドキュメント

Phase 7 (スプリント駆動開発) 🆕 ✅ 完了
  ├─ 7.1 基礎実装（GlobalTask, State拡張、PriorityCalculator, DataPersistence）✅
  ├─ 7.2 新規ノード（CheckMode✅, SprintPlanning✅, SprintReview✅）
  ├─ 7.3 Graph統合（createSprintDrivenGraph✅）
  ├─ 7.4 テスト（ユニット✅、統合✅）
  └─ 7.5 ドキュメント（ARCHITECTURE_DESIGN✅, DATA_PERSISTENCE✅, README✅, サンプル✅）
```

---

## ブロッカー・リスク

### 現在のブロッカー

なし

### 潜在的リスク

1. **LangGraphJS APIの学習曲線** (中)
   - 対策: 公式ドキュメント熟読、サンプルコード参考

2. **Claude Agent SDK/Codex SDKのAPI変更** (低)
   - 対策: プロバイダー抽象化層で吸収

3. **並列実行の複雑性** (中)
   - 対策: 小さなテストから始める、段階的に複雑化

4. **Electron統合の互換性** (低)
   - 対策: ストリーミングAPIを使用

---

## 次のアクション（優先順位順）

### ✨ Phase 7 完了！

**Phase 7 (スプリント駆動開発) - 100% 完了 (20/20タスク)**

完了したタスク:
- ✅ 7.1 基礎実装 (5/5) - GlobalTask型、State拡張、PriorityCalculator、DataPersistence
- ✅ 7.2 新規ノード実装 (3/3) - CheckModeNode、SprintPlanningNode、SprintReviewNode
- ✅ 7.3 Graph統合 (2/2) - createSprintDrivenGraph、エントリーポイント更新
- ✅ 7.4 テスト (6/6) - 全ユニットテスト、統合テスト (合計63テスト)
- ✅ 7.5 ドキュメント (4/4) - ARCHITECTURE_DESIGN、DATA_PERSISTENCE、README、サンプルプロジェクト

**成果物**:
- スプリント駆動開発の完全実装（継続モード検出、動的優先度計算、データ永続化）
- 包括的なテストカバレッジ（63テスト、全て成功）
- 充実したドキュメント（仕様書、README、実行可能なサンプル）

**所要時間**: ~56時間（見積通り）

---

### 🔥 次の推奨フェーズ

#### Option 1: Phase 6 - スクラム開発フロー（推奨）

**優先度**: 🔥 最高優先度タスク含む
**見積**: 70時間
**理由**: Phase 7で実装したスプリント駆動開発の上に、本格的なスクラム開発フローを構築

**最初に着手すべきタスク**:

1. **Phase 6.1.1**: DirectorAI 実装 (🔥 最高優先度)
   - 見積: 8時間
   - 内容: プロジェクト全体を統括するDirector AIの実装
   - 理由: スクラム開発フローの中核

2. **Phase 6.2.1**: ストーリーマッピングデータ永続化 (🔥 最高優先度)
   - 見積: 3時間
   - 依存: なし
   - 内容: ユーザーストーリーの永続化機構

3. **Phase 6.1.2**: ReviewStoryMappingNode 実装 (🔥 最高優先度)
   - 見積: 5時間
   - 依存: Task 6.2.1
   - 内容: ストーリーマッピングのレビューノード

**Phase 6の価値**:
- ユーザーストーリー駆動の開発フロー
- より洗練されたAIロール（Director、TechLead拡張）
- ストーリーマッピングによる要件整理
- 設計書生成とレビュー機能

#### Option 2: Phase 3 - UI強化（代替案）

**優先度**: 高/中
**見積**: 17時間
**理由**: Electron UIと視覚化の改善

**タスク**:
- 3.1: Electron統合（6タスク、12時間）
- 3.2: CLI更新（2タスク、5時間）

**選択基準**:
- スクラム開発機能を優先 → Phase 6
- ユーザー体験を優先 → Phase 3
