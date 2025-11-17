/**
 * File-Based UI E2E Test
 *
 * .kugutsuディレクトリをSingle Source of Truthとして、
 * ファイルを配置するだけでUIが正しく表示されることを検証
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createTestRepository, cleanupTestRepository } from '../../helpers/create-test-repository.js';

const TEST_REPO_DIR = path.join(process.cwd(), 'test-e2e-file-based');
const ELECTRON_MAIN = path.join(process.cwd(), 'out/main/index.js');

let testRepoPath: string;

test.describe('File-Based UI Display', () => {
  test.beforeAll(async () => {
    console.log('🚀 Setting up test repository...');
    const result = await createTestRepository({
      targetDir: TEST_REPO_DIR,
      initGit: true,
      createKugutsuStructure: true, // .kugutsu構造を作成
      verbose: true,
    });

    if (!result.success) {
      throw new Error(`Failed to create test repository: ${result.error}`);
    }

    testRepoPath = result.path;
    console.log(`✅ Test repository created: ${testRepoPath}`);
  });

  test.afterAll(async () => {
    const shouldKeep = process.env.KEEP_TEST_WORKSPACE === '1';
    if (!shouldKeep) {
      await cleanupTestRepository(TEST_REPO_DIR, {
        keepWorktrees: false,
        verbose: true,
      });
    }
  });

  test('UI displays tasks from .kugutsu/product-backlog/backlog.json without workflow execution', async () => {
    let electronApp: ElectronApplication | null = null;
    let window: Page | null = null;

    try {
      console.log('\n🎯 Testing: File-Based Task Display');
      console.log('=' .repeat(60));

      // =====================================================
      // Step 1: ファイルを配置（ワークフロー実行なし）
      // =====================================================
      console.log('\n📝 Placing task data file...');

      const taskData = {
        tasks: [
          {
            id: 'task-001',
            title: 'ユーザーモデルの作成',
            description: 'TypeScript型定義とスキーマを作成',
            priority: 1,
            status: 'pending',
            dependencies: [],
            estimatedHours: 2,
            tags: ['backend', 'model'],
          },
          {
            id: 'task-002',
            title: 'ユーザー登録API実装',
            description: 'POST /api/users エンドポイントの実装',
            priority: 2,
            status: 'ready',
            dependencies: ['task-001'],
            estimatedHours: 3,
            tags: ['backend', 'api'],
          },
          {
            id: 'task-003',
            title: 'ログイン機能実装',
            description: 'POST /api/auth/login エンドポイントの実装',
            priority: 3,
            status: 'in_progress',
            dependencies: ['task-001'],
            estimatedHours: 2,
            tags: ['backend', 'auth'],
          },
        ],
        metadata: {
          totalTasks: 3,
          generatedAt: new Date().toISOString(),
        },
      };

      const backlogPath = path.join(testRepoPath, '.kugutsu/product-backlog/backlog.json');
      await fs.writeFile(backlogPath, JSON.stringify(taskData, null, 2), 'utf-8');
      console.log(`✅ Task data file created: ${backlogPath}`);

      // =====================================================
      // Step 2: Electronアプリを起動
      // =====================================================
      console.log('\n🚀 Launching Electron app...');

      electronApp = await electron.launch({
        args: [ELECTRON_MAIN, testRepoPath],
        timeout: 30000,
      });

      window = await electronApp.firstWindow({ timeout: 30000 });
      await window.waitForLoadState('domcontentloaded', { timeout: 30000 });

      // FileSystemLoaderがファイルを読み込む時間を待つ
      await window.waitForTimeout(3000);

      console.log('✅ Electron app launched');

      // =====================================================
      // Step 3: 統計タブに切り替え
      // =====================================================
      console.log('\n📊 Switching to statistics tab...');

      const statisticsTab = window.locator('button:has-text("統計")');
      await statisticsTab.click();
      await window.waitForTimeout(1000);
      console.log('   ✓ Switched to statistics tab');

      // =====================================================
      // Step 4: カンバンボードの統計を確認
      // =====================================================
      console.log('\n📊 Checking Kanban Board Statistics...');

      const totalTasksLocator = window.locator('[data-testid="stats-total-tasks"]');
      const totalTasksText = await totalTasksLocator.textContent();
      console.log(`   総タスク数: ${totalTasksText}`);

      // タスク数が3になることを確認
      expect(totalTasksText).toContain('3');

      // =====================================================
      // Step 5: ボードタブに戻る
      // =====================================================
      console.log('\n📋 Switching back to board tab...');
      const boardTab = window.getByRole('tab', { name: '📋 ボード' });
      await boardTab.click();
      await window.waitForTimeout(1000);
      console.log('   ✓ Switched to board tab');

      // =====================================================
      // Step 6: 各カラムにタスクが表示されることを確認
      // =====================================================
      console.log('\n🔍 Checking tasks in columns...');

      // pending列にtask-001が存在
      const pendingTask = window.locator('[data-column="pending"]').locator('text=ユーザーモデルの作成');
      const hasPendingTask = await pendingTask.count() > 0;
      console.log(`   ⏳ 待機中: ${hasPendingTask ? '✓ task-001' : '✗'}`);
      expect(hasPendingTask).toBe(true);

      // ready列にtask-002が存在
      const readyTask = window.locator('[data-column="ready"]').locator('text=ユーザー登録API実装');
      const hasReadyTask = await readyTask.count() > 0;
      console.log(`   ✨ 準備完了: ${hasReadyTask ? '✓ task-002' : '✗'}`);
      expect(hasReadyTask).toBe(true);

      // in_progress列にtask-003が存在
      const inProgressTask = window.locator('[data-column="in_progress"]').locator('text=ログイン機能実装');
      const hasInProgressTask = await inProgressTask.count() > 0;
      console.log(`   🚀 実装中: ${hasInProgressTask ? '✓ task-003' : '✗'}`);
      expect(hasInProgressTask).toBe(true);

      console.log('\n✅ File-Based UI Test Complete');
      console.log('   ファイルを配置するだけでUIが正しく表示されました！');

    } finally {
      if (window) await window.close();
      if (electronApp) await electronApp.close();
    }
  });

  test('UI updates when file is externally modified', async () => {
    let electronApp: ElectronApplication | null = null;
    let window: Page | null = null;

    try {
      console.log('\n🎯 Testing: External File Modification');
      console.log('=' .repeat(60));

      // =====================================================
      // Step 1: 初期データを配置
      // =====================================================
      console.log('\n📝 Placing initial task data...');

      const initialTaskData = {
        tasks: [
          {
            id: 'task-001',
            title: '初期タスク',
            description: '最初のタスク',
            priority: 1,
            status: 'pending',
            dependencies: [],
            estimatedHours: 1,
            tags: ['test'],
          },
        ],
        metadata: {
          totalTasks: 1,
          generatedAt: new Date().toISOString(),
        },
      };

      const backlogPath = path.join(testRepoPath, '.kugutsu/product-backlog/backlog.json');
      await fs.writeFile(backlogPath, JSON.stringify(initialTaskData, null, 2), 'utf-8');
      console.log(`✅ Initial task data created`);

      // =====================================================
      // Step 2: Electronアプリを起動
      // =====================================================
      console.log('\n🚀 Launching Electron app...');

      electronApp = await electron.launch({
        args: [ELECTRON_MAIN, testRepoPath],
        timeout: 30000,
      });

      window = await electronApp.firstWindow({ timeout: 30000 });
      await window.waitForLoadState('domcontentloaded', { timeout: 30000 });

      // コンソールログをキャプチャ（デバッグ用）
      window.on('console', (msg) => {
        if (msg.text().includes('FileSystemWatcher') || msg.text().includes('useElectronSync')) {
          console.log(`[Renderer Console] ${msg.text()}`);
        }
      });

      await window.waitForTimeout(3000);

      // 統計タブに切り替え
      console.log('\n📊 Switching to statistics tab...');
      const statisticsTab = window.locator('button:has-text("統計")');
      await statisticsTab.click();
      await window.waitForTimeout(1000);
      console.log('   ✓ Switched to statistics tab');

      // 初期状態を確認
      let totalTasksText = await window.locator('[data-testid="stats-total-tasks"]').textContent();
      console.log(`   初期タスク数: ${totalTasksText}`);
      expect(totalTasksText).toContain('1');

      // =====================================================
      // Step 3: ファイルを外部エディタで編集（シミュレート）
      // =====================================================
      console.log('\n✏️  Modifying file externally...');

      const updatedTaskData = {
        tasks: [
          {
            id: 'task-001',
            title: '初期タスク',
            description: '最初のタスク',
            priority: 1,
            status: 'pending',
            dependencies: [],
            estimatedHours: 1,
            tags: ['test'],
          },
          {
            id: 'task-002',
            title: '追加タスク',
            description: '外部エディタで追加したタスク',
            priority: 2,
            status: 'ready',
            dependencies: [],
            estimatedHours: 2,
            tags: ['test'],
          },
        ],
        metadata: {
          totalTasks: 2,
          generatedAt: new Date().toISOString(),
        },
      };

      await fs.writeFile(backlogPath, JSON.stringify(updatedTaskData, null, 2), 'utf-8');
      console.log(`✅ File modified externally`);

      // FileSystemWatcherが変更を検知してUIを更新する時間を待つ
      // chokidarのawaitWriteFinish設定を考慮してより長く待つ
      await window.waitForTimeout(5000);

      // =====================================================
      // Step 4: UIが更新されることを確認
      // =====================================================
      console.log('\n🔄 Checking UI update...');

      totalTasksText = await window.locator('[data-testid="stats-total-tasks"]').textContent();
      console.log(`   更新後タスク数: ${totalTasksText}`);
      expect(totalTasksText).toContain('2');

      // ボードタブに戻る
      console.log('\n📋 Switching back to board tab...');
      const boardTab = window.getByRole('tab', { name: '📋 ボード' });
      await boardTab.click();
      await window.waitForTimeout(1000);
      console.log('   ✓ Switched to board tab');

      const addedTask = window.locator('text=追加タスク');
      const hasAddedTask = await addedTask.count() > 0;
      console.log(`   追加タスクの表示: ${hasAddedTask ? '✓' : '✗'}`);
      expect(hasAddedTask).toBe(true);

      console.log('\n✅ External File Modification Test Complete');
      console.log('   外部エディタでの変更が即座にUIに反映されました！');

    } finally {
      if (window) await window.close();
      if (electronApp) await electronApp.close();
    }
  });
});
