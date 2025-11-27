/**
 * ParallelGroupNode - Parallel task execution with subgraph replication
 *
 * This node receives a list of tasks and executes the internal subgraph
 * for each task in parallel with configurable concurrency limits.
 * Optionally uses Git worktrees for isolation and handles conflict resolution.
 */

import {
  BaseWorkflowNode,
  type BaseWorkflowNodeOptions,
  type ExecutionContext,
  type NodeResult,
  type ValidationResult,
  type NodeConfig,
  type WorkflowNodeJSON,
} from './BaseWorkflowNode.js';
import type { ConnectionJSON, WorkflowNodeJSON as NodeJSON } from '../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Task definition for parallel execution
 */
export interface Task {
  /** Unique task ID */
  id: string;
  /** Task description */
  description: string;
  /** Task priority */
  priority?: 'low' | 'medium' | 'high' | 'critical';
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Subgraph definition - a mini-workflow inside the parallel group
 */
export interface SubgraphDefinition {
  /** Nodes in the subgraph */
  nodes: NodeJSON[];
  /** Connections between nodes in the subgraph */
  connections: ConnectionJSON[];
  /** Entry node ID (first node to receive task input) */
  entryNodeId: string;
  /** Exit node ID (node that produces final output) */
  exitNodeId: string;
}

/**
 * Conflict resolution strategy
 */
export type ConflictResolutionStrategy = 'ai' | 'ours' | 'theirs' | 'manual';

/**
 * Conflict resolution configuration
 */
export interface ConflictResolutionConfig {
  /** Resolution strategy */
  strategy: ConflictResolutionStrategy;
  /** Auto-merge after each task completes */
  autoMergeAfterTask: boolean;
}

/**
 * Failure strategy for parallel execution
 */
export type FailureStrategy = 'continue' | 'abort-all' | 'retry';

/**
 * Aggregation strategy for results
 */
export type AggregationStrategy = 'merge' | 'concat' | 'none';

/**
 * Configuration for ParallelGroupNode
 */
export interface ParallelGroupConfig {
  /** Maximum number of concurrent executions */
  maxConcurrency: number;
  /** Use Git worktree for isolation */
  useWorktree: boolean;
  /** Branch prefix for worktrees */
  branchPrefix: string;
  /** Cleanup worktrees after execution */
  cleanupAfter: boolean;
  /** Strategy when a task fails */
  failureStrategy: FailureStrategy;
  /** Strategy for aggregating results */
  aggregationStrategy: AggregationStrategy;
  /** Key name for passing task to subgraph entry node */
  inputMapping: string;
  /** Conflict resolution configuration (when useWorktree=true) */
  conflictResolution: ConflictResolutionConfig;
}

/**
 * Result from executing a single task
 */
export interface TaskExecutionResult {
  /** Task ID */
  taskId: string;
  /** Whether execution succeeded */
  success: boolean;
  /** Output from subgraph */
  output?: unknown;
  /** Error if failed */
  error?: Error;
  /** Worktree info if used */
  worktree?: {
    path: string;
    branchName: string;
  };
}

/**
 * Subgraph executor function type
 */
export type SubgraphExecutor = (
  task: Task,
  context: ExecutionContext
) => Promise<{ success: boolean; output: unknown }>;

/**
 * Conflict resolver function type
 */
export type ConflictResolver = (
  conflictDetails: Array<{
    file: string;
    content: string;
    ours: string;
    theirs: string;
  }>,
  context: ExecutionContext
) => Promise<{ resolved: boolean; resolvedContent?: string }>;

// ============================================================================
// ParallelGroupNode
// ============================================================================

/**
 * Node for parallel task execution with subgraph replication
 */
export class ParallelGroupNode extends BaseWorkflowNode {
  /** Subgraph definition */
  private subgraph?: SubgraphDefinition;

  /** Custom subgraph executor (for testing) */
  private subgraphExecutor?: SubgraphExecutor;

  /** Custom conflict resolver (for testing) */
  private conflictResolver?: ConflictResolver;

  constructor(id: string, config: NodeConfig) {
    const parallelConfig = config.parallelGroup as ParallelGroupConfig | undefined;

    const options: BaseWorkflowNodeOptions = {
      id,
      type: 'control:parallel-group' as any,
      label: 'Parallel Group',
      description: 'Execute subgraph for each task in parallel',
      inputs: [
        {
          id: 'tasks',
          name: 'Tasks',
          type: 'data',
          required: true,
        },
      ],
      outputs: [
        {
          id: 'results',
          name: 'Results',
          type: 'data',
          required: false,
        },
      ],
      config: {
        parallelGroup: {
          maxConcurrency: parallelConfig?.maxConcurrency ?? 4,
          useWorktree: parallelConfig?.useWorktree ?? false,
          branchPrefix: parallelConfig?.branchPrefix ?? 'parallel',
          cleanupAfter: parallelConfig?.cleanupAfter ?? true,
          failureStrategy: parallelConfig?.failureStrategy ?? 'continue',
          aggregationStrategy: parallelConfig?.aggregationStrategy ?? 'merge',
          inputMapping: parallelConfig?.inputMapping ?? 'task',
          conflictResolution: parallelConfig?.conflictResolution ?? {
            strategy: 'ai',
            autoMergeAfterTask: true,
          },
        },
        ...config,
      },
    };

    super(options);
  }

