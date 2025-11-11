/**
 * Prerequisite Checker
 *
 * 各ノードの前提条件をチェックし、不備があれば責任ノードを特定する
 */
import { FileReader } from './FileReader.js';
/**
 * 前提条件チェッカー
 */
export class PrerequisiteChecker {
    fileReader;
    config;
    constructor(config) {
        this.config = config;
        this.fileReader = new FileReader(config.baseRepoPath);
    }
    /**
     * ProductOwnerNode の前提条件チェック
     *
     * ProductOwnerは最初のノードなので、前提条件なし
     */
    async checkProductOwner(state) {
        return { success: true };
    }
    /**
     * EngineerNode の前提条件チェック
     *
     * 前提条件:
     * - tasks.json が存在し、読み込み可能
     * - 対象タスクが tasks.json に存在
     * - タスクに worktreePath が設定されている
     * - instruction.md が存在し、読み込み可能
     *
     * @param state - 現在のState
     * @param taskId - チェック対象のタスクID
     */
    async checkEngineer(state, taskId) {
        const tasksPath = state.tasksPath || '.kugutsu/tasks.json';
        if (!state.activeSprint?.id) {
            return {
                success: false,
                responsibleNode: 'sprint_planning',
                error: 'アクティブなスプリントが設定されていません',
                missingFields: ['activeSprint.id'],
            };
        }
        const sprintId = state.activeSprint.id;
        // Step 1: tasks.json の存在・読み込みチェック
        let tasks;
        try {
            tasks = await this.fileReader.readJSON(tasksPath);
        }
        catch (error) {
            return {
                success: false,
                responsibleNode: 'product_owner',
                error: `tasks.json の読み込みに失敗: ${error instanceof Error ? error.message : String(error)}`,
                missingFiles: [tasksPath],
            };
        }
        // Step 2: 対象タスクの存在チェック
        const task = tasks.find((t) => t.id === taskId);
        if (!task) {
            return {
                success: false,
                responsibleNode: 'product_owner',
                error: `タスク ${taskId} が tasks.json に存在しません`,
                missingFields: ['taskId'],
            };
        }
        // Step 3: worktreePath 設定チェック
        if (!task.worktreePath) {
            return {
                success: false,
                responsibleNode: 'engineer_dispatch',
                error: `タスク ${taskId} の worktreePath が設定されていません`,
                missingFields: ['worktreePath'],
            };
        }
        // Step 4: instruction.md の存在・読み込みチェック
        const instructionPath = `.kugutsu/sprints/${sprintId}/tasks/${taskId}/instruction.md`;
        try {
            await this.fileReader.readMarkdown(instructionPath);
        }
        catch (error) {
            return {
                success: false,
                responsibleNode: 'instruction_generator',
                error: `instruction.md が見つかりません: ${instructionPath}`,
                missingFiles: [instructionPath],
            };
        }
        // 全チェック通過
        return { success: true };
    }
    /**
     * EngineerDispatchNode の前提条件チェック
     *
     * 前提条件:
     * - tasksPath が設定されている
     * - tasks.json が存在し、読み込み可能
     * - タスクが存在する
     *
     * @param state - 現在のState
     */
    async checkEngineerDispatch(state) {
        // Step 1: tasksPath 設定チェック
        if (!state.tasksPath) {
            return {
                success: false,
                responsibleNode: 'product_owner',
                error: 'tasksPath が設定されていません',
                missingFields: ['tasksPath'],
            };
        }
        // Step 2: tasks.json の存在・読み込みチェック
        try {
            const tasks = await this.fileReader.readJSON(state.tasksPath);
            if (tasks.length === 0) {
                return {
                    success: false,
                    responsibleNode: 'product_owner',
                    error: 'tasks.json にタスクが含まれていません',
                };
            }
        }
        catch (error) {
            return {
                success: false,
                responsibleNode: 'product_owner',
                error: `tasks.json の読み込みに失敗: ${error instanceof Error ? error.message : String(error)}`,
                missingFiles: [state.tasksPath],
            };
        }
        return { success: true };
    }
    /**
     * ReviewNode の前提条件チェック
     *
     * 前提条件:
     * - タスクが in_review または completed 状態
     * - タスクに worktreePath が設定されている
     *
     * @param state - 現在のState
     * @param taskId - チェック対象のタスクID
     */
    async checkReview(state, taskId) {
        const tasksPath = state.tasksPath || '.kugutsu/tasks.json';
        // tasks.json 読み込み
        try {
            const tasks = await this.fileReader.readJSON(tasksPath);
            const task = tasks.find((t) => t.id === taskId);
            if (!task) {
                return {
                    success: false,
                    responsibleNode: 'product_owner',
                    error: `タスク ${taskId} が見つかりません`,
                };
            }
            // ステータスチェック
            const validStatuses = ['in_review', 'completed', 'reviewed', 'implemented'];
            if (!validStatuses.includes(task.status)) {
                return {
                    success: false,
                    responsibleNode: 'engineer',
                    error: `タスク ${taskId} がレビュー可能な状態ではありません (current: ${task.status})`,
                };
            }
            // worktreePath チェック
            if (!task.worktreePath) {
                return {
                    success: false,
                    responsibleNode: 'engineer_dispatch',
                    error: `タスク ${taskId} の worktreePath が設定されていません`,
                    missingFields: ['worktreePath'],
                };
            }
        }
        catch (error) {
            return {
                success: false,
                responsibleNode: 'product_owner',
                error: `tasks.json の読み込みに失敗: ${error instanceof Error ? error.message : String(error)}`,
                missingFiles: [tasksPath],
            };
        }
        return { success: true };
    }
    /**
     * MergeCoordinatorNode の前提条件チェック
     *
     * 前提条件:
     * - タスクが reviewed 状態
     * - review.json が存在し、status === 'approved'
     *
     * @param state - 現在のState
     * @param taskId - チェック対象のタスクID
     */
    async checkMergeCoordinator(state, taskId) {
        const tasksPath = state.tasksPath || '.kugutsu/tasks.json';
        if (!state.activeSprint?.id) {
            return {
                success: false,
                responsibleNode: 'sprint_planning',
                error: 'アクティブなスプリントが設定されていません',
                missingFields: ['activeSprint.id'],
            };
        }
        const sprintId = state.activeSprint.id;
        // tasks.json 読み込み
        try {
            const tasks = await this.fileReader.readJSON(tasksPath);
            const task = tasks.find((t) => t.id === taskId);
            if (!task || task.status !== 'reviewed') {
                return {
                    success: false,
                    responsibleNode: 'review',
                    error: `タスク ${taskId} がマージ可能な状態ではありません (current: ${task?.status || 'not found'})`,
                };
            }
        }
        catch (error) {
            return {
                success: false,
                responsibleNode: 'product_owner',
                error: `tasks.json の読み込みに失敗: ${error instanceof Error ? error.message : String(error)}`,
                missingFiles: [tasksPath],
            };
        }
        // review.json 読み込み
        const reviewPath = `.kugutsu/sprints/${sprintId}/tasks/${taskId}/review.json`;
        try {
            const review = await this.fileReader.readJSON(reviewPath);
            if (review.status !== 'approved') {
                return {
                    success: false,
                    responsibleNode: 'review',
                    error: `タスク ${taskId} のレビューが承認されていません (status: ${review.status})`,
                };
            }
        }
        catch (error) {
            return {
                success: false,
                responsibleNode: 'review',
                error: `review.json が見つかりません: ${reviewPath}`,
                missingFiles: [reviewPath],
            };
        }
        return { success: true };
    }
    /**
     * ConflictResolverNode の前提条件チェック
     *
     * 前提条件:
     * - conflicts.json が存在
     * - コンフリクト情報が正しい形式
     *
     * @param state - 現在のState
     * @param taskId - チェック対象のタスクID
     */
    async checkConflictResolver(state, taskId) {
        if (!state.activeSprint?.id) {
            return {
                success: false,
                responsibleNode: 'sprint_planning',
                error: 'アクティブなスプリントが設定されていません',
                missingFields: ['activeSprint.id'],
            };
        }
        const sprintId = state.activeSprint.id;
        const conflictsPath = `.kugutsu/sprints/${sprintId}/tasks/${taskId}/conflicts.json`;
        try {
            const conflicts = await this.fileReader.readJSON(conflictsPath);
            if (!conflicts.conflictFiles || conflicts.conflictFiles.length === 0) {
                return {
                    success: false,
                    responsibleNode: 'merge_coordinator',
                    error: `コンフリクト情報が不正です: ${conflictsPath}`,
                };
            }
        }
        catch (error) {
            return {
                success: false,
                responsibleNode: 'merge_coordinator',
                error: `conflicts.json が見つかりません: ${conflictsPath}`,
                missingFiles: [conflictsPath],
            };
        }
        return { success: true };
    }
}
//# sourceMappingURL=PrerequisiteChecker.js.map