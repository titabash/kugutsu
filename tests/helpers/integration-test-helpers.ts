/**
 * Integration Test Helper Functions
 *
 * Provides common utilities for complex workflow integration tests
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import type { TaskArtifact, TechStack, Requirements } from '../../src/types/artifacts.js';
import type { Task, TaskStatus } from '../../src/graph/types.js';
import type { MockAIProvider } from '../../src/providers/MockAIProvider.js';
import { createMockMessage } from '../../src/providers/MockAIProvider.js';

/**
 * Test Environment Setup
 */
export interface TestEnvironment {
  tempDir: string;
  kugutsuDir: string;
  originalCwd: string;
  cleanup: () => Promise<void>;
}

/**
 * Setup test environment with temp directory and cleanup
 */
export async function setupTestEnvironment(prefix = 'integration-test-'): Promise<TestEnvironment> {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(path.join(tmpdir(), prefix));
  const kugutsuDir = path.join(tempDir, '.kugutsu');

  // Create .kugutsu directory structure
  await fs.mkdir(kugutsuDir, { recursive: true });

  const cleanup = async () => {
    process.chdir(originalCwd);
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors (directory may still be in use)
      console.warn(`⚠️ Cleanup warning: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return {
    tempDir,
    kugutsuDir,
    originalCwd,
    cleanup,
  };
}

/**
 * Task Creation Helpers
 */

/**
 * Create a task artifact with dependencies
 */
export function createTaskWithDependencies(
  id: string,
  title: string,
  description: string,
  dependencies: string[] = [],
  priority = 100
): TaskArtifact {
  return {
    id,
    title,
    description,
    priority,
    dependencies,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Create multiple tasks with dependency graph
 */
export function createTaskGraph(tasks: Array<{
  id: string;
  title: string;
  description: string;
  dependencies?: string[];
  priority?: number;
}>): TaskArtifact[] {
  return tasks.map((task) =>
    createTaskWithDependencies(
      task.id,
      task.title,
      task.description,
      task.dependencies || [],
      task.priority || 100
    )
  );
}

/**
 * Create task directories in .kugutsu/tasks/
 */
export async function createTaskDirectories(
  kugutsuDir: string,
  taskIds: string[]
): Promise<void> {
  for (const taskId of taskIds) {
    await fs.mkdir(path.join(kugutsuDir, 'tasks', taskId), { recursive: true });
  }
}

/**
 * Create instruction.md for a task
 */
export async function createTaskInstruction(
  kugutsuDir: string,
  taskId: string,
  title: string,
  description: string,
  additionalInstructions?: string
): Promise<void> {
  const instructionPath = path.join(kugutsuDir, 'tasks', taskId, 'instruction.md');
  const content = `# Task: ${title}

## Description
${description}

${additionalInstructions || ''}

## Test-Driven Development
1. Write tests first
2. Implement code to pass tests
3. Refactor as needed
`;

  await fs.writeFile(instructionPath, content, 'utf-8');
}

/**
 * Mock Response Helpers
 */

/**
 * Create ProductOwner mock responses (tech-stack, requirements, tasks)
 */
export function createProductOwnerMockResponses(
  mockProvider: MockAIProvider,
  kugutsuDir: string,
  tasks: TaskArtifact[],
  techStack?: Partial<TechStack>,
  requirements?: Partial<Requirements>
): void {
  const defaultTechStack: TechStack = {
    languages: ['TypeScript'],
    frameworks: ['Node.js'],
    buildTools: ['npm'],
    testingFrameworks: ['Jest'],
    projectType: 'web-app',
    ...techStack,
  };

  const defaultRequirements: Requirements = {
    functional: tasks.map((t) => t.title),
    nonFunctional: [],
    constraints: [],
    ...requirements,
  };

  // Phase 1: Tech Stack Analysis
  mockProvider.setMockResponse(/tech.*stack/i, {
    messages: [
      createMockMessage.assistant('Analyzing tech stack...'),
      createMockMessage.system({
        toolUse: {
          tool: 'Write',
          arguments: {
            file_path: path.join(kugutsuDir, 'tech-stack.json'),
            content: JSON.stringify(defaultTechStack, null, 2),
          },
        },
      }),
      createMockMessage.result(true),
    ],
    simulateTools: true,
  });

  // Phase 2: Requirements Analysis
  mockProvider.setMockResponse(/requirements/i, {
    messages: [
      createMockMessage.assistant('Analyzing requirements...'),
      createMockMessage.system({
        toolUse: {
          tool: 'Write',
          arguments: {
            file_path: path.join(kugutsuDir, 'requirements.json'),
            content: JSON.stringify(defaultRequirements, null, 2),
          },
        },
      }),
      createMockMessage.result(true),
    ],
    simulateTools: true,
  });

  // Phase 3: Task Generation
  const taskMessages = [
    createMockMessage.assistant('Generating tasks...'),
    createMockMessage.system({
      toolUse: {
        tool: 'Write',
        arguments: {
          file_path: path.join(kugutsuDir, 'tasks.json'),
          content: JSON.stringify(tasks, null, 2),
        },
      },
    }),
  ];

  // Add instruction.md creation for each task
  for (const task of tasks) {
    taskMessages.push(
      createMockMessage.system({
        toolUse: {
          tool: 'Write',
          arguments: {
            file_path: path.join(kugutsuDir, 'tasks', task.id, 'instruction.md'),
            content: `# Task: ${task.title}\n\n${task.description}`,
          },
        },
      })
    );
  }

  taskMessages.push(createMockMessage.result(true));

  mockProvider.setMockResponse(/task.*generation/i, {
    messages: taskMessages,
    simulateTools: true,
  });
}

