import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import * as path from 'path';
import { existsSync, statSync } from 'fs';
import { StateStreamManager } from '../../src/electron/StateStreamManager.js';
import { ParallelDevOrchestrator } from '../../src/electron/ParallelDevOrchestrator.js';
import { FileSystemWatcher } from './FileSystemWatcher.js';
import { FileSystemLoader } from './FileSystemLoader.js';
import type { ParallelDevStateType } from '../../src/graph/state.js';
import type { ParallelDevConfig } from '../../src/graph/types.js';

// electron-viteが__dirnameと__filenameを自動的に提供するため、手動宣言は不要

let mainWindow: BrowserWindow | null = null;
let currentProjectPath: string | null = null;
let stateStreamManager: StateStreamManager | null = null;
let currentGraphState: ParallelDevStateType | null = null;
let orchestrator: ParallelDevOrchestrator | null = null;
let fileSystemWatcher: FileSystemWatcher | null = null;
let fileSystemLoader: FileSystemLoader | null = null;

// コマンドライン引数をチェック
const shouldOpenDevTools = process.argv.includes('--devtools');

// --original-cwdオプションから元のワーキングディレクトリを取得
let originalCwd: string | undefined;
const cwdIndex = process.argv.indexOf('--original-cwd');
if (cwdIndex !== -1 && process.argv[cwdIndex + 1]) {
  originalCwd = process.argv[cwdIndex + 1];
  console.log('[Electron Main] Original working directory:', originalCwd);
}

// コマンドライン引数からプロジェクトパスを取得（VSCode風）
// 使用例: npm run electron -- /path/to/project
let initialProjectPath: string | undefined;

// 1. --project-path オプションをチェック
const projectPathIndex = process.argv.indexOf('--project-path');
if (projectPathIndex !== -1 && process.argv[projectPathIndex + 1]) {
  initialProjectPath = process.argv[projectPathIndex + 1];
  console.log('[Electron Main] Project path from --project-path:', initialProjectPath);
}

// 2. 最後の引数をプロジェクトパスとして扱う（オプションでない場合）
if (!initialProjectPath) {
  const lastArg = process.argv[process.argv.length - 1];
  // Electronの実行ファイルパスやその他のオプションを除外
  if (lastArg && !lastArg.startsWith('-') && !lastArg.includes('electron') && existsSync(lastArg)) {
    initialProjectPath = lastArg;
    console.log('[Electron Main] Project path from last argument:', initialProjectPath);
  }
}

