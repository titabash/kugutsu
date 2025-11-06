# Graph Visualization Specification

**プロジェクト**: Kugutsu 2.0 - AI Parallel Development System
**バージョン**: 1.0.0
**最終更新**: 2025-11-06
**対象**: Phase 3 - グラフビジュアライゼーション
**ステータス**: Draft

---

## 1. 概要

本仕様書は、LangGraphの実行フローを動的かつリアルタイムに可視化するグラフビジュアライゼーション機能の仕様を定義します。**ノードの拡張性**を最優先とし、将来的にノードが追加されてもUIコードの変更を最小限に抑える設計を実現します。

### 1.1 目的

- LangGraphのノードとエッジをリアルタイムで視覚化
- ノードの実行状態を直感的に表示
- 新しいノードタイプの追加を容易にする拡張可能なアーキテクチャ
- ズーム、パン、自動レイアウトなどのインタラクティブ機能

### 1.2 設計原則

1. **動的検出**: グラフ構造をハードコーディングせず、LangGraphから自動検出
2. **プラガブル**: ノードコンポーネントをプラグインのように追加可能
3. **型安全**: TypeScriptによる完全な型推論
4. **パフォーマンス**: 大規模グラフ（50+ノード）でもスムーズに動作

---

## 2. 技術スタック

### 2.1 ライブラリ

| ライブラリ | バージョン | 用途 |
|-----------|----------|------|
| @xyflow/react | 12.9.2 | グラフレンダリング |
| React | 19.2.0 | UIフレームワーク |
| Zustand | 5.0.8 | 状態管理 |

### 2.2 @xyflow/react の主要機能

```typescript
import { ReactFlow, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
```

**主な機能:**
- **カスタムノード**: ノードコンポーネントの完全なカスタマイズ
- **自動レイアウト**: Dagre, ELKなどのレイアウトアルゴリズム
- **インタラクション**: ズーム、パン、ドラッグ
- **MiniMap**: 全体図の表示
- **Controls**: ズームボタン等のUI

---

## 3. アーキテクチャ設計

### 3.1 動的ノード検出システム

#### 3.1.1 コンセプト

LangGraphのコンパイル済みグラフから、実行時にノード情報を自動抽出します。

```typescript
/**
 * LangGraphからノード情報を抽出
 */
function extractNodesFromGraph(
  graph: CompiledStateGraph
): GraphNodeInfo[] {
  const graphDef = graph.getGraph();
  const nodes: GraphNodeInfo[] = [];

  // ノードIDを取得
  const nodeIds = Object.keys(graphDef.nodes);

  for (const nodeId of nodeIds) {
    const nodeInfo: GraphNodeInfo = {
      id: nodeId,
      type: inferNodeType(nodeId), // 命名規則から推論
      label: formatNodeLabel(nodeId), // 表示名を生成
      description: getNodeDescription(nodeId), // 説明（オプション）
    };
    nodes.push(nodeInfo);
  }

  return nodes;
}

/**
 * ノード名から型を推論
 * 例: "product_owner" → "product_owner"
 *     "engineer_dispatch" → "engineer_dispatch"
 *     "engineer" → "engineer"
 */
function inferNodeType(nodeId: string): string {
  // ノード名をそのまま型として使用
  // プレフィックスやサフィックスがあれば除去
  return nodeId.replace(/_\d+$/, ''); // "engineer_1" → "engineer"
}

/**
 * 表示名を生成
 * 例: "product_owner" → "Product Owner"
 *     "engineer_dispatch" → "Engineer Dispatch"
 */
function formatNodeLabel(nodeId: string): string {
  return nodeId
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
```

#### 3.1.2 ノード情報型定義

```typescript
export interface GraphNodeInfo {
  /** ノードID（一意） */
  id: string;

  /** ノードタイプ（スタイル決定に使用） */
  type: string;

  /** 表示名 */
  label: string;

  /** 説明（オプション） */
  description?: string;

  /** カスタムメタデータ */
  metadata?: Record<string, any>;
}
```

### 3.2 ノードタイプレジストリ

#### 3.2.1 スタイルレジストリ

新しいノードタイプのスタイルを簡単に追加できるレジストリパターン。

