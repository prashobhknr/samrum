# Project Research Summary

**Project:** Doorman — Camunda 7 Task Worker UI + AI Form Assistant
**Domain:** BPMN process orchestration / building lifecycle management (Swedish regulatory context)
**Researched:** 2026-03-08
**Confidence:** HIGH (stack and architecture), MEDIUM (features and AI UX patterns)

## Executive Summary

Doorman is extending its existing Express/TypeScript + Next.js + PostgreSQL backend with three new capabilities: a running Camunda 7 process engine, an external task worker that dispatches to 50 pre-built delegate stubs, and a task worker UI that lets property managers claim, fill, and submit BPMN user tasks. The recommended approach is conservative and additive — all new Camunda integration code slots into `demo-server.mjs` as in-process modules rather than separate processes, keeping the dev stack simple. The frontend gets two new page trees (`/tasks/`, `/process/`) that reuse the existing `DynamicForm` component and `FormService` already built in Phase 3. The existing codebase has already done the hard work; this phase wires the orchestration engine to it.

The differentiating feature is an AI form assistant that uses Claude to suggest values for complex 60-field door management forms. The assistant must be decoupled from task completion — AI suggestions are fetched eagerly when a user opens a form, never in the submit hot path. Swedish regulatory context demands that workers always review and explicitly accept suggestions; auto-fill is a non-starter. Prompt engineering must inject valid enum values from `object_attributes` to prevent Claude from hallucinating Swedish domain codes (lock types, building regulation references) that are sparse in its training data.

The highest-risk items are infrastructure-level, not feature-level: Camunda Run's default H2 database is in-memory and wipes on restart; it must be pointed at the existing PostgreSQL instance on day one. BPMN deployment must use `deploy-changed-only=true` from the first deploy to prevent version proliferation that is extremely hard to undo. External task retry logic requires a null-safe decrement (`retries ?? 3`) to avoid infinite retry loops that flood Camunda. All of these are Phase 1 concerns — none of them are safe to defer.

---

## Key Findings

### Recommended Stack

The existing stack (Express, TypeScript, Next.js 14, PostgreSQL, pg, Axios) requires only three additions. Camunda 7.23.0 CE runs as a standalone JAR (`java -jar`) with no Docker needed. `camunda-external-task-client-js@^3.1.0` (official Camunda library) replaces ~200 lines of hand-written polling/retry/lock code. `@anthropic-ai/sdk@^0.78.0` handles the Claude API with built-in retries and streaming. No other new production dependencies are needed.

**Core new technologies:**
- **Camunda 7.23.0 CE JAR** — process engine; runs on Java 11+, REST API at `localhost:8080/engine-rest`; chosen over 7.24 because 7.23.0 is the verified stable download (7.24 is EoL as the final CE release)
- **camunda-external-task-client-js@^3.1.0** — external task worker; ESM-compatible with `demo-server.mjs`; eliminates hand-written fetchAndLock loop
- **@anthropic-ai/sdk@^0.78.0** — Claude API client for the AI form assistant; direct SDK preferred over Vercel AI SDK abstraction layer for this backend-only use case

**Environment variables to add:** `ANTHROPIC_API_KEY`, `CAMUNDA_REST_URL`, `CAMUNDA_WORKER_ID`

### Expected Features

The task worker portal must cover the full claim-to-complete cycle. The core flow (inbox → form → submit) is blocked on Camunda running with BPMNs deployed — this is the single hardest dependency and must be resolved before any UI work can be tested end-to-end.

**Must have (table stakes):**
- Task inbox with "My Tasks" / "Group Tasks" toggle and claim/unclaim — workers cannot function without this
- Load form by formKey via existing `FormService.generateFormFromKey()` — already built, just needs wiring
- Submit form to complete Camunda user task with typed variables — core process advancement mechanism
- External task worker backend polling + delegate dispatch — service tasks cannot complete without this; blocks all process flow between user tasks
- AI form assistant: suggest values button → Claude API → per-field accept/reject panel — the primary differentiator over vanilla Camunda Tasklist

**Should have (competitive):**
- Process instance timeline (phase labels from activity-instances endpoint) — useful for supervisors, independent of task inbox
- Due date color coding (overdue = red, due soon = amber) — trivial once inbox works
- Task count badge in nav — polish, add to SamrumLayout header

