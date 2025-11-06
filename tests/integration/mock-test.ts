/**
 * Mock Test Script
 *
 * モックプロバイダーを使用してシステム全体の動作を検証
 */

import { parallelDevOrchestrator } from '../../src/electron/ParallelDevOrchestrator.js';
import type { ParallelDevConfig } from '../../src/graph/types.js';
import { MockAIProvider, createMockMessage } from '../../src/providers/MockAIProvider.js';
import { AIProviderFactory } from '../../src/providers/AIProviderFactory.js';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

/**
 * テスト用のモックレスポンスを設定
 */
function setupMockResponses(mockProvider: MockAIProvider): void {
  // 1. リポジトリ分析のレスポンス
  mockProvider.setMockResponse(
    /リポジトリ全体の分析/,
    {
      messages: [
        createMockMessage.assistant(`\`\`\`json
{
  "repositoryName": "test-project",
  "programmingLanguages": ["TypeScript", "JavaScript"],
  "frameworks": ["Node.js", "React"],
  "buildSystem": "npm",
  "testFramework": "jest",
  "hasCI": false,
  "dependencies": ["express", "react"],
  "projectStructure": {
    "src": ["index.ts", "App.tsx"],
    "tests": ["test.spec.ts"]
  }
}
\`\`\``),
        createMockMessage.result(true),
      ],
    }
  );

  // 2. 継続モード判定のレスポンス
  mockProvider.setMockResponse(
    /ユーザーリクエストの意図分析/,
    {
      messages: [
        createMockMessage.assistant(`\`\`\`json
{
  "mode": "new",
  "confidence": 0.95,
  "reasoning": "新規プロジェクトの開始です"
}
\`\`\``),
        createMockMessage.result(true),
      ],
    }
  );

  // 3. 技術スタック分析のレスポンス
  mockProvider.setMockResponse(
    /Technology Stack Analysis/,
    {
      messages: [
        createMockMessage.assistant(`\`\`\`json
{
  "languages": ["TypeScript", "JavaScript"],
  "frameworks": ["Node.js", "React"],
  "buildTools": ["npm", "webpack"],
  "testFrameworks": ["jest"],
  "cicd": [],
  "dependencies": {
    "express": "^4.18.0",
    "react": "^18.2.0"
  }
}
\`\`\``),
        createMockMessage.result(true),
      ],
    }
  );

  // 4. 要求分析のレスポンス
  mockProvider.setMockResponse(
    /Requirements Analysis/,
    {
      messages: [
        createMockMessage.assistant(`\`\`\`json
{
  "requirements": [
    {
      "id": "REQ-001",
      "description": "テスト用のシンプルな機能を実装",
      "priority": "high",
      "complexity": "low"
    }
  ],
  "constraints": [],
  "acceptanceCriteria": [
    "機能が正しく動作すること",
    "テストがすべてパスすること"
  ]
}
\`\`\``),
        createMockMessage.result(true),
      ],
    }
  );

  // 5. タスク生成のレスポンス
  mockProvider.setMockResponse(
    /Task Generation/,
    {
      messages: [
        createMockMessage.assistant(`\`\`\`json
{
  "tasks": [
    {
      "id": "TASK-001",
      "title": "サンプル機能の実装",
      "description": "テスト用のシンプルなサンプル機能を実装します",
      "priority": "high",
      "estimatedEffort": "low",
      "dependencies": [],
      "acceptanceCriteria": [
        "機能が正しく動作すること",
        "テストがパスすること"
      ]
    }
  ]
}
\`\`\``),
        createMockMessage.result(true),
      ],
    }
  );

  // 6. エンジニアノードのレスポンス（実装）
  mockProvider.setMockResponse(
    /(TASK-\d+|サンプル機能|実装|開発|コード)/,
    {
      messages: [
        createMockMessage.assistant('タスクの実装を開始します。'),
        createMockMessage.assistant('コードを作成しました。'),
        createMockMessage.assistant('実装が完了しました。'),
        createMockMessage.result(true),
      ],
    }
  );

  // 7. レビューノードのレスポンス
  mockProvider.setMockResponse(
    /(review|レビュー|code review|コードレビュー)/i,
    {
      messages: [
        createMockMessage.assistant(`\`\`\`json
{
  "approved": true,
  "comments": [
    {
      "type": "info",
      "message": "コードは良好です"
    }
  ],
  "suggestions": []
}
\`\`\``),
        createMockMessage.result(true),
      ],
    }
  );

  // 8. マージ調整のレスポンス
  mockProvider.setMockResponse(
    /(merge|マージ|統合)/i,
    {
      messages: [
        createMockMessage.assistant('マージの準備ができました。'),
        createMockMessage.assistant('マージを実行します。'),
        createMockMessage.result(true),
      ],
    }
  );

  // 9. デフォルトレスポンス
  mockProvider.setDefaultResponse({
    messages: [
      createMockMessage.assistant('処理を実行しました。'),
      createMockMessage.result(true),
    ],
  });
}

