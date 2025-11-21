#!/usr/bin/env node

/**
 * Kugutsu 2.0 - AI Parallel Development System
 *
 * LangGraphJS-based parallel development orchestrator (CLI version)
 */

// EventEmitterの最大リスナー数を増加（並列エンジニア数+システムコンポーネント分）
process.setMaxListeners(0); // 無制限

import { parallelDevOrchestrator } from './electron/ParallelDevOrchestrator.js';
import type { ParallelDevConfig } from './graph/types.js';
import * as path from 'path';
import * as fs from 'fs';
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
  cleanup: boolean; // true = cleanup (default), false = keep worktrees
  showHelp: boolean;
  showVersion: boolean;
  provider: 'claude' | 'codex' | 'gemini' | 'mock';
  visualUI: boolean;
  useRemote: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): CLIConfig {
  const config: CLIConfig = {
    baseRepoPath: process.cwd(),
    worktreeBasePath: path.join(process.cwd(), 'worktrees'),
    maxEngineers: 3,
    maxTurns: 50,
    baseBranch: getCurrentBranch(process.cwd()) || 'main',
    cleanup: true, // Default: cleanup after merge
    showHelp: false,
    showVersion: false,
    provider: 'mock', // Default to mock for safety
    visualUI: false,
    useRemote: false,
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

      case '--keep-worktrees':
        config.cleanup = false;
        break;

      case '--visual-ui':
        config.visualUI = true;
        break;

      case '--use-remote':
        config.useRemote = true;
        break;

      case '--provider':
        const provider = args[++i];
        if (provider === 'claude' || provider === 'codex' || provider === 'gemini' || provider === 'mock') {
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
🤖 Kugutsu 2.0 - AI並列開発システム (CLI版)

📖 使用方法:
  kugutsu "<開発要求>" [オプション]

引数:
  開発要求    (必須) 実装したい機能や修正内容

オプション:
  --base-repo <path>            ベースリポジトリのパス (デフォルト: .)
  --worktree-base <path>        Worktreeベースパス (デフォルト: ./worktrees)
  --max-engineers <num>         最大同時エンジニア数 (デフォルト: 3, 範囲: 1-10)
  --max-turns <num>             タスクあたりの最大ターン数 (デフォルト: 30)
  --base-branch <branch>        ベースブランチ (デフォルト: 現在のブランチ)
  --keep-worktrees              実行後もWorktreeとブランチを保持（デバッグ用）
  --visual-ui                   ターミナル分割表示を使用
  --use-remote                  リモートリポジトリを使用 (未実装)
  --provider <claude|codex|gemini|mock> AIプロバイダー (デフォルト: mock)
  --version, -v                 バージョン情報を表示
  --help, -h                    このヘルプを表示

環境変数:
  KUGUTSU_PROVIDER              AIプロバイダー (mock|claude|codex|gemini, デフォルト: mock)
  ANTHROPIC_API_KEY             Claude API キー (provider=claude時に必須)
  OPENAI_API_KEY                OpenAI API キー (Codex利用時。ログイン済みなら省略可)
  OPENAI_CODEX_BASE_URL         Codex API Base URL (任意。デフォルトはローカルセッション)
  GEMINI_API_KEY                Gemini API キー (provider=gemini & authType=api-key時)
  GEMINI_AUTH_TYPE              Gemini認証方式 (oauth-personal|api-key, デフォルト: oauth-personal)
  GEMINI_MODEL                  Geminiモデル (デフォルト: gemini-2.5-pro)

例:
  # モックプロバイダーでテスト実行（デフォルト、APIコストなし）
  kugutsu "ユーザー認証機能を実装してください"

  # Claude APIを使用して実行
  kugutsu "バグ修正: ログイン時のエラーハンドリング" --provider claude --max-engineers 2

  # 環境変数でプロバイダーを指定
  KUGUTSU_PROVIDER=claude kugutsu "新しいAPI endpointを3つ追加"

  # デバッグのためWorktreeを保持
  kugutsu "バグ調査" --keep-worktrees

注意:
  このCLI版はElectron UIを使用しません。
  GUI版を使用する場合は、'npm run electron' でElectronアプリを起動してください。
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

  // ===== Git Repository Validation =====
  // Check if base repository exists
  if (!fs.existsSync(cliConfig.baseRepoPath)) {
    console.error(`❌ エラー: ベースリポジトリが存在しません: ${cliConfig.baseRepoPath}`);
    process.exit(1);
  }

  // Check if it's a Git repository
  const gitDir = path.join(cliConfig.baseRepoPath, '.git');
  if (!fs.existsSync(gitDir)) {
    console.error('❌ エラー: このツールはGitリポジトリでのみ実行できます。\n');
    console.error(`指定されたパスはGitリポジトリではありません: ${cliConfig.baseRepoPath}\n`);
    console.error('以下のいずれかの方法でGitリポジトリを準備してください：');
    console.error('  1. 既存のGitリポジトリに移動: cd <git-repo-path>');
    console.error('  2. 新規Gitリポジトリを初期化: git init');
    console.error('  3. リポジトリをクローン: git clone <repository-url>');
    process.exit(1);
  }

  // Check if running inside worktree or submodule
  const gitDirStat = fs.statSync(gitDir);
  if (gitDirStat.isFile()) {
    console.error('❌ エラー: このツールはGit worktreeまたはサブモジュール内では実行できません。\n');
    console.error('メインリポジトリのルートディレクトリから実行してください。\n');
    console.error(`現在の場所: ${cliConfig.baseRepoPath}\n`);
    console.error('ヒント: \'cd ..\' を繰り返してメインリポジトリに移動してください。');
    process.exit(1);
  }

  // Check if repository has commits
  try {
    const hasCommits = execSync('git rev-list -n 1 --all 2>/dev/null', {
      cwd: cliConfig.baseRepoPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (!hasCommits) {
      console.error('❌ エラー: リポジトリにコミットがありません。\n');
      console.error('このツールを使用するには、少なくとも1つのコミットが必要です。\n');
      console.error('初期コミットを作成してください：');
      console.error('  echo "# プロジェクト" > README.md');
      console.error('  git add README.md');
      console.error('  git commit -m "Initial commit"');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ エラー: リポジトリにコミットがありません。\n');
    console.error('このツールを使用するには、少なくとも1つのコミットが必要です。\n');
    console.error('初期コミットを作成してください：');
    console.error('  echo "# プロジェクト" > README.md');
    console.error('  git add README.md');
    console.error('  git commit -m "Initial commit"');
    process.exit(1);
  }

  // Check --use-remote option
  if (cliConfig.useRemote) {
    console.error('❌ エラー: --use-remote オプションはまだ実装されていません。');
    console.error('現在はローカルリポジトリでの実行のみサポートしています。');
    process.exit(1);
  }

  // ===== Provider and API Key Validation =====
  // Override provider with environment variable if set
  const envProvider = process.env.KUGUTSU_PROVIDER as 'claude' | 'codex' | 'gemini' | 'mock' | undefined;
  if (envProvider) {
    cliConfig.provider = envProvider;
  }

  // Validate API key for Claude
  if (cliConfig.provider === 'claude' && !process.env.ANTHROPIC_API_KEY) {
    console.error('❌ エラー: ANTHROPIC_API_KEY環境変数が設定されていません\n');
    console.error('Claude APIキーを設定してください:');
    console.error('  export ANTHROPIC_API_KEY="your-api-key"\n');
    process.exit(1);
  }

  // ===== Protected Branch Warning =====
  const protectedBranches = ['main', 'master', 'staging', 'develop'];
  if (protectedBranches.includes(cliConfig.baseBranch)) {
    console.warn(`\n⚠️  警告: 保護されたブランチ '${cliConfig.baseBranch}' を使用しようとしています`);
    console.warn('このブランチへの直接的な変更は推奨されません。');

    // Ask user for confirmation
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question(`\n⚠️  保護されたブランチ '${cliConfig.baseBranch}' を使用しますか？ (yes/no): `, resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
      console.log('\n🛑 ユーザーによりキャンセルされました');
      process.exit(0);
    }

    console.log(`\n✅ '${cliConfig.baseBranch}' ブランチの使用を続行します\n`);
  }

  console.log('🚀 Kugutsu 2.0 起動 (CLI版)\n');
  console.log(`📝 開発要求: ${cliConfig.userRequest}`);
  console.log(`📂 リポジトリ: ${cliConfig.baseRepoPath}`);
  console.log(`🔧 最大エンジニア数: ${cliConfig.maxEngineers}`);
  console.log(`🔄 最大ターン数: ${cliConfig.maxTurns}`);
  console.log(`🌿 ベースブランチ: ${cliConfig.baseBranch}`);
  console.log(`🤖 AIプロバイダー: ${cliConfig.provider}`);
  console.log(`🖥️  UIモード: ${cliConfig.visualUI ? 'Terminal分割' : '標準'}`);
  console.log(`🧹 実行後クリーンアップ: ${cliConfig.cleanup ? 'はい（自動削除）' : 'いいえ（保持）'}`);
  console.log('');

  // ===== Signal Handlers =====
  let isCleaningUp = false;
  const cleanup_handler = async () => {
    if (isCleaningUp) {
      console.log('\n🛑 既にクリーンアップ中です...');
      return;
    }
    isCleaningUp = true;

    console.log('\n🛑 システム停止中...');
    console.log('(クリーンアップは手動で実行してください)');
    process.exit(0);
  };

  // Set up signal handlers
  process.removeAllListeners('SIGINT');
  process.removeAllListeners('SIGTERM');
  process.on('SIGINT', cleanup_handler);
  process.on('SIGTERM', cleanup_handler);

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
