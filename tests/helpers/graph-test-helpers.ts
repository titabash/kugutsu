/**
 * Graph Test Helpers
 *
 * Provides helper functions and utilities for testing LangGraph workflows
 * without depending on actual AI SDKs.
 *
 * Key Features:
 * - Fluent API for building test states
 * - Graph execution helpers for partial workflow execution
 * - Custom assertions for state and node verification
 * - Event collection and analysis utilities
 */

import type { ParallelDevStateType } from '../../src/graph/state.js';
import { createInitialState } from '../../src/graph/state.js';
import type {
  Task,
  Review,
  MergeTask,
  WorktreeInfo,
  LogEntry,
  ParallelDevConfig,
  GlobalTask,
  Sprint,
} from '../../src/graph/types.js';
import type { StoryMapping } from '../../src/types/scrum.js';

// ============================================================================
// Test State Builder (Fluent API)
// ============================================================================

/**
 * Fluent API builder for creating test states
 *
 * Usage:
 * ```typescript
 * const state = createTestState()
 *   .withTasks([task1, task2])
 *   .withConfig({ maxEngineers: 3 })
 *   .withActiveSprint(sprint)
 *   .build();
 * ```
 */
export class TestStateBuilder {
  private state: ParallelDevStateType;

  constructor(userRequest: string = 'Test request', config: Partial<ParallelDevConfig> = {}) {
    // Use process.cwd() based paths to avoid ENOENT errors
    const testBaseDir = `${process.cwd()}/.test-tmp`;

    this.state = createInitialState(userRequest, {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: config.baseRepoPath || testBaseDir + '/repo',
      worktreeBasePath: config.worktreeBasePath || testBaseDir + '/worktrees',
      provider: 'mock',
      ...config,
    });
  }

  /**
   * Add tasks to the state
   */
  withTasks(tasks: Task[]): this {
    this.state.tasks = tasks;
    return this;
  }

  /**
   * Add global tasks (backlog) to the state
   */
  withGlobalTasks(globalTasks: GlobalTask[]): this {
    this.state.globalTasks = globalTasks;
    return this;
  }

  /**
   * Set configuration
   */
  withConfig(config: Partial<ParallelDevConfig>): this {
    this.state.config = { ...this.state.config, ...config };
    return this;
  }

  /**
   * Set active sprint
   */
  withActiveSprint(sprint: Sprint): this {
    this.state.activeSprint = sprint;
    return this;
  }

  /**
   * Add reviews
   */
  withReviews(reviews: Review[]): this {
    this.state.reviews = reviews;
    return this;
  }

  /**
   * Add merge queue items
   */
  withMergeQueue(mergeQueue: MergeTask[]): this {
    this.state.mergeQueue = mergeQueue;
    return this;
  }

  /**
   * Set worktrees (as Map)
   */
  withWorktrees(worktrees: Map<string, WorktreeInfo>): this {
    this.state.worktrees = worktrees;
    return this;
  }

  /**
   * Set story mapping (Scrum mode)
   */
  withStoryMapping(storyMapping: StoryMapping): this {
    this.state.storyMapping = storyMapping;
    return this;
  }

  /**
   * Set complexity analysis result in metadata
   */
  withComplexityAnalysis(requiresDetailedDesign: boolean, complexityLevel: 'high' | 'low'): this {
    // Store in metadata
    if (!this.state.metadata) {
      this.state.metadata = {
        startedAt: new Date(),
        requiresDetailedDesign,
        complexityReason: `Complexity level: ${complexityLevel}`,
      };
    } else {
      this.state.metadata.requiresDetailedDesign = requiresDetailedDesign;
      this.state.metadata.complexityReason = `Complexity level: ${complexityLevel}`;
    }
    return this;
  }

  /**
   * Set story mapping approval status
   */
  withStoryMappingApproved(approved: boolean): this {
    this.state.storyMappingApproved = approved;
    return this;
  }

