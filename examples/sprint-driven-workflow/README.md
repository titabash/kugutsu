# Sprint-Driven Development Example

This example demonstrates how Kugutsu's sprint-driven development feature works with a real-world scenario: implementing a user authentication system.

## Scenario

A developer wants to build a complete user authentication system for their Node.js application. The work is too large for a single sprint, so Kugutsu breaks it down into multiple 8-16 hour sprints.

### Timeline

**Day 1 - Initial Request**:
```bash
cd my-app
kugutsu "Implement a complete user authentication system with email/password, OAuth2, JWT tokens, and password reset"
```

**What Kugutsu does**:
1. **CheckMode**: Detects this is a new project
2. **TaskBreakdown**: Creates 12 granular tasks
3. **SprintPlanning**: Groups tasks into Sprint 1 (8 hours)
4. **Execution**: 3 AI engineers work in parallel
5. **SprintReview**: Verifies Sprint 1 is deployable

**Day 2 - Continuation**:
```bash
kugutsu "続き"  # or "continue"
```

**What Kugutsu does**:
1. **CheckMode**: Detects continuation mode (existing tasks in queue)
2. **SprintPlanning**: Creates Sprint 2 with remaining high-priority tasks
3. **Execution**: Continues implementation
4. **SprintReview**: Verifies Sprint 2 is deployable

**Day 3 - New Requirements**:
```bash
kugutsu "Add two-factor authentication and session management"
```

**What Kugutsu does**:
1. **CheckMode**: Detects continuation + new requirements
2. **TaskBreakdown**: Adds 4 new tasks to global queue
3. **Priority Calculation**: New tasks get high priority (recency bonus)
4. **SprintPlanning**: Creates Sprint 3 with mix of old + new tasks

## Data Persistence Structure

This example includes sample `.kugutsu/` directory contents showing the state after Day 2:

```
.kugutsu/
├── tasks/
│   └── global-queue.json       # 12 tasks (8 completed, 4 pending)
├── sprints/
│   ├── active-sprint.json      # Sprint 2 (in progress)
│   └── sprint-history.json     # Sprint 1 (completed)
└── projects/
    └── project-auth-2025/
        └── project.json        # Project metadata
```

### File Contents

#### `global-queue.json`
Contains all tasks across the project lifecycle:
- Tasks from initial request
- Tasks from continuation requests
- Priority calculations (base + recency + dependency bonuses)
- Status tracking (pending, in_progress, completed, failed)

#### `active-sprint.json`
Current sprint being executed:
- Sprint goal and deliverable
- Task IDs assigned to this sprint
- Estimated hours (8-16h range)
- Status and metadata

#### `sprint-history.json`
Completed sprints:
- Sprint 1: JWT auth + basic login (completed)
- Timestamps, outcomes, and learnings

#### `project.json`
Project-level metadata:
- Project ID and user request
- Total tasks and completion count
- Request timestamp for priority calculation

## Key Concepts Demonstrated

### 1. Continuation Mode Detection
The system automatically detects when you're continuing vs. starting new:
```bash
# New project
kugutsu "Build auth system"
# → Creates new project, Sprint 1

# Continuation (same directory)
kugutsu "続き"
# → Detects existing .kugutsu/, continues with Sprint 2

# New requirements (same project)
kugutsu "Add 2FA"
# → Detects existing project, adds new tasks with high priority
```

### 2. Dynamic Priority Calculation
Tasks are prioritized based on:
```
dynamicPriority = basePriority + recencyBonus + dependencyBonus

basePriority: 0-100 (feature=80, bug=90, refactor=60)
recencyBonus: 0-100 (newer requests = higher priority)
dependencyBonus: 0-50 (tasks with completed dependencies = higher priority)
```

### 3. Sprint Planning Strategy
- **Sprint Size**: 8-16 estimated hours
- **Deployable Units**: Each sprint delivers E2E testable feature
- **Task Selection**: High-priority tasks with satisfied dependencies
- **Parallel Execution**: Max 3 engineers per sprint (configurable)

### 4. Multi-Project Support
Each repository can have multiple projects:
```bash
cd my-app
kugutsu "Build auth system"           # project-auth-2025
kugutsu "Add payment integration"     # project-payments-2025
kugutsu "続き"                         # AI detects which project to continue
```

Projects are isolated by `projectId` in `global-queue.json`.

## Usage Instructions

### View the Example Data

```bash
cd examples/sprint-driven-workflow

# View all tasks
cat .kugutsu/tasks/global-queue.json | jq '.tasks[] | {id, title, status, dynamicPriority}'

# View active sprint
cat .kugutsu/sprints/active-sprint.json | jq '{id, name, goal, taskIds, status}'

# View sprint history
cat .kugutsu/sprints/sprint-history.json | jq '.sprints[] | {id, name, status, completedAt}'

# View project metadata
cat .kugutsu/projects/project-auth-2025/project.json | jq
```

### Simulate This Scenario

You can recreate this scenario in your own project:

```bash
# 1. Start fresh
cd your-project
rm -rf .kugutsu  # Clear any existing state

# 2. Day 1: Initial request
kugutsu "Implement a complete user authentication system with email/password, OAuth2, JWT tokens, and password reset"
# Wait for Sprint 1 to complete

# 3. Day 2: Continue
kugutsu "続き"
# Wait for Sprint 2 to complete

# 4. Day 3: New requirements
kugutsu "Add two-factor authentication and session management"
# Sprint 3 will include both old pending tasks and new high-priority tasks
```

## Expected Outcomes

### Sprint 1 (Day 1)
**Goal**: Basic authentication foundation
**Tasks** (4 tasks, ~8 hours):
- JWT token generation and validation
- User model and database schema
- Basic login/logout endpoints
- Password hashing utilities

**Deliverable**: Users can register and login with email/password

### Sprint 2 (Day 2)
**Goal**: OAuth2 and password management
**Tasks** (4 tasks, ~10 hours):
- OAuth2 provider integration (Google, GitHub)
- Password reset flow (email tokens)
- Email service integration
- User profile endpoints

**Deliverable**: Users can login with OAuth2 and reset passwords

### Sprint 3 (Day 3)
**Goal**: Advanced security features
**Tasks** (4 tasks, ~12 hours):
- Two-factor authentication (TOTP)
- Session management and refresh tokens
- Account security endpoints
- Security audit logging

**Deliverable**: Production-ready auth system with 2FA

## Troubleshooting This Example

If you run into issues while testing this scenario:

**Q: Continuation mode not detected**
```bash
# Ensure you're in the same directory
pwd
ls .kugutsu/

# Explicitly reference the project
kugutsu "Continue working on authentication"
```

**Q: Tasks in wrong priority order**
```bash
# Check current priorities
cat .kugutsu/tasks/global-queue.json | jq '.tasks[] | {title, dynamicPriority}' | sort -k2 -n -r

# Newer requests automatically get higher recency bonus
```

**Q: Want to reset and try again**
```bash
rm -rf .kugutsu worktrees/
kugutsu "Start fresh with your request"
```

## Additional Resources

- [Sprint-Driven Development Workflow](../../docs/parallel-development-workflow.md)
- [Data Persistence Specification](../../spec/DATA_PERSISTENCE_SPECIFICATION.md)
- [Architecture Design](../../spec/ARCHITECTURE_DESIGN.md)
