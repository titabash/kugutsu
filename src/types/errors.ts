/**
 * エラーの深刻度分類
 */
export enum ErrorSeverity {
  /**
   * リトライ可能なエラー
   * 例: ネットワークタイムアウト、一時的な接続エラー、レート制限
   */
  RETRYABLE = 'retryable',

  /**
   * 手動介入で復旧可能なエラー
   * 例: マージコンフリクト、権限エラー
   */
  RECOVERABLE = 'recoverable',

  /**
   * 永続的なエラー（復旧不可）
   * 例: 認証エラー、無効な入力、論理エラー
   */
  PERMANENT = 'permanent',
}

/**
 * 分類されたエラー情報
 */
export interface ClassifiedError {
  /**
   * エラーの深刻度
   */
  severity: ErrorSeverity;

  /**
   * 人間が読めるエラーメッセージ
   */
  message: string;

  /**
   * 元のエラーオブジェクト
   */
  originalError: Error;

  /**
   * 追加のコンテキスト情報（オプション）
   */
  context?: Record<string, any>;
}

/**
 * 状態遷移エラー
 */
export class InvalidStateTransitionError extends Error {
  constructor(
    public from: string,
    public to: string,
    message?: string
  ) {
    super(message || `Invalid state transition: ${from} -> ${to}`);
    this.name = 'InvalidStateTransitionError';
  }
}

/**
 * リトライ可能なエラー
 */
export class RetryableError extends Error {
  constructor(
    message: string,
    public originalError?: Error,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'RetryableError';
  }
}

/**
 * 復旧可能なエラー
 */
export class RecoverableError extends Error {
  constructor(
    message: string,
    public originalError?: Error,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'RecoverableError';
  }
}

/**
 * 永続的なエラー
 */
export class PermanentError extends Error {
  constructor(
    message: string,
    public originalError?: Error,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'PermanentError';
  }
}
