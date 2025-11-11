/**
 * Director Node
 *
 * Creates story mapping for Scrum development workflow
 * Uses AI Provider to analyze user requirements and generate structured story mapping
 */
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import { getSchemaValidator } from '../../utils/SchemaValidator.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { MessageHandler } from '../../utils/MessageHandler.js';
/**
 * Director Node
 *
 * Phase 1: Analyze user requirements and create story mapping
 */
export async function directorNode(state) {
    console.log('📋 DirectorAI: ストーリーマッピング作成開始');
    // currentProjectId 必須チェック
    if (!state.currentProjectId) {
        console.error('❌ currentProjectId が設定されていません');
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'error',
                    source: 'DirectorNode',
                    message: 'currentProjectId が設定されていません（check_modeで設定されるべき）',
                },
            ],
        };
    }
    try {
        // Get AI provider
        const providerConfig = AIProviderFactory.buildProviderConfig({
            provider: state.config.provider ||
                process.env.KUGUTSU_PROVIDER ||
                'mock',
        });
        const provider = AIProviderFactory.create(providerConfig);
        const schemaValidator = getSchemaValidator();
        const projectId = state.currentProjectId;
        // Define file paths
        const storyMapJsonPath = path.join(state.config.baseRepoPath, '.kugutsu', 'projects', projectId, 'story-mapping', 'story-map.json');
        const storyMapMdPath = path.join(state.config.baseRepoPath, '.kugutsu', 'projects', projectId, 'story-mapping', 'story-map.md');
        // Create prompt for story mapping
        const prompt = `
あなたはプロジェクトディレクターとして、ユーザー要求を分析し、ストーリーマッピングを作成してください。

# ユーザー要求
${state.userRequest}

# タスク
以下の形式でストーリーマッピングを作成してください：

1. **ペルソナ**: プロジェクトのターゲットユーザー
2. **エピック**: 大きな機能グループ（3-5個）
3. **ユーザーストーリー**: 各エピックを構成する具体的なストーリー

# 【必須作成ファイル】
以下の2つのファイルをWriteツールで必ず作成してください：

## 1. ${storyMapJsonPath}
以下の形式のJSONファイルを作成してください：
\`\`\`json
{
  "persona": {
    "name": "ペルソナ名",
    "role": "役割",
    "goal": "目標",
    "painPoints": ["課題1", "課題2"]
  },
  "epics": [
    {
      "id": "epic-1",
      "title": "エピックタイトル",
      "description": "エピック説明",
      "priority": 1,
      "stories": [
        {
          "id": "story-1",
          "title": "ストーリータイトル",
          "asA": "〜として",
          "iWantTo": "〜したい",
          "soThat": "〜できるように",
          "acceptanceCriteria": ["受入基準1", "受入基準2"],
          "priority": 1,
          "estimatedPoints": 3
        }
      ]
    }
  ]
}
\`\`\`

## 2. ${storyMapMdPath}
上記JSONの内容を人間が読みやすいMarkdown形式に整形して作成してください。
以下の構成で作成してください：
- ペルソナ情報（名前、役割、目標、課題）
- エピックとユーザーストーリー（優先度順）
- 各ストーリーの詳細（asA, iWantTo, soThat, 受入基準、見積もり）

# 重要な指示
- ペルソナは1つ
- エピックは3-5個
- 各エピックには2-5個のストーリー
- priorityは1（高）、2（中）、3（低）
- estimatedPointsは1（簡単）、3（普通）、5（難しい）、8（とても難しい）
- **必ずWriteツールを使用して上記2つのファイルを作成してください**
- 作成後、Readツールで各ファイルの存在を確認してください

これらのファイルを作成せずにタスクを完了してはいけません。
`;
        // Execute AI prompt with Write tool
        const handler = new MessageHandler({
            maxTurns: state.config.maxTurns || 50,
            nodeName: 'Director - Story Mapping',
        });
        // Execute AI to write files using Write tool
        for await (const message of provider.execute(prompt, {
            maxTurns: state.config.maxTurns || 50,
            cwd: state.config.baseRepoPath,
            allowedTools: ['Write', 'Read'],
            permissionMode: 'acceptEdits',
            includePartialMessages: true,
        })) {
            await handler.handleMessage(message);
        }
        // エラーチェック（Claude Agent SDK仕様準拠）
        if (handler.getHasError()) {
            const details = handler.getErrorDetails();
            // エラーメッセージの構築
            let errorMsg;
            if (details?.message) {
                errorMsg = details.subtype === 'error_max_turns'
                    ? `AI実行がmaxTurns制限に到達しました: ${details.message}`
                    : `AI実行中にエラーが発生しました: ${details.message}`;
            }
            else if (details?.errors && details.errors.length > 0) {
                errorMsg = `AI実行中にエラーが発生しました: ${details.errors.join('; ')}`;
            }
            else {
                errorMsg = `AI実行中にエラーが発生しました (subtype: ${details?.subtype || 'unknown'})`;
                console.warn(`⚠️  エラー詳細が取得できませんでした。ErrorDetails:`, JSON.stringify(details, null, 2));
            }
            throw new Error(errorMsg);
        }
        handler.complete(true, 'ストーリーマッピング生成が完了しました');
        // Read the created JSON file to get story mapping
        const storyMappingContent = await fs.readFile(storyMapJsonPath, 'utf-8');
        const storyMapping = JSON.parse(storyMappingContent);
        // Validate schema (optional validation)
        try {
            const validation = schemaValidator.validate(JSON.stringify(storyMapping), 'storyMapping');
            if (!validation.valid) {
                console.warn('⚠️ ストーリーマッピングのスキーマ検証に失敗しました:', validation.errors);
                // Continue anyway (スキーマ検証エラーでも続行)
            }
        }
        catch (err) {
            // Schema validation is optional, continue without it
            console.debug('スキーマ検証をスキップしました');
        }
        console.log('✅ ストーリーマッピング作成完了');
        return {
            storyMapping,
            currentProjectId: projectId,
            logs: [
                {
                    timestamp: new Date(),
                    level: 'success',
                    source: 'DirectorAI',
                    message: 'ストーリーマッピング作成完了',
                    data: {
                        epicCount: storyMapping.epics.length,
                        storyCount: storyMapping.epics.reduce((sum, e) => sum + e.stories.length, 0),
                        files: {
                            json: storyMapJsonPath,
                            markdown: storyMapMdPath,
                        },
                    },
                },
            ],
        };
    }
    catch (error) {
        console.error('❌ DirectorAI: ストーリーマッピング作成エラー:', error);
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'error',
                    source: 'DirectorAI',
                    message: `ストーリーマッピング作成エラー: ${error.message}`,
                    data: { error: String(error) },
                },
            ],
        };
    }
}
//# sourceMappingURL=DirectorNode.js.map