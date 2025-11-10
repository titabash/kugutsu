/**
 * Artifact Type Definitions
 *
 * `.kugutsu/` ディレクトリ配下のファイル構造に対応する TypeScript 型定義。
 */

/**
 * TechStack - 技術スタック分析結果
 *
 * ファイル: `.kugutsu/tech-stack.json`
 * 作成者: ProductOwnerNode
 */
export interface TechStack {
  /** プログラミング言語 */
  languages: string[];

  /** フレームワーク */
  frameworks: string[];

  /** ビルドツール */
  buildTools: string[];

  /** テストフレームワーク */
  testingFrameworks: string[];

  /** プロジェクトタイプ（例: "electron-app", "web-app", "cli-tool"） */
  projectType: string;

  /** パッケージマネージャー（例: "npm", "yarn", "pnpm"） */
  packageManager?: string;

  /** 検出日時 */
  detectedAt?: string;
}

/**
 * Requirements - 要求分析結果
 *
 * ファイル: `.kugutsu/requirements.json`
 * 作成者: ProductOwnerNode
 */
export interface Requirements {
  /** 機能要件 */
  functional: string[];

  /** 非機能要件 */
  nonFunctional: string[];

  /** 制約条件 */
  constraints: string[];

  /** 分析日時 */
  analyzedAt?: string;
}

/**
 * TaskStatus - タスクのステータス
 */
export type TaskStatus =
  | 'pending'           // 未着手
  | 'in_progress'       // 実装中
  | 'implemented'       // 実装完了
  | 'reviewed'          // レビュー完了
  | 'conflict_detected' // コンフリクト検出
  | 'conflict_resolved' // コンフリクト解決済み
  | 'completed'         // マージ完了（タスク完了）
  | 'failed';           // 失敗

/**
 * TaskArtifact - タスク定義
 *
 * ファイル: `.kugutsu/tasks.json`
 * 作成者: ProductOwnerNode
 * 更新者: 各ノード（EngineerNode, ReviewNode, MergeCoordinatorNode など）
 */
export interface TaskArtifact {
  /** タスクID（例: "task-001"） */
  id: string;

  /** タスクタイトル */
  title: string;

  /** タスクの概要 */
  description: string;

  /** 優先度（数値が大きいほど優先度が高い） */
  priority: number;

  /** 依存タスクのID配列 */
  dependencies: string[];

  /** タスクステータス */
  status: TaskStatus;

  /** 作成日時 */
  createdAt: string;

  /** 更新日時 */
  updatedAt: string;

  /** worktree パス（EngineerDispatchNode が設定） */
  worktreePath?: string;

  /** ブランチ名 */
  branchName?: string;

  /** セッションID（EngineerNode が設定、コンフリクト解決に使用） */
  sessionId?: string;

  /** 見積もり時間（分） */
  estimatedTime?: number;

  /** 実際の所要時間（分） */
  actualTime?: number;

  /** コンフリクト解消の再試行回数（デフォルト: 0） */
  conflictResolverAttemptCount?: number;
}

/**
 * ReviewStatus - レビューステータス
 */
export type ReviewStatus =
  | 'approved'          // 承認
  | 'changes_requested' // 修正要求
  | 'rejected';         // 却下

/**
 * ReviewComment - レビューコメント
 */
export interface ReviewComment {
  /** ファイルパス */
  file: string;

  /** 行番号（オプション） */
  line?: number;

  /** 重要度 */
  severity: 'info' | 'warning' | 'error';

  /** コメント内容 */
  message: string;
}

/**
 * Review - レビュー結果
 *
 * ファイル: `.kugutsu/tasks/{taskId}/review.json`
 * 作成者: ReviewNode
 */
export interface Review {
  /** タスクID */
  taskId: string;

  /** レビューステータス */
  status: ReviewStatus;

  /** レビュー担当者 */
  reviewedBy: string;

  /** レビュー日時 */
  reviewedAt: string;

  /** コメント一覧 */
  comments: ReviewComment[];

  /** レビュー総評 */
  summary: string;

  /** 改善提案 */
  suggestions: string[];
}

/**
 * MergeStatus - マージステータス
 */
export type MergeStatus =
  | 'success'  // 成功
  | 'conflict' // コンフリクト発生
  | 'failed';  // 失敗

