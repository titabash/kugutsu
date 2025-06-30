import { Task } from '../types';

/**
 * タスクノードの内部表現
 */
interface TaskNode {
  task: Task;
  dependencies: Set<string>;  // このタスクが依存するタスクIDのセット
  dependents: Set<string>;    // このタスクに依存するタスクIDのセット
  status: 'waiting' | 'ready' | 'running' | 'developed' | 'reviewing' | 'merging' | 'merged' | 'failed';
}

/**
 * 依存関係管理クラス
 * タスク間の依存関係を管理し、実行可能なタスクを判定する
 */
export class DependencyManager {
  private taskGraph: Map<string, TaskNode> = new Map();
  private completedTasks: Set<string> = new Set();
  private failedTasks: Set<string> = new Set();
  private runningTasks: Set<string> = new Set();
  private developedTasks: Set<string> = new Set();
  private reviewingTasks: Set<string> = new Set();
  private mergingTasks: Set<string> = new Set();
  private mergedTasks: Set<string> = new Set();

  /**
   * 依存関係グラフを構築
   */
  buildDependencyGraph(tasks: Task[]): void {
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
      for (const depId of node.dependencies) {
        const depNode = this.taskGraph.get(depId);
        if (depNode) {
          depNode.dependents.add(taskId);
        } else {
          console.warn(`Warning: Task ${taskId} depends on non-existent task ${depId}`);
        }
      }
    }

    // 初期状態を設定
    this.updateTaskStatuses();
  }

  /**
   * 実行可能なタスクを取得
   */
  getReadyTasks(): Task[] {
    const readyTasks: Task[] = [];
    
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
  markRunning(taskId: string): void {
    const node = this.taskGraph.get(taskId);
    if (node && node.status === 'ready') {
      node.status = 'running';
      this.runningTasks.add(taskId);
    }
  }

  /**
   * タスクを開発完了としてマーク
   */
  markDeveloped(taskId: string): void {
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
  markReviewing(taskId: string): void {
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
  markMerging(taskId: string): void {
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
  markMerged(taskId: string): Task[] {
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
    const newReadyTasks: Task[] = [];
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
  markCompleted(taskId: string): Task[] {
    // 互換性のため、markMergedを呼び出す
    return this.markMerged(taskId);
  }

  /**
   * タスク失敗を通知
   * @returns 影響を受けるタスク
   */
  markFailed(taskId: string): Task[] {
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
    const affectedTasks: Task[] = [];
    const visited = new Set<string>();

    const collectDependents = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      const taskNode = this.taskGraph.get(id);
      if (!taskNode) return;

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
  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (taskId: string): boolean => {
      visited.add(taskId);
      recursionStack.add(taskId);
      path.push(taskId);

      const node = this.taskGraph.get(taskId);
      if (!node) return false;

      for (const depId of node.dependencies) {
        if (!visited.has(depId)) {
          if (dfs(depId)) {
            return true;
          }
        } else if (recursionStack.has(depId)) {
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
  private canExecute(taskId: string): boolean {
    const node = this.taskGraph.get(taskId);
    if (!node) return false;

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
  private updateTaskStatuses(): void {
    for (const [taskId, node] of this.taskGraph) {
      if (node.status === 'waiting' && this.canExecute(taskId)) {
        node.status = 'ready';
      }
    }
  }

  /**
   * タスクの依存関係ステータスを取得
   */
  getTaskDependencyStatus(taskId: string): {
    blockedBy: string[];
    waitingFor: string[];
    failedDependencies: string[];
  } | null {
    const node = this.taskGraph.get(taskId);
    if (!node) return null;

    const blockedBy: string[] = [];
    const waitingFor: string[] = [];
    const failedDependencies: string[] = [];

    for (const depId of node.dependencies) {
      if (this.failedTasks.has(depId)) {
        failedDependencies.push(depId);
      } else if (!this.mergedTasks.has(depId)) {
        // マージが完了していない依存タスク
        if (this.runningTasks.has(depId) || 
            this.developedTasks.has(depId) || 
            this.reviewingTasks.has(depId) || 
            this.mergingTasks.has(depId)) {
          waitingFor.push(depId);
        } else {
          blockedBy.push(depId);
        }
      }
    }

    return { blockedBy, waitingFor, failedDependencies };
  }

  /**
   * 現在の状態のサマリーを取得
   */
  getStatusSummary(): {
    total: number;
    waiting: number;
    ready: number;
    running: number;
    completed: number;
    failed: number;
    developed?: number;
    reviewing?: number;
    merging?: number;
    merged?: number;
  } {
    let waiting = 0, ready = 0, running = 0, completed = 0, failed = 0;
    let developed = 0, reviewing = 0, merging = 0, merged = 0;

    for (const node of this.taskGraph.values()) {
      switch (node.status) {
        case 'waiting': waiting++; break;
        case 'ready': ready++; break;
        case 'running': running++; break;
        case 'developed': developed++; break;
        case 'reviewing': reviewing++; break;
        case 'merging': merging++; break;
        case 'merged': merged++; completed++; break;  // mergedもcompletedにカウント（互換性のため）
        case 'failed': failed++; break;
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