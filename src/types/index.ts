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
  conflictContext?: {
    originalEngineerResult: EngineerResult;
    reviewHistory: ReviewResult[];
    originalEngineerId: string;
  };
  // 拡張メタデータ（プロダクトオーナーAIの分析結果）
  metadata?: {
    estimatedHours?: number;
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
  estimatedTime: string;
  riskAssessment: string;
  // 拡張分析情報
  analysisDetails?: {
    codebaseAssessment?: string;
    technicalRequirements?: string;
    architecturalDecisions?: string;
    parallelizationStrategy?: string;
  };
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