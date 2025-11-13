/**
 * LangGraph State Definition
 *
 * Defines the state structure for the parallel development workflow
 * using LangGraphJS Annotation system
 */

import { Annotation } from '@langchain/langgraph';
import type {
  Task,
  Review,
  MergeTask,
  WorktreeInfo,
  LogEntry,
  ParallelDevConfig,
  GlobalTask,
  ProjectMetadata,
  Sprint,
} from './types.js';
import type { TaskSplitSuggestion, TaskMergeSuggestion } from '../types/index.js';
import type { StoryMapping } from '../types/scrum.js';

/**
 * Feedback Request
 *
 * ノードが前提条件の不備を検出した際に発行するリクエスト
 */
export interface FeedbackRequest {
  /**
   * フィードバック先のノード名
   * 例: 'product_owner', 'engineer_dispatch'
   */
  targetNode: string;

  /**
   * リクエスト元のノード名
   * 例: 'engineer', 'review'
   */
  requestingNode: string;

  /**
   * 不備の理由（ユーザーフレンドリーなメッセージ）
   */
  reason: string;

  /**
   * 詳細情報（構造化データ）
   */
  details: {
    taskId?: string;
    missingFiles?: string[];
    missingFields?: string[];
    validationErrors?: any[];
    [key: string]: any;
  };

  /**
   * このフィードバックのリトライ回数
   */
  retryCount: number;

  /**
   * フィードバック作成時刻
   */
  timestamp: Date;
}

/**
 * ノード固有のリトライカウンター
 * 各ノードが何回フィードバックループを実行したかを追跡
 */
export interface NodeRetryCounters {
  [nodeName: string]: number;
}

/**
 * Parallel Development State
 *
 * This is the main state object that flows through the LangGraph workflow.
 * Each node receives the current state and returns partial state updates.
 *
 * Reducers:
 * - Array data: Custom merge logic to prevent duplicates
 * - Map data: Merge with new entries
 * - Single values: Replace (default)
 *
 * **File-Based Artifact Management:**
 * The state now includes file paths to artifacts stored in `.kugutsu/` directory.
 * Actual data is persisted in files, not in the state object.
 */
