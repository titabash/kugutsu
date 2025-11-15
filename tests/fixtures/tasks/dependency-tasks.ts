/**
 * Task Fixtures with Dependencies
 *
 * Pre-configured tasks with dependency relationships for testing
 */

import type { Task, GlobalTask } from '../../../src/graph/types.js';

/**
 * Tasks with linear dependencies: A → B → C
 */
export const linearDependencyTasks: Task[] = [
  {
    id: 'task-a',
    title: 'Task A (no dependencies)',
    description: 'Base task with no dependencies',
    status: 'pending',
    priority: 100,
    dependencies: [],
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
  {
    id: 'task-b',
    title: 'Task B (depends on A)',
    description: 'Task that depends on A',
    status: 'pending',
    priority: 90,
    dependencies: ['task-a'],
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
  {
    id: 'task-c',
    title: 'Task C (depends on B)',
    description: 'Task that depends on B',
    status: 'pending',
    priority: 80,
    dependencies: ['task-b'],
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
];

/**
 * Tasks with parallel dependencies: A, B → C
 */
export const parallelDependencyTasks: Task[] = [
  {
    id: 'task-parallel-a',
    title: 'Task A (parallel, no dependencies)',
    description: 'First parallel task',
    status: 'pending',
    priority: 100,
    dependencies: [],
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
  {
    id: 'task-parallel-b',
    title: 'Task B (parallel, no dependencies)',
    description: 'Second parallel task',
    status: 'pending',
    priority: 100,
    dependencies: [],
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
  {
    id: 'task-parallel-c',
    title: 'Task C (depends on A and B)',
    description: 'Task that depends on both A and B',
    status: 'pending',
    priority: 90,
    dependencies: ['task-parallel-a', 'task-parallel-b'],
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
];

/**
 * Tasks with complex dependency graph
 *
 * Dependency structure:
 * ```
 *     A     B
 *     |     |
 *     C     D
 *      \   /
 *        E
 * ```
 */
export const complexDependencyTasks: Task[] = [
  {
    id: 'task-complex-a',
    title: 'Task A',
    description: 'Root task A',
    status: 'pending',
    priority: 100,
    dependencies: [],
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
  {
    id: 'task-complex-b',
    title: 'Task B',
    description: 'Root task B',
    status: 'pending',
    priority: 100,
    dependencies: [],
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
  {
    id: 'task-complex-c',
    title: 'Task C (depends on A)',
    description: 'Task that depends on A',
    status: 'pending',
    priority: 90,
    dependencies: ['task-complex-a'],
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
  {
    id: 'task-complex-d',
    title: 'Task D (depends on B)',
    description: 'Task that depends on B',
    status: 'pending',
    priority: 90,
    dependencies: ['task-complex-b'],
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
  {
    id: 'task-complex-e',
    title: 'Task E (depends on C and D)',
    description: 'Task that depends on both C and D',
    status: 'pending',
    priority: 80,
    dependencies: ['task-complex-c', 'task-complex-d'],
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
];

/**
 * Global tasks with dependencies for sprint planning
 */
export const globalTasksWithDependencies: GlobalTask[] = [
  {
    id: 'global-dep-001',
    type: 'feature',
    title: 'Setup database schema',
    description: 'Create database schema for users',
    status: 'pending',
    priority: 100,
    dependencies: [],
    estimatedHours: 4,
    projectId: 'test-project',
    requestTimestamp: new Date('2025-01-01T00:00:00Z'),
    dynamicPriority: 100,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
  {
    id: 'global-dep-002',
    type: 'feature',
    title: 'Implement user model',
    description: 'Implement user model and repository',
    status: 'pending',
    priority: 90,
    dependencies: ['global-dep-001'],
    estimatedHours: 6,
    projectId: 'test-project',
    requestTimestamp: new Date('2025-01-01T00:00:00Z'),
    dynamicPriority: 90,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
  {
    id: 'global-dep-003',
    type: 'feature',
    title: 'Create API endpoints',
    description: 'Create REST API endpoints for user operations',
    status: 'pending',
    priority: 85,
    dependencies: ['global-dep-002'],
    estimatedHours: 8,
    projectId: 'test-project',
    requestTimestamp: new Date('2025-01-01T00:00:00Z'),
    dynamicPriority: 85,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
  {
    id: 'global-dep-004',
    type: 'feature',
    title: 'Build UI components',
    description: 'Build reusable UI components',
    status: 'pending',
    priority: 95,
    dependencies: [],
    estimatedHours: 8,
    projectId: 'test-project',
    requestTimestamp: new Date('2025-01-01T00:00:00Z'),
    dynamicPriority: 95,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
  {
    id: 'global-dep-005',
    type: 'feature',
    title: 'Integrate frontend with API',
    description: 'Connect UI components to backend API',
    status: 'pending',
    priority: 80,
    dependencies: ['global-dep-003', 'global-dep-004'],
    estimatedHours: 6,
    projectId: 'test-project',
    requestTimestamp: new Date('2025-01-01T00:00:00Z'),
    dynamicPriority: 80,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  },
];
