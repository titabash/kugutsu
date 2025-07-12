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
└── docs/            # ドキュメント
\`\`\`

### 2.3 技術スタックの決定
#### フロントエンド
- **フレームワーク**: [React/Vue/Angular等] - [選定理由]
- **状態管理**: [Redux/Vuex/MobX等] - [選定理由]
- **スタイリング**: [CSS-in-JS/Tailwind等] - [選定理由]

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

## 10. 実装優先順位とフェーズ

### フェーズ1: 基盤構築
1. プロジェクト初期設定とディレクトリ構造
2. 認証・認可システムの実装
3. データベース接続とマイグレーション設定
4. 基本的なCRUD APIの実装

### フェーズ2: コア機能実装
1. [主要機能1]の実装
2. [主要機能2]の実装
3. フロントエンドとバックエンドの統合

### フェーズ3: 品質向上と最適化
1. テストカバレッジの向上
2. パフォーマンス最適化
3. セキュリティ強化
4. ドキュメント整備

---
*作成者: ProductOwnerAI*
*このドキュメントはAI開発チームのための技術仕様書です*`;