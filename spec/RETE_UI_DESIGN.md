# Rete.js ワークフローエディタ - UI設計書

## ドキュメント情報

- **作成日**: 2025-11-26
- **バージョン**: 1.0.0
- **対象**: Kugutsu Electron UI

## 1. 設計方針

### 1.1 基本コンセプト

**シンプル、機能的、効率的**

- タブ切り替え不要のワンスクリーン設計
- すべての主要機能が同時に見える
- 折りたたみ可能なパネルで柔軟なレイアウト
- 既存コンポーネントの最大限の再利用

### 1.2 主要機能

ユーザーが必要とする4つのコア機能：

1. **ワークフロー管理**: プリセット選択、保存/読み込み
2. **ワークフロー編集**: Rete.jsビジュアルエディタ
3. **AI対話**: エージェントとのチャット
4. **実行ログ**: ノード実行状況のリアルタイム表示

---

## 2. レイアウト設計

### 2.1 全体構成

```
┌─────────────────────────────────────────────────────────────────────┐
│ Toolbar: [File] [Edit] [Workflow] [Help]                           │
├─────────────────────────────────────────────────────────────────────┤
│ Header: Project: /path/to/project  Branch: main                    │
├──────────────┬──────────────────────────────────┬───────────────────┤
│              │                                  │                   │
│  Workflow    │   Rete.js Workflow Editor       │   Chat Panel      │
│  Manager     │   (Canvas)                       │                   │
│              │                                  │   ┌─────────────┐ │
│  Actions     │  ┌────┐         ┌────┐          │   │ Prompt      │ │
│  ┌────────┐  │  │Node│─────────│Node│          │   └─────────────┘ │
│  │New     │  │  └────┘         └────┘          │   ┌─────────────┐ │
│  │Save    │  │    │               │             │   │ AI Response │ │
│  │Load    │  │  ┌─▼───────────────▼─┐          │   │             │ │
│  └────────┘  │  │   Aggregator      │          │   │             │ │
│              │  └───────────────────┘          │   │             │ │
│  Presets     │                                  │   └─────────────┘ │
│  ┌────────┐  │  [▶ Run] [⏹ Stop] [💾 Save]     │                   │
│  │📋 Scrum │  │                                  │   [Quick Actions] │
│  │⫸ Parallel│  │  [Zoom: 100%] [Grid: ✓]        │   ┌─────────────┐ │
│  │🏃 Sprint │  │                                  │   │Optimize WF  │ │
│  │🧪 Test   │  │                                  │   │Suggest //   │ │
│  └────────┘  │                                  │   └─────────────┘ │
│              │                                  │                   │
│  Saved       │                                  │   [Send]          │
│  ┌────────┐  │                                  │                   │
│  │My WF 1  │  │                                  │                   │
│  │My WF 2  │  │                                  │                   │
│  │My WF 3  │  │                                  │                   │
│  └────────┘  │                                  │                   │
│              │                                  │                   │
├──────────────┴──────────────────────────────────┴───────────────────┤
│ Log Viewer (Collapsible): [Info] [Warn] [Error] [🔍 Search] [Clear]│
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ [14:23:45] ▶️ Workflow execution started                       │   │
│ │ [14:23:46] 🤖 Node 'engineer-1' executing... (Worktree: WT-1)  │   │
│ │ [14:23:50] ✅ Node 'engineer-1' completed successfully         │   │
│ │ [14:23:51] 🤖 Node 'reviewer-1' executing...                   │   │
│ │ [14:23:55] ⚠️  Node 'reviewer-1' warning: Code needs refactor  │   │
│ └───────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│ StatusBar: Ready | Memory: 256MB | Nodes: 5 | Running: 2           │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 画面領域の割合

| エリア | 幅/高さ | 折りたたみ可能 |
|--------|---------|---------------|
| Toolbar | 高さ: 40px | ❌ |
| Header | 高さ: 48px | ❌ |
| Workflow Manager（左） | 幅: 20% (240px～320px) | ✅ |
| Rete.js Editor（中央） | 幅: 55% (可変) | ❌ |
| Chat Panel（右） | 幅: 25% (300px～400px) | ✅ |
| Log Viewer（下） | 高さ: 30% (200px～400px) | ✅ |
| StatusBar | 高さ: 24px | ❌ |

---

## 3. コンポーネント詳細

### 3.1 Workflow Manager（左サイドバー）

#### 3.1.1 構造

```tsx
<WorkflowManager className="w-1/5 min-w-[240px] max-w-[320px] border-r">
  {/* ヘッダー */}
  <WorkflowManagerHeader>
    <h2>Workflows</h2>
    <CollapseButton />
  </WorkflowManagerHeader>

  {/* アクション */}
  <WorkflowActions className="p-3 border-b">
    <Button variant="outline" size="sm" fullWidth>
      <PlusIcon /> New Workflow
    </Button>
    <Button variant="outline" size="sm" fullWidth>
      <SaveIcon /> Save
    </Button>
    <Button variant="outline" size="sm" fullWidth>
      <FolderIcon /> Load
    </Button>
  </WorkflowActions>

  {/* プリセット一覧 */}
  <WorkflowPresets className="p-3 border-b">
    <SectionHeader>Presets</SectionHeader>
    <PresetList>
      <PresetItem icon="📋" onClick={loadPreset('scrum')}>
        Scrum Workflow
      </PresetItem>
      <PresetItem icon="⫸" onClick={loadPreset('parallel')}>
        Parallel Development
      </PresetItem>
      <PresetItem icon="🏃" onClick={loadPreset('sprint')}>
        Sprint Planning
      </PresetItem>
      <PresetItem icon="🧪" onClick={loadPreset('test')}>
        Test Automation
      </PresetItem>
    </PresetList>
  </WorkflowPresets>

  {/* 保存済みワークフロー */}
  <SavedWorkflows className="flex-1 overflow-y-auto p-3">
    <SectionHeader>
      Saved Workflows
      <Badge>{savedWorkflows.length}</Badge>
    </SectionHeader>
    <WorkflowList>
      {savedWorkflows.map(workflow => (
        <WorkflowItem
          key={workflow.id}
          name={workflow.name}
          lastModified={workflow.updatedAt}
          onLoad={() => loadWorkflow(workflow.id)}
          onDelete={() => deleteWorkflow(workflow.id)}
          onDuplicate={() => duplicateWorkflow(workflow.id)}
        />
      ))}
    </WorkflowList>
  </SavedWorkflows>
