/**
 * DataPersistence
 *
 * スプリント駆動開発のデータ永続化マネージャー
 *
 * 管理対象:
 * - グローバルタスクキュー: .kugutsu/tasks/global-queue.json
 * - スプリント情報: .kugutsu/sprints/
 * - プロジェクトメタデータ: .kugutsu/projects/{projectId}/project.json
 */

import path from 'path';
import type { GlobalTask, ProjectMetadata, Sprint } from '../types/index.js';
import { FileSystemManager } from './FileSystemManager.js';

export interface GlobalQueueData {
  tasks: GlobalTask[];
  lastUpdated: string; // ISO 8601 timestamp
}

export interface SprintHistoryData {
  sprints: Sprint[];
  lastUpdated: string;
}

export class DataPersistence {
  private baseRepoPath: string;
  private kugutsuDir: string;
  private tasksDir: string;
  private sprintsDir: string;
  private projectsDir: string;

  constructor(baseRepoPath: string) {
    this.baseRepoPath = baseRepoPath;
    this.kugutsuDir = path.join(baseRepoPath, '.kugutsu');
    this.tasksDir = path.join(this.kugutsuDir, 'tasks');
    this.sprintsDir = path.join(this.kugutsuDir, 'sprints');
    this.projectsDir = path.join(this.kugutsuDir, 'projects');
  }

  /**
   * 必要なディレクトリ構造を初期化
   */
  async initialize(): Promise<void> {
    await FileSystemManager.ensureDirectory(this.kugutsuDir);
    await FileSystemManager.ensureDirectory(this.tasksDir);
    await FileSystemManager.ensureDirectory(this.sprintsDir);
    await FileSystemManager.ensureDirectory(this.projectsDir);
  }

  // ========================================
  // グローバルタスクキュー
  // ========================================

  /**
   * グローバルタスクキューを読み込む
   *
   * @returns グローバルタスクの配列
   */
  async loadGlobalQueue(): Promise<GlobalTask[]> {
    const filePath = path.join(this.tasksDir, 'global-queue.json');
    const data = await FileSystemManager.readJSONSafe<GlobalQueueData>(filePath, {
      tasks: [],
      lastUpdated: new Date().toISOString()
    });

    // Date型に変換
    return data.tasks.map(task => ({
      ...task,
      requestTimestamp: new Date(task.requestTimestamp)
    }));
  }

  /**
   * グローバルタスクキューを保存
   *
   * @param tasks - 保存するタスクの配列
   */
  async saveGlobalQueue(tasks: GlobalTask[]): Promise<void> {
    const filePath = path.join(this.tasksDir, 'global-queue.json');
    const data: GlobalQueueData = {
      tasks,
      lastUpdated: new Date().toISOString()
    };
    await FileSystemManager.writeJSON(filePath, data);
  }

  // ========================================
  // スプリント管理
  // ========================================

  /**
   * アクティブなスプリントを読み込む
   *
   * @returns アクティブなスプリント、または null
   */
  async loadActiveSprint(): Promise<Sprint | null> {
    const filePath = path.join(this.sprintsDir, 'active-sprint.json');
    const sprint = await FileSystemManager.readJSONSafe<Sprint | null>(filePath, null);

    if (!sprint) {
      return null;
    }

    // Date型に変換
    return {
      ...sprint,
      startedAt: sprint.startedAt ? new Date(sprint.startedAt) : undefined,
      completedAt: sprint.completedAt ? new Date(sprint.completedAt) : undefined
    };
  }

  /**
   * アクティブなスプリントを保存
   *
   * @param sprint - 保存するスプリント、または null（クリア）
   */
  async saveActiveSprint(sprint: Sprint | null): Promise<void> {
    const filePath = path.join(this.sprintsDir, 'active-sprint.json');
    await FileSystemManager.writeJSON(filePath, sprint);
  }

  /**
   * スプリント履歴を読み込む
   *
   * @returns 完了したスプリントの配列
   */
  async loadSprintHistory(): Promise<Sprint[]> {
    const filePath = path.join(this.sprintsDir, 'sprint-history.json');
    const data = await FileSystemManager.readJSONSafe<SprintHistoryData>(filePath, {
      sprints: [],
      lastUpdated: new Date().toISOString()
    });

    // Date型に変換
    return data.sprints.map(sprint => ({
      ...sprint,
      startedAt: sprint.startedAt ? new Date(sprint.startedAt) : undefined,
      completedAt: sprint.completedAt ? new Date(sprint.completedAt) : undefined
    }));
  }

  /**
   * スプリント履歴を保存
   *
   * @param sprints - 保存するスプリントの配列
   */
  async saveSprintHistory(sprints: Sprint[]): Promise<void> {
    const filePath = path.join(this.sprintsDir, 'sprint-history.json');
    const data: SprintHistoryData = {
      sprints,
      lastUpdated: new Date().toISOString()
    };
    await FileSystemManager.writeJSON(filePath, data);
  }

  /**
   * スプリントを履歴に追加
   *
   * @param sprint - 追加するスプリント
   */
  async addToSprintHistory(sprint: Sprint): Promise<void> {
    const history = await this.loadSprintHistory();
    history.push(sprint);
    await this.saveSprintHistory(history);
  }

  // ========================================
  // プロジェクトメタデータ
  // ========================================

  /**
   * プロジェクトメタデータを読み込む
   *
   * @param projectId - プロジェクトID
   * @returns プロジェクトメタデータ、または null
   */
  async loadProjectMetadata(projectId: string): Promise<ProjectMetadata | null> {
    const filePath = path.join(this.projectsDir, projectId, 'project.json');
    const metadata = await FileSystemManager.readJSONSafe<ProjectMetadata | null>(filePath, null);

    if (!metadata) {
      return null;
    }

    // Date型に変換
    return {
      ...metadata,
      requestTimestamp: new Date(metadata.requestTimestamp)
    };
  }

  /**
   * プロジェクトメタデータを保存
   *
   * @param projectId - プロジェクトID
   * @param metadata - プロジェクトメタデータ
   */
  async saveProjectMetadata(projectId: string, metadata: ProjectMetadata): Promise<void> {
    const projectDir = path.join(this.projectsDir, projectId);
    await FileSystemManager.ensureDirectory(projectDir);

    const filePath = path.join(projectDir, 'project.json');
    await FileSystemManager.writeJSON(filePath, metadata);
  }

  /**
   * 全てのプロジェクトメタデータを読み込む
   *
   * @returns プロジェクトIDをキーとするMap
   */
  async loadAllProjectMetadata(): Promise<Map<string, ProjectMetadata>> {
    const projectIds = await FileSystemManager.listFiles(this.projectsDir);
    const projects = new Map<string, ProjectMetadata>();

    for (const projectId of projectIds) {
      const metadata = await this.loadProjectMetadata(projectId);
      if (metadata) {
        projects.set(projectId, metadata);
      }
    }

    return projects;
  }

  // ========================================
  // ユーティリティ
  // ========================================

  /**
   * 全データをクリア（テスト用）
   */
  async clearAll(): Promise<void> {
    await FileSystemManager.remove(this.tasksDir);
    await FileSystemManager.remove(this.sprintsDir);
    await this.initialize();
  }

  /**
   * プロジェクトデータをクリア
   *
   * @param projectId - プロジェクトID
   */
  async clearProject(projectId: string): Promise<void> {
    const projectDir = path.join(this.projectsDir, projectId);
    await FileSystemManager.remove(projectDir);
  }
}
