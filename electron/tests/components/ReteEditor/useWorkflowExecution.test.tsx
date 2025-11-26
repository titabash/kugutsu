/**
 * useWorkflowExecution Hook Tests
 *
 * Phase 4.5: Real-time workflow execution visualization
 * TDD Red Phase: Tests for React hook integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { useWorkflowExecution } from '../../../renderer/components/ReteEditor/useWorkflowExecution';

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
// useWorkflowExecution Hook Tests
// ============================================================================

describe('useWorkflowExecution', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // Initialization Tests
  // ==========================================================================

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      expect(result.current.status).toBe('idle');
      expect(result.current.progress).toBe(0);
      expect(result.current.currentNodeId).toBeNull();
      expect(result.current.logs).toEqual([]);
    });

    it('should initialize workflow nodes', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.initializeWorkflow(sampleWorkflowNodes);
      });

      expect(result.current.nodeStatuses.size).toBe(4);
      expect(result.current.nodeStatuses.get('start-1')).toBe('pending');
    });

    it('should reset state when reinitializing', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.initializeWorkflow(sampleWorkflowNodes);
        result.current.startExecution();
        result.current.updateNodeStatus('start-1', 'completed');
      });

      act(() => {
        result.current.initializeWorkflow([{ id: 'new-1', type: 'start', label: 'New' }]);
      });

      expect(result.current.status).toBe('idle');
      expect(result.current.nodeStatuses.size).toBe(1);
      expect(result.current.progress).toBe(0);
    });
  });

  // ==========================================================================
  // Execution Control Tests
  // ==========================================================================

  describe('Execution Control', () => {
    it('should start execution', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.initializeWorkflow(sampleWorkflowNodes);
        result.current.startExecution();
      });

      expect(result.current.status).toBe('running');
      expect(result.current.isRunning).toBe(true);
    });

    it('should complete execution', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.initializeWorkflow(sampleWorkflowNodes);
        result.current.startExecution();
        result.current.completeExecution();
      });

      expect(result.current.status).toBe('completed');
      expect(result.current.isRunning).toBe(false);
    });

    it('should fail execution', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.initializeWorkflow(sampleWorkflowNodes);
        result.current.startExecution();
        result.current.failExecution('Test error');
      });

      expect(result.current.status).toBe('failed');
      expect(result.current.hasErrors).toBe(true);
    });

    it('should cancel execution', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.initializeWorkflow(sampleWorkflowNodes);
        result.current.startExecution();
        result.current.cancelExecution();
      });

      expect(result.current.status).toBe('cancelled');
    });
  });

  // ==========================================================================
  // Node Status Tests
  // ==========================================================================

  describe('Node Status', () => {
    it('should update node status', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.initializeWorkflow(sampleWorkflowNodes);
        result.current.startExecution();
        result.current.updateNodeStatus('start-1', 'executing');
      });

      expect(result.current.nodeStatuses.get('start-1')).toBe('executing');
      expect(result.current.currentNodeId).toBe('start-1');
    });

    it('should track current executing node', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.initializeWorkflow(sampleWorkflowNodes);
        result.current.startExecution();
        result.current.updateNodeStatus('start-1', 'executing');
      });

      expect(result.current.currentNodeId).toBe('start-1');

      act(() => {
        result.current.updateNodeStatus('start-1', 'completed');
        result.current.updateNodeStatus('engineer-1', 'executing');
      });

      expect(result.current.currentNodeId).toBe('engineer-1');
    });

    it('should provide helper to check if node is executing', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.initializeWorkflow(sampleWorkflowNodes);
        result.current.startExecution();
        result.current.updateNodeStatus('start-1', 'executing');
      });

      expect(result.current.isNodeExecuting('start-1')).toBe(true);
      expect(result.current.isNodeExecuting('engineer-1')).toBe(false);
    });

    it('should provide helper to check if node is completed', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.initializeWorkflow(sampleWorkflowNodes);
        result.current.startExecution();
        result.current.updateNodeStatus('start-1', 'completed');
      });

      expect(result.current.isNodeCompleted('start-1')).toBe(true);
      expect(result.current.isNodeCompleted('engineer-1')).toBe(false);
    });

    it('should provide helper to check if node has failed', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.initializeWorkflow(sampleWorkflowNodes);
        result.current.startExecution();
        result.current.updateNodeStatus('engineer-1', 'failed');
      });

      expect(result.current.isNodeFailed('engineer-1')).toBe(true);
      expect(result.current.isNodeFailed('start-1')).toBe(false);
    });
  });

  // ==========================================================================
  // Progress Tests
  // ==========================================================================

  describe('Progress', () => {
    it('should calculate progress from completed nodes', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.initializeWorkflow(sampleWorkflowNodes);
        result.current.startExecution();
      });

      expect(result.current.progress).toBe(0);

      act(() => {
        result.current.updateNodeStatus('start-1', 'completed');
      });

      expect(result.current.progress).toBe(25);

      act(() => {
        result.current.updateNodeStatus('engineer-1', 'completed');
      });

      expect(result.current.progress).toBe(50);
    });

    it('should reach 100% when all nodes completed', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.initializeWorkflow(sampleWorkflowNodes);
        result.current.startExecution();

        sampleWorkflowNodes.forEach((node) => {
          result.current.updateNodeStatus(node.id, 'completed');
        });
      });

      expect(result.current.progress).toBe(100);
    });
  });

  // ==========================================================================
  // Log Tests
  // ==========================================================================

  describe('Logs', () => {
    it('should add log entries', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.initializeWorkflow(sampleWorkflowNodes);
        result.current.startExecution();
        result.current.addLog('start-1', 'info', 'Processing started');
      });

      expect(result.current.logs).toHaveLength(1);
      expect(result.current.logs[0].message).toBe('Processing started');
    });

    it('should filter logs by node', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.initializeWorkflow(sampleWorkflowNodes);
        result.current.startExecution();
        result.current.addLog('start-1', 'info', 'Start log');
        result.current.addLog('engineer-1', 'info', 'Engineer log');
        result.current.addLog('start-1', 'warn', 'Another start log');
      });

      const startLogs = result.current.getLogsForNode('start-1');
      expect(startLogs).toHaveLength(2);
    });

    it('should filter error logs', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.initializeWorkflow(sampleWorkflowNodes);
        result.current.startExecution();
        result.current.addLog('start-1', 'info', 'Info');
        result.current.addLog('engineer-1', 'error', 'Error 1');
        result.current.addLog('reviewer-1', 'error', 'Error 2');
      });

      const errors = result.current.getErrorLogs();
      expect(errors).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Stream Event Handling Tests
  // ==========================================================================

  describe('Stream Event Handling', () => {
    it('should handle node-started events', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.initializeWorkflow(sampleWorkflowNodes);
        result.current.startExecution();
        result.current.handleStreamEvent({
          type: 'node-started',
          data: { nodeId: 'start-1', timestamp: Date.now() },
        });
      });

      expect(result.current.nodeStatuses.get('start-1')).toBe('executing');
    });

    it('should handle node-completed events', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.initializeWorkflow(sampleWorkflowNodes);
        result.current.startExecution();
        result.current.handleStreamEvent({
          type: 'node-started',
          data: { nodeId: 'engineer-1', timestamp: Date.now() },
        });
        result.current.handleStreamEvent({
          type: 'node-completed',
          data: { nodeId: 'engineer-1', timestamp: Date.now(), status: 'completed' },
        });
      });

      expect(result.current.nodeStatuses.get('engineer-1')).toBe('completed');
    });

    it('should handle batch events', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.initializeWorkflow(sampleWorkflowNodes);
        result.current.startExecution();
        result.current.handleStreamEventBatch([
          { type: 'node-started', data: { nodeId: 'start-1', timestamp: Date.now() }, timestamp: Date.now(), priority: 'high' },
          { type: 'node-completed', data: { nodeId: 'start-1', timestamp: Date.now(), status: 'completed' }, timestamp: Date.now(), priority: 'high' },
          { type: 'node-started', data: { nodeId: 'engineer-1', timestamp: Date.now() }, timestamp: Date.now(), priority: 'high' },
        ]);
      });

      expect(result.current.nodeStatuses.get('start-1')).toBe('completed');
      expect(result.current.nodeStatuses.get('engineer-1')).toBe('executing');
    });
  });

  // ==========================================================================
  // Cleanup Tests
  // ==========================================================================

  describe('Cleanup', () => {
    it('should reset state', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.initializeWorkflow(sampleWorkflowNodes);
        result.current.startExecution();
        result.current.updateNodeStatus('start-1', 'completed');
        result.current.addLog('start-1', 'info', 'Test');
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.status).toBe('idle');
      expect(result.current.nodeStatuses.size).toBe(0);
      expect(result.current.logs).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Computed Values Tests
  // ==========================================================================

  describe('Computed Values', () => {
    it('should provide completed nodes count', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.initializeWorkflow(sampleWorkflowNodes);
        result.current.startExecution();
        result.current.updateNodeStatus('start-1', 'completed');
        result.current.updateNodeStatus('engineer-1', 'completed');
      });

      expect(result.current.completedCount).toBe(2);
    });

    it('should provide failed nodes count', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.initializeWorkflow(sampleWorkflowNodes);
        result.current.startExecution();
        result.current.updateNodeStatus('engineer-1', 'failed');
      });

      expect(result.current.failedCount).toBe(1);
    });

    it('should provide total nodes count', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.initializeWorkflow(sampleWorkflowNodes);
      });

      expect(result.current.totalCount).toBe(4);
    });
  });
});
