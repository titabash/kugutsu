/**
 * Task Breakdown Node
 *
 * 承認された設計書からタスクを洗い出し、依存関係を分析
 *
 * 生成物:
 * - タスクリスト (task-list.json)
 * - 依存関係グラフ (dependency-graph.json)
 * - Kanban初期状態 (kanban-state.json)
 */
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import { DataPersistence } from '../../utils/DataPersistence.js';
import { MessageHandler } from '../../utils/MessageHandler.js';
import path from 'path';
import { FileSystemManager } from '../../utils/FileSystemManager.js';
import { JSONExtractor } from '../../utils/JSONExtractor.js';
/**
 * Task Breakdown Node
 *
 * Responsibilities:
 * 1. Load approved design documents
 * 2. Load story mapping for reference
 * 3. Use AI to break down into concrete tasks
 * 4. Analyze dependencies between tasks
 * 5. Generate dependency graph
 * 6. Create initial Kanban state
 * 7. Save all artifacts
 */
export async function taskBreakdownNode(state) {
    const { config, currentProjectId } = state;
    const maxTurns = config.maxTurns || 50;
    console.log('📋 TaskBreakdown: タスク分解開始');
    if (!currentProjectId) {
        console.log('⚠️ プロジェクトIDが指定されていません');
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'warn',
                    source: 'task_breakdown',
                    message: 'プロジェクトIDなし',
                },
            ],
        };
    }
    // データ永続化マネージャーを初期化
    const persistence = new DataPersistence(config.baseRepoPath);
    await persistence.initialize();
    // ストーリーマッピングを読み込み
    const storyMapping = await persistence.loadStoryMapping(currentProjectId);
    if (!storyMapping) {
        console.log('⚠️ ストーリーマッピングが見つかりません');
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'warn',
                    source: 'task_breakdown',
                    message: 'ストーリーマッピングなし',
                },
            ],
        };
    }
    // 設計書を読み込み
    const dbSchema = await persistence.loadDatabaseSchema(currentProjectId);
    const apiSpec = await persistence.loadAPISpec(currentProjectId);
    const uiuxScreens = await persistence.loadUIUXScreens(currentProjectId);
    console.log('📖 設計書読み込み完了');
    // AIプロバイダーを作成
    const providerConfig = AIProviderFactory.buildProviderConfig({
        provider: config.provider || 'claude',
    });
    const provider = AIProviderFactory.create(providerConfig);
    console.log('🤖 AI: タスク分解実行中...');
    // タスク分解プロンプトを構築
    const taskBreakdownPrompt = buildTaskBreakdownPrompt(storyMapping, dbSchema, apiSpec, uiuxScreens);
    const handler = new MessageHandler({
        maxTurns,
        nodeName: 'TaskBreakdown - Task Analysis',
    });
    let aiResponseText = '';
    for await (const message of provider.execute(taskBreakdownPrompt, {
        maxTurns,
        cwd: config.baseRepoPath,
        allowedTools: ['Read', 'Glob', 'Grep'],
        permissionMode: 'acceptEdits',
        includePartialMessages: true,
    })) {
        await handler.handleMessage(message);
        if (message.type === 'assistant' && message.content) {
            if (typeof message.content === 'string') {
                aiResponseText += message.content;
            }
            else {
                aiResponseText += JSON.stringify(message.content);
            }
        }
    }
    // エラーチェック（Claude Agent SDK仕様準拠）
    if (handler.getHasError()) {
        const details = handler.getErrorDetails();
        // エラーメッセージの構築
        let errorMsg;
        if (details?.message) {
            errorMsg = details.subtype === 'error_max_turns'
                ? `AI実行がmaxTurns制限に到達しました: ${details.message}`
                : `AI実行中にエラーが発生しました: ${details.message}`;
        }
        else if (details?.errors && details.errors.length > 0) {
            errorMsg = `AI実行中にエラーが発生しました: ${details.errors.join('; ')}`;
        }
        else {
            errorMsg = `AI実行中にエラーが発生しました (subtype: ${details?.subtype || 'unknown'})`;
            console.warn(`⚠️  エラー詳細が取得できませんでした。ErrorDetails:`, JSON.stringify(details, null, 2));
        }
        throw new Error(errorMsg);
    }
    handler.complete(true, 'タスク分解が完了しました');
    // タスクリストを抽出（JSONExtractorを使用、エラーハンドリング強化）
    const extractionResult = JSONExtractor.extractTaskList(aiResponseText);
    if (!extractionResult.success) {
        console.error('❌ タスク分解に失敗しました:', extractionResult.error);
        if (extractionResult.rawJSON) {
            console.error('📄 抽出されたJSON（切り詰め）:', extractionResult.rawJSON);
        }
        if (extractionResult.parseError) {
            console.error('🔍 パースエラー詳細:', extractionResult.parseError);
        }
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'error',
                    source: 'task_breakdown',
                    message: `タスク分解失敗: ${extractionResult.error}`,
                    data: {
                        rawJSON: extractionResult.rawJSON,
                        parseError: extractionResult.parseError?.message,
                    },
                },
            ],
        };
    }
    const taskList = extractionResult.data;
    console.log(`✅ タスク分解完了: ${taskList.length}個のタスク`);
    // 依存関係グラフを構築
    const dependencyGraph = buildDependencyGraph(taskList);
    console.log(`📊 依存関係分析完了: ${dependencyGraph.edges.length}個の依存関係`);
    // Kanban初期状態を作成
    const kanbanState = buildInitialKanbanState(taskList);
    // 保存
    await persistence.saveTaskList(currentProjectId, taskList);
    await persistence.saveDependencyGraph(currentProjectId, dependencyGraph);
    await persistence.saveKanbanState(currentProjectId, kanbanState);
    console.log('💾 タスク情報を保存しました');
    // Convert to TaskArtifact format and save to .kugutsu/tasks.json
    // This ensures compatibility with EngineerNode which expects this file
    const taskArtifacts = taskList.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        dependencies: task.dependencies,
        status: task.status,
        createdAt: task.createdAt,
        updatedAt: task.createdAt,
    }));
    const tasksJsonPath = path.join(config.baseRepoPath, '.kugutsu', 'tasks.json');
    await FileSystemManager.writeJSON(tasksJsonPath, taskArtifacts);
    console.log(`💾 .kugutsu/tasks.json を保存しました（${taskArtifacts.length}タスク）`);
    // サマリー表示
    console.log('\n📊 タスク分解サマリー:');
    console.log(`  - タスク総数: ${taskList.length}個`);
    console.log(`  - 依存関係: ${dependencyGraph.edges.length}個`);
    console.log(`  - 並列実行可能グループ: ${dependencyGraph.parallelGroups.length}個`);
    console.log(`  - クリティカルパス長: ${dependencyGraph.criticalPath.length}タスク`);
    // GlobalTask形式に変換
    const globalTasks = taskList.map((task) => {
        // Map TaskItem type to GlobalTask type
        let globalTaskType;
        switch (task.type) {
            case 'bug':
                globalTaskType = 'bugfix';
                break;
            case 'doc':
                globalTaskType = 'docs';
                break;
            case 'feature':
            case 'refactor':
            case 'test':
                globalTaskType = task.type;
                break;
            default:
                globalTaskType = 'feature';
        }
        // Map TaskItem status to GlobalTask status
        let globalTaskStatus;
        switch (task.status) {
            case 'ready':
                globalTaskStatus = 'pending';
                break;
            case 'in_review':
                globalTaskStatus = 'in_progress';
                break;
            case 'pending':
            case 'in_progress':
            case 'completed':
            case 'failed':
                globalTaskStatus = task.status;
                break;
            default:
                globalTaskStatus = 'pending';
        }
        return {
            id: task.id,
            type: globalTaskType,
            title: task.title,
            description: task.description,
            priority: task.priority,
            dependencies: task.dependencies,
            status: globalTaskStatus,
            projectId: currentProjectId,
            requestTimestamp: new Date(),
            dynamicPriority: task.priority * 10, // Convert 0-100 to 0-1000
            createdAt: new Date(task.createdAt),
            storyId: task.storyId,
        };
    });
    return {
        globalTasks: globalTasks,
        dependencyGraph: dependencyGraph,
        tasksPath: '.kugutsu/tasks.json',
        logs: [
            {
                timestamp: new Date(),
                level: 'success',
                source: 'task_breakdown',
                message: `タスク分解完了（${taskList.length}タスク、${dependencyGraph.edges.length}依存関係）`,
            },
        ],
    };
}
/**
 * タスク分解プロンプトを構築
 */