/**
 * テスト実行
 */
async function runTest(): Promise<void> {
  console.log('🧪 モックテスト開始\n');

  // テスト用の一時ディレクトリを作成
  const testDir = path.join(os.tmpdir(), `kugutsu-test-${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });
  console.log(`📁 テストディレクトリ: ${testDir}\n`);

  // Git リポジトリを初期化
  const { execSync } = await import('child_process');
  try {
    execSync('git init', { cwd: testDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: testDir, stdio: 'ignore' });
    execSync('git config user.name "Test User"', { cwd: testDir, stdio: 'ignore' });

    // 初期コミット
    fs.writeFileSync(path.join(testDir, 'README.md'), '# Test Project\n');
    execSync('git add .', { cwd: testDir, stdio: 'ignore' });
    execSync('git commit -m "Initial commit"', { cwd: testDir, stdio: 'ignore' });
    console.log('✅ Git リポジトリを初期化\n');
  } catch (error) {
    console.error('❌ Git 初期化エラー:', error);
    return;
  }

  // モックプロバイダーを作成して設定
  const mockProvider = new MockAIProvider();
  setupMockResponses(mockProvider);
  console.log('✅ モックレスポンスを設定\n');

  // 設定
  const config: any = {
    userRequest: 'テスト用のシンプルな機能を実装してください',
    config: {
      baseRepoPath: testDir,
      worktreeBasePath: path.join(testDir, 'worktrees'),
      maxEngineers: 1, // テストでは1人だけ
      maxTurns: 5,
      baseBranch: 'main',
      provider: 'mock' as const, // モックプロバイダーを使用
    },
  };

  console.log('📝 テスト設定:');
  console.log(`   ユーザー要求: ${config.userRequest}`);
  console.log(`   最大エンジニア数: ${config.config.maxEngineers}`);
  console.log(`   最大ターン数: ${config.config.maxTurns}`);
  console.log(`   AIプロバイダー: mock\n`);

  try {
    console.log('🚀 オーケストレーターを起動\n');
    console.log('='.repeat(60));

    // オーケストレーターを実行
    await parallelDevOrchestrator.execute(config);

    console.log('='.repeat(60));
    console.log('\n✅ テスト完了\n');

    // モックプロバイダーの統計を表示
    console.log('📊 モックプロバイダー統計:');
    console.log(`   呼び出し回数: ${mockProvider.getCallCount()}`);
    console.log(`   最後のプロンプト: ${mockProvider.getLastPrompt().substring(0, 100)}...`);

  } catch (error) {
    console.error('\n❌ テスト失敗:', error);
    throw error;
  } finally {
    // クリーンアップ
    console.log('\n🧹 テストディレクトリをクリーンアップ');
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

// テスト実行
runTest().catch((error) => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
