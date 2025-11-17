/**
 * NodeFlowVisualization コンポーネント
 *
 * LangGraphワークフローのノードフロー可視化コンポーネント
 * ReactFlowを使用してノードの実行状態をリアルタイムで表示
 */

import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAppStore } from '../store/appStore';
import type { FlowNode, FlowEdge } from '../types';

// 脈動アニメーションのCSS（実行中ノード用）
const pulseAnimation = `
@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
  }
}
`;

// スタイル要素をDOMに追加
if (typeof document !== 'undefined') {
  const styleElement = document.getElementById('node-flow-pulse-animation');
  if (!styleElement) {
    const style = document.createElement('style');
    style.id = 'node-flow-pulse-animation';
    style.textContent = pulseAnimation;
    document.head.appendChild(style);
  }
}

// ノード状態に応じた色定義
const NODE_STATUS_COLORS = {
  pending: {
    background: '#f3f4f6',
    border: '#9ca3af',
    text: '#4b5563',
  },
  executing: {
    background: '#dbeafe',
    border: '#3b82f6',
    text: '#1e40af',
  },
  completed: {
    background: '#d1fae5',
    border: '#10b981',
    text: '#065f46',
  },
  failed: {
    background: '#fee2e2',
    border: '#ef4444',
    text: '#991b1b',
  },
  skipped: {
    background: '#e5e7eb',
    border: '#6b7280',
    text: '#374151',
  },
};

// ノードタイプに応じたスタイル定義
const NODE_TYPE_STYLES = {
  start: {
    borderRadius: '50%',
    width: 80,
    height: 80,
  },
  end: {
    borderRadius: '50%',
    width: 80,
    height: 80,
  },
  process: {
    borderRadius: '8px',
    width: 180,
    height: 60,
  },
  decision: {
    borderRadius: '4px',
    width: 120,
    height: 120,
    transform: 'rotate(45deg)',
  },
};

/**
 * FlowNodeをReactFlow Nodeに変換
 */
function convertToReactFlowNode(
  node: FlowNode,
  index: number,
  currentExecutingNode: string | null
): Node {
  const colors = NODE_STATUS_COLORS[node.status];
  const typeStyles = NODE_TYPE_STYLES[node.type];
  const isHighlighted = currentExecutingNode === node.id;

  // ノードの位置を自動レイアウト（簡易的な配置）
  const position = {
    x: 250 + (index % 3) * 300,
    y: 100 + Math.floor(index / 3) * 150,
  };

  return {
    id: node.id,
    type: 'default',
    position,
    data: {
      label: node.label,
      status: node.status,
    },
    className: isHighlighted ? 'highlighted' : '',
    style: {
      background: colors.background,
      border: `2px solid ${colors.border}`,
      color: colors.text,
      ...typeStyles,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
      fontWeight: node.status === 'executing' ? 'bold' : 'normal',
      boxShadow: isHighlighted ? '0 0 0 4px rgba(59, 130, 246, 0.3)' : 'none',
      transition: 'all 0.3s ease',
      animation: node.status === 'executing' ? 'pulse 2s infinite' : 'none',
    },
  };
}

/**
 * FlowEdgeをReactFlow Edgeに変換
 */
function convertToReactFlowEdge(edge: FlowEdge): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label || edge.condition,
    type: 'smoothstep',
    animated: false,
    style: {
      stroke: '#6b7280',
      strokeWidth: 2,
    },
    labelStyle: {
      fontSize: '12px',
      fill: '#4b5563',
    },
  };
}

/**
 * NodeFlowVisualization コンポーネント
 */
export default function NodeFlowVisualization() {
  // appStoreからnodeFlowDataとcurrentExecutingNodeを取得
  const nodeFlowData = useAppStore((state) => state.nodeFlowData);
  const currentExecutingNode = useAppStore((state) => state.currentExecutingNode);

  // ReactFlow用のノードとエッジを生成
  const nodes = useMemo(() => {
    if (!nodeFlowData) return [];
    return nodeFlowData.nodes.map((node, index) =>
      convertToReactFlowNode(node, index, currentExecutingNode)
    );
  }, [nodeFlowData, currentExecutingNode]);

  const edges = useMemo(() => {
    if (!nodeFlowData) return [];
    return nodeFlowData.edges.map(convertToReactFlowEdge);
  }, [nodeFlowData]);

  // nodeFlowDataがnullの場合のメッセージ表示
  if (!nodeFlowData) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#6b7280',
          fontSize: '16px',
        }}
      >
        Workflow visualization will appear here
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        attributionPosition="bottom-left"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const status = node.data?.status as FlowNode['status'];
            return NODE_STATUS_COLORS[status]?.background || '#f3f4f6';
          }}
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
          }}
        />
      </ReactFlow>
    </div>
  );
}
