/**
 * CustomNodeCreator Component Tests (TDD - RED Phase)
 *
 * カスタムノード作成コンポーネントのテスト
 * ユーザーがカスタムAIノードテンプレートを作成するためのUI
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

describe('CustomNodeCreator', () => {
  // モックのセットアップ
  const mockOnCreate = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // 初期表示テスト
  // ============================================================================

  describe('初期表示', () => {
    it('ノード名入力フィールドが表示されること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      const nameInput = screen.getByLabelText(/ノード名|Node Name/i);
      expect(nameInput).toBeInTheDocument();
    });

    it('説明入力フィールドが表示されること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      const descInput = screen.getByLabelText(/説明|Description/i);
      expect(descInput).toBeInTheDocument();
    });

    it('AIプロバイダー選択が表示されること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      const providerSelect = screen.getByLabelText(/AIプロバイダー|AI Provider/i);
      expect(providerSelect).toBeInTheDocument();
    });

    it('システムプロンプト入力エリアが表示されること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      const promptTextarea = screen.getByLabelText(/システムプロンプト|System Prompt/i);
      expect(promptTextarea).toBeInTheDocument();
    });

    it('作成ボタンが表示されること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      const createButton = screen.getByRole('button', { name: /作成|Create/i });
      expect(createButton).toBeInTheDocument();
    });

    it('キャンセルボタンが表示されること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      const cancelButton = screen.getByRole('button', { name: /キャンセル|Cancel/i });
      expect(cancelButton).toBeInTheDocument();
    });
  });

  // ============================================================================
  // AIプロバイダー選択テスト
  // ============================================================================

  describe('AIプロバイダー選択', () => {
    it('Claude/OpenAI/Gemini/Autoが選択肢として存在すること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      const providerSelect = screen.getByLabelText(/AIプロバイダー|AI Provider/i);

      // セレクトボックスの選択肢を確認（within を使用してセレクト内のみを検索）
      const options = within(providerSelect).getAllByRole('option');
      const optionTexts = options.map((opt) => opt.textContent);

      expect(optionTexts.some((t) => t?.includes('Claude'))).toBe(true);
      expect(optionTexts.some((t) => t?.includes('OpenAI') || t?.includes('Codex'))).toBe(true);
      expect(optionTexts.some((t) => t?.includes('Gemini'))).toBe(true);
      expect(optionTexts.some((t) => t?.includes('Auto') || t?.includes('自動'))).toBe(true);
    });

    it('デフォルトでAutoが選択されていること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      const providerSelect = screen.getByLabelText(/AIプロバイダー|AI Provider/i);
      expect(providerSelect).toHaveValue('auto');
    });

    it('プロバイダーを変更できること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      const providerSelect = screen.getByLabelText(/AIプロバイダー|AI Provider/i);

      await userEvent.selectOptions(providerSelect, 'claude');
      expect(providerSelect).toHaveValue('claude');
    });
  });

  // ============================================================================
  // システムプロンプト入力テスト
  // ============================================================================

  describe('システムプロンプト入力', () => {
    it('プロンプトを入力できること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      const promptTextarea = screen.getByLabelText(/システムプロンプト|System Prompt/i);

      await userEvent.type(promptTextarea, 'You are a helpful assistant.');
      expect(promptTextarea).toHaveValue('You are a helpful assistant.');
    });

    it('複数行のプロンプトを入力できること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      const promptTextarea = screen.getByLabelText(/システムプロンプト|System Prompt/i);
      const multilinePrompt = 'Line 1\nLine 2\nLine 3';

      await userEvent.type(promptTextarea, multilinePrompt);
      expect(promptTextarea).toHaveValue(multilinePrompt);
    });
  });

  // ============================================================================
  // 入出力ソケット定義テスト
  // ============================================================================

  describe('入出力ソケット定義', () => {
    it('入力ソケット追加ボタンが表示されること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      const addInputButton = screen.getByRole('button', { name: /入力.*追加|Add Input/i });
      expect(addInputButton).toBeInTheDocument();
    });

    it('出力ソケット追加ボタンが表示されること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      const addOutputButton = screen.getByRole('button', { name: /出力.*追加|Add Output/i });
      expect(addOutputButton).toBeInTheDocument();
    });

    it('入力ソケットを追加できること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      const addInputButton = screen.getByRole('button', { name: /入力.*追加|Add Input/i });
      await userEvent.click(addInputButton);

      // 新しい入力ソケットの入力フィールドが表示される
      const socketNameInputs = screen.getAllByPlaceholderText(/ソケット名|Socket Name/i);
      expect(socketNameInputs.length).toBeGreaterThan(0);
    });

    it('出力ソケットを追加できること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      const addOutputButton = screen.getByRole('button', { name: /出力.*追加|Add Output/i });
      await userEvent.click(addOutputButton);

      // 新しい出力ソケットの入力フィールドが表示される
      const socketSections = screen.getAllByTestId(/output-socket/i);
      expect(socketSections.length).toBeGreaterThan(0);
    });

    it('ソケットを削除できること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      // 入力ソケットを追加
      const addInputButton = screen.getByRole('button', { name: /入力.*追加|Add Input/i });
      await userEvent.click(addInputButton);

      // 削除ボタンをクリック
      const deleteButton = screen.getByRole('button', { name: /削除|Remove|×/i });
      await userEvent.click(deleteButton);

      // ソケットが削除されていることを確認
      const socketSections = screen.queryAllByTestId(/input-socket/i);
      expect(socketSections.length).toBe(0);
    });
  });

  // ============================================================================
  // 詳細設定テスト
  // ============================================================================

  describe('詳細設定', () => {
    it('maxTurns入力フィールドが表示されること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      const maxTurnsInput = screen.getByLabelText(/maxTurns|最大ターン/i);
      expect(maxTurnsInput).toBeInTheDocument();
    });

    it('maxTurnsのデフォルト値が設定されていること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      const maxTurnsInput = screen.getByLabelText(/maxTurns|最大ターン/i);
      expect(maxTurnsInput).toHaveValue(30); // デフォルト値
    });

    it('allowedTools設定が表示されること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      // 許可ツールのチェックボックス群
      expect(screen.getByLabelText(/Read/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Write/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Edit/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Bash/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // バリデーションテスト
  // ============================================================================

  describe('バリデーション', () => {
    it('ノード名が空の場合、作成ボタンが無効になること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      const createButton = screen.getByRole('button', { name: /作成|Create/i });
      expect(createButton).toBeDisabled();
    });

    it('ノード名を入力すると作成ボタンが有効になること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      const nameInput = screen.getByLabelText(/ノード名|Node Name/i);
      await userEvent.type(nameInput, 'My Custom Node');

      const createButton = screen.getByRole('button', { name: /作成|Create/i });
      expect(createButton).not.toBeDisabled();
    });

    it('ノード名が重複する場合、エラーメッセージが表示されること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(
        <CustomNodeCreator
          onCreate={mockOnCreate}
          onCancel={mockOnCancel}
          existingNames={['Existing Node']}
        />
      );

      const nameInput = screen.getByLabelText(/ノード名|Node Name/i);
      await userEvent.type(nameInput, 'Existing Node');

      expect(screen.getByText(/既に存在|already exists/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // 作成・キャンセルテスト
  // ============================================================================

  describe('作成・キャンセル', () => {
    it('作成ボタンをクリックするとonCreateが呼ばれること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      // 必須フィールドを入力
      const nameInput = screen.getByLabelText(/ノード名|Node Name/i);
      await userEvent.type(nameInput, 'Test Node');

      const createButton = screen.getByRole('button', { name: /作成|Create/i });
      await userEvent.click(createButton);

      expect(mockOnCreate).toHaveBeenCalledTimes(1);
    });

    it('作成時に正しいノードテンプレートが渡されること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      // フィールドを入力
      const nameInput = screen.getByLabelText(/ノード名|Node Name/i);
      await userEvent.type(nameInput, 'Test Node');

      const descInput = screen.getByLabelText(/説明|Description/i);
      await userEvent.type(descInput, 'Test description');

      const promptTextarea = screen.getByLabelText(/システムプロンプト|System Prompt/i);
      await userEvent.type(promptTextarea, 'You are helpful.');

      const providerSelect = screen.getByLabelText(/AIプロバイダー|AI Provider/i);
      await userEvent.selectOptions(providerSelect, 'claude');

      const createButton = screen.getByRole('button', { name: /作成|Create/i });
      await userEvent.click(createButton);

      expect(mockOnCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Node',
          description: 'Test description',
          systemPrompt: 'You are helpful.',
          provider: 'claude',
        })
      );
    });

    it('キャンセルボタンをクリックするとonCancelが呼ばれること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      const cancelButton = screen.getByRole('button', { name: /キャンセル|Cancel/i });
      await userEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // プレビューテスト
  // ============================================================================

  describe('プレビュー', () => {
    it('ノード名を入力するとプレビューに反映されること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      const nameInput = screen.getByLabelText(/ノード名|Node Name/i);
      await userEvent.type(nameInput, 'Preview Node');

      const preview = screen.getByTestId('node-preview');
      expect(preview).toHaveTextContent('Preview Node');
    });

    it('プレビューにノードの色が表示されること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      render(<CustomNodeCreator onCreate={mockOnCreate} onCancel={mockOnCancel} />);

      const preview = screen.getByTestId('node-preview');
      // カスタムノードの色（cyan）が適用されていることを確認
      expect(preview).toHaveStyle({ borderColor: expect.stringMatching(/#06b6d4|cyan/i) });
    });
  });

  // ============================================================================
  // 編集モードテスト
  // ============================================================================

  describe('編集モード', () => {
    it('既存のノードテンプレートを編集できること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      const existingTemplate = {
        name: 'Existing Node',
        description: 'Existing description',
        systemPrompt: 'Existing prompt',
        provider: 'claude' as const,
        maxTurns: 20,
        allowedTools: ['Read', 'Write'],
        inputs: [],
        outputs: [],
      };

      render(
        <CustomNodeCreator
          onCreate={mockOnCreate}
          onCancel={mockOnCancel}
          initialTemplate={existingTemplate}
        />
      );

      const nameInput = screen.getByLabelText(/ノード名|Node Name/i);
      expect(nameInput).toHaveValue('Existing Node');

      const descInput = screen.getByLabelText(/説明|Description/i);
      expect(descInput).toHaveValue('Existing description');

      const promptTextarea = screen.getByLabelText(/システムプロンプト|System Prompt/i);
      expect(promptTextarea).toHaveValue('Existing prompt');

      const providerSelect = screen.getByLabelText(/AIプロバイダー|AI Provider/i);
      expect(providerSelect).toHaveValue('claude');
    });

    it('編集モードでは作成ボタンのテキストが「更新」になること', async () => {
      const { CustomNodeCreator } = await import(
        '../../../renderer/components/ReteEditor/CustomNodeCreator'
      );

      const existingTemplate = {
        name: 'Existing Node',
        description: '',
        systemPrompt: '',
        provider: 'auto' as const,
        maxTurns: 30,
        allowedTools: [],
        inputs: [],
        outputs: [],
      };

      render(
        <CustomNodeCreator
          onCreate={mockOnCreate}
          onCancel={mockOnCancel}
          initialTemplate={existingTemplate}
        />
      );

      const updateButton = screen.getByRole('button', { name: /更新|Update/i });
      expect(updateButton).toBeInTheDocument();
    });
  });
});
