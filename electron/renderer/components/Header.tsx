import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Play, Pause, Square, Users } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useElectronControl } from '../hooks/useElectronSync'

export function Header() {
  const { metadata } = useAppStore()
  const { pause, resume, cancel } = useElectronControl()

  const progress =
    metadata.totalTasks > 0 ? (metadata.tasksCompleted / metadata.totalTasks) * 100 : 0

  const handleTogglePause = () => {
    if (metadata.isPaused) {
      resume()
    } else {
      pause()
    }
  }

  return (
    <header className="h-16 border-b border-border bg-card px-6">
      <div className="flex h-full items-center justify-between">
        {/* Left: Branding */}
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">🚀 Kugutsu</h1>
          <Separator orientation="vertical" className="h-6" />
          <Badge variant="secondary" className="text-xs">
            AI Parallel Development
          </Badge>
        </div>

        {/* Center: Progress */}
        <div className="flex flex-1 items-center justify-center gap-6 px-12">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{metadata.activeEngineers} エンジニア</span>
          </div>

          <div className="flex w-96 flex-col gap-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>進捗状況</span>
              <span>
                {metadata.tasksCompleted} / {metadata.totalTasks} タスク
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="flex gap-2">
            <Badge
              variant="outline"
              className="border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400"
            >
              完了: {metadata.tasksCompleted}
            </Badge>
            <Badge
              variant="outline"
              className="border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400"
            >
              進行中: {metadata.tasksInProgress}
            </Badge>
            {metadata.tasksFailed > 0 && (
              <Badge
                variant="outline"
                className="border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400"
              >
                失敗: {metadata.tasksFailed}
              </Badge>
            )}
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant={metadata.isPaused ? 'default' : 'outline'}
            size="sm"
            onClick={handleTogglePause}
            disabled={!metadata.isRunning}
          >
            {metadata.isPaused ? (
              <>
                <Play className="mr-2 h-4 w-4" />
                再開
              </>
            ) : (
              <>
                <Pause className="mr-2 h-4 w-4" />
                一時停止
              </>
            )}
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={cancel}
            disabled={!metadata.isRunning}
          >
            <Square className="mr-2 h-4 w-4" />
            停止
          </Button>
        </div>
      </div>
    </header>
  )
}
