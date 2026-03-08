# Feature Research

**Domain:** Camunda 7 Task Worker UI + AI Form Assistant (building lifecycle management)
**Researched:** 2026-03-08
**Confidence:** MEDIUM — Camunda 7 REST API patterns are HIGH confidence from official docs; AI form assistant UX is MEDIUM from multiple industry sources; "suggest values" specifics are LOW from training data + web search.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features workers assume exist. Missing these = system feels broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Task inbox list | Workers need to see what they must do | LOW | Query `GET /engine-rest/task?assignee=X` and `candidateGroup=Y`; merge results. Camunda returns id, name, formKey, created, due, priority. |
| Filter by assignee / my tasks | Workers only care about their own queue | LOW | Two modes: "My Tasks" (assignee=me) and "Group Tasks" (candidateGroup=myGroups, unassigned). Toggle in UI. |
| Filter by group | Supervisors need group-level view | LOW | `candidateGroup` query param — documented but has known edge-case bugs in Camunda 7 REST; test early. |
| Claim task | Prevents two workers taking the same task | LOW | `POST /engine-rest/task/{id}/claim` with `{userId}`. Claimed task moves from group queue to personal queue. |
| Unclaim / return to group | Worker can put task back if stuck | LOW | `POST /engine-rest/task/{id}/unclaim`. Essential or inbox becomes a dead-end. |
| Load form by formKey | Each task has a different form | MEDIUM | formKey from task response → `FormService.generateFormFromKey()` already wired. Render via existing `DynamicForm` component. |
| Submit task completion | Submitting the form completes the process step | MEDIUM | `POST /engine-rest/task/{id}/complete` with `{variables: {...}}`. Must map form field values to Camunda variable format. |
| Task count / badge | Workers need to see pending work at a glance | LOW | Count of unassigned group tasks displayed in nav. Single `GET /engine-rest/task/count?candidateGroup=X`. |
| Error feedback on submit | Form validation, required fields, server errors | LOW | DynamicForm already has field-level validation. Add submit error banner for Camunda failures. |
| Loading / in-progress states | Workers submitting forms on slow connections | LOW | Disable submit button on submit, show spinner. Prevent double-submit. |

### Differentiators (Competitive Advantage)

Features that make this task worker portal better than the default Camunda Tasklist.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI form assistant (suggest values) | Workers fill complex 60-field door forms faster with less errors | HIGH | Sidebar panel or inline button; calls Claude API with form schema + current values + context (objectType, task name, prior audit log) → returns field suggestions. User reviews and accepts/rejects individually. |
| Swedish-language UI throughout | Native language reduces cognitive load | LOW | Already in place via SamrumLayout + Swedish labels. Extend task names and status messages. |
| Process instance timeline | Supervisors can see which lifecycle phase a building is in | MEDIUM | `GET /engine-rest/process-instance/{id}/activity-instances` returns tree of active activities + subprocesses. Map activity names to human-readable PLCS phase labels. |
| Permission-filtered task forms | Workers only see / edit fields they are authorized for | MEDIUM | Already done by `FormService.generateFormFromKey()` — the integration wires this to the task inbox so the right form appears per task+user. Differentiates from generic Camunda Tasklist which renders raw embedded forms. |
| Escalate task | Workers can flag a task for supervisor attention | LOW | Set a Camunda variable `escalated=true` and complete the task — or use a message event if process models it. Requires checking BPMNs for escalation paths. |
| Due date prominence | Building lifecycle tasks have regulatory deadlines | LOW | Display `due` date from Camunda task response with color coding (overdue = red, due soon = amber). Sort by due by default. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time task push / WebSockets | "Tasks should appear instantly" | Adds infrastructure (SSE or WS server), complex reconnect logic, out of scope for v1 | Poll every 30 seconds on the inbox page — sufficient for building lifecycle workflows where tasks take hours/days, not seconds |
| BPMN diagram viewer embedded in task UI | "Workers want to see the process" | Workers don't need the full diagram — they need their step. Rendering BPMN is a separate library (bpmn-js, ~200KB) with non-trivial integration | Process instance timeline (phase labels) gives orientation without the weight |
| AI auto-fill without review | "Save clicks, fill the form automatically" | Workers lose accountability; silently wrong values create liability in regulatory context | Always present AI suggestions as suggestions — user must click Accept per field or Accept All with explicit acknowledgment |
| Bulk task completion | "Complete multiple tasks at once" | BPMN tasks may have interdependencies; bulk completion bypasses form data entry, corrupts process variables | Single-task focus; task count badge tells workers how many remain |
| Full process history / audit log in task UI | "Show all past changes in the task" | The audit_log table is already designed for this but rendering it inline adds complexity and scope creep | Link to a separate "Object History" page that exists in the admin section |
| Reassign task to specific user | "Supervisor wants to delegate" | Requires user directory integration, person search UI, role validation — separate system concern | Unclaim → task returns to group queue; group picks it up. Escalation variable signals supervisor need. |
| Camunda Cockpit embedding | "Embed the Cockpit process view" | Cockpit is a separate app; iframing is fragile, auth doesn't cross, doesn't work with standalone JAR in no-Docker setup | Build a minimal process instance timeline using the REST API directly |

