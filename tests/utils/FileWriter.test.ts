/**
 * FileWriter Unit Tests (Jest)
 */

import { FileWriter } from '../../src/utils/FileWriter.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';

describe('FileWriter', () => {
  let tempDir: string;
  let writer: FileWriter;

  beforeEach(async () => {
    // テスト用の一時ディレクトリを作成
    tempDir = await mkdtemp(path.join(tmpdir(), 'filewriter-test-'));
    writer = new FileWriter(tempDir);
  });

  afterEach(async () => {
    // テスト後にクリーンアップ
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('writeJSON', () => {
    test('should write JSON file with pretty print', async () => {
      const data = {
        languages: ['TypeScript', 'JavaScript'],
        frameworks: ['Electron', 'React'],
      };

      const filePath = await writer.writeJSON('tech-stack.json', data);

      // ファイルが作成されていることを確認
      expect(filePath).toBe(path.join(tempDir, 'tech-stack.json'));
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      // ファイルの内容を確認
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed).toEqual(data);

      // Pretty print されていることを確認（改行とインデント）
      expect(content).toContain('  "languages"');
      expect(content.endsWith('\n')).toBe(true);
    });

    test('should create nested directories automatically', async () => {
      const data = { id: 'task-001', title: 'Test Task' };
      const filePath = await writer.writeJSON('tasks/task-001/data.json', data);

      // ネストされたディレクトリが作成されていることを確認
      expect(filePath).toBe(path.join(tempDir, 'tasks/task-001/data.json'));
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(JSON.parse(content)).toEqual(data);
    });

    test('should throw error on write failure', async () => {
      // 不正なディレクトリパスでテスト（例: /dev/null/test.json）
      const invalidWriter = new FileWriter('/dev/null');

      await expect(
        invalidWriter.writeJSON('test.json', { data: 'test' })
      ).rejects.toThrow(/Failed to write JSON file/);
    });
  });

  describe('writeMarkdown', () => {
    test('should write Markdown file', async () => {
      const content = '# Task 001\n\n## Description\nImplement feature X';

      const filePath = await writer.writeMarkdown('tasks/task-001/instruction.md', content);

      // ファイルが作成されていることを確認
      expect(filePath).toBe(path.join(tempDir, 'tasks/task-001/instruction.md'));
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      // ファイルの内容を確認
      const fileContent = await fs.readFile(filePath, 'utf-8');
      expect(fileContent).toBe(content + '\n');
    });

    test('should append newline if not present', async () => {
      const contentWithoutNewline = '# Test';
      const filePath = await writer.writeMarkdown('test.md', contentWithoutNewline);

      const fileContent = await fs.readFile(filePath, 'utf-8');
      expect(fileContent).toBe('# Test\n');
    });

    test('should not add extra newline if already present', async () => {
      const contentWithNewline = '# Test\n';
      const filePath = await writer.writeMarkdown('test.md', contentWithNewline);

      const fileContent = await fs.readFile(filePath, 'utf-8');
      expect(fileContent).toBe('# Test\n');
    });
  });

  describe('writeFile', () => {
    test('should write arbitrary text file', async () => {
      const content = 'Plain text content';
      const filePath = await writer.writeFile('notes.txt', content);

      const fileContent = await fs.readFile(filePath, 'utf-8');
      expect(fileContent).toBe(content);
    });
  });

  describe('createDirectory', () => {
    test('should create directory', async () => {
      const dirPath = await writer.createDirectory('tasks/task-001');

      expect(dirPath).toBe(path.join(tempDir, 'tasks/task-001'));
      const stat = await fs.stat(dirPath);
      expect(stat.isDirectory()).toBe(true);
    });

    test('should create nested directories', async () => {
      const dirPath = await writer.createDirectory('a/b/c/d');

      const stat = await fs.stat(dirPath);
      expect(stat.isDirectory()).toBe(true);
    });
  });

  describe('exists', () => {
    test('should return true for existing file', async () => {
      await writer.writeFile('test.txt', 'content');

      const exists = await writer.exists('test.txt');
      expect(exists).toBe(true);
    });

    test('should return false for non-existing file', async () => {
      const exists = await writer.exists('nonexistent.txt');
      expect(exists).toBe(false);
    });
  });

  describe('deleteFile', () => {
    test('should delete existing file', async () => {
      await writer.writeFile('test.txt', 'content');
      expect(await writer.exists('test.txt')).toBe(true);

      await writer.deleteFile('test.txt');
      expect(await writer.exists('test.txt')).toBe(false);
    });

    test('should throw error when deleting non-existing file', async () => {
      await expect(
        writer.deleteFile('nonexistent.txt')
      ).rejects.toThrow(/Failed to delete file/);
    });
  });
});
