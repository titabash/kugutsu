/**
 * Rete.js Workflow Types
 *
 * Defines all types for the visual workflow editor nodes and execution context.
 */

// ============================================================================
// Socket Types
// ============================================================================

/**
 * Socket type definition for node inputs/outputs
 */
export type SocketType = 'data' | 'control' | 'any';

/**
 * Data type for socket values
 */
export type DataType = 'string' | 'object' | 'array' | 'number' | 'boolean' | 'any';

/**
 * Validation rule for socket values
 */
export interface ValidationRule {
  /** Minimum value (for numbers) */
  min?: number;
  /** Maximum value (for numbers) */
  max?: number;
  /** Regex pattern (for strings) */
  pattern?: string;
  /** Custom validation function */
  custom?: (value: unknown) => boolean;
}

/**
 * Node socket definition
 */
export interface NodeSocket {
  /** Socket ID */
  id: string;
  /** Display name */
  name: string;
  /** Socket type */
  type: SocketType;
  /** Data type (optional) */
  dataType?: DataType;
  /** Whether this socket is required */
  required: boolean;
  /** Default value (optional) */
  defaultValue?: unknown;
  /** Validation rules (optional) */
  validation?: ValidationRule;
}

// ============================================================================
// Node Types
// ============================================================================

/**
 * Base node type enum
 */
export type NodeType =
  // IO Nodes (full and short forms)
  | 'io:start'
  | 'io:end'
  | 'io:transform'
  | 'start'
  | 'end'
  | 'transform'
  // Control Flow Nodes (full and short forms)
  | 'control:decision'
  | 'control:parallel'
  | 'control:aggregator'
  | 'control:group'
  | 'control:loop'
  | 'control:parallel-group'
  | 'decision'
  | 'parallel'
  | 'aggregator'
  | 'group'
  | 'loop'
  | 'parallel-group'
  // AI Task Nodes
  | 'ai:custom'
  | 'preset:engineer'
  | 'preset:reviewer'
  | 'preset:product-owner'
  | 'preset:merge-coordinator'
  | 'preset:conflict-resolver'
  | 'preset:test-runner'
  | 'preset:director'
  | 'preset:sprint-planning'
  // Git Operation Nodes
  | 'git:merge'
  | 'git:conflict-resolver'
  | 'git:branch-manager';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * AI configuration for AI task nodes
 */
export interface AIConfig {
  /** AI provider */
  provider: 'claude' | 'openai' | 'gemini' | 'auto';
  /** Model name */
  model?: string;
  /** Main prompt */
  prompt?: string;
  /** System prompt */
  systemPrompt?: string;
  /** Maximum turns */
  maxTurns?: number;
  /** Allowed tools */
  allowedTools?: string[];
  /** Temperature parameter */
  temperature?: number;
  /** Top P parameter */
  topP?: number;
}

/**
 * Parallelism configuration
 */
export interface ParallelismConfig {
  /** Enable parallel execution */
  enabled: boolean;
  /** Maximum concurrency */
  maxConcurrency?: number;
  /** Use Git worktree for isolation */
  useWorktree?: boolean;
  /** Branch prefix for worktrees */
  branchPrefix?: string;
  /** Cleanup worktrees after execution */
  cleanupAfter?: boolean;
}

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  /** Maximum retry attempts */
  maxRetries: number;
  /** Delay between retries (ms) */
  retryDelay: number;
  /** Use exponential backoff */
  exponentialBackoff?: boolean;
}

/**
 * Node configuration
 */
export interface NodeConfig {
  /** AI execution settings */
  ai?: AIConfig;
  /** Parallelism settings */
  parallelism?: ParallelismConfig;
  /** Timeout (ms) */
  timeout?: number;
  /** Retry policy */
  retryPolicy?: RetryPolicy;
  /** Custom settings (extensible) */
  [key: string]: unknown;
}

// ============================================================================
// Execution Context Types
// ============================================================================

/**
 * Logger interface
 */
export interface Logger {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
}

/**
 * Global execution context
 */
export interface GlobalContext {
  /** Workflow ID */
  workflowId: string;
  /** Execution ID */
  executionId: string;
  /** Project path */
  projectPath: string;
  /** Base branch */
  baseBranch: string;
  /** Execution start time */
  startedAt: Date;
  /** User settings */
  userSettings: Record<string, unknown>;
}

/**
 * AI Provider interface (simplified for workflow nodes)
 */
export interface IAIProviderForWorkflow {
  query(options: {
    prompt: string;
    options?: {
      model?: string;
      systemPrompt?: string;
      maxTurns?: number;
      allowedTools?: string[];
      temperature?: number;
      topP?: number;
      /** Working directory for tool execution */
      cwd?: string;
    };
  }): Promise<{
    finalState: unknown;
    duration: number;
    turns: number;
    tokensUsed?: number;
    fileChanges?: unknown[];
  }>;
}

/**
 * Git worktree information
 */
export interface WorktreeInfo {
  path: string;
  branchName: string;
}

/**
 * Git worktree manager interface (simplified)
 */
export interface IGitWorktreeManager {
  createWorktree(options: {
    branchName: string;
    baseBranch: string;
  }): Promise<WorktreeInfo>;

  removeWorktree(path: string): Promise<void>;

