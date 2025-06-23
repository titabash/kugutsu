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

以下の観点でタスクを分析してください：
1. 要求の明確化と詳細化
2. 技術的実現可能性の評価
3. 適切なタスクサイズへの分割（1タスク=1時間程度の作業量）
4. タスク間の依存関係の整理
5. 優先度の設定
6. リスク評価

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
          if (message.type === 'assistant' && 'message' in message) {
            const assistantMessage = message.message as any;
            if (assistantMessage.content) {
              for (const content of assistantMessage.content) {
                if (content.type === 'text') {
                  const text = content.text;
                  console.log(`💭 プロダクトオーナーAI: ${text}`);
                  fullAnalysis += text + '\n';
                }
              }
            }
          } else if (message.type === 'result') {
            fullAnalysis += (message as any).result || '';
          }
        }
      }

      // タスクを解析・作成
      const result = this.extractTasksFromAnalysis(fullAnalysis, userRequest);
      
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

## 分析内容
- プロジェクトの現状把握
- 要求の技術的実現可能性
- 必要なタスクの洗い出し
- リスク評価と対策
- 実装の優先順位

詳細な分析結果を自然な日本語で回答してください。
後で個別のタスクファイルを作成するため、各タスクについても具体的に説明してください。`;
  }

  /**
   * 分析結果からタスクを抽出・作成
   */
  private extractTasksFromAnalysis(analysisText: string, userRequest: string): TaskAnalysisResult {
    // 分析テキストからタスクを推測して作成
    const tasks: Task[] = [];
    
    // 基本的なタスクパターンを検出
    if (userRequest.includes('package.json') && userRequest.includes('スクリプト')) {
      tasks.push({
        id: uuidv4(),
        type: 'feature',
        title: 'package.jsonにテスト用スクリプト追加',
        description: `package.jsonのscriptsセクションにテスト関連のnpmスクリプトを追加する`,
        priority: 'high',
        status: 'pending',
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } else {
      // 汎用的なタスクを作成
      tasks.push({
        id: uuidv4(),
        type: 'feature',
        title: 'ユーザー要求の実装',
        description: userRequest,
        priority: 'high',
        status: 'pending',
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return {
      tasks,
      summary: `ユーザー要求「${userRequest}」に対する分析結果`,
      estimatedTime: '1-2時間',
      riskAssessment: '低リスク - 標準的な実装作業'
    };
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
    // 最後のメッセージから結果を抽出
    const lastMessage = messages[messages.length - 1];
    
    let analysisText = '';
    if (lastMessage && typeof lastMessage === 'object' && 'type' in lastMessage) {
      if (lastMessage.type === 'assistant' && 'message' in lastMessage) {
        const assistantMessage = lastMessage.message as any;
        if (assistantMessage.content) {
          for (const content of assistantMessage.content) {
            if (content.type === 'text') {
              analysisText += content.text;
            }
          }
        }
      } else if (lastMessage.type === 'result') {
        analysisText = (lastMessage as any).result || '';
      }
    }

    // JSONブロックを抽出
    const jsonMatch = analysisText.match(/```json\s*([\s\S]*?)\s*```/);
    
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[1]);
        
        // タスクオブジェクトを作成
        const tasks: Task[] = jsonData.tasks.map((taskData: any) => ({
          id: uuidv4(),
          type: taskData.type || 'feature',
          title: taskData.title,
          description: taskData.description,
          priority: taskData.priority || 'medium',
          status: 'pending',
          dependencies: taskData.dependencies || [],
          createdAt: new Date(),
          updatedAt: new Date()
        }));

        return {
          tasks,
          summary: jsonData.summary || 'プロダクトオーナーAIによる分析結果',
          estimatedTime: jsonData.estimatedTime || '未定',
          riskAssessment: jsonData.riskAssessment || 'リスク評価なし'
        };

      } catch (error) {
        console.error('❌ JSON解析エラー:', error);
      }
    }

    // フォールバック: 基本的なタスクを作成
    console.warn('⚠️ JSON形式の分析結果が見つからないため、基本タスクを作成します');
    
    return {
      tasks: [{
        id: uuidv4(),
        type: 'feature',
        title: 'ユーザー要求の実装',
        description: analysisText || 'プロダクトオーナーAIによる分析結果を基にした実装',
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