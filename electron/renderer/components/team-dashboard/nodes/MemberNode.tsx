/**
 * MemberNode - チームメンバーを表すカスタムノード
 *
 * スクラムメンバー（Product Owner, Director, Tech Lead, Engineer等）を
 * 美しいカードUIで表示します
 */

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import styles from './MemberNode.module.css';

export interface MemberNodeData {
  role: 'product_owner' | 'director' | 'tech_lead_design' | 'tech_lead_review' | 'engineer' | 'merge_coordinator';
  label: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  taskName?: string;
  message?: string;
  timestamp?: number;
}

export interface MemberNodeProps {
  id: string;
  data: MemberNodeData;
}

// ロールごとのアイコン
const ROLE_ICONS: Record<MemberNodeData['role'], string> = {
  product_owner: '🎯',
  director: '🎬',
  tech_lead_design: '🏗️',
  tech_lead_review: '🔍',
  engineer: '👨‍💻',
  merge_coordinator: '🔀',
};

// ステータスごとの色クラス
const STATUS_CLASSES: Record<MemberNodeData['status'], string> = {
  pending: styles.statusPending,
  executing: styles.statusExecuting,
  completed: styles.statusCompleted,
  failed: styles.statusFailed,
};

// ステータスアイコン
const STATUS_ICONS: Record<MemberNodeData['status'], string> = {
  pending: '⚪',
  executing: '🔵',
  completed: '🟢',
  failed: '🔴',
};

const MemberNode: React.FC<MemberNodeProps> = ({ id, data }) => {
  const { role, label, status, taskName, message, timestamp } = data;

  // タイムスタンプから経過時間を計算
  const getElapsedTime = () => {
    if (!timestamp) return '';
    const elapsed = Date.now() - timestamp;
    const minutes = Math.floor(elapsed / 60000);
    if (minutes < 1) return 'たった今';
    if (minutes < 60) return `${minutes}分前`;
    const hours = Math.floor(minutes / 60);
    return `${hours}時間前`;
  };

  return (
    <div
      className={`${styles.memberNode} ${STATUS_CLASSES[status]}`}
      data-node-status={status}
      data-node-role={role}
      data-task-name={taskName}
    >
      {/* 入力ハンドル */}
      <Handle
        type="target"
        position={Position.Left}
        className={styles.handle}
      />

      {/* ヘッダー */}
      <div className={styles.header}>
        <div className={styles.roleInfo}>
          <span className={styles.roleIcon}>{ROLE_ICONS[role]}</span>
          <span className={styles.roleLabel}>{label}</span>
        </div>
        <div className={styles.statusBadge}>
          <span className={styles.statusIcon}>{STATUS_ICONS[status]}</span>
        </div>
      </div>

      {/* タスク名 */}
      {taskName && (
        <div className={styles.taskName}>
          <span className={styles.taskIcon}>📄</span>
          <span>{taskName}</span>
        </div>
      )}

      {/* AIメッセージ（吹き出し風） */}
      {message && (
        <div className={styles.messageContainer} data-testid={`message-${id}`}>
          <div className={styles.messageBubble}>
            <span className={styles.messageIcon}>💬</span>
            <span className={styles.messageText}>{message}</span>
          </div>
          {timestamp && (
            <div className={styles.timestamp}>{getElapsedTime()}</div>
          )}
        </div>
      )}

      {/* 出力ハンドル */}
      <Handle
        type="source"
        position={Position.Right}
        className={styles.handle}
      />
    </div>
  );
};

export default MemberNode;
