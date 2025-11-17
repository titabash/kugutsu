/**
 * StateStreamManager NodeFlow機能のユニットテスト
 *
 * ノードフロー情報の管理と送信のテスト
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import type { BrowserWindow } from 'electron';

// StateStreamManager の型定義
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

interface BufferedEvent {
  type: string
  data: any
  timestamp: number
  priority: 'high' | 'normal' | 'low'
}

// モック StateStreamManager
class MockStateStreamManager {
  private window: any = null
  private nodeFlowData: NodeFlowData | null = null
  private nodeExecutionTimes: Map<string, { startedAt: number; completedAt?: number }> = new Map()
  private buffer: BufferedEvent[] = []

  setWindow(window: any): void {
    this.window = window
  }

  initializeNodeFlow(flowData: NodeFlowData): void {
    if (!this.window) return

    this.nodeFlowData = flowData

    // ノードフロー初期化イベントを送信
    this.addToBuffer({
      type: 'node-flow-init',
      data: flowData,
      timestamp: Date.now(),
      priority: 'high',
    })
  }

  async notifyNodeExecution(
    nodeName: string,
    status: 'started' | 'completed' | 'failed'
  ): Promise<void> {
    if (!this.window) return

    const now = Date.now()

    if (status === 'started') {
      // 実行時間の記録開始
      this.nodeExecutionTimes.set(nodeName, { startedAt: now })

      // ノードフロー状態の更新
      if (this.nodeFlowData) {
        this.updateNodeStatus(nodeName, 'executing', now)
      }

      // Add node-started event to buffer
      this.addToBuffer({
        type: 'node-started',
        data: {
          nodeName,
          timestamp: now,
        },
        timestamp: now,
        priority: 'high',
      })
    } else if (status === 'completed' || status === 'failed') {
      // 実行時間の記録終了
      const timing = this.nodeExecutionTimes.get(nodeName)
      if (timing) {
        timing.completedAt = now
      }

      const executionTime = timing ? now - timing.startedAt : undefined

      // ノードフロー状態の更新
      if (this.nodeFlowData) {
        this.updateNodeStatus(
          nodeName,
          status === 'completed' ? 'completed' : 'failed',
          now,
          executionTime
        )
      }

      // Add node-completed event to buffer
      this.addToBuffer({
        type: 'node-completed',
        data: {
          nodeName,
          status,
          timestamp: now,
          executionTime,
        },
        timestamp: now,
        priority: 'high',
      })
    }
  }

  private updateNodeStatus(
    nodeId: string,
    status: FlowNode['status'],
    timestamp: number,
    executionTime?: number
  ): void {
    if (!this.nodeFlowData) return

    const node = this.nodeFlowData.nodes.find((n) => n.id === nodeId)
    if (!node) return

    // 状態の更新
    const previousStatus = node.status
    node.status = status

    if (status === 'executing') {
      node.startedAt = timestamp
    } else if (status === 'completed' || status === 'failed') {
      node.completedAt = timestamp
      if (executionTime !== undefined) {
        node.executionTime = executionTime
      }
    }

    // 状態変更イベントを送信
    this.addToBuffer({
      type: 'node-status-change',
      data: {
        nodeId,
        status,
        previousStatus,
        timestamp,
        executionTime,
      },
      timestamp,
      priority: 'high',
    })
  }

  getNodeFlowData(): NodeFlowData | null {
    return this.nodeFlowData
  }

  private addToBuffer(event: BufferedEvent): void {
    this.buffer.push(event)
  }

  getBuffer(): BufferedEvent[] {
    return this.buffer
  }

  clearBuffer(): void {
    this.buffer = []
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
        id: 'product_owner',
        type: 'process',
        label: 'Product Owner',
        status: 'pending',
      },
      {
        id: 'engineer',
        type: 'process',
        label: 'Engineer',
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
      { id: 'e1', source: '__start__', target: 'product_owner' },
      { id: 'e2', source: 'product_owner', target: 'engineer' },
      { id: 'e3', source: 'engineer', target: '__end__' },
    ],
  }
}

describe('StateStreamManager - Node Flow', () => {
  let manager: MockStateStreamManager
  let mockWindow: any

  beforeEach(() => {
    manager = new MockStateStreamManager()
    mockWindow = {
      webContents: {
        send: jest.fn(),
      },
      isDestroyed: jest.fn(() => false),
    }
    manager.setWindow(mockWindow)
    manager.clearBuffer()
  })

  describe('initializeNodeFlow', () => {
    test('should initialize node flow data', () => {
      const flowData = createTestFlowData()
      manager.initializeNodeFlow(flowData)

      const storedFlowData = manager.getNodeFlowData()
      expect(storedFlowData).toBe(flowData)
      expect(storedFlowData?.nodes).toHaveLength(4)
      expect(storedFlowData?.edges).toHaveLength(3)
    })

    test('should send node-flow-init event', () => {
      const flowData = createTestFlowData()
      manager.initializeNodeFlow(flowData)

      const buffer = manager.getBuffer()
      const initEvent = buffer.find((e) => e.type === 'node-flow-init')

      expect(initEvent).toBeDefined()
      expect(initEvent?.data).toBe(flowData)
      expect(initEvent?.priority).toBe('high')
    })

    test('should not initialize when window is not set', () => {
      const flowData = createTestFlowData()
      manager.setWindow(null)

      manager.initializeNodeFlow(flowData)

      // ウィンドウがない場合はnodeFlowDataがnullのまま
      const storedFlowData = manager.getNodeFlowData()
      expect(storedFlowData).toBeNull()
    })
  })

  describe('notifyNodeExecution with Node Flow', () => {
    beforeEach(() => {
      const flowData = createTestFlowData()
      manager.initializeNodeFlow(flowData)
      manager.clearBuffer()
    })

    test('should update node status to executing when started', async () => {
      await manager.notifyNodeExecution('product_owner', 'started')

      const flowData = manager.getNodeFlowData()
      const node = flowData?.nodes.find((n) => n.id === 'product_owner')

      expect(node?.status).toBe('executing')
      expect(node?.startedAt).toBeDefined()
      expect(node?.completedAt).toBeUndefined()
    })

    test('should send node-started and node-status-change events', async () => {
      await manager.notifyNodeExecution('product_owner', 'started')

      const buffer = manager.getBuffer()

      const startedEvent = buffer.find((e) => e.type === 'node-started')
      expect(startedEvent).toBeDefined()
      expect(startedEvent?.data.nodeName).toBe('product_owner')

      const statusChangeEvent = buffer.find((e) => e.type === 'node-status-change')
      expect(statusChangeEvent).toBeDefined()
      expect(statusChangeEvent?.data.nodeId).toBe('product_owner')
      expect(statusChangeEvent?.data.status).toBe('executing')
    })

    test('should update node status to completed with execution time', async () => {
      // まず開始
      await manager.notifyNodeExecution('engineer', 'started')

      // 少し待機（実行時間のシミュレーション）
      await new Promise((resolve) => setTimeout(resolve, 10))

      // 完了
      await manager.notifyNodeExecution('engineer', 'completed')

      const flowData = manager.getNodeFlowData()
      const node = flowData?.nodes.find((n) => n.id === 'engineer')

      expect(node?.status).toBe('completed')
      expect(node?.completedAt).toBeDefined()
      expect(node?.executionTime).toBeGreaterThan(0)
    })

    test('should send node-completed event with execution time', async () => {
      await manager.notifyNodeExecution('product_owner', 'started')
      manager.clearBuffer()

      await manager.notifyNodeExecution('product_owner', 'completed')

      const buffer = manager.getBuffer()
      const completedEvent = buffer.find((e) => e.type === 'node-completed')

      expect(completedEvent).toBeDefined()
      expect(completedEvent?.data.nodeName).toBe('product_owner')
      expect(completedEvent?.data.status).toBe('completed')
      expect(completedEvent?.data.executionTime).toBeDefined()
    })

    test('should update node status to failed', async () => {
      await manager.notifyNodeExecution('engineer', 'started')
      await manager.notifyNodeExecution('engineer', 'failed')

      const flowData = manager.getNodeFlowData()
      const node = flowData?.nodes.find((n) => n.id === 'engineer')

      expect(node?.status).toBe('failed')
      expect(node?.completedAt).toBeDefined()
    })

    test('should handle non-existent node gracefully', async () => {
      // 存在しないノードに対してnotifyを呼んでも例外が発生しないこと
      await expect(
        manager.notifyNodeExecution('non_existent', 'started')
      ).resolves.not.toThrow()

      // イベントは送信される（StateStreamManagerの責務はイベント送信）
      const buffer = manager.getBuffer()
      const startedEvent = buffer.find((e) => e.type === 'node-started')
      expect(startedEvent).toBeDefined()
    })
  })

  describe('Node Execution Timing', () => {
    beforeEach(() => {
      const flowData = createTestFlowData()
      manager.initializeNodeFlow(flowData)
      manager.clearBuffer()
    })

    test('should calculate execution time correctly', async () => {
      const startTime = Date.now()

      await manager.notifyNodeExecution('product_owner', 'started')

      // 100ms待機
      await new Promise((resolve) => setTimeout(resolve, 100))

      await manager.notifyNodeExecution('product_owner', 'completed')
      const endTime = Date.now()

      const flowData = manager.getNodeFlowData()
      const node = flowData?.nodes.find((n) => n.id === 'product_owner')

      expect(node?.executionTime).toBeGreaterThanOrEqual(100)
      expect(node?.executionTime).toBeLessThan(endTime - startTime + 50) // 多少のマージン
    })

    test('should track multiple node executions independently', async () => {
      // ノード1の実行
      await manager.notifyNodeExecution('product_owner', 'started')
      await new Promise((resolve) => setTimeout(resolve, 50))
      await manager.notifyNodeExecution('product_owner', 'completed')

      // ノード2の実行
      await manager.notifyNodeExecution('engineer', 'started')
      await new Promise((resolve) => setTimeout(resolve, 100))
      await manager.notifyNodeExecution('engineer', 'completed')

      const flowData = manager.getNodeFlowData()
      const node1 = flowData?.nodes.find((n) => n.id === 'product_owner')
      const node2 = flowData?.nodes.find((n) => n.id === 'engineer')

      // 両方とも実行時間が記録されている
      expect(node1?.executionTime).toBeGreaterThanOrEqual(50)
      expect(node2?.executionTime).toBeGreaterThanOrEqual(100)

      // 実行時間は異なる
      expect(node1?.executionTime).not.toBe(node2?.executionTime)
    })
  })

  describe('Event Priority', () => {
    beforeEach(() => {
      const flowData = createTestFlowData()
      manager.initializeNodeFlow(flowData)
      manager.clearBuffer()
    })

    test('should set high priority for node-flow-init event', () => {
      const flowData = createTestFlowData()
      manager.clearBuffer()
      manager.initializeNodeFlow(flowData)

      const buffer = manager.getBuffer()
      const initEvent = buffer.find((e) => e.type === 'node-flow-init')

      expect(initEvent?.priority).toBe('high')
    })

    test('should set high priority for node-started event', async () => {
      await manager.notifyNodeExecution('product_owner', 'started')

      const buffer = manager.getBuffer()
      const startedEvent = buffer.find((e) => e.type === 'node-started')

      expect(startedEvent?.priority).toBe('high')
    })

    test('should set high priority for node-completed event', async () => {
      await manager.notifyNodeExecution('product_owner', 'started')
      manager.clearBuffer()
      await manager.notifyNodeExecution('product_owner', 'completed')

      const buffer = manager.getBuffer()
      const completedEvent = buffer.find((e) => e.type === 'node-completed')

      expect(completedEvent?.priority).toBe('high')
    })

    test('should set high priority for node-status-change event', async () => {
      await manager.notifyNodeExecution('product_owner', 'started')

      const buffer = manager.getBuffer()
      const statusChangeEvent = buffer.find((e) => e.type === 'node-status-change')

      expect(statusChangeEvent?.priority).toBe('high')
    })
  })

  describe('Integration Scenarios', () => {
    test('should handle complete workflow lifecycle', async () => {
      const flowData = createTestFlowData()
      manager.initializeNodeFlow(flowData)
      manager.clearBuffer()

      // ワークフロー実行のシミュレーション
      await manager.notifyNodeExecution('product_owner', 'started')
      await new Promise((resolve) => setTimeout(resolve, 50))
      await manager.notifyNodeExecution('product_owner', 'completed')

      await manager.notifyNodeExecution('engineer', 'started')
      await new Promise((resolve) => setTimeout(resolve, 100))
      await manager.notifyNodeExecution('engineer', 'completed')

      const nodeFlowData = manager.getNodeFlowData()

      // すべてのノードの状態が正しく更新されていることを確認
      const productOwner = nodeFlowData?.nodes.find((n) => n.id === 'product_owner')
      const engineer = nodeFlowData?.nodes.find((n) => n.id === 'engineer')

      expect(productOwner?.status).toBe('completed')
      expect(productOwner?.executionTime).toBeDefined()

      expect(engineer?.status).toBe('completed')
      expect(engineer?.executionTime).toBeDefined()

      // すべてのイベントが送信されていることを確認
      const buffer = manager.getBuffer()
      expect(buffer.length).toBeGreaterThan(0)
    })
  })
});
