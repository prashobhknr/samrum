# Pitfalls Research

**Domain:** Camunda 7 Run (standalone JAR) + Node.js External Task Worker + Claude AI — integration into existing TypeScript/Next.js app
**Researched:** 2026-03-08
**Confidence:** HIGH (Camunda official docs + forum), MEDIUM (Claude API official docs), LOW flagged where only community sources

---

## Critical Pitfalls

### Pitfall 1: Camunda H2 Defaults to In-Memory Mode After Restart

**What goes wrong:**
Camunda Run ships with H2 as its default database. Out of the box, H2 uses an in-memory connection string (`jdbc:h2:mem:...`). Every restart wipes all process instances, deployments, history, and incidents. Developers don't notice until they restart Camunda mid-development and all their test data vanishes — including already-deployed BPMN versions and running process instances.

**Why it happens:**
The `default.yml` in Camunda Run uses in-memory H2. Engineers assume "file-mode H2" is default because the file `process-engine.mv.db` does appear on disk in some configurations — but only if the JDBC URL was explicitly set to file mode. The subtle difference between `jdbc:h2:mem:camunda` and `jdbc:h2:./camunda-h2-dbs/process-engine` is missed on first setup.

**How to avoid:**
Switch to PostgreSQL immediately. Doorman already has PostgreSQL running at `postgresql://doorman_user:doorman_pass@localhost:5432/doorman_db`. Configure Camunda Run's `application.yml` with:

```yaml
spring.datasource:
  url: jdbc:postgresql://localhost:5432/doorman_db
  username: doorman_user
  password: doorman_pass
  driver-class-name: org.postgresql.Driver
```

The PostgreSQL JDBC driver JAR must be placed in Camunda Run's `configuration/userlib/` directory — it is NOT bundled. Download `postgresql-42.x.x.jar` from Maven Central and drop it there.

**Warning signs:**
- Process instances and deployments disappear after restarting Camunda
- Camunda Cockpit shows zero deployments even though you deployed earlier
- Log shows `H2` or `mem:` in the datasource URL at startup

**Phase to address:** Phase 1 — Camunda Startup. Do not proceed to BPMN deployment until PostgreSQL connection is confirmed.

---

### Pitfall 2: CORS Blocks All REST Calls When Auth Is Enabled

**What goes wrong:**
The backend (port 3000) calls Camunda REST (port 8080). CORS is configured in Camunda Run's `application.yml`, but when basic authentication is also enabled, the browser's preflight OPTIONS request fails because `authorization` is not in the `Access-Control-Allow-Headers` list. The result: all REST calls from the Node.js server-side code work fine (no CORS check), but any direct frontend → Camunda calls (e.g., task list, process diagram) fail silently with `No 'Access-Control-Allow-Origin' header` errors.

**Why it happens:**
Two separate configuration axes (CORS filter and auth filter) interact in Camunda Run. The CORS filter must be ordered BEFORE the authentication filter. Additionally, the `allowed-headers` list must explicitly include `authorization`. Developers configure one but not the other.

**How to avoid:**
In `application.yml` for Camunda Run:

```yaml
camunda.bpm.run.cors:
  enabled: true
  allowed-origins: "http://localhost:3001,http://localhost:3000"
  allowed-headers: "origin,content-type,accept,authorization,x-requested-with"
  allow-credentials: true
```

For the Doorman architecture: route ALL Camunda REST calls through the Node.js backend (port 3000), never from the frontend directly. This eliminates CORS entirely for production.

**Warning signs:**
- `XMLHttpRequest cannot load` or `CORS policy` errors in browser console
- Postman/curl works but frontend calls fail
- OPTIONS preflight returns 401 (auth fires before CORS)

**Phase to address:** Phase 1 — Camunda Startup. Wire CORS and auth configuration before any frontend integration work.

---

### Pitfall 3: External Task Infinite Retry Loop on Delegate Failure

**What goes wrong:**
A delegate throws an unhandled exception. The worker calls `handleFailure()` with `retries = task.getRetries() - 1` — but the initial value of `task.getRetries()` from a fresh fetch is `null` (not a number). `null - 1` equals `-1` in JavaScript, so retries is set to `-1`, which Camunda treats as retries remaining, and the task gets queued again immediately. The worker fetches and fails again. Infinite loop at maximum poll speed.

