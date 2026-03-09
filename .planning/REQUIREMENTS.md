# Requirements: Doorman — v1.0 Camunda Integration + Task Worker UI

**Defined:** 2026-03-08
**Core Value:** Users work BPMN-driven tasks through a Swedish UI showing the right admin-configured form fields at each lifecycle stage — Camunda enforces the process.

## v1.0 Requirements

### Camunda Infrastructure

- [ ] **INFRA-01**: Camunda 7.23.0 Run (standalone JAR) starts without Docker on macOS, backed by existing PostgreSQL (`doorman_db`) instead of H2
- [ ] **INFRA-02**: Backend deploys all 39 BPMN files to Camunda via REST on startup, using `deploy-changed-only` to prevent version proliferation on restart
- [ ] **INFRA-03**: All frontend → Camunda REST calls are proxied through `/api/camunda/*` routes in `demo-server.mjs` (avoids CORS, enforces auth)

### External Task Worker

- [ ] **WORK-01**: External Task polling loop runs inside `demo-server.mjs` using `camunda-external-task-client-js`, dispatching fetched service tasks to the existing `executeDelegate()` registry in `backend/src/delegates/index.ts`
- [ ] **WORK-02**: Worker handles retries correctly (`task.retries ?? 3`, decrement, min 0), reports failures as Camunda incidents rather than infinite loops
- [ ] **WORK-03**: Worker uses typed Camunda variable builder so Boolean/Integer/String variables route BPMN gateways correctly (no silent type coercion)

### Task Worker UI

- [ ] **UI-01**: Task inbox page lists Camunda user tasks assigned to or claimable by the logged-in user's group, showing task name, process name, and created date
- [ ] **UI-02**: User can claim an unclaimed task and unclaim a task they previously claimed
- [ ] **UI-03**: Claiming a task loads the admin-configured DynamicForm via the task's `formKey` (calls existing `generateFormFromKey()` in FormService), displaying the correct fields as configured in the admin UI
- [ ] **UI-04**: User can submit the completed form, which sends typed variables back to Camunda and completes the user task, advancing the process
- [ ] **UI-05**: Process instance timeline view shows which phase/subprocess is currently active for a selected building/process instance

## v2 Requirements (Deferred)

### AI Form Assistant

- **AI-01**: "Suggest values" button on DynamicForm calls Claude API (`@anthropic-ai/sdk`) to suggest field values for the active form
- **AI-02**: Per-field Accept/Reject panel — worker reviews AI suggestions before submitting; never auto-fills
- **AI-03**: Backend validates AI suggestions against `attribute_validators` before writing to `attribute_values`

## Out of Scope

| Feature | Reason |
|---------|--------|
| Docker-based Camunda | No Docker available on dev machine |
| Java delegates | External Task REST pattern replaces this; TypeScript-only |
| Camunda Tasklist (built-in) | Replaced by custom task inbox wired to admin-configured DynamicForm |
| BPMN diagram viewer in task UI | High complexity (bpmn-js), not needed by task workers |
| Real-time WebSocket updates | Polling sufficient for building lifecycle timescales |
| Mobile app | Web-first |
| AI form assist | Deferred to v1.1 — ship core flow first |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| WORK-01 | Phase 2 | Pending |
| WORK-02 | Phase 2 | Pending |
| WORK-03 | Phase 2 | Pending |
| UI-01 | Phase 3 | Pending |
| UI-02 | Phase 3 | Pending |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 3 | Pending |
| UI-05 | Phase 4 | Pending |

**Coverage:**
- v1.0 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-08*
*Last updated: 2026-03-08 after initial definition*
