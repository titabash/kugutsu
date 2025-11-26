/**
 * ParallelNode
 *
 * Enables parallel execution of tasks with support for:
 * - Concurrent task processing with configurable concurrency limit
 * - Git worktree isolation for parallel development
 * - Error handling with continue-on-error option
 * - Progress tracking and event emission
 * - LangGraph Send API integration
 */

import {
  BaseWorkflowNode,
  type NodeConfig,
  type ExecutionContext,
  type NodeResult,
  type ValidationResult,
} from './BaseWorkflowNode.js';
import type { WorktreeInfo } from '../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Item processing context passed to processItem function
 */
export interface ItemProcessContext {
  /** Index of the item in the input array */
  index: number;
  /** Total number of items */
  total: number;
  /** Worktree info (if useWorktree is enabled) */
  worktree?: WorktreeInfo;
  /** Global execution context */
  global: ExecutionContext['global'];
  /** Services */
  services: ExecutionContext['services'];
  /** Utilities */
  utils: ExecutionContext['utils'];
}

/**
 * Item processing function type
 */
export type ProcessItemFunction = (
  item: unknown,
  context: ItemProcessContext
) => Promise<unknown>;

/**
 * Default item processor (pass-through)
 */
const defaultProcessItem: ProcessItemFunction = async (item) => item;

/**
 * ParallelNode configuration
 */
export interface ParallelNodeConfig extends NodeConfig {
  /** Maximum concurrent executions (default: 4) */
  maxConcurrency?: number;
  /** Use Git worktree for isolation */
  useWorktree?: boolean;
  /** Branch prefix for worktrees */
  branchPrefix?: string;
  /** Cleanup worktrees after execution */
  cleanupAfter?: boolean;
  /** Continue processing on individual item errors */
  continueOnError?: boolean;
  /** Timeout for individual items (ms) */
  itemTimeout?: number;
  /** Custom item processing function */
  processItem?: ProcessItemFunction;
  /** Target node for Send API (LangGraph integration) */
  targetNode?: string;
}

/**
 * Send command for LangGraph integration
 */
interface SendCommand {
  targetNode: string;
  payload: unknown;
}

/**
 * Result item with potential error
 */
interface ResultItem {
  processedId?: string;
  error?: string;
  [key: string]: unknown;
}

// ============================================================================
// ParallelNode
// ============================================================================

/**
 * ParallelNode - Parallel task execution
 *
 * Takes an array of items and processes them in parallel with
 * configurable concurrency limits and optional worktree isolation.
 */
export class ParallelNode extends BaseWorkflowNode {
  declare config: ParallelNodeConfig;

  constructor(id: string, config: ParallelNodeConfig = {}) {
    super({
      id,
      type: 'control:parallel',
      label: 'Parallel',
      description: 'Execute tasks in parallel with configurable concurrency',
      inputs: [
        {
          id: 'items',
          name: 'Items',
          type: 'data',
          dataType: 'array',
          required: true,
        },
      ],
      outputs: [
        {
          id: 'results',
          name: 'Results',
          type: 'data',
          dataType: 'array',
          required: true,
        },
        {
          id: 'sendCommands',
          name: 'Send Commands',
          type: 'data',
          dataType: 'array',
          required: false,
        },
      ],
      config: {
        maxConcurrency: config.maxConcurrency ?? 4,
        useWorktree: config.useWorktree ?? false,
        branchPrefix: config.branchPrefix ?? 'parallel',
        cleanupAfter: config.cleanupAfter ?? true,
        continueOnError: config.continueOnError ?? false,
        itemTimeout: config.itemTimeout,
        processItem: config.processItem,
        targetNode: config.targetNode,
        ...config,
      },
    });
  }

