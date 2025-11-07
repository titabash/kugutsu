# Artifact Management Specification

## Overview

このドキュメントでは、Kugutsuシステムにおける成果物（Artifact）の管理方法を定義します。

## 核心原則

1. **上流工程の成果物は`.kugutsu/`ディレクトリで管理**
   - メタデータ、タスク定義、レビュー結果などをファイルとして永続化

2. **実装作業は`worktrees/`ディレクトリで実行**
   - 各タスク専用のworktreeで並列実装
   - 実装結果はgitコミットとして記録

3. **ノード間の成果物の受け渡しは`.kugutsu/`のファイルを介して行う**
   - State（LangGraph）は制御情報のみ、成果物はファイルで管理

## Design Philosophy

### Core Principles

Kugutsuシステムにおける成果物管理の核心原則：

1. **上流工程の成果物は`.kugutsu/`ディレクトリで管理**
   - 技術スタック分析、要求分析、タスク定義などのメタデータ
   - ProductOwnerNode、DirectorNode、SprintPlanningNodeが生成
   - レビュー結果、マージ結果などの管理情報

2. **実装作業は`worktrees/`ディレクトリで実行**
   - EngineerNodeが各タスク専用のworktreeで実装
   - ReviewNodeがworktree内のコードを読み取ってレビュー
   - ConflictResolverNodeがworktree内でコンフリクト解決
   - 実装結果はgitコミットとして記録

3. **ノード間の成果物の受け渡しは主に`.kugutsu/`のファイルを介して行う**
   - State（LangGraph）はワークフロー制御情報のみ
   - 実際の成果物はファイルシステムで永続化
   - ファイルパスをStateで共有

4. **責任分離**
   - 上流工程（分析・計画）: `.kugutsu/`に成果物を作成
   - 下流工程（実装・レビュー）: `worktrees/`で作業、結果を`.kugutsu/`に記録
   - 実装コード: gitコミットで管理
   - 管理情報: `.kugutsu/`のJSONファイルで管理

### Why File-Based Artifacts?

成果物をファイルベースで管理する理由：

1. **トレーサビリティ（Traceability）**
   - 各ステップの成果物がファイルとして永続化される
   - 時系列での変更履歴を追跡可能
   - 問題発生時の原因特定が容易

2. **デバッグ性（Debuggability）**
   - ファイルを直接確認することで、各ノードの出力を検証可能
   - AIの出力結果を人間が読める形で保存
   - ログだけでなく、実際の成果物を確認できる

3. **再現性（Reproducibility）**
   - 同じファイルセットから同じ結果を再現可能
   - テスト時にファイルをモックとして使用可能
   - CI/CDパイプラインでの検証が容易

4. **永続化（Persistence）**
   - プロセス終了後も成果物が残る
   - システムクラッシュ時も成果物は保護される
   - ワークフロー途中からの再開が可能

5. **並列性（Parallelism）**
   - ファイルシステムは並列アクセスに対して堅牢
   - 複数のEngineerノードが独立したディレクトリで作業可能
   - 競合状態を最小化

### State vs. Artifacts

| 要素 | State | Artifacts (Files) |
|------|-------|-------------------|
| **目的** | ワークフロー制御 | 実際の成果物 |
| **内容** | ステータス、メタデータ、指示 | 技術スタック、タスク定義、コード |
| **寿命** | ワークフロー実行中のみ | 永続的 |
| **サイズ** | 小さい（KB） | 可変（KB～MB） |
| **例** | `taskStatus: 'in_progress'` | `.kugutsu/tasks.json` |

**State の役割:**
- どのノードを次に実行するか
- どのタスクがどのステータスか
- エラーが発生したか
- `.kugutsu/`の**どのファイル**を読むべきか

**Artifacts の役割:**
- 技術スタック分析結果
- 要求分析結果
- タスク定義
- 実装コード
- レビュー結果

## `.kugutsu/` Directory Structure

