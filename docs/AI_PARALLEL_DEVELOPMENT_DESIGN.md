# AI並列開発システム設計書

## 1. システム概要

### 1.1 目的
Claude Code SDK（TypeScript版）とgit worktreeを活用し、複数のAIエンジニアが並列で開発タスクを実行できるシステムを構築する。これにより、大規模な開発プロジェクトを効率的に進めることが可能となる。

### 1.2 主要な特徴
- **並列タスク実行**: 複数のAIエンジニアが独立したworktreeで同時作業
- **タスク自動分割**: ユーザの要求を分析し、適切なサブタスクに分割
- **ブランチ戦略**: 各タスクは独立したブランチで開発
- **統合管理**: タスクの進捗管理と成果物の統合

## 2. システムアーキテクチャ

### 2.1 コンポーネント構成

```
┌─────────────────────────────────────────────────────────────┐
│                     Task Orchestrator                        │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │Task Analyzer│  │Task Allocator│  │Progress Monitor  │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴──────────────────────┐
        │                                            │
┌───────▼──────┐  ┌────────────────┐  ┌────────────▼────────┐
│ Git Manager  │  │ Claude Manager │  │ Integration Manager │
│              │  │                │  │                     │
│ - Worktree   │  │ - SDK Interface│  │ - Merge Strategy    │
│ - Branch     │  │ - Agent Pool   │  │ - Conflict Resolve  │
│ - Commit     │  │ - Task Queue   │  │ - Test Runner       │
└──────────────┘  └────────────────┘  └─────────────────────┘
        │                  │                     │
        └──────────────────┴─────────────────────┘
                           │
    ┌──────────────────────┴───────────────────────────┐
    │                                                   │
┌───▼────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──▼─────┐
│Worker 1│  │Worker 2│  │Worker 3│  │Worker 4│  │Worker N│
│        │  │        │  │        │  │        │  │        │
│Worktree│  │Worktree│  │Worktree│  │Worktree│  │Worktree│
└────────┘  └────────┘  └────────┘  └────────┘  └────────┘
```

### 2.2 データフロー

1. **タスク受付**: ユーザからの開発要求を受け取る
2. **タスク分析**: 要求を解析し、独立した開発タスクに分割
3. **タスク割当**: 各タスクにブランチとworktreeを割り当て
4. **並列実行**: 各AIエンジニアが独立して作業を実行
5. **進捗監視**: リアルタイムでタスクの進捗を追跡
6. **成果物統合**: 完了したタスクをメインブランチに統合

## 3. 主要コンポーネント詳細

### 3.1 Task Orchestrator
**責務**: システム全体の調整と管理

#### Task Analyzer
- ユーザ要求の解析
- タスク依存関係の分析
- タスク優先度の決定
- 必要リソースの見積もり

#### Task Allocator
- AIエンジニアへのタスク割当
- リソースの最適配分
- 負荷分散の実現

#### Progress Monitor
- タスク進捗のリアルタイム追跡
- ボトルネックの検出
- 完了予測時間の算出

### 3.2 Git Manager
**責務**: Gitリポジトリの操作と管理

- **Worktree管理**: 各タスク用のworktreeの作成・削除
- **ブランチ戦略**: feature/task-{id}形式でブランチ作成
- **コミット管理**: 各AIエンジニアのコミットを追跡

### 3.3 Claude Manager
**責務**: Claude Code SDKとの連携

- **エージェントプール**: 複数のClaude Code SDKインスタンスの管理
- **タスクキュー**: タスクの順序管理と実行
- **コンテキスト管理**: 各エージェントのコンテキストとオプション設定
- **ツール権限管理**: Read, Write, Bashツールの使用制御
- **ワーキングディレクトリ管理**: 各worktreeでの作業環境設定

### 3.4 Integration Manager
**責務**: 成果物の統合と品質保証

- **マージ戦略**: 自動マージと競合解決
- **テスト実行**: 統合前の自動テスト
- **品質チェック**: コード品質の検証

## 4. ワークフロー

### 4.1 基本的なワークフロー

```mermaid
graph TD
    A[ユーザ要求] --> B[タスク分析]
    B --> C{タスク分割}
    C -->|タスク1| D1[ブランチ作成]
    C -->|タスク2| D2[ブランチ作成]
    C -->|タスクN| DN[ブランチ作成]
    
    D1 --> E1[Worktree作成]
    D2 --> E2[Worktree作成]
    DN --> EN[Worktree作成]
    
    E1 --> F1[AIエンジニア1]
    E2 --> F2[AIエンジニア2]
    EN --> FN[AIエンジニアN]
    
    F1 --> G1[開発実行]
    F2 --> G2[開発実行]
    FN --> GN[開発実行]
    
    G1 --> H[統合テスト]
    G2 --> H
    GN --> H
    
    H --> I{品質チェック}
    I -->|Pass| J[メインブランチへマージ]
    I -->|Fail| K[修正タスク生成]
    K --> C
```

