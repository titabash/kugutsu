/**
 * Review Story Mapping Node
 *
 * DirectorAIが作成したストーリーマッピングをレビュー
 *
 * レビュー観点:
 * - ペルソナの具体性と妥当性
 * - Epicの粒度と優先度
 * - ストーリーの完全性（As a, I want to, So that）
 * - 受入基準の具体性と測定可能性
 * - 見積ポイントの妥当性
 */

import type { ParallelDevStateType, ParallelDevStateUpdate } from '../state.js';
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import type { AIProviderConfig } from '../../providers/IAIProvider.js';
import { AIFileWriter } from '../../utils/AIFileWriter.js';
import type { StoryMapping } from '../../types/scrum.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * ストーリーマッピングレビュー結果
 */
interface StoryMappingReviewResult {
  approved: boolean;
  issues: ReviewIssue[];
  suggestions: string[];
  overallAssessment: string;
}

interface ReviewIssue {
  severity: 'critical' | 'major' | 'minor' | 'info';
  category: string;
  message: string;
  storyId?: string;
  epicId?: string;
}

/**
 * Review Story Mapping Node
 *
 * Responsibilities:
 * 1. Load story mapping from state or persistence
 * 2. Execute AI-powered review using ProductOwnerAI perspective
 * 3. Check quality criteria (completeness, clarity, measurability)
 * 4. Save review history
 * 5. Return approval status and feedback
 */
