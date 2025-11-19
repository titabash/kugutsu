/**
 * TeamDashboardFlow - リアルタイムチーム作業ダッシュボード
 *
 * スクラムメンバーの作業状況をリアルタイムで可視化します
 */

import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  ConnectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useAppStore } from '../../store/appStore';
import MemberNode from './nodes/MemberNode';
import AnimatedTaskEdge from './edges/AnimatedTaskEdge';
import { getParallelLayoutedElements } from './utils/dagreLayout';

import styles from './TeamDashboardFlow.module.css';

// ノードタイプの定義
const nodeTypes = {
  member: MemberNode,
};

// エッジタイプの定義
const edgeTypes = {
  animated: AnimatedTaskEdge,
};

const TeamDashboardFlow: React.FC = () => {
  // Zustand storeからデータを取得
  const nodeFlowData = useAppStore((state) => state.nodeFlowData);

  // ノードとエッジのデータを変換
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!nodeFlowData) {
      return { initialNodes: [], initialEdges: [] };
    }

    // ノードを変換
    const nodes: Node[] = nodeFlowData.nodes.map((node: any) => ({
      id: node.id,
      type: 'member',
      position: { x: 0, y: 0 }, // レイアウトで自動配置
      data: {
        role: node.role,
        label: node.label,
        status: node.status,
        taskName: node.taskName,
        message: node.message,
        timestamp: node.timestamp,
      },
    }));

    // エッジを変換
    const edges: Edge[] = nodeFlowData.edges.map((edge: any) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'animated',
      animated: edge.animated ?? false,
      data: {
        label: edge.label,
        animated: edge.animated ?? false,
        status: edge.status ?? 'pending',
      },
    }));

    // Dagreレイアウトを適用
    const layouted = getParallelLayoutedElements(nodes, edges, {
      direction: 'LR',
      nodeWidth: 320,
      nodeHeight: 220,
      rankSeparation: 250,
      nodeSeparation: 150,
    });

    return {
      initialNodes: layouted.nodes,
      initialEdges: layouted.edges,
    };
  }, [nodeFlowData]);

  // React Flowのstate管理
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  // データがない場合
  if (!nodeFlowData) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>👥</div>
        <h3 className={styles.emptyTitle}>Team Dashboard</h3>
        <p className={styles.emptyMessage}>
          Team dashboard will appear here when the workflow starts.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{
          padding: 0.2,
        }}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background
          color="#93c5fd"
          gap={16}
          size={1}
        />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const status = node.data?.status;
            switch (status) {
              case 'executing':
                return '#3b82f6';
              case 'completed':
                return '#22c55e';
              case 'failed':
                return '#ef4444';
              case 'pending':
              default:
                return '#9ca3af';
            }
          }}
          nodeBorderRadius={8}
        />
      </ReactFlow>
    </div>
  );
};

export default TeamDashboardFlow;
