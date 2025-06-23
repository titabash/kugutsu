import { query, type SDKMessage } from "@anthropic-ai/claude-code";
import { Task, EngineerResult, AgentConfig, ReviewResult } from '../types';

/**
 * テックリードAIクラス
 * エンジニアAIの作業をレビューする
 */
export class TechLeadAI {
  private readonly config: AgentConfig;
  private readonly techLeadId: string;

  constructor(techLeadId: string, config?: Partial<AgentConfig>) {
    this.techLeadId = techLeadId;
    this.config = {
      systemPrompt: this.getDefaultSystemPrompt(),
      maxTurns: 15,
      allowedTools: ["Read", "Bash", "Grep", "Glob", "LS"],
      ...config
    };
  }

  /**
   * デフォルトのシステムプロンプト
   */
  private getDefaultSystemPrompt(): string {
    return `あなたは経験豊富なテックリードです（ID: ${this.techLeadId}）。
エンジニアAIが実装したコードをレビューすることが役割です。

## レビューの方針
1. コードの品質を厳しくチェックしてください
2. セキュリティ、パフォーマンス、保守性を重視してください
3. 既存のコード規約とパターンに従っているかを確認してください
4. テストの有無と品質を評価してください
5. 後方互換性が保たれているかを確認してください

## レビュー項目
### 必須確認項目
- [ ] 要求された機能が正しく実装されているか
- [ ] 既存のテストが引き続き通るか
- [ ] 新しい機能に対するテストが適切に作成されているか
- [ ] セキュリティベストプラクティスに従っているか
- [ ] エラーハンドリングが適切に実装されているか
- [ ] コード規約に従っているか

### 品質評価項目
- [ ] コードの可読性・保守性
- [ ] パフォーマンスへの配慮
- [ ] 適切なコメント・ドキュメント
- [ ] リファクタリングの必要性
- [ ] 設計の妥当性

## 判定基準
- **承認 (APPROVED)**: 全ての必須項目をクリアし、品質基準を満たしている
- **要修正 (CHANGES_REQUESTED)**: 修正が必要な問題がある
- **コメント (COMMENTED)**: 問題はないが改善提案がある

## レビューコメントの書き方
- 具体的で建設的なフィードバックを提供してください
- 問題のある箇所は具体的なファイル名と行数を示してください
- 修正方法の提案も含めてください
- 良い点も評価してください

効率的で厳格なレビューを心がけてください。`;
  }

