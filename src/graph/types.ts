/**
 * Type Definitions for LangGraph State
 *
 * Core types used in the parallel development workflow
 */

/**
 * Task status enum
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

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
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/**
 * Task definition
 *
 * Represents a single development task to be executed by an AI engineer
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
   * Error message if task failed
   */
  error?: string;
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
  provider?: 'claude' | 'codex';
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
