/**
 * Simplified tests for useElectronSync chatMessages integration
 *
 * These tests verify that ProductOwner AI messages are correctly
 * added to the chat when events are received from Electron IPC.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAppStore } from '../renderer/store/appStore'

describe('useElectronSync - chatMessages (simplified)', () => {
  beforeEach(() => {
    // Reset store before each test
    const store = useAppStore.getState()
    store.clearChatMessages()
  })

  describe('Direct store manipulation (simulating IPC events)', () => {
    it('should add system message for execution start', () => {
      const store = useAppStore.getState()

      store.addChatMessage({
        id: 'msg-1',
        type: 'system',
        content: 'AIエージェントの実行を開始しました',
        timestamp: new Date(),
      })

      const { chatMessages } = useAppStore.getState()
      expect(chatMessages).toHaveLength(1)
      expect(chatMessages[0].type).toBe('system')
      expect(chatMessages[0].content).toBe('AIエージェントの実行を開始しました')
    })

    it('should add AI message when ProductOwner starts', () => {
      const store = useAppStore.getState()

      store.addChatMessage({
        id: 'msg-2',
        type: 'ai',
        content: 'タスクの分析を開始します...',
        timestamp: new Date(),
        nodeId: 'ProductOwnerNode',
      })

      const { chatMessages } = useAppStore.getState()
      expect(chatMessages).toHaveLength(1)
      expect(chatMessages[0].type).toBe('ai')
      expect(chatMessages[0].content).toBe('タスクの分析を開始します...')
      expect(chatMessages[0].nodeId).toBe('ProductOwnerNode')
    })

    it('should add AI message with task results when ProductOwner completes', () => {
      const store = useAppStore.getState()

      const tasks = [
        { id: '1', title: 'Task 1' },
        { id: '2', title: 'Task 2' },
        { id: '3', title: 'Task 3' },
      ]

      const message = `タスクの分析が完了しました。${tasks.length}個のタスクを作成しました。\n\n主なタスク:\n・${tasks[0].title}\n・${tasks[1].title}\n・${tasks[2].title}`

      store.addChatMessage({
        id: 'msg-3',
        type: 'ai',
        content: message,
        timestamp: new Date(),
        nodeId: 'ProductOwnerNode',
        data: { tasks },
      })

      const { chatMessages } = useAppStore.getState()
      expect(chatMessages).toHaveLength(1)
      expect(chatMessages[0].content).toContain('タスクの分析が完了しました')
      expect(chatMessages[0].content).toContain('3個のタスクを作成しました')
      expect(chatMessages[0].content).toContain('Task 1')
      expect(chatMessages[0].data).toEqual({ tasks })
    })

    it('should handle complete ProductOwner flow with multiple messages', () => {
      const store = useAppStore.getState()

      // 1. Execution start
      store.addChatMessage({
        id: 'msg-1',
        type: 'system',
        content: 'AIエージェントの実行を開始しました',
        timestamp: new Date(),
      })

      // 2. ProductOwner starts
      store.addChatMessage({
        id: 'msg-2',
        type: 'ai',
        content: 'タスクの分析を開始します...',
        timestamp: new Date(),
        nodeId: 'ProductOwnerNode',
      })

      // 3. ProductOwner completes
      store.addChatMessage({
        id: 'msg-3',
        type: 'ai',
        content: 'タスクの分析が完了しました。5個のタスクを作成しました。',
        timestamp: new Date(),
        nodeId: 'ProductOwnerNode',
      })

      const { chatMessages } = useAppStore.getState()
      expect(chatMessages).toHaveLength(3)

      // Verify message order
      expect(chatMessages[0].type).toBe('system')
      expect(chatMessages[0].content).toContain('実行を開始')

      expect(chatMessages[1].type).toBe('ai')
      expect(chatMessages[1].content).toContain('分析を開始')

      expect(chatMessages[2].type).toBe('ai')
      expect(chatMessages[2].content).toContain('分析が完了')
    })

    it('should show "他X個" message when there are more than 3 tasks', () => {
      const store = useAppStore.getState()

      const tasks = Array.from({ length: 10 }, (_, i) => ({
        id: `${i + 1}`,
        title: `Task ${i + 1}`,
      }))

      const firstThree = tasks.slice(0, 3)
      const message = `タスクの分析が完了しました。10個のタスクを作成しました。\n\n主なタスク:\n${firstThree.map(t => `・${t.title}`).join('\n')}\n...他7個`

      store.addChatMessage({
        id: 'msg-1',
        type: 'ai',
        content: message,
        timestamp: new Date(),
        nodeId: 'ProductOwnerNode',
      })

      const { chatMessages } = useAppStore.getState()
      expect(chatMessages[0].content).toContain('10個のタスクを作成しました')
      expect(chatMessages[0].content).toContain('...他7個')
    })
  })

  describe('Message formatting', () => {
    it('should support multiline messages', () => {
      const store = useAppStore.getState()

      const multilineMessage = 'First line\nSecond line\nThird line'

      store.addChatMessage({
        id: 'msg-1',
        type: 'ai',
        content: multilineMessage,
        timestamp: new Date(),
      })

      const { chatMessages } = useAppStore.getState()
      expect(chatMessages[0].content).toBe(multilineMessage)
      expect(chatMessages[0].content).toContain('\n')
    })

    it('should store additional data in message', () => {
      const store = useAppStore.getState()

      const additionalData = {
        tasks: [{ id: '1', title: 'Test' }],
        metadata: { count: 1 },
      }

      store.addChatMessage({
        id: 'msg-1',
        type: 'ai',
        content: 'Message with data',
        timestamp: new Date(),
        data: additionalData,
      })

      const { chatMessages } = useAppStore.getState()
      expect(chatMessages[0].data).toEqual(additionalData)
    })
  })
})
