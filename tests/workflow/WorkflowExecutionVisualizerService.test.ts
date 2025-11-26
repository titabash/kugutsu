/**
 * WorkflowExecutionVisualizerService Tests
 *
 * Phase 4.5: Real-time workflow execution visualization
 * TDD Red Phase: Tests for workflow execution state visualization
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';

// ============================================================================
// Mock Types (simulating StateStreamManager events)
// ============================================================================

interface NodeStatusEvent {
  nodeId: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  timestamp: number;
  executionTime?: number;
}

interface WorkflowExecutionState {
  nodes: Map<string, NodeStatusEvent>;
  currentNodeId: string | null;
  startTime: number | null;
  endTime: number | null;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  logs: ExecutionLogEntry[];
}

interface ExecutionLogEntry {
  nodeId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
}

type EventCallback = (event: NodeStatusEvent | ExecutionLogEntry) => void;

// ============================================================================
// Import WorkflowExecutionVisualizerService
// ============================================================================

// This will be implemented after tests
import {
  WorkflowExecutionVisualizerService,
  type VisualizerServiceOptions,
} from '../../src/workflow/WorkflowExecutionVisualizerService.js';

// ============================================================================
// Test Data
// ============================================================================

const sampleWorkflowNodes = [
  { id: 'start-1', type: 'start' as const, label: 'Start' },
  { id: 'engineer-1', type: 'engineer' as const, label: 'Engineer' },
  { id: 'reviewer-1', type: 'reviewer' as const, label: 'Reviewer' },
  { id: 'end-1', type: 'end' as const, label: 'End' },
];

// ============================================================================
// WorkflowExecutionVisualizerService Tests
// ============================================================================

describe('WorkflowExecutionVisualizerService', () => {
  let service: WorkflowExecutionVisualizerService;

  beforeEach(() => {
    jest.useFakeTimers();
    service = new WorkflowExecutionVisualizerService();
  });

  afterEach(() => {
    service.destroy();
    jest.useRealTimers();
  });

  // ==========================================================================
  // Initialization Tests
  // ==========================================================================

  describe('Initialization', () => {
    it('should create service with default options', () => {
      expect(service).toBeDefined();
      expect(service.getState().status).toBe('idle');
    });

    it('should accept custom options', () => {
      const options: VisualizerServiceOptions = {
        maxLogEntries: 500,
        updateThrottleMs: 100,
      };
      const customService = new WorkflowExecutionVisualizerService(options);
      expect(customService).toBeDefined();
      customService.destroy();
    });

    it('should initialize workflow with node list', () => {
      service.initializeWorkflow(sampleWorkflowNodes);

      const state = service.getState();
      expect(state.nodes.size).toBe(4);
      expect(state.nodes.get('start-1')?.status).toBe('pending');
    });

    it('should reset state when initializing new workflow', () => {
      // Initialize first workflow
      service.initializeWorkflow(sampleWorkflowNodes);
      service.startExecution();

      // Initialize new workflow
      service.initializeWorkflow([{ id: 'new-1', type: 'start' as const, label: 'New Start' }]);

      const state = service.getState();
      expect(state.nodes.size).toBe(1);
      expect(state.status).toBe('idle');
    });
  });

  // ==========================================================================
  // Execution State Tests
  // ==========================================================================

  describe('Execution State', () => {
    beforeEach(() => {
      service.initializeWorkflow(sampleWorkflowNodes);
    });

    it('should start execution', () => {
      service.startExecution();

      const state = service.getState();
      expect(state.status).toBe('running');
      expect(state.startTime).toBeDefined();
    });

    it('should complete execution', () => {
      service.startExecution();
      service.completeExecution();

      const state = service.getState();
      expect(state.status).toBe('completed');
      expect(state.endTime).toBeDefined();
    });

    it('should fail execution', () => {
      service.startExecution();
      service.failExecution('Something went wrong');

      const state = service.getState();
      expect(state.status).toBe('failed');
      expect(state.logs.some((log) => log.level === 'error')).toBe(true);
    });

    it('should cancel execution', () => {
      service.startExecution();
      service.cancelExecution();

      const state = service.getState();
      expect(state.status).toBe('cancelled');
    });

    it('should not start if already running', () => {
      service.startExecution();
      const firstStartTime = service.getState().startTime;

      jest.advanceTimersByTime(100);
      service.startExecution();

      expect(service.getState().startTime).toBe(firstStartTime);
    });
  });

  // ==========================================================================
  // Node Status Update Tests
  // ==========================================================================

  describe('Node Status Updates', () => {
    beforeEach(() => {
      service.initializeWorkflow(sampleWorkflowNodes);
      service.startExecution();
    });

    it('should update node status to executing', () => {
      service.updateNodeStatus('start-1', 'executing');

      const state = service.getState();
      expect(state.nodes.get('start-1')?.status).toBe('executing');
      expect(state.currentNodeId).toBe('start-1');
    });

    it('should update node status to completed', () => {
      service.updateNodeStatus('start-1', 'executing');
      service.updateNodeStatus('start-1', 'completed');

      const state = service.getState();
      expect(state.nodes.get('start-1')?.status).toBe('completed');
      expect(state.nodes.get('start-1')?.executionTime).toBeDefined();
    });

    it('should update node status to failed', () => {
      service.updateNodeStatus('engineer-1', 'executing');
      service.updateNodeStatus('engineer-1', 'failed');

      const state = service.getState();
      expect(state.nodes.get('engineer-1')?.status).toBe('failed');
    });

    it('should track current executing node', () => {
      service.updateNodeStatus('start-1', 'executing');
      expect(service.getState().currentNodeId).toBe('start-1');

      service.updateNodeStatus('start-1', 'completed');
      service.updateNodeStatus('engineer-1', 'executing');
      expect(service.getState().currentNodeId).toBe('engineer-1');
    });

    it('should calculate execution time', () => {
      service.updateNodeStatus('start-1', 'executing');
      jest.advanceTimersByTime(1000);
      service.updateNodeStatus('start-1', 'completed');

      const nodeStatus = service.getState().nodes.get('start-1');
      expect(nodeStatus?.executionTime).toBeGreaterThanOrEqual(1000);
    });

    it('should ignore updates for non-existent nodes', () => {
      service.updateNodeStatus('non-existent', 'executing');

      const state = service.getState();
      expect(state.nodes.has('non-existent')).toBe(false);
    });
  });

  // ==========================================================================
  // Progress Calculation Tests
  // ==========================================================================

  describe('Progress Calculation', () => {
    beforeEach(() => {
      service.initializeWorkflow(sampleWorkflowNodes);
      service.startExecution();
    });

    it('should start at 0% progress', () => {
      expect(service.getState().progress).toBe(0);
    });

    it('should calculate progress based on completed nodes', () => {
      service.updateNodeStatus('start-1', 'completed');
      expect(service.getState().progress).toBe(25); // 1/4 = 25%

      service.updateNodeStatus('engineer-1', 'completed');
      expect(service.getState().progress).toBe(50); // 2/4 = 50%
    });

    it('should reach 100% when all nodes completed', () => {
      sampleWorkflowNodes.forEach((node) => {
        service.updateNodeStatus(node.id, 'completed');
      });

      expect(service.getState().progress).toBe(100);
    });

    it('should count failed nodes in progress', () => {
      service.updateNodeStatus('start-1', 'completed');
      service.updateNodeStatus('engineer-1', 'failed');

      // Failed nodes count towards progress (execution is done for that node)
      expect(service.getState().progress).toBe(50);
    });
  });

  // ==========================================================================
  // Log Management Tests
  // ==========================================================================

  describe('Log Management', () => {
    beforeEach(() => {
      service.initializeWorkflow(sampleWorkflowNodes);
      service.startExecution();
    });

    it('should add log entries', () => {
      service.addLog('start-1', 'info', 'Starting workflow');

      const state = service.getState();
      expect(state.logs).toHaveLength(1);
      expect(state.logs[0].message).toBe('Starting workflow');
    });

    it('should store log with node ID', () => {
      service.addLog('engineer-1', 'info', 'Processing task');

      const state = service.getState();
      expect(state.logs[0].nodeId).toBe('engineer-1');
    });

    it('should store different log levels', () => {
      service.addLog('start-1', 'info', 'Info message');
      service.addLog('engineer-1', 'warn', 'Warning message');
      service.addLog('reviewer-1', 'error', 'Error message');

      const state = service.getState();
      expect(state.logs).toHaveLength(3);
      expect(state.logs[0].level).toBe('info');
      expect(state.logs[1].level).toBe('warn');
      expect(state.logs[2].level).toBe('error');
    });

    it('should limit log entries to maxLogEntries', () => {
      const limitedService = new WorkflowExecutionVisualizerService({
        maxLogEntries: 5,
      });
      limitedService.initializeWorkflow(sampleWorkflowNodes);
      limitedService.startExecution();

      for (let i = 0; i < 10; i++) {
        limitedService.addLog('start-1', 'info', `Message ${i}`);
      }

      const state = limitedService.getState();
      expect(state.logs).toHaveLength(5);
      expect(state.logs[0].message).toBe('Message 5'); // Oldest kept
      expect(state.logs[4].message).toBe('Message 9'); // Newest

      limitedService.destroy();
    });

    it('should filter logs by node ID', () => {
      service.addLog('start-1', 'info', 'Start message');
      service.addLog('engineer-1', 'info', 'Engineer message');
      service.addLog('start-1', 'warn', 'Another start message');

      const filtered = service.getLogsForNode('start-1');
      expect(filtered).toHaveLength(2);
      expect(filtered.every((log) => log.nodeId === 'start-1')).toBe(true);
    });

    it('should filter logs by level', () => {
      service.addLog('start-1', 'info', 'Info message');
      service.addLog('engineer-1', 'error', 'Error message');
      service.addLog('reviewer-1', 'error', 'Another error');

      const errors = service.getLogsByLevel('error');
      expect(errors).toHaveLength(2);
      expect(errors.every((log) => log.level === 'error')).toBe(true);
    });
  });

  // ==========================================================================
  // Event Subscription Tests
  // ==========================================================================

  describe('Event Subscription', () => {
    beforeEach(() => {
      service.initializeWorkflow(sampleWorkflowNodes);
    });

    it('should subscribe to node status changes', () => {
      const callback = jest.fn();
      service.onNodeStatusChange(callback);
      service.startExecution();
      service.updateNodeStatus('start-1', 'executing');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeId: 'start-1',
          status: 'executing',
        })
      );
    });

    it('should subscribe to execution state changes', () => {
      const callback = jest.fn();
      service.onExecutionStateChange(callback);
      service.startExecution();

      expect(callback).toHaveBeenCalledWith('running');
    });

    it('should subscribe to progress updates', () => {
      const callback = jest.fn();
      service.onProgressUpdate(callback);
      service.startExecution();
      service.updateNodeStatus('start-1', 'completed');

      expect(callback).toHaveBeenCalledWith(25);
    });

    it('should subscribe to log entries', () => {
      const callback = jest.fn();
      service.onLogEntry(callback);
      service.startExecution();
      service.addLog('start-1', 'info', 'Test message');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeId: 'start-1',
          message: 'Test message',
        })
      );
    });

    it('should unsubscribe from events', () => {
      const callback = jest.fn();
      const unsubscribe = service.onNodeStatusChange(callback);

      service.startExecution();
      service.updateNodeStatus('start-1', 'executing');
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      service.updateNodeStatus('start-1', 'completed');
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // StateStreamManager Integration Tests
  // ==========================================================================

  describe('StateStreamManager Integration', () => {
    it('should handle node-started events', () => {
      service.initializeWorkflow(sampleWorkflowNodes);
      service.startExecution();

      // Simulate StateStreamManager event
      service.handleStreamEvent({
        type: 'node-started',
        data: { nodeId: 'start-1', timestamp: Date.now() },
      });

      expect(service.getState().nodes.get('start-1')?.status).toBe('executing');
    });

    it('should handle node-completed events', () => {
      service.initializeWorkflow(sampleWorkflowNodes);
      service.startExecution();

      service.handleStreamEvent({
        type: 'node-started',
        data: { nodeId: 'engineer-1', timestamp: Date.now() },
      });
      service.handleStreamEvent({
        type: 'node-completed',
        data: { nodeId: 'engineer-1', timestamp: Date.now(), status: 'completed' },
      });

      expect(service.getState().nodes.get('engineer-1')?.status).toBe('completed');
    });

    it('should handle logs-batch events', () => {
      service.initializeWorkflow(sampleWorkflowNodes);
      service.startExecution();

      service.handleStreamEvent({
        type: 'logs-batch',
        data: [
          { source: 'start-1', level: 'info', message: 'Log 1', timestamp: Date.now() },
          { source: 'engineer-1', level: 'warn', message: 'Log 2', timestamp: Date.now() },
        ],
      });

      expect(service.getState().logs).toHaveLength(2);
    });

    it('should handle phase-change events', () => {
      service.initializeWorkflow(sampleWorkflowNodes);
      service.startExecution();

      service.handleStreamEvent({
        type: 'phase-change',
        data: { from: 'running', to: 'complete' },
      });

      expect(service.getState().status).toBe('completed');
    });

    it('should handle error events', () => {
      service.initializeWorkflow(sampleWorkflowNodes);
      service.startExecution();

      service.handleStreamEvent({
        type: 'error',
        data: [{ message: 'Something went wrong' }],
      });

      const state = service.getState();
      expect(state.logs.some((log) => log.level === 'error')).toBe(true);
    });
  });

  // ==========================================================================
  // Cleanup Tests
  // ==========================================================================

  describe('Cleanup', () => {
    it('should clear state on destroy', () => {
      service.initializeWorkflow(sampleWorkflowNodes);
      service.startExecution();
      service.addLog('start-1', 'info', 'Test');

      service.destroy();

      const state = service.getState();
      expect(state.nodes.size).toBe(0);
      expect(state.logs).toHaveLength(0);
      expect(state.status).toBe('idle');
    });

    it('should unsubscribe all listeners on destroy', () => {
      const callback = jest.fn();
      service.onNodeStatusChange(callback);
      service.initializeWorkflow(sampleWorkflowNodes);

      service.destroy();

      // Create new service and try to trigger event
      const newService = new WorkflowExecutionVisualizerService();
      newService.initializeWorkflow(sampleWorkflowNodes);
      newService.startExecution();
      newService.updateNodeStatus('start-1', 'executing');

      // Original callback should not be called
      expect(callback).not.toHaveBeenCalled();
      newService.destroy();
    });

    it('should be reusable after destroy', () => {
      service.initializeWorkflow(sampleWorkflowNodes);
      service.startExecution();
      service.destroy();

      // Reinitialize
      service.initializeWorkflow(sampleWorkflowNodes);
      service.startExecution();

      expect(service.getState().status).toBe('running');
    });
  });

  // ==========================================================================
  // Throttling Tests
  // ==========================================================================

  describe('Throttling', () => {
    it('should throttle rapid updates', () => {
      const throttledService = new WorkflowExecutionVisualizerService({
        updateThrottleMs: 100,
      });
      throttledService.initializeWorkflow(sampleWorkflowNodes);
      throttledService.startExecution();

      const callback = jest.fn();
      throttledService.onProgressUpdate(callback);

      // Rapid updates
      throttledService.updateNodeStatus('start-1', 'completed');
      throttledService.updateNodeStatus('engineer-1', 'completed');
      throttledService.updateNodeStatus('reviewer-1', 'completed');

      // Only one throttled update should have been emitted initially
      expect(callback.mock.calls.length).toBeLessThanOrEqual(3);

      // After throttle period, remaining updates should be processed
      jest.advanceTimersByTime(200);

      throttledService.destroy();
    });
  });

  // ==========================================================================
  // Snapshot Tests
  // ==========================================================================

  describe('Snapshot', () => {
    it('should create state snapshot', () => {
      service.initializeWorkflow(sampleWorkflowNodes);
      service.startExecution();
      service.updateNodeStatus('start-1', 'completed');
      service.addLog('start-1', 'info', 'Completed');

      const snapshot = service.createSnapshot();

      expect(snapshot).toMatchObject({
        status: 'running',
        progress: 25,
        nodesCount: 4,
        completedCount: 1,
        logsCount: 1,
      });
    });

    it('should restore from snapshot', () => {
      service.initializeWorkflow(sampleWorkflowNodes);
      service.startExecution();
      service.updateNodeStatus('start-1', 'completed');
      service.updateNodeStatus('engineer-1', 'completed');

      const snapshot = service.createSnapshot();

      // Create new service and restore
      const newService = new WorkflowExecutionVisualizerService();
      newService.restoreFromSnapshot(snapshot, sampleWorkflowNodes);

      const state = newService.getState();
      expect(state.status).toBe('running');
      expect(state.progress).toBe(50);

      newService.destroy();
    });
  });
});
