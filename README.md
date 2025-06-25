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

```bash
# Clone the repository
git clone https://github.com/titabash/kugutsu.git
cd kugutsu

# Install dependencies
npm install

# Build TypeScript
npm run build
```

## Usage

### Basic Usage

```bash
# Run with Electron UI (default)
npm run parallel-dev "Implement user authentication system"

# Run with CLI interface
npm run parallel-dev-cli "Fix all TypeScript errors"

# Run with specific options
npm run parallel-dev "Add API endpoints" --max-engineers 3 --cleanup
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

### Development Commands

```bash
# Build the project
npm run build

# Build Electron components
npm run build:electron

# Start in development mode
npm run dev "<prompt>" [directory]

# Run Electron app separately
npm run electron

# Build and start Electron
npm run electron:build
```

## Architecture

### Core Components

- **ParallelPipelineManager**: Event-driven pipeline orchestrator with true parallel processing
- **ProductOwnerAI**: Requirements analysis and task decomposition
- **EngineerAI**: Code implementation with Claude Code SDK
- **TechLeadAI**: Technical oversight and code review
- **ReviewWorkflow**: Automated review process
- **GitWorktreeManager**: Git operations and branch management
- **MergeCoordinator**: Intelligent conflict resolution

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

## Documentation

- [Parallel Development Workflow](docs/parallel-development-workflow.md)
- [System Design](docs/AI_PARALLEL_DEVELOPMENT_DESIGN.md)
- [CLAUDE.md](CLAUDE.md) - AI assistant instructions

## Examples

### Implement a Feature
```bash
npm run parallel-dev "Implement a REST API for user management with CRUD operations"
```

### Bug Fixes
```bash
npm run parallel-dev-cli "Fix all linting errors and TypeScript issues" --max-engineers 2
```

### Refactoring
```bash
npm run parallel-dev "Refactor the authentication module to use JWT tokens" --cleanup
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