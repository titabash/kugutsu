/**
 * Node Execution Viewer Component
 *
 * LangGraphノードの実行状態をリアルタイムで可視化
 * AIエージェント（スクラム開発チーム）のメンバーが今何をしているかを表示
 */

import { useAppStore } from '../store/appStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import type { NodeExecution } from '../types'
import { getNodeRole, getCategoryColor, getCategoryLabel } from '../constants/nodeRoles'
import TeamDashboardFlow from './team-dashboard/TeamDashboardFlow'

export function NodeExecutionViewer() {
  const {
    nodeExecutions,
    getActiveNodes,
    getNodeExecutionHistory,
    getNodeStatistics,
  } = useAppStore()

  const activeNodes = getActiveNodes()
  const executionHistory = getNodeExecutionHistory()

  // Group nodes by category
  const nodesByCategory = groupNodesByCategory(executionHistory)

  return (
    <div className="h-full flex flex-col p-4 space-y-4">
      <Tabs defaultValue="flowchart" className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="flowchart">🔀 フローチャート</TabsTrigger>
          <TabsTrigger value="history">📜 実行履歴 ({executionHistory.length})</TabsTrigger>
          <TabsTrigger value="statistics">📊 統計情報</TabsTrigger>
        </TabsList>

        {/* Flowchart Tab */}
        <TabsContent value="flowchart" className="flex-1 overflow-hidden">
          <div className="h-full w-full">
            <TeamDashboardFlow />
          </div>
        </TabsContent>

        {/* Execution History Tab */}
        <TabsContent value="history" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-4">
              {Object.entries(nodesByCategory).map(([category, nodes]) => (
                <CategorySection
                  key={category}
                  category={category as any}
                  nodes={nodes}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="statistics" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <NodeStatisticsTable getNodeStatistics={getNodeStatistics} />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}

/**
 * Active Node Card (脈動アニメーション付き)
 */
interface ActiveNodeCardProps {
  node: NodeExecution
}

function ActiveNodeCard({ node }: ActiveNodeCardProps) {
  const role = getNodeRole(node.nodeName)
  const categoryColor = getCategoryColor(role.category)
  const elapsedMs = Date.now() - node.startedAt.getTime()
  const elapsedSeconds = Math.floor(elapsedMs / 1000)

  return (
    <Card className="relative overflow-hidden border-2 border-primary animate-pulse">
      <div className={`absolute inset-0 ${categoryColor} opacity-10`} />
      <CardHeader className="relative pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">{role.roleIcon}</span>
            <div>
              <CardTitle className="text-base">{role.roleName}</CardTitle>
              <CardDescription className="text-xs mt-1">
                {role.description}
              </CardDescription>
            </div>
          </div>
          <Badge className={`${categoryColor} text-white text-xs`}>
            {getCategoryLabel(role.category)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="relative pt-0">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">実行時間:</span>
          <span className="font-medium">{elapsedSeconds}秒</span>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          <span>開始: {node.startedAt.toLocaleTimeString('ja-JP')}</span>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Category Section (カテゴリ別のノード表示)
 */
interface CategorySectionProps {
  category: 'planning' | 'design' | 'development' | 'review' | 'coordination'
  nodes: NodeExecution[]
}

function CategorySection({ category, nodes }: CategorySectionProps) {
  const categoryColor = getCategoryColor(category)
  const categoryLabel = getCategoryLabel(category)

  const completedNodes = nodes.filter((n) => n.status === 'completed')
  const failedNodes = nodes.filter((n) => n.status === 'failed')

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{categoryLabel}</CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              {nodes.length}件
            </Badge>
            {completedNodes.length > 0 && (
              <Badge className="bg-green-500 text-white text-xs">
                ✓ {completedNodes.length}
              </Badge>
            )}
            {failedNodes.length > 0 && (
              <Badge className="bg-red-500 text-white text-xs">
                ✗ {failedNodes.length}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {nodes.map((node, idx) => (
            <NodeExecutionItem key={`${node.nodeName}-${idx}`} node={node} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Node Execution Item
 */
interface NodeExecutionItemProps {
  node: NodeExecution
}

function NodeExecutionItem({ node }: NodeExecutionItemProps) {
  const role = getNodeRole(node.nodeName)
  const statusColor =
    node.status === 'completed'
      ? 'text-green-600'
      : node.status === 'failed'
        ? 'text-red-600'
        : 'text-blue-600'

  const statusIcon =
    node.status === 'completed' ? '✅' : node.status === 'failed' ? '❌' : '🔄'

  const durationText = node.duration
    ? `${(node.duration / 1000).toFixed(1)}s`
    : node.status === 'started'
      ? '実行中...'
      : '-'

  return (
    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
      <div className="flex items-center space-x-3">
        <span className="text-lg">{role.roleIcon}</span>
        <div>
          <p className="text-sm font-medium">{role.roleName}</p>
          <p className="text-xs text-muted-foreground">
            {node.startedAt.toLocaleTimeString('ja-JP')}
            {node.completedAt && ` - ${node.completedAt.toLocaleTimeString('ja-JP')}`}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <span className="text-xs font-medium">{durationText}</span>
        <span className={statusColor}>{statusIcon}</span>
      </div>
    </div>
  )
}

/**
 * Node Statistics Table
 */
interface NodeStatisticsTableProps {
  getNodeStatistics: (nodeName: string) => {
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    averageDuration: number
  } | null
}

function NodeStatisticsTable({ getNodeStatistics }: NodeStatisticsTableProps) {
  const uniqueNodes = Object.keys(
    Object.values(useAppStore.getState().nodeExecutions).reduce(
      (acc, exec) => {
        acc[exec.nodeName] = true
        return acc
      },
      {} as Record<string, boolean>
    )
  )

  return (
    <div className="space-y-3">
      {uniqueNodes.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              ノード実行履歴がまだありません
            </p>
          </CardContent>
        </Card>
      ) : (
        uniqueNodes.map((nodeName) => {
          const stats = getNodeStatistics(nodeName)
          if (!stats) return null

          const role = getNodeRole(nodeName)
          const successRate = stats.totalExecutions > 0
            ? ((stats.successfulExecutions / stats.totalExecutions) * 100).toFixed(1)
            : '0.0'

          return (
            <Card key={nodeName}>
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">{role.roleIcon}</span>
                  <div>
                    <CardTitle className="text-sm">{role.roleName}</CardTitle>
                    <CardDescription className="text-xs">
                      {role.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatItem label="総実行回数" value={stats.totalExecutions} />
                  <StatItem
                    label="成功"
                    value={stats.successfulExecutions}
                    color="text-green-600"
                  />
                  <StatItem
                    label="失敗"
                    value={stats.failedExecutions}
                    color="text-red-600"
                  />
                  <StatItem
                    label="平均時間"
                    value={`${(stats.averageDuration / 1000).toFixed(1)}s`}
                  />
                </div>
                <Separator className="my-3" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">成功率:</span>
                  <span className="font-medium text-green-600">{successRate}%</span>
                </div>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}

/**
 * Stat Item Component
 */
interface StatItemProps {
  label: string
  value: number | string
  color?: string
}

function StatItem({ label, value, color = 'text-foreground' }: StatItemProps) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
    </div>
  )
}

/**
 * Group nodes by category
 */
function groupNodesByCategory(nodes: NodeExecution[]) {
  return nodes.reduce(
    (acc, node) => {
      const role = getNodeRole(node.nodeName)
      if (!acc[role.category]) {
        acc[role.category] = []
      }
      acc[role.category].push(node)
      return acc
    },
    {} as Record<string, NodeExecution[]>
  )
}
