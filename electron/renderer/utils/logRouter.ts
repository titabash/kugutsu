import type { LogEntry } from '../types'

/**
 * Orchestration node types that should route to main tab
 */
const ORCHESTRATION_NODE_TYPES = [
  'ProductOwnerNode',
  'MergeCoordinatorNode',
  'DirectorNode',
  'SprintPlanningNode',
  'CheckModeNode',
]

/**
 * Find the appropriate tab for a log entry
 *
 * @param log - The log entry to route
 * @param availableTabs - Array of available tab IDs
 * @returns Tab ID or null if no suitable tab found
 */
export function findTabForLog(
  log: LogEntry,
  availableTabs: string[]
): string | null {
  // If log has taskId and nodeType, route to specific tab
  if (log.taskId && log.nodeType) {
    const tabId = `${log.nodeType}-${log.taskId}`
    if (availableTabs.includes(tabId)) {
      return tabId
    }
  }

  // Orchestration logs go to main tab
  if (
    !log.taskId ||
    (log.nodeType && ORCHESTRATION_NODE_TYPES.includes(log.nodeType))
  ) {
    if (availableTabs.includes('main')) {
      return 'main'
    }
  }

  return null
}

/**
 * Check if a log entry is an orchestration log
 *
 * @param log - The log entry to check
 * @returns True if this is an orchestration log
 */
export function isOrchestrationLog(log: LogEntry): boolean {
  // taskId がない場合はオーケストレーションログ
  if (!log.taskId) return true

  // 特定のノードタイプはオーケストレーションログ
  return log.nodeType ? ORCHESTRATION_NODE_TYPES.includes(log.nodeType) : false
}

/**
 * Extract engineer ID from task ID
 *
 * @param taskId - The task ID (e.g., "task-1234")
 * @returns Engineer ID (e.g., "engineer-1234") or null if invalid
 */
export function extractEngineerIdFromTaskId(taskId: string): string | null {
  const match = taskId.match(/task-(\d+)/)
  return match ? `engineer-${match[1]}` : null
}

/**
 * Extract task number from task ID
 *
 * @param taskId - The task ID (e.g., "task-1234")
 * @returns Task number or null if invalid
 */
export function extractTaskNumber(taskId: string): number | null {
  const match = taskId.match(/task-(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

/**
 * Generate a friendly tab title from node type and task ID
 *
 * @param nodeType - The node type (e.g., "EngineerNode")
 * @param taskId - Optional task ID
 * @returns Friendly tab title (e.g., "Engineer-1", "Reviewer-2")
 */
export function generateTabTitle(nodeType: string, taskId?: string): string {
  if (!taskId) {
    // Node-level tabs
    switch (nodeType) {
      case 'ProductOwnerNode':
        return 'Product Owner'
      case 'MergeCoordinatorNode':
        return 'Merge Coordinator'
      case 'DirectorNode':
        return 'Director'
      case 'SprintPlanningNode':
        return 'Sprint Planning'
      case 'CheckModeNode':
        return 'Mode Check'
      default:
        return nodeType
    }
  }

  // Task-specific tabs
  const taskNumber = extractTaskNumber(taskId)
  if (taskNumber === null) {
    return `${nodeType}-${taskId}`
  }

  switch (nodeType) {
    case 'EngineerNode':
      return `Engineer-${taskNumber}`
    case 'ReviewNode':
      return `Reviewer-${taskNumber}`
    default:
      return `${nodeType}-${taskNumber}`
  }
}
