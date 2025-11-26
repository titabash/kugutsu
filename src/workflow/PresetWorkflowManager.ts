/**
 * PresetWorkflowManager
 *
 * Manages preset workflow templates for the visual workflow editor.
 * Provides access to built-in workflow templates like:
 * - Simple Parallel Development
 * - Sprint Development
 * - Scrum Workflow
 */

import type { ReteWorkflowJSON, WorkflowNodeJSON, ConnectionJSON } from './types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Preset workflow category
 */
export type PresetCategory = 'parallel' | 'agile' | 'custom';

/**
 * Preset workflow metadata
 */
export interface PresetWorkflowInfo {
  /** Unique preset ID */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Category */
  category: PresetCategory;
  /** Tags for filtering */
  tags?: string[];
}

// ============================================================================
// Preset Workflow Definitions
// ============================================================================

/**
 * Simple Parallel Development Workflow
 * Start → Parallel(Engineer x3) → Aggregator → Review → End
 */
const SIMPLE_PARALLEL_WORKFLOW: ReteWorkflowJSON = {
  version: '1.0.0',
  metadata: {
    name: 'Simple Parallel Development',
    description: 'Parallel execution of engineering tasks with aggregation and review',
    author: 'kugutsu',
    createdAt: '2025-11-27T00:00:00Z',
    updatedAt: '2025-11-27T00:00:00Z',
    tags: ['parallel', 'development', 'review'],
  },
  nodes: [
    {
      id: 'start-1',
      type: 'start' as const,
      label: 'Start',
      position: { x: 50, y: 200 },
      inputs: [],
      outputs: [{ id: 'default', name: 'Output', type: 'control', required: true }],
      config: {},
    },
    {
      id: 'parallel-1',
      type: 'parallel' as const,
      label: 'Parallel Tasks',
      position: { x: 200, y: 200 },
      inputs: [{ id: 'items', name: 'Items', type: 'data', dataType: 'array', required: true }],
      outputs: [
        { id: 'results', name: 'Results', type: 'data', dataType: 'array', required: true },
      ],
      config: {
        maxConcurrency: 3,
        useWorktree: true,
        branchPrefix: 'task',
        cleanupAfter: true,
        targetNode: 'engineer-1',
      },
    },
    {
      id: 'engineer-1',
      type: 'preset:engineer' as const,
      label: 'Engineer',
      position: { x: 400, y: 200 },
      inputs: [{ id: 'task', name: 'Task', type: 'data', dataType: 'object', required: true }],
      outputs: [
        { id: 'result', name: 'Result', type: 'data', dataType: 'object', required: true },
        { id: 'fileChanges', name: 'File Changes', type: 'data', dataType: 'array', required: false },
      ],
      config: {
        useWorktree: true,
        branchPrefix: 'feature',
        cleanupWorktree: false, // Keep worktree for review
        ai: {
          provider: 'auto',
          maxTurns: 30,
        },
      },
    },
    {
      id: 'aggregator-1',
      type: 'aggregator' as const,
      label: 'Aggregate Results',
      position: { x: 600, y: 200 },
      inputs: [
        { id: 'results', name: 'Results', type: 'data', dataType: 'array', required: true },
      ],
      outputs: [
        { id: 'aggregated', name: 'Aggregated', type: 'data', dataType: 'array', required: true },
      ],
      config: {
        aggregationMode: 'concat',
        waitForAll: true,
        filterErrors: false,
      },
    },
    {
      id: 'reviewer-1',
      type: 'preset:reviewer' as const,
      label: 'Code Review',
      position: { x: 800, y: 200 },
      inputs: [
        { id: 'code', name: 'Code', type: 'data', dataType: 'object', required: true },
        { id: 'context', name: 'Context', type: 'data', dataType: 'object', required: false },
      ],
      outputs: [
        { id: 'review', name: 'Review', type: 'data', dataType: 'object', required: true },
        { id: 'approved', name: 'Approved', type: 'data', dataType: 'boolean', required: true },
      ],
      config: {
        strictMode: false,
        ai: {
          provider: 'auto',
          maxTurns: 15,
        },
      },
    },
    {
      id: 'end-1',
      type: 'end' as const,
      label: 'End',
      position: { x: 1000, y: 200 },
      inputs: [{ id: 'default', name: 'Input', type: 'any', required: true }],
      outputs: [],
      config: {
        onComplete: {
          saveResult: true,
        },
      },
    },
  ],
  connections: [
    {
      id: 'conn-1',
      source: 'start-1',
      sourceOutput: 'default',
      target: 'parallel-1',
      targetInput: 'items',
    },
    {
      id: 'conn-2',
      source: 'parallel-1',
      sourceOutput: 'results',
      target: 'aggregator-1',
      targetInput: 'results',
    },
    {
      id: 'conn-3',
      source: 'aggregator-1',
      sourceOutput: 'aggregated',
      target: 'reviewer-1',
      targetInput: 'code',
    },
    {
      id: 'conn-4',
      source: 'reviewer-1',
      sourceOutput: 'review',
      target: 'end-1',
      targetInput: 'default',
    },
  ],
  entryNodeId: 'start-1',
  exitNodeId: 'end-1',
};

