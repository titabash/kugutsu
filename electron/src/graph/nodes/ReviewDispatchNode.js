/**
 * Review Dispatch Node
 *
 * Manages review task distribution to respect maxEngineers limit
 */
/**
 * Review Dispatch Node
 *
 * Responsibilities:
 * 1. Get tasks in 'in_review' status that haven't been reviewed yet
 * 2. Sort by priority (highest first)
 * 3. Limit concurrent reviews to maxEngineers
 * 4. Log dispatch information
 */
export async function reviewDispatchNode(state) {
    const { tasks, reviews, config } = state;
    console.log('🔍 Review Dispatch: レビュータスクを割り当てています...');
    try {
        const logs = [];
        // Get tasks that are in_review and haven't been reviewed yet
        const reviewableTasks = tasks.filter((task) => task.status === 'in_review' &&
            !reviews.some((review) => review.taskId === task.id));
        if (reviewableTasks.length === 0) {
            console.log('⏸️ レビュー可能なタスクがありません');
            return {
                logs: [
                    {
                        timestamp: new Date(),
                        level: 'info',
                        source: 'ReviewDispatchNode',
                        message: 'レビュー可能なタスクがありません（全タスクレビュー済み、または未完了）',
                    },
                ],
            };
        }
        // Sort by priority (highest first)
        reviewableTasks.sort((a, b) => b.priority - a.priority);
        // Limit to maxEngineers concurrent reviews
        const tasksToReview = reviewableTasks.slice(0, config.maxEngineers);
        console.log(`🔍 ${tasksToReview.length}/${reviewableTasks.length}個のタスクをレビュー開始`);
        // Log each task being dispatched for review
        for (const task of tasksToReview) {
            logs.push({
                timestamp: new Date(),
                level: 'info',
                source: 'ReviewDispatchNode',
                message: `タスク ${task.id} をレビューキューに追加しました`,
                data: {
                    taskId: task.id,
                    priority: task.priority,
                },
                taskId: task.id,
            });
            console.log(`✅ タスク ${task.id} → レビュー待機中 (優先度: ${task.priority})`);
        }
        // Add summary log
        logs.push({
            timestamp: new Date(),
            level: 'info',
            source: 'ReviewDispatchNode',
            message: `${tasksToReview.length}個のタスクをレビュー開始します (制限: ${config.maxEngineers})`,
            data: {
                tasksDispatched: tasksToReview.length,
                maxEngineers: config.maxEngineers,
                taskIds: tasksToReview.map((t) => t.id),
            },
        });
        // Return state update
        return {
            logs,
        };
    }
    catch (error) {
        console.error('❌ Review Dispatch Node エラー:', error);
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'error',
                    source: 'ReviewDispatchNode',
                    message: `レビュータスクディスパッチに失敗: ${error instanceof Error ? error.message : String(error)}`,
                    data: { error },
                },
            ],
            metadata: {
                hasErrors: true,
                errors: [error instanceof Error ? error.message : String(error)],
            },
        };
    }
}
//# sourceMappingURL=ReviewDispatchNode.js.map