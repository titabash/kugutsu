/**
 * WorkflowExecutionVisualizerService
 *
 * Phase 4.5: Real-time workflow execution visualization
 * Provides workflow execution state management for Rete.js editor integration
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Node status event
 */
export interface NodeStatusEvent {
  nodeId: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  timestamp: number;
  executionTime?: number;
}

/**
 * Execution log entry
 */
export interface ExecutionLogEntry {
  nodeId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
}

/**
 * Workflow execution state
 */
export interface WorkflowExecutionState {
  nodes: Map<string, NodeStatusEvent>;
  currentNodeId: string | null;
  startTime: number | null;
  endTime: number | null;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  logs: ExecutionLogEntry[];
}

/**
 * Node definition for initialization
 */
export interface WorkflowNodeDef {
  id: string;
  type: string;
  label: string;
}

/**
 * Service options
 */
export interface VisualizerServiceOptions {
  maxLogEntries?: number;
  updateThrottleMs?: number;
}

/**
 * State snapshot for persistence
 */
export interface StateSnapshot {
  status: WorkflowExecutionState['status'];
  progress: number;
  nodesCount: number;
  completedCount: number;
  failedCount: number;
  logsCount: number;
  startTime: number | null;
  endTime: number | null;
  nodeStatuses: Array<{ nodeId: string; status: NodeStatusEvent['status'] }>;
}

/**
 * Stream event types from StateStreamManager
 */
export interface StreamEvent {
  type:
    | 'node-started'
    | 'node-completed'
    | 'logs-batch'
    | 'phase-change'
    | 'error'
    | 'complete';
  data: unknown;
}

// ============================================================================
// Callback types
// ============================================================================

type NodeStatusCallback = (event: NodeStatusEvent) => void;
type ExecutionStateCallback = (status: WorkflowExecutionState['status']) => void;
type ProgressCallback = (progress: number) => void;
type LogCallback = (entry: ExecutionLogEntry) => void;
type Unsubscribe = () => void;

// ============================================================================
// WorkflowExecutionVisualizerService
// ============================================================================

/**
 * Service for managing workflow execution visualization state
 */
export class WorkflowExecutionVisualizerService {
  private options: Required<VisualizerServiceOptions>;
  private state: WorkflowExecutionState;
  private nodeStartTimes: Map<string, number> = new Map();

  // Event listeners
  private nodeStatusListeners: Set<NodeStatusCallback> = new Set();
  private executionStateListeners: Set<ExecutionStateCallback> = new Set();
  private progressListeners: Set<ProgressCallback> = new Set();
  private logListeners: Set<LogCallback> = new Set();

  // Throttling
  private lastProgressUpdate: number = 0;
  private pendingProgressUpdate: number | null = null;

  constructor(options: VisualizerServiceOptions = {}) {
    this.options = {
      maxLogEntries: options.maxLogEntries ?? 1000,
      updateThrottleMs: options.updateThrottleMs ?? 50,
    };

    this.state = this.createInitialState();
  }

  // ==========================================================================
  // State Management
  // ==========================================================================

  /**
   * Get current state
   */
  getState(): WorkflowExecutionState {
    return this.state;
  }

  /**
   * Create initial state
   */
  private createInitialState(): WorkflowExecutionState {
    return {
      nodes: new Map(),
      currentNodeId: null,
      startTime: null,
      endTime: null,
      status: 'idle',
      progress: 0,
      logs: [],
    };
  }

  /**
   * Initialize workflow with node definitions
   */
  initializeWorkflow(nodes: WorkflowNodeDef[]): void {
    this.state = this.createInitialState();
    this.nodeStartTimes.clear();

    for (const node of nodes) {
      this.state.nodes.set(node.id, {
        nodeId: node.id,
        status: 'pending',
        timestamp: Date.now(),
      });
    }
  }

  // ==========================================================================
  // Execution State
  // ==========================================================================

  /**
   * Start execution
   */
  startExecution(): void {
    if (this.state.status === 'running') {
      return;
    }

    this.state.status = 'running';
    this.state.startTime = Date.now();
    this.state.endTime = null;
    this.state.progress = 0;

    this.emitExecutionStateChange('running');
  }

  /**
   * Complete execution
   */
  completeExecution(): void {
    this.state.status = 'completed';
    this.state.endTime = Date.now();
    this.state.currentNodeId = null;

    this.emitExecutionStateChange('completed');
  }

