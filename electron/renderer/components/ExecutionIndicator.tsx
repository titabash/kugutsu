import { useAppStore } from '../store/appStore'
import { Loader2, Circle, CircleAlert, CheckCircle2 } from 'lucide-react'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { cn } from '@/lib/utils'

/**
 * ExecutionIndicator component - displays execution status in the header
 */
export function ExecutionIndicator() {
  const getExecutionStatus = useAppStore((state) => state.getExecutionStatus)
  const getProgressPercentage = useAppStore((state) => state.getProgressPercentage)
  const metadata = useAppStore((state) => state.metadata)

  const status = getExecutionStatus()
  const progressPercentage = getProgressPercentage()

  // Get status badge variant and content
  const getStatusBadge = () => {
    switch (status) {
      case 'running':
        return {
          variant: 'default' as const,
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
          text: '実行中',
          className: 'bg-blue-500 text-white hover:bg-blue-600',
        }
      case 'paused':
        return {
          variant: 'secondary' as const,
          icon: <Circle className="h-3 w-3" />,
          text: '一時停止',
          className: 'bg-yellow-500 text-white hover:bg-yellow-600',
        }
      case 'error':
        return {
          variant: 'destructive' as const,
          icon: <CircleAlert className="h-3 w-3" />,
          text: 'エラー',
          className: 'bg-red-500 text-white hover:bg-red-600',
        }
      default:
        return {
          variant: 'outline' as const,
          icon: <CheckCircle2 className="h-3 w-3" />,
          text: '待機中',
          className: 'border-gray-300 text-gray-600',
        }
    }
  }

  const statusBadge = getStatusBadge()

  // Show indicator only when there are tasks or execution is running
  if (metadata.totalTasks === 0 && status === 'idle') {
    return null
  }

  return (
    <div className="flex items-center gap-3">
      {/* Status badge */}
      <Badge variant={statusBadge.variant} className={cn('flex items-center gap-1.5', statusBadge.className)}>
        {statusBadge.icon}
        <span className="text-xs font-medium">{statusBadge.text}</span>
      </Badge>

      {/* Progress bar */}
      {metadata.totalTasks > 0 && (
        <div className="flex items-center gap-2 min-w-[200px]">
          <Progress value={progressPercentage} className="h-2" />
          <span className="text-xs text-muted-foreground tabular-nums min-w-[3ch]">
            {progressPercentage}%
          </span>
        </div>
      )}
    </div>
  )
}
