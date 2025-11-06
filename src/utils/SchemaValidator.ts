/**
 * SchemaValidator
 *
 * JSONスキーマによるデータバリデーション
 */

import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// ESM環境でのディレクトリパス取得
const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaDir = join(__dirname, '../../schema');

// スキーマファイルを読み込み
const loadSchema = (filename: string) => {
  const path = join(schemaDir, filename);
  return JSON.parse(readFileSync(path, 'utf-8'));
};

/**
 * バリデーション結果
 */
export interface ValidationResult {
  valid: boolean;
  errors?: Array<{
    instancePath: string;
    schemaPath: string;
    keyword: string;
    params: Record<string, any>;
    message?: string;
  }>;
}

/**
 * SchemaValidator
 *
 * Ajvを使用したJSONスキーマバリデーター
 */
export class SchemaValidator {
  private ajv: Ajv;
  private validators: Map<string, ValidateFunction>;

  constructor() {
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);
    this.validators = new Map();

    // スキーマを登録
    this.registerSchema('story-mapping', 'story-mapping.schema.json');
    this.registerSchema('task', 'task.schema.json');
    this.registerSchema('dependency-graph', 'dependency-graph.schema.json');
    this.registerSchema('kanban-state', 'kanban-state.schema.json');
    this.registerSchema('review', 'review.schema.json');
    this.registerSchema('design-docs', 'design-docs.schema.json');
  }

  /**
   * スキーマを登録
   */
  private registerSchema(name: string, filename: string): void {
    try {
      const schema = loadSchema(filename);
      const validate = this.ajv.compile(schema);
      this.validators.set(name, validate);
    } catch (error) {
      console.error(`Failed to load schema: ${filename}`, error);
      throw new Error(`Failed to load schema: ${filename}`);
    }
  }

  /**
   * データをバリデーション
   */
  validate(schemaName: string, data: any): ValidationResult {
    const validate = this.validators.get(schemaName);
    if (!validate) {
      throw new Error(`Schema not found: ${schemaName}`);
    }

    const valid = validate(data);
    return {
      valid: !!valid,
      errors: validate.errors
        ? validate.errors.map((err) => ({
            instancePath: err.instancePath,
            schemaPath: err.schemaPath,
            keyword: err.keyword,
            params: err.params,
            message: err.message,
          }))
        : undefined,
    };
  }

  /**
   * ストーリーマッピングをバリデーション
   */
  validateStoryMapping(data: any): ValidationResult {
    return this.validate('story-mapping', data);
  }

  /**
   * タスクリストをバリデーション
   */
  validateTaskList(data: any): ValidationResult {
    return this.validate('task', data);
  }

  /**
   * 依存関係グラフをバリデーション
   */
  validateDependencyGraph(data: any): ValidationResult {
    return this.validate('dependency-graph', data);
  }

  /**
   * Kanbanステートをバリデーション
   */
  validateKanbanState(data: any): ValidationResult {
    return this.validate('kanban-state', data);
  }

  /**
   * レビュー履歴をバリデーション
   */
  validateReview(data: any): ValidationResult {
    return this.validate('review', data);
  }

  /**
   * 設計書をバリデーション
   */
  validateDesignDocs(data: any): ValidationResult {
    return this.validate('design-docs', data);
  }

  /**
   * バリデーションエラーを人間が読みやすい形式に変換
   */
  formatErrors(result: ValidationResult): string {
    if (result.valid || !result.errors) {
      return '';
    }

    return result.errors
      .map((err) => {
        const path = err.instancePath || '(root)';
        const message = err.message || 'validation error';
        const params = JSON.stringify(err.params);
        return `  - ${path}: ${message} ${params}`;
      })
      .join('\n');
  }
}

/**
 * シングルトンインスタンス
 */
let instance: SchemaValidator | null = null;

/**
 * SchemaValidatorのシングルトンインスタンスを取得
 */
export function getSchemaValidator(): SchemaValidator {
  if (!instance) {
    instance = new SchemaValidator();
  }
  return instance;
}