```typescript
/**
 * ノードスタイル定義
 */
export interface NodeStyle {
  /** ベースカラー */
  color: string;

  /** アイコン（絵文字またはSVGパス） */
  icon: string;

  /** 背景グラデーション（オプション） */
  gradient?: {
    from: string;
    to: string;
  };

  /** ボーダースタイル */
  border?: {
    width: number;
    color: string;
    style: 'solid' | 'dashed' | 'dotted';
  };
}

/**
 * ノードスタイルレジストリ
 *
 * 新しいノードを追加する場合、ここにスタイルを定義するだけ
 */
export const NODE_STYLE_REGISTRY: Record<string, NodeStyle> = {
  // 既存のノード
  product_owner: {
    color: '#3B82F6', // Blue
    icon: '📋',
    gradient: { from: '#3B82F6', to: '#60A5FA' },
  },

  engineer_dispatch: {
    color: '#8B5CF6', // Purple
    icon: '🚀',
    gradient: { from: '#8B5CF6', to: '#A78BFA' },
  },

  engineer: {
    color: '#10B981', // Green
    icon: '👨‍💻',
    gradient: { from: '#10B981', to: '#34D399' },
  },

  review: {
    color: '#F59E0B', // Amber
    icon: '🔍',
    gradient: { from: '#F59E0B', to: '#FBBF24' },
  },

  merge_coordinator: {
    color: '#EF4444', // Red
    icon: '🔀',
    gradient: { from: '#EF4444', to: '#F87171' },
  },

  conflict_resolver: {
    color: '#EC4899', // Pink
    icon: '⚔️',
    gradient: { from: '#EC4899', to: '#F472B6' },
  },

  // スプリント駆動開発ノード
  check_mode: {
    color: '#22C55E', // Green 500
    icon: '🔄',
    gradient: { from: '#22C55E', to: '#4ADE80' },
    border: {
      width: 3,
      color: '#16A34A',
      style: 'solid',
    },
  },

  sprint_planning: {
    color: '#FDE047', // Yellow 300
    icon: '📅',
    gradient: { from: '#FDE047', to: '#FEF08A' },
    border: {
      width: 3,
      color: '#EAB308',
      style: 'solid',
    },
  },

  sprint_review: {
    color: '#FDE047', // Yellow 300
    icon: '✔️',
    gradient: { from: '#FDE047', to: '#FEF08A' },
    border: {
      width: 3,
      color: '#EAB308',
      style: 'solid',
    },
  },

  // 将来追加されるノード（例）
  code_reviewer: {
    color: '#06B6D4', // Cyan
    icon: '✅',
    gradient: { from: '#06B6D4', to: '#22D3EE' },
  },

  test_generator: {
    color: '#84CC16', // Lime
    icon: '🧪',
    gradient: { from: '#84CC16', to: '#A3E635' },
  },

  documentation_writer: {
    color: '#6366F1', // Indigo
    icon: '📝',
    gradient: { from: '#6366F1', to: '#818CF8' },
  },

  security_scanner: {
    color: '#DC2626', // Dark Red
    icon: '🔒',
    gradient: { from: '#DC2626', to: '#EF4444' },
  },

  // フォールバックスタイル
  default: {
    color: '#6B7280', // Gray
    icon: '⚙️',
  },
};

/**
 * ノードタイプからスタイルを取得
 */
export function getNodeStyle(nodeType: string): NodeStyle {
  return NODE_STYLE_REGISTRY[nodeType] ?? NODE_STYLE_REGISTRY.default;
}
```

#### 3.2.2 ステータスカラー

ノードの実行状態に応じたカラー定義。

```typescript
export type NodeStatus =
  | 'pending'      // 待機中
  | 'running'      // 実行中
  | 'completed'    // 完了
  | 'failed'       // 失敗
  | 'skipped';     // スキップ

export const NODE_STATUS_COLORS: Record<NodeStatus, string> = {
  pending: '#9CA3AF',    // Gray 400
  running: '#3B82F6',    // Blue 500（パルスアニメーション）
  completed: '#10B981',  // Green 500
  failed: '#EF4444',     // Red 500
  skipped: '#D1D5DB',    // Gray 300
};
```

