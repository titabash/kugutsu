/**
 * Message Filter Utility Tests (TDD - RED Phase)
 *
 * AIノードからのメッセージフィルタリングのテスト
 * 空メッセージや空白のみのメッセージをフィルタリングする
 */

import { describe, it, expect } from 'vitest';

// まだ存在しないユーティリティをインポート（RED phase）
import { shouldDisplayMessage, formatNodeMessage } from '../../renderer/utils/messageFilter';

describe('messageFilter', () => {
  describe('shouldDisplayMessage', () => {
    describe('空メッセージのフィルタリング', () => {
      it('空文字列の場合はfalseを返すこと', () => {
        expect(shouldDisplayMessage('')).toBe(false);
      });

      it('空白のみの場合はfalseを返すこと', () => {
        expect(shouldDisplayMessage('   ')).toBe(false);
      });

      it('改行のみの場合はfalseを返すこと', () => {
        expect(shouldDisplayMessage('\n')).toBe(false);
      });

      it('タブのみの場合はfalseを返すこと', () => {
        expect(shouldDisplayMessage('\t')).toBe(false);
      });

      it('空白と改行の組み合わせの場合はfalseを返すこと', () => {
        expect(shouldDisplayMessage('  \n  \t  ')).toBe(false);
      });
    });

    describe('有効なメッセージの許可', () => {
      it('通常のテキストの場合はtrueを返すこと', () => {
        expect(shouldDisplayMessage('Hello, World!')).toBe(true);
      });

      it('日本語テキストの場合はtrueを返すこと', () => {
        expect(shouldDisplayMessage('こんにちは')).toBe(true);
      });

      it('前後に空白があるテキストの場合はtrueを返すこと', () => {
        expect(shouldDisplayMessage('  有効なメッセージ  ')).toBe(true);
      });

      it('改行を含むテキストの場合はtrueを返すこと', () => {
        expect(shouldDisplayMessage('行1\n行2')).toBe(true);
      });

      it('1文字のみの場合もtrueを返すこと', () => {
        expect(shouldDisplayMessage('a')).toBe(true);
      });
    });

    describe('nullやundefinedの処理', () => {
      it('nullの場合はfalseを返すこと', () => {
        expect(shouldDisplayMessage(null as unknown as string)).toBe(false);
      });

      it('undefinedの場合はfalseを返すこと', () => {
        expect(shouldDisplayMessage(undefined as unknown as string)).toBe(false);
      });
    });
  });

  describe('formatNodeMessage', () => {
    it('ノードラベルとメッセージを正しくフォーマットすること', () => {
      const result = formatNodeMessage('Engineer', 'こんにちは');
      expect(result).toBe('**Engineer**: こんにちは');
    });

    it('メッセージの前後の空白をトリムすること', () => {
      const result = formatNodeMessage('Engineer', '  メッセージ  ');
      expect(result).toBe('**Engineer**: メッセージ');
    });

    it('空メッセージの場合はnullを返すこと', () => {
      const result = formatNodeMessage('Engineer', '');
      expect(result).toBeNull();
    });

    it('空白のみのメッセージの場合はnullを返すこと', () => {
      const result = formatNodeMessage('Engineer', '   ');
      expect(result).toBeNull();
    });

    it('改行のみのメッセージの場合はnullを返すこと', () => {
      const result = formatNodeMessage('Engineer', '\n\n');
      expect(result).toBeNull();
    });
  });
});
