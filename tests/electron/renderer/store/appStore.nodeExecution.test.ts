/**
 * appStore NodeExecution機能のユニットテスト
 *
 * LangGraphノード実行状態の追跡とリアルタイム可視化のテスト
 */

import { describe, test, expect, beforeEach } from '@jest/globals';

// モック実装（実際のStoreは後で実装）
interface NodeExecution {
  nodeName: string
  status: 'started' | 'completed' | 'failed'
  startedAt: Date
  completedAt?: Date
  duration?: number
  error?: string
}

interface NodeExecutionState {
  nodeExecutions: NodeExecution[]
  activeNodes: Map<string, NodeExecution>

  // Actions
  addNodeExecution: (execution: NodeExecution) => void
  updateNodeExecution: (nodeName: string, updates: Partial<NodeExecution>) => void
  clearNodeExecutions: () => void

  // Selectors
  getNodeExecution: (nodeName: string) => NodeExecution | undefined
  getActiveNodes: () => NodeExecution[]
  getNodeExecutionHistory: (nodeName?: string) => NodeExecution[]
  getNodeStatistics: (nodeName: string) => {
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    averageDuration: number
  } | null
}

// モックストアの作成
function createMockStore(): NodeExecutionState {
  let state: {
    nodeExecutions: NodeExecution[]
    activeNodes: Map<string, NodeExecution>
  } = {
    nodeExecutions: [],
    activeNodes: new Map(),
  }

  return {
    get nodeExecutions() {
      return state.nodeExecutions
    },
    get activeNodes() {
      return state.activeNodes
    },

    addNodeExecution: (execution: NodeExecution) => {
      state.nodeExecutions = [...state.nodeExecutions, execution]
      if (execution.status === 'started') {
        state.activeNodes.set(execution.nodeName, execution)
      }
    },

    updateNodeExecution: (nodeName: string, updates: Partial<NodeExecution>) => {
      state.nodeExecutions = state.nodeExecutions.map((exec) =>
        exec.nodeName === nodeName && exec.status === 'started'
          ? { ...exec, ...updates }
          : exec
      )

      if (updates.status === 'completed' || updates.status === 'failed') {
        state.activeNodes.delete(nodeName)
      }

      // Update active node if it exists
      const activeNode = state.activeNodes.get(nodeName)
      if (activeNode) {
        state.activeNodes.set(nodeName, { ...activeNode, ...updates })
      }
    },

    clearNodeExecutions: () => {
      state.nodeExecutions = []
      state.activeNodes.clear()
    },

    getNodeExecution: (nodeName: string) => {
      return state.nodeExecutions
        .slice()
        .reverse()
        .find((exec) => exec.nodeName === nodeName)
    },

    getActiveNodes: () => {
      return Array.from(state.activeNodes.values())
    },

    getNodeExecutionHistory: (nodeName?: string) => {
      if (nodeName) {
        return state.nodeExecutions.filter((exec) => exec.nodeName === nodeName)
      }
      return state.nodeExecutions
    },

    getNodeStatistics: (nodeName: string) => {
      const executions = state.nodeExecutions.filter(
        (exec) => exec.nodeName === nodeName && exec.status !== 'started'
      )

      if (executions.length === 0) return null

      const successfulExecutions = executions.filter(
        (exec) => exec.status === 'completed'
      ).length
      const failedExecutions = executions.filter(
        (exec) => exec.status === 'failed'
      ).length

      const durationsMs = executions
        .filter((exec) => exec.duration !== undefined)
        .map((exec) => exec.duration!)

      const averageDuration =
        durationsMs.length > 0
          ? durationsMs.reduce((sum, d) => sum + d, 0) / durationsMs.length
          : 0

      return {
        totalExecutions: executions.length,
        successfulExecutions,
        failedExecutions,
        averageDuration,
      }
    },
  }
}

