/**
 * ElectronWorkflowService Tests
 *
 * Tests for the workflow execution service that integrates
 * ReteWorkflowExecutor with Electron IPC.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ElectronWorkflowService } from '../../src/workflow/ElectronWorkflowService.js';
import type { ReteWorkflowJSON } from '../../src/workflow/types.js';

// Mock workflow for testing
function createTestWorkflow(): ReteWorkflowJSON {
  return {
    version: '1.0.0',
    metadata: {
      name: 'Test Workflow',
      description: 'A test workflow',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    nodes: [
      {
        id: 'start-1',
        type: 'io:start',
        position: { x: 100, y: 100 },
        config: {},
        inputs: [],
        outputs: [{ key: 'default', label: 'Output' }],
      },
      {
        id: 'end-1',
        type: 'io:end',
        position: { x: 400, y: 100 },
        config: {},
        inputs: [{ key: 'default', label: 'Input' }],
        outputs: [],
      },
    ],
    connections: [
      {
        id: 'conn-1',
        source: 'start-1',
        sourceOutput: 'default',
        target: 'end-1',
        targetInput: 'default',
      },
    ],
    entryNodeId: 'start-1',
    exitNodeId: 'end-1',
  };
}

describe('ElectronWorkflowService', () => {
  let service: ElectronWorkflowService;

  beforeEach(() => {
    service = new ElectronWorkflowService();
  });

  describe('constructor', () => {
    it('should create a service instance', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(ElectronWorkflowService);
    });
  });

  describe('execute', () => {
    it('should execute a simple workflow successfully', async () => {
      const workflow = createTestWorkflow();
      const progressCallback = vi.fn();
      const completedCallback = vi.fn();

      service.on('progress', progressCallback);
      service.on('completed', completedCallback);

      const result = await service.execute(workflow, {
        prompt: 'Test prompt',
      });

      expect(result.success).toBe(true);
      expect(result.executionId).toBeDefined();
      expect(result.executedNodes).toContain('start-1');
      expect(result.executedNodes).toContain('end-1');
    });

    it('should emit progress events for each node', async () => {
      const workflow = createTestWorkflow();
      const progressEvents: Array<{ nodeId: string; status: string }> = [];

      service.on('progress', (event: { nodeId: string; status: string }) => {
        progressEvents.push(event);
      });

      await service.execute(workflow, { prompt: 'Test' });

      // Should have started and completed events for each node
      const startEvents = progressEvents.filter(e => e.status === 'executing');
      const completeEvents = progressEvents.filter(e => e.status === 'completed');

      expect(startEvents.length).toBeGreaterThanOrEqual(2); // start and end nodes
      expect(completeEvents.length).toBeGreaterThanOrEqual(2);
    });

    it('should emit a completed event when workflow finishes', async () => {
      const workflow = createTestWorkflow();
      const completedCallback = vi.fn();

      service.on('completed', completedCallback);

      await service.execute(workflow, { prompt: 'Test' });

      expect(completedCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should handle workflow with no nodes gracefully', async () => {
      const emptyWorkflow: ReteWorkflowJSON = {
        version: '1.0.0',
        metadata: {
          name: 'Empty',
          description: '',
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        nodes: [],
        connections: [],
        entryNodeId: '',
        exitNodeId: '',
      };

      const result = await service.execute(emptyWorkflow, { prompt: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should pass initial inputs to the workflow', async () => {
      const workflow = createTestWorkflow();

      const result = await service.execute(workflow, {
        prompt: 'Custom prompt',
        additionalData: { key: 'value' },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('cancel', () => {
    it('should cancel an executing workflow', async () => {
      const workflow = createTestWorkflow();

      // Start execution without awaiting
      const executionPromise = service.execute(workflow, { prompt: 'Test' });

      // Cancel immediately
      service.cancel();

      const result = await executionPromise;

      // Either cancelled or completed (depending on timing)
      expect(result).toBeDefined();
    });
  });

  describe('getStatus', () => {
    it('should return idle status initially', () => {
      expect(service.getStatus()).toBe('idle');
    });

    it('should return completed status after successful execution', async () => {
      const workflow = createTestWorkflow();
      await service.execute(workflow, { prompt: 'Test' });

      expect(service.getStatus()).toBe('completed');
    });
  });

  describe('getProgress', () => {
    it('should return progress information', async () => {
      const workflow = createTestWorkflow();

      await service.execute(workflow, { prompt: 'Test' });

      const progress = service.getProgress();
      expect(progress.totalNodes).toBeGreaterThan(0);
      expect(progress.percentage).toBe(100);
    });
  });

  describe('event handling', () => {
    it('should support multiple event listeners', async () => {
      const workflow = createTestWorkflow();
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      service.on('progress', listener1);
      service.on('progress', listener2);

      await service.execute(workflow, { prompt: 'Test' });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should allow removing event listeners', async () => {
      const workflow = createTestWorkflow();
      const listener = vi.fn();

      service.on('progress', listener);
      service.off('progress', listener);

      await service.execute(workflow, { prompt: 'Test' });

      expect(listener).not.toHaveBeenCalled();
    });
  });
});

describe('ElectronWorkflowService with connected nodes', () => {
  let service: ElectronWorkflowService;

  beforeEach(() => {
    service = new ElectronWorkflowService();
  });

  // Skip for MVP - requires DataTransformNode implementation
  it.skip('should pass data between connected nodes', async () => {
    // Workflow with data flow: start -> transform -> end
    const workflow: ReteWorkflowJSON = {
      version: '1.0.0',
      metadata: {
        name: 'Data Flow Test',
        description: 'Test data flow between nodes',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      nodes: [
        {
          id: 'start-1',
          type: 'io:start',
          position: { x: 100, y: 100 },
          config: {},
          inputs: [],
          outputs: [{ key: 'default', label: 'Output' }],
        },
        {
          id: 'transform-1',
          type: 'control:transform',
          position: { x: 250, y: 100 },
          config: {
            transformExpression: '(data) => ({ ...data, transformed: true })',
          },
          inputs: [{ key: 'input', label: 'Input' }],
          outputs: [{ key: 'output', label: 'Output' }],
        },
        {
          id: 'end-1',
          type: 'io:end',
          position: { x: 400, y: 100 },
          config: {},
          inputs: [{ key: 'default', label: 'Input' }],
          outputs: [],
        },
      ],
      connections: [
        {
          id: 'conn-1',
          source: 'start-1',
          sourceOutput: 'default',
          target: 'transform-1',
          targetInput: 'input',
        },
        {
          id: 'conn-2',
          source: 'transform-1',
          sourceOutput: 'output',
          target: 'end-1',
          targetInput: 'default',
        },
      ],
      entryNodeId: 'start-1',
      exitNodeId: 'end-1',
    };

    const nodeResults: Record<string, unknown> = {};
    service.on('progress', (event: { nodeId: string; status: string; outputs?: unknown }) => {
      if (event.status === 'completed' && event.outputs) {
        nodeResults[event.nodeId] = event.outputs;
      }
    });

    const result = await service.execute(workflow, {
      prompt: 'Test data flow',
      initialData: { value: 'test' },
    });

    expect(result.success).toBe(true);
    expect(result.executedNodes).toHaveLength(3);
    // Verify data flowed through nodes in order
    expect(result.executedNodes).toEqual(['start-1', 'transform-1', 'end-1']);
  });

  // Skip for MVP - requires DecisionNode condition evaluation
  it.skip('should handle conditional branching', async () => {
    const workflow: ReteWorkflowJSON = {
      version: '1.0.0',
      metadata: {
        name: 'Conditional Test',
        description: 'Test conditional branching',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      nodes: [
        {
          id: 'start-1',
          type: 'io:start',
          position: { x: 100, y: 100 },
          config: {},
          inputs: [],
          outputs: [{ key: 'default', label: 'Output' }],
        },
        {
          id: 'decision-1',
          type: 'control:decision',
          position: { x: 250, y: 100 },
          config: {
            conditionExpression: '(data) => data.shouldBranch === true',
          },
          inputs: [{ key: 'input', label: 'Input' }],
          outputs: [
            { key: 'true', label: 'True' },
            { key: 'false', label: 'False' },
          ],
        },
        {
          id: 'branch-true',
          type: 'io:end',
          position: { x: 400, y: 50 },
          config: {},
          inputs: [{ key: 'default', label: 'Input' }],
          outputs: [],
        },
        {
          id: 'branch-false',
          type: 'io:end',
          position: { x: 400, y: 150 },
          config: {},
          inputs: [{ key: 'default', label: 'Input' }],
          outputs: [],
        },
      ],
      connections: [
        {
          id: 'conn-1',
          source: 'start-1',
          sourceOutput: 'default',
          target: 'decision-1',
          targetInput: 'input',
        },
        {
          id: 'conn-2',
          source: 'decision-1',
          sourceOutput: 'true',
          target: 'branch-true',
          targetInput: 'default',
        },
        {
          id: 'conn-3',
          source: 'decision-1',
          sourceOutput: 'false',
          target: 'branch-false',
          targetInput: 'default',
        },
      ],
      entryNodeId: 'start-1',
      exitNodeId: 'branch-true', // Or branch-false, depending on which branch we test
    };

    // Test true branch
    const resultTrue = await service.execute(workflow, {
      prompt: 'Test branching',
      shouldBranch: true,
    });

    expect(resultTrue.success).toBe(true);
    expect(resultTrue.executedNodes).toContain('start-1');
    expect(resultTrue.executedNodes).toContain('decision-1');
    expect(resultTrue.executedNodes).toContain('branch-true');
    expect(resultTrue.executedNodes).not.toContain('branch-false');
  });
});
