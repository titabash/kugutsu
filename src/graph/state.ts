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
} from './types.js';

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
 */
export const ParallelDevState = Annotation.Root({
  /**
   * Original user request
   */
  userRequest: Annotation<string>,

  /**
   * All tasks in the workflow
   *
   * Reducer: Merge tasks by ID, replacing existing tasks with updates
   */
  tasks: Annotation<Task[]>({
    reducer: (state: Task[], update: Task[]) => {
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
  }>({
    reducer: (
      state: Record<string, any>,
      update: Record<string, any>
    ) => {
      return { ...state, ...update };
    },
    default: () => ({}),
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
    },
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
