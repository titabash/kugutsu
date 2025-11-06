# Changelog

All notable changes to Kugutsu will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### 🔄 Architecture Unification

**Major refactoring to unify CLI and Electron architectures under LangGraph**

#### Breaking Changes
- **Removed legacy event-driven architecture**
  - Deleted `ParallelDevelopmentOrchestrator` (old CLI implementation)
  - Deleted `ParallelPipelineManager` (event-driven pipeline)
  - Deleted `BaseAI`, `EngineerAI`, `ProductOwnerAI`, `TechLeadAI` (old AI classes)
  - Deleted `TaskEventEmitter`, `TaskQueue`, `ReviewQueue`, `MergeQueue`
  - Deleted `ReviewWorkflow`, `MergeCoordinator`, `ClaudeCodeSetupChecker`

#### Added
- **Mock AI Provider support**
  - Added `'mock'` as default AI provider for safe testing
  - Environment variable `KUGUTSU_PROVIDER` now accepts `mock`, `claude`, or `codex`
  - No API costs for testing with mock provider
- **DirectorNode** for Scrum workflow
  - Extracted from DirectorAI class
  - Uses AI Provider abstraction
  - Integrated with LangGraph state management
- **Scrum type definitions** (`src/types/scrum.ts`)
  - Extracted StoryMapping, Epic, UserStory types for reuse

#### Changed
- **Unified CLI implementation**
  - `parallel-dev-cli.ts` now uses LangGraph exclusively
  - Both CLI and Electron versions use the same LangGraph workflows
  - Added comprehensive validation (Git repo, commits, worktree detection)
  - Added protected branch warnings
  - Improved error messages and user guidance
- **AI Provider type system**
  - Updated `AIProviderConfig` to include `'mock'` provider
  - Updated `ParallelDevConfig` to support `'mock'` provider
- **Documentation**
  - Updated `CLAUDE.md` to reflect unified architecture
  - Removed references to legacy implementation
  - Updated project structure documentation

#### Fixed
- Build errors related to removed legacy files
- Type inconsistencies in AI provider configuration
- Import errors in LangGraph nodes

#### Impact
- **100% LangGraph adoption**: Both CLI and Electron now use LangGraph
- **Simplified codebase**: Removed 15+ legacy files
- **Better testability**: Mock provider enables cost-free testing
- **Consistent behavior**: CLI and Electron share the same workflow logic

---

## [2.0.0] - 2025-11-07

### 🎉 Major Release: LangGraph Architecture + Scrum Development

This is a major architectural overhaul introducing LangGraph-based state management, Scrum development workflow, sprint-driven development, and Electron desktop application.

### Added

#### Phase 1: Foundation (LangGraph Integration)
- **LangGraph State Management** (@langchain/langgraph v1.0.1)
  - `ParallelDevState` with Annotation.Root for type-safe state management
  - Custom reducers for tasks, logs, reviews, and merge queue
  - Worktree map management
  - Metadata tracking with phase transitions

- **AI Provider Abstraction Layer**
  - `IAIProvider` interface for multi-provider support
  - `ClaudeAgentProvider` wrapper for Claude Agent SDK
  - `OpenAICodexProvider` wrapper for OpenAI Codex SDK
  - `AIProviderFactory` for provider instantiation
  - `MockAIProvider` for testing

- **Configuration Management**
  - `ConfigurationManager` for `.kugutsu/config.json` and environment variables
  - Validation and caching
  - Path-based configuration access

#### Phase 2: Core Functionality (LangGraph Nodes & Graph)
- **Graph Nodes**
  - `ProductOwnerNode`: Requirements analysis and task generation
  - `EngineerDispatchNode`: Task assignment and worktree creation
  - `EngineerNode`: Code implementation with Claude Agent SDK
  - `ReviewNode`: Automated code review
  - `MergeCoordinatorNode`: Sequential merge coordination
  - `ConflictResolverNode`: AI-powered conflict resolution

- **Graph Construction**
  - `compileParallelDevGraph()`: Standard parallel development workflow
  - Promise.all() based parallel execution (59% time reduction)
  - Conditional edges for dynamic workflow control
  - State streaming support

- **Infrastructure Integration**
  - Enhanced `GitWorktreeManager` integration
  - Unified error handling across nodes
  - Performance optimizations (O(1) task updates with Map)

