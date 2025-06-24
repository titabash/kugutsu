#!/usr/bin/env node

import { ParallelDevelopmentOrchestratorWithElectron } from './managers/ParallelDevelopmentOrchestratorWithElectron';
import { SystemConfig } from './types';
import { electronLogAdapter } from './utils/ElectronLogAdapter';
import * as fs from 'fs';
import * as path from 'path';

/**
 * AI並列開発システムのElectron対応エントリーポイント
 */
class ParallelDevelopmentElectronCLI {

  /**
   * 使用方法を表示
   */
  private static showUsage(): void {
    console.log(`
🤖 AI並列開発システム (Electron UI版)

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
  --visual-ui               旧ターミナル分割表示を使用（非推奨）
  --electron                Electron UIを使用（デフォルト）
  --no-electron             Electron UIを無効化
  --devtools                Electron DevToolsを自動的に開く
  --help, -h                このヘルプを表示

例:
  npm run parallel-dev "ユーザー認証機能を実装してください" --electron
  npm run parallel-dev "バグ修正: ログイン時のエラーハンドリング" --max-engineers 2
  npm run parallel-dev "新しいAPI endpointを3つ追加" --cleanup --electron
  npm run parallel-dev "デバッグ作業" --devtools
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
    electronUI: boolean;
  } {
    const config: SystemConfig = {
      baseRepoPath: process.cwd(),
      worktreeBasePath: path.join(process.cwd(), 'worktrees'),
      maxConcurrentEngineers: 10,
      maxTurnsPerTask: 20,
      baseBranch: 'main',
      useRemote: false
    };

    let cleanup = false;
    let showHelp = false;
    let visualUI = false;
    let electronUI = true; // デフォルトでElectron UIを有効化

    let userRequest: string | undefined;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--help' || arg === '-h') {
        showHelp = true;
      } else if (arg === '--cleanup') {
        cleanup = true;
      } else if (arg === '--visual-ui') {
        visualUI = true;
        electronUI = false; // visual-uiが指定された場合はElectronを無効化
      } else if (arg === '--electron') {
        electronUI = true;
        visualUI = false;
      } else if (arg === '--no-electron') {
        electronUI = false;
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

    return { userRequest, config, cleanup, showHelp, visualUI, electronUI };
  }

  /**
   * 設定の検証
   */
  private static validateConfig(config: SystemConfig): void {
    if (!fs.existsSync(config.baseRepoPath)) {
      throw new Error(`ベースリポジトリが見つかりません: ${config.baseRepoPath}`);
    }

    if (!fs.existsSync(path.join(config.baseRepoPath, '.git'))) {
      throw new Error(`指定されたパスはGitリポジトリではありません: ${config.baseRepoPath}`);
    }

    if (config.maxConcurrentEngineers < 1 || config.maxConcurrentEngineers > 100) {
      throw new Error('最大同時エンジニア数は1〜100の間で指定してください');
    }

    if (config.maxTurnsPerTask < 1 || config.maxTurnsPerTask > 50) {
      throw new Error('最大ターン数は1〜50の間で指定してください');
    }
  }

  /**
   * メイン実行
   */
  static async main(): Promise<void> {
    try {
      const args = process.argv.slice(2);
      const { userRequest, config, cleanup, showHelp, visualUI, electronUI } = this.parseArgs(args);

      if (showHelp) {
        this.showUsage();
        process.exit(0);
      }

      if (!userRequest) {
        console.error('❌ エラー: 開発要求を指定してください');
        this.showUsage();
        process.exit(1);
      }

      // 設定の検証
      this.validateConfig(config);

      // Worktreeディレクトリの作成
      if (!fs.existsSync(config.worktreeBasePath)) {
        fs.mkdirSync(config.worktreeBasePath, { recursive: true });
      }

      console.log('🚀 AI並列開発システムを開始します...');
      console.log(`📍 ベースリポジトリ: ${config.baseRepoPath}`);
      console.log(`👥 最大同時エンジニア数: ${config.maxConcurrentEngineers}`);
      console.log(`🔄 最大ターン数: ${config.maxTurnsPerTask}`);
      console.log(`🌳 ベースブランチ: ${config.baseBranch}`);
      console.log(`🖥️  UIモード: ${electronUI ? 'Electron' : (visualUI ? 'Terminal分割' : '標準')}`);
      console.log(`📡 リモート使用: ${config.useRemote ? 'はい' : 'いいえ'}`);
      console.log('');

      // オーケストレーターの作成
      const orchestrator = new ParallelDevelopmentOrchestratorWithElectron(config, visualUI, electronUI);

      // シグナルハンドラーを設定（Ctrl+Cなどで適切にクリーンアップ）
      const cleanup_handler = async () => {
        console.log('\n🛑 システム停止中...');

        // Electronプロセスを終了
        if (electronUI) {
          electronLogAdapter.stop();
        }

        // オーケストレーターのクリーンアップ
        orchestrator.stopLogViewer();
        await orchestrator.cleanup(true);

        process.exit(0);
      };

      process.on('SIGINT', cleanup_handler);
      process.on('SIGTERM', cleanup_handler);

      // 並列開発を実行
      const result = await orchestrator.executeUserRequest(userRequest);

      // 結果のサマリー表示
      console.log('\n📊 実行結果サマリー:');
      console.log(`✅ 完了タスク: ${result.completedTasks.length}`);
      console.log(`❌ 失敗タスク: ${result.failedTasks.length}`);
      console.log(`📝 総タスク数: ${result.analysis.tasks.length}`);

      // クリーンアップオプションが有効な場合
      if (cleanup) {
        console.log('\n🧹 Worktreeのクリーンアップを実行中...');
        // クリーンアップ処理の実装
      }

      process.exit(0);
    } catch (error) {
      console.error('❌ エラーが発生しました:', error);
      process.exit(1);
    }
  }
}

// 実行
if (require.main === module) {
  ParallelDevelopmentElectronCLI.main();
}
