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
        // Create Mock provider with pre-configured responses for LangGraph workflow testing
        return AIProviderFactory.createMockProvider();

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

    // If mock provider is requested, return pre-configured mock provider
    if (provider === 'mock') {
      return AIProviderFactory.createMockProvider();
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
