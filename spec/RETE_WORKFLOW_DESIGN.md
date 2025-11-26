# Rete.js ビジュアルワークフローエディタ - システム設計書

## ドキュメント情報

- **作成日**: 2025-11-26
- **バージョン**: 1.0.0
- **ステータス**: 設計フェーズ

## 1. 概要

### 1.1 プロジェクトの目的

KugutsuをComfyUIやDifyのようなビジュアルノードベースのAIワークフローエディタに進化させる。ユーザーがドラッグ&ドロップでノードを配置・接続し、Claude Agent SDK、OpenAI Codex SDK、Gemini AI SDKを活用した複雑なワークフローを視覚的に構築できるようにする。

### 1.2 主要な変更点

| 現在 | 新システム |
|------|-----------|
| 固定的なスクラムワークフロー | ユーザー定義可能なワークフロー |
| コードベースでのワークフロー定義 | ビジュアルエディタでの構築 |
| Kanban UIでのタスク管理 | Rete.jsノードエディタ |
| 限定的なカスタマイズ | 完全なノードカスタマイズ |

### 1.3 設計目標

1. **柔軟性**: あらゆるAI開発ワークフローを構築可能
2. **並列性**: サブグラフ全体の並列実行をサポート
3. **拡張性**: カスタムノードを簡単に追加可能
4. **再利用性**: 既存のAIProvider、GitWorktreeManagerを最大限活用
5. **直感性**: ComfyUI的な直感的UI/UX

## 2. アーキテクチャ概要

### 2.1 システムアーキテクチャ図

```
┌─────────────────────────────────────────────────────────────┐
│                      Electron Application                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │          Rete.js Editor UI (React)                 │     │
│  │  ┌──────────────┐  ┌──────────────────────────┐   │     │
│  │  │ Node Palette │  │   Canvas (rete-area)     │   │     │
│  │  │              │  │  ┌────┐   ┌────┐         │   │     │
│  │  │ - AI Task    │  │  │Node│───│Node│         │   │     │
│  │  │ - Parallel   │  │  └────┘   └────┘         │   │     │
│  │  │ - Decision   │  │     │        │            │   │     │
│  │  │ - Git Ops    │  │  ┌─▼────────▼──┐         │   │     │
│  │  └──────────────┘  │  │  Aggregator │         │   │     │
│  │                     │  └─────────────┘         │   │     │
│  │  ┌──────────────┐  └──────────────────────────┘   │     │
│  │  │  Properties  │                                  │     │
│  │  │    Panel     │                                  │     │
│  │  └──────────────┘                                  │     │
│  └────────────────────────────────────────────────────┘     │
│                          │                                    │
│                          │ workflow.json                     │
│                          ▼                                    │
│  ┌────────────────────────────────────────────────────┐     │
│  │         WorkflowTransformer (新規)                 │     │
│  │  - Rete.js JSON → LangGraph StateGraph変換         │     │
│  │  - ノードマッピング定義                             │     │
│  │  - 並列サブグラフの展開                             │     │
│  └────────────────────────────────────────────────────┘     │
│                          │                                    │
│                          │ StateGraph                        │
│                          ▼                                    │
│  ┌────────────────────────────────────────────────────┐     │
│  │      LangGraph Execution Engine (既存改修)         │     │
│  │  ┌──────────────────────────────────────────┐     │     │
│  │  │  Dynamic Node Dispatch (Send API)        │     │     │
│  │  │  - 並列ノード実行                         │     │     │
│  │  │  - サブグラフ並列化                       │     │     │
│  │  └──────────────────────────────────────────┘     │     │
│  └────────────────────────────────────────────────────┘     │
│               │                        │                      │
│               │ AI Provider Call       │ Git Operations       │
│               ▼                        ▼                      │
│  ┌──────────────────┐    ┌──────────────────────────┐       │
│  │  AIProviderFactory│    │  GitWorktreeManager      │       │
│  │  - Claude         │    │  - 並列worktree作成       │       │
│  │  - OpenAI Codex   │    │  - ブランチ管理          │       │
│  │  - Gemini         │    │  - マージ調整            │       │
│  └──────────────────┘    └──────────────────────────┘       │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │         StateStreamManager (既存)                  │     │
│  │  - リアルタイムステート配信 (IPC)                  │     │
│  │  - ノード実行状態の可視化                          │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 データフロー

```
[ユーザー操作]
    ↓ ノード配置・接続
[Rete.js Editor]
    ↓ ワークフロー定義