export async function reviewStoryMappingNode(
  state: ParallelDevStateType
): Promise<ParallelDevStateUpdate> {
  const { config, currentProjectId } = state;
  const maxTurns = config.maxTurns || 50;

  console.log('📖 StoryMappingReview: ストーリーマッピングレビュー開始');

  if (!currentProjectId) {
    console.log('⚠️ プロジェクトIDが指定されていません');
    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'warn',
          source: 'story_mapping_review',
          message: 'プロジェクトIDなし',
        },
      ],
    };
  }

  // Define file paths
  const storyMapJsonPath = path.join(
    config.baseRepoPath,
    '.kugutsu',
    'projects',
    currentProjectId,
    'story-mapping',
    'story-map.json'
  );
  const reviewHistoryPath = path.join(
    config.baseRepoPath,
    '.kugutsu',
    'projects',
    currentProjectId,
    'story-mapping',
    'review-history.json'
  );

  // ストーリーマッピングを読み込み
  let storyMapping: StoryMapping;
  try {
    const storyMappingContent = await fs.readFile(storyMapJsonPath, 'utf-8');
    storyMapping = JSON.parse(storyMappingContent);
  } catch (error) {
    console.log('⚠️ ストーリーマッピングが見つかりません:', storyMapJsonPath);
    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'warn',
          source: 'story_mapping_review',
          message: `ストーリーマッピングなし: ${(error as Error).message}`,
        },
      ],
    };
  }

  console.log(`📊 Epic数: ${storyMapping.epics.length}`);
  const totalStories = storyMapping.epics.reduce(
    (sum: number, epic: any) => sum + epic.stories.length,
    0
  );
  console.log(`📝 ストーリー数: ${totalStories}`);

  // レビュー履歴を読み込み（存在しない場合はデフォルト値）
  let reviewHistory: any = { reviews: [] };
  try {
    const reviewHistoryContent = await fs.readFile(reviewHistoryPath, 'utf-8');
    reviewHistory = JSON.parse(reviewHistoryContent);
  } catch (error) {
    // 初回レビュー時はファイルが存在しないので、デフォルト値を使用
    console.log('📝 レビュー履歴なし（初回レビュー）');
  }

  const iteration = (reviewHistory.reviews?.length || 0) + 1;
  console.log(`🔄 レビュー回数: ${iteration}回目`);

  // AIプロバイダーを作成してレビュー実行
  const providerConfig: AIProviderConfig = {
    provider: config.provider || 'claude',
    claude: {
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
    },
  };

  const provider = AIProviderFactory.create(providerConfig);

  const reviewPrompt = buildReviewPrompt(storyMapping, iteration);

  console.log('🤖 AI: ストーリーマッピングレビュー実行中...');

  let aiResponseText = '';
  for await (const message of provider.execute(reviewPrompt, {
    maxTurns,
    cwd: config.baseRepoPath,
    allowedTools: ['Read', 'Glob'],
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

  // レビュー結果を解析
  const reviewResult = extractReviewResult(aiResponseText);

  console.log(`📋 レビュー結果: ${reviewResult.approved ? '承認' : '修正必要'}`);
  console.log(`🔍 指摘事項: ${reviewResult.issues.length}件`);

  // レビュー履歴に追加
  const newReview = {
    iteration,
    timestamp: new Date().toISOString(),
    reviewer: 'ProductOwnerAI',
    approved: reviewResult.approved,
    issues: reviewResult.issues,
    suggestions: reviewResult.suggestions,
    overallAssessment: reviewResult.overallAssessment,
  };

  const updatedHistory = {
    reviews: [...(reviewHistory.reviews || []), newReview],
  };

  // Save review history using AI Write tool
  const reviewHistorySavePrompt = `
以下のレビュー履歴を${reviewHistoryPath}に保存してください。

\`\`\`json
${JSON.stringify(updatedHistory, null, 2)}
\`\`\`

**重要**: Writeツールを使用してこのファイルを作成してください。
`.trim();

  for await (const _message of provider.execute(reviewHistorySavePrompt, {
    maxTurns,
    cwd: config.baseRepoPath,
    allowedTools: ['Write'],
    permissionMode: 'acceptEdits',
  })) {
    // AI writes the file
  }

  console.log('💾 レビュー履歴を保存しました');

  // 承認されたかどうかで次のノードを決定
  if (reviewResult.approved) {
    console.log('✅ ストーリーマッピング承認 → 設計フェーズへ');
    return {
      storyMappingApproved: true,
      logs: [
        {
          timestamp: new Date(),
          level: 'success',
          source: 'story_mapping_review',
          message: `ストーリーマッピング承認 (${totalStories}ストーリー)`,
        },
      ],
    };
  } else {
    console.log('⚠️ 修正が必要です');
    console.log('📝 主な指摘事項:');
    reviewResult.issues.slice(0, 3).forEach((issue) => {
      console.log(`  - [${issue.severity}] ${issue.message}`);
    });

    return {
      storyMappingApproved: false,
      reviewFeedback: {
        issues: reviewResult.issues,
        suggestions: reviewResult.suggestions,
      },
      logs: [
        {
          timestamp: new Date(),
          level: 'warn',
          source: 'story_mapping_review',
          message: `修正必要: ${reviewResult.issues.length}件の指摘`,
        },
      ],
    };
  }
}

/**
 * レビュープロンプトを構築
 */
function buildReviewPrompt(
  storyMapping: StoryMapping,
  iteration: number
): string {
  return `
# ストーリーマッピングレビュー (レビュー回数: ${iteration}回目)

あなたはプロダクトオーナーとして、以下のストーリーマッピングをレビューしてください。

## ストーリーマッピング

\`\`\`json
${JSON.stringify(storyMapping, null, 2)}
\`\`\`

## レビュー観点

### 1. ペルソナの評価
- **具体性**: 実在する人物像が想像できるか
- **妥当性**: プロダクトのターゲットユーザーとして適切か
- **ゴールの明確さ**: 達成したいことが明確か

### 2. Epicの評価
- **粒度**: 大きすぎず小さすぎない適切な粒度か
- **優先度**: ビジネス価値に基づいた優先順位付けか
- **完全性**: 必要な機能が網羅されているか

### 3. ユーザーストーリーの評価
- **フォーマット**: "As a / I want to / So that" の形式が守られているか
- **独立性**: 各ストーリーが独立して価値を提供できるか
- **具体性**: 実装者が理解できる具体性があるか
- **受入基準**: 測定可能で具体的な基準か（最低2個）
- **見積ポイント**: フィボナッチ数列（1,2,3,5,8,13,21）か

### 4. 全体の一貫性
- **Epic間の関連**: Epicが論理的につながっているか
- **ストーリー間の関連**: 依存関係が適切に考慮されているか
- **優先度の一貫性**: Epic内のストーリー優先度が整合しているか

## 出力形式

JSON形式で以下を出力してください：

\`\`\`json
{
  "approved": true または false,
  "issues": [
    {
      "severity": "critical" | "major" | "minor" | "info",
      "category": "persona" | "epic" | "story" | "acceptance_criteria" | "priority" | "consistency",
      "message": "指摘内容の詳細",
      "storyId": "story-1-1" (該当する場合),
      "epicId": "epic-1" (該当する場合)
    }
  ],
  "suggestions": [
    "改善提案1",
    "改善提案2"
  ],
  "overallAssessment": "全体評価のコメント"
}
\`\`\`

## 判定基準

- **critical/major な問題が0件**: 承認 (approved: true)
- **critical/major な問題が1件以上**: 修正必要 (approved: false)

## 注意事項

- minor/info レベルの指摘は承認に影響しない
- 具体的で実行可能な改善提案を含める
- 指摘は建設的で分かりやすく
`.trim();
}

/**
 * AIレスポンスからレビュー結果を抽出
 */
function extractReviewResult(response: string): StoryMappingReviewResult {
  // JSONコードブロックを抽出
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);

  let parsedResult: any;

  if (jsonMatch) {
    try {
      parsedResult = JSON.parse(jsonMatch[1]);
    } catch (error) {
      console.error('JSONパースエラー:', error);
      // パースエラーの場合はデフォルト値
      parsedResult = {
        approved: false,
        issues: [
          {
            severity: 'critical',
            category: 'parse_error',
            message: 'AIレスポンスのパースに失敗しました',
          },
        ],
        suggestions: [],
        overallAssessment: 'レビュー結果の解析に失敗',
      };
    }
  } else {
    // JSONブロックが見つからない場合
    parsedResult = {
      approved: false,
      issues: [
        {
          severity: 'critical',
          category: 'format_error',
          message: 'AIレスポンスが期待された形式ではありません',
        },
      ],
      suggestions: [],
      overallAssessment: 'レビュー結果が不正な形式',
    };
  }

  return {
    approved: parsedResult.approved || false,
    issues: parsedResult.issues || [],
    suggestions: parsedResult.suggestions || [],
    overallAssessment: parsedResult.overallAssessment || '',
  };
}
