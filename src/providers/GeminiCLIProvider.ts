/**
 * Gemini CLI Provider Implementation
 *
 * Wraps the Vercel AI SDK with Gemini CLI provider to conform to the IAIProvider interface
 */

import { streamText, tool } from 'ai';
import { createGeminiProvider } from 'ai-sdk-provider-gemini-cli';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type {
  IAIProvider,
  AIMessage,
  ExecuteOptions,
} from './IAIProvider.js';

const execAsync = promisify(exec);

/**
 * Gemini CLI Provider using AI SDK v5
 */
export class GeminiCLIProvider implements IAIProvider {
  private gemini: ReturnType<typeof createGeminiProvider>;
  private model: string;
  private currentSession: string | null = null;
  private ready: boolean = false;

  /**
   * List of supported tools
   * Note: Gemini supports function tools only (not provider-defined tools)
   */
  private static readonly SUPPORTED_TOOLS = [
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

  constructor(config: {
    apiKey?: string;
    model?: string;
    authType?: 'oauth-personal' | 'api-key';
  }) {
    const authType = config.authType || (config.apiKey ? 'api-key' : 'oauth-personal');
    this.model = config.model || 'gemini-2.5-pro';

    // Create Gemini provider instance
    this.gemini = createGeminiProvider({
      authType,
      apiKey: config.apiKey,
    });

    this.ready = true;
  }

  /**
   * Create tool definitions for AI SDK v5
   *
   * Each tool has:
   * - description: Helps AI understand when to use the tool
   * - inputSchema: Zod schema for input validation
   * - execute: Async function that performs the actual work
   */
  private createTools(cwd: string = process.cwd()) {
    return {
      Read: tool({
        description: 'Read the contents of a file',
        inputSchema: z.object({
          file_path: z.string().describe('The absolute path to the file to read'),
        }),
        execute: async ({ file_path }) => {
          try {
            const content = await fs.readFile(file_path, 'utf-8');
            return { success: true, content };
          } catch (error: any) {
            return {
              success: false,
              error: `Failed to read file: ${error.message}`,
            };
          }
        },
      }),

      Write: tool({
        description: 'Write content to a file, creating it if it does not exist',
        inputSchema: z.object({
          file_path: z.string().describe('The absolute path to the file to write'),
          content: z.string().describe('The content to write to the file'),
        }),
        execute: async ({ file_path, content }) => {
          try {
            // Create directory if it doesn't exist
            const dir = path.dirname(file_path);
            await fs.mkdir(dir, { recursive: true });

            await fs.writeFile(file_path, content, 'utf-8');
            return { success: true };
          } catch (error: any) {
            return {
              success: false,
              error: `Failed to write file: ${error.message}`,
            };
          }
        },
      }),

      Edit: tool({
        description: 'Edit a file by replacing old_string with new_string',
        inputSchema: z.object({
          file_path: z.string().describe('The absolute path to the file to edit'),
          old_string: z.string().describe('The text to replace'),
          new_string: z.string().describe('The text to replace it with'),
        }),
        execute: async ({ file_path, old_string, new_string }) => {
          try {
            const content = await fs.readFile(file_path, 'utf-8');

            if (!content.includes(old_string)) {
              return {
                success: false,
                error: `String not found in file: ${old_string}`,
              };
            }

            const newContent = content.replace(old_string, new_string);
            await fs.writeFile(file_path, newContent, 'utf-8');

            return { success: true };
          } catch (error: any) {
            return {
              success: false,
              error: `Failed to edit file: ${error.message}`,
            };
          }
        },
      }),

      Bash: tool({
        description: 'Execute a bash command',
        inputSchema: z.object({
          command: z.string().describe('The bash command to execute'),
        }),
        execute: async ({ command }) => {
          try {
            const { stdout, stderr } = await execAsync(command, { cwd });
            return {
              success: true,
              stdout,
              stderr,
              exitCode: 0,
            };
          } catch (error: any) {
            return {
              success: false,
              error: error.message,
              stdout: error.stdout || '',
              stderr: error.stderr || '',
              exitCode: error.code || 1,
            };
          }
        },
      }),

      Glob: tool({
        description: 'Find files matching a glob pattern',
        inputSchema: z.object({
          pattern: z.string().describe('The glob pattern to match files against'),
          path: z.string().optional().describe('The directory to search in (optional)'),
        }),
        execute: async ({ pattern, path: searchPath }) => {
          try {
            const searchDir = searchPath || cwd;
            // Use find command as a simple glob implementation
            const command = `find "${searchDir}" -name "${pattern}" -type f`;
            const { stdout } = await execAsync(command);
            const files = stdout.trim().split('\n').filter(Boolean);
            return { success: true, files };
          } catch (error: any) {
            return {
              success: false,
              error: `Failed to glob: ${error.message}`,
            };
          }
        },
      }),

      Grep: tool({
        description: 'Search for a pattern in files',
        inputSchema: z.object({
          pattern: z.string().describe('The regex pattern to search for'),
          path: z.string().optional().describe('File or directory to search in (optional)'),
        }),
        execute: async ({ pattern, path: searchPath }) => {
          try {
            const searchTarget = searchPath || cwd;
            // Use grep with basic options
            const command = `grep -r "${pattern}" "${searchTarget}"`;
            const { stdout } = await execAsync(command);
            return { success: true, matches: stdout.trim() };
          } catch (error: any) {
            // grep returns exit code 1 when no matches found
            if (error.code === 1) {
              return { success: true, matches: '' };
            }
            return {
              success: false,
              error: `Failed to grep: ${error.message}`,
            };
          }
        },
      }),
    };
  }

  /**
   * Execute a prompt using Gemini CLI via AI SDK with tool support
   */
  async *execute(
    prompt: string,
    options: ExecuteOptions = {}
  ): AsyncIterable<AIMessage> {
    const {
      model, // Model override (optional)
      includePartialMessages = false,
      providerOptions = {},
      cwd = process.cwd(),
      // Extract IAIProvider-specific options
      maxTurns, // Ignored - Gemini CLI doesn't support maxTurns
      allowedTools, // Filter tools based on this list
      disallowedTools, // Ignored for now
      permissionMode, // Ignored
      resume, // Ignored
      systemPrompt, // Ignored
      abortController, // Ignored
      ...unusedOptions // Catch any other ExecuteOptions fields (ignored)
    } = options;

    // Yield system initialization message
    yield {
      type: 'system',
      content: { initialized: true },
      timestamp: new Date(),
    } as AIMessage;

    try {
      // Build streamText options
      // Filter out IAIProvider-specific options that are not compatible with AI SDK streamText
      const {
        maxOutputTokens,
        maxTokens,
        ...otherProviderOptions
      } = providerOptions;

      // Create tools for AI SDK v5
      const allTools = this.createTools(cwd);

      // Filter tools based on allowedTools option
      const tools = allowedTools && allowedTools.length > 0
        ? Object.fromEntries(
            Object.entries(allTools).filter(([name]) => allowedTools.includes(name))
          )
        : allTools;

      // Debug: Log what options are being passed to streamText
      console.log('[GeminiCLIProvider] streamText options:', {
        model: model || this.model,
        prompt: prompt.substring(0, 100) + '...',
        toolsAvailable: Object.keys(tools),
        allowedTools: allowedTools || 'all',
        providerOptions: otherProviderOptions,
      });

      const streamOptions: any = {
        model: this.gemini(model || this.model),
        prompt,
        tools, // Add tools support
        ...otherProviderOptions,
      };

      // Add maxTokens if specified
      if (maxOutputTokens || maxTokens) {
        streamOptions.maxTokens = maxOutputTokens || maxTokens;
      }

      // Execute streaming request
      const result = await streamText(streamOptions);

      // Use fullStream to capture both text and tool events
      let accumulatedText = '';
      for await (const part of result.fullStream) {
        // Debug: Log all event types
        console.log(`[GeminiCLIProvider] Event type: ${part.type}`);

        switch (part.type) {
          case 'text-delta':
            // Streaming text chunk
            // Note: AI SDK v5 uses 'text' property, not 'textDelta'
            const textContent = (part as any).text || (part as any).textDelta;
            if (!textContent) {
              console.log(`[GeminiCLIProvider] Text delta event with no text content:`, JSON.stringify(part));
              break;
            }

            accumulatedText += textContent;
            console.log(`[GeminiCLIProvider] Text delta: "${textContent.substring(0, 50)}..."`);

            // Always yield partial message for real-time streaming display
            // This enables real-time display regardless of includePartialMessages setting
            yield {
              type: 'partial',
              content: {
                type: 'content_block_delta',
                delta: { text: textContent },
              },
              timestamp: new Date(),
            } as AIMessage;
            break;

          case 'tool-call':
            // AI is calling a tool
            console.log(`[GeminiCLIProvider] Tool call: ${part.toolName}`);

            // Yield system message for tool call (similar to Claude Agent SDK's toolProgress)
            yield {
              type: 'system',
              content: {
                toolProgress: {
                  tool_name: part.toolName,
                  tool_use_id: part.toolCallId,
                  elapsed_time_seconds: 0,
                },
              },
              timestamp: new Date(),
            } as AIMessage;
            break;

          case 'tool-result':
            // Tool execution completed
            console.log(`[GeminiCLIProvider] Tool result: ${part.toolName}`);

            // Yield system message for tool result (similar to Codex SDK's commandExecution)
            // AI SDK v5 uses 'output' instead of 'result'
            const toolOutput = (part as { output?: unknown }).output;
            const outputSuccess = (toolOutput as { success?: boolean })?.success;
            yield {
              type: 'system',
              content: {
                commandExecution: {
                  command: part.toolName,
                  output: JSON.stringify(toolOutput),
                  exitCode: outputSuccess === false ? 1 : 0,
                  status: outputSuccess === false ? 'failed' : 'completed',
                },
              },
              timestamp: new Date(),
            } as AIMessage;
            break;

          case 'error':
            // Error during streaming (non-fatal, log only)
            // Note: Some errors from Gemini CLI provider are warnings and don't affect execution
            console.warn(`[GeminiCLIProvider] Stream warning:`, part.error);
            // Don't yield result message - let the stream continue
            break;

          case 'finish':
            // Stream finished
            console.log(`[GeminiCLIProvider] Stream finished: ${part.finishReason}`);

            // Yield final assistant message with accumulated text after streaming completes
            if (accumulatedText) {
              yield {
                type: 'assistant',
                content: accumulatedText,
                timestamp: new Date(),
              } as AIMessage;
            }
            break;

          default:
            // Unknown event type - log for debugging
            if (includePartialMessages) {
              console.log(`[GeminiCLIProvider] Unknown event type:`, (part as any).type);
            }
        }
      }

      // After streaming completes, get final usage and result
      try {
        // Note: usage and finishReason are Promises that need to be awaited
        const usage = await result.usage;
        const finishReason = await result.finishReason;

        // Yield final result message
        yield {
          type: 'result',
          content: {
            success: true,
            finishReason: finishReason || 'stop',
            tokenUsage: usage ? {
              input: usage.inputTokens || 0,
              output: usage.outputTokens || 0,
              total: usage.totalTokens || 0,
            } : undefined,
          },
          timestamp: new Date(),
        } as AIMessage;
      } catch (usageError) {
        // Handle usage retrieval error
        console.error('[GeminiCLIProvider] Usage取得エラー:', usageError);
        yield {
          type: 'result',
          content: {
            success: true,
            finishReason: 'unknown',
          },
          timestamp: new Date(),
        } as AIMessage;
      }

    } catch (error) {
      // Handle errors during execution
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log detailed error information
      console.error(`[GeminiCLIProvider] エラー発生:`);
      console.error(`  - モデル: ${this.model}`);
      console.error(`  - エラーメッセージ: ${errorMessage}`);
      if (error instanceof Error && error.stack) {
        console.error(`  - スタックトレース:\n${error.stack}`);
      }

      // Check if this is a usage/rate limit error
      const isUsageLimit = this.isUsageLimitError(errorMessage);
      console.error(`  - 使用制限エラー判定: ${isUsageLimit}`);
      console.error(`  - subtype: ${isUsageLimit ? 'rate_limit' : 'undefined'}`);

      yield {
        type: 'result',
        content: {
          success: false,
          subtype: isUsageLimit ? 'rate_limit' : undefined,
          error: errorMessage,
          errors: [errorMessage],
        },
        timestamp: new Date(),
      } as AIMessage;
    }
  }

  /**
   * Check if error message indicates a usage/rate limit error
   */
  private isUsageLimitError(errorMessage: string): boolean {
    const lowerMsg = errorMessage.toLowerCase();
    return (
      lowerMsg.includes('usage limit') ||
      lowerMsg.includes('rate limit') ||
      lowerMsg.includes('quota exceeded') ||
      lowerMsg.includes('429') ||
      lowerMsg.includes('too many requests') ||
      lowerMsg.includes('upgrade to pro') ||
      lowerMsg.includes('purchase more credits') ||
      lowerMsg.includes('weekly limit') ||
      lowerMsg.includes('monthly limit') ||
      lowerMsg.includes('subscription required')
    );
  }

  /**
   * Resume a previous session
   * Note: Gemini CLI provider may not support session resumption
   */
  resumeSession(sessionId: string): void {
    this.currentSession = sessionId;
  }

  /**
   * Get current session ID
   */
  getCurrentSession(): string | null {
    return this.currentSession;
  }

  /**
   * Get list of supported tools
   */
  getSupportedTools(): string[] {
    return [...GeminiCLIProvider.SUPPORTED_TOOLS];
  }

  /**
   * Get the provider name
   */
  getProviderName(): string {
    return 'gemini';
  }

  /**
   * Get the current model being used
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Check if the provider is ready to use
   */
  isReady(): boolean {
    return this.ready;
  }
}
