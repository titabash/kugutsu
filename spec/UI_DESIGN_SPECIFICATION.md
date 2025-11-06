# UI Design Specification

**プロジェクト**: Kugutsu 2.0 - AI Parallel Development System
**バージョン**: 1.0.0
**最終更新**: 2025-11-06
**対象**: Phase 3 - UI統合
**ステータス**: Draft

---

## 1. 概要

本仕様書は、Kugutsu 2.0のElectronベースUIの設計仕様を定義します。LangGraphによる並列開発プロセスをリアルタイムかつ直感的に可視化し、ユーザーが開発の進捗を把握しやすいインターフェースを提供します。

### 1.1 ドキュメントの目的

- UIアーキテクチャの明確化
- 実装ガイドラインの提供
- 拡張性・保守性の担保
- パフォーマンス要件の定義

### 1.2 対象読者

- フロントエンド開発者
- UI/UXデザイナー
- プロジェクトマネージャー
- QAエンジニア

---

## 2. システム要件

### 2.1 機能要件

#### FR-1: リアルタイム可視化
- LangGraphの実行状態をリアルタイムで表示
- 状態更新の遅延は100ms以内
- 複数タスクの並列実行を視覚的に表現

#### FR-2: タスク管理（カンバンボード形式）
- 4列のカンバンボード（Pending, In Progress, Completed, Failed）
- タスクカードの表示（タイトル、説明、優先度、担当エンジニア）
- タスクの詳細情報モーダル
- リアルタイムでのタスクステータス更新
- 各列のタスク数表示
- ドラッグ&ドロップ機能（Phase 4以降で実装予定）

#### FR-3: ログビューア
- ログのストリーミング表示
- ログレベルフィルタ（debug, info, warn, error）
- 検索機能
- 自動スクロール

#### FR-4: グラフビジュアライゼーション
- LangGraphノードのリアルタイム表示
- ノードの実行状態表示（pending, running, completed, failed）
- エッジの表示
- ズーム・パン操作

#### FR-5: 操作コントロール
- 実行の一時停止・再開
- 実行のキャンセル
- 設定変更

### 2.2 非機能要件

#### NFR-1: パフォーマンス
- 初回レンダリング: 2秒以内
- 状態更新のUIレンダリング: 100ms以内
- ログ表示遅延: 50ms以内
- 大量ログ（10,000行以上）でもスムーズなスクロール

#### NFR-2: 拡張性
- 新しいLangGraphノードの追加に対応
- UIコンポーネントの再利用性
- プラグイン機構（将来的）

#### NFR-3: ユーザビリティ
- 直感的な操作性
- レスポンシブデザイン（最小1280x720px）
- アクセシビリティ（WCAG 2.1 AA準拠）

#### NFR-4: セキュリティ
- contextBridgeによるセキュアなIPC
- XSS対策（Content Security Policy）
- 入力検証

---

## 3. 技術スタック

### 3.1 フロントエンド

| 技術 | バージョン | 用途 |
|------|----------|------|
| React | 19.2.0 | UIフレームワーク |
| TypeScript | 5.9.3 | 型安全性 |
| @xyflow/react | 12.9.2 | グラフビジュアライゼーション |
| Zustand | 5.0.8 | グローバル状態管理 |
| @tanstack/react-query | 5.90.6 | IPC通信・非同期状態管理 |
| @tanstack/react-virtual | 3.13.8 | 仮想スクロール |
| Tailwind CSS | 4.1 | スタイリング |
| shadcn/ui | latest (React 19対応) | UIコンポーネント |
| Vite | 7.1.12 | ビルドツール |

### 3.2 Electron

| 技術 | バージョン | 用途 |
|------|----------|------|
| Electron | 39.0.0 | デスクトップアプリケーション |
| electron-vite | 2.x | Electron + Vite統合（公式ツール） |
| electron-builder | 26.1.0 | パッケージング |

### 3.3 環境要件

