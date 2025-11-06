import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
export class CompletionReporter extends EventEmitter {
    kugutsuDir;
    projectId;
    filePath;
    tasks = new Map();
    constructor(kugutsuDir, projectId) {
        super();
        this.kugutsuDir = kugutsuDir;
        this.projectId = projectId;
        this.filePath = path.join(kugutsuDir, 'projects', projectId, `${projectId}-tasks.md`);
    }
    async initialize(taskTitles) {
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
    async markTaskCompleted(taskId) {
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
    async markTaskCompletedByTitle(title) {
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
    getCompletionStatus() {
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
    async writeTaskFile() {
        const content = this.generateMarkdown();
        // プロジェクトIDディレクトリが存在しない場合は作成
        const dir = path.dirname(this.filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(this.filePath, content, 'utf-8');
    }
    generateMarkdown() {
        const status = this.getCompletionStatus();
        const lines = [
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
    async getTaskFilePath() {
        return this.filePath;
    }
    /**
     * 完了レポートを表示・生成
     */
    displayCompletionSummary(analysis, completedTasks, failedTasks, taskResults, reviewResults, userRequest) {
        console.log('\n=== 並列開発完了レポート ===\n');
        console.log(`📋 ユーザー要求: ${userRequest}`);
        console.log(`📊 全体概要: ${analysis.summary}`);
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
//# sourceMappingURL=CompletionReporter.js.map