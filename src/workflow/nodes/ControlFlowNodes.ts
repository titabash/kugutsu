/**
 * Control Flow Nodes
 *
 * Provides basic workflow control nodes: StartNode, EndNode, DecisionNode, DataTransformNode
 */

import {
  BaseWorkflowNode,
  type NodeConfig,
  type ExecutionContext,
  type NodeResult,
  type ValidationResult,
} from './BaseWorkflowNode.js';

// ============================================================================
// StartNode
// ============================================================================

/**
 * StartNode - Entry point for workflow execution
 *
 * Passes initial input data to the workflow.
 */
export class StartNode extends BaseWorkflowNode {
  constructor(id: string, config: NodeConfig = {}) {
    super({
      id,
      type: 'io:start',
      label: 'Start',
      description: 'Workflow entry point',
      inputs: [], // No inputs - this is the start
      outputs: [
        {
          id: 'default',
          name: 'Output',
          type: 'control',
          required: true,
        },
      ],
      config,
    });
  }

  async execute(context: ExecutionContext): Promise<NodeResult> {
    // Pass through any initial input
    const initialInput = context.inputs.default ?? context.inputs;

    // Build outputs: default contains all inputs, plus each key is also an output
    // This allows flexible connection: connect to 'default' for all, or specific key
    const outputs: Record<string, unknown> = {
      default: initialInput,
    };

    // Also expose each key as individual output for direct mapping
    if (typeof initialInput === 'object' && initialInput !== null) {
      Object.entries(initialInput as Record<string, unknown>).forEach(([key, value]) => {
        outputs[key] = value;
      });
    }

    return {
      success: true,
      outputs,
    };
  }

  validate(): ValidationResult {
    // Start node is always valid (no inputs required)
    return {
      valid: true,
      errors: [],
    };
  }
}

// ============================================================================
// EndNode
// ============================================================================

/**
 * End node configuration
 */
interface EndNodeConfig extends NodeConfig {
  onComplete?: {
    saveResult?: boolean;
    notify?: boolean;
  };
}

/**
 * EndNode - Terminal point for workflow execution
 *
 * Captures the final workflow result.
 */
export class EndNode extends BaseWorkflowNode {
  declare config: EndNodeConfig;

  constructor(id: string, config: EndNodeConfig = {}) {
    super({
      id,
      type: 'io:end',
      label: 'End',
      description: 'Workflow exit point',
      inputs: [
        {
          id: 'default',
          name: 'Input',
          type: 'any',
          required: true,
        },
      ],
      outputs: [], // No outputs - this is the end
      config,
    });
  }

  async execute(context: ExecutionContext): Promise<NodeResult> {
    const finalResult = context.inputs.default;

    // Optionally save result
    if (this.config.onComplete?.saveResult && finalResult !== undefined) {
      await context.services.dataPersistence.saveWorkflowResult(
        context.global.executionId,
        finalResult
      );
    }

    return {
      success: true,
      outputs: {},
      metadata: {
        duration: 0,
        finalResult: finalResult,
      },
    };
  }
}

// ============================================================================
// DecisionNode
// ============================================================================

/**
 * Decision node configuration
 */
interface DecisionNodeConfig extends NodeConfig {
  condition?: string;
}

/**
 * DecisionNode - Conditional branching
 *
 * Evaluates a condition and routes data to true or false output.
 */
export class DecisionNode extends BaseWorkflowNode {
  declare config: DecisionNodeConfig;

  constructor(id: string, config: DecisionNodeConfig = {}) {
    super({
      id,
      type: 'control:decision',
      label: 'Decision',
      description: 'Conditional branching based on expression',
      inputs: [
        {
          id: 'input',
          name: 'Input',
          type: 'any',
          required: true,
        },
      ],
      outputs: [
        {
          id: 'true',
          name: 'True',
          type: 'control',
          required: false,
        },
        {
          id: 'false',
          name: 'False',
          type: 'control',
          required: false,
        },
      ],
      config,
    });
  }

  async execute(context: ExecutionContext): Promise<NodeResult> {
    const input = context.inputs.input;

    try {
      // Evaluate the condition
      const condition = this.config.condition;
      if (!condition) {
        throw new Error('No condition specified');
      }

      // Create a safe evaluation function
      // Note: In production, consider using a proper expression parser
      const evalFunction = new Function('input', `return ${condition}`);
      const result = evalFunction(input);

      if (result) {
        return {
          success: true,
          outputs: {
            true: input,
          },
        };
      } else {
        return {
          success: true,
          outputs: {
            false: input,
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        outputs: {},
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  validate(): ValidationResult {
    const baseResult = super.validate();
    const errors = [...baseResult.errors];

    // Check condition is specified
    if (!this.config.condition) {
      errors.push('Decision node requires a condition');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// ============================================================================
// DataTransformNode
// ============================================================================

/**
 * Transform type options
 */
type TransformType = 'map' | 'filter' | 'reduce' | 'custom';

/**
 * Data transform node configuration
 */
interface DataTransformNodeConfig extends NodeConfig {
  transformType?: TransformType;
  transformFunction?: string;
}

/**
 * DataTransformNode - Data transformation
 *
 * Transforms input data using specified function.
 */
export class DataTransformNode extends BaseWorkflowNode {
  declare config: DataTransformNodeConfig;

  constructor(id: string, config: DataTransformNodeConfig = {}) {
    super({
      id,
      type: 'io:transform',
      label: 'Data Transform',
      description: 'Transform input data',
      inputs: [
        {
          id: 'input',
          name: 'Input',
          type: 'data',
          dataType: 'any',
          required: true,
        },
      ],
      outputs: [
        {
          id: 'output',
          name: 'Output',
          type: 'data',
          dataType: 'any',
          required: true,
        },
      ],
      config,
    });
  }

  async execute(context: ExecutionContext): Promise<NodeResult> {
    const input = context.inputs.input;

    try {
      const transformFunction = this.config.transformFunction;

      if (!transformFunction) {
        throw new Error('Transform function is required');
      }

      // Execute the transform function
      const evalFunction = new Function('input', transformFunction);
      const output = evalFunction(input);

      return {
        success: true,
        outputs: {
          output,
        },
      };
    } catch (error) {
      return {
        success: false,
        outputs: {},
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  validate(): ValidationResult {
    const baseResult = super.validate();
    const errors = [...baseResult.errors];

    // Check transform type is specified
    if (!this.config.transformType) {
      errors.push('Transform type is required');
    }

    // Check transform function for custom type
    if (this.config.transformType === 'custom' && !this.config.transformFunction) {
      errors.push('Transform function is required for custom transform');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
