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
      allowedTools: ["Agent", "TodoWrite", "TodoRead", "Read", "Write", "Edit", "MultiEdit", "Bash", "Glob", "Grep", "LS", "WebSearch", "WebFetch"],
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
4. **技術調査とベストプラクティスの活用**（重要）:
   - **Web検索の積極活用**:
     - 不明な技術やエラーについてはWebSearchツールを使用して最新情報を取得
     - 公式ドキュメント、Stack Overflow、技術ブログ等の信頼できる情報源を参照
     - 最新のベストプラクティスやコミュニティの推奨事項を確認
   - **多角的な情報収集**:
     - WebFetchツールで公式ドキュメントの詳細を取得
     - 複数の情報源を比較して最適な実装方法を選択
     - バージョン固有の問題や互換性についても調査
   - **既存コードとの整合性**: プロジェクト内の類似実装を参考にして一貫性を保つ
   - **セキュリティとパフォーマンス**: Web上の最新のセキュリティ情報とパフォーマンス最適化手法を確認
5. **タスクタイプ判定**: 機能実装か、ドキュメント・設定変更かを判定
6. **機能実装の場合**:
   - テスト作成: 実装前に必ずテストを作成し、失敗することを確認
   - 最小実装: テストを通す最小限の実装を行う
   - テスト実行: すべてのテストが通ることを確認
   - リファクタリング: コードを改善し、再度テストを実行
7. **ドキュメント・設定変更の場合**:
   - 直接実装を行う（テスト不要）
8. **最終確認**: すべてのテストが通ることを確認してからコミット

## 重要な注意事項
- 既存のコード規約とパターンに従ってください
- 破壊的変更は避け、後方互換性を保ってください
- エラーハンドリングを適切に実装してください
- セキュリティベストプラクティスに従ってください
- 実装前に必要なファイルとディレクトリ構造を確認してください

## 作業完了の必須条件
**最重要**: レビューに進む前に以下をすべて確認してください。

### 📦 リポジトリ固有コマンドの確認と実行（第1優先・必須）
**絶対原則**: プロジェクトで定義されたコマンドを最優先で使用してください。

#### コマンド定義ファイルの確認
以下のファイルを確認し、プロジェクト固有のコマンドを特定してください：

