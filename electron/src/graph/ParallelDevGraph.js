/**
 * Parallel Development Graph
 *
 * Main workflow graph using LangGraphJS
 */
import { StateGraph } from '@langchain/langgraph';
import { ParallelDevState } from './state.js';
import { productOwnerNode } from './nodes/ProductOwnerNode.js';
import { engineerDispatchNode } from './nodes/EngineerDispatchNode.js';
import { engineerNode } from './nodes/EngineerNode.js';
import { reviewNode } from './nodes/ReviewNode.js';
import { mergeCoordinatorNode } from './nodes/MergeCoordinatorNode.js';
import { conflictResolverNode } from './nodes/ConflictResolverNode.js';
import { checkModeNode, checkModeRouter } from './nodes/CheckModeNode.js';
import { sprintPlanningNode, sprintPlanningRouter } from './nodes/SprintPlanningNode.js';
import { sprintReviewNode, sprintReviewRouter } from './nodes/SprintReviewNode.js';
import { directorNode } from './nodes/DirectorNode.js';
import { reviewStoryMappingNode } from './nodes/ReviewStoryMappingNode.js';
import { techLeadDesignNode } from './nodes/TechLeadDesignNode.js';
import { reviewDesignNode } from './nodes/ReviewDesignNode.js';
import { taskBreakdownNode } from './nodes/TaskBreakdownNode.js';
/**
 * Create the parallel development workflow graph
 *
 * Workflow:
 * 1. ProductOwner: Analyze requirements and generate tasks
 * 2. EngineerDispatch: Assign tasks to worktrees
 * 3. Engineer: Implement tasks (currently sequential, will be parallelized)
 * 4. Review: Review completed tasks (currently sequential, will be parallelized)
 * 5. MergeCoordinator: Merge approved tasks
 * 6. ConflictResolver: Resolve merge conflicts if any
 * 7. CheckCompletion: Check if all tasks are done
 */
