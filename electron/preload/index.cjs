"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.electronAPI = void 0;
// Preloadスクリプトの最初にログを出力
console.log('[Preload] Starting preload script execution...');
const electron_1 = require("electron");
console.log('[Preload] Electron modules loaded successfully');
const electronAPI = {
    // ==========================================
    // LangGraph IPC API (New Architecture)
    // ==========================================
    /**
     * Listen for batched graph events
     */
    onGraphEventsBatch: (callback) => {
        const listener = (_event, events) => {
            callback(events);
        };
        electron_1.ipcRenderer.on('graph-events-batch', listener);
        // Return cleanup function
        return () => {
            electron_1.ipcRenderer.removeListener('graph-events-batch', listener);
        };
    },
    /**
     * Pause execution
     */
    pauseExecution: () => electron_1.ipcRenderer.invoke('pause-execution'),
    /**
     * Resume execution
     */
    resumeExecution: () => electron_1.ipcRenderer.invoke('resume-execution'),
    /**
     * Cancel execution
     */
    cancelExecution: () => electron_1.ipcRenderer.invoke('cancel-execution'),
    /**
     * Get current graph state
     */
    getGraphState: () => electron_1.ipcRenderer.invoke('get-graph-state'),
    /**
     * Get task details by ID
     */
    getTaskDetails: (taskId) => electron_1.ipcRenderer.invoke('get-task-details', taskId),
    /**
     * Log error from renderer
     */
    logError: (message, details) => electron_1.ipcRenderer.invoke('log-error', { message, details }),
    // ==========================================
    // Legacy API (Backward Compatibility)
    // ==========================================
    // ログ関連
    sendLog: (data) => electron_1.ipcRenderer.invoke('log-message', data),
    onLogData: (callback) => {
        electron_1.ipcRenderer.on('log-data', (_event, data) => callback(data));
    },
    onStructuredLogData: (callback) => {
        electron_1.ipcRenderer.on('structured-log-data', (_event, data) => callback(data));
    },
    // レイアウト関連
    updateLayout: (engineerCount) => electron_1.ipcRenderer.invoke('update-layout', engineerCount),
    onLayoutUpdate: (callback) => {
        electron_1.ipcRenderer.on('layout-update', (_event, engineerCount) => callback(engineerCount));
    },
    // タスクステータス関連
    onTaskStatusUpdate: (callback) => {
        electron_1.ipcRenderer.on('task-status-update', (_event, data) => callback(data));
    },
    // 全タスク完了通知
    onAllTasksCompleted: (callback) => {
        electron_1.ipcRenderer.on('all-tasks-completed', (_event, data) => callback(data));
    },
    // ターミナルクリア
    onClearTerminal: (callback) => {
        electron_1.ipcRenderer.on('clear-terminal', (_event, terminalId) => callback(terminalId));
    },
    // 接続ステータス
    onConnectionStatus: (callback) => {
        electron_1.ipcRenderer.on('connection-status', (_event, connected) => callback(connected));
    },
    // TechLeadとEngineerの関連付け
    onAssociateTechLeadEngineer: (callback) => {
        electron_1.ipcRenderer.on('associate-techlead-engineer', (_event, data) => callback(data));
    },
    // イベントリスナーの削除
    removeAllListeners: (channel) => {
        electron_1.ipcRenderer.removeAllListeners(channel);
    },
    // タスク管理関連
    getTasks: () => electron_1.ipcRenderer.invoke('get-tasks'),
    getTaskOverview: () => electron_1.ipcRenderer.invoke('get-task-overview'),
    getTaskInstruction: (taskId) => electron_1.ipcRenderer.invoke('get-task-instruction', taskId),
    getWorkingDirectory: () => electron_1.ipcRenderer.invoke('get-working-directory'),
    onTaskUpdate: (callback) => {
        electron_1.ipcRenderer.on('tasks-updated', (_event, tasks) => callback(tasks));
    },
    onTaskOverviewUpdate: (callback) => {
        electron_1.ipcRenderer.on('task-overview-updated', (_event, overview) => callback(overview));
    },
    // プロジェクト管理関連
    getCurrentProjectPath: () => electron_1.ipcRenderer.invoke('get-current-project-path'),
    openProjectDialog: () => electron_1.ipcRenderer.invoke('open-project-dialog'),
    onProjectOpened: (callback) => {
        electron_1.ipcRenderer.on('project-opened', (_event, data) => callback(data));
    },
    onProjectClosed: (callback) => {
        electron_1.ipcRenderer.on('project-closed', (_event) => callback());
    }
};
exports.electronAPI = electronAPI;
// デバッグ情報を追加
console.log('[Preload] Running preload script');
console.log('[Preload] electronAPI methods:', Object.keys(electronAPI));
try {
    // contextIsolationが無効なので、windowオブジェクトに直接追加
    console.log('[Preload] Adding electronAPI to window directly');
    window.electronAPI = electronAPI;
    // globalThisにも追加（念のため）
    globalThis.electronAPI = electronAPI;
    // デバッグ: 追加されたことを確認
    console.log('[Preload] electronAPI added to window:', !!window.electronAPI);
    console.log('[Preload] electronAPI added to globalThis:', !!globalThis.electronAPI);
    // テスト呼び出し
    console.log('[Preload] Testing getWorkingDirectory function existence:', typeof window.electronAPI.getWorkingDirectory);
}
catch (error) {
    console.error('[Preload] Error setting up electronAPI:', error);
}
//# sourceMappingURL=index.js.map