  /**
   * Fail execution
   */
  failExecution(errorMessage: string): void {
    this.state.status = 'failed';
    this.state.endTime = Date.now();
    this.state.currentNodeId = null;

    this.addLog('system', 'error', errorMessage);
    this.emitExecutionStateChange('failed');
  }

  /**
   * Cancel execution
   */
  cancelExecution(): void {
    this.state.status = 'cancelled';
    this.state.endTime = Date.now();
    this.state.currentNodeId = null;

    this.emitExecutionStateChange('cancelled');
  }

  // ==========================================================================
  // Node Status Updates
  // ==========================================================================

  /**
   * Update node status
   */
  updateNodeStatus(
    nodeId: string,
    status: NodeStatusEvent['status']
  ): void {
    const nodeStatus = this.state.nodes.get(nodeId);
    if (!nodeStatus) {
      return;
    }

    const now = Date.now();
    let executionTime: number | undefined;

    if (status === 'executing') {
      this.nodeStartTimes.set(nodeId, now);
      this.state.currentNodeId = nodeId;
    } else if (status === 'completed' || status === 'failed') {
      const startTime = this.nodeStartTimes.get(nodeId);
      if (startTime) {
        executionTime = now - startTime;
      }
      if (this.state.currentNodeId === nodeId) {
        this.state.currentNodeId = null;
      }
    }

    const event: NodeStatusEvent = {
      nodeId,
      status,
      timestamp: now,
      executionTime,
    };

    this.state.nodes.set(nodeId, event);
    this.emitNodeStatusChange(event);
    this.updateProgress();
  }

  // ==========================================================================
  // Progress Calculation
  // ==========================================================================

  /**
   * Update and emit progress
   */
  private updateProgress(): void {
    const totalNodes = this.state.nodes.size;
    if (totalNodes === 0) {
      return;
    }

    let completedOrFailed = 0;
    for (const [, nodeStatus] of this.state.nodes) {
      if (nodeStatus.status === 'completed' || nodeStatus.status === 'failed') {
        completedOrFailed++;
      }
    }

    const progress = Math.round((completedOrFailed / totalNodes) * 100);
    this.state.progress = progress;

    this.emitProgressUpdate(progress);
  }

  // ==========================================================================
  // Log Management
  // ==========================================================================

  /**
   * Add log entry
   */
  addLog(nodeId: string, level: ExecutionLogEntry['level'], message: string): void {
    const entry: ExecutionLogEntry = {
      nodeId,
      level,
      message,
      timestamp: Date.now(),
    };

    this.state.logs.push(entry);

    // Trim logs if exceeding max
    while (this.state.logs.length > this.options.maxLogEntries) {
      this.state.logs.shift();
    }

    this.emitLogEntry(entry);
  }

  /**
   * Get logs for a specific node
   */
  getLogsForNode(nodeId: string): ExecutionLogEntry[] {
    return this.state.logs.filter((log) => log.nodeId === nodeId);
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: ExecutionLogEntry['level']): ExecutionLogEntry[] {
    return this.state.logs.filter((log) => log.level === level);
  }

  // ==========================================================================
  // Event Subscriptions
  // ==========================================================================

  /**
   * Subscribe to node status changes
   */
  onNodeStatusChange(callback: NodeStatusCallback): Unsubscribe {
    this.nodeStatusListeners.add(callback);
    return () => {
      this.nodeStatusListeners.delete(callback);
    };
  }

  /**
   * Subscribe to execution state changes
   */
  onExecutionStateChange(callback: ExecutionStateCallback): Unsubscribe {
    this.executionStateListeners.add(callback);
    return () => {
      this.executionStateListeners.delete(callback);
    };
  }

  /**
   * Subscribe to progress updates
   */
  onProgressUpdate(callback: ProgressCallback): Unsubscribe {
    this.progressListeners.add(callback);
    return () => {
      this.progressListeners.delete(callback);
    };
  }

  /**
   * Subscribe to log entries
   */
  onLogEntry(callback: LogCallback): Unsubscribe {
    this.logListeners.add(callback);
    return () => {
      this.logListeners.delete(callback);
    };
  }

  // ==========================================================================
  // Event Emission
  // ==========================================================================

  private emitNodeStatusChange(event: NodeStatusEvent): void {
    for (const callback of this.nodeStatusListeners) {
      try {
        callback(event);
      } catch (error) {
        console.error('[WorkflowExecutionVisualizerService] Error in node status callback:', error);
      }
    }
  }

