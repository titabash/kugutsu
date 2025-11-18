# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important Git Policy

**DO NOT automatically run `git add` and `git commit` after making changes.** Only perform git operations when explicitly requested by the user. When making code changes, stop after the changes are complete and let the user decide when to commit.

## Critical: Local Repository Only

**This system MUST operate entirely within the local repository. DO NOT use any remote git operations such as:**
- `git fetch origin`
- `git pull origin`
- `git push origin`
- Any other commands that require network access or remote repositories

All operations must be completed using only the local git repository. This is a hard requirement that must never be violated.

## MANDATORY: Test-Driven Development (TDD)

**ABSOLUTE REQUIREMENT**: You MUST follow Test-Driven Development (TDD) principles for ALL code changes. Writing implementation code before tests is STRICTLY PROHIBITED.

### Non-Negotiable TDD Workflow

**EVERY code change MUST follow this exact sequence:**

```
Step 1: Receive implementation request
    ↓
Step 2: 🚫 STOP - DO NOT write implementation code
    ↓
Step 3: ✅ Write test cases that define expected behavior
    ↓
Step 4: ✅ Run tests and VERIFY they fail (Red phase)
    ↓
Step 5: ✅ Commit the failing tests
    ↓
Step 6: ✅ Write MINIMAL implementation to pass tests (Green phase)
    ↓
Step 7: ✅ Run tests and VERIFY they pass
    ↓
Step 8: ✅ Refactor if needed (Refactor phase)
    ↓
Step 9: ✅ Run tests again to ensure refactoring didn't break anything
    ↓
Step 10: ✅ Commit the implementation
```

### Mandatory Rules

1. **NEVER write implementation code before tests**
   - Tests MUST be written first
   - Tests MUST fail initially (proving they test real behavior)
   - Implementation follows ONLY after tests are in place

2. **Test completeness requirements**
   - All new functions/methods MUST have tests
   - All edge cases MUST be covered
   - All error paths MUST be tested
   - Integration points MUST have integration tests

3. **Verification requirements**
   - Tests MUST be run and shown to fail before implementation
   - Tests MUST be run and shown to pass after implementation
   - Test output MUST be shared with the user

4. **No exceptions allowed**
   - "Quick fixes" require tests
   - "Trivial changes" require tests
   - "Obvious implementations" require tests
   - Bug fixes require regression tests FIRST

### Test Framework Requirements

**For this project, use:**

- **Main codebase**: Vitest or Jest for Node.js/TypeScript
- **Electron UI**: Vitest + @testing-library/react for React components
- **Integration tests**: Full workflow testing with mocked dependencies

### Examples

#### ❌ PROHIBITED - Implementation First
```typescript
// Writing implementation without tests first
export function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0)
}
```

#### ✅ REQUIRED - Tests First
```typescript
// Step 1: Write test FIRST
import { describe, it, expect } from 'vitest'
import { calculateTotal } from './calculator'

describe('calculateTotal', () => {
  it('should return 0 for empty array', () => {
    expect(calculateTotal([])).toBe(0)
  })

  it('should sum item prices correctly', () => {
    const items = [
      { price: 100 },
      { price: 200 },
      { price: 300 },
    ]
    expect(calculateTotal(items)).toBe(600)
  })

  it('should handle negative prices', () => {
    const items = [{ price: -50 }]
    expect(calculateTotal(items)).toBe(-50)
  })
})

// Step 2: Run tests - VERIFY they fail
// Step 3: Commit failing tests
// Step 4: NOW write implementation
// Step 5: Run tests - VERIFY they pass
// Step 6: Commit implementation
```

### Violation Protocol

**If you realize you wrote implementation code before tests:**

1. 🚫 **STOP immediately** - Do not continue implementation
2. ⚠️ **Acknowledge the violation** - Inform the user explicitly
3. 🔄 **Ask for direction** - Give user two options:
   - **Option A**: Delete implementation and start over with TDD
   - **Option B**: Write comprehensive tests now to cover existing implementation
4. ✅ **Follow user's choice** and complete testing properly

### Why This Is Non-Negotiable

- **Quality Assurance**: Tests catch bugs before they reach production
- **Design Improvement**: Writing tests first leads to better API design
- **Documentation**: Tests serve as living documentation
- **Regression Prevention**: Tests prevent future changes from breaking existing functionality
- **Confidence**: Comprehensive tests enable fearless refactoring
- **Professional Standard**: TDD is the industry best practice

