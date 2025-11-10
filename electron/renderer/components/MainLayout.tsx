import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SprintViewer } from './SprintViewer'
import { NodeExecutionViewer } from './NodeExecutionViewer'

interface MainLayoutProps {
  leftPanel: React.ReactNode
  graphPanel: React.ReactNode
  taskPanel: React.ReactNode
}

export function MainLayout({ leftPanel, graphPanel, taskPanel }: MainLayoutProps) {
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left Panel: Prompt/Chat */}
      <div className="flex w-2/5 flex-col border-r border-border bg-background">
        {leftPanel}
      </div>

      {/* Right Panel: Tabs (Graph / Tasks / Sprints) */}
      <div className="flex w-3/5 flex-col bg-muted/20">
        <Tabs defaultValue="tasks" className="flex h-full flex-col">
          <div className="border-b border-border bg-background">
            <TabsList className="h-12 w-full justify-start rounded-none border-0 bg-transparent p-0">
              <TabsTrigger
                value="tasks"
                className="h-12 rounded-none border-b-2 border-transparent px-6 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                📋 タスクボード
              </TabsTrigger>
              <TabsTrigger
                value="graph"
                className="h-12 rounded-none border-b-2 border-transparent px-6 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                📊 依存関係グラフ
              </TabsTrigger>
              <TabsTrigger
                value="sprints"
                className="h-12 rounded-none border-b-2 border-transparent px-6 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                🏃 スプリント
              </TabsTrigger>
              <TabsTrigger
                value="agents"
                className="h-12 rounded-none border-b-2 border-transparent px-6 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                🤖 AIエージェント
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="tasks" className="flex-1 overflow-hidden m-0">
            {taskPanel}
          </TabsContent>

          <TabsContent value="graph" className="flex-1 overflow-hidden m-0">
            {graphPanel}
          </TabsContent>

          <TabsContent value="sprints" className="flex-1 overflow-hidden m-0 p-4">
            <SprintViewer />
          </TabsContent>

          <TabsContent value="agents" className="flex-1 overflow-hidden m-0">
            <NodeExecutionViewer />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

/**
 * Alternative TabsLayout for switching between views
 */
export function TabsLayout() {
  return (
    <div className="flex flex-1 flex-col">
      <Tabs defaultValue="graph" className="flex h-full flex-col">
        <div className="border-b border-border">
          <TabsList className="h-12 w-full justify-start rounded-none border-0 bg-transparent p-0">
            <TabsTrigger
              value="graph"
              className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              📊 グラフ表示
            </TabsTrigger>
            <TabsTrigger
              value="kanban"
              className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              📋 カンバンボード
            </TabsTrigger>
            <TabsTrigger
              value="list"
              className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              📑 リスト表示
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="graph" className="flex-1 overflow-hidden">
          <div className="flex h-full items-center justify-center text-muted-foreground">
            グラフ表示（実装予定）
          </div>
        </TabsContent>

        <TabsContent value="kanban" className="flex-1 overflow-hidden">
          <div className="flex h-full items-center justify-center text-muted-foreground">
            カンバンボード（実装予定）
          </div>
        </TabsContent>

        <TabsContent value="list" className="flex-1 overflow-hidden">
          <div className="flex h-full items-center justify-center text-muted-foreground">
            リスト表示（実装予定）
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
