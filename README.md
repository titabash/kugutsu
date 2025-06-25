![Kugutsu Logo](logos/kugutsu.png)

# Kugutsu 🎭

AI-powered parallel development system that orchestrates multiple AI engineers to work simultaneously on different tasks using git worktrees for isolation.

## Features

- 🤖 **Parallel AI Development**: Multiple AI engineers work simultaneously on different tasks
- 🌳 **Git Worktree Isolation**: Each task runs in an isolated git worktree
- 📊 **Task-Based Architecture**: Automatic task decomposition and prioritization
- 🔄 **Automated Review Process**: AI-powered code review with parallel reviewers
- 🔧 **Intelligent Merge Coordination**: Conflict resolution with context preservation
- 🖥️ **Multiple UI Options**: Electron desktop app, terminal visual UI, or standard CLI
- 📡 **Real-time Monitoring**: Live progress tracking and log streaming

## Requirements

- Node.js 18+ 
- npm (as package manager)
- Git

## Installation

### Install from npm (Recommended)

```bash
# Install globally
npm install -g @titabash/kugutsu

# Or use with npx
npx @titabash/kugutsu "Your development request"
```

### Install from Source

```bash
# Clone the repository
git clone https://github.com/titabash/kugutsu.git
cd kugutsu

# Install dependencies
npm install

# Build TypeScript
npm run build

# Link globally for development
npm link
```

## Usage

### Basic Usage

```bash
# Run with Electron UI (default)
kugutsu "Implement user authentication system"

# Run with CLI interface
kugutsu "Fix all TypeScript errors" --no-electron

# Run with terminal visual UI
kugutsu "Add API endpoints" --visual-ui

# Run with specific options
kugutsu "Performance improvements" --max-engineers 3 --cleanup
```

### Command Options

```bash
--base-repo <path>        # Base repository path (default: current directory)
--worktree-base <path>    # Worktree base directory (default: ./worktrees)
--max-engineers <num>     # Maximum concurrent engineers (1-10, default: 3)
--max-turns <num>         # Maximum turns per task (5-50, default: 20)
--base-branch <branch>    # Base branch for development (default: main)

# UI options
--electron               # Use Electron UI (default)
--no-electron           # Disable Electron UI
--visual-ui             # Use terminal split UI

# System options
--use-remote            # Use remote repository
--cleanup               # Clean up worktrees after completion
```

### Development from Source

When developing or running from source:

```bash
# Build the project
npm run build

# Build Electron components
npm run build:electron

# Run the parallel development system
npm run parallel-dev "Your development request"

# Run with CLI interface (no Electron)
npm run parallel-dev-cli "Your development request"

# Run basic Claude Code SDK runner
npm run dev "<prompt>" [directory]

# Start Electron app separately
npm run electron
```

## Architecture

### Core Components

- **ParallelPipelineManager**: Event-driven pipeline orchestrator with true parallel processing
- **ParallelDevelopmentOrchestrator**: Main orchestrator for coordinating all AI agents
- **ParallelDevelopmentOrchestratorWithElectron**: Electron-enhanced orchestrator with UI integration
- **ProductOwnerAI**: Requirements analysis and task decomposition
- **EngineerAI**: Code implementation with Claude Code SDK and context preservation
- **TechLeadAI**: Technical oversight and code review
- **ReviewWorkflow**: Automated review process with parallel reviewers
- **GitWorktreeManager**: Git operations and branch management
- **MergeCoordinator**: Intelligent conflict resolution
- **TaskQueue/ReviewQueue/MergeQueue**: Priority-based processing queues with mutex protection
- **ElectronLogAdapter**: Real-time log streaming to Electron UI
- **BaseAI**: Shared functionality for all AI agents

### Workflow

1. **Task Analysis**: ProductOwnerAI analyzes requirements and creates task breakdown
2. **Parallel Development**: Multiple EngineerAI instances work on tasks simultaneously
3. **Automated Review**: TechLeadAI reviews completed tasks in parallel
4. **Merge Coordination**: Sequential merging with conflict resolution
5. **Final Integration**: All changes merged back to main branch

### Event-Driven Architecture

The system uses three independent pipelines:
- **Development Pipeline**: Parallel task execution
- **Review Pipeline**: Parallel code review
- **Merge Pipeline**: Sequential merging with mutex protection

## Project Structure

```
kugutsu/
├── src/                    # Main source directory
│   ├── index.ts           # Basic Claude Code SDK runner
│   ├── parallel-dev.ts    # AI parallel development CLI entry point
│   ├── parallel-dev-electron.ts  # Electron UI entry point
│   ├── managers/          # Core system managers
│   ├── utils/             # Utility functions
│   └── types/             # TypeScript type definitions
├── electron/              # Electron application
│   ├── main/             # Main process
│   ├── preload/          # Preload scripts
│   └── renderer/         # Renderer process (UI)
├── docs/                 # Documentation
├── tests/                # Test suite
├── dist/                 # Compiled JavaScript output
├── worktrees/            # Git worktree directories (created during execution)
└── logos/                # Project assets
```

## Documentation

- [Parallel Development Workflow](docs/parallel-development-workflow.md) - Detailed workflow documentation
- [System Design](docs/AI_PARALLEL_DEVELOPMENT_DESIGN.md) - Architecture and design patterns
- [CLAUDE.md](CLAUDE.md) - AI assistant instructions for Claude Code

## Examples

### Implement a Feature
```bash
kugutsu "Implement a REST API for user management with CRUD operations"
```

### Bug Fixes
```bash
kugutsu "Fix all linting errors and TypeScript issues" --max-engineers 2
```

### Refactoring
```bash
kugutsu "Refactor the authentication module to use JWT tokens" --cleanup
```

### Performance Optimization
```bash
kugutsu "Optimize database queries and add caching layer" --visual-ui
```

### Multiple Features
```bash
kugutsu "Add user authentication, implement API rate limiting, and create admin dashboard" --max-engineers 4
```

## License

MIT License

## Contributing

Contributions are welcome! Please read the documentation and follow the existing patterns.

## Author

titabash

## Links

- [GitHub Repository](https://github.com/titabash/kugutsu)
- [Issues](https://github.com/titabash/kugutsu/issues)