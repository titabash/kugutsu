/**
 * MergeCoordinatorNode
 *
 * Preset AI node for coordinating git merge operations.
 * Manages branch merging, conflict detection, and merge strategy execution.
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
 * Default system prompt for merge coordination tasks
 */
const DEFAULT_SYSTEM_PROMPT = `You are an expert Git merge coordinator with deep expertise in version control and code integration.

Your responsibilities:
- Analyze branches to determine optimal merge order
- Identify potential merge conflicts before they occur
- Suggest conflict resolution strategies
- Ensure code quality is maintained during merges
- Minimize integration risks

Guidelines:
- Consider dependency relationships between branches
- Prioritize branches with fewer dependencies
- Identify branches that may cause conflicts
- Suggest merge order to minimize conflicts
- Report potential issues before attempting merges`;

/**
 * Default allowed tools for merge coordination
 */
const DEFAULT_ALLOWED_TOOLS = [
  'Bash',
  'Read',
  'Glob',
];

/**
 * Default maximum turns for merge coordination
 */
const DEFAULT_MAX_TURNS = 10;

// ============================================================================
// Types
// ============================================================================

/**
 * Merge strategy options
 */
export type MergeStrategy = 'sequential' | 'parallel' | 'ai-driven';

/**
 * Conflict resolution mode
 */
export type ConflictResolutionMode = 'auto' | 'manual' | 'ai-assisted';

/**
 * MergeCoordinatorNode configuration
 */
export interface MergeCoordinatorNodeConfig extends NodeConfig {
  /** Custom label for the node */
  label?: string;
  /** AI configuration */
  ai?: AIConfig;
  /** Retry policy */
  retryPolicy?: RetryPolicy;
  /** Merge strategy */
  mergeStrategy?: MergeStrategy;
  /** Conflict resolution mode */
  conflictResolution?: ConflictResolutionMode;
  /** Stop on first conflict */
  stopOnConflict?: boolean;
  /** Cleanup branches after merge */
  cleanupBranches?: boolean;
}

/**
 * Conflict information
 */
export interface MergeConflict {
  branch: string;
  targetBranch: string;
  conflictFiles: string[];
  conflictDetails?: Record<string, { ours: string; theirs: string }>;
}

/**
 * Merge status
 */
export interface MergeStatus {
  totalBranches: number;
  mergedCount: number;
  conflictCount: number;
  skippedCount: number;
  status: 'success' | 'partial' | 'failed';
}

// ============================================================================
// MergeCoordinatorNode
// ============================================================================

/**
 * MergeCoordinatorNode - Preset node for git merge coordination
 *
 * Features:
 * - Multiple merge strategies (sequential, parallel, ai-driven)
 * - Conflict detection and handling
 * - Branch cleanup after merge
 * - Specialized event emission
 */
export class MergeCoordinatorNode extends BaseWorkflowNode {
  declare config: MergeCoordinatorNodeConfig;