function buildTaskBreakdownPrompt(storyMapping, dbSchema, apiSpec, uiuxScreens) {
    const dbSchemaStr = dbSchema ? JSON.stringify(dbSchema, null, 2) : 'なし';
    const apiSpecStr = apiSpec ? JSON.stringify(apiSpec, null, 2) : 'なし';
    const uiuxScreensStr = uiuxScreens ? JSON.stringify(uiuxScreens, null, 2) : 'なし';
    return `
# タスク分解

あなたはTechLeadとして、以下の設計書から実装可能なタスクに分解してください。

## ストーリーマッピング

\`\`\`json
${JSON.stringify(storyMapping, null, 2)}
\`\`\`

## DB Schema

\`\`\`json
${dbSchemaStr}
\`\`\`

## API Specification

\`\`\`json
${apiSpecStr}
\`\`\`

## UI/UX Screens

\`\`\`json
${uiuxScreensStr}
\`\`\`

## タスク分解の原則

1. **共通基盤の先行タスク化**: 複数機能で共有される基盤を独立タスクとして先に生成
2. **マイクロ一気通関**: 1タスクでフロントエンド〜バックエンド〜DBまで完結
3. **適切な粒度**: 1タスクは4-8時間で完了可能
4. **独立価値提供**: 各タスクが独立したユーザー価値を提供
5. **真の依存関係**: 技術的に真に必要な依存関係のみ設定
6. **並列最大化**: 可能な限り並列実行できるよう設計

## タスク分解戦略

### ⚠️ 共通基盤の自動検出と先行タスク化

**各タスク分解時に、以下の共通基盤を検出し、独立タスクとして先に生成してください:**

1. **DBクライアントのシングルトン** (例: \`lib/supabase.ts\`, \`lib/prisma.ts\`)
2. **外部サービスクライアント** (例: \`lib/stripe.ts\`, \`lib/sendgrid.ts\`)
3. **共通データモデル・型定義** (例: \`models/User.ts\`, \`types/api.ts\`)
4. **共通ユーティリティ関数** (例: \`utils/date.ts\`, \`utils/validation.ts\`)
5. **認証・認可基盤** (例: JWT認証、セッション管理)
6. **共通UIコンポーネント** (例: \`components/ui/Button.tsx\`)

**検出方法**:
- ユーザーストーリーから必要な共通基盤を推測
- 複数タスクで使用される要素を特定
- 例: 「決済機能」→ Stripeクライアント、決済型定義が必要

### フルスタックタスクの例

❌ **悪い例（レイヤー分割）**:
- Task 1: DB migration作成
- Task 2: Model実装
- Task 3: API実装
- Task 4: Frontend実装

❌ **悪い例（共通基盤を各タスクに含める - 並列実行で競合）**:
- Task 1: ユーザー登録機能（DB migration + Supabaseクライアント + Model + API + Frontend）
- Task 2: ユーザープロフィール機能（DB migration + Supabaseクライアント + Model + API + Frontend）
→ **危険**: 複数タスクが同時にSupabaseクライアントとDB migrationを実行

✅ **良い例（共通基盤を先行タスク化）**:
- Task 1: **Supabaseクライアントとユーザー関連DBスキーマ構築** (lib/supabase.ts + DB migration) ← 先行タスク
- Task 2: ユーザー登録機能（Task 1に依存。Model + API + Frontend）
- Task 3: ユーザープロフィール機能（Task 1に依存。Model + API + Frontend）

### 依存関係の設定

**真の依存関係**（設定すべき）:
- 「DBクライアント + DBスキーマ」→「各機能のDB操作」
- 「共通データモデル・型定義」→「各機能のAPI実装」
- 「認証基盤」→「認証が必要な各機能」
- 「共通UIコンポーネント」→「各機能画面」

**偽の依存関係**（設定すべきでない）:
- 「ユーザー登録」→「商品一覧」（独立して実装可能）
- 「DB migration」→「API実装」（共通基盤タスクとして分離済みの場合）

## 出力形式

JSON形式で以下の構造で出力してください：

\`\`\`json
{
  "tasks": [
    {
      "id": "task-{uuid}",
      "title": "タスク名",
      "description": "詳細な説明（何を実装するか、どのように実装するか）",
      "storyId": "story-1-1",
      "type": "feature",
      "priority": 90,
      "estimatedPoints": 5,
      "dependencies": ["task-{uuid}"],
      "acceptanceCriteria": [
        "基準1",
        "基準2"
      ],
      "technicalNotes": "技術的な注意点",
      "status": "pending"
    }
  ]
}
\`\`\`

## 重要事項

- 各タスクは必ず \`id\`, \`title\`, \`description\`, \`type\`, \`priority\`, \`estimatedPoints\`, \`dependencies\`, \`acceptanceCriteria\`, \`status\` を含むこと
- \`id\` は "task-" で始まる一意な識別子
- \`type\` は "feature", "bug", "refactor", "test", "doc" のいずれか
- \`priority\` は 0-100 の整数
- \`estimatedPoints\` は フィボナッチ数（1,2,3,5,8,13,21）
- \`dependencies\` は依存タスクIDの配列（依存なしの場合は空配列）
- \`status\` は "pending"
- \`storyId\` は対応するユーザーストーリーのID（該当する場合）

## タスク生成

ストーリーマッピングの各Epicとストーリーを参照し、実装に必要なタスクを生成してください。
`.trim();
}
/**
 * 依存関係グラフを構築
 */