**Defer (v2+):**
- Notification emails on task assignment — requires email infrastructure
- Real-time WebSocket task push — 30-second polling is sufficient for building lifecycle workflows where tasks take hours/days
- Mobile-responsive UI — tablet/desktop context assumed
- Bulk task completion — bypasses form data entry, creates liability

### Architecture Approach

All new backend code integrates into the existing `demo-server.mjs` process: an in-process external task worker (`src/camunda/worker.mjs`) polls Camunda and dispatches to the existing delegate registry; a Camunda proxy route block (`/api/camunda/*`) lets the frontend reach Camunda without CORS configuration on the engine; a BPMN deployment module (`src/camunda/deployBpmn.mjs`) deploys all 39 BPMNs on startup. The critical data architecture principle: Camunda variables carry only routing context (`doorInstanceId`, `userGroup`, `formKey`), never full attribute data. All object state lives in PostgreSQL `attribute_values`, written by `FormService.saveFormSubmission()` on task submit.

**Major components:**

1. **`src/camunda/worker.mjs`** — external task poller; `setInterval` loop calling `fetchAndLock`, dispatching to `executeDelegate()`, completing or failing with retry logic
2. **`/api/camunda/*` proxy routes** — thin passthrough in `demo-server.mjs`; enriches task list responses with `formSchema` from `FormService`; enforces auth in one place
3. **`pages/tasks/index.tsx` + `pages/tasks/[taskId].tsx`** — task inbox and task form pages; reuse `DynamicForm.tsx` unchanged
4. **`src/camunda/deployBpmn.mjs`** — idempotent BPMN deployment on server start using `deploy-changed-only=true`
5. **`/api/ai/suggest` endpoint** — async Claude API call; decoupled from task completion; returns structured JSON suggestions per field ID

**Recommended build order:** Camunda connectivity → External Task Worker → Proxy Routes → Task Inbox UI → Task Form + Submit → Process Timeline → AI Form Assistant

### Critical Pitfalls

1. **H2 in-memory database wipes on restart** — configure Camunda Run's `application.yml` to use the existing PostgreSQL instance on day one; drop the PostgreSQL JDBC driver JAR into `configuration/userlib/`; do not proceed to BPMN deployment until confirmed
2. **External task infinite retry loop** — `task.retries` is `null` on first acquisition; always use `retries ?? 3` with `Math.max(0, retries - 1)`; failure to do this floods Camunda at maximum poll speed with no termination
3. **Camunda variable type mismatch breaks gateways silently** — always include `type` in variable payloads (`{ value: true, type: "Boolean" }`); build a typed variable builder utility before the first end-to-end test; wrong types cause gateway misdirection with no error thrown
4. **Claude called synchronously in task completion path** — never block `POST /task/{id}/complete` on Claude API response; fire the suggestion call when the form opens, render suggestions async; Claude p95 latency is 8-20 seconds
5. **BPMN version proliferation** — use `deploy-changed-only=true` from the first deploy; version proliferation is hard to recover from and causes running instances to diverge from latest process definitions

---

## Implications for Roadmap

Based on the dependency graph from FEATURES.md and the build order from ARCHITECTURE.md, four phases emerge with clear rationale.

### Phase 1: Camunda Infrastructure

**Rationale:** All other phases are blocked on Camunda running with PostgreSQL backing and BPMNs deployed. This is the foundation with the most critical pitfalls. Nothing can be tested end-to-end until this phase is complete.

**Delivers:** Camunda 7 JAR running, connected to PostgreSQL, all 39 BPMNs deployed (version 1 only), Cockpit accessible, `camundaClient.mjs` + `deployBpmn.mjs` integrated into `demo-server.mjs`

**Addresses:** Task inbox dependency on Camunda running; process timeline dependency on BPMNs deployed

**Avoids:** H2 in-memory data loss (configure PostgreSQL immediately); BPMN version proliferation (`deploy-changed-only=true` from day one); CORS issues (configure proxy routes, never expose port 8080 to frontend)

### Phase 2: External Task Worker

