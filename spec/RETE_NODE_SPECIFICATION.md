# Rete.js ノード仕様書

## ドキュメント情報

- **作成日**: 2025-11-26
- **バージョン**: 1.0.0
- **対象**: Kugutsu Rete.js ワークフローエディタ

## 1. 概要

本ドキュメントは、Rete.jsワークフローエディタで使用されるすべてのノードタイプの仕様を定義します。

### 1.1 ノード階層

```
BaseWorkflowNode (抽象基底)
│
├── AITaskNode (AI実行ノード)
│   ├── CustomAINode (完全カスタム)
│   └── PresetAINode (プリセット)
│       ├── EngineerNode
│       ├── ReviewerNode
│       ├── ProductOwnerNode
│       ├── MergeCoordinatorNode
│       ├── ConflictResolverNode
│       ├── DirectorNode
│       ├── SprintPlanningNode
│       └── TestRunnerNode
│
├── ControlFlowNode (制御フローノード)
│   ├── ParallelNode (並列実行)
│   ├── AggregatorNode (結果集約)
│   ├── DecisionNode (条件分岐)
│   ├── LoopNode (反復処理)
│   └── GroupNode (サブグラフ並列化)
│
├── GitOperationNode (Git操作ノード)
│   ├── MergeNode
│   ├── ConflictResolverNode
│   └── BranchManagerNode
│
└── IONode (入出力ノード)
    ├── StartNode
    ├── EndNode
    └── DataTransformNode
```

---

## 2. BaseWorkflowNode（基底ノード）

### 2.1 インターフェース定義

```typescript
/**
 * すべてのワークフローノードの基底インターフェース
 */
interface BaseWorkflowNode {
  /** ノードの一意識別子 */
  id: string;

  /** ノードタイプ */
  type: NodeType;

  /** 表示名 */
  label: string;

  /** 説明文（オプション） */
  description?: string;

  /** 入力ソケット定義 */
  inputs: NodeSocket[];

  /** 出力ソケット定義 */
  outputs: NodeSocket[];

  /** ノード設定 */
  config: NodeConfig;

  /** バリデーション */
  validate(): ValidationResult;

  /** ノード実行 */
  execute(context: ExecutionContext): Promise<NodeResult>;

  /** JSON形式へのシリアライズ */
  toJSON(): WorkflowNodeJSON;

  /** JSONからのデシリアライズ */
  fromJSON(json: WorkflowNodeJSON): BaseWorkflowNode;
}
```

### 2.2 NodeSocket（入出力ソケット）

```typescript
interface NodeSocket {
  /** ソケットID */
  id: string;

  /** ソケット名 */
  name: string;

  /** ソケットタイプ */
  type: SocketType; // 'data' | 'control' | 'any'

  /** データタイプ（オプション） */
  dataType?: DataType; // 'string' | 'object' | 'array' | 'number' | 'boolean'

  /** 必須かどうか */
  required: boolean;

  /** デフォルト値（オプション） */
  defaultValue?: any;

  /** バリデーションルール（オプション） */
  validation?: ValidationRule;
}

type SocketType = 'data' | 'control' | 'any';

type DataType = 'string' | 'object' | 'array' | 'number' | 'boolean' | 'any';

interface ValidationRule {
  /** 最小値（数値の場合） */
  min?: number;

  /** 最大値（数値の場合） */
  max?: number;

  /** 正規表現パターン（文字列の場合） */
  pattern?: string;

  /** カスタムバリデーション関数 */
  custom?: (value: any) => boolean;
}
```

### 2.3 NodeConfig（ノード設定）

