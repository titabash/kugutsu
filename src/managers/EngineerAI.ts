import { query, type SDKMessage } from "@anthropic-ai/claude-code";
import { Task, EngineerResult, AgentConfig } from '../types/index.js';
import { BaseAI } from './BaseAI.js';
import { ComponentType } from '../types/logging.js';
import * as fs from 'fs';
import { execSync } from 'child_process';

/**
 * エンジニアAIクラス
 * 具体的な開発タスクを実行する
 */
export class EngineerAI extends BaseAI {
  private readonly config: AgentConfig;
  private readonly engineerId: string;
  private sessionId?: string;

  // 新しいパイプラインシステムのためのidプロパティ
  get id(): string {
    return this.engineerId;
  }

  constructor(engineerId: string, config?: Partial<AgentConfig>) {
    super();
    this.engineerId = engineerId;
    this.config = {
      systemPrompt: this.getDefaultSystemPrompt(),
      maxTurns: 20,
      allowedTools: ["Read", "Write", "Edit", "MultiEdit", "Bash", "Glob", "Grep", "LS"],
      ...config
    };
  }

  /**
   * デフォルトのシステムプロンプト
   */
  private getDefaultSystemPrompt(): string {
    return `あなたは経験豊富なソフトウェアエンジニアです（ID: ${this.engineerId}）。
与えられたタスクを正確に実装することが役割です。

## TDD(テスト駆動開発)の徹底
**重要**: 機能実装時は必ずテスト駆動開発(TDD)を実践してください。
**注意**: ドキュメントの修正、README更新、設定ファイルの変更などは対象外です。

### TDDサイクル（機能実装時のみ）
1. **Red**: まずテストを書いて失敗させる
2. **Green**: テストを通す最小限の実装を行う  
3. **Refactor**: コードをリファクタリングして改善する

### 作業手順
1. **最新コード同期**: 作業開始前に必ず最新のベースブランチ（worktree作成元）を取り込む
2. **プロジェクト設計の体系的理解**（最重要・必須）:
   - **アーキテクチャパターン分析**: 既存のアーキテクチャパターンを特定・理解
   - **ドメイン設計の把握**: ビジネスドメイン、エンティティ関係、ドメインルールの理解
   - **コーディング規約の確立**: プロジェクト全体の統一規約とパターンの把握
3. **要件分析**: タスクの要件を正確に把握し、期待される入出力を明確化
4. **タスクタイプ判定**: 機能実装か、ドキュメント・設定変更かを判定
5. **機能実装の場合**:
   - テスト作成: 実装前に必ずテストを作成し、失敗することを確認
   - 最小実装: テストを通す最小限の実装を行う
   - テスト実行: すべてのテストが通ることを確認
   - リファクタリング: コードを改善し、再度テストを実行
6. **ドキュメント・設定変更の場合**:
   - 直接実装を行う（テスト不要）
7. **最終確認**: すべてのテストが通ることを確認してからコミット

## 重要な注意事項
- 既存のコード規約とパターンに従ってください
- 破壊的変更は避け、後方互換性を保ってください
- エラーハンドリングを適切に実装してください
- セキュリティベストプラクティスに従ってください
- 実装前に必要なファイルとディレクトリ構造を確認してください

## 作業完了の必須条件
**最重要**: レビューに進む前に以下をすべて確認してください。

### テスト確認（機能実装時必須）
- **テスト実行**: 新規作成したテストがすべて通ることを確認
- **既存テスト**: 既存のテストが引き続き通ることを確認（npm test等）
- **テスト作成**: 新しい機能に対するテストが適切に作成されている

### ビルド・品質確認（全タスク共通）
- **ビルド成功**: npm run buildやtsc等でビルドが成功する
- **リントチェック**: npm run lint等でコード品質チェックが通る
- **型チェック**: TypeScriptプロジェクトの場合、型エラーがない

### 最終確認
- **機能動作**: 要求された機能が期待通りに動作する
- **コミット**: 変更内容が明確で詳細なコミットメッセージでコミットされている

**重要**: 上記すべてが完了してからClaude Codeが完成と判断し、レビューに進みます。

## エンジニアAIの責務
### 作業開始時（必須）
- **最新コード同期**: ローカルのベースブランチ（分岐元）の最新を取り込んでから作業開始

### 機能実装時
- **TDD実践**: テスト作成 → 実装 → リファクタリングの順序厳守
- **テスト実行**: 新規・既存すべてのテストが通ることを確認
- **品質確認**: ビルド・リント・型チェックの実行と成功確認

### 全タスク共通
- **実装作業**: 要求された機能・変更の正確な実装
- **品質保証**: コード品質とビルド成功の確認
- **最終確認**: すべての条件が満たされていることの確認

**絶対原則**: 
- 最新コード同期なしで作業開始してはいけません
- テストが失敗している状態、ビルドが失敗している状態では作業完了としません

## コミットメッセージの形式
必ず以下の形式でコミットしてください：
\`\`\`
<タイプ>: <変更内容の要約>

- 変更の詳細（具体的に）
- 変更前 → 変更後の状態
- ファイル名と変更箇所
\`\`\`

例:
\`\`\`
feat: ユーザー認証機能を追加

- /api/auth エンドポイントを新規作成
- JWTトークンによる認証を実装
- User.tsにauthenticate()メソッドを追加
\`\`\`

**重要**: レビュアーが変更内容を正確に理解できるよう、具体的で詳細な説明を含めてください

効率的で高品質なコードを心がけてください。`;
  }

