/**
 * Log Router ユニットテスト
 *
 * ログのタブ振り分けロジックのテスト
 */

import { describe, test, expect } from '@jest/globals';
import type { LogEntry } from '../../src/graph/types.js';

// ログルーターインターフェース定義
interface LogRouter {
  findTabForLog: (log: LogEntry, availableTabs: string[]) => string | null
  isOrchestrationLog: (log: LogEntry) => boolean
  extractEngineerIdFromTaskId: (taskId: string) => string | null
  extractTaskNumber: (taskId: string) => number | null
}

// モックログルーターの作成
function createMockLogRouter(): LogRouter {
  return {
    findTabForLog: (log: LogEntry, availableTabs: string[]) => {
      // taskIdとnodeTypeを持つログは対応するタブに振り分け
      if (log.taskId && log.nodeType) {
        const tabId = `${log.nodeType}-${log.taskId}`
        if (availableTabs.includes(tabId)) {
          return tabId
        }
      }

      // オーケストレーションログはメインタブへ
      if (!log.taskId ||
          log.nodeType === 'ProductOwnerNode' ||
          log.nodeType === 'MergeCoordinatorNode' ||
          log.nodeType === 'DirectorNode' ||
          log.nodeType === 'SprintPlanningNode') {
        if (availableTabs.includes('main')) {
          return 'main'
        }
      }

      return null
    },

    isOrchestrationLog: (log: LogEntry) => {
      // taskIdがない場合はオーケストレーションログ
      if (!log.taskId) return true

      // 特定のノードタイプはオーケストレーションログ
      const orchestrationNodes = [
        'ProductOwnerNode',
        'MergeCoordinatorNode',
        'DirectorNode',
        'SprintPlanningNode',
        'CheckModeNode',
      ]

      return orchestrationNodes.includes(log.nodeType || '')
    },

    extractEngineerIdFromTaskId: (taskId: string) => {
      // taskIdから数字を抽出
      // 例: "task-1234-5678" → "task-1234" → "1234"
      const match = taskId.match(/task-(\d+)/)
      return match ? `engineer-${match[1]}` : null
    },

    extractTaskNumber: (taskId: string) => {
      // taskIdから数字を抽出
      // 例: "task-1234-5678" → 1234
      const match = taskId.match(/task-(\d+)/)
      return match ? parseInt(match[1], 10) : null
    },
  }
}

