/**
 * TestRunnerNode
 *
 * Preset AI node for running tests.
 * Supports multiple test frameworks with coverage collection.
 */

import {
  BaseWorkflowNode,
  type NodeConfig,
  type ExecutionContext,
  type NodeResult,
  type ValidationResult,
} from '../BaseWorkflowNode.js';
import type { AIConfig, RetryPolicy } from '../../types.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default system prompt for test runner tasks
 */
const DEFAULT_SYSTEM_PROMPT = `You are an expert test runner with deep knowledge of testing frameworks, test automation, and quality assurance.

Your responsibilities:
- Execute tests using the appropriate test framework
- Analyze test results and identify failures
- Collect and report code coverage when requested
- Identify flaky tests and suggest fixes
- Provide clear summaries of test outcomes

Guidelines:
- Run the specified test command
- Parse and summarize the test output
- Report the number of passed, failed, and skipped tests
- Include error messages and stack traces for failed tests
- Report coverage percentages when available
- Suggest fixes for failing tests when possible`;

/**
 * Default allowed tools for test execution
 */
const DEFAULT_ALLOWED_TOOLS = [
  'Bash',
  'Read',
  'Glob',
  'Grep',
];

/**
 * Default maximum turns for test execution
 */
const DEFAULT_MAX_TURNS = 15;

/**
 * Default test commands by framework
 */
const DEFAULT_TEST_COMMANDS: Record<string, string> = {
  jest: 'npm test',
  vitest: 'npm run test',
  mocha: 'npm run test:mocha',
  custom: 'npm test',
};

// ============================================================================
// Types
// ============================================================================

/**
 * Test framework options
 */
export type TestFramework = 'jest' | 'vitest' | 'mocha' | 'custom';

/**
 * TestRunnerNode configuration
 */
export interface TestRunnerNodeConfig extends NodeConfig {
  /** Custom label for the node */
  label?: string;
  /** AI configuration */
  ai?: AIConfig;
  /** Retry policy */
  retryPolicy?: RetryPolicy;
  /** Test framework */
  testFramework?: TestFramework;
  /** Default test command */
  defaultTestCommand?: string;
  /** Collect code coverage */
  collectCoverage?: boolean;
  /** Coverage threshold (0-100) */
  coverageThreshold?: number;
  /** Test timeout in milliseconds */
  timeout?: number;
}

/**
 * Test results structure
 */
export interface TestResults {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  failedTests?: FailedTest[];
}

/**
 * Failed test info
 */
export interface FailedTest {
  name: string;
  file: string;
  error?: string;
  stackTrace?: string;
}

/**
 * Coverage information
 */
export interface CoverageInfo {
  lines: number;
  statements: number;
  functions: number;
  branches: number;
}

// ============================================================================
// TestRunnerNode
// ============================================================================

/**
 * TestRunnerNode - Preset node for running tests
 *
 * Features:
 * - Multiple test framework support
 * - Targeted test execution
 * - Coverage collection and threshold checking
 * - Specialized event emission
 */
export class TestRunnerNode extends BaseWorkflowNode {
  declare config: TestRunnerNodeConfig;

  constructor(id: string, config: TestRunnerNodeConfig = {}) {
    const framework = config.testFramework ?? 'jest';

    // Merge AI config with defaults
    const aiConfig: AIConfig = {
      provider: config.ai?.provider ?? 'auto',
      model: config.ai?.model,
      systemPrompt: config.ai?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      maxTurns: config.ai?.maxTurns ?? DEFAULT_MAX_TURNS,
      allowedTools: config.ai?.allowedTools ?? DEFAULT_ALLOWED_TOOLS,
      temperature: config.ai?.temperature,
      topP: config.ai?.topP,
    };

    super({
      id,
      type: 'preset:test-runner',
      label: config.label ?? 'Test Runner',
      description: 'Run tests and collect results with optional coverage',
      inputs: [
        {
          id: 'testCommand',
          name: 'Test Command',
          type: 'data',
          dataType: 'string',
          required: false,
        },
        {
          id: 'targetPaths',
          name: 'Target Paths',
          type: 'data',
          dataType: 'array',
          required: false,
        },
        {
          id: 'changedFiles',
          name: 'Changed Files',
          type: 'data',
          dataType: 'array',
          required: false,
        },
      ],
      outputs: [
        {
          id: 'testResults',
          name: 'Test Results',
          type: 'data',
          dataType: 'object',
          required: true,
        },
        {
          id: 'coverage',
          name: 'Coverage',
          type: 'data',
          dataType: 'object',
          required: false,
        },
        {
          id: 'passed',
          name: 'Passed',
          type: 'data',
          dataType: 'boolean',
          required: true,
        },
      ],
      config: {
        ai: aiConfig,
        retryPolicy: config.retryPolicy,
        testFramework: framework,
        defaultTestCommand: config.defaultTestCommand ?? DEFAULT_TEST_COMMANDS[framework],
        collectCoverage: config.collectCoverage ?? false,
        coverageThreshold: config.coverageThreshold,
        timeout: config.timeout,
        ...config,
      },
    });
  }

