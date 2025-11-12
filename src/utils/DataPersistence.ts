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
  private repositoryDir: string;
  private tasksDir: string;
  private sprintsDir: string;
  private projectsDir: string;

  constructor(baseRepoPath: string) {
    this.baseRepoPath = baseRepoPath;
    this.kugutsuDir = path.join(baseRepoPath, '.kugutsu');
    this.repositoryDir = path.join(this.kugutsuDir, 'repository');
    this.tasksDir = path.join(this.kugutsuDir, 'tasks');
    this.sprintsDir = path.join(this.kugutsuDir, 'sprints');
    this.projectsDir = path.join(this.kugutsuDir, 'projects');
  }

  /**
   * 必要なディレクトリ構造を初期化
   */
  async initialize(): Promise<void> {
    await FileSystemManager.ensureDirectory(this.kugutsuDir);
    await FileSystemManager.ensureDirectory(this.repositoryDir);
    await FileSystemManager.ensureDirectory(path.join(this.repositoryDir, 'architecture'));
    await FileSystemManager.ensureDirectory(path.join(this.repositoryDir, 'standards'));
    await FileSystemManager.ensureDirectory(path.join(this.repositoryDir, 'database'));
    await FileSystemManager.ensureDirectory(path.join(this.repositoryDir, 'api'));
    await FileSystemManager.ensureDirectory(path.join(this.repositoryDir, 'deployment'));
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
  // スクラム開発フロー: ストーリーマッピング
  // ========================================

  /**
   * ストーリーマッピングを保存
   *
   * @param projectId - プロジェクトID
   * @param storyMapping - ストーリーマッピングデータ
   */
  async saveStoryMapping(projectId: string, storyMapping: any): Promise<void> {
    const storyMappingDir = path.join(this.projectsDir, projectId, 'story-mapping');
    await FileSystemManager.ensureDirectory(storyMappingDir);

    const filePath = path.join(storyMappingDir, 'story-map.json');
    await FileSystemManager.writeJSON(filePath, storyMapping);
  }

  /**
   * ストーリーマッピングを読み込み
   *
   * @param projectId - プロジェクトID
   * @returns ストーリーマッピングデータ、または null
   */
  async loadStoryMapping(projectId: string): Promise<any | null> {
    const filePath = path.join(this.projectsDir, projectId, 'story-mapping', 'story-map.json');
    return await FileSystemManager.readJSONSafe(filePath, null);
  }

  /**
   * ストーリーマッピングのMarkdownを保存
   *
   * @param projectId - プロジェクトID
   * @param markdown - Markdownコンテンツ
   */
  async saveStoryMappingMarkdown(projectId: string, markdown: string): Promise<void> {
    const storyMappingDir = path.join(this.projectsDir, projectId, 'story-mapping');
    await FileSystemManager.ensureDirectory(storyMappingDir);

    const filePath = path.join(storyMappingDir, 'story-map.md');
    await FileSystemManager.writeFile(filePath, markdown);
  }

  /**
   * ストーリーマッピングのレビュー履歴を保存
   *
   * @param projectId - プロジェクトID
   * @param reviewHistory - レビュー履歴データ
   */
  async saveStoryMappingReviewHistory(projectId: string, reviewHistory: any): Promise<void> {
    const filePath = path.join(
      this.projectsDir,
      projectId,
      'story-mapping',
      'review-history.json'
    );
    await FileSystemManager.writeJSON(filePath, reviewHistory);
  }

  /**
   * ストーリーマッピングのレビュー履歴を読み込み
   *
   * @param projectId - プロジェクトID
   * @returns レビュー履歴データ
   */
  async loadStoryMappingReviewHistory(projectId: string): Promise<any> {
    const filePath = path.join(
      this.projectsDir,
      projectId,
      'story-mapping',
      'review-history.json'
    );
    return await FileSystemManager.readJSONSafe(filePath, { reviews: [] });
  }

  // ========================================
  // スクラム開発フロー: 設計書
  // ========================================

  /**
   * 設計書のMarkdownを保存
   *
   * @param projectId - プロジェクトID
   * @param markdown - Markdownコンテンツ
   */
  async saveDesignDocsMarkdown(projectId: string, markdown: string): Promise<void> {
    const designDir = path.join(this.projectsDir, projectId, 'design');
    await FileSystemManager.ensureDirectory(designDir);

    const filePath = path.join(designDir, 'design-docs.md');
    await FileSystemManager.writeFile(filePath, markdown);
  }

  /**
   * DB設計を保存
   *
   * @param projectId - プロジェクトID
   * @param schema - DB schemaデータ
   */
  async saveDatabaseSchema(projectId: string, schema: any): Promise<void> {
    const dbDir = path.join(this.projectsDir, projectId, 'design', 'database');
    await FileSystemManager.ensureDirectory(dbDir);

    const filePath = path.join(dbDir, 'schema.json');
    await FileSystemManager.writeJSON(filePath, schema);
  }

  /**
   * DB設計を読み込み
   *
   * @param projectId - プロジェクトID
   * @returns DB schemaデータ、または null
   */
  async loadDatabaseSchema(projectId: string): Promise<any | null> {
    const filePath = path.join(this.projectsDir, projectId, 'design', 'database', 'schema.json');
    return await FileSystemManager.readJSONSafe(filePath, null);
  }

  /**
   * ER図のMarkdownを保存
   *
   * @param projectId - プロジェクトID
   * @param markdown - Markdownコンテンツ（Mermaid含む）
   */
  async saveDatabaseERDiagram(projectId: string, markdown: string): Promise<void> {
    const dbDir = path.join(this.projectsDir, projectId, 'design', 'database');
    await FileSystemManager.ensureDirectory(dbDir);

    const filePath = path.join(dbDir, 'er-diagram.md');
    await FileSystemManager.writeFile(filePath, markdown);
  }

  /**
   * API仕様を保存（OpenAPI形式）
   *
   * @param projectId - プロジェクトID
   * @param apiSpec - API仕様データ
   */
  async saveAPISpec(projectId: string, apiSpec: any): Promise<void> {
    const interfacesDir = path.join(this.projectsDir, projectId, 'design', 'interfaces');
    await FileSystemManager.ensureDirectory(interfacesDir);

    const filePath = path.join(interfacesDir, 'api-spec.json');
    await FileSystemManager.writeJSON(filePath, apiSpec);
  }

  /**
   * API仕様を読み込み
   *
   * @param projectId - プロジェクトID
   * @returns API仕様データ、または null
   */
  async loadAPISpec(projectId: string): Promise<any | null> {
    const filePath = path.join(this.projectsDir, projectId, 'design', 'interfaces', 'api-spec.json');
    return await FileSystemManager.readJSONSafe(filePath, null);
  }

  /**
   * API仕様のMarkdownを保存
   *
   * @param projectId - プロジェクトID
   * @param markdown - Markdownコンテンツ
   */
  async saveAPISpecMarkdown(projectId: string, markdown: string): Promise<void> {
    const interfacesDir = path.join(this.projectsDir, projectId, 'design', 'interfaces');
    await FileSystemManager.ensureDirectory(interfacesDir);

    const filePath = path.join(interfacesDir, 'api-spec.md');
    await FileSystemManager.writeFile(filePath, markdown);
  }

  /**
   * UI/UX画面定義を保存
   *
   * @param projectId - プロジェクトID
   * @param screens - 画面定義データ
   */
  async saveUIUXScreens(projectId: string, screens: any): Promise<void> {
    const uiuxDir = path.join(this.projectsDir, projectId, 'design', 'uiux');
    await FileSystemManager.ensureDirectory(uiuxDir);

    const filePath = path.join(uiuxDir, 'screens.json');
    await FileSystemManager.writeJSON(filePath, screens);
  }

  /**
   * UI/UX画面定義を読み込み
   *
   * @param projectId - プロジェクトID
   * @returns 画面定義データ、または null
   */
  async loadUIUXScreens(projectId: string): Promise<any | null> {
    const filePath = path.join(this.projectsDir, projectId, 'design', 'uiux', 'screens.json');
    return await FileSystemManager.readJSONSafe(filePath, null);
  }

  /**
   * ワイヤーフレームのMarkdownを保存
   *
   * @param projectId - プロジェクトID
   * @param markdown - Markdownコンテンツ（Mermaid含む）
   */
  async saveUIUXWireframes(projectId: string, markdown: string): Promise<void> {
    const uiuxDir = path.join(this.projectsDir, projectId, 'design', 'uiux');
    await FileSystemManager.ensureDirectory(uiuxDir);

    const filePath = path.join(uiuxDir, 'wireframes.md');
    await FileSystemManager.writeFile(filePath, markdown);
  }

  /**
   * 設計書のレビュー履歴を保存
   *
   * @param projectId - プロジェクトID
   * @param reviewHistory - レビュー履歴データ
   */
  async saveDesignReviewHistory(projectId: string, reviewHistory: any): Promise<void> {
    const designDir = path.join(this.projectsDir, projectId, 'design');
    await FileSystemManager.ensureDirectory(designDir);

    const filePath = path.join(designDir, 'review-history.json');
    await FileSystemManager.writeJSON(filePath, reviewHistory);
  }

  /**
   * 設計書のレビュー履歴を読み込み
   *
   * @param projectId - プロジェクトID
   * @returns レビュー履歴データ
   */
  async loadDesignReviewHistory(projectId: string): Promise<any> {
    const filePath = path.join(this.projectsDir, projectId, 'design', 'review-history.json');
    return await FileSystemManager.readJSONSafe(filePath, { reviews: [] });
  }

  // ========================================
  // スクラム開発フロー: タスク管理
  // ========================================

  /**
   * タスクリストを保存
   *
   * @param projectId - プロジェクトID
   * @param taskList - タスクリストデータ
   */
  async saveTaskList(projectId: string, taskList: any): Promise<void> {
    const tasksDir = path.join(this.projectsDir, projectId, 'tasks');
    await FileSystemManager.ensureDirectory(tasksDir);

    const filePath = path.join(tasksDir, 'task-list.json');
    await FileSystemManager.writeJSON(filePath, taskList);
  }

  /**
   * タスクリストを読み込み
   *
   * @param projectId - プロジェクトID
   * @returns タスクリストデータ
   */
  async loadTaskList(projectId: string): Promise<any> {
    const filePath = path.join(this.projectsDir, projectId, 'tasks', 'task-list.json');
    return await FileSystemManager.readJSONSafe(filePath, { tasks: [] });
  }

  /**
   * 依存関係グラフを保存
   *
   * @param projectId - プロジェクトID
   * @param dependencyGraph - 依存関係グラフデータ
   */
  async saveDependencyGraph(projectId: string, dependencyGraph: any): Promise<void> {
    const tasksDir = path.join(this.projectsDir, projectId, 'tasks');
    await FileSystemManager.ensureDirectory(tasksDir);

    const filePath = path.join(tasksDir, 'dependencies.json');
    await FileSystemManager.writeJSON(filePath, dependencyGraph);
  }

  /**
   * 依存関係グラフを読み込み
   *
   * @param projectId - プロジェクトID
   * @returns 依存関係グラフデータ
   */
  async loadDependencyGraph(projectId: string): Promise<any> {
    const filePath = path.join(this.projectsDir, projectId, 'tasks', 'dependencies.json');
    return await FileSystemManager.readJSONSafe(filePath, {
      graph: { nodes: [], edges: [] },
      executionPlan: []
    });
  }

  /**
   * Kanbanステートを保存
   *
   * @param projectId - プロジェクトID
   * @param kanbanState - Kanbanステートデータ
   */
  async saveKanbanState(projectId: string, kanbanState: any): Promise<void> {
    const tasksDir = path.join(this.projectsDir, projectId, 'tasks');
    await FileSystemManager.ensureDirectory(tasksDir);

    const filePath = path.join(tasksDir, 'kanban-state.json');
    await FileSystemManager.writeJSON(filePath, kanbanState);
  }

  /**
   * Kanbanステートを読み込み
   *
   * @param projectId - プロジェクトID
   * @returns Kanbanステートデータ
   */
  async loadKanbanState(projectId: string): Promise<any> {
    const filePath = path.join(this.projectsDir, projectId, 'tasks', 'kanban-state.json');
    return await FileSystemManager.readJSONSafe(filePath, {
      columns: {
        pending: { label: 'Pending', taskIds: [], color: 'amber' },
        ready: { label: 'Ready', taskIds: [], color: 'blue' },
        in_progress: { label: 'In Progress', taskIds: [], color: 'indigo' },
        in_review: { label: 'In Review', taskIds: [], color: 'purple' },
        completed: { label: 'Completed', taskIds: [], color: 'green' },
        failed: { label: 'Failed', taskIds: [], color: 'red' }
      },
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * タスクのレビュー記録を保存
   *
   * @param projectId - プロジェクトID
   * @param taskId - タスクID
   * @param review - レビューデータ
   */
  async saveTaskReview(projectId: string, taskId: string, review: any): Promise<void> {
    const reviewsDir = path.join(this.projectsDir, projectId, 'reviews');
    await FileSystemManager.ensureDirectory(reviewsDir);

    const filePath = path.join(reviewsDir, `${taskId}.json`);
    await FileSystemManager.writeJSON(filePath, review);
  }

  /**
   * タスクのレビュー記録を読み込み
   *
   * @param projectId - プロジェクトID
   * @param taskId - タスクID
   * @returns レビューデータ、または null
   */
  async loadTaskReview(projectId: string, taskId: string): Promise<any | null> {
    const filePath = path.join(this.projectsDir, projectId, 'reviews', `${taskId}.json`);
    return await FileSystemManager.readJSONSafe(filePath, null);
  }

  /**
   * タスクのinstruction.mdを保存
   *
   * @param sprintId - スプリントID
   * @param taskId - タスクID
   * @param content - instruction.mdの内容
   */
  async saveTaskInstruction(
    sprintId: string,
    taskId: string,
    content: string
  ): Promise<void> {
    const taskDir = path.join(this.sprintsDir, sprintId, 'tasks', taskId);
    await FileSystemManager.ensureDirectory(taskDir);

    const filePath = path.join(taskDir, 'instruction.md');
    await FileSystemManager.writeFile(filePath, content);
  }

  /**
   * タスクのinstruction.mdを読み込み
   *
   * @param sprintId - スプリントID
   * @param taskId - タスクID
   * @returns instruction.mdの内容、または null
   */
  async loadTaskInstruction(sprintId: string, taskId: string): Promise<string | null> {
    const filePath = path.join(this.sprintsDir, sprintId, 'tasks', taskId, 'instruction.md');
    return await FileSystemManager.readFileSafe(filePath, null);
  }

  // ========================================
  // リポジトリ仕様（repository/）
  // ========================================

  /**
   * リポジトリメタデータを保存
   *
   * @param metadata - リポジトリメタデータ
   */
  async saveRepositoryMetadata(metadata: any): Promise<void> {
    const filePath = path.join(this.repositoryDir, 'metadata.json');
    await FileSystemManager.writeJSON(filePath, metadata);
  }

  /**
   * リポジトリメタデータを読み込み
   *
   * @returns リポジトリメタデータ、または null
   */
  async loadRepositoryMetadata(): Promise<any | null> {
    const filePath = path.join(this.repositoryDir, 'metadata.json');
    return await FileSystemManager.readJSONSafe(filePath, null);
  }

  /**
   * アーキテクチャ概要（Markdown）を保存
   *
   * @param markdown - アーキテクチャ概要のMarkdown
   */
  async saveArchitectureOverview(markdown: string): Promise<void> {
    const filePath = path.join(this.repositoryDir, 'architecture', 'overview.md');
    await FileSystemManager.writeFile(filePath, markdown);
  }

  /**
   * アーキテクチャ概要を読み込み
   *
   * @returns Markdownコンテンツ、または null
   */
  async loadArchitectureOverview(): Promise<string | null> {
    const filePath = path.join(this.repositoryDir, 'architecture', 'overview.md');
    try {
      return await FileSystemManager.readFile(filePath);
    } catch {
      return null;
    }
  }

  /**
   * 技術スタック定義を保存
   *
   * @param techStack - 技術スタック定義
   */
  async saveTechStack(techStack: any): Promise<void> {
    const filePath = path.join(this.repositoryDir, 'architecture', 'tech-stack.json');
    await FileSystemManager.writeJSON(filePath, techStack);
  }

  /**
   * 技術スタック定義を読み込み
   *
   * @returns 技術スタック定義、または null
   */
  async loadTechStack(): Promise<any | null> {
    const filePath = path.join(this.repositoryDir, 'architecture', 'tech-stack.json');
    return await FileSystemManager.readJSONSafe(filePath, null);
  }

  /**
   * レイヤー構造（Markdown）を保存
   *
   * @param markdown - レイヤー構造のMarkdown
   */
  async saveArchitectureLayers(markdown: string): Promise<void> {
    const filePath = path.join(this.repositoryDir, 'architecture', 'layers.md');
    await FileSystemManager.writeFile(filePath, markdown);
  }

  /**
   * レイヤー構造を読み込み
   *
   * @returns Markdownコンテンツ、または null
   */
  async loadArchitectureLayers(): Promise<string | null> {
    const filePath = path.join(this.repositoryDir, 'architecture', 'layers.md');
    try {
      return await FileSystemManager.readFile(filePath);
    } catch {
      return null;
    }
  }

  /**
   * コーディング規約（Markdown）を保存
   *
   * @param markdown - コーディング規約のMarkdown
   */
  async saveCodingStandards(markdown: string): Promise<void> {
    const filePath = path.join(this.repositoryDir, 'standards', 'coding-standards.md');
    await FileSystemManager.writeFile(filePath, markdown);
  }

  /**
   * コーディング規約を読み込み
   *
   * @returns Markdownコンテンツ、または null
   */
  async loadCodingStandards(): Promise<string | null> {
    const filePath = path.join(this.repositoryDir, 'standards', 'coding-standards.md');
    try {
      return await FileSystemManager.readFile(filePath);
    } catch {
      return null;
    }
  }

  /**
   * 命名規則（Markdown）を保存
   *
   * @param markdown - 命名規則のMarkdown
   */
  async saveNamingConventions(markdown: string): Promise<void> {
    const filePath = path.join(this.repositoryDir, 'standards', 'naming-conventions.md');
    await FileSystemManager.writeFile(filePath, markdown);
  }

  /**
   * 命名規則を読み込み
   *
   * @returns Markdownコンテンツ、または null
   */
  async loadNamingConventions(): Promise<string | null> {
    const filePath = path.join(this.repositoryDir, 'standards', 'naming-conventions.md');
    try {
      return await FileSystemManager.readFile(filePath);
    } catch {
      return null;
    }
  }

  /**
   * セキュリティポリシー（Markdown）を保存
   *
   * @param markdown - セキュリティポリシーのMarkdown
   */
  async saveSecurityPolicy(markdown: string): Promise<void> {
    const filePath = path.join(this.repositoryDir, 'standards', 'security-policy.md');
    await FileSystemManager.writeFile(filePath, markdown);
  }

  /**
   * セキュリティポリシーを読み込み
   *
   * @returns Markdownコンテンツ、または null
   */
  async loadSecurityPolicy(): Promise<string | null> {
    const filePath = path.join(this.repositoryDir, 'standards', 'security-policy.md');
    try {
      return await FileSystemManager.readFile(filePath);
    } catch {
      return null;
    }
  }

  /**
   * リポジトリ全体のDB設計を保存
   *
   * @param schema - DB schema
   */
  async saveRepositoryDatabaseSchema(schema: any): Promise<void> {
    const filePath = path.join(this.repositoryDir, 'database', 'schema.json');
    await FileSystemManager.writeJSON(filePath, schema);
  }

  /**
   * リポジトリ全体のDB設計を読み込み
   *
   * @returns DB schema、または null
   */
  async loadRepositoryDatabaseSchema(): Promise<any | null> {
    const filePath = path.join(this.repositoryDir, 'database', 'schema.json');
    return await FileSystemManager.readJSONSafe(filePath, null);
  }

  /**
   * リポジトリ全体のER図（Markdown）を保存
   *
   * @param markdown - ER図のMarkdown
   */
  async saveRepositoryERDiagram(markdown: string): Promise<void> {
    const filePath = path.join(this.repositoryDir, 'database', 'er-diagram.md');
    await FileSystemManager.writeFile(filePath, markdown);
  }

  /**
   * リポジトリ全体のER図を読み込み
   *
   * @returns Markdownコンテンツ、または null
   */
  async loadRepositoryERDiagram(): Promise<string | null> {
    const filePath = path.join(this.repositoryDir, 'database', 'er-diagram.md');
    try {
      return await FileSystemManager.readFile(filePath);
    } catch {
      return null;
    }
  }

  /**
   * リポジトリ全体のAPI仕様を保存
   *
   * @param apiSpec - API仕様（OpenAPI形式）
   */
  async saveRepositoryAPISpec(apiSpec: any): Promise<void> {
    const filePath = path.join(this.repositoryDir, 'api', 'api-spec.json');
    await FileSystemManager.writeJSON(filePath, apiSpec);
  }

  /**
   * リポジトリ全体のAPI仕様を読み込み
   *
   * @returns API仕様、または null
   */
  async loadRepositoryAPISpec(): Promise<any | null> {
    const filePath = path.join(this.repositoryDir, 'api', 'api-spec.json');
    return await FileSystemManager.readJSONSafe(filePath, null);
  }

  /**
   * リポジトリ全体のAPI仕様（Markdown）を保存
   *
   * @param markdown - API仕様のMarkdown
   */
  async saveRepositoryAPISpecMarkdown(markdown: string): Promise<void> {
    const filePath = path.join(this.repositoryDir, 'api', 'api-spec.md');
    await FileSystemManager.writeFile(filePath, markdown);
  }

  /**
   * リポジトリ全体のAPI仕様（Markdown）を読み込み
   *
   * @returns Markdownコンテンツ、または null
   */
  async loadRepositoryAPISpecMarkdown(): Promise<string | null> {
    const filePath = path.join(this.repositoryDir, 'api', 'api-spec.md');
    try {
      return await FileSystemManager.readFile(filePath);
    } catch {
      return null;
    }
  }

  /**
   * デプロイメント環境定義を保存
   *
   * @param environments - 環境定義
   */
  async saveDeploymentEnvironments(environments: any): Promise<void> {
    const filePath = path.join(this.repositoryDir, 'deployment', 'environments.json');
    await FileSystemManager.writeJSON(filePath, environments);
  }

  /**
   * デプロイメント環境定義を読み込み
   *
   * @returns 環境定義、または null
   */
  async loadDeploymentEnvironments(): Promise<any | null> {
    const filePath = path.join(this.repositoryDir, 'deployment', 'environments.json');
    return await FileSystemManager.readJSONSafe(filePath, null);
  }

  /**
   * CI/CD設計（Markdown）を保存
   *
   * @param markdown - CI/CD設計のMarkdown
   */
  async saveCICDDesign(markdown: string): Promise<void> {
    const filePath = path.join(this.repositoryDir, 'deployment', 'ci-cd.md');
    await FileSystemManager.writeFile(filePath, markdown);
  }

  /**
   * CI/CD設計を読み込み
   *
   * @returns Markdownコンテンツ、または null
   */
  async loadCICDDesign(): Promise<string | null> {
    const filePath = path.join(this.repositoryDir, 'deployment', 'ci-cd.md');
    try {
      return await FileSystemManager.readFile(filePath);
    } catch {
      return null;
    }
  }

  // ========================================
  // Product Backlog管理
  // ========================================

  /**
   * Product Backlogを保存
   *
   * @param backlog - Product Backlogデータ
   */
  async saveProductBacklog(backlog: any): Promise<void> {
    const productBacklogDir = path.join(this.kugutsuDir, 'product-backlog');
    await FileSystemManager.ensureDirectory(productBacklogDir);

    const filePath = path.join(productBacklogDir, 'backlog.json');
    await FileSystemManager.writeJSON(filePath, backlog);
  }

  /**
   * Product Backlogを読み込み
   *
   * @returns Product Backlogデータ、または null
   */
  async loadProductBacklog(): Promise<any | null> {
    const filePath = path.join(this.kugutsuDir, 'product-backlog', 'backlog.json');
    return await FileSystemManager.readJSONSafe(filePath, null);
  }

  // ========================================
  // Sprint Backlog管理
  // ========================================

  /**
   * Sprint Backlogを保存
   *
   * @param sprintId - スプリントID（例: "sprint-1"）
   * @param backlog - Sprint Backlogデータ
   */
  async saveSprintBacklog(sprintId: string, backlog: any): Promise<void> {
    const sprintDir = path.join(this.sprintsDir, sprintId);
    await FileSystemManager.ensureDirectory(sprintDir);

    const filePath = path.join(sprintDir, 'sprint-backlog.json');
    await FileSystemManager.writeJSON(filePath, backlog);
  }

  /**
   * Sprint Backlogを読み込み
   *
   * @param sprintId - スプリントID（例: "sprint-1"）
   * @returns Sprint Backlogデータ、または null
   */
  async loadSprintBacklog(sprintId: string): Promise<any | null> {
    const filePath = path.join(this.sprintsDir, sprintId, 'sprint-backlog.json');
    return await FileSystemManager.readJSONSafe(filePath, null);
  }

  /**
   * Sprint Backlog内のタスクを取得
   *
   * @param sprintId - スプリントID
   * @param taskId - タスクID
   * @returns タスクデータ、または null
   */
  async getSprintBacklogTask(sprintId: string, taskId: string): Promise<any | null> {
    const backlog = await this.loadSprintBacklog(sprintId);
    if (!backlog || !backlog.tasks) {
      return null;
    }
    return backlog.tasks.find((task: any) => task.id === taskId) || null;
  }

  /**
   * Sprint Backlog内のタスクを更新
   *
   * @param sprintId - スプリントID
   * @param taskId - タスクID
   * @param updates - 更新するフィールド
   */
  async updateSprintBacklogTask(
    sprintId: string,
    taskId: string,
    updates: Partial<any>
  ): Promise<void> {
    const backlog = await this.loadSprintBacklog(sprintId);
    if (!backlog || !backlog.tasks) {
      throw new Error(`Sprint Backlog not found: ${sprintId}`);
    }

    const taskIndex = backlog.tasks.findIndex((task: any) => task.id === taskId);
    if (taskIndex === -1) {
      throw new Error(`Task not found in Sprint Backlog: ${taskId}`);
    }

    // タスクを更新
    backlog.tasks[taskIndex] = {
      ...backlog.tasks[taskIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // メタデータを更新
    backlog.metadata = {
      ...backlog.metadata,
      lastUpdated: new Date().toISOString(),
    };

    // 保存
    await this.saveSprintBacklog(sprintId, backlog);
  }

  /**
   * Sprint Planを保存
   *
   * @param sprintId - スプリントID（例: "sprint-1"）
   * @param plan - Sprint Plan データ
   */
  async saveSprintPlan(sprintId: string, plan: any): Promise<void> {
    const sprintDir = path.join(this.sprintsDir, sprintId);
    await FileSystemManager.ensureDirectory(sprintDir);

    const filePath = path.join(sprintDir, 'sprint-plan.json');
    await FileSystemManager.writeJSON(filePath, plan);
  }

  /**
   * Sprint Planを読み込み
   *
   * @param sprintId - スプリントID（例: "sprint-1"）
   * @returns Sprint Planデータ、または null
   */
  async loadSprintPlan(sprintId: string): Promise<any | null> {
    const filePath = path.join(this.sprintsDir, sprintId, 'sprint-plan.json');
    return await FileSystemManager.readJSONSafe(filePath, null);
  }

  // ========================================
  // パスヘルパー
  // ========================================

  /**
   * スプリント内タスクの基本パスを取得
   *
   * @param sprintId - スプリントID（例: "sprint-1"）
   * @param taskId - タスクID
   * @returns タスクディレクトリの絶対パス
   */
  getSprintTaskPath(sprintId: string, taskId: string): string {
    return path.join(this.sprintsDir, sprintId, 'tasks', taskId);
  }

  /**
   * タスクのinstruction.mdパスを取得
   *
   * @param sprintId - スプリントID（例: "sprint-1"）
   * @param taskId - タスクID
   * @returns instruction.mdの絶対パス
   */
  getTaskInstructionPath(sprintId: string, taskId: string): string {
    return path.join(this.getSprintTaskPath(sprintId, taskId), 'instruction.md');
  }

  /**
   * タスクのreview.jsonパスを取得
   *
   * @param sprintId - スプリントID（例: "sprint-1"）
   * @param taskId - タスクID
   * @returns review.jsonの絶対パス
   */
  getTaskReviewPath(sprintId: string, taskId: string): string {
    return path.join(this.getSprintTaskPath(sprintId, taskId), 'review.json');
  }

  /**
   * タスクのimplementation.mdパスを取得
   *
   * @param sprintId - スプリントID（例: "sprint-1"）
   * @param taskId - タスクID
   * @returns implementation.mdの絶対パス
   */
  getTaskImplementationPath(sprintId: string, taskId: string): string {
    return path.join(this.getSprintTaskPath(sprintId, taskId), 'implementation.md');
  }

  /**
   * スプリント内タスクディレクトリの相対パスを取得（.kugutsuからの相対パス）
   *
   * @param sprintId - スプリントID（例: "sprint-1"）
   * @param taskId - タスクID
   * @returns .kugutsuからの相対パス
   */
  getSprintTaskRelativePath(sprintId: string, taskId: string): string {
    return path.join('.kugutsu', 'sprints', sprintId, 'tasks', taskId);
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
