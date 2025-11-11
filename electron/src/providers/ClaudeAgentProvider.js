/**
 * Claude Agent SDK Provider Implementation
 *
 * Wraps the Claude Agent SDK to conform to the IAIProvider interface
 */
import { query } from '@anthropic-ai/claude-agent-sdk';
/**
 * Claude Agent SDK Provider
 */
export class ClaudeAgentProvider {
    apiKey;
    model;
    currentSession = null;
    ready = false;
    /**
     * List of supported tools by Claude Agent SDK
     * Based on official documentation
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
        'Task',
        'SlashCommand',
        'Skill',
        'TodoWrite',
        'AskUserQuestion',
    ];
    constructor(config) {
        this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || '';
        this.model = config.model || 'claude-sonnet-4-5-20250929';
        // Note: API key is optional when running in Claude Code environment
        // The SDK will use the logged-in session if no API key is provided
        this.ready = true;
    }
    /**
     * Execute a prompt using Claude Agent SDK
     */
    async *execute(prompt, options = {}) {
        const { maxTurns = 50, cwd = process.cwd(), allowedTools, disallowedTools, permissionMode = 'default', resume, model, systemPrompt, includePartialMessages = false, providerOptions = {}, } = options;
        try {
            // Build query options
            const queryOptions = {
                model: model || this.model,
                maxTurns,
                cwd,
                permissionMode,
                ...providerOptions,
            };
            // Add tool permissions
            if (allowedTools) {
                queryOptions.allowedTools = allowedTools;
            }
            if (disallowedTools) {
                queryOptions.disallowedTools = disallowedTools;
            }
            // Add session resumption
            if (resume) {
                queryOptions.resume = resume;
            }
            // Add system prompt
            if (systemPrompt) {
                queryOptions.systemPrompt = systemPrompt;
            }
            // Include partial messages
            if (includePartialMessages) {
                queryOptions.includePartialMessages = true;
            }
            // Execute query
            for await (const message of query({
                prompt,
                options: queryOptions,
            })) {
                // Store session ID
                if (message.session_id) {
                    this.currentSession = message.session_id;
                }
                // Convert SDK message to AI message
                const aiMessage = this.convertMessage(message);
                yield aiMessage;
            }
        }
        catch (error) {
            // Check if this is an authentication error
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isAuthError = errorMessage.toLowerCase().includes('auth') ||
                errorMessage.toLowerCase().includes('api key');
            // Log authentication warning if API key is not provided and error is auth-related
            if (isAuthError && !this.apiKey) {
                console.error('⚠️  Authentication failed - No API key provided. Please set ANTHROPIC_API_KEY environment variable or ensure you are logged in to Claude Code.');
            }
            // Yield error message
            yield {
                type: 'result',
                content: {
                    success: false,
                    error: errorMessage,
                },
                timestamp: new Date(),
            };
        }
    }
    /**
     * Convert Claude Agent SDK message to AIMessage
     */
    convertMessage(sdkMessage) {
        const baseMessage = {
            timestamp: new Date(),
        };
        switch (sdkMessage.type) {
            case 'assistant':
                // Extract text content from message.content array
                // The message field is an APIAssistantMessage from Anthropic SDK
                const assistantTextContent = sdkMessage.message.content
                    .filter((block) => block.type === 'text')
                    .map((block) => block.text)
                    .join('\n');
                return {
                    ...baseMessage,
                    type: 'assistant',
                    content: assistantTextContent,
                    session_id: sdkMessage.session_id,
                    uuid: sdkMessage.uuid,
                };
            case 'user':
                // Extract text content from message.content array
                // The message field is an APIUserMessage from Anthropic SDK
                const userTextContent = sdkMessage.message.content
                    .filter((block) => block.type === 'text')
                    .map((block) => block.text)
                    .join('\n');
                return {
                    ...baseMessage,
                    type: 'user',
                    content: userTextContent,
                    session_id: sdkMessage.session_id,
                    uuid: sdkMessage.uuid,
                };
            case 'system':
                // Handle different system message subtypes
                if (sdkMessage.subtype === 'init') {
                    return {
                        ...baseMessage,
                        type: 'system',
                        content: {
                            cwd: sdkMessage.cwd,
                            tools: sdkMessage.tools,
                            model: sdkMessage.model,
                            permissionMode: sdkMessage.permissionMode,
                            mcp_servers: sdkMessage.mcp_servers,
                        },
                        session_id: sdkMessage.session_id,
                        uuid: sdkMessage.uuid,
                    };
                }
                else if (sdkMessage.subtype === 'compact_boundary') {
                    return {
                        ...baseMessage,
                        type: 'system',
                        content: {
                            compactBoundary: sdkMessage.compact_metadata,
                        },
                        session_id: sdkMessage.session_id,
                        uuid: sdkMessage.uuid,
                    };
                }
                else if (sdkMessage.subtype === 'hook_response') {
                    return {
                        ...baseMessage,
                        type: 'system',
                        content: {
                            hookResponse: {
                                hook_name: sdkMessage.hook_name,
                                hook_event: sdkMessage.hook_event,
                                stdout: sdkMessage.stdout,
                                stderr: sdkMessage.stderr,
                                exit_code: sdkMessage.exit_code,
                            },
                        },
                        session_id: sdkMessage.session_id,
                        uuid: sdkMessage.uuid,
                    };
                }
                // Fallback for unknown system subtypes
                // This should never be reached as we handle all known subtypes
                return {
                    ...baseMessage,
                    type: 'system',
                    content: sdkMessage,
                    session_id: sdkMessage.session_id,
                };
            case 'result':
                // Handle both success and error subtypes
                const isSuccess = sdkMessage.subtype === 'success';
                return {
                    ...baseMessage,
                    type: 'result',
                    content: {
                        duration: sdkMessage.duration_ms,
                        tokenUsage: {
                            input: sdkMessage.usage.input_tokens,
                            output: sdkMessage.usage.output_tokens,
                            total: sdkMessage.usage.input_tokens + sdkMessage.usage.output_tokens,
                        },
                        cost: sdkMessage.total_cost_usd,
                        permissionDenials: sdkMessage.permission_denials.length,
                        success: isSuccess,
                        result: isSuccess && 'result' in sdkMessage ? sdkMessage.result : undefined,
                        errors: !isSuccess && 'errors' in sdkMessage ? sdkMessage.errors : undefined,
                    },
                    session_id: sdkMessage.session_id,
                    uuid: sdkMessage.uuid,
                };
            case 'stream_event':
                return {
                    ...baseMessage,
                    type: 'partial',
                    content: sdkMessage.event,
                    session_id: sdkMessage.session_id,
                    uuid: sdkMessage.uuid,
                };
            case 'tool_progress':
                return {
                    ...baseMessage,
                    type: 'system',
                    content: {
                        toolProgress: {
                            tool_name: sdkMessage.tool_name,
                            tool_use_id: sdkMessage.tool_use_id,
                            elapsed_time_seconds: sdkMessage.elapsed_time_seconds,
                        },
                    },
                    session_id: sdkMessage.session_id,
                    uuid: sdkMessage.uuid,
                };
            case 'auth_status':
                return {
                    ...baseMessage,
                    type: 'system',
                    content: {
                        authStatus: {
                            isAuthenticating: sdkMessage.isAuthenticating,
                            output: sdkMessage.output,
                            error: sdkMessage.error,
                        },
                    },
                    session_id: sdkMessage.session_id,
                    uuid: sdkMessage.uuid,
                };
            default:
                // Fallback for unknown message types
                return {
                    ...baseMessage,
                    type: 'system',
                    content: sdkMessage,
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
        return ClaudeAgentProvider.SUPPORTED_TOOLS;
    }
    /**
     * Get provider name
     */
    getProviderName() {
        return 'claude';
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
//# sourceMappingURL=ClaudeAgentProvider.js.map