/**
 * Engineer Node
 *
 * Executes code implementation for a specific task
 *
 * **File-based Artifact Management:**
 * - Reads tasks from Sprint Backlog (`.kugutsu/sprints/{sprintId}/sprint-backlog.json`)
 * - Reads instruction from `.kugutsu/sprints/{sprintId}/tasks/{taskId}/instruction.md`
 * - Updates task status in Sprint Backlog after completion
 */

import { Command, interrupt } from '@langchain/langgraph';
import type { ParallelDevStateType, ParallelDevStateUpdate, FeedbackRequest } from '../state.js';
import type { Task } from '../types.js';
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import { FileReader } from '../../utils/FileReader.js';
import { DataPersistence } from '../../utils/DataPersistence.js';
import { TaskStateMachine } from '../../utils/TaskStateMachine.js';
import type { TaskArtifact } from '../../types/artifacts.js';
import { RetryManager } from '../../utils/RetryManager.js';
import { ErrorClassifier } from '../../utils/ErrorClassifier.js';
import { PrerequisiteChecker } from '../../utils/PrerequisiteChecker.js';
import { MessageHandler } from '../../utils/MessageHandler.js';
import { GitWorktreeManager } from '../../managers/GitWorktreeManager.js';
import { execSync } from 'child_process';

/**
 * Engineer Node
 *
 * Responsibilities:
 * 1. Implement code for the task
 * 2. Follow TDD approach
 * 3. Create appropriate commits
 * 4. Handle errors
 * 5. Preserve session for conflict resolution
 * 6. Transition task: in_progress → in_review (success) or failed (error)
 *
 * **Send API Compatible:**
 * This node is designed to be called via Send API with `currentTaskId` in state.
 * The taskId is retrieved from `state.currentTaskId` for parallel execution.
 *
 * **LangGraph Node Function Signature:**
 * LangGraph nodes receive only `(state)` as parameter. The second parameter
 * passed by LangGraph is the config object, not a custom parameter.
 */
