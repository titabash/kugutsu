/**
 * Parallel Development Orchestrator
 *
 * Main orchestrator that executes the LangGraph workflow
 * and streams updates to Electron UI
 */

import type { BrowserWindow } from 'electron';
import { compileUnifiedScrumWorkflowGraph } from '../graph/ParallelDevGraph.js';
import { createInitialState, type ParallelDevStateType } from '../graph/state.js';
import type { ParallelDevConfig } from '../graph/types.js';
import { StateStreamManager } from './StateStreamManager.js';
import { UnifiedProgressManager } from '../utils/UnifiedProgressManager.js';
import { buildUnifiedScrumWorkflowFlow } from '../utils/NodeFlowBuilder.js';

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  /**
   * User request to process
   */
  userRequest: string;

  /**
   * Parallel development configuration
   */
  config: ParallelDevConfig;

  /**
   * Electron window for UI updates (optional)
   */
  window?: BrowserWindow | null;
}

/**
 * Parallel Development Orchestrator
 *
 * Executes the LangGraph workflow and manages UI updates
 */
export class ParallelDevOrchestrator {
  private window: BrowserWindow | null = null;
  private stateStreamManager: StateStreamManager | null = null;
  private progressManager: UnifiedProgressManager | null = null;

  constructor() {
    // Initialize StateStreamManager
    this.stateStreamManager = new StateStreamManager({
      bufferInterval: 50,
      maxEventsPerSecond: 20,
      maxBufferSize: 100,
      maxLogBuffer: 1000,
    });

    // Initialize UnifiedProgressManager
    this.progressManager = new UnifiedProgressManager();

    // Connect UnifiedProgressManager to StateStreamManager
    this.setupProgressCallbacks();
  }

  /**
   * Setup callbacks to connect UnifiedProgressManager with StateStreamManager
   */
  private setupProgressCallbacks(): void {
    if (!this.progressManager || !this.stateStreamManager) return;

    // Forward node started events to StateStreamManager
    this.progressManager.onNodeStarted(async (execution) => {
      console.log(`📍 [ProgressManager] Node started: ${execution.nodeName}${execution.taskId ? ` (task: ${execution.taskId})` : ''}`);

      // Forward to StateStreamManager (already handled via notifyNodeExecution)
      // This provides redundancy and validation
    });

    // Forward node completed events to StateStreamManager
    this.progressManager.onNodeCompleted(async (execution) => {
      console.log(`✅ [ProgressManager] Node completed: ${execution.nodeName}${execution.taskId ? ` (task: ${execution.taskId})` : ''} - ${execution.status}`);

      // Forward to StateStreamManager (already handled via notifyNodeExecution)
      // This provides redundancy and validation
    });

    // Log task progress updates
    this.progressManager.onTaskProgress((progress) => {
      console.log(`📊 [ProgressManager] Task progress: ${progress.taskId} - ${progress.progress}% (${progress.status})`);

      // Optionally, send task-specific progress events to Electron UI
      // (currently handled via state updates, but can be enhanced)
    });
  }

  /**
   * Get current progress manager (for external access)
   */
  getProgressManager(): UnifiedProgressManager | null {
    return this.progressManager;
  }

  /**
   * Set the Electron window
   */
  setWindow(window: BrowserWindow | null): void {
    this.window = window;

    // Set window for StateStreamManager
    if (this.stateStreamManager) {
      this.stateStreamManager.setWindow(window);
    }
  }

