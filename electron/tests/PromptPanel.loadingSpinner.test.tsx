/**
 * Tests for PromptPanel loading spinner
 *
 * These tests verify that a loading spinner is displayed
 * when AI execution is in progress.
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

describe('PromptPanel - loading spinner', () => {
  beforeEach(() => {
    const store = useAppStore.getState()
    store.clearChatMessages()
    store.setMetadata({ isRunning: false })
    vi.clearAllMocks()
  })

  describe('Loading spinner display', () => {
    it('should show loading spinner when execution is running', () => {
      const store = useAppStore.getState()

      // Set execution as running
      store.setMetadata({ isRunning: true })
      store.startExecution()

      const { container } = render(<PromptPanel />)

      // Check for loading spinner element
      const spinner = container.querySelector('[data-loading-spinner="true"]')
      expect(spinner).toBeTruthy()
    })

    it('should not show loading spinner when execution is idle', () => {
      const store = useAppStore.getState()

      // Ensure execution is not running
      store.setMetadata({ isRunning: false })
      store.stopExecution()

      const { container } = render(<PromptPanel />)

      // Check that loading spinner is not present
      const spinner = container.querySelector('[data-loading-spinner="true"]')
      expect(spinner).toBeNull()
    })

    it('should show loading spinner above input area', () => {
      const store = useAppStore.getState()

      store.setMetadata({ isRunning: true })
      store.startExecution()

      const { container } = render(<PromptPanel />)

      const spinner = container.querySelector('[data-loading-spinner="true"]')
      expect(spinner).toBeTruthy()

      // Spinner should be visible (not display: none)
      const spinnerElement = spinner as HTMLElement
      expect(spinnerElement.style.display).not.toBe('none')
    })

    it('should update spinner text based on current node', () => {
      const store = useAppStore.getState()

      store.setMetadata({ isRunning: true })
      store.startExecution()
      store.setThinkingMessage('ProductOwnerNode', 'Product Owner', 'タスクを分析中...')

      const { container } = render(<PromptPanel />)

      // Should show the current executing node info in the loading spinner
      const spinner = container.querySelector('[data-loading-spinner="true"]')
      expect(spinner).toBeTruthy()
      expect(spinner?.textContent).toContain('Product Owner')
      expect(spinner?.textContent).toContain('タスクを分析中')
    })
  })

  describe('Loading spinner with multiple nodes', () => {
    it('should show all active nodes in loading state', () => {
      const store = useAppStore.getState()

      store.setMetadata({ isRunning: true })
      store.startExecution()
      store.setThinkingMessage('ProductOwnerNode', 'Product Owner', 'タスクを分析中...')
      store.setThinkingMessage('EngineerNode', 'Engineer', 'コードを実装中...')

      const { container } = render(<PromptPanel />)

      // Both nodes should be visible as thinking in the loading spinner
      const spinner = container.querySelector('[data-loading-spinner="true"]')
      expect(spinner).toBeTruthy()
      expect(spinner?.textContent).toContain('Product Owner')
      expect(spinner?.textContent).toContain('Engineer')
    })
  })

  describe('Loading spinner animations', () => {
    it('should have spinning animation when active', () => {
      const store = useAppStore.getState()

      store.setMetadata({ isRunning: true })
      store.startExecution()

      const { container } = render(<PromptPanel />)

      const spinner = container.querySelector('[data-loading-spinner="true"]')
      expect(spinner).toBeTruthy()

      // Check for animation class
      const spinnerElement = spinner as HTMLElement
      expect(
        spinnerElement.className.includes('animate-spin') ||
        spinnerElement.querySelector('.animate-spin')
      ).toBeTruthy()
    })
  })
})
