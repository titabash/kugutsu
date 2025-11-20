import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { LogEntry } from '../types'

/**
 * Log tab interface
 */
export interface LogTab {
  id: string
  title: string
  nodeType?: string
  taskId?: string
  isClosable: boolean
  createdAt: Date
  completedAt?: Date
}

/**
 * Tab store state interface
 */
interface TabStoreState {
  tabs: LogTab[]
  activeTabId: string | null

  // Actions
  createTab: (nodeId: string, taskId?: string, title?: string) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  markTabCompleted: (tabId: string) => void
  getLogsForTab: (tabId: string, allLogs: LogEntry[]) => LogEntry[]
  findTabForLog: (log: LogEntry) => string | null
  autoCloseCompletedTabs: (delayMs: number) => void
  clearAllTabs: () => void
}

/**
 * Tab management store for real-time log streaming
 */
export const useTabStore = create<TabStoreState>()(
  devtools(
    (set, get) => ({
      tabs: [],
      activeTabId: null,

      /**
       * Create a new tab
       */
      createTab: (nodeId: string, taskId?: string, title?: string) => {
        const state = get()
        const tabId = taskId ? `${nodeId}-${taskId}` : nodeId
        const existingTab = state.tabs.find(t => t.id === tabId)

        if (!existingTab) {
          // Determine if this is a main tab (non-closable)
          const isMainTab =
            nodeId === 'main' ||
            (!taskId &&
              (nodeId === 'ProductOwnerNode' ||
                nodeId === 'MergeCoordinatorNode' ||
                nodeId === 'DirectorNode' ||
                nodeId === 'SprintPlanningNode' ||
                nodeId === 'CheckModeNode'))

          const newTab: LogTab = {
            id: tabId,
            title: title || (taskId ? `${nodeId}-${taskId}` : nodeId),
            nodeType: nodeId !== 'main' ? nodeId : undefined,
            taskId,
            isClosable: !isMainTab,
            createdAt: new Date(),
          }

          set({
            tabs: [...state.tabs, newTab],
            activeTabId: newTab.id,
          })
        }
      },

      /**
       * Close a tab (only if closable)
       */
      closeTab: (tabId: string) => {
        const state = get()
        const tab = state.tabs.find(t => t.id === tabId)

        if (tab && tab.isClosable) {
          const newTabs = state.tabs.filter(t => t.id !== tabId)

          // If the closed tab was active, switch to another tab
          const newActiveTabId =
            state.activeTabId === tabId
              ? newTabs.length > 0
                ? newTabs[0].id
                : null
              : state.activeTabId

          set({
            tabs: newTabs,
            activeTabId: newActiveTabId,
          })
        }
      },

      /**
       * Set the active tab
       */
      setActiveTab: (tabId: string) => {
        const state = get()
        const tab = state.tabs.find(t => t.id === tabId)

        if (tab) {
          set({ activeTabId: tabId })
        }
      },

      /**
       * Mark a tab as completed
       */
      markTabCompleted: (tabId: string) => {
        const state = get()
        const updatedTabs = state.tabs.map(tab =>
          tab.id === tabId ? { ...tab, completedAt: new Date() } : tab
        )

        set({ tabs: updatedTabs })
      },

      /**
       * Get logs for a specific tab
       */
      getLogsForTab: (tabId: string, allLogs: LogEntry[]): LogEntry[] => {
        const state = get()
        const tab = state.tabs.find(t => t.id === tabId)
        if (!tab) return []

        // Main tab: orchestration logs only
        if (
          tab.id === 'main' ||
          !tab.taskId
        ) {
          return allLogs.filter(
            log =>
              !log.taskId ||
              log.nodeType === 'ProductOwnerNode' ||
              log.nodeType === 'MergeCoordinatorNode' ||
              log.nodeType === 'DirectorNode' ||
              log.nodeType === 'SprintPlanningNode' ||
              log.nodeType === 'CheckModeNode'
          )
        }

        // Task-specific tab
        return allLogs.filter(
          log => log.taskId === tab.taskId && log.nodeType === tab.nodeType
        )
      },

      /**
       * Find the appropriate tab for a log entry
       */
      findTabForLog: (log: LogEntry): string | null => {
        const state = get()

        // If log has taskId and nodeType, route to specific tab
        if (log.taskId && log.nodeType) {
          const tabId = `${log.nodeType}-${log.taskId}`
          const tab = state.tabs.find(t => t.id === tabId)
          if (tab) return tab.id
        }

        // Orchestration logs go to main tab
        if (
          !log.taskId ||
          log.nodeType === 'ProductOwnerNode' ||
          log.nodeType === 'MergeCoordinatorNode' ||
          log.nodeType === 'DirectorNode' ||
          log.nodeType === 'SprintPlanningNode' ||
          log.nodeType === 'CheckModeNode'
        ) {
          const mainTab = state.tabs.find(t => t.id === 'main')
          if (mainTab) return mainTab.id
        }

        return null
      },

      /**
       * Auto-close tabs that have been completed for longer than the delay
       */
      autoCloseCompletedTabs: (delayMs: number) => {
        const state = get()
        const now = new Date()

        const updatedTabs = state.tabs.filter(tab => {
          // Keep non-closable tabs
          if (!tab.isClosable) return true

          // Keep tabs that haven't been completed
          if (!tab.completedAt) return true

          // Close tabs completed longer than delay
          const elapsedMs = now.getTime() - tab.completedAt.getTime()
          return elapsedMs < delayMs
        })

        set({ tabs: updatedTabs })
      },

      /**
       * Clear all tabs (useful for reset)
       */
      clearAllTabs: () => {
        set({ tabs: [], activeTabId: null })
      },
    }),
    {
      name: 'TabStore',
    }
  )
)
