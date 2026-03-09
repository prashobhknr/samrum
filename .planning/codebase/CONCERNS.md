# Codebase Concerns

**Analysis Date:** 2026-03-08

---

## Tech Debt

**demo-server.mjs is the production server:**
- Issue: The actual running API is `backend/demo-server.mjs` — a 2,611-line monolithic ES module written in plain JavaScript. The TypeScript Express app at `backend/src/index.ts` is non-functional (has a TODO comment where routes should be mounted and serves only a stub response).
- Files: `backend/demo-server.mjs`, `backend/src/index.ts`
- Impact: All TypeScript tooling (type-checking, ESLint, tests) targets `backend/src/` but the live server is untouched by those tools. Bugs in the demo server cannot be caught by CI.
- Fix approach: Port `demo-server.mjs` endpoints into Express + TypeScript routers under `backend/src/api/`, then retire the demo server.

**Express TypeScript server is a stub:**
- Issue: `backend/src/index.ts` has commented-out route imports and a TODO comment where routes should be mounted. The only endpoint it serves is a placeholder that returns `{ TODO: 'Implement ObjectService...' }`.
- Files: `backend/src/index.ts` lines 56–71
- Impact: Running `npm run dev` from `backend/` starts a non-functional server. Only `node backend/demo-server.mjs` works.
- Fix approach: Wire up the existing service and API files (`objects.ts`, `forms.ts`, `bim.ts`, `portfolio.ts`) into the Express app.

**In-memory view settings store:**
- Issue: Column configuration for modules is stored in `viewSettings = {}` — a plain JavaScript object inside `demo-server.mjs`. This state is lost on every server restart.
- Files: `backend/demo-server.mjs` lines 31, 2074–2087
- Impact: Users lose their column customizations whenever the process restarts. Not viable in multi-instance deployment.
- Fix approach: Persist view settings to a new `user_view_settings` table or in `module_view_columns` directly.

**Auth is fully disabled by flag:**
- Issue: `DISABLE_AUTH_CHECK = true` at line 17 of `demo-server.mjs` bypasses all authorization checks. The `requireAdmin` function short-circuits to `return true` immediately.
- Files: `backend/demo-server.mjs` lines 17, 69
- Impact: Every endpoint is publicly accessible regardless of user identity or role. No access control is active at runtime.
- Fix approach: Remove the flag, implement real JWT or session-based auth with group-based middleware checks tied to the `permissions` table.

**Camunda delegates are stubs:**
- Issue: All 30+ Camunda delegate implementations under `backend/src/delegates/` log console messages and return mock data but do not connect to a live Camunda 7 engine. Process spawning, BIM import, notifications, and portfolio operations are all simulated.
- Files: `backend/src/delegates/portfolio.ts` line 57 ("In production: call Camunda REST API..."), `backend/src/delegates/notification.ts`, `backend/src/delegates/climate.ts`, etc.
- Impact: BPMN workflow orchestration — the core architectural premise — is not implemented. All task lifecycle transitions, escalations, and service integrations exist as skeletons only.
- Fix approach: Implement real Camunda 7 REST API calls (or use the `camunda-external-task-client-js` library) inside each delegate.

---

## Security Considerations

**Plaintext password check (hardcoded):**
- Risk: The login endpoint in `demo-server.mjs` accepts any password equal to the string `"password123"` for any user, regardless of any stored credential.
- Files: `backend/demo-server.mjs` line 111
- Current mitigation: None — this is the only authentication check.
- Recommendations: Remove the hardcoded password. Hash passwords with bcrypt at user creation and compare hashes at login.

**Base64 token used as auth credential:**
- Risk: The frontend encodes `username:password` as Base64 and stores it in `localStorage` as `auth_token`. Base64 is not encryption. Any XSS attack or script with localStorage access recovers the password in plaintext.
- Files: `frontend/lib/auth.ts` lines 43–44, `backend/demo-server.mjs` lines 78–81
- Current mitigation: None.
- Recommendations: Replace with short-lived JWTs signed server-side. Store token in `httpOnly` cookies instead of localStorage.

