/**
 * Analyze Complexity Node
 *
 * AI-driven complexity analysis to determine if detailed design phase is required
 */
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
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
export async function analyzeComplexityNode(state) {
    const { userRequest, config } = state;
    // Sync failed providers from state
    AIProviderFactory.syncWithState(state.failedProviders || []);
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
        const executeAnalysis = async (providerType) => {
            const providerConfig = AIProviderFactory.buildProviderConfig({
                provider: providerType,
            });
            const provider = AIProviderFactory.create(providerConfig);
            // Collect messages and check for errors
            // Note: FallbackAIProvider already handles logging via its own MessageHandler
            let aiResponseText = '';
            let hasError = false;
            let errorDetails = null;
            for await (const message of provider.execute(analysisPrompt, {
                maxTurns: 5,
                cwd: config.baseRepoPath,
                allowedTools: ['Read', 'Glob'],
                permissionMode: 'acceptEdits',
            })) {
                if (message.type === 'assistant' && typeof message.content === 'string') {
                    aiResponseText += message.content;
                }
                else if (message.type === 'result') {
                    // Check for errors in result message (sent by FallbackAIProvider)
                    if (message.content && !message.content.success) {
                        hasError = true;
                        errorDetails = message.content;
                    }
                }
            }
            // エラーチェック（FallbackAIProviderが検出したエラー）
            if (hasError) {
                const errorMsg = errorDetails?.error || errorDetails?.errors?.join('; ') || 'Unknown error';
                throw new Error(errorMsg);
            }
            // Parse AI response
            return parseAnalysisResult(aiResponseText);
        };
        // Query AI provider with retry
        console.log('🤖 AI分析を実行中...');
        const primaryProvider = (config.provider || 'claude');
        // Execute analysis with FallbackAIProvider (automatic fallback handled by provider layer)
        // RetryManager handles temporary errors with exponential backoff
        let primaryResult;
        const analysisResult = await RetryManager.executeWithRetry(async () => executeAnalysis(primaryProvider), {
            maxRetries: 3,
            initialDelayMs: 2000,
            maxDelayMs: 30000,
            backoffMultiplier: 2,
            retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'timeout', 'network'],
        });
        if (!analysisResult.success) {
            // AI実行失敗 - 保守的に詳細設計を実行
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
                failedProviders: AIProviderFactory.getFailedProviders(),
            };
        }
        primaryResult = analysisResult.data;
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
            failedProviders: AIProviderFactory.getFailedProviders(),
        };
    }
    catch (error) {
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
            failedProviders: AIProviderFactory.getFailedProviders(),
        };
    }
}
/**
 * Parse AI analysis result
 *
 * @param text - AI response text
 * @returns Parsed analysis result
 */
function parseAnalysisResult(text) {
    try {
        // Extract JSON from response using JSONExtractor
        const extractionResult = JSONExtractor.extractFromCodeBlock(text);
        if (!extractionResult.success) {
            throw new Error(`JSON抽出に失敗: ${extractionResult.error}`);
        }
        const parsed = extractionResult.data;
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
    }
    catch (error) {
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
//# sourceMappingURL=AnalyzeComplexityNode.js.map