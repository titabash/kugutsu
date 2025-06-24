# Electron ログ表示改善計画（実装完了）

## 概要

✅ **実装完了**: 並列実行時のログ表示問題は解決済みです。この文書は、実装された構造化ログシステムの設計と実装内容を記録しています。

以前のElectron UIでのログ表示において、特に並列実行時にツール実行結果が正しいペインに表示されない問題がありました。この問題は構造化ログシステムの実装により解決されています。

## 解決済みの問題点

### ✅ 1. ツール実行結果の表示位置の問題（解決済み）
- **解決**: 構造化ログシステムにより、各ログメッセージに実行者情報が含まれるため、正確なペインにルーティングされます
- **実装**: `BaseAI.log()`メソッドで構造化ログを生成
- **効果**: パターンマッチングに依存せず、メタデータベースでの確実な分類

### ✅ 2. 並列実行時の競合状態（解決済み）
- **解決**: 状態変数に依存しない設計により、競合状態を完全に回避
- **実装**: 各ログメッセージが独立して実行者情報を持つ
- **効果**: 複数のAIが同時実行されても正確にログがルーティングされる

### ✅ 3. エンジニアIDのマッピング問題（解決済み）
- **解決**: `ElectronLogAdapter`で動的マッピング管理を実装
- **実装**: タスクIDベースとターミナルIDのマッピングテーブル
- **効果**: 新しいエンジニアが追加されても自動的にターミナルが割り当てられる

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

## 実装済み内容

### ✅ フェーズ1: 基盤整備（完了）
1. `StructuredLogMessage`インターフェースの定義 → `src/types/logging.ts`
2. `BaseAI`クラスの作成とログメソッドの実装 → `src/managers/BaseAI.ts`
3. ElectronLogAdapterに`logStructured`メソッドを追加 → `src/utils/ElectronLogAdapter.ts`

### ✅ フェーズ2: AIコンポーネントの移行（完了）
1. ProductOwnerAIを`BaseAI`を継承するように変更 → 完了
2. TechLeadAIを移行 → 完了
3. EngineerAIを移行 → 完了
4. 各コンポーネントのログ出力を新しい形式に変更 → 完了

### ✅ フェーズ3: Electron側の対応（完了）
1. メインプロセスで構造化ログの受信処理を追加 → 完了
2. レンダラープロセスでルーティングロジックを実装 → 完了
3. エンジニアターミナルの動的管理を改善 → 完了

### ✅ フェーズ4: 後方互換性とクリーンアップ（完了）
1. 従来のconsole.logインターセプトとの共存 → 完了
2. 移行期間中の両方式のサポート → 完了
3. 完全移行後の旧コードの削除 → 完了

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

✅ **実装完了**: この改善により、Electron UIでのログ表示が大幅に改善され、並列実行時の信頼性が向上しました。

### 実装された主要機能
- 構造化ログシステム（`BaseAI`クラス）
- 実行者情報付きログメッセージ
- 動的ターミナルマッピング
- 競合状態のない並列ログ処理

### 現在の状況
- ✅ すべてのAIコンポーネントが`BaseAI`を継承
- ✅ 構造化ログによる正確なペインルーティング
- ✅ 並列実行時のログ表示問題が解決
- ✅ システムの拡張性と保守性が向上

この文書は実装完了記録として保持されます。