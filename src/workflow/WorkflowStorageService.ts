/**
 * WorkflowStorageService
 *
 * Phase 4.4: Workflow save/load functionality
 * Provides file-based storage for Rete.js workflows
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { ReteWorkflowJSON, WorkflowNodeJSON, WorkflowEdgeJSON } from './types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Workflow metadata for listing
 */
export interface WorkflowMetadata {
  id: string;
  name: string;
  version?: string;
  nodeCount: number;
  createdAt?: string;
  updatedAt?: string;
  modifiedAt?: Date;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Import options
 */
export interface ImportOptions {
  generateNewId?: boolean;
}

// ============================================================================
// WorkflowStorageService
// ============================================================================

/**
 * Service for managing workflow persistence
 */
export class WorkflowStorageService {
  private basePath: string;
  private workflowsDir: string;
  private customDir: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.workflowsDir = path.join(basePath, '.kugutsu', 'workflows');
    this.customDir = path.join(this.workflowsDir, 'custom');
  }

  /**
   * Get the base path
   */
  getBasePath(): string {
    return this.basePath;
  }

  /**
   * Initialize the service by creating the workflows directories
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.workflowsDir, { recursive: true });
    await fs.mkdir(this.customDir, { recursive: true });
  }

  /**
   * Save a workflow to disk
   */
  async save(workflow: ReteWorkflowJSON, subdirectory?: string): Promise<ReteWorkflowJSON> {
    const now = new Date().toISOString();
    const savedWorkflow: ReteWorkflowJSON = {
      ...workflow,
      id: workflow.id || uuidv4(),
      metadata: {
        ...workflow.metadata,
        createdAt: workflow.metadata?.createdAt || now,
        updatedAt: now,
      },
    };

    const dir = subdirectory
      ? path.join(this.workflowsDir, subdirectory)
      : this.customDir;

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    const filePath = path.join(dir, `${savedWorkflow.id}.json`);
    const content = JSON.stringify(savedWorkflow, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');

    return savedWorkflow;
  }

  /**
   * Load a workflow by ID
   */
  async load(id: string, subdirectory?: string): Promise<ReteWorkflowJSON> {
    const dir = subdirectory
      ? path.join(this.workflowsDir, subdirectory)
      : this.customDir;
    const filePath = path.join(dir, `${id}.json`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      try {
        return JSON.parse(content) as ReteWorkflowJSON;
      } catch {
        throw new Error(`Failed to parse workflow: invalid JSON`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('parse')) {
        throw error;
      }
      throw new Error(`Workflow not found: ${id}`);
    }
  }

  /**
   * List all workflows
   */
  async list(subdirectory?: string): Promise<WorkflowMetadata[]> {
    const dir = subdirectory
      ? path.join(this.workflowsDir, subdirectory)
      : this.customDir;

    try {
      const files = await fs.readdir(dir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));
      const workflows: WorkflowMetadata[] = [];

      for (const file of jsonFiles) {
        const filePath = path.join(dir, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const workflow = JSON.parse(content) as ReteWorkflowJSON;
          const stat = await fs.stat(filePath);
          workflows.push({
            id: workflow.id || file.replace('.json', ''),
            name: workflow.name || 'Unnamed Workflow',
            version: workflow.version,
            nodeCount: workflow.nodes?.length || 0,
            createdAt: workflow.metadata?.createdAt,
            updatedAt: workflow.metadata?.updatedAt,
            modifiedAt: stat.mtime,
          });
        } catch {
          // Skip invalid files
        }
      }

      return workflows;
    } catch {
      // Directory doesn't exist
      return [];
    }
  }

  /**
   * Delete a workflow by ID
   */
  async delete(id: string, subdirectory?: string): Promise<boolean> {
    const dir = subdirectory
      ? path.join(this.workflowsDir, subdirectory)
      : this.customDir;
    const filePath = path.join(dir, `${id}.json`);

    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      throw new Error(`Workflow not found: ${id}`);
    }
  }

  /**
   * Check if a workflow exists
   */
  async exists(id: string, subdirectory?: string): Promise<boolean> {
    const dir = subdirectory
      ? path.join(this.workflowsDir, subdirectory)
      : this.customDir;
    const filePath = path.join(dir, `${id}.json`);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate a workflow
   */
  validate(workflow: ReteWorkflowJSON): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for nodes
    if (!workflow.nodes || workflow.nodes.length === 0) {
      errors.push('Workflow must have at least one node');
    } else {
      // Check for start node
      const hasStart = workflow.nodes.some((n) => n.type === 'start');
      if (!hasStart) {
        errors.push('Workflow must have a start node');
      }

      // Check for end node
      const hasEnd = workflow.nodes.some((n) => n.type === 'end');
      if (!hasEnd) {
        errors.push('Workflow must have an end node');
      }

      // Validate edges reference existing nodes
      const nodeIds = new Set(workflow.nodes.map((n) => n.id));
      for (const edge of workflow.edges || []) {
        if (!nodeIds.has(edge.source)) {
          errors.push(`Edge ${edge.id} references non-existent source node: ${edge.source}`);
        }
        if (!nodeIds.has(edge.target)) {
          errors.push(`Edge ${edge.id} references non-existent target node: ${edge.target}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Export a workflow as JSON string
   */
  async export(id: string, subdirectory?: string): Promise<string> {
    const workflow = await this.load(id, subdirectory);
    return JSON.stringify(workflow, null, 2);
  }

  /**
   * Import a workflow from JSON string
   */
  async import(data: string, options?: ImportOptions): Promise<ReteWorkflowJSON> {
    let workflow: ReteWorkflowJSON;

    try {
      workflow = JSON.parse(data) as ReteWorkflowJSON;
    } catch {
      throw new Error('Failed to parse import data: invalid JSON');
    }

    // Validate the workflow
    const validation = this.validate(workflow);
    if (!validation.valid) {
      throw new Error(`Invalid workflow: ${validation.errors.join(', ')}`);
    }

    // Generate new ID if requested
    if (options?.generateNewId) {
      workflow = {
        ...workflow,
        id: uuidv4(),
      };
    }

    // Save the imported workflow
    return this.save(workflow);
  }

  /**
   * Duplicate a workflow
   */
  async duplicate(id: string, newName?: string, subdirectory?: string): Promise<ReteWorkflowJSON> {
    const original = await this.load(id, subdirectory);

    const duplicated: ReteWorkflowJSON = {
      ...original,
      id: uuidv4(),
      name: newName || `${original.name || 'Workflow'} (Copy)`,
      metadata: {
        ...original.metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };

    return this.save(duplicated, subdirectory);
  }

  /**
   * Get recently modified workflows
   */
  async getRecent(limit: number = 5, subdirectory?: string): Promise<WorkflowMetadata[]> {
    const workflows = await this.list(subdirectory);

    // Sort by modification time (newest first)
    workflows.sort((a, b) => {
      const aTime = a.modifiedAt?.getTime() || 0;
      const bTime = b.modifiedAt?.getTime() || 0;
      return bTime - aTime;
    });

    return workflows.slice(0, limit);
  }
}

export default WorkflowStorageService;
