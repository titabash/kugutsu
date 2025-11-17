/**
 * Dependency Graph UI E2E Test
 *
 * .kugutsuディレクトリをSingle Source of Truthとして、
 * dependency-graph.jsonファイルを配置するだけでグラフUIが正しく表示されることを検証
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createTestRepository, cleanupTestRepository } from '../../helpers/create-test-repository.js';

const TEST_REPO_DIR = path.join(process.cwd(), 'test-e2e-dependency-graph');
const ELECTRON_MAIN = path.join(process.cwd(), 'out/main/index.js');

let testRepoPath: string;

test.describe('Dependency Graph UI Display', () => {
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

  test('DependencyGraphViewer displays graph from .kugutsu/dependency-graph.json without workflow execution', async () => {
    let electronApp: ElectronApplication | null = null;
    let window: Page | null = null;

    try {
      console.log('\n🎯 Testing: Dependency Graph Display from File');
      console.log('='.repeat(60));

      // =====================================================
      // Step 1: ファイルを配置（ワークフロー実行なし）
      // =====================================================
      console.log('\n📝 Placing dependency graph file...');

      const dependencyGraphData = {
        nodes: [
          {
            id: 'task-001',
            type: 'task',
            label: 'ユーザーモデル作成',
            status: 'completed',
            data: {
              priority: 1,
              dependencies: [],
              estimatedTime: 2,
            },
          },
          {
            id: 'task-002',
            type: 'task',
            label: 'ユーザー登録API実装',
            status: 'in_progress',
            data: {
              priority: 2,
              dependencies: ['task-001'],
              estimatedTime: 3,
              assignedEngineer: 'Engineer-001',
            },
          },
          {
            id: 'task-003',
            type: 'task',
            label: 'ログイン機能実装',
            status: 'pending',
            data: {
              priority: 3,
              dependencies: ['task-001'],
              estimatedTime: 2,
            },
          },
        ],
        edges: [
          {
            id: 'edge-001-002',
            source: 'task-001',
            target: 'task-002',
            type: 'dependency',
          },
          {
            id: 'edge-001-003',
            source: 'task-001',
            target: 'task-003',
            type: 'dependency',
          },
        ],
        criticalPath: ['task-001', 'task-002'],
        parallelGroups: [['task-002', 'task-003']],
      };

      const graphPath = path.join(testRepoPath, '.kugutsu/dependency-graph.json');
      await fs.writeFile(graphPath, JSON.stringify(dependencyGraphData, null, 2), 'utf-8');
      console.log(`✅ Dependency graph file created: ${graphPath}`);

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
      // Step 3: 依存関係グラフタブに切り替え
      // =====================================================
      console.log('\n📍 Switching to Dependency Graph tab...');

      const graphTab = window.locator('button:has-text("依存関係グラフ")');
      await graphTab.click();
      await window.waitForTimeout(2000);
      console.log('   ✓ Switched to dependency graph tab');

      // =====================================================
      // Step 4: ReactFlowコンテナを確認
      // =====================================================
      console.log('\n🔗 Checking ReactFlow container...');

      const hasReactFlow = await window.locator('.react-flow').count() > 0;
      console.log(`   ReactFlow container: ${hasReactFlow ? '✓' : '✗'}`);
      expect(hasReactFlow).toBe(true);

      // =====================================================
      // Step 5: グラフコントロールを確認
      // =====================================================
      console.log('\n🎛️  Checking graph controls...');

      const hasControls = await window.locator('.react-flow__controls').count() > 0;
      const hasMiniMap = await window.locator('.react-flow__minimap').count() > 0;

      console.log(`   ReactFlow controls: ${hasControls ? '✓' : '✗'}`);
      console.log(`   ReactFlow minimap: ${hasMiniMap ? '✓' : '✗'}`);

      expect(hasControls).toBe(true);
      expect(hasMiniMap).toBe(true);

      // =====================================================
      // Step 6: 統計タブに切り替え
      // =====================================================
      console.log('\n📊 Switching to statistics tab...');

      const statisticsTab = window.locator('button:has-text("統計")');
      await statisticsTab.click();
      await window.waitForTimeout(1000);
      console.log('   ✓ Switched to statistics tab');

      // =====================================================
      // Step 7: 統計情報を確認
      // =====================================================
      console.log('\n📊 Checking graph statistics...');

      const statsElements = [
        { id: 'stats-total-nodes', expected: '3' },
        { id: 'stats-completed-nodes', expected: '1' },
        { id: 'stats-progress', expected: '33%' },
        { id: 'stats-critical-path-length', expected: '2' },
        { id: 'stats-parallel-groups', expected: '1' },
      ];

      for (const { id, expected } of statsElements) {
        const stat = window.locator(`[data-testid="${id}"]`);
        const exists = await stat.count() > 0;

        if (exists) {
          const value = await stat.textContent();
          console.log(`   ✓ ${id}: ${value}`);
          expect(value).toContain(expected);
        } else {
          console.log(`   ✗ ${id}: Not found`);
          expect(exists).toBe(true);
        }
      }

      // =====================================================
      // Step 7: Legend（凡例）を確認
      // =====================================================
      console.log('\n🎨 Checking legend...');

      const hasLegend = await window.locator('[data-testid="legend"]').count() > 0;
      console.log(`   Legend present: ${hasLegend ? '✓' : '✗'}`);
      expect(hasLegend).toBe(true);

      console.log('\n✅ Dependency Graph UI Test Complete');
      console.log('   ファイルを配置するだけで依存関係グラフが正しく表示されました！');

    } finally {
      if (window) await window.close();
      if (electronApp) await electronApp.close();
    }
  });

  test('DependencyGraphViewer updates when file is externally modified', async () => {
    let electronApp: ElectronApplication | null = null;
    let window: Page | null = null;

    try {
      console.log('\n🎯 Testing: Dependency Graph External File Modification');
      console.log('='.repeat(60));

      // =====================================================
      // Step 1: 初期データを配置
      // =====================================================
      console.log('\n📝 Placing initial dependency graph...');

      const initialData = {
        nodes: [
          {
            id: 'task-001',
            type: 'task',
            label: 'Initial Task',
            status: 'pending',
            data: {
              priority: 1,
              dependencies: [],
            },
          },
        ],
        edges: [],
        criticalPath: ['task-001'],
        parallelGroups: [],
      };

      const graphPath = path.join(testRepoPath, '.kugutsu/dependency-graph.json');
      await fs.writeFile(graphPath, JSON.stringify(initialData, null, 2), 'utf-8');
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

      // 依存関係グラフタブに切り替え
      const graphTab = window.locator('button:has-text("依存関係グラフ")');
      await graphTab.click();
      await window.waitForTimeout(2000);

      // 統計タブに切り替え
      const statisticsTab = window.locator('button:has-text("統計")');
      await statisticsTab.click();
      await window.waitForTimeout(1000);

      // 初期状態を確認: 総ノード数が1
      let totalNodesStat = window.locator('[data-testid="stats-total-nodes"]');
      let totalNodesText = await totalNodesStat.textContent();
      console.log(`   初期状態 - 総ノード数: ${totalNodesText}`);
      expect(totalNodesText).toContain('1');

      // =====================================================
      // Step 3: ファイルを外部エディタで編集（シミュレート）
      // =====================================================
      console.log('\n✏️  Modifying file externally...');

      const updatedData = {
        nodes: [
          {
            id: 'task-001',
            type: 'task',
            label: 'Initial Task',
            status: 'completed',
            data: {
              priority: 1,
              dependencies: [],
            },
          },
          {
            id: 'task-002',
            type: 'task',
            label: 'Added Task',
            status: 'pending',
            data: {
              priority: 2,
              dependencies: ['task-001'],
            },
          },
        ],
        edges: [
          {
            id: 'edge-001-002',
            source: 'task-001',
            target: 'task-002',
            type: 'dependency',
          },
        ],
        criticalPath: ['task-001', 'task-002'],
        parallelGroups: [],
      };

      await fs.writeFile(graphPath, JSON.stringify(updatedData, null, 2), 'utf-8');
      console.log(`✅ File modified externally`);

      // FileSystemWatcherが変更を検知してUIを更新する時間を待つ
      await window.waitForTimeout(5000);

      // =====================================================
      // Step 4: UIが更新されることを確認
      // =====================================================
      console.log('\n🔄 Checking UI update...');

      // 総ノード数が2に更新されている
      totalNodesStat = window.locator('[data-testid="stats-total-nodes"]');
      totalNodesText = await totalNodesStat.textContent();
      console.log(`   更新後 - 総ノード数: ${totalNodesText}`);
      expect(totalNodesText).toContain('2');

      // 完了ノード数が1に更新されている
      const completedNodesStat = window.locator('[data-testid="stats-completed-nodes"]');
      const completedNodesText = await completedNodesStat.textContent();
      console.log(`   更新後 - 完了ノード数: ${completedNodesText}`);
      expect(completedNodesText).toContain('1');

      // クリティカルパス長が2に更新されている
      const criticalPathStat = window.locator('[data-testid="stats-critical-path-length"]');
      const criticalPathText = await criticalPathStat.textContent();
      console.log(`   更新後 - クリティカルパス長: ${criticalPathText}`);
      expect(criticalPathText).toContain('2');

      console.log('\n✅ External File Modification Test Complete');
      console.log('   外部エディタでの変更が即座にUIに反映されました！');

    } finally {
      if (window) await window.close();
      if (electronApp) await electronApp.close();
    }
  });
});