**Rationale:** Service tasks (delegates) must complete for process flow to advance between user tasks. Without the worker, the task inbox is a dead end — workers can claim and submit user tasks, but service task steps never execute and the next user task never appears.

**Delivers:** `worker.mjs` polling Camunda, dispatching to all 50 delegate stubs, handling failures with correct retry decrement and back-off, incidents visible in Cockpit on persistent failure

**Uses:** `camunda-external-task-client-js@^3.1.0`; existing `delegates/index.ts` registry unchanged

**Avoids:** Infinite retry loop (null-safe `retries ?? 3`); lock duration shorter than delegate execution (set 5-minute default, tune down later); duplicate execution from expired locks

### Phase 3: Task Worker UI

**Rationale:** With Camunda running and service tasks completing, the human-facing flow can be built. The existing `DynamicForm` and `FormService` are already built — this phase wires them to Camunda user tasks via the proxy routes.

**Delivers:** Task inbox (`/tasks/`), task form page (`/tasks/[taskId]`), claim/unclaim, form load via formKey, form submit completing Camunda user task with typed variables, typed variable builder utility

**Implements:** Camunda proxy routes (`/api/camunda/*`); user task submit flow (FormService.saveFormSubmission + POST /task/{id}/complete); assignee guard to prevent concurrent completion

**Avoids:** Camunda variable type mismatch (typed variable builder before first e2e test); concurrent task completion (backend assignee check + frontend "claimed by" banner); raw UUID display (show human-readable process + building + task name)

### Phase 4: AI Form Assistant

**Rationale:** Built last because it depends on an active FormSchema (Phase 3 must work) and because the async decoupling pattern is cleaner to design once the submit flow is already tested and stable.

**Delivers:** `POST /api/ai/suggest` endpoint; suggestions panel in task form page; per-field accept/reject; "Godkänn alla" (Accept All) button; backend re-validation of AI-suggested values against `attribute_validators`

**Uses:** `@anthropic-ai/sdk@^0.78.0`; structured output (JSON schema) to constrain Claude responses; valid enum injection from `object_attributes` into prompt

**Avoids:** Claude in task completion hot path (async, decoupled, fired on form open); hallucinated Swedish domain values (inject full valid options list per enum field); auto-fill without review (worker always submits manually)

### Phase Ordering Rationale

- Each phase is a prerequisite for the next: Camunda must run before the worker can poll; the worker must dispatch delegates before process flow advances past service tasks; process flow must work before the task UI is testable end-to-end; the task form must work before AI suggestions can be integrated into it.
- Feature groupings follow the architectural boundary: backend infrastructure (Phases 1-2) completes before frontend work (Phase 3) starts, reducing context switching and enabling reliable curl-based verification before UI layers are added.
- Pitfalls are front-loaded: the three "never defer" items (H2 config, retry decrement, `deploy-changed-only`) all land in Phase 1-2 where they can be verified before they become hard to undo.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 1:** PostgreSQL JDBC driver compatibility with Camunda 7.23 — confirm exact JAR version from Maven Central; test startup log confirms `org.postgresql` driver loaded, not H2
- **Phase 2:** Topic grouping strategy for 50 delegates — single `fetchAndLock` with 39+ topics may hit timeout thresholds; research whether grouped subscriptions or a single catch-all topic is better for this scale
- **Phase 4:** Structured output / `tool_use` schema design for form field suggestions — prompt engineering for Swedish building domain needs testing against real form schemas; hallucination risk is MEDIUM-HIGH

Phases with standard patterns (skip research-phase):

- **Phase 3:** User task claim/complete REST flow is fully documented in Camunda 7 official docs; DynamicForm reuse is already validated; only the proxy route wiring is net-new
- **Phase 1 (BPMN deployment):** `deploy-changed-only=true` multipart POST pattern is well-documented and verified in the architecture research

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All three new packages confirmed via official repos and npm; ESM compatibility verified against demo-server.mjs module format |
| Features | MEDIUM | Camunda 7 REST API patterns are HIGH confidence; AI form assistant UX patterns sourced from industry analogues (Adobe Workfront, Microsoft Power Pages); "suggest values" specifics are LOW from training data |
| Architecture | HIGH | Patterns verified via official Camunda docs and direct reading of existing codebase (`demo-server.mjs`, `delegates/index.ts`, `delegates/types.ts`); in-process worker pattern confirmed as correct approach for single-org deployment |
| Pitfalls | HIGH (Camunda), MEDIUM (AI) | Camunda pitfalls sourced from official docs and verified forum threads; AI hallucination mitigation sourced from Anthropic official docs; concurrent task completion behaviour is MEDIUM (community-confirmed, not official spec) |