```
.kugutsu/
├── metadata.json              # ワークフロー全体のメタデータ
├── tech-stack.json            # 技術スタック分析結果
├── requirements.json          # 要求分析結果
├── tasks.json                 # タスク定義（全タスクのメタデータ）
├── story-map.json             # ストーリーマップ（Scrumモード）
├── sprint-plan.json           # スプリント計画（Scrumモード）
│
├── tasks/                     # タスクごとのディレクトリ
│   ├── task-001/
│   │   ├── instruction.md     # タスクの詳細指示（ProductOwnerが作成）
│   │   ├── review.json        # レビュー結果（ReviewNodeが作成）
│   │   ├── merge-result.json  # マージ結果（MergeCoordinatorが作成）
│   │   └── conflicts.json     # コンフリクト情報（ConflictResolverが作成、発生時のみ）
│   │
│   ├── task-002/
│   │   └── ...
│   │
│   └── ...
│
├── worktrees/                 # git worktree作業ディレクトリ（実装作業用）
│   ├── task-001/              # EngineerNodeがここで実装
│   │   ├── src/               # 実装したソースコード
│   │   ├── tests/             # 実装したテストコード
│   │   └── .git               # worktree用のgit情報
│   │
│   └── task-002/
│       └── ...
│
├── reviews/                   # レビュー関連
│   ├── task-001-review.json
│   └── ...
│
└── logs/                      # 各ノードの実行ログ
    ├── product-owner.log
    ├── engineer-task-001.log
    └── ...
```

## File Format Specifications

### `metadata.json`

ワークフロー全体のメタデータ。

```json
{
  "version": "1.0.0",
  "workflowType": "parallel" | "sprint" | "scrum",
  "userRequest": "ユーザーの元の要求",
  "startedAt": "2025-01-07T00:00:00Z",
  "completedAt": "2025-01-07T01:00:00Z",
  "status": "in_progress" | "completed" | "failed",
  "config": {
    "maxEngineers": 3,
    "maxTurns": 30,
    "baseRepoPath": "/path/to/repo",
    "provider": "claude" | "codex" | "mock"
  }
}
```

### `tech-stack.json`

ProductOwnerNodeが生成する技術スタック分析結果。

```json
{
  "languages": ["TypeScript", "JavaScript"],
  "frameworks": ["Electron", "React", "LangGraph"],
  "buildTools": ["npm", "electron-vite"],
  "testingFrameworks": ["Jest"],
  "projectType": "electron-app",
  "packageManager": "npm",
  "detectedAt": "2025-01-07T00:00:00Z"
}
```

### `requirements.json`

ProductOwnerNodeが生成する要求分析結果。

```json
{
  "functional": [
    "ユーザー認証機能の実装",
    "データ永続化の実装"
  ],
  "nonFunctional": [
    "レスポンスタイムは1秒以内",
    "セキュリティ: OWASP Top 10対策"
  ],
  "constraints": [
    "既存のAPIとの互換性維持",
    "TypeScript 5.0以上を使用"
  ],
  "analyzedAt": "2025-01-07T00:00:00Z"
}
```

### `tasks.json`

ProductOwnerNodeが生成するタスク定義。

```json
{
  "tasks": [
    {
      "id": "task-001",
      "title": "ユーザー認証機能の実装",
      "description": "JWTベースの認証機能を実装する",
      "priority": 100,
      "dependencies": [],
      "estimatedTime": 120,
      "status": "pending",
      "assignedTo": null,
      "createdAt": "2025-01-07T00:00:00Z",
      "updatedAt": "2025-01-07T00:00:00Z"
    }
  ],
  "totalTasks": 1,
  "generatedAt": "2025-01-07T00:00:00Z"
}
```

### `tasks/{taskId}/instruction.md`

ProductOwnerNodeまたはScrumMasterNodeが生成するタスクの詳細指示。

```markdown
# Task: task-001 - ユーザー認証機能の実装

## 目的
JWTベースのユーザー認証機能を実装する。

## 要件
- ログイン/ログアウト機能
- トークンのリフレッシュ機能
- セキュアなトークン保存

## 技術制約
- TypeScript 5.0以上
- JWT library: jsonwebtoken
- 既存のAPIエンドポイント: /api/auth/*

## 実装ファイル
- `src/auth/AuthService.ts`
- `src/auth/TokenManager.ts`

## テスト
- `tests/auth/AuthService.test.ts`
```