[workflow.json]
    {
      "nodes": [...],
      "connections": [...],
      "groups": [...]  // 並列サブグラフ
    }
    ↓ 変換
[WorkflowTransformer]
    ↓ StateGraph生成
[LangGraph]
    ↓ 動的ディスパッチ
[Send API] ━━ 並列実行 ━━> [GitWorktree 1]
           ━━ 並列実行 ━━> [GitWorktree 2]
           ━━ 並列実行 ━━> [GitWorktree N]
    ↓ 結果集約
[Aggregator Node]
    ↓ 次のノードへ
[続きのワークフロー]
```

## 3. ノードシステムの再設計

### 3.1 ノード階層構造

```
BaseWorkflowNode (抽象基底)
    │
    ├── AITaskNode (AI実行ノード)
    │   ├── CustomAINode (完全カスタム)
    │   └── PresetAINode (プリセット)
    │       ├── EngineerNode
    │       ├── ReviewerNode
    │       ├── ProductOwnerNode
    │       └── ...
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

### 3.2 BaseWorkflowNode インターフェース

```typescript
interface BaseWorkflowNode {
  // 基本プロパティ
  id: string;
  type: NodeType;
  label: string;
  description?: string;

  // 入出力定義
  inputs: NodeSocket[];
  outputs: NodeSocket[];

  // 実行設定
  config: NodeConfig;

  // ライフサイクル
  validate(): ValidationResult;
  execute(context: ExecutionContext): Promise<NodeResult>;

  // シリアライゼーション
  toJSON(): WorkflowNodeJSON;
  fromJSON(json: WorkflowNodeJSON): BaseWorkflowNode;
}

interface NodeSocket {
  id: string;
  name: string;
  type: SocketType; // 'data' | 'control' | 'any'
  dataType?: string; // 'string' | 'object' | 'array' | ...
  required: boolean;
}

interface NodeConfig {
  // AI実行設定
  aiProvider?: 'claude' | 'openai' | 'gemini';
  model?: string;
  prompt?: string;
  systemPrompt?: string;
  maxTurns?: number;

  // 並列実行設定
  parallelism?: {
    enabled: boolean;
    maxConcurrency?: number;
    useWorktree?: boolean;
  };

  // その他設定
  timeout?: number;
  retryPolicy?: RetryPolicy;
  [key: string]: any; // 拡張可能
}

interface ExecutionContext {
  // 入力データ
  inputs: Record<string, any>;

  // グローバルコンテキスト
  workflowId: string;
  executionId: string;
  projectPath: string;

  // サービス
  aiProvider: IAIProvider;
  gitManager: GitWorktreeManager;
  stateManager: StateStreamManager;

  // ユーティリティ
  logger: Logger;
  emit: (event: string, data: any) => void;
}

interface NodeResult {
  success: boolean;
  outputs: Record<string, any>;
  error?: Error;
  metadata?: {
    duration: number;
    aiCalls: number;
    tokensUsed?: number;
  };
}
```

### 3.3 プリセットノードの定義例

```typescript
class EngineerNode extends PresetAINode {
  constructor() {
    super({
      type: 'preset:engineer',
      label: 'AI Engineer',
      description: 'AI駆動のコード実装タスク',

      inputs: [
        { id: 'task', name: 'Task Description', type: 'data', dataType: 'string', required: true },
        { id: 'context', name: 'Context', type: 'data', dataType: 'object', required: false }
      ],

      outputs: [
        { id: 'code', name: 'Generated Code', type: 'data', dataType: 'object' },
        { id: 'changes', name: 'File Changes', type: 'data', dataType: 'array' }
      ],

      config: {
        aiProvider: 'claude',
        model: 'claude-sonnet-4-5-20250929',
        systemPrompt: 'You are an expert software engineer...',
        maxTurns: 30,
        parallelism: {
          enabled: true,
          useWorktree: true
        }
      }
    });
  }

  async execute(context: ExecutionContext): Promise<NodeResult> {
    const task = context.inputs.task;
    const additionalContext = context.inputs.context || {};

    // AIProviderを使って実装
    const result = await context.aiProvider.query({
      prompt: `Implement the following task:\n\n${task}`,
      options: {
        maxTurns: this.config.maxTurns,
        allowedTools: ['Read', 'Write', 'Edit', 'Bash']
      }
    });

    return {
      success: true,
      outputs: {
        code: result.finalState,
        changes: result.fileChanges
      },
      metadata: {
        duration: result.duration,
        aiCalls: result.turns
      }
    };
  }
}
```

## 4. 並列サブグラフの実装

