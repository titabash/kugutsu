/**
 * WorkflowStorageService Tests
 *
 * Phase 4.4: Workflow save/load functionality
 * TDD Red Phase: Tests for workflow file persistence
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import * as path from 'path';

// Create mock functions
const mockMkdir = jest.fn<() => Promise<undefined>>();
const mockWriteFile = jest.fn<() => Promise<void>>();
const mockReadFile = jest.fn<() => Promise<string>>();
const mockReaddir = jest.fn<() => Promise<string[]>>();
const mockUnlink = jest.fn<() => Promise<void>>();
const mockAccess = jest.fn<() => Promise<void>>();
const mockStat = jest.fn<() => Promise<{ mtime: Date }>>();

// Mock fs/promises module BEFORE importing WorkflowStorageService
jest.unstable_mockModule('fs/promises', () => ({
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
  readFile: mockReadFile,
  readdir: mockReaddir,
  unlink: mockUnlink,
  access: mockAccess,
  stat: mockStat,
}));

// Dynamic import after mocking
const { WorkflowStorageService } = await import('../../src/workflow/WorkflowStorageService.js');
type ReteWorkflowJSON = import('../../src/workflow/types.js').ReteWorkflowJSON;

// ============================================================================
// Test Data
// ============================================================================

const sampleWorkflow: ReteWorkflowJSON = {
  id: 'test-workflow-1',
  name: 'Test Workflow',
  version: '1.0.0',
  nodes: [
    {
      id: 'start-1',
      type: 'start',
      label: 'Start',
      position: { x: 100, y: 100 },
      inputs: [],
      outputs: [{ id: 'out-1', name: 'output' }],
      config: {},
    },
    {
      id: 'engineer-1',
      type: 'engineer',
      label: 'Engineer',
      position: { x: 300, y: 100 },
      inputs: [{ id: 'in-1', name: 'input' }],
      outputs: [{ id: 'out-2', name: 'output' }],
      config: {
        ai: {
          provider: 'claude',
          maxTurns: 30,
          systemPrompt: 'You are an engineer.',
        },
      },
    },
    {
      id: 'end-1',
      type: 'end',
      label: 'End',
      position: { x: 500, y: 100 },
      inputs: [{ id: 'in-2', name: 'input' }],
      outputs: [],
      config: {},
    },
  ],
  edges: [
    { id: 'edge-1', source: 'start-1', sourceOutput: 'out-1', target: 'engineer-1', targetInput: 'in-1' },
    { id: 'edge-2', source: 'engineer-1', sourceOutput: 'out-2', target: 'end-1', targetInput: 'in-2' },
  ],
  metadata: {
    createdAt: '2025-11-27T00:00:00Z',
    updatedAt: '2025-11-27T00:00:00Z',
  },
};

// ============================================================================
// WorkflowStorageService Tests
// ============================================================================

describe('WorkflowStorageService', () => {
  let service: InstanceType<typeof WorkflowStorageService>;
  const testBasePath = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkflowStorageService(testBasePath);

    // Default mock implementations
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(JSON.stringify(sampleWorkflow));
    mockReaddir.mockResolvedValue([]);
    mockUnlink.mockResolvedValue(undefined);
    mockAccess.mockResolvedValue(undefined);
    mockStat.mockResolvedValue({ mtime: new Date('2025-11-27T00:00:00Z') });
  });

  // ==========================================================================
  // Initialization Tests
  // ==========================================================================

  describe('Initialization', () => {
    it('should create service with base path', () => {
      expect(service).toBeDefined();
      expect(service.getBasePath()).toBe(testBasePath);
    });

    it('should initialize with default workflows directory', async () => {
      await service.initialize();

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringContaining('.kugutsu/workflows'),
        expect.any(Object)
      );
    });

    it('should create custom workflows directory', async () => {
      await service.initialize();

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringContaining('.kugutsu/workflows/custom'),
        expect.any(Object)
      );
    });

    it('should create directory recursively', async () => {
      await service.initialize();

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true }
      );
    });
  });

  // ==========================================================================
  // Save Workflow Tests
  // ==========================================================================

  describe('Save Workflow', () => {
    it('should save workflow as JSON file', async () => {
      await service.save(sampleWorkflow);

      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('should save to correct path', async () => {
      await service.save(sampleWorkflow);

      const expectedPath = path.join(
        testBasePath,
        '.kugutsu',
        'workflows',
        'custom',
        `${sampleWorkflow.id}.json`
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        expectedPath,
        expect.any(String),
        'utf-8'
      );
    });

    it('should save with pretty JSON formatting', async () => {
      await service.save(sampleWorkflow);

      const writeCall = mockWriteFile.mock.calls[0];
      const savedContent = writeCall?.[1] as string;
      expect(savedContent).toContain('\n'); // Pretty printed JSON has newlines
    });

    it('should generate ID if not provided', async () => {
      const workflowWithoutId = { ...sampleWorkflow, id: undefined };
      delete (workflowWithoutId as Partial<ReteWorkflowJSON>).id;

      const saved = await service.save(workflowWithoutId as ReteWorkflowJSON);

      expect(saved.id).toBeDefined();
      expect(typeof saved.id).toBe('string');
    });

    it('should update timestamps on save', async () => {
      const oldWorkflow = {
        ...sampleWorkflow,
        metadata: { ...sampleWorkflow.metadata, updatedAt: '2020-01-01T00:00:00Z' },
      };

      const saved = await service.save(oldWorkflow);

      expect(saved.metadata?.updatedAt).not.toBe('2020-01-01T00:00:00Z');
    });

    it('should set createdAt for new workflows', async () => {
      const newWorkflow = { ...sampleWorkflow, metadata: undefined };

      const saved = await service.save(newWorkflow);

      expect(saved.metadata?.createdAt).toBeDefined();
    });

    it('should preserve existing createdAt', async () => {
      const existingWorkflow = {
        ...sampleWorkflow,
        metadata: { createdAt: '2020-01-01T00:00:00Z', updatedAt: '2020-01-01T00:00:00Z' },
      };

      const saved = await service.save(existingWorkflow);

      expect(saved.metadata?.createdAt).toBe('2020-01-01T00:00:00Z');
    });

    it('should save to custom subdirectory', async () => {
      await service.save(sampleWorkflow, 'my-project');

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('my-project'),
        expect.any(String),
        'utf-8'
      );
    });
  });

  // ==========================================================================
  // Load Workflow Tests
  // ==========================================================================

  describe('Load Workflow', () => {
    it('should load workflow by ID', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify(sampleWorkflow));

      const loaded = await service.load('test-workflow-1');

      expect(loaded).toEqual(sampleWorkflow);
    });

    it('should read from correct path', async () => {
      await service.load('test-workflow-1');

      const expectedPath = path.join(
        testBasePath,
        '.kugutsu',
        'workflows',
        'custom',
        'test-workflow-1.json'
      );
      expect(mockReadFile).toHaveBeenCalledWith(expectedPath, 'utf-8');
    });

    it('should load from custom subdirectory', async () => {
      await service.load('test-workflow-1', 'my-project');

      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringContaining('my-project'),
        'utf-8'
      );
    });

    it('should throw error for non-existent workflow', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      await expect(service.load('non-existent')).rejects.toThrow(/not found/i);
    });

    it('should throw error for invalid JSON', async () => {
      mockReadFile.mockResolvedValue('invalid json');

      await expect(service.load('invalid-json')).rejects.toThrow(/parse|invalid/i);
    });
  });

  // ==========================================================================
  // List Workflows Tests
  // ==========================================================================

  describe('List Workflows', () => {
    it('should list all workflows', async () => {
      mockReaddir.mockResolvedValue([
        'workflow-1.json',
        'workflow-2.json',
        'workflow-3.json',
      ]);

      const workflows = await service.list();

      expect(workflows).toHaveLength(3);
    });

    it('should return workflow metadata', async () => {
      mockReaddir.mockResolvedValue(['test-workflow-1.json']);
      mockReadFile.mockResolvedValue(JSON.stringify(sampleWorkflow));

      const workflows = await service.list();

      expect(workflows[0]).toMatchObject({
        id: 'test-workflow-1',
        name: 'Test Workflow',
      });
    });

    it('should include node count in metadata', async () => {
      mockReaddir.mockResolvedValue(['test-workflow-1.json']);
      mockReadFile.mockResolvedValue(JSON.stringify(sampleWorkflow));

      const workflows = await service.list();

      expect(workflows[0].nodeCount).toBe(3);
    });

    it('should filter out non-JSON files', async () => {
      mockReaddir.mockResolvedValue([
        'workflow-1.json',
        'readme.md',
        '.gitkeep',
        'workflow-2.json',
      ]);

      const workflows = await service.list();

      expect(workflows).toHaveLength(2);
    });

    it('should return empty array if no workflows', async () => {
      mockReaddir.mockResolvedValue([]);

      const workflows = await service.list();

      expect(workflows).toEqual([]);
    });

    it('should handle directory not existing', async () => {
      mockReaddir.mockRejectedValue(new Error('ENOENT'));

      const workflows = await service.list();

      expect(workflows).toEqual([]);
    });

    it('should list from custom subdirectory', async () => {
      mockReaddir.mockResolvedValue(['workflow-1.json']);

      await service.list('my-project');

      expect(mockReaddir).toHaveBeenCalledWith(
        expect.stringContaining('my-project')
      );
    });
  });

  // ==========================================================================
  // Delete Workflow Tests
  // ==========================================================================

  describe('Delete Workflow', () => {
    it('should delete workflow by ID', async () => {
      await service.delete('test-workflow-1');

      expect(mockUnlink).toHaveBeenCalled();
    });

    it('should delete from correct path', async () => {
      await service.delete('test-workflow-1');

      const expectedPath = path.join(
        testBasePath,
        '.kugutsu',
        'workflows',
        'custom',
        'test-workflow-1.json'
      );
      expect(mockUnlink).toHaveBeenCalledWith(expectedPath);
    });

    it('should throw error if workflow does not exist', async () => {
      mockUnlink.mockRejectedValue(new Error('ENOENT'));

      await expect(service.delete('non-existent')).rejects.toThrow(/not found/i);
    });

    it('should return true on successful deletion', async () => {
      const result = await service.delete('test-workflow-1');

      expect(result).toBe(true);
    });

    it('should delete from custom subdirectory', async () => {
      await service.delete('test-workflow-1', 'my-project');

      expect(mockUnlink).toHaveBeenCalledWith(
        expect.stringContaining('my-project')
      );
    });
  });

  // ==========================================================================
  // Exists Check Tests
  // ==========================================================================

  describe('Check Workflow Exists', () => {
    it('should return true for existing workflow', async () => {
      mockAccess.mockResolvedValue(undefined);

      const exists = await service.exists('test-workflow-1');

      expect(exists).toBe(true);
    });

    it('should return false for non-existing workflow', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const exists = await service.exists('non-existent');

      expect(exists).toBe(false);
    });

    it('should check correct path', async () => {
      await service.exists('test-workflow-1');

      const expectedPath = path.join(
        testBasePath,
        '.kugutsu',
        'workflows',
        'custom',
        'test-workflow-1.json'
      );
      expect(mockAccess).toHaveBeenCalledWith(expectedPath);
    });
  });

  // ==========================================================================
  // Validate Workflow Tests
  // ==========================================================================

  describe('Validate Workflow', () => {
    it('should validate workflow structure', () => {
      const result = service.validate(sampleWorkflow);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject workflow without nodes', () => {
      const invalidWorkflow = { ...sampleWorkflow, nodes: [] };

      const result = service.validate(invalidWorkflow);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => /node/i.test(e))).toBe(true);
    });

    it('should reject workflow without start node', () => {
      const invalidWorkflow = {
        ...sampleWorkflow,
        nodes: sampleWorkflow.nodes.filter(n => n.type !== 'start'),
      };

      const result = service.validate(invalidWorkflow);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => /start/i.test(e))).toBe(true);
    });

    it('should reject workflow without end node', () => {
      const invalidWorkflow = {
        ...sampleWorkflow,
        nodes: sampleWorkflow.nodes.filter(n => n.type !== 'end'),
      };

      const result = service.validate(invalidWorkflow);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => /end/i.test(e))).toBe(true);
    });

    it('should reject workflow with invalid edges', () => {
      const invalidWorkflow = {
        ...sampleWorkflow,
        edges: [
          { id: 'edge-1', source: 'nonexistent', sourceOutput: 'out', target: 'end-1', targetInput: 'in' },
        ],
      };

      const result = service.validate(invalidWorkflow);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => /edge|source|target/i.test(e))).toBe(true);
    });

    it('should allow workflow with warnings', () => {
      const workflowWithWarnings = {
        ...sampleWorkflow,
        // Workflow is valid but might have warnings
      };

      const result = service.validate(workflowWithWarnings);

      expect(result.valid).toBe(true);
    });
  });

  // ==========================================================================
  // Import/Export Tests
  // ==========================================================================

  describe('Import/Export', () => {
    it('should export workflow as JSON string', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify(sampleWorkflow));

      const exported = await service.export('test-workflow-1');

      expect(typeof exported).toBe('string');
      expect(exported).toContain('"test-workflow-1"');
    });

    it('should import workflow from JSON string', async () => {
      const importData = JSON.stringify(sampleWorkflow);

      const imported = await service.import(importData);

      expect(imported.id).toBe('test-workflow-1');
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('should throw error for invalid import data', async () => {
      await expect(service.import('invalid json')).rejects.toThrow(/parse|invalid/i);
    });

    it('should validate workflow during import', async () => {
      const invalidWorkflow = { ...sampleWorkflow, nodes: [] };
      const importData = JSON.stringify(invalidWorkflow);

      await expect(service.import(importData)).rejects.toThrow(/valid|nodes/i);
    });

    it('should generate new ID on import if requested', async () => {
      const importData = JSON.stringify(sampleWorkflow);

      const imported = await service.import(importData, { generateNewId: true });

      expect(imported.id).not.toBe('test-workflow-1');
    });
  });

  // ==========================================================================
  // Duplicate Workflow Tests
  // ==========================================================================

  describe('Duplicate Workflow', () => {
    it('should create a copy of workflow with new ID', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify(sampleWorkflow));

      const duplicated = await service.duplicate('test-workflow-1');

      expect(duplicated.id).not.toBe('test-workflow-1');
      expect(duplicated.name).toContain('Copy');
    });

    it('should save the duplicated workflow', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify(sampleWorkflow));

      await service.duplicate('test-workflow-1');

      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('should allow custom name for duplicate', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify(sampleWorkflow));

      const duplicated = await service.duplicate('test-workflow-1', 'My Custom Copy');

      expect(duplicated.name).toBe('My Custom Copy');
    });
  });

  // ==========================================================================
  // Recent Workflows Tests
  // ==========================================================================

  describe('Recent Workflows', () => {
    it('should return recently modified workflows', async () => {
      mockReaddir.mockResolvedValue(['wf-1.json', 'wf-2.json', 'wf-3.json']);
      mockReadFile.mockImplementation(async (filePath) => {
        const id = (filePath as string).split('/').pop()?.replace('.json', '');
        return JSON.stringify({ ...sampleWorkflow, id, name: `Workflow ${id}` });
      });
      mockStat.mockImplementation(async (filePath) => {
        const id = (filePath as string).split('/').pop()?.replace('.json', '');
        const dates: Record<string, Date> = {
          'wf-1': new Date('2025-11-27T10:00:00Z'),
          'wf-2': new Date('2025-11-27T12:00:00Z'),
          'wf-3': new Date('2025-11-27T08:00:00Z'),
        };
        return { mtime: dates[id || ''] || new Date() };
      });

      const recent = await service.getRecent(2);

      expect(recent).toHaveLength(2);
      // Should be sorted by modification time (newest first)
      expect(recent[0].id).toBe('wf-2');
      expect(recent[1].id).toBe('wf-1');
    });

    it('should return all workflows if less than limit', async () => {
      mockReaddir.mockResolvedValue(['wf-1.json']);
      mockReadFile.mockResolvedValue(JSON.stringify(sampleWorkflow));

      const recent = await service.getRecent(5);

      expect(recent).toHaveLength(1);
    });
  });
});
