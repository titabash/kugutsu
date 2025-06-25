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
    }
};
// contextIsolationが有効な場合のみcontextBridgeを使用
if (process.contextIsolated) {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI);
}
//# sourceMappingURL=index.js.map