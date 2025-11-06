/**
 * AI Provider Factory
 *
 * Creates AI provider instances based on configuration
 */

import type { IAIProvider, AIProviderConfig } from './IAIProvider.js';
import { ClaudeAgentProvider } from './ClaudeAgentProvider.js';
import { MockAIProvider } from './MockAIProvider.js';

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
  static create(config: AIProviderConfig | { provider: 'mock' }): IAIProvider {
    const provider = config.provider;

    switch (provider) {
      case 'mock':
        // For testing
        return new MockAIProvider();

      case 'claude':
        return new ClaudeAgentProvider({
          apiKey: (config as AIProviderConfig).claude?.apiKey,
          model: (config as AIProviderConfig).claude?.model,
        });

      case 'codex':
        // OpenAI Codex provider will be implemented in later phase
        throw new Error(
          'OpenAI Codex provider is not yet implemented. ' +
            'This will be added in a future release. ' +
            'Please use "claude" provider for now.'
        );

      default:
        throw new Error(
          `Unknown AI provider: ${provider}. ` +
            `Supported providers: claude, mock`
        );
    }
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

    // If mock provider is requested, return it immediately
    if (provider === 'mock') {
      return new MockAIProvider();
    }

    const config: AIProviderConfig = {
      provider,
      claude: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.CLAUDE_MODEL,
      },
      codex: {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL,
      },
    };

    return AIProviderFactory.create(config);
  }

  /**
   * Get list of supported providers
   *
   * @returns Array of provider names
   */
  static getSupportedProviders(): string[] {
    return ['claude', 'mock'];
    // Will add 'codex' in future release
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
}
