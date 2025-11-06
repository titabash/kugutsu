/**
 * State Stream Manager
 *
 * LangGraph state stream → Electron IPC with optimization
 *
 * Features:
 * - Buffering: Accumulates state updates in a 50ms buffer
 * - Batch sending: Sends buffered events in bulk to reduce overhead
 * - Diff detection: Compares with previous state and sends only changes
 * - Throttling: Limits send frequency to max 20 events/sec
 * - Priority control: Prioritizes important events (errors, etc.)
 */
import type { BrowserWindow } from 'electron';
import type { ParallelDevStateType } from '../../src/graph/state.js';
export interface StreamManagerOptions {
    /**
     * Buffer flush interval (ms)
     * @default 50
     */
    bufferInterval?: number;
    /**
     * Maximum events per second
     * @default 20
     */
    maxEventsPerSecond?: number;
    /**
     * Maximum buffer size
     * @default 100
     */
    maxBufferSize?: number;
    /**
     * Maximum log buffer size
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
export type EventType = 'state-init' | 'node-started' | 'node-completed' | 'task-update' | 'tasks-batch' | 'logs-batch' | 'phase-change' | 'error' | 'complete';
export declare class StateStreamManager {
    private window;
    private buffer;
    private flushInterval;
    private previousState;
    private lastFlushTime;
    private options;
    private destroyed;
    constructor(options?: StreamManagerOptions);
    /**
     * Set BrowserWindow and start flushing
     */
    setWindow(window: BrowserWindow | null): void;
    /**
     * Process LangGraph state update
     */
    processStateUpdate(state: ParallelDevStateType): Promise<void>;
    /**
     * Detect changes and generate events
     */
    private detectChanges;
    /**
     * Get current node from state (if available)
     */
    private getCurrentNode;
    /**
     * Detect task changes
     */
    private detectTaskChanges;
    /**
     * Check if task has changed
     */
    private hasTaskChanged;
    /**
     * Add event to buffer (priority sorted)
     */
    private addToBuffer;
    /**
     * Start periodic flushing
     */
    private startFlushing;
    /**
     * Stop flushing
     */
    private stopFlushing;
    /**
     * Flush buffer (batch send)
     */
    private flush;
    /**
     * Deep copy state
     */
    private cloneState;
    /**
     * Cleanup
     */
    destroy(): void;
}
export declare function getStateStreamManager(options?: StreamManagerOptions): StateStreamManager;
export declare function destroyStateStreamManager(): void;
//# sourceMappingURL=StateStreamManager.d.ts.map