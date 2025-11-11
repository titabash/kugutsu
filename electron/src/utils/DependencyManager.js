/**
 * 依存関係管理クラス
 * タスク間の依存関係を管理し、実行可能なタスクを判定する
 */
export class DependencyManager {
    taskGraph = new Map();
    completedTasks = new Set();
    failedTasks = new Set();
    runningTasks = new Set();
    developedTasks = new Set();
    reviewingTasks = new Set();
    mergingTasks = new Set();
    mergedTasks = new Set();
    /**
     * 依存関係グラフを構築
     */
    buildDependencyGraph(tasks) {
        // グラフをクリア
        this.taskGraph.clear();
        this.completedTasks.clear();
        this.failedTasks.clear();
        this.runningTasks.clear();
        this.developedTasks.clear();
        this.reviewingTasks.clear();
        this.mergingTasks.clear();
        this.mergedTasks.clear();
        // 全タスクをグラフに追加
        for (const task of tasks) {
            this.taskGraph.set(task.id, {
                task,
                dependencies: new Set(task.dependencies || []),
                dependents: new Set(),
                status: 'waiting'
            });
        }
        // 依存関係の逆引き（dependents）を構築
        for (const [taskId, node] of this.taskGraph) {
            // 存在しない依存関係を除去
            const validDependencies = new Set();
            for (const depId of node.dependencies) {
                const depNode = this.taskGraph.get(depId);
                if (depNode) {
                    depNode.dependents.add(taskId);
                    validDependencies.add(depId);
                }
                else {
                    console.warn(`Warning: Task ${taskId} depends on non-existent task ${depId}`);
                }
            }
            // 存在しない依存関係を除去
            node.dependencies = validDependencies;
        }
        // 初期状態を設定
        this.updateTaskStatuses();
    }
    /**
     * 実行可能なタスクを取得
     */
    getReadyTasks() {
        const readyTasks = [];
        for (const [taskId, node] of this.taskGraph) {
            if (node.status === 'ready') {
                readyTasks.push(node.task);
            }
        }
        return readyTasks;
    }
    /**
     * タスクを実行中としてマーク
     */
    markRunning(taskId) {
        const node = this.taskGraph.get(taskId);
        if (node && node.status === 'ready') {
            node.status = 'running';
            this.runningTasks.add(taskId);
        }
    }
    /**
     * タスクを開発完了としてマーク
     */
    markDeveloped(taskId) {
        const node = this.taskGraph.get(taskId);
        if (node && node.status === 'running') {
            node.status = 'developed';
            this.runningTasks.delete(taskId);
            this.developedTasks.add(taskId);
        }
    }
    /**
     * タスクをレビュー中としてマーク
     */
    markReviewing(taskId) {
        const node = this.taskGraph.get(taskId);
        if (node && (node.status === 'developed' || node.status === 'running')) {
            node.status = 'reviewing';
            this.developedTasks.delete(taskId);
            this.runningTasks.delete(taskId);
            this.reviewingTasks.add(taskId);
        }
    }
    /**
     * タスクをマージ中としてマーク
     */
    markMerging(taskId) {
        const node = this.taskGraph.get(taskId);
        if (node && node.status === 'reviewing') {
            node.status = 'merging';
            this.reviewingTasks.delete(taskId);
            this.mergingTasks.add(taskId);
        }
    }
    /**
     * タスクをマージ完了としてマーク（旧markCompletedに相当）
     * @returns 新たに実行可能になったタスク
     */
    markMerged(taskId) {
        const node = this.taskGraph.get(taskId);
        if (!node) {
            console.warn(`Task ${taskId} not found in dependency graph`);
            return [];
        }
        // タスクをマージ完了状態に
        node.status = 'merged';
        this.mergingTasks.delete(taskId);
        this.mergedTasks.add(taskId);
        this.completedTasks.add(taskId); // 互換性のため
        // 依存タスクの状態を更新
        const newReadyTasks = [];
        for (const dependentId of node.dependents) {
            const dependentNode = this.taskGraph.get(dependentId);
            if (dependentNode && this.canExecute(dependentId)) {
                if (dependentNode.status === 'waiting') {
                    dependentNode.status = 'ready';
                    newReadyTasks.push(dependentNode.task);
                }
            }
        }
        return newReadyTasks;
    }
    /**
     * タスク完了を通知（互換性のため残す）
     * @returns 新たに実行可能になったタスク
     */
    markCompleted(taskId) {
        // 互換性のため、markMergedを呼び出す
        return this.markMerged(taskId);
    }
    /**
     * タスク失敗を通知
     * @returns 影響を受けるタスク
     */
    markFailed(taskId) {
        const node = this.taskGraph.get(taskId);
        if (!node) {
            console.warn(`Task ${taskId} not found in dependency graph`);
            return [];
        }
        // タスクを失敗状態に
        node.status = 'failed';
        this.failedTasks.add(taskId);
        this.runningTasks.delete(taskId);
        // 依存タスクを収集（再帰的に）
        const affectedTasks = [];
        const visited = new Set();
        const collectDependents = (id) => {
            if (visited.has(id))
                return;
            visited.add(id);
            const taskNode = this.taskGraph.get(id);
            if (!taskNode)
                return;
            for (const dependentId of taskNode.dependents) {
                const dependentNode = this.taskGraph.get(dependentId);
                if (dependentNode && dependentNode.status !== 'merged' && dependentNode.status !== 'failed') {
                    affectedTasks.push(dependentNode.task);
                    collectDependents(dependentId);
                }
            }
        };
        collectDependents(taskId);
        return affectedTasks;
    }
    /**
     * 循環依存をチェック
     * @returns 循環依存のパス
     */
    detectCycles() {
        const cycles = [];
        const visited = new Set();
        const recursionStack = new Set();
        const path = [];
        const dfs = (taskId) => {
            // 存在しないタスクはスキップ
            const node = this.taskGraph.get(taskId);
            if (!node)
                return false;
            visited.add(taskId);
            recursionStack.add(taskId);
            path.push(taskId);
            for (const depId of node.dependencies) {
                // 存在しない依存関係はスキップ
                if (!this.taskGraph.has(depId)) {
                    continue;
                }
                if (!visited.has(depId)) {
                    if (dfs(depId)) {
                        return true;
                    }
                }
                else if (recursionStack.has(depId)) {
                    // 循環を検出
                    const cycleStart = path.indexOf(depId);
                    cycles.push(path.slice(cycleStart));
                    return true;
                }
            }
            recursionStack.delete(taskId);
            path.pop();
            return false;
        };
        for (const taskId of this.taskGraph.keys()) {
            if (!visited.has(taskId)) {
                dfs(taskId);
            }
        }
        return cycles;
    }
    /**
     * タスクが実行可能かチェック
     */
    canExecute(taskId) {
        const node = this.taskGraph.get(taskId);
        if (!node)
            return false;
        // 全ての依存タスクがマージ完了しているかチェック
        for (const depId of node.dependencies) {
            if (!this.mergedTasks.has(depId)) {
                return false;
            }
        }
        return true;
    }
    /**
     * 全タスクの状態を更新
     */
    updateTaskStatuses() {
        for (const [taskId, node] of this.taskGraph) {
            if (node.status === 'waiting' && this.canExecute(taskId)) {
                node.status = 'ready';
            }
        }
    }
    /**
     * タスクの依存関係ステータスを取得
     */
    getTaskDependencyStatus(taskId) {
        const node = this.taskGraph.get(taskId);
        if (!node)
            return null;
        const blockedBy = [];
        const waitingFor = [];
        const failedDependencies = [];
        for (const depId of node.dependencies) {
            if (this.failedTasks.has(depId)) {
                failedDependencies.push(depId);
            }
            else if (!this.mergedTasks.has(depId)) {
                // マージが完了していない依存タスク
                if (this.runningTasks.has(depId) ||
                    this.developedTasks.has(depId) ||
                    this.reviewingTasks.has(depId) ||
                    this.mergingTasks.has(depId)) {
                    waitingFor.push(depId);
                }
                else {
                    blockedBy.push(depId);
                }
            }
        }
        return { blockedBy, waitingFor, failedDependencies };
    }
    /**
     * 現在の状態のサマリーを取得
     */
    getStatusSummary() {
        let waiting = 0, ready = 0, running = 0, completed = 0, failed = 0;
        let developed = 0, reviewing = 0, merging = 0, merged = 0;
        for (const node of this.taskGraph.values()) {
            switch (node.status) {
                case 'waiting':
                    waiting++;
                    break;
                case 'ready':
                    ready++;
                    break;
                case 'running':
                    running++;
                    break;
                case 'developed':
                    developed++;
                    break;
                case 'reviewing':
                    reviewing++;
                    break;
                case 'merging':
                    merging++;
                    break;
                case 'merged':
                    merged++;
                    completed++;
                    break; // mergedもcompletedにカウント（互換性のため）
                case 'failed':
                    failed++;
                    break;
            }
        }
        return {
            total: this.taskGraph.size,
            waiting,
            ready,
            running,
            completed,
            failed,
            developed,
            reviewing,
            merging,
            merged
        };
    }
}
//# sourceMappingURL=DependencyManager.js.map