```typescript
interface NodeConfig {
  /** AI実行設定 */
  ai?: AIConfig;

  /** 並列実行設定 */
  parallelism?: ParallelismConfig;

  /** タイムアウト（ミリ秒） */
  timeout?: number;

  /** リトライポリシー */
  retryPolicy?: RetryPolicy;

  /** カスタム設定（拡張可能） */
  [key: string]: any;
}

interface AIConfig {
  /** AIプロバイダー */
  provider: 'claude' | 'openai' | 'gemini' | 'auto';

  /** モデル名 */
  model?: string;

  /** プロンプト */
  prompt?: string;

  /** システムプロンプト */
  systemPrompt?: string;

  /** 最大ターン数 */
  maxTurns?: number;

  /** 許可するツール */
  allowedTools?: string[];

  /** 温度パラメータ */
  temperature?: number;

  /** top_p パラメータ */
  topP?: number;
}

interface ParallelismConfig {
  /** 並列実行を有効化 */
  enabled: boolean;

  /** 最大並列数 */
  maxConcurrency?: number;

  /** Git Worktreeを使用 */
  useWorktree?: boolean;

  /** Worktreeブランチプレフィックス */
  branchPrefix?: string;

  /** 実行後にWorktreeをクリーンアップ */
  cleanupAfter?: boolean;
}

interface RetryPolicy {
  /** 最大リトライ回数 */
  maxRetries: number;

  /** リトライ間隔（ミリ秒） */
  retryDelay: number;

  /** 指数バックオフを使用 */
  exponentialBackoff?: boolean;
}
```

### 2.4 ExecutionContext（実行コンテキスト）

```typescript
interface ExecutionContext {
  /** 入力データ */
  inputs: Record<string, any>;

  /** グローバルコンテキスト */
  global: GlobalContext;

  /** サービス */
  services: Services;

  /** ユーティリティ */
  utils: Utils;
}

interface GlobalContext {
  /** ワークフローID */
  workflowId: string;

  /** 実行ID */
  executionId: string;

  /** プロジェクトパス */
  projectPath: string;

  /** ベースブランチ */
  baseBranch: string;

  /** 実行開始時刻 */
  startedAt: Date;

  /** ユーザー設定 */
  userSettings: Record<string, any>;
}

interface Services {
  /** AIプロバイダー */
  aiProvider: IAIProvider;

  /** Git Worktree管理 */
  gitManager: GitWorktreeManager;

  /** ステート配信 */
  stateManager: StateStreamManager;

  /** データ永続化 */
  dataPersistence: DataPersistence;
}

interface Utils {
  /** ロガー */
  logger: Logger;

  /** イベント発行 */
  emit: (event: string, data: any) => void;

  /** メモリ監視 */
  memoryMonitor: MemoryMonitor;
}
```

### 2.5 NodeResult（ノード実行結果）

```typescript
interface NodeResult {
  /** 成功/失敗 */
  success: boolean;

  /** 出力データ */
  outputs: Record<string, any>;

  /** エラー（失敗時） */
  error?: Error;

  /** メタデータ */
  metadata?: ResultMetadata;
}

interface ResultMetadata {
  /** 実行時間（ミリ秒） */
  duration: number;

  /** AI呼び出し回数 */
  aiCalls?: number;

  /** 使用トークン数 */
  tokensUsed?: number;

  /** カスタムメタデータ */
  [key: string]: any;
}
```

---

## 3. IONode（入出力ノード）

### 3.1 StartNode（開始ノード）

**説明**: ワークフローの開始点

```typescript
class StartNode extends IONode {
  type: 'io:start';
  label: 'Start';

  inputs: []; // 入力なし

  outputs: [
    {
      id: 'default',
      name: 'Output',
      type: 'control',
      required: true
    }
  ];

  config: {};

  async execute(context: ExecutionContext): Promise<NodeResult> {
    return {
      success: true,
      outputs: {
        default: context.inputs // 初期入力をそのまま出力
      }
    };
  }
}
```

