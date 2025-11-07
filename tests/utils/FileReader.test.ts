/**
 * FileReader Unit Tests (Jest)
 */

import { FileReader } from '../../src/utils/FileReader.js';
import { FileWriter } from '../../src/utils/FileWriter.js';
import * as path from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';

describe('FileReader', () => {
  let tempDir: string;
  let reader: FileReader;
  let writer: FileWriter;

  beforeEach(async () => {
    // テスト用の一時ディレクトリを作成
    tempDir = await mkdtemp(path.join(tmpdir(), 'filereader-test-'));
    reader = new FileReader(tempDir);
    writer = new FileWriter(tempDir);
  });

  afterEach(async () => {
    // テスト後にクリーンアップ
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('readJSON', () => {
    test('should read JSON file', async () => {
      const data = {
        languages: ['TypeScript', 'JavaScript'],
        frameworks: ['Electron', 'React'],
      };

      await writer.writeJSON('tech-stack.json', data);

      const result = await reader.readJSON<typeof data>('tech-stack.json');
      expect(result).toEqual(data);
    });

    test('should throw error for non-existing file', async () => {
      await expect(
        reader.readJSON('nonexistent.json')
      ).rejects.toThrow(/File not found/);
    });

    test('should throw error for invalid JSON', async () => {
      await writer.writeFile('invalid.json', 'not a valid json');

      await expect(
        reader.readJSON('invalid.json')
      ).rejects.toThrow(/Failed to parse JSON file/);
    });

    test('should preserve type information', async () => {
      interface TechStack {
        languages: string[];
        frameworks: string[];
        projectType: string;
      }

      const data: TechStack = {
        languages: ['TypeScript'],
        frameworks: ['React'],
        projectType: 'electron-app',
      };

      await writer.writeJSON('typed.json', data);

      const result = await reader.readJSON<TechStack>('typed.json');
      expect(result.languages).toEqual(['TypeScript']);
      expect(result.frameworks).toEqual(['React']);
      expect(result.projectType).toBe('electron-app');
    });
  });

  describe('readMarkdown', () => {
    test('should read Markdown file', async () => {
      const content = '# Task 001\n\n## Description\nImplement feature X';

      await writer.writeMarkdown('tasks/task-001/instruction.md', content);

      const result = await reader.readMarkdown('tasks/task-001/instruction.md');
      expect(result).toBe(content + '\n');
    });

    test('should throw error for non-existing file', async () => {
      await expect(
        reader.readMarkdown('nonexistent.md')
      ).rejects.toThrow(/File not found/);
    });
  });

  describe('readFile', () => {
    test('should read arbitrary text file', async () => {
      const content = 'Plain text content';
      await writer.writeFile('notes.txt', content);

      const result = await reader.readFile('notes.txt');
      expect(result).toBe(content);
    });
  });

  describe('exists', () => {
    test('should return true for existing file', async () => {
      await writer.writeFile('test.txt', 'content');

      const exists = await reader.exists('test.txt');
      expect(exists).toBe(true);
    });

    test('should return false for non-existing file', async () => {
      const exists = await reader.exists('nonexistent.txt');
      expect(exists).toBe(false);
    });
  });

  describe('listFiles', () => {
    test('should list files in directory', async () => {
      await writer.writeFile('file1.txt', 'content1');
      await writer.writeFile('file2.txt', 'content2');
      await writer.createDirectory('subdir');

      const files = await reader.listFiles();
      expect(files).toContain('file1.txt');
      expect(files).toContain('file2.txt');
      expect(files).not.toContain('subdir');
    });

    test('should list files in subdirectory', async () => {
      await writer.writeFile('tasks/task-001/file1.txt', 'content');
      await writer.writeFile('tasks/task-001/file2.txt', 'content');

      const files = await reader.listFiles('tasks/task-001');
      expect(files).toEqual(expect.arrayContaining(['file1.txt', 'file2.txt']));
    });

    test('should return empty array for empty directory', async () => {
      await writer.createDirectory('empty');

      const files = await reader.listFiles('empty');
      expect(files).toEqual([]);
    });
  });

  describe('listDirectories', () => {
    test('should list directories only', async () => {
      await writer.writeFile('file1.txt', 'content');
      await writer.createDirectory('dir1');
      await writer.createDirectory('dir2');

      const dirs = await reader.listDirectories();
      expect(dirs).toContain('dir1');
      expect(dirs).toContain('dir2');
      expect(dirs).not.toContain('file1.txt');
    });
  });

  describe('stat', () => {
    test('should return file stats', async () => {
      await writer.writeFile('test.txt', 'content');

      const stats = await reader.stat('test.txt');
      expect(stats.isFile()).toBe(true);
      expect(stats.isDirectory()).toBe(false);
      expect(stats.size).toBeGreaterThan(0);
    });

    test('should return directory stats', async () => {
      await writer.createDirectory('testdir');

      const stats = await reader.stat('testdir');
      expect(stats.isDirectory()).toBe(true);
      expect(stats.isFile()).toBe(false);
    });

    test('should throw error for non-existing path', async () => {
      await expect(
        reader.stat('nonexistent')
      ).rejects.toThrow(/Failed to get file stats/);
    });
  });
});
