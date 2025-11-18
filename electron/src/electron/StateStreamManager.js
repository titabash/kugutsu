/**
 * State Stream Manager
 *
 * LangGraph state stream → Electron IPC with optimization
 *
 * Features:
 * - Buffering: Accumulates state updates in a 50ms buffer
 * - Batch sending: Sends buffered events in bulk to reduce overhead
 * - Diff detection: Compares with previous state and sends only changes
 * - Throttling: Limits send frequency to max 20 events/sec
 * - Priority control: Prioritizes important events (errors, etc.)
 */
export class StateStreamManager {
    window = null;
    buffer = [];
    flushInterval = null;
    previousState = null;
    lastFlushTime = 0;
    options;
    destroyed = false;
    // ノードフロー管理
    nodeFlowData = null;
    nodeExecutionTimes = new Map();
    constructor(options = {}) {
        this.options = {
            bufferInterval: options.bufferInterval ?? 50,
            maxEventsPerSecond: options.maxEventsPerSecond ?? 20,
            maxBufferSize: options.maxBufferSize ?? 100,
            maxLogBuffer: options.maxLogBuffer ?? 1000,
        };
    }
    /**
     * Set BrowserWindow and start flushing
     */
    setWindow(window) {
        this.window = window;
        if (window && !this.destroyed) {
            this.startFlushing();
        }
        else {
            this.stopFlushing();
        }
    }
    /**
     * Process LangGraph state update
     */
    async processStateUpdate(state) {
        if (!this.window || this.destroyed)
            return;
        // Detect changes
        const events = this.detectChanges(this.previousState, state);
        // Add to buffer (sorted by priority)
        events.forEach((event) => this.addToBuffer(event));
        // Save state
        this.previousState = this.cloneState(state);
        // Flush immediately if buffer is full
        if (this.buffer.length >= this.options.maxBufferSize) {
            this.flush();
        }
    }
    /**
     * Detect changes and generate events
     */
    detectChanges(prev, current) {
        const events = [];
        // First time: send entire state
        if (!prev) {
            events.push({
                type: 'state-init',
                data: current,
                timestamp: Date.now(),
                priority: 'high',
            });
            return events;
        }
        // Node execution state change
        const currentNode = this.getCurrentNode(current);
        const prevNode = this.getCurrentNode(prev);
        if (currentNode !== prevNode && currentNode) {
            events.push({
                type: 'node-started',
                data: { nodeId: currentNode },
                timestamp: Date.now(),
                priority: 'high',
            });
        }
        // Task updates detection
        const taskUpdates = this.detectTaskChanges(prev.tasks, current.tasks);
        if (taskUpdates.length > 0) {
            events.push({
                type: 'tasks-batch',
                data: taskUpdates,
                timestamp: Date.now(),
                priority: 'normal',
            });
        }
        // Log additions detection
        const newLogs = current.logs.slice(prev.logs.length);
        if (newLogs.length > 0) {
            events.push({
                type: 'logs-batch',
                data: newLogs,
                timestamp: Date.now(),
                priority: 'low',
            });
        }
        // Phase change detection
        if (current.metadata.phase !== prev.metadata.phase) {
            events.push({
                type: 'phase-change',
                data: {
                    from: prev.metadata.phase,
                    to: current.metadata.phase,
                },
                timestamp: Date.now(),
                priority: 'high',
            });
        }
        // Error detection
        if (current.metadata.hasErrors && !prev.metadata.hasErrors) {
            events.push({
                type: 'error',
                data: current.metadata.errors,
                timestamp: Date.now(),
                priority: 'high',
            });
        }
        // Completion detection
        if (current.metadata.phase === 'complete' &&
            prev.metadata.phase !== 'complete') {
            events.push({
                type: 'complete',
                data: {
                    totalTasks: current.metadata.totalTasks,
                    tasksCompleted: current.metadata.tasksCompleted,
                    tasksFailed: current.metadata.tasksFailed,
                },
                timestamp: Date.now(),
                priority: 'high',
            });
        }
        return events;
    }
    /**
     * Current node being executed (set via notifyNodeExecution)
     */
    currentNode = null;
    /**
     * Notify the StateStreamManager about node execution from LangGraph
     * This replaces the previous log-based inference approach
     *
     * @param nodeName - Name of the node being executed
     * @param status - Execution status ('started' | 'completed' | 'failed')
     * @param state - Current state (optional, for additional context)
     */
    async notifyNodeExecution(nodeName, status, state) {
        if (!this.window || this.destroyed)
            return;
        const now = Date.now();
        if (status === 'started') {
            this.currentNode = nodeName;
            // 実行時間の記録開始
            this.nodeExecutionTimes.set(nodeName, { startedAt: now });
            // ノードフロー状態の更新
            if (this.nodeFlowData) {
                this.updateNodeStatus(nodeName, 'executing', now);
            }
            // Add node-started event to buffer
            this.addToBuffer({
                type: 'node-started',
                data: {
                    nodeName,
                    timestamp: now,
                },
                timestamp: now,
                priority: 'high',
            });
        }
        else if (status === 'completed' || status === 'failed') {
            // 実行時間の記録終了
            const timing = this.nodeExecutionTimes.get(nodeName);
            if (timing) {
                timing.completedAt = now;
            }
            const executionTime = timing ? now - timing.startedAt : undefined;
            // ノードフロー状態の更新
            if (this.nodeFlowData) {
                this.updateNodeStatus(nodeName, status === 'completed' ? 'completed' : 'failed', now, executionTime);
            }
            // Add node-completed event to buffer
            this.addToBuffer({
                type: 'node-completed',
                data: {
                    nodeName,
                    status,
                    timestamp: now,
                    executionTime,
                },
                timestamp: now,
                priority: 'high',
            });
            // Clear current node after completion
            if (this.currentNode === nodeName) {
                this.currentNode = null;
            }
        }
    }
    /**
     * ノードフロー全体を初期化
     *
     * @param flowData - ノードフローデータ（ノードとエッジ）
     */
    initializeNodeFlow(flowData) {
        if (!this.window || this.destroyed)
            return;
        this.nodeFlowData = flowData;
        // ノードフロー初期化イベントを送信
        this.addToBuffer({
            type: 'node-flow-init',
            data: flowData,
            timestamp: Date.now(),
            priority: 'high',
        });
    }
    /**
     * ノードの状態を更新
     *
     * @param nodeId - ノードID
     * @param status - 新しい状態
     * @param timestamp - タイムスタンプ
     * @param executionTime - 実行時間（ミリ秒）
     */
    updateNodeStatus(nodeId, status, timestamp, executionTime) {
        if (!this.nodeFlowData)
            return;
        const node = this.nodeFlowData.nodes.find((n) => n.id === nodeId);
        if (!node)
            return;
        // 状態の更新
        const previousStatus = node.status;
        node.status = status;
        if (status === 'executing') {
            node.startedAt = timestamp;
        }
        else if (status === 'completed' || status === 'failed') {
            node.completedAt = timestamp;
            if (executionTime !== undefined) {
                node.executionTime = executionTime;
            }
        }
        // 状態変更イベントを送信
        this.addToBuffer({
            type: 'node-status-change',
            data: {
                nodeId,
                status,
                previousStatus,
                timestamp,
                executionTime,
            },
            timestamp,
            priority: 'high',
        });
    }
    /**
     * ノードフローを初期化
     */
    initNodeFlow(flowData) {
        this.nodeFlowData = flowData;
        this.nodeExecutionTimes.clear();
        console.log('[StateStreamManager] Node flow initialized:', flowData);
        // 初期化イベントを送信
        this.addToBuffer({
            type: 'node-flow-init',
            data: flowData,
            timestamp: Date.now(),
            priority: 'high',
        });
    }
    /**
     * 現在のノードフロー状態を取得
     */
    getNodeFlowData() {
        return this.nodeFlowData;
    }
    /**
     * Get current node (now directly set via notifyNodeExecution)
     * @deprecated Use notifyNodeExecution instead of log-based inference
     */
    getCurrentNode(state) {
        // Return the directly set current node (from LangGraph debug events)
        if (this.currentNode) {
            return this.currentNode;
        }
        // Fallback: Check logs (deprecated, for backward compatibility)
        const recentLogs = state.logs.slice(-10);
        for (const log of recentLogs.reverse()) {
            if (log.source && log.source !== 'system') {
                return log.source;
            }
        }
        return null;
    }
    /**
     * Detect task changes
     */
    detectTaskChanges(prevTasks, currentTasks) {
        const taskMap = new Map(prevTasks.map((t) => [t.id, t]));
        const updates = [];
        for (const task of currentTasks) {
            const prevTask = taskMap.get(task.id);
            if (!prevTask || this.hasTaskChanged(prevTask, task)) {
                updates.push(task);
            }
        }
        return updates;
    }
    /**
     * Check if task has changed
     */
    hasTaskChanged(prev, current) {
        return (prev.status !== current.status ||
            prev.assignedEngineer !== current.assignedEngineer ||
            prev.branchName !== current.branchName ||
            prev.sessionId !== current.sessionId);
    }
    /**
     * Add event to buffer (priority sorted)
     */
    addToBuffer(event) {
        this.buffer.push(event);
        // Sort by priority (high → normal → low)
        this.buffer.sort((a, b) => {
            const priorityOrder = { high: 0, normal: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    }
    /**
     * Start periodic flushing
     */
    startFlushing() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }
        this.flushInterval = setInterval(() => {
            this.flush();
        }, this.options.bufferInterval);
    }
    /**
     * Stop flushing
     */
    stopFlushing() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
    }
    /**
     * Flush buffer (batch send)
     */
    flush() {
        if (!this.window || this.buffer.length === 0 || this.destroyed)
            return;
        // Throttling check
        const now = Date.now();
        const timeSinceLastFlush = now - this.lastFlushTime;
        const minInterval = 1000 / this.options.maxEventsPerSecond;
        if (timeSinceLastFlush < minInterval) {
            // Cannot send yet
            return;
        }
        try {
            // Send event batch
            if (!this.window.isDestroyed()) {
                this.window.webContents.send('graph-events-batch', this.buffer);
            }
            // Clear buffer
            this.buffer = [];
            this.lastFlushTime = now;
        }
        catch (error) {
            console.error('[StateStreamManager] Failed to flush events:', error);
        }
    }
    /**
     * Deep copy state
     */
    cloneState(state) {
        // Use JSON for deep copy (Note: Maps will be converted to objects)
        return JSON.parse(JSON.stringify(state, (key, value) => {
            // Convert Map to object for serialization
            if (value instanceof Map) {
                return Object.fromEntries(value);
            }
            return value;
        }));
    }
    /**
     * Cleanup
     */
    destroy() {
        this.destroyed = true;
        this.stopFlushing();
        this.flush(); // Send remaining events
        this.buffer = [];
        this.previousState = null;
        this.window = null;
        this.nodeFlowData = null;
        this.nodeExecutionTimes.clear();
        this.currentNode = null;
    }
}
/**
 * Singleton instance (optional)
 */
let managerInstance = null;
export function getStateStreamManager(options) {
    if (!managerInstance) {
        managerInstance = new StateStreamManager(options);
    }
    return managerInstance;
}
export function destroyStateStreamManager() {
    if (managerInstance) {
        managerInstance.destroy();
        managerInstance = null;
    }
}
//# sourceMappingURL=StateStreamManager.js.map