| 環境 | バージョン | 備考 |
|------|----------|------|
| Node.js | 20.19+ または 22.12+ | Vite 7.xの要件 |
| npm | 10.x+ | パッケージマネージャー |
| OS | Windows 10+, macOS 11+, Linux | Electron 39対応OS |

**重要**: Vite 7はNode.js 18のサポートを終了しています。Node.js 20.19以上または22.12以上が必須です。

### 3.4 React 19の主要新機能活用

- **Server Components**: 今回は使用しない（Electronアプリのため）
- **Actions**: フォーム送信に活用
- **use Hook**: Promise/Contextの簡潔な使用
- **ref as prop**: forwardRefの廃止に対応
- **Suspense**: @tanstack/react-queryとの統合

---

## 4. アーキテクチャ設計

### 4.1 全体アーキテクチャ

```
┌────────────────────────────────────────────────────────────┐
│                    Main Process (Node.js 22.20.0)          │
│                                                              │
│  ┌────────────────────────────────────────────────────┐   │
│  │  ParallelDevOrchestrator                            │   │
│  │  - LangGraph実行                                     │   │
│  │  - ストリーム処理                                     │   │
│  └──────────────┬──────────────────────────────────────┘   │
│                 │                                           │
│  ┌──────────────▼──────────────────────────────────────┐   │
│  │  StateStreamManager                                  │   │
│  │  - Stream → IPC変換                                  │   │
│  │  - バッファリング（50ms）                             │   │
│  │  - スロットリング                                     │   │
│  │  - 差分検出                                          │   │
│  └──────────────┬──────────────────────────────────────┘   │
│                 │                                           │
│                 │ webContents.send()                        │
└─────────────────┼───────────────────────────────────────────┘
                  │
                  │ IPC
                  │
┌─────────────────▼───────────────────────────────────────────┐
│            Preload Script (contextBridge)                   │
│                                                              │
│  window.electronAPI = {                                     │
│    onGraphEventsBatch: (callback) => ...,                   │
│    pauseExecution: () => ...,                               │
│    resumeExecution: () => ...,                              │
│    cancelExecution: () => ...,                              │
│    getGraphState: () => ...,                                │
│  }                                                           │
└─────────────────┬────────────────────────────────────────────┘
                  │
                  │ window.electronAPI
                  │
┌─────────────────▼────────────────────────────────────────────┐
│              Renderer Process (React 19)                     │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │  App                                                │     │
│  │  ├─ Header                                          │     │
│  │  │   ├─ Controls (Pause/Resume/Cancel)             │     │
│  │  │   └─ ProgressBar                                │     │
│  │  ├─ Main Layout (2-column)                         │     │
│  │  │   ├─ Left: GraphVisualization (@xyflow/react)   │     │
│  │  │   └─ Right: TaskList                            │     │
│  │  └─ Bottom: LogViewer (@tanstack/react-virtual)    │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  State Management:                                           │
│  - Zustand Store (global state)                             │
│  - React Query (IPC calls)                                  │
│  - React Context (theme, settings)                          │
└───────────────────────────────────────────────────────────────┘
```

### 4.2 データフロー

```
LangGraph Execution (Main Process)
    │
    ├─ Node Started Event
    │     └─> State Update
    │           └─> StateStreamManager
    │                 ├─ Buffer (50ms)
    │                 ├─ Detect Changes
    │                 └─> IPC: 'graph-events-batch'
    │                       └─> Preload
    │                             └─> Renderer
    │                                   └─> Zustand Store.updateNodes()
    │                                         └─> GraphVisualization re-render
    │
    ├─ Task Status Changed
    │     └─> State Update
    │           └─> StateStreamManager
    │                 └─> IPC: 'graph-events-batch'
    │                       └─> TaskList re-render
    │
    └─ Log Entry Added
          └─> StateStreamManager
                └─> IPC: 'graph-events-batch'
                      └─> LogViewer append
```

### 4.3 コンポーネント階層

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
│   │       ├─ CustomNodeComponent (動的)
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

## 5. レイアウト設計

### 5.1 ナビゲーション構造

アプリケーションは**ページベースのナビゲーション**を採用し、各機能を独立したページで提供します。