### 4.1 並列化の種類

#### 4.1.1 単一ノードの並列実行 (ParallelNode)

```
         ┌──────────────┐
         │ ParallelNode │
         └──────┬───────┘
                │ [task1, task2, task3]
         ┌──────┴────────┬──────────┐
         │               │          │
    ┌────▼────┐    ┌────▼────┐ ┌──▼──────┐
    │ Engineer│    │ Engineer│ │ Engineer│
    │ (WT-1)  │    │ (WT-2)  │ │ (WT-3)  │
    └────┬────┘    └────┬────┘ └────┬────┘
         │               │           │
         └───────┬───────┴───────────┘
                 │
         ┌───────▼────────┐
         │  Aggregator    │
         └────────────────┘
```

**実装方式:**
- LangGraphのSend APIを使用
- 各タスクごとに独立したgit worktreeを作成
- 並列実行後、Aggregatorノードで結果を集約

#### 4.1.2 サブグラフの並列実行 (GroupNode)

```
         ┌──────────────┐
         │  GroupNode   │
         │  (Parallel)  │
         └──────┬───────┘
                │ [feature1, feature2]
         ┌──────┴──────────────┐
         │                     │
    ┌────▼──────────────┐ ┌───▼──────────────┐
    │  Subgraph 1       │ │  Subgraph 2      │
    │  (WT-feature1)    │ │  (WT-feature2)   │
    │  ┌──────────┐     │ │  ┌──────────┐    │
    │  │ Engineer │     │ │  │ Engineer │    │
    │  └────┬─────┘     │ │  └────┬─────┘    │
    │  ┌────▼─────┐     │ │  ┌────▼─────┐    │
    │  │ Review   │     │ │  │ Review   │    │
    │  └────┬─────┘     │ │  └────┬─────┘    │
    │  ┌────▼─────┐     │ │  ┌────▼─────┐    │
    │  │ Test     │     │ │  │ Test     │    │
    │  └──────────┘     │ │  └──────────┘    │
    └────┬──────────────┘ └───┬──────────────┘
         │                    │
         └──────┬─────────────┘
                │
         ┌──────▼────────┐
         │  Aggregator   │
         └───────────────┘
```

**実装方式:**
- Rete.jsでノードをグループ化
- グループ全体を1つのサブグラフとして扱う
- 各サブグラフを独立したworktreeで実行
- Send APIで動的に複数のサブグラフインスタンスを起動

### 4.2 GroupNode仕様

```typescript
interface GroupNodeConfig extends NodeConfig {
  // グループ内のノード定義
  subgraph: {
    nodes: WorkflowNodeJSON[];
    connections: ConnectionJSON[];
  };

  // 並列実行設定
  parallelExecution: {
    enabled: boolean;
    inputArray: string; // 入力配列のキー名
    maxConcurrency?: number;
  };

  // Worktree設定
  worktreeConfig: {
    useWorktree: boolean;
    branchPrefix: string;
    cleanupAfter: boolean;
  };
}

class GroupNode extends ControlFlowNode {
  async execute(context: ExecutionContext): Promise<NodeResult> {
    const inputArray = context.inputs[this.config.parallelExecution.inputArray];

    if (this.config.parallelExecution.enabled) {
      // 並列実行
      const results = await Promise.all(
        inputArray.map(async (item, index) => {
          // Worktree作成
          const worktree = await context.gitManager.createWorktree({
            branchName: `${this.config.worktreeConfig.branchPrefix}-${index}`,
            baseBranch: 'main'
          });

          // サブグラフを実行
          const subgraphResult = await this.executeSubgraph(
            item,
            worktree,
            context
          );

          return subgraphResult;
        })
      );

      return {
        success: true,
        outputs: {
          results: results
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
          results: results
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
        projectPath: worktree?.path || context.projectPath
      }
    );

    return result;
  }
}
```

### 4.3 LangGraph統合

