# Electron ログ表示改善計画

## 概要

現在のElectron UIでのログ表示において、特に並列実行時にツール実行結果が正しいペインに表示されない問題があります。この文書では、AIのログ出力メカニズムを改善し、各ログメッセージに実行者情報を含めることで、この問題を根本的に解決する方針について説明します。

## 現状の問題点

### 1. ツール実行結果の表示位置の問題
- ツール実行結果（ファイル読み取り、ディレクトリ一覧など）が、実行したAIコンポーネントではなく、デフォルトでMerge Coordinatorペインに表示される
- 現在の実装では、ログメッセージのパターンマッチングに依存しているため、ツール実行結果のような汎用的なメッセージは適切に分類できない

### 2. 並列実行時の競合状態
- 複数のAIが同時にツールを実行する際、`lastToolExecutor`のような状態変数が競合状態（race condition）を引き起こす可能性がある
- 例：ProductOwner AIとEngineer AI #1が同時にツールを実行した場合、結果が誤ったペインに表示される可能性

### 3. エンジニアIDのマッピング問題
- エンジニアAIのIDがタスクIDベース（例：`engineer-abc123-def456`）
- ElectronのターミナルIDは連番ベース（例：`engineer-1`, `engineer-2`）
- 動的なマッピングが必要で、複雑性が増している

## 提案する解決策

### 1. 構造化されたログメッセージ形式

すべてのログメッセージに実行者情報を含む構造化された形式を採用します：

```typescript
interface StructuredLogMessage {
    // 実行者情報
    executor: {
        type: 'ProductOwner' | 'TechLead' | 'Engineer' | 'MergeCoordinator' | 'System';
        id: string;  // エンジニアの場合はタスクID、その他はtype名
    };
    
    // ログ情報
    level: 'info' | 'error' | 'warn' | 'debug' | 'success';
    message: string;
    
    // メタデータ
    timestamp: Date;
    context?: {
        toolName?: string;      // ツール実行の場合
        parentLogId?: string;   // 関連するログのID（ツール結果など）
    };
}
```

### 2. AIコンポーネントの改修

各AIコンポーネント（ProductOwnerAI、TechLeadAI、EngineerAI）に以下の変更を加えます：

#### a. ログ出力メソッドの追加

```typescript
class BaseAI {
    protected log(level: LogLevel, message: string, context?: LogContext) {
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
        electronLogAdapter.logStructured(structuredLog);
    }
    
    protected abstract getComponentType(): ComponentType;
    protected abstract getId(): string;
}
```

#### b. ツール実行時のコンテキスト保持

```typescript
class EngineerAI extends BaseAI {
    async executeTask() {
        // ツール実行時
        const toolExecutionId = generateId();
        this.log('info', `🛠️ ツール実行 - ${toolName}`, {
            toolName,
            toolExecutionId
        });
        
        // ツール結果
        this.log('info', `📄 ファイル内容: ${filePath}`, {
            parentLogId: toolExecutionId
        });
    }
}
```

### 3. ElectronLogAdapterの改修

構造化されたログを処理する新しいメソッドを追加：

```typescript
class ElectronLogAdapter {
    logStructured(structuredLog: StructuredLogMessage) {
        // Electronプロセスに構造化されたログを送信
        if (this.electronProcess && this.isReady) {
            this.electronProcess.send({
                type: 'structured-log',
                data: structuredLog
            });
        }
        
        // コンソールにも出力（後方互換性のため）
        console.log(structuredLog.message);
    }
}
```

### 4. Electron Renderer側の改修

構造化されたログを適切なターミナルにルーティング：

```javascript
// ログのルーティングロジック
function routeStructuredLog(structuredLog) {
    let terminalId;
    
    // 実行者情報に基づいてターミナルIDを決定
    switch (structuredLog.executor.type) {
        case 'ProductOwner':
            terminalId = 'product-owner';
            break;
        case 'TechLead':
            terminalId = 'tech-lead';
            break;
        case 'MergeCoordinator':
            terminalId = 'merge-coordinator';
            break;
        case 'Engineer':
            // エンジニアIDのマッピングを管理
            terminalId = getOrCreateEngineerTerminal(structuredLog.executor.id);
            break;
        case 'System':
            terminalId = 'merge-coordinator';
            break;
    }
    
    // ターミナルに出力
    const terminal = terminals[terminalId];
    if (terminal) {
        terminal.writeln(formatLog(structuredLog));
    }
}
```

## 実装手順

### フェーズ1: 基盤整備
1. `StructuredLogMessage`インターフェースの定義
2. `BaseAI`クラスの作成とログメソッドの実装
3. ElectronLogAdapterに`logStructured`メソッドを追加

### フェーズ2: AIコンポーネントの移行
1. ProductOwnerAIを`BaseAI`を継承するように変更
2. TechLeadAIを移行
3. EngineerAIを移行
4. 各コンポーネントのログ出力を新しい形式に変更

### フェーズ3: Electron側の対応
1. メインプロセスで構造化ログの受信処理を追加
2. レンダラープロセスでルーティングロジックを実装
3. エンジニアターミナルの動的管理を改善

### フェーズ4: 後方互換性とクリーンアップ
1. 従来のconsole.logインターセプトとの共存
2. 移行期間中の両方式のサポート
3. 完全移行後の旧コードの削除

## 期待される効果

1. **正確なログルーティング**: 各ログが確実に正しいターミナルに表示される
2. **並列実行時の安全性**: 競合状態を回避し、並列実行時も正確に動作
3. **拡張性**: 新しいAIコンポーネントやツールの追加が容易
4. **デバッグ性の向上**: 構造化されたログにより、問題の追跡が容易に

## 注意事項

- 移行期間中は両方式が混在するため、パフォーマンスへの影響を監視する必要がある
- すべてのAIコンポーネントの移行が完了するまで、旧方式のサポートを維持する
- ログのフォーマットが変更されるため、既存のログ解析ツールへの影響を考慮する

## まとめ

この改善により、Electron UIでのログ表示が大幅に改善され、特に並列実行時の信頼性が向上します。構造化されたログ形式により、将来的な拡張も容易になり、システム全体の保守性が向上します。