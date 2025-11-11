/**
 * Parallel Development Graph
 *
 * Main workflow graph using LangGraphJS
 */
import { StateGraph, MemorySaver, Send } from '@langchain/langgraph';
import { ParallelDevState } from './state.js';
import { productOwnerNode } from './nodes/ProductOwnerNode.js';
import { engineerDispatchNode } from './nodes/EngineerDispatchNode.js';
import { engineerNode } from './nodes/EngineerNode.js';
import { reviewDispatchNode } from './nodes/ReviewDispatchNode.js';
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
import { analyzeComplexityNode } from './nodes/AnalyzeComplexityNode.js';
import { instructionGeneratorNode } from './nodes/InstructionGeneratorNode.js';
import { instructionGeneratorDispatchNode, instructionGeneratorDispatchRouter, } from './nodes/InstructionGeneratorDispatchNode.js';
import { instructionAggregatorNode, instructionAggregatorRouter, } from './nodes/InstructionAggregatorNode.js';
import { TaskStateMachine } from '../utils/TaskStateMachine.js';
/**
 * Create the Unified Scrum Workflow Graph
 *
 * This is the single, unified workflow that replaces the previous 3 separate graphs:
 * - createParallelDevGraph (basic parallel development)
 * - createSprintDrivenGraph (sprint-based development)
 * - createScrumDevGraph (full Scrum with story mapping)
 *
 * Unified Workflow:
 * 1. AnalyzeComplexityNode: AI-driven complexity analysis
 * 2. Conditional branching based on complexity:
 *    - High: Director → ReviewStoryMapping → TechLeadDesign → ReviewDesign → TaskBreakdown
 *    - Low: ProductOwner (direct task breakdown)
 * 3. CheckMode: Detect continuation vs new mode
 * 4. SprintPlanning: Plan sprint (8-16h units)
 * 5. Engineer execution loop: EngineerDispatch → Engineer → Review → MergeCoordinator → ConflictResolver
 * 6. SprintReview: Sprint completion check, generate next sprint
 */