**CORS set to wildcard:**
- Risk: `Access-Control-Allow-Origin: *` is set on every response in the demo server, allowing any origin to make credentialed requests.
- Files: `backend/demo-server.mjs` line 56
- Current mitigation: None.
- Recommendations: Restrict CORS to known frontend origins via an allowlist.

**Credentials hardcoded in connection string:**
- Risk: The database connection string `postgresql://doorman_user:doorman_pass@localhost:5432/doorman_db` is hardcoded as a fallback in both the demo server and test files.
- Files: `backend/demo-server.mjs` line 13, `backend/tests/formService.test.ts` lines 18–23
- Current mitigation: `process.env.DATABASE_URL` overrides if set.
- Recommendations: Remove the hardcoded fallback in non-test code. Require `DATABASE_URL` to be set explicitly in production.

**No input validation or sanitization on bulk import:**
- Risk: The BIM sync endpoint at `/api/bim/sync` iterates over user-supplied `doors` array and constructs INSERT queries. Although parameterized, there is no limit on array size, enabling large payload attacks.
- Files: `backend/demo-server.mjs` lines 1968–1984
- Current mitigation: Parameterized queries prevent SQL injection.
- Recommendations: Add request body size limits (Express `json({ limit: '1mb' })`), validate array length, and add rate limiting.

---

## Performance Bottlenecks

**N+1 query pattern in instance detail endpoint:**
- Problem: The `/api/objects/instances/:id/details` handler fetches all relationship types for an object, then fires one query per relationship to load linked child instances.
- Files: `backend/demo-server.mjs` lines 327–352
- Cause: Loop `for (const rel of relR.rows)` with `await client.query(...)` inside.
- Improvement path: Rewrite using a single JOIN query with `WHERE oir.relationship_id = ANY($1)`, then group results in application code.

**N+1 query pattern in module schema endpoint:**
- Problem: The module schema endpoint loads relationship types for an OMS object type, then fires one query per relationship to load that type's attributes.
- Files: `backend/demo-server.mjs` lines 1463–1483
- Cause: Loop `for (const rel of relTypesR.rows)` with `await client.query(...)` inside.
- Improvement path: Fetch all related type attributes in a single query using `WHERE object_type_id = ANY($1)`.

**Unbounded SELECT queries on large tables:**
- Problem: Several endpoints issue queries with no LIMIT: `SELECT id, name, description FROM object_types ORDER BY id`, `SELECT * FROM samrum_storage_types ORDER BY id`, `SELECT * FROM samrum_data_types ORDER BY id`, and the full attribute_values load per instance.
- Files: `backend/demo-server.mjs` lines 166, 662, 670, 291–296
- Cause: No pagination applied to potentially large result sets (object_attributes has 1,439+ rows).
- Improvement path: Apply default LIMIT/OFFSET to all list endpoints. For attributes, filter to only those columns needed by the view.

**Single pg.Client (no connection pool):**
- Problem: The demo server uses a single persistent `pg.Client` connection for all requests. Under concurrent load, all requests queue behind one another.
- Files: `backend/demo-server.mjs` lines 8–13
- Cause: `pg.Client` vs `pg.Pool`.
- Improvement path: Replace `Client` with `Pool` (from the same `pg` package) to handle concurrent queries.

---

## Fragile Areas

**Monolithic demo server routing:**
- Files: `backend/demo-server.mjs` (2,611 lines)
- Why fragile: All routes are implemented as a single deeply-nested if/else chain inside one HTTP request handler. Adding or modifying any endpoint risks breaking unrelated routes. No middleware composability.
- Safe modification: Always add new routes above the final catch-all error handler. Test each route regex carefully — several use `.match()` with overlapping patterns.
- Test coverage: Zero unit tests cover this file. Only integration tests exist and they require a live database.

**Column normalization key derivation:**
- Files: `backend/demo-server.mjs` (fallback column key logic), `database/migrations/006_module_view_columns.sql`
- Why fragile: The `column_key` for `module_view_columns` is derived by a specific regex normalization of Swedish `sys_caption` strings. The regex must be byte-identical between migration SQL and backend fallback code. A previous bug (noted in project memory) caused a mismatch by stripping uppercase before lowercasing.
- Safe modification: Do not change the normalization regex without updating both migration SQL and every backend code path that generates column keys. Test with a column containing uppercase letters and non-ASCII characters.
- Test coverage: No regression test exists for this transformation.