### 3.3 カスタムノードコンポーネント

#### 3.3.1 ベースノードコンポーネント

```typescript
/**
 * カスタムノードの基底コンポーネント
 *
 * React 19対応: refをpropsとして受け取る
 */
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

export interface CustomNodeData {
  label: string;
  type: string;
  status: NodeStatus;
  icon?: string;
  description?: string;
}

export function CustomNode({ data, ref }: NodeProps<CustomNodeData> & { ref?: React.Ref<HTMLDivElement> }) {
  const style = getNodeStyle(data.type);
  const statusColor = NODE_STATUS_COLORS[data.status];

  return (
    <div
      ref={ref}
      className="custom-node"
      style={{
        background: style.gradient
          ? `linear-gradient(135deg, ${style.gradient.from}, ${style.gradient.to})`
          : style.color,
        borderColor: statusColor,
        borderWidth: 3,
        borderStyle: 'solid',
      }}
    >
      {/* インプットハンドル */}
      <Handle type="target" position={Position.Top} />

      {/* ノード内容 */}
      <div className="node-header">
        <span className="node-icon">{data.icon || style.icon}</span>
        <span className="node-label">{data.label}</span>
      </div>

      {/* ステータスインジケーター */}
      <div className="node-status">
        {data.status === 'running' && (
          <div className="pulse-animation"></div>
        )}
        <span className="status-text">{data.status}</span>
      </div>

      {/* アウトプットハンドル */}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

#### 3.3.2 ノードコンポーネントレジストリ（拡張可能）

```typescript
/**
 * ノードタイプごとのカスタムコンポーネント
 *
 * 新しいノードタイプに特別な表示が必要な場合、ここに追加
 */
export const NODE_COMPONENT_REGISTRY: Record<
  string,
  React.ComponentType<NodeProps<CustomNodeData>>
> = {
  // デフォルトコンポーネント
  default: CustomNode,

  // エンジニアノード（並列実行数を表示）
  engineer: EngineerNode,

  // レビューノード（レビュー結果を表示）
  review: ReviewNode,

  // 将来的な拡張例
  // test_generator: TestGeneratorNode,
  // security_scanner: SecurityScannerNode,
};

/**
 * ノードタイプからコンポーネントを取得
 */
export function getNodeComponent(
  nodeType: string
): React.ComponentType<NodeProps<CustomNodeData>> {
  return NODE_COMPONENT_REGISTRY[nodeType] ?? NODE_COMPONENT_REGISTRY.default;
}
```

### 3.4 エッジの動的生成

#### 3.4.1 エッジ抽出

```typescript
/**
 * LangGraphからエッジ情報を抽出
 */
function extractEdgesFromGraph(
  graph: CompiledStateGraph
): Edge[] {
  const graphDef = graph.getGraph();
  const edges: Edge[] = [];

  // エッジを取得
  for (const [sourceId, targets] of Object.entries(graphDef.edges)) {
    if (Array.isArray(targets)) {
      targets.forEach((targetId, index) => {
        edges.push({
          id: `e-${sourceId}-${targetId}-${index}`,
          source: sourceId,
          target: targetId,
          type: 'smoothstep', // または 'default', 'straight', 'step'
          animated: false, // 実行中のエッジをアニメーション化する場合true
        });
      });
    }
  }

  return edges;
}
```

#### 3.4.2 条件付きエッジ

```typescript
/**
 * 条件付きエッジのスタイル
 */
export interface ConditionalEdge extends Edge {
  data?: {
    condition?: string; // 条件式
    label?: string;     // エッジのラベル
  };
}

// 条件付きエッジの表示例
const conditionalEdgeStyle = {
  stroke: '#94A3B8', // Gray
  strokeWidth: 2,
  strokeDasharray: '5,5', // 破線
};
```

---

## 4. グラフレイアウト

### 4.1 自動レイアウトアルゴリズム

#### 4.1.1 Dagreレイアウト

```typescript
import dagre from 'dagre';

/**
 * Dagreアルゴリズムでノード位置を自動計算
 */
export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 200;
  const nodeHeight = 100;

  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}
