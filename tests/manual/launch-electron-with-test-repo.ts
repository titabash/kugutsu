/**
 * Launch Electron with Test Repository
 *
 * ダミーのNext.jsプロジェクトを作成し、そのプロジェクトを開いた状態でElectronアプリを起動します。
 *
 * 使用方法:
 * ```bash
 * npm run electron:test-repo
 * ```
 *
 * 実行内容:
 * 1. test-electron-manual/ ディレクトリにNext.jsプロジェクトを作成
 * 2. Git リポジトリとして初期化（initial commit作成）
 * 3. Electronアプリを起動し、作成したプロジェクトを自動的に開く
 * 4. 以降は手動でElectron UIを操作してテスト
 *
 * 注意:
 * - リポジトリは自動削除されません（KEEP_TEST_WORKSPACE=1 相当）
 * - 手動でクリーンアップする場合: rm -rf test-electron-manual
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

async function launchElectronWithTestRepo() {
  console.log('🚀 Launch Electron with Test Repository');
  console.log('=' .repeat(60));
  console.log('');

  const testDir = './test-electron-manual';
  const absoluteTestDir = path.resolve(testDir);

  try {
    // 既存のテストディレクトリをクリーンアップ
    if (fsSync.existsSync(testDir)) {
      console.log('🧹 Cleaning up existing test directory...');
      await fs.rm(testDir, { recursive: true, force: true });
      console.log('✅ Cleanup completed');
      console.log('');
    }

    // ディレクトリ作成
    await fs.mkdir(testDir, { recursive: true });
    console.log(`📁 Created directory: ${testDir}`);
    console.log('');

    // Next.jsプロジェクトを作成
    console.log('📦 Creating Next.js app with create-next-app...');
    console.log('   This may take a moment...');
    console.log('');

    try {
      execSync(
        'npx create-next-app@latest . --typescript --app --tailwind --eslint --skip-install --yes',
        {
          cwd: testDir,
          stdio: 'inherit',
        }
      );
      console.log('');
      console.log('✅ Next.js app created successfully');
    } catch (error) {
      console.error('❌ Failed to create Next.js app:', error instanceof Error ? error.message : String(error));
      throw error;
    }

    console.log('');

    // Git リポジトリとして初期化
    console.log('📦 Initializing git repository...');

    // 既存の .git が存在する場合は削除（念のため）
    const gitDir = path.join(testDir, '.git');
    if (fsSync.existsSync(gitDir)) {
      await fs.rm(gitDir, { recursive: true, force: true });
    }

    // Git リポジトリを初期化
    execSync('git init', { cwd: testDir, stdio: 'pipe' });

    // Git設定
    execSync('git config user.email "test@example.com"', { cwd: testDir, stdio: 'pipe' });
    execSync('git config user.name "Test User"', { cwd: testDir, stdio: 'pipe' });

    // 初期コミット作成（worktree操作に必要）
    execSync('git add .', { cwd: testDir, stdio: 'pipe' });
    execSync('git commit -m "Initial commit"', { cwd: testDir, stdio: 'pipe' });

    console.log('✅ Git repository initialized with initial commit');
    console.log('');

    // プロジェクト情報を表示
    console.log('=' .repeat(60));
    console.log('✅ Test Repository Created Successfully');
    console.log('=' .repeat(60));
    console.log(`📁 Project Path: ${absoluteTestDir}`);
    console.log(`📂 Git Repository: Initialized with initial commit`);
    console.log(`🎯 Framework: Next.js (TypeScript, App Router, Tailwind CSS)`);
    console.log('');
    console.log('💡 You can manually test Kugutsu features:');
    console.log('   - Open Project workflow');
    console.log('   - Task creation and execution');
    console.log('   - Multi-engineer parallel development');
    console.log('   - Sprint-driven development');
    console.log('');
    console.log('🗑️  To clean up after testing:');
    console.log(`   rm -rf ${testDir}`);
    console.log('');
    console.log('=' .repeat(60));
    console.log('');

    // Electronアプリを起動
    console.log('🚀 Launching Electron app with test repository...');
    console.log('');

    // Electronアプリを起動（--project-pathでテストリポジトリを指定）
    // stdio: 'inherit' でElectronアプリの出力を表示
    execSync(`npm run electron -- --project-path "${absoluteTestDir}"`, {
      cwd: process.cwd(),
      stdio: 'inherit',
    });

  } catch (error) {
    console.error('');
    console.error('❌ Failed to launch Electron with test repository:');
    console.error(error);
    process.exit(1);
  }
}

// 実行
launchElectronWithTestRepo().catch(console.error);
