/**
 * AI Provider Abstraction Layer
 *
 * Provides a unified interface for different AI providers (Claude Agent SDK, OpenAI Codex SDK)
 */

/**
 * Message type returned by AI providers
 */
export interface AIMessage {
  /**
   * Type of message
   */
  type: 'assistant' | 'user' | 'system' | 'result' | 'partial';

  /**
   * Message content (varies by type)
   */
  content: any;

  /**
   * Session ID for continuing conversations
   */
  session_id?: string;

  /**
   * Unique message identifier
   */
  uuid?: string;

  /**
   * Timestamp when message was created
   */
  timestamp?: Date;

  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Options for executing AI prompts
 */
export interface ExecuteOptions {
  /**
   * Maximum number of conversation turns
   */
  maxTurns?: number;

  /**
   * Working directory for file operations
   */
  cwd?: string;

  /**
   * List of allowed tools
   */
  allowedTools?: string[];

  /**
   * List of disallowed tools
   */
  disallowedTools?: string[];

  /**
   * Permission mode for tool execution
   * - default: Ask user for permission
   * - acceptEdits: Automatically accept file edits
   * - bypassPermissions: Bypass all permission checks
   * - plan: Planning mode (no actual changes)
   */
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';

  /**
   * Resume from a previous session
   */
  resume?: string;

  /**
   * Model to use (provider-specific)
   */
  model?: string;

  /**
   * Custom system prompt
   */
  systemPrompt?: string;

  /**
   * Include partial messages in stream
   */
  includePartialMessages?: boolean;

  /**
   * Additional provider-specific options
   */
  providerOptions?: Record<string, any>;
}

/**
 * AI Provider Interface
 *
 * All AI providers must implement this interface
 */
export interface IAIProvider {
  /**
   * Execute a prompt and return an async iterator of messages
   *
   * @param prompt - The prompt to execute
   * @param options - Execution options
   * @returns AsyncIterable of AI messages
   */
  execute(
    prompt: string,
    options?: ExecuteOptions
  ): AsyncIterable<AIMessage>;

  /**
   * Resume a previous session
   *
   * @param sessionId - Session ID to resume
   */
  resumeSession(sessionId: string): void;

  /**
   * Get list of supported tools
   *
   * @returns Array of tool names
   */
  getSupportedTools(): string[];

  /**
   * Get the provider name
   *
   * @returns Provider name (e.g., "claude", "codex")
   */
  getProviderName(): string;

  /**
   * Get the current model being used
   *
   * @returns Model identifier
   */
  getModel(): string;

  /**
   * Check if the provider is ready to use
   *
   * @returns true if ready, false otherwise
   */
  isReady(): boolean;
}

/**
 * Configuration for AI Provider
 */
export interface AIProviderConfig {
  /**
   * Provider type
   */
  provider: 'claude' | 'codex' | 'mock';

  /**
   * Claude-specific configuration
   */
  claude?: {
    apiKey?: string;
    model?: string;
  };

  /**
   * OpenAI Codex-specific configuration
   */
  codex?: {
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  };
}

/**
 * Result metadata from AI execution
 */
export interface ExecutionResult {
  /**
   * Session ID
   */
  sessionId: string;

  /**
   * Total duration in milliseconds
   */
  duration: number;

  /**
   * Token usage statistics
   */
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };

  /**
   * Cost in USD (if available)
   */
  cost?: number;

  /**
   * Number of permission denials
   */
  permissionDenials?: number;

  /**
   * Whether the execution completed successfully
   */
  success: boolean;

  /**
   * Error message if execution failed
   */
  error?: string;
}