/**
 * MergeResult - マージ結果
 *
 * ファイル: `.kugutsu/tasks/{taskId}/merge-result.json`
 * 作成者: MergeCoordinatorNode
 */
export interface MergeResult {
  /** タスクID */
  taskId: string;

  /** ブランチ名 */
  branch: string;

  /** ターゲットブランチ名 */
  targetBranch: string;

  /** マージステータス */
  status: MergeStatus;

  /** マージ日時 */
  mergedAt: string;

  /** コミットハッシュ（成功時） */
  commitHash?: string;

  /** コンフリクトファイル一覧（コンフリクト発生時） */
  conflictFiles?: string[];

  /** メッセージ */
  message: string;
}

/**
 * ConflictResolution - コンフリクト解決ステータス
 */
export type ConflictResolution =
  | 'pending'  // 未解決
  | 'resolved' // 解決済み
  | 'failed';  // 解決失敗

/**
 * ConflictDetail - コンフリクト詳細
 */
export interface ConflictDetail {
  /** 行番号 */
  line: number;

  /** 自分の変更 */
  ours: string;

  /** 相手の変更 */
  theirs: string;

  /** 解決後の内容 */
  resolved: string;
}

/**
 * ConflictFile - コンフリクトファイル情報
 */
export interface ConflictFile {
  /** ファイルパス */
  path: string;

  /** コンフリクト詳細一覧 */
  conflicts: ConflictDetail[];
}

/**
 * Conflicts - コンフリクト情報
 *
 * ファイル: `.kugutsu/tasks/{taskId}/conflicts.json`
 * 作成者: ConflictResolverNode
 */
export interface Conflicts {
  /** タスクID */
  taskId: string;

  /** コンフリクトファイル一覧 */
  conflictFiles: ConflictFile[];

  /** 解決ステータス */
  resolution: ConflictResolution;

  /** 解決日時 */
  resolvedAt?: string;

  /** 解決担当者 */
  resolvedBy?: string;
}

/**
 * StoryMap - ストーリーマップ（Scrum モード）
 *
 * ファイル: `.kugutsu/story-map.json`
 * 作成者: DirectorNode
 */
export interface StoryMap {
  /** プロダクト名 */
  productName: string;

  /** ユーザーストーリー一覧 */
  userStories: UserStory[];

  /** 作成日時 */
  createdAt: string;

  /** 更新日時 */
  updatedAt: string;
}

/**
 * UserStory - ユーザーストーリー
 */
export interface UserStory {
  /** ストーリーID */
  id: string;

  /** ストーリータイトル */
  title: string;

  /** ユーザーペルソナ */
  persona: string;

  /** 目的 */
  goal: string;

  /** 受け入れ基準 */
  acceptanceCriteria: string[];

  /** 優先度 */
  priority: number;

  /** 見積もり（ストーリーポイント） */
  estimatedPoints?: number;
}

/**
 * SprintPlan - スプリント計画（Scrum モード）
 *
 * ファイル: `.kugutsu/sprint-plan.json`
 * 作成者: SprintPlanningNode
 */
export interface SprintPlan {
  /** スプリント番号 */
  sprintNumber: number;

  /** スプリント名 */
  sprintName: string;

  /** 開始日 */
  startDate: string;

  /** 終了日 */
  endDate: string;

  /** スプリントに含まれるタスクID一覧 */
  taskIds: string[];

  /** スプリントゴール */
  goal: string;

  /** 作成日時 */
  createdAt: string;
}

/**
 * Metadata - ワークフロー全体のメタデータ
 *
 * ファイル: `.kugutsu/metadata.json`
 * 作成者: Orchestrator
 */
export interface Metadata {
  /** バージョン */
  version: string;

  /** ワークフロータイプ */
  workflowType: 'parallel' | 'sprint' | 'scrum';

  /** ユーザーの元の要求 */
  userRequest: string;

  /** 開始日時 */
  startedAt: string;

  /** 完了日時 */
  completedAt?: string;

  /** ステータス */
  status: 'in_progress' | 'completed' | 'failed';

  /** 設定 */
  config: {
    /** 最大エンジニア数 */
    maxEngineers: number;

    /** 最大ターン数 */
    maxTurns: number;

    /** ベースリポジトリパス */
    baseRepoPath: string;

    /** AI プロバイダー */
    provider: 'claude' | 'codex' | 'mock';
  };
}
