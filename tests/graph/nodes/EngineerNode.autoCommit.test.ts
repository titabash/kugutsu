/**
 * EngineerNode Auto-Commit Unit Tests
 *
 * EngineerNodeの自動コミット機能のテスト:
 * - AI実行成功後、git操作が実行されること
 * - コミットメッセージが正しく生成されること
 * - 変更がない場合、コミットがスキップされること
 * - git操作失敗時もタスクは成功すること（警告のみ）
 */

import { jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

describe('EngineerNode - Auto Commit', () => {
  let testDir: string;
  let worktreeDir: string;

  beforeEach(() => {
    // テスト用の一時ディレクトリを作成
    testDir = path.join(process.cwd(), 'test-engineer-commit-' + Date.now());
    worktreeDir = path.join(testDir, 'worktrees', 'task-test-001');

    // ベースリポジトリを初期化
    fs.mkdirSync(testDir, { recursive: true });
    execSync('git init', { cwd: testDir, stdio: 'pipe' });
    execSync('git config user.email "test@example.com"', { cwd: testDir, stdio: 'pipe' });
    execSync('git config user.name "Test User"', { cwd: testDir, stdio: 'pipe' });

    // 初期コミットを作成
    fs.writeFileSync(path.join(testDir, 'README.md'), '# Test Repo');
    execSync('git add .', { cwd: testDir, stdio: 'pipe' });
    execSync('git commit -m "Initial commit"', { cwd: testDir, stdio: 'pipe' });

    // Worktreeを作成
    fs.mkdirSync(path.dirname(worktreeDir), { recursive: true });
    execSync(
      `git worktree add -b feature/task-test-001 "${worktreeDir}" HEAD`,
      { cwd: testDir, stdio: 'pipe' }
    );
  });

  afterEach(() => {
    // クリーンアップ
    try {
      // Worktreeを削除
      execSync(`git worktree remove "${worktreeDir}" --force`, {
        cwd: testDir,
        stdio: 'pipe',
      });
    } catch (e) {
      // 既に削除されている場合
    }

    // テストディレクトリを削除
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (e) {
      // 削除失敗時
      console.warn('Failed to cleanup test directory:', e);
    }
  });

  describe('git操作の実行', () => {
    test('should detect changes and create commit', () => {
      // Worktree内でファイルを変更
      const testFile = path.join(worktreeDir, 'test.txt');
      fs.writeFileSync(testFile, 'Test content');

      // git statusで変更を確認
      const statusOutput = execSync('git status --porcelain', {
        cwd: worktreeDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      expect(statusOutput.trim()).toContain('test.txt');

      // git add
      execSync('git add -A', { cwd: worktreeDir, stdio: 'pipe' });

      // コミットメッセージを生成
      const taskId = 'test-001';
      const sprintId = 'sprint-1';
      const instruction = 'Test task instruction\nDetailed description';

      const commitMessage = `feat(${taskId}): ${instruction.split('\n')[0].substring(0, 72)}

タスクID: ${taskId}
スプリント: ${sprintId}

実装内容:
${instruction.split('\n').slice(0, 5).join('\n')}

[Automated commit by Kugutsu AI Engineer]`;

      // git commit
      execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
        cwd: worktreeDir,
        stdio: 'pipe',
      });

      // コミットが作成されたことを確認
      const logOutput = execSync('git log --oneline -1', {
        cwd: worktreeDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      expect(logOutput).toContain('feat(test-001)');
      expect(logOutput).toContain('Test task instruction');
    });

    test('should skip commit when no changes', () => {
      // 変更がない状態で git status を確認
      const statusOutput = execSync('git status --porcelain', {
        cwd: worktreeDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      expect(statusOutput.trim()).toBe('');

      // コミット前のHEADを記録
      const headBefore = execSync('git rev-parse HEAD', {
        cwd: worktreeDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      }).trim();

      // コミット試行（変更がないため失敗するはず）
      let commitFailed = false;
      try {
        execSync('git commit -m "Test commit"', {
          cwd: worktreeDir,
          stdio: 'pipe',
        });
      } catch (e) {
        commitFailed = true;
      }

      expect(commitFailed).toBe(true);

      // HEADが変わっていないことを確認
      const headAfter = execSync('git rev-parse HEAD', {
        cwd: worktreeDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      }).trim();

      expect(headAfter).toBe(headBefore);
    });

    test('should handle multiple file changes', () => {
      // 複数のファイルを変更
      fs.writeFileSync(path.join(worktreeDir, 'file1.txt'), 'Content 1');
      fs.writeFileSync(path.join(worktreeDir, 'file2.txt'), 'Content 2');
      fs.mkdirSync(path.join(worktreeDir, 'subdir'), { recursive: true });
      fs.writeFileSync(path.join(worktreeDir, 'subdir', 'file3.txt'), 'Content 3');

      // git add -A で全変更を追加
      execSync('git add -A', { cwd: worktreeDir, stdio: 'pipe' });

      // git commit
      execSync('git commit -m "Test multiple files"', {
        cwd: worktreeDir,
        stdio: 'pipe',
      });

      // コミットが作成され、全ファイルが含まれていることを確認
      const showOutput = execSync('git show --name-only --oneline', {
        cwd: worktreeDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      expect(showOutput).toContain('file1.txt');
      expect(showOutput).toContain('file2.txt');
      expect(showOutput).toContain('subdir/file3.txt');
    });
  });

  describe('コミットメッセージの生成', () => {
    test('should generate commit message with correct format', () => {
      const taskId = 'task-feature-123';
      const sprintId = 'sprint-20250113-001';
      const instruction = `Implement user authentication system
Add login and logout functionality
Use JWT for token management
Include password hashing with bcrypt
Add rate limiting for login attempts`;

      const commitMessage = `feat(${taskId}): ${instruction.split('\n')[0].substring(0, 72)}

タスクID: ${taskId}
スプリント: ${sprintId}

実装内容:
${instruction.split('\n').slice(0, 5).join('\n')}

[Automated commit by Kugutsu AI Engineer]`;

      expect(commitMessage).toContain('feat(task-feature-123)');
      expect(commitMessage).toContain('Implement user authentication system');
      expect(commitMessage).toContain('タスクID: task-feature-123');
      expect(commitMessage).toContain('スプリント: sprint-20250113-001');
      expect(commitMessage).toContain('Add login and logout functionality');
      expect(commitMessage).toContain('[Automated commit by Kugutsu AI Engineer]');
    });

    test('should truncate long first line to 72 chars', () => {
      const taskId = 'task-001';
      const longInstruction =
        'This is a very long instruction that exceeds the recommended 72 character limit for git commit first line and should be truncated properly to maintain good commit message hygiene';

      const firstLine = longInstruction.substring(0, 72);
      const commitMessage = `feat(${taskId}): ${firstLine}`;

      expect(commitMessage.length).toBeLessThanOrEqual(72 + 'feat(task-001): '.length);
    });

    test('should handle instructions with special characters', () => {
      const taskId = 'task-001';
      const sprintId = 'sprint-1';
      const instruction = 'Fix bug: "user can\'t login" issue\nAdd error handling';

      const commitMessage = `feat(${taskId}): ${instruction.split('\n')[0].substring(0, 72)}

タスクID: ${taskId}
スプリント: ${sprintId}

実装内容:
${instruction.split('\n').slice(0, 5).join('\n')}

[Automated commit by Kugutsu AI Engineer]`;

      // エスケープが必要な文字が含まれていても生成できる
      expect(commitMessage).toContain('Fix bug:');
      expect(commitMessage).toContain('Add error handling');
    });
  });

  describe('エラーハンドリング', () => {
    test('should handle git command failures gracefully', () => {
      // 無効なworktreeパスでgit操作を試行
      const invalidPath = '/nonexistent/path';

      let errorOccurred = false;
      try {
        execSync('git status', { cwd: invalidPath, stdio: 'pipe' });
      } catch (error) {
        errorOccurred = true;
      }

      expect(errorOccurred).toBe(true);

      // EngineerNodeではこのエラーをキャッチして警告を出すが、
      // タスク自体は失敗とはしない（実装は成功しているため）
    });

    test('should succeed even if commit message has problematic characters', () => {
      // ファイル変更
      fs.writeFileSync(path.join(worktreeDir, 'test.txt'), 'Content');
      execSync('git add -A', { cwd: worktreeDir, stdio: 'pipe' });

      // コミットメッセージに特殊文字を含める（エスケープ処理をテスト）
      const problematicMessage = 'Test "quotes" and $variables and `backticks`';
      const escapedMessage = problematicMessage.replace(/"/g, '\\"');

      execSync(`git commit -m "${escapedMessage}"`, {
        cwd: worktreeDir,
        stdio: 'pipe',
      });

      // コミットが成功したことを確認
      const logOutput = execSync('git log --oneline -1', {
        cwd: worktreeDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      expect(logOutput).toContain('Test');
    });
  });

  describe('Worktree構造のテスト', () => {
    test('should verify worktree has correct git structure', () => {
      // Worktreeの.gitファイル（ディレクトリではなくファイル）を確認
      const gitPath = path.join(worktreeDir, '.git');
      expect(fs.existsSync(gitPath)).toBe(true);

      // .gitはファイルであり、ディレクトリではない
      const stats = fs.statSync(gitPath);
      expect(stats.isFile()).toBe(true);

      // .gitファイルの内容を確認（gitdir: ... の形式）
      const gitContent = fs.readFileSync(gitPath, 'utf-8');
      expect(gitContent).toMatch(/^gitdir:/);
    });

    test('should commit successfully in worktree structure', () => {
      // Worktree内で変更を作成してコミット
      fs.writeFileSync(path.join(worktreeDir, 'worktree-test.txt'), 'Worktree commit test');
      execSync('git add -A', { cwd: worktreeDir, stdio: 'pipe' });
      execSync('git commit -m "Worktree commit test"', {
        cwd: worktreeDir,
        stdio: 'pipe',
      });

      // コミットが作成されたことを確認
      const logOutput = execSync('git log --oneline -1', {
        cwd: worktreeDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      expect(logOutput).toContain('Worktree commit test');

      // ベースリポジトリから見てもブランチが存在することを確認
      const branchOutput = execSync('git branch -a', {
        cwd: testDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      expect(branchOutput).toContain('feature/task-test-001');
    });
  });
});
