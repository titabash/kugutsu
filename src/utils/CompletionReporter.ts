import * as fs from 'fs';
import * as path from 'path';
import { Task, EngineerResult, ReviewResult, TaskAnalysisResult } from '../types/index.js';

/**
 * 完了レポート生成クラス
 */
export class CompletionReporter {
  private baseRepoPath: string;
  private startTime: Date;
  private endTime?: Date;
  private userRequest: string = '';

  constructor(baseRepoPath: string) {
    this.baseRepoPath = baseRepoPath;
    this.startTime = new Date();
  }

  /**
   * 完了サマリーをコンソールに表示
   */
  displayCompletionSummary(
    analysis: TaskAnalysisResult,
    completedTasks: string[],
    failedTasks: string[],
    taskResults: Map<string, EngineerResult>,
    reviewResults: Map<string, ReviewResult[]>,
    userRequest?: string
  ): void {
    if (userRequest) {
      this.userRequest = userRequest;
    }
    this.endTime = new Date();
    const duration = this.calculateDuration();
    
    console.log('\n');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║     🎉 ALL TASKS COMPLETED SUCCESSFULLY! 🎉    ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('\n📊 Summary:');
    console.log(`├─ Total Tasks: ${analysis.tasks.length}`);
    console.log(`├─ ✅ Completed: ${completedTasks.length}`);
    console.log(`├─ ❌ Failed: ${failedTasks.length}`);
    console.log(`├─ ⏱️  Total Time: ${duration}`);
    console.log(`└─ 📂 Branches Created: ${analysis.tasks.length}`);
    
    if (failedTasks.length > 0) {
      console.log('\n⚠️  Failed Tasks:');
      failedTasks.forEach(taskId => {
        const task = analysis.tasks.find(t => t.id === taskId);
        if (task) {
          console.log(`   - ${task.title}`);
        }
      });
    }
    
    console.log('\n📝 Next Steps:');
    console.log('   • Review the changes in each branch');
    console.log('   • Run tests to ensure everything works');
    console.log('   • Create Pull Requests for each task');
    console.log('   • Merge approved changes to main branch');
    
    const reportPath = this.generateCompletionReport(
      analysis,
      completedTasks,
      failedTasks,
      taskResults,
      reviewResults
    );
    
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }

  /**
   * 完了レポートをファイルに生成
   */
  generateCompletionReport(
    analysis: TaskAnalysisResult,
    completedTasks: string[],
    failedTasks: string[],
    taskResults: Map<string, EngineerResult>,
    reviewResults: Map<string, ReviewResult[]>
  ): string {
    this.endTime = new Date();
    
    // タイムスタンプを生成（例: 2024-01-25_14-30-45）
    const timestamp = new Date().toISOString()
      .replace(/:/g, '-')
      .replace(/\./g, '-')
      .replace('T', '_')
      .substring(0, 19);
    
    // レポートディレクトリを作成
    const reportDir = path.join(this.baseRepoPath, 'kugutsu', `report_${timestamp}`);
    fs.mkdirSync(reportDir, { recursive: true });
    
    // レポート内容を生成
    const reportContent = this.generateReportContent(
      analysis,
      completedTasks,
      failedTasks,
      taskResults,
      reviewResults
    );
    
    // レポートファイルを保存
    const reportPath = path.join(reportDir, 'COMPLETION_REPORT.md');
    fs.writeFileSync(reportPath, reportContent, 'utf8');
    
    // 各タスクの詳細レポートも生成
    this.generateTaskReports(reportDir, analysis, taskResults, reviewResults);
    
    return reportPath;
  }

