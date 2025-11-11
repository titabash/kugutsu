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
        for await (const message of provider.execute(prompt, {
            maxTurns,
            cwd,
            allowedTools: ['Write'],
            permissionMode: 'acceptEdits',
        })) {
            // AIがファイルを書き込むのを待つ
        }
    }
    /**
     * AIを使用してtasks.jsonの特定タスクを更新する
     *
     * tasks.jsonは複数のノードが更新するため、Read→Update→Write のフローをAIに指示する。
     *
     * @param provider AIプロバイダー
     * @param tasksPath tasks.jsonのパス（cwd からの相対パス）
     * @param taskId 更新対象のタスクID
     * @param updates 更新するフィールド（部分更新）
     * @param cwd 作業ディレクトリ
     * @param maxTurns 最大ターン数（デフォルト: 5）
     */
    static async updateTaskInTasksJson(provider, tasksPath, taskId, updates, cwd, maxTurns = 5) {
        const prompt = `
tasks.jsonファイル内の特定タスクを更新してください。

**ファイルパス**: ${tasksPath}

**タスクID**: ${taskId}

**更新内容**:
${JSON.stringify(updates, null, 2)}

**手順**:
1. Readツールで ${tasksPath} を読み込む
2. JSON配列から id="${taskId}" のタスクを見つける
3. 見つけたタスクの以下のフィールドを更新する：
${Object.keys(updates).map(key => `   - ${key}: ${JSON.stringify(updates[key])}`).join('\n')}
4. Writeツールで ${tasksPath} に更新後のJSON配列全体を書き戻す

**重要**:
- 他のタスクは一切変更しないでください
- JSON配列の構造を保持してください
- 必ずWriteツールを使用してください
`;
        for await (const message of provider.execute(prompt, {
            maxTurns,
            cwd,
            allowedTools: ['Read', 'Write'],
            permissionMode: 'acceptEdits',
        })) {
            // AIがファイルを更新するのを待つ
        }
    }
    /**
     * AIを使用してtasks.json内の複数タスクを一括更新する
     *
     * @param provider AIプロバイダー
     * @param tasksPath tasks.jsonのパス
     * @param taskUpdates タスクID → 更新内容のマップ
     * @param cwd 作業ディレクトリ
     * @param maxTurns 最大ターン数（デフォルト: 5）
     */
    static async updateMultipleTasksInTasksJson(provider, tasksPath, taskUpdates, cwd, maxTurns = 5) {
        const updatesList = Array.from(taskUpdates.entries()).map(([taskId, updates]) => ({
            taskId,
            updates,
        }));
        const prompt = `
tasks.jsonファイル内の複数タスクを一括更新してください。

**ファイルパス**: ${tasksPath}

**更新対象タスク**:
${JSON.stringify(updatesList, null, 2)}

**手順**:
1. Readツールで ${tasksPath} を読み込む
2. JSON配列から各taskIdのタスクを見つける
3. 各タスクに対応するupdatesの内容でフィールドを更新する
4. Writeツールで ${tasksPath} に更新後のJSON配列全体を書き戻す

**重要**:
- 更新対象以外のタスクは一切変更しないでください
- JSON配列の構造を保持してください
- 必ずWriteツールを使用してください
`;
        for await (const message of provider.execute(prompt, {
            maxTurns,
            cwd,
            allowedTools: ['Read', 'Write'],
            permissionMode: 'acceptEdits',
        })) {
            // AIがファイルを更新するのを待つ
        }
    }
}
//# sourceMappingURL=AIFileWriter.js.map