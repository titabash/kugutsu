/**
 * @xyflow/react モックファイル
 *
 * Jestテストで@xyflow/reactをモックします
 */

import React from 'react';

export const ReactFlow = ({ nodes, edges, nodeTypes, children }: { nodes: any[]; edges: any[]; nodeTypes: any; children?: any }) => (
  <div data-testid="react-flow">
    <div data-testid="react-flow-nodes">
      {nodes.map((node: any) => {
        const NodeComponent = nodeTypes?.[node.type];
        return NodeComponent ? (
          <div key={node.id} data-testid={`flow-node-${node.id}`} data-node-status={node.data?.status} data-node-role={node.data?.role} data-task-name={node.data?.taskName}>
            <NodeComponent data={node.data} id={node.id} />
          </div>
        ) : (
          <div
            key={node.id}
            data-testid={`flow-node-${node.id}`}
            data-node-status={node.data?.status}
            data-node-role={node.data?.role}
            data-task-name={node.data?.taskName}
          >
            {node.data?.label}
            {node.data?.taskName && <span>{node.data.taskName}</span>}
            {node.data?.message && (
              <div data-testid={`message-${node.id}`}>{node.data.message}</div>
            )}
          </div>
        );
      })}
    </div>
    <div data-testid="react-flow-edges">
      {edges.map((edge: any) => (
        <div
          key={edge.id}
          data-testid={`flow-edge-${edge.id}`}
          data-edge-animated={edge.animated}
        />
      ))}
    </div>
    {children}
  </div>
);

export const Background = () => <div data-testid="react-flow-background" />;

export const Controls = () => <div data-testid="react-flow-controls" />;

export const MiniMap = () => <div data-testid="react-flow-minimap" />;

export const useNodesState = (initialNodes: any) => [
  initialNodes,
  () => {}, // setNodes
  () => {}, // onNodesChange
];

export const useEdgesState = (initialEdges: any) => [
  initialEdges,
  () => {}, // setEdges
  () => {}, // onEdgesChange
];

export const Handle = ({ type, position }: any) => (
  <div data-testid={`handle-${type}-${position}`} />
);

export const Position = {
  Left: 'left',
  Top: 'top',
  Right: 'right',
  Bottom: 'bottom',
};

export const BaseEdge = ({ id, path }: any) => <path id={id} d={path} />;

export const EdgeLabelRenderer = ({ children }: any) => <div>{children}</div>;

export const getBezierPath = ({ sourceX, sourceY, targetX, targetY }: any) => [
  `M ${sourceX},${sourceY} L ${targetX},${targetY}`,
  (sourceX + targetX) / 2,
  (sourceY + targetY) / 2,
];

export const ConnectionMode = {
  Strict: 'strict',
  Loose: 'loose',
};

// Types export
export type Node = any;
export type Edge = any;
export type EdgeProps = any;
