/**
 * BaseWorkflowNode Tests
 *
 * TDD Red Phase: Tests for the BaseWorkflowNode abstract class.
 * These tests should FAIL initially until implementation is complete.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  BaseWorkflowNode,
  createMockExecutionContext,
} from '../../../src/workflow/nodes/BaseWorkflowNode.js';
import type {
  NodeType,
  NodeSocket,
  NodeConfig,
  ExecutionContext,
  NodeResult,
  ValidationResult,
  WorkflowNodeJSON,
} from '../../../src/workflow/types.js';

/**
 * Concrete implementation of BaseWorkflowNode for testing
 */
class TestNode extends BaseWorkflowNode {
  constructor(
    id: string = 'test-node-1',
    config: NodeConfig = {}
  ) {
    super({
      id,
      type: 'io:start' as NodeType,
      label: 'Test Node',
      description: 'A test node for unit testing',
      inputs: [
        {
          id: 'input1',
          name: 'Input 1',
          type: 'data',
          dataType: 'string',
          required: true,
        },
        {
          id: 'input2',
          name: 'Input 2',
          type: 'data',
          dataType: 'number',
          required: false,
          defaultValue: 0,
        },
      ],
      outputs: [
        {
          id: 'output1',
          name: 'Output 1',
          type: 'data',
          dataType: 'object',
          required: true,
        },
      ],
      config,
    });
  }

  async execute(context: ExecutionContext): Promise<NodeResult> {
    const input1 = context.inputs['input1'] as string;
    const input2 = (context.inputs['input2'] as number) ?? 0;

    return {
      success: true,
      outputs: {
        output1: {
          processedInput: input1,
          computedValue: input2 * 2,
        },
      },
      metadata: {
        duration: 100,
      },
    };
  }
}

