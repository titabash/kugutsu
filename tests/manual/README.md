# Manual E2E Verification Tests

Claude Code環境（ログイン済みセッション）でのE2E検証スクリプト集

## 前提条件

- ✅ Claude Codeにサブスクリプション済みアカウントでログイン済み
- ✅ `@anthropic-ai/claude-agent-sdk`がインストール済み
- ✅ **ANTHROPIC_API_KEYは不要** - Claude Codeのログインセッションを使用
- ✅ Git がインストール済み（worktree操作に必要）

## 重要: Git Worktree検証について

このE2E検証では、**実際のGit worktree操作**をテストします。そのため:

1. **テストワークスペースはGitリポジトリとして初期化されます**
   - スクリプトが自動的に`git init`を実行
   - 初期コミットを作成
   - `main`ブランチを設定

2. **生成されたファイルは.gitignoreで除外されます**
   - `.kugutsu/` - Kugutsuの管理ファイル
   - `worktrees/` - Git worktreeディレクトリ
   - `src/`, `tests/` - 生成されたコード

3. **ディレクトリ構造自体はGitで追跡されます**
   - `test-e2e-minimal/` と `test-e2e-realistic/` はリポジトリに含まれる
   - `.gitkeep`ファイルでディレクトリを保持

## 検証スクリプト一覧

### 1. E2E Minimal Verification（最小構成）

**目的**: シンプルなタスクで全ワークフローを検証

**検証内容**:
- ProductOwnerNode: タスク分解
- EngineerNode: 実装
- ReviewNode: レビュー
- MergeCoordinatorNode: マージ

**実行方法**:
```bash
npm run verify:e2e-minimal
```

**期待される動作**:
- 1つのシンプルなタスク（"Hello World"関数追加）を完全に実行
- 約10-30イベント（タスクの複雑さによる）
- 最終的に全タスクが`completed`状態になる

**所要時間**: 約1-3分

---

### 2. E2E Realistic Verification（実践的）

**目的**: より実践的なシナリオで並列実行を検証

**検証内容**:
- 複数タスクの並列実行（maxEngineers: 2）
- 依存関係のあるタスク処理
- より複雑な実装要求（ユーザー管理システム）

**実行方法**:
```bash
npm run verify:e2e-realistic
```

**期待される動作**:
- 複数のタスク（User model, Registration, Login validation）を並列実行
- 約30-100イベント
- 依存関係に基づく順序制御が動作
- 複数エンジニアの並列動作を確認

**所要時間**: 約3-10分

---

## 検証結果の見方

### 成功の判定基準

#### ✅ 完全成功
```
✅ SUCCESS: All tasks completed!
```
- 全てのタスクが`completed`状態
- エラーなし

#### ⚠️ 部分成功
```
⚠️  INCOMPLETE: 2/3 tasks completed
```
- 一部タスクが完了
- 残りは`in_progress`や`in_review`状態
- **原因**: maxTurnsに達した、またはイベント制限に到達

#### ❌ 失敗
```
❌ FAILURE: Some tasks failed (1/3 completed)
```
- 一部タスクが`failed`状態
- **確認すべき点**:
  - タスクのエラーメッセージ
  - ProductOwnerNodeのログ
  - EngineerNodeの実装ログ

---

## ログの読み方

### イベントログ
```
[Event 15] Nodes: check_completion, engineer_dispatch
  📊 Progress: ✓1 ✗0 ⚙1 👁0 ⏳0 ⏸0
```

- `✓`: Completed
- `✗`: Failed
- `⚙`: In Progress
- `👁`: In Review
- `⏳`: Ready
- `⏸`: Pending

### ノード実行統計
```
Node Execution Statistics:
  check_completion          ████████████████ (16)
  engineer_dispatch         ████████████ (12)
  engineer                  ████████ (8)
  review                    ████ (4)
```

各ノードが何回実行されたかを表示

---

## トラブルシューティング

### 問題: "API key is required"エラー

**原因**: ClaudeAgentProviderがAPI keyを要求している

**解決策**: Claude Codeでログイン済みであることを確認
```bash
# Claude Codeのログイン状態を確認
# （Claude Code CLIで実行）
claude auth status
```

### 問題: タスクが`in_progress`のまま進まない

**原因**:
- EngineerNodeでエラーが発生している
- maxTurnsに達した

**解決策**:
1. EngineerNodeのログを確認
2. maxTurnsを増やす（`createInitialState`のオプション）
3. より簡単なタスクで再試行

### 問題: "GraphRecursionError"

**原因**: LangGraphの再帰制限（デフォルト25）に到達

**解決策**:
- タスクをより小さく分割
- maxTurnsを調整
- イベント数が異常に多い場合は、無限ループの可能性を調査

### 問題: ファイルが生成されない

**原因**:
- `.kugutsu/`ディレクトリが作成されていない
- FileWriterのパス設定が間違っている

**解決策**:
1. テストワークスペースのディレクトリ構造を確認
2. `baseRepoPath`が正しく設定されているか確認

---

## デバッグのコツ

### 1. イベント数制限の調整

スクリプト内の以下の行を変更:
```typescript
if (eventCount > 100) {  // ← この数値を調整
  console.log('\n⚠️  Event limit reached, stopping execution');
  break;
}
```

### 2. 詳細ログの有効化

各ノードのログをより詳しく表示:
```typescript
// check_completionノードの全ログを表示
if ('check_completion' in event) {
  console.log('Full logs:', JSON.stringify(event.check_completion.logs, null, 2));
}
```

### 3. 中間ファイルの確認

テスト実行後、以下のファイルを確認:
```bash
ls -la test-e2e-minimal/.kugutsu/
cat test-e2e-minimal/.kugutsu/tasks.json
cat test-e2e-minimal/.kugutsu/tech-stack.json
```

---

## 次のステップ

### より詳細な検証が必要な場合

1. **個別ノードの単体テスト**
   ```typescript
   // ProductOwnerNodeのみを実行
   const result = await productOwnerNode(initialState);
   console.log(result);
   ```

2. **特定のエラーケースの検証**
   - レビュー却下のループ
   - コンフリクト解決
   - タスク失敗時の挙動

3. **パフォーマンス検証**
   - 大量タスク（10+）の処理
   - 複雑な依存関係グラフ
   - 長時間実行の安定性

---

## 参考情報

- [Claude Agent SDK Documentation](https://docs.claude.com/en/api/agent-sdk/typescript)
- [LangGraphJS Documentation](https://langchain-ai.github.io/langgraphjs/)
- [プロジェクトREADME](../../README.md)
- [ワークフロー詳細](../../docs/parallel-development-workflow.md)
