# Authentication System Implementation Scenario

## Overview

This scenario demonstrates how Kugutsu's sprint-driven development manages a multi-day, multi-sprint project to build a complete authentication system.

## The Challenge

Building a production-ready authentication system is a complex task that includes:
- Email/password authentication
- OAuth2 integration (Google, GitHub)
- JWT token management
- Password reset flows
- Email service integration
- User profile management
- Security features (rate limiting, hashing, etc.)

This is **too much work for a single sprint** (8-16 hours), so Kugutsu intelligently breaks it down.

## Timeline Breakdown

### Day 1: Project Kickoff (Sprint 1)

**9:00 AM - User Request**:
```bash
cd my-app
kugutsu "Implement a complete user authentication system with email/password, OAuth2, JWT tokens, and password reset"
```

**9:01 AM - CheckModeNode**:
- Analyzes the request
- Checks `.kugutsu/` directory → not found
- **Decision**: New project mode

**9:05 AM - TaskBreakdownNode** (if using old workflow):
- AI analyzes the requirements
- Creates 12 granular tasks:
  1. JWT token utilities (2h)
  2. User model & schema (2h)
  3. Login/logout endpoints (1.5h)
  4. Password hashing (1h)
  5. OAuth2 integration (3h)
  6. Password reset flow (2h)
  7. Email service (2h)
  8. User profile endpoints (1.5h)
  9. Email verification (2h)
  10. RBAC implementation (2.5h)
  11. Integration tests (3h)
  12. API documentation (1.5h)
- Total: ~24 hours of work

**9:10 AM - SprintPlanningNode**:
- Evaluates all 12 tasks
- Selects tasks for Sprint 1 (8 hours target):
  - task-auth-001: JWT tokens (priority 180, no deps)
  - task-auth-002: User model (priority 180, no deps)
  - task-auth-004: Password hashing (priority 180, no deps)
  - task-auth-003: Login endpoints (priority 130, deps: 001, 002)
- Creates Sprint 1 with goal: "Basic authentication foundation"
- Remaining 8 tasks stay in global queue

**9:15 AM - Parallel Execution**:
```
Engineer 1 → task-auth-001 (JWT tokens)
Engineer 2 → task-auth-002 (User model)
Engineer 3 → task-auth-004 (Password hashing)
```

**2:30 PM - First Wave Complete**:
```
✓ task-auth-001 completed (Engineer 1, 3.5h)
✓ task-auth-002 completed (Engineer 2, 4h)
✓ task-auth-004 completed (Engineer 3, 2.5h)

Engineer 3 → task-auth-003 (Login endpoints, deps satisfied)
```

**5:20 PM - Sprint 1 Complete**:
```
✓ task-auth-003 completed (Engineer 3, 2.5h)
All 4 tasks completed, 9 hours actual (8h estimated)
```

**5:25 PM - SprintReviewNode**:
- Reviews all completed tasks
- Checks deployability:
  - ✓ All tasks completed successfully
  - ✓ Code merged to main
  - ✓ Tests passing
  - ✓ E2E testable (users can register and login)
- **Decision**: Sprint 1 is deployable ✨
- Moves sprint to history
- Checks global queue: 8 tasks remaining
- **Decision**: Plan Sprint 2

**6:00 PM - End of Day 1**:
- Sprint 1 completed and deployed
- 4/12 tasks done (33% complete)
- User has working basic authentication
- System ready for Sprint 2

---

### Day 2: Continuation (Sprint 2)

**9:00 AM - User Returns**:
```bash
kugutsu "続き"
```

**9:01 AM - CheckModeNode**:
- Checks `.kugutsu/tasks/global-queue.json` → found with 8 pending tasks
- Checks `.kugutsu/sprints/active-sprint.json` → null (Sprint 1 completed)
- Analyzes user request "続き" → continuation keyword
- **Decision**: Continuation mode detected

