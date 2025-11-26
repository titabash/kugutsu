/**
 * ConflictResolverNode
 *
 * Preset AI node for resolving git merge conflicts.
 * Uses AI to analyze and resolve conflicts intelligently.
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
 * Default system prompt for conflict resolution tasks
 */
const DEFAULT_SYSTEM_PROMPT = `You are an expert at resolving git merge conflicts with deep understanding of code semantics and software architecture.

Your responsibilities:
- Analyze conflicting code changes from both branches
- Understand the intent behind each change
- Merge changes intelligently while preserving functionality
- Ensure the resolved code is correct and consistent
- Maintain code style and conventions

Guidelines:
- Read and understand both versions of the conflicting code
- Consider the context and purpose of each change
- Prefer combining changes when possible
- Preserve important functionality from both sides
- Add comments if the resolution is complex
- Test the resolved code mentally for correctness`;

/**
 * Default allowed tools for conflict resolution
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
 * Default maximum turns for conflict resolution
 */
const DEFAULT_MAX_TURNS = 20;

// ============================================================================
// Types
// ============================================================================

/**
 * Resolution strategy options
 */
export type ResolutionStrategy = 'ai-driven' | 'ours' | 'theirs';

/**
 * ConflictResolverNode configuration
 */
export interface ConflictResolverNodeConfig extends NodeConfig {
  /** Custom label for the node */
  label?: string;
  /** AI configuration */
  ai?: AIConfig;
  /** Retry policy */
  retryPolicy?: RetryPolicy;
  /** Resolution strategy */
  resolutionStrategy?: ResolutionStrategy;
}

/**
 * Conflict input structure
 */
export interface ConflictInput {
  branch: string;
  targetBranch: string;
  conflictFiles: string[];
  conflictDetails?: Record<string, { ours: string; theirs: string }>;
}

/**
 * Resolution result
 */
export interface Resolution {
  strategy: string;
  chosenVersion?: string;
  resolvedContent?: string;
  explanation?: string;
}

/**
 * Resolved file info
 */
export interface ResolvedFile {
  path: string;
  resolution: Resolution;
}

// ============================================================================
// ConflictResolverNode
// ============================================================================

/**
 * ConflictResolverNode - Preset node for git conflict resolution
 *
 * Features:
 * - AI-driven intelligent conflict resolution
 * - Support for simple strategies (ours/theirs)
 * - Context-aware resolution
 * - Specialized event emission
 */
export class ConflictResolverNode extends BaseWorkflowNode {
  declare config: ConflictResolverNodeConfig;

