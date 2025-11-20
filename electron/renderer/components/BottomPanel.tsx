import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTabStore } from '../store/useTabStore'
import { LogViewer } from './LogViewer'

interface BottomPanelProps {
  defaultHeight?: number
  minHeight?: number
  maxHeight?: number
}

export function BottomPanel({
  defaultHeight = 300,
  minHeight = 200,
  maxHeight = 600,
}: BottomPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [height, setHeight] = useState(defaultHeight)
  const [isDragging, setIsDragging] = useState(false)

  // Tab store
  const { tabs, activeTabId, setActiveTab, closeTab } = useTabStore()

  // Auto-close completed tabs after 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      useTabStore.getState().autoCloseCompletedTabs(30000) // 30 seconds
    }, 5000) // Check every 5 seconds

    return () => clearInterval(interval)
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return

    const newHeight = window.innerHeight - e.clientY
    if (newHeight >= minHeight && newHeight <= maxHeight) {
      setHeight(newHeight)
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Add mouse event listeners
  if (typeof window !== 'undefined') {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    } else {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }

  return (
    <div
      className={`flex flex-col border-t border-border bg-card ${
        isCollapsed ? 'h-12' : ''
      }`}
      style={{ height: isCollapsed ? '48px' : `${height}px` }}
    >
      {/* Resize Handle */}
      {!isCollapsed && (
        <div
          className="group relative h-1 cursor-ns-resize bg-border hover:bg-primary"
          onMouseDown={handleMouseDown}
        >
          <div className="absolute inset-x-0 -top-1 h-2" />
        </div>
      )}

      {/* Header */}
      <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">ログ</h2>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Content with Tabs */}
      {!isCollapsed && (
        <div className="flex-1 overflow-hidden">
          {tabs.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              ログはまだありません
            </div>
          ) : (
            <Tabs
              value={activeTabId || tabs[0]?.id}
              onValueChange={setActiveTab}
              className="flex h-full flex-col"
            >
              <TabsList className="h-10 w-full justify-start rounded-none border-b bg-muted/50 px-2">
                {tabs.map((tab) => (
                  <div key={tab.id} className="relative flex items-center">
                    <TabsTrigger
                      value={tab.id}
                      className={`relative h-8 px-3 ${
                        tab.completedAt
                          ? 'text-muted-foreground'
                          : ''
                      }`}
                    >
                      {tab.title}
                      {tab.completedAt && (
                        <span className="ml-1.5 text-xs">✓</span>
                      )}
                    </TabsTrigger>
                    {tab.isClosable && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-0.5 h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation()
                          closeTab(tab.id)
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </TabsList>

              {tabs.map((tab) => (
                <TabsContent
                  key={tab.id}
                  value={tab.id}
                  className="flex-1 overflow-hidden m-0 p-0"
                >
                  <LogViewer tabId={tab.id} />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      )}
    </div>
  )
}
