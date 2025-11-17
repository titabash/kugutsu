import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  BackgroundVariant,
  ConnectionMode,
  MiniMap,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { DependencyGraph, TaskStatus } from '../types'
import { cn } from '../lib/utils'
import { AlertTriangle, Zap, Users } from 'lucide-react'

interface DependencyGraphViewerProps {
  graph: DependencyGraph
  onNodeClick?: (nodeId: string) => void
}

// Custom node component for dependency graph
function DependencyNode({ data }: { data: any }) {
  const statusColors: Record<TaskStatus, string> = {
    pending: 'border-amber-500 bg-amber-50 dark:bg-amber-950/20',
    in_progress: 'border-blue-500 bg-blue-50 dark:bg-blue-950/20',
    completed: 'border-green-500 bg-green-50 dark:bg-green-950/20',
    failed: 'border-red-500 bg-red-50 dark:bg-red-950/20',
  }

  const statusIcons: Record<TaskStatus, string> = {
    pending: '⏳',
    in_progress: '🚀',
    completed: '✅',
    failed: '❌',
  }

  const isCriticalPath = data.isCriticalPath
  const isParallelGroup = data.parallelGroupIndex !== undefined

  return (
    <div
      className={cn(
        'min-w-[220px] rounded-lg border-2 bg-card p-3 shadow-md transition-all hover:shadow-lg',
        statusColors[data.status] || 'border-border',
        isCriticalPath && 'ring-2 ring-red-500 ring-offset-2 ring-offset-background'
      )}
    >
      {/* Header with icons */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span>{statusIcons[data.status]}</span>
          <span className="text-sm font-semibold">{data.label}</span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          {isCriticalPath && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Critical
            </Badge>
          )}
          {isParallelGroup && (
            <Badge variant="secondary" className="text-xs">
              <Users className="mr-1 h-3 w-3" />
              G{data.parallelGroupIndex + 1}
            </Badge>
          )}
        </div>
      </div>

      {/* Task details */}
      <div className="space-y-1 text-xs">
        {data.priority !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Priority:</span>
            <Badge variant="outline" className="text-xs">
              P{data.priority}
            </Badge>
          </div>
        )}

        {data.assignedEngineer && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <span>👤</span>
            <span>{data.assignedEngineer}</span>
          </div>
        )}

        {data.dependencies && data.dependencies.length > 0 && (
          <div className="text-muted-foreground">
            Dependencies: {data.dependencies.length}
          </div>
        )}

        {data.estimatedTime && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Zap className="h-3 w-3" />
            <span>{data.estimatedTime}h</span>
          </div>
        )}
      </div>
    </div>
  )
}

const nodeTypes = {
  dependency: DependencyNode,
}

