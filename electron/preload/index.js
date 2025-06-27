import { contextBridge, ipcRenderer } from 'electron';
const electronAPI = {
    // ログ関連
    sendLog: (data) => ipcRenderer.invoke('log-message', data),
    onLogData: (callback) => {
        ipcRenderer.on('log-data', (event, data) => callback(data));
    },
    onStructuredLogData: (callback) => {
        ipcRenderer.on('structured-log-data', (event, data) => callback(data));
    },
    // レイアウト関連
    updateLayout: (engineerCount) => ipcRenderer.invoke('update-layout', engineerCount),
    onLayoutUpdate: (callback) => {
        ipcRenderer.on('layout-update', (event, engineerCount) => callback(engineerCount));
    },
    // タスクステータス関連
    onTaskStatusUpdate: (callback) => {
        ipcRenderer.on('task-status-update', (event, data) => callback(data));
    },
    // 全タスク完了通知
    onAllTasksCompleted: (callback) => {
        ipcRenderer.on('all-tasks-completed', (event, data) => callback(data));
    },
    // ターミナルクリア
    onClearTerminal: (callback) => {
        ipcRenderer.on('clear-terminal', (event, terminalId) => callback(terminalId));
    },
    // 接続ステータス
    onConnectionStatus: (callback) => {
        ipcRenderer.on('connection-status', (event, connected) => callback(connected));
    },
    // TechLeadとEngineerの関連付け
    onAssociateTechLeadEngineer: (callback) => {
        ipcRenderer.on('associate-techlead-engineer', (event, data) => callback(data));
    },
    // イベントリスナーの削除
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    },
    // タスク管理関連
    getTasks: () => ipcRenderer.invoke('get-tasks'),
    getTaskOverview: () => ipcRenderer.invoke('get-task-overview'),
    getTaskInstruction: (taskId) => ipcRenderer.invoke('get-task-instruction', taskId),
    onTaskUpdate: (callback) => {
        ipcRenderer.on('tasks-updated', (event, tasks) => callback(tasks));
    },
    onTaskOverviewUpdate: (callback) => {
        ipcRenderer.on('task-overview-updated', (event, overview) => callback(overview));
    }
};
// contextIsolationが有効な場合のみcontextBridgeを使用
if (process.contextIsolated) {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI);
}
else {
    // contextIsolationが無効の場合は直接globalに追加
    global.electronAPI = electronAPI;
    // または、require経由でexportする
    module.exports = { electronAPI };
}
//# sourceMappingURL=index.js.map