</WorkflowManager>
```

#### 3.1.2 機能詳細

**アクション**:
- **New Workflow**: 空のワークフローを作成し、Rete.jsエディタをクリア
- **Save**: 現在のワークフローを`.kugutsu/workflows/custom/`に保存
- **Load**: ファイル選択ダイアログを開き、ワークフローをインポート

**プリセット**:
- クリックで即座にプリセットワークフローをロード
- プリセットは`.kugutsu/workflows/`に格納
- アイコンで視覚的に区別

**保存済みワークフロー**:
- ユーザーが保存したワークフロー一覧
- 右クリックまたはホバーで追加アクション（削除、複製）
- 最終更新日時を表示

#### 3.1.3 折りたたみ状態

折りたたみ時（幅: 48px）:
```
┌────┐
│ 📁 │  <- アイコンのみ表示
│    │
│ 📋 │
│ ⫸  │
│ 🏃 │
│ 🧪 │
│    │
│ ━━ │  <- Saved Workflows
│ WF1│
│ WF2│
└────┘
```

### 3.2 Rete.js Workflow Editor（中央エリア）

#### 3.2.1 構造

```tsx
<ReteWorkflowEditor className="flex-1 flex flex-col">
  {/* ツールバー */}
  <ReteToolbar className="h-12 px-3 border-b flex items-center gap-2">
    <ToolbarGroup>
      <Button variant="default" size="sm">
        <PlayIcon /> Run
      </Button>
      <Button variant="outline" size="sm">
        <StopIcon /> Stop
      </Button>
      <Button variant="outline" size="sm">
        <SaveIcon /> Save
      </Button>
    </ToolbarGroup>

    <Separator orientation="vertical" />

    <ToolbarGroup>
      <Button variant="ghost" size="sm">
        <UndoIcon /> Undo
      </Button>
      <Button variant="ghost" size="sm">
        <RedoIcon /> Redo
      </Button>
    </ToolbarGroup>

    <Separator orientation="vertical" />

    <ToolbarGroup>
      <ZoomControl>
        <Button variant="ghost" size="sm">-</Button>
        <span>100%</span>
        <Button variant="ghost" size="sm">+</Button>
      </ZoomControl>
      <Toggle pressed={gridEnabled}>
        <GridIcon /> Grid
      </Toggle>
    </ToolbarGroup>

    <div className="flex-1" />

    <WorkflowInfo>
      <Badge variant="outline">5 Nodes</Badge>
      <Badge variant="outline">2 Running</Badge>
    </WorkflowInfo>
  </ReteToolbar>

  {/* Rete.jsキャンバス */}
  <ReteCanvas className="flex-1 relative">
    <div ref={reteContainerRef} className="w-full h-full" />

    {/* 実行中のオーバーレイ */}
    {isExecuting && (
      <ExecutionOverlay>
        <ProgressBar value={executionProgress} />
        <Button variant="destructive" onClick={stopExecution}>
          Stop Execution
        </Button>
      </ExecutionOverlay>
    )}
  </ReteCanvas>

  {/* ノードパレット（下部、折りたたみ可能） */}
  <NodePalette
    position="bottom"
    collapsible
    defaultCollapsed={false}
    height={200}
  >
    <NodePaletteHeader>
      <SearchInput placeholder="Search nodes..." />
      <CollapseButton />
    </NodePaletteHeader>

    <NodeCategories>
      <NodeCategory name="🚀 Start/End" defaultExpanded>
        <NodePaletteItem type="io:start" icon="▶️">Start</NodePaletteItem>
        <NodePaletteItem type="io:end" icon="⏹️">End</NodePaletteItem>
      </NodeCategory>

      <NodeCategory name="🤖 AI Tasks">
        <NodePaletteItem type="preset:engineer" icon="👨‍💻">
          Engineer
        </NodePaletteItem>
        <NodePaletteItem type="preset:reviewer" icon="✅">
          Reviewer
        </NodePaletteItem>
        <NodePaletteItem type="preset:product-owner" icon="📋">
          Product Owner
        </NodePaletteItem>
        <NodePaletteItem type="ai:custom" icon="🤖">
          Custom AI
        </NodePaletteItem>
      </NodeCategory>

      <NodeCategory name="⚡ Control Flow">
        <NodePaletteItem type="control:parallel" icon="⫸">
          Parallel
        </NodePaletteItem>
        <NodePaletteItem type="control:aggregator" icon="⫷">
          Aggregator
        </NodePaletteItem>
        <NodePaletteItem type="control:decision" icon="◆">
          Decision
        </NodePaletteItem>
        <NodePaletteItem type="control:group" icon="⫸⫸">
          Parallel Group
        </NodePaletteItem>
        <NodePaletteItem type="control:loop" icon="🔁">
          Loop
        </NodePaletteItem>
      </NodeCategory>

      <NodeCategory name="📦 Git Operations">
        <NodePaletteItem type="git:merge" icon="🔀">
          Merge
        </NodePaletteItem>
        <NodePaletteItem type="git:conflict-resolver" icon="⚔️">
          Conflict Resolver
        </NodePaletteItem>
      </NodeCategory>

      <NodeCategory name="🔧 Utilities">
        <NodePaletteItem type="io:transform" icon="🔄">
          Transform
        </NodePaletteItem>
      </NodeCategory>
    </NodeCategories>
  </NodePalette>
