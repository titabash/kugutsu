import { query, type SDKMessage } from "@anthropic-ai/claude-code";
import { Task, TaskAnalysisResult, AgentConfig } from '../types';
import { TaskInstructionManager } from '../utils/TaskInstructionManager';
import { v4 as uuidv4 } from 'uuid';

/**
 * プロダクトオーナーAIクラス
 * ユーザからの要求を分析し、具体的なタスクに分割する
 */
export class ProductOwnerAI {
  private readonly config: AgentConfig;
  private readonly baseRepoPath: string;

  constructor(baseRepoPath: string, config?: Partial<AgentConfig>) {
    this.baseRepoPath = baseRepoPath;
    this.config = {
      systemPrompt: this.getDefaultSystemPrompt(),
      maxTurns: 5,
      allowedTools: ["Read", "Glob", "Grep", "LS"],
      ...config
    };
  }

  /**
   * デフォルトのシステムプロンプト
   */
  private getDefaultSystemPrompt(): string {
    return `あなたは経験豊富なプロダクトオーナー兼テックリードです。
ユーザからの開発要求を分析し、効率的で実行可能なタスクに分割することが役割です。

重要：並列処理の最大化を優先してください。可能な限り多くの独立したタスクに分割し、同時実行を促進してください。

以下の観点でタスクを分析してください：
1. 要求の明確化と詳細化
2. 技術的実現可能性の評価
3. 積極的なタスク分割（小さなタスクでも独立させる）
4. タスク間の依存関係の最小化
5. 優先度の設定
6. リスク評価

特別なルール：
- ユーザーが「並列」「同時」「複数」といったキーワードを使用した場合は、必ず複数タスクに分割する
- 単純な作業でも、異なるファイルに対する操作は独立したタスクとして扱う
- テスト目的の要求では、最低でも2つ以上のタスクに分割する

コードベースを理解するため、必要に応じてRead、Glob、Grepツールを使用してファイルを調査してください。
最終的に、JSON形式でタスクリストと分析結果を返してください。`;
  }

  /**
   * ユーザからの要求を分析してタスクに分割し、指示ファイルを作成
   */
  async analyzeUserRequestWithInstructions(
    userRequest: string, 
    instructionManager: TaskInstructionManager
  ): Promise<TaskAnalysisResult> {
    console.log('🧠 プロダクトオーナーAI: 要求分析開始');
    
    const prompt = this.buildAnalysisPrompt(userRequest);
    
    try {
      const messages: SDKMessage[] = [];
      let fullAnalysis = '';
      
      for await (const message of query({
        prompt,
        abortController: new AbortController(),
        options: {
          maxTurns: this.config.maxTurns,
          cwd: this.baseRepoPath,
        },
      })) {
        messages.push(message);
        
        // リアルタイムでプロダクトオーナーAIの思考過程を表示
        if (message && typeof message === 'object' && 'type' in message) {
          const analysisText = this.displayMessageActivity(message as any);
          if (analysisText) {
            fullAnalysis += analysisText + '\n';
          }
        }
      }

      // タスクを解析・作成（実際のLLMの応答メッセージを使用）
      const result = this.extractTaskAnalysisResult(messages);
      
      // 概要ファイルを作成
      await instructionManager.createOverviewFile(userRequest, fullAnalysis);
      
      // 各タスクの詳細指示ファイルを作成
      for (const task of result.tasks) {
        const detailedInstructions = await this.generateDetailedInstructions(task, userRequest, fullAnalysis);
        await instructionManager.createTaskInstructionFile(task, detailedInstructions);
      }
      
      // 依存関係ファイルを作成
      await instructionManager.createDependencyFile(result.tasks);
      
      console.log('✅ プロダクトオーナーAI: 分析完了 & 指示ファイル作成完了');
      return result;

    } catch (error) {
      console.error('❌ プロダクトオーナーAI分析エラー:', error);
      throw new Error(`プロダクトオーナーAIの分析に失敗しました: ${error}`);
    }
  }