#### Phase 3: UI Integration
- **StateStreamManager** (Electron IPC Optimization)
  - 50ms buffering with max 20 events/sec throttling
  - Diff detection (only send changes)
  - Priority control (high/normal/low)
  - 8 event types: state-init, node-started, node-completed, task-update, tasks-batch, logs-batch, phase-change, error, complete

- **Electron UI Updates**
  - `useElectronSync` React hook with event batch handling
  - `updateTasks()` method in Zustand store
  - Type-safe GraphEvent interface
  - Legacy code removal (GraphStreamAdapter, old IPC handlers)

- **CLI Separation**
  - `parallel-dev-cli.ts`: Electron-independent CLI mode
  - Package.json bin: kugutsu → parallel-dev-cli.js

#### Phase 4: Testing & Optimization
- **Comprehensive Test Suite**
  - 50/50 integration tests passing
  - Unit tests for all providers and nodes
  - Performance tests (state updates < 5ms, log buffering < 50ms)
  - Graph execution tests with mocking

- **Performance Optimizations**
  - Log buffering (1000 entries, FIFO)
  - Map-based O(1) task lookups
  - State update batching
  - Memory-efficient worktree management

#### Phase 6: Scrum Development Workflow
- **AI Agents**
  - `DirectorAI`: User story mapping creation
  - `ReviewStoryMappingNode`: ProductOwner review
  - `TechLeadDesignNode`: Design documents generation (Architecture, UI/UX, DB, API)
  - `ReviewDesignNode`: 3-party collaborative review (Director + ProductOwner + TechLead)
  - `TaskBreakdownNode`: Micro end-to-end task decomposition

- **Data Persistence**
  - JSON schemas for story mapping, design docs, dependency graph, kanban state, reviews
  - `SchemaValidator` with Ajv + ajv-formats
  - `DataPersistence` with 20+ save/load methods
  - `.kugutsu/projects/{projectId}/` directory structure

- **UI Components** (React + shadcn/ui)
  - `StoryMappingViewer`: Persona, epics, user stories with acceptance criteria
  - `DependencyGraphViewer`: ReactFlow-based graph with critical path highlighting
  - `DesignDocsViewer`: Tabbed interface with markdown and JSON rendering
  - `TaskCard`: Dependencies, tags, priority badges, tooltips

- **Graph Integration**
  - `compileScrumDevGraph()`: Story mapping → Design → Review → Task breakdown → Execution
  - State extensions: storyMapping, designDocs, dependencyGraph
  - Iterative review loops with approval gates

- **Documentation & Examples**
  - README.md: Scrum workflow section with usage examples
  - `examples/scrum-workflow/`: Story mapping, design docs, dependency graph samples

#### Phase 7: Sprint-Driven Development
- **Continuation Mode Detection**
  - `CheckModeNode`: AI-driven detection (no string pattern matching)
  - Global task queue loading
  - Project metadata management
  - Dynamic priority recalculation

- **Sprint Planning**
  - `SprintPlanningNode`: 8-16h sprint creation
  - End-to-end functional units
  - Dependency-aware task ordering
  - Single sprint per planning cycle

- **Sprint Management**
  - `SprintReviewNode`: Completion check and next sprint decision
  - Sprint history tracking
  - Deployability validation

- **Data Persistence**
  - `.kugutsu/tasks/global-queue.json`: All project tasks
  - `.kugutsu/sprints/active-sprint.json`: Current sprint
  - `.kugutsu/sprints/sprint-history.json`: Completed sprints
  - `.kugutsu/projects/{projectId}/project.json`: Project metadata

- **Priority Calculation**
  - `PriorityCalculator`: basePriority * 0.5 + recencyBonus * 0.3 + dependencyBonus * 0.2
  - Dynamic priority updates

- **Graph Integration**
  - `compileSprintDrivenGraph()`: CheckMode → [ProductOwner/SprintPlanning] → Execution → Review
  - Multi-sprint loop support
  - Seamless continuation across sessions

#### Phase 8: CLI/Electron Separation
- **CLI Mode** (Completely Independent)
  - `parallel-dev-cli.ts`: No Electron dependencies
  - Terminal-only execution
  - Optional `ImprovedParallelLogViewer` for visual output
  - Package.json bin entry: `kugutsu` command

- **Electron Desktop App** (Standalone Application)
  - VSCode/Cursor-like interface
  - Application menu (File > Open Project, File > Close Project)
  - Project selection dialog with Git repository validation
  - Worktree/submodule checks
  - Error dialogs for invalid projects