### 実装結果の記録（gitコミット）

**重要: EngineerNodeの実装結果はファイルベースではなく、gitコミットとして記録されます。**

実装結果は以下の形で記録：
1. **worktree内のソースコード**: 実際の実装ファイル
2. **gitコミット**: 変更内容とコミットメッセージ
3. **コミットメッセージ**: 実装内容の要約

**コミットメッセージのフォーマット例:**
```
feat(task-001): ユーザー認証機能の実装

- JWTベースの認証サービスを実装
- トークンリフレッシュ機能を追加
- セキュアストレージへのトークン保存

Files changed:
- src/auth/AuthService.ts (new)
- src/auth/TokenManager.ts (new)
- tests/auth/AuthService.test.ts (new)
- src/config/app.ts (modified)

Tests: All passed ✅
```

**実装内容の確認方法:**
```bash
# worktreeのコミットログを確認
cd worktrees/task-001
git log --oneline

# 差分を確認
git diff main..HEAD

# 変更ファイル一覧
git diff --name-status main..HEAD
```

### `tasks/{taskId}/review.json`

ReviewNodeが生成するレビュー結果。

```json
{
  "taskId": "task-001",
  "status": "approved" | "changes_requested" | "rejected",
  "reviewedBy": "TechLeadNode-1",
  "reviewedAt": "2025-01-07T00:35:00Z",
  "comments": [
    {
      "file": "src/auth/AuthService.ts",
      "line": 45,
      "severity": "warning" | "error" | "info",
      "message": "エラーハンドリングを追加してください"
    }
  ],
  "summary": "実装内容は良好ですが、エラーハンドリングの改善が必要です。",
  "suggestions": [
    "トークン有効期限のテストケースを追加",
    "エラーメッセージの国際化対応"
  ]
}
```

### `tasks/{taskId}/merge-result.json`

MergeCoordinatorNodeが生成するマージ結果。

```json
{
  "taskId": "task-001",
  "branch": "feature/task-task-001",
  "targetBranch": "main",
  "status": "success" | "conflict" | "failed",
  "mergedAt": "2025-01-07T00:40:00Z",
  "commitHash": "abc123...",
  "conflicts": [],
  "message": "Successfully merged task-001 to main"
}
```

### `tasks/{taskId}/conflicts.json`

ConflictResolverNodeが生成するコンフリクト情報。

```json
{
  "taskId": "task-001",
  "conflictFiles": [
    {
      "path": "src/config/app.ts",
      "conflicts": [
        {
          "line": 10,
          "ours": "const apiUrl = 'http://localhost:3000';",
          "theirs": "const apiUrl = 'http://localhost:4000';",
          "resolved": "const apiUrl = 'http://localhost:3000';"
        }
      ]
    }
  ],
  "resolvedAt": "2025-01-07T00:42:00Z",
  "resolvedBy": "EngineerNode-1"
}
```

## Node Responsibilities

### ProductOwnerNode

**生成するファイル:**
- `.kugutsu/tech-stack.json`
- `.kugutsu/requirements.json`
- `.kugutsu/tasks.json`
- `.kugutsu/tasks/{taskId}/instruction.md` (各タスクの詳細指示)

**実装方法:**
1. AIに「`.kugutsu/tech-stack.json`を作成してください」と指示
2. AIがWriteツールで実際にファイルを作成
3. NodeはReadツールでファイルを読み取り、パース
4. パース結果をStateに含める（ファイルパスのみ）

**プロンプト例:**
```typescript
const prompt = `
# Technology Stack Analysis

プロジェクトの技術スタックを分析してください。

## タスク
1. package.json, tsconfig.json等を確認
2. 使用言語、フレームワーク、ビルドツールを特定
3. **結果を .kugutsu/tech-stack.json に保存**

