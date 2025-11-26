/**
 * ReviewerNode
 *
 * Preset AI node for code review tasks.
 * Specializes in code quality assessment, security review, and best practices validation.
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
 * Default system prompt for code review tasks
 */
const DEFAULT_SYSTEM_PROMPT = `You are an expert code reviewer with extensive experience in software development best practices.

Your responsibilities:
- Review code for correctness, efficiency, and maintainability
- Identify potential bugs, security vulnerabilities, and performance issues
- Ensure code follows best practices and design patterns
- Check for proper error handling and edge cases
- Evaluate code readability and documentation

Review Guidelines:
- Analyze the code thoroughly before providing feedback
- Categorize findings by severity (error, warning, info)
- Provide specific, actionable suggestions for improvement
- Acknowledge good practices when found
- Be constructive and educational in feedback

Output Format:
Provide your review as a structured response with:
- approved: boolean (true if code passes review, false otherwise)
- summary: string (brief overview of the review)
- findings: array of { severity, message, line?, suggestion? }`;

/**
 * Default allowed tools for review tasks
 */
const DEFAULT_ALLOWED_TOOLS = [
  'Read',
  'Glob',
  'Grep',
];

/**
 * Default maximum turns for review tasks
 */
const DEFAULT_MAX_TURNS = 15;

// ============================================================================
// Types
// ============================================================================

/**
 * Review finding severity
 */
export type FindingSeverity = 'error' | 'warning' | 'info';

/**
 * Review finding
 */
export interface ReviewFinding {
  severity: FindingSeverity;
  message: string;
  line?: number;
  suggestion?: string;
}

/**
 * Review result structure
 */
export interface ReviewResult {
  approved: boolean;
  summary: string;
  findings: ReviewFinding[];
}

/**
 * ReviewerNode configuration
 */
export interface ReviewerNodeConfig extends NodeConfig {
  /** Custom label for the node */
  label?: string;
  /** AI configuration */
  ai?: AIConfig;
  /** Retry policy */
  retryPolicy?: RetryPolicy;
  /** Strict mode - reject code with any findings */
  strictMode?: boolean;
  /** Custom review criteria */
  reviewCriteria?: string[];
}

// ============================================================================
// ReviewerNode
// ============================================================================

/**
 * ReviewerNode - Preset node for code review tasks
 *
 * Features:
 * - Predefined system prompt for code review
 * - Default tools for code analysis
 * - Strict mode for zero-tolerance reviews
 * - Custom review criteria support
 * - Specialized event emission
 */
export class ReviewerNode extends BaseWorkflowNode {
  declare config: ReviewerNodeConfig;

