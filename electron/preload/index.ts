// Preloadスクリプトの最初にログを出力
console.log('[Preload] Starting preload script execution...');

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

console.log('[Preload] Electron modules loaded successfully');

const electronAPI = {
  // ==========================================
  // LangGraph IPC API (New Architecture)
  // ==========================================

  /**
   * Listen for batched graph events
   */
  onGraphEventsBatch: (callback: (events: any[]) => void) => {
    const listener = (_event: IpcRendererEvent, events: any[]) => {
      callback(events);
    };
    ipcRenderer.on('graph-events-batch', listener);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('graph-events-batch', listener);
    };
  },

  /**
   * Pause execution
   */
  pauseExecution: () => ipcRenderer.invoke('pause-execution'),

  /**
   * Resume execution
   */
  resumeExecution: () => ipcRenderer.invoke('resume-execution'),

  /**
   * Cancel execution
   */
  cancelExecution: () => ipcRenderer.invoke('cancel-execution'),

  /**
   * Get current graph state
   */
  getGraphState: () => ipcRenderer.invoke('get-graph-state'),

  /**
   * Get task details by ID
   */
  getTaskDetails: (taskId: string) => ipcRenderer.invoke('get-task-details', taskId),

  /**
   * Log error from renderer
   */
  logError: (message: string, details?: any) =>
    ipcRenderer.invoke('log-error', { message, details }),

  // ==========================================
  // Legacy API (Backward Compatibility)
  // ==========================================

  // ログ関連
  sendLog: (data: any) => ipcRenderer.invoke('log-message', data),
  onLogData: (callback: (data: any) => void) => {
    ipcRenderer.on('log-data', (_event: IpcRendererEvent, data: any) => callback(data));
  },
  onStructuredLogData: (callback: (data: any) => void) => {
    ipcRenderer.on('structured-log-data', (_event: IpcRendererEvent, data: any) => callback(data));
  },

  // レイアウト関連
  updateLayout: (engineerCount: number) => ipcRenderer.invoke('update-layout', engineerCount),
  onLayoutUpdate: (callback: (engineerCount: number) => void) => {
    ipcRenderer.on('layout-update', (_event: IpcRendererEvent, engineerCount: number) => callback(engineerCount));
  },

  // タスクステータス関連
  onTaskStatusUpdate: (callback: (data: { completed: number; total: number }) => void) => {
    ipcRenderer.on('task-status-update', (_event: IpcRendererEvent, data: { completed: number; total: number }) => callback(data));
  },
  
  // 全タスク完了通知
  onAllTasksCompleted: (callback: (data: any) => void) => {
    ipcRenderer.on('all-tasks-completed', (_event: IpcRendererEvent, data: any) => callback(data));
  },

  // ターミナルクリア
  onClearTerminal: (callback: (terminalId: string) => void) => {
    ipcRenderer.on('clear-terminal', (_event: IpcRendererEvent, terminalId: string) => callback(terminalId));
  },

  // 接続ステータス
  onConnectionStatus: (callback: (connected: boolean) => void) => {
    ipcRenderer.on('connection-status', (_event: IpcRendererEvent, connected: boolean) => callback(connected));
  },
  
  // TechLeadとEngineerの関連付け
  onAssociateTechLeadEngineer: (callback: (data: { techLeadId: string; engineerId: string }) => void) => {
    ipcRenderer.on('associate-techlead-engineer', (_event: IpcRendererEvent, data: { techLeadId: string; engineerId: string }) => callback(data));
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
    ipcRenderer.on('tasks-updated', (_event: IpcRendererEvent, tasks: any[]) => callback(tasks));
  },
  onTaskOverviewUpdate: (callback: (overview: string) => void) => {
    ipcRenderer.on('task-overview-updated', (_event: IpcRendererEvent, overview: string) => callback(overview));
  },

  // プロジェクト管理関連
  getCurrentProjectPath: () => ipcRenderer.invoke('get-current-project-path'),
  openProjectDialog: () => ipcRenderer.invoke('open-project-dialog'),
  onProjectOpened: (callback: (data: { projectPath: string }) => void) => {
    ipcRenderer.on('project-opened', (_event: IpcRendererEvent, data: { projectPath: string }) => callback(data));
  },
  onProjectClosed: (callback: () => void) => {
    ipcRenderer.on('project-closed', (_event: IpcRendererEvent) => callback());
  }
};

// デバッグ情報を追加
console.log('[Preload] Running preload script');
console.log('[Preload] electronAPI methods:', Object.keys(electronAPI));

try {
  // contextIsolationが無効なので、windowオブジェクトに直接追加
  console.log('[Preload] Adding electronAPI to window directly');
  (window as any).electronAPI = electronAPI;
  
  // globalThisにも追加（念のため）
  (globalThis as any).electronAPI = electronAPI;
  
  // デバッグ: 追加されたことを確認
  console.log('[Preload] electronAPI added to window:', !!(window as any).electronAPI);
  console.log('[Preload] electronAPI added to globalThis:', !!(globalThis as any).electronAPI);
  
  // テスト呼び出し
  console.log('[Preload] Testing getWorkingDirectory function existence:', typeof (window as any).electronAPI.getWorkingDirectory);
} catch (error) {
  console.error('[Preload] Error setting up electronAPI:', error);
}

// ESMとしてexport
export { electronAPI };