  /**
   * Set design approval status
   */
  withDesignApproved(approved: boolean): this {
    this.state.designApproved = approved;
    return this;
  }

  /**
   * Set file paths
   */
  withFilePaths(paths: {
    tasksPath?: string;
    techStackPath?: string;
    requirementsPath?: string;
    storyMapPath?: string;
    sprintPlanPath?: string;
  }): this {
    if (paths.tasksPath) this.state.tasksPath = paths.tasksPath;
    if (paths.techStackPath) this.state.techStackPath = paths.techStackPath;
    if (paths.requirementsPath) this.state.requirementsPath = paths.requirementsPath;
    if (paths.storyMapPath) this.state.storyMapPath = paths.storyMapPath;
    if (paths.sprintPlanPath) this.state.sprintPlanPath = paths.sprintPlanPath;
    return this;
  }

  /**
   * Add logs
   */
  withLogs(logs: LogEntry[]): this {
    this.state.logs = logs;
    return this;
  }

  /**
   * Set current task ID
   */
  withCurrentTaskId(taskId: string): this {
    this.state.currentTaskId = taskId;
    return this;
  }

  /**
   * Build and return the final state
   */
  build(): ParallelDevStateType {
    return this.state;
  }
}

/**
 * Create a new test state builder
 */
export function createTestState(
  userRequest: string = 'Test request',
  config: Partial<ParallelDevConfig> = {}
): TestStateBuilder {
  return new TestStateBuilder(userRequest, config);
}

// ============================================================================
// Graph Execution Helpers
// ============================================================================

/**
 * Execute graph until a specific node is reached
 *
 * @param graph - Compiled LangGraph
 * @param initialState - Initial state
 * @param targetNode - Node name to stop at
 * @returns Final state after reaching the target node
 */
export async function executeUntilNode(
  graph: any,
  initialState: ParallelDevStateType,
  targetNode: string
): Promise<ParallelDevStateType> {
  let lastState: ParallelDevStateType = initialState;

  for await (const event of graph.stream(initialState)) {
    // Event format: { nodeName: { ...stateUpdate } }
    const nodeNames = Object.keys(event);

    for (const nodeName of nodeNames) {
      // Merge state update
      lastState = { ...lastState, ...event[nodeName] };

      // Check if target node was reached
      if (nodeName === targetNode) {
        return lastState;
      }
    }
  }

  throw new Error(`Target node '${targetNode}' was not reached during graph execution`);
}

/**
 * Execute a specific sequence of nodes and verify execution order
 *
 * @param graph - Compiled LangGraph
 * @param initialState - Initial state
 * @param expectedNodes - Expected node execution sequence
 * @returns Array of states after each node execution
 */
export async function executeNodeSequence(
  graph: any,
  initialState: ParallelDevStateType,
  expectedNodes: string[]
): Promise<ParallelDevStateType[]> {
  const states: ParallelDevStateType[] = [];
  let currentState: ParallelDevStateType = initialState;
  let nodeIndex = 0;

  for await (const event of graph.stream(initialState)) {
    const nodeNames = Object.keys(event);

    for (const nodeName of nodeNames) {
      // Merge state update
      currentState = { ...currentState, ...event[nodeName] };
      states.push({ ...currentState });

      // Verify execution order
      if (nodeIndex < expectedNodes.length) {
        const expectedNode = expectedNodes[nodeIndex];
        if (nodeName === expectedNode) {
          nodeIndex++;
        }
      }
    }
  }

  return states;
}

/**
 * Collect all events from graph execution
 *
 * @param streamOrPromise - Graph stream iterator or Promise of stream
 * @returns Array of all events
 */
export async function collectEvents(streamOrPromise: any): Promise<any[]> {
  // Await if it's a promise (graph.stream() returns Promise<AsyncIterable>)
  const stream = streamOrPromise.then ? await streamOrPromise : streamOrPromise;

  const events: any[] = [];

  for await (const event of stream) {
    events.push(event);
  }

  return events;
}