## 出力ファイル
\`.kugutsu/tech-stack.json\`

## 出力形式
{
  "languages": [...],
  "frameworks": [...],
  "buildTools": [...],
  "testingFrameworks": [...],
  "projectType": "..."
}
`;
```

### EngineerNode

**作業場所:**
- `worktrees/task-{taskId}/` (タスク専用のworktree)

**読み取るファイル:**
- `.kugutsu/tasks/{taskId}/instruction.md` (ベースリポジトリから)

**生成するファイル:**
- worktree内の実際のソースコード（実装）
- worktree内のテストコード
- gitコミット（実装内容）

**更新するファイル:**
- `.kugutsu/tasks.json` (ステータス更新: `in_progress` → `implemented`)

**実装方法:**
1. Stateから`taskId`と`worktreePath`を取得
2. ベースリポジトリの`.kugutsu/tasks/{taskId}/instruction.md`を読み取り
3. worktree内でAIに実装を依頼（Writeツールで実ファイルを生成）
4. worktree内でgitコミット
5. ベースリポジトリの`.kugutsu/tasks.json`のステータスを更新

**重要な注意事項:**
- EngineerNodeは**worktree内**で作業する（ベースリポジトリは変更しない）
- 実装結果はgitコミットとして記録される（ファイルベースの成果物ではない）
- コミットメッセージに実装内容の要約を含める

**プロンプト例:**
```typescript
const instruction = fs.readFileSync(
  path.join(baseRepoPath, '.kugutsu/tasks/task-001/instruction.md'),
  'utf-8'
);

const prompt = `
# Task Implementation: ${taskId}

## 作業ディレクトリ
${worktreePath}

## 実装指示
${instruction}

## タスク
1. 上記の指示に従って、このworktree内で実装してください
2. テストコードも作成してください
3. 実装完了後、gitコミットしてください

## 注意事項
- テスト駆動開発（TDD）で進める
- コード品質を保つ
- コミットメッセージは実装内容を要約する
`;
```

### ReviewNode

**作業場所:**
- ベースリポジトリ（読み取り専用でworktreeを確認）

**読み取るファイル:**
- `worktrees/task-{taskId}/` 内の実装コード
- `worktrees/task-{taskId}/` のgitコミット履歴

**生成するファイル:**
- `.kugutsu/tasks/{taskId}/review.json` (レビュー結果)

**更新するファイル:**
- `.kugutsu/tasks.json` (ステータス更新: `implemented` → `reviewed`)

**実装方法:**
1. worktree内の実装コードを読み取り（Read, Glob, Grepツール）
2. gitログからコミット内容を確認
3. AIにコードレビューを依頼
4. AIに「`.kugutsu/tasks/{taskId}/review.json`を作成してください」と指示
5. `.kugutsu/tasks.json`のステータスを更新

**重要な注意事項:**
- ReviewNodeはworktreeを**読み取り専用**で参照する
- レビュー結果は`.kugutsu/tasks/{taskId}/review.json`に保存（ベースリポジトリ）
- approvedの場合、次はMergeCoordinatorNodeへ
- changes_requestedの場合、EngineerNodeに再実装を依頼

### MergeCoordinatorNode

**読み取るファイル:**
- `.kugutsu/tasks/{taskId}/review.json`
- `.kugutsu/tasks.json` (タスクステータス更新のため)

**生成・更新するファイル:**
- `.kugutsu/tasks/{taskId}/merge-result.json` (新規作成)
- `.kugutsu/tasks.json` (ステータス更新)

**実装方法:**
1. レビュー結果を確認（approved か）
2. gitマージを実行（worktree → main）
3. 結果を`.kugutsu/tasks/{taskId}/merge-result.json`に保存
4. **マージ成功時: `.kugutsu/tasks.json`のタスクステータスを`completed`に更新**
5. マージ失敗時: タスクステータスを`failed`に更新、またはコンフリクト解決へ

**注意事項:**
- MergeCoordinatorNodeはベースリポジトリで動作し、worktree内のコミットをmainブランチにマージする
- マージ成功 = タスク完了なので、カンバンボードUIに正しく反映させるため`.kugutsu/tasks.json`の更新が必須

### ConflictResolverNode

**作業場所:**
- `worktrees/task-{taskId}/` (コンフリクトが発生したworktree)

**読み取るファイル:**
- `.kugutsu/tasks/{taskId}/merge-result.json`
- worktree内のコンフリクトファイル

**生成・更新するファイル:**
- worktree内のコンフリクト解決されたファイル
- `.kugutsu/tasks/{taskId}/conflicts.json` (解決記録)
- `.kugutsu/tasks.json` (ステータス更新: `conflict_resolved`)

**実装方法:**
1. merge-result.jsonからコンフリクト情報を読み取り
2. worktree内でAIにコンフリクト解決を依頼（実ファイルを修正）
3. 解決後、gitコミット
4. 解決記録を`.kugutsu/tasks/{taskId}/conflicts.json`に保存
5. `.kugutsu/tasks.json`のタスクステータスを更新
6. 再度MergeCoordinatorNodeへ

## MockAIProvider Implementation

MockAIProviderは、実際のAIの動作をシミュレートする必要があります。

**重要: MockはWriteツールを使って実際にファイルを作成する**

```typescript
// MockAIProvider Example
mockProvider.setMockResponse(/Technology Stack Analysis/i, {
  messages: [
    {
      type: 'assistant',
      content: 'ファイルを作成します'
    },
    {
      type: 'system',
      content: {
        toolUse: {
          name: 'Write',
          input: {
            file_path: '.kugutsu/tech-stack.json',
            content: JSON.stringify({
              languages: ['TypeScript', 'JavaScript'],
              frameworks: ['Electron', 'React'],
              buildTools: ['npm'],
              testingFrameworks: ['Jest'],
              projectType: 'electron-app'
            }, null, 2)
          }
        }
      }
    },
    {
      type: 'assistant',
      content: '.kugutsu/tech-stack.json を作成しました'
    }
  ]
});
```

**または、MockAIProviderが直接ファイルを作成する:**

```typescript
class EnhancedMockAIProvider extends MockAIProvider {
  async *execute(prompt: string, options: ExecuteOptions = {}): AsyncIterable<AIMessage> {
    // プロンプトに応じてファイルを作成
    if (/Technology Stack Analysis/i.test(prompt)) {
      const outputPath = path.join(options.cwd || '', '.kugutsu/tech-stack.json');
      const content = {
        languages: ['TypeScript', 'JavaScript'],
        frameworks: ['Electron', 'React'],
        buildTools: ['npm'],
        testingFrameworks: ['Jest'],
        projectType: 'electron-app'
      };

      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify(content, null, 2));

      yield {
        type: 'assistant',
        content: `.kugutsu/tech-stack.json を作成しました`
      };
    }
  }
}
```

## State Management

Stateには、ファイルパスとステータス情報のみを含めます。

```typescript
interface ParallelDevState {
  // メタデータ
  userRequest: string;
  config: ParallelDevConfig;

