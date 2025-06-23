"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
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
    // DevToolsを開く（デバッグ用）
    mainWindow.webContents.openDevTools();
    // レンダラープロセスの準備が完了したらログを確認
    mainWindow.webContents.once('did-finish-load', () => {
        console.log('[Electron Main] Renderer loaded successfully');
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
electron_1.app.whenReady().then(() => {
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// IPC通信のハンドラー
electron_1.ipcMain.handle('log-message', async (event, data) => {
    // ログ処理
    console.log('Log from renderer:', data);
});
electron_1.ipcMain.handle('update-layout', async (event, engineerCount) => {
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
        }
    });
    // ウィンドウが準備できてから通知
    electron_1.app.whenReady().then(() => {
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