# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered parallel development system built with TypeScript and the Claude Code SDK. It enables multiple AI engineers to work simultaneously on different tasks using git worktrees for isolation. The system includes task orchestration, automated code review, and intelligent merge coordination.

## Development Commands

### Package Manager Policy
**IMPORTANT**: This project uses `npm` as the package manager. Ensure Node.js 18+ is installed.

### Installation and Setup
```bash
# Install dependencies
npm install

# Build TypeScript
npm run build
```

### Development Commands
```bash
# Build the project
npm run build

# Start the main CLI (after build)
npm start

# Run in development mode with TypeScript
npm run dev "<prompt>" [directory]

# Run parallel development system
npm run parallel-dev "<development request>" [options]
```

### Type Checking and Linting
```bash
# Type checking (if tsc configured)
npx tsc --noEmit

# For linting, check if ESLint is configured
# npm run lint (if configured)
```

### Running the System
```bash
# Single Claude Code SDK execution
npm run dev "Please analyze this codebase"
npm run dev "Fix TypeScript errors" ./src

# AI Parallel Development System
npm run parallel-dev "Implement user authentication system"
npm run parallel-dev "Add API endpoints for user management" --max-engineers 2
npm run parallel-dev "Bug fixes for login flow" --cleanup
```

## Architecture

### Project Structure
- `src/` - Main source directory
  - `index.ts` - Basic Claude Code SDK runner
  - `parallel-dev.ts` - AI parallel development CLI entry point
  - `managers/` - Core system managers
    - `ParallelDevelopmentOrchestrator.ts` - Main orchestrator
    - `EngineerAI.ts` - AI engineer implementation
    - `ProductOwnerAI.ts` - Task analysis and planning
    - `TechLeadAI.ts` - Technical review and guidance
    - `ReviewWorkflow.ts` - Code review automation
    - `GitWorktreeManager.ts` - Git worktree operations
  - `utils/` - Utility functions
    - `MergeCoordinator.ts` - Merge conflict resolution
    - `TaskInstructionManager.ts` - Task instruction management
  - `types/` - TypeScript type definitions
- `tests/` - Test suite
- `dist/` - Compiled JavaScript output
- `worktrees/` - Git worktree directories (created during execution)

### Key Design Patterns
1. **AI Orchestration**: Uses Claude Code SDK to coordinate multiple AI agents
2. **Git Worktree Isolation**: Each task runs in isolated git worktree for parallel development
3. **Task-Based Architecture**: User requests are analyzed and split into independent tasks
4. **Parallel Execution**: Multiple AI engineers work simultaneously on different tasks
5. **Automated Review**: Integrated review workflow with AI-powered code review
6. **Merge Coordination**: Intelligent conflict resolution and merge management

### Core Components
1. **ParallelPipelineManager**: Event-driven pipeline orchestrator
2. **ProductOwnerAI**: Requirements analysis and task decomposition
3. **EngineerAI**: Code implementation with Claude Code SDK
4. **TechLeadAI**: Technical oversight and architecture guidance
5. **ReviewWorkflow**: Automated code review process
6. **GitWorktreeManager**: Git operations and branch management
7. **TaskQueue/ReviewQueue/MergeQueue**: Priority-based processing queues

### Parallel Development Workflow
The system implements a true parallel processing workflow with three independent pipelines:

**📊 Detailed Workflow Documentation**: See [docs/parallel-development-workflow.md](docs/parallel-development-workflow.md)

Key Features:
- **Event-Driven Architecture**: Tasks flow through development → review → merge pipelines
- **True Parallelism**: No waiting for all tasks to complete before starting reviews
- **Conflict Resolution**: Original EngineerAI handles merge conflicts with preserved context
- **Priority Queues**: High-priority tasks (including conflict resolution) are processed first
- **Mutex-Protected Merging**: Sequential merging ensures main branch integrity

### Testing Strategy
- TypeScript-based testing framework
- Integration tests for AI workflows
- Git worktree operation testing
- Mock Claude Code SDK for unit tests