### Consequences of Violation

**If you implement without TDD:**
- ❌ Code quality is not verified
- ❌ Edge cases are likely missed
- ❌ Future refactoring becomes risky
- ❌ Regression bugs become likely
- ❌ User trust is damaged
- ❌ Professional standards are violated

### Golden Rule

> **"RED → GREEN → REFACTOR. NO EXCEPTIONS. NO SHORTCUTS. TDD ALWAYS."**

**This is not optional. This is not negotiable. This is MANDATORY.**

## AI-First Development Principles

### No Hardcoded Logic Rule
**CRITICAL**: This project follows strict AI-first development principles. Hardcoded logic is PROHIBITED except for:
- Basic type definitions and interfaces
- Simple utility functions with no business logic
- Constants that never change (e.g., file paths, error messages)

### Required AI-Driven Approach
Instead of hardcoded decision-making, you MUST:

1. **Use Claude Code SDK for all dynamic decisions**:
   ```typescript
   // ❌ PROHIBITED - Hardcoded logic
   if (fileName === 'package.json') return 'JavaScript';
   if (fileName === 'go.mod') return 'Go';
   
   // ✅ REQUIRED - AI-driven analysis
   const analysis = await query({
     prompt: "Analyze this file and determine the programming language...",
     options: { allowedTools: ["Read", "LS"] }
   });
   ```

2. **AI handles all file operations**:
   - File creation, modification, deletion decisions
   - Content analysis and pattern recognition
   - Dynamic configuration and setup
   - Project structure analysis

3. **AI manages business logic**:
   - Technology stack detection
   - Framework identification
   - Dependency analysis
   - Change detection
   - Task prioritization

### Implementation Guidelines

**File Operations**: Let AI decide what files to create/modify/delete:
```typescript
// ✅ AI determines file operations
const fileOperations = await query({
  prompt: "Based on this project structure, determine what files need to be created...",
  options: { allowedTools: ["Write", "Read", "LS"] }
});
```

**Configuration Management**: AI analyzes and configures:
```typescript
// ✅ AI analyzes configuration needs
const configAnalysis = await query({
  prompt: "Analyze this project's configuration requirements...",
  options: { allowedTools: ["Read", "Glob", "Write"] }
});
```

**Decision Trees**: Replace if/else logic with AI reasoning:
```typescript
// ❌ PROHIBITED
if (isReactProject) { /* hardcoded React logic */ }
else if (isVueProject) { /* hardcoded Vue logic */ }

// ✅ REQUIRED
const frameworkStrategy = await query({
  prompt: "Determine the appropriate strategy for this framework...",
  options: { allowedTools: ["Read", "Glob"] }
});
```

### Benefits of AI-First Approach
- **Future-proof**: Automatically handles new technologies and patterns
- **Adaptive**: Responds to project-specific requirements
- **Intelligent**: Makes context-aware decisions
- **Maintainable**: No hardcoded business logic to update
- **Flexible**: Adapts to changing requirements without code changes

### Violation Detection
Any hardcoded logic violating these principles should be immediately refactored to use Claude Code SDK with appropriate AI analysis and decision-making.

## CRITICAL: Documentation-First Implementation Policy

**ABSOLUTE REQUIREMENT**: You MUST verify implementation details against official documentation BEFORE writing any code. Speculation-based implementation is STRICTLY PROHIBITED.

### Mandatory Documentation Verification Process

**BEFORE implementing ANY feature, API, or integration, you MUST:**

1. **Use WebSearch** to find the latest official documentation
   ```
   WebSearch: "[Package Name] official documentation 2025"
   WebSearch: "[API Name] latest specification TypeScript"
   ```

2. **Use WebFetch** to read official documentation pages
   ```
   WebFetch: https://docs.[official-site].com/[specific-page]
   ```

3. **Verify version compatibility** and latest API specifications
   - Check package versions in npm/GitHub
   - Confirm TypeScript type definitions
   - Validate function signatures and parameters

4. **Document your findings** before implementation
   - Note which official docs were consulted
   - Record API version numbers
   - List any breaking changes or deprecations

### Implementation Workflow

```
Step 1: Receive implementation request
    ↓
Step 2: 🚫 STOP - DO NOT write code yet
    ↓
Step 3: ✅ Search for official documentation (WebSearch)
    ↓
Step 4: ✅ Read documentation thoroughly (WebFetch)
    ↓
Step 5: ✅ Verify current best practices and examples
    ↓
Step 6: ✅ Check for known issues or gotchas
    ↓
Step 7: ✅ NOW you can implement based on verified information
```

