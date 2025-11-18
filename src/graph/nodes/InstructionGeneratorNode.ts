/**
 * InstructionGeneratorNode
 *
 * 単一タスクのinstruction.mdを生成するノード（Send API対応）
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ParallelDevStateType, ParallelDevStateUpdate } from '../state.js';
import type { ParallelDevConfig, LogEntry } from '../types.js';
import type { GlobalTask } from '../../types/index.js';
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import { MessageHandler } from '../../utils/MessageHandler.js';
import { DataPersistence } from '../../utils/DataPersistence.js';

/**
 * Single Task Generator: 単一タスクのinstruction.md生成
 *
 * LangGraph Send APIで渡された単一タスクを処理します。
 * タスクのinstructionGeneratedフラグを更新してglobalTasksを返します。
 */
export async function instructionGeneratorNode(
  state: ParallelDevStateType
): Promise<ParallelDevStateUpdate> {
  // Check for cancellation early
  if (state.metadata?.cancelled) {
    console.log('🛑 [InstructionGeneratorNode] Workflow cancelled, skipping execution');
    return {
      logs: [{
        timestamp: new Date(),
        level: 'info',
        source: 'InstructionGenerator',
        message: 'Workflow cancelled, skipping instruction generation',
      }],
      failedProviders: AIProviderFactory.getFailedProviders(),
    };
  }

  // Sync failed providers from state
  AIProviderFactory.syncWithState(state.failedProviders || []);

  // state.taskToProcess から単一タスクを取得（Send APIで渡される）
  const task = state.taskToProcess;

  if (!task) {
    console.error('❌ 処理するタスクが設定されていません');
    return {
      logs: [{
        timestamp: new Date(),
        level: 'error',
        source: 'InstructionGenerator',
        message: '処理するタスクが設定されていません',
      }],
      failedProviders: AIProviderFactory.getFailedProviders(),
    };
  }

  console.log(`📝 Task ${task.id} のinstruction.md生成中...`);

  try {
    // instruction.md生成実行
    await generateInstructionForTask(state, task, state.config);

    // タスクの完了状態を更新（LangGraphステート更新のみ）
    const updatedGlobalTasks = (state.globalTasks || []).map(t => {
      if (t.id === task.id) {
        return {
          ...t,
          instructionGenerated: true,
          instructionGenerating: false,
          instructionGeneratedAt: new Date(),
        };
      }
      return t;
    });

    console.log(`✅ Task ${task.id} のinstruction.md生成完了`);

    return {
      globalTasks: updatedGlobalTasks,
      logs: [{
        timestamp: new Date(),
        level: 'info',
        source: 'InstructionGenerator',
        message: `Task ${task.id} のinstruction.md生成完了`,
        data: { taskId: task.id },
      }],
      failedProviders: AIProviderFactory.getFailedProviders(),
    };
  } catch (error) {
    console.error(`❌ Task ${task.id} のinstruction.md生成失敗:`, error);

    // タスクのinstructionErrorを記録（LangGraphステート更新のみ）
    const updatedGlobalTasks = (state.globalTasks || []).map(t => {
      if (t.id === task.id) {
        return {
          ...t,
          instructionGenerated: false,
          instructionGenerating: false,
          instructionError: String(error),
        };
      }
      return t;
    });

    return {
      globalTasks: updatedGlobalTasks,
      logs: [{
        timestamp: new Date(),
        level: 'error',
        source: 'InstructionGenerator',
        message: `Task ${task.id} のinstruction.md生成失敗: ${error}`,
        data: { taskId: task.id, error: String(error) },
      }],
      failedProviders: AIProviderFactory.getFailedProviders(),
    };
  }
}

/**
 * Individual Generator: 個別タスクのinstruction.md生成
 */
async function generateInstructionForTask(
  state: ParallelDevStateType,
  task: GlobalTask,
  config: ParallelDevConfig
): Promise<void> {
  const providerConfig = AIProviderFactory.buildProviderConfig({
    provider: config.provider || 'claude',
  });

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
4. 環境セットアップ手順
   - このタスクは隔離されたGit Worktree環境で実行されます
   - エンジニアが実装を開始する前に行うべき環境初期化手順を明記してください
   - 例: 依存関係のインストール（npm install, pip install, go mod download等）、設定ファイルのコピー、ビルドの実行等
   - プロジェクトの種類（Node.js, Python, Go, Rust等）に応じた適切な初期化手順を判断して記載してください
   - package.json, requirements.txt, go.mod, Cargo.toml等の存在を確認し、必要なコマンドを提示してください
5. 受入基準（Definition of Done）
6. 参考資料・関連ファイル

出力形式: Markdown
  `.trim();

  // AI-First: AIがWriteツールで直接ファイル作成
  const messageHandler = new MessageHandler({
    maxTurns: config.maxTurns || 10,
    nodeName: 'InstructionGenerator',
    taskId: task.id,
    verbose: false,
  });

  // Check for abort before starting AI execution
  if (config.abortSignal?.aborted) {
    throw new Error('Execution aborted');
  }

  for await (const message of provider.execute(prompt, {
    maxTurns: config.maxTurns || 10,
    cwd: config.baseRepoPath,
    allowedTools: ['Write'], // AI-First: AIにファイル作成させる
    permissionMode: 'acceptEdits',
    includePartialMessages: true,
  })) {
    // Check for abort in message loop
    if (config.abortSignal?.aborted) {
      console.log('🛑 [InstructionGeneratorNode] Abort detected in message loop, stopping iteration');
      throw new Error('Execution aborted');
    }

    // MessageHandlerでメッセージを処理
    await messageHandler.handleMessage(message);
  }

  // エラーチェック（Claude Agent SDK仕様準拠）
  if (messageHandler.getHasError()) {
    const details = messageHandler.getErrorDetails();
    let errorMsg: string;
    if (details?.message) {
      errorMsg = details.subtype === 'error_max_turns'
        ? `AI実行がmaxTurns制限に到達しました: ${details.message}`
        : `AI実行中にエラーが発生しました: ${details.message}`;
    } else if (details?.errors && details.errors.length > 0) {
      errorMsg = `AI実行中にエラーが発生しました: ${details.errors.join('; ')}`;
    } else {
      errorMsg = `AI実行中にエラーが発生しました (subtype: ${details?.subtype || 'unknown'})`;
    }
    throw new Error(`インストラクション生成エラー (タスク: ${task.id}): ${errorMsg}`);
  }

  // ファイル作成の検証
  const fullInstructionPath = path.join(config.baseRepoPath, instructionPath);
  const fileExists = fs.existsSync(fullInstructionPath);

  if (!fileExists) {
    const errorDetails = messageHandler.getErrorDetails();
    const errorMessage = errorDetails
      ? `AI実行エラー: ${errorDetails.message || errorDetails.subtype || 'Unknown error'}`
      : 'AIがファイル作成をスキップした可能性があります';

    throw new Error(
      `instruction.md の作成に失敗しました (タスク: ${task.id})\n` +
      `ファイルパス: ${instructionPath}\n` +
      `詳細: ${errorMessage}`
    );
  }

  console.log(`✅ Task ${task.id} のinstruction.md作成成功: ${instructionPath}`);
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
