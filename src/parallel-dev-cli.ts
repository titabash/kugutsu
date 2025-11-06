#!/usr/bin/env node

// EventEmitterの最大リスナー数を増加（並列エンジニア数+システムコンポーネント分）
process.setMaxListeners(0); // 無制限

import { ParallelDevelopmentOrchestrator } from './managers/ParallelDevelopmentOrchestrator.js';
import { SystemConfig } from './types/index.js';
import { ClaudeCodeSetupChecker } from './utils/ClaudeCodeSetupChecker.js';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * AI並列開発システムのCLIエントリーポイント（Electron非依存版）
 */
class ParallelDevelopmentCLI {

  /**
   * 使用方法を表示
   */
  private static showUsage(): void {
    console.log(`
🤖 Kugutsu - AI並列開発システム (CLI版)

📖 使用方法:
  kugutsu-cli "<開発要求>" [オプション]

引数:
  開発要求    (必須) 実装したい機能や修正内容

オプション:
  --base-repo <path>        ベースリポジトリのパス (デフォルト: .)
  --worktree-base <path>    Worktreeベースパス (デフォルト: ./worktrees)
  --max-engineers <num>     最大同時エンジニア数 (デフォルト: 10, 範囲: 1-100)
  --max-turns <num>         タスクあたりの最大ターン数 (デフォルト: 50)
  --base-branch <branch>    ベースブランチ (デフォルト: 現在のブランチ)
  --use-remote              リモートリポジトリを使用 (デフォルト: ローカルのみ)
  --keep-worktrees          実行後にWorktreeとブランチを保持 (デフォルト: 自動削除)
  --visual-ui               ターミナル分割表示を使用
  --version, -v             バージョン情報を表示
  --help, -h                このヘルプを表示

例:
  kugutsu-cli "ユーザー認証機能を実装してください"
  kugutsu-cli "バグ修正: ログイン時のエラーハンドリング" --max-engineers 2
  kugutsu-cli "新しいAPI endpointを3つ追加" --keep-worktrees
  kugutsu-cli "機能改善" --use-remote --visual-ui

注意:
  このCLI版はElectron UIを使用しません。
  Electron UIを使用する場合は、Electronアプリを起動してください。
`);
  }

  /**
   * 現在のGitブランチを取得
   */
  private static getCurrentBranch(repoPath: string): string | null {
    try {
      const branch = execSync('git branch --show-current', {
        cwd: repoPath,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();

      if (!branch) {
        // detached HEAD状態の場合
        const rev = execSync('git rev-parse --abbrev-ref HEAD', {
          cwd: repoPath,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore']
        }).trim();
        return rev === 'HEAD' ? 'main' : rev;
      }

      return branch;
    } catch (error) {
      return null;
    }
  }

  /**
   * コマンドライン引数をパース
   */
  private static parseArgs(args: string[]): {
    userRequest?: string;
    config: SystemConfig;
    keepWorktrees: boolean;
    showHelp: boolean;
    visualUI: boolean;
  } {
    const config: SystemConfig = {
      baseRepoPath: process.cwd(),
      worktreeBasePath: path.join(process.cwd(), 'worktrees'),
      maxConcurrentEngineers: 10,
      maxTurnsPerTask: 50,
      baseBranch: 'main', // 後で現在のブランチに置き換える
      useRemote: false // デフォルトはローカルのみ
    };

    let keepWorktrees = false; // デフォルトは自動削除
    let showHelp = false;
    let visualUI = false;
    let userRequest: string | undefined;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--help' || arg === '-h') {
        showHelp = true;
      } else if (arg === '--version' || arg === '-v') {
        const packageJsonPath = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        console.log(`@titabash/kugutsu version: ${packageJson.version}`);
        process.exit(0);
      } else if (arg === '--keep-worktrees') {
        keepWorktrees = true;
      } else if (arg === '--visual-ui') {
        visualUI = true;
      } else if (arg === '--use-remote') {
        config.useRemote = true;
      } else if (arg === '--base-repo') {
        config.baseRepoPath = path.resolve(args[++i] || process.cwd());
      } else if (arg === '--worktree-base') {
        config.worktreeBasePath = path.resolve(args[++i] || './worktrees');
      } else if (arg === '--max-engineers') {
        config.maxConcurrentEngineers = parseInt(args[++i] || '10', 10);
      } else if (arg === '--max-turns') {
        config.maxTurnsPerTask = parseInt(args[++i] || '50', 10);
      } else if (arg === '--base-branch') {
        config.baseBranch = args[++i] || 'main';
      } else if (!userRequest && !arg.startsWith('--')) {
        userRequest = arg;
      }
    }

    return { userRequest, config, keepWorktrees, showHelp, visualUI };
  }

