/**
 * Task State Machine
 *
 * タスクステータスの状態遷移ルールを管理
 * 5列Kanbanステータス (pending, in_progress, in_review, completed, failed) の
 * 遷移バリデーションと実行を提供
 */

import type { Task, TaskStatus } from '../graph/types.js';

/**
 * 状態遷移ルール定義
 */
export interface StateTransitionRule {
  from: TaskStatus;
  to: TaskStatus;
  validate: (task: Task, context?: any) => boolean;
  description: string;
}

/**
 * 無効な状態遷移エラー
 */
export class InvalidStateTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStateTransitionError';
  }
}

/**
 * タスクステータス状態マシン
 * 状態遷移のバリデーションと実行を管理
 */
export class TaskStateMachine {
  /**
   * 許可された状態遷移のマップ
   *
   * 遷移ルール:
   * - pending → in_progress: 依存関係解決・worktree作成・Engineer割り当て時
   * - in_progress → in_review: 実装完了時
   * - in_progress → failed: 実装エラー時
   * - in_review → in_progress: レビュー変更要求時
   * - in_review → completed: レビュー承認時
   * - failed → pending: リトライ時
   * - completed → (なし): 終端状態、遷移不可
   */
  private static readonly transitions: Map<TaskStatus, TaskStatus[]> = new Map([
    ['pending', ['in_progress']],
    ['in_progress', ['in_review', 'failed']],
    ['in_review', ['in_progress', 'completed']],
    ['failed', ['pending']],
    ['completed', []], // 終端状態: 遷移不可
  ]);

  /**
   * 状態遷移が可能かチェック
   *
   * @param from - 現在のステータス
   * @param to - 遷移先ステータス
   * @returns 遷移可能であればtrue
   */
  static canTransition(from: TaskStatus, to: TaskStatus): boolean {
    const allowedTransitions = this.transitions.get(from);
    return allowedTransitions?.includes(to) || false;
  }

  /**
   * 状態遷移をバリデーション（例外スロー）
   *
   * @param task - 対象タスク
   * @param newStatus - 遷移先ステータス
   * @throws {InvalidStateTransitionError} 無効な遷移の場合
   */
  static validateTransition(task: Task, newStatus: TaskStatus): void {
    if (!this.canTransition(task.status, newStatus)) {
      throw new InvalidStateTransitionError(
        `Invalid status transition: ${task.status} → ${newStatus} for task ${task.id}`
      );
    }
  }

  /**
   * 安全な状態遷移実行
   *
   * @param task - 対象タスク
   * @param newStatus - 遷移先ステータス
   * @param context - 追加コンテキスト（オプション）
   * @returns 更新されたタスク
   * @throws {InvalidStateTransitionError} 無効な遷移の場合
   * @throws {Error} 遷移条件が満たされていない場合
   */
  static transition(task: Task, newStatus: TaskStatus, context?: any): Task {
    this.validateTransition(task, newStatus);

    // 遷移ごとの追加処理
    const updatedTask: Task = {
      ...task,
      status: newStatus,
      updatedAt: new Date(),
    };

    switch (`${task.status}->${newStatus}`) {
      case 'pending->in_progress':
        // 依存関係が解決されていることを確認（呼び出し元で確認済みと想定）
        // worktreePath, branchNameは呼び出し元で設定済みと仮定
        if (!updatedTask.worktreePath || !updatedTask.branchName) {
          throw new Error(
            `worktreePath and branchName must be set before transitioning to in_progress for task ${task.id}`
          );
        }
        break;

      case 'in_progress->in_review':
        // sessionIdが設定されていることを確認
        if (!updatedTask.sessionId) {
          // sessionIdがなくても遷移を許可（Engineerノードで設定されない場合がある）
          console.warn(
            `Warning: Task ${task.id} transitioning to in_review without sessionId`
          );
        }
        break;

      case 'in_progress->failed':
        // エラー情報が設定されていることを確認
        if (!updatedTask.error) {
          console.warn(
            `⚠️  Warning: Task ${task.id} transitioning to failed without error message. Setting default error.`
          );
          console.warn(`   Task details:`, JSON.stringify({
            id: task.id,
            title: task.title,
            status: task.status,
            worktreePath: task.worktreePath,
            sessionId: task.sessionId,
          }, null, 2));

          // デフォルトのエラーを設定（エラー情報の欠落を防ぐ）
          updatedTask.error = new Error('タスク実行中にエラーが発生しましたが、詳細情報が取得できませんでした');
        }
        break;

      case 'in_review->in_progress':
        // レビュー変更要求時は特別な処理なし
        break;

      case 'in_review->completed':
        // 完了処理（呼び出し元でcompletedTasksに追加する）
        break;

      case 'failed->pending':
        // リセット処理: worktree情報とセッション情報をクリア
        updatedTask.worktreePath = undefined;
        updatedTask.branchName = undefined;
        updatedTask.sessionId = undefined;
        updatedTask.assignedEngineer = undefined;
        updatedTask.error = undefined;
        break;

      default:
        // その他の遷移は追加処理なし
        break;
    }

    return updatedTask;
  }

