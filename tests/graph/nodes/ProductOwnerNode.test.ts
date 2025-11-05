/**
 * ProductOwnerNode Unit Tests (Jest)
 */

import { jest } from '@jest/globals';

// Mock AIProviderFactory BEFORE importing
let mockProvider: any;
jest.unstable_mockModule('../../../src/providers/AIProviderFactory.js', () => ({
  AIProviderFactory: {
    create: jest.fn(() => mockProvider),
    getSupportedProviders: jest.fn(() => ['claude', 'mock']),
    isProviderSupported: jest.fn((provider: string) => ['claude', 'mock'].includes(provider)),
  },
}));

// Import after mocking
const { productOwnerNode } = await import('../../../src/graph/nodes/ProductOwnerNode.js');
const { createInitialState } = await import('../../../src/graph/state.js');
const { MockAIProvider, createMockMessage } = await import(
  '../../../src/providers/MockAIProvider.js'
);
const { AIProviderFactory } = await import('../../../src/providers/AIProviderFactory.js');

describe('ProductOwnerNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mock provider
    mockProvider = new MockAIProvider();
    (AIProviderFactory.create as any).mockReturnValue(mockProvider);
  });

  test('should generate tasks from user request', async () => {
    // Setup mock responses
    const techStackResponse = {
      languages: ['TypeScript'],
      frameworks: ['Node.js'],
      buildTools: ['npm'],
    };

    const requirementsResponse = {
      functional: ['Implement feature'],
      nonFunctional: ['Performance'],
      constraints: ['Use TypeScript'],
    };

    const tasksResponse = [
      {
        id: 'task-001',
        title: 'Implement authentication',
        description: 'Add user authentication',
        priority: 100,
        dependencies: [],
      },
      {
        id: 'task-002',
        title: 'Add tests',
        description: 'Write unit tests',
        priority: 80,
        dependencies: ['task-001'],
      },
    ];

    mockProvider.setDefaultResponse({
      messages: [
        createMockMessage.assistant(JSON.stringify(techStackResponse)),
        createMockMessage.assistant(JSON.stringify(requirementsResponse)),
        createMockMessage.assistant(JSON.stringify(tasksResponse)),
        createMockMessage.result(true),
      ],
    });

    // Create initial state
    const initialState = createInitialState('Implement user authentication', {
      maxEngineers: 3,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    // Execute node
    const result = await productOwnerNode(initialState);

    // Verify AIProviderFactory.create was called
    expect(AIProviderFactory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'claude',
      })
    );

    // Verify results
    expect(result.tasks).toBeDefined();
    expect(result.tasks!.length).toBeGreaterThanOrEqual(1);

    if (result.tasks && result.tasks.length > 0) {
      const task = result.tasks[0];
      expect(task.id).toBeDefined();
      expect(task.title).toBeDefined();
      expect(task.description).toBeDefined();
      expect(task.status).toBe('pending');
    }

    expect(result.logs).toBeDefined();
    expect(result.logs!.length).toBeGreaterThan(0);
  });

  test('should handle errors gracefully', async () => {
    // Setup mock provider with error
    mockProvider.setDefaultResponse({
      messages: [],
      shouldThrowError: true,
      errorMessage: 'API error',
    });

    // Create initial state
    const initialState = createInitialState('Test request', {
      maxEngineers: 1,
      maxTurns: 10,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    // Execute node
    const result = await productOwnerNode(initialState);

    // Should have error logs
    expect(result.logs).toBeDefined();
    const errorLog = result.logs!.find((log) => log.level === 'error');
    expect(errorLog).toBeDefined();

    // Should have error in metadata
    expect(result.metadata?.hasErrors).toBe(true);
  });
});
