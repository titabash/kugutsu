import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { Task } from '../types/index.js';

const mkdir = promisify(fs.mkdir);

/**
 * PythonのTemporaryDirectory風のタスク指示ファイル管理クラス
 */
export class TaskInstructionManager {
  private tempDir!: string;
  public readonly sessionId!: string;
  private projectId!: string;
  private isActive: boolean = true;
  private baseRepoPath: string;

  constructor(baseRepoPath: string, projectId: string, sessionId?: string) {
    this.baseRepoPath = baseRepoPath;
    this.projectId = projectId;
    this.sessionId = sessionId || `task-session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    
    // .kugutsu ディレクトリ内にプロジェクト用のディレクトリを作成
    const kugutsuDir = path.join(this.baseRepoPath, '.kugutsu');
    const projectDir = path.join(kugutsuDir, 'projects', this.projectId);
    this.tempDir = path.join(projectDir, 'instructions');
    
    // ディレクトリが存在しない場合は作成
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    
    console.log(`📁 タスク指示ディレクトリ: ${path.relative(this.baseRepoPath, this.tempDir)}`);
    
    // 自動クリーンアップは無効化（.kugutsuディレクトリは永続化）
    // this.setupAutoCleanup();
  }

  /**
   * 全体概要ファイルを作成
   */
  async createOverviewFile(userRequest: string, analysis: string): Promise<string> {
    const overviewPath = path.join(this.tempDir, 'task-overview.md');
    
    const content = `# プロジェクト概要

## ユーザー要求
${userRequest}

## プロダクトオーナーAIによる分析
${analysis}

## セッション情報
- プロジェクトID: ${this.projectId}
- セッションID: ${this.sessionId}
- 作成日時: ${new Date().toISOString()}
- ディレクトリ: ${path.relative(this.baseRepoPath, this.tempDir)}

---
*このファイルは自動生成されました*
`;

    fs.writeFileSync(overviewPath, content, 'utf-8');
    console.log(`📝 概要ファイル作成: task-overview.md`);
    return overviewPath;
  }

  /**
   * 個別タスクの詳細指示ファイルを作成
   */
  async createTaskInstructionFile(task: Task, detailedInstructions: string): Promise<string> {
    const fileName = `task-${task.id.split('-')[0]}-${this.sanitizeTitle(task.title)}.md`;
    const filePath = path.join(this.tempDir, fileName);
    
    const content = `# タスク詳細: ${task.title}

## 基本情報
- **タスクID**: ${task.id}
- **タイプ**: ${task.type}
- **優先度**: ${task.priority}
- **ステータス**: ${task.status}
- **作成日時**: ${task.createdAt.toISOString()}

## 依存関係
${task.dependencies.length > 0 ? 
  task.dependencies.map(dep => `- ${dep}`).join('\n') : 
  '依存関係なし'
}

## 詳細な実装指示

${detailedInstructions}

## Worktree情報
- **ブランチ**: ${task.branchName || '未設定'}
- **作業ディレクトリ**: ${task.worktreePath || '未設定'}

## 実装チェックリスト
- [ ] コードベースの理解
- [ ] 要件の詳細確認
- [ ] 実装の実行
- [ ] テストの作成・実行
- [ ] 変更のコミット
- [ ] 動作確認

## 成功条件
${this.generateSuccessCriteria(task)}

---
*エンジニアAIへの指示ファイル - 自動生成*
`;

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`📋 タスク指示ファイル作成: ${fileName}`);
    
    // タスクオブジェクトに指示ファイルパスを追加
    (task as any).instructionFile = filePath;
    
    return filePath;
  }

  /**
   * 依存関係図ファイルを作成
   */
  async createDependencyFile(tasks: Task[]): Promise<string> {
    const depPath = path.join(this.tempDir, 'dependencies.md');
    
    let content = `# タスク依存関係図

## 実行順序概要
`;

    // 依存関係のないタスクを見つける
    const independentTasks = tasks.filter(task => task.dependencies.length === 0);
    const dependentTasks = tasks.filter(task => task.dependencies.length > 0);

    content += `
### 第1段階 (並列実行可能)
${independentTasks.map(task => `- ${task.title} (${task.id.split('-')[0]})`).join('\n')}

### 第2段階以降 (依存関係あり)
${dependentTasks.map(task => 
  `- ${task.title} (${task.id.split('-')[0]}) - 依存: [${task.dependencies.join(', ')}]`
).join('\n')}

## 詳細依存関係
`;

    for (const task of tasks) {
      content += `
### ${task.title}
- ID: ${task.id.split('-')[0]}
- 依存: ${task.dependencies.length > 0 ? task.dependencies.join(', ') : 'なし'}
- 優先度: ${task.priority}
`;
    }

    content += `
---
*依存関係管理ファイル - 自動生成*
`;

    fs.writeFileSync(depPath, content, 'utf-8');
    console.log(`🔗 依存関係ファイル作成: dependencies.md`);
    return depPath;
  }

  /**
   * エンジニアAI用の作業開始指示を作成
   */
  async createEngineerStartupInstructions(task: Task): Promise<string> {
    const startupPath = path.join(this.tempDir, `engineer-startup-${task.id.split('-')[0]}.md`);
    
    const content = `# エンジニアAI 作業開始指示

## 👋 ようこそ、エンジニアAI！

あなたは **${task.title}** の実装を担当しています。

## 📋 作業開始前の確認事項

1. **タスク詳細の確認**
   - メインの指示ファイルを必ず読んでください: \`${path.relative(task.worktreePath || '', (task as any).instructionFile || '')}\`
   - 全体概要も確認: \`${path.relative(task.worktreePath || '', path.join(this.tempDir, 'task-overview.md'))}\`

2. **作業環境の確認**
   - 現在のディレクトリ: ${task.worktreePath}
   - 担当ブランチ: ${task.branchName}
   - Gitステータスを確認してください

3. **コードベースの理解**
   - プロジェクト構造を把握
   - 既存のコード規約を確認
   - 関連するテストの確認

## 🚀 作業開始コマンド

まず以下を実行して、詳細な指示を確認してください：

\`\`\`bash
# タスク詳細を確認
cat "${path.relative(task.worktreePath || '', (task as any).instructionFile || '')}"

# プロジェクト概要を確認  
cat "${path.relative(task.worktreePath || '', path.join(this.tempDir, 'task-overview.md'))}"

# 現在のGitステータスを確認
git status
\`\`\`

## ⚠️ 重要な注意事項

- すべての変更は適切なコミットメッセージでコミットしてください
- 既存のテストを壊さないように注意してください
- 不明な点があれば、関連ファイルを調査してください

頑張ってください！🎯
`;

    fs.writeFileSync(startupPath, content, 'utf-8');
    return startupPath;
  }

