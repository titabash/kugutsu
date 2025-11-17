/**
 * Mock Scenario Builder
 *
 * E2EテストやIntegrationテストで使用するMockAIProviderのシナリオを構築
 */

import type { MockScenario, MockResponse } from '../../src/providers/MockAIProvider.js';
import { createMockMessage, MockMessageBuilder } from './createMockMessage.js';

/**
 * シナリオ構築オプション
 */
export interface ScenarioOptions {
  /**
   * タスク数（デフォルト: 3）
   */
  taskCount?: number;

  /**
   * 依存関係を含めるか（デフォルト: false）
   */
  includeDependencies?: boolean;

  /**
   * タスクのステータス（デフォルト: 'pending'）
   */
  initialStatus?: 'pending' | 'ready';

  /**
   * 複雑度（デフォルト: 'low'）
   */
  complexity?: 'low' | 'medium' | 'high';
}

/**
 * Mock Scenario Builder
 *
 * LangGraphワークフローのE2Eテストで使用するモックシナリオを構築
 */
export class MockScenarioBuilder {
  /**
   * ProductOwnerNodeのフルシナリオを構築
   *
   * Requirements分析 → タスク分解の2ターン
   */
  buildProductOwnerScenario(options: ScenarioOptions = {}): MockScenario {
    const { taskCount = 3, includeDependencies = false } = options;

    return {
      name: 'product-owner-full-workflow',
      responses: [
        // Turn 1: Requirements分析
        this.buildRequirementsAnalysisTurn(),
        // Turn 2: タスク分解
        this.buildTaskBreakdownTurn({ taskCount, includeDependencies }),
      ],
    };
  }

  /**
   * Requirements分析ターンを構築
   */
  private buildRequirementsAnalysisTurn(): MockResponse {
    const requirements = {
      functional: [
        'ユーザー登録機能',
        'ログイン機能',
        'タスク管理機能',
      ],
      nonFunctional: [
        'レスポンスタイム2秒以内',
        '99.9%の可用性',
        'HTTPS通信の必須化',
      ],
      constraints: [
        'TypeScript必須',
        '既存APIとの互換性維持',
        'テストカバレッジ80%以上',
      ],
    };

    const builder = new MockMessageBuilder();

    // アシスタントが要求分析結果を返す
    builder.assistant(`
要求分析を完了しました。以下の内容で requirements.json を作成します。

\`\`\`json
${JSON.stringify(requirements, null, 2)}
\`\`\`
    `);

    // Writeツールで requirements.json を作成
    builder.write('.kugutsu/requirements.json', requirements);

    return {
      messages: builder.build(),
      simulateTools: true, // 重要: Writeツールを実際に実行
    };
  }

  /**
   * タスク分解ターンを構築
   */
  private buildTaskBreakdownTurn(options: {
    taskCount: number;
    includeDependencies: boolean;
  }): MockResponse {
    const { taskCount, includeDependencies } = options;

    // タスクデータを生成
    const tasks = this.generateMockTasks(taskCount, includeDependencies);

    const productBacklog = {
      tasks,
      metadata: {
        totalTasks: tasks.length,
        generatedAt: new Date().toISOString(),
      },
    };

    const builder = new MockMessageBuilder();

    // アシスタントがタスク分解結果を返す
    builder.assistant(`
タスク分解を完了しました。${tasks.length}個のタスクを生成し、product-backlog.json に保存します。

\`\`\`json
${JSON.stringify(productBacklog, null, 2)}
\`\`\`
    `);

    // Writeツールで product-backlog.json を作成
    builder.write('.kugutsu/product-backlog/backlog.json', productBacklog);

    return {
      messages: builder.build(),
      simulateTools: true,
    };
  }

