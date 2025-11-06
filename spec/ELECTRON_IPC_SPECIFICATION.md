# Electron IPC Communication Specification

**プロジェクト**: Kugutsu 2.0 - AI Parallel Development System
**バージョン**: 1.0.0
**最終更新**: 2025-11-05
**対象**: Phase 3 - UI統合（IPC通信）
**ステータス**: Draft

---

## 1. 概要

本仕様書は、Kugutsu 2.0のElectronアプリケーションにおけるメインプロセスとレンダラープロセス間のIPC（Inter-Process Communication）通信仕様を定義します。LangGraphの実行状態をリアルタイムかつ効率的にUIに反映するため、バッファリング、スロットリング、差分検出などの最適化手法を適用します。

### 1.1 目的

- セキュアなIPC通信の実装
- リアルタイム状態更新の最適化
- パフォーマンスとメモリ効率の両立
- 拡張性の高いアーキテクチャ設計

### 1.2 対象読者

- バックエンド開発者
- フロントエンド開発者
- システムアーキテクト

---

## 2. アーキテクチャ

### 2.1 全体構成

```
Main Process (Node.js 22.20.0)
    │
    ├─ ParallelDevOrchestrator
    │  └─ LangGraph Execution
    │      ├─ Stream Mode: 'updates'
    │      └─ State Updates
    │
    ├─ StateStreamManager ★新規コンポーネント
    │  ├─ Buffer (50ms interval)
    │  ├─ Throttle (max 20 events/sec)
    │  ├─ Diff Detection
    │  └─ Event Batching
    │
    │  IPC Channel
    │  ↓ (webContents.send)
    │
Preload Script (Security Boundary)
    │
    ├─ contextBridge.exposeInMainWorld
    │  └─ window.electronAPI
    │      ├─ Event Listeners (Main → Renderer)
    │      └─ Invoke Handlers (Renderer → Main)
    │
    │  window.electronAPI
    │  ↓
    │
Renderer Process (React 19)
    │
    ├─ IPC Event Handlers
    │  └─ Zustand Store Updates
    │      └─ React Re-render
    │
    └─ IPC Invoke Calls
        └─ @tanstack/react-query
```

### 2.2 セキュリティ原則

#### ❌ 禁止事項
- `nodeIntegration: true` の使用
- `ipcRenderer` の直接公開
- `remote` モジュールの使用
- レンダラープロセスからのNode.js API直接呼び出し

#### ✅ 必須事項
- `contextBridge` による明示的なAPI公開
- `contextIsolation: true` の設定
- 入力検証とサニタイゼーション
- Content Security Policy (CSP) の適用

---

## 3. StateStreamManager仕様

### 3.1 責務

StateStreamManagerは、LangGraphのストリーム出力をElectron IPCに最適化された形式に変換する中間層です。

**主な機能:**
1. **バッファリング**: 短時間に発生する複数の状態更新をバッファに蓄積
2. **バッチ送信**: バッファされたイベントを一括送信（オーバーヘッド削減）
3. **差分検出**: 前回の状態と比較し、変更があった部分のみ送信
4. **スロットリング**: 送信頻度を制限（UI負荷軽減）
5. **優先度制御**: 重要なイベント（エラー等）を優先送信

### 3.2 クラス設計

