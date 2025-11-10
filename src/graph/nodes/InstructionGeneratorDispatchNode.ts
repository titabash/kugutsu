/**
 * InstructionGeneratorDispatchNode
 *
 * スプリント内のタスクをチェックし、instruction.md未生成のタスクを
 * 並列処理用にディスパッチする
 */

import type { ParallelDevStateType, ParallelDevStateUpdate } from '../state.js';
import type { GlobalTask } from '../../types/index.js';

/**
 * Dispatch Node: instruction.md生成が必要なタスクを抽出
 */
export async function instructionGeneratorDispatchNode(
  state: ParallelDevStateType
): Promise<ParallelDevStateUpdate> {
  console.log('📋 InstructionGeneratorDispatch: タスクを並列ディスパッチ中...');

  // activeSprint.idの必須チェック
  if (!state.activeSprint?.id) {
    console.error('❌ アクティブなスプリントが設定されていません');
    return {
      logs: [{
        timestamp: new Date(),
        level: 'error',
        source: 'InstructionGeneratorDispatch',
        message: 'アクティブなスプリントが設定されていません',
      }],
    };
  }

  // スプリント内のタスクをフィルタリング
  const sprintTasks = (state.globalTasks || []).filter(
    task => state.activeSprint?.taskIds.includes(task.id)
  );

  // instruction.md未生成のタスクを抽出（実行中タスクを除外）
  const tasksNeedingInstruction = sprintTasks.filter(
    task => task.instructionGenerated !== true &&
            task.instructionGenerating !== true  // 実行中タスクを除外（重複防止）
  );

  if (tasksNeedingInstruction.length === 0) {
    console.log('✅ 全タスクのinstruction.md生成完了');
    return {
      logs: [{
        timestamp: new Date(),
        level: 'info',
        source: 'InstructionGeneratorDispatch',
        message: '全タスクのinstruction.md生成完了',
      }],
    };
  }

  // maxEngineers制限を適用
  const maxDispatch = state.config.maxEngineers || 3;
  const tasksToDispatch = tasksNeedingInstruction.slice(0, maxDispatch);

  console.log(
    `📤 ${tasksToDispatch.length}個のタスクを並列ディスパッチ ` +
    `(maxEngineers: ${maxDispatch}, 未生成: ${tasksNeedingInstruction.length}件)`
  );

  return {
    logs: [{
      timestamp: new Date(),
      level: 'info',
      source: 'InstructionGeneratorDispatch',
      message: `${tasksToDispatch.length}個のタスクをディスパッチ`,
      data: {
        taskIds: tasksToDispatch.map(t => t.id),
        totalTasks: sprintTasks.length,
        pendingTasks: tasksNeedingInstruction.length,
      },
    }],
  };
}

/**
 * Dispatch Router: 未生成タスクの有無で分岐
 *
 * - 未生成タスクあり → 'generate' (instruction_generatorへfan-out)
 * - 全タスク生成完了 → 'complete' (instruction_aggregatorへ)
 */
export function instructionGeneratorDispatchRouter(
  state: ParallelDevStateType
): string {
  if (!state.activeSprint?.id) {
    console.log('➡️ ルーティング: END (スプリントなし)');
    return 'END';
  }

  const sprintTasks = (state.globalTasks || []).filter(
    task => state.activeSprint?.taskIds.includes(task.id)
  );

  const tasksNeedingInstruction = sprintTasks.filter(
    task => task.instructionGenerated !== true &&
            task.instructionGenerating !== true  // 実行中タスクを除外（重複防止）
  );

  if (tasksNeedingInstruction.length === 0) {
    console.log('➡️ ルーティング: instruction_aggregator (全生成完了)');
    return 'complete';
  }

  console.log(
    `➡️ ルーティング: instruction_generator (未生成: ${tasksNeedingInstruction.length}件)`
  );
  return 'generate';
}
