/**
 * メモリ使用量監視ユーティリティ
 * メモリリークの検出と警告を提供
 */
export class MemoryMonitor {
    static instance;
    monitoringInterval;
    baseline;
    previousUsage;
    warningThreshold = 500 * 1024 * 1024; // 500MB
    criticalThreshold = 1000 * 1024 * 1024; // 1GB
    isMonitoring = false;
    leakDetectionHistory = [];
    maxHistorySize = 10;
    constructor() {
        // プロセス終了時のクリーンアップ
        process.on('exit', () => this.stop());
        process.on('SIGINT', () => this.stop());
        process.on('SIGTERM', () => this.stop());
    }
    /**
     * シングルトンインスタンスの取得
     */
    static getInstance() {
        if (!MemoryMonitor.instance) {
            MemoryMonitor.instance = new MemoryMonitor();
        }
        return MemoryMonitor.instance;
    }
    /**
     * メモリ監視開始
     */
    start(intervalMs = 30000) {
        if (this.isMonitoring) {
            console.log('⚠️ メモリ監視は既に実行中です');
            return;
        }
        console.log('🔍 メモリ監視開始');
        this.baseline = process.memoryUsage();
        this.previousUsage = this.baseline;
        this.isMonitoring = true;
        this.monitoringInterval = setInterval(() => {
            this.checkMemoryUsage();
        }, intervalMs);
        // 初回チェック
        this.checkMemoryUsage();
    }
    /**
     * メモリ監視停止
     */
    stop() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }
        this.isMonitoring = false;
        console.log('🛑 メモリ監視停止');
    }
    /**
     * メモリ使用量チェック
     */
    checkMemoryUsage() {
        const current = process.memoryUsage();
        const previous = this.previousUsage;
        // メモリ増加量を計算
        const heapIncrease = current.heapUsed - previous.heapUsed;
        const rssIncrease = current.rss - previous.rss;
        // リーク検出履歴に追加
        this.leakDetectionHistory.push(current.heapUsed);
        if (this.leakDetectionHistory.length > this.maxHistorySize) {
            this.leakDetectionHistory.shift();
        }
        // 警告レベルチェック
        if (current.heapUsed > this.criticalThreshold) {
            console.error(`🚨 CRITICAL: メモリ使用量が危険域です: ${this.formatBytes(current.heapUsed)}`);
            this.displayDetailedMemoryInfo(current);
            this.suggestGarbageCollection();
        }
        else if (current.heapUsed > this.warningThreshold) {
            console.warn(`⚠️ WARNING: メモリ使用量が警告域です: ${this.formatBytes(current.heapUsed)}`);
        }
        // メモリリーク検出
        const potentialLeak = this.detectMemoryLeak();
        if (potentialLeak) {
            console.warn('🔍 メモリリークの可能性を検出しました');
            this.displayLeakAnalysis();
        }
        // 定期的な詳細ログ（5回に1回）
        if (Math.random() < 0.2) {
            this.logMemoryStatus(current, heapIncrease, rssIncrease);
        }
        this.previousUsage = current;
    }
    /**
     * メモリリーク検出アルゴリズム
     */
    detectMemoryLeak() {
        if (this.leakDetectionHistory.length < this.maxHistorySize) {
            return false;
        }
        // 継続的な増加パターンを検出
        let consecutiveIncreases = 0;
        for (let i = 1; i < this.leakDetectionHistory.length; i++) {
            if (this.leakDetectionHistory[i] > this.leakDetectionHistory[i - 1]) {
                consecutiveIncreases++;
            }
            else {
                consecutiveIncreases = 0;
            }
        }
        // 7回以上連続で増加している場合はリークの可能性
        return consecutiveIncreases >= 7;
    }
    /**
     * リーク分析情報を表示
     */
    displayLeakAnalysis() {
        const first = this.leakDetectionHistory[0];
        const last = this.leakDetectionHistory[this.leakDetectionHistory.length - 1];
        const totalIncrease = last - first;
        const averageIncrease = totalIncrease / this.leakDetectionHistory.length;
        console.log('📊 メモリリーク分析:');
        console.log(`  - 観測期間: ${this.leakDetectionHistory.length}回`);
        console.log(`  - 総増加量: ${this.formatBytes(totalIncrease)}`);
        console.log(`  - 平均増加: ${this.formatBytes(averageIncrease)}/チェック`);
        console.log(`  - 現在使用量: ${this.formatBytes(last)}`);
    }
    /**
     * 詳細なメモリ情報を表示
     */
    displayDetailedMemoryInfo(usage) {
        console.log('📊 詳細メモリ情報:');
        console.log(`  - RSS (総メモリ): ${this.formatBytes(usage.rss)}`);
        console.log(`  - Heap使用量: ${this.formatBytes(usage.heapUsed)}`);
        console.log(`  - Heap総量: ${this.formatBytes(usage.heapTotal)}`);
        console.log(`  - External: ${this.formatBytes(usage.external)}`);
        console.log(`  - Array Buffers: ${this.formatBytes(usage.arrayBuffers)}`);
        if (this.baseline) {
            console.log('📈 ベースラインからの変化:');
            console.log(`  - RSS増加: ${this.formatBytes(usage.rss - this.baseline.rss)}`);
            console.log(`  - Heap増加: ${this.formatBytes(usage.heapUsed - this.baseline.heapUsed)}`);
        }
    }
    /**
     * メモリ状況ログ
     */
    logMemoryStatus(current, heapIncrease, rssIncrease) {
        const status = current.heapUsed > this.criticalThreshold ? '🚨' :
            current.heapUsed > this.warningThreshold ? '⚠️' : '✅';
        console.log(`${status} メモリ状況: Heap=${this.formatBytes(current.heapUsed)} RSS=${this.formatBytes(current.rss)} 変化=(+${this.formatBytes(heapIncrease)})`);
    }
    /**
     * ガベージコレクション提案
     */
    suggestGarbageCollection() {
        if (global.gc) {
            console.log('🗑️ 強制ガベージコレクションを実行します...');
            const beforeGC = process.memoryUsage();
            global.gc();
            const afterGC = process.memoryUsage();
            const freed = beforeGC.heapUsed - afterGC.heapUsed;
            console.log(`✅ ガベージコレクション完了: ${this.formatBytes(freed)}解放`);
        }
        else {
            console.log('💡 ガベージコレクションを実行するには --expose-gc フラグでNode.jsを起動してください');
        }
    }
    /**
     * バイト数を人間が読みやすい形式に変換
     */
    formatBytes(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = Math.abs(bytes);
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        const sign = bytes < 0 ? '-' : '';
        return `${sign}${size.toFixed(1)}${units[unitIndex]}`;
    }
    /**
     * 現在のメモリ情報を取得
     */
    getCurrentMemoryInfo() {
        const usage = process.memoryUsage();
        const status = usage.heapUsed > this.criticalThreshold ? 'critical' :
            usage.heapUsed > this.warningThreshold ? 'warning' : 'normal';
        return {
            usage,
            baseline: this.baseline,
            isMonitoring: this.isMonitoring,
            status
        };
    }
    /**
     * 閾値設定
     */
    setThresholds(warning, critical) {
        this.warningThreshold = warning;
        this.criticalThreshold = critical;
        console.log(`📊 メモリ閾値更新: 警告=${this.formatBytes(warning)}, 危険=${this.formatBytes(critical)}`);
    }
    /**
     * 即座にメモリ状況を表示
     */
    showCurrentStatus() {
        const info = this.getCurrentMemoryInfo();
        console.log('\n📊 現在のメモリ状況:');
        this.displayDetailedMemoryInfo(info.usage);
        console.log(`監視状態: ${info.isMonitoring ? '有効' : '無効'}`);
        console.log(`状況: ${info.status}\n`);
    }
}
//# sourceMappingURL=MemoryMonitor.js.map