/**
 * Node Role Definitions
 *
 * LangGraphノードをスクラム開発チームのロールにマッピング
 */

import type { NodeRole } from '../types'

export const NODE_ROLES: Record<string, NodeRole> = {
  // ========================================
  // Planning (計画)
  // ========================================
  analyze_complexity: {
    nodeName: 'analyze_complexity',
    roleName: 'Complexity Analyzer',
    roleIcon: '🔍',
    description: 'プロジェクトの複雑度を分析',
    category: 'planning',
  },
  product_owner: {
    nodeName: 'product_owner',
    roleName: 'Product Owner',
    roleIcon: '📋',
    description: 'プロダクトバックログを管理し、タスクを分解',
    category: 'planning',
  },
  check_mode: {
    nodeName: 'check_mode',
    roleName: 'Mode Detector',
    roleIcon: '🔄',
    description: '継続モード vs 新規モードを判定',
    category: 'planning',
  },
  sprint_planning: {
    nodeName: 'sprint_planning',
    roleName: 'Sprint Planner',
    roleIcon: '📅',
    description: 'スプリント計画を作成（8-16h単位）',
    category: 'planning',
  },
  sprint_review: {
    nodeName: 'sprint_review',
    roleName: 'Sprint Reviewer',
    roleIcon: '🎯',
    description: 'スプリントレビューと次スプリント生成',
    category: 'planning',
  },

  // ========================================
  // Design (設計)
  // ========================================
  director_ai: {
    nodeName: 'director_ai',
    roleName: 'Director (Story Mapping)',
    roleIcon: '🎬',
    description: 'ストーリーマッピングを作成',
    category: 'design',
  },
  review_story_mapping: {
    nodeName: 'review_story_mapping',
    roleName: 'Story Mapping Reviewer',
    roleIcon: '📝',
    description: 'ストーリーマッピングをレビュー',
    category: 'design',
  },
  tech_lead_design: {
    nodeName: 'tech_lead_design',
    roleName: 'Tech Lead (Design)',
    roleIcon: '🏗️',
    description: 'システム設計（DB/API/UI）を作成',
    category: 'design',
  },
  review_design: {
    nodeName: 'review_design',
    roleName: 'Design Reviewer',
    roleIcon: '👀',
    description: '設計をレビュー',
    category: 'design',
  },
  task_breakdown: {
    nodeName: 'task_breakdown',
    roleName: 'Task Breakdown Specialist',
    roleIcon: '🧩',
    description: 'タスクを詳細に分解',
    category: 'design',
  },

  // ========================================
  // Development (開発)
  // ========================================
  instruction_generator_dispatch: {
    nodeName: 'instruction_generator_dispatch',
    roleName: 'Instruction Dispatcher',
    roleIcon: '📤',
    description: 'instruction.md生成タスクを配信',
    category: 'development',
  },
  instruction_generator: {
    nodeName: 'instruction_generator',
    roleName: 'Instruction Generator',
    roleIcon: '📄',
    description: 'タスク別instruction.mdを生成',
    category: 'development',
  },
  instruction_aggregator: {
    nodeName: 'instruction_aggregator',
    roleName: 'Instruction Aggregator',
    roleIcon: '📋',
    description: 'instruction生成結果を集約',
    category: 'development',
  },
  engineer_dispatch: {
    nodeName: 'engineer_dispatch',
    roleName: 'Engineer Dispatcher',
    roleIcon: '📤',
    description: 'エンジニアタスクを配信',
    category: 'development',
  },
  engineer: {
    nodeName: 'engineer',
    roleName: 'Engineer',
    roleIcon: '👨‍💻',
    description: 'コードを実装',
    category: 'development',
  },
  engineer_aggregator: {
    nodeName: 'engineer_aggregator',
    roleName: 'Engineer Aggregator',
    roleIcon: '📊',
    description: '並列実装結果を集約',
    category: 'development',
  },

  // ========================================
  // Review (レビュー)
  // ========================================
  review_dispatch: {
    nodeName: 'review_dispatch',
    roleName: 'Review Dispatcher',
    roleIcon: '📤',
    description: 'レビュータスクを配信',
    category: 'review',
  },
  review: {
    nodeName: 'review',
    roleName: 'Tech Lead (Reviewer)',
    roleIcon: '🔍',
    description: 'コードをレビュー',
    category: 'review',
  },
  review_aggregator: {
    nodeName: 'review_aggregator',
    roleName: 'Review Aggregator',
    roleIcon: '📊',
    description: '並列レビュー結果を集約',
    category: 'review',
  },

  // ========================================
  // Coordination (調整)
  // ========================================
  merge_coordinator: {
    nodeName: 'merge_coordinator',
    roleName: 'Merge Coordinator',
    roleIcon: '🔀',
    description: 'マージを調整',
    category: 'coordination',
  },
  conflict_resolver: {
    nodeName: 'conflict_resolver',
    roleName: 'Conflict Resolver',
    roleIcon: '⚡',
    description: 'コンフリクトを解消',
    category: 'coordination',
  },
  backlog_refinement: {
    nodeName: 'backlog_refinement',
    roleName: 'Backlog Refiner',
    roleIcon: '🔧',
    description: 'バックログをリファインメント',
    category: 'coordination',
  },
}

/**
 * Get node role information
 */
export function getNodeRole(nodeName: string): NodeRole {
  return (
    NODE_ROLES[nodeName] || {
      nodeName,
      roleName: nodeName,
      roleIcon: '⚙️',
      description: 'Unknown node',
      category: 'coordination',
    }
  )
}

/**
 * Get category color
 */
export function getCategoryColor(category: NodeRole['category']): string {
  const colors = {
    planning: 'bg-blue-500',
    design: 'bg-purple-500',
    development: 'bg-green-500',
    review: 'bg-yellow-500',
    coordination: 'bg-red-500',
  }
  return colors[category]
}

/**
 * Get category label
 */
export function getCategoryLabel(category: NodeRole['category']): string {
  const labels = {
    planning: '計画',
    design: '設計',
    development: '開発',
    review: 'レビュー',
    coordination: '調整',
  }
  return labels[category]
}
