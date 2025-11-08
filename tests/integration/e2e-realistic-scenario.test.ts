/**
 * E2E Realistic Scenario Test
 *
 * Tests complete workflow with realistic JWT Authentication API implementation
 *
 * Scenario: Implement REST API with JWT authentication
 * - Task 1: Database schema (User model)
 * - Task 2: User registration endpoint (depends on 1)
 * - Task 3: Login endpoint (depends on 1)
 * - Task 4: JWT middleware (depends on 3)
 * - Task 5: Protected routes (depends on 4)
 */

import { jest } from '@jest/globals';

// Mock AIProviderFactory BEFORE importing
let mockProvider: any;
jest.unstable_mockModule('../../src/providers/AIProviderFactory.js', () => ({
  AIProviderFactory: {
    create: jest.fn(() => mockProvider),
    getSupportedProviders: jest.fn(() => ['claude', 'mock']),
    isProviderSupported: jest.fn((provider: string) => ['claude', 'mock'].includes(provider)),
  },
}));

// Mock GitWorktreeManager BEFORE importing
const mockCreateWorktree = jest.fn<any>();
const mockRemoveWorktree = jest.fn<any>();
const mockCleanupAllWorktrees = jest.fn<any>();

jest.unstable_mockModule('../../src/managers/GitWorktreeManager.js', () => ({
  GitWorktreeManager: jest.fn().mockImplementation(() => ({
    createWorktree: mockCreateWorktree,
    removeWorktree: mockRemoveWorktree,
    cleanupAllWorktrees: mockCleanupAllWorktrees,
  })),
}));

// Mock child_process to prevent actual Git commands
const mockExecSync = jest.fn<any>();
jest.unstable_mockModule('child_process', () => ({
  execSync: mockExecSync,
}));

// Import AFTER mocking
const { compileUnifiedScrumWorkflowGraph } = await import('../../src/graph/ParallelDevGraph.js');
const { createInitialState } = await import('../../src/graph/state.js');
const { MockAIProvider } = await import('../../src/providers/MockAIProvider.js');
const {
  setupTestEnvironment,
  createTaskGraph,
  setupDefaultMockResponses,
  assertDependencyResolution,
  extractExecutionOrder,
  assertAllTasksCompleted,
} = await import('../helpers/integration-test-helpers.js');