```typescript
class WorkflowTransformer {
  /**
   * Rete.js workflowをLangGraph StateGraphに変換
   */
  static transformToLangGraph(
    workflow: ReteWorkflowJSON
  ): StateGraph {
    const graph = new StateGraph(WorkflowState);

    // ノードの追加
    for (const node of workflow.nodes) {
      const nodeInstance = NodeFactory.createNode(node);

      if (node.type === 'parallel' || node.type === 'group') {
        // 並列ノードの場合、Send APIを使用
        graph.addNode(node.id, async (state) => {
          const results = await nodeInstance.execute({
            inputs: state,
            // ... context
          });

          // 動的にサブタスクをディスパッチ
          const sends = results.subtasks.map(task =>
            new Send(nodeInstance.targetNodeId, task)
          );

          return sends;
        });
      } else {
        // 通常ノード
        graph.addNode(node.id, async (state) => {
          return await nodeInstance.execute({
            inputs: state,
            // ... context
          });
        });
      }
    }

    // エッジの追加
    for (const connection of workflow.connections) {
      if (connection.condition) {
        // 条件分岐
        graph.addConditionalEdges(
          connection.source,
          (state) => evaluateCondition(connection.condition, state),
          {
            true: connection.target,
            false: connection.alternateTarget
          }
        );
      } else {
        // 通常のエッジ
        graph.addEdge(connection.source, connection.target);
      }
    }

    // 集約ノード（Fan-in）の設定
    for (const node of workflow.nodes) {
      if (node.type === 'aggregator') {
        // すべての入力が揃うまで待機
        graph.addNode(node.id, async (state) => {
          // LangGraphのreducerで自動的に集約される
          return state;
        });
      }
    }

    graph.setEntryPoint(workflow.entryNodeId);
    graph.setFinishPoint(workflow.exitNodeId);

    return graph.compile();
  }
}
```

## 5. Rete.js統合設計

### 5.1 必要なパッケージ

```json
{
  "dependencies": {
    "rete": "^2.0.3",
    "rete-react-plugin": "^2.0.3",
    "rete-area-plugin": "^2.0.3",
    "rete-connection-plugin": "^2.0.2",
    "rete-render-utils": "^2.0.1",
    "rete-engine": "^2.0.1",
    "styled-components": "^6.1.8"
  }
}
```

### 5.2 Rete.jsエディタコンポーネント

```typescript
// electron/renderer/components/ReteEditor/ReteWorkflowEditor.tsx

import { NodeEditor } from "rete";
import { ReactPlugin, Presets } from "rete-react-plugin";
import { AreaPlugin } from "rete-area-plugin";
import { ConnectionPlugin } from "rete-connection-plugin";

export class ReteWorkflowEditor {
  private editor: NodeEditor<Schemes>;
  private area: AreaPlugin<Schemes, AreaExtra>;

  async initialize(container: HTMLElement) {
    // エディタの作成
    this.editor = new NodeEditor<Schemes>();

    // エリアプラグインの設定
    this.area = new AreaPlugin<Schemes, AreaExtra>(container);

    // 接続プラグインの設定
    const connection = new ConnectionPlugin<Schemes, AreaExtra>();

    // Reactレンダラーの設定
    const render = new ReactPlugin<Schemes, AreaExtra>({ createRoot });
    render.addPreset(Presets.classic.setup());

    // プラグインの適用
    this.editor.use(this.area);
    this.area.use(connection);
    this.area.use(render);

    // カスタムノードの登録
    await this.registerCustomNodes();
  }

  private async registerCustomNodes() {
    // EngineerNodeの登録
    const engineerNode = new CustomReteNode('engineer', {
      label: 'AI Engineer',
      inputs: [{ name: 'task', type: 'string' }],
      outputs: [{ name: 'code', type: 'object' }]
    });

    await this.editor.addNode(engineerNode);

    // 他のノードも同様に登録...
  }

  exportWorkflow(): ReteWorkflowJSON {
    return {
      nodes: this.editor.getNodes().map(n => n.toJSON()),
      connections: this.editor.getConnections().map(c => c.toJSON())
    };
  }

  importWorkflow(workflow: ReteWorkflowJSON) {
    // ワークフローの読み込み
    for (const nodeData of workflow.nodes) {
      const node = NodeFactory.createReteNode(nodeData);
      this.editor.addNode(node);
    }

    for (const connData of workflow.connections) {
      const source = this.editor.getNode(connData.source);
      const target = this.editor.getNode(connData.target);
      // 接続を作成
    }
  }
}
```

### 5.3 カスタムノードUI

```typescript
// electron/renderer/components/ReteEditor/CustomNodeComponent.tsx

import styled from 'styled-components';

const NodeContainer = styled.div<{ nodeType: string }>`
  background: ${props => getNodeColor(props.nodeType)};
  border-radius: 8px;
  padding: 12px;
  min-width: 200px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }
`;

const NodeHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-weight: 600;
`;

const NodeIcon = styled.span`
  font-size: 20px;
`;

