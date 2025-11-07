import { useState } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BottomPanelProps {
  children: React.ReactNode
  defaultHeight?: number
  minHeight?: number
  maxHeight?: number
}

export function BottomPanel({
  children,
  defaultHeight = 300,
  minHeight = 200,
  maxHeight = 600,
}: BottomPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [height, setHeight] = useState(defaultHeight)
  const [isDragging, setIsDragging] = useState(false)

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

      {/* Content */}
      {!isCollapsed && <div className="flex-1 overflow-hidden">{children}</div>}
    </div>
  )
}