**Rete.js表示**:
- 色: 緑 (#10b981)
- アイコン: ▶️
- 接続: 出力のみ

### 3.2 EndNode（終了ノード）

**説明**: ワークフローの終了点

```typescript
class EndNode extends IONode {
  type: 'io:end';
  label: 'End';

  inputs: [
    {
      id: 'default',
      name: 'Input',
      type: 'any',
      required: true
    }
  ];

  outputs: []; // 出力なし

  config: {
    /** 終了時のアクション */
    onComplete?: {
      /** ワークフロー結果を保存 */
      saveResult?: boolean;

      /** 通知を送信 */
      notify?: boolean;
    };
  };

  async execute(context: ExecutionContext): Promise<NodeResult> {
    const finalResult = context.inputs.default;

    if (this.config.onComplete?.saveResult) {
      await context.services.dataPersistence.saveWorkflowResult(
        context.global.executionId,
        finalResult
      );
    }

    return {
      success: true,
      outputs: {},
      metadata: {
        finalResult: finalResult
      }
    };
  }
}
```

**Rete.js表示**:
- 色: 赤 (#ef4444)
- アイコン: ⏹️
- 接続: 入力のみ

### 3.3 DataTransformNode（データ変換ノード）

**説明**: 入力データを変換して出力

```typescript
class DataTransformNode extends IONode {
  type: 'io:transform';
  label: 'Data Transform';

  inputs: [
    {
      id: 'input',
      name: 'Input',
      type: 'data',
      dataType: 'any',
      required: true
    }
  ];

  outputs: [
    {
      id: 'output',
      name: 'Output',
      type: 'data',
      dataType: 'any',
      required: true
    }
  ];

  config: {
    /** 変換タイプ */
    transformType: 'map' | 'filter' | 'reduce' | 'custom';

    /** カスタム変換関数（JavaScript） */
    transformFunction?: string;
  };

  async execute(context: ExecutionContext): Promise<NodeResult> {
    const input = context.inputs.input;

    let output;
    switch (this.config.transformType) {
      case 'custom':
        // ユーザー定義の変換関数を実行
        const fn = new Function('input', this.config.transformFunction);
        output = fn(input);
        break;
      // 他のケース...
    }

    return {
      success: true,
      outputs: {
        output: output
      }
    };
  }
}
```

**Rete.js表示**:
- 色: 灰色 (#6b7280)
- アイコン: 🔄

---

## 4. ControlFlowNode（制御フローノード）

### 4.1 DecisionNode（条件分岐ノード）

**説明**: 条件に基づいて分岐

```typescript
class DecisionNode extends ControlFlowNode {
  type: 'control:decision';
  label: 'Decision';

  inputs: [
    {
      id: 'input',
      name: 'Input',
      type: 'any',
      required: true
    }
  ];

  outputs: [
    {
      id: 'true',
      name: 'True',
      type: 'control',
      required: false
    },
    {
      id: 'false',
      name: 'False',
      type: 'control',
      required: false
    }
  ];

  config: {
    /** 条件式（JavaScript） */
    condition: string;
  };

  async execute(context: ExecutionContext): Promise<NodeResult> {
    const input = context.inputs.input;

    // 条件評価
    const fn = new Function('input', `return ${this.config.condition}`);
    const result = fn(input);

    return {
      success: true,
      outputs: {
        [result ? 'true' : 'false']: input
      }
    };
  }
}
```

**Rete.js表示**:
- 色: 黄色 (#eab308)
- アイコン: ◆
- 接続: 入力1つ、出力2つ（True/False）

### 4.2 ParallelNode（並列実行ノード）

**説明**: 1つのノードを複数の入力で並列実行

```typescript
class ParallelNode extends ControlFlowNode {
  type: 'control:parallel';
  label: 'Parallel';

  inputs: [
    {
      id: 'input',
      name: 'Input Array',
      type: 'data',
      dataType: 'array',
      required: true
    }
  ];

  outputs: [
    {
      id: 'output',
      name: 'Results',
      type: 'data',
      dataType: 'array',
      required: true
    }
  ];

  config: {
    /** 並列実行するノードのID */
    targetNodeId: string;

    /** 並列実行設定 */
    parallelism: ParallelismConfig;
  };

  async execute(context: ExecutionContext): Promise<NodeResult> {
    const inputArray = context.inputs.input;

    if (!Array.isArray(inputArray)) {
      throw new Error('Input must be an array');
    }

    // LangGraph Send APIを使用して並列ディスパッチ
    const sends = inputArray.map((item, index) => {
      return new Send(this.config.targetNodeId, {
        input: item,
        index: index,
        worktree: this.config.parallelism.useWorktree
          ? `${this.config.parallelism.branchPrefix}-${index}`
          : null
      });
    });

    // Send APIの返却（LangGraphが並列実行を処理）
    return {
      success: true,
      outputs: {},
      metadata: {
        dispatched: sends.length
      }
    };
  }
}
```

**Rete.js表示**:
- 色: 紫 (#8b5cf6)
- アイコン: ⫸
- 接続: 入力配列、出力配列

### 4.3 AggregatorNode（集約ノード）

**説明**: 複数の並列実行結果を集約

```typescript
class AggregatorNode extends ControlFlowNode {
  type: 'control:aggregator';
  label: 'Aggregator';

  inputs: [
    {
      id: 'input',
      name: 'Parallel Results',
      type: 'data',
      dataType: 'any',
      required: true
    }
  ];

  outputs: [
    {
      id: 'output',
      name: 'Aggregated Result',
      type: 'data',
      dataType: 'array',
      required: true
    }
  ];

  config: {
    /** 集約戦略 */
    strategy: 'array' | 'merge' | 'custom';

    /** カスタム集約関数 */
    aggregateFunction?: string;
  };

  async execute(context: ExecutionContext): Promise<NodeResult> {
    const inputs = context.inputs.input;

    let result;
    switch (this.config.strategy) {
      case 'array':
        // 配列として集約
        result = Array.isArray(inputs) ? inputs : [inputs];
        break;

      case 'merge':
        // オブジェクトをマージ
        result = Array.isArray(inputs)
          ? Object.assign({}, ...inputs)
          : inputs;
        break;

      case 'custom':
        // カスタム集約関数
        const fn = new Function('inputs', this.config.aggregateFunction);
        result = fn(inputs);
        break;
    }

    return {
      success: true,
      outputs: {
        output: result
      }
    };
  }
}
```

**Rete.js表示**:
- 色: オレンジ (#f59e0b)
- アイコン: ⫷
- 接続: 複数入力、単一出力

### 4.4 GroupNode（グループノード - サブグラフ並列化）

**説明**: サブグラフ全体を並列実行

```typescript
class GroupNode extends ControlFlowNode {
  type: 'control:group';
  label: 'Parallel Group';

  inputs: [
    {
      id: 'input',
      name: 'Input Array',
      type: 'data',
      dataType: 'array',
      required: true
    }
  ];

  outputs: [
    {
      id: 'output',
      name: 'Group Results',
      type: 'data',
      dataType: 'array',
      required: true
    }
  ];

  config: {
    /** サブグラフ定義 */
    subgraph: {
      nodes: WorkflowNodeJSON[];
      connections: ConnectionJSON[];
    };

    /** 並列実行設定 */
    parallelExecution: {
      enabled: boolean;
      inputArray: string;
      maxConcurrency?: number;
    };

    /** Worktree設定 */
    worktreeConfig: {
      useWorktree: boolean;
      branchPrefix: string;
      cleanupAfter: boolean;
    };
  };

  async execute(context: ExecutionContext): Promise<NodeResult> {
    const inputArray = context.inputs.input;

    if (this.config.parallelExecution.enabled) {
      // 並列実行
      const results = await Promise.all(
        inputArray.map(async (item, index) => {
          // Worktree作成
          const worktree = this.config.worktreeConfig.useWorktree
            ? await context.services.gitManager.createWorktree({
                branchName: `${this.config.worktreeConfig.branchPrefix}-${index}`,
                baseBranch: context.global.baseBranch
              })
            : null;

          // サブグラフを実行
          const result = await this.executeSubgraph(
            item,
            worktree,
            context
          );

          // Worktreeクリーンアップ
          if (worktree && this.config.worktreeConfig.cleanupAfter) {
            await context.services.gitManager.removeWorktree(worktree.path);
          }

          return result;
        })
      );

      return {
        success: true,
        outputs: {
          output: results
        }
      };
    } else {
      // 逐次実行
      const results = [];
      for (const item of inputArray) {
        const result = await this.executeSubgraph(item, null, context);
        results.push(result);
      }

      return {
        success: true,
        outputs: {
          output: results
        }
      };
    }
  }

  private async executeSubgraph(
    input: any,
    worktree: WorktreeInfo | null,
    context: ExecutionContext
  ): Promise<any> {
    // WorkflowTransformerでサブグラフをLangGraphに変換
    const subgraph = WorkflowTransformer.transformSubgraph(
      this.config.subgraph
    );

    // サブグラフを実行
    const result = await subgraph.invoke(
      { input: input },
      {
        ...context.global,
        projectPath: worktree?.path || context.global.projectPath
      }
    );

    return result;
  }
}
```

**Rete.js表示**:
- 色: 紫 (#8b5cf6)
- アイコン: ⫸⫸
- 接続: 入力配列、出力配列
- 特殊表示: グループ内のノードを枠線で囲む

### 4.5 LoopNode（ループノード）

**説明**: 条件を満たすまで反復処理

```typescript
class LoopNode extends ControlFlowNode {
  type: 'control:loop';
  label: 'Loop';

  inputs: [
    {
      id: 'input',
      name: 'Initial Value',
      type: 'any',
      required: true
    }
  ];

  outputs: [
    {
      id: 'output',
      name: 'Final Value',
      type: 'any',
      required: true
    }
  ];

  config: {
    /** 最大反復回数 */
    maxIterations: number;

    /** 終了条件（JavaScript） */
    breakCondition: string;

    /** ループ本体のノードID */
    bodyNodeId: string;
  };

  async execute(context: ExecutionContext): Promise<NodeResult> {
    let currentValue = context.inputs.input;
    let iteration = 0;

    while (iteration < this.config.maxIterations) {
      // 終了条件評価
      const fn = new Function('value', `return ${this.config.breakCondition}`);
      if (fn(currentValue)) {
        break;
      }

      // ループ本体を実行
      // （実装詳細省略）

      iteration++;
    }

    return {
      success: true,
      outputs: {
        output: currentValue
      },
      metadata: {
        iterations: iteration
      }
    };
  }
}
```

**Rete.js表示**:
- 色: 青緑 (#14b8a6)
- アイコン: 🔁

---

## 5. AITaskNode（AI実行ノード）

### 5.1 CustomAINode（カスタムAIノード）

**説明**: ユーザーが完全にカスタマイズ可能なAIノード

```typescript
class CustomAINode extends AITaskNode {
  type: 'ai:custom';
  label: 'Custom AI Task';

  inputs: [
    {
      id: 'input',
      name: 'Input',
      type: 'data',
      dataType: 'any',
      required: true
    }
  ];

  outputs: [
    {
      id: 'output',
      name: 'Output',
      type: 'data',
      dataType: 'any',
      required: true
    }
  ];

  config: {
    ai: AIConfig;
    parallelism?: ParallelismConfig;
  };

  async execute(context: ExecutionContext): Promise<NodeResult> {
    const input = context.inputs.input;

    // プロンプト構築
    const prompt = this.buildPrompt(input);

    // AI実行
    const result = await context.services.aiProvider.query({
      prompt: prompt,
      options: {
        model: this.config.ai.model,
        systemPrompt: this.config.ai.systemPrompt,
        maxTurns: this.config.ai.maxTurns,
        allowedTools: this.config.ai.allowedTools,
        temperature: this.config.ai.temperature,
        topP: this.config.ai.topP
      }
    });

    return {
      success: true,
      outputs: {
        output: result.finalState
      },
      metadata: {
        duration: result.duration,
        aiCalls: result.turns,
        tokensUsed: result.tokensUsed
      }
    };
  }

  private buildPrompt(input: any): string {
    // プロンプトテンプレートに入力を埋め込み
    let prompt = this.config.ai.prompt || '';

    // {{input}}などのプレースホルダーを置換
    prompt = prompt.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return input[key] !== undefined ? input[key] : match;
    });

    return prompt;
  }
}
```

**Rete.js表示**:
- 色: 水色 (#06b6d4)
- アイコン: 🤖
- カスタマイズ: プロンプト、AI設定を完全に編集可能

---

## 6. PresetAINode（プリセットAIノード）

### 6.1 EngineerNode（エンジニアノード）

**説明**: コード実装タスクを実行するAIエンジニア

```typescript
class EngineerNode extends PresetAINode {
  type: 'preset:engineer';
  label: 'AI Engineer';
  description: 'AI駆動のコード実装タスク';

  inputs: [
    {
      id: 'task',
      name: 'Task Description',
      type: 'data',
      dataType: 'string',
      required: true
    },
    {
      id: 'context',
      name: 'Additional Context',
      type: 'data',
      dataType: 'object',
      required: false
    }
  ];

  outputs: [
    {
      id: 'code',
      name: 'Generated Code',
      type: 'data',
      dataType: 'object'
    },
    {
      id: 'changes',
      name: 'File Changes',
      type: 'data',
      dataType: 'array'
    }
  ];

  config: {
    ai: {
      provider: 'claude',
      model: 'claude-sonnet-4-5-20250929',
      systemPrompt: `You are an expert software engineer implementing code based on task descriptions.
Follow best practices, write clean code, and ensure proper error handling.
Use TDD principles: write tests first, then implement.`,
      maxTurns: 30,
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']
    },
    parallelism: {
      enabled: true,
      useWorktree: true,
      branchPrefix: 'engineer',
      cleanupAfter: false
    }
  };

  async execute(context: ExecutionContext): Promise<NodeResult> {
    const task = context.inputs.task;
    const additionalContext = context.inputs.context || {};

    const prompt = `Implement the following task:

${task}

${additionalContext.requirements ? `Requirements:\n${additionalContext.requirements}` : ''}

Follow TDD principles: write tests first, then implement.`;

    const result = await context.services.aiProvider.query({
      prompt: prompt,
      options: {
        model: this.config.ai.model,
        systemPrompt: this.config.ai.systemPrompt,
        maxTurns: this.config.ai.maxTurns,
        allowedTools: this.config.ai.allowedTools
      }
    });

    return {
      success: true,
      outputs: {
        code: result.finalState,
        changes: result.fileChanges || []
      },
      metadata: {
        duration: result.duration,
        aiCalls: result.turns
      }
    };
  }
}
```

**Rete.js表示**:
- 色: 青 (#3b82f6)
- アイコン: 👨‍💻

### 6.2 ReviewerNode（レビュアーノード）

**説明**: コードレビューを実行するAIレビュアー

```typescript
class ReviewerNode extends PresetAINode {
  type: 'preset:reviewer';
  label: 'AI Reviewer';
  description: 'AI駆動のコードレビュー';

  inputs: [
    {
      id: 'code',
      name: 'Code to Review',
      type: 'data',
      dataType: 'object',
      required: true
    },
    {
      id: 'changes',
      name: 'File Changes',
      type: 'data',
      dataType: 'array',
      required: true
    }
  ];

  outputs: [
    {
      id: 'result',
      name: 'Review Result',
      type: 'data',
      dataType: 'object'
    },
    {
      id: 'approved',
      name: 'Approved',
      type: 'data',
      dataType: 'boolean'
    }
  ];

  config: {
    ai: {
      provider: 'claude',
      model: 'claude-sonnet-4-5-20250929',
      systemPrompt: `You are an expert code reviewer.
Review the code for:
- Code quality and best practices
- Security vulnerabilities
- Performance issues
- Test coverage
Provide constructive feedback.`,
      maxTurns: 20,
      allowedTools: ['Read', 'Grep', 'Bash']
    }
  };

  async execute(context: ExecutionContext): Promise<NodeResult> {
    const changes = context.inputs.changes;

    const prompt = `Review the following code changes:

${JSON.stringify(changes, null, 2)}

Provide a detailed review covering:
1. Code quality
2. Security
3. Performance
4. Test coverage

Conclude with APPROVED or NEEDS_CHANGES.`;

    const result = await context.services.aiProvider.query({
      prompt: prompt,
      options: {
        model: this.config.ai.model,
        systemPrompt: this.config.ai.systemPrompt,
        maxTurns: this.config.ai.maxTurns,
        allowedTools: this.config.ai.allowedTools
      }
    });

    const approved = result.finalState.includes('APPROVED');

    return {
      success: true,
      outputs: {
        result: result.finalState,
        approved: approved
      },
      metadata: {
        duration: result.duration,
        aiCalls: result.turns
      }
    };
  }
}
```

**Rete.js表示**:
- 色: 緑 (#10b981)
- アイコン: ✅

### 6.3 ProductOwnerNode（プロダクトオーナーノード）

**説明**: 要件分析とタスク分解

```typescript
class ProductOwnerNode extends PresetAINode {
  type: 'preset:product-owner';
  label: 'Product Owner';
  description: '要件分析とタスク分解';

  inputs: [
    {
      id: 'requirement',
      name: 'User Requirement',
      type: 'data',
      dataType: 'string',
      required: true
    }
  ];

  outputs: [
    {
      id: 'tasks',
      name: 'Task List',
      type: 'data',
      dataType: 'array'
    }
  ];

  config: {
    ai: {
      provider: 'claude',
      model: 'claude-sonnet-4-5-20250929',
      systemPrompt: `You are a Product Owner analyzing requirements and breaking them into tasks.
Create independent, testable tasks that can be parallelized.`,
      maxTurns: 20,
      allowedTools: ['Read', 'Glob', 'Grep']
    }
  };

  async execute(context: ExecutionContext): Promise<NodeResult> {
    const requirement = context.inputs.requirement;

    const prompt = `Analyze the following requirement and break it into independent tasks:

${requirement}

Output a JSON array of tasks:
[
  {
    "title": "Task title",
    "description": "Detailed description",
    "priority": "high|medium|low",
    "estimatedTime": "hours"
  }
]`;

    const result = await context.services.aiProvider.query({
      prompt: prompt,
      options: {
        model: this.config.ai.model,
        systemPrompt: this.config.ai.systemPrompt,
        maxTurns: this.config.ai.maxTurns,
        allowedTools: this.config.ai.allowedTools
      }
    });

    const tasks = JSON.parse(result.finalState);

    return {
      success: true,
      outputs: {
        tasks: tasks
      },
      metadata: {
        duration: result.duration,
        aiCalls: result.turns
      }
    };
  }
}
```

**Rete.js表示**:
- 色: 紫 (#a855f7)
- アイコン: 📋

### 6.4 その他のプリセットノード

以下のプリセットノードも同様に実装:

| ノードタイプ | 説明 | アイコン |
|------------|------|---------|
| **MergeCoordinatorNode** | マージ調整 | 🔀 |
| **ConflictResolverNode** | コンフリクト解決 | ⚔️ |
| **TestRunnerNode** | テスト実行 | 🧪 |
| **DirectorNode** | ストーリーマッピング | 🎬 |
| **SprintPlanningNode** | スプリント計画 | 📅 |

---

## 7. GitOperationNode（Git操作ノード）

### 7.1 MergeNode（マージノード）

```typescript
class MergeNode extends GitOperationNode {
  type: 'git:merge';
  label: 'Merge';

  inputs: [
    {
      id: 'branch',
      name: 'Source Branch',
      type: 'data',
      dataType: 'string',
      required: true
    }
  ];

  outputs: [
    {
      id: 'result',
      name: 'Merge Result',
      type: 'data',
      dataType: 'object'
    },
    {
      id: 'hasConflict',
      name: 'Has Conflict',
      type: 'data',
      dataType: 'boolean'
    }
  ];

  config: {
    targetBranch: string;
    strategy: 'merge' | 'rebase';
  };

  async execute(context: ExecutionContext): Promise<NodeResult> {
    const sourceBranch = context.inputs.branch;

    const result = await context.services.gitManager.merge({
      source: sourceBranch,
      target: this.config.targetBranch,
      strategy: this.config.strategy
    });

    return {
      success: !result.hasConflict,
      outputs: {
        result: result,
        hasConflict: result.hasConflict
      }
    };
  }
}
```

**Rete.js表示**:
- 色: 灰色 (#6b7280)
- アイコン: 🔀

---

## 8. ノードのカスタマイズ方法

### 8.1 カスタムノード作成手順

1. **ノードクラスの作成**
```typescript
class MyCustomNode extends AITaskNode {
  type: 'custom:my-node';
  label: 'My Custom Node';
  // ...
}
```

2. **NodeFactoryへの登録**
```typescript
NodeFactory.register('custom:my-node', MyCustomNode);
```

3. **ノードテンプレートの保存**
```bash
.kugutsu/node-templates/my-custom-node.json
```

4. **Rete.jsパレットへの追加**
- UIから自動的にパレットに追加される

### 8.2 カスタムノードテンプレートフォーマット

```json
{
  "version": "1.0.0",
  "nodeType": "custom:my-node",
  "metadata": {
    "name": "My Custom Node",
    "description": "カスタムノードの説明",
    "author": "user@example.com",
    "createdAt": "2025-11-26T00:00:00Z"
  },
  "inputs": [
    {
      "id": "input1",
      "name": "Input 1",
      "type": "data",
      "dataType": "string",
      "required": true
    }
  ],
  "outputs": [
    {
      "id": "output1",
      "name": "Output 1",
      "type": "data",
      "dataType": "object"
    }
  ],
  "config": {
    "ai": {
      "provider": "claude",
      "model": "claude-sonnet-4-5-20250929",
      "prompt": "カスタムプロンプト: {{input1}}",
      "systemPrompt": "カスタムシステムプロンプト",
      "maxTurns": 30,
      "allowedTools": ["Read", "Write"]
    }
  }
}
```

---

## 9. ノード実装のベストプラクティス

### 9.1 バリデーション

すべてのノードは`validate()`を実装すべき:

```typescript
validate(): ValidationResult {
  const errors: string[] = [];

  // 必須入力チェック
  this.inputs.forEach(input => {
    if (input.required && !this.hasInput(input.id)) {
      errors.push(`Required input '${input.name}' is missing`);
    }
  });

  // 設定の妥当性チェック
  if (this.config.ai?.maxTurns && this.config.ai.maxTurns < 1) {
    errors.push('maxTurns must be >= 1');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}
```

### 9.2 エラーハンドリング

```typescript
async execute(context: ExecutionContext): Promise<NodeResult> {
  try {
    // 実装ロジック
    const result = await this.performTask(context);

    return {
      success: true,
      outputs: result
    };
  } catch (error) {
    context.utils.logger.error(`Node ${this.id} failed:`, error);

    return {
      success: false,
      outputs: {},
      error: error as Error
    };
  }
}
```

### 9.3 リトライロジック

```typescript
async executeWithRetry(context: ExecutionContext): Promise<NodeResult> {
  const maxRetries = this.config.retryPolicy?.maxRetries || 0;
  const retryDelay = this.config.retryPolicy?.retryDelay || 1000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await this.execute(context);
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      await sleep(retryDelay * (attempt + 1));
    }
  }
}
```

---

**このノード仕様書は、Rete.jsワークフローエディタで使用されるすべてのノードの実装ガイドラインです。**