  constructor(id: string, config: MergeCoordinatorNodeConfig = {}) {
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
      type: 'preset:merge-coordinator',
      label: config.label ?? 'Merge Coordinator',
      description: 'Coordinate git branch merges with conflict handling',
      inputs: [
        {
          id: 'branches',
          name: 'Branches',
          type: 'data',
          dataType: 'array',
          required: true,
        },
        {
          id: 'targetBranch',
          name: 'Target Branch',
          type: 'data',
          dataType: 'string',
          required: false,
        },
        {
          id: 'results',
          name: 'Results',
          type: 'data',
          dataType: 'array',
          required: false,
        },
      ],
      outputs: [
        {
          id: 'mergeStatus',
          name: 'Merge Status',
          type: 'data',
          dataType: 'object',
          required: true,
        },
        {
          id: 'conflicts',
          name: 'Conflicts',
          type: 'data',
          dataType: 'array',
          required: false,
        },
        {
          id: 'mergedBranches',
          name: 'Merged Branches',
          type: 'data',
          dataType: 'array',
          required: false,
        },
      ],
      config: {
        ai: aiConfig,
        retryPolicy: config.retryPolicy,
        mergeStrategy: config.mergeStrategy ?? 'sequential',
        conflictResolution: config.conflictResolution ?? 'ai-assisted',
        stopOnConflict: config.stopOnConflict ?? false,
        cleanupBranches: config.cleanupBranches ?? false,
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

    // Validate merge strategy
    const validStrategies: MergeStrategy[] = ['sequential', 'parallel', 'ai-driven'];
    if (this.config.mergeStrategy && !validStrategies.includes(this.config.mergeStrategy)) {
      errors.push('mergeStrategy must be one of: sequential, parallel, ai-driven');
    }

    // Validate conflict resolution
    const validResolutions: ConflictResolutionMode[] = ['auto', 'manual', 'ai-assisted'];
    if (this.config.conflictResolution && !validResolutions.includes(this.config.conflictResolution)) {
      errors.push('conflictResolution must be one of: auto, manual, ai-assisted');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Execute merge coordination
   */
  async execute(context: ExecutionContext): Promise<NodeResult> {
    const startTime = Date.now();
    const branches = context.inputs.branches as string[] | undefined;
    const targetBranch = (context.inputs.targetBranch as string) || context.global.baseBranch;

    // Emit start event
    context.utils.emit('merge-coordinator-started', {
      nodeId: this.id,
      nodeType: this.type,
      branchCount: branches?.length ?? 0,
    });

    // Validate branches input
    if (branches === undefined || branches === null) {
      const error = new Error('branches input is required');
      context.utils.logger.error(`MergeCoordinatorNode ${this.id}: ${error.message}`);
      context.utils.emit('merge-coordinator-error', {
        nodeId: this.id,
        error: error.message,
      });
      return {
        success: false,
        outputs: {},
        error,
      };
    }

    // Handle empty branches array
    if (branches.length === 0) {
      context.utils.emit('merge-coordinator-completed', {
        nodeId: this.id,
        success: true,
        mergedCount: 0,
      });
      return {
        success: true,
        outputs: {
          mergeStatus: {
            totalBranches: 0,
            mergedCount: 0,
            conflictCount: 0,
            skippedCount: 0,
            status: 'success',
          },
          conflicts: [],
          mergedBranches: [],
        },
        metadata: {
          duration: Date.now() - startTime,
        },
      };
    }

    try {
      // Determine merge order based on strategy
      const mergeOrder = await this.determineMergeOrder(context, branches, targetBranch);

      // Execute merges
      const { mergedBranches, conflicts, status } = await this.executeMerges(
        context,
        mergeOrder,
        targetBranch
      );

      // Cleanup branches if configured
      if (this.config.cleanupBranches && mergedBranches.length > 0) {
        await this.cleanupBranches(context, mergedBranches);
      }

      // Emit completion event
      context.utils.emit('merge-coordinator-completed', {
        nodeId: this.id,
        success: true,
        mergedCount: mergedBranches.length,
        conflictCount: conflicts.length,
      });

      return {
        success: true,
        outputs: {
          mergeStatus: status,
          conflicts,
          mergedBranches,
        },
        metadata: {
          duration: Date.now() - startTime,
          aiCalls: this.config.mergeStrategy === 'ai-driven' ? 1 : 0,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      context.utils.logger.error(`MergeCoordinatorNode ${this.id} failed: ${errorMessage}`);
      context.utils.emit('merge-coordinator-error', {
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
   * Determine merge order based on strategy
   */
  private async determineMergeOrder(
    context: ExecutionContext,
    branches: string[],
    targetBranch: string
  ): Promise<string[]> {
    const strategy = this.config.mergeStrategy ?? 'sequential';

    switch (strategy) {
      case 'ai-driven':
        return this.getAIDrivenMergeOrder(context, branches, targetBranch);
      case 'parallel':
      case 'sequential':
      default:
        return branches;
    }
  }

  /**
   * Get AI-driven merge order
   */
  private async getAIDrivenMergeOrder(
    context: ExecutionContext,
    branches: string[],
    targetBranch: string
  ): Promise<string[]> {
    const prompt = `Analyze the following branches and determine the optimal merge order into ${targetBranch}:

Branches: ${branches.join(', ')}

Consider:
1. Dependency relationships
2. Potential conflicts
3. Size of changes
4. Risk level

Respond with a JSON object containing:
- mergeOrder: Array of branch names in optimal merge order
- reasoning: Brief explanation for the order`;

    const aiConfig = this.config.ai!;

    try {
      const response = await context.services.aiProvider.query({
        prompt,
        options: {
          model: aiConfig.model,
          systemPrompt: aiConfig.systemPrompt,
          maxTurns: aiConfig.maxTurns,
          allowedTools: aiConfig.allowedTools,
        },
      });

      const result = response.finalState as { mergeOrder?: string[] };
      return result.mergeOrder ?? branches;
    } catch {
      // Fall back to original order on AI failure
      context.utils.logger.warn(
        `MergeCoordinatorNode ${this.id}: AI analysis failed, using original order`
      );
      return branches;
    }
  }

  /**
   * Execute merges in order
   */
  private async executeMerges(
    context: ExecutionContext,
    branches: string[],
    targetBranch: string
  ): Promise<{
    mergedBranches: string[];
    conflicts: MergeConflict[];
    status: MergeStatus;
  }> {
    const mergedBranches: string[] = [];
    const conflicts: MergeConflict[] = [];

    for (const branch of branches) {
      try {
        const result = await context.services.gitManager.merge({
          source: branch,
          sourceBranch: branch,
          target: targetBranch,
          targetBranch,
          strategy: 'merge',
        });

        if (result.success && !result.hasConflict) {
          mergedBranches.push(branch);
          context.utils.emit('branch-merged', {
            nodeId: this.id,
            branch,
            targetBranch,
          });
        } else if (result.hasConflict) {
          // Convert array-based conflictDetails to Record format
          let conflictDetailsRecord: Record<string, { ours: string; theirs: string }> | undefined;
          if (result.conflictDetails) {
            conflictDetailsRecord = {};
            for (const detail of result.conflictDetails) {
              conflictDetailsRecord[detail.file] = {
                ours: detail.ours,
                theirs: detail.theirs,
              };
            }
          }
          const conflict: MergeConflict = {
            branch,
            targetBranch,
            conflictFiles: result.conflictFiles || [],
            conflictDetails: conflictDetailsRecord,
          };
          conflicts.push(conflict);

          context.utils.emit('merge-conflict', {
            nodeId: this.id,
            branch,
            targetBranch,
            conflictFiles: conflict.conflictFiles,
          });

          // Stop on conflict if configured
          if (this.config.stopOnConflict) {
            break;
          }
        }
      } catch (error) {
        // Re-throw to be handled by caller
        throw error;
      }
    }

    const status: MergeStatus = {
      totalBranches: branches.length,
      mergedCount: mergedBranches.length,
      conflictCount: conflicts.length,
      skippedCount: branches.length - mergedBranches.length - conflicts.length,
      status: this.determineMergeStatus(branches.length, mergedBranches.length, conflicts.length),
    };

    return { mergedBranches, conflicts, status };
  }

  /**
   * Determine overall merge status
   */
  private determineMergeStatus(
    total: number,
    merged: number,
    conflicts: number
  ): 'success' | 'partial' | 'failed' {
    if (merged === total) {
      return 'success';
    }
    if (merged > 0) {
      return 'partial';
    }
    if (conflicts > 0) {
      return 'failed';
    }
    return 'success';
  }

  /**
   * Cleanup merged branches
   */
  private async cleanupBranches(
    context: ExecutionContext,
    branches: string[]
  ): Promise<void> {
    for (const branch of branches) {
      try {
        await context.services.gitManager.deleteBranch(branch);
        context.utils.logger.info(`Cleaned up branch: ${branch}`);
      } catch (error) {
        context.utils.logger.warn(`Failed to cleanup branch ${branch}: ${error}`);
      }
    }
  }

  /**
   * Create MergeCoordinatorNode from JSON
   */
  static createFromJSON(json: {
    id: string;
    type: 'preset:merge-coordinator';
    label: string;
    position: { x: number; y: number };
    inputs: unknown[];
    outputs: unknown[];
    config: MergeCoordinatorNodeConfig;
  }): MergeCoordinatorNode {
    const node = new MergeCoordinatorNode(json.id, {
      ...json.config,
      label: json.label,
    });
    node.setPosition(json.position.x, json.position.y);
    return node;
  }
}

export default MergeCoordinatorNode;
