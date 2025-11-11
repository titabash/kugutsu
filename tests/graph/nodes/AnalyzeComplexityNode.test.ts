/**
 * AnalyzeComplexityNode Unit Tests (Jest)
 */

import { jest } from '@jest/globals';

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
    },
  };
});

// Import after mocking
const { analyzeComplexityNode } = await import('../../../src/graph/nodes/AnalyzeComplexityNode.js');
const { createInitialState } = await import('../../../src/graph/state.js');
const { MockAIProvider, createMockMessage } = await import(
  '../../../src/providers/MockAIProvider.js'
);
const { AIProviderFactory } = await import('../../../src/providers/AIProviderFactory.js');

describe('AnalyzeComplexityNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mock provider
    mockProvider = new MockAIProvider();
    (AIProviderFactory.create as any).mockReturnValue(mockProvider);
  });

  describe('Low Complexity Detection', () => {
    test('should detect low complexity for bug fix', async () => {
      // Setup mock: low complexity response
      const aiResponse = {
        requiresDetailedDesign: false,
        complexityLevel: 'low',
        reason: 'This is a simple bug fix in the login validation logic. The change is localized to a single file and doesn\'t require architecture-level design.',
      };

      const jsonResponse = '```json\n' + JSON.stringify(aiResponse, null, 2) + '\n```';

      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant(jsonResponse),
          createMockMessage.result(true),
        ],
      });

      // Create initial state with bug fix request
      const initialState = createInitialState('Fix login validation bug', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      // Execute node
      const result = await analyzeComplexityNode(initialState);

      // Verify low complexity detection
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.requiresDetailedDesign).toBe(false);
      expect(result.metadata!.complexityReason).toContain('bug fix');

      // Verify logs
      expect(result.logs).toBeDefined();
      expect(result.logs!.length).toBeGreaterThan(0);
      expect(result.logs![0].source).toBe('AnalyzeComplexityNode');
    });

    test('should detect low complexity for small feature addition', async () => {
      const aiResponse = {
        requiresDetailedDesign: false,
        complexityLevel: 'low',
        reason: 'This is a small feature addition to existing functionality. No architectural changes needed.',
      };

      const jsonResponse = '```json\n' + JSON.stringify(aiResponse, null, 2) + '\n```';

      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant(jsonResponse),
          createMockMessage.result(true),
        ],
      });

      const initialState = createInitialState('Add export button to user dashboard', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const result = await analyzeComplexityNode(initialState);

      expect(result.metadata!.requiresDetailedDesign).toBe(false);
      expect(result.metadata!.complexityReason).toContain('small feature');
    });

    test('should detect low complexity for documentation update', async () => {
      const aiResponse = {
        requiresDetailedDesign: false,
        complexityLevel: 'low',
        reason: 'This is a documentation update with no code changes required.',
      };

      const jsonResponse = '```json\n' + JSON.stringify(aiResponse, null, 2) + '\n```';

      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant(jsonResponse),
          createMockMessage.result(true),
        ],
      });

      const initialState = createInitialState('Update API documentation for user endpoints', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const result = await analyzeComplexityNode(initialState);

      expect(result.metadata!.requiresDetailedDesign).toBe(false);
      expect(result.metadata!.complexityReason).toContain('documentation');
    });
  });

  describe('High Complexity Detection', () => {
    test('should detect high complexity for new feature with multiple components', async () => {
      const aiResponse = {
        requiresDetailedDesign: true,
        complexityLevel: 'high',
        reason: 'This request involves creating a new authentication system with multiple components (user model, JWT tokens, middleware, API endpoints). This requires detailed story mapping and technical design to ensure proper architecture.',
      };

      const jsonResponse = '```json\n' + JSON.stringify(aiResponse, null, 2) + '\n```';

      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant(jsonResponse),
          createMockMessage.result(true),
        ],
      });

      const initialState = createInitialState('Implement new authentication system with JWT and OAuth', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const result = await analyzeComplexityNode(initialState);

      expect(result.metadata!.requiresDetailedDesign).toBe(true);
      expect(result.metadata!.complexityReason).toContain('multiple components');
    });

    test('should detect high complexity for architecture change', async () => {
      const aiResponse = {
        requiresDetailedDesign: true,
        complexityLevel: 'high',
        reason: 'This is a major architecture change that affects multiple services and requires careful planning.',
      };

      const jsonResponse = '```json\n' + JSON.stringify(aiResponse, null, 2) + '\n```';

      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant(jsonResponse),
          createMockMessage.result(true),
        ],
      });

      const initialState = createInitialState('Migrate from monolithic architecture to microservices', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const result = await analyzeComplexityNode(initialState);

      expect(result.metadata!.requiresDetailedDesign).toBe(true);
      expect(result.metadata!.complexityReason).toContain('architecture');
    });

    test('should detect high complexity for database schema change', async () => {
      const aiResponse = {
        requiresDetailedDesign: true,
        complexityLevel: 'high',
        reason: 'Database schema changes require careful design to avoid data loss and ensure migration safety.',
      };

      const jsonResponse = '```json\n' + JSON.stringify(aiResponse, null, 2) + '\n```';

      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant(jsonResponse),
          createMockMessage.result(true),
        ],
      });

      const initialState = createInitialState('Add multi-tenant support to database schema', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const result = await analyzeComplexityNode(initialState);

      expect(result.metadata!.requiresDetailedDesign).toBe(true);
      expect(result.metadata!.complexityReason).toContain('schema');
    });
  });

  describe('Conservative Judgment (Error Handling)', () => {
    test('should default to high complexity on parsing error', async () => {
      // Mock AI response: malformed JSON
      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant('This is not valid JSON'),
          createMockMessage.result(true),
        ],
      });

      const initialState = createInitialState('Test request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const result = await analyzeComplexityNode(initialState);

      // Should default to high complexity (conservative)
      expect(result.metadata!.requiresDetailedDesign).toBe(true);
      expect(result.metadata!.complexityReason).toContain('パースに失敗');

      // Should log warning
      expect(result.logs![0].level).toBe('info');
    });

    test('should default to high complexity on AI execution error', async () => {
      // Mock AI response: throw error
      mockProvider.setDefaultResponse({
        messages: [],
        shouldThrowError: true,
        errorMessage: 'AI execution failed',
      });

      const initialState = createInitialState('Test request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const result = await analyzeComplexityNode(initialState);

      // Should default to high complexity (conservative)
      expect(result.metadata!.requiresDetailedDesign).toBe(true);
      expect(result.metadata!.complexityReason).toContain('AI判定エラー');

      // Should log warning
      expect(result.logs![0].level).toBe('warn');
      expect(result.logs![0].message).toContain('エラー');
    });

    test('should handle missing requiresDetailedDesign field', async () => {
      // Mock AI response: missing requiresDetailedDesign field
      const invalidResponse = {
        complexityLevel: 'high',
        reason: 'Missing requiresDetailedDesign field',
      };

      const jsonResponse = '```json\n' + JSON.stringify(invalidResponse, null, 2) + '\n```';

      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant(jsonResponse),
          createMockMessage.result(true),
        ],
      });

      const initialState = createInitialState('Test request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const result = await analyzeComplexityNode(initialState);

      // Should default to high complexity (conservative)
      expect(result.metadata!.requiresDetailedDesign).toBe(true);
      expect(result.metadata!.complexityReason).toContain('パースに失敗');
    });

    test('should handle missing reason field', async () => {
      // Mock AI response: missing reason field
      const invalidResponse = {
        requiresDetailedDesign: false,
        complexityLevel: 'low',
      };

      const jsonResponse = '```json\n' + JSON.stringify(invalidResponse, null, 2) + '\n```';

      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant(jsonResponse),
          createMockMessage.result(true),
        ],
      });

      const initialState = createInitialState('Test request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const result = await analyzeComplexityNode(initialState);

      // Should default to high complexity (conservative)
      expect(result.metadata!.requiresDetailedDesign).toBe(true);
      expect(result.metadata!.complexityReason).toContain('パースに失敗');
    });
  });

  describe('MockAIProvider Integration', () => {
    test('should work with setupComplexityJudgmentMock helper (high complexity)', async () => {
      // Use the new helper method
      mockProvider.setupComplexityJudgmentMock(
        true,
        'high',
        'Test high complexity judgment'
      );

      const initialState = createInitialState('Test request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const result = await analyzeComplexityNode(initialState);

      expect(result.metadata!.requiresDetailedDesign).toBe(true);
      expect(result.metadata!.complexityReason).toBe('Test high complexity judgment');
    });

    test('should work with setupComplexityJudgmentMock helper (low complexity)', async () => {
      // Use the new helper method
      mockProvider.setupComplexityJudgmentMock(
        false,
        'low',
        'Test low complexity judgment'
      );

      const initialState = createInitialState('Test request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const result = await analyzeComplexityNode(initialState);

      expect(result.metadata!.requiresDetailedDesign).toBe(false);
      expect(result.metadata!.complexityReason).toBe('Test low complexity judgment');
    });
  });
});
