import { describe, it, expect } from '@jest/globals';
import type { LogEntry } from '../../src/graph/types.js';

describe('LogEntry型の拡張', () => {
  describe('engineerId フィールド', () => {
    it('engineerIdフィールドが存在し、string型として設定できること', () => {
      const logEntry: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'EngineerNode',
        message: 'タスク実行中',
        engineerId: 'engineer-1',
      };

      expect(logEntry.engineerId).toBe('engineer-1');
      expect(typeof logEntry.engineerId).toBe('string');
    });

    it('engineerIdフィールドはオプショナルであること', () => {
      const logEntry: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'ProductOwnerNode',
        message: 'タスク分解中',
      };

      expect(logEntry.engineerId).toBeUndefined();
    });

    it('engineerIdから"engineer-1"のような形式でエンジニアを識別できること', () => {
      const log1: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'EngineerNode',
        message: 'Engineer 1の作業',
        engineerId: 'engineer-1',
      };

      const log2: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'EngineerNode',
        message: 'Engineer 2の作業',
        engineerId: 'engineer-2',
      };

      expect(log1.engineerId).toBe('engineer-1');
      expect(log2.engineerId).toBe('engineer-2');
      expect(log1.engineerId).not.toBe(log2.engineerId);
    });
  });

  describe('nodeType フィールド', () => {
    it('nodeTypeフィールドが存在し、string型として設定できること', () => {
      const logEntry: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'EngineerNode',
        message: 'コード実装中',
        nodeType: 'EngineerNode',
      };

      expect(logEntry.nodeType).toBe('EngineerNode');
      expect(typeof logEntry.nodeType).toBe('string');
    });

    it('nodeTypeフィールドはオプショナルであること', () => {
      const logEntry: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'SystemLogger',
        message: 'システムログ',
      };

      expect(logEntry.nodeType).toBeUndefined();
    });

    it('nodeTypeで異なるノードタイプを識別できること', () => {
      const engineerLog: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'EngineerNode',
        message: 'コード実装',
        nodeType: 'EngineerNode',
      };

      const reviewLog: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'ReviewNode',
        message: 'コードレビュー',
        nodeType: 'ReviewNode',
      };

      const productOwnerLog: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'ProductOwnerNode',
        message: 'タスク分解',
        nodeType: 'ProductOwnerNode',
      };

      expect(engineerLog.nodeType).toBe('EngineerNode');
      expect(reviewLog.nodeType).toBe('ReviewNode');
      expect(productOwnerLog.nodeType).toBe('ProductOwnerNode');
    });
  });

  describe('provider フィールド', () => {
    it('providerフィールドが存在し、"claude"を設定できること', () => {
      const logEntry: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'EngineerNode',
        message: 'Claude Agent SDK で実行中',
        provider: 'claude',
      };

      expect(logEntry.provider).toBe('claude');
    });

    it('providerフィールドに"codex"を設定できること', () => {
      const logEntry: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'EngineerNode',
        message: 'Codex SDK で実行中',
        provider: 'codex',
      };

      expect(logEntry.provider).toBe('codex');
    });

    it('providerフィールドに"system"を設定できること', () => {
      const logEntry: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'SystemLogger',
        message: 'システムイベント',
        provider: 'system',
      };

      expect(logEntry.provider).toBe('system');
    });

    it('providerフィールドはオプショナルであること', () => {
      const logEntry: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'TestLogger',
        message: 'テストログ',
      };

      expect(logEntry.provider).toBeUndefined();
    });

    it('providerフィールドは"claude" | "codex" | "system"のいずれかのみ設定可能であること', () => {
      // TypeScript型チェックによる制約のテスト
      const claudeLog: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'EngineerNode',
        message: 'Claude使用',
        provider: 'claude' as const,
      };

      const codexLog: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'EngineerNode',
        message: 'Codex使用',
        provider: 'codex' as const,
      };

      const systemLog: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'SystemLogger',
        message: 'System使用',
        provider: 'system' as const,
      };

      expect(['claude', 'codex', 'system']).toContain(claudeLog.provider);
      expect(['claude', 'codex', 'system']).toContain(codexLog.provider);
      expect(['claude', 'codex', 'system']).toContain(systemLog.provider);
    });
  });

  describe('複合的な使用', () => {
    it('すべての新規フィールドを同時に使用できること', () => {
      const logEntry: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'EngineerNode',
        message: 'タスク完了',
        taskId: 'task-1234',
        engineerId: 'engineer-1',
        nodeType: 'EngineerNode',
        provider: 'claude',
      };

      expect(logEntry.engineerId).toBe('engineer-1');
      expect(logEntry.nodeType).toBe('EngineerNode');
      expect(logEntry.provider).toBe('claude');
    });

    it('既存のフィールドと新規フィールドが共存できること', () => {
      const logEntry: LogEntry = {
        timestamp: new Date(),
        level: 'success',
        source: 'EngineerNode',
        message: 'コード実装完了',
        data: { filesChanged: 3 },
        taskId: 'task-5678',
        sessionId: 'session-abcd',
        engineerId: 'engineer-2',
        nodeType: 'EngineerNode',
        provider: 'codex',
      };

      // 既存フィールド
      expect(logEntry.level).toBe('success');
      expect(logEntry.data).toEqual({ filesChanged: 3 });
      expect(logEntry.taskId).toBe('task-5678');
      expect(logEntry.sessionId).toBe('session-abcd');

      // 新規フィールド
      expect(logEntry.engineerId).toBe('engineer-2');
      expect(logEntry.nodeType).toBe('EngineerNode');
      expect(logEntry.provider).toBe('codex');
    });

    it('ReviewNodeのログでengineerIdの代わりにreviewerIdを表現できること', () => {
      // reviewerIdはengineerIdフィールドを流用
      const reviewLog: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        source: 'ReviewNode',
        message: 'コードレビュー実施中',
        nodeType: 'ReviewNode',
        engineerId: 'reviewer-1', // reviewerIdとして使用
        provider: 'claude',
      };

      expect(reviewLog.nodeType).toBe('ReviewNode');
      expect(reviewLog.engineerId).toBe('reviewer-1');
    });
  });
});
