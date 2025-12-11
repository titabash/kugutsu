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
  // File System Events
  // ==========================================

  /**
   * Listen for initial data loaded events
   * @param fileType - Type of file (e.g., 'tasks', 'dependency-graph', 'story-map')
   */
  onInitialDataLoaded: (fileType: string, callback: (data: any) => void) => {
    const eventName = `initial-data-loaded:${fileType}`;
    const listener = (_event: IpcRendererEvent, data: any) => {
      callback(data);
    };
    ipcRenderer.on(eventName, listener);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(eventName, listener);
    };
  },

  /**
   * Listen for file changed events
   * @param fileType - Type of file (e.g., 'tasks', 'dependency-graph', 'story-map')
   */
  onFileChanged: (fileType: string, callback: (data: any) => void) => {
    const eventName = `file-changed:${fileType}`;
    const listener = (_event: IpcRendererEvent, data: any) => {
      callback(data);
    };
    ipcRenderer.on(eventName, listener);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(eventName, listener);
    };
  },

  // ==========================================
  // Node Flow Events
  // ==========================================

  /**
   * Listen for node flow initialization
   */
  onNodeFlowInit: (callback: (flowData: any) => void) => {
    const listener = (_event: IpcRendererEvent, flowData: any) => {
      callback(flowData);
    };
    ipcRenderer.on('node-flow-init', listener);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('node-flow-init', listener);
    };
  },

  /**
   * Listen for node status changes
   */
  onNodeStatusChange: (callback: (data: { nodeId: string; status: string; timestamp: number }) => void) => {
    const listener = (_event: IpcRendererEvent, data: { nodeId: string; status: string; timestamp: number }) => {
      callback(data);
    };
    ipcRenderer.on('node-status-change', listener);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('node-status-change', listener);
    };
  },

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
  },

  // プロンプト実行関連
  executePrompt: (prompt: string, options: { provider?: string; maxEngineers?: number; maxTurns?: number }) =>
    ipcRenderer.invoke('execute-prompt', { prompt, options }),

  // ==========================================
  // Workflow Editor API
  // ==========================================

  /**
   * Show save workflow dialog
   */
  showSaveWorkflowDialog: () => ipcRenderer.invoke('show-save-workflow-dialog'),

  /**
   * Show load workflow dialog
   */
  showLoadWorkflowDialog: () => ipcRenderer.invoke('show-load-workflow-dialog'),

  /**
   * Save workflow to file
   */
  saveWorkflow: (filePath: string, workflow: any) =>
    ipcRenderer.invoke('save-workflow', { filePath, workflow }),

  /**
   * Load workflow from file
   */
  loadWorkflow: (filePath: string) =>
    ipcRenderer.invoke('load-workflow', { filePath }),

  /**
   * Execute workflow
   */
  executeWorkflow: (workflow: any) =>
    ipcRenderer.invoke('execute-workflow', { workflow }),

  /**
   * Execute workflow with prompt
   * チャットパネルからのプロンプト入力をStartノードに渡してワークフローを実行
   */
  executeWorkflowWithPrompt: (workflow: any, prompt: string) =>
    ipcRenderer.invoke('execute-workflow-with-prompt', { workflow, prompt }),

  /**
   * Listen for workflow execution progress
   */
  onWorkflowProgress: (callback: (data: { nodeId: string; status: string; progress?: number }) => void) => {
    const listener = (_event: IpcRendererEvent, data: { nodeId: string; status: string; progress?: number }) => {
      callback(data);
    };
    ipcRenderer.on('workflow-progress', listener);
    return () => {
      ipcRenderer.removeListener('workflow-progress', listener);
    };
  },

  /**
   * Listen for workflow execution completed
   */
  onWorkflowCompleted: (callback: (data: { success: boolean; result?: any; error?: string }) => void) => {
    const listener = (_event: IpcRendererEvent, data: { success: boolean; result?: any; error?: string }) => {
      callback(data);
    };
    ipcRenderer.on('workflow-completed', listener);
    return () => {
      ipcRenderer.removeListener('workflow-completed', listener);
    };
  },

  /**
   * Listen for workflow node AI messages (real-time streaming)
   * AIノードからのメッセージをリアルタイムで受信
   */
  onWorkflowNodeMessage: (callback: (data: { nodeId: string; nodeLabel: string; message: any }) => void) => {
    const listener = (_event: IpcRendererEvent, data: { nodeId: string; nodeLabel: string; message: any }) => {
      callback(data);
    };
    ipcRenderer.on('workflow-node-message', listener);
    return () => {
      ipcRenderer.removeListener('workflow-node-message', listener);
    };
  }
};

// デバッグ情報を追加
console.log('[Preload] Running preload script');
console.log('[Preload] electronAPI methods:', Object.keys(electronAPI));

try {
  // セキュリティ改善: contextBridge.exposeInMainWorld を使用
  console.log('[Preload] Exposing electronAPI via contextBridge');
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);

  console.log('[Preload] electronAPI successfully exposed to renderer');
} catch (error) {
  console.error('[Preload] Error exposing electronAPI:', error);
  // フォールバック: contextIsolationが無効の場合は直接追加
  if (!process.contextIsolated) {
    console.warn('[Preload] contextIsolation is disabled, adding to window directly');
    (window as any).electronAPI = electronAPI;
  }
}

// ESMとしてexport
export { electronAPI };