import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
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
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/20',
    icon: '⏳',
  },
  {
    status: 'in_progress',
    label: '進行中',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    icon: '🚀',
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

  return (
    <div className="grid h-full grid-cols-4 gap-3 p-4">
      {COLUMNS.map((column) => {
        const columnTasks = tasksByStatus[column.status]
        const taskCount = columnTasks.length

        return (
          <div key={column.status} className="flex min-w-0 flex-col">
            {/* Column Header */}
            <div className={cn('mb-3 rounded-lg p-3', column.bgColor)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{column.icon}</span>
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
  )
}
