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
  const { addLog, addLogs, setTasks, setMetadata, updateTasks } = useAppStore()

  useEffect(() => {
    if (!window.electronAPI) {
      console.warn('[useElectronSync] electronAPI not available')
      return
    }

    console.log('[useElectronSync] Setting up Electron IPC listeners')

    // ==========================================
    // NEW: Graph Events Batch Handler (LangGraph)
    // ==========================================

    const handleGraphEventsBatch = (events: any[]) => {
      if (!events || events.length === 0) return

      console.log(`[useElectronSync] Received ${events.length} graph events`)

      events.forEach((event) => {
        switch (event.type) {
          case 'state-init':
            // Initial state - set all data
            if (event.data.tasks) {
              setTasks(event.data.tasks)
            }
            if (event.data.logs) {
              addLogs(event.data.logs)
            }
            if (event.data.metadata) {
              setMetadata({
                phase: event.data.metadata.phase,
                totalTasks: event.data.metadata.totalTasks,
                tasksCompleted: event.data.metadata.tasksCompleted,
                tasksFailed: event.data.metadata.tasksFailed,
                hasErrors: event.data.metadata.hasErrors,
                startedAt: event.data.metadata.startedAt
                  ? new Date(event.data.metadata.startedAt)
                  : undefined,
              })
            }
            break

          case 'node-started':
            // Node execution started
            addLog({
              id: `${Date.now()}-${Math.random()}`,
              timestamp: new Date(event.timestamp),
              level: 'info',
              source: event.data.nodeId || 'System',
              message: `🚀 ノード開始: ${event.data.nodeId}`,
            })
            break

          case 'node-completed':
            // Node execution completed
            addLog({
              id: `${Date.now()}-${Math.random()}`,
              timestamp: new Date(event.timestamp),
              level: 'success',
              source: event.data.nodeId || 'System',
              message: `✅ ノード完了: ${event.data.nodeId}`,
            })
            break

          case 'tasks-batch':
            // Batch task updates
            if (Array.isArray(event.data)) {
              updateTasks(event.data)
            }
            break

          case 'logs-batch':
            // Batch log additions
            if (Array.isArray(event.data)) {
              const logs: LogEntry[] = event.data.map((log: any) => ({
                id: `${log.timestamp}-${Math.random()}`,
                timestamp: new Date(log.timestamp),
                level: log.level,
                source: log.source,
                message: log.message,
                data: log.data,
              }))
              addLogs(logs)
            }
            break

          case 'phase-change':
            // Phase change
            setMetadata({ phase: event.data.to })
            addLog({
              id: `${Date.now()}-${Math.random()}`,
              timestamp: new Date(event.timestamp),
              level: 'info',
              source: 'System',
              message: `🔄 フェーズ変更: ${event.data.from} → ${event.data.to}`,
            })
            break

          case 'error':
            // Error occurred
            setMetadata({ hasErrors: true })
            const errorMessages = Array.isArray(event.data) ? event.data : [event.data]
            errorMessages.forEach((err: string) => {
              addLog({
                id: `${Date.now()}-${Math.random()}`,
                timestamp: new Date(event.timestamp),
                level: 'error',
                source: 'System',
                message: `❌ エラー: ${err}`,
              })
            })
            break

          case 'complete':
            // Workflow completed
            setMetadata({
              phase: 'complete',
              completedAt: new Date(event.timestamp),
              isRunning: false,
              totalTasks: event.data.totalTasks,
              tasksCompleted: event.data.tasksCompleted,
              tasksFailed: event.data.tasksFailed,
            })
            addLog({
              id: `${Date.now()}-${Math.random()}`,
              timestamp: new Date(event.timestamp),
              level: 'success',
              source: 'System',
              message: `🎉 ワークフロー完了! (成功: ${event.data.tasksCompleted}, 失敗: ${event.data.tasksFailed})`,
            })
            break

          default:
            console.warn(`[useElectronSync] Unknown event type: ${event.type}`)
        }
      })
    }

    // Register Graph Events Batch listener
    let cleanupGraphEventsBatch: (() => void) | undefined
    if (window.electronAPI.onGraphEventsBatch) {
      cleanupGraphEventsBatch = window.electronAPI.onGraphEventsBatch(handleGraphEventsBatch)
      console.log('[useElectronSync] Graph events batch listener registered')
    } else {
      console.warn('[useElectronSync] onGraphEventsBatch not available')
    }

    // Initial state fetch (if available)
    if (window.electronAPI.getGraphState) {
      window.electronAPI
        .getGraphState()
        .then((state) => {
          if (state) {
            console.log('[useElectronSync] Initial graph state loaded')
            // Process as state-init event
            handleGraphEventsBatch([
              {
                type: 'state-init',
                data: state,
                timestamp: Date.now(),
                priority: 'high',
              },
            ])
          }
        })
        .catch((error) => {
          console.error('[useElectronSync] Failed to fetch initial graph state:', error)
        })
    }

    // Cleanup function
    return () => {
      console.log('[useElectronSync] Cleaning up Electron IPC listeners')

      // Cleanup graph events batch listener
      if (cleanupGraphEventsBatch) {
        cleanupGraphEventsBatch()
      }
    }
  }, [addLog, addLogs, setTasks, setMetadata, updateTasks])
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
