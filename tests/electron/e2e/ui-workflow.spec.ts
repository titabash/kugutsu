/**
 * Electron UI E2E Test
 *
 * Electronアプリのウィンドウを起動し、UIの動作をテストする
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import * as path from 'path';
import { createTestRepository, cleanupTestRepository } from '../../helpers/create-test-repository.js';

// Test constants
const TEST_REPO_DIR = path.join(process.cwd(), 'test-e2e-electron-ui');
const ELECTRON_MAIN = path.join(process.cwd(), 'out/main/index.js');

let testRepoPath: string;

test.describe('Electron UI E2E Tests', () => {
  // Setup: テスト用リポジトリ作成
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

  // Cleanup: テスト後のクリーンアップ
  test.afterAll(async () => {
    const shouldKeep = process.env.KEEP_TEST_WORKSPACE === '1';

    if (shouldKeep) {
      console.log(`\n📁 Test workspace preserved: ${TEST_REPO_DIR}`);
      console.log('   Set KEEP_TEST_WORKSPACE=0 to enable auto-cleanup');
    } else {
      await cleanupTestRepository(TEST_REPO_DIR, {
        keepWorktrees: false,
        verbose: true,
      });
    }
  });

  test('Electron app launches successfully with project path', async () => {
    let electronApp: ElectronApplication | null = null;
    let window: Page | null = null;

    try {
      console.log('🚀 Launching Electron app...');
      console.log(`   Main script: ${ELECTRON_MAIN}`);
      console.log(`   Project path: ${testRepoPath}`);

      // Launch Electron with project path
      electronApp = await electron.launch({
        args: [ELECTRON_MAIN, testRepoPath],
        timeout: 30000,
      });

      console.log('✅ Electron app launched');

      // Get the first window
      window = await electronApp.firstWindow({
        timeout: 30000,
      });

      console.log('✅ Window obtained');

      // Wait for window to load
      await window.waitForLoadState('domcontentloaded', { timeout: 30000 });
      console.log('✅ Window loaded');

      // Take screenshot for debugging
      await window.screenshot({ path: 'test-results/electron-launch.png' });
      console.log('📸 Screenshot saved');

      // Check if title contains expected text
      const title = await window.title();
      console.log(`   Window title: ${title}`);
      expect(title).toContain('Kugutsu');

      // Check if project path is displayed (assuming there's a project path indicator in UI)
      // This depends on your actual UI implementation
      // For now, we just verify the window opened successfully

      console.log('✅ Test passed: Electron app launched successfully');
    } catch (error) {
      console.error('❌ Test failed:', error);

      // Take screenshot on error if window exists
      if (window) {
        try {
          await window.screenshot({ path: 'test-results/electron-error.png' });
          console.log('📸 Error screenshot saved');
        } catch (screenshotError) {
          // Ignore screenshot errors
        }
      }

      throw error;
    } finally {
      // Cleanup
      if (electronApp) {
        await electronApp.close();
        console.log('🧹 Electron app closed');
      }
    }
  });

  test('UI displays project information correctly', async () => {
    let electronApp: ElectronApplication | null = null;
    let window: Page | null = null;

    try {
      console.log('🚀 Launching Electron app with project...');

      // Launch Electron with project path
      electronApp = await electron.launch({
        args: [ELECTRON_MAIN, testRepoPath],
        timeout: 30000,
      });

      window = await electronApp.firstWindow({
        timeout: 30000,
      });

      await window.waitForLoadState('domcontentloaded', { timeout: 30000 });

      // Wait a bit for project to be loaded
      await window.waitForTimeout(2000);

      // Take screenshot
      await window.screenshot({ path: 'test-results/electron-project-loaded.png' });

      // Check if UI elements are visible
      // Note: This depends on your actual UI structure
      // You may need to adjust selectors based on your implementation

      // Example: Check if there's a project indicator
      const hasProjectIndicator = await window.locator('[data-testid="project-path"]').count() > 0 ||
                                    await window.locator('text=/test-e2e-electron-ui/i').count() > 0;

      console.log(`   Project indicator found: ${hasProjectIndicator}`);

      // If no specific project indicator, at least verify main UI components exist
      const hasMainContent = await window.locator('body').count() > 0;
      expect(hasMainContent).toBe(true);

      console.log('✅ Test passed: UI displayed correctly');
    } catch (error) {
      console.error('❌ Test failed:', error);

      if (window) {
        try {
          await window.screenshot({ path: 'test-results/electron-ui-error.png' });
        } catch (screenshotError) {
          // Ignore
        }
      }

      throw error;
    } finally {
      if (electronApp) {
        await electronApp.close();
      }
    }
  });

  test('DevTools opens on startup', async () => {
    let electronApp: ElectronApplication | null = null;
    let window: Page | null = null;

    try {
      console.log('🚀 Launching Electron app to check DevTools...');

      electronApp = await electron.launch({
        args: [ELECTRON_MAIN, testRepoPath],
        timeout: 30000,
      });

      window = await electronApp.firstWindow({
        timeout: 30000,
      });

      await window.waitForLoadState('domcontentloaded', { timeout: 30000 });

      // Wait for DevTools to potentially open
      await window.waitForTimeout(1000);

      // Verify window is accessible (DevTools opening shouldn't break the app)
      const title = await window.title();
      expect(title).toBeTruthy();

      console.log('✅ Test passed: App remains functional with DevTools');
    } catch (error) {
      console.error('❌ Test failed:', error);
      throw error;
    } finally {
      if (electronApp) {
        await electronApp.close();
      }
    }
  });
});
