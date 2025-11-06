# Component Specification

**プロジェクト**: Kugutsu 2.0 - AI Parallel Development System
**バージョン**: 1.0.0
**最終更新**: 2025-11-06
**対象**: Phase 3 - UIコンポーネント
**ステータス**: Draft

---

## 1. 概要

本仕様書は、Kugutsu 2.0のUIを構成する各Reactコンポーネントの詳細仕様を定義します。React 19の新機能を活用し、再利用可能かつ保守しやすいコンポーネント設計を実現します。

### 1.1 設計原則

1. **単一責任の原則**: 各コンポーネントは1つの責務のみを持つ
2. **合成優先**: 小さなコンポーネントを組み合わせて複雑なUIを構築
3. **型安全性**: TypeScriptによる完全な型定義
4. **テスタビリティ**: ユニットテストが容易な設計
5. **再利用性**: 異なる文脈で使えるよう汎用化

### 1.2 React 19対応

Kugutsu 2.0は、React 19.2.0の新機能を活用し、最新のReactベストプラクティスに従います。

#### 1.2.1 forwardRef の非推奨化

React 19では`forwardRef`が非推奨となり、refはpropsとして直接受け取れるようになりました。

```typescript
// ❌ 非推奨（React 18以前）
import { forwardRef } from 'react';

const MyInput = forwardRef<HTMLInputElement, MyInputProps>((props, ref) => {
  return <input ref={ref} {...props} />;
});

// ✅ 推奨（React 19）
interface MyInputProps {
  ref?: React.Ref<HTMLInputElement>;
  // 他のprops
}

function MyInput({ ref, ...props }: MyInputProps) {
  return <input ref={ref} {...props} />;
}
```

**注意**: memo()との併用時もrefはpropsとして受け取ります。

```typescript
export const MyInput = memo(function MyInput({ ref, ...props }: MyInputProps) {
  return <input ref={ref} {...props} />;
});
```

#### 1.2.2 use Hook

React 19では、PromiseやContextを簡潔に扱える`use` Hookが導入されました。

```typescript
import { use } from 'react';

function TaskDetails({ taskPromise }: { taskPromise: Promise<Task> }) {
  // Promiseが解決されるまでSuspendし、解決後にデータを返す
  const task = use(taskPromise);

  return (
    <div>
      <h2>{task.title}</h2>
      <p>{task.description}</p>
    </div>
  );
}

// 使用例
function App() {
  const taskPromise = fetchTask('task-1');

  return (
    <Suspense fallback={<Loading />}>
      <TaskDetails taskPromise={taskPromise} />
    </Suspense>
  );
}
```

**Contextとの併用**:
```typescript
import { use } from 'react';
import { ThemeContext } from './ThemeContext';

function ThemedButton() {
  const theme = use(ThemeContext); // useContext の代替
  return <button className={theme.buttonClass}>Click me</button>;
}
```

#### 1.2.3 Suspenseの改善

React 19では、Suspenseの動作が改善され、より細かな制御が可能になりました。

```typescript
import { Suspense } from 'react';

export function App() {
  return (
    <Suspense fallback={<GlobalLoading />}>
      <Header />
      <Suspense fallback={<MainLoading />}>
        <MainLayout />
      </Suspense>
      <Suspense fallback={<LogsLoading />}>
        <BottomPanel />
      </Suspense>
    </Suspense>
  );
}
```

**ネストされたSuspense**: 各領域ごとに独立したローディング状態を管理できます。

#### 1.2.4 Server Components（将来対応予定）

現在のKugutsu 2.0はクライアントサイドのみのElectronアプリですが、React 19のServer Componentsアーキテクチャを考慮した設計とします。

- データフェッチはサーバー側に移行可能な設計
- クライアントコンポーネントは`'use client'`ディレクティブの追加で対応可能

---

## 2. コンポーネント階層