export function DependencyGraphViewer({ graph, onNodeClick }: DependencyGraphViewerProps) {
  // Convert DependencyGraph to ReactFlow nodes
  const initialNodes: Node[] = useMemo(() => {
    if (graph.nodes.length === 0) return []

    // Group nodes by parallel groups
    const parallelGroupMap = new Map<string, number>()
    graph.parallelGroups?.forEach((group, groupIndex) => {
      group.forEach((nodeId) => {
        parallelGroupMap.set(nodeId, groupIndex)
      })
    })

    // Create a Set for quick critical path lookup
    const criticalPathSet = new Set(graph.criticalPath || [])

    // Layout algorithm: arrange by parallel groups and critical path
    const nodes: Node[] = []
    let xOffset = 50
    let yOffset = 50

    // Group nodes by parallel groups
    const groupedNodes = new Map<number, typeof graph.nodes>()
    const ungroupedNodes: typeof graph.nodes = []

    graph.nodes.forEach((node) => {
      const groupIndex = parallelGroupMap.get(node.id)
      if (groupIndex !== undefined) {
        if (!groupedNodes.has(groupIndex)) {
          groupedNodes.set(groupIndex, [])
        }
        groupedNodes.get(groupIndex)!.push(node)
      } else {
        ungroupedNodes.push(node)
      }
    })

    // Layout parallel groups first
    const sortedGroups = Array.from(groupedNodes.entries()).sort((a, b) => a[0] - b[0])
    sortedGroups.forEach(([groupIndex, groupNodes]) => {
      groupNodes.forEach((node, index) => {
        nodes.push({
          id: node.id,
          type: 'dependency',
          position: node.position || { x: xOffset, y: yOffset + index * 180 },
          data: {
            label: node.label,
            status: node.status,
            priority: node.data?.priority,
            assignedEngineer: node.data?.assignedEngineer,
            dependencies: node.data?.dependencies,
            estimatedTime: node.data?.estimatedTime,
            isCriticalPath: criticalPathSet.has(node.id),
            parallelGroupIndex: groupIndex,
          },
        })
      })
      xOffset += 350
      yOffset = 50
    })

    // Layout ungrouped nodes
    ungroupedNodes.forEach((node, index) => {
      nodes.push({
        id: node.id,
        type: 'dependency',
        position: node.position || { x: xOffset, y: yOffset + index * 180 },
        data: {
          label: node.label,
          status: node.status,
          priority: node.data?.priority,
          assignedEngineer: node.data?.assignedEngineer,
          dependencies: node.data?.dependencies,
          estimatedTime: node.data?.estimatedTime,
          isCriticalPath: criticalPathSet.has(node.id),
        },
      })
    })

    return nodes
  }, [graph])

  // Convert DependencyGraph edges to ReactFlow edges
  const initialEdges: Edge[] = useMemo(() => {
    const criticalPathSet = new Set(graph.criticalPath || [])

    return graph.edges.map((edge) => {
      const isCriticalEdge = criticalPathSet.has(edge.source) && criticalPathSet.has(edge.target)

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type || 'smoothstep',
        animated: edge.animated || false,
        style: {
          strokeWidth: isCriticalEdge ? 3 : 2,
          stroke: isCriticalEdge ? '#ef4444' : '#3b82f6',
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isCriticalEdge ? '#ef4444' : '#3b82f6',
        },
      }
    })
  }, [graph])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (onNodeClick) {
        onNodeClick(node.id)
      }
    },
    [onNodeClick]
  )

  if (graph.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <div className="mb-2 text-4xl">🔗</div>
          <div>依存関係グラフがありません</div>
          <div className="mt-2 text-xs">
            タスクの依存関係が定義されると、ここに表示されます
          </div>
        </div>
      </div>
    )
  }

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalNodes = graph.nodes.length
    const completedNodes = graph.nodes.filter((n) => n.status === 'completed').length
    const inProgressNodes = graph.nodes.filter((n) => n.status === 'in_progress').length
    const failedNodes = graph.nodes.filter((n) => n.status === 'failed').length
    const totalTime = graph.nodes.reduce((sum, n) => sum + (n.data?.estimatedTime || 0), 0)
    const criticalPathLength = graph.criticalPath?.length || 0
    const parallelGroupsCount = graph.parallelGroups?.length || 0
    const progressPercentage = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0

    return {
      totalNodes,
      completedNodes,
      inProgressNodes,
      failedNodes,
      totalTime,
      criticalPathLength,
      parallelGroupsCount,
      progressPercentage,
    }
  }, [graph])

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Tabs defaultValue="graph" className="flex h-full flex-col">
        <TabsList>
          <TabsTrigger value="graph">🔀 フローチャート</TabsTrigger>
          <TabsTrigger value="statistics">📊 統計</TabsTrigger>
        </TabsList>

        {/* Graph Visualization Tab */}
        <TabsContent value="graph" className="flex-1 overflow-hidden mt-4">
          <div className="h-full rounded-lg border bg-card">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          minZoom={0.1}
          maxZoom={1.5}
          defaultViewport={{ x: 0, y: 0, zoom: 0.7 }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              const data = node.data as any
              if (data.isCriticalPath) return '#ef4444'
              switch (data.status) {
                case 'pending':
                  return '#f59e0b'
                case 'in_progress':
                  return '#3b82f6'
                case 'completed':
                  return '#22c55e'
                case 'failed':
                  return '#ef4444'
                default:
                  return '#6b7280'
              }
            }}
            className="bg-background"
          />
        </ReactFlow>
          </div>
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="statistics" className="flex-1 overflow-hidden mt-4">
          <ScrollArea className="h-full">
            <div className="space-y-4">
              {/* Statistics Cards */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>総タスク数</CardDescription>
                    <CardTitle className="text-2xl" data-testid="stats-total-nodes">
                      {statistics.totalNodes}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>完了</CardDescription>
                    <CardTitle className="text-2xl" data-testid="stats-completed-nodes">
                      {statistics.completedNodes}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>進捗率</CardDescription>
                    <CardTitle className="text-2xl" data-testid="stats-progress">
                      {statistics.progressPercentage}%
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>見積時間</CardDescription>
                    <CardTitle className="text-2xl" data-testid="stats-total-time">
                      {statistics.totalTime}h
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* Additional Statistics */}
              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">グラフ統計</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">クリティカルパス長</span>
                      <span className="text-lg font-semibold" data-testid="stats-critical-path-length">
                        {statistics.criticalPathLength}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">並列グループ数</span>
                      <span className="text-lg font-semibold" data-testid="stats-parallel-groups">
                        {statistics.parallelGroupsCount}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">実行中</span>
                      <span className="text-lg font-semibold">{statistics.inProgressNodes}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Legend */}
              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">凡例</CardTitle>
                  <CardDescription>グラフ要素の説明</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4 text-sm" data-testid="legend">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-red-500 ring-2 ring-red-500 ring-offset-2" />
                      <span>クリティカルパス</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        <Users className="mr-1 h-3 w-3" />
                        G1
                      </Badge>
                      <span>並列実行グループ</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-0.5 w-8 bg-blue-500" />
                      <span>依存関係</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
