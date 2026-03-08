# External Integrations

**Analysis Date:** 2026-03-08

## APIs & External Services

**BPMN Process Engine (planned/in-progress):**
- Camunda 7 - Process orchestration for door unlock, maintenance, and building lifecycle workflows
  - Engine REST API: `CAMUNDA_ENGINE_URL` (default `http://localhost:8080/engine-rest`)
  - Auth: `CAMUNDA_USERNAME` / `CAMUNDA_PASSWORD` env vars (basic auth, default `demo`/`demo`)
  - Integration point: `backend/src/delegates/` - TypeScript delegate classes implementing `CamundaDelegate` interface from `backend/src/delegates/types.ts`
  - Delegate registry: `backend/src/delegates/index.ts` — maps delegate names to handler functions
  - BPMN process definitions: `processes/` directory (`.bpmn` files including `door-unlock.bpmn`, `door-maintenance.bpmn`, `master-building-lifecycle.bpmn`)
  - Status: Delegate pattern implemented; actual Camunda engine connection not yet wired to demo server

**BIM/IFC Integration (in-progress):**
- Building Information Modelling file ingestion
  - REST endpoints: `backend/src/api/bim.ts` — `GET/POST /api/bim/models`, clash detection, entity mapping
  - Database tables: `bim_models`, `bim_entity_mappings` (migration `database/migrations/013_portfolio_and_bim.sql`)
  - No external BIM SaaS SDK detected; integration appears to be via file upload + DB storage

**Portfolio Management (in-progress):**
- Internal building portfolio API
  - REST endpoints: `backend/src/api/portfolio.ts`
  - Database tables added in `database/migrations/013_portfolio_and_bim.sql`

## Data Storage

**Databases:**
- PostgreSQL 14 (primary and only datastore)
  - Docker image: `postgres:14-alpine`
  - Connection: `DATABASE_URL=postgresql://doorman_user:doorman_pass@localhost:5432/doorman_db`
  - Client: `pg` 8.11.x (`Client` from `pg`) — raw parameterized SQL, no ORM at runtime
  - Schema: 13+ migration files in `database/migrations/` applied automatically via `docker-entrypoint-initdb.d`
  - Core tables: `object_types`, `object_attributes`, `object_instances`, `attribute_values`, `object_relationships`, `permissions`, `task_permission_rules`, `field_dependencies`, `attribute_validators`, `task_object_mappings`, `audit_log`
  - Samrum legacy tables: `samrum_object_types`, `samrum_modules`, `samrum_projects`, `samrum_module_relationships`, `module_view_columns`

**File Storage:**
- Local filesystem only — no cloud object storage detected

**Caching:**
- In-memory only — `demo-server.mjs` uses a `viewSettings` JavaScript object for per-module column config
- No Redis or external cache

## Authentication & Identity

**Current (Demo) Auth:**
- Custom username/password login against hardcoded user list in `backend/demo-server.mjs`
- Token: base64-encoded `username:password` stored in `localStorage` as `auth_token`
- `frontend/lib/auth.ts` — `loginUser()` calls `POST /api/login`, stores token, calls `api.setToken()`
- `frontend/lib/api.ts` — Axios singleton reads token from `localStorage` via request interceptor
- `DISABLE_AUTH_CHECK = true` flag in `backend/demo-server.mjs` bypasses role checks for development

**Planned (Production) Auth:**
- Keycloak — referenced in `frontend/next.config.js` via `NEXT_PUBLIC_AUTH_PROVIDER=keycloak`
  - Keycloak URL: `NEXT_PUBLIC_KEYCLOAK_URL` (default `http://localhost:8080`)
  - Realm: `NEXT_PUBLIC_KEYCLOAK_REALM` (default `doorman`)
  - Client ID: `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` (default `doorman-portal`)
  - Status: Not yet implemented — env vars present, Keycloak client library not in `package.json`
- JWT: `JWT_SECRET` env var present in `.env.example` for future signed token validation

**User Groups (RBAC):**
- Groups hard-coded in demo: `locksmiths`, `supervisors`, `property_managers`, `security`, `cleaners`, `admin`
- Group-level permissions stored in `permissions` table and `task_permission_rules` table

## Monitoring & Observability

**Error Tracking:**
- None detected — no Sentry, Datadog, or similar SDK in dependencies

**Logs:**
- Winston 3.11.x in backend (`backend/src/services/`)
- Morgan 1.10.x for HTTP request logging in Express (`backend/src/index.ts`)
- Log level controlled via `LOG_LEVEL` env var
- `ENABLE_AUDIT_LOGGING` env flag enables immutable audit trail to `audit_log` table in PostgreSQL
- Frontend: `console.*` only

## CI/CD & Deployment

**Hosting:**
- Docker Compose — `docker-compose.yml` at repo root orchestrates postgres, pgadmin, and backend containers
- `backend/Dockerfile` present for backend container builds
- No frontend Dockerfile detected — frontend runs locally or would need separate configuration

**CI Pipeline:**
- Not detected — no `.github/workflows/`, `.gitlab-ci.yml`, or similar CI config present

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - PostgreSQL connection string
- `API_PORT` - Backend HTTP port (default 3000)
- `NODE_ENV` - Environment context (`development` / `production`)
- `LOG_LEVEL` - Winston log verbosity
- `JWT_SECRET` - For future JWT signing (currently unused in demo)
- `CORS_ORIGIN` - Allowed CORS origin for Express
- `NEXT_PUBLIC_API_URL` - Backend URL consumed by frontend (default `http://localhost:3000`)

**Optional / future vars:**
- `CAMUNDA_ENGINE_URL`, `CAMUNDA_USERNAME`, `CAMUNDA_PASSWORD` - Camunda 7 engine
- `NEXT_PUBLIC_KEYCLOAK_URL`, `NEXT_PUBLIC_KEYCLOAK_REALM`, `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` - Keycloak SSO
- `ENABLE_OFFLINE_MODE`, `ENABLE_AUDIT_LOGGING`, `ENABLE_PERMISSION_CHECKING` - Feature flags
- `TEST_DATABASE_URL` - Separate test database

**Secrets location:**
- `.env` file at `backend/.env` (gitignored); `.env.example` at repo root documents the schema

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected — notification delegates in `backend/src/delegates/notification.ts` model the intent (e.g., `notificationDelegate`, `tenderPublishDelegate`) but no HTTP outbound call implementation found; they return stub `DelegateResult` objects

---

*Integration audit: 2026-03-08*