**9:05 AM - SprintPlanningNode**:
- Loads 8 pending tasks from global queue
- Selects tasks for Sprint 2 (10 hours target):
  - task-auth-007: Email service (priority 170, no deps)
  - task-auth-005: OAuth2 integration (priority 130, deps: 002 ✓)
  - task-auth-006: Password reset (priority 130, deps: 002 ✓)
  - task-auth-008: User profile (priority 120, deps: 001 ✓, 002 ✓)
- Creates Sprint 2 with goal: "OAuth2 and password management"
- Remaining 4 tasks stay in global queue

**9:10 AM - Parallel Execution**:
```
Engineer 1 → task-auth-007 (Email service)
Engineer 2 → task-auth-005 (OAuth2)
Engineer 3 → task-auth-006 (Password reset)
```

**Currently In Progress** (as shown in active-sprint.json):
- 3 engineers working in parallel
- Sprint 2 status: "active"
- Estimated completion: ~7:00 PM

**Expected 7:00 PM - Sprint 2 Complete**:
- 4 more tasks completed (8/12 total = 67%)
- Users can now login with Google/GitHub
- Password reset functionality working
- System ready for Sprint 3

---

### Day 3: New Requirements (Sprint 3)

**9:00 AM - User Adds Features**:
```bash
kugutsu "Add two-factor authentication and session management"
```

**9:01 AM - CheckModeNode**:
- Checks `.kugutsu/` → found with existing project
- Analyzes request → new requirements (not just "続き")
- **Decision**: Continuation mode + new requirements

**9:05 AM - TaskBreakdownNode**:
- Creates 4 new tasks for 2FA and sessions:
  - task-auth-013: TOTP 2FA implementation (90 priority)
  - task-auth-014: Session management (85 priority)
  - task-auth-015: Security audit logging (80 priority)
  - task-auth-016: 2FA testing (85 priority)
- Adds to global queue (now 8 tasks total)

**9:10 AM - PriorityCalculator**:
- Recalculates all task priorities:
  - New tasks get high recencyBonus (100) → higher priority
  - Old tasks get lower recencyBonus (0-50)
- Resulting priorities:
  - task-auth-013: 90 + 100 = 190 (highest!)
  - task-auth-011: 85 + 50 = 135 (old test task)
  - task-auth-009: 75 + 50 = 125 (old email verification)

**9:15 AM - SprintPlanningNode**:
- Selects highest priority tasks for Sprint 3:
  - task-auth-013: 2FA implementation (priority 190, new!)
  - task-auth-014: Session management (priority 185, new!)
  - task-auth-011: Integration tests (priority 135, old)
  - task-auth-009: Email verification (priority 125, old)
- **Mix of old and new tasks based on priority**
- Creates Sprint 3 with goal: "Advanced security features"

**Expected 7:00 PM - Sprint 3 Complete**:
- 4 more tasks completed (12/16 total = 75%)
- 2FA working for users who enable it
- Comprehensive test coverage
- 4 tasks remaining (RBAC, documentation, etc.)

---

## Key Concepts Demonstrated

### 1. Automatic Task Breakdown

The initial request is automatically broken into 12 manageable tasks:
- Each task is independently achievable (1-3 hours)
- Dependencies are identified (e.g., login depends on JWT + User model)
- Tasks are typed (feature, test, documentation)
- Base priorities assigned based on type and importance

### 2. Sprint Planning Strategy

**Sprint 1** (Foundation):
- Selected tasks with **no dependencies** (parallel execution)
- Focused on core infrastructure (JWT, User model, Login)
- 8-hour target, actually took 9 hours

**Sprint 2** (Extension):
- Selected tasks whose **dependencies are now satisfied**
- Mixed independent (email service) and dependent (OAuth, password reset) tasks
- 10-hour target (larger scope than Sprint 1)

