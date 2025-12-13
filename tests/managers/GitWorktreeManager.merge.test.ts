/**
 * GitWorktreeManager.merge() Tests
 *
 * TDD tests for worktree branch merging functionality.
 * Tests cover:
 * - Successful merge without conflicts
 * - Merge with conflict detection
 * - Conflict file extraction
 * - Conflict details extraction
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GitWorktreeManager } from '../../src/managers/GitWorktreeManager.js';

// Test utilities
function createTempGitRepo(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-merge-test-'));
  execSync('git init', { cwd: tempDir });
  execSync('git config user.email "test@test.com"', { cwd: tempDir });
  execSync('git config user.name "Test User"', { cwd: tempDir });

  // Create initial commit
  fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test Repo\n');
  execSync('git add .', { cwd: tempDir });
  execSync('git commit -m "Initial commit"', { cwd: tempDir });

  return tempDir;
}

function cleanupTempDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

describe('GitWorktreeManager.merge()', () => {
  let tempRepoPath: string;
  let worktreeBasePath: string;
  let manager: GitWorktreeManager;

  beforeEach(() => {
    tempRepoPath = createTempGitRepo();
    worktreeBasePath = path.join(tempRepoPath, 'worktrees');
    manager = new GitWorktreeManager(tempRepoPath, worktreeBasePath, 'main');
  });

  afterEach(() => {
    cleanupTempDir(tempRepoPath);
  });

  describe('Successful merge', () => {
    it('should merge branch without conflicts', async () => {
      // Create a feature branch with changes
      execSync('git checkout -b feature/test-merge', { cwd: tempRepoPath });
      fs.writeFileSync(path.join(tempRepoPath, 'new-file.txt'), 'New content\n');
      execSync('git add .', { cwd: tempRepoPath });
      execSync('git commit -m "Add new file"', { cwd: tempRepoPath });
      execSync('git checkout main', { cwd: tempRepoPath });

      // Perform merge
      const result = await manager.merge({
        source: tempRepoPath,
        sourceBranch: 'feature/test-merge',
        target: tempRepoPath,
        targetBranch: 'main',
        strategy: 'merge',
      });

      expect(result.success).toBe(true);
      expect(result.hasConflict).toBe(false);
      expect(result.conflictFiles).toBeUndefined();

      // Verify file was merged
      expect(fs.existsSync(path.join(tempRepoPath, 'new-file.txt'))).toBe(true);
    });

    it('should return success when merging identical branches', async () => {
      // No changes - merge should succeed
      execSync('git checkout -b feature/no-changes', { cwd: tempRepoPath });
      execSync('git checkout main', { cwd: tempRepoPath });

      const result = await manager.merge({
        source: tempRepoPath,
        sourceBranch: 'feature/no-changes',
        target: tempRepoPath,
        targetBranch: 'main',
        strategy: 'merge',
      });

      expect(result.success).toBe(true);
      expect(result.hasConflict).toBe(false);
    });
  });

  describe('Conflict detection', () => {
    it('should detect merge conflicts', async () => {
      // Create conflicting changes
      // Main branch: modify README.md
      fs.writeFileSync(path.join(tempRepoPath, 'README.md'), '# Main Branch Changes\n');
      execSync('git add .', { cwd: tempRepoPath });
      execSync('git commit -m "Main branch change"', { cwd: tempRepoPath });

      // Feature branch: modify same file differently
      execSync('git checkout -b feature/conflict HEAD~1', { cwd: tempRepoPath });
      fs.writeFileSync(path.join(tempRepoPath, 'README.md'), '# Feature Branch Changes\n');
      execSync('git add .', { cwd: tempRepoPath });
      execSync('git commit -m "Feature branch change"', { cwd: tempRepoPath });
      execSync('git checkout main', { cwd: tempRepoPath });

      // Attempt merge - should detect conflict
      const result = await manager.merge({
        source: tempRepoPath,
        sourceBranch: 'feature/conflict',
        target: tempRepoPath,
        targetBranch: 'main',
        strategy: 'merge',
      });

      expect(result.success).toBe(false);
      expect(result.hasConflict).toBe(true);
      expect(result.conflictFiles).toContain('README.md');
    });

    it('should return conflict details with ours and theirs content', async () => {
      // Create conflicting changes
      const mainContent = '# Main Branch Content\nLine 2\n';
      const featureContent = '# Feature Branch Content\nLine 2\n';

      fs.writeFileSync(path.join(tempRepoPath, 'README.md'), mainContent);
      execSync('git add .', { cwd: tempRepoPath });
      execSync('git commit -m "Main branch change"', { cwd: tempRepoPath });

      execSync('git checkout -b feature/conflict-details HEAD~1', { cwd: tempRepoPath });
      fs.writeFileSync(path.join(tempRepoPath, 'README.md'), featureContent);
      execSync('git add .', { cwd: tempRepoPath });
      execSync('git commit -m "Feature branch change"', { cwd: tempRepoPath });
      execSync('git checkout main', { cwd: tempRepoPath });

      const result = await manager.merge({
        source: tempRepoPath,
        sourceBranch: 'feature/conflict-details',
        target: tempRepoPath,
        targetBranch: 'main',
        strategy: 'merge',
      });

      expect(result.hasConflict).toBe(true);
      expect(result.conflictDetails).toBeDefined();
      expect(result.conflictDetails?.length).toBeGreaterThan(0);

      const readmeConflict = result.conflictDetails?.find(d => d.file === 'README.md');
      expect(readmeConflict).toBeDefined();
      expect(readmeConflict?.ours).toContain('Main Branch Content');
      expect(readmeConflict?.theirs).toContain('Feature Branch Content');
    });

    it('should detect multiple conflict files', async () => {
      // Create multiple conflicting files
      fs.writeFileSync(path.join(tempRepoPath, 'file1.txt'), 'Main content 1\n');
      fs.writeFileSync(path.join(tempRepoPath, 'file2.txt'), 'Main content 2\n');
      execSync('git add .', { cwd: tempRepoPath });
      execSync('git commit -m "Main branch changes"', { cwd: tempRepoPath });

      execSync('git checkout -b feature/multi-conflict HEAD~1', { cwd: tempRepoPath });
      fs.writeFileSync(path.join(tempRepoPath, 'file1.txt'), 'Feature content 1\n');
      fs.writeFileSync(path.join(tempRepoPath, 'file2.txt'), 'Feature content 2\n');
      execSync('git add .', { cwd: tempRepoPath });
      execSync('git commit -m "Feature branch changes"', { cwd: tempRepoPath });
      execSync('git checkout main', { cwd: tempRepoPath });

      const result = await manager.merge({
        source: tempRepoPath,
        sourceBranch: 'feature/multi-conflict',
        target: tempRepoPath,
        targetBranch: 'main',
        strategy: 'merge',
      });

      expect(result.hasConflict).toBe(true);
      expect(result.conflictFiles?.length).toBe(2);
      expect(result.conflictFiles).toContain('file1.txt');
      expect(result.conflictFiles).toContain('file2.txt');
    });
  });

  describe('Branch state after conflict', () => {
    it('should leave repo in clean state after conflict detection', async () => {
      // Create divergent branches with conflicting changes
      // First, create a feature branch from current state
      execSync('git checkout -b feature/state-test', { cwd: tempRepoPath });
      fs.writeFileSync(path.join(tempRepoPath, 'README.md'), '# Feature Branch Changes\nLine 2\n');
      execSync('git add .', { cwd: tempRepoPath });
      execSync('git commit -m "Feature change"', { cwd: tempRepoPath });

      // Go back to main and make conflicting change
      execSync('git checkout main', { cwd: tempRepoPath });
      fs.writeFileSync(path.join(tempRepoPath, 'README.md'), '# Main Branch Changes\nLine 2\n');
      execSync('git add .', { cwd: tempRepoPath });
      execSync('git commit -m "Main change"', { cwd: tempRepoPath });

      // Attempt merge - should detect conflict
      const result = await manager.merge({
        source: tempRepoPath,
        sourceBranch: 'feature/state-test',
        target: tempRepoPath,
        targetBranch: 'main',
        strategy: 'merge',
      });

      expect(result.hasConflict).toBe(true);

      // Check repo is in clean state (no merge in progress)
      const status = execSync('git status --porcelain', {
        cwd: tempRepoPath,
        encoding: 'utf-8',
      });
      expect(status.trim()).toBe('');
    });
  });

  describe('Edge cases', () => {
    it('should handle non-existent source branch', async () => {
      await expect(
        manager.merge({
          source: tempRepoPath,
          sourceBranch: 'non-existent-branch',
          target: tempRepoPath,
          targetBranch: 'main',
          strategy: 'merge',
        })
      ).rejects.toThrow();
    });

    it('should default to main branch when targetBranch is not specified', async () => {
      execSync('git checkout -b feature/default-target', { cwd: tempRepoPath });
      fs.writeFileSync(path.join(tempRepoPath, 'test.txt'), 'test\n');
      execSync('git add .', { cwd: tempRepoPath });
      execSync('git commit -m "Test"', { cwd: tempRepoPath });
      execSync('git checkout main', { cwd: tempRepoPath });

      const result = await manager.merge({
        source: tempRepoPath,
        sourceBranch: 'feature/default-target',
        target: tempRepoPath,
        strategy: 'merge',
      });

      expect(result.success).toBe(true);
    });
  });
});