  /**
   * pending タスクの依存関係チェック
   *
   * すべての依存タスクがcompletedであることを確認
   *
   * Note: 名前は歴史的理由で "canMoveToReady" ですが、
   * 実際には依存関係が解決されているかをチェックしています。
   * pending → in_progress への遷移前に使用されます。
   *
   * @param task - 対象タスク
   * @param allTasks - 全タスクリスト
   * @returns 依存関係が解決されていればtrue
   */
  static canMoveToReady(task: Task, allTasks: Task[]): boolean {
    if (task.status !== 'pending') return false;

    // 依存関係がない場合は実行可能
    if (task.dependencies.length === 0) return true;

    // すべての依存タスクがcompletedであること
    return task.dependencies.every((depId) => {
      const depTask = allTasks.find((t) => t.id === depId);
      return depTask && depTask.status === 'completed';
    });
  }

  /**
   * 許可された次のステータス一覧を取得
   *
   * @param currentStatus - 現在のステータス
   * @returns 遷移可能なステータスの配列
   */
  static getNextStates(currentStatus: TaskStatus): TaskStatus[] {
    return this.transitions.get(currentStatus) || [];
  }

  /**
   * 状態マシンのグラフ表現を取得（デバッグ用）
   *
   * Graphviz DOT形式で状態遷移図を生成
   *
   * @returns DOT形式の状態遷移図
   */
  static getStateMachineGraph(): string {
    let graph = 'digraph TaskStateMachine {\n';
    graph += '  rankdir=LR;\n';
    graph += '  node [shape=box, style=rounded];\n\n';

    // ステータスノードの定義（色分け）
    graph += '  pending [fillcolor=gray, style="rounded,filled"];\n';
    graph += '  in_progress [fillcolor=yellow, style="rounded,filled"];\n';
    graph += '  in_review [fillcolor=orange, style="rounded,filled"];\n';
    graph += '  completed [fillcolor=green, style="rounded,filled"];\n';
    graph += '  failed [fillcolor=red, style="rounded,filled"];\n\n';

    // 遷移エッジの定義
    this.transitions.forEach((toStates, fromState) => {
      toStates.forEach((toState) => {
        graph += `  ${fromState} -> ${toState};\n`;
      });
    });

    graph += '}';
    return graph;
  }

  /**
   * タスクの状態整合性をチェック
   *
   * @param tasks - チェック対象のタスクリスト
   * @throws {Error} 整合性違反が見つかった場合
   */
  static validateTaskConsistency(tasks: Task[]): void {
    tasks.forEach((task) => {
      // completedタスクの依存関係チェック
      if (task.status === 'completed') {
        task.dependencies.forEach((depId) => {
          const dep = tasks.find((t) => t.id === depId);
          if (!dep) {
            throw new Error(
              `Inconsistent state: task ${task.id} depends on non-existent task ${depId}`
            );
          }
          if (dep.status !== 'completed') {
            throw new Error(
              `Inconsistent state: task ${task.id} is completed but dependency ${depId} is ${dep.status}`
            );
          }
        });
      }

      // in_progressタスクの必須フィールドチェック
      if (task.status === 'in_progress') {
        if (!task.worktreePath || !task.branchName) {
          console.warn(
            `Warning: Task ${task.id} is in_progress but missing worktreePath or branchName`
          );
        }
      }
    });
  }

  /**
   * スプリントに割り当て可能かチェック
   *
   * @param task - 対象タスク
   * @returns 割り当て可能であればtrue
   */
  static canAssignToSprint(task: Task): boolean {
    // completedまたはfailedタスクは割り当て不可
    return task.status !== 'completed' && task.status !== 'failed';
  }

  /**
   * スプリント内の全タスクが完了しているか確認
   *
   * @param tasks - 全タスクリスト
   * @param sprintId - スプリントID
   * @returns 全タスク完了であればtrue
   */
  static validateSprintCompletion(tasks: Task[], sprintId: string): boolean {
    const sprintTasks = tasks.filter(
      (t) => 'sprint' in t && (t as any).sprint === sprintId
    );

    if (sprintTasks.length === 0) {
      return false; // タスクがない場合は未完了扱い
    }

    return sprintTasks.every(
      (t) => t.status === 'completed' || t.status === 'failed'
    );
  }
}