  // ファイルパス（実際のデータはファイルに）
  techStackFile: string;        // '.kugutsu/tech-stack.json'
  requirementsFile: string;     // '.kugutsu/requirements.json'
  tasksFile: string;            // '.kugutsu/tasks.json'

  // タスクステータス（制御情報）
  tasks: Array<{
    id: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    instructionFile: string;    // '.kugutsu/tasks/task-001/instruction.md'
    implementationFile?: string; // '.kugutsu/tasks/task-001/implementation.md'
    reviewFile?: string;        // '.kugutsu/tasks/task-001/review.json'
    mergeResultFile?: string;   // '.kugutsu/tasks/task-001/merge-result.json'
  }>;

  // ワークフロー制御
  currentPhase: 'analysis' | 'development' | 'review' | 'merge' | 'completed';
  errors: string[];
  logs: LogEntry[];
}
```

## Migration Plan

既存のノード実装を段階的に移行します。

### Phase 1: ProductOwnerNode
1. プロンプトを修正して、AIにファイル作成を指示
2. ファイルを読み取ってパース
3. MockAIProviderを修正してファイルを作成

### Phase 2: EngineerNode
1. instruction.mdを読み取り
2. AIにimplementation.mdの作成を指示
3. MockAIProviderを修正

### Phase 3: ReviewNode
1. implementation.mdとコードを読み取り
2. AIにreview.jsonの作成を指示
3. MockAIProviderを修正

### Phase 4: MergeCoordinatorNode & ConflictResolverNode
1. レビュー結果を読み取り
2. マージ結果をファイルに保存

### Phase 5: State Cleanup
1. Stateから不要なデータを削除
2. ファイルパスのみを保持

## Complete Workflow Example

ファイルベースの成果物管理がどのように機能するか、完全なワークフロー例を示します。

### Phase 1: 要求分析（ProductOwnerNode）

1. AIに技術スタック分析を依頼
   - AI: `.kugutsu/tech-stack.json`を作成
2. AIに要求分析を依頼
   - AI: `.kugutsu/requirements.json`を作成
3. AIにタスク生成を依頼
   - AI: `.kugutsu/tasks.json`を作成
   - AI: `.kugutsu/tasks/task-001/instruction.md`を作成
   - AI: `.kugutsu/tasks/task-002/instruction.md`を作成
4. Node: `.kugutsu/tasks.json`を読み取り、Stateに反映

**成果物:**
```
.kugutsu/
├── tech-stack.json
├── requirements.json
├── tasks.json
└── tasks/
    ├── task-001/instruction.md
    └── task-002/instruction.md