/**
 * Sprint Development Workflow
 * Start → ProductOwner → Engineer → Reviewer → TestRunner → End
 */
const SPRINT_DEVELOPMENT_WORKFLOW: ReteWorkflowJSON = {
  version: '1.0.0',
  metadata: {
    name: 'Sprint Development',
    description: 'Linear sprint workflow with planning, development, review, and testing',
    author: 'kugutsu',
    createdAt: '2025-11-27T00:00:00Z',
    updatedAt: '2025-11-27T00:00:00Z',
    tags: ['sprint', 'agile', 'development'],
  },
  nodes: [
    {
      id: 'start-1',
      type: 'start' as const,
      label: 'Start',
      position: { x: 50, y: 200 },
      inputs: [],
      outputs: [{ id: 'default', name: 'Output', type: 'control', required: true }],
      config: {},
    },
    {
      id: 'po-1',
      type: 'preset:product-owner' as const,
      label: 'Sprint Planning',
      position: { x: 200, y: 200 },
      inputs: [
        { id: 'request', name: 'Request', type: 'data', dataType: 'string', required: true },
      ],
      outputs: [
        { id: 'tasks', name: 'Tasks', type: 'data', dataType: 'array', required: true },
        { id: 'specifications', name: 'Specifications', type: 'data', dataType: 'object', required: false },
      ],
      config: {
        outputMode: 'both',
        maxTasks: 10,
        ai: {
          provider: 'auto',
          maxTurns: 20,
        },
      },
    },
    {
      id: 'engineer-1',
      type: 'preset:engineer' as const,
      label: 'Development',
      position: { x: 400, y: 200 },
      inputs: [
        { id: 'task', name: 'Task', type: 'data', dataType: 'object', required: true },
        { id: 'context', name: 'Context', type: 'data', dataType: 'object', required: false },
      ],
      outputs: [
        { id: 'result', name: 'Result', type: 'data', dataType: 'object', required: true },
        { id: 'fileChanges', name: 'File Changes', type: 'data', dataType: 'array', required: false },
      ],
      config: {
        useWorktree: false,
        ai: {
          provider: 'auto',
          maxTurns: 30,
        },
      },
    },
    {
      id: 'reviewer-1',
      type: 'preset:reviewer' as const,
      label: 'Code Review',
      position: { x: 600, y: 200 },
      inputs: [
        { id: 'code', name: 'Code', type: 'data', dataType: 'object', required: true },
      ],
      outputs: [
        { id: 'review', name: 'Review', type: 'data', dataType: 'object', required: true },
        { id: 'approved', name: 'Approved', type: 'data', dataType: 'boolean', required: true },
      ],
      config: {
        strictMode: false,
        ai: {
          provider: 'auto',
          maxTurns: 15,
        },
      },
    },
    {
      id: 'test-runner-1',
      type: 'preset:test-runner' as const,
      label: 'Run Tests',
      position: { x: 800, y: 200 },
      inputs: [
        { id: 'changedFiles', name: 'Changed Files', type: 'data', dataType: 'array', required: false },
      ],
      outputs: [
        { id: 'testResults', name: 'Test Results', type: 'data', dataType: 'object', required: true },
        { id: 'passed', name: 'Passed', type: 'data', dataType: 'boolean', required: true },
      ],
      config: {
        testFramework: 'jest',
        collectCoverage: true,
        coverageThreshold: 80,
        ai: {
          provider: 'auto',
          maxTurns: 15,
        },
      },
    },
    {
      id: 'end-1',
      type: 'end' as const,
      label: 'End',
      position: { x: 1000, y: 200 },
      inputs: [{ id: 'default', name: 'Input', type: 'any', required: true }],
      outputs: [],
      config: {},
    },
  ],
  connections: [
    {
      id: 'conn-1',
      source: 'start-1',
      sourceOutput: 'default',
      target: 'po-1',
      targetInput: 'request',
    },
    {
      id: 'conn-2',
      source: 'po-1',
      sourceOutput: 'tasks',
      target: 'engineer-1',
      targetInput: 'task',
    },
    {
      id: 'conn-3',
      source: 'engineer-1',
      sourceOutput: 'result',
      target: 'reviewer-1',
      targetInput: 'code',
    },
    {
      id: 'conn-4',
      source: 'reviewer-1',
      sourceOutput: 'review',
      target: 'test-runner-1',
      targetInput: 'changedFiles',
    },
    {
      id: 'conn-5',
      source: 'test-runner-1',
      sourceOutput: 'testResults',
      target: 'end-1',
      targetInput: 'default',
    },
  ],
  entryNodeId: 'start-1',
  exitNodeId: 'end-1',
};