  constructor(id: string, config: ConflictResolverNodeConfig = {}) {
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
      type: 'preset:conflict-resolver',
      label: config.label ?? 'Conflict Resolver',
      description: 'Resolve git merge conflicts using AI',
      inputs: [
        {
          id: 'conflict',
          name: 'Conflict',
          type: 'data',
          dataType: 'object',
          required: true,
        },
        {
          id: 'context',
          name: 'Context',
          type: 'data',
          dataType: 'object',
          required: false,
        },
        {
          id: 'preferences',
          name: 'Preferences',
          type: 'data',
          dataType: 'object',
          required: false,
        },
      ],
      outputs: [
        {
          id: 'resolution',
          name: 'Resolution',
          type: 'data',
          dataType: 'object',
          required: true,
        },
        {
          id: 'resolvedFiles',
          name: 'Resolved Files',
          type: 'data',
          dataType: 'array',
          required: false,
        },
        {
          id: 'success',
          name: 'Success',
          type: 'data',
          dataType: 'boolean',
          required: true,
        },
      ],
      config: {
        ai: aiConfig,
        retryPolicy: config.retryPolicy,
        resolutionStrategy: config.resolutionStrategy ?? 'ai-driven',
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

    // Validate resolution strategy
    const validStrategies: ResolutionStrategy[] = ['ai-driven', 'ours', 'theirs'];
    if (this.config.resolutionStrategy && !validStrategies.includes(this.config.resolutionStrategy)) {
      errors.push('resolutionStrategy must be one of: ai-driven, ours, theirs');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Build the prompt for conflict resolution
   */
  private buildPrompt(
    conflict: ConflictInput,
    taskContext: unknown,
    preferences: unknown
  ): string {
    let prompt = `## Merge Conflict Resolution

**Source Branch:** ${conflict.branch}
**Target Branch:** ${conflict.targetBranch}

**Conflicting Files:**
${conflict.conflictFiles.map(f => `- ${f}`).join('\n')}
`;

    // Add conflict details if available
    if (conflict.conflictDetails) {
      prompt += `\n### Conflict Details\n`;
      for (const [file, details] of Object.entries(conflict.conflictDetails)) {
        prompt += `\n#### ${file}\n`;
        prompt += `**Our Version:**\n\`\`\`\n${details.ours}\n\`\`\`\n`;
        prompt += `**Their Version:**\n\`\`\`\n${details.theirs}\n\`\`\`\n`;
      }
    }

    // Add context if provided
    if (taskContext !== undefined && taskContext !== null) {
      const contextStr = this.formatObject(taskContext);
      prompt += `\n### Additional Context\n${contextStr}\n`;
    }

    // Add preferences if provided
    if (preferences !== undefined && preferences !== null) {
      const prefsStr = this.formatObject(preferences);
      prompt += `\n### Resolution Preferences\n${prefsStr}\n`;
    }

    prompt += `\n## Instructions

Please resolve the merge conflicts in the listed files. For each file:
1. Read both versions of the conflicting code
2. Understand the intent behind each change
3. Create a merged version that preserves important functionality from both
4. Write the resolved content to the file

After resolving, respond with a JSON object containing:
- resolution: { strategy: "merge", explanation: "brief explanation" }
- resolvedFiles: Array of resolved file paths`;

    return prompt;
  }

  /**
   * Format object for prompt
   */
  private formatObject(obj: unknown): string {
    if (typeof obj === 'string') {
      return obj;
    }
    return JSON.stringify(obj, null, 2);
  }

  /**
   * Execute conflict resolution
   */
  async execute(context: ExecutionContext): Promise<NodeResult> {
    const startTime = Date.now();
    const conflict = context.inputs.conflict as ConflictInput | undefined;
    const taskContext = context.inputs.context;
    const preferences = context.inputs.preferences;

    // Emit start event
    context.utils.emit('conflict-resolver-started', {
      nodeId: this.id,
      nodeType: this.type,
    });

    // Validate conflict input
    if (conflict === undefined || conflict === null) {
      const error = new Error('conflict input is required');
      context.utils.logger.error(`ConflictResolverNode ${this.id}: ${error.message}`);
      context.utils.emit('conflict-resolver-error', {
        nodeId: this.id,
        error: error.message,
      });
      return {
        success: false,
        outputs: {},
        error,
      };
    }

    // Handle empty conflict files
    if (!conflict.conflictFiles || conflict.conflictFiles.length === 0) {
      context.utils.emit('conflict-resolver-completed', {
        nodeId: this.id,
        success: true,
        resolvedCount: 0,
      });
      return {
        success: true,
        outputs: {
          resolution: { strategy: 'none', explanation: 'No conflicts to resolve' },
          resolvedFiles: [],
          success: true,
        },
        metadata: {
          duration: Date.now() - startTime,
        },
      };
    }

    try {
      const strategy = this.config.resolutionStrategy ?? 'ai-driven';
      let resolution: Resolution;
      let resolvedFiles: ResolvedFile[];

      if (strategy === 'ai-driven') {
        const result = await this.resolveWithAI(context, conflict, taskContext, preferences);
        resolution = result.resolution;
        resolvedFiles = result.resolvedFiles;
      } else {
        const result = this.resolveWithStrategy(conflict, strategy);
        resolution = result.resolution;
        resolvedFiles = result.resolvedFiles;
      }

      // Emit file-resolved events
      for (const file of resolvedFiles) {
        context.utils.emit('file-resolved', {
          nodeId: this.id,
          file: file.path,
          strategy: resolution.strategy,
        });
      }

      // Emit completion event
      context.utils.emit('conflict-resolver-completed', {
        nodeId: this.id,
        success: true,
        resolvedCount: resolvedFiles.length,
      });

      return {
        success: true,
        outputs: {
          resolution,
          resolvedFiles,
          success: true,
        },
        metadata: {
          duration: Date.now() - startTime,
          aiCalls: strategy === 'ai-driven' ? 1 : 0,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      context.utils.logger.error(`ConflictResolverNode ${this.id} failed: ${errorMessage}`);
      context.utils.emit('conflict-resolver-error', {
        nodeId: this.id,
        error: errorMessage,
      });

      return {
        success: false,
        outputs: {
          success: false,
        },
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          duration: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Resolve conflicts using AI
   */
  private async resolveWithAI(
    context: ExecutionContext,
    conflict: ConflictInput,
    taskContext: unknown,
    preferences: unknown
  ): Promise<{ resolution: Resolution; resolvedFiles: ResolvedFile[] }> {
    const prompt = this.buildPrompt(conflict, taskContext, preferences);
    const aiConfig = this.config.ai!;

    const response = await this.executeWithRetry(context, prompt, aiConfig);
    const result = response.finalState as {
      resolution?: Resolution;
      resolvedFiles?: string[];
    };

    const resolution: Resolution = result.resolution ?? {
      strategy: 'merge',
      explanation: 'AI-assisted merge resolution',
    };

    const resolvedFiles: ResolvedFile[] = (result.resolvedFiles ?? conflict.conflictFiles).map(
      (path: string) => ({
        path,
        resolution,
      })
    );

    return { resolution, resolvedFiles };
  }

  /**
   * Resolve conflicts with simple strategy
   */
  private resolveWithStrategy(
    conflict: ConflictInput,
    strategy: 'ours' | 'theirs'
  ): { resolution: Resolution; resolvedFiles: ResolvedFile[] } {
    const resolution: Resolution = {
      strategy,
      chosenVersion: strategy,
      explanation: `Using ${strategy} version for all conflicts`,
    };

    const resolvedFiles: ResolvedFile[] = conflict.conflictFiles.map(path => ({
      path,
      resolution,
    }));

    return { resolution, resolvedFiles };
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
            `ConflictResolverNode ${this.id}: Attempt ${attempt + 1} failed, retrying...`,
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
   * Create ConflictResolverNode from JSON
   */
  static createFromJSON(json: {
    id: string;
    type: 'preset:conflict-resolver';
    label: string;
    position: { x: number; y: number };
    inputs: unknown[];
    outputs: unknown[];
    config: ConflictResolverNodeConfig;
  }): ConflictResolverNode {
    const node = new ConflictResolverNode(json.id, {
      ...json.config,
      label: json.label,
    });
    node.setPosition(json.position.x, json.position.y);
    return node;
  }
}

export default ConflictResolverNode;
