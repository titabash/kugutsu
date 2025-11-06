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
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useAppStore } from '../store/appStore'
import { Badge } from '@/components/ui/badge'
import type { TaskStatus } from '../types'
import { cn } from '../lib/utils'

// Custom node component for tasks
function TaskNode({ data }: { data: any }) {
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

  return (
    <div
      className={cn(
        'min-w-[200px] rounded-lg border-2 bg-card p-3 shadow-md transition-all hover:shadow-lg',
        statusColors[data.status] || 'border-border'
      )}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span>{statusIcons[data.status]}</span>
          <span className="text-sm font-semibold">{data.label}</span>
        </div>
        <Badge variant="outline" className="text-xs">
          P{data.priority}
        </Badge>
      </div>
      {data.assignedEngineer && (
        <div className="text-xs text-muted-foreground">👤 {data.assignedEngineer}</div>
      )}
      {data.dependencies && data.dependencies.length > 0 && (
        <div className="mt-1 text-xs text-muted-foreground">
          依存: {data.dependencies.length}
        </div>
      )}
    </div>
  )
}

const nodeTypes = {
  task: TaskNode,
}

export function GraphVisualization() {
  const { tasks, setSelectedTaskId } = useAppStore()

  // Convert tasks to ReactFlow nodes
  const initialNodes: Node[] = useMemo(() => {
    if (tasks.length === 0) return []

    // Simple layout algorithm: arrange by status and priority
    const statusGroups: Record<TaskStatus, typeof tasks> = {
      pending: [],
      in_progress: [],
      completed: [],
      failed: [],
    }

    tasks.forEach((task) => {
      statusGroups[task.status].push(task)
    })

    const nodes: Node[] = []
    let xOffset = 50

    Object.entries(statusGroups).forEach(([status, groupTasks]) => {
      groupTasks
        .sort((a, b) => b.priority - a.priority)
        .forEach((task, index) => {
          nodes.push({
            id: task.id,
            type: 'task',
            position: { x: xOffset, y: 100 + index * 150 },
            data: {
              label: task.title,
              status: task.status,
              priority: task.priority,
              assignedEngineer: task.assignedEngineer,
              dependencies: task.dependencies,
            },
          })
        })

      xOffset += 300
    })

    return nodes
  }, [tasks])

  // Convert task dependencies to ReactFlow edges
  const initialEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = []

    tasks.forEach((task) => {
      if (task.dependencies && task.dependencies.length > 0) {
        task.dependencies.forEach((depId) => {
          edges.push({
            id: `${depId}-${task.id}`,
            source: depId,
            target: task.id,
            type: 'smoothstep',
            animated: task.status === 'in_progress',
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
            style: {
              strokeWidth: 2,
              stroke: task.status === 'completed' ? '#22c55e' : '#3b82f6',
            },
          })
        })
      }
    })

    return edges
  }, [tasks])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setSelectedTaskId(node.id)
    },
    [setSelectedTaskId]
  )

  if (tasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <div className="mb-2 text-4xl">📊</div>
          <div>タスクがありません</div>
          <div className="mt-2 text-xs">
            タスクが作成されると、依存関係グラフがここに表示されます
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        minZoom={0.1}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  )
}