/**
 * Scrum Workflow
 * Start → ProductOwner(Backlog) → Group(Engineer+Reviewer per task) → Aggregator → MergeCoordinator → End
 */
const SCRUM_WORKFLOW: ReteWorkflowJSON = {
  version: '1.0.0',
  metadata: {
    name: 'Scrum Workflow',
    description: 'Full Scrum workflow with backlog creation, parallel development, and merge coordination',
    author: 'kugutsu',
    createdAt: '2025-11-27T00:00:00Z',
    updatedAt: '2025-11-27T00:00:00Z',
    tags: ['scrum', 'agile', 'parallel', 'merge'],
  },
  nodes: [
    {
      id: 'start-1',
      type: 'start' as const,
      label: 'Start',
      position: { x: 50, y: 200 },
      inputs: [],
      outputs: [{ id: 'default', name: 'Output', type: 'control', required: true }],
      config: {},
    },
    {
      id: 'po-1',
      type: 'preset:product-owner' as const,
      label: 'Create Backlog',
      position: { x: 200, y: 200 },
      inputs: [
        { id: 'request', name: 'Request', type: 'data', dataType: 'string', required: true },
      ],
      outputs: [
        { id: 'tasks', name: 'Tasks', type: 'data', dataType: 'array', required: true },
        { id: 'specifications', name: 'Specifications', type: 'data', dataType: 'object', required: false },
      ],
      config: {
        outputMode: 'both',
        maxTasks: 5,
        ai: {
          provider: 'auto',
          maxTurns: 25,
        },
      },
    },
    {
      id: 'group-1',
      type: 'group' as const,
      label: 'Development Sprint',
      position: { x: 450, y: 200 },
      inputs: [
        { id: 'items', name: 'Items', type: 'data', dataType: 'array', required: true },
      ],
      outputs: [
        { id: 'results', name: 'Results', type: 'data', dataType: 'array', required: true },
      ],
      config: {
        subgraph: {
          nodes: [
            {
              id: 'sub-engineer-1',
              type: 'preset:engineer',
              label: 'Implement',
              position: { x: 50, y: 50 },
              inputs: [
                { id: 'task', name: 'Task', type: 'data', dataType: 'object', required: true },
              ],
              outputs: [
                { id: 'result', name: 'Result', type: 'data', dataType: 'object', required: true },
              ],
              config: {
                useWorktree: true,
                branchPrefix: 'feature',
              },
            },
            {
              id: 'sub-reviewer-1',
              type: 'preset:reviewer',
              label: 'Review',
              position: { x: 250, y: 50 },
              inputs: [
                { id: 'code', name: 'Code', type: 'data', dataType: 'object', required: true },
              ],
              outputs: [
                { id: 'review', name: 'Review', type: 'data', dataType: 'object', required: true },
              ],
              config: {
                strictMode: true,
              },
            },
          ],
          connections: [
            {
              id: 'sub-conn-1',
              source: 'sub-engineer-1',
              sourceOutput: 'result',
              target: 'sub-reviewer-1',
              targetInput: 'code',
            },
          ],
        },
        parallelExecution: {
          enabled: true,
          inputArray: 'items',
          maxConcurrency: 3,
        },
        worktreeConfig: {
          useWorktree: true,
          branchPrefix: 'sprint',
          cleanupAfter: true,
        },
        continueOnError: false,
      },
    },
    {
      id: 'aggregator-1',
      type: 'aggregator' as const,
      label: 'Collect Results',
      position: { x: 700, y: 200 },
      inputs: [
        { id: 'results', name: 'Results', type: 'data', dataType: 'array', required: true },
      ],
      outputs: [
        { id: 'aggregated', name: 'Aggregated', type: 'data', dataType: 'array', required: true },
      ],
      config: {
        aggregationMode: 'concat',
        waitForAll: true,
      },
    },
    {
      id: 'merge-1',
      type: 'preset:merge-coordinator' as const,
      label: 'Merge Changes',
      position: { x: 900, y: 200 },
      inputs: [
        { id: 'branches', name: 'Branches', type: 'data', dataType: 'array', required: true },
        { id: 'targetBranch', name: 'Target Branch', type: 'data', dataType: 'string', required: false },
      ],
      outputs: [
        { id: 'mergeStatus', name: 'Merge Status', type: 'data', dataType: 'object', required: true },
        { id: 'conflicts', name: 'Conflicts', type: 'data', dataType: 'array', required: false },
      ],
      config: {
        mergeStrategy: 'sequential',
        cleanupBranches: true,
        ai: {
          provider: 'auto',
          maxTurns: 20,
        },
      },
    },
    {
      id: 'end-1',
      type: 'end' as const,
      label: 'End',
      position: { x: 1100, y: 200 },
      inputs: [{ id: 'default', name: 'Input', type: 'any', required: true }],
      outputs: [],
      config: {
        onComplete: {
          saveResult: true,
          notify: true,
        },
      },
    },
  ],
  connections: [
    {
      id: 'conn-1',
      source: 'start-1',
      sourceOutput: 'default',
      target: 'po-1',
      targetInput: 'request',
    },
    {
      id: 'conn-2',
      source: 'po-1',
      sourceOutput: 'tasks',
      target: 'group-1',
      targetInput: 'items',
    },
    {
      id: 'conn-3',
      source: 'group-1',
      sourceOutput: 'results',
      target: 'aggregator-1',
      targetInput: 'results',
    },
    {
      id: 'conn-4',
      source: 'aggregator-1',
      sourceOutput: 'aggregated',
      target: 'merge-1',
      targetInput: 'branches',
    },
    {
      id: 'conn-5',
      source: 'merge-1',
      sourceOutput: 'mergeStatus',
      target: 'end-1',
      targetInput: 'default',
    },
  ],
  entryNodeId: 'start-1',
  exitNodeId: 'end-1',
};