- **UI Components**
  - `Toolbar`: Project path display, Open/Change Project buttons
  - `WelcomeScreen`: App logo, feature highlights, CTA, system info
  - `App.tsx`: Conditional rendering based on project state

- **Application Distribution**
  - electron-builder configuration
  - Build scripts: pack, dist, dist:mac/win/linux
  - .dmg (macOS), .exe (Windows), .AppImage/.deb (Linux)

- **Documentation**
  - `spec/CLI_ELECTRON_SEPARATION.md`: Architecture and implementation details
  - Updated README.md and CLAUDE.md

### Changed

- **Architecture**: Migrated from event-driven to LangGraph-based state management
- **Workflow Selection**: Explicit workflow types (parallel/sprint/scrum) instead of implicit
- **State Management**: Unified state object instead of scattered event listeners
- **CLI Entry Point**: `parallel-dev` → `parallel-dev-cli` for clarity
- **Electron Integration**: Child process mode → Standalone desktop application
- **Task Execution**: Event queues → LangGraph streaming
- **Code Review**: Pipeline-based → Graph node-based

### Deprecated

- `parallel-dev.ts`: Legacy entry point (removed in favor of `parallel-dev-cli.ts`)
- `ParallelDevelopmentOrchestratorWithElectron.ts`: Electron integration (replaced by StateStreamManager)
- Event-based state management (use LangGraph streaming)
- Implicit Electron mode (use explicit CLI or Electron app)

### Fixed

- TypeScript compilation errors across all modules
- State update performance (< 5ms with Map-based lookups)
- Log buffering memory leaks (1000 entry cap)
- IPC event throttling (max 20 events/sec)
- Electron window lifecycle management
- Git worktree cleanup on error

### Security

- Git repository validation before operations
- Worktree/submodule detection to prevent nested operations
- Project path sanitization
- IPC message validation

### Performance

- 59% time reduction in parallel task execution
- O(1) task lookups with Map data structure
- State update batching (50ms intervals)
- IPC event throttling and buffering
- Efficient dependency graph calculations

### Testing

- 104 total tasks implemented
- 94 tasks completed (90.4%)
- 50+ integration tests
- Comprehensive unit test coverage
- Performance benchmarks
- Mock-based testing for external dependencies

### Documentation

- Complete README.md overhaul with two usage modes
- CLAUDE.md with AI-first development principles
- Migration Guide (v1 → v2)
- CLI/Electron Separation specification
- Sprint-driven development documentation
- Scrum workflow documentation
- Component specifications
- Data persistence specifications
- Design document specifications

### Breaking Changes

1. **Entry Point Change**
   ```bash
   # Old
   npm run parallel-dev "request"

   # New
   npm run parallel-dev-cli "request"
   ```

2. **Electron Mode**
   ```bash
   # Old
   npm run parallel-dev "request" --electron

   # New (standalone app)
   npm run electron
   # Then: File > Open Project
   ```

3. **Workflow Selection**
   ```bash
   # Old (implicit)
   npm run parallel-dev "request"

   # New (explicit)
   npm run parallel-dev-cli "request" --workflow sprint
   ```

4. **State Management API**
   ```typescript
   // Old (event-driven)
   orchestrator.on('TASK_COMPLETED', handler)

   // New (LangGraph streaming)
   for await (const event of graph.stream(state)) {
     // Handle state updates
   }
   ```

### Migration Path

See [docs/MIGRATION_GUIDE.md](docs/MIGRATION_GUIDE.md) for detailed migration instructions.

**Backward Compatibility**: v1.x CLI mode still available but considered legacy. No new features will be added to the legacy mode.

---

## [1.0.0] - 2024-07-22

### Added
- Initial release with event-driven parallel development
- ProductOwnerAI, EngineerAI, TechLeadAI agents
- ParallelPipelineManager for task coordination
- Git worktree-based isolation
- Electron UI with real-time monitoring
- Terminal visual UI with blessed
- ReviewWorkflow for automated code review
- MergeCoordinator for conflict resolution

---

## Version Numbering

- **Major (X.0.0)**: Breaking changes, architectural overhauls
- **Minor (2.X.0)**: New features, backward-compatible
- **Patch (2.0.X)**: Bug fixes, performance improvements

**Current Version**: 2.0.0 (LangGraph + Scrum Development)
**Previous Version**: 1.0.0 (Event-Driven Architecture)
