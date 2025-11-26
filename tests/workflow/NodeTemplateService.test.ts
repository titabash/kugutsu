/**
 * NodeTemplateService Tests
 *
 * Phase 3.3.2: Node template persistence
 * TDD: Tests for custom node template storage
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

// Mock fs/promises module BEFORE importing NodeTemplateService
jest.unstable_mockModule('fs/promises', () => ({
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
  readFile: mockReadFile,
  readdir: mockReaddir,
  unlink: mockUnlink,
  access: mockAccess,
}));

// Dynamic import after mocking
const { NodeTemplateService } = await import('../../src/workflow/NodeTemplateService.js');
type CustomNodeTemplate = import('../../src/workflow/NodeTemplateService.js').CustomNodeTemplate;

// ============================================================================
// Test Data
// ============================================================================

const sampleTemplate: CustomNodeTemplate = {
  id: 'test-node-1',
  name: 'Test Node',
  description: 'A test node for unit testing',
  systemPrompt: 'You are a test assistant.',
  provider: 'auto',
  maxTurns: 30,
  allowedTools: ['Read', 'Write', 'Edit'],
  inputs: [
    { id: 'input-1', name: 'Input', type: 'data', dataType: 'string', required: true },
  ],
  outputs: [
    { id: 'output-1', name: 'Output', type: 'data', dataType: 'object', required: true },
  ],
  createdAt: '2025-11-27T00:00:00Z',
  updatedAt: '2025-11-27T00:00:00Z',
};

// ============================================================================
// NodeTemplateService Tests
// ============================================================================

describe('NodeTemplateService', () => {
  let service: InstanceType<typeof NodeTemplateService>;
  const testBasePath = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NodeTemplateService(testBasePath);

    // Default mock implementations
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(JSON.stringify(sampleTemplate));
    mockReaddir.mockResolvedValue([]);
    mockUnlink.mockResolvedValue(undefined);
    mockAccess.mockResolvedValue(undefined);
  });

  describe('Initialization', () => {
    it('should create service with base path', () => {
      expect(service).toBeDefined();
      expect(service.getBasePath()).toBe(testBasePath);
    });

    it('should initialize with default templates directory', async () => {
      await service.initialize();

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringContaining('.kugutsu/node-templates'),
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

  describe('Save Template', () => {
    it('should save template as JSON file', async () => {
      await service.save(sampleTemplate);

      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('should save to correct path', async () => {
      await service.save(sampleTemplate);

      const expectedPath = path.join(
        testBasePath,
        '.kugutsu',
        'node-templates',
        `${sampleTemplate.id}.json`
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        expectedPath,
        expect.any(String),
        'utf-8'
      );
    });

    it('should save template with pretty JSON formatting', async () => {
      await service.save(sampleTemplate);

      const writeCall = mockWriteFile.mock.calls[0];
      const savedContent = writeCall?.[1] as string;
      expect(savedContent).toContain('\n'); // Pretty printed JSON has newlines
    });

    it('should generate ID if not provided', async () => {
      const templateWithoutId = { ...sampleTemplate, id: undefined };
      delete (templateWithoutId as Partial<CustomNodeTemplate>).id;

      const saved = await service.save(templateWithoutId as CustomNodeTemplate);

      expect(saved.id).toBeDefined();
      expect(typeof saved.id).toBe('string');
    });

    it('should update timestamps on save', async () => {
      const oldTemplate = { ...sampleTemplate, updatedAt: '2020-01-01T00:00:00Z' };

      const saved = await service.save(oldTemplate);

      expect(saved.updatedAt).not.toBe('2020-01-01T00:00:00Z');
    });

    it('should set createdAt for new templates', async () => {
      const newTemplate = { ...sampleTemplate, createdAt: undefined };
      delete (newTemplate as Partial<CustomNodeTemplate>).createdAt;

      const saved = await service.save(newTemplate as CustomNodeTemplate);

      expect(saved.createdAt).toBeDefined();
    });
  });

  describe('Load Template', () => {
    it('should load template by ID', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify(sampleTemplate));

      const loaded = await service.load('test-node-1');

      expect(loaded).toEqual(sampleTemplate);
    });

    it('should read from correct path', async () => {
      await service.load('test-node-1');

      const expectedPath = path.join(
        testBasePath,
        '.kugutsu',
        'node-templates',
        'test-node-1.json'
      );
      expect(mockReadFile).toHaveBeenCalledWith(expectedPath, 'utf-8');
    });

    it('should throw error for non-existent template', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      await expect(service.load('non-existent')).rejects.toThrow(/not found/i);
    });

    it('should throw error for invalid JSON', async () => {
      mockReadFile.mockResolvedValue('invalid json');

      await expect(service.load('invalid-json')).rejects.toThrow(/parse|invalid/i);
    });
  });

  describe('List Templates', () => {
    it('should list all templates', async () => {
      mockReaddir.mockResolvedValue([
        'template-1.json',
        'template-2.json',
        'template-3.json',
      ]);

      const templates = await service.list();

      expect(templates).toHaveLength(3);
    });

    it('should return template metadata', async () => {
      mockReaddir.mockResolvedValue(['test-node-1.json']);
      mockReadFile.mockResolvedValue(JSON.stringify(sampleTemplate));

      const templates = await service.list();

      expect(templates[0]).toMatchObject({
        id: 'test-node-1',
        name: 'Test Node',
        description: 'A test node for unit testing',
      });
    });

    it('should filter out non-JSON files', async () => {
      mockReaddir.mockResolvedValue([
        'template-1.json',
        'readme.md',
        '.gitkeep',
        'template-2.json',
      ]);

      const templates = await service.list();

      expect(templates).toHaveLength(2);
    });

    it('should return empty array if no templates', async () => {
      mockReaddir.mockResolvedValue([]);

      const templates = await service.list();

      expect(templates).toEqual([]);
    });

    it('should handle directory not existing', async () => {
      mockReaddir.mockRejectedValue(new Error('ENOENT'));

      const templates = await service.list();

      expect(templates).toEqual([]);
    });
  });

  describe('Delete Template', () => {
    it('should delete template by ID', async () => {
      await service.delete('test-node-1');

      expect(mockUnlink).toHaveBeenCalled();
    });

    it('should delete from correct path', async () => {
      await service.delete('test-node-1');

      const expectedPath = path.join(
        testBasePath,
        '.kugutsu',
        'node-templates',
        'test-node-1.json'
      );
      expect(mockUnlink).toHaveBeenCalledWith(expectedPath);
    });

    it('should throw error if template does not exist', async () => {
      mockUnlink.mockRejectedValue(new Error('ENOENT'));

      await expect(service.delete('non-existent')).rejects.toThrow(/not found/i);
    });

    it('should return true on successful deletion', async () => {
      const result = await service.delete('test-node-1');

      expect(result).toBe(true);
    });
  });

  describe('Check Template Exists', () => {
    it('should return true for existing template', async () => {
      mockAccess.mockResolvedValue(undefined);

      const exists = await service.exists('test-node-1');

      expect(exists).toBe(true);
    });

    it('should return false for non-existing template', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const exists = await service.exists('non-existent');

      expect(exists).toBe(false);
    });

    it('should check correct path', async () => {
      await service.exists('test-node-1');

      const expectedPath = path.join(
        testBasePath,
        '.kugutsu',
        'node-templates',
        'test-node-1.json'
      );
      expect(mockAccess).toHaveBeenCalledWith(expectedPath);
    });
  });

  describe('Validate Template', () => {
    it('should validate template structure', () => {
      const result = service.validate(sampleTemplate);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject template without name', () => {
      const invalidTemplate = { ...sampleTemplate, name: '' };

      const result = service.validate(invalidTemplate);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => /name/i.test(e))).toBe(true);
    });

    it('should reject template with invalid provider', () => {
      const invalidTemplate = { ...sampleTemplate, provider: 'invalid' as any };

      const result = service.validate(invalidTemplate);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => /provider/i.test(e))).toBe(true);
    });

    it('should reject template with negative maxTurns', () => {
      const invalidTemplate = { ...sampleTemplate, maxTurns: -1 };

      const result = service.validate(invalidTemplate);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => /maxTurns/i.test(e))).toBe(true);
    });

    it('should allow template without inputs/outputs', () => {
      const minimalTemplate = {
        ...sampleTemplate,
        inputs: [],
        outputs: [],
      };

      const result = service.validate(minimalTemplate);

      expect(result.valid).toBe(true);
    });
  });

  describe('Import/Export', () => {
    it('should export all templates as JSON', async () => {
      mockReaddir.mockResolvedValue(['template-1.json']);
      mockReadFile.mockResolvedValue(JSON.stringify(sampleTemplate));

      const exported = await service.exportAll();

      expect(exported).toContain('"test-node-1"');
      expect(typeof exported).toBe('string');
    });

    it('should import templates from JSON', async () => {
      const importData = JSON.stringify({
        version: '1.0.0',
        templates: [sampleTemplate],
      });

      const imported = await service.importAll(importData);

      expect(imported).toBe(1);
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('should throw error for invalid import data', async () => {
      await expect(service.importAll('invalid json')).rejects.toThrow(/parse|invalid/i);
    });

    it('should skip invalid templates during import', async () => {
      const importData = JSON.stringify({
        version: '1.0.0',
        templates: [
          sampleTemplate,
          { ...sampleTemplate, id: 'invalid', name: '' }, // Invalid
        ],
      });

      const imported = await service.importAll(importData);

      expect(imported).toBe(1); // Only valid template imported
    });
  });
});

// ============================================================================
// Integration with NodeFactory Tests
// ============================================================================

describe('NodeTemplateService with NodeFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadFile.mockResolvedValue(JSON.stringify(sampleTemplate));
  });

  it('should create registrable node creator from template', async () => {
    const service = new NodeTemplateService('/test');

    const creator = await service.createNodeCreator('test-node-1');

    expect(typeof creator).toBe('function');
  });

  it('should create node with template configuration', async () => {
    const service = new NodeTemplateService('/test');

    const creator = await service.createNodeCreator('test-node-1');
    const node = creator({
      id: 'instance-1',
      type: 'custom:test-node-1' as any,
      label: 'Test Instance',
      position: { x: 0, y: 0 },
      inputs: [],
      outputs: [],
      config: {},
    });

    expect(node).toBeDefined();
    expect(node.config.ai?.systemPrompt).toBe('You are a test assistant.');
    expect(node.config.ai?.provider).toBe('auto');
  });
});
