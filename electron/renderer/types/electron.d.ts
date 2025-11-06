/**
 * Electron API type definitions for renderer process
 */

export interface ElectronAPI {
  // Log related
  sendLog: (data: unknown) => Promise<void>
  onLogData: (callback: (data: LogData) => void) => void
  onStructuredLogData: (callback: (data: StructuredLogData) => void) => void

  // Layout related
  updateLayout: (engineerCount: number) => Promise<{ success: boolean; engineerCount: number }>
  onLayoutUpdate: (callback: (engineerCount: number) => void) => void

  // Task status related
  onTaskStatusUpdate: (callback: (data: { completed: number; total: number }) => void) => void
  onAllTasksCompleted: (callback: (data: unknown) => void) => void

  // Terminal
  onClearTerminal: (callback: (terminalId: string) => void) => void

  // Connection status
  onConnectionStatus: (callback: (connected: boolean) => void) => void

  // TechLead and Engineer association
  onAssociateTechLeadEngineer: (
    callback: (data: { techLeadId: string; engineerId: string }) => void
  ) => void

  // Event listener management
  removeAllListeners: (channel: string) => void

  // Task management
  getTasks: () => Promise<unknown[]>
  getTaskOverview: () => Promise<string>
  getTaskInstruction: (taskId: string) => Promise<string>
  getWorkingDirectory: () => Promise<string>
  onTaskUpdate: (callback: (tasks: unknown[]) => void) => void
  onTaskOverviewUpdate: (callback: (overview: string) => void) => void

  // Control
  pauseExecution?: () => Promise<{ success: boolean }>
  resumeExecution?: () => Promise<{ success: boolean }>
  cancelExecution?: () => Promise<{ success: boolean }>
}

export interface LogData {
  engineerId: string
  level: string
  message: string
  component: string
  timestamp: Date
}

export interface StructuredLogData {
  level: string
  source: string
  message: string
  timestamp: Date
  data?: Record<string, unknown>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
