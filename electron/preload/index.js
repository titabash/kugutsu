"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electronAPI = {
    // ログ関連
    sendLog: (data) => electron_1.ipcRenderer.invoke('log-message', data),
    onLogData: (callback) => {
        electron_1.ipcRenderer.on('log-data', (event, data) => callback(data));
    },
    onStructuredLogData: (callback) => {
        electron_1.ipcRenderer.on('structured-log-data', (event, data) => callback(data));
    },
    // レイアウト関連
    updateLayout: (engineerCount) => electron_1.ipcRenderer.invoke('update-layout', engineerCount),
    onLayoutUpdate: (callback) => {
        electron_1.ipcRenderer.on('layout-update', (event, engineerCount) => callback(engineerCount));
    },
    // タスクステータス関連
    onTaskStatusUpdate: (callback) => {
        electron_1.ipcRenderer.on('task-status-update', (event, data) => callback(data));
    },
    // ターミナルクリア
    onClearTerminal: (callback) => {
        electron_1.ipcRenderer.on('clear-terminal', (event, terminalId) => callback(terminalId));
    },
    // 接続ステータス
    onConnectionStatus: (callback) => {
        electron_1.ipcRenderer.on('connection-status', (event, connected) => callback(connected));
    },
    // イベントリスナーの削除
    removeAllListeners: (channel) => {
        electron_1.ipcRenderer.removeAllListeners(channel);
    }
};
// contextIsolationが有効な場合のみcontextBridgeを使用
if (process.contextIsolated) {
    electron_1.contextBridge.exposeInMainWorld('electronAPI', electronAPI);
}
//# sourceMappingURL=index.js.map