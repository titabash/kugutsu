/**
 * Director Node AI Responses
 *
 * Mock responses for DirectorAI (Story Mapping creation)
 */

import type { MockResponse } from '../../../src/providers/MockAIProvider.js';
import { createMockMessage } from '../../../src/providers/MockAIProvider.js';
import type { StoryMapping } from '../../../src/types/scrum.js';

/**
 * Story mapping data for user authentication feature
 */
export const authenticationStoryMapping: StoryMapping = {
  persona: {
    name: '田中太郎',
    role: 'Webアプリケーションユーザー',
    goal: 'セキュアにアプリケーションにアクセスしたい',
    painPoints: [
      'パスワードを覚えるのが大変',
      'セキュリティが心配',
      'ログインプロセスが複雑',
    ],
  },
  epics: [
    {
      id: 'epic-1',
      title: 'ユーザー認証',
      description: '基本的なユーザー認証機能を提供する',
      priority: 1,
      stories: [
        {
          id: 'story-1-1',
          title: 'ユーザーログイン',
          asA: 'ユーザー',
          iWantTo: 'メールアドレスとパスワードでログインしたい',
          soThat: 'アプリケーションにアクセスできる',
          acceptanceCriteria: [
            '有効な認証情報でログイン成功',
            '無効な認証情報でエラーメッセージ表示',
            'ログイン後、ダッシュボードにリダイレクト',
          ],
          priority: 1,
          estimatedPoints: 5,
        },
        {
          id: 'story-1-2',
          title: 'ユーザーログアウト',
          asA: 'ログイン済みユーザー',
          iWantTo: 'ログアウトしたい',
          soThat: 'セッションを安全に終了できる',
          acceptanceCriteria: [
            'ログアウトボタンをクリックできる',
            'ログアウト後、ログインページにリダイレクト',
            'セッションが無効化される',
          ],
          priority: 1,
          estimatedPoints: 3,
        },
      ],
    },
    {
      id: 'epic-2',
      title: 'パスワード管理',
      description: 'パスワード関連の機能',
      priority: 2,
      stories: [
        {
          id: 'story-2-1',
          title: 'パスワードリセット',
          asA: 'パスワードを忘れたユーザー',
          iWantTo: 'パスワードをリセットしたい',
          soThat: 'アカウントに再度アクセスできる',
          acceptanceCriteria: [
            'メールアドレスを入力してリセットリンクを要求',
            'メールでリセットリンクを受信',
            '新しいパスワードを設定',
          ],
          priority: 2,
          estimatedPoints: 5,
        },
      ],
    },
    {
      id: 'epic-3',
      title: 'セキュリティ',
      description: 'セキュリティ機能の強化',
      priority: 3,
      stories: [
        {
          id: 'story-3-1',
          title: '2要素認証',
          asA: 'セキュリティ意識の高いユーザー',
          iWantTo: '2要素認証を有効にしたい',
          soThat: 'アカウントをより安全に保護できる',
          acceptanceCriteria: [
            '2要素認証の設定画面にアクセス',
            'QRコードをスキャンして設定',
            'ログイン時に認証コードを要求',
          ],
          priority: 3,
          estimatedPoints: 8,
        },
      ],
    },
  ],
};

/**
 * Story mapping markdown representation
 */
export const authenticationStoryMappingMarkdown = `# ストーリーマッピング: ユーザー認証システム

## ペルソナ

**名前**: 田中太郎
**役割**: Webアプリケーションユーザー
**目標**: セキュアにアプリケーションにアクセスしたい

**課題**:
- パスワードを覚えるのが大変
- セキュリティが心配
- ログインプロセスが複雑

---

## エピック 1: ユーザー認証

**説明**: 基本的なユーザー認証機能を提供する
**優先度**: 1（高）

### ストーリー 1-1: ユーザーログイン

- **As a**: ユーザー
- **I want to**: メールアドレスとパスワードでログインしたい
- **So that**: アプリケーションにアクセスできる

**受入基準**:
- 有効な認証情報でログイン成功
- 無効な認証情報でエラーメッセージ表示
- ログイン後、ダッシュボードにリダイレクト

**見積もり**: 5ポイント

### ストーリー 1-2: ユーザーログアウト

- **As a**: ログイン済みユーザー
- **I want to**: ログアウトしたい
- **So that**: セッションを安全に終了できる

**受入基準**:
- ログアウトボタンをクリックできる
- ログアウト後、ログインページにリダイレクト
- セッションが無効化される

**見積もり**: 3ポイント

---

## エピック 2: パスワード管理

**説明**: パスワード関連の機能
**優先度**: 2（中）

### ストーリー 2-1: パスワードリセット

- **As a**: パスワードを忘れたユーザー
- **I want to**: パスワードをリセットしたい
- **So that**: アカウントに再度アクセスできる

**受入基準**:
- メールアドレスを入力してリセットリンクを要求
- メールでリセットリンクを受信
- 新しいパスワードを設定

**見積もり**: 5ポイント

---

## エピック 3: セキュリティ

**説明**: セキュリティ機能の強化
**優先度**: 3（低）

### ストーリー 3-1: 2要素認証

- **As a**: セキュリティ意識の高いユーザー
- **I want to**: 2要素認証を有効にしたい
- **So that**: アカウントをより安全に保護できる

**受入基準**:
- 2要素認証の設定画面にアクセス
- QRコードをスキャンして設定
- ログイン時に認証コードを要求

**見積もり**: 8ポイント
`;

/**
 * Create mock response for DirectorAI with file creation
 *
 * This uses tool simulation to actually create the story-map.json and story-map.md files
 */
export function createDirectorResponse(
  storyMapJsonPath: string,
  storyMapMdPath: string
): MockResponse {
  return {
    simulateTools: true,
    messages: [
      // Step 1: Create story-map.json using Write tool
      {
        type: 'system',
        content: {
          toolUse: {
            tool: 'Write',
            arguments: {
              file_path: storyMapJsonPath,
              content: JSON.stringify(authenticationStoryMapping, null, 2),
            },
          },
        },
        timestamp: new Date(),
      } as any,
      // Step 2: Create story-map.md using Write tool
      {
        type: 'system',
        content: {
          toolUse: {
            tool: 'Write',
            arguments: {
              file_path: storyMapMdPath,
              content: authenticationStoryMappingMarkdown,
            },
          },
        },
        timestamp: new Date(),
      } as any,
      // Step 3: Assistant message confirming completion
      createMockMessage.assistant(
        `ストーリーマッピングを作成しました。\n\n` +
          `- ${storyMapJsonPath}\n` +
          `- ${storyMapMdPath}\n\n` +
          `ペルソナ: 田中太郎\n` +
          `エピック数: 3\n` +
          `ストーリー数: 4`
      ),
      // Step 4: Result message
      createMockMessage.result(true),
    ],
  };
}

/**
 * Simple mock response for DirectorAI (without file creation)
 * Use this when you want to manually create files in tests
 */
export const directorResponseSimple: MockResponse = {
  messages: [
    createMockMessage.assistant(
      `ストーリーマッピングを作成しました。\n\n` +
        `ペルソナ: 田中太郎\n` +
        `エピック数: 3\n` +
        `ストーリー数: 4`
    ),
    createMockMessage.result(true),
  ],
};
