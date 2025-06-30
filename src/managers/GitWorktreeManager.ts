import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { WorktreeInfo, Task } from '../types/index.js';

/**
 * Git Worktree管理クラス
 */
export class GitWorktreeManager {
  private readonly baseRepoPath: string;
  private readonly worktreeBasePath: string;
  private readonly baseBranch: string;
  private readonly worktreeMutex = new Map<string, Promise<{ path: string; branchName: string }>>();

  constructor(baseRepoPath: string, worktreeBasePath: string, baseBranch: string = 'main') {
    this.baseRepoPath = path.resolve(baseRepoPath);
    this.worktreeBasePath = path.resolve(worktreeBasePath);
    this.baseBranch = baseBranch;
    
    // worktreeベースディレクトリを作成
    if (!fs.existsSync(this.worktreeBasePath)) {
      fs.mkdirSync(this.worktreeBasePath, { recursive: true });
    }
  }

  /**
   * タスクID用のworktreeを作成（新しいパイプラインシステム用）
   */
  async createWorktree(taskId: string): Promise<{ path: string; branchName: string }> {
    // 既存の作成処理を待つ（排他制御）
    if (this.worktreeMutex.has(taskId)) {
      console.log(`⏳ Worktree作成処理を待機中: task-${taskId}`);
      return await this.worktreeMutex.get(taskId)!;
    }

    // 既存のworktreeが存在する場合は再利用
    if (this.worktreeExists(taskId)) {
      const branchName = this.getBranchName(taskId);
      const worktreePath = this.getWorktreePath(taskId);
      console.log(`♻️ 既存のWorktreeを再利用: ${worktreePath}`);
      return { path: worktreePath, branchName };
    }

    // 新しい作成処理を開始
    const createPromise = this.doCreateWorktree(taskId);
    this.worktreeMutex.set(taskId, createPromise);
    
    try {
      const result = await createPromise;
      return result;
    } finally {
      this.worktreeMutex.delete(taskId);
    }
  }

  /**
   * タスクID用のworktreeを強制的に新規作成（依存関係解決後用）
   */
  async createWorktreeForced(taskId: string): Promise<{ path: string; branchName: string }> {
    console.log(`🔄 強制的に新規Worktreeを作成: task-${taskId}`);
    
    // 既存の作成処理を待つ（排他制御）
    if (this.worktreeMutex.has(taskId)) {
      console.log(`⏳ Worktree作成処理を待機中: task-${taskId}`);
      await this.worktreeMutex.get(taskId)!;
    }

    // 既存のworktreeを削除
    await this.removeWorktree(taskId);

    // 新しい作成処理を開始
    const createPromise = this.doCreateWorktree(taskId, true); // 強制フラグを渡す
    this.worktreeMutex.set(taskId, createPromise);
    
    try {
      const result = await createPromise;
      return result;
    } finally {
      this.worktreeMutex.delete(taskId);
    }
  }

  /**
   * タスクIDをサニタイズして安全なブランチ名を生成
   */
  private sanitizeTaskId(taskId: string): string {
    // 英数字、ハイフン、アンダースコアのみを許可
    // それ以外の文字はハイフンに置換
    return taskId.replace(/[^a-zA-Z0-9-_]/g, '-')
                 .replace(/--+/g, '-') // 連続するハイフンを1つに
                 .replace(/^-|-$/g, ''); // 先頭・末尾のハイフンを削除
  }