  /**
   * モックタスクを生成
   */
  private generateMockTasks(
    count: number,
    includeDependencies: boolean
  ): Array<{
    id: string;
    title: string;
    description: string;
    priority: number;
    dependencies: string[];
    estimatedHours: number;
    tags: string[];
  }> {
    const tasks = [];

    const taskTemplates = [
      {
        title: 'ユーザーモデルの作成',
        description: 'TypeScript型定義とスキーマを作成',
        tags: ['backend', 'model'],
      },
      {
        title: 'ユーザー登録API実装',
        description: 'POST /api/users エンドポイントの実装',
        tags: ['backend', 'api'],
      },
      {
        title: 'ログイン機能実装',
        description: 'POST /api/auth/login エンドポイントの実装',
        tags: ['backend', 'auth'],
      },
      {
        title: 'ユーザー一覧画面実装',
        description: 'React コンポーネントとAPIクライアント',
        tags: ['frontend', 'ui'],
      },
      {
        title: 'タスク作成機能実装',
        description: 'タスク作成フォームとバリデーション',
        tags: ['frontend', 'feature'],
      },
    ];

    for (let i = 0; i < count; i++) {
      const template = taskTemplates[i % taskTemplates.length];
      const taskId = `task-${String(i + 1).padStart(3, '0')}`;

      // 依存関係の設定
      let dependencies: string[] = [];
      if (includeDependencies && i > 0) {
        // 前のタスクに依存
        if (i === 1) {
          dependencies = [`task-001`];
        } else if (i === 2) {
          dependencies = [`task-001`]; // タスク1に依存
        } else if (i === 3) {
          dependencies = [`task-002`]; // タスク2に依存
        } else if (i === 4) {
          dependencies = [`task-001`, `task-003`]; // タスク1と3に依存
        }
      }

      tasks.push({
        id: taskId,
        title: template.title,
        description: template.description,
        priority: i + 1,
        dependencies,
        estimatedHours: 2 + (i % 4),
        tags: template.tags,
      });
    }

    return tasks;
  }

  /**
   * Engineerノードのシナリオを構築
   */
  buildEngineerScenario(taskId: string = 'task-001'): MockScenario {
    return {
      name: `engineer-${taskId}`,
      responses: [
        {
          messages: new MockMessageBuilder()
            .assistant(`
タスク ${taskId} の実装を開始します。
            `)
            .write('src/mock-feature.ts', '// Mock implementation\nexport function mockFeature() {\n  return "Hello from mock";\n}\n')
            .assistant(`
実装が完了しました。
- ファイル作成: src/mock-feature.ts
- テストコード追加: tests/mock-feature.test.ts
- 正常に動作することを確認しました
            `)
            .write('tests/mock-feature.test.ts', '// Mock test\nimport { mockFeature } from "../src/mock-feature";\n\ntest("mockFeature returns greeting", () => {\n  expect(mockFeature()).toBe("Hello from mock");\n});\n')
            .build(),
          simulateTools: true,
        },
      ],
    };
  }

  /**
   * Reviewノードのシナリオを構築
   */
  buildReviewScenario(taskId: string = 'task-001'): MockScenario {
    return {
      name: `review-${taskId}`,
      responses: [
        {
          messages: [
            createMockMessage.assistant(`
タスク ${taskId} のレビューを実施しました。

**レビュー結果**: ✅ 承認

**確認事項**:
- コード品質: 良好
- テストカバレッジ: 十分
- セキュリティ: 問題なし

実装内容を確認しました。問題ありません。
            `),
          ],
        },
      ],
    };
  }

  /**
   * 複雑度分析のシナリオを構築
   */
  buildComplexityAnalysisScenario(complexity: 'low' | 'medium' | 'high' = 'low'): MockScenario {
    return {
      name: 'complexity-analysis',
      responses: [
        {
          messages: [
            createMockMessage.assistant(`
複雑度分析を完了しました。

**判定結果**: ${complexity.toUpperCase()}

この要求は${complexity === 'low' ? '低' : complexity === 'medium' ? '中' : '高'}複雑度です。
${complexity === 'low' ? 'ProductOwnerによる直接的なタスク分解で対応可能です。' : ''}
${complexity === 'medium' ? 'スプリント計画を含む段階的な開発が推奨されます。' : ''}
${complexity === 'high' ? 'ストーリーマッピングと技術設計レビューが必要です。' : ''}
            `),
          ],
        },
      ],
    };
  }

  /**
   * デフォルトシナリオ（フォールバック）
   */
  buildDefaultScenario(): MockScenario {
    return {
      name: 'default-fallback',
      responses: [],
      defaultResponse: {
        messages: [
          createMockMessage.assistant('Mock AI response - default fallback'),
        ],
      },
    };
  }
}

/**
 * シングルトンインスタンス
 */
export const mockScenarioBuilder = new MockScenarioBuilder();
