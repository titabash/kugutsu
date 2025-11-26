/**
 * ProductOwnerNode
 *
 * Preset AI node for product owner tasks.
 * Specializes in requirements analysis, task decomposition, and specification writing.
 */

import {
  BaseWorkflowNode,
  type NodeConfig,
  type ExecutionContext,
  type NodeResult,
  type ValidationResult,
} from '../BaseWorkflowNode.js';
import type { AIConfig, RetryPolicy } from '../../types.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default system prompt for product owner tasks
 */
const DEFAULT_SYSTEM_PROMPT = `You are an expert Product Owner with deep expertise in agile methodologies, requirements engineering, and software development lifecycle.

Your responsibilities:
- Analyze and understand user requirements and feature requests
- Break down complex requirements into actionable development tasks
- Write clear, detailed specifications with acceptance criteria
- Prioritize tasks based on business value and technical dependencies
- Identify potential risks and technical constraints

Guidelines:
- Ask clarifying questions if requirements are ambiguous
- Consider technical feasibility when decomposing tasks
- Include acceptance criteria for each task
- Estimate relative effort (small/medium/large)
- Identify dependencies between tasks
- Focus on delivering value incrementally`;

/**
 * Default allowed tools for product owner tasks (read-only)
 */
const DEFAULT_ALLOWED_TOOLS = [
  'Read',
  'Glob',
  'Grep',
];

/**
 * Default maximum turns for product owner tasks
 */
const DEFAULT_MAX_TURNS = 15;

// ============================================================================
// Types
// ============================================================================

/**
 * Output mode for ProductOwnerNode
 */
export type ProductOwnerOutputMode = 'tasks' | 'specifications' | 'both';

/**
 * ProductOwnerNode configuration
 */
export interface ProductOwnerNodeConfig extends NodeConfig {
  /** Custom label for the node */
  label?: string;
  /** AI configuration */
  ai?: AIConfig;
  /** Retry policy */
  retryPolicy?: RetryPolicy;
  /** Output mode: tasks, specifications, or both */
  outputMode?: ProductOwnerOutputMode;
  /** Write specifications to file */
  writeSpecifications?: boolean;
  /** Specifications output path */
  specificationsPath?: string;
}

/**
 * Task structure returned by ProductOwnerNode
 */
export interface DecomposedTask {
  id: string;
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  estimatedEffort?: 'small' | 'medium' | 'large';
  acceptanceCriteria?: string[];
  dependencies?: string[];
}

/**
 * Specifications structure returned by ProductOwnerNode
 */
export interface Specifications {
  overview: string;
  requirements?: string[];
  acceptanceCriteria?: string[];
  technicalNotes?: string;
  risks?: string[];
}

// ============================================================================
// ProductOwnerNode
// ============================================================================

/**
 * ProductOwnerNode - Preset node for product owner tasks
 *
 * Features:
 * - Predefined system prompt for PO tasks
 * - Read-only tools for codebase analysis
 * - Task decomposition and prioritization
 * - Specification writing
 * - Specialized event emission
 */
export class ProductOwnerNode extends BaseWorkflowNode {
  declare config: ProductOwnerNodeConfig;

  constructor(id: string, config: ProductOwnerNodeConfig = {}) {
    // Merge AI config with defaults
    const aiConfig: AIConfig = {
      provider: config.ai?.provider ?? 'auto',
      model: config.ai?.model,
      systemPrompt: config.ai?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      maxTurns: config.ai?.maxTurns ?? DEFAULT_MAX_TURNS,
      allowedTools: config.ai?.allowedTools ?? DEFAULT_ALLOWED_TOOLS,
      temperature: config.ai?.temperature,
      topP: config.ai?.topP,
    };

    super({
      id,
      type: 'preset:product-owner',
      label: config.label ?? 'Product Owner',
      description: 'Analyze requirements and decompose into actionable tasks',
      inputs: [
        {
          id: 'request',
          name: 'Request',
          type: 'data',
          dataType: 'string',
          required: true,
        },
        {
          id: 'constraints',
          name: 'Constraints',
          type: 'data',
          dataType: 'any',
          required: false,
        },
      ],
      outputs: [
        {
          id: 'tasks',
          name: 'Tasks',
          type: 'data',
          dataType: 'array',
          required: true,
        },
        {
          id: 'specifications',
          name: 'Specifications',
          type: 'data',
          dataType: 'object',
          required: false,
        },
        {
          id: 'prompt',
          name: 'Prompt',
          type: 'data',
          dataType: 'string',
          required: false,
        },
        {
          id: 'fileChanges',
          name: 'File Changes',
          type: 'data',
          dataType: 'array',
          required: false,
        },
      ],
      config: {
        ai: aiConfig,
        retryPolicy: config.retryPolicy,
        outputMode: config.outputMode ?? 'both',
        writeSpecifications: config.writeSpecifications ?? false,
        specificationsPath: config.specificationsPath,
        ...config,
      },
    });
  }

