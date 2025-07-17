import blessed from 'blessed';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';

interface LogEntry {
  timestamp: string;
  engineerId: string;
  level: 'info' | 'error' | 'warn' | 'debug' | 'success';
  message: string;
  component?: string;
  group?: string;
  isGroupStart?: boolean;
  isGroupEnd?: boolean;
}

interface EngineerPanel {
  box: blessed.Widgets.BoxElement;
  log: blessed.Widgets.BoxElement;
  title: string;
  lastActivity: Date;
  color: string;
  isCollapsed: boolean;
  currentGroup?: string;
  groupDepth: number;
}

interface LogFilter {
  level?: 'info' | 'error' | 'warn' | 'debug' | 'success';
  engineerId?: string;
  component?: string;
  searchText?: string;
}

export class ImprovedParallelLogViewer {
  private screen: blessed.Widgets.Screen;
  private engineerPanels: Map<string, EngineerPanel> = new Map();
  private mainInfoBox!: blessed.Widgets.BoxElement;
  private statusBar!: blessed.Widgets.BoxElement;
  private filterBar!: blessed.Widgets.BoxElement;
  private logBuffer: Map<string, LogEntry[]> = new Map();
  private isActive = true;
  private isFrozen = false;
  private filter: LogFilter = {};
  private focusedPanel?: string;
  
  // ログレベルごとのアイコンとスタイル
  private readonly logLevelConfig = {
    error: { icon: '❌', color: 'red', bgColor: 'bgRed' },
    warn: { icon: '⚠️ ', color: 'yellow', bgColor: 'bgYellow' },
    info: { icon: 'ℹ️ ', color: 'cyan', bgColor: 'bgCyan' },
    debug: { icon: '🔍', color: 'gray', bgColor: 'bgGray' },
    success: { icon: '✅', color: 'green', bgColor: 'bgGreen' }
  };