// ============================================================================
// Preset Registry
// ============================================================================

/**
 * Registry of all preset workflows
 */
const PRESET_REGISTRY: Record<
  string,
  { info: PresetWorkflowInfo; workflow: ReteWorkflowJSON }
> = {
  'simple-parallel': {
    info: {
      id: 'simple-parallel',
      name: 'Simple Parallel Development',
      description: 'Parallel execution of engineering tasks with aggregation and review',
      category: 'parallel',
      tags: ['parallel', 'development', 'review'],
    },
    workflow: SIMPLE_PARALLEL_WORKFLOW,
  },
  'sprint-development': {
    info: {
      id: 'sprint-development',
      name: 'Sprint Development',
      description: 'Linear sprint workflow with planning, development, review, and testing',
      category: 'agile',
      tags: ['sprint', 'agile', 'development'],
    },
    workflow: SPRINT_DEVELOPMENT_WORKFLOW,
  },
  'scrum-workflow': {
    info: {
      id: 'scrum-workflow',
      name: 'Scrum Workflow',
      description:
        'Full Scrum workflow with backlog creation, parallel development, and merge coordination',
      category: 'agile',
      tags: ['scrum', 'agile', 'parallel', 'merge'],
    },
    workflow: SCRUM_WORKFLOW,
  },
};

// ============================================================================
// PresetWorkflowManager
// ============================================================================

/**
 * PresetWorkflowManager - Singleton manager for preset workflows
 */
export class PresetWorkflowManager {
  private static instance: PresetWorkflowManager | null = null;

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    // Initialize with no custom presets
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): PresetWorkflowManager {
    if (!PresetWorkflowManager.instance) {
      PresetWorkflowManager.instance = new PresetWorkflowManager();
    }
    return PresetWorkflowManager.instance;
  }

  /**
   * List all available preset workflows
   */
  listPresets(): PresetWorkflowInfo[] {
    return Object.values(PRESET_REGISTRY).map((entry) => entry.info);
  }

  /**
   * List presets by category
   */
  listPresetsByCategory(category: PresetCategory): PresetWorkflowInfo[] {
    return Object.values(PRESET_REGISTRY)
      .filter((entry) => entry.info.category === category)
      .map((entry) => entry.info);
  }

  /**
   * Load a preset workflow by ID
   */
  loadPreset(presetId: string): ReteWorkflowJSON {
    const entry = PRESET_REGISTRY[presetId];

    if (!entry) {
      throw new Error(`Unknown preset: ${presetId}`);
    }

    // Return a deep copy to prevent mutations
    return JSON.parse(JSON.stringify(entry.workflow));
  }

  /**
   * Check if a preset exists
   */
  hasPreset(presetId: string): boolean {
    return presetId in PRESET_REGISTRY;
  }

  /**
   * Get preset info by ID
   */
  getPresetInfo(presetId: string): PresetWorkflowInfo | undefined {
    return PRESET_REGISTRY[presetId]?.info;
  }
}

export default PresetWorkflowManager;