export const ParallelDevState = Annotation.Root({
  /**
   * Original user request
   */
  userRequest: Annotation<string>,

  /**
   * File-based artifact paths
   *
   * These paths point to JSON/Markdown files in `.kugutsu/` directory.
   * Nodes should read/write these files instead of storing data in state.
   */

  /**
   * Path to tech stack analysis file
   * File: `.kugutsu/tech-stack.json`
   * Created by: ProductOwnerNode
   */
  techStackPath: Annotation<string | null>({
    reducer: (state: string | null, update: string | null) => {
      return update ?? state;
    },
    default: () => null,
  }),

  /**
   * Path to requirements analysis file
   * File: `.kugutsu/requirements.json`
   * Created by: ProductOwnerNode
   */
  requirementsPath: Annotation<string | null>({
    reducer: (state: string | null, update: string | null) => {
      return update ?? state;
    },
    default: () => null,
  }),

  /**
   * Path to tasks definition file
   * File: `.kugutsu/tasks.json`
   * Created by: ProductOwnerNode
   * Updated by: EngineerNode, ReviewNode, MergeCoordinatorNode
   */
  tasksPath: Annotation<string | null>({
    reducer: (state: string | null, update: string | null) => {
      return update ?? state;
    },
    default: () => null,
  }),

  /**
   * Path to story mapping file (Scrum mode)
   * File: `.kugutsu/story-map.json`
   * Created by: DirectorNode
   */
  storyMapPath: Annotation<string | null>({
    reducer: (state: string | null, update: string | null) => {
      return update ?? state;
    },
    default: () => null,
  }),

  /**
   * Path to sprint plan file (Scrum mode)
   * File: `.kugutsu/sprint-plan.json`
   * Created by: SprintPlanningNode
   */
  sprintPlanPath: Annotation<string | null>({
    reducer: (state: string | null, update: string | null) => {
      return update ?? state;
    },
    default: () => null,
  }),

  /**
   * Path to workflow metadata file
   * File: `.kugutsu/metadata.json`
   * Created by: Orchestrator
   */
  metadataPath: Annotation<string | null>({
    reducer: (state: string | null, update: string | null) => {
      return update ?? state;
    },
    default: () => null,
  }),

  /**
   * All tasks in the workflow
   *
   * Reducer: Merge tasks by ID, replacing existing tasks with updates
   */
  tasks: Annotation<Task[]>({
    reducer: (state: Task[], update: Task[]) => {
      if (!update || !Array.isArray(update)) return state || [];
      if (!state || !Array.isArray(state)) return update || [];
      const taskMap = new Map(state.map((t) => [t.id, t]));
      update.forEach((t) => taskMap.set(t.id, t));
      return Array.from(taskMap.values());
    },
    default: () => [],
  }),

  /**
   * Completed tasks
   *
   * Reducer: Append new completed tasks
   */
  completedTasks: Annotation<Task[]>({
    reducer: (state: Task[], update: Task[]) => {
      if (!update || !Array.isArray(update)) return state || [];
      if (!state || !Array.isArray(state)) return update || [];
      // Prevent duplicates
      const existingIds = new Set(state.map((t) => t.id));
      const newTasks = update.filter((t) => !existingIds.has(t.id));
      return state.concat(newTasks);
    },
    default: () => [],
  }),

  /**
   * Failed tasks
   *
   * Reducer: Append new failed tasks
   */
  failedTasks: Annotation<Task[]>({
    reducer: (state: Task[], update: Task[]) => {
      if (!update || !Array.isArray(update)) return state || [];
      if (!state || !Array.isArray(state)) return update || [];
      // Prevent duplicates
      const existingIds = new Set(state.map((t) => t.id));
      const newTasks = update.filter((t) => !existingIds.has(t.id));
      return state.concat(newTasks);
    },
    default: () => [],
  }),

  /**
   * Code reviews
   *
   * Reducer: Append new reviews
   */
  reviews: Annotation<Review[]>({
    reducer: (state: Review[], update: Review[]) => {
      if (!update || !Array.isArray(update)) return state || [];
      if (!state || !Array.isArray(state)) return update || [];
      return state.concat(update);
    },
    default: () => [],
  }),

  /**
   * Merge queue
   *
   * Reducer: Merge by task ID, replacing existing merge tasks
   */
  mergeQueue: Annotation<MergeTask[]>({
    reducer: (state: MergeTask[], update: MergeTask[]) => {
      if (!update || !Array.isArray(update)) return state || [];
      if (!state || !Array.isArray(state)) return update || [];
      const mergeMap = new Map(state.map((m) => [m.taskId, m]));
      update.forEach((m) => mergeMap.set(m.taskId, m));
      return Array.from(mergeMap.values());
    },
    default: () => [],
  }),

  /**
   * Active worktrees
   *
   * Reducer: Merge worktrees by task ID
   */
  worktrees: Annotation<Map<string, WorktreeInfo>>({
    reducer: (
      state: Map<string, WorktreeInfo>,
      update: Map<string, WorktreeInfo>
    ) => {
      if (!update || !(update instanceof Map)) return state || new Map<string, WorktreeInfo>();
      if (!state || !(state instanceof Map)) return update || new Map<string, WorktreeInfo>();
      return new Map([...state, ...update]);
    },
    default: () => new Map<string, WorktreeInfo>(),
  }),

  /**
   * Log entries for UI display
   *
   * Reducer: Append new logs, keeping only the most recent 1000 entries
   */
  logs: Annotation<LogEntry[]>({
    reducer: (state: LogEntry[], update: LogEntry[]) => {
      if (!update || !Array.isArray(update)) return state || [];
      if (!state || !Array.isArray(state)) return update || [];
      const combined = state.concat(update);
      // Keep only the most recent 1000 logs
      return combined.slice(-1000);
    },
    default: () => [],
  }),

  /**
   * Configuration
   *
   * Reducer: Replace (default)
   */
  config: Annotation<ParallelDevConfig>,

  /**
   * Workflow metadata
   */
  metadata: Annotation<{
    /**
     * Workflow start time
     */
    startedAt?: Date;

    /**
     * Workflow end time
     */
    completedAt?: Date;

    /**
     * Current workflow phase
     */
    phase?: 'analysis' | 'development' | 'review' | 'merge' | 'complete';

    /**
     * Total number of tasks generated
     */
    totalTasks?: number;

    /**
     * Total number of tasks completed
     */
    tasksCompleted?: number;

    /**
     * Total number of tasks failed
     */
    tasksFailed?: number;

    /**
     * Whether the workflow encountered errors
     */
    hasErrors?: boolean;

    /**
     * Error messages (if any)
     */
    errors?: string[];

    /**
     * Whether detailed design phase is required
     * - true: Execute full Scrum flow (director_ai → tech_lead_design → task_breakdown)
     * - false: Skip design phase and go directly to product_owner
     * Set by: AnalyzeComplexityNode
     */
    requiresDetailedDesign?: boolean;

    /**
     * Reason for complexity judgment
     * Explanation of why requiresDetailedDesign was set to true/false
     * Set by: AnalyzeComplexityNode
     */
    complexityReason?: string;
  }>({
    reducer: (
      state: Record<string, any>,
      update: Record<string, any>
    ) => {
      return { ...state, ...update };
    },
    default: () => ({}),
  }),

  /**
   * Sprint-driven development fields
   */

  /**
   * Global tasks (multi-project support)
   *
   * Reducer: Merge tasks by ID, replacing existing tasks with updates
   */
  globalTasks: Annotation<GlobalTask[]>({
    reducer: (state: GlobalTask[], update: GlobalTask[]) => {
      if (!update || !Array.isArray(update)) return state || [];
      if (!state || !Array.isArray(state)) return update || [];
      const taskMap = new Map(state.map((t) => [t.id, t]));
      update.forEach((t) => taskMap.set(t.id, t));
      return Array.from(taskMap.values());
    },
    default: () => [],
  }),

  /**
   * Task to process (for Send API fan-out)
   *
   * Single task passed via LangGraph Send API for parallel processing.
   * Used by InstructionGeneratorNode to process individual tasks.
   *
   * NOTE: This field is explicitly reset to null after task processing.
   * Reducer MUST support explicit null assignment.
   */
  taskToProcess: Annotation<GlobalTask | null>({
    reducer: (state: GlobalTask | null, update: GlobalTask | null | undefined) => {
      // updateがundefinedの場合のみstateを保持、nullは明示的に設定
      if (update === undefined) return state;
      return update;
    },
    default: () => null,
  }),

  /**
   * Project metadata (multi-project support)
   *
   * Reducer: Merge projects by project ID
   */
  projects: Annotation<Map<string, ProjectMetadata>>({
    reducer: (
      state: Map<string, ProjectMetadata>,
      update: Map<string, ProjectMetadata>
    ) => {
      if (!update || !(update instanceof Map)) return state || new Map<string, ProjectMetadata>();
      if (!state || !(state instanceof Map)) return update || new Map<string, ProjectMetadata>();
      return new Map([...state, ...update]);
    },
    default: () => new Map<string, ProjectMetadata>(),
  }),

  /**
   * Sprint information
   *
   * Reducer: Merge sprints by ID, replacing existing sprints with updates
   */
  sprints: Annotation<Sprint[]>({
    reducer: (state: Sprint[], update: Sprint[]) => {
      if (!update || !Array.isArray(update)) return state || [];
      if (!state || !Array.isArray(state)) return update || [];
      const sprintMap = new Map(state.map((s) => [s.id, s]));
      update.forEach((s) => sprintMap.set(s.id, s));
      return Array.from(sprintMap.values());
    },
    default: () => [],
  }),

  /**
   * Active sprint
   *
   * Reducer: Replace (default)
   */
  activeSprint: Annotation<Sprint | null>({
    reducer: (state: Sprint | null, update: Sprint | null | undefined) => {
      // updateがundefinedの場合のみstateを保持、nullは明示的に設定
      if (update === undefined) return state;
      return update;
    },
    default: () => null,
  }),

  /**
   * Completed sprint IDs
   *
   * Reducer: Append new sprint IDs
   */
  completedSprintIds: Annotation<string[]>({
    reducer: (state: string[], update: string[]) => {
      if (!update || !Array.isArray(update)) return state || [];
      if (!state || !Array.isArray(state)) return update || [];
      return state.concat(update);
    },
    default: () => [],
  }),

  /**
   * Current user request (for multi-project tracking)
   *
   * Reducer: Replace (default)
   */
  currentUserRequest: Annotation<string | null>({
    reducer: (state: string | null, update: string | null) => {
      return update ?? state;
    },
    default: () => null,
  }),

  /**
   * Continuation mode flag
   *
   * Reducer: Replace (default)
   */
  continuationMode: Annotation<boolean>({
    reducer: (state: boolean, update: boolean) => {
      return update ?? state;
    },
    default: () => false,
  }),

  /**
   * Current project ID
   *
   * Reducer: Replace (default)
   */
  currentProjectId: Annotation<string | null>({
    reducer: (state: string | null, update: string | null) => {
      return update ?? state;
    },
    default: () => null,
  }),

  /**
   * Scrum Development Flow fields (Phase 6)
   */

  /**
   * Story mapping approval status
   *
   * Reducer: Replace (default)
   */
  storyMappingApproved: Annotation<boolean | null>({
    reducer: (state: boolean | null, update: boolean | null) => {
      return update ?? state;
    },
    default: () => null,
  }),

  /**
   * Review feedback from story mapping or design review
   *
   * Reducer: Replace (default)
   */
  reviewFeedback: Annotation<{
    issues: Array<{
      severity: 'critical' | 'major' | 'minor' | 'info';
      category: string;
      message: string;
      storyId?: string;
      epicId?: string;
    }>;
    suggestions: string[];
  } | null>({
    reducer: (state: any, update: any) => {
      return update ?? state;
    },
    default: () => null,
  }),

  /**
   * Story mapping (full data)
   *
   * Reducer: Replace (default)
   */
  storyMapping: Annotation<StoryMapping | null>({
    reducer: (state: StoryMapping | null, update: StoryMapping | null) => {
      return update ?? state;
    },
    default: () => null,
  }),

  /**
   * Design documents metadata
   *
   * Reducer: Replace (default)
   */
  designDocs: Annotation<{
    approved?: boolean;
    designDocsPath?: string;
    uiuxPath?: string;
    databasePath?: string;
    apiPath?: string;
  } | null>({
    reducer: (state: any, update: any) => {
      return update ?? state;
    },
    default: () => null,
  }),

  /**
   * Design approval status
   *
   * Reducer: Replace (default)
   */
  designApproved: Annotation<boolean | null>({
    reducer: (state: boolean | null, update: boolean | null) => {
      return update ?? state;
    },
    default: () => null,
  }),

  /**
   * Dependency graph
   *
   * Reducer: Replace (default)
   */
  dependencyGraph: Annotation<{
    nodes: Array<{
      id: string;
      title: string;
      status: string;
    }>;
    edges: Array<{
      from: string;
      to: string;
      type: 'depends_on' | 'blocks';
    }>;
    criticalPath: string[];
    parallelGroups: string[][];
  } | null>({
    reducer: (state: any, update: any) => {
      return update ?? state;
    },
    default: () => null,
  }),

  /**
   * Feedback Loop fields
   */

  /**
   * 現在アクティブなフィードバックリクエスト
   * Conditional edgeがこれを見てルーティングを決定
   *
   * NOTE: This field is explicitly reset to null after feedback processing.
   * Reducer MUST support explicit null assignment.
   *
   * Reducer: Replace (default)
   */
  feedbackRequest: Annotation<FeedbackRequest | null>({
    reducer: (state: FeedbackRequest | null, update: FeedbackRequest | null | undefined) => {
      // updateがundefinedの場合のみstateを保持、nullは明示的に設定
      if (update === undefined) return state;
      return update;
    },
    default: () => null,
  }),

  /**
   * フィードバック履歴（デバッグ・分析用）
   *
   * Reducer: Append new feedback requests, keeping only the most recent 100 entries
   */
  feedbackHistory: Annotation<FeedbackRequest[]>({
    reducer: (state: FeedbackRequest[], update: FeedbackRequest[]) => {
      if (!update || !Array.isArray(update)) return state || [];
      if (!state || !Array.isArray(state)) return update || [];
      const combined = state.concat(update);
      // Keep only the most recent 100 feedback requests
      return combined.slice(-100);
    },
    default: () => [],
  }),

  /**
   * ノード別リトライカウンター
   * 各ノードへのフィードバック回数を追跡（無限ループ防止）
   *
   * Reducer: Merge (shallow merge)
   */
  nodeRetryCounters: Annotation<NodeRetryCounters>({
    reducer: (state: NodeRetryCounters, update: NodeRetryCounters) => {
      return { ...state, ...update };
    },
    default: () => ({}),
  }),

  /**
   * グローバルリトライ上限（無限ループ防止）
   *
   * Reducer: Replace (default)
   */
  maxGlobalRetries: Annotation<number>({
    reducer: (state: number, update: number) => {
      return update ?? state;
    },
    default: () => 10,
  }),

  /**
   * Current Task ID (for parallel execution with Send API)
   *
   * This field is used when a node is executed in parallel via Send API.
   * Each parallel node instance receives a specific task ID to process.
   *
   * NOTE: This field is explicitly reset to null after task completion.
   * Reducer MUST support explicit null assignment.
   *
   * Reducer: Replace (default)
   */
  currentTaskId: Annotation<string | null>({
    reducer: (state: string | null, update: string | null | undefined) => {
      // updateがundefinedの場合のみstateを保持、nullは明示的に設定
      if (update === undefined) return state;
      return update;
    },
    default: () => null,
  }),

  /**
   * Task Split Suggestions
   *
   * Suggestions to split large tasks into smaller subtasks.
   * Generated by: BacklogRefinementNode
   *
   * Reducer: Append new suggestions
   */
  taskSplitSuggestions: Annotation<TaskSplitSuggestion[]>({
    reducer: (state: TaskSplitSuggestion[], update: TaskSplitSuggestion[]) => {
      if (!update || !Array.isArray(update)) return state || [];
      if (!state || !Array.isArray(state)) return update || [];
      return state.concat(update);
    },
    default: () => [],
  }),

  /**
   * Task Merge Suggestions
   *
   * Suggestions to merge similar small tasks.
   * Generated by: BacklogRefinementNode
   *
   * Reducer: Append new suggestions
   */
  taskMergeSuggestions: Annotation<TaskMergeSuggestion[]>({
    reducer: (state: TaskMergeSuggestion[], update: TaskMergeSuggestion[]) => {
      if (!update || !Array.isArray(update)) return state || [];
      if (!state || !Array.isArray(state)) return update || [];
      return state.concat(update);
    },
    default: () => [],
  }),
});