  /**
   * Validate node configuration
   */
  validate(): ValidationResult {
    const baseResult = super.validate();
    const errors = [...baseResult.errors];

    // Validate test framework
    const validFrameworks: TestFramework[] = ['jest', 'vitest', 'mocha', 'custom'];
    if (this.config.testFramework && !validFrameworks.includes(this.config.testFramework)) {
      errors.push('testFramework must be one of: jest, vitest, mocha, custom');
    }

    // Validate coverage threshold
    if (this.config.coverageThreshold !== undefined) {
      if (this.config.coverageThreshold < 0 || this.config.coverageThreshold > 100) {
        errors.push('coverageThreshold must be between 0 and 100');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Build the prompt for test execution
   */
  private buildPrompt(
    testCommand: string,
    targetPaths: string[] | undefined,
    changedFiles: string[] | undefined
  ): string {
    let prompt = `## Test Execution

**Test Command:** \`${testCommand}\`
`;

    if (targetPaths && targetPaths.length > 0) {
      prompt += `\n**Target Paths:**\n${targetPaths.map(p => `- ${p}`).join('\n')}\n`;
    }

    if (changedFiles && changedFiles.length > 0) {
      prompt += `\n**Changed Files:**\n${changedFiles.map(f => `- ${f}`).join('\n')}\n`;
    }

    if (this.config.collectCoverage) {
      prompt += `\n**Coverage:** Please collect and report code coverage.\n`;
    }

    prompt += `
## Instructions

1. Run the test command: \`${testCommand}\`
2. Parse the test output to extract:
   - Total number of tests
   - Number of passed tests
   - Number of failed tests
   - Number of skipped tests
   - Details of any failed tests (name, file, error)
${this.config.collectCoverage ? '3. Extract coverage information (lines, statements, functions, branches)\n' : ''}
Please respond with a JSON object containing:
- testResults: { total, passed, failed, skipped, failedTests?: [...] }
${this.config.collectCoverage ? '- coverage: { lines, statements, functions, branches }' : ''}`;

    return prompt;
  }

  /**
   * Execute test runner
   */
  async execute(context: ExecutionContext): Promise<NodeResult> {
    const startTime = Date.now();
    const testCommand = (context.inputs.testCommand as string) || this.config.defaultTestCommand;
    const targetPaths = context.inputs.targetPaths as string[] | undefined;
    const changedFiles = context.inputs.changedFiles as string[] | undefined;

    // Emit start event
    context.utils.emit('test-runner-started', {
      nodeId: this.id,
      nodeType: this.type,
      testCommand,
    });

    try {
      const prompt = this.buildPrompt(testCommand!, targetPaths, changedFiles);
      const aiConfig = this.config.ai!;

      const response = await this.executeWithRetry(context, prompt, aiConfig);
      const result = response.finalState as {
        testResults?: TestResults;
        coverage?: CoverageInfo;
      };

      const testResults = result.testResults ?? {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
      };

      const coverage = result.coverage;

      // Determine if tests passed
      let passed = testResults.failed === 0;

      // Check coverage threshold if configured
      if (passed && this.config.collectCoverage && this.config.coverageThreshold !== undefined && coverage) {
        const avgCoverage = (coverage.lines + coverage.statements + coverage.functions + coverage.branches) / 4;
        if (avgCoverage < this.config.coverageThreshold) {
          passed = false;
          context.utils.logger.warn(
            `TestRunnerNode ${this.id}: Coverage ${avgCoverage.toFixed(1)}% below threshold ${this.config.coverageThreshold}%`
          );
        }
      }

      // Emit appropriate event
      if (testResults.failed > 0) {
        context.utils.emit('tests-failed', {
          nodeId: this.id,
          failedCount: testResults.failed,
          failedTests: testResults.failedTests,
        });
      } else {
        context.utils.emit('tests-passed', {
          nodeId: this.id,
          passedCount: testResults.passed,
          totalCount: testResults.total,
        });
      }

      // Emit completion event
      context.utils.emit('test-runner-completed', {
        nodeId: this.id,
        success: true,
        passed,
        testResults,
      });

      return {
        success: true,
        outputs: {
          testResults,
          coverage: coverage ?? null,
          passed,
        },
        metadata: {
          duration: Date.now() - startTime,
          testCount: testResults.total,
          aiCalls: 1,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      context.utils.logger.error(`TestRunnerNode ${this.id} failed: ${errorMessage}`);
      context.utils.emit('test-runner-error', {
        nodeId: this.id,
        error: errorMessage,
      });

      return {
        success: false,
        outputs: {
          passed: false,
        },
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          duration: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Execute AI query with retry logic
   */
  private async executeWithRetry(
    context: ExecutionContext,
    prompt: string,
    aiConfig: AIConfig
  ): Promise<{
    finalState: unknown;
    duration: number;
    turns: number;
    tokensUsed?: number;
  }> {
    const retryPolicy = this.config.retryPolicy;
    const maxRetries = retryPolicy?.maxRetries ?? 0;
    const retryDelay = retryPolicy?.retryDelay ?? 1000;
    const exponentialBackoff = retryPolicy?.exponentialBackoff ?? false;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await context.services.aiProvider.query({
          prompt,
          options: {
            model: aiConfig.model,
            systemPrompt: aiConfig.systemPrompt,
            maxTurns: aiConfig.maxTurns,
            allowedTools: aiConfig.allowedTools,
            temperature: aiConfig.temperature,
            topP: aiConfig.topP,
          },
        });

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          context.utils.logger.warn(
            `TestRunnerNode ${this.id}: Attempt ${attempt + 1} failed, retrying...`,
            lastError.message
          );

          const delay = exponentialBackoff
            ? retryDelay * Math.pow(2, attempt)
            : retryDelay;

          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new Error('AI execution failed');
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create TestRunnerNode from JSON
   */
  static createFromJSON(json: {
    id: string;
    type: 'preset:test-runner';
    label: string;
    position: { x: number; y: number };
    inputs: unknown[];
    outputs: unknown[];
    config: TestRunnerNodeConfig;
  }): TestRunnerNode {
    const node = new TestRunnerNode(json.id, {
      ...json.config,
      label: json.label,
    });
    node.setPosition(json.position.x, json.position.y);
    return node;
  }
}

export default TestRunnerNode;
