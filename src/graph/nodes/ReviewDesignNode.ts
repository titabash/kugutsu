/**
 * Review Design Node
 *
 * DirectorAI、ProductOwnerAI、TechLeadAIの3者協調レビュー
 *
 * レビュー観点:
 * - DirectorAI: プロジェクト全体の整合性、ビジネス価値の実現
 * - ProductOwnerAI: ユーザーストーリーとの整合性、受入基準の実現可能性
 * - TechLeadAI: 技術的実装可能性、アーキテクチャの妥当性
 */

import type { ParallelDevStateType, ParallelDevStateUpdate } from '../state.js';
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import type { AIProviderConfig } from '../../providers/IAIProvider.js';
import { DataPersistence } from '../../utils/DataPersistence.js';

/**
 * 設計書レビュー結果
 */
interface DesignReviewResult {
  approved: boolean;
  reviewerResults: ReviewerResult[];
  overallAssessment: string;
  criticalIssues: ReviewIssue[];
  majorIssues: ReviewIssue[];
  suggestions: string[];
}

interface ReviewerResult {
  reviewer: 'DirectorAI' | 'ProductOwnerAI' | 'TechLeadAI';
  approved: boolean;
  issues: ReviewIssue[];
  comments: string[];
}

interface ReviewIssue {
  severity: 'critical' | 'major' | 'minor' | 'info';
  category: string;
  message: string;
  document?: string; // どの設計書に関する指摘か
}

/**
 * Review Design Node
 *
 * Responsibilities:
 * 1. Load design documents from persistence
 * 2. Execute 3-party review (Director, ProductOwner, TechLead)
 * 3. Consolidate review results
 * 4. Save review history
 * 5. Return approval status and feedback
 */
export async function reviewDesignNode(
  state: ParallelDevStateType
): Promise<ParallelDevStateUpdate> {
  const { config, currentProjectId } = state;
  const maxTurns = config.maxTurns || 50;

  console.log('🔍 DesignReview: 設計書レビュー開始（3者協調）');

  if (!currentProjectId) {
    console.log('⚠️ プロジェクトIDが指定されていません');
    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'warn',
          source: 'design_review',
          message: 'プロジェクトIDなし',
        },
      ],
    };
  }

  // データ永続化マネージャーを初期化
  const persistence = new DataPersistence(config.baseRepoPath);
  await persistence.initialize();

  // 設計書を読み込み
  const designDocsMarkdown = await loadDesignDocument(
    persistence,
    currentProjectId,
    'design-docs.md'
  );
  const wireframesMarkdown = await loadDesignDocument(
    persistence,
    currentProjectId,
    'wireframes.md'
  );
  const erDiagramMarkdown = await loadDesignDocument(
    persistence,
    currentProjectId,
    'er-diagram.md'
  );
  const apiSpecMarkdown = await loadDesignDocument(
    persistence,
    currentProjectId,
    'api-spec.md'
  );

  // 設計書が存在しない場合
  if (!designDocsMarkdown && !wireframesMarkdown && !erDiagramMarkdown && !apiSpecMarkdown) {
    console.log('⚠️ 設計書が見つかりません');
    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'warn',
          source: 'design_review',
          message: '設計書なし',
        },
      ],
    };
  }

  console.log('📖 設計書読み込み完了');

  // レビュー履歴を読み込み
  const reviewHistory = await persistence.loadDesignReviewHistory(currentProjectId);
  const iteration = (reviewHistory.reviews?.length || 0) + 1;

  console.log(`🔄 レビュー回数: ${iteration}回目`);

  // AIプロバイダーを作成
  const providerConfig: AIProviderConfig = {
    provider: config.provider || 'claude',
    claude: {
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
    },
  };

  const provider = AIProviderFactory.create(providerConfig);

  // ストーリーマッピングも読み込み（参照用）
  const storyMapping = await persistence.loadStoryMapping(currentProjectId);

  // 3者レビューを並行実行
  console.log('🤖 AI: DirectorAIレビュー実行中...');
  const directorReview = await executeReview(
    provider,
    'DirectorAI',
    {
      designDocsMarkdown,
      wireframesMarkdown,
      erDiagramMarkdown,
      apiSpecMarkdown,
    },
    storyMapping,
    config.baseRepoPath,
    maxTurns
  );

  console.log('🤖 AI: ProductOwnerAIレビュー実行中...');
  const productOwnerReview = await executeReview(
    provider,
    'ProductOwnerAI',
    {
      designDocsMarkdown,
      wireframesMarkdown,
      erDiagramMarkdown,
      apiSpecMarkdown,
    },
    storyMapping,
    config.baseRepoPath,
    maxTurns
  );

  console.log('🤖 AI: TechLeadAIレビュー実行中...');
  const techLeadReview = await executeReview(
    provider,
    'TechLeadAI',
    {
      designDocsMarkdown,
      wireframesMarkdown,
      erDiagramMarkdown,
      apiSpecMarkdown,
    },
    storyMapping,
    config.baseRepoPath,
    maxTurns
  );

  // レビュー結果を統合
  const consolidatedResult = consolidateReviews(
    directorReview,
    productOwnerReview,
    techLeadReview
  );

  console.log(`📋 統合レビュー結果: ${consolidatedResult.approved ? '承認' : '修正必要'}`);
  console.log(`🔴 Critical: ${consolidatedResult.criticalIssues.length}件`);
  console.log(`🟠 Major: ${consolidatedResult.majorIssues.length}件`);

  // レビュー履歴に追加
  const newReview = {
    iteration,
    timestamp: new Date().toISOString(),
    approved: consolidatedResult.approved,
    reviewers: consolidatedResult.reviewerResults.map((r) => ({
      name: r.reviewer,
      approved: r.approved,
      issuesCount: r.issues.length,
    })),
    criticalIssues: consolidatedResult.criticalIssues,
    majorIssues: consolidatedResult.majorIssues,
    suggestions: consolidatedResult.suggestions,
    overallAssessment: consolidatedResult.overallAssessment,
  };

  const updatedHistory = {
    reviews: [...(reviewHistory.reviews || []), newReview],
  };

  await persistence.saveDesignReviewHistory(currentProjectId, updatedHistory);

  console.log('💾 レビュー履歴を保存しました');

  // 承認されたかどうかで次のノードを決定
  if (consolidatedResult.approved) {
    console.log('✅ 設計書承認 → タスク分解フェーズへ');
    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'success',
          source: 'design_review',
          message: '設計書承認（3者協調レビュー完了）',
        },
      ],
    };
  } else {
    console.log('⚠️ 修正が必要です');
    console.log('📝 主な指摘事項:');
    consolidatedResult.criticalIssues.slice(0, 3).forEach((issue) => {
      console.log(`  - [${issue.severity}] ${issue.message}`);
    });

    return {
      reviewFeedback: {
        issues: [
          ...consolidatedResult.criticalIssues,
          ...consolidatedResult.majorIssues,
        ],
        suggestions: consolidatedResult.suggestions,
      },
      logs: [
        {
          timestamp: new Date(),
          level: 'warn',
          source: 'design_review',
          message: `修正必要: Critical ${consolidatedResult.criticalIssues.length}件、Major ${consolidatedResult.majorIssues.length}件`,
        },
      ],
    };
  }
}

