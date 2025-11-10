/**
 * 開発フェーズの定義
 */
export enum DevelopmentPhase {
  ANALYSIS = 'フェーズ1: 要求分析',
  PREPARATION = 'フェーズ2: 並列実行準備',
  DEVELOPMENT = 'フェーズ3: 並列開発',
  REVIEW = 'フェーズ4: レビュー（コンフリクト解消含む）',
  COMPLETION = 'フェーズ5: 完了'
}

/**
 * タスクの型定義
 */
export interface Task {
  id: string;
  type: 'feature' | 'bugfix' | 'refactor' | 'test' | 'docs' | 'conflict-resolution';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies: string[];
  assignedTo?: string;
  branchName?: string;
  worktreePath?: string;
  createdAt: Date;
  updatedAt: Date;
  // コンフリクト解消関連
  isConflictResolution?: boolean;
  originalTaskId?: string; // コンフリクト解消の場合、元のタスクID
  conflictResolverAttemptCount?: number; // コンフリクト解消の再試行回数（デフォルト: 0）
  conflictContext?: {
    originalEngineerResult: EngineerResult;
    reviewHistory: ReviewResult[];
    originalEngineerId: string;
  };
  // 依存関係ステータス
  dependencyStatus?: {
    blockedBy: string[];      // 待機中の依存タスクID
    waitingFor: string[];     // 完了待ちの依存タスクID
    failedDependencies: string[];  // 失敗した依存タスク
  };
  // ワークツリー強制作成フラグ
  forceNewWorktree?: boolean;
  // 拡張メタデータ（プロダクトオーナーAIの分析結果）
  metadata?: {
    skillRequirements?: string[];
    fileScope?: {
      primaryFiles?: string[];
      newFiles?: string[];
      readOnlyFiles?: string[];
      conflictRisk?: 'none' | 'low' | 'medium' | 'high';
    };
    technicalSpecs?: {
      technologies?: string[];
      patterns?: string[];
      interfaces?: string[];
    };
    implementation?: {
      steps?: string[];
      checkpoints?: string[];
      testRequirements?: string[];
    };
    acceptanceCriteria?: string[];
  };
}

/**
 * プロダクトオーナーAIの分析結果
 */
export interface TaskAnalysisResult {
  tasks: Task[];
  summary: string;
  riskAssessment: string;
  estimatedTime?: string;
  // 拡張分析情報
  analysisDetails?: {
    codebaseAssessment?: string;
    technicalRequirements?: string;
    architecturalDecisions?: string;
    parallelizationStrategy?: string;
  };
  // フェーズ管理情報
  projectId?: string;
  sessionId?: string;
}

/**
 * Git Worktreeの情報
 */
export interface WorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  locked: boolean;
}

/**
 * エンジニアAIの実行結果
 */
export interface EngineerResult {
  taskId: string;
  engineerId: string;
  success: boolean;
  needsReReview?: boolean;
  output: string[];
  error?: string;
  duration: number;
  filesChanged: string[];
}

/**
 * システム設定
 */
export interface SystemConfig {
  baseRepoPath: string;
  worktreeBasePath: string;
  maxConcurrentEngineers: number;
  maxTurnsPerTask: number;
  baseBranch: string;
  useRemote: boolean;
  maxReviewRetries?: number; // レビューループの最大リトライ回数（デフォルト: 5）
}

/**
 * AIエージェントの設定
 */
export interface AgentConfig {
  systemPrompt: string;
  maxTurns: number;
  allowedTools: string[];
}

/**
 * レビュー結果
 */
export interface ReviewResult {
  taskId: string;
  status: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'ERROR';
  comments: string[];
  reviewer: string;
  reviewedAt: Date;
  duration: number;
  error?: string;
}

/**
 * プロジェクトフェーズの情報
 */