  /**
   * メッセージアクティビティを表示
   */
  private displayMessageActivity(message: any): string | null {
    const messageType = message.type;
    let analysisText = '';
    
    switch (messageType) {
      case 'user':
        // ユーザーメッセージ（入力）
        if (message.message && message.message.content) {
          for (const content of message.message.content) {
            if (content.type === 'text') {
              console.log(`📝 プロダクトオーナーAI: 入力受信 - ${this.truncateText(content.text, 100)}`);
            }
          }
        }
        break;

      case 'assistant':
        // アシスタントメッセージ（出力・思考）
        if (message.message && message.message.content) {
          for (const content of message.message.content) {
            if (content.type === 'text') {
              const text = content.text;
              console.log(`💭 プロダクトオーナーAI: ${this.truncateText(text, 200)}`);
              analysisText += text;
            } else if (content.type === 'tool_use') {
              const toolName = content.name;
              const toolId = content.id;
              const toolInput = content.input || {};
              console.log(`🛠️  プロダクトオーナーAI: ツール実行 - ${toolName}`);
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
              
              console.log(`📊 プロダクトオーナーAI: ツール結果 - ${status}`);
              
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
        console.log(`❌ プロダクトオーナーAI: エラーが発生しました`);
        if (message.error) {
          console.log(`   ❌ エラー: ${this.truncateText(String(message.error), 200)}`);
        }
        break;

      case 'system':
        // システムメッセージ
        console.log(`⚙️  プロダクトオーナーAI: システム通知`);
        if (message.content) {
          console.log(`   📋 内容: ${this.truncateText(String(message.content), 150)}`);
        }
        break;

      case 'thinking':
        // 思考過程（内部処理）
        console.log(`🤔 プロダクトオーナーAI: 分析中...`);
        break;

      case 'event':
        // イベント通知
        if (message.event_type) {
          console.log(`📢 プロダクトオーナーAI: イベント - ${message.event_type}`);
        }
        break;

      case 'result':
        // 旧形式の結果メッセージ（後方互換性）
        analysisText += (message as any).result || '';
        break;

      default:
        // 未知のメッセージタイプ
        console.log(`🔍 プロダクトオーナーAI: 未知のメッセージタイプ - ${messageType}`);
        break;
    }

    return analysisText || null;
  }

  /**
   * ツール実行の詳細を表示
   */
  private displayToolExecutionDetails(toolName: string, toolInput: any, _toolId: string): void {
    switch (toolName) {
      case 'Read':
        console.log(`   📖 ファイル読み取り: ${toolInput.file_path || 'パス不明'}`);
        break;

      case 'Glob':
        console.log(`   🔍 ファイル検索: ${toolInput.pattern || 'パターン不明'}`);
        if (toolInput.path) {
          console.log(`   📁 検索パス: ${toolInput.path}`);
        }
        break;

      case 'Grep':
        console.log(`   🔎 内容検索: ${toolInput.pattern || 'パターン不明'}`);
        if (toolInput.include) {
          console.log(`   📂 対象ファイル: ${toolInput.include}`);
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
   * 分析用プロンプトを構築
   */
  private buildAnalysisPrompt(userRequest: string): string {
    return `
プロダクトオーナーとして、以下のユーザー要求を分析してください：

## ユーザー要求
${userRequest}

## 分析手順
1. まず、現在のコードベースを調査してプロジェクト構造を理解してください
2. ユーザー要求を技術的観点から詳しく分析してください
3. 実装に必要なタスクを具体的に洗い出してください
4. 各タスクを適切なサイズ（1-2時間程度）に分割してください
5. タスク間の依存関係を整理してください

## 重要：タスク分割の指針
- ユーザーが「並列」「同時」「複数」などの並列処理を示唆している場合は、必ず複数の独立したタスクに分割してください
- 異なるファイルに対する操作は、可能な限り独立したタスクとして扱ってください
- 単一のファイルに対する複数の変更でも、論理的に分離可能であれば別タスクにしてください

## 分析内容
- プロジェクトの現状把握
- 要求の技術的実現可能性
- 必要なタスクの洗い出し
- リスク評価と対策
- 実装の優先順位

## 必須：最終的に以下のJSON形式でタスクリストを出力してください

\`\`\`json
{
  "tasks": [
    {
      "title": "タスクのタイトル",
      "description": "タスクの詳細な説明",
      "type": "feature|bugfix|documentation|test",
      "priority": "high|medium|low",
      "dependencies": ["依存するタスクのタイトル"]
    }
  ],
  "summary": "分析の概要",
  "estimatedTime": "見積もり時間",
  "riskAssessment": "リスク評価"
}
\`\`\`

詳細な分析結果を自然な日本語で説明した後、上記のJSON形式でタスクリストを必ず出力してください。`;
  }

  /**
   * 分析結果からタスクを抽出・作成
   */
  private extractTasksFromAnalysis(analysisText: string, userRequest: string): TaskAnalysisResult {
    // 分析テキストを仮のメッセージ配列として扱い、LLMの分析結果を解析
    const fakeMessages = [{ type: 'result', result: analysisText } as any];
    const jsonResult = this.extractTaskAnalysisResult(fakeMessages);
    
    // JSONから複数タスクが抽出された場合はそれを使用
    if (jsonResult.tasks.length > 1) {
      console.log(`✅ 複数タスクを検出: ${jsonResult.tasks.length}個のタスク`);
      return jsonResult;
    }
    
    // JSONが見つからない場合でも、分析テキストから複数のタスクを推測
    if (jsonResult.tasks.length === 1 && (analysisText.includes('並列') || analysisText.includes('同時') || analysisText.includes('複数'))) {
      console.log('⚠️ JSON未検出ですが、並列処理キーワードを検出したため複数タスクを生成します');
      
      const tasks: Task[] = [
        {
          id: uuidv4(),
          type: 'feature',
          title: 'メインタスクの実装',
          description: userRequest,
          priority: 'high',
          status: 'pending',
          dependencies: [],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: uuidv4(),
          type: 'feature',
          title: '並列タスクの実装',
          description: `${userRequest} - 並列処理部分`,
          priority: 'high',
          status: 'pending',
          dependencies: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      return {
        tasks,
        summary: `ユーザー要求「${userRequest}」に対する分析結果（並列処理対応）`,
        estimatedTime: '1-2時間',
        riskAssessment: '低リスク - 並列処理テスト'
      };
    }

    // フォールバック: 単一タスク
    return jsonResult;
  }

  /**
   * タスクの詳細指示を生成
   */
  private async generateDetailedInstructions(task: Task, userRequest: string, analysis: string): Promise<string> {
    // タスクタイプに応じた詳細指示を生成
    let instructions = `
## 📋 実装要件

### 元のユーザー要求
${userRequest}

### このタスクの役割
${task.description}

## 🎯 具体的な実装手順

`;

    if (task.title.includes('package.json') && task.title.includes('スクリプト')) {
      instructions += `
1. **現状確認**
   - 現在のpackage.jsonのscriptsセクションを確認
   - 既存のテスト設定やツールを調査
   - pyproject.tomlなどのPython設定ファイルも確認

2. **スクリプト追加**
   以下のテスト用スクリプトを追加してください：
   
   \`\`\`json
   "scripts": {
     "test": "pytest",
     "test:coverage": "pytest --cov=hello_cli",
     "test:watch": "pytest-watch",
     "test:verbose": "pytest -v"
   }
   \`\`\`

3. **動作確認**
   - 各スクリプトが正常に実行されることを確認
   - エラーが発生する場合は適切に修正

4. **ドキュメント更新**
   - README.mdにnpmスクリプトの使用方法を追記（必要に応じて）

## ⚠️ 注意事項

- 既存のscriptsを削除・変更しない
- 新しい依存関係が必要な場合は適切に追加
- Python環境との整合性を保つ

## ✅ 完了確認

- [ ] package.jsonにテスト用スクリプトが追加されている
- [ ] \`npm test\` が正常に実行される
- [ ] \`npm run test:coverage\` が正常に実行される
- [ ] 既存の機能に影響していない
- [ ] 変更内容が適切にコミットされている
`;
    } else {
      instructions += `
1. **要件分析**
   - ユーザー要求を詳しく解析
   - 技術的な実現方法を検討

2. **実装設計**
   - 既存のコードベースを調査
   - 最適なアプローチを決定

3. **実装作業**
   - 段階的に機能を実装
   - 適切なテストを作成

4. **品質確認**
   - 動作テストの実行
   - コードレビューの実施

## プロダクトオーナーAIによる分析

${analysis}

## 実装のガイドライン

- 既存のコード規約に従ってください
- 適切なエラーハンドリングを実装してください
- セキュリティベストプラクティスを遵守してください
- パフォーマンスを考慮した実装を心がけてください
`;
    }

    return instructions;
  }

  /**
   * Claude Code SDKの応答からタスク分析結果を抽出
   */
  private extractTaskAnalysisResult(messages: SDKMessage[]): TaskAnalysisResult {
    // 全ての分析メッセージから結果を抽出
    let fullAnalysisText = '';
    
    for (const message of messages) {
      if (message && typeof message === 'object' && 'type' in message) {
        if (message.type === 'assistant' && 'message' in message) {
          const assistantMessage = message.message as any;
          if (assistantMessage.content) {
            for (const content of assistantMessage.content) {
              if (content.type === 'text') {
                fullAnalysisText += content.text + '\n';
              }
            }
          }
        } else if (message.type === 'result') {
          fullAnalysisText += (message as any).result || '';
        }
      }
    }

    // JSONブロックを抽出（最後のものを優先）
    const jsonMatches = [...fullAnalysisText.matchAll(/```json\s*([\s\S]*?)\s*```/g)];
    
    if (jsonMatches.length > 0) {
      // 最後のJSONブロックを使用
      const lastJsonMatch = jsonMatches[jsonMatches.length - 1];
      try {
        const jsonData = JSON.parse(lastJsonMatch[1]);
        
        console.log(`📋 JSONタスクリストを検出: ${jsonData.tasks?.length || 0}個のタスク`);
        
        // タスクオブジェクトを作成
        const tasks: Task[] = (jsonData.tasks || []).map((taskData: any) => ({
          id: uuidv4(),
          type: taskData.type || 'feature',
          title: taskData.title || 'タスク',
          description: taskData.description || 'タスクの説明',
          priority: taskData.priority || 'medium',
          status: 'pending',
          dependencies: taskData.dependencies || [],
          createdAt: new Date(),
          updatedAt: new Date()
        }));

        if (tasks.length > 0) {
          return {
            tasks,
            summary: jsonData.summary || 'プロダクトオーナーAIによる分析結果',
            estimatedTime: jsonData.estimatedTime || '未定',
            riskAssessment: jsonData.riskAssessment || 'リスク評価なし'
          };
        }

      } catch (error) {
        console.error('❌ JSON解析エラー:', error);
        console.error('❌ 問題のあるJSON:', lastJsonMatch[1]);
      }
    }

    // フォールバック: 基本的なタスクを作成
    console.warn('⚠️ JSON形式の分析結果が見つからないため、基本タスクを作成します');
    
    return {
      tasks: [{
        id: uuidv4(),
        type: 'feature',
        title: 'ユーザー要求の実装',
        description: fullAnalysisText || 'プロダクトオーナーAIによる分析結果を基にした実装',
        priority: 'high',
        status: 'pending',
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }],
      summary: 'プロダクトオーナーAIによる基本分析',
      estimatedTime: '未定',
      riskAssessment: '要再評価'
    };
  }

  /**
   * タスクの依存関係を解決して実行順序を決定
   */
  resolveDependencies(tasks: Task[]): Task[] {
    const resolved: Task[] = [];
    const remaining = [...tasks];
    const titleToTask = new Map(tasks.map(task => [task.title, task]));

    while (remaining.length > 0) {
      const before = remaining.length;
      
      for (let i = remaining.length - 1; i >= 0; i--) {
        const task = remaining[i];
        
        // 依存関係がすべて解決されているかチェック
        const dependenciesResolved = task.dependencies.every(depTitle => 
          resolved.some(resolvedTask => resolvedTask.title === depTitle)
        );
        
        if (dependenciesResolved) {
          resolved.push(task);
          remaining.splice(i, 1);
        }
      }
      
      // 循環依存のチェック
      if (remaining.length === before && remaining.length > 0) {
        console.warn('⚠️ 循環依存が検出されました。残りのタスクを強制的に追加します。');
        resolved.push(...remaining);
        break;
      }
    }

    return resolved;
  }
}