/**
 * File System Watcher
 *
 * .kugutsuディレクトリのファイル変更を監視してElectron UIに通知
 */
import chokidar from 'chokidar';
import * as fs from 'fs/promises';
import * as path from 'path';
/**
 * ファイルシステム監視クラス
 */
export class FileSystemWatcher {
    watcher = null;
    window = null;
    kugutsuDir = null;
    /**
     * ファイル監視を開始
     *
     * @param projectPath プロジェクトルートパス
     * @param window Electronウィンドウ
     */
    startWatching(projectPath, window) {
        this.window = window;
        this.kugutsuDir = path.join(projectPath, '.kugutsu');
        console.log(`[FileSystemWatcher] Starting to watch: ${this.kugutsuDir}`);
        // 監視するファイルのリスト（globパターンは一部環境で動作しないため明示的に指定）
        const filesToWatch = [
            path.join(this.kugutsuDir, 'product-backlog', 'backlog.json'),
            path.join(this.kugutsuDir, 'requirements.json'),
            path.join(this.kugutsuDir, 'dependency-graph.json'),
            path.join(this.kugutsuDir, 'story-map.json'),
            path.join(this.kugutsuDir, 'node-executions.json'),
            path.join(this.kugutsuDir, 'sprints', '**', 'backlog.json'),
        ];
        // ファイルを監視
        // 注意: 初期データはFileSystemLoaderで読み込むため、ignoreInitial: trueに設定
        this.watcher = chokidar.watch(filesToWatch, {
            ignoreInitial: true, // 初期スキャンをスキップし、変更のみを監視
            persistent: true,
            awaitWriteFinish: {
                stabilityThreshold: 100,
                pollInterval: 50,
            },
        });
        console.log(`[FileSystemWatcher] Watching ${filesToWatch.length} file patterns`);
        // ファイル追加時
        this.watcher.on('add', async (filePath) => {
            await this.handleFileChange(filePath, 'add');
        });
        // ファイル変更時
        this.watcher.on('change', async (filePath) => {
            await this.handleFileChange(filePath, 'change');
        });
        // ファイル削除時
        this.watcher.on('unlink', (filePath) => {
            console.log(`[FileSystemWatcher] File deleted: ${filePath}`);
            // 削除イベントは必要に応じて実装
        });
        // 監視開始完了
        this.watcher.on('ready', () => {
            console.log(`[FileSystemWatcher] Initial scan complete. Watching for changes...`);
        });
        // エラー処理
        this.watcher.on('error', (error) => {
            console.error('[FileSystemWatcher] Watcher error:', error);
        });
    }
    /**
     * ファイル変更ハンドラー
     */
    async handleFileChange(filePath, event) {
        if (!this.window || !this.kugutsuDir)
            return;
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(content);
            // 相対パスを取得
            const relativePath = path.relative(this.kugutsuDir, filePath);
            console.log(`[FileSystemWatcher] File ${event}: ${relativePath}`);
            // ファイルの種類に応じてイベントを送信
            if (relativePath.includes('product-backlog') && relativePath.endsWith('backlog.json')) {
                // タスクバックログ
                this.window.webContents.send('file-changed:tasks', {
                    filePath: relativePath,
                    data,
                    event,
                });
                console.log(`[FileSystemWatcher] Sent tasks update: ${data.tasks?.length || 0} tasks`);
            }
            else if (relativePath.includes('requirements.json')) {
                // 要求分析
                this.window.webContents.send('file-changed:requirements', {
                    filePath: relativePath,
                    data,
                    event,
                });
                console.log(`[FileSystemWatcher] Sent requirements update`);
            }
            else if (relativePath.includes('dependency-graph.json')) {
                // 依存関係グラフ
                this.window.webContents.send('file-changed:dependency-graph', {
                    filePath: relativePath,
                    data,
                    event,
                });
                console.log(`[FileSystemWatcher] Sent dependency graph update`);
            }
            else if (relativePath.includes('story-map.json')) {
                // ストーリーマッピング
                this.window.webContents.send('file-changed:story-map', {
                    filePath: relativePath,
                    data,
                    event,
                });
                console.log(`[FileSystemWatcher] Sent story map update`);
            }
            else if (relativePath.includes('node-executions.json')) {
                // ノード実行履歴
                this.window.webContents.send('file-changed:node-executions', {
                    filePath: relativePath,
                    data,
                    event,
                });
                console.log(`[FileSystemWatcher] Sent node executions update: ${data.nodeExecutions?.length || 0} executions`);
            }
            else if (relativePath.includes('sprint') && relativePath.includes('backlog.json')) {
                // スプリントバックログ
                this.window.webContents.send('file-changed:sprint', {
                    filePath: relativePath,
                    data,
                    event,
                });
                console.log(`[FileSystemWatcher] Sent sprint update`);
            }
            else {
                // その他のファイル
                console.log(`[FileSystemWatcher] Unhandled file type: ${relativePath}`);
            }
        }
        catch (error) {
            console.error(`[FileSystemWatcher] Error reading file ${filePath}:`, error);
        }
    }
    /**
     * ファイル監視を停止
     */
    stopWatching() {
        if (this.watcher) {
            console.log('[FileSystemWatcher] Stopping file watcher...');
            this.watcher.close();
            this.watcher = null;
        }
        this.window = null;
        this.kugutsuDir = null;
    }
    /**
     * 監視中かどうか
     */
    isWatching() {
        return this.watcher !== null;
    }
}
//# sourceMappingURL=FileSystemWatcher.js.map