  /**
   * レポート本文を生成
   */
  private generateReportContent(
    analysis: TaskAnalysisResult,
    completedTasks: string[],
    failedTasks: string[],
    taskResults: Map<string, EngineerResult>,
    reviewResults: Map<string, ReviewResult[]>
  ): string {
    const duration = this.calculateDuration();
    
    let content = `# 🎉 Kugutsu Development Completion Report

## 📊 Overview

- **User Request**: ${this.userRequest || 'N/A'}
- **Start Time**: ${this.startTime.toLocaleString()}
- **End Time**: ${this.endTime?.toLocaleString()}
- **Total Duration**: ${duration}

## 📈 Statistics

| Metric | Value |
|--------|-------|
| Total Tasks | ${analysis.tasks.length} |
| ✅ Completed | ${completedTasks.length} |
| ❌ Failed | ${failedTasks.length} |
| Success Rate | ${((completedTasks.length / analysis.tasks.length) * 100).toFixed(1)}% |

## 📋 Task Summary

### Completed Tasks

`;

    // 完了タスクの詳細
    completedTasks.forEach(taskId => {
      const task = analysis.tasks.find(t => t.id === taskId);
      if (task) {
        const result = taskResults.get(taskId);
        const reviews = reviewResults.get(taskId) || [];
        
        content += `#### ✅ ${task.title}
- **Branch**: \`${task.branchName || 'N/A'}\`
- **Priority**: ${task.priority}
- **Files Changed**: ${result?.filesChanged?.length || 0}
- **Review Rounds**: ${reviews.length}
- **Final Status**: ${result?.success ? 'Success' : 'Failed'}

`;
      }
    });

    // 失敗タスクの詳細
    if (failedTasks.length > 0) {
      content += `\n### Failed Tasks\n\n`;
      
      failedTasks.forEach(taskId => {
        const task = analysis.tasks.find(t => t.id === taskId);
        if (task) {
          const result = taskResults.get(taskId);
          
          content += `#### ❌ ${task.title}
- **Branch**: \`${task.branchName || 'N/A'}\`
- **Priority**: ${task.priority}
- **Error**: ${result?.error || 'Unknown error'}

`;
        }
      });
    }

    // 次のステップ
    content += `## 📝 Next Steps

1. **Review Changes**: Examine the changes in each branch
2. **Run Tests**: Ensure all tests pass for modified code
3. **Create Pull Requests**: Create PRs for each completed task
4. **Code Review**: Have team members review the changes
5. **Merge**: Merge approved changes to the main branch

## 🔗 Useful Commands

\`\`\`bash
# List all created branches
git branch -a | grep feature/task-

# Review changes in a specific branch
git checkout feature/task-<task-id>
git diff main

# Create a pull request (using GitHub CLI)
gh pr create --title "Task: <task-title>" --body "Implementation of task <task-id>"
\`\`\`

---

*Generated by Kugutsu on ${new Date().toLocaleString()}*
`;

    return content;
  }

  /**
   * 各タスクの詳細レポートを生成
   */
  private generateTaskReports(
    reportDir: string,
    analysis: TaskAnalysisResult,
    taskResults: Map<string, EngineerResult>,
    reviewResults: Map<string, ReviewResult[]>
  ): void {
    const tasksDir = path.join(reportDir, 'tasks');
    fs.mkdirSync(tasksDir, { recursive: true });
    
    analysis.tasks.forEach(task => {
      const result = taskResults.get(task.id);
      const reviews = reviewResults.get(task.id) || [];
      
      let taskReport = `# Task Report: ${task.title}

## Task Details

- **ID**: ${task.id}
- **Type**: ${task.type}
- **Priority**: ${task.priority}
- **Branch**: \`${task.branchName || 'N/A'}\`

## Description

${task.description}

## Implementation Result

- **Success**: ${result?.success ? '✅ Yes' : '❌ No'}
- **Error**: ${result?.error || 'None'}

### Files Changed

${result?.filesChanged?.map(file => `- ${file}`).join('\n') || 'No files changed'}

### Output Summary

${result?.output?.join('\n') || 'No output available'}

## Review History

${reviews.map((review, index) => `
### Review Round ${index + 1}

- **Status**: ${review.status}
- **Comments**: ${review.comments.length}
- **Reviewer**: ${review.reviewer}
- **Duration**: ${review.duration}ms

${review.comments.length > 0 ? `#### Comments:\n${review.comments.map(comment => `- ${comment}`).join('\n')}` : ''}
`).join('\n')}

---

*Generated on ${new Date().toLocaleString()}*
`;
      
      const taskReportPath = path.join(tasksDir, `${task.id}.md`);
      fs.writeFileSync(taskReportPath, taskReport, 'utf8');
    });
  }

  /**
   * 実行時間を計算
   */
  private calculateDuration(): string {
    if (!this.endTime) return '0s';
    
    const durationMs = this.endTime.getTime() - this.startTime.getTime();
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}