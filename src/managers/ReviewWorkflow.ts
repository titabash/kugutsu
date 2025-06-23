import { execSync } from 'child_process';
import { TechLeadAI } from './TechLeadAI';
import { EngineerAI } from './EngineerAI';
import { GitWorktreeManager } from './GitWorktreeManager';
import { Task, EngineerResult, ReviewResult, SystemConfig } from '../types';

/**
 * レビューワークフローの管理
 */
export class ReviewWorkflow {
  private readonly gitManager: GitWorktreeManager;
  private readonly config: SystemConfig;
  private readonly maxRetries: number;

  constructor(gitManager: GitWorktreeManager, config: SystemConfig, maxRetries: number = 3) {
    this.gitManager = gitManager;
    this.config = config;
    this.maxRetries = maxRetries;
  }

  /**
   * タスクのレビューワークフローを実行
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

      // テックリードAIによるレビュー
      const reviewResult = await this.performReview(task, currentResult);
      reviewHistory.push(reviewResult);

      // レビュー結果による分岐
      switch (reviewResult.status) {
        case 'APPROVED':
          console.log(`✅ レビュー承認: ${task.title}`);
          
          // メインブランチにマージ
          const mergeResult = await this.mergeToMainBranch(task);
          
          if (mergeResult === true) {
            // ワークツリーとブランチのクリーンアップ
            await this.cleanupAfterMerge(task);
            
            return {
              approved: true,
              reviewHistory,
              finalResult: currentResult,
              merged: true
            };
          } else if (mergeResult === 'CONFLICT') {
            // コンフリクト解消をエンジニアAIに依頼
            console.log(`🔄 コンフリクト解消依頼: ${task.title}`);
            currentResult = await this.resolveConflictWithEngineer(task, engineerId, existingEngineer);
            
            if (!currentResult.success) {
              console.error(`❌ コンフリクト解消失敗: ${task.title}`);
              return {
                approved: false,
                reviewHistory,
                finalResult: currentResult,
                merged: false
              };
            }
            
            // 解消後は再度レビューに回す
            continue;
          } else {
            console.error(`❌ マージ失敗: ${task.title}`);
            return {
              approved: false,
              reviewHistory,
              finalResult: currentResult,
              merged: false
            };
          }

        case 'COMMENTED':
          console.log(`💬 レビューコメント済み: ${task.title}`);
          // コメントのみの場合は承認扱いとしてマージ
          const mergeResultCommented = await this.mergeToMainBranch(task);
          
          if (mergeResultCommented === true) {
            await this.cleanupAfterMerge(task);
            return {
              approved: true,
              reviewHistory,
              finalResult: currentResult,
              merged: true
            };
          } else if (mergeResultCommented === 'CONFLICT') {
            // コンフリクト解消をエンジニアAIに依頼
            console.log(`🔄 コンフリクト解消依頼 (COMMENTED): ${task.title}`);
            currentResult = await this.resolveConflictWithEngineer(task, engineerId, existingEngineer);
            
            if (!currentResult.success) {
              console.error(`❌ コンフリクト解消失敗: ${task.title}`);
              return {
                approved: false,
                reviewHistory,
                finalResult: currentResult,
                merged: false
              };
            }
            
            // 解消後は再度レビューに回す
            continue;
          } else {
            return {
              approved: false,
              reviewHistory,
              finalResult: currentResult,
              merged: false
            };
          }

        case 'CHANGES_REQUESTED':
          console.log(`🔄 修正要求: ${task.title}`);
          
          if (retryCount < this.maxRetries - 1) {
            // エンジニアAIに差し戻して修正
            console.log(`🔙 エンジニアAIに差し戻し: ${engineerId}`);
            currentResult = await this.requestChanges(task, reviewResult, engineerId, existingEngineer);
            
            if (!currentResult.success) {
              console.error(`❌ 修正作業失敗: ${task.title}`);
              break;
            }
          } else {
            console.warn(`⚠️ 最大リトライ回数到達: ${task.title}`);
          }
          break;

        case 'ERROR':
          console.error(`❌ レビューエラー: ${task.title}`);
          return {
            approved: false,
            reviewHistory,
            finalResult: currentResult,
            merged: false
          };
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
    existingEngineer?: EngineerAI
  ): Promise<EngineerResult> {
    console.log(`🔄 修正作業開始: ${engineerId}`);

    // 既存のエンジニアインスタンスを使用、なければ新規作成
    const engineer = existingEngineer || new EngineerAI(engineerId, {
      maxTurns: this.config.maxTurnsPerTask
    });

    console.log(`🔄 エンジニアAI[${engineerId}]に修正依頼 (セッションID: ${engineer.getSessionId() || 'なし'})`);

    // 修正用のタスクを作成
    const revisionTask: Task = {
      ...task,
      title: `[修正] ${task.title}`,
      description: `${task.description}\n\n## レビューフィードバック\n${reviewResult.comments.join('\n')}`
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
   * メインブランチにマージ
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
   * コンフリクト解消用のタスク説明を構築
   */
  private buildConflictResolutionDescription(task: Task): string {
    return `## ⚠️ マージコンフリクト解消タスク

**元のタスク**: ${task.title}
**作業ディレクトリ**: ${task.worktreePath}

### 状況
メインブランチへのマージ時にコンフリクトが発生しました。
このコンフリクトを適切に解消して、正常にマージできる状態にしてください。

### 実行手順
1. \`git status\` でコンフリクト状況を確認
2. コンフリクトファイルを特定
3. 各ファイルのコンフリクト内容を分析
4. 適切な解消方法を選択して手動で編集
5. コンフリクトマーカーを完全に削除
6. テスト実行（可能であれば）
7. 変更をコミット

### 解消方針
- 既存機能を壊さない
- 新機能を適切に統合する
- コード品質を維持する
- 安全性を最優先にする

### 完了条件
- すべてのコンフリクトが解消されている
- コンフリクトマーカーが残っていない
- ビルドとテストが通る（可能であれば）
- 適切なコミットメッセージで変更がコミットされている

コンフリクト解消のベストプラクティスに従って確実に作業してください。`;
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
}