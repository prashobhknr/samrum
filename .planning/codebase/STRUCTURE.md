# Codebase Structure

**Analysis Date:** 2026-03-08

## Directory Layout

```
doorman/
├── backend/                    # Express.js + TypeScript API (port 3000)
│   ├── demo-server.mjs         # ACTIVE server — single-file Node.js HTTP handler
│   ├── src/
│   │   ├── index.ts            # TypeScript server stub (not yet active)
│   │   ├── api/                # Route factory functions
│   │   ├── services/           # Business logic classes
│   │   └── delegates/          # Camunda 7 delegate implementations
│   ├── tests/                  # Jest test files
│   ├── scripts/                # DB migration/seed scripts
│   └── database/backups/       # DB dump files
├── frontend/                   # Next.js 14 + TypeScript UI (port 3001)
│   ├── pages/                  # Next.js file-based routes
│   │   ├── _app.tsx            # App shell
│   │   ├── login.tsx           # Login page
│   │   ├── dashboard.tsx       # Main dashboard
│   │   ├── admin/              # Admin section (object types, modules, users, etc.)
│   │   ├── modules/            # Module views ([id].tsx)
│   │   ├── objects/            # Object instance pages ([id].tsx)
│   │   ├── doors/              # Door-specific pages
│   │   ├── tasks/              # Task worker portal ([taskId].tsx)
│   │   ├── processes/          # BPMN process pages
│   │   └── project/            # Project pages
│   ├── components/             # Shared React components
│   ├── lib/                    # Utilities: API client, auth, store
│   ├── utils/                  # Helper functions
│   ├── styles/                 # Global CSS
│   └── __tests__/              # Jest + jsdom tests (api/, components/)
├── database/
│   ├── migrations/             # 13 numbered SQL files (applied at Docker init)
│   └── scripts/                # Manual DB utility scripts
├── processes/                  # BPMN process definitions (Camunda 7)
│   ├── master-building-lifecycle.bpmn
│   ├── phases/                 # Per-lifecycle-phase BPMN files
│   ├── emergency/
│   ├── operations/
│   ├── renovation/
│   ├── portfolio/
│   ├── sub/                    # Sub-process BPMN files
│   └── META-INF/               # Camunda deployment descriptor
├── docs/
│   ├── architecture/           # Architecture decision records
│   └── old-app/                # Legacy Samrum reference docs
├── scripts/                    # Root-level utility scripts
├── docker-compose.yml          # PostgreSQL + pgAdmin + backend
└── CLAUDE.md                   # AI assistant project instructions
```

## Directory Purposes

**`backend/src/api/`:**
- Purpose: HTTP route handlers only — no business logic
- Contains: `objects.ts`, `forms.ts`, `bim.ts`, `portfolio.ts`
- Pattern: Each file exports one factory function `createXxxRouter(db: Client): Router`
- Key files: `backend/src/api/forms.ts`, `backend/src/api/objects.ts`

**`backend/src/services/`:**
- Purpose: All business logic and database queries
- Contains: `formService.ts`, `permissionService.ts`
- Pattern: Classes with `pg.Client` injected via constructor
- Key files: `backend/src/services/formService.ts`, `backend/src/services/permissionService.ts`

**`backend/src/delegates/`:**
- Purpose: Camunda 7 service task implementations (50 delegates)
- Contains: `index.ts` (registry + `executeDelegate`), domain files (`lifecycle.ts`, `audit.ts`, `bim.ts`, etc.), `types.ts`
- Key file: `backend/src/delegates/index.ts` — the central registry

**`frontend/pages/admin/`:**
- Purpose: Admin configuration UI (B000–B014 feature set)
- Contains: `index.tsx`, `modules.tsx`, `users.tsx`, `object-types.tsx`, `relationships.tsx`, `analysis.tsx`, `view-designer.tsx`, `import-export.tsx`, `classify.tsx`, `classifications.tsx`, `module-folders.tsx`, `projects.tsx`
- Sub-dirs: `modules/` (module detail pages), `object-types/` (type detail pages)

**`frontend/components/`:**
- Purpose: Shared UI components used across multiple pages
- Key files:
  - `SamrumLayout.tsx` — page shell (Header + optional left sidebar + main + optional right panel)
  - `DynamicForm.tsx` — renders `FormSchema` JSON from backend
  - `DataGrid.tsx` — table with column config, sorting, filtering
  - `Header.tsx` — fixed top navigation bar
  - `AdminTreeNav.tsx` / `TreeNav.tsx` — left sidebar navigation trees
  - `BulkEditModal.tsx`, `ExportModal.tsx`, `ImportModal.tsx`, `PrintModal.tsx` — modal dialogs
  - `ErrorBoundary.tsx`, `Loading.tsx` — utility components

**`frontend/lib/`:**
- Purpose: Singleton utilities shared across all pages
- `api.ts` — `ApiClient` class, exported as `api` singleton (Axios-based)
- `auth.ts` — `loginUser`, `logoutUser`, `getStoredUser`, `initializeAuth`
- `store.ts` — client-side state (minimal usage)