export interface ProjectPhase {
  currentPhase: number;
  totalPhases: number;
  phaseName: string;
  description: string;
  completedTasks: string[];
  remainingTasks: Task[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * フェーズ管理ドキュメント
 */
export interface PhaseDocument {
  projectId: string;
  userRequest: string;
  phases: ProjectPhase[];
  currentPhaseIndex: number;
  analysis: {
    summary: string;
    technicalStrategy: string;
    riskAssessment: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 依存タスク失敗時の処理戦略
 */
export interface DependencyFailureStrategy {
  onDependencyFailed: 'skip' | 'retry' | 'continue-partial' | 'fail-cascade';
  maxRetries?: number;
  retryDelay?: number;
}

// ========================================
// スプリント駆動開発の型定義
// ========================================

/**
 * GlobalTask（Product Backlog管理用）
 *
 * グローバルタスクキューで管理される全プロジェクトのタスク。
 *
 * **用途**: Product/Sprint Backlog管理
 * **スコープ**: 全プロジェクト、全スプリント
 * **永続化**: `.kugutsu/tasks/global-queue.json`
 * **管理ノード**: ProductOwnerNode, TaskBreakdownNode, SprintPlanningNode
 *
 * **Product Backlogの判定**:
 * - `sprint === undefined`: 未割り当て（Product Backlog）
 * - `sprint !== undefined`: スプリント割り当て済み（Sprint Backlog）
 *
 * **Taskとの違い**:
 * - `GlobalTask`: バックログ管理用（プロジェクト全体で永続化）
 * - `Task`: 実行中タスク（worktreePath、branchName、sessionId等を含む）
 *
 * **ライフサイクル**:
 * ```
 * ProductOwnerNode → globalTasks (sprint: undefined)  ← Product Backlog
 * SprintPlanningNode → globalTasks (sprint: 'xxx')    ← Sprint Backlog
 * EngineerDispatchNode → tasks（実行キュー）
 * ReviewNode → globalTasks (status: 'completed')      ← 完了記録
 * ```
 *
 * **Note**: 型システムを統一するため、独立した定義に変更
 * priorityはnumber型（0-100）を使用
 */
export interface GlobalTask {
  id: string;
  type: 'feature' | 'bugfix' | 'refactor' | 'test' | 'docs' | 'conflict-resolution';
  title: string;
  description: string;
  priority: number;               // 基礎優先度（0-100）
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'in_review' | 'completed' | 'failed';
  worktreePath?: string;
  branchName?: string;
  createdAt?: Date;
  updatedAt?: Date;

  // GlobalTask固有のフィールド
  projectId: string;              // プロジェクト識別子（uuid）
  requestTimestamp: Date;         // リクエスト受付時刻
  dynamicPriority: number;        // 動的優先度（0-1000）
  sprint?: string;                // 所属スプリントID
  storyId?: string;               // 関連するユーザーストーリーID

  // コンフリクト解消関連
  conflictResolverAttemptCount?: number; // コンフリクト解消の再試行回数（デフォルト: 0）

  // instruction.md生成関連
  instructionGenerated?: boolean;     // instruction.md生成完了フラグ
  instructionGenerating?: boolean;    // instruction.md生成実行中フラグ（重複防止用）
  instructionError?: string;           // instruction.md生成エラー
  instructionGeneratedAt?: Date;       // instruction.md生成完了時刻
}

/**
 * プロジェクトメタ情報
 */
export interface ProjectMetadata {
  projectId: string;              // プロジェクト識別子
  userRequest: string;            // 元のユーザーリクエスト
  requestTimestamp: Date;         // リクエスト受付時刻
  totalTasks: number;             // 総タスク数
  completedTasks: number;         // 完了タスク数
  needsStoryMapping: boolean;     // ストーリーマッピングが必要か
  storyMappingPath?: string;      // ストーリーマッピングのファイルパス
  designDocsPath?: string;        // 設計書のファイルパス
}

/**
 * スプリント情報
 */
export interface Sprint {
  id: string;                     // sprint-{uuid}
  name: string;                   // "Sprint 1: 認証機能実装"
  goal: string;                   // スプリントゴール
  taskIds: string[];              // 含まれるタスクID
  status: 'planning' | 'active' | 'review' | 'completed';
  startedAt?: Date;               // 開始日時
  completedAt?: Date;             // 完了日時
  deployable: boolean;            // デプロイ可能かどうか
  metadata: {
    estimatedHours: number;       // 見積もり時間
    actualHours?: number;         // 実績時間
    blockers: string[];           // ブロッカー情報
    completedTasksCount: number;  // 完了タスク数
    failedTasksCount: number;     // 失敗タスク数
  };
}