/**
 * AI Provider Factory
 *
 * Creates AI provider instances based on configuration
 */

import type { IAIProvider, AIProviderConfig } from './IAIProvider.js';
import { ClaudeAgentProvider } from './ClaudeAgentProvider.js';
import { MockAIProvider } from './MockAIProvider.js';
import { OpenAICodexProvider } from './OpenAICodexProvider.js';
import { FallbackAIProvider } from './FallbackAIProvider.js';

/**
 * Factory class for creating AI provider instances
 */
export class AIProviderFactory {
  /**
   * Internal state: Set of failed provider names
   * This is managed internally and synced with LangGraph state
   */
  private static failedProviders: Set<string> = new Set();

  /**
   * Sync failed providers from LangGraph state
   * Call this at the beginning of each node
   *
   * @param stateFailedProviders - Failed providers from state
   */
  static syncWithState(stateFailedProviders: string[] = []): void {
    this.failedProviders = new Set(stateFailedProviders);
  }

  /**
   * Record a provider failure
   * Called automatically by FallbackAIProvider when a provider fails
   *
   * @param providerName - Name of the failed provider
   */
  static recordFailure(providerName: string): void {
    this.failedProviders.add(providerName);
    // Note: Logging is handled by FallbackAIProvider and MessageHandler
  }

  /**
   * Get current list of failed providers for syncing back to state
   * Call this when returning from a node
   *
   * @returns Array of failed provider names
   */
  static getFailedProviders(): string[] {
    return Array.from(this.failedProviders);
  }

  /**
   * Create an AI provider based on configuration
   *
   * By default, wraps the provider with FallbackAIProvider for automatic
   * error handling and provider switching (Claude ↔ Codex).
   *
   * @param config - Provider configuration
   * @param enableFallback - Enable automatic fallback (default: true)
   * @returns IAIProvider instance (with fallback if enabled)
   * @throws Error if provider type is not supported
   */
  static create(
    config: AIProviderConfig | { provider: 'mock' },
    enableFallback: boolean = true
  ): IAIProvider {
    let provider = config.provider;
    let switchedProvider = false;

    // Skip failed providers and use fallback instead (using internal state)
    if (this.failedProviders.has(provider)) {
      console.log(`⚠️  プロバイダー '${provider}' は以前失敗したため、フォールバックプロバイダーを使用します`);
      const fallbackConfig = AIProviderFactory.getFallbackProviderConfig(config as AIProviderConfig);
      if (fallbackConfig && !this.failedProviders.has(fallbackConfig.provider)) {
        // Use fallback provider instead (without further fallback to prevent double fallback)
        provider = fallbackConfig.provider;
        config = fallbackConfig;
        switchedProvider = true;
      } else {
        // No fallback available or fallback also failed - cannot proceed
        const fallbackName = fallbackConfig?.provider ?? 'なし';
        throw new Error(
          `プロバイダー '${provider}' は使用不可です。` +
          `フォールバックプロバイダー '${fallbackName}' も利用できません。` +
          `処理を継続できません。`
        );
      }
    }

    // Create base provider without fallback
    let baseProvider: IAIProvider;

    switch (provider) {
      case 'mock':
        // Create Mock provider with pre-configured responses for LangGraph workflow testing
        baseProvider = AIProviderFactory.createMockProvider();
        break;

      case 'claude':
        baseProvider = new ClaudeAgentProvider({
          apiKey: (config as AIProviderConfig).claude?.apiKey,
          model: (config as AIProviderConfig).claude?.model,
        });
        break;

      case 'codex': {
        const codexConfig = (config as AIProviderConfig).codex ?? {};
        baseProvider = new OpenAICodexProvider({
          apiKey: codexConfig.apiKey,
          model: codexConfig.model,
          baseUrl: codexConfig.baseUrl,
        });
        break;
      }

      default:
        throw new Error(
          `Unknown AI provider: ${provider}. ` +
            `Supported providers: claude, codex, mock`
        );
    }

    // For mock provider, fallback disabled, or switched provider, return base provider directly
    // (switched provider already went through fallback selection, so no double fallback)
    if (provider === 'mock' || !enableFallback || switchedProvider) {
      return baseProvider;
    }

    // Get fallback provider configuration
    const fallbackConfig = AIProviderFactory.getFallbackProviderConfig(
      config as AIProviderConfig
    );

    if (!fallbackConfig) {
      // No fallback available, return base provider
      return baseProvider;
    }

    // Skip fallback provider if it has also failed
    if (this.failedProviders.has(fallbackConfig.provider)) {
      // Both primary and fallback providers have failed - cannot proceed
      const originalProvider = (config as AIProviderConfig).provider;
      throw new Error(
        `プロバイダー '${originalProvider}' とフォールバックプロバイダー '${fallbackConfig.provider}' の両方が使用不可です。` +
        `処理を継続できません。別のプロバイダーを設定するか、失敗したプロバイダーの問題を解決してください。`
      );
    }

    // Create fallback provider (without fallback to prevent infinite recursion)
    const fallbackProvider = AIProviderFactory.create(fallbackConfig, false);

    // Wrap with FallbackAIProvider
    return new FallbackAIProvider(
      baseProvider,
      fallbackProvider,
      enableFallback
    );
  }

