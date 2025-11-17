/**
 * Mock Message Creation Utilities
 *
 * MockAIProviderで使用するメッセージを簡単に作成するためのヘルパー関数
 */

import type { AIMessage } from '../../src/providers/IAIProvider.js';

/**
 * アシスタントメッセージを作成
 */
export function createAssistantMessage(content: string): AIMessage {
  return {
    type: 'assistant',
    content,
  };
}

/**
 * システムメッセージを作成（ツール使用を含む）
 */
export function createSystemMessage(data: {
  toolUse?: {
    tool: string;
    arguments: Record<string, any>;
  };
  content?: string;
}): AIMessage {
  // toolUseをcontentフィールド内に格納（MockAIProviderの期待する形式）
  return {
    type: 'system',
    content: data.toolUse ? { toolUse: data.toolUse } : data.content || '',
  };
}

/**
 * 結果メッセージを作成
 */
export function createResultMessage(
  success: boolean,
  data?: Record<string, any>
): AIMessage {
  return {
    type: 'result',
    content: success ? 'Success' : 'Error',
    success,
    ...(data && { content: data }),
  };
}

/**
 * Writeツール使用メッセージを作成
 */
export function createWriteToolMessage(
  filePath: string,
  content: string | Record<string, any>
): AIMessage {
  const fileContent = typeof content === 'string'
    ? content
    : JSON.stringify(content, null, 2);

  return createSystemMessage({
    toolUse: {
      tool: 'Write',
      arguments: {
        file_path: filePath,
        content: fileContent,
      },
    },
  });
}

/**
 * Readツール使用メッセージを作成
 */
export function createReadToolMessage(filePath: string): AIMessage {
  return createSystemMessage({
    toolUse: {
      tool: 'Read',
      arguments: {
        file_path: filePath,
      },
    },
  });
}

/**
 * モックメッセージビルダー（Fluent API）
 */
export class MockMessageBuilder {
  private messages: AIMessage[] = [];

  /**
   * アシスタントメッセージを追加
   */
  assistant(content: string): this {
    this.messages.push(createAssistantMessage(content));
    return this;
  }

  /**
   * Writeツール使用を追加
   */
  write(filePath: string, content: string | Record<string, any>): this {
    this.messages.push(createWriteToolMessage(filePath, content));
    this.messages.push(createResultMessage(true));
    return this;
  }

  /**
   * Readツール使用を追加
   */
  read(filePath: string, resultContent?: string): this {
    this.messages.push(createReadToolMessage(filePath));
    this.messages.push(
      createResultMessage(true, {
        content: resultContent || 'File read successfully',
      })
    );
    return this;
  }

  /**
   * カスタムメッセージを追加
   */
  custom(message: AIMessage): this {
    this.messages.push(message);
    return this;
  }

  /**
   * メッセージ配列を取得
   */
  build(): AIMessage[] {
    return this.messages;
  }
}

/**
 * メッセージビルダーを作成
 */
export function createMessageBuilder(): MockMessageBuilder {
  return new MockMessageBuilder();
}

/**
 * 便利なショートカット
 */
export const createMockMessage = {
  assistant: createAssistantMessage,
  system: createSystemMessage,
  result: createResultMessage,
  write: createWriteToolMessage,
  read: createReadToolMessage,
  builder: createMessageBuilder,
};
