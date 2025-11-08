import type { TaskArtifact, TaskStatus as ArtifactTaskStatus } from '../types/artifacts.js';
import type { Task, TaskStatus } from '../graph/types.js';

/**
 * TaskConverter
 *
 * TaskArtifact (ファイル用) と Task (State用) の相互変換を行うユーティリティクラス。
 *
 * 主な機能:
 * - TaskArtifact → Task 変換（ファイルから読み込んだデータをStateに反映）
 * - Task → TaskArtifact 変換（Stateのデータをファイルに保存）
 * - ステータス変換（ファイル用とState用で異なるステータス体系を変換）
 * - 依存関係の解決判定
 */
export class TaskConverter {
  /**
   * TaskArtifact (ファイル) を Task (State) に変換する
   *
   * @param artifact ファイルから読み込んだTaskArtifact
   * @param existingTasks 既存のタスク一覧（依存関係解決に使用）
   * @returns State用のTask
   */
  static toStateTask(
    artifact: TaskArtifact,
    existingTasks: Task[] = []
  ): Task {
    // ステータス変換
    const status = this.convertArtifactStatusToStateStatus(
      artifact,
      existingTasks
    );

    // 日時変換: string → Date
    const createdAt = artifact.createdAt
      ? new Date(artifact.createdAt)
      : new Date();
    const updatedAt = artifact.updatedAt
      ? new Date(artifact.updatedAt)
      : new Date();

    return {
      id: artifact.id,
      title: artifact.title,
      description: artifact.description,
      priority: artifact.priority,
      dependencies: artifact.dependencies,
      status,
      worktreePath: artifact.worktreePath,
      branchName: artifact.branchName,
      sessionId: artifact.sessionId,
      createdAt,
      updatedAt,
    };
  }

  /**
   * Task (State) を TaskArtifact (ファイル) に変換する
   *
   * @param task StateのTask
   * @returns ファイル保存用のTaskArtifact
   */
  static toArtifact(task: Task): TaskArtifact {
    // ステータス変換
    const status = this.convertStateStatusToArtifactStatus(task.status);

    // 日時変換: Date → string (ISO 8601)
    const createdAt = task.createdAt
      ? task.createdAt.toISOString()
      : new Date().toISOString();
    const updatedAt = task.updatedAt
      ? task.updatedAt.toISOString()
      : new Date().toISOString();

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      dependencies: task.dependencies,
      status,
      createdAt,
      updatedAt,
      worktreePath: task.worktreePath,
      branchName: task.branchName,
      sessionId: task.sessionId,
    };
  }

  /**
   * タスクが ready 状態に移行可能かどうかを判定する
   *
   * @param artifact 判定対象のTaskArtifact
   * @param existingTasks 既存のタスク一覧
   * @returns 依存関係が全て解決されている場合は true
   */
  static canMoveToReady(
    artifact: TaskArtifact,
    existingTasks: Task[]
  ): boolean {
    // 依存関係がない場合は ready
    if (artifact.dependencies.length === 0) {
      return true;
    }

    // 全ての依存タスクが completed であることを確認
    return artifact.dependencies.every(depId => {
      const depTask = existingTasks.find(t => t.id === depId);
      return depTask && depTask.status === 'completed';
    });
  }

  /**
   * TaskArtifact のステータスを Task のステータスに変換する
   *
   * 変換ルール:
   * - pending → ready (依存関係解決済み) or pending (依存関係未解決)
   * - in_progress → in_progress
   * - implemented → in_review
   * - reviewed → in_review
   * - conflict_detected → in_review
   * - conflict_resolved → in_review
   * - completed → completed
   * - failed → failed
   *
   * @param artifact TaskArtifact
   * @param existingTasks 既存のタスク一覧（依存関係解決に使用）
   * @returns Task のステータス
   */
  private static convertArtifactStatusToStateStatus(
    artifact: TaskArtifact,
    existingTasks: Task[]
  ): TaskStatus {
    switch (artifact.status) {
      case 'pending':
        // 依存関係チェックは EngineerDispatchNode で実行されるため、ここでは pending のまま
        return 'pending';

      case 'in_progress':
        return 'in_progress';

      case 'implemented':
      case 'reviewed':
      case 'conflict_detected':
      case 'conflict_resolved':
        return 'in_review';

      case 'completed':
        return 'completed';

      case 'failed':
        return 'failed';

      default:
        // 未知のステータスは pending として扱う
        return 'pending';
    }
  }

  /**
   * Task のステータスを TaskArtifact のステータスに変換する
   *
   * 変換ルール:
   * - pending → pending
   * - in_progress → in_progress
   * - in_review → implemented
   * - completed → completed
   * - failed → failed
   *
   * @param status Task のステータス
   * @returns TaskArtifact のステータス
   */
  private static convertStateStatusToArtifactStatus(
    status: TaskStatus
  ): ArtifactTaskStatus {
    switch (status) {
      case 'pending':
        return 'pending';

      case 'in_progress':
        return 'in_progress';

      case 'in_review':
        return 'implemented';

      case 'completed':
        return 'completed';

      case 'failed':
        return 'failed';

      default:
        // 未知のステータスは pending として扱う
        return 'pending';
    }
  }
}
