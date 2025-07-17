import { Task, EngineerResult, SystemConfig } from '../types/index.js';
import { EngineerAI } from '../managers/EngineerAI.js';
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
  private readonly completedConflictResolutions = new Map<string, EngineerResult>();
  private readonly taskRegistry = new Map<string, Task>();

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
    console.log(`🔒 [Merge Coordinator] マージ待機中: ${task.title} ("${task.branchName}" → "${this.config.baseBranch}") (キュー: ${this.mergeMutex.getQueueLength()})`);
    
    // Taskオブジェクトを登録
    this.taskRegistry.set(task.id, task);
    
    return await this.mergeMutex.acquire(async () => {
      console.log(`🔀 [Merge Coordinator] マージ実行開始: ${task.title} ("${task.branchName}" → "${this.config.baseBranch}")`);
      
      try {
        // メインブランチの最新化
        await this.pullLatestMain();
        
        // マージ実行
        const mergeResult = await this.performMerge(task);
        
        if (mergeResult === true) {
          console.log(`✅ [Merge Coordinator] マージ成功: ${task.title} ("${task.branchName}" → "${this.config.baseBranch}")`);
          return { success: true };
        } else if (mergeResult === 'CONFLICT') {
          console.log(`⚠️ [Merge Coordinator] コンフリクト検出: ${task.title} ("${task.branchName}" ⟷ "${this.config.baseBranch}")`);
          
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
        console.error(`❌ [Merge Coordinator] マージ中にエラー: ${task.title} ("${task.branchName}" → "${this.config.baseBranch}")`, error);
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
    console.log(`🔧 [Merge Coordinator] コンフリクト解消開始（並列実行）: ${task.title} ("${task.branchName}" ⟷ "${this.config.baseBranch}")`);
    
    try {
      const engineerId = `conflict-resolver-${Date.now()}`;
      const result = await onConflictResolution(task, engineerId);
      
      console.log(`✅ [Merge Coordinator] コンフリクト解消完了: ${task.title} ("${task.branchName}")`);
      
      // 結果に再レビューが必要であることを示すマーカーを追加
      result.needsReReview = true;
      
      // 完了した結果を保存してから pending から削除
      this.completedConflictResolutions.set(task.id, result);
      this.pendingConflictResolutions.delete(task.id);
      return result;
    } catch (error) {
      console.error(`❌ [Merge Coordinator] コンフリクト解消失敗: ${task.title} ("${task.branchName}")`, error);
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
      console.log(`🔄 [Merge Coordinator] メインブランチ "${this.config.baseBranch}" を最新化中...`);
      
      // メインブランチに切り替え
      execSync(`git checkout ${this.config.baseBranch}`, {
        cwd: this.config.baseRepoPath,
        stdio: 'pipe'
      });
      
      // リモート使用設定とリモートリポジトリの存在確認
      const hasRemote = this.hasRemoteOrigin();
      
      if (this.config.useRemote && hasRemote) {
        console.log(`📡 [Merge Coordinator] リモートリポジトリから "${this.config.baseBranch}" を最新化`);
        execSync(`git pull origin ${this.config.baseBranch}`, {
          cwd: this.config.baseRepoPath,
          stdio: 'pipe'
        });
        console.log(`✅ [Merge Coordinator] メインブランチ "${this.config.baseBranch}" 最新化完了`);
      } else if (!this.config.useRemote) {
        console.log(`📂 [Merge Coordinator] ローカルモード - リモート更新をスキップ`);
      } else {
        console.log(`📂 [Merge Coordinator] リモートリポジトリなし - プルをスキップ`);
      }
      
    } catch (error) {
      console.warn(`⚠️ [Merge Coordinator] メインブランチ "${this.config.baseBranch}" 最新化でエラー（継続）:`, error);
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

    console.log(`🔀 [Merge Coordinator] マージ実行開始: "${task.branchName}" → "${this.config.baseBranch}"`);
    console.log(`📋 [Merge Coordinator] タスク: ${task.title} (ID: ${task.id})`);

    // Step 1: worktree側でbaseBranchをマージしてコンフリクトチェック
    console.log(`📥 [Merge Coordinator] Worktree側で "${this.config.baseBranch}" をマージしてコンフリクトをチェック中...`);
    
    try {
      const worktreeMergeOutput = execSync(`git merge ${this.config.baseBranch}`, {
        cwd: worktreePath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      console.log(`✅ [Merge Coordinator] Worktree側でのマージ完了`);
      if (worktreeMergeOutput) {
        console.log(`📄 [Merge Coordinator] Worktreeマージ詳細:\n${worktreeMergeOutput}`);
      }

    } catch (worktreeError) {
      console.error(`❌ [Merge Coordinator] Worktree側でマージエラー: ${worktreeError}`);
      
      // worktree側でのマージでコンフリクトが発生した場合
      const conflictDetected = await this.detectMergeConflictInWorktree(worktreePath);
      
      if (conflictDetected) {
        console.log(`⚠️ [Merge Coordinator] Worktree側でコンフリクト検出: "${task.branchName}" ⟷ "${this.config.baseBranch}"`);
        return 'CONFLICT';
      } else {
        // 通常のマージエラー - worktree側のマージを中止
        try {
          execSync(`git merge --abort`, {
            cwd: worktreePath,
            stdio: 'pipe'
          });
          console.log(`🔄 [Merge Coordinator] Worktree側のマージを中止しました`);
        } catch (abortError) {
          console.warn(`⚠️ [Merge Coordinator] Worktreeマージ中止失敗: ${abortError}`);
        }
        
        return false;
      }
    }

    // Step 2: baseRepoPathでbaseBranchにチェックアウト
    console.log(`📤 [Merge Coordinator] "${this.config.baseBranch}" ブランチに切り替え中...`);
    
    try {
      const checkoutOutput = execSync(`git checkout ${this.config.baseBranch}`, {
        cwd: this.config.baseRepoPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      console.log(`✅ [Merge Coordinator] ベースブランチに切り替え完了`);
      if (checkoutOutput) {
        console.log(`📄 [Merge Coordinator] チェックアウト詳細:\n${checkoutOutput}`);
      }

    } catch (checkoutError) {
      console.error(`❌ [Merge Coordinator] ベースブランチへの切り替えエラー: ${checkoutError}`);
      return false;
    }

    // Step 3: baseRepoPathでtask.branchNameをマージ
    console.log(`🔗 [Merge Coordinator] "${task.branchName}" を "${this.config.baseBranch}" にマージ中...`);
    
    try {
      const mergeOutput = execSync(`git merge ${task.branchName}`, {
        cwd: this.config.baseRepoPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      console.log(`✅ [Merge Coordinator] マージ完了`);
      if (mergeOutput) {
        console.log(`📄 [Merge Coordinator] マージ詳細:\n${mergeOutput}`);
      }

    } catch (mergeError) {
      console.error(`❌ [Merge Coordinator] マージエラー: ${mergeError}`);
      
      // マージが失敗している可能性があるので中止
      try {
        execSync(`git merge --abort`, {
          cwd: this.config.baseRepoPath,
          stdio: 'pipe'
        });
        console.log(`🔄 [Merge Coordinator] ベースブランチのマージを中止しました`);
      } catch (abortError) {
        console.warn(`⚠️ [Merge Coordinator] ベースブランチマージ中止失敗: ${abortError}`);
      }
      
      return false;
    }

    // Step 4: マージ後の状態確認
    console.log(`🔍 [Merge Coordinator] マージ後の状態確認中...`);
    
    try {
      const statusOutput = execSync('git status --porcelain', {
        cwd: this.config.baseRepoPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      if (statusOutput.trim() === '') {
        console.log(`✅ [Merge Coordinator] マージ後の状態確認完了: クリーンな状態`);
      } else {
        console.warn(`⚠️ [Merge Coordinator] マージ後に未処理の変更が検出されました:`);
        console.warn(statusOutput);
        return false;
      }

    } catch (statusError) {
      console.error(`❌ [Merge Coordinator] マージ後の状態確認エラー: ${statusError}`);
      return false;
    }

    // Step 5: 最新のコミット情報を表示
    try {
      const latestCommit = execSync('git log --oneline -1', {
        cwd: this.config.baseRepoPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      console.log(`📝 [Merge Coordinator] 最新コミット:\n${latestCommit}`);

    } catch (commitError) {
      console.warn(`⚠️ [Merge Coordinator] 最新コミット情報の取得に失敗: ${commitError}`);
    }

    // Step 6: 変更されたファイルの確認
    try {
      const changedFiles = execSync(`git diff --name-only HEAD~1 HEAD`, {
        cwd: this.config.baseRepoPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      if (changedFiles && changedFiles.trim()) {
        console.log(`📁 [Merge Coordinator] 変更されたファイル:`);
        changedFiles.trim().split('\n').forEach(file => {
          console.log(`   - ${file}`);
        });
      } else {
        console.log(`📁 [Merge Coordinator] 変更されたファイル: なし`);
      }

    } catch (diffError) {
      console.warn(`⚠️ [Merge Coordinator] 変更ファイル情報の取得に失敗: ${diffError}`);
    }

    console.log(`🎉 [Merge Coordinator] マージ処理完了: "${task.branchName}" → "${this.config.baseBranch}"`);
    return true;
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
   * コンフリクト解消後の最終マージ実行（排他制御）
   */
  private async performFinalMerge(task: Task): Promise<boolean | 'CONFLICT'> {
    // Mutexで排他制御してマージを実行
    return await this.mergeMutex.acquire(async () => {
      try {
        console.log(`🔄 [Merge Coordinator] 最終マージ実行: ${task.title} ("${task.branchName}" → "${this.config.baseBranch}")`);
        
        // メインブランチを最新化
        await this.pullLatestMain();
        
        // マージを実行（コンフリクトチェック込み）
        const result = await this.performMerge(task);
        
        if (result === true) {
          // マージ成功 - クリーンアップは呼び出し元で実行
          console.log(`✅ [Merge Coordinator] 最終マージ成功: ${task.title} ("${task.branchName}" → "${this.config.baseBranch}")`);
        }
        
        return result;
      } catch (error) {
        console.error(`❌ [Merge Coordinator] 最終マージエラー: ${task.title} ("${task.branchName}" → "${this.config.baseBranch}")`, error);
        return false;
      }
    });
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
   * 登録されたTaskオブジェクトを取得
   */
  getTask(taskId: string): Task | undefined {
    return this.taskRegistry.get(taskId);
  }

  /**
   * 全ての保留中のコンフリクト解消処理の完了を待機
   */
  async waitForAllConflictResolutions(): Promise<Map<string, EngineerResult | null>> {
    const results = new Map<string, EngineerResult | null>();
    
    // 現在保留中のタスクIDを取得
    const pendingTaskIds = this.getPendingConflictResolutions();
    
    if (pendingTaskIds.length === 0) {
      // 保留中のタスクがない場合は、完了済みの結果を返す
      console.log(`ℹ️ 保留中のコンフリクト解消タスクはありません。完了済み: ${this.completedConflictResolutions.size}件`);
      return new Map(this.completedConflictResolutions);
    }

    console.log(`🔄 保留中のコンフリクト解消処理を待機中: ${pendingTaskIds.length}件`);
    
    // 全ての保留中のコンフリクト解消処理を並列で待機
    const promises = pendingTaskIds.map(async (taskId) => {
      const result = await this.waitForConflictResolution(taskId);
      results.set(taskId, result);
      return { taskId, result };
    });

    await Promise.all(promises);
    
    console.log(`✅ 全てのコンフリクト解消処理が完了しました`);
    
    // 完了済みの結果もマージして返す
    for (const [taskId, result] of this.completedConflictResolutions) {
      if (!results.has(taskId)) {
        results.set(taskId, result);
      }
    }
    
    return results;
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