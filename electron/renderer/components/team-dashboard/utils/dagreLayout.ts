/**
 * Dagreレイアウトユーティリティ
 *
 * ノードとエッジを自動的に配置します
 */

import dagre from 'dagre';
import { Node, Edge } from '@xyflow/react';

export interface LayoutOptions {
  direction?: 'LR' | 'TB' | 'RL' | 'BT';
  nodeWidth?: number;
  nodeHeight?: number;
  rankSeparation?: number;
  nodeSeparation?: number;
}

const defaultOptions: LayoutOptions = {
  direction: 'LR', // 左から右へ
  nodeWidth: 300,
  nodeHeight: 200,
  rankSeparation: 200,
  nodeSeparation: 100,
};

/**
 * Dagreを使用してノードとエッジを自動配置
 */
export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } {
  const opts = { ...defaultOptions, ...options };

  // Dagreグラフを作成
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // グラフ設定
  dagreGraph.setGraph({
    rankdir: opts.direction,
    nodesep: opts.nodeSeparation,
    ranksep: opts.rankSeparation,
  });

  // ノードを追加
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: opts.nodeWidth,
      height: opts.nodeHeight,
    });
  });

  // エッジを追加
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // レイアウト計算
  dagre.layout(dagreGraph);

  // ノードの位置を更新
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - (opts.nodeWidth ?? 0) / 2,
        y: nodeWithPosition.y - (opts.nodeHeight ?? 0) / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * 並列ノードを縦に展開するカスタムレイアウト
 */
export function getParallelLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } {
  const opts = { ...defaultOptions, ...options };

  // まずDagreで基本レイアウト
  const { nodes: baseNodes } = getLayoutedElements(nodes, edges, opts);

  // 並列ノード（同じソースから複数のターゲット）を検出して縦に展開
  const parallelGroups = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (!parallelGroups.has(edge.source)) {
      parallelGroups.set(edge.source, []);
    }
    parallelGroups.get(edge.source)!.push(edge.target);
  });

  // 並列グループを縦に展開
  const layoutedNodes = baseNodes.map((node) => {
    const group = Array.from(parallelGroups.entries()).find(([_, targets]) =>
      targets.includes(node.id)
    );

    if (group && group[1].length > 1) {
      const [source, targets] = group;
      const index = targets.indexOf(node.id);
      const totalNodes = targets.length;
      const baseY = node.position.y;

      // 縦方向に展開
      const spacing = (opts.nodeHeight ?? 0) + (opts.nodeSeparation ?? 0);
      const offsetY = (index - (totalNodes - 1) / 2) * spacing;

      return {
        ...node,
        position: {
          ...node.position,
          y: baseY + offsetY,
        },
      };
    }

    return node;
  });

  return { nodes: layoutedNodes, edges };
}
