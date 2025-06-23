#!/usr/bin/env node

import { query, type SDKMessage } from "@anthropic-ai/claude-code";
import * as fs from 'fs';
import * as path from 'path';

/**
 * Claude Code SDKを使用してプロンプトを実行する
 */
class ClaudeCodeRunner {
  private readonly workingDir: string;

  constructor(workingDir: string = process.cwd()) {
    this.workingDir = path.resolve(workingDir);
  }

  /**
   * Claude Code SDKを使用してカスタムプロンプトを実行
   */
  async executePrompt(prompt: string): Promise<void> {
    console.log(`📂 作業ディレクトリ: ${this.workingDir}`);
    console.log(`🚀 プロンプト実行開始\n`);

    try {
      const messages: SDKMessage[] = [];

      for await (const message of query({
        prompt,
        abortController: new AbortController(),
        options: {
          maxTurns: 10,
          cwd: this.workingDir,
        },
      })) {
        // リアルタイムでメッセージを出力
        if (message && typeof message === 'object' && 'type' in message) {
          if (message.type === 'assistant' && 'message' in message) {
            const assistantMessage = message.message as any;
            if (assistantMessage.content) {
              for (const content of assistantMessage.content) {
                if (content.type === 'text') {
                  console.log(content.text);
                }
              }
            }
          }
        }
        messages.push(message);
      }

      console.log(`\n✅ 実行完了`);

    } catch (error) {
      console.error(`❌ エラー: プロンプトの実行に失敗しました:`, error);
      throw error;
    }
  }
}

/**
 * 使用方法を表示
 */
function showUsage() {
  console.log(`
📖 使用方法:
  npm run dev "<プロンプト>" [ディレクトリ]

引数:
  プロンプト    (必須) Claude Code SDKに送信するプロンプト
  ディレクトリ  (省略可) 実行ディレクトリ (デフォルト: カレントディレクトリ)

例:
  npm run dev "このディレクトリ内のMarkdownファイルを分析してください"
  npm run dev "README.mdを読んで要約してください" ./docs
  npm run dev "TypeScriptファイルのエラーをチェックしてください" /path/to/project
`);
}

/**
 * CLIインターフェース
 */
async function main() {
  const args = process.argv.slice(2);

  // ヘルプ表示
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showUsage();
    process.exit(0);
  }

  // 引数の解析
  const prompt = args[0];
  const workingDir = args[1] || process.cwd();

  if (!prompt) {
    console.error('❌ エラー: プロンプトが指定されていません');
    showUsage();
    process.exit(1);
  }

  // 作業ディレクトリの存在確認
  if (!fs.existsSync(workingDir)) {
    console.error(`❌ エラー: ディレクトリが存在しません: ${workingDir}`);
    process.exit(1);
  }

  // ディレクトリかどうかの確認
  const stats = fs.statSync(workingDir);
  if (!stats.isDirectory()) {
    console.error(`❌ エラー: 指定されたパスはディレクトリではありません: ${workingDir}`);
    process.exit(1);
  }

  try {
    const runner = new ClaudeCodeRunner(workingDir);
    await runner.executePrompt(prompt);
  } catch (error) {
    console.error('❌ 実行エラー:', error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみmain関数を呼び出し
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ 予期しないエラー:', error);
    process.exit(1);
  });
}

export { ClaudeCodeRunner };