</ReteWorkflowEditor>
```

#### 3.2.2 機能詳細

**ツールバー**:
- **Run**: ワークフローを実行（WorkflowTransformer → LangGraph）
- **Stop**: 実行中のワークフローを停止
- **Save**: 現在のワークフローを保存（ダイアログ表示）
- **Undo/Redo**: 編集履歴の管理
- **Zoom/Grid**: 表示制御

**キャンバス**:
- Rete.jsのNodeEditor、AreaPluginをマウント
- ノードのドラッグ&ドロップ配置
- 接続の作成・削除
- ノード選択でプロパティ編集（右パネルに表示）

**ノードパレット**:
- カテゴリ別にノードを整理
- ドラッグしてキャンバスに配置
- 検索機能でノードを素早く見つける
- 折りたたみ可能（編集領域を広く使いたい時）

#### 3.2.3 ノード実行状態の可視化

実行中のノードには視覚的フィードバック:

```tsx
// ノードのスタイル
const getNodeStyle = (status: NodeStatus) => {
  switch (status) {
    case 'idle':
      return { border: '2px solid #6b7280' };
    case 'executing':
      return {
        border: '2px solid #3b82f6',
        boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)',
        animation: 'pulse 2s infinite'
      };
    case 'completed':
      return { border: '2px solid #10b981' };
    case 'failed':
      return { border: '2px solid #ef4444' };
  }
};
```

### 3.3 Chat Panel（右サイドバー）

#### 3.3.1 構造

```tsx
<ChatPanel className="w-1/4 min-w-[300px] max-w-[400px] border-l flex flex-col">
  {/* ヘッダー */}
  <ChatPanelHeader className="h-12 px-3 border-b flex items-center justify-between">
    <div className="flex items-center gap-2">
      <MessageSquareIcon />
      <h2>AI Assistant</h2>
    </div>
    <div className="flex items-center gap-2">
      <Badge variant="secondary">Claude Sonnet 4.5</Badge>
      <CollapseButton />
    </div>
  </ChatPanelHeader>

  {/* ノードプロパティエディタ（選択時のみ表示） */}
  {selectedNode && (
    <NodePropertyEditor className="border-b bg-muted/20">
      <PropertyEditorHeader>
        <span>Node: {selectedNode.label}</span>
        <Button variant="ghost" size="sm" onClick={closePropertyEditor}>
          ✕
        </Button>
      </PropertyEditorHeader>

      <PropertyFields className="p-3 max-h-[300px] overflow-y-auto">
        <PropertyField label="Node Type">
          <Input value={selectedNode.type} disabled />
        </PropertyField>

        <PropertyField label="Label">
          <Input
            value={selectedNode.label}
            onChange={(e) => updateNode({ label: e.target.value })}
          />
        </PropertyField>

        {selectedNode.type.startsWith('ai:') && (
          <>
            <PropertyField label="AI Provider">
              <Select
                value={selectedNode.config.ai.provider}
                onChange={(value) => updateNodeConfig({ provider: value })}
              >
                <SelectOption value="claude">Claude</SelectOption>
                <SelectOption value="openai">OpenAI Codex</SelectOption>
                <SelectOption value="gemini">Gemini</SelectOption>
              </Select>
            </PropertyField>

            <PropertyField label="Prompt">
              <Textarea
                value={selectedNode.config.ai.prompt}
                onChange={(e) => updateNodeConfig({ prompt: e.target.value })}
                rows={4}
              />
            </PropertyField>

            <PropertyField label="Max Turns">
              <Input
                type="number"
                value={selectedNode.config.ai.maxTurns}
                onChange={(e) => updateNodeConfig({ maxTurns: parseInt(e.target.value) })}
              />
            </PropertyField>
          </>
        )}

        {/* その他のプロパティ... */}
      </PropertyFields>
    </NodePropertyEditor>
  )}

  {/* チャットメッセージエリア */}
  <ChatMessages className="flex-1 overflow-y-auto p-3 space-y-3">
    {messages.map((message, index) => (
      <ChatMessage
        key={index}
        role={message.role}
        content={message.content}
        timestamp={message.timestamp}
      />
    ))}

    {isTyping && (
      <TypingIndicator>
        <span className="animate-pulse">AI is typing...</span>
      </TypingIndicator>
    )}

    <div ref={messagesEndRef} />
  </ChatMessages>

  {/* クイックアクション */}
  <QuickActions className="px-3 py-2 border-t bg-muted/10">
    <div className="text-xs text-muted-foreground mb-2">Quick Actions</div>
    <div className="flex flex-wrap gap-1">
      <QuickActionButton onClick={() => sendQuickAction('optimize')}>
        Optimize workflow
      </QuickActionButton>
      <QuickActionButton onClick={() => sendQuickAction('parallelize')}>
        Suggest parallelization
      </QuickActionButton>
      <QuickActionButton onClick={() => sendQuickAction('explain')}>
        Explain this node
      </QuickActionButton>
    </div>
  </QuickActions>

  {/* 入力エリア */}
  <ChatInput className="p-3 border-t">
    <div className="flex gap-2">
      <Textarea
        placeholder="Ask about workflow, nodes, or optimizations..."
        value={inputMessage}
        onChange={(e) => setInputMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={2}
        className="flex-1 resize-none"
      />
      <Button
        onClick={sendMessage}
        disabled={!inputMessage.trim() || isTyping}
      >
        Send
      </Button>
    </div>
  </ChatInput>
</ChatPanel>
```

#### 3.3.2 機能詳細

**ノードプロパティエディタ**:
- ノード選択時に自動的に表示
- ノードタイプに応じた動的フォーム
- リアルタイム更新（編集→即座に反映）
- 閉じるボタンで非表示

**チャット機能**:
- **コンテキスト認識**: 選択中のノード、ワークフロー全体を認識
- **対話例**:
  - "このノードを並列化できますか？"
  - "エラーが出ている理由を教えて"
  - "このワークフローを最適化して"
- **既存のPromptPanelロジックを再利用**

**クイックアクション**:
- よく使うプロンプトをボタン化
- ワンクリックでAIに質問

#### 3.3.3 折りたたみ状態

折りたたみ時（幅: 48px）:
```
┌────┐
│ 💬 │
│    │
│ ↔  │  <- 展開ボタン
│    │
└────┘
```

### 3.4 Log Viewer（下部パネル）

#### 3.4.1 構造

```tsx
<LogViewer className="h-[30%] min-h-[200px] max-h-[400px] border-t flex flex-col">
  {/* ツールバー */}
  <LogToolbar className="h-10 px-3 border-b flex items-center gap-2">
    <div className="flex items-center gap-2">
      <TerminalIcon size={16} />
      <h3 className="text-sm font-medium">Execution Log</h3>
    </div>

    <Separator orientation="vertical" />

    {/* フィルタボタン */}
    <ToggleGroup type="multiple" value={activeFilters}>
      <ToggleGroupItem value="info" onClick={() => toggleFilter('info')}>
        <InfoIcon size={14} /> Info
        <Badge variant="secondary">{countByLevel.info}</Badge>
      </ToggleGroupItem>
      <ToggleGroupItem value="warning" onClick={() => toggleFilter('warning')}>
        <AlertIcon size={14} /> Warning
        <Badge variant="secondary">{countByLevel.warning}</Badge>
      </ToggleGroupItem>
      <ToggleGroupItem value="error" onClick={() => toggleFilter('error')}>
        <XCircleIcon size={14} /> Error
        <Badge variant="secondary">{countByLevel.error}</Badge>
      </ToggleGroupItem>
    </ToggleGroup>

    <Separator orientation="vertical" />

    {/* 検索 */}
    <SearchInput
      placeholder="Search logs..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="w-48"
    />

    <div className="flex-1" />

    {/* アクション */}
    <Button variant="ghost" size="sm" onClick={clearLogs}>
      <TrashIcon size={14} /> Clear
    </Button>
    <Button variant="ghost" size="sm" onClick={exportLogs}>
      <DownloadIcon size={14} /> Export
    </Button>
    <Toggle pressed={autoScroll} onPressedChange={setAutoScroll}>
      <ArrowDownIcon size={14} /> Auto-scroll
    </Toggle>
    <CollapseButton />
  </LogToolbar>

  {/* ログコンテンツ */}
  <LogContent className="flex-1 overflow-y-auto font-mono text-xs">
    <VirtualizedList items={filteredLogs} itemHeight={24}>
      {(log, index) => (
        <LogEntry
          key={index}
          level={log.level}
          timestamp={log.timestamp}
          nodeId={log.nodeId}
          message={log.message}
          worktree={log.worktree}
          onClick={() => selectLogEntry(log)}
          isSelected={selectedLog === log}
        >
          <LogTimestamp>{formatTimestamp(log.timestamp)}</LogTimestamp>
          <LogIcon level={log.level} />
          {log.nodeId && (
            <LogNode onClick={() => selectNode(log.nodeId)}>
              {log.nodeId}
            </LogNode>
          )}
          <LogMessage highlight={searchQuery}>{log.message}</LogMessage>
          {log.worktree && <LogWorktree>({log.worktree})</LogWorktree>}
        </LogEntry>
      )}
    </VirtualizedList>
  </LogContent>
</LogViewer>
```

#### 3.4.2 機能詳細

**フィルタリング**:
- レベル別（Info/Warning/Error）
- ノード別
- 検索文字列

**ログエントリ**:
- タイムスタンプ（HH:MM:SS形式）
- アイコン（レベルに応じた絵文字）
- ノード名（クリックで該当ノードを選択）
- メッセージ本文
- Worktree情報（並列実行時）

**リアルタイム更新**:
- StateStreamManagerからのイベントを購読
- 新しいログを自動追加
- Auto-scroll オプション

**ログレベル別のスタイル**:

```tsx
const getLogStyle = (level: LogLevel) => {
  switch (level) {
    case 'info':
      return {
        icon: 'ℹ️',
        color: 'text-blue-600',
        bg: 'bg-blue-50'
      };
    case 'warning':
      return {
        icon: '⚠️',
        color: 'text-yellow-600',
        bg: 'bg-yellow-50'
      };
    case 'error':
      return {
        icon: '❌',
        color: 'text-red-600',
        bg: 'bg-red-50'
      };
    case 'success':
      return {
        icon: '✅',
        color: 'text-green-600',
        bg: 'bg-green-50'
      };
  }
};
```

#### 3.4.3 折りたたみ状態

折りたたみ時（高さ: 32px）:
```
┌──────────────────────────────────────────────┐
│ Execution Log | 5 Info, 2 Warning, 0 Error ▲│
└──────────────────────────────────────────────┘
```

---

## 4. レスポンシブ設計

### 4.1 パネル折りたたみ状態

#### すべて展開（デフォルト）

```
┌────────┬───────────────┬──────────┐
│ WF Mgr │  Rete Editor  │   Chat   │
│  20%   │      55%      │    25%   │
└────────┴───────────────┴──────────┘
       Log Viewer (30% height)
```

#### 左右折りたたみ（ワークフロー編集に集中）

```
┌─┬──────────────────────────────┬─┐
│W│      Rete Editor (95%)       │C│
│F│                              │h│
└─┴──────────────────────────────┴─┘
       Log Viewer (30% height)
```

#### ログ折りたたみ（編集領域を最大化）

```
┌────────┬───────────────┬──────────┐
│ WF Mgr │  Rete Editor  │   Chat   │
│  20%   │      55%      │    25%   │
│        │               │          │
│        │               │          │
└────────┴───────────────┴──────────┘
Log: [5 Info | 2 Warning] ▼
```

#### 最小構成（Rete.jsのみ）

```
┌─┬──────────────────────────────┬─┐
│W│                              │C│
│F│      Rete Editor (98%)       │h│
│ │                              │a│
│ │                              │t│
└─┴──────────────────────────────┴─┘
Log: [5 Info | 2 Warning] ▼
```

### 4.2 リサイズ可能な境界

すべてのパネル境界はドラッグでリサイズ可能:

```tsx
<ResizablePanel>
  <WorkflowManager />
</ResizablePanel>
<ResizableHandle />
<ResizablePanel>
  <ReteWorkflowEditor />
</ResizablePanel>
<ResizableHandle />
<ResizablePanel>
  <ChatPanel />
</ResizablePanel>
```

最小/最大幅の制限:
- Workflow Manager: 48px～400px
- Chat Panel: 48px～600px
- Rete Editor: 400px～無制限

---

## 5. ステート管理

### 5.1 Zustand Store拡張

```typescript
// electron/renderer/store/workflowStore.ts

interface WorkflowStore {
  // ワークフロー定義
  currentWorkflow: ReteWorkflowJSON | null;
  savedWorkflows: WorkflowMetadata[];

  // UI状態
  panels: {
    workflowManager: { collapsed: boolean; width: number };
    chatPanel: { collapsed: boolean; width: number };
    logViewer: { collapsed: boolean; height: number };
  };

  // 実行状態
  isExecuting: boolean;
  executionProgress: number;
  nodeStatuses: Record<string, NodeStatus>;

  // 選択状態
  selectedNodeId: string | null;

  // アクション
  loadWorkflow: (workflow: ReteWorkflowJSON) => void;
  saveWorkflow: (name: string) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;

  togglePanel: (panel: PanelName) => void;
  resizePanel: (panel: PanelName, size: number) => void;

  executeWorkflow: () => Promise<void>;
  stopExecution: () => void;

  selectNode: (nodeId: string | null) => void;
  updateNodeConfig: (nodeId: string, config: Partial<NodeConfig>) => void;
}
```

### 5.2 IPC通信

Rete.jsワークフロー実行時のIPC:

```typescript
// Main Process → Renderer
ipcMain.handle('workflow:execute', async (event, workflow: ReteWorkflowJSON) => {
  // WorkflowTransformerでLangGraphに変換
  const graph = WorkflowTransformer.transformToLangGraph(workflow);

  // 実行
  const result = await graph.invoke({});

  return result;
});

ipcMain.on('workflow:node-status', (event, { nodeId, status }) => {
  // Rendererに通知
  event.sender.send('workflow:node-status-update', { nodeId, status });
});

// Renderer → Main Process
ipcRenderer.invoke('workflow:execute', currentWorkflow);

ipcRenderer.on('workflow:node-status-update', (event, { nodeId, status }) => {
  workflowStore.updateNodeStatus(nodeId, status);
});
```

---

## 6. コンポーネント実装計画

### 6.1 新規作成が必要なコンポーネント

| コンポーネント | パス | 説明 |
|--------------|------|------|
| **WorkflowManager** | `electron/renderer/components/WorkflowManager/` | 左サイドバー全体 |
| **ReteWorkflowEditor** | `electron/renderer/components/ReteEditor/` | Rete.jsエディタラッパー |
| **NodePalette** | `electron/renderer/components/ReteEditor/NodePalette.tsx` | ノードパレット |
| **NodePropertyEditor** | `electron/renderer/components/ReteEditor/NodePropertyEditor.tsx` | プロパティエディタ |
| **ChatPanel** | `electron/renderer/components/ChatPanel/` | 右サイドバー（既存PromptPanel改修） |

### 6.2 既存コンポーネントの再利用

| コンポーネント | 利用方法 |
|--------------|---------|
| **LogViewer** | そのまま使用（軽微な拡張のみ） |
| **PromptPanel** | ChatPanelのベースとして改修 |
| **Header** | そのまま使用 |
| **Toolbar** | そのまま使用 |
| **StatusBar** | そのまま使用 |

### 6.3 削除/非推奨にするコンポーネント

| コンポーネント | 対応 |
|--------------|------|
| **TaskKanbanBoard** | 非推奨（Rete.jsに置き換え） |
| **NodeExecutionViewer** | 非推奨（Rete.jsの可視化に統合） |
| **DependencyGraphViewer** | 非推奨（Rete.jsの可視化に統合） |
| **SprintViewer** | 非推奨（プリセットワークフローで代替） |

---

## 7. スタイリング

### 7.1 カラーパレット

```css
/* ノードタイプ別の色 */
--node-start: #10b981;       /* 緑 */
--node-end: #ef4444;         /* 赤 */
--node-ai-task: #3b82f6;     /* 青 */
--node-control: #8b5cf6;     /* 紫 */
--node-git: #6b7280;         /* 灰 */
--node-decision: #eab308;    /* 黄 */
--node-aggregator: #f59e0b;  /* オレンジ */

/* 実行状態の色 */
--status-idle: #6b7280;      /* 灰 */
--status-executing: #3b82f6; /* 青（パルス） */
--status-completed: #10b981; /* 緑 */
--status-failed: #ef4444;    /* 赤 */
```

### 7.2 アニメーション

```css
/* 実行中のノードのパルスアニメーション */
@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.8);
  }
}