export function createUnifiedScrumWorkflowGraph() {
    const workflow = new StateGraph(ParallelDevState)
        // ================================================
        // Entry: Complexity Analysis
        // ================================================
        .addNode('analyze_complexity', analyzeComplexityNode)
        // ================================================
        // High Complexity Path: Full Scrum Flow
        // ================================================
        .addNode('director_ai', directorNode)
        .addNode('review_story_mapping', reviewStoryMappingNode)
        .addNode('tech_lead_design', techLeadDesignNode)
        .addNode('review_design', reviewDesignNode)
        .addNode('task_breakdown', taskBreakdownNode)
        // ================================================
        // Low Complexity Path: Direct Task Breakdown
        // ================================================
        .addNode('product_owner', productOwnerNode)
        // ================================================
        // Common Path: Sprint-Driven Execution
        // ================================================
        .addNode('check_mode', checkModeNode)
        .addNode('sprint_planning', sprintPlanningNode)
        .addNode('instruction_generator_dispatch', instructionGeneratorDispatchNode, {
        ends: ['instruction_generator', 'instruction_aggregator'],
    })
        .addNode('instruction_generator', instructionGeneratorNode, {
        ends: ['instruction_aggregator'],
    })
        .addNode('instruction_aggregator', instructionAggregatorNode, {
        ends: ['instruction_generator_dispatch', 'instruction_aggregator', 'engineer_dispatch', 'sprint_review'],
    })
        .addNode('engineer_dispatch', engineerDispatchNode)
        // ================================================
        // Engineer Node: Individual Task Execution (Send API Compatible)
        // ================================================
        .addNode('engineer', engineerNode)
        // ================================================
        // Engineer Aggregator: Fan-in from parallel engineer executions
        // ================================================
        .addNode('engineer_aggregator', (state) => {
        const inReviewTasks = state.tasks.filter(t => t.status === 'in_review');
        const failedTasks = state.tasks.filter(t => t.status === 'failed');
        const inProgressTasks = state.tasks.filter(t => t.status === 'in_progress');
        console.log(`\n${'='.repeat(70)}`);
        console.log(`📊 Engineer Aggregator: 並列実装結果を集約`);
        console.log(`   ✅ レビュー待ち: ${inReviewTasks.length}タスク`);
        console.log(`   ❌ 失敗: ${failedTasks.length}タスク`);
        console.log(`   🔄 実装中: ${inProgressTasks.length}タスク`);
        console.log(`${'='.repeat(70)}\n`);
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'info',
                    source: 'EngineerAggregator',
                    message: `並列実装完了: レビュー待ち ${inReviewTasks.length}, 失敗 ${failedTasks.length}, 実装中 ${inProgressTasks.length}`,
                },
            ],
        };
    })
        // ================================================
        // Review Dispatch: Manage review task distribution (respects maxEngineers)
        // ================================================
        .addNode('review_dispatch', reviewDispatchNode)
        // ================================================
        // Review Node: Individual Task Review (Send API Compatible)
        // ================================================
        .addNode('review', reviewNode)
        // ================================================
        // Review Aggregator: Fan-in from parallel review executions
        // ================================================
        .addNode('review_aggregator', (state) => {
        const completedTasks = state.tasks.filter(t => t.status === 'completed');
        const inProgressTasks = state.tasks.filter(t => t.status === 'in_progress');
        const reviewCount = state.reviews.length;
        console.log(`\n${'='.repeat(70)}`);
        console.log(`📊 Review Aggregator: 並列レビュー結果を集約`);
        console.log(`   ✅ 承認済み: ${completedTasks.length}タスク`);
        console.log(`   🔄 修正要求: ${inProgressTasks.length}タスク`);
        console.log(`   📝 レビュー総数: ${reviewCount}`);
        console.log(`${'='.repeat(70)}\n`);
        return {
            logs: [
                {
                    timestamp: new Date(),
                    level: 'info',
                    source: 'ReviewAggregator',
                    message: `並列レビュー完了: 承認済み ${completedTasks.length}, 修正要求 ${inProgressTasks.length}`,
                },
            ],
        };
    })
        // ================================================
        // Merge and Conflict Resolution
        // ================================================
        .addNode('merge_coordinator', mergeCoordinatorNode)
        .addNode('conflict_resolver', conflictResolverNode)
        // ================================================
        // Sprint Review and Completion
        // ================================================
        .addNode('sprint_review', sprintReviewNode);
    // ================================================
    // Define Edges
    // ================================================
    // Entry point: __start__ → analyze_complexity
    workflow.addEdge('__start__', 'analyze_complexity');
    // Always go to check_mode first (both high and low complexity)
    // CheckMode initializes repository metadata and tech stack
    workflow.addEdge('analyze_complexity', 'check_mode');
    // CheckMode routing: route based on complexity
    workflow.addConditionalEdges('check_mode', checkModeRouter, {
        director_ai: 'director_ai',
        product_owner: 'product_owner',
    });
    // High complexity path edges
    workflow.addEdge('director_ai', 'review_story_mapping');
    workflow.addConditionalEdges('review_story_mapping', (state) => {
        // ストーリーマッピングの承認状態をチェック
        if (state.storyMappingApproved === true) {
            console.log('➡️ ルーティング: tech_lead_design (ストーリーマッピング承認)');
            return 'approved';
        }
        else {
            console.log('➡️ ルーティング: director_ai (ストーリーマッピング修正必要)');
            return 'revision_needed';
        }
    }, {
        approved: 'tech_lead_design',
        revision_needed: 'director_ai',
    });
    workflow.addEdge('tech_lead_design', 'review_design');
    workflow.addConditionalEdges('review_design', (state) => {
        // 設計書の承認状態をチェック
        if (state.designApproved === true) {
            console.log('➡️ ルーティング: task_breakdown (設計書承認)');
            return 'approved';
        }
        else {
            console.log('➡️ ルーティング: tech_lead_design (設計書修正必要)');
            return 'revision_needed';
        }
    }, {
        approved: 'task_breakdown',
        revision_needed: 'tech_lead_design',
    });
    // Task breakdown → sprint planning (high complexity path end)
    workflow.addEdge('task_breakdown', 'sprint_planning');
    // Product owner → sprint planning (low complexity path end)
    workflow.addEdge('product_owner', 'sprint_planning');
    // Sprint planning → instruction generator dispatch
    workflow.addConditionalEdges('sprint_planning', sprintPlanningRouter, {
        instruction_generator_dispatch: 'instruction_generator_dispatch',
        sprint_review: 'sprint_review',
        END: '__end__',
    });
    // Instruction generator dispatch → (Send API fan-out)
    // 集中制御: aggregatorがルーティングを決定
    workflow.addConditionalEdges('instruction_generator_dispatch', (state) => {
        const result = instructionGeneratorDispatchRouter(state);
        if (result === 'generate') {
            // 未生成タスクをSend APIでfan-out
            const sprintTasks = (state.globalTasks || []).filter(task => state.activeSprint?.taskIds.includes(task.id));
            const tasksNeedingInstruction = sprintTasks.filter(task => task.instructionGenerated !== true &&
                task.instructionGenerating !== true // 実行中タスクを除外
            );
            const maxDispatch = state.config.maxEngineers || 3;
            const tasksToDispatch = tasksNeedingInstruction.slice(0, maxDispatch);
            console.log(`📤 ${tasksToDispatch.length}個のタスクをdispatch ` +
                `(未生成: ${tasksNeedingInstruction.length}件, maxEngineers: ${maxDispatch})`);
            // 各タスクに instructionGenerating=true を設定
            const tasksToDispatchIds = new Set(tasksToDispatch.map(t => t.id));
            const updatedGlobalTasks = (state.globalTasks || []).map(t => {
                if (tasksToDispatchIds.has(t.id)) {
                    return { ...t, instructionGenerating: true };
                }
                return t;
            });
            // instruction_generatorに送信（taskToProcessと更新したglobalTasksを含む）
            return tasksToDispatch.map(task => {
                const updatedTask = { ...task, instructionGenerating: true };
                return new Send('instruction_generator', {
                    taskToProcess: updatedTask,
                    globalTasks: updatedGlobalTasks,
                    config: state.config, // configを明示的に渡す
                    activeSprint: state.activeSprint, // activeSprintも渡す
                    currentProjectId: state.currentProjectId, // currentProjectIdも渡す
                    userRequest: state.userRequest, // userRequestも渡す（低複雑度パス用）
                    storyMapping: state.storyMapping, // storyMappingも渡す（高複雑度パス用）
                    designDocs: state.designDocs, // designDocsも渡す（高複雑度パス用）
                });
            });
        }
        // 'complete'の場合: instruction_aggregatorに最終確認を依頼
        return [new Send('instruction_aggregator', {
                config: state.config,
                globalTasks: state.globalTasks,
                activeSprint: state.activeSprint,
                tasks: state.tasks,
                tasksPath: state.tasksPath,
            })];
    });
    // Instruction generator → aggregator (fan-in)
    // 個別タスク完了後、aggregatorが集約して次のアクションを決定
    workflow.addEdge('instruction_generator', 'instruction_aggregator');
    // Instruction aggregator → 条件分岐（Send API並列実行 or sprint_review）
    // Send APIで複数アクション（engineer_dispatch, instruction_generator_dispatch）を並列実行
    // または全タスク完了時にsprint_reviewへ遷移
    workflow.addConditionalEdges('instruction_aggregator', instructionAggregatorRouter, {
        sprint_review: 'sprint_review', // 全完了
    });
    // Engineer dispatch → conditional (feedback routing or Send API fan-out)
    workflow.addConditionalEdges('engineer_dispatch', (state) => {
        // Feedback check (highest priority)
        if (state.feedbackRequest) {
            const target = state.feedbackRequest.targetNode;
            console.log(`🔄 フィードバックルーティング: engineer_dispatch → ${target}`);
            return `feedback_${target}`;
        }
        // Send API fan-out: Create Send objects for each in-progress task
        const inProgressTasks = state.tasks.filter((t) => t.status === 'in_progress');
        if (inProgressTasks.length === 0) {
            console.log('[Graph] No tasks to execute, proceeding to sprint review');
            return '__end__'; // Special marker for "no tasks" case
        }
        console.log(`[Graph] 📤 Fan-out: Sending ${inProgressTasks.length} tasks to parallel engineer nodes`);
        for (const task of inProgressTasks) {
            console.log(`   - [${task.id}] ${task.title}`);
        }
        // Return array of Send objects (fan-out)
        return inProgressTasks.map(t => {
            console.log(`[DEBUG ParallelDevGraph] Task object:`, JSON.stringify(t, null, 2));
            console.log(`[DEBUG ParallelDevGraph] task.id type=${typeof t.id}, value="${t.id}"`);
            const taskIdValue = t.id;
            console.log(`[DEBUG ParallelDevGraph] Extracted taskIdValue type=${typeof taskIdValue}, value="${taskIdValue}"`);
            return new Send('engineer', {
                currentTaskId: taskIdValue,
                config: state.config,
                tasks: state.tasks,
                tasksPath: state.tasksPath,
                activeSprint: state.activeSprint,
                globalTasks: state.globalTasks,
                metadata: state.metadata,
                feedbackRequest: state.feedbackRequest,
                nodeRetryCounters: state.nodeRetryCounters,
            });
        });
    }, {
        // Normal routes
        __end__: 'sprint_review',
        // Feedback routes
        feedback_product_owner: 'product_owner',
        feedback_engineer_dispatch: 'engineer_dispatch',
        // Send destination
        engineer: 'engineer',
    });
    // Engineer → engineer_aggregator (fan-in)
    workflow.addEdge('engineer', 'engineer_aggregator');
    // Engineer aggregator → review_dispatch (manages review distribution)
    workflow.addEdge('engineer_aggregator', 'review_dispatch');
    // Review dispatch → conditional (Send API fan-out for review with maxEngineers limit)
    workflow.addConditionalEdges('review_dispatch', (state) => {
        // Get tasks ready for review (in_review status, not yet reviewed)
        const tasksToReview = state.tasks.filter(t => t.status === 'in_review' &&
            !state.reviews.some(r => r.taskId === t.id));
        if (tasksToReview.length === 0) {
            console.log('[Graph] No tasks to review, proceeding to merge');
            return '__end__'; // Special marker for "no tasks" case
        }
        // Apply maxEngineers limit (same as engineer dispatch)
        const tasksToDispatch = tasksToReview.slice(0, state.config.maxEngineers);
        console.log(`[Graph] 📤 Fan-out: Sending ${tasksToDispatch.length}/${tasksToReview.length} tasks to parallel review nodes (maxEngineers: ${state.config.maxEngineers})`);
        for (const task of tasksToDispatch) {
            console.log(`   - [${task.id}] ${task.title}`);
        }
        // Return array of Send objects (fan-out)
        return tasksToDispatch.map(task => new Send('review', {
            currentTaskId: task.id,
            config: state.config,
            tasks: state.tasks,
            tasksPath: state.tasksPath,
            activeSprint: state.activeSprint,
            globalTasks: state.globalTasks,
            storyMapping: state.storyMapping,
            designDocs: state.designDocs,
            sprintPlanPath: state.sprintPlanPath,
            metadata: state.metadata,
        }));
    }, {
        __end__: 'merge_coordinator',
        // Send destination
        review: 'review',
    });
    // Review → review_aggregator (fan-in)
    workflow.addEdge('review', 'review_aggregator');
    // Review aggregator → conditional (dynamic task pooling)
    workflow.addConditionalEdges('review_aggregator', (state) => {
        // 🔄 Dynamic Task Pooling: Check for ready tasks and available slots
        const readyTasks = state.tasks.filter(t => t.status === 'pending' &&
            TaskStateMachine.canMoveToReady(t, state.tasks));
        const inProgressCount = state.tasks.filter(t => t.status === 'in_progress').length;
        const availableSlots = state.config.maxEngineers - inProgressCount;
        // If there are ready tasks and available slots, dispatch immediately
        if (readyTasks.length > 0 && availableSlots > 0) {
            console.log(`[Graph] Review complete, ${readyTasks.length} ready tasks, ${availableSlots} slots available - dispatching`);
            return 'dispatch_next';
        }
        console.log('[Graph] Review complete, proceeding to merge');
        return 'continue';
    }, {
        dispatch_next: 'engineer_dispatch',
        continue: 'merge_coordinator',
    });
    // Merge coordinator → conditional (dynamic task pooling)
    workflow.addConditionalEdges('merge_coordinator', (state) => {
        const conflicts = state.mergeQueue.filter((m) => m.status === 'conflict');
        if (conflicts.length > 0) {
            return 'has_conflicts';
        }
        // 🔄 Dynamic Task Pooling: Check for ready tasks and available slots
        const readyTasks = state.tasks.filter(t => t.status === 'pending' &&
            TaskStateMachine.canMoveToReady(t, state.tasks));
        const inProgressCount = state.tasks.filter(t => t.status === 'in_progress').length;
        const availableSlots = state.config.maxEngineers - inProgressCount;
        // If there are ready tasks and available slots, dispatch immediately
        if (readyTasks.length > 0 && availableSlots > 0) {
            console.log(`[Graph] Merge complete, ${readyTasks.length} ready tasks, ${availableSlots} slots available - dispatching`);
            return 'has_pending';
        }
        // Check if all tasks are completed
        const allPendingTasks = state.tasks.filter(t => t.status === 'pending');
        if (allPendingTasks.length === 0) {
            console.log('[Graph] All tasks completed, proceeding to sprint review');
            return 'no_pending';
        }
        // Pending tasks exist but either no slots or dependencies not resolved
        if (availableSlots <= 0) {
            console.log('[Graph] Pending tasks exist but no available slots');
        }
        else {
            console.log('[Graph] Pending tasks exist but dependencies not resolved');
        }
        return 'no_pending';
    }, {
        has_conflicts: 'conflict_resolver',
        has_pending: 'engineer_dispatch',
        no_pending: 'sprint_review',
    });
    // Conflict resolver → merge coordinator (retry)
    workflow.addEdge('conflict_resolver', 'merge_coordinator');
    // Sprint review → conditional (__end__ or continue)
    workflow.addConditionalEdges('sprint_review', sprintReviewRouter, {
        sprint_planning: 'sprint_planning',
        engineer_dispatch: 'engineer_dispatch',
        END: '__end__',
    });
    return workflow;
}
/**
 * Create and compile the Unified Scrum Workflow Graph
 *
 * @param options Compilation options
 * @param options.enableCheckpointer Enable state persistence (default: false for backward compatibility)
 * @returns Compiled graph ready for execution
 */
export function compileUnifiedScrumWorkflowGraph(options) {
    const workflow = createUnifiedScrumWorkflowGraph();
    // Enable checkpointer for state persistence and pause/resume functionality
    // Default to false for backward compatibility with existing tests
    if (options?.enableCheckpointer === true) {
        return workflow.compile({
            checkpointer: new MemorySaver(),
        });
    }
    return workflow.compile();
}
/**
 * Export for convenience
 */
export default compileUnifiedScrumWorkflowGraph;
//# sourceMappingURL=ParallelDevGraph.js.map