/**
 * EngineerNode
 *
 * Preset AI node for software engineering tasks.
 * Specializes in code implementation, bug fixing, and feature development.
 */

import {
  BaseWorkflowNode,
  type NodeConfig,
  type ExecutionContext,
  type NodeResult,
  type ValidationResult,
} from '../BaseWorkflowNode.js';
import type { AIConfig, RetryPolicy, WorktreeInfo } from '../../types.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default system prompt for engineering tasks
 */
const DEFAULT_SYSTEM_PROMPT = `You are an expert software engineer with deep expertise in multiple programming languages and frameworks.

Your responsibilities:
- Implement high-quality, maintainable code
- Follow best practices and design patterns
- Write clean, well-documented code
- Handle edge cases and error conditions
- Ensure code is testable and tested

Guidelines:
- Analyze the task thoroughly before implementation
- Break down complex tasks into smaller steps
- Use appropriate data structures and algorithms
- Follow the project's coding conventions
- Add appropriate comments for complex logic`;

/**
 * Default allowed tools for engineering tasks
 */
const DEFAULT_ALLOWED_TOOLS = [
  'Read',
  'Write',
  'Edit',
  'Bash',
  'Glob',
  'Grep',
];

/**
 * Default maximum turns for engineering tasks
 */
const DEFAULT_MAX_TURNS = 30;

// ============================================================================
// Types
// ============================================================================

/**
 * EngineerNode configuration
 */
export interface EngineerNodeConfig extends NodeConfig {
  /** Custom label for the node */
  label?: string;
  /** AI configuration */
  ai?: AIConfig;
  /** Retry policy */
  retryPolicy?: RetryPolicy;
  /** Use git worktree for isolated execution */
  useWorktree?: boolean;
  /** Branch prefix for worktree */
  branchPrefix?: string;
  /** Cleanup worktree after execution */
  cleanupWorktree?: boolean;
}

// ============================================================================
// EngineerNode
// ============================================================================

/**
 * EngineerNode - Preset node for software engineering tasks
 *
 * Features:
 * - Predefined system prompt for engineering tasks
 * - Default tools for code manipulation
 * - Git worktree integration for isolated execution
 * - Specialized event emission
 */
export class EngineerNode extends BaseWorkflowNode {
  declare config: EngineerNodeConfig;

  constructor(id: string, config: EngineerNodeConfig = {}) {
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
      type: 'preset:engineer',
      label: config.label ?? 'Engineer',
      description: 'Execute software engineering tasks with AI assistance',
      inputs: [
        {
          id: 'task',
          name: 'Task',
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
          id: 'code',
          name: 'Code',
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
        ai: aiConfig,
        retryPolicy: config.retryPolicy,
        useWorktree: config.useWorktree ?? false,
        branchPrefix: config.branchPrefix ?? 'engineer',
        cleanupWorktree: config.cleanupWorktree ?? true,
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

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Build the prompt for engineering task
   */
  private buildPrompt(
    task: string,
    context: unknown,
    worktreePath?: string
  ): string {
    let prompt = `## Engineering Task\n\n${task}`;

    // Add worktree context if available
    if (worktreePath) {
      prompt += `\n\n## Working Directory\n\nExecute all file operations in: ${worktreePath}`;
    }

    // Add context if provided
    if (context !== undefined && context !== null) {
      const contextStr = this.formatContext(context);
      prompt += `\n\n## Context\n\n${contextStr}`;
    }

    return prompt;
  }

  /**
   * Format context for inclusion in prompt
   */
  private formatContext(context: unknown): string {
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
   * Execute the engineering task
   */
  async execute(context: ExecutionContext): Promise<NodeResult> {
    const startTime = Date.now();
    const task = context.inputs.task;
    const taskContext = context.inputs.context;

    // Emit start event
    context.utils.emit('engineer-started', {
      nodeId: this.id,
      nodeType: this.type,
    });

    // Validate task input
    if (task === undefined || task === null || task === '') {
      const error = new Error('task input is required');
      context.utils.logger.error(`EngineerNode ${this.id}: ${error.message}`);
      context.utils.emit('engineer-error', {
        nodeId: this.id,
        error: error.message,
      });
      return {
        success: false,
        outputs: {},
        error,
      };
    }

    let worktree: WorktreeInfo | null = null;

    try {
      // Create worktree if enabled
      if (this.config.useWorktree) {
        worktree = await context.services.gitManager.createWorktree({
          branchName: `${this.config.branchPrefix}-${context.global.executionId}-${this.id}`,
          baseBranch: context.global.baseBranch,
        });
      }

      // Build prompt
      const prompt = this.buildPrompt(String(task), taskContext, worktree?.path);
      const aiConfig = this.config.ai!;

      // Execute AI query with retry logic
      const response = await this.executeWithRetry(context, prompt, aiConfig);

      // Emit success event
      context.utils.emit('engineer-completed', {
        nodeId: this.id,
        success: true,
        duration: Date.now() - startTime,
      });

      return {
        success: true,
        outputs: {
          code: response.finalState,
          fileChanges: response.fileChanges,
        },
        metadata: {
          duration: response.duration,
          aiCalls: 1,
          tokensUsed: response.tokensUsed,
          turns: response.turns,
          worktreePath: worktree?.path,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      context.utils.logger.error(`EngineerNode ${this.id} failed: ${errorMessage}`);
      context.utils.emit('engineer-error', {
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
    } finally {
      // Cleanup worktree if configured
      if (worktree && this.config.cleanupWorktree) {
        try {
          await context.services.gitManager.removeWorktree(worktree.path);
        } catch (cleanupError) {
          context.utils.logger.warn(
            `EngineerNode ${this.id}: Failed to cleanup worktree`,
            cleanupError
          );
        }
      }
    }
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
            `EngineerNode ${this.id}: Attempt ${attempt + 1} failed, retrying...`,
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
   * Create EngineerNode from JSON
   */
  static createFromJSON(json: {
    id: string;
    type: 'preset:engineer';
    label: string;
    position: { x: number; y: number };
    inputs: unknown[];
    outputs: unknown[];
    config: EngineerNodeConfig;
  }): EngineerNode {
    const node = new EngineerNode(json.id, {
      ...json.config,
      label: json.label,
    });
    node.setPosition(json.position.x, json.position.y);
    return node;
  }
}

export default EngineerNode;
