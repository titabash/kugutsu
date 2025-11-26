/**
 * AITaskNode
 *
 * Base AI task node that executes AI queries through the configured provider.
 * This serves as the foundation for all AI-based workflow nodes.
 */

import {
  BaseWorkflowNode,
  type NodeConfig,
  type ExecutionContext,
  type NodeResult,
  type ValidationResult,
} from './BaseWorkflowNode.js';
import type { AIConfig, RetryPolicy } from '../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * AITaskNode configuration
 */
export interface AITaskNodeConfig extends NodeConfig {
  /** Custom label for the node */
  label?: string;
  /** AI configuration */
  ai?: AIConfig;
  /** Retry policy */
  retryPolicy?: RetryPolicy;
  /** Custom prompt template with {prompt} and {context} placeholders */
  promptTemplate?: string;
}

// ============================================================================
// AITaskNode
// ============================================================================

/**
 * AITaskNode - Base class for AI-powered workflow nodes
 *
 * Executes AI queries through the configured provider with support for:
 * - Custom prompts and system prompts
 * - Context injection
 * - Retry logic
 * - Event emission
 */
export class AITaskNode extends BaseWorkflowNode {
  declare config: AITaskNodeConfig;

  constructor(id: string, config: AITaskNodeConfig = {}) {
    super({
      id,
      type: 'ai:custom',
      label: config.label ?? 'AI Task',
      description: 'Execute an AI task with customizable prompt',
      inputs: [
        {
          id: 'prompt',
          name: 'Prompt',
          type: 'data',
          dataType: 'string',
          required: true,
        },
        {
          id: 'context',
          name: 'Context',
          type: 'data',
          dataType: 'any',
          required: false,
        },
      ],
      outputs: [
        {
          id: 'result',
          name: 'Result',
          type: 'data',
          dataType: 'object',
          required: true,
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
        ai: config.ai ?? { provider: 'auto' },
        retryPolicy: config.retryPolicy,
        promptTemplate: config.promptTemplate,
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

    // Validate topP
    if (ai?.topP !== undefined && (ai.topP < 0 || ai.topP > 1)) {
      errors.push('topP must be between 0 and 1');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Build the final prompt from input and context
   */
  buildPrompt(promptInput: string, context: unknown): string {
    const template = this.config.promptTemplate;

    if (template) {
      // Use custom template
      let prompt = template.replace('{prompt}', promptInput);
      prompt = prompt.replace('{context}', this.formatContext(context));
      return prompt;
    }

    // Default prompt building
    if (context === undefined || context === null) {
      return promptInput;
    }

    const contextStr = this.formatContext(context);
    return `${promptInput}\n\nContext:\n${contextStr}`;
  }

  /**
   * Format context for inclusion in prompt
   */
  private formatContext(context: unknown): string {
    if (context === undefined || context === null) {
      return '';
    }

    if (typeof context === 'string') {
      return context;
    }

    if (Array.isArray(context)) {
      return context.map((item, index) => `${index + 1}. ${JSON.stringify(item)}`).join('\n');
    }

    if (typeof context === 'object') {
      return JSON.stringify(context, null, 2);
    }

    return String(context);
  }

  /**
   * Execute the AI task
   */
  async execute(context: ExecutionContext): Promise<NodeResult> {
    const startTime = Date.now();
    const promptInput = context.inputs.prompt;
    const contextInput = context.inputs.context;

    // Emit start event
    context.utils.emit('ai-task-started', {
      nodeId: this.id,
      nodeType: this.type,
    });

    // Validate prompt input
    if (promptInput === undefined || promptInput === null || promptInput === '') {
      const error = new Error('prompt input is required');
      context.utils.logger.error(`AITaskNode ${this.id}: ${error.message}`);
      context.utils.emit('ai-task-error', {
        nodeId: this.id,
        error: error.message,
      });
      return {
        success: false,
        outputs: {},
        error,
      };
    }

    const prompt = this.buildPrompt(String(promptInput), contextInput);
    const aiConfig = this.config.ai ?? { provider: 'auto' };
    const retryPolicy = this.config.retryPolicy;

    try {
      // Execute with retry logic
      const response = await this.executeWithRetry(
        context,
        prompt,
        aiConfig,
        retryPolicy
      );

      const duration = Date.now() - startTime;

      // Emit success event
      context.utils.emit('ai-task-completed', {
        nodeId: this.id,
        success: true,
        duration,
      });

      return {
        success: true,
        outputs: {
          result: response.finalState,
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
      context.utils.logger.error(`AITaskNode ${this.id} failed: ${errorMessage}`);
      context.utils.emit('ai-task-error', {
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
   * Execute AI query with retry logic
   */
  private async executeWithRetry(
    context: ExecutionContext,
    prompt: string,
    aiConfig: AIConfig,
    retryPolicy?: RetryPolicy
  ): Promise<{
    finalState: unknown;
    duration: number;
    turns: number;
    tokensUsed?: number;
    fileChanges?: unknown[];
  }> {
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
            `AITaskNode ${this.id}: Attempt ${attempt + 1} failed, retrying...`,
            lastError.message
          );

          // Calculate delay with optional exponential backoff
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
   * Create AITaskNode from JSON
   */
  static createFromJSON(json: {
    id: string;
    type: 'ai:custom';
    label: string;
    position: { x: number; y: number };
    inputs: unknown[];
    outputs: unknown[];
    config: AITaskNodeConfig;
  }): AITaskNode {
    const node = new AITaskNode(json.id, {
      ...json.config,
      label: json.label,
    });
    node.setPosition(json.position.x, json.position.y);
    return node;
  }
}

export default AITaskNode;
