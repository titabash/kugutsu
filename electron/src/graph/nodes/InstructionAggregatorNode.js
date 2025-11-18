/**
 * InstructionAggregatorNode
 *
 * instruction.md生成の集約ポイント兼ルーティングハブ
 *
 * 責務:
 * 1. 未生成タスクの確認 → dispatch へループバック
 * 2. 生成済みタスクを開発に送信 → engineer_dispatch
 * 3. スプリント状態の更新（planning → active）
 */
import { DataPersistence } from '../../utils/DataPersistence.js';
import { Send } from '@langchain/langgraph';
/**
 * Aggregator Node: ルーティングハブ
 *
 * instruction_generatorからのfan-in後、次のアクションを決定
 */
export async function instructionAggregatorNode(state) {
    console.log('📦 InstructionAggregator: タスク状態を確認中...');
    // activeSprint.idの必須チェック
    if (!state.activeSprint?.id) {
        console.error('❌ アクティブなスプリントが設定されていません');
        return {
            logs: [{
                    timestamp: new Date(),
                    level: 'error',
                    source: 'InstructionAggregator',
                    message: 'アクティブなスプリントが設定されていません',
                }],
        };
    }
    // スプリント内のタスクをフィルタリング
    const sprintTasks = (state.globalTasks || []).filter(task => state.activeSprint?.taskIds.includes(task.id));
    // 未生成タスクをカウント（実行中を除く）
    const tasksNeedingInstruction = sprintTasks.filter(task => task.instructionGenerated !== true &&
        task.instructionGenerating !== true);
    // 実行中タスクをカウント
    const tasksInProgress = sprintTasks.filter(task => task.instructionGenerating === true);
    // 生成済みタスクをカウント
    const tasksGenerated = sprintTasks.filter(task => task.instructionGenerated === true);
    console.log(`📊 タスク状態: 未生成=${tasksNeedingInstruction.length}, 実行中=${tasksInProgress.length}, 完了=${tasksGenerated.length}, 合計=${sprintTasks.length}`);
    // スプリント状態を'active'に更新（最初の1回のみ）
    let updatedSprint = state.activeSprint;
    if (state.activeSprint.status === 'planning' && tasksGenerated.length > 0) {
        updatedSprint = {
            ...state.activeSprint,
            status: 'active',
            startedAt: state.activeSprint.startedAt || new Date(),
        };
        const persistence = new DataPersistence(state.config.baseRepoPath);
        await persistence.saveActiveSprint(updatedSprint);
        console.log('💾 スプリント状態を更新: planning → active');
    }
    return {
        activeSprint: updatedSprint,
        logs: [{
                timestamp: new Date(),
                level: 'info',
                source: 'InstructionAggregator',
                message: `タスク状態: 未生成=${tasksNeedingInstruction.length}, 実行中=${tasksInProgress.length}, 完了=${tasksGenerated.length}`,
                data: {
                    sprintId: state.activeSprint.id,
                    needingInstruction: tasksNeedingInstruction.length,
                    inProgress: tasksInProgress.length,
                    generated: tasksGenerated.length,
                    total: sprintTasks.length,
                },
            }],
    };
}
/**
 * Aggregator Router: 真の並列実行ルーティング
 *
 * 複数アクションを同時実行（Send API）:
 * 1. 生成済みタスク → engineer_dispatch（即座に開発開始）
 * 2. 未生成タスク → dispatch（次のバッチ生成）
 * 3. 両方なし → sprint_review（全完了）
 *
 * 注意: 実行中タスクの待機は不要（fan-inで自動的に待つ）
 */
export function instructionAggregatorRouter(state) {
    if (!state.activeSprint?.id) {
        console.log('➡️ ルーティング: END (スプリントなし)');
        return 'END';
    }
    const sprintTasks = (state.globalTasks || []).filter(task => state.activeSprint?.taskIds.includes(task.id));
    // 未生成タスク（実行中を除く）
    const tasksNeedingInstruction = sprintTasks.filter(task => task.instructionGenerated !== true &&
        task.instructionGenerating !== true);
    // 実行中タスク
    const tasksInProgress = sprintTasks.filter(task => task.instructionGenerating === true);
    // 生成済みで開発準備完了のタスク
    const tasksReadyForDevelopment = sprintTasks.filter(task => task.instructionGenerated === true &&
        task.status === 'pending' &&
        !task.worktreePath);
    console.log(`📊 ルーティング判定: 未生成=${tasksNeedingInstruction.length}, ` +
        `実行中=${tasksInProgress.length}, 開発準備完了=${tasksReadyForDevelopment.length}`);
    // Send APIで複数アクションを同時実行
    const sends = [];
    // アクション1: 生成済みタスク → engineer_dispatch（最優先）
    if (tasksReadyForDevelopment.length > 0) {
        console.log(`🚀 engineer_dispatch に送信 (開発準備完了: ${tasksReadyForDevelopment.length}件)`);
        // GlobalTaskからTask型に変換（EngineerDispatchNodeが期待する形式）
        const developmentTasks = tasksReadyForDevelopment.map(gt => ({
            id: gt.id,
            type: gt.type,
            title: gt.title,
            description: gt.description,
            priority: gt.priority >= 70 ? 'high' :
                gt.priority >= 40 ? 'medium' :
                    'low',
            status: gt.status,
            dependencies: gt.dependencies,
            branchName: gt.branchName,
            worktreePath: gt.worktreePath,
            createdAt: gt.createdAt || new Date(),
            updatedAt: gt.updatedAt || new Date(),
        }));
        sends.push(new Send('engineer_dispatch', {
            config: state.config,
            tasks: developmentTasks, // ← GlobalTaskから変換したTask配列
            tasksPath: state.tasksPath,
            globalTasks: state.globalTasks,
            activeSprint: state.activeSprint,
            worktrees: state.worktrees,
            reviews: state.reviews,
            mergeQueue: state.mergeQueue,
        }));
    }
    // アクション2: 未生成タスク → dispatch（次のバッチ）
    if (tasksNeedingInstruction.length > 0) {
        console.log(`🔄 instruction_generator_dispatch に送信 (未生成: ${tasksNeedingInstruction.length}件)`);
        sends.push(new Send('instruction_generator_dispatch', {
            config: state.config,
            globalTasks: state.globalTasks,
            activeSprint: state.activeSprint,
        }));
    }
    // アクション3: 両方なし → sprint_review（全完了）
    if (sends.length === 0) {
        console.log('✅ sprint_review へ遷移 (全タスク処理完了)');
        return 'sprint_review';
    }
    // 複数アクションを同時実行
    console.log(`➡️ ${sends.length}個のアクションを並列実行`);
    return sends;
}
//# sourceMappingURL=InstructionAggregatorNode.js.map