### Examples of Required Documentation Checks

#### ❌ PROHIBITED (Speculation-Based)
```typescript
// Writing code based on assumptions
import { query } from '@anthropic-ai/claude-agent-sdk';

// Guessing the API structure
const result = await query(prompt, { options: {...} });
```

#### ✅ REQUIRED (Documentation-Verified)
```typescript
// FIRST: Use WebSearch and WebFetch to verify the API
// WebSearch: "Claude Agent SDK TypeScript query function 2025"
// WebFetch: https://docs.claude.com/en/api/agent-sdk/typescript

// THEN: Implement based on verified documentation
import { query } from '@anthropic-ai/claude-agent-sdk';

// Confirmed API structure from official docs
const result = await query({
  prompt: "...",
  options: {
    model: "claude-sonnet-4-5-20250929", // Verified model ID
    maxTurns: 30,
    permissionMode: 'acceptEdits' // Verified option
  }
});
```

### Required Documentation Sources

**For this project, you MUST consult:**

1. **Claude Agent SDK**
   - Official Docs: https://docs.claude.com/en/api/agent-sdk/overview
   - TypeScript API: https://docs.claude.com/en/api/agent-sdk/typescript
   - GitHub: https://github.com/anthropics/claude-agent-sdk-typescript

2. **OpenAI Codex SDK**
   - Official Docs: https://developers.openai.com/codex/sdk/
   - API Reference: https://platform.openai.com/docs/codex

3. **LangGraphJS**
   - Official Docs: https://langchain-ai.github.io/langgraphjs/
   - Multi-Agent Concepts: https://langchain-ai.github.io/langgraphjs/concepts/multi_agent/
   - API Reference: https://langchain-ai.github.io/langgraphjs/reference/

4. **TypeScript/Node.js**
   - Official TypeScript Docs
   - Node.js API Documentation

### Verification Checklist

Before finalizing any implementation:

- [ ] Official documentation consulted via WebSearch/WebFetch
- [ ] API signatures verified against latest version
- [ ] TypeScript types confirmed
- [ ] Example code from official docs reviewed
- [ ] Known limitations/issues checked
- [ ] Breaking changes from previous versions noted
- [ ] Best practices followed per official guidelines

### Consequences of Violation

**If you implement without documentation verification:**
- ❌ Code will likely be incorrect or outdated
- ❌ Integration will fail at runtime
- ❌ Technical debt will accumulate
- ❌ User trust will be damaged

### Golden Rule

> **"When in doubt, CHECK THE DOCS. When not in doubt, CHECK THE DOCS ANYWAY."**

**NO EXCEPTIONS. NO GUESSING. DOCUMENTATION FIRST, ALWAYS.**

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

#### CLI vs Electron: Two Separate Modes
The system now has two completely independent execution modes:
1. **CLI Mode**: Terminal-based execution (no Electron UI)
2. **Electron Mode**: Standalone desktop application (VSCode/Cursor-like UI)

```bash
# Build the project
npm run build

# Build Electron components
npm run build:electron

# Build Renderer (React UI)
npm run build:renderer

# Build everything
npm run build:all

# Start the main CLI (after build)
npm start

# Run in development mode with TypeScript
npm run dev "<prompt>" [directory]
```

#### CLI Mode (Terminal-based)
```bash
# Run parallel development system (CLI only - no Electron)
npm run parallel-dev-cli "<development request>" [options]

# Examples
npm run parallel-dev-cli "Implement user authentication system"
npm run parallel-dev-cli "Fix bugs in login flow" --max-engineers 2
npm run parallel-dev-cli "Add API endpoints" --visual-ui
```

#### Electron Mode (Desktop Application)
```bash
# Start Electron app (standalone, no project opened initially)
npm run electron

# Build and start Electron
npm run electron:build

# Development build (full rebuild + start)
npm run electron:dev
```

**Electron App Usage:**
1. Launch app: `npm run electron`
2. File > Open Project to select a Git repository
3. Use the UI to configure and run AI development tasks
4. The app works like VSCode/Cursor - open a project first, then work with it

