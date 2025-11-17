/**
 * E2E Test Helper
 *
 * E2Eテストでのテスト環境セットアップとワークフロー実行を管理
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { execSync } from 'child_process';
import { MockAIProvider } from '../../src/providers/MockAIProvider.js';
import { MockScenarioBuilder } from './MockScenarioBuilder.js';
import type { ParallelDevStateType } from '../../src/graph/state.js';
import type { CompiledStateGraph } from '@langchain/langgraph';

/**
 * テスト環境セットアップオプション
 */
export interface SetupOptions {
  /**
   * Gitリポジトリを初期化するか（デフォルト: true）
   */
  initGit?: boolean;

  /**
   * 技術スタックファイルを作成するか（デフォルト: true）
   */
  createTechStack?: boolean;

  /**
   * 詳細ログを出力するか（デフォルト: false）
   */
  verbose?: boolean;
}

/**
 * E2E Test Helper
 *
 * テスト環境のセットアップとワークフロー実行を管理
 */
export class E2ETestHelper {
  private scenarioBuilder: MockScenarioBuilder;

  constructor(
    private testDir: string,
    private mockProvider: MockAIProvider
  ) {
    this.scenarioBuilder = new MockScenarioBuilder();
  }

  /**
   * テスト環境をセットアップ
   *
   * 1. Gitリポジトリ初期化
   * 2. .kugutsuディレクトリ構造作成
   * 3. 技術スタックファイル配置（CheckModeNodeの代替）
   */
  async setupTestEnvironment(options: SetupOptions = {}): Promise<void> {
    const {
      initGit = true,
      createTechStack = true,
      verbose = false,
    } = options;

    if (verbose) {
      console.log(`\n🔧 Setting up test environment: ${this.testDir}`);
    }

    // Git初期化
    if (initGit) {
      await this.initGitRepository(verbose);
    }

    // .kugutsuディレクトリ構造作成
    await this.createKugutsuStructure(verbose);

    // 技術スタックファイル配置
    if (createTechStack) {
      await this.setupTechStack(verbose);
    }

    if (verbose) {
      console.log('✅ Test environment setup complete\n');
    }
  }

  /**
   * Gitリポジトリを初期化
   */
  private async initGitRepository(verbose: boolean): Promise<void> {
    if (verbose) {
      console.log('  📦 Initializing Git repository...');
    }

    try {
      execSync('git init', {
        cwd: this.testDir,
        stdio: verbose ? 'inherit' : 'pipe',
      });

      execSync('git config user.email "test@example.com"', {
        cwd: this.testDir,
        stdio: 'pipe',
      });

      execSync('git config user.name "Test User"', {
        cwd: this.testDir,
        stdio: 'pipe',
      });

      // 初期コミット
      execSync('git add .', { cwd: this.testDir, stdio: 'pipe' });
      execSync('git commit -m "Initial commit" --allow-empty', {
        cwd: this.testDir,
        stdio: 'pipe',
      });

      if (verbose) {
        console.log('  ✓ Git repository initialized');
      }
    } catch (error) {
      throw new Error(`Failed to initialize Git repository: ${error}`);
    }
  }

  /**
   * .kugutsuディレクトリ構造を作成
   */
  private async createKugutsuStructure(verbose: boolean): Promise<void> {
    if (verbose) {
      console.log('  📁 Creating .kugutsu directory structure...');
    }

    const directories = [
      '.kugutsu',
      '.kugutsu/repository',
      '.kugutsu/repository/architecture',
      '.kugutsu/product-backlog',
      '.kugutsu/sprints',
    ];

    for (const dir of directories) {
      const fullPath = path.join(this.testDir, dir);
      await fs.mkdir(fullPath, { recursive: true });
    }

    if (verbose) {
      console.log('  ✓ Directory structure created');
    }
  }

  /**
   * 技術スタックファイルをセットアップ（CheckModeNodeの代替）
   */
  private async setupTechStack(verbose: boolean): Promise<void> {
    if (verbose) {
      console.log('  🔧 Creating tech-stack.json...');
    }

    const techStack = {
      languages: ['TypeScript', 'JavaScript'],
      frameworks: ['React', 'Next.js'],
      runtime: ['Node.js 20+'],
      packageManager: 'npm',
      buildTools: ['TypeScript Compiler', 'Next.js Build'],
      testingFrameworks: ['Jest', 'Playwright'],
      detectedAt: new Date().toISOString(),
    };

    const techStackPath = path.join(
      this.testDir,
      '.kugutsu/repository/architecture/tech-stack.json'
    );

    await fs.writeFile(
      techStackPath,
      JSON.stringify(techStack, null, 2),
      'utf-8'
    );

    if (verbose) {
      console.log('  ✓ tech-stack.json created');
    }
  }

