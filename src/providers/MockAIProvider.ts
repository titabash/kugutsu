/**
 * Mock AI Provider
 *
 * Mock implementation for testing without calling actual AI APIs
 */

import type { IAIProvider, AIMessage, ExecuteOptions } from './IAIProvider.js';

/**
 * Mock response configuration
 */
export interface MockResponse {
  /**
   * Messages to return
   */
  messages: AIMessage[];

  /**
   * Delay in milliseconds (optional)
   */
  delay?: number;

  /**
   * Should throw error (optional)
   */
  shouldThrowError?: boolean;

  /**
   * Error message (if shouldThrowError is true)
   */
  errorMessage?: string;
}

/**
 * Mock AI Provider
 *
 * Used for testing without calling actual AI APIs
 */
export class MockAIProvider implements IAIProvider {
  private mockResponses: Map<string, MockResponse> = new Map();
  private callCount: number = 0;
  private lastPrompt: string = '';
  private lastOptions: ExecuteOptions = {};

  constructor() {}

  /**
   * Set mock response for a specific prompt pattern
   */
  setMockResponse(promptPattern: string | RegExp, response: MockResponse): void {
    const key = promptPattern instanceof RegExp ? promptPattern.source : promptPattern;
    this.mockResponses.set(key, response);
  }

  /**
   * Set default mock response (fallback)
   */
  setDefaultResponse(response: MockResponse): void {
    this.mockResponses.set('__default__', response);
  }

  /**
   * Execute mock prompt
   */
  async *execute(prompt: string, options: ExecuteOptions = {}): AsyncIterable<AIMessage> {
    this.callCount++;
    this.lastPrompt = prompt;
    this.lastOptions = options;

    // Find matching response
    let response: MockResponse | undefined;

    for (const [pattern, resp] of this.mockResponses.entries()) {
      if (pattern === '__default__') continue;

      const regex = new RegExp(pattern);
      if (regex.test(prompt)) {
        response = resp;
        break;
      }
    }

    // Use default if no match
    if (!response) {
      response = this.mockResponses.get('__default__');
    }

    // If still no response, return empty
    if (!response) {
      console.warn(`MockAIProvider: No response configured for prompt: ${prompt.substring(0, 100)}`);
      return;
    }

    // Throw error if configured
    if (response.shouldThrowError) {
      throw new Error(response.errorMessage || 'Mock error');
    }

    // Add delay if configured
    if (response.delay) {
      await new Promise((resolve) => setTimeout(resolve, response.delay));
    }

    // Yield messages
    for (const message of response.messages) {
      yield message;
    }
  }

  /**
   * Resume session (mock)
   */
  resumeSession(sessionId: string): void {
    // Mock implementation
  }

  /**
   * Get supported tools
   */
  getSupportedTools(): string[] {
    return ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'];
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return 'mock';
  }

  /**
   * Get model
   */
  getModel(): string {
    return 'mock-model';
  }

  /**
   * Check if ready
   */
  isReady(): boolean {
    return true;
  }

  /**
   * Get call count (for testing)
   */
  getCallCount(): number {
    return this.callCount;
  }

  /**
   * Get last prompt (for testing)
   */
  getLastPrompt(): string {
    return this.lastPrompt;
  }

  /**
   * Get last options (for testing)
   */
  getLastOptions(): ExecuteOptions {
    return this.lastOptions;
  }

  /**
   * Reset mock state
   */
  reset(): void {
    this.callCount = 0;
    this.lastPrompt = '';
    this.lastOptions = {};
  }
}

/**
 * Create mock AI message helpers
 */
export const createMockMessage = {
  /**
   * Create assistant message
   */
  assistant(content: any, sessionId?: string): AIMessage {
    return {
      type: 'assistant',
      content,
      session_id: sessionId || 'mock-session-id',
      timestamp: new Date(),
    };
  },

  /**
   * Create result message
   */
  result(success: boolean = true): AIMessage {
    return {
      type: 'result',
      content: {
        duration: 100,
        tokenUsage: { input: 10, output: 20, total: 30 },
        cost: 0.001,
        permissionDenials: 0,
        success,
      },
      session_id: 'mock-session-id',
      timestamp: new Date(),
    };
  },

  /**
   * Create system message
   */
  system(content: any): AIMessage {
    return {
      type: 'system',
      content,
      timestamp: new Date(),
    };
  },
};
