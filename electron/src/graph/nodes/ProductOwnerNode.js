/**
 * Product Owner Node
 *
 * Analyzes user requirements and generates tasks for parallel execution
 * Uses AI-driven analysis instead of hardcoded logic
 */
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
/**
 * Product Owner Node
 *
 * Responsibilities:
 * 1. Analyze user request
 * 2. Detect technology stack
 * 3. Generate independent, parallelizable tasks
 * 4. Identify task dependencies
 */
export async function productOwnerNode(state) {
    const { userRequest, config } = state;
    // Create AI provider
    const providerConfig = {
        provider: config.provider || 'claude',
        claude: {
            model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
        },
    };
    const provider = AIProviderFactory.create(providerConfig);
    console.log('📊 Product Owner: ユーザー要求を分析しています...');
    try {
        // Phase 1: Technology Stack Analysis
        const techStackAnalysisPrompt = `
# Technology Stack Analysis

プロジェクトの技術スタックを分析してください。

## 対象リポジトリ
${config.baseRepoPath}

## タスク
以下を実行してください：
1. リポジトリ内の設定ファイルを確認（package.json, tsconfig.json, go.mod, requirements.txt等）
2. 使用されているプログラミング言語を特定
3. フレームワークとライブラリを特定
4. ビルドツールとテストフレームワークを特定

## 出力形式
JSON形式で以下の構造で出力してください：
\`\`\`json
{
  "languages": ["言語1", "言語2"],
  "frameworks": ["フレームワーク1"],
  "buildTools": ["ツール1"],
  "testingFrameworks": ["テストフレームワーク1"],
  "projectType": "プロジェクトタイプ"
}
\`\`\`
`;
        let techStackResult = '';
        for await (const message of provider.execute(techStackAnalysisPrompt, {
            maxTurns: 5,
            cwd: config.baseRepoPath,
            allowedTools: ['Read', 'Glob', 'Grep'],
            permissionMode: 'acceptEdits',
        })) {
            if (message.type === 'assistant' && message.content) {
                techStackResult += JSON.stringify(message.content);
            }
        }
        console.log('✅ 技術スタック分析完了');
        // Phase 2: Requirements Analysis
        const requirementsAnalysisPrompt = `
# Requirements Analysis

以下の開発要求を分析してください。

## ユーザー要求
${userRequest}

## 技術スタック
${techStackResult}

## タスク
MECE原則（漏れなく、重複なく）に基づいて要求を分析し、以下を出力してください：

1. **機能要件**: 実装すべき機能のリスト
2. **非機能要件**: パフォーマンス、セキュリティ等の要件
3. **制約条件**: 技術的制約や依存関係

## 出力形式
JSON形式で以下の構造で出力してください：
\`\`\`json
{
  "functional": ["機能1", "機能2"],
  "nonFunctional": ["要件1"],
  "constraints": ["制約1"]
}
\`\`\`
`;
        let requirementsResult = '';
        for await (const message of provider.execute(requirementsAnalysisPrompt, {
            maxTurns: 5,
            cwd: config.baseRepoPath,
            allowedTools: ['Read', 'Glob', 'Grep'],
            permissionMode: 'acceptEdits',
        })) {
            if (message.type === 'assistant' && message.content) {
                requirementsResult += JSON.stringify(message.content);
            }
        }
        console.log('✅ 要求分析完了');
        // Phase 3: Task Generation
        const taskGenerationPrompt = `
# Task Generation

要求分析結果に基づいて、並列実行可能なタスクに分割してください。

## 要求分析結果
${requirementsResult}

## タスク生成の原則
1. **独立性**: 各タスクは他のタスクと独立して実行可能
2. **明確性**: タスクの目的と成果物が明確
3. **テスト駆動**: 各タスクはテストを含む
4. **適切な粒度**: 大きすぎず、小さすぎないサイズ

## 出力形式
JSON配列形式で、以下の構造で出力してください：
\`\`\`json
[
  {
    "id": "task-001",
    "title": "タスクタイトル",
    "description": "詳細な説明",
    "priority": 10,
    "dependencies": []
  }
]
\`\`\`

## 重要な注意事項
- タスクIDは "task-001" のような形式
- priorityは1-100の数値（高いほど優先度が高い）
- dependenciesは他のタスクIDの配列
- 依存関係は循環しないように
`;
        let tasksJson = '';
        for await (const message of provider.execute(taskGenerationPrompt, {
            maxTurns: 10,
            cwd: config.baseRepoPath,
            allowedTools: ['Read', 'Glob', 'Grep'],
            permissionMode: 'acceptEdits',
        })) {
            if (message.type === 'assistant' && message.content) {
                tasksJson += JSON.stringify(message.content);
            }
        }
        console.log('✅ タスク生成完了');
        // Parse tasks from JSON
        let tasks = [];
        try {
            // Extract JSON from the response
            const jsonMatch = tasksJson.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const parsedTasks = JSON.parse(jsonMatch[0]);
                tasks = parsedTasks.map((task, index) => ({
                    id: task.id || `task-${String(index + 1).padStart(3, '0')}`,
                    title: task.title || `Task ${index + 1}`,
                    description: task.description || '',
                    priority: task.priority || 50,
                    dependencies: task.dependencies || [],
                    status: 'pending',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }));
            }
        }
        catch (error) {
            console.error('❌ タスクのパースに失敗:', error);
            // Fallback: Create a single task
            tasks = [
                {
                    id: 'task-001',
                    title: userRequest.substring(0, 100),
                    description: userRequest,
                    priority: 100,
                    dependencies: [],
                    status: 'pending',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];
        }
        // Return state update
        return {
            tasks,
            logs: [
                {
                    timestamp: new Date(),
                    level: 'info',
                    source: 'ProductOwnerNode',
                    message: `${tasks.length}個のタスクを生成しました`,
                    data: {
                        taskCount: tasks.length,
                        taskIds: tasks.map((t) => t.id),
                    },
                },
            ],
            metadata: {
                phase: 'development',
                totalTasks: tasks.length,
            },
        };
    }
    catch (error) {
        console.error('❌ Product Owner Node エラー:', error);
        // Return error state
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'error',
                    source: 'ProductOwnerNode',
                    message: `タスク生成に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
                    data: { error },
                },
            ],
            metadata: {
                hasErrors: true,
                errors: [error instanceof Error ? error.message : String(error)],
            },
        };
    }
}
//# sourceMappingURL=ProductOwnerNode.js.map