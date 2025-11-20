import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { useTabStore } from '../store/useTabStore'
import type { Task, LogEntry } from '../types'
import { toast } from '@/hooks/use-toast'
import { generateTabTitle } from '../utils/logRouter'

/**
 * Important nodes that should show thinking messages in the chat
 */
const IMPORTANT_NODES: Record<string, { label: string; message: string }> = {
  ProductOwnerNode: { label: 'Product Owner', message: 'タスクを分析中...' },
  EngineerNode: { label: 'Engineer', message: 'コードを実装中...' },
  ReviewNode: { label: 'Tech Lead', message: 'コードをレビュー中...' },
  DirectorNode: { label: 'Director', message: 'ストーリーマッピングを作成中...' },
  SprintPlanningNode: { label: 'Sprint Planning', message: 'スプリント計画中...' },
  MergeCoordinatorNode: { label: 'Merge Coordinator', message: 'マージを調整中...' },
  TechLeadDesignNode: { label: 'Tech Lead', message: '設計をレビュー中...' },
}

/**
 * Synchronize Electron IPC events with Zustand store
 *
 * This hook sets up listeners for all Electron IPC events and updates
 * the app store accordingly, providing real-time UI updates
 */
export function useElectronSync() {
  const {
    addLog,
    addLogs,
    setTasks,
    setMetadata,
    updateTasks,
    addNodeExecution,
    updateNodeExecution,
    clearNodeExecutions,
    setDependencyGraph,
    setStoryMapping,
    setSprints,
    setNodeFlowData,
    setCurrentExecutingNode,
    updateNodeFlowStatus,
    startExecution,
    stopExecution,
    setCurrentPhase,
    addChatMessage,
    addChatMessages,
    updateChatMessage,
    setThinkingMessage,
    clearThinkingMessage,
  } = useAppStore()

  const { createTab, markTabCompleted } = useTabStore()

  useEffect(() => {
    if (!window.electronAPI) {
      console.warn('[useElectronSync] electronAPI not available')
      return
    }

    console.log('[useElectronSync] Setting up Electron IPC listeners')

    // ==========================================
    // NEW: Graph Events Batch Handler (LangGraph)
    // ==========================================

    const handleGraphEventsBatch = (events: any[]) => {
      if (!events || events.length === 0) return

      console.log(`[useElectronSync] Received ${events.length} graph events`)

      events.forEach((event) => {
        switch (event.type) {
          case 'state-init':
            // Initial state - set all data
            startExecution()

            // Create main tab for orchestration logs
            createTab('main', undefined, 'メイン')

            if (event.data.tasks) {
              setTasks(event.data.tasks)
            }
            if (event.data.logs) {
              addLogs(event.data.logs)
            }
            if (event.data.metadata) {
              setMetadata({
                phase: event.data.metadata.phase,
                totalTasks: event.data.metadata.totalTasks,
                tasksCompleted: event.data.metadata.tasksCompleted,
                tasksFailed: event.data.metadata.tasksFailed,
                hasErrors: event.data.metadata.hasErrors,
                startedAt: event.data.metadata.startedAt
                  ? new Date(event.data.metadata.startedAt)
                  : undefined,
              })

              if (event.data.metadata.phase) {
                setCurrentPhase(event.data.metadata.phase)
              }
            }

            // Add system message to chat
            addChatMessage({
              id: `${Date.now()}-${Math.random()}`,
              type: 'system',
              content: 'AIエージェントの実行を開始しました',
              timestamp: new Date(event.timestamp),
            })

            toast({
              title: 'AI実行開始',
              description: 'AIエージェントの実行を開始しました',
            })
            break

          case 'node-started':
            // Node execution started
            if (event.data.nodeId) {
              addNodeExecution({
                nodeName: event.data.nodeId,
                status: 'started',
                startedAt: new Date(event.timestamp),
              })

              // Create tab for task-specific nodes (EngineerNode, ReviewNode)
              const taskId = event.data.taskId
              if (taskId && (event.data.nodeId === 'EngineerNode' || event.data.nodeId === 'ReviewNode')) {
                const title = generateTabTitle(event.data.nodeId, taskId)
                createTab(event.data.nodeId, taskId, title)
              }

              addLog({
                id: `${Date.now()}-${Math.random()}`,
                timestamp: new Date(event.timestamp),
                level: 'info',
                source: event.data.nodeId,
                message: `🚀 ノード開始: ${event.data.nodeId}`,
              })

              // Show thinking message for important nodes
              const nodeInfo = IMPORTANT_NODES[event.data.nodeId]
              if (nodeInfo) {
                setThinkingMessage(event.data.nodeId, nodeInfo.label, nodeInfo.message)
              }
            }
            break

          case 'node-completed':
            // Node execution completed
            if (event.data.nodeId) {
              const startedAt = event.data.startedAt
                ? new Date(event.data.startedAt)
                : undefined
              const completedAt = new Date(event.timestamp)
              const duration = startedAt
                ? completedAt.getTime() - startedAt.getTime()
                : undefined

              updateNodeExecution(event.data.nodeId, {
                status: 'completed',
                completedAt,
                duration,
              })

              // Mark tab as completed for task-specific nodes
              const taskId = event.data.taskId
              if (taskId && (event.data.nodeId === 'EngineerNode' || event.data.nodeId === 'ReviewNode')) {
                const tabId = `${event.data.nodeId}-${taskId}`
                markTabCompleted(tabId)
              }

              addLog({
                id: `${Date.now()}-${Math.random()}`,
                timestamp: completedAt,
                level: 'success',
                source: event.data.nodeId,
                message: `✅ ノード完了: ${event.data.nodeId}${
                  duration ? ` (${(duration / 1000).toFixed(1)}s)` : ''
                }`,
              })

              // Process AI messages if available
              if (event.data.aiMessages && Array.isArray(event.data.aiMessages)) {
                // Clear thinking message first
                clearThinkingMessage(event.data.nodeId)

                // Display each AI message in chat
                event.data.aiMessages.forEach((msg: any) => {
                  if (msg.type === 'assistant' && msg.content) {
                    // Extract text content from assistant messages
                    const textBlocks = msg.content
                      .filter((block: any) => block.type === 'text')
                      .map((block: any) => block.text)
                      .join('\n\n')

                    if (textBlocks) {
                      addChatMessage({
                        id: `${Date.now()}-${Math.random()}`,
                        type: 'ai',
                        content: textBlocks,
                        timestamp: completedAt,
                        nodeId: event.data.nodeId,
                      })
                    }

                    // Display tool use as separate messages
                    const toolUses = msg.content.filter((block: any) => block.type === 'tool_use')
                    toolUses.forEach((toolUse: any) => {
                      addChatMessage({
                        id: `${Date.now()}-${Math.random()}`,
                        type: 'ai',
                        content: `🔧 Tool: ${toolUse.name}\n${JSON.stringify(toolUse.input, null, 2)}`,
                        timestamp: completedAt,
                        nodeId: event.data.nodeId,
                      })
                    })
                  } else if (msg.type === 'thinking') {
                    // Display thinking messages
                    const thinkingText = msg.content || msg.thinking || ''
                    if (thinkingText) {
                      addChatMessage({
                        id: `${Date.now()}-${Math.random()}`,
                        type: 'system',
                        content: `💭 Thinking: ${thinkingText}`,
                        timestamp: completedAt,
                        nodeId: event.data.nodeId,
                      })
                    }
                  } else if (msg.type === 'result') {
                    // Display result messages
                    const resultText = msg.finalResponse || JSON.stringify(msg.result, null, 2) || ''
                    if (resultText) {
                      addChatMessage({
                        id: `${Date.now()}-${Math.random()}`,
                        type: 'ai',
                        content: `✅ Result: ${resultText}`,
                        timestamp: completedAt,
                        nodeId: event.data.nodeId,
                      })
                    }
                  }
                })
              } else {
                // Fallback to legacy result-based message
                const nodeInfo = IMPORTANT_NODES[event.data.nodeId]
                if (nodeInfo && event.data.result) {
                  // Clear thinking message first
                  clearThinkingMessage(event.data.nodeId)

                  const result = event.data.result
                  let message = ''

                  // ProductOwner has special formatting for tasks
                  if (event.data.nodeId === 'ProductOwnerNode') {
                    message = 'タスクの分析が完了しました。'

                    // Extract tasks information from result
                    if (result.tasks && Array.isArray(result.tasks)) {
                      message = `タスクの分析が完了しました。${result.tasks.length}個のタスクを作成しました。`

                      // Add task titles to message
                      if (result.tasks.length > 0) {
                        const taskTitles = result.tasks.slice(0, 3).map((t: any) => `・${t.title}`).join('\n')
                        message += `\n\n主なタスク:\n${taskTitles}`
                        if (result.tasks.length > 3) {
                          message += `\n...他${result.tasks.length - 3}個`
                        }
                      }
                    } else if (result.message) {
                      message = result.message
                    }
                  } else {
                    // For other nodes, use result.message or default completion message
                    const defaultMessages: Record<string, string> = {
                      EngineerNode: 'コードの実装が完了しました。',
                      ReviewNode: 'コードレビューが完了しました。',
                      DirectorNode: 'ストーリーマッピングが完了しました。',
                      SprintPlanningNode: 'スプリント計画が完了しました。',
                      MergeCoordinatorNode: 'マージが完了しました。',
                      TechLeadDesignNode: '設計レビューが完了しました。',
                    }

                    message = result.message || defaultMessages[event.data.nodeId] || `${nodeInfo.label}の処理が完了しました。`
                  }

                  addChatMessage({
                    id: `${Date.now()}-${Math.random()}`,
                    type: 'ai',
                    content: message,
                    timestamp: completedAt,
                    nodeId: event.data.nodeId,
                    data: result,
                  })
                }
              }
            }
            break

          case 'tasks-batch':
            // Batch task updates
            if (Array.isArray(event.data)) {
              updateTasks(event.data)
            }
            break

          case 'logs-batch':
            // Batch log additions
            if (Array.isArray(event.data)) {
              const logs: LogEntry[] = event.data.map((log: any) => ({
                id: `${log.timestamp}-${Math.random()}`,
                timestamp: new Date(log.timestamp),
                level: log.level,
                source: log.source,
                message: log.message,
                data: log.data,
                taskId: log.taskId,
                sessionId: log.sessionId,
                engineerId: log.engineerId,
                nodeType: log.nodeType,
                provider: log.provider,
              }))
              addLogs(logs)
            }
            break

          case 'phase-change':
            // Phase change
            setMetadata({ phase: event.data.to })
            setCurrentPhase(event.data.to)
            addLog({
              id: `${Date.now()}-${Math.random()}`,
              timestamp: new Date(event.timestamp),
              level: 'info',
              source: 'System',
              message: `🔄 フェーズ変更: ${event.data.from} → ${event.data.to}`,
            })

            toast({
              title: 'フェーズ変更',
              description: `${event.data.from} → ${event.data.to}`,
            })
            break

          case 'error':
            // Error occurred
            setMetadata({ hasErrors: true })
            const errorMessages = Array.isArray(event.data) ? event.data : [event.data]
            errorMessages.forEach((err: string) => {
              addLog({
                id: `${Date.now()}-${Math.random()}`,
                timestamp: new Date(event.timestamp),
                level: 'error',
                source: 'System',
                message: `❌ エラー: ${err}`,
              })
            })

            toast({
              variant: 'destructive',
              title: 'エラーが発生しました',
              description: Array.isArray(event.data) ? event.data.join(', ') : event.data,
            })
            break

          case 'complete':
            // Workflow completed
            stopExecution()
            setCurrentPhase(null)

            setMetadata({
              phase: 'complete',
              completedAt: new Date(event.timestamp),
              isRunning: false,
              totalTasks: event.data.totalTasks,
              tasksCompleted: event.data.tasksCompleted,
              tasksFailed: event.data.tasksFailed,
            })
            addLog({
              id: `${Date.now()}-${Math.random()}`,
              timestamp: new Date(event.timestamp),
              level: 'success',
              source: 'System',
              message: `🎉 ワークフロー完了! (成功: ${event.data.tasksCompleted}, 失敗: ${event.data.tasksFailed})`,
            })

            toast({
              title: '完了しました！',
              description: `タスク完了: ${event.data.tasksCompleted}件 / 失敗: ${event.data.tasksFailed}件`,
            })
            break

          case 'node-flow-init':
            // Node flow initialization
            console.log('[useElectronSync] Node flow initialized:', event.data)
            setNodeFlowData(event.data)
            addLog({
              id: `${Date.now()}-${Math.random()}`,
              timestamp: new Date(event.timestamp),
              level: 'info',
              source: 'Workflow',
              message: `📊 ワークフローフローチャートを初期化 (${event.data.nodes?.length || 0}ノード)`,
            })
            break

          case 'node-status-change':
            // Node status change
            console.log('[useElectronSync] Node status changed:', event.data)
            updateNodeFlowStatus(
              event.data.nodeId,
              event.data.status,
              event.data.timestamp,
              event.data.executionTime
            )

            // Update current executing node
            if (event.data.status === 'executing') {
              setCurrentExecutingNode(event.data.nodeId)
            } else if (
              event.data.status === 'completed' ||
              event.data.status === 'failed' ||
              event.data.status === 'skipped'
            ) {
              setCurrentExecutingNode(null)
            }
            break

          default:
            console.warn(`[useElectronSync] Unknown event type: ${event.type}`)
        }
      })
    }

    // ==========================================
    // File System Events (Initial Data & Changes)
    // ==========================================

    // Initial data loaded handlers
    const handleInitialTasksLoaded = ({ data }: { filePath: string; data: any }) => {
      console.log('[useElectronSync] Initial tasks loaded')
      if (data.tasks && Array.isArray(data.tasks)) {
        setTasks(data.tasks)
        addLog({
          id: `${Date.now()}-${Math.random()}`,
          timestamp: new Date(),
          level: 'info',
          source: 'FileSystem',
          message: `📥 初期タスクデータを読み込みました (${data.tasks.length}件)`,
        })
      }
    }

    const handleInitialDependencyGraphLoaded = ({ data }: { filePath: string; data: any }) => {
      console.log('[useElectronSync] Initial dependency graph loaded')
      setDependencyGraph(data)
      addLog({
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        level: 'info',
        source: 'FileSystem',
        message: '📥 依存関係グラフを読み込みました',
      })
    }

    const handleInitialStoryMapLoaded = ({ data }: { filePath: string; data: any }) => {
      console.log('[useElectronSync] Initial story map loaded')
      setStoryMapping(data)
      addLog({
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        level: 'info',
        source: 'FileSystem',
        message: '📥 ストーリーマッピングを読み込みました',
      })
    }

    const handleInitialNodeExecutionsLoaded = ({ data }: { filePath: string; data: any }) => {
      console.log('[useElectronSync] Initial node executions loaded')
      if (data.nodeExecutions && Array.isArray(data.nodeExecutions)) {
        // nodeExecutionsをappStoreに設定
        // 各NodeExecutionをaddNodeExecutionで追加するのではなく、一括設定する
        // appStoreにsetNodeExecutions actionがあればそれを使う、なければaddで追加
        data.nodeExecutions.forEach((execution: any) => {
          const nodeExecution = {
            nodeName: execution.nodeName,
            status: execution.status,
            startedAt: new Date(execution.startedAt),
            completedAt: execution.completedAt ? new Date(execution.completedAt) : undefined,
            duration: execution.duration,
            error: execution.error,
          }
          addNodeExecution(nodeExecution)
        })

        addLog({
          id: `${Date.now()}-${Math.random()}`,
          timestamp: new Date(),
          level: 'info',
          source: 'FileSystem',
          message: `📥 ノード実行履歴を読み込みました (${data.nodeExecutions.length}件)`,
        })
      }
    }

    // File changed handlers
    const handleTasksChanged = ({ data, event }: { filePath: string; data: any; event: string }) => {
      console.log(`[useElectronSync] Tasks file ${event}`)
      if (data.tasks && Array.isArray(data.tasks)) {
        setTasks(data.tasks)
        addLog({
          id: `${Date.now()}-${Math.random()}`,
          timestamp: new Date(),
          level: 'info',
          source: 'FileSystem',
          message: `🔄 タスクデータが更新されました (${data.tasks.length}件)`,
        })
      }
    }

    const handleDependencyGraphChanged = ({ data }: { filePath: string; data: any; event: string }) => {
      console.log('[useElectronSync] Dependency graph file changed')
      setDependencyGraph(data)
      addLog({
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        level: 'info',
        source: 'FileSystem',
        message: '🔄 依存関係グラフが更新されました',
      })
    }

    const handleStoryMapChanged = ({ data }: { filePath: string; data: any; event: string }) => {
      console.log('[useElectronSync] Story map file changed')
      setStoryMapping(data)
      addLog({
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        level: 'info',
        source: 'FileSystem',
        message: '🔄 ストーリーマッピングが更新されました',
      })
    }

    const handleNodeExecutionsChanged = ({ data, event }: { filePath: string; data: any; event: string }) => {
      console.log(`[useElectronSync] Node executions file ${event}`)
      if (data.nodeExecutions && Array.isArray(data.nodeExecutions)) {
        // 既存のnodeExecutionsをクリアして、新しいデータで上書き
        clearNodeExecutions()

        data.nodeExecutions.forEach((execution: any) => {
          const nodeExecution = {
            nodeName: execution.nodeName,
            status: execution.status,
            startedAt: new Date(execution.startedAt),
            completedAt: execution.completedAt ? new Date(execution.completedAt) : undefined,
            duration: execution.duration,
            error: execution.error,
          }
          addNodeExecution(nodeExecution)
        })

        addLog({
          id: `${Date.now()}-${Math.random()}`,
          timestamp: new Date(),
          level: 'info',
          source: 'FileSystem',
          message: `🔄 ノード実行履歴が更新されました (${data.nodeExecutions.length}件)`,
        })
      }
    }

    // Register file system event listeners
    let cleanupInitialTasks: (() => void) | undefined
    let cleanupInitialDependencyGraph: (() => void) | undefined
    let cleanupInitialStoryMap: (() => void) | undefined
    let cleanupInitialNodeExecutions: (() => void) | undefined
    let cleanupTasksChanged: (() => void) | undefined
    let cleanupDependencyGraphChanged: (() => void) | undefined
    let cleanupStoryMapChanged: (() => void) | undefined
    let cleanupNodeExecutionsChanged: (() => void) | undefined

    if (window.electronAPI.onInitialDataLoaded) {
      cleanupInitialTasks = window.electronAPI.onInitialDataLoaded(
        'tasks',
        handleInitialTasksLoaded
      )
      cleanupInitialDependencyGraph = window.electronAPI.onInitialDataLoaded(
        'dependency-graph',
        handleInitialDependencyGraphLoaded
      )
      cleanupInitialStoryMap = window.electronAPI.onInitialDataLoaded(
        'story-map',
        handleInitialStoryMapLoaded
      )
      cleanupInitialNodeExecutions = window.electronAPI.onInitialDataLoaded(
        'node-executions',
        handleInitialNodeExecutionsLoaded
      )
      console.log('[useElectronSync] Initial data event listeners registered')
    }

    if (window.electronAPI.onFileChanged) {
      cleanupTasksChanged = window.electronAPI.onFileChanged('tasks', handleTasksChanged)
      cleanupDependencyGraphChanged = window.electronAPI.onFileChanged(
        'dependency-graph',
        handleDependencyGraphChanged
      )
      cleanupStoryMapChanged = window.electronAPI.onFileChanged('story-map', handleStoryMapChanged)
      cleanupNodeExecutionsChanged = window.electronAPI.onFileChanged(
        'node-executions',
        handleNodeExecutionsChanged
      )
      console.log('[useElectronSync] File changed event listeners registered')
    }

    // Register Graph Events Batch listener
    let cleanupGraphEventsBatch: (() => void) | undefined
    if (window.electronAPI.onGraphEventsBatch) {
      cleanupGraphEventsBatch = window.electronAPI.onGraphEventsBatch(handleGraphEventsBatch)
      console.log('[useElectronSync] Graph events batch listener registered')
    } else {
      console.warn('[useElectronSync] onGraphEventsBatch not available')
    }

    // ==========================================
    // Register Node Flow Event Listeners
    // ==========================================

    let cleanupNodeFlowInit: (() => void) | undefined
    let cleanupNodeStatusChange: (() => void) | undefined

    if (window.electronAPI.onNodeFlowInit) {
      cleanupNodeFlowInit = window.electronAPI.onNodeFlowInit((flowData) => {
        console.log('[useElectronSync] Node flow initialized:', flowData)
        setNodeFlowData(flowData)
        addLog({
          id: `${Date.now()}-${Math.random()}`,
          timestamp: new Date(),
          level: 'info',
          source: 'FileSystem',
          message: `📊 ワークフローフローチャートを読み込みました (${flowData.nodes?.length || 0}ノード)`,
        })
      })
      console.log('[useElectronSync] Node flow init listener registered')
    }

    if (window.electronAPI.onNodeStatusChange) {
      cleanupNodeStatusChange = window.electronAPI.onNodeStatusChange((data) => {
        console.log('[useElectronSync] Node status changed:', data)
        updateNodeFlowStatus(data.nodeId, data.status as any, data.timestamp)

        // Update current executing node
        if (data.status === 'executing') {
          setCurrentExecutingNode(data.nodeId)
        } else if (data.status === 'completed' || data.status === 'failed' || data.status === 'skipped') {
          setCurrentExecutingNode(null)
        }
      })
      console.log('[useElectronSync] Node status change listener registered')
    }

    // Initial state fetch (if available)
    if (window.electronAPI.getGraphState) {
      window.electronAPI
        .getGraphState()
        .then((state) => {
          if (state) {
            console.log('[useElectronSync] Initial graph state loaded')
            // Process as state-init event
            handleGraphEventsBatch([
              {
                type: 'state-init',
                data: state,
                timestamp: Date.now(),
                priority: 'high',
              },
            ])
          }
        })
        .catch((error) => {
          console.error('[useElectronSync] Failed to fetch initial graph state:', error)
        })
    }

    // Cleanup function
    return () => {
      console.log('[useElectronSync] Cleaning up Electron IPC listeners')

      // Cleanup file system listeners
      if (cleanupInitialTasks) cleanupInitialTasks()
      if (cleanupInitialDependencyGraph) cleanupInitialDependencyGraph()
      if (cleanupInitialStoryMap) cleanupInitialStoryMap()
      if (cleanupInitialNodeExecutions) cleanupInitialNodeExecutions()
      if (cleanupTasksChanged) cleanupTasksChanged()
      if (cleanupDependencyGraphChanged) cleanupDependencyGraphChanged()
      if (cleanupStoryMapChanged) cleanupStoryMapChanged()
      if (cleanupNodeExecutionsChanged) cleanupNodeExecutionsChanged()

      // Cleanup graph events batch listener
      if (cleanupGraphEventsBatch) {
        cleanupGraphEventsBatch()
      }

      // Cleanup node flow listeners
      if (cleanupNodeFlowInit) cleanupNodeFlowInit()
      if (cleanupNodeStatusChange) cleanupNodeStatusChange()
    }
  }, [
    addLog,
    addLogs,
    setTasks,
    setMetadata,
    updateTasks,
    addNodeExecution,
    updateNodeExecution,
    clearNodeExecutions,
    setDependencyGraph,
    setStoryMapping,
    setSprints,
    setNodeFlowData,
    setCurrentExecutingNode,
    updateNodeFlowStatus,
    startExecution,
    stopExecution,
    setCurrentPhase,
    addChatMessage,
    addChatMessages,
  ])
}

/**
 * Hook for executing control actions (cancel)
 */
export function useElectronControl() {
  const addChatMessage = useAppStore((state) => state.addChatMessage)

  const handleCancel = async () => {
    // 確認ダイアログを表示
    const confirmed = window.confirm(
      '実行を停止しますか？\n\n進行中のタスクは中断され、変更は保存されません。'
    )

    if (!confirmed) {
      return
    }

    try {
      if (window.electronAPI.cancelExecution) {
        await window.electronAPI.cancelExecution()

        // 停止成功メッセージをチャットに追加
        addChatMessage({
          id: `cancel-${Date.now()}`,
          type: 'system',
          content: '🛑 実行を停止しました',
          timestamp: new Date(),
        })

        console.log('[useElectronControl] Execution cancelled by user')
      }
    } catch (error) {
      // エラーメッセージをチャットに追加
      addChatMessage({
        id: `cancel-error-${Date.now()}`,
        type: 'system',
        content: `❌ 停止エラー: ${error instanceof Error ? error.message : '不明なエラー'}`,
        timestamp: new Date(),
      })

      console.error('[useElectronControl] Cancel error:', error)
    }
  }

  return {
    cancel: handleCancel,
  }
}
