# Coding Conventions

**Analysis Date:** 2026-03-08

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `SamrumLayout.tsx`, `DynamicForm.tsx`, `Loading.tsx`)
- Pages: kebab-case for multi-word routes (e.g., `object-types.tsx`, `module-folders.tsx`, `view-designer.tsx`)
- Dynamic route segments: bracket notation (e.g., `[id].tsx`, `[taskId].tsx`, `[typeId]/index.tsx`)
- Backend services: camelCase class name in PascalCase file (e.g., `formService.ts`, `permissionService.ts`)
- Backend route files: camelCase noun (e.g., `objects.ts`, `forms.ts`, `bim.ts`)

**Functions / Methods:**
- camelCase for all functions and methods
- Factory pattern functions named `create{Name}Router` (e.g., `createObjectsRouter`, `createFormsRouter`)
- Private class methods prefixed with conventional `private` keyword in TypeScript (e.g., `getTaskPermissionRules`, `buildFormFields`)
- React page components: default export, PascalCase function name matching file

**Variables:**
- camelCase for local variables and parameters
- `snake_case` used for database column names when destructured from query results (e.g., `external_id`, `attribute_name`, `object_type_id`)
- Constants: camelCase (e.g., `API_URL`, though the backend uses `SCREAMING_SNAKE` for env-derived constants)

**Types / Interfaces:**
- PascalCase for interfaces and types (e.g., `FormField`, `FormSchema`, `ValidationResult`, `DoorInstance`, `Permission`)
- Interfaces preferred over `type` aliases for object shapes
- Enum-style string unions: `'READ' | 'WRITE' | 'DELETE'`, `'ALL' | 'OWN' | 'ASSIGNED'`

## Code Style

**Formatting:**
- No `.prettierrc` or `.eslintrc` config files detected — formatting is informal/editor-driven
- 2-space indentation observed throughout (TypeScript/TSX files)
- Single quotes for string literals in TypeScript (e.g., `'doorman_user'`, `'text'`)
- Backtick template literals for multi-line SQL strings

**Linting:**
- ESLint configured via `devDependencies` (`@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`) but no config file present at root
- `eslint src tests --ext .ts` is the lint script (backend only)
- TypeScript strict mode enforced: `strict: true`, `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`

**TypeScript Strictness:**
- Backend: fully strict TypeScript (`tsconfig.json` has all strict flags)
- Frontend: `strict: true` with `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- Non-null assertion (`!`) used sparingly and only when the data is known to be defined (e.g., `permMap.get(row.object_attribute_id)!`)
- `any` type used in some service return types as `Promise<any>` — area of technical debt

## Import Organization

**Order (observed pattern):**
1. React and Next.js imports (`import React`, `import { useRouter }`, `import Link`)
2. Third-party library imports (`import axios`, `import { Client } from 'pg'`)
3. Internal component imports (relative paths, e.g., `import SamrumLayout from '../../../components/SamrumLayout'`)
4. Internal lib/utility imports (`import { getStoredToken } from '../../../lib/auth'`)

**Path Aliases:**
- Frontend: `@/*` maps to `./*` (configured in `tsconfig.json`)
- Backend: no path aliases — uses relative imports only
- Frontend pages currently use relative imports (`../../../components/`) rather than the `@/` alias consistently

## Error Handling

**Backend (API routes):**
- All route handlers wrapped in `try/catch`
- Catch block pattern: `res.status(500).json({ error: (error as Error).message })`
- 404 returned inline before proceeding: `if (result.rows.length === 0) return res.status(404).json({ error: '...' })`
- Database transactions: `BEGIN` / `COMMIT` with `ROLLBACK` in the catch block
- ROLLBACK placed on the outer `db` reference (not `client`) for transaction error recovery

**Service layer:**
- Services throw errors directly (`throw new Error(...)`) — callers handle them
- `validateFormSubmission` catches internally and returns a structured `{ valid: false, errors: [...] }` result
- `saveFormSubmission` re-throws after ROLLBACK so the API layer handles it

**Frontend API client:**
- Axios interceptor logs errors via `console.error('API Error:', ...)` and re-throws
- Pages handle loading/error state with local `useState` (`isLoading`, `error`)

## Logging

**Backend:** `winston` is listed as a dependency but `console.error` is used in the frontend API client. No winston logger observed in sampled service files.

**Frontend:** `console.error` used in Axios error interceptor (`lib/api.ts`)

**SQL:** All queries use parameterized form (`$1`, `$2`) — no string interpolation for user input.

## Comments

**File-level JSDoc blocks:** Each service and API file starts with a block comment describing the module's purpose and endpoints or algorithm steps:
```typescript
/**
 * Phase 3: FormService
 *
 * Core business logic for dynamic form generation...
 *
 * Algorithm:
 * 1. Load task permission rules
 * 2. Load user's permissions
 * ...
 */
```

**Inline comments:** Used for section markers (e.g., `// 1. Load task permission rules`) and for clarifying non-obvious logic

**Section dividers in API client:** `// ========== Forms API ==========` style separators group related methods

**Type comments in frontend:** `// ─── Types ───` section dividers used in page components

## Function Design

**Size:** Route handlers in `src/api/*.ts` are kept inline within the router factory — no separate controller files. Service methods are broken into private helpers (e.g., `getTaskPermissionRules`, `getUserPermissions`, `getDoorInstanceData`, `buildFormFields`).

**Parameters:** Services accept typed primitive params; route handlers destructure from `req.params` and `req.query` with explicit type coercion (`parseInt(String(...), 10)`)

**Return Values:**
- Services return typed interfaces or `Map<>` structures
- API routes always return JSON: `res.status(200).json(...)` or `res.status(500).json({ error: ... })`
- Validation returns structured `ValidationResult` rather than throwing

## Module Design

**Backend exports:** Named exports for factory functions (`export function createObjectsRouter`), named exports for classes (`export class FormService`, `export class PermissionService`)

**Frontend exports:** Default exports for React page components and layout components; named exports for interfaces in `lib/api.ts`

**Barrel files:** Not used — imports reference files directly

## Database Query Patterns

**Always parameterized:** Queries use `$1`, `$2`, ... placeholders. Never string interpolation with user input.

**Dynamic WHERE clauses:** Built by tracking `paramIndex` counter and appending to a `whereClause` string (see `objects.ts` instances endpoint)

**Transactions:** Explicit `BEGIN` / `COMMIT` / `ROLLBACK` — no ORM transaction helpers

**Maps for lookups:** Permission and attribute data loaded into `Map<number, ...>` for O(1) access within field-building loops

---

*Convention analysis: 2026-03-08*