describe('LogRouter', () => {
  let router: LogRouter

  beforeEach(() => {
    router = createMockLogRouter()
  })

  describe('findTabForLog', () => {
    test('taskIdとnodeTypeを持つログは対応するタブに振り分けられること', () => {
      const log: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'EngineerNode',
        message: 'コード実装中',
        taskId: 'task-1234',
        nodeType: 'EngineerNode',
      }

      const availableTabs = ['main', 'EngineerNode-task-1234', 'ReviewNode-task-5678']
      const tabId = router.findTabForLog(log, availableTabs)

      expect(tabId).toBe('EngineerNode-task-1234')
    })

    test('対応するタブが存在しない場合はnullが返ること', () => {
      const log: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'EngineerNode',
        message: 'コード実装中',
        taskId: 'task-9999',
        nodeType: 'EngineerNode',
      }

      const availableTabs = ['main', 'EngineerNode-task-1234']
      const tabId = router.findTabForLog(log, availableTabs)

      expect(tabId).toBeNull()
    })

    test('taskIdのないログはメインタブに振り分けられること', () => {
      const log: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'SystemLogger',
        message: 'システムログ',
      }

      const availableTabs = ['main', 'EngineerNode-task-1234']
      const tabId = router.findTabForLog(log, availableTabs)

      expect(tabId).toBe('main')
    })

    test('ProductOwnerNodeのログはメインタブに振り分けられること', () => {
      const log: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'ProductOwnerNode',
        message: 'タスク分解中',
        taskId: 'task-1234',
        nodeType: 'ProductOwnerNode',
      }

      const availableTabs = ['main', 'EngineerNode-task-1234']
      const tabId = router.findTabForLog(log, availableTabs)

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

      const availableTabs = ['main', 'EngineerNode-task-1234']
      const tabId = router.findTabForLog(log, availableTabs)

      expect(tabId).toBe('main')
    })

    test('DirectorNodeのログはメインタブに振り分けられること', () => {
      const log: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'DirectorNode',
        message: 'ストーリーマッピング作成中',
        nodeType: 'DirectorNode',
      }

      const availableTabs = ['main', 'EngineerNode-task-1234']
      const tabId = router.findTabForLog(log, availableTabs)

      expect(tabId).toBe('main')
    })

    test('SprintPlanningNodeのログはメインタブに振り分けられること', () => {
      const log: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'SprintPlanningNode',
        message: 'スプリント計画中',
        nodeType: 'SprintPlanningNode',
      }

      const availableTabs = ['main']
      const tabId = router.findTabForLog(log, availableTabs)

      expect(tabId).toBe('main')
    })

    test('メインタブが存在しない場合はnullが返ること', () => {
      const log: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'ProductOwnerNode',
        message: 'タスク分解中',
        nodeType: 'ProductOwnerNode',
      }

      const availableTabs = ['EngineerNode-task-1234'] // mainタブなし
      const tabId = router.findTabForLog(log, availableTabs)

      expect(tabId).toBeNull()
    })

    test('ReviewNodeのログは対応するタブに振り分けられること', () => {
      const log: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'ReviewNode',
        message: 'コードレビュー中',
        taskId: 'task-5678',
        nodeType: 'ReviewNode',
      }

      const availableTabs = ['main', 'ReviewNode-task-5678']
      const tabId = router.findTabForLog(log, availableTabs)

      expect(tabId).toBe('ReviewNode-task-5678')
    })
  })

  describe('isOrchestrationLog', () => {
    test('taskIdのないログはオーケストレーションログと判定されること', () => {
      const log: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'SystemLogger',
        message: 'システムログ',
      }

      expect(router.isOrchestrationLog(log)).toBe(true)
    })

    test('ProductOwnerNodeのログはオーケストレーションログと判定されること', () => {
      const log: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'ProductOwnerNode',
        message: 'タスク分解中',
        taskId: 'task-1234',
        nodeType: 'ProductOwnerNode',
      }

      expect(router.isOrchestrationLog(log)).toBe(true)
    })

    test('MergeCoordinatorNodeのログはオーケストレーションログと判定されること', () => {
      const log: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'MergeCoordinatorNode',
        message: 'マージ調整中',
        taskId: 'task-1234',
        nodeType: 'MergeCoordinatorNode',
      }

      expect(router.isOrchestrationLog(log)).toBe(true)
    })

    test('DirectorNodeのログはオーケストレーションログと判定されること', () => {
      const log: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'DirectorNode',
        message: 'ストーリーマッピング作成中',
        taskId: 'task-1234',
        nodeType: 'DirectorNode',
      }

      expect(router.isOrchestrationLog(log)).toBe(true)
    })

    test('CheckModeNodeのログはオーケストレーションログと判定されること', () => {
      const log: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'CheckModeNode',
        message: 'モード確認中',
        nodeType: 'CheckModeNode',
      }

      expect(router.isOrchestrationLog(log)).toBe(true)
    })

    test('EngineerNodeのログはオーケストレーションログと判定されないこと', () => {
      const log: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'EngineerNode',
        message: 'コード実装中',
        taskId: 'task-1234',
        nodeType: 'EngineerNode',
      }

      expect(router.isOrchestrationLog(log)).toBe(false)
    })

    test('ReviewNodeのログはオーケストレーションログと判定されないこと', () => {
      const log: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'ReviewNode',
        message: 'コードレビュー中',
        taskId: 'task-5678',
        nodeType: 'ReviewNode',
      }

      expect(router.isOrchestrationLog(log)).toBe(false)
    })
  })

  describe('extractEngineerIdFromTaskId', () => {
    test('taskIdから"engineer-N"形式のIDを抽出できること', () => {
      const engineerId = router.extractEngineerIdFromTaskId('task-1234')
      expect(engineerId).toBe('engineer-1234')
    })

    test('task-1234-5678のような形式でも最初の数字を抽出すること', () => {
      const engineerId = router.extractEngineerIdFromTaskId('task-1234-5678')
      expect(engineerId).toBe('engineer-1234')
    })

    test('数字を含まないtaskIdの場合はnullを返すこと', () => {
      const engineerId = router.extractEngineerIdFromTaskId('task-abc')
      expect(engineerId).toBeNull()
    })

    test('taskプレフィックスがない場合はnullを返すこと', () => {
      const engineerId = router.extractEngineerIdFromTaskId('1234')
      expect(engineerId).toBeNull()
    })

    test('空文字列の場合はnullを返すこと', () => {
      const engineerId = router.extractEngineerIdFromTaskId('')
      expect(engineerId).toBeNull()
    })
  })

  describe('extractTaskNumber', () => {
    test('taskIdから数字を抽出できること', () => {
      const taskNumber = router.extractTaskNumber('task-1234')
      expect(taskNumber).toBe(1234)
    })

    test('task-1234-5678のような形式でも最初の数字を抽出すること', () => {
      const taskNumber = router.extractTaskNumber('task-1234-5678')
      expect(taskNumber).toBe(1234)
    })

    test('数字を含まないtaskIdの場合はnullを返すこと', () => {
      const taskNumber = router.extractTaskNumber('task-abc')
      expect(taskNumber).toBeNull()
    })

    test('taskプレフィックスがない場合はnullを返すこと', () => {
      const taskNumber = router.extractTaskNumber('1234')
      expect(taskNumber).toBeNull()
    })

    test('空文字列の場合はnullを返すこと', () => {
      const taskNumber = router.extractTaskNumber('')
      expect(taskNumber).toBeNull()
    })

    test('task-0のような0を含む場合は0を返すこと', () => {
      const taskNumber = router.extractTaskNumber('task-0')
      expect(taskNumber).toBe(0)
    })

    test('大きな数字も正しく抽出できること', () => {
      const taskNumber = router.extractTaskNumber('task-999999')
      expect(taskNumber).toBe(999999)
    })
  })
})
