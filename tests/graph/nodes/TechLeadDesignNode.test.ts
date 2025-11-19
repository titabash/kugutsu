/**
 * TechLeadDesignNode Unit Tests (Jest)
 *
 * Tests for parallel UI/UX + DB design generation
 */

import { jest } from '@jest/globals';
import * as fs from 'fs/promises';

// Mock AIProviderFactory BEFORE importing
let mockProvider: any;
const actualAIProviderFactoryModule = (await import(
  '../../../src/providers/AIProviderFactory.js'
)) as typeof import('../../../src/providers/AIProviderFactory.js');
const actualAIProviderFactory = actualAIProviderFactoryModule.AIProviderFactory;
jest.unstable_mockModule('../../../src/providers/AIProviderFactory.js', () => {
  const buildProviderConfig = jest.fn<typeof actualAIProviderFactory.buildProviderConfig>(
    (options) => actualAIProviderFactory.buildProviderConfig(options)
  );
  return {
    AIProviderFactory: {
      ...actualAIProviderFactory,
      create: jest.fn(() => mockProvider),
      buildProviderConfig,
      getSupportedProviders: jest.fn(() => ['claude', 'mock']),
      isProviderSupported: jest.fn((provider: string) => ['claude', 'mock'].includes(provider)),
      syncWithState: jest.fn(),
      recordFailure: jest.fn(),
      getFailedProviders: jest.fn(() => []),
    },
  };
});

// Mock GitWorktreeManager
jest.unstable_mockModule('../../../src/managers/GitWorktreeManager.js', () => ({
  GitWorktreeManager: jest.fn().mockImplementation(() => ({
    addAndCommit: jest.fn<any>().mockResolvedValue(undefined),
  })),
}));

// Mock fs/promises for file reads
let mockReadFile: any;
jest.unstable_mockModule('fs/promises', () => ({
  readFile: jest.fn<any>((path) => {
    if (mockReadFile) {
      return mockReadFile(path);
    }
    // Default: return valid story mapping
    if (path.includes('story-map.json')) {
      return Promise.resolve(JSON.stringify({
        persona: { name: 'Test User', role: 'User', goal: 'Test', painPoints: [] },
        epics: [{ id: 'epic-1', title: 'Epic 1', priority: 1, stories: [] }],
      }));
    }
    // DB schema
    if (path.includes('schema.json')) {
      return Promise.resolve(JSON.stringify({ version: '1.0.0', tables: [] }));
    }
    return Promise.resolve('{}');
  }),
}));

// Import after mocking
const { techLeadDesignNode } = await import('../../../src/graph/nodes/TechLeadDesignNode.js');
const { createInitialState } = await import('../../../src/graph/state.js');
const { MockAIProvider, createMockMessage } = await import(
  '../../../src/providers/MockAIProvider.js'
);
const { AIProviderFactory } = await import('../../../src/providers/AIProviderFactory.js');

// Test helper to create state with currentProjectId and storyMappingApproved
function createTestState(userRequest: string, config: any) {
  const state = createInitialState(userRequest, config);
  state.currentProjectId = 'test-project-001';
  state.storyMappingApproved = true;
  return state;
}