```
App
├─ Header
│   ├─ Logo
│   ├─ Controls
│   │   ├─ PlayPauseButton
│   │   ├─ StopButton
│   │   └─ SettingsButton
│   └─ ProgressBar
│       ├─ PhaseIndicator
│       └─ TaskCounter
│
├─ MainLayout
│   ├─ LeftPanel
│   │   └─ GraphVisualization
│   │       ├─ ReactFlow
│   │       ├─ CustomNode (動的)
│   │       ├─ Background
│   │       ├─ Controls
│   │       └─ MiniMap
│   │
│   └─ RightPanel
│       └─ TaskKanbanBoard
│           ├─ KanbanColumn (Pending)
│           │   ├─ ColumnHeader
│           │   └─ TaskCard[]
│           ├─ KanbanColumn (In Progress)
│           │   ├─ ColumnHeader
│           │   └─ TaskCard[]
│           ├─ KanbanColumn (Completed)
│           │   ├─ ColumnHeader
│           │   └─ TaskCard[]
│           └─ KanbanColumn (Failed)
│               ├─ ColumnHeader
│               └─ TaskCard[]
│
└─ BottomPanel
    └─ LogViewer
        ├─ LogToolbar
        │   ├─ LevelFilter
        │   └─ SearchInput
        └─ VirtualizedLogList
            └─ LogEntry[]
```

---

## 3. コンポーネント詳細仕様

### 3.1 App

**ファイル**: `src/electron/renderer/App.tsx`

**責務**: アプリケーション全体のレイアウトとグローバル状態管理

**型定義**:
```typescript
export function App(): JSX.Element;
```

**実装例**:
```typescript
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { Header } from './components/Header';
import { MainLayout } from './components/MainLayout';
import { BottomPanel } from './components/BottomPanel';
import { ErrorBoundary } from './components/ErrorBoundary';

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <div className="app h-screen flex flex-col bg-background">
          <Header />
          <MainLayout />
          <BottomPanel />
        </div>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
```

---

### 3.2 Header

**ファイル**: `src/electron/renderer/components/Header.tsx`

**責務**: アプリケーションヘッダー（ロゴ、コントロール、進捗表示）

**型定義**:
```typescript
export function Header(): JSX.Element;
```

**実装例**:
```typescript
import { Logo } from './Logo';
import { Controls } from './Controls';
import { ProgressBar } from './ProgressBar';

export function Header() {
  return (
    <header className="header h-16 border-b border-border flex items-center justify-between px-4">
      <Logo />
      <Controls />
      <ProgressBar />
    </header>
  );
}
```

---

### 3.3 Controls

**ファイル**: `src/electron/renderer/components/Controls.tsx`

**責務**: 実行制御ボタン（Pause/Resume/Stop/Settings）

**Props**:
```typescript
interface ControlsProps {
  // Propsなし（グローバル状態から取得）
}
```

**実装例**:
```typescript
import { useAppStore } from '../store/appStore';
import { useMutation } from '@tanstack/react-query';
import { Button } from './ui/button';
import { Play, Pause, Square, Settings } from 'lucide-react';

export function Controls() {
  const { isPaused } = useAppStore();

  const pauseMutation = useMutation({
    mutationFn: () => window.electronAPI.pauseExecution(),
    onSuccess: ({ success }) => {
      if (success) {
        useAppStore.getState().pause();
      }
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => window.electronAPI.resumeExecution(),
    onSuccess: ({ success }) => {
      if (success) {
        useAppStore.getState().resume();
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => window.electronAPI.cancelExecution(),
  });

  return (
    <div className="controls flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => isPaused ? resumeMutation.mutate() : pauseMutation.mutate()}
        aria-label={isPaused ? '実行を再開' : '実行を一時停止'}
      >
        {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        <span className="ml-2">{isPaused ? 'Resume' : 'Pause'}</span>
      </Button>

      <Button
        variant="destructive"
        size="sm"
        onClick={() => cancelMutation.mutate()}
        aria-label="実行を停止"
      >
        <Square className="h-4 w-4" />
        <span className="ml-2">Stop</span>
      </Button>

      <Button variant="ghost" size="sm" aria-label="設定を開く">
        <Settings className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

---

### 3.4 ProgressBar

**ファイル**: `src/electron/renderer/components/ProgressBar.tsx`

**責務**: 実行進捗の表示

**Props**:
```typescript
interface ProgressBarProps {
  // Propsなし（グローバル状態から取得）
}
```

**実装例**:
```typescript
import { useAppStore } from '../store/appStore';
import { Progress } from './ui/progress';