**Sprint 3** (Advanced + New):
- **Prioritizes new high-priority tasks** (2FA from Day 3 request)
- **Includes old pending tasks** (tests, verification)
- Demonstrates dynamic re-prioritization

### 3. Continuation Mode Detection

Kugutsu detects three scenarios:

**New Project** (Day 1):
```bash
kugutsu "Implement auth system"
# → No .kugutsu/ directory → new project
```

**Pure Continuation** (Day 2):
```bash
kugutsu "続き"
# → .kugutsu/ exists + continuation keyword → resume
```

**Continuation + New Requirements** (Day 3):
```bash
kugutsu "Add 2FA"
# → .kugutsu/ exists + new feature request → extend project
```

### 4. Dynamic Priority Calculation

Tasks are re-prioritized whenever new tasks are added:

**Formula**:
```
dynamicPriority = basePriority + recencyBonus + dependencyBonus

basePriority: 60-90 (documentation=60, feature=80, test=85, bug=90)
recencyBonus: 0-100 (newer requests = 100, older = 0-50)
dependencyBonus: 0-50 (all deps completed = +50)
```

**Example** (Day 3):
- **task-auth-013** (2FA, new): 90 + 100 + 0 = 190
- **task-auth-011** (tests, old): 85 + 50 + 50 = 185
- **task-auth-012** (docs, old): 60 + 50 + 0 = 110

The new 2FA task jumps to highest priority due to recency!

### 5. Parallel Execution

Each sprint runs up to 3 engineers in parallel:
- Engineers work in isolated git worktrees
- Independent tasks run simultaneously
- Dependent tasks wait for dependencies to complete
- Sequential merging prevents conflicts

**Sprint 1 Timeline**:
```
09:15 ─┬─ Engineer 1 → JWT tokens ──────────── 12:45 ✓
       ├─ Engineer 2 → User model ─────────────── 13:15 ✓
       └─ Engineer 3 → Password hashing ──── 11:45 ✓
                                               │
14:45 ──── Engineer 3 → Login (deps: JWT+User) ── 17:20 ✓
```

### 6. Sprint Review & Deployability

After each sprint, SprintReviewNode checks:
- ✓ All tasks completed without failures
- ✓ Code merged to main branch
- ✓ Tests passing
- ✓ **E2E deployable** (user can actually use the feature)
- ✓ No critical blockers

**Sprint 1 Review**:
- Deliverable: "Users can register and login with email/password"
- E2E testable: ✓ Manual testing shows full flow works
- Deployable: ✓ Can ship this to production

### 7. Cross-Sprint Learning

Sprint metadata captures learnings for future sprints:

**Sprint 1 → Sprint 2**:
- Lesson: "Need email verification to prevent fake accounts"
- Action: Added task-auth-009 to Sprint 3
- Decision: Use SendGrid (learned in Sprint 1 planning)

**Sprint 2 → Sprint 3**:
- Lesson: "OAuth reduces user friction significantly"
- Action: Prioritize 2FA implementation for security-conscious users
- Decision: Make 2FA optional (not mandatory)

## File Structure Walkthrough

### `.kugutsu/tasks/global-queue.json`

Contains all tasks (completed, in-progress, pending):

```json
{
  "tasks": [
    {
      "id": "task-auth-001",
      "status": "completed",          // Sprint 1 ✓
      "dynamicPriority": 180,
      "requestTimestamp": "2025-01-15T09:00:00.000Z",
      "sprintId": "sprint-001"
    },
    {
      "id": "task-auth-005",
      "status": "in_progress",        // Sprint 2 (ongoing)
      "dynamicPriority": 130,
      "dependencies": ["task-auth-002"],  // ✓ satisfied
      "sprintId": "sprint-002"
    },
    {
      "id": "task-auth-009",
      "status": "pending",            // Sprint 3 (planned)
      "dynamicPriority": 125,
      "sprintId": null
    }
  ]
}
```

### `.kugutsu/sprints/active-sprint.json`

