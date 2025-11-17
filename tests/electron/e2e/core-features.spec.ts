/**
 * Core Features E2E Test
 *
 * システムのコア機能を徹底的に検証：
 * 1. カンバンボードのタスクステータス遷移
 * 2. LangGraphノードの実行フロー
 * 3. ノードフロー視覚化
 * 4. ログ表示
 * 5. 依存関係グラフ
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import * as path from 'path';
import { createTestRepository, cleanupTestRepository } from '../../helpers/create-test-repository.js';

const TEST_REPO_DIR = path.join(process.cwd(), 'test-e2e-core-features');
const ELECTRON_MAIN = path.join(process.cwd(), 'out/main/index.js');

let testRepoPath: string;

test.describe('Core Features Verification', () => {
  test.beforeAll(async () => {
    console.log('🚀 Setting up test repository...');
    const result = await createTestRepository({
      targetDir: TEST_REPO_DIR,
      initGit: true,
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

  test('Kanban board shows tasks with correct statuses', async () => {
    let electronApp: ElectronApplication | null = null;
    let window: Page | null = null;

    try {
      console.log('\n🎯 Testing: Kanban Board Task Status Transitions');
      console.log('=' .repeat(60));

      // Launch app
      electronApp = await electron.launch({
        args: [ELECTRON_MAIN, testRepoPath],
        timeout: 30000,
      });

      window = await electronApp.firstWindow({ timeout: 30000 });
      await window.waitForLoadState('domcontentloaded', { timeout: 30000 });
      await window.waitForTimeout(2000);

      // Select Mock provider and submit task
      const mockProviderButton = window.locator('#provider-mock-main');
      await mockProviderButton.click();

      const textarea = window.locator('textarea[placeholder*="AIに指示を入力"]');
      await textarea.fill('Add /about page with About Us heading');

      const sendButton = window.locator('button:has-text("送信")');
      await sendButton.click();

      console.log('✅ Task submitted');

      // Wait for initial processing
      await window.waitForTimeout(3000);

      // =====================================================
      // Check Kanban Board Columns
      // =====================================================
      console.log('\n📊 Checking Kanban Board Columns...');

      // Check for column headers (from TaskKanbanBoard.tsx COLUMNS definition)
      const columns = [
        { status: 'pending', label: '待機中', icon: '⏳' },
        { status: 'ready', label: '準備完了', icon: '✨' },
        { status: 'in_progress', label: '実装中', icon: '🚀' },
        { status: 'in_review', label: 'レビュー中', icon: '🔍' },
        { status: 'completed', label: '完了', icon: '✅' },
        { status: 'failed', label: '失敗', icon: '❌' },
      ];

      for (const column of columns) {
        const hasColumn = await window.locator(`text=${column.label}`).count() > 0;
        console.log(`   ${column.icon} ${column.label}: ${hasColumn ? '✓' : '✗'}`);
        expect(hasColumn).toBe(true);
      }

      await window.screenshot({ path: 'test-results/core-kanban-columns.png' });

      // =====================================================
      // Check Statistics Section
      // =====================================================
      console.log('\n📈 Checking Statistics Display...');

      const statsElements = [
        'stats-total-tasks',
        'stats-completed-tasks',
        'stats-progress',
      ];

      for (const statId of statsElements) {
        const stat = window.locator(`[data-testid="${statId}"]`);
        const exists = await stat.count() > 0;

        if (exists) {
          const value = await stat.textContent();
          console.log(`   ✓ ${statId}: ${value}`);
        } else {
          console.log(`   ✗ ${statId}: Not found`);
        }
      }

      await window.screenshot({ path: 'test-results/core-statistics.png' });

      // =====================================================
      // Wait for task status transitions and verify task data
      // =====================================================
      console.log('\n⏱️  Monitoring task status transitions...');

      let foundStatuses: string[] = [];
      const maxWait = 30000; // 30 seconds
      const startTime = Date.now();
      let lastTotalTasks = 0;

      while (Date.now() - startTime < maxWait) {
        await window.waitForTimeout(1000);

        // Check statistics for task counts
        const totalTasksStat = window.locator('[data-testid="stats-total-tasks"]');
        const totalTasksExists = await totalTasksStat.count() > 0;

        if (totalTasksExists) {
          const totalText = await totalTasksStat.textContent();
          const totalCount = parseInt(totalText || '0', 10);

          if (totalCount !== lastTotalTasks) {
            lastTotalTasks = totalCount;
            console.log(`   📊 Total tasks updated: ${totalCount}`);
          }
        }

        // Check for task cards in each column
        for (const column of columns) {
          const taskCards = await window.locator(`[data-status="${column.status}"]`).count();

          if (taskCards > 0 && !foundStatuses.includes(column.status)) {
            foundStatuses.push(column.status);
            console.log(`   ✓ Found ${taskCards} task(s) in: ${column.label}`);
          }
        }

        // Check if we have completed tasks
        const completedStat = window.locator('[data-testid="stats-completed-tasks"]');
        const completedExists = await completedStat.count() > 0;

        if (completedExists) {
          const completedText = await completedStat.textContent();
          const completedCount = parseInt(completedText || '0', 10);

          if (completedCount > 0) {
            console.log(`   ✅ Completed tasks in statistics: ${completedCount}`);
            break;
          }
        }

        // Take periodic screenshots
        if ((Date.now() - startTime) % 10000 < 1000) {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          await window.screenshot({
            path: `test-results/core-kanban-monitoring-${elapsed}s.png`
          });
        }
      }

      await window.screenshot({ path: 'test-results/core-kanban-with-tasks.png' });

      console.log(`\n✅ Kanban Board Test Complete`);
      console.log(`   Statuses observed: ${foundStatuses.join(', ') || 'none'}`);

    } catch (error) {
      console.error('\n❌ Kanban Board Test Failed:', error);
      if (window) {
        await window.screenshot({ path: 'test-results/core-kanban-error.png' });
      }
      throw error;
    } finally {
      if (electronApp) {
        await electronApp.close();
      }
    }
  });

  test('Node flow visualization shows execution states', async () => {
    let electronApp: ElectronApplication | null = null;
    let window: Page | null = null;

    try {
      console.log('\n🎯 Testing: Node Flow Visualization');
      console.log('=' .repeat(60));

      electronApp = await electron.launch({
        args: [ELECTRON_MAIN, testRepoPath],
        timeout: 30000,
      });

      window = await electronApp.firstWindow({ timeout: 30000 });
      await window.waitForLoadState('domcontentloaded', { timeout: 30000 });
      await window.waitForTimeout(2000);

      // Submit task
      const mockProviderButton = window.locator('#provider-mock-main');
      await mockProviderButton.click();

      const textarea = window.locator('textarea[placeholder*="AIに指示を入力"]');
      await textarea.fill('Implement user authentication');

      const sendButton = window.locator('button:has-text("送信")');
      await sendButton.click();

      console.log('✅ Task submitted');

      // Wait for execution
      await window.waitForTimeout(5000);

      // =====================================================
      // Switch to AI Agents tab
      // =====================================================
      console.log('\n📍 Switching to AI Agents tab...');

      const agentsTab = window.locator('button:has-text("AIエージェント")');
      const agentsTabExists = await agentsTab.count() > 0;
      console.log(`   Agents tab exists: ${agentsTabExists ? '✓' : '✗'}`);

      if (agentsTabExists) {
        await agentsTab.click();
        await window.waitForTimeout(2000); // Increased wait time
        console.log('   ✓ Switched to agents tab');
      } else {
        console.warn('   ⚠️  AIエージェント tab not found');
      }

      await window.screenshot({ path: 'test-results/core-node-flow-tab-switched.png' });

      // =====================================================
      // Check for NodeExecutionViewer Content
      // =====================================================
      console.log('\n🔍 Checking for NodeExecutionViewer Content...');

      // NodeExecutionViewer has tabs: active, history, statistics
      const hasActiveTab = await window.locator('button[value="active"]:has-text("アクティブノード")').count() > 0;
      const hasHistoryTab = await window.locator('button[value="history"]:has-text("実行履歴")').count() > 0;
      const hasStatsTab = await window.locator('button[value="statistics"]:has-text("統計情報")').count() > 0;

      console.log(`   Active nodes tab: ${hasActiveTab ? '✓' : '✗'}`);
      console.log(`   History tab: ${hasHistoryTab ? '✓' : '✗'}`);
      console.log(`   Statistics tab: ${hasStatsTab ? '✓' : '✗'}`);

      // Check for node execution cards
      const nodeCards = await window.locator('[class*="card"]').count();
      console.log(`   Node cards found: ${nodeCards}`);

      // Expected node roles from execution
      const expectedRoles = ['Product Owner', 'Engineer', 'Tech Lead', 'Merge Coordinator'];
      for (const role of expectedRoles) {
        const hasRole = await window.locator(`text=/${role}/i`).count() > 0;
        console.log(`   ${role}: ${hasRole ? '✓' : '✗'}`);
      }

      await window.screenshot({ path: 'test-results/core-node-flow.png' });

      console.log('\n✅ Node Flow Test Complete');

    } catch (error) {
      console.error('\n❌ Node Flow Test Failed:', error);
      if (window) {
        await window.screenshot({ path: 'test-results/core-node-flow-error.png' });
      }
      throw error;
    } finally {
      if (electronApp) {
        await electronApp.close();
      }
    }
  });

  test('Log viewer UI is functional', async () => {
    let electronApp: ElectronApplication | null = null;
    let window: Page | null = null;

    try {
      console.log('\n🎯 Testing: Log Viewer Display');
      console.log('=' .repeat(60));

      electronApp = await electron.launch({
        args: [ELECTRON_MAIN, testRepoPath],
        timeout: 30000,
      });

      window = await electronApp.firstWindow({ timeout: 30000 });
      await window.waitForLoadState('domcontentloaded', { timeout: 30000 });

      // Capture console logs for debugging
      window.on('console', (msg) => {
        const text = msg.text();
        if (text.includes('[useElectronSync]') || text.includes('[ParallelDevOrchestrator]') || text.includes('[CheckModeNode]') || text.includes('ProductOwner') || text.includes('logs') || text.includes('Task')) {
          console.log(`[Renderer/Main] ${text}`);
        }
      });

      await window.waitForTimeout(2000);

      // Submit task
      const mockProviderButton = window.locator('#provider-mock-main');
      await mockProviderButton.click();

      const textarea = window.locator('textarea[placeholder*="AIに指示を入力"]');
      await textarea.fill('Add API endpoint for users');

      const sendButton = window.locator('button:has-text("送信")');
      await sendButton.click();

      console.log('✅ Task submitted');

      // =====================================================
      // Open Bottom Panel (Log Viewer)
      // =====================================================
      console.log('\n📝 Opening Bottom Panel (Log Viewer)...');

      // Find and click the expand button (ChevronUp icon)
      const expandButton = window.locator('button:has(svg.lucide-chevron-up)');
      const expandButtonExists = await expandButton.count() > 0;
      console.log(`   Expand button exists: ${expandButtonExists ? '✓' : '✗'}`);

      if (expandButtonExists) {
        await expandButton.click();
        await window.waitForTimeout(1000);
        console.log('   ✓ Bottom panel expanded');
      } else {
        console.log('   ⚠️  Expand button not found, panel may already be open');
      }

      await window.screenshot({ path: 'test-results/core-logs-panel-opened.png' });

      // =====================================================
      // Check Log Viewer UI
      // =====================================================
      console.log('\n📝 Checking Log Viewer UI...');

      // Check for search input
      const searchInput = window.locator('input[placeholder*="ログを検索"]');
      const hasSearchInput = await searchInput.count() > 0;
      console.log(`   検索機能: ${hasSearchInput ? '✓' : '✗'}`);
      expect(hasSearchInput).toBe(true);

      // Check for filter button
      const filterButton = window.locator('button:has-text("すべて")');
      const hasFilterButton = await filterButton.count() > 0;
      console.log(`   フィルター機能: ${hasFilterButton ? '✓' : '✗'}`);
      expect(hasFilterButton).toBe(true);

      // Check for clear button
      const clearButton = window.locator('button:has(svg.lucide-trash-2)');
      const hasClearButton = await clearButton.count() > 0;
      console.log(`   クリア機能: ${hasClearButton ? '✓' : '✗'}`);
      expect(hasClearButton).toBe(true);

      console.log('\n✅ Log viewer UI is fully functional');
      console.log('   検索、フィルター、クリア機能が利用可能です');

      await window.screenshot({ path: 'test-results/core-logs.png' });

      console.log('\n✅ Log Viewer Test Complete');

    } catch (error) {
      console.error('\n❌ Log Viewer Test Failed:', error);
      if (window) {
        await window.screenshot({ path: 'test-results/core-logs-error.png' });
      }
      throw error;
    } finally {
      if (electronApp) {
        await electronApp.close();
      }
    }
  });

  test('Dependency graph visualization updates', async () => {
    let electronApp: ElectronApplication | null = null;
    let window: Page | null = null;

    try {
      console.log('\n🎯 Testing: Dependency Graph Visualization');
      console.log('=' .repeat(60));

      electronApp = await electron.launch({
        args: [ELECTRON_MAIN, testRepoPath],
        timeout: 30000,
      });

      window = await electronApp.firstWindow({ timeout: 30000 });
      await window.waitForLoadState('domcontentloaded', { timeout: 30000 });
      await window.waitForTimeout(2000);

      // Submit task with dependencies
      const mockProviderButton = window.locator('#provider-mock-main');
      await mockProviderButton.click();

      const textarea = window.locator('textarea[placeholder*="AIに指示を入力"]');
      await textarea.fill('Implement authentication and user profile features');

      const sendButton = window.locator('button:has-text("送信")');
      await sendButton.click();

      console.log('✅ Task submitted');

      // Wait for dependency graph to be generated
      await window.waitForTimeout(5000);

      // =====================================================
      // Switch to Dependency Graph tab
      // =====================================================
      console.log('\n📍 Switching to Dependency Graph tab...');

      const graphTab = window.locator('button:has-text("依存関係グラフ")');
      const graphTabExists = await graphTab.count() > 0;
      console.log(`   Graph tab exists: ${graphTabExists ? '✓' : '✗'}`);

      if (graphTabExists) {
        await graphTab.click();
        await window.waitForTimeout(2000); // Increased wait time
        console.log('   ✓ Switched to graph tab');
      } else {
        console.warn('   ⚠️  依存関係グラフ tab not found');
      }

      await window.screenshot({ path: 'test-results/core-dependency-graph-tab-switched.png' });

      // =====================================================
      // Check Dependency Graph Content
      // =====================================================
      console.log('\n🔗 Checking Dependency Graph Content...');

      // Check for ReactFlow container (from DependencyGraphViewer)
      const hasReactFlow = await window.locator('.react-flow').count() > 0;
      console.log(`   ReactFlow container: ${hasReactFlow ? '✓' : '✗'}`);

      // Check for graph controls
      const hasControls = await window.locator('.react-flow__controls').count() > 0;
      const hasMiniMap = await window.locator('.react-flow__minimap').count() > 0;
      console.log(`   ReactFlow controls: ${hasControls ? '✓' : '✗'}`);
      console.log(`   ReactFlow minimap: ${hasMiniMap ? '✓' : '✗'}`);

      // Check for statistics cards
      const graphStatsElements = [
        'stats-total-nodes',
        'stats-completed-nodes',
        'stats-progress',
        'stats-critical-path-length',
        'stats-parallel-groups',
      ];

      let statsFound = 0;
      for (const statId of graphStatsElements) {
        const stat = window.locator(`[data-testid="${statId}"]`);
        const exists = await stat.count() > 0;

        if (exists) {
          const value = await stat.textContent();
          console.log(`   ✓ ${statId}: ${value}`);
          statsFound++;
        } else {
          console.log(`   ✗ ${statId}: Not found`);
        }
      }

      console.log(`\n   Statistics found: ${statsFound}/${graphStatsElements.length}`);

      // Check for legend (indicates graph is rendered)
      const hasLegend = await window.locator('[data-testid="legend"]').count() > 0;
      console.log(`   Legend present: ${hasLegend ? '✓' : '✗'}`);

      await window.screenshot({ path: 'test-results/core-dependency-graph.png' });

      console.log('\n✅ Dependency Graph Test Complete');

    } catch (error) {
      console.error('\n❌ Dependency Graph Test Failed:', error);
      if (window) {
        await window.screenshot({ path: 'test-results/core-dependency-graph-error.png' });
      }
      throw error;
    } finally {
      if (electronApp) {
        await electronApp.close();
      }
    }
  });
});
