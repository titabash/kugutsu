/**
 * Parallel Development Graph
 *
 * Main workflow graph using LangGraphJS
 */

import { StateGraph, MemorySaver } from '@langchain/langgraph';
import { ParallelDevState, type ParallelDevStateType } from './state.js';
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
import { analyzeComplexityNode } from './nodes/AnalyzeComplexityNode.js';
import { instructionGeneratorNode } from './nodes/InstructionGeneratorNode.js';
import { TaskStateMachine } from '../utils/TaskStateMachine.js';
import { ParallelProgressTracker } from '../utils/ParallelProgressTracker.js';

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
    .addNode('instruction_generator', instructionGeneratorNode)
    .addNode('engineer_dispatch', engineerDispatchNode)

    // ================================================
    // Engineer Wrapper: Parallel Task Execution
    // ================================================
    .addNode('engineer', async (state: ParallelDevStateType) => {
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

      // ✨ 並列実行ステータスボードを作成
      const tracker = new ParallelProgressTracker(`🚀 ${inProgressTasks.length}個のタスクを並列実装中`);

      // タスクをトラッカーに追加
      console.log(`\n${'='.repeat(70)}`);
      console.log(`👷 並列実装開始: ${inProgressTasks.length}タスク`);
      for (const task of inProgressTasks) {
        console.log(`   - [${task.id}] ${task.title}`);
        tracker.addTask(task.id, task.title, state.config.maxTurns);
      }
      console.log(`${'='.repeat(70)}\n`);

      // Execute all in-progress tasks in parallel (with allSettled to continue on failures)
      const taskResults = await Promise.allSettled(
        inProgressTasks.map((task) => engineerNode(state, task.id))
      );

      // Accumulate all results
      const results = {
        tasks: [] as any[],
        completedTasks: [] as any[],
        failedTasks: [] as any[],
        logs: [] as any[],
        metadata: {},
      };

      for (let i = 0; i < taskResults.length; i++) {
        const settledResult = taskResults[i];
        const task = inProgressTasks[i];

        if (settledResult.status === 'fulfilled') {
          // タスク実行成功
          const result = settledResult.value;
          if (result.tasks) results.tasks.push(...result.tasks);
          if (result.completedTasks) results.completedTasks.push(...result.completedTasks);
          if (result.failedTasks) results.failedTasks.push(...result.failedTasks);
          if (result.logs) results.logs.push(...result.logs);
          if (result.metadata) results.metadata = { ...results.metadata, ...result.metadata };

          // ✨ トラッカーに成功を通知
          const success = !result.failedTasks || result.failedTasks.length === 0;
          tracker.completeTask(task.id, success);
        } else {
          // タスク実行失敗
          results.logs.push({
            timestamp: new Date(),
            level: 'error' as const,
            source: 'EngineerWrapper',
            message: `タスク実行エラー: ${settledResult.reason?.message || settledResult.reason}`,
            data: { error: settledResult.reason },
          });

          // ✨ トラッカーに失敗を通知
          tracker.failTask(task.id, settledResult.reason?.message);
        }
      }

      // ✨ トラッカーを終了
      await tracker.close();

      // 並列実装終了ログ
      const successCount = results.tasks.filter(t => t.status === 'in_review').length;
      const failedCount = results.failedTasks?.length || 0;
      console.log(`\n${'='.repeat(70)}`);
      console.log(`📊 並列実装完了: 成功 ${successCount}/${inProgressTasks.length}, 失敗 ${failedCount}/${inProgressTasks.length}`);
      console.log(`${'='.repeat(70)}\n`);

      return results;
    })

    // ================================================
    // Review Wrapper: Parallel Code Review
    // ⚠️ FIXED: Changed from status === 'completed' to status === 'in_review'
    // ================================================
    .addNode('review', async (state: ParallelDevStateType) => {
      const completedTasks = state.tasks.filter(
        (t) =>
          t.status === 'in_review' && // ✅ FIXED: was 'completed'
          !state.reviews.some((r) => r.taskId === t.id)
      );

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

      // ✨ 並列実行ステータスボードを作成
      const tracker = new ParallelProgressTracker(`🔍 ${completedTasks.length}個のタスクを並列レビュー中`);

      // タスクをトラッカーに追加
      console.log(`\n${'='.repeat(70)}`);
      console.log(`🔍 並列レビュー開始: ${completedTasks.length}タスク`);
      for (const task of completedTasks) {
        console.log(`   - [${task.id}] ${task.title}`);
        tracker.addTask(task.id, task.title, state.config.maxTurns);
      }
      console.log(`${'='.repeat(70)}\n`);

      // Review all completed tasks in parallel (with allSettled to continue on failures)
      const reviewResults = await Promise.allSettled(
        completedTasks.map((task) => reviewNode(state, task.id))
      );

      // Accumulate all results
      const results = {
        tasks: [] as any[],
        completedTasks: [] as any[],
        reviews: [] as any[],
        logs: [] as any[],
      };

      for (let i = 0; i < reviewResults.length; i++) {
        const settledResult = reviewResults[i];
        const task = completedTasks[i];

        if (settledResult.status === 'fulfilled') {
          // レビュー成功
          const result = settledResult.value;
          if (result.tasks) results.tasks.push(...result.tasks);
          if (result.completedTasks) results.completedTasks.push(...result.completedTasks);
          if (result.reviews) results.reviews.push(...result.reviews);
          if (result.logs) results.logs.push(...result.logs);

          // ✨ トラッカーに成功を通知
          tracker.completeTask(task.id, true);
        } else {
          // レビュー失敗
          results.logs.push({
            timestamp: new Date(),
            level: 'error' as const,
            source: 'ReviewWrapper',
            message: `レビュー実行エラー: ${settledResult.reason?.message || settledResult.reason}`,
            data: { error: settledResult.reason },
          });

          // ✨ トラッカーに失敗を通知
          tracker.failTask(task.id, settledResult.reason?.message);
        }
      }

      // ✨ トラッカーを終了
      await tracker.close();

      // 並列レビュー終了ログ
      const approvedCount = results.tasks.filter(t => t.status === 'completed').length;
      const changesRequestedCount = results.tasks.filter(t => t.status === 'in_progress').length;
      console.log(`\n${'='.repeat(70)}`);
      console.log(`📊 並列レビュー完了: 承認 ${approvedCount}/${completedTasks.length}, 修正要求 ${changesRequestedCount}/${completedTasks.length}`);
      console.log(`${'='.repeat(70)}\n`);

      return results;
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

  workflow.addConditionalEdges(
    'review_story_mapping',
    (state: ParallelDevStateType) => {
      // Check if story mapping was approved or needs revision
      // For now, default to approved (future: implement approval logic)
      return 'approved';
    },
    {
      approved: 'tech_lead_design',
      revision_needed: 'director_ai',
    }
  );

  workflow.addEdge('tech_lead_design', 'review_design');

  workflow.addConditionalEdges(
    'review_design',
    (state: ParallelDevStateType) => {
      // Check if design was approved or needs revision
      // For now, default to approved (future: implement approval logic)
      return 'approved';
    },
    {
      approved: 'task_breakdown',
      revision_needed: 'tech_lead_design',
    }
  );

  // Task breakdown → sprint planning (high complexity path end)
  workflow.addEdge('task_breakdown', 'sprint_planning');

  // Product owner → sprint planning (low complexity path end)
  workflow.addEdge('product_owner', 'sprint_planning');

  // Sprint planning → instruction generator
  workflow.addConditionalEdges('sprint_planning', sprintPlanningRouter, {
    instruction_generator: 'instruction_generator',
    sprint_review: 'sprint_review',
    END: '__end__',
  });

  // Instruction generator → engineer dispatch
  workflow.addEdge('instruction_generator', 'engineer_dispatch');

  // Engineer dispatch → conditional (feedback routing or normal flow)
  workflow.addConditionalEdges(
    'engineer_dispatch',
    (state: ParallelDevStateType) => {
      // Feedback check (highest priority)
      if (state.feedbackRequest) {
        const target = state.feedbackRequest.targetNode;
        console.log(`🔄 フィードバックルーティング: engineer_dispatch → ${target}`);
        return `feedback_${target}`;
      }

      // Normal flow
      const inProgressTasks = state.tasks.filter((t) => t.status === 'in_progress');
      return inProgressTasks.length > 0 ? 'has_tasks' : 'no_tasks';
    },
    {
      has_tasks: 'engineer',
      no_tasks: 'sprint_review',
      // Feedback routes
      feedback_product_owner: 'product_owner',
      feedback_engineer_dispatch: 'engineer_dispatch',
    }
  );

  // Engineer → review
  workflow.addEdge('engineer', 'review');

  // Review → conditional (dynamic task pooling)
  workflow.addConditionalEdges(
    'review',
    (state: ParallelDevStateType) => {
      // 🔄 Dynamic Task Pooling: Check for ready tasks and available slots
      const readyTasks = state.tasks.filter(t =>
        t.status === 'pending' &&
        TaskStateMachine.canMoveToReady(t, state.tasks)
      );
      const inProgressCount = state.tasks.filter(t => t.status === 'in_progress').length;
      const availableSlots = state.config.maxEngineers - inProgressCount;

      // If there are ready tasks and available slots, dispatch immediately
      if (readyTasks.length > 0 && availableSlots > 0) {
        console.log(`[Graph] Review complete, ${readyTasks.length} ready tasks, ${availableSlots} slots available - dispatching`);
        return 'dispatch_next';
      }

      console.log('[Graph] Review complete, proceeding to merge');
      return 'continue';
    },
    {
      dispatch_next: 'engineer_dispatch',
      continue: 'merge_coordinator',
    }
  );

  // Merge coordinator → conditional (dynamic task pooling)
  workflow.addConditionalEdges(
    'merge_coordinator',
    (state: ParallelDevStateType) => {
      const conflicts = state.mergeQueue.filter((m) => m.status === 'conflict');
      if (conflicts.length > 0) {
        return 'has_conflicts';
      }

      // 🔄 Dynamic Task Pooling: Check for ready tasks and available slots
      const readyTasks = state.tasks.filter(t =>
        t.status === 'pending' &&
        TaskStateMachine.canMoveToReady(t, state.tasks)
      );
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
      } else {
        console.log('[Graph] Pending tasks exist but dependencies not resolved');
      }
      return 'no_pending';
    },
    {
      has_conflicts: 'conflict_resolver',
      has_pending: 'engineer_dispatch',
      no_pending: 'sprint_review',
    }
  );

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
export function compileUnifiedScrumWorkflowGraph(options?: { enableCheckpointer?: boolean }) {
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