```typescript
/**
 * State Stream Manager
 *
 * LangGraph state stream → Electron IPC with optimization
 */
import type { BrowserWindow } from 'electron';
import type { ParallelDevStateType } from '../graph/state.js';

export interface StreamManagerOptions {
  /**
   * バッファフラッシュ間隔（ms）
   * @default 50
   */
  bufferInterval?: number;

  /**
   * 最大イベント数/秒
   * @default 20
   */
  maxEventsPerSecond?: number;

  /**
   * バッファサイズ上限
   * @default 100
   */
  maxBufferSize?: number;

  /**
   * ログバッファサイズ
   * @default 1000
   */
  maxLogBuffer?: number;
}

export interface BufferedEvent {
  type: EventType;
  data: any;
  timestamp: number;
  priority: 'high' | 'normal' | 'low';
}

export type EventType =
  | 'state-init'
  | 'node-started'
  | 'node-completed'
  | 'task-update'
  | 'tasks-batch'
  | 'logs-batch'
  | 'phase-change'
  | 'error'
  | 'complete';

export class StateStreamManager {
  private window: BrowserWindow | null = null;
  private buffer: BufferedEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private previousState: ParallelDevStateType | null = null;
  private lastFlushTime: number = 0;
  private options: Required<StreamManagerOptions>;

  constructor(options: StreamManagerOptions = {}) {
    this.options = {
      bufferInterval: options.bufferInterval ?? 50,
      maxEventsPerSecond: options.maxEventsPerSecond ?? 20,
      maxBufferSize: options.maxBufferSize ?? 100,
      maxLogBuffer: options.maxLogBuffer ?? 1000,
    };
  }

  /**
   * BrowserWindowを設定してフラッシュを開始
   */
  setWindow(window: BrowserWindow | null): void {
    this.window = window;
    if (window) {
      this.startFlushing();
    } else {
      this.stopFlushing();
    }
  }

  /**
   * LangGraphのState更新を処理
   */
  async processStateUpdate(state: ParallelDevStateType): Promise<void> {
    if (!this.window) return;

    // 差分検出
    const events = this.detectChanges(this.previousState, state);

    // バッファに追加（優先度順）
    events.forEach(event => this.addToBuffer(event));

    // 状態を保存
    this.previousState = this.cloneState(state);

    // バッファが上限に達したら即座にフラッシュ
    if (this.buffer.length >= this.options.maxBufferSize) {
      this.flush();
    }
  }

  /**
   * 差分検出とイベント生成
   */
  private detectChanges(
    prev: ParallelDevStateType | null,
    current: ParallelDevStateType
  ): BufferedEvent[] {
    const events: BufferedEvent[] = [];

    // 初回は全体を送信
    if (!prev) {
      events.push({
        type: 'state-init',
        data: current,
        timestamp: Date.now(),
        priority: 'high',
      });
      return events;
    }

    // ノード実行状態の変更
    if (current.currentNode !== prev.currentNode) {
      if (current.currentNode) {
        events.push({
          type: 'node-started',
          data: { nodeId: current.currentNode },
          timestamp: Date.now(),
          priority: 'high',
        });
      }
    }

    // タスク更新検出
    const taskUpdates = this.detectTaskChanges(prev.tasks, current.tasks);
    if (taskUpdates.length > 0) {
      events.push({
        type: 'tasks-batch',
        data: taskUpdates,
        timestamp: Date.now(),
        priority: 'normal',
      });
    }

    // ログ追加検出
    const newLogs = current.logs.slice(prev.logs.length);
    if (newLogs.length > 0) {
      events.push({
        type: 'logs-batch',
        data: newLogs,
        timestamp: Date.now(),
        priority: 'low',
      });
    }

    // フェーズ変更検出
    if (current.metadata.phase !== prev.metadata.phase) {
      events.push({
        type: 'phase-change',
        data: {
          from: prev.metadata.phase,
          to: current.metadata.phase,
        },
        timestamp: Date.now(),
        priority: 'high',
      });
    }

    // エラー検出
    if (current.metadata.hasErrors && !prev.metadata.hasErrors) {
      events.push({
        type: 'error',
        data: current.metadata.errors,
        timestamp: Date.now(),
        priority: 'high',
      });
    }

    // 完了検出
    if (current.metadata.phase === 'complete' && prev.metadata.phase !== 'complete') {
      events.push({
        type: 'complete',
        data: {
          totalTasks: current.metadata.totalTasks,
          tasksCompleted: current.metadata.tasksCompleted,
          tasksFailed: current.metadata.tasksFailed,
        },
        timestamp: Date.now(),
        priority: 'high',
      });
    }

    return events;
  }

  /**
   * タスクの変更検出
   */
  private detectTaskChanges(
    prevTasks: Task[],
    currentTasks: Task[]
  ): Task[] {
    const taskMap = new Map(prevTasks.map(t => [t.id, t]));
    const updates: Task[] = [];

    for (const task of currentTasks) {
      const prevTask = taskMap.get(task.id);
      if (!prevTask || this.hasTaskChanged(prevTask, task)) {
        updates.push(task);
      }
    }

    return updates;
  }

  /**
   * タスクが変更されたか判定
   */
  private hasTaskChanged(prev: Task, current: Task): boolean {
    return (
      prev.status !== current.status ||
      prev.progress !== current.progress ||
      prev.engineerId !== current.engineerId
    );
  }

  /**
   * バッファにイベントを追加（優先度順）
   */
  private addToBuffer(event: BufferedEvent): void {
    this.buffer.push(event);

    // 優先度でソート（high → normal → low）
    this.buffer.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * 定期的なフラッシュを開始
   */
  private startFlushing(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.options.bufferInterval);
  }

  /**
   * フラッシュを停止
   */
  private stopFlushing(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * バッファをフラッシュ（一括送信）
   */
  private flush(): void {
    if (!this.window || this.buffer.length === 0) return;

    // スロットリングチェック
    const now = Date.now();
    const timeSinceLastFlush = now - this.lastFlushTime;
    const minInterval = 1000 / this.options.maxEventsPerSecond;

    if (timeSinceLastFlush < minInterval) {
      // まだ送信できない
      return;
    }

    try {
      // イベントバッチを送信
      this.window.webContents.send('graph-events-batch', this.buffer);

      // バッファをクリア
      this.buffer = [];
      this.lastFlushTime = now;
    } catch (error) {
      console.error('Failed to flush events:', error);
    }
  }

  /**
   * 状態のディープコピー
   */
  private cloneState(state: ParallelDevStateType): ParallelDevStateType {
    return JSON.parse(JSON.stringify(state));
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    this.stopFlushing();
    this.flush(); // 残りのイベントを送信
    this.buffer = [];
    this.previousState = null;
    this.window = null;
  }
}
```

