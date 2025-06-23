import { query, type SDKMessage } from "@anthropic-ai/claude-code";
import { Task, EngineerResult, AgentConfig, ReviewResult } from '../types';
import { MergeCoordinator } from '../utils/MergeCoordinator';
import { EngineerAI } from './EngineerAI';

/**
 * テックリードAIクラス
 * エンジニアAIの作業をレビューする
 */
export class TechLeadAI {
  private readonly config: AgentConfig;
  private readonly techLeadId: string;
  private mergeCoordinator?: MergeCoordinator;

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
          const reviewText = this.displayMessageActivity(message as any);
          if (reviewText) {
            reviewComments.push(reviewText);
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
   * メッセージアクティビティを表示
   */
  private displayMessageActivity(message: any): string | null {
    const messageType = message.type;
    let reviewText = '';
    
    switch (messageType) {
      case 'user':
        // ユーザーメッセージ（入力）
        if (message.message && message.message.content) {
          for (const content of message.message.content) {
            if (content.type === 'text') {
              console.log(`📝 テックリードAI[${this.techLeadId}]: 入力受信 - ${this.truncateText(content.text, 100)}`);
            }
          }
        }
        break;

      case 'assistant':
        // アシスタントメッセージ（レビューコメント）
        if (message.message && message.message.content) {
          for (const content of message.message.content) {
            if (content.type === 'text') {
              const text = content.text;
              console.log(`🔍 テックリードAI[${this.techLeadId}]: ${this.truncateText(text, 200)}`);
              reviewText += text;
            } else if (content.type === 'tool_use') {
              const toolName = content.name;
              const toolId = content.id;
              const toolInput = content.input || {};
              console.log(`🛠️  テックリードAI[${this.techLeadId}]: ツール実行 - ${toolName}`);
              this.displayToolExecutionDetails(toolName, toolInput, toolId);
            }
          }
        }
        break;

      case 'tool_result':
        // ツール実行結果
        if (message.content) {
          for (const content of message.content) {
            if (content.type === 'tool_result') {
              const toolUseId = content.tool_use_id;
              const isError = content.is_error;
              const status = isError ? '❌ エラー' : '✅ 成功';
              const result = content.content;
              
              console.log(`📊 テックリードAI[${this.techLeadId}]: ツール結果 - ${status}`);
              
              if (isError) {
                console.log(`   ❌ エラー詳細: ${this.truncateText(String(result), 150)}`);
              } else {
                this.displayToolResult(result, toolUseId);
              }
            }
          }
        }
        break;

      case 'error':
        // エラーメッセージ
        console.log(`❌ テックリードAI[${this.techLeadId}]: エラーが発生しました`);
        if (message.error) {
          console.log(`   ❌ エラー: ${this.truncateText(String(message.error), 200)}`);
        }
        break;

      case 'system':
        // システムメッセージ
        console.log(`⚙️  テックリードAI[${this.techLeadId}]: システム通知`);
        if (message.content) {
          console.log(`   📋 内容: ${this.truncateText(String(message.content), 150)}`);
        }
        break;

      case 'thinking':
        // 思考過程（内部処理）
        console.log(`🤔 テックリードAI[${this.techLeadId}]: レビュー中...`);
        break;

      case 'event':
        // イベント通知
        if (message.event_type) {
          console.log(`📢 テックリードAI[${this.techLeadId}]: イベント - ${message.event_type}`);
        }
        break;

      default:
        // 未知のメッセージタイプ
        console.log(`🔍 テックリードAI[${this.techLeadId}]: 未知のメッセージタイプ - ${messageType}`);
        break;
    }

    return reviewText || null;
  }

  /**
   * ツール実行の詳細を表示
   */
  private displayToolExecutionDetails(toolName: string, toolInput: any, _toolId: string): void {
    switch (toolName) {
      case 'Read':
        console.log(`   📖 ファイル読み取り: ${toolInput.file_path || 'パス不明'}`);
        break;

      case 'Bash':
        console.log(`   💻 コマンド実行: ${this.truncateText(toolInput.command || 'コマンド不明', 100)}`);
        break;

      case 'Grep':
        console.log(`   🔎 内容検索: ${toolInput.pattern || 'パターン不明'}`);
        if (toolInput.include) {
          console.log(`   📂 対象ファイル: ${toolInput.include}`);
        }
        break;

      case 'Glob':
        console.log(`   🔍 ファイル検索: ${toolInput.pattern || 'パターン不明'}`);
        if (toolInput.path) {
          console.log(`   📁 検索パス: ${toolInput.path}`);
        }
        break;

      case 'LS':
        console.log(`   📂 ディレクトリ一覧: ${toolInput.path || 'パス不明'}`);
        break;

      default:
        console.log(`   ⚙️  パラメータ: ${JSON.stringify(toolInput).substring(0, 100)}...`);
        break;
    }
  }

  /**
   * ツール実行結果を表示
   */
  private displayToolResult(result: any, _toolId: string): void {
    if (typeof result === 'string') {
      const lines = result.split('\n');
      const lineCount = lines.length;
      
      if (lineCount === 1) {
        console.log(`   ✅ 結果: ${this.truncateText(result, 100)}`);
      } else if (lineCount <= 5) {
        console.log(`   ✅ 結果: ${lineCount}行の出力`);
        lines.forEach(line => {
          if (line.trim()) {
            console.log(`   │ ${this.truncateText(line, 80)}`);
          }
        });
      } else {
        console.log(`   ✅ 結果: ${lineCount}行の出力（抜粋）`);
        lines.slice(0, 3).forEach(line => {
          if (line.trim()) {
            console.log(`   │ ${this.truncateText(line, 80)}`);
          }
        });
        console.log(`   │ ... (他${lineCount - 3}行)`);
      }
    } else if (typeof result === 'object' && result !== null) {
      console.log(`   ✅ 結果: オブジェクト形式`);
      const preview = JSON.stringify(result, null, 2);
      console.log(`   │ ${this.truncateText(preview, 150)}`);
    } else {
      console.log(`   ✅ 結果: ${String(result)}`);
    }
  }

  /**
   * テキストを指定された長さで切り詰める
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
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

  /**
   * MergeCoordinatorを設定
   */
  setMergeCoordinator(mergeCoordinator: MergeCoordinator): void {
    this.mergeCoordinator = mergeCoordinator;
  }

  /**
   * レビュー承認後の協調マージを実行
   */
  async performCoordinatedMerge(
    task: Task,
    reviewResult: ReviewResult
  ): Promise<{
    success: boolean;
    conflictResolutionInProgress?: boolean;
    error?: string;
  }> {
    if (!this.mergeCoordinator) {
      throw new Error('MergeCoordinatorが設定されていません');
    }

    if (reviewResult.status !== 'APPROVED') {
      return {
        success: false,
        error: `レビューが承認されていません: ${reviewResult.status}`
      };
    }

    console.log(`🔀 テックリードAI[${this.techLeadId}]: 協調マージ開始 - ${task.title}`);

    // コンフリクト解消用のコールバック関数
    const conflictResolutionHandler = async (
      conflictTask: Task,
      engineerId: string,
      existingEngineer?: EngineerAI
    ): Promise<EngineerResult> => {
      console.log(`🔧 テックリードAI[${this.techLeadId}]: コンフリクト解消依頼 - ${conflictTask.title}`);
      
      // 既存のエンジニアAIがあれば再利用、なければ新規作成
      const engineer = existingEngineer || new EngineerAI(engineerId, {
        systemPrompt: this.buildConflictResolutionPrompt(),
        maxTurns: 25,
        allowedTools: ["Read", "Write", "Edit", "MultiEdit", "Bash", "Glob", "Grep", "LS"]
      });

      // コンフリクト解消タスクを実行
      return await engineer.executeTask({
        ...conflictTask,
        title: `コンフリクト解消: ${conflictTask.title}`,
        description: `${conflictTask.description}\n\n## コンフリクト解消指示\nマージコンフリクトが発生しました。以下の手順で解消してください：\n1. git status でコンフリクトファイルを確認\n2. コンフリクトマーカーを手動で解消\n3. git add でステージング\n4. git commit でコミット完了`
      });
    };

    // 協調マージを実行
    const mergeResult = await this.mergeCoordinator.coordinatedMerge(
      task,
      conflictResolutionHandler
    );

    if (mergeResult.success) {
      console.log(`✅ テックリードAI[${this.techLeadId}]: マージ成功 - ${task.title}`);
    } else if (mergeResult.conflictResolutionInProgress) {
      console.log(`⚠️ テックリードAI[${this.techLeadId}]: コンフリクト解消中（並列実行） - ${task.title}`);
    } else {
      console.log(`❌ テックリードAI[${this.techLeadId}]: マージ失敗 - ${task.title}: ${mergeResult.error}`);
    }

    return mergeResult;
  }

  /**
   * コンフリクト解消用のシステムプロンプト
   */
  private buildConflictResolutionPrompt(): string {
    return `あなたは経験豊富なソフトウェアエンジニアです。
マージコンフリクトの解消を専門に行います。

## コンフリクト解消の手順
1. **コンフリクト状況の確認**
   - \`git status\` でコンフリクトファイルを特定
   - \`git diff\` で競合内容を確認

2. **コンフリクトマーカーの解消**
   - \`<<<<<<<\`, \`=======\`, \`>>>>>>>\` マーカーを確認
   - 両方のブランチの変更を適切に統合
   - マーカーを完全に削除

3. **統合の確認**
   - 統合されたコードが正しく動作することを確認
   - 既存のテストが通ることを確認

4. **コミット完了**
   - \`git add\` で解消したファイルをステージング
   - \`git commit\` でマージコミット完了

## 重要事項
- コンフリクト解消は慎重に行ってください
- 両方のブランチの意図を理解して統合してください
- 機能の破綻や品質低下を避けてください
- 解消後は必ずテストを実行してください

効率的で品質の高いコンフリクト解消を心がけてください。`;
  }

  /**
   * 協調マージの状態を確認
   */
  getMergeStatus(): {
    isLocked: boolean;
    queueLength: number;
    pendingConflicts: number;
  } | null {
    if (!this.mergeCoordinator) {
      return null;
    }
    return this.mergeCoordinator.getMutexStatus();
  }
}