### 4.2 タスク実行プロセス

1. **タスク受信**
   ```python
   task = {
       "id": "task-001",
       "type": "feature",
       "description": "ユーザ認証機能の実装",
       "priority": "high",
       "dependencies": []
   }
   ```

2. **Worktree作成**
   ```bash
   # 新しいブランチと共にworktreeを作成
   git worktree add -b feature/task-001 ../worktrees/task-001 main
   ```

3. **AIエンジニア起動**
   ```python
   import anyio
   from claude_code_sdk import query, ClaudeCodeOptions
   
   async def execute_task(task_id: str, worktree_path: str, task_description: str):
       # Claude Code SDKのオプション設定
       options = ClaudeCodeOptions(
           system_prompt=f"あなたは経験豊富なソフトウェアエンジニアです。タスクID: {task_id}",
           max_turns=10,
           allowed_tools=["Read", "Write", "Bash", "Glob", "Grep"],
           permission_mode='acceptEdits',
           working_directory=worktree_path
       )
       
       # タスク実行用のプロンプト
       prompt = f"""
       作業ディレクトリ: {worktree_path}
       タスク: {task_description}
       
       以下の手順で開発を進めてください：
       1. 既存のコードベースを確認
       2. 必要な実装を行う
       3. テストを作成・実行
       4. 変更をコミット
       """
       
       # Claude Code SDKを使用してタスクを実行
       async for message in query(prompt=prompt, options=options):
           print(f"[Task-{task_id}] {message}")
   
   # タスクの実行
   anyio.run(execute_task, "001", "../worktrees/task-001", task['description'])
   ```

4. **開発実行**
   - コード生成
   - テスト作成
   - ドキュメント作成

5. **成果物コミット**
   ```bash
   git add .
   git commit -m "feat: implement user authentication #task-001"
   ```

## 5. 実装計画

### 5.1 フェーズ1: 基盤構築
- Task Orchestratorの基本実装
- Git Manager（worktree操作）
- 単一AIエンジニアでの動作確認

### 5.2 フェーズ2: 並列化実装
- Claude Managerの実装
- 複数エージェントの並列実行
- タスクキューの実装

### 5.3 フェーズ3: 統合機能
- Integration Managerの実装
- 自動マージ機能
- 競合解決メカニズム

### 5.4 フェーズ4: 高度な機能
- 依存関係を持つタスクの処理
- 動的なリソース配分
- 学習型タスク分割

## 6. 技術スタック

### 6.1 必要なライブラリ
- **@anthropic-ai/claude-code**: Claude Code SDK for TypeScript
- **uuid**: タスクID生成用
- **fs**: ファイルシステム操作（Node標準）
- **path**: パス操作（Node標準）
- **child_process**: Git worktreeコマンド実行（Node標準）

### 6.2 開発依存関係
- **typescript**: TypeScriptコンパイラ
- **@types/node**: Node.js型定義
- **@types/uuid**: UUID型定義
- **ts-node**: TypeScript直接実行

### 6.3 前提条件
- **Node.js 18+**: Claude Code SDKの要件
- **TypeScript**: 開発言語
- **Claude Code**: API アクセス（環境変数経由）
- **git 2.0+**: worktree機能の使用


## 7. セキュリティとベストプラクティス

### 7.1 セキュリティ考慮事項
- APIキーの安全な管理
- worktreeの適切な隔離
- 権限管理とアクセス制御

### 7.2 ベストプラクティス
- タスクサイズの適切な分割
- 定期的なメインブランチとの同期
- 包括的なテストカバレッジ
- 明確なコミットメッセージ

## 8. 制約と制限事項

### 8.1 技術的制約

**Git Worktree関連**
- 実験的機能のため、一部制限がある
- サブモジュールサポートが不完全
- 同一ブランチを複数worktreeでチェックアウト不可
- worktreeパス管理の注意が必要

**Claude Code SDK関連**
- Node.jsとClaude Code CLIが必要
- Python 3.10+の要件
- 非同期処理の必須使用
- ツール権限の適切な設定が必要
- ワーキングディレクトリの管理が重要

