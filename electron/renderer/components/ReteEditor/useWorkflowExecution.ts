/**
 * useWorkflowExecution Hook
 *
 * Phase 4.5: Real-time workflow execution visualization
 * React hook for integrating workflow execution state with Rete.js editor
 */

import { useState, useCallback, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

export type NodeStatus = 'pending' | 'executing' | 'completed' | 'failed';
export type ExecutionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
export type LogLevel = 'info' | 'warn' | 'error';

export interface WorkflowNodeDef {
  id: string;
  type: string;
  label: string;
}

export interface ExecutionLogEntry {
  nodeId: string;
  level: LogLevel;
  message: string;
  timestamp: number;
}

export interface StreamEvent {
  type: string;
  data: unknown;
}

export interface BufferedStreamEvent extends StreamEvent {
  timestamp: number;
  priority: 'high' | 'normal' | 'low';
}

export interface UseWorkflowExecutionResult {
  // State
  status: ExecutionStatus;
  progress: number;
  currentNodeId: string | null;
  nodeStatuses: Map<string, NodeStatus>;
  logs: ExecutionLogEntry[];

  // Computed values
  isRunning: boolean;
  hasErrors: boolean;
  completedCount: number;
  failedCount: number;
  totalCount: number;

  // Actions
  initializeWorkflow: (nodes: WorkflowNodeDef[]) => void;
  startExecution: () => void;
  completeExecution: () => void;
  failExecution: (error: string) => void;
  cancelExecution: () => void;
  updateNodeStatus: (nodeId: string, status: NodeStatus) => void;
  addLog: (nodeId: string, level: LogLevel, message: string) => void;
  reset: () => void;

  // Helpers
  isNodeExecuting: (nodeId: string) => boolean;
  isNodeCompleted: (nodeId: string) => boolean;
  isNodeFailed: (nodeId: string) => boolean;
  getLogsForNode: (nodeId: string) => ExecutionLogEntry[];
  getErrorLogs: () => ExecutionLogEntry[];

  // Stream integration
  handleStreamEvent: (event: StreamEvent) => void;
  handleStreamEventBatch: (events: BufferedStreamEvent[]) => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useWorkflowExecution(): UseWorkflowExecutionResult {
  // State
  const [status, setStatus] = useState<ExecutionStatus>('idle');
  const [nodeStatuses, setNodeStatuses] = useState<Map<string, NodeStatus>>(
    new Map()
  );
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ExecutionLogEntry[]>([]);

  // ==========================================================================
  // Actions
  // ==========================================================================

  const initializeWorkflow = useCallback((nodes: WorkflowNodeDef[]) => {
    const newStatuses = new Map<string, NodeStatus>();
    for (const node of nodes) {
      newStatuses.set(node.id, 'pending');
    }
    setNodeStatuses(newStatuses);
    setStatus('idle');
    setCurrentNodeId(null);
    setLogs([]);
  }, []);

  const startExecution = useCallback(() => {
    setStatus('running');
  }, []);

  const completeExecution = useCallback(() => {
    setStatus('completed');
    setCurrentNodeId(null);
  }, []);

  const failExecution = useCallback((error: string) => {
    setStatus('failed');
    setCurrentNodeId(null);
    setLogs((prev) => [
      ...prev,
      {
        nodeId: 'system',
        level: 'error' as LogLevel,
        message: error,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const cancelExecution = useCallback(() => {
    setStatus('cancelled');
    setCurrentNodeId(null);
  }, []);

  const updateNodeStatus = useCallback((nodeId: string, newStatus: NodeStatus) => {
    setNodeStatuses((prev) => {
      if (!prev.has(nodeId)) {
        return prev;
      }
      const updated = new Map(prev);
      updated.set(nodeId, newStatus);
      return updated;
    });

    if (newStatus === 'executing') {
      setCurrentNodeId(nodeId);
    } else if (newStatus === 'completed' || newStatus === 'failed') {
      setCurrentNodeId((prev) => (prev === nodeId ? null : prev));
    }
  }, []);

  const addLog = useCallback((nodeId: string, level: LogLevel, message: string) => {
    setLogs((prev) => [
      ...prev,
      {
        nodeId,
        level,
        message,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setNodeStatuses(new Map());
    setCurrentNodeId(null);
    setLogs([]);
  }, []);

  // ==========================================================================
  // Helpers
  // ==========================================================================

  const isNodeExecuting = useCallback(
    (nodeId: string) => nodeStatuses.get(nodeId) === 'executing',
    [nodeStatuses]
  );

  const isNodeCompleted = useCallback(
    (nodeId: string) => nodeStatuses.get(nodeId) === 'completed',
    [nodeStatuses]
  );

  const isNodeFailed = useCallback(
    (nodeId: string) => nodeStatuses.get(nodeId) === 'failed',
    [nodeStatuses]
  );

  const getLogsForNode = useCallback(
    (nodeId: string) => logs.filter((log) => log.nodeId === nodeId),
    [logs]
  );

  const getErrorLogs = useCallback(
    () => logs.filter((log) => log.level === 'error'),
    [logs]
  );

  // ==========================================================================
  // Stream Integration
  // ==========================================================================

  const handleStreamEvent = useCallback(
    (event: StreamEvent) => {
      switch (event.type) {
        case 'node-started': {
          const data = event.data as { nodeId: string; timestamp: number };
          updateNodeStatus(data.nodeId, 'executing');
          break;
        }
        case 'node-completed': {
          const data = event.data as {
            nodeId: string;
            timestamp: number;
            status: 'completed' | 'failed';
          };
          updateNodeStatus(data.nodeId, data.status);
          break;
        }
        case 'logs-batch': {
          const batchLogs = event.data as Array<{
            source: string;
            level: string;
            message: string;
            timestamp: number;
          }>;
          setLogs((prev) => [
            ...prev,
            ...batchLogs.map((log) => ({
              nodeId: log.source,
              level: log.level as LogLevel,
              message: log.message,
              timestamp: log.timestamp,
            })),
          ]);
          break;
        }
        case 'phase-change': {
          const data = event.data as { from: string; to: string };
          if (data.to === 'complete') {
            completeExecution();
          }
          break;
        }
        case 'error': {
          const errors = event.data as Array<{ message: string }>;
          for (const error of errors) {
            addLog('system', 'error', error.message);
          }
          break;
        }
        case 'complete': {
          completeExecution();
          break;
        }
      }
    },
    [updateNodeStatus, completeExecution, addLog]
  );

  const handleStreamEventBatch = useCallback(
    (events: BufferedStreamEvent[]) => {
      for (const event of events) {
        handleStreamEvent(event);
      }
    },
    [handleStreamEvent]
  );

  // ==========================================================================
  // Computed Values
  // ==========================================================================

  const progress = useMemo(() => {
    const total = nodeStatuses.size;
    if (total === 0) return 0;

    let completedOrFailed = 0;
    for (const [, nodeStatus] of nodeStatuses) {
      if (nodeStatus === 'completed' || nodeStatus === 'failed') {
        completedOrFailed++;
      }
    }

    return Math.round((completedOrFailed / total) * 100);
  }, [nodeStatuses]);

  const isRunning = status === 'running';

  const hasErrors = useMemo(
    () => logs.some((log) => log.level === 'error'),
    [logs]
  );

  const completedCount = useMemo(() => {
    let count = 0;
    for (const [, nodeStatus] of nodeStatuses) {
      if (nodeStatus === 'completed') {
        count++;
      }
    }
    return count;
  }, [nodeStatuses]);

  const failedCount = useMemo(() => {
    let count = 0;
    for (const [, nodeStatus] of nodeStatuses) {
      if (nodeStatus === 'failed') {
        count++;
      }
    }
    return count;
  }, [nodeStatuses]);

  const totalCount = nodeStatuses.size;

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    // State
    status,
    progress,
    currentNodeId,
    nodeStatuses,
    logs,

    // Computed values
    isRunning,
    hasErrors,
    completedCount,
    failedCount,
    totalCount,

    // Actions
    initializeWorkflow,
    startExecution,
    completeExecution,
    failExecution,
    cancelExecution,
    updateNodeStatus,
    addLog,
    reset,

    // Helpers
    isNodeExecuting,
    isNodeCompleted,
    isNodeFailed,
    getLogsForNode,
    getErrorLogs,

    // Stream integration
    handleStreamEvent,
    handleStreamEventBatch,
  };
}

export default useWorkflowExecution;
