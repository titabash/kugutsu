/**
 * Reviewer AI Response Fixtures
 *
 * Mock AI responses for ReviewNode testing
 */

import type { MockResponse } from '../../../src/providers/MockAIProvider.js';
import { createMockMessage } from '../../../src/providers/MockAIProvider.js';

/**
 * Approved review response
 */
export const approvedReviewResponse: MockResponse = {
  messages: [
    createMockMessage.assistant(
      'コードレビューを行います。\n\n```json\n' +
        JSON.stringify(
          {
            status: 'approved',
            comments: '実装は問題ありません。承認します。',
            suggestions: [],
          },
          null,
          2
        ) +
        '\n```'
    ),
    createMockMessage.result(true),
  ],
};

/**
 * Changes requested review response
 */
export const changesRequestedReviewResponse: MockResponse = {
  messages: [
    createMockMessage.assistant(
      'コードレビューを行います。\n\n```json\n' +
        JSON.stringify(
          {
            status: 'changes_requested',
            comments: '以下の修正が必要です。',
            suggestions: [
              'エラーハンドリングを追加してください',
              'テストケースが不足しています',
              'TypeScript型定義を追加してください',
            ],
          },
          null,
          2
        ) +
        '\n```'
    ),
    createMockMessage.result(true),
  ],
};

/**
 * Detailed review with specific comments
 */
export const detailedReviewResponse: MockResponse = {
  messages: [
    createMockMessage.assistant(
      'コードレビューを行います。\n\n```json\n' +
        JSON.stringify(
          {
            status: 'changes_requested',
            comments: '全体的には良い実装ですが、いくつか改善点があります。',
            suggestions: [
              {
                file: 'src/components/Button.tsx',
                line: 5,
                message: 'アクセシビリティのためaria-labelを追加してください',
                severity: 'warning',
              },
              {
                file: 'src/components/Button.tsx',
                line: 8,
                message: 'ボタンのdisabled状態のスタイルを追加してください',
                severity: 'suggestion',
              },
              {
                file: 'src/components/Button.test.tsx',
                line: 0,
                message: 'テストファイルが見つかりません',
                severity: 'error',
              },
            ],
          },
          null,
          2
        ) +
        '\n```'
    ),
    createMockMessage.result(true),
  ],
};

/**
 * Performance concern review
 */
export const performanceConcernReviewResponse: MockResponse = {
  messages: [
    createMockMessage.assistant(
      'コードレビューを行います。\n\n```json\n' +
        JSON.stringify(
          {
            status: 'changes_requested',
            comments: 'パフォーマンス上の懸念があります。',
            suggestions: [
              'useCallback を使用してレンダリング最適化を行ってください',
              '大きなリストには仮想スクロールを検討してください',
              'メモ化を追加してください',
            ],
            performanceIssues: [
              {
                type: 'unnecessary-rerender',
                component: 'UserList',
                recommendation: 'React.memo を使用',
              },
            ],
          },
          null,
          2
        ) +
        '\n```'
    ),
    createMockMessage.result(true),
  ],
};

/**
 * Security concern review
 */
export const securityConcernReviewResponse: MockResponse = {
  messages: [
    createMockMessage.assistant(
      'コードレビューを行います。\n\n```json\n' +
        JSON.stringify(
          {
            status: 'changes_requested',
            comments: 'セキュリティ上の問題が見つかりました。',
            suggestions: [
              'ユーザー入力をサニタイズしてください（XSS対策）',
              'パスワードをプレーンテキストで保存しないでください',
              'API呼び出しにCSRFトークンを追加してください',
            ],
            securityIssues: [
              {
                severity: 'high',
                type: 'xss-vulnerability',
                file: 'src/components/UserProfile.tsx',
                line: 12,
                recommendation: 'DOMPurify を使用してHTMLをサニタイズ',
              },
            ],
          },
          null,
          2
        ) +
        '\n```'
    ),
    createMockMessage.result(true),
  ],
};

/**
 * Approved with minor suggestions
 */
export const approvedWithSuggestionsResponse: MockResponse = {
  messages: [
    createMockMessage.assistant(
      'コードレビューを行います。\n\n```json\n' +
        JSON.stringify(
          {
            status: 'approved',
            comments: '実装は承認します。以下は任意の改善提案です。',
            suggestions: [
              'コメントを追加すると可読性が向上します',
              '変数名をより説明的にできます',
              'ユニットテストのカバレッジを増やすことを推奨します',
            ],
          },
          null,
          2
        ) +
        '\n```'
    ),
    createMockMessage.result(true),
  ],
};

/**
 * Story Mapping Review - Approved
 */
export const approvedStoryMappingReviewResponse: MockResponse = {
  messages: [
    createMockMessage.assistant(
      '```json\n' +
        JSON.stringify(
          {
            approved: true,
            issues: [],
            suggestions: [
              'エピック間の依存関係を明確化すると良いでしょう',
              'ストーリーの見積もりポイントが適切です',
            ],
            overallAssessment: 'ストーリーマッピングは完成度が高く、承認します。',
          },
          null,
          2
        ) +
        '\n```'
    ),
    createMockMessage.result(true),
  ],
};

/**
 * Story Mapping Review - Changes Requested
 */
export const changesRequestedStoryMappingReviewResponse: MockResponse = {
  messages: [
    createMockMessage.assistant(
      '```json\n' +
        JSON.stringify(
          {
            approved: false,
            issues: [
              {
                severity: 'major',
                category: 'story',
                message: 'ストーリー story-1-1 の受入基準が測定可能ではありません',
                storyId: 'story-1-1',
              },
              {
                severity: 'critical',
                category: 'persona',
                message: 'ペルソナの具体性が不足しています',
              },
            ],
            suggestions: [
              '受入基準を具体的な数値や条件で表現してください',
              'ペルソナに具体的な背景情報を追加してください',
            ],
            overallAssessment: '重大な問題が見つかりました。修正が必要です。',
          },
          null,
          2
        ) +
        '\n```'
    ),
    createMockMessage.result(true),
  ],
};

/**
 * Design Review - Approved
 */
export const approvedDesignReviewResponse: MockResponse = {
  messages: [
    createMockMessage.assistant(
      '```json\n' +
        JSON.stringify(
          {
            approved: true,
            issues: [],
            suggestions: [
              'API仕様書にレート制限の詳細を追加することを推奨',
              'データベースインデックスの最適化を検討',
            ],
            overallAssessment:
              '技術設計は適切で、セキュリティ考慮事項も含まれています。承認します。',
          },
          null,
          2
        ) +
        '\n```'
    ),
    createMockMessage.result(true),
  ],
};

/**
 * Design Review - Changes Requested
 */
export const changesRequestedDesignReviewResponse: MockResponse = {
  messages: [
    createMockMessage.assistant(
      '```json\n' +
        JSON.stringify(
          {
            approved: false,
            issues: [
              {
                severity: 'critical',
                category: 'security',
                message: 'パスワードハッシュのsalt rounds が不足しています',
              },
              {
                severity: 'major',
                category: 'scalability',
                message: 'データベースのスケーリング戦略が明確ではありません',
              },
            ],
            suggestions: [
              'bcryptのsalt roundsを12以上に設定してください',
              'データベースのレプリケーション戦略を追加してください',
              'キャッシュ戦略（Redis等）を検討してください',
            ],
            overallAssessment: 'セキュリティとスケーラビリティに関する問題があります。修正が必要です。',
          },
          null,
          2
        ) +
        '\n```'
    ),
    createMockMessage.result(true),
  ],
};