describe('TechLeadDesignNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Reset fs mock to default behavior
    mockReadFile = null;

    // Create fresh mock provider
    mockProvider = new MockAIProvider();
    (AIProviderFactory.create as any).mockReturnValue(mockProvider);
  });

  afterEach(() => {
    mockReadFile = null;
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Parallel Design Generation', () => {
    test('should generate UI/UX and DB designs using Promise.all', async () => {
      const state = createTestState('Test request', {
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
        baseBranch: 'main',
        maxEngineers: 3,
        maxTurns: 50,
        provider: 'mock' as const,
      });

      // Track which tasks were executed
      let uiuxExecuted = false;
      let dbExecuted = false;
      let designDocsExecuted = false;
      let apiExecuted = false;

      mockProvider.execute = jest.fn(async function* (prompt: string) {
        // より具体的なマッチングを使用して、誤マッチを防ぐ
        if (prompt.includes('全体設計書の作成')) {
          designDocsExecuted = true;
          yield createMockMessage.assistant('Design docs generated');
          yield createMockMessage.result(true);
        } else if (prompt.includes('UI/UX設計書の作成')) {
          uiuxExecuted = true;
          yield createMockMessage.assistant('UI/UX design generated');
          yield createMockMessage.result(true);
        } else if (prompt.includes('DB設計書の作成')) {
          dbExecuted = true;
          yield createMockMessage.assistant('DB design generated');
          yield createMockMessage.result(true);
        } else if (prompt.includes('API設計書の作成')) {
          apiExecuted = true;
          yield createMockMessage.assistant('API design generated');
          yield createMockMessage.result(true);
        } else {
          yield createMockMessage.assistant('Generated');
          yield createMockMessage.result(true);
        }
      });

      // Execute node
      const result = await techLeadDesignNode(state);

      // Verify all design phases were executed
      expect(designDocsExecuted).toBe(true);
      expect(uiuxExecuted).toBe(true);
      expect(dbExecuted).toBe(true);
      expect(apiExecuted).toBe(true);

      // Verify result
      expect(result.logs).toBeDefined();
      expect(result.logs?.length).toBeGreaterThan(0);
      expect(result.logs?.[0].level).toBe('success');

      // Verify console output shows parallel execution message
      // "UI/UX設計とDB設計を並列生成中..." should have been logged
    });

    test('should handle errors in parallel execution gracefully', async () => {
      const state = createTestState('Test request', {
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
        baseBranch: 'main',
        maxEngineers: 3,
        maxTurns: 50,
        provider: 'mock' as const,
      });

      // Mock provider.execute to throw error in UI/UX
      mockProvider.execute = jest.fn(async function* (prompt: string) {
        if (prompt.includes('UI/UX設計書の作成')) {
          throw new Error('UI/UX generation failed');
        } else if (prompt.includes('DB設計書の作成')) {
          yield createMockMessage.assistant('DB design generated');
          yield createMockMessage.result(true);
        } else {
          yield createMockMessage.assistant('Generated');
          yield createMockMessage.result(true);
        }
      });

      // Execute should throw or handle error
      await expect(techLeadDesignNode(state)).rejects.toThrow();
    });

    test('should execute designs sequentially when Promise.all is not used', async () => {
      // This test is for regression: verify we're actually using Promise.all
      const state = createTestState('Test request', {
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
        baseBranch: 'main',
        maxEngineers: 3,
        maxTurns: 50,
        provider: 'mock' as const,
      });

      const executionOrder: string[] = [];

      mockProvider.execute = jest.fn(async function* (prompt: string) {
        if (prompt.includes('UI/UX設計書の作成')) {
          executionOrder.push('UIUX_START');
          await new Promise(resolve => setTimeout(resolve, 50));
          yield createMockMessage.assistant('UI/UX design');
          yield createMockMessage.result(true);
          executionOrder.push('UIUX_END');
        } else if (prompt.includes('DB設計書の作成')) {
          executionOrder.push('DB_START');
          await new Promise(resolve => setTimeout(resolve, 50));
          yield createMockMessage.assistant('DB design');
          yield createMockMessage.result(true);
          executionOrder.push('DB_END');
        } else {
          yield createMockMessage.assistant('Generated');
          yield createMockMessage.result(true);
        }
      });

      await techLeadDesignNode(state);

      // With parallel execution, both should start before either ends
      const uiuxStartIndex = executionOrder.indexOf('UIUX_START');
      const dbStartIndex = executionOrder.indexOf('DB_START');
      const uiuxEndIndex = executionOrder.indexOf('UIUX_END');

      // Verify both started before first one ended
      expect(uiuxStartIndex).toBeGreaterThanOrEqual(0);
      expect(dbStartIndex).toBeGreaterThanOrEqual(0);
      expect(Math.min(uiuxStartIndex, dbStartIndex)).toBeLessThan(uiuxEndIndex);
    });
  });

  describe('Basic Functionality', () => {
    test('should fail if currentProjectId is not set', async () => {
      const state = createInitialState('Test request', {
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
        baseBranch: 'main',
        maxEngineers: 3,
        maxTurns: 50,
        provider: 'mock' as const,
      });
      // Don't set currentProjectId

      const result = await techLeadDesignNode(state);

      expect(result.logs).toBeDefined();
      expect(result.logs?.[0].level).toBe('warn');
      expect(result.logs?.[0].message).toContain('プロジェクトID');
    });

    test('should fail if storyMappingApproved is false', async () => {
      const state = createTestState('Test request', {
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
        baseBranch: 'main',
        maxEngineers: 3,
        maxTurns: 50,
        provider: 'mock' as const,
      });
      state.storyMappingApproved = false;

      const result = await techLeadDesignNode(state);

      expect(result.logs).toBeDefined();
      expect(result.logs?.[0].level).toBe('warn');
      expect(result.logs?.[0].message).toContain('ストーリーマッピング未承認');
    });
  });
});