**システムリソース**
- 同時実行可能なAIエンジニア数の上限
- worktreeによるディスク使用量の増加
- メモリ使用量の管理

### 8.2 運用上の考慮事項
- ディスク容量の管理
- 長時間実行タスクの監視
- エラーリカバリメカニズム

## 9. 今後の拡張性

### 9.1 スケーラビリティ
- 分散システムへの対応
- クラウド環境での実行
- 複数リポジトリの同時処理

### 9.2 機能拡張
- 他のAIモデルとの統合
- ビジュアルなタスク管理UI
- 実行履歴の分析とレポート

## 10. Claude Code SDK並列実行の実装例

### 10.1 複数エージェントの並列実行（TypeScript実装）

```typescript
import { query, type SDKMessage } from "@anthropic-ai/claude-code";
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface TaskConfig {
  id: string;
  type: 'feature' | 'bugfix' | 'refactor' | 'test' | 'docs';
  description: string;
  maxTurns?: number;
}

class ParallelClaudeManager {
  constructor(
    private baseRepoPath: string,
    private worktreeBasePath: string
  ) {}

  async executeTask(task: TaskConfig, worktreePath: string): Promise<string[]> {
    const messages: string[] = [];
    
    try {
      const abortController = new AbortController();
      
      for await (const message of query({
        prompt: `タスクID: ${task.id}\nタスクタイプ: ${task.type}\n\n${task.description}`,
        abortController,
        options: {
          maxTurns: task.maxTurns || 20,
          cwd: worktreePath,
        },
      })) {
        if (message && typeof message === 'object' && 'type' in message) {
          if (message.type === 'assistant' && 'message' in message) {
            const assistantMessage = message.message as any;
            if (assistantMessage.content) {
              for (const content of assistantMessage.content) {
                if (content.type === 'text') {
                  const logMessage = `[${task.id}] ${content.text}`;
                  messages.push(logMessage);
                  console.log(logMessage);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      const errorMessage = `[${task.id}] ERROR: ${error}`;
      messages.push(errorMessage);
      console.error(errorMessage);
    }
    
    return messages;
  }
    
  async executeParallelTasks(tasks: TaskConfig[]): Promise<Record<string, string[]>> {
    const results: Record<string, string[]> = {};
    
    // 並列実行
    const promises = tasks.map(async (task) => {
      const worktreePath = path.join(this.worktreeBasePath, `task-${task.id}`);
      const messages = await this.executeTask(task, worktreePath);
      results[task.id] = messages;
    });
    
    await Promise.all(promises);
    return results;
  }
}

// 使用例
async function main() {
  const tasks: TaskConfig[] = [
    {
      id: "001",
      type: "feature",
      description: "ユーザ認証APIを実装してください",
      maxTurns: 15
    },
    {
      id: "002", 
      type: "feature",
      description: "ログイン画面を作成してください",
      maxTurns: 10
    },
    {
      id: "003",
      type: "test",
      description: "認証機能のテストを作成してください",
      maxTurns: 8
    }
  ];
  
  const manager = new ParallelClaudeManager(".", "./worktrees");
  const results = await manager.executeParallelTasks(tasks);
  
  for (const [taskId, messages] of Object.entries(results)) {
    console.log(`\n=== Task ${taskId} Results ===`);
    messages.forEach(message => console.log(message));
  }
}

// 実行
main().catch(console.error);
```

### 10.2 Git Worktree管理の統合（TypeScript実装）

