# ファイルベースアーティファクト管理 実装タスク一覧

## 概要

`spec/ARTIFACT_MANAGEMENT_SPECIFICATION.md` と `spec/NODE_RESPONSIBILITIES_AND_WORKFLOW.md` で明確にしたファイルベースのアーティファクト管理システムを実装します。AI エージェント間で大きな JSON データを State で受け渡すのではなく、ファイルベースで永続化します。

**参照仕様:**
- `ARTIFACT_MANAGEMENT_SPECIFICATION.md` - ファイルベースアーティファクト管理の仕様
- `NODE_RESPONSIBILITIES_AND_WORKFLOW.md` - ノードの責務とワークフロー

**実装の核心:**
1. すべてのノードの出力を `.kugutsu/` ディレクトリ配下にファイルとして保存
2. ノードの実装は直接ファイルに出力しない
3. State/LangGraph は制御情報のみを保持し、ファイルパスのみを渡す
4. 上流ワーク（ProductOwnerNode）は `.kugutsu/` に出力する
5. 下流ワーク（EngineerNode）は `worktrees/` で作業を行う
6. デバッグと UI のためファイルベースで常に確認可能

---

## タスクの複雑度と優先度

### 複雑度

- **Low**: 1-2 時間で実装可能なタスク
- **Medium**: 3-6 時間、複雑なロジックや統合が必要
- **High**: 1-2 日間、複数コンポーネント間の連携が必要

### 優先度

- 🔴 **Critical**: システムの基幹となる優先タスク
- 🟠 **High**: 早期実装が望ましいタスク
- 🟡 **Medium**: 中程度の優先度、後回し可能
- 🟢 **Low**: 追加機能、または最後に実装

---

## Phase 1: 基盤整備（Infrastructure Setup）

### TASK-001: FileWriter ユーティリティの作成

**優先度:** 🔴 Critical
**複雑度:** Low
**依存:** なし
**見積:** 2時間

**目的:**
`.kugutsu/` ディレクトリ配下のファイル書き込みを安全に行うユーティリティクラスを作成。

**実装内容:**
- `src/utils/FileWriter.ts` を作成
- JSON ファイルの書き込み（pretty print、改行コード統一）
- Markdown ファイルの書き込み
- ディレクトリの自動作成
- エラーハンドリング

**影響を受けるファイル:**
- `src/utils/FileWriter.ts` (NEW)

**検証方法:**
```typescript
// Unit test
const writer = new FileWriter('.kugutsu');
await writer.writeJSON('test.json', { foo: 'bar' });
const content = await fs.readFile('.kugutsu/test.json', 'utf-8');
assert(JSON.parse(content).foo === 'bar');
```

**実装例:**
```typescript
export class FileWriter {
  constructor(private baseDir: string) {}

  async writeJSON(relativePath: string, data: any): Promise<string> {
    const fullPath = path.join(this.baseDir, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, JSON.stringify(data, null, 2), 'utf-8');
    return fullPath;
  }

  async writeMarkdown(relativePath: string, content: string): Promise<string> {
    const fullPath = path.join(this.baseDir, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
    return fullPath;
  }
}
```

---

### TASK-002: FileReader ユーティリティの作成

**優先度:** 🔴 Critical
**複雑度:** Low
**依存:** なし
**見積:** 2時間

**目的:**
`.kugutsu/` ディレクトリからのファイル読み込みを安全に行うユーティリティクラスを作成。

**実装内容:**
- `src/utils/FileReader.ts` を作成
- JSON ファイルの読み込みと型安全性
- Markdown ファイルの読み込み
- ファイル存在確認
- エラーハンドリング

**影響を受けるファイル:**
- `src/utils/FileReader.ts` (NEW)

**検証方法:**
```typescript
// Unit test
const reader = new FileReader('.kugutsu');
const data = await reader.readJSON<TechStack>('tech-stack.json');
assert(data.languages.length > 0);
```

**実装例:**
```typescript
export class FileReader {
  constructor(private baseDir: string) {}

  async readJSON<T>(relativePath: string): Promise<T> {
    const fullPath = path.join(this.baseDir, relativePath);
    if (!await this.exists(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }
    const content = await fs.readFile(fullPath, 'utf-8');
    return JSON.parse(content) as T;
  }

  async readMarkdown(relativePath: string): Promise<string> {
    const fullPath = path.join(this.baseDir, relativePath);
    return await fs.readFile(fullPath, 'utf-8');
  }

  async exists(relativePath: string): Promise<boolean> {
    const fullPath = path.join(this.baseDir, relativePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
```

---

### TASK-003: 型定義の追加

**優先度:** 🔴 Critical
**複雑度:** Medium
**依存:** なし
**見積:** 3時間

**目的:**
`.kugutsu/` ディレクトリ配下のファイル構造に対応する TypeScript 型定義を作成。

**実装内容:**
- `src/types/artifacts.ts` を作成
- TechStack, Requirements, Task, Review, MergeResult, Conflicts の型定義
- JSON Schema 検証のための型定義

**影響を受けるファイル:**
- `src/types/artifacts.ts` (NEW)
- `src/graph/types.ts` (UPDATE: import artifacts types)

**検証方法:**
- TypeScript コンパイルが正しく通過すること
- 型定義が正確で使いやすいこと