  /**
   * Validate node configuration
   * Note: This overrides base validation to focus on config validation
   * Connection validation is handled by the workflow editor
   */
  validate(): ValidationResult {
    const errors: string[] = [];

    const maxConcurrency = this.config.maxConcurrency;

    if (typeof maxConcurrency !== 'number' || isNaN(maxConcurrency)) {
      errors.push('maxConcurrency must be a number');
    } else if (maxConcurrency < 1) {
      errors.push('maxConcurrency must be at least 1');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Execute parallel processing
   */
  async execute(context: ExecutionContext): Promise<NodeResult> {
    const startTime = Date.now();
    const items = context.inputs.items;

    // Validate input
    if (items === undefined || items === null) {
      return {
        success: false,
        outputs: {},
        error: new Error('items input is required'),
      };
    }

    if (!Array.isArray(items)) {
      return {
        success: false,
        outputs: {},
        error: new Error('items must be an array'),
      };
    }

    // Handle empty array
    if (items.length === 0) {
      return {
        success: true,
        outputs: {
          results: [],
          sendCommands: [],
        },
        metadata: {
          duration: Date.now() - startTime,
          totalCount: 0,
          successCount: 0,
          failedCount: 0,
        },
      };
    }

    const {
      maxConcurrency = 4,
      useWorktree = false,
      branchPrefix = 'parallel',
      cleanupAfter = true,
      continueOnError = false,
      itemTimeout,
      processItem = defaultProcessItem,
      targetNode,
    } = this.config;

    // Track results and stats
    const results: unknown[] = new Array(items.length);
    const worktrees: WorktreeInfo[] = [];
    let successCount = 0;
    let failedCount = 0;

    // Generate Send commands if targetNode is specified
    const sendCommands: SendCommand[] = [];
    if (targetNode) {
      for (const item of items) {
        sendCommands.push({
          targetNode,
          payload: item,
        });
      }
    }

    // Track any error that should stop execution
    let fatalError: Error | null = null;

    try {
      // Process items with limited concurrency using a semaphore pattern
      const queue = items.map((item, index) => ({ item, index }));
      const activePromises: Promise<void>[] = [];

      const processOne = async (item: unknown, index: number): Promise<void> => {
        let worktree: WorktreeInfo | undefined;

        try {
          // Emit item started event
          context.utils.emit('parallel:item-started', {
            nodeId: this.id,
            index,
            total: items.length,
            item,
          });

          // Create worktree if enabled
          if (useWorktree) {
            worktree = await context.services.gitManager.createWorktree({
              branchName: `${branchPrefix}-${context.global.executionId}-${index}`,
              baseBranch: context.global.baseBranch,
            });
            worktrees.push(worktree);
          }

          // Create item processing context
          const itemContext: ItemProcessContext = {
            index,
            total: items.length,
            worktree,
            global: context.global,
            services: context.services,
            utils: context.utils,
          };

          // Process item with optional timeout
          let result: unknown;
          if (itemTimeout) {
            result = await this.executeWithTimeout(
              () => processItem(item, itemContext),
              itemTimeout
            );
          } else {
            result = await processItem(item, itemContext);
          }

          results[index] = result;
          successCount++;

          // Emit item completed event
          context.utils.emit('parallel:item-completed', {
            nodeId: this.id,
            index,
            total: items.length,
            result,
          });
        } catch (error) {
          failedCount++;
          const errorMessage = error instanceof Error ? error.message : String(error);

          if (continueOnError) {
            results[index] = { error: errorMessage } as ResultItem;
            context.utils.emit('parallel:item-failed', {
              nodeId: this.id,
              index,
              total: items.length,
              error: errorMessage,
            });
          } else {
            fatalError = error instanceof Error ? error : new Error(String(error));
            throw fatalError;
          }
        } finally {
          // Clean up worktree if enabled
          if (worktree && cleanupAfter) {
            try {
              await context.services.gitManager.removeWorktree(worktree.path);
            } catch (cleanupError) {
              context.utils.logger.warn(
                `Failed to cleanup worktree: ${worktree.path}`,
                cleanupError
              );
            }
          }

          // Emit progress
          const completedCount = successCount + failedCount;
          context.utils.emit('parallel:progress', {
            nodeId: this.id,
            completed: completedCount,
            total: items.length,
            percentage: Math.round((completedCount / items.length) * 100),
          });
        }
      };

      // Process queue with concurrency limit
      while (queue.length > 0 || activePromises.length > 0) {
        // Fill up to maxConcurrency
        while (queue.length > 0 && activePromises.length < maxConcurrency && !fatalError) {
          const { item, index } = queue.shift()!;
          const promise = processOne(item, index).catch((err) => {
            // Mark as fatal error but don't throw here
            if (!fatalError) {
              fatalError = err;
            }
          });
          activePromises.push(promise);
        }

        // Wait for at least one to complete
        if (activePromises.length > 0) {
          // Wait for the first one to complete
          await Promise.race(activePromises);

          // Remove completed promises
          const completedIndices: number[] = [];
          for (let i = 0; i < activePromises.length; i++) {
            // Check if promise is settled by racing with an already-resolved promise
            const settled = await Promise.race([
              activePromises[i].then(() => true, () => true),
              Promise.resolve().then(() => false)
            ]);
            if (settled) {
              completedIndices.push(i);
            }
          }

          // Remove settled promises (in reverse order to maintain indices)
          for (let i = completedIndices.length - 1; i >= 0; i--) {
            activePromises.splice(completedIndices[i], 1);
          }
        }

        // Check for fatal error
        if (fatalError && !continueOnError) {
          break;
        }
      }

      // Wait for any remaining promises
      if (activePromises.length > 0) {
        await Promise.allSettled(activePromises);
      }

      // If there was a fatal error, throw it
      if (fatalError) {
        throw fatalError;
      }

      return {
        success: true,
        outputs: {
          results,
          sendCommands,
        },
        metadata: {
          duration: Date.now() - startTime,
          totalCount: items.length,
          successCount,
          failedCount,
        },
      };
    } catch (error) {
      // Clean up any remaining worktrees on failure
      if (cleanupAfter) {
        for (const wt of worktrees) {
          try {
            await context.services.gitManager.removeWorktree(wt.path);
          } catch {
            // Ignore cleanup errors on failure
          }
        }
      }

      return {
        success: false,
        outputs: {
          results,
          sendCommands,
        },
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          duration: Date.now() - startTime,
          totalCount: items.length,
          successCount,
          failedCount,
        },
      };
    }
  }

  /**
   * Execute a function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Item execution timeout after ${timeout}ms`));
      }, timeout);

      fn()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Create ParallelNode from JSON
   */
  static createFromJSON(json: {
    id: string;
    type: 'control:parallel';
    label: string;
    position: { x: number; y: number };
    inputs: unknown[];
    outputs: unknown[];
    config: ParallelNodeConfig;
  }): ParallelNode {
    const node = new ParallelNode(json.id, json.config);
    node.label = json.label;
    node.setPosition(json.position.x, json.position.y);
    return node;
  }
}

export default ParallelNode;
