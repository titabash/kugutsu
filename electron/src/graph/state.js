/**
 * LangGraph State Definition
 *
 * Defines the state structure for the parallel development workflow
 * using LangGraphJS Annotation system
 */
import { Annotation } from '@langchain/langgraph';
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
    userRequest: (Annotation),
    /**
     * All tasks in the workflow
     *
     * Reducer: Merge tasks by ID, replacing existing tasks with updates
     */
    tasks: Annotation({
        reducer: (state, update) => {
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
    completedTasks: Annotation({
        reducer: (state, update) => {
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
    failedTasks: Annotation({
        reducer: (state, update) => {
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
    reviews: Annotation({
        reducer: (state, update) => {
            return state.concat(update);
        },
        default: () => [],
    }),
    /**
     * Merge queue
     *
     * Reducer: Merge by task ID, replacing existing merge tasks
     */
    mergeQueue: Annotation({
        reducer: (state, update) => {
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
    worktrees: Annotation({
        reducer: (state, update) => {
            return new Map([...state, ...update]);
        },
        default: () => new Map(),
    }),
    /**
     * Log entries for UI display
     *
     * Reducer: Append new logs, keeping only the most recent 1000 entries
     */
    logs: Annotation({
        reducer: (state, update) => {
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
    config: (Annotation),
    /**
     * Workflow metadata
     */
    metadata: Annotation({
        reducer: (state, update) => {
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
    globalTasks: Annotation({
        reducer: (state, update) => {
            const taskMap = new Map(state.map((t) => [t.id, t]));
            update.forEach((t) => taskMap.set(t.id, t));
            return Array.from(taskMap.values());
        },
        default: () => [],
    }),
    /**
     * Project metadata (multi-project support)
     *
     * Reducer: Merge projects by project ID
     */
    projects: Annotation({
        reducer: (state, update) => {
            return new Map([...state, ...update]);
        },
        default: () => new Map(),
    }),
    /**
     * Sprint information
     *
     * Reducer: Merge sprints by ID, replacing existing sprints with updates
     */
    sprints: Annotation({
        reducer: (state, update) => {
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
    activeSprint: Annotation({
        reducer: (state, update) => {
            return update ?? state;
        },
        default: () => null,
    }),
    /**
     * Completed sprint IDs
     *
     * Reducer: Append new sprint IDs
     */
    completedSprintIds: Annotation({
        reducer: (state, update) => {
            return state.concat(update);
        },
        default: () => [],
    }),
    /**
     * Current user request (for multi-project tracking)
     *
     * Reducer: Replace (default)
     */
    currentUserRequest: Annotation({
        reducer: (state, update) => {
            return update ?? state;
        },
        default: () => null,
    }),
    /**
     * Continuation mode flag
     *
     * Reducer: Replace (default)
     */
    continuationMode: Annotation({
        reducer: (state, update) => {
            return update ?? state;
        },
        default: () => false,
    }),
    /**
     * Current project ID
     *
     * Reducer: Replace (default)
     */
    currentProjectId: Annotation({
        reducer: (state, update) => {
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
    storyMappingApproved: Annotation({
        reducer: (state, update) => {
            return update ?? state;
        },
        default: () => null,
    }),
    /**
     * Review feedback from story mapping or design review
     *
     * Reducer: Replace (default)
     */
    reviewFeedback: Annotation({
        reducer: (state, update) => {
            return update ?? state;
        },
        default: () => null,
    }),
    /**
     * Story mapping (full data)
     *
     * Reducer: Replace (default)
     */
    storyMapping: Annotation({
        reducer: (state, update) => {
            return update ?? state;
        },
        default: () => null,
    }),
    /**
     * Design documents metadata
     *
     * Reducer: Replace (default)
     */
    designDocs: Annotation({
        reducer: (state, update) => {
            return update ?? state;
        },
        default: () => null,
    }),
    /**
     * Dependency graph
     *
     * Reducer: Replace (default)
     */
    dependencyGraph: Annotation({
        reducer: (state, update) => {
            return update ?? state;
        },
        default: () => null,
    }),
});
/**
 * Helper function to create initial state
 */
export function createInitialState(userRequest, config) {
    return {
        userRequest,
        tasks: [],
        completedTasks: [],
        failedTasks: [],
        reviews: [],
        mergeQueue: [],
        worktrees: new Map(),
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
        // Sprint-driven development fields
        globalTasks: [],
        projects: new Map(),
        sprints: [],
        activeSprint: null,
        completedSprintIds: [],
        currentUserRequest: null,
        continuationMode: false,
        currentProjectId: null,
        // Scrum Development Flow fields
        storyMappingApproved: null,
        reviewFeedback: null,
        storyMapping: null,
        designDocs: null,
        dependencyGraph: null,
    };
}
/**
 * Helper function to add log entry
 */
export function addLog(state, log) {
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
export function updateMetadata(updates) {
    return {
        metadata: updates,
    };
}
//# sourceMappingURL=state.js.map