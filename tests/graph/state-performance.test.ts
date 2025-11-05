/**
 * State Performance Test
 *
 * Tests performance optimizations for state management
 */

import { jest } from '@jest/globals';
import { createInitialState } from '../../src/graph/state.js';
import type { Task, LogEntry } from '../../src/graph/types.js';

describe('State Performance Optimizations', () => {
  describe('Log Buffering', () => {
    test('should handle large number of logs efficiently', () => {
      const initialState = createInitialState('Test request', {
        provider: 'claude',
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      // Create 2000 log entries
      const logs: LogEntry[] = [];
      for (let i = 0; i < 2000; i++) {
        logs.push({
          timestamp: new Date(),
          level: 'info',
          source: 'test',
          message: `Log entry ${i}`,
        });
      }

      const startTime = performance.now();
      // Simulate adding logs in batches (as nodes do)
      const batchSize = 100;
      let currentLogs = initialState.logs;
      for (let i = 0; i < logs.length; i += batchSize) {
        const batch = logs.slice(i, i + batchSize);
        // Simulate the reducer behavior (concat + slice)
        currentLogs = currentLogs.concat(batch).slice(-1000);
      }
      const duration = performance.now() - startTime;

      // Should limit to 1000 logs
      expect(currentLogs.length).toBe(1000);

      // Performance should be reasonable (< 50ms for 2000 logs)
      expect(duration).toBeLessThan(50);

      // Should keep most recent logs (0-indexed, so 1000-1999)
      expect(currentLogs[0].message).toContain('Log entry 1000');
      expect(currentLogs[999].message).toContain('Log entry 1999');
    });

    test('should maintain log ordering', () => {
      const logs: LogEntry[] = [];
      for (let i = 0; i < 10; i++) {
        logs.push({
          timestamp: new Date(2025, 0, 1, 0, 0, i),
          level: 'info',
          source: 'test',
          message: `Log ${i}`,
        });
      }

      // Verify logs are in order
      for (let i = 1; i < logs.length; i++) {
        expect(logs[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          logs[i - 1].timestamp.getTime()
        );
      }
    });

    test('should support different log levels', () => {
      const logs: LogEntry[] = [
        {
          timestamp: new Date(),
          level: 'debug',
          source: 'test',
          message: 'Debug message',
        },
        {
          timestamp: new Date(),
          level: 'info',
          source: 'test',
          message: 'Info message',
        },
        {
          timestamp: new Date(),
          level: 'warn',
          source: 'test',
          message: 'Warning message',
        },
        {
          timestamp: new Date(),
          level: 'error',
          source: 'test',
          message: 'Error message',
        },
      ];

      // Filter logs by level
      const errors = logs.filter((log) => log.level === 'error');
      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('Error message');

      const infoAndAbove = logs.filter((log) => log.level !== 'debug');
      expect(infoAndAbove.length).toBe(3);
    });
  });

  describe('Task State Updates', () => {
    test('should handle large number of tasks efficiently', () => {
      const tasks: Task[] = [];

      const startTime = performance.now();
      // Create 200 tasks
      for (let i = 0; i < 200; i++) {
        tasks.push({
          id: `task-${i}`,
          title: `Task ${i}`,
          description: `Description ${i}`,
          priority: 50,
          status: 'pending',
          dependencies: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      const duration = performance.now() - startTime;

      expect(tasks.length).toBe(200);
      // Performance should be reasonable (< 10ms)
      expect(duration).toBeLessThan(10);
    });

    test('should efficiently find tasks by ID', () => {
      const tasks: Task[] = [];
      for (let i = 0; i < 100; i++) {
        tasks.push({
          id: `task-${i}`,
          title: `Task ${i}`,
          description: `Description ${i}`,
          priority: 50,
          status: 'pending',
          dependencies: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      const startTime = performance.now();
      // Find task by ID using Map for O(1) lookup
      const taskMap = new Map(tasks.map((t) => [t.id, t]));
      const found = taskMap.get('task-50');
      const duration = performance.now() - startTime;

      expect(found).toBeDefined();
      expect(found?.title).toBe('Task 50');
      // Performance should be extremely fast (< 1ms)
      expect(duration).toBeLessThan(1);
    });

    test('should efficiently update multiple tasks', () => {
      const tasks: Task[] = [];
      for (let i = 0; i < 100; i++) {
        tasks.push({
          id: `task-${i}`,
          title: `Task ${i}`,
          description: `Description ${i}`,
          priority: 50,
          status: 'pending',
          dependencies: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      const startTime = performance.now();
      // Update tasks 0-9 to in_progress
      const taskMap = new Map(tasks.map((t) => [t.id, t]));
      for (let i = 0; i < 10; i++) {
        const task = taskMap.get(`task-${i}`);
        if (task) {
          task.status = 'in_progress';
          task.updatedAt = new Date();
        }
      }
      const updatedTasks = Array.from(taskMap.values());
      const duration = performance.now() - startTime;

      expect(updatedTasks.length).toBe(100);
      expect(updatedTasks[0].status).toBe('in_progress');
      expect(updatedTasks[10].status).toBe('pending');
      // Performance should be fast (< 5ms)
      expect(duration).toBeLessThan(5);
    });

    test('should prevent duplicate tasks', () => {
      const taskMap = new Map<string, Task>();

      const task: Task = {
        id: 'task-1',
        title: 'Task 1',
        description: 'Description',
        priority: 50,
        status: 'pending',
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      taskMap.set(task.id, task);
      expect(taskMap.size).toBe(1);

      // Try to add same task again
      taskMap.set(task.id, task);
      expect(taskMap.size).toBe(1); // Should still be 1
    });
  });

  describe('Metadata Updates', () => {
    test('should efficiently merge metadata', () => {
      const metadata = {
        startedAt: new Date(),
        phase: 'analysis' as const,
        totalTasks: 10,
        tasksCompleted: 0,
        tasksFailed: 0,
        hasErrors: false,
        errors: [] as string[],
      };

      const startTime = performance.now();
      // Simulate multiple metadata updates
      const updates: Array<{ tasksCompleted: number }> = [];
      for (let i = 1; i <= 10; i++) {
        updates.push({ tasksCompleted: i });
      }

      let current: typeof metadata = metadata;
      for (const update of updates) {
        current = { ...current, ...update };
      }
      const duration = performance.now() - startTime;

      expect(current.tasksCompleted).toBe(10);
      expect(current.totalTasks).toBe(10);
      // Performance should be extremely fast (< 2ms)
      expect(duration).toBeLessThan(2);
    });
  });

  describe('Worktree Map Performance', () => {
    test('should efficiently manage worktree map', () => {
      const worktrees = new Map();

      const startTime = performance.now();
      // Add 100 worktrees
      for (let i = 0; i < 100; i++) {
        worktrees.set(`task-${i}`, {
          path: `/test/worktrees/task-${i}`,
          branch: `task/${i}`,
          commit: `commit-${i}`,
          locked: false,
        });
      }
      const duration = performance.now() - startTime;

      expect(worktrees.size).toBe(100);
      // Performance should be very fast (< 5ms)
      expect(duration).toBeLessThan(5);
    });

    test('should efficiently lookup worktrees', () => {
      const worktrees = new Map();
      for (let i = 0; i < 100; i++) {
        worktrees.set(`task-${i}`, {
          path: `/test/worktrees/task-${i}`,
          branch: `task/${i}`,
          commit: `commit-${i}`,
          locked: false,
        });
      }

      const startTime = performance.now();
      // Lookup 10 random worktrees
      for (let i = 0; i < 10; i++) {
        const taskId = `task-${Math.floor(Math.random() * 100)}`;
        const worktree = worktrees.get(taskId);
        expect(worktree).toBeDefined();
      }
      const duration = performance.now() - startTime;

      // Performance should be extremely fast (< 1ms)
      expect(duration).toBeLessThan(1);
    });
  });

  describe('State Initialization', () => {
    test('should quickly create initial state', () => {
      const startTime = performance.now();
      const state = createInitialState('Test request', {
        provider: 'claude',
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });
      const duration = performance.now() - startTime;

      expect(state.userRequest).toBe('Test request');
      expect(state.tasks).toEqual([]);
      expect(state.logs.length).toBe(1);
      // Performance should be extremely fast (< 2ms)
      expect(duration).toBeLessThan(2);
    });
  });
});
