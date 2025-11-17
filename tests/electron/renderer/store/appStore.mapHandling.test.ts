/**
 * appStore Map型処理のユニットテスト
 *
 * ZustandでのMap型のシリアライズ/デシリアライズ問題のテスト
 */

import { describe, test, expect, beforeEach } from '@jest/globals';

// 型定義
interface NodeExecution {
  nodeName: string;
  status: 'started' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  error?: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'ready' | 'in_progress' | 'in_review' | 'completed' | 'failed';
}

// モックストアの作成
interface MockStoreState {
  // Map型を使用したフィールド
  activeNodes: Map<string, NodeExecution>;
  tasksById: Map<string, Task>;

  // Arrayベースの代替フィールド（修正後に使用）
  activeNodesArray?: Array<[string, NodeExecution]>;
  tasksByIdArray?: Array<[string, Task]>;

  // Actions
  addActiveNode: (nodeName: string, execution: NodeExecution) => void;
  removeActiveNode: (nodeName: string) => void;
  getActiveNode: (nodeName: string) => NodeExecution | undefined;

  addTask: (task: Task) => void;
  getTask: (taskId: string) => Task | undefined;

  // Serialization helpers (実装で使用される想定)
  serializeState: () => any;
  deserializeState: (serialized: any) => void;
}

function createMockStore(): MockStoreState {
  let activeNodes = new Map<string, NodeExecution>();
  let tasksById = new Map<string, Task>();

  return {
    activeNodes,
    tasksById,

    addActiveNode: (nodeName: string, execution: NodeExecution) => {
      activeNodes.set(nodeName, execution);
    },

    removeActiveNode: (nodeName: string) => {
      activeNodes.delete(nodeName);
    },

    getActiveNode: (nodeName: string) => {
      return activeNodes.get(nodeName);
    },

    addTask: (task: Task) => {
      tasksById.set(task.id, task);
    },

    getTask: (taskId: string) => {
      return tasksById.get(taskId);
    },

    serializeState: () => {
      // Map → Array変換（JSON.stringifyで正しく処理されるように）
      return {
        activeNodesArray: Array.from(activeNodes.entries()),
        tasksByIdArray: Array.from(tasksById.entries()),
      };
    },

    deserializeState: (serialized: any) => {
      // Array → Map変換
      if (serialized.activeNodesArray) {
        activeNodes = new Map(serialized.activeNodesArray);
      }
      if (serialized.tasksByIdArray) {
        tasksById = new Map(serialized.tasksByIdArray);
      }
    },
  };
}

