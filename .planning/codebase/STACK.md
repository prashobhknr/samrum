# Technology Stack

**Analysis Date:** 2026-03-08

## Languages

**Primary:**
- TypeScript 5.9.x (backend) / 5.3.x (frontend) - All application code
- SQL - Database migrations in `database/migrations/`

**Secondary:**
- JavaScript (ESM) - Demo/utility scripts: `backend/demo-server.mjs`, `backend/demo-server.js`, `backend/attribute-api.js`

## Runtime

**Environment:**
- Node.js >=18.0.0 (engines field in both `backend/package.json` and `frontend/package.json`)

**Package Manager:**
- npm >=9.0.0
- Lockfiles: `backend/package-lock.json`, `frontend/package-lock.json` (both present)

## Frameworks

**Backend:**
- Express.js 4.18.x - HTTP server and routing (`backend/src/index.ts`)
- Factory pattern for routers: `createObjectsRouter(db)`, `createFormsRouter(db)`, `createBimRouter(db)` — all in `backend/src/api/`
- No controller layer — business logic lives in service classes under `backend/src/services/`

**Frontend:**
- Next.js 14.x - React framework with pages router (`frontend/pages/`)
- React 18.2.x - UI rendering
- Tailwind CSS 3.3.x - Utility-first styling, custom `samrum` color tokens defined in `frontend/tailwind.config.js`

**Testing:**
- Jest 29.7.x (both backend and frontend)
- ts-jest 29.1.x - TypeScript support for Jest (backend)
- @testing-library/react 14.x + jest-environment-jsdom (frontend)

**Build/Dev:**
- ts-node 10.9.x with `--esm` flag for backend dev: `npm run dev`
- SWC minifier enabled in Next.js (`swcMinify: true` in `frontend/next.config.js`)
- nodemon 3.0.x (backend devDependency)

## Key Dependencies

**Backend Critical:**
- `pg` 8.11.x - PostgreSQL client; all DB queries are parameterized (`$1`, `$2` style), no ORM at runtime
- `express` 4.18.x - Core web framework
- `joi` 17.11.x - Input validation schemas
- `winston` 3.11.x - Structured logging
- `helmet` 7.1.x - Security HTTP headers
- `cors` 2.8.x - Cross-origin resource sharing
- `morgan` 1.10.x - HTTP request logging
- `dotenv` 16.3.x - Environment variable loading

**Backend DevDependencies of note:**
- `knex` 3.1.x - Present as devDependency only; NOT used at runtime (query builder not in production code path)

**Frontend Critical:**
- `axios` 1.6.x - HTTP client; singleton `api` instance in `frontend/lib/api.ts` with interceptor-based token injection
- `zustand` 4.4.x - Global state management (`frontend/lib/store.ts`)
- `react-hook-form` 7.48.x - Form state management
- `@headlessui/react` 1.7.x - Accessible UI primitives
- `heroicons` 2.0.x - Icon set
- `date-fns` 2.30.x - Date utilities
- `clsx` 2.0.x - Conditional class names

## Configuration

**Environment:**
- Backend reads from `.env` (loaded via `dotenv.config()` in `backend/src/index.ts`)
- `.env.example` at repo root documents all required vars
- Frontend env vars prefixed `NEXT_PUBLIC_` exposed via `frontend/next.config.js` `env` block
- Key required vars: `DATABASE_URL`, `API_PORT`, `LOG_LEVEL`, `JWT_SECRET`, `CORS_ORIGIN`
- Camunda vars present but labeled Phase 3+: `CAMUNDA_ENGINE_URL`, `CAMUNDA_USERNAME`, `CAMUNDA_PASSWORD`
- Feature flags: `ENABLE_OFFLINE_MODE`, `ENABLE_AUDIT_LOGGING`, `ENABLE_PERMISSION_CHECKING`

**Build:**
- `backend/tsconfig.json` - target ES2020, strict mode fully enabled, noUnusedLocals/Parameters enforced
- `frontend/tsconfig.json` - standard Next.js TypeScript config
- `frontend/postcss.config.js` - PostCSS for Tailwind
- `frontend/tailwind.config.js` - custom `samrum` color theme tokens

## Platform Requirements

**Development:**
- Node.js >=18, npm >=9
- Docker + Docker Compose for PostgreSQL, pgAdmin, and backend container
- Ports: 3000 (backend API), 3001 (Next.js dev), 5432 (PostgreSQL), 5050 (pgAdmin)

**Production:**
- Dockerized deployment: `backend/Dockerfile` present
- PostgreSQL 14 (Alpine image in `docker-compose.yml`)
- No cloud-specific deployment config detected; Docker Compose is the primary orchestration layer
- Frontend: Next.js standard production build (`npm run build` + `npm run start`)

---

*Stack analysis: 2026-03-08*
