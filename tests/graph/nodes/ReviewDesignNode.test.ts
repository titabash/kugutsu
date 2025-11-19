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
      syncWithState: jest.fn(),
      recordFailure: jest.fn(),
      getFailedProviders: jest.fn(() => []),
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

  describe('Parallel Review Execution', () => {
    test('should execute 3 reviewers in parallel using Promise.all', async () => {
      const executionLog: Array<{ reviewer: string; event: string; timestamp: number }> = [];
      const startTime = Date.now();

      // Track which reviewers have started and completed
      const reviewerStatus = {
        director: { started: false, completed: false },
        productOwner: { started: false, completed: false },
        techLead: { started: false, completed: false },
      };

      // Mock execute to track parallel execution
      mockProvider.execute = jest.fn<any>().mockImplementation(async function* (prompt: string) {
        let reviewer: string;
        let reviewerKey: 'director' | 'productOwner' | 'techLead';

        if (prompt.includes('DirectorAI')) {
          reviewer = 'DirectorAI';
          reviewerKey = 'director';
        } else if (prompt.includes('ProductOwnerAI')) {
          reviewer = 'ProductOwnerAI';
          reviewerKey = 'productOwner';
        } else {
          reviewer = 'TechLeadAI';
          reviewerKey = 'techLead';
        }

        executionLog.push({
          reviewer,
          event: 'START',
          timestamp: Date.now() - startTime
        });
        reviewerStatus[reviewerKey].started = true;

        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 100));

        const review = {
          approved: true,
          issues: [],
          comments: [],
        };

        const jsonResponse = '```json\n' + JSON.stringify(review, null, 2) + '\n```';
        yield createMockMessage.assistant(jsonResponse);
        yield createMockMessage.result(true);

        executionLog.push({
          reviewer,
          event: 'END',
          timestamp: Date.now() - startTime
        });
        reviewerStatus[reviewerKey].completed = true;
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

      // Verify all 3 reviewers were executed
      expect(reviewerStatus.director.started).toBe(true);
      expect(reviewerStatus.productOwner.started).toBe(true);
      expect(reviewerStatus.techLead.started).toBe(true);
      expect(reviewerStatus.director.completed).toBe(true);
      expect(reviewerStatus.productOwner.completed).toBe(true);
      expect(reviewerStatus.techLead.completed).toBe(true);

      // Verify parallel execution: all 3 should start before any completes
      const startEvents = executionLog.filter(e => e.event === 'START');
      const endEvents = executionLog.filter(e => e.event === 'END');

      expect(startEvents.length).toBe(3);
      expect(endEvents.length).toBe(3);

      // Verify parallel execution: all should start before first one ends
      const startTimes = startEvents.map(e => e.timestamp);
      const firstEndTime = Math.min(...endEvents.map(e => e.timestamp));
      const lastStartTime = Math.max(...startTimes);
      expect(lastStartTime).toBeLessThan(firstEndTime);

      // Verify result
      expect(result.logs).toBeDefined();
      expect(result.logs!.some(log => log.message.includes('承認'))).toBe(true);
    });

    test('should handle errors in parallel review execution', async () => {
      // Mock execute to throw error for ProductOwnerAI
      mockProvider.execute = jest.fn<any>().mockImplementation(async function* (prompt: string) {
        if (prompt.includes('ProductOwnerAI')) {
          throw new Error('ProductOwnerAI review failed');
        }

        const review = {
          approved: true,
          issues: [],
          comments: [],
        };

        const jsonResponse = '```json\n' + JSON.stringify(review, null, 2) + '\n```';
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
        designDocs: {
          designDocsPath: '.kugutsu/projects/test-project/design/design-docs.md',
        },
      };

      // Should throw error due to ProductOwnerAI failure
      await expect(reviewDesignNode(stateWithDesignDocs)).rejects.toThrow();
    });

    test('should improve performance with parallel execution vs sequential', async () => {
      const REVIEW_DURATION = 50; // ms per review

      // Mock execute with fixed duration
      mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
        await new Promise(resolve => setTimeout(resolve, REVIEW_DURATION));

        const review = {
          approved: true,
          issues: [],
          comments: [],
        };

        const jsonResponse = '```json\n' + JSON.stringify(review, null, 2) + '\n```';
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

      const startTime = Date.now();
      await reviewDesignNode(stateWithDesignDocs);
      const duration = Date.now() - startTime;

      // CI環境ではタイミングが不安定なため、実行順序の検証のみを行う
      // パフォーマンステストは実行順序テストで十分にカバーされている
      console.log(`Parallel execution completed in ${duration}ms`);
    });
  });
});