.node-executing {
  animation: pulse 2s infinite;
}

/* 接続線のフローアニメーション */
@keyframes flow {
  0% {
    stroke-dashoffset: 10;
  }
  100% {
    stroke-dashoffset: 0;
  }
}

.connection-active {
  stroke-dasharray: 5 5;
  animation: flow 1s linear infinite;
}
```

---

## 8. アクセシビリティ

### 8.1 キーボードショートカット

| ショートカット | アクション |
|--------------|-----------|
| `Ctrl/Cmd + S` | ワークフロー保存 |
| `Ctrl/Cmd + O` | ワークフロー読み込み |
| `Ctrl/Cmd + N` | 新規ワークフロー |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + Enter` | ワークフロー実行 |
| `Escape` | 実行停止 |
| `Delete` | 選択ノード削除 |
| `Ctrl/Cmd + D` | ノード複製 |
| `Ctrl/Cmd + /` | チャットパネルにフォーカス |
| `Ctrl/Cmd + 1` | Workflow Managerトグル |
| `Ctrl/Cmd + 2` | Chat Panelトグル |
| `Ctrl/Cmd + 3` | Log Viewerトグル |

### 8.2 ARIA属性

```tsx
<WorkflowManager
  role="navigation"
  aria-label="Workflow management panel"
/>

<ReteCanvas
  role="application"
  aria-label="Workflow editor canvas"
/>

<NodePaletteItem
  role="button"
  aria-label="Add Engineer node"
  draggable
/>

<LogViewer
  role="log"
  aria-live="polite"
  aria-atomic="false"
/>
```

