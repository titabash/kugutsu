/**
 * Simple Task Fixtures
 *
 * Pre-configured simple tasks for testing
 */

import type { Task, GlobalTask } from '../../../src/graph/types.js';

/**
 * Single simple task (pending)
 */
export const singlePendingTask: Task = {
  id: 'task-001',
  title: 'Add button hover effect',
  description: 'Add CSS hover effect to the submit button',
  status: 'pending',
  priority: 100,
  dependencies: [],
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
};

/**
 * Single task in progress
 */
export const singleInProgressTask: Task = {
  id: 'task-002',
  title: 'Fix login validation',
  description: 'Fix email validation in login form',
  status: 'in_progress',
  priority: 100,
  dependencies: [],
  worktreePath: `${process.cwd()}/.test-tmp/worktrees/task-002`,
  branchName: 'feature/task-002',
  assignedEngineer: 'engineer-1',
  sessionId: 'session-002',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T01:00:00Z'),
};

/**
 * Single task in review
 */
export const singleInReviewTask: Task = {
  id: 'task-003',
  title: 'Update user profile UI',
  description: 'Update user profile page with new design',
  status: 'in_review',
  priority: 90,
  dependencies: [],
  worktreePath: `${process.cwd()}/.test-tmp/worktrees/task-003`,
  branchName: 'feature/task-003',
  assignedEngineer: 'engineer-1',
  sessionId: 'session-003',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T02:00:00Z'),
};

/**
 * Single completed task
 */
export const singleCompletedTask: Task = {
  id: 'task-004',
  title: 'Add footer links',
  description: 'Add social media links to footer',
  status: 'completed',
  priority: 80,
  dependencies: [],
  worktreePath: `${process.cwd()}/.test-tmp/worktrees/task-004`,
  branchName: 'feature/task-004',
  assignedEngineer: 'engineer-1',
  sessionId: 'session-004',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T03:00:00Z'),
};

/**
 * Multiple simple tasks (mixed statuses)
 */
export const multipleSimpleTasks: Task[] = [
  {
    id: 'task-101',
    title: 'Task 1',
    description: 'Simple task 1',
    status: 'pending',
    priority: 100,
    dependencies: [],
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
  {
    id: 'task-102',
    title: 'Task 2',
    description: 'Simple task 2',
    status: 'pending',
    priority: 90,
    dependencies: [],
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
  {
    id: 'task-103',
    title: 'Task 3',
    description: 'Simple task 3',
    status: 'pending',
    priority: 80,
    dependencies: [],
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
];

/**
 * Global task (backlog item)
 */
export const singleGlobalTask: GlobalTask = {
  id: 'global-task-001',
  type: 'feature',
  title: 'Implement user authentication',
  description: 'Implement JWT-based user authentication system',
  status: 'pending',
  priority: 100,
  dependencies: [],
  estimatedHours: 16,
  projectId: 'test-project',
  requestTimestamp: new Date('2025-01-01T00:00:00Z'),
  dynamicPriority: 100,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
};

/**
 * Multiple global tasks (backlog)
 */
export const multipleGlobalTasks: GlobalTask[] = [
  {
    id: 'global-task-101',
    type: 'feature',
    title: 'Setup authentication',
    description: 'Setup JWT authentication',
    status: 'pending',
    priority: 100,
    dependencies: [],
    estimatedHours: 8,
    projectId: 'test-project',
    requestTimestamp: new Date('2025-01-01T00:00:00Z'),
    dynamicPriority: 100,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
  {
    id: 'global-task-102',
    type: 'feature',
    title: 'Create login page',
    description: 'Create login UI page',
    status: 'pending',
    priority: 90,
    dependencies: ['global-task-101'],
    estimatedHours: 4,
    projectId: 'test-project',
    requestTimestamp: new Date('2025-01-01T00:00:00Z'),
    dynamicPriority: 90,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
  {
    id: 'global-task-103',
    type: 'feature',
    title: 'Add password reset',
    description: 'Add password reset functionality',
    status: 'pending',
    priority: 80,
    dependencies: ['global-task-101'],
    estimatedHours: 6,
    projectId: 'test-project',
    requestTimestamp: new Date('2025-01-01T00:00:00Z'),
    dynamicPriority: 80,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
];
