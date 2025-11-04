# Implementation Task List

**プロジェクト**: Kugutsu 2.0
**最終更新**: 2025-11-05

## タスク分類

- 🟢 **未着手** (Not Started)
- 🟡 **進行中** (In Progress)
- 🔵 **完了** (Completed)
- 🔴 **ブロック** (Blocked)

---

## Phase 1: 基盤構築

### 1.1 パッケージセットアップ

**優先度**: 🔥 最高

- 🟢 **Task 1.1.1**: 依存パッケージのインストール
  - `@anthropic-ai/claude-agent-sdk`
  - `@openai/codex-sdk`
  - `@langchain/langgraph`
  - 見積: 30分
  - 担当: -
  - 備考: package.jsonを更新し、`npm install`実行

- 🟢 **Task 1.1.2**: TypeScript設定の更新
  - `tsconfig.json`の調整（LangGraphJS対応）
  - 見積: 15分
  - 担当: -

- 🟢 **Task 1.1.3**: 設定ファイルの作成
  - `.kugutsu/config.json` スキーマ定義
  - 環境変数設定（`.env.example`）
  - 見積: 30分
  - 担当: -

### 1.2 AIプロバイダー抽象化層

**優先度**: 🔥 最高

- 🟢 **Task 1.2.1**: IAIProviderインターフェース定義
  - ファイル: `src/providers/IAIProvider.ts`
  - 内容: インターフェース、型定義
  - 見積: 1時間
  - 担当: -
  - 依存: なし

- 🟢 **Task 1.2.2**: ClaudeAgentProvider実装
  - ファイル: `src/providers/ClaudeAgentProvider.ts`
  - 内容: Claude Agent SDK wrapper
  - 見積: 3時間
  - 担当: -
  - 依存: Task 1.2.1
  - 参考: https://docs.claude.com/en/api/agent-sdk/typescript

- 🟢 **Task 1.2.3**: OpenAICodexProvider実装
  - ファイル: `src/providers/OpenAICodexProvider.ts`
  - 内容: OpenAI Codex SDK wrapper
  - 見積: 3時間
  - 担当: -
  - 依存: Task 1.2.1
  - 参考: https://developers.openai.com/codex/sdk/

- 🟢 **Task 1.2.4**: AIProviderFactory実装
  - ファイル: `src/providers/AIProviderFactory.ts`
  - 内容: プロバイダー生成ファクトリー
  - 見積: 1時間
  - 担当: -
  - 依存: Task 1.2.2, 1.2.3

- 🟢 **Task 1.2.5**: ConfigurationManager実装
  - ファイル: `src/utils/ConfigurationManager.ts`
  - 内容: 設定ファイル読み込み、環境変数管理
  - 見積: 2時間
  - 担当: -
  - 依存: Task 1.1.3

### 1.3 LangGraph State定義

**優先度**: 🔥 最高

- 🟢 **Task 1.3.1**: 型定義の作成
  - ファイル: `src/graph/types.ts`
  - 内容: Task, Review, MergeTask, WorktreeInfo, LogEntry
  - 見積: 2時間
  - 担当: -
  - 依存: なし

- 🟢 **Task 1.3.2**: State定義の作成
  - ファイル: `src/graph/state.ts`
  - 内容: ParallelDevState（Annotation.Root）
  - 見積: 3時間
  - 担当: -
  - 依存: Task 1.3.1
  - 参考: https://langchain-ai.github.io/langgraphjs/concepts/low_level/

- 🟢 **Task 1.3.3**: Reducer関数のテスト
  - ファイル: `tests/graph/state.test.ts`
  - 内容: 各Reducerの動作確認
  - 見積: 2時間
  - 担当: -
  - 依存: Task 1.3.2

---

## Phase 2: コア機能実装

### 2.1 Graphノード実装

**優先度**: 🔥 最高

- 🟢 **Task 2.1.1**: ProductOwnerNode実装
  - ファイル: `src/graph/nodes/ProductOwnerNode.ts`
  - 内容: タスク分解ロジック
  - 見積: 5時間
  - 担当: -
  - 依存: Task 1.2.4, 1.3.2
  - 備考: 既存のTechStackAnalyzer、RequirementsAnalyzer、TaskGeneratorの統合

- 🟢 **Task 2.1.2**: EngineerDispatchNode実装
  - ファイル: `src/graph/nodes/EngineerDispatchNode.ts`
  - 内容: タスク割り当て、worktree作成
  - 見積: 3時間
  - 担当: -
  - 依存: Task 1.3.2, 2.3.1

- 🟢 **Task 2.1.3**: EngineerNode実装
  - ファイル: `src/graph/nodes/EngineerNode.ts`
  - 内容: コード実装、セッション管理
  - 見積: 4時間
  - 担当: -
  - 依存: Task 1.2.4, 1.3.2

- 🟢 **Task 2.1.4**: ReviewNode実装
  - ファイル: `src/graph/nodes/ReviewNode.ts`
  - 内容: コードレビューロジック
  - 見積: 3時間
  - 担当: -
  - 依存: Task 1.2.4, 1.3.2

- 🟢 **Task 2.1.5**: MergeCoordinatorNode実装
  - ファイル: `src/graph/nodes/MergeCoordinatorNode.ts`
  - 内容: マージ調整、コンフリクト検出
  - 見積: 4時間
  - 担当: -
  - 依存: Task 1.3.2, 2.3.1

