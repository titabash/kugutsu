/**
 * Mock AI Provider
 *
 * Mock implementation for testing without calling actual AI APIs
 */
/**
 * Mock AI Provider
 *
 * Used for testing without calling actual AI APIs
 */
export class MockAIProvider {
    mockResponses = [];
    defaultResponse;
    callCount = 0;
    lastPrompt = '';
    lastOptions = {};
    constructor() { }
    /**
     * Set mock response for a specific prompt pattern
     */
    setMockResponse(promptPattern, response) {
        const pattern = promptPattern instanceof RegExp ? promptPattern : new RegExp(promptPattern);
        this.mockResponses.push({ pattern, response });
    }
    /**
     * Set default mock response (fallback)
     */
    setDefaultResponse(response) {
        this.defaultResponse = response;
    }
    /**
     * Execute mock prompt
     */
    async *execute(prompt, options = {}) {
        this.callCount++;
        this.lastPrompt = prompt;
        this.lastOptions = options;
        // Find matching response
        let response;
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
        // Support both "**出力ファイル**:" and "**ファイルパス**:" patterns
        const filePathMatch = prompt.match(/\*\*(?:出力ファイル|ファイルパス)\*\*:\s*(.+?)(?:\n|$)/);
        if (filePathMatch && options.allowedTools?.includes('Write')) {
            const filePath = filePathMatch[1].trim();
            // Extract content from mock response messages
            let contentToWrite = null;
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
                    }
                    else if (filePath.endsWith('.md')) {
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
            };
        }
    }
    /**
     * Simulate tool execution
     *
     * @param toolUse Tool use information
     */
    async simulateTool(toolUse) {
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
        }
        else if (tool === 'Read') {
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
    resumeSession(sessionId) {
        // Mock implementation
    }
    /**
     * Get supported tools
     */
    getSupportedTools() {
        return ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'];
    }
    /**
     * Get provider name
     */
    getProviderName() {
        return 'mock';
    }
    /**
     * Get model
     */
    getModel() {
        return 'mock-model';
    }
    /**
     * Check if ready
     */
    isReady() {
        return true;
    }
    /**
     * Get call count (for testing)
     */
    getCallCount() {
        return this.callCount;
    }
    /**
     * Get last prompt (for testing)
     */
    getLastPrompt() {
        return this.lastPrompt;
    }
    /**
     * Get last options (for testing)
     */
    getLastOptions() {
        return this.lastOptions;
    }
    /**
     * Reset mock state
     */
    reset() {
        this.mockResponses = [];
        this.defaultResponse = undefined;
        this.callCount = 0;
        this.lastPrompt = '';
        this.lastOptions = {};
    }
    /**
     * Set up mock response for complexity judgment (AnalyzeComplexityNode)
     *
     * @param requiresDetailedDesign - Whether detailed design is required (default: true)
     * @param complexityLevel - Complexity level ('high' or 'low', default: 'high')
     * @param reason - Reason for the judgment (default: mock reason)
     */
    setupComplexityJudgmentMock(requiresDetailedDesign = true, complexityLevel = 'high', reason = 'Mock complexity judgment for testing') {
        const jsonResponse = JSON.stringify({
            requiresDetailedDesign,
            complexityLevel,
            reason,
        }, null, 2);
        this.setMockResponse(/analyze.*complexity|determine.*complexity|Complexity Criteria/i, {
            messages: [
                createMockMessage.assistant(`\`\`\`json\n${jsonResponse}\n\`\`\``),
                createMockMessage.result(true),
            ],
        });
    }
}
/**
 * Create mock AI message helpers
 */
export const createMockMessage = {
    /**
     * Create assistant message
     */
    assistant(content, sessionId) {
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
    result(success = true) {
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
    system(content) {
        return {
            type: 'system',
            content,
            timestamp: new Date(),
        };
    },
};
//# sourceMappingURL=MockAIProvider.js.map