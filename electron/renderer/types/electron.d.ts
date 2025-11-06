/**
 * Electron API type definitions for renderer process
 */

export interface ElectronAPI {
  // ==========================================
  // LangGraph API (New Architecture)
  // ==========================================

  /**
   * Listen for batched graph events from StateStreamManager
   * @returns Cleanup function to remove listener
   */
  onGraphEventsBatch?: (callback: (events: GraphEvent[]) => void) => () => void

  /**
   * Get current LangGraph state
   */
  getGraphState?: () => Promise<unknown>

  /**
   * Get task details by ID
   */
  getTaskDetails?: (taskId: string) => Promise<unknown>

  /**
   * Log error from renderer
   */
  logError?: (message: string, details?: unknown) => Promise<void>

  // ==========================================
  // Project Management
  // ==========================================

  /**
   * Get working directory
   */
  getWorkingDirectory?: () => Promise<string>

  /**
   * Get current project path (for Electron app)
   */
  getCurrentProjectPath?: () => Promise<string | null>

  /**
   * Open project dialog (for Electron app)
   */
  openProjectDialog?: () => Promise<string | null>
}

/**
 * Graph Event from StateStreamManager
 */
export interface GraphEvent {
  type:
    | 'state-init'
    | 'node-started'
    | 'node-completed'
    | 'task-update'
    | 'tasks-batch'
    | 'logs-batch'
    | 'phase-change'
    | 'error'
    | 'complete'
  data: unknown
  timestamp: number
  priority: 'high' | 'normal' | 'low'
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
