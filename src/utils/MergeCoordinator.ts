import { Task, EngineerResult, SystemConfig } from '../types';
import { EngineerAI } from '../managers/EngineerAI';
import { execSync } from 'child_process';

/**
 * 非同期Mutexの実装
 */
export class AsyncMutex {
  private locked = false;
  private waitingQueue: Array<{
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }> = [];

  /**
   * ロックを取得してコールバックを実行
   */
  async acquire<T>(callback: () => Promise<T>): Promise<T> {
    if (this.locked) {
      // キューに追加して待機
      await new Promise<void>((resolve, reject) => {
        this.waitingQueue.push({ resolve, reject });
      });
    }

    this.locked = true;
    
    try {
      const result = await callback();
      return result;
    } finally {
      this.locked = false;
      
      // 次の待機中の処理を開始
      if (this.waitingQueue.length > 0) {
        const next = this.waitingQueue.shift();
        if (next) {
          next.resolve(undefined);
        }
      }
    }
  }

  /**
   * ロック状態を確認
   */
  isLocked(): boolean {
    return this.locked;
  }

  /**
   * 待機中のタスク数を取得
   */
  getQueueLength(): number {
    return this.waitingQueue.length;
  }
}

/**
 * マージ処理の協調制御
 */
export class MergeCoordinator {
  private readonly mergeMutex = new AsyncMutex();
  private readonly config: SystemConfig;
  private readonly pendingConflictResolutions = new Map<string, Promise<EngineerResult>>();

  constructor(config: SystemConfig) {
    this.config = config;
  }