describe('E2E Realistic Scenario: JWT Authentication API', () => {
  // Store original process.chdir
  const originalChdir = process.chdir;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock provider
    mockProvider = new MockAIProvider();

    // Setup default git worktree mock
    mockCreateWorktree.mockImplementation(async (taskId: string) => ({
      path: `/test/worktrees/${taskId}`,
      branchName: `task/${taskId}`,
    }));

    mockRemoveWorktree.mockResolvedValue(undefined);
    mockCleanupAllWorktrees.mockResolvedValue(undefined);

    // Mock execSync to return empty string (successful Git command)
    mockExecSync.mockReturnValue('');

    // Mock process.chdir to prevent directory changes
    process.chdir = jest.fn() as any;
  });

  afterEach(() => {
    // Restore original process.chdir
    process.chdir = originalChdir;
  });

  test('should implement complete JWT authentication API with dependency graph', async () => {
    const env = await setupTestEnvironment('jwt-api-test-');

    try {
      /**
       * Dependency Graph for JWT Authentication API:
       *
       * Task 1: DB Schema (User model) [Independent]
       *   ├→ Task 2: User registration endpoint
       *   └→ Task 3: Login endpoint
       *        └→ Task 4: JWT middleware
       *             └→ Task 5: Protected routes
       *
       * Expected execution phases:
       * Phase 1: Task 1 (DB Schema)
       * Phase 2: Task 2 and 3 in parallel (both depend on 1)
       * Phase 3: Task 4 (depends on 3)
       * Phase 4: Task 5 (depends on 4)
       */
      const tasks = createTaskGraph([
        {
          id: 'task-db-schema',
          title: 'Database Schema (User Model)',
          description: 'Create User model schema with bcrypt password hashing',
          dependencies: [],
          priority: 100,
        },
        {
          id: 'task-registration',
          title: 'User Registration Endpoint',
          description: 'POST /api/auth/register - Create new user account',
          dependencies: ['task-db-schema'],
          priority: 90,
        },
        {
          id: 'task-login',
          title: 'Login Endpoint',
          description: 'POST /api/auth/login - Authenticate user and return JWT token',
          dependencies: ['task-db-schema'],
          priority: 90,
        },
        {
          id: 'task-jwt-middleware',
          title: 'JWT Authentication Middleware',
          description: 'Middleware to verify JWT tokens for protected routes',
          dependencies: ['task-login'],
          priority: 80,
        },
        {
          id: 'task-protected-routes',
          title: 'Protected API Routes',
          description: 'GET /api/users/profile - Protected route requiring JWT',
          dependencies: ['task-jwt-middleware'],
          priority: 70,
        },
      ]);

      // Setup mock responses
      await setupDefaultMockResponses(mockProvider, env, tasks);

      // Create initial state
      const initialState = createInitialState('Implement JWT Authentication API', {
        maxEngineers: 3,
        maxTurns: 30,
        baseBranch: 'main',
        baseRepoPath: env.tempDir,
        worktreeBasePath: `${env.tempDir}/worktrees`,
        provider: 'mock',
      });

      // Compile and execute graph
      const graph = compileUnifiedScrumWorkflowGraph();
      const states: any[] = [];
      const stream = await graph.stream(initialState);

      for await (const event of stream) {
        states.push(event);
      }

      // Verify workflow execution
      expect(states.length).toBeGreaterThan(0);

      // Extract final state
      const finalState = states[states.length - 1];
      const finalTasks = finalState.check_completion?.tasks || [];

      // Assert all tasks completed
      assertAllTasksCompleted(finalTasks);

      // Extract execution order
      const executionOrder = extractExecutionOrder(states);

      console.log('\n📊 JWT Authentication API Implementation:');
      console.log('Execution order:', executionOrder);

      // Assert dependency resolution
      const dependencies = {
        'task-db-schema': [],
        'task-registration': ['task-db-schema'],
        'task-login': ['task-db-schema'],
        'task-jwt-middleware': ['task-login'],
        'task-protected-routes': ['task-jwt-middleware'],
      };

      assertDependencyResolution(executionOrder, dependencies);

      // Verify specific execution phases
      const indexDB = executionOrder.indexOf('task-db-schema');
      const indexReg = executionOrder.indexOf('task-registration');
      const indexLogin = executionOrder.indexOf('task-login');
      const indexJWT = executionOrder.indexOf('task-jwt-middleware');
      const indexProtected = executionOrder.indexOf('task-protected-routes');

      // Phase 1: DB Schema executes first
      expect(indexDB).toBe(0);

      // Phase 2: Registration and Login execute after DB (parallel)
      expect(indexReg).toBeGreaterThan(indexDB);
      expect(indexLogin).toBeGreaterThan(indexDB);

      // Phase 3: JWT middleware executes after Login
      expect(indexJWT).toBeGreaterThan(indexLogin);

      // Phase 4: Protected routes execute after JWT middleware
      expect(indexProtected).toBeGreaterThan(indexJWT);

      console.log('\n✅ JWT Authentication API implemented successfully');
      console.log(`   Phase 1: DB Schema (${indexDB})`);
      console.log(`   Phase 2: Registration (${indexReg}), Login (${indexLogin})`);
      console.log(`   Phase 3: JWT Middleware (${indexJWT})`);
      console.log(`   Phase 4: Protected Routes (${indexProtected})`);

      // Verify all tasks reached completed status
      expect(finalTasks.every((t: any) => t.status === 'completed')).toBe(true);

      // Extract node names from events to verify all nodes executed
      const nodeNames = states.flatMap((state) => Object.keys(state));

      expect(nodeNames).toContain('product_owner');
      expect(nodeNames).toContain('engineer_dispatch');
      expect(nodeNames).toContain('engineer');
      expect(nodeNames).toContain('review');
      expect(nodeNames).toContain('merge_coordinator');
      expect(nodeNames).toContain('check_completion');

      console.log('\n✅ All workflow nodes executed');
    } finally {
      await env.cleanup();
    }
  }, 90000); // 90 second timeout

  test('should handle parallel execution of independent tasks', async () => {
    const env = await setupTestEnvironment('parallel-auth-test-');

    try {
      /**
       * Simplified scenario focusing on parallel execution:
       * Task 1: Auth foundation [Independent]
       *   ├→ Task 2: Registration
       *   └→ Task 3: Login
       *
       * Tasks 2 and 3 should execute in parallel
       */
      const tasks = createTaskGraph([
        {
          id: 'auth-foundation',
          title: 'Authentication Foundation',
          description: 'Base authentication infrastructure',
          dependencies: [],
          priority: 100,
        },
        {
          id: 'auth-register',
          title: 'Registration',
          description: 'User registration',
          dependencies: ['auth-foundation'],
          priority: 90,
        },
        {
          id: 'auth-login',
          title: 'Login',
          description: 'User login',
          dependencies: ['auth-foundation'],
          priority: 90,
        },
      ]);

      // Setup mock responses
      await setupDefaultMockResponses(mockProvider, env, tasks);

      // Create initial state
      const initialState = createInitialState('Parallel auth implementation', {
        maxEngineers: 3,
        maxTurns: 20,
        baseBranch: 'main',
        baseRepoPath: env.tempDir,
        worktreeBasePath: `${env.tempDir}/worktrees`,
        provider: 'mock',
      });

      // Compile and execute graph
      const graph = compileUnifiedScrumWorkflowGraph();
      const states: any[] = [];
      const stream = await graph.stream(initialState);

      for await (const event of stream) {
        states.push(event);
      }

      // Extract execution order
      const executionOrder = extractExecutionOrder(states);

      console.log('\n📊 Parallel Execution Order:', executionOrder);

      // Verify foundation executes first
      expect(executionOrder[0]).toBe('auth-foundation');

      // Verify register and login execute after foundation
      expect(executionOrder).toContain('auth-register');
      expect(executionOrder).toContain('auth-login');

      const indexFoundation = executionOrder.indexOf('auth-foundation');
      const indexRegister = executionOrder.indexOf('auth-register');
      const indexLogin = executionOrder.indexOf('auth-login');

      expect(indexRegister).toBeGreaterThan(indexFoundation);
      expect(indexLogin).toBeGreaterThan(indexFoundation);

      console.log('✅ Registration and Login executed in parallel after foundation');

      // Extract final state
      const finalState = states[states.length - 1];
      const finalTasks = finalState.check_completion?.tasks || [];

      assertAllTasksCompleted(finalTasks);
    } finally {
      await env.cleanup();
    }
  }, 60000);
});