**実装例:**
```typescript
// src/types/artifacts.ts
export interface TechStack {
  languages: string[];
  frameworks: string[];
  buildTools: string[];
  testingFrameworks: string[];
  projectType: string;
}

export interface Requirements {
  functional: string[];
  nonFunctional: string[];
  constraints: string[];
}

export interface TaskArtifact {
  id: string;
  title: string;
  description: string;
  priority: number;
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'implemented' | 'reviewed' | 'completed';
  createdAt: string;
  updatedAt: string;
  worktreePath?: string;
  assignedEngineer?: string;
}

export interface Review {
  taskId: string;
  reviewer: string;
  status: 'approved' | 'changes_requested' | 'rejected';
  comments: string;
  suggestions: string[];
  reviewedAt: string;
}

export interface MergeResult {
  taskId: string;
  status: 'success' | 'conflict' | 'failed';
  conflictFiles?: string[];
  mergedAt: string;
  message?: string;
}

export interface Conflicts {
  taskId: string;
  conflictFiles: string[];
  resolution: 'resolved' | 'pending' | 'failed';
  resolvedAt?: string;
  resolvedBy?: string;
}
```

---

### TASK-004: State 定義の更新

**優先度:** 🔴 Critical
**複雑度:** Medium
**依存:** TASK-003
**見積:** 3時間

**目的:**
LangGraph State からデータ本体を削除し、制御情報とファイルパスのみを保持するように変更。

**実装内容:**
- `src/graph/state.ts` を更新
- State からデータ本体を削除
- 代わりにファイルパスを追加
- State は制御情報（currentNode, phase, errors）とファイルパスのみ

**影響を受けるファイル:**
- `src/graph/state.ts` (UPDATE)

**検証方法:**
- TypeScript コンパイルが正しく通過すること
- State の型定義が正確に更新されること

**実装例:**
```typescript
// src/graph/state.ts
export interface ParallelDevStateType {
  // ユーザー要求
  userRequest: string;

  // 設定
  config: {
    baseRepoPath: string;
    worktreeBasePath: string;
    provider: 'claude' | 'codex' | 'mock';
    maxEngineers: number;
    maxTurns: number;
  };

  // ファイルパス（実データは.kugutsuディレクトリにある）
  techStackPath?: string;        // .kugutsu/tech-stack.json
  requirementsPath?: string;      // .kugutsu/requirements.json
  tasksPath?: string;             // .kugutsu/tasks.json
  storyMapPath?: string;          // .kugutsu/story-map.json
  sprintPlanPath?: string;        // .kugutsu/sprint-plan.json

  // 制御情報
  currentNode?: string;
  phase?: string;

  // ログとメタデータ
  logs: LogEntry[];
  metadata: Record<string, any>;
}
```

---

## Phase 1.5: MockProvider 強化（Debugging & Testing Support）

### TASK-014A: Tool 操作シミュレーション機能の実装

**優先度:** 🟠 High
**複雑度:** Medium
**依存:** TASK-001, TASK-002
**見積:** 8時間

**目的:**
MockAIProvider が Write, Read, Edit, Bash などのツール操作を実際にシミュレートできるようにする。

**実装内容:**
- `src/providers/MockAIProvider.ts` を更新
- `MockToolSimulation` インターフェースの追加
- Write 操作: 実際にファイルを作成
- Read 操作: 実際にファイルを読み込む
- Bash 操作: コマンド実行のモック（stdout/stderr/exitCode を返す）
- エラーシミュレーション（権限エラー、ファイル未存在など）

**影響を受けるファイル:**
- `src/providers/MockAIProvider.ts` (UPDATE)
- `src/types/mock.ts` (NEW)

**検証方法:**
```typescript
// Test
const mock = new MockAIProvider();
mock.setToolSimulation({
  simulateWrite: [{
    filePathPattern: /\.kugutsu\/tech-stack\.json$/,
    action: async (filePath, content) => {
      await fs.writeFile(filePath, content, 'utf-8');
    },
    shouldSucceed: true
  }]
});

// Verify actual file is written
const exists = await fs.access('.kugutsu/tech-stack.json');
assert(exists);
```

**実装例:**
```typescript
export interface MockToolSimulation {
  simulateWrite?: {
    filePathPattern: RegExp;
    action: (filePath: string, content: string) => Promise<void>;
    shouldSucceed: boolean;
    errorMessage?: string;
  }[];

  simulateRead?: {
    filePathPattern: RegExp;
    action: (filePath: string) => Promise<string>;
    shouldSucceed: boolean;
    errorMessage?: string;
  }[];

  simulateBash?: {
    commandPattern: RegExp;
    action: (command: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  }[];
}

export class MockAIProvider implements IAIProvider {
  private toolSimulation?: MockToolSimulation;

  setToolSimulation(simulation: MockToolSimulation): void {
    this.toolSimulation = simulation;
  }

  async *execute(prompt: string, options?: ExecuteOptions): AsyncIterable<AIMessage> {
    // Execute tool simulations if configured
    if (this.toolSimulation) {
      // ... implement tool simulation logic
    }

    // ... existing mock response logic
  }
}
```

---

### TASK-014B: マルチターン会話フローのシミュレーション

**優先度:** 🟠 High
**複雑度:** Medium
**依存:** TASK-014A
**見積:** 6時間

**目的:**
MockAIProvider が複数ターンにわたる会話をシミュレートできるようにする。

**実装内容:**
- `MockConversationFlow` インターフェースの追加
- ターン番号ごとのメッセージ定義
- ツールアクション（Write, Read など）の組み込み
- ターン間の状態管理

**影響を受けるファイル:**
- `src/providers/MockAIProvider.ts` (UPDATE)
- `src/types/mock.ts` (UPDATE)

**検証方法:**
```typescript
const mock = new MockAIProvider();
mock.setConversationFlow({
  name: 'ProductOwner Analysis',
  turns: [
    {
      turnNumber: 1,
      messages: [{ type: 'assistant', content: 'Analyzing tech stack...' }],
      toolActions: [{
        tool: 'Read',
        arguments: { file_path: 'package.json' },
        result: { content: '...' }
      }]
    },
    {
      turnNumber: 2,
      messages: [{ type: 'assistant', content: 'Writing analysis...' }],
      toolActions: [{
        tool: 'Write',
        arguments: { file_path: '.kugutsu/tech-stack.json', content: '...' },
        result: { success: true }
      }]
    }
  ]
});
```

