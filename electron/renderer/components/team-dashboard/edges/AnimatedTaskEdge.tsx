/**
 * AnimatedTaskEdge - タスクフローを表すアニメーション付きエッジ
 *
 * タスクの流れを視覚的に表現するカスタムエッジ
 */

import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
} from '@xyflow/react';
import styles from './AnimatedTaskEdge.module.css';

export interface AnimatedTaskEdgeData {
  label?: string;
  animated?: boolean;
  status?: 'pending' | 'executing' | 'completed' | 'failed';
}

const AnimatedTaskEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const animated = data?.animated ?? false;
  const status = data?.status ?? 'pending';
  const label = data?.label;

  // ステータスに応じた色
  const getEdgeColor = () => {
    switch (status) {
      case 'executing':
        return '#3b82f6'; // 青
      case 'completed':
        return '#22c55e'; // 緑
      case 'failed':
        return '#ef4444'; // 赤
      case 'pending':
      default:
        return '#9ca3af'; // グレー
    }
  };

  // ステータスに応じた太さ
  const getStrokeWidth = () => {
    switch (status) {
      case 'executing':
        return 3;
      case 'completed':
        return 2.5;
      default:
        return 2;
    }
  };

  const edgeColor = getEdgeColor();
  const strokeWidth = getStrokeWidth();

  return (
    <>
      {/* ベースパス */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: edgeColor,
          strokeWidth,
          opacity: status === 'pending' ? 0.4 : 1,
        }}
      />

      {/* アニメーションパス（実行中のみ） */}
      {animated && status === 'executing' && (
        <path
          d={edgePath}
          fill="none"
          stroke={edgeColor}
          strokeWidth={strokeWidth}
          strokeDasharray="8 8"
          className={styles.animatedPath}
        />
      )}

      {/* ラベル */}
      {label && (
        <EdgeLabelRenderer>
          <div
            className={styles.edgeLabel}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: status === 'executing' ? '#eff6ff' : 'white',
              borderColor: edgeColor,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default AnimatedTaskEdge;