  /**
   * 実際のworktree作成処理
   */
  private async doCreateWorktree(taskId: string, forceNew: boolean = false): Promise<{ path: string; branchName: string }> {
    const sanitizedTaskId = this.sanitizeTaskId(taskId);
    const branchName = `feature/task-${sanitizedTaskId}`;
    const worktreePath = path.join(this.worktreeBasePath, `task-${sanitizedTaskId}`);

    try {
      // 既存のworktreeを削除（存在する場合）
      if (fs.existsSync(worktreePath)) {
        await this.removeWorktree(taskId);
      }

      // ブランチが存在するかチェック（強制作成の場合は既存ブランチを削除）
      let branchExists = false;
      try {
        execSync(`git rev-parse --quiet --verify ${branchName}`, {
          cwd: this.baseRepoPath,
          stdio: 'pipe'
        });
        branchExists = true;
        
        if (forceNew) {
          console.log(`🗑️ 既存ブランチを削除して新規作成: ${branchName}`);
          // 既存ブランチを強制削除
          try {
            execSync(`git branch -D ${branchName}`, {
              cwd: this.baseRepoPath,
              stdio: 'pipe'
            });
            branchExists = false;
          } catch (deleteError) {
            console.warn(`⚠️ ブランチ削除に失敗: ${deleteError}`);
          }
        } else {
          console.log(`♻️ 既存ブランチを再利用: ${branchName}`);
        }
      } catch {
        // ブランチが存在しない場合
        console.log(`🆕 新規ブランチを作成: ${branchName}`);
      }

      // ローカルのbaseBranchから最新の状態で開始
      const actionText = forceNew ? '最新の状態から再作成' : '作業を開始';
      console.log(`📍 ローカルの${this.baseBranch}ブランチから${actionText}`);
      // 注意: リモートからのfetch/pullは行わず、ローカルリポジトリで完結

      // worktreeを作成（既存ブランチの場合は-bオプションなし）
      const command = branchExists
        ? ['git', 'worktree', 'add', worktreePath, branchName]
        : ['git', 'worktree', 'add', '-b', branchName, worktreePath, this.baseBranch];

      console.log(`🌿 Worktree作成中: ${branchName} -> ${worktreePath}`);
      
      execSync(command.join(' '), {
        cwd: this.baseRepoPath,
        stdio: 'pipe'
      });

      console.log(`✅ Worktree作成完了: ${worktreePath}`);
      return { path: worktreePath, branchName };

    } catch (error) {
      console.error(`❌ Worktree作成エラー (task-${taskId}):`, error);
      throw new Error(`Failed to create worktree for task ${taskId}: ${error}`);
    }
  }

  /**
   * タスク用のworktreeを作成（レガシー用）
   */
  async createWorktreeForTask(task: Task, baseBranch: string = 'main'): Promise<string> {
    const branchName = `feature/task-${task.id}`;
    const worktreePath = path.join(this.worktreeBasePath, `task-${task.id}`);

    try {
      // 既存のworktreeを削除（存在する場合）
      if (fs.existsSync(worktreePath)) {
        await this.removeWorktree(task.id);
      }

      // ブランチが存在するかチェック
      let branchExists = false;
      try {
        execSync(`git rev-parse --quiet --verify ${branchName}`, {
          cwd: this.baseRepoPath,
          stdio: 'pipe'
        });
        branchExists = true;
        console.log(`♻️ 既存ブランチを再利用: ${branchName}`);
      } catch {
        // ブランチが存在しない場合
        console.log(`🆕 新規ブランチを作成: ${branchName}`);
      }

      // worktreeを作成（既存ブランチの場合は-bオプションなし）
      const command = branchExists
        ? ['git', 'worktree', 'add', worktreePath, branchName]
        : ['git', 'worktree', 'add', '-b', branchName, worktreePath, baseBranch];

      console.log(`🌿 Worktree作成中: ${branchName} -> ${worktreePath}`);
      
      execSync(command.join(' '), {
        cwd: this.baseRepoPath,
        stdio: 'pipe'
      });

      // タスクオブジェクトを更新
      task.branchName = branchName;
      task.worktreePath = worktreePath;

      console.log(`✅ Worktree作成完了: ${worktreePath}`);
      return worktreePath;

    } catch (error) {
      console.error(`❌ Worktree作成エラー (task-${task.id}):`, error);
      throw new Error(`Failed to create worktree for task ${task.id}: ${error}`);
    }
  }

  /**
   * worktreeを削除
   */
  async removeWorktree(taskId: string): Promise<void> {
    const sanitizedTaskId = this.sanitizeTaskId(taskId);
    const worktreePath = path.join(this.worktreeBasePath, `task-${sanitizedTaskId}`);

    try {
      if (fs.existsSync(worktreePath)) {
        console.log(`🗑️ Worktree削除中: ${worktreePath}`);
        
        execSync(`git worktree remove "${worktreePath}" --force`, {
          cwd: this.baseRepoPath,
          stdio: 'pipe'
        });

        console.log(`✅ Worktree削除完了: task-${taskId}`);
      }
    } catch (error) {
      console.error(`❌ Worktree削除エラー (task-${taskId}):`, error);
      // 削除に失敗してもエラーを投げない（継続可能な状態を維持）
    }
  }

