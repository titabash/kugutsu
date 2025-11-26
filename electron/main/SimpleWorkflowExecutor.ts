/**
 * SimpleWorkflowExecutor
 *
 * A lightweight workflow executor for Electron that doesn't depend on LangChain.
 * This is used for MVP to demonstrate the visual workflow editor functionality.
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types (copied from workflow types to avoid LangChain dependencies)
// ============================================================================

export interface WorkflowMetadata {
  name: string;
  description: string;
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowNodeJSON {
  id: string;
  type: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
  inputs: Array<{ key: string; label: string }>;
  outputs: Array<{ key: string; label: string }>;
  label?: string;
}

export interface ConnectionJSON {
  id: string;
  source: string;
  sourceOutput: string;
  target: string;
  targetInput: string;
}

export interface ReteWorkflowJSON {
  version: string;
  metadata: WorkflowMetadata;
  nodes: WorkflowNodeJSON[];
  connections: ConnectionJSON[];
  entryNodeId: string;
  exitNodeId: string;
}

export interface ExecutionResult {
  success: boolean;
  executionId: string;
  executedNodes: string[];
  outputs: Record<string, unknown>;
  duration: number;
  error?: Error;
}

export interface ExecutionProgress {
  totalNodes: number;
  completedNodes: number;
  percentage: number;
}

export type ExecutionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface WorkflowExecutionOptions {
  prompt: string;
  [key: string]: unknown;
}

// ============================================================================
// SimpleWorkflowExecutor
// ============================================================================

export class SimpleWorkflowExecutor extends EventEmitter {
  private status: ExecutionStatus = 'idle';
  private progress: ExecutionProgress = {
    totalNodes: 0,
    completedNodes: 0,
    percentage: 0,
  };
  private cancelled = false;

  /**
   * Execute a workflow by traversing nodes in connection order
   */
  async execute(
    workflow: ReteWorkflowJSON,
    options: WorkflowExecutionOptions
  ): Promise<ExecutionResult> {
    const executionId = this.generateExecutionId();
    const startTime = Date.now();
    const executedNodes: string[] = [];
    const nodeOutputs: Record<string, Record<string, unknown>> = {};

    // Validate workflow
    if (!workflow.nodes || workflow.nodes.length === 0) {
      const error = new Error('Workflow has no nodes');
      this.emit('completed', { success: false, error: error.message });
      return {
        success: false,
        executionId,
        executedNodes: [],
        outputs: {},
        duration: 0,
        error,
      };
    }

    this.status = 'running';
    this.cancelled = false;
    this.progress = {
      totalNodes: workflow.nodes.length,
      completedNodes: 0,
      percentage: 0,
    };

    try {
      // Build execution order from connections
      const executionOrder = this.buildExecutionOrder(workflow);

      // Execute nodes in order
      for (const nodeId of executionOrder) {
        if (this.cancelled) {
          throw new Error('Execution cancelled');
        }

        const node = workflow.nodes.find(n => n.id === nodeId);
        if (!node) continue;

        // Emit node started
        this.emit('progress', {
          nodeId,
          status: 'executing',
          progress: this.calculateProgress(),
        });

        // Get inputs from connected nodes
        const inputs = this.gatherInputs(nodeId, workflow.connections, nodeOutputs, options);

        // Execute node (simulate execution based on type)
        const outputs = await this.executeNode(node, inputs);
        nodeOutputs[nodeId] = outputs;
        executedNodes.push(nodeId);

        // Update progress
        this.progress.completedNodes++;

        // Emit node completed
        this.emit('progress', {
          nodeId,
          status: 'completed',
          progress: this.calculateProgress(),
          outputs,
        });
      }

      const duration = Date.now() - startTime;
      this.status = 'completed';

      // Get final outputs from exit node
      const finalOutputs = nodeOutputs[workflow.exitNodeId] || {};

      this.emit('completed', {
        success: true,
        result: finalOutputs,
      });

      return {
        success: true,
        executionId,
        executedNodes,
        outputs: finalOutputs,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.status = this.cancelled ? 'cancelled' : 'failed';
      const err = error as Error;

      this.emit('completed', {
        success: false,
        error: err.message,
      });

      return {
        success: false,
        executionId,
        executedNodes,
        outputs: {},
        duration,
        error: err,
      };
    }
  }

  /**
   * Cancel execution
   */
  cancel(): void {
    this.cancelled = true;
  }

  /**
   * Get current status
   */
  getStatus(): ExecutionStatus {
    return this.status;
  }

  /**
   * Get current progress
   */
  getProgress(): ExecutionProgress {
    return { ...this.progress };
  }

  /**
   * Build execution order using topological sort
   */
  private buildExecutionOrder(workflow: ReteWorkflowJSON): string[] {
    const nodeIds = new Set(workflow.nodes.map(n => n.id));
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    // Initialize
    for (const nodeId of nodeIds) {
      inDegree.set(nodeId, 0);
      adjacency.set(nodeId, []);
    }

    // Build adjacency and in-degree from connections
    for (const conn of workflow.connections) {
      if (nodeIds.has(conn.source) && nodeIds.has(conn.target)) {
        adjacency.get(conn.source)!.push(conn.target);
        inDegree.set(conn.target, (inDegree.get(conn.target) || 0) + 1);
      }
    }

    // Topological sort (Kahn's algorithm)
    const queue: string[] = [];
    const result: string[] = [];

    // Find all nodes with no incoming edges
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      result.push(nodeId);

      for (const neighbor of adjacency.get(nodeId) || []) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    return result;
  }

  /**
   * Gather inputs for a node from connected source nodes
   */
  private gatherInputs(
    nodeId: string,
    connections: ConnectionJSON[],
    nodeOutputs: Record<string, Record<string, unknown>>,
    initialOptions: WorkflowExecutionOptions
  ): Record<string, unknown> {
    const inputs: Record<string, unknown> = { ...initialOptions };

    // Find all connections targeting this node
    const incomingConnections = connections.filter(c => c.target === nodeId);

    for (const conn of incomingConnections) {
      const sourceOutputs = nodeOutputs[conn.source];
      if (sourceOutputs) {
        const value = sourceOutputs[conn.sourceOutput];
        if (value !== undefined) {
          inputs[conn.targetInput] = value;
        }
      }
    }

    return inputs;
  }

  /**
   * Execute a single node based on its type
   */
  private async executeNode(
    node: WorkflowNodeJSON,
    inputs: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // Simulate execution time
    await this.delay(100);

    const outputs: Record<string, unknown> = {};

    switch (node.type) {
      case 'io:start':
        // Start node passes through all inputs
        for (const output of node.outputs) {
          outputs[output.key] = inputs;
        }
        break;

      case 'io:end':
        // End node collects all inputs as final output
        outputs['result'] = inputs;
        break;

      case 'control:transform':
        // Transform node applies a transformation (mock for MVP)
        for (const output of node.outputs) {
          outputs[output.key] = {
            ...inputs,
            transformed: true,
            nodeId: node.id,
          };
        }
        break;

      case 'control:decision':
        // Decision node evaluates a condition (mock for MVP)
        const condition = inputs['condition'] ?? true;
        if (condition) {
          outputs['true'] = inputs;
        } else {
          outputs['false'] = inputs;
        }
        break;

      case 'preset:engineer':
      case 'custom-ai':
        // AI nodes simulate AI response
        for (const output of node.outputs) {
          outputs[output.key] = {
            ...inputs,
            aiResponse: `Simulated AI response from ${node.label || node.id}`,
            nodeType: node.type,
          };
        }
        break;

      default:
        // Default: pass through inputs
        for (const output of node.outputs) {
          outputs[output.key] = inputs;
        }
    }

    console.log(`[SimpleWorkflowExecutor] Executed node ${node.id} (${node.type})`);
    return outputs;
  }

  /**
   * Calculate progress percentage
   */
  private calculateProgress(): number {
    if (this.progress.totalNodes === 0) return 0;
    return Math.round((this.progress.completedNodes / this.progress.totalNodes) * 100);
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default SimpleWorkflowExecutor;
