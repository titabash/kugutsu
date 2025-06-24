import { execSync } from 'child_process';
import { TechLeadAI } from './TechLeadAI';
import { EngineerAI } from './EngineerAI';
import { GitWorktreeManager } from './GitWorktreeManager';
import { MergeCoordinator } from '../utils/MergeCoordinator';
import { Task, EngineerResult, ReviewResult, SystemConfig } from '../types';

/**
 * レビューワークフローの管理
 */
export class ReviewWorkflow {
  private readonly gitManager: GitWorktreeManager;
  private readonly config: SystemConfig;
  private readonly maxRetries: number;
  private readonly maxConflictResolutionRetries: number = 2;
  private readonly mergeCoordinator: MergeCoordinator;

  constructor(gitManager: GitWorktreeManager, config: SystemConfig, maxRetries: number = 3) {
    this.gitManager = gitManager;
    this.config = config;
    this.maxRetries = maxRetries;
    this.mergeCoordinator = new MergeCoordinator(config);
  }

  /**
   * タスクのレビューワークフローを実行（単一ループ）
   */
  async executeReviewWorkflow(
    task: Task, 
    engineerResult: EngineerResult,
    engineerId: string,
    existingEngineer?: EngineerAI
  ): Promise<{
    approved: boolean;
    reviewHistory: ReviewResult[];
    finalResult?: EngineerResult;
    merged?: boolean;
  }> {
    console.log(`\n🔍 レビューワークフロー開始: ${task.title}`);
    
    const reviewHistory: ReviewResult[] = [];
    let currentResult = engineerResult;
    let retryCount = 0;

    while (retryCount < this.maxRetries) {
      console.log(`\n📝 レビューラウンド ${retryCount + 1}/${this.maxRetries}`);

      // Step 1: テックリードAIによるレビュー
      const reviewResult = await this.performReview(task, currentResult);
      reviewHistory.push(reviewResult);

      // Step 2: レビューがOKならマージを試行
      let needsChanges = false;
      let changeReason = '';
      
      if (reviewResult.status === 'APPROVED' || reviewResult.status === 'COMMENTED') {
        console.log(`✅ レビュー${reviewResult.status === 'APPROVED' ? '承認' : 'コメント付き承認'}: ${task.title}`);
        
        // マージ試行
        const mergeResult = await this.tryMerge(task);
        
        if (mergeResult.success) {
          // マージ成功 - クリーンアップして完了
          await this.cleanupAfterMerge(task);
          
          console.log(`✅ マージ完了: ${task.title}`);
          return {
            approved: true,
            reviewHistory,
            finalResult: currentResult,
            merged: true
          };
        } else if (mergeResult.hasConflict) {
          // コンフリクトを通常の修正として扱う
          console.log(`⚠️ マージコンフリクト検出: ${task.title}`);
          needsChanges = true;
          changeReason = 'コンフリクト解消';
          reviewResult.comments.push('マージ時にコンフリクトが発生しました。コンフリクトを解消してください。');
        } else {
          // その他のマージエラー
          console.error(`❌ マージエラー: ${task.title} - ${mergeResult.error}`);
          return {
            approved: false,
            reviewHistory,
            finalResult: currentResult,
            merged: false
          };
        }
      } else if (reviewResult.status === 'CHANGES_REQUESTED') {
        console.log(`🔄 修正要求: ${task.title}`);
        needsChanges = true;
        changeReason = 'レビューフィードバック対応';
      } else if (reviewResult.status === 'ERROR') {
        console.error(`❌ レビューエラー: ${task.title}`);
        return {
          approved: false,
          reviewHistory,
          finalResult: currentResult,
          merged: false
        };
      }
      
      // Step 3: 修正が必要な場合（フィードバック or コンフリクト）
      if (needsChanges && retryCount < this.maxRetries - 1) {
        console.log(`🔧 修正作業開始（${changeReason}）: ${task.title}`);
        
        // エンジニアAIに修正を依頼
        currentResult = await this.requestChanges(
          task, 
          reviewResult, 
          engineerId, 
          existingEngineer,
          changeReason
        );
        
        if (!currentResult.success) {
          console.error(`❌ 修正作業失敗: ${task.title}`);
          return {
            approved: false,
            reviewHistory,
            finalResult: currentResult,
            merged: false
          };
        }
        
        console.log(`✅ 修正作業完了: ${task.title}`);
        // 次のループで再レビュー
      } else if (needsChanges) {
        console.warn(`⚠️ 最大リトライ回数到達: ${task.title}`);
      }

      retryCount++;
    }

    // リトライ回数制限到達
    console.warn(`⚠️ レビューワークフロー未完了: ${task.title} (${retryCount}回試行)`);
    return {
      approved: false,
      reviewHistory,
      finalResult: currentResult,
      merged: false
    };
  }

