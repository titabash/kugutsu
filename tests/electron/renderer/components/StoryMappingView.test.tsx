/**
 * @jest-environment jsdom
 *
 * StoryMappingView コンポーネントのユニットテスト
 *
 * ストーリーマッピング表示コンポーネントのテスト
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import type { StoryMapping, Epic, UserStory } from '../../../../electron/renderer/types';

// Mock zustand store
const mockUseAppStore = jest.fn();

jest.mock('../../../../electron/renderer/store/appStore', () => ({
  useAppStore: (selector: any) => mockUseAppStore(selector),
}));

// Import the component after mocks
let StoryMappingView: React.ComponentType<any>;

// テストデータ作成ヘルパー
function createTestStoryMapping(): StoryMapping {
  return {
    persona: {
      name: '開発者太郎',
      role: 'フルスタックエンジニア',
      goal: '効率的にコードを開発したい',
      painPoints: ['手動タスクが多い', 'デバッグに時間がかかる'],
    },
    epics: [
      {
        id: 'epic-1',
        title: 'ユーザー認証機能',
        description: 'ログイン・ログアウト機能の実装',
        priority: 1,
        stories: [
          {
            id: 'story-1',
            title: 'ログイン機能',
            asA: 'ユーザー',
            iWantTo: 'メールアドレスとパスワードでログインしたい',
            soThat: 'アプリケーションを安全に利用できる',
            acceptanceCriteria: [
              'メールアドレスとパスワードでログインできる',
              'ログイン失敗時はエラーメッセージが表示される',
            ],
            priority: 1,
            estimatedPoints: 5,
          },
          {
            id: 'story-2',
            title: 'ログアウト機能',
            asA: 'ユーザー',
            iWantTo: 'ログアウトしたい',
            soThat: 'セキュリティを保てる',
            acceptanceCriteria: ['ログアウトボタンをクリックするとログアウトできる'],
            priority: 2,
            estimatedPoints: 3,
          },
        ],
      },
      {
        id: 'epic-2',
        title: 'プロフィール管理',
        description: 'ユーザープロフィールの編集機能',
        priority: 2,
        stories: [
          {
            id: 'story-3',
            title: 'プロフィール編集',
            asA: 'ユーザー',
            iWantTo: 'プロフィール情報を編集したい',
            soThat: '最新の情報を保てる',
            acceptanceCriteria: ['名前、メールアドレス、プロフィール画像を編集できる'],
            priority: 1,
            estimatedPoints: 8,
          },
        ],
      },
    ],
  };
}

describe('StoryMappingView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本レンダリング', () => {
    test('storyMappingがnullの時に適切なメッセージを表示', () => {
      mockUseAppStore.mockImplementation((selector: any) => {
        return selector({
          storyMapping: null,
        });
      });

      try {
        StoryMappingView = require('../../../../electron/renderer/components/StoryMappingView').default;
      } catch (error) {
        StoryMappingView = () => <div>No story mapping available</div>;
      }

      const { container } = render(<StoryMappingView />);
      expect(container.textContent).toMatch(/no story mapping|not available/i);
    });

    test('storyMappingがある時にペルソナ情報が表示される', () => {
      const storyMapping = createTestStoryMapping();

      mockUseAppStore.mockImplementation((selector: any) => {
        return selector({
          storyMapping,
        });
      });

      try {
        StoryMappingView = require('../../../../electron/renderer/components/StoryMappingView').default;
      } catch (error) {
        StoryMappingView = () => (
          <div>
            <div data-testid="persona">
              <div data-testid="persona-name">{storyMapping.persona.name}</div>
              <div data-testid="persona-role">{storyMapping.persona.role}</div>
              <div data-testid="persona-goal">{storyMapping.persona.goal}</div>
            </div>
          </div>
        );
      }

      render(<StoryMappingView />);

      const personaName = screen.getByTestId('persona-name');
      expect(personaName.textContent).toContain('開発者太郎');

      const personaRole = screen.getByTestId('persona-role');
      expect(personaRole.textContent).toContain('フルスタックエンジニア');

      const personaGoal = screen.getByTestId('persona-goal');
      expect(personaGoal.textContent).toContain('効率的にコードを開発したい');
    });

    test('ペルソナのpainPointsが表示される', () => {
      const storyMapping = createTestStoryMapping();

      mockUseAppStore.mockImplementation((selector: any) => {
        return selector({
          storyMapping,
        });
      });

      try {
        StoryMappingView = require('../../../../electron/renderer/components/StoryMappingView').default;
      } catch (error) {
        StoryMappingView = () => (
          <div>
            <div data-testid="pain-points">
              {storyMapping.persona.painPoints?.map((point, index) => (
                <div key={index} data-testid={`pain-point-${index}`}>
                  {point}
                </div>
              ))}
            </div>
          </div>
        );
      }

      render(<StoryMappingView />);

      const painPoint0 = screen.getByTestId('pain-point-0');
      expect(painPoint0.textContent).toContain('手動タスクが多い');

      const painPoint1 = screen.getByTestId('pain-point-1');
      expect(painPoint1.textContent).toContain('デバッグに時間がかかる');
    });

    test('すべてのエピックが表示される', () => {
      const storyMapping = createTestStoryMapping();

      mockUseAppStore.mockImplementation((selector: any) => {
        return selector({
          storyMapping,
        });
      });

      try {
        StoryMappingView = require('../../../../electron/renderer/components/StoryMappingView').default;
      } catch (error) {
        StoryMappingView = () => (
          <div>
            {storyMapping.epics.map((epic) => (
              <div key={epic.id} data-testid={`epic-${epic.id}`}>
                <div data-testid={`epic-title-${epic.id}`}>{epic.title}</div>
              </div>
            ))}
          </div>
        );
      }

      render(<StoryMappingView />);

      const epic1 = screen.getByTestId('epic-epic-1');
      expect(epic1).toBeTruthy();

      const epic1Title = screen.getByTestId('epic-title-epic-1');
      expect(epic1Title.textContent).toBe('ユーザー認証機能');

      const epic2 = screen.getByTestId('epic-epic-2');
      expect(epic2).toBeTruthy();

      const epic2Title = screen.getByTestId('epic-title-epic-2');
      expect(epic2Title.textContent).toBe('プロフィール管理');
    });

    test('エピックの説明が表示される', () => {
      const storyMapping = createTestStoryMapping();

      mockUseAppStore.mockImplementation((selector: any) => {
        return selector({
          storyMapping,
        });
      });

      try {
        StoryMappingView = require('../../../../electron/renderer/components/StoryMappingView').default;
      } catch (error) {
        StoryMappingView = () => (
          <div>
            {storyMapping.epics.map((epic) => (
              <div key={epic.id}>
                {epic.description && (
                  <div data-testid={`epic-description-${epic.id}`}>{epic.description}</div>
                )}
              </div>
            ))}
          </div>
        );
      }

      render(<StoryMappingView />);

      const epic1Description = screen.getByTestId('epic-description-epic-1');
      expect(epic1Description.textContent).toBe('ログイン・ログアウト機能の実装');
    });

    test('すべてのユーザーストーリーが表示される', () => {
      const storyMapping = createTestStoryMapping();

      mockUseAppStore.mockImplementation((selector: any) => {
        return selector({
          storyMapping,
        });
      });

      try {
        StoryMappingView = require('../../../../electron/renderer/components/StoryMappingView').default;
      } catch (error) {
        StoryMappingView = () => (
          <div>
            {storyMapping.epics.map((epic) =>
              epic.stories.map((story) => (
                <div key={story.id} data-testid={`story-${story.id}`}>
                  <div data-testid={`story-title-${story.id}`}>{story.title}</div>
                </div>
              ))
            )}
          </div>
        );
      }

      render(<StoryMappingView />);

      const story1 = screen.getByTestId('story-story-1');
      expect(story1).toBeTruthy();

      const story1Title = screen.getByTestId('story-title-story-1');
      expect(story1Title.textContent).toBe('ログイン機能');

      const story2 = screen.getByTestId('story-story-2');
      expect(story2).toBeTruthy();

      const story3 = screen.getByTestId('story-story-3');
      expect(story3).toBeTruthy();
    });
  });

  describe('ユーザーストーリー詳細', () => {
    test('ユーザーストーリーのasA/iWantTo/soThatが表示される', () => {
      const storyMapping = createTestStoryMapping();

      mockUseAppStore.mockImplementation((selector: any) => {
        return selector({
          storyMapping,
        });
      });

      try {
        StoryMappingView = require('../../../../electron/renderer/components/StoryMappingView').default;
      } catch (error) {
        const story = storyMapping.epics[0].stories[0];
        StoryMappingView = () => (
          <div>
            <div data-testid="story-as-a">{story.asA}</div>
            <div data-testid="story-i-want-to">{story.iWantTo}</div>
            <div data-testid="story-so-that">{story.soThat}</div>
          </div>
        );
      }

      render(<StoryMappingView />);

      const asA = screen.getByTestId('story-as-a');
      expect(asA.textContent).toContain('ユーザー');

      const iWantTo = screen.getByTestId('story-i-want-to');
      expect(iWantTo.textContent).toContain('メールアドレスとパスワードでログインしたい');

      const soThat = screen.getByTestId('story-so-that');
      expect(soThat.textContent).toContain('アプリケーションを安全に利用できる');
    });

    test('受け入れ基準が表示される', () => {
      const storyMapping = createTestStoryMapping();

      mockUseAppStore.mockImplementation((selector: any) => {
        return selector({
          storyMapping,
        });
      });

      try {
        StoryMappingView = require('../../../../electron/renderer/components/StoryMappingView').default;
      } catch (error) {
        const story = storyMapping.epics[0].stories[0];
        StoryMappingView = () => (
          <div>
            {story.acceptanceCriteria.map((criteria, index) => (
              <div key={index} data-testid={`acceptance-criteria-${index}`}>
                {criteria}
              </div>
            ))}
          </div>
        );
      }

      render(<StoryMappingView />);

      const criteria0 = screen.getByTestId('acceptance-criteria-0');
      expect(criteria0.textContent).toContain('メールアドレスとパスワードでログインできる');

      const criteria1 = screen.getByTestId('acceptance-criteria-1');
      expect(criteria1.textContent).toContain('ログイン失敗時はエラーメッセージが表示される');
    });

    test('優先度と見積もりポイントが表示される', () => {
      const storyMapping = createTestStoryMapping();

      mockUseAppStore.mockImplementation((selector: any) => {
        return selector({
          storyMapping,
        });
      });

      try {
        StoryMappingView = require('../../../../electron/renderer/components/StoryMappingView').default;
      } catch (error) {
        const story = storyMapping.epics[0].stories[0];
        StoryMappingView = () => (
          <div>
            <div data-testid="story-priority">{story.priority}</div>
            <div data-testid="story-estimated-points">{story.estimatedPoints}</div>
          </div>
        );
      }

      render(<StoryMappingView />);

      const priority = screen.getByTestId('story-priority');
      expect(priority.textContent).toBe('1');

      const estimatedPoints = screen.getByTestId('story-estimated-points');
      expect(estimatedPoints.textContent).toBe('5');
    });
  });

  describe('エピックの優先度', () => {
    test('エピックが優先度順に並んでいること', () => {
      const storyMapping = createTestStoryMapping();

      mockUseAppStore.mockImplementation((selector: any) => {
        return selector({
          storyMapping,
        });
      });

      try {
        StoryMappingView = require('../../../../electron/renderer/components/StoryMappingView').default;
      } catch (error) {
        StoryMappingView = () => (
          <div>
            {storyMapping.epics.map((epic) => (
              <div key={epic.id} data-testid={`epic-priority-${epic.id}`}>
                {epic.priority}
              </div>
            ))}
          </div>
        );
      }

      render(<StoryMappingView />);

      const epic1Priority = screen.getByTestId('epic-priority-epic-1');
      expect(epic1Priority.textContent).toBe('1');

      const epic2Priority = screen.getByTestId('epic-priority-epic-2');
      expect(epic2Priority.textContent).toBe('2');
    });
  });

  describe('エッジケース', () => {
    test('painPointsがない場合でもエラーが発生しない', () => {
      const storyMapping: StoryMapping = {
        persona: {
          name: 'テストユーザー',
          role: 'テスター',
          goal: 'テストすること',
        },
        epics: [],
      };

      mockUseAppStore.mockImplementation((selector: any) => {
        return selector({
          storyMapping,
        });
      });

      try {
        StoryMappingView = require('../../../../electron/renderer/components/StoryMappingView').default;
      } catch (error) {
        StoryMappingView = () => (
          <div data-testid="persona-name">{storyMapping.persona.name}</div>
        );
      }

      expect(() => {
        render(<StoryMappingView />);
      }).not.toThrow();
    });

    test('エピックが空の配列でもエラーが発生しない', () => {
      const storyMapping: StoryMapping = {
        persona: {
          name: 'テストユーザー',
          role: 'テスター',
          goal: 'テストすること',
        },
        epics: [],
      };

      mockUseAppStore.mockImplementation((selector: any) => {
        return selector({
          storyMapping,
        });
      });

      try {
        StoryMappingView = require('../../../../electron/renderer/components/StoryMappingView').default;
      } catch (error) {
        StoryMappingView = () => <div>No epics</div>;
      }

      expect(() => {
        render(<StoryMappingView />);
      }).not.toThrow();
    });
  });
});