**実装例:**
```typescript
export interface MockConversationFlow {
  name: string;
  turns: MockTurn[];
  finalResult?: AIMessage;
}

export interface MockTurn {
  turnNumber: number;
  messages: AIMessage[];
  toolActions?: {
    tool: 'Write' | 'Read' | 'Edit' | 'Bash';
    arguments: Record<string, any>;
    result: any;
  }[];
  delayMs?: number; // リアルタイム感のための遅延
}
```

---

### TASK-014C: リアルタイムイベントストリーミング

**優先度:** 🟠 High
**複雑度:** Low
**依存:** TASK-014B
**見積:** 4時間

**目的:**
MockAIProvider が Electron UI 向けにリアルタイムイベントをストリーミングできるようにする。

**実装内容:**
- `MockEventSequence` インターフェースの追加
- State 更新イベントのシミュレーション
- ログバッチのストリーミング
- タイムスタンプ付きイベント

**影響を受けるファイル:**
- `src/providers/MockAIProvider.ts` (UPDATE)
- `src/types/mock.ts` (UPDATE)

**検証方法:**
```typescript
const mock = new MockAIProvider();
mock.setEventSequence({
  events: [
    { type: 'node-started', data: { node: 'ProductOwnerNode' }, delay: 0 },
    { type: 'task-update', data: { status: 'in_progress' }, delay: 1000 },
    { type: 'logs-batch', data: { logs: [...] }, delay: 2000 },
    { type: 'node-completed', data: { node: 'ProductOwnerNode' }, delay: 3000 }
  ],
  intervalMs: 100
});

// Verify events are emitted correctly
for await (const event of mock.streamEvents()) {
  console.log(event);
}
```

**実装例:**
```typescript
export interface MockEventSequence {
  events: MockStreamEvent[];
  intervalMs?: number; // イベント間の最小間隔
}

export interface MockStreamEvent {
  type: 'node-started' | 'node-completed' | 'task-update' | 'logs-batch' | 'error';
  data: any;
  delay?: number; // このイベントまでの遅延（ms）
}

export class MockAIProvider implements IAIProvider {
  async *streamEvents(): AsyncIterable<MockStreamEvent> {
    if (!this.eventSequence) return;

    for (const event of this.eventSequence.events) {
      if (event.delay) {
        await new Promise(resolve => setTimeout(resolve, event.delay));
      }
      yield event;
    }
  }
}
```

---

### TASK-014D: ワークフローシナリオ機能の実装

**優先度:** 🟠 High
**複雑度:** High
**依存:** TASK-014C
**見積:** 8時間

**目的:**
MockAIProvider が完全なワークフロー（ProductOwner → Engineer → Review → Merge）をシミュレートできるようにする。

**実装内容:**
- `MockWorkflowScenario` インターフェースの追加
- ノードごとの会話フローとイベントシーケンスの定義
- 期待される最終状態の定義
- シナリオの実行と検証

**影響を受けるファイル:**
- `src/providers/MockAIProvider.ts` (UPDATE)
- `src/types/mock.ts` (UPDATE)

**検証方法:**
```typescript
const mock = new MockAIProvider();
mock.setWorkflowScenario({
  name: 'Complete Happy Path',
  nodeResponses: {
    'ProductOwnerNode': {
      conversationFlow: { ... },
      eventSequence: { ... },
      duration: 5000,
      shouldSucceed: true
    },
    'EngineerNode': {
      conversationFlow: { ... },
      eventSequence: { ... },
      duration: 10000,
      shouldSucceed: true
    },
    'ReviewNode': {
      conversationFlow: { ... },
      eventSequence: { ... },
      duration: 3000,
      shouldSucceed: true
    }
  },
  expectedFinalState: {
    tasks: [{ id: 'task-001', status: 'completed' }],
    metadata: { phase: 'completed' }
  }
});
```

**実装例:**
```typescript
export interface MockWorkflowScenario {
  name: string;
  description: string;
  nodeResponses: {
    [nodeName: string]: {
      conversationFlow: MockConversationFlow;
      eventSequence: MockEventSequence;
      duration: number; // 想定実行時間（ms）
      shouldSucceed: boolean;
      errorToThrow?: Error;
    };
  };
  expectedFinalState: {
    tasks: TaskArtifact[];
    metadata: Record<string, any>;
  };
}
```

---

### TASK-014E: シナリオライブラリの作成

**優先度:** 🟡 Medium
**複雑度:** Medium
**依存:** TASK-014D
**見積:** 6時間

**目的:**
よく使うテストシナリオを事前定義して、簡単に利用できるようにする。

**実装内容:**
- `src/providers/mock-scenarios/` ディレクトリ作成
- Happy Path シナリオ
- エラーケースシナリオ（ファイル書き込み失敗、マージコンフリクトなど）
- 複雑なワークフローシナリオ（Scrum Development）
- シナリオのエクスポートと利用

**影響を受けるファイル:**
- `src/providers/mock-scenarios/happy-path.ts` (NEW)
- `src/providers/mock-scenarios/error-cases.ts` (NEW)
- `src/providers/mock-scenarios/scrum-workflow.ts` (NEW)
- `src/providers/mock-scenarios/index.ts` (NEW)

**検証方法:**
```typescript
import { HappyPathScenario } from '../providers/mock-scenarios';

const mock = new MockAIProvider();
mock.setWorkflowScenario(HappyPathScenario);

await orchestrator.start('Implement feature X');
// Expected: Complete workflow without errors
```

