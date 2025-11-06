/**
 * DirectorAI
 *
 * スクラム開発フローの統括AI
 * - プロジェクト全体の理解と計画
 * - ユーザーストーリーマッピングの作成
 * - ProductOwnerAI、TechLeadAIとの協調
 */
import { BaseAI } from './BaseAI.js';
import { query } from '@anthropic-ai/claude-code';
import { DataPersistence } from '../utils/DataPersistence.js';
import { getSchemaValidator } from '../utils/SchemaValidator.js';
/**
 * DirectorAI
 *
 * プロジェクト統括AI
 */
export class DirectorAI extends BaseAI {
    baseRepoPath;
    dataPersistence;
    schemaValidator = getSchemaValidator();
    constructor(baseRepoPath) {
        super();
        this.baseRepoPath = baseRepoPath;
        this.dataPersistence = new DataPersistence(baseRepoPath);
    }
    getComponentType() {
        return 'Director';
    }
    getId() {
        return 'DirectorAI';
    }
    /**
     * ユーザー要求からストーリーマッピングを作成
     *
     * @param userRequest - ユーザーの要求
     * @param projectId - プロジェクトID
     * @returns ストーリーマッピング生成結果
     */
    async createStoryMapping(userRequest, projectId) {
        this.info('📖 ストーリーマッピング作成開始', { projectId });
        try {
            // AIにストーリーマッピングを生成させる
            const prompt = this.buildStoryMappingPrompt(userRequest);
            this.info('🤖 AI分析実行中...');
            const result = await query({
                prompt,
                options: {
                    maxTurns: 30,
                    allowedTools: ['Read', 'Glob', 'Grep'],
                    cwd: this.baseRepoPath,
                },
            });
            // レスポンスから JSON を抽出
            const responseText = typeof result === 'string' ? result : JSON.stringify(result);
            const storyMapping = this.extractStoryMapping(responseText);
            // スキーマバリデーション
            const validationResult = this.schemaValidator.validateStoryMapping(storyMapping);
            if (!validationResult.valid) {
                const errorMsg = this.schemaValidator.formatErrors(validationResult);
                this.error('❌ ストーリーマッピングのバリデーションエラー', {
                    errors: validationResult.errors,
                });
                throw new Error(`Story mapping validation failed:\n${errorMsg}`);
            }
            // Markdown形式のドキュメントを生成
            const markdown = this.generateStoryMappingMarkdown(storyMapping);
            // 永続化
            await this.dataPersistence.saveStoryMapping(projectId, storyMapping);
            await this.dataPersistence.saveStoryMappingMarkdown(projectId, markdown);
            this.success('✅ ストーリーマッピング作成完了', {
                projectId,
                epicsCount: storyMapping.epics.length,
                storiesCount: storyMapping.epics.reduce((sum, epic) => sum + epic.stories.length, 0),
            });
            return {
                storyMapping,
                markdown,
            };
        }
        catch (error) {
            this.error('❌ ストーリーマッピング作成エラー', { error: String(error) });
            throw error;
        }
    }
    /**
     * ストーリーマッピング生成のプロンプトを構築
     */
    buildStoryMappingPrompt(userRequest) {
        return `
あなたはプロジェクトディレクターとして、ユーザーの要求からユーザーストーリーマッピングを作成します。

# ユーザーの要求

${userRequest}

# タスク

プロジェクトのコードベースを分析し、ユーザーストーリーマッピングを作成してください。

# ストーリーマッピングの構造

以下のJSON形式で出力してください：

\`\`\`json
{
  "persona": {
    "name": "ペルソナ名",
    "role": "役割（例：プロジェクトマネージャー、開発者、エンドユーザー）",
    "goal": "達成したいゴール",
    "painPoints": ["課題1", "課題2"]
  },
  "epics": [
    {
      "id": "epic-1",
      "title": "Epic名",
      "description": "説明",
      "priority": 90,
      "stories": [
        {
          "id": "story-1-1",
          "title": "ストーリー名",
          "asA": "〜として",
          "iWantTo": "〜したい",
          "soThat": "〜できる",
          "acceptanceCriteria": [
            "受入基準1",
            "受入基準2"
          ],
          "priority": 90,
          "estimatedPoints": 5
        }
      ]
    }
  ]
}
\`\`\`

# 重要なポイント

1. **ペルソナ**: ターゲットユーザーを具体的に定義
2. **Epic**: 大きな機能グループ（3-5個程度）
3. **ストーリー**: 各Epicに3-7個のストーリー
4. **優先度**: 0-100の整数（高いほど優先）
5. **見積ポイント**: 1-21のフィボナッチ数（1,2,3,5,8,13,21）
6. **受入基準**: 具体的で測定可能な基準（各ストーリー最低2個）

# 出力

JSONブロック内にストーリーマッピングを出力してください。
JSONブロックの前後に説明は不要です。
`.trim();
    }
    /**
     * AIレスポンスからストーリーマッピングJSONを抽出
     */
    extractStoryMapping(response) {
        // JSONコードブロックを抽出
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
        if (!jsonMatch) {
            // コードブロックがない場合、レスポンス全体をパース試行
            try {
                return JSON.parse(response);
            }
            catch {
                throw new Error('AIレスポンスからJSONを抽出できませんでした');
            }
        }
        try {
            return JSON.parse(jsonMatch[1]);
        }
        catch (error) {
            throw new Error(`JSONパースエラー: ${error}`);
        }
    }
    /**
     * ストーリーマッピングからMarkdownドキュメントを生成
     */
    generateStoryMappingMarkdown(storyMapping) {
        const { persona, epics } = storyMapping;
        let markdown = '# ユーザーストーリーマッピング\n\n';
        markdown += `**作成日**: ${new Date().toISOString().split('T')[0]}\n`;
        markdown += `**作成者**: DirectorAI\n\n`;
        // ペルソナ
        markdown += '## ペルソナ\n\n';
        markdown += `**名前**: ${persona.name}\n`;
        markdown += `**役割**: ${persona.role}\n`;
        markdown += `**ゴール**: ${persona.goal}\n`;
        if (persona.painPoints && persona.painPoints.length > 0) {
            markdown += `\n**ペインポイント**:\n`;
            persona.painPoints.forEach((pain) => {
                markdown += `- ${pain}\n`;
            });
        }
        markdown += '\n';
        // Mermaid図（ストーリーマップ）
        markdown += '## ストーリーマップ\n\n';
        markdown += '```mermaid\n';
        markdown += 'graph LR\n';
        markdown += `  Persona["${persona.name}<br/>${persona.role}"]\n`;
        epics.forEach((epic, i) => {
            markdown += `  Epic${i + 1}["Epic ${i + 1}:<br/>${epic.title}"]\n`;
            markdown += `  Persona --> Epic${i + 1}\n`;
        });
        markdown += '```\n\n';
        // Epic詳細
        epics.forEach((epic, epicIndex) => {
            markdown += `## Epic ${epicIndex + 1}: ${epic.title}\n\n`;
            if (epic.description) {
                markdown += `${epic.description}\n\n`;
            }
            markdown += `**優先度**: ${epic.priority}\n\n`;
            // ストーリー
            markdown += '### ユーザーストーリー\n\n';
            epic.stories.forEach((story, storyIndex) => {
                markdown += `#### ${storyIndex + 1}. ${story.title}\n\n`;
                markdown += `- **As a** ${story.asA}\n`;
                markdown += `- **I want to** ${story.iWantTo}\n`;
                markdown += `- **So that** ${story.soThat}\n`;
                markdown += `- **優先度**: ${story.priority}\n`;
                markdown += `- **見積ポイント**: ${story.estimatedPoints}\n\n`;
                markdown += `**受入基準**:\n`;
                story.acceptanceCriteria.forEach((criteria) => {
                    markdown += `- [ ] ${criteria}\n`;
                });
                markdown += '\n';
            });
        });
        return markdown;
    }
    /**
     * 既存のストーリーマッピングを読み込み
     */
    async loadStoryMapping(projectId) {
        return await this.dataPersistence.loadStoryMapping(projectId);
    }
}
//# sourceMappingURL=DirectorAI.js.map