# LangGraph テストガイド

このドキュメントは、KugutsuプロジェクトのLangGraphワークフローをテストする方法を説明します。

## 目次

- [概要](#概要)
- [テストインフラ](#テストインフラ)
- [テストの書き方](#テストの書き方)
- [実行方法](#実行方法)
- [ベストプラクティス](#ベストプラクティス)

## 概要

本プロジェクトでは、LangGraphのワークフローを**AI SDKに依存せずに**テストするための包括的なテストインフラを構築しました。

### 主な特徴

- ✅ **完全にモック化**: Claude Agent SDKやCodex SDKへの実際の呼び出しは行いません
- ✅ **高速実行**: 外部APIを使用しないため、テストが高速に完了します
- ✅ **決定論的**: AI応答をモックするため、テスト結果が予測可能です
- ✅ **包括的**: グラフのルーティング、並列実行、状態遷移をすべてテスト可能

## テストインフラ

### 1. テストヘルパー (`tests/helpers/graph-test-helpers.ts`)

グラフテストを簡単に書くためのヘルパー関数を提供します。

#### 状態ビルダー (Fluent API)

```typescript
import { createTestState } from '../helpers/graph-test-helpers.js';

const state = createTestState('Test request')
  .withTasks([task1, task2])
  .withConfig({ maxEngineers: 3 })
  .withActiveSprint(sprint)
  .build();
```

#### グラフ実行ヘルパー

```typescript
import { executeUntilNode, collectEvents } from '../helpers/graph-test-helpers.js';

// 特定のノードまで実行
const state = await executeUntilNode(graph, initialState, 'product_owner');

// すべてのイベントを収集
const events = await collectEvents(graph.stream(initialState));
```

#### アサーションヘルパー

```typescript
import { expectNodeExecuted, expectTaskStatus } from '../helpers/graph-test-helpers.js';

// ノードが実行されたことを検証
expectNodeExecuted(events, 'engineer');

// タスクのステータスを検証
expectTaskStatus(state, 'task-001', 'completed');
```

### 2. MockAIProvider

AI応答をモックするためのプロバイダー。

#### 基本的な使い方

```typescript
import { MockAIProvider, createMockMessage } from '../../src/providers/MockAIProvider.js';

const mockProvider = new MockAIProvider();

// シンプルな応答を設定
mockProvider.setDefaultResponse({
  messages: [
    createMockMessage.assistant('実装が完了しました'),
    createMockMessage.result(true),
  ],
});
```

#### パターンベースのモック

```typescript
// 特定のプロンプトパターンに対して応答を設定
mockProvider.setMockResponse(/task.*breakdown/i, {
  messages: [
    createMockMessage.assistant(JSON.stringify({ tasks: [...] })),
    createMockMessage.result(true),
  ],
});
```

#### シナリオベースのモック

```typescript
import { simpleFeatureScenario } from '../fixtures/scenarios/simple-feature-scenario.js';

// シナリオをセットアップ
mockProvider.setupScenario(simpleFeatureScenario);
mockProvider.activateScenario('simple-feature-addition');

// シナリオに従って順次応答が返される
```

#### コールバック検証

```typescript
// 実行内容を検証
mockProvider.onExecute((prompt, options) => {
  console.log('Prompt:', prompt);
  expect(options.maxTurns).toBe(30);
});

// すべてのプロンプトを取得
const allPrompts = mockProvider.getAllPrompts();
```

### 3. テストフィクスチャ

再利用可能なテストデータを提供します。

#### タスクフィクスチャ

```typescript
import { singlePendingTask, multipleSimpleTasks } from '../fixtures/tasks/simple-tasks.js';
import { linearDependencyTasks } from '../fixtures/tasks/dependency-tasks.js';
```

#### AI応答フィクスチャ

```typescript
import { approvedReviewResponse } from '../fixtures/ai-responses/reviewer-responses.js';
import { successfulImplementationResponse } from '../fixtures/ai-responses/engineer-responses.js';
```

#### シナリオフィクスチャ

```typescript
import { simpleFeatureScenario } from '../fixtures/scenarios/simple-feature-scenario.js';
import { complexFeatureScenario } from '../fixtures/scenarios/complex-feature-scenario.js';
```

## テストの書き方

### ルーティングロジックのテスト

グラフの条件分岐が正しく動作することを検証します。

```typescript
import { compileUnifiedScrumWorkflowGraph } from '../../src/graph/ParallelDevGraph.js';
import { expectNodeExecuted, collectEvents } from '../helpers/graph-test-helpers.js';

test('Low complexity: should route to product_owner', async () => {
  const graph = compileUnifiedScrumWorkflowGraph();

  // 低複雑度の応答を設定
  mockProvider.setupComplexityJudgmentMock(false, 'low', 'Simple UI change');

  const initialState = createTestState('Add button hover effect').build();

  const events = await collectEvents(graph.stream(initialState));

  // ルーティングを検証
  expectNodeExecuted(events, 'analyze_complexity');
  expectNodeExecuted(events, 'check_mode');
  expectNodeExecuted(events, 'product_owner');
});
```

### 並列実行のテスト

Send APIを使った並列実行が正しく動作することを検証します。

```typescript
test('should execute multiple engineer nodes in parallel', async () => {
  const graph = compileUnifiedScrumWorkflowGraph();

  // 3つのタスクをin_progressに設定
  const tasks = [
    createTestTask({ id: 'task-1', status: 'in_progress' }),
    createTestTask({ id: 'task-2', status: 'in_progress' }),
    createTestTask({ id: 'task-3', status: 'in_progress' }),
  ];

  mockProvider.setDefaultResponse({
    messages: [createMockMessage.assistant('Completed'), createMockMessage.result(true)],
  });

  const initialState = createTestState('Test request')
    .withConfig({ maxEngineers: 3 })
    .withTasks(tasks)
    .build();

  const events = await collectEvents(graph.stream(initialState));

  // 3つのengineerノードが実行されたことを検証
  const engineerEvents = getNodeEvents(events, 'engineer');
  expect(engineerEvents.length).toBe(3);
});
```

### 状態遷移のテスト

タスクの状態が正しく遷移することを検証します。

```typescript
test('pending → in_progress → in_review → completed', async () => {
  const graph = compileUnifiedScrumWorkflowGraph();

  // 適切なモック応答を設定
  mockProvider.setMockResponse(/implementation/i, {
    messages: [createMockMessage.assistant('Implementation done'), createMockMessage.result(true)],
  });

  mockProvider.setMockResponse(/review/i, {
    messages: [
      createMockMessage.assistant(JSON.stringify({ status: 'approved' })),
      createMockMessage.result(true),
    ],
  });

  const initialState = createTestState('Simple task')
    .withTasks([createTestTask({ status: 'pending' })])
    .build();

  const finalState = await executeGraph(graph, initialState);

  // 最終状態を検証
  expectTaskStatus(finalState, 'task-1', 'completed');
});
```

## 実行方法

### すべてのテストを実行

```bash
npm test
```

### 特定のカテゴリのテストを実行

```bash
# グラフテストのみ
npm run test:graph

# ノード単体テストのみ
npm run test:nodes

# 統合テストのみ
npm run test:integration
```

### ウォッチモード

```bash
npm run test:watch
```

### カバレッジレポート

```bash
npm run test:coverage
```

## ベストプラクティス

### 1. テスト前にモックをリセット

```typescript
beforeEach(() => {
  jest.clearAllMocks();
  mockProvider.reset();
});
```

### 2. 適切なタイムアウトを設定

```typescript
test('long running test', async () => {
  // ...
}, 30000); // 30秒
```

### 3. 決定論的なテストデータを使用

```typescript
// ❌ ランダムデータは避ける
const taskId = `task-${Math.random()}`;

// ✅ 決定論的なデータを使用
const taskId = 'task-001';
```

### 4. モックは最小限に

```typescript
// ❌ すべての応答をモック
mockProvider.setMockResponse(/.*/, {...});

// ✅ 必要な部分のみモック
mockProvider.setMockResponse(/task breakdown/i, {...});
mockProvider.setMockResponse(/review/i, {...});
```

### 5. テストは独立させる

各テストは他のテストに依存せず、独立して実行可能にします。

```typescript
// ❌ グローバル状態に依存
let globalState;
test('test 1', async () => {
  globalState = await executeGraph(...);
});
test('test 2', async () => {
  // globalStateに依存
});

// ✅ 各テストで状態を作成
test('test 1', async () => {
  const state = createTestState()...;
});
test('test 2', async () => {
  const state = createTestState()...;
});
```

## トラブルシューティング

### TypeScriptエラーが発生する

```bash
# ビルドしてから実行
npm run build
npm test
```

### テストがタイムアウトする

Jestのデフォルトタイムアウトは5秒です。長時間かかるテストには明示的にタイムアウトを設定してください。

```typescript
test('slow test', async () => {
  // ...
}, 60000); // 60秒
```

### モックが機能しない

1. `jest.unstable_mockModule`を使用しているか確認
2. モック設定が**インポートの前**に行われているか確認
3. `clearAllMocks`を`beforeEach`で呼び出しているか確認

## 参考資料

- [LangGraph公式ドキュメント](https://langchain-ai.github.io/langgraphjs/)
- [LangGraph Pythonテストガイド](https://docs.langchain.com/oss/python/langgraph/test)
- [Jest公式ドキュメント](https://jestjs.io/)
- [プロジェクトのTESTING_GUIDE.md](../TESTING_GUIDE.md)

## まとめ

このテストインフラにより、AI SDKに依存せずにLangGraphワークフローを完全にテストできます。

**主な利点**:
- 🚀 高速なテスト実行
- 🎯 決定論的な結果
- 💰 APIコストゼロ
- 🔧 デバッグが容易
- 📊 高いテストカバレッジ

質問や問題があれば、GitHubのIssueで報告してください。
