/**
 * GroupNode
 *
 * Enables subgraph parallel execution. A GroupNode contains a subgraph
 * (multiple nodes and connections) that can be executed in parallel
 * for different inputs, each in its own git worktree.
 */

import {
  BaseWorkflowNode,
  type NodeConfig,
  type ExecutionContext,
  type NodeResult,
  type ValidationResult,
} from './BaseWorkflowNode.js';
import type { WorkflowNodeJSON, ConnectionJSON, WorktreeInfo } from '../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Subgraph definition
 */
export interface SubgraphDefinition {
  /** Nodes in the subgraph */
  nodes: WorkflowNodeJSON[];
  /** Connections between nodes */
  connections: ConnectionJSON[];
}

/**
 * Parallel execution configuration
 */
export interface ParallelExecutionConfig {
  /** Enable parallel execution */
  enabled: boolean;
  /** Input array key name */
  inputArray: string;
  /** Maximum concurrency */
  maxConcurrency?: number;
}

/**
 * Worktree configuration
 */
export interface WorktreeConfig {
  /** Use git worktree for isolation */
  useWorktree: boolean;
  /** Branch prefix for worktrees */
  branchPrefix: string;
  /** Cleanup worktrees after execution */
  cleanupAfter: boolean;
}

/**
 * Subgraph executor function type
 */
export type SubgraphExecutor = (
  input: unknown,
  worktree: WorktreeInfo | null,
  context: ExecutionContext
) => Promise<unknown>;

/**
 * GroupNode configuration
 */
export interface GroupNodeConfig extends NodeConfig {
  /** Subgraph definition */
  subgraph?: SubgraphDefinition;
  /** Parallel execution settings */
  parallelExecution?: ParallelExecutionConfig;
  /** Worktree settings */
  worktreeConfig?: WorktreeConfig;
  /** Continue processing on individual item errors */
  continueOnError?: boolean;
  /** Custom subgraph executor (for testing) */
  executeSubgraph?: SubgraphExecutor;
}

/**
 * Result item with potential error
 */
interface ResultItem {
  error?: string;
  [key: string]: unknown;
}

// ============================================================================
// GroupNode
// ============================================================================

/**
 * GroupNode - Subgraph parallel execution
 *
 * Executes a subgraph for each input item, optionally in parallel
 * with git worktree isolation.
 */
export class GroupNode extends BaseWorkflowNode {
  declare config: GroupNodeConfig;

