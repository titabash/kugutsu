/**
 * Node Flow UI E2E Test
 *
 * .kugutsuディレクトリをSingle Source of Truthとして、
 * node-executionsファイルを配置するだけでノードフローUIが正しく表示されることを検証
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createTestRepository, cleanupTestRepository } from '../../helpers/create-test-repository.js';

const TEST_REPO_DIR = path.join(process.cwd(), 'test-e2e-node-flow');
const ELECTRON_MAIN = path.join(process.cwd(), 'out/main/index.js');

let testRepoPath: string;

test.describe('Node Flow UI Display', () => {
  test.beforeAll(async () => {
    console.log('🚀 Setting up test repository...');
    const result = await createTestRepository({
      targetDir: TEST_REPO_DIR,
      initGit: true,
      createKugutsuStructure: true,
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

  test('NodeExecutionViewer displays node executions from .kugutsu/node-executions.json without workflow execution', async () => {
    let electronApp: ElectronApplication | null = null;
    let window: Page | null = null;

    try {
      console.log('\n🎯 Testing: Node Flow Display from File');
      console.log('='.repeat(60));

      // =====================================================
      // Step 1: ファイルを配置（ワークフロー実行なし）
      // =====================================================
      console.log('\n📝 Placing node executions file...');

      const nodeExecutionsData = {
        nodeExecutions: [
          {
            nodeName: 'product_owner',
            status: 'completed',
            startedAt: new Date('2025-11-17T10:00:00Z').toISOString(),
            completedAt: new Date('2025-11-17T10:02:00Z').toISOString(),
            duration: 120000, // 2 minutes
          },
          {
            nodeName: 'tech_lead_design',
            status: 'completed',
            startedAt: new Date('2025-11-17T10:02:00Z').toISOString(),
            completedAt: new Date('2025-11-17T10:05:00Z').toISOString(),
            duration: 180000, // 3 minutes
          },
          {
            nodeName: 'engineer_dispatch',
            status: 'started',
            startedAt: new Date('2025-11-17T10:05:00Z').toISOString(),
          },
        ],
        metadata: {
          totalExecutions: 3,
          generatedAt: new Date().toISOString(),
        },
      };

      const nodeExecutionsPath = path.join(testRepoPath, '.kugutsu/node-executions.json');
      await fs.writeFile(nodeExecutionsPath, JSON.stringify(nodeExecutionsData, null, 2), 'utf-8');
      console.log(`✅ Node executions file created: ${nodeExecutionsPath}`);

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
      // Step 3: AIエージェントタブに切り替え
      // =====================================================
      console.log('\n📍 Switching to AI Agents tab...');

      const agentsTab = window.locator('button:has-text("AIエージェント")');
      await agentsTab.click();
      await window.waitForTimeout(2000);
      console.log('   ✓ Switched to AI agents tab');

      // =====================================================
      // Step 4: NodeExecutionViewerのタブを確認
      // =====================================================
      console.log('\n🔍 Checking NodeExecutionViewer tabs...');

      const hasActiveTab = await window.locator('button:has-text("アクティブノード")').count() > 0;
      const hasHistoryTab = await window.locator('button:has-text("実行履歴")').count() > 0;
      const hasStatsTab = await window.locator('button:has-text("統計情報")').count() > 0;

      console.log(`   アクティブノードタブ: ${hasActiveTab ? '✓' : '✗'}`);
      console.log(`   実行履歴タブ: ${hasHistoryTab ? '✓' : '✗'}`);
      console.log(`   統計情報タブ: ${hasStatsTab ? '✓' : '✗'}`);

      expect(hasActiveTab).toBe(true);
      expect(hasHistoryTab).toBe(true);
      expect(hasStatsTab).toBe(true);

      // =====================================================
      // Step 5: アクティブノードを確認
      // =====================================================
      console.log('\n🚀 Checking active nodes...');

      // アクティブタブを選択（既に選択されているはず）
      const activeTab = window.locator('button:has-text("アクティブノード")');
      await activeTab.click();
      await window.waitForTimeout(1000);

      // アクティブノード（engineer_dispatch）が表示されているか確認
      const hasEngineerDispatch = await window.locator('text=/engineer.*dispatch/i').count() > 0;
      console.log(`   Engineer Dispatch ノード: ${hasEngineerDispatch ? '✓' : '✗'}`);
      expect(hasEngineerDispatch).toBe(true);

      // =====================================================
      // Step 6: 実行履歴を確認
      // =====================================================
      console.log('\n📚 Checking execution history...');

      const historyTab = window.locator('button:has-text("実行履歴")');
      await historyTab.click();
      await window.waitForTimeout(1000);

      // 完了したノード（product_owner, tech_lead_design）が履歴に表示されているか確認
      const hasProductOwner = await window.locator('text=/product.*owner/i').count() > 0;
      const hasTechLead = await window.locator('text=/tech.*lead/i').count() > 0;

      console.log(`   Product Owner ノード: ${hasProductOwner ? '✓' : '✗'}`);
      console.log(`   Tech Lead Design ノード: ${hasTechLead ? '✓' : '✗'}`);

      expect(hasProductOwner).toBe(true);
      expect(hasTechLead).toBe(true);

      console.log('\n✅ Node Flow UI Test Complete');
      console.log('   ファイルを配置するだけでノードフローUIが正しく表示されました！');

    } finally {
      if (window) await window.close();
      if (electronApp) await electronApp.close();
    }
  });

  test('NodeExecutionViewer updates when file is externally modified', async () => {
    let electronApp: ElectronApplication | null = null;
    let window: Page | null = null;

    try {
      console.log('\n🎯 Testing: Node Flow External File Modification');
      console.log('='.repeat(60));

      // =====================================================
      // Step 1: 初期データを配置
      // =====================================================
      console.log('\n📝 Placing initial node executions...');

      const initialData = {
        nodeExecutions: [
          {
            nodeName: 'product_owner',
            status: 'started',
            startedAt: new Date().toISOString(),
          },
        ],
        metadata: {
          totalExecutions: 1,
          generatedAt: new Date().toISOString(),
        },
      };

      const nodeExecutionsPath = path.join(testRepoPath, '.kugutsu/node-executions.json');
      await fs.writeFile(nodeExecutionsPath, JSON.stringify(initialData, null, 2), 'utf-8');
      console.log(`✅ Initial data created`);

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
      await window.waitForTimeout(3000);

      // AIエージェントタブに切り替え
      const agentsTab = window.locator('button:has-text("AIエージェント")');
      await agentsTab.click();
      await window.waitForTimeout(2000);

      // 初期状態を確認: product_ownerがアクティブ
      let hasProductOwner = await window.locator('text=/product.*owner/i').count() > 0;
      console.log(`   初期状態 - Product Owner: ${hasProductOwner ? '✓' : '✗'}`);
      expect(hasProductOwner).toBe(true);

      // =====================================================
      // Step 3: ファイルを外部エディタで編集（シミュレート）
      // =====================================================
      console.log('\n✏️  Modifying file externally...');

      const updatedData = {
        nodeExecutions: [
          {
            nodeName: 'product_owner',
            status: 'completed',
            startedAt: new Date('2025-11-17T10:00:00Z').toISOString(),
            completedAt: new Date('2025-11-17T10:02:00Z').toISOString(),
            duration: 120000,
          },
          {
            nodeName: 'tech_lead_design',
            status: 'started',
            startedAt: new Date().toISOString(),
          },
        ],
        metadata: {
          totalExecutions: 2,
          generatedAt: new Date().toISOString(),
        },
      };

      await fs.writeFile(nodeExecutionsPath, JSON.stringify(updatedData, null, 2), 'utf-8');
      console.log(`✅ File modified externally`);

      // FileSystemWatcherが変更を検知してUIを更新する時間を待つ
      await window.waitForTimeout(5000);

      // =====================================================
      // Step 4: UIが更新されることを確認
      // =====================================================
      console.log('\n🔄 Checking UI update...');

      // アクティブノードが更新されている（tech_lead_designが追加）
      const hasTechLead = await window.locator('text=/tech.*lead/i').count() > 0;
      console.log(`   新規アクティブノード - Tech Lead: ${hasTechLead ? '✓' : '✗'}`);
      expect(hasTechLead).toBe(true);

      // 実行履歴タブに切り替え
      const historyTab = window.locator('button:has-text("実行履歴")');
      await historyTab.click();
      await window.waitForTimeout(1000);

      // Product Ownerが履歴に移動している
      hasProductOwner = await window.locator('text=/product.*owner/i').count() > 0;
      console.log(`   履歴 - Product Owner (completed): ${hasProductOwner ? '✓' : '✗'}`);
      expect(hasProductOwner).toBe(true);

      console.log('\n✅ External File Modification Test Complete');
      console.log('   外部エディタでの変更が即座にUIに反映されました！');

    } finally {
      if (window) await window.close();
      if (electronApp) await electronApp.close();
    }
  });
});
