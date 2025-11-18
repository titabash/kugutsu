import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppStore } from '../store/appStore'
import { TaskCard } from './TaskCard'
import type { TaskStatus } from '../types'
import { cn } from '../lib/utils'

const COLUMNS: Array<{
  status: TaskStatus
  label: string
  color: string
  bgColor: string
  icon: string
}> = [
  {
    status: 'pending',
    label: '待機中',
    color: 'text-gray-700 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-950/20',
    icon: '⏳',
  },
  {
    status: 'ready',
    label: '準備完了',
    color: 'text-cyan-700 dark:text-cyan-400',
    bgColor: 'bg-cyan-50 dark:bg-cyan-950/20',
    icon: '✨',
  },
  {
    status: 'in_progress',
    label: '実装中',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    icon: '🚀',
  },
  {
    status: 'in_review',
    label: 'レビュー中',
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/20',
    icon: '🔍',
  },
  {
    status: 'completed',
    label: '完了',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/20',
    icon: '✅',
  },
  {
    status: 'failed',
    label: '失敗',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/20',
    icon: '❌',
  },
]

export function TaskKanbanBoard() {
  const { tasks, setSelectedTaskId } = useAppStore()

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    return COLUMNS.reduce(
      (acc, column) => {
        acc[column.status] = tasks
          .filter((task) => task.status === column.status)
          .sort((a, b) => b.priority - a.priority) // Sort by priority descending
        return acc
      },
      {} as Record<TaskStatus, typeof tasks>
    )
  }, [tasks])

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalTasks = tasks.length
    const completedTasks = tasks.filter((t) => t.status === 'completed').length
    const pendingTasks = tasks.filter((t) => t.status === 'pending').length
    const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length
    const failedTasks = tasks.filter((t) => t.status === 'failed').length
    const progressPercentage =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      inProgressTasks,
      failedTasks,
      progressPercentage,
    }
  }, [tasks])

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Tabs defaultValue="board" className="flex h-full flex-col">
        <TabsList>
          <TabsTrigger value="board">📋 ボード</TabsTrigger>
          <TabsTrigger value="statistics">📊 統計</TabsTrigger>
        </TabsList>

        {/* Kanban Board Tab */}
        <TabsContent value="board" className="flex-1 overflow-hidden">
          <div className="grid h-full flex-1 grid-cols-6 gap-2">
        {COLUMNS.map((column) => {
          const columnTasks = tasksByStatus[column.status]
          const taskCount = columnTasks.length

          return (
            <div key={column.status} className="flex min-w-0 flex-col" data-column={column.status}>
              {/* Column Header */}
              <div className={cn('mb-3 rounded-lg p-3', column.bgColor, {
                'ring-2 ring-blue-400 animate-pulse': column.status === 'in_progress' && taskCount > 0,
                'ring-2 ring-orange-400 animate-pulse': column.status === 'in_review' && taskCount > 0,
              })}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-lg', {
                      'animate-bounce': column.status === 'in_progress' && taskCount > 0,
                    })}>{column.icon}</span>
                    <h3 className={cn('text-sm font-semibold', column.color)}>{column.label}</h3>
                  </div>
                  <Badge variant="secondary" className={cn('text-xs', column.color)}>
                    {taskCount}
                  </Badge>
                </div>
              </div>

              {/* Column Body */}
              <ScrollArea className="flex-1">
                <div className="space-y-2">
                  {columnTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                      <span className="mb-2 text-3xl opacity-50">{column.icon}</span>
                      <span className="text-xs">タスクがありません</span>
                    </div>
                  ) : (
                    columnTasks.map((task) => (
                      <TaskCard key={task.id} task={task} onTaskClick={setSelectedTaskId} />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )
        })}
          </div>
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="statistics" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-4">
              {/* Statistics Cards */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>総タスク数</CardDescription>
                    <CardTitle className="text-2xl" data-testid="stats-total-tasks">
                      {statistics.totalTasks}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>完了</CardDescription>
                    <CardTitle className="text-2xl" data-testid="stats-completed-tasks">
                      {statistics.completedTasks}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>進捗率</CardDescription>
                    <CardTitle className="text-2xl" data-testid="stats-progress">
                      {statistics.progressPercentage}%
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>失敗</CardDescription>
                    <CardTitle className="text-2xl">{statistics.failedTasks}</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* Additional Statistics */}
              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">タスク統計</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">待機中</span>
                      <span className="text-lg font-semibold" data-testid="stats-pending">
                        {statistics.pendingTasks}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">実装中</span>
                      <span className="text-lg font-semibold" data-testid="stats-in-progress">
                        {statistics.inProgressTasks}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">失敗</span>
                      <span className="text-lg font-semibold" data-testid="stats-failed">
                        {statistics.failedTasks}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