export function createParallelDevGraph() {
    const workflow = new StateGraph(ParallelDevState)
        // Add all nodes first using method chaining
        .addNode('product_owner', productOwnerNode)
        .addNode('engineer_dispatch', engineerDispatchNode)
        // Engineer wrapper node: executes all in-progress tasks
        .addNode('engineer', async (state) => {
        const inProgressTasks = state.tasks.filter((t) => t.status === 'in_progress');
        if (inProgressTasks.length === 0) {
            return {
                logs: [
                    {
                        timestamp: new Date(),
                        level: 'info',
                        source: 'EngineerWrapper',
                        message: '実行可能なタスクがありません',
                    },
                ],
            };
        }
        console.log(`👷 ${inProgressTasks.length}個のタスクを並列実装中...`);
        // Execute all in-progress tasks in parallel
        const taskResults = await Promise.all(inProgressTasks.map((task) => engineerNode(state, task.id)));
        // Accumulate all results
        const results = {
            tasks: [],
            completedTasks: [],
            failedTasks: [],
            logs: [],
            metadata: {},
        };
        for (const result of taskResults) {
            if (result.tasks)
                results.tasks.push(...result.tasks);
            if (result.completedTasks)
                results.completedTasks.push(...result.completedTasks);
            if (result.failedTasks)
                results.failedTasks.push(...result.failedTasks);
            if (result.logs)
                results.logs.push(...result.logs);
            if (result.metadata)
                results.metadata = { ...results.metadata, ...result.metadata };
        }
        return results;
    })
        // Review wrapper node: reviews all completed tasks
        .addNode('review', async (state) => {
        const completedTasks = state.tasks.filter((t) => t.status === 'completed' &&
            !state.reviews.some((r) => r.taskId === t.id));
        if (completedTasks.length === 0) {
            return {
                logs: [
                    {
                        timestamp: new Date(),
                        level: 'info',
                        source: 'ReviewWrapper',
                        message: 'レビュー対象のタスクがありません',
                    },
                ],
            };
        }
        console.log(`🔍 ${completedTasks.length}個のタスクを並列レビュー中...`);
        // Review all completed tasks in parallel
        const reviewResults = await Promise.all(completedTasks.map((task) => reviewNode(state, task.id)));
        // Accumulate all results
        const results = {
            reviews: [],
            logs: [],
        };
        for (const result of reviewResults) {
            if (result.reviews)
                results.reviews.push(...result.reviews);
            if (result.logs)
                results.logs.push(...result.logs);
        }
        return results;
    })
        .addNode('merge_coordinator', mergeCoordinatorNode)
        .addNode('conflict_resolver', conflictResolverNode)
        // Add check_completion node
        .addNode('check_completion', (state) => {
        const allTasksSettled = state.tasks.every((t) => t.status === 'completed' || t.status === 'failed');
        const pendingTasks = state.tasks.filter((t) => t.status === 'pending');
        const inProgressTasks = state.tasks.filter((t) => t.status === 'in_progress');
        const completedTasks = state.tasks.filter((t) => t.status === 'completed');
        const failedTasks = state.tasks.filter((t) => t.status === 'failed');
        console.log('\n📊 ===== 進捗状況 =====');
        console.log(`   待機中: ${pendingTasks.length}`);
        console.log(`   実行中: ${inProgressTasks.length}`);
        console.log(`   完了: ${completedTasks.length}`);
        console.log(`   失敗: ${failedTasks.length}`);
        console.log('========================\n');
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'info',
                    source: 'check_completion',
                    message: allTasksSettled
                        ? '全タスク完了'
                        : `進行中: 待機${pendingTasks.length}件、実行中${inProgressTasks.length}件、完了${completedTasks.length}件、失敗${failedTasks.length}件`,
                    data: {
                        pending: pendingTasks.length,
                        inProgress: inProgressTasks.length,
                        completed: completedTasks.length,
                        failed: failedTasks.length,
                    },
                },
            ],
            metadata: {
                phase: allTasksSettled ? 'complete' : state.metadata.phase,
                completedAt: allTasksSettled ? new Date() : undefined,
            },
        };
    });
    // Define edges
    // __start__ → product_owner
    workflow.addEdge('__start__', 'product_owner');
    // product_owner → engineer_dispatch
    workflow.addEdge('product_owner', 'engineer_dispatch');
    // engineer_dispatch → conditional
    workflow.addConditionalEdges('engineer_dispatch', (state) => {
        const inProgressTasks = state.tasks.filter((t) => t.status === 'in_progress');
        return inProgressTasks.length > 0 ? 'has_tasks' : 'no_tasks';
    }, {
        has_tasks: 'engineer',
        no_tasks: 'check_completion',
    });
    // engineer → review
    workflow.addEdge('engineer', 'review');
    // review → merge_coordinator
    workflow.addEdge('review', 'merge_coordinator');
    // merge_coordinator → conditional
    workflow.addConditionalEdges('merge_coordinator', (state) => {
        const conflicts = state.mergeQueue.filter((m) => m.status === 'conflict');
        if (conflicts.length > 0) {
            return 'has_conflicts';
        }
        const pendingTasks = state.tasks.filter((t) => t.status === 'pending');
        return pendingTasks.length > 0 ? 'has_pending' : 'no_pending';
    }, {
        has_conflicts: 'conflict_resolver',
        has_pending: 'engineer_dispatch',
        no_pending: 'check_completion',
    });
    // conflict_resolver → merge_coordinator (retry)
    workflow.addEdge('conflict_resolver', 'merge_coordinator');
    // check_completion → conditional (__end__ or continue)
    workflow.addConditionalEdges('check_completion', (state) => {
        const allTasksSettled = state.tasks.every((t) => t.status === 'completed' || t.status === 'failed');
        return allTasksSettled ? 'done' : 'continue';
    }, {
        done: '__end__',
        continue: 'engineer_dispatch',
    });
    return workflow;
}
/**
 * Create and compile the parallel development workflow graph
 *
 * @returns Compiled graph ready for execution
 */
export function compileParallelDevGraph() {
    const workflow = createParallelDevGraph();
    return workflow.compile();
}
/**
 * Create the sprint-driven development workflow graph
 *
 * Sprint-Driven Workflow:
 * 1. CheckMode: Detect continuation mode or new mode
 * 2. [Continuation] SprintPlanning: Plan next sprint (8-16h)
 * 3. [New] ProductOwner: Analyze requirements and generate tasks
 * 4. EngineerDispatch: Assign tasks to worktrees
 * 5. Engineer: Implement tasks in parallel
 * 6. Review: Review completed tasks in parallel
 * 7. MergeCoordinator: Merge approved tasks
 * 8. [Conflicts] ConflictResolver: Resolve merge conflicts
 * 9. SprintReview: Check sprint completion, decide next sprint
 * 10. [More tasks] → SprintPlanning (loop)
 * 11. [All done] → END
 */
