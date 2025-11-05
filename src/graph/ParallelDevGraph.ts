/**
 * Parallel Development Graph
 *
 * Main workflow graph using LangGraphJS
 */

import { StateGraph } from '@langchain/langgraph';
import { ParallelDevState, type ParallelDevStateType } from './state.js';
import { productOwnerNode } from './nodes/ProductOwnerNode.js';
import { engineerDispatchNode } from './nodes/EngineerDispatchNode.js';
import { engineerNode } from './nodes/EngineerNode.js';
import { reviewNode } from './nodes/ReviewNode.js';
import { mergeCoordinatorNode } from './nodes/MergeCoordinatorNode.js';
import { conflictResolverNode } from './nodes/ConflictResolverNode.js';

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

      // Execute all in-progress tasks in parallel
      const taskResults = await Promise.all(
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

      for (const result of taskResults) {
        if (result.tasks) results.tasks.push(...result.tasks);
        if (result.completedTasks) results.completedTasks.push(...result.completedTasks);
        if (result.failedTasks) results.failedTasks.push(...result.failedTasks);
        if (result.logs) results.logs.push(...result.logs);
        if (result.metadata) results.metadata = { ...results.metadata, ...result.metadata };
      }

      return results;
    })
    // Review wrapper node: reviews all completed tasks
    .addNode('review', async (state: ParallelDevStateType) => {
      const completedTasks = state.tasks.filter(
        (t) =>
          t.status === 'completed' &&
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

      // Review all completed tasks in parallel
      const reviewResults = await Promise.all(
        completedTasks.map((task) => reviewNode(state, task.id))
      );

      // Accumulate all results
      const results = {
        reviews: [] as any[],
        logs: [] as any[],
      };

      for (const result of reviewResults) {
        if (result.reviews) results.reviews.push(...result.reviews);
        if (result.logs) results.logs.push(...result.logs);
      }

      return results;
    })
    .addNode('merge_coordinator', mergeCoordinatorNode)
    .addNode('conflict_resolver', conflictResolverNode)
    // Add check_completion node
    .addNode('check_completion', (state: ParallelDevStateType) => {
      const allTasksSettled = state.tasks.every(
        (t) => t.status === 'completed' || t.status === 'failed'
      );

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
  workflow.addConditionalEdges(
    'engineer_dispatch',
    (state: ParallelDevStateType) => {
      const inProgressTasks = state.tasks.filter((t) => t.status === 'in_progress');
      return inProgressTasks.length > 0 ? 'has_tasks' : 'no_tasks';
    },
    {
      has_tasks: 'engineer',
      no_tasks: 'check_completion',
    }
  );

  // engineer → review
  workflow.addEdge('engineer', 'review');

  // review → merge_coordinator
  workflow.addEdge('review', 'merge_coordinator');

  // merge_coordinator → conditional
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
      no_pending: 'check_completion',
    }
  );

  // conflict_resolver → merge_coordinator (retry)
  workflow.addEdge('conflict_resolver', 'merge_coordinator');

  // check_completion → conditional (__end__ or continue)
  workflow.addConditionalEdges(
    'check_completion',
    (state: ParallelDevStateType) => {
      const allTasksSettled = state.tasks.every(
        (t) => t.status === 'completed' || t.status === 'failed'
      );
      return allTasksSettled ? 'done' : 'continue';
    },
    {
      done: '__end__',
      continue: 'engineer_dispatch',
    }
  );

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
 * Export for convenience
 */
export default compileParallelDevGraph;
