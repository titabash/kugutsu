/**
 * MockAIProvider Unit Tests (Jest)
 */

import { MockAIProvider, createMockMessage } from '../../src/providers/MockAIProvider.js';

describe('MockAIProvider', () => {
  let provider: MockAIProvider;

  beforeEach(() => {
    provider = new MockAIProvider();
  });

  test('should create mock provider', () => {
    expect(provider).toBeDefined();
    expect(provider.getProviderName()).toBe('mock');
    expect(provider.isReady()).toBe(true);
  });

  test('should return mock messages', async () => {
    const mockResponse = {
      messages: [
        createMockMessage.assistant('Test response'),
        createMockMessage.result(true),
      ],
    };

    provider.setDefaultResponse(mockResponse);

    const messages: any[] = [];
    for await (const message of provider.execute('Test prompt')) {
      messages.push(message);
    }

    expect(messages).toHaveLength(2);
    expect(messages[0].type).toBe('assistant');
    expect(messages[1].type).toBe('result');
  });

  test('should match prompt patterns', async () => {
    provider.setMockResponse('Task Implementation', {
      messages: [createMockMessage.assistant('Implementation response')],
    });

    provider.setMockResponse('Code Review', {
      messages: [createMockMessage.assistant('Review response')],
    });

    // Test first pattern
    const messages1: any[] = [];
    for await (const message of provider.execute('# Task Implementation\nImplement feature')) {
      messages1.push(message);
    }
    expect(messages1).toHaveLength(1);
    expect(messages1[0].content).toContain('Implementation');

    // Test second pattern
    const messages2: any[] = [];
    for await (const message of provider.execute('# Code Review\nReview this code')) {
      messages2.push(message);
    }
    expect(messages2).toHaveLength(1);
    expect(messages2[0].content).toContain('Review');
  });

  test('should track call count', async () => {
    provider.setDefaultResponse({ messages: [createMockMessage.assistant('Test')] });

    expect(provider.getCallCount()).toBe(0);

    for await (const _ of provider.execute('Prompt 1')) {}
    expect(provider.getCallCount()).toBe(1);

    for await (const _ of provider.execute('Prompt 2')) {}
    expect(provider.getCallCount()).toBe(2);

    provider.reset();
    expect(provider.getCallCount()).toBe(0);
  });

  test('should simulate errors', async () => {
    provider.setDefaultResponse({
      messages: [],
      shouldThrowError: true,
      errorMessage: 'Test error',
    });

    await expect(async () => {
      for await (const _ of provider.execute('Test')) {}
    }).rejects.toThrow('Test error');
  });

  test('should create mock messages', () => {
    const assistantMsg = createMockMessage.assistant('content', 'session-123');
    expect(assistantMsg.type).toBe('assistant');
    expect(assistantMsg.content).toBe('content');
    expect(assistantMsg.session_id).toBe('session-123');

    const resultMsg = createMockMessage.result(true);
    expect(resultMsg.type).toBe('result');
    expect(resultMsg.content.success).toBe(true);

    const systemMsg = createMockMessage.system({ info: 'test' });
    expect(systemMsg.type).toBe('system');
  });

  describe('File-based artifact simulation', () => {
    test('should simulate Write tool and create actual files', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { mkdtemp, rm } = await import('fs/promises');
      const { tmpdir } = await import('os');

      // テスト用の一時ディレクトリを作成
      const tempDir = await mkdtemp(path.join(tmpdir(), 'mock-test-'));

      try {
        // MockAIProvider に Write ツールをシミュレートする機能を追加したと仮定
        const mockResponse = {
          messages: [
            createMockMessage.assistant('Creating tech-stack.json file'),
            createMockMessage.system({
              toolUse: {
                tool: 'Write',
                arguments: {
                  file_path: path.join(tempDir, 'tech-stack.json'),
                  content: JSON.stringify({
                    languages: ['TypeScript', 'JavaScript'],
                    frameworks: ['Electron', 'React'],
                  }, null, 2),
                },
              },
            }),
            createMockMessage.assistant('File created successfully'),
            createMockMessage.result(true),
          ],
          // ツールシミュレーション設定
          simulateTools: true,
        };

        provider.setMockResponse(/tech.*stack/i, mockResponse);

        // プロンプトを実行
        const messages: any[] = [];
        for await (const message of provider.execute('Analyze tech stack')) {
          messages.push(message);
        }

        // ファイルが実際に作成されていることを確認
        const filePath = path.join(tempDir, 'tech-stack.json');
        const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
        expect(fileExists).toBe(true);

        // ファイルの内容を確認
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        expect(data.languages).toContain('TypeScript');
        expect(data.frameworks).toContain('Electron');
      } finally {
        // クリーンアップ
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