describe('appStore - Node Execution Tracking', () => {
  let store: NodeExecutionState

  beforeEach(() => {
    store = createMockStore()
  })

  describe('Node Execution CRUD', () => {
    test('should add node execution when started', () => {
      const execution: NodeExecution = {
        nodeName: 'product_owner',
        status: 'started',
        startedAt: new Date('2025-01-01T10:00:00Z'),
      }

      store.addNodeExecution(execution)

      expect(store.nodeExecutions).toHaveLength(1)
      expect(store.nodeExecutions[0]).toEqual(execution)
    })

    test('should add node to active nodes when started', () => {
      const execution: NodeExecution = {
        nodeName: 'engineer',
        status: 'started',
        startedAt: new Date('2025-01-01T10:00:00Z'),
      }

      store.addNodeExecution(execution)

      expect(store.activeNodes.size).toBe(1)
      expect(store.activeNodes.get('engineer')).toEqual(execution)
    })

    test('should update node execution when completed', () => {
      const execution: NodeExecution = {
        nodeName: 'review',
        status: 'started',
        startedAt: new Date('2025-01-01T10:00:00Z'),
      }

      store.addNodeExecution(execution)

      const completedAt = new Date('2025-01-01T10:05:00Z')
      store.updateNodeExecution('review', {
        status: 'completed',
        completedAt,
        duration: 300000, // 5 minutes in ms
      })

      const updated = store.getNodeExecution('review')
      expect(updated?.status).toBe('completed')
      expect(updated?.completedAt).toEqual(completedAt)
      expect(updated?.duration).toBe(300000)
    })

    test('should remove node from active nodes when completed', () => {
      const execution: NodeExecution = {
        nodeName: 'merge_coordinator',
        status: 'started',
        startedAt: new Date('2025-01-01T10:00:00Z'),
      }

      store.addNodeExecution(execution)
      expect(store.activeNodes.size).toBe(1)

      store.updateNodeExecution('merge_coordinator', {
        status: 'completed',
        completedAt: new Date('2025-01-01T10:10:00Z'),
      })

      expect(store.activeNodes.size).toBe(0)
    })

    test('should handle node execution failure', () => {
      const execution: NodeExecution = {
        nodeName: 'engineer',
        status: 'started',
        startedAt: new Date('2025-01-01T10:00:00Z'),
      }

      store.addNodeExecution(execution)

      store.updateNodeExecution('engineer', {
        status: 'failed',
        completedAt: new Date('2025-01-01T10:02:00Z'),
        error: 'Build failed',
      })

      const updated = store.getNodeExecution('engineer')
      expect(updated?.status).toBe('failed')
      expect(updated?.error).toBe('Build failed')
      expect(store.activeNodes.size).toBe(0)
    })

    test('should clear all node executions', () => {
      store.addNodeExecution({
        nodeName: 'node1',
        status: 'started',
        startedAt: new Date(),
      })
      store.addNodeExecution({
        nodeName: 'node2',
        status: 'started',
        startedAt: new Date(),
      })

      expect(store.nodeExecutions).toHaveLength(2)
      expect(store.activeNodes.size).toBe(2)

      store.clearNodeExecutions()

      expect(store.nodeExecutions).toHaveLength(0)
      expect(store.activeNodes.size).toBe(0)
    })
  })

  describe('Active Nodes Tracking', () => {
    test('should track multiple active nodes simultaneously', () => {
      store.addNodeExecution({
        nodeName: 'engineer_1',
        status: 'started',
        startedAt: new Date('2025-01-01T10:00:00Z'),
      })
      store.addNodeExecution({
        nodeName: 'engineer_2',
        status: 'started',
        startedAt: new Date('2025-01-01T10:01:00Z'),
      })
      store.addNodeExecution({
        nodeName: 'review_1',
        status: 'started',
        startedAt: new Date('2025-01-01T10:02:00Z'),
      })

      const activeNodes = store.getActiveNodes()
      expect(activeNodes).toHaveLength(3)
      expect(activeNodes.map((n) => n.nodeName)).toEqual([
        'engineer_1',
        'engineer_2',
        'review_1',
      ])
    })

    test('should return empty array when no active nodes', () => {
      const activeNodes = store.getActiveNodes()
      expect(activeNodes).toHaveLength(0)
    })
  })

  describe('Node Execution History', () => {
    test('should get execution history for specific node', () => {
      store.addNodeExecution({
        nodeName: 'product_owner',
        status: 'started',
        startedAt: new Date('2025-01-01T10:00:00Z'),
      })
      store.updateNodeExecution('product_owner', {
        status: 'completed',
        completedAt: new Date('2025-01-01T10:05:00Z'),
      })
      store.addNodeExecution({
        nodeName: 'product_owner',
        status: 'started',
        startedAt: new Date('2025-01-01T11:00:00Z'),
      })
      store.addNodeExecution({
        nodeName: 'engineer',
        status: 'started',
        startedAt: new Date('2025-01-01T11:00:00Z'),
      })

      const history = store.getNodeExecutionHistory('product_owner')
      expect(history).toHaveLength(2)
      expect(history.every((h) => h.nodeName === 'product_owner')).toBe(true)
    })

    test('should get all execution history when no node specified', () => {
      store.addNodeExecution({
        nodeName: 'node1',
        status: 'started',
        startedAt: new Date(),
      })
      store.addNodeExecution({
        nodeName: 'node2',
        status: 'started',
        startedAt: new Date(),
      })

      const history = store.getNodeExecutionHistory()
      expect(history).toHaveLength(2)
    })
  })

  describe('Node Statistics', () => {
    test('should calculate node statistics correctly', () => {
      // First execution: success
      store.addNodeExecution({
        nodeName: 'engineer',
        status: 'started',
        startedAt: new Date('2025-01-01T10:00:00Z'),
      })
      store.updateNodeExecution('engineer', {
        status: 'completed',
        completedAt: new Date('2025-01-01T10:10:00Z'),
        duration: 600000, // 10 minutes
      })

      // Second execution: success
      store.addNodeExecution({
        nodeName: 'engineer',
        status: 'started',
        startedAt: new Date('2025-01-01T11:00:00Z'),
      })
      store.updateNodeExecution('engineer', {
        status: 'completed',
        completedAt: new Date('2025-01-01T11:08:00Z'),
        duration: 480000, // 8 minutes
      })

      // Third execution: failure
      store.addNodeExecution({
        nodeName: 'engineer',
        status: 'started',
        startedAt: new Date('2025-01-01T12:00:00Z'),
      })
      store.updateNodeExecution('engineer', {
        status: 'failed',
        completedAt: new Date('2025-01-01T12:02:00Z'),
        duration: 120000, // 2 minutes
        error: 'Test failed',
      })

      const stats = store.getNodeStatistics('engineer')

      expect(stats).not.toBeNull()
      expect(stats?.totalExecutions).toBe(3)
      expect(stats?.successfulExecutions).toBe(2)
      expect(stats?.failedExecutions).toBe(1)
      expect(stats?.averageDuration).toBe((600000 + 480000 + 120000) / 3)
    })

    test('should return null statistics for non-existent node', () => {
      const stats = store.getNodeStatistics('non_existent')
      expect(stats).toBeNull()
    })

    test('should exclude in-progress executions from statistics', () => {
      store.addNodeExecution({
        nodeName: 'review',
        status: 'started',
        startedAt: new Date(),
      })

      const stats = store.getNodeStatistics('review')
      expect(stats).toBeNull()
    })
  })

  describe('Get Latest Node Execution', () => {
    test('should get most recent execution for a node', () => {
      const firstExec: NodeExecution = {
        nodeName: 'product_owner',
        status: 'started',
        startedAt: new Date('2025-01-01T10:00:00Z'),
      }
      const secondExec: NodeExecution = {
        nodeName: 'product_owner',
        status: 'started',
        startedAt: new Date('2025-01-01T11:00:00Z'),
      }

      store.addNodeExecution(firstExec)
      store.addNodeExecution(secondExec)

      const latest = store.getNodeExecution('product_owner')
      expect(latest).toEqual(secondExec)
    })

    test('should return undefined for non-existent node', () => {
      const latest = store.getNodeExecution('non_existent')
      expect(latest).toBeUndefined()
    })
  })
})
