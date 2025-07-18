export type ComponentType = 'ProductOwner' | 'TechLead' | 'Engineer' | 'MergeCoordinator' | 'System' | 'TechStackAnalyzer' | 'RequirementsAnalyzer' | 'TaskGenerator';
export type LogLevel = 'info' | 'error' | 'warn' | 'debug' | 'success';

export interface LogContext {
    toolName?: string;
    toolExecutionId?: string;
    parentLogId?: string;
    [key: string]: any;
}

export interface StructuredLogMessage {
    // 実行者情報
    executor: {
        type: ComponentType;
        id: string;  // エンジニアの場合はタスクID、その他はtype名
    };
    
    // ログ情報
    level: LogLevel;
    message: string;
    
    // メタデータ
    timestamp: Date;
    context?: LogContext;
}

export interface ILogger {
    log(level: LogLevel, message: string, context?: LogContext): void;
    info(message: string, context?: LogContext): void;
    error(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    debug(message: string, context?: LogContext): void;
    success(message: string, context?: LogContext): void;
}