function buildDependencyGraph(tasks) {
    const nodes = tasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
    }));
    const edges = [];
    // 依存関係をエッジに変換
    tasks.forEach((task) => {
        task.dependencies.forEach((depId) => {
            edges.push({
                from: task.id,
                to: depId,
                type: 'depends_on',
            });
        });
    });
    // クリティカルパスを計算（トポロジカルソート）
    const criticalPath = calculateCriticalPath(tasks);
    // 並列実行可能グループを計算
    const parallelGroups = calculateParallelGroups(tasks);
    return {
        nodes,
        edges,
        criticalPath,
        parallelGroups,
    };
}
/**
 * クリティカルパスを計算（最長経路）
 */
function calculateCriticalPath(tasks) {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const visited = new Set();
    const path = [];
    function dfs(taskId, currentPath) {
        if (visited.has(taskId)) {
            return currentPath;
        }
        visited.add(taskId);
        const task = taskMap.get(taskId);
        if (!task || task.dependencies.length === 0) {
            return [...currentPath, taskId];
        }
        let longestPath = currentPath;
        task.dependencies.forEach((depId) => {
            const depPath = dfs(depId, [...currentPath, taskId]);
            if (depPath.length > longestPath.length) {
                longestPath = depPath;
            }
        });
        return longestPath;
    }
    // すべての終端ノード（依存されていないタスク）から探索
    const dependedTasks = new Set(tasks.flatMap((t) => t.dependencies));
    const terminalTasks = tasks.filter((t) => !dependedTasks.has(t.id));
    let longestPath = [];
    terminalTasks.forEach((task) => {
        visited.clear();
        const path = dfs(task.id, []);
        if (path.length > longestPath.length) {
            longestPath = path;
        }
    });
    return longestPath.reverse();
}
/**
 * 並列実行可能グループを計算
 */