\`\`\`bash
# 1. package.json のスクリプト確認（JavaScript/TypeScript）
if [ -f package.json ]; then
  echo "=== package.json で定義されたコマンド ==="
  # 利用可能なスクリプトを表示
  node -e "console.log(JSON.stringify(require('./package.json').scripts || {}, null, 2))"
fi

# 2. Makefile のターゲット確認
if [ -f Makefile ]; then
  echo "=== Makefile で定義されたターゲット ==="
  # ターゲット一覧を表示
  make -qp | awk -F':' '/^[a-zA-Z0-9][^$#\/\t=]*:([^=]|$)/ {split($1,A,/ /);for(i in A)print A[i]}'
fi

# 3. その他のビルドファイル確認
[ -f build.gradle ] && echo "=== Gradle プロジェクト検出 ===" && gradle tasks --all | head -20
[ -f pom.xml ] && echo "=== Maven プロジェクト検出 ===" && mvn help:describe -Dcmd
[ -f Cargo.toml ] && echo "=== Rust プロジェクト検出 ===" && cargo --list
[ -f pubspec.yaml ] && echo "=== Flutter/Dart プロジェクト検出 ===" && flutter --version
[ -f setup.py ] && echo "=== Python setup.py 検出 ==="
[ -f composer.json ] && echo "=== PHP Composer 検出 ===" && composer list
\`\`\`

### 🔧 品質チェックの必須実行順序
**重要**: 以下の順序で実行し、すべて成功してからコミットしてください。

#### 1. フォーマット確認・修正（最初に実行）
\`\`\`bash
# リポジトリで定義されたフォーマットコマンドを確認・実行
# package.json例: "format", "prettier", "fmt"
# Makefile例: format, fmt
# その他: black ., gofmt -w ., rustfmt など

# 実行例（プロジェクトに合わせて選択）
npm run format 2>/dev/null || npm run prettier 2>/dev/null || echo "フォーマットコマンドが見つかりません"
make format 2>/dev/null || make fmt 2>/dev/null || echo "Makefileにフォーマットターゲットがありません"
[ -f pubspec.yaml ] && dart format . || echo "Flutter/Dartプロジェクトではありません"
\`\`\`

#### 2. リント確認（フォーマット後に実行）
\`\`\`bash
# リポジトリで定義されたリントコマンドを確認・実行
# package.json例: "lint", "eslint", "check"
# Makefile例: lint, check
# その他: flake8, golint, clippy など

# 実行例（プロジェクトに合わせて選択）
npm run lint 2>/dev/null || echo "npm lintコマンドが見つかりません"
make lint 2>/dev/null || make check 2>/dev/null || echo "Makefileにlintターゲットがありません"
[ -f pubspec.yaml ] && dart analyze || echo "Flutter/Dartプロジェクトではありません"
\`\`\`

#### 3. 型チェック（TypeScript等の場合）
\`\`\`bash
# リポジトリで定義された型チェックコマンドを確認・実行
# package.json例: "typecheck", "type-check", "tsc"
# その他: mypy, tsc --noEmit など

# 実行例（プロジェクトに合わせて選択）
npm run typecheck 2>/dev/null || npm run type-check 2>/dev/null || npx tsc --noEmit 2>/dev/null || echo "型チェックコマンドが見つかりません"
\`\`\`

#### 4. テスト実行
\`\`\`bash
# リポジトリで定義されたテストコマンドを確認・実行
# package.json例: "test", "test:unit", "jest"
# Makefile例: test, check
# その他: pytest, go test, cargo test など

# 実行例（プロジェクトに合わせて選択）
npm test 2>/dev/null || npm run test 2>/dev/null || echo "npmテストコマンドが見つかりません"
make test 2>/dev/null || echo "Makefileにtestターゲットがありません"
[ -f pubspec.yaml ] && flutter test || echo "Flutter/Dartプロジェクトではありません"
\`\`\`

#### 5. ビルド確認（最後に実行・必須）
\`\`\`bash
# リポジトリで定義されたビルドコマンドを確認・実行
# package.json例: "build", "compile", "dist"
# Makefile例: build, all, compile
# その他: mvn compile, cargo build, go build など

# 実行例（プロジェクトに合わせて選択）
npm run build 2>/dev/null || echo "npmビルドコマンドが見つかりません"
make build 2>/dev/null || make all 2>/dev/null || echo "Makefileにビルドターゲットがありません"
[ -f pubspec.yaml ] && flutter build apk --debug || flutter build web || echo "Flutter/Dartプロジェクトではありません"
\`\`\`

### ⚠️ 重要な注意事項
- **すべてのステップが成功必須**: 1つでも失敗した場合は、問題を解決してから次に進む
- **エラーの場合は修正**: リント、型チェック、テスト、ビルドでエラーが出た場合は必ず修正する
- **コマンドが見つからない場合**: 標準的なコマンドで代替実行する
- **ドキュメント変更でもビルド確認**: ビルドは全タスクで必須（ドキュメント変更でも実行）

### 💡 フォールバック用標準コマンド
リポジトリ固有のコマンドがない場合の標準コマンド：

#### プログラミング言語別標準コマンド
- **TypeScript/JavaScript**: npx tsc --noEmit, npm test, npm run build
- **Python**: python -m py_compile ., mypy ., pytest
- **Java**: mvn compile, mvn test, gradle build
- **Go**: go vet ./..., go test ./..., go build ./...
- **Rust**: cargo fmt --check, cargo clippy, cargo test, cargo build
- **Flutter/Dart**: dart format --set-exit-if-changed ., dart analyze, flutter test, flutter build
- **C/C++**: make clean && make

### 最終確認
- **機能動作**: 要求された機能が期待通りに動作する
- **すべての品質チェック成功**: 上記1-5のすべてのステップが成功している
- **コミット**: 変更内容が明確で詳細なコミットメッセージでコミットされている

**絶対原則**: 
1. フォーマット → リント → 型チェック → テスト → ビルド の順序を厳守
2. 1つでも失敗したら必ず修正してから次に進む
3. ビルドエラーがある状態では、どんな理由があってもコミットしない

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
     find . -type d -maxdepth 3 | grep -E "(src|lib|app|pkg|internal|cmd|components|services|models|controllers|views|domain|infrastructure|presentation|main|test|tests)" | head -20

     # 言語・フレームワークの特定
     echo -e "\n=== 言語・フレームワーク特定 ==="

     # JavaScript/TypeScript
     [ -f package.json ] && echo "Node.js プロジェクト:" && grep -E '"name"|"main"|"scripts"' package.json | head -3
     [ -f tsconfig.json ] && echo "TypeScript設定:" && grep -E '"target"|"module"|"lib"' tsconfig.json
     [ -f angular.json ] && echo "Angular プロジェクト"
     [ -f next.config.js ] && echo "Next.js プロジェクト"
     [ -f nuxt.config.js ] && echo "Nuxt.js プロジェクト"
     [ -f vite.config.js ] && echo "Vite プロジェクト"

     # Python
     [ -f setup.py ] && echo "Python setup.py プロジェクト:" && grep -E "name=|version=" setup.py | head -2
     [ -f pyproject.toml ] && echo "Python pyproject.toml:" && grep -E "name =|version =" pyproject.toml | head -2
     [ -f requirements.txt ] && echo "Python requirements:" && head -5 requirements.txt
     [ -f Pipfile ] && echo "Python Pipenv プロジェクト"
     [ -f poetry.lock ] && echo "Python Poetry プロジェクト"
     [ -f manage.py ] && echo "Django プロジェクト"
     [ -f app.py ] && echo "Flask プロジェクト候補"

     # Java
     [ -f pom.xml ] && echo "Maven プロジェクト:" && grep -E "<groupId>|<artifactId>" pom.xml | head -2
     [ -f build.gradle ] && echo "Gradle プロジェクト:" && grep -E "group|version" build.gradle | head -2
     [ -f build.sbt ] && echo "SBT/Scala プロジェクト"

     # .NET/C#
     find . -name "*.csproj" | head -1 | xargs -r basename -s .csproj | xargs -r echo ".NET プロジェクト:"
     [ -f global.json ] && echo ".NET global.json:" && cat global.json

     # Go
     [ -f go.mod ] && echo "Go モジュール:" && head -3 go.mod
     [ -f main.go ] && echo "Go main.go 検出"

     # Rust
     [ -f Cargo.toml ] && echo "Rust プロジェクト:" && grep -E "name =|version =" Cargo.toml | head -2

     # Ruby
     [ -f Gemfile ] && echo "Ruby Gemfile プロジェクト"
     [ -f config/application.rb ] && echo "Ruby on Rails プロジェクト"

     # PHP
     [ -f composer.json ] && echo "PHP Composer プロジェクト:" && grep -E '"name"|"type"' composer.json | head -2

     # C/C++
     [ -f CMakeLists.txt ] && echo "CMake プロジェクト:" && grep "project(" CMakeLists.txt | head -1
     [ -f Makefile ] && echo "Makefile プロジェクト"
     \`\`\`

   - **🧩 ドメイン設計とエンティティ関係の把握**：
     プロジェクトのドメインモデルとビジネスロジックを理解してください：

     - **データモデル・エンティティの特定**
       - 各言語の典型的なモデルファイルを探索（model、entity、domain、schema等のディレクトリ・ファイル）
       - データベーススキーマファイルの確認（SQL、ORM設定ファイル等）
       - エンティティ間の関係性の理解

     - **ビジネスロジックの把握**
       - サービス層、ユースケース層、リポジトリ層のファイル構造確認
       - 既存のビジネスルールとドメインロジックの理解
       - アプリケーション層とドメイン層の分離パターンの確認

   - **📋 コーディング規約とパターンの確立**：
     プロジェクト全体の統一されたコーディング規約を把握してください：

     - **コードフォーマット・品質規則の確認**
       - 各言語のリンター・フォーマッター設定ファイルの確認
       - エディタ設定ファイル（.editorconfig等）の確認
       - プロジェクト固有のコーディングガイドラインの確認

     - **命名規則とパターンの分析**
       - 既存コードから一貫した命名規則の抽出
       - クラス、関数、変数、ファイル名の命名パターン
       - インポート/エクスポート、モジュール構成のパターン

     - **アーキテクチャパターンの確認**
       - ファイル構成とディレクトリ構造の規則
       - レイヤー分離のパターン（MVC、クリーンアーキテクチャ等）
       - 依存関係の方向性とパターン

4. **🔧 ビルド・テスト・品質管理システムの理解**：
   プロジェクトのビルドシステムとコマンド体系を把握してください：

   - **ビルドシステムとツールチェーンの特定**
     - 各言語・フレームワークのビルド定義ファイルの確認
     - 依存関係管理システムの理解
     - 開発、テスト、本番環境の違いの把握

   - **プロジェクト固有のコマンド体系の探索**（必須）：
     各言語・フレームワークのコマンド定義ファイルを確認し、利用可能なスクリプトやタスクを把握してください：

     - **JavaScript/TypeScript**: package.json の scripts セクション
     - **Python**: setup.py、pyproject.toml、requirements.txt、Pipfile
     - **Java**: pom.xml（Maven）、build.gradle（Gradle）、build.sbt（SBT）
     - **.NET/C#**: *.csproj ファイル、global.json
     - **Go**: go.mod ファイル、main.go の構成
     - **Rust**: Cargo.toml の [bin]、[lib] セクション
     - **Ruby**: Gemfile、Rakefile
     - **PHP**: composer.json の scripts セクション
     - **Make**: Makefile のターゲット定義
     - **CMake**: CMakeLists.txt のプロジェクト設定

   - **コマンド優先順位の特定**：
     - **第1優先**: リポジトリで定義されたコマンド（npm scripts、Makefileターゲット等）
     - **第2優先**: 標準的なコマンド（npm test、cargo build、mvn test等）
     - **重要**: リポジトリで定義されたコマンドが存在する場合は、それを優先的に使用する

5. **🧪 テスト環境と品質基準の把握**：
   プロジェクトのテスト戦略と品質基準を理解してください：

   - **テストフレームワークの特定**
     - 各言語・フレームワークのテスト設定ファイルの確認
     - 単体テスト、結合テスト、E2Eテストの構成理解
     - テストの実行方法とカバレッジ要件の確認

   - **既存テストパターンの分析**
     - テストファイルの命名規則と配置パターン
     - テストケースの構造とアサーション方法
     - モックやスタブの使用パターン

6. **📊 既存の実装パターンの理解**：
   プロジェクトの実装パターンとベストプラクティスを把握してください：

   - **実装パターンの確認**
     - 類似機能の実装方法と構造パターン
     - 各言語・フレームワーク固有の慣用句（イディオム）
     - 継承、コンポジション、依存性注入等の使用パターン

   - **エラーハンドリングと例外処理**
     - プロジェクトのエラーハンドリング戦略
     - ログ出力のパターンとレベル分け
     - 例外の種類と処理方法

   - **API・インターフェース設計パターン**
     - REST API、GraphQL等のAPI設計パターン
     - 入出力データの検証とシリアライゼーション
     - 認証・認可の実装パターン

7. **🔍 技術調査とベストプラクティスの確認**（重要）：
   実装開始前に、必要な技術知識とベストプラクティスを確認してください：

   - **Web検索を活用した積極的な調査**
     - **WebSearchツールの活用**：不明な技術、エラー、実装方法についてWeb検索で最新情報を取得
     - **公式ドキュメントの参照**：WebFetchツールで公式ドキュメントの詳細を確認
     - **コミュニティの知見活用**：Stack Overflow、GitHub Issues、技術ブログから実践的な解決策を収集
     - **複数情報源の比較**：異なる情報源を比較し、最も適切な実装方法を選択

   - **具体的な調査例**
     - エラーメッセージをWebSearchで検索して解決策を見つける
     - 新しいライブラリの使用方法を公式サイトから取得
     - パフォーマンス問題の解決策をコミュニティから収集
     - セキュリティの脆弱性情報を最新のセキュリティアドバイザリから確認

   - **ベストプラクティスの適用**
     - 言語・フレームワーク固有の推奨パターンとアンチパターンの把握
     - 最新のパフォーマンス最適化手法をWeb上から収集
     - セキュリティベストプラクティス（OWASP等の最新ガイドライン参照）

   - **実装判断の根拠**
     - Web上の複数の実装例を参考にしつつ、プロジェクトの既存パターンに適合させる
     - 新しい技術やパターンを導入する場合は、Web上の評価や採用事例を確認
     - 将来の保守性とスケーラビリティを考慮した設計

8. **実装の実行**
   - **機能実装の場合**: TDDサイクルに従って実装（テスト → 実装 → リファクタリング）
   - **ドキュメント等の場合**: 直接実装
   - 段階的な進行

9. **品質確認とコミット（必須）**
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
     find . -type d -maxdepth 3 | grep -E "(src|lib|app|pkg|internal|cmd|components|services|models|controllers|views|domain|infrastructure|presentation|main|test|tests)" | head -20

     # 言語・フレームワークの特定
     echo -e "\n=== 言語・フレームワーク特定 ==="

     # JavaScript/TypeScript
     [ -f package.json ] && echo "Node.js プロジェクト:" && grep -E '"name"|"main"|"scripts"' package.json | head -3
     [ -f tsconfig.json ] && echo "TypeScript設定:" && grep -E '"target"|"module"|"lib"' tsconfig.json
     [ -f angular.json ] && echo "Angular プロジェクト"
     [ -f next.config.js ] && echo "Next.js プロジェクト"
     [ -f nuxt.config.js ] && echo "Nuxt.js プロジェクト"
     [ -f vite.config.js ] && echo "Vite プロジェクト"

     # Python
     [ -f setup.py ] && echo "Python setup.py プロジェクト:" && grep -E "name=|version=" setup.py | head -2
     [ -f pyproject.toml ] && echo "Python pyproject.toml:" && grep -E "name =|version =" pyproject.toml | head -2
     [ -f requirements.txt ] && echo "Python requirements:" && head -5 requirements.txt
     [ -f Pipfile ] && echo "Python Pipenv プロジェクト"
     [ -f poetry.lock ] && echo "Python Poetry プロジェクト"
     [ -f manage.py ] && echo "Django プロジェクト"
     [ -f app.py ] && echo "Flask プロジェクト候補"

     # Java
     [ -f pom.xml ] && echo "Maven プロジェクト:" && grep -E "<groupId>|<artifactId>" pom.xml | head -2
     [ -f build.gradle ] && echo "Gradle プロジェクト:" && grep -E "group|version" build.gradle | head -2
     [ -f build.sbt ] && echo "SBT/Scala プロジェクト"

     # .NET/C#
     find . -name "*.csproj" | head -1 | xargs -r basename -s .csproj | xargs -r echo ".NET プロジェクト:"
     [ -f global.json ] && echo ".NET global.json:" && cat global.json

     # Go
     [ -f go.mod ] && echo "Go モジュール:" && head -3 go.mod
     [ -f main.go ] && echo "Go main.go 検出"

     # Rust
     [ -f Cargo.toml ] && echo "Rust プロジェクト:" && grep -E "name =|version =" Cargo.toml | head -2

     # Ruby
     [ -f Gemfile ] && echo "Ruby Gemfile プロジェクト"
     [ -f config/application.rb ] && echo "Ruby on Rails プロジェクト"

     # PHP
     [ -f composer.json ] && echo "PHP Composer プロジェクト:" && grep -E '"name"|"type"' composer.json | head -2

     # C/C++
     [ -f CMakeLists.txt ] && echo "CMake プロジェクト:" && grep "project(" CMakeLists.txt | head -1
     [ -f Makefile ] && echo "Makefile プロジェクト"
     \`\`\`

   - **🧩 ドメイン設計とエンティティ関係の把握**：
     プロジェクトのドメインモデルとビジネスロジックを理解してください：

     - **データモデル・エンティティの特定**
       - 各言語の典型的なモデルファイルを探索（model、entity、domain、schema等のディレクトリ・ファイル）
       - データベーススキーマファイルの確認（SQL、ORM設定ファイル等）
       - エンティティ間の関係性の理解

     - **ビジネスロジックの把握**
       - サービス層、ユースケース層、リポジトリ層のファイル構造確認
       - 既存のビジネスルールとドメインロジックの理解
       - アプリケーション層とドメイン層の分離パターンの確認

   - **📋 コーディング規約とパターンの確立**：
     プロジェクト全体の統一されたコーディング規約を把握してください：

     - **コードフォーマット・品質規則の確認**
       - 各言語のリンター・フォーマッター設定ファイルの確認
       - エディタ設定ファイル（.editorconfig等）の確認
       - プロジェクト固有のコーディングガイドラインの確認

     - **命名規則とパターンの分析**
       - 既存コードから一貫した命名規則の抽出
       - クラス、関数、変数、ファイル名の命名パターン
       - インポート/エクスポート、モジュール構成のパターン

     - **アーキテクチャパターンの確認**
       - ファイル構成とディレクトリ構造の規則
       - レイヤー分離のパターン（MVC、クリーンアーキテクチャ等）
       - 依存関係の方向性とパターン

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

6. **🔍 技術調査とベストプラクティスの確認**（重要）：
   実装に必要な技術知識とベストプラクティスを確認してください：

   - **Web検索を活用した積極的な調査**
     - **WebSearchツール使用**：不明な点はWebSearchで検索（エラー、実装方法、ベストプラクティス等）
     - **公式ドキュメント取得**：WebFetchで公式サイトから最新の仕様を確認
     - **実践例の収集**：Stack Overflow、GitHub、技術ブログから実装例を収集
     - プロジェクト内の既存実装も参考にして整合性を保つ

   - **ベストプラクティスの適用**
     - Web上の最新情報から言語・フレームワーク固有の推奨パターンを確認
     - セキュリティ脆弱性情報を最新のアドバイザリから確認
     - パフォーマンス最適化の最新手法を調査
     - 保守性とスケーラビリティを考慮した設計

7. **実装計画**: タスクの要件を満たすための実装計画を立ててください

8. **段階的実装**:
   - **機能実装の場合**: TDDサイクルで実装（テスト作成 → 最小実装 → リファクタリング）
   - **ドキュメント等の場合**: 直接実装
   - 必要なファイルとディレクトリの作成
   - 動作確認

9. **必須品質確認事項（厳格実行）**:
   **重要**: 以下を順番通りに実行し、すべて成功してからコミットしてください。

   ### 📦 1. フォーマット確認・修正（最初に実行）
   \`\`\`bash
   # リポジトリで定義されたフォーマットコマンドを確認・実行
   if [ -f package.json ]; then
     npm run format 2>/dev/null || npm run prettier 2>/dev/null || echo "フォーマットコマンドが見つかりません"
   fi
   if [ -f Makefile ]; then
     make format 2>/dev/null || make fmt 2>/dev/null || echo "Makefileにフォーマットターゲットがありません"
   fi
   if [ -f pubspec.yaml ]; then
     dart format . || echo "Flutter/Dartフォーマットに失敗しました"
   fi
   \`\`\`

   ### 🔍 2. リント確認（フォーマット後に実行）
   \`\`\`bash
   # リポジトリで定義されたリントコマンドを確認・実行
   if [ -f package.json ]; then
     npm run lint 2>/dev/null || echo "npm lintコマンドが見つかりません"
   fi
   if [ -f Makefile ]; then
     make lint 2>/dev/null || make check 2>/dev/null || echo "Makefileにlintターゲットがありません"
   fi
   if [ -f pubspec.yaml ]; then
     dart analyze || echo "Flutter/Dart analyzeに失敗しました"
   fi
   \`\`\`

   ### 🏷️ 3. 型チェック（TypeScript等の場合）
   \`\`\`bash
   # リポジトリで定義された型チェックコマンドを確認・実行
   if [ -f package.json ]; then
     npm run typecheck 2>/dev/null || npm run type-check 2>/dev/null || npx tsc --noEmit 2>/dev/null || echo "型チェックコマンドが見つかりません"
   fi
   \`\`\`

   ### 🧪 4. テスト実行
   \`\`\`bash
   # リポジトリで定義されたテストコマンドを確認・実行
   if [ -f package.json ]; then
     npm test 2>/dev/null || npm run test 2>/dev/null || echo "npmテストコマンドが見つかりません"
   fi
   if [ -f Makefile ]; then
     make test 2>/dev/null || echo "Makefileにtestターゲットがありません"
   fi
   if [ -f pubspec.yaml ]; then
     flutter test || echo "Flutter testに失敗しました"
   fi
   \`\`\`

   ### 🏗️ 5. ビルド確認（最後に実行・必須）
   \`\`\`bash
   # リポジトリで定義されたビルドコマンドを確認・実行
   if [ -f package.json ]; then
     npm run build 2>/dev/null || echo "npmビルドコマンドが見つかりません"
   fi
   if [ -f Makefile ]; then
     make build 2>/dev/null || make all 2>/dev/null || echo "Makefileにビルドターゲットがありません"
   fi
   if [ -f pubspec.yaml ]; then
     flutter build apk --debug || flutter build web || echo "Flutter buildに失敗しました"
   fi
   \`\`\`

   ### ⚠️ 絶対条件
   - **すべてのステップが成功必須**: 1つでも失敗した場合は、問題を解決してから次に進む
   - **エラーは必ず修正**: リント、型チェック、テスト、ビルドでエラーが出た場合は必ず修正する
   - **順序厳守**: フォーマット → リント → 型チェック → テスト → ビルド の順序を守る

10. **上記すべて成功後**: 変更内容を明確で詳細なコミットメッセージでコミット

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