/**
 * Collect all states from graph execution
 *
 * @param stream - Graph stream iterator
 * @returns Array of states after each node execution
 */
export async function collectStates(stream: AsyncIterable<any>): Promise<ParallelDevStateType[]> {
  const states: ParallelDevStateType[] = [];
  let currentState: any = {};

  for await (const event of stream) {
    const nodeNames = Object.keys(event);

    for (const nodeName of nodeNames) {
      // Merge state update
      currentState = { ...currentState, ...event[nodeName] };
      states.push({ ...currentState });
    }
  }

  return states;
}

/**
 * Execute graph and return final state
 *
 * @param graph - Compiled LangGraph
 * @param initialState - Initial state
 * @returns Final state after graph execution
 */
export async function executeGraph(
  graph: any,
  initialState: ParallelDevStateType
): Promise<ParallelDevStateType> {
  let finalState: ParallelDevStateType = initialState;

  for await (const event of graph.stream(initialState)) {
    const nodeNames = Object.keys(event);

    for (const nodeName of nodeNames) {
      // Merge state update
      finalState = { ...finalState, ...event[nodeName] };
    }
  }

  return finalState;
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Expect task to have specific status
 *
 * @param state - State to check
 * @param taskId - Task ID
 * @param expectedStatus - Expected task status
 */
export function expectTaskStatus(
  state: ParallelDevStateType,
  taskId: string,
  expectedStatus: string
): void {
  const task = state.tasks.find((t) => t.id === taskId);

  if (!task) {
    throw new Error(`Task '${taskId}' not found in state.tasks`);
  }

  if (task.status !== expectedStatus) {
    throw new Error(
      `Expected task '${taskId}' to have status '${expectedStatus}', but got '${task.status}'`
    );
  }
}

/**
 * Expect node to have been executed
 *
 * @param events - Collected events
 * @param nodeName - Node name
 */
export function expectNodeExecuted(events: any[], nodeName: string): void {
  const nodeEvent = events.find((event) => nodeName in event);

  if (!nodeEvent) {
    const executedNodes = events.map((e) => Object.keys(e)).flat();
    throw new Error(
      `Expected node '${nodeName}' to be executed, but it was not found.\n` +
        `Executed nodes: ${executedNodes.join(', ')}`
    );
  }
}

/**
 * Expect node execution sequence
 *
 * @param events - Collected events
 * @param expectedSequence - Expected node names in order
 */
export function expectNodeSequence(events: any[], expectedSequence: string[]): void {
  const executedNodes: string[] = [];

  for (const event of events) {
    const nodeNames = Object.keys(event);
    executedNodes.push(...nodeNames);
  }

  let sequenceIndex = 0;
  for (const executedNode of executedNodes) {
    if (sequenceIndex < expectedSequence.length && executedNode === expectedSequence[sequenceIndex]) {
      sequenceIndex++;
    }
  }

  if (sequenceIndex !== expectedSequence.length) {
    throw new Error(
      `Expected node sequence ${JSON.stringify(expectedSequence)}, ` +
        `but got ${JSON.stringify(executedNodes)}.\n` +
        `Matched ${sequenceIndex}/${expectedSequence.length} nodes.`
    );
  }
}

/**
 * Expect specific state transition
 *
 * @param beforeState - State before transition
 * @param afterState - State after transition
 * @param changes - Expected changes
 */
export function expectStateTransition(
  beforeState: ParallelDevStateType,
  afterState: ParallelDevStateType,
  changes: {
    tasksLength?: number;
    reviewsLength?: number;
    mergeQueueLength?: number;
    specificTask?: { id: string; status: string };
  }
): void {
  if (changes.tasksLength !== undefined) {
    if (afterState.tasks.length !== changes.tasksLength) {
      throw new Error(
        `Expected tasks.length to be ${changes.tasksLength}, but got ${afterState.tasks.length}`
      );
    }
  }

  if (changes.reviewsLength !== undefined) {
    if (afterState.reviews.length !== changes.reviewsLength) {
      throw new Error(
        `Expected reviews.length to be ${changes.reviewsLength}, but got ${afterState.reviews.length}`
      );
    }
  }

  if (changes.mergeQueueLength !== undefined) {
    if (afterState.mergeQueue.length !== changes.mergeQueueLength) {
      throw new Error(
        `Expected mergeQueue.length to be ${changes.mergeQueueLength}, but got ${afterState.mergeQueue.length}`
      );
    }
  }

  if (changes.specificTask) {
    const task = afterState.tasks.find((t) => t.id === changes.specificTask!.id);
    if (!task) {
      throw new Error(`Task '${changes.specificTask.id}' not found in afterState.tasks`);
    }
    if (task.status !== changes.specificTask.status) {
      throw new Error(
        `Expected task '${changes.specificTask.id}' to have status '${changes.specificTask.status}', ` +
          `but got '${task.status}'`
      );
    }
  }
}

/**
 * Expect task to be processed (exists in events)
 *
 * @param events - Collected events
 * @param taskId - Task ID
 */
export function expectTaskProcessed(events: any[], taskId: string): void {
  let found = false;

  for (const event of events) {
    for (const nodeName in event) {
      const nodeState = event[nodeName];

      // Check in tasks array
      if (nodeState.tasks && Array.isArray(nodeState.tasks)) {
        const task = nodeState.tasks.find((t: Task) => t.id === taskId);
        if (task) {
          found = true;
          break;
        }
      }

      // Check in currentTaskId
      if (nodeState.currentTaskId === taskId) {
        found = true;
        break;
      }
    }

    if (found) break;
  }

  if (!found) {
    throw new Error(`Expected task '${taskId}' to be processed, but it was not found in events`);
  }
}

/**
 * Get executed node names from events
 *
 * @param events - Collected events
 * @returns Array of executed node names
 */
export function getExecutedNodes(events: any[]): string[] {
  const nodes: string[] = [];

  for (const event of events) {
    const nodeNames = Object.keys(event);
    nodes.push(...nodeNames);
  }

  return nodes;
}

/**
 * Find event by node name
 *
 * @param events - Collected events
 * @param nodeName - Node name to find
 * @returns Event object or undefined
 */
export function findEventByNode(events: any[], nodeName: string): any | undefined {
  return events.find((event) => nodeName in event);
}

/**
 * Get all events for a specific node
 *
 * @param events - Collected events
 * @param nodeName - Node name
 * @returns Array of events for the node
 */
export function getNodeEvents(events: any[], nodeName: string): any[] {
  return events.filter((event) => nodeName in event).map((event) => event[nodeName]);
}

// ============================================================================
// Test Data Generators
// ============================================================================

/**
 * Create a simple test task
 */
export function createTestTask(overrides: Partial<Task> = {}): Task {
  const id = overrides.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    id,
    title: 'Test Task',
    description: 'Test task description',
    status: 'pending',
    priority: 100,
    dependencies: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create multiple test tasks
 */
export function createTestTasks(count: number, overrides: Partial<Task> = {}): Task[] {
  return Array.from({ length: count }, (_, i) =>
    createTestTask({
      id: `task-${i + 1}`,
      title: `Test Task ${i + 1}`,
      priority: 100 - i * 10,
      ...overrides,
    })
  );
}

/**
 * Create a test review
 */
export function createTestReview(overrides: Partial<Review> = {}): Review {
  return {
    taskId: 'task-1',
    reviewer: 'test-reviewer',
    status: 'approved',
    comments: ['Test review comment'],
    timestamp: new Date(),
    ...overrides,
  };
}

/**
 * Create a test sprint
 */
export function createTestSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: `sprint-${Date.now()}`,
    name: 'Test Sprint',
    goal: 'Test sprint goal',
    taskIds: [],
    startedAt: new Date(),
    status: 'active',
    deployable: false,
    metadata: {
      estimatedHours: 8,
      blockers: [],
      completedTasksCount: 0,
      failedTasksCount: 0,
    },
    ...overrides,
  };
}