```

#### 4.1.2 レイアウト方向

- **TB (Top-Bottom)**: 上から下へ（デフォルト）
- **LR (Left-Right)**: 左から右へ

### 4.2 手動レイアウト調整

ユーザーがノードをドラッグして位置を調整できるようにします。

```typescript
const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);

// ノードの位置変更を許可
<ReactFlow
  nodes={nodes}
  onNodesChange={onNodesChange}
  nodesDraggable={true}
/>
```

### 4.3 スプリント駆動開発フロー専用レイアウト

#### 4.3.1 概要

スプリント駆動開発フロー（`ARCHITECTURE_DESIGN.md` セクション5.1参照）を視覚化する際の専用レイアウト仕様を定義します。

#### 4.3.2 レイアウトアルゴリズム

**方向**: Hierarchical (Top-Bottom)

**特徴**:
- スプリントループを視覚的に強調
- 並列実行ノード（Engineer x N、Review x N）を横並びに配置
- 条件分岐エッジを破線で表現

#### 4.3.3 ノード配置ルール

```typescript
/**
 * スプリント駆動開発フローのレイアウト
 */
export interface SprintFlowLayout {
  /** レイヤーごとのノード配置 */
  layers: {
    layer: number;
    nodes: string[];
    description: string;
    spacing: 'normal' | 'compact' | 'wide';
  }[];
}

export const SPRINT_FLOW_LAYOUT: SprintFlowLayout = {
  layers: [
    {
      layer: 0,
      nodes: ['check_mode'],
      description: '継続モード判定',
      spacing: 'normal',
    },
    {
      layer: 1,
      nodes: ['product_owner'],
      description: '要求整理',
      spacing: 'normal',
    },
    {
      layer: 2,
      nodes: ['sprint_planning'],
      description: 'AI駆動スプリント計画',
      spacing: 'normal',
    },
    {
      layer: 3,
      nodes: ['engineer_dispatch'],
      description: 'タスク割り当て',
      spacing: 'normal',
    },
    {
      layer: 4,
      nodes: ['engineer_1', 'engineer_2', 'engineer_3', 'engineer_N'],
      description: '並列エンジニア実行',
      spacing: 'wide', // 横並び
    },
    {
      layer: 5,
      nodes: ['review_1', 'review_2', 'review_3', 'review_N'],
      description: '並列レビュー',
      spacing: 'wide', // 横並び
    },
    {
      layer: 6,
      nodes: ['merge_coordinator'],
      description: 'マージ調整',
      spacing: 'normal',
    },
    {
      layer: 7,
      nodes: ['conflict_resolver'],
      description: 'コンフリクト解消',
      spacing: 'normal',
    },
    {
      layer: 8,
      nodes: ['sprint_review'],
      description: 'AI駆動スプリントレビュー',
      spacing: 'normal',
    },
  ],
};
```

#### 4.3.4 エッジスタイル

```typescript
/**
 * スプリントフロー専用のエッジスタイル
 */
export const SPRINT_FLOW_EDGE_STYLES = {
  /** 通常のエッジ */
  normal: {
    stroke: '#64748B',
    strokeWidth: 2,
    type: 'smoothstep',
  },

  /** スプリントループエッジ（SprintReview → SprintPlanning） */
  sprintLoop: {
    stroke: '#F97316', // Orange
    strokeWidth: 3,
    strokeDasharray: '10,5', // 破線
    type: 'smoothstep',
    animated: true, // アニメーション有効
    label: '次スプリント',
    labelStyle: { fill: '#F97316', fontWeight: 'bold' },
  },

  /** 並列実行エッジ（EngineerDispatch → Engineer x N） */
  parallel: {
    stroke: '#10B981', // Green
    strokeWidth: 3,
    type: 'smoothstep',
    animated: false,
  },

  /** 条件分岐エッジ（MergeCoordinator → ConflictResolver） */
  conditional: {
    stroke: '#EC4899', // Pink
    strokeWidth: 2,
    strokeDasharray: '5,5', // 破線
    type: 'smoothstep',
    label: 'コンフリクト時',
    labelStyle: { fill: '#EC4899' },
  },

  /** 完了エッジ（SprintReview → END） */
  completion: {
    stroke: '#22C55E', // Green
    strokeWidth: 3,
    type: 'smoothstep',
    label: '全タスク完了',
    labelStyle: { fill: '#22C55E', fontWeight: 'bold' },
  },
};
```

#### 4.3.5 視覚的強調

```typescript
/**
 * スプリントループを視覚的に強調
 */