---

## 9. パフォーマンス最適化

### 9.1 仮想スクロール

大量のログエントリに対して仮想スクロールを使用:

```tsx
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={400}
  itemCount={logs.length}
  itemSize={24}
  width="100%"
>
  {({ index, style }) => (
    <LogEntry style={style} log={logs[index]} />
  )}
</FixedSizeList>
```

### 9.2 メモ化

頻繁に再レンダリングされるコンポーネントをメモ化:

```tsx
const NodePaletteItem = React.memo(({ type, icon, label, onDragStart }) => {
  return (
    <div draggable onDragStart={onDragStart}>
      {icon} {label}
    </div>
  );
});

const LogEntry = React.memo(({ log }) => {
  return <div>{log.message}</div>;
}, (prev, next) => prev.log.id === next.log.id);
```

### 9.3 遅延ロード

保存済みワークフロー一覧を遅延ロード:

```tsx
const SavedWorkflows = () => {
  const [workflows, setWorkflows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadWorkflowsAsync();
  }, []);

  return isLoading ? <Skeleton /> : <WorkflowList workflows={workflows} />;
};
```

---

## 10. 実装優先順位

### Phase 1: 基本レイアウト

1. 3ペインレイアウトの実装
2. WorkflowManagerスケルトン
3. ReteWorkflowEditorスケルトン
4. ChatPanelスケルトン（既存PromptPanel改修）