  constructor(id: string, config: GroupNodeConfig = {}) {
    super({
      id,
      type: 'control:group',
      label: 'Group',
      description: 'Execute a subgraph in parallel for multiple inputs',
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
      ],
      config: {
        subgraph: config.subgraph,
        parallelExecution: config.parallelExecution ?? {
          enabled: true,
          inputArray: 'items',
          maxConcurrency: 4,
        },
        worktreeConfig: config.worktreeConfig ?? {
          useWorktree: false,
          branchPrefix: 'group',
          cleanupAfter: true,
        },
        continueOnError: config.continueOnError ?? false,
        executeSubgraph: config.executeSubgraph,
        ...config,
      },
    });
  }

  /**
   * Validate node configuration
   */
  validate(): ValidationResult {
    const errors: string[] = [];

    const subgraph = this.config.subgraph;

    if (!subgraph) {
      errors.push('subgraph is required');
    } else if (!subgraph.nodes || subgraph.nodes.length === 0) {
      errors.push('subgraph must contain at least one node (nodes array is empty)');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Execute the group node
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
      parallelExecution = { enabled: true, inputArray: 'items', maxConcurrency: 4 },
      worktreeConfig = { useWorktree: false, branchPrefix: 'group', cleanupAfter: true },
      continueOnError = false,
      executeSubgraph = this.defaultSubgraphExecutor.bind(this),
    } = this.config;

    const maxConcurrency = parallelExecution.maxConcurrency ?? 4;
    const useWorktree = worktreeConfig.useWorktree;
    const branchPrefix = worktreeConfig.branchPrefix;
    const cleanupAfter = worktreeConfig.cleanupAfter;

    // Track results and stats
    const results: unknown[] = new Array(items.length);
    const worktrees: WorktreeInfo[] = [];
    let successCount = 0;
    let failedCount = 0;
    let fatalError: Error | null = null;

    try {
      if (parallelExecution.enabled) {
        // Parallel execution
        const queue = items.map((item, index) => ({ item, index }));
        const activePromises: Promise<void>[] = [];

        const processOne = async (item: unknown, index: number): Promise<void> => {
          let worktree: WorktreeInfo | null = null;

          try {
            // Create worktree if enabled
            if (useWorktree) {
              worktree = await context.services.gitManager.createWorktree({
                branchName: `${branchPrefix}-${context.global.executionId}-${index}`,
                baseBranch: context.global.baseBranch,
              });
              worktrees.push(worktree);
            }

            // Execute subgraph
            const result = await executeSubgraph(item, worktree, context);
            results[index] = result;
            successCount++;
          } catch (error) {
            failedCount++;
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (continueOnError) {
              results[index] = { error: errorMessage } as ResultItem;
            } else {
              fatalError = error instanceof Error ? error : new Error(String(error));
              throw fatalError;
            }
          } finally {
            // Cleanup worktree if enabled
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
          }
        };

        // Process queue with concurrency limit
        while (queue.length > 0 || activePromises.length > 0) {
          // Fill up to maxConcurrency
          while (queue.length > 0 && activePromises.length < maxConcurrency && !fatalError) {
            const { item, index } = queue.shift()!;
            const promise = processOne(item, index).catch((err) => {
              if (!fatalError) {
                fatalError = err;
              }
            });
            activePromises.push(promise);
          }

          // Wait for at least one to complete
          if (activePromises.length > 0) {
            await Promise.race(activePromises);

            // Remove completed promises
            const completedIndices: number[] = [];
            for (let i = 0; i < activePromises.length; i++) {
              const settled = await Promise.race([
                activePromises[i].then(() => true, () => true),
                Promise.resolve().then(() => false),
              ]);
              if (settled) {
                completedIndices.push(i);
              }
            }

            for (let i = completedIndices.length - 1; i >= 0; i--) {
              activePromises.splice(completedIndices[i], 1);
            }
          }

          if (fatalError && !continueOnError) {
            break;
          }
        }

        // Wait for remaining promises
        if (activePromises.length > 0) {
          await Promise.allSettled(activePromises);
        }
      } else {
        // Sequential execution
        for (let index = 0; index < items.length; index++) {
          const item = items[index];
          let worktree: WorktreeInfo | null = null;

          try {
            // Create worktree if enabled
            if (useWorktree) {
              worktree = await context.services.gitManager.createWorktree({
                branchName: `${branchPrefix}-${context.global.executionId}-${index}`,
                baseBranch: context.global.baseBranch,
              });
              worktrees.push(worktree);
            }

            // Execute subgraph
            const result = await executeSubgraph(item, worktree, context);
            results[index] = result;
            successCount++;
          } catch (error) {
            failedCount++;
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (continueOnError) {
              results[index] = { error: errorMessage } as ResultItem;
            } else {
              throw error;
            }
          } finally {
            // Cleanup worktree if enabled
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
          }
        }
      }

      // If there was a fatal error, throw it
      if (fatalError) {
        throw fatalError;
      }

      return {
        success: true,
        outputs: {
          results,
        },
        metadata: {
          duration: Date.now() - startTime,
          totalCount: items.length,
          successCount,
          failedCount,
        },
      };
    } catch (error) {
      // Cleanup any remaining worktrees on failure
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
   * Default subgraph executor
   * In production, this would use WorkflowTransformer to execute the subgraph
   */
  private async defaultSubgraphExecutor(
    input: unknown,
    _worktree: WorktreeInfo | null,
    _context: ExecutionContext
  ): Promise<unknown> {
    // Default implementation just passes through the input
    // Real implementation would transform and execute the subgraph
    return { processed: input };
  }

  /**
   * Create GroupNode from JSON
   */
  static createFromJSON(json: {
    id: string;
    type: 'control:group';
    label: string;
    position: { x: number; y: number };
    inputs: unknown[];
    outputs: unknown[];
    config: GroupNodeConfig;
  }): GroupNode {
    const node = new GroupNode(json.id, json.config);
    node.label = json.label;
    node.setPosition(json.position.x, json.position.y);
    return node;
  }
}

export default GroupNode;