export function highlightSprintLoop(edges: Edge[]): Edge[] {
  return edges.map((edge) => {
    // SprintReview → SprintPlanning のエッジを検出
    if (edge.source === 'sprint_review' && edge.target === 'sprint_planning') {
      return {
        ...edge,
        ...SPRINT_FLOW_EDGE_STYLES.sprintLoop,
      };
    }

    // 並列実行エッジ
    if (edge.source === 'engineer_dispatch' && edge.target.startsWith('engineer')) {
      return {
        ...edge,
        ...SPRINT_FLOW_EDGE_STYLES.parallel,
      };
    }

    // 条件分岐エッジ
    if (edge.source === 'merge_coordinator' && edge.target === 'conflict_resolver') {
      return {
        ...edge,
        ...SPRINT_FLOW_EDGE_STYLES.conditional,
      };
    }

    // 完了エッジ
    if (edge.source === 'sprint_review' && edge.target === '__end__') {
      return {
        ...edge,
        ...SPRINT_FLOW_EDGE_STYLES.completion,
      };
    }

    return {
      ...edge,
      ...SPRINT_FLOW_EDGE_STYLES.normal,
    };
  });
}
```

#### 4.3.6 レイアウト計算例

```typescript
/**
 * スプリント駆動開発フロー専用のレイアウト計算
 */
export function getSprintFlowLayout(
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[] } {
  const nodeWidth = 200;
  const nodeHeight = 100;
  const layerSpacing = 150; // レイヤー間の垂直間隔
  const normalSpacing = 50; // 通常の水平間隔
  const wideSpacing = 100;   // 並列ノードの水平間隔

  const layoutedNodes = nodes.map((node) => {
    // レイヤー情報を取得
    const layerInfo = SPRINT_FLOW_LAYOUT.layers.find((layer) =>
      layer.nodes.includes(node.id) || layer.nodes.some((n) => node.id.startsWith(n.replace('_N', '')))
    );

    if (!layerInfo) {
      // レイアウト定義にないノードはデフォルト位置
      return node;
    }

    const layer = layerInfo.layer;
    const spacing = layerInfo.spacing === 'wide' ? wideSpacing : normalSpacing;

    // レイヤー内のインデックスを取得
    const nodesInLayer = nodes.filter((n) =>
      layerInfo.nodes.includes(n.id) || layerInfo.nodes.some((ln) => n.id.startsWith(ln.replace('_N', '')))
    );
    const index = nodesInLayer.indexOf(node);

    // 位置計算
    const totalWidth = (nodesInLayer.length - 1) * (nodeWidth + spacing);
    const x = -totalWidth / 2 + index * (nodeWidth + spacing);
    const y = layer * (nodeHeight + layerSpacing);

    return {
      ...node,
      position: { x, y },
    };
  });

  // エッジスタイルを適用
  const styledEdges = highlightSprintLoop(edges);

  return { nodes: layoutedNodes, edges: styledEdges };
}
```

---

## 5. リアルタイム更新

### 5.1 状態更新フロー

```
LangGraph Execution
    │
    ├─ Node Started
    │     └─> IPC: 'node-started'
    │           └─> updateNodeStatus(nodeId, 'running')
    │                 └─> React Flow Re-render
    │
    ├─ Node Completed
    │     └─> IPC: 'node-completed'
    │           └─> updateNodeStatus(nodeId, 'completed')
    │                 └─> React Flow Re-render
    │
    └─ Node Failed
          └─> IPC: 'node-failed'
                └─> updateNodeStatus(nodeId, 'failed')
                      └─> React Flow Re-render