---

## Feature Dependencies

```
[Task Inbox] ──requires──> [Camunda 7 Run (JAR) running]
    └──requires──> [BPMN files deployed to Camunda]

[Task Inbox]
    └──requires──> [Backend: poll GET /engine-rest/task]

[Load Form by formKey]
    └──requires──> [Task Inbox] (must have taskId + formKey)
    └──requires──> [FormService.generateFormFromKey()] ← already built

[Submit Task]
    └──requires──> [Load Form by formKey]
    └──requires──> [DynamicForm component] ← already built

[AI Form Assistant]
    └──requires──> [Load Form by formKey] (needs active FormSchema)
    └──requires──> [Claude API key + @anthropic-ai/sdk]
    └──enhances──> [Submit Task] (better data quality)

[Process Instance Timeline]
    └──requires──> [Camunda 7 running]
    └──requires──> [Backend: GET /engine-rest/process-instance/{id}/activity-instances]
    └──independent of──> [Task Inbox] (can link from object view, not task)

[Claim Task]
    └──requires──> [Task Inbox]

[Unclaim Task]
    └──requires──> [Claim Task]

[External Task Worker (backend)]
    └──requires──> [Camunda 7 Run running]
    └──parallel with──> [Task Inbox] (different task types: service vs user)
    └──uses──> [backend/src/delegates/index.ts] ← already built (stubs)
```

### Dependency Notes

- **Task Inbox requires Camunda 7 running first:** All frontend task features are blocked until Camunda JAR is up and BPMNs are deployed. This is the hardest dependency.
- **AI Form Assistant requires active FormSchema:** It reads the schema to know which fields to suggest values for. No form = no AI assist.
- **External Task Worker is parallel to Task Inbox:** Service tasks (delegates) are completed by the backend worker; User tasks are completed by the frontend task UI. They use different Camunda REST endpoints and do not block each other in implementation but both need Camunda running.
- **Process Instance Timeline is independent:** Can be built as a widget on the Object detail page, doesn't require the task inbox to be done first.

---

## MVP Definition

### Launch With (v1)

Minimum to make the task worker portal usable by property managers.

- [ ] Task inbox: list my tasks + group tasks with claim/unclaim — workers can find work
- [ ] Load and render form by formKey via existing FormService + DynamicForm — workers can see the form
- [ ] Submit form → complete Camunda user task with variables — the process actually advances
- [ ] AI form assistant: suggest values button → Claude API → show suggestions panel with per-field accept/reject — the differentiating feature
- [ ] External Task Worker backend polling + delegate dispatch — service tasks complete automatically (required for processes to flow between user tasks)

### Add After Validation (v1.x)

- [ ] Process instance timeline — add once v1 is stable; useful for supervisors but not blockers for workers
- [ ] Due date color coding + sort — add once task inbox is working; trivial enhancement
- [ ] Task count badge in nav — polish item; add to SamrumLayout header
- [ ] Escalation variable on submit — depends on BPMN models having escalation paths; verify before building

### Future Consideration (v2+)

- [ ] Notification emails when tasks assigned to group — requires email infrastructure, out of scope
- [ ] Task priority manual override — requires process model changes to honour it
- [ ] Mobile-responsive task UI — low value in building inspection context (tablet/desktop use assumed)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Task inbox (list + claim/unclaim) | HIGH | LOW | P1 |
| Load form by formKey | HIGH | LOW (already wired) | P1 |
| Submit task completion | HIGH | LOW | P1 |
| External Task Worker (delegates) | HIGH | MEDIUM (polling loop + error handling) | P1 |
| AI form assistant | HIGH | HIGH (LLM integration + UX) | P1 |
| Process instance timeline | MEDIUM | MEDIUM | P2 |
| Due date display + sort | MEDIUM | LOW | P2 |
| Task count badge | LOW | LOW | P2 |
| Escalation variable | LOW | LOW (if BPMN supports it) | P3 |

