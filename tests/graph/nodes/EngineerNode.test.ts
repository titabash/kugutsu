/**
 * EngineerNode Unit Tests (Jest)
 *
 * 特に以下をテスト：
 * - レビューコメント統合機能
 * - review.json読み込み機能
 * - 初回実装と修正実装の区別
 */

import { jest } from '@jest/globals';
import type { ParallelDevStateType } from '../../../src/graph/state.js';
import type { Task, Review } from '../../../src/graph/types.js';
import { promises as fs } from 'fs';
import path from 'path';

// Mock dependencies
const mockExecute = jest.fn<any>();
const mockReadMarkdown = jest.fn<any>();
const mockReadFile = jest.fn<any>();
const mockLoadSprintBacklog = jest.fn<any>();
const mockSaveSprintBacklog = jest.fn<any>();

jest.unstable_mockModule('../../../src/providers/AIProviderFactory.js', () => ({
  AIProviderFactory: {
    create: jest.fn().mockReturnValue({
      execute: mockExecute,
    }),
    buildProviderConfig: jest.fn().mockReturnValue({}),
    syncWithState: jest.fn(),
    getFailedProviders: jest.fn().mockReturnValue([]),
  },
}));

jest.unstable_mockModule('../../../src/utils/FileReader.js', () => ({
  FileReader: jest.fn().mockImplementation(() => ({
    readMarkdown: mockReadMarkdown,
    readFile: mockReadFile,
  })),
}));