export async function engineerNode(
  state: ParallelDevStateType
): Promise<ParallelDevStateUpdate> {
  const { config, tasks, tasksPath, activeSprint, currentTaskId } = state;
  const startTime = Date.now();

  // Retrieve task ID from state (Send API pattern)
  // LangGraph Send API sets currentTaskId in state when calling this node
  const taskId = currentTaskId;

  if (!taskId) {
    console.error('❌ taskId is not provided in state.currentTaskId');
    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'error',
          source: 'EngineerNode',
          message: 'taskId is not provided in state.currentTaskId',
        },
      ],
    };
  }

  // taskId が文字列でない場合のエラーハンドリング
  if (typeof taskId !== 'string') {
    console.error(`❌ taskId is not a string: type=${typeof taskId}, value=${JSON.stringify(taskId)}`);
    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'error',
          source: 'EngineerNode',
          message: `taskId is not a string: ${typeof taskId}`,
        },
      ],
    };
  }

  // アクティブスプリントIDを取得
  if (!activeSprint?.id) {
    console.error('❌ アクティブなスプリントが設定されていません');
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      const failedTask = TaskStateMachine.transition(task, 'failed');

      // Sync to globalTasks
      const globalTask = state.globalTasks.find((t) => t.id === taskId);
      const updatedGlobalTasks = globalTask
        ? [{
            ...globalTask,
            status: 'failed' as const,
            updatedAt: new Date(),
          }]
        : [];

      return {
        tasks: [failedTask],
        globalTasks: updatedGlobalTasks,
        failedTasks: [failedTask],
        logs: [
          {
            timestamp: new Date(),
            level: 'error',
            source: 'EngineerNode',
            message: 'アクティブなスプリントが設定されていません',
            taskId,
          },
        ],
        metadata: {
          tasksFailed: (state.metadata.tasksFailed || 0) + 1,
          hasErrors: true,
          errors: [
            ...(state.metadata.errors || []),
            `Task ${taskId}: No active sprint`,
          ],
        },
      };
    }

    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'error',
          source: 'EngineerNode',
          message: 'アクティブなスプリントが設定されていません',
          taskId,
        },
      ],
    };
  }

  const sprintId = activeSprint.id;

  // フィードバック受信チェック
  const feedback = state.feedbackRequest;
  if (feedback && feedback.targetNode === 'engineer' && feedback.details.taskId === taskId) {
    console.log(`📢 フィードバック受信: ${feedback.reason}`);
    console.log(`   詳細: ${JSON.stringify(feedback.details, null, 2)}`);
    console.log(`   リトライ回数: ${feedback.retryCount}`);
    // フィードバックを受信したので、クリアせずに通常処理へ進む
    // （クリアは処理成功時に行う）
  }

  // 前提条件チェック
  const prereqChecker = new PrerequisiteChecker(config);
  const prereqCheck = await prereqChecker.checkEngineer(state, taskId);

  if (!prereqCheck.success) {
    console.error(`❌ 前提条件エラー: ${prereqCheck.error}`);

    // 現在のリトライ回数を取得
    const currentRetryCount = state.nodeRetryCounters?.[prereqCheck.responsibleNode!] || 0;

    // 2回目のリトライ時に人間の確認を求める (Human-in-the-Loop)
    if (currentRetryCount === 2) {
      console.log(`⚠️ タスク ${taskId} で2回目のフィードバックが発生しました`);
      console.log(`前提条件エラー: ${prereqCheck.error}`);
      console.log(`責任ノード: ${prereqCheck.responsibleNode}`);

      // Interrupt: 人間の意思決定を待つ
      const userDecision = interrupt({
        message: `タスク ${taskId} で2回目のフィードバックが発生しました`,
        reason: prereqCheck.error,
        responsibleNode: prereqCheck.responsibleNode,
        missingFiles: prereqCheck.missingFiles,
        missingFields: prereqCheck.missingFields,
        options: {
          retry: '再試行する（もう1回フィードバックを送る）',
          skip: 'タスクをスキップする',
          fail: 'タスクを失敗としてマークする',
        },
        taskId,
        retryCount: currentRetryCount,
      });

      // ユーザーの選択に応じて処理
      if (userDecision === 'skip' || userDecision === 'fail') {
        console.log(`👤 ユーザー決定: ${userDecision}`);
        const task = state.tasks.find((t) => t.id === taskId);
        if (task) {
          const failedTask = TaskStateMachine.transition(task, 'failed');

          // Sync to globalTasks
          const globalTask = state.globalTasks.find((t) => t.id === taskId);
          const updatedGlobalTasks = globalTask
            ? [{
                ...globalTask,
                status: 'failed' as const,
                updatedAt: new Date(),
              }]
            : [];

          return {
            tasks: [failedTask],
            globalTasks: updatedGlobalTasks,
            failedTasks: [failedTask],
            logs: [
              {
                timestamp: new Date(),
                level: 'warn',
                source: 'EngineerNode',
                message: `ユーザー決定により${userDecision === 'skip' ? 'スキップ' : '失敗'}`,
                taskId,
              },
            ],
            feedbackRequest: null,
            metadata: {
              tasksFailed: (state.metadata.tasksFailed || 0) + 1,
            },
          };
        }
      }

      console.log(`👤 ユーザー決定: retry - 再試行します`);
      // retryの場合は通常のフィードバックフローに進む
    }

    // リトライ上限チェック（3回まで）
    if (currentRetryCount >= 3) {
      console.error(`⚠️ ノード ${prereqCheck.responsibleNode} へのフィードバックが上限（3回）に達しました`);

      // タスクをfailedに遷移
      const task = state.tasks.find((t) => t.id === taskId);
      if (task) {
        const failedTask = TaskStateMachine.transition(task, 'failed');

        // Sync to globalTasks
        const globalTask = state.globalTasks.find((t) => t.id === taskId);
        const updatedGlobalTasks = globalTask
          ? [{
              ...globalTask,
              status: 'failed' as const,
              updatedAt: new Date(),
            }]
          : [];

        return {
          tasks: [failedTask],
          globalTasks: updatedGlobalTasks,
          failedTasks: [failedTask],
          logs: [
            {
              timestamp: new Date(),
              level: 'error',
              source: 'EngineerNode',
              message: `前提条件エラー（リトライ上限）: ${prereqCheck.error}`,
              taskId,
            },
          ],
          feedbackRequest: null, // フィードバッククリア
          metadata: {
            tasksFailed: (state.metadata.tasksFailed || 0) + 1,
            hasErrors: true,
            errors: [
              ...(state.metadata.errors || []),
              `Task ${taskId}: ${prereqCheck.error}`,
            ],
          },
        };
      }
    }

    // フィードバックリクエスト発行
    const feedbackRequest: FeedbackRequest = {
      targetNode: prereqCheck.responsibleNode!,
      requestingNode: 'engineer',
      reason: prereqCheck.error!,
      details: {
        taskId,
        missingFiles: prereqCheck.missingFiles || [],
        missingFields: prereqCheck.missingFields || [],
      },
      retryCount: currentRetryCount + 1,
      timestamp: new Date(),
    };

    // 詳細なフィードバックログ
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔄 [FEEDBACK LOOP] EngineerノードがフィードバックをReissueしています`);
    console.log(`${'='.repeat(80)}`);
    console.log(`ターゲットノード: ${feedbackRequest.targetNode}`);
    console.log(`タスクID: ${taskId}`);
    console.log(`リトライ回数: ${feedbackRequest.retryCount}/3`);
    console.log(`理由: ${feedbackRequest.reason}`);
    console.log(`不足ファイル: ${feedbackRequest.details.missingFiles?.join(', ') || 'なし'}`);
    console.log(`不足フィールド: ${feedbackRequest.details.missingFields?.join(', ') || 'なし'}`);
    console.log(`${'='.repeat(80)}\n`);

    return {
      feedbackRequest,
      feedbackHistory: [feedbackRequest],
      nodeRetryCounters: {
        [prereqCheck.responsibleNode!]: currentRetryCount + 1,
      },
      logs: [
        {
          timestamp: new Date(),
          level: 'warn',
          source: 'EngineerNode',
          message: `フィードバック発行: ${prereqCheck.responsibleNode} へ (リトライ ${feedbackRequest.retryCount}/3)`,
          data: { feedback: feedbackRequest },
          taskId,
        },
      ],
    };
  }

  // Read task from Sprint Backlog
  const persistence = new DataPersistence(config.baseRepoPath);

  let taskArtifact: any;
  try {
    const backlog = await persistence.loadSprintBacklog(sprintId);
    if (!backlog || !backlog.tasks) {
      throw new Error(`Sprint Backlog not found: ${sprintId}`);
    }
    taskArtifact = backlog.tasks.find((t: any) => t.id === taskId);
    if (!taskArtifact) {
      throw new Error(`Task ${taskId} not found in Sprint Backlog`);
    }
  } catch (error) {
    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'error',
          source: 'EngineerNode',
          message: `Sprint Backlog の読み込みに失敗: ${error instanceof Error ? error.message : String(error)}`,
          taskId,
        },
      ],
    };
  }

  if (!taskArtifact) {
    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'error',
          source: 'EngineerNode',
          message: `タスク ${taskId} が見つかりません`,
          taskId,
        },
      ],
    };
  }

  // ✨ 実装開始ログ（詳細版）
  const task = tasks.find((t) => t.id === taskId);
  console.log(`\n${'='.repeat(70)}`);
  console.log(`👷 [${taskId}] ${task?.title || taskArtifact.title} - 実装開始`);
  console.log(`   Engineer: EngineerAI-${taskId}`);
  if (taskArtifact.worktreePath) {
    console.log(`   Worktree: ${taskArtifact.worktreePath}`);
  }
  if (taskArtifact.branchName) {
    console.log(`   Branch: ${taskArtifact.branchName}`);
  }
  console.log(`   最大ターン数: ${config.maxTurns}`);
  if (taskArtifact.dependencies.length > 0) {
    console.log(`   依存タスク: ${taskArtifact.dependencies.join(', ')}`);
  }
  console.log(`${'='.repeat(70)}\n`);

  if (!taskArtifact.worktreePath) {
    console.error(`❌ タスク ${taskId} のworktreeが設定されていません`);

    // タスクをfailedに遷移
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      const failedTask = TaskStateMachine.transition(task, 'failed');

      // Sync to globalTasks
      const globalTask = state.globalTasks.find((t) => t.id === taskId);
      const updatedGlobalTasks = globalTask
        ? [{
            ...globalTask,
            status: 'failed' as const,
            updatedAt: new Date(),
          }]
        : [];

      return {
        tasks: [failedTask],
        globalTasks: updatedGlobalTasks,
        failedTasks: [failedTask],
        logs: [
          {
            timestamp: new Date(),
            level: 'error',
            source: 'EngineerNode',
            message: `タスク ${taskId} のworktreeが設定されていません`,
            taskId,
          },
        ],
        metadata: {
          tasksFailed: (state.metadata.tasksFailed || 0) + 1,
          hasErrors: true,
          errors: [
            ...(state.metadata.errors || []),
            `Task ${taskId}: worktree not set`,
          ],
        },
      };
    }

    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'error',
          source: 'EngineerNode',
          message: `タスク ${taskId} のworktreeが設定されていません`,
          taskId,
        },
      ],
    };
  }

  // Read instruction.md
  const fileReader = new FileReader(config.baseRepoPath);
  const instructionPath = `.kugutsu/sprints/${sprintId}/tasks/${taskId}/instruction.md`;
  let instruction: string;
  try {
    instruction = await fileReader.readMarkdown(instructionPath);
  } catch (error) {
    console.error(`❌ instruction.md の読み込みに失敗: ${error instanceof Error ? error.message : String(error)}`);

    // タスクをfailedに遷移
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      const failedTask = TaskStateMachine.transition(task, 'failed');

      // Sync to globalTasks
      const globalTask = state.globalTasks.find((t) => t.id === taskId);
      const updatedGlobalTasks = globalTask
        ? [{
            ...globalTask,
            status: 'failed' as const,
            updatedAt: new Date(),
          }]
        : [];

      return {
        tasks: [failedTask],
        globalTasks: updatedGlobalTasks,
        failedTasks: [failedTask],
        logs: [
          {
            timestamp: new Date(),
            level: 'error',
            source: 'EngineerNode',
            message: `instruction.md の読み込みに失敗: ${error instanceof Error ? error.message : String(error)}`,
            taskId,
          },
        ],
        metadata: {
          tasksFailed: (state.metadata.tasksFailed || 0) + 1,
          hasErrors: true,
          errors: [
            ...(state.metadata.errors || []),
            `Task ${taskId}: instruction.md load failed`,
          ],
        },
      };
    }

    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'error',
          source: 'EngineerNode',
          message: `instruction.md の読み込みに失敗: ${error instanceof Error ? error.message : String(error)}`,
          taskId,
        },
      ],
    };
  }

  console.log(`📖 instruction.md を読み込みました`);

  // Read review.json if exists (修正実装の場合)
  const reviewPath = `.kugutsu/sprints/${sprintId}/tasks/${taskId}/review.json`;
  let reviewArtifact: any | null = null;
  try {
    const reviewContent = await fileReader.readFile(reviewPath);
    reviewArtifact = JSON.parse(reviewContent);
    console.log(`📖 review.json を読み込みました (修正実装)`);
  } catch (error) {
    // review.jsonがない場合は初回実装
    console.log(`📝 review.json が見つかりません (初回実装)`);
  }

  try {
    // Create AI provider
    const providerConfig = AIProviderFactory.buildProviderConfig({
      provider: state.config.provider || 'claude',
    });
    const provider = AIProviderFactory.create(providerConfig);

    // Build implementation prompt with instruction.md content
    const dependenciesSection = taskArtifact.dependencies.length > 0
      ? `このタスクは以下のタスクに依存しています：
${taskArtifact.dependencies.map((depId) => `- ${depId}`).join('\n')}

これらのタスクの変更内容を確認し、整合性を保ってください。`
      : 'このタスクに依存関係はありません。';

    // 設計書セクションの構築
    const storyMappingSection = state.storyMapping
      ? `
## 📖 参照：ストーリーマッピング

このタスクは全体のストーリーマッピングの一部です。全体の文脈を理解して実装してください。

\`\`\`json
${JSON.stringify(state.storyMapping, null, 2)}
\`\`\`
`
      : '';

    const designDocsSection = state.designDocs
      ? `
## 📐 参照：設計書

実装時は以下の設計書に準拠してください。

${state.designDocs.databasePath ? `### データベース設計
ファイルパス: ${state.designDocs.databasePath}
**Readツールで読み込んで参照してください**
` : ''}
${state.designDocs.apiPath ? `### API仕様
ファイルパス: ${state.designDocs.apiPath}
**Readツールで読み込んで参照してください**
` : ''}
${state.designDocs.uiuxPath ? `### UI/UX設計
ファイルパス: ${state.designDocs.uiuxPath}
**Readツールで読み込んで参照してください**
` : ''}
`
      : '';

    const sprintPlanSection = state.sprintPlanPath
      ? `
## 📅 参照：スプリント計画

ファイルパス: ${state.sprintPlanPath}
**Readツールで読み込んで参照してください**
このスプリントの目標とタスク全体を把握してください。
`
      : '';

    // レビューコメント取得ロジック
    const taskReviews = (state.reviews || [])
      .filter(r => r.taskId === taskId)
      .sort((a, b) => {
        const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
        const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
        return timeB - timeA;
      });

    const latestReview = taskReviews.length > 0 ? taskReviews[0] : null;

    // レビューフィードバックセクション
    const reviewFeedbackSection = latestReview && latestReview.status === 'changes_requested'
      ? `
## 🔍 前回のレビュー結果 - 修正が必要です

**レビュアー**: ${latestReview.reviewer}
**レビュー日時**: ${latestReview.timestamp instanceof Date ? latestReview.timestamp.toISOString() : latestReview.timestamp}

### 指摘事項:
${latestReview.comments.map((comment, idx) => `${idx + 1}. ${comment}`).join('\n')}

${latestReview.issues && latestReview.issues.length > 0 ? `
### 検出された問題:
${latestReview.issues.map((issue, idx) =>
  `${idx + 1}. [${issue.severity}] ${issue.description}${issue.file ? ` (${issue.file}${issue.line ? ':' + issue.line : ''})` : ''}`
).join('\n')}
` : ''}

${reviewArtifact && reviewArtifact.comments ? `
### 詳細なレビューコメント (review.jsonから):
${reviewArtifact.comments.map((comment: any, idx: number) =>
  `${idx + 1}. [${comment.severity || 'info'}] ${comment.message}${comment.file ? ` (${comment.file})` : ''}`
).join('\n')}
` : ''}

${reviewArtifact && reviewArtifact.suggestions && reviewArtifact.suggestions.length > 0 ? `
### 改善提案:
${reviewArtifact.suggestions.map((suggestion: string, idx: number) => `${idx + 1}. ${suggestion}`).join('\n')}
` : ''}

**重要**: 上記の指摘事項を必ず修正してください。これは再実装です。前回のレビューで指摘された問題を解決することが最優先です。
`
      : '';

    const implementationPrompt = `
# Task Implementation${latestReview && latestReview.status === 'changes_requested' ? ' - 修正実装' : ''}

${reviewFeedbackSection}

以下のタスクを実装してください。

## 【前提条件：必須ファイル】
以下のファイルは前のノードが作成済みです。このタスクの実装に必要な情報が含まれています：

1. **Sprint Backlog** (\`.kugutsu/sprints/\${sprintId}/sprint-backlog.json\`) - タスク一覧と自分の担当タスク情報
   → このファイルからタスクの状態を確認できます

2. **.kugutsu/sprints/\${sprintId}/tasks/\${taskArtifact.id}/instruction.md** - このタスクの実装詳細指示
   → 下記「タスクの詳細指示」に既に読み込まれています

これらのファイルが存在しない場合はエラーです。

## タスク情報
- **ID**: ${taskArtifact.id}
- **タイトル**: ${taskArtifact.title}

## 作業ディレクトリ
${taskArtifact.worktreePath}

## 🚀 環境セットアップ（最優先実行）

**重要**: あなたはGit Worktree環境で作業しています。実装を開始する前に、必ず以下を実行してください:

1. **プロジェクトの種類を確認**
   - Readツールで\`package.json\`, \`requirements.txt\`, \`go.mod\`, \`Cargo.toml\`等の存在を確認
   - プロジェクトのビルドシステムを特定

2. **依存関係のインストール**
   - Node.jsプロジェクト: \`npm install\` または \`yarn install\`
   - Pythonプロジェクト: \`pip install -r requirements.txt\`
   - Goプロジェクト: \`go mod download\`
   - Rustプロジェクト: \`cargo build\`
   - その他のプロジェクトも、適切な依存関係インストールコマンドを実行

3. **必要に応じてビルドやコード生成を実行**
   - TypeScriptのビルド、プロトコルバッファのコード生成等

4. **環境が正しくセットアップされたことを確認**
   - 必要に応じてテストコマンドやビルドコマンドを実行して動作確認

これらの手順を完了してから、タスクの実装に進んでください。

## タスクの詳細指示

${instruction}
${storyMappingSection}${designDocsSection}${sprintPlanSection}

## 実装要件

### 1. テスト駆動開発（TDD）
- まずテストを作成してください
- テストを実行して失敗を確認してください
- その後、テストをパスする実装を行ってください

### 2. コード品質
- 既存のコードスタイルに従ってください
- エラーハンドリングを適切に実装してください
- 必要に応じてドキュメントを追加してください

### 3. 依存関係
${dependenciesSection}

## 完了条件
- すべてのテストが通過する
- コードレビュー可能な状態

## 重要な注意
- **git操作（add/commit/push）は実行しないでください**
- コミットはシステムが自動的に作成します
`;

    // Execute implementation with retry mechanism
    const messages: any[] = [];
    let sessionId: string | undefined = taskArtifact.sessionId;

    const executionResult = await RetryManager.executeWithRetry(
      async () => {
        const collectedMessages: any[] = [];
        let capturedSessionId: string | undefined = taskArtifact.sessionId;

        const handler = new MessageHandler({
          maxTurns: state.config.maxTurns,
          nodeName: `Engineer - Task ${taskId}`,
          taskId,
        });

        for await (const message of provider.execute(implementationPrompt, {
          maxTurns: state.config.maxTurns,
          cwd: taskArtifact.worktreePath,
          systemPrompt: `You are an AI engineer working in an isolated Git worktree environment.

CRITICAL FIRST STEPS:
1. Before starting any implementation, ALWAYS check for dependency files (package.json, requirements.txt, go.mod, Cargo.toml, etc.)
2. If dependency files exist, INSTALL dependencies first using appropriate commands (npm install, pip install, go mod download, cargo build, etc.)
3. Ensure the development environment is properly set up before writing code

This is a MANDATORY step. Failure to set up the environment will cause implementation failures.`,
          permissionMode: 'acceptEdits',
          allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
          resume: taskArtifact.sessionId,
          includePartialMessages: true,
        })) {
          collectedMessages.push(message);

          // Capture session ID for potential conflict resolution
          if (message.session_id) {
            capturedSessionId = message.session_id;
          }

          // Handle message for progress display
          await handler.handleMessage(message);
        }

        // エラーチェック（Claude Agent SDK仕様準拠）
        // SDKはエラー時に例外をスローせず、result messageとして返すため、
        // ここでエラーを検出して例外をスローすることで、RetryManagerが正しく動作する
        if (handler.getHasError()) {
          const details = handler.getErrorDetails();
          let errorMsg: string;
          if (details?.message) {
            errorMsg =
              details.subtype === 'error_max_turns'
                ? `AI実行がmaxTurns制限に到達しました: ${details.message}`
                : `AI実行中にエラーが発生しました: ${details.message}`;
          } else if (details?.errors && details.errors.length > 0) {
            errorMsg = `AI実行中にエラーが発生しました: ${details.errors.join('; ')}`;
          } else {
            errorMsg = `AI実行中にエラーが発生しました (subtype: ${details?.subtype || 'unknown'})`;
            console.warn(
              `⚠️  エラー詳細が取得できませんでした。ErrorDetails:`,
              JSON.stringify(details, null, 2)
            );
          }
          throw new Error(errorMsg);
        }

        handler.complete(true, 'タスクの実装が完了しました');
        return { messages: collectedMessages, sessionId: capturedSessionId };
      },
      {
        maxRetries: 3,
        initialDelayMs: 2000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
        // Note: ネットワークエラーのみリトライ対象（rate_limit/error_max_turnsはFallbackAIProviderが処理）
        retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'timeout', 'network'],
      }
    );

    // AI実行が成功した場合、変更をコミット
    if (executionResult.success) {
      try {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📝 変更をコミット中...`);
        console.log(`${'='.repeat(60)}\n`);

        // GitWorktreeManagerを初期化
        const gitManager = new GitWorktreeManager(
          config.baseRepoPath,
          config.worktreeBasePath,
          config.baseBranch
        );

        // Worktree内で変更されたファイルを検出
        const worktreePath = taskArtifact.worktreePath;

        try {
          // git statusで変更を確認
          const statusOutput = execSync('git status --porcelain', {
            cwd: worktreePath,
            encoding: 'utf-8',
            stdio: 'pipe'
          });

          if (statusOutput.trim()) {
            console.log(`📋 変更検出:\n${statusOutput}`);

            // 全ての変更をステージング（worktree内から実行）
            execSync('git add -A', {
              cwd: worktreePath,
              stdio: 'pipe'
            });

            // コミットメッセージを生成
            const commitMessage = `feat(${taskId}): ${instruction.split('\n')[0].substring(0, 72)}

タスクID: ${taskId}
スプリント: ${sprintId}

実装内容:
${instruction.split('\n').slice(0, 5).join('\n')}

[Automated commit by Kugutsu AI Engineer]`;

            // コミットを作成（worktree内から実行）
            execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
              cwd: worktreePath,
              stdio: 'pipe'
            });

            console.log(`✅ コミット作成完了`);
            console.log(`   📦 タスク: ${taskId}`);
            console.log(`   📝 メッセージ: ${commitMessage.split('\n')[0]}`);
          } else {
            console.log(`ℹ️  変更なし - コミットをスキップ`);
          }
        } catch (gitError) {
          console.warn(`⚠️  Git操作に失敗しましたが、処理を継続します: ${gitError}`);
          // Git操作の失敗はタスク失敗とはしない（実装自体は成功している）
        }

        console.log(`\n${'='.repeat(60)}\n`);
      } catch (commitError) {
        console.error(`❌ コミット作成エラー: ${commitError}`);
        // コミット作成エラーもタスク失敗とはしない（レビュー時に対応可能）
      }
    }

    if (!executionResult.success) {
      // AI実行失敗 - エラーを分類して適切に処理
      const classifiedError = ErrorClassifier.classify(executionResult.error!);

      console.error(`\n${'='.repeat(60)}`);
      console.error(`❌ タスク ${taskId} の実装に失敗 (${executionResult.attempts}回試行)`);
      console.error(`${'='.repeat(60)}`);

      // エラー詳細を表示
      const error = executionResult.error;
      if (error) {
        console.error(`\n🔴 エラーメッセージ:`);
        console.error(`   ${error.message}`);

        // スタックトレースがあれば表示
        if (error.stack) {
          console.error(`\n📚 スタックトレース:`);
          console.error(error.stack);
        }

        // エラーオブジェクトに追加情報があれば表示
        const errorKeys = Object.keys(error).filter(k => k !== 'message' && k !== 'stack' && k !== 'name');
        if (errorKeys.length > 0) {
          console.error(`\n📋 追加情報:`);
          errorKeys.forEach(key => {
            console.error(`   ${key}: ${JSON.stringify((error as any)[key])}`);
          });
        }
      }

      console.error(`\n🏷️  エラー分類: ${classifiedError.severity} - ${classifiedError.message}`);
      console.error(`${'='.repeat(60)}\n`);

      // タスクをfailedに遷移
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        // ⚠️ 重要: TaskStateMachine の警告を回避するため、遷移前に error を設定
        const taskWithError: Task = {
          ...task,
          error: executionResult.error || new Error(`AI実行失敗 (分類: ${classifiedError.severity})`),
        };

        const failedTask = TaskStateMachine.transition(taskWithError, 'failed');

        // Sprint Backlogを更新
        await persistence.updateSprintBacklogTask(sprintId, taskId, {
          status: 'failed',
        });

        // Sync to globalTasks
        const globalTask = state.globalTasks.find((t) => t.id === taskId);
        const updatedGlobalTasks = globalTask
          ? [{
              ...globalTask,
              status: 'failed' as const,
              updatedAt: new Date(),
            }]
          : [];

        return {
          tasks: [failedTask],
          globalTasks: updatedGlobalTasks,
          failedTasks: [failedTask],
          logs: [
            {
              timestamp: new Date(),
              level: 'error',
              source: 'EngineerNode',
              message: `タスク ${taskId} の実装に失敗: ${classifiedError.message}`,
              taskId,
              data: {
                error: executionResult.error?.message,
                severity: classifiedError.severity,
                attempts: executionResult.attempts,
              },
            },
          ],
        };
      }
    }

    // AI実行成功 - 結果を取得
    messages.push(...executionResult.data!.messages);
    sessionId = executionResult.data!.sessionId;

    // ✨ 実装完了ログ（詳細版）
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n${'='.repeat(70)}`);
    console.log(`✅ [${taskId}] ${task?.title || taskArtifact.title} - 実装完了`);
    console.log(`   所要時間: ${duration}秒`);
    console.log(`   SessionID: ${sessionId}`);
    console.log(`${'='.repeat(70)}\n`);

    // Update task status in Sprint Backlog
    await persistence.updateSprintBacklogTask(sprintId, taskId, {
      status: 'in_review', // implementedではなくin_reviewに変更（TaskStateMachineに合わせる）
      sessionId,
    });
    console.log(`📝 Sprint Backlogのタスクステータスを更新しました: in_review`);

    // Update State task: in_progress → in_review
    const stateTask = state.tasks.find((t) => t.id === taskId);
    if (stateTask) {
      const taskWithSession: Task = {
        ...stateTask,
        sessionId,
      };

      // Use TaskStateMachine for state transition
      const inReviewTask = TaskStateMachine.transition(taskWithSession, 'in_review');

      console.log(`📝 タスクステータス(State)を更新しました: in_progress → in_review`);

      // Sync to globalTasks
      const globalTask = state.globalTasks.find((t) => t.id === taskId);
      const updatedGlobalTasks = globalTask
        ? [{
            ...globalTask,
            status: 'in_review' as const,
            worktreePath: taskArtifact.worktreePath,
            branchName: taskArtifact.branchName,
            updatedAt: new Date(),
          }]
        : [];

      return {
        tasks: [inReviewTask],
        globalTasks: updatedGlobalTasks,
        feedbackRequest: null, // フィードバッククリア（成功）
        logs: [
          {
            timestamp: new Date(),
            level: 'info',
            source: 'EngineerNode',
            message: `タスク ${taskId} の実装が完了しました (レビュー待ち)`,
            data: {
              taskId,
              messageCount: messages.length,
              sessionId,
            },
            taskId,
            sessionId,
          },
        ],
        metadata: {
          tasksCompleted: (state.metadata.tasksCompleted || 0) + 1,
        },
      };
    }

    return {
      feedbackRequest: null, // フィードバッククリア（成功）
      logs: [
        {
          timestamp: new Date(),
          level: 'info',
          source: 'EngineerNode',
          message: `タスク ${taskId} の実装が完了しました (レビュー待ち)`,
          data: {
            taskId,
            messageCount: messages.length,
            sessionId,
            warning: 'State内にタスクが見つかりませんでした',
          },
          taskId,
          sessionId,
        },
      ],
      metadata: {
        tasksCompleted: (state.metadata.tasksCompleted || 0) + 1,
      },
    };
  } catch (error) {
    console.error(`❌ タスク ${taskId} の実装に失敗:`, error);

    // Update task status to 'failed' in Sprint Backlog
    try {
      // Create AI provider for this error path
      const providerConfig = AIProviderFactory.buildProviderConfig({
        provider: state.config.provider || 'claude',
      });
      const provider = AIProviderFactory.create(providerConfig);

      await persistence.updateSprintBacklogTask(sprintId, taskId, {
        status: 'failed',
      });
      console.log(`📝 Sprint Backlogのタスクステータスを更新しました: failed`);
    } catch (fileError) {
      console.error(`❌ Sprint Backlog の更新に失敗:`, fileError);
    }

    // Update State task: in_progress → failed
    const stateTask = state.tasks.find((t) => t.id === taskId);
    let failedTask: Task | undefined;

    if (stateTask) {
      const taskWithError: Task = {
        ...stateTask,
        error: error instanceof Error ? error.message : String(error),
      };

      // Use TaskStateMachine for state transition
      failedTask = TaskStateMachine.transition(taskWithError, 'failed');

      console.log(`📝 タスクステータス(State)を更新しました: in_progress → failed`);
    }

    // Sync to globalTasks
    const globalTask = state.globalTasks.find((t) => t.id === taskId);
    const updatedGlobalTasks = globalTask
      ? [{
          ...globalTask,
          status: 'failed' as const,
          updatedAt: new Date(),
        }]
      : [];

    return {
      tasks: failedTask ? [failedTask] : [],
      globalTasks: updatedGlobalTasks,
      failedTasks: failedTask ? [failedTask] : [],
      logs: [
        {
          timestamp: new Date(),
          level: 'error',
          source: 'EngineerNode',
          message: `タスク ${taskId} が失敗しました: ${error instanceof Error ? error.message : String(error)}`,
          data: {
            taskId,
            error,
          },
          taskId,
        },
      ],
      metadata: {
        tasksFailed: (state.metadata.tasksFailed || 0) + 1,
        hasErrors: true,
        errors: [
          ...(state.metadata.errors || []),
          `Task ${taskId}: ${error instanceof Error ? error.message : String(error)}`,
        ],
      },
    };
  }
}
