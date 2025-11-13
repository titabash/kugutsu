/**
 * E2E Realistic Verification - Multi-Sprint Scrum Workflow
 *
 * より実践的なシナリオでのE2E検証（2スプリント実行）
 *
 * 検証内容:
 * - 複数スプリントの連続実行（Sprint 1 → Sprint 2）
 * - 依存関係のあるタスクの並列実行
 * - 複数エンジニアの同時動作（maxEngineers: 2）
 * - レビュー → 修正のループ処理
 * - Sprint計画、実装、レビューの完全なワークフロー
 * - 継続モード検出とスプリント間遷移
 *
 * シナリオ:
 * Sprint 1: ユーザー管理の基本機能（モデル、登録、パスワードハッシュ）
 * Sprint 2: 認証と権限管理（ログイン、JWT、RBAC）
 *
 * 実行方法:
 * ```bash
 * npm run verify:e2e-realistic
 * ```
 *
 * プロバイダー設定:
 * - ANTHROPIC_API_KEY設定あり: Claude API使用
 * - ANTHROPIC_API_KEY設定なし: Codex (Claude Code logged-in session)使用
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

    // より複雑なタスク内容（複数スプリント想定）
    const taskRequest = `
Create a complete user management system with authentication:

Sprint 1 - Basic User Management:
1. User model with TypeScript types (id, name, email, password hash)
2. User registration function with validation
3. Basic password hashing utility

Sprint 2 - Authentication & Authorization:
4. User login validation function
5. JWT token generation and verification
6. Role-based access control (RBAC) with user roles

Please implement with proper TypeScript types, error handling, and basic unit tests.
This should be implemented in 2 sprints with proper dependencies.
`;

    console.log(`📝 Task Request (Multi-Sprint Scenario):`);
    console.log(taskRequest.trim());
    console.log('');

    // プロバイダー設定（環境変数で制御、デフォルトはclaude）
    // ANTHROPIC_API_KEYが設定されていればclaude、なければcodex（Claude Code logged-in session）
    const provider = process.env.ANTHROPIC_API_KEY ? 'claude' : 'codex';

    // 初期状態作成（複数エンジニア）
    const initialState = createInitialState(taskRequest, {
      maxEngineers: 2, // 並列実行を検証
      maxTurns: 50, // より複雑なタスクなので多めに
      baseBranch: 'main',
      baseRepoPath: testDir,
      worktreeBasePath: path.join(testDir, 'worktrees'),
      provider: provider,
    });

    // currentProjectId を初期化（ProductOwnerNode が必須とする）
    initialState.currentProjectId = 'test-project-realistic-001';

    console.log('🔧 Configuration:');
    console.log(`  - Max Engineers: 2 (parallel execution)`);
    console.log(`  - Max Turns: 50`);
    console.log(`  - Base Repo: ${testDir}`);
    console.log(`  - Provider: ${provider} (${provider === 'claude' ? 'API key' : 'logged-in session'})`);
    console.log(`  - Project ID: ${initialState.currentProjectId}`);
    console.log('');

    // グラフをコンパイル
    const graph = compileUnifiedScrumWorkflowGraph();
    console.log('✅ Graph compiled successfully');
    console.log('');

    // イベントカウンター
    let eventCount = 0;
    const nodeExecutionStats = new Map<string, number>();
    let lastState: any = null;
    let currentState: any = { ...initialState };
    const taskStatusHistory: any[] = [];

    // スプリント追跡
    const sprintExecutionLog: any[] = [];
    let currentSprintId: string | null = null;
    let sprintCount = 0;

    console.log('🏃 Starting Multi-Sprint Workflow Execution...');
    console.log('   Expected: 2 Sprints (Basic User Management + Authentication)');
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

        // 各ノードからstateを更新
        for (const nodeName of nodeNames) {
          const nodeData = event[nodeName];

          // globalTasksの更新
          if (nodeData.globalTasks) {
            currentState.globalTasks = nodeData.globalTasks;
          }

          // tasksの更新
          if (nodeData.tasks) {
            currentState.tasks = nodeData.tasks;
          }
        }

        // タスク情報の表示（globalTasksとtasksの両方をチェック）
        const tasks = currentState.globalTasks || currentState.tasks || [];

        if (tasks.length > 0) {
          // タスクステータスを記録
          taskStatusHistory.push({
            eventCount,
            timestamp: Date.now() - startTime,
            tasks: tasks.map((t: any) => ({ id: t.id, status: t.status })),
          });

          const summary = {
            pending: tasks.filter((t: any) => t.status === 'pending').length,
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
            `⏸${summary.pending}`
          );

          // 各タスクの状態を表示
          if (tasks.length <= 5) {
            tasks.forEach((task: any) => {
              const statusEmoji = {
                pending: '⏸',
                in_progress: '⚙',
                in_review: '👁',
                completed: '✓',
                failed: '✗',
              }[task.status] || '?';
              console.log(`     ${statusEmoji} ${task.id}: ${task.title}`);
            });
          }
        }

        // 重要なノードの詳細表示
        for (const nodeName of nodeNames) {
          const nodeData = event[nodeName];

          // 複雑度分析
          if (nodeName === 'analyze_complexity' && nodeData.complexity) {
            console.log(`  🔍 Complexity Analysis: ${nodeData.complexity}`);
          }

          // 継続モード検出
          if (nodeName === 'check_mode' && nodeData.continuationMode !== undefined) {
            console.log(`  🔄 Continuation Mode: ${nodeData.continuationMode ? 'Yes' : 'No'}`);
          }

          // ストーリーマッピング（高複雑度）
          if (nodeName === 'director_ai' && nodeData.storyMapping) {
            console.log(`  📖 Story Mapping Created`);
          }

          // スプリント計画
          if (nodeName === 'sprint_planning' && nodeData.activeSprint) {
            const sprintId = nodeData.activeSprint.id;
            const sprintName = nodeData.activeSprint.name || sprintId;

            // 新しいスプリントが開始された場合
            if (sprintId !== currentSprintId) {
              currentSprintId = sprintId;
              sprintCount++;

              console.log(`\n${'='.repeat(60)}`);
              console.log(`🚀 SPRINT ${sprintCount} STARTED: ${sprintName}`);
              console.log(`${'='.repeat(60)}\n`);

              sprintExecutionLog.push({
                sprintNumber: sprintCount,
                sprintId: sprintId,
                sprintName: sprintName,
                startEvent: eventCount,
                startTime: Date.now() - startTime,
              });
            } else {
              console.log(`  📅 Sprint Planned: ${sprintName}`);
            }
          }

          // インストラクション生成集約
          if (nodeName === 'instruction_aggregator' && nodeData.globalTasks) {
            const instructedCount = nodeData.globalTasks.filter((t: any) => t.instructionGenerated).length;
            console.log(`  📝 Instructions Generated: ${instructedCount} tasks`);
          }

          // エンジニア並列実行集約
          if (nodeName === 'engineer_aggregator' && nodeData.logs) {
            const latestLogs = nodeData.logs.slice(-2);
            latestLogs.forEach((log: any) => {
              console.log(`  👷 [Parallel] ${log.message}`);
            });
          }

          // レビュー並列実行集約
          if (nodeName === 'review_aggregator' && nodeData.logs) {
            const latestLogs = nodeData.logs.slice(-2);
            latestLogs.forEach((log: any) => {
              console.log(`  🔍 [Parallel] ${log.message}`);
            });
          }

          // スプリントレビュー
          if (nodeName === 'sprint_review') {
            const completedTasks = nodeData.globalTasks?.filter((t: any) => t.status === 'completed').length || 0;
            const totalTasks = nodeData.globalTasks?.length || 0;
            const sprintTasks = nodeData.globalTasks?.filter((t: any) => t.sprintId === currentSprintId) || [];
            const sprintCompleted = sprintTasks.filter((t: any) => t.status === 'completed').length;

            console.log(`\n${'='.repeat(60)}`);
            console.log(`✅ SPRINT ${sprintCount} REVIEW`);
            console.log(`   Sprint Tasks: ${sprintCompleted}/${sprintTasks.length} completed`);
            console.log(`   Overall Progress: ${completedTasks}/${totalTasks} tasks completed`);
            console.log(`${'='.repeat(60)}\n`);

            // スプリント実行ログを更新
            if (sprintExecutionLog.length > 0) {
              const currentSprintLog = sprintExecutionLog[sprintExecutionLog.length - 1];
              currentSprintLog.endEvent = eventCount;
              currentSprintLog.endTime = Date.now() - startTime;
              currentSprintLog.tasksCompleted = sprintCompleted;
              currentSprintLog.totalTasks = sprintTasks.length;
            }
          }
        }

        // 長時間実行防止（2スプリント実行のため上限を引き上げ）
        if (eventCount > 300) {
          console.log('\n⚠️  Event limit reached (300+), stopping execution');
          console.log('   This may indicate an issue with the workflow or an infinite loop.');
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
    console.log(`Total Sprints Executed: ${sprintCount}`);
    console.log('');

    // スプリント実行サマリー
    if (sprintExecutionLog.length > 0) {
      console.log('🏃 Sprint Execution Log:');
      sprintExecutionLog.forEach((sprint) => {
        const duration = ((sprint.endTime - sprint.startTime) / 1000).toFixed(2);
        console.log(`  Sprint ${sprint.sprintNumber}: ${sprint.sprintName}`);
        console.log(`    Events: ${sprint.startEvent} → ${sprint.endEvent || 'ongoing'}`);
        console.log(`    Duration: ${duration}s`);
        console.log(`    Tasks: ${sprint.tasksCompleted || 0}/${sprint.totalTasks || '?'} completed`);
      });
      console.log('');

      // スプリント検証
      if (sprintCount >= 2) {
        console.log('✅ Multi-Sprint Workflow Verification: PASSED');
        console.log(`   Expected: 2 sprints, Executed: ${sprintCount} sprints`);
      } else {
        console.log('⚠️  Multi-Sprint Workflow Verification: INCOMPLETE');
        console.log(`   Expected: 2 sprints, Executed: ${sprintCount} sprint(s)`);
      }
      console.log('');
    }

    // ノード実行統計
    console.log('Node Execution Statistics:');
    const sortedNodes = Array.from(nodeExecutionStats.entries())
      .sort((a, b) => b[1] - a[1]);

    sortedNodes.forEach(([node, count]) => {
      const bar = '█'.repeat(Math.min(count, 50));
      console.log(`  ${node.padEnd(25)} ${bar} (${count})`);
    });

    // 最終状態のタスク情報（globalTasksとtasksの両方をチェック）
    const finalTasks = currentState?.globalTasks || currentState?.tasks || [];
    if (finalTasks.length > 0) {
      console.log(`\n📋 Final Tasks Status:`);
      finalTasks.forEach((task: any) => {
        const statusEmoji = {
          pending: '⏸',
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
    } else {
      console.log('\n📋 Final Tasks Status:');
      console.log('  ⚠️  No tasks found in final state');
    }

    // 生成されたファイルの確認
    console.log('\n📁 Generated Artifacts:');
    try {
      // 基本ファイルの確認
      const checkPaths = [
        '.kugutsu/metadata.json',
        '.kugutsu/tech-stack.json',
        '.kugutsu/requirements.json',
        '.kugutsu/tasks.json', // 後方互換性のため残っている可能性
      ];

      console.log('  Basic Files:');
      for (const checkPath of checkPaths) {
        const fullPath = path.join(testDir, checkPath);
        try {
          const stats = await fs.stat(fullPath);
          console.log(`    ✓ ${checkPath} (${stats.size} bytes)`);
        } catch {
          console.log(`    ✗ ${checkPath} (not found)`);
        }
      }

      // Sprintディレクトリの確認
      const sprintsDir = path.join(kugutsuDir, 'sprints');
      try {
        const sprintDirs = await fs.readdir(sprintsDir);
        console.log(`\n  📂 Sprint Directories: ${sprintDirs.length}`);

        for (const sprintDir of sprintDirs.slice(0, 3)) {
          const sprintPath = path.join(sprintsDir, sprintDir);
          console.log(`     - ${sprintDir}/`);

          // Sprint Backlogの確認
          const backlogPath = path.join(sprintPath, 'sprint-backlog.json');
          try {
            const backlogStats = await fs.stat(backlogPath);
            console.log(`       ✓ sprint-backlog.json (${backlogStats.size} bytes)`);
          } catch {
            console.log(`       ✗ sprint-backlog.json (not found)`);
          }

          // タスクディレクトリの確認
          const tasksPath = path.join(sprintPath, 'tasks');
          try {
            const taskDirs = await fs.readdir(tasksPath);
            console.log(`       📂 tasks/ (${taskDirs.length} tasks)`);
          } catch {
            console.log(`       📂 tasks/ (empty or not found)`);
          }
        }

        if (sprintDirs.length > 3) {
          console.log(`     ... and ${sprintDirs.length - 3} more sprints`);
        }
      } catch {
        console.log(`\n  📂 Sprint Directories: (not found)`);
      }

      // Story Mapの確認（高複雑度の場合のみ生成される）
      const storyMapPath = path.join(testDir, '.kugutsu/story-map.json');
      try {
        const storyMapStats = await fs.stat(storyMapPath);
        console.log(`\n  ✓ story-map.json (${storyMapStats.size} bytes) [High Complexity Mode]`);
      } catch {
        // Story Mapがない場合は低複雑度モードなので問題なし
      }

      // 従来のタスクディレクトリの確認（後方互換性）
      const tasksDir = path.join(kugutsuDir, 'tasks');
      try {
        const taskDirs = await fs.readdir(tasksDir);
        if (taskDirs.length > 0) {
          console.log(`\n  📂 Legacy Task Directories: ${taskDirs.length}`);
          taskDirs.slice(0, 3).forEach(dir => {
            console.log(`     - ${dir}/`);
          });
          if (taskDirs.length > 3) {
            console.log(`     ... and ${taskDirs.length - 3} more`);
          }
        }
      } catch {
        // タスクディレクトリがない場合は問題なし
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
        // Git worktree メタデータをクリーンアップ（test-e2e-realistic 内の .git/worktrees）
        const { execSync } = await import('child_process');
        try {
          execSync('git worktree prune', { cwd: testDir, stdio: 'pipe' });
          console.log(`\n🧹 Git worktree メタデータをクリーンアップしました`);
        } catch (pruneError) {
          // Ignore prune errors
        }

        // worktreesディレクトリのみ削除（リポジトリ本体は保持）
        const worktreesPath = path.join(testDir, 'worktrees');
        try {
          await fs.rm(worktreesPath, { recursive: true, force: true });
          console.log(`🗑️  Worktrees cleaned up: ${worktreesPath}`);
        } catch (rmError) {
          // worktreesディレクトリが存在しない場合は無視
        }

        console.log(`✅ Repository preserved: ${testDir}`);
        console.log('   (Only worktrees directory removed)');
      } catch (cleanupError) {
        console.warn(`\n⚠️  Cleanup warning: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
        console.log(`   You may need to manually clean: ${testDir}`);
      }
    }
  }
}

// 実行
runE2ERealisticVerification().catch(console.error);
