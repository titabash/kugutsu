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

      console.log(`👷 ${inProgressTasks.length}個のタスクを並列実装中...`);

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

      for (const settledResult of taskResults) {
        if (settledResult.status === 'fulfilled') {
          // タスク実行成功
          const result = settledResult.value;
          if (result.tasks) results.tasks.push(...result.tasks);
          if (result.completedTasks) results.completedTasks.push(...result.completedTasks);
          if (result.failedTasks) results.failedTasks.push(...result.failedTasks);
          if (result.logs) results.logs.push(...result.logs);
          if (result.metadata) results.metadata = { ...results.metadata, ...result.metadata };
        } else {
          // タスク実行失敗
          results.logs.push({
            timestamp: new Date(),
            level: 'error' as const,
            source: 'EngineerWrapper',
            message: `タスク実行エラー: ${settledResult.reason?.message || settledResult.reason}`,
            data: { error: settledResult.reason },
          });
        }
      }

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

      console.log(`🔍 ${completedTasks.length}個のタスクを並列レビュー中...`);

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

      for (const settledResult of reviewResults) {
        if (settledResult.status === 'fulfilled') {
          // レビュー成功
          const result = settledResult.value;
          if (result.tasks) results.tasks.push(...result.tasks);
          if (result.completedTasks) results.completedTasks.push(...result.completedTasks);
          if (result.reviews) results.reviews.push(...result.reviews);
          if (result.logs) results.logs.push(...result.logs);
        } else {
          // レビュー失敗
          results.logs.push({
            timestamp: new Date(),
            level: 'error' as const,
            source: 'ReviewWrapper',
            message: `レビュー実行エラー: ${settledResult.reason?.message || settledResult.reason}`,
            data: { error: settledResult.reason },
          });
        }
      }

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

  // Conditional branching based on complexity
  workflow.addConditionalEdges(
    'analyze_complexity',
    (state: ParallelDevStateType) => {
      const requiresDetailedDesign = state.metadata.requiresDetailedDesign;
      console.log(`🔍 複雑度判定結果: ${requiresDetailedDesign ? '高（詳細設計実行）' : '低（詳細設計スキップ）'}`);
      return requiresDetailedDesign ? 'high_complexity' : 'low_complexity';
    },
    {
      high_complexity: 'director_ai',
      low_complexity: 'product_owner',
    }
  );

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

  workflow.addEdge('task_breakdown', 'check_mode');

  // Low complexity path edge
  workflow.addEdge('product_owner', 'check_mode');

  // CheckMode routing: new mode or continuation mode
  workflow.addConditionalEdges('check_mode', checkModeRouter, {
    product_owner: 'product_owner',
    sprint_planning: 'sprint_planning',
  });

  // Sprint planning → engineer dispatch
  workflow.addConditionalEdges('sprint_planning', sprintPlanningRouter, {
    engineer_dispatch: 'engineer_dispatch',
    sprint_review: 'sprint_review',
  });

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

  // Review → merge_coordinator
  workflow.addEdge('review', 'merge_coordinator');

  // Merge coordinator → conditional
  workflow.addConditionalEdges(
    'merge_coordinator',
    (state: ParallelDevStateType) => {
      const conflicts = state.mergeQueue.filter((m) => m.status === 'conflict');
      if (conflicts.length > 0) {
        return 'has_conflicts';
      }

      const pendingTasks = state.tasks.filter((t) => t.status === 'pending');
      return pendingTasks.length > 0 ? 'has_pending' : 'no_pending';
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
    __end__: '__end__',
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
