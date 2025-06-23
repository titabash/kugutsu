import { ComponentType, LogLevel, LogContext, StructuredLogMessage, ILogger } from '../types/logging';
import { ElectronLogAdapter } from '../utils/ElectronLogAdapter';
import { v4 as uuidv4 } from 'uuid';

export abstract class BaseAI implements ILogger {
    protected electronLogAdapter: ElectronLogAdapter;

    constructor() {
        this.electronLogAdapter = ElectronLogAdapter.getInstance();
    }

    protected abstract getComponentType(): ComponentType;
    protected abstract getId(): string;

    protected generateToolExecutionId(): string {
        return uuidv4();
    }

    log(level: LogLevel, message: string, context?: LogContext): void {
        const structuredLog: StructuredLogMessage = {
            executor: {
                type: this.getComponentType(),
                id: this.getId()
            },
            level,
            message,
            timestamp: new Date(),
            context
        };
        
        // ElectronLogAdapterに送信
        this.electronLogAdapter.logStructured(structuredLog);
    }

    info(message: string, context?: LogContext): void {
        this.log('info', message, context);
    }

    error(message: string, context?: LogContext): void {
        this.log('error', message, context);
    }

    warn(message: string, context?: LogContext): void {
        this.log('warn', message, context);
    }

    debug(message: string, context?: LogContext): void {
        this.log('debug', message, context);
    }

    success(message: string, context?: LogContext): void {
        this.log('success', message, context);
    }

    // ツール実行のヘルパーメソッド
    protected logToolExecution(toolName: string, description: string): string {
        const toolExecutionId = this.generateToolExecutionId();
        this.info(`🛠️ ツール実行 - ${toolName}: ${description}`, {
            toolName,
            toolExecutionId
        });
        return toolExecutionId;
    }

    protected logToolResult(result: string, toolExecutionId: string, toolName?: string): void {
        this.info(result, {
            parentLogId: toolExecutionId,
            toolName
        });
    }
}