#### 5.1.1 ページ一覧

1. **Dashboard** - 実行状況の概要（デフォルトページ）
2. **Graph** - LangGraphビジュアライゼーション（全画面）
3. **Tasks** - カンバンボード（全画面）
4. **Logs** - ログビューア（全画面）
5. **Settings** - 設定画面

#### 5.1.2 全体レイアウト（共通構造）

```
┌─────────────────────────────────────────────────────────────────┐
│ Header (60px)                                                   │
│ [Logo] [Dashboard][Graph][Tasks][Logs]  [⚙][Progress: 45%]    │
├──────────┬──────────────────────────────────────────────────────┤
│ Sidebar  │                                                      │
│ (200px)  │  Page Content (Full Width)                          │
│          │                                                      │
│ ────────│                                                      │
│ Overview │  ← 現在選択中のページ                               │
│ Graph    │                                                      │
│ Tasks    │                                                      │
│ Logs     │                                                      │
│ ────────│                                                      │
│ Settings │                                                      │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

### 5.2 Dashboard ページ

実行状況の概要を一目で把握できるダッシュボード。

```
┌─────────────────────────────────────────────────────────────────┐
│ Dashboard                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┬─────────────────┬─────────────────┐       │
│  │ Total Tasks: 10 │ In Progress: 3  │ Completed: 5    │       │
│  │ Pending: 2      │ Failed: 0       │ Success: 100%   │       │
│  └─────────────────┴─────────────────┴─────────────────┘       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐       │
│  │ Execution Timeline                                  │       │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 75% [ProductOwner]  │       │
│  │ Phase: Development                                  │       │
│  │ Estimated Time Remaining: 5m 30s                    │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
│  ┌────────────────┬────────────────────────────────────┐       │
│  │ Current Node   │ Recent Tasks                       │       │
│  │                │                                    │       │
│  │ 🟢 Engineer-2  │ ✅ Task-003: Implement auth       │       │
│  │ Implementing.. │ 🔄 Task-002: Fix bug #42          │       │
│  │                │ 🔄 Task-005: Add tests            │       │
│  │                │ ⏳ Task-007: Update docs          │       │
│  └────────────────┴────────────────────────────────────┘       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐       │
│  │ Recent Logs                          [View All →]  │       │
│  │ ──────────────────────────────────────────────────│       │
│  │ [INFO ] 10:35:12 | Engineer-2  | Writing code...  │       │
│  │ [DEBUG] 10:35:10 | Review-1    | Checking...      │       │
│  │ [INFO ] 10:35:05 | Engineer-1  | Completed task   │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐       │
│  │ Mini Graph Preview               [Full View →]     │       │
│  │                                                     │       │
│  │    ProductOwner → EngineerDispatch                 │       │
│  │         ↓                                           │       │
│  │    Engineer (x3) → Review (x2)                     │       │
│  │         ↓                                           │       │
│  │    MergeCoordinator                                │       │
│  └─────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Graph ページ（全画面）

LangGraphのビジュアライゼーション専用ページ。

