/**
 * Graph Stream Adapter
 *
 * Adapts LangGraph state stream to Electron IPC
 */

import type { ParallelDevStateType } from '../graph/state.js';
import type { BrowserWindow } from 'electron';

/**
 * Event types sent to Electron UI
 */
export type UIEvent =
  | { type: 'state_update'; state: Partial<ParallelDevStateType> }
  | { type: 'log'; log: ParallelDevStateType['logs'][0] }
  | { type: 'task_update'; task: ParallelDevStateType['tasks'][0] }
  | { type: 'review_update'; review: ParallelDevStateType['reviews'][0] }
  | { type: 'merge_update'; merge: ParallelDevStateType['mergeQueue'][0] }
  | { type: 'progress'; progress: { pending: number; inProgress: number; completed: number; failed: number } }
  | { type: 'phase_change'; phase: string }
  | { type: 'error'; error: string }
  | { type: 'complete'; summary: any };

/**
 * Graph Stream Adapter
 *
 * Converts LangGraph state updates to Electron IPC events
 */
export class GraphStreamAdapter {
  private window: BrowserWindow | null = null;
  private previousState: ParallelDevStateType | null = null;

  /**
   * Set the Electron window to send events to
   */
  setWindow(window: BrowserWindow | null): void {
    this.window = window;
  }

  /**
   * Process a state update and emit relevant UI events
   */
  async processStateUpdate(state: ParallelDevStateType): Promise<void> {
    if (!this.window) {
      // No window, skip
      return;
    }

    try {
      // Send full state update
      this.sendEvent({
        type: 'state_update',
        state,
      });

      // Send specific updates based on what changed
      if (this.previousState) {
        // Check for new logs
        const newLogs = state.logs.slice(this.previousState.logs.length);
        for (const log of newLogs) {
          this.sendEvent({
            type: 'log',
            log,
          });
        }

        // Check for task updates
        const updatedTasks = state.tasks.filter((task) => {
          const prevTask = this.previousState!.tasks.find((t) => t.id === task.id);
          return !prevTask || prevTask.status !== task.status;
        });
        for (const task of updatedTasks) {
          this.sendEvent({
            type: 'task_update',
            task,
          });
        }

        // Check for new reviews
        const newReviews = state.reviews.slice(this.previousState.reviews.length);
        for (const review of newReviews) {
          this.sendEvent({
            type: 'review_update',
            review,
          });
        }

        // Check for merge updates
        const updatedMerges = state.mergeQueue.filter((merge) => {
          const prevMerge = this.previousState!.mergeQueue.find((m) => m.taskId === merge.taskId);
          return !prevMerge || prevMerge.status !== merge.status;
        });
        for (const merge of updatedMerges) {
          this.sendEvent({
            type: 'merge_update',
            merge,
          });
        }

        // Check for phase changes
        if (state.metadata.phase !== this.previousState.metadata.phase) {
          this.sendEvent({
            type: 'phase_change',
            phase: state.metadata.phase || 'unknown',
          });
        }
      }

      // Always send progress
      const pending = state.tasks.filter((t) => t.status === 'pending').length;
      const inProgress = state.tasks.filter((t) => t.status === 'in_progress').length;
      const completed = state.tasks.filter((t) => t.status === 'completed').length;
      const failed = state.tasks.filter((t) => t.status === 'failed').length;

      this.sendEvent({
        type: 'progress',
        progress: { pending, inProgress, completed, failed },
      });

      // Store current state for next comparison
      this.previousState = state;
    } catch (error) {
      console.error('❌ GraphStreamAdapter error:', error);
      this.sendEvent({
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Send completion event
   */
  sendCompletion(summary: any): void {
    this.sendEvent({
      type: 'complete',
      summary,
    });
  }

  /**
   * Send error event
   */
  sendError(error: string): void {
    this.sendEvent({
      type: 'error',
      error,
    });
  }

  /**
   * Send an event to the Electron window
   */
  private sendEvent(event: UIEvent): void {
    if (!this.window || this.window.isDestroyed()) {
      return;
    }

    try {
      this.window.webContents.send('graph-event', event);
    } catch (error) {
      console.error('❌ Failed to send event to window:', error);
    }
  }

  /**
   * Reset adapter state
   */
  reset(): void {
    this.previousState = null;
  }
}

/**
 * Singleton instance
 */
export const graphStreamAdapter = new GraphStreamAdapter();
