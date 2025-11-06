import { EventEmitter } from 'events';
/**
 * タスクイベントエミッター
 * 開発、レビュー、マージの各フェーズ間でイベントを通知
 * メモリリーク防止機能付き
 */
export class TaskEventEmitter extends EventEmitter {
    static instance;
    listenerRegistry = new Map();
    activeListeners = new Set();
    maxListenersWarningShown = false;
    memoryMonitoringInterval;
    constructor() {
        super();
        this.setMaxListeners(200); // 多数の並列タスクに対応（増量）
        // メモリリーク検出
        this.on('maxListeners', this.handleMaxListenersExceeded.bind(this));
        // 定期的なメモリ使用量チェック
        this.startMemoryMonitoring();
    }
    /**
     * シングルトンインスタンスの取得
     */
    static getInstance() {
        if (!TaskEventEmitter.instance) {
            TaskEventEmitter.instance = new TaskEventEmitter();
        }
        return TaskEventEmitter.instance;
    }
    /**
     * 開発完了イベントの発火
     */
    emitDevelopmentCompleted(task, result, engineerId) {
        const event = {
            type: 'DEVELOPMENT_COMPLETED',
            taskId: task.id,
            timestamp: new Date(),
            payload: { task, result, engineerId }
        };
        console.log(`📢 開発完了イベント発火: ${task.title}`);
        this.emit('DEVELOPMENT_COMPLETED', event);
        this.emit('task-event', event);
    }
    /**
     * レビュー完了イベントの発火
     */
    emitReviewCompleted(task, reviewResult, engineerResult, needsRevision) {
        const event = {
            type: 'REVIEW_COMPLETED',
            taskId: task.id,
            timestamp: new Date(),
            payload: { task, reviewResult, engineerResult, needsRevision }
        };
        console.log(`📢 レビュー完了イベント発火: ${task.title} (要修正: ${needsRevision})`);
        this.emit('REVIEW_COMPLETED', event);
        this.emit('task-event', event);
    }
    /**
     * マージ準備完了イベントの発火
     */
    emitMergeReady(task, finalResult, reviewHistory, engineerId) {
        const event = {
            type: 'MERGE_READY',
            taskId: task.id,
            timestamp: new Date(),
            payload: { task, finalResult, reviewHistory, engineerId }
        };
        console.log(`📢 マージ準備完了イベント発火: ${task.title}`);
        this.emit('MERGE_READY', event);
        this.emit('task-event', event);
    }
    /**
     * マージ完了イベントの発火
     */
    emitMergeCompleted(task, success, error) {
        const event = {
            type: 'MERGE_COMPLETED',
            taskId: task.id,
            timestamp: new Date(),
            payload: { task, success, error }
        };
        console.log(`📢 マージ完了イベント発火: ${task.title} (成功: ${success})`);
        this.emit('MERGE_COMPLETED', event);
        this.emit('task-event', event);
    }
    /**
     * タスク失敗イベントの発火
     */
    emitTaskFailed(task, error, phase) {
        const event = {
            type: 'TASK_FAILED',
            taskId: task.id,
            timestamp: new Date(),
            payload: { task, error, phase }
        };
        console.log(`📢 タスク失敗イベント発火: ${task.title} (フェーズ: ${phase})`);
        this.emit('TASK_FAILED', event);
        this.emit('task-event', event);
    }
    /**
     * マージコンフリクト検出イベントの発火
     */
    emitMergeConflictDetected(task, finalResult, reviewHistory, engineerId) {
        const event = {
            type: 'MERGE_CONFLICT_DETECTED',
            taskId: task.id,
            timestamp: new Date(),
            payload: { task, finalResult, reviewHistory, engineerId }
        };
        console.log(`📢 マージコンフリクト検出イベント発火: ${task.title}`);
        this.emit('MERGE_CONFLICT_DETECTED', event);
        this.emit('task-event', event);
    }
    /**
     * 開発完了イベントのリスナー登録
     */
    onDevelopmentCompleted(callback) {
        return this.registerListener('DEVELOPMENT_COMPLETED', callback);
    }
    /**
     * レビュー完了イベントのリスナー登録
     */
    onReviewCompleted(callback) {
        return this.registerListener('REVIEW_COMPLETED', callback);
    }
    /**
     * マージ準備完了イベントのリスナー登録
     */
    onMergeReady(callback) {
        return this.registerListener('MERGE_READY', callback);
    }
    /**
     * マージ完了イベントのリスナー登録
     */
    onMergeCompleted(callback) {
        return this.registerListener('MERGE_COMPLETED', callback);
    }
    /**
     * タスク失敗イベントのリスナー登録
     */
    onTaskFailed(callback) {
        return this.registerListener('TASK_FAILED', callback);
    }
    /**
     * マージコンフリクト検出イベントのリスナー登録
     */
    onMergeConflictDetected(callback) {
        return this.registerListener('MERGE_CONFLICT_DETECTED', callback);
    }
    /**
     * タスク完了イベントの発火（依存関係管理用）
     */
    emitTaskCompleted(task, result, engineerId) {
        const event = {
            type: 'TASK_COMPLETED',
            taskId: task.id,
            timestamp: new Date(),
            payload: { task, result, engineerId }
        };
        console.log(`📢 タスク完了イベント発火: ${task.title}`);
        this.emit('TASK_COMPLETED', event);
        this.emit('task-event', event);
    }
    /**
     * 依存関係解決イベントの発火
     */
    emitDependencyResolved(resolvedTaskId, newReadyTasks) {
        const event = {
            type: 'DEPENDENCY_RESOLVED',
            taskId: resolvedTaskId,
            timestamp: new Date(),
            payload: { resolvedTaskId, newReadyTasks }
        };
        console.log(`📢 依存関係解決イベント発火: ${resolvedTaskId} → 新たに実行可能: ${newReadyTasks.map(t => t.title).join(', ')}`);
        this.emit('DEPENDENCY_RESOLVED', event);
        this.emit('task-event', event);
    }
    /**
     * タスク完了イベントのリスナー登録
     */
    onTaskCompleted(callback) {
        return this.registerListener('TASK_COMPLETED', callback);
    }
    /**
     * 依存関係解決イベントのリスナー登録
     */
    onDependencyResolved(callback) {
        return this.registerListener('DEPENDENCY_RESOLVED', callback);
    }
    /**
     * 全イベントのリスナー登録
     */
    onAnyTaskEvent(callback) {
        return this.registerListener('task-event', callback);
    }
    /**
     * リスナーを安全に登録
     */
    registerListener(eventName, callback) {
        const id = `${eventName}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        // 弱参照でコールバックを保存
        const wrappedCallback = (...args) => {
            try {
                callback(...args);
            }
            catch (error) {
                console.error(`🚨 イベントリスナーエラー [${eventName}]:`, error);
                this.handleListenerError(id, eventName, error);
            }
        };
        // リスナー登録
        this.on(eventName, wrappedCallback);
        this.activeListeners.add(wrappedCallback);
        // レジストリに記録
        if (!this.listenerRegistry.has(eventName)) {
            this.listenerRegistry.set(eventName, new Map());
        }
        this.listenerRegistry.get(eventName).set(id, wrappedCallback);
        console.log(`📝 イベントリスナー登録: ${eventName} (ID: ${id}, 総リスナー数: ${this.listenerCount()})`);
        const registration = {
            id,
            event: eventName,
            callback: wrappedCallback,
            unregister: () => this.unregisterListener(id, eventName)
        };
        return registration;
    }
    /**
     * リスナーを安全に解除
     */
    unregisterListener(id, eventName) {
        const eventListeners = this.listenerRegistry.get(eventName);
        if (eventListeners && eventListeners.has(id)) {
            const callback = eventListeners.get(id);
            // EventEmitterから削除
            this.removeListener(eventName, callback);
            // アクティブリスナーから削除
            this.activeListeners.delete(callback);
            // レジストリから削除
            eventListeners.delete(id);
            if (eventListeners.size === 0) {
                this.listenerRegistry.delete(eventName);
            }
            console.log(`🗑️ イベントリスナー解除: ${eventName} (ID: ${id}, 残り総リスナー数: ${this.listenerCount()})`);
        }
    }
    /**
     * 特定イベントの全リスナーを解除
     */
    removeAllListenersForEvent(eventName) {
        const eventListeners = this.listenerRegistry.get(eventName);
        if (eventListeners) {
            for (const [id, callback] of eventListeners) {
                this.removeListener(eventName, callback);
                this.activeListeners.delete(callback);
            }
            this.listenerRegistry.delete(eventName);
            console.log(`🧹 イベント全リスナー解除: ${eventName}`);
        }
    }
    /**
     * メモリ使用量監視開始
     */
    startMemoryMonitoring() {
        this.memoryMonitoringInterval = setInterval(() => {
            const listenerCount = this.listenerCount();
            const memUsage = process.memoryUsage();
            if (listenerCount > 150) {
                console.warn(`⚠️ リスナー数が多すぎます: ${listenerCount}個`);
                this.logListenerBreakdown();
            }
            if (memUsage.heapUsed > 200 * 1024 * 1024) { // 200MB
                console.warn(`⚠️ メモリ使用量が高めです: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
            }
        }, 30000); // 30秒間隔
    }
    /**
     * リスナー数の詳細を表示
     */
    logListenerBreakdown() {
        console.log('📊 イベントリスナー詳細:');
        for (const [eventName, listeners] of this.listenerRegistry) {
            console.log(`  - ${eventName}: ${listeners.size}個`);
        }
    }
    /**
     * 総リスナー数を取得
     */
    listenerCount() {
        return this.activeListeners.size;
    }
    /**
     * 最大リスナー数超過時の処理
     */
    handleMaxListenersExceeded() {
        if (!this.maxListenersWarningShown) {
            console.warn('🚨 最大リスナー数に達しました。メモリリークの可能性があります。');
            this.logListenerBreakdown();
            this.maxListenersWarningShown = true;
        }
    }
    /**
     * リスナーエラー処理
     */
    handleListenerError(id, eventName, error) {
        console.error(`🚨 リスナーでエラー発生 [${eventName}][${id}]:`, error);
        // エラーが発生したリスナーを自動的に削除
        this.unregisterListener(id, eventName);
    }
    /**
     * 強制ガベージコレクション実行
     */
    forceGarbageCollection() {
        if (global.gc) {
            console.log('🗑️ 強制ガベージコレクション実行');
            global.gc();
        }
    }
    /**
     * クリーンアップ
     */
    cleanup() {
        console.log('🧹 TaskEventEmitter クリーンアップ開始');
        // メモリ監視インターバルをクリア
        if (this.memoryMonitoringInterval) {
            clearInterval(this.memoryMonitoringInterval);
            this.memoryMonitoringInterval = undefined;
        }
        // 全リスナーを安全に解除
        for (const [eventName] of this.listenerRegistry) {
            this.removeAllListenersForEvent(eventName);
        }
        // 残っているリスナーを強制削除
        this.removeAllListeners();
        // 内部状態をクリア
        this.listenerRegistry.clear();
        this.activeListeners.clear();
        // 強制ガベージコレクション
        this.forceGarbageCollection();
        console.log('✅ TaskEventEmitter クリーンアップ完了');
    }
    /**
     * メモリ情報を取得
     */
    getMemoryInfo() {
        return {
            listenerCount: this.listenerCount(),
            eventCount: this.listenerRegistry.size,
            memoryUsage: process.memoryUsage()
        };
    }
}
//# sourceMappingURL=TaskEventEmitter.js.map