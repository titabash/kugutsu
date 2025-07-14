export const designDocTemplate = `# Design Document: [プロジェクト名]

## 1. システム概要

### 1.1 プロジェクトの目的
[このシステムが解決する問題と提供する価値を記述]

### 1.2 主要機能
- [コア機能1]: [機能の説明と目的]
- [コア機能2]: [機能の説明と目的]
- [コア機能3]: [機能の説明と目的]

### 1.3 技術的制約と前提条件
- **既存システムとの連携**: [連携が必要なシステムとその制約]
- **利用可能な技術**: [言語、フレームワーク、ライブラリの制限]
- **パフォーマンス要件**: [レスポンスタイム、同時接続数などの具体的な数値]
- **セキュリティ要件**: [認証方式、データ保護レベルなど]

## 2. アーキテクチャ設計

### 2.1 システム構成図
\`\`\`
[アーキテクチャ図をASCIIアートまたはMermaidで記述]
例:
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Frontend   │────▶│   Backend   │────▶│  Database   │
└─────────────┘     └─────────────┘     └─────────────┘
\`\`\`

### 2.2 ディレクトリ構造
\`\`\`
project-root/
├── src/
│   ├── frontend/     # フロントエンドコード
│   ├── backend/      # バックエンドコード
│   ├── shared/       # 共通コード
│   └── tests/        # テストコード
├── config/           # 設定ファイル
├── locales/          # 多言語化リソース
│   ├── en.json       # 英語（ベース言語）
│   ├── ja.json       # 日本語
│   └── [他の言語]
└── docs/            # ドキュメント
\`\`\`

### 2.3 技術スタックの決定
#### フロントエンド
- **フレームワーク**: [React/Vue/Angular/Flutter等] - [選定理由]
- **状態管理**: [Redux/Vuex/MobX等] - [選定理由]
- **スタイリング**: [CSS-in-JS/Tailwind等] - [選定理由]
- **多言語化**: [React: react-i18next, Flutter: intl package等] - [選定理由と対象言語]

#### バックエンド
- **言語/フレームワーク**: [Node.js/Python/Go等] - [選定理由]
- **API設計**: [REST/GraphQL/gRPC] - [選定理由]
- **認証方式**: [JWT/OAuth2.0等] - [実装方針]

#### データストア
- **メインDB**: [PostgreSQL/MySQL/MongoDB等] - [選定理由]
- **キャッシュ**: [Redis/Memcached等] - [用途と戦略]

## 3. 画面設計とルーティング

### 3.1 サイトマップ
\`\`\`
/                           # ホーム画面
├── /login                  # ログイン画面
├── /register              # ユーザー登録画面
├── /dashboard             # ダッシュボード（要認証）
├── /users                 # ユーザー管理（管理者のみ）
│   ├── /users/:id         # ユーザー詳細
│   └── /users/:id/edit    # ユーザー編集
├── /settings              # 設定画面
│   ├── /settings/profile  # プロフィール設定
│   └── /settings/security # セキュリティ設定
└── /404                   # 404エラーページ
\`\`\`

### 3.2 画面遷移フロー
\`\`\`
[未認証] → /login → [認証成功] → /dashboard
                 ↓
            /register → [登録成功] → /dashboard
\`\`\`

### 3.3 各画面の役割と要素
| 画面パス | 役割 | 主要UI要素 | 必要な権限 |
|---------|------|-----------|-----------|
| /login | ユーザー認証 | メールフォーム、パスワードフォーム、ログインボタン | なし |
| /dashboard | メイン操作画面 | 統計情報、アクション一覧、通知 | 認証済み |
| /users | ユーザー一覧・管理 | ユーザーテーブル、検索、フィルタ | admin |

## 4. データモデル設計

### 4.1 主要エンティティ
\`\`\`
[ERD図またはエンティティ関係の説明]
\`\`\`

### 4.2 データスキーマ
\`\`\`typescript
// User エンティティの例
interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  createdAt: Date;
  updatedAt: Date;
}

// その他の主要エンティティ定義
\`\`\`

## 5. API設計

### 5.1 主要エンドポイント
\`\`\`
# ユーザー管理
GET    /api/users          # ユーザー一覧取得
POST   /api/users          # ユーザー作成
GET    /api/users/:id      # ユーザー詳細取得
PUT    /api/users/:id      # ユーザー更新
DELETE /api/users/:id      # ユーザー削除

# 認証
POST   /api/auth/login     # ログイン
POST   /api/auth/logout    # ログアウト
POST   /api/auth/refresh   # トークン更新
\`\`\`

### 5.2 APIレスポンス形式
\`\`\`typescript
// 成功レスポンス
interface SuccessResponse<T> {
  status: 'success';
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// エラーレスポンス
interface ErrorResponse {
  status: 'error';
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

// 使用例
// GET /api/users のレスポンス
{
  "status": "success",
  "data": [
    { "id": "1", "name": "User 1", "email": "user1@example.com" }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
\`\`\`

### 5.3 データベースマイグレーション規約
\`\`\`sql
-- マイグレーションファイル名: YYYYMMDDHHMMSS_description.sql
-- 例: 20240115120000_create_users_table.sql

-- UP
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- インデックス
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- DOWN
DROP TABLE IF EXISTS users;
\`\`\`

## 6. 共通仕様と規約

### 6.1 命名規則
\`\`\`
# ファイル名
- React コンポーネント: PascalCase.tsx (例: UserProfile.tsx)
- ユーティリティ: camelCase.ts (例: dateFormatter.ts)
- スタイル: camelCase.module.css (例: userProfile.module.css)

# 変数・関数名
- 変数: camelCase (例: userName, isLoading)
- 定数: UPPER_SNAKE_CASE (例: API_BASE_URL)
- 関数: camelCase (例: getUserById)
- React コンポーネント: PascalCase (例: UserCard)

# API エンドポイント
- RESTful 規約に従う: /api/v1/resources/:id
- 複数形を使用: /users (×/user)
\`\`\`

### 6.2 状態管理の規約
\`\`\`typescript
// グローバル状態（全体で共有）
interface GlobalState {
  user: CurrentUser | null;
  theme: 'light' | 'dark';
  notifications: Notification[];
}

// ローカル状態（コンポーネント内）
- フォームの入力値
- UIの開閉状態
- 一時的なローディング状態
\`\`\`

### 6.3 エラーメッセージの統一
\`\`\`typescript
// エラーメッセージの形式
const ErrorMessages = {
  // 認証関連
  AUTH_INVALID_CREDENTIALS: '無効なメールアドレスまたはパスワードです',
  AUTH_SESSION_EXPIRED: 'セッションが期限切れです。再度ログインしてください',
  
  // バリデーション関連
  VALIDATION_REQUIRED: '{field}は必須です',
  VALIDATION_EMAIL: '有効なメールアドレスを入力してください',
  VALIDATION_MIN_LENGTH: '{field}は{min}文字以上で入力してください',
  
  // API関連
  API_NETWORK_ERROR: 'ネットワークエラーが発生しました',
  API_SERVER_ERROR: 'サーバーエラーが発生しました',
};
\`\`\`

### 6.4 共通UIコンポーネント
\`\`\`typescript
// 必ず実装すべき共通コンポーネント
- Button: プライマリ、セカンダリ、デンジャー
- Input: テキスト、パスワード、メール
- Select: 単一選択、複数選択
- Modal: 確認、アラート、カスタム
- Toast: 成功、エラー、警告、情報
- Loading: スピナー、スケルトン
- Table: ソート、フィルタ、ページネーション
- LanguageSwitch: 言語切り替えコンポーネント
\`\`\`

### 6.5 多言語化（i18n/l10n）の実装規約
\`\`\`typescript
// React プロジェクト（react-i18next）
import { useTranslation } from 'react-i18next';

const Component = () => {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('common.title')}</h1>
      <p>{t('user.greeting', { name: 'ユーザー名' })}</p>
    </div>
  );
};

// Flutter プロジェクト（intl package）
import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

class MyWidget extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    
    return Column(
      children: [
        Text(l10n.commonTitle),
        Text(l10n.userGreeting('ユーザー名')),
      ],
    );
  }
}
\`\`\`

#### 多言語化リソース構造
\`\`\`json
// locales/ja.json
{
  "common": {
    "title": "アプリケーション名",
    "save": "保存",
    "cancel": "キャンセル",
    "confirm": "確認",
    "delete": "削除",
    "edit": "編集",
    "loading": "読み込み中...",
    "error": "エラーが発生しました"
  },
  "auth": {
    "login": "ログイン",
    "logout": "ログアウト",
    "signup": "新規登録",
    "email": "メールアドレス",
    "password": "パスワード",
    "forgotPassword": "パスワードを忘れた場合"
  },
  "validation": {
    "required": "{{field}}は必須です",
    "email": "有効なメールアドレスを入力してください",
    "minLength": "{{field}}は{{min}}文字以上で入力してください",
    "maxLength": "{{field}}は{{max}}文字以下で入力してください"
  }
}

// locales/en.json
{
  "common": {
    "title": "Application Name",
    "save": "Save",
    "cancel": "Cancel",
    "confirm": "Confirm",
    "delete": "Delete",
    "edit": "Edit",
    "loading": "Loading...",
    "error": "An error occurred"
  },
  "auth": {
    "login": "Login",
    "logout": "Logout",
    "signup": "Sign Up",
    "email": "Email",
    "password": "Password",
    "forgotPassword": "Forgot Password"
  },
  "validation": {
    "required": "{{field}} is required",
    "email": "Please enter a valid email address",
    "minLength": "{{field}} must be at least {{min}} characters",
    "maxLength": "{{field}} must be at most {{max}} characters"
  }
}
\`\`\`

#### 多言語化実装ガイドライン
- **翻訳キー命名**: 階層構造で管理（例: auth.login, validation.required）
- **動的テキスト**: 変数展開を使用（例: {{name}}, {{count}}）
- **複数形対応**: 言語に応じた複数形ルールを実装
- **日時・数値**: 各言語の表示形式に対応
- **RTL対応**: 右から左へ書く言語への対応準備
- **フォールバック**: 翻訳が見つからない場合のデフォルト言語表示
- **遅延読み込み**: 大きな翻訳ファイルの分割と必要時読み込み

#### 対応言語の選定指針
- **第1優先**: 日本語（ja）、英語（en）
- **第2優先**: 中国語（zh）、韓国語（ko）
- **第3優先**: その他の対象市場の言語

#### 多言語化テスト戦略
- **翻訳漏れ**: 未翻訳キーの検出
- **レイアウト崩れ**: 長い翻訳テキストでのUI確認
- **文字エンコーディング**: 特殊文字・絵文字の正しい表示
- **言語切り替え**: 動的な言語変更の動作確認
\`\`\`

## 7. 実装ガイドライン

### 7.1 セキュリティ実装
- **入力検証**: すべての入力値をサーバーサイドで検証
- **認証・認可**: JWTトークンベースの認証、ロールベースのアクセス制御
- **SQLインジェクション対策**: パラメータ化クエリの使用
- **XSS対策**: 出力エスケープ、CSPヘッダーの設定

### 7.2 パフォーマンス最適化
- **データベースクエリ**: N+1問題の回避、適切なインデックス設計
- **キャッシング戦略**: 頻繁にアクセスされるデータのキャッシュ
- **非同期処理**: 重い処理のバックグラウンド実行

## 8. テスト方針

### 8.1 テストの種類と範囲
- **ユニットテスト**: ビジネスロジック、ユーティリティ関数
- **統合テスト**: API エンドポイント、データベース連携
- **E2Eテスト**: 主要なユーザーフロー
- **多言語化テスト**: 各言語での表示、翻訳漏れ、レイアウト崩れの確認

### 8.2 テストデータとモック
\`\`\`javascript
// テストデータの例
const mockUser = {
  id: 'test-user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user'
};

// モックの使用例
jest.mock('./userService', () => ({
  getUser: jest.fn().mockResolvedValue(mockUser)
}));
\`\`\`

## 9. 統合ポイント

### 9.1 外部サービス連携
- **[サービス名]**: [連携目的、APIキー管理方法、エラー処理]
- **[サービス名]**: [連携目的、認証方式、レート制限対応]

### 9.2 既存システムとの連携
- **データ同期**: [同期タイミング、方式、整合性保証]
- **認証連携**: [SSO実装、セッション管理]

## 10. ログ設計・デバッグ戦略

### 10.1 ログレベルとフォーマット
\`\`\`typescript
// ログレベルの定義
enum LogLevel {
  ERROR = 0,    // システムエラー、例外
  WARN = 1,     // 警告、潜在的な問題
  INFO = 2,     // 重要な情報、業務フロー
  DEBUG = 3     // デバッグ情報、詳細な実行状況
}

// 統一ログフォーマット
interface LogEntry {
  timestamp: string;       // ISO 8601形式
  level: LogLevel;
  component: string;       // どのコンポーネントからのログか
  message: string;
  data?: any;             // 構造化データ
  stack?: string;         // エラー時のスタックトレース
  requestId?: string;     // リクエスト追跡用ID
  userId?: string;        // ユーザー識別子
}
\`\`\`

### 10.2 ログ実装規約
\`\`\`typescript
// ロガーの使用例
const logger = new Logger('UserService');

// 情報ログ
logger.info('ユーザー登録処理開始', { userId: 'user123', email: 'user@example.com' });

// 警告ログ
logger.warn('APIレート制限に近づいています', { 
  currentRate: 95, 
  limit: 100,
  timeWindow: '1分間'
});

// エラーログ（必ずスタックトレース付き）
try {
  await processUser(userData);
} catch (error) {
  logger.error('ユーザー処理でエラーが発生', {
    userId: userData.id,
    operation: 'processUser',
    error: error.message,
    stack: error.stack
  });
  throw error;
}

// デバッグログ
logger.debug('データベースクエリ実行', {
  query: 'SELECT * FROM users WHERE status = ?',
  params: ['active'],
  executionTime: '45ms'
});
\`\`\`

### 10.3 機密情報の保護
\`\`\`typescript
// 機密情報のマスキング規則
const SENSITIVE_FIELDS = ['password', 'token', 'apiKey', 'secret', 'ssn'];

// ログ出力前の自動マスキング
function sanitizeLogData(data: any): any {
  if (typeof data !== 'object' || data === null) return data;
  
  const sanitized = { ...data };
  for (const field of SENSITIVE_FIELDS) {
    if (field in sanitized) {
      sanitized[field] = '***MASKED***';
    }
  }
  return sanitized;
}

// 使用例
logger.info('ユーザー認証成功', sanitizeLogData({
  userId: 'user123',
  email: 'user@example.com',
  password: 'secret123'  // 自動的に***MASKED***になる
}));
\`\`\`

### 10.4 エラーハンドリングとスタックトレース
\`\`\`typescript
// エラーハンドリングの標準パターン
class ApplicationError extends Error {
  constructor(
    public code: string,
    message: string,
    public context?: any
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}

// エラーログ出力の標準実装
function logError(error: Error, context?: any): void {
  const errorInfo = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    context: sanitizeLogData(context),
    timestamp: new Date().toISOString()
  };

  if (error instanceof ApplicationError) {
    logger.error(\`アプリケーションエラー: \${error.code}\`, errorInfo);
  } else {
    logger.error('予期しないエラーが発生', errorInfo);
  }
}

// 非同期エラーのキャッチ
process.on('unhandledRejection', (reason, promise) => {
  logger.error('未処理のPromise拒否', {
    reason: reason,
    promise: promise,
    stack: reason instanceof Error ? reason.stack : undefined
  });
});

process.on('uncaughtException', (error) => {
  logger.error('未処理の例外', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});
\`\`\`

### 10.5 パフォーマンス監視ログ
\`\`\`typescript
// 実行時間の測定とログ出力
function measurePerformance(operationName: string) {
  const startTime = Date.now();
  
  return {
    end: (additionalData?: any) => {
      const duration = Date.now() - startTime;
      
      if (duration > 1000) {
        logger.warn(\`パフォーマンス警告: \${operationName}\`, {
          duration: \`\${duration}ms\`,
          threshold: '1000ms',
          ...additionalData
        });
      } else {
        logger.debug(\`パフォーマンス計測: \${operationName}\`, {
          duration: \`\${duration}ms\`,
          ...additionalData
        });
      }
    }
  };
}

// 使用例
const perf = measurePerformance('データベースクエリ');
const result = await database.query('SELECT * FROM large_table');
perf.end({ rowCount: result.length });
\`\`\`

### 10.6 デバッグ支援ログ
\`\`\`typescript
// API リクエスト/レスポンスのログ
function logApiCall(method: string, url: string, requestData?: any, responseData?: any): void {
  const requestId = generateRequestId();
  
  logger.info(\`API リクエスト開始: \${method} \${url}\`, {
    requestId,
    method,
    url,
    requestData: sanitizeLogData(requestData)
  });
  
  // レスポンス時
  logger.info(\`API レスポンス: \${method} \${url}\`, {
    requestId,
    method,
    url,
    responseData: sanitizeLogData(responseData)
  });
}

// データフロー追跡
function logDataFlow(step: string, data: any, context?: string): void {
  logger.debug(\`データフロー: \${step}\`, {
    step,
    context,
    dataSnapshot: sanitizeLogData(data),
    timestamp: new Date().toISOString()
  });
}
\`\`\`

### 10.7 ログ出力方針
- **開発環境**: コンソール出力（カラーコード付き）
- **本番環境**: 構造化JSON形式で標準出力
- **出力形式**: ログレベル、タイムスタンプ、メッセージ、構造化データ
- **ログ収集**: 標準出力されたログの収集・保存方法はデプロイ環境に依存

### 10.8 AI開発時のデバッグ指針
- **エラー発生時**: 必ずスタックトレースと実行コンテキストをログ出力
- **データ変換時**: 入力・出力データの構造をデバッグログで記録
- **外部API呼び出し**: リクエスト・レスポンスを詳細ログで追跡
- **状態変化**: 重要な状態変更時にINFOレベルでログ出力
- **パフォーマンス**: 処理時間が閾値を超えた場合は警告ログ

**重要**: AIが実装時にエラーが発生した場合、ログ情報を元に自動的に問題を特定・修正できるよう、十分な情報をログに含めること。

## 11. 実装優先順位とフェーズ

### フェーズ1: 基盤構築
1. プロジェクト初期設定とディレクトリ構造
2. 多言語化基盤の設定（i18n初期化、言語リソース構造）
3. 認証・認可システムの実装
4. データベース接続とマイグレーション設定
5. 基本的なCRUD APIの実装

### フェーズ2: コア機能実装
1. [主要機能1]の実装
2. [主要機能2]の実装
3. フロントエンドとバックエンドの統合
4. 多言語化対応の実装（翻訳キー追加、言語切り替え機能）

### フェーズ3: 品質向上と最適化
1. テストカバレッジの向上
2. 多言語化テストの実施
3. パフォーマンス最適化
4. セキュリティ強化
5. ドキュメント整備

---
*作成者: ProductOwnerAI*
*このドキュメントはAI開発チームのための技術仕様書です*`;