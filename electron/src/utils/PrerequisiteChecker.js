/**
 * Prerequisite Checker
 *
 * 各ノードの前提条件をチェックし、不備があれば責任ノードを特定する
 */
import { FileReader } from './FileReader.js';
import { DataPersistence } from './DataPersistence.js';
/**
 * 前提条件チェッカー
 */
export class PrerequisiteChecker {
    fileReader;
    persistence;
    config;
    constructor(config) {
        this.config = config;
        this.fileReader = new FileReader(config.baseRepoPath);
        this.persistence = new DataPersistence(config.baseRepoPath);
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
     * - Sprint Backlog が存在し、読み込み可能
     * - 対象タスクが Sprint Backlog に存在
     * - タスクに worktreePath が設定されている
     * - instruction.md が存在し、読み込み可能
     *
     * @param state - 現在のState
     * @param taskId - チェック対象のタスクID
     */
    async checkEngineer(state, taskId) {
        if (!state.activeSprint?.id) {
            return {
                success: false,
                responsibleNode: 'sprint_planning',
                error: 'アクティブなスプリントが設定されていません',
                missingFields: ['activeSprint.id'],
            };
        }
        const sprintId = state.activeSprint.id;
        // Step 1: Sprint Backlog の存在・読み込みチェック
        let backlog;
        try {
            backlog = await this.persistence.loadSprintBacklog(sprintId);
            if (!backlog || !backlog.tasks) {
                return {
                    success: false,
                    responsibleNode: 'sprint_planning',
                    error: `Sprint Backlog not found: ${sprintId}`,
                    missingFiles: [`.kugutsu/sprints/${sprintId}/sprint-backlog.json`],
                };
            }
        }
        catch (error) {
            return {
                success: false,
                responsibleNode: 'sprint_planning',
                error: `Sprint Backlog の読み込みに失敗: ${error instanceof Error ? error.message : String(error)}`,
                missingFiles: [`.kugutsu/sprints/${sprintId}/sprint-backlog.json`],
            };
        }
        // Step 2: 対象タスクの存在チェック
        const task = backlog.tasks.find((t) => t.id === taskId);
        if (!task) {
            return {
                success: false,
                responsibleNode: 'sprint_planning',
                error: `タスク ${taskId} が Sprint Backlog に存在しません`,
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
     * - アクティブなスプリントが設定されている
     * - Sprint Backlog が存在し、読み込み可能
     * - Sprint Backlog にタスクが含まれている
     *
     * @param state - 現在のState
     */
    async checkEngineerDispatch(state) {
        // Step 1: アクティブなスプリントのチェック
        if (!state.activeSprint?.id) {
            return {
                success: false,
                responsibleNode: 'sprint_planning',
                error: 'アクティブなスプリントが設定されていません',
                missingFields: ['activeSprint.id'],
            };
        }
        const sprintId = state.activeSprint.id;
        // Step 2: Sprint Backlog の存在・読み込みチェック
        try {
            const backlog = await this.persistence.loadSprintBacklog(sprintId);
            if (!backlog || !backlog.tasks) {
                return {
                    success: false,
                    responsibleNode: 'sprint_planning',
                    error: `Sprint Backlog not found: ${sprintId}`,
                    missingFiles: [`.kugutsu/sprints/${sprintId}/sprint-backlog.json`],
                };
            }
            if (backlog.tasks.length === 0) {
                return {
                    success: false,
                    responsibleNode: 'sprint_planning',
                    error: 'Sprint Backlog にタスクが含まれていません',
                };
            }
        }
        catch (error) {
            return {
                success: false,
                responsibleNode: 'sprint_planning',
                error: `Sprint Backlog の読み込みに失敗: ${error instanceof Error ? error.message : String(error)}`,
                missingFiles: [`.kugutsu/sprints/${sprintId}/sprint-backlog.json`],
            };
        }
        return { success: true };
    }
    /**
     * ReviewNode の前提条件チェック
     *
     * 前提条件:
     * - Sprint Backlog が存在し、読み込み可能
     * - タスクが Sprint Backlog に存在
     * - タスクが in_review または completed 状態
     * - タスクに worktreePath が設定されている
     *
     * @param state - 現在のState
     * @param taskId - チェック対象のタスクID
     */
    async checkReview(state, taskId) {
        if (!state.activeSprint?.id) {
            return {
                success: false,
                responsibleNode: 'sprint_planning',
                error: 'アクティブなスプリントが設定されていません',
                missingFields: ['activeSprint.id'],
            };
        }
        const sprintId = state.activeSprint.id;
        // Sprint Backlog 読み込み
        try {
            const backlog = await this.persistence.loadSprintBacklog(sprintId);
            if (!backlog || !backlog.tasks) {
                return {
                    success: false,
                    responsibleNode: 'sprint_planning',
                    error: `Sprint Backlog not found: ${sprintId}`,
                    missingFiles: [`.kugutsu/sprints/${sprintId}/sprint-backlog.json`],
                };
            }
            const task = backlog.tasks.find((t) => t.id === taskId);
            if (!task) {
                return {
                    success: false,
                    responsibleNode: 'sprint_planning',
                    error: `タスク ${taskId} が Sprint Backlog に存在しません`,
                    missingFields: ['taskId'],
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
                responsibleNode: 'sprint_planning',
                error: `Sprint Backlog の読み込みに失敗: ${error instanceof Error ? error.message : String(error)}`,
                missingFiles: [`.kugutsu/sprints/${sprintId}/sprint-backlog.json`],
            };
        }
        return { success: true };
    }
    /**
     * MergeCoordinatorNode の前提条件チェック
     *
     * 前提条件:
     * - Sprint Backlog が存在し、読み込み可能
     * - タスクが Sprint Backlog に存在
     * - タスクが completed 状態（レビュー承認済み）
     * - review.json が存在し、status === 'approved'
     *
     * @param state - 現在のState
     * @param taskId - チェック対象のタスクID
     */
    async checkMergeCoordinator(state, taskId) {
        if (!state.activeSprint?.id) {
            return {
                success: false,
                responsibleNode: 'sprint_planning',
                error: 'アクティブなスプリントが設定されていません',
                missingFields: ['activeSprint.id'],
            };
        }
        const sprintId = state.activeSprint.id;
        // Sprint Backlog 読み込み
        try {
            const backlog = await this.persistence.loadSprintBacklog(sprintId);
            if (!backlog || !backlog.tasks) {
                return {
                    success: false,
                    responsibleNode: 'sprint_planning',
                    error: `Sprint Backlog not found: ${sprintId}`,
                    missingFiles: [`.kugutsu/sprints/${sprintId}/sprint-backlog.json`],
                };
            }
            const task = backlog.tasks.find((t) => t.id === taskId);
            if (!task || task.status !== 'completed') {
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
                responsibleNode: 'sprint_planning',
                error: `Sprint Backlog の読み込みに失敗: ${error instanceof Error ? error.message : String(error)}`,
                missingFiles: [`.kugutsu/sprints/${sprintId}/sprint-backlog.json`],
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