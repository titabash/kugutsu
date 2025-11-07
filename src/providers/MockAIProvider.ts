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

  /**
   * Enable tool simulation (optional)
   *
   * When enabled, MockAIProvider will actually execute tool operations
   * like Write, Read, Bash, etc.
   */
  simulateTools?: boolean;
}

/**
 * Mock AI Provider
 *
 * Used for testing without calling actual AI APIs
 */
export class MockAIProvider implements IAIProvider {
  private mockResponses: Array<{ pattern: RegExp; response: MockResponse }> = [];
  private defaultResponse: MockResponse | undefined;
  private callCount: number = 0;
  private lastPrompt: string = '';
  private lastOptions: ExecuteOptions = {};

  constructor() {}

  /**
   * Set mock response for a specific prompt pattern
   */
  setMockResponse(promptPattern: string | RegExp, response: MockResponse): void {
    const pattern = promptPattern instanceof RegExp ? promptPattern : new RegExp(promptPattern);
    this.mockResponses.push({ pattern, response });
  }

  /**
   * Set default mock response (fallback)
   */
  setDefaultResponse(response: MockResponse): void {
    this.defaultResponse = response;
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

    for (const { pattern, response: resp } of this.mockResponses) {
      if (pattern.test(prompt)) {
        response = resp;
        break;
      }
    }

    // Use default if no match
    if (!response) {
      response = this.defaultResponse;
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

    // TASK-014: Detect output file pattern in prompt and create file
    const filePathMatch = prompt.match(/\*\*出力ファイル\*\*:\s*(.+?)(?:\n|$)/);
    if (filePathMatch && options.allowedTools?.includes('Write')) {
      const filePath = filePathMatch[1].trim();

      // Extract content from mock response messages
      let contentToWrite: string | null = null;

      for (const message of response.messages) {
        if (message.type === 'assistant' && message.content) {
          const content = typeof message.content === 'string' ? message.content : '';

          // Check if file is JSON
          if (filePath.endsWith('.json')) {
            // Extract JSON from code block
            const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch) {
              contentToWrite = jsonMatch[1];
              break;
            }
          } else if (filePath.endsWith('.md')) {
            // For Markdown files, use the entire content (excluding code block markers if present)
            // Remove JSON code blocks, keep only markdown
            const cleanedContent = content.replace(/```json[\s\S]*?```/g, '').trim();
            if (cleanedContent) {
              contentToWrite = cleanedContent;
              break;
            }
          }
        }
      }

      // Write file if content was found
      if (contentToWrite) {
        const fs = await import('fs/promises');
        const path = await import('path');

        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, contentToWrite, 'utf-8');
      }
    }

    // Yield messages and simulate tools if enabled
    for (const message of response.messages) {
      // Simulate tool execution if enabled
      if (response.simulateTools && message.type === 'system' && message.content?.toolUse) {
        await this.simulateTool(message.content.toolUse);
      }

      yield message;
    }
  }

  /**
   * Simulate tool execution
   *
   * @param toolUse Tool use information
   */
  private async simulateTool(toolUse: any): Promise<void> {
    const { tool, arguments: args } = toolUse;

    if (tool === 'Write') {
      // Simulate Write tool: actually create the file
      const fs = await import('fs/promises');
      const path = await import('path');

      const { file_path, content } = args;
      const dir = path.dirname(file_path);

      // Create directory if it doesn't exist
      await fs.mkdir(dir, { recursive: true });

      // Write file
      await fs.writeFile(file_path, content, 'utf-8');
    } else if (tool === 'Read') {
      // Simulate Read tool: actually read the file
      const fs = await import('fs/promises');

      const { file_path } = args;
      await fs.readFile(file_path, 'utf-8');
    }
    // Add more tool simulations as needed (Bash, Edit, etc.)
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
    this.mockResponses = [];
    this.defaultResponse = undefined;
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
