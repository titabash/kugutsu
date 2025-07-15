// ES Module対応のタスク管理モジュール
// Electronのnodeintegrationが有効なので、requireを使用
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// グローバル状態
let currentTasks = [];
let currentOverview = '';

// タスクデータの読み込み
async function loadTaskData() {
    console.log('[Tasks] Loading task data...');
    
    // ローディング表示
    const overviewContent = document.getElementById('overview-content');
    const tasksGrid = document.getElementById('tasks-grid');
    
    if (overviewContent) {
        overviewContent.innerHTML = '<p>Loading project overview...</p>';
    }
    if (tasksGrid) {
        tasksGrid.innerHTML = '<div class="loading">Loading tasks...</div>';
    }
    
    try {
        // 一時ディレクトリから最新のタスクディレクトリを探す
        const tempDir = tmpdir();
        console.log('[Tasks] Checking temp directory:', tempDir);
        
        // claude-multi-engineer-* パターンのディレクトリを探す
        const files = readdirSync(tempDir);
        console.log('[Tasks] All files in temp dir:', files.length);
        
        const taskDirs = files
            .filter(f => {
                const matches = f.startsWith('claude-multi-engineer-');
                if (matches) console.log('[Tasks] Found matching dir:', f);
                return matches;
            })
            .map(f => join(tempDir, f))
            .filter(f => {
                try {
                    return statSync(f).isDirectory();
                } catch (e) {
                    console.error('[Tasks] Error checking directory:', f, e.message);
                    return false;
                }
            })
            .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs); // 最新順
        
        console.log('[Tasks] Found task directories:', taskDirs);
        
        if (taskDirs.length === 0) {
            // claude-multi-engineer-task-session-* パターンも試す
            console.log('[Tasks] No directories found with pattern "claude-multi-engineer-*", trying "claude-multi-engineer-task-session-*"');
            
            const taskSessionDirs = files
                .filter(f => {
                    const matches = f.startsWith('claude-multi-engineer-task-session-');
                    if (matches) console.log('[Tasks] Found task session dir:', f);
                    return matches;
                })
                .map(f => join(tempDir, f))
                .filter(f => {
                    try {
                        return statSync(f).isDirectory();
                    } catch (e) {
                        console.error('[Tasks] Error checking directory:', f, e.message);
                        return false;
                    }
                })
                .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
            
            if (taskSessionDirs.length > 0) {
                taskDirs.push(...taskSessionDirs);
                console.log('[Tasks] Found task session directories:', taskSessionDirs);
            }
        }
        
        if (taskDirs.length === 0) {
            showTaskError('No task directories found. Please wait for task analysis to complete.');
            return;
        }
        
        // 最新のディレクトリを使用
        const latestDir = taskDirs[0];
        console.log('[Tasks] Using latest directory:', latestDir);
        
        // ディレクトリ内のファイルをリスト
        try {
            const dirContents = readdirSync(latestDir);
            console.log('[Tasks] Directory contents:', dirContents);
        } catch (e) {
            console.error('[Tasks] Error reading directory contents:', e.message);
        }
        
        // task-overview.mdを読み込む
        const overviewPath = join(latestDir, 'task-overview.md');
        if (existsSync(overviewPath)) {
            currentOverview = readFileSync(overviewPath, 'utf-8');
            console.log('[Tasks] Loaded overview, length:', currentOverview.length);
        } else {
            console.log('[Tasks] No overview file found at:', overviewPath);
            currentOverview = '';
        }
        
        // task-*.mdファイルを探してタスク情報を構築
        const taskFiles = readdirSync(latestDir)
            .filter(f => f.startsWith('task-') && f.endsWith('.md') && f !== 'task-overview.md');
        
        console.log('[Tasks] Found task files:', taskFiles);
        
        currentTasks = taskFiles.map(filename => {
            // ファイル名からタスク情報を抽出
            const match = filename.match(/task-([a-f0-9]+)-(.+)\.md/);
            if (!match) return null;
            
            const [, idPart, titleSlug] = match;
            const fullPath = join(latestDir, filename);
            const content = readFileSync(fullPath, 'utf-8');
            
            // タスク内容から情報を抽出
            const titleMatch = content.match(/# タスク詳細: (.+)/);
            const typeMatch = content.match(/- \*\*タイプ\*\*: (.+)/);
            const priorityMatch = content.match(/- \*\*優先度\*\*: (.+)/);
            const statusMatch = content.match(/- \*\*ステータス\*\*: (.+)/);
            const dependenciesMatch = content.match(/## 依存関係\n([\s\S]*?)\n\n/);
            
            // 依存関係の解析
            let dependencies = [];
            if (dependenciesMatch && dependenciesMatch[1].trim() !== '依存関係なし') {
                dependencies = dependenciesMatch[1]
                    .split('\n')
                    .filter(line => line.startsWith('- '))
                    .map(line => line.substring(2).trim());
            }
            
            return {
                id: idPart,
                title: titleMatch ? titleMatch[1] : titleSlug.replace(/-/g, ' '),
                type: typeMatch ? typeMatch[1] : 'feature',
                priority: priorityMatch ? priorityMatch[1] : 'medium',
                status: statusMatch ? statusMatch[1] : 'pending',
                description: extractDescription(content),
                dependencies,
                instructionFile: fullPath
            };
        }).filter(t => t !== null);
        
        console.log('[Tasks] Parsed tasks:', currentTasks);
        
        // UIを更新
        updateOverview();
        renderTasks();
        
    } catch (error) {
        console.error('[Tasks] Error loading task data:', error);
        console.error('[Tasks] Error stack:', error.stack);
        showTaskError('Failed to load task data: ' + error.message);
    }
}

// タスクの説明を抽出
function extractDescription(content) {
    const descMatch = content.match(/## 詳細な実装指示\n\n([\s\S]*?)(?=\n##|\n\n##|$)/);
    if (descMatch) {
        // 最初の段落を抽出
        const firstParagraph = descMatch[1].split('\n\n')[0];
        return firstParagraph.length > 150 
            ? firstParagraph.substring(0, 150) + '...' 
            : firstParagraph;
    }
    return 'タスクの詳細は指示ファイルを参照してください。';
}

// オーバービューの更新
function updateOverview() {
    const overviewContent = document.getElementById('overview-content');
    if (!overviewContent) return;
    
    if (currentOverview) {
        // Markdownを簡易的にHTMLに変換（改善版）
        let html = currentOverview
            // コードブロック
            .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
            // 見出し
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            // リスト
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
            // 強調
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            // リンク
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
            // 段落
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        
        // 連続するulタグをマージ
        html = html.replace(/<\/ul>\s*<ul>/g, '');
        
        overviewContent.innerHTML = `<div class="markdown-content"><p>${html}</p></div>`;
    } else {
        overviewContent.innerHTML = '<p>No project overview available.</p>';
    }
}

// タスクの描画
function renderTasks() {
    const tasksGrid = document.getElementById('tasks-grid');
    if (!tasksGrid) return;
    
    // フィルター条件を取得
    const statusFilter = document.getElementById('task-filter-status')?.value || 'all';
    const typeFilter = document.getElementById('task-filter-type')?.value || 'all';
    
    // タスクをフィルタリング
    const filteredTasks = currentTasks.filter(task => {
        if (statusFilter !== 'all' && task.status !== statusFilter) return false;
        if (typeFilter !== 'all' && task.type !== typeFilter) return false;
        return true;
    });
    
    // グリッドをクリア
    tasksGrid.innerHTML = '';
    
    // タスクカードを生成
    filteredTasks.forEach(task => {
        const card = createTaskCard(task);
        tasksGrid.appendChild(card);
    });
    
    if (filteredTasks.length === 0) {
        tasksGrid.innerHTML = '<div class="no-tasks">No tasks found</div>';
    }
}

// タスクカードの作成
function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.dataset.taskId = task.id;
    
    // ステータスアイコン
    const statusIcon = getStatusIcon(task.status);
    const statusClass = `status-${task.status}`;
    
    // 優先度クラス
    const priorityClass = `badge-${task.priority}`;
    
    // タイプクラス
    const typeClass = `badge-${task.type}`;
    
    // 依存関係の表示
    const dependenciesText = task.dependencies && task.dependencies.length > 0
        ? `${task.dependencies.length} dependencies`
        : 'No dependencies';
    
    card.innerHTML = `
        <div class="task-card-header">
            <div class="task-title">${task.title}</div>
            <div class="task-badges">
                <span class="task-badge ${typeClass}">${task.type}</span>
                <span class="task-badge ${priorityClass}">${task.priority}</span>
            </div>
        </div>
        <div class="task-description">${task.description}</div>
        <div class="task-meta">
            <div class="task-status">
                <span class="status-icon ${statusClass}"></span>
                <span>${task.status}</span>
            </div>
            <div class="task-dependencies">
                📦 ${dependenciesText}
            </div>
        </div>
    `;
    
    // クリックイベント
    card.addEventListener('click', () => {
        showTaskDetail(task);
    });
    
    return card;
}

// ステータスアイコンの取得
function getStatusIcon(status) {
    const icons = {
        pending: '⏳',
        in_progress: '🔄',
        completed: '✅',
        failed: '❌'
    };
    return icons[status] || '❓';
}

// タスク詳細の表示
async function showTaskDetail(task) {
    const modal = document.getElementById('task-detail-modal');
    if (!modal) return;
    
    // 基本情報を設定
    document.getElementById('task-detail-title').textContent = task.title;
    document.getElementById('task-detail-id').textContent = task.id;
    document.getElementById('task-detail-type').textContent = task.type;
    document.getElementById('task-detail-status').textContent = task.status;
    document.getElementById('task-detail-priority').textContent = task.priority;
    document.getElementById('task-detail-engineer').textContent = task.assignedTo || 'Unassigned';
    document.getElementById('task-detail-dependencies').textContent = 
        task.dependencies && task.dependencies.length > 0 
            ? task.dependencies.join(', ') 
            : 'None';
    
    // タスク指示ファイルの内容を取得
    const instructionContent = document.getElementById('task-instruction-content');
    if (instructionContent) {
        instructionContent.innerHTML = '<pre>Loading task instructions...</pre>';
        
        try {
            // タスクオブジェクトに保存されたファイルパスから読み込む
            if (task.instructionFile && existsSync(task.instructionFile)) {
                const content = readFileSync(task.instructionFile, 'utf-8');
                // Markdownをより見やすくフォーマット
                instructionContent.innerHTML = formatMarkdown(content);
            } else {
                instructionContent.innerHTML = '<pre>No instruction file found for this task.</pre>';
            }
        } catch (error) {
            console.error('[Tasks] Error loading task instruction:', error);
            instructionContent.innerHTML = '<pre>Error loading task instructions.</pre>';
        }
    }
    
    // モーダルを表示
    modal.classList.add('show');
}

// Markdownのフォーマット
function formatMarkdown(content) {
    // コードブロックを保護
    const codeBlocks = [];
    let html = content.replace(/```[\s\S]*?```/g, (match) => {
        codeBlocks.push(match);
        return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });
    
    // 基本的なMarkdown変換
    html = html
        // 見出し
        .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // チェックリスト
        .replace(/^- \[ \] (.+)$/gm, '<li class="checkbox"><input type="checkbox" disabled> $1</li>')
        .replace(/^- \[x\] (.+)$/gm, '<li class="checkbox"><input type="checkbox" checked disabled> $1</li>')
        // 通常のリスト
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        // 強調
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // インラインコード
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // 段落
        .split('\n\n').join('</p><p>');
    
    // リストをulタグで囲む
    html = html.replace(/(<li[\s\S]*?<\/li>)/g, (match) => {
        if (match.includes('class="checkbox"')) {
            return '<ul class="checklist">' + match + '</ul>';
        }
        return '<ul>' + match + '</ul>';
    });
    
    // 連続するulタグをマージ
    html = html.replace(/<\/ul>\s*<ul>/g, '');
    html = html.replace(/<\/ul>\s*<ul class="checklist">/g, '</ul><ul class="checklist">');
    
    // コードブロックを復元
    codeBlocks.forEach((block, index) => {
        const formatted = block
            .replace(/```(\w+)?\n/, '<pre><code class="language-$1">')
            .replace(/```$/, '</code></pre>');
        html = html.replace(`__CODE_BLOCK_${index}__`, formatted);
    });
    
    return `<div class="markdown-formatted"><p>${html}</p></div>`;
}

// タスク詳細を非表示
function hideTaskDetail() {
    const modal = document.getElementById('task-detail-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// エラー表示
function showTaskError(message) {
    const tasksGrid = document.getElementById('tasks-grid');
    if (tasksGrid) {
        tasksGrid.innerHTML = `<div class="error-message">⚠️ ${message}</div>`;
    }
}

// タスクビューの初期化
function initTasksView() {
    console.log('[Tasks] Initializing tasks view...');
    
    // リフレッシュボタン
    const refreshBtn = document.getElementById('refresh-tasks');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadTaskData();
        });
    }
    
    // フィルターのイベントリスナー
    const statusFilter = document.getElementById('task-filter-status');
    const typeFilter = document.getElementById('task-filter-type');
    
    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            renderTasks();
        });
    }
    
    if (typeFilter) {
        typeFilter.addEventListener('change', () => {
            renderTasks();
        });
    }
    
    // タスク詳細モーダルの閉じるボタン
    const closeBtn = document.getElementById('close-task-detail');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            hideTaskDetail();
        });
    }
    
    // モーダルの外側クリックで閉じる
    const modal = document.getElementById('task-detail-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideTaskDetail();
            }
        });
    }
}

// タブ切り替え時の処理
function onTasksTabActivated() {
    console.log('[Tasks] Tasks tab activated, loading data...');
    loadTaskData();
}

// ESM形式でエクスポート
export {
    loadTaskData,
    showTaskDetail,
    hideTaskDetail,
    initTasksView,
    onTasksTabActivated
};