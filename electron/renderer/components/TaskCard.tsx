import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { GitBranch, User, Clock } from 'lucide-react'
import type { Task } from '../types'
import { cn } from '../lib/utils'

interface TaskCardProps {
  task: Task
  onTaskClick?: (taskId: string) => void
}

export function TaskCard({ task, onTaskClick }: TaskCardProps) {
  const priorityColor =
    task.priority >= 70
      ? 'red'
      : task.priority >= 40
        ? 'amber'
        : task.priority >= 20
          ? 'blue'
          : 'green'

  const hasDependencies = task.dependencies && task.dependencies.length > 0

  const formatDate = (date?: Date) => {
    if (!date) return ''
    return new Date(date).toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const isActive = task.status === 'in_progress' || task.status === 'in_review'

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]',
        task.isConflictResolution && 'border-red-500 bg-red-50 dark:bg-red-950/20',
        isActive && 'ring-2 ring-blue-400 shadow-lg animate-pulse'
      )}
      onClick={() => onTaskClick?.(task.id)}
    >
      <CardHeader className="p-3">
        <div className="mb-2 flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 text-sm font-medium">{task.title}</CardTitle>
          <div className="flex flex-shrink-0 gap-1">
            {/* Priority Badge */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      `border-${priorityColor}-500/50 bg-${priorityColor}-500/10 text-${priorityColor}-700 dark:text-${priorityColor}-400`
                    )}
                  >
                    P{task.priority}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>優先度: {task.priority}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Dependencies Badge */}
            {hasDependencies && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="text-xs">
                      <GitBranch className="mr-1 h-3 w-3" />
                      {task.dependencies.length}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{task.dependencies.length}個の依存タスク</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Conflict Resolution Badge */}
            {task.isConflictResolution && (
              <Badge variant="destructive" className="text-xs">
                コンフリクト
              </Badge>
            )}
          </div>
        </div>

        {task.description && (
          <CardDescription className="line-clamp-2 text-xs">
            {task.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="p-3 pt-0">
        <div className="flex flex-col gap-2">
          {/* Assigned Engineer */}
          {task.assignedEngineer && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span>{task.assignedEngineer}</span>
            </div>
          )}

          {/* Timestamps */}
          {(task.createdAt || task.updatedAt) && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                {task.updatedAt ? `更新: ${formatDate(task.updatedAt)}` : formatDate(task.createdAt)}
              </span>
            </div>
          )}

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {task.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
              {task.tags.length > 3 && (
                <Badge variant="outline" className="text-[10px]">
                  +{task.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Error Message */}
          {task.error && (
            <div className="rounded border border-red-500/50 bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/20 dark:text-red-400">
              {task.error}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
