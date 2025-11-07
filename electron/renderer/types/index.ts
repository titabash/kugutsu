/**
 * Type Definitions for Electron Renderer
 */

/**
 * Task status enum
 *
 * 6-column Kanban board statuses:
 * - pending: 待機中 (依存関係未解決)
 * - ready: 準備完了 (依存関係解決済み、実行可能)
 * - in_progress: 実装中 (EngineerAI実装作業中)
 * - in_review: レビュー中 (TechLeadAIコードレビュー中)
 * - completed: 完了 (レビュー承認済み、終端状態)
 * - failed: 失敗 (実装失敗または致命的エラー)
 */
export type TaskStatus = 'pending' | 'ready' | 'in_progress' | 'in_review' | 'completed' | 'failed'

/**
 * Review status enum
 */
export type ReviewStatus = 'approved' | 'changes_requested' | 'pending'

/**
 * Merge task status enum
 */
export type MergeStatus = 'pending' | 'in_progress' | 'completed' | 'conflict'

/**
 * Log level enum
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success'

/**
 * Task definition
 */
export interface Task {
  id: string
  title: string
  description: string
  priority: number
  dependencies: string[]
  worktreePath?: string
  branchName?: string
  status: TaskStatus
  assignedEngineer?: string
  sessionId?: string
  isConflictResolution?: boolean
  createdAt?: Date
  updatedAt?: Date
  error?: string
  tags?: string[]
}

/**
 * Code review result
 */
export interface Review {
  taskId: string
  reviewer: string
  status: ReviewStatus
  comments: string[]
  timestamp: Date
  issues?: {
    severity: 'low' | 'medium' | 'high'
    description: string
    file?: string
    line?: number
  }[]
}

/**
 * Merge task definition
 */
export interface MergeTask {
  taskId: string
  sourceBranch: string
  targetBranch: string
  status: MergeStatus
  conflictFiles?: string[]
  attemptedAt?: Date
  completedAt?: Date
  error?: string
}

/**
 * Log entry
 */
export interface LogEntry {
  id: string
  timestamp: Date
  level: LogLevel
  source: string
  message: string
  data?: Record<string, unknown>
}

/**
 * Application metadata
 */
export interface AppMetadata {
  totalTasks: number
  tasksCompleted: number
  tasksPending: number
  tasksInProgress: number
  tasksFailed: number
  activeEngineers: number
  isRunning: boolean
  isPaused: boolean
  startedAt?: Date
  completedAt?: Date
}

/**
 * Graph node for visualization
 */
export interface GraphNode {
  id: string
  type: 'task' | 'engineer' | 'review' | 'merge'
  label: string
  status: TaskStatus | ReviewStatus | MergeStatus
  position?: { x: number; y: number }
  data?: Record<string, unknown>
}

/**
 * Graph edge for visualization
 */
export interface GraphEdge {
  id: string
  source: string
  target: string
  type?: string
  animated?: boolean
}

/**
 * Dependency graph
 */
export interface DependencyGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  criticalPath?: string[]
  parallelGroups?: string[][]
}

/**
 * Story Mapping
 */
export interface StoryMapping {
  persona: {
    name: string
    role: string
    goal: string
    painPoints?: string[]
  }
  epics: Epic[]
}

export interface Epic {
  id: string
  title: string
  description?: string
  priority: number
  stories: UserStory[]
}

export interface UserStory {
  id: string
  title: string
  asA: string
  iWantTo: string
  soThat: string
  acceptanceCriteria: string[]
  priority: number
  estimatedPoints: number
}

/**
 * Design Documents
 */
export interface DesignDocs {
  overall: string
  uiux: {
    wireframes: string
    screens?: any
  }
  database: {
    erDiagram: string
    schema?: any
  }
  interfaces: {
    apiSpec: string
    apiSpecJson?: any
  }
}
