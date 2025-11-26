/**
 * ReteWorkflowExecutor
 *
 * Executes transformed Rete.js workflows with event-driven architecture.
 * Handles node execution, conditional branching, and state management.
 */

import type { TransformedWorkflow } from './WorkflowTransformer.js';
import type { BaseWorkflowNode } from './nodes/BaseWorkflowNode.js';
import type {
  ExecutionContext,
  Services,
  Utils,
  GlobalContext,
  NodeResult,
  RetryPolicy,
  ConnectionJSON,
} from './types.js';
import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

/**
 * Executor configuration
 */
export interface ExecutorConfig {
  /** Maximum concurrent node executions */
  maxConcurrency?: number;
  /** Execution timeout in milliseconds */
  timeout?: number;
  /** Retry policy for failed nodes */
  retryPolicy?: RetryPolicy;
}

/**
 * Execution options passed to execute()
 */
export interface ExecutionOptions {
  /** Services for node execution */
  services: Services;
  /** Utilities for node execution */
  utils: Utils;
  /** Global context for the workflow */
  globalContext: GlobalContext;
  /** Initial inputs for the workflow */
  initialInputs: Record<string, unknown>;
}

/**
 * Execution event
 */
export interface ExecutionEvent {
  /** Event type */
  type: 'node-started' | 'node-completed' | 'node-failed' | 'workflow-completed' | 'workflow-failed';
  /** Node ID (if applicable) */
  nodeId?: string;
  /** Timestamp */
  timestamp: Date;
  /** Event data */
  data?: unknown;
  /** Error (if applicable) */
  error?: Error;
}

/**
 * Execution result
 */
export interface ExecutionResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Execution ID */
  executionId: string;
  /** List of executed node IDs */
  executedNodes: string[];
  /** Final outputs */
  outputs: Record<string, unknown>;
  /** Execution duration in milliseconds */
  duration: number;
  /** Error if failed */
  error?: Error;
  /** Whether execution was cancelled */
  cancelled?: boolean;
}

/**
 * Execution progress
 */
export interface ExecutionProgress {
  /** Total number of nodes */
  totalNodes: number;
  /** Number of completed nodes */
  completedNodes: number;
  /** Progress percentage */
  percentage: number;
}

/**
 * Execution status
 */
export type ExecutionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

// ============================================================================
// ReteWorkflowExecutor
// ============================================================================

/**
 * Workflow executor with event-driven architecture
 */
export class ReteWorkflowExecutor extends EventEmitter {
  private config: Required<ExecutorConfig>;
  private status: ExecutionStatus = 'idle';
  private cancelled = false;
  private executedNodes: string[] = [];
  private nodeResults: Record<string, NodeResult> = {};
  private nodeOutputs: Record<string, Record<string, unknown>> = {};
  private totalNodes = 0;
  private executionStartTime = 0;

  constructor(config: ExecutorConfig = {}) {
    super();
    this.config = {
      maxConcurrency: config.maxConcurrency ?? 4,
      timeout: config.timeout ?? 300000, // 5 minutes default
      retryPolicy: config.retryPolicy ?? {
        maxRetries: 0,
        retryDelay: 1000,
      },
    };
  }

