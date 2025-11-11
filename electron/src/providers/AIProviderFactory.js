/**
 * AI Provider Factory
 *
 * Creates AI provider instances based on configuration
 */
import { ClaudeAgentProvider } from './ClaudeAgentProvider.js';
import { MockAIProvider } from './MockAIProvider.js';
import { OpenAICodexProvider } from './OpenAICodexProvider.js';
/**
 * Factory class for creating AI provider instances
 */
export class AIProviderFactory {
    /**
     * Create an AI provider based on configuration
     *
     * @param config - Provider configuration
     * @returns IAIProvider instance
     * @throws Error if provider type is not supported
     */
    static create(config) {
        const provider = config.provider;
        switch (provider) {
            case 'mock':
                // Create Mock provider with pre-configured responses for LangGraph workflow testing
                return AIProviderFactory.createMockProvider();
            case 'claude':
                return new ClaudeAgentProvider({
                    apiKey: config.claude?.apiKey,
                    model: config.claude?.model,
                });
            case 'codex': {
                const codexConfig = config.codex ?? {};
                return new OpenAICodexProvider({
                    apiKey: codexConfig.apiKey,
                    model: codexConfig.model,
                    baseUrl: codexConfig.baseUrl,
                });
            }
            default:
                throw new Error(`Unknown AI provider: ${provider}. ` +
                    `Supported providers: claude, codex, mock`);
        }
    }
    /**
     * Create a provider from environment variables
     *
     * @returns IAIProvider instance
     */
    static createFromEnv() {
        // Default to 'mock' for safety and cost efficiency
        // Use 'claude' or 'codex' explicitly when needed
        const provider = (process.env.KUGUTSU_PROVIDER || 'mock');
        const config = AIProviderFactory.buildProviderConfig({
            provider,
        });
        return AIProviderFactory.create(config);
    }
    /**
     * Create a pre-configured Mock provider for LangGraph workflow testing
     *
     * This configures mock responses for all workflow stages:
     * - Technology stack analysis
     * - Requirements analysis
     * - Task generation
     * - Code implementation
     * - Code review
     *
     * @returns Configured MockAIProvider instance
     */
    static createMockProvider() {
        const mockProvider = new MockAIProvider();
        // 1. Technology Stack Analysis Response
        mockProvider.setMockResponse(/Technology Stack Analysis/i, {
            messages: [{
                    type: 'assistant',
                    content: JSON.stringify({
                        languages: ['TypeScript', 'JavaScript'],
                        frameworks: ['Electron', 'React', 'LangGraph'],
                        tools: ['npm', 'electron-vite'],
                        buildSystem: 'npm'
                    })
                }]
        });
        // 2. Requirements Analysis Response
        mockProvider.setMockResponse(/Requirements Analysis/i, {
            messages: [{
                    type: 'assistant',
                    content: `要求分析結果:
- ユーザーの要求を理解しました
- 実装可能なタスクに分割します
- 依存関係を考慮した実装順序を決定します`
                }]
        });
        // 3. Task Generation Response
        mockProvider.setMockResponse(/Task Generation/i, {
            messages: [{
                    type: 'assistant',
                    content: JSON.stringify([
                        {
                            id: 'task-1',
                            title: 'モックタスク1: 基本実装',
                            description: 'テスト用の基本機能を実装します',
                            priority: 1,
                            dependencies: [],
                            estimatedTime: 30
                        },
                        {
                            id: 'task-2',
                            title: 'モックタスク2: UI改善',
                            description: 'ユーザーインターフェースを改善します',
                            priority: 2,
                            dependencies: ['task-1'],
                            estimatedTime: 20
                        }
                    ])
                }]
        });
        // 4. Code Implementation Response (Engineer)
        mockProvider.setMockResponse(/実装|implementation|code/i, {
            messages: [{
                    type: 'assistant',
                    content: `実装完了:
- ファイル作成: src/mock-feature.ts
- テストコード追加: tests/mock-feature.test.ts
- 正常に動作することを確認しました`
                }]
        });
        // 5. Code Review Response
        mockProvider.setMockResponse(/review|レビュー/i, {
            messages: [{
                    type: 'assistant',
                    content: JSON.stringify({
                        status: 'approved',
                        comments: '実装内容を確認しました。問題ありません。',
                        suggestions: []
                    })
                }]
        });
        return mockProvider;
    }
    /**
     * Get list of supported providers
     *
     * @returns Array of provider names
     */
    static getSupportedProviders() {
        return ['claude', 'codex', 'mock'];
    }
    /**
     * Check if a provider is supported
     *
     * @param provider - Provider name to check
     * @returns true if supported, false otherwise
     */
    static isProviderSupported(provider) {
        return AIProviderFactory.getSupportedProviders().includes(provider);
    }
    /**
     * Build provider configuration with sensible defaults.
     */
    static buildProviderConfig(options) {
        const provider = options?.provider ?? 'claude';
        const claudeModel = options?.claudeModel ?? process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-5-20250929';
        const claudeApiKey = options?.claudeApiKey ?? process.env.ANTHROPIC_API_KEY;
        const codexModel = options?.codexModel ?? process.env.OPENAI_MODEL ?? 'gpt-5-codex';
        const codexApiKey = options?.codexApiKey ?? process.env.OPENAI_API_KEY;
        const codexBaseUrl = options?.codexBaseUrl ??
            process.env.OPENAI_CODEX_BASE_URL ??
            process.env.OPENAI_BASE_URL;
        const config = {
            provider,
        };
        if (provider === 'claude') {
            config.claude = {
                apiKey: claudeApiKey,
                model: claudeModel,
            };
        }
        if (provider === 'codex') {
            config.codex = {
                apiKey: codexApiKey,
                model: codexModel,
                baseUrl: codexBaseUrl,
            };
        }
        return config;
    }
}
//# sourceMappingURL=AIProviderFactory.js.map