function createWindow() {
  const preloadPath = path.join(__dirname, '../preload/index.mjs');
  console.log('[Electron Main] Preload script path:', preloadPath);
  console.log('[Electron Main] Preload script exists:', existsSync(preloadPath));

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,   // セキュリティ改善: contextBridge使用
      nodeIntegration: false,   // セキュリティ改善: Rendererでnode機能無効化
      sandbox: false,           // 一部機能で必要なため false のまま
      webSecurity: true         // セキュリティ改善: CORS有効化
    },
    title: 'Multi-Engineer Parallel Development'
  });

  // HTMLを読み込む（electron-viteビルド後のファイルを使用）
  const rendererPath = path.join(__dirname, '../renderer/index.html');
  console.log('[Electron Main] Loading renderer from:', rendererPath);
  console.log('[Electron Main] Renderer exists:', existsSync(rendererPath));

  if (existsSync(rendererPath)) {
    mainWindow.loadFile(rendererPath);
  } else {
    console.error('[Electron Main] Renderer file not found! Run `npm run electron:build` first.');
    mainWindow.loadURL('data:text/html,<h1>Error: Renderer not built. Run `npm run electron:build`</h1>');
  }

  // レンダラープロセスのエラーをキャッチ
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[Renderer Console] [${level}] ${message} (${sourceId}:${line})`);
  });

  // レンダラープロセスの準備が完了したらログを確認
  mainWindow.webContents.once('did-finish-load', async () => {
    console.log('[Electron Main] Renderer loaded successfully');

    // --devtoolsフラグがある場合のみDevToolsを開く
    if (shouldOpenDevTools && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.openDevTools();
      console.log('[Electron Main] DevTools opened');
    }

    // 親プロセスに準備完了を通知
    if (process.send) {
      process.send({ type: 'ready' });
      console.log('[Electron Main] Sent ready message to parent process');
    }

    // テストメッセージを送信
    setTimeout(() => {
      console.log('[Electron Main] Sending test message to renderer');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('log-data', {
          engineerId: 'system',
          level: 'info',
          message: '🎉 Electron UI接続テスト成功！',
          component: 'System',
          timestamp: new Date()
        });
      }
    }, 500);

    // コマンドライン引数で指定されたプロジェクトを自動的に開く
    if (initialProjectPath) {
      console.log('[Electron Main] Auto-opening project from command line:', initialProjectPath);
      setTimeout(async () => {
        const success = await openProjectByPath(initialProjectPath!, false);
        if (success) {
          console.log('[Electron Main] Project auto-opened successfully');
        } else {
          console.error('[Electron Main] Failed to auto-open project');
        }
      }, 1000); // UIが完全に準備されるまで少し待つ
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Cleanup StateStreamManager
    if (stateStreamManager) {
      stateStreamManager.destroy();
      stateStreamManager = null;
    }
  });

  // Initialize StateStreamManager
  stateStreamManager = new StateStreamManager({
    bufferInterval: 50,
    maxEventsPerSecond: 20,
    maxBufferSize: 100,
    maxLogBuffer: 1000,
  });
  stateStreamManager.setWindow(mainWindow);
  console.log('[Electron Main] StateStreamManager initialized');

  // メニューバーを作成
  createMenu();
}

/**
 * アプリケーションメニューを作成
 */
function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Project...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            await openProject();
          }
        },
        {
          label: 'Close Project',
          accelerator: 'CmdOrCtrl+W',
          enabled: currentProjectPath !== null,
          click: () => {
            closeProject();
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/titabash/kugutsu');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * プロジェクトを開く（ダイアログ経由）
 */
async function openProject() {
  if (!mainWindow) return;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Project Directory',
    message: 'Choose a Git repository to work with'
  });

  // Electronのバージョンによって戻り値の型が異なる可能性があるため、型ガードを使用
  if (typeof result !== 'object' || !('canceled' in result)) {
    // 古いAPI（配列を直接返す）または不正な戻り値
    return;
  }

  // Electron v6+ の新しいAPI
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return;
  }

  const selectedPath = result.filePaths[0];
  await openProjectByPath(selectedPath);
}

/**
 * 指定されたパスのプロジェクトを開く
 */
async function openProjectByPath(selectedPath: string, showErrors: boolean = true): Promise<boolean> {
  if (!mainWindow) return false;

  // Gitリポジトリかどうか確認
  const gitDir = path.join(selectedPath, '.git');
  if (!existsSync(gitDir)) {
    if (showErrors) {
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Invalid Project',
        message: 'The selected directory is not a Git repository.',
        detail: 'Please select a directory that contains a .git folder.'
      });
    } else {
      console.error('[Electron Main] Not a Git repository:', selectedPath);
    }
    return false;
  }

  // worktreeまたはサブモジュールのチェック
  const gitDirStat = statSync(gitDir);
  if (gitDirStat.isFile()) {
    if (showErrors) {
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Invalid Project',
        message: 'Cannot open Git worktree or submodule.',
        detail: 'Please select the main repository root directory.'
      });
    } else {
      console.error('[Electron Main] Cannot open worktree/submodule:', selectedPath);
    }
    return false;
  }

  // プロジェクトパスを設定
  currentProjectPath = selectedPath;

  // ファイルシステム監視を開始
  if (!fileSystemWatcher) {
    fileSystemWatcher = new FileSystemWatcher();
  }
  fileSystemWatcher.startWatching(currentProjectPath, mainWindow);

  // 初期データを読み込む
  if (!fileSystemLoader) {
    fileSystemLoader = new FileSystemLoader();
  }
  await fileSystemLoader.loadInitialData(currentProjectPath, mainWindow);

  // Rendererプロセスに通知
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('project-opened', {
      projectPath: currentProjectPath
    });
  }

  // メニューを更新（Close Projectを有効化）
  createMenu();

  console.log('[Electron Main] Project opened:', currentProjectPath);
  return true;
}

/**
 * プロジェクトを閉じる
 */
function closeProject() {
  currentProjectPath = null;

  // Rendererプロセスに通知
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('project-closed');
  }

  // メニューを更新（Close Projectを無効化）
  createMenu();

  console.log('[Electron Main] Project closed');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC通信のハンドラー
ipcMain.handle('log-message', async (event, data) => {
  // ログ処理
  console.log('Log from renderer:', data);
});

ipcMain.handle('update-layout', async (event, engineerCount: number) => {
  // レイアウト更新の処理
  return { success: true, engineerCount };
});

// タスク管理関連のハンドラー
ipcMain.handle('get-tasks', async (event) => {
  // 親プロセスにタスク一覧を要求
  if (process.send) {
    return new Promise((resolve) => {
      const messageHandler = (message: any) => {
        if (message.type === 'tasks-response') {
          (process as any).removeListener('message', messageHandler);
          resolve(message.data);
        }
      };
      process.on('message', messageHandler);
      process.send!({ type: 'get-tasks' });

      // タイムアウト処理
      setTimeout(() => {
        (process as any).removeListener('message', messageHandler);
        resolve([]);
      }, 5000);
    });
  }
  return [];
});

ipcMain.handle('get-task-overview', async (event) => {
  // 親プロセスにタスクオーバービューを要求
  if (process.send) {
    return new Promise((resolve) => {
      const messageHandler = (message: any) => {
        if (message.type === 'task-overview-response') {
          (process as any).removeListener('message', messageHandler);
          resolve(message.data);
        }
      };
      process.on('message', messageHandler);
      process.send!({ type: 'get-task-overview' });

      // タイムアウト処理
      setTimeout(() => {
        (process as any).removeListener('message', messageHandler);
        resolve('');
      }, 5000);
    });
  }
  return '';
});

ipcMain.handle('get-task-instruction', async (event, taskId: string) => {
  // 親プロセスにタスク指示ファイルを要求
  if (process.send) {
    return new Promise((resolve) => {
      const messageHandler = (message: any) => {
        if (message.type === 'task-instruction-response' && message.taskId === taskId) {
          (process as any).removeListener('message', messageHandler);
          resolve(message.data);
        }
      };
      process.on('message', messageHandler);
      process.send!({ type: 'get-task-instruction', taskId });

      // タイムアウト処理
      setTimeout(() => {
        (process as any).removeListener('message', messageHandler);
        resolve('');
      }, 5000);
    });
  }
  return '';
});

ipcMain.handle('get-working-directory', async (event) => {
  // 元のコマンド実行ディレクトリを返す（コマンドライン引数から取得）
  return originalCwd || process.cwd();
});

ipcMain.handle('get-current-project-path', async (event) => {
  // 現在開いているプロジェクトのパスを返す
  return currentProjectPath;
});

ipcMain.handle('open-project-dialog', async (event) => {
  // プロジェクト選択ダイアログを開く
  await openProject();
  return currentProjectPath;
});

// ==========================================
// LangGraph IPC Handlers
// ==========================================

/**
 * Cancel execution (LangGraph workflow)
 */
ipcMain.handle('cancel-execution', async (event) => {
  try {
    console.log('[Electron Main] ===== cancel-execution handler called =====');
    console.log('[Electron Main] orchestrator exists:', !!orchestrator);

    if (!orchestrator) {
      console.warn('[Electron Main] No orchestrator instance found');
      return { success: false, message: 'No execution in progress' };
    }

    console.log('[Electron Main] Calling orchestrator.cancel()...');
    // Cancel the orchestrator
    orchestrator.cancel();
    console.log('[Electron Main] orchestrator.cancel() completed');

    return { success: true, message: 'Execution cancelled' };
  } catch (error) {
    console.error('[Electron Main] Failed to cancel execution:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Get current graph state
 */
ipcMain.handle('get-graph-state', async (event) => {
  try {
    return currentGraphState;
  } catch (error) {
    console.error('[Electron Main] Failed to get graph state:', error);
    throw error;
  }
});

/**
 * Get task details by ID
 */
ipcMain.handle('get-task-details', async (event, taskId: string) => {
  try {
    if (!currentGraphState) {
      return null;
    }
    const task = currentGraphState.tasks.find((t) => t.id === taskId);
    return task || null;
  } catch (error) {
    console.error('[Electron Main] Failed to get task details:', error);
    return null;
  }
});

/**
 * Log error from renderer
 */
ipcMain.handle('log-error', async (event, { message, details }: { message: string; details?: any }) => {
  console.error('[Renderer Error]', message, details);
});

/**
 * Execute prompt (start development workflow)
 */
ipcMain.handle('execute-prompt', async (event, { prompt, options }: {
  prompt: string;
  options: { provider?: string; maxEngineers?: number; maxTurns?: number }
}) => {
  console.log('[Electron Main] execute-prompt called:', { prompt, options });

  if (!currentProjectPath) {
    throw new Error('No project is currently opened');
  }

  const provider = (options.provider || 'mock') as 'claude' | 'codex' | 'mock';
  const maxEngineers = options.maxEngineers || 3;
  const maxTurns = options.maxTurns || 30;

  console.log('[Electron Main] Prompt execution requested:', {
    prompt,
    projectPath: currentProjectPath,
    provider,
    maxEngineers,
    maxTurns
  });

  // Send notification to renderer
  if (mainWindow) {
    mainWindow.webContents.send('prompt-execution-started', {
      prompt,
      provider,
      maxEngineers,
      maxTurns
    });
  }

  try {
    // Initialize Orchestrator (always create new instance for each execution)
    console.log('[Electron Main] Cleaning up previous orchestrator if exists...');
    if (orchestrator) {
      console.log('[Electron Main] Destroying previous orchestrator...');
      orchestrator.destroy();
      orchestrator = null;
    }

    console.log('[Electron Main] Creating new orchestrator instance...');
    orchestrator = new ParallelDevOrchestrator();
    orchestrator.setWindow(mainWindow);
    console.log('[Electron Main] New orchestrator initialized');

    // Build ParallelDevConfig
    const config: ParallelDevConfig = {
      maxEngineers,
      maxTurns,
      baseBranch: 'main',
      baseRepoPath: currentProjectPath,
      worktreeBasePath: path.join(currentProjectPath, 'worktrees'),
      cleanup: false, // Don't cleanup worktrees for debugging
      provider,
    };

    console.log('[Electron Main] Starting workflow execution...');
    console.log('[Electron Main] orchestrator instance ID:', (orchestrator as any).__id || 'no-id');

    // Execute workflow (non-blocking - runs in background)
    const executionPromise = orchestrator.execute({
      userRequest: prompt,
      config,
      window: mainWindow,
    });

    console.log('[Electron Main] execute() called, running in background...');

    executionPromise.then(finalState => {
      console.log('[Electron Main] Workflow completed successfully');
      console.log(`[Electron Main] Tasks completed: ${finalState.completedTasks.length}/${finalState.tasks.length}`);

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('prompt-execution-completed', {
          success: true,
          tasksCompleted: finalState.completedTasks.length,
          tasksTotal: finalState.tasks.length,
        });
      }

      // Keep orchestrator instance alive for debugging
      console.log('[Electron Main] Orchestrator still available for inspection');
    }).catch(error => {
      console.error('[Electron Main] Workflow execution failed:', error);

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('prompt-execution-failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    return {
      success: true,
      message: `Workflow execution started with ${provider} provider`
    };
  } catch (error) {
    console.error('[Electron Main] Failed to start workflow:', error);
    throw error;
  }
});

// ==========================================
// End of LangGraph IPC Handlers
// ==========================================

// 親プロセスからのメッセージを処理（並列開発システムとの通信）
if (process.send) {
  console.log('[Electron Main] IPC communication enabled');

  process.on('message', (message: any) => {
    // console.log('[Electron Main] Received message:', message);
    if (!message || !message.type) return;

    switch (message.type) {
      case 'graph-state-update':
        // LangGraph state update (new architecture)
        if (stateStreamManager && message.data) {
          currentGraphState = message.data;
          stateStreamManager.processStateUpdate(message.data).catch((error) => {
            console.error('[Electron Main] Failed to process state update:', error);
          });
        }
        break;

      case 'log':
        // console.log('[Electron Main] Sending log to renderer:', message.data);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('log-data', message.data);
        }
        break;

      case 'structured-log':
        // 構造化されたログメッセージを処理
        // console.log('[Electron Main] Sending structured log to renderer:', message.data);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('structured-log-data', message.data);
        }
        break;

      case 'update-engineer-count':
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('layout-update', message.data);
        }
        break;

      case 'update-task-status':
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('task-status-update', message.data);
        }
        break;

      case 'associate-techlead-engineer':
        // TechLeadとEngineerの関連付けを伝える
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('associate-techlead-engineer', message.data);
        }
        break;

      case 'all-tasks-completed':
        // 全タスク完了通知
        console.log('[Electron Main] Received all-tasks-completed message:', message.data);
        if (mainWindow && !mainWindow.isDestroyed()) {
          console.log('[Electron Main] Sending all-tasks-completed to renderer...');
          mainWindow.webContents.send('all-tasks-completed', message.data);
          console.log('[Electron Main] all-tasks-completed sent to renderer successfully');
        } else {
          console.warn('[Electron Main] Cannot send to renderer - window not available');
        }
        break;

      case 'tasks-updated':
        // タスク一覧の更新
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('tasks-updated', message.data);
        }
        break;

      case 'task-overview-updated':
        // タスクオーバービューの更新
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('task-overview-updated', message.data);
        }
        break;

      case 'set-current-project-id':
        // 現在のプロジェクトIDを設定
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('set-current-project-id', message.data);
        }
        break;
    }
  });

  // ウィンドウが準備できてから通知
  app.whenReady().then(() => {
    setTimeout(() => {
      console.log('[Electron Main] Sending ready notification');
      if (process.send) {
        process.send({ type: 'ready' });
      }
    }, 1000);
  });
} else {
  console.log('[Electron Main] Running in standalone mode (no IPC)');
}
