/**
 * FileSystemWatcher Tests (Integration Tests)
 *
 * .kugutsu配下のファイル変更を検知してIPCで通知する機能のテスト
 *
 * 注意: これらのテストは実際のファイルシステム監視を使用する統合テストです。
 * chokidar が Jest 環境では正しく動作しないため、skip しています。
 * 実際のElectron環境またはE2Eテストフレームワーク(Playwright等)で実行してください。
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';

describe.skip('FileSystemWatcher - ファイル変更検知 (統合テスト)', () => {
  let testProjectPath: string;
  let mockWindow: any;

  beforeEach(async () => {
    // テスト用のプロジェクトディレクトリを作成
    testProjectPath = path.join(process.cwd(), 'test-temp', `watcher-test-${Date.now()}`);
    await fs.mkdir(testProjectPath, { recursive: true });

    // .kugutsuディレクトリ構造を作成
    const kugutsuDirs = [
      '.kugutsu',
      '.kugutsu/product-backlog',
      '.kugutsu/repository/architecture',
      '.kugutsu/sprints',
    ];

    for (const dir of kugutsuDirs) {
      await fs.mkdir(path.join(testProjectPath, dir), { recursive: true });
    }

    // モックのBrowserWindowを作成
    mockWindow = {
      webContents: {
        send: jest.fn(),
      },
    };
  });

  afterEach(async () => {
    // テスト用ディレクトリを削除
    await fs.rm(testProjectPath, { recursive: true, force: true });
  });

  describe('ファイル追加検知', () => {
    it('product-backlog/backlog.jsonが追加されたときにfile-changed:tasksイベントを送信する', async () => {
      // Arrange: FileSystemWatcherを起動
      const { FileSystemWatcher } = await import('../../../electron/main/FileSystemWatcher.js');
      const watcher = new FileSystemWatcher();
      watcher.startWatching(testProjectPath, mockWindow);

      await new Promise(resolve => setTimeout(resolve, 1000)); // watcher準備待機

      // Act: ファイルを追加
      const taskData = {
        tasks: [
          { id: 'task-001', title: 'テストタスク', priority: 1 },
        ],
        metadata: { totalTasks: 1 },
      };

      await fs.writeFile(
        path.join(testProjectPath, '.kugutsu/product-backlog/backlog.json'),
        JSON.stringify(taskData, null, 2),
        'utf-8'
      );

      await new Promise(resolve => setTimeout(resolve, 500)); // ファイル書き込み安定化待機

      // Assert: IPCイベントが送信されたことを確認
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'file-changed:tasks',
        expect.objectContaining({
          filePath: expect.stringContaining('product-backlog/backlog.json'),
          data: taskData,
          event: 'add',
        })
      );

      watcher.stopWatching();
    }, 10000); // 10秒タイムアウト

    it('requirements.jsonが追加されたときにfile-changed:requirementsイベントを送信する', async () => {
      // Arrange: FileSystemWatcherを起動
      const { FileSystemWatcher } = await import('../../../electron/main/FileSystemWatcher.js');
      const watcher = new FileSystemWatcher();
      watcher.startWatching(testProjectPath, mockWindow);

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Act
      const requirementsData = {
        functional: ['機能1', '機能2'],
        nonFunctional: ['性能要件1'],
      };

      await fs.writeFile(
        path.join(testProjectPath, '.kugutsu/requirements.json'),
        JSON.stringify(requirementsData, null, 2),
        'utf-8'
      );

      await new Promise(resolve => setTimeout(resolve, 500));

      // Assert
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'file-changed:requirements',
        expect.objectContaining({
          data: requirementsData,
          event: 'add',
        })
      );

      watcher.stopWatching();
    }, 10000);

    it('dependency-graph.jsonが追加されたときにfile-changed:dependency-graphイベントを送信する', async () => {
      // Arrange: FileSystemWatcherを起動
      const { FileSystemWatcher } = await import('../../../electron/main/FileSystemWatcher.js');
      const watcher = new FileSystemWatcher();
      watcher.startWatching(testProjectPath, mockWindow);

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Act
      const graphData = {
        nodes: [
          { id: 'node1', label: 'Task 1' },
          { id: 'node2', label: 'Task 2' },
        ],
        edges: [
          { from: 'node1', to: 'node2' },
        ],
      };

      await fs.writeFile(
        path.join(testProjectPath, '.kugutsu/dependency-graph.json'),
        JSON.stringify(graphData, null, 2),
        'utf-8'
      );

      await new Promise(resolve => setTimeout(resolve, 500));

      // Assert
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'file-changed:dependency-graph',
        expect.objectContaining({
          data: graphData,
          event: 'add',
        })
      );

      watcher.stopWatching();
    }, 10000);
  });

  describe('ファイル変更検知', () => {
    it('既存のbacklog.jsonが変更されたときにfile-changed:tasksイベントを送信する', async () => {
      // Arrange: 既存ファイルを配置
      const initialData = {
        tasks: [{ id: 'task-001', title: '初期タスク' }],
        metadata: { totalTasks: 1 },
      };

      await fs.writeFile(
        path.join(testProjectPath, '.kugutsu/product-backlog/backlog.json'),
        JSON.stringify(initialData, null, 2),
        'utf-8'
      );

      // FileSystemWatcherを起動
      const { FileSystemWatcher } = await import('../../../electron/main/FileSystemWatcher.js');
      const watcher = new FileSystemWatcher();
      watcher.startWatching(testProjectPath, mockWindow);

      await new Promise(resolve => setTimeout(resolve, 1000));

      mockWindow.webContents.send.mockClear(); // 初期読み込みイベントをクリア

      // Act: ファイルを変更
      const updatedData = {
        tasks: [
          { id: 'task-001', title: '初期タスク' },
          { id: 'task-002', title: '追加タスク' },
        ],
        metadata: { totalTasks: 2 },
      };

      await fs.writeFile(
        path.join(testProjectPath, '.kugutsu/product-backlog/backlog.json'),
        JSON.stringify(updatedData, null, 2),
        'utf-8'
      );

      await new Promise(resolve => setTimeout(resolve, 500));

      // Assert
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'file-changed:tasks',
        expect.objectContaining({
          data: updatedData,
          event: 'change',
        })
      );

      watcher.stopWatching();
    }, 10000);
  });

  describe('エラーハンドリング', () => {
    it('不正なJSON形式のファイルが追加されてもクラッシュしない', async () => {
      // Arrange: FileSystemWatcherを起動
      const { FileSystemWatcher } = await import('../../../electron/main/FileSystemWatcher.js');
      const watcher = new FileSystemWatcher();
      watcher.startWatching(testProjectPath, mockWindow);

      await new Promise(resolve => setTimeout(resolve, 1000));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Act: 不正なJSONファイルを追加
      await fs.writeFile(
        path.join(testProjectPath, '.kugutsu/requirements.json'),
        'invalid json content',
        'utf-8'
      );

      await new Promise(resolve => setTimeout(resolve, 500));

      // Assert: エラーログが出力されることを確認
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error reading file'),
        expect.anything()
      );

      watcher.stopWatching();
      consoleErrorSpy.mockRestore();
    }, 10000);

    it('監視中のファイルが削除されてもクラッシュしない', async () => {
      // Arrange: 既存ファイルを配置
      await fs.writeFile(
        path.join(testProjectPath, '.kugutsu/requirements.json'),
        JSON.stringify({ functional: [] }, null, 2),
        'utf-8'
      );

      // FileSystemWatcherを起動
      const { FileSystemWatcher } = await import('../../../electron/main/FileSystemWatcher.js');
      const watcher = new FileSystemWatcher();
      watcher.startWatching(testProjectPath, mockWindow);

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Act: ファイルを削除
      await fs.unlink(path.join(testProjectPath, '.kugutsu/requirements.json'));

      await new Promise(resolve => setTimeout(resolve, 500));

      // Assert: クラッシュしないことを確認(テストが完了すればOK)
      watcher.stopWatching();
    }, 10000);
  });
});
