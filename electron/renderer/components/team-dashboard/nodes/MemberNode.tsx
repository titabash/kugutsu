/**
 * MemberNode - チームメンバーを表すカスタムノード
 *
 * スクラムメンバー（Product Owner, Director, Tech Lead, Engineer等）を
 * 美しいカードUIで表示します
 */

import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import * as Tooltip from '@radix-ui/react-tooltip';
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

// ステータスラベルのヘルパー
const getStatusLabel = (status: MemberNodeData['status']): string => {
  switch (status) {
    case 'pending':
      return '待機中';
    case 'executing':
      return '実行中';
    case 'completed':
      return '完了';
    case 'failed':
      return '失敗';
    default:
      return status;
  }
};

const MemberNode: React.FC<MemberNodeProps> = ({ id, data }) => {
  const { role, label, status, taskName, message, timestamp } = data;
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    <>
      <Tooltip.Provider>
        <Tooltip.Root delayDuration={300}>
          <Tooltip.Trigger asChild>
            <div
              className={`${styles.memberNode} ${STATUS_CLASSES[status]}`}
              data-node-status={status}
              data-node-role={role}
              data-task-name={taskName}
              onClick={() => setIsModalOpen(true)}
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
          </Tooltip.Trigger>

          <Tooltip.Portal>
            <Tooltip.Content className={styles.tooltipContent} sideOffset={5} role="tooltip">
              <div className={styles.tooltipHeader}>
                <span className={styles.tooltipIcon}>{ROLE_ICONS[role]}</span>
                <span className={styles.tooltipTitle}>{label}</span>
              </div>
              <div className={styles.tooltipBody}>
                <div className={styles.tooltipRow}>
                  <span className={styles.tooltipLabel}>ステータス:</span>
                  <span className={styles.tooltipValue}>{getStatusLabel(status)}</span>
                </div>
                {timestamp && (
                  <div className={styles.tooltipRow}>
                    <span className={styles.tooltipLabel}>経過時間:</span>
                    <span className={styles.tooltipValue}>{getElapsedTime()}</span>
                  </div>
                )}
                {taskName && (
                  <div className={styles.tooltipRow}>
                    <span className={styles.tooltipLabel}>タスク:</span>
                    <span className={styles.tooltipValue}>{taskName}</span>
                  </div>
                )}
                {message && (
                  <div className={styles.tooltipRow}>
                    <span className={styles.tooltipLabel}>メッセージ:</span>
                    <span className={styles.tooltipValue}>{message}</span>
                  </div>
                )}
              </div>
              <Tooltip.Arrow className={styles.tooltipArrow} />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>

      {/* カスタムモーダル */}
      {isModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setIsModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                <span className={styles.modalIcon}>{ROLE_ICONS[role]}</span>
                {label}
              </h2>
              <button
                className={styles.modalCloseButton}
                onClick={() => setIsModalOpen(false)}
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalSection}>
                <h3 className={styles.modalSectionTitle}>基本情報</h3>
                <div className={styles.modalRow}>
                  <span className={styles.modalLabel}>ロール:</span>
                  <span className={styles.modalValue}>{label}</span>
                </div>
                <div className={styles.modalRow}>
                  <span className={styles.modalLabel}>ステータス:</span>
                  <span className={`${styles.modalValue} ${styles.modalStatus} ${styles['status' + status.charAt(0).toUpperCase() + status.slice(1)]}`}>
                    {STATUS_ICONS[status]} {getStatusLabel(status)}
                  </span>
                </div>
                {timestamp && (
                  <div className={styles.modalRow}>
                    <span className={styles.modalLabel}>経過時間:</span>
                    <span className={styles.modalValue}>{getElapsedTime()}</span>
                  </div>
                )}
              </div>

              {(taskName || message) && (
                <div className={styles.modalSection}>
                  <h3 className={styles.modalSectionTitle}>実行内容</h3>
                  {taskName && (
                    <div className={styles.modalRow}>
                      <span className={styles.modalLabel}>タスク:</span>
                      <span className={styles.modalValue}>{taskName}</span>
                    </div>
                  )}
                  {message && (
                    <div className={styles.modalRow}>
                      <span className={styles.modalLabel}>メッセージ:</span>
                      <span className={styles.modalValue}>{message}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MemberNode;
