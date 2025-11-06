import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface MainLayoutProps {
  leftPanel: React.ReactNode
  rightPanel: React.ReactNode
}

export function MainLayout({ leftPanel, rightPanel }: MainLayoutProps) {
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left Panel: Graph Visualization */}
      <div className="flex w-1/2 flex-col border-r border-border bg-background">
        <div className="flex h-12 items-center border-b border-border px-4">
          <h2 className="text-sm font-semibold">依存関係グラフ</h2>
        </div>
        <div className="flex-1 overflow-hidden">{leftPanel}</div>
      </div>

      {/* Right Panel: Task Kanban Board */}
      <div className="flex w-1/2 flex-col bg-muted/20">
        <div className="flex h-12 items-center border-b border-border px-4">
          <h2 className="text-sm font-semibold">タスクボード</h2>
        </div>
        <div className="flex-1 overflow-hidden">{rightPanel}</div>
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
