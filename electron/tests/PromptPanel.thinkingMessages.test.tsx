/**
 * Tests for PromptPanel thinking messages and streaming display
 *
 * These tests verify:
 * - Thinking message display (e.g., "ProductOwner: タスクを分析中...")
 * - Streaming message display with visual indicators
 * - Transition from thinking to final message
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

describe('PromptPanel - thinking messages and streaming', () => {
  beforeEach(() => {
    const store = useAppStore.getState()
    store.clearChatMessages()
    vi.clearAllMocks()
  })

  describe('Thinking message display', () => {
    it('should display thinking message with animation', () => {
      const store = useAppStore.getState()

      store.setThinkingMessage('ProductOwnerNode', 'Product Owner', 'タスクを分析中...')

      render(<PromptPanel />)

      expect(screen.getByText(/Product Owner: タスクを分析中/)).toBeTruthy()
      expect(screen.getByText('Product Owner AI')).toBeTruthy()
    })

    it('should show multiple thinking messages for different nodes', () => {
      const store = useAppStore.getState()

      store.setThinkingMessage('ProductOwnerNode', 'Product Owner', 'タスクを分析中...')
      store.setThinkingMessage('EngineerNode', 'Engineer', 'コードを実装中...')

      render(<PromptPanel />)

      expect(screen.getByText(/Product Owner: タスクを分析中/)).toBeTruthy()
      expect(screen.getByText(/Engineer: コードを実装中/)).toBeTruthy()
    })

    it('should display thinking message with special styling', () => {
      const store = useAppStore.getState()

      store.setThinkingMessage('ProductOwnerNode', 'Product Owner', 'タスクを分析中...')

      const { container } = render(<PromptPanel />)

      // Thinking messages should have a special class or attribute
      const thinkingMessages = container.querySelectorAll('[data-thinking="true"]')
      expect(thinkingMessages.length).toBeGreaterThan(0)
    })
  })

  describe('Streaming message display', () => {
    it('should display streaming message', () => {
      const store = useAppStore.getState()

      store.addChatMessage({
        id: 'stream-1',
        type: 'ai',
        content: 'タスクの分析が',
        timestamp: new Date(),
        isStreaming: true,
        nodeId: 'ProductOwnerNode',
      })

      render(<PromptPanel />)

      expect(screen.getByText(/タスクの分析が/)).toBeTruthy()
    })

    it('should show streaming indicator for streaming messages', () => {
      const store = useAppStore.getState()

      store.addChatMessage({
        id: 'stream-1',
        type: 'ai',
        content: 'タスクの分析が',
        timestamp: new Date(),
        isStreaming: true,
      })

      const { container } = render(<PromptPanel />)

      // Streaming messages should have a special indicator
      const streamingIndicators = container.querySelectorAll('[data-streaming="true"]')
      expect(streamingIndicators.length).toBeGreaterThan(0)
    })

    it('should update streaming message content in real-time', () => {
      const store = useAppStore.getState()

      store.addChatMessage({
        id: 'stream-1',
        type: 'ai',
        content: 'タスクの',
        timestamp: new Date(),
        isStreaming: true,
      })

      const { rerender } = render(<PromptPanel />)
      expect(screen.getByText(/タスクの/)).toBeTruthy()

      // Update content
      store.updateChatMessage('stream-1', {
        content: 'タスクの分析が完了しました',
      })

      rerender(<PromptPanel />)
      expect(screen.getByText(/タスクの分析が完了しました/)).toBeTruthy()
    })

    it('should remove streaming indicator when message is complete', () => {
      const store = useAppStore.getState()

      store.addChatMessage({
        id: 'stream-1',
        type: 'ai',
        content: 'タスクの分析が完了しました',
        timestamp: new Date(),
        isStreaming: true,
      })

      const { container, rerender } = render(<PromptPanel />)

      // Initially streaming
      let streamingIndicators = container.querySelectorAll('[data-streaming="true"]')
      expect(streamingIndicators.length).toBeGreaterThan(0)

      // Finalize
      store.updateChatMessage('stream-1', {
        isStreaming: false,
      })

      rerender(<PromptPanel />)

      // No longer streaming
      streamingIndicators = container.querySelectorAll('[data-streaming="true"]')
      expect(streamingIndicators.length).toBe(0)
    })
  })

  describe('Thinking to streaming to final flow', () => {
    it('should show complete flow: thinking → streaming → final', () => {
      const store = useAppStore.getState()

      // 1. Thinking
      store.setThinkingMessage('ProductOwnerNode', 'Product Owner', 'タスクを分析中...')

      const { rerender } = render(<PromptPanel />)
      expect(screen.getByText(/タスクを分析中/)).toBeTruthy()

      // 2. Start streaming (clear thinking first)
      store.clearThinkingMessage('ProductOwnerNode')
      store.addChatMessage({
        id: 'final-1',
        type: 'ai',
        content: 'タスクの',
        timestamp: new Date(),
        isStreaming: true,
        nodeId: 'ProductOwnerNode',
      })

      rerender(<PromptPanel />)
      expect(screen.getByText(/タスクの/)).toBeTruthy()

      // 3. Continue streaming
      store.updateChatMessage('final-1', {
        content: 'タスクの分析が完了しました。',
      })

      rerender(<PromptPanel />)
      expect(screen.getByText(/タスクの分析が完了しました/)).toBeTruthy()

      // 4. Finalize
      store.updateChatMessage('final-1', {
        isStreaming: false,
      })

      rerender(<PromptPanel />)
      expect(screen.getByText(/タスクの分析が完了しました/)).toBeTruthy()
    })

    it('should not show thinking message when streaming starts', () => {
      const store = useAppStore.getState()

      store.setThinkingMessage('ProductOwnerNode', 'Product Owner', 'タスクを分析中...')
      const { rerender } = render(<PromptPanel />)

      // Clear thinking and start streaming
      store.clearThinkingMessage('ProductOwnerNode')
      store.addChatMessage({
        id: 'final-1',
        type: 'ai',
        content: 'タスクの分析が完了しました。',
        timestamp: new Date(),
        isStreaming: true,
        nodeId: 'ProductOwnerNode',
      })

      rerender(<PromptPanel />)

      // Thinking message should not be present
      expect(screen.queryByText(/タスクを分析中/)).toBeNull()
    })
  })
})