**実装例:**
```typescript
// src/providers/mock-scenarios/happy-path.ts
export const HappyPathScenario: MockWorkflowScenario = {
  name: 'Happy Path - Simple Feature Implementation',
  description: 'Complete workflow with no errors or conflicts',
  nodeResponses: {
    'ProductOwnerNode': {
      conversationFlow: {
        name: 'Task Analysis',
        turns: [
          // ... detailed turn definitions
        ]
      },
      eventSequence: {
        events: [
          // ... event definitions
        ]
      },
      duration: 5000,
      shouldSucceed: true
    },
    // ... other nodes
  },
  expectedFinalState: {
    tasks: [
      { id: 'task-001', status: 'completed', title: 'Implement feature X' }
    ],
    metadata: { phase: 'completed', hasErrors: false }
  }
};
```

---

### TASK-014F: Electron UI テスト統合

**優先度:** 🟡 Medium
**複雑度:** Low
**依存:** TASK-014E
**見積:** 4時間

**目的:**
MockAIProvider を使った Electron UI の動作確認を容易にする。

**実装内容:**
- Electron アプリ起動時に Mock モードを選択可能に
- UI 上でシナリオを選択できる機能
- リアルタイムストリーミングの可視化
- デバッグコンソールの追加

**影響を受けるファイル:**
- `electron/main/index.ts` (UPDATE)
- `electron/renderer/components/MockScenarioSelector.tsx` (NEW)
- `electron/renderer/components/DebugConsole.tsx` (NEW)

**検証方法:**
```bash
npm run electron
# Mock mode を選択
# Happy Path シナリオを選択
# UI が正しく更新されることを確認
```

---

## Phase 2: ProductOwnerNode の実装（上流ワーク）

### TASK-005: ProductOwnerNode - 技術スタック分析のファイル出力

**優先度:** 🟠 High
**複雑度:** Medium
**依存:** TASK-001, TASK-003, TASK-004
**見積:** 4時間

**目的:**
ProductOwnerNode の技術スタック分析を `.kugutsu/tech-stack.json` に書き込むように変更。AI に直接ファイル書き込みを指示。

**実装内容:**
- `src/graph/nodes/ProductOwnerNode.ts` を更新
- 技術スタック分析を AI にファイル書き込みを指示
- State に `techStackPath` を設定
- AI エージェント間でのファイル引き渡し

**影響を受けるファイル:**
- `src/graph/nodes/ProductOwnerNode.ts` (UPDATE)

**検証方法:**
```bash
# Mock provider で動作確認
npm run parallel-dev-cli "Test request"
# .kugutsu/tech-stack.json が作成されること
ls -la .kugutsu/tech-stack.json
cat .kugutsu/tech-stack.json
```

**実装の核心:**
```typescript
// AI に指示するプロンプト
const techStackAnalysisPrompt = `
# Technology Stack Analysis

プロジェクトの技術スタックを分析して、以下のファイルにJSONで出力してください。
**出力パス**: ${path.join(config.baseRepoPath, '.kugutsu/tech-stack.json')}

## 手順
1. 設定ファイルを読み込む（package.json, tsconfig.json）
2. 使用されているプログラミング言語を特定
3. フレームワークとライブラリを特定

## 出力形式
Write ツールを使用して、以下の JSON 形式でファイルを作成してください。
\`\`\`json
{
  "languages": ["言語1", "言語2"],
  "frameworks": ["フレームワーク1"],
  "buildTools": ["ツール1"],
  "testingFrameworks": ["テストフレームワーク1"],
  "projectType": "プロジェクトタイプ"
}
\`\`\`
`;

// AI が Write ツールを使用してファイルを書き込む
for await (const message of provider.execute(techStackAnalysisPrompt, {
  maxTurns: 5,
  cwd: config.baseRepoPath,
  allowedTools: ['Read', 'Glob', 'Grep', 'Write'],
  permissionMode: 'acceptEdits',
})) {
  // AI がファイルを書き込む
}

