/**
 * File System Loader
 *
 * プロジェクトオープン時に.kugutsu配下のファイルを読み込み、
 * Electron UIに初期データを送信する
 */

import type { BrowserWindow } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * ファイルシステムローダークラス
 */
export class FileSystemLoader {
  /**
   * プロジェクトオープン時の初期データ読み込み
   *
   * @param projectPath プロジェクトルートパス
   * @param window Electronウィンドウ
   */
  async loadInitialData(projectPath: string, window: BrowserWindow): Promise<void> {
    const kugutsuDir = path.join(projectPath, '.kugutsu');

    console.log(`[FileSystemLoader] Loading initial data from: ${kugutsuDir}`);

    // .kugutsuディレクトリの存在確認
    try {
      await fs.access(kugutsuDir);
    } catch {
      console.log(`[FileSystemLoader] .kugutsu directory not found, skipping initial data load`);
      return; // ディレクトリが存在しない場合はスキップ（エラーをスローしない）
    }

    // 各ファイルを読み込んでIPCで送信
    await Promise.all([
      this.loadProductBacklog(kugutsuDir, window),
      this.loadTechStack(kugutsuDir, window),
      this.loadRequirements(kugutsuDir, window),
      this.loadDependencyGraph(kugutsuDir, window),
      this.loadStoryMap(kugutsuDir, window),
      this.loadSprints(kugutsuDir, window),
      this.loadNodeExecutions(kugutsuDir, window),
    ]);

    console.log(`[FileSystemLoader] Initial data load complete`);
  }

  /**
   * Product Backlogを読み込む
   */
  private async loadProductBacklog(kugutsuDir: string, window: BrowserWindow): Promise<void> {
    const filePath = path.join(kugutsuDir, 'product-backlog', 'backlog.json');
    const data = await this.readJsonFile(filePath);

    if (data) {
      window.webContents.send('initial-data-loaded:tasks', {
        filePath: 'product-backlog/backlog.json',
        data,
      });
      console.log(`[FileSystemLoader] Loaded product backlog: ${data.tasks?.length || 0} tasks`);
    }
  }

  /**
   * Tech Stackを読み込む
   */
  private async loadTechStack(kugutsuDir: string, window: BrowserWindow): Promise<void> {
    const filePath = path.join(kugutsuDir, 'repository', 'architecture', 'tech-stack.json');
    const data = await this.readJsonFile(filePath);

    if (data) {
      window.webContents.send('initial-data-loaded:tech-stack', {
        filePath: 'repository/architecture/tech-stack.json',
        data,
      });
      console.log(`[FileSystemLoader] Loaded tech stack`);
    }
  }

  /**
   * Requirementsを読み込む
   */
  private async loadRequirements(kugutsuDir: string, window: BrowserWindow): Promise<void> {
    const filePath = path.join(kugutsuDir, 'requirements.json');
    const data = await this.readJsonFile(filePath);

    if (data) {
      window.webContents.send('initial-data-loaded:requirements', {
        filePath: 'requirements.json',
        data,
      });
      console.log(`[FileSystemLoader] Loaded requirements`);
    }
  }

  /**
   * Dependency Graphを読み込む
   */
  private async loadDependencyGraph(kugutsuDir: string, window: BrowserWindow): Promise<void> {
    const filePath = path.join(kugutsuDir, 'dependency-graph.json');
    const data = await this.readJsonFile(filePath);

    if (data) {
      window.webContents.send('initial-data-loaded:dependency-graph', {
        filePath: 'dependency-graph.json',
        data,
      });
      console.log(`[FileSystemLoader] Loaded dependency graph`);
    }
  }

  /**
   * Story Mapを読み込む
   */
  private async loadStoryMap(kugutsuDir: string, window: BrowserWindow): Promise<void> {
    const filePath = path.join(kugutsuDir, 'story-map.json');
    const data = await this.readJsonFile(filePath);

    if (data) {
      window.webContents.send('initial-data-loaded:story-map', {
        filePath: 'story-map.json',
        data,
      });
      console.log(`[FileSystemLoader] Loaded story map`);
    }
  }

  /**
   * Sprintsを読み込む
   */
  private async loadSprints(kugutsuDir: string, window: BrowserWindow): Promise<void> {
    const sprintsDir = path.join(kugutsuDir, 'sprints');

    try {
      // sprintsディレクトリが存在するか確認
      await fs.access(sprintsDir);

      // sprintsディレクトリ内のサブディレクトリを検索
      const entries = await fs.readdir(sprintsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const sprintBacklogPath = path.join(sprintsDir, entry.name, 'backlog.json');
          const data = await this.readJsonFile(sprintBacklogPath);

          if (data) {
            window.webContents.send('initial-data-loaded:sprint', {
              filePath: `sprints/${entry.name}/backlog.json`,
              data,
            });
            console.log(`[FileSystemLoader] Loaded sprint: ${entry.name}`);
          }
        }
      }
    } catch (error) {
      // sprintsディレクトリが存在しない場合はスキップ
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`[FileSystemLoader] Error loading sprints:`, error);
      }
    }
  }

  /**
   * Node Executionsを読み込む
   */
  private async loadNodeExecutions(kugutsuDir: string, window: BrowserWindow): Promise<void> {
    const filePath = path.join(kugutsuDir, 'node-executions.json');
    const data = await this.readJsonFile(filePath);

    if (data) {
      window.webContents.send('initial-data-loaded:node-executions', {
        filePath: 'node-executions.json',
        data,
      });
      console.log(`[FileSystemLoader] Loaded node executions: ${data.nodeExecutions?.length || 0} executions`);
    }
  }

  /**
   * JSONファイルを読み込む（共通処理）
   *
   * @param filePath ファイルパス
   * @returns パースされたJSONデータ、またはnull（ファイルが存在しない、パースエラー時）
   */
  private async readJsonFile(filePath: string): Promise<any | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // ファイルが存在しない場合はスキップ（エラーログを出力しない）
        return null;
      } else {
        // JSONパースエラーなどの場合はエラーログを出力
        console.error(`[FileSystemLoader] Error loading file ${filePath}:`, error);
        return null;
      }
    }
  }
}