  /**
   * Create a provider from environment variables
   *
   * @returns IAIProvider instance
   */
  static createFromEnv(): IAIProvider {
    // Default to 'mock' for safety and cost efficiency
    // Use 'claude' or 'codex' explicitly when needed
    const provider = (process.env.KUGUTSU_PROVIDER || 'mock') as 'claude' | 'codex' | 'mock';

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
  private static createMockProvider(): MockAIProvider {
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
  static getSupportedProviders(): string[] {
    return ['claude', 'codex', 'mock'];
  }

  /**
   * Check if a provider is supported
   *
   * @param provider - Provider name to check
   * @returns true if supported, false otherwise
   */
  static isProviderSupported(provider: string): boolean {
    return AIProviderFactory.getSupportedProviders().includes(provider);
  }

  /**
   * Build provider configuration with sensible defaults.
   */
  static buildProviderConfig(options?: {
    provider?: 'claude' | 'codex' | 'mock';
    claudeModel?: string;
    claudeApiKey?: string;
    codexModel?: string;
    codexApiKey?: string;
    codexBaseUrl?: string;
  }): AIProviderConfig {
    const provider = options?.provider ?? 'claude';

    const claudeModel =
      options?.claudeModel ?? process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-5-20250929';
    const claudeApiKey = options?.claudeApiKey ?? process.env.ANTHROPIC_API_KEY;

    const codexModel =
      options?.codexModel ?? process.env.OPENAI_MODEL ?? 'gpt-5-codex';
    const codexApiKey = options?.codexApiKey ?? process.env.OPENAI_API_KEY;
    const codexBaseUrl =
      options?.codexBaseUrl ??
      process.env.OPENAI_CODEX_BASE_URL ??
      process.env.OPENAI_BASE_URL;

    const config: AIProviderConfig = {
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

  /**
   * Get fallback provider configuration based on current provider
   *
   * Fallback chain:
   * - Claude → Codex
   * - Codex → Claude
   * - Mock → null (no fallback for debug provider)
   *
   * @param currentConfig - Current provider configuration
   * @returns Fallback provider configuration, or null if no fallback available
   */
  static getFallbackProviderConfig(
    currentConfig: AIProviderConfig
  ): AIProviderConfig | null {
    const currentProvider = currentConfig.provider;

    // Mock provider has no fallback (debug use only)
    if (currentProvider === 'mock') {
      return null;
    }

    // Claude → Codex
    if (currentProvider === 'claude') {
      return AIProviderFactory.buildProviderConfig({ provider: 'codex' });
    }

    // Codex → Claude
    if (currentProvider === 'codex') {
      return AIProviderFactory.buildProviderConfig({ provider: 'claude' });
    }

    return null;
  }
}
