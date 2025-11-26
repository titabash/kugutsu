/**
 * BaseWorkflowNode - Abstract base class for all workflow nodes
 *
 * This class provides the foundation for all nodes in the Rete.js visual workflow editor.
 * It handles common functionality like validation, serialization, and position management.
 */

import type {
  NodeType,
  NodeSocket,
  NodeConfig,
  ExecutionContext,
  NodeResult,
  ValidationResult,
  WorkflowNodeJSON,
  NodePosition,
  GlobalContext,
  Services,
  Utils,
  Logger,
  IAIProviderForWorkflow,
  IGitWorktreeManager,
  IStateStreamManager,
  IDataPersistence,
  IMemoryMonitor,
} from '../types.js';

// Re-export types for convenience
export type {
  NodeType,
  NodeSocket,
  NodeConfig,
  ExecutionContext,
  NodeResult,
  ValidationResult,
  WorkflowNodeJSON,
};

/**
 * Options for creating a BaseWorkflowNode
 */
export interface BaseWorkflowNodeOptions {
  /** Unique node ID */
  id: string;
  /** Node type */
  type: NodeType;
  /** Display label */
  label: string;
  /** Optional description */
  description?: string;
  /** Input sockets */
  inputs: NodeSocket[];
  /** Output sockets */
  outputs: NodeSocket[];
  /** Node configuration */
  config: NodeConfig;
}

/**
 * Abstract base class for all workflow nodes
 */
export abstract class BaseWorkflowNode {
  /** Unique node identifier */
  public readonly id: string;

  /** Node type */
  public readonly type: NodeType;

  /** Display label */
  public label: string;

  /** Optional description */
  public description?: string;

  /** Input socket definitions */
  public readonly inputs: NodeSocket[];

  /** Output socket definitions */
  public readonly outputs: NodeSocket[];

  /** Node configuration */
  public config: NodeConfig;

  /** Node position in editor */
  private position: NodePosition = { x: 0, y: 0 };

  /** Connected input socket IDs (for validation) */
  private connectedInputs: Set<string> = new Set();

  constructor(options: BaseWorkflowNodeOptions) {
    this.id = options.id;
    this.type = options.type;
    this.label = options.label;
    this.description = options.description;
    this.inputs = options.inputs;
    this.outputs = options.outputs;
    this.config = options.config;
  }

  /**
   * Execute the node with the given context
   * Must be implemented by subclasses
   */
  abstract execute(context: ExecutionContext): Promise<NodeResult>;

  /**
   * Validate the node configuration and connections
   */
  validate(): ValidationResult {
    const errors: string[] = [];

    // Check required inputs have connections
    for (const input of this.inputs) {
      if (input.required && !this.connectedInputs.has(input.id)) {
        errors.push(`Required input '${input.name}' is not connected`);
      }
    }

    // Validate AI config if present
    if (this.config.ai) {
      if (
        this.config.ai.maxTurns !== undefined &&
        this.config.ai.maxTurns < 1
      ) {
        errors.push('maxTurns must be >= 1');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Serialize node to JSON for storage/transfer
   */
  toJSON(): WorkflowNodeJSON {
    return {
      id: this.id,
      type: this.type,
      label: this.label,
      description: this.description,
      position: { ...this.position },
      inputs: this.inputs.map((input) => ({ ...input })),
      outputs: this.outputs.map((output) => ({ ...output })),
      config: { ...this.config },
    };
  }

  /**
   * Deserialize node from JSON
   * Creates a new instance of the specified node class
   */
  static fromJSON<T extends BaseWorkflowNode>(
    json: WorkflowNodeJSON,
    NodeClass: new (id: string, config: NodeConfig) => T
  ): T {
    const node = new NodeClass(json.id, json.config);
    node.label = json.label;
    node.description = json.description;
    node.setPosition(json.position.x, json.position.y);
    return node;
  }

  /**
   * Set the node's position in the editor
   */
  setPosition(x: number, y: number): void {
    this.position = { x, y };
  }

  /**
   * Get the node's position in the editor
   */
  getPosition(): NodePosition {
    return { ...this.position };
  }

  /**
   * Set which inputs are connected (for validation)
   */
  setConnectedInputs(inputIds: string[]): void {
    this.connectedInputs = new Set(inputIds);
  }

  /**
   * Check if an input socket exists
   */
  hasInput(id: string): boolean {
    return this.inputs.some((input) => input.id === id);
  }

  /**
   * Check if an output socket exists
   */
  hasOutput(id: string): boolean {
    return this.outputs.some((output) => output.id === id);
  }

  /**
   * Get an input socket by ID
   */
  getInput(id: string): NodeSocket | undefined {
    return this.inputs.find((input) => input.id === id);
  }

  /**
   * Get an output socket by ID
   */
  getOutput(id: string): NodeSocket | undefined {
    return this.outputs.find((output) => output.id === id);
  }

  /**
   * Get the default value for an input
   */
  getInputDefaultValue(id: string): unknown {
    const input = this.getInput(id);
    return input?.defaultValue;
  }

  /**
   * Check if a connection is valid for an input socket
   */
  isValidConnection(inputId: string, _sourceType: string): boolean {
    const input = this.getInput(inputId);
    if (!input) return false;

    // 'any' type accepts all connections
    if (input.type === 'any') return true;

    // For now, allow all connections (can be enhanced with type checking)
    return true;
  }
}

/**
 * Create a mock execution context for testing
 */
export function createMockExecutionContext(
  overrides: {
    inputs?: Record<string, unknown>;
    global?: Partial<GlobalContext>;
    services?: Partial<Services>;
    utils?: Partial<Utils>;
  } = {}
): ExecutionContext {
  const mockLogger: Logger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  };

  const mockAIProvider: IAIProviderForWorkflow = {
    async query() {
      return {
        finalState: {},
        duration: 100,
        turns: 1,
      };
    },
  };

  const mockGitManager: IGitWorktreeManager = {
    async createWorktree(options) {
      return {
        path: `/tmp/worktree-${options.branchName}`,
        branchName: options.branchName,
      };
    },
    async removeWorktree() {},
    async merge() {
      return { success: true, hasConflict: false };
    },
    async deleteBranch() {},
  };

  const mockStateManager: IStateStreamManager = {
    emit: () => {},
    subscribe: () => () => {},
  };

  const mockDataPersistence: IDataPersistence = {
    async saveWorkflowResult() {},
    async loadWorkflowResult() {
      return null;
    },
  };

  const mockMemoryMonitor: IMemoryMonitor = {
    getUsage: () => ({
      heapUsed: 0,
      heapTotal: 0,
      rss: 0,
    }),
    checkThreshold: () => true,
  };

  return {
    inputs: overrides.inputs ?? {},
    global: {
      workflowId: 'test-workflow',
      executionId: 'test-execution',
      projectPath: '/tmp/test-project',
      baseBranch: 'main',
      startedAt: new Date(),
      userSettings: {},
      ...overrides.global,
    },
    services: {
      aiProvider: overrides.services?.aiProvider ?? mockAIProvider,
      gitManager: overrides.services?.gitManager ?? mockGitManager,
      stateManager: overrides.services?.stateManager ?? mockStateManager,
      dataPersistence:
        overrides.services?.dataPersistence ?? mockDataPersistence,
    },
    utils: {
      logger: overrides.utils?.logger ?? mockLogger,
      emit: overrides.utils?.emit ?? (() => {}),
      memoryMonitor: overrides.utils?.memoryMonitor ?? mockMemoryMonitor,
    },
  };
}
