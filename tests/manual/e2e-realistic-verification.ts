/**
 * E2E Realistic Verification
 *
 * より実践的なシナリオでのE2E検証
 *
 * 検証内容:
 * - 依存関係のあるタスクの並列実行
 * - 複数エンジニアの同時動作
 * - レビュー → 修正のループ処理
 *
 * 実行方法:
 * ```bash
 * npm run verify:e2e-realistic
 * ```
 */

import { compileUnifiedScrumWorkflowGraph } from '../../src/graph/ParallelDevGraph.js';
import { createInitialState } from '../../src/graph/state.js';
import * as fs from 'fs/promises';
import * as path from 'path';

async function runE2ERealisticVerification() {
  console.log('🚀 E2E Realistic Verification');
  console.log('=' .repeat(60));

  // テスト用ワークスペース作成
  const testDir = './test-e2e-realistic';
  const kugutsuDir = path.join(testDir, '.kugutsu');

  try {
    // クリーンアップ
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

    // Git設定を追加（worktree操作に必要）
    try {
      execSync('git config user.email "test@example.com"', { cwd: testDir, stdio: 'pipe' });
      execSync('git config user.name "Test User"', { cwd: testDir, stdio: 'pipe' });
      console.log('✅ Git user config set (for worktree operations)');
    } catch (error) {
      console.error('⚠️  Git config failed:', error instanceof Error ? error.message : String(error));
      console.log('Continuing anyway (may affect worktree operations)...');
    }
    console.log('');

    // より複雑なタスク内容（依存関係あり）
    const taskRequest = `
Create a simple user management system with the following features:
1. User model with basic fields (id, name, email)
2. User registration function
3. User login validation function

Please implement with proper TypeScript types and basic error handling.
`;

    console.log(`📝 Task Request:`);
    console.log(taskRequest.trim());
    console.log('');

    // 初期状態作成（複数エンジニア）
    const initialState = createInitialState(taskRequest, {
      maxEngineers: 2, // 並列実行を検証
      maxTurns: 50, // より複雑なタスクなので多めに
      baseBranch: 'main',
      baseRepoPath: testDir,
      worktreeBasePath: path.join(testDir, 'worktrees'),
      provider: 'claude',
    });

    console.log('🔧 Configuration:');
    console.log(`  - Max Engineers: 2 (parallel execution)`);
    console.log(`  - Max Turns: 50`);
    console.log(`  - Base Repo: ${testDir}`);
    console.log('');

    // グラフをコンパイル
    const graph = compileUnifiedScrumWorkflowGraph();
    console.log('✅ Graph compiled successfully');
    console.log('');

    // イベントカウンター
    let eventCount = 0;
    const nodeExecutionStats = new Map<string, number>();
    let lastState: any = null;
    const taskStatusHistory: any[] = [];

    console.log('🏃 Starting workflow execution...');
    console.log('-'.repeat(60));

    const startTime = Date.now();

    try {
      const stream = await graph.stream(initialState);

      for await (const event of stream) {
        eventCount++;
        lastState = event;

        // 実行されたノード名を取得
        const nodeNames = Object.keys(event);

        // ノード実行統計を更新
        nodeNames.forEach(node => {
          nodeExecutionStats.set(node, (nodeExecutionStats.get(node) || 0) + 1);
        });

        console.log(`\n[Event ${eventCount}] Nodes: ${nodeNames.join(', ')}`);

        // check_completionノードの詳細表示
        if ('check_completion' in event) {
          const tasks = event.check_completion.tasks || [];

          // タスクステータスを記録
          taskStatusHistory.push({
            eventCount,
            timestamp: Date.now() - startTime,
            tasks: tasks.map((t: any) => ({ id: t.id, status: t.status })),
          });

          const summary = {
            pending: tasks.filter((t: any) => t.status === 'pending').length,
            ready: tasks.filter((t: any) => t.status === 'ready').length,
            in_progress: tasks.filter((t: any) => t.status === 'in_progress').length,
            in_review: tasks.filter((t: any) => t.status === 'in_review').length,
            completed: tasks.filter((t: any) => t.status === 'completed').length,
            failed: tasks.filter((t: any) => t.status === 'failed').length,
          };

          console.log(`  📊 Progress: ` +
            `✓${summary.completed} ` +
            `✗${summary.failed} ` +
            `⚙${summary.in_progress} ` +
            `👁${summary.in_review} ` +
            `⏳${summary.ready} ` +
            `⏸${summary.pending}`
          );

          // 各タスクの状態を表示
          if (tasks.length <= 5) {
            tasks.forEach((task: any) => {
              const statusEmoji = {
                pending: '⏸',
                ready: '⏳',
                in_progress: '⚙',
                in_review: '👁',
                completed: '✓',
                failed: '✗',
              }[task.status] || '?';
              console.log(`     ${statusEmoji} ${task.id}: ${task.title}`);
            });
          }
        }

        // Engineer/Review実行のログ
        if ('engineer' in event && event.engineer.logs) {
          const engineerLogs = event.engineer.logs.slice(0, 2);
          engineerLogs.forEach((log: any) => {
            console.log(`  👷 ${log.message}`);
          });
        }

        if ('review' in event && event.review.logs) {
          const reviewLogs = event.review.logs.slice(0, 2);
          reviewLogs.forEach((log: any) => {
            console.log(`  🔍 ${log.message}`);
          });
        }

        // 長時間実行防止
        if (eventCount > 150) {
          console.log('\n⚠️  Event limit reached (150+), stopping execution');
          break;
        }
      }

    } catch (error) {
      console.error('\n❌ Workflow execution failed:');
      console.error(error);
    }

    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('📊 Execution Summary');
    console.log('='.repeat(60));
    console.log(`Total Events: ${eventCount}`);
    console.log(`Execution Time: ${executionTime}s`);
    console.log('');

    // ノード実行統計
    console.log('Node Execution Statistics:');
    const sortedNodes = Array.from(nodeExecutionStats.entries())
      .sort((a, b) => b[1] - a[1]);

    sortedNodes.forEach(([node, count]) => {
      const bar = '█'.repeat(Math.min(count, 50));
      console.log(`  ${node.padEnd(25)} ${bar} (${count})`);
    });

    // 最終状態のタスク情報
    if (lastState?.check_completion?.tasks) {
      const finalTasks = lastState.check_completion.tasks;
      console.log(`\n📋 Final Tasks Status:`);
      finalTasks.forEach((task: any) => {
        const statusEmoji = {
          pending: '⏸',
          ready: '⏳',
          in_progress: '⚙',
          in_review: '👁',
          completed: '✅',
          failed: '❌',
        }[task.status] || '?';

        console.log(`  ${statusEmoji} ${task.id}: ${task.status}`);
        console.log(`     Title: ${task.title}`);

        if (task.error) {
          console.log(`     ❌ Error: ${task.error}`);
        }

        if (task.dependencies && task.dependencies.length > 0) {
          console.log(`     Dependencies: ${task.dependencies.join(', ')}`);
        }
      });

      // 成功判定
      const allCompleted = finalTasks.every((t: any) => t.status === 'completed');
      const hasFailed = finalTasks.some((t: any) => t.status === 'failed');
      const completedCount = finalTasks.filter((t: any) => t.status === 'completed').length;

      console.log('');
      console.log('Final Result:');
      if (allCompleted) {
        console.log('✅ SUCCESS: All tasks completed!');
      } else if (hasFailed) {
        console.log(`❌ FAILURE: Some tasks failed (${completedCount}/${finalTasks.length} completed)`);
      } else {
        console.log(`⚠️  INCOMPLETE: ${completedCount}/${finalTasks.length} tasks completed`);
      }
    }

    // 生成されたファイルの確認
    console.log('\n📁 Generated Artifacts:');
    try {
      const checkPaths = [
        '.kugutsu/tasks.json',
        '.kugutsu/tech-stack.json',
        '.kugutsu/requirements.json',
      ];

      for (const checkPath of checkPaths) {
        const fullPath = path.join(testDir, checkPath);
        try {
          const stats = await fs.stat(fullPath);
          console.log(`  ✓ ${checkPath} (${stats.size} bytes)`);
        } catch {
          console.log(`  ✗ ${checkPath} (not found)`);
        }
      }

      // タスクディレクトリの確認
      const tasksDir = path.join(kugutsuDir, 'tasks');
      try {
        const taskDirs = await fs.readdir(tasksDir);
        console.log(`\n  📂 Task Directories: ${taskDirs.length}`);
        taskDirs.slice(0, 5).forEach(dir => {
          console.log(`     - ${dir}/`);
        });
        if (taskDirs.length > 5) {
          console.log(`     ... and ${taskDirs.length - 5} more`);
        }
      } catch {
        console.log(`  (No task directories)`);
      }
    } catch (error) {
      console.log('  (Error checking artifacts)');
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 E2E Realistic Verification Completed');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ E2E Realistic Verification Failed:');
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

        console.log(`\n🗑️  Test workspace cleaned up: ${testDir}`);
        console.log('   (Directory structure preserved with .gitkeep)');
      } catch (cleanupError) {
        console.warn(`\n⚠️  Cleanup warning: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
        console.log(`   You may need to manually clean: ${testDir}`);
      }
    }
  }
}

// 実行
runE2ERealisticVerification().catch(console.error);
