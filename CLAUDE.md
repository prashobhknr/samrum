# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Doorman** is a door/lock management system built on BPMN process orchestration (Camunda 7). It replaces a legacy SAS-based system (Samrum) with database-driven object definitions, dynamic permission-filtered forms, and full audit trails.

Current phase: **Phase 3 - Dynamic Forms** (branch: `feature/phase-3-dynamic-forms`)

## Repository Structure

```
doorman/
├── backend/          # Express.js + TypeScript API (port 3000)
│   └── src/
│       ├── index.ts  # Server entry point
│       ├── api/      # Route handlers (objects.ts, forms.ts)
│       └── services/ # Business logic (formService.ts, permissionService.ts)
├── frontend/         # Next.js 14 + TypeScript UI (port 3001)
│   ├── pages/        # Next.js pages
│   │   ├── admin/    # Admin section (B000–B014 features)
│   │   ├── tasks/    # Task worker portal
│   │   ├── modules/  # Module management
│   │   └── objects/  # Object instance views
│   ├── components/   # Shared UI (SamrumLayout, DynamicForm, DataGrid, etc.)
│   └── lib/          # API client (api.ts), auth (auth.ts), store (store.ts)
├── database/
│   └── migrations/   # SQL migration files (auto-run in Docker)
└── docker-compose.yml
```

## Commands

### Backend (run from `backend/`)
```bash
npm run dev          # Start dev server with ts-node
npm run build        # Compile TypeScript to dist/
npm run typecheck    # Type-check without emitting
npm run lint         # ESLint check
npm run lint:fix     # Auto-fix lint issues
npm test             # Run all Jest tests
npm test -- ObjectService  # Run a specific test file
npm run test:coverage
npm run migrate      # Run database migrations
npm run seed         # Seed sample data
```

### Frontend (run from `frontend/`)
```bash
npm run dev          # Start Next.js dev server
npm run build        # Production build
npm run lint         # Next.js lint
npm run type-check   # TypeScript check
npm test             # Jest + jsdom tests
```

### Docker
```bash
docker-compose up -d          # Start PostgreSQL + pgAdmin + backend
docker-compose down           # Stop all services
docker-compose logs -f        # Tail all logs
```

## Architecture

### Backend Layer Pattern
```
Request → Route (src/api/*.ts) → Service (src/services/*.ts) → PostgreSQL
```

The backend uses a factory pattern for routers: `createObjectsRouter(db)` and `createFormsRouter(db)` receive a `pg.Client` instance. There are no separate controller files — logic lives directly in the service classes.

### OMS Database Schema (11 core tables)
- `object_types` / `object_attributes` — schema definitions (e.g., Door has 60+ attributes)
- `object_instances` / `attribute_values` — actual data rows
- `object_relationships` — links between object types
- `permissions` — group-level attribute access (READ/WRITE/DELETE + scope: ALL/OWN/ASSIGNED)
- `task_permission_rules` — per-task field visibility/editability by user group
- `field_dependencies` — conditional show/hide logic (e.g., lock_type=electronic → show battery_status)
- `attribute_validators` — per-attribute validation rules
- `task_object_mappings` — Camunda task ↔ object instance links
- `audit_log` — immutable log of all changes

Also present: Samrum-specific tables from `002_samrum_schema.sql` (samrum_object_types, samrum_modules, samrum_projects, etc.)

### Dynamic Form Generation

`FormService.generateFormForTask(taskId, doorInstanceId, userGroup)`:
1. Queries `task_permission_rules` for visible/editable/required attribute IDs for this task+group
2. Queries `permissions` for base READ/WRITE grants
3. Loads current `attribute_values` for the door instance
4. Final visibility = `task_rule.visible` AND user has `READ` permission
5. Final editable = `task_rule.editable` AND user has `WRITE` permission
6. Returns a `FormSchema` JSON consumed by `DynamicForm` React component

### Multi-Group Permission Merging
- **Visible attributes**: UNION across all user groups
- **Editable attributes**: INTERSECTION across all user groups
- **Required attributes**: UNION across all user groups

### Frontend Auth
Auth is stored in `localStorage` as a base64 token (for demo). `lib/auth.ts` handles login/logout, `lib/api.ts` (Axios singleton) reads the token via an interceptor. Pages read user from `getStoredUser()`.

### Frontend Layout
All pages use `SamrumLayout` (from `components/SamrumLayout.tsx`) which renders:
- Fixed `Header` at top
- Optional left sidebar (tree nav)
- Main content area
- Optional right panel

UI labels are in **Swedish** (the system is deployed in a Swedish context).

## Database

- **Connection**: `postgresql://doorman_user:doorman_pass@localhost:5432/doorman_db`
- **pgAdmin**: http://localhost:5050 (admin@doorman.local / admin)
- Migrations in `database/migrations/` are automatically applied when the Docker postgres container initializes (via `docker-entrypoint-initdb.d`)
- All SQL queries in backend services use **parameterized queries** (`$1`, `$2`) — never interpolate user input

## Commit Convention

```
[PHASE-#] type: description

Types: feat, fix, docs, refactor, test, chore
```


# Workflow Orchestration

## 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately – don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

## 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

## 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

## 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

## 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes – don't over-engineer
- Challenge your own work before presenting it

## 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests – then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## The "Progress & Pruning" Protocol
- **Action Interval:** Every 2 tool actions (edits or shell commands), you MUST update `progress.md`.
- **The progress.md Structure:**
  - `## Current Objective`: The high-level goal.
  - `## Findings`: Bullet points of what was discovered in the last 2 actions.
  - `## Next Steps`: The immediate plan for the next 2 actions.
- **Context Preservation:** Before any major refactor, copy the relevant original logic into a blockquote in `progress.md` labeled `[ORIGINAL CONTEXT]`.
- **Aggressive Cleanup:**
  - After completing a sub-task, use the `/compact` command to summarize the session and clear the token buffer.
  - Delete temporary debug files, `.log` files, or "test_fix_v1.ts" files immediately after verification.

  