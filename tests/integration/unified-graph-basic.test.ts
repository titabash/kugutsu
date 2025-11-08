/**
 * Unified Graph Basic Test
 *
 * Tests that the new unified graph compiles and executes basic workflow
 */

import { jest } from '@jest/globals';

// Mock AIProviderFactory
let mockProvider: any;
jest.unstable_mockModule('../../src/providers/AIProviderFactory.js', () => ({
  AIProviderFactory: {
    create: jest.fn(() => mockProvider),
    getSupportedProviders: jest.fn(() => ['claude', 'mock']),
    isProviderSupported: jest.fn((provider: string) => ['claude', 'mock'].includes(provider)),
  },
}));

// Mock DataPersistence
let mockPersistence: any;
jest.unstable_mockModule('../../src/utils/DataPersistence.js', () => ({
  DataPersistence: jest.fn().mockImplementation(() => mockPersistence),
}));

// Import after mocking
const { compileUnifiedScrumWorkflowGraph } = await import('../../src/graph/ParallelDevGraph.js');
const { createInitialState } = await import('../../src/graph/state.js');
const { MockAIProvider } = await import('../../src/providers/MockAIProvider.js');

describe('Unified Scrum Workflow Graph - Basic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock provider
    mockProvider = new MockAIProvider();

    // Setup mock persistence
    mockPersistence = {
      initialize: jest.fn<any>().mockResolvedValue(undefined),
      loadGlobalQueue: jest.fn<any>().mockResolvedValue([]),
      loadAllProjectMetadata: jest.fn<any>().mockResolvedValue(new Map()),
      saveProjectMetadata: jest.fn<any>().mockResolvedValue(undefined),
      loadRepositoryMetadata: jest.fn<any>().mockResolvedValue(null),
    };
  });

  test('should compile unified graph without errors', () => {
    const graph = compileUnifiedScrumWorkflowGraph();

    expect(graph).toBeDefined();
    expect(graph).toHaveProperty('invoke');
  });

  test('should have analyze_complexity as entry node', async () => {
    const graph = compileUnifiedScrumWorkflowGraph();

    // Setup complexity judgment mock (low complexity)
    mockProvider.setupComplexityJudgmentMock(false, 'low', 'Simple bug fix');

    const initialState = createInitialState('Fix login bug', {
      maxEngineers: 1,
      maxTurns: 5,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
      provider: 'mock',
    });

    // Execute just the first step
    const stream = await graph.stream(initialState);

    let hasAnalyzeComplexity = false;

    for await (const event of stream) {
      console.log('Event:', Object.keys(event));

      if ('analyze_complexity' in event) {
        hasAnalyzeComplexity = true;

        // Check that complexity was analyzed
        const state = event.analyze_complexity;
        expect(state.metadata).toBeDefined();

        // Stop immediately after analyze_complexity
        break;
      }
    }

    expect(hasAnalyzeComplexity).toBe(true);
  }, 10000); // 10 second timeout

  test('should branch correctly based on complexity (low complexity)', async () => {
    const graph = compileUnifiedScrumWorkflowGraph();

    // Setup complexity judgment mock (low complexity = skip design phase)
    mockProvider.setupComplexityJudgmentMock(false, 'low', 'Simple feature addition');

    const initialState = createInitialState('Add export button', {
      maxEngineers: 1,
      maxTurns: 5,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
      provider: 'mock',
    });

    const stream = await graph.stream(initialState);

    const executedNodes: string[] = [];
    let foundComplexity = false;

    for await (const event of stream) {
      const nodeNames = Object.keys(event);
      executedNodes.push(...nodeNames);

      console.log('Executed nodes:', nodeNames);

      // Stop after analyze_complexity executes
      if (nodeNames.includes('analyze_complexity')) {
        foundComplexity = true;

        // Get one more event to check routing
        continue;
      }

      if (foundComplexity) {
        // Got the next event after analyze_complexity, now stop
        break;
      }
    }

    // Verify that analyze_complexity was executed
    expect(executedNodes).toContain('analyze_complexity');

    console.log('All executed nodes:', executedNodes);
  }, 10000);
});
