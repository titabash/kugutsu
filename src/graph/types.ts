/**
 * Type Definitions for LangGraph State
 *
 * Core types used in the parallel development workflow
 */

// Re-export sprint-driven development types from src/types/index.ts
export type { GlobalTask, ProjectMetadata, Sprint } from '../types/index.js';

/**
 * Task status enum
 *
 * 5-column Kanban board statuses:
 * - pending: 待機中（スプリント未割り当て、またはスプリント内で未着手）
 * - in_progress: 実装中（EngineerAI実装作業中）
 * - in_review: レビュー中（TechLeadAIコードレビュー中）
 * - completed: 完了（レビュー承認済み、終端状態）
 * - failed: 失敗（実装失敗または致命的エラー）
 */
export type TaskStatus = 'pending' | 'in_progress' | 'in_review' | 'completed' | 'failed';

/**
 * Review status enum
 */
export type ReviewStatus = 'approved' | 'changes_requested' | 'pending';

/**
 * Merge task status enum
 */
export type MergeStatus = 'pending' | 'in_progress' | 'completed' | 'conflict';

/**
 * Log level enum
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';

/**
 * Task definition（実行キュー管理用）
 *
 * Represents a single development task to be executed by an AI engineer.
 *
 * **用途**: 現在のワークフロー実行中のタスク管理
 * **スコープ**: 単一実行セッション
 * **永続化**: `.kugutsu/tasks.json`（一時的）
 * **管理ノード**: EngineerDispatchNode, EngineerNode, ReviewNode
 *
 * **globalTasksとの違い**:
 * - `Task`: 実行中のタスク（worktreePath、branchName、sessionId等を含む）
 * - `GlobalTask`: Product/Sprint Backlog管理用（プロジェクト全体で永続化）
 *
 * **変換フロー**:
 * ```
 * globalTasks（バックログ） → EngineerDispatchNode → tasks（実行キュー）
 * tasks（実行完了） → ReviewNode → globalTasks（完了記録）
 * ```
 */
export interface Task {
  /**
   * Unique task identifier
   */
  id: string;

  /**
   * Task title (short description)
   */
  title: string;

  /**
   * Detailed task description
   */
  description: string;

  /**
   * Task priority (higher number = higher priority)
   */
  priority: number;

  /**
   * Task IDs that must be completed before this task
   */
  dependencies: string[];

  /**
   * Path to the git worktree for this task
   */
  worktreePath?: string;

  /**
   * Git branch name for this task
   */
  branchName?: string;

  /**
   * Current task status
   */
  status: TaskStatus;

  /**
   * Engineer assigned to this task
   */
  assignedEngineer?: string;

  /**
   * Session ID for resuming AI execution
   */
  sessionId?: string;

  /**
   * Whether this task is for conflict resolution
   */
  isConflictResolution?: boolean;

  /**
   * When the task was created
   */
  createdAt?: Date;

  /**
   * When the task was last updated
   */
  updatedAt?: Date;

  /**
   * Error message or Error object if task failed
   */
  error?: string | Error;
}

/**
 * Code review result
 */
export interface Review {
  /**
   * Task ID being reviewed
   */
  taskId: string;

  /**
   * Reviewer identifier
   */
  reviewer: string;

  /**
   * Review status
   */
  status: ReviewStatus;

  /**
   * Review comments
   */
  comments: string[];

  /**
   * When the review was completed
   */
  timestamp: Date;

  /**
   * Issues found during review
   */
  issues?: {
    severity: 'low' | 'medium' | 'high';
    description: string;
    file?: string;
    line?: number;
  }[];
}

/**
 * Merge task definition
 */
export interface MergeTask {
  /**
   * Task ID to merge
   */
  taskId: string;

  /**
   * Source branch to merge from
   */
  sourceBranch: string;

  /**
   * Target branch to merge into
   */
  targetBranch: string;

  /**
   * Merge status
   */
  status: MergeStatus;

  /**
   * Files with merge conflicts (if any)
   */
  conflictFiles?: string[];

  /**
   * When the merge was attempted
   */
  attemptedAt?: Date;

  /**
   * When the merge was completed
   */
  completedAt?: Date;

  /**
   * Error message if merge failed
   */
  error?: string;
}

/**
 * Git worktree information
 */
export interface WorktreeInfo {
  /**
   * Absolute path to worktree
   */
  path: string;

  /**
   * Branch name in this worktree
   */
  branch: string;

  /**
   * Associated task ID
   */
  taskId: string;

  /**
   * When the worktree was created
   */
  createdAt: Date;

  /**
   * Whether the worktree is active
   */
  active?: boolean;
}

/**
 * Log entry for UI display and debugging
 */
export interface LogEntry {
  /**
   * When the log was created
   */
  timestamp: Date;

  /**
   * Log level
   */
  level: LogLevel;

  /**
   * Source of the log (node name, component, etc.)
   */
  source: string;

  /**
   * Log message
   */
  message: string;

  /**
   * Additional structured data
   */
  data?: any;

  /**
   * Associated task ID (if applicable)
   */
  taskId?: string;

  /**
   * Associated session ID (if applicable)
   */
  sessionId?: string;

  /**
   * Engineer/Reviewer ID (e.g., "engineer-1", "reviewer-1")
   * Used for tab routing and identification
   */
  engineerId?: string;

  /**
   * Node type that generated this log (e.g., "EngineerNode", "ReviewNode")
   * Used for tab routing and filtering
   */
  nodeType?: string;

  /**
   * AI provider used to generate this log
   */
  provider?: 'claude' | 'codex' | 'system';
}

/**
 * Configuration for parallel development
 */
export interface ParallelDevConfig {
  /**
   * Maximum number of concurrent AI engineers
   */
  maxEngineers: number;

  /**
   * Maximum turns per task
   */
  maxTurns: number;

  /**
   * Base branch for development
   */
  baseBranch: string;

  /**
   * Base repository path
   */
  baseRepoPath: string;

  /**
   * Base path for worktrees
   */
  worktreeBasePath: string;

  /**
   * Whether to clean up worktrees after completion
   */
  cleanup?: boolean;

  /**
   * AI provider configuration
   */
  provider?: 'claude' | 'codex' | 'mock';

  /**
   * Abort signal for cancelling execution
   * When this signal is aborted, all AI operations should terminate immediately
   */
  abortSignal?: AbortSignal;

  /**
   * Abort controller for cancelling execution
   * Nodes should pass this to provider.execute() to enable cancellation
   */
  abortController?: AbortController;
}

/**
 * Task generation requirements
 */
export interface Requirements {
  /**
   * Original user request
   */
  userRequest: string;

  /**
   * Detected technology stack
   */
  techStack: {
    languages: string[];
    frameworks: string[];
    tools: string[];
  };

  /**
   * Functional requirements
   */
  functional: string[];

  /**
   * Non-functional requirements
   */
  nonFunctional: string[];

  /**
   * Constraints and limitations
   */
  constraints: string[];
}

/**
 * Technology stack analysis result
 */
export interface TechStackAnalysis {
  /**
   * Programming languages used
   */
  languages: string[];

  /**
   * Frameworks and libraries
   */
  frameworks: string[];

  /**
   * Build tools and package managers
   */
  buildTools: string[];

  /**
   * Testing frameworks
   */
  testingFrameworks: string[];

  /**
   * Configuration files detected
   */
  configFiles: string[];

  /**
   * Project type (e.g., "web-app", "cli", "library")
   */
  projectType: string;
}