// ファイルパスを State に設定
return {
  techStackPath: '.kugutsu/tech-stack.json',
  logs: [...]
};
```

---

### TASK-006: ProductOwnerNode - 要求分析のファイル出力

**優先度:** 🟠 High
**複雑度:** Medium
**依存:** TASK-005
**見積:** 4時間

**目的:**
ProductOwnerNode の要求分析を `.kugutsu/requirements.json` に書き込むように変更。

**実装内容:**
- `src/graph/nodes/ProductOwnerNode.ts` を更新
- 要求分析を `.kugutsu/requirements.json` に書き込む
- 前段階の `tech-stack.json` を Read ツールで読み込んで AI に指示
- State に `requirementsPath` を設定

**影響を受けるファイル:**
- `src/graph/nodes/ProductOwnerNode.ts` (UPDATE)

**検証方法:**
```bash
npm run parallel-dev-cli "Test request"
ls -la .kugutsu/requirements.json
cat .kugutsu/requirements.json
```

**実装の核心:**
```typescript
const requirementsAnalysisPrompt = `
# Requirements Analysis

先の技術スタック分析を読み込んで要求分析を行ってください。
**入力ファイル**: ${path.join(config.baseRepoPath, '.kugutsu/tech-stack.json')}

Read ツールで読み込んでください。
ファイルベースの出力ファイルにJSONで保存してください。
**出力ファイル**: ${path.join(config.baseRepoPath, '.kugutsu/requirements.json')}

## 出力形式
Write ツールを使用して、以下の JSON 形式でファイルを作成してください。
\`\`\`json
{
  "functional": ["機能1", "機能2"],
  "nonFunctional": ["要件1"],
  "constraints": ["制約1"]
}
\`\`\`
`;
```

---

### TASK-007: ProductOwnerNode - タスク生成のファイル出力

**優先度:** 🟠 High
**複雑度:** High
**依存:** TASK-006
**見積:** 6時間

**目的:**
ProductOwnerNode のタスク生成を `.kugutsu/tasks.json` に書き込むように変更。タスクごとに `.kugutsu/tasks/{taskId}/instruction.md` を作成。

**実装内容:**
- `src/graph/nodes/ProductOwnerNode.ts` を更新
- タスクを`.kugutsu/tasks.json` に書き込む
- タスクの詳細説明を `.kugutsu/tasks/{taskId}/instruction.md` に書き込む
- AI にファイル書き込みを指示（複数ファイルを同時に作成）
- State に `tasksPath` を設定

**影響を受けるファイル:**
- `src/graph/nodes/ProductOwnerNode.ts` (UPDATE)

**検証方法:**
```bash
npm run parallel-dev-cli "Test request"
ls -la .kugutsu/tasks.json
cat .kugutsu/tasks.json
ls -la .kugutsu/tasks/task-001/instruction.md
cat .kugutsu/tasks/task-001/instruction.md
```

**実装の核心:**
```typescript
const taskGenerationPrompt = `
# Task Generation

先のファイルを読み込んでタスク生成を行ってください。
**要求分析**: ${path.join(config.baseRepoPath, '.kugutsu/requirements.json')}

Read ツールで読み込んでください。
ファイルベースの2つのファイルを作成してください。

## 1. タスク一覧ファイル
**出力パス**: ${path.join(config.baseRepoPath, '.kugutsu/tasks.json')}
\`\`\`json
[
  {
    "id": "task-001",
    "title": "タスクタイトル",
    "description": "概要",
    "priority": 10,
    "dependencies": [],
    "status": "pending",
    "createdAt": "2025-01-07T10:00:00Z",
    "updatedAt": "2025-01-07T10:00:00Z"
  }
]
\`\`\`

## 2. タスクの詳細説明
タスクごとに以下のファイルを作成してください。
**パス形式**: ${path.join(config.baseRepoPath, '.kugutsu/tasks/{taskId}/instruction.md')}

Markdown 形式で以下の項目を含めてください:
- タスクの目的
- 実装すべき詳細
- 技術的制約
- 動作確認
- 補足情報
`;
```

---

### TASK-008: DirectorNode のファイル出力対応

**優先度:** 🟡 Medium
**複雑度:** Medium
**依存:** TASK-001, TASK-003
**見積:** 4時間

**目的:**
DirectorNode が `.kugutsu/story-map.json` を作成するように変更。

**実装内容:**
- `src/graph/nodes/DirectorNode.ts` を更新
- ストーリーマッピングを `.kugutsu/story-map.json` に書き込む
- AI にファイル書き込みを指示
- State に `storyMapPath` を設定

**影響を受けるファイル:**
- `src/graph/nodes/DirectorNode.ts` (UPDATE)

**検証方法:**
```bash
# Scrum ワークフローで動作確認
npm run parallel-dev-cli "Create story map"
ls -la .kugutsu/story-map.json
```

---

### TASK-009: SprintPlanningNode のファイル出力対応

**優先度:** 🟡 Medium
**複雑度:** Medium
**依存:** TASK-008
**見積:** 4時間

**目的:**
SprintPlanningNode が `.kugutsu/sprint-plan.json` を作成するように変更。

**実装内容:**
- `src/graph/nodes/SprintPlanningNode.ts` を更新
- story-map.json または tasks.json を Read ツールで読み込む
- スプリント計画を `.kugutsu/sprint-plan.json` に書き込む
- State に `sprintPlanPath` を設定

**影響を受けるファイル:**
- `src/graph/nodes/SprintPlanningNode.ts` (UPDATE)

---

## Phase 3: EngineerNode/ReviewNode の実装（下流ワーク）

### TASK-010: EngineerNode - instruction.md の読み込み

**優先度:** 🟠 High
**複雑度:** High
**依存:** TASK-007
**見積:** 6時間

**目的:**
EngineerNode が `.kugutsu/tasks/{taskId}/instruction.md` を読み込み、worktree で作業を行うように変更。

**実装内容:**
- `src/graph/nodes/EngineerNode.ts` を更新
- タスク開始時に `.kugutsu/tasks/{taskId}/instruction.md` を読み込む
- AI に詳細指示を渡して作業を依頼
- 作業は `worktrees/task-{taskId}/` ディレクトリで行う
- 完了後、tasks.json の status を `implemented` に更新

**影響を受けるファイル:**
- `src/graph/nodes/EngineerNode.ts` (UPDATE)

**検証方法:**
```bash
npm run parallel-dev-cli "Implement feature X"
# worktrees/task-001/ に実装が作成されること
cd worktrees/task-001 && git log
# tasks.json の status が "implemented" に更新されること
cat .kugutsu/tasks.json
```

**実装の核心:**
```typescript
export async function engineerNode(state: ParallelDevStateType): Promise<ParallelDevStateUpdate> {
  const { tasksPath, config } = state;

  // tasks.json を読み込む
  const reader = new FileReader(config.baseRepoPath);
  const tasks = await reader.readJSON<TaskArtifact[]>(tasksPath!);

  // 実装するタスクを探す
  const taskToImplement = tasks.find(t => t.status === 'pending');
  if (!taskToImplement) {
    return { logs: [...] };
  }

  // instruction.md を読み込む
  const instructionPath = `.kugutsu/tasks/${taskToImplement.id}/instruction.md`;
  const instruction = await reader.readMarkdown(instructionPath);

  // Worktree を作成
  const worktreePath = await gitManager.createWorktree(taskToImplement.id);

  // AI に作業を指示
  const implementationPrompt = `
# Task Implementation

以下のタスクを実装してください。

## タスク説明
${instruction}

## 作業ディレクトリ
${worktreePath}

## 実装の手順
1. 説明の内容を理解する
2. 動作確認を作成
3. 実装が完了したら git commit を行う
4. 最終的な出力はしない

必ず Read, Write, Edit, Bash ツールを使用して実装してください。
`;

  // AI が実装を行う
  for await (const message of provider.execute(implementationPrompt, {
    maxTurns: 30,
    cwd: worktreePath,
    allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
    permissionMode: 'acceptEdits',
  })) {
    // AI が作業を行う
  }

  // tasks.json の status を更新
  taskToImplement.status = 'implemented';
  taskToImplement.worktreePath = worktreePath;
  taskToImplement.updatedAt = new Date().toISOString();

  const writer = new FileWriter(config.baseRepoPath);
  await writer.writeJSON(tasksPath!, tasks);

  return {
    logs: [{
      timestamp: new Date(),
      level: 'info',
      source: 'EngineerNode',
      message: `タスク ${taskToImplement.id} の実装が完了しました`,
      data: { taskId: taskToImplement.id, worktreePath }
    }]
  };
}
```

---

### TASK-011: ReviewNode - review.json 書き込み

**優先度:** 🟠 High
**複雑度:** Medium
**依存:** TASK-010
**見積:** 5時間

**目的:**
ReviewNode が worktree の実装をレビューし、結果を `.kugutsu/tasks/{taskId}/review.json` に書き込むように変更。

**実装内容:**
- `src/graph/nodes/ReviewNode.ts` を更新
- tasks.json から `status === 'implemented'` のタスクを探す
- worktree の実装を AI にレビューさせる
- レビュー結果を `.kugutsu/tasks/{taskId}/review.json` に書き込む
- tasks.json の status を `reviewed` に更新

**影響を受けるファイル:**
- `src/graph/nodes/ReviewNode.ts` (UPDATE)

**検証方法:**
```bash
npm run parallel-dev-cli "Implement and review feature X"
# review.json が作成されること
cat .kugutsu/tasks/task-001/review.json
# tasks.json の status が "reviewed" に更新されること
cat .kugutsu/tasks.json
```

---

## Phase 4: MergeCoordinatorNode/ConflictResolverNode の実装

### TASK-012: MergeCoordinatorNode - merge-result.json 書き込みと状態更新

**優先度:** 🟠 High
**複雑度:** High
**依存:** TASK-011
**見積:** 6時間

**目的:**
MergeCoordinatorNode がマージを行い、結果を `.kugutsu/tasks/{taskId}/merge-result.json` に書き込み、マージ成功時に tasks.json の status を `completed` に更新。

**実装内容:**
- `src/graph/nodes/MergeCoordinatorNode.ts` を更新
- tasks.json から `status === 'reviewed'` のタスクを探す
- review.json を読み込み、status が `approved` のものだけマージ
- マージ結果を `.kugutsu/tasks/{taskId}/merge-result.json` に書き込む
- **重要**: マージ成功時、tasks.json の status を `completed` に更新
- マージ失敗時: `.kugutsu/tasks/{taskId}/conflicts.json` を作成

**影響を受けるファイル:**
- `src/graph/nodes/MergeCoordinatorNode.ts` (UPDATE)

**検証方法:**
```bash
npm run parallel-dev-cli "Complete workflow test"
# merge-result.json が作成されること
cat .kugutsu/tasks/task-001/merge-result.json
# tasks.json の status が "completed" に更新されること
cat .kugutsu/tasks.json | jq '.[] | select(.id == "task-001") | .status'
# Electron UI のタスク表示が "Completed" に更新されること
```

**実装の核心:**
```typescript
// マージ成功の場合
if (mergeResult.status === 'success') {
  // 🚨 重要: tasks.json の status を "completed" に更新
  taskToMerge.status = 'completed';
  taskToMerge.updatedAt = new Date().toISOString();

  const writer = new FileWriter(config.baseRepoPath);
  await writer.writeJSON(tasksPath!, tasks);
}
```

---

### TASK-013: ConflictResolverNode - conflicts.json の読み込み

**優先度:** 🟡 Medium
**複雑度:** High
**依存:** TASK-012
**見積:** 5時間

**目的:**
ConflictResolverNode が `.kugutsu/tasks/{taskId}/conflicts.json` を読み込み、AI にコンフリクト解決を指示。

**実装内容:**
- `src/graph/nodes/ConflictResolverNode.ts` を更新
- conflicts.json を読み込み、`resolution === 'pending'` のものを探す
- AI にコンフリクト解決を指示（worktree で作業）
- 解決後、conflicts.json の `resolution` を `resolved` に更新
- tasks.json の status を `reviewed` に戻して MergeCoordinatorNode に再投入

**影響を受けるファイル:**
- `src/graph/nodes/ConflictResolverNode.ts` (UPDATE)

---

## Phase 5: 統合テストと UI 検証

### TASK-014: MockAIProvider のファイル作成機能（既存）

**優先度:** 🟠 High
**複雑度:** Medium
**依存:** TASK-001, TASK-003
**見積:** 4時間

**目的:**
MockAIProvider が Write ツールを使用してファイル書き込みをシミュレートできるようにする。

**実装内容:**
- `src/providers/MockAIProvider.ts` を更新
- `execute()` メソッド内で、プロンプトに含まれる "出力ファイル" パスを検出
- 指定されたパスにモック応答の内容をファイルとして書き込む
- AI エージェントとして "ファイルを作成しました" という確認メッセージを返す

**影響を受けるファイル:**
- `src/providers/MockAIProvider.ts` (UPDATE)

**検証方法:**
```bash
npm run parallel-dev-cli "Test with mock provider"
# .kugutsu/ 配下にファイルが作成されること
ls -la .kugutsu/
```

**実装の核心:**
```typescript
// src/providers/MockAIProvider.ts
async *execute(
  prompt: string,
  options?: { maxTurns?: number; cwd?: string; allowedTools?: string[] }
): AsyncIterableIterator<AIMessage> {
  // プロンプトからファイルパスを抽出
  const filePathMatch = prompt.match(/\*\*出力ファイル\*\*:\s*(.+)/);

  if (filePathMatch && options?.allowedTools?.includes('Write')) {
    const filePath = filePathMatch[1].trim();

    // モック応答を検索
    const mockResponse = this.getMockResponseForPrompt(prompt);

    if (mockResponse) {
      // ファイルに書き込む
      const content = mockResponse.messages[0].content;
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // JSON か Markdown か判定
      if (filePath.endsWith('.json')) {
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          await fs.writeFile(filePath, jsonMatch[1], 'utf-8');
        }
      } else if (filePath.endsWith('.md')) {
        await fs.writeFile(filePath, content, 'utf-8');
      }

      // ファイル作成確認メッセージを返す
      yield {
        type: 'assistant',
        content: `ファイルを作成しました: ${filePath}`
      };
    }
  }
}
```

---

### TASK-015: Electron UI - ファイル監視の実装

**優先度:** 🟠 High
**複雑度:** Medium
**依存:** TASK-007, TASK-012
**見積:** 4時間

**目的:**
Electron UI が `.kugutsu/tasks.json` をファイル監視して、リアルタイムで進捗状態をタスク一覧に反映できるようにする。

**実装内容:**
- `electron/main/index.ts` にファイル監視機能を追加
- `chokidar` を使用
- `.kugutsu/tasks.json` の変更を監視
- IPC 経由で Renderer プロセスに通知
- Renderer がタスク一覧を更新

**影響を受けるファイル:**
- `electron/main/index.ts` (UPDATE)
- `electron/renderer/hooks/useTasksFileWatcher.ts` (NEW)

**検証方法:**
```bash
npm run electron
# プロジェクトを開く
# parallel-dev-cli を実行
npm run parallel-dev-cli "Test task"
# Electron UI のタスク一覧がリアルタイムで更新されること
```

**実装の核心:**
```typescript
// electron/main/index.ts
import chokidar from 'chokidar';

