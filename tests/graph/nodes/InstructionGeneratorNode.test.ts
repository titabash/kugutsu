/**
 * InstructionGeneratorNode Unit Tests (Jest)
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
const { instructionGeneratorNode } = await import(
  '../../../src/graph/nodes/InstructionGeneratorNode.js'
);
const { createInitialState } = await import('../../../src/graph/state.js');
const { AIProviderFactory } = await import('../../../src/providers/AIProviderFactory.js');

// Test helper to create state with activeSprint
function createTestState(userRequest: string, config: any) {
  const state = createInitialState(userRequest, config);
  state.activeSprint = {
    id: 'sprint-1',
    name: 'Sprint 1',
    goal: 'Test sprint',
    taskIds: ['task-001', 'task-002'],
    status: 'active' as const,
    deployable: true,
    metadata: {
      estimatedHours: 8,
      blockers: [],
      completedTasksCount: 0,
      failedTasksCount: 0,
    },
  };
  state.currentProjectId = 'project-001';
  state.globalTasks = [
    {
      id: 'task-001',
      type: 'feature' as const,
      title: 'Implement feature A',
      description: 'Add feature A to the system',
      priority: 100,
      dependencies: [],
      status: 'pending' as const,
      projectId: 'project-001',
      requestTimestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      dynamicPriority: 100,
    },
    {
      id: 'task-002',
      type: 'feature' as const,
      title: 'Implement feature B',
      description: 'Add feature B to the system',
      priority: 90,
      dependencies: [],
      status: 'pending' as const,
      projectId: 'project-001',
      requestTimestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      dynamicPriority: 90,
    },
    {
      id: 'task-003',
      type: 'feature' as const,
      title: 'Feature outside sprint',
      description: 'This task is not in the sprint',
      priority: 80,
      dependencies: [],
      status: 'pending' as const,
      projectId: 'project-001',
      requestTimestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      dynamicPriority: 80,
    },
  ];
  return state;
}

describe('InstructionGeneratorNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock provider with async generator
    // AI-First: AIがWriteツールでファイル作成
    mockProvider = {
      execute: jest.fn(async function* () {
        yield { type: 'assistant', content: '# Instruction\n' };
        yield { type: 'assistant', content: 'This is a test instruction.' };
      }),
    };

    (AIProviderFactory.create as any).mockReturnValue(mockProvider);
  });

  describe('エラーチェック', () => {
    test('activeSprint.idが未設定の場合、エラーログを返す', async () => {
      const state = createTestState('Test request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      // activeSprint.idを未設定にする
      state.activeSprint = null;

      const result = await instructionGeneratorNode(state);

      expect(result.logs).toBeDefined();
      expect(result.logs![0].level).toBe('error');
      expect(result.logs![0].message).toContain('アクティブなスプリントが設定されていません');
    });

    test('スプリントタスクが0件の場合、infoログを返す', async () => {
      const state = createTestState('Test request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      // スプリントのtaskIdsを空にする
      state.activeSprint!.taskIds = [];

      const result = await instructionGeneratorNode(state);

      expect(result.logs).toBeDefined();
      expect(result.logs![0].level).toBe('info');
      expect(result.logs![0].message).toContain('スプリント内のタスクがありません');
    });
  });

  describe('スプリントスコープフィルタリング', () => {
    test('activeSprint.taskIdsに含まれるタスクのみ処理される', async () => {
      const state = createTestState('Test request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      // activeSprint.taskIds = ['task-001', 'task-002']
      // globalTasks = ['task-001', 'task-002', 'task-003']
      // → task-001, task-002のみ処理される

      const result = await instructionGeneratorNode(state);

      // AI-First: AIが2回呼ばれることを確認（task-001, task-002）
      expect(mockProvider.execute).toHaveBeenCalledTimes(2);

      // Writeツールが許可されていることを確認
      const firstCall = (mockProvider.execute as any).mock.calls[0];
      const options = firstCall[1];
      expect(options.allowedTools).toEqual(['Write']);

      // プロンプトに正しいパスが含まれていることを確認
      const firstPrompt = firstCall[0];
      expect(firstPrompt).toContain('.kugutsu/sprints/sprint-1/tasks/task-001/instruction.md');
    });
  });

  describe('高複雑度パス', () => {
    test('設計書を参照してinstruction.md生成', async () => {
      const state = createTestState('Test request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      // 高複雑度パス: 設計書を設定
      state.storyMapping = {
        persona: {
          name: 'Test User',
          role: 'Developer',
          goal: 'Implement features efficiently',
        },
        epics: [
          {
            id: 'epic-1',
            title: 'User Authentication',
            priority: 100,
            stories: [],
          },
        ],
      };
      state.designDocs = {
        designDocsPath: '/docs/design.md',
        uiuxPath: '/docs/uiux.md',
        databasePath: '/docs/db.md',
        apiPath: '/docs/api.md',
      };

      const result = await instructionGeneratorNode(state);

      // AIが呼ばれたことを確認
      expect(mockProvider.execute).toHaveBeenCalled();

      // プロンプトにストーリーマッピングと設計書が含まれているか確認
      const firstCall = (mockProvider.execute as any).mock.calls[0];
      const promptString = firstCall[0]; // 第一引数がプロンプト文字列

      expect(promptString).toContain('ストーリーマッピング');
      expect(promptString).toContain('設計書');
    });
  });

  describe('低複雑度パス', () => {
    test('ユーザーリクエストを参照してinstruction.md生成', async () => {
      const state = createTestState('バグ修正: ログイン画面の不具合を修正', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      // 低複雑度パス: 設計書を未設定
      state.storyMapping = null;
      state.designDocs = null;

      const result = await instructionGeneratorNode(state);

      // AIが呼ばれたことを確認
      expect(mockProvider.execute).toHaveBeenCalled();

      // プロンプトにユーザーリクエストが含まれているか確認
      const firstCall = (mockProvider.execute as any).mock.calls[0];
      const promptString = firstCall[0]; // 第一引数がプロンプト文字列

      expect(promptString).toContain('バグ修正: ログイン画面の不具合を修正');
      expect(promptString).toContain('ユーザーリクエスト');
    });
  });

  describe('並列実行', () => {
    test('Promise.allSettledで並列実行される', async () => {
      const state = createTestState('Test request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      // Spy on Promise.allSettled
      const allSettledSpy = jest.spyOn(Promise, 'allSettled');

      await instructionGeneratorNode(state);

      // Promise.allSettledが呼ばれたことを確認
      expect(allSettledSpy).toHaveBeenCalled();

      // Restore spy
      allSettledSpy.mockRestore();
    });
  });

  describe('エラーハンドリング', () => {
    test('AI実行エラー時、該当タスクの失敗ログを記録', async () => {
      const state = createTestState('Test request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      // 最初の呼び出しでエラーをスロー
      let callCount = 0;
      mockProvider.execute = jest.fn(async function* () {
        if (callCount === 0) {
          callCount++;
          throw new Error('AI execution error');
        }
        callCount++;
        yield { type: 'text', text: '# Instruction' };
      });

      const result = await instructionGeneratorNode(state);

      // エラーログが記録されていることを確認
      const errorLogs = result.logs!.filter((log) => log.level === 'error');
      expect(errorLogs.length).toBeGreaterThan(0);
      expect(errorLogs[0].message).toContain('instruction.md生成失敗');
    });

    test('currentProjectIdが未設定の場合、エラーがスローされる', async () => {
      const state = createTestState('Test request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      // currentProjectIdを未設定にする
      state.currentProjectId = null;

      const result = await instructionGeneratorNode(state);

      // エラーログが記録されていることを確認
      const errorLogs = result.logs!.filter((log) => log.level === 'error');
      expect(errorLogs.length).toBeGreaterThan(0);
      expect(errorLogs[0].message).toContain('失敗');
    });
  });

  describe('成功ケース', () => {
    test('instruction.mdが正常に生成される', async () => {
      const state = createTestState('Test request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      const result = await instructionGeneratorNode(state);

      // 成功ログが記録されていることを確認
      const infoLogs = result.logs!.filter((log) => log.level === 'info');
      expect(infoLogs.length).toBe(2); // task-001, task-002

      expect(infoLogs[0].message).toContain('instruction.md生成完了');
      expect(infoLogs[1].message).toContain('instruction.md生成完了');
    });

    test('AIProviderFactory.createが正しく呼ばれる', async () => {
      const state = createTestState('Test request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      await instructionGeneratorNode(state);

      // AIProviderFactory.createが呼ばれたことを確認
      expect(AIProviderFactory.create).toHaveBeenCalled();
    });

    test('AIがWriteツールで正しいパスにファイル作成', async () => {
      const state = createTestState('Test request', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      await instructionGeneratorNode(state);

      // AI-First: AIがWriteツールで正しいパスに作成することを確認
      expect(mockProvider.execute).toHaveBeenCalledTimes(2);

      // task-001のパスを確認
      const call1 = (mockProvider.execute as any).mock.calls[0];
      expect(call1[0]).toContain('.kugutsu/sprints/sprint-1/tasks/task-001/instruction.md');
      expect(call1[1].allowedTools).toEqual(['Write']);

      // task-002のパスを確認
      const call2 = (mockProvider.execute as any).mock.calls[1];
      expect(call2[0]).toContain('.kugutsu/sprints/sprint-1/tasks/task-002/instruction.md');
      expect(call2[1].allowedTools).toEqual(['Write']);
    });
  });
});