  /**
   * Execute a transformed workflow
   */
  async execute(
    workflow: TransformedWorkflow,
    options: ExecutionOptions
  ): Promise<ExecutionResult> {
    const executionId = options.globalContext.executionId || this.generateExecutionId();
    this.executionStartTime = Date.now();
    this.status = 'running';
    this.cancelled = false;
    this.executedNodes = [];
    this.nodeResults = {};
    this.nodeOutputs = {};
    this.totalNodes = workflow.nodeIds.length;

    try {
      // Start from entry node
      const entryNode = workflow.nodes[workflow.entryNodeId];
      if (!entryNode) {
        throw new Error(`Entry node not found: ${workflow.entryNodeId}`);
      }

      // Execute workflow starting from entry node
      await this.executeNode(
        workflow.entryNodeId,
        workflow,
        options,
        options.initialInputs
      );

      const duration = Date.now() - this.executionStartTime;
      this.status = 'completed';

      // Emit workflow completed event
      this.emitEvent({
        type: 'workflow-completed',
        timestamp: new Date(),
        data: { executionId, duration },
      });

      // Get final outputs from exit node
      const exitNodeOutputs = this.nodeOutputs[workflow.exitNodeId] || {};

      return {
        success: true,
        executionId,
        executedNodes: [...this.executedNodes],
        outputs: exitNodeOutputs,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - this.executionStartTime;
      this.status = this.cancelled ? 'cancelled' : 'failed';

      if (this.cancelled) {
        return {
          success: false,
          executionId,
          executedNodes: [...this.executedNodes],
          outputs: {},
          duration,
          cancelled: true,
          error: new Error('Execution cancelled'),
        };
      }

      // Check for timeout
      const err = error as Error;
      if (err.message?.includes('timeout')) {
        return {
          success: false,
          executionId,
          executedNodes: [...this.executedNodes],
          outputs: {},
          duration,
          error: new Error(`Execution timeout after ${this.config.timeout}ms`),
        };
      }

      return {
        success: false,
        executionId,
        executedNodes: [...this.executedNodes],
        outputs: {},
        duration,
        error: err,
      };
    }
  }

  /**
   * Execute a single node and its successors
   */
  private async executeNode(
    nodeId: string,
    workflow: TransformedWorkflow,
    options: ExecutionOptions,
    inputs: Record<string, unknown>
  ): Promise<void> {
    // Check for cancellation
    if (this.cancelled) {
      throw new Error('Execution cancelled');
    }

    // Check for timeout
    if (Date.now() - this.executionStartTime > this.config.timeout) {
      throw new Error('Execution timeout');
    }

    const node = workflow.nodes[nodeId];
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    // Emit node started event
    this.emitEvent({
      type: 'node-started',
      nodeId,
      timestamp: new Date(),
    });

    // Create execution context
    const context: ExecutionContext = {
      inputs,
      global: options.globalContext,
      services: options.services,
      utils: options.utils,
    };

    // Execute node with retry
    let result: NodeResult | null = null;
    let lastError: Error | null = null;
    const maxAttempts = this.config.retryPolicy.maxRetries + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        result = await this.executeNodeWithTimeout(node, context);
        if (result.success) {
          break;
        }
        lastError = result.error || new Error('Node execution failed');
      } catch (error) {
        lastError = error as Error;
      }

      // Wait before retry
      if (attempt < maxAttempts - 1) {
        const delay = this.config.retryPolicy.exponentialBackoff
          ? this.config.retryPolicy.retryDelay * Math.pow(2, attempt)
          : this.config.retryPolicy.retryDelay;
        await this.delay(delay);
      }
    }

    if (!result || !result.success) {
      // Emit node failed event
      this.emitEvent({
        type: 'node-failed',
        nodeId,
        timestamp: new Date(),
        error: lastError || new Error('Node execution failed'),
      });
      throw lastError || new Error('Node execution failed');
    }

    // Store result and outputs
    this.nodeResults[nodeId] = result;
    this.nodeOutputs[nodeId] = result.outputs;
    this.executedNodes.push(nodeId);

    // Emit node completed event
    this.emitEvent({
      type: 'node-completed',
      nodeId,
      timestamp: new Date(),
      data: result.outputs,
    });

