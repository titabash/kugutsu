/**
 * Control Flow Nodes Tests
 *
 * TDD Red Phase: Tests for StartNode, EndNode, DecisionNode, DataTransformNode
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  StartNode,
  EndNode,
  DecisionNode,
  DataTransformNode,
} from '../../../src/workflow/nodes/ControlFlowNodes.js';
import { createMockExecutionContext } from '../../../src/workflow/nodes/BaseWorkflowNode.js';
import type { ExecutionContext } from '../../../src/workflow/types.js';

describe('StartNode', () => {
  let startNode: StartNode;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    startNode = new StartNode('start-1');
    mockContext = createMockExecutionContext({
      inputs: {
        default: { userRequest: 'Build a feature', metadata: { priority: 'high' } },
      },
    });
  });

  describe('constructor', () => {
    it('should create a start node with correct type', () => {
      expect(startNode.type).toBe('io:start');
      expect(startNode.label).toBe('Start');
    });

    it('should have no inputs', () => {
      expect(startNode.inputs).toHaveLength(0);
    });

    it('should have one control output', () => {
      expect(startNode.outputs).toHaveLength(1);
      expect(startNode.outputs[0].id).toBe('default');
      expect(startNode.outputs[0].type).toBe('control');
    });
  });

  describe('execute()', () => {
    it('should pass through initial input to output', async () => {
      const result = await startNode.execute(mockContext);
      expect(result.success).toBe(true);
      expect(result.outputs.default).toEqual({
        userRequest: 'Build a feature',
        metadata: { priority: 'high' },
      });
    });

    it('should work with empty inputs', async () => {
      const emptyContext = createMockExecutionContext({ inputs: {} });
      const result = await startNode.execute(emptyContext);
      expect(result.success).toBe(true);
      expect(result.outputs.default).toEqual({});
    });
  });

  describe('validate()', () => {
    it('should always be valid (no required inputs)', () => {
      const result = startNode.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

describe('EndNode', () => {
  let endNode: EndNode;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    endNode = new EndNode('end-1');
    mockContext = createMockExecutionContext({
      inputs: {
        default: { result: 'completed', data: [1, 2, 3] },
      },
    });
  });

  describe('constructor', () => {
    it('should create an end node with correct type', () => {
      expect(endNode.type).toBe('io:end');
      expect(endNode.label).toBe('End');
    });

    it('should have one any-type input', () => {
      expect(endNode.inputs).toHaveLength(1);
      expect(endNode.inputs[0].id).toBe('default');
      expect(endNode.inputs[0].type).toBe('any');
      expect(endNode.inputs[0].required).toBe(true);
    });

    it('should have no outputs', () => {
      expect(endNode.outputs).toHaveLength(0);
    });
  });

  describe('execute()', () => {
    it('should capture final result in metadata', async () => {
      const result = await endNode.execute(mockContext);
      expect(result.success).toBe(true);
      expect(result.outputs).toEqual({});
      expect(result.metadata?.finalResult).toEqual({
        result: 'completed',
        data: [1, 2, 3],
      });
    });

    it('should handle undefined input gracefully', async () => {
      const emptyContext = createMockExecutionContext({ inputs: {} });
      const result = await endNode.execute(emptyContext);
      expect(result.success).toBe(true);
      expect(result.metadata?.finalResult).toBeUndefined();
    });
  });

  describe('with saveResult config', () => {
    it('should save result when configured', async () => {
      const endNodeWithSave = new EndNode('end-save', {
        onComplete: { saveResult: true },
      });
      let savedExecutionId: string | undefined;
      let savedResult: unknown;
      const mockSaveWorkflowResult = async (executionId: string, result: unknown) => {
        savedExecutionId = executionId;
        savedResult = result;
      };
      const contextWithMockPersistence = createMockExecutionContext({
        inputs: { default: { result: 'to save' } },
        services: {
          dataPersistence: {
            saveWorkflowResult: mockSaveWorkflowResult,
            loadWorkflowResult: async () => null,
          },
        },
      });

      await endNodeWithSave.execute(contextWithMockPersistence);
      expect(savedExecutionId).toBe('test-execution');
      expect(savedResult).toEqual({ result: 'to save' });
    });
  });
});

describe('DecisionNode', () => {
  let decisionNode: DecisionNode;

  beforeEach(() => {
    decisionNode = new DecisionNode('decision-1', {
      condition: 'input.value > 10',
    });
  });

  describe('constructor', () => {
    it('should create a decision node with correct type', () => {
      expect(decisionNode.type).toBe('control:decision');
      expect(decisionNode.label).toBe('Decision');
    });

    it('should have one any-type input', () => {
      expect(decisionNode.inputs).toHaveLength(1);
      expect(decisionNode.inputs[0].id).toBe('input');
      expect(decisionNode.inputs[0].type).toBe('any');
    });

    it('should have two control outputs (true/false)', () => {
      expect(decisionNode.outputs).toHaveLength(2);
      expect(decisionNode.outputs[0].id).toBe('true');
      expect(decisionNode.outputs[1].id).toBe('false');
    });
  });

  describe('execute()', () => {
    it('should route to true output when condition is true', async () => {
      const context = createMockExecutionContext({
        inputs: { input: { value: 15 } },
      });
      const result = await decisionNode.execute(context);
      expect(result.success).toBe(true);
      expect(result.outputs.true).toEqual({ value: 15 });
      expect(result.outputs.false).toBeUndefined();
    });

    it('should route to false output when condition is false', async () => {
      const context = createMockExecutionContext({
        inputs: { input: { value: 5 } },
      });
      const result = await decisionNode.execute(context);
      expect(result.success).toBe(true);
      expect(result.outputs.false).toEqual({ value: 5 });
      expect(result.outputs.true).toBeUndefined();
    });

    it('should handle complex conditions', async () => {
      const complexDecision = new DecisionNode('decision-complex', {
        condition: 'input.status === "approved" && input.score >= 80',
      });
      const context = createMockExecutionContext({
        inputs: { input: { status: 'approved', score: 85 } },
      });
      const result = await complexDecision.execute(context);
      expect(result.outputs.true).toBeDefined();
    });

    it('should fail gracefully on invalid condition', async () => {
      const invalidDecision = new DecisionNode('decision-invalid', {
        condition: 'this.is.invalid.syntax.!!!',
      });
      const context = createMockExecutionContext({
        inputs: { input: { value: 10 } },
      });
      const result = await invalidDecision.execute(context);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('validate()', () => {
    it('should require a condition', () => {
      const noConditionNode = new DecisionNode('no-condition', {});
      noConditionNode.setConnectedInputs(['input']);
      const result = noConditionNode.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Decision node requires a condition');
    });

    it('should pass validation with condition set', () => {
      decisionNode.setConnectedInputs(['input']);
      const result = decisionNode.validate();
      expect(result.valid).toBe(true);
    });
  });
});

describe('DataTransformNode', () => {
  let transformNode: DataTransformNode;

  beforeEach(() => {
    transformNode = new DataTransformNode('transform-1', {
      transformType: 'map',
      transformFunction: 'return input.map(x => x * 2)',
    });
  });

  describe('constructor', () => {
    it('should create a transform node with correct type', () => {
      expect(transformNode.type).toBe('io:transform');
      expect(transformNode.label).toBe('Data Transform');
    });

    it('should have one data input', () => {
      expect(transformNode.inputs).toHaveLength(1);
      expect(transformNode.inputs[0].id).toBe('input');
      expect(transformNode.inputs[0].type).toBe('data');
    });

    it('should have one data output', () => {
      expect(transformNode.outputs).toHaveLength(1);
      expect(transformNode.outputs[0].id).toBe('output');
      expect(transformNode.outputs[0].type).toBe('data');
    });
  });

  describe('execute() with map transform', () => {
    it('should apply map transformation', async () => {
      const context = createMockExecutionContext({
        inputs: { input: [1, 2, 3, 4, 5] },
      });
      const result = await transformNode.execute(context);
      expect(result.success).toBe(true);
      expect(result.outputs.output).toEqual([2, 4, 6, 8, 10]);
    });
  });

  describe('execute() with filter transform', () => {
    it('should apply filter transformation', async () => {
      const filterNode = new DataTransformNode('filter-1', {
        transformType: 'filter',
        transformFunction: 'return input.filter(x => x > 2)',
      });
      const context = createMockExecutionContext({
        inputs: { input: [1, 2, 3, 4, 5] },
      });
      const result = await filterNode.execute(context);
      expect(result.success).toBe(true);
      expect(result.outputs.output).toEqual([3, 4, 5]);
    });
  });

  describe('execute() with reduce transform', () => {
    it('should apply reduce transformation', async () => {
      const reduceNode = new DataTransformNode('reduce-1', {
        transformType: 'reduce',
        transformFunction: 'return input.reduce((acc, x) => acc + x, 0)',
      });
      const context = createMockExecutionContext({
        inputs: { input: [1, 2, 3, 4, 5] },
      });
      const result = await reduceNode.execute(context);
      expect(result.success).toBe(true);
      expect(result.outputs.output).toBe(15);
    });
  });

  describe('execute() with custom transform', () => {
    it('should apply custom transformation', async () => {
      const customNode = new DataTransformNode('custom-1', {
        transformType: 'custom',
        transformFunction: 'return { original: input, doubled: input * 2 }',
      });
      const context = createMockExecutionContext({
        inputs: { input: 10 },
      });
      const result = await customNode.execute(context);
      expect(result.success).toBe(true);
      expect(result.outputs.output).toEqual({ original: 10, doubled: 20 });
    });
  });

  describe('execute() error handling', () => {
    it('should handle transformation errors gracefully', async () => {
      const errorNode = new DataTransformNode('error-1', {
        transformType: 'custom',
        transformFunction: 'throw new Error("Transform failed")',
      });
      const context = createMockExecutionContext({
        inputs: { input: 'test' },
      });
      const result = await errorNode.execute(context);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle missing transform function', async () => {
      const noFunctionNode = new DataTransformNode('no-func-1', {
        transformType: 'custom',
      });
      const context = createMockExecutionContext({
        inputs: { input: 'test' },
      });
      const result = await noFunctionNode.execute(context);
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Transform function is required');
    });
  });

  describe('validate()', () => {
    it('should require transform type', () => {
      const noTypeNode = new DataTransformNode('no-type', {});
      noTypeNode.setConnectedInputs(['input']);
      const result = noTypeNode.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Transform type is required');
    });

    it('should require transform function for custom type', () => {
      const customNoFuncNode = new DataTransformNode('custom-no-func', {
        transformType: 'custom',
      });
      customNoFuncNode.setConnectedInputs(['input']);
      const result = customNoFuncNode.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Transform function is required for custom transform');
    });
  });
});

