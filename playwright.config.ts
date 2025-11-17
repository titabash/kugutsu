import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Electron E2E testing
 */
export default defineConfig({
  testDir: './tests/electron/e2e',
  timeout: 120000, // 2 minutes per test
  fullyParallel: false, // Run tests sequentially for Electron
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for Electron tests
  reporter: [
    ['html'],
    ['list'],
  ],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'electron',
      testMatch: /.*\.spec\.ts$/,
    },
  ],
});