  /**
   * タスクを実行
   */
  async executeTask(task: Task): Promise<EngineerResult> {
    this.info(`👨‍💻 タスク実行開始`, { taskId: task.id, taskTitle: task.title });
    this.info(`📋 タスク: ${task.title}`);

    const startTime = Date.now();
    const prompt = this.buildTaskPrompt(task);

    try {
      const messages: SDKMessage[] = [];
      const output: string[] = [];

      for await (const message of query({
        prompt,
        abortController: new AbortController(),
        options: {
          maxTurns: this.config.maxTurns,
          cwd: task.worktreePath,
          permissionMode: 'acceptEdits',
          allowedTools: this.config.allowedTools,
          // コンフリクト解消タスクは新しいセッションで実行
          resume: (task.isConflictResolution || task.type === 'conflict-resolution') ? undefined : this.sessionId
        },
      })) {
        messages.push(message);

        // セッションIDを保存
        if (message && typeof message === 'object' && 'session_id' in message) {
          this.sessionId = message.session_id;
        }

        // リアルタイムでエンジニアAIの作業状況を表示
        if (message && typeof message === 'object' && 'type' in message) {
          this.displayMessageActivity(message as any, output);
        }
      }

      const duration = Date.now() - startTime;
      const filesChanged = await this.getChangedFiles(task.worktreePath || '');

      this.success(`✅ タスク完了 (${duration}ms)`, { taskId: task.id, duration });

      return {
        taskId: task.id,
        engineerId: this.engineerId,
        success: true,
        output,
        duration,
        filesChanged
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      // エラーの詳細情報を取得
      let errorMessage = '';
      let errorDetails = '';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        errorDetails = error.stack || '';
        
        // Claude Code特有のエラーの詳細を追加
        if (error.message.includes('process exited with code')) {
          const isConflictResolution = task.isConflictResolution || task.type === 'conflict-resolution';
          
          // より詳細なエラーオブジェクトの情報を取得
          const errorInfo = {
            name: error.name,
            message: error.message,
            stack: error.stack,
            ...(error as any) // 追加のプロパティがあれば含める
          };
          
          this.error(`❌ Claude Codeプロセスエラー詳細:`, { 
            taskId: task.id, 
            taskTitle: task.title,
            taskType: task.type,
            worktreePath: task.worktreePath,
            sessionId: this.sessionId,
            resumeUsed: isConflictResolution ? false : !!this.sessionId,
            isConflictResolution,
            errorInfo
          });
          
          // ワークツリーの状態確認
          if (task.worktreePath) {
            try {
              console.log(`\n🔍 ワークツリー状態確認: ${task.worktreePath}`);
              const worktreeExists = fs.existsSync(task.worktreePath);
              console.log(`- ワークツリー存在: ${worktreeExists}`);
              
              if (worktreeExists) {
                const gitStatus = execSync('git status --porcelain', { 
                  cwd: task.worktreePath, 
                  encoding: 'utf-8',
                  stdio: 'pipe'
                }).toString();
                console.log(`- Git状態: ${gitStatus || '(クリーン)'}`);
              }
            } catch (statusError) {
              console.log(`- 状態確認エラー: ${statusError}`);
            }
          }
          
          // コンフリクト解消タスクの場合、より詳細なエラー情報を追加
          if (isConflictResolution) {
            console.log(`\n🔍 コンフリクト解消タスクでのエラー詳細:`);
            console.log(`- タスクID: ${task.id}`);
            console.log(`- タスクタイプ: ${task.type}`);
            console.log(`- 元タスクID: ${task.originalTaskId}`);
            console.log(`- ワークツリーパス: ${task.worktreePath}`);
            console.log(`- セッション復帰なし（新規セッション）`);
            console.log(`- エラー詳細: ${JSON.stringify(errorInfo, null, 2)}`);
          }
        }
      } else {
        errorMessage = String(error);
        errorDetails = JSON.stringify(error, null, 2);
      }

      this.error(`❌ タスク失敗: ${errorMessage}`, { 
        taskId: task.id, 
        error: errorDetails,
        taskTitle: task.title,
        engineerId: this.engineerId
      });

      return {
        taskId: task.id,
        engineerId: this.engineerId,
        success: false,
        output: [],
        error: errorMessage,
        duration,
        filesChanged: []
      };
    }
  }

