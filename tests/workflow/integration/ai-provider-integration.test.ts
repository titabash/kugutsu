/**
 * AIProvider Integration Tests
 *
 * Phase 5.1.2: AIProviderとワークフローノードの統合テスト
 * - AITaskNode、EngineerNode、ReviewerNodeとAIProviderの統合
 * - ノード設定とコンフィグレーション
 * - NodeFactoryによるノード作成
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AITaskNode, type AITaskNodeConfig } from '../../../src/workflow/nodes/AITaskNode.js';
import { EngineerNode, type EngineerNodeConfig } from '../../../src/workflow/nodes/preset/EngineerNode.js';
import { ReviewerNode, type ReviewerNodeConfig } from '../../../src/workflow/nodes/preset/ReviewerNode.js';
import { ProductOwnerNode, type ProductOwnerNodeConfig } from '../../../src/workflow/nodes/preset/ProductOwnerNode.js';
import { NodeFactory } from '../../../src/workflow/NodeFactory.js';

describe('AIProvider Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // AITaskNode Configuration Tests
  // ===========================================================================

  describe('AITaskNode Configuration', () => {
    it('should create AITaskNode with default configuration', () => {
      const node = new AITaskNode('test-ai-task');

      expect(node).toBeDefined();
      expect(node.id).toBe('test-ai-task');
      expect(node.type).toBe('ai:custom');
    });

    it('should create AITaskNode with custom AI configuration', () => {
      const config: AITaskNodeConfig = {
        label: 'Custom AI Task',
        ai: {
          provider: 'claude',
          systemPrompt: 'You are a helpful assistant',
          maxTurns: 10,
          temperature: 0.7,
        },
      };

      const node = new AITaskNode('custom-ai-task', config);

      expect(node.config.label).toBe('Custom AI Task');
      expect(node.config.ai?.provider).toBe('claude');
      expect(node.config.ai?.systemPrompt).toBe('You are a helpful assistant');
      expect(node.config.ai?.maxTurns).toBe(10);
      expect(node.config.ai?.temperature).toBe(0.7);
    });

    it('should have correct input and output sockets', () => {
      const node = new AITaskNode('socket-test');

      expect(node.inputs).toBeDefined();
      expect(node.outputs).toBeDefined();
      expect(node.inputs.length).toBeGreaterThan(0);
      expect(node.outputs.length).toBeGreaterThan(0);
    });

    it('should validate maxTurns configuration', () => {
      const node = new AITaskNode('validation-test', {
        ai: { maxTurns: -1 },
      });

      const validation = node.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('maxTurns'))).toBe(true);
    });

    it('should validate temperature range', () => {
      const node = new AITaskNode('temp-test', {
        ai: { temperature: 3.0 },
      });

      const validation = node.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('temperature'))).toBe(true);
    });

    it('should accept valid temperature values', () => {
      const node = new AITaskNode('valid-temp', {
        ai: { temperature: 0.5, maxTurns: 10 },
      });
      // Set connected inputs to avoid required input validation errors
      node.setConnectedInputs(['prompt']);

      const validation = node.validate();
      expect(validation.valid).toBe(true);
    });

    it('should support custom prompt templates', () => {
      const node = new AITaskNode('template-test', {
        promptTemplate: 'Task: {prompt}\nContext: {context}',
      });

      expect(node.config.promptTemplate).toBe('Task: {prompt}\nContext: {context}');
    });

    it('should build prompt from template', () => {
      const node = new AITaskNode('build-prompt', {
        promptTemplate: 'Task: {prompt}\nContext: {context}',
      });

      const prompt = node.buildPrompt('Test task', { key: 'value' });
      expect(prompt).toContain('Test task');
      expect(prompt).toContain('key');
    });

    it('should support allowed tools configuration', () => {
      const node = new AITaskNode('tools-test', {
        ai: {
          allowedTools: ['Read', 'Write', 'Bash'],
        },
      });

      expect(node.config.ai?.allowedTools).toEqual(['Read', 'Write', 'Bash']);
    });
  });

  // ===========================================================================
  // EngineerNode Configuration Tests
  // ===========================================================================

  describe('EngineerNode Configuration', () => {
    it('should create EngineerNode with default configuration', () => {
      const node = new EngineerNode('test-engineer');

      expect(node).toBeDefined();
      expect(node.id).toBe('test-engineer');
      expect(node.type).toBe('preset:engineer');
    });

    it('should have default system prompt for engineering', () => {
      const node = new EngineerNode('prompt-test');

      expect(node.config.ai?.systemPrompt).toBeDefined();
      expect(node.config.ai?.systemPrompt?.toLowerCase()).toContain('engineer');
    });

    it('should include default engineering tools', () => {
      const node = new EngineerNode('tools-test');

      const tools = node.config.ai?.allowedTools ?? [];
      expect(tools).toContain('Read');
      expect(tools).toContain('Write');
      expect(tools).toContain('Edit');
      expect(tools).toContain('Bash');
      expect(tools).toContain('Glob');
      expect(tools).toContain('Grep');
    });

    it('should support custom AI provider', () => {
      const node = new EngineerNode('provider-test', {
        ai: { provider: 'codex' },
      });

      expect(node.config.ai?.provider).toBe('codex');
    });

    it('should support worktree configuration', () => {
      const config: EngineerNodeConfig = {
        useWorktree: true,
        branchPrefix: 'feature/',
        cleanupWorktree: true,
      };

      const node = new EngineerNode('worktree-test', config);

      expect(node.config.useWorktree).toBe(true);
      expect(node.config.branchPrefix).toBe('feature/');
      expect(node.config.cleanupWorktree).toBe(true);
    });

    it('should have correct input sockets for task', () => {
      const node = new EngineerNode('input-test');

      const taskInput = node.inputs.find(i => i.id === 'task');
      expect(taskInput).toBeDefined();
      expect(taskInput?.required).toBe(true);
    });

    it('should have correct output sockets', () => {
      const node = new EngineerNode('output-test');

      expect(node.outputs.length).toBeGreaterThan(0);
      const codeOutput = node.outputs.find(o => o.id === 'code');
      expect(codeOutput).toBeDefined();
    });

    it('should validate successfully with default config', () => {
      const node = new EngineerNode('valid-engineer');
      // Set connected inputs to avoid required input validation errors
      node.setConnectedInputs(['task']);
      const validation = node.validate();
      expect(validation.valid).toBe(true);
    });
  });

  // ===========================================================================
  // ReviewerNode Configuration Tests
  // ===========================================================================

  describe('ReviewerNode Configuration', () => {
    it('should create ReviewerNode with default configuration', () => {
      const node = new ReviewerNode('test-reviewer');

      expect(node).toBeDefined();
      expect(node.id).toBe('test-reviewer');
      expect(node.type).toBe('preset:reviewer');
    });

    it('should have default system prompt for review', () => {
      const node = new ReviewerNode('prompt-test');

      expect(node.config.ai?.systemPrompt).toBeDefined();
      expect(node.config.ai?.systemPrompt?.toLowerCase()).toContain('review');
    });

    it('should include read-only tools by default', () => {
      const node = new ReviewerNode('tools-test');

      const tools = node.config.ai?.allowedTools ?? [];
      expect(tools).toContain('Read');
      expect(tools).toContain('Glob');
      expect(tools).toContain('Grep');
      // Should NOT have write tools
      expect(tools).not.toContain('Write');
      expect(tools).not.toContain('Edit');
    });

    it('should support strict mode configuration', () => {
      const config: ReviewerNodeConfig = {
        strictMode: true,
      };

      const node = new ReviewerNode('strict-test', config);

      expect(node.config.strictMode).toBe(true);
    });

    it('should support review criteria configuration', () => {
      const node = new ReviewerNode('criteria-test', {
        reviewCriteria: ['correctness', 'performance', 'security'],
      });

      expect(node.config.reviewCriteria).toContain('correctness');
      expect(node.config.reviewCriteria).toContain('performance');
      expect(node.config.reviewCriteria).toContain('security');
    });

    it('should validate successfully with default config', () => {
      const node = new ReviewerNode('valid-reviewer');
      // Set connected inputs to avoid required input validation errors
      node.setConnectedInputs(['code']);
      const validation = node.validate();
      expect(validation.valid).toBe(true);
    });
  });

  // ===========================================================================
  // ProductOwnerNode Configuration Tests
  // ===========================================================================

  describe('ProductOwnerNode Configuration', () => {
    it('should create ProductOwnerNode with default configuration', () => {
      const node = new ProductOwnerNode('test-po');

      expect(node).toBeDefined();
      expect(node.id).toBe('test-po');
      expect(node.type).toBe('preset:product-owner');
    });

    it('should have default system prompt for product owner', () => {
      const node = new ProductOwnerNode('prompt-test');

      expect(node.config.ai?.systemPrompt).toBeDefined();
    });

    it('should include analysis tools', () => {
      const node = new ProductOwnerNode('tools-test');

      const tools = node.config.ai?.allowedTools ?? [];
      expect(tools).toContain('Read');
      expect(tools).toContain('Glob');
      expect(tools).toContain('Grep');
    });

    it('should support output mode configuration', () => {
      const node = new ProductOwnerNode('output-mode-test', {
        outputMode: 'both',
      });

      expect(node.config.outputMode).toBe('both');
    });

    it('should support tasks output mode', () => {
      const node = new ProductOwnerNode('tasks-mode', {
        outputMode: 'tasks',
      });

      expect(node.config.outputMode).toBe('tasks');
    });

    it('should support specifications output mode', () => {
      const node = new ProductOwnerNode('specs-mode', {
        outputMode: 'specifications',
      });

      expect(node.config.outputMode).toBe('specifications');
    });

    it('should validate output mode', () => {
      const node = new ProductOwnerNode('invalid-mode', {
        outputMode: 'invalid' as ProductOwnerNodeConfig['outputMode'],
      });

      const validation = node.validate();
      expect(validation.valid).toBe(false);
    });

    it('should validate successfully with valid config', () => {
      const node = new ProductOwnerNode('valid-po', {
        outputMode: 'tasks',
      });
      // Set connected inputs to avoid required input validation errors
      node.setConnectedInputs(['request']);

      const validation = node.validate();
      expect(validation.valid).toBe(true);
    });
  });

  // ===========================================================================
  // NodeFactory Integration Tests
  // ===========================================================================

  describe('NodeFactory with AI Nodes', () => {
    it('should create EngineerNode through static factory method', () => {
      const node = NodeFactory.createNode({
        id: 'factory-engineer',
        type: 'preset:engineer',
        label: 'Factory Engineer',
        position: { x: 0, y: 0 },
        config: {
          ai: { provider: 'mock' },
        },
      });

      expect(node).toBeDefined();
      expect(node.id).toBe('factory-engineer');
    });

    it('should create ReviewerNode through static factory method', () => {
      const node = NodeFactory.createNode({
        id: 'factory-reviewer',
        type: 'preset:reviewer',
        label: 'Factory Reviewer',
        position: { x: 0, y: 0 },
        config: {
          strictMode: true,
        },
      });

      expect(node).toBeDefined();
      expect(node.id).toBe('factory-reviewer');
    });

    it('should create ProductOwnerNode through static factory method', () => {
      const node = NodeFactory.createNode({
        id: 'factory-po',
        type: 'preset:product-owner',
        label: 'Factory PO',
        position: { x: 0, y: 0 },
        config: {
          outputMode: 'specifications',
        },
      });

      expect(node).toBeDefined();
      expect(node.id).toBe('factory-po');
    });

    it('should create multiple nodes in batch', () => {
      const nodes = NodeFactory.createNodes([
        {
          id: 'batch-engineer',
          type: 'preset:engineer',
          label: 'Batch Engineer',
          position: { x: 0, y: 0 },
          config: {},
        },
        {
          id: 'batch-reviewer',
          type: 'preset:reviewer',
          label: 'Batch Reviewer',
          position: { x: 100, y: 0 },
          config: {},
        },
        {
          id: 'batch-po',
          type: 'preset:product-owner',
          label: 'Batch PO',
          position: { x: 200, y: 0 },
          config: {},
        },
      ]);

      expect(nodes).toHaveLength(3);
      expect(nodes[0].id).toBe('batch-engineer');
      expect(nodes[1].id).toBe('batch-reviewer');
      expect(nodes[2].id).toBe('batch-po');
    });

    it('should get registered types through instance method', () => {
      const factory = NodeFactory.getInstance();
      const types = factory.getRegisteredTypes();

      expect(types).toContain('preset:engineer');
      expect(types).toContain('preset:reviewer');
      expect(types).toContain('preset:product-owner');
    });

    it('should get node type info through instance method', () => {
      const factory = NodeFactory.getInstance();
      const info = factory.getNodeTypeInfo('preset:engineer');

      expect(info).toBeDefined();
      expect(info?.category).toBeDefined();
    });
  });

  // ===========================================================================
  // Node Serialization Tests
  // ===========================================================================

  describe('Node Serialization', () => {
    it('should serialize AITaskNode to JSON', () => {
      const node = new AITaskNode('serialize-test', {
        label: 'Serialize Test',
        ai: {
          provider: 'claude',
          maxTurns: 15,
        },
      });

      const json = node.toJSON();

      expect(json.id).toBe('serialize-test');
      expect(json.type).toBe('ai:custom');
      expect(json.config?.ai?.provider).toBe('claude');
    });

    it('should serialize EngineerNode to JSON', () => {
      const node = new EngineerNode('engineer-serialize', {
        useWorktree: true,
      });

      const json = node.toJSON();

      expect(json.id).toBe('engineer-serialize');
      expect(json.type).toBe('preset:engineer');
      expect(json.config?.useWorktree).toBe(true);
    });

    it('should serialize ReviewerNode to JSON', () => {
      const node = new ReviewerNode('reviewer-serialize', {
        strictMode: true,
        reviewCriteria: ['security'],
      });

      const json = node.toJSON();

      expect(json.id).toBe('reviewer-serialize');
      expect(json.type).toBe('preset:reviewer');
      expect(json.config?.strictMode).toBe(true);
    });

    it('should serialize ProductOwnerNode to JSON', () => {
      const node = new ProductOwnerNode('po-serialize', {
        outputMode: 'both',
      });

      const json = node.toJSON();

      expect(json.id).toBe('po-serialize');
      expect(json.type).toBe('preset:product-owner');
      expect(json.config?.outputMode).toBe('both');
    });
  });

  // ===========================================================================
  // Provider Configuration Tests
  // ===========================================================================

  describe('Provider Configuration', () => {
    it('should support auto provider selection', () => {
      const node = new AITaskNode('auto-provider', {
        ai: { provider: 'auto' },
      });

      expect(node.config.ai?.provider).toBe('auto');
    });

    it('should support claude provider', () => {
      const node = new AITaskNode('claude-provider', {
        ai: { provider: 'claude', model: 'claude-sonnet-4-5-20250929' },
      });

      expect(node.config.ai?.provider).toBe('claude');
      expect(node.config.ai?.model).toBe('claude-sonnet-4-5-20250929');
    });

    it('should support codex provider', () => {
      const node = new AITaskNode('codex-provider', {
        ai: { provider: 'codex' },
      });

      expect(node.config.ai?.provider).toBe('codex');
    });

    it('should support gemini provider', () => {
      const node = new AITaskNode('gemini-provider', {
        ai: { provider: 'gemini' },
      });

      expect(node.config.ai?.provider).toBe('gemini');
    });

    it('should support mock provider for testing', () => {
      const node = new AITaskNode('mock-provider', {
        ai: { provider: 'mock' },
      });

      expect(node.config.ai?.provider).toBe('mock');
    });
  });
});