/**
 * Type definition for the state
 *
 * Use this type for node functions and type checking
 */
export type ParallelDevStateType = typeof ParallelDevState.State;

/**
 * Partial state type for node return values
 *
 * Nodes return partial state updates
 */
export type ParallelDevStateUpdate = Partial<ParallelDevStateType>;

/**
 * Helper function to create initial state
 */
export function createInitialState(
  userRequest: string,
  config: ParallelDevConfig
): ParallelDevStateType {
  return {
    userRequest,
    // File-based artifact paths
    techStackPath: null,
    requirementsPath: null,
    tasksPath: null,
    storyMapPath: null,
    sprintPlanPath: null,
    metadataPath: null,
    // Existing fields (for backward compatibility)
    tasks: [],
    completedTasks: [],
    failedTasks: [],
    reviews: [],
    mergeQueue: [],
    worktrees: new Map<string, WorktreeInfo>(),
    logs: [
      {
        timestamp: new Date(),
        level: 'info',
        source: 'system',
        message: 'Parallel development workflow started',
        data: { userRequest },
      },
    ],
    config,
    metadata: {
      startedAt: new Date(),
      phase: 'analysis',
      totalTasks: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      hasErrors: false,
      errors: [],
      requiresDetailedDesign: false, // Default: skip detailed design (AI will override)
      complexityReason: undefined,
    },
    // Sprint-driven development fields
    globalTasks: [],
    taskToProcess: null,
    projects: new Map(),
    sprints: [],
    activeSprint: null,
    completedSprintIds: [],
    currentUserRequest: null,
    continuationMode: false,
    currentProjectId: null,
    // Scrum Development Flow fields
    storyMappingApproved: null,
    designApproved: null,
    reviewFeedback: null,
    storyMapping: null,
    designDocs: null,
    dependencyGraph: null,
    // Feedback Loop fields
    feedbackRequest: null,
    feedbackHistory: [],
    nodeRetryCounters: {},
    maxGlobalRetries: 10,
    // Send API fields
    currentTaskId: null,
    // Backlog Refinement fields
    taskSplitSuggestions: [],
    taskMergeSuggestions: [],
  };
}

/**
 * Helper function to add log entry
 */
export function addLog(
  state: ParallelDevStateType,
  log: Omit<LogEntry, 'timestamp'>
): ParallelDevStateUpdate {
  return {
    logs: [
      {
        ...log,
        timestamp: new Date(),
      },
    ],
  };
}

/**
 * Helper function to update metadata
 */
export function updateMetadata(
  updates: Partial<ParallelDevStateType['metadata']>
): ParallelDevStateUpdate {
  return {
    metadata: updates,
  };
}