/**
 * 設計書を読み込むヘルパー
 */
async function loadDesignDocument(
  persistence: DataPersistence,
  projectId: string,
  documentName: string
): Promise<string | null> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');

    // DataPersistenceの内部パス構造を再現
    const baseDir = (persistence as any).projectsDir;

    let filePath: string;

    switch (documentName) {
      case 'design-docs.md':
        filePath = path.join(baseDir, projectId, 'design', 'design-docs.md');
        break;
      case 'wireframes.md':
        filePath = path.join(baseDir, projectId, 'design', 'uiux', 'wireframes.md');
        break;
      case 'er-diagram.md':
        filePath = path.join(baseDir, projectId, 'design', 'database', 'er-diagram.md');
        break;
      case 'api-spec.md':
        filePath = path.join(baseDir, projectId, 'design', 'interfaces', 'api-spec.md');
        break;
      default:
        console.warn(`⚠️ 不明な設計書: ${documentName}`);
        return null;
    }

    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.warn(`⚠️ ${documentName}の読み込みに失敗:`, error);
    return null;
  }
}

/**
 * レビューを実行
 */
async function executeReview(
  provider: any,
  reviewer: 'DirectorAI' | 'ProductOwnerAI' | 'TechLeadAI',
  designDocs: {
    designDocsMarkdown: string | null;
    wireframesMarkdown: string | null;
    erDiagramMarkdown: string | null;
    apiSpecMarkdown: string | null;
  },
  storyMapping: any,
  cwd: string,
  maxTurns: number
): Promise<ReviewerResult> {
  const prompt = buildReviewPrompt(reviewer, designDocs, storyMapping);

  let aiResponseText = '';
  for await (const message of provider.execute(prompt, {
    maxTurns,
    cwd,
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
  return extractReviewerResult(reviewer, aiResponseText);
}

/**
 * レビュープロンプトを構築
 */
function buildReviewPrompt(
  reviewer: 'DirectorAI' | 'ProductOwnerAI' | 'TechLeadAI',
  designDocs: {
    designDocsMarkdown: string | null;
    wireframesMarkdown: string | null;
    erDiagramMarkdown: string | null;
    apiSpecMarkdown: string | null;
  },
  storyMapping: any
): string {
  const basePrompt = `
# 設計書レビュー（${reviewer}視点）

あなたは${reviewer}として、以下の設計書をレビューしてください。

## ストーリーマッピング（参照）

\`\`\`json
${JSON.stringify(storyMapping, null, 2)}
\`\`\`

## 設計書

### 全体設計

${designDocs.designDocsMarkdown || 'なし'}

### UI/UX設計

${designDocs.wireframesMarkdown || 'なし'}

### DB設計

${designDocs.erDiagramMarkdown || 'なし'}

### API設計

${designDocs.apiSpecMarkdown || 'なし'}
`;

  let specificGuidance = '';

  if (reviewer === 'DirectorAI') {
    specificGuidance = `
## レビュー観点（DirectorAI）

1. **プロジェクト全体の整合性**
   - ストーリーマッピングのゴールを実現できるか
   - Epicとの整合性があるか

2. **ビジネス価値の実現**
   - ペルソナのペインポイントを解決できるか
   - ROIが高いか

3. **全体設計の妥当性**
   - アーキテクチャは適切か
   - 技術スタックの選定は妥当か
`;
  } else if (reviewer === 'ProductOwnerAI') {
    specificGuidance = `
## レビュー観点（ProductOwnerAI）

1. **ユーザーストーリーとの整合性**
   - すべてのストーリーが実現可能か
   - 「As a / I want to / So that」が満たされるか

2. **受入基準の実現可能性**
   - 各ストーリーの受入基準が実装可能か
   - 測定可能か

3. **ユーザー体験**
   - UI/UX設計がユーザーフレンドリーか
   - 画面遷移が自然か
`;
  } else {
    // TechLeadAI
    specificGuidance = `
## レビュー観点（TechLeadAI）

1. **技術的実装可能性**
   - 設計が実装可能か
   - 技術的リスクはないか

2. **アーキテクチャの妥当性**
   - レイヤー分離が適切か
   - スケーラビリティがあるか

3. **設計の品質**
   - DB正規化は適切か
   - API設計はRESTfulか
   - セキュリティは考慮されているか
`;
  }

  return `
${basePrompt}
${specificGuidance}

## 出力形式

JSON形式で以下を出力してください：

\`\`\`json
{
  "approved": true または false,
  "issues": [
    {
      "severity": "critical" | "major" | "minor" | "info",
      "category": "カテゴリ名",
      "message": "指摘内容",
      "document": "design-docs" | "uiux" | "database" | "api"
    }
  ],
  "comments": [
    "コメント1",
    "コメント2"
  ]
}
\`\`\`

## 判定基準

- **critical な問題が0件**: 承認 (approved: true)
- **critical な問題が1件以上**: 修正必要 (approved: false)
`.trim();
}

/**
 * AIレスポンスからレビュー結果を抽出
 */
function extractReviewerResult(
  reviewer: 'DirectorAI' | 'ProductOwnerAI' | 'TechLeadAI',
  response: string
): ReviewerResult {
  // JSONコードブロックを抽出
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);

  let parsedResult: any;

  if (jsonMatch) {
    try {
      parsedResult = JSON.parse(jsonMatch[1]);
    } catch (error) {
      console.error(`❌ ${reviewer} レビュー結果のパースエラー:`, error);
      parsedResult = {
        approved: false,
        issues: [
          {
            severity: 'critical',
            category: 'parse_error',
            message: `${reviewer}のレスポンスパースに失敗`,
          },
        ],
        comments: [],
      };
    }
  } else {
    parsedResult = {
      approved: false,
      issues: [
        {
          severity: 'critical',
          category: 'format_error',
          message: `${reviewer}のレスポンスが不正な形式`,
        },
      ],
      comments: [],
    };
  }

  return {
    reviewer,
    approved: parsedResult.approved || false,
    issues: parsedResult.issues || [],
    comments: parsedResult.comments || [],
  };
}

/**
 * 3者のレビュー結果を統合
 */
function consolidateReviews(
  directorReview: ReviewerResult,
  productOwnerReview: ReviewerResult,
  techLeadReview: ReviewerResult
): DesignReviewResult {
  const allReviewers = [directorReview, productOwnerReview, techLeadReview];

  // すべてのissuesを集約
  const allIssues: ReviewIssue[] = allReviewers.flatMap((r) => r.issues);

  // critical/major issuesを抽出
  const criticalIssues = allIssues.filter((issue) => issue.severity === 'critical');
  const majorIssues = allIssues.filter((issue) => issue.severity === 'major');

  // 承認判定: すべてのレビュワーが承認、かつcritical issueが0件
  const approved =
    allReviewers.every((r) => r.approved) && criticalIssues.length === 0;

  // 提案を集約
  const suggestions = allReviewers.flatMap((r) => r.comments);

  // 総合評価
  const overallAssessment = buildOverallAssessment(
    allReviewers,
    criticalIssues,
    majorIssues
  );

  return {
    approved,
    reviewerResults: allReviewers,
    overallAssessment,
    criticalIssues,
    majorIssues,
    suggestions,
  };
}

/**
 * 総合評価を構築
 */
function buildOverallAssessment(
  reviewers: ReviewerResult[],
  criticalIssues: ReviewIssue[],
  majorIssues: ReviewIssue[]
): string {
  const approvedCount = reviewers.filter((r) => r.approved).length;
  const totalCount = reviewers.length;

  if (approvedCount === totalCount && criticalIssues.length === 0) {
    return `3者全員が承認。設計書は十分な品質です。`;
  } else {
    const criticalCount = criticalIssues.length;
    const majorCount = majorIssues.length;

    return `修正が必要です（承認: ${approvedCount}/${totalCount}、Critical: ${criticalCount}件、Major: ${majorCount}件）。指摘事項を確認し、設計書を修正してください。`;
  }
}
