# Migration Guide: Kugutsu v1 → v2

**Version**: 2.0
**Date**: 2025-11-07
**Status**: Final

## Overview

Kugutsu v2 introduces significant architectural improvements and new features:

- **LangGraph-based workflow** for better state management and parallel execution
- **Scrum development workflow** with story mapping and design-first approach
- **Sprint-driven development** with dynamic prioritization and global task queue
- **Electron desktop application** with visual UI for monitoring
- **CLI/Electron separation** for independent usage modes

## Architecture Changes

### v1.x Architecture (Legacy)

```
ParallelDevelopmentOrchestrator
├─ ProductOwnerAI: Task analysis
├─ EngineerAI pool: Parallel implementation
├─ TechLeadAI pool: Code review
├─ ParallelPipelineManager: Event-driven coordination
└─ GitWorktreeManager: Git operations
```

### v2.x Architecture (LangGraph-based)

```
LangGraph Workflow
├─ State Management: @langchain/langgraph Annotation
├─ Graph Nodes:
│  ├─ ProductOwnerNode: Requirements analysis
│  ├─ EngineerDispatchNode: Task distribution
│  ├─ EngineerNode: Implementation (parallel)
│  ├─ ReviewNode: Code review (parallel)
│  └─ MergeCoordinatorNode: Sequential merging
├─ Sprint-Driven Workflow:
│  ├─ CheckModeNode: AI-driven continuation detection
│  ├─ SprintPlanningNode: 8-16h sprint creation
│  └─ SprintReviewNode: Sprint completion check
└─ Scrum Workflow:
   ├─ DirectorAI: Story mapping creation
   ├─ ReviewStoryMappingNode: ProductOwner review
   ├─ TechLeadDesignNode: Design docs generation
   ├─ ReviewDesignNode: 3-party collaborative review
   └─ TaskBreakdownNode: Task decomposition
```

## Breaking Changes

### 1. Workflow Selection

**v1.x (implicit)**:
```bash
# Always used parallel pipeline
npm run parallel-dev "Add user authentication"
```

**v2.x (explicit)**:
```bash
# Sprint-driven workflow (default)
npm run parallel-dev-cli "Add user authentication"

# Scrum workflow (complex projects)
npm run parallel-dev-cli "Build a task management app" --workflow scrum

# Standard parallel (simple tasks)
npm run parallel-dev-cli "Fix typo in README" --workflow parallel
```

### 2. State Management

**v1.x (event-driven)**:
```typescript
// Events: DEVELOPMENT_COMPLETED, REVIEW_COMPLETED, MERGE_READY
orchestrator.on('DEVELOPMENT_COMPLETED', handler);
```

**v2.x (LangGraph state)**:
```typescript
// Unified state with Annotation.Root
const state: ParallelDevStateType = {
  userRequest,
  tasks, completedTasks, failedTasks,
  reviews, mergeQueue,
  logs, worktrees, metadata,
  // Sprint-driven fields
  globalTasks, projects, sprints, activeSprint,
  // Scrum fields
  storyMapping, designDocs, dependencyGraph
}
```

### 3. CLI vs Electron

**v1.x (mixed)**:
```bash
# Electron mode by default
npm run parallel-dev "..."

# CLI mode with flag
npm run parallel-dev "..." --no-electron
```

**v2.x (separated)**:
```bash
# CLI mode (completely independent)
npm run parallel-dev-cli "..."

# Electron app (standalone desktop application)
npm run electron
# Then: File > Open Project
```

## New Features Guide

### Sprint-Driven Development

**When to use**: Multi-sprint projects with evolving requirements

```bash
# First sprint
npm run parallel-dev-cli "Build authentication system"
# → Creates global task queue
# → Plans sprint 1 (8-16h)
# → Executes tasks in parallel

# Continue development (same project)
npm run parallel-dev-cli "Continue development"
# → AI detects continuation mode
# → Recalculates priorities
# → Plans next sprint from remaining tasks
```

**Data persistence**:
```
.kugutsu/
├─ tasks/global-queue.json      # All project tasks
├─ sprints/
│  ├─ active-sprint.json        # Current sprint
│  └─ sprint-history.json       # Completed sprints
└─ projects/{projectId}/
   └─ project.json              # Project metadata
```

### Scrum Development Workflow

**When to use**: Complex projects requiring design-first approach

```bash
npm run parallel-dev-cli "Build task management application" --workflow scrum
```

**Workflow steps**:

1. **Story Mapping** (DirectorAI)
   - Persona definition
   - Epic breakdown
   - User stories with acceptance criteria
   - Output: `.kugutsu/projects/{id}/story-mapping.json`

2. **Story Review** (ProductOwnerAI)
   - Validates stories against persona goals
   - Checks epic organization
   - Iterative refinement until approved

