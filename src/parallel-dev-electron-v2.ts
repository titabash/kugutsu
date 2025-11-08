#!/usr/bin/env node

/**
 * Kugutsu 2.0 - Electron UI Entry Point
 *
 * Launches Electron window and executes parallel development workflow
 */

import { app, BrowserWindow } from 'electron';
import { parallelDevOrchestrator } from './electron/ParallelDevOrchestrator.js';
import type { ParallelDevConfig } from './graph/types.js';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * CLI configuration
 */
interface CLIConfig {
  userRequest?: string;
  baseRepoPath: string;
  worktreeBasePath: string;
  maxEngineers: number;
  maxTurns: number;
  baseBranch: string;
  cleanup: boolean;
  devTools: boolean;
  provider: 'claude' | 'codex';
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): CLIConfig {
  const config: CLIConfig = {
    baseRepoPath: process.cwd(),
    worktreeBasePath: path.join(process.cwd(), 'worktrees'),
    maxEngineers: 3,
    maxTurns: 50,
    baseBranch: getCurrentBranch(process.cwd()) || 'main',
    cleanup: false,
    devTools: false,
    provider: 'claude',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--base-repo':
        config.baseRepoPath = path.resolve(args[++i]);
        break;

      case '--worktree-base':
        config.worktreeBasePath = path.resolve(args[++i]);
        break;

      case '--max-engineers':
        config.maxEngineers = parseInt(args[++i], 10);
        break;

      case '--max-turns':
        config.maxTurns = parseInt(args[++i], 10);
        break;

      case '--base-branch':
        config.baseBranch = args[++i];
        break;

      case '--cleanup':
        config.cleanup = true;
        break;

      case '--devtools':
        config.devTools = true;
        break;

      case '--provider':
        const provider = args[++i];
        if (provider === 'claude' || provider === 'codex') {
          config.provider = provider;
        }
        break;

      default:
        if (!arg.startsWith('--') && !config.userRequest) {
          config.userRequest = arg;
        }
        break;
    }
  }

  return config;
}

/**
 * Get current Git branch
 */
function getCurrentBranch(repoPath: string): string | null {
  try {
    const branch = execSync('git branch --show-current', {
      cwd: repoPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    return branch || 'main';
  } catch (error) {
    return null;
  }
}

/**
 * Create Electron window
 */
function createWindow(cliConfig: CLIConfig): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../electron/preload/index.js'),
    },
    title: 'Kugutsu 2.0 - AI Parallel Development',
  });

  // Load HTML
  const htmlPath = path.join(__dirname, '../electron/renderer/index.html');
  mainWindow.loadFile(htmlPath);

  // Open DevTools if requested
  if (cliConfig.devTools) {
    mainWindow.webContents.openDevTools();
  }

  return mainWindow;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cliConfig = parseArgs(args);

  // Validate user request
  if (!cliConfig.userRequest) {
    console.error('❌ エラー: 開発要求を指定してください');
    app.quit();
    return;
  }

  // Validate API key
  if (!process.env.ANTHROPIC_API_KEY && cliConfig.provider === 'claude') {
    console.error('❌ エラー: ANTHROPIC_API_KEY環境変数が設定されていません');
    app.quit();
    return;
  }

  // Wait for app to be ready
  await app.whenReady();

  // Create window
  const mainWindow = createWindow(cliConfig);

  // Wait for window to load
  await new Promise<void>((resolve) => {
    mainWindow.webContents.once('did-finish-load', () => resolve());
  });

  console.log('🚀 Kugutsu 2.0 (Electron UI) 起動');
  console.log(`📝 開発要求: ${cliConfig.userRequest}`);

  try {
    // Create config
    const config: ParallelDevConfig = {
      maxEngineers: cliConfig.maxEngineers,
      maxTurns: cliConfig.maxTurns,
      baseBranch: cliConfig.baseBranch,
      baseRepoPath: cliConfig.baseRepoPath,
      worktreeBasePath: cliConfig.worktreeBasePath,
      cleanup: cliConfig.cleanup,
      provider: cliConfig.provider,
    };

    // Execute workflow with Electron window
    const finalState = await parallelDevOrchestrator.execute({
      userRequest: cliConfig.userRequest,
      config,
      window: mainWindow,
    });

    console.log('✅ ワークフロー完了');

    // Keep window open
    mainWindow.on('closed', () => {
      app.quit();
    });
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    app.quit();
  }
}

// Handle app lifecycle
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    // Recreate window if needed
  }
});

// Run main
main().catch((error) => {
  console.error('Fatal error:', error);
  app.quit();
});