- 🟢 **Task 2.1.6**: ConflictResolverNode実装
  - ファイル: `src/graph/nodes/ConflictResolverNode.ts`
  - 内容: コンフリクト解消ロジック
  - 見積: 4時間
  - 担当: -
  - 依存: Task 1.2.4, 1.3.2, 2.3.1

### 2.2 Graph構築

**優先度**: 🔥 最高

- 🟢 **Task 2.2.1**: ParallelDevGraph基本構造
  - ファイル: `src/graph/ParallelDevGraph.ts`
  - 内容: StateGraph生成、ノード追加
  - 見積: 2時間
  - 担当: -
  - 依存: Task 2.1.1～2.1.6

- 🟢 **Task 2.2.2**: エッジ定義
  - ファイル: `src/graph/ParallelDevGraph.ts`
  - 内容: addEdge, addConditionalEdges
  - 見積: 3時間
  - 担当: -
  - 依存: Task 2.2.1
  - 参考: https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph.StateGraph.html

- 🟢 **Task 2.2.3**: 並列実行ロジック
  - ファイル: `src/graph/ParallelDevGraph.ts`
  - 内容: Engineer/Reviewの並列実行設定
  - 見積: 2時間
  - 担当: -
  - 依存: Task 2.2.2

- 🟢 **Task 2.2.4**: グラフのコンパイルと実行
  - ファイル: `src/graph/ParallelDevGraph.ts`
  - 内容: compile(), stream()
  - 見積: 2時間
  - 担当: -
  - 依存: Task 2.2.3

### 2.3 インフラ層統合

**優先度**: 高

- 🟢 **Task 2.3.1**: GitWorktreeManager統合
  - ファイル: 既存の`src/managers/GitWorktreeManager.ts`
  - 内容: ノードから呼び出せるように調整
  - 見積: 2時間
  - 担当: -
  - 依存: なし

- 🟢 **Task 2.3.2**: FileSystemUtils作成
  - ファイル: `src/utils/FileSystemUtils.ts`
  - 内容: ファイル操作ユーティリティ
  - 見積: 1時間
  - 担当: -
  - 依存: なし

- 🟢 **Task 2.3.3**: エラーハンドリング
  - ファイル: `src/utils/ErrorHandler.ts`
  - 内容: 統一エラーハンドリング、リトライロジック
  - 見積: 2時間
  - 担当: -
  - 依存: なし

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

- 🟢 **Task 4.1.1**: AIプロバイダーのテスト
  - ファイル: `tests/providers/`
  - 内容: ClaudeAgentProvider, OpenAICodexProviderのテスト
  - 見積: 3時間
  - 担当: -
  - 依存: Task 1.2.2, 1.2.3

- 🟢 **Task 4.1.2**: Graphノードのテスト
  - ファイル: `tests/graph/nodes/`
  - 内容: 各ノードの単体テスト
  - 見積: 5時間
  - 担当: -
  - 依存: Task 2.1.1～2.1.6

- 🟢 **Task 4.1.3**: State Reducerのテスト
  - ファイル: `tests/graph/state.test.ts`
  - 内容: Reducer関数の動作確認（Phase 1で実施済み）
  - 見積: 0時間（完了）
  - 担当: -
  - 依存: Task 1.3.2

### 4.2 統合テスト

**優先度**: 高

- 🟢 **Task 4.2.1**: エンドツーエンドテスト
  - ファイル: `tests/integration/parallel-dev.test.ts`
  - 内容: ユーザー要求 → 完了までの全フロー
  - 見積: 6時間
  - 担当: -
  - 依存: Task 3.2.1

- 🟢 **Task 4.2.2**: コンフリクト解消テスト
  - ファイル: `tests/integration/conflict-resolution.test.ts`
  - 内容: マージコンフリクトの検出と解消
  - 見積: 4時間
  - 担当: -
  - 依存: Task 2.1.5, 2.1.6

- 🟢 **Task 4.2.3**: 並列実行テスト
  - ファイル: `tests/integration/parallel-execution.test.ts`
  - 内容: 複数タスクの同時実行
  - 見積: 3時間
  - 担当: -
  - 依存: Task 2.2.3

### 4.3 パフォーマンス最適化

**優先度**: 低

- 🟢 **Task 4.3.1**: ログバッファリング
  - ファイル: `src/graph/state.ts`
  - 内容: ログ配列のサイズ制限最適化
  - 見積: 1時間
  - 担当: -
  - 依存: なし

- 🟢 **Task 4.3.2**: State更新の効率化
  - ファイル: `src/graph/state.ts`
  - 内容: Reducerのパフォーマンス改善
  - 見積: 2時間
  - 担当: -
  - 依存: Task 4.2.1

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

## タスク統計

### Phase別見積

| Phase | タスク数 | 見積時間 | 優先度 |
|-------|---------|---------|-------|
| Phase 1 | 11 | 18.75h | 🔥 最高 |
| Phase 2 | 16 | 44h | 🔥 最高/高 |
| Phase 3 | 6 | 17h | 高/中 |
| Phase 4 | 8 | 24h | 高/中/低 |
| Phase 5 | 10 | 11.58h | 中/低 |
| **合計** | **51** | **115.33h** | - |

### 優先度別

- 🔥 **最高優先度**: 27タスク (52.9%)
- **高優先度**: 10タスク (19.6%)
- **中優先度**: 11タスク (21.6%)
- **低優先度**: 3タスク (5.9%)

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

## 次のアクション

1. **Phase 1.1.1**: パッケージインストール
2. **Phase 1.2.1**: IAIProviderインターフェース定義
3. **Phase 1.3.1**: 型定義の作成
