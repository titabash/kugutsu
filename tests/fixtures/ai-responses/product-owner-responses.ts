/**
 * Product Owner AI Response Fixtures
 *
 * Mock AI responses for ProductOwnerNode testing
 */

import type { MockResponse } from '../../../src/providers/MockAIProvider.js';
import { createMockMessage } from '../../../src/providers/MockAIProvider.js';

/**
 * Simple task breakdown response (1 task)
 */
export const simpleTaskBreakdownResponse: MockResponse = {
  messages: [
    createMockMessage.assistant(
      'タスク分解を行います。\n\n```json\n' +
        JSON.stringify(
          {
            tasks: [
              {
                id: 'task-001',
                title: 'ボタンホバーエフェクトの追加',
                description: 'CSSでボタンにホバーエフェクトを追加する',
                priority: 100,
                dependencies: [],
                estimatedHours: 2,
              },
            ],
          },
          null,
          2
        ) +
        '\n```'
    ),
    createMockMessage.result(true),
  ],
};

/**
 * Multiple tasks breakdown response (3 tasks)
 */
export const multipleTasksBreakdownResponse: MockResponse = {
  messages: [
    createMockMessage.assistant(
      'タスク分解を行います。\n\n```json\n' +
        JSON.stringify(
          {
            tasks: [
              {
                id: 'task-001',
                title: 'データベーススキーマの設定',
                description: 'ユーザーテーブルのスキーマを作成',
                priority: 100,
                dependencies: [],
                estimatedHours: 4,
              },
              {
                id: 'task-002',
                title: 'ユーザーモデルの実装',
                description: 'ユーザーモデルとリポジトリを実装',
                priority: 90,
                dependencies: ['task-001'],
                estimatedHours: 6,
              },
              {
                id: 'task-003',
                title: 'API エンドポイントの作成',
                description: 'ユーザー操作用のREST APIエンドポイントを作成',
                priority: 80,
                dependencies: ['task-002'],
                estimatedHours: 8,
              },
            ],
          },
          null,
          2
        ) +
        '\n```'
    ),
    createMockMessage.result(true),
  ],
};

/**
 * Complex task breakdown with parallel tasks
 */
export const complexTaskBreakdownResponse: MockResponse = {
  messages: [
    createMockMessage.assistant(
      'タスク分解を行います。\n\n```json\n' +
        JSON.stringify(
          {
            tasks: [
              {
                id: 'task-backend-001',
                title: 'バックエンド：認証ロジック実装',
                description: 'JWT認証ロジックを実装',
                priority: 100,
                dependencies: [],
                estimatedHours: 8,
              },
              {
                id: 'task-frontend-001',
                title: 'フロントエンド：UIコンポーネント作成',
                description: 'ログインフォームUIコンポーネントを作成',
                priority: 100,
                dependencies: [],
                estimatedHours: 6,
              },
              {
                id: 'task-integration-001',
                title: '統合：フロントエンドとバックエンドの接続',
                description: 'UIとAPIを統合',
                priority: 90,
                dependencies: ['task-backend-001', 'task-frontend-001'],
                estimatedHours: 4,
              },
            ],
          },
          null,
          2
        ) +
        '\n```'
    ),
    createMockMessage.result(true),
  ],
};

/**
 * Tech stack analysis response
 */
export const techStackAnalysisResponse: MockResponse = {
  messages: [
    createMockMessage.assistant(
      '技術スタック分析を行います。\n\n```json\n' +
        JSON.stringify(
          {
            languages: ['TypeScript', 'JavaScript'],
            frameworks: ['React', 'Node.js', 'Express'],
            databases: ['PostgreSQL'],
            tools: ['Jest', 'ESLint', 'Prettier'],
            architecture: 'Client-Server',
          },
          null,
          2
        ) +
        '\n```'
    ),
    createMockMessage.result(true),
  ],
};

/**
 * Requirements analysis response
 */
export const requirementsAnalysisResponse: MockResponse = {
  messages: [
    createMockMessage.assistant(
      '要件分析を行います。\n\n```json\n' +
        JSON.stringify(
          {
            functionalRequirements: [
              'ユーザーがメールアドレスとパスワードでログインできる',
              'ログイン後、ダッシュボードにリダイレクトされる',
              'パスワードリセット機能を提供する',
            ],
            nonFunctionalRequirements: [
              'レスポンスタイムは2秒以内',
              'セキュアな通信（HTTPS）',
              'モバイルフレンドリーなUI',
            ],
            constraints: [
              '既存のデータベーススキーマと互換性を保つ',
              'GDPR準拠',
            ],
          },
          null,
          2
        ) +
        '\n```'
    ),
    createMockMessage.result(true),
  ],
};
