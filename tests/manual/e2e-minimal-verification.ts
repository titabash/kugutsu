/**
 * E2E Minimal Verification
 *
 * Claude Code環境でのE2E検証（API key不要）
 *
 * 検証内容:
 * - ProductOwnerNode: タスク分解
 * - EngineerNode: 実装
 * - ReviewNode: レビュー
 * - MergeCoordinatorNode: マージ
 *
 * 実行方法:
 * ```bash
 * npm run verify:e2e-minimal
 * ```
 */

import { compileParallelDevGraph } from '../../src/graph/ParallelDevGraph.js';
import { createInitialState } from '../../src/graph/state.js';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

async function runE2EMinimalVerification() {
  console.log('🚀 E2E Minimal Verification');
  console.log('=' .repeat(60));

  // テスト用ワークスペース作成
  const testDir = './test-e2e-minimal';
  const kugutsuDir = path.join(testDir, '.kugutsu');

  try {
    // クリーンアップ（既存のテストディレクトリを削除）
    await fs.rm(testDir, { recursive: true, force: true });

    // ディレクトリ作成
    await fs.mkdir(testDir, { recursive: true });

    console.log('📦 Creating Next.js app with create-next-app...');
    console.log('   This may take a moment...');

    // create-next-appでNext.jsプロジェクトを作成
    const { execSync } = await import('child_process');
    try {
      execSync(
        'npx create-next-app@latest . --typescript --app --tailwind --eslint --skip-install --yes',
        {
          cwd: testDir,
          stdio: 'inherit', // 出力を表示
        }
      );
      console.log('✅ Next.js app created successfully');
    } catch (error) {
      console.error('❌ Failed to create Next.js app:', error instanceof Error ? error.message : String(error));
      throw error;
    }

    console.log(`✅ Test workspace created: ${testDir}`);

    // Git リポジトリとして初期化（create-next-appが親リポジトリ内で実行された場合はgit initをスキップするため）
    try {
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
    } catch (error) {
      console.error('⚠️  Git initialization failed:', error instanceof Error ? error.message : String(error));
      console.log('Continuing anyway (may affect worktree operations)...');
    }
    console.log('');

    // タスク内容: Next.jsアプリへの機能追加
    const taskRequest = 'Add a new page at /about that displays "About Us" heading and a brief description';

    console.log(`📝 Task Request: ${taskRequest}`);
    console.log('');

    // 初期状態作成
    const initialState = createInitialState(taskRequest, {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: testDir,
      worktreeBasePath: path.join(testDir, 'worktrees'),
      provider: 'claude', // Claude Code環境ではログイン済みセッションを使用
    });

    console.log('🔧 Configuration:');
    console.log(`  - Max Engineers: 1`);
    console.log(`  - Max Turns: 30`);
    console.log(`  - Base Repo: ${testDir}`);
    console.log(`  - Provider: claude (logged-in session)`);
    console.log('');

    // グラフをコンパイル
    const graph = compileParallelDevGraph();
    console.log('✅ Graph compiled successfully');
    console.log('');

    // イベントカウンター
    let eventCount = 0;
    const nodeExecutionLog: string[] = [];
    let lastState: any = null;

    console.log('🏃 Starting workflow execution...');
    console.log('-'.repeat(60));

    try {
      const stream = await graph.stream(initialState);

      for await (const event of stream) {
        eventCount++;
        lastState = event;

        // 実行されたノード名を取得
        const nodeNames = Object.keys(event);
        nodeExecutionLog.push(...nodeNames);

        console.log(`\n[Event ${eventCount}] Nodes: ${nodeNames.join(', ')}`);

        // 各ノードの詳細情報を表示
        for (const nodeName of nodeNames) {
          const nodeData = event[nodeName];

          // タスク情報
          if (nodeData.tasks && nodeData.tasks.length > 0) {
            console.log(`  📋 ${nodeName} - Tasks:`);
            nodeData.tasks.forEach((task: any) => {
              console.log(`     - ${task.id}: ${task.status} - ${task.title}`);
            });
          }

          // ログ情報
          if (nodeData.logs && nodeData.logs.length > 0) {
            console.log(`  📝 ${nodeName} - Logs:`);
            nodeData.logs.slice(0, 3).forEach((log: any) => {
              console.log(`     [${log.level}] ${log.message}`);
            });
            if (nodeData.logs.length > 3) {
              console.log(`     ... and ${nodeData.logs.length - 3} more logs`);
            }
          }
        }

        // check_completionノードの詳細表示
        if ('check_completion' in event) {
          const tasks = event.check_completion.tasks || [];
          const summary = {
            pending: tasks.filter((t: any) => t.status === 'pending').length,
            ready: tasks.filter((t: any) => t.status === 'ready').length,
            in_progress: tasks.filter((t: any) => t.status === 'in_progress').length,
            in_review: tasks.filter((t: any) => t.status === 'in_review').length,
            completed: tasks.filter((t: any) => t.status === 'completed').length,
            failed: tasks.filter((t: any) => t.status === 'failed').length,
          };

          console.log(`  📊 Progress Summary:`);
          console.log(`     Pending: ${summary.pending}, Ready: ${summary.ready}`);
          console.log(`     In Progress: ${summary.in_progress}, In Review: ${summary.in_review}`);
          console.log(`     Completed: ${summary.completed}, Failed: ${summary.failed}`);
        }

        // 長時間実行防止（100イベント以上で停止）
        if (eventCount > 100) {
          console.log('\n⚠️  Event limit reached (100+), stopping execution');
          break;
        }
      }

    } catch (error) {
      console.error('\n❌ Workflow execution failed:');
      console.error(error);
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Execution Summary');
    console.log('='.repeat(60));
    console.log(`Total Events: ${eventCount}`);
    console.log(`\nNode Execution Sequence:`);

    // ノード実行順序を表示（重複除去）
    const uniqueNodes = [...new Set(nodeExecutionLog)];
    uniqueNodes.forEach((node, i) => {
      const count = nodeExecutionLog.filter(n => n === node).length;
      console.log(`  ${i + 1}. ${node} (executed ${count} times)`);
    });

    // 最終状態のタスク情報
    if (lastState?.check_completion?.tasks) {
      const finalTasks = lastState.check_completion.tasks;
      console.log(`\n📋 Final Tasks Status:`);
      finalTasks.forEach((task: any) => {
        console.log(`  - ${task.id}: ${task.status}`);
        console.log(`    Title: ${task.title}`);
        if (task.error) {
          console.log(`    ❌ Error: ${task.error}`);
        }
      });

      // 成功判定
      const allCompleted = finalTasks.every((t: any) => t.status === 'completed');
      const hasFailed = finalTasks.some((t: any) => t.status === 'failed');

      console.log('');
      if (allCompleted) {
        console.log('✅ SUCCESS: All tasks completed!');
      } else if (hasFailed) {
        console.log('❌ FAILURE: Some tasks failed');
      } else {
        console.log('⚠️  INCOMPLETE: Some tasks are not completed');
      }
    }

    // 生成されたファイルの確認
    console.log('\n📁 Generated Files:');
    try {
      const files = await fs.readdir(kugutsuDir, { recursive: true });
      files.forEach(file => {
        console.log(`  - .kugutsu/${file}`);
      });
    } catch (error) {
      console.log('  (No files generated or directory not accessible)');
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 E2E Verification Completed');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ E2E Verification Failed:');
    console.error(error);
    process.exit(1);
  } finally {
    // クリーンアップ処理
    // 環境変数 KEEP_TEST_WORKSPACE=1 を設定するとクリーンアップをスキップ
    const shouldKeep = process.env.KEEP_TEST_WORKSPACE === '1';

    if (shouldKeep) {
      console.log(`\n📁 Test workspace preserved: ${testDir}`);
      console.log('   Set KEEP_TEST_WORKSPACE=0 to enable auto-cleanup');
    } else {
      try {
        // Git worktree メタデータをクリーンアップ（test-e2e-minimal 内の .git/worktrees）
        const { execSync } = await import('child_process');
        try {
          execSync('git worktree prune', { cwd: testDir, stdio: 'pipe' });
          console.log(`\n🧹 Git worktree メタデータをクリーンアップしました`);
        } catch (pruneError) {
          // Ignore prune errors
        }

        // ディレクトリ内の生成ファイルのみ削除（.gitkeepは保持）
        const entries = await fs.readdir(testDir);

        for (const entry of entries) {
          // .gitkeepは残す
          if (entry === '.gitkeep') {
            continue;
          }

          const fullPath = path.join(testDir, entry);
          await fs.rm(fullPath, { recursive: true, force: true });
        }

        console.log(`🗑️  Test workspace cleaned up: ${testDir}`);
        console.log('   (Directory structure preserved with .gitkeep)');
      } catch (cleanupError) {
        console.warn(`\n⚠️  Cleanup warning: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
        console.log(`   You may need to manually clean: ${testDir}`);
      }
    }
  }
}

// 実行
runE2EMinimalVerification().catch(console.error);