  /**
   * 設定の検証
   */
  private static validateConfig(config: SystemConfig): { valid: boolean; error?: string } {
    // ベースリポジトリの存在確認
    if (!fs.existsSync(config.baseRepoPath)) {
      return { valid: false, error: `ベースリポジトリが存在しません: ${config.baseRepoPath}` };
    }

    // Gitリポジトリかどうか確認
    const gitDir = path.join(config.baseRepoPath, '.git');
    if (!fs.existsSync(gitDir)) {
      return {
        valid: false,
        error: `❌ エラー: このツールはGitリポジトリでのみ実行できます。\n\n` +
               `指定されたパスはGitリポジトリではありません: ${config.baseRepoPath}\n\n` +
               `以下のいずれかの方法でGitリポジトリを準備してください：\n` +
               `  1. 既存のGitリポジトリに移動: cd <git-repo-path>\n` +
               `  2. 新規Gitリポジトリを初期化: git init\n` +
               `  3. リポジトリをクローン: git clone <repository-url>`
      };
    }

    // worktreeまたはサブモジュール内での実行をチェック
    const gitDirStat = fs.statSync(gitDir);
    if (gitDirStat.isFile()) {
      // .gitがファイルの場合、worktreeまたはサブモジュール
      return {
        valid: false,
        error: `❌ エラー: このツールはGit worktreeまたはサブモジュール内では実行できません。\n\n` +
               `メインリポジトリのルートディレクトリから実行してください。\n\n` +
               `現在の場所: ${config.baseRepoPath}\n\n` +
               `ヒント: 'cd ..' を繰り返してメインリポジトリに移動してください。`
      };
    }

    // 空のリポジトリかどうか確認
    try {
      const hasCommits = execSync('git rev-list -n 1 --all 2>/dev/null', {
        cwd: config.baseRepoPath,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();

      if (!hasCommits) {
        return {
          valid: false,
          error: `❌ エラー: リポジトリにコミットがありません。\n\n` +
                 `このツールを使用するには、少なくとも1つのコミットが必要です。\n\n` +
                 `初期コミットを作成してください：\n` +
                 `  echo "# プロジェクト" > README.md\n` +
                 `  git add README.md\n` +
                 `  git commit -m "Initial commit"`
        };
      }
    } catch (error) {
      // git rev-listがエラーになった場合も空のリポジトリとして扱う
      return {
        valid: false,
        error: `❌ エラー: リポジトリにコミットがありません。\n\n` +
               `このツールを使用するには、少なくとも1つのコミットが必要です。\n\n` +
               `初期コミットを作成してください：\n` +
               `  echo "# プロジェクト" > README.md\n` +
               `  git add README.md\n` +
               `  git commit -m "Initial commit"`
      };
    }

    // 数値の範囲チェック
    if (config.maxConcurrentEngineers < 1 || config.maxConcurrentEngineers > 100) {
      return { valid: false, error: '最大同時エンジニア数は1-100の範囲で指定してください' };
    }

    if (config.maxTurnsPerTask < 5 || config.maxTurnsPerTask > 50) {
      return { valid: false, error: '最大ターン数は5-50の範囲で指定してください' };
    }

    return { valid: true };
  }

  /**
   * メイン実行関数
   */
  public static async main(): Promise<void> {
    const args = process.argv.slice(2);
    const { userRequest, config, keepWorktrees, showHelp, visualUI } = this.parseArgs(args);

    // ヘルプ表示
    if (showHelp || args.length === 0) {
      this.showUsage();
      process.exit(0);
    }

    // ユーザー要求のチェック
    if (!userRequest) {
      console.error('❌ エラー: 開発要求が指定されていません');
      this.showUsage();
      process.exit(1);
    }

    // 設定の検証
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      console.error(`❌ 設定エラー: ${validation.error}`);
      process.exit(1);
    }

    // --use-remoteオプションのチェック
    if (config.useRemote) {
      console.error('❌ エラー: --use-remote オプションはまだ実装されていません。');
      console.error('現在はローカルリポジトリでの実行のみサポートしています。');
      process.exit(1);
    }

    // --base-branchが指定されていない場合、現在のブランチを使用
    const baseBranchSpecified = args.includes('--base-branch');
    if (!baseBranchSpecified) {
      const currentBranch = this.getCurrentBranch(config.baseRepoPath);
      if (currentBranch) {
        config.baseBranch = currentBranch;
        console.log(`📌 現在のブランチをベースブランチとして使用: ${currentBranch}`);
      } else {
        // Gitリポジトリチェックは既に通過しているので、これは予期しないエラー
        console.error(`❌ エラー: 現在のGitブランチを取得できませんでした。`);
        console.error(`--base-branch オプションで明示的にベースブランチを指定してください。`);
        console.error(`例: kugutsu-cli "${userRequest}" --base-branch main`);
        process.exit(1);
      }
    }

    // Claude Codeのセットアップ状態を確認
    console.log('🔍 Claude Codeのセットアップ状態を確認中...\n');
    const setupCheck = await ClaudeCodeSetupChecker.checkSetup();

    if (!setupCheck.isValid) {
      console.error('❌ Claude Codeのセットアップに問題があります:\n');

      // エラーを表示
      setupCheck.errors.forEach((error, index) => {
        console.error(`  ${index + 1}. ${error}`);
      });

      // セットアップガイドを表示
      ClaudeCodeSetupChecker.displaySetupGuide();

      process.exit(1);
    }

    console.log('✅ Claude Codeのセットアップが確認されました');
    if (setupCheck.info.version) {
      console.log(`📌 Claude Codeバージョン: ${setupCheck.info.version}`);
    }
    console.log('');

    // baseBranchの確認と警告
    const protectedBranches = ['main', 'master', 'staging', 'develop'];
    if (protectedBranches.includes(config.baseBranch)) {
      console.warn(`\n⚠️  警告: 保護されたブランチ '${config.baseBranch}' を使用しようとしています`);
      console.warn(`このブランチへの直接的な変更は推奨されません。`);

      // ユーザーに確認を求める
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question(`\n⚠️  保護されたブランチ '${config.baseBranch}' を使用しますか？ (yes/no): `, resolve);
      });
      rl.close();

      if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
        console.log('\n🛑 ユーザーによりキャンセルされました');
        process.exit(0);
      }

