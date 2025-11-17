/**
 * appStore NodeFlow機能のユニットテスト
 *
 * LangGraphノードフロー可視化のためのストア機能のテスト
 */

import { describe, test, expect, beforeEach } from '@jest/globals';

// 型定義
interface FlowNode {
  id: string
  type: 'start' | 'process' | 'decision' | 'end'
  label: string
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped'
  executionTime?: number
  startedAt?: number
  completedAt?: number
}

interface FlowEdge {
  id: string
  source: string
  target: string
  label?: string
  condition?: string
}

interface NodeFlowData {
  nodes: FlowNode[]
  edges: FlowEdge[]
}

interface NodeFlowState {
  nodeFlowData: NodeFlowData | null
  currentExecutingNode: string | null

  // Actions
  setNodeFlowData: (flowData: NodeFlowData | null) => void
  setCurrentExecutingNode: (nodeName: string | null) => void
  updateNodeFlowStatus: (
    nodeId: string,
    status: FlowNode['status'],
    timestamp?: number,
    executionTime?: number
  ) => void

  // Selectors
  getFlowNode: (nodeId: string) => FlowNode | undefined
}

// モックストアの作成
function createMockStore(): NodeFlowState {
  let state: {
    nodeFlowData: NodeFlowData | null
    currentExecutingNode: string | null
  } = {
    nodeFlowData: null,
    currentExecutingNode: null,
  }

  return {
    get nodeFlowData() {
      return state.nodeFlowData
    },
    get currentExecutingNode() {
      return state.currentExecutingNode
    },

    setNodeFlowData: (flowData: NodeFlowData | null) => {
      state.nodeFlowData = flowData
    },

    setCurrentExecutingNode: (nodeName: string | null) => {
      state.currentExecutingNode = nodeName
    },

    updateNodeFlowStatus: (
      nodeId: string,
      status: FlowNode['status'],
      timestamp?: number,
      executionTime?: number
    ) => {
      if (!state.nodeFlowData) return

      const nodes = state.nodeFlowData.nodes.map((node) => {
        if (node.id !== nodeId) return node

        const updatedNode = { ...node, status }

        if (status === 'executing') {
          updatedNode.startedAt = timestamp || Date.now()
        } else if (status === 'completed' || status === 'failed') {
          updatedNode.completedAt = timestamp || Date.now()
          if (executionTime !== undefined) {
            updatedNode.executionTime = executionTime
          }
        }

        return updatedNode
      })

      state.nodeFlowData = {
        ...state.nodeFlowData,
        nodes,
      }
    },

    getFlowNode: (nodeId: string) => {
      if (!state.nodeFlowData) return undefined
      return state.nodeFlowData.nodes.find((node) => node.id === nodeId)
    },
  }
}

// テストデータ作成ヘルパー
function createTestFlowData(): NodeFlowData {
  return {
    nodes: [
      {
        id: '__start__',
        type: 'start',
        label: '開始',
        status: 'pending',
      },
      {
        id: 'analyze_complexity',
        type: 'process',
        label: '複雑度分析',
        status: 'pending',
      },
      {
        id: 'product_owner',
        type: 'process',
        label: 'Product Backlog生成',
        status: 'pending',
      },
      {
        id: 'engineer',
        type: 'process',
        label: 'コード実装',
        status: 'pending',
      },
      {
        id: '__end__',
        type: 'end',
        label: '完了',
        status: 'pending',
      },
    ],
    edges: [
      { id: 'e1', source: '__start__', target: 'analyze_complexity' },
      { id: 'e2', source: 'analyze_complexity', target: 'product_owner' },
      { id: 'e3', source: 'product_owner', target: 'engineer' },
      { id: 'e4', source: 'engineer', target: '__end__' },
    ],
  }
}

