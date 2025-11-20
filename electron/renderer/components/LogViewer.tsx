import { useRef, useEffect, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, Filter, Trash2, ChevronsDown } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useTabStore } from '../store/useTabStore'
import { LogEntryComponent } from './LogEntry'
import type { LogLevel } from '../types'

interface LogViewerProps {
  tabId: string
}

export function LogViewer({ tabId }: LogViewerProps) {
  const { logs, logFilter, setLogFilter, clearLogs } = useAppStore()
  const { getLogsForTab } = useTabStore()
  const parentRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)

  // Get logs for this specific tab
  const tabLogs = useMemo(() => {
    return getLogsForTab(tabId, logs)
  }, [tabId, logs, getLogsForTab])

  // Filter logs based on current filter settings
  const filteredLogs = useMemo(() => {
    return tabLogs.filter((log) => {
      // Level filter
      if (logFilter.level !== 'all' && log.level !== logFilter.level) {
        return false
      }

      // Search filter
      if (logFilter.search) {
        const searchLower = logFilter.search.toLowerCase()
        return (
          log.message.toLowerCase().includes(searchLower) ||
          log.source.toLowerCase().includes(searchLower)
        )
      }

      return true
    })
  }, [tabLogs, logFilter])

  // Virtual scrolling
  const virtualizer = useVirtualizer({
    count: filteredLogs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36, // Estimated row height
    overscan: 10,
  })

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScrollRef.current && filteredLogs.length > 0) {
      virtualizer.scrollToIndex(filteredLogs.length - 1, { align: 'end' })
    }
  }, [filteredLogs.length, virtualizer])

  // Check if user is near bottom to determine auto-scroll behavior
  const handleScroll = () => {
    if (!parentRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = parentRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100

    autoScrollRef.current = isNearBottom
  }

  const levelOptions: Array<{ value: LogLevel | 'all'; label: string; count: number }> = [
    { value: 'all', label: 'すべて', count: tabLogs.length },
    { value: 'success', label: '成功', count: tabLogs.filter((l) => l.level === 'success').length },
    { value: 'info', label: '情報', count: tabLogs.filter((l) => l.level === 'info').length },
    { value: 'warn', label: '警告', count: tabLogs.filter((l) => l.level === 'warn').length },
    { value: 'error', label: 'エラー', count: tabLogs.filter((l) => l.level === 'error').length },
    { value: 'debug', label: 'デバッグ', count: tabLogs.filter((l) => l.level === 'debug').length },
  ]

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalLogs = tabLogs.length
    const successLogs = tabLogs.filter((l) => l.level === 'success').length
    const errorLogs = tabLogs.filter((l) => l.level === 'error').length
    const warnLogs = tabLogs.filter((l) => l.level === 'warn').length
    const infoLogs = tabLogs.filter((l) => l.level === 'info').length
    const debugLogs = tabLogs.filter((l) => l.level === 'debug').length

    return {
      totalLogs,
      successLogs,
      errorLogs,
      warnLogs,
      infoLogs,
      debugLogs,
    }
  }, [tabLogs])

  return (
    <div className="flex h-full flex-col p-4">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ログを検索..."
            value={logFilter.search}
            onChange={(e) => setLogFilter({ search: e.target.value })}
            className="h-8 pl-8"
          />
        </div>

        {/* Level Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Filter className="mr-2 h-4 w-4" />
              {logFilter.level === 'all' ? 'すべて' : logFilter.level.toUpperCase()}
              <Badge variant="secondary" className="ml-2">
                {filteredLogs.length}
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {levelOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setLogFilter({ level: option.value })}
                className="justify-between"
              >
                <span>{option.label}</span>
                <Badge variant="secondary" className="ml-4">
                  {option.count}
                </Badge>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Scroll to Bottom */}
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => {
            autoScrollRef.current = true
            virtualizer.scrollToIndex(filteredLogs.length - 1, { align: 'end' })
          }}
        >
          <ChevronsDown className="h-4 w-4" />
        </Button>

        {/* Clear Logs */}
        <Button variant="outline" size="sm" className="h-8" onClick={clearLogs}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

        {/* Log List */}
        <div ref={parentRef} className="flex-1 overflow-auto bg-background" onScroll={handleScroll}>
          {filteredLogs.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="text-center">
                <div className="mb-2 text-4xl">📝</div>
                <div>ログがありません</div>
              </div>
            </div>
          ) : (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const log = filteredLogs[virtualRow.index]
                return (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <LogEntryComponent log={log} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
