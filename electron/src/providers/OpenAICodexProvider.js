/**
 * OpenAI Codex SDK Provider Implementation
 *
 * Wraps the OpenAI Codex SDK to conform to the IAIProvider interface
 */
import { Codex, } from '@openai/codex-sdk';
/**
 * OpenAI Codex SDK Provider
 */
export class OpenAICodexProvider {
    codex;
    model;
    currentSession = null;
    ready = false;
    /**
     * List of supported tools by Codex SDK
     * Based on official documentation and SDK capabilities
     */
    static SUPPORTED_TOOLS = [
        'Read',
        'Write',
        'Edit',
        'Bash',
        'Glob',
        'Grep',
        'WebSearch',
        'WebFetch',
    ];
    constructor(config) {
        const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY ?? undefined;
        const baseUrl = config.baseUrl ??
            process.env.OPENAI_CODEX_BASE_URL ??
            process.env.OPENAI_BASE_URL ??
            undefined;
        this.model = config.model || process.env.OPENAI_MODEL || 'gpt-5-codex';
        const codexOptions = {};
        if (apiKey) {
            codexOptions.apiKey = apiKey;
        }
        if (baseUrl) {
            codexOptions.baseUrl = baseUrl;
        }
        // Initialize Codex SDK (relies on logged-in session when apiKey is absent)
        this.codex = new Codex(codexOptions);
        this.ready = true;
    }
    /**
     * Execute a prompt using Codex SDK
     */
    async *execute(prompt, options = {}) {
        const { maxTurns = 50, cwd = process.cwd(), allowedTools, resume, model, includePartialMessages = false, providerOptions = {}, } = options;
        try {
            // Build thread options
            const threadOptions = {
                model: model || this.model,
                workingDirectory: cwd,
                ...providerOptions,
            };
            // Create or resume thread
            let thread;
            if (resume) {
                thread = this.codex.resumeThread(resume, threadOptions);
            }
            else {
                thread = this.codex.startThread(threadOptions);
            }
            // Build turn options
            const turnOptions = {};
            // Execute with streaming
            const streamedTurn = await thread.runStreamed(prompt, turnOptions);
            // Stream events
            for await (const event of streamedTurn.events) {
                // Store thread ID when started
                if (event.type === 'thread.started') {
                    this.currentSession = event.thread_id;
                }
                // Convert event to AI message
                const aiMessage = this.convertEvent(event, includePartialMessages);
                if (aiMessage) {
                    yield aiMessage;
                }
            }
            // Update current session from thread ID
            if (thread.id) {
                this.currentSession = thread.id;
            }
        }
        catch (error) {
            // Yield error message
            yield {
                type: 'result',
                content: {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                },
                timestamp: new Date(),
            };
        }
    }
    /**
     * Convert Codex ThreadEvent to AIMessage
     */
    convertEvent(event, includePartialMessages) {
        const baseMessage = {
            timestamp: new Date(),
        };
        switch (event.type) {
            case 'thread.started':
                return {
                    ...baseMessage,
                    type: 'system',
                    content: {
                        threadStarted: true,
                        threadId: event.thread_id,
                    },
                    session_id: event.thread_id,
                };
            case 'turn.started':
                if (!includePartialMessages)
                    return null;
                return {
                    ...baseMessage,
                    type: 'partial',
                    content: {
                        turnStarted: true,
                    },
                };
            case 'turn.completed':
                return {
                    ...baseMessage,
                    type: 'result',
                    content: {
                        success: true,
                        duration: 0, // Codex doesn't provide duration
                        tokenUsage: {
                            input: event.usage.input_tokens,
                            output: event.usage.output_tokens,
                            total: event.usage.input_tokens +
                                event.usage.output_tokens,
                            cached: event.usage.cached_input_tokens,
                        },
                    },
                    session_id: this.currentSession || undefined,
                };
            case 'turn.failed':
                return {
                    ...baseMessage,
                    type: 'result',
                    content: {
                        success: false,
                        errors: [event.error.message],
                    },
                    session_id: this.currentSession || undefined,
                };
            case 'item.started':
                if (!includePartialMessages)
                    return null;
                return this.convertItemToMessage(event.item, 'started');
            case 'item.updated':
                if (!includePartialMessages)
                    return null;
                return this.convertItemToMessage(event.item, 'updated');
            case 'item.completed':
                return this.convertItemToMessage(event.item, 'completed');
            case 'error':
                return {
                    ...baseMessage,
                    type: 'result',
                    content: {
                        success: false,
                        error: event.message,
                    },
                    session_id: this.currentSession || undefined,
                };
            default:
                return null;
        }
    }
    /**
     * Convert ThreadItem to AIMessage
     */
    convertItemToMessage(item, status) {
        const baseMessage = {
            timestamp: new Date(),
            session_id: this.currentSession || undefined,
        };
        switch (item.type) {
            case 'agent_message':
                return {
                    ...baseMessage,
                    type: 'assistant',
                    content: item.text,
                    uuid: item.id,
                };
            case 'reasoning':
                return {
                    ...baseMessage,
                    type: 'system',
                    content: {
                        reasoning: item.text,
                    },
                    uuid: item.id,
                };
            case 'command_execution':
                return {
                    ...baseMessage,
                    type: 'system',
                    content: {
                        commandExecution: {
                            command: item.command,
                            output: item.aggregated_output,
                            exitCode: item.exit_code,
                            status: item.status,
                        },
                    },
                    uuid: item.id,
                };
            case 'file_change':
                return {
                    ...baseMessage,
                    type: 'system',
                    content: {
                        fileChange: {
                            changes: item.changes,
                            status: item.status,
                        },
                    },
                    uuid: item.id,
                };
            case 'mcp_tool_call':
                return {
                    ...baseMessage,
                    type: 'system',
                    content: {
                        mcpToolCall: {
                            server: item.server,
                            tool: item.tool,
                            arguments: item.arguments,
                            result: item.result,
                            error: item.error,
                            status: item.status,
                        },
                    },
                    uuid: item.id,
                };
            case 'web_search':
                return {
                    ...baseMessage,
                    type: 'system',
                    content: {
                        webSearch: {
                            query: item.query,
                        },
                    },
                    uuid: item.id,
                };
            case 'todo_list':
                return {
                    ...baseMessage,
                    type: 'system',
                    content: {
                        todoList: {
                            items: item.items,
                        },
                    },
                    uuid: item.id,
                };
            case 'error':
                return {
                    ...baseMessage,
                    type: 'result',
                    content: {
                        success: false,
                        subtype: 'error', // Include subtype for MessageHandler error detection
                        error: item.message,
                        errors: [item.message], // Also include in errors array for consistency
                    },
                    uuid: item.id,
                };
            default:
                return {
                    ...baseMessage,
                    type: 'system',
                    content: item,
                    uuid: item.id,
                };
        }
    }
    /**
     * Resume a previous session
     */
    resumeSession(sessionId) {
        this.currentSession = sessionId;
    }
    /**
     * Get supported tools
     */
    getSupportedTools() {
        return OpenAICodexProvider.SUPPORTED_TOOLS;
    }
    /**
     * Get provider name
     */
    getProviderName() {
        return 'codex';
    }
    /**
     * Get current model
     */
    getModel() {
        return this.model;
    }
    /**
     * Check if provider is ready
     */
    isReady() {
        return this.ready;
    }
    /**
     * Get current session ID
     */
    getCurrentSession() {
        return this.currentSession;
    }
}
//# sourceMappingURL=OpenAICodexProvider.js.map
