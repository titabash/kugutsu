/**
 * 依存関係の可視化クラス
 * タスク間の依存関係をMermaid形式などで出力する
 */
export class DependencyVisualizer {
    /**
     * 依存関係グラフをMermaid形式で生成
     */
    generateMermaidDiagram(tasks) {
        if (tasks.length === 0) {
            return 'graph TD\n  empty[No tasks]';
        }
        let mermaid = 'graph TD\n';
        // タスクをノードとして追加
        tasks.forEach(task => {
            const nodeId = this.sanitizeNodeId(task.id);
            const label = this.escapeLabel(task.title);
            const priority = task.priority;
            const status = task.status;
            // ステータスと優先度に応じてスタイルを設定
            let style = '';
            if (status === 'completed') {
                style = `class ${nodeId} completed`;
            }
            else if (status === 'in_progress') {
                style = `class ${nodeId} inprogress`;
            }
            else if (status === 'failed') {
                style = `class ${nodeId} failed`;
            }
            else if (priority === 'high') {
                style = `class ${nodeId} highpriority`;
            }
            mermaid += `  ${nodeId}["${label}"]\n`;
            if (style) {
                mermaid += `  ${style}\n`;
            }
        });
        // 依存関係をエッジとして追加
        tasks.forEach(task => {
            const nodeId = this.sanitizeNodeId(task.id);
            task.dependencies.forEach(depId => {
                const depNodeId = this.sanitizeNodeId(depId);
                mermaid += `  ${depNodeId} --> ${nodeId}\n`;
            });
        });
        // スタイル定義を追加
        mermaid += '\n';
        mermaid += '  classDef completed fill:#90EE90,stroke:#228B22,stroke-width:2px;\n';
        mermaid += '  classDef inprogress fill:#87CEEB,stroke:#4682B4,stroke-width:2px;\n';
        mermaid += '  classDef failed fill:#FFB6C1,stroke:#DC143C,stroke-width:2px;\n';
        mermaid += '  classDef highpriority fill:#FFD700,stroke:#FF8C00,stroke-width:2px;\n';
        return mermaid;
    }
    /**
     * 実行状況を含むステータスレポートを生成
     */
    generateStatusReport(dependencyManager, tasks) {
        const summary = dependencyManager.getStatusSummary();
        let report = '# 依存関係ステータスレポート\n\n';
        // サマリー
        report += '## 全体サマリー\n';
        report += `- 総タスク数: ${summary.total}\n`;
        report += `- 完了: ${summary.completed} (${this.percentage(summary.completed, summary.total)}%)\n`;
        report += `- 実行中: ${summary.running}\n`;
        report += `- 実行可能: ${summary.ready}\n`;
        report += `- 待機中: ${summary.waiting}\n`;
        report += `- 失敗: ${summary.failed}\n\n`;
        // 進捗バー
        report += '## 進捗状況\n';
        report += this.generateProgressBar(summary.completed, summary.total) + '\n\n';
        // 実行可能なタスク
        const readyTasks = dependencyManager.getReadyTasks();
        if (readyTasks.length > 0) {
            report += '## 実行可能なタスク\n';
            readyTasks.forEach(task => {
                report += `- [${task.priority}] ${task.title}\n`;
            });
            report += '\n';
        }
        // ブロックされているタスク
        report += '## ブロックされているタスク\n';
        tasks.forEach(task => {
            const depStatus = dependencyManager.getTaskDependencyStatus(task.id);
            if (depStatus && (depStatus.blockedBy.length > 0 || depStatus.waitingFor.length > 0)) {
                report += `### ${task.title}\n`;
                if (depStatus.blockedBy.length > 0) {
                    report += `- ブロック要因: ${depStatus.blockedBy.map(id => this.getTaskTitle(tasks, id)).join(', ')}\n`;
                }
                if (depStatus.waitingFor.length > 0) {
                    report += `- 実行待ち: ${depStatus.waitingFor.map(id => this.getTaskTitle(tasks, id)).join(', ')}\n`;
                }
                if (depStatus.failedDependencies.length > 0) {
                    report += `- 失敗した依存: ${depStatus.failedDependencies.map(id => this.getTaskTitle(tasks, id)).join(', ')}\n`;
                }
                report += '\n';
            }
        });
        // 依存関係グラフ
        report += '## 依存関係グラフ (Mermaid)\n';
        report += '```mermaid\n';
        report += this.generateMermaidDiagram(tasks);
        report += '\n```\n';
        return report;
    }
    /**
     * ノードIDをMermaidで使用可能な形式にサニタイズ
     */
    sanitizeNodeId(id) {
        return 'node_' + id.replace(/[^a-zA-Z0-9]/g, '_');
    }
    /**
     * ラベルをエスケープ
     */
    escapeLabel(label) {
        return label.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    }
    /**
     * パーセンテージを計算
     */
    percentage(value, total) {
        if (total === 0)
            return 0;
        return Math.round((value / total) * 100);
    }
    /**
     * 進捗バーを生成
     */
    generateProgressBar(completed, total) {
        if (total === 0)
            return '[--------------------] 0%';
        const percentage = this.percentage(completed, total);
        const filled = Math.round(percentage / 5); // 20段階
        const empty = 20 - filled;
        return `[${'█'.repeat(filled)}${'-'.repeat(empty)}] ${percentage}%`;
    }
    /**
     * タスクIDからタイトルを取得
     */
    getTaskTitle(tasks, taskId) {
        const task = tasks.find(t => t.id === taskId);
        return task ? task.title : taskId;
    }
    /**
     * シンプルなテキスト形式の依存関係ツリーを生成
     */
    generateDependencyTree(tasks) {
        // ルートタスク（依存されていないタスク）を見つける
        const allTaskIds = new Set(tasks.map(t => t.id));
        const dependedTaskIds = new Set(tasks.flatMap(t => t.dependencies));
        const rootTaskIds = Array.from(allTaskIds).filter(id => !dependedTaskIds.has(id));
        let tree = '依存関係ツリー:\n';
        const visited = new Set();
        // 各ルートタスクからツリーを構築
        rootTaskIds.forEach(rootId => {
            const rootTask = tasks.find(t => t.id === rootId);
            if (rootTask) {
                tree += this.buildTreeNode(rootTask, tasks, visited, 0);
            }
        });
        // 循環依存などで到達できなかったタスクも表示
        const unvisited = tasks.filter(t => !visited.has(t.id));
        if (unvisited.length > 0) {
            tree += '\n未接続のタスク:\n';
            unvisited.forEach(task => {
                tree += `  - ${task.title}\n`;
            });
        }
        return tree;
    }
    /**
     * ツリーノードを再帰的に構築
     */
    buildTreeNode(task, allTasks, visited, depth) {
        if (visited.has(task.id)) {
            return `${'  '.repeat(depth)}└─ ${task.title} (循環参照)\n`;
        }
        visited.add(task.id);
        let node = `${'  '.repeat(depth)}${depth > 0 ? '└─ ' : ''}${task.title}`;
        if (task.status === 'completed') {
            node += ' ✓';
        }
        else if (task.status === 'in_progress') {
            node += ' 🔄';
        }
        else if (task.status === 'failed') {
            node += ' ❌';
        }
        node += '\n';
        // このタスクに依存するタスクを見つける
        const dependents = allTasks.filter(t => t.dependencies.includes(task.id));
        dependents.forEach(dependent => {
            node += this.buildTreeNode(dependent, allTasks, visited, depth + 1);
        });
        return node;
    }
}
//# sourceMappingURL=DependencyVisualizer.js.map