let tasksWatcher: chokidar.FSWatcher | null = null;

ipcMain.handle('watch-tasks', async (event, projectPath: string) => {
  const tasksPath = path.join(projectPath, '.kugutsu/tasks.json');

  if (tasksWatcher) {
    tasksWatcher.close();
  }

  tasksWatcher = chokidar.watch(tasksPath);

  tasksWatcher.on('change', async () => {
    const content = await fs.readFile(tasksPath, 'utf-8');
    const tasks = JSON.parse(content);
    event.sender.send('tasks-updated', tasks);
  });
});
```

---

### TASK-016: 統合テスト - 全ワークフローの検証

**優先度:** 🟠 High
**複雑度:** High
**依存:** TASK-001 ~ TASK-015
**見積:** 6時間

**目的:**
全ワークフローの統合テストを作成し、すべてのファイルが正しく作成され、状態遷移が正しく行われることを検証。

**実装内容:**
- `tests/integration/file-based-artifact-workflow.test.ts` にテストファイルを作成
- MockAIProvider を使用したエンドツーエンドテスト
- `.kugutsu/` ディレクトリ配下のすべてのファイルが正しく作成されること
- tasks.json の status が正しく遷移すること

**影響を受けるファイル:**
- `tests/integration/file-based-artifact-workflow.test.ts` (NEW)

**検証方法:**
```bash
npm run test:integration
```

**実装の核心:**
```typescript
// tests/integration/file-based-artifact-workflow.test.ts
describe('File-Based Artifact Workflow', () => {
  test('Complete workflow: ProductOwner → Engineer → Review → Merge', async () => {
    // ワークフローを実行
    await orchestrator.start('Implement test feature');

    const reader = new FileReader(testRepoPath);

    // 1. tech-stack.json が作成されること
    expect(await reader.exists('.kugutsu/tech-stack.json')).toBe(true);

    // 2. requirements.json が作成されること
    expect(await reader.exists('.kugutsu/requirements.json')).toBe(true);

    // 3. tasks.json が作成されること
    const tasks = await reader.readJSON<TaskArtifact[]>('.kugutsu/tasks.json');
    expect(tasks.length).toBeGreaterThan(0);

    // 4. instruction.md が作成されること
    const task = tasks[0];
    expect(await reader.exists(`.kugutsu/tasks/${task.id}/instruction.md`)).toBe(true);

    // 5. review.json が作成されること
    expect(await reader.exists(`.kugutsu/tasks/${task.id}/review.json`)).toBe(true);

    // 6. merge-result.json が作成されること
    const mergeResult = await reader.readJSON<MergeResult>(`.kugutsu/tasks/${task.id}/merge-result.json`);
    expect(mergeResult.status).toBe('success');

    // 7. tasks.json の status が "completed" に更新されること
    const updatedTasks = await reader.readJSON<TaskArtifact[]>('.kugutsu/tasks.json');
    const completedTask = updatedTasks.find(t => t.id === task.id);
    expect(completedTask?.status).toBe('completed');
  });
});
```

---

## Phase 6: ドキュメント更新

### TASK-017: ドキュメント更新

**優先度:** 🟡 Medium
**複雑度:** Low
**依存:** TASK-001 ~ TASK-016
**見積:** 3時間

**目的:**
完了した実装ドキュメントを更新し、ファイルベースアーティファクト管理の仕組みを説明。

**実装内容:**
- `README.md` を更新
- `docs/parallel-development-workflow.md` を更新
- `.kugutsu/` ディレクトリ構造の説明
- ファイルパスの扱いについての注意事項

**影響を受けるファイル:**
- `README.md` (UPDATE)
- `docs/parallel-development-workflow.md` (UPDATE)

---

## Phase 7: 最適化と追加機能（Optional）

### TASK-018: ファイル圧縮の最適化

**優先度:** 🟢 Low
**複雑度:** Medium
**依存:** TASK-002
**見積:** 3時間

**目的:**
FileReader に圧縮機能を追加し、ファイル容量を削減する最適化を実施。

---

### TASK-019: 古い worktree の自動クリーンアップ

**優先度:** 🟢 Low
**複雑度:** Medium
**依存:** TASK-012
**見積:** 2時間

**目的:**
マージ後の worktree を自動的にクリーンアップする機能を追加。

---

### TASK-020: エラーハンドリングの強化

**優先度:** 🟡 Medium
**複雑度:** Medium
**依存:** TASK-001 ~ TASK-016
**見積:** 4時間

**目的:**
すべてのノードで統一的なエラーハンドリングを実装し、エラー詳細を `.kugutsu/errors.json` に記録。

---

## リスクと対策

### 技術リスク

1. **AI エージェントの不安定性** (中)
   - AI にファイル書き込みを指示するパターンは不安定な可能性がある
   - プロンプトの工夫でファイルが正しく作成されない可能性がある
   - **対策**: 詳細指示とリトライロジックを実装

2. **MockAIProvider の複雑化** (中)
   - MockAIProvider が実際の AI と同じように動作しない可能性がある
   - **対策**: 実際の AI (Claude) で最終確認を実施

3. **ファイルの破損** (低)
   - 複数のノードが同時にファイルを書き込むと破損する可能性がある
   - **対策**: LangGraph のシーケンシャルな実行を活用

### 運用リスク

1. **Electron UI のファイル監視** (低)
   - ファイル監視が CPU を消費する可能性がある
   - **対策**: debounce/throttle を実装

2. **JSON パースエラー** (中)
   - AI が不正な JSON を返す可能性がある
   - **対策**: JSON Schema 検証を実装

---

## 実装順序

### Phase別の見積

| Phase | タスク数 | 見積時間 | 優先度 |
|-------|---------|---------|-------|
| Phase 1 | 4 | 10h | 🔴 Critical |
| Phase 1.5 | 6 | 36h | 🟠 High |
| Phase 2 | 5 | 22h | 🟠 High / 🟡 Medium |
| Phase 3 | 2 | 11h | 🟠 High |
| Phase 4 | 2 | 11h | 🟠 High / 🟡 Medium |
| Phase 5 | 3 | 14h | 🟠 High |
| Phase 6 | 1 | 3h | 🟡 Medium |
| Phase 7 | 3 | 9h | 🟡 Medium / 🟢 Low |
| **合計** | **26** | **116h** | - |

### 優先度別

- 🔴 **Critical**: 4タスク (10h) - システムの基幹となるタスク
- 🟠 **High**: 15タスク (83h) - 早期実装が望ましいタスク
- 🟡 **Medium**: 5タスク (10h) - 中程度の優先度、後回し可能
- 🟢 **Low**: 2タスク (3h) - 追加機能

---

## 実装の進め方

### Week 1: 基盤整備

**Phase 1** (10時間)
- TASK-001 ~ TASK-004: FileWriter, FileReader, 型定義, State 更新

### Week 2-3: MockProvider 強化

**Phase 1.5** (36時間)
- TASK-014A ~ TASK-014F: MockProvider の強化とテストサポート

### Week 4: 上流ワーク実装

**Phase 2** (22時間)
- TASK-005 ~ TASK-009: ProductOwnerNode, DirectorNode, SprintPlanningNode

### Week 5: 下流ワーク実装

**Phase 3** (11時間)
- TASK-010 ~ TASK-011: EngineerNode, ReviewNode

**Phase 4** (11時間)
- TASK-012 ~ TASK-013: MergeCoordinatorNode, ConflictResolverNode

### Week 6: 統合とテスト

**Phase 5** (14時間)
- TASK-014 ~ TASK-016: MockAIProvider, Electron UI, 統合テスト

**Phase 6** (3時間)
- TASK-017: ドキュメント更新

### 追加機能（Optional）

**Phase 7** (9時間)
- TASK-018 ~ TASK-020: 圧縮最適化, クリーンアップ, エラーハンドリング

---

## 完了条件

### 技術的要件

1. **すべてのファイルが正しく作成される:**
   - `.kugutsu/` ディレクトリ配下にすべての出力が保存される
   - ノードの実装で直接 JSON を返さない

2. **tasks.json の status が正しく遷移:**
   - pending → in_progress → implemented → reviewed → completed
   - Electron UI のタスク一覧が正しく更新される

3. **統合テストがすべて Pass:**
   - ファイルベースワークフローのテストが正しく動作
   - エンドツーエンドのテストが正しく動作

### ビジネス要件

1. **デバッグの容易性:**
   - `.kugutsu/` ディレクトリですべての出力が確認可能
   - 実行中の状態も追跡可能

2. **UI のリアルタイム性:**
   - Electron UI でリアルタイムに状態を確認できる
   - ファイルから情報を取得できる

---

## まとめ

この実装タスクリストに従って作業を進めることで、ファイルベースの AI エージェント間での JSON データ受け渡しを実現するファイルベースアーティファクト管理システムの実装が完了します。

**重要なポイント:**
1. **段階的に実装**: Phase 1 から順に開始
2. **テストを優先**: MockProvider を活用して早期にテスト
3. **ドキュメント維持**: 完了後にドキュメントを更新
4. **リスクを把握**: リスクを早期に特定し対策

この実装により、Kugutsu の AI ファイル永続化システムとして高品質でデバッグ性の高いシステムを提供します。

---

## 次の実施項目

1. **Phase 1 から開始**: TASK-001 (FileWriter) から実装
2. **Phase 1.5**: MockProvider を使ってデバッグ機能を実装
3. **実際のAI での検証**: Claude Code SDK で実際に動作を確認
4. **UIの統合テスト**: Electron UIの動作を確認

**準備ができたら Phase 1 から実装を開始しましょう！**
