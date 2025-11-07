import { ipcRenderer } from "electron";
console.log("[Preload] Starting preload script execution...");
console.log("[Preload] Electron modules loaded successfully");
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
    ipcRenderer.on("graph-events-batch", listener);
    return () => {
      ipcRenderer.removeListener("graph-events-batch", listener);
    };
  },
  /**
   * Pause execution
   */
  pauseExecution: () => ipcRenderer.invoke("pause-execution"),
  /**
   * Resume execution
   */
  resumeExecution: () => ipcRenderer.invoke("resume-execution"),
  /**
   * Cancel execution
   */
  cancelExecution: () => ipcRenderer.invoke("cancel-execution"),
  /**
   * Get current graph state
   */
  getGraphState: () => ipcRenderer.invoke("get-graph-state"),
  /**
   * Get task details by ID
   */
  getTaskDetails: (taskId) => ipcRenderer.invoke("get-task-details", taskId),
  /**
   * Log error from renderer
   */
  logError: (message, details) => ipcRenderer.invoke("log-error", { message, details }),
  // ==========================================
  // Legacy API (Backward Compatibility)
  // ==========================================
  // ログ関連
  sendLog: (data) => ipcRenderer.invoke("log-message", data),
  onLogData: (callback) => {
    ipcRenderer.on("log-data", (_event, data) => callback(data));
  },
  onStructuredLogData: (callback) => {
    ipcRenderer.on("structured-log-data", (_event, data) => callback(data));
  },
  // レイアウト関連
  updateLayout: (engineerCount) => ipcRenderer.invoke("update-layout", engineerCount),
  onLayoutUpdate: (callback) => {
    ipcRenderer.on("layout-update", (_event, engineerCount) => callback(engineerCount));
  },
  // タスクステータス関連
  onTaskStatusUpdate: (callback) => {
    ipcRenderer.on("task-status-update", (_event, data) => callback(data));
  },
  // 全タスク完了通知
  onAllTasksCompleted: (callback) => {
    ipcRenderer.on("all-tasks-completed", (_event, data) => callback(data));
  },
  // ターミナルクリア
  onClearTerminal: (callback) => {
    ipcRenderer.on("clear-terminal", (_event, terminalId) => callback(terminalId));
  },
  // 接続ステータス
  onConnectionStatus: (callback) => {
    ipcRenderer.on("connection-status", (_event, connected) => callback(connected));
  },
  // TechLeadとEngineerの関連付け
  onAssociateTechLeadEngineer: (callback) => {
    ipcRenderer.on("associate-techlead-engineer", (_event, data) => callback(data));
  },
  // イベントリスナーの削除
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
  // タスク管理関連
  getTasks: () => ipcRenderer.invoke("get-tasks"),
  getTaskOverview: () => ipcRenderer.invoke("get-task-overview"),
  getTaskInstruction: (taskId) => ipcRenderer.invoke("get-task-instruction", taskId),
  getWorkingDirectory: () => ipcRenderer.invoke("get-working-directory"),
  onTaskUpdate: (callback) => {
    ipcRenderer.on("tasks-updated", (_event, tasks) => callback(tasks));
  },
  onTaskOverviewUpdate: (callback) => {
    ipcRenderer.on("task-overview-updated", (_event, overview) => callback(overview));
  },
  // プロジェクト管理関連
  getCurrentProjectPath: () => ipcRenderer.invoke("get-current-project-path"),
  openProjectDialog: () => ipcRenderer.invoke("open-project-dialog"),
  onProjectOpened: (callback) => {
    ipcRenderer.on("project-opened", (_event, data) => callback(data));
  },
  onProjectClosed: (callback) => {
    ipcRenderer.on("project-closed", (_event) => callback());
  },
  // プロンプト実行関連
  executePrompt: (prompt, options) => ipcRenderer.invoke("execute-prompt", { prompt, options })
};
console.log("[Preload] Running preload script");
console.log("[Preload] electronAPI methods:", Object.keys(electronAPI));
try {
  console.log("[Preload] Adding electronAPI to window directly");
  window.electronAPI = electronAPI;
  globalThis.electronAPI = electronAPI;
  console.log("[Preload] electronAPI added to window:", !!window.electronAPI);
  console.log("[Preload] electronAPI added to globalThis:", !!globalThis.electronAPI);
  console.log("[Preload] Testing getWorkingDirectory function existence:", typeof window.electronAPI.getWorkingDirectory);
} catch (error) {
  console.error("[Preload] Error setting up electronAPI:", error);
}
export {
  electronAPI
};