**Overall confidence:** HIGH for infrastructure phases (1-2), MEDIUM for AI phase (4)

### Gaps to Address

- **`candidateGroup` REST filter edge case:** Documented bug where tasks may not appear in group queue if user is also assignee of another task. Test this pattern in Phase 3 spike before building the full inbox UI.
- **Camunda community edition auth defaults:** The default `demo/demo` admin credentials and whether Camunda enforces assignee on task completion without identity service configured. Verify in Phase 1 and harden before Phase 3.
- **Claude API structured output for form schemas:** The exact prompt + `tool_use` schema design for Swedish building management forms needs empirical testing — confidence is LOW until tested against real `FormSchema` JSON from `FormService`.
- **39-BPMN topic count impact on `fetchAndLock` performance:** Research suggests grouping beyond ~20 topics per request can cause timeouts, but exact threshold for Camunda 7.23 is not confirmed. Investigate in Phase 2.

---

## Sources

### Primary (HIGH confidence)
- [Camunda 7.23 Download Center](https://downloads.camunda.cloud/release/camunda-bpm/run/7.23/) — JAR availability and version
- [camunda-external-task-client-js GitHub](https://github.com/camunda/camunda-external-task-client-js) — official library, ESM compatibility, handler API
- [@anthropic-ai/sdk npm](https://www.npmjs.com/package/@anthropic-ai/sdk) — version, usage
- [Camunda 7 User Task REST — submit-form](https://docs.camunda.org/manual/7.4/reference/rest/task/post-submit-form/) — stable across 7.x
- [Camunda: External Tasks — Error Handling and Retry](https://docs.camunda.org/manual/latest/user-guide/process-engine/external-tasks/) — retry/lock patterns
- [Anthropic Docs: Reduce Hallucinations](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations) — prompt engineering for enum fields
- Existing codebase: `backend/demo-server.mjs`, `backend/src/delegates/index.ts`, `backend/src/delegates/types.ts` — directly read

### Secondary (MEDIUM confidence)
- [Camunda 7 CE EoL announcement](https://forum.camunda.io/t/important-update-camunda-7-community-edition-end-of-life-announced/50921) — forum post, not official blog
- [Camunda Forum: candidateGroup REST API](https://forum.camunda.io/t/rest-api-including-candidategroup-param/2591) — known edge-case bug
- [Camunda Forum: Problem with Camunda REST API and CORS](https://forum.camunda.io/t/problem-with-camunda-rest-api-and-cors/29912) — CORS + auth interaction
- [Camunda Forum: H2 File Database Not Created](https://forum.camunda.io/t/h2-file-database-is-physically-not-created-but-only-in-memory/18431) — H2 in-memory pitfall
- [Adobe Workfront: Form Fill powered by AI](https://experienceleague.adobe.com/en/docs/workfront/using/manage-work/requests/create-requests/autofill-from-prompt-document) — AI form assistant UX pattern
- [Microsoft Power Pages: AI form-filling assistant](https://learn.microsoft.com/en-us/power-platform/release-plan/2024wave1/power-pages/use-generative-ai-assistant-simplify-form-filling) — AI form assistant UX pattern

### Tertiary (LOW confidence)
- [@types/camunda-external-task-client-js npm](https://www.npmjs.com/package/@types/camunda-external-task-client-js) — DefinitelyTyped, community-maintained; type coverage may lag library JS API
- [Camunda Forum: External Task Async Response, Lock Duration, MaxTask](https://forum.camunda.io/t/external-task-async-response-lock-duration-maxtask-and-backoffstrategy/51553) — topic count thresholds, needs validation at Phase 2

---
*Research completed: 2026-03-08*
*Ready for roadmap: yes*