  /**
   * メッセージアクティビティを表示
   */
  private displayMessageActivity(message: any, output: string[]): void {
    const messageType = message.type;
    
    switch (messageType) {
      case 'user':
        // ユーザーメッセージ（入力）
        if (message.message && message.message.content) {
          for (const content of message.message.content) {
            if (content.type === 'text') {
              this.debug(`📝 入力受信 - ${this.truncateText(content.text, 100)}`);
            }
          }
        }
        break;

      case 'assistant':
        // アシスタントメッセージ（出力）
        if (message.message && message.message.content) {
          for (const content of message.message.content) {
            if (content.type === 'text') {
              const text = content.text;
              this.info(`🔧 ${this.truncateText(text, 200)}`);
              output.push(text);
            } else if (content.type === 'tool_use') {
              const toolName = content.name;
              const toolId = content.id;
              const toolInput = content.input || {};
              const toolExecutionId = this.logToolExecution(toolName, this.getToolDescription(toolName, toolInput));
              this.displayToolExecutionDetails(toolName, toolInput, toolId, toolExecutionId);
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
              
              if (isError) {
                this.error(`📊 ツール結果 - ${status}`);
                this.error(`   ❌ エラー詳細: ${this.truncateText(String(result), 150)}`);
              } else {
                this.debug(`📊 ツール結果 - ${status}`);
                this.displayToolResult(result, toolUseId);
              }
            }
          }
        }
        break;

      case 'error':
        // エラーメッセージ
        this.error(`❌ エラーが発生しました`);
        if (message.error) {
          this.error(`   ❌ エラー: ${this.truncateText(String(message.error), 200)}`);
        }
        break;

      case 'system':
        // システムメッセージ
        this.debug(`⚙️  システム通知`);
        if (message.content) {
          this.debug(`   📋 内容: ${this.truncateText(String(message.content), 150)}`);
        }
        break;

      case 'thinking':
        // 思考過程（内部処理）
        this.debug(`🤔 思考中...`);
        break;

      case 'event':
        // イベント通知
        if (message.event_type) {
          this.debug(`📢 イベント - ${message.event_type}`);
        }
        break;

      default:
        // 未知のメッセージタイプ
        this.warn(`🔍 未知のメッセージタイプ - ${messageType}`);
        break;
    }
  }