**Why it happens:**
The official `camunda-external-task-client-js` library returns `null` for `retries` on first acquisition (the task has never failed before). The JavaScript `-` operator coerces `null` to `0`, giving `-1`. Most examples online show Java code where `getRetries()` returns an integer default.

**How to avoid:**
Always use a null-safe retry decrement with a defined starting value:

```typescript
const retries = task.retries ?? 3; // start at 3 if first attempt
await taskService.handleFailure(task, {
  errorMessage: err.message,
  errorDetails: err.stack ?? '',
  retries: Math.max(0, retries - 1),
  retryTimeout: 30_000, // 30s back-off
});
```

When `retries` reaches `0`, Camunda creates an incident visible in Cockpit — this is the correct termination behavior.

**Warning signs:**
- CPU spikes in Node.js process (poll loop running at maximum speed)
- Same task ID appears in logs repeatedly within milliseconds
- Camunda Cockpit shows task with very high failure count but no incident

**Phase to address:** Phase 2 — External Task Worker. This is a day-1 implementation requirement, not a later hardening step.

---

### Pitfall 4: Lock Duration Shorter Than Delegate Execution Time

**What goes wrong:**
The lock duration is set to the default (e.g., 20 seconds). A delegate that calls PostgreSQL + Claude API takes 8-12 seconds on average but occasionally 25+ seconds (Claude latency spike, DB slow query). When the lock expires mid-execution, Camunda releases the task. Another worker fetch picks it up and starts executing the same delegate concurrently. The same door object gets two conflicting writes to `attribute_values`. Audit log gets duplicate entries. Process advances twice.

**Why it happens:**
Engineers set lock duration equal to the "normal" execution path. They don't account for external service latency variance (Claude API p95 latency can be 10-15x the median).

**How to avoid:**
Set lock duration to at least 3x the maximum expected execution time. For delegates that call Claude API, use a 5-minute lock minimum:

```typescript
client.subscribe('doorman-delegate', {
  lockDuration: 300_000, // 5 minutes
  maxTasks: 5,
}, async ({ task, taskService }) => { ... });
```

For very long delegates, call `taskService.extendLock(task, additionalMs)` before the Claude API call to dynamically extend.

**Warning signs:**
- Duplicate `audit_log` entries for the same `instance_id` + `attribute_name` within seconds
- Process instances showing unexpected branching in Cockpit (two tokens)
- `handleFailure` errors with "task not found" (task was already reassigned)

**Phase to address:** Phase 2 — External Task Worker. Set conservative defaults in the worker bootstrap; tune down later if needed.

---

### Pitfall 5: BPMN Redeploy Creates New Version, Old Instances Get Stuck

**What goes wrong:**
On every backend startup, the Node.js server deploys all 39 BPMN files via `POST /engine-rest/deployment/create`. Camunda uses deployment name + resource hash to decide whether to create a new version. If anything in the BPMN XML changes (even whitespace, XML attribute order, or a modeler save), a new version (v2, v3...) is created. Running process instances remain pinned to their original version. The frontend's process instance timeline queries `GET /engine-rest/process-definition?latestVersion=true` — it returns v3 definitions but the running instances use v1. Form keys, task definitions, and variable names may diverge.

**Why it happens:**
Developers assume "deploy on startup" is idempotent. Camunda's deduplication is hash-based — any binary change creates a new version. Common triggers: saving the BPMN in Camunda Modeler (reformats XML), adding/removing whitespace, updating extension attributes.

**How to avoid:**
Use `deployment-source` and `enable-duplicate-filtering=true` in deployment requests:

```typescript
const formData = new FormData();
formData.append('deployment-name', 'doorman-processes');
formData.append('enable-duplicate-filtering', 'true');
formData.append('deploy-changed-only', 'true'); // only redeploy changed files
```

`deploy-changed-only=true` is the critical flag — it compares resource checksums and skips unchanged BPMNs. Commit BPMN files with `git` and treat them as immutable artifacts once in production.

