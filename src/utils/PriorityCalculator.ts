/**
 * PriorityCalculator
 *
 * スプリント駆動開発における動的優先度計算を担当
 *
 * 優先度計算式:
 * dynamicPriority = basePriority * 0.5 + recencyBonus * 0.3 + dependencyBonus * 0.2
 *
 * - basePriority: タスクの基本優先度（0-1000）
 * - recencyBonus: リクエストの新しさに基づくボーナス（0-100）
 * - dependencyBonus: 依存関係の解決状況に基づくボーナス（0-100）
 */

import type { GlobalTask, ProjectMetadata } from '../types/index.js';

export class PriorityCalculator {
  /**
   * リクエストの新しさに基づくボーナスを計算
   *
   * @param requestTimestamp - タスクのリクエストタイムスタンプ
   * @param allProjects - 全プロジェクトのメタデータ
   * @returns 0-100のスケールでのrecencyBonus
   */
  static calculateRecencyBonus(
    requestTimestamp: Date,
    allProjects: Map<string, ProjectMetadata>
  ): number {
    const timestamps = Array.from(allProjects.values()).map(p => p.requestTimestamp.getTime());

    if (timestamps.length === 0) {
      return 50; // デフォルト値
    }

    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);
    const currentTimestamp = requestTimestamp.getTime();

    // タイムスタンプが全て同じ場合
    if (maxTimestamp === minTimestamp) {
      return 100; // 最新として扱う
    }

    // 線形スケーリング: 最新のリクエストが100、最古が0
    const normalized = (currentTimestamp - minTimestamp) / (maxTimestamp - minTimestamp);
    return Math.round(normalized * 100);
  }

  /**
   * 依存関係の解決状況に基づくボーナスを計算
   *
   * @param task - 対象タスク
   * @param allTasks - 全タスクのリスト
   * @returns 0-100のスケールでのdependencyBonus
   */
  static calculateDependencyBonus(
    task: GlobalTask,
    allTasks: GlobalTask[]
  ): number {
    const dependencies = task.dependencies || [];

    // 依存関係がない場合は最大ボーナス
    if (dependencies.length === 0) {
      return 100;
    }

    // 依存タスクの完了状況を評価
    const taskMap = new Map(allTasks.map(t => [t.id, t]));
    let completedCount = 0;

    for (const depId of dependencies) {
      const depTask = taskMap.get(depId);
      if (depTask && depTask.status === 'completed') {
        completedCount++;
      }
    }

    // 完了率をボーナスに変換
    const completionRate = completedCount / dependencies.length;
    return Math.round(completionRate * 100);
  }

  /**
   * 動的優先度を計算
   *
   * @param task - 対象タスク
   * @param allTasks - 全タスクのリスト
   * @param allProjects - 全プロジェクトのメタデータ
   * @returns 0-1000のスケールでのdynamicPriority
   */
  static calculateDynamicPriority(
    task: GlobalTask,
    allTasks: GlobalTask[],
    allProjects: Map<string, ProjectMetadata>
  ): number {
    const basePriority = task.priority || 0; // 0-1000
    const recencyBonus = this.calculateRecencyBonus(task.requestTimestamp, allProjects);
    const dependencyBonus = this.calculateDependencyBonus(task, allTasks);

    // 優先度計算式
    const dynamicPriority =
      basePriority * 0.5 +
      recencyBonus * 0.3 +
      dependencyBonus * 0.2;

    return Math.round(dynamicPriority);
  }

  /**
   * 複数のタスクの動的優先度を一括計算し、優先度順にソート
   *
   * @param tasks - タスクのリスト
   * @param allProjects - 全プロジェクトのメタデータ
   * @returns 優先度順にソートされたタスクリスト（高い順）
   */
  static calculateAndSortTasks(
    tasks: GlobalTask[],
    allProjects: Map<string, ProjectMetadata>
  ): GlobalTask[] {
    // 各タスクの動的優先度を計算
    const tasksWithPriority = tasks.map(task => ({
      ...task,
      dynamicPriority: this.calculateDynamicPriority(task, tasks, allProjects)
    }));

    // 優先度順にソート（降順）
    return tasksWithPriority.sort((a, b) => b.dynamicPriority - a.dynamicPriority);
  }

  /**
   * 継続モードの検出
   *
   * ⚠️ このメソッドは廃止予定
   *
   * 継続モード判定は CheckModeNode で AI に判断させる必要があります。
   * 文字列パターンマッチングは使用しないでください。
   *
   * @deprecated CheckModeNodeのAI判定を使用してください
   * @param userRequest - ユーザーリクエスト文字列
   * @returns 継続モードかどうか
   */
  static detectContinuationMode(userRequest: string): boolean {
    throw new Error(
      'detectContinuationMode() is deprecated. Use AI-driven detection in CheckModeNode instead.'
    );
  }

  /**
   * プロジェクトの優先度を再計算
   *
   * 新しいリクエストが追加された際や、タスクの状態が変化した際に呼び出す
   *
   * @param tasks - 全グローバルタスク
   * @param allProjects - 全プロジェクトのメタデータ
   * @returns 優先度が更新されたタスクリスト
   */
  static recalculateAllPriorities(
    tasks: GlobalTask[],
    allProjects: Map<string, ProjectMetadata>
  ): GlobalTask[] {
    return tasks.map(task => ({
      ...task,
      dynamicPriority: this.calculateDynamicPriority(task, tasks, allProjects)
    }));
  }
}
