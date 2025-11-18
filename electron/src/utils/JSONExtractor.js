/**
 * JSON Extractor Utility
 *
 * AI応答からのJSON抽出とエラーハンドリング
 * リトライ機能、詳細なエラーログ、スキーマバリデーションをサポート
 */
import { randomUUID } from 'crypto';
import Ajv from 'ajv';
const ajv = new Ajv({ allErrors: true });
/**
 * JSONExtractor ユーティリティクラス
 */
export class JSONExtractor {
    /**
     * コードブロックからJSONを抽出
     *
     * コードブロック形式（```json ... ```）と生のJSONオブジェクトの両方を自動判別・抽出します。
     *
     * @param response AI応答テキスト
     * @param options 抽出オプション
     * @returns 抽出結果
     */
    static extractFromCodeBlock(response, options = {}) {
        const { allowRawJSON = true, // デフォルトで生のJSONも自動検出
        allowedBlockTypes = ['json'], maxJSONLength = 1000, } = options;
        // コードブロックのパターンを構築
        const blockTypesPattern = allowedBlockTypes.join('|');
        const codeBlockPattern = new RegExp(`\`\`\`(?:${blockTypesPattern})?\\s*([\\s\\S]*?)\\s*\`\`\``, 'i');
        let jsonText;
        // まずコードブロック形式を試す
        const match = response.match(codeBlockPattern);
        if (match && match[1]) {
            jsonText = match[1].trim();
        }
        else if (allowRawJSON) {
            // コードブロックがない場合、生のJSONとしてパースを試みる
            // テキスト全体をトリムして、JSONオブジェクトまたは配列として有効か確認
            const trimmed = response.trim();
            // JSONオブジェクトまたは配列で始まる場合のみ試す
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                jsonText = trimmed;
            }
            else {
                // 周囲にテキストがある可能性があるため、JSON部分を抽出を試みる
                // 最初の { または [ から最後の } または ] までを抽出
                const objectMatch = trimmed.match(/\{[\s\S]*\}/);
                const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
                if (objectMatch) {
                    jsonText = objectMatch[0];
                }
                else if (arrayMatch) {
                    jsonText = arrayMatch[0];
                }
            }
        }
        if (!jsonText) {
            return {
                success: false,
                error: 'JSONブロックが見つかりません',
            };
        }
        // JSON パース
        try {
            const parsed = JSON.parse(jsonText);
            // スキーマバリデーション（オプション）
            if (options.schema) {
                const validate = ajv.compile(options.schema);
                const valid = validate(parsed);
                if (!valid) {
                    return {
                        success: false,
                        error: 'スキーマバリデーションエラー',
                        data: parsed,
                        rawJSON: this.truncateJSON(jsonText, maxJSONLength),
                        validationErrors: validate.errors || [],
                    };
                }
            }
            return {
                success: true,
                data: parsed,
            };
        }
        catch (error) {
            return {
                success: false,
                error: `JSONパースエラー: ${error instanceof Error ? error.message : String(error)}`,
                rawJSON: this.truncateJSON(jsonText, maxJSONLength),
                parseError: error instanceof Error ? error : new Error(String(error)),
            };
        }
    }
    /**
     * リトライ機能付きJSON抽出
     *
     * @param responseProvider 応答を提供する関数（リトライ時に再実行される）
     * @param extractor JSON抽出関数
     * @param retryOptions リトライオプション
     * @returns 抽出結果
     */
    static async extractWithRetry(responseProvider, extractor, retryOptions = {}) {
        const { maxRetries = 3, delayMs = 1000, backoffMultiplier = 2, } = retryOptions;
        let lastResult;
        let currentDelay = delayMs;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const response = typeof responseProvider === 'function'
                ? await responseProvider()
                : responseProvider;
            const result = extractor(response);
            if (result.success) {
                return {
                    ...result,
                    attempts: attempt,
                };
            }
            lastResult = result;
            // 最後の試行でなければ、遅延してリトライ
            if (attempt < maxRetries) {
                console.log(`⚠️ JSON抽出失敗（${attempt}/${maxRetries}）: ${result.error}`);
                console.log(`🔄 ${currentDelay}ms 後にリトライします...`);
                await this.delay(currentDelay);
                currentDelay *= backoffMultiplier;
            }
        }
        // すべてのリトライが失敗
        return {
            success: false,
            error: `リトライ上限（${maxRetries}回）に達しました: ${lastResult?.error}`,
            rawJSON: lastResult?.rawJSON,
            parseError: lastResult?.parseError,
            attempts: maxRetries,
        };
    }
    /**
     * タスクリストを抽出（TaskBreakdownNode用）
     *
     * @param response AI応答
     * @returns タスクリスト抽出結果
     */
    static extractTaskList(response) {
        const result = this.extractFromCodeBlock(response);
        if (!result.success) {
            return result;
        }
        const parsed = result.data;
        // tasksフィールドのチェック
        if (!parsed || typeof parsed !== 'object' || !('tasks' in parsed)) {
            return {
                success: false,
                error: 'tasksフィールドが見つかりません',
                data: parsed,
            };
        }
        const tasks = parsed.tasks;
        if (!Array.isArray(tasks)) {
            return {
                success: false,
                error: 'tasksフィールドが配列ではありません',
                data: parsed,
            };
        }
        if (tasks.length === 0) {
            return {
                success: false,
                error: 'タスクが見つかりません（空の配列）',
                data: tasks,
            };
        }
        // タスクの正規化
        const normalizedTasks = tasks.map((task) => ({
            id: task.id || `task-${randomUUID()}`,
            title: task.title || '無題タスク',
            description: task.description || '',
            storyId: task.storyId || undefined,
            type: task.type || 'feature',
            priority: task.priority !== undefined ? task.priority : 50,
            estimatedPoints: task.estimatedPoints || 5,
            dependencies: task.dependencies || [],
            acceptanceCriteria: task.acceptanceCriteria || [],
            technicalNotes: task.technicalNotes || undefined,
            assignedTo: task.assignedTo || undefined,
            status: task.status || 'pending',
            createdAt: task.createdAt || new Date().toISOString(),
        }));
        return {
            success: true,
            data: normalizedTasks,
        };
    }
    /**
     * スキーマバリデーション付きJSON抽出
     *
     * @param response AI応答
     * @param options 抽出オプション（スキーマ必須）
     * @returns 抽出結果
     */
    static extractJSON(response, options) {
        return this.extractFromCodeBlock(response, options);
    }
    /**
     * JSON文字列を切り詰める（エラーログ用）
     *
     * @param json JSON文字列
     * @param maxLength 最大長
     * @returns 切り詰められたJSON文字列
     */
    static truncateJSON(json, maxLength) {
        if (json.length <= maxLength) {
            return json;
        }
        const half = Math.floor((maxLength - 10) / 2);
        return `${json.substring(0, half)}...[省略]...${json.substring(json.length - half)}`;
    }
    /**
     * 遅延ユーティリティ
     *
     * @param ms ミリ秒
     */
    static delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=JSONExtractor.js.map