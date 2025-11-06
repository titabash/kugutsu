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

import type { ParallelDevStateType, ParallelDevStateUpdate } from '../state.js';
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import type { AIProviderConfig } from '../../providers/IAIProvider.js';
import { DataPersistence } from '../../utils/DataPersistence.js';
import type { StoryMapping } from '../../types/scrum.js';
import { randomUUID } from 'crypto';

/**
 * タスク定義
 */
interface TaskItem {
  id: string;
  title: string;
  description: string;
  storyId?: string; // 対応するユーザーストーリーID
  type: 'feature' | 'bug' | 'refactor' | 'test' | 'doc';
  priority: number; // 0-100
  estimatedPoints: number; // フィボナッチ数（1,2,3,5,8,13,21）
  dependencies: string[]; // 依存タスクIDのリスト
  acceptanceCriteria: string[];
  technicalNotes?: string;
  assignedTo?: string; // 割り当て先（未割り当ての場合はnull）
  status: 'pending' | 'ready' | 'in_progress' | 'in_review' | 'completed' | 'failed';
  createdAt: string;
}

/**
 * 依存関係グラフ
 */
interface DependencyGraph {
  nodes: {
    id: string;
    title: string;
    status: string;
  }[];
  edges: {
    from: string;
    to: string;
    type: 'depends_on' | 'blocks';
  }[];
  criticalPath: string[];
  parallelGroups: string[][];
}

/**
 * Kanban状態
 */
interface KanbanState {
  columns: {
    id: string;
    name: string;
    taskIds: string[];
  }[];
  tasks: TaskItem[];
  metadata: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    lastUpdated: string;
  };
}

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
export async function taskBreakdownNode(
  state: ParallelDevStateType
): Promise<ParallelDevStateUpdate> {
  const { config, currentProjectId } = state;

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
  const providerConfig: AIProviderConfig = {
    provider: config.provider || 'claude',
    claude: {
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
    },
  };

  const provider = AIProviderFactory.create(providerConfig);

  console.log('🤖 AI: タスク分解実行中...');

  // タスク分解プロンプトを構築
  const taskBreakdownPrompt = buildTaskBreakdownPrompt(
    storyMapping,
    dbSchema,
    apiSpec,
    uiuxScreens
  );

  let aiResponseText = '';
  for await (const message of provider.execute(taskBreakdownPrompt, {
    maxTurns: 30,
    cwd: config.baseRepoPath,
    allowedTools: ['Read', 'Glob', 'Grep'],
    permissionMode: 'acceptEdits',
  })) {
    if (message.type === 'assistant' && message.content) {
      if (typeof message.content === 'string') {
        aiResponseText += message.content;
      } else {
        aiResponseText += JSON.stringify(message.content);
      }
    }
  }

  // タスクリストを抽出
  const taskList = extractTaskList(aiResponseText);

  if (!taskList || taskList.length === 0) {
    console.log('❌ タスク分解に失敗しました');
    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'error',
          source: 'task_breakdown',
          message: 'タスク分解失敗',
        },
      ],
    };
  }

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

  // サマリー表示
  console.log('\n📊 タスク分解サマリー:');
  console.log(`  - タスク総数: ${taskList.length}個`);
  console.log(`  - 依存関係: ${dependencyGraph.edges.length}個`);
  console.log(`  - 並列実行可能グループ: ${dependencyGraph.parallelGroups.length}個`);
  console.log(`  - クリティカルパス長: ${dependencyGraph.criticalPath.length}タスク`);

  // GlobalTask形式に変換
  const globalTasks = taskList.map((task) => {
    // Map TaskItem type to GlobalTask type
    let globalTaskType: 'feature' | 'bugfix' | 'refactor' | 'test' | 'docs' | 'conflict-resolution';
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
    let globalTaskStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
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
function buildTaskBreakdownPrompt(
  storyMapping: StoryMapping,
  dbSchema: any,
  apiSpec: any,
  uiuxScreens: any
): string {
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

1. **マイクロ一気通関**: 1タスクでフロントエンド〜バックエンド〜DBまで完結
2. **適切な粒度**: 1タスクは4-8時間で完了可能
3. **独立価値提供**: 各タスクが独立したユーザー価値を提供
4. **真の依存関係**: 技術的に真に必要な依存関係のみ設定
5. **並列最大化**: 可能な限り並列実行できるよう設計

## タスク分解戦略

### フルスタックタスクの例

❌ **悪い例（レイヤー分割）**:
- Task 1: DB migration作成
- Task 2: Model実装
- Task 3: API実装
- Task 4: Frontend実装

✅ **良い例（機能単位のフルスタック）**:
- Task 1: ユーザー登録機能（DB migration + Model + API + Frontend）

### 依存関係の設定

**真の依存関係**（設定すべき）:
- 「管理者ログイン機能」→「管理者ダッシュボード」
- 「認証基盤」→「権限管理」

**偽の依存関係**（設定すべきでない）:
- 「ユーザー登録」→「商品一覧」（独立して実装可能）
- 「DB migration」→「API実装」（同一タスク内で完結すべき）

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
 * AIレスポンスからタスクリストを抽出
 */
function extractTaskList(response: string): TaskItem[] {
  // JSONコードブロックを抽出
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);

  if (!jsonMatch) {
    console.error('❌ JSONブロックが見つかりません');
    return [];
  }

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    const tasks = parsed.tasks || [];

    // タスクの正規化
    return tasks.map((task: any) => ({
      id: task.id || `task-${randomUUID()}`,
      title: task.title || '無題タスク',
      description: task.description || '',
      storyId: task.storyId || undefined,
      type: task.type || 'feature',
      priority: task.priority || 50,
      estimatedPoints: task.estimatedPoints || 5,
      dependencies: task.dependencies || [],
      acceptanceCriteria: task.acceptanceCriteria || [],
      technicalNotes: task.technicalNotes || undefined,
      assignedTo: task.assignedTo || undefined,
      status: task.status || 'pending',
      createdAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('❌ JSONパースエラー:', error);
    return [];
  }
}

/**
 * 依存関係グラフを構築
 */
function buildDependencyGraph(tasks: TaskItem[]): DependencyGraph {
  const nodes = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
  }));

  const edges: DependencyGraph['edges'] = [];

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
function calculateCriticalPath(tasks: TaskItem[]): string[] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const path: string[] = [];

  function dfs(taskId: string, currentPath: string[]): string[] {
    if (visited.has(taskId)) {
      return currentPath;
    }

    visited.add(taskId);
    const task = taskMap.get(taskId);

    if (!task || task.dependencies.length === 0) {
      return [...currentPath, taskId];
    }

    let longestPath: string[] = currentPath;

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

  let longestPath: string[] = [];

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
function calculateParallelGroups(tasks: TaskItem[]): string[][] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const groups: string[][] = [];
  const processed = new Set<string>();

  // トポロジカルソート順にグループ化
  while (processed.size < tasks.length) {
    const currentGroup: string[] = [];

    tasks.forEach((task) => {
      if (processed.has(task.id)) {
        return;
      }

      // すべての依存タスクが処理済みか確認
      const allDepsProcessed = task.dependencies.every((depId) =>
        processed.has(depId)
      );

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
function buildInitialKanbanState(tasks: TaskItem[]): KanbanState {
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
