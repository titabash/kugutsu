import { execSync } from 'child_process';
import { Task, EngineerResult, ReviewResult, SystemConfig } from '../types/index.js';
import { GitWorktreeManager } from '../managers/GitWorktreeManager.js';
import { TaskEventEmitter } from './TaskEventEmitter.js';

/**
 * マージキューアイテム
 */
interface MergeQueueItem {
  task: Task;
  finalResult: EngineerResult;
  reviewHistory: ReviewResult[];
  retryCount: number;
  engineerId: string;
  conflictDetected?: boolean; // コンフリクト検出フラグ
}

/**
 * Mutex実装（排他制御）
 */
class Mutex {
  private locked = false;
  private queue: (() => void)[] = [];

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    } else {
      this.locked = false;
    }
  }
}

/**
 * マージキュー
 * メインブランチへのマージを排他制御で順次実行
 */
export class MergeQueue {
  private queue: MergeQueueItem[] = [];
  private isProcessing = false;
  private isStopped = false;
  private mutex = new Mutex();
  private gitManager: GitWorktreeManager;
  private config: SystemConfig;
  private eventEmitter: TaskEventEmitter;
  private maxRetries = 3;

  constructor(gitManager: GitWorktreeManager, config: SystemConfig) {
    this.gitManager = gitManager;
    this.config = config;
    this.eventEmitter = TaskEventEmitter.getInstance();
  }

  /**
   * マージをキューに追加
   */
  async enqueueMerge(
    task: Task, 
    finalResult: EngineerResult, 
    reviewHistory: ReviewResult[],
    engineerId: string
  ): Promise<void> {
    const item: MergeQueueItem = {
      task,
      finalResult,
      reviewHistory,
      retryCount: 0,
      engineerId
    };

    this.queue.push(item);
    console.log(`📥 マージキューに追加: ${task.title} (待機数: ${this.queue.length})`);

    // 非同期で次の処理を開始
    this.processNext().catch(error => {
      console.error(`❌ マージキュー処理エラー:`, error);
    });
  }

  /**
   * 次のマージを処理
   */
  private async processNext(): Promise<void> {
    // 停止フラグをチェック
    if (this.isStopped) {
      return;
    }

    // 排他制御でマージ処理を保護
    await this.mutex.acquire();
    
    try {
      if (this.isStopped || this.isProcessing || this.queue.length === 0) {
        return;
      }

      this.isProcessing = true;
      const item = this.queue.shift()!;

      console.log(`\n🔀 マージ処理開始: ${item.task.title}`);
      console.log(`📊 残りキュー: ${this.queue.length}件`);

      // マージ処理の実行
      const success = await this.executeMergeWithRetry(item);

      if (success) {
        console.log(`✅ マージ成功: ${item.task.title}`);
        this.eventEmitter.emitMergeCompleted(item.task, true);
        
        // クリーンアップ
        await this.cleanup(item.task);
      } else if (item.conflictDetected) {
        console.log(`⚠️ コンフリクト検出によりマージ中断: ${item.task.title}`);
        // コンフリクト検出時はcleanup処理を行わない（ワークツリーを保持）
        // イベントも発火しない（既に emitMergeConflictDetected で発火済み）
      } else {
        console.error(`❌ マージ失敗: ${item.task.title}`);
        this.eventEmitter.emitMergeCompleted(item.task, false, 'マージに失敗しました');
      }

      this.isProcessing = false;

      // 次のアイテムを処理（停止フラグを確認）
      if (!this.isStopped && this.queue.length > 0) {
        // 少し遅延を入れてGitの状態を安定させる
        setTimeout(() => {
          if (!this.isStopped) {
            this.processNext().catch(error => {
              console.error(`❌ 次のマージ処理でエラー:`, error);
            });
          }
        }, 1000);
      }
    } finally {
      this.mutex.release();
    }
  }

  /**
   * リトライ付きマージ実行
   */
  private async executeMergeWithRetry(item: MergeQueueItem): Promise<boolean> {
    while (item.retryCount < this.maxRetries) {
      try {
        console.log(`\n🔄 マージ試行 ${item.retryCount + 1}/${this.maxRetries}: ${item.task.title}`);

        // Step 1: 最新のメインブランチを取り込む
        const pullSuccess = await this.pullLatestMain(item.task);
        if (!pullSuccess) {
          console.error(`❌ ローカルメインブランチのマージ失敗`);
          item.retryCount++;
          continue;
        }

        // Step 2: コンフリクトチェック
        const hasConflict = await this.detectConflict(item.task.worktreePath!);
        if (hasConflict) {
          console.log(`⚠️ コンフリクト検出 - コンフリクト解消タスクを作成`);
          // コンフリクト検出イベントを発火
          this.eventEmitter.emitMergeConflictDetected(
            item.task,
            item.finalResult,
            item.reviewHistory,
            item.engineerId
          );
          // コンフリクト検出フラグを設定
          item.conflictDetected = true;
          // コンフリクト検出時はマージを中断し、cleanup処理は行わない
          return false;
        }

        // Step 3: 最終マージ実行
        const mergeSuccess = await this.executeFinalMerge(item.task);
        if (mergeSuccess) {
          return true;
        }

        item.retryCount++;
      } catch (error) {
        console.error(`❌ マージ処理エラー (試行 ${item.retryCount + 1}):`, error);
        item.retryCount++;
      }
    }

    return false;
  }