describe('appStore - Map型処理', () => {
  let store: MockStoreState;

  beforeEach(() => {
    store = createMockStore();
  });

  describe('Map型の基本操作', () => {
    test('activeNodesにNodeExecutionを追加できること', () => {
      const execution: NodeExecution = {
        nodeName: 'product_owner',
        status: 'started',
        startedAt: new Date(),
      };

      store.addActiveNode('product_owner', execution);

      const retrieved = store.getActiveNode('product_owner');
      expect(retrieved).toBeDefined();
      expect(retrieved?.nodeName).toBe('product_owner');
      expect(retrieved?.status).toBe('started');
    });

    test('tasksByIdにTaskを追加できること', () => {
      const task: Task = {
        id: 'task-1',
        title: 'Test Task',
        description: 'Test Description',
        status: 'pending',
      };

      store.addTask(task);

      const retrieved = store.getTask('task-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('task-1');
      expect(retrieved?.title).toBe('Test Task');
    });

    test('activeNodesからNodeExecutionを削除できること', () => {
      const execution: NodeExecution = {
        nodeName: 'engineer',
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
      };

      store.addActiveNode('engineer', execution);
      expect(store.getActiveNode('engineer')).toBeDefined();

      store.removeActiveNode('engineer');
      expect(store.getActiveNode('engineer')).toBeUndefined();
    });
  });

  describe('Map型のシリアライズ/デシリアライズ', () => {
    test('activeNodesがJSON.stringifyで正しくシリアライズできること', () => {
      const execution: NodeExecution = {
        nodeName: 'product_owner',
        status: 'started',
        startedAt: new Date(),
      };

      store.addActiveNode('product_owner', execution);

      // Mapを直接JSON.stringifyすると空オブジェクトになる問題
      const directSerialized = JSON.stringify(store.activeNodes);
      expect(directSerialized).toBe('{}'); // Map型は空オブジェクトになる

      // serializeState経由で正しくシリアライズできることを確認
      const serialized = store.serializeState();
      const jsonString = JSON.stringify(serialized);

      expect(jsonString).toContain('product_owner');
      expect(jsonString).toContain('started');
    });

    test('デシリアライズ後にMap型が正しく復元されること', () => {
      const execution: NodeExecution = {
        nodeName: 'engineer',
        status: 'completed',
        startedAt: new Date('2024-01-01'),
        completedAt: new Date('2024-01-02'),
        duration: 86400000,
      };

      store.addActiveNode('engineer', execution);

      // シリアライズ
      const serialized = store.serializeState();
      const jsonString = JSON.stringify(serialized);

      // 新しいストアを作成してデシリアライズ
      const newStore = createMockStore();
      const parsed = JSON.parse(jsonString);
      newStore.deserializeState(parsed);

      // 復元されたデータが正しいことを確認
      const retrieved = newStore.getActiveNode('engineer');
      expect(retrieved).toBeDefined();
      expect(retrieved?.nodeName).toBe('engineer');
      expect(retrieved?.status).toBe('completed');
      expect(retrieved?.duration).toBe(86400000);
    });

    test('複数のエントリーがあるMapをシリアライズ/デシリアライズできること', () => {
      const tasks: Task[] = [
        { id: 'task-1', title: 'Task 1', description: 'Desc 1', status: 'pending' },
        { id: 'task-2', title: 'Task 2', description: 'Desc 2', status: 'in_progress' },
        { id: 'task-3', title: 'Task 3', description: 'Desc 3', status: 'completed' },
      ];

      tasks.forEach((task) => store.addTask(task));

      // シリアライズ
      const serialized = store.serializeState();
      const jsonString = JSON.stringify(serialized);

      // デシリアライズ
      const newStore = createMockStore();
      const parsed = JSON.parse(jsonString);
      newStore.deserializeState(parsed);

      // すべてのタスクが復元されていることを確認
      tasks.forEach((task) => {
        const retrieved = newStore.getTask(task.id);
        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(task.id);
        expect(retrieved?.title).toBe(task.title);
        expect(retrieved?.status).toBe(task.status);
      });
    });

    test('空のMapが正しくシリアライズ/デシリアライズできること', () => {
      // 空のMap
      const serialized = store.serializeState();
      const jsonString = JSON.stringify(serialized);

      // デシリアライズ
      const newStore = createMockStore();
      const parsed = JSON.parse(jsonString);
      newStore.deserializeState(parsed);

      expect(newStore.activeNodes.size).toBe(0);
      expect(newStore.tasksById.size).toBe(0);
    });
  });

  describe('Map vs Array のパフォーマンス', () => {
    test('Map型での高速な検索ができること', () => {
      // 100個のタスクを追加
      for (let i = 0; i < 100; i++) {
        const task: Task = {
          id: `task-${i}`,
          title: `Task ${i}`,
          description: `Description ${i}`,
          status: 'pending',
        };
        store.addTask(task);
      }

      // Map型でのget操作は O(1)
      const startTime = Date.now();
      const task = store.getTask('task-50');
      const endTime = Date.now();

      expect(task).toBeDefined();
      expect(task?.id).toBe('task-50');
      expect(endTime - startTime).toBeLessThan(10); // 非常に高速
    });

    test('Mapのサイズが正しく取得できること', () => {
      expect(store.activeNodes.size).toBe(0);

      const execution: NodeExecution = {
        nodeName: 'node1',
        status: 'started',
        startedAt: new Date(),
      };

      store.addActiveNode('node1', execution);
      expect(store.activeNodes.size).toBe(1);

      store.addActiveNode('node2', { ...execution, nodeName: 'node2' });
      expect(store.activeNodes.size).toBe(2);
    });
  });

  describe('Mapのイテレーション', () => {
    test('Map.entries()で全エントリーをイテレートできること', () => {
      const tasks: Task[] = [
        { id: 'task-1', title: 'Task 1', description: 'Desc 1', status: 'pending' },
        { id: 'task-2', title: 'Task 2', description: 'Desc 2', status: 'in_progress' },
      ];

      tasks.forEach((task) => store.addTask(task));

      const entries = Array.from(store.tasksById.entries());
      expect(entries.length).toBe(2);

      const [id1, task1] = entries[0];
      expect(id1).toBe('task-1');
      expect(task1.title).toBe('Task 1');
    });

    test('Map.values()で全値をイテレートできること', () => {
      const execution1: NodeExecution = {
        nodeName: 'node1',
        status: 'started',
        startedAt: new Date(),
      };
      const execution2: NodeExecution = {
        nodeName: 'node2',
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
      };

      store.addActiveNode('node1', execution1);
      store.addActiveNode('node2', execution2);

      const values = Array.from(store.activeNodes.values());
      expect(values.length).toBe(2);
      expect(values[0].nodeName).toBe('node1');
      expect(values[1].nodeName).toBe('node2');
    });
  });
});