  /**
   * 全てのworktreeをリスト表示
   */
  async listWorktrees(): Promise<WorktreeInfo[]> {
    try {
      const output = execSync('git worktree list --porcelain', {
        cwd: this.baseRepoPath,
        encoding: 'utf-8',
        stdio: 'pipe'
      });

      const worktrees: WorktreeInfo[] = [];
      const lines = output.trim().split('\n');
      
      let currentWorktree: Partial<WorktreeInfo> = {};
      
      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          if (currentWorktree.path) {
            worktrees.push(currentWorktree as WorktreeInfo);
          }
          currentWorktree = { path: line.substring(9) };
        } else if (line.startsWith('branch ')) {
          currentWorktree.branch = line.substring(7);
        } else if (line.startsWith('HEAD ')) {
          currentWorktree.commit = line.substring(5);
        } else if (line === 'locked') {
          currentWorktree.locked = true;
        } else if (line === '') {
          if (currentWorktree.path) {
            worktrees.push(currentWorktree as WorktreeInfo);
            currentWorktree = {};
          }
        }
      }
      
      // 最後のworktreeを追加
      if (currentWorktree.path) {
        worktrees.push(currentWorktree as WorktreeInfo);
      }

      return worktrees;

    } catch (error) {
      console.error('❌ Worktreeリスト取得エラー:', error);
      return [];
    }
  }

  /**
   * タスク完了後のクリーンアップ
   */
  async cleanupCompletedTask(taskId: string, options: { deleteBranch?: boolean } = {}): Promise<void> {
    const sanitizedTaskId = this.sanitizeTaskId(taskId);
    const branchName = `feature/task-${sanitizedTaskId}`;
    
    try {
      // worktreeを削除
      await this.removeWorktree(taskId);

      // ブランチを削除（オプション）
      if (options.deleteBranch) {
        try {
          execSync(`git branch -d ${branchName}`, {
            cwd: this.baseRepoPath,
            stdio: 'pipe'
          });
          console.log(`🗑️ ブランチ削除完了: ${branchName}`);
        } catch (branchError) {
          // -dで削除できない場合は-Dで強制削除を試みる
          try {
            execSync(`git branch -D ${branchName}`, {
              cwd: this.baseRepoPath,
              stdio: 'pipe'
            });
            console.log(`🗑️ ブランチ強制削除完了: ${branchName}`);
          } catch (forceBranchError) {
            console.warn(`⚠️ ブランチ削除中にエラー: ${forceBranchError}`);
          }
        }
      }

      console.log(`🧹 クリーンアップ完了: task-${taskId}`);

    } catch (error) {
      console.error(`❌ クリーンアップエラー (task-${taskId}):`, error);
    }
  }

  /**
   * 指定したタスクのworktreeパスを取得
   */
  getWorktreePath(taskId: string): string {
    const sanitizedTaskId = this.sanitizeTaskId(taskId);
    return path.join(this.worktreeBasePath, `task-${sanitizedTaskId}`);
  }

  /**
   * 指定したタスクのブランチ名を取得
   */
  getBranchName(taskId: string): string {
    const sanitizedTaskId = this.sanitizeTaskId(taskId);
    return `feature/task-${sanitizedTaskId}`;
  }

  /**
   * worktreeが存在するかチェック
   */
  worktreeExists(taskId: string): boolean {
    const worktreePath = this.getWorktreePath(taskId);
    return fs.existsSync(worktreePath) && fs.statSync(worktreePath).isDirectory();
  }

  /**
   * 全てのタスクworktreeをクリーンアップ
   */
  async cleanupAllTaskWorktrees(): Promise<void> {
    try {
      const worktrees = await this.listWorktrees();
      
      for (const worktree of worktrees) {
        if (worktree.branch && worktree.branch.startsWith('feature/task-')) {
          const taskId = worktree.branch.replace('feature/task-', '');
          await this.removeWorktree(taskId);
        }
      }

      console.log('🧹 全タスクworktreeのクリーンアップ完了');

    } catch (error) {
      console.error('❌ 全クリーンアップエラー:', error);
    }
  }

}