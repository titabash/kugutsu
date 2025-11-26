/**
 * NodeTemplateService
 *
 * Phase 3.3.2: Node template persistence
 * Provides file-based storage for custom node templates
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { WorkflowNodeJSON } from './types.js';
import type { BaseWorkflowNode } from './nodes/BaseWorkflowNode.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Socket definition for custom node inputs/outputs
 */
export interface SocketDefinition {
  id: string;
  name: string;
  type: 'control' | 'data';
  dataType?: string;
  required?: boolean;
}

/**
 * Custom node template definition
 */
export interface CustomNodeTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  provider: 'auto' | 'claude' | 'codex' | 'gemini';
  maxTurns: number;
  allowedTools: string[];
  inputs: SocketDefinition[];
  outputs: SocketDefinition[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Template metadata for listing
 */
export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Export format
 */
export interface TemplateExportData {
  version: string;
  templates: CustomNodeTemplate[];
}

/**
 * Node creator function type
 */
export type NodeCreatorFunction = (json: WorkflowNodeJSON) => BaseWorkflowNode;

// ============================================================================
// Valid providers list
// ============================================================================

const VALID_PROVIDERS = ['auto', 'claude', 'codex', 'gemini'] as const;

// ============================================================================
// NodeTemplateService
// ============================================================================

/**
 * Service for managing custom node templates with file-based persistence
 */
export class NodeTemplateService {
  private basePath: string;
  private templatesDir: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.templatesDir = path.join(basePath, '.kugutsu', 'node-templates');
  }

  /**
   * Get the base path
   */
  getBasePath(): string {
    return this.basePath;
  }

  /**
   * Initialize the service by creating the templates directory
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.templatesDir, { recursive: true });
  }

  /**
   * Save a template to disk
   */
  async save(template: CustomNodeTemplate): Promise<CustomNodeTemplate> {
    const now = new Date().toISOString();
    const savedTemplate: CustomNodeTemplate = {
      ...template,
      id: template.id || uuidv4(),
      createdAt: template.createdAt || now,
      updatedAt: now,
    };

    const filePath = path.join(this.templatesDir, `${savedTemplate.id}.json`);
    const content = JSON.stringify(savedTemplate, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');

    return savedTemplate;
  }

  /**
   * Load a template by ID
   */
  async load(id: string): Promise<CustomNodeTemplate> {
    const filePath = path.join(this.templatesDir, `${id}.json`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      try {
        return JSON.parse(content) as CustomNodeTemplate;
      } catch {
        throw new Error(`Failed to parse template: invalid JSON`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('parse')) {
        throw error;
      }
      throw new Error(`Template not found: ${id}`);
    }
  }

  /**
   * List all templates
   */
  async list(): Promise<TemplateMetadata[]> {
    try {
      const files = await fs.readdir(this.templatesDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));
      const templates: TemplateMetadata[] = [];

      for (const file of jsonFiles) {
        const filePath = path.join(this.templatesDir, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const template = JSON.parse(content) as CustomNodeTemplate;
          templates.push({
            id: template.id,
            name: template.name,
            description: template.description,
            createdAt: template.createdAt,
            updatedAt: template.updatedAt,
          });
        } catch {
          // Skip invalid files
        }
      }

      return templates;
    } catch {
      // Directory doesn't exist
      return [];
    }
  }

  /**
   * Delete a template by ID
   */
  async delete(id: string): Promise<boolean> {
    const filePath = path.join(this.templatesDir, `${id}.json`);

    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      throw new Error(`Template not found: ${id}`);
    }
  }

  /**
   * Check if a template exists
   */
  async exists(id: string): Promise<boolean> {
    const filePath = path.join(this.templatesDir, `${id}.json`);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate a template
   */
  validate(template: CustomNodeTemplate): ValidationResult {
    const errors: string[] = [];

    // Validate name
    if (!template.name || template.name.trim() === '') {
      errors.push('Template name is required');
    }

    // Validate provider
    if (!VALID_PROVIDERS.includes(template.provider as (typeof VALID_PROVIDERS)[number])) {
      errors.push(`Invalid provider: ${template.provider}`);
    }

    // Validate maxTurns
    if (template.maxTurns < 0) {
      errors.push('maxTurns must be non-negative');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Export all templates as JSON string
   */
  async exportAll(): Promise<string> {
    const templates = await this.listFull();
    const exportData: TemplateExportData = {
      version: '1.0.0',
      templates,
    };
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import templates from JSON string
   */
  async importAll(data: string): Promise<number> {
    let parsed: TemplateExportData;

    try {
      parsed = JSON.parse(data) as TemplateExportData;
    } catch {
      throw new Error('Failed to parse import data: invalid JSON');
    }

    let importedCount = 0;

    for (const template of parsed.templates) {
      const validation = this.validate(template);
      if (validation.valid) {
        await this.save(template);
        importedCount++;
      }
    }

    return importedCount;
  }

  /**
   * Create a node creator function from a template
   */
  async createNodeCreator(id: string): Promise<NodeCreatorFunction> {
    const template = await this.load(id);

    return (json: WorkflowNodeJSON): BaseWorkflowNode => {
      // Create a node with the template configuration
      const node = {
        id: json.id,
        type: json.type,
        label: json.label,
        position: json.position,
        inputs: json.inputs || template.inputs.map((i) => ({ id: i.id, name: i.name })),
        outputs: json.outputs || template.outputs.map((o) => ({ id: o.id, name: o.name })),
        config: {
          ...json.config,
          ai: {
            systemPrompt: template.systemPrompt,
            provider: template.provider,
            maxTurns: template.maxTurns,
            allowedTools: template.allowedTools,
          },
        },
        execute: async () => ({ success: true }),
        toJSON: () => json,
      } as unknown as BaseWorkflowNode;

      return node;
    };
  }

  /**
   * List all templates with full data
   */
  private async listFull(): Promise<CustomNodeTemplate[]> {
    try {
      const files = await fs.readdir(this.templatesDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));
      const templates: CustomNodeTemplate[] = [];

      for (const file of jsonFiles) {
        const filePath = path.join(this.templatesDir, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const template = JSON.parse(content) as CustomNodeTemplate;
          templates.push(template);
        } catch {
          // Skip invalid files
        }
      }

      return templates;
    } catch {
      return [];
    }
  }
}
