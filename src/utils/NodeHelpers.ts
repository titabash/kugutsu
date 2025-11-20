/**
 * Node Helper Functions
 *
 * Common utilities for LangGraph nodes to reduce boilerplate
 */

import type { IAIProvider, ExecuteOptions, AIMessage } from '../providers/IAIProvider.js';
import type { ParallelDevConfig } from '../graph/types.js';

/**
 * Execute AI provider with automatic abort controller injection
 *
 * Reduces boilerplate by automatically adding abortController from config
 *
 * @example
 * ```typescript
 * for await (const message of executeWithAbort(provider, prompt, {
 *   maxTurns: 50,
 *   cwd: config.baseRepoPath,
 * }, config)) {
 *   // handle message
 * }
 * ```
 */
export async function* executeWithAbort(
  provider: IAIProvider,
  prompt: string,
  options: Omit<ExecuteOptions, 'abortController'>,
  config: ParallelDevConfig
): AsyncIterable<AIMessage> {
  // Automatically inject abortController from config
  const optionsWithAbort: ExecuteOptions = {
    ...options,
    abortController: config.abortController,
  };

  yield* provider.execute(prompt, optionsWithAbort);
}

/**
 * Check if execution should be aborted
 *
 * @throws {ExecutionAbortedError} if aborted
 */
export function checkAborted(config: ParallelDevConfig, nodeName?: string): void {
  if (config.abortSignal?.aborted) {
    const errorMsg = nodeName
      ? `🛑 [${nodeName}] Execution aborted by user`
      : '🛑 Execution aborted by user';
    console.log(errorMsg);
    throw new ExecutionAbortedError(nodeName);
  }
}

/**
 * Custom error for execution abortion
 */
export class ExecutionAbortedError extends Error {
  constructor(nodeName?: string) {
    super(nodeName ? `Execution aborted in ${nodeName}` : 'Execution aborted by user');
    this.name = 'ExecutionAbortedError';
  }
}
