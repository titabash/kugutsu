/**
 * Check Mode Node
 *
 * ユーザーリクエストを分析して、継続モードか新規モードかを判定
 *
 * 継続モード: "続き", "continue", "残り" などのキーワードを検出
 * 新規モード: 新しいプロジェクトを開始
 */
import { PriorityCalculator } from '../../utils/PriorityCalculator.js';
import { DataPersistence } from '../../utils/DataPersistence.js';
import { AIProviderFactory } from '../../providers/AIProviderFactory.js';
import { randomUUID } from 'crypto';
/**
 * Check Mode Node
 *
 * Responsibilities:
 * 1. Detect continuation mode from user request using AI
 * 2. Load global queue and project metadata
 * 3. Set continuationMode flag
 * 4. Generate new projectId for new mode or identify latest project for continuation
 * 5. Update state with loaded data
 */
export async function checkModeNode(state) {
    const { userRequest, config } = state;
    console.log('🔍 CheckMode: ユーザーリクエストを分析しています...');
    console.log(`📝 リクエスト: ${userRequest}`);
    // データ永続化マネージャーを初期化
    const persistence = new DataPersistence(config.baseRepoPath);
    await persistence.initialize();
    // グローバルキューとプロジェクトメタデータを読み込む
    const globalTasks = await persistence.loadGlobalQueue();
    const projects = await persistence.loadAllProjectMetadata();
    console.log(`📊 既存タスク数: ${globalTasks.length}`);
    console.log(`📁 既存プロジェクト数: ${projects.size}`);
    // 未完了タスク数を計算
    const incompleteTasks = globalTasks.filter((task) => task.status !== 'completed' && task.status !== 'failed');
    // 最新プロジェクトを取得
    let latestProject;
    if (projects.size > 0) {
        const sortedProjects = Array.from(projects.values()).sort((a, b) => b.requestTimestamp.getTime() - a.requestTimestamp.getTime());
        latestProject = sortedProjects[0];
    }
    // AI駆動で継続モードを判定
    const providerConfig = {
        provider: config.provider || 'claude',
        claude: {
            model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
        },
    };
    const provider = AIProviderFactory.create(providerConfig);
    const continuationDetectionPrompt = `
# ユーザーリクエストの意図分析

以下のユーザーリクエストを分析し、継続モードか新規モードかを判定してください。

## ユーザーリクエスト
${userRequest}

## 既存プロジェクト情報
- 既存プロジェクト数: ${projects.size}
- 未完了タスク数: ${incompleteTasks.length}
- 最新プロジェクト: ${latestProject?.userRequest || 'なし'}

## 判定基準
**継続モード**:
- 既存プロジェクトの続きを依頼している
- 既存の未完了タスクに関連する作業
- 文脈から既存作業の継続を示唆している

**新規モード**:
- 全く新しい機能や要求
- 既存プロジェクトと無関係
- 新規プロジェクトの開始を明示

## 出力形式
JSON形式で以下を出力してください：
\`\`\`json
{
  "isContinuation": true または false,
  "reasoning": "判定理由の説明"
}
\`\`\`
`;
    console.log('🤖 AI: 継続モード判定中...');
    let aiResponseText = '';
    for await (const message of provider.execute(continuationDetectionPrompt, {
        maxTurns: 5,
        cwd: config.baseRepoPath,
        allowedTools: [],
        permissionMode: 'acceptEdits',
    })) {
        if (message.type === 'assistant' && message.content) {
            // Handle both string and object content
            if (typeof message.content === 'string') {
                aiResponseText += message.content;
            }
            else {
                aiResponseText += JSON.stringify(message.content);
            }
        }
    }
    // JSONを抽出してパース
    const jsonMatch = aiResponseText.match(/```json\n([\s\S]*?)\n```/);
    let isContinuation = false;
    let reasoning = '';
    if (jsonMatch) {
        try {
            const result = JSON.parse(jsonMatch[1]);
            isContinuation = result.isContinuation;
            reasoning = result.reasoning;
            console.log(`✅ AI判定: ${isContinuation ? '継続モード' : '新規モード'}`);
            console.log(`💭 理由: ${reasoning}`);
        }
        catch (error) {
            console.error('❌ AI応答のJSON解析に失敗しました:', error);
            // デフォルトは新規モード
            isContinuation = false;
        }
    }
    else {
        console.warn('⚠️ AI応答からJSONを抽出できませんでした。新規モードとして扱います。');
        isContinuation = false;
    }
    let currentProjectId;
    let currentUserRequest;
    let continuationMode;
    if (isContinuation && projects.size > 0 && latestProject) {
        // 継続モード: 最新プロジェクトを使用
        currentProjectId = latestProject.projectId;
        currentUserRequest = latestProject.userRequest;
        continuationMode = true;
        console.log(`✅ 継続モード: プロジェクト "${currentProjectId}" を再開します`);
        console.log(`📋 元のリクエスト: ${latestProject.userRequest}`);
        // 未完了タスクの優先度を上げる
        const incompleteTasks = globalTasks.filter((task) => task.projectId === currentProjectId &&
            task.status !== 'completed' &&
            task.status !== 'failed');
        console.log(`🔄 未完了タスク: ${incompleteTasks.length}件`);
        // 優先度を再計算
        const updatedTasks = PriorityCalculator.recalculateAllPriorities(globalTasks, projects);
        return {
            continuationMode,
            currentUserRequest,
            currentProjectId,
            globalTasks: updatedTasks,
            projects,
            logs: [
                {
                    timestamp: new Date(),
                    level: 'info',
                    source: 'check_mode',
                    message: `継続モードで再開: プロジェクト ${currentProjectId}`,
                    data: {
                        projectId: currentProjectId,
                        incompleteTasks: incompleteTasks.length,
                        totalTasks: globalTasks.length,
                    },
                },
            ],
        };
    }
    else {
        // 新規モード: 新しいプロジェクトを作成
        currentProjectId = randomUUID();
        currentUserRequest = userRequest;
        continuationMode = false;
        console.log(`🆕 新規モード: 新しいプロジェクト "${currentProjectId}" を開始します`);
        // 新しいプロジェクトメタデータを作成
        const newProjectMetadata = {
            projectId: currentProjectId,
            userRequest: currentUserRequest,
            requestTimestamp: new Date(),
            totalTasks: 0,
            completedTasks: 0,
            needsStoryMapping: false,
        };
        // プロジェクトメタデータを保存
        await persistence.saveProjectMetadata(currentProjectId, newProjectMetadata);
        // プロジェクトMapに追加
        const updatedProjects = new Map(projects);
        updatedProjects.set(currentProjectId, newProjectMetadata);
        return {
            continuationMode,
            currentUserRequest,
            currentProjectId,
            globalTasks,
            projects: updatedProjects,
            logs: [
                {
                    timestamp: new Date(),
                    level: 'info',
                    source: 'check_mode',
                    message: `新規モードで開始: プロジェクト ${currentProjectId}`,
                    data: {
                        projectId: currentProjectId,
                        userRequest: currentUserRequest,
                    },
                },
            ],
        };
    }
}
/**
 * CheckModeNodeのルーティング関数
 *
 * 継続モード: sprint_planning (既存タスクをスプリントに分割)
 * 新規モード: product_owner (新しいタスク分解)
 */
export function checkModeRouter(state) {
    if (state.continuationMode) {
        console.log('➡️ ルーティング: sprint_planning (継続モード)');
        return 'sprint_planning';
    }
    else {
        console.log('➡️ ルーティング: product_owner (新規モード)');
        return 'product_owner';
    }
}
//# sourceMappingURL=CheckModeNode.js.map