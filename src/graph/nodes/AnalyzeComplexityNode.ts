/**
 * Analyze Complexity Node
 *
 * AI-driven complexity analysis to determine if detailed design phase is required
 */

import type { ParallelDevStateType, ParallelDevStateUpdate } from '../state.js';
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import { MessageHandler } from '../../utils/MessageHandler.js';
import { RetryManager } from '../../utils/RetryManager.js';
import { JSONExtractor } from '../../utils/JSONExtractor.js';

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

    // Helper function to execute analysis with a specific provider
    const executeAnalysis = async (providerType: 'claude' | 'codex') => {
      const providerConfig = AIProviderFactory.buildProviderConfig({
        provider: providerType,
      });
      const provider = AIProviderFactory.create(providerConfig);

    const handler = new MessageHandler({
      maxTurns: 5,
        nodeName: `AnalyzeComplexity - Complexity Analysis (${providerType})`,
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

      // Check if response contains permanent error message (check both handler error and response text)
      const responseLower = aiResponseText.toLowerCase();
      const hasPermanentErrorInResponse = (
        responseLower.includes('weekly limit') ||
        responseLower.includes('monthly limit') ||
        responseLower.includes('quota') ||
        responseLower.includes('limit reached') ||
        responseLower.includes('subscription') ||
        responseLower.includes('billing')
      );

      // エラーチェック（Claude Agent SDK仕様準拠）
      if (handler.getHasError()) {
        const details = handler.getErrorDetails();

        // エラーメッセージの構築（aiResponseTextも含める）
        let errorMsg: string;
        if (hasPermanentErrorInResponse) {
          // 永続的エラーがaiResponseTextに含まれている場合
          errorMsg = aiResponseText.trim();
        } else if (details?.message) {
          errorMsg = details.subtype === 'error_max_turns'
            ? `AI実行がmaxTurns制限に到達しました: ${details.message}`
            : `AI実行中にエラーが発生しました: ${details.message}`;
        } else if (details?.errors && details.errors.length > 0) {
          errorMsg = `AI実行中にエラーが発生しました: ${details.errors.join('; ')}`;
        } else {
          errorMsg = `AI実行中にエラーが発生しました (subtype: ${details?.subtype || 'unknown'})`;
          console.warn(`⚠️  エラー詳細が取得できませんでした。ErrorDetails:`, JSON.stringify(details, null, 2));
        }

        throw new Error(errorMsg);
      }

      // Handler errorがない場合でも、response textに永続的エラーが含まれている場合はエラーとする
      if (hasPermanentErrorInResponse) {
        throw new Error(aiResponseText.trim());
      }

      // Parse AI response
      return parseAnalysisResult(aiResponseText);
    };

    // Query AI provider with retry
    console.log('🤖 AI分析を実行中...');

    const primaryProvider = (config.provider || 'claude') as 'claude' | 'codex';
    const fallbackProvider: 'claude' | 'codex' = primaryProvider === 'claude' ? 'codex' : 'claude';

    // Check if error is a permanent error (e.g., weekly limit) that should trigger fallback
    const isPermanentError = (error: Error): boolean => {
      const errorMsg = error.message.toLowerCase();
      // Check for permanent error patterns (case-insensitive, anywhere in message)
      return (
        errorMsg.includes('weekly limit') ||
        errorMsg.includes('monthly limit') ||
        errorMsg.includes('quota') ||
        errorMsg.includes('limit reached') ||
        errorMsg.includes('subscription') ||
        errorMsg.includes('billing') ||
        errorMsg.includes('ai応答に永続的エラーが含まれています')
      );
    };

    // Try primary provider first (without retry for permanent errors)
    let primaryError: Error | undefined;
    let primaryResult: ReturnType<typeof parseAnalysisResult> | undefined;

    try {
      primaryResult = await executeAnalysis(primaryProvider);
    } catch (error) {
      primaryError = error instanceof Error ? error : new Error(String(error));

      // Check if it's a permanent error - if so, try fallback immediately
      if (isPermanentError(primaryError)) {
        console.log(`⚠️ ${primaryProvider}で永続的エラーが発生しました: ${primaryError.message}`);
        console.log(`🔄 ${fallbackProvider}にフォールバックします...`);

        try {
          primaryResult = await executeAnalysis(fallbackProvider);
          console.log(`✅ ${fallbackProvider}で複雑度判定完了: ${primaryResult.requiresDetailedDesign ? '高（詳細設計実行）' : '低（詳細設計スキップ）'}`);
          console.log(`📄 判定理由: ${primaryResult.reason}`);

          return {
            metadata: {
              requiresDetailedDesign: primaryResult.requiresDetailedDesign,
              complexityReason: `${primaryResult.reason} (${fallbackProvider}フォールバック使用)`,
            },
            logs: [
              {
                timestamp: new Date(),
                level: 'info',
                source: 'AnalyzeComplexityNode',
                message: `複雑度判定: ${primaryResult.requiresDetailedDesign ? '高（詳細設計実行）' : '低（詳細設計スキップ）'}`,
                data: {
                  requiresDetailedDesign: primaryResult.requiresDetailedDesign,
                  complexityLevel: primaryResult.complexityLevel,
                  reason: primaryResult.reason,
                  fallbackProvider,
                  originalError: primaryError.message,
                },
              },
            ],
          };
        } catch (fallbackError) {
          const fallbackErr = fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError));

          // Fallback provider also failed with permanent error - stop processing
          if (isPermanentError(fallbackErr)) {
            const errorMessage = `両方のAIプロバイダー（${primaryProvider}と${fallbackProvider}）で永続的エラーが発生しました。処理を停止します。\n` +
              `- ${primaryProvider}エラー: ${primaryError.message}\n` +
              `- ${fallbackProvider}エラー: ${fallbackErr.message}`;

            console.error(`❌ ${errorMessage}`);

            throw new Error(errorMessage);
          }

          // Fallback failed with temporary error - throw original error
          throw primaryError;
        }
      }

      // Temporary error - retry with RetryManager
      const analysisResult = await RetryManager.executeWithRetry(
        async () => executeAnalysis(primaryProvider),
        {
          maxRetries: 3,
          initialDelayMs: 2000,
          maxDelayMs: 30000,
          backoffMultiplier: 2,
          retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'timeout', 'network'],
        }
      );

      if (!analysisResult.success) {
        // AI実行失敗（一時的エラーの場合）- 保守的に詳細設計を実行
        const fallbackReason = `AI判定エラーが発生したため、保守的に詳細設計フェーズを実行します。エラー: ${analysisResult.error?.message || 'Unknown error'}`;
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
                error: analysisResult.error?.message || 'Unknown error',
                attempts: analysisResult.attempts,
                fallbackReason,
              },
            },
          ],
        };
      }

      primaryResult = analysisResult.data;
    }

    if (!primaryResult) {
      throw new Error('Unexpected error: analysis result is undefined');
    }

    const result = primaryResult;

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
    // Extract JSON from response using JSONExtractor
    const extractionResult = JSONExtractor.extractFromCodeBlock<{
      requiresDetailedDesign: boolean;
      complexityLevel?: string;
      reason: string;
    }>(text);

    if (!extractionResult.success) {
      throw new Error(`JSON抽出に失敗: ${extractionResult.error}`);
    }

    const parsed = extractionResult.data!;

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