describe('appStore - Node Flow Visualization', () => {
  let store: NodeFlowState

  beforeEach(() => {
    store = createMockStore()
  })

  describe('Node Flow Data Management', () => {
    test('should set node flow data', () => {
      const flowData = createTestFlowData()
      store.setNodeFlowData(flowData)

      expect(store.nodeFlowData).toBe(flowData)
      expect(store.nodeFlowData?.nodes).toHaveLength(5)
      expect(store.nodeFlowData?.edges).toHaveLength(4)
    })

    test('should clear node flow data when set to null', () => {
      const flowData = createTestFlowData()
      store.setNodeFlowData(flowData)
      expect(store.nodeFlowData).not.toBeNull()

      store.setNodeFlowData(null)
      expect(store.nodeFlowData).toBeNull()
    })

    test('should get flow node by id', () => {
      const flowData = createTestFlowData()
      store.setNodeFlowData(flowData)

      const node = store.getFlowNode('product_owner')
      expect(node).toBeDefined()
      expect(node?.id).toBe('product_owner')
      expect(node?.label).toBe('Product Backlog生成')
    })

    test('should return undefined for non-existent node', () => {
      const flowData = createTestFlowData()
      store.setNodeFlowData(flowData)

      const node = store.getFlowNode('non_existent')
      expect(node).toBeUndefined()
    })

    test('should return undefined when no flow data is set', () => {
      const node = store.getFlowNode('product_owner')
      expect(node).toBeUndefined()
    })
  })

  describe('Current Executing Node Tracking', () => {
    test('should set current executing node', () => {
      store.setCurrentExecutingNode('engineer')
      expect(store.currentExecutingNode).toBe('engineer')
    })

    test('should clear current executing node', () => {
      store.setCurrentExecutingNode('engineer')
      expect(store.currentExecutingNode).toBe('engineer')

      store.setCurrentExecutingNode(null)
      expect(store.currentExecutingNode).toBeNull()
    })

    test('should update current executing node', () => {
      store.setCurrentExecutingNode('product_owner')
      expect(store.currentExecutingNode).toBe('product_owner')

      store.setCurrentExecutingNode('engineer')
      expect(store.currentExecutingNode).toBe('engineer')
    })
  })

  describe('Node Status Updates', () => {
    beforeEach(() => {
      const flowData = createTestFlowData()
      store.setNodeFlowData(flowData)
    })

    test('should update node status to executing', () => {
      const timestamp = Date.now()
      store.updateNodeFlowStatus('product_owner', 'executing', timestamp)

      const node = store.getFlowNode('product_owner')
      expect(node?.status).toBe('executing')
      expect(node?.startedAt).toBe(timestamp)
      expect(node?.completedAt).toBeUndefined()
      expect(node?.executionTime).toBeUndefined()
    })

    test('should update node status to completed with execution time', () => {
      const startTime = Date.now()
      const endTime = startTime + 5000
      const executionTime = 5000

      // まず実行開始
      store.updateNodeFlowStatus('engineer', 'executing', startTime)

      // 実行完了
      store.updateNodeFlowStatus('engineer', 'completed', endTime, executionTime)

      const node = store.getFlowNode('engineer')
      expect(node?.status).toBe('completed')
      expect(node?.completedAt).toBe(endTime)
      expect(node?.executionTime).toBe(5000)
    })

    test('should update node status to failed with error', () => {
      const timestamp = Date.now()
      store.updateNodeFlowStatus('engineer', 'failed', timestamp)

      const node = store.getFlowNode('engineer')
      expect(node?.status).toBe('failed')
      expect(node?.completedAt).toBe(timestamp)
    })

    test('should update node status to skipped', () => {
      store.updateNodeFlowStatus('analyze_complexity', 'skipped')

      const node = store.getFlowNode('analyze_complexity')
      expect(node?.status).toBe('skipped')
    })

    test('should use current timestamp when not provided', () => {
      const beforeUpdate = Date.now()
      store.updateNodeFlowStatus('product_owner', 'executing')
      const afterUpdate = Date.now()

      const node = store.getFlowNode('product_owner')
      expect(node?.startedAt).toBeGreaterThanOrEqual(beforeUpdate)
      expect(node?.startedAt).toBeLessThanOrEqual(afterUpdate)
    })

    test('should not affect other nodes when updating one node', () => {
      store.updateNodeFlowStatus('product_owner', 'executing')
      store.updateNodeFlowStatus('engineer', 'completed')

      const productOwner = store.getFlowNode('product_owner')
      const engineer = store.getFlowNode('engineer')
      const analyzeComplexity = store.getFlowNode('analyze_complexity')

      expect(productOwner?.status).toBe('executing')
      expect(engineer?.status).toBe('completed')
      expect(analyzeComplexity?.status).toBe('pending')
    })

    test('should not update when flow data is not set', () => {
      store.setNodeFlowData(null)

      // エラーが発生しないこと
      expect(() => {
        store.updateNodeFlowStatus('product_owner', 'executing')
      }).not.toThrow()
    })

    test('should handle non-existent node gracefully', () => {
      // 存在しないノードの更新を試みる
      expect(() => {
        store.updateNodeFlowStatus('non_existent', 'executing')
      }).not.toThrow()

      // 他のノードには影響しない
      const node = store.getFlowNode('product_owner')
      expect(node?.status).toBe('pending')
    })
  })

  describe('Node Flow Lifecycle', () => {
    test('should track complete node execution lifecycle', () => {
      const flowData = createTestFlowData()
      store.setNodeFlowData(flowData)

      const startTime = 1000
      const endTime = 6000
      const executionTime = 5000

      // 1. ノードが実行開始
      store.setCurrentExecutingNode('product_owner')
      store.updateNodeFlowStatus('product_owner', 'executing', startTime)

      let node = store.getFlowNode('product_owner')
      expect(node?.status).toBe('executing')
      expect(node?.startedAt).toBe(startTime)
      expect(store.currentExecutingNode).toBe('product_owner')

      // 2. ノードが完了
      store.updateNodeFlowStatus('product_owner', 'completed', endTime, executionTime)
      store.setCurrentExecutingNode(null)

      node = store.getFlowNode('product_owner')
      expect(node?.status).toBe('completed')
      expect(node?.completedAt).toBe(endTime)
      expect(node?.executionTime).toBe(executionTime)
      expect(store.currentExecutingNode).toBeNull()
    })

    test('should track multiple nodes executing in sequence', () => {
      const flowData = createTestFlowData()
      store.setNodeFlowData(flowData)

      // ノード1: 実行 → 完了
      store.updateNodeFlowStatus('analyze_complexity', 'executing', 1000)
      store.updateNodeFlowStatus('analyze_complexity', 'completed', 2000, 1000)

      // ノード2: 実行 → 完了
      store.updateNodeFlowStatus('product_owner', 'executing', 2100)
      store.updateNodeFlowStatus('product_owner', 'completed', 5100, 3000)

      // ノード3: 実行中
      store.updateNodeFlowStatus('engineer', 'executing', 5200)

      const node1 = store.getFlowNode('analyze_complexity')
      const node2 = store.getFlowNode('product_owner')
      const node3 = store.getFlowNode('engineer')

      expect(node1?.status).toBe('completed')
      expect(node1?.executionTime).toBe(1000)

      expect(node2?.status).toBe('completed')
      expect(node2?.executionTime).toBe(3000)

      expect(node3?.status).toBe('executing')
      expect(node3?.completedAt).toBeUndefined()
    })
  })

  describe('Edge Cases', () => {
    test('should handle empty flow data', () => {
      const emptyFlowData: NodeFlowData = {
        nodes: [],
        edges: [],
      }

      store.setNodeFlowData(emptyFlowData)
      expect(store.nodeFlowData?.nodes).toHaveLength(0)
      expect(store.nodeFlowData?.edges).toHaveLength(0)

      const node = store.getFlowNode('any_node')
      expect(node).toBeUndefined()
    })

    test('should handle flow data replacement', () => {
      const flowData1 = createTestFlowData()
      const flowData2: NodeFlowData = {
        nodes: [
          { id: 'node1', type: 'process', label: 'Node 1', status: 'pending' },
        ],
        edges: [],
      }

      store.setNodeFlowData(flowData1)
      expect(store.nodeFlowData?.nodes).toHaveLength(5)

      store.setNodeFlowData(flowData2)
      expect(store.nodeFlowData?.nodes).toHaveLength(1)
      expect(store.getFlowNode('product_owner')).toBeUndefined()
      expect(store.getFlowNode('node1')).toBeDefined()
    })
  })
});
