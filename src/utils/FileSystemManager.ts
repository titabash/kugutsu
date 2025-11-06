/**
 * FileSystemManager
 *
 * ファイルシステム操作のユーティリティクラス
 *
 * - ディレクトリの作成
 * - JSONファイルの読み書き
 * - ファイルの存在チェック
 * - パス操作
 */

import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

export class FileSystemManager {
  /**
   * ディレクトリが存在しない場合は作成する
   *
   * @param dirPath - ディレクトリパス
   */
  static async ensureDirectory(dirPath: string): Promise<void> {
    if (!existsSync(dirPath)) {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * JSONファイルを読み込む
   *
   * @param filePath - ファイルパス
   * @returns パースされたJSONオブジェクト
   * @throws ファイルが存在しない、またはパースエラーの場合
   */
  static async readJSON<T = any>(filePath: string): Promise<T> {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  }

  /**
   * JSONファイルを読み込む（エラー時はデフォルト値を返す）
   *
   * @param filePath - ファイルパス
   * @param defaultValue - ファイルが存在しない場合のデフォルト値
   * @returns パースされたJSONオブジェクト、またはデフォルト値
   */
  static async readJSONSafe<T>(filePath: string, defaultValue: T): Promise<T> {
    try {
      return await this.readJSON<T>(filePath);
    } catch (error) {
      return defaultValue;
    }
  }

  /**
   * JSONファイルに書き込む
   *
   * @param filePath - ファイルパス
   * @param data - 保存するデータ
   * @param pretty - フォーマットするかどうか（デフォルト: true）
   */
  static async writeJSON(filePath: string, data: any, pretty = true): Promise<void> {
    // 親ディレクトリを確保
    const dirPath = path.dirname(filePath);
    await this.ensureDirectory(dirPath);

    // JSONに変換して書き込み
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * ファイルを読み込む
   *
   * @param filePath - ファイルパス
   * @returns ファイルの内容
   * @throws ファイルが存在しない場合
   */
  static async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8');
  }

  /**
   * ファイルに書き込む
   *
   * @param filePath - ファイルパス
   * @param content - 書き込む内容
   */
  static async writeFile(filePath: string, content: string): Promise<void> {
    // 親ディレクトリを確保
    const dirPath = path.dirname(filePath);
    await this.ensureDirectory(dirPath);

    // ファイルに書き込み
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * ファイルが存在するかチェック
   *
   * @param filePath - ファイルパス
   * @returns ファイルが存在する場合true
   */
  static exists(filePath: string): boolean {
    return existsSync(filePath);
  }

  /**
   * ファイルまたはディレクトリを削除
   *
   * @param targetPath - 削除対象のパス
   * @param recursive - ディレクトリの場合、再帰的に削除するか
   */
  static async remove(targetPath: string, recursive = true): Promise<void> {
    if (existsSync(targetPath)) {
      await fs.rm(targetPath, { recursive, force: true });
    }
  }

  /**
   * ディレクトリ内のファイル一覧を取得
   *
   * @param dirPath - ディレクトリパス
   * @returns ファイル名の配列
   */
  static async listFiles(dirPath: string): Promise<string[]> {
    if (!existsSync(dirPath)) {
      return [];
    }
    return await fs.readdir(dirPath);
  }

  /**
   * パスを結合
   *
   * @param segments - パスセグメント
   * @returns 結合されたパス
   */
  static join(...segments: string[]): string {
    return path.join(...segments);
  }

  /**
   * 絶対パスに変換
   *
   * @param relativePath - 相対パス
   * @returns 絶対パス
   */
  static resolve(relativePath: string): string {
    return path.resolve(relativePath);
  }
}
