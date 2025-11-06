import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync } from 'fs';

// ESM用の__dirname代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;

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