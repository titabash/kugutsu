import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Task, LogEntry, AppMetadata, DependencyGraph, Sprint, GlobalTask } from '../types'

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

  // Sprints (Sprint-Driven Development)
  sprints: Sprint[]
  currentSprint: Sprint | null
  globalTasks: GlobalTask[]

  // Actions - Tasks
  setTasks: (tasks: Task[]) => void
  updateTask: (taskId: string, updates: Partial<Task>) => void
  updateTasks: (taskUpdates: Task[]) => void
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

  // Actions - Sprints
  setSprints: (sprints: Sprint[]) => void
  setCurrentSprint: (sprint: Sprint | null) => void
  addSprint: (sprint: Sprint) => void
  updateSprint: (sprintId: string, updates: Partial<Sprint>) => void
  setGlobalTasks: (tasks: GlobalTask[]) => void

  // Selectors - Sprints
  getSprintById: (sprintId: string) => Sprint | undefined
  getTasksBySprint: (sprintId: string) => GlobalTask[]
  getActiveSprintCount: () => number
  getCompletedSprintCount: () => number
  getProductBacklogTasks: () => GlobalTask[]
  getCurrentSprintProgress: () => {
    total: number
    completed: number
    inProgress: number
    pending: number
    failed: number
    percentage: number
  } | null
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
      sprints: [],
      currentSprint: null,
      globalTasks: [],

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

      updateTasks: (taskUpdates) => {
        // Create a map of updates by task ID
        const updatesMap = new Map(taskUpdates.map((task) => [task.id, task]))

        // Merge updates with existing tasks
        const tasks = get().tasks.map((task) => {
          const update = updatesMap.get(task.id)
          if (update) {
            return { ...task, ...update, updatedAt: new Date() }
          }
          return task
        })

        // Add new tasks that don't exist yet
        taskUpdates.forEach((update) => {
          if (!get().tasksById.has(update.id)) {
            tasks.push({ ...update, createdAt: new Date() })
          }
        })

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

      // Sprint Actions
      setSprints: (sprints) => set({ sprints }),

      setCurrentSprint: (sprint) => set({ currentSprint: sprint }),

      addSprint: (sprint) =>
        set((state) => ({
          sprints: [...state.sprints, sprint],
        })),

      updateSprint: (sprintId, updates) =>
        set((state) => {
          const sprints = state.sprints.map((sprint) =>
            sprint.id === sprintId ? { ...sprint, ...updates } : sprint
          )

          // Update currentSprint if it's the one being updated
          const currentSprint =
            state.currentSprint?.id === sprintId
              ? { ...state.currentSprint, ...updates }
              : state.currentSprint

          return { sprints, currentSprint }
        }),

      setGlobalTasks: (tasks) => set({ globalTasks: tasks }),

      // Sprint Selectors
      getSprintById: (sprintId) => {
        const state = get()
        return state.sprints.find((sprint) => sprint.id === sprintId)
      },

      getTasksBySprint: (sprintId) => {
        const state = get()
        return state.globalTasks.filter((task) => task.sprint === sprintId)
      },

      getActiveSprintCount: () => {
        const state = get()
        return state.sprints.filter(
          (sprint) => sprint.status === 'active' || sprint.status === 'planning'
        ).length
      },

      getCompletedSprintCount: () => {
        const state = get()
        return state.sprints.filter((sprint) => sprint.status === 'completed').length
      },

      getProductBacklogTasks: () => {
        const state = get()
        return state.globalTasks.filter((task) => task.sprint === undefined)
      },

      getCurrentSprintProgress: () => {
        const state = get()
        if (!state.currentSprint) return null

        const tasks = state.globalTasks.filter(
          (task) => task.sprint === state.currentSprint!.id
        )

        const total = tasks.length
        if (total === 0) {
          return {
            total: 0,
            completed: 0,
            inProgress: 0,
            pending: 0,
            failed: 0,
            percentage: 0,
          }
        }

        const completed = tasks.filter((task) => task.status === 'completed').length
        const inProgress = tasks.filter((task) => task.status === 'in_progress').length
        const pending = tasks.filter((task) => task.status === 'pending').length
        const failed = tasks.filter((task) => task.status === 'failed').length

        return {
          total,
          completed,
          inProgress,
          pending,
          failed,
          percentage: Math.round((completed / total) * 100),
        }
      },
    }),
    { name: 'KugutsuAppStore' }
  )
)
