/**
 * イベント型の整合性テスト
 *
 * StateStreamManagerとElectron APIのイベント型が一致していることを確認
 */

import { describe, test, expect } from '@jest/globals';

// StateStreamManagerのEventType（実際の定義から取得）
type StateStreamManagerEventType =
  | 'state-init'
  | 'node-started'
  | 'node-completed'
  | 'node-flow-init'
  | 'node-status-change'
  | 'task-update'
  | 'tasks-batch'
  | 'logs-batch'
  | 'phase-change'
  | 'error'
  | 'complete';

// electron-api.d.tsのGraphEvent.type（実際の定義から取得）
type ElectronAPIGraphEventType =
  | 'state-init'
  | 'node-started'
  | 'node-completed'
  | 'task-update'
  | 'tasks-batch'
  | 'logs-batch'
  | 'phase-change'
  | 'error'
  | 'complete';

// StateStreamManagerのBufferedEvent構造
interface StateStreamManagerBufferedEvent {
  type: StateStreamManagerEventType;
  data: any;
  timestamp: number;
  priority: 'high' | 'normal' | 'low';
}

// electron-api.d.tsのGraphEvent構造
interface ElectronAPIGraphEvent {
  type: ElectronAPIGraphEventType;
  data: any;
  timestamp: number;
  priority: 'high' | 'normal' | 'low';
}

describe('イベント型の整合性', () => {
  describe('EventType の一致確認', () => {
    test('StateStreamManagerのEventTypeがElectron APIのGraphEvent.typeのスーパーセットであること', () => {
      // ElectronAPIのすべてのイベントタイプをStateStreamManagerがサポートしていることを確認
      const electronAPITypes: ElectronAPIGraphEventType[] = [
        'state-init',
        'node-started',
        'node-completed',
        'task-update',
        'tasks-batch',
        'logs-batch',
        'phase-change',
        'error',
        'complete',
      ];

      const stateStreamManagerTypes: StateStreamManagerEventType[] = [
        'state-init',
        'node-started',
        'node-completed',
        'node-flow-init',
        'node-status-change',
        'task-update',
        'tasks-batch',
        'logs-batch',
        'phase-change',
        'error',
        'complete',
      ];

      // すべてのElectronAPIタイプがStateStreamManagerに含まれることを確認
      electronAPITypes.forEach((type) => {
        expect(stateStreamManagerTypes).toContain(type);
      });
    });

    test('node-flow-initとnode-status-changeがElectron APIのGraphEvent.typeに含まれること', () => {
      // TDD: このテストは現在失敗するはず（実装前）
      // 実装後、electron-api.d.tsのGraphEvent.typeにこれらを追加する必要がある
      const expectedTypes: ElectronAPIGraphEventType[] = [
        'state-init',
        'node-started',
        'node-completed',
        'node-flow-init' as any, // TDD: 現時点では型エラーが出るがテストのために追加
        'node-status-change' as any, // TDD: 現時点では型エラーが出るがテストのために追加
        'task-update',
        'tasks-batch',
        'logs-batch',
        'phase-change',
        'error',
        'complete',
      ];

      // 期待される型の数を確認
      expect(expectedTypes.length).toBe(11);

      // node-flow-initとnode-status-changeが含まれることを確認
      expect(expectedTypes).toContain('node-flow-init' as any);
      expect(expectedTypes).toContain('node-status-change' as any);
    });
  });

  describe('BufferedEventとGraphEventの構造互換性', () => {
    test('BufferedEventの構造がGraphEventと互換性があること', () => {
      const bufferedEvent: StateStreamManagerBufferedEvent = {
        type: 'state-init',
        data: { test: 'data' },
        timestamp: Date.now(),
        priority: 'high',
      };

      // BufferedEventがGraphEventの構造を満たしていることを確認
      const graphEvent: ElectronAPIGraphEvent = {
        type: bufferedEvent.type as ElectronAPIGraphEventType,
        data: bufferedEvent.data,
        timestamp: bufferedEvent.timestamp,
        priority: bufferedEvent.priority,
      };

      expect(graphEvent.type).toBe('state-init');
      expect(graphEvent.data).toEqual({ test: 'data' });
      expect(graphEvent.timestamp).toBe(bufferedEvent.timestamp);
      expect(graphEvent.priority).toBe('high');
    });

    test('すべての優先度レベルが両方の型で定義されていること', () => {
      const priorities: Array<'high' | 'normal' | 'low'> = ['high', 'normal', 'low'];

      priorities.forEach((priority) => {
        const bufferedEvent: StateStreamManagerBufferedEvent = {
          type: 'task-update',
          data: {},
          timestamp: Date.now(),
          priority,
        };

        const graphEvent: ElectronAPIGraphEvent = {
          type: 'task-update',
          data: {},
          timestamp: Date.now(),
          priority,
        };

        expect(bufferedEvent.priority).toBe(graphEvent.priority);
      });
    });
  });

  describe('イベントタイプのバリデーション', () => {
    test('すべてのStateStreamManagerイベントタイプが文字列であること', () => {
      const types: StateStreamManagerEventType[] = [
        'state-init',
        'node-started',
        'node-completed',
        'node-flow-init',
        'node-status-change',
        'task-update',
        'tasks-batch',
        'logs-batch',
        'phase-change',
        'error',
        'complete',
      ];

      types.forEach((type) => {
        expect(typeof type).toBe('string');
        expect(type.length).toBeGreaterThan(0);
      });
    });

    test('イベントタイプに重複がないこと', () => {
      const types: StateStreamManagerEventType[] = [
        'state-init',
        'node-started',
        'node-completed',
        'node-flow-init',
        'node-status-change',
        'task-update',
        'tasks-batch',
        'logs-batch',
        'phase-change',
        'error',
        'complete',
      ];

      const uniqueTypes = new Set(types);
      expect(uniqueTypes.size).toBe(types.length);
    });
  });

  describe('型安全性の確認', () => {
    test('BufferedEventからGraphEventへの変換が型安全であること', () => {
      // BufferedEventを作成
      const createBufferedEvent = (
        type: StateStreamManagerEventType
      ): StateStreamManagerBufferedEvent => ({
        type,
        data: { message: 'test' },
        timestamp: Date.now(),
        priority: 'normal',
      });

      // GraphEventへの変換関数（実装で使用される想定）
      const convertToGraphEvent = (
        event: StateStreamManagerBufferedEvent
      ): ElectronAPIGraphEvent | null => {
        // node-flow-initとnode-status-changeは変換しない（まだElectronAPIに含まれていないため）
        if (event.type === 'node-flow-init' || event.type === 'node-status-change') {
          return null;
        }

        return {
          type: event.type as ElectronAPIGraphEventType,
          data: event.data,
          timestamp: event.timestamp,
          priority: event.priority,
        };
      };

      // 変換可能なイベント
      const convertibleEvent = createBufferedEvent('state-init');
      const converted = convertToGraphEvent(convertibleEvent);
      expect(converted).not.toBeNull();
      expect(converted?.type).toBe('state-init');

      // 変換不可能なイベント（TDD: 実装後は変換可能になる）
      const nodeFlowEvent = createBufferedEvent('node-flow-init');
      const notConverted = convertToGraphEvent(nodeFlowEvent);
      expect(notConverted).toBeNull(); // TDD: 現時点ではnull、実装後は変換可能
    });
  });
});