### 3.3 パフォーマンス最適化

#### バッファリング戦略

```typescript
// 50msごとにバッファをフラッシュ
const DEFAULT_BUFFER_INTERVAL = 50; // ms

// 例: 100個のログが1秒間に追加される場合
// - バッファリングなし: 100回のIPC呼び出し
// - バッファリングあり: 約20回のIPC呼び出し（50ms間隔）
// → 80%の削減
```

#### スロットリング戦略

```typescript
// 最大20イベント/秒
const MAX_EVENTS_PER_SECOND = 20;

// 例: 50個/秒のイベントが発生する場合
// - スロットリングなし: UIが追いつかない
// - スロットリングあり: 20個/秒で安定
// → UIレスポンスの向上
```

#### 差分検出

```typescript
// タスク変更の検出
// O(n) の効率的なアルゴリズム
const taskMap = new Map(prevTasks.map(t => [t.id, t]));
for (const task of currentTasks) {
  const prevTask = taskMap.get(task.id);
  if (!prevTask || hasChanged(prevTask, task)) {
    updates.push(task);
  }
}
```

---

## 4. IPC Channel定義

### 4.1 Main → Renderer（イベント）

#### Channel: `graph-events-batch`

**説明**: バッファされた複数のイベントを一括送信

**ペイロード型**:
```typescript
interface GraphEventsBatch {
  events: BufferedEvent[];
}
```

**使用例（Preload）**:
```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  onGraphEventsBatch: (callback: (events: BufferedEvent[]) => void) => {
    ipcRenderer.on('graph-events-batch', (_event, events) => {
      callback(events);
    });

    // クリーンアップ関数を返す
    return () => {
      ipcRenderer.removeAllListeners('graph-events-batch');
    };
  },
});
```

**使用例（Renderer）**:
```typescript
useEffect(() => {
  const unsubscribe = window.electronAPI.onGraphEventsBatch((events) => {
    events.forEach(event => {
      switch (event.type) {
        case 'tasks-batch':
          updateTasks(event.data);
          break;
        case 'logs-batch':
          addLogs(event.data);
          break;
        case 'phase-change':
          setPhase(event.data.to);
          break;
      }
    });
  });

  return () => unsubscribe();
}, []);
```

### 4.2 Renderer → Main（Invoke）

#### Channel: `pause-execution`

**説明**: 実行を一時停止

**引数**: なし

**戻り値**: `Promise<{ success: boolean }>`

```typescript
// Preload
contextBridge.exposeInMainWorld('electronAPI', {
  pauseExecution: () => ipcRenderer.invoke('pause-execution'),
});

// Renderer
const handlePause = async () => {
  const { success } = await window.electronAPI.pauseExecution();
  if (success) {
    console.log('Execution paused');
  }
};
```

#### Channel: `resume-execution`

**説明**: 実行を再開

**引数**: なし

**戻り値**: `Promise<{ success: boolean }>`

#### Channel: `cancel-execution`

**説明**: 実行をキャンセル

**引数**: なし

**戻り値**: `Promise<{ success: boolean; message?: string }>`

#### Channel: `get-graph-state`

**説明**: 現在のグラフ状態を取得

**引数**: なし

**戻り値**: `Promise<ParallelDevStateType>`

```typescript
// Preload
contextBridge.exposeInMainWorld('electronAPI', {
  getGraphState: () => ipcRenderer.invoke('get-graph-state'),
});

// Renderer (React Query使用)
const { data: state } = useSuspenseQuery({
  queryKey: ['graphState'],
  queryFn: () => window.electronAPI.getGraphState(),
});
```

#### Channel: `get-task-details`

**説明**: タスクの詳細情報を取得

**引数**: `{ taskId: string }`

**戻り値**: `Promise<Task | null>`

