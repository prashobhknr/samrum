---
phase: 03-task-worker-ui
verified: 2026-03-10T12:00:00Z
status: passed
score: 4/4 must-haves verified
gaps: []
---

# Phase 3: Task Worker UI — Verification Report

**Phase Goal:** A logged-in user can see their assigned Operaton tasks, claim unclaimed group tasks, load the admin-configured DynamicForm for each task, fill it out, and submit it — advancing the process in Operaton
**Verified:** 2026-03-10
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Task inbox at `/tasks` shows tasks assigned to or claimable by the logged-in user's group, with task name, process name, and created date visible | ✓ VERIFIED | `pages/tasks/index.tsx` implements two tabs: "Mina uppgifter" (assignee filter) and "Lediga uppgifter" (candidateGroup filter). Table columns: Uppgift (task name), Process (process name), Skapad (created date with `sv-SE` locale formatting). Backend `GET /api/tasks` queries Operaton with `assignee` or `candidateGroup+unassigned` params, enriches with variables and processName. |
| 2 | User can claim an unclaimed task and unclaim a previously claimed task; inbox reflects change without page reload | ✓ VERIFIED | `handleClaim()` calls `api.claimTask(taskId, userId)` → `POST /api/tasks/:id/claim` → Operaton claim API, then sets `activeTab='mine'` (triggers `useEffect` → `loadTasks()`). `handleUnclaim()` calls `api.unclaimTask(taskId)` → `POST /api/tasks/:id/unclaim` → Operaton unclaim API, then calls `loadTasks()` directly. Both update state without full page reload. |
| 3 | Opening a claimed task renders correct DynamicForm with current attribute values pre-filled | ✓ VERIFIED | `pages/tasks/[taskId].tsx` loads task via `api.getTask(taskId)`, extracts `doorInstanceId` from variables, builds `formTaskId = processKey_taskDefinitionKey`, calls `api.generateForm(formTaskId, doorId, userGroup)`. Backend `/api/forms/task/:taskId` queries `task_permission_rules` + `permissions` + `attribute_values` (or formKey-based path via `module_view_columns`). Result rendered by `DynamicForm` component with `defaultValue={field.value}` for each field. |
| 4 | Submitting form marks Operaton user task complete and persists values in `attribute_values` | ✓ VERIFIED | `handleSubmit()` flow: (1) `api.validateForm()` validates against form schema, (2) `api.submitForm()` → `POST /api/forms/submit` → UPSERT into `attribute_values` with `ON CONFLICT DO UPDATE`, (3) `api.completeTask(taskId, formData)` → `POST /api/tasks/:id/complete` → Operaton `task/:id/complete` with typed variables. Backend converts JS values to typed Operaton variables (Boolean/Long/Double/String). |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/pages/tasks/index.tsx` | Task inbox with tabs, task list, claim/unclaim | ✓ VERIFIED | 250 lines, full implementation with tabs, table, claim/unclaim buttons, loading/error states, Swedish labels |
| `frontend/pages/tasks/[taskId].tsx` | Task detail with DynamicForm, submit flows | ✓ VERIFIED | ~260 lines, loads task + door + form, renders DynamicForm, handles submit with validate → save → complete flow, fallback "complete without form" |
| `frontend/components/DynamicForm.tsx` | Form rendering with field types, permissions | ✓ VERIFIED | ~190 lines, uses react-hook-form, renders text/number/date/enum/boolean fields, respects visible/editable/required, AI suggestion support |
| `frontend/lib/api.ts` | Task and form API client methods | ✓ VERIFIED | `listMyTasks`, `getTask`, `claimTask`, `unclaimTask`, `completeTask`, `generateForm`, `validateForm`, `submitForm` — all implemented with proper Axios calls |
| `backend/demo-server.mjs` (task routes) | GET/POST task + form endpoints | ✓ VERIFIED | `GET /api/tasks`, `GET /api/tasks/:id`, `POST /api/tasks/:id/claim`, `POST /api/tasks/:id/unclaim`, `POST /api/tasks/:id/complete`, `GET /api/forms/task/:taskId`, `POST /api/forms/validate`, `POST /api/forms/submit` — all implemented with Operaton proxying and DB access |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pages/tasks/index.tsx` | `api.ts` | `api.listMyTasks()`, `api.claimTask()`, `api.unclaimTask()` | ✓ WIRED | Imported and called in `loadTasks()`, `handleClaim()`, `handleUnclaim()` |
| `pages/tasks/[taskId].tsx` | `api.ts` | `api.getTask()`, `api.generateForm()`, `api.submitForm()`, `api.completeTask()` | ✓ WIRED | Called in `loadTask()` and `handleSubmit()` |
| `pages/tasks/[taskId].tsx` | `DynamicForm.tsx` | `<DynamicForm schema={form} onSubmit={handleSubmit}>` | ✓ WIRED | Rendered with schema + onSubmit handler |
| `api.ts` → `GET /api/tasks` | `demo-server.mjs` | Axios GET `→` Operaton `/task` query | ✓ WIRED | Backend enriches with variables and processName |
| `api.ts` → `POST /api/tasks/:id/complete` | `demo-server.mjs` → Operaton | Axios POST → backend → `ENGINE_REST/task/:id/complete` | ✓ WIRED | Backend converts variables to typed format |
| `api.ts` → `POST /api/forms/submit` | `demo-server.mjs` → PostgreSQL | Axios POST → backend → `attribute_values` UPSERT | ✓ WIRED | Uses `INSERT ... ON CONFLICT ... DO UPDATE` with parameterized queries |
| `api.ts` → `GET /api/forms/task/:taskId` | `demo-server.mjs` → PostgreSQL | Axios GET → backend → `task_permission_rules` + `permissions` + `attribute_values` queries | ✓ WIRED | Full FormService-equivalent logic with permission filtering |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `pages/tasks/[taskId].tsx` | 84 | `doorId` fallback `\|\| 1` when no doorInstanceId in variables | ⚠️ Warning | May load wrong door data for processes that don't set doorInstanceId; form still generates but with potentially wrong values |
| `pages/tasks/[taskId].tsx` | 128-131 | Silent catch on `api.submitForm()` failure | ⚠️ Warning | If attribute save fails, user isn't notified (task still completes in Operaton). Data loss risk. |
| `pages/tasks/[taskId].tsx` | 121-127 | Silent catch on `api.validateForm()` failure | ℹ️ Info | Acceptable — validation rules may not be configured for all tasks |

