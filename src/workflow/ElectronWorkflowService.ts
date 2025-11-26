/**
 * ElectronWorkflowService
 *
 * Service layer for executing Rete.js workflows in Electron.
 * Bridges the gap between Electron IPC and ReteWorkflowExecutor.
 */

import { EventEmitter } from 'events';
import { WorkflowTransformer } from './WorkflowTransformer.js';
import { ReteWorkflowExecutor, type ExecutionResult, type ExecutionProgress, type ExecutionStatus } from './ReteWorkflowExecutor.js';
import type {
  ReteWorkflowJSON,
  Services,
  Utils,
  GlobalContext,
} from './types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Execution options for the service
 */
export interface WorkflowExecutionOptions {
  /** Initial prompt or instruction */
  prompt: string;
  /** Additional input data */
  [key: string]: unknown;
}

/**
 * Progress event data
 */
export interface ProgressEvent {
  /** Node ID */
  nodeId: string;
  /** Execution status */
  status: 'executing' | 'completed' | 'failed';
  /** Progress percentage (0-100) */
  progress?: number;
  /** Node outputs (on completion) */
  outputs?: unknown;
}

/**
 * Completion event data
 */
export interface CompletedEvent {
  /** Whether execution succeeded */
  success: boolean;
  /** Execution result */
  result?: unknown;
  /** Error message if failed */
  error?: string;
}

// ============================================================================
// ElectronWorkflowService
// ============================================================================

/**
 * Service for executing workflows in Electron context
 */
export class ElectronWorkflowService extends EventEmitter {
  private executor: ReteWorkflowExecutor | null = null;
  private currentStatus: ExecutionStatus = 'idle';
  private currentProgress: ExecutionProgress = {
    totalNodes: 0,
    completedNodes: 0,
    percentage: 0,
  };

  constructor() {
    super();
  }

  /**
   * Execute a workflow
   */
  async execute(
    workflow: ReteWorkflowJSON,
    options: WorkflowExecutionOptions
  ): Promise<ExecutionResult> {
    // Validate workflow has nodes
    if (!workflow.nodes || workflow.nodes.length === 0) {
      const error = new Error('Workflow has no nodes');
      this.emit('completed', { success: false, error: error.message });
      return {
        success: false,
        executionId: this.generateExecutionId(),
        executedNodes: [],
        outputs: {},
        duration: 0,
        error,
      };
    }

    try {
      // Transform workflow to executable format
      const transformedWorkflow = WorkflowTransformer.transform(workflow);

      // Create executor
      this.executor = new ReteWorkflowExecutor({
        maxConcurrency: 4,
        timeout: 300000, // 5 minutes
        retryPolicy: {
          maxRetries: 2,
          retryDelay: 1000,
        },
      });

      // Set up event forwarding
      this.setupEventListeners();

      // Create execution context
      const executionId = this.generateExecutionId();
      const executionOptions = this.createExecutionOptions(options, executionId);

      // Update status
      this.currentStatus = 'running';
      this.currentProgress = {
        totalNodes: workflow.nodes.length,
        completedNodes: 0,
        percentage: 0,
      };

      // Execute workflow
      const result = await this.executor.execute(transformedWorkflow, executionOptions);

      // Update status
      this.currentStatus = result.success ? 'completed' : 'failed';
      this.currentProgress.percentage = 100;

      // Emit completion event
      this.emit('completed', {
        success: result.success,
        result: result.outputs,
        error: result.error?.message,
      });

      return result;
    } catch (error) {
      const err = error as Error;
      this.currentStatus = 'failed';

      this.emit('completed', {
        success: false,
        error: err.message,
      });

      return {
        success: false,
        executionId: this.generateExecutionId(),
        executedNodes: [],
        outputs: {},
        duration: 0,
        error: err,
      };
    }
  }

  /**
   * Cancel the current execution
   */
  cancel(): void {
    if (this.executor) {
      this.executor.cancel();
      this.currentStatus = 'cancelled';
    }
  }

  /**
   * Get current execution status
   */
  getStatus(): ExecutionStatus {
    return this.currentStatus;
  }

  /**
   * Get current execution progress
   */
  getProgress(): ExecutionProgress {
    if (this.executor) {
      return this.executor.getProgress();
    }
    return this.currentProgress;
  }