**Samrum → OMS type mapping (84 modules still fallback to type 1):**
- Files: `database/migrations/007_oms_object_types.sql`
- Why fragile: 84 samrum modules have no `object_type_mappings` entry and silently resolve to OMS type 1 ("Door"). Queries filtering by `oms_ot_id` will return Door attributes for these modules, producing incorrect data.
- Safe modification: Any feature that branches on object type ID must explicitly handle the fallback-to-Door case. Do not assume `oms_ot_id IS NOT NULL`.
- Test coverage: None.

**formService multi-group permission merging:**
- Files: `backend/src/services/formService.ts` (472 lines), `backend/src/services/permissionService.ts`
- Why fragile: The UNION/INTERSECTION merge logic for visible/editable/required attributes across multiple user groups is implemented in application code rather than SQL. An off-by-one or set subtraction error silently leaks or hides fields without throwing an exception.
- Safe modification: Changes to merge logic must be validated against all combinations: single group, multiple groups with overlap, multiple groups with no overlap.
- Test coverage: Integration tests in `backend/tests/formService.test.ts` cover single-group cases. Multi-group edge cases are not tested.

---

## Missing Critical Features

**No real authentication or session management:**
- Problem: There is no JWT issuance, session store, refresh token, or logout invalidation. Auth is `base64(username:password)` in localStorage with a hardcoded password accepted by the server.
- Blocks: Deploying to any environment beyond localhost. Multi-user isolation. Role-based access enforcement.

**Camunda integration is entirely absent:**
- Problem: The BPMN `.bpmn` files exist under `processes/` but there is no Camunda 7 engine connection, no external task polling, and no process instance creation.
- Blocks: Task assignment, workflow state transitions, task portal functionality.

**No rate limiting or request throttling:**
- Problem: Neither the demo server nor the TypeScript Express app applies rate limiting to any endpoint.
- Blocks: Production deployment. Login brute-force protection.

---

## Test Coverage Gaps

**demo-server.mjs has zero unit tests:**
- What's not tested: All 2,611 lines of the live API server — routing, SQL query construction, response shaping, error handling.
- Files: `backend/demo-server.mjs`
- Risk: Any change to the server may silently break endpoints. Only manual testing or integration tests with a live DB can catch regressions.
- Priority: High

**Camunda delegates have no tests:**
- What's not tested: All 30+ delegate implementations under `backend/src/delegates/`.
- Files: `backend/src/delegates/*.ts`
- Risk: Delegate logic for validation, lifecycle transitions, BIM operations, and notifications is completely unverified.
- Priority: High

**Multi-group permission merging not covered:**
- What's not tested: Scenarios where a user belongs to multiple groups with conflicting visible/editable permissions.
- Files: `backend/tests/formService.test.ts`, `backend/src/services/formService.ts`
- Risk: Silent field visibility bugs for users with multiple roles.
- Priority: High

**Frontend has minimal test coverage:**
- What's not tested: All pages under `frontend/pages/admin/`, `frontend/pages/tasks/`, `frontend/pages/modules/`, `frontend/pages/objects/`. Only `DynamicForm` component has a test file.
- Files: `frontend/__tests__/`
- Risk: UI regressions in admin and module management features go undetected.
- Priority: Medium

---

## Dependencies at Risk

**`pg.Client` used instead of `pg.Pool`:**
- Risk: Single connection is dropped on any network blip; server must be restarted to reconnect.
- Impact: API becomes entirely unavailable on transient database network errors.
- Migration plan: Replace `new Client(...)` → `new Pool(...)` in `backend/demo-server.mjs`.

**No error boundary on database disconnection:**
- Risk: If the `pg.Client` connection drops mid-request, the next query throws an unhandled error that propagates to the top-level catch. The server process continues but all subsequent DB queries fail until restart.
- Files: `backend/demo-server.mjs` lines 22–28
- Current mitigation: Process exits on initial connection failure only.
- Recommendations: Add reconnection logic or switch to `pg.Pool` which handles reconnects automatically.

---

*Concerns audit: 2026-03-08*
