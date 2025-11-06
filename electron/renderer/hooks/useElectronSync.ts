import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import type { Task, LogEntry } from '../types'

/**
 * Synchronize Electron IPC events with Zustand store
 *
 * This hook sets up listeners for all Electron IPC events and updates
 * the app store accordingly, providing real-time UI updates
 */
export function useElectronSync() {
  const { addLog, addLogs, setTasks, setMetadata } = useAppStore()

  useEffect(() => {
    if (!window.electronAPI) {
      console.warn('[useElectronSync] electronAPI not available')
      return
    }

    console.log('[useElectronSync] Setting up Electron IPC listeners')

    // Log data listener
    const handleLogData = (data: {
      engineerId: string
      level: string
      message: string
      component: string
      timestamp: Date
    }) => {
      const log: LogEntry = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(data.timestamp),
        level: data.level as LogEntry['level'],
        source: data.component || data.engineerId,
        message: data.message,
      }

      addLog(log)
    }

    // Structured log data listener
    const handleStructuredLogData = (data: {
      level: string
      source: string
      message: string
      timestamp: Date
      data?: Record<string, unknown>
    }) => {
      const log: LogEntry = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(data.timestamp),
        level: data.level as LogEntry['level'],
        source: data.source,
        message: data.message,
        data: data.data,
      }

      addLog(log)
    }

    // Task status update listener
    const handleTaskStatusUpdate = (data: { completed: number; total: number }) => {
      setMetadata({
        tasksCompleted: data.completed,
        totalTasks: data.total,
      })
    }

    // Task update listener
    const handleTaskUpdate = (tasks: unknown[]) => {
      // Convert to Task[] with proper types
      const typedTasks = tasks.map((task: any) => ({
        id: task.id || '',
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || 0,
        dependencies: task.dependencies || [],
        status: task.status || 'pending',
        assignedEngineer: task.assignedEngineer,
        worktreePath: task.worktreePath,
        branchName: task.branchName,
        sessionId: task.sessionId,
        isConflictResolution: task.isConflictResolution,
        createdAt: task.createdAt ? new Date(task.createdAt) : undefined,
        updatedAt: task.updatedAt ? new Date(task.updatedAt) : undefined,
        error: task.error,
        tags: task.tags,
      })) as Task[]

      setTasks(typedTasks)
    }

    // All tasks completed listener
    const handleAllTasksCompleted = (data: unknown) => {
      setMetadata({
        isRunning: false,
        completedAt: new Date(),
      })

      addLog({
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        level: 'success',
        source: 'System',
        message: '🎉 すべてのタスクが完了しました！',
      })
    }

    // Connection status listener
    const handleConnectionStatus = (connected: boolean) => {
      addLog({
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        level: connected ? 'success' : 'warn',
        source: 'System',
        message: connected ? '接続しました' : '切断されました',
      })
    }

    // Layout update listener
    const handleLayoutUpdate = (engineerCount: number) => {
      setMetadata({
        activeEngineers: engineerCount,
      })
    }

    // Register listeners
    window.electronAPI.onLogData(handleLogData)
    window.electronAPI.onStructuredLogData(handleStructuredLogData)
    window.electronAPI.onTaskStatusUpdate(handleTaskStatusUpdate)
    window.electronAPI.onTaskUpdate(handleTaskUpdate)
    window.electronAPI.onAllTasksCompleted(handleAllTasksCompleted)
    window.electronAPI.onConnectionStatus(handleConnectionStatus)
    window.electronAPI.onLayoutUpdate(handleLayoutUpdate)

    // Initial data fetch
    window.electronAPI
      .getTasks()
      .then((tasks) => {
        handleTaskUpdate(tasks)
      })
      .catch((error) => {
        console.error('[useElectronSync] Failed to fetch initial tasks:', error)
      })

    // Cleanup function
    return () => {
      console.log('[useElectronSync] Cleaning up Electron IPC listeners')
      window.electronAPI.removeAllListeners('log-data')
      window.electronAPI.removeAllListeners('structured-log-data')
      window.electronAPI.removeAllListeners('task-status-update')
      window.electronAPI.removeAllListeners('tasks-updated')
      window.electronAPI.removeAllListeners('all-tasks-completed')
      window.electronAPI.removeAllListeners('connection-status')
      window.electronAPI.removeAllListeners('layout-update')
    }
  }, [addLog, addLogs, setTasks, setMetadata])
}

/**
 * Hook for executing control actions (pause, resume, cancel)
 */
export function useElectronControl() {
  const { pause, resume } = useAppStore()

  const handlePause = async () => {
    if (window.electronAPI.pauseExecution) {
      const result = await window.electronAPI.pauseExecution()
      if (result.success) {
        pause()
      }
    }
  }

  const handleResume = async () => {
    if (window.electronAPI.resumeExecution) {
      const result = await window.electronAPI.resumeExecution()
      if (result.success) {
        resume()
      }
    }
  }

  const handleCancel = async () => {
    if (window.electronAPI.cancelExecution) {
      await window.electronAPI.cancelExecution()
    }
  }

  return {
    pause: handlePause,
    resume: handleResume,
    cancel: handleCancel,
  }
}