  /**
   * ツール実行の詳細を表示
   */
  private displayToolExecutionDetails(toolName: string, toolInput: any, _toolId: string, toolExecutionId?: string): void {
    switch (toolName) {
      case 'Read':
        this.debug(`   📖 ファイル読み取り: ${toolInput.file_path || 'パス不明'}`, { parentLogId: toolExecutionId });
        if (toolInput.offset || toolInput.limit) {
          this.debug(`   📄 範囲: ${toolInput.offset || 0}行目から${toolInput.limit || '全て'}行`, { parentLogId: toolExecutionId });
        }
        break;

      case 'Write':
        this.debug(`   ✍️  ファイル書き込み: ${toolInput.file_path || 'パス不明'}`, { parentLogId: toolExecutionId });
        if (toolInput.content) {
          const contentLength = String(toolInput.content).length;
          this.debug(`   📝 内容サイズ: ${contentLength}文字`, { parentLogId: toolExecutionId });
        }
        break;

      case 'Edit':
        this.debug(`   ✏️  ファイル編集: ${toolInput.file_path || 'パス不明'}`, { parentLogId: toolExecutionId });
        if (toolInput.old_string) {
          this.debug(`   🔍 検索: "${this.truncateText(toolInput.old_string, 50)}"`, { parentLogId: toolExecutionId });
        }
        if (toolInput.new_string) {
          this.debug(`   🔄 置換: "${this.truncateText(toolInput.new_string, 50)}"`, { parentLogId: toolExecutionId });
        }
        break;

      case 'MultiEdit':
        this.debug(`   📝 複数編集: ${toolInput.file_path || 'パス不明'}`, { parentLogId: toolExecutionId });
        if (toolInput.edits && Array.isArray(toolInput.edits)) {
          this.debug(`   🔢 編集数: ${toolInput.edits.length}個`, { parentLogId: toolExecutionId });
        }
        break;

      case 'Bash':
        this.debug(`   💻 コマンド実行: ${this.truncateText(toolInput.command || 'コマンド不明', 100)}`, { parentLogId: toolExecutionId });
        if (toolInput.timeout) {
          this.debug(`   ⏱️  タイムアウト: ${toolInput.timeout}ms`, { parentLogId: toolExecutionId });
        }
        break;

      case 'Glob':
        this.debug(`   🔍 ファイル検索: ${toolInput.pattern || 'パターン不明'}`, { parentLogId: toolExecutionId });
        if (toolInput.path) {
          this.debug(`   📁 検索パス: ${toolInput.path}`, { parentLogId: toolExecutionId });
        }
        break;

      case 'Grep':
        this.debug(`   🔎 内容検索: ${toolInput.pattern || 'パターン不明'}`, { parentLogId: toolExecutionId });
        if (toolInput.include) {
          this.debug(`   📂 対象ファイル: ${toolInput.include}`, { parentLogId: toolExecutionId });
        }
        break;

      case 'LS':
        this.debug(`   📂 ディレクトリ一覧: ${toolInput.path || 'パス不明'}`, { parentLogId: toolExecutionId });
        break;

      default:
        this.debug(`   ⚙️  パラメータ: ${JSON.stringify(toolInput).substring(0, 100)}...`, { parentLogId: toolExecutionId });
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
        this.debug(`   ✅ 結果: ${this.truncateText(result, 100)}`);
      } else {
        this.debug(`   ✅ 結果: ${lineCount}行の出力`);
        // 最初の数行を表示
        const previewLines = lines.slice(0, 3);
        previewLines.forEach(line => {
          if (line.trim()) {
            this.debug(`   │ ${this.truncateText(line, 80)}`);
          }
        });
        if (lineCount > 3) {
          this.debug(`   │ ... (他${lineCount - 3}行)`);
        }
      }
    } else if (typeof result === 'object' && result !== null) {
      this.debug(`   ✅ 結果: オブジェクト形式`);
      const preview = JSON.stringify(result, null, 2);
      this.debug(`   │ ${this.truncateText(preview, 150)}`);
    } else {
      this.debug(`   ✅ 結果: ${String(result)}`);
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
   * タスク実行用プロンプトを構築
   */
  private buildTaskPrompt(task: Task): string {
    const instructionFile = (task as any).instructionFile;
    const hasInstructionFile = instructionFile && fs.existsSync(instructionFile);

    if (hasInstructionFile) {
      // 指示ファイルがある場合
      return `
🎯 エンジニアAIタスク実行開始

あなたは経験豊富なソフトウェアエンジニアです。
以下のタスクを担当してください：

## 📋 基本情報
- **タスクID**: ${task.id}
- **タイトル**: ${task.title}
- **作業ディレクトリ**: ${task.worktreePath}

## 📖 詳細指示の確認

**最初に必ず以下のファイルを読んで、詳細な実装指示を確認してください：**

\`\`\`bash
# 詳細なタスク指示を確認
cat "${instructionFile}"
\`\`\`

このファイルには以下の重要な情報が含まれています：
- 具体的な実装手順
- 成功条件・完了確認項目
- 注意事項
- 技術的なガイドライン

## 🚀 作業開始手順

1. **最新コード同期** (最優先・必須)
   - 作業開始前に必ず最新のベースブランチを取り込んでください
   - **ベースブランチの特定と同期**:
     \`\`\`bash
     # 分岐元ブランチを特定
     BASE_BRANCH=$(git show-branch | grep '*' | grep -v "$(git rev-parse --abbrev-ref HEAD)" | head -1 | awk -F'[]~^[]' '{print $2}')
     echo "ベースブランチ: $BASE_BRANCH"
     
     # ローカルのベースブランチの最新をマージ
     git merge $BASE_BRANCH
     \`\`\`
   - **重要**: コンフリクトがある場合は適切に解決してから作業を継続
   - この手順を飛ばすと、古いコードベースで作業してマージ時に問題が発生します

2. **指示ファイルの確認**
   - 上記のcatコマンドで詳細指示を必ず読んでください

3. **🏗️ プロジェクト設計の体系的理解**（最重要・必須）
   作業開始前に、プロジェクト全体の設計思想を理解してください：
   
   - **📐 アーキテクチャパターンの特定**：
     \`\`\`bash
     # ディレクトリ構造からアーキテクチャパターンを分析
     echo "=== プロジェクト構造分析 ==="
     find . -type d -maxdepth 3 | grep -E "(src|lib|app|components|services|models|controllers|views|domain|infrastructure|presentation)" | head -20
     
     # 設定ファイルからフレームワーク特定
     echo -e "\n=== フレームワーク・アーキテクチャ特定 ==="
     [ -f tsconfig.json ] && echo "TypeScript設定:" && grep -E '"target"|"module"|"lib"' tsconfig.json
     [ -f angular.json ] && echo "Angular プロジェクト"
     [ -f next.config.js ] && echo "Next.js プロジェクト"
     [ -f nuxt.config.js ] && echo "Nuxt.js プロジェクト"
     [ -f vite.config.js ] && echo "Vite プロジェクト"
     \`\`\`
   
   - **🧩 ドメイン設計とエンティティ関係の把握**：
     \`\`\`bash
     echo "=== ドメインモデル分析 ==="
     # エンティティ・モデルファイルの探索
     find . -name "*.ts" -o -name "*.js" | grep -E "(model|entity|domain|schema)" | head -10
     
     # データベーススキーマの確認
     [ -f prisma/schema.prisma ] && echo "Prisma スキーマ:" && head -30 prisma/schema.prisma
     find . -name "*.sql" | head -5
     
     # ビジネスロジック関連ファイルの探索
     find . -name "*.ts" -o -name "*.js" | grep -E "(service|usecase|repository)" | head -10
     \`\`\`
   
   - **📋 コーディング規約とパターンの確立**：
     \`\`\`bash
     echo "=== コーディング規約分析 ==="
     # 設定ファイルから規約を特定
     [ -f .eslintrc.js ] && echo "ESLint設定:" && head -20 .eslintrc.js
     [ -f .prettierrc ] && echo "Prettier設定:" && cat .prettierrc
     [ -f .editorconfig ] && echo "EditorConfig:" && cat .editorconfig
     
     # 既存コードから命名規則を分析
     echo -e "\n=== 命名規則分析 ==="
     find . -name "*.ts" -o -name "*.js" | head -5 | xargs grep -h "^export.*function\|^export.*class\|^export.*interface\|^export.*type" | head -10
     
     # インポート/エクスポートパターンの確認
     echo -e "\n=== インポートパターン ==="
     find . -name "*.ts" -o -name "*.js" | head -3 | xargs grep -h "^import" | head -10
     \`\`\`

4. **リポジトリ固有のコマンド確認**（必須・最優先）
   - **コマンド定義ファイルの存在確認**：
     \`\`\`bash
     # プロジェクトのコマンド定義ファイルを確認
     ls -la | grep -E "(package\.json|Makefile|build\.gradle|pom\.xml|Cargo\.toml|setup\.py|composer\.json|go\.mod|CMakeLists\.txt)"
     \`\`\`
   
   - **定義されているコマンドの確認**：
     \`\`\`bash
     # package.jsonのスクリプトを確認（最優先）
     if [ -f package.json ]; then
       echo "=== package.json scripts ==="
       cat package.json | jq '.scripts'
     fi
     
     # Makefileのターゲットを確認
     if [ -f Makefile ]; then
       echo "=== Makefile targets ==="
       cat Makefile
     fi
     
     # その他のビルドファイルを確認
     [ -f build.gradle ] && echo "=== Gradle build.gradle ===" && cat build.gradle
     [ -f pom.xml ] && echo "=== Maven pom.xml ===" && head -20 pom.xml
     [ -f Cargo.toml ] && echo "=== Rust Cargo.toml ===" && cat Cargo.toml
     [ -f setup.py ] && echo "=== Python setup.py ===" && head -20 setup.py
     [ -f composer.json ] && echo "=== PHP composer.json ===" && cat composer.json | jq '.scripts'
     \`\`\`
   
   - **このリポジトリで使用すべきコマンドを特定**：
     - **第1優先**: リポジトリで定義されたコマンド（npm scripts、Makefileターゲット等）
     - **第2優先**: 標準的なコマンド（npm test、cargo build等）
     - **重要**: リポジトリで定義されたコマンドが存在する場合は、それを優先的に使用する

5. **🧪 テスト環境と品質基準の把握**：
   \`\`\`bash
   echo "=== テスト環境分析 ==="
   # テストフレームワークの特定
   [ -f jest.config.js ] && echo "Jest設定:" && head -10 jest.config.js
   [ -f vitest.config.js ] && echo "Vitest設定:" && head -10 vitest.config.js
   [ -f cypress.config.js ] && echo "Cypress設定:" && head -10 cypress.config.js
   
   # 既存テストファイルの確認とパターン分析
   echo -e "\n=== 既存テストパターン ==="
   find . -name "*.test.ts" -o -name "*.spec.ts" -o -name "*.test.js" -o -name "*.spec.js" | head -5
   \`\`\`

6. **📊 既存の実装パターンの理解**：
   \`\`\`bash
   echo "=== 既存実装パターン分析 ==="
   # 類似機能の実装パターンを確認
   find . -name "*.ts" -o -name "*.js" | head -5 | xargs grep -l "export.*function\|export.*class" | head -3
   
   # エラーハンドリングパターンの確認
   echo -e "\n=== エラーハンドリングパターン ==="
   find . -name "*.ts" -o -name "*.js" | head -3 | xargs grep -h "try.*catch\|throw.*Error" | head -5
   
   # APIエンドポイントパターンの確認（該当する場合）
   echo -e "\n=== APIパターン ==="
   find . -name "*.ts" -o -name "*.js" | xargs grep -h "app\\.get\|app\\.post\|router\\.get\|router\\.post" | head -5
   \`\`\`

7. **実装の実行**
   - **機能実装の場合**: TDDサイクルに従って実装（テスト → 実装 → リファクタリング）
   - **ドキュメント等の場合**: 直接実装
   - 段階的な進行

6. **品質確認とコミット（必須）**
   - **リポジトリで定義されたコマンドを優先使用**: 手順3で確認したコマンドを最優先で使用
   
   - **テスト実行**: 新規・既存すべてのテストが通ることを確認
     \`\`\`bash
     # リポジトリで定義されたテストコマンドを実行（最優先）
     # 例: npm run test, make test, yarn test など
     # 手順3で確認したコマンドを使用
     \`\`\`
   
   - **ビルドの実行**: ビルドが成功することを確認
     \`\`\`bash
     # リポジトリで定義されたビルドコマンドを実行（最優先）
     # 例: npm run build, make build, yarn build など
     # 手順3で確認したコマンドを使用
     \`\`\`
   
   - **リント・コード品質チェック**: コード品質チェックが通ることを確認
     \`\`\`bash
     # リポジトリで定義されたリントコマンドを実行（最優先）
     # 例: npm run lint, make lint, yarn lint など
     # 手順3で確認したコマンドを使用
     \`\`\`
   
   - **型チェック**: TypeScriptプロジェクトの場合
     \`\`\`bash
     # リポジトリで定義された型チェックコマンドを実行（最優先）
     # 例: npm run typecheck, make typecheck など
     # 手順3で確認したコマンドを使用
     \`\`\`
   
   - **重要**: このリポジトリで定義されたコマンドを優先的に使用し、なければ標準コマンドを使用
   - **すべて成功確認**: 上記すべてが成功してから次へ進む
   - **コミット**: 明確で詳細なコミットメッセージでコミット
   
   ### 📝 コミットメッセージの書き方
   以下の形式で、**何を変更したのか具体的に**記載してください：
   
   \`\`\`
   <タイプ>: <変更内容の要約>
   
   - 変更の詳細1
   - 変更の詳細2
   - 元の状態 → 変更後の状態（具体的に）
   \`\`\`
   
   例：
   \`\`\`
   feat: TEST.mdのHelloをGood Morningに変更
   
   - TEST.md内の挨拶文を更新
   - "Hello World!" → "Good Morning World!"
   - タスク要件に従って朝の挨拶に変更
   \`\`\`
   
   **重要**: レビュアーが変更内容を理解しやすいよう、以下を含めてください：
   - 変更前と変更後の具体的な内容
   - ファイル名と変更箇所
   - タスクとの関連性

## ⚠️ 重要
プロダクトオーナーAIが作成した詳細な指示ファイルを必ず最初に確認してから作業を開始してください。
このファイルには具体的で実行可能な手順が記載されています。

作業を開始してください！`;
    } else {
      // 指示ファイルがない場合（フォールバック）
      return `
エンジニアとして、以下のタスクを実装してください：

## タスク情報
- **ID**: ${task.id}
- **タイプ**: ${task.type}
- **タイトル**: ${task.title}
- **優先度**: ${task.priority}

## 詳細要件
${task.description}

## 作業ディレクトリ
${task.worktreePath}

## 実行手順
1. **最新コード同期**: 必ず最新のベースブランチを取り込んでから作業開始
   - **実行すべきコマンド**: 
     \`\`\`bash
     # 分岐元ブランチを特定
     BASE_BRANCH=$(git show-branch | grep '*' | grep -v "$(git rev-parse --abbrev-ref HEAD)" | head -1 | awk -F'[]~^[]' '{print $2}')
     echo "ベースブランチ: $BASE_BRANCH"
     
     # ローカルのベースブランチをマージ
     git merge $BASE_BRANCH
     \`\`\`
   - コンフリクトがあれば適切に解決してから作業継続
   - **重要**: この手順を飛ばすと古いコードで作業することになります

2. **リポジトリ固有のコマンド確認**（必須・最優先）
   - **コマンド定義ファイルの存在確認**：
     \`\`\`bash
     # プロジェクトのコマンド定義ファイルを確認
     ls -la | grep -E "(package\.json|Makefile|build\.gradle|pom\.xml|Cargo\.toml|setup\.py|composer\.json|go\.mod|CMakeLists\.txt)"
     \`\`\`
   
   - **定義されているコマンドの確認**：
     \`\`\`bash
     # package.jsonのスクリプトを確認（最優先）
     if [ -f package.json ]; then
       echo "=== package.json scripts ==="
       cat package.json | jq '.scripts'
     fi
     
     # Makefileのターゲットを確認
     if [ -f Makefile ]; then
       echo "=== Makefile targets ==="
       cat Makefile
     fi
     
     # その他のビルドファイルを確認
     [ -f build.gradle ] && echo "=== Gradle build.gradle ===" && cat build.gradle
     [ -f pom.xml ] && echo "=== Maven pom.xml ===" && head -20 pom.xml
     [ -f Cargo.toml ] && echo "=== Rust Cargo.toml ===" && cat Cargo.toml
     [ -f setup.py ] && echo "=== Python setup.py ===" && head -20 setup.py
     [ -f composer.json ] && echo "=== PHP composer.json ===" && cat composer.json | jq '.scripts'
     \`\`\`
   
   - **このリポジトリで使用すべきコマンドを特定**：
     - **第1優先**: リポジトリで定義されたコマンド（npm scripts、Makefileターゲット等）
     - **第2優先**: 標準的なコマンド（npm test、cargo build等）
     - **重要**: リポジトリで定義されたコマンドが存在する場合は、それを優先的に使用する

3. **🏗️ プロジェクト設計の体系的理解**（最重要・必須）
   作業開始前に、プロジェクト全体の設計思想を理解してください：
   
   - **📐 アーキテクチャパターンの特定**：
     \`\`\`bash
     # ディレクトリ構造からアーキテクチャパターンを分析
     echo "=== プロジェクト構造分析 ==="
     find . -type d -maxdepth 3 | grep -E "(src|lib|app|components|services|models|controllers|views|domain|infrastructure|presentation)" | head -20
     
     # 設定ファイルからフレームワーク特定
     echo -e "\n=== フレームワーク・アーキテクチャ特定 ==="
     [ -f tsconfig.json ] && echo "TypeScript設定:" && grep -E '"target"|"module"|"lib"' tsconfig.json
     [ -f angular.json ] && echo "Angular プロジェクト"
     [ -f next.config.js ] && echo "Next.js プロジェクト"
     [ -f nuxt.config.js ] && echo "Nuxt.js プロジェクト"
     [ -f vite.config.js ] && echo "Vite プロジェクト"
     \`\`\`
   
   - **🧩 ドメイン設計とエンティティ関係の把握**：
     \`\`\`bash
     echo "=== ドメインモデル分析 ==="
     # エンティティ・モデルファイルの探索
     find . -name "*.ts" -o -name "*.js" | grep -E "(model|entity|domain|schema)" | head -10
     
     # データベーススキーマの確認
     [ -f prisma/schema.prisma ] && echo "Prisma スキーマ:" && head -30 prisma/schema.prisma
     find . -name "*.sql" | head -5
     
     # ビジネスロジック関連ファイルの探索
     find . -name "*.ts" -o -name "*.js" | grep -E "(service|usecase|repository)" | head -10
     \`\`\`
   
   - **📋 コーディング規約とパターンの確立**：
     \`\`\`bash
     echo "=== コーディング規約分析 ==="
     # 設定ファイルから規約を特定
     [ -f .eslintrc.js ] && echo "ESLint設定:" && head -20 .eslintrc.js
     [ -f .prettierrc ] && echo "Prettier設定:" && cat .prettierrc
     [ -f .editorconfig ] && echo "EditorConfig:" && cat .editorconfig
     
     # 既存コードから命名規則を分析
     echo -e "\n=== 命名規則分析 ==="
     find . -name "*.ts" -o -name "*.js" | head -5 | xargs grep -h "^export.*function\|^export.*class\|^export.*interface\|^export.*type" | head -10
     
     # インポート/エクスポートパターンの確認
     echo -e "\n=== インポートパターン ==="
     find . -name "*.ts" -o -name "*.js" | head -3 | xargs grep -h "^import" | head -10
     \`\`\`

4. **🧪 テスト環境と品質基準の把握**：
   \`\`\`bash
   echo "=== テスト環境分析 ==="
   # テストフレームワークの特定
   [ -f jest.config.js ] && echo "Jest設定:" && head -10 jest.config.js
   [ -f vitest.config.js ] && echo "Vitest設定:" && head -10 vitest.config.js
   [ -f cypress.config.js ] && echo "Cypress設定:" && head -10 cypress.config.js
   
   # 既存テストファイルの確認とパターン分析
   echo -e "\n=== 既存テストパターン ==="
   find . -name "*.test.ts" -o -name "*.spec.ts" -o -name "*.test.js" -o -name "*.spec.js" | head -5
   \`\`\`

5. **📊 既存の実装パターンの理解**：
   \`\`\`bash
   echo "=== 既存実装パターン分析 ==="
   # 類似機能の実装パターンを確認
   find . -name "*.ts" -o -name "*.js" | head -5 | xargs grep -l "export.*function\|export.*class" | head -3
   
   # エラーハンドリングパターンの確認
   echo -e "\n=== エラーハンドリングパターン ==="
   find . -name "*.ts" -o -name "*.js" | head -3 | xargs grep -h "try.*catch\|throw.*Error" | head -5
   
   # APIエンドポイントパターンの確認（該当する場合）
   echo -e "\n=== APIパターン ==="
   find . -name "*.ts" -o -name "*.js" | xargs grep -h "app\\.get\|app\\.post\|router\\.get\|router\\.post" | head -5
   \`\`\`

6. **実装計画**: タスクの要件を満たすための実装計画を立ててください

7. **段階的実装**:
   - **機能実装の場合**: TDDサイクルで実装（テスト作成 → 最小実装 → リファクタリング）
   - **ドキュメント等の場合**: 直接実装
   - 必要なファイルとディレクトリの作成
   - 動作確認

6. **必須確認事項**:
   - **リポジトリで定義されたコマンドを優先使用**: 手順2で確認したコマンドを最優先で使用
   
   - **テスト実行**: 新規・既存すべてのテストが通ることを確認
     \`\`\`bash
     # リポジトリで定義されたテストコマンドを実行（最優先）
     # 例: npm run test, make test, yarn test など
     # 手順2で確認したコマンドを使用
     \`\`\`
   
   - **ビルドの実行**: ビルドが成功することを確認
     \`\`\`bash
     # リポジトリで定義されたビルドコマンドを実行（最優先）
     # 例: npm run build, make build, yarn build など
     # 手順2で確認したコマンドを使用
     \`\`\`
   
   - **リント・コード品質チェック**: コード品質チェックが通ることを確認
     \`\`\`bash
     # リポジトリで定義されたリントコマンドを実行（最優先）
     # 例: npm run lint, make lint, yarn lint など
     # 手順2で確認したコマンドを使用
     \`\`\`
   
   - **型チェック**: TypeScriptプロジェクトの場合
     \`\`\`bash
     # リポジトリで定義された型チェックコマンドを実行（最優先）
     # 例: npm run typecheck, make typecheck など
     # 手順2で確認したコマンドを使用
     \`\`\`
   
   - **重要**: このリポジトリで定義されたコマンドを優先的に使用し、なければ標準コマンドを使用

7. **上記すべて成功後**: 変更内容を明確で詳細なコミットメッセージでコミット

### 📝 コミットメッセージの書き方
以下の形式で、**何を変更したのか具体的に**記載してください：

\`\`\`
<タイプ>: <変更内容の要約>

- 変更の詳細1
- 変更の詳細2
- 元の状態 → 変更後の状態（具体的に）
\`\`\`

タイプの例：
- feat: 新機能追加
- fix: バグ修正
- refactor: リファクタリング
- test: テスト追加・修正
- docs: ドキュメント更新

**重要**: レビュアーが変更内容を理解しやすいよう、以下を含めてください：
- 変更前と変更後の具体的な内容
- ファイル名と変更箇所
- タスクとの関連性

## 成功基準（すべて必須）
### 機能・品質基準
- **機能動作**: 要求された機能が正常に動作する
- **既存機能**: 既存の機能に影響を与えない
- **テスト品質**: 適切なテストが作成されている（機能実装時）

### 必須確認事項
- **テスト成功**: すべてのテストが通る（npm test等で確認）
- **ビルド成功**: ビルドが成功する（npm run build等で確認）  
- **リント成功**: リントチェックが通る（npm run lint等で確認）
- **コード品質**: コードが規約に従っている

**重要**: 上記すべてが満たされるまで作業完了とはなりません。

質問や不明点があれば、コードを調査して判断してください。
作業を開始してください。`;
    }
  }

  /**
   * 変更されたファイルのリストを取得
   */
  private async getChangedFiles(worktreePath: string): Promise<string[]> {
    try {
      if (!worktreePath) return [];


      // ステージされた変更とワーキングディレクトリの変更を取得
      const output = execSync('git status --porcelain', {
        cwd: worktreePath,
        encoding: 'utf-8',
        stdio: 'pipe'
      });

      return output
        .trim()
        .split('\n')
        .filter((line: string) => line.trim())
        .map((line: string) => line.substring(3)); // ステータス文字を除去

    } catch (error) {
      this.warn(`⚠️ 変更ファイル取得エラー: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * タスクの事前チェック
   */
  async validateTask(task: Task): Promise<{ valid: boolean; reason?: string }> {
    // worktreeパスの存在確認
    if (!task.worktreePath) {
      return { valid: false, reason: 'Worktreeパスが設定されていません' };
    }

    if (!fs.existsSync(task.worktreePath)) {
      return { valid: false, reason: `Worktreeが存在しません: ${task.worktreePath}` };
    }

    // ブランチの確認
    try {
      const currentBranch = execSync('git branch --show-current', {
        cwd: task.worktreePath,
        encoding: 'utf-8',
        stdio: 'pipe'
      }).trim();

      if (currentBranch !== task.branchName) {
        return {
          valid: false,
          reason: `ブランチが一致しません。期待: ${task.branchName}, 実際: ${currentBranch}`
        };
      }

    } catch (error) {
      return { valid: false, reason: `ブランチ確認エラー: ${error}` };
    }

    return { valid: true };
  }

  /**
   * エンジニアIDを取得
   */
  getEngineerId(): string {
    return this.engineerId;
  }

  /**
   * 設定を取得
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * セッションIDを取得
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * セッションIDを設定
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /**
   * BaseAIの抽象メソッドの実装
   */
  protected getComponentType(): ComponentType {
    return 'Engineer';
  }

  protected getId(): string {
    return this.engineerId;
  }

  /**
   * ツールの説明を取得
   */
  private getToolDescription(toolName: string, toolInput: any): string {
    switch (toolName) {
      case 'Read':
        return `ファイル読み取り: ${toolInput.file_path || 'パス不明'}`;
      case 'Write':
        return `ファイル書き込み: ${toolInput.file_path || 'パス不明'}`;
      case 'Edit':
        return `ファイル編集: ${toolInput.file_path || 'パス不明'}`;
      case 'MultiEdit':
        return `複数編集: ${toolInput.file_path || 'パス不明'}`;
      case 'Bash':
        return `コマンド実行: ${this.truncateText(toolInput.command || 'コマンド不明', 50)}`;
      case 'Glob':
        return `ファイル検索: ${toolInput.pattern || 'パターン不明'}`;
      case 'Grep':
        return `内容検索: ${toolInput.pattern || 'パターン不明'}`;
      case 'LS':
        return `ディレクトリ一覧: ${toolInput.path || 'パス不明'}`;
      default:
        return `${toolName}実行`;
    }
  }
}
