/**
 * Check Mode Node
 *
 * ユーザーリクエストを分析して、継続モードか新規モードかを判定
 *
 * 継続モード: "続き", "continue", "残り" などのキーワードを検出
 * 新規モード: 新しいプロジェクトを開始
 */

import type { ParallelDevStateType, ParallelDevStateUpdate } from '../state.js';
import type { ProjectMetadata } from '../../types/index.js';
import { PriorityCalculator } from '../../utils/PriorityCalculator.js';
import { DataPersistence } from '../../utils/DataPersistence.js';
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import type { AIProviderConfig } from '../../providers/IAIProvider.js';
import { GitWorktreeManager } from '../../managers/GitWorktreeManager.js';
import { randomUUID } from 'crypto';

/**
 * Check Mode Node
 *
 * Responsibilities:
 * 1. Detect continuation mode from user request using AI
 * 2. Load global queue and project metadata
 * 3. Set continuationMode flag
 * 4. Generate new projectId for new mode or identify latest project for continuation
 * 5. Update state with loaded data
 */
export async function checkModeNode(
  state: ParallelDevStateType
): Promise<ParallelDevStateUpdate> {
  const { userRequest, config } = state;
  const maxTurns = config.maxTurns || 30;

  console.log('🔍 CheckMode: ユーザーリクエストを分析しています...');
  console.log(`📝 リクエスト: ${userRequest}`);

  // データ永続化マネージャーを初期化
  const persistence = new DataPersistence(config.baseRepoPath);
  await persistence.initialize();

  // グローバルキューとプロジェクトメタデータを読み込む
  const globalTasks = await persistence.loadGlobalQueue();
  const projects = await persistence.loadAllProjectMetadata();

  console.log(`📊 既存タスク数: ${globalTasks.length}`);
  console.log(`📁 既存プロジェクト数: ${projects.size}`);

  // AI Provider設定
  const providerConfig: AIProviderConfig = {
    provider: config.provider || 'claude',
    claude: {
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
    },
  };

  // リポジトリメタデータの初期化（初回実行時のみ）
  const repositoryMetadata = await persistence.loadRepositoryMetadata();
  if (!repositoryMetadata) {
    console.log('🔍 初回実行: リポジトリ全体を分析しています...');

    // リポジトリ分析プロンプト
    const repositoryAnalysisPrompt = `
# リポジトリ全体の分析

このリポジトリ全体を分析し、以下の情報をJSON形式で出力してください。

## 分析項目

1. **基本情報**:
   - リポジトリ名（package.jsonやREADMEから推測）
   - 説明（READMEから）
   - 主要なプログラミング言語（TypeScript, JavaScript, Python等）
   - フレームワーク（React, Vue, Express, Django等）

2. **規模**:
   - ファイル数（概算）
   - コード行数（概算）

3. **技術スタック**:
   - フロントエンド（該当する場合）
   - バックエンド（該当する場合）
   - データベース（該当する場合）
   - インフラ（Docker, Kubernetes等）

4. **アーキテクチャ**:
   - アーキテクチャパターン（MVC, Clean Architecture, Layered等）
   - ディレクトリ構造の特徴

5. **コーディング規約**:
   - 命名規則（既存コードから推測）
   - コメントスタイル

## 出力形式

\`\`\`json
{
  "repositoryName": "...",
  "description": "...",
  "primaryLanguages": ["TypeScript", "JavaScript"],
  "frameworks": ["React", "Node.js"],
  "linesOfCode": 10000,
  "fileCount": 100,
  "techStack": {
    "frontend": {
      "framework": "React",
      "version": "19.0.0",
      "language": "TypeScript"
    },
    "backend": {
      "runtime": "Node.js",
      "framework": "Express",
      "language": "TypeScript"
    },
    "database": {
      "primary": "PostgreSQL"
    }
  },
  "architecture": {
    "pattern": "Clean Architecture",
    "layers": ["presentation", "application", "domain", "infrastructure"]
  },
  "codingStandards": {
    "namingConvention": "camelCase for variables, PascalCase for classes",
    "commentStyle": "JSDoc for public APIs"
  }
}
\`\`\`
`;

    const repositoryAnalysisProvider = AIProviderFactory.create(providerConfig);
    let repositoryAnalysisText = '';
    for await (const message of repositoryAnalysisProvider.execute(
      repositoryAnalysisPrompt,
      {
        maxTurns,
        cwd: config.baseRepoPath,
        allowedTools: ['Read', 'Glob', 'Grep'],
        permissionMode: 'acceptEdits',
      }
    )) {
      if (message.type === 'assistant' && message.content) {
        if (typeof message.content === 'string') {
          repositoryAnalysisText += message.content;
        } else {
          repositoryAnalysisText += JSON.stringify(message.content);
        }
      }
    }

    // JSONを抽出してパース
    const repositoryJsonMatch = repositoryAnalysisText.match(/```json\n([\s\S]*?)\n```/);
    if (repositoryJsonMatch) {
      try {
        const analysisResult = JSON.parse(repositoryJsonMatch[1]);

        // メタデータを保存
        const metadata = {
          ...analysisResult,
          analyzedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          kugutsuVersion: '2.0.0',
          developmentPhase: 'active',
        };
        await persistence.saveRepositoryMetadata(metadata);

        // 技術スタックを保存
        if (analysisResult.techStack) {
          await persistence.saveTechStack(analysisResult.techStack);
        }

        // アーキテクチャ概要を保存
        const architectureOverview = `# アーキテクチャ概要

**最終更新**: ${new Date().toISOString()}

## アーキテクチャパターン

${analysisResult.architecture?.pattern || 'N/A'}

## レイヤー構造

${analysisResult.architecture?.layers?.map((layer: string) => `- ${layer}`).join('\n') || 'N/A'}

## 技術スタック

- **フロントエンド**: ${analysisResult.techStack?.frontend?.framework || 'N/A'}
- **バックエンド**: ${analysisResult.techStack?.backend?.framework || 'N/A'}
- **データベース**: ${analysisResult.techStack?.database?.primary || 'N/A'}
`;
        await persistence.saveArchitectureOverview(architectureOverview);

        // コーディング規約を保存
        const codingStandards = `# コーディング規約

**最終更新**: ${new Date().toISOString()}

## 命名規則

${analysisResult.codingStandards?.namingConvention || 'N/A'}

## コメントスタイル

${analysisResult.codingStandards?.commentStyle || 'N/A'}
`;
        await persistence.saveCodingStandards(codingStandards);

        console.log('✅ リポジトリ仕様を初期化しました');

        // repository/の変更をコミット
        console.log('📝 repository/の変更をコミットしています...');
        const gitManager = new GitWorktreeManager(
          config.baseRepoPath,
          config.worktreeBasePath || './worktrees',
          config.baseBranch || 'main'
        );

        try {
          await gitManager.addAndCommit(
            '.kugutsu/repository/',
            'chore: Initialize repository specifications\n\n🤖 Generated with Kugutsu 2.0\n\nCo-Authored-By: Claude <noreply@anthropic.com>'
          );
        } catch (commitError) {
          console.warn('⚠️ repository/のコミットに失敗しました:', commitError);
          // コミット失敗しても処理は継続
        }
      } catch (error) {
        console.error('❌ リポジトリ分析結果のJSON解析に失敗しました:', error);
      }
    } else {
      console.warn('⚠️ リポジトリ分析結果からJSONを抽出できませんでした');
    }
  } else {
    console.log('✅ 既存のリポジトリ仕様を使用します');
  }

  // 未完了タスク数を計算
  const incompleteTasks = globalTasks.filter(
    (task) => task.status !== 'completed' && task.status !== 'failed'
  );

  // 最新プロジェクトを取得
  let latestProject: ProjectMetadata | undefined;
  if (projects.size > 0) {
    const sortedProjects = Array.from(projects.values()).sort(
      (a, b) => b.requestTimestamp.getTime() - a.requestTimestamp.getTime()
    );
    latestProject = sortedProjects[0];
  }

  // AI駆動で継続モードを判定
  const provider = AIProviderFactory.create(providerConfig);

  const continuationDetectionPrompt = `
# ユーザーリクエストの意図分析

以下のユーザーリクエストを分析し、継続モードか新規モードかを判定してください。

## ユーザーリクエスト
${userRequest}

## 既存プロジェクト情報
- 既存プロジェクト数: ${projects.size}
- 未完了タスク数: ${incompleteTasks.length}
- 最新プロジェクト: ${latestProject?.userRequest || 'なし'}

## 判定基準
**継続モード**:
- 既存プロジェクトの続きを依頼している
- 既存の未完了タスクに関連する作業
- 文脈から既存作業の継続を示唆している

**新規モード**:
- 全く新しい機能や要求
- 既存プロジェクトと無関係
- 新規プロジェクトの開始を明示

## 出力形式
JSON形式で以下を出力してください：
\`\`\`json
{
  "isContinuation": true または false,
  "reasoning": "判定理由の説明"
}
\`\`\`
`;

  console.log('🤖 AI: 継続モード判定中...');

  let aiResponseText = '';
  for await (const message of provider.execute(continuationDetectionPrompt, {
    maxTurns,
    cwd: config.baseRepoPath,
    allowedTools: [],
    permissionMode: 'acceptEdits',
  })) {
    if (message.type === 'assistant' && message.content) {
      // Handle both string and object content
      if (typeof message.content === 'string') {
        aiResponseText += message.content;
      } else {
        aiResponseText += JSON.stringify(message.content);
      }
    }
  }

  // JSONを抽出してパース
  const jsonMatch = aiResponseText.match(/```json\n([\s\S]*?)\n```/);
  let isContinuation = false;
  let reasoning = '';

  if (jsonMatch) {
    try {
      const result = JSON.parse(jsonMatch[1]);
      isContinuation = result.isContinuation;
      reasoning = result.reasoning;
      console.log(`✅ AI判定: ${isContinuation ? '継続モード' : '新規モード'}`);
      console.log(`💭 理由: ${reasoning}`);
    } catch (error) {
      console.error('❌ AI応答のJSON解析に失敗しました:', error);
      // デフォルトは新規モード
      isContinuation = false;
    }
  } else {
    console.warn('⚠️ AI応答からJSONを抽出できませんでした。新規モードとして扱います。');
    isContinuation = false;
  }

  let currentProjectId: string;
  let currentUserRequest: string;
  let continuationMode: boolean;

  if (isContinuation && projects.size > 0 && latestProject) {
    // 継続モード: 最新プロジェクトを使用
    currentProjectId = latestProject.projectId;
    currentUserRequest = latestProject.userRequest;
    continuationMode = true;

    console.log(`✅ 継続モード: プロジェクト "${currentProjectId}" を再開します`);
    console.log(`📋 元のリクエスト: ${latestProject.userRequest}`);

    // 未完了タスクの優先度を上げる
    const incompleteTasks = globalTasks.filter(
      (task) =>
        task.projectId === currentProjectId &&
        task.status !== 'completed' &&
        task.status !== 'failed'
    );

    console.log(`🔄 未完了タスク: ${incompleteTasks.length}件`);

    // 優先度を再計算
    const updatedTasks = PriorityCalculator.recalculateAllPriorities(
      globalTasks,
      projects
    );

    return {
      continuationMode,
      currentUserRequest,
      currentProjectId,
      globalTasks: updatedTasks,
      projects,
      logs: [
        {
          timestamp: new Date(),
          level: 'info',
          source: 'check_mode',
          message: `継続モードで再開: プロジェクト ${currentProjectId}`,
          data: {
            projectId: currentProjectId,
            incompleteTasks: incompleteTasks.length,
            totalTasks: globalTasks.length,
          },
        },
      ],
    };
  } else {
    // 新規モード: 新しいプロジェクトを作成
    currentProjectId = randomUUID();
    currentUserRequest = userRequest;
    continuationMode = false;

    console.log(`🆕 新規モード: 新しいプロジェクト "${currentProjectId}" を開始します`);

    // 新しいプロジェクトメタデータを作成
    const newProjectMetadata: ProjectMetadata = {
      projectId: currentProjectId,
      userRequest: currentUserRequest,
      requestTimestamp: new Date(),
      totalTasks: 0,
      completedTasks: 0,
      needsStoryMapping: false,
    };

    // プロジェクトメタデータを保存
    await persistence.saveProjectMetadata(currentProjectId, newProjectMetadata);

    // プロジェクトMapに追加
    const updatedProjects = new Map(projects);
    updatedProjects.set(currentProjectId, newProjectMetadata);

    return {
      continuationMode,
      currentUserRequest,
      currentProjectId,
      globalTasks,
      projects: updatedProjects,
      logs: [
        {
          timestamp: new Date(),
          level: 'info',
          source: 'check_mode',
          message: `新規モードで開始: プロジェクト ${currentProjectId}`,
          data: {
            projectId: currentProjectId,
            userRequest: currentUserRequest,
          },
        },
      ],
    };
  }
}

/**
 * CheckModeNodeのルーティング関数
 *
 * 継続モード: sprint_planning (既存タスクをスプリントに分割)
 * 新規モード: product_owner (新しいタスク分解)
 */
export function checkModeRouter(state: ParallelDevStateType): string {
  if (state.continuationMode) {
    console.log('➡️ ルーティング: sprint_planning (継続モード)');
    return 'sprint_planning';
  } else {
    console.log('➡️ ルーティング: product_owner (新規モード)');
    return 'product_owner';
  }
}