  constructor() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Multi-Engineer Parallel Development - Enhanced Log Viewer',
      fullUnicode: true,
      forceUnicode: true,
      dockBorders: true,
      autoPadding: true,
      warnings: true
    });

    this.setupUI();
    this.setupKeyHandlers();
  }

  private setupUI(): void {
    // メイン情報ボックス（上部）
    this.mainInfoBox = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 5,
      content: this.formatMainHeader(),
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'blue',
        bold: true
      }
    });

    // フィルターバー
    this.filterBar = blessed.box({
      parent: this.screen,
      top: 5,
      left: 0,
      width: '100%',
      height: 3,
      content: ' {cyan-fg}Filter:{/cyan-fg} None | {yellow-fg}Press:{/yellow-fg} l=level, e=engineer, s=search, x=clear filter',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'black'
      }
    });

    // ステータスバー（下部）
    this.statusBar = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 4,
      content: this.formatStatusBar(),
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'black'
      }
    });
  }

  private formatMainHeader(): string {
    const now = new Date();
    return `{center}{bold}🚀 Kugutsu 🚀{/bold}{/center}
{center}Enhanced Log Viewer v2.0{/center}
{center}{cyan-fg}Started: ${now.toLocaleString()} | PID: ${process.pid}{/cyan-fg}{/center}`;
  }

  private formatStatusBar(): string {
    const activeCount = this.engineerPanels.size;
    const totalLogs = Array.from(this.logBuffer.values()).reduce((total, logs) => total + logs.length, 0);
    const status = this.isFrozen ? '{red-fg}FROZEN{/red-fg}' : '{green-fg}ACTIVE{/green-fg}';
    
    return `{bold}Status:{/bold} ${status} | {bold}Engineers:{/bold} ${activeCount} | {bold}Logs:{/bold} ${totalLogs} | {bold}Memory:{/bold} ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
{yellow-fg}{bold}Shortcuts:{/bold}{/yellow-fg} q=quit | f=freeze | c=clear | r=refresh | TAB=focus | ↑↓=scroll | g=group toggle
{cyan-fg}{bold}Filters:{/bold}{/cyan-fg} l=level | e=engineer | s=search | x=clear | {magenta-fg}{bold}View:{/bold}{/magenta-fg} t=theme | h=help`;
  }

  private setupKeyHandlers(): void {
    // 終了
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.destroy();
    });

    // フリーズ切り替え
    this.screen.key(['f'], () => {
      this.toggleFreeze();
    });

    // クリア
    this.screen.key(['c'], () => {
      this.clearAllLogs();
    });

    // リフレッシュ
    this.screen.key(['r'], () => {
      this.refreshLayout();
    });

    // パネル間のフォーカス移動
    this.screen.key(['tab'], () => {
      this.focusNextPanel();
    });

    // フィルター関連
    this.screen.key(['l'], () => {
      this.showLevelFilterMenu();
    });

    this.screen.key(['e'], () => {
      this.showEngineerFilterMenu();
    });

    this.screen.key(['s'], () => {
      this.showSearchDialog();
    });

    this.screen.key(['x'], () => {
      this.clearFilter();
    });

    // グループの折りたたみ
    this.screen.key(['g'], () => {
      this.toggleGroupCollapse();
    });

    // ヘルプ
    this.screen.key(['h', '?'], () => {
      this.showHelp();
    });

    // スクロール
    this.screen.key(['up', 'k'], () => {
      this.scrollFocusedPanel(-1);
    });

    this.screen.key(['down', 'j'], () => {
      this.scrollFocusedPanel(1);
    });

    this.screen.key(['pageup'], () => {
      this.scrollFocusedPanel(-10);
    });

    this.screen.key(['pagedown'], () => {
      this.scrollFocusedPanel(10);
    });
  }

  public start(): void {
    this.isActive = true;
    this.screen.render();
  }

  public destroy(): void {
    this.isActive = false;
    try {
      this.screen.destroy();
    } catch (error) {
      console.warn('⚠️ Improved Log Viewer screen破棄エラー:', error);
    }
    // process.exit(0)を削除 - 呼び出し元で適切に終了処理を行う
  }

  public addEngineer(engineerId: string, title: string): void {
    if (this.engineerPanels.has(engineerId)) {
      return;
    }

    const panelCount = this.engineerPanels.size;
    const colors = ['cyan', 'yellow', 'green', 'magenta', 'red', 'blue'];
    const color = colors[panelCount % colors.length];

    // 改善されたレイアウト計算
    const maxColumns = 3;
    const columns = Math.min(maxColumns, Math.max(1, Math.ceil(Math.sqrt(panelCount + 1))));
    const rows = Math.ceil((panelCount + 1) / columns);
    
    const panelWidth = Math.floor(100 / columns);
    const headerFooterHeight = 12; // ヘッダー、フィルター、ステータスバーの高さ
    const panelHeight = Math.floor((100 - headerFooterHeight) / rows);

    const row = Math.floor(panelCount / columns);
    const col = panelCount % columns;

    const box = blessed.box({
      parent: this.screen,
      top: 8 + (row * panelHeight) + '%',
      left: (col * panelWidth) + '%',
      width: panelWidth + '%',
      height: panelHeight + '%',
      label: ` ${title} `,
      border: {
        type: 'line'
      },
      style: {
        border: {
          bold: true
        },
        label: {
          bold: true
        }
      },
      tags: true,
      clickable: true,
      focusable: true
    });

    const log = blessed.box({
      parent: box,
      top: 0,
      left: 0,
      width: '100%-2',
      height: '100%-2',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: '│'
      },
      mouse: true,
      keys: true,
      vi: true,
      focusable: true,
      style: {
        fg: 'white',
        bg: 'black'
      }
    });

    // クリックイベントでフォーカス
    box.on('click', () => {
      this.focusPanel(engineerId);
    });

    const panel: EngineerPanel = {
      box,
      log,
      title,
      lastActivity: new Date(),
      color,
      isCollapsed: false,
      groupDepth: 0
    };

    this.engineerPanels.set(engineerId, panel);
    this.logBuffer.set(engineerId, []);
    
    this.updatePanelTitle(engineerId);
    this.updateStatusBar();
    this.screen.render();
  }

  public log(engineerId: string, level: 'info' | 'error' | 'warn' | 'debug' | 'success', message: string, component?: string, group?: string): void {
    if (!this.isActive || this.isFrozen) return;

    const timestamp = new Date();
    const logEntry: LogEntry = {
      timestamp: timestamp.toLocaleTimeString('ja-JP', { hour12: false }),
      engineerId,
      level,
      message: stripAnsi(message),
      component,
      group
    };

    // バッファに追加
    const buffer = this.logBuffer.get(engineerId) || [];
    buffer.push(logEntry);
    if (buffer.length > 2000) {
      buffer.shift();
    }
    this.logBuffer.set(engineerId, buffer);

    // フィルター適用
    if (!this.shouldShowLog(logEntry)) {
      return;
    }

    // パネルに表示
    const panel = this.engineerPanels.get(engineerId);
    if (panel) {
      panel.lastActivity = new Date();
      
      // グループ処理
      if (group && group !== panel.currentGroup) {
        if (panel.currentGroup) {
          panel.groupDepth--;
        }
        panel.currentGroup = group;
        panel.groupDepth++;
        
        // グループヘッダーを追加
        const groupHeader = this.formatGroupHeader(group, panel.groupDepth);
        this.appendToLogPanel(panel, groupHeader);
      }
      
      const formattedMessage = this.formatLogMessage(logEntry, panel.groupDepth);
      this.appendToLogPanel(panel, formattedMessage);
      
      this.updatePanelTitle(engineerId);
      this.screen.render();
    }
  }

  private formatLogMessage(entry: LogEntry, groupDepth: number): string {
    const config = this.logLevelConfig[entry.level] || this.logLevelConfig.info;
    const indent = '  '.repeat(groupDepth);
    
    // タイムスタンプ
    const time = chalk.gray(`[${entry.timestamp}]`);
    
    // レベルアイコンと色
    let levelStr: string;
    switch (config.color) {
      case 'red':
        levelStr = chalk.red(`${config.icon} ${entry.level.toUpperCase().padEnd(5)}`);
        break;
      case 'yellow':
        levelStr = chalk.yellow(`${config.icon} ${entry.level.toUpperCase().padEnd(5)}`);
        break;
      case 'cyan':
        levelStr = chalk.cyan(`${config.icon} ${entry.level.toUpperCase().padEnd(5)}`);
        break;
      case 'green':
        levelStr = chalk.green(`${config.icon} ${entry.level.toUpperCase().padEnd(5)}`);
        break;
      case 'gray':
        levelStr = chalk.gray(`${config.icon} ${entry.level.toUpperCase().padEnd(5)}`);
        break;
      default:
        levelStr = chalk.white(`${config.icon} ${entry.level.toUpperCase().padEnd(5)}`);
    }
    
    // コンポーネント
    const comp = entry.component ? chalk.blue(`[${entry.component}]`) : '';
    
    // メッセージ（重要度に応じて装飾）
    let msg = entry.message;
    if (entry.level === 'error') {
      msg = chalk.red.bold(msg);
    } else if (entry.level === 'warn') {
      msg = chalk.yellow(msg);
    } else if (entry.level === 'success') {
      msg = chalk.green.bold(msg);
    }
    
    return `${indent}${time} ${levelStr} ${comp} ${msg}`;
  }

  private formatGroupHeader(groupName: string, depth: number): string {
    const indent = '  '.repeat(depth - 1);
    const separator = '─'.repeat(40 - (depth * 2));
    return chalk.cyan.bold(`${indent}┌─ ${groupName} ${separator}`);
  }

  private appendToLogPanel(panel: EngineerPanel, message: string): void {
    const currentContent = panel.log.getContent();
    const newContent = currentContent ? `${currentContent}\n${message}` : message;
    panel.log.setContent(newContent);
    panel.log.setScrollPerc(100);
  }

  private shouldShowLog(entry: LogEntry): boolean {
    if (this.filter.level && entry.level !== this.filter.level) {
      return false;
    }
    
    if (this.filter.engineerId && entry.engineerId !== this.filter.engineerId) {
      return false;
    }
    
    if (this.filter.component && entry.component !== this.filter.component) {
      return false;
    }
    
    if (this.filter.searchText && !entry.message.toLowerCase().includes(this.filter.searchText.toLowerCase())) {
      return false;
    }
    
    return true;
  }

  private updatePanelTitle(engineerId: string): void {
    const panel = this.engineerPanels.get(engineerId);
    if (panel) {
      const timeDiff = Math.floor((Date.now() - panel.lastActivity.getTime()) / 1000);
      const activityIndicator = timeDiff < 2 ? '🟢' : timeDiff < 10 ? '🟡' : '🔴';
      const logCount = this.logBuffer.get(engineerId)?.length || 0;
      
      const title = `{bold}${activityIndicator} ${panel.title}{/bold} (${logCount} logs)`;
      panel.box.setLabel(` ${title} `);
    }
  }

  private updateStatusBar(): void {
    this.statusBar.setContent(this.formatStatusBar());
    this.screen.render();
  }

  private updateFilterBar(): void {
    const filters: string[] = [];
    
    if (this.filter.level) {
      filters.push(`Level: ${this.filter.level}`);
    }
    if (this.filter.engineerId) {
      filters.push(`Engineer: ${this.filter.engineerId}`);
    }
    if (this.filter.component) {
      filters.push(`Component: ${this.filter.component}`);
    }
    if (this.filter.searchText) {
      filters.push(`Search: "${this.filter.searchText}"`);
    }
    
    const filterText = filters.length > 0 ? filters.join(' | ') : 'None';
    this.filterBar.setContent(
      ` {cyan-fg}Active Filters:{/cyan-fg} ${filterText} | {yellow-fg}Press:{/yellow-fg} l=level, e=engineer, s=search, x=clear filter`
    );
    this.screen.render();
  }

  private toggleFreeze(): void {
    this.isFrozen = !this.isFrozen;
    this.updateStatusBar();
  }

  private clearAllLogs(): void {
    for (const [engineerId, panel] of this.engineerPanels) {
      panel.log.setContent('');
      this.logBuffer.set(engineerId, []);
      panel.groupDepth = 0;
      panel.currentGroup = undefined;
      this.updatePanelTitle(engineerId);
    }
    this.screen.render();
  }

  private refreshLayout(): void {
    const panels = Array.from(this.engineerPanels.entries());
    
    // 既存のパネルを削除
    for (const [, panel] of panels) {
      panel.box.destroy();
    }
    
    // パネルを再作成
    this.engineerPanels.clear();
    for (const [engineerId, oldPanel] of panels) {
      this.addEngineer(engineerId, oldPanel.title);
      
      // ログを復元（フィルター適用）
      const logs = this.logBuffer.get(engineerId) || [];
      const panel = this.engineerPanels.get(engineerId);
      if (panel) {
        for (const log of logs) {
          if (this.shouldShowLog(log)) {
            const formattedMessage = this.formatLogMessage(log, 0);
            this.appendToLogPanel(panel, formattedMessage);
          }
        }
      }
    }
    
    this.screen.render();
  }

  private focusPanel(engineerId: string): void {
    const panel = this.engineerPanels.get(engineerId);
    if (panel) {
      // 以前のフォーカスパネルの枠線をリセット
      if (this.focusedPanel) {
        const prevPanel = this.engineerPanels.get(this.focusedPanel);
        if (prevPanel) {
          // スタイルをリセット（blessedの制限により直接設定は困難）
          prevPanel.box.style.border = { type: 'line' };
        }
      }
      
      // 新しいパネルにフォーカス
      this.focusedPanel = engineerId;
      panel.box.style.border = { type: 'line' };
      panel.box.focus();
      this.screen.render();
    }
  }

  private focusNextPanel(): void {
    const engineers = Array.from(this.engineerPanels.keys());
    if (engineers.length === 0) return;
    
    let currentIndex = this.focusedPanel ? engineers.indexOf(this.focusedPanel) : -1;
    const nextIndex = (currentIndex + 1) % engineers.length;
    this.focusPanel(engineers[nextIndex]);
  }

  private scrollFocusedPanel(lines: number): void {
    if (!this.focusedPanel) return;
    
    const panel = this.engineerPanels.get(this.focusedPanel);
    if (panel) {
      // blessedのscrollメソッドを使用してスクロール
      if (lines > 0) {
        for (let i = 0; i < lines; i++) {
          panel.log.scroll(1);
        }
      } else {
        for (let i = 0; i < Math.abs(lines); i++) {
          panel.log.scroll(-1);
        }
      }
      this.screen.render();
    }
  }

  private showLevelFilterMenu(): void {
    const menu = blessed.list({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '30%',
      height: '30%',
      label: ' Filter by Level ',
      border: {
        type: 'line'
      },
      style: {
        selected: {
          bg: 'blue'
        }
      },
      keys: true,
      vi: true,
      mouse: true,
      items: ['All', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'SUCCESS']
    });

    menu.on('select', (item) => {
      const level = item.getText();
      if (level === 'All') {
        delete this.filter.level;
      } else {
        this.filter.level = level.toLowerCase() as any;
      }
      this.updateFilterBar();
      this.refreshLayout();
      menu.destroy();
      this.screen.render();
    });

    menu.focus();
    this.screen.render();
  }

  private showEngineerFilterMenu(): void {
    const engineers = ['All', ...Array.from(this.engineerPanels.keys())];
    
    const menu = blessed.list({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '40%',
      height: '40%',
      label: ' Filter by Engineer ',
      border: {
        type: 'line'
      },
      style: {
        selected: {
          bg: 'blue'
        }
      },
      keys: true,
      vi: true,
      mouse: true,
      items: engineers
    });

    menu.on('select', (item) => {
      const engineer = item.getText();
      if (engineer === 'All') {
        delete this.filter.engineerId;
      } else {
        this.filter.engineerId = engineer;
      }
      this.updateFilterBar();
      this.refreshLayout();
      menu.destroy();
      this.screen.render();
    });

    menu.focus();
    this.screen.render();
  }

  private showSearchDialog(): void {
    const form = blessed.form({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '50%',
      height: '20%',
      label: ' Search Logs ',
      border: {
        type: 'line'
      },
      keys: true
    });

    const input = blessed.textbox({
      parent: form,
      top: 1,
      left: 1,
      width: '100%-4',
      height: 3,
      label: ' Search Text: ',
      border: {
        type: 'line'
      },
      style: {
        focus: {
          border: {
            fg: 'blue'
          }
        }
      },
      inputOnFocus: true
    });

    const submit = blessed.button({
      parent: form,
      bottom: 1,
      left: 'center',
      width: 10,
      height: 3,
      content: 'Search',
      style: {
        focus: {
          bg: 'blue'
        }
      }
    });

    submit.on('press', () => {
      const searchText = input.getValue().trim();
      if (searchText) {
        this.filter.searchText = searchText;
      } else {
        delete this.filter.searchText;
      }
      this.updateFilterBar();
      this.refreshLayout();
      form.destroy();
      this.screen.render();
    });

    input.focus();
    this.screen.render();
  }

  private clearFilter(): void {
    this.filter = {};
    this.updateFilterBar();
    this.refreshLayout();
  }

  private toggleGroupCollapse(): void {
    if (!this.focusedPanel) return;
    
    const panel = this.engineerPanels.get(this.focusedPanel);
    if (panel) {
      panel.isCollapsed = !panel.isCollapsed;
      // TODO: 実装
      this.screen.render();
    }
  }

  private showHelp(): void {
    const helpText = `
{center}{bold}Multi-Engineer Log Viewer - Help{/bold}{/center}

{cyan-fg}{bold}Navigation:{/bold}{/cyan-fg}
  TAB         - Focus next panel
  ↑/↓ or j/k  - Scroll focused panel
  PgUp/PgDn   - Scroll page

{yellow-fg}{bold}Filters:{/bold}{/yellow-fg}
  l - Filter by log level
  e - Filter by engineer
  s - Search in messages
  x - Clear all filters

{green-fg}{bold}Actions:{/bold}{/green-fg}
  f - Freeze/unfreeze updates
  c - Clear all logs
  r - Refresh layout
  g - Toggle group collapse
  q - Quit

{magenta-fg}{bold}Log Levels:{/bold}{/magenta-fg}
  ${this.logLevelConfig.error.icon} ERROR   - Critical errors
  ${this.logLevelConfig.warn.icon} WARN    - Warnings
  ${this.logLevelConfig.info.icon} INFO    - Information
  ${this.logLevelConfig.debug.icon} DEBUG   - Debug details
  ${this.logLevelConfig.success.icon} SUCCESS - Successful operations

Press any key to close this help...
`;

    const helpBox = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '60%',
      height: '70%',
      content: helpText,
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'cyan'
        }
      },
      keys: true,
      scrollable: true,
      alwaysScroll: true,
      mouse: true
    });

    helpBox.key(['escape', 'q', 'enter', 'space'], () => {
      helpBox.destroy();
      this.screen.render();
    });

    helpBox.focus();
    this.screen.render();
  }

  public updateMainInfo(content: string): void {
    const lines = this.formatMainHeader().split('\n');
    lines[3] = `{center}{yellow-fg}${content}{/yellow-fg}{/center}`;
    this.mainInfoBox.setContent(lines.join('\n'));
    this.screen.render();
  }

  public removeEngineer(engineerId: string): void {
    const panel = this.engineerPanels.get(engineerId);
    if (panel) {
      panel.box.destroy();
      this.engineerPanels.delete(engineerId);
      this.logBuffer.delete(engineerId);
      
      if (this.focusedPanel === engineerId) {
        this.focusedPanel = undefined;
      }
      
      this.refreshLayout();
      this.updateStatusBar();
    }
  }

  public getActiveEngineers(): string[] {
    return Array.from(this.engineerPanels.keys());
  }

  public isEngineerActive(engineerId: string): boolean {
    return this.engineerPanels.has(engineerId);
  }
}