export function ProgressBar() {
  const { tasks, metadata } = useAppStore();

  const totalTasks = metadata.totalTasks;
  const completedTasks = metadata.tasksCompleted;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <div className="progress-bar flex items-center gap-4 w-64">
      <Progress value={progress} className="flex-1" />
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        {completedTasks} / {totalTasks}
      </span>
    </div>
  );
}
```

---

### 3.5 TaskKanbanBoard

**ファイル**: `src/electron/renderer/components/TaskKanbanBoard.tsx`

**責務**: タスクをカンバンボード形式で表示

**Props**:
```typescript
interface TaskKanbanBoardProps {
  // Propsなし（グローバル状態から取得）
}
```

**実装例**:
```typescript
import { useAppStore } from '../store/appStore';
import { KanbanColumn } from './KanbanColumn';
import type { TaskStatus } from '../../graph/types';

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'pending', label: 'Pending', color: 'amber' },
  { status: 'in_progress', label: 'In Progress', color: 'blue' },
  { status: 'completed', label: 'Completed', color: 'green' },
  { status: 'failed', label: 'Failed', color: 'red' },
];

export function TaskKanbanBoard() {
  const { tasks } = useAppStore();

  return (
    <div className="task-kanban-board grid grid-cols-4 gap-4 h-full p-4">
      {COLUMNS.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.status);
        return (
          <KanbanColumn
            key={column.status}
            status={column.status}
            label={column.label}
            color={column.color}
            tasks={columnTasks}
          />
        );
      })}
    </div>
  );
}
```

---

### 3.6 KanbanColumn

**ファイル**: `src/electron/renderer/components/KanbanColumn.tsx`

**責務**: カンバンボードの1つの列

**Props**:
```typescript
import type { Task, TaskStatus } from '../../graph/types';

interface KanbanColumnProps {
  status: TaskStatus;
  label: string;
  color: string;
  tasks: Task[];
}
```

**実装例**:
```typescript
import { TaskCard } from './TaskCard';
import { Badge } from './ui/badge';

