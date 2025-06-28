# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important Git Policy

**DO NOT automatically run `git add` and `git commit` after making changes.** Only perform git operations when explicitly requested by the user. When making code changes, stop after the changes are complete and let the user decide when to commit.

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

# Build Electron components
npm run build:electron

# Start the main CLI (after build)
npm start

# Run in development mode with TypeScript
npm run dev "<prompt>" [directory]

# Run parallel development system (CLI version)
npm run parallel-dev-cli "<development request>" [options]

# Run parallel development system (Electron UI - default)
npm run parallel-dev "<development request>" [options]

# Run parallel development system with GUI explicitly
npm run parallel-dev-gui "<development request>" [options]

# Start Electron app
npm run electron

# Build and start Electron
npm run electron:build
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

# AI Parallel Development System (Electron UI)
npm run parallel-dev "Implement user authentication system"
npm run parallel-dev "Add API endpoints for user management" --max-engineers 2
npm run parallel-dev "Bug fixes for login flow" --cleanup
npm run parallel-dev "Performance improvements" --electron

# AI Parallel Development System (CLI version)
npm run parallel-dev-cli "Implement authentication" --visual-ui
npm run parallel-dev-cli "Fix bugs" --no-electron
```

## Architecture

### Project Structure
- `src/` - Main source directory
  - `index.ts` - Basic Claude Code SDK runner
  - `parallel-dev.ts` - AI parallel development CLI entry point
  - `parallel-dev-electron.ts` - Electron UI entry point
  - `managers/` - Core system managers
    - `BaseAI.ts` - Base AI agent functionality
    - `ParallelDevelopmentOrchestrator.ts` - Main orchestrator
    - `ParallelDevelopmentOrchestratorWithElectron.ts` - Electron-enhanced orchestrator
    - `ParallelPipelineManager.ts` - Event-driven pipeline orchestrator
    - `EngineerAI.ts` - AI engineer implementation
    - `ProductOwnerAI.ts` - Task analysis and planning
    - `TechLeadAI.ts` - Technical review and guidance
    - `ReviewWorkflow.ts` - Code review automation
    - `GitWorktreeManager.ts` - Git worktree operations
  - `utils/` - Utility functions
    - `MergeCoordinator.ts` - Merge conflict resolution
    - `TaskInstructionManager.ts` - Task instruction management
    - `TaskQueue.ts` - Priority-based task queue
    - `ReviewQueue.ts` - Review queue management
    - `MergeQueue.ts` - Merge queue with mutex
    - `TaskEventEmitter.ts` - Event-driven communication
    - `ParallelLogViewer.ts` - Terminal-based log viewer
    - `ImprovedParallelLogViewer.ts` - Enhanced log viewer
    - `ElectronLogAdapter.ts` - Electron logging adapter
    - `LogFormatter.ts` - Log formatting utilities
  - `types/` - TypeScript type definitions
    - `index.ts` - Core type definitions
    - `logging.ts` - Logging-related types
- `electron/` - Electron application
  - `main/` - Main process
    - `index.ts` - Electron main process
  - `preload/` - Preload scripts
    - `index.ts` - Preload script for IPC
  - `renderer/` - Renderer process (UI)
    - `index.html` - Main UI
    - `js/` - JavaScript files
    - `styles/` - CSS styles
- `docs/` - Documentation
  - `parallel-development-workflow.md` - Detailed workflow documentation
  - `AI_PARALLEL_DEVELOPMENT_DESIGN.md` - System design document
  - Other technical documentation
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
1. **ParallelPipelineManager**: Event-driven pipeline orchestrator with true parallel processing
2. **ProductOwnerAI**: Requirements analysis and task decomposition
3. **EngineerAI**: Code implementation with Claude Code SDK and context preservation
4. **TechLeadAI**: Technical oversight and architecture guidance
5. **ReviewWorkflow**: Automated code review process with parallel reviewers
6. **GitWorktreeManager**: Git operations and branch management
7. **TaskQueue/ReviewQueue/MergeQueue**: Priority-based processing queues with mutex protection
8. **ElectronLogAdapter**: Real-time log streaming to Electron UI
9. **ParallelLogViewer**: Terminal-based visual log monitoring
10. **BaseAI**: Shared functionality for all AI agents

### Parallel Development Workflow
The system implements a true parallel processing workflow with three independent pipelines:

**📊 Detailed Workflow Documentation**: See [docs/parallel-development-workflow.md](docs/parallel-development-workflow.md)

**🏗️ System Design Documentation**: See [docs/AI_PARALLEL_DEVELOPMENT_DESIGN.md](docs/AI_PARALLEL_DEVELOPMENT_DESIGN.md)

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
- Electron UI testing
- Event-driven pipeline testing
- Queue system testing
- Conflict resolution testing

### UI Options
The system supports multiple UI modes:
- **Electron UI** (default): Modern desktop application with real-time log streaming
- **Terminal Visual UI**: Split-pane terminal interface using blessed
- **Standard CLI**: Traditional command-line output

### Event-Driven Architecture
The system uses a sophisticated event-driven architecture with three independent pipelines:
- **Development Pipeline**: Parallel task execution by multiple AI engineers
- **Review Pipeline**: Parallel code review by multiple tech leads
- **Merge Pipeline**: Sequential merging with conflict resolution

Key events: `DEVELOPMENT_COMPLETED`, `REVIEW_COMPLETED`, `MERGE_READY`, `MERGE_CONFLICT_DETECTED`, `MERGE_COMPLETED`, `TASK_FAILED`

### Configuration Options
The system supports extensive configuration through command-line options:

```bash
# Core options
--base-repo <path>        # Base repository path
--worktree-base <path>    # Worktree base directory  
--max-engineers <num>     # Maximum concurrent engineers (1-10)
--max-turns <num>         # Maximum turns per task (5-50)
--base-branch <branch>    # Base branch for development

# UI options
--electron               # Use Electron UI (default)
--no-electron           # Disable Electron UI
--visual-ui             # Use terminal split UI

# System options
--use-remote            # Use remote repository
--cleanup               # Clean up worktrees after completion
```

### Parallel Processing Features
- **True Parallelism**: Development, review, and merge pipelines run independently
- **Context Preservation**: Engineer AI maintains context for conflict resolution
- **Priority Queues**: High-priority tasks (conflicts) are processed first
- **Mutex Protection**: Sequential merging ensures main branch integrity
- **Real-time Monitoring**: Live progress tracking through multiple UI options