  /**
   * Set up event listeners to forward executor events
   */
  private setupEventListeners(): void {
    if (!this.executor) return;

    this.executor.on('node-started', (event) => {
      this.emit('progress', {
        nodeId: event.nodeId,
        status: 'executing',
        progress: this.calculateProgress(),
      });
    });

    this.executor.on('node-completed', (event) => {
      this.currentProgress.completedNodes++;
      this.emit('progress', {
        nodeId: event.nodeId,
        status: 'completed',
        progress: this.calculateProgress(),
        outputs: event.data,
      });
    });

    this.executor.on('node-failed', (event) => {
      this.emit('progress', {
        nodeId: event.nodeId,
        status: 'failed',
        progress: this.calculateProgress(),
      });
    });
  }

  /**
   * Calculate current progress percentage
   */
  private calculateProgress(): number {
    if (this.currentProgress.totalNodes === 0) return 0;
    return Math.round(
      (this.currentProgress.completedNodes / this.currentProgress.totalNodes) * 100
    );
  }

  /**
   * Create execution options for the executor
   * Note: Uses type assertions for mock implementations
   */
  private createExecutionOptions(
    options: WorkflowExecutionOptions,
    executionId: string
  ): {
    services: Services;
    utils: Utils;
    globalContext: GlobalContext;
    initialInputs: Record<string, unknown>;
  } {
    const logger = this.createLogger();

    // Create mock services for now
    // In real implementation, these would be injected or configured
    const services = {
      aiProvider: this.createMockAIProvider(),
      gitManager: this.createMockGitManager(),
      stateManager: this.createMockStateManager(),
      dataPersistence: this.createMockDataPersistence(),
    } as Services;

    const utils = {
      logger,
      emit: (event: string, data: unknown) => this.emit(event, data),
      memoryMonitor: this.createMockMemoryMonitor(),
    } as Utils;

    const globalContext = {
      workflowId: `workflow-${Date.now()}`,
      executionId,
      projectPath: process.cwd(),
      baseBranch: 'main',
      startedAt: new Date(),
      userSettings: {},
    } as GlobalContext;

    // Extract initial inputs from options
    const { prompt, ...additionalInputs } = options;
    const initialInputs: Record<string, unknown> = {
      prompt,
      ...additionalInputs,
    };

    return { services, utils, globalContext, initialInputs };
  }

  /**
   * Create a mock AI provider for testing
   * In production, this would be replaced with actual AI provider
   */
  private createMockAIProvider() {
    return {
      query: async (queryOptions: { prompt: string; options?: Record<string, unknown> }) => ({
        finalState: { response: `Mock response for: ${queryOptions.prompt}` },
        duration: 100,
        turns: 1,
        tokensUsed: 50,
        fileChanges: [],
      }),
    };
  }

  /**
   * Create a mock git worktree manager
   */
  private createMockGitManager() {
    return {
      createWorktree: async () => ({
        path: '/tmp/mock-worktree',
        branchName: 'mock-branch',
      }),
      removeWorktree: async () => {},
      merge: async () => ({
        success: true,
        hasConflict: false,
      }),
      deleteBranch: async () => {},
    };
  }

  /**
   * Create a mock state stream manager
   */
  private createMockStateManager() {
    return {
      emit: (event: string, data: unknown) => this.emit(event, data),
      subscribe: () => () => {},
    };
  }

  /**
   * Create a mock data persistence service
   */
  private createMockDataPersistence() {
    return {
      saveWorkflowResult: async () => {},
      loadWorkflowResult: async () => null,
    };
  }

  /**
   * Create a mock memory monitor
   */
  private createMockMemoryMonitor() {
    return {
      getUsage: () => ({
        heapUsed: process.memoryUsage?.()?.heapUsed || 0,
        heapTotal: process.memoryUsage?.()?.heapTotal || 0,
        rss: process.memoryUsage?.()?.rss || 0,
      }),
      checkThreshold: () => false,
    };
  }

  /**
   * Create a logger
   */
  private createLogger() {
    return {
      info: (message: string, ...args: unknown[]) => console.log(`[INFO] ${message}`, ...args),
      warn: (message: string, ...args: unknown[]) => console.warn(`[WARN] ${message}`, ...args),
      error: (message: string, ...args: unknown[]) => console.error(`[ERROR] ${message}`, ...args),
      debug: (message: string, ...args: unknown[]) => console.debug(`[DEBUG] ${message}`, ...args),
    };
  }

  /**
   * Generate a unique execution ID
   */
  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default ElectronWorkflowService;