  /**
   * 排他制御によるマージ実行
   */
  async coordinatedMerge(
    task: Task,
    onConflictResolution?: (task: Task, engineerId: string, existingEngineer?: EngineerAI) => Promise<EngineerResult>
  ): Promise<{
    success: boolean;
    conflictResolutionInProgress?: boolean;
    error?: string;
  }> {
    console.log(`🔒 マージ待機中: ${task.title} (キュー: ${this.mergeMutex.getQueueLength()})`);
    
    return await this.mergeMutex.acquire(async () => {
      console.log(`🔀 マージ実行開始: ${task.title}`);
      
      try {
        // メインブランチの最新化
        await this.pullLatestMain();
        
        // マージ実行
        const mergeResult = await this.performMerge(task);
        
        if (mergeResult === true) {
          console.log(`✅ マージ成功: ${task.title}`);
          return { success: true };
        } else if (mergeResult === 'CONFLICT') {
          console.log(`⚠️ コンフリクト検出: ${task.title}`);
          
          // コンフリクト解消を非同期で開始（Mutex外で実行）
          if (onConflictResolution) {
            const conflictPromise = this.startConflictResolution(task, onConflictResolution);
            this.pendingConflictResolutions.set(task.id, conflictPromise);
            
            // Mutexを即座に解放してコンフリクト解消は並列実行
            return { 
              success: false, 
              conflictResolutionInProgress: true 
            };
          } else {
            return { 
              success: false, 
              error: 'コンフリクトが発生しましたが、解消処理が設定されていません' 
            };
          }
        } else {
          return { 
            success: false, 
            error: 'マージに失敗しました' 
          };
        }
      } catch (error) {
        console.error(`❌ マージ中にエラー: ${task.title}`, error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });
  }

  /**
   * コンフリクト解消を非同期で開始
   */
  private async startConflictResolution(
    task: Task,
    onConflictResolution: (task: Task, engineerId: string, existingEngineer?: EngineerAI) => Promise<EngineerResult>
  ): Promise<EngineerResult> {
    console.log(`🔧 コンフリクト解消開始（並列実行）: ${task.title}`);
    
    try {
      const engineerId = `conflict-resolver-${Date.now()}`;
      const result = await onConflictResolution(task, engineerId);
      
      console.log(`✅ コンフリクト解消完了: ${task.title}`);
      this.pendingConflictResolutions.delete(task.id);
      
      return result;
    } catch (error) {
      console.error(`❌ コンフリクト解消失敗: ${task.title}`, error);
      this.pendingConflictResolutions.delete(task.id);
      
      return {
        taskId: task.id,
        engineerId: `conflict-resolver-${Date.now()}`,
        success: false,
        output: [],
        error: error instanceof Error ? error.message : String(error),
        duration: 0,
        filesChanged: []
      };
    }
  }

  /**
   * メインブランチの最新化
   */
  private async pullLatestMain(): Promise<void> {
    try {
      console.log(`🔄 メインブランチを最新化中...`);
      
      // メインブランチに切り替え
      execSync(`git checkout ${this.config.baseBranch}`, {
        cwd: this.config.baseRepoPath,
        stdio: 'pipe'
      });
      
      // リモート使用設定とリモートリポジトリの存在確認
      const hasRemote = this.hasRemoteOrigin();
      
      if (this.config.useRemote && hasRemote) {
        console.log(`📡 リモートリポジトリから最新化`);
        execSync(`git pull origin ${this.config.baseBranch}`, {
          cwd: this.config.baseRepoPath,
          stdio: 'pipe'
        });
        console.log(`✅ メインブランチ最新化完了`);
      } else if (!this.config.useRemote) {
        console.log(`📂 ローカルモード - リモート更新をスキップ`);
      } else {
        console.log(`📂 リモートリポジトリなし - プルをスキップ`);
      }
      
    } catch (error) {
      console.warn(`⚠️ メインブランチ最新化でエラー（継続）:`, error);
      // プル失敗でも継続（ローカルのみの場合など）
    }
  }

  /**
   * リモートoriginの存在確認
   */
  private hasRemoteOrigin(): boolean {
    try {
      const remotes = execSync('git remote', {
        cwd: this.config.baseRepoPath,
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      
      return remotes.includes('origin');
    } catch (error) {
      return false;
    }
  }

  /**
   * マージ実行
   */
  private async performMerge(task: Task): Promise<boolean | 'CONFLICT'> {
    if (!task.branchName) {
      throw new Error(`ブランチ名が設定されていません: ${task.id}`);
    }

    const worktreePath = task.worktreePath;
    if (!worktreePath) {
      throw new Error(`Worktreeパスが設定されていません: ${task.id}`);
    }

    try {
      console.log(`🔀 マージ実行: ${task.branchName} -> ${this.config.baseBranch}`);

      // Step 1: worktree側でmainブランチをマージしてコンフリクトチェック
      console.log(`📥 worktree側でmainブランチをマージ中...`);
      
      execSync(`git merge ${this.config.baseBranch}`, {
        cwd: worktreePath,
        stdio: 'pipe'
      });

      // Step 2: worktree側でマージが成功したら、mainブランチに切り替えてフィーチャーブランチをマージ
      console.log(`📤 mainブランチにフィーチャーブランチをマージ中...`);
      
      execSync(`git checkout ${this.config.baseBranch}`, {
        cwd: this.config.baseRepoPath,
        stdio: 'pipe'
      });

      execSync(`git merge --no-ff ${task.branchName}`, {
        cwd: this.config.baseRepoPath,
        stdio: 'pipe'
      });

      return true;

    } catch (error) {
      // worktree側でのマージでコンフリクトが発生した場合
      const conflictDetected = await this.detectMergeConflictInWorktree(worktreePath);
      
      if (conflictDetected) {
        console.log(`⚠️ worktree側でコンフリクト検出: ${task.branchName}`);
        return 'CONFLICT';
      } else {
        // 通常のマージエラー - worktree側のマージを中止
        try {
          execSync(`git merge --abort`, {
            cwd: worktreePath,
            stdio: 'pipe'
          });
        } catch (abortError) {
          // 中止エラーは無視
        }
        
        // main側でもマージが失敗している可能性があるので中止
        try {
          execSync(`git merge --abort`, {
            cwd: this.config.baseRepoPath,
            stdio: 'pipe'
          });
        } catch (abortError) {
          // 中止エラーは無視
        }
        
        return false;
      }
    }
  }

  /**
   * マージコンフリクトの検出
   */
  private async detectMergeConflict(): Promise<boolean> {
    try {
      const status = execSync('git status --porcelain', {
        cwd: this.config.baseRepoPath,
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      
      // マージコンフリクトのマーカーを検索
      return status.includes('UU ') || status.includes('AA ') || status.includes('DD ');
    } catch (error) {
      return false;
    }
  }

  /**
   * worktree側でのマージコンフリクトの検出
   */
  private async detectMergeConflictInWorktree(worktreePath: string): Promise<boolean> {
    try {
      const status = execSync('git status --porcelain', {
        cwd: worktreePath,
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      
      // マージコンフリクトのマーカーを検索
      return status.includes('UU ') || status.includes('AA ') || status.includes('DD ');
    } catch (error) {
      return false;
    }
  }

  /**
   * コンフリクト解消の完了を待機
   */
  async waitForConflictResolution(taskId: string): Promise<EngineerResult | null> {
    const promise = this.pendingConflictResolutions.get(taskId);
    if (promise) {
      return await promise;
    }
    return null;
  }

  /**
   * 待機中のコンフリクト解消タスクの一覧を取得
   */
  getPendingConflictResolutions(): string[] {
    return Array.from(this.pendingConflictResolutions.keys());
  }

  /**
   * Mutexの状態を取得
   */
  getMutexStatus(): {
    isLocked: boolean;
    queueLength: number;
    pendingConflicts: number;
  } {
    return {
      isLocked: this.mergeMutex.isLocked(),
      queueLength: this.mergeMutex.getQueueLength(),
      pendingConflicts: this.pendingConflictResolutions.size
    };
  }
}