  /**
   * 最新のメインブランチを取り込む
   */
  private async pullLatestMain(task: Task): Promise<boolean> {
    if (!task.worktreePath || !task.branchName) {
      console.error(`❌ ワークツリー情報が不足`);
      return false;
    }

    try {
      console.log(`📥 ローカルのメインブランチをマージ中...`);

      // ワークツリーでフィーチャーブランチを確認
      execSync(`git checkout ${task.branchName}`, {
        cwd: task.worktreePath,
        stdio: 'pipe'
      });

      // ローカルのメインブランチの最新状態を取得
      // （ローカル開発環境なので、リモートfetchは不要）

      // メインブランチをマージ
      try {
        execSync(`git merge ${this.config.baseBranch}`, {
          cwd: task.worktreePath,
          stdio: 'pipe'
        });
        console.log(`✅ ローカルメインブランチのマージ完了`);
        return true;
      } catch (mergeError) {
        // マージエラーの場合、コンフリクトの可能性
        console.log(`⚠️ マージ中にエラー発生（コンフリクトの可能性）`);
        return true; // コンフリクトは次のステップで処理
      }
    } catch (error) {
      console.error(`❌ ローカルメインブランチのマージエラー:`, error);
      return false;
    }
  }

  /**
   * コンフリクトの検出
   */
  private async detectConflict(repoPath: string): Promise<boolean> {
    try {
      const status = execSync('git status --porcelain', {
        cwd: repoPath,
        encoding: 'utf-8',
        stdio: 'pipe'
      });

      // マージコンフリクトのマーカーを探す
      return status.includes('UU ') || status.includes('AA ') || status.includes('DD ');
    } catch (error) {
      return false;
    }
  }

  /**
   * 最終マージの実行
   */
  private async executeFinalMerge(task: Task): Promise<boolean> {
    if (!task.branchName) return false;

    try {
      console.log(`🔀 メインブランチへの最終マージ実行中...`);

      // メインリポジトリでメインブランチに切り替え
      execSync(`git checkout ${this.config.baseBranch}`, {
        cwd: this.config.baseRepoPath,
        stdio: 'pipe'
      });

      // フィーチャーブランチをマージ
      execSync(`git merge --no-ff ${task.branchName}`, {
        cwd: this.config.baseRepoPath,
        stdio: 'pipe'
      });

      console.log(`✅ マージ完了: ${task.branchName} -> ${this.config.baseBranch}`);
      return true;
    } catch (error) {
      console.error(`❌ 最終マージエラー:`, error);

      // マージを中止
      try {
        execSync(`git merge --abort`, {
          cwd: this.config.baseRepoPath,
          stdio: 'pipe'
        });
      } catch (e) {
        // 中止エラーは無視
      }

      return false;
    }
  }

  /**
   * マージ後のクリーンアップ
   */
  private async cleanup(task: Task): Promise<void> {
    if (!task.branchName) return;

    try {
      console.log(`🧹 クリーンアップ開始: ${task.title}`);

      // ワークツリーの削除
      await this.gitManager.removeWorktree(task.id);

      // フィーチャーブランチの削除（マージ成功時のみ）
      // worktreeで使用中でないことを確認してから削除
      try {
        const worktreeList = execSync('git worktree list --porcelain', {
          cwd: this.config.baseRepoPath,
          encoding: 'utf-8',
          stdio: 'pipe'
        });
        
        const isCheckedOut = worktreeList.includes(`branch refs/heads/${task.branchName}`);
        if (isCheckedOut) {
          console.log(`⚠️ ブランチ ${task.branchName} はworktreeで使用中のため削除をスキップ`);
        } else {
          // コンフリクト解消タスクの場合はブランチを削除しない
          const isConflictResolution = task.isConflictResolution || task.type === 'conflict-resolution';
          
          console.log(`🔍 ブランチ削除判定: タスクタイプ="${task.type}" isConflictResolution=${task.isConflictResolution} 削除スキップ=${isConflictResolution}`);
          
          if (isConflictResolution) {
            console.log(`🔄 コンフリクト解消タスクのためブランチを保持: ${task.branchName}`);
          } else {
            execSync(`git branch -d ${task.branchName}`, {
              cwd: this.config.baseRepoPath,
              stdio: 'pipe'
            });
            console.log(`🗑️ ブランチ削除完了: ${task.branchName}`);
          }
        }
      } catch (branchError) {
        console.warn(`⚠️ ブランチ削除中にエラー: ${branchError}`);
      }

      console.log(`✅ クリーンアップ完了`);
    } catch (error) {
      console.warn(`⚠️ クリーンアップ中にエラー:`, error);
    }
  }

  /**
   * キューの統計情報
   */
  getStats(): {
    queueLength: number;
    isProcessing: boolean;
  } {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing
    };
  }

  /**
   * マージキューを停止
   */
  stop(): void {
    console.log('🛑 マージキューを停止中...');
    // 停止フラグを設定
    this.isStopped = true;
    // キューをクリア
    this.queue = [];
    // 処理中フラグをリセット
    this.isProcessing = false;
    // Mutexを解放
    this.mutex.release();
  }

  /**
   * キューをクリア
   */
  clear(): void {
    this.queue = [];
  }
}