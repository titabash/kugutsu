/**
 * SimpleWorkflowExecutor
 *
 * A workflow executor for Electron that integrates with AI providers.
 * Executes workflow nodes in topological order, with real AI execution for AI nodes.
 */

import { EventEmitter } from 'events';

// AI provider modules are loaded dynamically to avoid undici File polyfill issues in Electron
// These will be loaded at runtime when AI node execution is needed
type AIProviderFactoryType = typeof import('../../src/providers/AIProviderFactory.js').AIProviderFactory;
type MessageHandlerType = typeof import('../../src/utils/MessageHandler.js').MessageHandler;

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
  cwd?: string;
  userInput?: string;
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
  private projectPath: string = process.cwd();

  /**
   * AI node types that require AI provider execution
   * Includes both legacy naming (custom-ai) and new naming (ai:custom)
   */
  private static readonly AI_NODE_TYPES = [
    'custom-ai',
    'ai:custom',
    'ai:engineer',
    'ai:reviewer',
    'ai:product-owner',
    'preset:engineer',
    'preset:reviewer',
    'preset:product-owner',
    'engineer',
    'reviewer',
    'product-owner',
  ];

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

    // Set project path from options
    if (options.cwd) {
      this.projectPath = options.cwd;
    }

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
    this.executedSubgraphNodes = [];  // Reset subgraph tracking
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

      // Include subgraph nodes in executed nodes list
      const allExecutedNodes = [...executedNodes, ...this.executedSubgraphNodes];

      this.emit('completed', {
        success: true,
        result: finalOutputs,
      });

      return {
        success: true,
        executionId,
        executedNodes: allExecutedNodes,
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
   * Check if a node type is an AI node
   * Matches either explicit types in AI_NODE_TYPES or types starting with 'ai:'
   */
  private isAINode(type: string): boolean {
    return SimpleWorkflowExecutor.AI_NODE_TYPES.includes(type) || type.startsWith('ai:');
  }

  /**
   * Execute a single node based on its type
   */
  private async executeNode(
    node: WorkflowNodeJSON,
    inputs: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const outputs: Record<string, unknown> = {};

    // Check if this is an AI node
    if (this.isAINode(node.type)) {
      return await this.executeAINode(node, inputs);
    }

    // Non-AI node execution
    switch (node.type) {
      case 'io:start':
      case 'start':
        // Start node passes through all inputs
        for (const output of node.outputs) {
          outputs[output.key] = inputs;
        }
        break;

      case 'io:end':
      case 'end':
        // End node collects all inputs as final output
        outputs['result'] = inputs;
        break;

      case 'control:transform':
      case 'transform':
        // Transform node applies a transformation
        for (const output of node.outputs) {
          outputs[output.key] = {
            ...inputs,
            transformed: true,
            nodeId: node.id,
          };
        }
        break;

      case 'control:decision':
      case 'decision':
        // Decision node evaluates a condition
        const condition = inputs['condition'] ?? true;
        if (condition) {
          outputs['true'] = inputs;
        } else {
          outputs['false'] = inputs;
        }
        break;

      case 'control:parallel-group':
      case 'parallel-group':
        // Parallel group - execute subgraph
        const parallelResult = await this.executeParallelGroup(node, inputs);
        for (const output of node.outputs) {
          outputs[output.key] = parallelResult;
        }
        break;

      case 'merge':
        // Merge node - pass through (TODO: implement git merge)
        for (const output of node.outputs) {
          outputs[output.key] = inputs;
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
   * Execute an AI node using the AI provider
   * Uses dynamic imports to avoid undici File polyfill issues at startup
   */
  private async executeAINode(
    node: WorkflowNodeJSON,
    inputs: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const nodeLabel = node.label || node.id;
    console.log(`[SimpleWorkflowExecutor] Executing AI node: ${nodeLabel} (${node.type})`);

    // Dynamic import of AI modules to avoid startup issues with undici
    const { AIProviderFactory } = await import('../../src/providers/AIProviderFactory.js');
    const { MessageHandler } = await import('../../src/utils/MessageHandler.js');

    // Get AI configuration from node config
    const aiConfig = (node.config?.ai as Record<string, unknown>) || {};
    const providerName = (aiConfig.provider as string) || 'claude';
    const systemPrompt = (aiConfig.systemPrompt as string) || '';
    const maxTurns = (aiConfig.maxTurns as number) || 30;

    // Create AI provider
    const provider = AIProviderFactory.create({
      provider: providerName as 'claude' | 'codex' | 'gemini',
    }, true);

    // Build prompt
    const prompt = this.buildPrompt(node, inputs, systemPrompt);

    // Create message handler
    const handler = new MessageHandler({
      maxTurns,
      nodeName: nodeLabel,
      silent: false,
    });

    let lastAssistantContent = '';

    try {
      // Execute AI provider
      for await (const message of provider.execute(prompt, {
        maxTurns,
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
        permissionMode: 'acceptEdits',
        cwd: this.projectPath,
      })) {
        await handler.handleMessage(message);

        // Emit message event for UI
        this.emit('node-message', {
          nodeId: node.id,
          nodeLabel,
          message,
        });

        // Store last assistant response
        if (message.type === 'assistant' && typeof message.content === 'string') {
          lastAssistantContent = message.content;
        }
      }

      // Check for errors
      if (handler.getHasError()) {
        const errorDetails = handler.getErrorDetails();
        throw new Error(`AI execution error: ${errorDetails?.message || 'Unknown error'}`);
      }

      console.log(`[SimpleWorkflowExecutor] AI node completed: ${nodeLabel}`);

      // Return outputs
      const outputs: Record<string, unknown> = {};
      for (const output of node.outputs) {
        outputs[output.key] = {
          ...inputs,
          aiResponse: lastAssistantContent,
          nodeId: node.id,
          nodeType: node.type,
          success: true,
        };
      }
      return outputs;

    } catch (error) {
      const err = error as Error;
      console.error(`[SimpleWorkflowExecutor] AI node error: ${nodeLabel}`, err.message);

      // Return error in outputs
      const outputs: Record<string, unknown> = {};
      for (const output of node.outputs) {
        outputs[output.key] = {
          ...inputs,
          error: err.message,
          nodeId: node.id,
          nodeType: node.type,
          success: false,
        };
      }
      throw err;
    }
  }

  /**
   * Build prompt for AI node
   */
  private buildPrompt(
    node: WorkflowNodeJSON,
    inputs: Record<string, unknown>,
    systemPrompt: string
  ): string {
    const userInput = (inputs.userInput as string) || (inputs.prompt as string) || (inputs.input as string) || '';

    // Get previous node output if available
    const previousOutput = (inputs.aiResponse as string) || '';

    let prompt = '';

    // Add system prompt if provided
    if (systemPrompt) {
      prompt += `${systemPrompt}\n\n`;
    }

    // Add task description
    prompt += `## タスク\n${node.label || node.id}\n\n`;

    // Add user input
    if (userInput) {
      prompt += `## ユーザーからの入力\n${userInput}\n\n`;
    }

    // Add previous output if this is not the first AI node
    if (previousOutput) {
      prompt += `## 前のノードからの出力\n${previousOutput}\n\n`;
    }

    // Add working directory info
    prompt += `## 作業ディレクトリ\n${this.projectPath}\n`;

    return prompt;
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

  /**
   * Track executed subgraph nodes (set by execute method)
   */
  private executedSubgraphNodes: string[] = [];

  /**
   * Execute a Parallel Group's subgraph in parallel
   * This executes the nodes inside the parallel group (Start -> ... -> End) multiple times concurrently
   */
  private async executeParallelGroup(
    node: WorkflowNodeJSON,
    inputs: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const subgraph = node.config.subgraph as {
      nodes: WorkflowNodeJSON[];
      connections: ConnectionJSON[];
      entryNodeId: string;
      exitNodeId: string;
    } | undefined;

    if (!subgraph || !subgraph.nodes || subgraph.nodes.length === 0) {
      console.log(`[SimpleWorkflowExecutor] Parallel group ${node.id} has no subgraph, passing through`);
      return inputs;
    }

    const parallelConfig = node.config.parallelGroup as {
      maxConcurrency?: number;
    } | undefined;
    const maxConcurrency = parallelConfig?.maxConcurrency || 4;

    // Get prompt and split into tasks
    const prompt = (inputs.prompt as string) || (inputs.userInput as string) || '';
    const tasks = this.splitPromptIntoTasks(prompt, maxConcurrency);

    console.log(`[SimpleWorkflowExecutor] Executing parallel group ${node.id} with ${tasks.length} parallel tasks (concurrency: ${maxConcurrency})`);
    console.log(`[SimpleWorkflowExecutor] Tasks:`, tasks.map((t, i) => `[${i + 1}] ${t.substring(0, 50)}...`));

    // Execute subgraph for each task in parallel
    const parallelPromises = tasks.map((task, index) =>
      this.executeSubgraphOnce(subgraph, {
        ...inputs,
        prompt: task,
        userInput: task,
        taskIndex: index,
        taskTotal: tasks.length,
      }, node.id, index)
    );

    // Wait for all parallel executions to complete
    const results = await Promise.all(parallelPromises);

    console.log(`[SimpleWorkflowExecutor] All ${results.length} parallel tasks completed`);

    // Aggregate results
    return {
      ...inputs,
      parallelResults: results,
      parallelGroupId: node.id,
      taskCount: tasks.length,
    };
  }

  /**
   * Split a prompt into multiple tasks based on natural language patterns
   */
  private splitPromptIntoTasks(prompt: string, maxTasks: number): string[] {
    if (!prompt || prompt.trim().length === 0) {
      return ['Default task'];
    }

    // Try to split by common task separators
    const separators = [
      /[。．]\s*(?=[^。．])/g,  // Japanese period
      /\.\s+(?=[A-Z])/g,        // English sentence
      /(?:タスク|Task)\s*\d+[：:]/gi,  // Task 1:, タスク1：
      /(?:と|and|,)\s*(?=.*(?:を|する|implement|create|add|fix))/gi,  // "A and B" pattern
    ];

    let tasks: string[] = [prompt];

    // Try each separator pattern
    for (const separator of separators) {
      const splits = prompt.split(separator).filter(s => s.trim().length > 10);
      if (splits.length > 1 && splits.length <= maxTasks) {
        tasks = splits.map(s => s.trim());
        break;
      }
    }

    // If still single task but contains multiple verb phrases, try to split
    if (tasks.length === 1 && prompt.length > 50) {
      // Look for patterns like "AをするタスクとBをするタスク" or "implement A and implement B"
      const verbPattern = /(.+?(?:を|する|タスク|implement|create|add|fix)[^、,]*)[、,と]\s*(.+)/i;
      const match = prompt.match(verbPattern);
      if (match && match[1] && match[2]) {
        tasks = [match[1].trim(), match[2].trim()];
      }
    }

    // Limit to maxTasks
    if (tasks.length > maxTasks) {
      tasks = tasks.slice(0, maxTasks);
    }

    // Ensure at least one task
    if (tasks.length === 0) {
      tasks = [prompt];
    }

    return tasks;
  }

  /**
   * Execute subgraph once with given inputs
   */
  private async executeSubgraphOnce(
    subgraph: {
      nodes: WorkflowNodeJSON[];
      connections: ConnectionJSON[];
      entryNodeId: string;
      exitNodeId: string;
    },
    inputs: Record<string, unknown>,
    parentNodeId: string,
    taskIndex: number
  ): Promise<Record<string, unknown>> {
    const executionOrder = this.buildSubgraphExecutionOrder(subgraph);
    const nodeOutputs: Record<string, Record<string, unknown>> = {};

    console.log(`[SimpleWorkflowExecutor] Starting parallel task ${taskIndex + 1}`);

    // Execute subgraph nodes in order
    for (const subNodeId of executionOrder) {
      if (this.cancelled) {
        throw new Error('Execution cancelled');
      }

      const subNode = subgraph.nodes.find(n => n.id === subNodeId);
      if (!subNode) continue;

      // Create unique node ID for this parallel execution
      const uniqueNodeId = `${subNodeId}#${taskIndex}`;

      // Gather inputs for this subgraph node
      const subInputs = this.gatherSubgraphInputs(
        subNodeId,
        subgraph.connections,
        nodeOutputs,
        inputs
      );

      // Execute subgraph node
      const subOutputs = await this.executeNode(subNode, subInputs);
      nodeOutputs[subNodeId] = subOutputs;

      // Track executed subgraph nodes
      this.executedSubgraphNodes.push(uniqueNodeId);

      // Emit progress for subgraph node
      this.emit('progress', {
        nodeId: uniqueNodeId,
        originalNodeId: subNodeId,
        parentNodeId,
        taskIndex,
        status: 'completed',
        progress: this.calculateProgress(),
        outputs: subOutputs,
      });

      console.log(`[SimpleWorkflowExecutor] Task ${taskIndex + 1}: Executed ${subNodeId} (${subNode.type})`);
    }

    console.log(`[SimpleWorkflowExecutor] Completed parallel task ${taskIndex + 1}`);

    // Return outputs from exit node
    return {
      taskIndex,
      result: nodeOutputs[subgraph.exitNodeId] || {},
    };
  }

  /**
   * Build execution order for subgraph using topological sort
   */
  private buildSubgraphExecutionOrder(subgraph: {
    nodes: WorkflowNodeJSON[];
    connections: ConnectionJSON[];
    entryNodeId: string;
    exitNodeId: string;
  }): string[] {
    const nodeIds = new Set(subgraph.nodes.map(n => n.id));
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    // Initialize
    for (const nodeId of nodeIds) {
      inDegree.set(nodeId, 0);
      adjacency.set(nodeId, []);
    }

    // Build adjacency and in-degree from connections
    for (const conn of subgraph.connections) {
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
   * Gather inputs for a subgraph node
   */
  private gatherSubgraphInputs(
    nodeId: string,
    connections: ConnectionJSON[],
    nodeOutputs: Record<string, Record<string, unknown>>,
    parentInputs: Record<string, unknown>
  ): Record<string, unknown> {
    const inputs: Record<string, unknown> = { ...parentInputs };

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
   * Get executed subgraph nodes (for test verification)
   */
  getExecutedSubgraphNodes(): string[] {
    return [...this.executedSubgraphNodes];
  }
}

export default SimpleWorkflowExecutor;