**Warning signs:**
- `GET /engine-rest/process-definition?key=master-building-lifecycle` returns multiple versions
- Running instances reference a different `processDefinitionId` than what the API returns as `latest`
- New user tasks spawned after a redeploy have different formKey values than expected

**Phase to address:** Phase 3 — BPMN Deployment. Must be correct from the first deploy; version proliferation is very hard to clean up.

---

### Pitfall 6: Claude API Called Synchronously in the Task Completion Hot Path

**What goes wrong:**
The AI form assistant endpoint is wired as middleware in the task completion flow: user submits form → backend calls Claude API for validation → task completes. Claude API median latency is 1-4 seconds; p95 is 8-20 seconds. The frontend form submit hangs. If the Claude call times out or errors, the task completion also fails — the user loses their work and the Camunda user task remains unclaimed.

**Why it happens:**
The AI suggestion feature is designed as "AI validates before submitting," which naturally maps to a synchronous pre-completion call. The latency cost is invisible during development on fast connections with short prompts.

**How to avoid:**
Decouple AI suggestions from task completion. The AI assistant should be a separate "suggest" endpoint called eagerly when the user opens the form (fire-and-forget from the frontend's perspective), not a gate on submission:

```
User opens task → frontend calls POST /api/ai/suggest (non-blocking)
             → frontend renders form immediately
             → AI suggestions arrive async, streamed into hint fields
User submits → POST /engine-rest/task/{id}/complete (no AI in this path)
```

Never block task completion on Claude API response. Use streaming (`stream: true` in Anthropic SDK) for the suggestion UI.

**Warning signs:**
- Form submit takes >2 seconds
- Users reporting "form stuck" or double-submitting
- Claude timeout errors causing task completion failures

**Phase to address:** Phase 4 — AI Form Assistant. Establish the async architecture pattern from the start of AI integration work.

---

### Pitfall 7: Claude Hallucinates Swedish Domain Values Not in Its Training Data

**What goes wrong:**
Claude is asked to suggest values for Swedish building management forms (e.g., lock type codes, "ASSA 2000-serien", building codes, Swedish municipality identifiers). Claude generates plausible-sounding but incorrect values — wrong lock codes, invented building regulation references, wrong Swedish standard names. Users who trust the suggestions enter bad data into production records.

**Why it happens:**
Swedish building/access-control domain vocabulary is sparse in Claude's training data. The model fills gaps with confident-sounding fabrications. This is worse than English-language domains because the model has less grounding.

**How to avoid:**
Always inject the valid options as context in the prompt. For enum/picklist fields, pass the complete valid values list:

```typescript
const prompt = `
You are helping fill a Swedish door management form.
The field "låstyp" accepts ONLY these values: ${validLockTypes.join(', ')}.
Based on the door description: "${description}", suggest the most appropriate value.
If none fit, respond with null.
Do not invent new values.
`;
```

For free-text fields, explicitly instruct: "Only suggest values based on the provided context. If uncertain, say 'Ej tillgängligt' (Not available)." Use structured output (`tool_use` / JSON schema) to prevent free-form hallucination.

**Warning signs:**
- AI suggestions contain codes or standard references that don't match the `object_attributes` enum lists
- Users accepting AI suggestions that fail backend validators
- Swedish terms with correct structure but wrong semantics (e.g., "ASSA 710" instead of "ASSA 710E")

**Phase to address:** Phase 4 — AI Form Assistant. Prompt design must include valid option injection from day 1.

---

### Pitfall 8: Camunda Variable Type Mismatch Breaks Gateways

**What goes wrong:**
The Node.js backend completes a Camunda user task by posting variables as raw JSON: `{ "variables": { "approved": { "value": "true" } } }`. Note `"true"` (string). The BPMN gateway expression is `${approved == true}` (boolean comparison). The string `"true"` does not equal boolean `true` in JUEL (Camunda's expression language). The gateway falls to the default sequence flow, routing the process incorrectly. No error is thrown — the process just takes the wrong path silently.

**Why it happens:**
JavaScript `JSON.stringify` serializes booleans as `true` but when developers hand-write the variable payload or read form values from HTML inputs, everything becomes a string. The Camunda REST API requires explicit type annotation to coerce correctly.

**How to avoid:**
Always include the `type` field in variable payloads:

```typescript
{
  "variables": {
    "approved": { "value": true, "type": "Boolean" },
    "doorId": { "value": 42, "type": "Integer" },
    "formKey": { "value": "doorman:6:3", "type": "String" }
  }
}
```

Create a typed variable builder utility in `backend/src/services/camundaVariables.ts` used everywhere task completion is called. Never pass raw form input values without coercion.

**Warning signs:**
- Process instances reach unexpected end events or default flows
- Gateway evaluation logs show unexpected path in Camunda Cockpit
- Tasks that should trigger an escalation subprocess silently complete instead

**Phase to address:** Phase 3 — User Task Frontend + Task Completion. Build the variable serialization utility before the first end-to-end test.

---

### Pitfall 9: Claiming a Task Does Not Prevent Concurrent Completion

**What goes wrong:**
Two users open the same task in the Doorman task inbox simultaneously (e.g., two property managers checking their queue). Both see it as "unclaimed." Both click "Claim." Camunda allows both claims to succeed (last write wins on assignee). Both users fill in the form and submit. The first completion succeeds and advances the process. The second completion call hits `POST /engine-rest/task/{id}/complete` and also succeeds — because Camunda does not reject completion from a non-assigned user by default unless identity service enforcement is configured.

**Why it happens:**
Camunda's task assignment (`assignee`) is advisory by default. The REST completion endpoint does not enforce that the caller matches the assignee unless `camunda.bpm.run.auth` with identity service is configured and the REST call passes user credentials.

**How to avoid:**
Before completing a task, the backend must verify that the requesting user is the current assignee:

```typescript
const task = await getTask(taskId);
if (task.assignee !== currentUser.username) {
  throw new Error('Task not assigned to you');
}
await completeTask(taskId, variables);
```

Additionally, show "claimed by [name]" in the UI and disable the form if another user has the claim. Poll task state every 30 seconds when the form is open.

**Warning signs:**
- Duplicate `audit_log` entries for the same task completion
- Process instances with duplicate tokens downstream of user task
- Users reporting "my submission was overwritten"

**Phase to address:** Phase 3 — Task Inbox UI. Handle at both frontend (disable if claimed by other) and backend (guard in complete endpoint).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Use H2 file mode instead of PostgreSQL | Faster initial setup, no DB config | Data loss on corruption, no concurrent access, Camunda + app DB are separate | Never in this project — PostgreSQL is already running |
| Skip `deploy-changed-only` flag | Simpler deploy code | Version proliferation, running instances diverge from latest definitions | Never — implement from first deploy |
| Inline Claude call in task complete path | Simpler code flow | Submission latency, cascading failures when Claude is slow | Never — always decouple |
| Raw string values in Camunda variables | Less boilerplate | Silent gateway misdirection, extremely hard to debug | Never — use typed variable builder |
| Global `lockDuration` without per-topic tuning | One config value | Slow delegates get killed; fast delegates tie up slots unnecessarily | Acceptable as initial default, tune in Phase 2 review |
| Skip retry decrement null-check | Slightly simpler code | Infinite retry loop floods Camunda, destroys observability | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Camunda REST → Node.js backend | Forgetting the `/engine-rest` path prefix; hitting Camunda's webapp at `:8080/` instead of `:8080/engine-rest/` | Always use base URL `http://localhost:8080/engine-rest` |
| PostgreSQL driver in Camunda Run | Assuming driver is bundled | Drop `postgresql-42.x.x.jar` into `configuration/userlib/` manually |
| External Task `subscribe()` | Subscribing to the same topic name in multiple places (e.g., dev + prod worker both running) | One topic = one active subscriber; use unique topic names per environment or stop dev worker before starting prod |
| Camunda user tasks vs. external tasks | Mixing up the two completion APIs: user tasks use `POST /task/{id}/complete`; external tasks use `POST /external-task/{id}/complete` | Separate code paths; never cross-call |
| Claude API with `@anthropic-ai/sdk` | Not handling `APIStatusError` for 529 (overload) and 529 retry separately | Catch `status === 529` and queue the suggestion retry; never let it propagate to task completion |
| Camunda form variables | Reading `formKey` from task and passing it back as a process variable | `formKey` is a task attribute, not a process variable; never write it back as a variable |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Polling too fast with no tasks available | Node.js CPU usage at 10-20% idle; Camunda REST log flooded with empty 200 responses | Set `pollingInterval: 5000` (5s) minimum; implement exponential back-off when empty responses are received | Immediately at dev scale; worsens with 39 topic subscriptions |
| Fetching all 39 topics in a single poll request | Single `fetchAndLock` call with 39 topic entries times out under load | Group topics by functional area; use separate subscriber registrations | At ~20+ topics per request or high task volume |
| Synchronous Claude call per form field | Each field suggestion is a separate API call (e.g., 8 fields = 8 calls) | Batch all form fields into a single Claude request; return structured JSON with all suggestions at once | Any multi-field form; 8 calls × 2s = 16s wait |
| `SELECT *` on `attribute_values` without `object_instance_id` filter | Slow form load as attribute_values grows | Always filter by `object_instance_id`; add index on `(object_instance_id, attribute_id)` | At ~10K attribute values rows |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing Camunda REST API directly to frontend on port 8080 | Anyone with network access can deploy BPMNs, start arbitrary processes, read all task data | Proxy all Camunda REST through Node.js backend; never expose `:8080` beyond localhost |
| Passing Claude API key in frontend code or environment | Key exposure via browser devtools or committed `.env` | Key lives only in backend environment; frontend calls internal `/api/ai/suggest` endpoint |
| Not validating AI-suggested values against permitted enum lists before saving | Hallucinated values bypass frontend validators and get written to `attribute_values` | Backend re-validates all values from AI suggestions against `attribute_validators` table before `INSERT` |
| Using Camunda demo user `demo/demo` in production config | Full admin access to all processes, cockpit, and REST API | Configure `production.yml` with strong credentials; disable Swagger UI (`springdoc.swagger-ui.enabled: false`) |
| Logging full Camunda task variables in Node.js | Task variables may contain PII (door access codes, person identifiers) | Log task ID and topic only; never log variable map contents |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing raw Camunda task IDs (UUIDs) in task inbox | UUID like `f47ac10b-58cc-4372-a567-0e02b2c3d479` is meaningless to property managers | Show human-readable: process name + building reference + task name + date |
| AI suggestions appear after form renders with a "flash" replace | Users who start typing immediately get their input wiped by late-arriving AI suggestions | AI suggestions populate only empty fields; never overwrite user-modified values |
| No feedback when claim fails | User fills form for 5 minutes, submits, gets "task no longer available" | Check claim status on form open; show banner if claimed by another user within 10s of opening |
| Form submit button available when task is not assigned | Users can attempt completion without claim; confusing error from Camunda | Disable submit until claim is confirmed; show "Claim task" CTA prominently |
| Process instance timeline shows Camunda internal IDs | Property managers cannot map a UUID to a building or project | Always resolve `businessKey` or the linked `object_instance_id` and show the Doorman object reference |

---

## "Looks Done But Isn't" Checklist

- [ ] **Camunda startup:** Verify PostgreSQL connection by checking Cockpit shows zero deployments (not the H2 default demo process) — a successful DB connection shows an empty deployment list, not a pre-seeded one
- [ ] **BPMN deployment:** Run `GET /engine-rest/process-definition?key=master-building-lifecycle` and verify only ONE version exists (version 1) — multiple versions means deploy-changed-only is not working
- [ ] **External task worker:** Introduce a deliberate exception in one delegate and verify an incident appears in Camunda Cockpit within 30 seconds (not an infinite retry loop)
- [ ] **Task completion:** Complete a task with a boolean variable, then inspect the process instance in Cockpit — verify the gateway took the expected sequence flow, not the default
- [ ] **AI form assistant:** Send a prompt asking Claude to suggest a value for a field where only one valid option exists — verify the response matches that option and does not invent new ones
- [ ] **CORS:** Open the frontend at `localhost:3001` and use browser devtools Network tab to confirm zero CORS errors on all Camunda-proxied calls
- [ ] **Task claiming:** Open the same task in two browser tabs with two different demo users — verify the second claim attempt shows an error or "already claimed" state
- [ ] **Audit trail:** Complete a task and immediately query `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 5` — verify exactly one row per changed attribute, not duplicates

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| H2 data loss on restart | HIGH | Re-deploy all 39 BPMNs; no running process instances to recover (they are gone); switch to PostgreSQL immediately |
| BPMN version proliferation | MEDIUM | Use `DELETE FROM act_re_procdef WHERE version_ > 1 AND ...` only if no instances reference those versions; requires manual SQL against Camunda tables (risky) |
| Infinite retry loop flooded Camunda | MEDIUM | Suspend the external task topic via `PUT /engine-rest/external-task/suspended`; fix delegate; resume; manually resolve incidents in Cockpit |
| Claude API key leaked | HIGH | Rotate key immediately at console.anthropic.com; audit API logs for unauthorized usage; deploy new key to backend env only |
| Duplicate task completion | MEDIUM | Identify duplicate `audit_log` entries; manually revert incorrect `attribute_values` rows; file incident in Camunda Cockpit; add the assignee guard to backend |
| Lock duration too short causing duplicate execution | HIGH | Identify via duplicate audit_log rows; restore correct `attribute_values` from audit trail; increase lock duration; add idempotency key check in delegate |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| H2 in-memory data loss | Phase 1: Camunda Startup | Restart Camunda; confirm deployments persist |
| CORS with auth | Phase 1: Camunda Startup | Browser devtools — zero CORS errors |
| Infinite retry loop | Phase 2: External Task Worker | Deliberate exception → incident in Cockpit, not loop |
| Lock duration too short | Phase 2: External Task Worker | Slow delegate test (artificial delay) — single execution |
| BPMN version proliferation | Phase 3: BPMN Deployment | Only version 1 exists after repeated deploys |
| Claude in task completion hot path | Phase 4: AI Form Assistant | Form submit < 500ms; Claude errors don't block submit |
| Hallucinated Swedish domain values | Phase 4: AI Form Assistant | Valid-options-only prompt test; backend re-validation |
| Variable type mismatch | Phase 3: Task Inbox + Completion | Gateway routing test with boolean variable |
| Concurrent task completion | Phase 3: Task Inbox UI | Two-user concurrent claim + completion test |

---

## Sources

- [Camunda: What You Should Know About Using Camunda Platform Run in Production](https://camunda.com/blog/2021/05/what-you-should-know-about-using-camunda-platform-run-in-production/)
- [Camunda Docs: External Tasks — Error Handling and Retry](https://docs.camunda.org/manual/latest/user-guide/process-engine/external-tasks/)
- [Camunda Forum: Problem with Camunda REST API and CORS](https://forum.camunda.io/t/problem-with-camunda-rest-api-and-cors/29912)
- [Camunda Forum: External Task Fetch and Lock Issue](https://forum.camunda.io/t/external-task-fetch-and-lock-issue/21483)
- [Camunda Forum: External Task Async Response, Lock Duration, MaxTask and BackoffStrategy](https://forum.camunda.io/t/external-task-async-response-lock-duration-maxtask-and-backoffstrategy/51553)
- [Camunda Forum: H2 File Database Not Created — Only In-Memory](https://forum.camunda.io/t/h2-file-database-is-physically-not-created-but-only-in-memory/18431)
- [camunda-external-task-client-js Docs: Handler](https://github.com/camunda/camunda-external-task-client-js/blob/master/docs/handler.md)
- [Anthropic Docs: Reduce Hallucinations](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations)
- [SigNoz: How to Reduce Claude API Latency](https://signoz.io/guides/claude-api-latency/)
- [Camunda External Task Pattern (community experience)](https://medium.com/@dashedsouvik/camunda-external-task-pattern-fd84a29d9d3e)
- [Camunda: Custom Tasklist Examples](https://camunda.com/blog/2018/02/custom-tasklist-examples/)
- [Camunda Forum: REST API — Complete Tasks with Local Variables](https://forum.camunda.io/t/rest-api-complete-tasks-with-local-variables/4784)

---
*Pitfalls research for: Camunda 7 + Node.js External Task + Claude AI integration into Doorman*
*Researched: 2026-03-08*