  /**
   * Get the parallel group configuration
   */
  private getParallelConfig(): ParallelGroupConfig {
    return this.config.parallelGroup as ParallelGroupConfig;
  }

  /**
   * Set the subgraph definition
   */
  setSubgraph(subgraph: SubgraphDefinition): void {
    this.subgraph = subgraph;
    this.config.subgraph = subgraph;
  }

  /**
   * Get the subgraph definition
   */
  getSubgraph(): SubgraphDefinition | undefined {
    return this.subgraph;
  }

  /**
   * Set custom subgraph executor (for testing)
   */
  setSubgraphExecutor(executor: SubgraphExecutor): void {
    this.subgraphExecutor = executor;
  }

  /**
   * Set custom conflict resolver (for testing)
   */
  setConflictResolver(resolver: ConflictResolver): void {
    this.conflictResolver = resolver;
  }

  /**
   * Validate the node configuration and connections
   */
  override validate(): ValidationResult {
    const result = super.validate();
    const errors = [...result.errors];

    const config = this.getParallelConfig();

    // Validate maxConcurrency
    if (config.maxConcurrency < 1) {
      errors.push('maxConcurrency must be at least 1');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate the subgraph definition
   */
  validateSubgraph(): ValidationResult {
    const errors: string[] = [];

    if (!this.subgraph) {
      errors.push('Subgraph is not defined');
      return { valid: false, errors };
    }

    if (!this.subgraph.entryNodeId) {
      errors.push('Subgraph must have an entry node');
    } else {
      const entryNode = this.subgraph.nodes.find((n) => n.id === this.subgraph!.entryNodeId);
      if (!entryNode) {
        errors.push('Entry node not found in subgraph');
      }
    }

    if (!this.subgraph.exitNodeId) {
      errors.push('Subgraph must have an exit node');
    } else {
      const exitNode = this.subgraph.nodes.find((n) => n.id === this.subgraph!.exitNodeId);
      if (!exitNode) {
        errors.push('Exit node not found in subgraph');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Execute the parallel group node
   */
  async execute(context: ExecutionContext): Promise<NodeResult> {
    const startTime = Date.now();
    const config = this.getParallelConfig();
    const tasks = context.inputs.tasks as Task[];

    // Handle empty tasks
    if (!tasks || tasks.length === 0) {
      return {
        success: true,
        outputs: { results: [] },
        metadata: {
          duration: Date.now() - startTime,
          taskCount: 0,
          successCount: 0,
          failureCount: 0,
        },
      };
    }

    // Execute tasks in parallel with concurrency limit
    const results: TaskExecutionResult[] = [];
    let successCount = 0;
    let failureCount = 0;
    let conflicts: Array<{
      taskId: string;
      files: string[];
    }> = [];
    let paused = false;
    let waitingForManualResolution = false;

    // Create a semaphore for concurrency control
    const semaphore = new Semaphore(config.maxConcurrency);

    // Execute all tasks
    const executeTask = async (task: Task): Promise<TaskExecutionResult> => {
      await semaphore.acquire();

      try {
        let worktreeInfo: { path: string; branchName: string } | undefined;

        // Create worktree if configured
        if (config.useWorktree) {
          const branchName = `${config.branchPrefix}/${task.id}`;
          worktreeInfo = await context.services.gitManager.createWorktree({
            branchName,
            baseBranch: context.global.baseBranch,
          });
        }

        // Execute subgraph
        let result: { success: boolean; output: unknown };
        try {
          if (this.subgraphExecutor) {
            // Use custom executor (for testing)
            result = await this.subgraphExecutor(task, context);
          } else {
            // Default execution - this would call the actual subgraph executor
            result = await this.executeSubgraphDefault(task, context);
          }
        } catch (error) {
          result = { success: false, output: error };
          if (config.failureStrategy === 'abort-all') {
            throw error;
          }
        }

        // Handle worktree merge
        if (config.useWorktree && worktreeInfo) {
          const mergeResult = await context.services.gitManager.merge({
            source: worktreeInfo.path,
            sourceBranch: worktreeInfo.branchName,
            target: context.global.projectPath,
            targetBranch: context.global.baseBranch,
            strategy: 'merge',
          });

          if (mergeResult.hasConflict) {
            conflicts.push({
              taskId: task.id,
              files: mergeResult.conflictFiles || [],
            });

            // Handle conflict based on strategy
            if (config.conflictResolution.strategy === 'ai' && this.conflictResolver) {
              await this.conflictResolver(mergeResult.conflictDetails || [], context);
            } else if (config.conflictResolution.strategy === 'manual') {
              paused = true;
              waitingForManualResolution = true;
            }
          }

          // Cleanup worktree if configured
          if (config.cleanupAfter) {
            await context.services.gitManager.removeWorktree(worktreeInfo.path);
          }
        }

        return {
          taskId: task.id,
          success: result.success,
          output: result.output,
          worktree: worktreeInfo,
        };
      } catch (error) {
        return {
          taskId: task.id,
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      } finally {
        semaphore.release();
      }
    };

    // Execute all tasks with abort handling
    try {
      const taskPromises = tasks.map((task) => executeTask(task));

      if (config.failureStrategy === 'abort-all') {
        // Use Promise.all to fail fast
        const taskResults = await Promise.all(
          taskPromises.map((p) =>
            p.catch((error: Error) => ({
              taskId: 'unknown',
              success: false,
              error,
            }))
          )
        );
        results.push(...taskResults);

        // Check if any failed
        const failedTask = results.find((r) => !r.success);
        if (failedTask && failedTask.error) {
          return {
            success: false,
            outputs: { results },
            error: failedTask.error,
            metadata: {
              duration: Date.now() - startTime,
              taskCount: tasks.length,
              successCount: results.filter((r) => r.success).length,
              failureCount: results.filter((r) => !r.success).length,
            },
          };
        }
      } else {
        // Execute all tasks, collecting results
        const taskResults = await Promise.allSettled(taskPromises);
        for (const result of taskResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            results.push({
              taskId: 'unknown',
              success: false,
              error: result.reason,
            });
          }
        }
      }
    } catch (error) {
      return {
        success: false,
        outputs: { results },
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          duration: Date.now() - startTime,
          taskCount: tasks.length,
          successCount,
          failureCount,
        },
      };
    }

    // Count successes and failures
    successCount = results.filter((r) => r.success).length;
    failureCount = results.filter((r) => !r.success).length;

    // Aggregate results based on strategy
    let aggregated: unknown;
    if (config.aggregationStrategy === 'merge') {
      aggregated = results.reduce<Record<string, unknown>>((acc, r) => {
        if (r.success && r.output && typeof r.output === 'object') {
          return { ...acc, ...(r.output as Record<string, unknown>) };
        }
        return acc;
      }, {});
    } else if (config.aggregationStrategy === 'concat') {
      aggregated = results
        .filter((r) => r.success)
        .map((r) => r.output);
    }

    const outputs: Record<string, unknown> = {
      results,
      conflictResolutionStrategy: config.conflictResolution.strategy,
    };

    if (aggregated !== undefined && config.aggregationStrategy !== 'none') {
      outputs.aggregated = aggregated;
    }

    if (conflicts.length > 0) {
      outputs.conflicts = conflicts;
    }

    if (paused) {
      outputs.paused = true;
      outputs.waitingForManualResolution = waitingForManualResolution;
    }

    return {
      success: true,
      outputs,
      metadata: {
        duration: Date.now() - startTime,
        taskCount: tasks.length,
        successCount,
        failureCount,
      },
    };
  }

  /**
   * Default subgraph execution (placeholder)
   */
  private async executeSubgraphDefault(
    task: Task,
    _context: ExecutionContext
  ): Promise<{ success: boolean; output: unknown }> {
    // This would be replaced by actual subgraph execution logic
    return {
      success: true,
      output: { taskId: task.id, result: `Executed ${task.description}` },
    };
  }

  /**
   * Serialize node to JSON
   */
  override toJSON(): WorkflowNodeJSON {
    const json = super.toJSON();

    // Include subgraph in config if set
    if (this.subgraph) {
      json.config.subgraph = this.subgraph;
    }

    return json;
  }

  /**
   * Deserialize from JSON (static factory method)
   */
  static createFromJSON(json: WorkflowNodeJSON): ParallelGroupNode {
    const node = new ParallelGroupNode(json.id, json.config);
    node.label = json.label;
    node.description = json.description;
    node.setPosition(json.position.x, json.position.y);

    // Restore subgraph if present
    if (json.config.subgraph) {
      node.setSubgraph(json.config.subgraph as SubgraphDefinition);
    }

    return node;
  }
}

// ============================================================================
// Helper Classes
// ============================================================================

/**
 * Simple semaphore for concurrency control
 */
class Semaphore {
  private count: number;
  private waiting: Array<() => void> = [];

  constructor(count: number) {
    this.count = count;
  }

  async acquire(): Promise<void> {
    if (this.count > 0) {
      this.count--;
      return;
    }

    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    if (this.waiting.length > 0) {
      const next = this.waiting.shift();
      next?.();
    } else {
      this.count++;
    }
  }
}

export default ParallelGroupNode;