  /**
   * エンジニアAIの成果物をレビュー
   */
  async reviewEngineerWork(task: Task, engineerResult: EngineerResult): Promise<ReviewResult> {
    console.log(`👔 テックリードAI[${this.techLeadId}]: レビュー開始`);
    console.log(`📋 タスク: ${task.title}`);

    const startTime = Date.now();
    const prompt = this.buildReviewPrompt(task, engineerResult);

    try {
      const messages: SDKMessage[] = [];
      const reviewComments: string[] = [];

      for await (const message of query({
        prompt,
        abortController: new AbortController(),
        options: {
          maxTurns: this.config.maxTurns,
          cwd: task.worktreePath,
          allowedTools: this.config.allowedTools
        },
      })) {
        messages.push(message);

        // リアルタイムでテックリードAIのレビュー状況を表示
        if (message && typeof message === 'object' && 'type' in message) {
          if (message.type === 'assistant' && 'message' in message) {
            const assistantMessage = message.message as any;
            if (assistantMessage.content) {
              for (const content of assistantMessage.content) {
                if (content.type === 'text') {
                  const text = content.text;
                  console.log(`🔍 テックリードAI[${this.techLeadId}]: ${text}`);
                  reviewComments.push(text);
                }
              }
            }
          }
        }
      }

      const duration = Date.now() - startTime;
      
      // レビュー結果を解析してステータスを決定
      const reviewStatus = this.parseReviewStatus(reviewComments);
      
      console.log(`✅ テックリードAI[${this.techLeadId}]: レビュー完了 (${duration}ms)`);
      console.log(`📊 レビュー結果: ${reviewStatus}`);

      return {
        taskId: task.id,
        status: reviewStatus,
        comments: reviewComments,
        reviewer: this.techLeadId,
        reviewedAt: new Date(),
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      console.error(`❌ テックリードAI[${this.techLeadId}]: レビュー失敗:`, error);

      return {
        taskId: task.id,
        status: 'ERROR',
        comments: [`レビュー中にエラーが発生しました: ${error}`],
        reviewer: this.techLeadId,
        reviewedAt: new Date(),
        duration,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * レビュー用プロンプトを構築
   */
  private buildReviewPrompt(task: Task, engineerResult: EngineerResult): string {
    return `
🔍 テックリードによるコードレビュー開始

あなたは経験豊富なテックリードです。
エンジニアAIが実装したタスクをレビューしてください。

## 📋 レビュー対象情報
- **タスクID**: ${task.id}
- **タイトル**: ${task.title}
- **作業ディレクトリ**: ${task.worktreePath}
- **実装時間**: ${engineerResult.duration}ms
- **変更ファイル数**: ${engineerResult.filesChanged.length}個
- **実装結果**: ${engineerResult.success ? '成功' : '失敗'}

## 📝 タスク要件
${task.description}

## 📁 変更されたファイル
${engineerResult.filesChanged.length > 0 
  ? engineerResult.filesChanged.map(file => `- ${file}`).join('\n')
  : '変更されたファイルなし'
}

## 🔍 レビュー手順

### 1. 実装状況の確認
まず、変更されたファイルを詳しく確認してください：

\`\`\`bash
# 変更状況を確認
git status
git diff --staged
git diff HEAD~1..HEAD
\`\`\`

### 2. 必須チェック項目の確認
以下を順番に確認してください：

#### ✅ 機能実装の確認
- [ ] 要求された機能が正しく実装されている
- [ ] エラーハンドリングが適切に実装されている
- [ ] 入出力の検証が適切に行われている

#### ✅ テストの確認
- [ ] 新機能に対するテストが作成されている
- [ ] 既存のテストが引き続き通る
- [ ] テストケースが適切で十分である

#### ✅ コード品質の確認
- [ ] コードが読みやすく保守しやすい
- [ ] 適切な命名規則に従っている
- [ ] コード重複がない
- [ ] 適切なコメントが付いている

#### ✅ セキュリティの確認
- [ ] セキュリティベストプラクティスに従っている
- [ ] 入力値検証が適切に行われている
- [ ] 機密情報の適切な取り扱い

#### ✅ パフォーマンスの確認
- [ ] 不要な処理やループがない
- [ ] リソースの適切な管理
- [ ] スケーラビリティへの配慮

### 3. 実行テストの実施
可能であれば以下を実行してください：

\`\`\`bash
# テストの実行
npm test
# または
pytest
# または該当するテストコマンド

# ビルドの確認
npm run build
# または該当するビルドコマンド

# リントチェック
npm run lint
# または該当するリントコマンド
\`\`\`

### 4. レビュー結果の決定

以下の基準で判定してください：

- **APPROVED**: 全ての必須項目をクリアし、品質基準を満たしている
- **CHANGES_REQUESTED**: 修正が必要な問題がある
- **COMMENTED**: 問題はないが改善提案がある

## 📋 レビューレポートの作成

最後に、以下の形式でレビュー結果をまとめてください：

\`\`\`
## レビュー結果: [APPROVED/CHANGES_REQUESTED/COMMENTED]

### ✅ 良い点
- [具体的な良い点を記載]

### ⚠️ 指摘事項 (該当がある場合)
- [修正が必要な点を具体的に記載]
- [ファイル名:行数] を明記

### 💡 改善提案 (該当がある場合)
- [任意の改善提案を記載]

### 📊 総合評価
[実装の全体的な評価とコメント]
\`\`\`

厳格かつ建設的なレビューを実施してください。品質向上のため遠慮なく指摘してください。`;
  }

  /**
   * レビューコメントからステータスを解析
   */
  private parseReviewStatus(comments: string[]): 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'ERROR' {
    const fullText = comments.join(' ').toUpperCase();
    
    if (fullText.includes('CHANGES_REQUESTED') || fullText.includes('修正が必要')) {
      return 'CHANGES_REQUESTED';
    } else if (fullText.includes('APPROVED') || fullText.includes('承認')) {
      return 'APPROVED';
    } else if (fullText.includes('COMMENTED') || fullText.includes('コメント')) {
      return 'COMMENTED';
    } else {
      // デフォルトとして、問題の指摘があるかどうかで判定
      if (fullText.includes('問題') || fullText.includes('エラー') || fullText.includes('修正')) {
        return 'CHANGES_REQUESTED';
      } else {
        return 'APPROVED';
      }
    }
  }

  /**
   * テックリードIDを取得
   */
  getTechLeadId(): string {
    return this.techLeadId;
  }

  /**
   * 設定を取得
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }
}