```typescript
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { query } from "@anthropic-ai/claude-code";

const execAsync = promisify(exec);

class IntegratedTaskManager {
  constructor(
    private baseRepoPath: string,
    private worktreeBasePath: string
  ) {}

  async createWorktree(taskId: string, baseBranch: string = "main"): Promise<string> {
    const branchName = `feature/task-${taskId}`;
    const worktreePath = path.join(this.worktreeBasePath, `task-${taskId}`);
    
    // 既存のworktreeがあれば削除
    if (fs.existsSync(worktreePath)) {
      await this.removeWorktree(taskId);
    }
    
    try {
      const command = `git worktree add -b ${branchName} ${worktreePath} ${baseBranch}`;
      const { stdout, stderr } = await execAsync(command, { cwd: this.baseRepoPath });
      
      if (stderr && !stderr.includes('Switched to a new branch')) {
        console.warn('Git worktree warning:', stderr);
      }
      
      return worktreePath;
    } catch (error) {
      throw new Error(`Worktree作成エラー: ${error}`);
    }
  }
    
  async removeWorktree(taskId: string): Promise<void> {
    const worktreePath = path.join(this.worktreeBasePath, `task-${taskId}`);
    
    if (fs.existsSync(worktreePath)) {
      try {
        const command = `git worktree remove ${worktreePath}`;
        await execAsync(command, { cwd: this.baseRepoPath });
      } catch (error) {
        console.warn(`Worktree削除の警告: ${error}`);
        // 強制削除を試行
        try {
          const forceCommand = `git worktree remove --force ${worktreePath}`;
          await execAsync(forceCommand, { cwd: this.baseRepoPath });
        } catch (forceError) {
          console.error(`Worktree強制削除エラー: ${forceError}`);
        }
      }
    }
  }

  async runTaskWithWorktree(task: TaskConfig): Promise<string[]> {
    const taskId = task.id;
    
    try {
      // Worktreeを作成
      const worktreePath = await this.createWorktree(taskId);
      
      // Claude Code SDKでタスクを実行
      const messages: string[] = [];
      const abortController = new AbortController();
      
      for await (const message of query({
        prompt: task.description,
        abortController,
        options: {
          maxTurns: task.maxTurns || 20,
          cwd: worktreePath,
        },
      })) {
        if (message && typeof message === 'object' && 'type' in message) {
          if (message.type === 'assistant' && 'message' in message) {
            const assistantMessage = message.message as any;
            if (assistantMessage.content) {
              for (const content of assistantMessage.content) {
                if (content.type === 'text') {
                  messages.push(content.text);
                }
              }
            }
          }
        }
      }
      
      return messages;
      
    } catch (error) {
      return [`ERROR: ${error}`];
    } finally {
      // タスク完了後にworktreeをクリーンアップ（オプション）
      // await this.removeWorktree(taskId);
    }
  }
}
```

### 10.3 並列実行時の注意点（TypeScript実装）

1. **ブランチの重複回避**: 各worktreeは独立したブランチを使用
2. **リソース管理**: 同時実行数の制限とメモリ使用量の監視
3. **エラーハンドリング**: worktree作成・削除の失敗に対する適切な処理
4. **クリーンアップ**: タスク完了後の自動的なworktree削除
5. **Node.js環境**: Claude Code SDKが各worktreeで正常に動作することを確認
6. **非同期処理**: Promise.allを使用した適切な並列実行管理
7. **TypeScript型安全性**: 適切な型定義による実行時エラーの予防
8. **エラー境界**: 一つのタスクの失敗が他のタスクに影響しないような実装

## 11. 実装済み機能

### 11.1 現在の実装状況
- ✅ **基本的なClaude Code SDK統合**: TypeScriptベースの実装完了
- ✅ **並列開発オーケストレーター**: 複数AIエンジニアの協調動作
- ✅ **Git Worktree管理**: 自動的なブランチ作成とworktree管理
- ✅ **タスク分析AI (ProductOwnerAI)**: ユーザー要求の自動分析と分割
- ✅ **エンジニアAI**: 独立したworktreeでの開発作業
- ✅ **技術リードAI**: アーキテクチャ指導と技術的監督
- ✅ **レビューワークフロー**: 自動コードレビューシステム
- ✅ **マージコーディネーター**: 競合解決と統合管理
- ✅ **CLIインターフェース**: 使いやすいコマンドライン操作

### 11.2 アーキテクチャ特徴
- **TypeScript**: 型安全性による信頼性の高い実装
- **モジュラー設計**: 各コンポーネントが独立して機能
- **非同期処理**: Promise.allによる効率的な並列実行
- **エラー境界**: 一つのタスクの失敗が全体に影響しない設計
- **リソース管理**: 適切なクリーンアップとメモリ管理

## 12. まとめ

このAI並列開発システムは、git worktreeとClaude Code SDK for TypeScriptを組み合わせることで、複雑な開発タスクを効率的に並列処理するための包括的なソリューションを提供します。

**主要な利点:**
- 複数のAIエンジニアが独立したworktreeで同時作業
- Claude Code SDKによる高度なツール使用（Read, Write, Bash等）
- TypeScriptによる型安全な実装
- 非同期処理によるスケーラブルな並列実行
- 適切なエラーハンドリングとリソース管理
- 自動的なコードレビューと品質管理
- インテリジェントなマージとコンフリクト解決

実際のClaude Code SDK APIと現代的なTypeScript開発手法を組み合わせ、制限事項を考慮した実装により、従来の開発プロセスを大幅に改善し、開発速度と品質の向上を実現しています。