```

### 5.2 Zustand Storeとの統合

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface GraphState {
  nodes: Node<CustomNodeData>[];
  edges: Edge[];
  currentNodeId: string | null;

  updateNodeStatus: (nodeId: string, status: NodeStatus) => void;
  setCurrentNode: (nodeId: string | null) => void;
  initializeGraph: (nodes: Node[], edges: Edge[]) => void;
}

export const useGraphStore = create<GraphState>()(
  immer((set) => ({
    nodes: [],
    edges: [],
    currentNodeId: null,

    updateNodeStatus: (nodeId, status) =>
      set((state) => {
        const node = state.nodes.find((n) => n.id === nodeId);
        if (node) {
          node.data.status = status;
        }
      }),

    setCurrentNode: (nodeId) =>
      set((state) => {
        // 前回の実行中ノードをcompletedに
        if (state.currentNodeId) {
          const prevNode = state.nodes.find((n) => n.id === state.currentNodeId);
          if (prevNode && prevNode.data.status === 'running') {
            prevNode.data.status = 'completed';
          }
        }

        // 新しいノードをrunningに
        if (nodeId) {
          const node = state.nodes.find((n) => n.id === nodeId);
          if (node) {
            node.data.status = 'running';
          }
        }

        state.currentNodeId = nodeId;
      }),

    initializeGraph: (nodes, edges) =>
      set((state) => {
        state.nodes = nodes;
        state.edges = edges;
      }),
  }))
);
```

### 5.3 IPC統合フック

```typescript
/**
 * グラフ状態をIPCイベントで更新するフック
 */
export function useGraphSyncWithIPC() {
  const { updateNodeStatus, setCurrentNode } = useGraphStore();

  useEffect(() => {
    const unsubscribe = window.electronAPI.onGraphEventsBatch((events) => {
      events.forEach((event) => {
        switch (event.type) {
          case 'node-started':
            setCurrentNode(event.data.nodeId);
            break;

          case 'node-completed':
            updateNodeStatus(event.data.nodeId, 'completed');
            break;

          case 'node-failed':
            updateNodeStatus(event.data.nodeId, 'failed');
            break;
        }
      });
    });

    return () => unsubscribe();
  }, [updateNodeStatus, setCurrentNode]);
}
```

---

## 6. インタラクティブ機能

### 6.1 ズームとパン

```typescript
<ReactFlow
  nodes={nodes}
  edges={edges}
  fitView
  minZoom={0.2}
  maxZoom={2}
  defaultViewport={{ x: 0, y: 0, zoom: 1 }}
>
  <Controls /> {/* ズームボタン等 */}
  <Background />
</ReactFlow>
```

### 6.2 MiniMap

```typescript
import { MiniMap } from '@xyflow/react';

<ReactFlow nodes={nodes} edges={edges}>
  <MiniMap
    nodeColor={(node) => {
      const style = getNodeStyle(node.data.type);
      return style.color;
    }}
    nodeStrokeWidth={3}
  />
</ReactFlow>
```

### 6.3 ノードクリック

```typescript
const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
  console.log('Node clicked:', node);
  // タスク詳細モーダルを表示
  showTaskDetails(node.id);
}, []);

<ReactFlow
  nodes={nodes}
  edges={edges}
  onNodeClick={onNodeClick}
/>
```

---

## 7. パフォーマンス最適化

### 7.1 仮想化

大規模グラフ（50+ノード）の場合、画面外のノードはレンダリングしない。

```typescript
<ReactFlow
  nodes={nodes}
  edges={edges}
  onlyRenderVisibleElements={true} // 画面内のみレンダリング
/>
```

### 7.2 メモ化

```typescript
const MemoizedCustomNode = memo(CustomNode);

export const NODE_COMPONENT_REGISTRY = {
  default: MemoizedCustomNode,
  // ...
};
```

---

## 8. 拡張性の実現

### 8.1 新しいノードタイプの追加手順

**ステップ1**: `NODE_STYLE_REGISTRY` にスタイルを追加

```typescript
export const NODE_STYLE_REGISTRY = {
  // 既存のノード...

  // 新しいノード
  my_new_node: {
    color: '#9333EA', // Purple 600
    icon: '🆕',
    gradient: { from: '#9333EA', to: '#A855F7' },
  },
};
```

**ステップ2** (オプション): カスタムコンポーネントが必要な場合

