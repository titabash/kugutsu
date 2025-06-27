import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  // ログ関連
  sendLog: (data: any) => ipcRenderer.invoke('log-message', data),
  onLogData: (callback: (data: any) => void) => {
    ipcRenderer.on('log-data', (event, data) => callback(data));
  },
  onStructuredLogData: (callback: (data: any) => void) => {
    ipcRenderer.on('structured-log-data', (event, data) => callback(data));
  },

  // レイアウト関連
  updateLayout: (engineerCount: number) => ipcRenderer.invoke('update-layout', engineerCount),
  onLayoutUpdate: (callback: (engineerCount: number) => void) => {
    ipcRenderer.on('layout-update', (event, engineerCount) => callback(engineerCount));
  },

  // タスクステータス関連
  onTaskStatusUpdate: (callback: (data: { completed: number; total: number }) => void) => {
    ipcRenderer.on('task-status-update', (event, data) => callback(data));
  },
  
  // 全タスク完了通知
  onAllTasksCompleted: (callback: (data: any) => void) => {
    ipcRenderer.on('all-tasks-completed', (event, data) => callback(data));
  },

  // ターミナルクリア
  onClearTerminal: (callback: (terminalId: string) => void) => {
    ipcRenderer.on('clear-terminal', (event, terminalId) => callback(terminalId));
  },

  // 接続ステータス
  onConnectionStatus: (callback: (connected: boolean) => void) => {
    ipcRenderer.on('connection-status', (event, connected) => callback(connected));
  },
  
  // TechLeadとEngineerの関連付け
  onAssociateTechLeadEngineer: (callback: (data: { techLeadId: string; engineerId: string }) => void) => {
    ipcRenderer.on('associate-techlead-engineer', (event, data) => callback(data));
  },

  // イベントリスナーの削除
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // タスク管理関連
  getTasks: () => ipcRenderer.invoke('get-tasks'),
  getTaskOverview: () => ipcRenderer.invoke('get-task-overview'),
  getTaskInstruction: (taskId: string) => ipcRenderer.invoke('get-task-instruction', taskId),
  getWorkingDirectory: () => ipcRenderer.invoke('get-working-directory'),
  onTaskUpdate: (callback: (tasks: any[]) => void) => {
    ipcRenderer.on('tasks-updated', (event, tasks) => callback(tasks));
  },
  onTaskOverviewUpdate: (callback: (overview: string) => void) => {
    ipcRenderer.on('task-overview-updated', (event, overview) => callback(overview));
  }
};

// contextIsolationが有効な場合のみcontextBridgeを使用
if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
} else {
  // contextIsolationが無効の場合は直接globalに追加
  (global as any).electronAPI = electronAPI;
  // または、require経由でexportする
  module.exports = { electronAPI };
}