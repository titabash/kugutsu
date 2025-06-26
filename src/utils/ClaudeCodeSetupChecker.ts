import { execSync } from 'child_process';
import { query, type SDKMessage } from "@anthropic-ai/claude-code";

/**
 * Claude Codeのセットアップ状態を確認するユーティリティ
 */
export class ClaudeCodeSetupChecker {
  /**
   * Claude Codeがインストールされているか確認
   */
  private static isClaudeCodeInstalled(): boolean {
    try {
      // claude コマンドが存在するか確認
      execSync('which claude', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Claude Codeのバージョンを取得
   */
  private static getClaudeCodeVersion(): string | null {
    try {
      const version = execSync('claude --version', { encoding: 'utf-8' }).trim();
      return version;
    } catch {
      return null;
    }
  }

  /**
   * Claude Code SDKが利用可能か確認（簡単なクエリを実行）
   */
  private static async isSDKAuthenticated(): Promise<boolean> {
    try {
      // 最小限のクエリを実行して認証状態を確認
      const testQuery = query({
        prompt: "Say 'OK' if you can hear me",
        abortController: new AbortController(),
        options: {
          maxTurns: 1,
          permissionMode: 'acceptEdits'
        }
      });

      // タイムアウトを設定（5秒）
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      // 最初のメッセージを待つ
      const result = await Promise.race([
        testQuery.next(),
        timeoutPromise
      ]);

      // 結果を確認
      if (result && typeof result === 'object' && 'value' in result) {
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * セットアップ状態を総合的にチェック
   */
  static async checkSetup(): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    info: {
      claudeCodeInstalled: boolean;
      version: string | null;
      sdkAuthenticated: boolean;
    };
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // 1. Claude Codeのインストール確認
    const claudeCodeInstalled = this.isClaudeCodeInstalled();
    if (!claudeCodeInstalled) {
      errors.push('Claude Codeがインストールされていません。');
      errors.push('以下のコマンドでインストールしてください:');
      errors.push('  npm install -g @anthropic-ai/claude-code');
    }

    // 2. バージョン情報の取得
    const version = this.getClaudeCodeVersion();
    
    // 3. SDK認証状態の確認（Claude Codeがインストールされている場合のみ）
    let sdkAuthenticated = false;
    if (claudeCodeInstalled) {
      console.log('🔍 Claude Code SDKの認証状態を確認中...');
      sdkAuthenticated = await this.isSDKAuthenticated();
      
      if (!sdkAuthenticated) {
        errors.push('Claude Codeの認証が完了していません。');
        errors.push('以下の手順で認証してください:');
        errors.push('  1. ターミナルで "claude" コマンドを実行');
        errors.push('  2. ブラウザが開いたらAnthropicアカウントでログイン');
        errors.push('  3. 認証完了後、再度このコマンドを実行');
      }
    }

    const isValid = errors.length === 0;

    return {
      isValid,
      errors,
      warnings,
      info: {
        claudeCodeInstalled,
        version,
        sdkAuthenticated
      }
    };
  }

  /**
   * セットアップガイドを表示
   */
  static displaySetupGuide(): void {
    console.log(`
📚 Claude Codeセットアップガイド
================================

1. Claude Codeのインストール:
   npm install -g @anthropic-ai/claude-code

2. Claude Codeの認証:
   ターミナルで以下のコマンドを実行:
   claude

   初回実行時に認証プロセスが開始されます。
   ブラウザが開き、Anthropicアカウントでのログインが求められます。

3. 認証の確認:
   認証が完了したら、再度このツールを実行してください。

詳細なドキュメント:
https://docs.anthropic.com/en/docs/claude-code/overview
`);
  }
}