```
┌─────────────────────────────────────────────────────────────────┐
│ Graph View                                    [Zoom] [Layout▼]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                                                                 │
│                    [Full Screen Graph]                          │
│                                                                 │
│              ProductOwner (Completed ✅)                        │
│                      ↓                                          │
│              EngineerDispatch (Running 🔄)                      │
│                   ↙  ↓  ↘                                       │
│           Engineer-1  Engineer-2  Engineer-3                    │
│           (Done ✅)   (Running 🔄) (Pending ⏳)                 │
│                   ↘  ↓  ↙                                       │
│               Review-1    Review-2                              │
│                   ↘  ↓  ↙                                       │
│              MergeCoordinator                                   │
│                      ↓                                          │
│              ConflictResolver                                   │
│                                                                 │
│  [MiniMap]                                                      │
│  ┌─────┐                                                        │
│  │▪▪▪▪▪│  Legend:                                              │
│  │▪■▪▪▪│  🔄 Running  ✅ Completed  ⏳ Pending  ❌ Failed     │
│  │▪▪▪▪▪│                                                        │
│  └─────┘                                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.4 Tasks ページ（カンバンボード全画面）

```
┌─────────────────────────────────────────────────────────────────┐
│ Tasks                                  [Filter] [Sort] [Search] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┬──────────────┬──────────────┬──────────────┐    │
│  │ Pending  │ In Progress  │  Completed   │   Failed     │    │
│  │   (3)    │     (2)      │     (5)      │     (0)      │    │
│  ├──────────┼──────────────┼──────────────┼──────────────┤    │
│  │┌────────┐│┌────────────┐│┌────────────┐│              │    │
│  ││Task-001││││  Task-002  ││││  Task-003 │││              │    │
│  ││        │││             ││││  Implement│││              │    │
│  ││Impl... │││Fix bug #42  ││││  Auth     │││              │    │
│  ││        │││             ││││           │││              │    │
│  ││P: High │││🧑 Engineer-1││││✅ Done    │││              │    │
│  │└────────┘│└────────────┘│└────────────┘│              │    │
│  │          │              │              │              │    │
│  │┌────────┐│┌────────────┐│┌────────────┐│              │    │
│  ││Task-004││││  Task-005  ││││  Task-006 │││              │    │
│  ││        │││             ││││  Add      │││              │    │
│  ││Add API │││Add tests    ││││  Docs     │││              │    │
│  ││        │││             ││││           │││              │    │
│  ││P: Med  │││🧑 Engineer-2││││✅ Done    │││              │    │
│  │└────────┘│└────────────┘│└────────────┘│              │    │
│  │          │              │              │              │    │
│  │┌────────┐│              │┌────────────┐│              │    │
│  ││Task-007││              ││  Task-008  ││              │    │
│  ││        ││              ││  ...       ││              │    │
│  ││Update  ││              │└────────────┘│              │    │
│  ││Config  ││              │              │              │    │
│  ││P: Low  ││              │┌────────────┐│              │    │
│  │└────────┘│              ││  Task-009  ││              │    │
│  │          │              ││  ...       ││              │    │
│  │          │              │└────────────┘│              │    │
│  └──────────┴──────────────┴──────────────┴──────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Click on a card → Task Detail Modal opens
```

### 5.5 Logs ページ（全画面）

```
┌─────────────────────────────────────────────────────────────────┐
│ Logs                [Search] [Level: All▼] [Source: All▼] [⚙] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │[INFO ] 10:35:45 | ProductOwner    | Analyzing request...   ││
│ │[DEBUG] 10:35:46 | ProductOwner    | Found 10 tasks         ││
│ │[INFO ] 10:35:47 | EngineerDispatch| Dispatching task-001   ││
│ │[DEBUG] 10:35:48 | Engineer-1      | Reading file auth.ts   ││
│ │[INFO ] 10:35:49 | Engineer-1      | Writing implementation ││
│ │[DEBUG] 10:35:50 | Engineer-2      | Analyzing bug #42      ││
│ │[INFO ] 10:35:51 | Engineer-2      | Found root cause       ││
│ │[WARN ] 10:35:52 | Review-1        | Potential issue at L45 ││
│ │[INFO ] 10:35:53 | Engineer-1      | Addressed review       ││
│ │[INFO ] 10:35:54 | Review-1        | Approved changes       ││
│ │[DEBUG] 10:35:55 | MergeCoordinator| Merging task-003       ││
│ │[INFO ] 10:35:56 | MergeCoordinator| Merge successful       ││
│ │[INFO ] 10:35:57 | Engineer-3      | Starting task-007      ││
│ │...                                                          ││
│ │                                                             ││
│ │                                                             ││
│ │                                                             ││
│ │                                                             ││
│ │                                                             ││
│ │                                                             ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Stats: 1,234 entries | Showing: 1,234 | Auto-scroll: ON     │
└─────────────────────────────────────────────────────────────────┘
```

### 5.6 Settings ページ

```
┌─────────────────────────────────────────────────────────────────┐
│ Settings                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Appearance                                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Theme: ● Light  ○ Dark  ○ System                         │   │
│  │ Font Size: [─────●─────] Medium                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Execution                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Max Engineers: [3]                                       │   │
│  │ Max Turns: [30]                                          │   │
│  │ Base Branch: [main]                                      │   │
│  │ ☑ Auto-cleanup worktrees                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Notifications                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ☑ Show desktop notifications                            │   │
│  │ ☑ Play sound on completion                              │   │
│  │ ☑ Notify on errors                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.7 レスポンシブ対応

