import blessed from 'blessed';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';

interface LogEntry {
  timestamp: string;
  engineerId: string;
  level: 'info' | 'error' | 'warn' | 'debug';
  message: string;
  component?: string;
}

interface EngineerPanel {
  box: blessed.Widgets.BoxElement;
  log: blessed.Widgets.BoxElement;
  title: string;
  lastActivity: Date;
}

export class ParallelLogViewer {
  private screen: blessed.Widgets.Screen;
  private engineerPanels: Map<string, EngineerPanel> = new Map();
  private mainInfoBox!: blessed.Widgets.BoxElement;
  private statusBar!: blessed.Widgets.BoxElement;
  private logBuffer: Map<string, LogEntry[]> = new Map();
  private isActive = false;

  constructor() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Kugutsu Log Viewer',
      border: 'line',
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'cyan'
        }
      }
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
      height: 4,
      content: ' {bold}🚀 Multi-Engineer Parallel Development System{/bold}\n Started at: ' + new Date().toLocaleString(),
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'blue',
        border: {
          fg: 'cyan'
        }
      }
    });

    // ステータスバー（下部）
    this.statusBar = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: ' {bold}Status:{/bold} Ready | {bold}Active Engineers:{/bold} 0 | {bold}Commands:{/bold} q=quit, c=clear, f=freeze/unfreeze',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'green'
        }
      }
    });
  }

  private setupKeyHandlers(): void {
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.destroy();
    });

    this.screen.key(['c'], () => {
      this.clearAllLogs();
    });

    this.screen.key(['f'], () => {
      this.toggleFreeze();
    });

    this.screen.key(['r'], () => {
      this.refreshLayout();
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
      console.warn('⚠️ Log Viewer screen破棄エラー:', error);
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

    // パネルのレイアウト計算
    const panelsPerRow = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(panelCount + 1))));
    const panelWidth = Math.floor(100 / panelsPerRow);
    const panelHeight = Math.floor((100 - 25) / Math.ceil((panelCount + 1) / panelsPerRow)); // 25% for header and footer

    const row = Math.floor(panelCount / panelsPerRow);
    const col = panelCount % panelsPerRow;

    const box = blessed.box({
      parent: this.screen,
      top: 4 + (row * panelHeight) + '%',
      left: (col * panelWidth) + '%',
      width: panelWidth + '%',
      height: panelHeight + '%',
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: color
        }
      },
      tags: true
    });

    const log = blessed.box({
      parent: box,
      top: 1,
      left: 1,
      width: '100%-2',
      height: '100%-2',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      content: '',
      style: {
        fg: 'white',
        bg: 'black'
      }
    });

    const panel: EngineerPanel = {
      box,
      log,
      title,
      lastActivity: new Date()
    };

    this.engineerPanels.set(engineerId, panel);
    this.logBuffer.set(engineerId, []);
    
    this.updatePanelTitle(engineerId);
    this.updateStatusBar();
    this.screen.render();
  }

  public removeEngineer(engineerId: string): void {
    const panel = this.engineerPanels.get(engineerId);
    if (panel) {
      panel.box.destroy();
      this.engineerPanels.delete(engineerId);
      this.logBuffer.delete(engineerId);
      this.refreshLayout();
      this.updateStatusBar();
    }
  }

  public log(engineerId: string, level: 'info' | 'error' | 'warn' | 'debug', message: string, component?: string): void {
    if (!this.isActive) return;

    const timestamp = new Date().toLocaleTimeString();
    const logEntry: LogEntry = {
      timestamp,
      engineerId,
      level,
      message: stripAnsi(message),
      component
    };

    // バッファに追加
    const buffer = this.logBuffer.get(engineerId) || [];
    buffer.push(logEntry);
    if (buffer.length > 1000) { // 1000行でローテーション
      buffer.shift();
    }
    this.logBuffer.set(engineerId, buffer);

    // パネルに表示
    const panel = this.engineerPanels.get(engineerId);
    if (panel) {
      panel.lastActivity = new Date();
      const coloredMessage = this.colorizeMessage(level, message, component);
      const formattedMessage = `${chalk.gray(timestamp)} ${coloredMessage}`;
      
      // 既存のコンテンツに新しいログを追加
      const currentContent = panel.log.getContent();
      const newContent = currentContent ? `${currentContent}\n${formattedMessage}` : formattedMessage;
      panel.log.setContent(newContent);
      
      // 最新のログが見えるようにスクロール
      panel.log.setScrollPerc(100);
      
      this.updatePanelTitle(engineerId);
      this.screen.render();
    }
  }

  private colorizeMessage(level: string, message: string, component?: string): string {
    let coloredMessage = message;
    
    switch (level) {
      case 'error':
        coloredMessage = chalk.red(message);
        break;
      case 'warn':
        coloredMessage = chalk.yellow(message);
        break;
      case 'info':
        coloredMessage = chalk.white(message);
        break;
      case 'debug':
        coloredMessage = chalk.gray(message);
        break;
    }

    if (component) {
      coloredMessage = `${chalk.blue(`[${component}]`)} ${coloredMessage}`;
    }

    return coloredMessage;
  }

  private updatePanelTitle(engineerId: string): void {
    const panel = this.engineerPanels.get(engineerId);
    if (panel) {
      const timeDiff = Math.floor((Date.now() - panel.lastActivity.getTime()) / 1000);
      const timeStr = timeDiff > 0 ? ` (${timeDiff}s ago)` : ' (active)';
      const logCount = this.logBuffer.get(engineerId)?.length || 0;
      
      panel.box.setLabel(`{bold}${panel.title}${timeStr}{/bold} [${logCount} logs]`);
    }
  }

  private updateStatusBar(): void {
    const activeCount = this.engineerPanels.size;
    const totalLogs = Array.from(this.logBuffer.values()).reduce((total, logs) => total + logs.length, 0);
    
    this.statusBar.setContent(
      ` {bold}Status:{/bold} Running | {bold}Active Engineers:{/bold} ${activeCount} | {bold}Total Logs:{/bold} ${totalLogs} | {bold}Commands:{/bold} q=quit, c=clear, f=freeze, r=refresh`
    );
    this.screen.render();
  }

  private clearAllLogs(): void {
    for (const [engineerId, panel] of this.engineerPanels) {
      panel.log.setContent('');
      this.logBuffer.set(engineerId, []);
      this.updatePanelTitle(engineerId);
    }
    this.screen.render();
  }

  private toggleFreeze(): void {
    this.isActive = !this.isActive;
    const status = this.isActive ? 'Running' : 'Frozen';
    this.statusBar.setContent(
      this.statusBar.getContent().replace(/Status:\{\/bold\}[^|]+/, `Status:{/bold} ${status}`)
    );
    this.screen.render();
  }

  private refreshLayout(): void {
    // 全パネルを再配置
    const panels = Array.from(this.engineerPanels.entries());
    
    // 既存のパネルを削除
    for (const [, panel] of panels) {
      panel.box.destroy();
    }
    
    // パネルを再作成
    this.engineerPanels.clear();
    for (const [engineerId, panel] of panels) {
      this.addEngineer(engineerId, panel.title);
      
      // ログを復元
      const logs = this.logBuffer.get(engineerId) || [];
      const panelObj = this.engineerPanels.get(engineerId);
      if (panelObj && logs.length > 0) {
        const restoredContent = logs.map(log => {
          const coloredMessage = this.colorizeMessage(log.level, log.message, log.component);
          return `${chalk.gray(log.timestamp)} ${coloredMessage}`;
        }).join('\n');
        panelObj.log.setContent(restoredContent);
        panelObj.log.setScrollPerc(100);
      }
    }
    
    this.screen.render();
  }

  public updateMainInfo(content: string): void {
    this.mainInfoBox.setContent(` {bold}🚀 Multi-Engineer Parallel Development System{/bold}\n ${content}`);
    this.screen.render();
  }

  public getActiveEngineers(): string[] {
    return Array.from(this.engineerPanels.keys());
  }

  public isEngineerActive(engineerId: string): boolean {
    return this.engineerPanels.has(engineerId);
  }
}