  /**
   * Execute the parallel development workflow
   */
  async execute(orchestratorConfig: OrchestratorConfig): Promise<ParallelDevStateType> {
    const { userRequest, config, window } = orchestratorConfig;

    // Set window if provided
    if (window) {
      this.setWindow(window);
    }

    console.log('🚀 Parallel Development Orchestrator 起動');
    console.log(`📝 ユーザー要求: ${userRequest}`);
    console.log(`🔄 ワークフロー: 統合Scrumワークフロー（複雑度判定による自動分岐）`);

    // Initialize node flow for Electron UI
    if (this.stateStreamManager) {
      const nodeFlowData = buildUnifiedScrumWorkflowFlow();
      this.stateStreamManager.initNodeFlow(nodeFlowData);
      console.log(`📊 ノードフロー初期化完了: ${nodeFlowData.nodes.length} ノード, ${nodeFlowData.edges.length} エッジ`);
    }

    // Track current state for error handling
    let currentState: ParallelDevStateType | null = null;

    try {
      // Create initial state
      const initialState = createInitialState(userRequest, config);
      currentState = initialState;

      // Compile Unified Scrum Workflow Graph
      console.log('📊 統合Scrumワークフローをコンパイル中...');
      const graph = compileUnifiedScrumWorkflowGraph({
        enableCheckpointer: true,
      });

      // Stream initial state to UI via StateStreamManager
      if (this.stateStreamManager) {
        await this.stateStreamManager.processStateUpdate(initialState);

        // Initialize node flow visualization
        const nodeFlowData = buildUnifiedScrumWorkflowFlow();
        this.stateStreamManager.initializeNodeFlow(nodeFlowData);
        console.log('🎨 ノードフロー可視化を初期化しました');
      }

      // Execute graph with streaming
      // Enable multiple stream modes: values (state updates), debug (node execution), tasks (task tracking)
      console.log('▶️ ワークフロー実行開始');
      let finalState: ParallelDevStateType = initialState;

      const stream = await graph.stream(initialState, {
        streamMode: ["values", "debug", "tasks"] as const,
      });

      for await (const event of stream) {
        // Handle different stream modes
        // When multiple streamModes are specified, LangGraph may return events in different formats
        // We need to detect the event type and route to appropriate handlers

        // Check if this is a debug event
        if (event && typeof event === 'object' && 'type' in event && 'payload' in event) {
          // Debug event: { type, timestamp, step, payload }
          await this.handleDebugEvent(event, finalState);
          continue;
        }

        // Check if this is a task event
        if (event && typeof event === 'object' && 'id' in event && 'name' in event) {
          // Task event: { id, name, input, result, triggers, interrupts }
          await this.handleTaskEvent(event, finalState);
          continue;
        }

        // Otherwise, treat as value event (default stream mode)
        // Value event: { [nodeName]: stateUpdate }
        if (event && typeof event === 'object') {
          const previousState = finalState;
          finalState = await this.handleValueEvent(event, finalState);

          // Update currentState for error handling
          currentState = finalState;
        } else {
          console.warn(`⚠️ Unknown event format:`, event);
        }
      }

      console.log('🎉 ワークフロー実行完了');

      // Send completion event via StateStreamManager
      const completionState: ParallelDevStateType = {
        ...finalState,
        metadata: {
          ...finalState.metadata,
          phase: 'complete',
          completedAt: new Date(),
        },
      };

      if (this.stateStreamManager) {
        await this.stateStreamManager.processStateUpdate(completionState);
      }

      return completionState;
    } catch (error) {
      console.error('❌ Orchestrator エラー:', error);
      // Send error via StateStreamManager
      if (this.stateStreamManager && currentState) {
        const errorState: ParallelDevStateType = {
          ...currentState,
          metadata: {
            ...currentState.metadata,
            hasErrors: true,
            errors: [error instanceof Error ? error.message : String(error)],
          },
        };
        await this.stateStreamManager.processStateUpdate(errorState);
      }
      throw error;
    }
  }

  /**
   * Merge tasks by ID
   */
  private mergeTasks(
    existing: ParallelDevStateType['tasks'],
    updates: ParallelDevStateType['tasks']
  ): ParallelDevStateType['tasks'] {
    const taskMap = new Map(existing.map((t) => [t.id, t]));
    updates.forEach((t) => taskMap.set(t.id, t));
    return Array.from(taskMap.values());
  }

  /**
   * Merge merge queue by task ID
   */
  private mergeMergeQueue(
    existing: ParallelDevStateType['mergeQueue'],
    updates: ParallelDevStateType['mergeQueue']
  ): ParallelDevStateType['mergeQueue'] {
    const mergeMap = new Map(existing.map((m) => [m.taskId, m]));
    updates.forEach((m) => mergeMap.set(m.taskId, m));
    return Array.from(mergeMap.values());
  }

