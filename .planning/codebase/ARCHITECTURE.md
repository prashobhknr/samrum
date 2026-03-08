# Architecture

**Analysis Date:** 2026-03-08

## Pattern Overview

**Overall:** Layered monorepo — Express.js REST backend + Next.js frontend, orchestrated by Camunda 7 BPMN processes, backed by PostgreSQL.

**Key Characteristics:**
- Database-driven object schema: types, attributes, and permissions are all stored as data, not code
- Dynamic form generation: form fields are computed at runtime from `task_permission_rules` + `permissions` tables per user group
- BPMN processes drive workflow: Camunda service tasks call registered delegate functions in backend
- No ORM: all database access uses raw parameterized SQL (`$1`, `$2`) via `pg.Client`
- Demo server (`backend/demo-server.mjs`) is the active runtime; `backend/src/index.ts` is a scaffolded stub not yet wired

## Layers

**API Layer (Routes):**
- Purpose: Receive HTTP requests, validate params, delegate to services, return JSON
- Location: `backend/src/api/`
- Contains: `objects.ts`, `forms.ts`, `bim.ts`, `portfolio.ts`
- Pattern: Factory functions `createObjectsRouter(db)`, `createFormsRouter(db)` receive a `pg.Client` — no controller layer
- Depends on: Services layer
- Used by: Frontend via Axios, Camunda webhooks

**Service Layer:**
- Purpose: Business logic — form generation, permission evaluation, data reads/writes
- Location: `backend/src/services/`
- Contains: `formService.ts`, `permissionService.ts`
- Pattern: Classes instantiated with `pg.Client` dependency injection (`new FormService(db)`)
- Depends on: PostgreSQL directly
- Used by: API routes

**Delegate Layer (Camunda Integration):**
- Purpose: Implement Camunda 7 service task delegates — each maps to a BPMN `${delegateName}` expression
- Location: `backend/src/delegates/`
- Contains: `index.ts` (registry), `lifecycle.ts`, `audit.ts`, `validation.ts`, `operations.ts`, `bim.ts`, `notification.ts`, `portfolio.ts`, `climate.ts`, `specialized.ts`
- Pattern: Each delegate implements `CamundaDelegate` interface with `name` + `execute(execution, db)`. All registered via `register()` in `index.ts`
- Depends on: PostgreSQL via passed `db` param; types in `delegates/types.ts`
- Used by: Camunda 7 engine calling `executeDelegate(name, execution, db)`

**Frontend Pages:**
- Purpose: Render UI — admin configuration, module views, task worker portal, object detail pages
- Location: `frontend/pages/`
- Contains: Next.js file-based routing pages
- Depends on: `frontend/lib/api.ts` (Axios singleton), `frontend/lib/auth.ts`, `frontend/lib/store.ts`
- Used by: Browser clients

**Frontend Components:**
- Purpose: Reusable UI primitives and complex components
- Location: `frontend/components/`
- Key components: `SamrumLayout.tsx` (page shell), `DynamicForm.tsx` (renders `FormSchema`), `DataGrid.tsx`, `Header.tsx`, `TreeNav.tsx`, `AdminTreeNav.tsx`

**Database:**
- PostgreSQL via Docker
- Migrations in `database/migrations/` — applied once at container init

## Data Flow

**Form Generation Flow:**

1. Frontend calls `GET /api/forms/task/:taskId?doorInstanceId=N&userGroup=X` (or passes `formKey`)
2. `createFormsRouter` → `FormService.generateFormFromKey()` or `generateFormForTask()`
3. `FormService` queries `task_permission_rules` for `visible_attributes[]`, `editable_attributes[]`, `required_attributes[]`
4. `FormService` queries `permissions` for user group READ/WRITE grants per attribute
5. `FormService` queries `attribute_values` for current instance data
6. `FormService` queries `object_attributes` for attribute metadata (type, enum_values, help_text)
7. Fields assembled: `visible = task_rule.visible AND user.read`, `editable = task_rule.editable AND user.write`
8. Returns `FormSchema` JSON → `DynamicForm` React component renders it

**Module View Flow:**

1. Frontend calls `GET /api/forms/task/:taskId?formKey=doorman:{moduleId}:{objectTypeId}`
2. `FormService.generateFormForModule()` queries `module_view_columns` (joined to `object_attributes`)
3. Each column's visibility filtered by user `permissions`
4. Returns `FormSchema` with module name as header

**Object CRUD Flow:**

1. `GET /api/objects/types` → queries `object_types`
2. `GET /api/objects/instances/:id` → queries `object_instances` + `attribute_values` (joined)
3. `POST /api/objects/instances` → inserts to `object_instances`, then upserts to `attribute_values`
4. `PUT /api/objects/instances/:id` → upserts `attribute_values`

