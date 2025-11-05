/**
 * Parallel Development Orchestrator
 *
 * Main orchestrator that executes the LangGraph workflow
 * and streams updates to Electron UI
 */

import type { BrowserWindow } from 'electron';
import { compileParallelDevGraph } from '../graph/ParallelDevGraph.js';
import { createInitialState, type ParallelDevStateType } from '../graph/state.js';
import type { ParallelDevConfig } from '../graph/types.js';
import { graphStreamAdapter } from './GraphStreamAdapter.js';

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

  constructor() {}

  /**
   * Set the Electron window
   */
  setWindow(window: BrowserWindow | null): void {
    this.window = window;
    graphStreamAdapter.setWindow(window);
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

    try {
      // Create initial state
      const initialState = createInitialState(userRequest, config);

      // Compile graph
      console.log('📊 LangGraphワークフローをコンパイル中...');
      const graph = compileParallelDevGraph();

      // Stream initial state
      await graphStreamAdapter.processStateUpdate(initialState);

      // Execute graph with streaming
      console.log('▶️ ワークフロー実行開始');
      let finalState: ParallelDevStateType = initialState;

      const stream = await graph.stream(initialState);
      for await (const event of stream) {
        // event is { [nodeName]: stateUpdate }
        console.log(`📦 イベント受信:`, Object.keys(event));

        // Get the latest state from the event
        // LangGraph stream returns { nodeName: partialState }
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

          // Stream state update to UI
          await graphStreamAdapter.processStateUpdate(finalState);

          console.log(`✅ ノード完了: ${nodeName}`);
        }
      }

      console.log('🎉 ワークフロー実行完了');

      // Send completion event
      const summary = {
        totalTasks: finalState.tasks.length,
        completed: finalState.completedTasks.length,
        failed: finalState.failedTasks.length,
        duration: finalState.metadata.completedAt
          ? new Date(finalState.metadata.completedAt).getTime() -
            new Date(finalState.metadata.startedAt!).getTime()
          : 0,
      };

      graphStreamAdapter.sendCompletion(summary);

      return finalState;
    } catch (error) {
      console.error('❌ Orchestrator エラー:', error);
      graphStreamAdapter.sendError(error instanceof Error ? error.message : String(error));
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
}

/**
 * Singleton instance
 */
export const parallelDevOrchestrator = new ParallelDevOrchestrator();
