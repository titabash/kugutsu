import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import { Task, TaskAnalysisResult, EngineerResult, ReviewResult } from '../types/index.js';

export interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface CompletionStatus {
  totalTasks: number;
  completedTasks: number;
  percentage: number;
  tasks: TaskItem[];
}

export class CompletionReporter extends EventEmitter {
  private filePath: string;
  private tasks: Map<string, TaskItem> = new Map();

  constructor(private tmpDir: string, private projectId: string) {
    super();
    this.filePath = path.join(tmpDir, `${projectId}-tasks.md`);
  }

  async initialize(taskTitles: string[]): Promise<void> {
    this.tasks.clear();
    
    taskTitles.forEach((title, index) => {
      const id = `task-${index + 1}`;
      this.tasks.set(id, {
        id,
        title,
        completed: false
      });
    });

    await this.writeTaskFile();
  }

  async markTaskCompleted(taskId: string): Promise<CompletionStatus> {
    const task = this.tasks.get(taskId);
    if (task && !task.completed) {
      task.completed = true;
      await this.writeTaskFile();
      
      const status = this.getCompletionStatus();
      console.log(`[CompletionReporter] Task completed: ${taskId} (${status.completedTasks}/${status.totalTasks} - ${status.percentage}%)`);
      console.log(`[CompletionReporter] Emitting taskCompleted event`);
      this.emit('taskCompleted', { taskId, status });
      
      if (status.percentage === 100) {
        console.log(`[CompletionReporter] All tasks completed! Emitting allTasksCompleted event`);
        console.log(`[CompletionReporter] Event data:`, { completedTasks: status.completedTasks, totalTasks: status.totalTasks, percentage: status.percentage });
        this.emit('allTasksCompleted', status);
        console.log(`[CompletionReporter] allTasksCompleted event emitted successfully`);
      }
      
      return status;
    }
    
    return this.getCompletionStatus();
  }

  async markTaskCompletedByTitle(title: string): Promise<CompletionStatus> {
    console.log(`[CompletionReporter] Marking task as completed: "${title}"`);
    const task = Array.from(this.tasks.values()).find(t => t.title === title);
    if (task) {
      console.log(`[CompletionReporter] Found task with id: ${task.id}`);
      return this.markTaskCompleted(task.id);
    }
    console.log(`[CompletionReporter] Task not found: "${title}"`);
    console.log(`[CompletionReporter] Available tasks: ${Array.from(this.tasks.values()).map(t => t.title).join(', ')}`);
    return this.getCompletionStatus();
  }

  getCompletionStatus(): CompletionStatus {
    const tasks = Array.from(this.tasks.values());
    const completedTasks = tasks.filter(t => t.completed).length;
    const totalTasks = tasks.length;
    const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      totalTasks,
      completedTasks,
      percentage,
      tasks
    };
  }

  private async writeTaskFile(): Promise<void> {
    const content = this.generateMarkdown();
    await fs.writeFile(this.filePath, content, 'utf-8');
  }

  private generateMarkdown(): string {
    const status = this.getCompletionStatus();
    const lines: string[] = [
      `# Task Completion Report`,
      ``,
      `**Project ID**: ${this.projectId}`,
      `**Progress**: ${status.completedTasks}/${status.totalTasks} (${status.percentage}%)`,
      ``,
      `## Tasks`,
      ``
    ];

    for (const task of this.tasks.values()) {
      const checkbox = task.completed ? '[x]' : '[ ]';
      lines.push(`- ${checkbox} ${task.title}`);
    }

    lines.push('');
    lines.push(`---`);
    lines.push(`Last updated: ${new Date().toISOString()}`);

    return lines.join('\n');
  }

  async getTaskFilePath(): Promise<string> {
    return this.filePath;
  }
  
  /**
   * 完了レポートを表示・生成
   */
  displayCompletionSummary(
    analysis: TaskAnalysisResult,
    completedTasks: string[],
    failedTasks: string[],
    taskResults: Map<string, EngineerResult>,
    reviewResults: Map<string, ReviewResult[]>,
    userRequest: string
  ): void {
    console.log('\n=== 並列開発完了レポート ===\n');
    console.log(`📋 ユーザー要求: ${userRequest}`);
    console.log(`📊 全体概要: ${analysis.summary}`);
    console.log(`⏱️  見積もり時間: ${analysis.estimatedTime}`);
    console.log(`📈 タスク完了率: ${completedTasks.length}/${analysis.tasks.length} (${Math.round((completedTasks.length / analysis.tasks.length) * 100)}%)\n`);

    // 成功タスク詳細
    if (completedTasks.length > 0) {
      console.log('✅ 完了タスク:');
      completedTasks.forEach(taskId => {
        const task = analysis.tasks.find(t => t.id === taskId);
        const result = taskResults.get(taskId);
        const reviews = reviewResults.get(taskId) || [];
        
        if (task && result) {
          console.log(`\n  📌 ${task.title}`);
          console.log(`     - 実装時間: ${result.duration}ms`);
          console.log(`     - 変更ファイル数: ${result.filesChanged.length}`);
          console.log(`     - レビュー回数: ${reviews.length}`);
          
          if (result.filesChanged.length > 0) {
            console.log(`     - 変更ファイル:`);
            result.filesChanged.forEach(file => {
              console.log(`       • ${file}`);
            });
          }
        }
      });
    }

    // 失敗タスク詳細
    if (failedTasks.length > 0) {
      console.log('\n❌ 失敗タスク:');
      failedTasks.forEach(taskId => {
        const task = analysis.tasks.find(t => t.id === taskId);
        if (task) {
          console.log(`  - ${task.title}`);
        }
      });
    }

    console.log('\n=== レポート終了 ===\n');
  }
}