export function createSprintDrivenGraph() {
    const workflow = new StateGraph(ParallelDevState)
        // ================================================
        // Upper Layer: Scrum Development Process Nodes
        // ================================================
        .addNode('check_mode', checkModeNode)
        .addNode('product_owner', productOwnerNode)
        // ================================================
        // Lower Layer: Sprint-Driven Execution Nodes
        // ================================================
        .addNode('sprint_planning', sprintPlanningNode)
        .addNode('engineer_dispatch', engineerDispatchNode)
        // Engineer wrapper node: executes all in-progress tasks in parallel
        .addNode('engineer', async (state) => {
        const inProgressTasks = state.tasks.filter((t) => t.status === 'in_progress');
        if (inProgressTasks.length === 0) {
            return {
                logs: [
                    {
                        timestamp: new Date(),
                        level: 'info',
                        source: 'EngineerWrapper',
                        message: '実行可能なタスクがありません',
                    },
                ],
            };
        }
        console.log(`👷 ${inProgressTasks.length}個のタスクを並列実装中...`);
        // Execute all in-progress tasks in parallel
        const taskResults = await Promise.all(inProgressTasks.map((task) => engineerNode(state, task.id)));
        // Accumulate all results
        const results = {
            tasks: [],
            completedTasks: [],
            failedTasks: [],
            logs: [],
            metadata: {},
        };
        for (const result of taskResults) {
            if (result.tasks)
                results.tasks.push(...result.tasks);
            if (result.completedTasks)
                results.completedTasks.push(...result.completedTasks);
            if (result.failedTasks)
                results.failedTasks.push(...result.failedTasks);
            if (result.logs)
                results.logs.push(...result.logs);
            if (result.metadata)
                results.metadata = { ...results.metadata, ...result.metadata };
        }
        return results;
    })
        // Review wrapper node: reviews all completed tasks in parallel
        .addNode('review', async (state) => {
        const completedTasks = state.tasks.filter((t) => t.status === 'completed' &&
            !state.reviews.some((r) => r.taskId === t.id));
        if (completedTasks.length === 0) {
            return {
                logs: [
                    {
                        timestamp: new Date(),
                        level: 'info',
                        source: 'ReviewWrapper',
                        message: 'レビュー対象のタスクがありません',
                    },
                ],
            };
        }
        console.log(`🔍 ${completedTasks.length}個のタスクを並列レビュー中...`);
        // Review all completed tasks in parallel
        const reviewResults = await Promise.all(completedTasks.map((task) => reviewNode(state, task.id)));
        // Accumulate all results
        const results = {
            reviews: [],
            logs: [],
        };
        for (const result of reviewResults) {
            if (result.reviews)
                results.reviews.push(...result.reviews);
            if (result.logs)
                results.logs.push(...result.logs);
        }
        return results;
    })
        .addNode('merge_coordinator', mergeCoordinatorNode)
        .addNode('conflict_resolver', conflictResolverNode)
        .addNode('sprint_review', sprintReviewNode);
    // ================================================
    // Edge Definition: Upper Layer (Scrum Development)
    // ================================================
    // START → check_mode
    workflow.addEdge('__start__', 'check_mode');
    // check_mode → [product_owner/sprint_planning]
    workflow.addConditionalEdges('check_mode', checkModeRouter, {
        product_owner: 'product_owner',
        sprint_planning: 'sprint_planning',
    });
    // product_owner → sprint_planning
    // (After task breakdown, delegate to sprint-driven execution)
    workflow.addEdge('product_owner', 'sprint_planning');
    // ================================================
    // Edge Definition: Lower Layer (Sprint-Driven Execution)
    // ================================================
    // sprint_planning → [engineer_dispatch/END]
    workflow.addConditionalEdges('sprint_planning', sprintPlanningRouter, {
        engineer_dispatch: 'engineer_dispatch',
        END: '__end__',
    });
    // engineer_dispatch → conditional
    workflow.addConditionalEdges('engineer_dispatch', (state) => {
        const inProgressTasks = state.tasks.filter((t) => t.status === 'in_progress');
        return inProgressTasks.length > 0 ? 'has_tasks' : 'no_tasks';
    }, {
        has_tasks: 'engineer',
        no_tasks: 'sprint_review',
    });
    // engineer → review
    workflow.addEdge('engineer', 'review');
    // review → merge_coordinator
    workflow.addEdge('review', 'merge_coordinator');
    // merge_coordinator → [conflict_resolver/sprint_review]
    workflow.addConditionalEdges('merge_coordinator', (state) => {
        const conflicts = state.mergeQueue.filter((m) => m.status === 'conflict');
        if (conflicts.length > 0) {
            return 'has_conflicts';
        }
        const pendingTasks = state.tasks.filter((t) => t.status === 'pending');
        return pendingTasks.length > 0 ? 'has_pending' : 'review_sprint';
    }, {
        has_conflicts: 'conflict_resolver',
        has_pending: 'engineer_dispatch',
        review_sprint: 'sprint_review',
    });
    // conflict_resolver → merge_coordinator (retry)
    workflow.addEdge('conflict_resolver', 'merge_coordinator');
    // sprint_review → [sprint_planning/engineer_dispatch/END]
    workflow.addConditionalEdges('sprint_review', sprintReviewRouter, {
        sprint_planning: 'sprint_planning',
        engineer_dispatch: 'engineer_dispatch',
        END: '__end__',
    });
    return workflow;
}
/**
 * Create and compile the sprint-driven development workflow graph
 *
 * @returns Compiled graph ready for execution
 */
