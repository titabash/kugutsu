/**
 * SubgraphExecutor
 *
 * Executes subgraphs within specified worktrees.
 * Transforms SubgraphDefinition to executable workflow and runs it
 * with the appropriate context (including worktree path if provided).
 */

import type {
  ExecutionContext,
  WorkflowNodeJSON,
  ConnectionJSON,
  ReteWorkflowJSON,
} from './types.js';
import { ReteWorkflowExecutor } from './ReteWorkflowExecutor.js';
import { WorkflowTransformer } from './WorkflowTransformer.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Subgraph definition - a mini-workflow to be executed
 */
export interface SubgraphDefinition {
  /** Nodes in the subgraph */
  nodes: WorkflowNodeJSON[];
  /** Connections between nodes in the subgraph */
  connections: ConnectionJSON[];
  /** Entry node ID (first node to receive input) */
  entryNodeId: string;
  /** Exit node ID (node that produces final output) */
  exitNodeId: string;
}

/**
 * Result of subgraph execution
 */
export interface SubgraphExecutionResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Output from the subgraph */
  output: unknown;
  /** Error if failed */
  error?: Error;
}

// ============================================================================
// SubgraphExecutor
// ============================================================================

/**
 * Executes subgraphs within worktrees
 */
export class SubgraphExecutor {
  /**
   * Execute a subgraph with the given context
   *
   * @param subgraph - The subgraph definition to execute
   * @param worktreePath - Optional path to worktree (if null, uses context.global.projectPath)
   * @param context - Execution context
   * @param initialInputs - Initial inputs for the subgraph entry node
   * @returns Execution result with success status and output
   */
  async execute(
    subgraph: SubgraphDefinition,
    worktreePath: string | null,
    context: ExecutionContext,
    initialInputs: Record<string, unknown>
  ): Promise<SubgraphExecutionResult> {
    try {
      // Validate subgraph
      if (!subgraph) {
        return {
          success: false,
          output: null,
          error: new Error('Subgraph is undefined'),
        };
      }

      if (!subgraph.nodes || subgraph.nodes.length === 0) {
        return {
          success: false,
          output: null,
          error: new Error('Subgraph has no nodes'),
        };
      }

      // Transform SubgraphDefinition to ReteWorkflowJSON
      const workflowJson: ReteWorkflowJSON = {
        version: '1.0.0',
        metadata: {
          name: 'subgraph',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        nodes: subgraph.nodes,
        connections: subgraph.connections,
        entryNodeId: subgraph.entryNodeId,
        exitNodeId: subgraph.exitNodeId,
      };

      // Transform to executable workflow
      const transformedWorkflow = WorkflowTransformer.transform(workflowJson);

      // Create modified global context with worktree path if provided
      const globalContext = worktreePath
        ? { ...context.global, projectPath: worktreePath }
        : context.global;

      // Create executor
      const executor = new ReteWorkflowExecutor({
        maxConcurrency: 1, // Sequential execution within subgraph
        timeout: 300000, // 5 minutes default
      });

      // Execute the workflow
      const result = await executor.execute(transformedWorkflow, {
        services: context.services,
        utils: context.utils,
        globalContext,
        initialInputs,
      });

      return {
        success: result.success,
        output: result.outputs,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}

export default SubgraphExecutor;