- **最小解像度**: 1280x720px
- **推奨解像度**: 1920x1080px以上
- **ウィンドウリサイズ**: 各パネルの比率を維持しながら調整

### 5.8 スプリント管理パネル

AI駆動スプリント実行の状態をリアルタイムで表示する専用パネル（詳細は後述）。

### 5.9 グローバルタスクビュー

プロジェクト横断でタスクを管理・表示するビュー（詳細は後述）。

### 5.10 ダークモード対応

Tailwind CSSのダークモード機能を使用：

```css
/* Light mode */
--background: 0 0% 100%;
--foreground: 222.2 84% 4.9%;

/* Dark mode */
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
}
```

---

## 6. デザインシステム

### 6.1 カラーパレット

#### プライマリカラー

```typescript
const colors = {
  primary: {
    50: '#EFF6FF',   // Lightest
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',  // Base
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',  // Darkest
  },
  // ... その他のカラー
};
```

#### ステータスカラー

| ステータス | カラー | 説明 |
|-----------|-------|------|
| Pending | `#F59E0B` (Amber 500) | 待機中 |
| In Progress | `#10B981` (Emerald 500) | 実行中 |
| Completed | `#3B82F6` (Blue 500) | 完了 |
| Failed | `#EF4444` (Red 500) | 失敗 |
| Paused | `#6B7280` (Gray 500) | 一時停止 |

#### ログレベルカラー

| レベル | カラー | アイコン |
|--------|-------|---------|
| DEBUG | `#6B7280` (Gray 500) | 🐛 |
| INFO | `#3B82F6` (Blue 500) | ℹ️ |
| WARN | `#F59E0B` (Amber 500) | ⚠️ |
| ERROR | `#EF4444` (Red 500) | ❌ |

### 6.2 タイポグラフィ

```css
/* Tailwind v4 設定 */
@theme {
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
  --text-2xl: 1.5rem;    /* 24px */
}
```

### 6.3 スペーシング

```typescript
const spacing = {
  xs: '0.25rem',  // 4px
  sm: '0.5rem',   // 8px
  md: '1rem',     // 16px
  lg: '1.5rem',   // 24px
  xl: '2rem',     // 32px
  '2xl': '3rem',  // 48px
};
```

### 6.4 アニメーション

```css
/* スムーズな状態遷移 */
.transition-standard {
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* ローディング */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* フェードイン */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

---

## 7. コンポーネント設計原則

### 7.1 React 19パターン

#### forwardRef廃止への対応

```typescript
// ❌ 古い書き方（React 18）
const MyComponent = forwardRef<HTMLDivElement, Props>((props, ref) => {
  return <div ref={ref}>{props.children}</div>;
});

// ✅ 新しい書き方（React 19）
interface Props {
  ref?: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
}

const MyComponent = ({ ref, children }: Props) => {
  return <div ref={ref}>{children}</div>;
};
```

#### use Hookの活用

```typescript
import { use } from 'react';

function TaskDetails({ taskPromise }: { taskPromise: Promise<Task> }) {
  // Promiseを直接使える
  const task = use(taskPromise);
  return <div>{task.title}</div>;
}
```

#### Suspense統合

```typescript
import { Suspense } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

function TaskList() {
  const { data: tasks } = useSuspenseQuery({
    queryKey: ['tasks'],
    queryFn: async () => window.electronAPI.getTasks(),
  });

  return (
    <div>
      {tasks.map(task => <TaskItem key={task.id} task={task} />)}
    </div>
  );
}

