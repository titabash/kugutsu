/**
 * FileSystemLoader Tests
 *
 * プロジェクトオープン時に.kugutsu配下のファイルを読み込み、
 * IPCで通知する機能のテスト
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('FileSystemLoader - プロジェクトオープン時のファイル読み込み', () => {
  let testProjectPath: string;
  let mockWindow: any;

  beforeEach(async () => {
    // テスト用のプロジェクトディレクトリを作成
    testProjectPath = path.join(process.cwd(), 'test-temp', `loader-test-${Date.now()}`);
    await fs.mkdir(testProjectPath, { recursive: true });

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

  describe('初期データ読み込み', () => {
    it('プロジェクトオープン時に.kugutsu/product-backlog/backlog.jsonを読み込んでIPCで通知する', async () => {
      // Arrange: テストデータを配置
      const kugutsuPath = path.join(testProjectPath, '.kugutsu/product-backlog');
      await fs.mkdir(kugutsuPath, { recursive: true });

      const taskData = {
        tasks: [
          {
            id: 'task-001',
            title: 'テストタスク1',
            description: 'テスト用のタスク',
            priority: 1,
            dependencies: [],
            estimatedHours: 2,
            tags: ['test'],
          },
        ],
        metadata: {
          totalTasks: 1,
          generatedAt: new Date().toISOString(),
        },
      };

      await fs.writeFile(
        path.join(kugutsuPath, 'backlog.json'),
        JSON.stringify(taskData, null, 2),
        'utf-8'
      );

      // Act: プロジェクトオープン処理を実行
      const { FileSystemLoader } = await import('../../../electron/main/FileSystemLoader.js');
      const loader = new FileSystemLoader();
      await loader.loadInitialData(testProjectPath, mockWindow);

      // Assert: IPCで初期データが送信されたことを確認
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'initial-data-loaded:tasks',
        expect.objectContaining({
          filePath: 'product-backlog/backlog.json',
          data: taskData,
        })
      );
    });

    it('プロジェクトオープン時に.kugutsu/repository/architecture/tech-stack.jsonを読み込む', async () => {
      // Arrange
      const kugutsuPath = path.join(testProjectPath, '.kugutsu/repository/architecture');
      await fs.mkdir(kugutsuPath, { recursive: true });

      const techStackData = {
        languages: ['TypeScript', 'JavaScript'],
        frameworks: ['React', 'Next.js'],
        buildTools: ['Vite', 'Webpack'],
      };

      await fs.writeFile(
        path.join(kugutsuPath, 'tech-stack.json'),
        JSON.stringify(techStackData, null, 2),
        'utf-8'
      );

      // Act
      const { FileSystemLoader } = await import('../../../electron/main/FileSystemLoader.js');
      const loader = new FileSystemLoader();
      await loader.loadInitialData(testProjectPath, mockWindow);

      // Assert
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'initial-data-loaded:tech-stack',
        expect.objectContaining({
          filePath: 'repository/architecture/tech-stack.json',
          data: techStackData,
        })
      );
    });

    it('プロジェクトオープン時に.kugutsu/requirements.jsonを読み込む', async () => {
      // Arrange
      const kugutsuPath = path.join(testProjectPath, '.kugutsu');
      await fs.mkdir(kugutsuPath, { recursive: true });

      const requirementsData = {
        functional: ['ユーザー登録機能', 'ログイン機能'],
        nonFunctional: ['レスポンスタイム2秒以内'],
        constraints: ['TypeScript必須'],
      };

      await fs.writeFile(
        path.join(kugutsuPath, 'requirements.json'),
        JSON.stringify(requirementsData, null, 2),
        'utf-8'
      );

      // Act
      const { FileSystemLoader } = await import('../../../electron/main/FileSystemLoader.js');
      const loader = new FileSystemLoader();
      await loader.loadInitialData(testProjectPath, mockWindow);

      // Assert
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'initial-data-loaded:requirements',
        expect.objectContaining({
          filePath: 'requirements.json',
          data: requirementsData,
        })
      );
    });

    it('.kugutsuディレクトリが存在しない場合はエラーをスローしない', async () => {
      // Arrange: .kugutsuディレクトリを作成しない

      // Act & Assert: エラーがスローされないことを確認
      const { FileSystemLoader } = await import('../../../electron/main/FileSystemLoader.js');
      const loader = new FileSystemLoader();
      await expect(loader.loadInitialData(testProjectPath, mockWindow)).resolves.not.toThrow();
    });

    it('JSONファイルが不正な形式の場合はエラーログを出力する', async () => {
      // Arrange: 不正なJSONファイルを配置
      const kugutsuPath = path.join(testProjectPath, '.kugutsu');
      await fs.mkdir(kugutsuPath, { recursive: true });

      await fs.writeFile(
        path.join(kugutsuPath, 'requirements.json'),
        'invalid json content',
        'utf-8'
      );

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      const { FileSystemLoader } = await import('../../../electron/main/FileSystemLoader.js');
      const loader = new FileSystemLoader();
      await loader.loadInitialData(testProjectPath, mockWindow);

      // Assert: エラーログが出力されることを確認
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error loading file'),
        expect.anything()
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