export function CustomNodeComponent({ data }: { data: NodeData }) {
  return (
    <NodeContainer nodeType={data.type}>
      <NodeHeader>
        <NodeIcon>{getNodeIcon(data.type)}</NodeIcon>
        <span>{data.label}</span>
      </NodeHeader>

      <div className="inputs">
        {data.inputs.map(input => (
          <Socket key={input.id} type="input" socket={input} />
        ))}
      </div>

      <div className="outputs">
        {data.outputs.map(output => (
          <Socket key={output.id} type="output" socket={output} />
        ))}
      </div>

      {data.description && (
        <div className="description">{data.description}</div>
      )}
    </NodeContainer>
  );
}

function getNodeColor(type: string): string {
  const colors = {
    'ai-task': '#3b82f6',      // 青
    'parallel': '#8b5cf6',     // 紫
    'aggregator': '#f59e0b',   // オレンジ
    'decision': '#eab308',     // 黄
    'git-operation': '#6b7280', // 灰
    'start': '#10b981',        // 緑
    'end': '#ef4444'           // 赤
  };
  return colors[type] || '#6b7280';
}

function getNodeIcon(type: string): string {
  const icons = {
    'ai-task': '🤖',
    'parallel': '⫸',
    'aggregator': '⫷',
    'decision': '◆',
    'git-operation': '📦',
    'start': '▶️',
    'end': '⏹️'
  };
  return icons[type] || '📄';
}
```

## 6. データ永続化

### 6.1 ワークフロー保存形式

```json
{
  "version": "1.0.0",
  "metadata": {
    "name": "AI Development Workflow",
    "description": "並列開発ワークフロー",
    "author": "user@example.com",
    "createdAt": "2025-11-26T00:00:00Z",
    "updatedAt": "2025-11-26T00:00:00Z",
    "tags": ["development", "parallel"]
  },
  "nodes": [
    {
      "id": "start-1",
      "type": "start",
      "label": "Start",
      "position": { "x": 100, "y": 100 },
      "config": {}
    },
    {
      "id": "engineer-1",
      "type": "preset:engineer",
      "label": "Feature Implementation",
      "position": { "x": 300, "y": 100 },
      "config": {
        "aiProvider": "claude",
        "model": "claude-sonnet-4-5-20250929",
        "prompt": "Implement the feature based on the task description",
        "maxTurns": 30,
        "parallelism": {
          "enabled": true,
          "useWorktree": true
        }
      }
    },
    {
      "id": "group-1",
      "type": "group",
      "label": "Parallel Features",
      "position": { "x": 500, "y": 100 },
      "config": {
        "subgraph": {
          "nodes": [...],
          "connections": [...]
        },
        "parallelExecution": {
          "enabled": true,
          "inputArray": "features",
          "maxConcurrency": 3
        },
        "worktreeConfig": {
          "useWorktree": true,
          "branchPrefix": "feature",
          "cleanupAfter": true
        }
      }
    }
  ],
  "connections": [
    {
      "id": "conn-1",
      "source": "start-1",
      "sourceOutput": "default",
      "target": "engineer-1",
      "targetInput": "task"
    }
  ],
  "groups": [
    {
      "id": "group-parallel-features",
      "nodeIds": ["engineer-2", "engineer-3", "engineer-4"]
    }
  ]
}
```

### 6.2 保存場所

```
.kugutsu/
├── workflows/
│   ├── default.json           # デフォルトワークフロー
│   ├── scrum-preset.json      # スクラムプリセット
│   └── custom/                # ユーザー作成ワークフロー
│       ├── my-workflow-1.json
│       └── my-workflow-2.json
├── node-templates/            # カスタムノードテンプレート
│   ├── my-custom-node.json
│   └── ...
└── executions/                # 実行履歴
    ├── 2025-11-26_workflow-1/
    │   ├── execution-log.json
    │   └── state-snapshots/
    └── ...
