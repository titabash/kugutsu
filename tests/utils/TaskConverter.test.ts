import { describe, it, expect } from '@jest/globals';
import { TaskConverter } from '../../src/utils/TaskConverter.js';
import type { TaskArtifact, TaskStatus as ArtifactTaskStatus } from '../../src/types/artifacts.js';
import type { Task, TaskStatus } from '../../src/graph/types.js';

describe('TaskConverter', () => {
  describe('toStateTask', () => {
    it('should convert TaskArtifact to Task with basic fields', () => {
      const artifact: TaskArtifact = {
        id: 'task-001',
        title: 'Test Task',
        description: 'Test description',
        priority: 1,
        dependencies: ['task-000'],
        status: 'pending',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const task = TaskConverter.toStateTask(artifact);

      expect(task.id).toBe('task-001');
      expect(task.title).toBe('Test Task');
      expect(task.description).toBe('Test description');
      expect(task.priority).toBe(1);
      expect(task.dependencies).toEqual(['task-000']);
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
    });

    it('should convert "pending" status correctly', () => {
      const artifact: TaskArtifact = {
        id: 'task-001',
        title: 'Test',
        description: 'Test',
        priority: 1,
        dependencies: [],
        status: 'pending',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const task = TaskConverter.toStateTask(artifact);

      // Dependency checking is done in EngineerDispatchNode, so status stays 'pending'
      expect(task.status).toBe('pending');
    });

    it('should convert "pending" status with unresolved dependencies to "pending"', () => {
      const artifact: TaskArtifact = {
        id: 'task-002',
        title: 'Test',
        description: 'Test',
        priority: 1,
        dependencies: ['task-001'],
        status: 'pending',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const existingTasks: Task[] = [
        {
          id: 'task-001',
          title: 'Dependency Task',
          description: 'Dep',
          priority: 2,
          dependencies: [],
          status: 'in_progress', // Not completed yet
        },
      ];

      const task = TaskConverter.toStateTask(artifact, existingTasks);

      expect(task.status).toBe('pending');
    });

    it('should convert "pending" status with resolved dependencies to "pending"', () => {
      const artifact: TaskArtifact = {
        id: 'task-002',
        title: 'Test',
        description: 'Test',
        priority: 1,
        dependencies: ['task-001'],
        status: 'pending',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const existingTasks: Task[] = [
        {
          id: 'task-001',
          title: 'Dependency Task',
          description: 'Dep',
          priority: 2,
          dependencies: [],
          status: 'completed', // Completed
        },
      ];

      const task = TaskConverter.toStateTask(artifact, existingTasks);

      // Dependency checking is done in EngineerDispatchNode, not in TaskConverter
      expect(task.status).toBe('pending');
    });

    it('should convert "in_progress" status to "in_progress"', () => {
      const artifact: TaskArtifact = {
        id: 'task-001',
        title: 'Test',
        description: 'Test',
        priority: 1,
        dependencies: [],
        status: 'in_progress',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const task = TaskConverter.toStateTask(artifact);

      expect(task.status).toBe('in_progress');
    });

    it('should convert "implemented" status to "in_review"', () => {
      const artifact: TaskArtifact = {
        id: 'task-001',
        title: 'Test',
        description: 'Test',
        priority: 1,
        dependencies: [],
        status: 'implemented',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const task = TaskConverter.toStateTask(artifact);

      expect(task.status).toBe('in_review');
    });

    it('should convert "reviewed" status to "in_review"', () => {
      const artifact: TaskArtifact = {
        id: 'task-001',
        title: 'Test',
        description: 'Test',
        priority: 1,
        dependencies: [],
        status: 'reviewed',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const task = TaskConverter.toStateTask(artifact);

      expect(task.status).toBe('in_review');
    });

    it('should convert "completed" status to "completed"', () => {
      const artifact: TaskArtifact = {
        id: 'task-001',
        title: 'Test',
        description: 'Test',
        priority: 1,
        dependencies: [],
        status: 'completed',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const task = TaskConverter.toStateTask(artifact);

      expect(task.status).toBe('completed');
    });

    it('should convert "failed" status to "failed"', () => {
      const artifact: TaskArtifact = {
        id: 'task-001',
        title: 'Test',
        description: 'Test',
        priority: 1,
        dependencies: [],
        status: 'failed',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const task = TaskConverter.toStateTask(artifact);

      expect(task.status).toBe('failed');
    });

    it('should preserve optional fields', () => {
      const artifact: TaskArtifact = {
        id: 'task-001',
        title: 'Test',
        description: 'Test',
        priority: 1,
        dependencies: [],
        status: 'in_progress',
        worktreePath: '/path/to/worktree',
        branchName: 'task-001-branch',
        sessionId: 'session-123',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const task = TaskConverter.toStateTask(artifact);

      expect(task.worktreePath).toBe('/path/to/worktree');
      expect(task.branchName).toBe('task-001-branch');
      expect(task.sessionId).toBe('session-123');
    });
  });

  describe('toArtifact', () => {
    it('should convert Task to TaskArtifact with basic fields', () => {
      const task: Task = {
        id: 'task-001',
        title: 'Test Task',
        description: 'Test description',
        priority: 1,
        dependencies: ['task-000'],
        status: 'pending',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      };

      const artifact = TaskConverter.toArtifact(task);

      expect(artifact.id).toBe('task-001');
      expect(artifact.title).toBe('Test Task');
      expect(artifact.description).toBe('Test description');
      expect(artifact.priority).toBe(1);
      expect(artifact.dependencies).toEqual(['task-000']);
      expect(artifact.createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(artifact.updatedAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should convert "pending" status to "pending"', () => {
      const task: Task = {
        id: 'task-001',
        title: 'Test',
        description: 'Test',
        priority: 1,
        dependencies: [],
        status: 'pending',
      };

      const artifact = TaskConverter.toArtifact(task);

      expect(artifact.status).toBe('pending');
    });

    it('should convert "in_progress" status to "in_progress"', () => {
      const task: Task = {
        id: 'task-001',
        title: 'Test',
        description: 'Test',
        priority: 1,
        dependencies: [],
        status: 'in_progress',
      };

      const artifact = TaskConverter.toArtifact(task);

      expect(artifact.status).toBe('in_progress');
    });

    it('should convert "in_review" status to "implemented"', () => {
      const task: Task = {
        id: 'task-001',
        title: 'Test',
        description: 'Test',
        priority: 1,
        dependencies: [],
        status: 'in_review',
      };

      const artifact = TaskConverter.toArtifact(task);

      expect(artifact.status).toBe('implemented');
    });

    it('should convert "completed" status to "completed"', () => {
      const task: Task = {
        id: 'task-001',
        title: 'Test',
        description: 'Test',
        priority: 1,
        dependencies: [],
        status: 'completed',
      };

      const artifact = TaskConverter.toArtifact(task);

      expect(artifact.status).toBe('completed');
    });

    it('should convert "failed" status to "failed"', () => {
      const task: Task = {
        id: 'task-001',
        title: 'Test',
        description: 'Test',
        priority: 1,
        dependencies: [],
        status: 'failed',
      };

      const artifact = TaskConverter.toArtifact(task);

      expect(artifact.status).toBe('failed');
    });

    it('should preserve optional fields', () => {
      const task: Task = {
        id: 'task-001',
        title: 'Test',
        description: 'Test',
        priority: 1,
        dependencies: [],
        status: 'in_progress',
        worktreePath: '/path/to/worktree',
        branchName: 'task-001-branch',
        sessionId: 'session-123',
      };

      const artifact = TaskConverter.toArtifact(task);

      expect(artifact.worktreePath).toBe('/path/to/worktree');
      expect(artifact.branchName).toBe('task-001-branch');
      expect(artifact.sessionId).toBe('session-123');
    });

    it('should use current timestamp if createdAt/updatedAt are missing', () => {
      const task: Task = {
        id: 'task-001',
        title: 'Test',
        description: 'Test',
        priority: 1,
        dependencies: [],
        status: 'pending',
      };

      const artifact = TaskConverter.toArtifact(task);

      expect(artifact.createdAt).toBeTruthy();
      expect(artifact.updatedAt).toBeTruthy();
      expect(new Date(artifact.createdAt)).toBeInstanceOf(Date);
      expect(new Date(artifact.updatedAt)).toBeInstanceOf(Date);
    });
  });

  describe('round-trip conversion', () => {
    it('should maintain data integrity after round-trip conversion', () => {
      const originalArtifact: TaskArtifact = {
        id: 'task-001',
        title: 'Test Task',
        description: 'Test description',
        priority: 5,
        dependencies: ['task-000'],
        status: 'implemented',
        worktreePath: '/path/to/worktree',
        branchName: 'task-001-branch',
        sessionId: 'session-123',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T12:00:00.000Z',
      };

      // Artifact -> Task -> Artifact
      const task = TaskConverter.toStateTask(originalArtifact);
      const resultArtifact = TaskConverter.toArtifact(task);

      expect(resultArtifact.id).toBe(originalArtifact.id);
      expect(resultArtifact.title).toBe(originalArtifact.title);
      expect(resultArtifact.description).toBe(originalArtifact.description);
      expect(resultArtifact.priority).toBe(originalArtifact.priority);
      expect(resultArtifact.dependencies).toEqual(originalArtifact.dependencies);
      expect(resultArtifact.status).toBe(originalArtifact.status);
      expect(resultArtifact.worktreePath).toBe(originalArtifact.worktreePath);
      expect(resultArtifact.branchName).toBe(originalArtifact.branchName);
      expect(resultArtifact.sessionId).toBe(originalArtifact.sessionId);
    });
  });

  describe('canMoveToReady', () => {
    it('should return true when task has no dependencies', () => {
      const artifact: TaskArtifact = {
        id: 'task-001',
        title: 'Test',
        description: 'Test',
        priority: 1,
        dependencies: [],
        status: 'pending',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      expect(TaskConverter.canMoveToReady(artifact, [])).toBe(true);
    });

    it('should return true when all dependencies are completed', () => {
      const artifact: TaskArtifact = {
        id: 'task-002',
        title: 'Test',
        description: 'Test',
        priority: 1,
        dependencies: ['task-001'],
        status: 'pending',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const existingTasks: Task[] = [
        {
          id: 'task-001',
          title: 'Dep',
          description: 'Dep',
          priority: 2,
          dependencies: [],
          status: 'completed',
        },
      ];

      expect(TaskConverter.canMoveToReady(artifact, existingTasks)).toBe(true);
    });

    it('should return false when some dependencies are not completed', () => {
      const artifact: TaskArtifact = {
        id: 'task-003',
        title: 'Test',
        description: 'Test',
        priority: 1,
        dependencies: ['task-001', 'task-002'],
        status: 'pending',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const existingTasks: Task[] = [
        {
          id: 'task-001',
          title: 'Dep1',
          description: 'Dep1',
          priority: 2,
          dependencies: [],
          status: 'completed',
        },
        {
          id: 'task-002',
          title: 'Dep2',
          description: 'Dep2',
          priority: 2,
          dependencies: [],
          status: 'in_progress', // Not completed
        },
      ];

      expect(TaskConverter.canMoveToReady(artifact, existingTasks)).toBe(false);
    });

    it('should return false when dependency task is not found', () => {
      const artifact: TaskArtifact = {
        id: 'task-002',
        title: 'Test',
        description: 'Test',
        priority: 1,
        dependencies: ['task-001'],
        status: 'pending',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const existingTasks: Task[] = [];

      expect(TaskConverter.canMoveToReady(artifact, existingTasks)).toBe(false);
    });
  });
});