**`database/migrations/`:**
- Purpose: Ordered SQL schema and seed files, applied once at Docker init
- Naming: `NNN_description.sql` (some numbers have two files, applied alphabetically)
- Key migrations:
  - `001_create_oms_schema.sql` — core OMS tables
  - `002_samrum_schema.sql` — legacy Samrum tables
  - `003_phase3_task_permission_rules.sql` — form permission system
  - `006_module_view_columns.sql` — 12,438 module column rows
  - `007_samrum_oms_types.sql` — 89 OMS types from Samrum

**`processes/`:**
- Purpose: BPMN 2.0 process definitions consumed by Camunda 7
- Key file: `processes/master-building-lifecycle.bpmn`
- Sub-processes organized by domain: `phases/`, `emergency/`, `operations/`, `renovation/`, `portfolio/`, `sub/`

## Key File Locations

**Entry Points:**
- `backend/demo-server.mjs` — active backend server (port 3000)
- `backend/src/index.ts` — TypeScript server stub (not yet active)
- `frontend/pages/_app.tsx` — Next.js app entry
- `frontend/pages/login.tsx` — authentication entry

**Configuration:**
- `docker-compose.yml` — service definitions (PostgreSQL, pgAdmin, backend)
- `backend/src/delegates/index.ts` — Camunda delegate registry

**Core Business Logic:**
- `backend/src/services/formService.ts` — dynamic form generation
- `backend/src/services/permissionService.ts` — permission checking/merging
- `backend/src/api/forms.ts` — form API routes
- `backend/src/api/objects.ts` — OMS object CRUD routes

**Frontend API Communication:**
- `frontend/lib/api.ts` — all HTTP calls to backend

**Key UI Components:**
- `frontend/components/SamrumLayout.tsx` — wrap all pages with this
- `frontend/components/DynamicForm.tsx` — render form schemas
- `frontend/components/DataGrid.tsx` — tabular data display

**Testing:**
- `backend/tests/` — Jest tests for backend
- `frontend/__tests__/api/` — API client tests
- `frontend/__tests__/components/` — component tests

## Naming Conventions

**Files:**
- Backend API routers: `camelCase.ts` (e.g., `forms.ts`, `objects.ts`)
- Backend services: `camelCaseService.ts` (e.g., `formService.ts`, `permissionService.ts`)
- Backend delegates: `camelCase.ts` named by domain (e.g., `lifecycle.ts`, `bim.ts`)
- Frontend pages: `camelCase.tsx` for static, `[paramName].tsx` for dynamic routes
- Frontend components: `PascalCase.tsx` (e.g., `SamrumLayout.tsx`, `DynamicForm.tsx`)
- Migrations: `NNN_snake_case_description.sql`

**Directories:**
- Backend: lowercase (`api`, `services`, `delegates`)
- Frontend pages: lowercase (`admin`, `modules`, `tasks`)
- Frontend components: PascalCase files in flat `components/` dir (no sub-directories)

## Where to Add New Code

**New API endpoint:**
- Router: create or extend a file in `backend/src/api/` using the `createXxxRouter(db)` factory pattern
- Mount it in `backend/demo-server.mjs` for active use; also update `backend/src/index.ts` when activating TypeScript server
- Service logic: add a new class in `backend/src/services/`

**New Camunda delegate:**
- Implement `CamundaDelegate` interface from `backend/src/delegates/types.ts`
- Add to appropriate domain file in `backend/src/delegates/`
- Register with `register(myDelegate)` in `backend/src/delegates/index.ts`

**New frontend page:**
- Static route: `frontend/pages/myPage.tsx`
- Dynamic route: `frontend/pages/mySection/[id].tsx`
- Admin page: `frontend/pages/admin/myFeature.tsx`
- Wrap content with `<SamrumLayout>` from `frontend/components/SamrumLayout.tsx`
- Use `api.*` from `frontend/lib/api.ts` for all data fetching

**New shared component:**
- Add `frontend/components/MyComponent.tsx` (PascalCase)
- No sub-directories — all components in flat `components/` dir

**New database migration:**
- Add `NNN_description.sql` to `database/migrations/` with next sequence number
- Grant permissions to `doorman_user` at end of migration (tables created as `a123`)

## Special Directories

**`.planning/codebase/`:**
- Purpose: AI-generated analysis documents for GSD workflow
- Generated: Yes (by map-codebase command)
- Committed: Yes

**`.planning/`:**
- Purpose: GSD planning artifacts (phases, plans)
- Generated: Yes
- Committed: Yes

**`backend/database/backups/`:**
- Purpose: Manual PostgreSQL dump files
- Generated: Yes (manual)
- Committed: No (likely gitignored)

**`docs/old-app/`:**
- Purpose: Reference material from legacy Samrum system (Bizagi processes, DB schemas, PLCS docs)
- Generated: No (static reference)
- Committed: Yes

---

*Structure analysis: 2026-03-08*
