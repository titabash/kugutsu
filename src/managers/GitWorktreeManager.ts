import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { WorktreeInfo, Task } from '../types';

/**
 * Git Worktree管理クラス
 */
export class GitWorktreeManager {
  private readonly baseRepoPath: string;
  private readonly worktreeBasePath: string;

  constructor(baseRepoPath: string, worktreeBasePath: string) {
    this.baseRepoPath = path.resolve(baseRepoPath);
    this.worktreeBasePath = path.resolve(worktreeBasePath);
    
    // worktreeベースディレクトリを作成
    if (!fs.existsSync(this.worktreeBasePath)) {
      fs.mkdirSync(this.worktreeBasePath, { recursive: true });
    }
  }

  /**
   * タスク用のworktreeを作成
   */
  async createWorktree(task: Task, baseBranch: string = 'main'): Promise<string> {
    const branchName = `feature/task-${task.id}`;
    const worktreePath = path.join(this.worktreeBasePath, `task-${task.id}`);

    try {
      // 既存のworktreeを削除（存在する場合）
      if (fs.existsSync(worktreePath)) {
        await this.removeWorktree(task.id);
      }

      // 新しいブランチとworktreeを作成
      const command = [
        'git', 'worktree', 'add',
        '-b', branchName,
        worktreePath,
        baseBranch
      ];

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
    const worktreePath = path.join(this.worktreeBasePath, `task-${taskId}`);

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
  async cleanupCompletedTask(taskId: string): Promise<void> {
    const branchName = `feature/task-${taskId}`;
    
    try {
      // worktreeを削除
      await this.removeWorktree(taskId);

      // ブランチを削除（オプション - 設定で制御可能）
      // execSync(`git branch -D ${branchName}`, {
      //   cwd: this.baseRepoPath,
      //   stdio: 'pipe'
      // });

      console.log(`🧹 クリーンアップ完了: task-${taskId}`);

    } catch (error) {
      console.error(`❌ クリーンアップエラー (task-${taskId}):`, error);
    }
  }

  /**
   * 指定したタスクのworktreeパスを取得
   */
  getWorktreePath(taskId: string): string {
    return path.join(this.worktreeBasePath, `task-${taskId}`);
  }

  /**
   * 指定したタスクのブランチ名を取得
   */
  getBranchName(taskId: string): string {
    return `feature/task-${taskId}`;
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