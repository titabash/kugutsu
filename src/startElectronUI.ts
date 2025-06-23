#!/usr/bin/env node

/**
 * Electron UIを起動するためのスタンドアロンスクリプト
 * このスクリプトは並列開発システムと独立して動作し、
 * WebSocketまたはIPCを通じてログを受信します
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const electronPath = path.join(__dirname, '../node_modules/.bin/electron');
const mainScriptPath = path.join(__dirname, './electron/main.js');

// Electronがインストールされているか確認
if (!fs.existsSync(electronPath)) {
    console.error('❌ Electronが見つかりません。npm installを実行してください。');
    process.exit(1);
}

// メインスクリプトが存在するか確認
if (!fs.existsSync(mainScriptPath)) {
    console.error('❌ Electronメインスクリプトが見つかりません。npm run buildを実行してください。');
    console.error(`   探している場所: ${mainScriptPath}`);
    process.exit(1);
}

console.log('🚀 Electron UIを起動中...');
console.log(`   Electron: ${electronPath}`);
console.log(`   メインスクリプト: ${mainScriptPath}`);

const electronProcess = spawn(electronPath, [mainScriptPath], {
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_IS_DEV: '1' }
});

electronProcess.on('close', (code) => {
    console.log(`Electron UIが終了しました (code: ${code})`);
});

electronProcess.on('error', (err) => {
    console.error('❌ Electron起動エラー:', err);
});