import { ElectronLogAdapter } from '../utils/ElectronLogAdapter.js';
import { v4 as uuidv4 } from 'uuid';
export class BaseAI {
    electronLogAdapter;
    constructor() {
        this.electronLogAdapter = ElectronLogAdapter.getInstance();
    }
    generateToolExecutionId() {
        return uuidv4();
    }
    log(level, message, context) {
        const structuredLog = {
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
    info(message, context) {
        this.log('info', message, context);
    }
    error(message, context) {
        this.log('error', message, context);
    }
    warn(message, context) {
        this.log('warn', message, context);
    }
    debug(message, context) {
        this.log('debug', message, context);
    }
    success(message, context) {
        this.log('success', message, context);
    }
    // ツール実行のヘルパーメソッド
    logToolExecution(toolName, description) {
        const toolExecutionId = this.generateToolExecutionId();
        this.info(`🛠️ ツール実行 - ${toolName}: ${description}`, {
            toolName,
            toolExecutionId
        });
        return toolExecutionId;
    }
    logToolResult(result, toolExecutionId, toolName) {
        this.info(result, {
            parentLogId: toolExecutionId,
            toolName
        });
    }
}
//# sourceMappingURL=BaseAI.js.map