```

## 7. 既存コードの活用

### 7.1 再利用可能なコンポーネント

| コンポーネント | 利用方法 | 変更の必要性 |
|--------------|---------|-------------|
| **AIProviderFactory** | そのまま利用 | なし |
| **GitWorktreeManager** | そのまま利用 | なし |
| **StateStreamManager** | ノード実行状態の配信に利用 | 軽微な拡張 |
| **DataPersistence** | ワークフロー保存に利用 | なし |
| **LogFormatter** | そのまま利用 | なし |
| **MemoryMonitor** | そのまま利用 | なし |

### 7.2 改修が必要なコンポーネント

| コンポーネント | 改修内容 |
|--------------|---------|
| **ParallelDevGraph** | ワークフロー定義を動的生成に変更 |
| **各種Nodeクラス** | BaseWorkflowNodeを継承して再実装 |
| **ElectronUI** | Rete.jsエディタタブの追加 |

### 7.3 新規実装コンポーネント

| コンポーネント | 説明 |
|--------------|------|
| **WorkflowTransformer** | Rete→LangGraph変換 |
| **ReteWorkflowEditor** | Rete.jsエディタReactコンポーネント |
| **NodeFactory** | ノードインスタンス生成 |
| **GroupNode** | サブグラフ並列化ノード |
| **WorkflowStateManager** | ワークフロー状態管理（Zustand） |

## 8. UI/UX設計

### 8.1 レイアウト

```
┌─────────────────────────────────────────────────────────┐
│ Toolbar: [File] [Edit] [View] [Workflow] [Help]        │
├─────────────────────────────────────────────────────────┤
│ Header: Project Info | [Run Workflow] [Stop] [Save]    │
├───────────┬─────────────────────────────────┬───────────┤
│           │                                 │           │
│  Node     │       Canvas Area               │ Property  │
│  Palette  │  ┌────┐         ┌────┐         │  Panel    │
│           │  │Node│─────────│Node│         │           │
│  🤖 AI    │  └────┘         └────┘         │  ┌──────┐ │
│  Task     │    │               │            │  │Name  │ │
│           │  ┌─▼───────────────▼─┐         │  ├──────┤ │
│  ⫸ Parallel│  │   Aggregator    │         │  │Type  │ │
│           │  └─────────────────┘         │  ├──────┤ │
│  ◆ Decision│                               │  │Config│ │
│           │  [Zoom: 100%] [Pan]           │  └──────┘ │
│  📦 Git   │                                 │           │
│  Ops      │                                 │           │
│           │                                 │           │
├───────────┴─────────────────────────────────┴───────────┤
│ Log Viewer: [Info] [Warning] [Error]                   │
│ > Workflow execution started...                         │
│ > Node 'engineer-1' executing...                        │
└─────────────────────────────────────────────────────────┘
```

### 8.2 インタラクション

1. **ノード追加**: パレットからドラッグ&ドロップ
2. **接続**: 出力ソケットをドラッグして入力ソケットに接続
3. **設定編集**: ノードをクリックでプロパティパネル表示
4. **グループ化**: 複数ノード選択 → 右クリック → "Group for Parallel Execution"
5. **実行**: ツールバーの"Run Workflow"ボタン
6. **リアルタイム表示**: 実行中のノードをハイライト、ログビューアに進捗表示

## 9. ノード間データ連携設計

### 9.1 設計原則

ノード間のデータ連携は、**State（軽量メッセージ）** と **ファイルシステム（成果物）** の2層で行う。

```
┌──────────────────────────────────────────────────────────────────┐
│                    ノード間データ連携アーキテクチャ                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│   State層（軽量）                    ファイル層（成果物）              │
│   ┌────────────────────┐           ┌────────────────────────┐    │
│   │ • プロンプト        │           │ • 仕様書               │    │
│   │ • 参照先パス        │           │ • ソースコード          │    │
│   │ • メタデータ        │           │ • テスト結果           │    │
│   │ • 実行状態         │           │ • レビューコメント       │    │
│   └────────────────────┘           └────────────────────────────┘    │
│            │                                    │                   │
│            │     ノード実行時の流れ              │                   │
│            ▼                                    ▼                   │
│   ┌─────────────────────────────────────────────────────────┐     │
│   │                    ノード実行                             │     │
│   │  1. Stateからプロンプト/参照先を取得                      │     │
│   │  2. 参照先のファイルを読み込み                            │     │
│   │  3. AIが作業を実行（ファイル作成/編集）                    │     │
│   │  4. 成果物をファイルシステムに保存                        │     │
│   │  5. 次ノードへのプロンプト/参照先をStateに設定            │     │
│   └─────────────────────────────────────────────────────────┘     │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 9.2 State層の設計

State層は軽量なメッセージングに使用し、大きなデータは含めない。

```typescript
/**
 * ノード間で受け渡すStateの構造
 */
interface NodeState {
  /** 次のノードへのプロンプト/指示 */
  prompt: string;

  /** 参照すべきファイルパス（プロジェクトルートからの相対パス） */
  references?: {
    /** ファイルパス */
    path: string;
    /** ファイルの種類（仕様書、コード、テスト結果など） */
    type: 'spec' | 'code' | 'test-result' | 'review' | 'other';
    /** 説明 */
    description?: string;
  }[];

  /** メタデータ */
  metadata?: {
    /** 前のノードID */
    previousNodeId: string;
    /** 処理の成功/失敗 */
    success: boolean;
    /** 追加情報 */
    [key: string]: unknown;
  };
}
```

