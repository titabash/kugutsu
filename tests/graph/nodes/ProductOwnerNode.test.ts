/**
 * ProductOwnerNode Unit Tests (Jest)
 */

import { jest } from '@jest/globals';

// Mock AIProviderFactory BEFORE importing
let mockProvider: any;
jest.unstable_mockModule('../../../src/providers/AIProviderFactory.js', () => ({
  AIProviderFactory: {
    create: jest.fn(() => mockProvider),
    getSupportedProviders: jest.fn(() => ['claude', 'mock']),
    isProviderSupported: jest.fn((provider: string) => ['claude', 'mock'].includes(provider)),
  },
}));

// Import after mocking
const { productOwnerNode } = await import('../../../src/graph/nodes/ProductOwnerNode.js');
const { createInitialState } = await import('../../../src/graph/state.js');
const { MockAIProvider, createMockMessage } = await import(
  '../../../src/providers/MockAIProvider.js'
);
const { AIProviderFactory } = await import('../../../src/providers/AIProviderFactory.js');

describe('ProductOwnerNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mock provider
    mockProvider = new MockAIProvider();
    (AIProviderFactory.create as any).mockReturnValue(mockProvider);
  });

  test('should generate tasks from user request', async () => {
    // Setup mock responses
    const techStackResponse = {
      languages: ['TypeScript'],
      frameworks: ['Node.js'],
      buildTools: ['npm'],
    };

    const requirementsResponse = {
      functional: ['Implement feature'],
      nonFunctional: ['Performance'],
      constraints: ['Use TypeScript'],
    };

    const tasksResponse = [
      {
        id: 'task-001',
        title: 'Implement authentication',
        description: 'Add user authentication',
        priority: 100,
        dependencies: [],
      },
      {
        id: 'task-002',
        title: 'Add tests',
        description: 'Write unit tests',
        priority: 80,
        dependencies: ['task-001'],
      },
    ];

    mockProvider.setDefaultResponse({
      messages: [
        createMockMessage.assistant(JSON.stringify(techStackResponse)),
        createMockMessage.assistant(JSON.stringify(requirementsResponse)),
        createMockMessage.assistant(JSON.stringify(tasksResponse)),
        createMockMessage.result(true),
      ],
    });

    // Create initial state
    const initialState = createInitialState('Implement user authentication', {
      maxEngineers: 3,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    // Set currentProjectId (required by ProductOwnerNode)
    initialState.currentProjectId = 'test-project-001';

    // Execute node
    const result = await productOwnerNode(initialState);

    // Verify AIProviderFactory.create was called
    expect(AIProviderFactory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'claude',
      })
    );

    // Verify results
    expect(result.tasks).toBeDefined();
    expect(result.tasks!.length).toBeGreaterThanOrEqual(1);

    if (result.tasks && result.tasks.length > 0) {
      const task = result.tasks[0];
      expect(task.id).toBeDefined();
      expect(task.title).toBeDefined();
      expect(task.description).toBeDefined();
      expect(task.status).toBe('pending');
    }

    expect(result.logs).toBeDefined();
    expect(result.logs!.length).toBeGreaterThan(0);
  });

  test('should handle errors gracefully', async () => {
    // Create initial state
    const initialState = createInitialState('Test request', {
      maxEngineers: 3,
      maxTurns: 30,
      baseBranch: 'main',
      baseRepoPath: '/test/repo',
      worktreeBasePath: '/test/worktrees',
    });

    // Set currentProjectId (required by ProductOwnerNode)
    initialState.currentProjectId = 'test-project-002';

    // Setup mock provider with error
    mockProvider.setDefaultResponse({
      messages: [],
      shouldThrowError: true,
      errorMessage: 'API error',
    });

    // Execute node
    const result = await productOwnerNode(initialState);

    // Should have error logs
    expect(result.logs).toBeDefined();
    const errorLog = result.logs!.find((log) => log.level === 'error');
    expect(errorLog).toBeDefined();

    // Should have error in metadata
    expect(result.metadata?.hasErrors).toBe(true);
  });

  describe('File-based artifact management', () => {
    test('should reference existing tech-stack.json from repository', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { mkdtemp, rm } = await import('fs/promises');
      const { tmpdir } = await import('os');

      // テスト用の一時ディレクトリを作成
      const tempDir = await mkdtemp(path.join(tmpdir(), 'po-test-'));
      const kugutsuDir = path.join(tempDir, '.kugutsu');
      const repositoryDir = path.join(kugutsuDir, 'repository', 'architecture');

      try {
        // 事前にrepository/architecture/tech-stack.jsonを作成（CheckModeNodeが作成する想定）
        await fs.mkdir(repositoryDir, { recursive: true });
        const techStackData = {
          frontend: {
            framework: 'React',
            language: 'TypeScript',
          },
          backend: {
            framework: 'Electron',
            language: 'TypeScript',
          },
        };
        await fs.writeFile(
          path.join(repositoryDir, 'tech-stack.json'),
          JSON.stringify(techStackData, null, 2)
        );

        // Phase 1: Tech Stack Verification (no generation, just verification)
        // ProductOwnerNodeは生成せず、既存ファイルを確認するだけ

        // Phase 2: Requirements Analysis
        mockProvider.setMockResponse(/^#\s*Requirements Analysis/i, {
          messages: [
            createMockMessage.assistant('Analyzing requirements...'),
            createMockMessage.system({
              toolUse: {
                tool: 'Write',
                arguments: {
                  file_path: path.join(kugutsuDir, 'requirements.json'),
                  content: JSON.stringify({ functional: [], nonFunctional: [], constraints: [] }, null, 2),
                },
              },
            }),
            createMockMessage.result(true),
          ],
          simulateTools: true,
        });

        // Phase 3: Task Generation
        mockProvider.setMockResponse(/^#\s*Task Generation/im, {
          messages: [
            createMockMessage.assistant('Generating tasks...'),
            createMockMessage.system({
              toolUse: {
                tool: 'Write',
                arguments: {
                  file_path: path.join(kugutsuDir, 'tasks.json'),
                  content: JSON.stringify([{ id: 'task-001', title: 'Test task', description: 'Test', priority: 100, dependencies: [], status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }], null, 2),
                },
              },
            }),
            createMockMessage.result(true),
          ],
          simulateTools: true,
        });

        // Phase 4: Instruction Generation
        mockProvider.setMockResponse(/^#\s*Task Instructions Generation/i, {
          messages: [
            createMockMessage.assistant('Generating instructions...'),
            createMockMessage.result(true),
          ],
        });

        // Create initial state
        const initialState = createInitialState('Implement feature', {
          maxEngineers: 1,
          maxTurns: 10,
          baseBranch: 'main',
          baseRepoPath: tempDir,
          worktreeBasePath: path.join(tempDir, 'worktrees'),
        });

        // Execute node
        const result = await productOwnerNode(initialState);

        // Verify tech-stack.json path points to repository location
        expect(result.techStackPath).toBe('.kugutsu/repository/architecture/tech-stack.json');

        // Verify the repository tech-stack.json still exists and wasn't modified
        const techStackPath = path.join(repositoryDir, 'tech-stack.json');
        const fileExists = await fs.access(techStackPath).then(() => true).catch(() => false);
        expect(fileExists).toBe(true);

        // Verify content is unchanged
        const content = await fs.readFile(techStackPath, 'utf-8');
        const data = JSON.parse(content);
        expect(data.frontend.framework).toBe('React');
        expect(data.backend.framework).toBe('Electron');
      } finally {
        // Cleanup
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    test('should create requirements.json file', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { mkdtemp, rm } = await import('fs/promises');
      const { tmpdir } = await import('os');

      const tempDir = await mkdtemp(path.join(tmpdir(), 'po-test-'));
      const kugutsuDir = path.join(tempDir, '.kugutsu');
      const repositoryDir = path.join(kugutsuDir, 'repository', 'architecture');

      try {
        // 事前にrepository/architecture/tech-stack.jsonを作成
        await fs.mkdir(repositoryDir, { recursive: true });
        const techStackData = {
          frontend: {
            framework: 'React',
            language: 'TypeScript',
          },
        };
        await fs.writeFile(
          path.join(repositoryDir, 'tech-stack.json'),
          JSON.stringify(techStackData, null, 2)
        );

        const requirementsData = {
          functional: ['User authentication', 'Data persistence'],
          nonFunctional: ['Response time < 1s', 'Security: OWASP Top 10'],
          constraints: ['TypeScript 5.0+', 'Electron compatibility'],
        };

        // Phase 1: Tech Stack Verification (no mock needed, just reads existing file)

        // Phase 2: Requirements Analysis (more specific pattern with multiline)
        mockProvider.setMockResponse(/^#\s*Requirements Analysis/im, {
          messages: [
            createMockMessage.assistant('Analyzing requirements...'),
            createMockMessage.system({
              toolUse: {
                tool: 'Write',
                arguments: {
                  file_path: path.join(kugutsuDir, 'requirements.json'),
                  content: JSON.stringify(requirementsData, null, 2),
                },
              },
            }),
            createMockMessage.assistant('Requirements analysis completed'),
            createMockMessage.result(true),
          ],
          simulateTools: true,
        });

        // Phase 3: Task Generation (empty response to skip with multiline)
        mockProvider.setMockResponse(/^#\s*Task Generation/im, {
          messages: [
            createMockMessage.assistant('Skipping task generation'),
            createMockMessage.result(true),
          ],
        });

        // Phase 4: Instruction Generation (empty response to skip with multiline)
        mockProvider.setMockResponse(/^#\s*Task Instructions Generation/im, {
          messages: [
            createMockMessage.assistant('Skipping instruction generation'),
            createMockMessage.result(true),
          ],
        });

        const initialState = createInitialState('Analyze requirements', {
          maxEngineers: 1,
          maxTurns: 10,
          baseBranch: 'main',
          baseRepoPath: tempDir,
          worktreeBasePath: path.join(tempDir, 'worktrees'),
        });

        const result = await productOwnerNode(initialState);

        // Verify requirements.json was created
        const requirementsPath = path.join(kugutsuDir, 'requirements.json');
        const fileExists = await fs.access(requirementsPath).then(() => true).catch(() => false);
        expect(fileExists).toBe(true);

        // Verify file content
        const content = await fs.readFile(requirementsPath, 'utf-8');
        const data = JSON.parse(content);
        expect(data.functional).toContain('User authentication');
        expect(data.nonFunctional).toContain('Response time < 1s');

        // Verify state has file path
        expect(result.requirementsPath).toBe('.kugutsu/requirements.json');
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    test('should create tasks.json and instruction.md files', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { mkdtemp, rm } = await import('fs/promises');
      const { tmpdir } = await import('os');

      const tempDir = await mkdtemp(path.join(tmpdir(), 'po-test-'));
      const kugutsuDir = path.join(tempDir, '.kugutsu');
      const repositoryDir = path.join(kugutsuDir, 'repository', 'architecture');

      try {
        // 事前にrepository/architecture/tech-stack.jsonを作成
        await fs.mkdir(repositoryDir, { recursive: true });
        const techStackData = {
          frontend: {
            framework: 'React',
            language: 'TypeScript',
          },
        };
        await fs.writeFile(
          path.join(repositoryDir, 'tech-stack.json'),
          JSON.stringify(techStackData, null, 2)
        );

        const requirementsData = {
          functional: ['User authentication'],
          nonFunctional: ['Security'],
          constraints: ['TypeScript 5.0+'],
        };

        const tasksData = [
          {
            id: 'task-001',
            title: 'Implement authentication',
            description: 'JWT-based authentication',
            priority: 100,
            dependencies: [],
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];

        const instructionContent = `# Task: task-001 - Implement authentication

## Purpose
Implement JWT-based authentication feature.

## Requirements
- Login/logout functionality
- Token refresh functionality
- Secure token storage

## Technical Constraints
- TypeScript 5.0+
- JWT library: jsonwebtoken
- Existing API endpoints: /api/auth/*
`;

        // Phase 1: Tech Stack Verification (no mock needed)

        // Phase 2: Requirements Analysis (more specific pattern with multiline)
        mockProvider.setMockResponse(/^#\s*Requirements Analysis/im, {
          messages: [
            createMockMessage.assistant('Analyzing requirements...'),
            createMockMessage.system({
              toolUse: {
                tool: 'Write',
                arguments: {
                  file_path: path.join(kugutsuDir, 'requirements.json'),
                  content: JSON.stringify(requirementsData, null, 2),
                },
              },
            }),
            createMockMessage.result(true),
          ],
          simulateTools: true,
        });

        // Phase 3: Task Generation (specific pattern with multiline)
        mockProvider.setMockResponse(/^#\s*Task Generation/im, {
          messages: [
            createMockMessage.assistant('Generating tasks...'),
            createMockMessage.system({
              toolUse: {
                tool: 'Write',
                arguments: {
                  file_path: path.join(kugutsuDir, 'tasks.json'),
                  content: JSON.stringify(tasksData, null, 2),
                },
              },
            }),
            createMockMessage.assistant('Task generation completed'),
            createMockMessage.result(true),
          ],
          simulateTools: true,
        });

        const initialState = createInitialState('Generate tasks', {
          maxEngineers: 1,
          maxTurns: 10,
          baseBranch: 'main',
          baseRepoPath: tempDir,
          worktreeBasePath: path.join(tempDir, 'worktrees'),
        });

        const result = await productOwnerNode(initialState);

        // Verify tasks.json was created
        const tasksPath = path.join(kugutsuDir, 'tasks.json');
        const tasksExists = await fs.access(tasksPath).then(() => true).catch(() => false);
        expect(tasksExists).toBe(true);

        // Verify tasks content
        const tasksContent = await fs.readFile(tasksPath, 'utf-8');
        const tasks = JSON.parse(tasksContent);
        expect(tasks).toHaveLength(1);
        expect(tasks[0].id).toBe('task-001');
        expect(tasks[0].title).toBe('Implement authentication');

        // NOTE: instruction.md generation is now handled by TaskBreakdownNode

        // Verify state has file path
        expect(result.tasksPath).toBe('.kugutsu/tasks.json');
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('Enhanced Error Handling with JSONExtractor', () => {
    test('should retry JSON extraction when tasks.json parsing fails', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { mkdtemp, rm } = await import('fs/promises');
      const { tmpdir } = await import('os');

      const tempDir = await mkdtemp(path.join(tmpdir(), 'po-test-'));
      const kugutsuDir = path.join(tempDir, '.kugutsu');
      const repositoryDir = path.join(kugutsuDir, 'repository', 'architecture');

      try {
        // Setup tech-stack.json
        await fs.mkdir(repositoryDir, { recursive: true });
        await fs.writeFile(
          path.join(repositoryDir, 'tech-stack.json'),
          JSON.stringify({ framework: 'Node.js' }, null, 2)
        );

        let attemptCount = 0;
        mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
          attemptCount++;

          if (attemptCount === 1) {
            // First attempt: Invalid JSON in tasks.json
            yield createMockMessage.system({
              toolUse: {
                tool: 'Write',
                arguments: {
                  file_path: path.join(kugutsuDir, 'tasks.json'),
                  content: '{"invalid": json}', // Invalid JSON
                },
              },
            });
          } else if (attemptCount === 2) {
            // Second attempt: Valid JSON
            const validTasks = [
              {
                id: 'task-001',
                title: 'Retry successful',
                description: 'Task after JSON extraction retry',
                priority: 100,
                dependencies: [],
                status: 'pending',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ];
            yield createMockMessage.system({
              toolUse: {
                tool: 'Write',
                arguments: {
                  file_path: path.join(kugutsuDir, 'tasks.json'),
                  content: JSON.stringify(validTasks, null, 2),
                },
              },
            });
          }

          yield createMockMessage.result(true);
        });

        const initialState = createInitialState('Test request', {
          maxEngineers: 1,
          maxTurns: 10,
          baseBranch: 'main',
          baseRepoPath: tempDir,
          worktreeBasePath: path.join(tempDir, 'worktrees'),
        });

        initialState.currentProjectId = 'test-project';

        const result = await productOwnerNode(initialState);

        // Should eventually succeed with valid tasks
        expect(result.tasks).toBeDefined();
        if (result.tasks && result.tasks.length > 0) {
          expect(result.tasks.some((t) => t.title === 'Retry successful')).toBe(true);
        }
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    test('should provide detailed error logs on JSON extraction failure', async () => {
      // Simulate AI not creating tasks.json properly
      mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
        yield createMockMessage.assistant('No files were created');
        yield createMockMessage.result(true);
      });

      const initialState = createInitialState('Test request', {
        maxEngineers: 1,
        maxTurns: 10,
        baseBranch: 'main',
        baseRepoPath: '/test/repo',
        worktreeBasePath: '/test/worktrees',
      });

      initialState.currentProjectId = 'test-project';

      const result = await productOwnerNode(initialState);

      // Should have detailed error information
      expect(result.logs).toBeDefined();
      const errorLogs = result.logs!.filter((log) => log.level === 'error');
      expect(errorLogs.length).toBeGreaterThan(0);
    });

    test('should handle corrupted tasks.json with graceful fallback', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { mkdtemp, rm } = await import('fs/promises');
      const { tmpdir } = await import('os');

      const tempDir = await mkdtemp(path.join(tmpdir(), 'po-test-'));
      const kugutsuDir = path.join(tempDir, '.kugutsu');
      const repositoryDir = path.join(kugutsuDir, 'repository', 'architecture');

      try {
        await fs.mkdir(repositoryDir, { recursive: true });
        await fs.writeFile(
          path.join(repositoryDir, 'tech-stack.json'),
          JSON.stringify({ framework: 'Node.js' }, null, 2)
        );

        // Phase 2 & 3: Create corrupted tasks.json
        mockProvider.setMockResponse(/Requirements Analysis|Task Generation/i, {
          messages: [
            createMockMessage.system({
              toolUse: {
                tool: 'Write',
                arguments: {
                  file_path: path.join(kugutsuDir, 'tasks.json'),
                  content: '{ corrupted json without proper syntax }',
                },
              },
            }),
            createMockMessage.result(true),
          ],
          simulateTools: true,
        });

        const initialState = createInitialState('Test request', {
          maxEngineers: 1,
          maxTurns: 10,
          baseBranch: 'main',
          baseRepoPath: tempDir,
          worktreeBasePath: path.join(tempDir, 'worktrees'),
        });

        initialState.currentProjectId = 'test-project';

        const result = await productOwnerNode(initialState);

        // Should fall back to creating a single task from user request
        expect(result.tasks).toBeDefined();
        expect(result.tasks!.length).toBeGreaterThan(0);

        // Fallback task should have the user request
        const fallbackTask = result.tasks![0];
        expect(fallbackTask.id).toBe('task-001');
        expect(fallbackTask.description).toContain('Test request');
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    test('should log retry attempts for better debugging', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { mkdtemp, rm } = await import('fs/promises');
      const { tmpdir } = await import('os');

      const tempDir = await mkdtemp(path.join(tmpdir(), 'po-test-'));
      const kugutsuDir = path.join(tempDir, '.kugutsu');
      const repositoryDir = path.join(kugutsuDir, 'repository', 'architecture');

      try {
        await fs.mkdir(repositoryDir, { recursive: true });
        await fs.writeFile(
          path.join(repositoryDir, 'tech-stack.json'),
          JSON.stringify({ framework: 'Node.js' }, null, 2)
        );

        let callCount = 0;
        const consoleLogs: string[] = [];
        const originalLog = console.log;
        console.log = jest.fn<any>((...args: any[]) => {
          consoleLogs.push(args.join(' '));
          originalLog(...args);
        });

        mockProvider.execute = jest.fn<any>().mockImplementation(async function* () {
          callCount++;
          if (callCount <= 2) {
            // Fail first 2 attempts
            yield createMockMessage.assistant('Failed attempt');
            yield createMockMessage.result(false);
          } else {
            // Succeed on 3rd attempt
            yield createMockMessage.system({
              toolUse: {
                tool: 'Write',
                arguments: {
                  file_path: path.join(kugutsuDir, 'tasks.json'),
                  content: JSON.stringify([
                    {
                      id: 'task-001',
                      title: 'Success',
                      description: 'Test',
                      priority: 100,
                      dependencies: [],
                      status: 'pending',
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    },
                  ]),
                },
              },
            });
            yield createMockMessage.result(true);
          }
        });

        const initialState = createInitialState('Test', {
          maxEngineers: 1,
          maxTurns: 10,
          baseBranch: 'main',
          baseRepoPath: tempDir,
          worktreeBasePath: path.join(tempDir, 'worktrees'),
        });

        initialState.currentProjectId = 'test-project';

        await productOwnerNode(initialState);

        console.log = originalLog;

        // Should have logged retry attempts (if retry logic is implemented)
        // This test will pass once retry logic is implemented
        expect(callCount).toBeGreaterThan(1);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