#### Application Distribution (Electron)
```bash
# Install electron-builder (first time only)
npm install --save-dev electron-builder

# Build distributable app (directory only, for testing)
npm run pack

# Build distributable app (installers for current platform)
npm run dist

# Build for specific platforms
npm run dist:mac      # Build .dmg for macOS
npm run dist:win      # Build .exe for Windows
npm run dist:linux    # Build AppImage/deb for Linux
```

### Type Checking and Linting
```bash
# Type checking (if tsc configured)
npx tsc --noEmit

# For linting, check if ESLint is configured
# npm run lint (if configured)
```

### Running the System - Updated
```bash
# Single Claude Code SDK execution
npm run dev "Please analyze this codebase"
npm run dev "Fix TypeScript errors" ./src

# AI Parallel Development System (CLI - Terminal only)
npm run parallel-dev-cli "Implement user authentication system"
npm run parallel-dev-cli "Add API endpoints for user management" --max-engineers 2
npm run parallel-dev-cli "Bug fixes for login flow" --keep-worktrees
npm run parallel-dev-cli "Performance improvements" --visual-ui

# Electron App (Desktop Application)
npm run electron  # Then use File > Open Project in the app
```

## Architecture

### Project Structure
- `src/` - Main source directory
  - `index.ts` - Basic Claude Code SDK runner
  - `parallel-dev-cli.ts` - CLI entry point (LangGraph-based)
  - `graph/` - LangGraph workflow definitions
    - `state.ts` - State definition and reducers
    - `types.ts` - Type definitions for workflow
    - `ParallelDevGraph.ts` - Graph construction (3 workflows)
    - `nodes/` - LangGraph node implementations
      - `ProductOwnerNode.ts` - Task analysis and decomposition
      - `EngineerNode.ts` - Code implementation
      - `ReviewNode.ts` - Code review
      - `MergeCoordinatorNode.ts` - Merge coordination
      - `ConflictResolverNode.ts` - Conflict resolution
      - `DirectorNode.ts` - Story mapping creation
      - `SprintPlanningNode.ts` - Sprint planning
      - `CheckModeNode.ts` - Continuation mode detection
      - And more...
  - `providers/` - AI Provider abstraction layer
    - `IAIProvider.ts` - Provider interface
    - `AIProviderFactory.ts` - Factory for creating providers
    - `ClaudeAgentProvider.ts` - Claude Agent SDK provider
    - `OpenAICodexProvider.ts` - OpenAI Codex provider (planned)
    - `MockAIProvider.ts` - Mock provider for testing
  - `managers/` - Core system managers
    - `GitWorktreeManager.ts` - Git worktree operations
    - `FileSystemManager.ts` - File system operations
  - `utils/` - Utility functions
    - `DataPersistence.ts` - JSON-based data persistence
    - `TaskInstructionManager.ts` - Task instruction management
    - `SchemaValidator.ts` - JSON schema validation
    - `MemoryMonitor.ts` - Memory usage monitoring
    - `ElectronLogAdapter.ts` - Electron logging adapter
    - `LogFormatter.ts` - Log formatting utilities
  - `types/` - TypeScript type definitions
    - `index.ts` - Core type definitions
    - `logging.ts` - Logging-related types
    - `scrum.ts` - Scrum development types
  - `electron/` - Electron-specific code
    - `ParallelDevOrchestrator.ts` - Orchestrator with Electron support
    - `StateStreamManager.ts` - Real-time state streaming
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
1. **LangGraph Workflows**: Three specialized workflows for different development modes
   - **Parallel Development**: Standard parallel task execution
   - **Sprint-Driven Development**: Sprint-based iterative development
   - **Scrum Development**: Full Scrum workflow with story mapping
2. **AI Provider Abstraction**: Unified interface for multiple AI providers
   - Claude Agent SDK Provider
   - OpenAI Codex Provider (planned)
   - Mock Provider (for testing)
3. **LangGraph Nodes**: Modular workflow components
   - **ProductOwnerNode**: Requirements analysis and task decomposition
   - **EngineerNode**: Code implementation with AI assistance
   - **ReviewNode**: Automated code review
   - **MergeCoordinatorNode**: Intelligent merge coordination
   - **ConflictResolverNode**: AI-powered conflict resolution
   - **DirectorNode**: Story mapping and user story creation
4. **State Management**: LangGraph-based state with reducers
5. **GitWorktreeManager**: Git operations and branch management
6. **DataPersistence**: JSON-based persistence for workflows
7. **StateStreamManager**: Real-time state streaming for Electron UI
8. **MemoryMonitor**: System resource monitoring

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