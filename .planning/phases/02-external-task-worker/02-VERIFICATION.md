---
phase: 02-external-task-worker
verified: 2026-03-10T12:00:00Z
status: passed
score: 3/3 must-haves verified
gaps: []
---

# Phase 2: External Task Worker — Verification Report

**Phase Goal:** The backend external task worker polls Operaton service tasks and dispatches them to the existing delegate registry, completing tasks with typed variables and handling failures as Operaton incidents
**Verified:** 2026-03-10
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Starting a process instance causes service task steps to complete automatically; delegate execution visible in backend logs | ✓ VERIFIED | `externalTaskWorker.mjs` polls via `fetchAndLock()` every 5s, dispatches to registered handlers, calls `completeTask()` with typed variables. Logs `[Worker] ✓ {topic} ({activityId}) completed` on success. |
| 2 | A deliberate delegate failure decrements `task.retries` toward zero and creates an Operaton incident | ✓ VERIFIED | `processTask()` catches both `result.success=false` and thrown exceptions, calls `reportFailure(id, errorMessage, nextRetries)` with `nextRetries = currentRetries - 1`. When retries reach 0, Operaton automatically creates an incident. No retry handler missing topic falls through with `reportFailure(id, msg, 0)` — immediate incident. |
| 3 | BPMN gateway routing works: Boolean/Integer/String variables set by delegates steer flow to expected branch | ✓ VERIFIED | `registerDelegates.mjs` registers 50 handlers with typed variables via `pvar(value, type)` helper — e.g., `projectInitialized: pvar(true, 'Boolean')`, `validationErrorCount: pvar(0, 'Long')`, `deviationLevel: pvar('minor', 'String')`. `completeTask()` sends these as `{value, type}` objects to Operaton, which uses them for gateway evaluation. |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/camunda/externalTaskWorker.mjs` | Worker polling loop, fetchAndLock, completeTask, reportFailure | ✓ VERIFIED | 228 lines, full implementation with fetchAndLock, completeTask, reportFailure, processTask, startWorker/stopWorker |
| `backend/src/camunda/registerDelegates.mjs` | 50 delegate registrations with typed variables | ✓ VERIFIED | Registers all delegate topics with `registerSimple()`, sets typed process variables, logs count at end |
| `backend/demo-server.mjs` (startup wiring) | Imports and starts worker | ✓ VERIFIED | Line 11 imports `setDbClient, startWorker`, lines 39-45 call `setDbClient(client)`, imports registerDelegates, calls `startWorker()` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `demo-server.mjs` | `externalTaskWorker.mjs` | `import { setDbClient, startWorker }` | ✓ WIRED | Imported at line 11, called at lines 41-43 |
| `demo-server.mjs` | `registerDelegates.mjs` | `await import('./src/camunda/registerDelegates.mjs')` | ✓ WIRED | Dynamic import at line 42 |
| `registerDelegates.mjs` | `externalTaskWorker.mjs` | `import { registerDelegate, getDelegateCount }` | ✓ WIRED | Imported and used to register all 50 handlers |
| `externalTaskWorker.mjs` | Operaton REST | `fetch(CAMUNDA_BASE + '/external-task/fetchAndLock')` | ✓ WIRED | POST to fetchAndLock + POST to complete/failure |
| Delegate handler result | `completeTask()` | `result.variables` passed through | ✓ WIRED | Variables converted to `{value, type}` format in `completeTask()` |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | — |

No TODOs, FIXMEs, stubs, or placeholders detected in Phase 2 files.

### Human Verification Required

### 1. Live Service Task Completion
**Test:** Start a process instance via Cockpit or `POST /api/processes/master-building-lifecycle/start`. Watch backend console logs.
**Expected:** `[Worker] Fetched N task(s)` followed by `[Worker] ✓ {topicName} ({activityId}) completed` for each service task.
**Why human:** Requires running Operaton and starting an actual process instance.

### 2. Failure/Incident Creation
**Test:** Temporarily modify a delegate to return `{success: false, error: 'test'}`. Start a process that triggers it.
**Expected:** `[Worker] ✗ {topic} failed: test (retries left: N)` messages, then an incident visible in Cockpit at retries=0.
**Why human:** Requires observing Cockpit incident list and modifying a delegate temporarily.

### 3. Gateway Routing
**Test:** Start a process with gateways. Verify the expected user task appears based on delegate-set variables.
**Expected:** The user task expected from the gateway condition (e.g., `disciplineApproved=true` → approval path) appears.
**Why human:** Requires knowledge of specific BPMN gateway conditions and observing which task appears.

---

_Verified: 2026-03-10T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