function calculateParallelGroups(tasks) {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const groups = [];
    const processed = new Set();
    // トポロジカルソート順にグループ化
    while (processed.size < tasks.length) {
        const currentGroup = [];
        tasks.forEach((task) => {
            if (processed.has(task.id)) {
                return;
            }
            // すべての依存タスクが処理済みか確認
            const allDepsProcessed = task.dependencies.every((depId) => processed.has(depId));
            if (allDepsProcessed) {
                currentGroup.push(task.id);
            }
        });
        if (currentGroup.length === 0) {
            // 循環依存が存在する場合は強制的に追加
            const remaining = tasks.filter((t) => !processed.has(t.id));
            if (remaining.length > 0) {
                currentGroup.push(remaining[0].id);
            }
        }
        currentGroup.forEach((id) => processed.add(id));
        groups.push(currentGroup);
    }
    return groups;
}
/**
 * Kanban初期状態を構築
 */
function buildInitialKanbanState(tasks) {
    return {
        columns: [
            { id: 'pending', name: 'Pending', taskIds: tasks.map((t) => t.id) },
            { id: 'ready', name: 'Ready', taskIds: [] },
            { id: 'in_progress', name: 'In Progress', taskIds: [] },
            { id: 'in_review', name: 'In Review', taskIds: [] },
            { id: 'completed', name: 'Completed', taskIds: [] },
            { id: 'failed', name: 'Failed', taskIds: [] },
        ],
        tasks: tasks,
        metadata: {
            totalTasks: tasks.length,
            completedTasks: 0,
            inProgressTasks: 0,
            lastUpdated: new Date().toISOString(),
        },
    };
}
//# sourceMappingURL=TaskBreakdownNode.js.map