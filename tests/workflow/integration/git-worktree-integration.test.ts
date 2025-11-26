/**
 * GitWorktree Integration Tests
 *
 * Phase 5.1.2: GitWorktreeManagerとワークフローノードの統合テスト
 * - ParallelNodeでの並列worktree設定
 * - EngineerNodeでのworktree設定
 * - MergeCoordinatorNodeでのマージ設定
 * - AggregatorNodeでの結果集約設定
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ParallelNode, type ParallelNodeConfig } from '../../../src/workflow/nodes/ParallelNode.js';
import { AggregatorNode, type AggregatorNodeConfig } from '../../../src/workflow/nodes/AggregatorNode.js';
import { EngineerNode, type EngineerNodeConfig } from '../../../src/workflow/nodes/preset/EngineerNode.js';
import { MergeCoordinatorNode, type MergeCoordinatorNodeConfig } from '../../../src/workflow/nodes/preset/MergeCoordinatorNode.js';
import { ConflictResolverNode, type ConflictResolverNodeConfig } from '../../../src/workflow/nodes/preset/ConflictResolverNode.js';
import { NodeFactory } from '../../../src/workflow/NodeFactory.js';

describe('GitWorktree Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // ParallelNode Configuration Tests
  // ===========================================================================

  describe('ParallelNode Configuration', () => {
    it('should create ParallelNode with default configuration', () => {
      const node = new ParallelNode('test-parallel', {
        targetNode: 'engineer',
      });

      expect(node).toBeDefined();
      expect(node.id).toBe('test-parallel');
      expect(node.type).toBe('control:parallel');
    });

    it('should configure target node', () => {
      const config: ParallelNodeConfig = {
        targetNode: 'engineer',
      };

      const node = new ParallelNode('target-node-test', config);

      expect(node.config.targetNode).toBe('engineer');
    });

    it('should configure max concurrency', () => {
      const node = new ParallelNode('concurrency-test', {
        targetNode: 'engineer',
        maxConcurrency: 3,
      });

      expect(node.config.maxConcurrency).toBe(3);
    });

    it('should configure worktree usage', () => {
      const node = new ParallelNode('worktree-test', {
        targetNode: 'engineer',
        useWorktree: true,
        branchPrefix: 'parallel',
      });

      expect(node.config.useWorktree).toBe(true);
      expect(node.config.branchPrefix).toBe('parallel');
    });

    it('should have correct input sockets', () => {
      const node = new ParallelNode('input-test', {
        targetNode: 'engineer',
      });

      const itemsInput = node.inputs.find(i => i.id === 'items');
      expect(itemsInput).toBeDefined();
      expect(itemsInput?.required).toBe(true);
    });

    it('should have correct output sockets', () => {
      const node = new ParallelNode('output-test', {
        targetNode: 'engineer',
      });

      expect(node.outputs.length).toBeGreaterThan(0);
      const resultsOutput = node.outputs.find(o => o.id === 'results');
      expect(resultsOutput).toBeDefined();
    });

    it('should validate maxConcurrency requirement', () => {
      const node = new ParallelNode('invalid-concurrency', {
        targetNode: 'engineer',
        maxConcurrency: 0,
      });

      const validation = node.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('maxConcurrency'))).toBe(true);
    });

    it('should serialize to JSON correctly', () => {
      const node = new ParallelNode('serialize-test', {
        targetNode: 'engineer',
        maxConcurrency: 2,
      });

      const json = node.toJSON();

      expect(json.id).toBe('serialize-test');
      expect(json.type).toBe('control:parallel');
      expect(json.config?.targetNode).toBe('engineer');
    });
  });

  // ===========================================================================
  // AggregatorNode Configuration Tests
  // ===========================================================================

  describe('AggregatorNode Configuration', () => {
    it('should create AggregatorNode with default configuration', () => {
      const node = new AggregatorNode('test-aggregator', {});

      expect(node).toBeDefined();
      expect(node.id).toBe('test-aggregator');
      expect(node.type).toBe('control:aggregator');
    });

    it('should configure aggregation mode as concat', () => {
      const node = new AggregatorNode('concat-agg', {
        aggregationMode: 'concat',
      });

      expect(node.config.aggregationMode).toBe('concat');
    });

    it('should configure aggregation mode as merge', () => {
      const node = new AggregatorNode('merge-agg', {
        aggregationMode: 'merge',
      });

      expect(node.config.aggregationMode).toBe('merge');
    });

    it('should configure aggregation mode as first', () => {
      const node = new AggregatorNode('first-agg', {
        aggregationMode: 'first',
      });

      expect(node.config.aggregationMode).toBe('first');
    });

    it('should configure aggregation mode as last', () => {
      const node = new AggregatorNode('last-agg', {
        aggregationMode: 'last',
      });

      expect(node.config.aggregationMode).toBe('last');
    });

    it('should configure wait for all', () => {
      const node = new AggregatorNode('wait-test', {
        waitForAll: true,
      });

      expect(node.config.waitForAll).toBe(true);
    });

    it('should configure filter errors', () => {
      const node = new AggregatorNode('filter-test', {
        filterErrors: true,
      });

      expect(node.config.filterErrors).toBe(true);
    });

    it('should have correct input sockets', () => {
      const node = new AggregatorNode('input-test', {});

      expect(node.inputs.length).toBeGreaterThan(0);
      const resultsInput = node.inputs.find(i => i.id === 'results');
      expect(resultsInput).toBeDefined();
    });

    it('should have correct output sockets', () => {
      const node = new AggregatorNode('output-test', {});

      const aggregatedOutput = node.outputs.find(o => o.id === 'aggregated');
      expect(aggregatedOutput).toBeDefined();
    });

    it('should validate custom mode requires aggregator function', () => {
      const node = new AggregatorNode('custom-test', {
        aggregationMode: 'custom',
        // Missing customAggregator
      });

      const validation = node.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('customAggregator'))).toBe(true);
    });

    it('should serialize to JSON correctly', () => {
      const node = new AggregatorNode('serialize-test', {
        aggregationMode: 'concat',
      });

      const json = node.toJSON();

      expect(json.id).toBe('serialize-test');
      expect(json.type).toBe('control:aggregator');
    });
  });

  // ===========================================================================
  // EngineerNode Worktree Configuration Tests
  // ===========================================================================

  describe('EngineerNode Worktree Configuration', () => {
    it('should configure worktree usage', () => {
      const node = new EngineerNode('worktree-engineer', {
        useWorktree: true,
      });

      expect(node.config.useWorktree).toBe(true);
    });

    it('should configure branch prefix', () => {
      const node = new EngineerNode('branch-prefix', {
        useWorktree: true,
        branchPrefix: 'feature/',
      });

      expect(node.config.branchPrefix).toBe('feature/');
    });

    it('should configure worktree cleanup', () => {
      const node = new EngineerNode('cleanup-test', {
        useWorktree: true,
        cleanupWorktree: true,
      });

      expect(node.config.cleanupWorktree).toBe(true);
    });

    it('should configure all worktree options together', () => {
      const config: EngineerNodeConfig = {
        useWorktree: true,
        branchPrefix: 'task/',
        cleanupWorktree: false,
      };

      const node = new EngineerNode('full-config', config);

      expect(node.config.useWorktree).toBe(true);
      expect(node.config.branchPrefix).toBe('task/');
      expect(node.config.cleanupWorktree).toBe(false);
    });

    it('should have engineering tools for worktree operations', () => {
      const node = new EngineerNode('tools-test');

      const tools = node.config.ai?.allowedTools ?? [];
      // Git-related tools should be included
      expect(tools).toContain('Bash');
    });
  });

  // ===========================================================================
  // MergeCoordinatorNode Configuration Tests
  // ===========================================================================

  describe('MergeCoordinatorNode Configuration', () => {
    it('should create MergeCoordinatorNode with default configuration', () => {
      const node = new MergeCoordinatorNode('test-merge', {});

      expect(node).toBeDefined();
      expect(node.id).toBe('test-merge');
      expect(node.type).toBe('preset:merge-coordinator');
    });

    it('should configure sequential merge strategy', () => {
      const node = new MergeCoordinatorNode('sequential-merge', {
        mergeStrategy: 'sequential',
      });

      expect(node.config.mergeStrategy).toBe('sequential');
    });

    it('should configure parallel merge strategy', () => {
      const node = new MergeCoordinatorNode('parallel-merge', {
        mergeStrategy: 'parallel',
      });

      expect(node.config.mergeStrategy).toBe('parallel');
    });

    it('should configure AI-driven merge strategy', () => {
      const node = new MergeCoordinatorNode('ai-merge', {
        mergeStrategy: 'ai-driven',
      });

      expect(node.config.mergeStrategy).toBe('ai-driven');
    });

    it('should configure cleanup branches option', () => {
      const node = new MergeCoordinatorNode('cleanup-branches', {
        cleanupBranches: true,
      });

      expect(node.config.cleanupBranches).toBe(true);
    });

    it('should configure stop on conflict option', () => {
      const node = new MergeCoordinatorNode('stop-conflict', {
        stopOnConflict: true,
      });

      expect(node.config.stopOnConflict).toBe(true);
    });

    it('should configure conflict resolution mode', () => {
      const node = new MergeCoordinatorNode('conflict-mode', {
        conflictResolution: 'ai-assisted',
      });

      expect(node.config.conflictResolution).toBe('ai-assisted');
    });

    it('should have correct input sockets for branches', () => {
      const node = new MergeCoordinatorNode('input-test', {});

      expect(node.inputs.length).toBeGreaterThan(0);
      const branchesInput = node.inputs.find(i => i.id === 'branches');
      expect(branchesInput).toBeDefined();
    });

    it('should serialize to JSON correctly', () => {
      const node = new MergeCoordinatorNode('serialize-test', {
        mergeStrategy: 'sequential',
        cleanupBranches: true,
      });

      const json = node.toJSON();

      expect(json.id).toBe('serialize-test');
      expect(json.type).toBe('preset:merge-coordinator');
    });

    it('should validate successfully with default config', () => {
      const node = new MergeCoordinatorNode('valid-merge', {});
      // Set connected inputs to avoid required input validation errors
      node.setConnectedInputs(['branches']);
      const validation = node.validate();
      expect(validation.valid).toBe(true);
    });

    it('should validate invalid merge strategy', () => {
      const node = new MergeCoordinatorNode('invalid-strategy', {
        mergeStrategy: 'invalid' as MergeCoordinatorNodeConfig['mergeStrategy'],
      });

      const validation = node.validate();
      expect(validation.valid).toBe(false);
    });
  });

  // ===========================================================================
  // ConflictResolverNode Configuration Tests
  // ===========================================================================

  describe('ConflictResolverNode Configuration', () => {
    it('should create ConflictResolverNode with default configuration', () => {
      const node = new ConflictResolverNode('test-resolver', {});

      expect(node).toBeDefined();
      expect(node.id).toBe('test-resolver');
      expect(node.type).toBe('preset:conflict-resolver');
    });

    it('should configure AI-driven resolution strategy', () => {
      const node = new ConflictResolverNode('ai-resolver', {
        resolutionStrategy: 'ai-driven',
      });

      expect(node.config.resolutionStrategy).toBe('ai-driven');
    });

    it('should configure ours resolution strategy', () => {
      const node = new ConflictResolverNode('ours-resolver', {
        resolutionStrategy: 'ours',
      });

      expect(node.config.resolutionStrategy).toBe('ours');
    });

    it('should configure theirs resolution strategy', () => {
      const node = new ConflictResolverNode('theirs-resolver', {
        resolutionStrategy: 'theirs',
      });

      expect(node.config.resolutionStrategy).toBe('theirs');
    });

    it('should have correct input sockets for conflict info', () => {
      const node = new ConflictResolverNode('input-test', {});

      expect(node.inputs.length).toBeGreaterThan(0);
      const conflictInput = node.inputs.find(i => i.id === 'conflict');
      expect(conflictInput).toBeDefined();
    });

    it('should serialize to JSON correctly', () => {
      const node = new ConflictResolverNode('serialize-test', {
        resolutionStrategy: 'ai-driven',
      });

      const json = node.toJSON();

      expect(json.id).toBe('serialize-test');
      expect(json.type).toBe('preset:conflict-resolver');
    });

    it('should validate successfully with default config', () => {
      const node = new ConflictResolverNode('valid-resolver', {});
      // Set connected inputs to avoid required input validation errors
      node.setConnectedInputs(['conflict']);
      const validation = node.validate();
      expect(validation.valid).toBe(true);
    });

    it('should validate invalid resolution strategy', () => {
      const node = new ConflictResolverNode('invalid-strategy', {
        resolutionStrategy: 'invalid' as ConflictResolverNodeConfig['resolutionStrategy'],
      });

      const validation = node.validate();
      expect(validation.valid).toBe(false);
    });
  });

  // ===========================================================================
  // NodeFactory Integration Tests
  // ===========================================================================

  describe('NodeFactory with Workflow Nodes', () => {
    it('should create ParallelNode through static factory method', () => {
      const node = NodeFactory.createNode({
        id: 'factory-parallel',
        type: 'parallel',
        label: 'Factory Parallel',
        position: { x: 0, y: 0 },
        config: {
          targetNode: 'engineer',
          maxConcurrency: 3,
        },
      });

      expect(node).toBeDefined();
      expect(node.id).toBe('factory-parallel');
    });

    it('should create AggregatorNode through static factory method', () => {
      const node = NodeFactory.createNode({
        id: 'factory-aggregator',
        type: 'aggregator',
        label: 'Factory Aggregator',
        position: { x: 0, y: 0 },
        config: {
          aggregationMode: 'concat',
        },
      });

      expect(node).toBeDefined();
      expect(node.id).toBe('factory-aggregator');
    });

    it('should create MergeCoordinatorNode through static factory method', () => {
      const node = NodeFactory.createNode({
        id: 'factory-merge',
        type: 'preset:merge-coordinator',
        label: 'Factory Merge',
        position: { x: 0, y: 0 },
        config: {
          mergeStrategy: 'sequential',
        },
      });

      expect(node).toBeDefined();
      expect(node.id).toBe('factory-merge');
    });

    it('should create ConflictResolverNode through static factory method', () => {
      const node = NodeFactory.createNode({
        id: 'factory-resolver',
        type: 'preset:conflict-resolver',
        label: 'Factory Resolver',
        position: { x: 0, y: 0 },
        config: {
          resolutionStrategy: 'ai-driven',
        },
      });

      expect(node).toBeDefined();
      expect(node.id).toBe('factory-resolver');
    });

    it('should create multiple nodes in batch through static method', () => {
      const nodes = NodeFactory.createNodes([
        {
          id: 'start',
          type: 'start',
          label: 'Start',
          position: { x: 0, y: 0 },
          config: {},
        },
        {
          id: 'parallel',
          type: 'parallel',
          label: 'Parallel',
          position: { x: 100, y: 0 },
          config: { targetNode: 'engineer', maxConcurrency: 3 },
        },
        {
          id: 'aggregator',
          type: 'aggregator',
          label: 'Aggregator',
          position: { x: 200, y: 0 },
          config: { aggregationMode: 'concat' },
        },
        {
          id: 'merge',
          type: 'preset:merge-coordinator',
          label: 'Merge',
          position: { x: 300, y: 0 },
          config: { mergeStrategy: 'sequential' },
        },
        {
          id: 'end',
          type: 'end',
          label: 'End',
          position: { x: 400, y: 0 },
          config: {},
        },
      ]);

      expect(nodes).toHaveLength(5);
      expect(nodes[0].id).toBe('start');
      expect(nodes[1].id).toBe('parallel');
      expect(nodes[2].id).toBe('aggregator');
      expect(nodes[3].id).toBe('merge');
      expect(nodes[4].id).toBe('end');
    });

    it('should get registered types through instance method', () => {
      const factory = NodeFactory.getInstance();
      const types = factory.getRegisteredTypes();

      expect(types).toContain('parallel');
      expect(types).toContain('aggregator');
      expect(types).toContain('preset:merge-coordinator');
      expect(types).toContain('preset:conflict-resolver');
    });

    it('should get node type info through instance method', () => {
      const factory = NodeFactory.getInstance();
      const info = factory.getNodeTypeInfo('preset:merge-coordinator');

      expect(info).toBeDefined();
      expect(info?.category).toBe('git-operation');
    });
  });

  // ===========================================================================
  // Workflow Pattern Configuration Tests
  // ===========================================================================

  describe('Workflow Pattern Configurations', () => {
    it('should configure simple parallel pattern', () => {
      const parallel = new ParallelNode('parallel', {
        targetNode: 'engineer',
        maxConcurrency: 3,
      });

      const aggregator = new AggregatorNode('aggregator', {
        aggregationMode: 'concat',
        waitForAll: true,
      });

      expect(parallel.config.maxConcurrency).toBe(3);
      expect(aggregator.config.waitForAll).toBe(true);
    });

    it('should configure parallel with rate limiting pattern', () => {
      const parallel = new ParallelNode('rate-limited', {
        targetNode: 'engineer',
        maxConcurrency: 2, // Only 2 concurrent executions
      });

      expect(parallel.config.maxConcurrency).toBe(2);
    });

    it('should configure fan-out fan-in pattern', () => {
      const fanOut = new ParallelNode('fan-out', {
        targetNode: 'engineer',
        maxConcurrency: 5,
      });

      const fanIn = new AggregatorNode('fan-in', {
        aggregationMode: 'merge',
        waitForAll: true,
      });

      expect(fanOut.config.maxConcurrency).toBe(5);
      expect(fanIn.config.waitForAll).toBe(true);
    });

    it('should configure merge with conflict resolution pattern', () => {
      const merge = new MergeCoordinatorNode('merge', {
        mergeStrategy: 'sequential',
        cleanupBranches: true,
      });

      const resolver = new ConflictResolverNode('resolver', {
        resolutionStrategy: 'ai-driven',
      });

      expect(merge.config.mergeStrategy).toBe('sequential');
      expect(resolver.config.resolutionStrategy).toBe('ai-driven');
    });

    it('should configure isolated execution pattern with worktrees', () => {
      const engineer1 = new EngineerNode('engineer-1', {
        useWorktree: true,
        branchPrefix: 'feature/',
        cleanupWorktree: true,
      });

      const engineer2 = new EngineerNode('engineer-2', {
        useWorktree: true,
        branchPrefix: 'feature/',
        cleanupWorktree: true,
      });

      expect(engineer1.config.useWorktree).toBe(true);
      expect(engineer2.config.useWorktree).toBe(true);
    });
  });
});
