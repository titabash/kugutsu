/**
 * Engineer AI Response Fixtures
 *
 * Mock AI responses for EngineerNode testing
 */

import type { MockResponse } from '../../../src/providers/MockAIProvider.js';
import { createMockMessage } from '../../../src/providers/MockAIProvider.js';

/**
 * Successful implementation response
 */
export const successfulImplementationResponse: MockResponse = {
  messages: [
    createMockMessage.assistant('実装を開始します。'),
    createMockMessage.system({
      toolUse: {
        tool: 'Write',
        arguments: {
          file_path: 'src/components/Button.tsx',
          content: `import React from 'react';

export const Button: React.FC<{ onClick: () => void }> = ({ onClick, children }) => {
  return (
    <button
      onClick={onClick}
      className="hover:bg-blue-600 transition-colors"
    >
      {children}
    </button>
  );
};`,
        },
      },
    }),
    createMockMessage.assistant('実装が完了しました。'),
    createMockMessage.result(true),
  ],
  simulateTools: true,
};

/**
 * Implementation with test creation
 */
export const implementationWithTestsResponse: MockResponse = {
  messages: [
    createMockMessage.assistant('実装とテストを作成します。'),
    createMockMessage.system({
      toolUse: {
        tool: 'Write',
        arguments: {
          file_path: 'src/utils/validation.ts',
          content: `export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
}`,
        },
      },
    }),
    createMockMessage.system({
      toolUse: {
        tool: 'Write',
        arguments: {
          file_path: 'src/utils/validation.test.ts',
          content: `import { validateEmail } from './validation';

describe('validateEmail', () => {
  test('should validate correct email', () => {
    expect(validateEmail('test@example.com')).toBe(true);
  });

  test('should reject invalid email', () => {
    expect(validateEmail('invalid-email')).toBe(false);
  });
});`,
        },
      },
    }),
    createMockMessage.assistant('実装とテストが完了しました。'),
    createMockMessage.result(true),
  ],
  simulateTools: true,
};

/**
 * Implementation failure response (error)
 */
export const implementationErrorResponse: MockResponse = {
  messages: [
    createMockMessage.assistant('実装を開始します。'),
    createMockMessage.assistant('エラーが発生しました: 依存パッケージが見つかりません。'),
  ],
  shouldThrowError: true,
  errorMessage: 'Implementation failed: Missing dependency',
};

/**
 * Implementation with fixes after review
 */
export const implementationWithFixesResponse: MockResponse = {
  messages: [
    createMockMessage.assistant('レビューコメントに基づいて修正します。'),
    createMockMessage.system({
      toolUse: {
        tool: 'Edit',
        arguments: {
          file_path: 'src/components/Button.tsx',
          old_string: 'className="hover:bg-blue-600"',
          new_string: 'className="hover:bg-blue-600 focus:ring-2 focus:ring-blue-500"',
        },
      },
    }),
    createMockMessage.assistant('修正が完了しました。'),
    createMockMessage.result(true),
  ],
  simulateTools: true,
};

/**
 * Complex implementation with multiple files
 */
export const complexImplementationResponse: MockResponse = {
  messages: [
    createMockMessage.assistant('複数ファイルの実装を開始します。'),
    createMockMessage.system({
      toolUse: {
        tool: 'Write',
        arguments: {
          file_path: 'src/api/auth.ts',
          content: `export async function login(email: string, password: string) {
  // Implementation
}`,
        },
      },
    }),
    createMockMessage.system({
      toolUse: {
        tool: 'Write',
        arguments: {
          file_path: 'src/types/auth.ts',
          content: `export interface User {
  id: string;
  email: string;
}`,
        },
      },
    }),
    createMockMessage.system({
      toolUse: {
        tool: 'Write',
        arguments: {
          file_path: 'src/hooks/useAuth.ts',
          content: `import { useState } from 'react';

export function useAuth() {
  const [user, setUser] = useState(null);
  return { user, setUser };
}`,
        },
      },
    }),
    createMockMessage.assistant('すべてのファイルの実装が完了しました。'),
    createMockMessage.result(true),
  ],
  simulateTools: true,
};
