import * as fs from 'fs/promises';
import type { Stats } from 'fs';
import * as path from 'path';

/**
 * FileReader
 *
 * `.kugutsu/` ディレクトリからのファイル読み込みを安全に行うユーティリティクラス。
 *
 * 主な機能:
 * - JSON ファイルの読み込みと型安全性
 * - Markdown ファイルの読み込み
 * - ファイル存在確認
 * - エラーハンドリング
 */
export class FileReader {
  /**
   * @param baseDir ベースディレクトリ（通常は `.kugutsu/` またはプロジェクトルート）
   */
  constructor(private baseDir: string) {}

  /**
   * JSON ファイルを読み込む
   *
   * @param relativePath ベースディレクトリからの相対パス
   * @returns パースされたJSONデータ（型パラメータで指定した型）
   * @throws ファイルが存在しない、またはJSONパースエラー
   */
  async readJSON<T>(relativePath: string): Promise<T> {
    const fullPath = path.join(this.baseDir, relativePath);

    if (!(await this.exists(relativePath))) {
      throw new Error(`File not found: ${fullPath}`);
    }

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(
          `Failed to parse JSON file: ${fullPath}\n` +
          `Reason: ${error.message}`
        );
      }
      throw new Error(
        `Failed to read JSON file: ${fullPath}\n` +
        `Reason: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Markdown ファイルを読み込む
   *
   * @param relativePath ベースディレクトリからの相対パス
   * @returns ファイルの内容（文字列）
   * @throws ファイルが存在しない、または読み込みエラー
   */
  async readMarkdown(relativePath: string): Promise<string> {
    const fullPath = path.join(this.baseDir, relativePath);

    if (!(await this.exists(relativePath))) {
      throw new Error(`File not found: ${fullPath}`);
    }

    try {
      return await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      throw new Error(
        `Failed to read Markdown file: ${fullPath}\n` +
        `Reason: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 任意のテキストファイルを読み込む
   *
   * @param relativePath ベースディレクトリからの相対パス
   * @returns ファイルの内容（文字列）
   * @throws ファイルが存在しない、または読み込みエラー
   */
  async readFile(relativePath: string): Promise<string> {
    const fullPath = path.join(this.baseDir, relativePath);

    if (!(await this.exists(relativePath))) {
      throw new Error(`File not found: ${fullPath}`);
    }

    try {
      return await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      throw new Error(
        `Failed to read file: ${fullPath}\n` +
        `Reason: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * ファイルが存在するか確認する
   *
   * @param relativePath ベースディレクトリからの相対パス
   * @returns ファイルが存在する場合は true
   */
  async exists(relativePath: string): Promise<boolean> {
    const fullPath = path.join(this.baseDir, relativePath);

    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * ディレクトリ内のファイル一覧を取得する
   *
   * @param relativePath ベースディレクトリからの相対パス
   * @returns ファイル名の配列
   * @throws ディレクトリが存在しない、または読み込みエラー
   */
  async listFiles(relativePath: string = ''): Promise<string[]> {
    const fullPath = path.join(this.baseDir, relativePath);

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isFile())
        .map(entry => entry.name);
    } catch (error) {
      throw new Error(
        `Failed to list files in directory: ${fullPath}\n` +
        `Reason: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * ディレクトリ内のサブディレクトリ一覧を取得する
   *
   * @param relativePath ベースディレクトリからの相対パス
   * @returns ディレクトリ名の配列
   * @throws ディレクトリが存在しない、または読み込みエラー
   */
  async listDirectories(relativePath: string = ''): Promise<string[]> {
    const fullPath = path.join(this.baseDir, relativePath);

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
    } catch (error) {
      throw new Error(
        `Failed to list directories in: ${fullPath}\n` +
        `Reason: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * ファイルの統計情報を取得する
   *
   * @param relativePath ベースディレクトリからの相対パス
   * @returns ファイルの統計情報
   * @throws ファイルが存在しない、または読み込みエラー
   */
  async stat(relativePath: string): Promise<Stats> {
    const fullPath = path.join(this.baseDir, relativePath);

    try {
      return await fs.stat(fullPath);
    } catch (error) {
      throw new Error(
        `Failed to get file stats: ${fullPath}\n` +
        `Reason: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
