import { EventEmitter } from 'events';

/**
 * キューアイテムのインターフェース
 */
export interface QueueItem<T> {
  id: string;
  data: T;
  priority: number;
  addedAt: Date;
}

/**
 * キューイベント
 */
export interface QueueEvent {
  type: 'ITEM_ADDED' | 'ITEM_PROCESSING' | 'ITEM_COMPLETED' | 'ITEM_FAILED';
  itemId: string;
  timestamp: Date;
}

/**
 * 汎用タスクキュー
 * 優先度付きキューで並列処理をサポート
 */
export class TaskQueue<T> extends EventEmitter {
  private items: QueueItem<T>[] = [];
  private processing = new Map<string, QueueItem<T>>();
  private maxConcurrent: number;
  private isRunning = false;
  private processor?: (item: T) => Promise<void>;

  constructor(maxConcurrent: number = 1) {
    super();
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * アイテムをキューに追加
   */
  async enqueue(id: string, data: T, priority: number = 0): Promise<void> {
    // 重複チェック
    if (this.has(id)) {
      console.warn(`⚠️ アイテムは既にキューに存在します: ${id}`);
      return;
    }

    const item: QueueItem<T> = {
      id,
      data,
      priority,
      addedAt: new Date()
    };

    // 優先度順に挿入
    const insertIndex = this.items.findIndex(i => i.priority < priority);
    if (insertIndex === -1) {
      this.items.push(item);
    } else {
      this.items.splice(insertIndex, 0, item);
    }

    this.emit('ITEM_ADDED', { 
      type: 'ITEM_ADDED', 
      itemId: id, 
      timestamp: new Date() 
    } as QueueEvent);

    console.log(`📥 キューに追加: ${id} (優先度: ${priority}, 待機数: ${this.items.length})`);

    // 自動処理が有効な場合は処理を開始
    if (this.isRunning && this.processor) {
      this.processNext();
    }
  }

  /**
   * キューから次のアイテムを取得
   */
  async dequeue(): Promise<QueueItem<T> | null> {
    if (this.items.length === 0) {
      return null;
    }

    return this.items.shift() || null;
  }

  /**
   * 処理関数を設定して自動処理を開始
   */
  start(processor: (item: T) => Promise<void>): void {
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
  stop(): void {
    this.isRunning = false;
  }

  /**
   * 次のアイテムを処理
   */
  private async processNext(): Promise<void> {
    if (!this.isRunning || !this.processor) return;
    if (this.processing.size >= this.maxConcurrent) return;
    
    const item = await this.dequeue();
    if (!item) return;

    this.processing.set(item.id, item);
    
    this.emit('ITEM_PROCESSING', { 
      type: 'ITEM_PROCESSING', 
      itemId: item.id, 
      timestamp: new Date() 
    } as QueueEvent);

    console.log(`⚙️ 処理開始: ${item.id} (並列処理数: ${this.processing.size}/${this.maxConcurrent})`);

    try {
      await this.processor(item.data);
      
      this.emit('ITEM_COMPLETED', { 
        type: 'ITEM_COMPLETED', 
        itemId: item.id, 
        timestamp: new Date() 
      } as QueueEvent);

      console.log(`✅ 処理完了: ${item.id}`);
    } catch (error) {
      this.emit('ITEM_FAILED', { 
        type: 'ITEM_FAILED', 
        itemId: item.id, 
        timestamp: new Date() 
      } as QueueEvent);

      console.error(`❌ 処理失敗: ${item.id}`, error);
    } finally {
      this.processing.delete(item.id);
      
      // 次のアイテムを処理
      this.processNext();
    }
  }

  /**
   * キューの状態を取得
   */
  getStats(): {
    waiting: number;
    processing: number;
    maxConcurrent: number;
  } {
    return {
      waiting: this.items.length,
      processing: this.processing.size,
      maxConcurrent: this.maxConcurrent
    };
  }


  /**
   * キューをクリア
   */
  clear(): void {
    this.items = [];
    console.log(`🗑️ キューをクリアしました`);
  }

  /**
   * 指定されたIDのアイテムがキューに存在するかチェック
   */
  has(id: string): boolean {
    return this.items.some(item => item.id === id) || this.processing.has(id);
  }

  /**
   * 全ての処理が完了するまで待機
   */
  async waitForCompletion(): Promise<void> {
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