/**
 * Create Engineer mock response with delay
 */
export function createEngineerMockResponse(
  sessionId: string,
  delay = 100
): any {
  return {
    messages: [
      createMockMessage.assistant('実装中...', sessionId),
      {
        type: 'result' as const,
        content: {
          duration: delay,
          tokenUsage: { input: 10, output: 20, total: 30 },
          cost: 0.001,
          permissionDenials: 0,
          success: true,
        },
        session_id: sessionId,
        timestamp: new Date(),
      },
    ],
    delay,
  };
}

/**
 * Create Review mock response
 */
export function createReviewMockResponse(
  kugutsuDir: string,
  taskId: string,
  status: 'approved' | 'changes_requested',
  comments: string[] = []
): any {
  const reviewStatus = status === 'approved' ? 'APPROVED' : 'CHANGES_REQUESTED';

  // Create separate assistant messages for each comment
  // ReviewNode collects each assistant message as a separate comment
  const messages: any[] = [];

  if (status === 'approved') {
    // For approved reviews, send a single message
    messages.push(createMockMessage.assistant('REVIEW_STATUS: APPROVED\n\nコードは良好です。'));
  } else {
    // For changes_requested, send each comment as a separate message
    // Include CHANGES_REQUESTED keyword in the first comment for status detection
    if (comments.length > 0) {
      comments.forEach((comment, index) => {
        // Add CHANGES_REQUESTED to the first comment so ReviewNode detects the status
        const commentText = index === 0
          ? `CHANGES_REQUESTED: ${comment}`
          : comment;
        messages.push(createMockMessage.assistant(commentText));
      });
    } else {
      // If no comments provided, send a default message with CHANGES_REQUESTED
      messages.push(createMockMessage.assistant('CHANGES_REQUESTED: 修正が必要です。'));
    }
  }

  // Add Write tool operation for review.json
  messages.push(
    createMockMessage.system({
      toolUse: {
        tool: 'Write',
        arguments: {
          file_path: path.join(kugutsuDir, 'tasks', taskId, 'review.json'),
          content: JSON.stringify(
            {
              taskId,
              status,
              reviewedBy: 'TechLeadAI',
              reviewedAt: new Date().toISOString(),
              comments,
              summary: `レビュー結果: ${status}`,
              suggestions: comments,
            },
            null,
            2
          ),
        },
      },
    })
  );

  messages.push(createMockMessage.result(true));

  return {
    messages,
    simulateTools: true,
  };
}

/**
 * Create ConflictResolver mock response
 */
export function createConflictResolverMockResponse(
  sessionId: string,
  conflictFiles: string[],
  resolution: string
): any {
  return {
    messages: [
      createMockMessage.assistant(
        `コンフリクトを解消します: ${conflictFiles.join(', ')}`,
        sessionId
      ),
      createMockMessage.assistant(`解消策: ${resolution}`, sessionId),
      createMockMessage.result(true),
    ],
    delay: 100,
  };
}

/**
 * Assertion Helpers
 */

/**
 * Assert task states match expected values
 */