  /**
   * Handle debug stream events from LangGraph
   * Debug events provide detailed execution information including node start/end times
   */
  private async handleDebugEvent(
    event: any,
    finalState: ParallelDevStateType
  ): Promise<void> {
    // Debug event structure: { type, timestamp, step, payload }
    const { type, payload, step } = event;

    // Process via UnifiedProgressManager
    if (this.progressManager) {
      this.progressManager.processDebugEvent(event);
    }

    if (type === 'task') {
      // Task execution events
      const { name: nodeName, input, metadata } = payload || {};

      if (nodeName) {
        console.log(`🔍 [Debug] Node started: ${nodeName} (step ${step})`);

        // Notify StateStreamManager about node execution
        if (this.stateStreamManager) {
          await this.stateStreamManager.notifyNodeExecution(nodeName, 'started', finalState);
        }
      }
    } else if (type === 'checkpoint') {
      // Checkpoint events (node completion)
      console.log(`🔍 [Debug] Checkpoint at step ${step}`);
    }
  }

  /**
   * Handle task stream events from LangGraph
   * Task events provide information about individual task execution within nodes
   */
  private async handleTaskEvent(
    event: any,
    finalState: ParallelDevStateType
  ): Promise<void> {
    // Task event structure: { id, name, input, result, triggers, interrupts }
    const { id, name, input, result } = event;

    // Process via UnifiedProgressManager
    if (this.progressManager) {
      this.progressManager.processTaskEvent(event);
    }

    console.log(`📋 [Task] ${name} (${id}):`, result ? 'completed' : 'started');

    // Extract task ID from input if available (for Send API parallel execution)
    const taskId = input?.currentTaskId;
    if (taskId) {
      console.log(`   └─ Processing task: ${taskId}`);
    }
  }

  /**
   * Handle value stream events from LangGraph (state updates)
   * This is the traditional stream mode that returns state updates
   */
  private async handleValueEvent(
    event: any,
    finalState: ParallelDevStateType
  ): Promise<ParallelDevStateType> {
    // Value event structure: { [nodeName]: stateUpdate }
    const nodeNames = Object.keys(event);

    for (const nodeName of nodeNames) {
      const stateUpdate = event[nodeName];

      // Merge state update into finalState
      finalState = {
        ...finalState,
        ...stateUpdate,
        // Merge arrays properly
        tasks: stateUpdate.tasks
          ? this.mergeTasks(finalState.tasks, stateUpdate.tasks)
          : finalState.tasks,
        completedTasks: stateUpdate.completedTasks
          ? [...finalState.completedTasks, ...stateUpdate.completedTasks]
          : finalState.completedTasks,
        failedTasks: stateUpdate.failedTasks
          ? [...finalState.failedTasks, ...stateUpdate.failedTasks]
          : finalState.failedTasks,
        reviews: stateUpdate.reviews
          ? [...finalState.reviews, ...stateUpdate.reviews]
          : finalState.reviews,
        mergeQueue: stateUpdate.mergeQueue
          ? this.mergeMergeQueue(finalState.mergeQueue, stateUpdate.mergeQueue)
          : finalState.mergeQueue,
        logs: stateUpdate.logs
          ? [...finalState.logs, ...stateUpdate.logs]
          : finalState.logs,
        worktrees: stateUpdate.worktrees
          ? new Map([...finalState.worktrees, ...stateUpdate.worktrees])
          : finalState.worktrees,
        metadata: stateUpdate.metadata
          ? { ...finalState.metadata, ...stateUpdate.metadata }
          : finalState.metadata,
      };

      // Extract taskId from state (for Send API parallel execution)
      const taskId = stateUpdate.currentTaskId || finalState.currentTaskId;

      // Process via UnifiedProgressManager
      if (this.progressManager) {
        this.progressManager.processValueEvent(nodeName, taskId);
      }

      // Stream state update to UI via StateStreamManager
      if (this.stateStreamManager) {
        await this.stateStreamManager.processStateUpdate(finalState);

        // Notify StateStreamManager about node completion
        await this.stateStreamManager.notifyNodeExecution(nodeName, 'completed', finalState);
      }

      console.log(`✅ ノード完了: ${nodeName}${taskId ? ` (task: ${taskId})` : ''}`);
    }

    return finalState;
  }

  /**
   * Cleanup and destroy StateStreamManager and UnifiedProgressManager
   */
  destroy(): void {
    if (this.stateStreamManager) {
      this.stateStreamManager.destroy();
      this.stateStreamManager = null;
    }

    if (this.progressManager) {
      this.progressManager.clear();
      this.progressManager = null;
    }
  }
}

/**
 * Singleton instance
 */
export const parallelDevOrchestrator = new ParallelDevOrchestrator();