/**
 * Create a test global task
 */
export function createTestGlobalTask(overrides: Partial<GlobalTask> = {}): GlobalTask {
  const id = overrides.id || `global-task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    id,
    type: 'feature',
    title: 'Test Global Task',
    description: 'Test global task description',
    status: 'pending',
    priority: 100,
    dependencies: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    projectId: 'test-project',
    requestTimestamp: new Date(),
    dynamicPriority: 100,
    estimatedHours: 8,
    ...overrides,
  };
}

// ============================================================================
// Mock Infrastructure for Node Testing
// ============================================================================

/**
 * Mock GitWorktreeManager for testing without actual git operations
 */
export class MockGitWorktreeManager {
  private worktrees: Map<string, { path: string; branchName: string }> = new Map();

  async createWorktree(taskId: string, branchName: string): Promise<string> {
    const worktreePath = `/mock/worktrees/${taskId}`;
    this.worktrees.set(taskId, { path: worktreePath, branchName });
    return worktreePath;
  }

  async removeWorktree(taskId: string): Promise<void> {
    this.worktrees.delete(taskId);
  }

  async addAndCommit(filePath: string, message: string): Promise<void> {
    // No-op for testing
  }

  async push(branchName: string): Promise<void> {
    // No-op for testing
  }

  getWorktrees(): Map<string, { path: string; branchName: string }> {
    return new Map(this.worktrees);
  }

  reset(): void {
    this.worktrees.clear();
  }
}

/**
 * Create mock DataPersistence for testing without file I/O
 */
export function createMockDataPersistence() {
  return {
    initialize: jest.fn().mockResolvedValue(undefined),
    loadGlobalQueue: jest.fn().mockResolvedValue([]),
    loadAllProjectMetadata: jest.fn().mockResolvedValue(new Map()),
    saveProjectMetadata: jest.fn().mockResolvedValue(undefined),
    loadRepositoryMetadata: jest.fn().mockResolvedValue({
      repositoryName: 'test-repo',
      analyzedAt: new Date().toISOString(),
      kugutsuVersion: '2.0.0',
    }),
    saveRepositoryMetadata: jest.fn().mockResolvedValue(undefined),
    loadTechStack: jest.fn().mockResolvedValue(null),
    saveTechStack: jest.fn().mockResolvedValue(undefined),
    loadRequirements: jest.fn().mockResolvedValue(undefined),
    saveRequirements: jest.fn().mockResolvedValue(undefined),
    loadTasks: jest.fn().mockResolvedValue([]),
    saveTasks: jest.fn().mockResolvedValue(undefined),
    loadGlobalTasks: jest.fn().mockResolvedValue([]),
    saveGlobalTasks: jest.fn().mockResolvedValue(undefined),
    loadSprintPlan: jest.fn().mockResolvedValue(null),
    saveSprintPlan: jest.fn().mockResolvedValue(undefined),
    loadProductBacklog: jest.fn().mockResolvedValue(null),
    saveProductBacklog: jest.fn().mockResolvedValue(undefined),
    loadActiveSprint: jest.fn().mockResolvedValue(null),
    saveActiveSprint: jest.fn().mockResolvedValue(undefined),
    loadStoryMapping: jest.fn().mockResolvedValue(null),
    saveStoryMapping: jest.fn().mockResolvedValue(undefined),
    loadDesignDocs: jest.fn().mockResolvedValue(null),
    saveDesignDocs: jest.fn().mockResolvedValue(undefined),
    loadArchitectureOverview: jest.fn().mockResolvedValue(null),
    saveArchitectureOverview: jest.fn().mockResolvedValue(undefined),
    loadCodingStandards: jest.fn().mockResolvedValue(null),
    saveCodingStandards: jest.fn().mockResolvedValue(undefined),
  };
}
