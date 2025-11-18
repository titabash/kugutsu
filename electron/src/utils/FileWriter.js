import * as fs from 'fs/promises';
import * as path from 'path';
import { Mutex } from 'async-mutex';
/**
 * FileWriter
 *
 * `.kugutsu/` ディレクトリ配下のファイル書き込みを安全に行うユーティリティクラス。
 *
 * 主な機能:
 * - JSON ファイルの書き込み (pretty print、改行コード統一)
 * - Markdown ファイルの書き込み
 * - ディレクトリの自動作成
 * - エラーハンドリング
 * - Mutex による並列書き込み保護（データ破損防止）
 */
export class FileWriter {
    baseDir;
    /**
     * ファイルパスごとのMutexマップ（並列書き込み保護）
     */
    static mutexMap = new Map();
    /**
     * @param baseDir ベースディレクトリ（通常は `.kugutsu/` またはプロジェクトルート）
     */
    constructor(baseDir) {
        this.baseDir = baseDir;
    }
    /**
     * 指定されたファイルパスのMutexを取得する
     * 同じファイルへの並列書き込みを防ぐために使用
     *
     * @param filePath ファイルパス
     * @returns Mutex インスタンス
     */
    getMutex(filePath) {
        if (!FileWriter.mutexMap.has(filePath)) {
            FileWriter.mutexMap.set(filePath, new Mutex());
        }
        return FileWriter.mutexMap.get(filePath);
    }
    /**
     * JSON ファイルを書き込む
     * Mutex により並列書き込みから保護され、データ破損を防ぎます
     *
     * @param relativePath ベースディレクトリからの相対パス
     * @param data 書き込むJSONデータ
     * @returns 作成されたファイルの絶対パス
     */
    async writeJSON(relativePath, data) {
        const fullPath = path.join(this.baseDir, relativePath);
        const mutex = this.getMutex(fullPath);
        // Mutexで保護された書き込み
        return await mutex.runExclusive(async () => {
            try {
                // ディレクトリを自動作成
                await fs.mkdir(path.dirname(fullPath), { recursive: true });
                // JSON を pretty print で書き込み（改行コードは LF で統一）
                const content = JSON.stringify(data, null, 2) + '\n';
                await fs.writeFile(fullPath, content, 'utf-8');
                return fullPath;
            }
            catch (error) {
                throw new Error(`Failed to write JSON file: ${fullPath}\n` +
                    `Reason: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }
    /**
     * Markdown ファイルを書き込む
     * Mutex により並列書き込みから保護され、データ破損を防ぎます
     *
     * @param relativePath ベースディレクトリからの相対パス
     * @param content 書き込むMarkdownコンテンツ
     * @returns 作成されたファイルの絶対パス
     */
    async writeMarkdown(relativePath, content) {
        const fullPath = path.join(this.baseDir, relativePath);
        const mutex = this.getMutex(fullPath);
        // Mutexで保護された書き込み
        return await mutex.runExclusive(async () => {
            try {
                // ディレクトリを自動作成
                await fs.mkdir(path.dirname(fullPath), { recursive: true });
                // Markdown を書き込み（末尾に改行を追加）
                const normalizedContent = content.endsWith('\n') ? content : content + '\n';
                await fs.writeFile(fullPath, normalizedContent, 'utf-8');
                return fullPath;
            }
            catch (error) {
                throw new Error(`Failed to write Markdown file: ${fullPath}\n` +
                    `Reason: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }
    /**
     * 任意のテキストファイルを書き込む
     * Mutex により並列書き込みから保護され、データ破損を防ぎます
     *
     * @param relativePath ベースディレクトリからの相対パス
     * @param content 書き込むコンテンツ
     * @returns 作成されたファイルの絶対パス
     */
    async writeFile(relativePath, content) {
        const fullPath = path.join(this.baseDir, relativePath);
        const mutex = this.getMutex(fullPath);
        // Mutexで保護された書き込み
        return await mutex.runExclusive(async () => {
            try {
                // ディレクトリを自動作成
                await fs.mkdir(path.dirname(fullPath), { recursive: true });
                await fs.writeFile(fullPath, content, 'utf-8');
                return fullPath;
            }
            catch (error) {
                throw new Error(`Failed to write file: ${fullPath}\n` +
                    `Reason: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }
    /**
     * ディレクトリを作成する
     *
     * @param relativePath ベースディレクトリからの相対パス
     * @returns 作成されたディレクトリの絶対パス
     */
    async createDirectory(relativePath) {
        const fullPath = path.join(this.baseDir, relativePath);
        try {
            await fs.mkdir(fullPath, { recursive: true });
            return fullPath;
        }
        catch (error) {
            throw new Error(`Failed to create directory: ${fullPath}\n` +
                `Reason: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * ファイルが存在するか確認する
     *
     * @param relativePath ベースディレクトリからの相対パス
     * @returns ファイルが存在する場合は true
     */
    async exists(relativePath) {
        const fullPath = path.join(this.baseDir, relativePath);
        try {
            await fs.access(fullPath);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * ファイルを削除する
     *
     * @param relativePath ベースディレクトリからの相対パス
     */
    async deleteFile(relativePath) {
        const fullPath = path.join(this.baseDir, relativePath);
        try {
            await fs.unlink(fullPath);
        }
        catch (error) {
            throw new Error(`Failed to delete file: ${fullPath}\n` +
                `Reason: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
//# sourceMappingURL=FileWriter.js.map