  /**
   * モックシナリオをセットアップ
   */
  async setupMockScenario(
    scenarioName: 'simple' | 'with-dependencies' | 'complex',
    verbose: boolean = false
  ): Promise<void> {
    if (verbose) {
      console.log(`\n🎭 Setting up mock scenario: ${scenarioName}`);
    }

    let scenario;

    switch (scenarioName) {
      case 'simple':
        scenario = this.scenarioBuilder.buildProductOwnerScenario({
          taskCount: 3,
          includeDependencies: false,
        });
        break;

      case 'with-dependencies':
        scenario = this.scenarioBuilder.buildProductOwnerScenario({
          taskCount: 5,
          includeDependencies: true,
        });
        break;

      case 'complex':
        scenario = this.scenarioBuilder.buildProductOwnerScenario({
          taskCount: 7,
          includeDependencies: true,
          complexity: 'high',
        });
        break;

      default:
        throw new Error(`Unknown scenario: ${scenarioName}`);
    }

    this.mockProvider.setupScenario(scenario);
    this.mockProvider.activateScenario(scenario.name);

    if (verbose) {
      console.log(`✅ Scenario activated: ${scenario.name}\n`);
    }
  }

  /**
   * ワークフローを実行してUI更新を検証
   */
  async executeWorkflowAndVerifyFiles(
    graph: CompiledStateGraph<ParallelDevStateType, any, any>,
    initialState: ParallelDevStateType,
    verbose: boolean = false
  ): Promise<{
    finalState: ParallelDevStateType;
    events: any[];
    filesCreated: string[];
  }> {
    if (verbose) {
      console.log('\n🚀 Executing workflow...');
    }

    const events: any[] = [];
    const filesCreated: string[] = [];

    try {
      const stream = await graph.stream(initialState, {
        streamMode: 'values' as const,
      });

      let finalState: ParallelDevStateType = initialState;

      for await (const event of stream) {
        events.push(event);

        // State更新を収集
        for (const nodeName of Object.keys(event)) {
          const nodeData = event[nodeName];

          if (verbose) {
            console.log(`  📍 Node executed: ${nodeName}`);
          }

          // ファイルパスをチェック
          if (nodeData.requirementsPath) {
            const exists = await this.verifyFileExists(nodeData.requirementsPath);
            if (exists) {
              filesCreated.push(nodeData.requirementsPath);
              if (verbose) {
                console.log(`    ✓ File created: ${nodeData.requirementsPath}`);
              }
            }
          }

          if (nodeData.tasksPath) {
            const exists = await this.verifyFileExists(nodeData.tasksPath);
            if (exists) {
              filesCreated.push(nodeData.tasksPath);
              if (verbose) {
                console.log(`    ✓ File created: ${nodeData.tasksPath}`);
              }
            }
          }

          // 最終Stateを更新
          finalState = { ...finalState, ...nodeData };
        }
      }

      if (verbose) {
        console.log('\n✅ Workflow execution complete');
        console.log(`  Events: ${events.length}`);
        console.log(`  Files created: ${filesCreated.length}`);
        console.log(`  Tasks in state: ${finalState.tasks?.length || 0}`);
      }

      return {
        finalState,
        events,
        filesCreated,
      };
    } catch (error) {
      console.error('❌ Workflow execution failed:', error);
      throw error;
    }
  }

  /**
   * ファイルの存在を確認
   */
  async verifyFileExists(relativePath: string): Promise<boolean> {
    const fullPath = path.join(this.testDir, relativePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * ファイルの内容を読み込み
   */
  async readFile(relativePath: string): Promise<string> {
    const fullPath = path.join(this.testDir, relativePath);
    return await fs.readFile(fullPath, 'utf-8');
  }

  /**
   * JSONファイルを読み込み
   */
  async readJSON<T = any>(relativePath: string): Promise<T> {
    const content = await this.readFile(relativePath);
    return JSON.parse(content);
  }

  /**
   * ファイルとStateの整合性を検証
   */
  async verifyFileStateConsistency(
    state: ParallelDevStateType,
    verbose: boolean = false
  ): Promise<{
    consistent: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // tasksとtasks.jsonの整合性チェック
    if (state.tasks && state.tasks.length > 0) {
      const tasksPath = '.kugutsu/product-backlog/backlog.json';
      const fileExists = await this.verifyFileExists(tasksPath);

      if (!fileExists) {
        issues.push(`Tasks in state but file not found: ${tasksPath}`);
      } else {
        const fileData = await this.readJSON<{ tasks: any[] }>(tasksPath);
        if (fileData.tasks.length !== state.tasks.length) {
          issues.push(
            `Task count mismatch: State=${state.tasks.length}, File=${fileData.tasks.length}`
          );
        }
      }
    }

    // requirementsPathの整合性チェック
    if (state.requirementsPath) {
      const exists = await this.verifyFileExists(state.requirementsPath);
      if (!exists) {
        issues.push(`Requirements path in state but file not found: ${state.requirementsPath}`);
      }
    }

    const consistent = issues.length === 0;

    if (verbose) {
      if (consistent) {
        console.log('\n✅ File-State consistency verified');
      } else {
        console.log('\n⚠️  File-State consistency issues:');
        issues.forEach((issue) => console.log(`  - ${issue}`));
      }
    }

    return {
      consistent,
      issues,
    };
  }

  /**
   * クリーンアップ（テスト後）
   */
  async cleanup(verbose: boolean = false): Promise<void> {
    if (verbose) {
      console.log(`\n🧹 Cleaning up: ${this.testDir}`);
    }

    try {
      await fs.rm(this.testDir, { recursive: true, force: true });
      if (verbose) {
        console.log('✅ Cleanup complete\n');
      }
    } catch (error) {
      console.warn(`⚠️  Cleanup failed: ${error}`);
    }
  }
}
