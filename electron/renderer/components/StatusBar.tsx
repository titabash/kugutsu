import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { Circle, CircleDashed, CircleAlert, Clock, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Format milliseconds to MM:SS format
 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

/**
 * StatusBar component - displays execution status at the bottom of the screen
 */
export function StatusBar() {
  const metadata = useAppStore((state) => state.metadata)
  const currentPhase = useAppStore((state) => state.currentPhase)
  const currentExecutingNode = useAppStore((state) => state.currentExecutingNode)
  const getExecutionDuration = useAppStore((state) => state.getExecutionDuration)
  const getExecutionStatus = useAppStore((state) => state.getExecutionStatus)
  const getProgressPercentage = useAppStore((state) => state.getProgressPercentage)

  const [duration, setDuration] = useState<number | null>(null)

  const status = getExecutionStatus()
  const progressPercentage = getProgressPercentage()

  // Update duration every second when running
  useEffect(() => {
    if (status !== 'running') {
      setDuration(null)
      return
    }

    const updateDuration = () => {
      const d = getExecutionDuration()
      setDuration(d)
    }

    updateDuration()
    const interval = setInterval(updateDuration, 1000)

    return () => clearInterval(interval)
  }, [status, getExecutionDuration])

  // Get status display
  const getStatusDisplay = () => {
    switch (status) {
      case 'running':
        return {
          icon: <CircleDashed className="h-4 w-4 animate-spin text-blue-500" />,
          text: '実行中',
          color: 'text-blue-500',
        }
      case 'paused':
        return {
          icon: <Circle className="h-4 w-4 text-yellow-500" />,
          text: '一時停止',
          color: 'text-yellow-500',
        }
      case 'error':
        return {
          icon: <CircleAlert className="h-4 w-4 text-red-500" />,
          text: 'エラー',
          color: 'text-red-500',
        }
      default:
        return {
          icon: <CheckCircle2 className="h-4 w-4 text-gray-400" />,
          text: '待機中',
          color: 'text-gray-400',
        }
    }
  }

  const statusDisplay = getStatusDisplay()

  // Get current activity text
  const getActivityText = () => {
    if (currentExecutingNode) {
      return currentExecutingNode
    }
    if (currentPhase) {
      return currentPhase
    }
    if (status === 'running') {
      return '処理中...'
    }
    return 'アイドル'
  }

  return (
    <div className="h-8 border-t bg-background px-4 flex items-center justify-between text-xs">
      {/* Left: Status and current activity */}
      <div className="flex items-center gap-4">
        {/* Status indicator */}
        <div className="flex items-center gap-1.5">
          {statusDisplay.icon}
          <span className={cn('font-medium', statusDisplay.color)}>{statusDisplay.text}</span>
        </div>

        {/* Separator */}
        <div className="h-4 w-px bg-border" />

        {/* Current activity */}
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">実行中:</span>
          <span className="font-medium">{getActivityText()}</span>
        </div>
      </div>

      {/* Right: Progress and duration */}
      <div className="flex items-center gap-4">
        {/* Task progress */}
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">タスク:</span>
          <span className="font-medium">
            {metadata.tasksCompleted}/{metadata.totalTasks} 完了
          </span>
          {metadata.totalTasks > 0 && (
            <span className="text-muted-foreground">({progressPercentage}%)</span>
          )}
        </div>

        {/* Separator */}
        {duration !== null && <div className="h-4 w-px bg-border" />}

        {/* Execution duration */}
        {duration !== null && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium tabular-nums">{formatDuration(duration)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