  constructor(id: string, config: ReviewerNodeConfig = {}) {
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
      type: 'preset:reviewer',
      label: config.label ?? 'Reviewer',
      description: 'Review code for quality, security, and best practices',
      inputs: [
        {
          id: 'code',
          name: 'Code',
          type: 'data',
          dataType: 'object',
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
          id: 'review',
          name: 'Review',
          type: 'data',
          dataType: 'object',
          required: true,
        },
        {
          id: 'approved',
          name: 'Approved',
          type: 'data',
          dataType: 'boolean',
          required: true,
        },
        {
          id: 'findings',
          name: 'Findings',
          type: 'data',
          dataType: 'array',
          required: false,
        },
      ],
      config: {
        ai: aiConfig,
        retryPolicy: config.retryPolicy,
        strictMode: config.strictMode ?? false,
        reviewCriteria: config.reviewCriteria,
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
   * Build the prompt for code review
   */
  private buildPrompt(code: unknown, context: unknown): string {
    let prompt = '## Code Review Request\n\n';

    // Add code content
    prompt += '### Code to Review\n\n';
    prompt += this.formatCode(code);

    // Add review criteria if specified
    if (this.config.reviewCriteria && this.config.reviewCriteria.length > 0) {
      prompt += '\n\n### Review Criteria\n\n';
      prompt += 'Focus on the following aspects:\n';
      this.config.reviewCriteria.forEach((criterion, index) => {
        prompt += `${index + 1}. ${criterion}\n`;
      });
    }

    // Add context if provided
    if (context !== undefined && context !== null) {
      prompt += '\n\n### Context\n\n';
      prompt += this.formatContext(context);
    }

    return prompt;
  }

  /**
   * Format code for inclusion in prompt
   */
  private formatCode(code: unknown): string {
    if (typeof code === 'string') {
      return `\`\`\`\n${code}\n\`\`\``;
    }

    if (typeof code === 'object' && code !== null) {
      const codeObj = code as Record<string, unknown>;

      // Handle code with content property
      if (codeObj.content) {
        return `\`\`\`\n${codeObj.content}\n\`\`\``;
      }

      // Handle code with files property
      if (codeObj.files && Array.isArray(codeObj.files)) {
        let formatted = '';
        for (const file of codeObj.files) {
          formatted += `File: ${file}\n`;
        }
        if (codeObj.changes) {
          formatted += `\nChanges:\n\`\`\`\n${codeObj.changes}\n\`\`\``;
        }
        return formatted;
      }

      return JSON.stringify(code, null, 2);
    }

    return String(code);
  }

  /**
   * Format context for inclusion in prompt
   */
  private formatContext(context: unknown): string {
    if (typeof context === 'string') {
      return context;
    }

    if (typeof context === 'object') {
      return JSON.stringify(context, null, 2);
    }

    return String(context);
  }

  /**
   * Process the AI response and apply strict mode if needed
   */
  private processReviewResult(
    aiResult: unknown,
    strictMode: boolean
  ): { review: ReviewResult; approved: boolean; findings: ReviewFinding[] } {
    // Default structure if AI doesn't return expected format
    let review: ReviewResult = {
      approved: true,
      summary: 'Review completed',
      findings: [],
    };

    if (typeof aiResult === 'object' && aiResult !== null) {
      const result = aiResult as Partial<ReviewResult>;
      review = {
        approved: result.approved ?? true,
        summary: result.summary ?? 'Review completed',
        findings: result.findings ?? [],
      };
    }

    // Apply strict mode: any findings mean not approved
    let approved = review.approved;
    if (strictMode && review.findings.length > 0) {
      approved = false;
    }

    return {
      review,
      approved,
      findings: review.findings,
    };
  }

  /**
   * Execute the code review
   */
  async execute(context: ExecutionContext): Promise<NodeResult> {
    const startTime = Date.now();
    const code = context.inputs.code;
    const reviewContext = context.inputs.context;

    // Emit start event
    context.utils.emit('review-started', {
      nodeId: this.id,
      nodeType: this.type,
    });

    // Validate code input
    if (code === undefined || code === null) {
      const error = new Error('code input is required');
      context.utils.logger.error(`ReviewerNode ${this.id}: ${error.message}`);
      context.utils.emit('review-error', {
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
      const prompt = this.buildPrompt(code, reviewContext);
      const aiConfig = this.config.ai!;

      // Execute AI query with retry logic
      const response = await this.executeWithRetry(context, prompt, aiConfig);

      // Process review result
      const { review, approved, findings } = this.processReviewResult(
        response.finalState,
        this.config.strictMode ?? false
      );

      // Emit success event
      context.utils.emit('review-completed', {
        nodeId: this.id,
        success: true,
        approved,
        duration: Date.now() - startTime,
      });

      return {
        success: true,
        outputs: {
          review,
          approved,
          findings,
        },
        metadata: {
          duration: response.duration,
          aiCalls: 1,
          tokensUsed: response.tokensUsed,
          turns: response.turns,
          findingsCount: findings.length,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      context.utils.logger.error(`ReviewerNode ${this.id} failed: ${errorMessage}`);
      context.utils.emit('review-error', {
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
            `ReviewerNode ${this.id}: Attempt ${attempt + 1} failed, retrying...`,
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
   * Create ReviewerNode from JSON
   */
  static createFromJSON(json: {
    id: string;
    type: 'preset:reviewer';
    label: string;
    position: { x: number; y: number };
    inputs: unknown[];
    outputs: unknown[];
    config: ReviewerNodeConfig;
  }): ReviewerNode {
    const node = new ReviewerNode(json.id, {
      ...json.config,
      label: json.label,
    });
    node.setPosition(json.position.x, json.position.y);
    return node;
  }
}

export default ReviewerNode;