  /**
   * テックリードAIによるレビュー実行
   */
  private async performReview(task: Task, engineerResult: EngineerResult): Promise<ReviewResult> {
    const techLeadId = `techlead-${Date.now()}`;
    const techLead = new TechLeadAI(techLeadId);

    console.log(`👔 テックリードAI[${techLeadId}]によるレビュー開始`);
    
    try {
      const reviewResult = await techLead.reviewEngineerWork(task, engineerResult);
      console.log(`📊 レビュー結果: ${reviewResult.status}`);
      
      return reviewResult;
    } catch (error) {
      console.error(`❌ レビュー実行エラー:`, error);
      return {
        taskId: task.id,
        status: 'ERROR',
        comments: [`レビュー実行中にエラーが発生しました: ${error}`],
        reviewer: techLeadId,
        reviewedAt: new Date(),
        duration: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * エンジニアAIに修正を依頼
   */
  private async requestChanges(
    task: Task, 
    reviewResult: ReviewResult, 
    engineerId: string,
    existingEngineer?: EngineerAI,
    changeReason?: string
  ): Promise<EngineerResult> {
    console.log(`🔄 修正作業開始: ${engineerId}`);

    // 既存のエンジニアインスタンスを使用、なければ新規作成
    const engineer = existingEngineer || new EngineerAI(engineerId, {
      maxTurns: this.config.maxTurnsPerTask
    });

    console.log(`🔄 エンジニアAI[${engineerId}]に修正依頼 (セッションID: ${engineer.getSessionId() || 'なし'})`);

    // 修正用のタスクを作成
    const reasonPrefix = changeReason === 'コンフリクト解消' ? '[コンフリクト解消]' : '[修正]';
    const revisionTask: Task = {
      ...task,
      title: `${reasonPrefix} ${task.title}`,
      description: changeReason === 'コンフリクト解消' 
        ? this.buildConflictResolutionDescription(task)
        : `${task.description}\n\n## レビューフィードバック\n${reviewResult.comments.join('\n')}`
    };

    try {
      const result = await engineer.executeTask(revisionTask);
      console.log(`✅ 修正作業完了: ${engineerId}`);
      return result;
    } catch (error) {
      console.error(`❌ 修正作業失敗: ${engineerId}`, error);
      return {
        taskId: task.id,
        engineerId: engineerId,
        success: false,
        output: [],
        error: error instanceof Error ? error.message : String(error),
        duration: 0,
        filesChanged: []
      };
    }
  }

  /**
   * マージを試行（ベストプラクティス版）
   */
  private async tryMerge(task: Task): Promise<{
    success: boolean;
    hasConflict?: boolean;
    error?: string;
  }> {
    if (!task.branchName || !task.worktreePath) {
      return { success: false, error: 'ブランチ情報が不足しています' };
    }

    try {
      console.log(`🔀 マージ試行: ${task.branchName} -> ${this.config.baseBranch}`);

      // ベストプラクティス: フィーチャーブランチ側でメインブランチをマージしてコンフリクトを解消
      // Step 1: worktreeで最新のメインブランチを取得
      console.log(`📥 フィーチャーブランチで最新のメインブランチを取得中...`);
      
      // worktreeに移動してフィーチャーブランチが最新か確認
      execSync(`git checkout ${task.branchName}`, {
        cwd: task.worktreePath,
        stdio: 'pipe'
      });
      
      // リモートの最新情報を取得
      try {
        execSync(`git fetch origin`, {
          cwd: task.worktreePath,
          stdio: 'pipe'
        });
      } catch (e) {
        console.log(`📝 リモート取得をスキップ（ローカル環境）`);
      }
      
      // Step 2: フィーチャーブランチにメインブランチをマージ（ここでコンフリクトチェック）
      try {
        console.log(`🔄 フィーチャーブランチにメインブランチをマージ中...`);
        execSync(`git merge ${this.config.baseBranch}`, {
          cwd: task.worktreePath,
          stdio: 'pipe'
        });
        console.log(`✅ フィーチャーブランチへのマージ成功`);
      } catch (mergeError) {
        // コンフリクトが発生した場合
        const conflictInWorktree = await this.detectMergeConflict(task.worktreePath);
        if (conflictInWorktree) {
          console.log(`⚠️ フィーチャーブランチでコンフリクト検出`);
          return { success: false, hasConflict: true };
        }
        throw mergeError;
      }
      
      // Step 3: コンフリクトがなければ、メインブランチにフィーチャーブランチをマージ
      console.log(`📤 メインブランチにフィーチャーブランチをマージ中...`);
      
      // メインリポジトリでメインブランチに切り替え
      execSync(`git checkout ${this.config.baseBranch}`, {
        cwd: this.config.baseRepoPath,
        stdio: 'pipe'
      });
      
      // フィーチャーブランチをマージ（fast-forwardを無効化）
      execSync(`git merge --no-ff ${task.branchName}`, {
        cwd: this.config.baseRepoPath,
        stdio: 'pipe'
      });

      console.log(`✅ マージ成功: ${task.branchName}`);
      return { success: true };

    } catch (error) {
      console.error(`❌ マージエラー:`, error);
      
      // worktreeでマージが進行中の場合は中止
      try {
        execSync(`git merge --abort`, {
          cwd: task.worktreePath,
          stdio: 'pipe'
        });
      } catch (e) {
        // 中止エラーは無視
      }
      
      return { success: false, error: 'マージに失敗しました' };
    }
  }

  /**
   * メインブランチにマージ（旧版・削除予定）
   */
  private async mergeToMainBranch(task: Task): Promise<boolean | 'CONFLICT'> {
    if (!task.branchName || !task.worktreePath) {
      console.error(`❌ ブランチ情報が不足: ${task.id}`);
      return false;
    }

    try {
      console.log(`🔀 メインブランチへのマージ開始: ${task.branchName}`);

      // メインリポジトリで作業
      const mainRepoPath = this.config.baseRepoPath;

      // メインブランチに切り替え
      execSync(`git checkout ${this.config.baseBranch}`, {
        cwd: mainRepoPath,
        stdio: 'pipe'
      });

      // フィーチャーブランチをマージ（ローカルのみ）
      execSync(`git merge --no-ff ${task.branchName}`, {
        cwd: mainRepoPath,
        stdio: 'pipe'
      });

      console.log(`✅ マージ完了: ${task.branchName} -> ${this.config.baseBranch}`);
      return true;

    } catch (error) {
      console.error(`❌ マージエラー:`, error);
      
      // マージコンフリクトかどうかを確認
      const conflictDetected = await this.detectMergeConflict(this.config.baseRepoPath);
      
      if (conflictDetected) {
        console.log(`⚠️ マージコンフリクト検出: ${task.branchName}`);
        return 'CONFLICT';
      } else {
        // 通常のマージエラーの場合はマージを中止
        try {
          execSync(`git merge --abort`, {
            cwd: this.config.baseRepoPath,
            stdio: 'pipe'
          });
        } catch (abortError) {
          // マージ中止のエラーは無視
        }
        return false;
      }
    }
  }

  /**
   * マージコンフリクトの検出
   */
  private async detectMergeConflict(repoPath: string): Promise<boolean> {
    try {
      const status = execSync('git status --porcelain', {
        cwd: repoPath,
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      
      // マージコンフリクトのマーカーを探す
      // UU = both modified, AA = both added, DD = both deleted
      return status.includes('UU ') || status.includes('AA ') || status.includes('DD ');
    } catch (error) {
      return false;
    }
  }

  /**
   * エンジニアAIにコンフリクト解消を依頼
   */
  private async resolveConflictWithEngineer(task: Task, engineerId: string, existingEngineer?: EngineerAI): Promise<EngineerResult> {
    console.log(`🔧 コンフリクト解消作業開始: ${engineerId}`);

    // 既存のエンジニアインスタンスを使用、なければ新規作成
    const engineer = existingEngineer || new EngineerAI(engineerId, {
      maxTurns: this.config.maxTurnsPerTask,
      systemPrompt: this.getConflictResolutionPrompt()
    });

    console.log(`🔧 エンジニアAI[${engineerId}]にコンフリクト解消依頼 (セッションID: ${engineer.getSessionId() || 'なし'})`);

    // コンフリクト解消用のタスクを作成
    const conflictTask: Task = {
      ...task,
      title: `[コンフリクト解消] ${task.title}`,
      description: this.buildConflictResolutionDescription(task)
    };

    try {
      const result = await engineer.executeTask(conflictTask);
      console.log(`✅ コンフリクト解消作業完了: ${engineerId}`);
      return result;
    } catch (error) {
      console.error(`❌ コンフリクト解消作業失敗: ${engineerId}`, error);
      return {
        taskId: task.id,
        engineerId: engineerId,
        success: false,
        output: [],
        error: error instanceof Error ? error.message : String(error),
        duration: 0,
        filesChanged: []
      };
    }
  }

  /**
   * コンフリクト解消用のシステムプロンプト
   */
  private getConflictResolutionPrompt(): string {
    return `あなたは経験豊富なソフトウェアエンジニアです。
Gitマージコンフリクトの解消を専門とします。

## 役割
マージコンフリクトが発生したコードを適切に解消して、正常にマージできる状態にすることです。

## コンフリクト解消の手順

### 1. 現状確認
まず現在の状況を把握してください：
\`\`\`bash
git status
git diff
\`\`\`

### 2. コンフリクトファイルの特定
コンフリクトが発生しているファイルを確認：
\`\`\`bash
git diff --name-only --diff-filter=U
\`\`\`

### 3. コンフリクト内容の分析
各ファイルのコンフリクトマーカーを確認：
- \`<<<<<<< HEAD\` : 現在のブランチ（メインブランチ）の内容
- \`=======\` : 区切り
- \`>>>>>>> [ブランチ名]\` : マージしようとしているブランチの内容

### 4. 適切な解消方法の選択
以下の原則に従って解消してください：

#### 基本原則
- **既存機能を壊さない**: メインブランチの既存機能は保持
- **新機能を活かす**: マージしようとしている新機能も適切に統合
- **コード品質を維持**: 一貫性のあるコードスタイルを保持
- **テストを考慮**: 既存テストが通り、新機能のテストも動作する状態に

#### 解消戦略
1. **単純な追加**: 両方の変更が独立している場合は両方を保持
2. **設定の統合**: 設定ファイルの場合は論理的に統合
3. **機能の統合**: 機能追加の場合は適切に統合
4. **優先順位**: 不明な場合は安全性を優先

### 5. 解消の実行
1. コンフリクトファイルを手動で編集
2. コンフリクトマーカー（\`<<<<<<<\`, \`=======\`, \`>>>>>>>\`）を完全に削除
3. 動作確認とテスト実行
4. ステージングとコミット

### 6. 最終確認
\`\`\`bash
# テストの実行（可能であれば）
npm test
# または
pytest

# ビルドの確認（可能であれば）
npm run build

# 最終的なコミット
git add .
git commit -m "resolve: マージコンフリクトを解消

- [具体的な解消内容を記載]
- 既存機能への影響なし
- 新機能を適切に統合"
\`\`\`

## 重要事項
- コンフリクトマーカーを残さない
- 両方の変更の意図を尊重する
- 解消理由を明確にコミットメッセージに記載
- 疑問があれば保守的に解消する

確実で安全なコンフリクト解消を心がけてください。`;
  }

  /**
   * コンフリクト解消用のタスク説明を構築（ベストプラクティス版）
   */
  private buildConflictResolutionDescription(task: Task): string {
    return `## ⚠️ マージコンフリクト解消タスク

**元のタスク**: ${task.title}
**作業ディレクトリ**: ${task.worktreePath}
**タスクの詳細**: ${task.description}

### 状況
フィーチャーブランチにメインブランチをマージしようとした際にコンフリクトが発生しました。
Gitのベストプラクティスに従って、フィーチャーブランチ側でコンフリクトを解消します。

### このタスクの目的
上記のタスク詳細を確認し、何を実現しようとしているのか理解した上で、
その目的を損なわないようにコンフリクトを解消してください。

### Gitコンフリクト解消のベストプラクティス

**原則**: コンフリクトは常にフィーチャーブランチ側で解消する
- メインブランチは常にクリーンな状態を保つ
- フィーチャーブランチでメインブランチの変更を取り込んで解消
- 解消後、メインブランチへのマージはfast-forwardまたはクリーンなマージコミットになる

### 実行手順

1. 現在の状態を確認（コンフリクト状態であることを確認）:
   \`\`\`bash
   git status
   # "You have unmerged paths" と表示されるはず
   \`\`\`

2. コンフリクトファイルを確認:
   \`\`\`bash
   # コンフリクトしているファイルの一覧
   git diff --name-only --diff-filter=U
   
   # コンフリクトの詳細を確認
   git diff
   \`\`\`

3. 各コンフリクトファイルを解消:
   - エディタでファイルを開く
   - コンフリクトマーカーを探す:
     - \`<<<<<<< HEAD\` (あなたの変更)
     - \`=======\` (区切り)
     - \`>>>>>>> ${this.config.baseBranch}\` (メインブランチの変更)
   - 両方の変更を理解し、適切に統合
   - すべてのコンフリクトマーカーを削除

4. 解消したファイルをステージング:
   \`\`\`bash
   # 個別にファイルを追加
   git add <解消したファイル>
   
   # または全て解消済みなら
   git add .
   \`\`\`

5. テスト実行（重要）:
   \`\`\`bash
   # ビルドが通ることを確認
   npm run build || make build
   
   # テストが通ることを確認
   npm test || pytest
   \`\`\`

6. マージを完了:
   \`\`\`bash
   # コンフリクト解消をコミット（マージコミット）
   git commit
   # エディタが開くので、適切なメッセージを入力
   # デフォルトメッセージ: "Merge branch 'main' into feature/..."
   \`\`\`

7. 解消完了を確認:
   \`\`\`bash
   # クリーンな状態か確認
   git status
   
   # マージコミットが作成されたか確認
   git log --oneline -n 3
   
   # メインブランチとの関係を確認
   git log --graph --oneline -n 10
   \`\`\`

### 解消時の重要な確認事項

1. **ProductOwnerAIの仕様書を確認**:
   \`\`\`bash
   # プロジェクトの仕様書や要件定義を確認
   cat README.md
   cat docs/*.md
   # または CLAUDE.md, SPEC.md などのドキュメント
   \`\`\`

2. **直近のコミットログを確認**:
   \`\`\`bash
   # 両ブランチの直近のコミットを確認し、変更の意図を理解
   git log --oneline -n 10 HEAD
   git log --oneline -n 10 ${this.config.baseBranch}
   
   # コンフリクトに関連するコミットの詳細を確認
   git show <commit-hash>
   \`\`\`

3. **デグレーション防止の確認**:
   - **機能の統合**: 両方の変更が異なる機能を追加している場合、両方を保持
   - **同一機能の改善**: より新しい/より良い実装を選択
   - **バグ修正と機能追加**: バグ修正を優先し、その上に機能を追加
   - **既存機能の保護**: メインブランチの既存機能が壊れないことを最優先

### コンフリクト解消の判断基準

1. **仕様との整合性**: ProductOwnerAIが定義した仕様に合致しているか
2. **コミット履歴の尊重**: 各コミットの意図を理解し、それを反映した解消
3. **テストの通過**: 既存のテストが全て通ることを確認
4. **後方互換性**: 既存の機能やAPIが引き続き動作することを確認

判断に迷った場合は、より保守的な選択（既存機能を確実に保護する選択）を行ってください。`;
  }

  /**
   * マージ後のクリーンアップ
   */
  private async cleanupAfterMerge(task: Task): Promise<void> {
    if (!task.branchName) {
      return;
    }

    try {
      console.log(`🧹 クリーンアップ開始: ${task.id}`);

      // ワークツリーの削除
      await this.gitManager.removeWorktree(task.id);

      // フィーチャーブランチの削除
      execSync(`git branch -d ${task.branchName}`, {
        cwd: this.config.baseRepoPath,
        stdio: 'pipe'
      });

      console.log(`✅ クリーンアップ完了: ${task.id}`);

    } catch (error) {
      console.warn(`⚠️ クリーンアップ中にエラー:`, error);
      // クリーンアップエラーは継続可能
    }
  }

  /**
   * レビューワークフローの統計情報を取得
   */
  getWorkflowStats(reviewHistory: ReviewResult[]): {
    totalReviews: number;
    approvedCount: number;
    changesRequestedCount: number;
    commentedCount: number;
    errorCount: number;
    averageReviewTime: number;
  } {
    const totalReviews = reviewHistory.length;
    const approvedCount = reviewHistory.filter(r => r.status === 'APPROVED').length;
    const changesRequestedCount = reviewHistory.filter(r => r.status === 'CHANGES_REQUESTED').length;
    const commentedCount = reviewHistory.filter(r => r.status === 'COMMENTED').length;
    const errorCount = reviewHistory.filter(r => r.status === 'ERROR').length;
    
    const totalReviewTime = reviewHistory.reduce((sum, r) => sum + r.duration, 0);
    const averageReviewTime = totalReviews > 0 ? totalReviewTime / totalReviews : 0;

    return {
      totalReviews,
      approvedCount,
      changesRequestedCount,
      commentedCount,
      errorCount,
      averageReviewTime
    };
  }

  /**
   * 全ての保留中のコンフリクト解消処理の完了を待機（削除予定）
   */
  async waitForAllConflictResolutions(): Promise<void> {
    // 単一ループ化により不要になったが、互換性のため一時的に保持
    console.log(`⚠️ waitForAllConflictResolutions は非推奨です`);
  }

  /**
   * コンフリクト解消完了後の再レビュー処理（削除予定）
   */
  async handleConflictResolutionResults(): Promise<Map<string, boolean>> {
    // 単一ループ化により不要になったが、互換性のため空のMapを返す
    console.log(`⚠️ handleConflictResolutionResults は非推奨です`);
    return new Map<string, boolean>();
  }

  /**
   * コンフリクト解消に対する再レビューとマージの実行（削除予定）
   * @deprecated 単一ループ化により不要
   */
  private async performConflictResolutionReReview(
    taskId: string, 
    conflictResolutionResult: EngineerResult
  ): Promise<boolean> {
    // タスク情報をMergeCoordinatorから取得
    const task = this.mergeCoordinator.getTask(taskId);
    if (!task) {
      console.error(`❌ タスク情報が見つかりません: ${taskId}`);
      return false;
    }
    
    console.log(`📊 コンフリクト解消後レビューループ開始: ${task.title}`);
    
    let currentResult = conflictResolutionResult;
    let retryCount = 0;
    const reviewHistory: ReviewResult[] = [];
    
    // コンフリクト解消後の修正→レビューループ
    while (retryCount < this.maxConflictResolutionRetries) {
      console.log(`\n📝 コンフリクト解消レビューラウンド ${retryCount + 1}/${this.maxConflictResolutionRetries}`);
      
      // コンフリクト解消内容のレビュー
      const reviewTask: Task = {
        ...task,
        title: `[コンフリクト解消-R${retryCount + 1}] ${task.title}`,
        description: `${task.description}\n\n## コンフリクト解消内容レビュー\nコンフリクト解消作業の結果をレビューしてください。`
      };
      
      const reviewResult = await this.performReview(reviewTask, currentResult);
      reviewHistory.push(reviewResult);
      
      // レビュー結果による分岐
      switch (reviewResult.status) {
        case 'APPROVED':
          console.log(`✅ コンフリクト解消内容が承認されました: ${task.title}`);
          
          // 最終マージの実行
          console.log(`🔀 最終マージ実行: ${task.title}`);
          try {
            const finalMergeResult = await this.performFinalMergeAfterReReview(task);
            if (finalMergeResult) {
              console.log(`✅ 最終マージ成功: ${task.title}`);
              
              // クリーンアップの実行
              await this.cleanupAfterMerge(task);
              console.log(`🧹 クリーンアップ完了: ${task.title}`);
              
              return true;
            } else {
              console.error(`❌ 最終マージ失敗: ${task.title}`);
              return false;
            }
          } catch (error) {
            console.error(`❌ 最終マージエラー: ${task.title}`, error);
            return false;
          }
          
        case 'CHANGES_REQUESTED':
          console.log(`🔄 コンフリクト解消内容の修正が要求されました: ${task.title}`);
          
          if (retryCount < this.maxConflictResolutionRetries - 1) {
            // 再修正を実行
            currentResult = await this.requestChangesForConflictResolution(
              task, 
              reviewResult, 
              conflictResolutionResult.engineerId
            );
            
            if (!currentResult.success) {
              console.error(`❌ コンフリクト解消の修正作業に失敗: ${task.title}`);
              return false;
            }
          } else {
            console.error(`❌ コンフリクト解消の修正試行回数上限に達しました: ${task.title}`);
            return false;
          }
          break;
          
        case 'COMMENTED':
          console.log(`💬 コンフリクト解消にコメントあり（承認扱い）: ${task.title}`);
          console.log(`📝 コメント: ${reviewResult.comments.join(', ')}`);
          
          // COMMENTEDは承認扱いとして最終マージ実行
          try {
            const finalMergeResult = await this.performFinalMergeAfterReReview(task);
            if (finalMergeResult) {
              console.log(`✅ 最終マージ成功（コメント付き承認）: ${task.title}`);
              
              // クリーンアップの実行
              await this.cleanupAfterMerge(task);
              console.log(`🧹 クリーンアップ完了: ${task.title}`);
              
              return true;
            } else {
              console.error(`❌ 最終マージ失敗: ${task.title}`);
              return false;
            }
          } catch (error) {
            console.error(`❌ 最終マージエラー: ${task.title}`, error);
            return false;
          }
          
        case 'ERROR':
        default:
          console.error(`❌ コンフリクト解消レビューエラー: ${task.title}`);
          console.error(`🔍 エラー詳細: ${reviewResult.error || 'Unknown error'}`);
          return false;
      }
      
      retryCount++;
    }
    
    console.error(`❌ コンフリクト解消レビューの最大試行回数に達しました: ${task.title}`);
    return false;
  }

  /**
   * レビューコメントから改善修正が必要かを判断
   */
  private shouldApplyCommentImprovements(comments: string[]): boolean {
    // 改善提案を示すキーワードを検索
    const improvementKeywords = [
      '改善', '修正', '最適化', '効率化', 'improve', 'optimize', 'refactor',
      'better', 'should', 'consider', '提案', 'suggest', 'recommend',
      'より良い', 'もっと', '追加', 'add', 'enhance'
    ];
    
    const joinedComments = comments.join(' ').toLowerCase();
    
    // キーワードが含まれている場合は改善修正を推奨
    return improvementKeywords.some(keyword => 
      joinedComments.includes(keyword.toLowerCase())
    );
  }

  /**
   * コンフリクト解消専用の修正要求処理
   */
  private async requestChangesForConflictResolution(
    task: Task, 
    reviewResult: ReviewResult, 
    engineerId: string
  ): Promise<EngineerResult> {
    console.log(`🔄 コンフリクト解消内容の修正作業開始: ${engineerId}`);

    // 既存のエンジニアインスタンスを再利用（セッション継続）
    const engineer = new EngineerAI(engineerId, {
      maxTurns: this.config.maxTurnsPerTask
    });

    // 修正用のタスクを作成
    const revisionTask: Task = {
      ...task,
      title: `[コンフリクト解消修正] ${task.title}`,
      description: `${task.description}\n\n## レビューフィードバック（コンフリクト解消内容）\n${reviewResult.comments.join('\n')}\n\n上記のフィードバックに基づいて、コンフリクト解消内容を修正してください。`
    };

    try {
      console.log(`🔧 コンフリクト解消修正実行中: ${engineerId}`);
      const result = await engineer.executeTask(revisionTask);
      
      if (result.success) {
        console.log(`✅ コンフリクト解消修正完了: ${engineerId}`);
      } else {
        console.error(`❌ コンフリクト解消修正失敗: ${engineerId} - ${result.error}`);
      }
      
      return result;
    } catch (error) {
      console.error(`❌ コンフリクト解消修正実行エラー:`, error);
      return {
        taskId: task.id,
        engineerId,
        success: false,
        output: [],
        error: error instanceof Error ? error.message : String(error),
        duration: 0,
        filesChanged: []
      };
    }
  }

  /**
   * 再レビュー後の最終マージ実行（コンフリクト解消ループ付き）
   */
  private async performFinalMergeAfterReReview(task: Task): Promise<boolean> {
    const maxFinalMergeRetries = 3;
    let retryCount = 0;

    while (retryCount < maxFinalMergeRetries) {
      try {
        console.log(`🔀 最終マージ試行 ${retryCount + 1}/${maxFinalMergeRetries}: ${task.title}`);
        
        // メインブランチに切り替え
        execSync(`git checkout ${this.config.baseBranch}`, {
          cwd: this.config.baseRepoPath,
          stdio: 'pipe'
        });

        // フィーチャーブランチをマージ
        execSync(`git merge --no-ff ${task.branchName}`, {
          cwd: this.config.baseRepoPath,
          stdio: 'pipe'
        });

        console.log(`✅ 最終マージ完了: ${task.branchName} -> ${this.config.baseBranch}`);
        return true;
        
      } catch (error) {
        console.error(`❌ 最終マージ失敗 (試行 ${retryCount + 1}): ${task.title}`, error);
        
        // コンフリクトかどうかを確認
        const conflictDetected = await this.detectMergeConflict(this.config.baseRepoPath);
        
        if (conflictDetected) {
          console.log(`⚠️ 最終マージでコンフリクトが発生: ${task.branchName}`);
          
          if (retryCount < maxFinalMergeRetries - 1) {
            console.log(`🔧 最終マージコンフリクトの自動解消を試行: ${task.title}`);
            
            // コンフリクト解消を試行
            const conflictResolutionResult = await this.resolveFinalMergeConflict(task);
            
            if (conflictResolutionResult) {
              console.log(`✅ 最終マージコンフリクト解消成功: ${task.title}`);
              // 次のループで再度マージを試行
              retryCount++;
              continue;
            } else {
              console.error(`❌ 最終マージコンフリクト解消失敗: ${task.title}`);
              // マージを中止して次の試行へ
              this.abortMerge();
            }
          } else {
            console.error(`❌ 最終マージ試行回数上限到達: ${task.title}`);
            console.error(`🔍 手動での解決が必要です`);
            this.abortMerge();
          }
        } else {
          // 通常のマージエラー（コンフリクト以外）
          console.error(`❌ 最終マージで通常エラー: ${task.title}`);
          this.abortMerge();
        }
        
        retryCount++;
      }
    }
    
    return false;
  }

  /**
   * 最終マージ時のコンフリクト解消
   */
  private async resolveFinalMergeConflict(task: Task): Promise<boolean> {
    try {
      console.log(`🔧 最終マージコンフリクト解消開始: ${task.title}`);
      
      // コンフリクト解消専用のエンジニアAIを作成
      const conflictEngineerId = `final-merge-resolver-${Date.now()}`;
      const engineer = new EngineerAI(conflictEngineerId, {
        maxTurns: this.config.maxTurnsPerTask,
        systemPrompt: this.getFinalMergeConflictResolutionPrompt()
      });

      // コンフリクト解消用のタスクを作成
      const conflictTask: Task = {
        ...task,
        title: `[最終マージコンフリクト解消] ${task.title}`,
        description: this.buildFinalMergeConflictDescription(task)
      };

      const result = await engineer.executeTask(conflictTask);
      
      if (result.success) {
        console.log(`✅ 最終マージコンフリクト解消完了: ${task.title}`);
        return true;
      } else {
        console.error(`❌ 最終マージコンフリクト解消失敗: ${task.title} - ${result.error}`);
        return false;
      }
      
    } catch (error) {
      console.error(`❌ 最終マージコンフリクト解消エラー:`, error);
      return false;
    }
  }

  /**
   * マージ中止処理
   */
  private abortMerge(): void {
    try {
      execSync(`git merge --abort`, {
        cwd: this.config.baseRepoPath,
        stdio: 'pipe'
      });
    } catch (abortError) {
      // マージ中止のエラーは無視
    }
  }

  /**
   * 最終マージコンフリクト解消用のシステムプロンプト
   */
  private getFinalMergeConflictResolutionPrompt(): string {
    return `あなたは経験豊富なソフトウェアエンジニアです。
最終マージ時のGitコンフリクト解消を専門とします。

## 役割
最終マージ段階で発生したコンフリクトを適切に解消して、正常にマージできる状態にすることです。

## 最終マージコンフリクトの特徴
- 通常のコンフリクト解消とレビューを経た後の最終統合段階
- メインブランチの最新変更との競合
- 他のタスクの変更との相互作用の可能性

## 解消手順

### 1. 現状確認
\`\`\`bash
git status
git diff
\`\`\`

### 2. コンフリクト分析
- メインブランチの最新変更を確認
- 自分の変更との競合点を特定
- 両方の変更の意図を理解

### 3. 慎重な解消
- 既存機能を壊さない
- 新機能を適切に統合
- テスト実行で動作確認

### 4. 最終確認とコミット
\`\`\`bash
# テスト実行
npm test || pytest

# コミット
git add .
git commit -m "resolve: 最終マージコンフリクトを解消

- メインブランチとの競合を解決
- 既存機能への影響なし
- 新機能を適切に統合"
\`\`\`

最終段階のコンフリクト解消のため、特に慎重に作業してください。`;
  }

  /**
   * 最終マージコンフリクトのタスク説明を構築
   */
  private buildFinalMergeConflictDescription(task: Task): string {
    return `## ⚠️ 最終マージコンフリクト解消タスク

**元のタスク**: ${task.title}
**作業ディレクトリ**: ${this.config.baseRepoPath}

### 状況
レビュー完了後の最終マージ段階でコンフリクトが発生しました。
メインブランチの最新変更との競合を解消してください。

### 実行手順
1. \`git status\` でコンフリクト状況を確認
2. メインブランチの最新変更を分析
3. 自分の変更との競合点を特定
4. 慎重にコンフリクトを解消
5. テスト実行で動作確認
6. 変更をコミット

### 解消方針
- **最優先**: 既存機能を壊さない
- **統合**: 新機能を適切に統合する
- **品質**: コード品質を維持する
- **安全**: 不明な場合は保守的に解消する

### 完了条件
- すべてのコンフリクトが解消されている
- ビルドとテストが通る
- 適切なコミットメッセージで変更がコミットされている

最終マージ段階のため、特に慎重に作業してください。`;
  }
}