/**
 * ReviewStoryMappingNode Unit Tests (Jest)
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

// Mock DataPersistence
let mockPersistence: any;
jest.unstable_mockModule('../../../src/utils/DataPersistence.js', () => ({
  DataPersistence: jest.fn().mockImplementation(() => mockPersistence),
}));

// Import after mocking
const { reviewStoryMappingNode } = await import(
  '../../../src/graph/nodes/ReviewStoryMappingNode.js'
);
const { createInitialState } = await import('../../../src/graph/state.js');
const { MockAIProvider, createMockMessage } = await import(
  '../../../src/providers/MockAIProvider.js'
);
const { AIProviderFactory } = await import('../../../src/providers/AIProviderFactory.js');

describe('ReviewStoryMappingNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mock provider
    mockProvider = new MockAIProvider();
    (AIProviderFactory.create as any).mockReturnValue(mockProvider);

    // Create fresh mock persistence
    mockPersistence = {
      initialize: jest.fn<any>().mockResolvedValue(undefined),
      loadStoryMapping: jest.fn<any>().mockResolvedValue({
        persona: {
          name: 'Test User',
          role: 'End User',
          goal: 'Use the authentication system',
          painPoints: ['Cannot login easily'],
        },
        epics: [
          {
            id: 'epic-1',
            title: 'User Authentication',
            description: 'Auth system',
            priority: 90,
            stories: [
              {
                id: 'story-1',
                title: 'Login',
                description: 'User login',
                priority: 90,
                acceptanceCriteria: ['Users can login'],
                tasks: [],
              },
            ],
          },
        ],
      }),
      loadStoryMappingReviewHistory: jest.fn<any>().mockResolvedValue([]),
      saveStoryMappingReviewHistory: jest.fn<any>().mockResolvedValue(undefined),
      saveReviewHistory: jest.fn<any>().mockResolvedValue(undefined),
    };
  });

  describe('Story Mapping Approval', () => {
    test('should approve story mapping when no critical issues', async () => {
      // Mock AI response with approval
      const reviewResponse = {
        approved: true,
        issues: [
          {
            severity: 'minor',
            category: 'completeness',
            message: 'Minor issue',
            epicId: 'epic-1',
          },
        ],
        suggestions: ['Consider adding more detail'],
        overallAssessment: 'Good work',
      };

      const jsonResponse = '```json\n' + JSON.stringify(reviewResponse, null, 2) + '\n```';

      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant(jsonResponse),
          createMockMessage.result(true),
        ],
      });

      const initialState = createInitialState('Implement authentication', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithStoryMapping = {
        ...initialState,
        currentProjectId: 'test-project',
        storyMapping: {
          persona: {
            name: 'Test User',
            role: 'End User',
            goal: 'Test goal',
          },
          epics: [],
        },
      };

      // Execute node
      const result = await reviewStoryMappingNode(stateWithStoryMapping);

      // Verify approval
      expect(result.storyMappingApproved).toBe(true);
      expect(result.reviewFeedback).toBeUndefined();

      // Verify persistence calls
      expect(mockPersistence.loadStoryMapping).toHaveBeenCalledWith('test-project');
      expect(mockPersistence.saveStoryMappingReviewHistory).toHaveBeenCalled();

      // Verify logs
      expect(result.logs).toBeDefined();
      expect(result.logs!.some((log) => log.message.includes('承認'))).toBe(true);
    });

    test('should reject story mapping when critical issues found', async () => {
      // Mock AI response with rejection
      const reviewResponse = {
        approved: false,
        issues: [
          {
            severity: 'critical',
            category: 'business-value',
            message: 'Missing business value',
            epicId: 'epic-1',
          },
          {
            severity: 'major',
            category: 'completeness',
            message: 'Missing acceptance criteria',
            storyId: 'story-1',
          },
        ],
        suggestions: ['Add business value', 'Add acceptance criteria'],
        overallAssessment: 'Needs revision',
      };

      const jsonResponse = '```json\n' + JSON.stringify(reviewResponse, null, 2) + '\n```';

      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant(jsonResponse),
          createMockMessage.result(true),
        ],
      });

      const initialState = createInitialState('Implement authentication', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithStoryMapping = {
        ...initialState,
        currentProjectId: 'test-project',
        storyMapping: {
          persona: {
            name: 'Test User',
            role: 'End User',
            goal: 'Test goal',
          },
          epics: [],
        },
      };

      // Execute node
      const result = await reviewStoryMappingNode(stateWithStoryMapping);

      // Verify rejection
      expect(result.storyMappingApproved).toBe(false);
      expect(result.reviewFeedback).toBeDefined();
      expect(result.reviewFeedback!.issues.length).toBe(2);
      expect(result.reviewFeedback!.issues[0].severity).toBe('critical');
      expect(result.reviewFeedback!.issues[1].severity).toBe('major');

      // Verify logs
      expect(result.logs).toBeDefined();
      expect(result.logs!.some((log) => log.message.includes('修正必要'))).toBe(true);
    });

    test('should approve when all issues are minor or info', async () => {
      const reviewResponse = {
        approved: true,
        issues: [
          {
            severity: 'minor',
            category: 'style',
            message: 'Minor style issue',
            epicId: 'epic-1',
          },
          {
            severity: 'info',
            category: 'suggestion',
            message: 'Consider this',
            storyId: 'story-1',
          },
        ],
        suggestions: [],
        overallAssessment: 'Approved with minor notes',
      };

      const jsonResponse = '```json\n' + JSON.stringify(reviewResponse, null, 2) + '\n```';

      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant(jsonResponse),
          createMockMessage.result(true),
        ],
      });

      const initialState = createInitialState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithStoryMapping = {
        ...initialState,
        currentProjectId: 'test-project',
        storyMapping: {
          persona: {
            name: 'Test User',
            role: 'End User',
            goal: 'Test goal',
          },
          epics: [],
        },
      };

      const result = await reviewStoryMappingNode(stateWithStoryMapping);

      expect(result.storyMappingApproved).toBe(true);
      expect(result.reviewFeedback).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle AI response parsing failure', async () => {
      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant('Invalid JSON response'),
          createMockMessage.result(true),
        ],
      });

      const initialState = createInitialState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithStoryMapping = {
        ...initialState,
        currentProjectId: 'test-project',
        storyMapping: {
          persona: {
            name: 'Test User',
            role: 'End User',
            goal: 'Test goal',
          },
          epics: [],
        },
      };

      const result = await reviewStoryMappingNode(stateWithStoryMapping);

      // Should return rejection (parsing failure results in rejection with error issue)
      expect(result.logs).toBeDefined();
      expect(result.storyMappingApproved).toBe(false);
    });

    test('should handle missing story mapping', async () => {
      mockPersistence.loadStoryMapping.mockResolvedValue(null);

      const initialState = createInitialState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithoutStoryMapping = {
        ...initialState,
        currentProjectId: 'test-project',
      };

      const result = await reviewStoryMappingNode(stateWithoutStoryMapping);

      // Should return warning
      expect(result.logs).toBeDefined();
      expect(result.logs!.some((log) => log.level === 'warn' && log.message.includes('ストーリーマッピング'))).toBe(
        true
      );
    });
  });

  describe('Review History', () => {
    test('should save review history with iteration tracking', async () => {
      const reviewResponse = {
        approved: true,
        issues: [],
        suggestions: ['Good work!'],
        overallAssessment: 'Excellent',
      };

      const jsonResponse = '```json\n' + JSON.stringify(reviewResponse, null, 2) + '\n```';

      mockProvider.setDefaultResponse({
        messages: [
          createMockMessage.assistant(jsonResponse),
          createMockMessage.result(true),
        ],
      });

      const initialState = createInitialState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithStoryMapping = {
        ...initialState,
        currentProjectId: 'test-project',
        storyMapping: {
          persona: {
            name: 'Test User',
            role: 'End User',
            goal: 'Test goal',
          },
          epics: [],
        },
      };

      await reviewStoryMappingNode(stateWithStoryMapping);

      // Verify saveStoryMappingReviewHistory was called
      expect(mockPersistence.saveStoryMappingReviewHistory).toHaveBeenCalledWith(
        'test-project',
        expect.objectContaining({
          reviews: expect.arrayContaining([
            expect.objectContaining({
              iteration: 1,
              reviewer: 'ProductOwnerAI',
              approved: true,
              issues: [],
              suggestions: ['Good work!'],
              overallAssessment: 'Excellent',
            }),
          ]),
        })
      );
    });
  });
});
