# Architecture Research

**Domain:** Camunda 7 External Task integration with Node.js/TypeScript backend
**Researched:** 2026-03-08
**Confidence:** HIGH (Camunda REST API is stable and well-documented; patterns verified via official docs and library source)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         BROWSER (port 3001)                          │
│  ┌────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │  Task Inbox    │  │  DynamicForm     │  │  Process Timeline    │  │
│  │ (pages/tasks/) │  │ (DynamicForm.tsx)│  │ (pages/tasks/[id])   │  │
│  └───────┬────────┘  └────────┬─────────┘  └──────────┬───────────┘  │
└──────────┼─────────────────── │ ──────────────────────│──────────────┘
           │ Axios /api/*       │ Axios /api/forms/*     │ Axios /api/camunda/*
┌──────────▼────────────────────▼────────────────────────▼─────────────┐
│                    demo-server.mjs (port 3000)                        │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │  HTTP Router (existing)                                      │     │
│  │  /api/objects  /api/forms  /api/modules  /api/bim  /api/auth │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │  NEW: Camunda Proxy Routes  /api/camunda/*                   │     │
│  │  (thin pass-through to engine-rest + task enrichment)        │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │  NEW: External Task Worker (in-process, setInterval poller)  │     │
│  │  polls Camunda → executeDelegate() → complete/fail           │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │  Existing: FormService / PermissionService / delegates/      │     │
│  └──────────────────────────────────────────────────────────────┘     │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
              ┌──────────────────┼───────────────────┐
              │                  │                   │
   ┌──────────▼──────┐  ┌────────▼────────┐  ┌──────▼──────────────────┐
   │   PostgreSQL    │  │  Camunda 7 Run  │  │  Claude API (optional)  │
   │   port 5432     │  │  port 8080      │  │  AI form assistant      │
   │  (OMS data,     │  │  (process state,│  └─────────────────────────┘
   │   audit, forms) │  │   user tasks)   │
   └─────────────────┘  └─────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status |
|-----------|----------------|--------|
| `demo-server.mjs` | HTTP server, routing, DB connection, auth | Existing — extend, do not rewrite |
| `External Task Worker` | Polls Camunda fetchAndLock, dispatches to delegate registry, completes tasks | NEW — add as module imported by demo-server.mjs |
| `Camunda Proxy Routes` | Expose `/api/camunda/*` for frontend to list/claim/complete user tasks without CORS issues | NEW — add route block to demo-server.mjs |
| `delegates/index.ts` | Registry of 50 TypeScript delegates, `executeDelegate()` dispatcher | Existing — no changes needed |
| `FormService` | Generates `FormSchema` from formKey or taskId | Existing — already handles `doorman:{moduleId}:{objectTypeId}` convention |
| `DynamicForm.tsx` | Renders `FormSchema` as interactive form | Existing — reuse unchanged |
| Task Inbox page | Lists Camunda user tasks assigned to current user, allows claim/complete | NEW frontend page |
| Process Timeline page | Shows active activities for a process instance | NEW frontend page |

## Recommended Project Structure

```
backend/
├── demo-server.mjs              # MODIFIED: import + start worker, add camunda proxy routes
├── src/
│   ├── camunda/
│   │   ├── worker.mjs           # NEW: External Task Worker (ES module, matches demo-server)
│   │   ├── deployBpmn.mjs       # NEW: deploys 39 BPMNs to Camunda on startup
│   │   └── camundaClient.mjs    # NEW: thin fetch wrapper for engine-rest calls
│   ├── delegates/               # EXISTING — untouched
│   │   ├── index.ts
│   │   ├── types.ts
│   │   └── *.ts
│   └── services/                # EXISTING — untouched
│       ├── formService.ts
│       └── permissionService.ts

frontend/
├── pages/
│   ├── tasks/
│   │   ├── index.tsx            # NEW: task inbox (list assigned tasks)
│   │   └── [taskId].tsx         # NEW: individual task form + submit
│   └── process/
│       └── [instanceId].tsx     # NEW: process instance timeline view
└── components/
    └── ProcessTimeline.tsx      # NEW: renders bpmn activity state
```

### Structure Rationale

- **`backend/src/camunda/` as MJS files:** `demo-server.mjs` is ES module. TypeScript `delegates/` is compiled separately. Camunda integration code lives as `.mjs` to stay in the same module system as `demo-server.mjs` without a build step.
- **Worker inside demo-server, not a separate process:** Single process is simpler on macOS dev machine (no Docker, no process manager). Worker runs a `setInterval` loop. This is acceptable for this deployment scale; separate process is only needed when horizontal scaling is required.
- **Camunda proxy routes in demo-server:** Frontend cannot call `localhost:8080/engine-rest` directly without CORS setup on Camunda. Proxying through port 3000 keeps auth enforcement in one place and avoids Camunda CORS config.

## Architectural Patterns

### Pattern 1: External Task Worker — In-Process Polling Loop

**What:** A `setInterval` loop in `demo-server.mjs` calls Camunda `POST /engine-rest/external-task/fetchAndLock`, receives a batch of locked tasks, dispatches each to `executeDelegate()`, then calls `POST /engine-rest/external-task/{id}/complete` (or `handleFailure`).

**When to use:** Always for Camunda 7 service tasks. This is the only non-Java approach Camunda 7 supports for service task execution.

**Trade-offs:** Simple, no extra process. Lock expiry (configurable, e.g., 30s) is a safety net if the worker crashes mid-task.

**Example:**

```javascript
// backend/src/camunda/worker.mjs
import { executeDelegate } from '../delegates/index.js'; // compiled output

const WORKER_ID = 'doorman-worker-1';
const LOCK_DURATION = 30_000; // 30 seconds
const POLL_INTERVAL = 2_000;  // 2 seconds
const CAMUNDA_BASE = 'http://localhost:8080/engine-rest';

// All 50 delegate names as topics
const TOPICS = getDelegateRegistry().map(name => ({
  topicName: name,
  lockDuration: LOCK_DURATION,
  variables: ['processInstanceId', 'doorInstanceId', 'userGroup', 'formKey'],
}));

async function poll(db) {
  const res = await fetch(`${CAMUNDA_BASE}/external-task/fetchAndLock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workerId: WORKER_ID, maxTasks: 10, topics: TOPICS }),
  });
  const tasks = await res.json();

  for (const task of tasks) {
    const execution = {
      processInstanceId: task.processInstanceId,
      processDefinitionKey: task.processDefinitionKey,
      activityId: task.activityId,
      taskId: task.id,
      variables: flattenVariables(task.variables), // unwrap {value, type} → raw value
    };

    const result = await executeDelegate(task.topicName, execution, db);

    if (result.success) {
      await fetch(`${CAMUNDA_BASE}/external-task/${task.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: WORKER_ID,
          variables: result.variables ?? {},
        }),
      });
    } else {
      await fetch(`${CAMUNDA_BASE}/external-task/${task.id}/handleFailure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: WORKER_ID,
          errorMessage: result.error,
          retries: task.retries > 0 ? task.retries - 1 : 0,
          retryTimeout: 5000,
        }),
      });
    }
  }
}

export function startWorker(db) {
  setInterval(() => poll(db).catch(console.error), POLL_INTERVAL);
}
```

**Integration point in `demo-server.mjs`:**

```javascript
import { startWorker } from './src/camunda/worker.mjs';
// After client.connect():
startWorker(client);
```

### Pattern 2: Camunda Variables ↔ OMS attribute_values — Bridge Convention

**What:** Camunda process variables carry the minimum routing context (`doorInstanceId`, `userGroup`, `formKey`). The actual object data lives in PostgreSQL `attribute_values`. The delegate reads/writes `attribute_values` directly using `db`. Form variables submitted from user tasks are written into `attribute_values` by `FormService.saveFormSubmission()`, then a Camunda variable `submissionComplete: true` signals the engine.

**When to use:** Every user task completion and every delegate that reads object state.

**Trade-offs:** Avoids duplicating all attribute data inside Camunda variables (which have a ~4MB payload limit per task). Camunda remains the process orchestrator, not the data store.

**Data flow:**

```
User submits DynamicForm
        ↓
POST /api/camunda/task/{taskId}/submit
        ↓
1. FormService.saveFormSubmission(fields) → writes attribute_values in PostgreSQL
2. POST /engine-rest/task/{taskId}/complete  { variables: { submissionComplete: { value: true, type: 'Boolean' } } }
        ↓
Camunda advances to next task/gateway
```

**Key rule:** Never store full object attribute values inside Camunda variables. Only store IDs and status flags (`doorInstanceId`, `approvalStatus`, `validationPassed`).

### Pattern 3: Camunda Proxy Routes — Thin Backend Passthrough

**What:** Frontend calls `/api/camunda/tasks` (your backend) instead of `http://localhost:8080/engine-rest/task` directly. The backend enriches the response (e.g., adds `formSchema` from `FormService` alongside each task) and forwards everything else unchanged.

**When to use:** All Camunda REST operations initiated from the frontend.

**Trade-offs:** One extra network hop. Benefit: auth enforcement stays in your backend; Camunda CORS configuration not required; response enrichment is easy to add.

**Key endpoints to proxy:**

```
GET  /api/camunda/tasks                     → GET  /engine-rest/task?assignee={user}&active=true
POST /api/camunda/tasks/{id}/claim          → POST /engine-rest/task/{id}/claim
POST /api/camunda/tasks/{id}/submit         → (1) FormService.saveFormSubmission + (2) POST /engine-rest/task/{id}/submit-form
GET  /api/camunda/tasks/{id}/form           → FormService.generateFormFromKey(task.formKey, doorInstanceId, userGroup)
GET  /api/camunda/process/{instanceId}/state → GET /engine-rest/process-instance/{id}/activity-instances
POST /api/camunda/process/start             → POST /engine-rest/process-definition/key/{key}/start
```

### Pattern 4: BPMN Deployment on Server Start

**What:** On `demo-server.mjs` startup, after DB connection succeeds, iterate over all `.bpmn` files in `processes/` and `POST` each to `/engine-rest/deployment/create` using multipart form. Skip if already deployed (Camunda 7 deduplicates by deployment name + resource hash).

**When to use:** Every server start. Idempotent — Camunda checks resource hash and skips unchanged BPMNs.

**Example:**

```javascript
// backend/src/camunda/deployBpmn.mjs
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import FormData from 'form-data'; // npm install form-data

export async function deployAllBpmns(camundaBase, bpmnDir) {
  const files = (await readdir(bpmnDir, { recursive: true }))
    .filter(f => f.endsWith('.bpmn'));

  for (const file of files) {
    const form = new FormData();
    form.append('deployment-name', file.replace(/\//g, '_'));
    form.append('enable-duplicate-filtering', 'true');
    form.append(file, await readFile(join(bpmnDir, file)), { filename: file });

    await fetch(`${camundaBase}/deployment/create`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });
  }
  console.log(`Deployed ${files.length} BPMN files`);
}
```

## Data Flow

### External Task Service Task Flow

```
Camunda engine reaches service task (topic = delegateName)
        ↓
Worker polls POST /engine-rest/external-task/fetchAndLock
        ↓ (task returned with variables)
flattenVariables(task.variables) → DelegateExecution object
        ↓
executeDelegate(task.topicName, execution, db)
        ↓
Delegate reads/writes PostgreSQL (attribute_values, audit_log)
        ↓
DelegateResult { success, variables? }
        ↓ success              ↓ failure
POST .../complete         POST .../handleFailure
  { workerId, variables }   { errorMessage, retries-1, retryTimeout }
        ↓
Camunda engine continues process
```

### User Task Claim + Submit Flow

```
Frontend: Task Inbox loads
        ↓
GET /api/camunda/tasks  (filtered by assignee or candidateGroup)
        ↓ backend proxies →  GET /engine-rest/task?assignee=...
        ↓ backend enriches each task with formKey from task.formKey

User claims task
        ↓
POST /api/camunda/tasks/{id}/claim
        ↓ backend proxies → POST /engine-rest/task/{id}/claim { userId }

User opens task
        ↓
GET /api/camunda/tasks/{id}/form?doorInstanceId=N&userGroup=G
        ↓ FormService.generateFormFromKey(task.formKey, doorInstanceId, userGroup)
        ↓ Returns FormSchema JSON
        ↓ DynamicForm.tsx renders fields

User submits form
        ↓
POST /api/camunda/tasks/{id}/submit { fields: [...], doorInstanceId, userGroup }
        ↓ (1) FormService.saveFormSubmission() → writes attribute_values + audit_log
        ↓ (2) POST /engine-rest/task/{id}/submit-form { variables: { submissionComplete: true } }
        ↓
Camunda engine advances process
```

### Process Instance Timeline Flow

```
Frontend: Process Timeline page loads for building (processInstanceId)
        ↓
GET /api/camunda/process/{instanceId}/state
        ↓ backend proxies → GET /engine-rest/process-instance/{instanceId}/activity-instances
        ↓ Response: tree of ActivityInstance { activityId, activityName, activityType, childActivityInstances[] }
        ↓ Backend also queries: GET /engine-rest/history/activity-instance?processInstanceId=...&finished=true
        ↓ Merges: completed activities + currently active activities
        ↓ Returns: { active: string[], completed: string[], failed: string[] }

Frontend renders timeline:
        ↓ Map activityIds against known phase labels (from BPMN process definition names)
        ↓ Show progress bar / phase list with status badges
```

**Note on subprocess call activities:** Each `callActivity` spawns a child process instance with its own `processInstanceId`. To get full lifecycle state, the backend must query `GET /engine-rest/process-instance?superProcessInstance={parentId}` to discover child instances, then recurse.

### Camunda Variable Shape

Camunda REST variables have a typed envelope that must be unwrapped before passing to delegates:

```javascript
// Camunda REST format (what fetchAndLock returns):
{
  "doorInstanceId": { "value": 42, "type": "Long" },
  "userGroup": { "value": "maintenance_team", "type": "String" }
}

// DelegateExecution.variables (what delegates expect — raw values):
{
  "doorInstanceId": 42,
  "userGroup": "maintenance_team"
}

// Helper: flatten for delegates
function flattenVariables(vars) {
  return Object.fromEntries(
    Object.entries(vars ?? {}).map(([k, v]) => [k, v?.value ?? v])
  );
}

// DelegateResult.variables (what complete endpoint expects — typed envelope):
{
  "approvalStatus": { "value": "approved", "type": "String" }
}
```

The existing `ProcessVariable` type in `delegates/types.ts` already models `{ value, type }` — use `pvar()` helper when delegates return variables.

## Integration Points

### New vs. Modified Components

| Component | New or Modified | Change Description |
|-----------|----------------|--------------------|
| `demo-server.mjs` | MODIFIED | Import and start `worker.mjs` after DB connect; add `/api/camunda/*` route block |
| `backend/src/camunda/worker.mjs` | NEW | External task poller, dispatches to `executeDelegate()` |
| `backend/src/camunda/deployBpmn.mjs` | NEW | Deploys all BPMNs on startup |
| `backend/src/camunda/camundaClient.mjs` | NEW | Thin `fetch` wrapper with base URL and error handling |
| `frontend/pages/tasks/index.tsx` | NEW | Task inbox — list, filter, claim |
| `frontend/pages/tasks/[taskId].tsx` | NEW | Task detail — load form via formKey, submit |
| `frontend/pages/process/[instanceId].tsx` | NEW | Process instance timeline |
| `frontend/components/ProcessTimeline.tsx` | NEW | Timeline/phase progress component |
| `delegates/index.ts` | UNCHANGED | Registry works as-is; `executeDelegate()` is the call target |
| `FormService` | UNCHANGED | `generateFormFromKey()` already handles `doorman:{moduleId}:{objectTypeId}` |
| `DynamicForm.tsx` | UNCHANGED | Reused in task page unchanged |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Camunda 7 Run (port 8080) | REST HTTP fetch from backend | No SDK needed — raw fetch is sufficient and avoids Java client confusion |
| PostgreSQL (port 5432) | Existing `pg.Client` passed to delegates | No change — `db` param in `executeDelegate(name, execution, db)` |
| Claude API | Optional `@anthropic-ai/sdk` | AI form assistant, called from task page only |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Worker ↔ Delegate Registry | Direct function call `executeDelegate(name, execution, db)` | Synchronous dispatch; no message queue needed at this scale |
| Backend ↔ Camunda | HTTP REST (fetch) | Camunda REST on port 8080; no auth on Camunda in dev (community edition defaults) |
| Frontend ↔ Backend | Axios via existing `lib/api.ts` | Add `/api/camunda/*` calls to existing Axios instance |
| Frontend ↔ FormService | Via `/api/camunda/tasks/{id}/form` proxy endpoint | DynamicForm.tsx receives FormSchema unchanged |

## Anti-Patterns

### Anti-Pattern 1: Running the Worker as a Separate Process

**What people do:** Start a second `node worker.mjs` process alongside `demo-server.mjs`.

**Why it's wrong:** Requires two DB connections, two processes to manage on macOS dev machine, and introduces the need for IPC or shared config. The worker has no HTTP interface — it is purely a background loop.

**Do this instead:** Import `startWorker(db)` in `demo-server.mjs` after the DB connects. One process, one DB connection, zero process management overhead. Only split when you need to scale workers horizontally (not needed here).

### Anti-Pattern 2: Storing Full Object State in Camunda Variables

**What people do:** On form submit, serialise all form field values into Camunda process variables and read them back in subsequent delegates.

**Why it's wrong:** Camunda variables have a size ceiling (~4MB per process instance). Door objects have 60+ attributes. This duplicates data already in `attribute_values`. Camunda becomes a secondary data store, creating consistency issues.

**Do this instead:** Write form values to `attribute_values` (via `FormService.saveFormSubmission`) immediately on submit. Pass only routing/decision variables to Camunda (`doorInstanceId`, `approvalStatus`, `validationPassed`). Delegates read object state from PostgreSQL, not from Camunda variables.

### Anti-Pattern 3: Calling Camunda REST Directly from the Frontend

**What people do:** Frontend calls `http://localhost:8080/engine-rest/task` directly.

**Why it's wrong:** Requires CORS configuration in Camunda (non-trivial in standalone JAR). Auth enforcement lives in your backend — bypassing it means task operations are unauthenticated. Hard to add enrichment (e.g., injecting `formSchema` into task list responses).

**Do this instead:** All Camunda calls go through `/api/camunda/*` proxy routes in `demo-server.mjs`. Backend proxies, enriches, and enforces auth in one place.

### Anti-Pattern 4: Polling Camunda from the Frontend

**What people do:** Frontend polls `/engine-rest/external-task` or task list every second for updates.

**Why it's wrong:** The task inbox should show _user tasks_ (human-facing), not external tasks (machine-facing). User tasks are fetched once on page load and refreshed on user action. External task polling belongs exclusively in the backend worker.

**Do this instead:** Task inbox calls `GET /api/camunda/tasks` on mount and after each claim/complete action. No background polling in the browser.

## Build Order Recommendation

Build in this sequence to ensure each piece is testable before the next depends on it:

1. **Camunda connectivity** — `camundaClient.mjs` + `deployBpmn.mjs` + verify Camunda is up and BPMNs deployed
2. **External Task Worker** — `worker.mjs` + integration test: start a process instance, confirm delegate fires and completes
3. **Camunda Proxy Routes** — add `/api/camunda/*` routes to `demo-server.mjs`; verify with curl
4. **Task Inbox page** — `pages/tasks/index.tsx`: list tasks, claim; uses proxy routes
5. **Task Form page** — `pages/tasks/[taskId].tsx`: load DynamicForm via formKey, submit; exercises the full form→Camunda pipeline
6. **Process Timeline page** — `pages/process/[instanceId].tsx`: activity-instances endpoint + timeline component
7. **AI Form Assistant** — Claude API integration into task form page (final, non-blocking)

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-50 concurrent users | Current in-process worker + single DB connection is sufficient |
| 50-500 concurrent users | Move worker to separate process; use connection pool (`pg.Pool` instead of `pg.Client`) |
| 500+ concurrent users | Multiple worker replicas with different `workerId` values (Camunda locks per workerId, so horizontal scaling is safe) |

### Scaling Priorities

1. **First bottleneck:** Single `pg.Client` connection in `demo-server.mjs`. Fix: switch to `pg.Pool` before anything else when load increases.
2. **Second bottleneck:** Single-threaded Node.js poll loop. Fix: separate worker process with its own pool.

## Sources

- [Camunda 7 External Task REST — fetchAndLock](https://docs.camunda.org/manual/7.22/reference/rest/external-task/post-fetch-and-lock/) — MEDIUM confidence (page content not fully rendered but endpoint structure confirmed via community and library source)
- [camunda-external-task-client-js GitHub](https://github.com/camunda/camunda-external-task-client-js) — HIGH confidence (official Camunda library, code examples verified)
- [Camunda 7 User Task REST — submit-form](https://docs.camunda.org/manual/7.4/reference/rest/task/post-submit-form/) — HIGH confidence (stable across 7.x versions)
- [Camunda Forum — process instance current state](https://forum.camunda.io/t/how-to-get-current-state-of-a-process-instance-using-rest-api/5984) — MEDIUM confidence (community answer, endpoint `/process-instance/{id}/activity-instances` is documented in official REST reference)
- [Existing codebase: `backend/src/delegates/types.ts`] — HIGH confidence (directly read)
- [Existing codebase: `backend/src/delegates/index.ts`] — HIGH confidence (directly read)
- [Existing codebase: `backend/demo-server.mjs`] — HIGH confidence (directly read)

---

*Architecture research for: Camunda 7 External Task integration — Doorman*
*Researched: 2026-03-08*
