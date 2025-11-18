/**
 * Tests for PromptPanel chat message display
 *
 * These tests verify that PromptPanel correctly displays
 * chat messages from the appStore.
 */

import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PromptPanel } from '../renderer/components/PromptPanel'
import { useAppStore } from '../renderer/store/appStore'

// Mock electronAPI
const mockElectronAPI = {
  executePrompt: vi.fn(() => Promise.resolve()),
}

// @ts-ignore - Mock window.electronAPI
global.window = global.window || {}
// @ts-ignore
global.window.electronAPI = mockElectronAPI

describe('PromptPanel - chatMessages display', () => {
  beforeEach(() => {
    // Reset store before each test
    const store = useAppStore.getState()
    store.clearChatMessages()
    vi.clearAllMocks()
  })

  describe('Empty state', () => {
    it('should show empty state message when no chat messages exist', () => {
      render(<PromptPanel />)

      expect(screen.getByText('AIエンジニアに指示を送信してください')).toBeTruthy()
      expect(screen.getByText('例: "ユーザー認証機能を実装してください"')).toBeTruthy()
    })
  })

  describe('Message display', () => {
    it('should display user messages with correct styling', () => {
      const store = useAppStore.getState()

      store.addChatMessage({
        id: 'msg-1',
        type: 'user',
        content: 'ユーザー認証を実装してください',
        timestamp: new Date('2025-01-01T12:00:00Z'),
      })

      render(<PromptPanel />)

      expect(screen.getByText('あなた')).toBeTruthy()
      expect(screen.getByText('ユーザー認証を実装してください')).toBeTruthy()
      // Timestamp format varies by locale, so we just check the content exists
    })

    it('should display system messages with correct styling', () => {
      const store = useAppStore.getState()

      store.addChatMessage({
        id: 'msg-1',
        type: 'system',
        content: 'AIエージェントの実行を開始しました',
        timestamp: new Date('2025-01-01T12:00:00Z'),
      })

      render(<PromptPanel />)

      expect(screen.getByText('システム')).toBeTruthy()
      expect(screen.getByText('AIエージェントの実行を開始しました')).toBeTruthy()
    })

    it('should display AI messages with correct styling', () => {
      const store = useAppStore.getState()

      store.addChatMessage({
        id: 'msg-1',
        type: 'ai',
        content: 'タスクの分析を開始します...',
        timestamp: new Date('2025-01-01T12:00:00Z'),
        nodeId: 'ProductOwnerNode',
      })

      render(<PromptPanel />)

      expect(screen.getByText('Product Owner AI')).toBeTruthy()
      expect(screen.getByText('タスクの分析を開始します...')).toBeTruthy()
    })

    it('should display multiple messages in order', () => {
      const store = useAppStore.getState()

      store.addChatMessages([
        {
          id: 'msg-1',
          type: 'user',
          content: 'First message',
          timestamp: new Date('2025-01-01T12:00:00Z'),
        },
        {
          id: 'msg-2',
          type: 'system',
          content: 'Second message',
          timestamp: new Date('2025-01-01T12:01:00Z'),
        },
        {
          id: 'msg-3',
          type: 'ai',
          content: 'Third message',
          timestamp: new Date('2025-01-01T12:02:00Z'),
        },
      ])

      render(<PromptPanel />)

      expect(screen.getByText('First message')).toBeTruthy()
      expect(screen.getByText('Second message')).toBeTruthy()
      expect(screen.getByText('Third message')).toBeTruthy()
    })

    it('should handle multiline message content', () => {
      const store = useAppStore.getState()

      const multilineContent = 'タスクの分析が完了しました。\n\n主なタスク:\n・タスク1\n・タスク2\n・タスク3'

      store.addChatMessage({
        id: 'msg-1',
        type: 'ai',
        content: multilineContent,
        timestamp: new Date(),
      })

      render(<PromptPanel />)

      // Check that key parts of the multiline content are rendered
      expect(screen.getByText(/タスクの分析が完了しました/)).toBeTruthy()
      expect(screen.getByText(/主なタスク/)).toBeTruthy()
      expect(screen.getByText(/タスク1/)).toBeTruthy()
    })

    it('should display message with task results from ProductOwner', () => {
      const store = useAppStore.getState()

      const tasks = [
        { id: '1', title: 'Task 1' },
        { id: '2', title: 'Task 2' },
        { id: '3', title: 'Task 3' },
      ]

      const message = `タスクの分析が完了しました。3個のタスクを作成しました。\n\n主なタスク:\n・Task 1\n・Task 2\n・Task 3`

      store.addChatMessage({
        id: 'msg-1',
        type: 'ai',
        content: message,
        timestamp: new Date(),
        nodeId: 'ProductOwnerNode',
        data: { tasks },
      })

      render(<PromptPanel />)

      expect(screen.getByText(/タスクの分析が完了しました/)).toBeTruthy()
      expect(screen.getByText(/3個のタスクを作成しました/)).toBeTruthy()
      expect(screen.getByText(/Task 1/)).toBeTruthy()
    })
  })

  describe('Complete ProductOwner flow', () => {
    it('should display complete flow: start -> analyze -> complete', () => {
      const store = useAppStore.getState()

      // 1. System message: execution started
      store.addChatMessage({
        id: 'msg-1',
        type: 'system',
        content: 'AIエージェントの実行を開始しました',
        timestamp: new Date(),
      })

      // 2. AI message: ProductOwner starts
      store.addChatMessage({
        id: 'msg-2',
        type: 'ai',
        content: 'タスクの分析を開始します...',
        timestamp: new Date(),
        nodeId: 'ProductOwnerNode',
      })

      // 3. AI message: ProductOwner completes
      store.addChatMessage({
        id: 'msg-3',
        type: 'ai',
        content: 'タスクの分析が完了しました。5個のタスクを作成しました。',
        timestamp: new Date(),
        nodeId: 'ProductOwnerNode',
      })

      render(<PromptPanel />)

      // Verify all messages are displayed
      expect(screen.getByText('AIエージェントの実行を開始しました')).toBeTruthy()
      expect(screen.getByText('タスクの分析を開始します...')).toBeTruthy()
      expect(screen.getByText(/タスクの分析が完了しました/)).toBeTruthy()

      // Verify message types
      expect(screen.getAllByText('システム')).toHaveLength(1)
      expect(screen.getAllByText('Product Owner AI')).toHaveLength(2)
    })
  })
})
