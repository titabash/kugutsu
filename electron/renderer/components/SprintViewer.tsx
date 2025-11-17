/**
 * Sprint Viewer Component
 *
 * スプリント一覧とタスク状況を可視化するコンポーネント
 *
 * 機能:
 * - スプリント一覧表示
 * - 現在のスプリント強調表示
 * - スプリント別タスク一覧
 * - 進捗状況の表示（完了率、タスク数）
 * - Product Backlog表示
 */

import { useMemo } from 'react'
import { useAppStore } from '../store/appStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Separator } from './ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { ScrollArea } from './ui/scroll-area'
import type { Sprint, GlobalTask } from '../types'

export function SprintViewer() {
  const {
    sprints,
    currentSprint,
    globalTasks,
    getTasksBySprint,
    getProductBacklogTasks,
    getCurrentSprintProgress,
    setCurrentSprint,
  } = useAppStore()

  const progress = getCurrentSprintProgress()
  const productBacklog = getProductBacklogTasks()

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalSprints = sprints.length
    const activeSprints = sprints.filter(
      (s) => s.status === 'active' || s.status === 'planning'
    ).length
    const completedSprints = sprints.filter((s) => s.status === 'completed').length
    const totalEstimatedHours = sprints.reduce((sum, s) => sum + s.metadata.estimatedHours, 0)

    return {
      totalSprints,
      activeSprints,
      completedSprints,
      totalEstimatedHours,
    }
  }, [sprints])

  const handleSprintClick = (sprint: Sprint) => {
    setCurrentSprint(sprint)
  }

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      {/* Statistics Section */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>総スプリント数</CardDescription>
            <CardTitle className="text-2xl" data-testid="stats-total-sprints">
              {statistics.totalSprints}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>アクティブ</CardDescription>
            <CardTitle className="text-2xl" data-testid="stats-active-sprints">
              {statistics.activeSprints}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>完了</CardDescription>
            <CardTitle className="text-2xl" data-testid="stats-completed-sprints">
              {statistics.completedSprints}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>総見積時間</CardDescription>
            <CardTitle className="text-2xl" data-testid="stats-total-hours">
              {statistics.totalEstimatedHours}h
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="sprints" className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="sprints">Sprints</TabsTrigger>
          <TabsTrigger value="backlog">Product Backlog ({productBacklog.length})</TabsTrigger>
        </TabsList>

        {/* Sprints Tab */}
        <TabsContent value="sprints" className="flex-1 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
            {/* Sprint List */}
            <div className="flex flex-col">
              <h3 className="text-lg font-semibold mb-3">Sprints</h3>
              <ScrollArea className="flex-1">
                <div className="space-y-3">
                  {sprints.length === 0 ? (
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground text-center">
                          スプリントがまだ作成されていません
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    sprints.map((sprint) => (
                      <SprintCard
                        key={sprint.id}
                        sprint={sprint}
                        isActive={currentSprint?.id === sprint.id}
                        onClick={() => handleSprintClick(sprint)}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Current Sprint Details */}
            <div className="flex flex-col">
              <h3 className="text-lg font-semibold mb-3">Current Sprint</h3>
              {currentSprint ? (
                <ScrollArea className="flex-1">
                  <CurrentSprintDetails
                    sprint={currentSprint}
                    tasks={getTasksBySprint(currentSprint.id)}
                    progress={progress}
                  />
                </ScrollArea>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground text-center">
                      スプリントを選択してください
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Product Backlog Tab */}
        <TabsContent value="backlog" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-3">
              {productBacklog.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground text-center">
                      Product Backlogは空です
                    </p>
                  </CardContent>
                </Card>
              ) : (
                productBacklog.map((task) => <TaskCard key={task.id} task={task} />)
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}

/**
 * Sprint Card Component
 */
interface SprintCardProps {
  sprint: Sprint
  isActive: boolean
  onClick: () => void
}

function SprintCard({ sprint, isActive, onClick }: SprintCardProps) {
  const statusColors = {
    planning: 'bg-blue-500',
    active: 'bg-green-500',
    review: 'bg-yellow-500',
    completed: 'bg-gray-500',
  }

  const statusLabels = {
    planning: 'Planning',
    active: 'Active',
    review: 'Review',
    completed: 'Completed',
  }

  return (
    <Card
      className={`cursor-pointer transition-colors hover:bg-accent ${
        isActive ? 'border-primary border-2' : ''
      }`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base">{sprint.name}</CardTitle>
            <CardDescription className="mt-1 text-xs">{sprint.goal}</CardDescription>
          </div>
          <Badge
            variant="secondary"
            className={`${statusColors[sprint.status]} text-white ml-2`}
          >
            {statusLabels[sprint.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Tasks:</span>{' '}
            <span className="font-medium">{sprint.taskIds.length}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Completed:</span>{' '}
            <span className="font-medium">{sprint.metadata.completedTasksCount}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Est. Hours:</span>{' '}
            <span className="font-medium">{sprint.metadata.estimatedHours}h</span>
          </div>
          {sprint.metadata.actualHours !== undefined && (
            <div>
              <span className="text-muted-foreground">Actual:</span>{' '}
              <span className="font-medium">{sprint.metadata.actualHours}h</span>
            </div>
          )}
        </div>
        {sprint.metadata.blockers.length > 0 && (
          <div className="mt-2">
            <Badge variant="destructive" className="text-xs">
              {sprint.metadata.blockers.length} blocker(s)
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Current Sprint Details Component
 */
interface CurrentSprintDetailsProps {
  sprint: Sprint
  tasks: GlobalTask[]
  progress: {
    total: number
    completed: number
    inProgress: number
    pending: number
    failed: number
    percentage: number
  } | null
}

function CurrentSprintDetails({ sprint, tasks, progress }: CurrentSprintDetailsProps) {
  return (
    <div className="space-y-4">
      {/* Sprint Overview */}
      <Card>
        <CardHeader>
          <CardTitle>{sprint.name}</CardTitle>
          <CardDescription>{sprint.goal}</CardDescription>
        </CardHeader>
        <CardContent>
          {progress && (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Progress</span>
                  <span className="font-medium">{progress.percentage}%</span>
                </div>
                <Progress value={progress.percentage} className="h-2" />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Tasks:</span>{' '}
                  <span className="font-medium">{progress.total}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Completed:</span>{' '}
                  <span className="font-medium text-green-600">{progress.completed}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">In Progress:</span>{' '}
                  <span className="font-medium text-blue-600">{progress.inProgress}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Pending:</span>{' '}
                  <span className="font-medium text-gray-600">{progress.pending}</span>
                </div>
                {progress.failed > 0 && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Failed:</span>{' '}
                    <span className="font-medium text-red-600">{progress.failed}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No tasks assigned to this sprint
              </p>
            ) : (
              tasks.map((task) => <TaskCard key={task.id} task={task} compact />)
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Task Card Component
 */
interface TaskCardProps {
  task: GlobalTask
  compact?: boolean
}

function TaskCard({ task, compact = false }: TaskCardProps) {
  const statusColors = {
    pending: 'bg-gray-500',
    in_progress: 'bg-blue-500',
    in_review: 'bg-yellow-500',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
  }

  const statusLabels = {
    pending: 'Pending',
    in_progress: 'In Progress',
    in_review: 'In Review',
    completed: 'Completed',
    failed: 'Failed',
  }

  return (
    <Card className={compact ? 'p-3' : ''}>
      {compact ? (
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{task.title}</p>
            {task.estimatedHours && (
              <p className="text-xs text-muted-foreground">Est: {task.estimatedHours}h</p>
            )}
          </div>
          <Badge
            variant="secondary"
            className={`${statusColors[task.status]} text-white text-xs ml-2`}
          >
            {statusLabels[task.status]}
          </Badge>
        </div>
      ) : (
        <>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <CardTitle className="text-sm">{task.title}</CardTitle>
              <Badge
                variant="secondary"
                className={`${statusColors[task.status]} text-white text-xs ml-2`}
              >
                {statusLabels[task.status]}
              </Badge>
            </div>
            {task.description && (
              <CardDescription className="text-xs mt-1">{task.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2 text-xs">
              {task.estimatedHours && (
                <Badge variant="outline">Est: {task.estimatedHours}h</Badge>
              )}
              {task.businessValue && (
                <Badge variant="outline">Value: {task.businessValue}</Badge>
              )}
              {task.technicalRisk && (
                <Badge variant="outline">Risk: {task.technicalRisk}</Badge>
              )}
              {task.dependencies.length > 0 && (
                <Badge variant="outline">{task.dependencies.length} dependencies</Badge>
              )}
            </div>
          </CardContent>
        </>
      )}
    </Card>
  )
}