// 使用側
<Suspense fallback={<TaskListSkeleton />}>
  <TaskList />
</Suspense>
```

### 7.2 コンポーネント分割戦略

#### 単一責任の原則

```typescript
// ❌ 悪い例：複数の責任を持つ
function TaskListWithFilters() {
  // タスク取得
  // フィルタリング
  // ソート
  // 表示
  // ...
}

// ✅ 良い例：責任を分割
function TaskList({ tasks }: { tasks: Task[] }) {
  return tasks.map(task => <TaskItem key={task.id} task={task} />);
}

function TaskFilters({ onChange }: { onChange: (filter: Filter) => void }) {
  // ...
}

function TaskListContainer() {
  const [filter, setFilter] = useState<Filter>(defaultFilter);
  const filteredTasks = useFilteredTasks(filter);

  return (
    <>
      <TaskFilters onChange={setFilter} />
      <TaskList tasks={filteredTasks} />
    </>
  );
}
```

### 7.3 パフォーマンス最適化

#### メモ化

```typescript
import { memo, useMemo, useCallback } from 'react';

// コンポーネントのメモ化
const TaskItem = memo(function TaskItem({ task }: { task: Task }) {
  return <div>{task.title}</div>;
});

// 値のメモ化
function TaskList({ tasks, filter }: Props) {
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => matchesFilter(task, filter));
  }, [tasks, filter]);

  return filteredTasks.map(task => <TaskItem key={task.id} task={task} />);
}

// コールバックのメモ化
function TaskControls() {
  const handlePause = useCallback(() => {
    window.electronAPI.pauseExecution();
  }, []);

  return <button onClick={handlePause}>Pause</button>;
}
```

---

## 8. 状態管理

### 8.1 Zustand Store設計

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface AppState {
  // Graph state
  nodes: GraphNode[];
  edges: GraphEdge[];
  currentNode: string | null;

  // Task state
  tasks: Task[];
  selectedTaskId: string | null;

  // Log state
  logs: LogEntry[];
  logFilter: LogFilter;

  // UI state
  isPaused: boolean;
  isLoading: boolean;
  error: Error | null;

  // Actions
  updateNodes: (nodes: GraphNode[]) => void;
  updateTasks: (tasks: Task[]) => void;
  addLogs: (logs: LogEntry[]) => void;
  setLogFilter: (filter: LogFilter) => void;
  setSelectedTask: (taskId: string | null) => void;
  pause: () => void;
  resume: () => void;
}

export const useAppStore = create<AppState>()(
  immer((set) => ({
    // Initial state
    nodes: [],
    edges: [],
    currentNode: null,
    tasks: [],
    selectedTaskId: null,
    logs: [],
    logFilter: { level: 'all', search: '' },
    isPaused: false,
    isLoading: false,
    error: null,

    // Actions
    updateNodes: (nodes) => set((state) => {
      state.nodes = nodes;
    }),

    updateTasks: (tasks) => set((state) => {
      state.tasks = tasks;
    }),

    addLogs: (newLogs) => set((state) => {
      state.logs = [...state.logs, ...newLogs].slice(-1000); // 最新1000件のみ保持
    }),

    setLogFilter: (filter) => set((state) => {
      state.logFilter = filter;
    }),

    setSelectedTask: (taskId) => set((state) => {
      state.selectedTaskId = taskId;
    }),

    pause: () => set((state) => {
      state.isPaused = true;
    }),

    resume: () => set((state) => {
      state.isPaused = false;
    }),
  }))
);
```

### 8.2 React Query設定

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000, // 1秒
      refetchInterval: false,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// カスタムフック