```

### Phase 2: 実装（EngineerNode）

1. Node: `.kugutsu/tasks/task-001/instruction.md`を読み取り
2. Node: worktree作成 `worktrees/task-001/`
3. AIに実装を依頼（worktree内で作業）
   - AI: `worktrees/task-001/src/auth/AuthService.ts`を作成
   - AI: `worktrees/task-001/tests/auth/AuthService.test.ts`を作成
   - AI: gitコミット実行
4. Node: `.kugutsu/tasks.json`のステータスを`implemented`に更新

**成果物:**
```
worktrees/task-001/
├── src/auth/AuthService.ts  (新規)
├── tests/auth/AuthService.test.ts  (新規)
└── .git  (コミット履歴)

.kugutsu/tasks.json  (ステータス更新)
```

### Phase 3: レビュー（ReviewNode）

1. Node: `worktrees/task-001/`のコードを読み取り
2. AIにレビューを依頼
   - AI: `.kugutsu/tasks/task-001/review.json`を作成
3. Node: `.kugutsu/tasks.json`のステータスを`reviewed`に更新

**成果物:**
```
.kugutsu/tasks/task-001/review.json  (新規)
.kugutsu/tasks.json  (ステータス更新)
```

### Phase 4: マージ（MergeCoordinatorNode）

1. Node: `.kugutsu/tasks/task-001/review.json`を読み取り（approved確認）
2. Node: gitマージ実行 `worktrees/task-001/` → `main`
3. Node: `.kugutsu/tasks/task-001/merge-result.json`を作成
4. Node: `.kugutsu/tasks.json`のステータスを`completed`に更新

**成果物:**
```
.kugutsu/tasks/task-001/merge-result.json  (新規)
.kugutsu/tasks.json  (ステータス更新: completed)
main ブランチ  (マージ済み)
```

### Phase 5: UI反映

1. Electron UI: `.kugutsu/tasks.json`の変更を検知
2. UI: カンバンボードのタスクステータスを`Completed`に更新
3. ユーザー: タスク完了を確認

## Benefits Summary

この設計により、以下のメリットが得られます：

1. **デバッグが容易**: 各ステップの成果物をファイルで確認可能
2. **テストが容易**: ファイルをモックとして使用可能
3. **再現性**: 同じファイルセットから同じ結果を再現
4. **並列性**: ファイルベースなので並列実行が安全
5. **永続性**: プロセス終了後も成果物が残る
6. **トレーサビリティ**: 時系列での変更履歴を追跡可能
7. **責任分離**: 上流工程は`.kugutsu/`、実装はworktree、レビュー結果は`.kugutsu/`と明確に分離

## References

- [ARCHITECTURE_DESIGN.md](./ARCHITECTURE_DESIGN.md)
- [DATA_PERSISTENCE_SPECIFICATION.md](./DATA_PERSISTENCE_SPECIFICATION.md)
- [COMPONENT_SPECIFICATION.md](./COMPONENT_SPECIFICATION.md)
- [TASK_STATE_MACHINE.md](./TASK_STATE_MACHINE.md)
