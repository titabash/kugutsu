/**
 * PresetWorkflows Tests
 *
 * Phase 3.4: Preset workflow JSON creation
 * TDD Red Phase: Tests for preset workflow loading and validation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  PresetWorkflowManager,
  type PresetWorkflowInfo,
} from '../../src/workflow/PresetWorkflowManager.js';
import { NodeFactory } from '../../src/workflow/NodeFactory.js';
import type { ReteWorkflowJSON } from '../../src/workflow/types.js';

// ============================================================================
// PresetWorkflowManager Tests
// ============================================================================

describe('PresetWorkflowManager', () => {
  let manager: PresetWorkflowManager;

  beforeEach(() => {
    manager = PresetWorkflowManager.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = PresetWorkflowManager.getInstance();
      const instance2 = PresetWorkflowManager.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Listing Presets', () => {
    it('should list all available presets', () => {
      const presets = manager.listPresets();

      expect(presets).toBeDefined();
      expect(Array.isArray(presets)).toBe(true);
      expect(presets.length).toBeGreaterThan(0);
    });

    it('should include simple-parallel preset', () => {
      const presets = manager.listPresets();
      const simpleParallel = presets.find((p) => p.id === 'simple-parallel');

      expect(simpleParallel).toBeDefined();
      expect(simpleParallel?.name).toContain('Parallel');
    });

    it('should include sprint-development preset', () => {
      const presets = manager.listPresets();
      const sprint = presets.find((p) => p.id === 'sprint-development');

      expect(sprint).toBeDefined();
      expect(sprint?.name).toContain('Sprint');
    });

    it('should include scrum-workflow preset', () => {
      const presets = manager.listPresets();
      const scrum = presets.find((p) => p.id === 'scrum-workflow');

      expect(scrum).toBeDefined();
      expect(scrum?.name).toContain('Scrum');
    });

    it('should provide metadata for each preset', () => {
      const presets = manager.listPresets();

      for (const preset of presets) {
        expect(preset.id).toBeDefined();
        expect(preset.name).toBeDefined();
        expect(preset.description).toBeDefined();
        expect(preset.category).toBeDefined();
      }
    });
  });

  describe('Loading Presets', () => {
    it('should load simple-parallel preset', () => {
      const workflow = manager.loadPreset('simple-parallel');

      expect(workflow).toBeDefined();
      expect(workflow.version).toBeDefined();
      expect(workflow.metadata).toBeDefined();
      expect(workflow.nodes).toBeDefined();
      expect(workflow.connections).toBeDefined();
    });

    it('should load sprint-development preset', () => {
      const workflow = manager.loadPreset('sprint-development');

      expect(workflow).toBeDefined();
      expect(workflow.nodes.length).toBeGreaterThan(0);
    });

    it('should load scrum-workflow preset', () => {
      const workflow = manager.loadPreset('scrum-workflow');

      expect(workflow).toBeDefined();
      expect(workflow.nodes.length).toBeGreaterThan(0);
    });

    it('should throw error for unknown preset', () => {
      expect(() => {
        manager.loadPreset('unknown-preset');
      }).toThrow(/unknown preset|not found/i);
    });
  });

  describe('Preset Validation', () => {
    it('should validate loaded preset has valid structure', () => {
      const workflow = manager.loadPreset('simple-parallel');

      // Check required fields
      expect(workflow.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(workflow.metadata.name).toBeDefined();
      expect(workflow.entryNodeId).toBeDefined();
      expect(workflow.exitNodeId).toBeDefined();
    });

    it('should validate all nodes have required fields', () => {
      const workflow = manager.loadPreset('simple-parallel');

      for (const node of workflow.nodes) {
        expect(node.id).toBeDefined();
        expect(node.type).toBeDefined();
        expect(node.label).toBeDefined();
        expect(node.position).toBeDefined();
        expect(node.position.x).toBeDefined();
        expect(node.position.y).toBeDefined();
      }
    });

    it('should validate entry node exists in nodes', () => {
      const workflow = manager.loadPreset('simple-parallel');

      const entryNode = workflow.nodes.find((n) => n.id === workflow.entryNodeId);
      expect(entryNode).toBeDefined();
    });

    it('should validate exit node exists in nodes', () => {
      const workflow = manager.loadPreset('simple-parallel');

      const exitNode = workflow.nodes.find((n) => n.id === workflow.exitNodeId);
      expect(exitNode).toBeDefined();
    });

    it('should validate connections reference valid nodes', () => {
      const workflow = manager.loadPreset('simple-parallel');
      const nodeIds = new Set(workflow.nodes.map((n) => n.id));

      for (const conn of workflow.connections) {
        expect(nodeIds.has(conn.source)).toBe(true);
        expect(nodeIds.has(conn.target)).toBe(true);
      }
    });
  });
});

// ============================================================================
// Simple Parallel Workflow Tests
// ============================================================================

describe('Simple Parallel Workflow', () => {
  let manager: PresetWorkflowManager;
  let workflow: ReteWorkflowJSON;

  beforeEach(() => {
    manager = PresetWorkflowManager.getInstance();
    workflow = manager.loadPreset('simple-parallel');
  });

  describe('Structure', () => {
    it('should have Start node', () => {
      const startNode = workflow.nodes.find((n) => n.type === 'start');
      expect(startNode).toBeDefined();
    });

    it('should have Parallel node', () => {
      const parallelNode = workflow.nodes.find((n) => n.type === 'parallel');
      expect(parallelNode).toBeDefined();
    });

    it('should have Engineer nodes', () => {
      const engineerNodes = workflow.nodes.filter((n) => n.type === 'preset:engineer');
      expect(engineerNodes.length).toBeGreaterThanOrEqual(1);
    });

    it('should have Aggregator node', () => {
      const aggregatorNode = workflow.nodes.find((n) => n.type === 'aggregator');
      expect(aggregatorNode).toBeDefined();
    });

    it('should have Reviewer node', () => {
      const reviewerNode = workflow.nodes.find((n) => n.type === 'preset:reviewer');
      expect(reviewerNode).toBeDefined();
    });

    it('should have End node', () => {
      const endNode = workflow.nodes.find((n) => n.type === 'end');
      expect(endNode).toBeDefined();
    });
  });

  describe('Node Configuration', () => {
    it('should configure Parallel node with maxConcurrency', () => {
      const parallelNode = workflow.nodes.find((n) => n.type === 'parallel');

      expect(parallelNode?.config.maxConcurrency).toBeDefined();
      expect(typeof parallelNode?.config.maxConcurrency).toBe('number');
    });

    it('should configure Engineer node with worktree settings', () => {
      const engineerNode = workflow.nodes.find((n) => n.type === 'preset:engineer');

      expect(engineerNode?.config.useWorktree).toBeDefined();
    });

    it('should configure Aggregator node with aggregation mode', () => {
      const aggregatorNode = workflow.nodes.find((n) => n.type === 'aggregator');

      expect(aggregatorNode?.config.aggregationMode).toBeDefined();
    });
  });

  describe('Node Creation', () => {
    it('should create all nodes via NodeFactory', () => {
      for (const nodeJson of workflow.nodes) {
        const node = NodeFactory.createNode(nodeJson);
        expect(node).toBeDefined();
        expect(node.id).toBe(nodeJson.id);
      }
    });
  });
});

// ============================================================================
// Sprint Development Workflow Tests
// ============================================================================

describe('Sprint Development Workflow', () => {
  let manager: PresetWorkflowManager;
  let workflow: ReteWorkflowJSON;

  beforeEach(() => {
    manager = PresetWorkflowManager.getInstance();
    workflow = manager.loadPreset('sprint-development');
  });

  describe('Structure', () => {
    it('should have Start node', () => {
      const startNode = workflow.nodes.find((n) => n.type === 'start');
      expect(startNode).toBeDefined();
    });

    it('should have ProductOwner node', () => {
      const poNode = workflow.nodes.find((n) => n.type === 'preset:product-owner');
      expect(poNode).toBeDefined();
    });

    it('should have Engineer node', () => {
      const engineerNode = workflow.nodes.find((n) => n.type === 'preset:engineer');
      expect(engineerNode).toBeDefined();
    });

    it('should have Reviewer node', () => {
      const reviewerNode = workflow.nodes.find((n) => n.type === 'preset:reviewer');
      expect(reviewerNode).toBeDefined();
    });

    it('should have TestRunner node', () => {
      const testNode = workflow.nodes.find((n) => n.type === 'preset:test-runner');
      expect(testNode).toBeDefined();
    });

    it('should have End node', () => {
      const endNode = workflow.nodes.find((n) => n.type === 'end');
      expect(endNode).toBeDefined();
    });
  });

  describe('Workflow Flow', () => {
    it('should connect ProductOwner to Engineer', () => {
      const poNode = workflow.nodes.find((n) => n.type === 'preset:product-owner');
      const engineerNode = workflow.nodes.find((n) => n.type === 'preset:engineer');

      const connection = workflow.connections.find(
        (c) => c.source === poNode?.id && c.target === engineerNode?.id
      );
      expect(connection).toBeDefined();
    });

    it('should connect Engineer to Reviewer', () => {
      const engineerNode = workflow.nodes.find((n) => n.type === 'preset:engineer');
      const reviewerNode = workflow.nodes.find((n) => n.type === 'preset:reviewer');

      const connection = workflow.connections.find(
        (c) => c.source === engineerNode?.id && c.target === reviewerNode?.id
      );
      expect(connection).toBeDefined();
    });
  });
});

// ============================================================================
// Scrum Workflow Tests
// ============================================================================

describe('Scrum Workflow', () => {
  let manager: PresetWorkflowManager;
  let workflow: ReteWorkflowJSON;

  beforeEach(() => {
    manager = PresetWorkflowManager.getInstance();
    workflow = manager.loadPreset('scrum-workflow');
  });

  describe('Structure', () => {
    it('should have Start node', () => {
      const startNode = workflow.nodes.find((n) => n.type === 'start');
      expect(startNode).toBeDefined();
    });

    it('should have ProductOwner node for backlog creation', () => {
      const poNodes = workflow.nodes.filter((n) => n.type === 'preset:product-owner');
      expect(poNodes.length).toBeGreaterThan(0);
    });

    it('should have Group node for parallel development', () => {
      const groupNode = workflow.nodes.find((n) => n.type === 'group');
      expect(groupNode).toBeDefined();
    });

    it('should have MergeCoordinator node', () => {
      const mergeNode = workflow.nodes.find((n) => n.type === 'preset:merge-coordinator');
      expect(mergeNode).toBeDefined();
    });

    it('should have End node', () => {
      const endNode = workflow.nodes.find((n) => n.type === 'end');
      expect(endNode).toBeDefined();
    });
  });

  describe('Group Node Configuration', () => {
    it('should configure Group node with subgraph', () => {
      const groupNode = workflow.nodes.find((n) => n.type === 'group');

      expect(groupNode?.config.subgraph).toBeDefined();
      expect(groupNode?.config.subgraph?.nodes).toBeDefined();
      expect(groupNode?.config.subgraph?.connections).toBeDefined();
    });

    it('should have Engineer and Reviewer in subgraph', () => {
      const groupNode = workflow.nodes.find((n) => n.type === 'group');
      const subgraphNodes = groupNode?.config.subgraph?.nodes ?? [];

      const hasEngineer = subgraphNodes.some((n: { type: string }) =>
        n.type === 'preset:engineer'
      );
      const hasReviewer = subgraphNodes.some((n: { type: string }) =>
        n.type === 'preset:reviewer'
      );

      expect(hasEngineer).toBe(true);
      expect(hasReviewer).toBe(true);
    });
  });
});

// ============================================================================
// Preset Workflow Categories Tests
// ============================================================================

describe('Preset Workflow Categories', () => {
  let manager: PresetWorkflowManager;

  beforeEach(() => {
    manager = PresetWorkflowManager.getInstance();
  });

  it('should categorize simple-parallel as parallel', () => {
    const presets = manager.listPresets();
    const simpleParallel = presets.find((p) => p.id === 'simple-parallel');

    expect(simpleParallel?.category).toBe('parallel');
  });

  it('should categorize sprint-development as agile', () => {
    const presets = manager.listPresets();
    const sprint = presets.find((p) => p.id === 'sprint-development');

    expect(sprint?.category).toBe('agile');
  });

  it('should categorize scrum-workflow as agile', () => {
    const presets = manager.listPresets();
    const scrum = presets.find((p) => p.id === 'scrum-workflow');

    expect(scrum?.category).toBe('agile');
  });

  it('should list presets by category', () => {
    const parallelPresets = manager.listPresetsByCategory('parallel');
    const agilePresets = manager.listPresetsByCategory('agile');

    expect(parallelPresets.length).toBeGreaterThan(0);
    expect(agilePresets.length).toBeGreaterThan(0);
  });
});