    // Find and execute next nodes
    await this.executeNextNodes(nodeId, workflow, options, result.outputs);
  }

  /**
   * Execute node with timeout
   */
  private async executeNodeWithTimeout(
    node: BaseWorkflowNode,
    context: ExecutionContext
  ): Promise<NodeResult> {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Node execution timeout'));
      }, this.config.timeout);

      try {
        const result = await node.execute(context);
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Execute next nodes based on edges and conditional edges
   */
  private async executeNextNodes(
    nodeId: string,
    workflow: TransformedWorkflow,
    options: ExecutionOptions,
    outputs: Record<string, unknown>
  ): Promise<void> {
    // Check for conditional edges (from decision nodes)
    const conditionalEdge = workflow.conditionalEdges[nodeId];
    if (conditionalEdge) {
      // Determine which branch to take based on the decision node output
      // Decision node outputs have 'true' or 'false' keys to indicate the branch
      const hasTrueOutput = 'true' in outputs;
      const hasFalseOutput = 'false' in outputs;

      let nextNodeId: string | undefined;
      let branchOutputs: Record<string, unknown>;

      if (hasTrueOutput) {
        nextNodeId = conditionalEdge.true;
        // The output value is the data that was passed to true branch
        const trueOutput = outputs.true;
        branchOutputs = typeof trueOutput === 'object' && trueOutput !== null
          ? { input: trueOutput }
          : { input: trueOutput };
      } else if (hasFalseOutput) {
        nextNodeId = conditionalEdge.false;
        // The output value is the data that was passed to false branch
        const falseOutput = outputs.false;
        branchOutputs = typeof falseOutput === 'object' && falseOutput !== null
          ? { input: falseOutput }
          : { input: falseOutput };
      } else {
        // Fallback: check for a condition property (for backward compatibility)
        const conditionResult = outputs.condition as boolean;
        nextNodeId = conditionResult ? conditionalEdge.true : conditionalEdge.false;
        branchOutputs = outputs;
      }

      if (nextNodeId) {
        // Map outputs to target node inputs using connections
        const mappedInputs = this.mapOutputsToInputs(
          nodeId,
          nextNodeId,
          branchOutputs,
          workflow.connections
        );
        await this.executeNode(nextNodeId, workflow, options, mappedInputs);
      }
      return;
    }

    // Check for simple edges
    const edges = workflow.edges[nodeId];
    if (edges && edges.length > 0) {
      // For now, execute edges sequentially
      // TODO: Support parallel execution for multiple edges
      for (const nextNodeId of edges) {
        // Map outputs to target node inputs using connections
        const mappedInputs = this.mapOutputsToInputs(
          nodeId,
          nextNodeId,
          outputs,
          workflow.connections
        );
        await this.executeNode(nextNodeId, workflow, options, mappedInputs);
      }
    }
  }

  /**
   * Cancel ongoing execution
   */
  cancel(): void {
    this.cancelled = true;
  }

  /**
   * Get current execution status
   */
  getStatus(): ExecutionStatus {
    return this.status;
  }

  /**
   * Get execution progress
   */
  getProgress(): ExecutionProgress {
    const completedNodes = this.executedNodes.length;
    const percentage = this.totalNodes > 0
      ? Math.round((completedNodes / this.totalNodes) * 100)
      : 0;

    return {
      totalNodes: this.totalNodes,
      completedNodes,
      percentage,
    };
  }

  /**
   * Get results for all executed nodes
   */
  getNodeResults(): Record<string, NodeResult> {
    return { ...this.nodeResults };
  }

  /**
   * Generate a unique execution ID
   */
  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Emit an execution event
   */
  private emitEvent(event: ExecutionEvent): void {
    this.emit(event.type, event);
  }

  /**
   * Delay for a specified duration
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Map outputs from source node to inputs for target node based on connections
   */
  private mapOutputsToInputs(
    sourceNodeId: string,
    targetNodeId: string,
    outputs: Record<string, unknown>,
    connections: ConnectionJSON[]
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    // Find all connections from source to target
    const relevantConnections = connections.filter(
      (conn) => conn.source === sourceNodeId && conn.target === targetNodeId
    );

    for (const conn of relevantConnections) {
      const outputValue = outputs[conn.sourceOutput];
      if (outputValue !== undefined) {
        result[conn.targetInput] = outputValue;
      }
    }

    // If no explicit connections found, pass all outputs as inputs
    // This handles the case where outputs are directly passed through
    if (Object.keys(result).length === 0) {
      return outputs;
    }

    return result;
  }
}

export default ReteWorkflowExecutor;
