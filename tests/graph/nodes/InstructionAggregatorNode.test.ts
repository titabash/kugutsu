/**
 * InstructionAggregatorNode Unit Tests
 *
 * 特に以下をテスト：
 * - GlobalTask → Task 変換ロジック
 * - priority変換（数値 → 'high'/'medium'/'low'）
 * - 開発準備完了タスクの検出
 * - 無限ループ防止（tasksが空でも正しく動作）
 */

import { jest } from '@jest/globals';
import { Send } from '@langchain/langgraph';

// Mock dependencies
const mockSaveActiveSprint = jest.fn<any>();
jest.unstable_mockModule('../../../src/utils/DataPersistence.js', () => ({
  DataPersistence: jest.fn<any>().mockImplementation(() => ({
    saveActiveSprint: mockSaveActiveSprint,
  })),
}));

// Import after mocking
const { instructionAggregatorNode, instructionAggregatorRouter } = await import(
  '../../../src/graph/nodes/InstructionAggregatorNode.js'
);

describe('InstructionAggregatorNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('instructionAggregatorNode', () => {
    test('should count task states correctly', async () => {
      const state: any = {
        config: { baseRepoPath: '/test' },
        activeSprint: {
          id: 'sprint-1',
          status: 'planning',
          taskIds: ['task-1', 'task-2', 'task-3'],
        },
        globalTasks: [
          { id: 'task-1', instructionGenerated: true },
          { id: 'task-2', instructionGenerating: true },
          { id: 'task-3', instructionGenerated: false, instructionGenerating: false },
        ],
      };

      const result = await instructionAggregatorNode(state);

      expect(result.logs).toHaveLength(1);
      expect(result.logs![0].message).toContain('未生成=1');
      expect(result.logs![0].message).toContain('実行中=1');
      expect(result.logs![0].message).toContain('完了=1');
    });

    test('should update sprint status from planning to active', async () => {
      const state: any = {
        config: { baseRepoPath: '/test' },
        activeSprint: {
          id: 'sprint-1',
          status: 'planning',
          taskIds: ['task-1'],
        },
        globalTasks: [{ id: 'task-1', instructionGenerated: true }],
      };

      const result = await instructionAggregatorNode(state);

      expect(result.activeSprint).toBeDefined();
      expect(result.activeSprint!.status).toBe('active');
      expect(mockSaveActiveSprint).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'sprint-1',
          status: 'active',
        })
      );
    });

    test('should not update sprint status if already active', async () => {
      const state: any = {
        config: { baseRepoPath: '/test' },
        activeSprint: {
          id: 'sprint-1',
          status: 'active',
          taskIds: ['task-1'],
        },
        globalTasks: [{ id: 'task-1', instructionGenerated: true }],
      };

      const result = await instructionAggregatorNode(state);

      expect(result.activeSprint!.status).toBe('active');
      expect(mockSaveActiveSprint).not.toHaveBeenCalled();
    });

    test('should return error if no active sprint', async () => {
      const state: any = {
        config: { baseRepoPath: '/test' },
        activeSprint: null,
        globalTasks: [],
      };

      const result = await instructionAggregatorNode(state);

      expect(result.logs).toHaveLength(1);
      expect(result.logs![0].level).toBe('error');
      expect(result.logs![0].message).toContain('アクティブなスプリントが設定されていません');
    });
  });

  describe('instructionAggregatorRouter', () => {
    describe('GlobalTask → Task 変換', () => {
      test('should convert GlobalTask to Task with correct structure', () => {
        const state: any = {
          config: {},
          activeSprint: {
            id: 'sprint-1',
            taskIds: ['task-1'],
          },
          globalTasks: [
            {
              id: 'task-1',
              type: 'feature',
              title: 'Test Task',
              description: 'Test Description',
              priority: 80, // 数値（GlobalTask）
              status: 'pending',
              dependencies: ['dep-1'],
              branchName: undefined,
              worktreePath: undefined,
              instructionGenerated: true,
              createdAt: new Date('2025-01-01'),
              updatedAt: new Date('2025-01-02'),
            },
          ],
          tasks: [],
          worktrees: new Map(),
          reviews: [],
          mergeQueue: [],
        };

        const result = instructionAggregatorRouter(state);

        expect(Array.isArray(result)).toBe(true);
        const sends = result as Send[];
        expect(sends).toHaveLength(1);

        // Send APIで渡されるstate内のtasksを確認
        const sendState = sends[0].args as any;
        expect(sendState.tasks).toHaveLength(1);

        const convertedTask = sendState.tasks[0];
        expect(convertedTask.id).toBe('task-1');
        expect(convertedTask.type).toBe('feature');
        expect(convertedTask.title).toBe('Test Task');
        expect(convertedTask.description).toBe('Test Description');
        expect(convertedTask.priority).toBe('high');
        expect(convertedTask.status).toBe('pending');
        expect(convertedTask.dependencies).toEqual(['dep-1']);
        expect(convertedTask.branchName).toBeUndefined();
        expect(convertedTask.worktreePath).toBeUndefined();
        // createdAt/updatedAtはDate型で生成される
        expect(convertedTask.createdAt).toBeDefined();
        expect(convertedTask.updatedAt).toBeDefined();
      });

      test('should convert priority correctly: high (>=70)', () => {
        const state: any = {
          config: {},
          activeSprint: { id: 'sprint-1', taskIds: ['task-1'] },
          globalTasks: [
            {
              id: 'task-1',
              type: 'feature',
              title: 'High Priority',
              description: 'desc',
              priority: 90,
              status: 'pending',
              dependencies: [],
              instructionGenerated: true,
            },
          ],
          tasks: [],
        };

        const sends = instructionAggregatorRouter(state) as Send[];
        const convertedTask = (sends[0].args as any).tasks[0];
        expect(convertedTask.priority).toBe('high');
      });

      test('should convert priority correctly: medium (40-69)', () => {
        const state: any = {
          config: {},
          activeSprint: { id: 'sprint-1', taskIds: ['task-1'] },
          globalTasks: [
            {
              id: 'task-1',
              type: 'feature',
              title: 'Medium Priority',
              description: 'desc',
              priority: 50,
              status: 'pending',
              dependencies: [],
              instructionGenerated: true,
            },
          ],
          tasks: [],
        };

        const sends = instructionAggregatorRouter(state) as Send[];
        const convertedTask = (sends[0].args as any).tasks[0];
        expect(convertedTask.priority).toBe('medium');
      });

      test('should convert priority correctly: low (<40)', () => {
        const state: any = {
          config: {},
          activeSprint: { id: 'sprint-1', taskIds: ['task-1'] },
          globalTasks: [
            {
              id: 'task-1',
              type: 'feature',
              title: 'Low Priority',
              description: 'desc',
              priority: 20,
              status: 'pending',
              dependencies: [],
              instructionGenerated: true,
            },
          ],
          tasks: [],
        };

        const sends = instructionAggregatorRouter(state) as Send[];
        const convertedTask = (sends[0].args as any).tasks[0];
        expect(convertedTask.priority).toBe('low');
      });

      test('should handle missing createdAt/updatedAt', () => {
        const state: any = {
          config: {},
          activeSprint: { id: 'sprint-1', taskIds: ['task-1'] },
          globalTasks: [
            {
              id: 'task-1',
              type: 'feature',
              title: 'Test',
              description: 'desc',
              priority: 50,
              status: 'pending',
              dependencies: [],
              instructionGenerated: true,
              // createdAt/updatedAt なし
            },
          ],
          tasks: [],
        };

        const sends = instructionAggregatorRouter(state) as Send[];
        const convertedTask = (sends[0].args as any).tasks[0];

        expect(convertedTask.createdAt).toBeDefined();
        expect(convertedTask.updatedAt).toBeDefined();
      });
    });

    describe('開発準備完了タスクの検出', () => {
      test('should detect tasks ready for development', () => {
        const state: any = {
          config: {},
          activeSprint: { id: 'sprint-1', taskIds: ['task-1', 'task-2', 'task-3'] },
          globalTasks: [
            {
              id: 'task-1',
              type: 'feature',
              title: 'Ready Task',
              description: 'desc',
              priority: 50,
              status: 'pending',
              dependencies: [],
              instructionGenerated: true, // 生成済み
              worktreePath: undefined, // worktree未作成
            },
            {
              id: 'task-2',
              type: 'feature',
              title: 'Not Ready (no instruction)',
              description: 'desc',
              priority: 50,
              status: 'pending',
              dependencies: [],
              instructionGenerated: false, // 未生成
            },
            {
              id: 'task-3',
              type: 'feature',
              title: 'Not Ready (has worktree)',
              description: 'desc',
              priority: 50,
              status: 'pending',
              dependencies: [],
              instructionGenerated: true,
              worktreePath: '/path/to/worktree', // worktree作成済み
            },
          ],
          tasks: [],
        };

        const sends = instructionAggregatorRouter(state) as Send[];

        // engineer_dispatchに送られるべき
        expect(sends.some((s) => s.node === 'engineer_dispatch')).toBe(true);

        const engineerSend = sends.find((s) => s.node === 'engineer_dispatch')!;
        const tasksForDev = (engineerSend.args as any).tasks;

        // task-1のみが送られる
        expect(tasksForDev).toHaveLength(1);
        expect(tasksForDev[0].id).toBe('task-1');
      });
    });

    describe('ルーティング判定', () => {
      test('should route to engineer_dispatch when tasks are ready', () => {
        const state: any = {
          config: {},
          activeSprint: { id: 'sprint-1', taskIds: ['task-1'] },
          globalTasks: [
            {
              id: 'task-1',
              type: 'feature',
              title: 'Task',
              description: 'desc',
              priority: 50,
              status: 'pending',
              dependencies: [],
              instructionGenerated: true,
            },
          ],
          tasks: [],
        };

        const sends = instructionAggregatorRouter(state) as Send[];

        expect(sends).toHaveLength(1);
        expect(sends[0].node).toBe('engineer_dispatch');
      });

      test('should route to instruction_generator_dispatch when tasks need instruction', () => {
        const state: any = {
          config: {},
          activeSprint: { id: 'sprint-1', taskIds: ['task-1'] },
          globalTasks: [
            {
              id: 'task-1',
              instructionGenerated: false,
              instructionGenerating: false,
            },
          ],
          tasks: [],
        };

        const sends = instructionAggregatorRouter(state) as Send[];

        expect(sends).toHaveLength(1);
        expect(sends[0].node).toBe('instruction_generator_dispatch');
      });

      test('should route to sprint_review when all tasks are processed', () => {
        const state: any = {
          config: {},
          activeSprint: { id: 'sprint-1', taskIds: ['task-1'] },
          globalTasks: [
            {
              id: 'task-1',
              status: 'in_progress',
              instructionGenerated: true,
              worktreePath: '/path',
            },
          ],
          tasks: [],
        };

        const result = instructionAggregatorRouter(state);

        expect(result).toBe('sprint_review');
      });

      test('should return END when no active sprint', () => {
        const state: any = {
          config: {},
          activeSprint: null,
          globalTasks: [],
          tasks: [],
        };

        const result = instructionAggregatorRouter(state);

        expect(result).toBe('END');
      });
    });

    describe('無限ループ防止', () => {
      test('should not loop when tasks array is empty but globalTasks exist', () => {
        const state: any = {
          config: {},
          activeSprint: { id: 'sprint-1', taskIds: ['task-1'] },
          globalTasks: [
            {
              id: 'task-1',
              type: 'feature',
              title: 'Task',
              description: 'desc',
              priority: 50,
              status: 'pending',
              dependencies: [],
              instructionGenerated: true,
            },
          ],
          tasks: [], // ← 空でもglobalTasksから変換される
        };

        const sends = instructionAggregatorRouter(state) as Send[];

        expect(Array.isArray(sends)).toBe(true);
        expect(sends).toHaveLength(1);
        expect(sends[0].node).toBe('engineer_dispatch');

        // tasksが正しく生成されている
        const tasksForDev = (sends[0].args as any).tasks;
        expect(tasksForDev).toHaveLength(1);
        expect(tasksForDev[0].id).toBe('task-1');
      });
    });
  });
});
