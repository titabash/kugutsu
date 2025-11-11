import chalk from 'chalk';
import stripAnsi from 'strip-ansi';
export class LogFormatter {
    static EMOJI_MAP = {
        info: '🔵',
        error: '🔴',
        warn: '🟡',
        debug: '⚪',
        success: '🟢'
    };
    static COLOR_MAP = {
        info: chalk.blue,
        error: chalk.red,
        warn: chalk.yellow,
        debug: chalk.gray,
        success: chalk.green
    };
    static formatMessage(engineerId, level, message, component) {
        const timestamp = new Date().toLocaleTimeString();
        const cleanMessage = stripAnsi(message);
        // メッセージの種類を自動判定
        const detectedLevel = this.detectMessageLevel(cleanMessage);
        const finalLevel = detectedLevel || level;
        // コンポーネントの自動検出
        const detectedComponent = component || this.detectComponent(cleanMessage);
        const formattedMessage = this.applyFormatting(cleanMessage, finalLevel, detectedComponent);
        return {
            timestamp,
            level: finalLevel,
            engineerId,
            component: detectedComponent,
            message: cleanMessage,
            raw: formattedMessage
        };
    }
    static detectMessageLevel(message) {
        const lowerMessage = message.toLowerCase();
        if (lowerMessage.includes('error') || lowerMessage.includes('failed') || lowerMessage.includes('❌')) {
            return 'error';
        }
        if (lowerMessage.includes('warn') || lowerMessage.includes('warning') || lowerMessage.includes('⚠️')) {
            return 'warn';
        }
        if (lowerMessage.includes('success') || lowerMessage.includes('completed') || lowerMessage.includes('✅')) {
            return 'success';
        }
        if (lowerMessage.includes('debug') || lowerMessage.includes('trace')) {
            return 'debug';
        }
        return null;
    }
    static detectComponent(message) {
        // 一般的なコンポーネント名を検出
        const componentPatterns = [
            /\[([\w-]+)\]/, // [component-name]
            /🚀\s*(\w+)/, // 🚀 ComponentName
            /📊\s*(\w+)/, // 📊 ComponentName
            /⚡\s*(\w+)/, // ⚡ ComponentName
            /(Engineer|ProductOwner|TechLead|Review|Git|Merge)\w*/i
        ];
        for (const pattern of componentPatterns) {
            const match = message.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return undefined;
    }
    static applyFormatting(message, level, component) {
        const emoji = this.EMOJI_MAP[level];
        const colorFn = this.COLOR_MAP[level];
        let formattedMessage = colorFn(message);
        if (component) {
            formattedMessage = `${chalk.blue(`[${component}]`)} ${formattedMessage}`;
        }
        return `${emoji} ${formattedMessage}`;
    }
    static formatForConsole(entry) {
        return `${chalk.gray(entry.timestamp)} [${chalk.cyan(entry.engineerId)}] ${entry.raw}`;
    }
    static formatForFile(entry) {
        const componentStr = entry.component ? `[${entry.component}] ` : '';
        return `${entry.timestamp} [${entry.level.toUpperCase()}] [${entry.engineerId}] ${componentStr}${entry.message}`;
    }
    static extractToolCalls(message) {
        // Claude Code SDKのツール呼び出しを抽出
        const toolPatterns = [
            /🔧\s*(\w+):\s*(.+)/, // 🔧 Tool: action
            /Using\s+(\w+)\s+tool/i, // Using ToolName tool
            /Executing\s+(\w+)/i, // Executing command
            /Running\s+(\w+)/i // Running command
        ];
        for (const pattern of toolPatterns) {
            const match = message.match(pattern);
            if (match) {
                return {
                    tool: match[1],
                    action: match[2] || 'executing'
                };
            }
        }
        return null;
    }
    static highlightImportantKeywords(message) {
        const keywords = {
            success: ['completed', 'success', 'done', 'finished'],
            error: ['error', 'failed', 'exception', 'crash'],
            warn: ['warning', 'deprecated', 'caution'],
            info: ['starting', 'processing', 'analyzing', 'reviewing']
        };
        let highlighted = message;
        for (const [level, words] of Object.entries(keywords)) {
            const colorFn = this.COLOR_MAP[level];
            for (const word of words) {
                const regex = new RegExp(`\\b${word}\\b`, 'gi');
                highlighted = highlighted.replace(regex, (match) => colorFn(match));
            }
        }
        return highlighted;
    }
    static formatProgressBar(current, total, width = 20) {
        const percentage = Math.floor((current / total) * 100);
        const filled = Math.floor((current / total) * width);
        const empty = width - filled;
        const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
        return `${bar} ${percentage}% (${current}/${total})`;
    }
    static formatDuration(milliseconds) {
        if (milliseconds < 1000) {
            return `${milliseconds}ms`;
        }
        else if (milliseconds < 60000) {
            return `${(milliseconds / 1000).toFixed(1)}s`;
        }
        else {
            const minutes = Math.floor(milliseconds / 60000);
            const seconds = Math.floor((milliseconds % 60000) / 1000);
            return `${minutes}m ${seconds}s`;
        }
    }
    static createSeparator(title, width = 50) {
        if (title) {
            const padding = Math.max(0, width - title.length - 4);
            const leftPad = Math.floor(padding / 2);
            const rightPad = padding - leftPad;
            return chalk.cyan('─'.repeat(leftPad) + `  ${title}  ` + '─'.repeat(rightPad));
        }
        return chalk.cyan('─'.repeat(width));
    }
}
//# sourceMappingURL=LogFormatter.js.map