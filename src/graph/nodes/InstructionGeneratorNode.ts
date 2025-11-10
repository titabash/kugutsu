/**
 * InstructionGeneratorNode
 *
 * スプリントスコープのタスクについて並列でinstruction.mdを生成するノード
 */

import type { ParallelDevStateType, ParallelDevStateUpdate } from '../state.js';
import type { ParallelDevConfig, LogEntry } from '../types.js';
import type { GlobalTask } from '../../types/index.js';
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import type { AIProviderConfig } from '../../providers/IAIProvider.js';

/**
 * Wrapper Node: スプリントスコープのタスクについて並列でinstruction.md生成
 */
export async function instructionGeneratorNode(
  state: ParallelDevStateType
): Promise<Partial<ParallelDevStateType>> {
  // activeSprint.idの必須チェック
  if (!state.activeSprint?.id) {
    console.error('❌ アクティブなスプリントが設定されていません');
    return {
      logs: [{
        timestamp: new Date(),
        level: 'error',
        source: 'InstructionGeneratorNode',
        message: 'アクティブなスプリントが設定されていません',
      }],
    };
  }

  // スプリントスコープのタスクのみフィルタリング
  const sprintTasks = (state.globalTasks || []).filter(
    task => state.activeSprint?.taskIds.includes(task.id)
  );

  if (sprintTasks.length === 0) {
    console.log('ℹ️ スプリント内のタスクがありません');
    return {
      logs: [{
        timestamp: new Date(),
        level: 'info',
        source: 'InstructionGeneratorNode',
        message: 'スプリント内のタスクがありません',
      }],
    };
  }

  console.log(`📝 ${sprintTasks.length}個のタスクのinstruction.mdを並列生成中...`);

  // 並列実行（Promise.allSettled）
  const results = await Promise.allSettled(
    sprintTasks.map(task =>
      generateInstructionForTask(state, task, state.config)
    )
  );

  // 結果を集約
  const logs: LogEntry[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const [index, settledResult] of results.entries()) {
    const task = sprintTasks[index];

    if (settledResult.status === 'fulfilled') {
      successCount++;
      logs.push({
        timestamp: new Date(),
        level: 'info',
        source: 'InstructionGeneratorNode',
        message: `Task ${task.id} のinstruction.md生成完了`,
      });
    } else {
      failureCount++;
      logs.push({
        timestamp: new Date(),
        level: 'error',
        source: 'InstructionGeneratorNode',
        message: `Task ${task.id} のinstruction.md生成失敗: ${settledResult.reason}`,
        data: { error: settledResult.reason },
      });
    }
  }

  console.log(`✅ ${successCount}個成功、❌ ${failureCount}個失敗`);

  return {
    logs,
  };
}

/**
 * Individual Generator: 個別タスクのinstruction.md生成
 */
async function generateInstructionForTask(
  state: ParallelDevStateType,
  task: GlobalTask,
  config: ParallelDevConfig
): Promise<void> {
  const providerConfig: AIProviderConfig = {
    provider: config.provider || 'claude',
    claude: {
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
    },
  };

  const provider = AIProviderFactory.create(providerConfig);

  const sprintId = state.activeSprint?.id;
  if (!sprintId) {
    throw new Error('アクティブなスプリントが設定されていません');
  }

  // currentProjectIdの必須チェック
  if (!state.currentProjectId) {
    throw new Error('currentProjectIdが設定されていません');
  }

  // コンテキストの構築（高複雑度 vs 低複雑度）
  let context: string;

  if (state.storyMapping && state.designDocs) {
    // 高複雑度パス: 設計書を参照
    context = buildHighComplexityContext(
      state.storyMapping,
      state.designDocs,
      task
    );
  } else {
    // 低複雑度パス: ユーザーリクエストとタスク定義を参照
    context = buildLowComplexityContext(
      state.userRequest,
      task
    );
  }

  // AI-First原則: AIがWriteツールで直接ファイル作成
  const instructionPath = `.kugutsu/sprints/${sprintId}/tasks/${task.id}/instruction.md`;

  const prompt = `
以下のタスクについて、エンジニアが実装するための詳細な指示書（instruction.md）を作成してください。

**ファイルパス**: \`${instructionPath}\`
**必須**: Writeツールを使用して、上記パスにファイルを作成してください。

タスク情報:
${JSON.stringify(task, null, 2)}

コンテキスト:
${context}

指示書に含めるべき項目:
1. タスクの目的・背景
2. 実装すべき機能の詳細
3. 技術的制約・要件
4. 受入基準（Definition of Done）
5. 参考資料・関連ファイル

出力形式: Markdown
  `.trim();

  // AI-First: AIがWriteツールで直接ファイル作成
  for await (const message of provider.execute(prompt, {
    maxTurns: config.maxTurns || 10,
    cwd: config.baseRepoPath,
    allowedTools: ['Write'], // AI-First: AIにファイル作成させる
    permissionMode: 'acceptEdits',
    includePartialMessages: true,
  })) {
    // AIがWriteツールでファイル作成するため、コンテンツ収集は不要
  }
}

/**
 * 高複雑度パス用のコンテキスト構築
 */
function buildHighComplexityContext(
  storyMapping: any,
  designDocs: any,
  task: GlobalTask
): string {
  return `
# ストーリーマッピング

${JSON.stringify(storyMapping, null, 2)}

# 設計書

## Design Docs
${designDocs.designDocsPath || 'なし'}

## UI/UX設計
${designDocs.uiuxPath || 'なし'}

## DB設計
${designDocs.databasePath || 'なし'}

## API仕様
${designDocs.apiPath || 'なし'}
  `;
}

/**
 * 低複雑度パス用のコンテキスト構築
 */
function buildLowComplexityContext(
  userRequest: string,
  task: GlobalTask
): string {
  return `
# ユーザーリクエスト

${userRequest}

# タスクの技術的詳細

${task.description}
  `;
}
