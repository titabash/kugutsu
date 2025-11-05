#!/usr/bin/env node

/**
 * Kugutsu 2.0 - AI Parallel Development System
 *
 * LangGraphJS-based parallel development orchestrator
 */

import { parallelDevOrchestrator } from './electron/ParallelDevOrchestrator.js';
import type { ParallelDevConfig } from './graph/types.js';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * CLI configuration
 */
interface CLIConfig {
  userRequest?: string;
  baseRepoPath: string;
  worktreeBasePath: string;
  maxEngineers: number;
  maxTurns: number;
  baseBranch: string;
  cleanup: boolean;
  showHelp: boolean;
  showVersion: boolean;
  provider: 'claude' | 'codex';
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): CLIConfig {
  const config: CLIConfig = {
    baseRepoPath: process.cwd(),
    worktreeBasePath: path.join(process.cwd(), 'worktrees'),
    maxEngineers: 3,
    maxTurns: 30,
    baseBranch: getCurrentBranch(process.cwd()) || 'main',
    cleanup: false,
    showHelp: false,
    showVersion: false,
    provider: 'claude',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--help':
      case '-h':
        config.showHelp = true;
        break;

      case '--version':
      case '-v':
        config.showVersion = true;
        break;

      case '--base-repo':
        config.baseRepoPath = path.resolve(args[++i]);
        break;

      case '--worktree-base':
        config.worktreeBasePath = path.resolve(args[++i]);
        break;

      case '--max-engineers':
        config.maxEngineers = parseInt(args[++i], 10);
        break;

      case '--max-turns':
        config.maxTurns = parseInt(args[++i], 10);
        break;

      case '--base-branch':
        config.baseBranch = args[++i];
        break;

      case '--cleanup':
        config.cleanup = true;
        break;

      case '--provider':
        const provider = args[++i];
        if (provider === 'claude' || provider === 'codex') {
          config.provider = provider;
        }
        break;

      default:
        // User request (first non-flag argument)
        if (!arg.startsWith('--') && !config.userRequest) {
          config.userRequest = arg;
        }
        break;
    }
  }

  return config;
}

/**
 * Get current Git branch
 */
function getCurrentBranch(repoPath: string): string | null {
  try {
    const branch = execSync('git branch --show-current', {
      cwd: repoPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    if (!branch) {
      return 'main';
    }

    return branch;
  } catch (error) {
    return null;
  }
}

/**
 * Show usage information
 */
function showUsage(): void {
  console.log(`
🤖 Kugutsu 2.0 - AI並列開発システム

📖 使用方法:
  kugutsu "<開発要求>" [オプション]

引数:
  開発要求    (必須) 実装したい機能や修正内容

オプション:
  --base-repo <path>        ベースリポジトリのパス (デフォルト: .)
  --worktree-base <path>    Worktreeベースパス (デフォルト: ./worktrees)
  --max-engineers <num>     最大同時エンジニア数 (デフォルト: 3, 範囲: 1-10)
  --max-turns <num>         タスクあたりの最大ターン数 (デフォルト: 30)
  --base-branch <branch>    ベースブランチ (デフォルト: 現在のブランチ)
  --cleanup                 実行後にWorktreeを削除
  --provider <claude|codex> AIプロバイダー (デフォルト: claude)
  --version, -v             バージョン情報を表示
  --help, -h                このヘルプを表示

環境変数:
  ANTHROPIC_API_KEY         Claude API キー (必須)
  OPENAI_API_KEY            OpenAI API キー (Codex使用時)

例:
  kugutsu "ユーザー認証機能を実装してください"
  kugutsu "バグ修正: ログイン時のエラーハンドリング" --max-engineers 2
  kugutsu "新しいAPI endpointを3つ追加" --cleanup
`);
}

/**
 * Show version information
 */
function showVersion(): void {
  // Try to read version from package.json
  try {
    const packageJson = JSON.parse(
      require('fs').readFileSync(
        path.join(__dirname, '../package.json'),
        'utf-8'
      )
    );
    console.log(`Kugutsu v${packageJson.version}`);
  } catch {
    console.log('Kugutsu v2.0.0');
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cliConfig = parseArgs(args);

  // Show help
  if (cliConfig.showHelp) {
    showUsage();
    process.exit(0);
  }

  // Show version
  if (cliConfig.showVersion) {
    showVersion();
    process.exit(0);
  }

  // Validate user request
  if (!cliConfig.userRequest) {
    console.error('❌ エラー: 開発要求を指定してください\n');
    showUsage();
    process.exit(1);
  }

  // Validate API key
  if (!process.env.ANTHROPIC_API_KEY && cliConfig.provider === 'claude') {
    console.error('❌ エラー: ANTHROPIC_API_KEY環境変数が設定されていません\n');
    console.error('Claude APIキーを設定してください:');
    console.error('  export ANTHROPIC_API_KEY="your-api-key"\n');
    process.exit(1);
  }

  console.log('🚀 Kugutsu 2.0 起動\n');
  console.log(`📝 開発要求: ${cliConfig.userRequest}`);
  console.log(`📂 リポジトリ: ${cliConfig.baseRepoPath}`);
  console.log(`🔧 最大エンジニア数: ${cliConfig.maxEngineers}`);
  console.log(`🌿 ベースブランチ: ${cliConfig.baseBranch}`);
  console.log('');

  try {
    // Create config
    const config: ParallelDevConfig = {
      maxEngineers: cliConfig.maxEngineers,
      maxTurns: cliConfig.maxTurns,
      baseBranch: cliConfig.baseBranch,
      baseRepoPath: cliConfig.baseRepoPath,
      worktreeBasePath: cliConfig.worktreeBasePath,
      cleanup: cliConfig.cleanup,
      provider: cliConfig.provider,
    };

    // Execute workflow
    const finalState = await parallelDevOrchestrator.execute({
      userRequest: cliConfig.userRequest,
      config,
      window: null, // CLI mode, no Electron window
    });

    // Show summary
    console.log('\n');
    console.log('=' .repeat(60));
    console.log('📊 実行結果サマリー');
    console.log('='.repeat(60));
    console.log(`総タスク数: ${finalState.tasks.length}`);
    console.log(`完了: ${finalState.completedTasks.length}`);
    console.log(`失敗: ${finalState.failedTasks.length}`);
    console.log(`レビュー数: ${finalState.reviews.length}`);
    console.log(`マージ数: ${finalState.mergeQueue.filter((m) => m.status === 'completed').length}`);
    console.log('='.repeat(60));

    // Exit with appropriate code
    if (finalState.failedTasks.length > 0) {
      console.log('\n⚠️ 一部のタスクが失敗しました');
      process.exit(1);
    } else {
      console.log('\n✅ すべてのタスクが正常に完了しました');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

// Run main
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