  private emitExecutionStateChange(status: WorkflowExecutionState['status']): void {
    for (const callback of this.executionStateListeners) {
      try {
        callback(status);
      } catch (error) {
        console.error('[WorkflowExecutionVisualizerService] Error in execution state callback:', error);
      }
    }
  }

  private emitProgressUpdate(progress: number): void {
    const now = Date.now();

    // Throttle progress updates
    if (now - this.lastProgressUpdate < this.options.updateThrottleMs) {
      this.pendingProgressUpdate = progress;
      return;
    }

    this.lastProgressUpdate = now;
    this.pendingProgressUpdate = null;

    for (const callback of this.progressListeners) {
      try {
        callback(progress);
      } catch (error) {
        console.error('[WorkflowExecutionVisualizerService] Error in progress callback:', error);
      }
    }
  }

  private emitLogEntry(entry: ExecutionLogEntry): void {
    for (const callback of this.logListeners) {
      try {
        callback(entry);
      } catch (error) {
        console.error('[WorkflowExecutionVisualizerService] Error in log callback:', error);
      }
    }
  }

  // ==========================================================================
  // StateStreamManager Integration
  // ==========================================================================

  /**
   * Handle events from StateStreamManager
   */
  handleStreamEvent(event: StreamEvent): void {
    switch (event.type) {
      case 'node-started': {
        const data = event.data as { nodeId: string; timestamp: number };
        this.updateNodeStatus(data.nodeId, 'executing');
        break;
      }
      case 'node-completed': {
        const data = event.data as {
          nodeId: string;
          timestamp: number;
          status: 'completed' | 'failed';
        };
        this.updateNodeStatus(data.nodeId, data.status);
        break;
      }
      case 'logs-batch': {
        const logs = event.data as Array<{
          source: string;
          level: string;
          message: string;
          timestamp: number;
        }>;
        for (const log of logs) {
          this.addLog(
            log.source,
            log.level as ExecutionLogEntry['level'],
            log.message
          );
        }
        break;
      }
      case 'phase-change': {
        const data = event.data as { from: string; to: string };
        if (data.to === 'complete') {
          this.completeExecution();
        }
        break;
      }
      case 'error': {
        const errors = event.data as Array<{ message: string }>;
        for (const error of errors) {
          this.addLog('system', 'error', error.message);
        }
        break;
      }
      case 'complete': {
        this.completeExecution();
        break;
      }
    }
  }

  // ==========================================================================
  // Snapshot
  // ==========================================================================

  /**
   * Create state snapshot
   */
  createSnapshot(): StateSnapshot {
    let completedCount = 0;
    let failedCount = 0;
    const nodeStatuses: StateSnapshot['nodeStatuses'] = [];

    for (const [nodeId, nodeStatus] of this.state.nodes) {
      nodeStatuses.push({ nodeId, status: nodeStatus.status });
      if (nodeStatus.status === 'completed') {
        completedCount++;
      } else if (nodeStatus.status === 'failed') {
        failedCount++;
      }
    }

    return {
      status: this.state.status,
      progress: this.state.progress,
      nodesCount: this.state.nodes.size,
      completedCount,
      failedCount,
      logsCount: this.state.logs.length,
      startTime: this.state.startTime,
      endTime: this.state.endTime,
      nodeStatuses,
    };
  }

  /**
   * Restore from snapshot
   */
  restoreFromSnapshot(snapshot: StateSnapshot, nodes: WorkflowNodeDef[]): void {
    this.initializeWorkflow(nodes);

    this.state.status = snapshot.status;
    this.state.progress = snapshot.progress;
    this.state.startTime = snapshot.startTime;
    this.state.endTime = snapshot.endTime;

    // Restore node statuses
    for (const { nodeId, status } of snapshot.nodeStatuses) {
      const nodeStatus = this.state.nodes.get(nodeId);
      if (nodeStatus) {
        nodeStatus.status = status;
      }
    }
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Destroy service and cleanup
   */
  destroy(): void {
    this.state = this.createInitialState();
    this.nodeStartTimes.clear();
    this.nodeStatusListeners.clear();
    this.executionStateListeners.clear();
    this.progressListeners.clear();
    this.logListeners.clear();
    this.pendingProgressUpdate = null;
  }
}

export default WorkflowExecutionVisualizerService;
