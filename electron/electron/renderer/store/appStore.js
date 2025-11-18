import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
/**
 * Create the application store with devtools
 */
export const useAppStore = create()(devtools((set, get) => ({
    // Initial State
    tasks: [],
    tasksById: new Map(),
    logs: [],
    maxLogs: 1000, // Keep last 1000 logs for performance
    chatMessages: [],
    maxChatMessages: 100, // Keep last 100 chat messages
    metadata: {
        totalTasks: 0,
        tasksCompleted: 0,
        tasksPending: 0,
        tasksInProgress: 0,
        tasksFailed: 0,
        activeEngineers: 0,
        isRunning: false,
        isPaused: false,
    },
    dependencyGraph: null,
    projectPath: null,
    logFilter: {
        level: 'all',
        search: '',
    },
    selectedTaskId: null,
    sprints: [],
    currentSprint: null,
    globalTasks: [],
    storyMapping: null,
    designDocs: null,
    nodeExecutions: [],
    activeNodes: new Map(),
    nodeFlowData: null,
    currentExecutingNode: null,
    executionStartTime: null,
    currentPhase: null,
    // Task Actions
    setTasks: (tasks) => {
        // Map型の処理: 配列からMapを生成（O(1)検索のため）
        // IPCで受け取った配列をMapに変換
        const tasksById = new Map(tasks.map((task) => [task.id, task]));
        // Update metadata based on tasks
        const metadata = {
            totalTasks: tasks.length,
            tasksCompleted: tasks.filter((t) => t.status === 'completed').length,
            tasksPending: tasks.filter((t) => t.status === 'pending').length,
            tasksInProgress: tasks.filter((t) => t.status === 'in_progress').length,
            tasksFailed: tasks.filter((t) => t.status === 'failed').length,
            activeEngineers: new Set(tasks
                .filter((t) => t.status === 'in_progress' && t.assignedEngineer)
                .map((t) => t.assignedEngineer)).size,
            isRunning: get().metadata.isRunning,
            isPaused: get().metadata.isPaused,
        };
        set({ tasks, tasksById, metadata });
    },
    updateTask: (taskId, updates) => {
        const task = get().tasksById.get(taskId);
        if (!task)
            return;
        const updatedTask = { ...task, ...updates, updatedAt: new Date() };
        const tasks = get().tasks.map((t) => (t.id === taskId ? updatedTask : t));
        get().setTasks(tasks);
    },
    updateTasks: (taskUpdates) => {
        // Create a map of updates by task ID
        const updatesMap = new Map(taskUpdates.map((task) => [task.id, task]));
        // Merge updates with existing tasks
        const tasks = get().tasks.map((task) => {
            const update = updatesMap.get(task.id);
            if (update) {
                return { ...task, ...update, updatedAt: new Date() };
            }
            return task;
        });
        // Add new tasks that don't exist yet
        taskUpdates.forEach((update) => {
            if (!get().tasksById.has(update.id)) {
                tasks.push({ ...update, createdAt: new Date() });
            }
        });
        get().setTasks(tasks);
    },
    addTask: (task) => {
        const tasks = [...get().tasks, task];
        get().setTasks(tasks);
    },
    // Log Actions
    addLog: (log) => {
        set((state) => {
            const logs = [...state.logs, log];
            // Keep only the last maxLogs entries for performance
            if (logs.length > state.maxLogs) {
                logs.splice(0, logs.length - state.maxLogs);
            }
            return { logs };
        });
    },
    addLogs: (newLogs) => {
        set((state) => {
            const logs = [...state.logs, ...newLogs];
            // Keep only the last maxLogs entries for performance
            if (logs.length > state.maxLogs) {
                logs.splice(0, logs.length - state.maxLogs);
            }
            return { logs };
        });
    },
    clearLogs: () => set({ logs: [] }),
    setLogFilter: (filter) => set((state) => ({
        logFilter: { ...state.logFilter, ...filter },
    })),
    // Chat Message Actions
    addChatMessage: (message) => set((state) => {
        const chatMessages = [...state.chatMessages, message];
        // Keep only the last maxChatMessages entries for performance
        if (chatMessages.length > state.maxChatMessages) {
            chatMessages.splice(0, chatMessages.length - state.maxChatMessages);
        }
        return { chatMessages };
    }),
    addChatMessages: (newMessages) => set((state) => {
        const chatMessages = [...state.chatMessages, ...newMessages];
        // Keep only the last maxChatMessages entries for performance
        if (chatMessages.length > state.maxChatMessages) {
            chatMessages.splice(0, chatMessages.length - state.maxChatMessages);
        }
        return { chatMessages };
    }),
    clearChatMessages: () => set({ chatMessages: [] }),
    updateChatMessage: (id, updates) => set((state) => {
        const chatMessages = [...state.chatMessages];
        const index = chatMessages.findIndex((msg) => msg.id === id);
        if (index !== -1) {
            chatMessages[index] = { ...chatMessages[index], ...updates };
        }
        return { chatMessages };
    }),
    setThinkingMessage: (nodeId, label, content) => set((state) => {
        const chatMessages = [...state.chatMessages];
        // Format message with label
        const formattedContent = `${label}: ${content}`;
        // Find existing thinking message for this node
        const existingIndex = chatMessages.findIndex((msg) => msg.nodeId === nodeId && msg.isThinking);
        if (existingIndex !== -1) {
            // Update existing thinking message
            chatMessages[existingIndex] = {
                ...chatMessages[existingIndex],
                content: formattedContent,
                timestamp: new Date(),
            };
        }
        else {
            // Add new thinking message
            chatMessages.push({
                id: `thinking-${nodeId}-${Date.now()}`,
                type: 'ai',
                content: formattedContent,
                timestamp: new Date(),
                nodeId,
                isThinking: true,
            });
        }
        return { chatMessages };
    }),
    clearThinkingMessage: (nodeId) => set((state) => {
        const chatMessages = state.chatMessages.filter((msg) => !(msg.nodeId === nodeId && msg.isThinking));
        return { chatMessages };
    }),
    // Metadata Actions
    setMetadata: (metadata) => set((state) => ({
        metadata: { ...state.metadata, ...metadata },
    })),
    // Graph Actions
    setDependencyGraph: (graph) => set({ dependencyGraph: graph }),
    // Project Actions
    setProjectPath: (path) => set({ projectPath: path }),
    // UI Actions
    setSelectedTaskId: (taskId) => set({ selectedTaskId: taskId }),
    // Control Actions
    pause: () => set((state) => ({
        metadata: { ...state.metadata, isPaused: true },
    })),
    resume: () => set((state) => ({
        metadata: { ...state.metadata, isPaused: false },
    })),
    // Execution State Actions
    startExecution: () => set((state) => ({
        metadata: { ...state.metadata, isRunning: true, isPaused: false },
        executionStartTime: Date.now(),
        currentPhase: 'initializing',
    })),
    stopExecution: () => set((state) => ({
        metadata: { ...state.metadata, isRunning: false, isPaused: false },
        executionStartTime: null,
        currentPhase: null,
    })),
    setCurrentPhase: (phase) => set({ currentPhase: phase }),
    // Sprint Actions
    setSprints: (sprints) => set({ sprints }),
    setCurrentSprint: (sprint) => set({ currentSprint: sprint }),
    addSprint: (sprint) => set((state) => ({
        sprints: [...state.sprints, sprint],
    })),
    updateSprint: (sprintId, updates) => set((state) => {
        const sprints = state.sprints.map((sprint) => sprint.id === sprintId ? { ...sprint, ...updates } : sprint);
        // Update currentSprint if it's the one being updated
        const currentSprint = state.currentSprint?.id === sprintId
            ? { ...state.currentSprint, ...updates }
            : state.currentSprint;
        return { sprints, currentSprint };
    }),
    setGlobalTasks: (tasks) => set({ globalTasks: tasks }),
    // Sprint Selectors
    getSprintById: (sprintId) => {
        const state = get();
        return state.sprints.find((sprint) => sprint.id === sprintId);
    },
    getTasksBySprint: (sprintId) => {
        const state = get();
        return state.globalTasks.filter((task) => task.sprint === sprintId);
    },
    getActiveSprintCount: () => {
        const state = get();
        return state.sprints.filter((sprint) => sprint.status === 'active' || sprint.status === 'planning').length;
    },
    getCompletedSprintCount: () => {
        const state = get();
        return state.sprints.filter((sprint) => sprint.status === 'completed').length;
    },
    getProductBacklogTasks: () => {
        const state = get();
        return state.globalTasks.filter((task) => task.sprint === undefined);
    },
    getCurrentSprintProgress: () => {
        const state = get();
        if (!state.currentSprint)
            return null;
        const tasks = state.globalTasks.filter((task) => task.sprint === state.currentSprint.id);
        const total = tasks.length;
        if (total === 0) {
            return {
                total: 0,
                completed: 0,
                inProgress: 0,
                pending: 0,
                failed: 0,
                percentage: 0,
            };
        }
        const completed = tasks.filter((task) => task.status === 'completed').length;
        const inProgress = tasks.filter((task) => task.status === 'in_progress').length;
        const pending = tasks.filter((task) => task.status === 'pending').length;
        const failed = tasks.filter((task) => task.status === 'failed').length;
        return {
            total,
            completed,
            inProgress,
            pending,
            failed,
            percentage: Math.round((completed / total) * 100),
        };
    },
    // Story Mapping Actions
    setStoryMapping: (storyMapping) => set({ storyMapping }),
    // Design Documents Actions
    setDesignDocs: (designDocs) => set({ designDocs }),
    // Node Execution Actions
    addNodeExecution: (execution) => set((state) => {
        const nodeExecutions = [...state.nodeExecutions, execution];
        // Map型の処理: 新しいMapインスタンスを作成（イミュータブル）
        const activeNodes = new Map(state.activeNodes);
        // Add to active nodes if status is 'started'
        if (execution.status === 'started') {
            activeNodes.set(execution.nodeName, execution);
        }
        return { nodeExecutions, activeNodes };
    }),
    updateNodeExecution: (nodeName, updates) => set((state) => {
        // Update execution in history
        const nodeExecutions = state.nodeExecutions.map((exec) => exec.nodeName === nodeName && exec.status === 'started'
            ? { ...exec, ...updates }
            : exec);
        // Map型の処理: 新しいMapインスタンスを作成（イミュータブル）
        const activeNodes = new Map(state.activeNodes);
        // Remove from active nodes if status is 'completed' or 'failed'
        if (updates.status === 'completed' || updates.status === 'failed') {
            activeNodes.delete(nodeName);
        }
        else {
            // Update active node if it exists
            const activeNode = activeNodes.get(nodeName);
            if (activeNode) {
                activeNodes.set(nodeName, { ...activeNode, ...updates });
            }
        }
        return { nodeExecutions, activeNodes };
    }),
    clearNodeExecutions: () => set({
        nodeExecutions: [],
        activeNodes: new Map(),
    }),
    // Node Execution Selectors
    getNodeExecution: (nodeName) => {
        const state = get();
        return state.nodeExecutions
            .slice()
            .reverse()
            .find((exec) => exec.nodeName === nodeName);
    },
    getActiveNodes: () => {
        const state = get();
        return Array.from(state.activeNodes.values());
    },
    getNodeExecutionHistory: (nodeName) => {
        const state = get();
        if (nodeName) {
            return state.nodeExecutions.filter((exec) => exec.nodeName === nodeName);
        }
        return state.nodeExecutions;
    },
    getNodeStatistics: (nodeName) => {
        const state = get();
        const executions = state.nodeExecutions.filter((exec) => exec.nodeName === nodeName && exec.status !== 'started');
        if (executions.length === 0)
            return null;
        const successfulExecutions = executions.filter((exec) => exec.status === 'completed').length;
        const failedExecutions = executions.filter((exec) => exec.status === 'failed').length;
        const durationsMs = executions
            .filter((exec) => exec.duration !== undefined)
            .map((exec) => exec.duration);
        const averageDuration = durationsMs.length > 0
            ? durationsMs.reduce((sum, d) => sum + d, 0) / durationsMs.length
            : 0;
        return {
            totalExecutions: executions.length,
            successfulExecutions,
            failedExecutions,
            averageDuration,
        };
    },
    // Node Flow Actions
    setNodeFlowData: (flowData) => set({ nodeFlowData: flowData }),
    setCurrentExecutingNode: (nodeName) => set({ currentExecutingNode: nodeName }),
    updateNodeFlowStatus: (nodeId, status, timestamp, executionTime) => set((state) => {
        if (!state.nodeFlowData)
            return state;
        const nodes = state.nodeFlowData.nodes.map((node) => {
            if (node.id !== nodeId)
                return node;
            const updatedNode = { ...node, status };
            if (status === 'executing') {
                updatedNode.startedAt = timestamp || Date.now();
            }
            else if (status === 'completed' || status === 'failed') {
                updatedNode.completedAt = timestamp || Date.now();
                if (executionTime !== undefined) {
                    updatedNode.executionTime = executionTime;
                }
            }
            return updatedNode;
        });
        return {
            nodeFlowData: {
                ...state.nodeFlowData,
                nodes,
            },
        };
    }),
    // Node Flow Selectors
    getFlowNode: (nodeId) => {
        const state = get();
        if (!state.nodeFlowData)
            return undefined;
        return state.nodeFlowData.nodes.find((node) => node.id === nodeId);
    },
    // Execution State Selectors
    getExecutionDuration: () => {
        const state = get();
        if (!state.executionStartTime)
            return null;
        return Date.now() - state.executionStartTime;
    },
    getExecutionStatus: () => {
        const state = get();
        if (state.metadata.tasksFailed > 0 && !state.metadata.isRunning) {
            return 'error';
        }
        if (state.metadata.isPaused) {
            return 'paused';
        }
        if (state.metadata.isRunning) {
            return 'running';
        }
        return 'idle';
    },
    getProgressPercentage: () => {
        const state = get();
        const { totalTasks, tasksCompleted } = state.metadata;
        if (totalTasks === 0)
            return 0;
        return Math.round((tasksCompleted / totalTasks) * 100);
    },
}), { name: 'KugutsuAppStore' }));
//# sourceMappingURL=appStore.js.map