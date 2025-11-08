/**
 * Analyze Complexity Node
 *
 * AI-driven complexity analysis to determine if detailed design phase is required
 */

import type { ParallelDevStateType, ParallelDevStateUpdate } from '../state.js';
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import type { AIProviderConfig } from '../../providers/IAIProvider.js';
import { MessageHandler } from '../../utils/MessageHandler.js';

/**
 * Analyze Complexity Node
 *
 * Responsibilities:
 * 1. Analyze user request using AI
 * 2. Determine if detailed design phase is required
 * 3. Set metadata.requiresDetailedDesign flag
 * 4. Record judgment reason in metadata.complexityReason
 *
 * Decision Criteria:
 * - Low Complexity (skip design): Bug fixes, small feature additions, documentation updates
 * - High Complexity (full Scrum): New features, architecture changes, large refactoring
 *
 * Conservative Judgment:
 * - When in doubt, default to detailed design (requiresDetailedDesign = true)
 * - Better to over-prepare than to under-prepare
 */
export async function analyzeComplexityNode(
  state: ParallelDevStateType
): Promise<ParallelDevStateUpdate> {
  const { userRequest, config } = state;

  console.log('🔍 Analyze Complexity: ユーザー要求の複雑度を判定中...');
  console.log(`📝 ユーザー要求: ${userRequest}`);

  try {
    // Create AI provider
    const providerConfig: AIProviderConfig = {
      provider: config.provider || 'claude',
      claude: {
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
      },
    };
    const provider = AIProviderFactory.create(providerConfig);

    // AI analysis prompt
    const analysisPrompt = `
You are an expert software architect analyzing a development request to determine its complexity.

## User Request
${userRequest}

## Repository Context
Base branch: ${config.baseBranch}
Repository path: ${config.baseRepoPath}

## Task
Analyze the user request and determine if it requires detailed design phase (story mapping + technical design).

## Complexity Criteria

### Low Complexity (Skip Design Phase)
- Bug fixes (単純なバグ修正)
- Small feature additions (既存機能の小規模な追加・調整)
- Documentation updates (ドキュメント更新)
- Configuration changes (設定変更)
- Minor refactoring (局所的なリファクタリング)

### High Complexity (Detailed Design Required)
- New features with multiple components (複数コンポーネントにまたがる新機能)
- Architecture changes (アーキテクチャ変更)
- Large refactoring (大規模リファクタリング)
- Database schema changes (データベーススキーマ変更)
- New API endpoints with multiple services (複数サービスにまたがるAPI追加)
- UI/UX redesign (UI/UX再設計)

## Conservative Judgment
When in doubt, default to HIGH COMPLEXITY (detailed design).
Better to over-prepare than to under-prepare.

## Output Format
Respond ONLY with a JSON object in the following format:
\`\`\`json
{
  "requiresDetailedDesign": true,
  "complexityLevel": "high",
  "reason": "This request involves creating a new authentication system with multiple components (user model, JWT tokens, middleware, API endpoints). This requires detailed story mapping and technical design to ensure proper architecture."
}
\`\`\`

Or:
\`\`\`json
{
  "requiresDetailedDesign": false,
  "complexityLevel": "low",
  "reason": "This is a simple bug fix in the login validation logic. The change is localized to a single file and doesn't require architecture-level design."
}
\`\`\`

DO NOT include any other text, only the JSON object.
`.trim();

    // Query AI provider
    console.log('🤖 AI分析を実行中...');

    const handler = new MessageHandler({
      maxTurns: 5,
      nodeName: 'AnalyzeComplexity - Complexity Analysis',
    });

    let aiResponseText = '';
    for await (const message of provider.execute(analysisPrompt, {
      maxTurns: 5,
      cwd: config.baseRepoPath,
      allowedTools: ['Read', 'Glob'],
      permissionMode: 'acceptEdits',
      includePartialMessages: true,
    })) {
      await handler.handleMessage(message);

      if (message.type === 'assistant' && typeof message.content === 'string') {
        aiResponseText += message.content;
      }
    }

    handler.complete(true, '複雑度分析が完了しました');

    // Parse AI response
    const result = parseAnalysisResult(aiResponseText);

    console.log(`✅ 複雑度判定完了: ${result.requiresDetailedDesign ? '高（詳細設計実行）' : '低（詳細設計スキップ）'}`);
    console.log(`📄 判定理由: ${result.reason}`);

    // Return state update
    return {
      metadata: {
        requiresDetailedDesign: result.requiresDetailedDesign,
        complexityReason: result.reason,
      },
      logs: [
        {
          timestamp: new Date(),
          level: 'info',
          source: 'AnalyzeComplexityNode',
          message: `複雑度判定: ${result.requiresDetailedDesign ? '高（詳細設計実行）' : '低（詳細設計スキップ）'}`,
          data: {
            requiresDetailedDesign: result.requiresDetailedDesign,
            complexityLevel: result.complexityLevel,
            reason: result.reason,
          },
        },
      ],
    };
  } catch (error) {
    console.error('❌ Analyze Complexity Node エラー:', error);

    // Default to detailed design on error (conservative)
    const fallbackReason = `AI判定エラーが発生したため、保守的に詳細設計フェーズを実行します。エラー: ${error instanceof Error ? error.message : String(error)}`;

    console.warn('⚠️ エラー発生により詳細設計フェーズを実行します（保守的判定）');

    return {
      metadata: {
        requiresDetailedDesign: true,
        complexityReason: fallbackReason,
      },
      logs: [
        {
          timestamp: new Date(),
          level: 'warn',
          source: 'AnalyzeComplexityNode',
          message: '複雑度判定エラー: 保守的に詳細設計フェーズを実行',
          data: {
            error: error instanceof Error ? error.message : String(error),
            fallbackReason,
          },
        },
      ],
    };
  }
}

/**
 * Parse AI analysis result
 *
 * @param text - AI response text
 * @returns Parsed analysis result
 */
function parseAnalysisResult(text: string): {
  requiresDetailedDesign: boolean;
  complexityLevel: string;
  reason: string;
} {
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    const parsed = JSON.parse(jsonText.trim());

    // Validate required fields
    if (typeof parsed.requiresDetailedDesign !== 'boolean') {
      throw new Error('Missing or invalid "requiresDetailedDesign" field');
    }
    if (typeof parsed.reason !== 'string' || parsed.reason.length === 0) {
      throw new Error('Missing or invalid "reason" field');
    }

    return {
      requiresDetailedDesign: parsed.requiresDetailedDesign,
      complexityLevel: parsed.complexityLevel || (parsed.requiresDetailedDesign ? 'high' : 'low'),
      reason: parsed.reason,
    };
  } catch (error) {
    console.error('❌ AI応答のパースに失敗:', error);
    console.error('AI応答:', text);

    // Fallback: conservative judgment
    return {
      requiresDetailedDesign: true,
      complexityLevel: 'high',
      reason: `AI応答のパースに失敗したため、保守的に詳細設計フェーズを実行します。パースエラー: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
