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
    mockResponses = new Map();
    callCount = 0;
    lastPrompt = '';
    lastOptions = {};
    constructor() { }
    /**
     * Set mock response for a specific prompt pattern
     */
    setMockResponse(promptPattern, response) {
        const key = promptPattern instanceof RegExp ? promptPattern.source : promptPattern;
        this.mockResponses.set(key, response);
    }
    /**
     * Set default mock response (fallback)
     */
    setDefaultResponse(response) {
        this.mockResponses.set('__default__', response);
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
        for (const [pattern, resp] of this.mockResponses.entries()) {
            if (pattern === '__default__')
                continue;
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