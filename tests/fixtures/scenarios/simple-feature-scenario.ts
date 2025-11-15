/**
 * Simple Feature Addition Scenario
 *
 * Complete test scenario for adding a simple feature (low complexity)
 */

import type { MockScenario } from '../../../src/providers/MockAIProvider.js';
import { createMockMessage } from '../../../src/providers/MockAIProvider.js';

/**
 * Complete scenario for "Add button hover effect" feature
 *
 * Flow:
 * 1. Complexity Analysis → Low
 * 2. ProductOwner → 1 task
 * 3. Engineer → Implementation
 * 4. Review → Approved
 * 5. Merge → Success
 */
export const simpleFeatureScenario: MockScenario = {
  name: 'simple-feature-addition',
  responses: [
    // Turn 0: Complexity Analysis
    {
      messages: [
        createMockMessage.assistant(
          '```json\n' +
            JSON.stringify(
              {
                requiresDetailedDesign: false,
                complexityLevel: 'low',
                reason: 'シンプルなUI変更のため、詳細設計は不要',
              },
              null,
              2
            ) +
            '\n```'
        ),
        createMockMessage.result(true),
      ],
    },
    // Turn 1: Check Mode (tech stack analysis)
    {
      messages: [
        createMockMessage.assistant(
          '```json\n' +
            JSON.stringify(
              {
                languages: ['TypeScript', 'CSS'],
                frameworks: ['React'],
                tools: ['Tailwind CSS'],
              },
              null,
              2
            ) +
            '\n```'
        ),
        createMockMessage.result(true),
      ],
    },
    // Turn 2: ProductOwner (task breakdown)
    {
      messages: [
        createMockMessage.assistant(
          '```json\n' +
            JSON.stringify(
              {
                tasks: [
                  {
                    id: 'task-001',
                    title: 'ボタンホバーエフェクトの追加',
                    description: 'Tailwind CSSを使用してボタンにホバーエフェクトを追加',
                    priority: 100,
                    dependencies: [],
                    estimatedHours: 1,
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
    // Turn 3: Engineer (implementation)
    {
      messages: [
        createMockMessage.assistant('実装を開始します。'),
        createMockMessage.system({
          toolUse: {
            tool: 'Edit',
            arguments: {
              file_path: 'src/components/Button.tsx',
              old_string: 'className="bg-blue-500"',
              new_string: 'className="bg-blue-500 hover:bg-blue-600 transition-colors"',
            },
          },
        }),
        createMockMessage.assistant('ホバーエフェクトを追加しました。'),
        createMockMessage.result(true),
      ],
      simulateTools: true,
    },
    // Turn 4: Review (approved)
    {
      messages: [
        createMockMessage.assistant(
          '```json\n' +
            JSON.stringify(
              {
                status: 'approved',
                comments: '実装は問題ありません。Tailwind CSSを適切に使用しています。',
                suggestions: [],
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
