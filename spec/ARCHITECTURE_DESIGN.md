# Kugutsu 2.0 Architecture Design Document

**Version:** 2.0.0
**Date:** 2025-11-05
**Status:** Draft

## 目次

1. [概要](#概要)
2. [現状分析](#現状分析)
3. [設計目標](#設計目標)
4. [アーキテクチャ概要](#アーキテクチャ概要)
5. [コンポーネント設計](#コンポーネント設計)
6. [データフロー](#データフロー)
7. [技術スタック](#技術スタック)
8. [移行戦略](#移行戦略)

---

## 概要

Kugutsu 2.0は、LangGraphJSをコアとした完全新規アーキテクチャへの刷新を行います。複数のAIプロバイダー（Claude Agent SDK、OpenAI Codex SDK）をサポートし、マルチエージェント並列開発システムを提供します。

### 主要な変更点

- **Claude Code SDK → Claude Agent SDK + OpenAI Codex SDK**
- **イベント駆動アーキテクチャ → LangGraphJS State管理**
- **カスタムオーケストレーション → LangGraphJS標準ワークフロー**
- **統一AIプロバイダーインターフェース導入**

### 維持する機能

- ✅ Electron UI（リアルタイムログ表示）
- ✅ Git Worktree による並列開発環境
- ✅ 自動コードレビュー
- ✅ コンフリクト解消

---

## 現状分析

### 現在のアーキテクチャ

```
User Request
    ↓
ParallelDevelopmentOrchestrator
    ↓
TaskEventEmitter (イベント駆動)
    ↓
[ProductOwnerAI, EngineerAI, TechLeadAI] ← Claude Code SDK (query)
    ↓
GitWorktreeManager
    ↓
ElectronLogAdapter → Electron UI
```

### 課題

1. **SDKの非推奨化**: Claude Code SDK → Claude Agent SDK への移行必要
2. **カスタムイベントシステム**: LangGraphJSの標準機能で代替可能
3. **プロバイダー固定**: 単一AI SDK に依存
4. **複雑な状態管理**: 複数のキューとイベントで分散

---

## 設計目標

### 機能要件

- [x] Claude Agent SDK と OpenAI Codex SDK の両対応
- [x] グローバル設定によるプロバイダー切り替え
- [x] LangGraphJS による統一ワークフロー管理
- [x] Stateベースのデータフロー
- [x] Electron UIとの統合維持
- [x] Git Worktree機能の完全保持

### 非機能要件

- **拡張性**: 新しいAIプロバイダーを容易に追加可能
- **保守性**: LangGraphJSのベストプラクティスに準拠
- **可視性**: State変更を全てElectron UIで監視可能
- **信頼性**: エラーハンドリングとリトライ機能

---

## アーキテクチャ概要

### レイヤー構成

```
┌─────────────────────────────────────────┐
│         Electron UI Layer               │
│  (リアルタイム監視、ログ表示)              │
└────────────────┬────────────────────────┘
                 │ IPC / WebSocket
┌────────────────▼────────────────────────┐
│      LangGraph Orchestration Layer      │
│  ┌──────────────────────────────────┐   │
│  │   ParallelDevGraph (StateGraph)  │   │
│  │  ├─ ProductOwnerNode             │   │
│  │  ├─ EngineerDispatchNode         │   │
│  │  ├─ [並列] EngineerNode           │   │
│  │  ├─ ReviewNode                   │   │
│  │  ├─ MergeCoordinatorNode         │   │
│  │  └─ ConflictResolverNode         │   │
│  └──────────────────────────────────┘   │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│        AI Provider Abstraction Layer    │
│  ┌──────────────┐  ┌─────────────────┐ │
│  │ Claude Agent │  │ OpenAI Codex    │ │
│  │ Provider     │  │ Provider        │ │
│  └──────────────┘  └─────────────────┘ │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│         Infrastructure Layer            │
│  ├─ GitWorktreeManager                  │
│  ├─ FileSystemUtils                     │
│  └─ ConfigurationManager                │
└─────────────────────────────────────────┘
```

---

## コンポーネント設計

### 1. AI Provider Abstraction Layer

#### 1.1 IAIProvider Interface

**ファイル**: `src/providers/IAIProvider.ts`

```typescript
export interface AIMessage {
  type: 'assistant' | 'user' | 'system' | 'result';
  content: any;
  session_id?: string;
}

export interface ExecuteOptions {
  maxTurns?: number;
  cwd?: string;
  allowedTools?: string[];
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
  resume?: string; // セッションID
}

export interface IAIProvider {
  /**
   * プロンプトを実行し、メッセージストリームを返す
   */
  execute(
    prompt: string,
    options: ExecuteOptions
  ): AsyncIterator<AIMessage>;

  /**
   * セッションを再開する
   */
  resumeSession(sessionId: string): void;

  /**
   * サポートされているツール一覧を取得
   */
  getSupportedTools(): string[];

  /**
   * プロバイダー名を取得
   */
  getProviderName(): string;
}
```

#### 1.2 ClaudeAgentProvider

**ファイル**: `src/providers/ClaudeAgentProvider.ts`

**依存**: `@anthropic-ai/claude-agent-sdk`

```typescript
import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';

export class ClaudeAgentProvider implements IAIProvider {
  private apiKey: string;
  private model: string;

  async *execute(prompt: string, options: ExecuteOptions): AsyncIterator<AIMessage> {
    for await (const message of query({
      prompt,
      options: {
        model: this.model,
        maxTurns: options.maxTurns,
        cwd: options.cwd,
        permissionMode: options.permissionMode,
        allowedTools: options.allowedTools,
        resume: options.resume,
      }
    })) {
      yield this.convertMessage(message);
    }
  }

  private convertMessage(sdkMessage: SDKMessage): AIMessage {
    // SDKMessage → AIMessage 変換
  }

  // ... 他のメソッド実装
}
```

**参考**: [Claude Agent SDK TypeScript Documentation](https://docs.claude.com/en/api/agent-sdk/typescript)

#### 1.3 OpenAICodexProvider

**ファイル**: `src/providers/OpenAICodexProvider.ts`

**依存**: `@openai/codex-sdk`

```typescript
import { Codex } from '@openai/codex-sdk';

export class OpenAICodexProvider implements IAIProvider {
  private codex: Codex;
  private currentThread: any;

  async *execute(prompt: string, options: ExecuteOptions): AsyncIterator<AIMessage> {
    // スレッド管理
    if (options.resume) {
      this.currentThread = this.codex.resumeThread(options.resume);
    } else {
      this.currentThread = this.codex.startThread();
    }

    // プロンプト実行
    const result = await this.currentThread.run(prompt);

    // 結果をストリーム形式で返す
    yield this.convertResult(result);
  }

  private convertResult(result: any): AIMessage {
    // Codex Result → AIMessage 変換
  }

  // ... 他のメソッド実装
}
```

**参考**: [OpenAI Codex SDK Documentation](https://developers.openai.com/codex/sdk/)

#### 1.4 AIProviderFactory

**ファイル**: `src/providers/AIProviderFactory.ts`

```typescript
export class AIProviderFactory {
  static create(config: AIProviderConfig): IAIProvider {
    switch (config.provider) {
      case 'claude':
        return new ClaudeAgentProvider(config.claude);
      case 'codex':
        return new OpenAICodexProvider(config.codex);
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }
}
```

---

### 2. LangGraph State Definition

**ファイル**: `src/graph/state.ts`

```typescript
import { Annotation } from '@langchain/langgraph';

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: number;
  dependencies: string[];
  worktreePath?: string;
  branchName?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedEngineer?: string;
  sessionId?: string;
  isConflictResolution?: boolean;
}

export interface Review {
  taskId: string;
  reviewer: string;
  status: 'approved' | 'changes_requested' | 'pending';
  comments: string[];
  timestamp: Date;
}

export interface MergeTask {
  taskId: string;
  sourceBranch: string;
  targetBranch: string;
  status: 'pending' | 'in_progress' | 'completed' | 'conflict';
  conflictFiles?: string[];
}

export interface WorktreeInfo {
  path: string;
  branch: string;
  taskId: string;
  createdAt: Date;
}

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: string; // ノード名
  message: string;
  data?: any;
}

/**
 * LangGraphJS State定義
 *
 * Reducerパターン:
 * - 配列データ: concat reducer
 * - Mapデータ: merge reducer
 * - 単一値: replace (デフォルト)
 */
export const ParallelDevState = Annotation.Root({
  // 開発要求
  userRequest: Annotation<string>,

  // タスク管理
  tasks: Annotation<Task[]>({
    reducer: (state: Task[], update: Task[]) => {
      // 既存タスクを更新し、新規タスクを追加
      const taskMap = new Map(state.map(t => [t.id, t]));
      update.forEach(t => taskMap.set(t.id, t));
      return Array.from(taskMap.values());
    },
    default: () => []
  }),

  completedTasks: Annotation<Task[]>({
    reducer: (state: Task[], update: Task[]) => state.concat(update),
    default: () => []
  }),

  failedTasks: Annotation<Task[]>({
    reducer: (state: Task[], update: Task[]) => state.concat(update),
    default: () => []
  }),

  // レビュー管理
  reviews: Annotation<Review[]>({
    reducer: (state: Review[], update: Review[]) => state.concat(update),
    default: () => []
  }),

  // マージ管理
  mergeQueue: Annotation<MergeTask[]>({
    reducer: (state: MergeTask[], update: MergeTask[]) => {
      const mergeMap = new Map(state.map(m => [m.taskId, m]));
      update.forEach(m => mergeMap.set(m.taskId, m));
      return Array.from(mergeMap.values());
    },
    default: () => []
  }),

  // Worktree管理
  worktrees: Annotation<Map<string, WorktreeInfo>>({
    reducer: (state: Map<string, WorktreeInfo>, update: Map<string, WorktreeInfo>) => {
      return new Map([...state, ...update]);
    },
    default: () => new Map()
  }),

  // ログ・UI連携
  logs: Annotation<LogEntry[]>({
    reducer: (state: LogEntry[], update: LogEntry[]) => {
      // 最新1000件のみ保持
      const combined = state.concat(update);
      return combined.slice(-1000);
    },
    default: () => []
  }),

  // 設定
  config: Annotation<{
    maxEngineers: number;
    maxTurns: number;
    baseBranch: string;
    baseRepoPath: string;
    worktreeBasePath: string;
  }>
});

export type ParallelDevStateType = typeof ParallelDevState.State;
```

**参考**: [LangGraphJS State and Reducers](https://langchain-ai.github.io/langgraphjs/concepts/low_level/)

---

### 3. Graph Nodes

#### 3.1 ProductOwnerNode

**ファイル**: `src/graph/nodes/ProductOwnerNode.ts`

**責務**:
- ユーザー要求を分析
- 技術スタック検出
- タスク分解
- 依存関係分析

```typescript
import { ParallelDevStateType } from '../state';
import { AIProviderFactory } from '../../providers/AIProviderFactory';

export async function productOwnerNode(
  state: ParallelDevStateType
): Promise<Partial<ParallelDevStateType>> {
  const provider = AIProviderFactory.create(config);

  // 1. 技術スタック分析
  const techStackPrompt = `
    プロジェクトの技術スタックを分析してください。
    リポジトリ: ${state.config.baseRepoPath}
  `;

  const techStackResult = await analyzeTechStack(provider, techStackPrompt);

  // 2. 要件分析
  const requirementsPrompt = `
    以下の開発要求をMECE原則に基づいて分析してください:
    ${state.userRequest}

    技術スタック: ${JSON.stringify(techStackResult)}
  `;

  const requirements = await analyzeRequirements(provider, requirementsPrompt);

  // 3. タスク生成
  const taskGenPrompt = `
    要件を独立して並列実行可能なタスクに分割してください:
    ${JSON.stringify(requirements)}
  `;

  const tasks = await generateTasks(provider, taskGenPrompt);

  // State更新
  return {
    tasks,
    logs: [{
      timestamp: new Date(),
      level: 'info',
      source: 'ProductOwnerNode',
      message: `${tasks.length}個のタスクを生成しました`,
      data: { taskCount: tasks.length }
    }]
  };
}
```

#### 3.2 EngineerDispatchNode

**ファイル**: `src/graph/nodes/EngineerDispatchNode.ts`

**責務**:
- タスクをworktreeに割り当て
- 並列実行可能なタスクをフィルタリング
- 依存関係チェック

```typescript
export async function engineerDispatchNode(
  state: ParallelDevStateType
): Promise<Partial<ParallelDevStateType>> {
  const { tasks, completedTasks, config } = state;

  // 実行可能なタスクを特定
  const completedIds = new Set(completedTasks.map(t => t.id));
  const readyTasks = tasks.filter(task => {
    if (task.status !== 'pending') return false;
    return task.dependencies.every(depId => completedIds.has(depId));
  });

  // 最大エンジニア数に制限
  const tasksToExecute = readyTasks.slice(0, config.maxEngineers);

  // Worktree作成
  const updatedTasks: Task[] = [];
  const newWorktrees = new Map<string, WorktreeInfo>();

  for (const task of tasksToExecute) {
    const branchName = `task/${task.id}`;
    const worktreePath = await gitWorktreeManager.createWorktree(
      config.baseRepoPath,
      config.baseBranch,
      branchName,
      config.worktreeBasePath
    );

    updatedTasks.push({
      ...task,
      status: 'in_progress',
      worktreePath,
      branchName
    });

    newWorktrees.set(task.id, {
      path: worktreePath,
      branch: branchName,
      taskId: task.id,
      createdAt: new Date()
    });
  }

  return {
    tasks: updatedTasks,
    worktrees: newWorktrees,
    logs: [{
      timestamp: new Date(),
      level: 'info',
      source: 'EngineerDispatchNode',
      message: `${updatedTasks.length}個のタスクをディスパッチしました`
    }]
  };
}
```

#### 3.3 EngineerNode

**ファイル**: `src/graph/nodes/EngineerNode.ts`

**責務**:
- コード実装
- セッション管理
- エラーハンドリング

```typescript
export async function engineerNode(
  state: ParallelDevStateType,
  taskId: string // 並列実行のため、タスクIDを受け取る
): Promise<Partial<ParallelDevStateType>> {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || !task.worktreePath) {
    throw new Error(`Task ${taskId} not found or not initialized`);
  }

  const provider = AIProviderFactory.create(config);

  const prompt = `
    以下のタスクを実装してください:

    タスク: ${task.title}
    詳細: ${task.description}

    作業ディレクトリ: ${task.worktreePath}

    要件:
    - テスト駆動開発で進める
    - 適切なコミットメッセージを作成する
    - エラーハンドリングを実装する
  `;

  const messages: AIMessage[] = [];

  try {
    for await (const message of provider.execute(prompt, {
      maxTurns: state.config.maxTurns,
      cwd: task.worktreePath,
      permissionMode: 'acceptEdits',
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      resume: task.sessionId
    })) {
      messages.push(message);

      // セッションID保存
      if (message.session_id) {
        task.sessionId = message.session_id;
      }
    }

    // タスク完了
    const updatedTask: Task = {
      ...task,
      status: 'completed'
    };

    return {
      tasks: [updatedTask],
      completedTasks: [updatedTask],
      logs: [{
        timestamp: new Date(),
        level: 'info',
        source: 'EngineerNode',
        message: `タスク ${task.id} が完了しました`,
        data: { taskId: task.id, messageCount: messages.length }
      }]
    };

  } catch (error) {
    const failedTask: Task = {
      ...task,
      status: 'failed'
    };

    return {
      tasks: [failedTask],
      failedTasks: [failedTask],
      logs: [{
        timestamp: new Date(),
        level: 'error',
        source: 'EngineerNode',
        message: `タスク ${task.id} が失敗しました: ${error.message}`,
        data: { taskId: task.id, error: error.message }
      }]
    };
  }
}
```

#### 3.4 ReviewNode

**ファイル**: `src/graph/nodes/ReviewNode.ts`

```typescript
export async function reviewNode(
  state: ParallelDevStateType,
  taskId: string
): Promise<Partial<ParallelDevStateType>> {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  const provider = AIProviderFactory.create(config);

  const prompt = `
    以下のコードレビューを実施してください:

    タスク: ${task.title}
    ブランチ: ${task.branchName}
    作業ディレクトリ: ${task.worktreePath}

    レビュー観点:
    - コード品質
    - テストカバレッジ
    - セキュリティ
    - パフォーマンス
    - ドキュメント
  `;

  const reviewComments: string[] = [];

  for await (const message of provider.execute(prompt, {
    maxTurns: 10,
    cwd: task.worktreePath,
    allowedTools: ['Read', 'Grep', 'Glob', 'Bash']
  })) {
    if (message.type === 'assistant' && message.content) {
      reviewComments.push(message.content);
    }
  }

  // レビュー結果を判定
  const hasIssues = reviewComments.some(c =>
    c.toLowerCase().includes('issue') ||
    c.toLowerCase().includes('problem')
  );

  const review: Review = {
    taskId: task.id,
    reviewer: 'TechLeadAI',
    status: hasIssues ? 'changes_requested' : 'approved',
    comments: reviewComments,
    timestamp: new Date()
  };

  return {
    reviews: [review],
    logs: [{
      timestamp: new Date(),
      level: 'info',
      source: 'ReviewNode',
      message: `タスク ${task.id} のレビュー完了: ${review.status}`,
      data: { taskId: task.id, reviewStatus: review.status }
    }]
  };
}
```

#### 3.5 MergeCoordinatorNode

**ファイル**: `src/graph/nodes/MergeCoordinatorNode.ts`

```typescript
export async function mergeCoordinatorNode(
  state: ParallelDevStateType
): Promise<Partial<ParallelDevStateType>> {
  const { reviews, tasks, config, mergeQueue } = state;

  // 承認されたタスクを特定
  const approvedReviews = reviews.filter(r => r.status === 'approved');
  const tasksToMerge = tasks.filter(t =>
    t.status === 'completed' &&
    approvedReviews.some(r => r.taskId === t.id) &&
    !mergeQueue.some(m => m.taskId === t.id)
  );

  // マージキューに追加
  const newMergeTasks: MergeTask[] = tasksToMerge.map(task => ({
    taskId: task.id,
    sourceBranch: task.branchName!,
    targetBranch: config.baseBranch,
    status: 'pending'
  }));

  // マージ実行（順次処理）
  const updatedMergeTasks: MergeTask[] = [];
  const logs: LogEntry[] = [];

  for (const mergeTask of newMergeTasks) {
    try {
      await gitWorktreeManager.mergeBranch(
        config.baseRepoPath,
        mergeTask.sourceBranch,
        mergeTask.targetBranch
      );

      updatedMergeTasks.push({
        ...mergeTask,
        status: 'completed'
      });

      logs.push({
        timestamp: new Date(),
        level: 'info',
        source: 'MergeCoordinatorNode',
        message: `タスク ${mergeTask.taskId} のマージ成功`
      });

    } catch (error) {
      if (error.message.includes('conflict')) {
        // コンフリクト検出
        const conflictFiles = await gitWorktreeManager.getConflictFiles(
          config.baseRepoPath
        );

        updatedMergeTasks.push({
          ...mergeTask,
          status: 'conflict',
          conflictFiles
        });

        logs.push({
          timestamp: new Date(),
          level: 'warn',
          source: 'MergeCoordinatorNode',
          message: `タスク ${mergeTask.taskId} でコンフリクト検出`,
          data: { conflictFiles }
        });
      } else {
        throw error;
      }
    }
  }

  return {
    mergeQueue: updatedMergeTasks,
    logs
  };
}
```

#### 3.6 ConflictResolverNode

**ファイル**: `src/graph/nodes/ConflictResolverNode.ts`

```typescript
export async function conflictResolverNode(
  state: ParallelDevStateType
): Promise<Partial<ParallelDevStateType>> {
  const { mergeQueue, tasks } = state;

  // コンフリクトが発生しているマージタスクを取得
  const conflictMergeTasks = mergeQueue.filter(m => m.status === 'conflict');

  if (conflictMergeTasks.length === 0) {
    return {}; // コンフリクトなし
  }

  const provider = AIProviderFactory.create(config);
  const resolvedTasks: Task[] = [];
  const updatedMergeTasks: MergeTask[] = [];
  const logs: LogEntry[] = [];

  for (const mergeTask of conflictMergeTasks) {
    const originalTask = tasks.find(t => t.id === mergeTask.taskId);
    if (!originalTask) continue;

    const prompt = `
      以下のマージコンフリクトを解消してください:

      タスク: ${originalTask.title}
      ブランチ: ${mergeTask.sourceBranch}
      コンフリクトファイル: ${mergeTask.conflictFiles?.join(', ')}

      作業ディレクトリ: ${originalTask.worktreePath}

      要件:
      - 両方の変更内容を理解する
      - 適切に統合する
      - テストが通ることを確認する
    `;

    try {
      for await (const message of provider.execute(prompt, {
        maxTurns: 20,
        cwd: originalTask.worktreePath,
        permissionMode: 'acceptEdits',
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Grep'],
        resume: originalTask.sessionId // 元のセッションを継続
      })) {
        // コンフリクト解消処理
      }

      // 再度マージ試行
      await gitWorktreeManager.mergeBranch(
        state.config.baseRepoPath,
        mergeTask.sourceBranch,
        state.config.baseBranch
      );

      updatedMergeTasks.push({
        ...mergeTask,
        status: 'completed'
      });

      logs.push({
        timestamp: new Date(),
        level: 'info',
        source: 'ConflictResolverNode',
        message: `タスク ${mergeTask.taskId} のコンフリクト解消成功`
      });

    } catch (error) {
      logs.push({
        timestamp: new Date(),
        level: 'error',
        source: 'ConflictResolverNode',
        message: `タスク ${mergeTask.taskId} のコンフリクト解消失敗: ${error.message}`
      });
    }
  }

  return {
    mergeQueue: updatedMergeTasks,
    logs
  };
}
```

---

### 4. Graph Construction

**ファイル**: `src/graph/ParallelDevGraph.ts`

```typescript
import { StateGraph, END, START } from '@langchain/langgraph';
import { ParallelDevState, ParallelDevStateType } from './state';
import { productOwnerNode } from './nodes/ProductOwnerNode';
import { engineerDispatchNode } from './nodes/EngineerDispatchNode';
import { engineerNode } from './nodes/EngineerNode';
import { reviewNode } from './nodes/ReviewNode';
import { mergeCoordinatorNode } from './nodes/MergeCoordinatorNode';
import { conflictResolverNode } from './nodes/ConflictResolverNode';

/**
 * 並列開発ワークフローグラフ
 */
export function createParallelDevGraph() {
  const workflow = new StateGraph(ParallelDevState);

  // ノード追加
  workflow.addNode('product_owner', productOwnerNode);
  workflow.addNode('engineer_dispatch', engineerDispatchNode);
  workflow.addNode('engineer', engineerNode);
  workflow.addNode('review', reviewNode);
  workflow.addNode('merge_coordinator', mergeCoordinatorNode);
  workflow.addNode('conflict_resolver', conflictResolverNode);

  // エッジ定義
  workflow.addEdge(START, 'product_owner');
  workflow.addEdge('product_owner', 'engineer_dispatch');

  // 条件分岐: タスクがあればEngineer、なければ終了
  workflow.addConditionalEdges(
    'engineer_dispatch',
    (state: ParallelDevStateType) => {
      const inProgressTasks = state.tasks.filter(t => t.status === 'in_progress');
      return inProgressTasks.length > 0 ? 'engineer' : 'check_completion';
    },
    {
      engineer: 'engineer',
      check_completion: 'check_completion'
    }
  );

  // Engineer → Review
  workflow.addEdge('engineer', 'review');

  // Review → Merge Coordinator
  workflow.addEdge('review', 'merge_coordinator');

  // Merge Coordinator → Conflict Resolver または Engineer Dispatch
  workflow.addConditionalEdges(
    'merge_coordinator',
    (state: ParallelDevStateType) => {
      const conflicts = state.mergeQueue.filter(m => m.status === 'conflict');
      if (conflicts.length > 0) {
        return 'conflict_resolver';
      }

      const pendingTasks = state.tasks.filter(t => t.status === 'pending');
      return pendingTasks.length > 0 ? 'engineer_dispatch' : 'check_completion';
    },
    {
      conflict_resolver: 'conflict_resolver',
      engineer_dispatch: 'engineer_dispatch',
      check_completion: 'check_completion'
    }
  );

  // Conflict Resolver → Merge Coordinator (再試行)
  workflow.addEdge('conflict_resolver', 'merge_coordinator');

  // 完了チェックノード
  workflow.addNode('check_completion', (state: ParallelDevStateType) => {
    const allCompleted = state.tasks.every(t =>
      t.status === 'completed' || t.status === 'failed'
    );

    return {
      logs: [{
        timestamp: new Date(),
        level: 'info',
        source: 'check_completion',
        message: allCompleted
          ? '全タスク完了'
          : '未完了タスクが残っています'
      }]
    };
  });

  workflow.addConditionalEdges(
    'check_completion',
    (state: ParallelDevStateType) => {
      const allCompleted = state.tasks.every(t =>
        t.status === 'completed' || t.status === 'failed'
      );
      return allCompleted ? END : 'engineer_dispatch';
    },
    {
      [END]: END,
      engineer_dispatch: 'engineer_dispatch'
    }
  );

  return workflow;
}
```

**参考**: [LangGraphJS StateGraph Documentation](https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph.StateGraph.html)

---

## データフロー

### State更新の流れ

```
1. ProductOwnerNode
   Input: { userRequest, config }
   Output: { tasks: [...], logs: [...] }
   Reducer: tasks配列にconcat

2. EngineerDispatchNode
   Input: { tasks, completedTasks, config }
   Output: { tasks: [updated], worktrees: Map(...), logs: [...] }
   Reducer: tasksを更新（statusなど）、worktreesをmerge

3. EngineerNode (並列)
   Input: { tasks, config }
   Output: { tasks: [completed], completedTasks: [...], logs: [...] }
   Reducer: tasksを更新、completedTasksにconcat

4. ReviewNode (並列)
   Input: { tasks, completedTasks }
   Output: { reviews: [...], logs: [...] }
   Reducer: reviewsにconcat

5. MergeCoordinatorNode
   Input: { reviews, tasks, mergeQueue, config }
   Output: { mergeQueue: [...], logs: [...] }
   Reducer: mergeQueueを更新

6. ConflictResolverNode
   Input: { mergeQueue, tasks, config }
   Output: { mergeQueue: [resolved], logs: [...] }
   Reducer: mergeQueueを更新
```

### 並列実行の仕組み

LangGraphJSの`addConditionalEdges`を使用して、Engineer NodeとReview Nodeを並列実行します：

```typescript
// 複数のタスクを並列実行
workflow.addConditionalEdges(
  'engineer_dispatch',
  (state) => {
    const inProgressTasks = state.tasks.filter(t => t.status === 'in_progress');
    return inProgressTasks.map(t => ({ nodeId: 'engineer', taskId: t.id }));
  }
);
```

---

## 技術スタック

### 依存パッケージ

```json
{
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^1.0.0",
    "@openai/codex-sdk": "^1.0.0",
    "@langchain/langgraph": "^0.2.0",
    "electron": "^32.0.0",
    "typescript": "^5.6.0"
  }
}
```

### 開発ツール

- TypeScript 5.6+
- Node.js 18+
- Electron 32+

---

## 移行戦略

### フェーズ1: 基盤構築 (1-2週間)

1. ✅ パッケージインストール
2. ✅ AIプロバイダーインターフェース実装
3. ✅ State定義
4. ✅ 基本的なGraphノード実装

### フェーズ2: コア機能実装 (2-3週間)

5. ✅ 全ノードの実装
6. ✅ Graph構築とエッジ定義
7. ✅ GitWorktreeManager統合
8. ✅ エラーハンドリング

### フェーズ3: UI統合 (1-2週間)

9. ✅ Electron UIアダプター作成
10. ✅ State変更のストリーミング
11. ✅ ログ表示システム統合

### フェーズ4: テスト・最適化 (1-2週間)

12. ✅ 統合テスト
13. ✅ パフォーマンス最適化
14. ✅ ドキュメント更新

### フェーズ5: 移行完了

15. ✅ 既存コード削除
16. ✅ リリース

---

## リスクと対策

| リスク | 影響度 | 対策 |
|--------|--------|------|
| LangGraphJS学習曲線 | 中 | 公式ドキュメント・サンプル活用 |
| AIプロバイダーAPI変更 | 高 | インターフェース層で吸収 |
| 並列実行の複雑性 | 中 | LangGraphJSの機能に依存 |
| Electron統合の互換性 | 低 | ストリーミングAPIで対応 |

---

## 参考資料

- [Claude Agent SDK Documentation](https://docs.claude.com/en/api/agent-sdk/overview)
- [OpenAI Codex SDK Documentation](https://developers.openai.com/codex/sdk/)
- [LangGraphJS Documentation](https://langchain-ai.github.io/langgraphjs/)
- [LangGraphJS Multi-Agent Concepts](https://langchain-ai.github.io/langgraphjs/concepts/multi_agent/)
