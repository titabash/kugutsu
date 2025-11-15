/**
 * Complex Feature Development Scenario
 *
 * Complete test scenario for developing a complex feature (high complexity, Scrum flow)
 */

import type { MockScenario } from '../../../src/providers/MockAIProvider.js';
import { createMockMessage } from '../../../src/providers/MockAIProvider.js';

/**
 * Complete scenario for "User Authentication System" feature
 *
 * Flow:
 * 1. Complexity Analysis → High
 * 2. Director → Story Mapping
 * 3. Review Story Mapping → Approved
 * 4. TechLead → Design Documents
 * 5. Review Design → Approved
 * 6. TaskBreakdown → Multiple tasks with dependencies
 * 7. SprintPlanning → Sprint creation
 * 8. Engineer (parallel) → Multiple implementations
 * 9. Review (parallel) → Mixed results
 * 10. Engineer (fixes) → Revisions
 * 11. Review → All approved
 * 12. Merge → Success
 */
export const complexFeatureScenario: MockScenario = {
  name: 'complex-feature-development',
  responses: [
    // Turn 0: Complexity Analysis
    {
      messages: [
        createMockMessage.assistant(
          '```json\n' +
            JSON.stringify(
              {
                requiresDetailedDesign: true,
                complexityLevel: 'high',
                reason:
                  'ユーザー認証システムは複数のコンポーネントとセキュリティ考慮事項を含むため、詳細設計が必要',
              },
              null,
              2
            ) +
            '\n```'
        ),
        createMockMessage.result(true),
      ],
    },
    // Turn 1: Check Mode
    {
      messages: [
        createMockMessage.assistant(
          '```json\n' +
            JSON.stringify(
              {
                languages: ['TypeScript'],
                frameworks: ['React', 'Node.js', 'Express'],
                databases: ['PostgreSQL'],
                tools: ['JWT', 'bcrypt'],
              },
              null,
              2
            ) +
            '\n```'
        ),
        createMockMessage.result(true),
      ],
    },
    // Turn 2: Director (Story Mapping)
    {
      messages: [
        createMockMessage.assistant(
          '```json\n' +
            JSON.stringify(
              {
                userStories: [
                  {
                    id: 'us-001',
                    title: 'ユーザーログイン',
                    asA: 'ユーザー',
                    iWant: 'メールアドレスとパスワードでログインしたい',
                    soThat: 'アプリケーションにアクセスできる',
                    acceptanceCriteria: [
                      '有効な認証情報でログイン成功',
                      '無効な認証情報でエラーメッセージ表示',
                      'ログイン後、ダッシュボードにリダイレクト',
                    ],
                    priority: 100,
                  },
                  {
                    id: 'us-002',
                    title: 'パスワードリセット',
                    asA: 'ユーザー',
                    iWant: 'パスワードを忘れた場合にリセットしたい',
                    soThat: 'アカウントに再度アクセスできる',
                    acceptanceCriteria: [
                      'メールでリセットリンクを受信',
                      '新しいパスワードを設定',
                    ],
                    priority: 80,
                  },
                ],
                epics: [
                  {
                    id: 'epic-001',
                    title: 'ユーザー認証',
                    stories: ['us-001', 'us-002'],
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
    },
    // Turn 3: Review Story Mapping
    {
      messages: [
        createMockMessage.assistant(
          '```json\n' +
            JSON.stringify(
              {
                approved: true,
                comments: 'ストーリーマッピングは適切です。',
              },
              null,
              2
            ) +
            '\n```'
        ),
        createMockMessage.result(true),
      ],
    },
    // Turn 4: TechLead Design
    {
      messages: [
        createMockMessage.assistant(
          '```json\n' +
            JSON.stringify(
              {
                architecture: {
                  frontend: 'React + TypeScript',
                  backend: 'Node.js + Express',
                  database: 'PostgreSQL',
                  authentication: 'JWT',
                },
                components: [
                  {
                    name: 'AuthService',
                    responsibility: 'JWT生成・検証',
                    dependencies: ['UserRepository'],
                  },
                  {
                    name: 'LoginForm',
                    responsibility: 'ログインUI',
                    dependencies: ['AuthService'],
                  },
                ],
                dataModel: {
                  users: {
                    id: 'UUID',
                    email: 'string',
                    passwordHash: 'string',
                    createdAt: 'timestamp',
                  },
                },
              },
              null,
              2
            ) +
            '\n```'
        ),
        createMockMessage.result(true),
      ],
    },
    // Turn 5: Review Design
    {
      messages: [
        createMockMessage.assistant(
          '```json\n' +
            JSON.stringify(
              {
                approved: true,
                comments: '設計は適切です。セキュリティ考慮事項も含まれています。',
              },
              null,
              2
            ) +
            '\n```'
        ),
        createMockMessage.result(true),
      ],
    },
    // Turn 6: Task Breakdown
    {
      messages: [
        createMockMessage.assistant(
          '```json\n' +
            JSON.stringify(
              {
                tasks: [
                  {
                    id: 'task-001',
                    title: 'データベーススキーマ作成',
                    description: 'usersテーブルを作成',
                    priority: 100,
                    dependencies: [],
                    estimatedHours: 2,
                  },
                  {
                    id: 'task-002',
                    title: 'AuthService実装',
                    description: 'JWT生成・検証サービスを実装',
                    priority: 95,
                    dependencies: ['task-001'],
                    estimatedHours: 6,
                  },
                  {
                    id: 'task-003',
                    title: 'LoginForm実装',
                    description: 'ログインフォームUI実装',
                    priority: 90,
                    dependencies: [],
                    estimatedHours: 4,
                  },
                  {
                    id: 'task-004',
                    title: '統合テスト',
                    description: 'フロントエンドとバックエンドの統合',
                    priority: 85,
                    dependencies: ['task-002', 'task-003'],
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
    },
  ],
  defaultResponse: {
    messages: [
      createMockMessage.assistant('Default response'),
      createMockMessage.result(true),
    ],
  },
};