**BPMN Delegate Flow:**

1. Camunda engine executes a BPMN service task with `${delegateName}`
2. Backend resolves delegate via `getDelegateRegistry()[name]`
3. `executeDelegate(name, execution, db)` runs delegate's `execute()` method
4. Delegate reads/writes PostgreSQL and returns `DelegateResult`

**Auth Flow:**

1. `POST /api/login` → backend validates credentials, returns `User` object
2. Frontend stores `btoa(username:password)` token in `localStorage` + user JSON
3. `lib/api.ts` Axios interceptor attaches `Authorization: Bearer {token}` to all requests
4. Backend demo server decodes base64 token to extract username; `DISABLE_AUTH_CHECK = true` bypasses role enforcement in demo

**State Management:**
- Client state stored in `localStorage` (auth token + user JSON)
- No global React state manager; components call `getStoredUser()` from `lib/auth.ts` directly
- `lib/store.ts` exists but usage is minimal; primary state is server-fetched per page

## Key Abstractions

**FormSchema:**
- Purpose: JSON contract between backend form generation and `DynamicForm` React component
- Defined in: `backend/src/services/formService.ts` (interfaces), mirrored in `frontend/lib/api.ts`
- Shape: `{ task_id, door_instance_id, form_header, fields[], metadata }`
- Each field: `{ attribute_id, attribute_name, type, value, visible, editable, required, enum_values? }`

**CamundaDelegate:**
- Purpose: Interface for all Camunda service task implementations
- Defined in: `backend/src/delegates/types.ts`
- Pattern: `{ name: string; execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> }`
- Registry in: `backend/src/delegates/index.ts`

**module_view_columns:**
- Purpose: Per-module column definitions bridging 271 Samrum modules to OMS attributes
- Populated by: migration `006_module_view_columns.sql` (12,438 rows from `samrum_module_relationships`)
- Key fields: `module_id`, `column_key`, `label`, `col_order`, `oms_attribute_id`, `show_by_default`, `is_editable`
- Used by: `FormService.generateFormForModule()`, `DataGrid` column configuration

**Permission Model:**
- `permissions` table: per-group, per-attribute READ/WRITE/DELETE + scope (ALL/OWN/ASSIGNED)
- `task_permission_rules`: per-task, per-group arrays of visible/editable/required attribute IDs
- Multi-group merge: visible = UNION, editable = INTERSECTION, required = UNION (documented in CLAUDE.md)

## Entry Points

**Backend Demo Server:**
- Location: `backend/demo-server.mjs`
- Triggers: `node backend/demo-server.mjs` (port 3000)
- Responsibilities: All active API routing, DB connection, auth, CORS; single-file HTTP server using Node.js `http` module (not Express)

**Backend TypeScript Server (scaffolded, not active):**
- Location: `backend/src/index.ts`
- Triggers: `npm run dev` from `backend/`
- Responsibilities: Placeholder routes only; real services in `src/api/` and `src/services/` are not mounted here yet

**Frontend:**
- Location: `frontend/pages/_app.tsx`
- Triggers: `npm run dev` from `frontend/` (port 3001)
- Responsibilities: Next.js app shell, global layout, auth initialization

**Database Init:**
- Location: `database/migrations/` (13 numbered SQL files)
- Triggers: Docker container first start via `docker-entrypoint-initdb.d`
- Key migrations: `001` OMS schema, `002` Samrum schema, `006` module_view_columns, `007` OMS types from Samrum

## Error Handling

**Strategy:** Catch-and-respond at route level; throw from services with descriptive messages.

**Patterns:**
- Routes wrap service calls in `try/catch`, return `{ error: message }` with appropriate HTTP status
- Services throw `Error` with descriptive messages (e.g., `No permission rules found for task X`)
- `FormService.validateFormSubmission` returns `ValidationResult` (never throws) — catches internally and returns `valid: false`
- Database transactions in `saveFormSubmission`: `BEGIN → operations → COMMIT`, `ROLLBACK` on error

## Cross-Cutting Concerns

**Logging:** `morgan('dev')` middleware on Express (TypeScript server). Demo server logs to `console.error` only.
**Validation:** Input validated at route level (required params check). Form data validated via `FormService.validateFormSubmission`. All DB queries use parameterized statements.
**Authentication:** Base64 demo token in `localStorage`; `DISABLE_AUTH_CHECK = true` bypasses enforcement in demo server. Intended for Keycloak/LDAP in production (referenced in `lib/auth.ts` comments).

---

*Architecture analysis: 2026-03-08*
