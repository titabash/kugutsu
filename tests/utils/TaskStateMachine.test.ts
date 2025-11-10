import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TaskStateMachine } from '../../src/utils/TaskStateMachine.js';
import type { Task } from '../../src/graph/types.js';

describe('TaskStateMachine', () => {
  let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('transition to failed state', () => {
    it('should warn when transitioning to failed without error', () => {
      const task: Task = {
        id: 'task-001',
        title: 'Test Task',
        description: 'Test description',
        status: 'in_progress',
        priority: 5,
        dependencies: [],
      };

      // Transition to failed without error
      const failedTask = TaskStateMachine.transition(task, 'failed');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Task task-001 transitioning to failed without error message')
      );

      // Verify default error was set
      expect(failedTask.error).toBeDefined();
      expect(failedTask.error).toBeInstanceOf(Error);
      if (failedTask.error instanceof Error) {
        expect(failedTask.error.message).toContain('タスク実行中にエラーが発生しましたが、詳細情報が取得できませんでした');
      }
      expect(failedTask.status).toBe('failed');
    });

    it('should not warn when transitioning to failed with error', () => {
      const error = new Error('Test error');
      const task: Task = {
        id: 'task-002',
        title: 'Test Task',
        description: 'Test description',
        status: 'in_progress',
        dependencies: [],
        priority: 5,
        error,
      };

      // Transition to failed with error
      const failedTask = TaskStateMachine.transition(task, 'failed');

      expect(consoleWarnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Warning: Task task-002 transitioning to failed without error message')
      );

      // Verify error was preserved
      expect(failedTask.error).toBe(error);
      expect(failedTask.status).toBe('failed');
    });

    it('should log task details when warning about missing error', () => {
      const task: Task = {
        id: 'task-003',
        title: 'Important Task',
        description: 'Test description',
        status: 'in_progress',
        dependencies: [],
        priority: 5,
        worktreePath: '/path/to/worktree',
        sessionId: 'session-123',
      };

      TaskStateMachine.transition(task, 'failed');

      // Verify detailed warning was logged (console.warn is called twice)
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);

      // First call: warning message
      expect(consoleWarnSpy).toHaveBeenNthCalledWith(1,
        expect.stringContaining('Warning: Task task-003 transitioning to failed without error message')
      );

      // Second call: task details with JSON
      expect(consoleWarnSpy).toHaveBeenNthCalledWith(2,
        expect.stringContaining('Task details:'),
        expect.any(String)
      );
    });

    it('should preserve other task properties when setting default error', () => {
      const task: Task = {
        id: 'task-004',
        title: 'Test Task',
        description: 'Test description',
        status: 'in_progress',
        dependencies: ['task-001'],
        priority: 7,
        worktreePath: '/worktree/task-004',
        branchName: 'feature/task-004',
        sessionId: 'session-456',
      };

      const failedTask = TaskStateMachine.transition(task, 'failed');

      // Verify all properties are preserved
      expect(failedTask.id).toBe('task-004');
      expect(failedTask.title).toBe('Test Task');
      expect(failedTask.dependencies).toEqual(['task-001']);
      expect(failedTask.worktreePath).toBe('/worktree/task-004');
      expect(failedTask.branchName).toBe('feature/task-004');
      expect(failedTask.sessionId).toBe('session-456');

      // Verify error was added
      expect(failedTask.error).toBeDefined();
    });

    it('should handle Error instances correctly', () => {
      const originalError = new Error('AI execution failed: timeout');
      const task: Task = {
        id: 'task-005',
        title: 'Test Task',
        description: 'Test description',
        status: 'in_progress',
        dependencies: [],
        priority: 5,
        error: originalError,
      };

      const failedTask = TaskStateMachine.transition(task, 'failed');

      expect(failedTask.error).toBe(originalError);
      if (failedTask.error instanceof Error) {
        expect(failedTask.error.message).toBe('AI execution failed: timeout');
      }
    });

    it('should handle custom error objects', () => {
      const customError = {
        name: 'CustomError',
        message: 'Custom error message',
        code: 'E_CUSTOM',
      };

      const task: Task = {
        id: 'task-006',
        title: 'Test Task',
        description: 'Test description',
        status: 'in_progress',
        dependencies: [],
        priority: 5,
        error: customError as any,
      };

      const failedTask = TaskStateMachine.transition(task, 'failed');

      expect(failedTask.error).toBe(customError);
    });
  });

  describe('other state transitions', () => {
    it('should handle pending->in_progress transition', () => {
      const task: Task = {
        id: 'task-007',
        title: 'Test Task',
        description: 'Test description',
        status: 'pending',
        dependencies: [],
        priority: 5,
        // pending->in_progress には worktreePath と branchName が必須
        worktreePath: '/worktree/task-007',
        branchName: 'feature/task-007',
      };

      const inProgressTask = TaskStateMachine.transition(task, 'in_progress');

      expect(inProgressTask.status).toBe('in_progress');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should warn when transitioning to in_review without sessionId', () => {
      const task: Task = {
        id: 'task-008',
        title: 'Test Task',
        description: 'Test description',
        status: 'in_progress',
        dependencies: [],
        priority: 5,
        // sessionId なし
      };

      TaskStateMachine.transition(task, 'in_review');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Task task-008 transitioning to in_review without sessionId')
      );
    });

    it('should not warn when transitioning to in_review with sessionId', () => {
      const task: Task = {
        id: 'task-009',
        title: 'Test Task',
        description: 'Test description',
        status: 'in_progress',
        dependencies: [],
        priority: 5,
        sessionId: 'session-789',
      };

      TaskStateMachine.transition(task, 'in_review');

      expect(consoleWarnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('transitioning to in_review without sessionId')
      );
    });
  });

  describe('failed->pending reset', () => {
    it('should clear worktree and session info when resetting failed task', () => {
      const task: Task = {
        id: 'task-010',
        title: 'Test Task',
        description: 'Test description',
        status: 'failed',
        dependencies: [],
        priority: 5,
        error: new Error('Previous error'),
        worktreePath: '/worktree/task-010',
        branchName: 'feature/task-010',
        sessionId: 'session-old',
      };

      const resetTask = TaskStateMachine.transition(task, 'pending');

      expect(resetTask.status).toBe('pending');
      expect(resetTask.worktreePath).toBeUndefined();
      expect(resetTask.branchName).toBeUndefined();
      expect(resetTask.sessionId).toBeUndefined();
      expect(resetTask.error).toBeUndefined();
    });
  });
});