  /**
   * Validate node configuration
   */
  validate(): ValidationResult {
    const baseResult = super.validate();
    const errors = [...baseResult.errors];

    const ai = this.config.ai;

    // Validate maxTurns
    if (ai?.maxTurns !== undefined && ai.maxTurns <= 0) {
      errors.push('maxTurns must be a positive number');
    }

    // Validate temperature
    if (ai?.temperature !== undefined && (ai.temperature < 0 || ai.temperature > 2)) {
      errors.push('temperature must be between 0 and 2');
    }

    // Validate outputMode
    const validModes: ProductOwnerOutputMode[] = ['tasks', 'specifications', 'both'];
    if (this.config.outputMode && !validModes.includes(this.config.outputMode)) {
      errors.push('outputMode must be one of: tasks, specifications, both');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Build the prompt for product owner task
   */
  private buildPrompt(
    request: string,
    constraints: unknown
  ): string {
    let prompt = `## Feature Request / Requirements\n\n${request}`;

    // Add constraints if provided
    if (constraints !== undefined && constraints !== null) {
      const constraintsStr = this.formatConstraints(constraints);
      prompt += `\n\n## Constraints\n\n${constraintsStr}`;
    }

    // Add output instructions based on mode
    const outputMode = this.config.outputMode ?? 'both';
    prompt += `\n\n## Expected Output\n\n`;

    if (outputMode === 'tasks' || outputMode === 'both') {
      prompt += `### Tasks
Please decompose the requirements into actionable development tasks.
For each task, provide:
- id: A unique identifier (e.g., "task-1")
- title: A clear, concise title
- description: Detailed description of the task
- priority: "high", "medium", or "low"
- estimatedEffort: "small", "medium", or "large"
- acceptanceCriteria: List of acceptance criteria
- dependencies: List of task IDs this task depends on

`;
    }

    if (outputMode === 'specifications' || outputMode === 'both') {
      prompt += `### Specifications
Please write detailed specifications including:
- overview: A high-level summary of the feature
- requirements: List of functional requirements
- acceptanceCriteria: List of overall acceptance criteria
- technicalNotes: Any technical considerations
- risks: Potential risks or concerns

`;
    }

    prompt += `### Next Node Prompt
Generate a prompt that can be used to instruct the next node (e.g., Engineer) to implement the tasks.
Store this in the "nextNodePrompt" field.

Please respond with a JSON object containing:
${outputMode === 'tasks' || outputMode === 'both' ? '- tasks: Array of task objects\n' : ''}${outputMode === 'specifications' || outputMode === 'both' ? '- specifications: Specifications object\n' : ''}- nextNodePrompt: String prompt for the next node`;

    return prompt;
  }

  /**
   * Format constraints for inclusion in prompt
   */
  private formatConstraints(constraints: unknown): string {
    if (typeof constraints === 'string') {
      return constraints;
    }

    if (Array.isArray(constraints)) {
      return constraints.map((item, index) => `${index + 1}. ${item}`).join('\n');
    }

    if (typeof constraints === 'object') {
      return JSON.stringify(constraints, null, 2);
    }

    return String(constraints);
  }

  /**
   * Execute the product owner task
   */
  async execute(context: ExecutionContext): Promise<NodeResult> {
    const startTime = Date.now();
    const request = context.inputs.request;
    const constraints = context.inputs.constraints;

    // Emit start event
    context.utils.emit('product-owner-started', {
      nodeId: this.id,
      nodeType: this.type,
    });

    // Validate request input
    if (request === undefined || request === null || request === '') {
      const error = new Error('request input is required');
      context.utils.logger.error(`ProductOwnerNode ${this.id}: ${error.message}`);
      context.utils.emit('product-owner-error', {
        nodeId: this.id,
        error: error.message,
      });
      return {
        success: false,
        outputs: {},
        error,
      };
    }

    try {
      // Build prompt
      const prompt = this.buildPrompt(String(request), constraints);
      const aiConfig = this.config.ai!;

      // Execute AI query with retry logic
      const response = await this.executeWithRetry(context, prompt, aiConfig);

      // Parse response
      const { tasks, specifications, nextNodePrompt } = this.parseResponse(response.finalState);

      // Emit tasks-decomposed event if tasks were generated
      if (tasks && tasks.length > 0) {
        context.utils.emit('tasks-decomposed', {
          nodeId: this.id,
          taskCount: tasks.length,
          tasks: tasks.map(t => ({ id: t.id, title: t.title, priority: t.priority })),
        });
      }

      // Emit success event
      context.utils.emit('product-owner-completed', {
        nodeId: this.id,
        success: true,
        duration: Date.now() - startTime,
        taskCount: tasks?.length ?? 0,
      });

      return {
        success: true,
        outputs: {
          tasks: tasks ?? [],
          specifications: specifications ?? null,
          prompt: nextNodePrompt ?? this.generateDefaultPrompt(tasks, specifications),
          fileChanges: response.fileChanges,
        },
        metadata: {
          duration: response.duration,
          aiCalls: 1,
          tokensUsed: response.tokensUsed,
          turns: response.turns,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      context.utils.logger.error(`ProductOwnerNode ${this.id} failed: ${errorMessage}`);
      context.utils.emit('product-owner-error', {
        nodeId: this.id,
        error: errorMessage,
      });

      return {
        success: false,
        outputs: {},
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          duration: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Parse AI response into structured data
   */
  private parseResponse(finalState: unknown): {
    tasks: DecomposedTask[] | undefined;
    specifications: Specifications | undefined;
    nextNodePrompt: string | undefined;
  } {
    if (!finalState || typeof finalState !== 'object') {
      return { tasks: undefined, specifications: undefined, nextNodePrompt: undefined };
    }

    const state = finalState as Record<string, unknown>;

    return {
      tasks: state.tasks as DecomposedTask[] | undefined,
      specifications: state.specifications as Specifications | undefined,
      nextNodePrompt: state.nextNodePrompt as string | undefined,
    };
  }

  /**
   * Generate default prompt for next node
   */
  private generateDefaultPrompt(
    tasks: DecomposedTask[] | undefined,
    specifications: Specifications | undefined
  ): string {
    if (tasks && tasks.length > 0) {
      const taskList = tasks.map(t => `- ${t.title} (${t.priority})`).join('\n');
      return `Please implement the following tasks:\n\n${taskList}`;
    }

    if (specifications) {
      return `Please implement the feature based on the specifications:\n\n${specifications.overview}`;
    }

    return 'Please implement the requested feature.';
  }

  /**
   * Execute AI query with retry logic
   */
  private async executeWithRetry(
    context: ExecutionContext,
    prompt: string,
    aiConfig: AIConfig
  ): Promise<{
    finalState: unknown;
    duration: number;
    turns: number;
    tokensUsed?: number;
    fileChanges?: unknown[];
  }> {
    const retryPolicy = this.config.retryPolicy;
    const maxRetries = retryPolicy?.maxRetries ?? 0;
    const retryDelay = retryPolicy?.retryDelay ?? 1000;
    const exponentialBackoff = retryPolicy?.exponentialBackoff ?? false;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await context.services.aiProvider.query({
          prompt,
          options: {
            model: aiConfig.model,
            systemPrompt: aiConfig.systemPrompt,
            maxTurns: aiConfig.maxTurns,
            allowedTools: aiConfig.allowedTools,
            temperature: aiConfig.temperature,
            topP: aiConfig.topP,
          },
        });

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          context.utils.logger.warn(
            `ProductOwnerNode ${this.id}: Attempt ${attempt + 1} failed, retrying...`,
            lastError.message
          );

          const delay = exponentialBackoff
            ? retryDelay * Math.pow(2, attempt)
            : retryDelay;

          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new Error('AI execution failed');
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create ProductOwnerNode from JSON
   */
  static createFromJSON(json: {
    id: string;
    type: 'preset:product-owner';
    label: string;
    position: { x: number; y: number };
    inputs: unknown[];
    outputs: unknown[];
    config: ProductOwnerNodeConfig;
  }): ProductOwnerNode {
    const node = new ProductOwnerNode(json.id, {
      ...json.config,
      label: json.label,
    });
    node.setPosition(json.position.x, json.position.y);
    return node;
  }
}

export default ProductOwnerNode;
