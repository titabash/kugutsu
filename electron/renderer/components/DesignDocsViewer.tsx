import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { FileText, Layout, Database, Code, Image } from 'lucide-react'
import type { DesignDocs } from '../types'

interface DesignDocsViewerProps {
  designDocs: DesignDocs
}

interface MarkdownSectionProps {
  content: string
  title?: string
}

// Simple markdown-style text renderer
function MarkdownSection({ content, title }: MarkdownSectionProps) {
  if (!content) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <div className="text-sm">コンテンツがありません</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {title && <h3 className="text-lg font-semibold">{title}</h3>}
      <ScrollArea className="h-[600px]">
        <pre className="whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm font-mono">
          {content}
        </pre>
      </ScrollArea>
    </div>
  )
}

interface JsonViewerProps {
  data: any
  title?: string
}

function JsonViewer({ data, title }: JsonViewerProps) {
  if (!data) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Code className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <div className="text-sm">データがありません</div>
        </div>
      </div>
    )
  }

  const jsonString = JSON.stringify(data, null, 2)

  return (
    <div className="space-y-3">
      {title && <h3 className="text-lg font-semibold">{title}</h3>}
      <ScrollArea className="h-[600px]">
        <pre className="rounded-lg bg-muted p-4 text-sm font-mono">{jsonString}</pre>
      </ScrollArea>
    </div>
  )
}

export function DesignDocsViewer({ designDocs }: DesignDocsViewerProps) {
  const hasOverall = Boolean(designDocs.overall)
  const hasUiux = Boolean(designDocs.uiux?.wireframes)
  const hasDatabase = Boolean(designDocs.database?.erDiagram)
  const hasInterfaces = Boolean(designDocs.interfaces?.apiSpec)

  if (!hasOverall && !hasUiux && !hasDatabase && !hasInterfaces) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <FileText className="mx-auto mb-4 h-16 w-16 opacity-50" />
          <div className="text-lg font-semibold">設計ドキュメントがありません</div>
          <div className="mt-2 text-sm">
            設計ドキュメントが作成されると、ここに表示されます
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <div className="space-y-4 p-6">
        {/* Header */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>設計ドキュメント</CardTitle>
            </div>
            <CardDescription>
              プロジェクトの全体設計、UI/UX、データベース、API仕様
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Tabs for different sections */}
        <Tabs defaultValue="overall" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overall" disabled={!hasOverall}>
              <FileText className="mr-2 h-4 w-4" />
              全体設計
              {!hasOverall && <Badge variant="outline" className="ml-2 text-xs">N/A</Badge>}
            </TabsTrigger>
            <TabsTrigger value="uiux" disabled={!hasUiux}>
              <Layout className="mr-2 h-4 w-4" />
              UI/UX
              {!hasUiux && <Badge variant="outline" className="ml-2 text-xs">N/A</Badge>}
            </TabsTrigger>
            <TabsTrigger value="database" disabled={!hasDatabase}>
              <Database className="mr-2 h-4 w-4" />
              DB設計
              {!hasDatabase && <Badge variant="outline" className="ml-2 text-xs">N/A</Badge>}
            </TabsTrigger>
            <TabsTrigger value="interfaces" disabled={!hasInterfaces}>
              <Code className="mr-2 h-4 w-4" />
              API仕様
              {!hasInterfaces && <Badge variant="outline" className="ml-2 text-xs">N/A</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* Overall Design */}
          <TabsContent value="overall" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">全体設計</CardTitle>
                <CardDescription>システム全体のアーキテクチャと設計方針</CardDescription>
              </CardHeader>
              <CardContent>
                <MarkdownSection content={designDocs.overall} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* UI/UX Design */}
          <TabsContent value="uiux" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">UI/UX設計</CardTitle>
                <CardDescription>ワイヤーフレームと画面設計</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {designDocs.uiux?.wireframes && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Layout className="h-4 w-4" />
                      ワイヤーフレーム
                    </h4>
                    <MarkdownSection content={designDocs.uiux.wireframes} />
                  </div>
                )}

                {designDocs.uiux?.screens && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Image className="h-4 w-4" />
                      画面定義
                    </h4>
                    <JsonViewer data={designDocs.uiux.screens} />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Database Design */}
          <TabsContent value="database" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">データベース設計</CardTitle>
                <CardDescription>ER図とスキーマ定義</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {designDocs.database?.erDiagram && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Database className="h-4 w-4" />
                      ER図
                    </h4>
                    <MarkdownSection content={designDocs.database.erDiagram} />
                  </div>
                )}

                {designDocs.database?.schema && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Code className="h-4 w-4" />
                      スキーマ定義
                    </h4>
                    <JsonViewer data={designDocs.database.schema} />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Interfaces */}
          <TabsContent value="interfaces" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">API仕様</CardTitle>
                <CardDescription>インターフェース定義とエンドポイント</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {designDocs.interfaces?.apiSpec && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <FileText className="h-4 w-4" />
                      API仕様書
                    </h4>
                    <MarkdownSection content={designDocs.interfaces.apiSpec} />
                  </div>
                )}

                {designDocs.interfaces?.apiSpecJson && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Code className="h-4 w-4" />
                      OpenAPI仕様
                    </h4>
                    <JsonViewer data={designDocs.interfaces.apiSpecJson} />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