### 9.3 ファイル層の設計

成果物はプロジェクト内のファイルとして保存する。

```
project/
├── .kugutsu/
│   └── workflow-artifacts/          # ワークフロー成果物
│       └── {execution-id}/          # 実行ID別
│           ├── specs/               # 仕様書
│           │   ├── requirements.md
│           │   └── design.md
│           ├── reviews/             # レビュー結果
│           │   └── code-review.md
│           └── reports/             # レポート
│               └── test-report.md
├── src/                             # 実際のソースコード
├── tests/                           # テストコード
└── docs/                            # ドキュメント
```

### 9.4 ノード実行フローの例

#### 例1: ProductOwnerNode → EngineerNode

```
┌─────────────────────────────────────────────────────────────────┐
│                      ProductOwnerNode                            │
├─────────────────────────────────────────────────────────────────┤
│  入力State:                                                      │
│    prompt: "ユーザー認証機能を実装してください"                    │
│                                                                   │
│  実行内容:                                                        │
│    1. 要件を分析                                                 │
│    2. 仕様書を作成                                               │
│    3. ファイルに保存:                                            │
│       → .kugutsu/workflow-artifacts/{exec-id}/specs/auth.md     │
│                                                                   │
│  出力State:                                                      │
│    prompt: "仕様書に基づいて認証機能を実装してください"            │
│    references: [{                                                │
│      path: ".kugutsu/workflow-artifacts/{exec-id}/specs/auth.md",│
│      type: "spec",                                               │
│      description: "認証機能の仕様書"                              │
│    }]                                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        EngineerNode                              │
├─────────────────────────────────────────────────────────────────┤
│  入力State:                                                      │
│    prompt: "仕様書に基づいて認証機能を実装してください"            │
│    references: [{ path: "...specs/auth.md", type: "spec" }]     │
│                                                                   │
│  実行内容:                                                        │
│    1. 参照ファイル（仕様書）を読み込み                            │
│    2. AIが仕様書を理解                                           │
│    3. コードを実装: src/auth/...                                 │
│    4. テストを作成: tests/auth/...                               │
│                                                                   │
│  出力State:                                                      │
│    prompt: "実装したコードをレビューしてください"                   │
│    references: [                                                 │
│      { path: "src/auth/", type: "code" },                       │
│      { path: "tests/auth/", type: "code" }                      │
│    ]                                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        ReviewerNode                              │
├─────────────────────────────────────────────────────────────────┤
│  入力State:                                                      │
│    prompt: "実装したコードをレビューしてください"                   │
│    references: [                                                 │
│      { path: "src/auth/", type: "code" },                       │
│      { path: "tests/auth/", type: "code" }                      │
│    ]                                                             │
│                                                                   │
│  実行内容:                                                        │
│    1. 参照ファイル（コード）を読み込み                            │
│    2. AIがコードレビューを実施                                    │
│    3. レビュー結果を保存:                                        │
│       → .kugutsu/workflow-artifacts/{exec-id}/reviews/auth.md   │
│    4. 必要に応じてコードを修正                                    │
│                                                                   │
│  出力State:                                                      │
│    prompt: "レビューが完了しました"                               │
│    references: [{ path: "...reviews/auth.md", type: "review" }] │
│    metadata: { approved: true }                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 9.5 NodeState インターフェースの実装

```typescript
// src/workflow/types.ts に追加

/**
 * ノード間で受け渡す参照情報
 */
export interface FileReference {
  /** ファイルパス（プロジェクトルートからの相対パス） */
  path: string;
  /** ファイルの種類 */
  type: 'spec' | 'code' | 'test-result' | 'review' | 'config' | 'other';
  /** 説明 */
  description?: string;
}

/**
 * ノード間で受け渡すState
 */
export interface NodeState {
  /** 次のノードへのプロンプト/指示 */
  prompt: string;
  /** 参照すべきファイル */
  references?: FileReference[];
  /** メタデータ */
  metadata?: {
    previousNodeId?: string;
    success?: boolean;
    [key: string]: unknown;
  };
}

/**
 * ExecutionContextの拡張（ノード実行時に利用）
 */
export interface ExecutionContext {
  // 既存のフィールド
  inputs: Record<string, unknown>;
  global: GlobalContext;
  services: Services;
  utils: Utils;