      console.log(`\n✅ '${config.baseBranch}' ブランチの使用を続行します\n`);
    }

    console.log('🤖 AI並列開発システム起動 (CLI版)');
    console.log(`📂 ベースリポジトリ: ${config.baseRepoPath}`);
    console.log(`🌿 Worktreeベース: ${config.worktreeBasePath}`);
    console.log(`👥 最大同時エンジニア数: ${config.maxConcurrentEngineers}`);
    console.log(`🔄 最大ターン数: ${config.maxTurnsPerTask}`);
    console.log(`🌱 ベースブランチ: ${config.baseBranch}`);
    console.log(`📡 リモート使用: ${config.useRemote ? 'はい' : 'いいえ'}`);
    console.log(`🧹 実行後クリーンアップ: ${keepWorktrees ? 'いいえ' : 'はい'}`);
    console.log(`🖥️  UIモード: ${visualUI ? 'Terminal分割' : '標準'}`);

    try {
      // オーケストレーターを初期化（Electron非依存）
      const orchestrator = new ParallelDevelopmentOrchestrator(config, visualUI);

      // シグナルハンドラーを設定（Ctrl+Cなどで適切にクリーンアップ）
      let isCleaningUp = false;
      const cleanup_handler = async () => {
        if (isCleaningUp) {
          console.log('\n🛑 既にクリーンアップ中です...');
          return;
        }
        isCleaningUp = true;

        console.log('\n🛑 システム停止中...');

        try {
          orchestrator.stopLogViewer();
          await Promise.race([
            orchestrator.cleanup(true),
            new Promise(resolve => setTimeout(resolve, 30000)) // 30秒でタイムアウト
          ]);
        } catch (error) {
          console.error('🚨 クリーンアップエラー:', error);
        }

        process.exit(0);
      };

      // 既存のSIGINTハンドラーを削除してから新しいハンドラーを設定
      process.removeAllListeners('SIGINT');
      process.removeAllListeners('SIGTERM');
      process.on('SIGINT', cleanup_handler);
      process.on('SIGTERM', cleanup_handler);

      // 並列開発を実行
      const result = await orchestrator.executeUserRequest(userRequest);
      const { analysis, results, completedTasks, failedTasks } = result;

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      // 結果のサマリーを表示（全プロセス完了後）
      console.log('\n📊 実行結果サマリー');
      console.log(`═══════════════════════════════════════`);
      console.log(`📝 分析概要: ${analysis.summary}`);
      if (analysis.estimatedTime) {
        console.log(`⏱️ 見積もり時間: ${analysis.estimatedTime}`);
      }
      console.log(`📋 総タスク数: ${analysis.tasks.length}`);
      console.log(`✅ 成功したタスク: ${successCount}`);
      console.log(`❌ 失敗したタスク: ${failCount}`);

      if (failCount > 0) {
        console.log('\n❌ 失敗したタスク詳細:');
        results
          .filter(r => !r.success)
          .forEach(r => {
            const task = analysis.tasks.find((t: any) => t.id === r.taskId);
            console.log(`  - ${task?.title || r.taskId}: ${r.error}`);
          });
      }

      // ファイル変更のサマリー
      const allChangedFiles = new Set<string>();
      results.forEach(r => {
        if (r.filesChanged) {
          r.filesChanged.forEach((f: string) => allChangedFiles.add(f));
        }
      });

      if (allChangedFiles.size > 0) {
        console.log(`\n📁 変更されたファイル (${allChangedFiles.size}件):`);
        Array.from(allChangedFiles).forEach(file => {
          console.log(`  - ${file}`);
        });
      }

      // クリーンアップ
      if (keepWorktrees) {
        await orchestrator.cleanup(false);
        console.log('\n💡 Worktreeとブランチは保持されています。手動で削除する場合:');
        console.log(`   git worktree remove <worktree-path>`);
        console.log(`   git branch -D <branch-name>`);
      } else {
        await orchestrator.cleanup(true);
        console.log('\n🧹 Worktreeとブランチを自動削除しました');
      }

      console.log('\n🎉 AI並列開発完了！');

      // 失敗があった場合は非ゼロで終了
      if (failCount > 0) {
        process.exit(1);
      }

    } catch (error) {
      console.error('\n💥 システムエラー:', error);
      process.exit(1);
    }
  }
}

// スクリプトが直接実行された場合のみmain関数を呼び出し
ParallelDevelopmentCLI.main().catch((error) => {
  console.error('💥 予期しないエラー:', error);
  process.exit(1);
});

export { ParallelDevelopmentCLI };
