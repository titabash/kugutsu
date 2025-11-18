import { MessageHandler } from './MessageHandler.js';
/**
 * AIFileWriter
 *
 * AI-First原則に基づき、全てのファイル書き込みをAIに委譲するユーティリティ。
 *
 * システムが直接ファイルを書き込むのではなく、AIにWriteツールを使用させることで：
 * - 将来的なAI改善による自動的な品質向上
 * - ファイル形式変更時の柔軟な対応
 * - 一貫したファイル操作方法
 */
export class AIFileWriter {
    /**
     * AIを使用してファイルを作成/更新する
     *
     * @param provider AIプロバイダー
     * @param filePath ファイルパス（cwd からの相対パス）
     * @param content ファイルの内容（オブジェクトの場合はJSON化される）
     * @param cwd 作業ディレクトリ
     * @param maxTurns 最大ターン数（デフォルト: 3）
     */
    static async writeFile(provider, filePath, content, cwd, maxTurns = 3) {
        const jsonContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
        const prompt = `
以下の内容で正確にファイルを作成/更新してください。

**ファイルパス**: ${filePath}

**内容**:
\`\`\`json
${jsonContent}
\`\`\`

**重要**:
- 必ずWriteツールを使用してファイルを作成してください
- 上記のJSONをそのまま正確に書き込んでください
- 他のファイルには一切触れないでください
`;
        const handler = new MessageHandler({
            maxTurns,
            nodeName: `AIFileWriter - ${filePath}`,
        });
        for await (const message of provider.execute(prompt, {
            maxTurns,
            cwd,
            allowedTools: ['Write'],
            permissionMode: 'acceptEdits',
            includePartialMessages: true,
        })) {
            await handler.handleMessage(message);
        }
        // エラーチェック
        if (handler.getHasError()) {
            const details = handler.getErrorDetails();
            throw new Error(`ファイル書き込みに失敗: ${filePath} - ${details?.message || 'Unknown error'}`);
        }
        handler.complete(true, `ファイル書き込み完了: ${filePath}`);
    }
}
//# sourceMappingURL=AIFileWriter.js.map