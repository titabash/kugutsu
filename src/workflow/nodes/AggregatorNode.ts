/**
 * AggregatorNode
 *
 * Collects and aggregates results from parallel executions.
 * Supports multiple aggregation modes:
 * - concat: Flatten arrays into a single array
 * - merge: Merge objects into a single object
 * - first: Return the first result
 * - last: Return the last result
 * - custom: Use a custom aggregation function
 */

import {
  BaseWorkflowNode,
  type NodeConfig,
  type ExecutionContext,
  type NodeResult,
  type ValidationResult,
} from './BaseWorkflowNode.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Aggregation mode
 */
export type AggregationMode = 'concat' | 'merge' | 'first' | 'last' | 'custom';

/**
 * Custom aggregator function type
 */
export type CustomAggregatorFunction = (
  results: unknown[],
  context: ExecutionContext
) => unknown;

/**
 * AggregatorNode configuration
 */
export interface AggregatorNodeConfig extends NodeConfig {
  /** Aggregation mode (default: 'concat') */
  aggregationMode?: AggregationMode;
  /** Wait for all results before aggregating */
  waitForAll?: boolean;
  /** Timeout for waiting (ms) */
  timeout?: number;
  /** Filter out error results before aggregation */
  filterErrors?: boolean;
  /** Custom aggregation function (for 'custom' mode) */
  customAggregator?: CustomAggregatorFunction;
}

/**
 * Result item that may contain an error
 */
interface ResultWithError {
  error?: string;
  [key: string]: unknown;
}

// ============================================================================
// AggregatorNode
// ============================================================================

/**
 * AggregatorNode - Result aggregation
 *
 * Collects results from parallel node executions and aggregates
 * them according to the configured mode.
 */
export class AggregatorNode extends BaseWorkflowNode {
  declare config: AggregatorNodeConfig;

  constructor(id: string, config: AggregatorNodeConfig = {}) {
    super({
      id,
      type: 'control:aggregator',
      label: 'Aggregator',
      description: 'Aggregate results from parallel executions',
      inputs: [
        {
          id: 'results',
          name: 'Results',
          type: 'data',
          dataType: 'array',
          required: true,
        },
      ],
      outputs: [
        {
          id: 'aggregated',
          name: 'Aggregated',
          type: 'data',
          dataType: 'any',
          required: true,
        },
      ],
      config: {
        aggregationMode: config.aggregationMode ?? 'concat',
        waitForAll: config.waitForAll ?? true,
        timeout: config.timeout,
        filterErrors: config.filterErrors ?? false,
        customAggregator: config.customAggregator,
        ...config,
      },
    });
  }

  /**
   * Validate node configuration
   */
  validate(): ValidationResult {
    const errors: string[] = [];

    const validModes: AggregationMode[] = ['concat', 'merge', 'first', 'last', 'custom'];
    const mode = this.config.aggregationMode;

    if (mode && !validModes.includes(mode)) {
      errors.push(`Invalid aggregationMode: ${mode}. Must be one of: ${validModes.join(', ')}`);
    }

    if (mode === 'custom' && !this.config.customAggregator) {
      errors.push('customAggregator function is required when using custom mode');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Execute aggregation
   */
  async execute(context: ExecutionContext): Promise<NodeResult> {
    const startTime = Date.now();
    const results = context.inputs.results;

    // Validate input
    if (results === undefined || results === null) {
      return {
        success: false,
        outputs: {},
        error: new Error('results input is required'),
      };
    }

    if (!Array.isArray(results)) {
      return {
        success: false,
        outputs: {},
        error: new Error('results must be an array'),
      };
    }

    const {
      aggregationMode = 'concat',
      filterErrors = false,
      customAggregator,
    } = this.config;

    // Count statistics
    let successCount = 0;
    let errorCount = 0;

    for (const item of results) {
      if (this.isErrorResult(item)) {
        errorCount++;
      } else {
        successCount++;
      }
    }

    // Filter errors if requested
    let processedResults = results;
    if (filterErrors) {
      processedResults = results.filter((item) => !this.isErrorResult(item));
    }

    try {
      let aggregated: unknown;

      switch (aggregationMode) {
        case 'concat':
          aggregated = this.aggregateConcat(processedResults);
          break;
        case 'merge':
          aggregated = this.aggregateMerge(processedResults);
          break;
        case 'first':
          aggregated = processedResults[0];
          break;
        case 'last':
          aggregated = processedResults[processedResults.length - 1];
          break;
        case 'custom':
          if (!customAggregator) {
            return {
              success: false,
              outputs: {},
              error: new Error('customAggregator function is required for custom mode'),
            };
          }
          aggregated = customAggregator(processedResults, context);
          break;
        default:
          return {
            success: false,
            outputs: {},
            error: new Error(`Unknown aggregation mode: ${aggregationMode}`),
          };
      }

      return {
        success: true,
        outputs: {
          aggregated,
        },
        metadata: {
          duration: Date.now() - startTime,
          inputCount: results.length,
          successCount,
          errorCount,
          aggregationMode,
        },
      };
    } catch (error) {
      return {
        success: false,
        outputs: {},
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          duration: Date.now() - startTime,
          inputCount: results.length,
          successCount,
          errorCount,
        },
      };
    }
  }

  /**
   * Check if a result item contains an error
   */
  private isErrorResult(item: unknown): boolean {
    if (typeof item === 'object' && item !== null) {
      return 'error' in (item as ResultWithError);
    }
    return false;
  }

  /**
   * Concatenate array results
   */
  private aggregateConcat(results: unknown[]): unknown[] {
    const output: unknown[] = [];

    for (const item of results) {
      if (Array.isArray(item)) {
        output.push(...item);
      } else {
        output.push(item);
      }
    }

    return output;
  }

  /**
   * Merge object results
   */
  private aggregateMerge(results: unknown[]): Record<string, unknown> {
    const output: Record<string, unknown> = {};

    for (const item of results) {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        Object.assign(output, item);
      }
    }

    return output;
  }

  /**
   * Create AggregatorNode from JSON
   */
  static createFromJSON(json: {
    id: string;
    type: 'control:aggregator';
    label: string;
    position: { x: number; y: number };
    inputs: unknown[];
    outputs: unknown[];
    config: AggregatorNodeConfig;
  }): AggregatorNode {
    const node = new AggregatorNode(json.id, json.config);
    node.label = json.label;
    node.setPosition(json.position.x, json.position.y);
    return node;
  }
}

export default AggregatorNode;
