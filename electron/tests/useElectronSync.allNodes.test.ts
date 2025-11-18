/**
 * Tests for useElectronSync - All important nodes status display
 *
 * These tests verify that all important nodes show their status
 * in the chat panel in real-time.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useElectronSync } from '../renderer/hooks/useElectronSync'
import { useAppStore } from '../renderer/store/appStore'

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}))

describe('useElectronSync - All important nodes', () => {
  let mockElectronAPI: any
  let graphEventsBatchCallback: ((events: any[]) => void) | null = null

  beforeEach(() => {
    // Reset store
    const store = useAppStore.getState()
    store.clearChatMessages()

    // Mock window.electronAPI
    graphEventsBatchCallback = null
    mockElectronAPI = {
      onGraphEventsBatch: vi.fn((callback) => {
        graphEventsBatchCallback = callback
        return () => {
          graphEventsBatchCallback = null
        }
      }),
      onInitialDataLoaded: vi.fn(() => () => {}),
      onFileChanged: vi.fn(() => () => {}),
      onNodeFlowInit: vi.fn(() => () => {}),
      onNodeStatusChange: vi.fn(() => () => {}),
      getGraphState: vi.fn(() => Promise.resolve(null)),
    }

    // @ts-ignore - Mock window.electronAPI
    global.window = global.window || {}
    // @ts-ignore
    global.window.electronAPI = mockElectronAPI
  })

  const importantNodes = [
    { id: 'ProductOwnerNode', label: 'Product Owner', message: 'タスクを分析中...' },
    { id: 'EngineerNode', label: 'Engineer', message: 'コードを実装中...' },
    { id: 'ReviewNode', label: 'Tech Lead', message: 'コードをレビュー中...' },
    { id: 'DirectorNode', label: 'Director', message: 'ストーリーマッピングを作成中...' },
    { id: 'SprintPlanningNode', label: 'Sprint Planning', message: 'スプリント計画中...' },
    { id: 'MergeCoordinatorNode', label: 'Merge Coordinator', message: 'マージを調整中...' },
    { id: 'TechLeadDesignNode', label: 'Tech Lead', message: '設計をレビュー中...' },
  ]

  describe('Important nodes should show status', () => {
    importantNodes.forEach(({ id, label, message }) => {
      it(`should show thinking message for ${id}`, async () => {
        renderHook(() => useElectronSync())

        const event = {
          type: 'node-started',
          timestamp: Date.now(),
          data: {
            nodeId: id,
          },
        }

        graphEventsBatchCallback!([event])

        await waitFor(() => {
          const { chatMessages } = useAppStore.getState()
          expect(chatMessages).toHaveLength(1)
          expect(chatMessages[0].type).toBe('ai')
          expect(chatMessages[0].content).toContain(label)
          expect(chatMessages[0].content).toContain(message)
          expect(chatMessages[0].isThinking).toBe(true)
          expect(chatMessages[0].nodeId).toBe(id)
        })
      })
    })
  })

  describe('Unimportant nodes should not show status', () => {
    const unimportantNodes = [
      'TaskBreakdownNode',
      'InstructionGeneratorNode',
      'CheckModeNode',
      'ConflictResolverNode',
    ]

    unimportantNodes.forEach((nodeId) => {
      it(`should not show message for ${nodeId}`, async () => {
        renderHook(() => useElectronSync())

        const event = {
          type: 'node-started',
          timestamp: Date.now(),
          data: {
            nodeId,
          },
        }

        graphEventsBatchCallback!([event])

        await waitFor(() => {
          const { chatMessages } = useAppStore.getState()
          // Only log entries should be added, not chat messages
          expect(chatMessages).toHaveLength(0)
        }, { timeout: 500 })
      })
    })
  })

  describe('Multiple nodes running concurrently', () => {
    it('should show all important nodes thinking messages', async () => {
      renderHook(() => useElectronSync())

      // Start ProductOwner
      graphEventsBatchCallback!([
        {
          type: 'node-started',
          timestamp: Date.now(),
          data: { nodeId: 'ProductOwnerNode' },
        },
      ])

      // Start Engineer (before ProductOwner completes)
      graphEventsBatchCallback!([
        {
          type: 'node-started',
          timestamp: Date.now() + 100,
          data: { nodeId: 'EngineerNode' },
        },
      ])

      // Start Review
      graphEventsBatchCallback!([
        {
          type: 'node-started',
          timestamp: Date.now() + 200,
          data: { nodeId: 'ReviewNode' },
        },
      ])

      await waitFor(() => {
        const { chatMessages } = useAppStore.getState()
        expect(chatMessages).toHaveLength(3)

        expect(chatMessages[0].content).toContain('Product Owner')
        expect(chatMessages[1].content).toContain('Engineer')
        expect(chatMessages[2].content).toContain('Tech Lead')

        // All should be thinking
        expect(chatMessages.every(msg => msg.isThinking)).toBe(true)
      })
    })

    it('should clear thinking message when node completes', async () => {
      renderHook(() => useElectronSync())

      // Start ProductOwner
      graphEventsBatchCallback!([
        {
          type: 'node-started',
          timestamp: Date.now(),
          data: { nodeId: 'ProductOwnerNode' },
        },
      ])

      await waitFor(() => {
        const { chatMessages } = useAppStore.getState()
        expect(chatMessages).toHaveLength(1)
        expect(chatMessages[0].isThinking).toBe(true)
      })

      // Complete ProductOwner
      graphEventsBatchCallback!([
        {
          type: 'node-completed',
          timestamp: Date.now() + 1000,
          data: {
            nodeId: 'ProductOwnerNode',
            result: {
              tasks: [{ id: '1', title: 'Task 1' }],
            },
          },
        },
      ])

      await waitFor(() => {
        const { chatMessages } = useAppStore.getState()
        // Thinking message cleared, completion message added
        expect(chatMessages).toHaveLength(1)
        expect(chatMessages[0].isThinking).toBeUndefined()
        expect(chatMessages[0].content).toContain('完了')
      })
    })
  })
})
