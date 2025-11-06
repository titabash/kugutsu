/**
 * Director Node
 *
 * Creates story mapping for Scrum development workflow
 * Uses AI Provider to analyze user requirements and generate structured story mapping
 */

import type { ParallelDevStateType, ParallelDevStateUpdate } from '../state.js';
import type { StoryMapping } from '../../types/scrum.js';
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import { DataPersistence } from '../../utils/DataPersistence.js';
import { getSchemaValidator } from '../../utils/SchemaValidator.js';

/**
 * Director Node
 *
 * Phase 1: Analyze user requirements and create story mapping
 */
export async function directorNode(state: ParallelDevStateType): Promise<ParallelDevStateUpdate> {
  console.log('📋 DirectorAI: ストーリーマッピング作成開始');

  try {
    // Get AI provider
    const provider = state.config.provider
      ? AIProviderFactory.create({ provider: state.config.provider })
      : AIProviderFactory.createFromEnv();

    // Initialize data persistence
    const dataPersistence = new DataPersistence(state.config.baseRepoPath);
    const schemaValidator = getSchemaValidator();

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

# 出力形式（JSON）
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

# 重要な指示
- ペルソナは1つ
- エピックは3-5個
- 各エピックには2-5個のストーリー
- priorityは1（高）、2（中）、3（低）
- estimatedPointsは1（簡単）、3（普通）、5（難しい）、8（とても難しい）

JSON形式で出力してください。
`;

    // Execute AI prompt
    console.log('🤖 AI: ストーリーマッピング生成中...');

    let storyMappingJson = '';
    for await (const message of provider.execute(prompt, {
      maxTurns: state.config.maxTurns || 10,
      cwd: state.config.baseRepoPath,
      permissionMode: 'acceptEdits',
    })) {
      if (message.type === 'assistant' && typeof message.content === 'string') {
        storyMappingJson += message.content;
      }
    }

    // Extract JSON from response
    const jsonMatch = storyMappingJson.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      throw new Error('AIからのレスポンスにJSON形式のストーリーマッピングが含まれていません');
    }

    const storyMapping: StoryMapping = JSON.parse(jsonMatch[1]);

    // Validate schema (optional validation)
    try {
      const validation = schemaValidator.validate(JSON.stringify(storyMapping), 'storyMapping');
      if (!validation.valid) {
        console.warn('⚠️ ストーリーマッピングのスキーマ検証に失敗しました:', validation.errors);
        // Continue anyway (スキーマ検証エラーでも続行)
      }
    } catch (err) {
      // Schema validation is optional, continue without it
      console.debug('スキーマ検証をスキップしました');
    }

    // Generate Markdown representation
    const markdown = generateStoryMappingMarkdown(storyMapping);

    // Persist story mapping
    const projectId = state.currentProjectId || 'default-project';
    await dataPersistence.saveStoryMapping(projectId, { storyMapping, markdown });

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
          },
        },
      ],
    } as ParallelDevStateUpdate;
  } catch (error) {
    console.error('❌ DirectorAI: ストーリーマッピング作成エラー:', error);

    return {
      logs: [
        {
          timestamp: new Date(),
          level: 'error',
          source: 'DirectorAI',
          message: `ストーリーマッピング作成エラー: ${(error as Error).message}`,
          data: { error: String(error) },
        },
      ],
    } as ParallelDevStateUpdate;
  }
}

/**
 * Generate Markdown representation of story mapping
 */
function generateStoryMappingMarkdown(storyMapping: StoryMapping): string {
  let markdown = '# ストーリーマッピング\n\n';

  // Persona
  markdown += '## ペルソナ\n\n';
  markdown += `**名前**: ${storyMapping.persona.name}\n\n`;
  markdown += `**役割**: ${storyMapping.persona.role}\n\n`;
  markdown += `**目標**: ${storyMapping.persona.goal}\n\n`;

  if (storyMapping.persona.painPoints && storyMapping.persona.painPoints.length > 0) {
    markdown += '**課題**:\n';
    storyMapping.persona.painPoints.forEach((p) => {
      markdown += `- ${p}\n`;
    });
    markdown += '\n';
  }

  // Epics and Stories
  markdown += '## エピックとユーザーストーリー\n\n';

  storyMapping.epics
    .sort((a, b) => a.priority - b.priority)
    .forEach((epic) => {
      markdown += `### ${epic.title} (優先度: ${epic.priority})\n\n`;
      if (epic.description) {
        markdown += `${epic.description}\n\n`;
      }

      markdown += '#### ユーザーストーリー\n\n';
      epic.stories
        .sort((a, b) => a.priority - b.priority)
        .forEach((story) => {
          markdown += `##### ${story.title}\n\n`;
          markdown += `- **〜として**: ${story.asA}\n`;
          markdown += `- **〜したい**: ${story.iWantTo}\n`;
          markdown += `- **〜できるように**: ${story.soThat}\n`;
          markdown += `- **優先度**: ${story.priority}\n`;
          markdown += `- **見積もり**: ${story.estimatedPoints} ポイント\n\n`;

          markdown += '**受入基準**:\n';
          story.acceptanceCriteria.forEach((criteria) => {
            markdown += `- ${criteria}\n`;
          });
          markdown += '\n';
        });
    });

  return markdown;
}
