/**
 * タスクの型定義
 */
export interface Task {
  id: string;
  type: 'feature' | 'bugfix' | 'refactor' | 'test' | 'docs';
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
}

/**
 * プロダクトオーナーAIの分析結果
 */
export interface TaskAnalysisResult {
  tasks: Task[];
  summary: string;
  estimatedTime: string;
  riskAssessment: string;
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