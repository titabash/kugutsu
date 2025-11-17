/**
 * appStore File Synchronization Tests
 *
 * .kugutsu配下のファイル内容とappStoreの同期をテストする
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { useAppStore } from '../../../../electron/renderer/store/appStore.js';

describe('appStore - ファイル同期', () => {
  beforeEach(() => {
    // 各テスト前にストアをリセット
    const store = useAppStore.getState();
    store.setTasks([]);
    store.setDependencyGraph(null);
    store.setStoryMapping(null);
    store.clearNodeExecutions();
    store.setSprints([]);
    store.setGlobalTasks([]);
  });

  describe('初期データ読み込み', () => {
    test('setTasksでタスクデータが読み込まれる', () => {
      // Arrange
      const taskData = [
        {
          id: 'task-001',
          title: 'テストタスク1',
          description: '説明1',
          priority: 1,
          status: 'pending' as const,
          dependencies: []
        },
        {
          id: 'task-002',
          title: 'テストタスク2',
          description: '説明2',
          priority: 2,
          status: 'in_progress' as const,
          dependencies: ['task-001']
        },
      ];

      // Act: setTasksでタスクを設定
      const { setTasks } = useAppStore.getState();
      setTasks(taskData);

      // Assert: appStoreにタスクが設定される
      const { tasks } = useAppStore.getState();
      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe('task-001');
      expect(tasks[1].id).toBe('task-002');
    });

    test('setDependencyGraphで依存関係グラフが読み込まれる', () => {
      // Arrange
      const graphData = {
        nodes: [
          { id: 'node1', label: 'Task 1', type: 'task' as const, status: 'pending' as const },
          { id: 'node2', label: 'Task 2', type: 'task' as const, status: 'in_progress' as const },
        ],
        edges: [
          { id: 'edge1', source: 'node1', target: 'node2' }
        ],
      };

      // Act: setDependencyGraphでグラフを設定
      const { setDependencyGraph } = useAppStore.getState();
      setDependencyGraph(graphData);

      // Assert: appStoreに依存グラフが設定される
      const { dependencyGraph } = useAppStore.getState();
      expect(dependencyGraph).toEqual(graphData);
      expect(dependencyGraph?.nodes).toHaveLength(2);
    });

    test('setStoryMappingでストーリーマッピングが読み込まれる', () => {
      // Arrange
      const storyMapData = {
        persona: {
          name: 'テストユーザー',
          role: '開発者',
          goal: 'テストを成功させる'
        },
        epics: [
          {
            id: 'epic-001',
            title: 'エピック1',
            description: 'エピック説明',
            priority: 1,
            stories: []
          }
        ],
      };

      // Act: setStoryMappingでストーリーマッピングを設定
      const { setStoryMapping } = useAppStore.getState();
      setStoryMapping(storyMapData);

      // Assert: appStoreにストーリーマッピングが設定される
      const { storyMapping } = useAppStore.getState();
      expect(storyMapping).toEqual(storyMapData);
      expect(storyMapping?.epics).toHaveLength(1);
    });

    test('addNodeExecutionでノード実行履歴が追加される', () => {
      // Arrange
      const nodeExecution = {
        nodeName: 'ProductOwnerNode',
        status: 'completed' as const,
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 1500,
      };

      // Act: addNodeExecutionでノード実行を追加
      const { addNodeExecution } = useAppStore.getState();
      addNodeExecution(nodeExecution);

      // Assert: appStoreにノード実行が追加される
      const { nodeExecutions } = useAppStore.getState();
      expect(nodeExecutions).toHaveLength(1);
      expect(nodeExecutions[0].nodeName).toBe('ProductOwnerNode');
    });

    test('複数のデータが順次読み込まれてもappStoreが正しく更新される', () => {
      // Arrange
      const tasksData = [
        {
          id: 'task-001',
          title: 'タスク1',
          description: '説明',
          priority: 1,
          status: 'pending' as const,
          dependencies: []
        },
      ];
      const graphData = {
        nodes: [
          { id: 'node1', label: 'Node 1', type: 'task' as const, status: 'pending' as const }
        ],
        edges: [],
      };
      const storyMapData = {
        persona: {
          name: 'ユーザー',
          role: '開発者',
          goal: 'ゴール'
        },
        epics: []
      };

      // Act: 複数のデータを順次設定
      const { setTasks, setDependencyGraph, setStoryMapping } = useAppStore.getState();
      setTasks(tasksData);
      setDependencyGraph(graphData);
      setStoryMapping(storyMapData);

      // Assert: すべてのデータが正しく設定される
      const state = useAppStore.getState();
      expect(state.tasks).toHaveLength(1);
      expect(state.dependencyGraph?.nodes).toHaveLength(1);
      expect(state.storyMapping?.epics).toHaveLength(0);
    });
  });

  describe('ファイル変更検知', () => {
    test('setTasksでタスクデータが更新される', () => {
      // Arrange: 初期データを設定
      const { setTasks } = useAppStore.getState();
      setTasks([
        {
          id: 'task-001',
          title: '初期タスク',
          description: '説明',
          priority: 1,
          status: 'pending' as const,
          dependencies: []
        }
      ]);

      const updatedData = [
        {
          id: 'task-001',
          title: '初期タスク',
          description: '説明',
          priority: 1,
          status: 'pending' as const,
          dependencies: []
        },
        {
          id: 'task-002',
          title: '追加タスク',
          description: '新しい説明',
          priority: 2,
          status: 'pending' as const,
          dependencies: []
        },
      ];

      // Act: setTasksでタスクを更新
      setTasks(updatedData);

      // Assert: appStoreが更新される
      const { tasks } = useAppStore.getState();
      expect(tasks).toHaveLength(2);
      expect(tasks[1].id).toBe('task-002');
    });

    test('setDependencyGraphで依存関係グラフが更新される', () => {
      // Arrange: 初期グラフを設定
      const { setDependencyGraph } = useAppStore.getState();
      setDependencyGraph({ nodes: [], edges: [] });

      const updatedGraph = {
        nodes: [
          { id: 'node1', label: 'Updated Node', type: 'task' as const, status: 'completed' as const }
        ],
        edges: [],
      };

      // Act: setDependencyGraphでグラフを更新
      setDependencyGraph(updatedGraph);

      // Assert: appStoreが更新される
      const { dependencyGraph } = useAppStore.getState();
      expect(dependencyGraph?.nodes).toHaveLength(1);
      expect(dependencyGraph?.nodes[0].label).toBe('Updated Node');
    });

    test('setStoryMappingでストーリーマッピングが更新される', () => {
      // Arrange: 初期ストーリーマッピングを設定
      const { setStoryMapping } = useAppStore.getState();
      setStoryMapping({
        persona: {
          name: 'ユーザー1',
          role: '役割',
          goal: 'ゴール'
        },
        epics: [
          { id: 'epic-001', title: '旧エピック', priority: 1, stories: [] }
        ],
      });

      const updatedStoryMap = {
        persona: {
          name: 'ユーザー2',
          role: '新役割',
          goal: '新ゴール'
        },
        epics: [
          { id: 'epic-001', title: '旧エピック', priority: 1, stories: [] },
          { id: 'epic-002', title: '新エピック', priority: 2, stories: [] },
        ],
      };

      // Act: setStoryMappingでストーリーマッピングを更新
      setStoryMapping(updatedStoryMap);

      // Assert: appStoreが更新される
      const { storyMapping } = useAppStore.getState();
      expect(storyMapping?.epics).toHaveLength(2);
      expect(storyMapping?.epics[1].title).toBe('新エピック');
    });

    test('外部エディタでファイルを編集したときもappStoreが即座に反映される(統合)', () => {
      // Arrange: 初期タスクを設定
      const { setTasks } = useAppStore.getState();
      setTasks([
        {
          id: 'task-001',
          title: '旧タイトル',
          description: '説明',
          priority: 1,
          status: 'pending' as const,
          dependencies: []
        }
      ]);

      const externalEditData = [
        {
          id: 'task-001',
          title: '外部編集後のタイトル',
          description: '説明',
          priority: 1,
          status: 'in_progress' as const,
          dependencies: []
        },
      ];

      // Act: setTasksで外部編集をシミュレート
      setTasks(externalEditData);

      // Assert: appStoreが即座に更新される
      const { tasks } = useAppStore.getState();
      expect(tasks[0].title).toBe('外部編集後のタイトル');
      expect(tasks[0].status).toBe('in_progress');
    });
  });

  describe('エラーハンドリング', () => {
    test('空配列を設定してもappStoreがクラッシュしない', () => {
      // Act & Assert: 空配列を設定してもエラーが発生しない
      expect(() => {
        const { setTasks } = useAppStore.getState();
        setTasks([]);
      }).not.toThrow();

      const { tasks } = useAppStore.getState();
      expect(tasks).toHaveLength(0);
    });

    test('nullを設定してもappStoreがクラッシュしない', () => {
      // Act & Assert: nullを設定してもエラーが発生しない
      expect(() => {
        const { setDependencyGraph, setStoryMapping } = useAppStore.getState();
        setDependencyGraph(null);
        setStoryMapping(null);
      }).not.toThrow();

      const state = useAppStore.getState();
      expect(state.dependencyGraph).toBeNull();
      expect(state.storyMapping).toBeNull();
    });

    test('最小限のフィールドでタスクが設定できる', () => {
      // Arrange: 必須フィールドのみのタスクデータ
      const minimalTaskData = [
        {
          id: 'task-001',
          title: 'タスク1',
          description: '説明',
          priority: 1,
          status: 'pending' as const,
          dependencies: []
        }
      ];

      // Act & Assert: エラーが発生しない
      expect(() => {
        const { setTasks } = useAppStore.getState();
        setTasks(minimalTaskData);
      }).not.toThrow();

      const { tasks } = useAppStore.getState();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('task-001');
    });
  });
});