describe('BaseWorkflowNode', () => {
  let testNode: TestNode;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    testNode = new TestNode();
    mockContext = createMockExecutionContext({
      inputs: {
        input1: 'test value',
        input2: 5,
      },
    });
  });

  describe('constructor', () => {
    it('should create a node with correct properties', () => {
      expect(testNode.id).toBe('test-node-1');
      expect(testNode.type).toBe('io:start');
      expect(testNode.label).toBe('Test Node');
      expect(testNode.description).toBe('A test node for unit testing');
    });

    it('should initialize inputs correctly', () => {
      expect(testNode.inputs).toHaveLength(2);
      expect(testNode.inputs[0].id).toBe('input1');
      expect(testNode.inputs[0].required).toBe(true);
      expect(testNode.inputs[1].defaultValue).toBe(0);
    });

    it('should initialize outputs correctly', () => {
      expect(testNode.outputs).toHaveLength(1);
      expect(testNode.outputs[0].id).toBe('output1');
      expect(testNode.outputs[0].dataType).toBe('object');
    });

    it('should store config', () => {
      const nodeWithConfig = new TestNode('node-with-config', {
        timeout: 5000,
        ai: {
          provider: 'claude',
          maxTurns: 10,
        },
      });
      expect(nodeWithConfig.config.timeout).toBe(5000);
      expect(nodeWithConfig.config.ai?.provider).toBe('claude');
    });
  });

  describe('validate()', () => {
    it('should return valid when all required inputs have connections', () => {
      // Simulate connected inputs
      testNode.setConnectedInputs(['input1']);
      const result = testNode.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid when required inputs are missing', () => {
      // No inputs connected
      testNode.setConnectedInputs([]);
      const result = testNode.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Required input 'Input 1' is not connected");
    });

    it('should pass validation when optional inputs are missing', () => {
      // Only required input connected, optional missing
      testNode.setConnectedInputs(['input1']);
      const result = testNode.validate();
      expect(result.valid).toBe(true);
    });

    it('should validate maxTurns config if present', () => {
      const nodeWithInvalidConfig = new TestNode('invalid-config', {
        ai: {
          provider: 'claude',
          maxTurns: 0, // Invalid: must be >= 1
        },
      });
      nodeWithInvalidConfig.setConnectedInputs(['input1']);
      const result = nodeWithInvalidConfig.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('maxTurns must be >= 1');
    });
  });

  describe('execute()', () => {
    it('should execute and return success result', async () => {
      const result = await testNode.execute(mockContext);
      expect(result.success).toBe(true);
      expect(result.outputs.output1).toEqual({
        processedInput: 'test value',
        computedValue: 10,
      });
    });

    it('should include metadata in result', async () => {
      const result = await testNode.execute(mockContext);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.duration).toBe(100);
    });

    it('should use default values for missing optional inputs', async () => {
      const contextWithMissingOptional = createMockExecutionContext({
        inputs: {
          input1: 'test value',
          // input2 is missing, should use default value 0
        },
      });
      const result = await testNode.execute(contextWithMissingOptional);
      expect(result.success).toBe(true);
      expect((result.outputs.output1 as Record<string, unknown>).computedValue).toBe(0);
    });
  });

  describe('toJSON()', () => {
    it('should serialize node to JSON', () => {
      const json = testNode.toJSON();

      expect(json.id).toBe('test-node-1');
      expect(json.type).toBe('io:start');
      expect(json.label).toBe('Test Node');
      expect(json.description).toBe('A test node for unit testing');
      expect(json.inputs).toHaveLength(2);
      expect(json.outputs).toHaveLength(1);
      expect(json.position).toEqual({ x: 0, y: 0 });
    });

    it('should include config in serialization', () => {
      const nodeWithConfig = new TestNode('node-with-config', {
        timeout: 5000,
      });
      const json = nodeWithConfig.toJSON();
      expect(json.config.timeout).toBe(5000);
    });

    it('should preserve position after setting', () => {
      testNode.setPosition(100, 200);
      const json = testNode.toJSON();
      expect(json.position).toEqual({ x: 100, y: 200 });
    });
  });

  describe('fromJSON()', () => {
    it('should deserialize node from JSON', () => {
      const json: WorkflowNodeJSON = {
        id: 'restored-node',
        type: 'io:start',
        label: 'Restored Node',
        description: 'A restored node',
        position: { x: 150, y: 250 },
        inputs: [
          {
            id: 'input1',
            name: 'Input 1',
            type: 'data',
            dataType: 'string',
            required: true,
          },
        ],
        outputs: [
          {
            id: 'output1',
            name: 'Output 1',
            type: 'data',
            dataType: 'object',
            required: true,
          },
        ],
        config: {
          timeout: 3000,
        },
      };

      const restored = TestNode.fromJSON(json, TestNode);
      expect(restored.id).toBe('restored-node');
      expect(restored.label).toBe('Restored Node');
      expect(restored.getPosition()).toEqual({ x: 150, y: 250 });
      expect(restored.config.timeout).toBe(3000);
    });
  });

  describe('position management', () => {
    it('should set and get position', () => {
      testNode.setPosition(50, 100);
      expect(testNode.getPosition()).toEqual({ x: 50, y: 100 });
    });

    it('should default position to (0, 0)', () => {
      expect(testNode.getPosition()).toEqual({ x: 0, y: 0 });
    });
  });

  describe('input/output helpers', () => {
    it('should check if input exists', () => {
      expect(testNode.hasInput('input1')).toBe(true);
      expect(testNode.hasInput('nonexistent')).toBe(false);
    });

    it('should check if output exists', () => {
      expect(testNode.hasOutput('output1')).toBe(true);
      expect(testNode.hasOutput('nonexistent')).toBe(false);
    });

    it('should get input by id', () => {
      const input = testNode.getInput('input1');
      expect(input).toBeDefined();
      expect(input?.name).toBe('Input 1');
    });

    it('should get output by id', () => {
      const output = testNode.getOutput('output1');
      expect(output).toBeDefined();
      expect(output?.name).toBe('Output 1');
    });

    it('should return undefined for non-existent input/output', () => {
      expect(testNode.getInput('nonexistent')).toBeUndefined();
      expect(testNode.getOutput('nonexistent')).toBeUndefined();
    });
  });
});

describe('createMockExecutionContext', () => {
  it('should create a valid mock context', () => {
    const context = createMockExecutionContext();
    expect(context.inputs).toBeDefined();
    expect(context.global).toBeDefined();
    expect(context.services).toBeDefined();
    expect(context.utils).toBeDefined();
  });

  it('should allow overriding inputs', () => {
    const context = createMockExecutionContext({
      inputs: { customInput: 'custom value' },
    });
    expect(context.inputs.customInput).toBe('custom value');
  });

  it('should allow overriding global context', () => {
    const context = createMockExecutionContext({
      global: { projectPath: '/custom/path' },
    });
    expect(context.global.projectPath).toBe('/custom/path');
  });

  it('should have functional mock services', () => {
    const context = createMockExecutionContext();

    // Test logger
    expect(() => context.utils.logger.info('test')).not.toThrow();
    expect(() => context.utils.logger.error('test')).not.toThrow();

    // Test emit
    expect(() => context.utils.emit('test-event', {})).not.toThrow();
  });
});