export function useGraphState() {
  return useSuspenseQuery({
    queryKey: ['graphState'],
    queryFn: async () => window.electronAPI.getGraphState(),
  });
}
```

---

## 9. アクセシビリティ

### 9.1 WCAG 2.1 AA準拠

- **コントラスト比**: テキストと背景のコントラスト比は4.5:1以上
- **キーボード操作**: すべての機能をキーボードで操作可能
- **スクリーンリーダー**: 適切なARIA属性の使用
- **フォーカス管理**: 明確なフォーカスインジケーター

### 9.2 キーボードショートカット

| ショートカット | 機能 |
|--------------|------|
| `Cmd/Ctrl + P` | 実行の一時停止/再開 |
| `Cmd/Ctrl + .` | 実行の停止 |
| `Cmd/Ctrl + F` | ログ検索 |
| `Cmd/Ctrl + K` | タスク検索 |
| `Cmd/Ctrl + ,` | 設定を開く |

### 9.3 ARIA属性

```tsx
<button
  aria-label="実行を一時停止"
  aria-pressed={isPaused}
  onClick={handlePause}
>
  {isPaused ? '再開' : '一時停止'}
</button>

<div
  role="log"
  aria-live="polite"
  aria-atomic="false"
>
  {/* ログエントリ */}
</div>
```

---

## 10. パフォーマンス要件

### 10.1 レンダリング性能

| 指標 | 目標値 | 測定方法 |
|------|--------|---------|
| 初回レンダリング | < 2秒 | Performance API |
| 状態更新レンダリング | < 100ms | React DevTools Profiler |
| ログ追加レンダリング | < 50ms | Performance API |
| グラフノード更新 | < 200ms | Performance API |

### 10.2 メモリ使用量

- **ログバッファ**: 最大1000件（古いログは自動削除）
- **仮想スクロール**: 画面に表示されている行のみレンダリング
- **メモリリーク防止**: useEffectのクリーンアップ関数を適切に使用

### 10.3 最適化戦略

#### Code Splitting

```typescript
// ルートベースの遅延ロード
const GraphVisualization = lazy(() => import('./components/GraphVisualization'));
const TaskList = lazy(() => import('./components/TaskList'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <GraphVisualization />
      <TaskList />
    </Suspense>
  );
}
```

#### バンドルサイズ最適化

```bash
# ビルド分析
npm run build -- --analyze