Current sprint (Sprint 2) in progress:

```json
{
  "id": "sprint-002",
  "status": "active",
  "taskIds": ["task-auth-005", "task-auth-006", "task-auth-007", "task-auth-008"],
  "metadata": {
    "completedTasksCount": 0,       // Engineers still working
    "blockers": [],                 // No blockers detected
    "technicalDecisions": [...]     // Captured for documentation
  }
}
```

### `.kugutsu/sprints/sprint-history.json`

Completed sprints with rich metadata:

```json
{
  "sprints": [
    {
      "id": "sprint-001",
      "status": "completed",
      "completedAt": "2025-01-15T18:00:00.000Z",
      "metadata": {
        "actualHours": 9,           // vs 8 estimated
        "outcomes": {
          "delivered": [...],       // What we shipped
          "tested": [...],          // How we tested it
          "documentation": [...]    // What we documented
        },
        "lessonsLearned": [...],    // For retrospective
        "nextSprintRecommendations": [...]  // Sprint 2 suggestions
      }
    }
  ]
}
```

### `.kugutsu/projects/project-auth-2025/project.json`

Project-level tracking:

```json
{
  "completedTasks": 4,              // 4/12 after Sprint 1
  "currentSprintId": "sprint-002",
  "metadata": {
    "sprintsCompleted": 1,
    "deliverables": [
      {
        "name": "Basic Authentication",
        "status": "completed",      // Sprint 1 ✓
        "sprintId": "sprint-001"
      },
      {
        "name": "OAuth2 & Password Recovery",
        "status": "in_progress",    // Sprint 2 (ongoing)
        "sprintId": "sprint-002"
      }
    ],
    "architecturalDecisions": [...],  // For documentation
    "timeline": {
      "estimatedCompletion": "2025-01-18T18:00:00.000Z"
    }
  }
}
```

## Testing This Scenario

You can simulate this exact scenario:

```bash
# 1. Copy this example to a test directory
cp -r examples/sprint-driven-workflow /tmp/test-auth

# 2. Clear the .kugutsu/ to start fresh
cd /tmp/test-auth
rm -rf .kugutsu

# 3. Initialize a git repo (required for worktrees)
git init
git add .
git commit -m "Initial commit"

# 4. Run Day 1
kugutsu "Implement a complete user authentication system with email/password, OAuth2, JWT tokens, and password reset"
# → Will create Sprint 1 and start execution

# 5. After Sprint 1 completes, run Day 2
kugutsu "続き"
# → Will detect continuation and create Sprint 2

# 6. After Sprint 2 completes, run Day 3
kugutsu "Add two-factor authentication and session management"
# → Will add new tasks and create Sprint 3
```

## Expected Outcomes

After running this scenario, you should see:

**File System**:
```
.kugutsu/
├── tasks/global-queue.json          (12-16 tasks depending on progress)
├── sprints/active-sprint.json       (current sprint)
├── sprints/sprint-history.json      (1-2 completed sprints)
└── projects/project-auth-*/         (auto-generated project ID)
```

**Git Branches**:
```bash
git branch -a
# → main
# → task/task-auth-001 (merged)
# → task/task-auth-002 (merged)
# → ...
```

**Working Features**:
- Day 1: Basic login/logout with email/password
- Day 2: OAuth2 login + password reset
- Day 3: 2FA + comprehensive testing

## Conclusion

This scenario demonstrates how Kugutsu transforms a large, ambiguous request ("build auth system") into a structured, multi-sprint delivery:

1. **Automatic breakdown** into manageable tasks
2. **Intelligent sprint planning** (8-16h deployable units)
3. **Seamless continuation** across multiple sessions
4. **Dynamic prioritization** when new requirements arrive
5. **Parallel execution** for maximum efficiency
6. **Rich metadata capture** for documentation and learning

The result: A production-ready authentication system delivered incrementally over 3 days with clear progress tracking and deployable milestones.
