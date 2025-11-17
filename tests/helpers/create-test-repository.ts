/**
 * Test Repository Creator
 *
 * E2Eテスト用のNext.jsリポジトリを作成するヘルパー関数
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface CreateTestRepositoryOptions {
  /** リポジトリを作成するディレクトリ */
  targetDir: string;
  /** Git初期化を行うか（デフォルト: true） */
  initGit?: boolean;
  /** .kugutsu構造を作成するか（デフォルト: true） */
  createKugutsuStructure?: boolean;
  /** 詳細ログを表示するか（デフォルト: false） */
  verbose?: boolean;
}

/**
 * テスト用Next.jsリポジトリを作成
 */
export async function createTestRepository(
  options: CreateTestRepositoryOptions
): Promise<{ success: boolean; path: string; error?: string }> {
  const { targetDir, initGit = true, createKugutsuStructure = true, verbose = false } = options;

  const log = (...args: any[]) => {
    if (verbose) {
      console.log(...args);
    }
  };

  try {
    // クリーンアップ（既存のディレクトリを削除）
    await fs.rm(targetDir, { recursive: true, force: true });

    // ディレクトリ作成
    await fs.mkdir(targetDir, { recursive: true });
    log(`✅ Directory created: ${targetDir}`);

    // create-next-appでNext.jsプロジェクトを作成
    log('📦 Creating Next.js app with create-next-app...');
    log('   This may take a moment...');

    try {
      execSync(
        'npx create-next-app@latest . --typescript --app --tailwind --eslint --skip-install --yes',
        {
          cwd: targetDir,
          stdio: verbose ? 'inherit' : 'pipe',
        }
      );
      log('✅ Next.js app created successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Failed to create Next.js app:', errorMessage);
      return {
        success: false,
        path: targetDir,
        error: `Failed to create Next.js app: ${errorMessage}`,
      };
    }

    // Git初期化（オプション）
    if (initGit) {
      try {
        log('📦 Initializing git repository...');

        // 既存の .git が存在する場合は削除
        const gitDir = path.join(targetDir, '.git');
        if (fsSync.existsSync(gitDir)) {
          await fs.rm(gitDir, { recursive: true, force: true });
        }

        // Git リポジトリを初期化
        execSync('git init', { cwd: targetDir, stdio: 'pipe' });

        // Git設定
        execSync('git config user.email "test@example.com"', { cwd: targetDir, stdio: 'pipe' });
        execSync('git config user.name "Test User"', { cwd: targetDir, stdio: 'pipe' });

        // 初期コミット作成（worktree操作に必要）
        execSync('git add .', { cwd: targetDir, stdio: 'pipe' });
        execSync('git commit -m "Initial commit"', { cwd: targetDir, stdio: 'pipe' });

        log('✅ Git repository initialized with initial commit');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn('⚠️  Git initialization failed:', errorMessage);
        return {
          success: false,
          path: targetDir,
          error: `Git initialization failed: ${errorMessage}`,
        };
      }
    }

    // .kugutsu構造作成（オプション）
    if (createKugutsuStructure) {
      try {
        log('📁 Creating .kugutsu directory structure...');
        await createKugutsuDirectoryStructure(targetDir, verbose);
        log('✅ .kugutsu structure created');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn('⚠️  .kugutsu structure creation failed:', errorMessage);
        // Continue even if .kugutsu creation fails
      }
    }

    return {
      success: true,
      path: targetDir,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Repository creation failed:', errorMessage);
    return {
      success: false,
      path: targetDir,
      error: errorMessage,
    };
  }
}

/**
 * .kugutsuディレクトリ構造を作成
 */
async function createKugutsuDirectoryStructure(
  targetDir: string,
  verbose: boolean
): Promise<void> {
  const log = (...args: any[]) => {
    if (verbose) {
      console.log(...args);
    }
  };

  // ディレクトリ構造を作成
  const directories = [
    '.kugutsu',
    '.kugutsu/repository',
    '.kugutsu/repository/architecture',
    '.kugutsu/product-backlog',
    '.kugutsu/sprints',
  ];

  for (const dir of directories) {
    const fullPath = path.join(targetDir, dir);
    await fs.mkdir(fullPath, { recursive: true });
  }

  log('  ✓ Directory structure created');

  // 技術スタックファイルを作成
  const techStack = {
    languages: ['TypeScript', 'JavaScript'],
    frameworks: ['React', 'Next.js'],
    runtime: ['Node.js 20+'],
    packageManager: 'npm',
    buildTools: ['TypeScript Compiler', 'Next.js Build'],
    testingFrameworks: ['Jest', 'Playwright'],
    detectedAt: new Date().toISOString(),
  };

  const techStackPath = path.join(
    targetDir,
    '.kugutsu/repository/architecture/tech-stack.json'
  );

  await fs.writeFile(
    techStackPath,
    JSON.stringify(techStack, null, 2),
    'utf-8'
  );

  log('  ✓ tech-stack.json created');
}

/**
 * テスト用リポジトリをクリーンアップ
 */
export async function cleanupTestRepository(
  targetDir: string,
  options: { keepWorktrees?: boolean; verbose?: boolean } = {}
): Promise<void> {
  const { keepWorktrees = false, verbose = false } = options;

  const log = (...args: any[]) => {
    if (verbose) {
      console.log(...args);
    }
  };

  try {
    if (keepWorktrees) {
      // Git worktree メタデータをクリーンアップ
      try {
        execSync('git worktree prune', { cwd: targetDir, stdio: 'pipe' });
        log('🧹 Git worktree metadata cleaned up');
      } catch (pruneError) {
        // Ignore prune errors
      }

      // worktreesディレクトリのみ削除
      const worktreesPath = path.join(targetDir, 'worktrees');
      try {
        await fs.rm(worktreesPath, { recursive: true, force: true });
        log(`🗑️  Worktrees directory removed: ${worktreesPath}`);
      } catch (rmError) {
        // worktreesディレクトリが存在しない場合は無視
      }

      log(`✅ Repository preserved: ${targetDir}`);
      log('   (Only worktrees directory removed)');
    } else {
      // 完全削除
      await fs.rm(targetDir, { recursive: true, force: true });
      log(`🗑️  Repository completely removed: ${targetDir}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  Cleanup warning: ${errorMessage}`);
    console.log(`   You may need to manually clean: ${targetDir}`);
  }
}