# 目標サイズ
# - vendor.js: < 500KB (gzip)
# - app.js: < 200KB (gzip)
```

---

## 11. エラーハンドリング

### 11.1 エラーバウンダリ

```typescript
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
    // エラーログをElectronメインプロセスに送信
    window.electronAPI.logError(error.message, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-container">
          <h2>予期しないエラーが発生しました</h2>
          <pre>{this.state.error?.message}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 11.2 IPC通信エラー

```typescript
async function safeIPCCall<T>(
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error('IPC call failed:', error);
    return fallback;
  }
}

// 使用例
const tasks = await safeIPCCall(
  () => window.electronAPI.getTasks(),
  []
);
```

---

## 12. テスト戦略

### 12.1 テストピラミッド

```
        ┌─────────┐
        │  E2E    │ (10%)
        │  Tests  │
       ┌┴─────────┴┐
       │Integration│ (30%)
       │   Tests   │
      ┌┴───────────┴┐
      │   Unit Tests │ (60%)
      └──────────────┘
```

### 12.2 ユニットテスト

```typescript
import { render, screen } from '@testing-library/react';
import { TaskItem } from './TaskItem';

describe('TaskItem', () => {
  const mockTask: Task = {
    id: 'task-1',
    title: 'Test Task',
    status: 'in_progress',
    priority: 50,
  };

  it('should render task title', () => {
    render(<TaskItem task={mockTask} />);
    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('should display correct status badge', () => {
    render(<TaskItem task={mockTask} />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });
});
```

### 12.3 E2Eテスト

```typescript
// Electronアプリのテスト
import { _electron as electron } from 'playwright';

describe('Kugutsu App', () => {
  let app: Electron.App;

  beforeAll(async () => {
    app = await electron.launch({ args: ['.'] });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should launch window', async () => {
    const window = await app.firstWindow();
    const title = await window.title();
    expect(title).toBe('Kugutsu - AI Parallel Development');
  });
});
```

---

## 13. 実装ガイドライン

### 13.1 コーディング規約

- **ESLint**: Airbnb Style Guide準拠
- **Prettier**: コードフォーマット
- **TypeScript Strict Mode**: 有効化
- **命名規則**:
  - コンポーネント: PascalCase (`TaskList`)
  - フック: camelCase with `use` prefix (`useGraphState`)
  - 定数: UPPER_SNAKE_CASE (`MAX_LOG_COUNT`)

### 13.2 ファイル構成

```
src/electron/renderer/
├── index.html                 # エントリーHTML
├── index.tsx                  # Reactエントリーポイント
├── App.tsx                    # メインコンポーネント
├── components/                # UIコンポーネント
│   ├── GraphVisualization/
│   │   ├── index.tsx
│   │   ├── CustomNode.tsx
│   │   └── GraphVisualization.test.tsx
│   ├── TaskList/
│   │   ├── index.tsx
│   │   ├── TaskItem.tsx
│   │   ├── TaskFilters.tsx
│   │   └── TaskList.test.tsx
│   └── LogViewer/
│       ├── index.tsx
│       ├── LogEntry.tsx
│       └── LogViewer.test.tsx
├── hooks/                     # カスタムフック
│   ├── useGraphState.ts
│   ├── useIPCListener.ts
│   └── useVirtualizedList.ts
├── store/                     # Zustand stores
│   └── appStore.ts
├── lib/                       # ユーティリティ
│   ├── utils.ts
│   └── constants.ts
├── styles/                    # スタイル
│   └── globals.css
└── types/                     # 型定義
    └── index.ts
```

### 13.3 コミット規約

```
feat: 新機能追加
fix: バグ修正
refactor: リファクタリング
style: スタイル変更
test: テスト追加・修正
docs: ドキュメント更新
chore: ビルド・設定変更
```

---

## 14. セキュリティ要件

### 14.1 Content Security Policy

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self';
               style-src 'self' 'unsafe-inline';
               img-src 'self' data:;">
```

### 14.2 入力検証

```typescript
// ユーザー入力の検証
function validateSearchQuery(query: string): string {
  // XSS対策
  return query
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim()
    .slice(0, 200); // 最大長制限
}
```

---

## 15. 今後の拡張

### 15.1 Phase 4以降の機能

- **プラグインシステム**: カスタムノード・エッジの追加
- **テーマカスタマイズ**: ユーザー定義テーマ
- **エクスポート機能**: 実行結果のPDF/Markdown出力
- **履歴機能**: 過去の実行履歴の閲覧
- **コラボレーション**: 複数ユーザーでの共同作業（将来的）

### 15.2 技術的負債の管理

- 定期的なリファクタリング
- パフォーマンスモニタリング
- セキュリティ監査
- 依存関係の更新

---

## 16. 参考資料

### 16.1 フレームワーク・ライブラリ

- [React 19 Documentation](https://react.dev/blog/2024/12/05/react-19)
- [React 19.2 Release Notes](https://react.dev/blog/2025/10/01/react-19-2)
- [@xyflow/react Documentation](https://reactflow.dev/)
- [Zustand Documentation](https://zustand.docs.pmnd.rs/)
- [@tanstack/react-query Documentation](https://tanstack.com/query/latest)
- [@tanstack/react-virtual Documentation](https://tanstack.com/virtual/latest)

### 16.2 ビルド・開発ツール

- [Vite 7 Documentation](https://vite.dev/)
- [Vite 7 Announcement](https://vite.dev/blog/announcing-vite7)
- [electron-vite Documentation](https://electron-vite.org/)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/blog/tailwindcss-v4)
- [Tailwind CSS v4 Upgrade Guide](https://tailwindcss.com/docs/upgrade-guide)
- [shadcn/ui React 19 Guide](https://ui.shadcn.com/docs/react-19)

### 16.3 Electron

- [Electron Documentation](https://www.electronjs.org/docs/latest)
- [Electron 39 Release Notes](https://www.electronjs.org/blog/electron-38-0)

### 16.4 アクセシビリティ

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**最終更新**: 2025-11-05
**バージョン**: 1.0.0
**承認**: 待機中
