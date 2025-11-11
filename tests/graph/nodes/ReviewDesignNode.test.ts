/**
 * ReviewDesignNode Unit Tests (Jest)
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
    },
  };
});

// Mock DataPersistence
let mockPersistence: any;
jest.unstable_mockModule('../../../src/utils/DataPersistence.js', () => ({
  DataPersistence: jest.fn().mockImplementation(() => mockPersistence),
}));

// Mock fs/promises
let mockReadFile: any;
jest.unstable_mockModule('fs/promises', () => ({
  readFile: jest.fn<any>((path) => {
    // Default behavior: return valid content
    if (mockReadFile) {
      return mockReadFile(path);
    }
    return Promise.resolve('# Design Document\nContent here');
  }),
}));

// Import after mocking
const { reviewDesignNode } = await import('../../../src/graph/nodes/ReviewDesignNode.js');
const { createInitialState } = await import('../../../src/graph/state.js');
const { MockAIProvider, createMockMessage } = await import(
  '../../../src/providers/MockAIProvider.js'
);
const { AIProviderFactory } = await import('../../../src/providers/AIProviderFactory.js');

// Test helper to create state with currentProjectId
function createTestState(userRequest: string, config: any) {
  const state = createInitialState(userRequest, config);
  state.currentProjectId = 'test-project-001';
  return state;
}

describe('ReviewDesignNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Reset fs mock to default behavior
    mockReadFile = null;

    // Create fresh mock provider
    mockProvider = new MockAIProvider();
    (AIProviderFactory.create as any).mockReturnValue(mockProvider);

    // Create fresh mock persistence
    mockPersistence = {
      initialize: jest.fn<any>().mockResolvedValue(undefined),
      projectsDir: '/test/.kugutsu/projects',
      loadStoryMapping: jest.fn<any>().mockResolvedValue({
        persona: {
          name: 'Test User',
          role: 'End User',
          goal: 'Test goal',
        },
        epics: [],
      }),
      loadDesignReviewHistory: jest.fn<any>().mockResolvedValue([]),
      saveDesignReviewHistory: jest.fn<any>().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    // Reset fs mock
    mockReadFile = null;
    // Additional cleanup
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Design Review', () => {
    test('should approve design when all reviewers approve', async () => {
      // Mock 3-party review responses (all approve)
      const directorReview = {
        approved: true,
        issues: [],
        suggestions: ['Good design'],
        overallAssessment: 'Approved',
      };

      const productOwnerReview = {
        approved: true,
        issues: [],
        suggestions: [],
        overallAssessment: 'Approved',
      };

      const techLeadReview = {
        approved: true,
        issues: [],
        suggestions: [],
        overallAssessment: 'Approved',
      };

      // Mock execute to return different responses for each reviewer
      let callCount = 0;
      mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
        callCount++;
        let response: any;
        if (callCount === 1) response = directorReview;
        else if (callCount === 2) response = productOwnerReview;
        else response = techLeadReview;

        const jsonResponse = '```json\n' + JSON.stringify(response, null, 2) + '\n```';
        yield createMockMessage.assistant(jsonResponse);
        yield createMockMessage.result(true);
      });

      const initialState = createTestState('Implement authentication', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithDesignDocs = {
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
        designDocs: {
          designDocsPath: '.kugutsu/projects/test-project/design/design-docs.md',
          uiuxPath: '.kugutsu/projects/test-project/design/wireframes.md',
          databasePath: '.kugutsu/projects/test-project/design/er-diagram.md',
          apiPath: '.kugutsu/projects/test-project/design/api-spec.md',
        },
      };

      // Execute node
      const result = await reviewDesignNode(stateWithDesignDocs);

      // Verify approval (no reviewFeedback when approved)
      expect(result.reviewFeedback).toBeUndefined();
      expect(result.logs).toBeDefined();
      expect(result.logs!.some((log) => log.message.includes('承認'))).toBe(true);

      // Verify persistence calls
      expect(mockPersistence.saveDesignReviewHistory).toHaveBeenCalled();
    });

    test('should reject design when critical issues found', async () => {
      // Mock review with critical issues
      const directorReview = {
        approved: false,
        issues: [
          {
            severity: 'critical',
            category: 'architecture',
            message: 'Architecture mismatch',
          },
        ],
        suggestions: ['Fix architecture'],
        overallAssessment: 'Needs work',
      };

      const productOwnerReview = {
        approved: true,
        issues: [],
        suggestions: [],
        overallAssessment: 'Approved',
      };

      const techLeadReview = {
        approved: true,
        issues: [],
        suggestions: [],
        overallAssessment: 'Approved',
      };

      let callCount = 0;
      mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
        callCount++;
        let response: any;
        if (callCount === 1) response = directorReview;
        else if (callCount === 2) response = productOwnerReview;
        else response = techLeadReview;

        const jsonResponse = '```json\n' + JSON.stringify(response, null, 2) + '\n```';
        yield createMockMessage.assistant(jsonResponse);
        yield createMockMessage.result(true);
      });

      const initialState = createTestState('Implement authentication', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithDesignDocs = {
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
        designDocs: {
          designDocsPath: '.kugutsu/projects/test-project/design/design-docs.md',
        },
      };

      const result = await reviewDesignNode(stateWithDesignDocs);

      // Verify rejection
      expect(result.reviewFeedback).toBeDefined();
      expect(result.reviewFeedback!.issues.length).toBeGreaterThan(0);
      expect(result.reviewFeedback!.issues[0].severity).toBe('critical');
      expect(result.logs).toBeDefined();
      expect(result.logs!.some((log) => log.message.includes('修正'))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing design docs', async () => {
      // Mock fs.readFile to throw error for missing files
      mockReadFile = jest.fn<any>().mockRejectedValue(new Error('File not found'));

      const initialState = createTestState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithoutDesignDocs = {
        ...initialState,
        currentProjectId: 'test-project',
      };

      const result = await reviewDesignNode(stateWithoutDesignDocs);

      // Should return warn
      expect(result.logs).toBeDefined();
      expect(result.logs!.some((log) => log.level === 'warn' && log.message.includes('設計書'))).toBe(true);
    });

    test('should handle AI execution failure', async () => {
      // Mock invalid AI response
      mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
        yield createMockMessage.assistant('Invalid response');
        yield createMockMessage.result(true);
      });

      const initialState = createTestState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithDesignDocs = {
        ...initialState,
        currentProjectId: 'test-project',
        designDocs: {
          designDocsPath: '.kugutsu/projects/test-project/design/design-docs.md',
        },
      };

      const result = await reviewDesignNode(stateWithDesignDocs);

      // Should reject due to parsing failure
      expect(result.logs).toBeDefined();
      expect(result.reviewFeedback).toBeDefined();
    });
  });

  describe('Review Consolidation', () => {
    test('should consolidate issues from multiple reviewers', async () => {
      const directorReview = {
        approved: false,
        issues: [
          {
            severity: 'critical',
            category: 'documentation',
            message: 'Critical doc issue',
          },
        ],
        suggestions: [],
        overallAssessment: 'Needs revision',
      };

      const productOwnerReview = {
        approved: true,
        issues: [
          {
            severity: 'minor',
            category: 'usability',
            message: 'Consider this',
          },
        ],
        suggestions: [],
        overallAssessment: 'Approved',
      };

      const techLeadReview = {
        approved: true,
        issues: [],
        suggestions: [],
        overallAssessment: 'Approved',
      };

      let callCount = 0;
      mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
        callCount++;
        let response: any;
        if (callCount === 1) response = directorReview;
        else if (callCount === 2) response = productOwnerReview;
        else response = techLeadReview;

        const jsonResponse = '```json\n' + JSON.stringify(response, null, 2) + '\n```';
        yield createMockMessage.assistant(jsonResponse);
        yield createMockMessage.result(true);
      });

      const initialState = createTestState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithDesignDocs = {
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
        designDocs: {
          designDocsPath: '.kugutsu/projects/test-project/design/design-docs.md',
        },
      };

      const result = await reviewDesignNode(stateWithDesignDocs);

      // Verify issues are consolidated (critical + minor, no info issues in reviewFeedback)
      expect(result.reviewFeedback).toBeDefined();
      expect(result.reviewFeedback!.issues.length).toBeGreaterThanOrEqual(1);
      expect(result.reviewFeedback!.issues.some((i) => i.severity === 'critical')).toBe(true);
    });
  });
});