### Phase 2: Rete.js統合

1. ReteCanvasの実装
2. NodePaletteの実装
3. 基本的なノード配置・接続機能

### Phase 3: 機能拡張

1. NodePropertyEditorの実装
2. ワークフロー保存/読み込み
3. プリセット管理

### Phase 4: 実行機能

1. ワークフロー実行（WorkflowTransformer統合）
2. ノード実行状態の可視化
3. LogViewerとの連携

### Phase 5: UX改善

1. キーボードショートカット
2. パネル折りたたみ
3. リサイズ機能
4. アニメーション

---

## 11. まとめ

### 設計のポイント

✅ **シンプル**: 3ペイン + 1下部パネルのクリーンな構成
✅ **機能的**: ワークフロー管理、編集、対話、ログがすべて同時に見える
✅ **柔軟**: すべてのパネルが折りたたみ・リサイズ可能
✅ **効率的**: 既存コンポーネント（LogViewer、PromptPanel）を最大限再利用
✅ **拡張可能**: 新しいノードタイプやプリセットを簡単に追加可能

### 次のステップ

1. **フェーズ1のタスク**から実装開始（レイアウト構築）
2. **TDD原則**に従ってテストファースト
3. **段階的リリース**で既存機能を破壊しない

---

**このUI設計書は、Rete.jsワークフローエディタのElectron UIの実装ガイドラインです。**
