import { EventEmitter } from 'events';
/**
 * 汎用タスクキュー
 * 優先度付きキューで並列処理をサポート
 */
export class TaskQueue extends EventEmitter {
    items = [];
    processing = new Map();
    maxConcurrent;
    isRunning = false;
    processor;
    constructor(maxConcurrent = 1) {
        super();
        this.maxConcurrent = maxConcurrent;
    }
    /**
     * アイテムをキューに追加
     */
    async enqueue(id, data, priority = 0) {
        // 重複チェック
        if (this.has(id)) {
            // コンフリクト解消タスクの場合はより詳細な警告
            const isConflictResolution = typeof data === 'object' && data !== null &&
                (('isConflictResolution' in data && data.isConflictResolution) ||
                    ('type' in data && data.type === 'conflict-resolution'));
            if (isConflictResolution) {
                console.warn(`⚠️ コンフリクト解消タスクが既にキューに存在します: ${id} - リトライをスキップ`);
            }
            else {
                console.warn(`⚠️ アイテムは既にキューに存在します: ${id}`);
            }
            return;
        }
        const item = {
            id,
            data,
            priority,
            addedAt: new Date()
        };
        // 優先度順に挿入
        const insertIndex = this.items.findIndex(i => i.priority < priority);
        if (insertIndex === -1) {
            this.items.push(item);
        }
        else {
            this.items.splice(insertIndex, 0, item);
        }
        this.emit('ITEM_ADDED', {
            type: 'ITEM_ADDED',
            itemId: id,
            timestamp: new Date()
        });
        console.log(`📥 キューに追加: ${id} (優先度: ${priority}, 待機数: ${this.items.length})`);
        // 自動処理が有効な場合は処理を開始
        if (this.isRunning && this.processor) {
            this.processNext();
        }
    }
    /**
     * キューから次のアイテムを取得
     */
    async dequeue() {
        if (this.items.length === 0) {
            return null;
        }
        return this.items.shift() || null;
    }
    /**
     * 処理関数を設定して自動処理を開始
     */
    start(processor) {
        this.processor = processor;
        this.isRunning = true;
        // 既存のアイテムの処理を開始
        for (let i = 0; i < this.maxConcurrent; i++) {
            this.processNext();
        }
    }
    /**
     * 自動処理を停止
     */
    stop() {
        this.isRunning = false;
    }
    /**
     * 次のアイテムを処理
     */
    async processNext() {
        if (!this.isRunning || !this.processor)
            return;
        if (this.processing.size >= this.maxConcurrent)
            return;
        const item = await this.dequeue();
        if (!item)
            return;
        this.processing.set(item.id, item);
        this.emit('ITEM_PROCESSING', {
            type: 'ITEM_PROCESSING',
            itemId: item.id,
            timestamp: new Date()
        });
        console.log(`⚙️ 処理開始: ${item.id} (並列処理数: ${this.processing.size}/${this.maxConcurrent})`);
        try {
            await this.processor(item.data);
            this.emit('ITEM_COMPLETED', {
                type: 'ITEM_COMPLETED',
                itemId: item.id,
                timestamp: new Date()
            });
            console.log(`✅ 処理完了: ${item.id}`);
        }
        catch (error) {
            this.emit('ITEM_FAILED', {
                type: 'ITEM_FAILED',
                itemId: item.id,
                timestamp: new Date()
            });
            console.error(`❌ 処理失敗: ${item.id}`, error);
        }
        finally {
            this.processing.delete(item.id);
            // 次のアイテムを処理
            this.processNext();
        }
    }
    /**
     * キューの状態を取得
     */
    getStats() {
        return {
            waiting: this.items.length,
            processing: this.processing.size,
            maxConcurrent: this.maxConcurrent
        };
    }
    /**
     * キューをクリア
     */
    clear() {
        this.items = [];
        this.processing.clear();
        console.log(`🗑️ キューをクリアしました`);
    }
    /**
     * メモリリークを防ぐためのクリーンアップ
     */
    cleanup() {
        console.log('🧹 TaskQueue クリーンアップ開始');
        // 全処理を停止
        this.stop();
        // 全イベントリスナーを削除
        this.removeAllListeners();
        // 内部状態をクリア
        this.clear();
        // プロセッサー参照をクリア
        this.processor = undefined;
        console.log('✅ TaskQueue クリーンアップ完了');
    }
    /**
     * 指定されたIDのアイテムがキューに存在するかチェック
     */
    has(id) {
        return this.items.some(item => item.id === id) || this.processing.has(id);
    }
    /**
     * 全ての処理が完了するまで待機
     */
    async waitForCompletion() {
        return new Promise((resolve) => {
            const checkCompletion = () => {
                if (this.items.length === 0 && this.processing.size === 0) {
                    this.removeListener('ITEM_COMPLETED', checkCompletion);
                    this.removeListener('ITEM_FAILED', checkCompletion);
                    resolve();
                }
            };
            this.on('ITEM_COMPLETED', checkCompletion);
            this.on('ITEM_FAILED', checkCompletion);
            // 即座にチェック
            checkCompletion();
        });
    }
}
//# sourceMappingURL=TaskQueue.js.map