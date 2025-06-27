// シンプルなタスクローダー
const fs = require('fs');
const path = require('path');
const os = require('os');

// タスクタブがクリックされた時に呼ばれる関数
function loadTasks() {
    console.log('[SimpleTasks] Loading tasks...');
    
    const tempDir = os.tmpdir();
    console.log('[SimpleTasks] Temp directory:', tempDir);
    
    const tasksContainer = document.getElementById('tasks-grid');
    const overviewContainer = document.getElementById('overview-content');
    
    console.log('[SimpleTasks] DOM elements found:', {
        tasksContainer: !!tasksContainer,
        overviewContainer: !!overviewContainer
    });
    
    if (!tasksContainer || !overviewContainer) {
        console.error('[SimpleTasks] Required DOM elements not found');
        return;
    }
    
    try {
        // claude-multi-engineer-task-session-* パターンのディレクトリを探す
        const files = fs.readdirSync(tempDir);
        const taskDirs = files
            .filter(f => f.startsWith('claude-multi-engineer-task-session-'))
            .map(f => path.join(tempDir, f))
            .filter(f => {
                try {
                    return fs.statSync(f).isDirectory();
                } catch (e) {
                    return false;
                }
            })
            .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs); // 最新順
        
        console.log('[SimpleTasks] Found directories:', taskDirs.length);
        taskDirs.forEach(dir => console.log('[SimpleTasks] - ' + dir));
        
        if (taskDirs.length === 0) {
            // デバッグ情報を表示
            const debugInfo = `
                <div class="no-tasks">
                    <p>No task directories found</p>
                    <p>Temp directory: ${tempDir}</p>
                    <p>Total files in temp: ${files.length}</p>
                    <p>Pattern: claude-multi-engineer-task-session-*</p>
                </div>
            `;
            tasksContainer.innerHTML = debugInfo;
            console.log('[SimpleTasks] No directories found matching pattern');
            return;
        }
        
        // 最新のディレクトリを使用
        const taskDir = taskDirs[0];
        console.log('[SimpleTasks] Using directory:', taskDir);
        
        // task-overview.mdを読み込む
        const overviewPath = path.join(taskDir, 'task-overview.md');
        if (fs.existsSync(overviewPath)) {
            const overviewContent = fs.readFileSync(overviewPath, 'utf-8');
            overviewContainer.innerHTML = '<pre>' + overviewContent + '</pre>';
            console.log('[SimpleTasks] Loaded overview');
        } else {
            overviewContainer.innerHTML = '<p>No overview found</p>';
        }
        
        // task-*.mdファイルを読み込む
        const files = fs.readdirSync(taskDir);
        const taskFiles = files.filter(f => f.startsWith('task-') && f.endsWith('.md') && f !== 'task-overview.md');
        
        console.log('[SimpleTasks] Found task files:', taskFiles);
        
        if (taskFiles.length === 0) {
            tasksContainer.innerHTML = '<div class="no-tasks">No task files found</div>';
            return;
        }
        
        // タスクカードを生成
        tasksContainer.innerHTML = '';
        taskFiles.forEach(filename => {
            const taskPath = path.join(taskDir, filename);
            const content = fs.readFileSync(taskPath, 'utf-8');
            
            // シンプルなカード作成
            const card = document.createElement('div');
            card.className = 'task-card';
            card.innerHTML = `
                <div class="task-title">${filename}</div>
                <div class="task-description">Click to view details</div>
            `;
            
            // クリックでファイル内容を表示
            card.onclick = () => {
                alert(content);
            };
            
            tasksContainer.appendChild(card);
        });
        
        console.log('[SimpleTasks] Tasks loaded successfully');
        
    } catch (error) {
        console.error('[SimpleTasks] Error:', error);
        console.error('[SimpleTasks] Error stack:', error.stack);
        tasksContainer.innerHTML = '<div class="error-message">Error: ' + error.message + '</div>';
        overviewContainer.innerHTML = '<div class="error-message">Error loading overview</div>';
    }
}

// グローバルに公開
window.loadTasks = loadTasks;