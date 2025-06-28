"use strict";
// Preloadスクリプトの最初にログを出力
console.log('[Preload] Starting preload script execution...');
const { contextBridge, ipcRenderer } = require('electron');
console.log('[Preload] Electron modules loaded successfully');
const electronAPI = {
    // ログ関連
    sendLog: (data) => ipcRenderer.invoke('log-message', data),
    onLogData: (callback) => {
        ipcRenderer.on('log-data', (_event, data) => callback(data));
    },
    onStructuredLogData: (callback) => {
        ipcRenderer.on('structured-log-data', (_event, data) => callback(data));
    },
    // レイアウト関連
    updateLayout: (engineerCount) => ipcRenderer.invoke('update-layout', engineerCount),
    onLayoutUpdate: (callback) => {
        ipcRenderer.on('layout-update', (_event, engineerCount) => callback(engineerCount));
    },
    // タスクステータス関連
    onTaskStatusUpdate: (callback) => {
        ipcRenderer.on('task-status-update', (_event, data) => callback(data));
    },
    // 全タスク完了通知
    onAllTasksCompleted: (callback) => {
        ipcRenderer.on('all-tasks-completed', (_event, data) => callback(data));
    },
    // ターミナルクリア
    onClearTerminal: (callback) => {
        ipcRenderer.on('clear-terminal', (_event, terminalId) => callback(terminalId));
    },
    // 接続ステータス
    onConnectionStatus: (callback) => {
        ipcRenderer.on('connection-status', (_event, connected) => callback(connected));
    },
    // TechLeadとEngineerの関連付け
    onAssociateTechLeadEngineer: (callback) => {
        ipcRenderer.on('associate-techlead-engineer', (_event, data) => callback(data));
    },
    // イベントリスナーの削除
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    },
    // タスク管理関連
    getTasks: () => ipcRenderer.invoke('get-tasks'),
    getTaskOverview: () => ipcRenderer.invoke('get-task-overview'),
    getTaskInstruction: (taskId) => ipcRenderer.invoke('get-task-instruction', taskId),
    getWorkingDirectory: () => ipcRenderer.invoke('get-working-directory'),
    onTaskUpdate: (callback) => {
        ipcRenderer.on('tasks-updated', (_event, tasks) => callback(tasks));
    },
    onTaskOverviewUpdate: (callback) => {
        ipcRenderer.on('task-overview-updated', (_event, overview) => callback(overview));
    }
};
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
// CommonJSとしてexport
module.exports = { electronAPI };
//# sourceMappingURL=index.js.map