```typescript
// Preload
contextBridge.exposeInMainWorld('electronAPI', {
  getTaskDetails: (taskId: string) =>
    ipcRenderer.invoke('get-task-details', taskId),
});

// Renderer
const { data: task } = useQuery({
  queryKey: ['task', taskId],
  queryFn: () => window.electronAPI.getTaskDetails(taskId),
});
```

---

## 5. Preload Script仕様

### 5.1 完全な型定義

```typescript
// src/electron/preload/index.ts

import { contextBridge, ipcRenderer } from 'electron';
import type { BufferedEvent } from '../StateStreamManager';
import type { ParallelDevStateType } from '../../graph/state';
import type { Task } from '../../graph/types';

// API型定義
export interface ElectronAPI {
  // Event Listeners (Main → Renderer)
  onGraphEventsBatch: (
    callback: (events: BufferedEvent[]) => void
  ) => () => void;

  // Invoke Handlers (Renderer → Main)
  pauseExecution: () => Promise<{ success: boolean }>;
  resumeExecution: () => Promise<{ success: boolean }>;
  cancelExecution: () => Promise<{ success: boolean; message?: string }>;
  getGraphState: () => Promise<ParallelDevStateType>;
  getTaskDetails: (taskId: string) => Promise<Task | null>;

  // Logging
  logError: (message: string, details?: any) => Promise<void>;
}

// Expose API
contextBridge.exposeInMainWorld('electronAPI', {
  onGraphEventsBatch: (callback) => {
    const listener = (_event: any, events: BufferedEvent[]) => {
      callback(events);
    };
    ipcRenderer.on('graph-events-batch', listener);
    return () => {
      ipcRenderer.removeListener('graph-events-batch', listener);
    };
  },

  pauseExecution: () => ipcRenderer.invoke('pause-execution'),
  resumeExecution: () => ipcRenderer.invoke('resume-execution'),
  cancelExecution: () => ipcRenderer.invoke('cancel-execution'),
  getGraphState: () => ipcRenderer.invoke('get-graph-state'),
  getTaskDetails: (taskId: string) =>
    ipcRenderer.invoke('get-task-details', taskId),
  logError: (message: string, details?: any) =>
    ipcRenderer.invoke('log-error', { message, details }),
} as ElectronAPI);

// グローバル型拡張
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

### 5.2 セキュリティ検証

```typescript
// 入力検証ユーティリティ
function validateTaskId(taskId: unknown): taskId is string {
  return typeof taskId === 'string' && /^task-\d+$/.test(taskId);
}

// 使用例
contextBridge.exposeInMainWorld('electronAPI', {
  getTaskDetails: (taskId: string) => {
    if (!validateTaskId(taskId)) {
      throw new Error('Invalid task ID format');
    }
    return ipcRenderer.invoke('get-task-details', taskId);
  },
});
```

---

## 6. Main Process IPC Handlers

### 6.1 IPCハンドラー登録

```typescript
// src/electron/main/index.ts

import { app, BrowserWindow, ipcMain } from 'electron';
import { StateStreamManager } from '../StateStreamManager';
import { ParallelDevOrchestrator } from '../../managers/ParallelDevelopmentOrchestrator';

let mainWindow: BrowserWindow | null = null;
let stateManager: StateStreamManager | null = null;
let orchestrator: ParallelDevOrchestrator | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile('renderer/index.html');
}

// IPC Handlers
function setupIPCHandlers() {
  // Pause execution
  ipcMain.handle('pause-execution', async () => {
    try {
      await orchestrator?.pause();
      return { success: true };
    } catch (error) {
      console.error('Failed to pause:', error);
      return { success: false };
    }
  });

  // Resume execution
  ipcMain.handle('resume-execution', async () => {
    try {
      await orchestrator?.resume();
      return { success: true };
    } catch (error) {
      console.error('Failed to resume:', error);
      return { success: false };
    }
  });

  // Cancel execution
  ipcMain.handle('cancel-execution', async () => {
    try {
      await orchestrator?.cancel();
      return { success: true, message: 'Execution cancelled' };
    } catch (error) {
      console.error('Failed to cancel:', error);
      return { success: false, message: error.message };
    }
  });

  // Get graph state
  ipcMain.handle('get-graph-state', async () => {
    try {
      return orchestrator?.getCurrentState() || null;
    } catch (error) {
      console.error('Failed to get state:', error);
      throw error;
    }
  });

  // Get task details
  ipcMain.handle('get-task-details', async (_event, taskId: string) => {
    try {
      const state = orchestrator?.getCurrentState();
      return state?.tasks.find(t => t.id === taskId) || null;
    } catch (error) {
      console.error('Failed to get task:', error);
      return null;
    }
  });

  // Log error from renderer
  ipcMain.handle('log-error', async (_event, { message, details }) => {
    console.error('[Renderer Error]', message, details);
  });
}

