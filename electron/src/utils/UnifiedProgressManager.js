/**
 * Unified Progress Manager
 *
 * Centralized event management for LangGraph execution progress
 * Integrates multiple event sources (debug, tasks, values) and provides
 * unified interface for UI layers (Terminal, Electron)
 */
/**
 * Unified Progress Manager
 *
 * Manages progress tracking across multiple event sources:
 * - LangGraph debug events (node execution)
 * - LangGraph task events (parallel task execution)
 * - LangGraph value events (state updates)
 */
export class UnifiedProgressManager {
    /**
     * Active node executions
     * Key: unique execution ID (nodeName + taskId)
     */
    nodeExecutions = new Map();
    /**
     * Task to node mapping
     * Key: taskId, Value: nodeName
     */
    taskToNode = new Map();
    /**
     * Task progress tracking
     * Key: taskId
     */
    taskProgress = new Map();
    /**
     * Node started callbacks
     */
    onNodeStartedCallbacks = [];
    /**
     * Node completed callbacks
     */
    onNodeCompletedCallbacks = [];
    /**
     * Task progress callbacks
     */
    onTaskProgressCallbacks = [];
    /**
     * Process debug event from LangGraph
     *
     * Debug events provide detailed execution information including node start/end times
     */
    processDebugEvent(event) {
        const { type, payload, step, timestamp } = event;
        if (type === 'task') {
            // Task execution events (node start)
            const { name: nodeName, input, metadata } = payload || {};
            if (nodeName) {
                // Extract taskId from input (for Send API parallel execution)
                const taskId = input?.currentTaskId;
                const executionId = this.getExecutionId(nodeName, taskId);
                // Create or update node execution
                const execution = {
                    nodeName,
                    status: 'running',
                    taskId,
                    startTime: timestamp || Date.now(),
                };
                this.nodeExecutions.set(executionId, execution);
                // Track task-to-node mapping
                if (taskId) {
                    this.taskToNode.set(taskId, nodeName);
                    // Update task progress
                    this.updateTaskProgress(taskId, {
                        nodeName,
                        status: 'running',
                        progress: 0,
                        startTime: execution.startTime,
                    });
                }
                // Notify callbacks
                this.notifyNodeStarted(execution);
            }
        }
        else if (type === 'checkpoint') {
            // Checkpoint events may indicate node completion
            // (actual completion is detected via value events)
            console.log(`[UnifiedProgressManager] Checkpoint at step ${step}`);
        }
    }
    /**
     * Process task event from LangGraph
     *
     * Task events provide information about individual task execution within nodes
     */
    processTaskEvent(event) {
        const { id, name, input, result, error } = event;
        // Extract taskId from input
        const taskId = input?.currentTaskId;
        if (taskId) {
            const nodeName = this.taskToNode.get(taskId) || name;
            const executionId = this.getExecutionId(nodeName, taskId);
            // Update node execution status
            const execution = this.nodeExecutions.get(executionId);
            if (execution) {
                execution.status = result ? 'completed' : error ? 'failed' : 'running';
                execution.endTime = Date.now();
                if (error) {
                    execution.error = String(error);
                }
                this.nodeExecutions.set(executionId, execution);
            }
            // Update task progress
            this.updateTaskProgress(taskId, {
                status: result ? 'completed' : error ? 'failed' : 'running',
                progress: result ? 100 : error ? 0 : 50,
            });
        }
    }
    /**
     * Process value event from LangGraph (state updates)
     *
     * Value events indicate node completion with state updates
     */
    processValueEvent(nodeName, taskId) {
        const executionId = this.getExecutionId(nodeName, taskId);
        // Mark node execution as completed
        const execution = this.nodeExecutions.get(executionId);
        if (execution && execution.status === 'running') {
            execution.status = 'completed';
            execution.endTime = Date.now();
            this.nodeExecutions.set(executionId, execution);
            // Update task progress
            if (taskId) {
                this.updateTaskProgress(taskId, {
                    status: 'completed',
                    progress: 100,
                });
            }
            // Notify callbacks
            this.notifyNodeCompleted(execution);
        }
    }
    /**
     * Register callback for node started events
     */
    onNodeStarted(callback) {
        this.onNodeStartedCallbacks.push(callback);
    }
    /**
     * Register callback for node completed events
     */
    onNodeCompleted(callback) {
        this.onNodeCompletedCallbacks.push(callback);
    }
    /**
     * Register callback for task progress updates
     */
    onTaskProgress(callback) {
        this.onTaskProgressCallbacks.push(callback);
    }
    /**
     * Get all node executions
     */
    getNodeExecutions() {
        return new Map(this.nodeExecutions);
    }
    /**
     * Get task progress by task ID
     */
    getTaskProgress(taskId) {
        return this.taskProgress.get(taskId);
    }
    /**
     * Get all task progress
     */
    getAllTaskProgress() {
        return new Map(this.taskProgress);
    }
    /**
     * Clear all tracking data
     */
    clear() {
        this.nodeExecutions.clear();
        this.taskToNode.clear();
        this.taskProgress.clear();
    }
    /**
     * Get execution ID (unique identifier for node execution)
     */
    getExecutionId(nodeName, taskId) {
        return taskId ? `${nodeName}:${taskId}` : nodeName;
    }
    /**
     * Update task progress
     */
    updateTaskProgress(taskId, updates) {
        const existing = this.taskProgress.get(taskId) || {
            taskId,
            nodeName: updates.nodeName || '',
            progress: 0,
            status: 'pending',
        };
        const updated = {
            ...existing,
            ...updates,
        };
        this.taskProgress.set(taskId, updated);
        // Notify callbacks
        this.notifyTaskProgress(updated);
    }
    /**
     * Notify node started callbacks
     */
    notifyNodeStarted(execution) {
        for (const callback of this.onNodeStartedCallbacks) {
            try {
                callback(execution);
            }
            catch (error) {
                console.error('[UnifiedProgressManager] Error in onNodeStarted callback:', error);
            }
        }
    }
    /**
     * Notify node completed callbacks
     */
    notifyNodeCompleted(execution) {
        for (const callback of this.onNodeCompletedCallbacks) {
            try {
                callback(execution);
            }
            catch (error) {
                console.error('[UnifiedProgressManager] Error in onNodeCompleted callback:', error);
            }
        }
    }
    /**
     * Notify task progress callbacks
     */
    notifyTaskProgress(progress) {
        for (const callback of this.onTaskProgressCallbacks) {
            try {
                callback(progress);
            }
            catch (error) {
                console.error('[UnifiedProgressManager] Error in onTaskProgress callback:', error);
            }
        }
    }
}
//# sourceMappingURL=UnifiedProgressManager.js.map