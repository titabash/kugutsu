/**
 * Tech Lead Design Node AI Responses
 *
 * Mock responses for TechLeadAI (Technical Design Documents)
 */

import type { MockResponse } from '../../../src/providers/MockAIProvider.js';
import { createMockMessage } from '../../../src/providers/MockAIProvider.js';

/**
 * Design documents content for authentication system
 */
export const authenticationDesignDocs = `# 技術設計書: ユーザー認証システム

## 1. アーキテクチャ概要

### システム構成
- **フロントエンド**: React + TypeScript
- **バックエンド**: Node.js + Express
- **データベース**: PostgreSQL
- **認証**: JWT (JSON Web Tokens)
- **パスワードハッシュ**: bcrypt

### コンポーネント構成

\`\`\`
┌─────────────────┐
│  React Frontend │
│   (TypeScript)  │
└────────┬────────┘
         │ HTTPS/REST
┌────────▼────────┐
│  Express API    │
│   (Node.js)     │
└────────┬────────┘
         │
┌────────▼────────┐
│  PostgreSQL DB  │
└─────────────────┘
\`\`\`

## 2. データモデル

### Users テーブル

\`\`\`sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);
\`\`\`

### Sessions テーブル

\`\`\`sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
\`\`\`

## 3. API設計

### POST /api/auth/login
ユーザーログイン

**Request Body**:
\`\`\`json
{
  "email": "user@example.com",
  "password": "password123"
}
\`\`\`

**Response** (200 OK):
\`\`\`json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@example.com"
  }
}
\`\`\`

### POST /api/auth/logout
ユーザーログアウト

**Headers**: \`Authorization: Bearer <token>\`

**Response** (200 OK):
\`\`\`json
{
  "message": "Logged out successfully"
}
\`\`\`

### POST /api/auth/reset-password
パスワードリセット要求

**Request Body**:
\`\`\`json
{
  "email": "user@example.com"
}
\`\`\`

**Response** (200 OK):
\`\`\`json
{
  "message": "Password reset email sent"
}
\`\`\`

## 4. セキュリティ考慮事項

1. **パスワードハッシュ**: bcrypt (salt rounds: 10)
2. **JWT有効期限**: 24時間
3. **HTTPS必須**: 本番環境ではHTTPSのみ許可
4. **CORS設定**: 許可されたオリジンのみ
5. **Rate Limiting**: ログインエンドポイントに適用（5回/分）
6. **入力検証**: email形式、パスワード強度チェック

## 5. 実装タスク

1. データベーススキーマ作成
2. User モデル実装
3. AuthService 実装 (JWT生成・検証)
4. Login API 実装
5. Logout API 実装
6. Password Reset API 実装
7. Frontend Login Form 実装
8. Frontend Dashboard 実装
9. 統合テスト
`;

/**
 * API specification in JSON format
 */
export const authenticationApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Authentication API',
    version: '1.0.0',
    description: 'User authentication and authorization API',
  },
  paths: {
    '/api/auth/login': {
      post: {
        summary: 'User login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    user: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        email: { type: 'string', format: 'email' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Invalid credentials',
          },
        },
      },
    },
    '/api/auth/logout': {
      post: {
        summary: 'User logout',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Logout successful',
          },
        },
      },
    },
  },
};

/**
 * Create mock response for TechLeadDesign with file creation
 */
export function createTechLeadDesignResponse(designDocsPath: string, apiSpecPath: string): MockResponse {
  return {
    simulateTools: true,
    messages: [
      // Step 1: Create design-docs.md
      {
        type: 'system',
        content: {
          toolUse: {
            tool: 'Write',
            arguments: {
              file_path: designDocsPath,
              content: authenticationDesignDocs,
            },
          },
        },
        timestamp: new Date(),
      } as any,
      // Step 2: Create api-spec.json
      {
        type: 'system',
        content: {
          toolUse: {
            tool: 'Write',
            arguments: {
              file_path: apiSpecPath,
              content: JSON.stringify(authenticationApiSpec, null, 2),
            },
          },
        },
        timestamp: new Date(),
      } as any,
      // Step 3: Assistant confirmation
      createMockMessage.assistant(
        `技術設計書を作成しました。\n\n` +
          `- ${designDocsPath}\n` +
          `- ${apiSpecPath}\n\n` +
          `アーキテクチャ: React + Node.js + PostgreSQL\n` +
          `認証方式: JWT\n` +
          `API endpoints: 3`
      ),
      // Step 4: Result
      createMockMessage.result(true),
    ],
  };
}

/**
 * Simple design response (without file creation)
 */
export const techLeadDesignResponseSimple: MockResponse = {
  messages: [
    createMockMessage.assistant(
      `技術設計書を作成しました。\n\n` +
        `アーキテクチャ: React + Node.js + PostgreSQL\n` +
        `認証方式: JWT\n` +
        `API endpoints: 3`
    ),
    createMockMessage.result(true),
  ],
};