  merge(options: {
    source: string;
    sourceBranch?: string;
    target: string;
    targetBranch?: string;
    strategy: 'merge' | 'rebase';
  }): Promise<{
    success: boolean;
    hasConflict: boolean;
    conflictFiles?: string[];
    conflictDetails?: Array<{
      file: string;
      content: string;
      ours: string;
      theirs: string;
    }>;
  }>;

  deleteBranch(branchName: string): Promise<void>;

  /**
   * Stage files for commit (git add)
   */
  stageFiles(files: string[], repoPath?: string): Promise<void>;

  /**
   * Complete a merge commit (git commit --no-edit)
   */
  commitMerge(repoPath?: string): Promise<void>;
}

/**
 * State stream manager interface (simplified)
 */
export interface IStateStreamManager {
  emit(event: string, data: unknown): void;
  subscribe(event: string, callback: (data: unknown) => void): () => void;
}

/**
 * Data persistence interface (simplified)
 */
export interface IDataPersistence {
  saveWorkflowResult(executionId: string, result: unknown): Promise<void>;
  loadWorkflowResult(executionId: string): Promise<unknown>;
}

/**
 * Memory monitor interface (simplified)
 */
export interface IMemoryMonitor {
  getUsage(): { heapUsed: number; heapTotal: number; rss: number };
  checkThreshold(): boolean;
}

/**
 * Services available in execution context
 */
export interface Services {
  /** AI provider */
  aiProvider: IAIProviderForWorkflow;
  /** Git worktree manager */
  gitManager: IGitWorktreeManager;
  /** State stream manager */
  stateManager: IStateStreamManager;
  /** Data persistence */
  dataPersistence: IDataPersistence;
}

/**
 * Utilities available in execution context
 */
export interface Utils {
  /** Logger */
  logger: Logger;
  /** Event emitter */
  emit: (event: string, data: unknown) => void;
  /** Memory monitor */
  memoryMonitor: IMemoryMonitor;
}

/**
 * Execution context passed to node execute method
 */
export interface ExecutionContext {
  /** Input data from connected nodes */
  inputs: Record<string, unknown>;
  /** Global context */
  global: GlobalContext;
  /** Services */
  services: Services;
  /** Utilities */
  utils: Utils;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Error messages if invalid */
  errors: string[];
}

/**
 * Result metadata
 */
export interface ResultMetadata {
  /** Execution duration (ms) */
  duration: number;
  /** Number of AI calls */
  aiCalls?: number;
  /** Tokens used */
  tokensUsed?: number;
  /** Custom metadata */
  [key: string]: unknown;
}

/**
 * Node execution result
 */
export interface NodeResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Output data */
  outputs: Record<string, unknown>;
  /** Error if failed */
  error?: Error;
  /** Metadata */
  metadata?: ResultMetadata;
}

// ============================================================================
// Serialization Types
// ============================================================================

/**
 * Node position in editor
 */
export interface NodePosition {
  x: number;
  y: number;
}

/**
 * Serialized workflow node
 */
export interface WorkflowNodeJSON {
  /** Node ID */
  id: string;
  /** Node type */
  type: NodeType;
  /** Display label */
  label: string;
  /** Description */
  description?: string;
  /** Position in editor */
  position: NodePosition;
  /** Input sockets */
  inputs: NodeSocket[];
  /** Output sockets */
  outputs: NodeSocket[];
  /** Node configuration */
  config: NodeConfig;
}

/**
 * Serialized connection
 */
export interface ConnectionJSON {
  /** Connection ID */
  id: string;
  /** Source node ID */
  source: string;
  /** Source output socket ID */
  sourceOutput: string;
  /** Target node ID */
  target: string;
  /** Target input socket ID */
  targetInput: string;
  /** Condition for conditional edges */
  condition?: string;
  /** Alternate target for false condition */
  alternateTarget?: string;
}

/**
 * Serialized node group
 */
export interface GroupJSON {
  /** Group ID */
  id: string;
  /** Node IDs in this group */
  nodeIds: string[];
  /** Group label */
  label?: string;
}

/**
 * Workflow metadata
 */
export interface WorkflowMetadata {
  /** Workflow name */
  name: string;
  /** Description */
  description?: string;
  /** Author */
  author?: string;
  /** Created timestamp */
  createdAt: string;
  /** Updated timestamp */
  updatedAt: string;
  /** Tags */
  tags?: string[];
}

/**
 * Workflow edge JSON (alias for ConnectionJSON)
 */
export type WorkflowEdgeJSON = ConnectionJSON;

/**
 * Serialized workflow
 */
export interface ReteWorkflowJSON {
  /** Workflow ID */
  id?: string;
  /** Workflow name (shorthand for metadata.name) */
  name?: string;
  /** Schema version */
  version: string;
  /** Workflow metadata */
  metadata: WorkflowMetadata;
  /** Nodes */
  nodes: WorkflowNodeJSON[];
  /** Connections */
  connections: ConnectionJSON[];
  /** Edges (alias for connections) */
  edges?: ConnectionJSON[];
  /** Groups (for subgraph parallelization) */
  groups?: GroupJSON[];
  /** Entry node ID */
  entryNodeId: string;
  /** Exit node ID */
  exitNodeId: string;
}
