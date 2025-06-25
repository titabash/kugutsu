#!/usr/bin/env node

import { ParallelDevelopmentOrchestrator } from './managers/ParallelDevelopmentOrchestrator';
import { ParallelDevelopmentOrchestratorWithElectron } from './managers/ParallelDevelopmentOrchestratorWithElectron';
import { SystemConfig } from './types';
import { electronLogAdapter } from './utils/ElectronLogAdapter';
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
🤖 Kugutsu - AI並列開発システム

📖 使用方法:
  kugutsu "<開発要求>" [オプション]

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
  --electron                Electron UIを使用（デフォルト）
  --no-electron             Electron UIを無効化してCLIモードで実行
  --devtools                Electron DevToolsを自動的に開く
  --help, -h                このヘルプを表示

例:
  kugutsu "ユーザー認証機能を実装してください" --electron
  kugutsu "バグ修正: ログイン時のエラーハンドリング" --max-engineers 2 --no-electron
  kugutsu "新しいAPI endpointを3つ追加" --cleanup
  kugutsu "機能改善" --use-remote --cleanup --visual-ui
  kugutsu "デバッグ作業" --devtools
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
      useRemote: false // デフォルトはローカルのみ
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
    const { userRequest, config, cleanup, showHelp, visualUI, electronUI } = this.parseArgs(args);

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
    console.log(`🖥️  UIモード: ${electronUI ? 'Electron' : (visualUI ? 'Terminal分割' : '標準')}`);

    try {
      // オーケストレーターを初期化
      const orchestrator = electronUI 
        ? new ParallelDevelopmentOrchestratorWithElectron(config, visualUI, electronUI)
        : new ParallelDevelopmentOrchestrator(config, visualUI);

      // シグナルハンドラーを設定（Ctrl+Cなどで適切にクリーンアップ）
      const cleanup_handler = async () => {
        console.log('\n🛑 システム停止中...');
        
        // Electronプロセスを終了
        if (electronUI) {
          electronLogAdapter.stop();
        }
        
        orchestrator.stopLogViewer();
        await orchestrator.cleanup(true);
        process.exit(0);
      };

      process.on('SIGINT', cleanup_handler);
      process.on('SIGTERM', cleanup_handler);

      // 並列開発を実行
      let analysis: any;
      let results: any[];
      let successCount: number;
      let failCount: number;
      
      if (electronUI) {
        // Electron版の場合
        const result = await orchestrator.executeUserRequest(userRequest);
        analysis = result.analysis;
        results = [...result.completedTasks, ...result.failedTasks];
        successCount = result.completedTasks.length;
        failCount = result.failedTasks.length;
      } else {
        // 通常版の場合
        const result = await orchestrator.executeUserRequest(userRequest);
        analysis = result.analysis;
        results = result.results;
        successCount = results.filter(r => r.success).length;
        failCount = results.filter(r => !r.success).length;
      }

      // 結果のサマリーを表示（全プロセス完了後）
      console.log('\n📊 実行結果サマリー');
      console.log(`═══════════════════════════════════════`);
      console.log(`📝 分析概要: ${analysis.summary}`);
      console.log(`⏱️ 見積もり時間: ${analysis.estimatedTime}`);
      console.log(`📋 総タスク数: ${analysis.tasks.length}`);
      console.log(`✅ 成功したタスク: ${successCount}`);
      console.log(`❌ 失敗したタスク: ${failCount}`);

      if (failCount > 0) {
        console.log('\n❌ 失敗したタスク詳細:');
        results
          .filter(r => !r.success && !r.taskId) // 通常版の場合
          .concat(results.filter(r => r.taskId && r.error)) // Electron版の場合
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
