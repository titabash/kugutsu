import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
// ESM用の__dirname代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let mainWindow = null;
// コマンドライン引数をチェック
const shouldOpenDevTools = process.argv.includes('--devtools');
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1600,
        height: 1000,
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            contextIsolation: false,
            nodeIntegration: true,
            sandbox: false
        },
        title: 'Multi-Engineer Parallel Development'
    });
    // HTMLを読み込む
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
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
ipcMain.handle('update-layout', async (event, engineerCount) => {
    // レイアウト更新の処理
    return { success: true, engineerCount };
});
// 親プロセスからのメッセージを処理（並列開発システムとの通信）
if (process.send) {
    console.log('[Electron Main] IPC communication enabled');
    process.on('message', (message) => {
        // console.log('[Electron Main] Received message:', message);
        if (!message || !message.type)
            return;
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
}
else {
    console.log('[Electron Main] Running in standalone mode (no IPC)');
}
//# sourceMappingURL=index.js.map