```typescript
// components/MyNewNodeComponent.tsx
export function MyNewNodeComponent({ data }: NodeProps<CustomNodeData>) {
  return (
    <div className="my-new-node">
      {/* カスタムレイアウト */}
    </div>
  );
}

// NODE_COMPONENT_REGISTRY に追加
export const NODE_COMPONENT_REGISTRY = {
  // 既存のコンポーネント...

  my_new_node: MyNewNodeComponent,
};
```

**以上！**UIコードの他の部分は変更不要。動的検出システムが自動的に新しいノードを認識します。

### 8.2 設定ファイルベースのカスタマイズ（将来的）

```json
// .kugutsu/graph-styles.json
{
  "nodes": {
    "my_custom_node": {
      "color": "#FF6B6B",
      "icon": "🎨",
      "gradient": {
        "from": "#FF6B6B",
        "to": "#FF8787"
      }
    }
  }
}
```

---

## 9. アクセシビリティ

### 9.1 キーボードナビゲーション

- `Tab`: ノード間の移動
- `Enter`: ノードの選択
- `+/-`: ズーム

### 9.2 ARIA属性

```typescript
<ReactFlow
  nodes={nodes}
  edges={edges}
  aria-label="LangGraph Execution Flow"
/>
```

---

## 10. テスト戦略

### 10.1 ユニットテスト

```typescript
describe('extractNodesFromGraph', () => {
  it('should extract nodes from LangGraph', () => {
    const mockGraph = createMockGraph();
    const nodes = extractNodesFromGraph(mockGraph);

    expect(nodes).toHaveLength(6);
    expect(nodes[0]).toMatchObject({
      id: 'product_owner',
      type: 'product_owner',
      label: 'Product Owner',
    });
  });
});

describe('getNodeStyle', () => {
  it('should return style for known node type', () => {
    const style = getNodeStyle('engineer');
    expect(style.color).toBe('#10B981');
    expect(style.icon).toBe('👨‍💻');
  });

  it('should return default style for unknown node type', () => {
    const style = getNodeStyle('unknown_node');
    expect(style.color).toBe('#6B7280');
    expect(style.icon).toBe('⚙️');
  });
});
```

### 10.2 ビジュアルリグレッションテスト

```typescript
import { render } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';

describe('GraphVisualization', () => {
  it('should match snapshot', () => {
    const { container } = render(
      <ReactFlowProvider>
        <GraphVisualization />
      </ReactFlowProvider>
    );
    expect(container).toMatchSnapshot();
  });
});
```

---

## 11. 実装例

### 11.1 完全なコンポーネント

```typescript
/**
 * GraphVisualization Component
 *
 * LangGraphをリアルタイムで可視化
 */
import { useCallback, useEffect } from 'react';
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphStore } from '../store/graphStore';
import { useGraphSyncWithIPC } from '../hooks/useGraphSyncWithIPC';
import { getLayoutedElements } from '../lib/graphLayout';
import { NODE_COMPONENT_REGISTRY } from './nodes';

export function GraphVisualization() {
  const { nodes, edges, initializeGraph } = useGraphStore();

  // IPCイベントと同期
  useGraphSyncWithIPC();

  // 初期化
  useEffect(() => {
    // LangGraphから初期ノード・エッジを取得
    window.electronAPI.getGraphState().then((state) => {
      const initialNodes = extractNodesFromGraph(state.graph);
      const initialEdges = extractEdgesFromGraph(state.graph);

      // 自動レイアウト
      const { nodes: layoutedNodes, edges: layoutedEdges } =
        getLayoutedElements(initialNodes, initialEdges, 'TB');

      initializeGraph(layoutedNodes, layoutedEdges);
    });
  }, [initializeGraph]);

  const onNodeClick = useCallback((event, node) => {
    console.log('Node clicked:', node);
  }, []);

  return (
    <div className="graph-visualization" style={{ height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        nodeTypes={NODE_COMPONENT_REGISTRY}
        fitView
        minZoom={0.2}
        maxZoom={2}
        onlyRenderVisibleElements
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
```

---

## 12. 参考資料

- [@xyflow/react Documentation](https://reactflow.dev/)
- [Dagre Layout Algorithm](https://github.com/dagrejs/dagre)
- [React Flow Examples](https://reactflow.dev/examples)

---

**最終更新**: 2025-11-05
**バージョン**: 1.0.0
**承認**: 待機中
