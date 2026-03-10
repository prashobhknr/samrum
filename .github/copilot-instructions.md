# Doorman — Copilot Instructions

BPMN-driven door/lock management system (Operaton, open-source Camunda 7 fork) replacing legacy SAS-based Samrum. PostgreSQL OMS schema, Express.js backend, Next.js 14 frontend. Swedish UI labels.

You are operating in GSD (Get Shit Done) mode. See [.ai/workflow.md](../.ai/workflow.md) for workflow rules and GSD agent usage.

GSD Rules:
- Always propose concrete code changes — patch-ready solutions
- Prefer editing files directly — avoid long explanations
- If uncertain, inspect the repository before answering
- Read `.planning/STATE.md` at session start to understand current position
- Use GSD subagents for research, planning, and verification

## Key References

| File | Purpose |
|------|---------|
| `.planning/STATE.md` | Current phase, progress, decisions, blockers |
| `.planning/ROADMAP.md` | Phase breakdown with success criteria |
| `.planning/PROJECT.md` | Project overview and requirements |
| `.ai/workflow.md` | GSD workflow rules and agent table |
| `CLAUDE.md` | Detailed architecture, DB schema, permission model |

## Repository Layout

```
backend/src/           Express.js + TypeScript API (port 3000)
  api/                 Route handlers (objects, forms, bim, portfolio)
  services/            FormService, PermissionService (classes, not functions)
  delegates/           50+ Operaton (Camunda 7) service task delegates
frontend/              Next.js 14 + TypeScript UI (port 3001)
  pages/               Next.js pages router (NOT app router)
  components/          Shared UI (SamrumLayout, DynamicForm, DataGrid, etc.)
  lib/                 api.ts (Axios), auth.ts (localStorage), store.ts (Zustand)
database/migrations/   SQL migrations (001–013), applied via psql or backend migrate script
processes/             BPMN files: 8 lifecycle phases, 14 discipline subprocesses
```

## Build & Test

```bash
# Backend (from backend/)
npm run dev            # ts-node dev server, port 3000
npm run build          # tsc → dist/
npm run typecheck      # tsc --noEmit
npm test               # Jest
npm run lint           # ESLint

# Frontend (from frontend/)
npm run dev            # Next.js dev, port 3001
npm run build          # Production build
npm run type-check     # tsc --noEmit
npm test               # Jest + React Testing Library

# Database
# PostgreSQL runs locally (not Docker). Ensure PostgreSQL is installed and running.
# Connection: postgresql://doorman_user:doorman_pass@localhost:5432/doorman_db
```

## Code Conventions

### Backend
- **ESM modules**: `"type": "module"` — use `import`/`export`, not `require`
- **Router factory**: `createObjectsRouter(db: Client): Router` — receives `pg.Client`
- **Parameterized queries only**: `$1`, `$2` — never interpolate user input into SQL
- **Delegate pattern**: implements `CamundaDelegate` interface with `execute(execution, db)` → `DelegateResult`
- **TypeScript strict mode**: all strict flags enabled, no path aliases

### Frontend
- **Functional components** with TypeScript interfaces — no class components
- **Zustand** for state (`useAppStore()`) — not Redux or Context
- **react-hook-form** for form handling
- **Axios singleton** (`lib/api.ts`) with auth interceptor
- **Tailwind** with `samrum-*` design tokens (header, accent, blue, bg, panel, border, text, muted)
- **Path alias**: `@/*` → `./*` (e.g., `@/lib/api`)
- **Pages router**: `pages/` directory, dynamic routes with `[id].tsx`

### Testing
- Jest 29 + ts-jest (backend), Jest 29 + @testing-library/react (frontend)
- Backend integration tests may require a running database
- Use `render`, `screen`, `fireEvent`, `userEvent` from Testing Library

### General
- **UI language**: Swedish — all labels, placeholders, error messages
- **Commit format**: `[PHASE-#] type: description` (types: feat, fix, docs, refactor, test, chore)

## Architecture — Key Concepts

### Dynamic Form Generation (Phase 3 core)
`FormService.generateFormForTask(taskId, doorInstanceId, userGroup)`:
1. Load `task_permission_rules` → field visibility per task + group
2. Load base `permissions` → READ/WRITE grants
3. Load `attribute_values` → current door data
4. `visible` = task_rule.visible AND READ; `editable` = task_rule.editable AND WRITE
5. Returns `FormSchema` JSON → consumed by `DynamicForm` component

### Multi-Group Permission Merging
- **Visible / Required**: UNION across groups
- **Editable**: INTERSECTION (most restrictive wins)

### OMS Schema (11 core tables)
`object_types` → `object_attributes` → `object_instances` → `attribute_values`
Plus: `permissions`, `task_permission_rules`, `field_dependencies`, `attribute_validators`, `object_relationships`, `task_object_mappings`, `audit_log`

### BPMN Process Hierarchy
`master-building-lifecycle.bpmn` → 8 phase processes → 14 discipline subprocesses
Delegates referenced via `camunda:delegateExpression="${delegateName}"`

## Database

- **Connection**: `postgresql://doorman_user:doorman_pass@localhost:5432/doorman_db`
- **pgAdmin**: http://localhost:5050 (admin@doorman.local / admin)
- 84 Samrum object types imported (migration 007)

## Pitfalls

- Routes `createFormsRouter()` / `createObjectsRouter()` exist but may not be mounted in `index.ts` — check before assuming endpoints work
- `FormService` / `PermissionService` are **classes**, not plain functions (despite some docs suggesting otherwise)
- Frontend auth is **demo-mode only** (localStorage + base64) — Keycloak integration planned but not active
- Backend tests depend on PostgreSQL — ensure local PostgreSQL is running first
