import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, statSync } from 'fs';

// ESM用の__dirname代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let currentProjectPath: string | null = null;

// コマンドライン引数をチェック
const shouldOpenDevTools = process.argv.includes('--devtools');

// --original-cwdオプションから元のワーキングディレクトリを取得
let originalCwd: string | undefined;
const cwdIndex = process.argv.indexOf('--original-cwd');
if (cwdIndex !== -1 && process.argv[cwdIndex + 1]) {
  originalCwd = process.argv[cwdIndex + 1];
  console.log('[Electron Main] Original working directory:', originalCwd);
}

function createWindow() {
  const preloadPath = path.join(__dirname, '../preload/index.js');
  console.log('[Electron Main] Preload script path:', preloadPath);
  console.log('[Electron Main] Preload script exists:', existsSync(preloadPath));
  
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: false,
      nodeIntegration: true,
      sandbox: false,
      webSecurity: false
    },
    title: 'Multi-Engineer Parallel Development'
  });

  // HTMLを読み込む（ビルド後のファイルを使用）
  const rendererPath = path.join(__dirname, '../dist/renderer/index.html');
  console.log('[Electron Main] Loading renderer from:', rendererPath);
  console.log('[Electron Main] Renderer exists:', existsSync(rendererPath));

  if (existsSync(rendererPath)) {
    mainWindow.loadFile(rendererPath);
  } else {
    console.error('[Electron Main] Renderer file not found! Run `npm run build:renderer` first.');
    mainWindow.loadURL('data:text/html,<h1>Error: Renderer not built. Run `npm run build:renderer`</h1>');
  }

  // --devtoolsオプションが指定されている場合はDevToolsを開く
  if (shouldOpenDevTools) {
    mainWindow.webContents.openDevTools();
  }

  // レンダラープロセスの準備が完了したらログを確認
  mainWindow.webContents.once('did-finish-load', () => {
    console.log('[Electron Main] Renderer loaded successfully');
    
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
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

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
 * プロジェクトを開く
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

  // Gitリポジトリかどうか確認
  const gitDir = path.join(selectedPath, '.git');
  if (!existsSync(gitDir)) {
    await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Invalid Project',
      message: 'The selected directory is not a Git repository.',
      detail: 'Please select a directory that contains a .git folder.'
    });
    return;
  }

  // worktreeまたはサブモジュールのチェック
  const gitDirStat = statSync(gitDir);
  if (gitDirStat.isFile()) {
    await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Invalid Project',
      message: 'Cannot open Git worktree or submodule.',
      detail: 'Please select the main repository root directory.'
    });
    return;
  }

  // プロジェクトパスを設定
  currentProjectPath = selectedPath;

  // Rendererプロセスに通知
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('project-opened', {
      projectPath: currentProjectPath
    });
  }

  // メニューを更新（Close Projectを有効化）
  createMenu();

  console.log('[Electron Main] Project opened:', currentProjectPath);
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

// 親プロセスからのメッセージを処理（並列開発システムとの通信）
if (process.send) {
  console.log('[Electron Main] IPC communication enabled');
  
  process.on('message', (message: any) => {
    // console.log('[Electron Main] Received message:', message);
    if (!message || !message.type) return;

    switch (message.type) {
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