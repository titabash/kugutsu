import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Task, LogEntry, AppMetadata, DependencyGraph } from '../types'

/**
 * Application state interface
 */
interface AppState {
  // Tasks
  tasks: Task[]
  tasksById: Map<string, Task>

  // Logs
  logs: LogEntry[]
  maxLogs: number

  // Metadata
  metadata: AppMetadata

  // Graph
  dependencyGraph: DependencyGraph | null

  // Project
  projectPath: string | null

  // UI State
  logFilter: {
    level: LogEntry['level'] | 'all'
    search: string
  }
  selectedTaskId: string | null

  // Actions - Tasks
  setTasks: (tasks: Task[]) => void
  updateTask: (taskId: string, updates: Partial<Task>) => void
  addTask: (task: Task) => void

  // Actions - Logs
  addLog: (log: LogEntry) => void
  addLogs: (logs: LogEntry[]) => void
  clearLogs: () => void
  setLogFilter: (filter: Partial<AppState['logFilter']>) => void

  // Actions - Metadata
  setMetadata: (metadata: Partial<AppMetadata>) => void

  // Actions - Graph
  setDependencyGraph: (graph: DependencyGraph | null) => void

  // Actions - Project
  setProjectPath: (path: string | null) => void

  // Actions - UI
  setSelectedTaskId: (taskId: string | null) => void

  // Actions - Control
  pause: () => void
  resume: () => void
}

/**
 * Create the application store with devtools
 */
export const useAppStore = create<AppState>()(
  devtools(
    (set, get) => ({
      // Initial State
      tasks: [],
      tasksById: new Map(),
      logs: [],
      maxLogs: 1000, // Keep last 1000 logs for performance
      metadata: {
        totalTasks: 0,
        tasksCompleted: 0,
        tasksPending: 0,
        tasksInProgress: 0,
        tasksFailed: 0,
        activeEngineers: 0,
        isRunning: false,
        isPaused: false,
      },
      dependencyGraph: null,
      projectPath: null,
      logFilter: {
        level: 'all',
        search: '',
      },
      selectedTaskId: null,

      // Task Actions
      setTasks: (tasks) => {
        const tasksById = new Map(tasks.map((task) => [task.id, task]))

        // Update metadata based on tasks
        const metadata = {
          totalTasks: tasks.length,
          tasksCompleted: tasks.filter((t) => t.status === 'completed').length,
          tasksPending: tasks.filter((t) => t.status === 'pending').length,
          tasksInProgress: tasks.filter((t) => t.status === 'in_progress').length,
          tasksFailed: tasks.filter((t) => t.status === 'failed').length,
          activeEngineers: new Set(
            tasks
              .filter((t) => t.status === 'in_progress' && t.assignedEngineer)
              .map((t) => t.assignedEngineer)
          ).size,
          isRunning: get().metadata.isRunning,
          isPaused: get().metadata.isPaused,
        }

        set({ tasks, tasksById, metadata })
      },

      updateTask: (taskId, updates) => {
        const task = get().tasksById.get(taskId)
        if (!task) return

        const updatedTask = { ...task, ...updates, updatedAt: new Date() }
        const tasks = get().tasks.map((t) => (t.id === taskId ? updatedTask : t))

        get().setTasks(tasks)
      },

      addTask: (task) => {
        const tasks = [...get().tasks, task]
        get().setTasks(tasks)
      },

      // Log Actions
      addLog: (log) => {
        set((state) => {
          const logs = [...state.logs, log]

          // Keep only the last maxLogs entries for performance
          if (logs.length > state.maxLogs) {
            logs.splice(0, logs.length - state.maxLogs)
          }

          return { logs }
        })
      },

      addLogs: (newLogs) => {
        set((state) => {
          const logs = [...state.logs, ...newLogs]

          // Keep only the last maxLogs entries for performance
          if (logs.length > state.maxLogs) {
            logs.splice(0, logs.length - state.maxLogs)
          }

          return { logs }
        })
      },

      clearLogs: () => set({ logs: [] }),

      setLogFilter: (filter) =>
        set((state) => ({
          logFilter: { ...state.logFilter, ...filter },
        })),

      // Metadata Actions
      setMetadata: (metadata) =>
        set((state) => ({
          metadata: { ...state.metadata, ...metadata },
        })),

      // Graph Actions
      setDependencyGraph: (graph) => set({ dependencyGraph: graph }),

      // Project Actions
      setProjectPath: (path) => set({ projectPath: path }),

      // UI Actions
      setSelectedTaskId: (taskId) => set({ selectedTaskId: taskId }),

      // Control Actions
      pause: () =>
        set((state) => ({
          metadata: { ...state.metadata, isPaused: true },
        })),

      resume: () =>
        set((state) => ({
          metadata: { ...state.metadata, isPaused: false },
        })),
    }),
    { name: 'KugutsuAppStore' }
  )
)