### Human Verification Required

### 1. Task Inbox Display
**Test:** Log in as a user with group "locksmiths". Start a process that creates a user task with candidateGroups including "locksmiths". Navigate to `/tasks`.
**Expected:** Task appears in "Lediga uppgifter" tab with name, process name, and created date. After claiming, it moves to "Mina uppgifter".
**Why human:** Requires running Operaton with active user tasks and a logged-in user.

### 2. DynamicForm Rendering with Pre-filled Values
**Test:** Create a door instance with attribute values. Start a process with `doorInstanceId` variable pointing to that door. Claim the resulting user task and open it.
**Expected:** DynamicForm loads with fields matching `task_permission_rules` configuration. Current attribute values are pre-filled in editable fields.
**Why human:** Requires configured task_permission_rules and attribute_values in the database.

### 3. Form Submit → Process Advancement
**Test:** Open a claimed task with a form. Fill in editable fields. Click Submit.
**Expected:** "Uppgift slutförd" confirmation appears. In Cockpit, the completed task is gone and the next step is active. In PostgreSQL, `attribute_values` reflect the submitted data.
**Why human:** Requires verifying Cockpit state and database values after submit.

### 4. Visual Quality Check
**Test:** Navigate through `/tasks` → task detail → submit flow.
**Expected:** Swedish labels throughout, proper Tailwind styling with `samrum-*` tokens, loading spinners, error messages in Swedish.
**Why human:** Visual/UX verification cannot be automated.

---

_Verified: 2026-03-10T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