  /**
   * タスク完了時のステータス更新
   */
  async updateTaskStatus(taskId: string, status: 'completed' | 'failed', notes?: string): Promise<void> {
    const statusFile = path.join(this.tempDir, `status-${taskId.split('-')[0]}.md`);
    
    const content = `# タスクステータス

- **タスクID**: ${taskId}
- **ステータス**: ${status}
- **更新日時**: ${new Date().toISOString()}

## 備考
${notes || 'なし'}

---
*ステータス管理ファイル*
`;

    fs.writeFileSync(statusFile, content, 'utf-8');
    console.log(`📊 ステータス更新: ${taskId} -> ${status}`);
  }

  /**
   * ディレクトリパスを取得
   */
  getTempDirectory(): string {
    return this.tempDir;
  }

  /**
   * セッションIDを取得
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * 指示ファイル一覧を取得
   */
  listInstructionFiles(): string[] {
    if (!fs.existsSync(this.tempDir)) return [];
    
    return fs.readdirSync(this.tempDir)
      .filter(file => file.endsWith('.md'))
      .map(file => path.join(this.tempDir, file));
  }

  /**
   * TemporaryDirectory風のクリーンアップ (with文の__exit__相当)
   * 注: .kugutsuディレクトリは永続化のため、実際のクリーンアップは行わない
   */
  async cleanup(): Promise<void> {
    if (!this.isActive) return;
    
    // .kugutsuディレクトリは永続化のため削除しない
    console.log(`📁 タスク指示ディレクトリを保持: ${path.relative(this.baseRepoPath, this.tempDir)}`);
    this.isActive = false;
  }

  // デストラクタは.kugutsuディレクトリ使用のため不要
  // private setupAutoCleanup(): void { }

  /**
   * 非同期でTaskInstructionManagerを作成
   */
  static async create(baseRepoPath: string, projectId: string, sessionId?: string): Promise<TaskInstructionManager> {
    const instance = Object.create(TaskInstructionManager.prototype);
    instance.isActive = true;
    instance.baseRepoPath = baseRepoPath;
    instance.projectId = projectId;
    instance.sessionId = sessionId || `task-session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    
    try {
      // .kugutsu ディレクトリ内にプロジェクト用のディレクトリを作成
      const kugutsuDir = path.join(instance.baseRepoPath, '.kugutsu');
      const projectDir = path.join(kugutsuDir, 'projects', instance.projectId);
      instance.tempDir = path.join(projectDir, 'instructions');
      
      // ディレクトリが存在しない場合は作成
      await mkdir(instance.tempDir, { recursive: true });
      
      console.log(`📁 タスク指示ディレクトリ作成（非同期）: ${path.relative(instance.baseRepoPath, instance.tempDir)}`);
      
      // 自動クリーンアップは無効化（.kugutsuディレクトリは永続化）
      // instance.setupAutoCleanup();
      
      return instance;
    } catch (error) {
      console.error('❌ ディレクトリ作成エラー:', error);
      throw new Error(`ディレクトリの作成に失敗しました: ${error}`);
    }
  }

  /**
   * ファイル名用の文字列サニタイズ
   */
  private sanitizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 30);
  }

  /**
   * タスクタイプに応じた成功条件を生成
   */
  private generateSuccessCriteria(task: Task): string {
    const baseCriteria = [
      '要求された機能が正常に動作する',
      '既存の機能に悪影響を与えない',
      'コードが適切にコミットされている'
    ];

    const typeCriteria: Record<string, string[]> = {
      feature: ['新機能が仕様通りに実装されている', '適切なテストが追加されている'],
      bugfix: ['バグが修正されている', '回帰テストが追加されている'],
      refactor: ['コードの可読性・保守性が向上している', 'パフォーマンスが改善または維持されている'],
      test: ['テストカバレッジが向上している', 'テストが適切に実行される'],
      docs: ['ドキュメントが正確で理解しやすい', '関連する例やサンプルが含まれている']
    };

    const criteria = [...baseCriteria, ...(typeCriteria[task.type] || [])];
    return criteria.map(c => `- ${c}`).join('\n');
  }
}