export function assertTaskStateMachine(
  tasks: Task[],
  expectedStates: Record<string, TaskStatus>
): void {
  for (const [taskId, expectedStatus] of Object.entries(expectedStates)) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found in state`);
    }
    if (task.status !== expectedStatus) {
      throw new Error(
        `Task ${taskId} expected status ${expectedStatus}, got ${task.status}`
      );
    }
  }
}

/**
 * Assert dependency resolution order
 */
export function assertDependencyResolution(
  executionOrder: string[],
  dependencies: Record<string, string[]>
): void {
  const executed = new Set<string>();

  for (const taskId of executionOrder) {
    const deps = dependencies[taskId] || [];

    // All dependencies must be executed before this task
    for (const dep of deps) {
      if (!executed.has(dep)) {
        throw new Error(
          `Dependency violation: ${taskId} executed before its dependency ${dep}`
        );
      }
    }

    executed.add(taskId);
  }
}

/**
 * Assert parallel execution (tasks started within threshold)
 */
export function assertParallelExecution(
  timestamps: Record<string, Date>,
  parallelGroups: string[][],
  thresholdMs = 50
): void {
  for (const group of parallelGroups) {
    if (group.length < 2) continue;

    const times = group.map((taskId) => {
      const time = timestamps[taskId];
      if (!time) {
        throw new Error(`No timestamp found for task ${taskId}`);
      }
      return time.getTime();
    });

    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const diff = maxTime - minTime;

    if (diff > thresholdMs) {
      throw new Error(
        `Tasks ${group.join(', ')} should execute in parallel but have ${diff}ms difference (threshold: ${thresholdMs}ms)`
      );
    }
  }
}

/**
 * Simulate git merge conflict
 */
export async function simulateConflict(
  tempDir: string,
  filePath: string,
  task1Changes: string,
  task2Changes: string
): Promise<void> {
  const fullPath = path.join(tempDir, filePath);

  // Ensure directory exists
  await fs.mkdir(path.dirname(fullPath), { recursive: true });

  // Create conflict markers
  const conflictContent = `
<<<<<<< HEAD
${task1Changes}
=======
${task2Changes}
>>>>>>> ${filePath.replace('/', '-')}
`;

  await fs.writeFile(fullPath, conflictContent, 'utf-8');
}

/**
 * Extract execution order from graph events
 */
export function extractExecutionOrder(events: any[]): string[] {
  const order: string[] = [];

  for (const event of events) {
    if ('engineer' in event && event.engineer.tasks) {
      for (const task of event.engineer.tasks) {
        if (task.status === 'in_review' && !order.includes(task.id)) {
          order.push(task.id);
        }
      }
    }
  }

  return order;
}

/**
 * Extract timestamps from events
 */
export function extractTimestamps(events: any[]): Record<string, Date> {
  const timestamps: Record<string, Date> = {};

  for (const event of events) {
    if ('engineer' in event && event.engineer.logs) {
      for (const log of event.engineer.logs) {
        if (log.message.includes('実装が完了') && log.taskId) {
          if (!timestamps[log.taskId]) {
            timestamps[log.taskId] = log.timestamp;
          }
        }
      }
    }
  }

  return timestamps;
}

/**
 * Count tasks by status
 */
export function countTasksByStatus(tasks: Task[]): Record<TaskStatus, number> {
  const counts: Record<string, number> = {
    pending: 0,
    ready: 0,
    in_progress: 0,
    in_review: 0,
    completed: 0,
    failed: 0,
  };

  for (const task of tasks) {
    counts[task.status] = (counts[task.status] || 0) + 1;
  }

  return counts as Record<TaskStatus, number>;
}

/**
 * Find tasks by status
 */
export function findTasksByStatus(tasks: Task[], status: TaskStatus): Task[] {
  return tasks.filter((t) => t.status === status);
}

/**
 * Verify all tasks completed
 */
export function assertAllTasksCompleted(tasks: Task[]): void {
  const incomplete = tasks.filter((t) => t.status !== 'completed');
  if (incomplete.length > 0) {
    throw new Error(
      `Expected all tasks to be completed, but ${incomplete.length} tasks are not: ${incomplete.map((t) => `${t.id} (${t.status})`).join(', ')}`
    );
  }
}

/**
 * Create default mock responses for all workflow nodes
 */
export async function setupDefaultMockResponses(
  mockProvider: MockAIProvider,
  env: TestEnvironment,
  tasks: TaskArtifact[]
): Promise<void> {
  // ProductOwner responses
  createProductOwnerMockResponses(mockProvider, env.kugutsuDir, tasks);

  // Create task directories and instructions
  await createTaskDirectories(
    env.kugutsuDir,
    tasks.map((t) => t.id)
  );

  for (const task of tasks) {
    await createTaskInstruction(env.kugutsuDir, task.id, task.title, task.description);
  }

  // Default Engineer response (for all tasks)
  const SESSION_ID = 'session-test';
  mockProvider.setDefaultResponse(createEngineerMockResponse(SESSION_ID, 100));

  // Default Review response (all approved)
  mockProvider.setMockResponse(/Review/i, {
    messages: [
      createMockMessage.assistant('REVIEW_STATUS: APPROVED\n\nコードは良好です。'),
    ],
    simulateTools: false,
  });
}