  // ノード間連携用の追加フィールド
  /** 入力として受け取ったNodeState */
  nodeState: NodeState;
  /** 成果物保存用のベースパス */
  artifactsBasePath: string;
}

/**
 * NodeResultの拡張（ノード実行結果）
 */
export interface NodeResult {
  success: boolean;
  outputs: Record<string, unknown>;
  error?: Error;
  metadata?: ResultMetadata;

  // ノード間連携用の追加フィールド
  /** 次のノードに渡すState */
  nextNodeState?: NodeState;
}
```

### 9.6 AITaskNodeでの実装例

```typescript
class EngineerNode extends AITaskNode {
  async execute(context: ExecutionContext): Promise<NodeResult> {
    const { nodeState, artifactsBasePath } = context;

    // 1. 参照ファイルの内容をプロンプトに含める
    let contextInfo = '';
    if (nodeState.references) {
      for (const ref of nodeState.references) {
        const content = await this.readFile(
          path.join(context.global.projectPath, ref.path)
        );
        contextInfo += `\n\n## ${ref.description || ref.path}\n\`\`\`\n${content}\n\`\`\``;
      }
    }

    // 2. AIに実装を依頼
    const result = await context.services.aiProvider.query({
      prompt: `${nodeState.prompt}\n\n### 参考資料${contextInfo}`,
      options: {
        maxTurns: this.config.ai?.maxTurns || 30,
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']
      }
    });

    // 3. 実装されたファイルのパスを収集
    const implementedFiles: FileReference[] = result.fileChanges?.map(change => ({
      path: change.path,
      type: 'code' as const,
      description: `Implemented: ${change.path}`
    })) || [];

    // 4. 次のノードへのStateを作成
    return {
      success: true,
      outputs: {
        code: result.finalState,
        changes: result.fileChanges
      },
      nextNodeState: {
        prompt: 'レビューしてください。問題があれば修正してください。',
        references: implementedFiles,
        metadata: {
          previousNodeId: this.id,
          success: true,
          implementedAt: new Date().toISOString()
        }
      }
    };
  }
}
```

### 9.7 設計上の利点

1. **State層の軽量化**
   - 大きなデータ（ソースコード、仕様書など）をStateに含めない
   - メモリ効率が良い
   - シリアライズ/デシリアライズが高速

2. **成果物の永続化**
   - すべての成果物がファイルとして残る
   - 実行後も確認可能
   - バージョン管理可能（Git）

3. **AIの柔軟性**
   - AIが必要なファイルを自由に読み書きできる
   - 参照情報により、どのファイルを見るべきか明確
   - プロンプトで意図を伝達

4. **デバッグ容易性**
   - 各ステップの成果物がファイルとして残る
   - 問題発生時に原因追跡が容易
   - 中間状態の確認が可能

5. **再実行対応**
   - ファイルが残っているため、途中からの再実行が可能
   - 特定ノードだけの再実行も可能

## 10. セキュリティ・パフォーマンス考慮事項

### 10.1 セキュリティ

- **プロンプトインジェクション対策**: ユーザー入力のサニタイズ
- **ファイルアクセス制限**: プロジェクトディレクトリ外へのアクセス禁止
- **API鍵管理**: 環境変数または安全なストレージに保存

### 10.2 パフォーマンス

- **大規模グラフの最適化**: 仮想スクロール、遅延レンダリング
- **メモリ管理**: MemoryMonitorで監視、必要に応じてworktreeクリーンアップ
- **並列実行の制限**: maxConcurrencyで同時実行数を制限

## 11. マイグレーション戦略

### 11.1 段階的移行

**Phase 1**: Rete.jsエディタと既存UIの並行運用
- 既存のKanban UIは維持
- 新規タブとしてRete.jsエディタを追加
- 既存ワークフローは引き続き動作

**Phase 2**: プリセットワークフローの移植
- スクラムワークフローをRete.jsテンプレートとして実装
- ユーザーが選択可能に

**Phase 3**: 完全移行
- Rete.jsをメインUIに
- 既存Kanban UIは非推奨に

## 12. 今後の拡張可能性

- **外部サービス連携**: GitHub Actions、CI/CDパイプライン
- **ワークフローマーケットプレイス**: コミュニティでワークフロー共有
- **リアルタイムコラボレーション**: 複数ユーザーでのワークフロー編集
- **AI自動最適化**: ワークフロー実行履歴から最適化提案

---

**このドキュメントは、Rete.jsビジュアルワークフローエディタの実装における基本設計を定義します。**
