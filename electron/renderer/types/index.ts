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
 * Chat message
 */
export interface ChatMessage {
  id: string
  type: 'user' | 'system' | 'ai'
  content: string
  timestamp: Date
  nodeId?: string
  data?: Record<string, unknown>
  isThinking?: boolean    // AIが思考中かどうか
  isStreaming?: boolean   // メッセージがストリーミング中かどうか
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

/**
 * Sprint (スプリント駆動開発)
 */
export interface Sprint {
  id: string                     // sprint-{uuid}
  name: string                   // "Sprint 1: 認証機能実装"
  goal: string                   // スプリントゴール
  taskIds: string[]              // 含まれるタスクID
  status: 'planning' | 'active' | 'review' | 'completed'
  startedAt?: Date               // 開始日時
  completedAt?: Date             // 完了日時
  deployable: boolean            // デプロイ可能かどうか
  metadata: {
    estimatedHours: number       // 見積もり時間
    actualHours?: number         // 実績時間
    blockers: string[]           // ブロッカー情報
    completedTasksCount: number  // 完了タスク数
    failedTasksCount: number     // 失敗タスク数
  }
}

/**
 * GlobalTask (Product/Sprint Backlog管理用)
 *
 * グローバルタスクキューで管理される全プロジェクトのタスク
 */
export interface GlobalTask {
  id: string
  type: 'feature' | 'bugfix' | 'refactor' | 'test' | 'docs' | 'conflict-resolution'
  title: string
  description: string
  priority: number               // 基礎優先度（0-100）
  dependencies: string[]
  status: 'pending' | 'in_progress' | 'in_review' | 'completed' | 'failed'
  worktreePath?: string
  branchName?: string
  createdAt?: Date
  updatedAt?: Date

  // GlobalTask固有のフィールド
  projectId: string              // プロジェクト識別子（uuid）
  requestTimestamp: Date         // リクエスト受付時刻
  dynamicPriority: number        // 動的優先度（0-1000）
  sprint?: string                // 所属スプリントID
  storyId?: string               // 関連するユーザーストーリーID

  // コンフリクト解消関連
  conflictResolverAttemptCount?: number

  // instruction.md生成関連
  instructionGenerated?: boolean     // instruction.md生成完了フラグ
  instructionGenerating?: boolean    // instruction.md生成実行中フラグ
  instructionError?: string          // instruction.md生成エラー
  instructionGeneratedAt?: Date      // instruction.md生成完了時刻

  // バックログリファインメント関連
  estimatedHours?: number            // 見積もり時間（時間単位）
  actualHours?: number               // 実績時間（時間単位）
  estimatedPoints?: number           // 見積もりポイント（ストーリーポイント）
  businessValue?: 'high' | 'medium' | 'low'  // ビジネス価値
  technicalRisk?: 'high' | 'medium' | 'low'  // 技術的リスク
}

/**
 * NodeExecution (LangGraphノード実行状態)
 *
 * AIエージェント（スクラム開発チーム）のメンバーが実行しているノードの状態
 */
export interface NodeExecution {
  nodeName: string                          // ノード名（例: 'product_owner', 'engineer', 'review'）
  status: 'started' | 'completed' | 'failed' // 実行ステータス
  startedAt: Date                           // 実行開始時刻
  completedAt?: Date                        // 実行完了時刻
  duration?: number                         // 所要時間（ミリ秒）
  error?: string                            // エラーメッセージ（失敗時）
}

/**
 * NodeRole (LangGraphノードのスクラムロール)
 *
 * 各ノードをスクラム開発チームのロールにマッピング
 */
export interface NodeRole {
  nodeName: string
  roleName: string
  roleIcon: string
  description: string
  category: 'planning' | 'design' | 'development' | 'review' | 'coordination'
}

/**
 * FlowNode (ノードフローの個別ノード定義)
 *
 * LangGraphワークフローの各ノードの状態を表現
 */
export interface FlowNode {
  id: string                                               // ノードID
  type: 'start' | 'process' | 'decision' | 'end'           // ノード種類
  label: string                                            // 表示ラベル
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped'  // 実行状態
  executionTime?: number                                   // 実行時間（ミリ秒）
  startedAt?: number                                       // 開始タイムスタンプ
  completedAt?: number                                     // 完了タイムスタンプ
}

/**
 * FlowEdge (ノードフローのエッジ定義)
 *
 * ノード間の接続を表現
 */
export interface FlowEdge {
  id: string          // エッジID
  source: string      // 開始ノードID
  target: string      // 終了ノードID
  label?: string      // エッジラベル（条件分岐の説明など）
  condition?: string  // 条件分岐のラベル
}

/**
 * NodeFlowData (ノードフロー全体の定義)
 *
 * ワークフロー全体のノードとエッジの情報
 */
export interface NodeFlowData {
  nodes: FlowNode[]   // 全ノード
  edges: FlowEdge[]   // 全エッジ
}