**Priority key:**
- P1: Must have for launch — without these the portal is non-functional
- P2: Should have, adds value once core works
- P3: Nice to have, needs BPMN verification first

---

## AI Form Assistant — UX Pattern Detail

This is the most novel feature and deserves a deeper specification since there is no standard Camunda pattern for it.

### Suggest Values Interaction Model

Industry pattern (Adobe Workfront, Microsoft Power Pages, 2024-2025):

1. **Trigger:** Worker opens a task form. Sidebar panel shows "AI Assistent" button (or inline icon per field group).
2. **Context sent to Claude API:**
   - FormSchema (field names, types, allowed values, Swedish labels)
   - Current attribute values already in the database for this object instance
   - Task name + process name (e.g., "Inspektera dörr — Förvaltning")
   - Object type (e.g., "ID tillträdesobjekt")
   - Optional: last audit log entry for the object
3. **Claude response format:** Structured JSON — one suggested value per field ID, plus a confidence score and a brief rationale in Swedish.
4. **Presentation:** Suggestions panel slides in. Each field shows: current value (if any) | suggested value | "Godkänn" (Accept) button. "Godkänn alla" (Accept All) button at top.
5. **Worker action:** Click Accept per field or Accept All. DynamicForm field values update. Worker reviews the complete form and submits normally.
6. **Non-negotiable:** Worker always submits; AI never submits. User remains accountable.

### What NOT to do

- Do not stream the response character-by-character — display suggestions atomically when complete.
- Do not auto-accept any field — Swedish regulatory context requires explicit human approval.
- Do not send full audit log history in prompt — token cost; send last 1-3 entries only.
- Do not call Claude on every keystroke — one call per "Föreslå värden" button click.

---

## Camunda 7 REST API Reference (key endpoints for implementation)

| Action | Method | Endpoint |
|--------|--------|----------|
| List tasks (my tasks) | GET | `/engine-rest/task?assignee={userId}` |
| List tasks (group) | GET | `/engine-rest/task?candidateGroup={group}&unassigned=true` |
| Task count | GET | `/engine-rest/task/count?candidateGroup={group}` |
| Claim task | POST | `/engine-rest/task/{id}/claim` body: `{userId}` |
| Unclaim task | POST | `/engine-rest/task/{id}/unclaim` |
| Complete task | POST | `/engine-rest/task/{id}/complete` body: `{variables: {key: {value, type}}}` |
| Get task variables | GET | `/engine-rest/task/{id}/variables` |
| Activity instances | GET | `/engine-rest/process-instance/{id}/activity-instances` |
| List process instances | GET | `/engine-rest/process-instance?active=true` |

**Known issue:** `candidateGroup` filter in Camunda 7 REST has documented edge cases — if a user is also the assignee of another task, group tasks may not appear. Test this pattern early (Phase 1 spike).

---

## Sources

- [Camunda 7: Extending Human Task Management (C7)](https://unsupported.docs.camunda.io/8.1/docs/components/best-practices/architecture/extending-human-task-management-c7/)
- [Camunda: Understanding Human Task Management](https://docs.camunda.io/docs/components/best-practices/architecture/understanding-human-tasks-management/)
- [Camunda Forum: candidateGroup REST API](https://forum.camunda.io/t/rest-api-including-candidategroup-param/2591)
- [Camunda Forum: Claim vs Set Assignee vs Identity Links](https://forum.camunda.io/t/claim-vs-set-assignee-vs-identity-links-rest-api/31678)
- [Adobe Workfront: Form Fill powered by AI](https://experienceleague.adobe.com/en/docs/workfront/using/manage-work/requests/create-requests/autofill-from-prompt-document)
- [Microsoft Power Pages: AI form-filling assistant](https://learn.microsoft.com/en-us/power-platform/release-plan/2024wave1/power-pages/use-generative-ai-assistant-simplify-form-filling)
- [Shape of AI: UX Patterns for AI](https://www.shapeof.ai/)
- [Camunda Blog: Custom Tasklist Examples](https://camunda.com/blog/2018/02/custom-tasklist-examples/)

---

*Feature research for: Camunda 7 task worker UI + AI form assistant (Doorman/Samrum)*
*Researched: 2026-03-08*
