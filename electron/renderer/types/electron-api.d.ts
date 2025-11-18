/**
 * Electron API型定義
 *
 * contextBridge.exposeInMainWorld で公開された electronAPI の型定義
 */

export interface ElectronAPI {
  // ==========================================
  // LangGraph IPC API (New Architecture)
  // ==========================================

  /**
   * バッチ化されたグラフイベントのリスナー
   */
  onGraphEventsBatch: (callback: (events: GraphEvent[]) => void) => () => void;

  /**
   * 実行をキャンセル
   */
  cancelExecution: () => Promise<{ success: boolean; message: string }>;

  /**
   * 現在のグラフ状態を取得
   */
  getGraphState: () => Promise<any>;

  /**
   * タスク詳細を取得
   */
  getTaskDetails: (taskId: string) => Promise<any | null>;

  /**
   * Rendererからエラーログを送信
   */
  logError: (message: string, details?: any) => Promise<void>;

  // ==========================================
  // File System Events
  // ==========================================

  /**
   * 初期データ読み込みイベントのリスナー
   */
  onInitialDataLoaded: (fileType: string, callback: (data: any) => void) => () => void;

  /**
   * ファイル変更イベントのリスナー
   */
  onFileChanged: (fileType: string, callback: (data: any) => void) => () => void;

  // ==========================================
  // Node Flow Events
  // ==========================================

  /**
   * ノードフロー初期化イベントのリスナー
   */
  onNodeFlowInit: (callback: (flowData: any) => void) => () => void;

  /**
   * ノード状態変更イベントのリスナー
   */
  onNodeStatusChange: (callback: (data: { nodeId: string; status: string; timestamp: number }) => void) => () => void;

  // ==========================================
  // Legacy API (Backward Compatibility)
  // ==========================================

  // ログ関連
  sendLog: (data: any) => Promise<void>;
  onLogData: (callback: (data: any) => void) => void;
  onStructuredLogData: (callback: (data: any) => void) => void;

  // レイアウト関連
  updateLayout: (engineerCount: number) => Promise<{ success: boolean; engineerCount: number }>;
  onLayoutUpdate: (callback: (engineerCount: number) => void) => void;

  // タスクステータス関連
  onTaskStatusUpdate: (callback: (data: { completed: number; total: number }) => void) => void;
  onAllTasksCompleted: (callback: (data: any) => void) => void;

  // ターミナルクリア
  onClearTerminal: (callback: (terminalId: string) => void) => void;

  // 接続ステータス
  onConnectionStatus: (callback: (connected: boolean) => void) => void;

  // TechLeadとEngineerの関連付け
  onAssociateTechLeadEngineer: (callback: (data: { techLeadId: string; engineerId: string }) => void) => void;

  // イベントリスナーの削除
  removeAllListeners: (channel: string) => void;

  // タスク管理関連
  getTasks: () => Promise<any[]>;
  getTaskOverview: () => Promise<string>;
  getTaskInstruction: (taskId: string) => Promise<string>;
  getWorkingDirectory: () => Promise<string>;
  onTaskUpdate: (callback: (tasks: any[]) => void) => void;
  onTaskOverviewUpdate: (callback: (overview: string) => void) => void;

  // プロジェクト管理関連
  getCurrentProjectPath: () => Promise<string | null>;
  openProjectDialog: () => Promise<string | null>;
  onProjectOpened: (callback: (data: { projectPath: string }) => void) => void;
  onProjectClosed: (callback: () => void) => void;

  // プロンプト実行関連
  executePrompt: (
    prompt: string,
    options: { provider?: string; maxEngineers?: number; maxTurns?: number }
  ) => Promise<{ success: boolean; message: string }>;
}

/**
 * グラフイベント型定義
 *
 * StateStreamManagerのEventTypeと完全に一致させる
 */
export interface GraphEvent {
  type:
    | 'state-init'
    | 'node-started'
    | 'node-completed'
    | 'node-flow-init'        // ノードフロー全体の初期化
    | 'node-status-change'    // ノード状態変更
    | 'task-update'
    | 'tasks-batch'
    | 'logs-batch'
    | 'phase-change'
    | 'error'
    | 'complete';
  data: any;
  timestamp: number;
  priority: 'high' | 'normal' | 'low';
}

/**
 * Window インターフェースの拡張
 */
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