3. **Design Phase** (TechLeadAI)
   - Overall architecture design
   - UI/UX wireframes
   - Database schema (ER diagram)
   - API specifications (OpenAPI)
   - Output: `.kugutsu/projects/{id}/design-docs/`

4. **Design Review** (3-party collaborative)
   - DirectorAI: Business alignment
   - ProductOwnerAI: Story mapping consistency
   - TechLeadAI: Technical feasibility
   - Iterative refinement until all approve

5. **Task Breakdown** (Automated)
   - Micro end-to-end tasks (4-8h each)
   - Dependency graph generation
   - Critical path calculation
   - Parallel execution groups
   - Output: `.kugutsu/projects/{id}/tasks/`

6. **Sprint Execution** (Standard workflow)
   - Tasks executed in parallel
   - Automated code review
   - Sequential merging

### Electron Desktop Application

**When to use**: Visual monitoring, large projects, UI-driven workflow

```bash
# Start Electron app
npm run electron

# Or build distributable
npm run dist:mac    # macOS .dmg
npm run dist:win    # Windows .exe
npm run dist:linux  # Linux AppImage
```

**Features**:
- VSCode/Cursor-like interface
- Project selection dialog
- Real-time task monitoring
- Dependency graph visualization
- Story mapping viewer
- Design documents viewer
- Log streaming

## Migration Checklist

### For Existing Projects

- [ ] **Review current workflow**
  - Identify project type (simple/complex)
  - Choose appropriate workflow (parallel/sprint/scrum)

- [ ] **Update CLI commands**
  - Replace `parallel-dev` with `parallel-dev-cli`
  - Add `--workflow` flag if needed

- [ ] **Adopt new features** (optional)
  - Try sprint-driven development for multi-sprint projects
  - Use scrum workflow for complex new projects
  - Install Electron app for visual monitoring

- [ ] **Data migration** (if needed)
  - No migration required for simple projects
  - Sprint data auto-generated on first run
  - Scrum data created during workflow

### For Development/Integration

- [ ] **Update imports**
  ```typescript
  // Old
  import { ParallelDevelopmentOrchestrator } from './managers/...'

  // New (LangGraph-based)
  import { ParallelDevOrchestrator } from './electron/...'
  import { compileSprintDrivenGraph, compileScrumDevGraph } from './graph/...'
  ```

- [ ] **Use new state management**
  ```typescript
  // Old: Event listeners
  orchestrator.on('TASK_COMPLETED', ...)

  // New: LangGraph streaming
  for await (const event of graph.stream(state)) {
    // Handle state updates
  }
  ```

- [ ] **Integrate with Electron** (optional)
  ```typescript
  import { StateStreamManager } from './electron/StateStreamManager'

  const streamManager = new StateStreamManager({
    bufferInterval: 50,
    maxEventsPerSecond: 20
  })
  ```

## Backward Compatibility

### v1.x Features Still Supported

- ✅ CLI mode (via `parallel-dev-cli`)
- ✅ Git worktree isolation
- ✅ Parallel task execution
- ✅ Automated code review
- ✅ Conflict resolution

### Deprecated Features

- ⚠️ `parallel-dev` entry point (use `parallel-dev-cli`)
- ⚠️ Implicit Electron mode (now explicit)
- ⚠️ Event-based state management (use LangGraph)

### Legacy Mode

The v1.x architecture (`ParallelDevelopmentOrchestrator`) is still available via CLI mode but is considered legacy. It will continue to work but won't receive new features.

**Recommendation**: Gradually migrate to LangGraph-based workflows for new projects.

## Troubleshooting

### "Cannot find module 'parallel-dev'"

**Solution**: Update to `parallel-dev-cli`
```bash
npm run parallel-dev-cli "your request"
```

### "Electron window not opening"

**Solution**: Use standalone Electron app
```bash
npm run electron
# Then: File > Open Project
```

### "Sprint data not found"

**Solution**: Let the system auto-generate on first run
```bash
# System will detect new project and create sprint data
npm run parallel-dev-cli "your request"
```

### "Story mapping approval loop"

**Solution**: Review AI feedback and refine requirements
```bash
# Check review feedback in logs
# Adjust user request to address concerns
# Re-run workflow
```

## Support & Resources

- **Documentation**: `docs/` directory
- **Examples**: `examples/` directory
  - `sprint-driven-workflow/`: Sprint system examples
  - `scrum-workflow/`: Scrum artifacts examples
- **GitHub Issues**: Report bugs and feature requests
- **CLAUDE.md**: Development guidelines for contributors

## Version History

- **v2.1**: Scrum development workflow (Phase 6)
- **v2.0**: LangGraph integration, Sprint-driven development
- **v1.x**: Event-driven parallel development (legacy)

---

**Need help?** Open an issue at https://github.com/anthropics/kugutsu/issues