export function compileSprintDrivenGraph() {
    const workflow = createSprintDrivenGraph();
    return workflow.compile();
}
/**
 * Create the Scrum development workflow graph (Phase 6)
 *
 * Workflow:
 * 1. director_ai: Create story mapping from user request
 * 2. review_story_mapping: Review story mapping (ProductOwnerAI)
 * 3. tech_lead_design: Generate design documents
 * 4. review_design: Review design documents (3-party review)
 * 5. task_breakdown: Break down into implementation tasks
 * 6. engineer_dispatch: Continue with normal parallel dev flow
 */
export function createScrumDevGraph() {
    const workflow = new StateGraph(ParallelDevState)
        // Scrum Development Flow nodes
        .addNode('director_ai', directorNode)
        .addNode('review_story_mapping', reviewStoryMappingNode)
        .addNode('tech_lead_design', techLeadDesignNode)
        .addNode('review_design', reviewDesignNode)
        .addNode('task_breakdown', taskBreakdownNode)
        // Existing parallel dev nodes
        .addNode('engineer_dispatch', engineerDispatchNode)
        .addNode('engineer', async (state) => {
        const inProgressTasks = state.tasks.filter((t) => t.status === 'in_progress');
        if (inProgressTasks.length === 0) {
            return {
                logs: [
                    {
                        timestamp: new Date(),
                        level: 'info',
                        source: 'EngineerWrapper',
                        message: '実行可能なタスクがありません',
                    },
                ],
            };
        }
        console.log(`👷 ${inProgressTasks.length}個のタスクを並列実装中...`);
        const taskResults = await Promise.all(inProgressTasks.map((task) => engineerNode(state, task.id)));
        const results = {
            tasks: [],
            completedTasks: [],
            failedTasks: [],
            logs: [],
            metadata: {},
        };
        for (const result of taskResults) {
            if (result.tasks)
                results.tasks.push(...result.tasks);
            if (result.completedTasks)
                results.completedTasks.push(...result.completedTasks);
            if (result.failedTasks)
                results.failedTasks.push(...result.failedTasks);
            if (result.logs)
                results.logs.push(...result.logs);
            if (result.metadata)
                results.metadata = { ...results.metadata, ...result.metadata };
        }
        return results;
    })
        .addNode('review', async (state) => {
        const completedTasks = state.tasks.filter((t) => t.status === 'completed' &&
            !state.reviews.some((r) => r.taskId === t.id));
        if (completedTasks.length === 0) {
            return {
                logs: [
                    {
                        timestamp: new Date(),
                        level: 'info',
                        source: 'ReviewWrapper',
                        message: 'レビュー対象のタスクがありません',
                    },
                ],
            };
        }
        console.log(`🔍 ${completedTasks.length}個のタスクを並列レビュー中...`);
        const reviewResults = await Promise.all(completedTasks.map((task) => reviewNode(state, task.id)));
        const results = {
            reviews: [],
            logs: [],
        };
        for (const result of reviewResults) {
            if (result.reviews)
                results.reviews.push(...result.reviews);
            if (result.logs)
                results.logs.push(...result.logs);
        }
        return results;
    })
        .addNode('merge_coordinator', mergeCoordinatorNode)
        .addNode('conflict_resolver', conflictResolverNode);
    // Set entry point
    workflow.addEdge('__start__', 'director_ai');
    // Scrum flow edges
    workflow.addEdge('director_ai', 'review_story_mapping');
    // review_story_mapping → [tech_lead_design/director_ai]
    workflow.addConditionalEdges('review_story_mapping', (state) => {
        if (state.storyMappingApproved) {
            return 'approved';
        }
        else {
            return 'revision_needed';
        }
    }, {
        approved: 'tech_lead_design',
        revision_needed: 'director_ai', // Loop back for revision
    });
    workflow.addEdge('tech_lead_design', 'review_design');
    // review_design → [task_breakdown/tech_lead_design]
    workflow.addConditionalEdges('review_design', (state) => {
        // Check if design is approved (no critical/major issues in reviewFeedback)
        if (!state.reviewFeedback || state.reviewFeedback.issues.length === 0) {
            return 'approved';
        }
        else {
            const hasCriticalOrMajor = state.reviewFeedback.issues.some((issue) => issue.severity === 'critical' || issue.severity === 'major');
            return hasCriticalOrMajor ? 'revision_needed' : 'approved';
        }
    }, {
        approved: 'task_breakdown',
        revision_needed: 'tech_lead_design', // Loop back for revision
    });
    workflow.addEdge('task_breakdown', 'engineer_dispatch');
    // Normal parallel dev flow
    workflow.addEdge('engineer_dispatch', 'engineer');
    // engineer → [review/engineer_dispatch/END]
    workflow.addConditionalEdges('engineer', (state) => {
        const hasInProgress = state.tasks.some((t) => t.status === 'in_progress');
        const hasCompleted = state.tasks.some((t) => t.status === 'completed' && !state.reviews.some((r) => r.taskId === t.id));
        if (hasCompleted)
            return 'review';
        if (hasInProgress)
            return 'engineer_dispatch';
        const allComplete = state.tasks.every((t) => t.status === 'completed' || t.status === 'failed');
        return allComplete ? 'END' : 'engineer_dispatch';
    }, {
        review: 'review',
        engineer_dispatch: 'engineer_dispatch',
        END: '__end__',
    });
    workflow.addEdge('review', 'merge_coordinator');
    // merge_coordinator → [engineer_dispatch/conflict_resolver/END]
    workflow.addConditionalEdges('merge_coordinator', (state) => {
        const hasPending = state.tasks.some((t) => t.status === 'pending');
        const hasConflicts = state.tasks.some((t) => t.isConflictResolution);
        if (hasConflicts)
            return 'conflict_resolver';
        if (hasPending)
            return 'engineer_dispatch';
        const allComplete = state.tasks.every((t) => t.status === 'completed' || t.status === 'failed');
        return allComplete ? 'END' : 'engineer_dispatch';
    }, {
        conflict_resolver: 'conflict_resolver',
        engineer_dispatch: 'engineer_dispatch',
        END: '__end__',
    });
    workflow.addEdge('conflict_resolver', 'merge_coordinator');
    return workflow;
}
/**
 * Create and compile the Scrum development workflow graph
 *
 * @returns Compiled graph ready for execution
 */
export function compileScrumDevGraph() {
    const workflow = createScrumDevGraph();
    return workflow.compile();
}
/**
 * Export for convenience
 */
export default compileParallelDevGraph;
//# sourceMappingURL=ParallelDevGraph.js.map