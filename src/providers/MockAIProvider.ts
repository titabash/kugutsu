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
 * Mock scenario for complex test workflows
 *
 * Allows setting up sequential responses for multi-turn conversations
 */
export interface MockScenario {
  /**
   * Scenario name (for identification)
   */
  name: string;

  /**
   * Sequential responses for each turn
   * Index represents the turn number (0-based)
   */
  responses: MockResponse[];

  /**
   * Default response if turns exceed responses array length
   */
  defaultResponse?: MockResponse;
}

/**
 * Execution callback type
 */
export type ExecutionCallback = (prompt: string, options: ExecuteOptions) => void;

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
  private scenarios: Map<string, MockScenario> = new Map();
  private activeScenario: string | null = null;
  private scenarioTurnCounter: number = 0;
  private executionCallbacks: ExecutionCallback[] = [];
  private allPrompts: string[] = [];
  private allOptions: ExecuteOptions[] = [];

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
   * Clear all mock responses (useful for test cleanup)
   */
  clearMockResponses(): void {
    this.mockResponses = [];
    this.defaultResponse = undefined;
    this.activeScenario = null;
    this.scenarioTurnCounter = 0;
  }

  /**
   * Set up a scenario for sequential responses
   *
   * @param scenario - Mock scenario configuration
   */
  setupScenario(scenario: MockScenario): void {
    this.scenarios.set(scenario.name, scenario);
  }

  /**
   * Activate a scenario
   *
   * @param scenarioName - Name of the scenario to activate
   */
  activateScenario(scenarioName: string): void {
    if (!this.scenarios.has(scenarioName)) {
      throw new Error(`Scenario '${scenarioName}' not found. Please set it up first.`);
    }
    this.activeScenario = scenarioName;
    this.scenarioTurnCounter = 0;
  }

  /**
   * Deactivate the current scenario
   */
  deactivateScenario(): void {
    this.activeScenario = null;
    this.scenarioTurnCounter = 0;
  }

  /**
   * Register an execution callback
   *
   * Useful for verifying that prompts are called with expected arguments
   *
   * @param callback - Callback function to execute on each call
   */
  onExecute(callback: ExecutionCallback): void {
    this.executionCallbacks.push(callback);
  }

  /**
   * Clear all execution callbacks
   */
  clearCallbacks(): void {
    this.executionCallbacks = [];
  }

  /**
   * Get all prompts that were executed
   *
   * @returns Array of all prompts
   */
  getAllPrompts(): string[] {
    return [...this.allPrompts];
  }

  /**
   * Get all options that were used
   *
   * @returns Array of all options
   */
  getAllOptions(): ExecuteOptions[] {
    return [...this.allOptions];
  }

  /**
   * Execute mock prompt
   */
  async *execute(prompt: string, options: ExecuteOptions = {}): AsyncIterable<AIMessage> {
    this.callCount++;
    this.lastPrompt = prompt;
    this.lastOptions = options;
    this.allPrompts.push(prompt);
    this.allOptions.push(options);

    // Execute callbacks
    for (const callback of this.executionCallbacks) {
      try {
        callback(prompt, options);
      } catch (error) {
        console.error('Error in execution callback:', error);
      }
    }

    // Find matching response
    let response: MockResponse | undefined;

    // Check active scenario first
    if (this.activeScenario) {
      const scenario = this.scenarios.get(this.activeScenario);
      if (scenario) {
        // Get response for current turn
        if (this.scenarioTurnCounter < scenario.responses.length) {
          response = scenario.responses[this.scenarioTurnCounter];
          this.scenarioTurnCounter++;
        } else if (scenario.defaultResponse) {
          response = scenario.defaultResponse;
        }
      }
    }

    // If no scenario response, check pattern-based responses
    if (!response) {
      for (const { pattern, response: resp } of this.mockResponses) {
        if (pattern.test(prompt)) {
          response = resp;
          break;
        }
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
    // Support both "**出力ファイル**:" and "**ファイルパス**:" patterns
    const filePathMatch = prompt.match(/\*\*(?:出力ファイル|ファイルパス)\*\*:\s*(.+?)(?:\n|$)/);
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
    let hasResultMessage = false;
    for (const message of response.messages) {
      // Simulate tool execution if enabled
      if (response.simulateTools && message.type === 'system' && message.content?.toolUse) {
        await this.simulateTool(message.content.toolUse);
      }

      // Track if a result message already exists
      if (message.type === 'result') {
        hasResultMessage = true;
      }

      yield message;
    }

    // If includePartialMessages is enabled and no result message was provided, send one
    if (options.includePartialMessages && !hasResultMessage) {
      yield {
        type: 'result',
        content: {
          success: true,
          duration: 100,
          tokenUsage: { input: 10, output: 20, total: 30 },
          cost: 0.001,
          permissionDenials: 0,
          usage: {
            input_tokens: 10,
            output_tokens: 20,
          },
          stop_reason: 'end_turn',
        },
      } as AIMessage;
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
    this.scenarios.clear();
    this.activeScenario = null;
    this.scenarioTurnCounter = 0;
    this.executionCallbacks = [];
    this.allPrompts = [];
    this.allOptions = [];
  }

  /**
   * Set up mock response for complexity judgment (AnalyzeComplexityNode)
   *
   * @param requiresDetailedDesign - Whether detailed design is required (default: true)
   * @param complexityLevel - Complexity level ('high' or 'low', default: 'high')
   * @param reason - Reason for the judgment (default: mock reason)
   */
  setupComplexityJudgmentMock(
    requiresDetailedDesign: boolean = true,
    complexityLevel: 'high' | 'low' = 'high',
    reason: string = 'Mock complexity judgment for testing'
  ): void {
    const jsonResponse = JSON.stringify(
      {
        requiresDetailedDesign,
        complexityLevel,
        reason,
      },
      null,
      2
    );

    this.setMockResponse(
      /expert software architect|complexity|Complexity Criteria/i,
      {
        messages: [
          createMockMessage.assistant(`\`\`\`json\n${jsonResponse}\n\`\`\``),
          createMockMessage.result(true),
        ],
      }
    );
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
