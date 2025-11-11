/**
 * TechLeadDesignNode Unit Tests (Jest)
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

// Mock DataPersistence
let mockPersistence: any;
jest.unstable_mockModule('../../../src/utils/DataPersistence.js', () => ({
  DataPersistence: jest.fn().mockImplementation(() => mockPersistence),
}));

// Import after mocking
const { techLeadDesignNode } = await import('../../../src/graph/nodes/TechLeadDesignNode.js');
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

describe('TechLeadDesignNode', () => {
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
      saveDesignDocsMarkdown: jest.fn<any>().mockResolvedValue(undefined),
      saveUIUXWireframes: jest.fn<any>().mockResolvedValue(undefined),
      saveUIUXScreens: jest.fn<any>().mockResolvedValue(undefined),
      saveDatabaseSchema: jest.fn<any>().mockResolvedValue(undefined),
      saveDatabaseERDiagram: jest.fn<any>().mockResolvedValue(undefined),
      saveAPISpec: jest.fn<any>().mockResolvedValue(undefined),
      saveAPISpecMarkdown: jest.fn<any>().mockResolvedValue(undefined),
    };
  });

  describe('Design Document Generation', () => {
    test('should generate all 4 design documents', async () => {
      // Mock AI responses for each design document
      const designDocsResponse = `# Overall Design Document
## Architecture
Layered architecture
## Tech Stack
- Frontend: React
- Backend: Node.js`;

      const uiuxResponse = `# UI/UX Design

\`\`\`markdown:wireframes
# UI/UX Design
## Wireframes
Login screen wireframe
\`\`\`

\`\`\`json:screens
{
  "screens": [
    {
      "id": "screen-1",
      "name": "Login",
      "description": "User login screen"
    }
  ]
}
\`\`\``;

      const dbResponse = `# Database Design

\`\`\`markdown:er-diagram
# Database Design
## ER Diagram
Users table
\`\`\`

\`\`\`json:schema
{
  "tables": [
    {
      "name": "users",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "primaryKey": true
        }
      ]
    }
  ]
}
\`\`\``;

      const apiResponse = `# API Specification

\`\`\`markdown:api-spec
# API Specification
## Endpoints
POST /api/auth/login
\`\`\`

\`\`\`json:api-spec
{
  "openapi": "3.0.0",
  "paths": {
    "/api/auth/login": {
      "post": {
        "summary": "User login"
      }
    }
  }
}
\`\`\``;

      // Set up mock provider to return different responses in sequence
      let callCount = 0;
      mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
        callCount++;
        let response: string;
        if (callCount === 1) response = designDocsResponse;
        else if (callCount === 2) response = uiuxResponse;
        else if (callCount === 3) response = dbResponse;
        else if (callCount === 4) response = apiResponse;
        else response = '';

        yield createMockMessage.assistant(response);
        yield createMockMessage.result(true);
      });

      const fs = await import('fs');
      const path = await import('path');
      const { mkdtempSync } = await import('fs');
      const { tmpdir } = await import('os');

      const tempDir = mkdtempSync(path.join(tmpdir(), 'techlead-design-test-'));
      const worktreesDir = path.join(tempDir, 'worktrees');

      const initialState = createTestState('Implement authentication', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: tempDir,
        worktreeBasePath: worktreesDir,
      });

      const stateWithStoryMapping = {
        ...initialState,
        currentProjectId: 'test-project',
        storyMappingApproved: true,
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
      const result = await techLeadDesignNode(stateWithStoryMapping);

      // Verify all design documents were saved
      expect(mockPersistence.saveDesignDocsMarkdown).toHaveBeenCalledWith(
        'test-project',
        expect.stringContaining('# Overall Design Document')
      );
      expect(mockPersistence.saveUIUXWireframes).toHaveBeenCalledWith(
        'test-project',
        expect.stringContaining('# UI/UX Design')
      );
      expect(mockPersistence.saveUIUXScreens).toHaveBeenCalledWith(
        'test-project',
        expect.objectContaining({
          screens: expect.arrayContaining([
            expect.objectContaining({
              id: 'screen-1',
              name: 'Login',
            }),
          ]),
        })
      );
      expect(mockPersistence.saveDatabaseERDiagram).toHaveBeenCalledWith(
        'test-project',
        expect.stringContaining('# Database Design')
      );
      expect(mockPersistence.saveDatabaseSchema).toHaveBeenCalledWith(
        'test-project',
        expect.objectContaining({
          tables: expect.arrayContaining([
            expect.objectContaining({
              name: 'users',
            }),
          ]),
        })
      );
      expect(mockPersistence.saveAPISpecMarkdown).toHaveBeenCalledWith(
        'test-project',
        expect.stringContaining('# API Specification')
      );
      expect(mockPersistence.saveAPISpec).toHaveBeenCalledWith(
        'test-project',
        expect.objectContaining({
          openapi: '3.0.0',
        })
      );

      // Verify logs
      expect(result.logs).toBeDefined();
      expect(result.logs!.some((log) => log.message.includes('設計書作成完了'))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle AI execution failure', async () => {
      mockProvider.executeAIPrompt = jest.fn<any>().mockRejectedValue(new Error('AI execution failed'));

      const initialState = createTestState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithStoryMapping = {
        ...initialState,
        currentProjectId: 'test-project',
        storyMappingApproved: true,
        storyMapping: {
          persona: {
            name: 'Test User',
            role: 'End User',
            goal: 'Test goal',
          },
          epics: [],
        },
      };

      const result = await techLeadDesignNode(stateWithStoryMapping);

      // Should return error in logs
      expect(result.logs).toBeDefined();
      expect(result.logs!.some((log) => log.level === 'error')).toBe(true);
    });

    test('should handle missing story mapping', async () => {
      mockPersistence.loadStoryMapping.mockResolvedValue(null);

      const initialState = createTestState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithoutStoryMapping = {
        ...initialState,
        currentProjectId: 'test-project',
        storyMappingApproved: true,
      };

      const result = await techLeadDesignNode(stateWithoutStoryMapping);

      // Should return warn log
      expect(result.logs).toBeDefined();
      expect(result.logs!.some((log) => log.level === 'warn' && log.message.includes('ストーリーマッピング'))).toBe(
        true
      );
    });

    test('should handle invalid JSON in AI responses', async () => {
      const invalidResponse = `# Design
\`\`\`json
{ invalid json }
\`\`\``;

      mockProvider.executeAIPrompt = jest.fn<any>().mockResolvedValue(invalidResponse);

      const initialState = createTestState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const stateWithStoryMapping = {
        ...initialState,
        currentProjectId: 'test-project',
        storyMappingApproved: true,
        storyMapping: {
          persona: {
            name: 'Test User',
            role: 'End User',
            goal: 'Test goal',
          },
          epics: [],
        },
      };

      const result = await techLeadDesignNode(stateWithStoryMapping);

      // Should handle gracefully with logs
      expect(result.logs).toBeDefined();
    });
  });

  describe('JSON Extraction', () => {
    test('should extract JSON from code blocks', async () => {
      const designDocsResponse = `# Design Docs
Basic design`;

      const responseWithJson = `# UI/UX Design

\`\`\`markdown:wireframes
# Wireframes
Basic wireframes
\`\`\`

\`\`\`json:screens
{
  "screens": [{"id": "s1", "name": "Home"}]
}
\`\`\``;

      // Mock provider to return design docs first, then UI/UX response
      let callCount = 0;
      mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
        callCount++;
        const response = callCount === 1 ? designDocsResponse : responseWithJson;
        yield createMockMessage.assistant(response);
        yield createMockMessage.result(true);
      });

      const fs = await import('fs');
      const path = await import('path');
      const { mkdtempSync } = await import('fs');
      const { tmpdir } = await import('os');

      const tempDir = mkdtempSync(path.join(tmpdir(), 'techlead-json-test-'));
      const worktreesDir = path.join(tempDir, 'worktrees');

      const initialState = createTestState('Request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: tempDir,
        worktreeBasePath: worktreesDir,
      });

      const stateWithStoryMapping = {
        ...initialState,
        currentProjectId: 'test-project',
        storyMappingApproved: true,
        storyMapping: {
          persona: {
            name: 'Test User',
            role: 'End User',
            goal: 'Test goal',
          },
          epics: [],
        },
      };

      const result = await techLeadDesignNode(stateWithStoryMapping);

      // Verify JSON was extracted and saved
      expect(mockPersistence.saveUIUXScreens).toHaveBeenCalledWith(
        'test-project',
        expect.objectContaining({
          screens: expect.arrayContaining([
            expect.objectContaining({
              id: 's1',
              name: 'Home',
            }),
          ]),
        })
      );
    });
  });
});
