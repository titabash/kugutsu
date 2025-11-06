import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import type { LogEntry } from '../types'
import { cn } from '../lib/utils'

interface LogEntryProps {
  log: LogEntry
}

const LOG_LEVEL_COLORS = {
  debug: 'text-gray-500 dark:text-gray-400',
  info: 'text-blue-600 dark:text-blue-400',
  warn: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
  success: 'text-green-600 dark:text-green-400',
}

const LOG_LEVEL_ICONS = {
  debug: '🐛',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
  success: '✅',
}

const LOG_LEVEL_BADGE_VARIANTS = {
  debug: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  warn: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  error: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  success: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
}

export const LogEntryComponent = memo(function LogEntry({ log }: LogEntryProps) {
  const levelColor = LOG_LEVEL_COLORS[log.level] || LOG_LEVEL_COLORS.info
  const levelIcon = LOG_LEVEL_ICONS[log.level] || LOG_LEVEL_ICONS.info
  const badgeVariant = LOG_LEVEL_BADGE_VARIANTS[log.level] || LOG_LEVEL_BADGE_VARIANTS.info

  const formatTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  return (
    <div className="group flex gap-2 border-b border-border/50 px-3 py-2 font-mono text-xs hover:bg-muted/50">
      {/* Icon */}
      <span className="flex-shrink-0">{levelIcon}</span>

      {/* Timestamp */}
      <span className="flex-shrink-0 text-muted-foreground">{formatTime(log.timestamp)}</span>

      {/* Level Badge */}
      <Badge variant="secondary" className={cn('flex-shrink-0 text-[10px]', badgeVariant)}>
        {log.level.toUpperCase()}
      </Badge>

      {/* Source */}
      <span className="w-32 flex-shrink-0 truncate text-muted-foreground" title={log.source}>
        {log.source}
      </span>

      {/* Message */}
      <span className={cn('flex-1', levelColor)}>{log.message}</span>
    </div>
  )
})
