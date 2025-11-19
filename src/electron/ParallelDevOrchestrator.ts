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
import { buildScrumTeamDashboardFlow } from '../utils/NodeFlowBuilder.js';

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
  private isCancelled: boolean = false;
  private abortController: AbortController | null = null;

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
   * Cancel the current execution
   */
  public cancel(): void {
    console.log('🛑 [ParallelDevOrchestrator] cancel() called');
    console.log('🛑 [ParallelDevOrchestrator] Setting isCancelled flag to true');
    this.isCancelled = true;
    console.log('🛑 [ParallelDevOrchestrator] isCancelled =', this.isCancelled);

    // Also abort via AbortController if available
    if (this.abortController) {
      console.log('🛑 [ParallelDevOrchestrator] Calling abortController.abort()');
      this.abortController.abort();
      console.log('🛑 [ParallelDevOrchestrator] AbortController aborted');
    } else {
      console.log('⚠️ [ParallelDevOrchestrator] No AbortController available');
    }
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

    // Reset cancellation flag
    this.isCancelled = false;
    console.log('🔄 [ParallelDevOrchestrator] isCancelled flag reset to false');

    // Create new AbortController for this execution
    this.abortController = new AbortController();
    console.log('🔄 [ParallelDevOrchestrator] New AbortController created');

    // Inject abortSignal into config
    const configWithAbort: ParallelDevConfig = {
      ...config,
      abortSignal: this.abortController.signal,
    };

    console.log('🔄 [ParallelDevOrchestrator] AbortSignal injected into config');

    // Set window if provided
    if (window) {
      this.setWindow(window);
    }

    console.log('🚀 Parallel Development Orchestrator 起動');
    console.log(`📝 ユーザー要求: ${userRequest}`);
    console.log(`🔄 ワークフロー: 統合Scrumワークフロー（複雑度判定による自動分岐）`);

    // Initialize node flow for Electron UI (Scrum Team Dashboard)
    if (this.stateStreamManager) {
      const nodeFlowData = buildScrumTeamDashboardFlow();
      this.stateStreamManager.initNodeFlow(nodeFlowData);
      console.log(`📊 Scrumチームダッシュボード初期化完了: ${nodeFlowData.nodes.length} メンバー, ${nodeFlowData.edges.length} フロー`);
    }

    // Track current state for error handling
    let currentState: ParallelDevStateType | null = null;

    try {
      // Create initial state with abortSignal in config
      const initialState = createInitialState(userRequest, configWithAbort);
      currentState = initialState;

      // Compile Unified Scrum Workflow Graph
      console.log('📊 統合Scrumワークフローをコンパイル中...');
      const graph = compileUnifiedScrumWorkflowGraph({
        enableCheckpointer: true,
      });

      // Stream initial state to UI via StateStreamManager
      if (this.stateStreamManager) {
        await this.stateStreamManager.processStateUpdate(initialState);

        // Initialize node flow visualization (Scrum Team Dashboard)
        const nodeFlowData = buildScrumTeamDashboardFlow();
        this.stateStreamManager.initializeNodeFlow(nodeFlowData);
        console.log('🎨 Scrumチームダッシュボードを初期化しました');
      }

      // Execute graph with streaming
      // Enable multiple stream modes: values (state updates), debug (node execution), tasks (task tracking)
      console.log('▶️ ワークフロー実行開始');
      let finalState: ParallelDevStateType = initialState;

      const stream = await graph.stream(initialState, {
        streamMode: ["values", "debug", "tasks"] as const,
        configurable: {
          thread_id: `exec-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        },
      } as any);

      console.log('▶️ [ParallelDevOrchestrator] Stream started, entering event loop...');

      for await (const event of stream) {
        // Check for cancellation at the beginning of each iteration
        if (this.isCancelled || this.abortController?.signal.aborted) {
          console.log('🛑 [ParallelDevOrchestrator] Cancellation detected at loop start');
          console.log('🛑 [ParallelDevOrchestrator] isCancelled =', this.isCancelled);
          console.log('🛑 [ParallelDevOrchestrator] aborted =', this.abortController?.signal.aborted);
          console.log('🛑 Execution cancelled by user');

          // Update finalState with cancelled flag
          finalState = {
            ...finalState,
            metadata: {
              ...finalState.metadata,
              cancelled: true,
              phase: 'cancelled',
              completedAt: new Date(),
            },
          };

          // Send cancellation event to UI
          if (this.stateStreamManager) {
            console.log('🛑 [ParallelDevOrchestrator] Sending cancelled state to UI...');
            await this.stateStreamManager.processStateUpdate(finalState);
            console.log('🛑 [ParallelDevOrchestrator] Cancelled state sent to UI');
          }

          // Update currentState for error handling
          currentState = finalState;

          // Break out of the stream loop
          console.log('🛑 [ParallelDevOrchestrator] Breaking out of stream loop');
          break;
        }

        console.log('📨 [ParallelDevOrchestrator] Processing stream event...');

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
      // Check if this is an abort error (cancellation)
      if (error instanceof Error && (error.name === 'AbortError' || this.isCancelled)) {
        console.log('🛑 [ParallelDevOrchestrator] Execution aborted/cancelled');

        // Send cancellation state to UI
        if (this.stateStreamManager && currentState) {
          const cancelledState: ParallelDevStateType = {
            ...currentState,
            metadata: {
              ...currentState.metadata,
              phase: 'cancelled',
              completedAt: new Date(),
            },
          };
          await this.stateStreamManager.processStateUpdate(cancelledState);

          // Return cancelled state
          return cancelledState;
        }

        // If no currentState, return initial state with cancelled phase
        throw new Error('Execution cancelled by user');
      }

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