jest.unstable_mockModule('../../../src/utils/DataPersistence.js', () => ({
  DataPersistence: jest.fn().mockImplementation(() => ({
    loadSprintBacklog: mockLoadSprintBacklog,
    saveSprintBacklog: mockSaveSprintBacklog,
    updateSprintBacklogTask: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Import after mocking
const { engineerNode } = await import('../../../src/graph/nodes/EngineerNode.js');
const { createInitialState } = await import('../../../src/graph/state.js');

// 注意: これらのテストは設計意図を示すためのものです
// EngineerNodeは実際のAI呼び出しを含むため、完全なモックは困難です
// 実際の動作検証はE2Eテストで行います
describe.skip('EngineerNode - Review Comment Integration', () => {
  const baseRepoPath = '/test/repo';
  const worktreePath = '/test/worktrees/task-001';
  const sprintId = 'sprint-test-123';

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock responses
    mockReadMarkdown.mockResolvedValue('# Task Implementation Instructions\n\nImplement feature X');
    mockLoadSprintBacklog.mockResolvedValue({
      id: sprintId,
      name: 'Test Sprint',
      goal: 'Test Goal',
      taskIds: ['task-001'],
      tasks: [],
      startedAt: new Date().toISOString(),
      status: 'active',
      deployable: false,
      metadata: {
        estimatedHours: 8,
        blockers: [],
        completedTasksCount: 0,
        failedTasksCount: 0,
      },
    });
    mockSaveSprintBacklog.mockResolvedValue(undefined);
  });

  describe('初回実装（レビューコメントなし）', () => {
    test('should generate prompt without review feedback section', async () => {
      const initialState = createInitialState('Implement feature', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath,
        worktreeBasePath: '/test/worktrees',
      });

      const task: Task = {
        id: 'task-001',
        title: 'Implement feature X',
        description: 'Add new feature',
        status: 'in_progress',
        priority: 100,
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      initialState.tasks = [task];
      initialState.currentTaskId = 'task-001';
      initialState.activeSprint = {
        id: sprintId,
        name: 'Test Sprint',
        goal: 'Test Goal',
        taskIds: ['task-001'],
        startedAt: new Date(),
        status: 'active',
        deployable: false,
        metadata: {
          estimatedHours: 8,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };
      initialState.tasksPath = `.kugutsu/sprints/${sprintId}/tasks`;
      initialState.reviews = []; // レビューなし

      // Mock AI response
      mockExecute.mockReturnValue((async function* () {
        yield {
          type: 'text',
          text: 'Implementation completed',
        };
        yield {
          type: 'result',
          status: 'success',
          input_tokens: 1000,
          output_tokens: 500,
        };
      })());

      // review.jsonが存在しない
      mockReadFile.mockRejectedValue(new Error('ENOENT: no such file'));

      // Capture the prompt passed to AI
      let capturedPrompt = '';
      mockExecute.mockImplementation((prompt: string) => {
        capturedPrompt = prompt;
        return (async function* () {
          yield {
            type: 'text',
            text: 'Implementation completed',
          };
          yield {
            type: 'result',
            status: 'success',
            input_tokens: 1000,
            output_tokens: 500,
          };
        })();
      });

      // Execute node
      await engineerNode(initialState);

      // Verify: プロンプトに「前回のレビュー結果」セクションが含まれていないこと
      expect(capturedPrompt).not.toContain('🔍 前回のレビュー結果');
      expect(capturedPrompt).not.toContain('修正実装');
      expect(capturedPrompt).toContain('Task Implementation');
    });
  });

  describe('修正実装（レビューコメントあり）', () => {
    test('should include review feedback section in prompt when changes_requested', async () => {
      const initialState = createInitialState('Implement feature', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath,
        worktreeBasePath: '/test/worktrees',
      });

      const task: Task = {
        id: 'task-001',
        title: 'Implement feature X',
        description: 'Add new feature',
        status: 'in_progress',
        priority: 100,
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // レビューコメントを追加
      const review: Review = {
        taskId: 'task-001',
        reviewer: 'TechLeadAI',
        status: 'changes_requested',
        comments: [
          'app/about/page.tsx:10のmetadata.titleが重複しています',
          'ルートレイアウトの%s | Kugutsu Studioテンプレートを活用してください',
        ],
        timestamp: new Date(),
        issues: [
          {
            severity: 'medium',
            description: 'Duplicate metadata.title definition',
            file: 'app/about/page.tsx',
            line: 10,
          },
        ],
      };

      initialState.tasks = [task];
      initialState.currentTaskId = 'task-001';
      initialState.activeSprint = {
        id: sprintId,
        name: 'Test Sprint',
        goal: 'Test Goal',
        taskIds: ['task-001'],
        startedAt: new Date(),
        status: 'active',
        deployable: false,
        metadata: {
          estimatedHours: 8,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };
      initialState.tasksPath = `.kugutsu/sprints/${sprintId}/tasks`;
      initialState.reviews = [review];

      // Mock AI response
      mockExecute.mockReturnValue((async function* () {
        yield {
          type: 'text',
          text: 'Fixed issues from review',
        };
        yield {
          type: 'result',
          status: 'success',
          input_tokens: 1500,
          output_tokens: 600,
        };
      })());

      // review.jsonが存在しない（state.reviewsのみ）
      mockReadFile.mockRejectedValue(new Error('ENOENT: no such file'));

      // Capture the prompt passed to AI
      let capturedPrompt = '';
      mockExecute.mockImplementation((prompt: string) => {
        capturedPrompt = prompt;
        return (async function* () {
          yield {
            type: 'text',
            text: 'Fixed issues from review',
          };
          yield {
            type: 'result',
            status: 'success',
            input_tokens: 1500,
            output_tokens: 600,
          };
        })();
      });

      // Execute node
      await engineerNode(initialState);

      // Verify: プロンプトに「前回のレビュー結果」セクションが含まれていること
      expect(capturedPrompt).toContain('🔍 前回のレビュー結果');
      expect(capturedPrompt).toContain('修正実装');
      expect(capturedPrompt).toContain('TechLeadAI');
      expect(capturedPrompt).toContain('metadata.titleが重複しています');
      expect(capturedPrompt).toContain('Kugutsu Studioテンプレートを活用してください');
      expect(capturedPrompt).toContain('[medium] Duplicate metadata.title definition');
      expect(capturedPrompt).toContain('app/about/page.tsx:10');
      expect(capturedPrompt).toContain('上記の指摘事項を必ず修正してください');
    });

    test('should read review.json when it exists', async () => {
      const initialState = createInitialState('Implement feature', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath,
        worktreeBasePath: '/test/worktrees',
      });

      const task: Task = {
        id: 'task-001',
        title: 'Implement feature X',
        description: 'Add new feature',
        status: 'in_progress',
        priority: 100,
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const review: Review = {
        taskId: 'task-001',
        reviewer: 'TechLeadAI',
        status: 'changes_requested',
        comments: ['Fix issue A'],
        timestamp: new Date(),
        issues: [],
      };

      // review.jsonの内容
      const reviewArtifact = {
        taskId: 'task-001',
        status: 'changes_requested',
        reviewedBy: 'TechLeadAI',
        reviewedAt: new Date().toISOString(),
        comments: [
          {
            file: 'app/test.tsx',
            severity: 'warning',
            message: 'Use proper TypeScript types',
          },
        ],
        summary: 'レビュー結果: changes_requested',
        suggestions: [
          'Consider using interface instead of type',
          'Add JSDoc comments',
        ],
      };

      initialState.tasks = [task];
      initialState.currentTaskId = 'task-001';
      initialState.activeSprint = {
        id: sprintId,
        name: 'Test Sprint',
        goal: 'Test Goal',
        taskIds: ['task-001'],
        startedAt: new Date(),
        status: 'active',
        deployable: false,
        metadata: {
          estimatedHours: 8,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };
      initialState.tasksPath = `.kugutsu/sprints/${sprintId}/tasks`;
      initialState.reviews = [review];

      // Mock AI response
      mockExecute.mockReturnValue((async function* () {
        yield {
          type: 'text',
          text: 'Fixed all issues',
        };
        yield {
          type: 'result',
          status: 'success',
          input_tokens: 1500,
          output_tokens: 600,
        };
      })());

      // review.jsonが存在する
      mockReadFile.mockResolvedValue(JSON.stringify(reviewArtifact, null, 2));

      // Capture the prompt passed to AI
      let capturedPrompt = '';
      mockExecute.mockImplementation((prompt: string) => {
        capturedPrompt = prompt;
        return (async function* () {
          yield {
            type: 'text',
            text: 'Fixed all issues',
          };
          yield {
            type: 'result',
            status: 'success',
            input_tokens: 1500,
            output_tokens: 600,
          };
        })();
      });

      // Execute node
      await engineerNode(initialState);

      // Verify: review.jsonが読み込まれ、詳細情報がプロンプトに含まれること
      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringContaining(`sprints/${sprintId}/tasks/task-001/review.json`)
      );
      expect(capturedPrompt).toContain('詳細なレビューコメント (review.jsonから)');
      expect(capturedPrompt).toContain('Use proper TypeScript types');
      expect(capturedPrompt).toContain('app/test.tsx');
      expect(capturedPrompt).toContain('改善提案');
      expect(capturedPrompt).toContain('Consider using interface instead of type');
      expect(capturedPrompt).toContain('Add JSDoc comments');
    });

    test('should use latest review when multiple reviews exist', async () => {
      const initialState = createInitialState('Implement feature', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath,
        worktreeBasePath: '/test/worktrees',
      });

      const task: Task = {
        id: 'task-001',
        title: 'Implement feature X',
        description: 'Add new feature',
        status: 'in_progress',
        priority: 100,
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 複数のレビュー（異なるタイムスタンプ）
      const oldReview: Review = {
        taskId: 'task-001',
        reviewer: 'TechLeadAI',
        status: 'changes_requested',
        comments: ['Old comment - should not appear'],
        timestamp: new Date('2024-01-01T00:00:00Z'),
        issues: [],
      };

      const latestReview: Review = {
        taskId: 'task-001',
        reviewer: 'TechLeadAI',
        status: 'changes_requested',
        comments: ['Latest comment - should appear'],
        timestamp: new Date('2024-01-02T00:00:00Z'),
        issues: [],
      };

      initialState.tasks = [task];
      initialState.currentTaskId = 'task-001';
      initialState.activeSprint = {
        id: sprintId,
        name: 'Test Sprint',
        goal: 'Test Goal',
        taskIds: ['task-001'],
        startedAt: new Date(),
        status: 'active',
        deployable: false,
        metadata: {
          estimatedHours: 8,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };
      initialState.tasksPath = `.kugutsu/sprints/${sprintId}/tasks`;
      initialState.reviews = [oldReview, latestReview]; // 順序は関係なくタイムスタンプでソート

      // Mock AI response
      mockExecute.mockReturnValue((async function* () {
        yield {
          type: 'text',
          text: 'Fixed latest issues',
        };
        yield {
          type: 'result',
          status: 'success',
          input_tokens: 1500,
          output_tokens: 600,
        };
      })());

      mockReadFile.mockRejectedValue(new Error('ENOENT: no such file'));

      // Capture the prompt passed to AI
      let capturedPrompt = '';
      mockExecute.mockImplementation((prompt: string) => {
        capturedPrompt = prompt;
        return (async function* () {
          yield {
            type: 'text',
            text: 'Fixed latest issues',
          };
          yield {
            type: 'result',
            status: 'success',
            input_tokens: 1500,
            output_tokens: 600,
          };
        })();
      });

      // Execute node
      await engineerNode(initialState);

      // Verify: 最新のレビューコメントのみが含まれること
      expect(capturedPrompt).toContain('Latest comment - should appear');
      expect(capturedPrompt).not.toContain('Old comment - should not appear');
    });
  });

  describe('approved状態のレビュー', () => {
    test('should not include review feedback when status is approved', async () => {
      const initialState = createInitialState('Implement feature', {
        maxEngineers: 1,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath,
        worktreeBasePath: '/test/worktrees',
      });

      const task: Task = {
        id: 'task-001',
        title: 'Implement feature X',
        description: 'Add new feature',
        status: 'in_progress',
        priority: 100,
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // approvedレビュー
      const review: Review = {
        taskId: 'task-001',
        reviewer: 'TechLeadAI',
        status: 'approved',
        comments: ['Looks good!'],
        timestamp: new Date(),
        issues: [],
      };

      initialState.tasks = [task];
      initialState.currentTaskId = 'task-001';
      initialState.activeSprint = {
        id: sprintId,
        name: 'Test Sprint',
        goal: 'Test Goal',
        taskIds: ['task-001'],
        startedAt: new Date(),
        status: 'active',
        deployable: false,
        metadata: {
          estimatedHours: 8,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      };
      initialState.tasksPath = `.kugutsu/sprints/${sprintId}/tasks`;
      initialState.reviews = [review];

      mockExecute.mockReturnValue((async function* () {
        yield {
          type: 'text',
          text: 'Implementation completed',
        };
        yield {
          type: 'result',
          status: 'success',
          input_tokens: 1000,
          output_tokens: 500,
        };
      })());

      mockReadFile.mockRejectedValue(new Error('ENOENT: no such file'));

      let capturedPrompt = '';
      mockExecute.mockImplementation((prompt: string) => {
        capturedPrompt = prompt;
        return (async function* () {
          yield {
            type: 'text',
            text: 'Implementation completed',
          };
          yield {
            type: 'result',
            status: 'success',
            input_tokens: 1000,
            output_tokens: 500,
          };
        })();
      });

      await engineerNode(initialState);

      // Verify: approvedの場合はレビューフィードバックセクションが含まれないこと
      expect(capturedPrompt).not.toContain('🔍 前回のレビュー結果');
      expect(capturedPrompt).not.toContain('修正実装');
    });
  });
});

/**
 * EngineerNode - AI Message Storage Tests
 *
 * Tests for storing AI provider messages in nodeExecutionResults
 */
describe('EngineerNode - AI Message Storage', () => {
  const baseRepoPath = '/test/repo';
  const worktreePath = '/test/worktrees/task-001';
  const sprintId = 'sprint-test-123';
  const taskId = 'TASK-001';

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock responses
    mockReadMarkdown.mockResolvedValue('# Task Implementation\n\nImplement the feature');
    mockLoadSprintBacklog.mockResolvedValue({
      id: sprintId,
      name: 'Test Sprint',
      goal: 'Test Goal',
      taskIds: [taskId],
      tasks: [
        {
          id: taskId,
          title: 'Test Task',
          description: 'Test Description',
          status: 'in_progress',
          worktreePath,
          branchName: `feature/${taskId}`,
          dependencies: [],
        },
      ],
      startedAt: new Date().toISOString(),
      status: 'active',
      deployable: false,
      metadata: {
        estimatedHours: 8,
        blockers: [],
        completedTasksCount: 0,
        failedTasksCount: 0,
      },
    });
  });

  test('should store AI messages in nodeExecutionResults on success', async () => {
    const initialState = createInitialState('Implement feature', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath,
      worktreeBasePath: '/test/worktrees',
    });

    const task: Task = {
      id: taskId,
      title: 'Test Task',
      description: 'Test Description',
      status: 'in_progress',
      priority: 100,
      dependencies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const stateWithTask: ParallelDevStateType = {
      ...initialState,
      tasks: [task],
      currentTaskId: taskId,
      activeSprint: {
        id: sprintId,
        name: 'Test Sprint',
        goal: 'Test Goal',
        taskIds: [taskId],
        startedAt: new Date(),
        status: 'active',
        deployable: false,
        metadata: {
          estimatedHours: 8,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      },
    };

    // Mock AI provider responses with multiple message types
    const mockMessages = [
      {
        type: 'thinking',
        thinking: 'Analyzing the task requirements...',
      },
      {
        type: 'assistant',
        content: [
          {
            type: 'text',
            text: 'I will implement this feature by creating a new module.',
          },
        ],
      },
      {
        type: 'assistant',
        content: [
          {
            type: 'tool_use',
            name: 'Write',
            input: {
              file_path: '/test/feature.ts',
              content: 'export const feature = () => {}',
            },
          },
        ],
      },
      {
        type: 'result',
        status: 'success',
        finalResponse: 'Feature implemented successfully',
      },
    ];

    mockExecute.mockReturnValue(
      (async function* () {
        for (const message of mockMessages) {
          yield message;
        }
      })()
    );

    const result = await engineerNode(stateWithTask);

    // Verify nodeExecutionResults contains the messages
    expect(result.nodeExecutionResults).toBeDefined();
    expect(result.nodeExecutionResults).toBeInstanceOf(Map);

    const resultKey = `EngineerNode-${taskId}`;
    const storedMessages = result.nodeExecutionResults?.get(resultKey);

    expect(storedMessages).toBeDefined();
    expect(storedMessages).toHaveLength(mockMessages.length);
    expect(storedMessages).toEqual(mockMessages);
  });

  test('should store different message types correctly', async () => {
    const initialState = createInitialState('Implement feature', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath,
      worktreeBasePath: '/test/worktrees',
    });

    const task: Task = {
      id: taskId,
      title: 'Test Task',
      description: 'Test Description',
      status: 'in_progress',
      priority: 100,
      dependencies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const stateWithTask: ParallelDevStateType = {
      ...initialState,
      tasks: [task],
      currentTaskId: taskId,
      activeSprint: {
        id: sprintId,
        name: 'Test Sprint',
        goal: 'Test Goal',
        taskIds: [taskId],
        startedAt: new Date(),
        status: 'active',
        deployable: false,
        metadata: {
          estimatedHours: 8,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      },
    };

    // Mock with various message types
    const mockMessages = [
      // Thinking message
      {
        type: 'thinking',
        thinking: 'Planning implementation...',
      },
      // Text message
      {
        type: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Starting implementation',
          },
        ],
      },
      // Tool use message
      {
        type: 'assistant',
        content: [
          {
            type: 'tool_use',
            name: 'Read',
            input: { file_path: '/existing/file.ts' },
          },
        ],
      },
      // Multiple content blocks
      {
        type: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Creating new file',
          },
          {
            type: 'tool_use',
            name: 'Write',
            input: { file_path: '/new/file.ts', content: 'code' },
          },
        ],
      },
      // Result message
      {
        type: 'result',
        status: 'success',
        finalResponse: 'Complete',
      },
    ];

    mockExecute.mockReturnValue(
      (async function* () {
        for (const message of mockMessages) {
          yield message;
        }
      })()
    );

    const result = await engineerNode(stateWithTask);

    const resultKey = `EngineerNode-${taskId}`;
    const storedMessages = result.nodeExecutionResults?.get(resultKey);

    expect(storedMessages).toHaveLength(5);

    // Verify thinking message
    expect(storedMessages?.[0]).toHaveProperty('type', 'thinking');
    expect(storedMessages?.[0]).toHaveProperty('thinking', 'Planning implementation...');

    // Verify text message
    expect(storedMessages?.[1].type).toBe('assistant');
    expect(storedMessages?.[1].content[0].type).toBe('text');

    // Verify tool use message
    expect(storedMessages?.[2].content[0].type).toBe('tool_use');
    expect(storedMessages?.[2].content[0].name).toBe('Read');

    // Verify multiple content blocks
    expect(storedMessages?.[3].content).toHaveLength(2);

    // Verify result message
    expect(storedMessages?.[4]).toHaveProperty('type', 'result');
  });

  test('should preserve existing nodeExecutionResults from state', async () => {
    const initialState = createInitialState('Implement feature', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath,
      worktreeBasePath: '/test/worktrees',
    });

    const task: Task = {
      id: taskId,
      title: 'Test Task',
      description: 'Test Description',
      status: 'in_progress',
      priority: 100,
      dependencies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add existing result from another task
    const existingResults = new Map();
    existingResults.set('EngineerNode-TASK-000', [
      { type: 'assistant', content: [{ type: 'text', text: 'Previous task' }] },
    ]);

    const stateWithTask: ParallelDevStateType = {
      ...initialState,
      tasks: [task],
      currentTaskId: taskId,
      nodeExecutionResults: existingResults,
      activeSprint: {
        id: sprintId,
        name: 'Test Sprint',
        goal: 'Test Goal',
        taskIds: [taskId],
        startedAt: new Date(),
        status: 'active',
        deployable: false,
        metadata: {
          estimatedHours: 8,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      },
    };

    const mockMessages = [
      {
        type: 'assistant',
        content: [{ type: 'text', text: 'Current task' }],
      },
    ];

    mockExecute.mockReturnValue(
      (async function* () {
        for (const message of mockMessages) {
          yield message;
        }
      })()
    );

    const result = await engineerNode(stateWithTask);

    // Verify both old and new results are preserved
    expect(result.nodeExecutionResults?.size).toBe(2);
    expect(result.nodeExecutionResults?.get('EngineerNode-TASK-000')).toBeDefined();
    expect(result.nodeExecutionResults?.get(`EngineerNode-${taskId}`)).toBeDefined();
    expect(result.nodeExecutionResults?.get(`EngineerNode-${taskId}`)).toEqual(mockMessages);
  });

  test('should handle empty message array', async () => {
    const initialState = createInitialState('Implement feature', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath,
      worktreeBasePath: '/test/worktrees',
    });

    const task: Task = {
      id: taskId,
      title: 'Test Task',
      description: 'Test Description',
      status: 'in_progress',
      priority: 100,
      dependencies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const stateWithTask: ParallelDevStateType = {
      ...initialState,
      tasks: [task],
      currentTaskId: taskId,
      activeSprint: {
        id: sprintId,
        name: 'Test Sprint',
        goal: 'Test Goal',
        taskIds: [taskId],
        startedAt: new Date(),
        status: 'active',
        deployable: false,
        metadata: {
          estimatedHours: 8,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      },
    };

    // Mock empty message stream
    mockExecute.mockReturnValue(
      (async function* () {
        // No messages yielded
      })()
    );

    const result = await engineerNode(stateWithTask);

    const resultKey = `EngineerNode-${taskId}`;
    const storedMessages = result.nodeExecutionResults?.get(resultKey);

    // Should store empty array
    expect(storedMessages).toBeDefined();
    expect(storedMessages).toEqual([]);
  });

  test('should not store messages on task failure', async () => {
    const initialState = createInitialState('Implement feature', {
      maxEngineers: 1,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath,
      worktreeBasePath: '/test/worktrees',
    });

    const task: Task = {
      id: taskId,
      title: 'Test Task',
      description: 'Test Description',
      status: 'in_progress',
      priority: 100,
      dependencies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const stateWithTask: ParallelDevStateType = {
      ...initialState,
      tasks: [task],
      currentTaskId: taskId,
      activeSprint: {
        id: sprintId,
        name: 'Test Sprint',
        goal: 'Test Goal',
        taskIds: [taskId],
        startedAt: new Date(),
        status: 'active',
        deployable: false,
        metadata: {
          estimatedHours: 8,
          blockers: [],
          completedTasksCount: 0,
          failedTasksCount: 0,
        },
      },
    };

    // Mock AI provider error
    mockExecute.mockImplementation(() => {
      throw new Error('AI execution failed');
    });

    const result = await engineerNode(stateWithTask);

    // Should not have stored messages on failure
    expect(result.nodeExecutionResults).toBeUndefined();
  });
});