app.whenReady().then(() => {
  createWindow();
  setupIPCHandlers();

  // Initialize StateStreamManager
  stateManager = new StateStreamManager();
  stateManager.setWindow(mainWindow);
});
```

---

## 7. エラーハンドリング

### 7.1 IPC通信エラー

```typescript
// Renderer側のエラーハンドリング
async function safeInvoke<T>(
  fn: () => Promise<T>,
  fallback: T,
  errorMessage: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(errorMessage, error);
    await window.electronAPI.logError(errorMessage, error);
    return fallback;
  }
}

// 使用例
const state = await safeInvoke(
  () => window.electronAPI.getGraphState(),
  null,
  'Failed to fetch graph state'
);
```

### 7.2 イベントリスナーのクリーンアップ

```typescript
// React hookでの適切なクリーンアップ
useEffect(() => {
  const unsubscribe = window.electronAPI.onGraphEventsBatch((events) => {
    processEvents(events);
  });

  // コンポーネントアンマウント時に必ずクリーンアップ
  return () => {
    unsubscribe();
  };
}, []);
```

---

## 8. パフォーマンス目標

| 指標 | 目標値 | 測定方法 |
|------|--------|---------|
| IPC遅延 | < 10ms | Performance API |
| バッファフラッシュ間隔 | 50ms | 設定値 |
| 最大イベント数/秒 | 20 events/sec | スロットリング |
| メモリ使用量（バッファ） | < 10MB | プロセスメモリ監視 |

---

## 9. テスト戦略

### 9.1 ユニットテスト

```typescript
describe('StateStreamManager', () => {
  let manager: StateStreamManager;
  let mockWindow: jest.Mocked<BrowserWindow>;

  beforeEach(() => {
    manager = new StateStreamManager({ bufferInterval: 50 });
    mockWindow = {
      webContents: {
        send: jest.fn(),
      },
    } as any;
    manager.setWindow(mockWindow);
  });

  it('should buffer events and flush after interval', async () => {
    await manager.processStateUpdate(createMockState());

    // 50ms待機
    await new Promise(resolve => setTimeout(resolve, 60));

    expect(mockWindow.webContents.send).toHaveBeenCalledWith(
      'graph-events-batch',
      expect.arrayContaining([
        expect.objectContaining({ type: 'state-init' }),
      ])
    );
  });
});
```

### 9.2 E2Eテスト

```typescript
import { _electron as electron } from 'playwright';

describe('IPC Communication', () => {
  it('should receive graph events in renderer', async () => {
    const app = await electron.launch({ args: ['.'] });
    const window = await app.firstWindow();

    // Rendererでイベントを監視
    const events = await window.evaluate(() => {
      return new Promise((resolve) => {
        const receivedEvents: any[] = [];
        window.electronAPI.onGraphEventsBatch((events) => {
          receivedEvents.push(...events);
          if (receivedEvents.length >= 1) {
            resolve(receivedEvents);
          }
        });
      });
    });

    expect(events).toHaveLength(1);
    await app.close();
  });
});
```

---

## 9.3 スプリント関連IPC

### スプリント状態同期

```typescript
// Main → Renderer: アクティブスプリント更新
interface SprintActiveUpdatedPayload {
  sprint: Sprint | null;
  tasks: GlobalTask[];
}
ipcMain.handle('sprint:active-updated', (event, payload: SprintActiveUpdatedPayload) => {...});

// Main → Renderer: スプリント完了
interface SprintCompletedPayload {
  sprintId: string;
  completedAt: Date;
  totalTasks: number;
  completedTasks: number;
  deployable: boolean;
}
ipcMain.handle('sprint:completed', (event, payload: SprintCompletedPayload) => {...});

// Renderer → Main: アクティブスプリント取得
ipcRenderer.invoke('sprint:request-active'): Promise<SprintActiveUpdatedPayload>;

// Main → Renderer: グローバルキュー更新
interface GlobalQueueUpdatedPayload {
  tasks: GlobalTask[];
  projects: Map<string, ProjectMetadata>;
}
ipcMain.handle('global-queue:updated', (event, payload: GlobalQueueUpdatedPayload) => {...});
```

---

## 10. 参考資料

- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Context Bridge](https://www.electronjs.org/docs/latest/api/context-bridge)
- [Performance Best Practices](https://www.electronjs.org/docs/latest/tutorial/performance)

---

**最終更新**: 2025-11-05
**バージョン**: 1.0.0
**承認**: 待機中
