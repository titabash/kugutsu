![Kugutsu Logo](logos/kugutsu.png)

# Kugutsu 🎭

[![npm version](https://img.shields.io/npm/v/@titabash/kugutsu.svg)](https://www.npmjs.com/package/@titabash/kugutsu)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

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
- npm 8+
- Git 2.7+ (for git worktree support)
- Claude API key (set as `CLAUDE_API_KEY` environment variable)

## Quick Start

### 1. Set up Claude Code

Follow the [official Claude Code setup guide](https://docs.anthropic.com/en/docs/claude-code/quickstart) to configure your API key.

### 2. Install Kugutsu

```bash
# Install globally
npm install -g @titabash/kugutsu

# Or use with npx (no installation required)
npx @titabash/kugutsu "Your development request"
```

### 3. Run your first command

```bash
# Navigate to your project directory
cd your-project

# Run Kugutsu with a development request
kugutsu "Add error handling to all API endpoints"
```

## Usage

### Basic Commands

```bash
# Run with Electron UI (default) - Best for monitoring progress
kugutsu "Implement user authentication system"

# Run with CLI interface - Best for CI/CD environments
kugutsu "Fix all TypeScript errors" --no-electron

# Run with terminal visual UI - Best for terminal enthusiasts
kugutsu "Add API endpoints" --visual-ui

# Run with specific number of AI engineers
kugutsu "Performance improvements" --max-engineers 3

# Clean up worktrees after completion
kugutsu "Refactor database layer" --cleanup
```

### Common Use Cases

#### 🚀 Feature Development
```bash
kugutsu "Implement OAuth2 authentication with Google and GitHub providers"
```

#### 🐛 Bug Fixing
```bash
kugutsu "Fix all ESLint errors and TypeScript type issues in the codebase"
```

#### ♻️ Refactoring
```bash
kugutsu "Refactor the user service to follow SOLID principles"
```

#### 📊 Performance Optimization
```bash
kugutsu "Optimize database queries and add Redis caching" --max-engineers 2
```

#### 🧪 Test Coverage
```bash
kugutsu "Add unit tests for all service classes with 80% coverage"
```

### Advanced Options

```bash
Options:
  --base-repo <path>        # Base repository path (default: current directory)
  --worktree-base <path>    # Worktree base directory (default: ./worktrees)
  --max-engineers <num>     # Maximum concurrent engineers (1-10, default: 3)
  --max-turns <num>         # Maximum turns per task (5-50, default: 20)
  --base-branch <branch>    # Base branch for development (default: main)

UI Options:
  --electron               # Use Electron UI (default) - Rich desktop interface
  --no-electron           # Disable Electron UI - Pure CLI output
  --visual-ui             # Use terminal split UI - Terminal-based monitoring

System Options:
  --use-remote            # Use remote repository for worktrees
  --cleanup               # Clean up worktrees after completion
  --help                  # Show help information
  --version               # Show version number
```

## How It Works

### 🎯 Intelligent Task Decomposition
Kugutsu analyzes your request and automatically breaks it down into independent, parallelizable tasks:

```
User Request: "Implement user authentication system"
         ↓
┌─────────────────┬──────────────────┬─────────────────┐
│   Task 1        │    Task 2        │    Task 3       │
│ User Model &    │  JWT Service     │  Auth Routes    │
│   Database      │ Implementation   │  & Middleware   │
└─────────────────┴──────────────────┴─────────────────┘
```

### 🔄 Parallel Development Pipeline
Multiple AI engineers work simultaneously in isolated git worktrees:

```
Main Branch
    ├── Engineer 1 → feature/task-1 (User Model)
    ├── Engineer 2 → feature/task-2 (JWT Service)
    └── Engineer 3 → feature/task-3 (Auth Routes)
```

### ✅ Automated Review & Integration
Each completed task goes through automated review and intelligent merging:

```
Development → Review → Merge → Main
    ↓           ↓        ↓
 Parallel    Parallel  Sequential
```

## UI Options

### 🖥️ Electron UI (Default)
Modern desktop application with real-time monitoring:
- Live task progress tracking
- Color-coded log streams
- Engineer status updates
- Interactive task management

### 📊 Terminal Visual UI
Split-pane terminal interface for command-line enthusiasts:
- Task progress bars
- Live log viewer
- Status indicators
- Keyboard navigation

### 📝 Standard CLI
Simple command-line output for scripts and CI/CD:
- Sequential log output
- Progress indicators
- Error reporting
- Exit codes

## Best Practices

### ✅ DO:
- **Be specific** in your requests for better task decomposition
- **Use --cleanup** to keep your repository tidy
- **Monitor progress** through the UI for complex tasks
- **Set appropriate --max-engineers** based on task complexity
- **Review the generated code** before merging to production

### ❌ DON'T:
- Don't use more than 5 engineers for simple tasks
- Don't interrupt the process unless necessary
- Don't modify worktrees manually during execution
- Don't use in production without proper testing

## Troubleshooting

### Common Issues

#### Claude Code Not Configured
```bash
Error: CLAUDE_API_KEY environment variable is not set
Solution: Follow the Claude Code setup guide at https://docs.anthropic.com/en/docs/claude-code/quickstart
```

#### Git Worktree Issues
```bash
Error: fatal: could not create work tree
Solution: Ensure you have Git 2.7+ and sufficient disk space
```

#### Electron UI Not Starting
```bash
Solution: Use --no-electron or --visual-ui as alternatives
```

## Advanced Features

### Integration with CI/CD
```yaml
# GitHub Actions example
- name: Run Kugutsu
  env:
    CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
  run: |
    npx @titabash/kugutsu "Fix all test failures" --no-electron --cleanup
```

### Custom Configuration
Create a `.kugutsu.json` in your project root:
```json
{
  "maxEngineers": 4,
  "maxTurns": 30,
  "defaultUI": "visual",
  "autoCleanup": true
}
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
```bash
# Clone the repository
git clone https://github.com/titabash/kugutsu.git
cd kugutsu

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

## Support

- 📚 [Documentation](https://github.com/titabash/kugutsu/tree/main/docs)
- 🐛 [Issue Tracker](https://github.com/titabash/kugutsu/issues)
- 💬 [Discussions](https://github.com/titabash/kugutsu/discussions)
- 📦 [npm Package](https://www.npmjs.com/package/@titabash/kugutsu)

## Author

Created by [titabash](https://github.com/titabash)

## License

MIT License - see [LICENSE](LICENSE) file for details