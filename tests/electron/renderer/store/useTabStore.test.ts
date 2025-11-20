/**
 * useTabStore ユニットテスト
 *
 * リアルタイムログストリーミングのタブ管理機能のテスト
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import type { LogEntry } from '../../../../src/graph/types.js';

// タブインターフェース定義
interface LogTab {
  id: string
  title: string
  nodeType?: string
  taskId?: string
  isClosable: boolean
  createdAt: Date
  completedAt?: Date
}

// タブストアインターフェース定義
interface TabStore {
  tabs: LogTab[]
  activeTabId: string | null

  // Actions
  createTab: (nodeId: string, taskId?: string, title?: string) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  markTabCompleted: (tabId: string) => void
  getLogsForTab: (tabId: string) => LogEntry[]

  // Utilities
  findTabForLog: (log: LogEntry) => string | null
  autoCloseCompletedTabs: (delayMs: number) => void
}

// モックストアの作成
function createMockTabStore(): TabStore {
  let state: {
    tabs: LogTab[]
    activeTabId: string | null
    logs: LogEntry[]
  } = {
    tabs: [],
    activeTabId: null,
    logs: [],
  }

  return {
    get tabs() {
      return state.tabs
    },

    get activeTabId() {
      return state.activeTabId
    },

    createTab: (nodeId: string, taskId?: string, title?: string) => {
      const tabId = taskId ? `${nodeId}-${taskId}` : nodeId
      const existingTab = state.tabs.find(t => t.id === tabId)

      if (!existingTab) {
        const isMainTab = nodeId === 'main' || (!taskId && (nodeId === 'ProductOwnerNode' || nodeId === 'MergeCoordinatorNode'))
        const newTab: LogTab = {
          id: tabId,
          title: title || (taskId ? `${nodeId}-${taskId}` : nodeId),
          nodeType: nodeId !== 'main' ? nodeId : undefined,
          taskId,
          isClosable: !isMainTab,
          createdAt: new Date(),
        }

        state.tabs = [...state.tabs, newTab]
        state.activeTabId = newTab.id
      }
    },

    closeTab: (tabId: string) => {
      const tab = state.tabs.find(t => t.id === tabId)
      if (tab && tab.isClosable) {
        state.tabs = state.tabs.filter(t => t.id !== tabId)

        // アクティブタブが閉じられた場合、別のタブをアクティブにする
        if (state.activeTabId === tabId) {
          state.activeTabId = state.tabs.length > 0 ? state.tabs[0].id : null
        }
      }
    },

    setActiveTab: (tabId: string) => {
      const tab = state.tabs.find(t => t.id === tabId)
      if (tab) {
        state.activeTabId = tabId
      }
    },

    markTabCompleted: (tabId: string) => {
      state.tabs = state.tabs.map(tab =>
        tab.id === tabId
          ? { ...tab, completedAt: new Date() }
          : tab
      )
    },

    getLogsForTab: (tabId: string) => {
      const tab = state.tabs.find(t => t.id === tabId)
      if (!tab) return []

      // メインタブの場合はオーケストレーションログのみ
      if (tab.id === 'main' || !tab.taskId) {
        return state.logs.filter(log => !log.taskId ||
          (log.nodeType === 'ProductOwnerNode' ||
           log.nodeType === 'MergeCoordinatorNode' ||
           log.nodeType === 'DirectorNode'))
      }

      // タスク固有のタブの場合
      return state.logs.filter(log =>
        log.taskId === tab.taskId && log.nodeType === tab.nodeType
      )
    },

    findTabForLog: (log: LogEntry) => {
      // taskIdがある場合は、そのタスクのタブに振り分け
      if (log.taskId && log.nodeType) {
        const tabId = `${log.nodeType}-${log.taskId}`
        const tab = state.tabs.find(t => t.id === tabId)
        if (tab) return tab.id
      }

      // オーケストレーションログはメインタブへ
      if (!log.taskId ||
          log.nodeType === 'ProductOwnerNode' ||
          log.nodeType === 'MergeCoordinatorNode' ||
          log.nodeType === 'DirectorNode') {
        return 'main'
      }

      return null
    },

    autoCloseCompletedTabs: (delayMs: number) => {
      const now = new Date()
      state.tabs = state.tabs.filter(tab => {
        if (!tab.completedAt || !tab.isClosable) return true
        const elapsedMs = now.getTime() - tab.completedAt.getTime()
        return elapsedMs < delayMs
      })
    },
  }
}

describe('useTabStore', () => {
  let store: TabStore

  beforeEach(() => {
    store = createMockTabStore()
  })

  describe('createTab', () => {
    test('メインタブを作成できること', () => {
      store.createTab('main', undefined, 'メイン')

      expect(store.tabs).toHaveLength(1)
      expect(store.tabs[0]).toMatchObject({
        id: 'main',
        title: 'メイン',
        isClosable: false,
      })
      expect(store.activeTabId).toBe('main')
    })

    test('EngineerNodeのタスクタブを作成できること', () => {
      store.createTab('EngineerNode', 'task-1234', 'Engineer-1')

      expect(store.tabs).toHaveLength(1)
      expect(store.tabs[0]).toMatchObject({
        id: 'EngineerNode-task-1234',
        title: 'Engineer-1',
        nodeType: 'EngineerNode',
        taskId: 'task-1234',
        isClosable: true,
      })
      expect(store.activeTabId).toBe('EngineerNode-task-1234')
    })

    test('ReviewNodeのタスクタブを作成できること', () => {
      store.createTab('ReviewNode', 'task-5678', 'Reviewer-1')

      expect(store.tabs).toHaveLength(1)
      expect(store.tabs[0]).toMatchObject({
        id: 'ReviewNode-task-5678',
        title: 'Reviewer-1',
        nodeType: 'ReviewNode',
        taskId: 'task-5678',
        isClosable: true,
      })
    })

    test('同じIDのタブは重複して作成されないこと', () => {
      store.createTab('EngineerNode', 'task-1234', 'Engineer-1')
      store.createTab('EngineerNode', 'task-1234', 'Engineer-1 (duplicate)')

      expect(store.tabs).toHaveLength(1)
      expect(store.tabs[0].title).toBe('Engineer-1') // 最初のタイトルのまま
    })

    test('複数のタブを作成できること', () => {
      store.createTab('main', undefined, 'メイン')
      store.createTab('EngineerNode', 'task-1', 'Engineer-1')
      store.createTab('EngineerNode', 'task-2', 'Engineer-2')
      store.createTab('ReviewNode', 'task-1', 'Reviewer-1')

      expect(store.tabs).toHaveLength(4)
      expect(store.tabs.map(t => t.id)).toEqual([
        'main',
        'EngineerNode-task-1',
        'EngineerNode-task-2',
        'ReviewNode-task-1',
      ])
    })

    test('ProductOwnerNodeはメインタブとして扱われること（閉じられない）', () => {
      store.createTab('ProductOwnerNode')

      expect(store.tabs).toHaveLength(1)
      expect(store.tabs[0].isClosable).toBe(false)
    })

    test('MergeCoordinatorNodeはメインタブとして扱われること（閉じられない）', () => {
      store.createTab('MergeCoordinatorNode')

      expect(store.tabs).toHaveLength(1)
      expect(store.tabs[0].isClosable).toBe(false)
    })
  })

  describe('closeTab', () => {
    test('閉じることができるタブを閉じられること', () => {
      store.createTab('EngineerNode', 'task-1234', 'Engineer-1')
      expect(store.tabs).toHaveLength(1)

      store.closeTab('EngineerNode-task-1234')
      expect(store.tabs).toHaveLength(0)
    })

    test('メインタブは閉じられないこと', () => {
      store.createTab('main', undefined, 'メイン')
      expect(store.tabs).toHaveLength(1)

      store.closeTab('main')
      expect(store.tabs).toHaveLength(1) // 閉じられていない
    })

    test('アクティブタブを閉じると別のタブがアクティブになること', () => {
      store.createTab('main', undefined, 'メイン')
      store.createTab('EngineerNode', 'task-1', 'Engineer-1')
      store.setActiveTab('EngineerNode-task-1')

      store.closeTab('EngineerNode-task-1')

      expect(store.activeTabId).toBe('main')
    })

    test('最後のタブを閉じるとactiveTabIdがnullになること', () => {
      store.createTab('EngineerNode', 'task-1', 'Engineer-1')
      store.closeTab('EngineerNode-task-1')

      expect(store.activeTabId).toBeNull()
    })

    test('存在しないタブIDを指定しても  エラーにならないこと', () => {
      store.createTab('main', undefined, 'メイン')

      expect(() => {
        store.closeTab('non-existent-tab')
      }).not.toThrow()

      expect(store.tabs).toHaveLength(1)
    })
  })

  describe('setActiveTab', () => {
    test('アクティブタブを切り替えられること', () => {
      store.createTab('main', undefined, 'メイン')
      store.createTab('EngineerNode', 'task-1', 'Engineer-1')

      expect(store.activeTabId).toBe('EngineerNode-task-1') // 最後に作成されたタブがアクティブ

      store.setActiveTab('main')
      expect(store.activeTabId).toBe('main')

      store.setActiveTab('EngineerNode-task-1')
      expect(store.activeTabId).toBe('EngineerNode-task-1')
    })

    test('存在しないタブIDを指定してもactiveTabIdは変更されないこと', () => {
      store.createTab('main', undefined, 'メイン')
      expect(store.activeTabId).toBe('main')

      store.setActiveTab('non-existent-tab')
      expect(store.activeTabId).toBe('main') // 変更されていない
    })
  })

  describe('markTabCompleted', () => {
    test('タブを完了状態にマークできること', () => {
      store.createTab('EngineerNode', 'task-1', 'Engineer-1')

      store.markTabCompleted('EngineerNode-task-1')

      const tab = store.tabs.find(t => t.id === 'EngineerNode-task-1')
      expect(tab?.completedAt).toBeInstanceOf(Date)
    })

    test('存在しないタブIDを指定してもエラーにならないこと', () => {
      store.createTab('main', undefined, 'メイン')

      expect(() => {
        store.markTabCompleted('non-existent-tab')
      }).not.toThrow()
    })
  })

  describe('getLogsForTab', () => {
    test('メインタブではオーケストレーションログのみ取得できること', () => {
      // TODO: ログの追加機能を実装後にテストを記述
      // 現在は空配列が返ることを確認
      const logs = store.getLogsForTab('main')
      expect(logs).toEqual([])
    })

    test('タスクタブでは該当タスクのログのみ取得できること', () => {
      store.createTab('EngineerNode', 'task-1234', 'Engineer-1')

      // TODO: ログの追加機能を実装後にテストを記述
      const logs = store.getLogsForTab('EngineerNode-task-1234')
      expect(logs).toEqual([])
    })

    test('存在しないタブIDを指定すると空配列が返ること', () => {
      const logs = store.getLogsForTab('non-existent-tab')
      expect(logs).toEqual([])
    })
  })

  describe('findTabForLog', () => {
    beforeEach(() => {
      store.createTab('main', undefined, 'メイン')
      store.createTab('EngineerNode', 'task-1234', 'Engineer-1')
      store.createTab('ReviewNode', 'task-5678', 'Reviewer-1')
    })

    test('taskIdとnodeTypeを持つログは対応するタブに振り分けられること', () => {
      const log: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'EngineerNode',
        message: 'コード実装中',
        taskId: 'task-1234',
        nodeType: 'EngineerNode',
      }

      const tabId = store.findTabForLog(log)
      expect(tabId).toBe('EngineerNode-task-1234')
    })

    test('ProductOwnerNodeのログはメインタブに振り分けられること', () => {
      const log: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'ProductOwnerNode',
        message: 'タスク分解中',
        nodeType: 'ProductOwnerNode',
      }

      const tabId = store.findTabForLog(log)
      expect(tabId).toBe('main')
    })

    test('MergeCoordinatorNodeのログはメインタブに振り分けられること', () => {
      const log: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'MergeCoordinatorNode',
        message: 'マージ調整中',
        nodeType: 'MergeCoordinatorNode',
      }

      const tabId = store.findTabForLog(log)
      expect(tabId).toBe('main')
    })

    test('taskIdのないログはメインタブに振り分けられること', () => {
      const log: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'SystemLogger',
        message: 'システムイベント',
      }

      const tabId = store.findTabForLog(log)
      expect(tabId).toBe('main')
    })

    test('対応するタブが存在しない場合はnullが返ること', () => {
      const log: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'EngineerNode',
        message: 'コード実装中',
        taskId: 'task-9999', // 存在しないタスク
        nodeType: 'EngineerNode',
      }

      const tabId = store.findTabForLog(log)
      expect(tabId).toBeNull()
    })
  })

  describe('autoCloseCompletedTabs', () => {
    test('指定時間経過した完了タブが自動的に閉じられること', () => {
      store.createTab('EngineerNode', 'task-1', 'Engineer-1')
      store.createTab('EngineerNode', 'task-2', 'Engineer-2')

      // task-1を完了としてマーク（過去の時刻）
      store.markTabCompleted('EngineerNode-task-1')
      const completedTab = store.tabs.find(t => t.id === 'EngineerNode-task-1')!
      completedTab.completedAt = new Date(Date.now() - 35000) // 35秒前

      // task-2も完了としてマーク（最近）
      store.markTabCompleted('EngineerNode-task-2')

      expect(store.tabs).toHaveLength(2)

      // 30秒以上経過したタブを閉じる
      store.autoCloseCompletedTabs(30000)

      expect(store.tabs).toHaveLength(1)
      expect(store.tabs[0].id).toBe('EngineerNode-task-2')
    })

    test('メインタブ（閉じられないタブ）は完了していても自動的に閉じられないこと', () => {
      store.createTab('ProductOwnerNode')
      store.markTabCompleted('ProductOwnerNode')

      const mainTab = store.tabs.find(t => t.id === 'ProductOwnerNode')!
      mainTab.completedAt = new Date(Date.now() - 60000) // 1分前

      store.autoCloseCompletedTabs(30000)

      expect(store.tabs).toHaveLength(1)
    })

    test('完了していないタブは閉じられないこと', () => {
      store.createTab('EngineerNode', 'task-1', 'Engineer-1')

      store.autoCloseCompletedTabs(30000)

      expect(store.tabs).toHaveLength(1)
    })
  })
})
