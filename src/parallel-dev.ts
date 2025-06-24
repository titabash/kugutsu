#!/usr/bin/env node

import { ParallelDevelopmentOrchestrator } from './managers/ParallelDevelopmentOrchestrator';
import { SystemConfig } from './types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * AI並列開発システムのメインエントリーポイント
 */
class ParallelDevelopmentCLI {

  /**
   * 使用方法を表示
   */
  private static showUsage(): void {
    console.log(`
🤖 AI並列開発システム

📖 使用方法:
  npm run parallel-dev "<開発要求>" [オプション]

引数:
  開発要求    (必須) 実装したい機能や修正内容

オプション:
  --base-repo <path>        ベースリポジトリのパス (デフォルト: .)
  --worktree-base <path>    Worktreeベースパス (デフォルト: ./worktrees)
  --max-engineers <num>     最大同時エンジニア数 (デフォルト: 10, 範囲: 1-100)
  --max-turns <num>         タスクあたりの最大ターン数 (デフォルト: 20)
  --base-branch <branch>    ベースブランチ (デフォルト: main)
  --use-remote              リモートリポジトリを使用 (デフォルト: ローカルのみ)
  --cleanup                 実行後にWorktreeをクリーンアップ
  --visual-ui               ターミナル分割表示を使用
  --help, -h                このヘルプを表示

例:
  npm run parallel-dev "ユーザー認証機能を実装してください"
  npm run parallel-dev "バグ修正: ログイン時のエラーハンドリング" --max-engineers 2
  npm run parallel-dev "新しいAPI endpointを3つ追加" --cleanup
  npm run parallel-dev "機能改善" --use-remote --cleanup
  npm run parallel-dev "パフォーマンス改善" --visual-ui
`);
  }

  /**
   * コマンドライン引数をパース
   */
  private static parseArgs(args: string[]): {
    userRequest?: string;
    config: SystemConfig;
    cleanup: boolean;
    showHelp: boolean;
    visualUI: boolean;
  } {
    const config: SystemConfig = {
      baseRepoPath: process.cwd(),
      worktreeBasePath: path.join(process.cwd(), 'worktrees'),
      maxConcurrentEngineers: 10,
      maxTurnsPerTask: 20,
      baseBranch: 'main',
      useRemote: false // デフォルトはローカルのみ
    };

    let cleanup = false;
    let showHelp = false;
    let visualUI = false;
    let userRequest: string | undefined;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--help' || arg === '-h') {
        showHelp = true;
      } else if (arg === '--cleanup') {
        cleanup = true;
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
        config.maxTurnsPerTask = parseInt(args[++i] || '20', 10);
      } else if (arg === '--base-branch') {
        config.baseBranch = args[++i] || 'main';
      } else if (!userRequest && !arg.startsWith('--')) {
        userRequest = arg;
      }
    }

    return { userRequest, config, cleanup, showHelp, visualUI };
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
      return { valid: false, error: `指定されたパスはGitリポジトリではありません: ${config.baseRepoPath}` };
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
    const { userRequest, config, cleanup, showHelp, visualUI } = this.parseArgs(args);

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

    console.log('🤖 AI並列開発システム起動');
    console.log(`📂 ベースリポジトリ: ${config.baseRepoPath}`);
    console.log(`🌿 Worktreeベース: ${config.worktreeBasePath}`);
    console.log(`👥 最大同時エンジニア数: ${config.maxConcurrentEngineers}`);
    console.log(`🔄 最大ターン数: ${config.maxTurnsPerTask}`);
    console.log(`🌱 ベースブランチ: ${config.baseBranch}`);
    console.log(`📡 リモート使用: ${config.useRemote ? 'はい' : 'いいえ'}`);
    console.log(`🧹 実行後クリーンアップ: ${cleanup ? 'はい' : 'いいえ'}`);
    console.log(`🖥️ ビジュアルUI: ${visualUI ? 'はい' : 'いいえ'}`);

    try {
      // オーケストレーターを初期化
      const orchestrator = new ParallelDevelopmentOrchestrator(config, visualUI);

      // シグナルハンドラーを設定（Ctrl+Cなどで適切にクリーンアップ）
      const cleanup_handler = async () => {
        console.log('\n🛑 システム停止中...');
        orchestrator.stopLogViewer();
        await orchestrator.cleanup(true);
        process.exit(0);
      };

      process.on('SIGINT', cleanup_handler);
      process.on('SIGTERM', cleanup_handler);

      // 並列開発を実行
      const { analysis, results } = await orchestrator.executeUserRequest(userRequest);

      // 結果のサマリーを表示（全プロセス完了後）
      console.log('\n📊 実行結果サマリー');
      console.log(`═══════════════════════════════════════`);
      console.log(`📝 分析概要: ${analysis.summary}`);
      console.log(`⏱️ 見積もり時間: ${analysis.estimatedTime}`);
      console.log(`📋 総タスク数: ${analysis.tasks.length}`);

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      console.log(`✅ 成功したタスク: ${successCount}`);
      console.log(`❌ 失敗したタスク: ${failCount}`);

      if (failCount > 0) {
        console.log('\n❌ 失敗したタスク詳細:');
        results
          .filter(r => !r.success)
          .forEach(r => {
            const task = analysis.tasks.find(t => t.id === r.taskId);
            console.log(`  - ${task?.title || r.taskId}: ${r.error}`);
          });
      }

      // ファイル変更のサマリー
      const allChangedFiles = new Set<string>();
      results.forEach(r => r.filesChanged.forEach(f => allChangedFiles.add(f)));

      if (allChangedFiles.size > 0) {
        console.log(`\n📁 変更されたファイル (${allChangedFiles.size}件):`);
        Array.from(allChangedFiles).forEach(file => {
          console.log(`  - ${file}`);
        });
      }

      // クリーンアップ
      if (cleanup) {
        await orchestrator.cleanup(true);
      } else {
        await orchestrator.cleanup(false);
        console.log('\n💡 Worktreeは保持されています。手動で削除する場合:');
        console.log(`   git worktree remove <worktree-path>`);
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
if (require.main === module) {
  ParallelDevelopmentCLI.main().catch((error) => {
    console.error('💥 予期しないエラー:', error);
    process.exit(1);
  });
}

export { ParallelDevelopmentCLI };
