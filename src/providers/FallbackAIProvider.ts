/**
 * Fallback AI Provider
 *
 * Wraps AI providers with automatic fallback capability.
 * Handles provider-level errors (rate limits, max turns) by automatically
 * switching to a fallback provider.
 *
 * Features:
 * - Automatic error detection using MessageHandler
 * - Seamless fallback to alternative provider
 * - Single retry limit (prevents infinite loops)
 * - Preserves all messages for caller
 */

import type {
  IAIProvider,
  AIMessage,
  ExecuteOptions,
} from './IAIProvider.js';
import { MessageHandler } from '../utils/MessageHandler.js';
import { ProviderFallbackManager } from '../utils/ProviderFallbackManager.js';
import { AIProviderFactory } from './AIProviderFactory.js';

/**
 * Fallback AI Provider
 *
 * Implements IAIProvider with automatic fallback support
 */
export class FallbackAIProvider implements IAIProvider {
  /**
   * @param primaryProvider - Primary AI provider to use
   * @param fallbackProvider - Fallback provider (optional)
   * @param enableFallback - Enable/disable fallback feature (default: true)
   */
  constructor(
    private primaryProvider: IAIProvider,
    private fallbackProvider?: IAIProvider,
    private enableFallback: boolean = true
  ) {}

  /**
   * Execute with automatic fallback support
   *
   * @param prompt - Prompt to execute
   * @param options - Execution options
   * @returns Async iterable of AI messages
   */
  async *execute(
    prompt: string,
    options: ExecuteOptions = {}
  ): AsyncIterable<AIMessage> {
    const { maxTurns = 50, includePartialMessages = false } = options;

    // First attempt with primary provider
    const primaryMessages: AIMessage[] = [];
    const handler = new MessageHandler({
      maxTurns,
      nodeName: `${this.primaryProvider.getProviderName()} (primary)`,
      silent: true, // Silent mode: error detection only, no logging
    });

    for await (const message of this.primaryProvider.execute(prompt, options)) {
      primaryMessages.push(message);
      await handler.handleMessage(message);

      // Yield message to caller (unless it's a partial message and caller doesn't want them)
      if (message.type !== 'partial' || includePartialMessages) {
        yield message;
      }
    }

    // Check for errors
    if (handler.getHasError()) {
      const details = handler.getErrorDetails();
      const primaryProviderName = this.primaryProvider.getProviderName();

      // Debug: Log fallback decision factors
      console.log(`[FallbackAIProvider] エラー検出:`);
      console.log(`  - enableFallback: ${this.enableFallback}`);
      console.log(`  - fallbackProvider存在: ${!!this.fallbackProvider}`);
      console.log(`  - errorDetails.subtype: ${details?.subtype}`);
      console.log(`  - shouldFallback判定: ${ProviderFallbackManager.shouldFallback(details, false)}`);

      // Check if fallback is possible
      if (
        this.enableFallback &&
        this.fallbackProvider &&
        ProviderFallbackManager.shouldFallback(details, false)
      ) {
        const fallbackProviderName = this.fallbackProvider.getProviderName();

        // Record primary provider failure
        AIProviderFactory.recordFailure(primaryProviderName);

        // Log fallback message
        console.log(
          ProviderFallbackManager.getFallbackMessage(
            details,
            primaryProviderName,
            fallbackProviderName
          )
        );

        // Execute with fallback provider
        const handler2 = new MessageHandler({
          maxTurns,
          nodeName: `${fallbackProviderName} (fallback)`,
          silent: true, // Silent mode: error detection only, no logging
        });

        for await (const message of this.fallbackProvider.execute(prompt, options)) {
          await handler2.handleMessage(message);

          // Yield message to caller
          if (message.type !== 'partial' || includePartialMessages) {
            yield message;
          }
        }

        // Check for errors in fallback execution
        if (handler2.getHasError()) {
          const fallbackDetails = handler2.getErrorDetails();

          // Record fallback provider failure too
          AIProviderFactory.recordFailure(fallbackProviderName);

          // Both providers failed - construct comprehensive error message
          const primaryErrorMsg = details?.message || `エラー詳細不明 (subtype: ${details?.subtype || 'unknown'})`;
          const fallbackErrorMsg = fallbackDetails?.message || `エラー詳細不明 (subtype: ${fallbackDetails?.subtype || 'unknown'})`;

          const errorMsg =
            `両方のAIプロバイダーが失敗しました。処理を継続できません。\n` +
            `- プライマリ (${primaryProviderName}): ${primaryErrorMsg}\n` +
            `- フォールバック (${fallbackProviderName}): ${fallbackErrorMsg}`;

          console.error(`❌ ${errorMsg}`);

          // Yield error result to caller
          yield {
            type: 'result',
            content: {
              success: false,
              error: errorMsg,
              errors: [errorMsg],
              subtype: fallbackDetails?.subtype,
            },
            timestamp: new Date(),
          };
          return;
        }

        // Fallback succeeded
        handler2.complete(true, 'フォールバック実行完了');
        return;
      }

      // Fallback not possible
      // Only record failure if this is a provider-level issue that would have triggered fallback
      // (e.g., rate_limit, usage_limit, provider crash)
      // Don't record failure for non-fallback errors (e.g., 404, validation errors)
      const wouldHaveFallbacked = ProviderFallbackManager.shouldFallback(details, false);
      if (wouldHaveFallbacked) {
        // This is a provider-level failure, but fallback is not available/enabled
        console.log(`[FallbackAIProvider] プロバイダーレベルのエラーだがフォールバック不可: ${primaryProviderName}を失敗記録`);
        AIProviderFactory.recordFailure(primaryProviderName);
      } else {
        // This is not a provider failure, just a task-level error
        console.log(`[FallbackAIProvider] タスクレベルのエラー (subtype: ${details?.subtype || 'undefined'}): プロバイダーは失敗記録しない`);
      }

      let errorMsg: string;
      if (details?.message) {
        errorMsg =
          details.subtype === 'error_max_turns'
            ? `AI実行がmaxTurns制限に到達しました: ${details.message}`
            : `AI実行中にエラーが発生しました: ${details.message}`;
      } else if (details?.errors && details.errors.length > 0) {
        errorMsg = `AI実行中にエラーが発生しました: ${details.errors.join('; ')}`;
      } else {
        errorMsg = `AI実行中にエラーが発生しました (subtype: ${details?.subtype || 'unknown'})`;
      }

      // Yield error result to caller
      yield {
        type: 'result',
        content: {
          success: false,
          error: errorMsg,
          errors: [errorMsg],
          subtype: details?.subtype,
        },
        timestamp: new Date(),
      };
      return;
    }

    handler.complete(true, 'プライマリプロバイダー実行完了');
  }

  /**
   * Resume a previous session (delegates to primary provider)
   */
  resumeSession(sessionId: string): void {
    this.primaryProvider.resumeSession(sessionId);
  }

  /**
   * Get supported tools (from primary provider)
   */
  getSupportedTools(): string[] {
    return this.primaryProvider.getSupportedTools();
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    if (this.fallbackProvider) {
      return `${this.primaryProvider.getProviderName()}-with-fallback`;
    }
    return this.primaryProvider.getProviderName();
  }

  /**
   * Get current model (from primary provider)
   */
  getModel(): string {
    return this.primaryProvider.getModel();
  }

  /**
   * Check if provider is ready
   */
  isReady(): boolean {
    return this.primaryProvider.isReady();
  }
}