export function KanbanColumn({ status, label, color, tasks }: KanbanColumnProps) {
  return (
    <div className="kanban-column flex flex-col h-full border border-border rounded-lg">
      {/* ヘッダー */}
      <div className="column-header p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{label}</h3>
          <Badge variant="secondary" className={`bg-${color}-100 text-${color}-800`}>
            {tasks.length}
          </Badge>
        </div>
      </div>

      {/* タスクリスト */}
      <div className="column-body flex-1 overflow-y-auto p-2 space-y-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
```

---

### 3.7 TaskCard

**ファイル**: `src/electron/renderer/components/TaskCard.tsx`

**責務**: タスクカードの表示（依存関係表示機能含む）

**Props**:
```typescript
import type { Task } from '../../graph/types';

interface TaskCardProps {
  task: Task;
  onTaskClick?: (taskId: string) => void;
}
```

**実装例**:
```typescript
import { Card, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { GitBranch } from 'lucide-react';

export function TaskCard({ task, onTaskClick }: TaskCardProps) {
  const priorityColor = task.priority >= 70 ? 'red' : task.priority >= 40 ? 'amber' : 'green';
  const hasDependencies = task.dependencies && task.dependencies.length > 0;

  return (
    <Card
      className="task-card cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onTaskClick?.(task.id)}
    >
      <CardHeader className="p-3">
        <div className="flex items-start justify-between mb-2">
          <CardTitle className="text-sm font-medium line-clamp-2">
            {task.title}
          </CardTitle>
          <div className="flex gap-1">
            <Badge
              variant="outline"
              className={`text-xs bg-${priorityColor}-50 text-${priorityColor}-700 border-${priorityColor}-200`}
            >
              P{task.priority}
            </Badge>
            {hasDependencies && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="secondary" className="text-xs">
                      <GitBranch className="h-3 w-3 mr-1" />
                      {task.dependencies.length}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{task.dependencies.length}個のタスクに依存</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        <CardDescription className="text-xs line-clamp-2">
          {task.description}
        </CardDescription>

        {task.assignedEngineer && (
          <div className="mt-2 text-xs text-muted-foreground">
            👤 {task.assignedEngineer}
          </div>
        )}

        {task.tags && task.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {task.tags.slice(0, 3).map(tag => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
    </Card>
  );
}
```

---

### 3.8 DependencyGraphViewer

**ファイル**: `src/electron/renderer/components/DependencyGraphViewer.tsx`

**責務**: タスク依存関係グラフの可視化

**Props**:
```typescript
import type { DependencyGraph } from '../../graph/types';

interface DependencyGraphViewerProps {
  dependencyGraph: DependencyGraph;
  onNodeClick?: (taskId: string) => void;
}
```

**実装例**:
```typescript
import { useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const nodeTypes = {
  task: TaskNode
};

export function DependencyGraphViewer({ dependencyGraph, onNodeClick }: DependencyGraphViewerProps) {
  // グラフデータをReactFlow形式に変換
  const initialNodes: Node[] = dependencyGraph.graph.nodes.map(node => ({
    id: node.id,
    type: 'task',
    position: { x: node.layer * 250, y: Math.random() * 400 },
    data: {
      label: node.id,
      layer: node.layer
    }
  }));

  const initialEdges: Edge[] = dependencyGraph.graph.edges.map((edge, index) => ({
    id: `edge-${index}`,
    source: edge.from,
    target: edge.to,
    type: 'smoothstep',
    animated: true,
    markerEnd: {
      type: MarkerType.ArrowClosed
    }
  }));

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClickHandler = useCallback((event: React.MouseEvent, node: Node) => {
    onNodeClick?.(node.id);
  }, [onNodeClick]);

  return (
    <div className="dependency-graph-viewer h-full w-full border border-border rounded-lg">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClickHandler}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}

// カスタムノードコンポーネント
function TaskNode({ data }: { data: any }) {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-blue-500">
      <div className="text-sm font-bold">{data.label}</div>
      <div className="text-xs text-gray-500">Layer {data.layer}</div>
    </div>
  );
}
```

---

### 3.9 StoryMappingViewer

**ファイル**: `src/electron/renderer/components/StoryMappingViewer.tsx`

**責務**: ユーザーストーリーマッピングの表示

**Props**:
```typescript
import type { StoryMapping } from '../../graph/types';

interface StoryMappingViewerProps {
  storyMapping: StoryMapping;
}
```

**実装例**:
```typescript
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';

export function StoryMappingViewer({ storyMapping }: StoryMappingViewerProps) {
  return (
    <div className="story-mapping-viewer space-y-6 p-4">
      {/* ペルソナ */}
      <Card>
        <CardHeader>
          <CardTitle>ペルソナ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div><strong>名前:</strong> {storyMapping.persona.name}</div>
          <div><strong>役割:</strong> {storyMapping.persona.role}</div>
          <div><strong>ゴール:</strong> {storyMapping.persona.goal}</div>
          {storyMapping.persona.painPoints && storyMapping.persona.painPoints.length > 0 && (
            <div>
              <strong>ペインポイント:</strong>
              <ul className="list-disc list-inside mt-1">
                {storyMapping.persona.painPoints.map((pain, index) => (
                  <li key={index}>{pain}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* エピック一覧 */}
      <div className="epics-section">
        <h2 className="text-2xl font-bold mb-4">エピック</h2>
        <Accordion type="single" collapsible className="space-y-2">
          {storyMapping.epics.map((epic) => (
            <AccordionItem key={epic.id} value={epic.id}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <span className="font-semibold">{epic.title}</span>
                  <div className="flex gap-2">
                    <Badge variant="secondary">
                      {epic.stories.length} stories
                    </Badge>
                    <Badge variant="outline">P{epic.priority}</Badge>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pl-4">
                  <p className="text-sm text-muted-foreground">{epic.description}</p>

                  {/* ストーリー一覧 */}
                  <div className="space-y-3">
                    {epic.stories.map((story) => (
                      <Card key={story.id}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-base">{story.title}</CardTitle>
                            <div className="flex gap-1">
                              <Badge variant="outline">P{story.priority}</Badge>
                              <Badge variant="secondary">{story.estimatedPoints}pt</Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div><strong>As a</strong> {story.asA}</div>
                          <div><strong>I want to</strong> {story.iWantTo}</div>
                          <div><strong>So that</strong> {story.soThat}</div>

                          <div>
                            <strong>受入基準:</strong>
                            <ul className="list-disc list-inside mt-1">
                              {story.acceptanceCriteria.map((criteria, index) => (
                                <li key={index}>{criteria}</li>
                              ))}
                            </ul>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
```

---

### 3.10 DesignDocsViewer

**ファイル**: `src/electron/renderer/components/DesignDocsViewer.tsx`

**責務**: 設計書の表示

**Props**:
```typescript
import type { DesignDocs } from '../../graph/types';

interface DesignDocsViewerProps {
  designDocs: DesignDocs;
}
```

**実装例**:
```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export function DesignDocsViewer({ designDocs }: DesignDocsViewerProps) {
  return (
    <div className="design-docs-viewer h-full">
      <Tabs defaultValue="overall" className="h-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overall">全体設計</TabsTrigger>
          <TabsTrigger value="uiux">UI/UX</TabsTrigger>
          <TabsTrigger value="database">DB設計</TabsTrigger>
          <TabsTrigger value="api">API設計</TabsTrigger>
        </TabsList>

        <TabsContent value="overall" className="h-full overflow-auto p-4">
          <ReactMarkdown
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="div"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              }
            }}
          >
            {designDocs.overall}
          </ReactMarkdown>
        </TabsContent>

        <TabsContent value="uiux" className="h-full overflow-auto p-4">
          <ReactMarkdown>{designDocs.uiux.wireframes}</ReactMarkdown>
        </TabsContent>

        <TabsContent value="database" className="h-full overflow-auto p-4">
          <ReactMarkdown>{designDocs.database.erDiagram}</ReactMarkdown>
        </TabsContent>

        <TabsContent value="api" className="h-full overflow-auto p-4">
          <ReactMarkdown>{designDocs.interfaces.apiSpec}</ReactMarkdown>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

### 3.11 LogViewer

---

### 3.8 LogViewer

**ファイル**: `src/electron/renderer/components/LogViewer.tsx`

**責務**: ログのストリーミング表示

**Props**:
```typescript
interface LogViewerProps {
  // Propsなし（グローバル状態から取得）
}
```

**実装例**:
```typescript
import { useAppStore } from '../store/appStore';
import { LogToolbar } from './LogToolbar';
import { VirtualizedLogList } from './VirtualizedLogList';

export function LogViewer() {
  const { logs, logFilter } = useAppStore();

  // フィルタリング
  const filteredLogs = logs.filter((log) => {
    if (logFilter.level !== 'all' && log.level !== logFilter.level) {
      return false;
    }
    if (logFilter.search && !log.message.includes(logFilter.search)) {
      return false;
    }
    return true;
  });

  return (
    <div className="log-viewer flex flex-col h-full border-t border-border">
      <LogToolbar />
      <VirtualizedLogList logs={filteredLogs} />
    </div>
  );
}
```

---

### 3.9 VirtualizedLogList

**ファイル**: `src/electron/renderer/components/VirtualizedLogList.tsx`

**責務**: 仮想スクロールによる効率的なログ表示

**Props**:
```typescript
import type { LogEntry } from '../../graph/types';

interface VirtualizedLogListProps {
  logs: LogEntry[];
}
```

**実装例**:
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useEffect } from 'react';
import { LogEntryComponent } from './LogEntry';

export function VirtualizedLogList({ logs }: VirtualizedLogListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollingRef = useRef<number>(0);

  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28, // ログエントリの推定高さ
    overscan: 10, // 画面外の行数
  });

  // 自動スクロール（最新ログを表示）
  useEffect(() => {
    if (scrollingRef.current === 0 && logs.length > 0) {
      virtualizer.scrollToIndex(logs.length - 1, { align: 'end' });
    }
  }, [logs.length, virtualizer]);

  return (
    <div
      ref={parentRef}
      className="log-list flex-1 overflow-auto bg-muted/30 font-mono text-xs"
      onScroll={() => {
        scrollingRef.current = Date.now();
        setTimeout(() => {
          if (Date.now() - scrollingRef.current > 1000) {
            scrollingRef.current = 0;
          }
        }, 1100);
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const log = logs[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <LogEntryComponent log={log} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

### 3.10 LogEntry

**ファイル**: `src/electron/renderer/components/LogEntry.tsx`

**責務**: 1つのログエントリの表示

**Props**:
```typescript
import type { LogEntry } from '../../graph/types';

interface LogEntryComponentProps {
  log: LogEntry;
}
```

**実装例**:
```typescript
import { memo } from 'react';
import { cn } from '../lib/utils';

const LOG_LEVEL_COLORS = {
  debug: 'text-gray-500',
  info: 'text-blue-600',
  warn: 'text-amber-600',
  error: 'text-red-600',
};

const LOG_LEVEL_ICONS = {
  debug: '🐛',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
};

export const LogEntryComponent = memo(function LogEntry({ log }: LogEntryComponentProps) {
  const levelColor = LOG_LEVEL_COLORS[log.level] || LOG_LEVEL_COLORS.info;
  const levelIcon = LOG_LEVEL_ICONS[log.level] || LOG_LEVEL_ICONS.info;

  return (
    <div className="log-entry px-2 py-1 hover:bg-muted/50 flex gap-2">
      <span className="log-icon w-4 flex-shrink-0">{levelIcon}</span>
      <span className={cn('log-level w-12 flex-shrink-0 font-semibold', levelColor)}>
        {log.level.toUpperCase()}
      </span>
      <span className="log-timestamp w-20 flex-shrink-0 text-muted-foreground">
        {new Date(log.timestamp).toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })}
      </span>
      <span className="log-source w-32 flex-shrink-0 text-muted-foreground">
        {log.source}
      </span>
      <span className="log-message flex-1">{log.message}</span>
    </div>
  );
});
```

---

### 3.11 GraphVisualization

**ファイル**: `src/electron/renderer/components/GraphVisualization.tsx`

**責務**: LangGraphのリアルタイム可視化

**Props**:
```typescript
interface GraphVisualizationProps {
  // Propsなし（グローバル状態から取得）
}
```

**実装**: `GRAPH_VISUALIZATION_SPECIFICATION.md` を参照

---

## 4. 共通UIコンポーネント（shadcn/ui）

### 4.1 使用するコンポーネント

shadcn/uiから以下のコンポーネントを使用：

```bash
npx shadcn@canary add button
npx shadcn@canary add card
npx shadcn@canary add badge
npx shadcn@canary add progress
npx shadcn@canary add input
npx shadcn@canary add dialog
npx shadcn@canary add dropdown-menu
npx shadcn@canary add tooltip
```

### 4.2 カスタマイズ

```typescript
// src/electron/renderer/lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## 5. カスタムフック

### 5.1 useGraphSyncWithIPC

**ファイル**: `src/electron/renderer/hooks/useGraphSyncWithIPC.ts`

**責務**: IPCイベントとグラフ状態の同期

```typescript
import { useEffect } from 'react';
import { useGraphStore } from '../store/graphStore';

export function useGraphSyncWithIPC() {
  const { updateNodeStatus, setCurrentNode } = useGraphStore();

  useEffect(() => {
    const unsubscribe = window.electronAPI.onGraphEventsBatch((events) => {
      events.forEach((event) => {
        switch (event.type) {
          case 'node-started':
            setCurrentNode(event.data.nodeId);
            break;

          case 'node-completed':
            updateNodeStatus(event.data.nodeId, 'completed');
            setCurrentNode(null);
            break;

          case 'node-failed':
            updateNodeStatus(event.data.nodeId, 'failed');
            setCurrentNode(null);
            break;
        }
      });
    });

    return () => unsubscribe();
  }, [updateNodeStatus, setCurrentNode]);
}
```

### 5.2 useTasksSyncWithIPC

**ファイル**: `src/electron/renderer/hooks/useTasksSyncWithIPC.ts`

**責務**: タスク状態の同期

```typescript
import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';

export function useTasksSyncWithIPC() {
  const { updateTasks } = useAppStore();

  useEffect(() => {
    const unsubscribe = window.electronAPI.onGraphEventsBatch((events) => {
      events.forEach((event) => {
        if (event.type === 'tasks-batch') {
          updateTasks(event.data);
        }
      });
    });

    return () => unsubscribe();
  }, [updateTasks]);
}
```

### 5.3 useLogsSyncWithIPC

**ファイル**: `src/electron/renderer/hooks/useLogsSyncWithIPC.ts`

**責務**: ログの同期

```typescript
import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';

export function useLogsSyncWithIPC() {
  const { addLogs } = useAppStore();

  useEffect(() => {
    const unsubscribe = window.electronAPI.onGraphEventsBatch((events) => {
      events.forEach((event) => {
        if (event.type === 'logs-batch') {
          addLogs(event.data);
        }
      });
    });

    return () => unsubscribe();
  }, [addLogs]);
}
```

---

## 6. エラーバウンダリ

### 6.1 ErrorBoundary

**ファイル**: `src/electron/renderer/components/ErrorBoundary.tsx`

**責務**: ReactエラーのキャッチとフォールバックUI表示

```typescript
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    window.electronAPI.logError(error.message, {
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary flex items-center justify-center h-screen bg-background">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>予期しないエラーが発生しました</CardTitle>
              <CardDescription className="mt-4">
                {this.state.error?.message}
              </CardDescription>
              <Button
                onClick={() => window.location.reload()}
                className="mt-4"
              >
                再読み込み
              </Button>
            </CardHeader>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## 7. パフォーマンス最適化

### 7.1 メモ化戦略

#### コンポーネントのメモ化

```typescript
import { memo } from 'react';

// ❌ 非推奨
export function TaskCard({ task }: TaskCardProps) {
  // ...
}

// ✅ 推奨
export const TaskCard = memo(function TaskCard({ task }: TaskCardProps) {
  // ...
});
```

#### 値のメモ化

```typescript
import { useMemo } from 'react';

function TaskKanbanBoard() {
  const { tasks } = useAppStore();

  const groupedTasks = useMemo(() => {
    return {
      pending: tasks.filter(t => t.status === 'pending'),
      in_progress: tasks.filter(t => t.status === 'in_progress'),
      completed: tasks.filter(t => t.status === 'completed'),
      failed: tasks.filter(t => t.status === 'failed'),
    };
  }, [tasks]);

  // ...
}
```

#### コールバックのメモ化

```typescript
import { useCallback } from 'react';

function Controls() {
  const handlePause = useCallback(() => {
    window.electronAPI.pauseExecution();
  }, []);

  // ...
}
```

---

## 8. テスト戦略

### 8.1 ユニットテスト

```typescript
import { render, screen } from '@testing-library/react';
import { TaskCard } from './TaskCard';

describe('TaskCard', () => {
  const mockTask: Task = {
    id: 'task-1',
    title: 'Test Task',
    description: 'Test Description',
    status: 'in_progress',
    priority: 50,
    dependencies: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should render task title', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('should render task description', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('Test Description')).toBeInTheDocument();
  });

  it('should render priority badge', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('P50')).toBeInTheDocument();
  });
});
```

### 8.2 インテグレーションテスト

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { TaskKanbanBoard } from './TaskKanbanBoard';

// グローバルモック
global.window.electronAPI = {
  onGraphEventsBatch: jest.fn(() => jest.fn()),
  // ...
};

describe('TaskKanbanBoard Integration', () => {
  it('should display tasks in correct columns', async () => {
    // ストアにモックデータをセット
    useAppStore.getState().updateTasks([
      { id: 'task-1', status: 'pending', ... },
      { id: 'task-2', status: 'in_progress', ... },
      { id: 'task-3', status: 'completed', ... },
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <TaskKanbanBoard />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
  });
});
```

---

## 9. アクセシビリティ

### 9.1 キーボードナビゲーション

すべてのインタラクティブ要素はキーボードで操作可能：

```typescript
<Button
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
  tabIndex={0}
  aria-label="実行を一時停止"
>
  Pause
</Button>
```

### 9.2 ARIA属性

```typescript
<div
  role="log"
  aria-live="polite"
  aria-atomic="false"
  aria-label="実行ログ"
>
  {/* ログエントリ */}
</div>
```

---

## 10. スタイリング規約

### 10.1 Tailwind CSS v4

```typescript
// ✅ 推奨
<div className="flex items-center gap-4 p-4 bg-background text-foreground">

// ❌ 非推奨（インラインスタイル）
<div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
```

### 10.2 cn()ユーティリティ

```typescript
import { cn } from '../lib/utils';

<div className={cn(
  'base-class',
  isActive && 'active-class',
  'another-class'
)}>
```

---

## 11. ファイル構成

```
src/electron/renderer/
├── App.tsx
├── index.tsx
├── components/
│   ├── Header.tsx
│   ├── Logo.tsx
│   ├── Controls.tsx
│   ├── ProgressBar.tsx
│   ├── MainLayout.tsx
│   ├── GraphVisualization.tsx
│   ├── TaskKanbanBoard.tsx
│   ├── KanbanColumn.tsx
│   ├── TaskCard.tsx
│   ├── LogViewer.tsx
│   ├── LogToolbar.tsx
│   ├── VirtualizedLogList.tsx
│   ├── LogEntry.tsx
│   ├── ErrorBoundary.tsx
│   └── ui/              # shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── badge.tsx
│       ├── progress.tsx
│       └── ...
├── hooks/
│   ├── useGraphSyncWithIPC.ts
│   ├── useTasksSyncWithIPC.ts
│   └── useLogsSyncWithIPC.ts
├── store/
│   ├── appStore.ts
│   └── graphStore.ts
├── lib/
│   ├── utils.ts
│   ├── queryClient.ts
│   └── constants.ts
└── types/
    └── index.ts
```

---

## 11. スプリント関連コンポーネント

### 11.1 SprintInfoPanel

**責務**: アクティブスプリント情報の表示

**Props**:
```typescript
interface SprintInfoPanelProps {
  sprint: Sprint | null;
  tasks: GlobalTask[];
  onTaskClick: (taskId: string) => void;
}
```

**主要機能**: スプリントゴール、進捗率、タスクリスト表示

### 11.2 SprintHistoryTimeline

**責務**: スプリント履歴のタイムライン表示

**Props**:
```typescript
interface SprintHistoryTimelineProps {
  sprints: Sprint[];
  limit?: number; // デフォルト: 3
  onSprintClick: (sprintId: string) => void;
}
```

**主要機能**: 時系列順にスプリントカードを表示

### 11.3 GlobalTaskQueue

**責務**: グローバルタスクキューのリスト表示

**Props**:
```typescript
interface GlobalTaskQueueProps {
  tasks: GlobalTask[];
  projects: Map<string, ProjectMetadata>;
  sortBy: 'priority' | 'recency' | 'dependency';
  filterProjects: string[];
  onTaskSelect: (taskId: string) => void;
}
```

**主要機能**: ソート、フィルター、ページネーション

### 11.4 SprintPlanningDialog

**責務**: AI駆動スプリント計画の確認・編集UI

**Props**:
```typescript
interface SprintPlanningDialogProps {
  plannedSprint: Sprint;
  tasks: GlobalTask[];
  onApprove: () => void;
  onReject: () => void;
  onEdit: (updatedSprint: Sprint) => void;
}
```

**主要機能**: AI提案の表示、編集、承認/拒否

---

## 12. 参考資料

- [React 19 Documentation](https://react.dev/)
- [shadcn/ui React 19 Guide](https://ui.shadcn.com/docs/react-19)
- [@tanstack/react-query](https://tanstack.com/query/latest)
- [@tanstack/react-virtual](https://tanstack.com/virtual/latest)

---

**最終更新**: 2025-11-05
**バージョン**: 1.0.0
**承認**: 待機中
